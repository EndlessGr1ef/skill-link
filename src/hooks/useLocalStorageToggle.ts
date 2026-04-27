import { useState } from "react";

export function useLocalStorageToggle(key: string, defaultValue = false) {
  const [value, setValue] = useState(() => {
    try {
      return window.localStorage.getItem(key) === "true";
    } catch {
      return defaultValue;
    }
  });

  function toggle() {
    setValue((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Ignore storage failures
      }
      return next;
    });
  }

  return [value, toggle] as const;
}
