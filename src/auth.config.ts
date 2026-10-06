import type { NextAuthConfig } from "next-auth";

// Config edge-safe (usata dal middleware, niente Prisma/bcrypt)
export default {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const loggedIn = !!auth?.user;
      const isLogin = request.nextUrl.pathname.startsWith("/login");
      if (isLogin) return loggedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      return loggedIn;
    },
  },
} satisfies NextAuthConfig;
