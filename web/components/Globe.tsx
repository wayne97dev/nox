"use client";

import createGlobe, { type COBEOptions } from "cobe";
import { useEffect, useRef } from "react";

// cobe@2's published .d.ts omits `onRender`, but it's supported at runtime.
type GlobeOptions = COBEOptions & { onRender: (state: Record<string, number>) => void };

/**
 * Rotating dotted WebGL globe (cobe), tinted to the Nox violet palette.
 * Auto-rotates; drag to spin. Markers act as abstract "network nodes".
 */
export function Globe({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerMovement = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let phi = 0;
    let width = 0;
    const onResize = () => {
      width = canvas.offsetWidth;
    };
    window.addEventListener("resize", onResize);
    onResize();

    const opts: GlobeOptions = {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.2,
      dark: 0.65,
      diffuse: 1.25,
      mapSamples: 18000,
      mapBrightness: 8.5,
      mapBaseBrightness: 0.18,
      baseColor: [0.46, 0.38, 0.76], // violet land dots (clearly visible)
      markerColor: [0.95, 0.8, 1.0], // bright iris nodes
      glowColor: [0.45, 0.32, 0.9], // violet atmosphere
      markers: [
        { location: [37.7595, -122.4367], size: 0.05 }, // SF
        { location: [40.7128, -74.006], size: 0.06 }, // NYC
        { location: [51.5074, -0.1278], size: 0.05 }, // London
        { location: [52.52, 13.405], size: 0.04 }, // Berlin
        { location: [35.6762, 139.6503], size: 0.05 }, // Tokyo
        { location: [1.3521, 103.8198], size: 0.04 }, // Singapore
        { location: [-23.5505, -46.6333], size: 0.04 }, // São Paulo
        { location: [25.2048, 55.2708], size: 0.04 }, // Dubai
        { location: [-33.8688, 151.2093], size: 0.04 }, // Sydney
      ],
      onRender: (state) => {
        if (pointerInteracting.current === null) phi += 0.004;
        state.phi = phi + pointerMovement.current / 200;
        state.width = width * 2;
        state.height = width * 2;
      },
    };

    const globe = createGlobe(canvas, opts);

    // fade in once the first frame renders
    const t = setTimeout(() => {
      if (canvasRef.current) canvasRef.current.style.opacity = "1";
    }, 100);

    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* violet glow behind the globe */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(circle at 50% 45%, rgba(124,58,237,0.35), transparent 60%)",
          filter: "blur(40px)",
        }}
      />
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX - pointerMovement.current;
          canvasRef.current!.style.cursor = "grabbing";
        }}
        onPointerUp={() => {
          pointerInteracting.current = null;
          canvasRef.current!.style.cursor = "grab";
        }}
        onPointerOut={() => {
          pointerInteracting.current = null;
          canvasRef.current!.style.cursor = "grab";
        }}
        onMouseMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerMovement.current = delta;
          }
        }}
        onTouchMove={(e) => {
          if (pointerInteracting.current !== null && e.touches[0]) {
            const delta = e.touches[0].clientX - pointerInteracting.current;
            pointerMovement.current = delta;
          }
        }}
        style={{
          width: "100%",
          height: "100%",
          aspectRatio: "1",
          cursor: "grab",
          contain: "layout paint size",
          opacity: 0,
          transition: "opacity 1s ease",
        }}
      />
    </div>
  );
}
