import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Ankh } from '../components/Ankh';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
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
              Check <b>{email}</b> and tap <b>Sign in</b> in the email. It can take a minute — look in spam too.
            </p>
            <p className="muted small">Tip for phones: sign in here in Chrome first, then install the app. It stays signed in.</p>
            {showCode ? (
              <>
                <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code from the email" />
                <button disabled={busy || code.trim().length < 6}>{busy ? 'Checking…' : 'Sign in with code'}</button>
              </>
            ) : (
              <button type="button" className="link" onClick={() => setShowCode(true)}>My email has a code instead</button>
            )}
            <button type="button" className="ghost" onClick={() => setSent(false)}>Use another email</button>
          </form>
        )}
        {err && <p className="error">{err}</p>}
      </div>
    </div>
  );
}
