import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PermissionProvider } from "@/hooks/usePermissions";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

const container = document.getElementById("root");
if (!container) throw new Error("Root container not found");

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PermissionProvider>
          <App />
          <Toaster />
        </PermissionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);