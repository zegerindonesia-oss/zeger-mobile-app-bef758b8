import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, Package, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StockMovement {
  id: string;
  product_id: string;
  quantity: number;
  reference_id: string;
  created_at: string;
  rider_id: string;
  branch_id: string;
  status: string;
  products: {
    name: string;
    category: string;
  };
  profiles: {
    full_name: string;
  };
  branches: {
    name: string;
  };
}

interface GroupedStockReturn {
  reference_id: string;
  transaction_title: string;
  date: string;
  time: string;
  rider_name: string;
  branch_name: string;
  total_items: number;
  items: StockMovement[];
  selected_items: string[];
}

interface MobileStockConfirmationGroupedProps {
  userProfileId: string;
  branchId: string;
}

export const MobileStockConfirmationGrouped = ({ userProfileId, branchId }: MobileStockConfirmationGroupedProps) => {
  const [groupedReturns, setGroupedReturns] = useState<GroupedStockReturn[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchPendingReturns();
  }, [branchId]);

  const fetchPendingReturns = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          id,
          product_id,
          quantity,
          reference_id,
          created_at,
          rider_id,
          branch_id,
          status,
          products!inner(name, category),
          profiles!stock_movements_rider_id_fkey(full_name),
          branches!stock_movements_branch_id_fkey(name)
        `)
        .eq('movement_type', 'return')
        .eq('branch_id', branchId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by reference_id
      const grouped: Record<string, GroupedStockReturn> = {};

      data?.forEach((movement) => {
        const refId = movement.reference_id || movement.id;
        const date = new Date(movement.created_at).toLocaleDateString('id-ID');
        const time = new Date(movement.created_at).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        });

        if (!grouped[refId]) {
          grouped[refId] = {
            reference_id: refId,
            transaction_title: `Pengembalian Stok - ${movement.profiles?.full_name} → ${movement.branches?.name}`,
            date,
            time,
            rider_name: movement.profiles?.full_name || 'Unknown Rider',
            branch_name: movement.branches?.name || 'Unknown Branch',
            total_items: 0,
            items: [],
            selected_items: []
          };
        }

        grouped[refId].items.push(movement);
        grouped[refId].total_items += movement.quantity;
      });

      setGroupedReturns(Object.values(grouped));
    } catch (error: any) {
      console.error('Error fetching pending returns:', error);
      toast.error('Gagal memuat data pengembalian stok');
    }
  };

  const toggleGroup = (refId: string) => {
    setExpandedGroups(prev => 
      prev.includes(refId) 
        ? prev.filter(id => id !== refId)
        : [...prev, refId]
    );
  };

  const toggleItemSelection = (refId: string, itemId: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [refId]: prev[refId]?.includes(itemId) 
        ? prev[refId].filter(id => id !== itemId)
        : [...(prev[refId] || []), itemId]
    }));
  };

  const toggleAllItems = (refId: string, items: StockMovement[]) => {
    const allItemIds = items.map(item => item.id);
    const currentSelected = selectedItems[refId] || [];
    
    if (currentSelected.length === allItemIds.length) {
      // Unselect all
      setSelectedItems(prev => ({ ...prev, [refId]: [] }));
    } else {
      // Select all
      setSelectedItems(prev => ({ ...prev, [refId]: allItemIds }));
    }
  };

  const confirmSelectedItems = async (refId: string) => {
    const selected = selectedItems[refId] || [];
    if (selected.length === 0) {
      toast.error('Pilih minimal 1 item untuk dikonfirmasi');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('stock_movements')
        .update({ 
          status: 'received',
          actual_delivery_date: new Date().toISOString(),
          notes: 'Stok pengembalian diterima dan dikonfirmasi'
        })
        .in('id', selected);

      if (error) throw error;

      // Update branch inventory for received items
      const group = groupedReturns.find(g => g.reference_id === refId);
      if (group) {
        for (const itemId of selected) {
          const item = group.items.find(i => i.id === itemId);
          if (item) {
            await updateBranchInventory(item.product_id, item.quantity);
          }
        }
      }

      toast.success(`${selected.length} item berhasil dikonfirmasi diterima!`);
      
      // Clear selections and refresh data
      setSelectedItems(prev => ({ ...prev, [refId]: [] }));
      await fetchPendingReturns();
    } catch (error: any) {
      console.error('Error confirming returns:', error);
      toast.error('Gagal konfirmasi penerimaan stok');
    } finally {
      setLoading(false);
    }
  };

  const updateBranchInventory = async (productId: string, quantity: number) => {
    try {
      // Get existing branch inventory
      const { data: existingInventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', branchId)
        .eq('product_id', productId)
        .is('rider_id', null)
        .maybeSingle();

      if (existingInventory) {
        // Update existing inventory
        await supabase
          .from('inventory')
          .update({ 
            stock_quantity: existingInventory.stock_quantity + quantity,
            last_updated: new Date().toISOString()
          })
          .eq('id', existingInventory.id);
      } else {
        // Create new inventory record
        await supabase
          .from('inventory')
          .insert([{
            branch_id: branchId,
            product_id: productId,
            stock_quantity: quantity,
            rider_id: null
          }]);
      }
    } catch (error: any) {
      console.error('Error updating branch inventory:', error);
    }
  };

  if (groupedReturns.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Tidak ada pengembalian stok yang perlu dikonfirmasi</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Konfirmasi Pengembalian Stok
          </CardTitle>
        </CardHeader>
      </Card>

      {groupedReturns.map((group) => (
        <Card key={group.reference_id} className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {group.transaction_title}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleGroup(group.reference_id)}
                  className="h-8 px-2"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${
                    expandedGroups.includes(group.reference_id) ? 'rotate-180' : ''
                  }`} />
                </Button>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>{group.date} {group.time}</p>
                <p>Total: {group.total_items} item • {group.items.length} produk</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={(selectedItems[group.reference_id]?.length || 0) === group.items.length}
                    onCheckedChange={() => toggleAllItems(group.reference_id, group.items)}
                    className="border-orange-300"
                  />
                  <span className="text-sm font-medium">
                    Pilih Semua ({selectedItems[group.reference_id]?.length || 0}/{group.items.length})
                  </span>
                </div>
                
                {(selectedItems[group.reference_id]?.length || 0) > 0 && (
                  <Button 
                    size="sm"
                    onClick={() => confirmSelectedItems(group.reference_id)}
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Konfirmasi ({selectedItems[group.reference_id]?.length})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <Collapsible open={expandedGroups.includes(group.reference_id)}>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedItems[group.reference_id]?.includes(item.id) || false}
                          onCheckedChange={() => toggleItemSelection(group.reference_id, item.id)}
                          className="border-orange-300"
                        />
                        <div>
                          <p className="font-medium text-sm">{item.products.name}</p>
                          <p className="text-xs text-muted-foreground">{item.products.category}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-semibold text-orange-600">{item.quantity} unit</p>
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {(selectedItems[group.reference_id]?.length || 0) === 0 && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertCircle className="h-4 w-4" />
                      <p className="text-sm">Centang item yang ingin dikonfirmasi penerimaannya</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
};