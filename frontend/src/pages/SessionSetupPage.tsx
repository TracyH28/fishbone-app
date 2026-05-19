import { useEffect, useState, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Layout from "../components/Layout";
import { Plus, Trash2, GripVertical, PlayCircle, Copy, Check, Pencil, X } from "lucide-react";

interface Category { id: number; name: string; colour: string; display_order: number }
interface Session { id: number; title: string; project_name: string; join_code: string; stage: number }

const PRESET_COLOURS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#14b8a6","#3b82f6","#06b6d4"
];

export default function SessionSetupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [newColour, setNewColour] = useState(PRESET_COLOURS[0]);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState({ title: "", project_name: "" });
  const [savingMeta, setSavingMeta] = useState(false);

  const appUrl = window.location.origin;

  useEffect(() => {
    api.get(`/sessions/${id}`).then(r => setSession(r.data));
    api.get(`/sessions/${id}/categories`).then(r => setCategories(r.data));
  }, [id]);

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const { data } = await api.post(`/sessions/${id}/categories`, { name: newName.trim(), colour: newColour });
    setCategories(prev => [...prev, data]);
    setNewName("");
    setNewColour(PRESET_COLOURS[(categories.length + 1) % PRESET_COLOURS.length]);
  }

  async function deleteCategory(catId: number) {
    await api.delete(`/sessions/${id}/categories/${catId}`);
    setCategories(prev => prev.filter(c => c.id !== catId));
  }

  async function startSession() {
    setStarting(true);
    await api.patch(`/sessions/${id}`, { stage: 1 });
    navigate(`/sessions/${id}/facilitate`);
  }

  function openMetaEdit() {
    setMetaDraft({ title: session!.title, project_name: session!.project_name });
    setEditingMeta(true);
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    if (!metaDraft.title.trim() || !metaDraft.project_name.trim()) return;
    setSavingMeta(true);
    const { data } = await api.patch(`/sessions/${id}`, {
      title: metaDraft.title.trim(),
      project_name: metaDraft.project_name.trim(),
    });
    setSession(data);
    setEditingMeta(false);
    setSavingMeta(false);
  }

  function copyJoinLink() {
    navigator.clipboard.writeText(`${appUrl}/join`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!session) return <Layout><div className="text-gray-400 text-center py-12">Loading…</div></Layout>;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          {editingMeta ? (
            <form onSubmit={saveMeta} className="space-y-3">
              <div>
                <label className="label">Session Name</label>
                <input
                  className="input text-xl font-bold"
                  value={metaDraft.title}
                  onChange={e => setMetaDraft(d => ({ ...d, title: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Project Name</label>
                <input
                  className="input"
                  value={metaDraft.project_name}
                  onChange={e => setMetaDraft(d => ({ ...d, project_name: e.target.value }))}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary btn-sm" disabled={savingMeta}>
                  <Check className="w-4 h-4" /> {savingMeta ? "Saving…" : "Save"}
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setEditingMeta(false)} disabled={savingMeta}>
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start gap-3 group">
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{session.title}</h1>
                <p className="text-gray-500">{session.project_name}</p>
              </div>
              <button
                onClick={openMetaEdit}
                className="btn-secondary btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
                title="Edit session name and project"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
            </div>
          )}
        </div>

        {/* Join info */}
        <div className="card mb-6 bg-siemens-teal-50 border-siemens-teal-100">
          <h2 className="font-semibold text-siemens-navy mb-2">Participant Join Details</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-xs text-siemens-teal mb-1">Join URL</p>
              <p className="font-mono text-sm">{appUrl}/join</p>
            </div>
            <div>
              <p className="text-xs text-siemens-teal mb-1">Session Code</p>
              <p className="font-mono text-2xl font-bold tracking-widest text-siemens-teal">{session.join_code}</p>
            </div>
            <button onClick={copyJoinLink} className="btn-secondary btn-sm ml-auto">
              {copied ? <><Check className="w-4 h-4 text-green-500" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy link</>}
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">Fishbone Categories</h2>
          <p className="text-sm text-gray-500 mb-4">Define the bones of your fishbone diagram. These are the main cause categories participants will tag their entries against.</p>

          {categories.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4 border-2 border-dashed rounded-lg mb-4">
              No categories yet — add at least one below
            </p>
          )}

          <div className="space-y-2 mb-4">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
                <GripVertical className="w-4 h-4 text-gray-300" />
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: cat.colour }} />
                <span className="flex-1 font-medium text-sm">{cat.name}</span>
                <button onClick={() => deleteCategory(cat.id)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={addCategory} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Category Name</label>
              <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. People, Process, Technology" />
            </div>
            <div>
              <label className="label">Colour</label>
              <div className="flex gap-1.5 flex-wrap">
                {PRESET_COLOURS.map(c => (
                  <button key={c} type="button" onClick={() => setNewColour(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${newColour === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <button type="submit" className="btn-secondary btn-sm flex-shrink-0">
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>
        </div>

        <div className="flex gap-3">
          <button onClick={() => navigate("/")} className="btn-secondary">Back to dashboard</button>
          <button
            onClick={startSession}
            disabled={categories.length === 0 || starting || session.stage > 0}
            className="btn-primary flex-1 justify-center"
          >
            <PlayCircle className="w-4 h-4" />
            {session.stage > 0 ? "Session already started — Go to session →" : starting ? "Starting…" : "Start Session →"}
          </button>
          {session.stage > 0 && (
            <button onClick={() => navigate(`/sessions/${id}/facilitate`)} className="btn-primary flex-1 justify-center">
              <PlayCircle className="w-4 h-4" /> Go to session →
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
