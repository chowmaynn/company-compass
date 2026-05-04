-- Allow "Accomplished" as a valid value for quarterly_initiatives.status.
-- Run in the Supabase SQL editor for the project that hosts quarterly_initiatives
-- (kchvoljychmnedhoisre).
--
-- Background: the "Accomplished" status was added to the UI in commit 0840ffa
-- (Apr 14), but the table's CHECK constraint still only allowed
-- "Not Started" / "On-Track" / "Behind", so PATCHes setting "Accomplished"
-- were silently rejected by the DB while the UI showed the new value via the
-- optimistic update — the value reverted on refresh.

DO $$
DECLARE
  con_name text;
BEGIN
  -- Drop any existing CHECK constraint on the status column
  FOR con_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.quarterly_initiatives'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.quarterly_initiatives DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

ALTER TABLE public.quarterly_initiatives
  ADD CONSTRAINT quarterly_initiatives_status_check
  CHECK (status IN ('Not Started', 'On-Track', 'Behind', 'Accomplished'));
