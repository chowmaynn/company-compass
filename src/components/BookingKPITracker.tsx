import React, { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, StickyNote, X, Play, Mail, MessageCircle } from "lucide-react";
import { type VideoItem } from "@/lib/youtube";
import { fetchBroadcastsInRange, type BroadcastItem } from "@/lib/kit";
import { fetchDailyActiveUsers } from "@/lib/google-analytics";
import { useSupabaseMetrics } from "@/hooks/use-supabase-metrics";
import { LoadingDots } from "@/components/LoadingDots";

// ─── Note Popover ─────────────────────────────────────────────────────────────

function NotePopover({
  date, value, onChange,
}: {
  date: Date;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const hasNote = value.trim().length > 0;
  const dayLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  // Sync draft when value changes externally
  useEffect(() => { if (!open) setDraft(value); }, [value, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        onChange(draft);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, draft, onChange]);

  function save() { onChange(draft); setOpen(false); }
  function clear() { setDraft(""); onChange(""); setOpen(false); }

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", justifyContent: "center" }}>
      {/* Trigger button */}
      <button
        onClick={() => { setDraft(value); setOpen(o => !o); }}
        title={hasNote ? value : "Add note"}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "100%", height: 32, borderRadius: 0, border: "none", cursor: "pointer",
          background: hasNote ? "rgba(250,204,21,0.15)" : "transparent",
          color: hasNote ? "#facc15" : "transparent",
          transition: "all 0.15s",
          position: "relative",
        }}
      >
        {hasNote && <StickyNote size={14} />}
        {hasNote && (
          <span style={{
            position: "absolute", top: 3, right: 3,
            width: 5, height: 5, borderRadius: "50%",
            background: "#facc15",
          }} />
        )}
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position: "fixed",
          zIndex: 9999,
          width: 280,
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          padding: 0,
          overflow: "hidden",
          // Centered below trigger — we'll use a layout trick
          transform: "translateX(-50%)",
          left: "50%",
          top: 36,
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid hsl(var(--border))", background: "rgba(250,204,21,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <StickyNote size={13} color="#facc15" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#facc15" }}>{dayLabel}</span>
            </div>
            <button onClick={() => { onChange(draft); setOpen(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: 2, display: "flex" }}>
              <X size={13} />
            </button>
          </div>

          {/* Textarea */}
          <div style={{ padding: 10 }}>
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && e.metaKey) save(); if (e.key === "Escape") { onChange(draft); setOpen(false); } }}
              rows={6}
              placeholder="What changed today? (e.g. launched new ad, changed CTA, sent email blast...)"
              style={{
                width: "100%", resize: "vertical",
                background: "hsl(var(--muted))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6, outline: "none",
                fontSize: 12, color: "var(--foreground)",
                padding: "8px 10px", lineHeight: 1.6,
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "hsl(var(--primary))")}
              onBlur={e => (e.currentTarget.style.borderColor = "transparent")}
            />
          </div>

          {/* Footer */}
          <div style={{ display: "flex", gap: 6, padding: "0 10px 10px", justifyContent: "flex-end" }}>
            {draft.trim() && (
              <button onClick={clear} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 5, border: "1px solid hsl(var(--border))", background: "none", color: "var(--muted-foreground)", cursor: "pointer" }}>
                Clear
              </button>
            )}
            <button onClick={save} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 5, border: "none", background: "hsl(var(--primary))", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
              Save ⌘↵
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MetricName =
  | "QF Calls Booked"
  | "Skool Joins"
  | "Skool Bookings DM Setter"
  | "Skool Booking %"
  | "Skool Bookings Post"
  | "Skool Bookings Classroom"
  | "Email Bookings"
  | "Welcome Sequence Email Bookings"
  | "Website Visitors (Active Users)"
  | "Website Bookings (Total)"
  | "Website Booking %"
  | "Google Bookings"
  | "Webinar Bookings";

const AUTO_CALC = new Set<MetricName>(["Skool Booking %", "Website Booking %"]);
const PCT_FORMAT = new Set<MetricName>(["Skool Booking %", "Website Booking %"]);

// ─── Layout constants ─────────────────────────────────────────────────────────

const W_METRIC = 220;
const W_TARGET = 72;
const W_AVG    = 72;
const W_DAY    = 50;

const L_METRIC = 0;
const L_TARGET = W_METRIC;
const L_AVG    = W_METRIC + W_TARGET;

// Shared border tokens — use CSS vars for theme awareness
const B_ROW      = "1px solid hsl(var(--border) / 0.5)";
const B_FROZEN   = "1px solid hsl(var(--border))";
const B_PANEL    = "2px solid hsl(var(--border))";
const B_SECTION  = "1px solid hsl(var(--border) / 0.7)";

// ─── Sections ─────────────────────────────────────────────────────────────────

interface Section {
  label: string;
  textColor: string;
  accentBorder: string;
  rowTint: string;
  headerTint: string;
  metrics: MetricName[];
  /** If true, collapse header + single metric into one styled row */
  inline?: boolean;
}

const SECTIONS: Section[] = [
  {
    label: "QF CALLS BOOKED",
    textColor: "#a78bfa",
    accentBorder: "3px solid rgba(139,92,246,0.8)",
    rowTint: "rgba(139,92,246,0.14)",
    headerTint: "rgba(139,92,246,0.14)",
    metrics: ["QF Calls Booked"],
    inline: true,
  },
  {
    label: "Skool",
    textColor: "#fbbf24",
    accentBorder: "3px solid rgba(245,158,11,0.8)",
    rowTint: "rgba(245,158,11,0.04)",
    headerTint: "rgba(245,158,11,0.14)",
    metrics: [
      "Skool Joins",
      "Skool Bookings DM Setter",
      "Skool Booking %",
      "Skool Bookings Post",
      "Skool Bookings Classroom",
    ],
  },
  {
    label: "Email",
    textColor: "#60a5fa",
    accentBorder: "3px solid rgba(59,130,246,0.8)",
    rowTint: "rgba(59,130,246,0.04)",
    headerTint: "rgba(59,130,246,0.14)",
    metrics: ["Email Bookings", "Welcome Sequence Email Bookings"],
  },
  {
    label: "Website",
    textColor: "#f472b6",
    accentBorder: "3px solid rgba(236,72,153,0.8)",
    rowTint: "rgba(236,72,153,0.04)",
    headerTint: "rgba(236,72,153,0.14)",
    metrics: [
      "Website Visitors (Active Users)",
      "Website Bookings (Total)",
      "Website Booking %",
    ],
  },
  {
    label: "Google & Webinar",
    textColor: "#fb923c",
    accentBorder: "3px solid rgba(249,115,22,0.8)",
    rowTint: "rgba(249,115,22,0.04)",
    headerTint: "rgba(249,115,22,0.14)",
    metrics: ["Google Bookings", "Webinar Bookings"],
  },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Storage ──────────────────────────────────────────────────────────────────

const NOTE_CHANNELS = [
  { key: "notes", label: "Notes" },
  { key: "video", label: "Videos Published" },
  { key: "email", label: "Emails Sent" },
  { key: "social", label: "Socials Posted" },
];

interface DayData { note: string; socialUrls?: string[]; values: Partial<Record<MetricName, string>>; }
interface TrackerState { days: Record<string, DayData>; targets: Partial<Record<MetricName, string>>; }

const COMPASS_URL = import.meta.env.VITE_COMPASS_SUPABASE_URL;
const COMPASS_KEY = import.meta.env.VITE_COMPASS_SUPABASE_ANON_KEY;

async function loadStateFromSupabase(y: number, m: number): Promise<TrackerState> {
  const mm = `${y}-${String(m + 1).padStart(2, "0")}`;
  try {
    const res = await fetch(
      `${COMPASS_URL}/rest/v1/booking_tracker?month=eq.${mm}&select=*`,
      { headers: { apikey: COMPASS_KEY, Authorization: `Bearer ${COMPASS_KEY}` } }
    );
    if (!res.ok) return { days: {}, targets: {} };
    const rows: { type: string; day_date: string | null; metric: string | null; value: string | null; social_urls: string[] | null }[] = await res.json();

    const state: TrackerState = { days: {}, targets: {} };
    for (const row of rows) {
      if (row.type === "target" && row.metric && row.metric !== "__none__") {
        state.targets[row.metric as MetricName] = row.value ?? "";
      } else if (row.type === "note" && row.day_date && row.day_date !== "1970-01-01") {
        const day = row.day_date;
        if (!state.days[day]) state.days[day] = { note: "", values: {} };
        state.days[day].note = row.value ?? "";
      } else if (row.type === "social" && row.day_date && row.day_date !== "1970-01-01") {
        const day = row.day_date;
        if (!state.days[day]) state.days[day] = { note: "", values: {} };
        state.days[day].socialUrls = row.social_urls ?? [];
      }
    }
    return state;
  } catch {
    return { days: {}, targets: {} };
  }
}

async function upsertTracker(month: string, type: string, metric: string | null, dayDate: string | null, value: string | null, socialUrls: string[] | null) {
  // Use sentinel values for NULLs so the unique constraint works
  const metricVal = metric ?? "__none__";
  const dayVal = dayDate ?? "1970-01-01";

  // Try update first, then insert if no match
  const filter = `month=eq.${month}&type=eq.${type}&metric=eq.${metricVal}&day_date=eq.${dayVal}`;
  const body: Record<string, unknown> = {
    value, social_urls: socialUrls, updated_at: new Date().toISOString(),
  };

  const updateRes = await fetch(`${COMPASS_URL}/rest/v1/booking_tracker?${filter}`, {
    method: "PATCH",
    headers: {
      apikey: COMPASS_KEY,
      Authorization: `Bearer ${COMPASS_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  const updated = await updateRes.json();
  if (Array.isArray(updated) && updated.length === 0) {
    // No existing row — insert
    await fetch(`${COMPASS_URL}/rest/v1/booking_tracker`, {
      method: "POST",
      headers: {
        apikey: COMPASS_KEY,
        Authorization: `Bearer ${COMPASS_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        month, type, metric: metricVal, day_date: dayVal, value, social_urls: socialUrls, updated_at: new Date().toISOString(),
      }),
    });
  }
}
function getDaysInMonth(y: number, m: number): Date[] {
  const out: Date[] = []; const d = new Date(y, m, 1);
  while (d.getMonth() === m) { out.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return out;
}
function toISO(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingKPITracker() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const isDark = document.documentElement.classList.contains("dark");
  const [bg, setBg]       = useState(isDark ? "#212121" : "#ffffff");
  const [state, setState] = useState<TrackerState>({ days: {}, targets: {} });

  const days  = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const today = toISO(now);

  // Fetch booking data from Supabase for the displayed month
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const supabaseFrom = useMemo(() => new Date(Date.UTC(year, month, 1)).toISOString(), [year, month]);
  const supabaseTo = useMemo(() => new Date(Date.UTC(year, month + 1, 0, 23, 59, 59)).toISOString(), [year, month]);
  const bookingData = useSupabaseMetrics(supabaseFrom, supabaseTo);

  // Map metric names to source-level data from the cube
  // Source qualified = total_bookings - casey_cancelled per day
  // Fetch Skool joins per day — cached in React state (useRef) across month switches
  const skoolCache = useRef<Record<string, Record<string, number>>>({});
  const [skoolJoinsByDate, setSkoolJoinsByDate] = useState<Record<string, number>>({});
  const [skoolLoading, setSkoolLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const mm = String(month + 1).padStart(2, "0");
    const cacheKey = `${year}-${mm}`;

    // Use in-memory cache if available
    if (skoolCache.current[cacheKey] && Object.keys(skoolCache.current[cacheKey]).length > 0) {
      setSkoolJoinsByDate(skoolCache.current[cacheKey]);
      setSkoolLoading(false);
      // Past months: don't refetch
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      if (cacheKey !== currentMonth) return;
    } else {
      setSkoolJoinsByDate({});
      setSkoolLoading(true);
    }

    const SKOOL_BASE = "/api/skool-supabase";
    const TABLE = "Skool%20Lead%20Logs";
    const COL = "%22Date%20Added%22";

    async function fetchSkoolMonth() {
      const result: Record<string, number> = {};
      const daysInMo = new Date(year, month + 1, 0).getDate();
      const isCurrentMo = year === now.getFullYear() && month === now.getMonth();
      const maxDay = isCurrentMo ? now.getDate() : daysInMo;

      // Fetch in weekly chunks with NZ timezone overlap.
      // Timestamps are UTC but we need NZ calendar dates, so extend boundaries
      // by 13 hours (max NZ offset) and bucket by NZ date.
      const CHUNK_DAYS = 2;
      for (let startDay = 1; startDay <= maxDay; startDay += CHUNK_DAYS) {
        if (cancelled) break;
        const endDay = Math.min(startDay + CHUNK_DAYS, maxDay + 1);
        // Extend start 13h earlier and end 13h later to capture NZ timezone overlap
        const chunkStartDate = new Date(Date.UTC(year, month, startDay) - 13 * 3600000);
        const chunkEndDate = new Date(Date.UTC(year, month, endDay) - 11 * 3600000);
        const chunkStart = chunkStartDate.toISOString();
        const chunkEnd = chunkEndDate.toISOString();
        try {
          const res = await fetch(`${SKOOL_BASE}/rest/v1/${TABLE}?select=${COL}&${COL}=gte.${chunkStart}&${COL}=lt.${chunkEnd}&limit=5000`);
          if (res.ok) {
            const rows: { "Date Added": string }[] = await res.json();
            for (const row of rows) {
              // Bucket by NZ date
              const nzDate = new Date(row["Date Added"]).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
              // Only count if within the chunk's NZ day range
              const nzDay = parseInt(nzDate.split("-")[2]);
              if (nzDay >= startDay && nzDay < endDay && nzDate.startsWith(`${year}-${mm}`)) {
                result[nzDate] = (result[nzDate] || 0) + 1;
              }
            }
          }
        } catch {}
        await new Promise(r => setTimeout(r, 200));
      }

      if (!cancelled) {
        if (Object.keys(result).length > 0) {
          skoolCache.current[cacheKey] = result;
          setSkoolJoinsByDate(result);
        }
        setSkoolLoading(false);
      }
    }

    fetchSkoolMonth();
    return () => { cancelled = true; };
  }, [year, month]);

  // Fetch GA4 active users per day for the displayed month
  const [ga4ActiveByDate, setGa4ActiveByDate] = useState<Record<string, number>>({});
  useEffect(() => {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    fetchDailyActiveUsers(startDate, endDate)
      .then(rows => {
        const map: Record<string, number> = {};
        for (const r of rows) map[r.date] = r.activeUsers;
        setGa4ActiveByDate(map);
      })
      .catch(() => setGa4ActiveByDate({}));
  }, [year, month]);

  const METRIC_SOURCE_MAP: Record<string, { type: "source"; sources: string[] } | { type: "event"; events: string[] } | { type: "allSources" } | { type: "cube"; category: string; metric: string } | { type: "skoolJoins" } | { type: "ga4ActiveUsers" } | { type: "sourceOrEvent"; sources: string[]; events: string[] }> = useMemo(() => ({
    "QF Calls Booked": { type: "allSources" },
    "Skool Joins": { type: "skoolJoins" as const },
    "Skool Bookings DM Setter": { type: "source", sources: ["source_skool setter"] },
    "Skool Bookings Post": { type: "event", events: ["AAA Accelerator Business Call (Skool P)"] },
    "Skool Bookings Classroom": { type: "source", sources: ["source_skool classroom"] },
    "Email Bookings": { type: "source", sources: ["source_email general"] },
    "Welcome Sequence Email Bookings": { type: "source", sources: ["source_email welcome"] },
    "Website Visitors (Active Users)": { type: "ga4ActiveUsers" as const },
    "Website Bookings (Total)": { type: "source", sources: ["source_website", "source_website b", "source_website c"] },
    "Google Bookings": { type: "sourceOrEvent", sources: ["source_google"], events: ["AAA Accelerator Business Call (Google)"] },
    "Webinar Bookings": { type: "sourceOrEvent", sources: ["source_aios lp"], events: ["AAA Accelerator Business Call (Masterclass)"] },
  }), []);

  function getApiValue(date: string, metric: MetricName): number | null {
    const mapping = METRIC_SOURCE_MAP[metric];
    if (!mapping || bookingData.isLoading) return null;
    const cube = bookingData.cube;

    switch (mapping.type) {
      case "source": {
        let total = 0;
        for (const src of mapping.sources) {
          const totalBk = cube[date]?.[src]?.total_bookings ?? 0;
          const casey = cube[date]?.[src]?.casey_cancelled ?? 0;
          total += totalBk - casey;
        }
        return total;
      }
      case "event": {
        let total = 0;
        for (const ev of mapping.events) {
          total += cube[date]?.[`event_${ev}`]?.qualified ?? 0;
        }
        return total;
      }
      case "allSources": {
        let total = 0;
        for (const cat of Object.keys(cube[date] ?? {})) {
          if (cat.startsWith("source_")) {
            const totalBk = cube[date]?.[cat]?.total_bookings ?? 0;
            const casey = cube[date]?.[cat]?.casey_cancelled ?? 0;
            total += totalBk - casey;
          }
        }
        return total;
      }
      case "cube":
        return cube[date]?.[mapping.category]?.[mapping.metric] ?? null;
      case "skoolJoins":
        return skoolJoinsByDate[date] ?? null;
      case "ga4ActiveUsers":
        return ga4ActiveByDate[date] ?? null;
      case "sourceOrEvent": {
        // Try source-level first, fall back to event-level
        let total = 0;
        let hasSource = false;
        for (const src of mapping.sources) {
          const totalBk = cube[date]?.[src]?.total_bookings;
          if (totalBk !== undefined) {
            hasSource = true;
            const casey = cube[date]?.[src]?.casey_cancelled ?? 0;
            total += totalBk - casey;
          }
        }
        if (hasSource) return total;
        // Fall back to event-level qualified
        for (const ev of mapping.events) {
          total += cube[date]?.[`event_${ev}`]?.qualified ?? 0;
        }
        return total;
      }
    }
  }

  // Fetch published videos from liam_videos Supabase table (no YouTube API needed)
  const [videos, setVideos] = useState<VideoItem[]>([]);
  useEffect(() => {
    const mm = String(month + 1).padStart(2, "0");
    const monthStart = `${year}-${mm}-01T00:00:00Z`;
    const monthEnd = month === 11
      ? `${year + 1}-01-01T00:00:00Z`
      : `${year}-${String(month + 2).padStart(2, "0")}-01T00:00:00Z`;

    const COMPASS_URL = import.meta.env.VITE_COMPASS_SUPABASE_URL;
    const COMPASS_KEY = import.meta.env.VITE_COMPASS_SUPABASE_ANON_KEY;

    fetch(`${COMPASS_URL}/rest/v1/liam_videos?select=video_id,video_title,published_at&published_at=gte.${monthStart}&published_at=lt.${monthEnd}&order=published_at.desc`, {
      headers: {
        apikey: COMPASS_KEY,
        Authorization: `Bearer ${COMPASS_KEY}`,
      },
    })
      .then(r => r.ok ? r.json() : [])
      .then((rows: { video_id: string; video_title: string; published_at: string }[]) => {
        setVideos(rows.map(r => ({
          id: r.video_id,
          title: r.video_title,
          publishedAt: r.published_at,
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
        })));
      })
      .catch(() => setVideos([]));
  }, [year, month]);

  // Map videos by publish date (UTC date from Supabase)
  const videosByDate = useMemo(() => {
    const map: Record<string, VideoItem[]> = {};
    for (const v of videos) {
      const date = v.publishedAt.substring(0, 10);
      if (!map[date]) map[date] = [];
      map[date].push(v);
    }
    return map;
  }, [videos]);

  // Fetch Kit broadcasts for the displayed month
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  useEffect(() => {
    const monthStart = new Date(Date.UTC(year, month, 1)).toISOString();
    const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59)).toISOString();
    fetchBroadcastsInRange(monthStart, monthEnd)
      .then(r => setBroadcasts(r.broadcasts))
      .catch(() => setBroadcasts([]));
  }, [year, month]);

  // Map broadcasts by send date (NZ time)
  const broadcastsByDate = useMemo(() => {
    const map: Record<string, BroadcastItem[]> = {};
    for (const b of broadcasts) {
      const nzDate = new Date(b.sentAt).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
      if (!map[nzDate]) map[nzDate] = [];
      map[nzDate].push(b);
    }
    return map;
  }, [broadcasts]);

  // Observe theme changes and update frozen sidebar bg
  useEffect(() => {
    function updateBg() {
      const dark = document.documentElement.classList.contains("dark");
      setBg(dark ? "#212121" : "#ffffff");
    }
    updateBg();
    const observer = new MutationObserver(updateBg);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Load from Supabase when month changes
  useEffect(() => {
    loadStateFromSupabase(year, month).then(setState);
  }, [year, month]);

  const mm = `${year}-${String(month + 1).padStart(2, "0")}`;

  function getDayData(d: Date): DayData { return state.days[toISO(d)] ?? { note: "", values: {} }; }

  function updateNote(d: Date, note: string) {
    const iso = toISO(d);
    setState(p => ({ ...p, days: { ...p.days, [iso]: { ...getDayData(d), note } } }));
    if (note.trim()) {
      upsertTracker(mm, "note", null, iso, note, null);
    } else {
      // Delete the row when clearing
      fetch(`${COMPASS_URL}/rest/v1/booking_tracker?month=eq.${mm}&type=eq.note&metric=eq.__none__&day_date=eq.${iso}`, {
        method: "DELETE",
        headers: { apikey: COMPASS_KEY, Authorization: `Bearer ${COMPASS_KEY}` },
      });
    }
  }
  function addSocialUrl(d: Date, url: string) {
    const iso = toISO(d);
    const cur = getDayData(d);
    const urls = [...(cur.socialUrls || []), url];
    setState(p => ({ ...p, days: { ...p.days, [iso]: { ...cur, socialUrls: urls } } }));
    upsertTracker(mm, "social", null, iso, null, urls);
  }
  function removeSocialUrl(d: Date, index: number) {
    const iso = toISO(d);
    const cur = getDayData(d);
    const urls = (cur.socialUrls || []).filter((_, i) => i !== index);
    setState(p => ({ ...p, days: { ...p.days, [iso]: { ...cur, socialUrls: urls } } }));
    upsertTracker(mm, "social", null, iso, null, urls);
  }
  function updateValue(d: Date, metric: MetricName, value: string) {
    const cur = getDayData(d);
    setState(p => ({ ...p, days: { ...p.days, [toISO(d)]: { ...cur, values: { ...cur.values, [metric]: value } } } }));
  }
  function updateTarget(metric: MetricName, value: string) {
    setState(p => ({ ...p, targets: { ...p.targets, [metric]: value } }));
    upsertTracker(mm, "target", metric, null, value, null);
  }

  // Helper to get the effective value for a metric on a day (API or localStorage)
  function getEffectiveValue(d: Date, metric: MetricName): number | null {
    const iso = toISO(d);
    if (METRIC_SOURCE_MAP[metric]) {
      const api = getApiValue(iso, metric);
      if (api !== null) return api;
    }
    const n = parseFloat(getDayData(d).values[metric] ?? "");
    return isNaN(n) ? null : n;
  }

  function getComputed(d: Date, metric: MetricName): number | null {
    if (metric === "Skool Booking %") {
      const dm = getEffectiveValue(d, "Skool Bookings DM Setter") ?? 0;
      const post = getEffectiveValue(d, "Skool Bookings Post") ?? 0;
      const classroom = getEffectiveValue(d, "Skool Bookings Classroom") ?? 0;
      const totalBookings = dm + post + classroom;
      const j = getEffectiveValue(d, "Skool Joins");
      return (j !== null && j > 0) ? (totalBookings / j) * 100 : null;
    }
    if (metric === "Website Booking %") {
      const b = getEffectiveValue(d, "Website Bookings (Total)");
      const vis = getEffectiveValue(d, "Website Visitors (Active Users)");
      return (b !== null && vis !== null && vis > 0) ? (b / vis) * 100 : null;
    }
    return getEffectiveValue(d, metric);
  }

  function fmtVal(val: number | null, metric: MetricName): string {
    if (val === null) return "";
    return PCT_FORMAT.has(metric) ? val.toFixed(2) + "%" : (Number.isInteger(val) ? String(val) : val.toFixed(2));
  }

  function cellStyle(val: number | null, metric: MetricName): React.CSSProperties {
    if (val === null) return {};
    const t = parseFloat(state.targets[metric] ?? ""); if (isNaN(t)) return {};
    return val >= t
      ? { background: "rgba(16,185,129,0.2)", color: "#34d399", fontWeight: 600 }
      : { background: "rgba(239,68,68,0.2)",  color: "#f87171", fontWeight: 600 };
  }

  function getAvg(metric: MetricName): string {
    const vals = days
      .filter(d => d <= now) // Only include days up to today
      .map(d => {
        // Prefer API data
        if (METRIC_SOURCE_MAP[metric]) {
          const api = getApiValue(toISO(d), metric);
          if (api !== null) return api;
        }
        return getComputed(d, metric);
      }).filter((v): v is number => v !== null);
    if (!vals.length) return "—";
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return PCT_FORMAT.has(metric) ? avg.toFixed(2) + "%" : (Number.isInteger(avg) ? String(avg) : avg.toFixed(2));
  }

  function prevMonth() { month === 0 ? (setYear(y => y-1), setMonth(11)) : setMonth(m => m-1); }
  function nextMonth() { month === 11 ? (setYear(y => y+1), setMonth(0)) : setMonth(m => m+1); }

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // ── Sticky style helpers — all use the resolved solid bg ──────────────────

  const S = {
    metric: (extra: React.CSSProperties = {}): React.CSSProperties => {
      const { backgroundColor: _, ...rest } = extra;
      return { position: "sticky", left: L_METRIC, zIndex: 10, backgroundColor: bg,
        width: W_METRIC, minWidth: W_METRIC,
        borderRight: B_FROZEN, borderBottom: B_ROW, ...rest };
    },
    target: (extra: React.CSSProperties = {}): React.CSSProperties => {
      const { backgroundColor: _, ...rest } = extra;
      return { position: "sticky", left: L_TARGET, zIndex: 10, backgroundColor: bg,
        width: W_TARGET, minWidth: W_TARGET,
        borderRight: B_FROZEN, borderBottom: B_ROW, ...rest };
    },
    avg: (extra: React.CSSProperties = {}): React.CSSProperties => {
      const { backgroundColor: _, ...rest } = extra;
      return { position: "sticky", left: L_AVG, zIndex: 10, backgroundColor: bg,
        width: W_AVG, minWidth: W_AVG,
        borderRight: B_PANEL, borderBottom: B_ROW,
        boxShadow: "4px 0 10px rgba(0,0,0,0.35)", ...rest };
    },
  };

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors">
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground min-w-[150px] text-center">{monthLabel}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Table — border-separate is REQUIRED for sticky + visible borders */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>

          <thead>
            <tr>
              <th style={{ ...S.metric({ borderBottom: B_FROZEN }), padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Metric
              </th>
              <th style={{ ...S.target({ borderBottom: B_FROZEN }), padding: "10px 8px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "hsl(var(--primary))", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Target
              </th>
              <th style={{ ...S.avg({ borderBottom: B_FROZEN }), padding: "10px 8px", textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Avg/Day
              </th>
              {days.map(d => {
                const iso = toISO(d), isToday = iso === today;
                return (
                  <th key={iso} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: B_FROZEN, padding: "6px 4px", textAlign: "center", backgroundColor: isToday ? "rgba(99,102,241,0.15)" : undefined }}>
                    <div style={{ fontSize: 9, color: "var(--muted-foreground)" }}>{DAY_NAMES[d.getDay()]}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? "hsl(var(--primary))" : "var(--foreground)" }}>{d.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {/* Channel activity rows */}
            {NOTE_CHANNELS.map((ch, ci) => (
              <tr key={ch.key}>
                <td style={{ ...S.metric({ borderBottom: ci === NOTE_CHANNELS.length - 1 ? B_SECTION : B_ROW }), padding: "8px 16px", fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>
                  {ch.label}
                </td>
                <td style={{ ...S.target({ borderBottom: ci === NOTE_CHANNELS.length - 1 ? B_SECTION : B_ROW }) }} />
                <td style={{ ...S.avg({ borderBottom: ci === NOTE_CHANNELS.length - 1 ? B_SECTION : B_ROW }) }} />
                {days.map(d => {
                  const iso = toISO(d);
                  const dayVideos = ch.key === "video" ? (videosByDate[iso] || []) : [];
                  return (
                    <td key={iso} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: ci === NOTE_CHANNELS.length - 1 ? B_SECTION : B_ROW, padding: ch.key === "notes" ? 2 : 0, textAlign: "center", verticalAlign: "middle", backgroundColor: iso === today ? "rgba(99,102,241,0.08)" : undefined }}>
                      {ch.key === "notes" && (
                        <NotePopover
                          date={d}
                          value={getDayData(d).note}
                          onChange={note => updateNote(d, note)}
                        />
                      )}
                      {ch.key === "video" && dayVideos.length > 0 && dayVideos.map((v, vi) => (
                        <a
                          key={vi}
                          href={`https://www.youtube.com/watch?v=${v.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title={v.title}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 36, background: "rgba(239,68,68,0.15)", color: "#ef4444", cursor: "pointer", textDecoration: "none" }}
                        >
                          <Play size={18} fill="#ef4444" />
                        </a>
                      ))}
                      {ch.key === "social" && (() => {
                        const urls = getDayData(d).socialUrls || [];
                        return (
                          <div
                            style={{ display: "flex", flexDirection: "column", width: "100%", minHeight: 36, cursor: "pointer" }}
                            onClick={() => {
                              const url = prompt("Paste social post URL:");
                              if (url?.trim()) addSocialUrl(d, url.trim());
                            }}
                          >
                            {urls.map((url, ui) => (
                              <a
                                key={ui}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                title={url}
                                onClick={(e) => e.stopPropagation()}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  if (confirm("Remove this social link?")) removeSocialUrl(d, ui);
                                }}
                                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 36, background: "rgba(250,204,21,0.15)", color: "#facc15", cursor: "pointer", textDecoration: "none", borderBottom: ui < urls.length - 1 ? "1px solid rgba(250,204,21,0.2)" : "none" }}
                              >
                                <MessageCircle size={18} fill="#facc15" />
                              </a>
                            ))}
                          </div>
                        );
                      })()}
                      {ch.key === "email" && (broadcastsByDate[iso] || []).map((b, bi) => (
                        <a
                          key={bi}
                          href={b.publicationId ? `https://app.kit.com/publications/${b.publicationId}/reports/overview` : `https://app.kit.com/broadcasts`}
                          target="_blank"
                          rel="noreferrer"
                          title={b.subject}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 36, background: "rgba(59,130,246,0.15)", color: "#3b82f6", cursor: "pointer", textDecoration: "none" }}
                        >
                          <Mail size={18} />
                        </a>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Sections */}
            {SECTIONS.map((section, si) => (
              <React.Fragment key={section.label}>

                {/* Section header row — skip for inline sections */}
                {!section.inline && (
                <tr>
                  <td style={{
                    ...S.metric({ borderLeft: section.accentBorder, borderBottom: B_SECTION, borderTop: si === 0 ? "none" : B_SECTION }),
                    padding: "6px 14px",
                    fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                    color: section.textColor,
                  }}>
                    {section.label}
                  </td>
                  <td style={{ ...S.target({ borderBottom: B_SECTION, borderTop: si === 0 ? "none" : B_SECTION, backgroundColor: section.headerTint }) }} />
                  <td style={{ ...S.avg({ borderBottom: B_SECTION, borderTop: si === 0 ? "none" : B_SECTION, backgroundColor: section.headerTint }) }} />
                  {days.map(d => (
                    <td key={toISO(d)} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: B_SECTION, backgroundColor: section.headerTint }} />
                  ))}
                </tr>
                )}

                {/* Metric rows */}
                {section.metrics.map((metric, mi) => {
                  const isAuto = AUTO_CALC.has(metric);
                  const isLastRow = mi === section.metrics.length - 1;
                  const rowBorderBottom = isLastRow ? B_SECTION : B_ROW;

                  return (
                    <tr key={metric}>
                      {/* Metric name */}
                      <td style={{
                        ...S.metric({ borderLeft: section.accentBorder, borderBottom: rowBorderBottom, borderTop: section.inline && si > 0 ? B_SECTION : undefined }),
                        padding: section.inline ? "8px 14px" : "8px 14px",
                        fontSize: section.inline ? 14 : 13, fontWeight: section.inline ? 700 : 500,
                        color: section.inline ? section.textColor : "var(--foreground)", whiteSpace: "nowrap",
                      }}>
                        {section.inline ? section.label : metric}
                      </td>

                      {/* Target */}
                      <td style={{ ...S.target({ borderBottom: rowBorderBottom }), padding: 4 }}>
                        <input
                          type="text" inputMode="decimal"
                          value={state.targets[metric] ?? ""}
                          onChange={e => updateTarget(metric, e.target.value)}
                          style={{ width: "100%", background: "transparent", border: "1px solid transparent", borderRadius: 4, textAlign: "center", fontSize: 12, fontFamily: "monospace", color: "hsl(var(--primary))", fontWeight: 600, padding: "4px 4px", outline: "none" }}
                          placeholder="—"
                          onFocus={e => (e.currentTarget.style.borderColor = "hsl(var(--primary))")}
                          onBlur={e => (e.currentTarget.style.borderColor = "transparent")}
                        />
                      </td>

                      {/* Avg */}
                      <td style={{ ...S.avg({ borderBottom: rowBorderBottom }), padding: "8px", textAlign: "center", fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: "var(--foreground)" }}>
                        {getAvg(metric)}
                      </td>

                      {/* Day cells */}
                      {days.map(d => {
                        const iso     = toISO(d);
                        const isToday = iso === today;
                        const computed = getComputed(d, metric);
                        const cs       = cellStyle(computed, metric);
                        const todayBg  = "rgba(99,102,241,0.1)";
                        // Show loading dots for Skool Joins while fetching
                        const isSkoolMetric = metric === "Skool Joins";
                        if (isSkoolMetric && skoolLoading && d <= now) {
                          return (
                            <td key={iso} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: rowBorderBottom, padding: 2, backgroundColor: isToday ? todayBg : section.rowTint }}>
                              <span style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 24 }}>
                                <LoadingDots className="scale-50" />
                              </span>
                            </td>
                          );
                        }

                        const apiVal   = METRIC_SOURCE_MAP[metric] ? getApiValue(iso, metric) : null;
                        const hasApi   = apiVal !== null && apiVal > 0;

                        if (isAuto || hasApi) {
                          const displayVal = isAuto ? computed : apiVal;
                          const displayCs  = isAuto ? cs : cellStyle(displayVal, metric);
                          return (
                            <td key={iso} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: rowBorderBottom, padding: 2, backgroundColor: isToday ? todayBg : section.rowTint }}>
                              <span style={{ display: "block", borderRadius: 4, padding: "4px 2px", textAlign: "center", fontSize: 11, fontFamily: "monospace", color: displayVal !== null ? undefined : "hsl(var(--muted-foreground) / 0.4)", ...displayCs }}>
                                {fmtVal(displayVal, metric)}
                              </span>
                            </td>
                          );
                        }

                        // Show API zero or null as empty for non-auto metrics with API mapping
                        if (METRIC_SOURCE_MAP[metric] && apiVal === 0) {
                          return (
                            <td key={iso} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: rowBorderBottom, padding: 2, backgroundColor: isToday ? todayBg : section.rowTint }}>
                              <span style={{ display: "block", borderRadius: 4, padding: "4px 2px", textAlign: "center", fontSize: 11, fontFamily: "monospace", color: "hsl(var(--muted-foreground) / 0.4)" }}>
                                0
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={iso} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: rowBorderBottom, padding: 2, backgroundColor: isToday ? todayBg : section.rowTint }}>
                            <input
                              type="text" inputMode="decimal"
                              value={getDayData(d).values[metric] ?? ""}
                              onChange={e => updateValue(d, metric, e.target.value)}
                              style={{ width: "100%", background: "transparent", border: "1px solid transparent", borderRadius: 4, textAlign: "center", fontSize: 11, fontFamily: "monospace", padding: "4px 2px", outline: "none", ...cs }}
                              placeholder=""
                              onFocus={e => (e.currentTarget.style.borderColor = "hsl(var(--primary))")}
                              onBlur={e => { if (!cs.color) e.currentTarget.style.borderColor = "transparent"; }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
        Data saved locally · Today highlighted · Green = on/above target · Red = below target · "auto" rows calculate automatically
      </p>
    </div>
  );
}
