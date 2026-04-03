const dots = [0, 1, 2];

export function LoadingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex gap-[3px] ${className}`}>
      {dots.map((i) => (
        <span
          key={i}
          className="inline-block w-[5px] h-[5px] rounded-full bg-current animate-[dotPulse_1.2s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  );
}
