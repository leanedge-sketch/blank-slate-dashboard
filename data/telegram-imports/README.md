# Telegram Desktop exports (local only)

Place your Telegram export here — **do not commit** `result.json` (private CRM chat data).

## Steps

1. Copy `result.json` from your Telegram Desktop export folder into this directory:
   ```
   data/telegram-imports/result.json
   ```

2. Preview what will be imported (dry-run):
   ```powershell
   cd backend
   python ../scripts/backfill_telegram_to_interactions.py --export "../data/telegram-imports/result.json" --dry-run
   ```

3. Insert into Supabase `public.interactions`:
   ```powershell
   python ../scripts/backfill_telegram_to_interactions.py --export "../data/telegram-imports/result.json" --apply
   ```

Requires `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `backend/.env` or repo root `.env.local.bak`.
