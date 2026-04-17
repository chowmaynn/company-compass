import { useMemo } from "react";
import TeamGlobe, { type TeamPin } from "@/components/ui/team-globe";
import { useTeamDirectory } from "@/hooks/use-team-directory";
import { LoadingIndicator } from "@/components/LoadingIndicator";

export default function HRPage() {
  const { pins: directoryPins, loading } = useTeamDirectory();

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
      {/* Centered heading overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
        <h1 className="text-4xl font-bold text-foreground uppercase tracking-widest">Coming Soon</h1>
        <p className="text-sm text-muted-foreground mt-2">HR page buildout</p>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <LoadingIndicator size={32} className="text-muted-foreground" />
        </div>
      )}
      <TeamGlobe width={window.innerWidth} height={window.innerHeight - 64} pins={globePins} />
    </div>
  );
}
