import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchFociForWeek,
  fetchIncompletePreviousFoci,
  createFocusItem,
  updateFocusItem,
  deleteFocusItem,
  fetchQuarterlyGoals,
  createQuarterlyGoal,
  updateQuarterlyGoal,
  deleteQuarterlyGoal,
  type FocusItem,
  type QuarterlyGoal,
} from "@/lib/supabase-focus";

// ── Helpers ──────────────────────────────────────────────────

/** Returns Monday of the current week as YYYY-MM-DD */
export function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

/** Format week range: "Apr 7 – Apr 13, 2026" */
export function getWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + "T12:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
}

/** Returns current quarter string: "2026-Q2" */
export function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

// ── Hook ─────────────────────────────────────────────────────

export function useFocusBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const carryOverDone = useRef(false);

  const weekStart = getCurrentWeekStart();
  const weekLabel = getWeekLabel(weekStart);
  const quarter = getCurrentQuarter();
  const userId = user?.id ?? "";
  const userEmail = user?.email ?? "";

  // Fetch all team tasks for the current week
  const fociQuery = useQuery({
    queryKey: ["focus-board", weekStart],
    queryFn: () => fetchFociForWeek(weekStart),
    staleTime: 2 * 60 * 1000,
    enabled: !!userId,
  });

  // Fetch quarterly goals
  const goalsQuery = useQuery({
    queryKey: ["quarterly-goals", quarter],
    queryFn: () => fetchQuarterlyGoals(quarter),
    staleTime: 10 * 60 * 1000,
  });

  // ── Carry-over logic ─────────────────────────────────────
  useEffect(() => {
    if (!userId || !fociQuery.data || carryOverDone.current) return;
    carryOverDone.current = true;

    const myItems = fociQuery.data.filter((f) => f.user_id === userId);
    if (myItems.length > 0) return; // Already have items this week

    (async () => {
      const previous = await fetchIncompletePreviousFoci(weekStart, userId);
      if (previous.length === 0) return;

      await Promise.all(
        previous.map((item) =>
          createFocusItem({
            user_id: userId,
            user_email: userEmail,
            title: item.title,
            week_start: weekStart,
            quarterly_goal_id: item.quarterly_goal_id,
            carried_over_from: item.id,
          })
        )
      );

      queryClient.invalidateQueries({ queryKey: ["focus-board", weekStart] });
    })();
  }, [userId, fociQuery.data, weekStart, userEmail, queryClient]);

  // ── Mutations ────────────────────────────────────────────

  const addFocus = useCallback(
    async (title: string, quarterlyGoalId?: string | null) => {
      if (!userId || !title.trim()) return;
      const newItem = await createFocusItem({
        user_id: userId,
        user_email: userEmail,
        title: title.trim(),
        week_start: weekStart,
        quarterly_goal_id: quarterlyGoalId ?? null,
      });
      if (newItem) {
        queryClient.setQueryData<FocusItem[]>(["focus-board", weekStart], (old) =>
          old ? [...old, newItem] : [newItem]
        );
      }
    },
    [userId, userEmail, weekStart, queryClient]
  );

  const toggleComplete = useCallback(
    async (id: string, currentlyCompleted: boolean) => {
      const newCompleted = !currentlyCompleted;
      // Optimistic update
      queryClient.setQueryData<FocusItem[]>(["focus-board", weekStart], (old) =>
        old?.map((f) =>
          f.id === id
            ? { ...f, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
            : f
        )
      );
      await updateFocusItem(id, {
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      });
    },
    [weekStart, queryClient]
  );

  const removeFocus = useCallback(
    async (id: string) => {
      // Optimistic update
      queryClient.setQueryData<FocusItem[]>(["focus-board", weekStart], (old) =>
        old?.filter((f) => f.id !== id)
      );
      await deleteFocusItem(id);
    },
    [weekStart, queryClient]
  );

  const addGoal = useCallback(
    async (title: string, department?: string | null) => {
      if (!userId || !title.trim()) return;
      const newGoal = await createQuarterlyGoal({
        title: title.trim(),
        quarter,
        department: department ?? null,
        created_by: userId,
      });
      if (newGoal) {
        queryClient.setQueryData<QuarterlyGoal[]>(["quarterly-goals", quarter], (old) =>
          old ? [...old, newGoal] : [newGoal]
        );
      }
    },
    [userId, quarter, queryClient]
  );

  const editGoal = useCallback(
    async (id: string, title: string, department?: string | null) => {
      queryClient.setQueryData<QuarterlyGoal[]>(["quarterly-goals", quarter], (old) =>
        old?.map((g) => g.id === id ? { ...g, title, department: department ?? g.department } : g)
      );
      await updateQuarterlyGoal(id, { title, department: department ?? undefined });
    },
    [quarter, queryClient]
  );

  const removeGoal = useCallback(
    async (id: string) => {
      queryClient.setQueryData<QuarterlyGoal[]>(["quarterly-goals", quarter], (old) =>
        old?.filter((g) => g.id !== id)
      );
      await deleteQuarterlyGoal(id);
    },
    [quarter, queryClient]
  );

  return {
    foci: fociQuery.data ?? [],
    goals: goalsQuery.data ?? [],
    weekStart,
    weekLabel,
    quarter,
    addFocus,
    toggleComplete,
    removeFocus,
    addGoal,
    editGoal,
    removeGoal,
    loading: fociQuery.isLoading,
  };
}
