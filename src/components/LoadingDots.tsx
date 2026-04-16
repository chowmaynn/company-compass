// Infinity-shape spinner. Two animated strokes travel around a lemniscate path
// giving a smooth, continuous loading feel. Uses `currentColor` so it inherits
// whatever text color the parent has.

interface LoadingDotsProps {
  className?: string;
  /** Size in px of the SVG (width+height). Defaults to 24. */
  size?: number;
}

export function LoadingDots({ className = "", size = 24 }: LoadingDotsProps) {
  return (
    <>
      <style>{`
        @keyframes loading-infinity-move {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes loading-infinity-dash {
          0%, 100% { stroke-dasharray: 15 85; }
          50% { stroke-dasharray: 50 50; }
        }
      `}</style>
      <svg
        className={`inline-block ${className}`}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-label="Loading"
      >
        <path
          d="M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          pathLength="100"
          style={{
            strokeDasharray: "15 85",
            animation:
              "loading-infinity-move 2s linear infinite, loading-infinity-dash 4s ease-in-out infinite",
          }}
        />
      </svg>
    </>
  );
}
