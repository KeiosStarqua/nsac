import { useEffect } from "react";
import { heartbeatClaim } from "./api/claims.functions";
import { getOrCreateSessionId } from "./model/session";

/** Nhịp heartbeat: backend tự giải phóng claim sau 30 phút không thấy session (TTL server-side). */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Giữ claim của session này sống trong lúc tab đang được dùng. Một nhịp ngay khi mount, sau đó
 * mỗi 30 s — chỉ khi `document.visibilityState === "visible"`; tab quay lại visible thì đập ngay
 * một nhịp. Không render gì, không expose state: best-effort, mọi lỗi bị nuốt để HUD không bao
 * giờ bị ảnh hưởng (backend chết ⇒ claim hết hạn là chuyện của server, demo vẫn chạy local pick).
 */
export function useClaimHeartbeat(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionId = getOrCreateSessionId();
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      void heartbeatClaim({ data: { sessionId } }).catch(() => undefined);
    };
    beat();
    const timer = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
