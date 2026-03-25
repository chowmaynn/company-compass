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

export async function fetchTransactions(): Promise<Transaction[]> {
  const params = new URLSearchParams({
    filterByFormula: "IS_AFTER({Payment Date}, DATEADD(TODAY(), -365, 'days'))",
    sort: JSON.stringify([{ field: "Payment Date", direction: "desc" }]),
  });
  [
    "Customer Name",
    "Payment Date",
    "Event Type",
    "Amount",
    "Currency",
    "Status",
    "Invoice Name",
    "Subscription Type",
    "True Amount for Calculation",
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
  const params = new URLSearchParams({
    filterByFormula: "AND({Status}!='Paid', {Status}!='Cancelled')",
    sort: JSON.stringify([{ field: "Created time", direction: "desc" }]),
  });
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

export async function fetchCancellationRequests(): Promise<CancellationRequest[]> {
  const params = new URLSearchParams({
    sort: JSON.stringify([{ field: "Date of Submission", direction: "desc" }]),
  });
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

// ── Stripe Charges ────────────────────────────────────────────────────────────

export interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created: number;
  customerName?: string;
}

export async function fetchRecentCharges(limit = 50): Promise<StripeCharge[]> {
  const res = await fetch(`/api/stripe/v1/charges?limit=${limit}`);
  if (!res.ok) throw new Error(`Stripe ${res.status}`);
  const data = await res.json();
  return (data.data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    amount: (c.amount as number) / 100,
    currency: c.currency as string,
    status: c.status as string,
    description: (c.description as string) ?? "",
    created: c.created as number,
    customerName: (c.billing_details as Record<string, unknown>)?.name as string | undefined,
  }));
}
