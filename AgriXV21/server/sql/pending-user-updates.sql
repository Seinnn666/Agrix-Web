-- Persist profile email and phone OTP updates independently from the public user row.
-- The authenticated API identifies records with users._id (or the mapped Supabase auth ID).
BEGIN;

CREATE TABLE IF NOT EXISTS public.pending_user_updates (
  user_id text PRIMARY KEY,
  update_type text NOT NULL CHECK (update_type IN ('email', 'phone')),
  target_value text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_user_updates_expires_at_idx
  ON public.pending_user_updates (expires_at);

ALTER TABLE public.pending_user_updates ENABLE ROW LEVEL SECURITY;

COMMIT;
