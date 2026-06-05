import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Users } from "lucide-react";
import SiemensLogo from "../components/SiemensLogo";

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
    <div className="min-h-screen flex items-center justify-center bg-siemens-teal-50">
      <div className="card w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <SiemensLogo heightClass="h-12" showWordmark={true} />
          <p className="text-gray-400 mt-3 text-xs uppercase tracking-widest">Fishbone Risk Review</p>
          <div className="flex items-center gap-2 mt-4">
            <div className="bg-siemens-teal text-white p-2 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Join a Session</h1>
          </div>
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

        <div className="mt-6 pt-5 border-t border-gray-100 text-center">
          <Link to="/login" className="text-sm text-gray-400 hover:text-siemens-teal transition-colors">
            Facilitator sign in →
          </Link>
        </div>
      </div>
    </div>
  );
}
