/**
 * Budget-optimized product metadata client.
 *
 * Gemini Flash generation runs on the FastAPI backend (never in the browser).
 * The server checks public.products first and only bills Gemini when
 * seo_description and technical_summary are both empty.
 */

import { api } from "../../services/api";

export type ProductMetadata = {
  seo_description: string | null;
  technical_summary: string | null;
  cached: boolean;
  generated: boolean;
  error: string | null;
};

export type RawProductData = {
  chemical?: string;
  chemical_type?: string;
  brand?: string;
  packaging?: string;
  use_case?: string;
  [key: string]: unknown;
};

const EMPTY: ProductMetadata = {
  seo_description: null,
  technical_summary: null,
  cached: false,
  generated: false,
  error: "unavailable",
};

export async function getOrGenerateProductMetadata(
  productId: string,
  rawProductData?: RawProductData,
): Promise<ProductMetadata> {
  if (!productId) return EMPTY;
  try {
    const res = await api.post<ProductMetadata>(
      `/pms/products/${productId}/metadata`,
      { raw_product_data: rawProductData ?? {} },
      { timeout: 20_000 },
    );
    return {
      seo_description: res.data.seo_description ?? null,
      technical_summary: res.data.technical_summary ?? null,
      cached: Boolean(res.data.cached),
      generated: Boolean(res.data.generated),
      error: res.data.error ?? null,
    };
  } catch {
    return EMPTY;
  }
}
