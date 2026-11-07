-- Required by reset-link validation and atomic single-use consumption.
-- Apply this migration before restarting the backend with the new reset flow.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "passwordReset.used" boolean NOT NULL DEFAULT false;
