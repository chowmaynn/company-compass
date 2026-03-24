import { useState, useEffect } from "react";
import {
  fetchTodaysMeetings,
  fetchWeeklyMeetings,
  fetchCircleSLA,
  type MeetingRecord,
  type CirclePost,
} from "@/lib/coaches-airtable";

export type { MeetingRecord, CirclePost };

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getMonthBounds(): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export function useCoachesMeetings() {
  const [todaysMeetings, setTodaysMeetings] = useState<Array<{ id: string; fields: MeetingRecord }>>([]);
  const [monthlyMeetings, setMonthlyMeetings] = useState<Array<{ id: string; fields: MeetingRecord }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { startDate, endDate } = getMonthBounds();
    setLoading(true);
    Promise.all([fetchTodaysMeetings(), fetchWeeklyMeetings(startDate, endDate)])
      .then(([todays, monthly]) => {
        setTodaysMeetings(todays);
        setMonthlyMeetings(monthly);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return { todaysMeetings, monthlyMeetings, loading, error };
}

export function useCircleSLA() {
  const [posts, setPosts] = useState<Array<{ id: string; fields: CirclePost }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCircleSLA()
      .then(setPosts)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return { posts, loading, error };
}
