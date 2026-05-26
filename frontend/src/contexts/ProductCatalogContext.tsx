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
  fetchSharedCatalog,
} from "../services/api";
import { CATALOG_UPDATED_EVENT } from "../lib/catalogEvents";

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

export function ProductCatalogProvider({ children }: { children: ReactNode }) {
  const [chemicals, setChemicals] = useState<ChemicalFullData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSharedCatalog({ limit: 5000, offset: 0 });
      setChemicals(res.chemicals || []);
      setTotal(res.total ?? res.chemicals?.length ?? 0);
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
    refreshCatalog();
    const onUpdated = () => {
      void refreshCatalog();
    };
    window.addEventListener(CATALOG_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(CATALOG_UPDATED_EVENT, onUpdated);
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

/** Safe when provider is optional (e.g. tests). */
export function useProductCatalogOptional(): ProductCatalogContextValue | null {
  return useContext(ProductCatalogContext);
}
