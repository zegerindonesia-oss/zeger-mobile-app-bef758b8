import { ChevronLeft, MessageCircle, HelpCircle, Phone, Clock } from 'lucide-react';
import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cxArt } from '@/lib/customer-art';

interface Props { onBack: () => void; }

const formatPhone = (digits: string) => {
  if (!digits) return '-';
  const local = digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
  return local.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
};

export function CustomerCare({ onBack }: Props) {
  const cfg = useCustomerAppConfig();
  const wa = (cfg.care.whatsapp_number || '').replace(/\D/g, '');

  return (
    <div className="cx-app min-h-screen pb-28">
      <header className="cx-bar sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="cx-icon-btn h-10 w-10" aria-label="Kembali">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Zeger Care</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        <div className="cx-card cx-sheen rounded-3xl overflow-hidden cx-rise">
          <div className="cx-stage px-5 py-6 flex items-center gap-4">
            <img src={cxArt.cupIced} alt="" className="cx-art cx-float h-20 w-20 object-contain shrink-0" />
            <div>
              <h2 className="text-lg font-bold leading-tight">Ada kendala?</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Tim Zeger siap bantu pesanan, poin, dan langgananmu.
              </p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <button
              onClick={() => { if (wa) window.open(`https://wa.me/${wa}`, '_blank'); }}
              disabled={!wa}
              className="cx-btn cx-btn-primary w-full px-5 py-4 flex items-center gap-3 text-left"
            >
              <MessageCircle className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold">Chat WhatsApp</p>
                <p className="text-[11px] opacity-90">{formatPhone(wa)}</p>
              </div>
            </button>
            <a
              href={wa ? `tel:+${wa}` : undefined}
              className="cx-btn cx-btn-ghost w-full px-5 py-3.5 flex items-center gap-3"
            >
              <Phone className="h-4 w-4 shrink-0" />
              <span className="text-sm">Telepon Customer Care</span>
            </a>
            <div className="flex items-center gap-2 rounded-2xl bg-zeger-cream px-4 py-2.5">
              <Clock className="h-3.5 w-3.5 text-zeger-dark shrink-0" />
              <p className="text-[11px] font-medium text-zeger-dark">Setiap hari, 08.00 – 22.00 WIB</p>
            </div>
          </div>
        </div>

        <div className="cx-card rounded-3xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="h-[18px] w-[18px] text-zeger" />
            <h2 className="text-base font-bold">Pertanyaan Umum</h2>
          </div>
          {cfg.care.faq_items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Belum ada FAQ. Hubungi kami lewat WhatsApp ya.
            </p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {cfg.care.faq_items.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-[hsl(var(--cx-line))]">
                  <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomerCare;
