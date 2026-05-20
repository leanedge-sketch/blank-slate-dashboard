import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/auth/LoginPage";
import { AuthCallbackPage } from "./pages/auth/AuthCallbackPage";
import { SetPasswordPage } from "./pages/auth/SetPasswordPage";
import { CRMHomePage } from "./pages/crm/CRMHomePage";
import { CustomerListPage } from "./pages/crm/CustomerListPage";
import { CustomerDetailPage } from "./pages/crm/CustomerDetailPage";
import { CustomerProfilePage } from "./pages/crm/CustomerProfilePage";
import { ManageCustomersPage } from "./pages/crm/ManageCustomersPage";
import { AddCustomerPage } from "./pages/crm/AddCustomerPage";
import { CreateQuotePage } from "./pages/crm/CreateQuotePage";
import { CRMDashboardPage } from "./pages/crm/CRMDashboardPage";
import { CRMReportsPage } from "./pages/crm/CRMReportsPage";
import { PMSHomePage } from "./pages/pms/PMSHomePage";
import { ChemicalsPage } from "./pages/pms/ChemicalsPage";
import { TDSPage } from "./pages/pms/TDSPage";
import { PartnersPage } from "./pages/pms/PartnersPage";
import { PartnerChemicalsPage } from "./pages/pms/PartnerChemicalsPage";
import { PricingPage } from "./pages/pms/PricingPage";
import { ProductsPage } from "./pages/pms/ProductsPage";
import { MarketPage } from "./pages/pms/MarketPage";
import { SalesPipelinePage } from "./pages/sales/SalesPipelinePage";
import { PipelineDetailPage } from "./pages/sales/PipelineDetailPage";
import { StockAvailabilityPage } from "./pages/stock/StockAvailabilityPage";
import { GeneralStockAvailabilityPage } from "./pages/stock/GeneralStockAvailabilityPage";
import { ProductDetailPage } from "./pages/stock/ProductDetailPage";
import { ProductLabelStockPage } from "./pages/stock/ProductLabelStockPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { UserProfileMenu } from "./components/UserProfileMenu";
import { useAuth } from "./contexts/AuthContext";

function AppHeader() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAuthScreen =
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/auth/");

  if (isAuthScreen) {
    return null;
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/" className="app-title-link">
          <h1 className="app-title">LeanChem Connect</h1>
        </Link>
        <nav className="app-nav">
          {loading ? (
            <span className="app-nav-loading">Loading…</span>
          ) : user ? (
            <>
              <Link to="/">Home</Link>
              <Link to="/crm">CRM</Link>
              <Link to="/pms">PMS</Link>
              <UserProfileMenu />
            </>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="app-root">
      <AppHeader />

      <main className="app-main">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route
            path="/auth/set-password"
            element={
              <ProtectedRoute>
                <SetPasswordPage />
              </ProtectedRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />

          {/* CRM routes */}
          <Route
            path="/crm"
            element={
              <ProtectedRoute>
                <CRMHomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm/customers"
            element={
              <ProtectedRoute>
                <CustomerListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm/customers/manage"
            element={
              <ProtectedRoute>
                <ManageCustomersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm/customers/new"
            element={
              <ProtectedRoute>
                <AddCustomerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm/customers/:customerId"
            element={
              <ProtectedRoute>
                <CustomerDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm/customers/:customerId/profile"
            element={
              <ProtectedRoute>
                <CustomerProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm/quotes/new"
            element={
              <ProtectedRoute>
                <CreateQuotePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm/dashboard"
            element={
              <ProtectedRoute>
                <CRMDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm/reports"
            element={
              <ProtectedRoute>
                <CRMReportsPage />
              </ProtectedRoute>
            }
          />

          {/* PMS routes */}
          <Route
            path="/pms"
            element={
              <ProtectedRoute>
                <PMSHomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pms/chemicals"
            element={
              <ProtectedRoute>
                <ChemicalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pms/tds"
            element={
              <ProtectedRoute>
                <TDSPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pms/partners"
            element={
              <ProtectedRoute>
                <PartnersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pms/partner-chemicals"
            element={
              <ProtectedRoute>
                <PartnerChemicalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pms/pricing"
            element={
              <ProtectedRoute>
                <PricingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pms/products"
            element={
              <ProtectedRoute>
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pms/market"
            element={
              <ProtectedRoute>
                <MarketPage />
              </ProtectedRoute>
            }
          />

          {/* Sales Pipeline routes */}
          <Route
            path="/sales/pipeline"
            element={
              <ProtectedRoute>
                <SalesPipelinePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales/pipeline/:pipelineId/edit"
            element={
              <ProtectedRoute>
                <SalesPipelinePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales/pipeline/:pipelineId"
            element={
              <ProtectedRoute>
                <PipelineDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Stock Management routes */}
          <Route
            path="/stock"
            element={
              <ProtectedRoute>
                <StockAvailabilityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock/general-availability"
            element={
              <ProtectedRoute>
                <GeneralStockAvailabilityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock/products/:productId"
            element={
              <ProtectedRoute>
                <ProductDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock/product-label"
            element={
              <ProtectedRoute>
                <ProductLabelStockPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}


