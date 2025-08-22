-- supabase/profiles_rls_policies.sql
-- Row Level Security policies for public.profiles
-- Apply this in Supabase SQL editor or via psql as a privileged role.
-- Safe to run repeatedly (CREATE POLICY will fail if exists; drop first if needed).

-- 1) Enable RLS on profiles (no-op if already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2) Allow authenticated users to SELECT only their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY "profiles_select_own"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;
END$$;

-- 3) Allow authenticated users to UPDATE only their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END$$;

-- 4) Allow authenticated users to INSERT only for their own id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY "profiles_insert_own"
      ON public.profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;
END$$;

-- Optional: quick test queries (run as the role you want to test, or use Supabase SQL editor)
-- 1) Verify RLS enabled:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'profiles';

-- 2) List policies for profiles:
-- SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles';

-- 3) Test function to check your own profile (run as authenticated user in Supabase):
-- SELECT * FROM public.profiles WHERE id = auth.uid();

-- Rollback notes:
-- To remove these policies, DROP POLICY "policy_name" ON public.profiles;
-- Example: DROP POLICY "profiles_select_own" ON public.profiles;

-- End of file
