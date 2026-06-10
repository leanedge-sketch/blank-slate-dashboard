/** TDS Master Data table columns — structure only until rows are added manually. */
export const TDS_MASTER_COLUMNS = [
  { key: "brand", label: "Brand" },
  { key: "chemical_type", label: "Chemical Type" },
  { key: "grade", label: "Grade" },
  { key: "owner", label: "Owner" },
  { key: "source", label: "Source" },
  { key: "description", label: "Description" },
  { key: "pdf", label: "PDF" },
  { key: "created", label: "Created" },
] as const;
