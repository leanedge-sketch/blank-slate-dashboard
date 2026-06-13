import { useState } from "react";
import { MapPin, Plus, X } from "lucide-react";
import type { PricingLocation, PricingLocationInput } from "./types";
import { formatLocationLabel } from "./utils";

type LocationPickerProps = {
  locations: PricingLocation[];
  value: string;
  onChange: (locationId: string) => void;
  onAddLocation: (location: PricingLocationInput) => Promise<string>;
};

const emptyDraft = (): PricingLocationInput => ({
  country: "",
  city: "",
  port: "",
});

export function LocationPicker({
  locations,
  value,
  onChange,
  onAddLocation,
}: LocationPickerProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<PricingLocationInput>(emptyDraft);

  function cancelAdd() {
    setAdding(false);
    setDraft(emptyDraft());
  }

  function submitLocation() {
    const country = draft.country.trim();
    if (!country) return;
    void onAddLocation({
      country,
      city: draft.city?.trim() || null,
      port: draft.port?.trim() || null,
    }).then(() => cancelAdd());
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Location
          </label>
          <select
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
          >
            <option value="">Select location…</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {formatLocationLabel(loc)}
              </option>
            ))}
          </select>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              New location
            </p>
            <button
              type="button"
              onClick={cancelAdd}
              className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">
              Country <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
              placeholder="e.g. Kenya"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-600">
                City <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={draft.city ?? ""}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                placeholder="e.g. Mombasa"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">
                Port <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={draft.port ?? ""}
                onChange={(e) => setDraft({ ...draft, port: e.target.value })}
                placeholder="e.g. Port of Mombasa"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={submitLocation}
            disabled={!draft.country.trim()}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save location
          </button>
        </div>
      )}
    </div>
  );
}
