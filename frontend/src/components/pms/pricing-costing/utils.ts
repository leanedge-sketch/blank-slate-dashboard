import type { PricingRecord } from "./types";

export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatExchangeRateLabel(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): string {
  return `1 ${fromCurrency} = ${formatAmount(rate)} ${toCurrency}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export type MarginComputeOptions = {
  /** Live rate for simulation — applies when pair matches the record. */
  liveRate?: number | null;
  liveFromCurrency?: string;
  liveToCurrency?: string;
  simulate?: boolean;
};

export type MarginResult = {
  amount: number | null;
  sameCurrency: boolean;
  currency: string | null;
  simulated: boolean;
  rateLabel: string | null;
  missingRate: boolean;
};

export function computeMargin(
  record: PricingRecord,
  options?: MarginComputeOptions,
): MarginResult {
  const sameCurrency = record.costCurrency === record.priceCurrency;

  if (sameCurrency) {
    return {
      amount: record.priceAmount - record.costAmount,
      sameCurrency: true,
      currency: record.priceCurrency,
      simulated: false,
      rateLabel: null,
      missingRate: false,
    };
  }

  let rate = record.exchangeRateUsed;
  let simulated = false;

  if (
    options?.simulate &&
    options.liveRate != null &&
    options.liveRate > 0 &&
    options.liveFromCurrency === record.costCurrency &&
    options.liveToCurrency === record.priceCurrency
  ) {
    rate = options.liveRate;
    simulated = true;
  }

  if (rate == null || rate <= 0) {
    return {
      amount: null,
      sameCurrency: false,
      currency: record.baseCurrency ?? record.priceCurrency,
      simulated: false,
      rateLabel: null,
      missingRate: true,
    };
  }

  const convertedCost = record.costAmount * rate;
  const marginAmount = record.priceAmount - convertedCost;
  const currency = record.baseCurrency ?? record.priceCurrency;
  const rateLabel = formatExchangeRateLabel(
    record.costCurrency,
    record.priceCurrency,
    rate,
  );

  return {
    amount: marginAmount,
    sameCurrency: false,
    currency,
    simulated,
    rateLabel,
    missingRate: false,
  };
}

export function groupRecordsByLocation(
  records: PricingRecord[],
): { location: string; records: PricingRecord[] }[] {
  const map = new Map<string, PricingRecord[]>();
  for (const record of records) {
    const loc = record.location.trim() || "Unassigned";
    const bucket = map.get(loc) ?? [];
    bucket.push(record);
    map.set(loc, bucket);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([location, rows]) => ({
      location,
      records: rows.sort((x, y) => {
        const statusOrder = (s: PricingRecord["status"]) =>
          s === "active" ? 0 : s === "draft" ? 1 : 2;
        const byStatus = statusOrder(x.status) - statusOrder(y.status);
        if (byStatus !== 0) return byStatus;
        return x.incoterm.localeCompare(y.incoterm);
      }),
    }));
}

export function newRecordId(): string {
  return `pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function partnerTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function currenciesMismatch(record: PricingRecord): boolean {
  return record.costCurrency !== record.priceCurrency;
}
