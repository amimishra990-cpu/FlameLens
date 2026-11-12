import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { OrbitalMark } from './OrbitalMark';
import { useActiveSection } from '../lib/useActiveSection';
import { useAuth } from '../lib/AuthContext';

const NAV = [
  { id: 'investigations', label: 'Investigations' },
  { id: 'model-lab', label: 'Model Lab' },
  { id: 'playground', label: 'Playground' },
  { id: 'about', label: 'About' },
];

export function Header() {
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const onLanding = location.pathname === '/';
  const active = useActiveSection(onLanding ? NAV.map((n) => n.id) : []);

  const onSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  const anchor = (id: string) => (onLanding ? `#${id}` : `/#${id}`);

  return (
    <header className="site-header">
      <div className="scroll-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="FlameLens home">
          <OrbitalMark size={30} />
          <span className="brand-word">
            FLAME<span className="brand-lens">LENS</span>
          </span>
        </Link>

        <nav className="header-nav" aria-label="Primary">
          {NAV.map((n) =>
            onLanding ? (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={active === n.id ? 'is-active' : ''}
                aria-current={active === n.id ? 'true' : undefined}
              >
                {n.label}
              </a>
            ) : (
              <Link key={n.id} to={anchor(n.id)}>
                {n.label}
              </Link>
            ),
          )}
        </nav>

        <div className="header-actions">
          {session ? (
            <>
              <Link to="/dashboard" className="header-signin">
                Dashboard
              </Link>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/sign-in" className="header-signin">
                Sign in
              </Link>
              <Link to="/sign-up" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            {menuOpen ? (
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      <div id="mobile-menu" className={`mobile-menu ${menuOpen ? 'is-open' : ''}`} hidden={!menuOpen}>
        <nav aria-label="Mobile">
          {NAV.map((n) => (
            <a key={n.id} href={anchor(n.id)} onClick={() => setMenuOpen(false)}>
              {n.label}
            </a>
          ))}
          <hr className="hairline" />
          {session ? (
            <>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              <button type="button" className="btn btn-secondary" onClick={() => { setMenuOpen(false); void onSignOut(); }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/sign-in" onClick={() => setMenuOpen(false)}>
                Sign in
              </Link>
              <Link to="/sign-up" className="btn btn-primary" onClick={() => setMenuOpen(false)}>
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
