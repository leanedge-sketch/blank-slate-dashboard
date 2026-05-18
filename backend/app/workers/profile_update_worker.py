"""
Profile Update Worker
=====================

Background worker that:
- Claims jobs from profile_update_jobs
- Builds rich ICP context via icp_context_service
- Calls Gemini to generate/refresh latest_profile_text
- Updates the customers table
- Logs the result into the RAG conversation table

This worker is designed to be run in a separate process or thread.
It does NOT start automatically; main.py (or a separate runner) should
instantiate ProfileUpdateWorker and call run_forever() when enabled.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import logging

from supabase import Client

from app.database.connection import get_supabase_client
from app.services.ai_service import (
    gemini_chat,
    gemini_embed,
    log_conversation_to_rag,
)
from app.services.icp_context_service import build_customer_context


class ProfileUpdateWorker:
    """
    Simple polling worker. Example usage:

        worker = ProfileUpdateWorker(poll_interval_seconds=15)
        worker.run_forever()
    """

    def __init__(self, poll_interval_seconds: int = 15) -> None:
        self.poll_interval_seconds = poll_interval_seconds
        self.worker_id = os.getenv("HOSTNAME", "profile_worker")
        self.supabase: Client = get_supabase_client()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_forever(self) -> None:
        """
        Infinite loop: claim and process one job at a time.
        Intended to be run in a dedicated process or background thread.
        """
        logging.info("ProfileUpdateWorker started (poll_interval=%ss)", self.poll_interval_seconds)
        while True:
            try:
                processed = self.run_once()
            except Exception as e:
                logging.exception(f"ProfileUpdateWorker fatal error in loop: {e}")
                processed = False

            if not processed:
                time.sleep(self.poll_interval_seconds)

    def run_once(self) -> bool:
        """
        Claim and process a single job.

        Returns:
            True if a job was processed (successfully or not), False if no jobs available.
        """
        job = self._claim_next_job()
        if not job:
            return False

        job_id = job["id"]
        customer_id = job["customer_id"]
        interaction_id = job.get("interaction_id")
        pipeline_id = job.get("pipeline_id")

        logging.info(
            "Processing profile_update_job id=%s customer_id=%s interaction_id=%s pipeline_id=%s",
            job_id,
            customer_id,
            interaction_id,
            pipeline_id,
        )

        try:
            self._process_job(job)
            self._mark_job_done(job)
        except Exception as e:
            logging.exception("Error processing profile_update_job id=%s: %s", job_id, e)
            self._mark_job_failed(job, str(e))

        return True

    # ------------------------------------------------------------------
    # Job lifecycle helpers
    # ------------------------------------------------------------------

    def _claim_next_job(self) -> Optional[Dict[str, Any]]:
        """
        Find and atomically claim the next queued job.
        """
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1) Pick a candidate job by status/priority/time
        resp = (
            self.supabase.table("profile_update_jobs")
            .select("*")
            .eq("status", "queued")
            .lte("run_after", now_iso)
            .order("priority", desc=True)
            .order("run_after", asc=True)
            .limit(1)
            .execute()
        )

        if not resp.data:
            return None

        row = resp.data[0]
        job_id = row["id"]

        # 2) Try to atomically claim it by updating status/lock where still queued
        claim_resp = (
            self.supabase.table("profile_update_jobs")
            .update(
                {
                    "status": "processing",
                    "locked_at": now_iso,
                    "locked_by": self.worker_id,
                }
            )
            .eq("id", job_id)
            .eq("status", "queued")
            .execute()
        )

        if not claim_resp.data:
            # Someone else claimed it
            return None

        return claim_resp.data[0]

    def _process_job(self, job: Dict[str, Any]) -> None:
        """
        Core logic: build context, call Gemini, update customer, log to RAG.
        """
        customer_id: str = job["customer_id"]
        interaction_id: Optional[str] = job.get("interaction_id")
        pipeline_id: Optional[str] = job.get("pipeline_id")

        # 1) Build rich context bundle
        context_bundle = build_customer_context(
            customer_id=customer_id,
            interaction_id=interaction_id,
            pipeline_id=pipeline_id,
        )
        customer_row = context_bundle["customer"]
        context_text: str = context_bundle["context_text"]
        external_fetched_at = context_bundle.get("external_fetched_at")

        customer_name = customer_row.get("customer_name", "")

        # 2) Build Gemini prompt/messages
        system_prompt = (
            "You are an AI CRM strategist for a B2B chemical supplier. "
            "Using the full context provided (customer snapshot, interactions, "
            "sales pipeline, external web + LinkedIn data, and similar past cases), "
            "summarize the current state of this customer and recommend the next 3–5 "
            "high-impact actions for the sales team.\n\n"
            "Requirements:\n"
            "- Plain text only (no markdown, no tables, no emojis)\n"
            "- Keep it under 600 words\n"
            "- Start with a 2–3 sentence overview\n"
            "- Then list numbered next steps (1., 2., 3., ...)\n"
        )

        user_prompt = (
            f"Customer name: {customer_name}\n\n"
            f"Full context below:\n\n{context_text}\n\n"
            "Generate an updated Ideal Customer Profile summary and next best actions."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # 3) Call Gemini for profile text
        profile_text = gemini_chat(messages)
        if not profile_text or not profile_text.strip():
            raise RuntimeError("Gemini returned empty profile text")

        now_iso = datetime.now(timezone.utc).isoformat()

        # 4) Update customer latest_profile_* fields
        update_payload: Dict[str, Any] = {
            "latest_profile_text": profile_text,
            "latest_profile_updated_at": now_iso,
        }
        if external_fetched_at:
            update_payload["external_last_fetched_at"] = external_fetched_at.isoformat()

        (
            self.supabase.table("customers")
            .update(update_payload)
            .eq("customer_id", customer_id)
            .execute()
        )

        # 5) Log into RAG conversation table with embedding
        combined_text = (
            f"ICP Profile (worker) for customer: {customer_name}\n\n{profile_text}"
        )
        try:
            embedding = gemini_embed(combined_text)
        except Exception as e:
            logging.warning("Failed to generate embedding for ICP profile: %s", e)
            embedding = None

        metadata: Dict[str, Any] = {
            "source": "icp_worker",
            "customer_id": customer_id,
            "interaction_id": interaction_id,
            "pipeline_id": pipeline_id,
            "job_id": job["id"],
        }

        try:
            log_conversation_to_rag(
                combined_text,
                embedding=embedding,
                metadata=metadata,
            )
        except Exception as e:
            logging.warning("Failed to log ICP profile to RAG: %s", e)

        # NOTE: Optional: update sales_pipeline metadata/stage based on profile_text.
        # For now we leave stages as-is to avoid surprising sales users.

    def _mark_job_done(self, job: Dict[str, Any]) -> None:
        now_iso = datetime.now(timezone.utc).isoformat()
        job_id = job["id"]
        attempts = int(job.get("attempts") or 0) + 1

        (
            self.supabase.table("profile_update_jobs")
            .update(
                {
                    "status": "done",
                    "attempts": attempts,
                    "locked_at": None,
                    "locked_by": None,
                    "completed_at": now_iso,
                    "error": None,
                }
            )
            .eq("id", job_id)
            .execute()
        )

    def _mark_job_failed(self, job: Dict[str, Any], error_msg: str) -> None:
        job_id = job["id"]
        attempts = int(job.get("attempts") or 0) + 1
        max_attempts = int(job.get("max_attempts") or 3)

        if attempts >= max_attempts:
            status = "failed"
        else:
            status = "queued"

        update_payload: Dict[str, Any] = {
            "status": status,
            "attempts": attempts,
            "locked_at": None,
            "locked_by": None,
            "error": error_msg[:2000],  # truncate to avoid huge rows
        }

        if status == "queued":
            # Backoff: retry after a short delay
            next_run = datetime.now(timezone.utc)
            update_payload["run_after"] = next_run.isoformat()

        (
            self.supabase.table("profile_update_jobs")
            .update(update_payload)
            .eq("id", job_id)
            .execute()
        )



