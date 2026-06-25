import { Navigate, Route, Routes } from "react-router-dom";
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
import { ReportsHomePage } from "./pages/reports/ReportsHomePage";
import { CRMReportsPage } from "./pages/reports/CRMReportsPage";
import { AnalyticsDashboardPage } from "./pages/reports/AnalyticsDashboardPage";
import { PMSHomePage } from "./pages/pms/PMSHomePage";
import { ChemicalsPage } from "./pages/pms/ChemicalsPage";
import { TDSPage } from "./pages/pms/TDSPage";
import { PartnersPage } from "./pages/pms/PartnersPage";
import { PartnerChemicalsPage } from "./pages/pms/PartnerChemicalsPage";
import { PricingPage } from "./pages/pms/PricingPage";
import { ProductsPage } from "./pages/pms/ProductsPage";
import { MarketPage } from "./pages/pms/MarketPage";
import { ImportFinancePage } from "./pages/finance/ImportFinancePage";
import { TradeParametersWorkspacePage } from "./pages/finance/TradeParametersWorkspacePage";
import { ProductCostingWorkspacePage } from "./pages/finance/ProductCostingWorkspacePage";
import { TransitSummaryWorkspacePage } from "./pages/finance/TransitSummaryWorkspacePage";
import { NewPipelineWorkspacePage } from "./pages/finance/NewPipelineWorkspacePage";
import { ExecutiveReportWorkspacePage } from "./pages/finance/ExecutiveReportWorkspacePage";
import { SalesPipelinePage } from "./pages/sales/SalesPipelinePage";
import { PipelineDetailPage } from "./pages/sales/PipelineDetailPage";
import { StockHomePage } from "./pages/stock/StockHomePage";
import { AppShell } from "./components/AppShell";
import { GeneralStockAvailabilityPage } from "./pages/stock/GeneralStockAvailabilityPage";
import { ProductDetailPage } from "./pages/stock/ProductDetailPage";
import { ProductLabelStockPage } from "./pages/stock/ProductLabelStockPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <div className="app-root">
      <AppShell />

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
          <Route path="/crm/reports" element={<Navigate to="/reports/crm" replace />} />

          {/* Reports & Analysis routes */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsHomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/crm"
            element={
              <ProtectedRoute>
                <CRMReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/executive"
            element={
              <ProtectedRoute>
                <ExecutiveReportWorkspacePage />
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

          {/* Import Finance / Trade & Transit */}
          <Route
            path="/finance/import"
            element={
              <ProtectedRoute>
                <ImportFinancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/new-pipeline"
            element={
              <ProtectedRoute>
                <NewPipelineWorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/trade-parameters"
            element={
              <ProtectedRoute>
                <TradeParametersWorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/product-costing"
            element={
              <ProtectedRoute>
                <ProductCostingWorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/transit-summary"
            element={
              <ProtectedRoute>
                <TransitSummaryWorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance/executive-report"
            element={
              <ProtectedRoute>
                <ExecutiveReportWorkspacePage />
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
                <StockHomePage />
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


