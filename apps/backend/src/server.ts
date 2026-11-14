import { readingsRepo } from "./db/repositories/readings";

const port = Number(process.env.PORT ?? 3200);

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }
    if (url.pathname === "/readings") {
      const rows = await readingsRepo.list();
      return Response.json(rows);
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(`backend listening on ${port}`);