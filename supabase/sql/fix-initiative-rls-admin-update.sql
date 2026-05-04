-- Allow admins (user_roles.admin = true) to update any quarterly_initiative,
-- not just rows they personally created. Run on the project hosting
-- quarterly_initiatives (kchvoljychmnedhoisre).
--
-- Background: the existing UPDATE policy only allowed created_by = auth.uid().
-- When a non-creator (e.g. an admin) tried to PATCH a row, RLS silently
-- filtered the WHERE clause to 0 rows. PostgREST returned 204 No Content —
-- looks like success, but nothing was written. The UI's optimistic update
-- briefly showed the new status, then reverted on the next fetch.

-- Drop existing UPDATE policies on the table (whatever they're named)
DO $$
DECLARE pol_name text;
BEGIN
  FOR pol_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quarterly_initiatives'
      AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.quarterly_initiatives', pol_name);
  END LOOP;
END $$;

-- Allow update if you created the row OR you're an admin
CREATE POLICY "quarterly_initiatives_update_creator_or_admin"
  ON public.quarterly_initiatives
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND admin = true
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND admin = true
    )
  );
