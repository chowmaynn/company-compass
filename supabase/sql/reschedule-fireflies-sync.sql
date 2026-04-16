-- Reschedule the fireflies-sync daily cron to fire at midnight EST.
-- pg_cron schedules in UTC, so:
--   00:00 EST  = 05:00 UTC  (Nov–Mar)
--   00:00 EDT  = 04:00 UTC  (Mar–Nov)
-- We pin to 05:00 UTC year-round (i.e. exactly midnight EST in winter,
-- 1am ET during daylight saving). This is the standard "midnight Eastern"
-- compromise — the daily catch-all sync running an hour late during DST is harmless.
--
-- Run this whole file in Supabase Dashboard → SQL Editor.

-- 1. Inspect what exists right now (so we know which job to retarget).
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE command ILIKE '%fireflies-sync%';

-- 2. Update the schedule on the matching job.
--    cron.alter_job preserves the command and the secret embedded inside it.
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid
  FROM cron.job
  WHERE command ILIKE '%fireflies-sync%'
  ORDER BY jobid
  LIMIT 1;

  IF jid IS NULL THEN
    RAISE EXCEPTION 'No existing fireflies-sync cron job found. Schedule one first.';
  END IF;

  PERFORM cron.alter_job(
    job_id   => jid,
    schedule => '0 5 * * *'   -- 05:00 UTC daily = midnight EST (1am EDT)
  );

  RAISE NOTICE 'Updated cron job % to schedule 0 5 * * * (UTC)', jid;
END $$;

-- 3. Verify.
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE command ILIKE '%fireflies-sync%';
