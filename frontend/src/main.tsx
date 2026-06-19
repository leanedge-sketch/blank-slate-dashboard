import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ImportFinanceDockProvider } from "./contexts/ImportFinanceDockContext";
import { CanonicalUrlRedirect } from "./components/CanonicalUrlRedirect";
import { SupabaseBootstrap } from "./components/SupabaseBootstrap";
import App from "./App";

import "./styles.css";
import "./pages/crm/crm-home.css";
import { isRequestAborted } from "./lib/request-errors";

// Supabase auth can abort overlapping session reads during login — not a user-facing error.
window.addEventListener("unhandledrejection", (event) => {
  if (isRequestAborted(event.reason)) {
    event.preventDefault();
  }
});

// Clear one-shot reload flag after a successful boot (see stale-chunk-reload in index.html).
try {
  sessionStorage.removeItem("stale-chunk-reload");
} catch {
  // ignore
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <CanonicalUrlRedirect />
      <SupabaseBootstrap>
        <AuthProvider>
          <ProductCatalogProvider>
            <ImportFinanceDockProvider>
              <App />
            </ImportFinanceDockProvider>
          </ProductCatalogProvider>
        </AuthProvider>
      </SupabaseBootstrap>
    </BrowserRouter>
  </React.StrictMode>
);


