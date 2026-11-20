import { Ankh } from '../components/Ankh';

export default function Setup() {
  return (
    <div className="center-screen">
      <div className="card narrow">
        <Ankh size={40} />
        <h1>Almost there</h1>
        <p>The app isn't connected to a database yet. Add these two settings and restart / redeploy:</p>
        <pre className="code">VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=your-anon-key</pre>
        <p className="muted">Locally: put them in a file called <code>.env</code>. On Vercel: Project → Settings → Environment Variables. Full steps are in the README.</p>
      </div>
    </div>
  );
}
