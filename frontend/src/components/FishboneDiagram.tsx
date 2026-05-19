interface Category { id: number; name: string; colour: string }
interface Cause { id: number; category_id: number; description: string }

interface Props {
  title: string;
  categories: Category[];
  causes: Cause[];
}

const W = 1200;
const SPINE_START = 140;
const SPINE_END = 1050;
const HEAD_X = SPINE_END + 10;
const HEAD_W = W - HEAD_X - 10;
const HEAD_H = 100;
const BONE_ANGLE = Math.PI / 4;
const MIN_BONE_LENGTH = 130;
const HORIZ_PER_CAUSE = 52; // horizontal px per cause slot → bone grows with cause count
const BONE_MARGIN = 80;     // vertical padding above/below bone tips for labels + boxes
const CAUSE_BRANCH_LEN = 20;
const BOX_W = 140;
const BOX_PADDING = 5;
const LINE_H = 13;
const CHARS_PER_LINE = 19;

function wrapText(text: string): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= CHARS_PER_LINE) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > CHARS_PER_LINE ? word.slice(0, CHARS_PER_LINE - 1) + '…' : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export default function FishboneDiagram({ title, categories, causes }: Props) {
  if (categories.length === 0) return null;

  const sortedCategories = [...categories].sort((a, b) => a.id - b.id);
  const N = sortedCategories.length;
  const spacing = (SPINE_END - SPINE_START) / (N + 1);

  const cosA = Math.cos(BONE_ANGLE);
  const sinA = Math.sin(BONE_ANGLE);

  // Bone length scales with the number of causes so each cause has room to breathe
  const getBoneLength = (n: number) =>
    Math.max(MIN_BONE_LENGTH, Math.ceil(HORIZ_PER_CAUSE * (n + 1) / cosA));

  // Drive the SVG height from the longest bone
  const maxBoneLen = sortedCategories.reduce((max, cat) => {
    const n = causes.filter(c => c.category_id === cat.id).length;
    return Math.max(max, getBoneLength(n));
  }, MIN_BONE_LENGTH);

  const H = Math.max(400, Math.ceil((maxBoneLen * sinA + BONE_MARGIN) * 2));
  const SPINE_Y = H / 2;

  // Extend viewBox left edge to include bone tips and category labels
  const firstSpineX = SPINE_START + spacing;
  const leftTipX = firstSpineX - maxBoneLen * cosA;
  const viewBoxLeft = Math.min(0, Math.floor(leftTipX - 150)); // 150px buffer for label text
  const viewBoxWidth = W - viewBoxLeft;

  return (
    <div className="card mb-6">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">Fishbone Diagram — Selected Causes</h3>
      {causes.length === 0 && (
        <p className="text-xs text-gray-400 italic mb-2">No causes selected yet — diagram will populate as the facilitator selects causes.</p>
      )}
      <svg viewBox={`${viewBoxLeft} 0 ${viewBoxWidth} ${H}`} className="w-full">
        <defs>
          <marker id="fb-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
          </marker>
        </defs>

        {/* Spine */}
        <line
          x1={SPINE_START} y1={SPINE_Y}
          x2={SPINE_END} y2={SPINE_Y}
          stroke="#6366f1" strokeWidth={3}
          markerEnd="url(#fb-arrow)"
        />

        {/* Head box */}
        <rect
          x={HEAD_X} y={SPINE_Y - HEAD_H / 2}
          width={HEAD_W} height={HEAD_H}
          rx={8} fill="#eef2ff" stroke="#6366f1" strokeWidth={2}
        />
        <foreignObject
          x={HEAD_X + 8} y={SPINE_Y - HEAD_H / 2 + 8}
          width={HEAD_W - 16} height={HEAD_H - 16}
        >
          <div
            // @ts-ignore - xmlns required for foreignObject
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              fontSize: 11, fontWeight: 600, color: "#3730a3",
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
          const spineX = SPINE_START + spacing * (i + 1);
          const isTop = i % 2 === 0;
          const sign = isTop ? -1 : 1;

          const catCauses = causes.filter(c => c.category_id === cat.id).sort((a, b) => a.id - b.id);

          const outerX = spineX - maxBoneLen * cosA;
          const outerY = SPINE_Y + sign * maxBoneLen * sinA;

          return (
            <g key={cat.id}>
              {/* Main bone */}
              <line
                x1={outerX} y1={outerY}
                x2={spineX} y2={SPINE_Y}
                stroke={cat.colour} strokeWidth={2.5}
              />

              {/* Category label at outer tip */}
              <text
                x={outerX - 8}
                y={isTop ? outerY - 8 : outerY + 18}
                textAnchor="end"
                fontSize={13}
                fontWeight="700"
                fill={cat.colour}
              >
                {cat.name}
              </text>

              {/* Cause branches */}
              {catCauses.map((cause, j) => {
                const t = (j + 1) / (catCauses.length + 1);
                const bx = outerX + t * (spineX - outerX);
                const by = outerY + t * (SPINE_Y - outerY);
                const branchEndY = by + sign * CAUSE_BRANCH_LEN;
                const lines = wrapText(cause.description);
                const boxH = lines.length * LINE_H + BOX_PADDING * 2;
                const boxY = isTop ? branchEndY - boxH : branchEndY;
                const textStartY = boxY + BOX_PADDING + LINE_H / 2;

                return (
                  <g key={cause.id}>
                    <title>{cause.description}</title>
                    <line
                      x1={bx} y1={by}
                      x2={bx} y2={branchEndY}
                      stroke={cat.colour} strokeWidth={1.5} strokeOpacity={0.65}
                    />
                    <rect
                      x={bx - BOX_W / 2} y={boxY}
                      width={BOX_W} height={boxH}
                      rx={3} fill="white"
                      stroke={cat.colour} strokeWidth={1} strokeOpacity={0.7}
                    />
                    <text
                      x={bx}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10}
                      fill="#374151"
                    >
                      {lines.map((line, li) => (
                        <tspan key={li} x={bx} y={textStartY + li * LINE_H}>
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
      </svg>
    </div>
  );
}
