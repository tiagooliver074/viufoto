/**
 * marketing-consultant
 * Chat com IA consultora especializada em marketing para fotógrafos.
 * Recebe messages[] (histórico) e retorna resposta em streaming (SSE).
 * Usa dados reais do fotógrafo autenticado como contexto.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "missing_lovable_api_key" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: u, error: uErr } = await userClient.auth.getUser();
  if (uErr || !u.user) return json({ error: "unauthorized" }, 401);
  const userId = u.user.id;

  const { messages = [] } = await req.json().catch(() => ({}));
  const lastUser = [...messages].reverse().find((m: any) => m.role === "user");

  const supabase = createClient(supabaseUrl, serviceKey);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();

  const { data: events } = await supabase.from("events").select("id, name, category, event_date").eq("organizer_id", userId);
  const eventIds = (events || []).map((e: any) => e.id);
  let totals = { visitors: 0, orders: 0, revenue: 0, searches: 0 };
  if (eventIds.length) {
    const [lv, ord, sr] = await Promise.all([
      supabase.from("marketing_events_log").select("id", { count: "exact", head: true }).in("event_id", eventIds).gte("created_at", since).eq("event_name", "PageView"),
      supabase.from("orders").select("amount").in("event_id", eventIds).in("status", ["pago", "enviado"]).gte("created_at", since),
      supabase.from("face_search_logs").select("id", { count: "exact", head: true }).in("event_id", eventIds).gte("created_at", since),
    ]);
    totals.visitors = lv.count || 0;
    totals.searches = sr.count || 0;
    totals.orders = (ord.data || []).length;
    totals.revenue = (ord.data || []).reduce((s, o: any) => s + Number(o.amount || 0), 0);
  }

  const contextBlock = `DADOS REAIS DO FOTÓGRAFO (últimos 30 dias):
- Eventos ativos: ${eventIds.length}
- Visitantes: ${totals.visitors}
- Buscas faciais: ${totals.searches}
- Pedidos pagos: ${totals.orders}
- Receita: R$ ${totals.revenue.toFixed(2)}
- Ticket médio: R$ ${totals.orders ? (totals.revenue / totals.orders).toFixed(2) : "0.00"}
- Taxa de conversão: ${totals.visitors ? ((totals.orders / totals.visitors) * 100).toFixed(2) : "0.00"}%`;

  const system = `Você é uma consultora sênior de marketing digital para fotógrafos esportivos brasileiros na plataforma ViuFoto. Responda em PT-BR, seja objetiva, cite números reais e ofereça 2-3 ações práticas. NUNCA invente dados. Se os dados forem insuficientes, diga isso e sugira o que rastrear. Formate em markdown com listas curtas.

${contextBlock}`;

  // Persist user message
  if (lastUser?.content) {
    await supabase.from("marketing_consultant_messages").insert({ user_id: userId, role: "user", content: lastUser.content });
  }

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
  if (aiRes.status === 402) return json({ error: "credits_exhausted" }, 402);
  if (!aiRes.ok || !aiRes.body) {
    const t = await aiRes.text();
    console.error("ai_gateway_error", aiRes.status, t);
    return json({ error: "ai_gateway_error" }, 502);
  }

  // Stream through, collecting full text to persist at end
  let full = "";
  const stream = new ReadableStream({
    async start(controller) {
      const reader = aiRes.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n");
          buf = parts.pop() || "";
          for (const line of parts) {
            controller.enqueue(new TextEncoder().encode(line + "\n"));
            const s = line.trim();
            if (s.startsWith("data: ")) {
              const payload = s.slice(6);
              if (payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                const delta = j?.choices?.[0]?.delta?.content;
                if (delta) full += delta;
              } catch { /* ignore */ }
            }
          }
        }
        if (buf) controller.enqueue(new TextEncoder().encode(buf));
      } finally {
        controller.close();
        if (full) {
          await supabase.from("marketing_consultant_messages").insert({ user_id: userId, role: "assistant", content: full });
        }
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
});
