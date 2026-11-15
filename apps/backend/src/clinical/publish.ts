// Change-event publish — direct insert vào change_events (mirror insert block của postEvent).
// KHÔNG HTTP-loopback vào chính mình. Payload nhỏ (< 1 KB); eventsBus.emit giữ parity
// với logging hiện có ([events] <id> <topic>).
//
// Dùng chung cho clinical (`medical.*`) và health facts (`health.fact.updated`) — một bus duy nhất
// mà agent đọc (HARNESSING §3.5), không có bus song song.
import { eventsDb } from "../db/eventsClient";
import { changeEvents } from "../db/schema/changeEvents";
import { eventsBus, eventPayloadSchemas, type EventTopic } from "../eventsRoutes";

export function publishChangeEvent(
  topic: EventTopic,
  astronautId: string | null,
  source: string,
  summary: string | undefined,
  payload: unknown,
): number {
  const schema = eventPayloadSchemas[topic];
  const parsed = schema.parse(payload); // throw nếu payload sai — caller chịu trách nhiệm try/catch
  const now = Date.now();
  const inserted = eventsDb
    .insert(changeEvents)
    .values({
      astronautId,
      topic,
      source,
      summary: summary ?? null,
      payload: JSON.stringify(parsed),
      createdAt: now,
    })
    .returning({ id: changeEvents.id })
    .all()[0];

  eventsBus.emit("published", {
    id: inserted.id,
    astronautId,
    topic,
    source,
    summary: summary ?? null,
    payload: parsed as Record<string, unknown>,
    createdAt: now,
  });
  return inserted.id;
}

/** Alias back-compat cho clinical callers (cùng implementation). */
export const publishClinicalEvent = publishChangeEvent;
