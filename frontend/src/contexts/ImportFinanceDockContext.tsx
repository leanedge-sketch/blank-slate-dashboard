import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ImportFinanceCalculatorDock } from "../components/finance/ImportFinanceCalculatorDock";

type ImportFinanceDockContextValue = {
  open: boolean;
  openDock: () => void;
  closeDock: () => void;
  toggleDock: () => void;
};

const ImportFinanceDockContext = createContext<ImportFinanceDockContextValue | null>(
  null,
);

export function ImportFinanceDockProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openDock = useCallback(() => setOpen(true), []);
  const closeDock = useCallback(() => setOpen(false), []);
  const toggleDock = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, openDock, closeDock, toggleDock }),
    [open, openDock, closeDock, toggleDock],
  );

  return (
    <ImportFinanceDockContext.Provider value={value}>
      {children}
      <ImportFinanceCalculatorDock open={open} onClose={closeDock} />
    </ImportFinanceDockContext.Provider>
  );
}

export function useImportFinanceDock(): ImportFinanceDockContextValue {
  const ctx = useContext(ImportFinanceDockContext);
  if (!ctx) {
    throw new Error("useImportFinanceDock must be used within ImportFinanceDockProvider");
  }
  return ctx;
}
