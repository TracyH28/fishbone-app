import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useSocket } from "../hooks/useSocket";
import StarfieldLayout from "../components/StarfieldLayout";
import StageIndicator from "../components/StageIndicator";
import RiskBadge from "../components/RiskBadge";
import { ChevronRight, ChevronLeft, Check, X, ThumbsUp, Plus, Trash2, Users } from "lucide-react";
import FishboneDiagram from "../components/FishboneDiagram";
import CauseNotesThread, { Note } from "../components/CauseNotesThread";
import { getSessionConfig, SessionType } from "../lib/sessionConfig";

interface Category { id: number; name: string; colour: string }
interface Cause {
  id: number; description: string; cause_type: "lesson_learned" | "new_project_approach";
  category_id: number; category_name: string; category_colour: string;
  participant_name: string; selected: boolean | null;
  dismissal_reason: string | null;
}
interface VoteCount { cause_id: number; count: number }
interface RatingDist { cause_id: number; stage: number; ratings: string[] }
interface RiskFinal { cause_id: number; stage: number; rating: string }
interface ResidualFinal { cause_id: number; rating: string }
interface Action { id: number; cause_id: number; description: string; owner: string; owner_tags: string[] | null }
interface Participant { id: number; display_name: string }
interface FullData {
  session: { id: number; title: string; project_name: string; stage: number; join_code: string; session_type: SessionType };
  categories: Category[]; causes: Cause[]; votes: VoteCount[];
  ratings: { cause_id: number; stage: number; rating: string }[];
  riskFinals: RiskFinal[]; actions: Action[]; residualFinals: ResidualFinal[];
  participants: Participant[]; notes: Note[];
}

export default function FacilitatorSessionPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<FullData | null>(null);
  const [voteCounts, setVoteCounts] = useState<Map<number, number>>(new Map());
  const [ratingDists, setRatingDists] = useState<Map<string, string[]>>(new Map());
  const [newAction, setNewAction] = useState<{ cause_id: number; description: string; owner: string; owner_tags: string[] } | null>(null);
  const [, setPendingFinals] = useState<Map<string, string>>(new Map());
  const [dismissalDrafts, setDismissalDrafts] = useState<Map<number, string>>(new Map());
  const [onlineParticipants, setOnlineParticipants] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Note[]>([]);

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
      setNotes(r.data.notes ?? []);
    });
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const socketRef = useSocket(data?.session.id ?? null, { isFacilitator: true }, {
    "cause:added": (cause) => setData(prev => prev ? { ...prev, causes: [...prev.causes, cause as Cause] } : prev),
    "cause:voted": (payload) => {
      const { cause_id, vote_count } = payload as { cause_id: number; vote_count: number };
      setVoteCounts(prev => new Map(prev).set(cause_id, vote_count));
    },
    "cause:rated": (payload) => {
      const { cause_id, stage, ratings } = payload as RatingDist;
      setRatingDists(prev => new Map(prev).set(`${cause_id}:${stage}`, ratings));
    },
    "action:added": (action) => setData(prev => prev ? { ...prev, actions: [...prev.actions, action as Action] } : prev),
    "action:deleted": (payload) => {
      const { id: aid } = payload as { id: number };
      setData(prev => prev ? { ...prev, actions: prev.actions.filter(a => a.id !== aid) } : prev);
    },
    "stage:changed": (payload) => {
      const { stage } = payload as { stage: number };
      setData(prev => prev ? { ...prev, session: { ...prev.session, stage } } : prev);
    },
    "note:added": (note) => setNotes(prev => [...prev, note as Note]),
    "participant:online": (payload) => {
      const { id: pid, display_name } = payload as { id: number; display_name: string };
      setOnlineParticipants(prev => new Set(prev).add(display_name));
      // Add to participants list if they joined after the page loaded
      setData(prev => {
        if (!prev) return prev;
        if (prev.participants.some(p => p.id === pid)) return prev;
        return { ...prev, participants: [...prev.participants, { id: pid, display_name }] };
      });
    },
    "participant:offline": (payload) => {
      const { display_name } = payload as { display_name: string };
      setOnlineParticipants(prev => { const s = new Set(prev); s.delete(display_name); return s; });
    },
  });

  function advanceStage() {
    if (!data || !socketRef.current) return;
    const nextStage = data.session.stage + 1;
    socketRef.current.emit("stage:advance", { sessionId: data.session.id, stage: nextStage });
  }

  function goBackStage() {
    if (!data || !socketRef.current || data.session.stage <= 1) return;
    const prevStage = data.session.stage - 1;
    socketRef.current.emit("stage:advance", { sessionId: data.session.id, stage: prevStage });
  }

  async function selectCause(causeId: number, selected: boolean) {
    const { data: updated } = await api.patch(`/sessions/${id}/causes/${causeId}/select`, { selected });
    setData(prev => prev ? {
      ...prev,
      causes: prev.causes.map(c => c.id === causeId ? { ...c, selected: updated.selected, dismissal_reason: updated.dismissal_reason } : c)
    } : prev);
    // Clear any in-progress draft when un-dismissing
    if (selected !== false) {
      setDismissalDrafts(prev => { const m = new Map(prev); m.delete(causeId); return m; });
    }
  }

  async function saveDismissalReason(causeId: number) {
    const reason = dismissalDrafts.get(causeId) ?? "";
    const { data: updated } = await api.patch(`/sessions/${id}/causes/${causeId}/dismissal-reason`, { dismissal_reason: reason });
    setData(prev => prev ? {
      ...prev,
      causes: prev.causes.map(c => c.id === causeId ? { ...c, dismissal_reason: updated.dismissal_reason } : c)
    } : prev);
    setDismissalDrafts(prev => { const m = new Map(prev); m.delete(causeId); return m; });
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
    const { cause_id, description, owner, owner_tags } = newAction;
    const payload = owner_tags.length > 0
      ? { cause_id, description, owner_tags }
      : { cause_id, description, owner };
    await api.post(`/sessions/${id}/actions`, payload);
    setNewAction(null);
  }

  async function addNote(causeId: number, content: string) {
    await api.post(`/sessions/${id}/causes/${causeId}/notes`, {
      content,
      participant_name: "Facilitator",
    });
  }

  async function deleteAction(actionId: number) {
    await api.delete(`/sessions/${id}/actions/${actionId}`);
    setData(prev => prev ? { ...prev, actions: prev.actions.filter(a => a.id !== actionId) } : prev);
  }

  if (!data) return <StarfieldLayout><div className="text-gray-400 text-center py-12">Loading…</div></StarfieldLayout>;

  const { session, categories, causes, riskFinals, actions, residualFinals, participants } = data;
  const cfg = getSessionConfig(session.session_type);
  const completeStage = cfg.hasResidualRisk ? 6 : 5;
  const sortedCategories = [...categories].sort((a, b) => a.id - b.id);
  const categoryOrder = Object.fromEntries(sortedCategories.map((c, i) => [c.id, i]));
  const sortedCauses = [...causes].sort((a, b) => categoryOrder[a.category_id] - categoryOrder[b.category_id] || a.id - b.id);
  const selectedCauses = sortedCauses.filter(c => c.selected === true);
  const stage = session.stage;

  // Type label lookup — mode-aware
  const TYPE_LABELS: Record<string, string> = {
    lesson_learned: cfg.causeTypes[0],
    new_project_approach: cfg.causeTypes[1],
  };

  function getBackLabel(fromStage: number): string {
    const found = cfg.stages.find(s => s.n === fromStage - 1);
    return found ? found.label : "Previous";
  }
  function getAdvanceLabel(fromStage: number): string {
    const found = cfg.stages.find(s => s.n === fromStage + 1);
    return found ? found.label : "Complete";
  }

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

  // Derive per-participant cause counts from loaded causes
  const causesByParticipant = new Map<string, Cause[]>();
  causes.forEach(c => {
    const arr = causesByParticipant.get(c.participant_name) ?? [];
    arr.push(c);
    causesByParticipant.set(c.participant_name, arr);
  });

  return (
    <StarfieldLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">{session.title}</h1>
            <p className="text-gray-400 text-sm">{session.project_name} · {participants.length} participant{participants.length !== 1 ? "s" : ""} · Code: <span className="font-mono font-bold text-siemens-teal">{session.join_code}</span></p>
          </div>
          <a href={`/report/${id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors" style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.15)" }}>View Report</a>
        </div>

        <StageIndicator current={stage} dark={true} stages={cfg.stages} />

        {/* Participant presence & contributions panel */}
        <div className="card mb-6 bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-siemens-teal" />
            <h2 className="font-semibold text-sm">Participants</h2>
            <span className="ml-auto text-xs text-gray-400">{onlineParticipants.size} online</span>
          </div>
          {participants.length === 0 ? (
            <p className="text-gray-400 text-xs italic">No participants have joined yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {participants.map(p => {
                const isOnline = onlineParticipants.has(p.display_name);
                const pCauses = causesByParticipant.get(p.display_name) ?? [];
                return (
                  <div key={p.id} title={pCauses.length > 0 ? pCauses.map(c => `• ${c.description}`).join("\n") : "No causes submitted yet"}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                      isOnline
                        ? "bg-white border-siemens-teal-100 text-gray-700"
                        : "bg-gray-100 border-gray-200 text-gray-400"
                    }`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? "bg-green-400" : "bg-gray-300"}`} />
                    <span>{p.display_name}</span>
                    {pCauses.length > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                        isOnline ? "bg-siemens-teal-50 text-siemens-teal" : "bg-gray-200 text-gray-400"
                      }`}>
                        {pCauses.length}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stage navigation */}
        <div className="flex justify-between mb-6">
          <div>
            {stage > 1 && (
              <button onClick={goBackStage} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm" style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.15)" }}>
                <ChevronLeft className="w-4 h-4" />
                Back to {getBackLabel(stage)}
              </button>
            )}
          </div>
          {stage < completeStage && (
            <button onClick={advanceStage} className="btn-primary">
              {stage === completeStage - 1 ? "Complete Session" : `Advance to ${getAdvanceLabel(stage)}`}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Fishbone diagram — shown whenever causes have been selected */}
        {selectedCauses.length > 0 && (
          <FishboneDiagram
            title={session.title}
            categories={categories}
            causes={selectedCauses}
            causeTypeLabels={cfg.causeTypes}
          />
        )}

        {/* STAGE 1: Cause/Idea Entry */}
        {stage === 1 && (
          <div>
            <h2 className="text-lg font-semibold mb-1 text-white">Stage 1 — {cfg.stages[0].label}</h2>
            <p className="text-gray-400 text-sm mb-4">Participants are entering {cfg.itemNoun.toLowerCase()}s in real time. Share the join link: <span className="font-mono font-medium text-gray-300">{appUrl}/join</span> · Code: <span className="font-mono font-bold text-siemens-teal">{session.join_code}</span></p>
            {sortedCategories.map(cat => {
              const catCauses = sortedCauses.filter(c => c.category_id === cat.id);
              const noun = cfg.itemNoun.toLowerCase();
              return (
                <div key={cat.id} className="card mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: cat.colour }} />
                    <h3 className="font-semibold">{cat.name}</h3>
                    <span className="text-xs text-gray-400">{catCauses.length} {noun}{catCauses.length !== 1 ? "s" : ""}</span>
                  </div>
                  {catCauses.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No {noun}s yet</p>
                  ) : (
                    <div className="space-y-2">
                      {catCauses.map(cause => (
                        <div key={cause.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <p className="text-sm">{cause.description}</p>
                              <p className="text-xs text-gray-400 mt-1">{cause.participant_name} · <span className={cause.cause_type === "lesson_learned" ? "text-blue-600" : "text-purple-600"}>{TYPE_LABELS[cause.cause_type]}</span></p>
                            </div>
                          </div>
                          <CauseNotesThread causeId={cause.id} notes={notes} myName="Facilitator" onAdd={addNote} />
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
            <h2 className="text-lg font-semibold mb-1 text-white">Stage 2 — Alignment</h2>
            <p className="text-gray-400 text-sm mb-4">Participants are voting. Select which {cfg.itemNoun.toLowerCase()}s to proceed with.</p>
            {sortedCauses.map(cause => {
              const isDismissed = cause.selected === false;
              const draftReason = dismissalDrafts.has(cause.id)
                ? dismissalDrafts.get(cause.id)!
                : (cause.dismissal_reason ?? "");
              const reasonDirty = dismissalDrafts.has(cause.id);
              return (
                <div key={cause.id} className={`card mb-3 border-l-4 ${cause.selected === true ? "border-green-500" : isDismissed ? "border-red-300 opacity-70" : "border-gray-200"}`}
                  style={{ borderLeftColor: cause.selected === true || isDismissed ? undefined : cause.category_colour }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: cause.category_colour }}>{cause.category_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${cause.cause_type === "lesson_learned" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{TYPE_LABELS[cause.cause_type]}</span>
                      </div>
                      <p className="text-sm font-medium">{cause.description}</p>
                      <p className="text-xs text-gray-400 mt-1">{cause.participant_name}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <ThumbsUp className="w-3 h-3 text-siemens-teal" />
                        <span className="text-xs font-semibold text-siemens-teal">{voteCounts.get(cause.id) || 0} vote{(voteCounts.get(cause.id) || 0) !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => selectCause(cause.id, cause.selected !== true)} title="Proceed"
                        className={`p-2 rounded-lg border transition-colors ${cause.selected === true ? "bg-green-500 border-green-500 text-white" : "border-gray-200 hover:bg-green-50 text-gray-400"}`}>
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => selectCause(cause.id, cause.selected !== false)} title="Dismiss"
                        className={`p-2 rounded-lg border transition-colors ${isDismissed ? "bg-red-400 border-red-400 text-white" : "border-gray-200 hover:bg-red-50 text-gray-400"}`}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Dismissal reason input — shown only when cause is dismissed */}
                  {isDismissed && (
                    <div className="mt-3 pt-3 border-t border-red-100 flex items-center gap-2">
                      <input
                        className="input text-xs flex-1"
                        placeholder="Reason for dismissal (optional)…"
                        value={draftReason}
                        onChange={e => setDismissalDrafts(prev => new Map(prev).set(cause.id, e.target.value))}
                        onKeyDown={e => { if (e.key === "Enter") saveDismissalReason(cause.id); }}
                      />
                      {reasonDirty && (
                        <button onClick={() => saveDismissalReason(cause.id)} className="btn-secondary btn-sm text-xs whitespace-nowrap">
                          Save
                        </button>
                      )}
                    </div>
                  )}
                  <CauseNotesThread causeId={cause.id} notes={notes} myName="Facilitator" onAdd={addNote} />
                </div>
              );
            })}
          </div>
        )}

        {/* STAGE 3: Risk / Priority Rating */}
        {stage === 3 && (
          <div>
            <h2 className="text-lg font-semibold mb-1 text-white">Stage 3 — {cfg.stage3Label}</h2>
            <p className="text-gray-400 text-sm mb-4">Participants are submitting ratings. Set the final rating for each selected {cfg.itemNoun.toLowerCase()}.</p>
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
                  <CauseNotesThread causeId={cause.id} notes={notes} myName="Facilitator" onAdd={addNote} />
                </div>
              );
            })}
          </div>
        )}

        {/* STAGE 4: Actions */}
        {stage === 4 && (
          <div>
            <h2 className="text-lg font-semibold mb-1 text-white">Stage 4 — Proposed Actions</h2>
            <p className="text-gray-400 text-sm mb-4">Enter proposed actions for each selected {cfg.itemNoun.toLowerCase()}.</p>
            {selectedCauses.map(cause => {
              const causeActions = actions.filter(a => a.cause_id === cause.id);
              const isAdding = newAction?.cause_id === cause.id;

              function getActionOwnerLabel(action: Action): string {
                if (action.owner === "vision_setting" && action.owner_tags?.length) {
                  return action.owner_tags.join(", ");
                }
                return action.owner === "siemens" ? "Siemens" : "CSL";
              }
              function getActionOwnerStyle(action: Action): string {
                if (action.owner === "vision_setting") return "bg-siemens-teal/10 text-siemens-teal-700";
                return action.owner === "siemens" ? "bg-teal-100 text-teal-700" : "bg-orange-100 text-orange-700";
              }

              return (
                <div key={cause.id} className="card mb-4">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: cause.category_colour }}>{cause.category_name}</span>
                    <p className="text-sm font-medium">{cause.description}</p>
                    {cfg.hasResidualRisk && <RiskBadge rating={finalRating(cause.id) as "high" | "medium" | "low"} />}
                  </div>

                  {causeActions.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {causeActions.map(action => (
                        <div key={action.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${getActionOwnerStyle(action)}`}>
                            {getActionOwnerLabel(action)}
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
                    <div className="space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <input className="input flex-1 text-sm" placeholder="Action description…"
                          value={newAction.description}
                          onChange={e => setNewAction(prev => prev ? { ...prev, description: e.target.value } : prev)}
                          autoFocus />
                        {cfg.ownerMode === "radio" ? (
                          <select className="input w-36 text-sm" value={newAction.owner}
                            onChange={e => setNewAction(prev => prev ? { ...prev, owner: e.target.value } : prev)}>
                            <option value="siemens">Siemens</option>
                            <option value="csl">CSL</option>
                          </select>
                        ) : null}
                        <button onClick={addAction} className="btn-primary btn-sm">Save</button>
                        <button onClick={() => setNewAction(null)} className="btn-secondary btn-sm">Cancel</button>
                      </div>
                      {cfg.ownerMode === "multiselect" && cfg.ownerOptions && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="text-xs text-gray-500 self-center">Owner(s):</span>
                          {cfg.ownerOptions.map(opt => {
                            const selected = newAction.owner_tags.includes(opt);
                            return (
                              <button key={opt} type="button"
                                onClick={() => setNewAction(prev => {
                                  if (!prev) return prev;
                                  const tags = selected
                                    ? prev.owner_tags.filter(t => t !== opt)
                                    : [...prev.owner_tags, opt];
                                  return { ...prev, owner_tags: tags };
                                })}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                  selected
                                    ? "bg-siemens-teal border-siemens-teal text-white"
                                    : "border-gray-300 text-gray-600 hover:border-siemens-teal"
                                }`}>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => setNewAction({ cause_id: cause.id, description: "", owner: "siemens", owner_tags: [] })}
                      className="btn-secondary btn-sm">
                      <Plus className="w-4 h-4" /> Add Action
                    </button>
                  )}
                  <CauseNotesThread causeId={cause.id} notes={notes} myName="Facilitator" onAdd={addNote} />
                </div>
              );
            })}
          </div>
        )}

        {/* STAGE 5: Residual Risk */}
        {cfg.hasResidualRisk && stage === 5 && (
          <div>
            <h2 className="text-lg font-semibold mb-1 text-white">Stage 5 — Residual Risk</h2>
            <p className="text-gray-400 text-sm mb-4">Participants are rating residual risk. Confirm the final residual rating for each cause.</p>
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
                  <CauseNotesThread causeId={cause.id} notes={notes} myName="Facilitator" onAdd={addNote} />
                </div>
              );
            })}
          </div>
        )}

        {stage >= completeStage && (
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
    </StarfieldLayout>
  );
}
