import { useState } from 'react';
import { addMember, listMembers, removeMember, setRole } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useAuth } from '../lib/auth';

export default function Members() {
  const { email: me, role } = useAuth();
  const members = useAsync(listMembers, []);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<'editor' | 'owner'>('editor');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (role !== 'owner') return <div className="page"><p className="empty">Only owners can manage members.</p></div>;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    try {
      await addMember(email, newRole, me!);
      setOk(`${email.trim().toLowerCase()} can now sign in at ${location.origin}`);
      setEmail('');
      members.reload();
    } catch (e) {
      setErr((e as Error).message.includes('duplicate') ? 'That email is already a member.' : (e as Error).message);
    }
  }

  return (
    <div className="page narrow-page">
      <section className="hero compact">
        <h1 className="display">Members</h1>
        <p className="muted">Invite-only. Add a collaborator's email here, then send them the link to this app. They sign in with that email — no password needed.</p>
      </section>
      <form className="card form-grid" onSubmit={invite}>
        <label className="span-2">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="collaborator@example.com" /></label>
        <label>Role
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)}>
            <option value="editor">Editor — add & edit everything</option>
            <option value="owner">Owner — also manages members</option>
          </select>
        </label>
        <div className="row end"><button>Add member</button></div>
        {ok && <p className="ok span-2">{ok}</p>}
        {err && <p className="error span-2">{err}</p>}
      </form>
      {members.error && <p className="error">{members.error}</p>}
      <ul className="member-list">
        {members.data?.map((m) => (
          <li key={m.email} className="card row between">
            <span><b>{m.email}</b>{m.email === me ? ' (you)' : ''}<br /><span className="muted small">{m.role}{m.invited_by ? ` · invited by ${m.invited_by}` : ''}</span></span>
            {m.email !== me && (
              <span className="row">
                <button className="ghost small" onClick={async () => { await setRole(m.email, m.role === 'owner' ? 'editor' : 'owner'); members.reload(); }}>
                  Make {m.role === 'owner' ? 'editor' : 'owner'}
                </button>
                <button className="ghost small danger" onClick={async () => { if (confirm(`Remove ${m.email}?`)) { await removeMember(m.email); members.reload(); } }}>Remove</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
