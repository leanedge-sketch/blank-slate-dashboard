import { useEffect, useState } from "react";

const STORAGE_KEY = "leanchem_recent_records";
const MAX_ITEMS = 5;

export interface RecentRecord {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  url: string;
  accessedAt: number;
}

function readStore(): RecentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.id && item?.url && item?.title);
  } catch {
    return [];
  }
}

function writeStore(items: RecentRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    window.dispatchEvent(new Event("leanchem-recent-records"));
  } catch {
    // ignore quota / private mode
  }
}

export function trackRecentRecord(input: {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  url: string;
}): void {
  const id = String(input.id || "").trim();
  const title = String(input.title || "").trim();
  const url = String(input.url || "").trim();
  if (!id || !title || !url) return;

  const next: RecentRecord = {
    id,
    title,
    subtitle: input.subtitle,
    module: input.module,
    url,
    accessedAt: Date.now(),
  };
  const rest = readStore().filter((item) => item.id !== id && item.url !== url);
  writeStore([next, ...rest]);
}

export function listRecentRecords(): RecentRecord[] {
  return readStore();
}

export function useRecentlyAccessed(): {
  items: RecentRecord[];
  trackRecentRecord: typeof trackRecentRecord;
} {
  const [items, setItems] = useState<RecentRecord[]>(() => listRecentRecords());

  useEffect(() => {
    const refresh = () => setItems(listRecentRecords());
    window.addEventListener("storage", refresh);
    window.addEventListener("leanchem-recent-records", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("leanchem-recent-records", refresh);
    };
  }, []);

  return { items, trackRecentRecord };
}
