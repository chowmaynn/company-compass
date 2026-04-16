import { useMemo } from "react";
import TeamGlobe, { type TeamPin } from "@/components/ui/team-globe";
import { useTeamDirectory } from "@/hooks/use-team-directory";
import { LoadingIndicator } from "@/components/LoadingIndicator";

export default function HRPage() {
  const { pins: directoryPins, loading } = useTeamDirectory();

  // Map directory pins to the globe's TeamPin shape
  const globePins: TeamPin[] = useMemo(
    () =>
      directoryPins.map((p) => ({
        firstName: p.firstName,
        displayName: p.displayName,
        lat: p.lat,
        lng: p.lng,
        department: p.department,
      })),
    [directoryPins]
  );

  return (
    <div className="h-[calc(100vh-4rem)] w-full overflow-hidden relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <LoadingIndicator size={32} className="text-muted-foreground" />
        </div>
      )}
      <TeamGlobe width={window.innerWidth} height={window.innerHeight - 64} pins={globePins} />
    </div>
  );
}
