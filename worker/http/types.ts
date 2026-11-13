import type { createAuth } from '../auth/createAuth.ts';
import type { Env } from '../env.ts';

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;

export interface AppEnv {
  Bindings: Env;
  Variables: {
    auth: Auth;
    session: AuthSession;
  };
}
