import { describe, test, expect, beforeAll } from "bun:test";
import { astronautsRepo } from "../src/db/repositories/astronauts";

test("seed 6 astronauts", async () => {
  await astronautsRepo.seed();
  const list = await astronautsRepo.list();
  expect(list.length).toBeGreaterThanOrEqual(6);
});

test("get by id", async () => {
  const a = await astronautsRepo.get("ayla-reyes");
  expect(a).not.toBeNull();
  expect(a!.name).toBe("Ayla Reyes");
  expect(a!.roleCode).toBe("CDR-01");
});

test("get missing returns null", async () => {
  const a = await astronautsRepo.get("nope");
  expect(a).toBeNull();
});