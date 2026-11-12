import { lazy, Suspense, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { AuthProvider } from './lib/AuthContext';
import { Landing } from './pages/Landing';
import { AuthShell } from './pages/AuthShell';
import { AuthCallback } from './pages/AuthCallback';
import { ResetPassword } from './pages/ResetPassword';
import { AppShell } from './components/AppShell';
import { Overview } from './pages/Overview';
import { Explorer } from './pages/Explorer';
import { ComparisonLab } from './pages/ComparisonLab';
import { MissionDeck } from './pages/MissionDeck';

const ModelLab = lazy(() => import('./pages/ModelLab').then(({ ModelLab }) => ({ default: ModelLab })));
const ResearchCopilot = lazy(() => import('./pages/ResearchCopilot').then(({ ResearchCopilot }) => ({ default: ResearchCopilot })));
const QuantumResearch = lazy(() => import('./pages/QuantumResearch').then(({ QuantumResearch }) => ({ default: QuantumResearch })));
const GlobalAssistant = lazy(() => import('./components/GlobalAssistant').then(({ GlobalAssistant }) => ({ default: GlobalAssistant })));

function ScrollRestoration() {
  const { pathname, hash } = useLocation();
  const prevPath = useRef<string | null>(null);
  useEffect(() => {
    const samePath = prevPath.current === pathname;
    prevPath.current = pathname;
    if (hash) {
      if (samePath) return;
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  const location = useLocation();
  const inConsole =
    location.pathname === '/dashboard' ||
    location.pathname.startsWith('/explorer') ||
    location.pathname === '/comparison' ||
    location.pathname.startsWith('/models') ||
    location.pathname === '/playground' ||
    location.pathname === '/copilot';

  return (
    <AuthProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!inConsole && <Header />}
      <ScrollRestoration />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sign-in" element={<AuthShell />} />
        <Route path="/sign-up" element={<AuthShell />} />
        <Route path="/forgot-password" element={<AuthShell />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/quantum" element={<Suspense fallback={<div className="app-placeholder">Opening the storybook…</div>}><QuantumResearch /></Suspense>} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Overview />} />
          <Route path="/explorer" element={<Explorer />} />
          <Route path="/explorer/:investigationId" element={<Explorer />} />
          <Route path="/comparison" element={<ComparisonLab />} />
          <Route path="/models/:trackId?" element={<Suspense fallback={<div className="app-placeholder">Loading research workspace…</div>}><ModelLab /></Suspense>} />
          <Route path="/playground" element={<MissionDeck />} />
          <Route path="/copilot" element={<Suspense fallback={<div className="app-placeholder">Loading evidence copilot…</div>}><ResearchCopilot /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Suspense fallback={null}><GlobalAssistant /></Suspense>
      {!inConsole && <Footer />}
    </AuthProvider>
  );
}
