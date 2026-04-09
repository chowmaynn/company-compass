export interface TallyForm {
  id: string;
  name: string;
  status: "BLANK" | "DRAFT" | "PUBLISHED" | "DELETED";
  numberOfSubmissions: number;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TallyResponse {
  id: string;
  questionId: string;
  answer: unknown;
}

export interface TallySubmission {
  id: string;
  formId: string;
  respondentId: string;
  isCompleted: boolean;
  submittedAt: string;
  responses: TallyResponse[];
}

export interface TallyFormsResponse {
  page: number;
  limit: number;
  hasMore: boolean;
  total: number;
  items: TallyForm[];
}

export interface TallySubmissionsResponse {
  page: number;
  limit: number;
  hasMore: boolean;
  totalNumberOfSubmissionsPerFilter: { all: number; completed: number; partial: number };
  questions: unknown[];
  submissions: TallySubmission[];
}

async function tallyFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`/api/tally${path}`);
  if (!res.ok) {
    console.error("Tally API error:", res.status, await res.text());
    return null;
  }
  return res.json();
}

export async function fetchForms(): Promise<TallyForm[]> {
  const all: TallyForm[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const data = await tallyFetch<TallyFormsResponse>(`/forms?page=${page}&limit=100`);
    if (!data) break;
    all.push(...data.items);
    hasMore = data.hasMore;
    page++;
  }
  return all;
}

export async function fetchSubmissions(formId: string, page = 1): Promise<TallySubmissionsResponse | null> {
  return tallyFetch<TallySubmissionsResponse>(`/forms/${formId}/submissions?page=${page}&limit=100`);
}

export async function fetchAllSubmissions(formId: string): Promise<TallySubmission[]> {
  const all: TallySubmission[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await fetchSubmissions(formId, page);
    if (!data) break;
    all.push(...data.submissions);
    hasMore = data.hasMore;
    page++;
  }

  return all;
}
