import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ASAAS_BASE_URL = "https://api.asaas.com/v3";

// Cancela um pedido NÃO PAGO: apaga a cobrança no Asaas (para o cliente não pagar
// depois de cancelado) e marca o pedido como "cancelado". Só o organizador do
// evento (ou super_admin) pode cancelar, e nunca um pedido já pago.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const { order_id } = await req.json();
    if (!order_id) return json({ error: "order_id é obrigatório" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: order } = await admin
      .from("orders")
      .select("id, status, event_id, asaas_payment_id")
      .eq("id", order_id)
      .maybeSingle();
    if (!order) return json({ error: "Pedido não encontrado" }, 404);

    const [{ data: ev }, { data: roleRow }] = await Promise.all([
      admin.from("events").select("organizer_id").eq("id", order.event_id).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle(),
    ]);
    if (ev?.organizer_id !== user.id && !roleRow) return json({ error: "Acesso negado" }, 403);

    if (order.status === "cancelado") return json({ ok: true, already: true });
    if (order.status !== "aguardando_pagamento") {
      return json({ error: "Só é possível cancelar pedidos que ainda não foram pagos." }, 409);
    }

    if (order.asaas_payment_id) {
      const key = Deno.env.get("ASAAS_API_KEY");
      if (!key) return json({ error: "Pagamento não configurado" }, 500);
      const headers = { "Content-Type": "application/json", access_token: key };

      // Se o cliente pagou nesse meio tempo, não cancela (o status será acertado ao consultar o pagamento).
      const st = await fetch(`${ASAAS_BASE_URL}/payments/${order.asaas_payment_id}`, { headers });
      if (st.ok) {
        const p = await st.json();
        if (p.status === "RECEIVED" || p.status === "CONFIRMED" || p.status === "RECEIVED_IN_CASH") {
          return json({ error: "Este pedido acabou de ser pago e não pode ser cancelado. Atualize a página." }, 409);
        }
      }
      const del = await fetch(`${ASAAS_BASE_URL}/payments/${order.asaas_payment_id}`, { method: "DELETE", headers });
      if (!del.ok && del.status !== 404) {
        console.error("cancel-order asaas delete failed", del.status, await del.text());
        return json({ error: "Não foi possível cancelar a cobrança no Asaas. Tente novamente." }, 502);
      }
    }

    const { error } = await admin
      .from("orders")
      .update({ status: "cancelado" })
      .eq("id", order_id)
      .eq("status", "aguardando_pagamento");
    if (error) throw error;

    return json({ ok: true });
  } catch (e: any) {
    console.error("cancel-order error:", e);
    return json({ error: "Erro ao cancelar o pedido" }, 500);
  }
});
