import { useState, useEffect } from "react";
import { fetchForms, fetchAllSubmissions, type TallyForm, type TallySubmission } from "@/lib/tally";

export function useTallyForms() {
  const [forms, setForms] = useState<TallyForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchForms()
      .then(setForms)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return { forms, loading, error };
}

export function useTallySubmissions(formId: string | null) {
  const [submissions, setSubmissions] = useState<TallySubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!formId) return;
    setLoading(true);
    fetchAllSubmissions(formId)
      .then(setSubmissions)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [formId]);

  return { submissions, loading, error };
}
