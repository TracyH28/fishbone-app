import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import Layout from "../components/Layout";
import { Plus, ExternalLink, Settings, PlayCircle } from "lucide-react";

interface Session {
  id: number; title: string; project_name: string;
  join_code: string; stage: number; created_at: string;
  opens_at: string | null; closes_at: string | null;
}

const STAGE_LABELS = ["Setup", "Cause Entry", "Alignment", "Risk Rating", "Actions", "Residual Risk", "Complete"];

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/sessions").then(r => { setSessions(r.data); setLoading(false); });
  }, []);

  const appUrl = window.location.origin;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Sessions</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your Fishbone risk review sessions</p>
        </div>
        <Link to="/sessions/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Session
        </Link>
      </div>

      {loading && <div className="text-gray-400 text-center py-12">Loading…</div>}

      {!loading && sessions.length === 0 && (
        <div className="card text-center py-16">
          <p className="text-gray-500 mb-4">No sessions yet</p>
          <Link to="/sessions/new" className="btn-primary">
            <Plus className="w-4 h-4" /> Create your first session
          </Link>
        </div>
      )}

      <div className="grid gap-4">
        {sessions.map(s => (
          <div key={s.id} className="card flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="font-semibold text-gray-900 truncate">{s.title}</h2>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-mono">{s.join_code}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  s.stage === 0 ? "bg-gray-100 text-gray-600" :
                  s.stage >= 6 ? "bg-green-100 text-green-700" :
                  "bg-amber-100 text-amber-700"
                }`}>{STAGE_LABELS[s.stage] ?? "Unknown"}</span>
              </div>
              <p className="text-sm text-gray-500">{s.project_name}</p>
              <p className="text-xs text-gray-400 mt-1">
                Participant link: <span className="font-mono">{appUrl}/join</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link to={`/sessions/${s.id}/setup`} className="btn-secondary btn-sm">
                <Settings className="w-4 h-4" /> Setup
              </Link>
              {s.stage > 0 && (
                <Link to={`/sessions/${s.id}/facilitate`} className="btn-primary btn-sm">
                  <PlayCircle className="w-4 h-4" /> Facilitate
                </Link>
              )}
              <a href={`/report/${s.id}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                <ExternalLink className="w-4 h-4" /> Report
              </a>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
