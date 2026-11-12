import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import { OrbitalMark } from './OrbitalMark';
import { useAuth } from '../lib/AuthContext';

const AUTH_NAV = [
  { id: 'overview', label: 'Overview', path: '/dashboard' },
  { id: 'explorer', label: 'Investigation Explorer', path: '/explorer' },
  { id: 'comparison', label: 'Comparison Lab', path: '/comparison' },
  { id: 'models', label: 'Model Lab', path: '/models' },
  { id: 'playground', label: 'Mission Deck', path: '/playground' },
  { id: 'copilot', label: 'Research Copilot', path: '/copilot' },
] as const;

function NavIcon({ id }: { id: (typeof AUTH_NAV)[number]['id'] }) {
  const paths: Record<(typeof AUTH_NAV)[number]['id'], JSX.Element> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    explorer: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    comparison: <><path d="M4 8h16M4 16h16" /><circle cx="9" cy="8" r="2" /><circle cx="15" cy="16" r="2" /></>,
    models: <><path d="M4 19V10l5 3 4-6 7 4v8H4Z" /></>,
    playground: <><circle cx="12" cy="12" r="8" /><path d="M12 12l4.5-4.5" /><circle cx="12" cy="12" r="1.5" /></>,
    copilot: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="3" /></>,
  };
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[id]}
    </svg>
  );
}


export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, isGuest, signOut, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const onSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const isActive = (path: string) => location.pathname === path || (path === '/explorer' && location.pathname.startsWith('/explorer/')) || (path === '/models' && location.pathname.startsWith('/models/'));

  if (loading) {
    return (
      <main id="main" className="app-shell">
        <div className="app-loading" aria-live="polite">
          <OrbitalMark size={40} />
          <p className="mono">Restoring mission session…</p>
        </div>
      </main>
    );
  }

  if (!session && !isGuest) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="app-header" role="banner">
        <div className="app-header-inner">
          <Link to="/dashboard" className="app-brand" aria-label="FlameLens dashboard home">
            <OrbitalMark size={26} />
            <span className="app-brand-word">
              FLAME<span className="app-brand-lens">LENS</span>
            </span>
          </Link>

          <nav className="app-nav" aria-label="Primary navigation" role="navigation">
            <ul className="app-nav-list">
              {AUTH_NAV.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    className={`app-nav-link${isActive(item.path) ? ' is-active' : ''}`}
                    aria-current={isActive(item.path) ? 'page' : undefined}
                  >
                    <NavIcon id={item.id} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="app-header-actions">
            <button
              type="button"
              className="app-menu-toggle"
              aria-expanded={sidebarOpen}
              aria-controls="app-sidebar"
              aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <span className="sr-only">{sidebarOpen ? 'Close navigation' : 'Open navigation'}</span>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                {sidebarOpen ? (
                  <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                ) : (
                  <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                )}
              </svg>
            </button>

            <div className="app-user-menu">
              <button
                type="button"
                className="app-user-trigger"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-controls="user-menu-dropdown"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <span className="app-user-avatar" aria-hidden="true">
                  <OrbitalMark size={18} />
                </span>
                <span className="app-user-email">{session?.user.email ?? 'Guest profile'}</span>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M4 5.5l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
              </button>

              <menu id="user-menu-dropdown" className={`app-user-dropdown${userMenuOpen ? ' is-open' : ''}`} role="menu" hidden={!userMenuOpen}>
                <hr className="hairline" />
                <li role="none">
                  <Link to="/dashboard" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <OrbitalMark size={14} />
                    <span>Overview</span>
                  </Link>
                </li>
                {isGuest ? <li role="none"><Link to="/sign-in" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                  <span>Sign in to save chat history</span>
                </Link></li> : null}
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="app-user-signout"
                    onClick={onSignOut}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                      <path d="M10 3.5L4 7l6 3.5M4 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    </svg>
                    <span>{isGuest ? 'End guest session' : 'Sign out'}</span>
                  </button>
                </li>
              </menu>
            </div>
          </div>
        </div>
      </header>

      <aside
        id="app-sidebar"
        className={`app-sidebar${sidebarOpen ? ' is-open' : ''}`}
        aria-label="Sidebar navigation"
        role="navigation"
      >
        <nav>
          <ul className="app-sidebar-nav">
            {AUTH_NAV.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.path}
                  className={`app-sidebar-link${isActive(item.path) ? ' is-active' : ''}`}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  onClick={() => setSidebarOpen(false)}
                >
                  <NavIcon id={item.id} />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <hr className="hairline" />
          <ul className="app-sidebar-user">
            <li>
              <Link to="/dashboard" onClick={() => setSidebarOpen(false)}>
                <OrbitalMark size={16} />
                <span>Overview</span>
              </Link>
            </li>
            {isGuest ? <li><Link to="/sign-in" onClick={() => setSidebarOpen(false)}>
              <span>Sign in to save chat history</span>
            </Link></li> : null}
            <li>
              <button type="button" className="app-sidebar-signout" onClick={onSignOut}>
                <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M10 3.5L4 7l6 3.5M4 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
                <span>{isGuest ? 'End guest session' : 'Sign out'}</span>
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <div className={`app-overlay${sidebarOpen ? ' is-visible' : ''}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      <main id="main-content" className="app-main" role="main">
        <div className="app-container">
          <nav className="app-breadcrumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
              {location.pathname !== '/dashboard' && (
                <>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page">
                    {location.pathname.startsWith('/explorer/') ? 'Investigation detail' : AUTH_NAV.find((n) => n.path === location.pathname)?.label ?? 'Current page'}
                  </li>
                </>
              )}
            </ol>
          </nav>

          <Outlet />
        </div>
      </main>
    </div>
  );
}
