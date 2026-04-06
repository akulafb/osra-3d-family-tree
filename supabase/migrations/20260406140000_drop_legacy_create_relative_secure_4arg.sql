-- DEV-only follow-up: remove obsolete 4-arg create_relative_secure left from early migrations.
-- Safe on all DBs: IF NOT EXISTS. (Also folded into 20260406120000_lin22_first_name.sql for new applies.)

DROP FUNCTION IF EXISTS public.create_relative_secure(text, text, uuid, uuid);
