"""
Shared product catalog API — single source for Sales, CRM, PMS, Stock, and Reports UIs.
"""
from fastapi import APIRouter, HTTPException, Query
import logging

from app.models.pms import ChemicalFullDataListResponse
from app.services.pms_service import count_chemical_full_data, list_chemical_full_data

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/products", response_model=ChemicalFullDataListResponse)
async def list_shared_catalog_products(
    limit: int = Query(5000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    sector: str | None = None,
    industry: str | None = None,
    vendor: str | None = None,
    product_category: str | None = None,
    sub_category: str | None = None,
    search: str | None = None,
):
    """
    Master product list from chemical_full_data.
    Same data PMS writes; Sales/CRM/Stock/Reports should read this endpoint or refresh after PMS changes.
    """
    try:
        chemicals = list_chemical_full_data(
            limit=limit,
            offset=offset,
            sector=sector,
            industry=industry,
            vendor=vendor,
            product_category=product_category,
            sub_category=sub_category,
            search=search,
        )
        total = count_chemical_full_data(
            sector=sector,
            industry=industry,
            vendor=vendor,
            product_category=product_category,
            sub_category=sub_category,
            search=search,
        )
        return ChemicalFullDataListResponse(chemicals=chemicals, total=total)
    except Exception as e:
        logger.exception("Error fetching shared catalog")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/backfill-uuids")
async def backfill_catalog_uuids():
    """
    Assign uuid_id to every Chemical_Master_Data row that is missing one.
    Run once if chemical type pickers show (no UUID).
    """
    from app.services.catalog_sync_service import backfill_all_catalog_uuid_ids

    try:
        return backfill_all_catalog_uuid_ids()
    except Exception as e:
        logger.exception("Catalog UUID backfill failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/sync-all")
async def sync_all_catalog_links():
    """
    Ensure uuid_id and TDS rows exist for every catalog product.
    Run once after deploy or when Sales pickers miss older PMS products.
    """
    from app.services.catalog_sync_service import sync_catalog_product_links
    from app.services.pms_service import list_chemical_full_data

    try:
        chemicals = list_chemical_full_data(limit=10000, offset=0)
        results = []
        for chem in chemicals:
            if chem.id is None:
                continue
            results.append(sync_catalog_product_links(int(chem.id)))
        return {
            "total": len(chemicals),
            "synced": len(results),
            "sample": results[:20],
        }
    except Exception as e:
        logger.exception("Catalog sync-all failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
