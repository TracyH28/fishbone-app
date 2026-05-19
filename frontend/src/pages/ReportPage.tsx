import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import FishboneDiagram from "../components/FishboneDiagram";
import { Download, ArrowRight, TrendingDown, TrendingUp, Minus, MessageCircle, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import SiemensLogo from "../components/SiemensLogo";

type Rating = "high" | "medium" | "low";

// ─── Data interfaces ─────────────────────────────────────────────────────────
interface Category   { id: number; name: string; colour: string }
interface RawAction  { id: number; cause_id: number; description: string; owner: "siemens" | "csl" }
interface RawNote    { id: number; cause_id: number; participant_name: string; content: string; created_at: string }
interface Participant { id: number; display_name: string }
interface RawCause {
  id: number; category_id: number; description: string;
  cause_type: "lesson_learned" | "new_project_approach";
  selected: boolean | null;
  dismissal_reason: string | null;
}
interface VoteCount   { cause_id: number; count: string }
interface RiskFinal   { cause_id: number; stage: number; rating: Rating }
interface ResidualFinal { cause_id: number; rating: Rating }
interface RawReport {
  session: { id: number; title: string; project_name: string; stage: number; created_at: string };
  categories: Category[];
  causes: RawCause[];
  voteCounts: VoteCount[];
  riskFinals: RiskFinal[];
  residualFinals: ResidualFinal[];
  actions: RawAction[];
  participants: Participant[];
  notes: RawNote[];
}
interface EnrichedCause extends RawCause {
  vote_count: number;
  initial_risk: Rating | null;
  residual_risk: Rating | null;
  actions: RawAction[];
  notes: RawNote[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RISK_LEVEL: Record<Rating, number> = { high: 3, medium: 2, low: 1 };

const RISK_STYLES: Record<Rating, { bg: string; text: string; border: string; label: string }> = {
  high:   { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    label: "High" },
  medium: { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  label: "Medium" },
  low:    { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  label: "Low" },
};

function RiskPill({ rating }: { rating: Rating }) {
  const s = RISK_STYLES[rating];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

function RiskJourney({ initial, residual }: { initial: Rating | null; residual: Rating | null }) {
  if (!initial) return <span className="text-gray-300 text-xs">—</span>;
  if (!residual) return <RiskPill rating={initial} />;

  const delta = RISK_LEVEL[initial] - RISK_LEVEL[residual];
  const improved = delta > 0;
  const worsened = delta < 0;

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <RiskPill rating={initial} />
      <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
      <RiskPill rating={residual} />
      {improved && <TrendingDown className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
      {worsened && <TrendingUp   className="w-3.5 h-3.5 text-red-500   flex-shrink-0" />}
      {!improved && !worsened && <Minus className="w-3 h-3 text-gray-400 flex-shrink-0" />}
    </span>
  );
}

function OwnerBadge({ owner }: { owner: "siemens" | "csl" }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${
      owner === "siemens" ? "bg-siemens-teal-50 text-siemens-teal" : "bg-purple-100 text-purple-700"
    }`}>
      {owner === "siemens" ? "Siemens" : "CSL"}
    </span>
  );
}

function TypeBadge({ type }: { type: "lesson_learned" | "new_project_approach" }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
      type === "lesson_learned" ? "bg-siemens-teal-50 text-siemens-teal" : "bg-purple-100 text-purple-700"
    }`}>
      {type === "lesson_learned" ? "Lesson Learned" : "New Approach"}
    </span>
  );
}

function SectionHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-gray-900">{children}</h2>
      {sub && <p className="text-sm text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isPrint = searchParams.get("print") === "1";
  const [report, setReport] = useState<{
    session: RawReport["session"];
    categories: Category[];
    causes: EnrichedCause[];
    participants: Participant[];
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/${id}/report`).then(r => {
      const raw: RawReport = r.data;
      const voteMap     = new Map(raw.voteCounts.map(v => [v.cause_id, parseInt(v.count)]));
      const riskMap     = new Map(raw.riskFinals.filter(rf => rf.stage === 3).map(rf => [rf.cause_id, rf.rating]));
      const residualMap = new Map(raw.residualFinals.map(rf => [rf.cause_id, rf.rating]));
      const actionMap   = new Map<number, RawAction[]>();
      const noteMap     = new Map<number, RawNote[]>();
      raw.actions.forEach(a => { const arr = actionMap.get(a.cause_id) ?? []; arr.push(a); actionMap.set(a.cause_id, arr); });
      raw.notes.forEach(n => { const arr = noteMap.get(n.cause_id) ?? []; arr.push(n); noteMap.set(n.cause_id, arr); });

      const causes: EnrichedCause[] = raw.causes.map(c => ({
        ...c,
        vote_count:    voteMap.get(c.id) ?? 0,
        initial_risk:  riskMap.get(c.id)     ?? null,
        residual_risk: residualMap.get(c.id) ?? null,
        actions:       actionMap.get(c.id)   ?? [],
        notes:         noteMap.get(c.id)     ?? [],
      }));
      setReport({ session: raw.session, categories: raw.categories, causes, participants: raw.participants ?? [] });
    }).catch(() => setError("Failed to load report"));
  }, [id]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-600">{error}</p>
    </div>
  );
  if (!report) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Loading report…</p>
    </div>
  );

  const { session, categories, causes, participants } = report;
  const sortedCategories = [...categories].sort((a, b) => a.id - b.id);
  const categoryOrder    = Object.fromEntries(sortedCategories.map((c, i) => [c.id, i]));
  const sortedCauses     = [...causes].sort((a, b) => categoryOrder[a.category_id] - categoryOrder[b.category_id] || a.id - b.id);
  const selectedCauses   = sortedCauses.filter(c => c.selected === true);
  const dismissedCauses  = sortedCauses.filter(c => c.selected === false);
  const categoryMap      = Object.fromEntries(categories.map(c => [c.id, c]));
  const allActions       = selectedCauses.flatMap(c => c.actions.map(a => ({ ...a, cause: c })));
  const siemensActions   = allActions.filter(a => a.owner === "siemens");
  const cslActions       = allActions.filter(a => a.owner === "csl");

  // Risk breakdown counts
  const initialCounts  = { high: 0, medium: 0, low: 0, none: 0 };
  const residualCounts = { high: 0, medium: 0, low: 0, none: 0 };
  const hasResidual    = selectedCauses.some(c => c.residual_risk);
  selectedCauses.forEach(c => {
    if (c.initial_risk)  initialCounts[c.initial_risk]++;
    else initialCounts.none++;
    if (c.residual_risk) residualCounts[c.residual_risk]++;
    else residualCounts.none++;
  });

  // Group selected causes by category
  const causesByCategory = sortedCategories
    .map(cat => ({
      cat,
      causes: selectedCauses.filter(c => c.category_id === cat.id),
    }))
    .filter(g => g.causes.length > 0);

  function downloadPdf() {
    const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
    window.open(`${apiBase}/api/${id}/pdf`, "_blank");
  }

  return (
    <div className={`min-h-screen bg-white ${isPrint ? "p-8" : "p-4 md:p-8"}`}>
      <div className="max-w-5xl mx-auto">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-siemens-teal">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <SiemensLogo heightClass="h-7" showWordmark={true} />
              <span className="text-sm font-medium text-siemens-teal ml-1">· Fishbone Risk Review</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{session.title}</h1>
            <p className="text-lg text-gray-500 mt-1">{session.project_name}</p>
            <p className="text-sm text-gray-400 mt-1">
              {new Date(session.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              <span className="mx-2 text-gray-200">|</span>
              Session ID: {session.id}
            </p>
          </div>
          {!isPrint && (
            <button onClick={downloadPdf} className="btn-secondary flex-shrink-0">
              <Download className="w-4 h-4" /> Export PDF
            </button>
          )}
        </div>

        {/* ── Key metrics ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Causes Identified" value={causes.length}         colour="text-gray-900" />
          <StatCard label="Causes Selected"   value={selectedCauses.length} colour="text-siemens-teal" />
          <StatCard label="Actions Defined"   value={allActions.length}     colour="text-gray-900" />
          <StatCard label="Participants"       value={participants.length}   colour="text-gray-900" />
        </div>

        {/* ── Participants ──────────────────────────────────────────────── */}
        {participants.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Participants
            </p>
            <div className="flex flex-wrap gap-2">
              {participants.map(p => (
                <span key={p.id} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-700 shadow-sm">
                  {p.display_name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Risk summary ──────────────────────────────────────────────── */}
        {selectedCauses.length > 0 && (
          <div className={`mb-8 rounded-xl border border-gray-200 overflow-hidden ${hasResidual ? "grid grid-cols-2 divide-x divide-gray-200" : ""}`}>
            {/* Initial risk */}
            <div className="p-4 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Initial Risk
              </p>
              <div className="flex items-center gap-5">
                {(["high", "medium", "low"] as Rating[]).map(r => (
                  <div key={r} className="flex items-center gap-1.5">
                    <span className={`text-2xl font-bold ${RISK_STYLES[r].text}`}>{initialCounts[r]}</span>
                    <span className="text-xs text-gray-500">{RISK_STYLES[r].label}</span>
                  </div>
                ))}
                {initialCounts.none > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-bold text-gray-300">{initialCounts.none}</span>
                    <span className="text-xs text-gray-400">Unrated</span>
                  </div>
                )}
              </div>
              <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mt-3">
                {initialCounts.high > 0   && <div className="bg-red-400   rounded-sm" style={{ flex: initialCounts.high }} />}
                {initialCounts.medium > 0 && <div className="bg-amber-400 rounded-sm" style={{ flex: initialCounts.medium }} />}
                {initialCounts.low > 0    && <div className="bg-green-400 rounded-sm" style={{ flex: initialCounts.low }} />}
                {initialCounts.none > 0   && <div className="bg-gray-200  rounded-sm" style={{ flex: initialCounts.none }} />}
              </div>
            </div>

            {/* Residual risk (only if at least one cause has been re-rated) */}
            {hasResidual && (
              <div className="p-4 bg-green-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Residual Risk (post-actions)
                </p>
                <div className="flex items-center gap-5">
                  {(["high", "medium", "low"] as Rating[]).map(r => (
                    <div key={r} className="flex items-center gap-1.5">
                      <span className={`text-2xl font-bold ${RISK_STYLES[r].text}`}>{residualCounts[r]}</span>
                      <span className="text-xs text-gray-500">{RISK_STYLES[r].label}</span>
                    </div>
                  ))}
                  {residualCounts.none > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl font-bold text-gray-300">{residualCounts.none}</span>
                      <span className="text-xs text-gray-400">Unrated</span>
                    </div>
                  )}
                </div>
                <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mt-3">
                  {residualCounts.high > 0   && <div className="bg-red-400   rounded-sm" style={{ flex: residualCounts.high }} />}
                  {residualCounts.medium > 0 && <div className="bg-amber-400 rounded-sm" style={{ flex: residualCounts.medium }} />}
                  {residualCounts.low > 0    && <div className="bg-green-400 rounded-sm" style={{ flex: residualCounts.low }} />}
                  {residualCounts.none > 0   && <div className="bg-gray-200  rounded-sm" style={{ flex: residualCounts.none }} />}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Fishbone diagram ──────────────────────────────────────────── */}
        <FishboneDiagram
          title={session.title}
          categories={categories}
          causes={selectedCauses}
          riskData={Object.fromEntries(
            selectedCauses.filter(c => c.initial_risk).map(c => [c.id, c.initial_risk as Rating])
          )}
        />

        {/* ── Selected Causes — grouped by category ─────────────────────── */}
        {selectedCauses.length > 0 && (
          <div className="mb-10">
            <SectionHeading sub={`${selectedCauses.length} cause${selectedCauses.length !== 1 ? "s" : ""} taken forward across ${causesByCategory.length} categor${causesByCategory.length !== 1 ? "ies" : "y"}`}>
              Selected Causes
            </SectionHeading>

            <div className="space-y-8">
              {causesByCategory.map(({ cat, causes: catCauses }) => (
                <div key={cat.id}>
                  {/* Category heading */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.colour }} />
                    <h3 className="text-base font-semibold text-gray-800">{cat.name}</h3>
                    <span className="text-xs text-gray-400 ml-1">{catCauses.length} cause{catCauses.length !== 1 ? "s" : ""}</span>
                    <div className="flex-1 h-px bg-gray-200 ml-2" style={{ borderColor: cat.colour + "40" }} />
                  </div>

                  <div className="space-y-3 pl-5 border-l-2" style={{ borderColor: cat.colour + "60" }}>
                    {catCauses.map((cause, i) => {
                      const delta = cause.initial_risk && cause.residual_risk
                        ? RISK_LEVEL[cause.initial_risk] - RISK_LEVEL[cause.residual_risk]
                        : 0;
                      return (
                        <div key={cause.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                          {/* Cause header */}
                          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-start gap-3">
                            <span className="text-xs text-gray-400 font-mono mt-0.5 flex-shrink-0 w-5 text-right">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 leading-snug">{cause.description}</p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <TypeBadge type={cause.cause_type} />
                                <span className="text-xs text-gray-400">
                                  {cause.vote_count} vote{cause.vote_count !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <RiskJourney initial={cause.initial_risk} residual={cause.residual_risk} />
                              {delta > 0 && <span className="text-xs text-green-600 font-medium">↓ Improved</span>}
                              {delta < 0 && <span className="text-xs text-red-500 font-medium">↑ Worsened</span>}
                              {cause.initial_risk && cause.residual_risk && delta === 0 && (
                                <span className="text-xs text-gray-400">Unchanged</span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          {cause.actions.length > 0 && (
                            <div className="px-4 py-3 border-b border-gray-100">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actions ({cause.actions.length})</p>
                              <div className="space-y-1.5">
                                {cause.actions.map(a => (
                                  <div key={a.id} className="flex items-start gap-2">
                                    <OwnerBadge owner={a.owner} />
                                    <p className="text-sm text-gray-700">{a.description}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          {cause.notes.length > 0 && (
                            <div className="px-4 py-3 bg-siemens-teal-50">
                              <p className="text-xs font-semibold text-siemens-teal uppercase tracking-wide mb-2 flex items-center gap-1">
                                <MessageCircle className="w-3 h-3" />
                                Notes ({cause.notes.length})
                              </p>
                              <div className="space-y-1.5">
                                {cause.notes.map(n => (
                                  <div key={n.id} className="flex items-start gap-2 text-xs">
                                    <span className="font-semibold text-gray-700 flex-shrink-0">{n.participant_name}</span>
                                    <span className="text-gray-400 flex-shrink-0">
                                      {new Date(n.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    <p className="text-gray-600 leading-relaxed">{n.content}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Action Register ───────────────────────────────────────────── */}
        {allActions.length > 0 && (
          <div className="mb-10">
            <SectionHeading sub={`${allActions.length} action${allActions.length !== 1 ? "s" : ""} · ${siemensActions.length} Siemens · ${cslActions.length} CSL`}>
              Action Register
            </SectionHeading>

            {/* Siemens actions */}
            {siemensActions.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-siemens-teal uppercase tracking-wide mb-2 ml-1">Siemens Actions</p>
                <ActionTable actions={siemensActions} categoryMap={categoryMap} />
              </div>
            )}

            {/* CSL actions */}
            {cslActions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2 ml-1">CSL Actions</p>
                <ActionTable actions={cslActions} categoryMap={categoryMap} />
              </div>
            )}
          </div>
        )}

        {/* ── Appendix: Dismissed causes ────────────────────────────────── */}
        {dismissedCauses.length > 0 && (
          <div className="mb-10">
            <SectionHeading sub={`${dismissedCauses.length} cause${dismissedCauses.length !== 1 ? "s" : ""} reviewed and not taken forward`}>
              Appendix — Considered Causes
            </SectionHeading>
            <div className="space-y-2">
              {dismissedCauses.map(cause => {
                const cat = categoryMap[cause.category_id];
                return (
                  <div key={cause.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 opacity-70">
                    {cat && <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: cat.colour }} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600">{cause.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {cat && <span className="text-xs text-gray-400">{cat.name}</span>}
                        <TypeBadge type={cause.cause_type} />
                        <span className="text-xs text-gray-400">{cause.vote_count} votes</span>
                      </div>
                      {cause.dismissal_reason && (
                        <p className="text-xs text-gray-500 mt-1 italic">Reason: {cause.dismissal_reason}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="border-t border-gray-200 pt-6 mt-8 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <SiemensLogo heightClass="h-4" showWordmark={false} />
            <span>Fishbone Risk Review · Session {session.id}</span>
          </div>
          <span>Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
        </div>

      </div>
    </div>
  );
}

// ─── Action table sub-component ───────────────────────────────────────────────
function ActionTable({
  actions,
  categoryMap,
}: {
  actions: Array<{ id: number; description: string; owner: "siemens" | "csl"; cause: EnrichedCause }>;
  categoryMap: Record<number, Category>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-600">
            <th className="px-3 py-2.5 font-semibold w-8">#</th>
            <th className="px-3 py-2.5 font-semibold w-[30%]">Cause</th>
            <th className="px-3 py-2.5 font-semibold whitespace-nowrap w-[13%]">Category</th>
            <th className="px-3 py-2.5 font-semibold whitespace-nowrap w-[16%]">Risk</th>
            <th className="px-3 py-2.5 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action, i) => {
            const cat = categoryMap[action.cause.category_id];
            return (
              <tr key={action.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2.5 text-gray-400 text-xs border-b border-gray-100">{i + 1}</td>
                <td className="px-3 py-2.5 border-b border-gray-100 text-gray-700">
                  <p className="leading-snug text-xs">{action.cause.description}</p>
                </td>
                <td className="px-3 py-2.5 border-b border-gray-100 whitespace-nowrap">
                  {cat && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.colour }} />
                      <span className="text-xs text-gray-600">{cat.name}</span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 border-b border-gray-100">
                  <RiskJourney initial={action.cause.initial_risk} residual={action.cause.residual_risk} />
                </td>
                <td className="px-3 py-2.5 border-b border-gray-100 text-gray-700">{action.description}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <p className={`text-3xl font-bold ${colour}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
