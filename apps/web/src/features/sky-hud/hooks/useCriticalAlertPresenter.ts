import { useCallback, useState } from "react";

export interface CriticalAlert {
  id: string;
  message: string;
  priority: "polite" | "assertive";
}

export function useCriticalAlertPresenter() {
  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
  const [liveText, setLiveText] = useState("");

  const present = useCallback((alert: CriticalAlert) => {
    setAlerts((prev) => [...prev, alert]);
    setLiveText(alert.message);
  }, []);

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clear = useCallback(() => {
    setAlerts([]);
    setLiveText("");
  }, []);

  return { alerts, liveText, present, dismiss, clear };
}