import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Ankh } from '../components/Ankh';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setErr(error.message);
  }

  return (
    <div className="center-screen login-bg">
      <div className="card narrow">
        <Ankh size={44} />
        <h1 className="display">Askar</h1>
        <p className="muted">A shared visual archive of seven thousand years of Egypt.</p>
        {!sent ? (
          <form onSubmit={send} className="stack">
            <label>
              Email
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <button disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="stack">
            <p>
              Check <b>{email}</b>. Tap the link in the email — or, if your email shows a code, type it here (handy inside the installed app):
            </p>
            <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code from the email" />
            <button disabled={busy || code.trim().length < 6}>{busy ? 'Checking…' : 'Sign in with code'}</button>
            <button type="button" className="ghost" onClick={() => setSent(false)}>Use another email</button>
          </form>
        )}
        {err && <p className="error">{err}</p>}
      </div>
    </div>
  );
}
