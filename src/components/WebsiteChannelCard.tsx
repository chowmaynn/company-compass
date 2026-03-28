import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Globe, AlertTriangle } from "lucide-react";
import { useWebsiteABTest } from "@/hooks/use-website-ab-test";
import { fetchPageSessions } from "@/lib/google-analytics";
import { DateRangePicker as SharedDateRangePicker, type DateRangeValue } from "@/components/DateRangePicker";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="rounded-lg bg-primary/10 p-1.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function WebsiteChannelCard({ gaAuthed }: { gaAuthed: boolean }) {
  const [webRange, setWebRange] = useState<DateRangeValue>({ start: "", end: "", startDate: "", endDate: "" });

  const abTest = useWebsiteABTest(webRange.startDate, webRange.endDate, webRange.start, webRange.end);

  // GA4 views for selected range (deduplicated — no date dimension)
  const gaViewsQuery = useQuery({
    queryKey: ["ga4", "website-views-total", webRange.startDate, webRange.endDate],
    queryFn: () => fetchPageSessions(webRange.startDate, webRange.endDate),
    enabled: !!webRange.startDate && !!webRange.endDate,
    staleTime: 5 * 60 * 1000,
  });
  const totalWebViews = gaViewsQuery.data ?? 0;

  // Website bookings from Supabase (qualified, post-disqualification)
  const websiteBookings = abTest.totalWebsiteBookings;
  const bookingRate = totalWebViews > 0 && websiteBookings > 0
    ? ((websiteBookings / totalWebViews) * 100).toFixed(2) + "%"
    : "—";
  const gaLoading = gaViewsQuery.isLoading;

  const { variants, winner } = abTest;
  const variantEntries: { key: "A" | "B" | "C"; label: string; color: string }[] = [
    { key: "A", label: "Variant A", color: "text-blue-500" },
    { key: "B", label: "Variant B", color: "text-emerald-500" },
    { key: "C", label: "Variant C", color: "text-amber-500" },
  ];
  const maxRate = Math.max(...Object.values(variants).map((v) => v.conversionRate), 1);

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      {/* Header + date picker */}
      <div className="flex items-center justify-between">
        <SectionHeader icon={Globe} title="Website Channel" sub="aaaaccelerator.com" />
        <SharedDateRangePicker onChange={setWebRange} />
      </div>

      {!gaAuthed ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Connect Google in the top-right to see website analytics.
        </p>
      ) : gaLoading || abTest.loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {/* Aggregate metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Website Views</p>
              <p className="text-xl font-bold text-foreground">{fmt(totalWebViews)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Website Bookings</p>
              <p className="text-xl font-bold text-foreground">{fmt(websiteBookings)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Booking Rate</p>
              <p className="text-xl font-bold text-foreground">{bookingRate}</p>
            </div>
          </div>

          {/* A/B/C Test sub-section */}
          <div className="border border-border/50 rounded-lg p-4 space-y-4 bg-muted/10">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">A/B/C Test</p>
            {abTest.variants.B.bookings === 0 && abTest.variants.C.bookings === 0 && !abTest.loading && (
              <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Website B and C not yet set up in Supabase
              </p>
            )}

            {abTest.loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading variant data…
              </div>
            ) : abTest.error ? (
              <p className="text-sm text-red-500 py-4">{abTest.error}</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {variantEntries.map(({ key, label, color }) => {
                    const v = variants[key];
                    const isWinner = winner === key;
                    return (
                      <div
                        key={key}
                        className={`rounded-lg p-3 space-y-2 ${
                          isWinner
                            ? "bg-emerald-500/10 border border-emerald-500/30"
                            : "bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-semibold uppercase tracking-wider ${color}`}>
                            {label}
                          </p>
                          {isWinner && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                              WINNER
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-foreground">
                            {v.conversionRate.toFixed(2)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">conversion rate</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{fmt(v.visitors)}</p>
                            <p className="text-[10px] text-muted-foreground">visitors</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{fmt(v.bookings)}</p>
                            <p className="text-[10px] text-muted-foreground">bookings</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Conversion rate bars */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Conversion Rate Comparison</p>
                  {variantEntries.map(({ key, label, color }) => {
                    const rate = variants[key].conversionRate;
                    const barColors: Record<string, string> = { A: "bg-blue-500", B: "bg-emerald-500", C: "bg-amber-500" };
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className={`text-xs font-medium w-16 ${color}`}>{label}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColors[key]}`}
                            style={{ width: `${(rate / maxRate) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-foreground w-14 text-right">
                          {rate.toFixed(2)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
