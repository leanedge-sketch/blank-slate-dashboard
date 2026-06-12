# backend/app/models/enums.py
"""
Centralized Enumerations
========================

Single source of truth for every controlled vocabulary in the system.

WHY THIS FILE EXISTS
--------------------
Prior to this module, the same literals were redeclared across
``sales_pipeline.py`` and ``stock.py`` (e.g. ``BUSINESS_MODEL_TYPES``),
risking silent divergence between domains. Postgres CHECK constraints
in ``supabase/migrations/0001_enums_and_integrity.sql`` mirror the
``.values()`` of every enum here, so Python validation and DB validation
stay in lockstep.

USAGE
-----
    from backend.app.models.enums import PipelineStage, Currency

    stage = PipelineStage.PROPOSAL          # -> "Proposal"
    PipelineStage.values()                  # -> ["Lead ID", "Discovery", ...]
    "Proposal" in PipelineStage             # -> True (str-equality friendly)

Pydantic field example:

    from pydantic import BaseModel
    from backend.app.models.enums import PipelineStage

    class PipelinePatch(BaseModel):
        stage: PipelineStage   # auto-validates against the enum
"""

from __future__ import annotations

from enum import StrEnum
from typing import List


class _BaseStrEnum(StrEnum):
    """Shared helpers so every enum exposes a `.values()` list for
    DB CHECK constraint generation and Streamlit ``selectbox`` options."""

    @classmethod
    def values(cls) -> List[str]:
        return [member.value for member in cls]

    @classmethod
    def contains(cls, value: str) -> bool:
        return value in cls.values()


# =============================================================================
# SALES PIPELINE
# =============================================================================

class PipelineStage(_BaseStrEnum):
    LEAD_ID       = "Lead ID"
    DISCOVERY     = "Discovery"
    SAMPLE        = "Sample"
    VALIDATION    = "Validation"
    PROPOSAL      = "Proposal"
    CONFIRMATION  = "Confirmation"
    CLOSED        = "Closed"
    LOST          = "Lost"


# Proposal and later need the full commercial form (same as Edit Pipeline).
STAGES_REQUIRING_FULL_COMMERCIAL: List[str] = [
    PipelineStage.PROPOSAL.value,
    PipelineStage.CONFIRMATION.value,
    PipelineStage.CLOSED.value,
]

# Lead ID: product and amount optional. Discovery through Validation need product + quantity.
STAGES_REQUIRING_PRODUCT_AND_AMOUNT: List[str] = [
    PipelineStage.DISCOVERY.value,
    PipelineStage.SAMPLE.value,
    PipelineStage.VALIDATION.value,
    PipelineStage.PROPOSAL.value,
    PipelineStage.CONFIRMATION.value,
    PipelineStage.CLOSED.value,
]

STAGES_WITH_OPTIONAL_COMMERCIAL: List[str] = [
    PipelineStage.LEAD_ID.value,
]

STAGES_REQUIRING_BUSINESS_DETAILS: List[str] = list(STAGES_REQUIRING_FULL_COMMERCIAL)


class Currency(_BaseStrEnum):
    ETB = "ETB"
    KES = "KES"
    USD = "USD"
    EUR = "EUR"


class ForexBearer(_BaseStrEnum):
    LEANCHEMS = "LeanChems"
    CLIENT    = "Client"


class BusinessUnit(_BaseStrEnum):
    HAYAT     = "Hayat"
    ALHADI    = "Alhadi"
    BETCHEM   = "Bet-chem"
    BARRACODA = "Barracoda"
    NYUMBCHEM = "Nyumb-Chem"


class Incoterm(_BaseStrEnum):
    IMPORT_OF_RECORD   = "Import of Record"
    AGENCY             = "Agency"
    DIRECT_IMPORT      = "Direct Import"
    STOCK_ADDIS_ABABA  = "Stock – Addis Ababa"  # note: en-dash, matches existing data


# =============================================================================
# STOCK / WAREHOUSE
# =============================================================================

class StockLocation(_BaseStrEnum):
    ADDIS_ABABA      = "addis_ababa"
    SEZ_KENYA        = "sez_kenya"
    NAIROBI_PARTNER  = "nairobi_partner"


class TransactionType(_BaseStrEnum):
    SALES                  = "Sales"
    PURCHASE               = "Purchase"
    INTER_COMPANY_TRANSFER = "Inter-company transfer"
    SAMPLE                 = "Sample"
    DAMAGE                 = "Damage"
    STOCK_AVAILABILITY     = "Stock Availability"


class Unit(_BaseStrEnum):
    KG    = "kg"
    TON   = "ton"
    G     = "g"
    LB    = "lb"
    OZ    = "oz"
    PIECE = "piece"
    UNIT  = "unit"


class BusinessModel(_BaseStrEnum):
    """Shared between Sales Pipeline and Nairobi-Partner stock flows."""
    STOCK            = "Stock"
    DIRECT_DELIVERY  = "Direct Delivery"


# =============================================================================
# QUOTATION (used by QuoteDraftRequest.format)
# =============================================================================

class QuoteFormat(_BaseStrEnum):
    BARACODA = "Baracoda"
    BETCHEM  = "Betchem"


# =============================================================================
# BACK-COMPAT SHIMS
# =============================================================================
# Existing modules import bare lists (e.g. `from .stock import LOCATIONS`).
# These aliases let us migrate call-sites incrementally without breakage.

PIPELINE_STAGES                   = PipelineStage.values()
CURRENCIES                        = Currency.values()
FOREX_OPTIONS                     = ForexBearer.values()
BUSINESS_UNIT_OPTIONS             = BusinessUnit.values()
INCOTERM_OPTIONS                  = Incoterm.values()
LOCATIONS                         = StockLocation.values()
TRANSACTION_TYPES                 = TransactionType.values()
UNITS                             = Unit.values()
BUSINESS_MODEL_TYPES              = BusinessModel.values()
QUOTE_FORMATS                     = QuoteFormat.values()


__all__ = [
    # Enums
    "PipelineStage", "Currency", "ForexBearer", "BusinessUnit", "Incoterm",
    "StockLocation", "TransactionType", "Unit", "BusinessModel", "QuoteFormat",
    # Composite rules
    "STAGES_REQUIRING_BUSINESS_DETAILS",
    # Back-compat lists
    "PIPELINE_STAGES", "CURRENCIES", "FOREX_OPTIONS", "BUSINESS_UNIT_OPTIONS",
    "INCOTERM_OPTIONS", "LOCATIONS", "TRANSACTION_TYPES", "UNITS",
    "BUSINESS_MODEL_TYPES", "QUOTE_FORMATS",
]
