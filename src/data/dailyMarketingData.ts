export interface DailyMetric {
  name: string;
  monthlyTarget: number | string;
  projection: number | string;
  dailyValues: (number | string)[];
  isPercentage?: boolean;
  /** Mark as a total / summary row for distinct styling */
  isTotal?: boolean;
}

export interface ContextRow {
  label: string;
  dailyValues: string[];
}

/**
 * Days in the scorecard month (March 2026).
 * Each entry is a date label like "1-Mar".
 */
export const dailyDates: string[] = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1;
  return `${day}-Mar-2026`;
});

export const dailyDateLabels: string[] = Array.from({ length: 31 }, (_, i) => {
  return `${i + 1}-Mar`;
});

/** Top-of-table context rows (links / notes about daily activities) */
export const contextRows: ContextRow[] = [
  {
    label: "BROADCAST EMAILS",
    dailyValues: [
      "", "", "https://app.kit.co", "https://app.kit.co", "", "", "", "", "", "",
      "", "", "", "", "", "", "", "", "", "",
      "", "", "", "", "", "", "", "", "", "", "",
    ],
  },
  {
    label: "YOUTUBE VIDEOS",
    dailyValues: [
      "https://www.yout…", "", "", "", "https://www.youtu…", "", "", "", "", "",
      "", "", "", "", "", "", "", "", "", "",
      "", "", "", "", "", "", "", "", "", "", "",
    ],
  },
  {
    label: "SKOOL POSTS",
    dailyValues: [
      "", "https://www.skoo…", "https://www.skoo…", "", "", "", "", "", "", "",
      "", "", "", "", "", "", "", "", "", "",
      "", "", "", "", "", "", "", "", "", "", "",
    ],
  },
  {
    label: "OTHER CHANGES",
    dailyValues: [
      "", "", "", "", "", "", "Website Update", "", "", "",
      "", "", "", "", "", "", "", "", "", "",
      "", "", "", "", "", "", "", "", "", "", "",
    ],
  },
];

/** Daily numeric metrics for the Marketing department */
export const dailyMarketingMetrics: DailyMetric[] = [
  {
    name: "QF Calls Booked",
    monthlyTarget: 45,
    projection: 35,
    isTotal: true,
    dailyValues: [
      26, 35, 55, 17, 96, 32, 50, 34, 65, 29,
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
  {
    name: "Skool joins",
    monthlyTarget: 300,
    projection: 323,
    dailyValues: [
      502, 409, 497, 320, 278, 262, 285, 268, 201, 279,
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
  {
    name: "Skool Bookings DM Setter",
    monthlyTarget: 12,
    projection: 7,
    dailyValues: [
      0, 12, 13, 4, 4, 8, 9, 5, 10, 11,
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
  {
    name: "Skool Booking %",
    monthlyTarget: "4.0%",
    projection: "2.40%",
    isTotal: true,
    dailyValues: [
      "0.0%", "2.9%", "2.6%", "1.3%", "1.4%", "3.1%", "3.2%", "1.9%", "5.0%", "3.9%",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
    isPercentage: true,
  },
  {
    name: "Skool Bookings Post",
    monthlyTarget: 2,
    projection: 0,
    dailyValues: [
      0, 0, 1, 0, 0, 0, 0, 0, 0, 0,
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
  {
    name: "Skool Bookings Classroom",
    monthlyTarget: 5,
    projection: 4,
    dailyValues: [
      8, 12, 21, 5, 10, 8, 6, 0, 0, 1,
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
  {
    name: "Email Bookings",
    monthlyTarget: 10,
    projection: 1,
    dailyValues: [
      2, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
  {
    name: "Welcome Sequence Email Bookings",
    monthlyTarget: 6,
    projection: 2,
    dailyValues: [
      3, 6, 3, 2, 0, 1, 1, 2, 4, 2,
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
  {
    name: "Website Visitors (active users)",
    monthlyTarget: 250,
    projection: 327,
    dailyValues: [
      280, 288, 481, 449, 488, 464, 187, 346, 372, 156,
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
  {
    name: "Website Bookings (tot)",
    monthlyTarget: 10,
    projection: 11,
    dailyValues: [
      6, 5, 14, 3, 5, 7, 17, 9, 29, "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
  {
    name: "Website Booking %",
    monthlyTarget: "4%",
    projection: "3.67%",
    isTotal: true,
    dailyValues: [
      "2.14%", "1.74%", "2.91%", "0.67%", "1.02%", "1.51%", "9.09%", "2.60%", "7.80%", "5.77%",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
    isPercentage: true,
  },
  {
    name: "Google Bookings",
    monthlyTarget: 5,
    projection: 0,
    dailyValues: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
  {
    name: "Business Call",
    monthlyTarget: "—",
    projection: "—",
    dailyValues: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
  {
    name: "AIOS Webinar",
    monthlyTarget: "—",
    projection: "—",
    dailyValues: [
      7, 0, 3, 3, 77, 8, 17, 18, 21, 7,
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ],
  },
];
