const BASE_ID = 'appWg0cjeFOyy9eQE';
const WINS_TABLE = 'tblCzEnryMWyBaCqP';

async function airtableFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api/airtable${path}`);
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  return res.json();
}

export interface WinRecord {
  'Final revenue (USD)'?: number;
  'Solution type'?: string;
  'Industry'?: string;
  'Acquisition method'?: string;
  'Deal date'?: string;
  'CSM (from Members)'?: string[];
  'Source'?: string[];
  'Payment type'?: string;
  'CSM Review Status'?: string;
  'Full Name (from Members)'?: string[];
}

export async function fetchAllWins(): Promise<Array<{ id: string; createdTime: string; fields: WinRecord }>> {
  const all: Array<{ id: string; createdTime: string; fields: WinRecord }> = [];
  let offset: string | undefined;

  const fields = [
    'Final revenue (USD)',
    'Solution type',
    'Industry',
    'Acquisition method',
    'Deal date',
    'CSM (from Members)',
    'Source',
    'Payment type',
    'CSM Review Status',
    'Full Name (from Members)',
  ];

  do {
    const params = new URLSearchParams({
      filterByFormula: '{CSM Review Status}="Approved"',
    });
    fields.forEach((f) => params.append('fields[]', f));
    if (offset) params.set('offset', offset);

    const data = await airtableFetch<{
      records: Array<{ id: string; createdTime: string; fields: WinRecord }>;
      offset?: string;
    }>(`/v0/${BASE_ID}/${encodeURIComponent(WINS_TABLE)}?${params}`);

    all.push(...data.records);
    offset = data.offset;
  } while (offset);

  return all;
}
