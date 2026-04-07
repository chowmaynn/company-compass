export type StatusColor = "green" | "light-green" | "yellow" | "red";

export type Department = "Finance" | "Content" | "Marketing" | "Sales" | "Product";

export interface WeekData {
  actual: number | string;
  projection: number | string;
}

export interface WeekConfig {
  label: string;
  dateLabel: string; // dd/mm format
  start: string; // ISO date string (start of week, NZ time)
  end: string;   // ISO date string (end of week, NZ time)
}

export interface Metric {
  name: string;
  department: Department;
  catchUp: { actual: number | string; projection: number | string };
  weeks: WeekData[];
  monthlyActual: number | string;
  monthlyTarget: number | string;
  status: StatusColor;
  owner: string;
  source: string;
  description: string;
}

// Dynamic week config generation (Monday–Sunday), NZ timezone (Pacific/Auckland)
// Catch-up = 1st to day before first Monday. W1-W3 = 7 days. W4 absorbs to month end.
// NZDT (UTC+13) runs ~Oct–early Apr, NZST (UTC+12) runs ~Apr–Sep.

/** NZ offset in hours — approximate by month (sufficient for midnight boundaries) */
function nzOffsetHours(month: number): number {
  // NZDT: Oct(10) through Mar(3) = UTC+13; NZST: Apr(4) through Sep(9) = UTC+12
  return (month >= 10 || month <= 3) ? 13 : 12;
}

/** Returns the current month in NZ timezone as "YYYY-MM" */
export function getCurrentNZMonth(): string {
  const nz = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
  return nz.slice(0, 7);
}

/** Format "YYYY-MM" to display string like "April 2026" */
export function formatScorecardMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const names = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[parseInt(month)]} ${year}`;
}

/**
 * Generate Monday-aligned week configs for any month.
 * - Find first Monday on or after the 1st
 * - W1-W3: Monday-Sunday (7 days each)
 * - W4: 4th Monday through end of month (absorbs remainder)
 * - Catch-up: days before first Monday (handled separately)
 */
export function generateWeekConfigs(yearMonth: string): WeekConfig[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const offset = nzOffsetHours(month);
  const MS_DAY = 86400000;

  // Day-of-week of the 1st (in NZ time — use UTC date since we just need the weekday)
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const dow = firstOfMonth.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysToMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;

  // W1 start day (NZ date), and month end (NZ date)
  const w1StartDay = 1 + daysToMonday;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Convert NZ midnight to UTC for ISO strings
  const nzMidnightToUTC = (nzDay: number) =>
    new Date(Date.UTC(year, month - 1, nzDay) - offset * 3600000);

  const configs: WeekConfig[] = [];
  for (let w = 0; w < 4; w++) {
    const startDay = w1StartDay + w * 7;
    if (startDay > daysInMonth) break; // safety: month too short

    const endDay = w < 3
      ? startDay + 7               // W1-W3: strict 7 days (end = next Monday)
      : daysInMonth + 1;           // W4: absorbs to end of month (end = 1st of next month)

    const dd = (n: number) => String(n).padStart(2, "0");
    const mm = dd(month);

    configs.push({
      label: `W${w + 1}`,
      dateLabel: `${dd(startDay)}/${mm}`,
      start: nzMidnightToUTC(startDay).toISOString().replace(".000Z", "Z"),
      end: nzMidnightToUTC(endDay).toISOString().replace(".000Z", "Z"),
    });
  }
  return configs;
}

/**
 * Returns the catch-up date range for a month (days before first Monday).
 * Returns null if the 1st is already a Monday (no catch-up).
 */
export function getCatchUpRange(yearMonth: string): { start: string; end: string } | null {
  const configs = generateWeekConfigs(yearMonth);
  const [year, month] = yearMonth.split("-").map(Number);
  const offset = nzOffsetHours(month);
  const monthStartUTC = new Date(Date.UTC(year, month - 1, 1) - offset * 3600000);
  const w1Start = new Date(configs[0].start);

  if (monthStartUTC.getTime() >= w1Start.getTime()) return null; // 1st is Monday
  return { start: monthStartUTC.toISOString(), end: configs[0].start };
}

// Backward-compatible exports
export const weekConfigs = generateWeekConfigs(getCurrentNZMonth());
export const scorecardMonth = formatScorecardMonth(getCurrentNZMonth());

/** Returns 0-3 for the current active week, 4 if past all weeks, -1 if before month */
export function getCurrentWeekIndex(configs: WeekConfig[] = weekConfigs): number {
  const now = new Date();
  for (let i = 0; i < configs.length; i++) {
    if (now >= new Date(configs[i].start) && now < new Date(configs[i].end)) return i;
  }
  if (now >= new Date(configs[configs.length - 1].end)) return configs.length;
  return -1;
}

/** Returns the index of the most recently completed week (0-3), or -1 if none completed */
export function getCompletedWeekIndex(configs: WeekConfig[] = weekConfigs): number {
  const now = new Date();
  for (let i = configs.length - 1; i >= 0; i--) {
    if (now >= new Date(configs[i].end)) return i;
  }
  return -1;
}

export const statusOptions: { value: StatusColor; label: string }[] = [
  { value: "light-green", label: "Ahead" },
  { value: "green", label: "On Track" },
  { value: "yellow", label: "Behind" },
  { value: "red", label: "At Risk" },
];

export const scorecardData: Metric[] = [
  // EVERGREEN METRICS
  {
    name: "Revenue",
    department: "Finance",
    catchUp: { actual: 36672, projection: 474194 },
    weeks: [
      { actual: 136151, projection: 829839 },
      { actual: 173813, projection: 829839 },
      { actual: 193871, projection: 829839 },
      { actual: 136382, projection: 711289 },
    ],
    monthlyActual: 676889,
    monthlyTarget: "$3,675,000",
    status: "red",
    owner: "Lana",
    source: "Daily P&L",
    description: "The total sales generated by the company",
  },
  {
    name: "Cash Collected",
    department: "Finance",
    catchUp: { actual: 34596, projection: 451613 },
    weeks: [
      { actual: 129668, projection: 790323 },
      { actual: 165536, projection: 790323 },
      { actual: 184639, projection: 790323 },
      { actual: 129888, projection: 677418 },
    ],
    monthlyActual: 644327,
    monthlyTarget: "3,500,000",
    status: "red",
    owner: "Lana",
    source: "Stripe + PayPal",
    description: "The actual amount of cash received by the company",
  },
  // CONTENT
  {
    name: "Videos posted last week",
    department: "Content",
    catchUp: { actual: "—", projection: 3 },
    weeks: [
      { actual: "—", projection: 3 },
      { actual: "—", projection: 3 },
      { actual: "—", projection: 3 },
      { actual: "—", projection: 3 },
    ],
    monthlyActual: "—",
    monthlyTarget: 12,
    status: "green",
    owner: "Adam Jahr",
    source: "Notion",
    description: "The total count of videos published on YouTube in the past week",
  },
  {
    name: "Videos in the backlog",
    department: "Content",
    catchUp: { actual: "—", projection: 2 },
    weeks: [
      { actual: "—", projection: 2 },
      { actual: "—", projection: 2 },
      { actual: "—", projection: 2 },
      { actual: "—", projection: 2 },
    ],
    monthlyActual: "—",
    monthlyTarget: "2 per week",
    status: "green",
    owner: "Adam Jahr",
    source: "Notion",
    description: "Videos that have entered production",
  },
  {
    name: "YouTube views",
    department: "Content",
    catchUp: { actual: "109.1k", projection: "250k" },
    weeks: [
      { actual: "217.4k", projection: "250k" },
      { actual: "206.9k", projection: "250k" },
      { actual: "225k", projection: "250k" },
      { actual: "265.3k", projection: "250k" },
    ],
    monthlyActual: "1.02m",
    monthlyTarget: "1m",
    status: "green",
    owner: "Adam Jahr",
    source: "YouTube",
    description: "The total number of videos currently undergoing the editing process",
  },
  {
    name: "New YouTube subscribers",
    department: "Content",
    catchUp: { actual: "1.9k", projection: "1.5k" },
    weeks: [
      { actual: "3.7k", projection: "4k" },
      { actual: "3.8k", projection: "4k" },
      { actual: "3.5k", projection: "4k" },
      { actual: "3.4k", projection: "4k" },
    ],
    monthlyActual: "16.3k",
    monthlyTarget: "16k",
    status: "yellow",
    owner: "Adam Jahr",
    source: "YouTube",
    description: "The total number of new subscribers to the main channel",
  },
  {
    name: "Clicks: YouTube > Skool",
    department: "Content",
    catchUp: { actual: 1129, projection: 2500 },
    weeks: [
      { actual: 4318, projection: 3500 },
      { actual: 3094, projection: 3500 },
      { actual: 3112, projection: 4000 },
      { actual: 2019, projection: 4000 },
    ],
    monthlyActual: 13672,
    monthlyTarget: 15000,
    status: "yellow",
    owner: "Adam Jahr",
    source: "Bitly",
    description: "The number of funnel-clicks on links from YouTube to Skool",
  },
  {
    name: "Clicks: YouTube > Accelerator",
    department: "Content",
    catchUp: { actual: 113, projection: 500 },
    weeks: [
      { actual: 669, projection: 500 },
      { actual: 619, projection: 550 },
      { actual: 608, projection: 600 },
      { actual: 556, projection: 600 },
    ],
    monthlyActual: 2565,
    monthlyTarget: 2250,
    status: "green",
    owner: "Adam Jahr",
    source: "Bitly",
    description: "The number of funnel-clicks on links from YouTube to Accelerator",
  },
  {
    name: "Clicks: Skool > Accelerator",
    department: "Content",
    catchUp: { actual: 0, projection: 0 },
    weeks: [
      { actual: 150, projection: 150 },
      { actual: 138, projection: 200 },
      { actual: 80, projection: 200 },
      { actual: 285, projection: 200 },
    ],
    monthlyActual: 750,
    monthlyTarget: "",
    status: "green",
    owner: "",
    source: "",
    description: "",
  },
  // MARKETING — Bookings
  {
    name: "Total Bookings",
    department: "Marketing",
    catchUp: { actual: 91, projection: 320 },
    weeks: [
      { actual: 597, projection: 560 },
      { actual: 286, projection: 560 },
      { actual: 205, projection: 560 },
      { actual: 480, projection: 480 },
    ],
    monthlyActual: 1179,
    monthlyTarget: 2480,
    status: "yellow",
    owner: "Casey",
    source: "Booking Sheet",
    description: "",
  },
  {
    name: "Email Bookings",
    department: "Marketing",
    catchUp: { actual: 17, projection: 80 },
    weeks: [
      { actual: 319, projection: 140 },
      { actual: 74, projection: 140 },
      { actual: 34, projection: 140 },
      { actual: 120, projection: 120 },
    ],
    monthlyActual: "",
    monthlyTarget: 620,
    status: "light-green",
    owner: "Casey",
    source: "Booking Sheet",
    description: "",
  },
  {
    name: "Website Views",
    department: "Marketing",
    catchUp: { actual: 891, projection: 2000 },
    weeks: [
      { actual: 2344, projection: 3500 },
      { actual: 2067, projection: 3500 },
      { actual: 1960, projection: 3500 },
      { actual: 3000, projection: 3000 },
    ],
    monthlyActual: "",
    monthlyTarget: 15500,
    status: "red",
    owner: "Casey",
    source: "Booking Sheet",
    description: "",
  },
  {
    name: "Website Bookings",
    department: "Marketing",
    catchUp: { actual: "—", projection: "—" },
    weeks: [
      { actual: "—", projection: "—" },
      { actual: "—", projection: "—" },
      { actual: "—", projection: "—" },
      { actual: "—", projection: "—" },
    ],
    monthlyActual: "—",
    monthlyTarget: "—",
    status: "green",
    owner: "Casey",
    source: "Booking Sheet",
    description: "Total bookings from the website",
  },
  {
    name: "Website Booking Rate",
    department: "Marketing",
    catchUp: { actual: "2.61%", projection: "4%" },
    weeks: [
      { actual: "2.79%", projection: "4%" },
      { actual: "2.30%", projection: "4%" },
      { actual: "1.69%", projection: "4%" },
      { actual: "4%", projection: "4%" },
    ],
    monthlyActual: "4.00%",
    monthlyTarget: "",
    status: "red",
    owner: "Casey",
    source: "Booking Sheet",
    description: "The number of bookings made directly through the website",
  },
  {
    name: "Skool Joins",
    department: "Marketing",
    catchUp: { actual: 1294, projection: 1600 },
    weeks: [
      { actual: 3548, projection: 2800 },
      { actual: 2833, projection: 2800 },
      { actual: 2538, projection: 2800 },
      { actual: 2400, projection: 2400 },
    ],
    monthlyActual: "",
    monthlyTarget: 12400,
    status: "green",
    owner: "Casey",
    source: "Booking Sheet",
    description: "The number of bookings made through out Skool Classroom",
  },
  {
    name: "Skool Bookings",
    department: "Marketing",
    catchUp: { actual: "—", projection: "—" },
    weeks: [
      { actual: "—", projection: "—" },
      { actual: "—", projection: "—" },
      { actual: "—", projection: "—" },
      { actual: "—", projection: "—" },
    ],
    monthlyActual: "—",
    monthlyTarget: "—",
    status: "green",
    owner: "Casey",
    source: "Booking Sheet",
    description: "Total bookings from all Skool sources (DM, Classroom, Post)",
  },
  {
    name: "Skool Booking Rate",
    department: "Marketing",
    catchUp: { actual: "3.00%", projection: "4%" },
    weeks: [
      { actual: "4.10%", projection: "4%" },
      { actual: "4.80%", projection: "4%" },
      { actual: "3.20%", projection: "4%" },
      { actual: "4%", projection: "4%" },
    ],
    monthlyActual: "4.00%",
    monthlyTarget: "",
    status: "green",
    owner: "Casey",
    source: "Booking Sheet",
    description: "The number of bookings made through out Skool setter",
  },
  // SALES
  {
    name: "Triage Calls Booked",
    department: "Sales",
    catchUp: { actual: 181, projection: 190 },
    weeks: [
      { actual: 382, projection: 475 },
      { actual: 87, projection: 475 },
      { actual: 475, projection: 475 },
      { actual: 475, projection: 475 },
    ],
    monthlyActual: "",
    monthlyTarget: 2090,
    status: "yellow",
    owner: "AJ",
    source: "Booking Sheet",
    description: "",
  },
  {
    name: "Triage Show Rate",
    department: "Sales",
    catchUp: { actual: 57, projection: 70 },
    weeks: [
      { actual: "49%", projection: "70%" },
      { actual: "63%", projection: "70%" },
      { actual: "70%", projection: "70%" },
      { actual: "70%", projection: "70%" },
    ],
    monthlyActual: "70%",
    monthlyTarget: "",
    status: "yellow",
    owner: "AJ",
    source: "Booking Sheet",
    description: "",
  },
  {
    name: "Triage Qualification Rate",
    department: "Sales",
    catchUp: { actual: 55, projection: "50%" },
    weeks: [
      { actual: "51%", projection: "50%" },
      { actual: "49%", projection: "50%" },
      { actual: "50%", projection: "50%" },
      { actual: "50%", projection: "50%" },
    ],
    monthlyActual: "50%",
    monthlyTarget: "",
    status: "green",
    owner: "AJ",
    source: "Booking Sheet",
    description: "",
  },
  {
    name: "Closing Calls Booked",
    department: "Sales",
    catchUp: { actual: 24, projection: 238 },
    weeks: [
      { actual: 187, projection: 238 },
      { actual: 266, projection: 238 },
      { actual: 238, projection: 238 },
      { actual: 238, projection: 238 },
    ],
    monthlyActual: "",
    monthlyTarget: 1188,
    status: "yellow",
    owner: "AJ",
    source: "Booking Sheet",
    description: "",
  },
  {
    name: "Closing Call Show Rate",
    department: "Sales",
    catchUp: { actual: "79%", projection: "80%" },
    weeks: [
      { actual: "67%", projection: "80%" },
      { actual: "61%", projection: "80%" },
      { actual: "80%", projection: "80%" },
      { actual: "80%", projection: "80%" },
    ],
    monthlyActual: "80%",
    monthlyTarget: "",
    status: "yellow",
    owner: "AJ",
    source: "Booking Sheet",
    description: "",
  },
  {
    name: "Closing Calls Taken",
    department: "Sales",
    catchUp: { actual: 19, projection: 190 },
    weeks: [
      { actual: 126, projection: 190 },
      { actual: 163, projection: 190 },
      { actual: 190, projection: 190 },
      { actual: 190, projection: 190 },
    ],
    monthlyActual: "",
    monthlyTarget: 950,
    status: "yellow",
    owner: "AJ",
    source: "Booking Sheet",
    description: "",
  },
  {
    name: "Closing Call Close Rate",
    department: "Sales",
    catchUp: { actual: "21%", projection: "30%" },
    weeks: [
      { actual: "8%", projection: "30%" },
      { actual: "9%", projection: "30%" },
      { actual: "30%", projection: "30%" },
      { actual: "36%", projection: "36%" },
    ],
    monthlyActual: "30%",
    monthlyTarget: "",
    status: "red",
    owner: "AJ",
    source: "Booking Sheet",
    description: "",
  },
  // COMMUNITY MANAGEMENT
  {
    name: "Customer support complaints",
    department: "Product",
    catchUp: { actual: 0, projection: 3 },
    weeks: [
      { actual: 1, projection: 3 },
      { actual: 0, projection: 3 },
      { actual: 0, projection: 3 },
      { actual: 0, projection: 3 },
    ],
    monthlyActual: 1,
    monthlyTarget: 15,
    status: "green",
    owner: "Nicholay Voyvik",
    source: "Intercom",
    description: "The total count of complaints received from customers about products",
  },
  {
    name: "NPS Score - 2 months",
    department: "Product",
    catchUp: { actual: 10, projection: 15 },
    weeks: [
      { actual: 10, projection: 15 },
      { actual: 10, projection: 15 },
      { actual: 10, projection: 15 },
      { actual: 11, projection: 15 },
    ],
    monthlyActual: 11,
    monthlyTarget: 15,
    status: "yellow",
    owner: "Nicholay Voyvik",
    source: "Sheet",
    description: "The Net Promoter Score (NPS) is a metric used to measure customer loyalty and satisfaction",
  },
  {
    name: "NPS Score - 6 Months",
    department: "Product",
    catchUp: { actual: 8, projection: 10 },
    weeks: [
      { actual: 8, projection: 10 },
      { actual: 10, projection: 10 },
      { actual: 10, projection: 10 },
      { actual: 12, projection: 10 },
    ],
    monthlyActual: 12,
    monthlyTarget: 10,
    status: "yellow",
    owner: "Nicholay Voyvik",
    source: "Sheet",
    description: "The Net Promoter Score (NPS) based on 6-month customer data",
  },
];

export const departments: Department[] = [
  "Finance",
  "Content",
  "Marketing",
  "Sales",
  "Product",
];
