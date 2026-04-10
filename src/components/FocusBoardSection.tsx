import { useState, useMemo } from "react";
import { useFocusBoard } from "@/hooks/use-focus-board";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Target, RotateCcw, Plus, Trash2, ChevronDown } from "lucide-react";
import { LoadingDots } from "@/components/LoadingDots";
import type { FocusItem, QuarterlyGoal } from "@/lib/supabase-focus";

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

// ── Main Component ───────────────────────────────────────────

export function FocusBoardSection() {
  const { user, isAdmin } = useAuth();
  const { foci, goals, weekLabel, addFocus, toggleComplete, removeFocus, addGoal, loading } = useFocusBoard();
  const userId = user?.id ?? "";

  const [newTitle, setNewTitle] = useState("");
  const [newGoalId, setNewGoalId] = useState<string>("");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");

  // Group foci by user, current user first
  const grouped = useMemo(() => {
    const map = new Map<string, { email: string; userId: string; items: FocusItem[] }>();
    for (const f of foci) {
      if (!map.has(f.user_id)) {
        map.set(f.user_id, { email: f.user_email, userId: f.user_id, items: [] });
      }
      map.get(f.user_id)!.items.push(f);
    }
    const groups = [...map.values()];
    // Current user first, then alphabetical
    groups.sort((a, b) => {
      if (a.userId === userId) return -1;
      if (b.userId === userId) return 1;
      return a.email.localeCompare(b.email);
    });
    return groups;
  }, [foci, userId]);

  // Goals lookup
  const goalMap = useMemo(() => {
    const m = new Map<string, QuarterlyGoal>();
    for (const g of goals) m.set(g.id, g);
    return m;
  }, [goals]);

  async function handleAddFocus() {
    if (!newTitle.trim()) return;
    await addFocus(newTitle, newGoalId || null);
    setNewTitle("");
    setNewGoalId("");
  }

  async function handleAddGoal() {
    if (!newGoalTitle.trim()) return;
    await addGoal(newGoalTitle);
    setNewGoalTitle("");
    setShowGoalForm(false);
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Focus Board</h2>
            <span className="text-sm text-muted-foreground ml-2">{weekLabel}</span>
          </div>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGoalForm(!showGoalForm)}
              className="text-xs text-muted-foreground"
            >
              {showGoalForm ? "Cancel" : "+ Add Goal"}
            </Button>
          )}
        </div>

        {/* Add Goal form (admin only) */}
        {showGoalForm && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-muted/50 border border-border/50">
            <Input
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              placeholder="Quarterly goal title..."
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAddGoal()}
            />
            <Button size="sm" onClick={handleAddGoal} disabled={!newGoalTitle.trim()}>
              Add Goal
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12"><LoadingDots /></div>
        ) : (
          <div className="space-y-6">
            {/* Current user's add form */}
            <div className="flex items-center gap-2">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Add a focus for this week..."
                className="text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleAddFocus()}
              />
              {goals.length > 0 && (
                <select
                  value={newGoalId}
                  onChange={(e) => setNewGoalId(e.target.value)}
                  className="text-xs bg-transparent border border-border rounded-md px-2 py-2 text-muted-foreground min-w-[140px]"
                >
                  <option value="">No goal</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              )}
              <Button size="sm" onClick={handleAddFocus} disabled={!newTitle.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

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
                      const goal = item.quarterly_goal_id ? goalMap.get(item.quarterly_goal_id) : null;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors ${
                            item.completed ? "opacity-60" : "hover:bg-muted/30"
                          }`}
                        >
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => isMe && toggleComplete(item.id, item.completed)}
                            disabled={!isMe}
                            className="shrink-0"
                          />
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            {item.carried_over_from && (
                              <RotateCcw className="h-3 w-3 text-amber-500 shrink-0" title="Carried over from last week" />
                            )}
                            <span className={`text-sm ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {item.title}
                            </span>
                            {goal && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-primary/10 text-primary shrink-0">
                                {goal.title}
                              </span>
                            )}
                          </div>
                          {isMe && !item.completed && (
                            <button
                              onClick={() => removeFocus(item.id)}
                              className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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
