import { Fragment } from "react";

/** A compact numbered step strip used at the top of the stealth flows. */
export function StealthFlow({ steps, className = "" }: { steps: string[]; className?: string }) {
  return (
    <div
      className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 ${className}`}
    >
      {steps.map((s, i) => (
        <Fragment key={i}>
          <div className="flex items-center gap-2.5 px-2 py-1 flex-1">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-iris/30 bg-iris/[0.08] font-mono text-xs text-iris">
              {i + 1}
            </span>
            <span className="text-sm text-mist font-light">{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className="hidden sm:block h-px w-6 bg-gradient-to-r from-iris/30 to-transparent shrink-0" />
          )}
        </Fragment>
      ))}
    </div>
  );
}
