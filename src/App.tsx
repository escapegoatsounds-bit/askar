import { NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import Timeline from './pages/Timeline';
import Browse from './pages/Browse';
import Discover from './pages/Discover';
import AddPage from './pages/AddPage';
import Boards from './pages/Boards';
import BoardPage from './pages/BoardPage';
import ItemPage from './pages/ItemPage';
import SharePage from './pages/SharePage';
import Home from './pages/Home';
import ProjectPage from './pages/ProjectPage';
import PlacesPage from './pages/PlacesPage';
import PlacePage from './pages/PlacePage';
import RulersPage from './pages/RulersPage';
import RulerPage from './pages/RulerPage';
import { lazy, Suspense } from 'react';
const MapPage = lazy(() => import('./pages/MapPage'));
import { Ankh } from './components/Ankh';

// Local-first: no sign-in, invites or roles. Everything on this PC is yours.
export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const nav: { to: string; label: string; icon: React.ReactNode; end?: boolean }[] = [
    { to: '/', label: 'Projects', icon: '▦', end: true },
    { to: '/discover', label: 'Discover', icon: '🔎' },
    { to: '/add', label: 'Add', icon: '＋' },
    { to: '/timeline', label: 'Timeline', icon: <Ankh size={20} /> },
    { to: '/map', label: 'Map', icon: '🗺' },
  ];
  const team = true;
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <Ankh size={26} />
          <span>Askar</span>
        </Link>
        <nav className="topnav">
          {nav.filter((n) => team || !['/timeline', '/map'].includes(n.to)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
          {team && <NavLink to="/places">Places</NavLink>}
          <NavLink to="/rulers">Rulers</NavLink>
          <NavLink to="/boards">Boards</NavLink>
          <NavLink to="/library">Library</NavLink>
        </nav>
        <div className="topbar-right">
          {team && <NavLink to="/places" className="only-mobile icon-link" aria-label="Places">📍</NavLink>}
          <NavLink to="/rulers" className="only-mobile icon-link" aria-label="Rulers">♛</NavLink>
          <NavLink to="/boards" className="only-mobile icon-link" aria-label="Boards">📌</NavLink>
          <NavLink to="/library" className="only-mobile icon-link" aria-label="Library">▤</NavLink>
        </div>
      </header>
      <main className={`main ${useLocation().pathname === '/map' ? 'full' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/projects/:id" element={<ProjectPage />} />
          <Route path="/places" element={<PlacesPage />} />
          <Route path="/places/:name" element={<PlacePage />} />
          <Route path="/rulers" element={<RulersPage />} />
          <Route path="/rulers/:slug" element={<RulerPage />} />
          <Route path="/era/:eraId" element={<Browse />} />
          <Route path="/library" element={<Browse />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/map" element={<Suspense fallback={<div className="center-screen"><Ankh className="spin-slow" size={40} /></div>}><MapPage /></Suspense>} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/share" element={<SharePage />} />
          <Route path="/boards" element={<Boards />} />
          <Route path="/boards/:id" element={<BoardPage />} />
          <Route path="/item/:id" element={<ItemPage />} />
          <Route path="*" element={<div className="empty">Lost in the desert. <Link to="/">Back to your projects</Link></div>} />
        </Routes>
      </main>
      <nav className="tabbar">
        {nav.filter((n) => team || !['/timeline', '/map'].includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            <span className="tab-icon">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
