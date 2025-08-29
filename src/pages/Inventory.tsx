import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventoryStatus } from "@/components/inventory/InventoryStatus";
import { StockTransfer } from "@/components/stock/StockTransfer";
import { Production } from "@/components/inventory/Production";
import { useAuth } from "@/hooks/useAuth";

export default function Inventory() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("stock");
  useEffect(() => {
    document.title = 'Inventori | Zeger ERP';
  }, []);

  if (!userProfile) return null;

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Inventori</h1>
        <p className="text-sm text-muted-foreground">Pantau stok per cabang / rider.</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="stock">Stock Management</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="transfer">Kirim Stok ke Rider</TabsTrigger>
          <TabsTrigger value="branch-transfer">Kirim Stock ke Small Branch</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle>Status Stok</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryStatus role="ho" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production">
          <Production userProfile={userProfile} />
        </TabsContent>

        <TabsContent value="transfer">
          <StockTransfer 
            role={userProfile.role}
            userId={userProfile.id}
            branchId={userProfile.branch_id}
          />
        </TabsContent>

        <TabsContent value="branch-transfer">
          <Card>
            <CardHeader>
              <CardTitle>Transfer ke Small Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Fitur transfer stok ke cabang kecil akan segera tersedia.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
