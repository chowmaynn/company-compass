import { useCircle } from "@/hooks/use-circle";
import { useTallyNps, type NpsResult } from "@/hooks/use-tally-nps";
import { scorecardData } from "@/data/scorecardData";
import { Loader2, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────
function ft(iso: string) { return new Date(iso).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" }); }
function fd(iso: string) { return new Date(iso).toLocaleDateString("en-NZ", { month: "short", day: "numeric" }); }

// ── Glassmorphism card ────────────────────────────────────────
function G({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`border border-white/[0.07] ${className}`}
      style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", ...style }}
    >
      {children}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.2em] mb-2">{children}</p>;
}

// ── NPS breakdown card ────────────────────────────────────────
function NpsCard({ r }: { r: NpsResult }) {
  const total = r.promoters + r.passives + r.detractors || 1;
  const pPct  = (r.promoters  / total) * 100;
  const paPct = (r.passives   / total) * 100;
  const dPct  = (r.detractors / total) * 100;
  const color = r.score >= 50 ? "text-emerald-400" : r.score >= 0 ? "text-amber-400" : "text-rose-400";
  const label = r.formName.replace("NPS Score Tracking - ", "").replace("NPS Score Tracking", "");

  return (
    <G className="flex flex-col overflow-hidden">
      {/* Score header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Net Promoter Score</p>
          <p className="text-xs text-white/50 mt-0.5">{label.trim()} · {r.totalResponses} responses</p>
        </div>
        <span className={`text-5xl font-black tracking-tighter tabular-nums ${color}`}>
          {r.score > 0 ? "+" : ""}{r.score}
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-1" style={{ gap: 1 }}>
        <div style={{ width: `${pPct}%`,  background: "#34d399" }} />
        <div style={{ width: `${paPct}%`, background: "#fbbf24" }} />
        <div style={{ width: `${dPct}%`,  background: "#f87171" }} />
      </div>

      {/* Breakdown row */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
        {[
          { key: "Promoters",  n: r.promoters,  pct: pPct,  c: "text-emerald-400", bg: "bg-emerald-400/10" },
          { key: "Passives",   n: r.passives,   pct: paPct, c: "text-amber-400",   bg: "bg-amber-400/10" },
          { key: "Detractors", n: r.detractors, pct: dPct,  c: "text-rose-400",    bg: "bg-rose-400/10" },
        ].map((s) => (
          <div key={s.key} className={`flex flex-col items-center py-4 ${s.bg}`}>
            <span className={`text-2xl font-black tabular-nums ${s.c}`}>{s.n}</span>
            <span className="text-[9px] font-bold text-white/30 uppercase mt-0.5">{s.key}</span>
            <span className="text-[10px] text-white/20 mt-0.5">{Math.round(s.pct)}%</span>
          </div>
        ))}
      </div>
    </G>
  );
}

// ── KPI row ───────────────────────────────────────────────────
function KpiRow({ name, actual, target, status }: { name: string; actual: string | number; target: string | number; status: string }) {
  const good = status === "green" || status === "light-green";
  const warn = status === "yellow";
  const Icon = good ? TrendingUp : warn ? Minus : TrendingDown;
  const c    = good ? "text-emerald-400" : warn ? "text-amber-400" : "text-rose-400";
  const bg   = good ? "bg-emerald-400/10" : warn ? "bg-amber-400/10" : "bg-rose-400/10";

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors last:border-0">
      <div className={`h-6 w-6 flex items-center justify-center shrink-0 ${bg}`}>
        <Icon className={`h-3 w-3 ${c}`} />
      </div>
      <span className="flex-1 text-xs text-white/60 truncate">{name}</span>
      <span className="text-[10px] text-white/25 font-mono shrink-0">target {String(target)}</span>
      <span className={`text-xs font-black font-mono tabular-nums shrink-0 w-14 text-right ${c}`}>{String(actual)}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export function ProductDashboardV2() {
  const { totalMembers, newMembersThisMonth, totalPosts, upcomingEvents, recentMembers, isLoading } = useCircle();
  const { results: npsResults, loading: npsLoading } = useTallyNps();
  const metrics = scorecardData.filter(m => m.department === "Product");

  return (
    <div
      className="-mx-6 -mt-6 min-h-screen p-5 pb-12"
      style={{ background: "linear-gradient(160deg, #080810 0%, #0c0c18 60%, #080c10 100%)" }}
    >

      {/* ══ ROW 1 — four stat blocks ══════════════════════════ */}
      <div className="grid grid-cols-4 gap-px border border-white/[0.07] mb-3">
        {[
          { label: "Total Members",  value: totalMembers,        sub: "Circle.so" },
          { label: "New This Month", value: newMembersThisMonth, sub: "March 2026" },
          { label: "Community Posts",value: totalPosts,          sub: "All time" },
          { label: "Scored KPIs",    value: metrics.length,      sub: `${metrics.filter(m=>m.status==="green"||m.status==="light-green").length} on track` },
        ].map((s, i) => (
          <div key={i} className="bg-white/[0.04] px-6 py-5 flex flex-col gap-1 border-r border-white/[0.07] last:border-0">
            <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.18em]">{s.label}</span>
            <span className="text-4xl font-black text-white tracking-tighter tabular-nums">
              {s.value === null ? <Loader2 className="h-6 w-6 animate-spin text-white/20" /> : s.value?.toLocaleString()}
            </span>
            <span className="text-[11px] text-white/25">{s.sub}</span>
          </div>
        ))}
      </div>

      {/* ══ ROW 2 — NPS left · Events right ══════════════════ */}
      <div className="grid grid-cols-12 gap-3 mb-3">

        {/* NPS — left 7 cols */}
        <div className="col-span-12 lg:col-span-7 space-y-3">
          <Label>NPS — Tally Forms</Label>
          {npsLoading ? (
            <G className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-white/20" />
            </G>
          ) : npsResults.length === 0 ? (
            <G className="px-5 py-10 text-center text-xs text-white/25">No NPS forms connected</G>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {npsResults.map(r => <NpsCard key={r.formId} r={r} />)}
            </div>
          )}
        </div>

        {/* Events — right 5 cols */}
        <div className="col-span-12 lg:col-span-5 flex flex-col">
          <Label>Upcoming Events</Label>
          <G className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-white/20" /></div>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-xs text-white/25 text-center py-10">No upcoming events</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {upcomingEvents.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors group">
                    {/* Day number */}
                    <div className="text-center w-9 shrink-0">
                      <p className="text-[9px] font-bold text-white/20 uppercase">
                        {new Date(e.starts_at).toLocaleDateString("en-NZ", { month: "short" })}
                      </p>
                      <p className={`text-xl font-black leading-none ${i === 0 ? "text-white" : "text-white/50"}`}>
                        {new Date(e.starts_at).getDate()}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-white/[0.07] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/80 truncate">{e.name}</p>
                      <p className="text-[11px] text-white/30 mt-0.5">{ft(e.starts_at)} · {e.space?.name ?? e.host}</p>
                    </div>
                    <a href={e.url} target="_blank" rel="noreferrer"
                       className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <ExternalLink className="h-3.5 w-3.5 text-white/30 hover:text-white/60" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </G>
        </div>
      </div>

      {/* ══ ROW 3 — KPI scorecard full width ═════════════════ */}
      <div className="mb-3">
        <Label>Scorecard KPIs — Product</Label>
        <G className="overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 px-5 py-2.5 border-b border-white/[0.07] bg-white/[0.03]">
            <span className="col-span-1 text-[9px] font-bold text-white/20 uppercase tracking-wider" />
            <span className="col-span-7 text-[9px] font-bold text-white/20 uppercase tracking-wider">Metric</span>
            <span className="col-span-2 text-[9px] font-bold text-white/20 uppercase tracking-wider text-right">Target</span>
            <span className="col-span-2 text-[9px] font-bold text-white/20 uppercase tracking-wider text-right">Actual</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y divide-white/[0.05] md:divide-y-0">
            {metrics.map((m, i) => (
              <div key={m.name} className={i % 2 === 1 ? "border-l border-white/[0.05]" : ""}>
                <KpiRow name={m.name} actual={m.monthlyActual} target={m.monthlyTarget} status={m.status} />
              </div>
            ))}
          </div>
        </G>
      </div>

      {/* ══ ROW 4 — Members ══════════════════════════════════ */}
      <div>
        <Label>Recent New Members</Label>
        <G className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-white/20" /></div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recentMembers.map(m => (
                <a key={m.id} href={m.profile_url} target="_blank" rel="noreferrer"
                   className="flex items-center gap-2 px-3 py-2 border border-white/[0.07] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all shrink-0 group">
                  <div className="h-7 w-7 bg-white/10 flex items-center justify-center text-[11px] font-black text-white shrink-0">
                    {m.first_name?.[0]}{m.last_name?.[0]}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/70 whitespace-nowrap group-hover:text-white/90 transition-colors">
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="text-[9px] text-white/25">{fd(m.created_at)}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </G>
      </div>
    </div>
  );
}
