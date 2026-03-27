import { useState, useEffect } from "react";
import { fetchForms, fetchAllSubmissions, type TallyForm, type TallySubmission } from "@/lib/tally";

export interface NpsResult {
  formId: string;
  formName: string;
  totalResponses: number;
  promoters: number;
  passives: number;
  detractors: number;
  score: number; // -100 to +100
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

function calculateNps(submissions: TallySubmission[]): Pick<NpsResult, "promoters" | "passives" | "detractors" | "score" | "totalResponses"> {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  let scored = 0;

  // Deduplicate by respondentId — keep first submission per respondent
  const seenRespondents = new Set<string>();
  const deduped = submissions.filter((s) => {
    if (seenRespondents.has(s.respondentId)) return false;
    seenRespondents.add(s.respondentId);
    return true;
  });

  for (const s of deduped) {
    const score = detectNpsScore(s);
    if (score === null) continue;
    scored++;
    if (score >= 9) promoters++;
    else if (score >= 7) passives++;
    else detractors++;
  }

  const nps = scored === 0 ? 0 : Math.round(((promoters - detractors) / scored) * 100);

  return { promoters, passives, detractors, score: nps, totalResponses: scored };
}

export function useTallyNps() {
  const [results, setResults] = useState<NpsResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        // Initialise with loading state per form
        setResults(
          npsForms.map((f) => ({
            formId: f.id,
            formName: f.name,
            totalResponses: 0,
            promoters: 0,
            passives: 0,
            detractors: 0,
            score: 0,
            loading: true,
            error: null,
          }))
        );

        // Fetch submissions for each form in parallel
        await Promise.all(
          npsForms.map(async (form: TallyForm) => {
            try {
              const submissions: TallySubmission[] = await fetchAllSubmissions(form.id);
              const nps = calculateNps(submissions);
              setResults((prev) =>
                prev.map((r) =>
                  r.formId === form.id ? { ...r, ...nps, loading: false } : r
                )
              );
            } catch (e) {
              setResults((prev) =>
                prev.map((r) =>
                  r.formId === form.id
                    ? { ...r, loading: false, error: String(e) }
                    : r
                )
              );
            }
          })
        );
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { results, loading, error };
}
