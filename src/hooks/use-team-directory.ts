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
  // Oceania
  "auckland":       [-36.8485, 174.7633],
  "new zealand":    [-36.8485, 174.7633],
  "nz":             [-36.8485, 174.7633],
  "sydney":         [-33.8688, 151.2093],
  "australia":      [-33.8688, 151.2093],
  // North America
  "usa":            [28.5383, -81.3792],   // defaults to Orlando (company HQ)
  "orlando":        [28.5383, -81.3792],
  "florida":        [28.5383, -81.3792],
  "new york":       [40.7128, -74.0060],
  "los angeles":    [34.0522, -118.2437],
  "san francisco":  [37.7749, -122.4194],
  "toronto":        [43.6532, -79.3832],
  "canada":         [43.6532, -79.3832],
  // South America
  "colombia":       [4.7110, -74.0721],    // Bogotá
  // Southeast Asia
  "bali":           [-8.3405, 115.0920],
  "denpasar":       [-8.6500, 115.2167],
  "indonesia":      [-8.3405, 115.0920],
  "manila":         [14.5995, 120.9842],
  "philippines":    [14.5995, 120.9842],
  "singapore":      [1.3521, 103.8198],
  "bangkok":        [13.7563, 100.5018],
  "thailand":       [13.7563, 100.5018],
  // South Asia
  "pakistan":        [24.8607, 67.0011],    // Karachi
  "mumbai":         [19.0760, 72.8777],
  "india":          [19.0760, 72.8777],
  // Middle East
  "uae":            [25.2048, 55.2708],    // Dubai
  "dubai":          [25.2048, 55.2708],
  // Europe
  "london":         [51.5074, -0.1278],
  "uk":             [51.5074, -0.1278],
  "berlin":         [52.5200, 13.4050],
  "germany":        [52.5200, 13.4050],
  "paris":          [48.8566, 2.3522],
  "france":         [48.8566, 2.3522],
  "spain":          [40.4168, -3.7038],    // Madrid
  "romania":        [44.4268, 26.1025],    // Bucharest
  "serbia":         [44.7866, 20.4489],    // Belgrade
  "slovenia":       [46.0569, 14.5058],    // Ljubljana
  "poland":         [52.2297, 21.0122],    // Warsaw
  "austria":        [48.2082, 16.3738],    // Vienna
  "finland":        [60.1699, 24.9384],    // Helsinki
  "georgia":        [41.7151, 44.8271],    // Tbilisi (country)
  // Africa
  "ghana":          [5.6037, -0.1870],     // Accra
  "cape town":      [-33.9249, 18.4241],
  "south africa":   [-33.9249, 18.4241],
  // East Asia
  "tokyo":          [35.6762, 139.6503],
  "japan":          [35.6762, 139.6503],
};

// ── Name-based overrides ─────────────────────────────────────
// For people whose BambooHR location is "Remote" or blank but whose physical
// location is known. Keyed by lowercased displayName.
const NAME_OVERRIDES: Record<string, [number, number]> = {
  "adam jahr":        [28.5383, -81.3792],   // Orlando, FL
  "nicholay voyvik":  [-8.3405, 115.0920],   // Bali, Indonesia
};

/** Try to resolve a BambooHR employee to lat/lng.
 *  Priority: name override → location field → skip. */
function geocodeEmployee(displayName: string, location: string | null): [number, number] | null {
  // 1. Check name overrides first (handles "Remote" / blank people we know)
  const nameKey = displayName.toLowerCase().trim();
  if (NAME_OVERRIDES[nameKey]) return NAME_OVERRIDES[nameKey];

  // 2. Try the location field
  if (!location) return null;
  const normalized = location.toLowerCase().trim();
  if (normalized === "remote" || normalized === "") return null;

  // Exact match
  if (CITY_COORDS[normalized]) return CITY_COORDS[normalized];

  // Substring match
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (normalized.includes(key) || key.includes(normalized)) return coords;
  }

  // Unknown — log for debugging
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
      const coords = geocodeEmployee(m.displayName, m.location);
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
