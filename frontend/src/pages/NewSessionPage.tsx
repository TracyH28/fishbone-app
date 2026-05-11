import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Layout from "../components/Layout";

export default function NewSessionPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/sessions", {
        title: title.trim(),
        project_name: projectName.trim(),
        opens_at: opensAt || null,
        closes_at: closesAt || null,
      });
      navigate(`/sessions/${data.id}/setup`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Failed to create session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6">New Session</h1>
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
            <div>
              <label className="label">Session Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Project Alpha Lessons Learned" />
            </div>
            <div>
              <label className="label">Project Name</label>
              <input className="input" value={projectName} onChange={e => setProjectName(e.target.value)} required placeholder="e.g. Alpha Grid Upgrade" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Opens At (optional)</label>
                <input className="input" type="datetime-local" value={opensAt} onChange={e => setOpensAt(e.target.value)} />
              </div>
              <div>
                <label className="label">Closes At (optional)</label>
                <input className="input" type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate("/")} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
                {loading ? "Creating…" : "Create & Set Up Categories →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
