"use client";

/**
 * Launch price-model chart for the genesis page.
 *
 * Nox uses a FIXED-price genesis, so the honest "bonding curve" is:
 *   - a flat line at the genesis price across the 60% genesis allocation
 *   - a step up (~3× at full cap) when the v4 pool seeds and the market opens
 *
 * The bright solid portion + glowing marker track the LIVE progress
 * (unitsSold / cap). Everything is derived from on-chain constants, not predictions.
 */

interface GenesisCurveProps {
  /** unitsSold / capUnits, 0..1 */
  progress: number;
  /** genesis price per 1,000 NOX, in ETH (e.g. 0.00001) */
  genesisPriceEth: number;
  /** ETH raised so far (for the marker label) */
  ethRaised: number;
}

const VB_W = 1000;
const VB_H = 380;
const PAD = { l: 78, r: 28, t: 34, b: 46 };

// supply layout (% of total supply)
const GENESIS_END = 60; // 60% genesis
const LP_END = 80; // +20% LP

export function GenesisCurve({ progress, genesisPriceEth, ethRaised }: GenesisCurveProps) {
  const gp = genesisPriceEth || 0.00001;
  const lp = gp * 3; // full-cap market-open price (6 ETH / 200M = 3× genesis)
  const maxY = lp * 1.4;

  const plotW = VB_W - PAD.l - PAD.r;
  const plotH = VB_H - PAD.t - PAD.b;

  const px = (pct: number) => PAD.l + (pct / 100) * plotW;
  const py = (price: number) => PAD.t + plotH - (price / maxY) * plotH;

  const clamped = Math.max(0, Math.min(1, progress));
  const progressPct = clamped * GENESIS_END; // map genesis progress onto 0..60%

  const yGp = py(gp);
  const yLp = py(lp);
  const xProg = px(progressPct);
  const xGenEnd = px(GENESIS_END);
  const xLpEnd = px(LP_END);

  // area under the live (sold) genesis portion
  const areaPath = `M ${px(0)} ${py(0)} L ${px(0)} ${yGp} L ${xProg} ${yGp} L ${xProg} ${py(0)} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto" role="img" aria-label="Genesis launch price model">
        <defs>
          <linearGradient id="gcArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gcLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
          <linearGradient id="gcLp" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <filter id="gcGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* phase bands */}
        <rect x={px(0)} y={PAD.t} width={xGenEnd - px(0)} height={plotH} fill="#A78BFA" opacity="0.04" />
        <rect x={xGenEnd} y={PAD.t} width={px(100) - xGenEnd} height={plotH} fill="#3B82F6" opacity="0.04" />

        {/* horizontal gridlines at 0 / gp / lp */}
        {[0, gp, lp].map((v, i) => (
          <line
            key={i}
            x1={PAD.l}
            y1={py(v)}
            x2={VB_W - PAD.r}
            y2={py(v)}
            stroke="#ffffff"
            strokeOpacity="0.06"
            strokeDasharray={i === 0 ? "0" : "4 6"}
          />
        ))}

        {/* y labels */}
        <text x={PAD.l - 12} y={yGp + 4} textAnchor="end" fontSize="20" fill="#9CA3AF" fontFamily="monospace">
          {gp.toFixed(5)}
        </text>
        <text x={PAD.l - 12} y={yLp + 4} textAnchor="end" fontSize="20" fill="#9CA3AF" fontFamily="monospace">
          {lp.toFixed(5)}
        </text>
        <text x={PAD.l - 12} y={py(0) + 4} textAnchor="end" fontSize="18" fill="#6B7280" fontFamily="monospace">
          ETH
        </text>

        {/* area under live genesis */}
        <path d={areaPath} fill="url(#gcArea)" />

        {/* genesis sold (solid bright) */}
        <line x1={px(0)} y1={yGp} x2={xProg} y2={yGp} stroke="url(#gcLine)" strokeWidth="4" strokeLinecap="round" />
        {/* genesis remaining (dashed faint) */}
        <line
          x1={xProg}
          y1={yGp}
          x2={xGenEnd}
          y2={yGp}
          stroke="#A78BFA"
          strokeOpacity="0.35"
          strokeWidth="3"
          strokeDasharray="6 8"
          strokeLinecap="round"
        />

        {/* step riser at seed */}
        <line
          x1={xGenEnd}
          y1={yGp}
          x2={xGenEnd}
          y2={yLp}
          stroke="#6366F1"
          strokeOpacity="0.5"
          strokeWidth="2.5"
          strokeDasharray="6 6"
        />

        {/* LP / market line */}
        <line x1={xGenEnd} y1={yLp} x2={xLpEnd} y2={yLp} stroke="url(#gcLp)" strokeWidth="4" strokeLinecap="round" />
        {/* faint projected market beyond LP */}
        <path
          d={`M ${xLpEnd} ${yLp} Q ${px(90)} ${py(lp * 1.15)} ${px(100)} ${py(lp * 1.25)}`}
          fill="none"
          stroke="#3B82F6"
          strokeOpacity="0.3"
          strokeWidth="2.5"
          strokeDasharray="5 7"
        />

        {/* live marker */}
        <circle cx={xProg} cy={yGp} r="9" fill="#A78BFA" filter="url(#gcGlow)" />
        <circle cx={xProg} cy={yGp} r="4" fill="#fff" />

        {/* marker callout */}
        <g transform={`translate(${Math.min(xProg, px(GENESIS_END) - 150)}, ${yGp - 54})`}>
          <rect width="156" height="40" rx="9" fill="#0B0B17" stroke="#A78BFA" strokeOpacity="0.35" />
          <text x="12" y="17" fontSize="15" fill="#9CA3AF">
            You are here
          </text>
          <text x="12" y="33" fontSize="15" fill="#E8E8F0" fontFamily="monospace">
            {ethRaised.toFixed(3)} ETH raised
          </text>
        </g>

        {/* phase labels */}
        <text x={(px(0) + xGenEnd) / 2} y={VB_H - 16} textAnchor="middle" fontSize="19" fill="#A78BFA" fontWeight="600">
          GENESIS · fixed price
        </text>
        <text x={(xGenEnd + px(100)) / 2} y={VB_H - 16} textAnchor="middle" fontSize="19" fill="#60A5FA" fontWeight="600">
          MARKET · v4 pool (~3×)
        </text>

        {/* seed divider label */}
        <text x={xGenEnd} y={PAD.t - 12} textAnchor="middle" fontSize="16" fill="#6B7280">
          seed →
        </text>
      </svg>
    </div>
  );
}
