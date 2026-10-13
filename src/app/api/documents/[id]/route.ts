import fs from "fs/promises";
import { currentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ALLOWED, docPath } from "@/server/documents";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const doc = await db.deadlineDocument.findFirst({ where: { id, userId: user.id } });
  const kind = doc && ALLOWED[doc.ext];
  if (!doc || !kind) return new Response("Not found", { status: 404 });
  try {
    const body = new Uint8Array(await fs.readFile(docPath(doc)));
    return new Response(body, {
      headers: {
        "Content-Type": kind.mime,
        "Content-Disposition": `${kind.inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
        "X-Content-Type-Options": "nosniff",
        // il viewer PDF di Chrome non funziona con "sandbox": per i PDF niente CSP, per il resto isolamento completo
        ...(doc.ext === "pdf" ? {} : { "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'" }),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
