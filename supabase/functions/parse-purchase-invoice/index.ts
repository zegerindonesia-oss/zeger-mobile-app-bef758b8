import { createLovableAiGatewayRunIdFetch } from "../_shared/run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["invoice_number", "supplier_name", "supplier_match_id", "invoice_date", "due_date", "total", "items"],
  properties: {
    invoice_number: { type: ["string", "null"] },
    supplier_name: { type: ["string", "null"] },
    supplier_match_id: { type: ["string", "null"] },
    invoice_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    due_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    total: { type: ["number", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "material_id", "category", "quantity", "unit", "unit_price", "subtotal"],
        properties: {
          name: { type: "string" },
          material_id: { type: ["string", "null"] },
          category: { type: ["string", "null"] },
          quantity: { type: "number" },
          unit: { type: ["string", "null"] },
          unit_price: { type: "number" },
          subtotal: { type: "number" },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!req.headers.get("authorization")) return json({ error: "Harus login" }, 401);
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI belum dikonfigurasi" }, 500);

    const { image, mime, materials, suppliers } = await req.json();
    if (typeof image !== "string" || image.length < 100 || image.length > 14_000_000) return json({ error: "Foto nota tidak valid / terlalu besar" }, 400);
    const type = typeof mime === "string" ? mime : "image/jpeg";
    const mats = (Array.isArray(materials) ? materials : []).slice(0, 600).map((m: any) => `${m.id}|${m.name}|${m.unit}|${m.category ?? ""}`).join("\n");
    const sups = (Array.isArray(suppliers) ? suppliers : []).slice(0, 300).map((s: any) => `${s.id}|${s.name}`).join("\n");

    const prompt = `Kamu membaca foto nota/faktur/invoice pembelian bahan baku F&B Indonesia.
Ekstrak: nomor invoice, nama supplier/toko/PT, tanggal (YYYY-MM-DD), jatuh tempo bila ada, total, dan SEMUA baris barang (nama persis di nota, qty, satuan, harga satuan, subtotal).
Angka rupiah tanpa titik ribuan (contoh "Rp 125.000" -> 125000). Jika harga satuan tidak ada, hitung subtotal/qty.
Cocokkan tiap barang ke master bahan (toleran singkatan/merek), isi material_id dengan id persis atau null jika tidak yakin. Isi category sebagai saran kategori (mis. Dairy, Kopi, Sirup, Packaging).
Cocokkan supplier ke master supplier (supplier_match_id atau null).

MASTER BAHAN (id|nama|satuan|kategori):
${mats}

MASTER SUPPLIER (id|nama):
${sups}`;

    const content: any[] = [{ type: "input_text", text: prompt }];
    if (type === "application/pdf") content.push({ type: "input_file", filename: "nota.pdf", file_data: `data:application/pdf;base64,${image}` });
    else content.push({ type: "input_image", image_url: `data:${type};base64,${image}` });

    const gateway = createLovableAiGatewayRunIdFetch(req.headers.get("X-Lovable-AIG-Run-ID") ?? undefined);
    const upstream = await gateway.fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      signal: req.signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: [{ role: "user", content }],
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "invoice", strict: true, schema } },
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      console.error("gateway error", upstream.status, text.slice(0, 300));
      let safe = "";
      try { safe = JSON.parse(text)?.message || JSON.parse(text)?.error?.message || ""; } catch { /* */ }
      const msg = upstream.status === 402 ? "Kredit AI habis. Tambahkan kredit di Settings → Plans & credits."
        : upstream.status === 429 ? "Terlalu banyak permintaan, coba lagi sebentar." : safe || `AI error (${upstream.status})`;
      return json({ error: msg }, upstream.status);
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", out = "", streamErr = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === "response.output_text.delta") out += evt.delta ?? "";
          if (evt.type === "error" || evt.type === "response.failed") streamErr = evt.error?.message || evt.response?.error?.message || "AI gagal";
        } catch { /* ignore */ }
      }
    }
    if (streamErr) return json({ error: streamErr }, 502);
    if (!out.trim()) return json({ error: "AI tidak bisa membaca nota ini" }, 502);
    try { return json(JSON.parse(out)); } catch { return json({ error: "Format jawaban AI tidak valid" }, 502); }
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
