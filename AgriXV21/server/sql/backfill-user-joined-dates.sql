-- Fill missing application account creation dates from Supabase Auth.
-- Safe to run more than once: rows with an existing createdAt are preserved.
WITH updated AS (
  UPDATE public.users AS app_user
  SET "createdAt" = auth_user.created_at
  FROM auth.users AS auth_user
  WHERE app_user."createdAt" IS NULL
    AND app_user.email IS NOT NULL
    AND lower(app_user.email) = lower(auth_user.email)
  RETURNING 1
)
SELECT count(*) AS users_backfilled FROM updated;
