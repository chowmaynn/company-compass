import { useState, useEffect, useCallback } from "react";
import {
  fetchSkoolSnapshots,
  insertSkoolSnapshot,
  type SkoolSnapshot,
  type SkoolSource,
} from "@/lib/skool-snapshots";

export type { SkoolSnapshot, SkoolSource };

export interface UseSkoolSnapshots {
  snapshots: SkoolSnapshot[];
  latest: SkoolSnapshot | null;
  loading: boolean;
  saving: boolean;
  saveError: string | null;
  save: (data: Omit<SkoolSnapshot, "id" | "created_at">) => Promise<boolean>;
}

export function useSkoolSnapshots(): UseSkoolSnapshots {
  const [snapshots, setSnapshots] = useState<SkoolSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchSkoolSnapshots();
    setSnapshots(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (data: Omit<SkoolSnapshot, "id" | "created_at">) => {
    setSaving(true);
    setSaveError(null);
    const result = await insertSkoolSnapshot(data);
    if (result.ok) {
      await load();
    } else {
      setSaveError(result.error ?? "Failed to save snapshot");
    }
    setSaving(false);
    return result.ok;
  }, [load]);

  return { snapshots, latest: snapshots[0] ?? null, loading, saving, saveError, save };
}
