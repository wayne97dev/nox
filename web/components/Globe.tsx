"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// react-globe.gl uses WebGL/window — load client-only so the static export
// prerender never touches it.
const GlobeInner = dynamic(() => import("./GlobeInner"), {
  ssr: false,
  loading: () => null,
});

export function Globe({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative aspect-square ${className}`}>
      {/* violet glow behind the globe */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(124,58,237,0.32), transparent 62%)",
          filter: "blur(50px)",
        }}
      />
      {size > 0 && <GlobeInner size={size} />}
    </div>
  );
}
