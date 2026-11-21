import { NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { configured, supabase } from './lib/supabase';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Timeline from './pages/Timeline';
import Browse from './pages/Browse';
import Discover from './pages/Discover';
import AddPage from './pages/AddPage';
import Boards from './pages/Boards';
import BoardPage from './pages/BoardPage';
import ItemPage from './pages/ItemPage';
import Members from './pages/Members';
import SharePage from './pages/SharePage';
import Home from './pages/Home';
import ProjectPage from './pages/ProjectPage';
import PlacesPage from './pages/PlacesPage';
import PlacePage from './pages/PlacePage';
import { lazy, Suspense } from 'react';
const MapPage = lazy(() => import('./pages/MapPage'));
import { Ankh } from './components/Ankh';

export default function App() {
  if (!configured) return <Setup />;
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { loading, session, email, role } = useAuth();
  if (loading) return <div className="center-screen"><Ankh className="spin-slow" size={48} /></div>;
  if (!session) return <Login />;
  if (!role) {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <Ankh size={40} />
          <h1>Not on the list (yet)</h1>
          <p>
            You're signed in as <b>{email}</b>, but this archive is invite-only. Ask the owner to add this exact email on
            their <i>Members</i> page, then reload.
          </p>
          <div className="row">
            <button onClick={() => location.reload()}>Reload</button>
            <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }
  return <Shell />;
}

function Shell() {
  const { role } = useAuth();
  const nav: { to: string; label: string; icon: React.ReactNode; end?: boolean }[] = [
    { to: '/', label: 'Projects', icon: '▦', end: true },
    { to: '/discover', label: 'Discover', icon: '🔎' },
    { to: '/add', label: 'Add', icon: '＋' },
    { to: '/timeline', label: 'Timeline', icon: <Ankh size={20} /> },
    { to: '/map', label: 'Map', icon: '🗺' },
  ];
  const team = role === 'owner' || role === 'editor';
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
          <NavLink to="/boards">Boards</NavLink>
          <NavLink to="/library">Library</NavLink>
          {role === 'owner' && <NavLink to="/members">Team</NavLink>}
        </nav>
        <div className="topbar-right">
          {team && <NavLink to="/places" className="only-mobile icon-link" aria-label="Places">📍</NavLink>}
          <NavLink to="/boards" className="only-mobile icon-link" aria-label="Boards">📌</NavLink>
          <NavLink to="/library" className="only-mobile icon-link" aria-label="Library">▤</NavLink>
          {role === 'owner' && <NavLink to="/members" className="only-mobile icon-link" aria-label="Members">👥</NavLink>}
          <button className="ghost small" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>
      <main className={`main ${useLocation().pathname === '/map' ? 'full' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/projects/:id" element={<ProjectPage />} />
          <Route path="/places" element={<PlacesPage />} />
          <Route path="/places/:name" element={<PlacePage />} />
          <Route path="/era/:eraId" element={<Browse />} />
          <Route path="/library" element={<Browse />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/map" element={<Suspense fallback={<div className="center-screen"><Ankh className="spin-slow" size={40} /></div>}><MapPage /></Suspense>} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/share" element={<SharePage />} />
          <Route path="/boards" element={<Boards />} />
          <Route path="/boards/:id" element={<BoardPage />} />
          <Route path="/item/:id" element={<ItemPage />} />
          <Route path="/members" element={<Members />} />
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
