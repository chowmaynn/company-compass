const BASE_ID = "appGETdifiec5sHPz";

async function airtableFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api/airtable${path}`);
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  return res.json();
}

async function paginateAll<T extends { fields: unknown }>(
  tableId: string,
  params: URLSearchParams
): Promise<T[]> {
  const all: T[] = [];
  let offset: string | undefined;
  do {
    if (offset) params.set("offset", offset);
    const data = await airtableFetch<{ records: T[]; offset?: string }>(
      `/v0/${BASE_ID}/${tableId}?${params}`
    );
    all.push(...data.records);
    offset = data.offset;
  } while (offset);
  return all;
}

// ── Transactions ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  customerName: string;
  paymentDate: string;
  eventType: string;
  amount: number;
  currency: string;
  status: string;
  invoiceName: string;
  subscriptionType: string;
}

export async function fetchTransactions(afterDate?: string): Promise<Transaction[]> {
  const params = new URLSearchParams();
  params.set("maxRecords", "600");
  params.append("sort[0][field]", "Payment Date");
  params.append("sort[0][direction]", "desc");
  if (afterDate) {
    params.set("filterByFormula", `IS_AFTER({Payment Date}, '${afterDate}')`);
  }
  [
    "Customer Name",
    "Payment Date",
    "Event Type",
    "Amount",
    "Currency",
    "Status",
    "Invoice Name",
    "Subscription Type",
  ].forEach((f) => params.append("fields[]", f));

  const records = await paginateAll<{
    id: string;
    fields: Record<string, unknown>;
  }>(encodeURIComponent("tblJmSYwnuZ8ZqqMf"), params);

  return records.map((r) => ({
    id: r.id,
    customerName: (r.fields["Customer Name"] as string) ?? "Unknown",
    paymentDate: (r.fields["Payment Date"] as string) ?? "",
    eventType: (r.fields["Event Type"] as string) ?? "",
    amount: (r.fields["Amount"] as number) ?? 0,
    currency: (r.fields["Currency"] as string) ?? "nzd",
    status: (r.fields["Status"] as string) ?? "",
    invoiceName: (r.fields["Invoice Name"] as string) ?? "",
    subscriptionType: (r.fields["Subscription Type"] as string) ?? "",
  }));
}

// ── Members ───────────────────────────────────────────────────────────────────

export interface Member {
  id: string;
  customerName: string;
  status: string;
  planName: string;
  totalPaid: number;
  lastPaymentStatus: string;
}

export async function fetchMembers(): Promise<Member[]> {
  const params = new URLSearchParams();
  params.set("maxRecords", "500");
  ["Customer Name", "Status", "Plan Name", "Total Amount Paid (Payment Plan or Full Payment)", "Current Last Payment Status"]
    .forEach((f) => params.append("fields[]", f));

  const records = await paginateAll<{
    id: string;
    fields: Record<string, unknown>;
  }>(encodeURIComponent("tblh3U9XIIGJXvxf2"), params);

  return records.map((r) => ({
    id: r.id,
    customerName: (r.fields["Customer Name"] as string) ?? "Unknown",
    status: (r.fields["Status"] as string) ?? "",
    planName: (r.fields["Plan Name"] as string) ?? "",
    totalPaid: (r.fields["Total Amount Paid (Payment Plan or Full Payment)"] as number) ?? 0,
    lastPaymentStatus: ((r.fields["Current Last Payment Status"] as string[]) ?? [])[0] ?? "",
  }));
}

// ── Failed Payments ───────────────────────────────────────────────────────────

export interface FailedPayment {
  id: string;
  customer: string;
  email: string;
  subscriptionPlan: string;
  status: string;
  nextFollowUp: string;
  createdTime: string;
}

export async function fetchFailedPayments(): Promise<FailedPayment[]> {
  const params = new URLSearchParams();
  params.set("maxRecords", "100");
  params.append("sort[0][field]", "Created time");
  params.append("sort[0][direction]", "desc");
  ["Customer", "Email", "Subscription Plan", "Status", "Next Follow Up"]
    .forEach((f) => params.append("fields[]", f));

  const records = await paginateAll<{
    id: string;
    createdTime: string;
    fields: Record<string, unknown>;
  }>(encodeURIComponent("tbly9qSkijuBoN3K1"), params);

  return records.map((r) => ({
    id: r.id,
    customer: (r.fields["Customer"] as string) ?? "Unknown",
    email: (r.fields["Email"] as string) ?? "",
    subscriptionPlan: (r.fields["Subscription Plan"] as string) ?? "",
    status: (r.fields["Status"] as string) ?? "",
    nextFollowUp: (r.fields["Next Follow Up"] as string) ?? "",
    createdTime: r.createdTime,
  }));
}

// ── Cancellation Requests ─────────────────────────────────────────────────────

export interface CancellationRequest {
  id: string;
  fullName: string;
  cancellationReason: string[];
  status: string;
  dateOfSubmission: string;
}

export async function fetchCancellationRequests(afterDate?: string): Promise<CancellationRequest[]> {
  const params = new URLSearchParams();
  params.set("maxRecords", "300");
  params.append("sort[0][field]", "Date of Submission");
  params.append("sort[0][direction]", "desc");
  if (afterDate) {
    params.set("filterByFormula", `IS_AFTER({Date of Submission}, '${afterDate}')`);
  }
  ["Full Name", "Cancellation Reason", "Status", "Date of Submission"]
    .forEach((f) => params.append("fields[]", f));

  const records = await paginateAll<{
    id: string;
    fields: Record<string, unknown>;
  }>(encodeURIComponent("tble0pxAhdHua0q6C"), params);

  return records.map((r) => ({
    id: r.id,
    fullName: (r.fields["Full Name"] as string) ?? "Unknown",
    cancellationReason: (r.fields["Cancellation Reason"] as string[]) ?? [],
    status: (r.fields["Status"] as string) ?? "",
    dateOfSubmission: (r.fields["Date of Submission"] as string) ?? "",
  }));
}

// ── Stripe Overview ───────────────────────────────────────────────────────────

export interface DailyVolume {
  date: string; // "dd MMM"
  gross: number;
  net: number;
}

export interface StripeOverview {
  grossVolume: number;
  netVolume: number;
  succeeded: number;
  failed: number;
  refunded: number;
  blocked: number;
  newCustomers: number;
  dailyVolume: DailyVolume[];
}

function stripeFetch(path: string) {
  return fetch(`/api/stripe${path}`).then((r) => {
    if (!r.ok) throw new Error(`Stripe ${r.status}`);
    return r.json();
  });
}

function dayLabel(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

async function paginateStripe(path: string, limit = 100, maxPages = 3): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let url = `${path}&limit=${limit}`;
  for (let i = 0; i < maxPages; i++) {
    const data = await stripeFetch(url);
    all.push(...(data.data ?? []));
    if (!data.has_more) break;
    const last = data.data[data.data.length - 1];
    url = `${path}&limit=${limit}&starting_after=${last.id}`;
  }
  return all;
}

export async function fetchStripeOverview(startTs: number, endTs: number): Promise<StripeOverview> {
  const range = `created%5Bgte%5D=${startTs}&created%5Blte%5D=${endTs}`;

  // Parallel: balance txns (paginated), charges (paginated), customers (count only)
  const [balanceTxns, charges, customerRes] = await Promise.all([
    paginateStripe(`/v1/balance_transactions?type=charge&${range}`, 100, 2),
    paginateStripe(`/v1/charges?${range}`, 100, 2),
    stripeFetch(`/v1/customers?${range}&limit=1`),
  ]);

  // Gross / net from balance transactions
  let grossVolume = 0;
  let netVolume = 0;
  const dayMap: Record<string, { gross: number; net: number }> = {};

  for (const tx of balanceTxns) {
    const amount = (tx.amount as number) / 100;
    const net = (tx.net as number) / 100;
    grossVolume += amount;
    netVolume += net;
    const label = dayLabel(tx.created as number);
    if (!dayMap[label]) dayMap[label] = { gross: 0, net: 0 };
    dayMap[label].gross += amount;
    dayMap[label].net += net;
  }

  const dailyVolume: DailyVolume[] = Object.entries(dayMap)
    .reverse()
    .map(([date, v]) => ({ date, gross: Math.round(v.gross), net: Math.round(v.net) }));

  // Payment breakdown from charges
  let succeeded = 0;
  let failed = 0;
  let refunded = 0;
  let blocked = 0;

  for (const c of charges) {
    const amount = (c.amount as number) / 100;
    const amountRefunded = (c.amount_refunded as number) / 100;
    const outcome = c.outcome as Record<string, unknown> | null;
    if (outcome?.type === "blocked") {
      blocked += amount;
    } else if (c.status === "failed") {
      failed += amount;
    } else if (c.status === "succeeded") {
      succeeded += amount - amountRefunded;
      refunded += amountRefunded;
    }
  }

  return {
    grossVolume: Math.round(grossVolume),
    netVolume: Math.round(netVolume),
    succeeded: Math.round(succeeded),
    failed: Math.round(failed),
    refunded: Math.round(refunded),
    blocked: Math.round(blocked),
    newCustomers: customerRes.total_count ?? customerRes.data?.length ?? 0,
    dailyVolume,
  };
}
