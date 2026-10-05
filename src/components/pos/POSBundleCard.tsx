import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Plus } from 'lucide-react';

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
      className="pos-product-card group p-3 cursor-pointer rounded-2xl relative overflow-hidden"
      onClick={() => onAdd(bundle)}
    >
      <Badge className="absolute top-1 right-1 text-[10px] z-10" variant="default">
        BUNDLE
      </Badge>
      {bundle.image_url ? (
        <div className="aspect-[4/3] w-full bg-muted rounded-xl overflow-hidden mb-3">
          <img src={bundle.image_url} alt={bundle.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        </div>
      ) : (
        <div className="aspect-[4/3] w-full bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl mb-3 flex items-center justify-center">
          <Package className="h-8 w-8 text-primary/60" />
        </div>
      )}
      <div className="text-sm font-bold line-clamp-2 leading-snug min-h-10">{bundle.name}</div>
      <div className="text-[10px] text-muted-foreground line-clamp-1">
        {bundle.components.length} item paket
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="pos-number text-sm font-bold text-primary">Rp{Number(bundle.price).toLocaleString('id-ID')}</div>
        <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 flex items-center justify-center"><Plus className="h-4 w-4" /></div>
      </div>
    </Card>
  );
};
