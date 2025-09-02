import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ModernLayout } from "@/components/layout/ModernLayout";
import { AuthProvider } from "@/hooks/useAuth";
import { RoleBasedRoute } from "@/components/auth/RoleBasedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import POS from "./pages/POS";
import MobileSeller from "./pages/MobileSeller";
import CustomerApp from "./pages/CustomerApp";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import ProfitLoss from "./pages/finance/ProfitLoss";
import CashFlow from "./pages/finance/CashFlow";
import BalanceSheet from "./pages/finance/BalanceSheet";
import OperationalExpenses from "./pages/finance/OperationalExpenses";
import RiderExpenses from "./pages/finance/RiderExpenses";
import { TransactionDetails } from "./pages/TransactionDetails";
import { TransactionsEnhanced } from "./pages/TransactionsEnhanced";
import Branches from "./pages/Branches";
import Riders from "./pages/Riders";
import Inventory from "./pages/Inventory";
import AdminUsers from "./pages/AdminUsers";
import StockTransfer from "./pages/StockTransfer";
import CustomerManager from "./pages/CustomerManager";
import InventoryProductionPage from "./pages/inventory/ProductionPage";
import InventoryBranchTransfer from "./pages/inventory/BranchTransfer";

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
            <Route path="/" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <ModernLayout>
                  <AdminDashboard />
                </ModernLayout>
              </RoleBasedRoute>
            } />
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
            <Route path="/admin" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <ModernLayout>
                  <AdminDashboard />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/pos" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <Layout>
                  <POS />
                </Layout>
              </RoleBasedRoute>
            } />
            <Route path="/branches" element={
              <RoleBasedRoute allowedRoles={['ho_admin']}>
                <ModernLayout>
                  <Branches />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/riders" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <Riders />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/customers" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'rider']}>
                <ModernLayout>
                  <CustomerManager />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/finance" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <ModernLayout>
                  <ProfitLoss />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/finance/profit-loss" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <ModernLayout>
                  <ProfitLoss />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/finance/cash-flow" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <ModernLayout>
                  <CashFlow />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/finance/balance-sheet" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <ModernLayout>
                  <BalanceSheet />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/finance/operational-expenses" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <ModernLayout>
                  <OperationalExpenses />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/finance/rider-expenses" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <ModernLayout>
                  <RiderExpenses />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/transaction-details" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <ModernLayout>
                  <TransactionDetails />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/transactions" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager', 'finance']}>
                <ModernLayout>
                  <TransactionsEnhanced />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/inventory" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <Inventory />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/sales" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <TransactionsEnhanced />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/admin-users" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <AdminUsers />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/reports" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <TransactionsEnhanced />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/settings" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <AdminUsers />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/help" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <AdminUsers />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/stock-transfer" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <StockTransfer />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/inventory/production" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <InventoryProductionPage />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/inventory/branch-transfer" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <InventoryBranchTransfer />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/reports/sales" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <TransactionsEnhanced />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/reports/inventory" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <Inventory />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/reports/financial" element={
              <RoleBasedRoute allowedRoles={['ho_admin', 'branch_manager']}>
                <ModernLayout>
                  <ProfitLoss />
                </ModernLayout>
              </RoleBasedRoute>
            } />
            <Route path="/admin/users" element={
              <RoleBasedRoute allowedRoles={['ho_admin']}>
                <ModernLayout>
                  <AdminUsers />
                </ModernLayout>
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
