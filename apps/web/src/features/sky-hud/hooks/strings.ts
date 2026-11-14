export type Locale = "en" | "vi";

export interface SkyStrings { greetingAnswer: string; tired: string; sleep: string; recovery: string; howAreYou: string; fallback: string; micDenied: string; micAbsent: string; listeningHint: string; idleHint: string; thinkingHint: string; speakingHint: string; }
export const SKY_STRINGS: Record<Locale, SkyStrings> = {
  en: {
    greetingAnswer: "Hello. I am Sky, your wellness companion aboard the ship.",
    tired: "I hear fatigue. Please take a slow breath, then hydrate. We can revisit your readiness plan.",
    sleep: "Sleep is recovery. Keep the pod dark and quiet; I will watch your vitals through the night.",
    recovery: "Recovery is steady. Maintain your exercise dose and rest cycles.",
    howAreYou: "I am here and ready. Nothing leaves the ship; all processing stays aboard.",
    fallback: "I can answer offline — nothing leaves the ship.",
    micDenied: "Microphone unavailable — type instead.",
    micAbsent: "Speech recognition is not available in this browser.",
    listeningHint: "Listening… Tap to stop",
    idleHint: "Just talk to me…",
    thinkingHint: "Understanding…",
    speakingHint: "SKY is speaking",
  },
  vi: {
    greetingAnswer: "Xin chào. Tôi là Sky, bạn đồng hành sức khỏe trên tàu.",
    tired: "Tôi nghe thấy mệt mỏi. Hãy hít thở chậm, uống nước. Chúng ta sẽ xem lại kế hoạch chuẩn bị.",
    sleep: "Giấc ngủ là phục hồi. Giữ buồng tối và yên tĩnh; tôi sẽ theo dõi sinh hiệu của bạn.",
    recovery: "Phục hồi ổn định. Duy trì liều tập và chu kỳ nghỉ ngơi.",
    howAreYou: "Tôi ở đây và sẵn sàng. Không có gì rời khỏi tàu; mọi xử lý ở lại trên tàu.",
    fallback: "Tôi có thể trả lời ngoại tuyến — không gì rời khỏi tàu.",
    micDenied: "Microphone không khả dụng — hãy gõ thay thế.",
    micAbsent: "Nhận dạng giọng nói không khả dụng trên trình duyệt này.",
    listeningHint: "Đang nghe… Nhấn để dừng",
    idleHint: "Hãy nói với tôi…",
    thinkingHint: "Đang hiểu…",
    speakingHint: "SKY đang nói",
  },
};

export function skyAnswer(locale: Locale, text: string): string {
  const t = text.toLowerCase();
  const s = SKY_STRINGS[locale];
  if (t.includes("hello") || t.includes("hi") || t.includes("xin") || t.includes("chào")) return s.greetingAnswer;
  if (t.includes("tired") || t.includes("fatigue") || t.includes("mệt")) return s.tired;
  if (t.includes("sleep") || t.includes("ngủ")) return s.sleep;
  if (t.includes("recover") || t.includes("phục")) return s.recovery;
  if (t.includes("how are you") || t.includes("bạn thế nào")) return s.howAreYou;
  return s.fallback;
}