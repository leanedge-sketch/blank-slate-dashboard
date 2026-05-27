import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ChemicalFullData,
  ChemicalType,
} from "../services/api";
import {
  CATALOG_PRODUCT_UPSERTED_EVENT,
  CATALOG_UPDATED_EVENT,
} from "../lib/catalogEvents";
import { fetchAllCatalogProducts } from "../utils/fetchAllCatalog";

interface ProductCatalogContextValue {
  chemicals: ChemicalFullData[];
  chemicalTypes: ChemicalType[];
  total: number;
  loading: boolean;
  error: string | null;
  refreshCatalog: () => Promise<void>;
}

const ProductCatalogContext = createContext<ProductCatalogContextValue | null>(
  null,
);

function toChemicalType(c: ChemicalFullData): ChemicalType {
  return {
    id: c.id,
    name: c.product_name || "",
    category: c.product_category,
    hs_code: c.hs_code,
    applications: null,
    spec_template: null,
    metadata: {
      vendor: c.vendor,
      sub_category: c.sub_category,
      packing: c.packing,
      typical_application: c.typical_application,
      product_description: c.product_description,
      price: c.price,
      chemical_full_data_id: c.id,
      uuid_id: c.uuid_id ? String(c.uuid_id) : null,
    },
    created_at: null,
  };
}

function mergeCatalogRow(
  list: ChemicalFullData[],
  row: ChemicalFullData,
): ChemicalFullData[] {
  const idx = list.findIndex((c) => c.id === row.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = row;
    return next;
  }
  return [...list, row];
}

export function ProductCatalogProvider({ children }: { children: ReactNode }) {
  const [chemicals, setChemicals] = useState<ChemicalFullData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAllCatalogProducts();
      setChemicals(res.chemicals);
      setTotal(res.total);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load product catalog";
      setError(message);
      console.warn("Product catalog refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();

    const onUpdated = () => {
      void refreshCatalog();
    };

    const onUpserted = (event: Event) => {
      const row = (event as CustomEvent<ChemicalFullData>).detail;
      if (!row?.id) return;
      setChemicals((prev) => {
        const merged = mergeCatalogRow(prev, row);
        setTotal(merged.length);
        return merged;
      });
    };

    window.addEventListener(CATALOG_UPDATED_EVENT, onUpdated);
    window.addEventListener(CATALOG_PRODUCT_UPSERTED_EVENT, onUpserted);
    return () => {
      window.removeEventListener(CATALOG_UPDATED_EVENT, onUpdated);
      window.removeEventListener(CATALOG_PRODUCT_UPSERTED_EVENT, onUpserted);
    };
  }, [refreshCatalog]);

  const chemicalTypes = useMemo(
    () => chemicals.map(toChemicalType),
    [chemicals],
  );

  const value = useMemo(
    () => ({
      chemicals,
      chemicalTypes,
      total,
      loading,
      error,
      refreshCatalog,
    }),
    [chemicals, chemicalTypes, total, loading, error, refreshCatalog],
  );

  return (
    <ProductCatalogContext.Provider value={value}>
      {children}
    </ProductCatalogContext.Provider>
  );
}

export function useProductCatalog(): ProductCatalogContextValue {
  const ctx = useContext(ProductCatalogContext);
  if (!ctx) {
    throw new Error("useProductCatalog must be used within ProductCatalogProvider");
  }
  return ctx;
}

export function useProductCatalogOptional(): ProductCatalogContextValue | null {
  return useContext(ProductCatalogContext);
}
