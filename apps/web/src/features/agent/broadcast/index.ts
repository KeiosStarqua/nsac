// Public surface of the broadcast feature (v1 vertical slice).
// Server-only runtime modules are re-exported for use from *.server.ts call sites;
// the model layer is pure and safe anywhere.
export { EVENT_TOPICS, INJECTABLE_TOPICS, buildFactsBlock } from "./model/events";
export type { ChangeEvent, EventTopic, InjectableTopic } from "./model/events";
export { publishEvent, fetchEventsSince, getCursor, setCursor } from "./runtime/backend";
export type { PublishEventInput } from "./runtime/backend";
export { sharedEventsBlock } from "./runtime/shared-context";
