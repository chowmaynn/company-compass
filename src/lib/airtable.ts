export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: string;
}

export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: AirtableField[];
}

export interface AirtableField {
  id: string;
  name: string;
  type: string;
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface AirtableRecordsResponse {
  records: AirtableRecord[];
  offset?: string;
}

async function airtableFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`/api/airtable${path}`);
  if (!res.ok) {
    console.error("Airtable API error:", res.status, await res.text());
    return null;
  }
  return res.json();
}

/** List all bases the token has access to */
export async function fetchBases(): Promise<AirtableBase[]> {
  const data = await airtableFetch<{ bases: AirtableBase[] }>("/v0/meta/bases");
  return data?.bases ?? [];
}

/** List all tables in a base */
export async function fetchTables(baseId: string): Promise<AirtableTable[]> {
  const data = await airtableFetch<{ tables: AirtableTable[] }>(`/v0/meta/bases/${baseId}/tables`);
  return data?.tables ?? [];
}

/** Fetch all records from a table (handles pagination) */
export async function fetchRecords(baseId: string, tableIdOrName: string, params?: Record<string, string>): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const query = new URLSearchParams({ ...(params ?? {}), ...(offset ? { offset } : {}) });
    const data = await airtableFetch<AirtableRecordsResponse>(
      `/v0/${baseId}/${encodeURIComponent(tableIdOrName)}?${query}`
    );
    if (!data) break;
    all.push(...data.records);
    offset = data.offset;
  } while (offset);

  return all;
}
