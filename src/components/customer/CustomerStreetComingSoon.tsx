import { Button } from '@/components/ui/button';
import { Truck, ArrowLeft } from 'lucide-react';

interface Props {
  onNavigate: (view: string) => void;
}

export function CustomerStreetComingSoon({ onNavigate }: Props) {
  return (
    <div className="min-h-screen bg-[#f8f6f6] flex flex-col">
      <div className="p-4 flex items-center gap-3">
        <button
          onClick={() => onNavigate('home')}
          className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center"
          aria-label="Kembali"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Zeger On The Street</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-28 h-28 rounded-full bg-[#EA2831]/10 flex items-center justify-center mb-6">
          <Truck className="h-14 w-14 text-[#EA2831]" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Segera Hadir</h2>
        <p className="text-gray-600 mb-8 max-w-xs">
          Zeger On The Street akan segera hadir di dekatmu. Sementara itu, cari rider Zeger terdekat untuk pesananmu.
        </p>
        <Button
          onClick={() => onNavigate('map')}
          className="bg-[#EA2831] hover:bg-[#c9202a] text-white rounded-full px-8 py-6 text-base font-semibold shadow-lg"
        >
          Lihat Rider Terdekat
        </Button>
      </div>
    </div>
  );
}