import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "./auth.config";
import { db } from "@/lib/db";

// Blocco temporaneo dopo troppi tentativi falliti (in memoria, per email)
const fails = new Map<string, { n: number; until: number }>();
const MAX_FAILS = 5, LOCK_MS = 10 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        const f = fails.get(email);
        if (f && f.until > Date.now()) return null;
        const user = await db.user.findUnique({ where: { email } });
        const ok = !!user && user.active && (await bcrypt.compare(password, user.password));
        if (!ok) {
          const n = (f && f.until > 0 && f.until < Date.now() ? 0 : f?.n ?? 0) + 1;
          fails.set(email, { n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
          return null;
        }
        fails.delete(email);
        return { id: user.id, email: user.email, name: user.name, sv: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) { token.uid = user.id; token.sv = user.sv ?? 0; }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.sv = (token.sv as number) ?? 0;
      return session;
    },
  },
});
