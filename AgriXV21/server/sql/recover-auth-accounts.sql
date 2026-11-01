-- Restore Supabase Auth accounts that are missing from the app's public.users table,
-- and fill missing names/join dates for matching rows. Safe to run repeatedly.
BEGIN;

UPDATE public.users AS app_user
SET
  "createdAt" = COALESCE(app_user."createdAt", auth_user.created_at),
  firstName = COALESCE(NULLIF(app_user.firstName, ''), auth_user.raw_user_meta_data->>'firstName', auth_user.raw_user_meta_data->>'first_name', ''),
  lastName = COALESCE(NULLIF(app_user.lastName, ''), auth_user.raw_user_meta_data->>'lastName', auth_user.raw_user_meta_data->>'last_name', '')
FROM auth.users AS auth_user
WHERE app_user.email IS NOT NULL
  AND lower(app_user.email) = lower(auth_user.email);

INSERT INTO public.users (
  "_id", email, "passwordHash", "firstName", "lastName", phone, address,
  gender, "isAdmin", role, "emailVerified", "phoneVerified", "createdAt", "updatedAt"
)
SELECT
  auth_user.id::text,
  auth_user.email,
  '',
  COALESCE(auth_user.raw_user_meta_data->>'firstName', auth_user.raw_user_meta_data->>'first_name', ''),
  COALESCE(auth_user.raw_user_meta_data->>'lastName', auth_user.raw_user_meta_data->>'last_name', ''),
  COALESCE(NULLIF(auth_user.phone, ''), auth_user.raw_user_meta_data->>'phone', ''),
  COALESCE(auth_user.raw_user_meta_data->>'address', ''),
  COALESCE(auth_user.raw_user_meta_data->>'gender', 'rather_not_say'),
  COALESCE(auth_user.raw_app_meta_data->>'isAdmin', 'false') = 'true',
  CASE WHEN COALESCE(auth_user.raw_app_meta_data->>'isAdmin', 'false') = 'true' THEN 'admin' ELSE 'user' END,
  true,
  auth_user.phone_confirmed_at IS NOT NULL,
  auth_user.created_at,
  auth_user.updated_at
FROM auth.users AS auth_user
WHERE auth_user.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.users AS app_user
    WHERE lower(app_user.email) = lower(auth_user.email)
  )
ON CONFLICT DO NOTHING;

COMMIT;
