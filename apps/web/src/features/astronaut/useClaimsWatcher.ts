import { useEffect, useRef } from "react";
import { listClaims } from "./api/claims.functions";

/** Nhịp poll epoch reset: đủ nhanh để tab đang mở thấy force release, đủ thưa để không spam backend. */
const WATCH_INTERVAL_MS = 45_000;

/** localStorage giữ epoch reset lần cuối client đồng ý (xem SkyScreen/SkyScreenGen mount gate). */
export const CLAIMS_EPOCH_STORAGE_KEY = "nsac.claims_epoch";

/**
 * Theo dõi epoch reset claims của backend để một tab đang mở cũng bị "kick" khi ai đó bấm force
 * release (backend tăng `claims_reset_epoch`, GET /api/claims trả kèm). Mỗi 45 s, chỉ khi tab
 * visible (kiểm tra mỗi tick + ngay khi tab quay lại visible); epoch khác giá trị đã lưu → cập nhật
 * giá trị đã lưu rồi gọi `onEpochReset()`.
 *
 * Không render gì, không expose state; mọi lỗi bị nuốt (backend chết ⇒ không kick, HUD vẫn chạy).
 * Callback giữ trong ref nên caller không phải memo hoá nó. `enabled: false` (vd. `/watch`) thì
 * không poll gì cả.
 */
export function useClaimsWatcher(onEpochReset: () => void, enabled = true): void {
  const callbackRef = useRef(onEpochReset);
  callbackRef.current = onEpochReset;

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;
    let disposed = false;

    const check = () => {
      if (document.visibilityState !== "visible") return;
      void listClaims({ data: {} })
        .then((res) => {
          if (disposed) return;
          if (!res?.reachable) return;
          if (typeof res.epoch !== "number") return;
          let stored: string | null = null;
          try {
            stored = window.localStorage.getItem(CLAIMS_EPOCH_STORAGE_KEY);
          } catch {
            return; // storage unavailable → không so được, bỏ qua tick này
          }
          if (stored !== null && stored === String(res.epoch)) return;
          try {
            window.localStorage.setItem(CLAIMS_EPOCH_STORAGE_KEY, String(res.epoch));
          } catch {
            /* storage unavailable → vẫn kick, chỉ là lần sau lại kick một lần nữa */
          }
          callbackRef.current();
        })
        .catch(() => undefined);
    };

    const timer = window.setInterval(check, WATCH_INTERVAL_MS);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [enabled]);
}
