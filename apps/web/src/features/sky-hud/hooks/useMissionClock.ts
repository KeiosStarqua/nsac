import { useEffect, useState } from "react";

export interface MissionClock {
  dayLabel: string;
  timeLabel: string;
}

export function useMissionClock(missionDay: number, baseIso?: string): MissionClock {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
    const base = baseIso ? Date.parse(baseIso) : Date.now();
    const start = Date.now();
    const tick = () => setNow(base + (Date.now() - start));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [baseIso]);

  if (!mounted) {
    return { dayLabel: `ISS · Day ${missionDay}`, timeLabel: "--:--:-- UTC" };
  }
  const d = new Date(now);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return { dayLabel: `ISS · Day ${missionDay}`, timeLabel: `${hh}:${mm}:${ss} UTC` };
}