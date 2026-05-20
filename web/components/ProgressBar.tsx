interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
}

export function ProgressBar({ value, className = "" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`relative h-3 w-full overflow-hidden rounded-full bg-veil/60 ${className}`}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${clamped}%`,
          background: "linear-gradient(90deg, #7C3AED 0%, #A78BFA 50%, #3B82F6 100%)",
          boxShadow: "0 0 20px -4px rgba(167, 139, 250, 0.6)",
        }}
      />
      <div
        className="absolute inset-y-0 left-0 rounded-full opacity-50 mix-blend-screen"
        style={{
          width: `${clamped}%`,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 2.5s linear infinite",
        }}
      />
    </div>
  );
}
