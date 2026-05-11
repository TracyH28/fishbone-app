import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, Fish } from "lucide-react";

export default function Layout({ children }: { children: ReactNode }) {
  const { facilitator, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-2 font-bold text-indigo-700 text-lg">
          <Fish className="w-6 h-6" />
          Fishbone Review
        </Link>
        {facilitator && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{facilitator.email}</span>
            <button onClick={handleLogout} className="btn-secondary btn-sm">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        )}
      </header>
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">{children}</main>
    </div>
  );
}
