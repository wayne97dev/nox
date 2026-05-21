"use client";

import { useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";

interface Node {
  lat: number;
  lng: number;
}

const NODES: Node[] = [
  { lat: 37.7749, lng: -122.4194 }, // SF
  { lat: 40.7128, lng: -74.006 }, // NYC
  { lat: 51.5074, lng: -0.1278 }, // London
  { lat: 52.52, lng: 13.405 }, // Berlin
  { lat: 25.2048, lng: 55.2708 }, // Dubai
  { lat: 1.3521, lng: 103.8198 }, // Singapore
  { lat: 35.6762, lng: 139.6503 }, // Tokyo
  { lat: -33.8688, lng: 151.2093 }, // Sydney
  { lat: -23.5505, lng: -46.6333 }, // São Paulo
  { lat: 19.076, lng: 72.8777 }, // Mumbai
];

interface ArcDatum {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

function buildArcs(): ArcDatum[] {
  const arcs: ArcDatum[] = [];
  for (let i = 0; i < NODES.length; i++) {
    const a = NODES[i];
    const b = NODES[(i + 3) % NODES.length];
    arcs.push({ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng });
  }
  return arcs;
}

export default function GlobeInner({ size }: { size: number }) {
  // react-globe.gl ref is loosely typed; cast keeps strict TS happy.
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [countries, setCountries] = useState<{ features: object[] }>({ features: [] });

  useEffect(() => {
    let cancelled = false;
    fetch("/countries.geojson")
      .then((r) => r.json())
      .then((geo) => {
        if (!cancelled) setCountries(geo);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls() as unknown as {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enableZoom: boolean;
      enablePan: boolean;
    };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;
    controls.enableZoom = false;
    controls.enablePan = false;
    g.pointOfView({ lat: 18, lng: 10, altitude: 2.3 });
  }, [size]);

  const globeMaterial = new THREE.MeshPhongMaterial({
    color: new THREE.Color("#0b0918"),
    emissive: new THREE.Color("#1b1040"),
    emissiveIntensity: 0.35,
    shininess: 1,
  });

  return (
    <Globe
      ref={globeRef as never}
      width={size}
      height={size}
      backgroundColor="rgba(0,0,0,0)"
      globeMaterial={globeMaterial as never}
      showAtmosphere
      atmosphereColor="#8b5cf6"
      atmosphereAltitude={0.22}
      hexPolygonsData={countries.features}
      hexPolygonResolution={3}
      hexPolygonMargin={0.4}
      hexPolygonUseDots
      hexPolygonColor={() => "rgba(167,139,250,0.55)"}
      hexPolygonAltitude={0.006}
      arcsData={buildArcs()}
      arcColor={() => ["rgba(124,58,237,0)", "rgba(96,165,250,0.95)"]}
      arcAltitudeAutoScale={0.4}
      arcStroke={0.55}
      arcDashLength={0.45}
      arcDashGap={0.25}
      arcDashInitialGap={() => Math.random()}
      arcDashAnimateTime={2200}
      ringsData={NODES}
      ringColor={() => (t: number) => `rgba(167,139,250,${Math.sqrt(1 - t).toFixed(3)})`}
      ringMaxRadius={4}
      ringPropagationSpeed={2.2}
      ringRepeatPeriod={1500}
      pointsData={NODES}
      pointColor={() => "#c4b5fd"}
      pointAltitude={0.012}
      pointRadius={0.32}
    />
  );
}
