/**
 * marketing-insights
 * Gera insights estratégicos de marketing (PT-BR) para o fotógrafo autenticado
 * a partir de dados agregados (eventos, pedidos, buscas, tracking).
 * Faz cache em public.marketing_insights_cache por assinatura de dados.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  const supabase = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;
  const days = 30;
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  // Facts
  const { data: events } = await supabase
    .from("events")
    .select("id, name, category, location, event_date, status, created_at")
    .eq("organizer_id", userId);
  const eventIds = (events || []).map((e: any) => e.id);

  let visitors = 0, searches = 0, revenue = 0, ordersCount = 0, photosSold = 0;
  const perEvent: Record<string, any> = {};

  if (eventIds.length) {
    const [logsRes, searchRes, ordersRes, itemsRes] = await Promise.all([
      supabase.from("marketing_events_log").select("event_id").in("event_id", eventIds).gte("created_at", since).eq("event_name", "PageView"),
      supabase.from("face_search_logs").select("event_id").in("event_id", eventIds).gte("created_at", since),
      supabase.from("orders").select("id, amount, event_id, created_at").in("event_id", eventIds).in("status", ["pago", "enviado"]).gte("created_at", since),
      supabase.from("order_items").select("id, event_photos!inner(event_id)").in("event_photos.event_id", eventIds),
    ]);

    for (const e of events!) perEvent[e.id] = { name: e.name, category: e.category, visitors: 0, searches: 0, orders: 0, revenue: 0 };
    for (const l of logsRes.data || []) { visitors++; if (perEvent[(l as any).event_id]) perEvent[(l as any).event_id].visitors++; }
    for (const s of searchRes.data || []) { searches++; if (perEvent[(s as any).event_id]) perEvent[(s as any).event_id].searches++; }
    for (const o of ordersRes.data || []) {
      ordersCount++;
      revenue += Number((o as any).amount || 0);
      const eid = (o as any).event_id;
      if (perEvent[eid]) { perEvent[eid].orders++; perEvent[eid].revenue += Number((o as any).amount || 0); }
    }
    photosSold = (itemsRes.data || []).length;
  }

  const conversion = visitors > 0 ? (ordersCount / visitors) * 100 : 0;
  const avgTicket = ordersCount ? revenue / ordersCount : 0;

  const facts = {
    period_days: days,
    totals: { visitors, searches, orders: ordersCount, photos_sold: photosSold, revenue: Number(revenue.toFixed(2)), conversion_pct: Number(conversion.toFixed(2)), avg_ticket: Number(avgTicket.toFixed(2)) },
    events_count: eventIds.length,
    per_event: Object.values(perEvent).slice(0, 20),
  };

  const signature = await sha256(JSON.stringify(facts));

  // Cache
  if (!force) {
    const { data: cached } = await supabase
      .from("marketing_insights_cache")
      .select("insights, generated_at, expires_at, signature")
      .eq("user_id", userId)
      .eq("signature", signature)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached) return json({ insights: cached.insights, cached: true, generated_at: cached.generated_at });
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "missing_lovable_api_key" }, 500);

  const system = `Você é um consultor sênior de marketing digital para fotógrafos esportivos brasileiros. Analise os dados fornecidos (últimos 30 dias) e produza insights ACIONÁVEIS em PT-BR. Seja específico, cite números, evite generalidades. Use SOMENTE os dados fornecidos, nunca invente. Se dados forem insuficientes, diga claramente. Retorne SOMENTE JSON válido no formato: {"resumo":"string curta","alertas":[{"titulo":"","descricao":"","severidade":"info|warn|critico"}],"oportunidades":[{"titulo":"","descricao":"","impacto_estimado":""}],"recomendacoes":[{"titulo":"","descricao":"","prioridade":"alta|media|baixa"}],"proximo_passo":"string com a próxima ação recomendada"}`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: "Dados:\n" + JSON.stringify(facts, null, 2) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
  if (aiRes.status === 402) return json({ error: "credits_exhausted" }, 402);
  if (!aiRes.ok) {
    const t = await aiRes.text();
    console.error("ai_gateway_error", aiRes.status, t);
    return json({ error: "ai_gateway_error" }, 502);
  }

  const aiJson = await aiRes.json();
  const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
  let insights: any;
  try { insights = JSON.parse(raw); } catch { return json({ error: "invalid_ai_response", raw }, 502); }

  await supabase.from("marketing_insights_cache").upsert({
    user_id: userId,
    signature,
    insights,
    model: "google/gemini-2.5-flash",
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  }, { onConflict: "user_id,signature" });

  return json({ insights, cached: false, generated_at: new Date().toISOString() });
});