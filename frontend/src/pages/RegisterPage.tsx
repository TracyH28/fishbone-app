import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SiemensLogo from "../components/SiemensLogo";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password);
      navigate("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Registration failed");
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
          <h1 className="text-xl font-bold text-gray-900 mt-4">Create Facilitator Account</h1>
          <p className="text-gray-500 mt-1 text-sm">Run lessons learned and risk review sessions</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
          </div>
          <button className="btn-primary w-full justify-center" type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account? <Link to="/login" className="text-siemens-teal font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
