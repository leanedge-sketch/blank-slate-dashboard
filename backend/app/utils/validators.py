# backend/app/utils/validators.py
"""
Streamlit-Portable Validators
=============================

Single Python module that mirrors EVERY database CHECK constraint defined in:
    - docs/0001_enums_and_integrity.sql
    - docs/0002_intercompany_transfers.sql

WHY
---
Streamlit views POST directly to PostgREST. Without client-side parity, the
user only learns about a bad value after the round-trip fails with a 400.
This module lets a Streamlit form call ``validate_*`` BEFORE submission and
surface field-level errors inline, while the database constraints remain the
final authority.

USAGE
-----
    from backend.app.utils.validators import (
        ValidationError,
        validate_sales_pipeline_row,
        validate_stock_movement_row,
        validate_intercompany_transfer_pair,
    )

    errors = validate_sales_pipeline_row(form_dict)
    if errors:
        for field, msg in errors.items():
            st.error(f"{field}: {msg}")
        st.stop()

Every validator returns ``Dict[str, str]`` (empty = OK). The convenience
``assert_valid()`` helper raises ``ValidationError`` if the dict is non-empty,
for non-Streamlit callers (CLI scripts, FastAPI services, unit tests).

DESIGN NOTES
------------
- No external runtime dependencies beyond ``backend.app.models.enums`` so the
  module can be vendored straight into a Streamlit deployment.
- Returns errors as a flat ``{field: message}`` dict to plug into
  ``st.session_state`` form-error patterns.
- All thresholds and rules are derived from the SQL — when constraints
  change in SQL, change them here in the same PR.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Dict, Mapping, Optional, Sequence
from uuid import UUID

from backend.app.models.enums import (
    BusinessModel,
    BusinessUnit,
    Currency,
    ForexBearer,
    Incoterm,
    PipelineStage,
    StockLocation,
    TransactionType,
    Unit,
    STAGES_REQUIRING_BUSINESS_DETAILS,
)


# =============================================================================
# Error plumbing
# =============================================================================

class ValidationError(ValueError):
    """Raised when ``assert_valid`` is called with a non-empty error map."""

    def __init__(self, errors: Mapping[str, str]) -> None:
        self.errors: Dict[str, str] = dict(errors)
        super().__init__("; ".join(f"{k}: {v}" for k, v in errors.items()))


def assert_valid(errors: Mapping[str, str]) -> None:
    """Raise ``ValidationError`` if ``errors`` is non-empty. No-op otherwise."""
    if errors:
        raise ValidationError(errors)


# =============================================================================
# Low-level primitives
# =============================================================================

Number = (int, float, Decimal)


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _require(errors: Dict[str, str], field: str, value: Any, label: Optional[str] = None) -> bool:
    if _is_blank(value):
        errors[field] = f"{label or field} is required"
        return False
    return True


def _check_enum(
    errors: Dict[str, str],
    field: str,
    value: Any,
    allowed: Sequence[str],
    required: bool = True,
) -> None:
    if _is_blank(value):
        if required:
            errors[field] = f"{field} is required"
        return
    if value not in allowed:
        errors[field] = f"{field} must be one of: {', '.join(allowed)}"


def _check_non_negative(errors: Dict[str, str], field: str, value: Any) -> None:
    if value is None:
        return
    if not isinstance(value, Number):
        errors[field] = f"{field} must be numeric"
        return
    if value < 0:
        errors[field] = f"{field} must be >= 0"


def _check_positive(errors: Dict[str, str], field: str, value: Any) -> None:
    if value is None:
        return
    if not isinstance(value, Number):
        errors[field] = f"{field} must be numeric"
        return
    if value <= 0:
        errors[field] = f"{field} must be > 0"


def _check_uuid(errors: Dict[str, str], field: str, value: Any, required: bool = False) -> None:
    if _is_blank(value):
        if required:
            errors[field] = f"{field} is required"
        return
    if isinstance(value, UUID):
        return
    try:
        UUID(str(value))
    except (ValueError, TypeError):
        errors[field] = f"{field} must be a valid UUID"


# =============================================================================
# SALES PIPELINE — mirrors 0001 CHECK constraints + composite stage rule
# =============================================================================

def validate_sales_pipeline_row(row: Mapping[str, Any]) -> Dict[str, str]:
    """
    Mirrors:
      - sales_pipeline_stage_check
      - sales_pipeline_currency_check
      - sales_pipeline_forex_check
      - sales_pipeline_business_unit_check
      - sales_pipeline_incoterm_check
      - sales_pipeline_business_model_check
      - Composite rule: stages in STAGES_REQUIRING_BUSINESS_DETAILS
        must have business_model, unit, unit_price populated.
    """
    errors: Dict[str, str] = {}

    if _require(errors, "customer_id", row.get("customer_id"), "Customer"):
        _check_uuid(errors, "customer_id", row.get("customer_id"), required=True)

    _check_uuid(errors, "tds_id", row.get("tds_id"), required=False)
    _check_uuid(errors, "chemical_type_id", row.get("chemical_type_id"), required=False)
    _check_uuid(errors, "parent_pipeline_id", row.get("parent_pipeline_id"), required=False)

    _check_enum(errors, "stage",          row.get("stage"),          PipelineStage.values())
    _check_enum(errors, "currency",       row.get("currency"),       Currency.values(),     required=False)
    _check_enum(errors, "forex",          row.get("forex"),          ForexBearer.values(),  required=False)
    _check_enum(errors, "business_unit",  row.get("business_unit"),  BusinessUnit.values(), required=False)
    _check_enum(errors, "incoterm",       row.get("incoterm"),       Incoterm.values(),     required=False)
    _check_enum(errors, "business_model", row.get("business_model"), BusinessModel.values(),required=False)

    _check_non_negative(errors, "amount",     row.get("amount"))
    _check_non_negative(errors, "unit_price", row.get("unit_price"))
    _check_non_negative(errors, "quantity",   row.get("quantity"))

    # Composite: Proposal+ requires full commercial detail.
    stage = row.get("stage")
    from app.models.enums import STAGES_REQUIRING_FULL_COMMERCIAL

    if stage in STAGES_REQUIRING_FULL_COMMERCIAL:
        for required_field, label in (
            ("business_model", "Business model"),
            ("unit", "Unit"),
            ("unit_price", "Unit price"),
            ("currency", "Currency"),
            ("forex", "Forex"),
            ("business_unit", "Business unit"),
            ("incoterm", "Incoterm"),
            ("chemical_type_id", "Product"),
            ("expected_close_date", "Expected close date"),
            ("amount", "Amount"),
        ):
            if _is_blank(row.get(required_field)):
                errors[required_field] = (
                    f"{label} is required once the deal reaches '{stage}'"
                )
    if row.get("unit") is not None and not _is_blank(row.get("unit")):
        _check_enum(errors, "unit", row.get("unit"), Unit.values())

    # SCD2 hint (DB enforces uniqueness; we surface a friendly form warning).
    if row.get("is_current_version") is True and row.get("version_number") in (None, 0):
        errors["version_number"] = "Current versions must have version_number >= 1"

    return errors


# =============================================================================
# STOCK MOVEMENT — mirrors 0001 enums + 0002 transfer plumbing CHECKs
# =============================================================================

_QUANTITY_FIELDS = (
    "beginning_balance",
    "purchase_kg",
    "sold_kg",
    "purchase_direct_shipment_kg",
    "sold_direct_shipment_kg",
    "sample_or_damage_kg",
    "inter_company_transfer_kg",
)


def validate_stock_movement_row(row: Mapping[str, Any]) -> Dict[str, str]:
    """
    Single-row validation for ``stock_movements``. Mirrors:
      - location / transaction_type / unit / business_model CHECKs (0001)
      - stock_movements_non_transfer_clean (0002)
      - stock_movements_transfer_pair_required (0002) — partial:
        we flag missing paired_movement_id at form time when the row IS a
        transfer; the full double-entry balance is verified by
        ``validate_intercompany_transfer_pair``.
    """
    errors: Dict[str, str] = {}

    _require(errors, "date",       row.get("date"),       "Date")
    _check_uuid(errors, "product_id", row.get("product_id"), required=True)
    _check_uuid(errors, "tds_id",     row.get("tds_id"),     required=False)
    _check_uuid(errors, "supplier_id",row.get("supplier_id"),required=False)
    _check_uuid(errors, "customer_id",row.get("customer_id"),required=False)

    _check_enum(errors, "location",         row.get("location"),         StockLocation.values())
    _check_enum(errors, "transaction_type", row.get("transaction_type"), TransactionType.values())
    _check_enum(errors, "unit",             row.get("unit"),             Unit.values(), required=False)
    _check_enum(errors, "business_model",   row.get("business_model"),   BusinessModel.values(), required=False)

    for f in _QUANTITY_FIELDS:
        _check_non_negative(errors, f, row.get(f))

    txn = row.get("transaction_type")
    transfer_to = row.get("transfer_to_location")
    paired_id = row.get("paired_movement_id")
    icq = row.get("inter_company_transfer_kg") or 0

    if txn == TransactionType.INTER_COMPANY_TRANSFER.value:
        # Either source (has transfer_to_location) or destination (no transfer_to_location)
        if not _is_blank(transfer_to):
            _check_enum(errors, "transfer_to_location", transfer_to, StockLocation.values())
            if transfer_to == row.get("location"):
                errors["transfer_to_location"] = (
                    "Destination location must differ from source location"
                )
            if not (isinstance(icq, Number) and icq > 0):
                errors["inter_company_transfer_kg"] = (
                    "Source leg of a transfer must carry a positive quantity"
                )
        # Pair pointer requirement (DB-enforced after backfill; we warn early)
        if _is_blank(paired_id):
            errors["paired_movement_id"] = (
                "Inter-company transfers must reference a paired counterpart row"
            )
        else:
            _check_uuid(errors, "paired_movement_id", paired_id, required=True)
    else:
        # Non-transfer cleanliness (mirrors stock_movements_non_transfer_clean)
        if not _is_blank(paired_id):
            errors["paired_movement_id"] = (
                "paired_movement_id is only valid for inter-company transfers"
            )
        if not _is_blank(transfer_to):
            errors["transfer_to_location"] = (
                "transfer_to_location is only valid for inter-company transfers"
            )
        if isinstance(icq, Number) and icq > 0:
            errors["inter_company_transfer_kg"] = (
                "inter_company_transfer_kg must be 0 for non-transfer rows"
            )

    return errors


# =============================================================================
# INTER-COMPANY TRANSFER PAIR — mirrors validate_stock_transfer_pair() trigger
# =============================================================================

@dataclass
class TransferLeg:
    """Lightweight DTO for a single leg of an inter-company transfer."""
    id: Optional[UUID]                  # None when constructing a new pair
    product_id: UUID
    date: date
    location: str
    transfer_to_location: Optional[str]
    inter_company_transfer_kg: float
    paired_movement_id: Optional[UUID]

    @property
    def signed_quantity_kg(self) -> float:
        """Replicates the SQL generated column for transfer rows."""
        qty = float(self.inter_company_transfer_kg or 0)
        if self.transfer_to_location and self.transfer_to_location != self.location:
            return -qty                  # source leg debits its location
        return qty                       # destination leg credits its location


def validate_intercompany_transfer_pair(
    source: TransferLeg,
    destination: TransferLeg,
) -> Dict[str, str]:
    """
    Mirrors the constraint-trigger ``validate_stock_transfer_pair`` from 0002.

    Rules enforced:
      1. Both legs reference the SAME product_id and SAME business date.
      2. Source.location != Destination.location.
      3. Source.transfer_to_location == Destination.location.
      4. Destination.transfer_to_location IS NULL.
      5. paired_movement_id is symmetric (each points at the other).
         When ids are not yet assigned (pre-insert), this rule is skipped.
      6. signed_quantity_kg(source) + signed_quantity_kg(destination) == 0.
    """
    errors: Dict[str, str] = {}

    if source.product_id != destination.product_id:
        errors["product_id"] = "Both legs of a transfer must reference the same product"

    if source.date != destination.date:
        errors["date"] = "Both legs of a transfer must share the same business date"

    if source.location == destination.location:
        errors["location"] = "Source and destination locations must differ"

    if source.transfer_to_location != destination.location:
        errors["transfer_to_location"] = (
            "Source.transfer_to_location must equal Destination.location"
        )

    if destination.transfer_to_location is not None:
        errors["destination.transfer_to_location"] = (
            "Destination leg must NOT set transfer_to_location"
        )

    # Symmetric back-pointer — only checkable once both rows are persisted.
    if source.id and destination.id:
        if source.paired_movement_id != destination.id:
            errors["source.paired_movement_id"] = "Source must point at destination.id"
        if destination.paired_movement_id != source.id:
            errors["destination.paired_movement_id"] = "Destination must point at source.id"

    net = source.signed_quantity_kg + destination.signed_quantity_kg
    if abs(net) > 1e-9:
        errors["signed_quantity_kg"] = (
            f"Transfer pair does not balance: net = {net} (must equal 0)"
        )

    return errors


__all__ = [
    "ValidationError",
    "assert_valid",
    "validate_sales_pipeline_row",
    "validate_stock_movement_row",
    "validate_intercompany_transfer_pair",
    "TransferLeg",
]
