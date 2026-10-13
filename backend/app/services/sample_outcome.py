"""Sample pass/fail for cold-call sample deals."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

SAMPLE_PASS = "pass"
SAMPLE_FAIL = "fail"
_VALIDATED_STAGES = {"Validation", "Proposal", "Confirmation", "Closed"}


def normalize_sample_outcome(value: Any) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip().lower()
    if raw in {"pass", "passed", "success", "ok"}:
        return SAMPLE_PASS
    if raw in {"fail", "failed", "failure"}:
        return SAMPLE_FAIL
    return None


def sample_outcome_from_metadata(metadata: Any) -> Optional[str]:
    if not isinstance(metadata, dict):
        return None
    return normalize_sample_outcome(metadata.get("sample_outcome"))


def apply_sample_outcome(
    payload: Dict[str, Any],
    *,
    current_stage: Optional[str] = None,
) -> Dict[str, Any]:
    """Record pass/fail on metadata. Fail closes the deal as Lost."""
    meta = dict(payload.get("metadata") or {})
    outcome = normalize_sample_outcome(
        meta.get("sample_outcome") or payload.pop("sample_outcome", None)
    )
    target_stage = payload.get("stage") or current_stage

    if (
        current_stage == "Sample"
        and target_stage in _VALIDATED_STAGES
        and not outcome
    ):
        outcome = SAMPLE_PASS

    if not outcome:
        return payload

    meta["sample_outcome"] = outcome
    meta.setdefault("sample_outcome_at", datetime.now(timezone.utc).isoformat())
    payload["metadata"] = meta

    if outcome == SAMPLE_FAIL and (
        target_stage in (None, "Sample") or current_stage == "Sample"
    ):
        payload["stage"] = "Lost"
        if not str(payload.get("close_reason") or "").strip():
            payload["close_reason"] = "Sample failed"
        if not str(payload.get("reason_for_stage_change") or "").strip():
            payload["reason_for_stage_change"] = "Sample failed"

    return payload


def classify_sample_result(stage: str, metadata: Any) -> Optional[str]:
    """pass / fail / pending for deals that are samples; None if not a sample deal."""
    recorded = sample_outcome_from_metadata(metadata)
    if recorded:
        return recorded
    if stage == "Sample":
        return "pending"
    history = metadata.get("stage_history") if isinstance(metadata, dict) else None
    reached_sample = False
    if isinstance(history, list):
        for row in history:
            if not isinstance(row, dict):
                continue
            if row.get("stage") == "Sample" or row.get("from_stage") == "Sample":
                reached_sample = True
                break
    if stage in _VALIDATED_STAGES and reached_sample:
        return SAMPLE_PASS
    if stage == "Lost" and reached_sample:
        return SAMPLE_FAIL
    return None
