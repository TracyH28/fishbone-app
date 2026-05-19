interface Category { id: number; name: string; colour: string }
interface Cause {
  id: number;
  category_id: number;
  description: string;
  cause_type?: "lesson_learned" | "new_project_approach";
}

interface Props {
  title: string;
  categories: Category[];
  causes: Cause[];
  /** Optional risk ratings keyed by cause id — adds a coloured left-border to each box */
  riskData?: Record<number, "high" | "medium" | "low">;
}

// ─── Layout constants ────────────────────────────────────────────────────────
const W             = 1200;
const SPINE_START   = 140;
const SPINE_END     = 1050;
const HEAD_X        = SPINE_END + 10;
const HEAD_W        = W - HEAD_X - 10;
const HEAD_H        = 100;
const BONE_ANGLE    = Math.PI / 4;
const MIN_BONE_LEN  = 130;
const HORIZ_PER_CAUSE = 52;
const BONE_MARGIN   = 100;   // vertical padding for labels + boxes
const CAUSE_BRANCH_LEN = 20;
const BOX_W         = 144;
const BOX_PADDING   = 5;
const LINE_H        = 13;
const CHARS_PER_LINE = 19;
const RISK_BAR_W    = 4;     // width of the coloured risk left-border strip

// ─── Brand colours ───────────────────────────────────────────────────────────
const TEAL   = "#009999";
const TEAL_DARK = "#007777";
const NAVY   = "#000028";

const RISK_COLOURS: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#22c55e",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function wrapText(text: string): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= CHARS_PER_LINE) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > CHARS_PER_LINE ? word.slice(0, CHARS_PER_LINE - 1) + "…" : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Bone length grows with number of causes so labels don't crowd */
function getBoneLength(n: number): number {
  return Math.max(MIN_BONE_LEN, Math.ceil(HORIZ_PER_CAUSE * (n + 1) / Math.cos(BONE_ANGLE)));
}

/** Lighten a hex colour by mixing with white at the given opacity (0–1) */
function tintColour(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c * opacity + 255 * (1 - opacity));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function FishboneDiagram({ title, categories, causes, riskData }: Props) {
  if (categories.length === 0) return null;

  const sortedCategories = [...categories].sort((a, b) => a.id - b.id);
  const N = sortedCategories.length;
  const spacing = (SPINE_END - SPINE_START) / (N + 1);

  const cosA = Math.cos(BONE_ANGLE);
  const sinA = Math.sin(BONE_ANGLE);

  // Overall height is still driven by the longest bone (for centering the spine)
  const maxBoneLen = sortedCategories.reduce((max, cat) => {
    const n = causes.filter(c => c.category_id === cat.id).length;
    return Math.max(max, getBoneLength(n));
  }, MIN_BONE_LEN);

  const H = Math.max(400, Math.ceil((maxBoneLen * sinA + BONE_MARGIN) * 2));
  const SPINE_Y = H / 2;

  // ViewBox extends left to cover the longest bone tip + label
  const firstSpineX = SPINE_START + spacing;
  const viewBoxLeft = Math.min(0, Math.floor(firstSpineX - maxBoneLen * cosA - 160));
  const viewBoxWidth = W - viewBoxLeft;

  return (
    <div className="card mb-6">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">Fishbone Diagram — Selected Causes</h3>
      {causes.length === 0 && (
        <p className="text-xs text-gray-400 italic mb-2">
          No causes selected yet — diagram will populate as the facilitator selects causes.
        </p>
      )}
      <svg viewBox={`${viewBoxLeft} 0 ${viewBoxWidth} ${H}`} className="w-full">
        <defs>
          {/* Arrow head in Siemens teal */}
          <marker id="fb-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={TEAL} />
          </marker>

          {/* Subtle drop-shadow for cause boxes */}
          <filter id="fb-shadow" x="-10%" y="-20%" width="120%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#00000018" />
          </filter>
        </defs>

        {/* Spine — teal */}
        <line
          x1={SPINE_START} y1={SPINE_Y}
          x2={SPINE_END}   y2={SPINE_Y}
          stroke={TEAL} strokeWidth={3}
          markerEnd="url(#fb-arrow)"
        />

        {/* Head box — Siemens navy/teal */}
        <rect
          x={HEAD_X} y={SPINE_Y - HEAD_H / 2}
          width={HEAD_W} height={HEAD_H}
          rx={8} fill={TEAL} stroke={TEAL_DARK} strokeWidth={2}
        />
        <foreignObject
          x={HEAD_X + 8} y={SPINE_Y - HEAD_H / 2 + 8}
          width={HEAD_W - 16} height={HEAD_H - 16}
        >
          <div
            // @ts-ignore
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              fontSize: 11, fontWeight: 700, color: "#ffffff",
              wordBreak: "break-word", textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center",
              height: "100%", lineHeight: 1.3,
            }}
          >
            {title}
          </div>
        </foreignObject>

        {/* Category bones */}
        {sortedCategories.map((cat, i) => {
          const spineX  = SPINE_START + spacing * (i + 1);
          const isTop   = i % 2 === 0;
          const sign    = isTop ? -1 : 1;
          const catCauses = causes.filter(c => c.category_id === cat.id).sort((a, b) => a.id - b.id);

          // ── Per-bone length (scales with its own cause count) ──────────────
          const boneLen = getBoneLength(catCauses.length);
          const outerX  = spineX - boneLen * cosA;
          const outerY  = SPINE_Y + sign * boneLen * sinA;

          // Pill label dimensions
          const labelText    = cat.name;
          const pillPadX     = 8;
          const pillPadY     = 4;
          const pillFontSize = 12;
          const pillW        = Math.max(60, labelText.length * pillFontSize * 0.6 + pillPadX * 2);
          const pillH        = pillFontSize + pillPadY * 2;
          const pillX        = outerX - pillW / 2;
          const pillY        = isTop ? outerY - pillH - 10 : outerY + 10;

          return (
            <g key={cat.id}>
              {/* Main bone */}
              <line
                x1={outerX} y1={outerY}
                x2={spineX} y2={SPINE_Y}
                stroke={cat.colour} strokeWidth={2.5}
              />

              {/* Pill category label */}
              <rect
                x={pillX} y={pillY}
                width={pillW} height={pillH}
                rx={pillH / 2}
                fill={cat.colour}
              />
              <text
                x={pillX + pillW / 2}
                y={pillY + pillH / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={pillFontSize}
                fontWeight="700"
                fill="#ffffff"
              >
                {labelText}
              </text>

              {/* Cause branches */}
              {catCauses.map((cause, j) => {
                const t           = (j + 1) / (catCauses.length + 1);
                const bx          = outerX + t * (spineX - outerX);
                const by          = outerY + t * (SPINE_Y - outerY);
                const branchEndY  = by + sign * CAUSE_BRANCH_LEN;
                const lines       = wrapText(cause.description);
                const boxH        = lines.length * LINE_H + BOX_PADDING * 2;
                const boxY        = isTop ? branchEndY - boxH : branchEndY;
                const textStartY  = boxY + BOX_PADDING + LINE_H / 2;
                const tint        = tintColour(cat.colour, 0.08);
                const risk        = riskData?.[cause.id];
                const isLL        = cause.cause_type === "lesson_learned";

                return (
                  <g key={cause.id} filter="url(#fb-shadow)">
                    <title>{cause.description}</title>

                    {/* Vertical branch line */}
                    <line
                      x1={bx} y1={by}
                      x2={bx} y2={branchEndY}
                      stroke={cat.colour} strokeWidth={1.5} strokeOpacity={0.65}
                    />

                    {/* Box background — category tinted */}
                    <rect
                      x={bx - BOX_W / 2} y={boxY}
                      width={BOX_W} height={boxH}
                      rx={4} fill={tint}
                      stroke={cat.colour} strokeWidth={1} strokeOpacity={0.5}
                    />

                    {/* Risk colour left-border strip (only when riskData provided) */}
                    {risk && (
                      <rect
                        x={bx - BOX_W / 2} y={boxY}
                        width={RISK_BAR_W} height={boxH}
                        rx={4}
                        fill={RISK_COLOURS[risk]}
                      />
                    )}

                    {/* Cause type dot — top-right corner */}
                    {cause.cause_type && (
                      <circle
                        cx={bx + BOX_W / 2 - 6}
                        cy={boxY + 6}
                        r={3.5}
                        fill={isLL ? TEAL : NAVY}
                        opacity={0.7}
                      />
                    )}

                    {/* Description text */}
                    <text
                      x={bx + (risk ? RISK_BAR_W / 2 : 0)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10}
                      fill="#374151"
                    >
                      {lines.map((line, li) => (
                        <tspan key={li} x={bx + (risk ? RISK_BAR_W / 2 : 0)} y={textStartY + li * LINE_H}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Legend — cause type key, bottom-left of viewbox */}
        <g transform={`translate(${viewBoxLeft + 12}, ${H - 32})`}>
          <circle cx={6} cy={6} r={4} fill={TEAL} opacity={0.7} />
          <text x={14} y={10} fontSize={9} fill="#6b7280">Lesson Learned</text>
          <circle cx={90} cy={6} r={4} fill={NAVY} opacity={0.7} />
          <text x={98} y={10} fontSize={9} fill="#6b7280">New Project Approach</text>
          {riskData && Object.keys(riskData).length > 0 && (
            <>
              <rect x={190} y={2} width={6} height={8} rx={1} fill={RISK_COLOURS.high} />
              <text x={200} y={10} fontSize={9} fill="#6b7280">High</text>
              <rect x={222} y={2} width={6} height={8} rx={1} fill={RISK_COLOURS.medium} />
              <text x={232} y={10} fontSize={9} fill="#6b7280">Medium</text>
              <rect x={265} y={2} width={6} height={8} rx={1} fill={RISK_COLOURS.low} />
              <text x={275} y={10} fontSize={9} fill="#6b7280">Low</text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
