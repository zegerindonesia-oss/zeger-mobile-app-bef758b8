import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { ZegerLogo } from '@/components/ui/zeger-logo';
import { Plus, Search, Gift } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  custom_options: any;
}

interface CustomerMenuProps {
  products: Product[];
  onAddToCart: (product: Product, customizations?: any, quantity?: number) => void;
}

export function CustomerMenu({ products, onAddToCart }: CustomerMenuProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const groupedProducts = useMemo(() => {
    return filteredProducts.reduce((acc, product) => {
      const category = product.category || 'Lainnya';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(product);
      return acc;
    }, {} as Record<string, Product[]>);
  }, [filteredProducts]);

  const categories = Object.keys(groupedProducts);

  const categoryIcons: Record<string, string> = {
    'Kopi': '☕',
    'Non-Kopi': '🥤',
    'Makanan': '🍰',
    'Snack': '🍪',
    'Lainnya': '📋'
  };

  // Mock loyalty data - in real app this would come from props
  const loyaltyData = {
    tier: 'Bronze',
    points: 150,
    nextTierPoints: 500
  };

  return (
    <div className="space-y-6 pb-20 p-4">
      <div className="text-center py-4">
        <ZegerLogo size="md" />
        <p className="text-muted-foreground mt-2">Kopi premium untuk hari yang sempurna</p>
      </div>

      {/* Loyalty Status */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <span className="font-medium">Level {loyaltyData.tier}</span>
            </div>
            <Badge variant="secondary">{loyaltyData.points} Poin</Badge>
          </div>
          <Progress 
            value={(loyaltyData.points / loyaltyData.nextTierPoints) * 100} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {loyaltyData.nextTierPoints - loyaltyData.points} poin lagi untuk level Gold
          </p>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari menu favorit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Products */}
      <ScrollArea className="h-96">
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{categoryIcons[category] || '📋'}</span>
                <h3 className="font-bold text-base text-primary">{category}</h3>
                <div className="flex-1 h-px bg-border"></div>
                <Badge variant="outline" className="text-xs">
                  {groupedProducts[category].length} item
                </Badge>
              </div>
              <div className="space-y-2">
                {groupedProducts[category].map((product) => (
                  <Card key={product.id} className="hover:shadow-md transition-all duration-300">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold">{product.name}</h4>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {product.description}
                          </p>
                          <p className="text-lg font-bold text-primary">
                            Rp {product.price.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onAddToCart(product)}
                          className="ml-4"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          
          {categories.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Tidak ada menu ditemukan</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}