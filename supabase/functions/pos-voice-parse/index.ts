import { createLovableAiGatewayRunIdFetch } from "../_shared/run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI belum dikonfigurasi" }, 500);

    const { transcript, products, modifiers } = await req.json();
    if (!transcript || typeof transcript !== "string" || transcript.length > 1000) {
      return json({ error: "Transkrip tidak valid" }, 400);
    }
    const catalog = (Array.isArray(products) ? products : [])
      .slice(0, 400)
      .map((p: any) => `${p.id}|${p.name}`)
      .join("\n");
    const modList = (Array.isArray(modifiers) ? modifiers : []).join(", ");

    const prompt = `Kamu adalah parser pesanan kasir coffee shop Indonesia.
Ubah ucapan kasir/pelanggan menjadi daftar item. Cocokkan nama produk dengan katalog (toleran salah ucap, singkatan, sinonim seperti "aren"="Kopi Susu Aren").
Pilihan modifier yang valid (gunakan teks persis): ${modList}
Jika satu produk diucapkan dengan varian berbeda (misal "dua, satu less sugar satu normal"), pecah jadi beberapa item.
Catatan bebas (misal "dipanasin", "pisah es") masukkan ke notes.
Abaikan basa-basi ("silakan kak", "pesannya apa").
Balas HANYA JSON tanpa markdown dengan format:
{"items":[{"product_id":"...","qty":1,"modifiers":["..."],"notes":""}],"unmatched":["frasa yang tidak ditemukan"]}

KATALOG (id|nama):
${catalog}

UCAPAN: "${transcript}"`;

    const gateway = createLovableAiGatewayRunIdFetch(
      req.headers.get("X-Lovable-AIG-Run-ID") ?? undefined,
    );
    const upstream = await gateway.fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      signal: req.signal,
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      const msg =
        upstream.status === 402
          ? "Kredit AI habis. Tambahkan kredit di Settings → Plans & credits."
          : upstream.status === 429
            ? "Terlalu banyak permintaan, coba lagi sebentar."
            : `AI error (${upstream.status})`;
      console.error("gateway error", upstream.status, text.slice(0, 300));
      return json({ error: msg }, upstream.status);
    }

    // Consume SSE server-side
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let out = "";
    let streamErr = "";
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
          if (evt.type === "error" || evt.type === "response.failed") {
            streamErr = evt.error?.message || evt.response?.error?.message || "AI gagal";
          }
        } catch { /* ignore */ }
      }
    }
    if (streamErr) return json({ error: streamErr }, 502);
    if (!out.trim()) return json({ error: "AI tidak memberi jawaban" }, 502);

    const match = out.match(/\{[\s\S]*\}/);
    let parsed: any = { items: [], unmatched: [] };
    try {
      parsed = JSON.parse(match ? match[0] : out);
    } catch {
      return json({ error: "Format jawaban AI tidak valid" }, 502);
    }
    return json({ items: parsed.items ?? [], unmatched: parsed.unmatched ?? [] });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
