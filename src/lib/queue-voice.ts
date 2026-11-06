/** Friendly female Indonesian voice for calling queue numbers on the TV screen. */
const FEMALE_HINTS = ['female', 'wanita', 'perempuan', 'gadis', 'damayanti', 'google bahasa indonesia', 'ardi'.replace('ardi', 'gita'), 'siti', 'natural'];
const MALE_HINTS = ['male', 'ardi', 'pria'];

let cached: SpeechSynthesisVoice | null = null;

export const pickFemaleVoice = (): SpeechSynthesisVoice | null => {
  if (cached) return cached;
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const id = voices.filter((v) => v.lang?.toLowerCase().startsWith('id'));
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (FEMALE_HINTS.some((h) => n.includes(h))) s += 3;
    if (MALE_HINTS.some((h) => n.includes(h)) && !n.includes('female')) s -= 5;
    if (n.includes('online') || n.includes('natural') || n.includes('neural')) s += 2;
    if (!v.localService) s += 1;
    return s;
  };
  cached = id.sort((a, b) => score(b) - score(a))[0] || null;
  return cached;
};

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => { cached = null; pickFemaleVoice(); };
}

/** "Antrian nomor 01, atas nama kak Cintia" — natural number, title-cased name. */
export const queueAnnouncement = (queueNo: number | null, name?: string | null, table?: string | null) => {
  const no = queueNo ? String(queueNo).padStart(2, '0') : table ? `meja ${table}` : '';
  const nm = name?.trim() ? name.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : '';
  return `Antrian nomor ${no}${nm ? `, atas nama kak ${nm}` : ''}. Pesanannya sudah siap ya, silakan diambil. Terima kasih!`;
};

export const speakFriendly = (text: string) => {
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    // Short phrases with small pauses sound less robotic than one long sentence.
    text.split(/(?<=[.,!])\s+/).forEach((part) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = 'id-ID';
      const v = pickFemaleVoice();
      if (v) u.voice = v;
      u.rate = 1.0;
      u.pitch = 1.2;
      u.volume = 1;
      synth.speak(u);
    });
  } catch { /* speech not supported */ }
};
