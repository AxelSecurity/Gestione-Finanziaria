import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Utente corrente, riletto dal DB: un utente disattivato o con password cambiata perde subito la sessione. */
export const currentUser = cache(async () => {
  const s = await auth();
  const id = s?.user?.id;
  if (!id) return null;
  const u = await db.user.findUnique({ where: { id } });
  if (!u || !u.active || u.sessionVersion !== s.user.sv) return null;
  return u;
});

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/signout");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (!u.isAdmin) redirect("/");
  return u;
}
