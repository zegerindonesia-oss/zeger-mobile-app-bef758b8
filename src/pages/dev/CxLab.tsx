/**
 * DEV-ONLY visual harness for the customer app screens.
 * Mounted at /cx-lab when running the Vite dev server. Never shipped behaviour:
 * it only renders existing screens with mock props so layout/styling can be reviewed.
 */
import { useSearchParams } from 'react-router-dom';
import { CustomerHome } from '@/components/customer/CustomerHome';
import { CustomerMenu } from '@/components/customer/CustomerMenu';
import { CustomerProductDetail } from '@/components/customer/CustomerProductDetail';
import { CustomerVouchers } from '@/components/customer/CustomerVouchers';
import { CustomerLoyalty } from '@/components/customer/CustomerLoyalty';
import { CustomerSubscription } from '@/components/customer/CustomerSubscription';
import { CustomerCartNew } from '@/components/customer/CustomerCartNew';
import CustomerCheckout from '@/components/customer/CustomerCheckout';
import { CustomerProfile } from '@/components/customer/CustomerProfile';
import { CustomerPromoReward } from '@/components/customer/CustomerPromoReward';
import { CustomerOutletList } from '@/components/customer/CustomerOutletList';
import { CustomerOrderSuccess } from '@/components/customer/CustomerOrderSuccess';
import { CustomerStreetComingSoon } from '@/components/customer/CustomerStreetComingSoon';
import { CustomerCare } from '@/components/customer/CustomerCare';
import { CustomerReferral } from '@/components/customer/CustomerReferral';
import BottomNavigation from '@/components/customer/BottomNavigation';

const MOCK_USER = {
  id: '00000000-0000-0000-0000-0000000000aa',
  user_id: '00000000-0000-0000-0000-0000000000bb',
  name: 'Nia Kayu',
  email: 'nia@example.com',
  phone: '081331804488',
  points: 320,
  member_code: 'ZG-240815',
  address: 'Jl. Soekarno Hatta No. 12, Malang',
  created_at: new Date().toISOString(),
};

const P = (
  id: string,
  name: string,
  category: string,
  price: number,
  image_url: string | null,
  description: string,
) => ({ id, name, description, price, image_url, category, custom_options: null });

const MOCK_PRODUCTS = [
  P('p1', 'Es Kopi Susu Sahabat', 'Signature', 22000, '/__l5e/assets-v1/d97aca12-8b87-4666-9402-79b1c82f73d2/Aren_Latte.webp', 'Kopi susu gula aren khas Zeger.'),
  P('p2', 'Aren Creamy Latte', 'Coffee', 25000, '/__l5e/assets-v1/d97aca12-8b87-4666-9402-79b1c82f73d2/Aren_Latte.webp', 'Latte creamy dengan manis gula aren tradisional.'),
  P('p3', 'Classic Latte', 'Coffee', 24000, '/__l5e/assets-v1/cec3e0b0-44ca-4461-b106-c104e985c64d/Classic_Latte.webp', 'Espresso dengan susu creamy tanpa pemanis.'),
  P('p4', 'Americano', 'Coffee', 18000, '/__l5e/assets-v1/b09f31c3-a49b-47b7-a45e-a56e5d49da49/Americano.webp', 'Espresso pekat dengan air dingin.'),
  P('p5', 'Matcha Latte', 'Non Coffee', 26000, '/__l5e/assets-v1/2b008b10-7597-4746-8b2b-500782ded464/Baileys_Creamy_Latte.webp', 'Matcha premium dengan susu segar.'),
  P('p6', 'Lychee Tea', 'Tea', 20000, '/__l5e/assets-v1/ac2e5621-c35f-48d3-b071-6fb7e51ef185/Lychee_Tea.png', 'Teh segar dengan aroma leci eksotis.'),
  P('p7', 'Choco Malt', 'Non Coffee', 24000, null, 'Minuman cokelat malt yang kaya.'),
  P('p8', 'Croissant Butter', 'Snack', 18000, null, 'Croissant mentega renyah.'),
];

const MOCK_CART = [
  { ...MOCK_PRODUCTS[0], product_id: 'p1', quantity: 2, customizations: { size: 'large', ice: 'normal', sugar: 'less', toppings: ['boba'] }, unit_price: 27000 },
  { ...MOCK_PRODUCTS[5], product_id: 'p6', quantity: 1, customizations: { size: 'small' }, unit_price: 20000 },
];

const SCREENS: Record<string, () => JSX.Element> = {
  home: () => (
    <CustomerHome customerUser={MOCK_USER} onNavigate={() => {}} recentProducts={MOCK_PRODUCTS} onChooseChannel={() => {}} />
  ),
  menu: () => (
    <CustomerMenu
      products={MOCK_PRODUCTS}
      onAddToCart={() => {}}
      outletName="Zeger Soekarno Hatta"
      outletAddress="Jl. Soekarno Hatta No. 12, Malang"
      onChangeOutlet={() => {}}
      onBack={() => {}}
      orderMode="pickup"
      cartItemCount={3}
      onViewCart={() => {}}
      cart={MOCK_CART}
    />
  ),
  detail: () => (
    <CustomerProductDetail
      product={MOCK_PRODUCTS[1] as any}
      orderType="take-away"
      onBack={() => {}}
      onAddToCart={() => {}}
      cartItemCount={3}
      onViewCart={() => {}}
    />
  ),
  vouchers: () => <CustomerVouchers customerUser={MOCK_USER} />,
  loyalty: () => <CustomerLoyalty customerUser={MOCK_USER} onNavigate={() => {}} onBack={() => {}} />,
  subscription: () => <CustomerSubscription customerUser={MOCK_USER} onBack={() => {}} />,
  promo: () => <CustomerPromoReward customerUser={MOCK_USER} onNavigate={() => {}} />,
  cart: () => (
    <CustomerCartNew
      cart={MOCK_CART as any}
      outletName="Zeger Soekarno Hatta"
      outletAddress="Jl. Soekarno Hatta No. 12, Malang"
      outletDistance="1.2 km"
      orderMode="delivery"
      onOrderModeChange={() => {}}
      onUpdateQuantity={() => {}}
      onNavigate={() => {}}
      onChangeOutlet={() => {}}
      onAddMenu={() => {}}
    />
  ),
  checkout: () => (
    <CustomerCheckout
      cart={MOCK_CART as any}
      outletId="o1"
      outletName="Zeger Soekarno Hatta"
      outletAddress="Jl. Soekarno Hatta No. 12, Malang"
      outletDistance="1.2 km"
      customerUser={MOCK_USER as any}
      onConfirm={() => {}}
      onBack={() => {}}
      onChangeOutlet={() => {}}
      initialOrderType="outlet_delivery"
    />
  ),
  profile: () => <CustomerProfile customerUser={MOCK_USER} onUpdateProfile={() => {}} onNavigate={() => {}} />,
  outlets: () => <CustomerOutletList onNavigate={() => {}} onSelectOutlet={() => {}} channel="branch" orderMode="pickup" />,
  success: () => (
    <CustomerOrderSuccess
      orderId="11111111-1111-1111-1111-111111111111"
      orderNumber="ZG-204815"
      orderType="outlet_delivery"
      outletName="Zeger Soekarno Hatta"
      outletAddress="Jl. Soekarno Hatta No. 12, Malang"
      deliveryAddress="Jl. Veteran No. 8, Malang"
      estimatedTime="25 menit"
      onNavigate={() => {}}
    />
  ),
  street: () => <CustomerStreetComingSoon onBack={() => {}} />,
  care: () => <CustomerCare onBack={() => {}} />,
  referral: () => <CustomerReferral customerUser={MOCK_USER} onBack={() => {}} />,
  dock: () => (
    <div className="min-h-screen bg-[hsl(var(--cx-canvas))]">
      <BottomNavigation activeView="home" onViewChange={() => {}} cartItemCount={3} />
    </div>
  ),
};

export default function CxLab() {
  const [params] = useSearchParams();
  const key = params.get('s') || 'home';
  const Screen = SCREENS[key];

  if (!Screen) {
    return (
      <div className="cx-app min-h-screen bg-[hsl(var(--cx-canvas))] p-6">
        <h1 className="text-lg font-extrabold">CX Lab</h1>
        <ul className="mt-3 space-y-1 text-sm">
          {Object.keys(SCREENS).map((k) => (
            <li key={k}>
              <a className="text-zeger underline" href={`/cx-lab?s=${k}`}>{k}</a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="cx-app min-h-screen bg-[hsl(var(--cx-canvas))]">
      <Screen />
    </div>
  );
}
