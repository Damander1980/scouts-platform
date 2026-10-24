-- Charges are organized by category (Floyd, 2026-10-23): yearly dues, camp and trips, T-shirts and gear,
-- fees, so a treasurer finds "summer camp" without scrolling through every plan.
alter table public.dues_plans add column if not exists category text not null default 'dues'
  check (category in ('dues', 'camp', 'gear', 'fees', 'other'));
