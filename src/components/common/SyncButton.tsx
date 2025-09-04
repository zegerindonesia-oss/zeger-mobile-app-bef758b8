import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SyncButtonProps {
  onSyncComplete?: () => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const SyncButton = ({ 
  onSyncComplete, 
  variant = "outline", 
  size = "default",
  className = "" 
}: SyncButtonProps) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Force refresh all cached data by clearing any local storage
      if (typeof window !== 'undefined') {
        // Clear any cached data in localStorage if exists
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('supabase_') || key.startsWith('cache_')) {
            localStorage.removeItem(key);
          }
        });
      }

      // Force a fresh connection to Supabase
      await supabase.auth.getSession();
      
      // Simulate sync delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success("Data berhasil disinkronisasi!");
      
      // Trigger page refresh to get latest data
      if (onSyncComplete) {
        onSyncComplete();
      } else {
        // Force page reload if no callback provided
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error("Gagal sinkronisasi data");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={isSyncing}
      className={`${className} ${isSyncing ? 'animate-pulse' : ''}`}
    >
      <RefreshCw 
        className={`h-4 w-4 ${size !== 'icon' ? 'mr-2' : ''} ${isSyncing ? 'animate-spin' : ''}`} 
      />
      {size !== 'icon' && (isSyncing ? 'Menyinkronkan...' : 'Sinkronisasi Data')}
    </Button>
  );
};