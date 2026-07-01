const WORKBOOK_UPLOAD_KEY = "trade-transit-workbook-upload";

export type StashedWorkbookUpload = {
  fileName: string;
  text: string;
  stashedAt: number;
};

export async function stashWorkbookForUpload(file: File): Promise<void> {
  const text = await file.text();
  stashWorkbookText(file.name, text);
}

/** Stash raw workbook text (Excel paste or CSV file contents). */
export function stashWorkbookText(fileName: string, text: string): void {
  const payload: StashedWorkbookUpload = {
    fileName,
    text,
    stashedAt: Date.now(),
  };
  sessionStorage.setItem(WORKBOOK_UPLOAD_KEY, JSON.stringify(payload));
}

export function consumeStashedWorkbookUpload(): StashedWorkbookUpload | null {
  const raw = sessionStorage.getItem(WORKBOOK_UPLOAD_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(WORKBOOK_UPLOAD_KEY);
  try {
    const parsed = JSON.parse(raw) as StashedWorkbookUpload;
    if (!parsed.fileName || !parsed.text) return null;
    return parsed;
  } catch {
    return null;
  }
}
