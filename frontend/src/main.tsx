import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CanonicalUrlRedirect } from "./components/CanonicalUrlRedirect";
import { SupabaseBootstrap } from "./components/SupabaseBootstrap";
import App from "./App";

import "./styles.css";
import "./pages/crm/crm-home.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <CanonicalUrlRedirect />
      <SupabaseBootstrap>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SupabaseBootstrap>
    </BrowserRouter>
  </React.StrictMode>
);


