export interface AirtableResponse<T> {
  records: Array<{ id: string; fields: T }>;
  offset?: string;
}

export interface MeetingRecord {
  'Invitee Name'?: string;
  'Coach Assigned'?: string;
  'Event type'?: string;
  'Meeting Status'?: string[];
  'Event Start Time (NZT)'?: string;
  'Call duration'?: number;
  'Event Start Date Only (NZT)'?: string;
}

export interface CirclePost {
  'Help Subject'?: string;
  'Name'?: string;
  'Coach'?: string[];
  'Status'?: string;
  'Created'?: string;
  'Response Time'?: string;
  'Minutes to Respond'?: number;
  'Time Difference'?: number;
  'Link'?: string;
}

const BASE_ID = 'apps7XQzP1u5N0w9H';
const MEETINGS_TABLE = 'tbluxDSjS3kcaCvov';
const CIRCLE_TABLE = 'tblMrQD94qZc38p6v';

async function airtableFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api/airtable${path}`);
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  return res.json();
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function fetchAllMeetingRecords(filterFormula: string): Promise<Array<{ id: string; fields: MeetingRecord }>> {
  const all: Array<{ id: string; fields: MeetingRecord }> = [];
  let offset: string | undefined;

  const fields = [
    'Invitee Name',
    'Coach Assigned',
    'Event type',
    'Meeting Status',
    'Event Start Time (NZT)',
    'Call duration',
    'Event Start Date Only (NZT)',
  ];

  do {
    const params = new URLSearchParams({
      filterByFormula: filterFormula,
      'sort[0][field]': 'Event Start Time (NZT)',
      'sort[0][direction]': 'asc',
    });
    fields.forEach((f) => params.append('fields[]', f));
    if (offset) params.set('offset', offset);

    const data = await airtableFetch<AirtableResponse<MeetingRecord>>(
      `/v0/${BASE_ID}/${encodeURIComponent(MEETINGS_TABLE)}?${params}`
    );
    all.push(...data.records);
    offset = data.offset;
  } while (offset);

  return all;
}

export async function fetchTodaysMeetings(): Promise<Array<{ id: string; fields: MeetingRecord }>> {
  const today = formatDate(new Date());
  const filter = `FIND("${today}", {Event Start Date Only (NZT)})`;
  return fetchAllMeetingRecords(filter);
}

export async function fetchWeeklyMeetings(
  startDate: string,
  endDate: string
): Promise<Array<{ id: string; fields: MeetingRecord }>> {
  const filter = `AND({Event Start Date Only (NZT)} >= "${startDate}", {Event Start Date Only (NZT)} <= "${endDate}")`;
  return fetchAllMeetingRecords(filter);
}

export async function fetchCircleSLA(): Promise<Array<{ id: string; fields: CirclePost }>> {
  const all: Array<{ id: string; fields: CirclePost }> = [];
  let offset: string | undefined;

  const fields = [
    'Help Subject',
    'Name',
    'Coach',
    'Status',
    'Created',
    'Response Time',
    'Minutes to Respond',
    'Time Difference',
    'Link',
  ];

  do {
    const params = new URLSearchParams({
      'sort[0][field]': 'Created',
      'sort[0][direction]': 'desc',
      maxRecords: '50',
    });
    fields.forEach((f) => params.append('fields[]', f));
    if (offset) params.set('offset', offset);

    const data = await airtableFetch<AirtableResponse<CirclePost>>(
      `/v0/${BASE_ID}/${encodeURIComponent(CIRCLE_TABLE)}?${params}`
    );
    all.push(...data.records);
    offset = data.offset;
  } while (offset);

  return all;
}
