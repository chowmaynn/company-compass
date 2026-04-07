import { useState, useEffect, useMemo } from "react";
import { fetchForms, fetchAllSubmissions, type TallyForm, type TallySubmission } from "@/lib/tally";

export interface DailyNpsPoint {
  date: string; // YYYY-MM-DD
  score: number;
}

export interface NpsResult {
  formId: string;
  formName: string;
  totalResponses: number;
  promoters: number;
  passives: number;
  detractors: number;
  score: number; // -100 to +100
  dailyNps: DailyNpsPoint[];
  loading: boolean;
  error: string | null;
}

function detectNpsScore(submission: TallySubmission): number | null {
  for (const response of submission.responses) {
    const v = Number(response.answer);
    if (!isNaN(v) && v >= 0 && v <= 10) return v;
  }
  return null;
}

function calculateNps(submissions: TallySubmission[]): Pick<NpsResult, "promoters" | "passives" | "detractors" | "score" | "totalResponses" | "dailyNps"> {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  let scored = 0;

  // Count every submission (no deduplication — each response is a separate NPS data point)
  for (const s of submissions) {
    const score = detectNpsScore(s);
    if (score === null) continue;
    scored++;
    if (score >= 9) promoters++;
    else if (score >= 7) passives++;
    else detractors++;
  }

  const nps = scored === 0 ? 0 : parseFloat(((promoters - detractors) / scored * 100).toFixed(1));

  // Build cumulative daily NPS: sort submissions by date, recalculate NPS at each day
  const withScores = submissions
    .map((s) => ({ date: s.submittedAt.slice(0, 10), score: detectNpsScore(s) }))
    .filter((s): s is { date: string; score: number } => s.score !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const dailyNps: DailyNpsPoint[] = [];
  let runP = 0, runPa = 0, runD = 0, runTotal = 0;
  let lastDate = "";

  for (const entry of withScores) {
    runTotal++;
    if (entry.score >= 9) runP++;
    else if (entry.score >= 7) runPa++;
    else runD++;

    // Only emit a point when the date changes or at the last entry
    if (entry.date !== lastDate && lastDate !== "") {
      // Emit point for the previous date
      // (already emitted below)
    }
    lastDate = entry.date;

    // Update or replace point for this date
    const dayNps = parseFloat(((runP - runD) / runTotal * 100).toFixed(1));
    const existing = dailyNps.length > 0 && dailyNps[dailyNps.length - 1].date === entry.date;
    if (existing) {
      dailyNps[dailyNps.length - 1].score = dayNps;
    } else {
      dailyNps.push({ date: entry.date, score: dayNps });
    }
  }

  return { promoters, passives, detractors, score: nps, totalResponses: scored, dailyNps };
}

interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export function useTallyNps(dateRange?: DateRange) {
  // Store all submissions per form (unfiltered) so we can re-filter client-side
  const [allSubmissions, setAllSubmissions] = useState<Map<string, TallySubmission[]>>(new Map());
  const [formMeta, setFormMeta] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all submissions once on mount
  useEffect(() => {
    async function load() {
      try {
        const forms = await fetchForms();
        const npsForms = forms.filter((f) =>
          f.name.toLowerCase().includes("nps score tracking")
        );

        if (npsForms.length === 0) {
          setError("No NPS Score Tracking forms found");
          return;
        }

        setFormMeta(npsForms.map((f) => ({ id: f.id, name: f.name })));

        const subsMap = new Map<string, TallySubmission[]>();
        await Promise.all(
          npsForms.map(async (form: TallyForm) => {
            try {
              const submissions = await fetchAllSubmissions(form.id);
              subsMap.set(form.id, submissions);
            } catch (e) {
              console.error(`Failed to fetch submissions for ${form.name}:`, e);
              subsMap.set(form.id, []);
            }
          })
        );

        setAllSubmissions(subsMap);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Recalculate NPS when date range changes (client-side filtering)
  const results: NpsResult[] = useMemo(() => {
    if (formMeta.length === 0) return [];

    return formMeta.map((form) => {
      let submissions = allSubmissions.get(form.id) ?? [];

      // Filter by date range if provided
      if (dateRange?.startDate && dateRange?.endDate) {
        submissions = submissions.filter((s) => {
          const date = s.submittedAt.slice(0, 10);
          return date >= dateRange.startDate && date <= dateRange.endDate;
        });
      }

      const nps = calculateNps(submissions);
      return {
        formId: form.id,
        formName: form.name,
        ...nps,
        loading: false,
        error: null,
      };
    });
  }, [formMeta, allSubmissions, dateRange?.startDate, dateRange?.endDate]);

  return { results, loading, error };
}
