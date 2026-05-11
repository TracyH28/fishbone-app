const STAGES = [
  { n: 1, label: "Cause Entry" },
  { n: 2, label: "Alignment" },
  { n: 3, label: "Risk Rating" },
  { n: 4, label: "Actions" },
  { n: 5, label: "Residual Risk" },
];

export default function StageIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 w-full mb-6 overflow-x-auto">
      {STAGES.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1 min-w-0">
          <div className={`flex flex-col items-center flex-1 min-w-0 ${current === s.n ? "opacity-100" : current > s.n ? "opacity-60" : "opacity-30"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2
              ${current === s.n ? "bg-indigo-600 border-indigo-600 text-white" :
                current > s.n ? "bg-green-500 border-green-500 text-white" :
                "bg-white border-gray-300 text-gray-400"}`}>
              {current > s.n ? "✓" : s.n}
            </div>
            <span className="text-xs mt-1 text-center leading-tight px-1 truncate w-full text-center">{s.label}</span>
          </div>
          {i < STAGES.length - 1 && (
            <div className={`h-0.5 w-4 flex-shrink-0 ${current > s.n ? "bg-green-400" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
