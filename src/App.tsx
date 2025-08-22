import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { AuthProvider } from "@/hooks/useAuth";
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
            <Route path="/mobile-seller" element={<MobileSeller />} />
            <Route path="/customer-app" element={<CustomerApp />} />
            <Route path="/" element={
              <Layout>
                <Index />
              </Layout>
            } />
            <Route path="/pos" element={
              <Layout>
                <POS />
              </Layout>
            } />
            <Route path="/finance/profit-loss" element={
              <Layout>
                <ProfitLoss />
              </Layout>
            } />
            <Route path="/finance/cash-flow" element={
              <Layout>
                <CashFlow />
              </Layout>
            } />
            <Route path="/finance/balance-sheet" element={
              <Layout>
                <BalanceSheet />
              </Layout>
            } />
            <Route path="/finance/operational-expenses" element={
              <Layout>
                <OperationalExpenses />
              </Layout>
            } />
            <Route path="/reports/transactions" element={
              <Layout>
                <Transactions />
              </Layout>
            } />
            <Route path="/branches" element={
              <Layout>
                <Branches />
              </Layout>
            } />
            <Route path="/riders" element={
              <Layout>
                <Riders />
              </Layout>
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
