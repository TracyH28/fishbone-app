import { useEffect, useState, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import StageIndicator from "../components/StageIndicator";
import { ThumbsUp, Send, Eye, CheckCircle } from "lucide-react";
import SiemensLogo from "../components/SiemensLogo";
import FishboneDiagram from "../components/FishboneDiagram";
import { useSocket } from "../hooks/useSocket";
import CauseNotesThread, { Note } from "../components/CauseNotesThread";

interface Category { id: number; name: string; colour: string }
interface Cause {
  id: number; category_id: number; description: string;
  cause_type: "lesson_learned" | "new_project_approach";
  selected: boolean | null; vote_count: number;
}
interface Action { id: number; cause_id: number; description: string; owner: "siemens" | "csl" }
interface SessionState {
  session: { id: number; title: string; project_name: string; stage: number };
  categories: Category[];
  causes: Cause[];
  actions: Action[];
  myVotes: number[];
  myRatings: Record<number, { stage: number; rating: string }[]>;
  notes: Note[];
}

const STAGE_NAMES = ["", "Cause Entry", "Alignment", "Risk Rating", "Actions", "Residual Risk"];

export default function ParticipantSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState("");

  // Cause entry form
  const [causeDesc, setCauseDesc] = useState("");
  const [causeCategory, setCauseCategory] = useState<number | "">("");
  const [causeType, setCauseType] = useState<"lesson_learned" | "new_project_approach">("lesson_learned");
  const [submittingCause, setSubmittingCause] = useState(false);
  const [causeSuccess, setCauseSuccess] = useState(false);

  // Submitted ratings tracking
  const [submittingRating, setSubmittingRating] = useState<number | null>(null);
  const [submittingVote, setSubmittingVote] = useState<number | null>(null);

  const participant = JSON.parse(sessionStorage.getItem("participant") || "null");

  useEffect(() => {
    if (!sessionStorage.getItem("participant_token")) {
      navigate("/join");
      return;
    }
    loadState();
  }, [id]);

  async function loadState() {
    try {
      const { data } = await api.get(`/sessions/${id}/state`);
      // Transform myRatings from array to Record<causeId, { stage, rating }[]>
      const ratingsArr: { cause_id: number; stage: number; rating: string }[] = data.myRatings ?? [];
      const myRatings: Record<number, { stage: number; rating: string }[]> = {};
      ratingsArr.forEach(r => {
        if (!myRatings[r.cause_id]) myRatings[r.cause_id] = [];
        myRatings[r.cause_id].push({ stage: r.stage, rating: r.rating });
      });
      setState({ ...data, myRatings });
      if (data.categories.length > 0 && causeCategory === "") {
        setCauseCategory(data.categories[0].id);
      }
    } catch {
      setError("Failed to load session");
    }
  }

  const participantToken = sessionStorage.getItem("participant_token") ?? undefined;
  const sessionNumId = state?.session.id ?? null;

  useSocket(sessionNumId, { token: participantToken }, {
    "cause:added": (cause) => {
      setState(prev => prev ? { ...prev, causes: [...prev.causes, cause as Cause] } : prev);
    },
    "cause:voted": (payload) => {
      const { cause_id, vote_count } = payload as { cause_id: number; vote_count: number };
      setState(prev => prev ? {
        ...prev,
        causes: prev.causes.map(c => c.id === cause_id ? { ...c, vote_count } : c)
      } : prev);
    },
    "cause:selected": (payload) => {
      const { cause_id, selected } = payload as { cause_id: number; selected: boolean | null };
      setState(prev => prev ? {
        ...prev,
        causes: prev.causes.map(c => c.id === cause_id ? { ...c, selected } : c)
      } : prev);
    },
    "category:added": (category) => {
      const cat = category as Category;
      setState(prev => prev ? { ...prev, categories: [...prev.categories, cat] } : prev);
      // Auto-select the new category if the form has no selection yet
      setCauseCategory(prev => prev === "" ? cat.id : prev);
    },
    "category:updated": (category) => {
      const cat = category as Category;
      setState(prev => prev ? {
        ...prev,
        categories: prev.categories.map(c => c.id === cat.id ? cat : c),
      } : prev);
    },
    "category:deleted": (payload) => {
      const { id: catId } = payload as { id: number };
      setState(prev => {
        if (!prev) return prev;
        const remaining = prev.categories.filter(c => c.id !== catId);
        // If the deleted category was selected in the form, fall back to the first remaining one
        setCauseCategory(curr => curr === catId ? (remaining[0]?.id ?? "") : curr);
        return { ...prev, categories: remaining };
      });
    },
    "stage:changed": (payload) => {
      const { stage } = payload as { stage: number };
      setState(prev => prev ? { ...prev, session: { ...prev.session, stage } } : prev);
      if ((stage as number) >= 6) {
        navigate(`/report/${id}`);
      }
    },
    "action:added": (action) => {
      setState(prev => prev ? { ...prev, actions: [...prev.actions, action as Action] } : prev);
    },
    "action:updated": (action) => {
      setState(prev => prev ? {
        ...prev,
        actions: prev.actions.map(a => a.id === (action as Action).id ? action as Action : a)
      } : prev);
    },
    "action:deleted": (payload) => {
      const { id: actionId } = payload as { id: number };
      setState(prev => prev ? { ...prev, actions: prev.actions.filter(a => a.id !== actionId) } : prev);
    },
    "note:added": (note) => {
      setState(prev => prev ? { ...prev, notes: [...prev.notes, note as Note] } : prev);
    },
  });

  async function submitCause(e: FormEvent) {
    e.preventDefault();
    if (!causeDesc.trim() || !causeCategory) return;
    setSubmittingCause(true);
    try {
      await api.post(`/sessions/${id}/causes`, {
        category_id: causeCategory,
        description: causeDesc.trim(),
        cause_type: causeType,
      });
      setCauseDesc("");
      setCauseSuccess(true);
      setTimeout(() => setCauseSuccess(false), 3000);
    } catch {
      setError("Failed to submit cause");
    } finally {
      setSubmittingCause(false);
    }
  }

  async function toggleVote(causeId: number) {
    if (!state) return;
    setSubmittingVote(causeId);
    const hasVoted = state.myVotes.includes(causeId);
    try {
      if (hasVoted) {
        await api.delete(`/sessions/${id}/causes/${causeId}/vote`);
        setState(prev => prev ? { ...prev, myVotes: prev.myVotes.filter(v => v !== causeId) } : prev);
      } else {
        await api.post(`/sessions/${id}/causes/${causeId}/vote`);
        setState(prev => prev ? { ...prev, myVotes: [...prev.myVotes, causeId] } : prev);
      }
    } catch {
      setError("Failed to update vote");
    } finally {
      setSubmittingVote(null);
    }
  }

  async function submitRating(causeId: number, rating: string, stage: number) {
    setSubmittingRating(causeId);
    try {
      await api.post(`/sessions/${id}/causes/${causeId}/rating`, { rating, stage });
      setState(prev => {
        if (!prev) return prev;
        const existing = prev.myRatings[causeId] ?? [];
        const updated = existing.filter(r => r.stage !== stage);
        return {
          ...prev,
          myRatings: { ...prev.myRatings, [causeId]: [...updated, { stage, rating }] }
        };
      });
    } catch {
      setError("Failed to submit rating");
    } finally {
      setSubmittingRating(null);
    }
  }

  async function addNote(causeId: number, content: string) {
    await api.post(`/sessions/${id}/causes/${causeId}/notes`, {
      content,
      participant_name: participant?.display_name ?? "Anonymous",
    });
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate("/join")} className="btn-secondary">Back to Join</button>
      </div>
    </div>
  );

  if (!state) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400">Loading…</div>
    </div>
  );

  const { session, categories, causes, actions, myVotes, myRatings, notes } = state;
  const stage = session.stage;
  const sortedCategories = [...categories].sort((a, b) => a.id - b.id);
  const categoryOrder = Object.fromEntries(sortedCategories.map((c, i) => [c.id, i]));
  const sortedCauses = [...causes].sort((a, b) => categoryOrder[a.category_id] - categoryOrder[b.category_id] || a.id - b.id);
  const selectedCauses = sortedCauses.filter(c => c.selected === true);
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));

  return (
    <div className="min-h-screen bg-siemens-teal-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SiemensLogo heightClass="h-6" showWordmark={false} />
            <span className="font-semibold text-gray-900 truncate">{session.title}</span>
          </div>
          <span className="text-sm text-gray-500">{participant?.display_name}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-3">{session.project_name}</p>
          <StageIndicator current={stage} />
          <p className="text-center text-sm font-medium text-siemens-teal mt-2">
            Stage {stage}: {STAGE_NAMES[stage] ?? "Complete"}
          </p>
        </div>

        {/* Fishbone diagram — shown whenever causes have been selected */}
        {selectedCauses.length > 0 && (
          <FishboneDiagram
            title={session.title}
            categories={categories}
            causes={selectedCauses}
          />
        )}

        {/* Stage 1: Cause Entry */}
        {stage === 1 && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold mb-4">Submit a Cause</h2>
              {causeSuccess && (
                <div className="bg-green-50 text-green-700 rounded-lg px-4 py-2 text-sm mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Cause submitted successfully!
                </div>
              )}
              <form onSubmit={submitCause} className="space-y-4">
                <div>
                  <label className="label">Category</label>
                  <select
                    className="input"
                    value={causeCategory}
                    onChange={e => setCauseCategory(Number(e.target.value))}
                    required
                  >
                    {sortedCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    className="input min-h-[80px] resize-y"
                    value={causeDesc}
                    onChange={e => setCauseDesc(e.target.value)}
                    placeholder="Describe the cause…"
                    required
                  />
                </div>
                <div>
                  <label className="label">Type</label>
                  <div className="flex gap-3">
                    {(["lesson_learned", "new_project_approach"] as const).map(t => (
                      <label key={t} className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        causeType === t ? "border-siemens-teal bg-siemens-teal-50" : "border-gray-200"
                      }`}>
                        <input
                          type="radio"
                          name="causeType"
                          value={t}
                          checked={causeType === t}
                          onChange={() => setCauseType(t)}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium">
                          {t === "lesson_learned" ? "Lesson Learned" : "New Project Approach"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={submittingCause} className="btn-primary w-full justify-center">
                  <Send className="w-4 h-4" />
                  {submittingCause ? "Submitting…" : "Submit Cause"}
                </button>
              </form>
            </div>

            {/* Live feed of submitted causes */}
            {causes.length > 0 && (
              <div className="card">
                <h3 className="font-semibold mb-3 text-sm text-gray-600">All Submitted Causes ({causes.length})</h3>
                <div className="space-y-2">
                  {sortedCauses.map(cause => {
                    const cat = categoryMap[cause.category_id];
                    return (
                      <div key={cause.id} className="p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-start gap-2">
                          {cat && <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: cat.colour }} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{cause.description}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {cat?.name} · {cause.cause_type === "lesson_learned" ? "Lesson Learned" : "New Project Approach"}
                            </p>
                          </div>
                        </div>
                        <CauseNotesThread causeId={cause.id} notes={notes ?? []} myName={participant?.display_name} onAdd={addNote} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 2: Alignment / Voting */}
        {stage === 2 && (
          <div className="card">
            <h2 className="font-semibold mb-2">Vote on Causes</h2>
            <p className="text-sm text-gray-500 mb-4">Upvote causes you think are most important. The facilitator will select which proceed.</p>
            <div className="space-y-3">
              {sortedCauses.map(cause => {
                const cat = categoryMap[cause.category_id];
                const voted = myVotes.includes(cause.id);
                return (
                  <div key={cause.id} className="p-3 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-3">
                      {cat && <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: cat.colour }} />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{cause.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {cat?.name} · {cause.cause_type === "lesson_learned" ? "Lesson Learned" : "New Project Approach"}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleVote(cause.id)}
                        disabled={submittingVote === cause.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          voted
                            ? "bg-siemens-teal text-white hover:bg-siemens-teal-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {cause.vote_count}
                      </button>
                    </div>
                    <CauseNotesThread causeId={cause.id} notes={notes ?? []} myName={participant?.display_name} onAdd={addNote} />
                  </div>
                );
              })}
              {causes.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">No causes submitted yet</p>
              )}
            </div>
          </div>
        )}

        {/* Stage 3: Risk Rating */}
        {stage === 3 && (
          <div className="space-y-4">
            <div className="card bg-amber-50 border-amber-200">
              <p className="text-sm text-amber-800 font-medium">Rate the risk impact for each cause below. You can change your rating at any time.</p>
            </div>
            {selectedCauses.map(cause => {
              const cat = categoryMap[cause.category_id];
              const myRating = (myRatings[cause.id] ?? []).find(r => r.stage === 3)?.rating;
              return (
                <div key={cause.id} className="card">
                  <div className="flex items-start gap-2 mb-4">
                    {cat && <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: cat.colour }} />}
                    <div>
                      <p className="font-medium text-sm">{cause.description}</p>
                      <p className="text-xs text-gray-400">{cat?.name}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Your risk rating:</p>
                    <div className="flex gap-2">
                      {(["high", "medium", "low"] as const).map(r => (
                        <button
                          key={r}
                          onClick={() => submitRating(cause.id, r, 3)}
                          disabled={submittingRating === cause.id}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                            myRating === r
                              ? r === "high" ? "bg-red-500 border-red-500 text-white"
                              : r === "medium" ? "bg-amber-400 border-amber-400 text-white"
                              : "bg-green-500 border-green-500 text-white"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>
                    {myRating && (
                      <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Your rating: {myRating}
                      </p>
                    )}
                  </div>
                  <CauseNotesThread causeId={cause.id} notes={notes ?? []} myName={participant?.display_name} onAdd={addNote} />
                </div>
              );
            })}
            {selectedCauses.length === 0 && (
              <div className="card text-center py-8 text-gray-400">
                <p>No causes have been selected yet</p>
              </div>
            )}
          </div>
        )}

        {/* Stage 4: Actions (view only) */}
        {stage === 4 && (
          <div className="space-y-4">
            <div className="card bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 text-blue-800">
                <Eye className="w-4 h-4" />
                <p className="text-sm font-medium">The facilitator is entering proposed actions. You can view them here.</p>
              </div>
            </div>
            {selectedCauses.map(cause => {
              const cat = categoryMap[cause.category_id];
              const causeActions = actions.filter(a => a.cause_id === cause.id);
              return (
                <div key={cause.id} className="card">
                  <div className="flex items-start gap-2 mb-3">
                    {cat && <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: cat.colour }} />}
                    <div>
                      <p className="font-medium text-sm">{cause.description}</p>
                      <p className="text-xs text-gray-400">{cat?.name}</p>
                    </div>
                  </div>
                  {causeActions.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No actions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {causeActions.map(action => (
                        <div key={action.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${
                            action.owner === "siemens" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}>
                            {action.owner === "siemens" ? "Siemens" : "CSL"}
                          </span>
                          <p className="text-sm">{action.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <CauseNotesThread causeId={cause.id} notes={notes ?? []} myName={participant?.display_name} onAdd={addNote} />
                </div>
              );
            })}
          </div>
        )}

        {/* Stage 5: Residual Risk Rating */}
        {stage === 5 && (
          <div className="space-y-4">
            <div className="card bg-amber-50 border-amber-200">
              <p className="text-sm text-amber-800 font-medium">Rate the residual risk impact for each cause, assuming the proposed actions are carried out.</p>
            </div>
            {selectedCauses.map(cause => {
              const cat = categoryMap[cause.category_id];
              const myRating = (myRatings[cause.id] ?? []).find(r => r.stage === 5)?.rating;
              const causeActions = actions.filter(a => a.cause_id === cause.id);
              return (
                <div key={cause.id} className="card">
                  <div className="flex items-start gap-2 mb-3">
                    {cat && <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: cat.colour }} />}
                    <div>
                      <p className="font-medium text-sm">{cause.description}</p>
                      <p className="text-xs text-gray-400">{cat?.name}</p>
                    </div>
                  </div>
                  {causeActions.length > 0 && (
                    <div className="mb-3 pl-2 border-l-2 border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Proposed actions:</p>
                      {causeActions.map(a => (
                        <p key={a.id} className="text-xs text-gray-600">
                          <span className="font-medium">{a.owner === "siemens" ? "Siemens" : "CSL"}:</span> {a.description}
                        </p>
                      ))}
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Your residual risk rating:</p>
                    <div className="flex gap-2">
                      {(["high", "medium", "low"] as const).map(r => (
                        <button
                          key={r}
                          onClick={() => submitRating(cause.id, r, 5)}
                          disabled={submittingRating === cause.id}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                            myRating === r
                              ? r === "high" ? "bg-red-500 border-red-500 text-white"
                              : r === "medium" ? "bg-amber-400 border-amber-400 text-white"
                              : "bg-green-500 border-green-500 text-white"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>
                    {myRating && (
                      <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Your rating: {myRating}
                      </p>
                    )}
                  </div>
                  <CauseNotesThread causeId={cause.id} notes={notes ?? []} myName={participant?.display_name} onAdd={addNote} />
                </div>
              );
            })}
          </div>
        )}

        {/* Stage 6+: Complete */}
        {stage >= 6 && (
          <div className="card text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Session Complete</h2>
            <p className="text-gray-500 mb-6">Thank you for participating in this Fishbone Risk Review session.</p>
            <a href={`/report/${session.id}`} className="btn-primary inline-flex justify-center">
              View Session Report
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
