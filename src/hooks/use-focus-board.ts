import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchFociForWeek,
  fetchIncompletePreviousFoci,
  createFocusItem,
  updateFocusItem,
  deleteFocusItem,
  fetchQuarterlyInitiatives,
  createQuarterlyInitiative,
  updateQuarterlyInitiative,
  deleteQuarterlyInitiative,
  fetchNorthStarMetrics,
  createNorthStarMetric,
  updateNorthStarMetric,
  deleteNorthStarMetric,
  fetchTeamUsers,
  fetchQuarterlySettings,
  upsertQuarterlySettings,
  type FocusItem,
  type QuarterlyInitiative,
  type NorthStarMetric,
  type QuarterlySettings,
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

export function useFocusBoard(weekStartOverride?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const carryOverDone = useRef(false);

  const currentWeekStart = getCurrentWeekStart();
  const weekStart = weekStartOverride ?? currentWeekStart;
  const weekLabel = getWeekLabel(weekStart);
  const isCurrentWeek = weekStart === currentWeekStart;
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

  // Fetch quarterly initiatives
  const initiativesQuery = useQuery({
    queryKey: ["quarterly-initiatives", quarter],
    queryFn: () => fetchQuarterlyInitiatives(quarter),
    staleTime: 10 * 60 * 1000,
  });

  // Fetch north star metrics
  const northStarsQuery = useQuery({
    queryKey: ["north-stars"],
    queryFn: fetchNorthStarMetrics,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch quarterly settings (rallying cry)
  const settingsQuery = useQuery({
    queryKey: ["quarterly-settings", quarter],
    queryFn: () => fetchQuarterlySettings(quarter),
    staleTime: 10 * 60 * 1000,
  });

  // Fetch distinct team users (for admin assignment)
  const teamUsersQuery = useQuery({
    queryKey: ["team-users"],
    queryFn: fetchTeamUsers,
    staleTime: 30 * 60 * 1000,
  });

  // ── Carry-over logic (only for current week) ────────────
  useEffect(() => {
    if (!isCurrentWeek || !userId || !fociQuery.data || carryOverDone.current) return;
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
            quarterly_initiative_id: item.quarterly_initiative_id,
            carried_over_from: item.id,
          })
        )
      );

      queryClient.invalidateQueries({ queryKey: ["focus-board", weekStart] });
    })();
  }, [userId, fociQuery.data, weekStart, userEmail, queryClient]);

  // ── Focus Item Mutations ────────────────────────────────

  const addFocus = useCallback(
    async (title: string, initiativeId?: string | null, targetUserId?: string, targetUserEmail?: string) => {
      if (!userId || !title.trim()) return;
      const newItem = await createFocusItem({
        user_id: targetUserId ?? userId,
        user_email: targetUserEmail ?? userEmail,
        title: title.trim(),
        week_start: weekStart,
        quarterly_initiative_id: initiativeId ?? null,
      });
      if (newItem) {
        queryClient.setQueryData<FocusItem[]>(["focus-board", weekStart], (old) =>
          old ? [...old, newItem] : [newItem]
        );
      }
    },
    [userId, userEmail, weekStart, queryClient]
  );

  const editFocus = useCallback(
    async (id: string, title: string) => {
      queryClient.setQueryData<FocusItem[]>(["focus-board", weekStart], (old) =>
        old?.map((f) => f.id === id ? { ...f, title } : f)
      );
      await updateFocusItem(id, { title });
    },
    [weekStart, queryClient]
  );

  const toggleComplete = useCallback(
    async (id: string, currentlyCompleted: boolean) => {
      const newCompleted = !currentlyCompleted;
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
      queryClient.setQueryData<FocusItem[]>(["focus-board", weekStart], (old) =>
        old?.filter((f) => f.id !== id)
      );
      await deleteFocusItem(id);
    },
    [weekStart, queryClient]
  );

  // ── Initiative Mutations ────────────────────────────────

  interface InitiativeInput {
    title: string;
    department?: string | null;
    northStarId?: string | null;
    dueDate?: string | null;
    owner?: string | null;
    stakeholders?: string | null;
  }

  const addInitiative = useCallback(
    async (input: InitiativeInput) => {
      if (!userId || !input.title.trim()) return;
      const newInit = await createQuarterlyInitiative({
        title: input.title.trim(),
        quarter,
        department: input.department ?? null,
        north_star_id: input.northStarId ?? null,
        due_date: input.dueDate ?? null,
        owner: input.owner ?? null,
        stakeholders: input.stakeholders ?? null,
        created_by: userId,
      });
      if (newInit) {
        queryClient.setQueryData<QuarterlyInitiative[]>(["quarterly-initiatives", quarter], (old) =>
          old ? [...old, newInit] : [newInit]
        );
      }
    },
    [userId, quarter, queryClient]
  );

  interface InitiativeUpdate {
    title?: string;
    department?: string | null;
    northStarId?: string | null;
    status?: QuarterlyInitiative["status"];
    dueDate?: string | null;
    owner?: string | null;
    stakeholders?: string | null;
  }

  const editInitiative = useCallback(
    async (id: string, updates: InitiativeUpdate) => {
      const opt = (key: string, val: unknown) => val !== undefined ? { [key]: val } : {};
      queryClient.setQueryData<QuarterlyInitiative[]>(["quarterly-initiatives", quarter], (old) =>
        old?.map((i) => i.id === id ? {
          ...i,
          ...opt("title", updates.title),
          ...opt("department", updates.department),
          ...opt("north_star_id", updates.northStarId),
          ...opt("status", updates.status),
          ...opt("due_date", updates.dueDate),
          ...opt("owner", updates.owner),
          ...opt("stakeholders", updates.stakeholders),
        } : i)
      );
      await updateQuarterlyInitiative(id, {
        ...opt("title", updates.title),
        ...opt("department", updates.department),
        ...opt("north_star_id", updates.northStarId),
        ...opt("status", updates.status),
        ...opt("due_date", updates.dueDate),
        ...opt("owner", updates.owner),
        ...opt("stakeholders", updates.stakeholders),
      });
    },
    [quarter, queryClient]
  );

  const removeInitiative = useCallback(
    async (id: string) => {
      queryClient.setQueryData<QuarterlyInitiative[]>(["quarterly-initiatives", quarter], (old) =>
        old?.filter((i) => i.id !== id)
      );
      await deleteQuarterlyInitiative(id);
    },
    [quarter, queryClient]
  );

  // ── North Star Mutations ────────────────────────────────

  const addNorthStar = useCallback(
    async (title: string, description?: string | null) => {
      if (!userId || !title.trim()) return;
      const newNs = await createNorthStarMetric({
        title: title.trim(),
        description: description ?? null,
        created_by: userId,
      });
      if (newNs) {
        queryClient.setQueryData<NorthStarMetric[]>(["north-stars"], (old) =>
          old ? [...old, newNs] : [newNs]
        );
      }
    },
    [userId, queryClient]
  );

  const editNorthStar = useCallback(
    async (id: string, title: string, description?: string | null) => {
      queryClient.setQueryData<NorthStarMetric[]>(["north-stars"], (old) =>
        old?.map((ns) => ns.id === id ? { ...ns, title, description: description ?? ns.description } : ns)
      );
      await updateNorthStarMetric(id, { title, description: description ?? undefined });
    },
    [queryClient]
  );

  const removeNorthStar = useCallback(
    async (id: string) => {
      queryClient.setQueryData<NorthStarMetric[]>(["north-stars"], (old) =>
        old?.filter((ns) => ns.id !== id)
      );
      await deleteNorthStarMetric(id);
    },
    [queryClient]
  );

  // ── Rallying Cry ─────────────────────────────────────────

  const saveRallyingCry = useCallback(
    async (cry: string) => {
      queryClient.setQueryData<QuarterlySettings | null>(["quarterly-settings", quarter], (old) =>
        old ? { ...old, rallying_cry: cry } : { id: "", quarter, rallying_cry: cry, updated_at: new Date().toISOString() }
      );
      await upsertQuarterlySettings(quarter, cry);
    },
    [quarter, queryClient]
  );

  // Ensure current user is in the team users list
  const teamUsers = useMemo(() => {
    const raw = teamUsersQuery.data ?? [];
    if (userId && userEmail && !raw.some((u) => u.user_id === userId)) {
      return [{ user_id: userId, user_email: userEmail }, ...raw];
    }
    return raw;
  }, [teamUsersQuery.data, userId, userEmail]);

  return {
    foci: fociQuery.data ?? [],
    initiatives: initiativesQuery.data ?? [],
    northStars: northStarsQuery.data ?? [],
    rallyingCry: settingsQuery.data?.rallying_cry ?? null,
    saveRallyingCry,
    teamUsers,
    weekStart,
    weekLabel,
    isCurrentWeek,
    quarter,
    addFocus,
    editFocus,
    toggleComplete,
    removeFocus,
    addInitiative,
    editInitiative,
    removeInitiative,
    addNorthStar,
    editNorthStar,
    removeNorthStar,
    loading: fociQuery.isLoading,
  };
}
