import "@tanstack/react-start/server-only";
import { INJECTABLE_TOPICS, buildFactsBlock } from "../model/events";
import { fetchEventsSince, getCursor, setCursor } from "./backend";

/**
 * Khối SHARED CONTEXT cho một astronaut, tại một consumer (orchestrator/composer) cụ thể.
 * Đọc cursor → fetch events mới → dựng block → tiến cursor (best-effort, at-least-once:
 * hỏng thì lần sau đọc lại từ vị trí cũ). BẤT KỲ failure nào → null, chat/compose vẫn chạy.
 * Không cache gì — HTTP loopback rẻ, và events phải mới ở mỗi turn.
 */
export async function sharedEventsBlock(astronautId: string, consumerId: string): Promise<string | null> {
  try {
    const cursor = await getCursor(consumerId);
    const page = await fetchEventsSince({ cursor, astronautId, topics: INJECTABLE_TOPICS, limit: 50 });
    if (!page) return null;
    const block = buildFactsBlock(page.events);
    // Tiến cursor kể cả khi block rỗng (chỉ có agent.turn.completed lọt lưới chẳng hạn),
    // để consumer không kéo đi kéo lại cùng một lượng dữ liệu.
    if (page.cursor > cursor) {
      await setCursor(consumerId, page.cursor).catch(() => null);
    }
    return block;
  } catch {
    return null;
  }
}
