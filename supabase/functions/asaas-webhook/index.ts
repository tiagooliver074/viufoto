import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Segurança: a Asaas assina cada chamada de webhook com o token configurado
  // no painel ("Token de autenticação"), reenviado no header asaas-access-token.
  // Sem essa checagem, qualquer um com a URL pública da função conseguiria forjar
  // um PAYMENT_RECEIVED/PAYMENT_CONFIRMED para um pedido real e creditar o
  // wallet_ledger sem pagar nada (o verify_jwt do Supabase não protege aqui, pois
  // a anon/publishable key é pública no bundle do frontend).
  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const receivedToken = req.headers.get("asaas-access-token");
  if (!expectedToken) {
    console.error("ASAAS_WEBHOOK_TOKEN not configured — rejecting webhook for safety");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (receivedToken !== expectedToken) {
    console.error("Invalid or missing asaas-access-token header");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    console.log("ASAAS Webhook received:", JSON.stringify(body));

    const { event, payment } = body;

    if (!event || !payment) {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Handle payment confirmation events
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      const asaasPaymentId = payment.id;
      const externalReference = payment.externalReference; // our order ID

      if (!externalReference) {
        console.log("No externalReference found, skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Marca o pedido como pago e "reivindica" o crédito no ledger atomicamente:
      // o filtro ledger_credited=false garante que, se a Asaas reenviar o webhook
      // (comum em caso de timeout), só a primeira chamada credita o fotógrafo/coletivo.
      const { data: claimedOrder, error } = await supabaseAdmin
        .from("orders")
        .update({
          status: "pago",
          asaas_payment_id: asaasPaymentId,
          ledger_credited: true,
        })
        .eq("id", externalReference)
        .eq("ledger_credited", false)
        .select("id, organizer_id, platform_fee, collective_owner_id, collective_fee, photographer_net")
        .maybeSingle();

      if (error) {
        console.error("Error updating order:", error);
      } else if (claimedOrder) {
        console.log(`Order ${externalReference} marked as paid, crediting wallet_ledger`);

        const ledgerEntries: Array<Record<string, unknown>> = [];

        if (claimedOrder.organizer_id && Number(claimedOrder.photographer_net) > 0) {
          ledgerEntries.push({
            user_id: claimedOrder.organizer_id,
            order_id: claimedOrder.id,
            type: "credit_sale",
            amount: claimedOrder.photographer_net,
            description: `Venda - pedido ${claimedOrder.id}`,
          });
        }

        if (claimedOrder.collective_owner_id && Number(claimedOrder.collective_fee) > 0) {
          ledgerEntries.push({
            user_id: claimedOrder.collective_owner_id,
            order_id: claimedOrder.id,
            type: "credit_sale_collective",
            amount: claimedOrder.collective_fee,
            description: `Comissão de coletivo - pedido ${claimedOrder.id}`,
          });
        }

        if (ledgerEntries.length > 0) {
          const { error: ledgerError } = await supabaseAdmin.from("wallet_ledger").insert(ledgerEntries);
          if (ledgerError) {
            console.error("Error crediting wallet_ledger:", ledgerError);
          }
        }
      } else {
        console.log(`Order ${externalReference} already credited (duplicate webhook), skipping ledger insert`);
      }
    }

    // Handle other events
    if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED") {
      const externalReference = payment.externalReference;
      if (externalReference) {
        await supabaseAdmin
          .from("orders")
          .update({ status: "cancelado" })
          .eq("id", externalReference);
        console.log(`Order ${externalReference} cancelled`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
