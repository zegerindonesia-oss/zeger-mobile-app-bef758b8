import { transcribeAudio, GatewayError } from "npm:@lovable.dev/ai-gateway";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Transcribes a short cashier voice recording (used when the device has no built-in speech recognition, e.g. Android app). */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) return json({ error: "Rekaman kosong" }, 400);
    if (file.size > 15 * 1024 * 1024) return json({ error: "Rekaman terlalu panjang" }, 400);
    const res: any = await transcribeAudio({
      model: "openai/gpt-4o-transcribe",
      file: new File([file], "voice.webm", { type: file.type || "audio/webm" }),
      language: "id",
      prompt: "Percakapan kasir coffee shop Indonesia: pesanan menu, jumlah, less sugar, es, nomor HP.",
    });
    return json({ text: String(res?.text ?? "").trim() });
  } catch (e) {
    console.error(e);
    if (e instanceof GatewayError) {
      const s = e.httpStatus ?? 500;
      return json({ error: s === 402 ? "Kredit AI habis." : s === 429 ? "Terlalu banyak permintaan, coba lagi." : "Gagal mengenali suara" }, s);
    }
    return json({ error: "Gagal mengenali suara" }, 500);
  }
});
