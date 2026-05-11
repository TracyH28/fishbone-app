import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useSocket } from "../hooks/useSocket";
import Layout from "../components/Layout";
import StageIndicator from "../components/StageIndicator";
import RiskBadge from "../components/RiskBadge";
import { ChevronRight, Check, X, ThumbsUp, Plus, Trash2 } from "lucide-react";

interface Category { id: number; name: string; colour: string }
interface Cause {
  id: number; description: string; cause_type: string;
  category_id: number; category_name: string; category_colour: string;
  participant_name: string; selected: boolean | null;
}
interface VoteCount { cause_id: number; count: number }
interface RatingDist { cause_id: number; stage: number; ratings: string[] }
interface RiskFinal { cause_id: number; stage: number; rating: string }
interface ResidualFinal { cause_id: number; rating: string }
interface Action { id: number; cause_id: number; description: string; owner: string }
interface Participant { id: number; display_name: string }
interface FullData {
  session: { id: number; title: string; project_name: string; stage: number; join_code: string };
  categories: Category[]; causes: Cause[]; votes: VoteCount[];
  ratings: { cause_id: number; stage: number; rating: string }[];
  riskFinals: RiskFinal[]; actions: Action[]; residualFinals: ResidualFinal[];
  participants: Participant[];
}

const TYPE_LABELS: Record<string, string> = {
  lesson_learned: "Lesson Learned",
  new_project_approach: "New Approach",
};

export default function FacilitatorSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<FullData | null>(null);
  const [voteCounts, setVoteCounts] = useState<Map<number, number>>(new Map());
  const [ratingDists, setRatingDists] = useState<Map<string, string[]>>(new Map());
  const [newAction, setNewAction] = useState<{ cause_id: number; description: string; owner: string } | null>(null);
  const [pendingFinals, setPendingFinals] = useState<Map<string, string>>(new Map());

  const reload = useCallback(() => {
    api.get(`/${id}/full`).then(r => {
      setData(r.data);
      const vc = new Map<number, number>();
      r.data.votes.forEach((v: VoteCount) => vc.set(v.cause_id, parseInt(String(v.count))));
      setVoteCounts(vc);
      const rd = new Map<string, string[]>();
      r.data.ratings.forEach((rt: { cause_id: number; stage: number; rating: string }) => {
        const key = `${rt.cause_id}:${rt.stage}`;
        const arr = rd.get(key) || [];
        arr.push(rt.rating);
        rd.set(key, arr);
      });
      setRatingDists(rd);
    });
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const socketRef = useSocket(data?.session.id ?? null, { isFacilitator: true }, {
    "cause:added": (cause) => setData(prev => prev ? { ...prev, causes: [...prev.causes, cause as Cause] } : prev),
    "cause:voted": ({ cause_id, vote_count }: { cause_id: number; vote_count: number }) => {
      setVoteCounts(prev => new Map(prev).set(cause_id, vote_count));
    },
    "cause:rated": ({ cause_id, stage, ratings }: RatingDist) => {
      setRatingDists(prev => new Map(prev).set(`${cause_id}:${stage}`, ratings));
    },
    "action:added": (action) => setData(prev => prev ? { ...prev, actions: [...prev.actions, action as Action] } : prev),
    "action:deleted": ({ id: aid }: { id: number }) =>
      setData(prev => prev ? { ...prev, actions: prev.actions.filter(a => a.id !== aid) } : prev),
    "stage:changed": ({ stage }: { stage: number }) =>
      setData(prev => prev ? { ...prev, session: { ...prev.session, stage } } : prev),
  });

  function advanceStage() {
    if (!data || !socketRef.current) return;
    const nextStage = data.session.stage + 1;
    // Emit via socket — the server updates the DB and broadcasts stage:changed to all participants
    socketRef.current.emit("stage:advance", { sessionId: data.session.id, stage: nextStage });
  }

  async function selectCause(causeId: number, selected: boolean) {
    const { data: updated } = await api.patch(`/sessions/${id}/causes/${causeId}/select`, { selected });
    setData(prev => prev ? { ...prev, causes: prev.causes.map(c => c.id === causeId ? { ...c, selected: updated.selected } : c) } : prev);
  }

  async function setFinalRating(causeId: number, stage: number, rating: string) {
    await api.post(`/sessions/${id}/causes/${causeId}/rating/final`, { stage, rating });
    const key = stage === 3 ? `rf:${causeId}` : `res:${causeId}`;
    if (stage === 3) {
      setData(prev => prev ? {
        ...prev,
        riskFinals: [...prev.riskFinals.filter(r => r.cause_id !== causeId), { cause_id: causeId, stage, rating }]
      } : prev);
    } else {
      setData(prev => prev ? {
        ...prev,
        residualFinals: [...prev.residualFinals.filter(r => r.cause_id !== causeId), { cause_id: causeId, rating }]
      } : prev);
    }
    setPendingFinals(prev => { const m = new Map(prev); m.delete(key); return m; });
  }

  async function addAction() {
    if (!newAction || !newAction.description.trim()) return;
    await api.post(`/sessions/${id}/actions`, newAction);
    setNewAction(null);
  }

  async function deleteAction(actionId: number) {
    await api.delete(`/sessions/${id}/actions/${actionId}`);
    setData(prev => prev ? { ...prev, actions: prev.actions.filter(a => a.id !== actionId) } : prev);
  }

  if (!data) return <Layout><div className="text-gray-400 text-center py-12">Loading…</div></Layout>;

  const { session, categories, causes, riskFinals, actions, residualFinals, participants } = data;
  const selectedCauses = causes.filter(c => c.selected === true);
  const stage = session.stage;

  function ratingDist(causeId: number, s: number) {
    return ratingDists.get(`${causeId}:${s}`) || [];
  }
  function ratingCount(causeId: number, s: number, r: string) {
    return ratingDist(causeId, s).filter(x => x === r).length;
  }
  function finalRating(causeId: number) {
    return riskFinals.find(r => r.cause_id === causeId)?.rating;
  }
  function residualRating(causeId: number) {
    return residualFinals.find(r => r.cause_id === causeId)?.rating;
  }

  const appUrl = window.location.origin;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">{session.title}</h1>
            <p className="text-gray-500 text-sm">{session.project_name} · {participants.length} participant{participants.length !== 1 ? "s" : ""} · Code: <span className="font-mono font-bold">{session.join_code}</span></p>
          </div>
          <a href={`/report/${id}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">View Report</a>
        </div>

        <StageIndicator current={stage} />

        {/* Advance stage button */}
        {stage < 6 && (
          <div className="flex justify-end mb-6">
            <button onClick={advanceStage} className="btn-primary">
              {stage === 5 ? "Complete Session" : `Advance to ${["", "Alignment", "Risk Rating", "Actions", "Residual Risk", "Complete", "Complete"][stage]}`}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STAGE 1: Cause Entry */}
        {stage === 1 && (
          <div>
            <h2 className="text-lg font-semibold mb-1">Stage 1 — Cause Entry</h2>
            <p className="text-gray-500 text-sm mb-4">Participants are entering causes in real time. Share the join link: <span className="font-mono font-medium">{appUrl}/join</span> · Code: <span className="font-mono font-bold text-indigo-700">{session.join_code}</span></p>
            {categories.map(cat => {
              const catCauses = causes.filter(c => c.category_id === cat.id);
              return (
                <div key={cat.id} className="card mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: cat.colour }} />
                    <h3 className="font-semibold">{cat.name}</h3>
                    <span className="text-xs text-gray-400">{catCauses.length} cause{catCauses.length !== 1 ? "s" : ""}</span>
                  </div>
                  {catCauses.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No causes yet</p>
                  ) : (
                    <div className="space-y-2">
                      {catCauses.map(cause => (
                        <div key={cause.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm">{cause.description}</p>
                            <p className="text-xs text-gray-400 mt-1">{cause.participant_name} · <span className={cause.cause_type === "lesson_learned" ? "text-blue-600" : "text-purple-600"}>{TYPE_LABELS[cause.cause_type]}</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* STAGE 2: Alignment / Voting */}
        {stage === 2 && (
          <div>
            <h2 className="text-lg font-semibold mb-1">Stage 2 — Alignment</h2>
            <p className="text-gray-500 text-sm mb-4">Participants are voting. Select which causes to proceed with.</p>
            {causes.map(cause => (
              <div key={cause.id} className={`card mb-3 border-l-4 ${cause.selected === true ? "border-green-500" : cause.selected === false ? "border-red-300 opacity-60" : "border-gray-200"}`}
                style={{ borderLeftColor: cause.selected === true ? undefined : cause.selected === false ? undefined : cause.category_colour }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: cause.category_colour }}>{cause.category_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cause.cause_type === "lesson_learned" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{TYPE_LABELS[cause.cause_type]}</span>
                    </div>
                    <p className="text-sm font-medium">{cause.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{cause.participant_name}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <ThumbsUp className="w-3 h-3 text-indigo-400" />
                      <span className="text-xs font-semibold text-indigo-700">{voteCounts.get(cause.id) || 0} vote{(voteCounts.get(cause.id) || 0) !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => selectCause(cause.id, cause.selected !== true)} title="Proceed"
                      className={`p-2 rounded-lg border transition-colors ${cause.selected === true ? "bg-green-500 border-green-500 text-white" : "border-gray-200 hover:bg-green-50 text-gray-400"}`}>
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => selectCause(cause.id, cause.selected !== false)} title="Dismiss"
                      className={`p-2 rounded-lg border transition-colors ${cause.selected === false ? "bg-red-400 border-red-400 text-white" : "border-gray-200 hover:bg-red-50 text-gray-400"}`}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STAGE 3: Risk Rating */}
        {stage === 3 && (
          <div>
            <h2 className="text-lg font-semibold mb-1">Stage 3 — Risk Impact Rating</h2>
            <p className="text-gray-500 text-sm mb-4">Participants are submitting ratings. Set the final rating for each selected cause.</p>
            {selectedCauses.map(cause => {
              const dist = ratingDist(cause.id, 3);
              const final = finalRating(cause.id);
              return (
                <div key={cause.id} className="card mb-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: cause.category_colour }}>{cause.category_name}</span>
                      </div>
                      <p className="text-sm font-medium">{cause.description}</p>
                      <div className="flex gap-4 mt-3 text-xs">
                        {["high","medium","low"].map(r => (
                          <span key={r} className={`font-medium ${r === "high" ? "text-red-600" : r === "medium" ? "text-amber-600" : "text-green-600"}`}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}: {ratingCount(cause.id, 3, r)}/{dist.length > 0 ? dist.length : "0"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-xs text-gray-500">Final rating:</p>
                      <div className="flex gap-2">
                        {["high","medium","low"].map(r => (
                          <button key={r} onClick={() => setFinalRating(cause.id, 3, r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              final === r ? (r === "high" ? "bg-red-500 border-red-500 text-white" : r === "medium" ? "bg-amber-500 border-amber-500 text-white" : "bg-green-500 border-green-500 text-white")
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </button>
                        ))}
                      </div>
                      {final && <RiskBadge rating={final as "high" | "medium" | "low"} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* STAGE 4: Actions */}
        {stage === 4 && (
          <div>
            <h2 className="text-lg font-semibold mb-1">Stage 4 — Proposed Actions</h2>
            <p className="text-gray-500 text-sm mb-4">Enter proposed actions for each selected cause.</p>
            {selectedCauses.map(cause => {
              const causeActions = actions.filter(a => a.cause_id === cause.id);
              const isAdding = newAction?.cause_id === cause.id;
              return (
                <div key={cause.id} className="card mb-4">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: cause.category_colour }}>{cause.category_name}</span>
                    <p className="text-sm font-medium">{cause.description}</p>
                    <RiskBadge rating={finalRating(cause.id) as "high" | "medium" | "low"} />
                  </div>

                  {causeActions.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {causeActions.map(action => (
                        <div key={action.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${action.owner === "siemens" ? "bg-teal-100 text-teal-700" : "bg-orange-100 text-orange-700"}`}>
                            {action.owner === "siemens" ? "Siemens" : "CSL"}
                          </span>
                          <p className="text-sm flex-1">{action.description}</p>
                          <button onClick={() => deleteAction(action.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {isAdding ? (
                    <div className="flex gap-2 flex-wrap">
                      <input className="input flex-1 text-sm" placeholder="Action description…"
                        value={newAction.description}
                        onChange={e => setNewAction(prev => prev ? { ...prev, description: e.target.value } : prev)}
                        autoFocus />
                      <select className="input w-36 text-sm" value={newAction.owner}
                        onChange={e => setNewAction(prev => prev ? { ...prev, owner: e.target.value } : prev)}>
                        <option value="siemens">Siemens</option>
                        <option value="csl">CSL</option>
                      </select>
                      <button onClick={addAction} className="btn-primary btn-sm">Save</button>
                      <button onClick={() => setNewAction(null)} className="btn-secondary btn-sm">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setNewAction({ cause_id: cause.id, description: "", owner: "siemens" })}
                      className="btn-secondary btn-sm">
                      <Plus className="w-4 h-4" /> Add Action
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* STAGE 5: Residual Risk */}
        {stage === 5 && (
          <div>
            <h2 className="text-lg font-semibold mb-1">Stage 5 — Residual Risk</h2>
            <p className="text-gray-500 text-sm mb-4">Participants are rating residual risk. Confirm the final residual rating for each cause.</p>
            {selectedCauses.map(cause => {
              const causeActions = actions.filter(a => a.cause_id === cause.id);
              const dist = ratingDist(cause.id, 5);
              const residual = residualRating(cause.id);
              return (
                <div key={cause.id} className="card mb-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">{cause.description}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500">Initial risk:</span>
                        <RiskBadge rating={finalRating(cause.id) as "high" | "medium" | "low"} />
                      </div>
                      {causeActions.length > 0 && (
                        <div className="text-xs text-gray-500 mb-2">
                          Actions: {causeActions.map(a => `${a.owner === "siemens" ? "Siemens" : "CSL"}: ${a.description}`).join(" | ")}
                        </div>
                      )}
                      <div className="flex gap-4 text-xs">
                        {["high","medium","low"].map(r => (
                          <span key={r} className={`font-medium ${r === "high" ? "text-red-600" : r === "medium" ? "text-amber-600" : "text-green-600"}`}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}: {ratingCount(cause.id, 5, r)}/{dist.length}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-xs text-gray-500">Residual rating:</p>
                      <div className="flex gap-2">
                        {["high","medium","low"].map(r => (
                          <button key={r} onClick={() => setFinalRating(cause.id, 5, r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              residual === r ? (r === "high" ? "bg-red-500 border-red-500 text-white" : r === "medium" ? "bg-amber-500 border-amber-500 text-white" : "bg-green-500 border-green-500 text-white")
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </button>
                        ))}
                      </div>
                      {residual && <RiskBadge rating={residual as "high" | "medium" | "low"} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {stage >= 6 && (
          <div className="card text-center py-12">
            <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Session Complete</h2>
            <p className="text-gray-500 mb-6">All stages have been completed.</p>
            <a href={`/report/${id}`} target="_blank" rel="noreferrer" className="btn-primary">
              View Full Report
            </a>
          </div>
        )}
      </div>
    </Layout>
  );
}
