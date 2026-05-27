import { fetchSharedCatalog, type ChemicalFullData } from "../services/api";

const PAGE_SIZE = 2000;

/** Load entire chemical_full_data catalog (paginated). */
export async function fetchAllCatalogProducts(): Promise<{
  chemicals: ChemicalFullData[];
  total: number;
}> {
  let offset = 0;
  let total = 0;
  const chemicals: ChemicalFullData[] = [];

  while (true) {
    const res = await fetchSharedCatalog({ limit: PAGE_SIZE, offset });
    const batch = res.chemicals || [];
    total = res.total ?? chemicals.length + batch.length;
    chemicals.push(...batch);
    if (batch.length < PAGE_SIZE || chemicals.length >= total) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return { chemicals, total };
}
