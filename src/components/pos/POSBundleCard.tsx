import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

export interface BundleData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  components: Array<{ product_id: string; qty: number; product_name?: string }>;
  image_url: string | null;
}

interface Props {
  bundle: BundleData;
  onAdd: (b: BundleData) => void;
}

export const POSBundleCard = ({ bundle, onAdd }: Props) => {
  return (
    <Card
      className="p-2 cursor-pointer hover:border-primary transition relative overflow-hidden"
      onClick={() => onAdd(bundle)}
    >
      <Badge className="absolute top-1 right-1 text-[10px] z-10" variant="default">
        BUNDLE
      </Badge>
      {bundle.image_url ? (
        <div className="aspect-square w-full bg-muted rounded overflow-hidden mb-2">
          <img src={bundle.image_url} alt={bundle.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="aspect-square w-full bg-gradient-to-br from-primary/20 to-primary/5 rounded mb-2 flex items-center justify-center">
          <Package className="h-8 w-8 text-primary/60" />
        </div>
      )}
      <div className="text-xs font-medium line-clamp-2 leading-tight">{bundle.name}</div>
      <div className="text-[10px] text-muted-foreground line-clamp-1">
        {bundle.components.length} item paket
      </div>
      <div className="text-sm font-bold text-primary mt-1">
        Rp{Number(bundle.price).toLocaleString('id-ID')}
      </div>
    </Card>
  );
};
