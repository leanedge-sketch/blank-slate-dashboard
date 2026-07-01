/** Fired when one or more import-finance pipeline lines are saved to Supabase. */
export const PIPELINE_SAVED_EVENT = "import-finance-pipeline-saved";

/** Fired when an entire saved procurement request is deleted from Supabase. */
export const PIPELINE_DELETED_EVENT = "import-finance-pipeline-deleted";

export type PipelineSavedDetail = {
  count: number;
  clientName?: string;
  requestRef?: string;
};

export type PipelineDeletedDetail = {
  count: number;
  clientName?: string;
  requestRef?: string;
  shipmentIds?: string[];
};

export function notifyPipelineSaved(detail: PipelineSavedDetail = { count: 1 }): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PIPELINE_SAVED_EVENT, { detail }));
  }
}

export function notifyPipelineDeleted(detail: PipelineDeletedDetail): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PIPELINE_DELETED_EVENT, { detail }));
  }
}
