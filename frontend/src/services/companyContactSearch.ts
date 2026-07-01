import { fetchCustomers, type Customer } from "./api";
import {
  searchImportShipmentsByClientContact,
  type ImportShipmentRow,
} from "./importFinance";

export type CompanyContactSearchResult = {
  crmMatches: Customer[];
  shipmentMatches: ImportShipmentRow[];
  hasMatches: boolean;
};

export async function searchCompanyAndContact(
  companyName: string,
  contactPerson: string,
): Promise<CompanyContactSearchResult> {
  const company = companyName.trim();
  const contact = contactPerson.trim();
  if (!company && !contact) {
    return { crmMatches: [], shipmentMatches: [], hasMatches: false };
  }

  const [crmRes, shipmentMatches] = await Promise.all([
    fetchCustomers({
      limit: 50,
      ...(company ? { q: company } : {}),
      ...(contact ? { contact } : {}),
    }).catch(() => ({ customers: [], total: 0 })),
    searchImportShipmentsByClientContact(company || undefined, contact || undefined).catch(
      () => [] as ImportShipmentRow[],
    ),
  ]);

  const crmMatches = crmRes.customers ?? [];
  return {
    crmMatches,
    shipmentMatches,
    hasMatches: crmMatches.length > 0 || shipmentMatches.length > 0,
  };
}
