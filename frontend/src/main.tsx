import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProductCatalogProvider } from "./contexts/ProductCatalogContext";
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <CanonicalUrlRedirect />
      <SupabaseBootstrap>
        <AuthProvider>
          <ProductCatalogProvider>
            <App />
          </ProductCatalogProvider>
        </AuthProvider>
      </SupabaseBootstrap>
    </BrowserRouter>
  </React.StrictMode>
);


