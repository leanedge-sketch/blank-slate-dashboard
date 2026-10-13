import type { SampleOutcome } from "../../utils/sampleOutcome";

export function SampleOutcomeSelect({
  value,
  onChange,
  id = "sample_outcome",
  required = false,
}: {
  value: SampleOutcome | "";
  onChange: (value: SampleOutcome | "") => void;
  id?: string;
  required?: boolean;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-amber-950">
        Sample result {required ? <span className="text-red-500">*</span> : null}
      </label>
      <p className="text-xs text-amber-900/80">
        Cold-call samples: <strong>Fail</strong> closes the deal as Lost.{" "}
        <strong>Pass</strong> keeps it at Sample until an order arrives, then move
        to Validation.
      </p>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange((e.target.value as SampleOutcome | "") || "")}
        required={required}
        className="w-full rounded-lg border border-amber-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <option value="">Select result…</option>
        <option value="pass">Pass — keep open, wait for order</option>
        <option value="fail">Fail — close deal (Lost)</option>
      </select>
    </div>
  );
}
