import { currentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { readReceipt } from "@/server/receipts";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const tx = await db.transaction.findFirst({ where: { id, userId: user.id }, select: { receiptFile: true } });
  if (!tx?.receiptFile) return new Response("Not found", { status: 404 });
  try {
    return new Response(new Uint8Array(await readReceipt(tx.receiptFile)), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
