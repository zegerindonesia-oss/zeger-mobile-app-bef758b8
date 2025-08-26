import { useEffect } from "react";
import { CustomerManagement } from "@/components/customer/CustomerManagement";

export default function CustomerManager() {
  useEffect(() => {
    document.title = 'Kelola Pelanggan | Zeger ERP';
  }, []);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Kelola Pelanggan</h1>
        <p className="text-sm text-muted-foreground">Tambah dan kelola data pelanggan Anda.</p>
      </header>

      <CustomerManagement />
    </main>
  );
}