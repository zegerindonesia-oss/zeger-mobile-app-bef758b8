import { CashDepositHistory } from "@/components/dashboard/CashDepositHistory";

const CashDeposit = () => {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Riwayat Setoran Tunai</h1>
        <p className="text-muted-foreground mt-2">
          Monitor dan analisis setoran tunai dari rider
        </p>
      </header>
      
      <CashDepositHistory />
    </div>
  );
};

export default CashDeposit;
