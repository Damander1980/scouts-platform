-- One-time system notices (cancel, change, approval, deadline/form/YPT reminders) are claimed with an
-- insert before sending; this index makes the claim race-free so double clicks never send twice.
delete from public.notification_log a using public.notification_log b
  where a.channel = 'system' and b.channel = 'system' and a.category = b.category and a.ctid > b.ctid;
create unique index if not exists notification_log_system_once on public.notification_log (category) where channel = 'system';
