import cron from "node-cron";
import { bootstrap } from "./server/bootstrap";
import { processRecurring, notifyDeadlines, takeAllSnapshots } from "./server/services";

export async function startNode() {
  await bootstrap();
  const safe = (name: string, fn: () => Promise<unknown>) => async () => {
    try { await fn(); } catch (e) { console.error(`[cron:${name}]`, e); }
  };
  void safe("recurring", () => processRecurring())();
  cron.schedule("0 7 * * *", safe("recurring", () => processRecurring()), { timezone: "Europe/Rome" });
  cron.schedule("5 9 * * *", safe("deadlines", () => notifyDeadlines()), { timezone: "Europe/Rome" });
  cron.schedule("30 23 * * *", safe("snapshot", () => takeAllSnapshots()), { timezone: "Europe/Rome" });
}
