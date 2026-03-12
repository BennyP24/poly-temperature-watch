import { useState, useCallback, useMemo } from "react";

function safeLocalStorageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeLocalStorageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch {}
}
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(value);
  const base = `${name}=${encoded}; path=/; max-age=31536000; samesite=lax`;
  document.cookie = `${base}; domain=.lovable.app`;
  if (!readCookie(name)) document.cookie = base;
}

function parseSaved(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch { return new Set(); }
}

function persistSaved(storageKey: string, cookieKey: string, next: Set<string>): void {
  const serialized = JSON.stringify([...next]);
  safeLocalStorageSet(storageKey, serialized);
  writeCookie(cookieKey, serialized);
}

function loadSaved(storageKey: string, cookieKey: string): Set<string> {
  const fromStorage = parseSaved(safeLocalStorageGet(storageKey));
  if (fromStorage.size > 0) { persistSaved(storageKey, cookieKey, fromStorage); return fromStorage; }
  const fromCookie = parseSaved(readCookie(cookieKey));
  if (fromCookie.size > 0) { persistSaved(storageKey, cookieKey, fromCookie); return fromCookie; }
  return new Set();
}

export function useSavedBets(storageKey = "saved-bets") {
  const cookieKey = storageKey.replace(/-/g, "_");
  const [saved, setSaved] = useState<Set<string>>(() => loadSaved(storageKey, cookieKey));

  const toggle = useCallback((id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      persistSaved(storageKey, cookieKey, next);
      return next;
    });
  }, [storageKey, cookieKey]);

  const replaceSaved = useCallback((ids: string[]) => {
    const next = new Set(ids.filter((id) => typeof id === "string" && id.length > 0));
    persistSaved(storageKey, cookieKey, next);
    setSaved(next);
  }, [storageKey, cookieKey]);

  const isSaved = useCallback((id: string) => saved.has(id), [saved]);
  const savedIds = useMemo(() => [...saved], [saved]);

  return { toggle, isSaved, savedIds, replaceSaved };
}
