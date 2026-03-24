import { useState, useEffect } from 'react';
import { fetchAllWins, type WinRecord } from '@/lib/success-tracking';

export type { WinRecord };

export function useSuccessTracking() {
  const [wins, setWins] = useState<Array<{ id: string; createdTime: string; fields: WinRecord }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllWins()
      .then(setWins)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return { wins, loading, error };
}
