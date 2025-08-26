import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import { RoleBasedRoute } from "@/components/auth/RoleBasedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import POS from "./pages/POS";
import MobileSeller from "./pages/MobileSeller";
import CustomerApp from "./pages/CustomerApp";
import NotFound from "./pages/NotFound";
import ProfitLoss from "./pages/finance/ProfitLoss";
import CashFlow from "./pages/finance/CashFlow";
import BalanceSheet from "./pages/finance/BalanceSheet";
import OperationalExpenses from "./pages/finance/OperationalExpenses";
import Transactions from "./pages/Transactions";
import Branches from "./pages/Branches";
import Riders from "./pages/Riders";
import Inventory from "./pages/Inventory";
import AdminUsers from "./pages/AdminUsers";
import StockTransfer from "./pages/StockTransfer";
import CustomerManager from "./pages/CustomerManager";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/mobile-seller" element={
              <RoleBasedRoute allowedRoles={['rider']}>
                <MobileSeller />
              </RoleBasedRoute>
            } />
            <Route path="/customer-app" element={
              <RoleBasedRoute allowedRoles={['customer']}>
                <CustomerApp />
              </RoleBasedRoute>
            } />
            <Route path="/" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <Layout>
                  <Index />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/pos" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <Layout>
                  <POS />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/finance/profit-loss" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <Layout>
                  <ProfitLoss />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/finance/cash-flow" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <Layout>
                  <CashFlow />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/finance/balance-sheet" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <Layout>
                  <BalanceSheet />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/finance/operational-expenses" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <Layout>
                  <OperationalExpenses />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/reports/transactions" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <Layout>
                  <Transactions />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/branches" element={
              <RoleBasedRoute allowedRoles={['ho_admin']}>
                <Layout>
                  <Branches />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/riders" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <Layout>
                  <Riders />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/inventory" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <Layout>
                  <Inventory />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/stock-transfer" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <Layout>
                  {/* Stock transfer between branch and rider */}
                  <StockTransfer />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/admin/users" element={
              <RoleBasedRoute allowedRoles={['ho_admin']}>
                <Layout>
                  <AdminUsers />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/customers" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <Layout>
                  <CustomerManager />
                </Layout>
              </RoleBasedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
