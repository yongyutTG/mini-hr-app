-- Optional cleanup: remove old experimental Supabase tables that do not match Google Sheet tab names.
-- Run this only after confirming you do not need data in these tables.

drop table if exists public.employees cascade;
drop table if exists public.leave_requests cascade;
drop table if exists public.ot_requests cascade;
drop table if exists public.attendance_logs cascade;
drop table if exists public.sync_errors cascade;
drop table if exists public.app_rows cascade;

-- Older structured naming from the first draft. Safe to drop after using the exact Sheet-name tables.
drop table if exists public.employees_sheet cascade;
drop table if exists public.checkins_sheet cascade;
drop table if exists public.leaves_sheet cascade;
drop table if exists public.ot_sheet cascade;
drop table if exists public.payments_sheet cascade;
drop table if exists public.leave_quota_sheet cascade;
drop table if exists public.pay_items_sheet cascade;
drop table if exists public.holidays_sheet cascade;
drop table if exists public.config_sheet cascade;
drop table if exists public.logs_sheet cascade;
drop table if exists public.approvers_sheet cascade;
