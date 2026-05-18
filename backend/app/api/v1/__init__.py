"""
API v1 package

This package groups versioned API routers:
- CRM routes in `crm.py`
- PMS routes in `pms.py`
- Sales Pipeline routes in `sales_pipeline.py`
- Stock Management routes in `stock.py`
- Authentication routes in `auth.py`
"""

from . import crm, pms, sales_pipeline, stock, auth  # noqa: F401

