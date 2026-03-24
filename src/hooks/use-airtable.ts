import { useState, useEffect } from "react";
import { fetchBases, fetchTables, fetchRecords, type AirtableBase, type AirtableTable, type AirtableRecord } from "@/lib/airtable";

export function useAirtableBases() {
  const [bases, setBases] = useState<AirtableBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBases()
      .then(setBases)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return { bases, loading, error };
}

export function useAirtableTables(baseId: string | null) {
  const [tables, setTables] = useState<AirtableTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!baseId) return;
    setLoading(true);
    fetchTables(baseId)
      .then(setTables)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [baseId]);

  return { tables, loading, error };
}

export function useAirtableRecords(baseId: string | null, tableIdOrName: string | null, params?: Record<string, string>) {
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!baseId || !tableIdOrName) return;
    setLoading(true);
    fetchRecords(baseId, tableIdOrName, params)
      .then(setRecords)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [baseId, tableIdOrName]);

  return { records, loading, error };
}
