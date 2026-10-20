/* Cron pass: send reminders that are due, then point each one at its next day.
   Push sending is injected so the timing can be tested without a push service. */
import { dueReminders, nextFire, notificationFor } from "../../web/schedule.js";

async function readIndex(kv) {
  try {
    const parsed = JSON.parse(await kv.get("index") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export async function runReminders(env, now, send) {
  if (!env.REMINDERS) return { sent: 0, removed: 0 };
  const index = await readIndex(env.REMINDERS);
  let changed = false;
  let sent = 0;
  let removed = 0;
  for (let i = 0; i < index.length; i += 1) {
    const row = index[i];
    if (!row || !row.id || !row.at || now < row.at || now - row.at >= 3 * 60 * 1000) continue;
    const key = "sub:" + row.id;
    let record = null;
    try { record = JSON.parse(await env.REMINDERS.get(key) || "null"); } catch (e) { record = null; }
    if (!record || !record.subscription) {
      index.splice(i, 1);
      i -= 1;
      changed = true;
      removed += 1;
      continue;
    }
    const due = dueReminders(record, now);
    let drop = false;
    for (const item of due) {
      const status = await send(env, record.subscription, notificationFor(item.theme));
      if (status === 404 || status === 410) {
        await env.REMINDERS.delete(key);
        index.splice(i, 1);
        i -= 1;
        changed = true;
        removed += 1;
        drop = true;
        break;
      }
      if (status < 200 || status >= 300) continue;
      record.sent = Object.assign({}, record.sent, { [item.theme]: item.date });
      sent += 1;
    }
    if (drop) continue;
    if (!due.length) continue;
    const upcoming = nextFire(record, now + 1000);
    index[i] = { id: row.id, at: upcoming ? upcoming.at : 0 };
    await env.REMINDERS.put(key, JSON.stringify(record));
    changed = true;
  }
  if (changed) await env.REMINDERS.put("index", JSON.stringify(index));
  return { sent, removed };
}

export function indexEntry(id, record, now) {
  const upcoming = nextFire(record, now);
  return { id, at: upcoming ? upcoming.at : 0 };
}
