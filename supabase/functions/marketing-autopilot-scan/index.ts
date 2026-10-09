/**
 * marketing-autopilot-scan
 * Analisa dados do fotógrafo (últimos 30 dias) e cria sugestões
 * (remarketing, cupom, campanha) em public.marketing_suggestions.
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

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: u, error: uErr } = await userClient.auth.getUser();
  if (uErr || !u.user) return json({ error: "unauthorized" }, 401);
  const userId = u.user.id;

  const supabase = createClient(supabaseUrl, serviceKey);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_date, status, created_at")
    .eq("organizer_id", userId);
  const eventIds = (events || []).map((e: any) => e.id);

  const created: any[] = [];
  const insert = async (row: any) => {
    const { data, error } = await supabase.from("marketing_suggestions").insert({ user_id: userId, ...row }).select().single();
    if (!error && data) created.push(data);
  };

  if (eventIds.length === 0) {
    await supabase.from("marketing_automation_settings").upsert({ user_id: userId, last_scan_at: new Date().toISOString() });
    return json({ created: [], reason: "no_events" });
  }

  const [logsRes, ordersRes, searchRes] = await Promise.all([
    supabase.from("marketing_events_log").select("event_id, event_name, visitor_id").in("event_id", eventIds).gte("created_at", since),
    supabase.from("orders").select("id, amount, event_id, status").in("event_id", eventIds).gte("created_at", since),
    supabase.from("face_search_logs").select("event_id, visitor_id").in("event_id", eventIds).gte("created_at", since),
  ]);

  type Stat = { visitors: Set<string>; searchers: Set<string>; adds: number; orders: number; revenue: number; name: string };
  const stats: Record<string, Stat> = {};
  for (const e of events!) stats[(e as any).id] = { visitors: new Set(), searchers: new Set(), adds: 0, orders: 0, revenue: 0, name: (e as any).name };
  for (const l of logsRes.data || []) {
    const s = stats[(l as any).event_id]; if (!s) continue;
    const vid = (l as any).visitor_id || Math.random().toString();
    if ((l as any).event_name === "PageView") s.visitors.add(vid);
    if ((l as any).event_name === "AddToCart") s.adds++;
  }
  for (const s of searchRes.data || []) {
    const st = stats[(s as any).event_id]; if (!st) continue;
    st.searchers.add((s as any).visitor_id || Math.random().toString());
  }
  for (const o of ordersRes.data || []) {
    const st = stats[(o as any).event_id]; if (!st) continue;
    if (["pago", "enviado"].includes((o as any).status)) { st.orders++; st.revenue += Number((o as any).amount || 0); }
  }

  const existing = new Set<string>();
  const { data: pending } = await supabase.from("marketing_suggestions")
    .select("kind, event_id, status").eq("user_id", userId).eq("status", "pending");
  for (const p of pending || []) existing.add(`${(p as any).kind}:${(p as any).event_id ?? ""}`);

  for (const eid of eventIds) {
    const s = stats[eid];
    const visitors = s.visitors.size;
    const searchers = s.searchers.size;
    const conv = visitors > 0 ? s.orders / visitors : 0;
    const nonBuyers = Math.max(0, visitors - s.orders);

    if (nonBuyers >= 50 && conv < 0.05 && !existing.has(`remarketing:${eid}`)) {
      await insert({
        kind: "remarketing", event_id: eid,
        title: `Remarketing: ${nonBuyers} pessoas para reengajar em ${s.name}`,
        description: `Foram ${visitors} visitantes com apenas ${s.orders} compras. Vale criar uma campanha para trazê-los de volta.`,
        payload: { visitors, orders: s.orders, non_buyers: nonBuyers, conversion_pct: Number((conv * 100).toFixed(2)) },
      });
    }

    if (searchers >= 30 && conv < 0.03 && !existing.has(`cupom:${eid}`)) {
      await insert({
        kind: "cupom", event_id: eid,
        title: `Ofereça um cupom em ${s.name}`,
        description: `${searchers} pessoas buscaram suas fotos mas quase ninguém comprou. Um cupom de 10-15% pode destravar as vendas.`,
        payload: { searchers, orders: s.orders, suggested_discount_pct: 10 },
      });
    }

    const ev = events!.find((e: any) => e.id === eid) as any;
    const ageDays = ev ? (Date.now() - new Date(ev.created_at).getTime()) / 86400_000 : 0;
    if (ageDays <= 14 && visitors < 20 && !existing.has(`campanha:${eid}`)) {
      await insert({
        kind: "campanha", event_id: eid,
        title: `Impulsione ${s.name} com uma campanha`,
        description: `Este evento tem apenas ${visitors} visitantes nos últimos ${Math.ceil(ageDays)} dias. Uma campanha de tráfego pode acelerar a descoberta.`,
        payload: { visitors, age_days: Math.ceil(ageDays), suggested_budget: 100 },
      });
    }
  }

  await supabase.from("marketing_automation_settings").upsert({ user_id: userId, last_scan_at: new Date().toISOString() });
  return json({ created });
});
