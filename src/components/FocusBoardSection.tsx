import React, { useState, useMemo, useRef, useEffect } from "react";
import { useFocusBoard } from "@/hooks/use-focus-board";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Target, RotateCcw, Plus, Trash2, Pencil, X, Star, CirclePlus, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { getCurrentWeekStart } from "@/hooks/use-focus-board";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { MicroExpander } from "@/components/ui/micro-expander";
import type { FocusItem, QuarterlyInitiative, NorthStarMetric, InitiativeStatus } from "@/lib/supabase-focus";

const INITIATIVE_STATUSES: InitiativeStatus[] = ["Not Started", "On-Track", "Behind", "Accomplished"];
const STATUS_COLORS: Record<InitiativeStatus, string> = {
  "Not Started": "bg-red-400",
  "On-Track": "bg-emerald-500",
  "Behind": "bg-amber-400",
  "Accomplished": "bg-blue-500",
};

const DEPARTMENTS = ["Finance", "Content", "Marketing", "Sales", "Product"];

const DEPT_COLORS: Record<string, string> = {
  Finance: "text-emerald-600",
  Content: "text-blue-600",
  Marketing: "text-pink-600",
  Sales: "text-amber-600",
  Product: "text-purple-600",
};

// ── Helpers ──────────────────────────────────────────────────

function displayName(email: string): string {
  const name = email.split("@")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function progressColor(completed: number, total: number): string {
  if (total === 0) return "bg-muted";
  const pct = completed / total;
  if (pct >= 1) return "bg-emerald-500";
  if (pct >= 0.5) return "bg-amber-400";
  return "bg-red-400";
}

// ── Multi-select dropdown ────────────────────────────────────

function MultiUserSelect({
  selected, onChange, users
}: {
  selected: string[];
  onChange: (val: string[]) => void;
  users: { user_id: string; user_email: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (email: string) => {
    onChange(selected.includes(email) ? selected.filter(s => s !== email) : [...selected, email]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground min-w-[140px] text-left truncate"
      >
        {selected.length > 0 ? selected.map(s => displayName(s)).join(", ") : "Stakeholders"}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px] max-h-[200px] overflow-y-auto">
          {users.map((u) => (
            <label key={u.user_id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={selected.includes(u.user_email)}
                onChange={() => toggle(u.user_email)}
                className="rounded"
              />
              {displayName(u.user_email)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(weekStart + "T12:00:00");
  d.setDate(d.getDate() + delta * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FocusBoardSection({ excludeCurrentUser = false }: { excludeCurrentUser?: boolean } = {}) {
  const { user, isAdmin } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekStart());

  const {
    foci, initiatives, northStars, teamUsers,
    rallyingCry, saveRallyingCry,
    weekLabel, isCurrentWeek, quarter,
    addFocus, editFocus, toggleComplete, removeFocus,
    addInitiative, editInitiative, removeInitiative,
    addNorthStar, editNorthStar, removeNorthStar,
    loading,
  } = useFocusBoard(selectedWeek);
  const userId = user?.id ?? "";

  // ── Focus item state ──
  const [showFocusForm, setShowFocusForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newInitiativeId, setNewInitiativeId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [editingFocusId, setEditingFocusId] = useState<string | null>(null);
  const [editingFocusTitle, setEditingFocusTitle] = useState("");

  // ── Initiative state ──
  const [showInitiativeForm, setShowInitiativeForm] = useState(false);
  const [newInitiativeTitle, setNewInitiativeTitle] = useState("");
  const [newInitiativeDept, setNewInitiativeDept] = useState<string>("");
  const [newInitiativeNorthStarId, setNewInitiativeNorthStarId] = useState<string>("");
  const [newInitiativeDueDate, setNewInitiativeDueDate] = useState<string>("");
  const [newInitiativeOwner, setNewInitiativeOwner] = useState<string>("");
  const [newInitiativeStakeholders, setNewInitiativeStakeholders] = useState<string[]>([]);
  const [filterInitiativeId, setFilterInitiativeId] = useState<string | null>(null);
  const [editingInitiativeId, setEditingInitiativeId] = useState<string | null>(null);
  const [editingInitiativeTitle, setEditingInitiativeTitle] = useState("");
  const [editingInitiativeDept, setEditingInitiativeDept] = useState<string>("");
  const [editingInitiativeDueDate, setEditingInitiativeDueDate] = useState<string>("");
  const [editingInitiativeOwner, setEditingInitiativeOwner] = useState<string>("");
  const [editingInitiativeStakeholders, setEditingInitiativeStakeholders] = useState<string[]>([]);
  const [editingInitiativeNorthStarId, setEditingInitiativeNorthStarId] = useState<string>("");

  // ── North Star state ──
  const [showNorthStarForm, setShowNorthStarForm] = useState(false);
  const [newNorthStarTitle, setNewNorthStarTitle] = useState("");
  const [newNorthStarDesc, setNewNorthStarDesc] = useState("");
  const [editingNorthStarId, setEditingNorthStarId] = useState<string | null>(null);
  const [editingNorthStarTitle, setEditingNorthStarTitle] = useState("");
  const [editingNorthStarDesc, setEditingNorthStarDesc] = useState("");

  // ── Rallying Cry state ──
  const [editingCry, setEditingCry] = useState(false);
  const [cryDraft, setCryDraft] = useState("");

  // ── Computed ──

  // Sort initiatives by due date (nulls last)
  const sortedInitiatives = useMemo(() => {
    return [...initiatives].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  }, [initiatives]);

  const initiativeMap = useMemo(() => {
    const m = new Map<string, QuarterlyInitiative>();
    for (const i of initiatives) m.set(i.id, i);
    return m;
  }, [initiatives]);

  const initiativeProgress = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    for (const i of initiatives) map.set(i.id, { total: 0, completed: 0 });
    for (const f of foci) {
      if (f.quarterly_initiative_id && map.has(f.quarterly_initiative_id)) {
        const p = map.get(f.quarterly_initiative_id)!;
        p.total++;
        if (f.completed) p.completed++;
      }
    }
    return map;
  }, [initiatives, foci]);

  const filteredFoci = useMemo(() => {
    if (!filterInitiativeId) return foci;
    return foci.filter((f) => f.quarterly_initiative_id === filterInitiativeId);
  }, [foci, filterInitiativeId]);

  const grouped = useMemo(() => {
    const map = new Map<string, { email: string; userId: string; items: FocusItem[] }>();
    for (const f of filteredFoci) {
      if (excludeCurrentUser && f.user_id === userId) continue;
      if (!map.has(f.user_id)) {
        map.set(f.user_id, { email: f.user_email, userId: f.user_id, items: [] });
      }
      map.get(f.user_id)!.items.push(f);
    }
    const groups = [...map.values()];
    groups.sort((a, b) => {
      if (a.userId === userId) return -1;
      if (b.userId === userId) return 1;
      return a.email.localeCompare(b.email);
    });
    return groups;
  }, [filteredFoci, userId, excludeCurrentUser]);

  // Group initiatives by north star
  const initiativesByNorthStar = useMemo(() => {
    const map = new Map<string | null, QuarterlyInitiative[]>();
    for (const i of initiatives) {
      const key = i.north_star_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return map;
  }, [initiatives]);

  // ── Handlers ──

  async function handleAddFocus() {
    if (!newTitle.trim()) return;
    const targetUser = assigneeId ? teamUsers.find((u) => u.user_id === assigneeId) : null;
    await addFocus(newTitle, newInitiativeId || null, targetUser?.user_id, targetUser?.user_email);
    setNewTitle("");
    setNewInitiativeId("");
    setShowFocusForm(false);
  }

  function startEditingInitiative(i: QuarterlyInitiative) {
    setEditingInitiativeId(i.id);
    setEditingInitiativeTitle(i.title);
    setEditingInitiativeDept(i.department ?? "company");
    setEditingInitiativeDueDate(i.due_date ?? "");
    setEditingInitiativeOwner(i.owner ?? "");
    setEditingInitiativeStakeholders(i.stakeholders ? i.stakeholders.split(",").map(s => s.trim()) : []);
    setEditingInitiativeNorthStarId(i.north_star_id ?? "");
  }

  function saveEditingInitiative(id: string) {
    editInitiative(id, {
      title: editingInitiativeTitle,
      department: editingInitiativeDept === "company" ? null : editingInitiativeDept,
      dueDate: editingInitiativeDueDate || null,
      owner: editingInitiativeOwner || null,
      stakeholders: editingInitiativeStakeholders.length > 0 ? editingInitiativeStakeholders.join(",") : null,
      northStarId: editingInitiativeNorthStarId || null,
    });
    setEditingInitiativeId(null);
  }

  async function handleAddInitiative() {
    if (!newInitiativeTitle.trim() || !newInitiativeDept) return;
    await addInitiative({
      title: newInitiativeTitle,
      department: newInitiativeDept === "company" ? null : newInitiativeDept,
      northStarId: newInitiativeNorthStarId || null,
      dueDate: newInitiativeDueDate || null,
      owner: newInitiativeOwner || null,
      stakeholders: newInitiativeStakeholders.length > 0 ? newInitiativeStakeholders.join(",") : null,
    });
    setNewInitiativeTitle("");
    setNewInitiativeDept("");
    setNewInitiativeNorthStarId("");
    setNewInitiativeDueDate("");
    setNewInitiativeOwner("");
    setNewInitiativeStakeholders([]);
    setShowInitiativeForm(false);
  }

  async function handleAddNorthStar() {
    if (!newNorthStarTitle.trim()) return;
    await addNorthStar(newNorthStarTitle, newNorthStarDesc || null);
    setNewNorthStarTitle("");
    setNewNorthStarDesc("");
    setShowNorthStarForm(false);
  }


  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        {/* ── Header ────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Focus Board</h2>
        </div>

        {/* ── Rallying Cry ──────────────────────────────── */}
        <div className="mb-5 text-center">
          {editingCry ? (
            <div className="flex items-center gap-2 max-w-md mx-auto">
              <Input
                autoFocus
                value={cryDraft}
                onChange={(e) => setCryDraft(e.target.value)}
                placeholder="What's the rallying cry this quarter?"
                className="text-sm text-center"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { saveRallyingCry(cryDraft); setEditingCry(false); }
                  if (e.key === "Escape") setEditingCry(false);
                }}
              />
              <Button size="sm" onClick={() => { saveRallyingCry(cryDraft); setEditingCry(false); }}>Save</Button>
              <button onClick={() => setEditingCry(false)} className="text-xs text-muted-foreground">Cancel</button>
            </div>
          ) : rallyingCry ? (
            <button
              onClick={() => { if (isAdmin) { setCryDraft(rallyingCry); setEditingCry(true); } }}
              className={`text-lg font-semibold text-foreground italic ${isAdmin ? "hover:text-primary cursor-pointer" : ""}`}
            >
              &ldquo;{rallyingCry}&rdquo;
            </button>
          ) : isAdmin ? (
            <button
              onClick={() => { setCryDraft(""); setEditingCry(true); }}
              className="text-sm text-muted-foreground hover:text-foreground italic"
            >
              + Set a rallying cry for Q{quarter.split("Q")[1]}
            </button>
          ) : null}
          {rallyingCry && !editingCry && (
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Q{quarter.split("Q")[1]} Rallying Cry</p>
          )}
        </div>

        {/* ── North Stars + Initiatives ────────────────── */}
        <div className="mb-5 space-y-3">
          {/* North Star header + add button */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
              <Star className="h-3 w-3" /> North Stars
            </p>
            {isAdmin && (
              showNorthStarForm
                ? <button onClick={() => setShowNorthStarForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                : <MicroExpander
                    text="Add North Star"
                    icon={<Star className="h-3.5 w-3.5" />}
                    variant="outline"
                    onClick={() => { setShowNorthStarForm(true); setShowInitiativeForm(false); }}
                  />
            )}
          </div>

          {/* Add North Star form */}
          {showNorthStarForm && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <Input
                value={newNorthStarTitle}
                onChange={(e) => setNewNorthStarTitle(e.target.value)}
                placeholder="North Star title..."
                className="text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleAddNorthStar()}
              />
              <Input
                value={newNorthStarDesc}
                onChange={(e) => setNewNorthStarDesc(e.target.value)}
                placeholder="Description (optional)"
                className="text-sm"
              />
              <Button size="sm" onClick={handleAddNorthStar} disabled={!newNorthStarTitle.trim()}>
                Add
              </Button>
            </div>
          )}

          {/* North Star cards with their initiatives */}
          {northStars.length === 0 && !showNorthStarForm && (
            <p className="text-xs text-muted-foreground italic">No north stars yet{isAdmin ? " — add one above" : ""}</p>
          )}
            {northStars.map((ns) => {
              const nsInitiatives = initiativesByNorthStar.get(ns.id) ?? [];
              const isEditingNS = editingNorthStarId === ns.id;

              return (
                <div key={ns.id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-start justify-between mb-1 group">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Star className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      {isEditingNS ? (
                        <div className="flex-1 space-y-1">
                          <input
                            autoFocus
                            value={editingNorthStarTitle}
                            onChange={(e) => setEditingNorthStarTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { editNorthStar(ns.id, editingNorthStarTitle, editingNorthStarDesc || null); setEditingNorthStarId(null); }
                              if (e.key === "Escape") setEditingNorthStarId(null);
                            }}
                            className="text-sm font-semibold bg-transparent outline-none border-b border-amber-500 w-full"
                          />
                          <input
                            value={editingNorthStarDesc}
                            onChange={(e) => setEditingNorthStarDesc(e.target.value)}
                            placeholder="Description..."
                            className="text-xs text-muted-foreground bg-transparent outline-none border-b border-border w-full"
                          />
                          <div className="flex gap-1">
                            <button onClick={() => { editNorthStar(ns.id, editingNorthStarTitle, editingNorthStarDesc || null); setEditingNorthStarId(null); }} className="text-xs text-primary">Save</button>
                            <button onClick={() => setEditingNorthStarId(null)} className="text-xs text-muted-foreground">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-foreground">{ns.title}</span>
                          {ns.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{ns.description}</p>
                          )}
                        </div>
                      )}
                    </div>
                    {isAdmin && !isEditingNS && (
                      <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-muted-foreground mr-1">{nsInitiatives.length} initiative{nsInitiatives.length !== 1 ? "s" : ""}</span>
                        <button
                          onClick={() => { setEditingNorthStarId(ns.id); setEditingNorthStarTitle(ns.title); setEditingNorthStarDesc(ns.description ?? ""); }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete North Star "${ns.title}"?`)) removeNorthStar(ns.id); }}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Initiatives header + add button */}
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Target className="h-3 w-3" /> Q{quarter.split("Q")[1]} Initiatives
              </p>
              {isAdmin && (
                showInitiativeForm
                  ? <button onClick={() => setShowInitiativeForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  : <MicroExpander
                      text="Add Initiative"
                      icon={<Target className="h-3.5 w-3.5" />}
                      variant="outline"
                      onClick={() => { setShowInitiativeForm(true); setShowNorthStarForm(false); }}
                    />
              )}
            </div>

            {/* Add Initiative form */}
            {showInitiativeForm && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={newInitiativeTitle}
                    onChange={(e) => setNewInitiativeTitle(e.target.value)}
                    placeholder="Initiative title..."
                    className="text-sm flex-1"
                  />
                  <select
                    value={newInitiativeDept}
                    onChange={(e) => setNewInitiativeDept(e.target.value)}
                    className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground min-w-[110px]"
                  >
                    <option value="" disabled>Department</option>
                    <option value="company">Company</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {northStars.length > 0 && (
                    <select
                      value={newInitiativeNorthStarId}
                      onChange={(e) => setNewInitiativeNorthStarId(e.target.value)}
                      className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground min-w-[120px]"
                    >
                      <option value="">No North Star</option>
                      {northStars.map((ns) => (
                        <option key={ns.id} value={ns.id}>{ns.title}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newInitiativeDueDate}
                    onChange={(e) => setNewInitiativeDueDate(e.target.value)}
                    className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground"
                    placeholder="Due date"
                  />
                  <select
                    value={newInitiativeOwner}
                    onChange={(e) => setNewInitiativeOwner(e.target.value)}
                    className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground min-w-[110px]"
                  >
                    <option value="">Owner</option>
                    {teamUsers.map((u) => (
                      <option key={u.user_id} value={u.user_email}>{displayName(u.user_email)}</option>
                    ))}
                  </select>
                  <MultiUserSelect
                    selected={newInitiativeStakeholders}
                    onChange={setNewInitiativeStakeholders}
                    users={teamUsers}
                  />
                  <Button size="sm" onClick={handleAddInitiative} disabled={!newInitiativeTitle.trim() || !newInitiativeDept}>
                    Add
                  </Button>
                </div>
              </div>
            )}

            {/* Initiative cards */}
            {sortedInitiatives.length > 0 ? (
              <div className="space-y-2">
                {sortedInitiatives.map((i) => {
                  const isActive = filterInitiativeId === i.id;
                  const canEdit = i.created_by === userId || isAdmin;
                  const p = initiativeProgress.get(i.id);
                  const stakeholderList = i.stakeholders ? i.stakeholders.split(",").map((s) => s.trim()) : [];
                  const statusStyle = i.status === "On-Track" ? "bg-emerald-500/20 text-emerald-400"
                    : i.status === "Behind" ? "bg-amber-500/20 text-amber-400"
                    : i.status === "Accomplished" ? "bg-blue-500/20 text-blue-400"
                    : "bg-red-500/20 text-red-400";

                  const isEditingThis = editingInitiativeId === i.id;

                  if (isEditingThis) {
                    return (
                      <div key={i.id} className="rounded-lg border border-primary/40 p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Input
                            autoFocus
                            value={editingInitiativeTitle}
                            onChange={(e) => setEditingInitiativeTitle(e.target.value)}
                            placeholder="Initiative title..."
                            className="text-sm flex-1"
                          />
                          <select
                            value={editingInitiativeDept}
                            onChange={(e) => setEditingInitiativeDept(e.target.value)}
                            className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground min-w-[110px]"
                          >
                            <option value="company">Company</option>
                            {DEPARTMENTS.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editingInitiativeDueDate}
                            onChange={(e) => setEditingInitiativeDueDate(e.target.value)}
                            className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground"
                          />
                          <select
                            value={editingInitiativeOwner}
                            onChange={(e) => setEditingInitiativeOwner(e.target.value)}
                            className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground min-w-[110px]"
                          >
                            <option value="">No owner</option>
                            {teamUsers.map((u) => (
                              <option key={u.user_id} value={u.user_email}>{displayName(u.user_email)}</option>
                            ))}
                          </select>
                          <MultiUserSelect
                            selected={editingInitiativeStakeholders}
                            onChange={setEditingInitiativeStakeholders}
                            users={teamUsers}
                          />
                          {northStars.length > 0 && (
                            <select
                              value={editingInitiativeNorthStarId}
                              onChange={(e) => setEditingInitiativeNorthStarId(e.target.value)}
                              className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground min-w-[120px]"
                            >
                              <option value="">No North Star</option>
                              {northStars.map((ns) => (
                                <option key={ns.id} value={ns.id}>{ns.title}</option>
                              ))}
                            </select>
                          )}
                          <Button size="sm" onClick={() => saveEditingInitiative(i.id)}>Save</Button>
                          <button onClick={() => setEditingInitiativeId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={i.id}
                      onClick={() => setFilterInitiativeId(isActive ? null : i.id)}
                      className={`rounded-lg border p-3 cursor-pointer transition-colors group/row ${
                        isActive ? "border-primary/40 bg-primary/5" : "border-border/50 hover:border-border"
                      }`}
                    >
                      {/* Top: title + edit/delete + status */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${STATUS_COLORS[i.status] ?? "bg-zinc-400"}`} />
                        <span className="text-sm font-medium text-foreground flex-1 truncate">{i.title}</span>
                        {canEdit && (
                          <div className="flex items-center gap-4 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0 mr-2">
                            <button onClick={(e) => { e.stopPropagation(); startEditingInitiative(i); }} className="text-muted-foreground hover:text-foreground">
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${i.title}"?`)) removeInitiative(i.id); }} className="text-muted-foreground hover:text-red-500">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {p && p.total > 0 && (
                          <span className="text-[10px] text-muted-foreground/60 shrink-0">{p.completed}/{p.total}</span>
                        )}
                        {canEdit ? (
                          <div className="shrink-0 flex items-center">
                            <select
                              value={i.status}
                              onChange={(e) => { e.stopPropagation(); editInitiative(i.id, { status: e.target.value as InitiativeStatus }); }}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-xs font-medium rounded-full px-3 py-1.5 border-none outline-none cursor-pointer appearance-none ${statusStyle}`}
                            >
                              {INITIATIVE_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className={`text-xs font-medium rounded-full px-3 py-1.5 shrink-0 ${statusStyle}`}>{i.status}</span>
                        )}
                      </div>
                      {/* Bottom: metadata */}
                      <div className="flex items-center gap-6 ml-[18px] text-[10px] text-muted-foreground">
                        {i.due_date && (
                          <span><span className="text-muted-foreground/50">Due</span> {new Date(i.due_date + "T12:00:00").toLocaleDateString("en-NZ", { month: "short", day: "numeric" })}</span>
                        )}
                        {i.owner && <span><span className="text-muted-foreground/50">Owner</span> {displayName(i.owner)}</span>}
                        {stakeholderList.length > 0 && <span><span className="text-muted-foreground/50">Stakeholders</span> {stakeholderList.map(displayName).join(", ")}</span>}
                        <span><span className="text-muted-foreground/50">Dept</span> {i.department ?? "Company"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !showInitiativeForm ? (
              <p className="text-xs text-muted-foreground italic">No initiatives yet{isAdmin ? " — add one above" : ""}</p>
            ) : null}
          </div>

        {/* ── Focus Items ──────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-12"><LoadingIndicator /></div>
        ) : (
          <div className="space-y-6">
            {/* Focus items header + add button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <ListChecks className="h-3 w-3" /> Weekly Focus Items
                </p>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setSelectedWeek(shiftWeek(selectedWeek, -1))}
                    className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => isCurrentWeek || setSelectedWeek(getCurrentWeekStart())}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      isCurrentWeek
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {weekLabel}
                  </button>
                  <button
                    onClick={() => setSelectedWeek(shiftWeek(selectedWeek, 1))}
                    disabled={isCurrentWeek}
                    className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {showFocusForm
                ? <button onClick={() => setShowFocusForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                : <MicroExpander
                    text="Add Focus"
                    icon={<CirclePlus className="h-3.5 w-3.5" />}
                    variant="outline"
                    onClick={() => setShowFocusForm(true)}
                  />
              }
            </div>

            {/* Add focus form */}
            {showFocusForm && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                <Input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={assigneeId && assigneeId !== userId
                    ? `Add focus for ${displayName(teamUsers.find((u) => u.user_id === assigneeId)?.user_email ?? "")}...`
                    : "Add a focus for this week..."}
                  className="text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleAddFocus()}
                />
                {isAdmin && teamUsers.length > 0 && (
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground min-w-[120px]"
                  >
                    <option value="">Me</option>
                    {teamUsers
                      .filter((u) => u.user_id !== userId)
                      .map((u) => (
                        <option key={u.user_id} value={u.user_id}>
                          {displayName(u.user_email)}
                        </option>
                      ))}
                  </select>
                )}
                {initiatives.length > 0 && (
                  <select
                    value={newInitiativeId}
                    onChange={(e) => setNewInitiativeId(e.target.value)}
                    className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground min-w-[140px]"
                  >
                    <option value="">No initiative</option>
                    {initiatives.map((i) => (
                      <option key={i.id} value={i.id}>{i.title}</option>
                    ))}
                  </select>
                )}
                <Button size="sm" onClick={handleAddFocus} disabled={!newTitle.trim()}>
                  Add
                </Button>
              </div>
            )}

            {/* Team members */}
            {grouped.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No focus items yet this week. Add your first one above.
              </p>
            )}

            {grouped.map((group) => {
              const isMe = group.userId === userId;
              const completed = group.items.filter((i) => i.completed).length;
              const total = group.items.length;

              return (
                <div key={group.userId} className={`rounded-lg border p-4 ${isMe ? "border-primary/30 bg-primary/5" : "border-border/50"}`}>
                  {/* User header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${isMe ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {displayName(group.email).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {displayName(group.email)}
                        {isMe && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{completed}/{total}</span>
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${progressColor(completed, total)}`}
                          style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Focus items */}
                  <div className="space-y-1.5">
                    {group.items.map((item) => {
                      const initiative = item.quarterly_initiative_id ? initiativeMap.get(item.quarterly_initiative_id) : null;
                      const isEditingThis = editingFocusId === item.id;

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors group/item ${
                            item.completed ? "opacity-60" : "hover:bg-muted/30"
                          }`}
                        >
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => (isMe || isAdmin) && toggleComplete(item.id, item.completed)}
                            disabled={!isMe && !isAdmin}
                            className="shrink-0"
                          />
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            {item.carried_over_from && (
                              <RotateCcw className="h-3 w-3 text-amber-500 shrink-0" title="Carried over from last week" />
                            )}
                            {isEditingThis ? (
                              <input
                                autoFocus
                                value={editingFocusTitle}
                                onChange={(e) => setEditingFocusTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { editFocus(item.id, { title: editingFocusTitle }); setEditingFocusId(null); }
                                  if (e.key === "Escape") setEditingFocusId(null);
                                }}
                                onBlur={() => { editFocus(item.id, { title: editingFocusTitle }); setEditingFocusId(null); }}
                                className="text-sm bg-transparent outline-none border-b border-primary flex-1"
                              />
                            ) : (
                              <span className={`text-sm ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {item.title}
                              </span>
                            )}
                            {initiative && !isEditingThis && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-primary/10 text-primary shrink-0">
                                {initiative.title}
                              </span>
                            )}
                          </div>
                          {(isMe || isAdmin) && !item.completed && !isEditingThis && (
                            <div className="flex items-center gap-4 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingFocusId(item.id); setEditingFocusTitle(item.title); }}
                                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => removeFocus(item.id)}
                                className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
