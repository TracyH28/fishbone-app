type Rating = "high" | "medium" | "low";

export default function RiskBadge({ rating }: { rating: Rating | null | undefined }) {
  if (!rating) return <span className="text-gray-400 text-xs">—</span>;
  const cls = { high: "badge-high", medium: "badge-medium", low: "badge-low" }[rating];
  return <span className={cls}>{rating.charAt(0).toUpperCase() + rating.slice(1)}</span>;
}
