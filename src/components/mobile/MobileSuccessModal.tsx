import { useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface MobileSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export const MobileSuccessModal = ({ 
  isOpen, 
  onClose, 
  title = "Transaksi Berhasil",
  message = "Transaksi telah berhasil diproses"
}: MobileSuccessModalProps) => {
  useEffect(() => {
    if (isOpen) {
      // Play success sound
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+H2x34yBC17zPLaizsIGGS57+OZXQ0PVKzn6qhaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0PVKzn6qlaFAg+ltryxnwtBSl7y/LbjDwIG2m98+OeZQ0P');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore audio play errors (browser restrictions)
      });

      // Auto close after 2 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-80 rounded-3xl border-none shadow-2xl bg-white p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
              <CheckCircle className="w-12 h-12 text-green-600 animate-bounce" />
            </div>
            <div className="absolute inset-0 w-20 h-20 rounded-full bg-green-200 animate-ping opacity-30"></div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-green-600">
              {title}
            </h2>
            <p className="text-gray-600">
              {message}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};