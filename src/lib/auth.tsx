import { createContext, useContext, type ReactNode } from 'react';

/**
 * Local-first: there is no sign-in. The person at this PC is the owner.
 * The shape stays the same so pages that read `role`/`email` keep working.
 */
interface AuthState {
  loading: boolean;
  session: { access_token: string } | null;
  email: string | null;
  role: 'owner' | 'editor' | 'guest' | null;
  refresh: () => void;
}

const LOCAL: AuthState = { loading: false, session: { access_token: 'local' }, email: 'owner@local', role: 'owner', refresh: () => {} };

const Ctx = createContext<AuthState>(LOCAL);

export function AuthProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={LOCAL}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
