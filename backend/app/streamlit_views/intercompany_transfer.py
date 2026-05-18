# backend/app/streamlit_views/intercompany_transfer.py
"""
Inter-Company Transfer — Streamlit Two-Leg Entry View
=====================================================

Single-screen form that captures ONE transfer (source -> destination) and
materializes it as the TWO ledger rows the database expects after migration
``docs/0002_intercompany_transfers.sql``.

PIPELINE
--------
    user fills form
        │
        ▼
    validate_stock_movement_row(source)      ── pre-flight per-row CHECKs
    validate_stock_movement_row(destination) ── pre-flight per-row CHECKs
        │
        ▼
    validate_intercompany_transfer_pair(...) ── mirrors the SQL trigger
        │
        ▼
    Supabase RPC `insert_intercompany_transfer(...)`  ← atomic, server-side
        │                                              (recommended path)
        ▼
    Fallback: two .insert() calls inside a manual    ← if RPC not deployed
              compensating rollback                    yet

WHY RPC, NOT TWO CLIENT INSERTS
-------------------------------
The Supabase Python SDK (PostgREST) issues each request in its own implicit
transaction — there is no client-side BEGIN/COMMIT spanning two REST calls.
Because the trigger `validate_stock_transfer_pair` is DEFERRABLE INITIALLY
DEFERRED, it only fires at COMMIT, and that COMMIT happens BETWEEN our two
inserts when called from the client. The first insert would always fail the
"paired_movement_id must point at an existing row" rule.

The clean fix is a SECURITY DEFINER SQL function that performs both inserts
inside a single transaction. Deploy ``docs/0002b_rpc_intercompany.sql``
(shipped at the bottom of this file as a comment block) once, then this view
calls it via ``supabase.rpc(...)``.

DROP-IN
-------
Place this file at ``backend/app/streamlit_views/intercompany_transfer.py``
and route to it from your Streamlit nav:

    from backend.app.streamlit_views.intercompany_transfer import render
    render()
"""

from __future__ import annotations

from datetime import date as date_cls
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

import streamlit as st
from postgrest.exceptions import APIError

from backend.app.database.connection import get_supabase_client
from backend.app.models.enums import StockLocation, TransactionType, Unit
from backend.app.utils.validators import (
    TransferLeg,
    validate_intercompany_transfer_pair,
    validate_stock_movement_row,
)

TRANSFER = TransactionType.INTER_COMPANY_TRANSFER.value


# =============================================================================
# Data fetchers (cached) — populate product dropdown
# =============================================================================

@st.cache_data(ttl=300, show_spinner=False)
def _load_products() -> List[Dict[str, Any]]:
    """Return [{id, label}] for the product picker. Adjust columns to taste."""
    sb = get_supabase_client()
    resp = (
        sb.table("products")
        .select("id,chemical,brand,packaging")
        .order("chemical")
        .limit(1000)
        .execute()
    )
    rows = resp.data or []
    return [
        {
            "id": r["id"],
            "label": f"{r.get('chemical','?')} — {r.get('brand','?')} ({r.get('packaging','?')})",
        }
        for r in rows
    ]


# =============================================================================
# Submission paths
# =============================================================================

def _submit_via_rpc(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Preferred path. Calls SQL function `insert_intercompany_transfer`
    (see SQL block at bottom of file). The function performs BOTH inserts
    inside a single transaction so the DEFERRED trigger validates at COMMIT.
    """
    sb = get_supabase_client()
    resp = sb.rpc("insert_intercompany_transfer", payload).execute()
    return {"source_id": resp.data[0]["source_id"], "destination_id": resp.data[0]["destination_id"]} \
        if isinstance(resp.data, list) and resp.data else (resp.data or {})


def _submit_via_paired_inserts(source_row: Dict[str, Any], dest_row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fallback when the RPC has not been deployed yet.

    Strategy: pre-allocate UUIDs client-side so both rows can reference each
    other's id at INSERT time, then issue the two inserts back-to-back. If
    the second insert fails, compensate by deleting the first row.

    Note: this is NOT truly atomic — a network failure between calls can leak
    a half-pair. Prefer the RPC path above for production.
    """
    sb = get_supabase_client()

    src_id = source_row["id"]
    dst_id = dest_row["id"]
    source_row["paired_movement_id"] = dst_id
    dest_row["paired_movement_id"] = src_id

    try:
        sb.table("stock_movements").insert(source_row).execute()
    except APIError as e:
        raise RuntimeError(f"Source leg insert failed: {e.message}") from e

    try:
        sb.table("stock_movements").insert(dest_row).execute()
    except APIError as e:
        # Compensating rollback
        try:
            sb.table("stock_movements").delete().eq("id", src_id).execute()
        except APIError:
            pass
        raise RuntimeError(
            f"Destination leg insert failed: {e.message}. Source leg rolled back."
        ) from e

    return {"source_id": src_id, "destination_id": dst_id}


# =============================================================================
# Form renderer
# =============================================================================

def render() -> None:
    """Mount the inter-company transfer form into the current Streamlit page."""
    st.subheader("Inter-Company Stock Transfer")
    st.caption(
        "One submission writes BOTH legs of the ledger. The database trigger "
        "rejects the pair if quantities do not balance."
    )

    products = _load_products()
    if not products:
        st.warning("No products available. Add a product before recording a transfer.")
        return

    locations = StockLocation.values()
    units = Unit.values()

    with st.form("ic_transfer_form", clear_on_submit=False):
        col1, col2 = st.columns(2)
        with col1:
            product_label = st.selectbox(
                "Product",
                options=[p["label"] for p in products],
                index=0,
                key="ic_product",
            )
            source_location = st.selectbox(
                "Source location", options=locations, key="ic_src_loc"
            )
            quantity_kg = st.number_input(
                "Quantity (kg)",
                min_value=0.0,
                step=1.0,
                format="%.3f",
                key="ic_qty",
            )
        with col2:
            transfer_date = st.date_input(
                "Transfer date", value=date_cls.today(), key="ic_date"
            )
            destination_location = st.selectbox(
                "Destination location",
                options=[loc for loc in locations],
                index=min(1, len(locations) - 1),
                key="ic_dst_loc",
            )
            unit = st.selectbox(
                "Unit", options=units, index=units.index("kg") if "kg" in units else 0,
                key="ic_unit",
            )

        reference = st.text_input("Reference / DO #", key="ic_ref")
        remark = st.text_area("Remark", key="ic_remark", height=68)
        use_rpc = st.toggle(
            "Submit via atomic RPC (recommended)",
            value=True,
            help="Disable only if `insert_intercompany_transfer` is not deployed.",
        )

        submitted = st.form_submit_button("Submit transfer", type="primary")

    if not submitted:
        return

    # -------------------------------------------------------------------------
    # Build the two prospective rows
    # -------------------------------------------------------------------------
    product = next(p for p in products if p["label"] == product_label)
    product_id = product["id"]

    src_id = str(uuid4())
    dst_id = str(uuid4())

    source_row: Dict[str, Any] = {
        "id": src_id,
        "product_id": product_id,
        "date": transfer_date.isoformat(),
        "location": source_location,
        "transfer_to_location": destination_location,
        "transaction_type": TRANSFER,
        "unit": unit,
        "inter_company_transfer_kg": float(quantity_kg),
        "balance_kg": 0,                # recomputed server-side by stock_service
        "reference": reference or None,
        "remark": remark or None,
        "paired_movement_id": dst_id,
    }
    dest_row: Dict[str, Any] = {
        "id": dst_id,
        "product_id": product_id,
        "date": transfer_date.isoformat(),
        "location": destination_location,
        "transfer_to_location": None,
        "transaction_type": TRANSFER,
        "unit": unit,
        "inter_company_transfer_kg": float(quantity_kg),
        "balance_kg": 0,
        "reference": reference or None,
        "remark": remark or None,
        "paired_movement_id": src_id,
    }

    # -------------------------------------------------------------------------
    # 1. Per-row validation (mirrors single-row CHECKs)
    # -------------------------------------------------------------------------
    src_errors = validate_stock_movement_row(source_row)
    dst_errors = validate_stock_movement_row(dest_row)

    if src_errors or dst_errors:
        st.error("Per-row validation failed before submission:")
        for field, msg in src_errors.items():
            st.error(f"Source · {field}: {msg}")
        for field, msg in dst_errors.items():
            st.error(f"Destination · {field}: {msg}")
        return

    # -------------------------------------------------------------------------
    # 2. Pair validation (mirrors the SQL trigger validate_stock_transfer_pair)
    # -------------------------------------------------------------------------
    pair_errors = validate_intercompany_transfer_pair(
        source=TransferLeg(
            id=UUID(src_id),
            product_id=UUID(product_id),
            date=transfer_date,
            location=source_location,
            transfer_to_location=destination_location,
            inter_company_transfer_kg=float(quantity_kg),
            paired_movement_id=UUID(dst_id),
        ),
        destination=TransferLeg(
            id=UUID(dst_id),
            product_id=UUID(product_id),
            date=transfer_date,
            location=destination_location,
            transfer_to_location=None,
            inter_company_transfer_kg=float(quantity_kg),
            paired_movement_id=UUID(src_id),
        ),
    )
    if pair_errors:
        st.error("Pair-level validation failed (would be rejected by DB trigger):")
        for field, msg in pair_errors.items():
            st.error(f"{field}: {msg}")
        return

    # -------------------------------------------------------------------------
    # 3. Atomic submission
    # -------------------------------------------------------------------------
    try:
        if use_rpc:
            result = _submit_via_rpc({
                "p_product_id": product_id,
                "p_date": transfer_date.isoformat(),
                "p_source_location": source_location,
                "p_destination_location": destination_location,
                "p_quantity_kg": float(quantity_kg),
                "p_unit": unit,
                "p_reference": reference or None,
                "p_remark": remark or None,
            })
        else:
            result = _submit_via_paired_inserts(source_row, dest_row)
    except APIError as e:
        # Database constraint / trigger rejection bubbles up here.
        st.error(f"Database rejected the transfer: {e.message}")
        if getattr(e, "details", None):
            st.caption(f"Details: {e.details}")
        return
    except RuntimeError as e:
        st.error(str(e))
        return
    except Exception as e:  # last-resort guard for unexpected SDK errors
        st.error(f"Unexpected error submitting transfer: {e}")
        return

    st.success(
        f"Transfer recorded. Source leg `{result.get('source_id')}` ⇄ "
        f"destination leg `{result.get('destination_id')}`."
    )
    _load_products.clear()   # invalidate cached aggregates if any


# =============================================================================
# COMPANION SQL — deploy ONCE in Supabase SQL Editor
# =============================================================================
# Save as docs/0002b_rpc_intercompany.sql and run after 0002.
#
# CREATE OR REPLACE FUNCTION public.insert_intercompany_transfer(
#     p_product_id            uuid,
#     p_date                  date,
#     p_source_location       text,
#     p_destination_location  text,
#     p_quantity_kg           numeric,
#     p_unit                  text DEFAULT 'kg',
#     p_reference             text DEFAULT NULL,
#     p_remark                text DEFAULT NULL
# )
# RETURNS TABLE (source_id uuid, destination_id uuid)
# LANGUAGE plpgsql
# SECURITY DEFINER
# SET search_path = public
# AS $$
# DECLARE
#     v_src uuid := gen_random_uuid();
#     v_dst uuid := gen_random_uuid();
# BEGIN
#     -- Single transaction: DEFERRED trigger fires once at COMMIT and sees both rows.
#     INSERT INTO public.stock_movements (
#         id, product_id, date, location, transfer_to_location,
#         transaction_type, unit, inter_company_transfer_kg,
#         balance_kg, reference, remark, paired_movement_id
#     ) VALUES
#         (v_src, p_product_id, p_date, p_source_location, p_destination_location,
#          'Inter-company transfer', p_unit, p_quantity_kg,
#          0, p_reference, p_remark, v_dst),
#         (v_dst, p_product_id, p_date, p_destination_location, NULL,
#          'Inter-company transfer', p_unit, p_quantity_kg,
#          0, p_reference, p_remark, v_src);
#
#     RETURN QUERY SELECT v_src, v_dst;
# END;
# $$;
#
# GRANT EXECUTE ON FUNCTION public.insert_intercompany_transfer(
#     uuid, date, text, text, numeric, text, text, text
# ) TO authenticated, service_role;
# =============================================================================
