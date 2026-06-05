import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import NewSessionPage from "./pages/NewSessionPage";
import SessionSetupPage from "./pages/SessionSetupPage";
import FacilitatorSessionPage from "./pages/FacilitatorSessionPage";
import JoinPage from "./pages/JoinPage";
import ParticipantSessionPage from "./pages/ParticipantSessionPage";
import ReportPage from "./pages/ReportPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { facilitator } = useAuth();
  return facilitator ? <>{children}</> : <Navigate to="/join" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/session/:id/participate" element={<ParticipantSessionPage />} />
          <Route path="/report/:id" element={<ReportPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/sessions/new" element={<ProtectedRoute><NewSessionPage /></ProtectedRoute>} />
          <Route path="/sessions/:id/setup" element={<ProtectedRoute><SessionSetupPage /></ProtectedRoute>} />
          <Route path="/sessions/:id/facilitate" element={<ProtectedRoute><FacilitatorSessionPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
