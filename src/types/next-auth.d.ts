import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User { sv?: number }
  interface Session { user: { id: string; sv: number; email?: string | null; name?: string | null } }
}
declare module "next-auth/jwt" {
  interface JWT { uid?: string; sv?: number }
}
