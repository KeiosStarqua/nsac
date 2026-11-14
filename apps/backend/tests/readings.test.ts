import { describe, test, expect } from "bun:test";
import { readingsRepo } from "../src/db/repositories/readings";

test("insert and list reading", async () => {
  const r = await readingsRepo.insert({
    astronautId: "a1",
    ts: new Date().toISOString(),
    metric: "hr",
    value: 72,
    unit: "bpm",
    source: "synthetic",
  });
  expect(r.id).toBeGreaterThan(0);
  const list = await readingsRepo.list();
  expect(list.length).toBeGreaterThan(0);
});