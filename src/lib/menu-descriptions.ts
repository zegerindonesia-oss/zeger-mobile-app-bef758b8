// Fallback menu descriptions used when a product has no description in Data Master.
const RULES: [RegExp, string][] = [
  [/peach.*americano|americano.*peach/i, 'Espresso dipadu sirup peach segar, air mineral dan es — ringan, fruity, menyegarkan.'],
  [/americano/i, 'Double shot espresso dengan air mineral dan es batu. Rasa kopi bold, tanpa susu, tanpa gula.'],
  [/aren/i, 'Espresso, susu segar dan gula aren asli — manis legit khas Nusantara.'],
  [/kopi susu|sahabat/i, 'Es kopi susu signature: espresso, susu segar dan gula aren, creamy dan pas manisnya.'],
  [/baileys|bailey/i, 'Espresso, susu creamy dan sirup rasa Baileys (non-alkohol) — lembut dan wangi.'],
  [/butterscotch|butterschoot/i, 'Espresso, susu creamy dan saus butterscotch — manis karamel mentega.'],
  [/caramel mocha/i, 'Espresso, cokelat dan karamel berpadu susu segar — manis, cokelaty, creamy.'],
  [/caramel/i, 'Espresso, susu segar dan saus karamel — manis lembut dengan aroma kopi.'],
  [/dolce/i, 'Espresso dengan susu kental manis dan susu segar — manis creamy ala dolce de leche.'],
  [/classic latte|^latte|caffe latte/i, 'Espresso dengan susu segar yang lembut. Seimbang, creamy, cocok untuk setiap hari.'],
  [/cappuccino/i, 'Espresso, susu dan foam tebal — kopi terasa, tekstur lembut.'],
  [/mocha/i, 'Espresso, cokelat premium dan susu segar.'],
  [/matcha/i, 'Matcha Jepang dengan susu segar dan es — earthy, creamy, sedikit manis.'],
  [/choco|cokelat|coklat/i, 'Cokelat premium dan malt dengan susu segar — manis, rich, tanpa kopi.'],
  [/cookies/i, 'Susu creamy dengan remahan cookies cokelat — manis dan renyah, tanpa kopi.'],
  [/lychee|leci/i, 'Teh dengan sirup leci dan buah leci, disajikan dingin — segar dan wangi.'],
  [/lemon/i, 'Perasan lemon, sirup gula, air mineral dan es — asam segar pelepas dahaga.'],
  [/tea|teh/i, 'Teh seduh segar disajikan dengan es — ringan dan menyegarkan.'],
  [/espresso/i, 'Shot espresso murni dari biji kopi pilihan — pekat dan aromatik.'],
];

export function describeMenu(name: string, description?: string | null): string {
  if (description && description.trim()) return description;
  const hit = RULES.find(([re]) => re.test(name));
  return hit ? hit[1] : 'Racikan khas Zeger, dibuat segar setiap hari dari bahan pilihan.';
}
