"use client";

/**
 * Genesis raise-progress chart.
 *
 * ETH raised climbs linearly toward the cap (fixed-price sale). The solid line +
 * gradient fill track what's been raised so far; the dashed projection runs to the
 * cap target where the v4 pool seeds. A glowing marker shows the live position.
 */

interface GenesisCurveProps {
  /** lotsSold / capLots, 0..1 */
  progress: number;
  /** ETH raised so far */
  ethRaised: number;
  /** ETH target at full cap (e.g. 10) */
  ethTarget: number;
}

const VB_W = 1000;
const VB_H = 360;
const PAD = { l: 92, r: 44, t: 30, b: 46 };

export function GenesisCurve({ progress, ethRaised, ethTarget }: GenesisCurveProps) {
  const target = ethTarget > 0 ? ethTarget : 10;
  const maxY = target * 1.12;
  const clamped = Math.max(0, Math.min(1, progress));

  const plotW = VB_W - PAD.l - PAD.r;
  const plotH = VB_H - PAD.t - PAD.b;

  const px = (pct: number) => PAD.l + pct * plotW; // pct 0..1
  const py = (eth: number) => PAD.t + plotH - (eth / maxY) * plotH;

  const x0 = px(0);
  const y0 = py(0);
  const mx = px(clamped);
  const my = py(ethRaised);
  const xCap = px(1);
  const yCap = py(target);

  const areaPath = `M ${x0} ${y0} L ${mx} ${my} L ${mx} ${y0} Z`;

  // callout stays inside the plot
  const calloutX = Math.min(Math.max(mx + 10, x0), xCap - 168);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto" role="img" aria-label="Genesis raise progress">
        <defs>
          <linearGradient id="gcArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gcLine" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>
          <filter id="gcGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* y gridlines + labels: 0, half, target */}
        {[0, target / 2, target].map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              y1={py(v)}
              x2={VB_W - PAD.r}
              y2={py(v)}
              stroke="#ffffff"
              strokeOpacity="0.06"
              strokeDasharray={i === 0 ? "0" : "4 7"}
            />
            <text x={PAD.l - 14} y={py(v) + 6} textAnchor="end" fontSize="19" fill="#9CA3AF" fontFamily="monospace">
              {v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}
            </text>
          </g>
        ))}
        <text x={PAD.l - 14} y={PAD.t - 8} textAnchor="end" fontSize="16" fill="#6B7280" fontFamily="monospace">
          ETH
        </text>

        {/* filled area under the raised-so-far line */}
        <path d={areaPath} fill="url(#gcArea)" />

        {/* projection from marker to cap (dashed) */}
        <line
          x1={mx}
          y1={my}
          x2={xCap}
          y2={yCap}
          stroke="#60A5FA"
          strokeOpacity="0.45"
          strokeWidth="3"
          strokeDasharray="7 8"
          strokeLinecap="round"
        />

        {/* raised-so-far line (solid) */}
        <line x1={x0} y1={y0} x2={mx} y2={my} stroke="url(#gcLine)" strokeWidth="4.5" strokeLinecap="round" />

        {/* cap target marker + flag */}
        <circle cx={xCap} cy={yCap} r="5" fill="#60A5FA" />
        <line x1={xCap} y1={yCap} x2={xCap} y2={py(0)} stroke="#60A5FA" strokeOpacity="0.25" strokeDasharray="3 6" />
        <text x={xCap} y={yCap - 14} textAnchor="end" fontSize="18" fill="#60A5FA" fontFamily="monospace">
          {target.toFixed(0)} ETH · cap → seed
        </text>

        {/* live marker */}
        <circle cx={mx} cy={my} r="9" fill="#A78BFA" filter="url(#gcGlow)" />
        <circle cx={mx} cy={my} r="4" fill="#fff" />

        {/* callout */}
        <g transform={`translate(${calloutX}, ${Math.max(my - 56, PAD.t)})`}>
          <rect width="170" height="42" rx="9" fill="#0B0B17" stroke="#A78BFA" strokeOpacity="0.35" />
          <text x="13" y="18" fontSize="15" fill="#9CA3AF">
            You are here
          </text>
          <text x="13" y="34" fontSize="15" fill="#E8E8F0" fontFamily="monospace">
            {ethRaised.toFixed(3)} ETH raised
          </text>
        </g>

        {/* x labels */}
        <text x={x0} y={VB_H - 14} textAnchor="start" fontSize="17" fill="#6B7280" fontFamily="monospace">
          0
        </text>
        <text x={(x0 + xCap) / 2} y={VB_H - 14} textAnchor="middle" fontSize="18" fill="#A78BFA" fontWeight="600">
          {(clamped * 100).toFixed(1)}% of cap raised
        </text>
        <text x={xCap} y={VB_H - 14} textAnchor="end" fontSize="17" fill="#6B7280" fontFamily="monospace">
          1,000 lots
        </text>
      </svg>
    </div>
  );
}
