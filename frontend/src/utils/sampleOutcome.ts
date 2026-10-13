export type SampleOutcome = "pass" | "fail";

export function getSampleOutcome(
  pipeline: { metadata?: Record<string, unknown> | null } | null | undefined,
): SampleOutcome | null {
  const raw = pipeline?.metadata?.sample_outcome;
  if (raw == null) return null;
  const value = String(raw).trim().toLowerCase();
  if (value === "pass" || value === "passed") return "pass";
  if (value === "fail" || value === "failed") return "fail";
  return null;
}

export function sampleOutcomeLabel(outcome: SampleOutcome | null): string {
  if (outcome === "pass") return "Pass";
  if (outcome === "fail") return "Fail";
  return "Pending";
}
