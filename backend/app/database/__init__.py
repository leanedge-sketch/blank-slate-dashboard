"""
Database package for Supabase connections and migrations.

Having this file ensures Python treats `app.database` as a proper package
so imports like `from app.database.connection import get_supabase_client`
work correctly in all environments (including Render).
"""


