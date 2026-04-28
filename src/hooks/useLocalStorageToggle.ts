import { useCallback, useEffect, useState } from "react";

const LOCAL_STORAGE_TOGGLE_EVENT = "skill-link:local-storage-toggle";
const EMPTY_LEGACY_KEYS: readonly string[] = [];

function readToggleValue(
  key: string,
  defaultValue: boolean,
  legacyKeys: readonly string[] = EMPTY_LEGACY_KEYS
) {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) return stored === "true";
    for (const legacyKey of legacyKeys) {
      const legacyValue = window.localStorage.getItem(legacyKey);
      if (legacyValue !== null) return legacyValue === "true";
    }
  } catch {
    return defaultValue;
  }
  return defaultValue;
}

export function useLocalStorageToggle(
  key: string,
  defaultValue = false,
  legacyKeys: readonly string[] = EMPTY_LEGACY_KEYS
) {
  const [value, setValue] = useState(() => readToggleValue(key, defaultValue, legacyKeys));

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === key || legacyKeys.includes(event.key ?? "")) {
        setValue(readToggleValue(key, defaultValue, legacyKeys));
      }
    }

    function handleLocalToggle(event: Event) {
      const detail = (event as CustomEvent<{ key: string; value: boolean }>).detail;
      if (detail?.key === key) {
        setValue(detail.value);
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCAL_STORAGE_TOGGLE_EVENT, handleLocalToggle);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCAL_STORAGE_TOGGLE_EVENT, handleLocalToggle);
    };
  }, [defaultValue, key, legacyKeys]);

  const toggle = useCallback(() => {
    setValue((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(key, String(next));
        window.dispatchEvent(
          new CustomEvent(LOCAL_STORAGE_TOGGLE_EVENT, {
            detail: { key, value: next },
          })
        );
      } catch {
        // Ignore storage failures
      }
      return next;
    });
  }, [key]);

  return [value, toggle] as const;
}
