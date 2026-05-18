# streamlit_app.py
"""
LeanChem Streamlit — Main Entrypoint & Navigation Scaffold
==========================================================

Run from the repo root with:

    streamlit run streamlit_app.py

ARCHITECTURE
------------
This file is intentionally THIN. It does three things:

  1. Bootstraps the authenticated Supabase session (once per browser tab).
  2. Renders the sidebar — a flat registry of pages grouped by domain.
  3. Dispatches to the selected page's ``render()`` function.

Every page module under ``backend/app/streamlit_views/`` exposes a single
zero-argument ``render()`` callable. Shared state (user, business unit,
permissions) is passed implicitly through ``st.session_state`` so each
view stays decoupled from the navigation layer.

ADDING A NEW PAGE
-----------------
  1. Create ``backend/app/streamlit_views/<your_view>.py`` exporting
     ``def render() -> None: ...``.
  2. Append an entry to ``PAGES`` below under the appropriate category.
  3. Optionally gate it on a permission via the ``requires`` key.

SESSION CONTRACT
----------------
After ``_ensure_session()`` returns, every view can safely read:

    st.session_state.user           : dict | None  (Supabase user record)
    st.session_state.role           : str | None   (employee role)
    st.session_state.business_unit  : str | None   (active BU, see enums.BusinessUnit)
    st.session_state.permissions    : dict[str, bool]  (see _build_permissions)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

import streamlit as st

# -- View modules (each exposes `render() -> None`) ---------------------------
from backend.app.streamlit_views import intercompany_transfer
from backend.app.models.enums import BusinessUnit

# -----------------------------------------------------------------------------
# Page configuration
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="LeanChem Connect",
    page_icon="🧪",
    layout="wide",
    initial_sidebar_state="expanded",
)


# =============================================================================
# Page registry
# =============================================================================

@dataclass(frozen=True)
class Page:
    key: str                     # stable id, used in session_state
    label: str                   # sidebar label
    icon: str                    # leading emoji/icon
    render: Callable[[], None]   # entrypoint
    requires: Optional[str] = None  # permission key, e.g. "can_edit_stock"


def _placeholder(title: str) -> Callable[[], None]:
    """Stub renderer for sections not yet ported to Streamlit."""
    def _inner() -> None:
        st.subheader(title)
        st.info("This module has not been ported to Streamlit yet.")
    return _inner


# Categories preserve the same domain split as the React frontend's sidebar.
PAGES: Dict[str, List[Page]] = {
    "Overview": [
        Page("home", "Home", "🏠", _placeholder("Home")),
    ],
    "CRM": [
        Page("crm_customers", "Customers",  "👥", _placeholder("Customers"),  requires="can_view_crm"),
        Page("crm_pipeline",  "Pipeline",   "📈", _placeholder("Pipeline"),   requires="can_view_sales"),
    ],
    "PMS": [
        Page("pms_tds",       "TDS Library", "📄", _placeholder("TDS Library"), requires="can_view_pms"),
        Page("pms_partners",  "Partners",    "🤝", _placeholder("Partners"),    requires="can_view_pms"),
    ],
    "Logistics & Stock": [
        Page("stock_availability", "Stock Availability",   "📦", _placeholder("Stock Availability"), requires="can_view_stock"),
        Page("stock_movements",    "Movements",            "🔁", _placeholder("Stock Movements"),    requires="can_view_stock"),
        Page(
            key="ic_transfer",
            label="Inter-Company Transfers",
            icon="🔀",
            render=intercompany_transfer.render,
            requires="can_edit_stock",
        ),
    ],
}


# =============================================================================
# Session bootstrap
# =============================================================================

def _build_permissions(role: Optional[str]) -> Dict[str, bool]:
    """
    Minimal RBAC mirror of frontend/src/utils/permissions.ts so Streamlit
    views and the React frontend stay in lock-step.
    """
    role_norm = (role or "").lower()

    matrix = {
        "admin":           dict(view_crm=True,  view_pms=True,  view_sales=True,  view_stock=True,
                                edit_crm=True,  edit_pms=True,  edit_sales=True,  edit_stock=True),
        "product manager": dict(view_crm=True,  view_pms=True,  view_sales=True,  view_stock=True,
                                edit_crm=False, edit_pms=True,  edit_sales=False, edit_stock=False),
        "sales and stock": dict(view_crm=True,  view_pms=True,  view_sales=True,  view_stock=True,
                                edit_crm=True,  edit_pms=False, edit_sales=True,  edit_stock=True),
        "sales":           dict(view_crm=True,  view_pms=True,  view_sales=True,  view_stock=True,
                                edit_crm=True,  edit_pms=False, edit_sales=True,  edit_stock=False),
        "logistic":        dict(view_crm=True,  view_pms=True,  view_sales=True,  view_stock=True,
                                edit_crm=False, edit_pms=True,  edit_sales=False, edit_stock=False),
    }
    perms = matrix.get(role_norm, dict.fromkeys(
        ["view_crm","view_pms","view_sales","view_stock",
         "edit_crm","edit_pms","edit_sales","edit_stock"], False
    ))
    # Re-key with the can_* prefix used by Page.requires.
    return {f"can_{k}": v for k, v in perms.items()}


def _ensure_session() -> None:
    """
    Populate session_state once per browser session.

    REPLACE the placeholder block below with your real Supabase Auth flow
    (e.g. magic-link callback or password sign-in). The contract this
    function MUST satisfy:

        st.session_state.user           -> dict | None
        st.session_state.role           -> str  | None
        st.session_state.business_unit  -> str  | None
        st.session_state.permissions    -> dict[str, bool]

    Keeping the contract here means views never need to know HOW auth was
    performed — they just read these keys.
    """
    if st.session_state.get("_bootstrapped"):
        return

    # ---- placeholder dev session — swap for real auth -----------------------
    st.session_state.user = st.session_state.get("user") or {
        "id": "dev-user",
        "email": "dev@leanchem.local",
        "full_name": "Dev User",
    }
    st.session_state.role = st.session_state.get("role") or "admin"
    st.session_state.business_unit = (
        st.session_state.get("business_unit") or BusinessUnit.HAYAT.value
    )
    # -------------------------------------------------------------------------

    st.session_state.permissions = _build_permissions(st.session_state.role)
    st.session_state._bootstrapped = True


# =============================================================================
# Sidebar
# =============================================================================

def _render_sidebar() -> Page:
    """Render grouped nav, return the selected Page."""
    with st.sidebar:
        st.markdown("### 🧪 LeanChem Connect")
        user = st.session_state.user or {}
        st.caption(f"**{user.get('full_name', user.get('email', 'Guest'))}**")
        st.caption(
            f"Role: `{st.session_state.role or '—'}`  ·  "
            f"BU: `{st.session_state.business_unit or '—'}`"
        )

        # Business-unit switcher — kept in session_state so downstream views
        # (forecasting, pipeline filters) can react.
        bu_options = BusinessUnit.values()
        current_bu = st.session_state.business_unit or bu_options[0]
        new_bu = st.selectbox(
            "Active business unit",
            options=bu_options,
            index=bu_options.index(current_bu) if current_bu in bu_options else 0,
            key="_bu_picker",
        )
        if new_bu != st.session_state.business_unit:
            st.session_state.business_unit = new_bu

        st.divider()

        perms = st.session_state.permissions or {}
        selectable: List[Page] = []
        for category, pages in PAGES.items():
            visible = [p for p in pages if not p.requires or perms.get(p.requires, False)]
            if not visible:
                continue
            st.markdown(f"**{category}**")
            for p in visible:
                if st.button(
                    f"{p.icon}  {p.label}",
                    key=f"nav_{p.key}",
                    use_container_width=True,
                ):
                    st.session_state.current_page = p.key
                selectable.append(p)
            st.write("")  # spacer between categories

        st.divider()
        if st.button("🚪 Sign out", use_container_width=True):
            for k in ("user", "role", "business_unit", "permissions",
                      "_bootstrapped", "current_page"):
                st.session_state.pop(k, None)
            st.rerun()

    # Resolve current selection (default to first visible page)
    current_key = st.session_state.get("current_page") or (
        selectable[0].key if selectable else None
    )
    if not current_key:
        return Page("empty", "Empty", "·", _placeholder("No pages available"))

    return next(
        (p for p in selectable if p.key == current_key),
        selectable[0] if selectable else Page("empty", "Empty", "·", _placeholder("No pages available")),
    )


# =============================================================================
# Main
# =============================================================================

def main() -> None:
    _ensure_session()
    page = _render_sidebar()

    # Header bar — gives every view a consistent title strip.
    st.markdown(f"## {page.icon}  {page.label}")
    st.caption(
        f"Business unit: **{st.session_state.business_unit}**  ·  "
        f"Signed in as **{(st.session_state.user or {}).get('email','—')}**"
    )
    st.divider()

    # Re-check permission at render time (defense in depth — sidebar already filtered).
    if page.requires and not (st.session_state.permissions or {}).get(page.requires, False):
        st.error("You do not have permission to view this page.")
        return

    page.render()


if __name__ == "__main__":
    main()
