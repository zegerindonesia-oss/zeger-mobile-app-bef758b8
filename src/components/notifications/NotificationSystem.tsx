import { useState, useEffect } from "react";
import { Bell, Package, CheckCircle, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'stock' | 'shift' | 'transaction';
  createdAt: Date;
  isRead: boolean;
}

export const NotificationSystem = () => {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Load initial notifications
    loadNotifications();

    // Listen for stock transfer events
    const handleStockSent = () => {
      if (userProfile?.role === 'rider') {
        addNotification({
          title: 'Stok Dikirim',
          message: 'Branch telah berhasil kirim stok ke Anda. Silahkan konfirmasi penerimaan stok.',
          type: 'stock'
        });
      }
    };

    const handleStockReceived = () => {
      if (userProfile?.role === 'branch_manager') {
        addNotification({
          title: 'Stok Dikonfirmasi',
          message: 'Rider telah mengkonfirmasi penerimaan stok.',
          type: 'stock'
        });
      }
    };

    // Listen for real-time stock movements
    const stockMovementChannel = supabase
      .channel('stock_movements_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stock_movements',
          filter: `rider_id=eq.${userProfile?.id}`
        },
        (payload) => {
          if (userProfile?.role === 'rider') {
            addNotification({
              title: 'Stok Baru Dikirim',
              message: 'Branch telah mengirim stok baru untuk Anda. Silahkan konfirmasi penerimaan.',
              type: 'stock'
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stock_movements',
          filter: `status=eq.received`
        },
        (payload) => {
          if (userProfile?.role === 'branch_manager') {
            addNotification({
              title: 'Stok Dikonfirmasi',
              message: 'Rider telah mengkonfirmasi penerimaan stok.',
              type: 'stock'
            });
          }
        }
      )
      .subscribe();

    // Custom event listeners
    window.addEventListener('stock-sent', handleStockSent);
    window.addEventListener('stock-received', handleStockReceived);

    return () => {
      window.removeEventListener('stock-sent', handleStockSent);
      window.removeEventListener('stock-received', handleStockReceived);
      supabase.removeChannel(stockMovementChannel);
    };
  }, [userProfile]);

  const loadNotifications = () => {
    const savedNotifications = localStorage.getItem('notifications');
    if (savedNotifications) {
      const notifications = JSON.parse(savedNotifications).map((n: any) => ({
        ...n,
        createdAt: new Date(n.createdAt)
      }));
      setNotifications(notifications);
      setUnreadCount(notifications.filter((n: Notification) => !n.isRead).length);
    }
  };

  const saveNotifications = (notifications: Notification[]) => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      isRead: false
    };

    const updatedNotifications = [newNotification, ...notifications].slice(0, 50); // Keep last 50
    setNotifications(updatedNotifications);
    setUnreadCount(prev => prev + 1);
    saveNotifications(updatedNotifications);
  };

  const markAsRead = (notificationId: string) => {
    const updatedNotifications = notifications.map(n => 
      n.id === notificationId ? { ...n, isRead: true } : n
    );
    setNotifications(updatedNotifications);
    setUnreadCount(prev => Math.max(0, prev - 1));
    saveNotifications(updatedNotifications);
  };

  const markAllAsRead = () => {
    const updatedNotifications = notifications.map(n => ({ ...n, isRead: true }));
    setNotifications(updatedNotifications);
    setUnreadCount(0);
    saveNotifications(updatedNotifications);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'stock':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'shift':
        return <Clock className="h-4 w-4 text-green-500" />;
      case 'transaction':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return `${minutes} menit yang lalu`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam yang lalu`;
    
    const days = Math.floor(hours / 24);
    return `${days} hari yang lalu`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-background border border-border shadow-lg z-50">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifikasi</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-auto p-1">
              Baca Semua
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm">Belum ada notifikasi</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.slice(0, 10).map((notification) => (
              <DropdownMenuItem 
                key={notification.id}
                className={`p-3 cursor-pointer ${!notification.isRead ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start gap-3 w-full">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${!notification.isRead ? 'text-blue-900' : 'text-foreground'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};