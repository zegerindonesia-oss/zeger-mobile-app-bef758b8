import { ChevronLeft, MessageCircle, HelpCircle } from 'lucide-react';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface Props { onBack: () => void; }

export function CustomerCare({ onBack }: Props) {
  const cfg = useCustomerAppConfig();
  const wa = (cfg.care.whatsapp_number || '').replace(/\D/g, '');
  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="bg-[#EA2831] text-white p-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10"><ChevronLeft className="h-6 w-6" /></button>
        <h1 className="text-xl font-bold">Zeger Care</h1>
      </div>
      <div className="p-4 space-y-4">
        <button
          onClick={() => { if (wa) window.open(`https://wa.me/${wa}`, '_blank'); }}
          className="w-full bg-green-500 hover:bg-green-600 active:scale-[0.99] transition text-white rounded-2xl p-4 flex items-center gap-3 shadow-lg"
        >
          <MessageCircle className="h-6 w-6" />
          <div className="text-left">
            <p className="font-bold">Chat via WhatsApp</p>
            <p className="text-xs opacity-90">+{wa || '-'}</p>
          </div>
        </button>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="h-5 w-5 text-[#EA2831]" />
            <h2 className="text-lg font-bold text-gray-900">FAQ</h2>
          </div>
          {cfg.care.faq_items.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada FAQ.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {cfg.care.faq_items.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-gray-700">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
}