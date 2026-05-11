import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import RiskBadge from "../components/RiskBadge";
import { Fish, Download } from "lucide-react";

interface Category { id: number; name: string; colour: string }
interface RawAction { id: number; cause_id: number; description: string; owner: "siemens" | "csl" }
interface RawCause {
  id: number; category_id: number; description: string;
  cause_type: "lesson_learned" | "new_project_approach";
  selected: boolean | null;
}
interface VoteCount { cause_id: number; count: string }
interface RiskFinal { cause_id: number; stage: number; rating: string }
interface ResidualFinal { cause_id: number; rating: string }
interface RawReport {
  session: { id: number; title: string; project_name: string; stage: number; created_at: string };
  categories: Category[];
  causes: RawCause[];
  voteCounts: VoteCount[];
  riskFinals: RiskFinal[];
  residualFinals: ResidualFinal[];
  actions: RawAction[];
}

interface EnrichedCause extends RawCause {
  vote_count: number;
  initial_risk: string | null;
  residual_risk: string | null;
  actions: RawAction[];
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isPrint = searchParams.get("print") === "1";
  const [report, setReport] = useState<{ session: RawReport["session"]; categories: Category[]; causes: EnrichedCause[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/${id}/report`)
      .then(r => {
        const raw: RawReport = r.data;
        const voteMap = new Map(raw.voteCounts.map(v => [v.cause_id, parseInt(v.count)]));
        const riskMap = new Map(raw.riskFinals.filter(r => r.stage === 3).map(r => [r.cause_id, r.rating]));
        const residualMap = new Map(raw.residualFinals.map(r => [r.cause_id, r.rating]));
        const actionsByCause = new Map<number, RawAction[]>();
        raw.actions.forEach(a => {
          const arr = actionsByCause.get(a.cause_id) ?? [];
          arr.push(a);
          actionsByCause.set(a.cause_id, arr);
        });
        const causes: EnrichedCause[] = raw.causes.map(c => ({
          ...c,
          vote_count: voteMap.get(c.id) ?? 0,
          initial_risk: riskMap.get(c.id) ?? null,
          residual_risk: residualMap.get(c.id) ?? null,
          actions: actionsByCause.get(c.id) ?? [],
        }));
        setReport({ session: raw.session, categories: raw.categories, causes });
      })
      .catch(() => setError("Failed to load report"));
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

  const { session, categories, causes } = report;
  const selectedCauses = causes.filter(c => c.selected === true);
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const totalActions = causes.reduce((n, c) => n + c.actions.length, 0);

  function downloadPdf() {
    const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
    window.open(`${apiBase}/api/${id}/pdf`, "_blank");
  }

  return (
    <div className={`min-h-screen bg-white ${isPrint ? "p-8" : "p-4 md:p-8"}`}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Fish className="w-6 h-6 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-600">Fishbone Risk Review</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{session.title}</h1>
            <p className="text-lg text-gray-500 mt-1">{session.project_name}</p>
            <p className="text-sm text-gray-400 mt-1">
              {new Date(session.created_at).toLocaleDateString("en-GB", {
                day: "numeric", month: "long", year: "numeric"
              })}
            </p>
          </div>
          {!isPrint && (
            <button onClick={downloadPdf} className="btn-secondary">
              <Download className="w-4 h-4" /> Export PDF
            </button>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Causes" value={causes.length} />
          <StatCard label="Selected Causes" value={selectedCauses.length} />
          <StatCard label="Categories" value={categories.length} />
          <StatCard label="Total Actions" value={totalActions} />
        </div>

        {/* Categories legend */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <span key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white" style={{ background: cat.colour }}>
                {cat.name}
              </span>
            ))}
          </div>
        </div>

        {/* Risk summary table */}
        {selectedCauses.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Selected Causes — Risk Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-2 font-semibold text-gray-700 border border-gray-200 w-8">#</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 border border-gray-200">Category</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 border border-gray-200">Cause</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 border border-gray-200">Type</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 border border-gray-200 text-center">Initial Risk</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 border border-gray-200 text-center">Residual Risk</th>
                    <th className="px-3 py-2 font-semibold text-gray-700 border border-gray-200">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCauses.map((cause, i) => {
                    const cat = categoryMap[cause.category_id];
                    return (
                      <tr key={cause.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-2 border border-gray-200 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 border border-gray-200">
                          {cat && (
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.colour }} />
                              {cat.name}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 border border-gray-200">{cause.description}</td>
                        <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            cause.cause_type === "lesson_learned"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {cause.cause_type === "lesson_learned" ? "Lesson Learned" : "New Approach"}
                          </span>
                        </td>
                        <td className="px-3 py-2 border border-gray-200 text-center">
                          {cause.initial_risk ? <RiskBadge rating={cause.initial_risk} /> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 border border-gray-200 text-center">
                          {cause.residual_risk ? <RiskBadge rating={cause.residual_risk} /> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 border border-gray-200">
                          {cause.actions.length === 0 ? (
                            <span className="text-gray-300 text-xs">None</span>
                          ) : (
                            <ul className="space-y-1">
                              {cause.actions.map(a => (
                                <li key={a.id} className="flex items-start gap-1.5 text-xs">
                                  <span className={`px-1 py-0.5 rounded font-medium flex-shrink-0 ${
                                    a.owner === "siemens" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                  }`}>
                                    {a.owner === "siemens" ? "SIE" : "CSL"}
                                  </span>
                                  {a.description}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Per-category breakdown */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Causes by Category</h2>
          <div className="space-y-6">
            {categories.map(cat => {
              const catCauses = causes.filter(c => c.category_id === cat.id);
              if (catCauses.length === 0) return null;
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: cat.colour }} />
                    <h3 className="font-semibold text-gray-800">{cat.name}</h3>
                    <span className="text-sm text-gray-400">({catCauses.length} causes)</span>
                  </div>
                  <div className="pl-6 space-y-1.5">
                    {catCauses.map(cause => (
                      <div key={cause.id} className={`flex items-start gap-2 p-2.5 rounded-lg ${
                        cause.selected === true ? "bg-green-50 border border-green-200" :
                        cause.selected === false ? "bg-red-50 border border-red-100 opacity-60" :
                        "bg-gray-50 border border-gray-200"
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{cause.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              cause.cause_type === "lesson_learned"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}>
                              {cause.cause_type === "lesson_learned" ? "LL" : "NPA"}
                            </span>
                            <span className="text-xs text-gray-400">{cause.vote_count} votes</span>
                            {cause.selected === true && <span className="text-xs text-green-600 font-medium">Selected</span>}
                            {cause.selected === false && <span className="text-xs text-red-400">Dismissed</span>}
                          </div>
                        </div>
                        {cause.selected === true && cause.initial_risk && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <RiskBadge rating={cause.initial_risk} />
                            {cause.residual_risk && (
                              <>
                                <span className="text-gray-300">→</span>
                                <RiskBadge rating={cause.residual_risk} />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action register */}
        {selectedCauses.some(c => c.actions.length > 0) && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Action Register</h2>
            <div className="space-y-3">
              {selectedCauses.filter(c => c.actions.length > 0).map(cause => {
                const cat = categoryMap[cause.category_id];
                return (
                  <div key={cause.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
                      {cat && <div className="w-2.5 h-2.5 rounded-full" style={{ background: cat.colour }} />}
                      <span className="text-sm font-medium">{cause.description}</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {cause.actions.map(action => (
                        <div key={action.id} className="px-4 py-2.5 flex items-start gap-3">
                          <span className={`text-xs px-2 py-1 rounded font-medium flex-shrink-0 ${
                            action.owner === "siemens" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}>
                            {action.owner === "siemens" ? "Siemens" : "CSL"}
                          </span>
                          <p className="text-sm text-gray-700">{action.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4 mt-8 text-xs text-gray-400 text-center">
          Generated by Fishbone Risk Review · {new Date().toLocaleDateString("en-GB")}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
