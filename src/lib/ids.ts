import { randomUUID } from "node:crypto";

/** Short, sortable-ish id: time prefix + random. Good enough for a local app. */
export function newId(prefix = ""): string {
  return `${prefix}${prefix ? "_" : ""}${randomUUID().slice(0, 12)}`;
}
