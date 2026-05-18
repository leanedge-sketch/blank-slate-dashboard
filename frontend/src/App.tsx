import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
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
import { useAuth } from "./contexts/AuthContext";
import { LogOut } from "lucide-react";

function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <h1 className="app-title">LeanChem Connect</h1>
        <nav className="app-nav">
          {user ? (
            <>
              <Link to="/">Home</Link>
              <Link to="/crm">CRM</Link>
              <Link to="/pms">PMS</Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
            </>
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


