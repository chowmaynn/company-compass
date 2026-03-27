import { useState, useRef, useEffect } from "react";
import { formatValue } from "@/lib/formatNumber";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: number | string;
  onChange?: (value: number | string) => void;
  className?: string;
  isProjection?: boolean;
}

export function EditableCell({ value, onChange, className, isProjection }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed === String(value)) return;

    // Try to parse as number
    const parsed = Number(trimmed.replace(/,/g, ""));
    if (!isNaN(parsed) && /^[\d,]+(\.\d+)?$/.test(trimmed.replace(/,/g, ""))) {
      onChange?.(parsed);
    } else {
      onChange?.(trimmed);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        className={cn(
          "w-full rounded border border-primary/50 bg-background px-1.5 py-0.5 text-right font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-primary",
          className
        )}
      />
    );
  }

  const isEmpty = value === "—" || value === "" || value === "–";

  return (
    <span
      onClick={onChange ? () => {
        setEditValue(String(value));
        setEditing(true);
      } : undefined}
      className={cn(
        "block rounded px-1.5 py-0.5 font-mono text-sm transition-colors",
        onChange ? "cursor-pointer hover:bg-primary/10" : "",
        isProjection ? "text-muted-foreground" : "text-foreground/80",
        isEmpty && !isProjection && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400/70",
        className
      )}
      title={onChange ? "Click to edit" : undefined}
    >
      {formatValue(value)}
    </span>
  );
}
