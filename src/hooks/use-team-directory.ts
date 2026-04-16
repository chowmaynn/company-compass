import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

// ── Types ────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  department: string | null;
  location: string | null;
  jobTitle: string | null;
  photoUrl: string | null;
}

export interface TeamMemberPin extends TeamMember {
  lat: number;
  lng: number;
}

// ── Geocoding lookup table ───────────────────────────────────
// Maps normalized location strings → [lat, lng]. Matching is case-insensitive
// substring — "Auckland, NZ" matches the "auckland" key.
// Add entries here as new offices/locations appear in BambooHR.

const CITY_COORDS: Record<string, [number, number]> = {
  "auckland":       [-36.8485, 174.7633],
  "new zealand":    [-36.8485, 174.7633],
  "nz":             [-36.8485, 174.7633],
  "orlando":        [28.5383, -81.3792],
  "florida":        [28.5383, -81.3792],
  "bali":           [-8.3405, 115.0920],
  "denpasar":       [-8.6500, 115.2167],
  "indonesia":      [-8.3405, 115.0920],
  "manila":         [14.5995, 120.9842],
  "philippines":    [14.5995, 120.9842],
  "london":         [51.5074, -0.1278],
  "uk":             [51.5074, -0.1278],
  "sydney":         [-33.8688, 151.2093],
  "australia":      [-33.8688, 151.2093],
  "new york":       [40.7128, -74.0060],
  "los angeles":    [34.0522, -118.2437],
  "san francisco":  [37.7749, -122.4194],
  "toronto":        [43.6532, -79.3832],
  "canada":         [43.6532, -79.3832],
  "singapore":      [1.3521, 103.8198],
  "tokyo":          [35.6762, 139.6503],
  "berlin":         [52.5200, 13.4050],
  "paris":          [48.8566, 2.3522],
  "dubai":          [25.2048, 55.2708],
  "mumbai":         [19.0760, 72.8777],
  "india":          [19.0760, 72.8777],
  "bangkok":        [13.7563, 100.5018],
  "thailand":       [13.7563, 100.5018],
  "cape town":      [-33.9249, 18.4241],
  "south africa":   [-33.9249, 18.4241],
};

/** Try to resolve a BambooHR location string to lat/lng. */
function geocodeLocation(location: string | null): [number, number] | null {
  if (!location) return null;
  const normalized = location.toLowerCase().trim();
  if (normalized === "remote" || normalized === "") return null;

  // Exact match first
  if (CITY_COORDS[normalized]) return CITY_COORDS[normalized];

  // Substring match: check if any key appears in the location string (or vice versa)
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (normalized.includes(key) || key.includes(normalized)) return coords;
  }

  // Unknown location — log for debugging so we can add it to the table
  console.warn(`[use-team-directory] Unknown location: "${location}" — add it to CITY_COORDS in use-team-directory.ts`);
  return null;
}

// ── Fetch ────────────────────────────────────────────────────

async function fetchDirectory(): Promise<TeamMember[]> {
  const res = await fetch("/api/bamboohr/employees/directory");
  if (!res.ok) return [];
  const data = await res.json();
  if (!data?.employees || !Array.isArray(data.employees)) return [];

  return data.employees.map((e: any) => ({
    id: String(e.id ?? ""),
    firstName: e.firstName ?? e.preferredName ?? "",
    lastName: e.lastName ?? "",
    displayName: e.displayName ?? `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(),
    department: e.department ?? null,
    location: e.location ?? null,
    jobTitle: e.jobTitle ?? null,
    photoUrl: e.photoUrl ?? null,
  }));
}

// ── Hook ─────────────────────────────────────────────────────

export function useTeamDirectory() {
  const query = useQuery({
    queryKey: ["bamboohr-directory"],
    queryFn: fetchDirectory,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours — employee list changes ~weekly
    gcTime: 48 * 60 * 60 * 1000,   // keep in memory for 48 hours
  });

  const members = query.data ?? [];

  /** All employees with resolvable coordinates — ready to plot on a globe.
   *  Small random offsets per person prevent pins from stacking exactly at
   *  the same lat/lng when multiple people share a city. */
  const pins: TeamMemberPin[] = useMemo(() => {
    const result: TeamMemberPin[] = [];
    // Deterministic offset per person (seeded by id) so pins don't jump on re-render
    const offset = (id: string, axis: number): number => {
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
      return ((((hash + axis * 7919) % 1000) / 1000) - 0.5) * 0.4; // ±0.2°
    };

    for (const m of members) {
      const coords = geocodeLocation(m.location);
      if (!coords) continue;
      result.push({
        ...m,
        lat: coords[0] + offset(m.id, 0),
        lng: coords[1] + offset(m.id, 1),
      });
    }
    return result;
  }, [members]);

  return {
    members,
    pins,
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
  };
}
