/** Fired when one or more import-finance pipeline lines are saved to Supabase. */
export const PIPELINE_SAVED_EVENT = "import-finance-pipeline-saved";

export type PipelineSavedDetail = {
  count: number;
  clientName?: string;
  requestRef?: string;
};

export function notifyPipelineSaved(detail: PipelineSavedDetail = { count: 1 }): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PIPELINE_SAVED_EVENT, { detail }));
  }
}
