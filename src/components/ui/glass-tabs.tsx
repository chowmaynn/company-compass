/**
 * Glass-morphism pill tab selector — matches the Dashboard's segmented control aesthetic.
 * Replaces the various border-b + pink underline tab patterns across department pages.
 */

import type { ReactNode } from "react";

export interface GlassTab {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface GlassTabsProps {
  tabs: GlassTab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function GlassTabs({ tabs, activeKey, onChange }: GlassTabsProps) {
  return (
    <div
      className={[
        "inline-flex items-center gap-0.5 rounded-full p-0.5",
        "bg-gradient-to-b from-black/[0.04] to-black/[0.02] dark:from-white/[0.06] dark:to-white/[0.02]",
        "backdrop-blur-xl ring-1 ring-black/15 dark:ring-white/10",
        "shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]",
      ].join(" ")}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeKey === tab.key
              ? "bg-black/[0.08] dark:bg-white/15 text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
