/**
 * Reusable Recharts tooltip component.
 *
 * Usage:
 *   <Tooltip content={<ChartTooltip formatter={(v) => `${v} bookings`} />} />
 *   <Tooltip content={<ChartTooltip formatter={(v, name) => `${name}: ${fmtCurrency(v)}`} />} />
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  /** Format a single payload entry. Receives value and series name. */
  formatter: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {formatter(p.value, p.name)}
        </p>
      ))}
    </div>
  );
}
