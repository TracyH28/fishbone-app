import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Fish, Users } from "lucide-react";

export default function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/sessions/join", {
        join_code: code.toUpperCase().trim(),
        display_name: name.trim(),
      });
      sessionStorage.setItem("participant_token", data.token);
      sessionStorage.setItem("participant", JSON.stringify(data.participant));
      navigate(`/session/${data.session.id}/participate`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Could not join session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="card w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-purple-600 text-white p-3 rounded-2xl mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join a Session</h1>
          <p className="text-gray-500 mt-1 text-sm flex items-center gap-1">
            <Fish className="w-4 h-4" /> Fishbone Risk Review
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="label">Session Code</label>
            <input
              className="input text-center text-2xl font-mono tracking-widest uppercase"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
              placeholder="ABC123"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Your Name</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g. Jane Smith"
            />
          </div>
          <button className="btn-primary w-full justify-center" type="submit" disabled={loading}>
            {loading ? "Joining…" : "Join Session"}
          </button>
        </form>
      </div>
    </div>
  );
}
