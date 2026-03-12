import { useState, useCallback, useMemo } from "react";

const STORAGE_KEY = "saved-bets";
const COOKIE_KEY = "saved_bets";

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
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
  if (!readCookie(name)) {
    document.cookie = base;
  }
}

function parseSaved(raw: string | null): Set<string> {
  if (!raw) return new Set();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

function persistSaved(next: Set<string>): void {
  const serialized = JSON.stringify([...next]);
  safeLocalStorageSet(STORAGE_KEY, serialized);
  writeCookie(COOKIE_KEY, serialized);
}

function loadSaved(): Set<string> {
  const fromStorage = parseSaved(safeLocalStorageGet(STORAGE_KEY));
  if (fromStorage.size > 0) {
    persistSaved(fromStorage);
    return fromStorage;
  }

  const fromCookie = parseSaved(readCookie(COOKIE_KEY));
  if (fromCookie.size > 0) {
    persistSaved(fromCookie);
    return fromCookie;
  }

  return new Set();
}

export function useSavedBets() {
  const [saved, setSaved] = useState<Set<string>>(loadSaved);

  const toggle = useCallback((id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistSaved(next);
      return next;
    });
  }, []);

  const replaceSaved = useCallback((ids: string[]) => {
    const next = new Set(ids.filter((id) => typeof id === "string" && id.length > 0));
    persistSaved(next);
    setSaved(next);
  }, []);

  const isSaved = useCallback((id: string) => saved.has(id), [saved]);
  const savedIds = useMemo(() => [...saved], [saved]);

  return { toggle, isSaved, savedIds, replaceSaved };
}
