import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE_URL = "https://api.asaas.com/v3";

// Fallback commission rates (used only if DB config is missing).
// Source of truth: table `eligibility_rules` (keys `asaas_commission_<plan>`).
const DEFAULT_COMMISSION = 0.10;
const FALLBACK_PLAN_COMMISSION: Record<string, number> = {
  inicio: 0.10,
  profissional: 0.10,
};

async function getCommissionRate(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  planType: string,
): Promise<number> {
  const key = `asaas_commission_${planType}`;
  try {
    const { data } = await supabaseAdmin
      .from("eligibility_rules")
      .select("value, active")
      .eq("key", key)
      .maybeSingle();
    if (data?.active && data.value != null) {
      const raw = typeof data.value === "string" ? data.value : (data.value as any);
      const num = typeof raw === "number" ? raw : parseFloat(String(raw));
      if (Number.isFinite(num) && num >= 0 && num <= 1) return num;
    }
  } catch (e) {
    console.error("getCommissionRate error:", e);
  }
  return FALLBACK_PLAN_COMMISSION[planType] ?? DEFAULT_COMMISSION;
}

function getAsaasKey(): string {
  const key = Deno.env.get("ASAAS_API_KEY");
  if (!key) throw new Error("ASAAS_API_KEY not configured");
  return key;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function asaasFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: getAsaasKey(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("ASAAS error:", JSON.stringify(data));
    const desc = data.errors?.[0]?.description || `ASAAS error ${res.status}`;
    const err = new Error(desc) as Error & { asaasCode?: string; asaasStatus?: number };
    err.asaasCode = data.errors?.[0]?.code;
    err.asaasStatus = res.status;
    throw err;
  }
  return data;
}

// Map raw errors (Asaas / internal) to friendly Portuguese messages
function mapErrorToFriendly(error: any): { status: number; code: string; message: string } {
  const raw = String(error?.message || "").toLowerCase();

  if (raw.includes("cpfcnpj") || raw.includes("cpf") || raw.includes("cnpj inválido") || raw.includes("documento")) {
    return { status: 400, code: "INVALID_CPF", message: "CPF ou CNPJ inválido. Confira os números e tente novamente." };
  }
  if (raw.includes("email")) {
    return { status: 400, code: "INVALID_EMAIL", message: "E-mail inválido. Verifique e tente novamente." };
  }
  const isAsaasError = error?.asaasCode || error?.asaasStatus || raw.includes("asaas");
  const isDbOrOrderError = raw.includes("order error") || raw.includes("invalid input value for enum");

  if (raw.includes("value") && (raw.includes("mínim") || raw.includes("minim") || raw.includes("invalid")) && isAsaasError && !isDbOrOrderError) {
    return { status: 400, code: "INVALID_VALUE", message: "Valor da compra inválido. Atualize o carrinho e tente novamente." };
  }
  if (raw.includes("customer")) {
    return { status: 400, code: "INVALID_CUSTOMER", message: "Não conseguimos validar seus dados. Confira nome, e-mail e CPF." };
  }
  if (raw.includes("asaas_api_key")) {
    return { status: 500, code: "CONFIG_MISSING", message: "Pagamento temporariamente indisponível. Já fomos avisados." };
  }
  if (raw.includes("asaas error 5") || raw.includes("timeout") || raw.includes("network")) {
    return { status: 502, code: "GATEWAY_DOWN", message: "Sistema de pagamento indisponível no momento. Tente novamente em alguns minutos." };
  }
  if (raw.includes("order error")) {
    return { status: 500, code: "ORDER_SAVE_FAILED", message: "Não conseguimos registrar seu pedido. Tente novamente." };
  }
  if (raw.includes("evento não encontrado") || raw.includes("evento nao encontrado")) {
    return { status: 404, code: "EVENT_NOT_FOUND", message: "Evento não encontrado. Atualize a página e tente novamente." };
  }
  return {
    status: 500,
    code: "UNKNOWN",
    message: "Não foi possível concluir o pagamento. Tente novamente em instantes.",
  };
}

async function getOrCreateCustomer(name: string, email: string, cpfCnpj: string) {
  const existing = await asaasFetch(`/customers?cpfCnpj=${cpfCnpj}`);
  if (existing.data?.length > 0) {
    return existing.data[0];
  }
  return await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({ name, email, cpfCnpj }),
  });
}

async function createPixPayment(
  customerId: string,
  value: number,
  description: string,
  externalReference: string,
) {
  // Modelo de conta mestre: o pagamento inteiro entra na conta ASAAS da ViuFoto.
  // Nenhum split é enviado — a divisão entre plataforma, coletivo e fotógrafo
  // é controlada internamente via wallet_ledger (ver asaas-webhook).
  const today = new Date().toISOString().split("T")[0];
  const body: Record<string, unknown> = {
    customer: customerId,
    billingType: "PIX",
    value,
    dueDate: today,
    description,
    externalReference,
  };
  return await asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function getPixQrCode(paymentId: string) {
  return await asaasFetch(`/payments/${paymentId}/pixQrCode`);
}

async function getPaymentStatus(paymentId: string) {
  return await asaasFetch(`/payments/${paymentId}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const supabaseAdmin = getSupabaseAdmin();

    if (action === "create_checkout") {
      const { name, email, cpfCnpj, eventId, items, total } = params;

      if (!name || !email || !cpfCnpj || !eventId || !items?.length || !total) {
        return new Response(JSON.stringify({ error: "Dados incompletos" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Get event to determine plan_type, organizer, and collective info
      const { data: event, error: eventError } = await supabaseAdmin
        .from("events")
        .select("organizer_id, plan_type, coletivo_id")
        .eq("id", eventId)
        .single();

      if (eventError || !event) {
        throw new Error("Evento não encontrado");
      }

      // 2. Calculate internal split (Platform, Collective, Photographer).
      // Nada disso é enviado à Asaas — o pagamento inteiro cai na conta mestre
      // da ViuFoto e os valores abaixo viram créditos no wallet_ledger quando
      // o webhook confirmar o pagamento (ver asaas-webhook).
      const commissionRate = await getCommissionRate(supabaseAdmin, event.plan_type);
      const platformFee = Math.round(total * commissionRate * 100) / 100;

      let collectiveFee = 0;
      let collectiveOwnerId: string | null = null;

      if (event.coletivo_id) {
        const { data: coletivo } = await supabaseAdmin
          .from("coletivos")
          .select("owner_id")
          .eq("id", event.coletivo_id)
          .single();

        const { data: member } = await supabaseAdmin
          .from("coletivo_members")
          .select("commission_pct")
          .eq("coletivo_id", event.coletivo_id)
          .eq("user_id", event.organizer_id)
          .eq("status", "ativo")
          .single();

        if (coletivo?.owner_id && member?.commission_pct) {
          collectiveFee = Math.round(total * (Number(member.commission_pct) / 100) * 100) / 100;
          collectiveOwnerId = coletivo.owner_id;

          // Se o fotógrafo É o dono do coletivo, não faz sentido creditar a si mesmo separadamente
          if (coletivo.owner_id === event.organizer_id) {
            collectiveFee = 0;
            collectiveOwnerId = null;
          }
        }
      }

      const photographerNet = Math.max(0, Math.round((total - platformFee - collectiveFee) * 100) / 100);

      console.log(`[DEBUG_LEDGER] Event=${eventId}, Coletivo=${event.coletivo_id}, organizer=${event.organizer_id}`);
      console.log(`[DEBUG_LEDGER] Fees: platform=${platformFee}, coletivo=${collectiveFee}, photographerNet=${photographerNet}`);

      // 3. Create/find ASAAS customer
      const customer = await getOrCreateCustomer(name, email, cpfCnpj.replace(/\D/g, ""));

      // 4. Create order in database (já com os valores que o webhook vai creditar no ledger)
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          event_id: eventId,
          client_name: name,
          client_email: email,
          client_cpf: cpfCnpj,
          amount: total,
          status: "aguardando_pagamento",
          payment_method: "pix",
          organizer_id: event.organizer_id,
          platform_fee: platformFee,
          collective_owner_id: collectiveOwnerId,
          collective_fee: collectiveFee,
          photographer_net: photographerNet,
        })
        .select()
        .single();

      if (orderError) throw new Error(`Order error: ${orderError.message}`);

      // 6. Create order items
      const orderItems = items.map((item: any) => ({
        order_id: order.id,
        photo_id: item.photoId || null,
        video_id: item.videoId || null,
        price: item.price,
        resolution: item.resolution === "low" ? "low" : "high",
      }));

      const { error: itemsError } = await supabaseAdmin
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw new Error(`Items error: ${itemsError.message}`);

      // 6. Create ASAAS PIX payment (conta mestre, sem split)
      const payment = await createPixPayment(
        customer.id,
        total,
        `Compra de fotos - Evento ${eventId}`,
        order.id,
      );

      // 7. Update order with ASAAS payment ID
      await supabaseAdmin
        .from("orders")
        .update({ asaas_payment_id: payment.id })
        .eq("id", order.id);

      // 8. Get PIX QR Code
      const pixData = await getPixQrCode(payment.id);

      return new Response(JSON.stringify({
        orderId: order.id,
        paymentId: payment.id,
        status: payment.status,
        pixQrCode: pixData.encodedImage,
        pixCopyPaste: pixData.payload,
        value: payment.value,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_status") {
      const { paymentId } = params;
      if (!paymentId) {
        return new Response(JSON.stringify({ error: "paymentId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const payment = await getPaymentStatus(paymentId);
      return new Response(JSON.stringify({
        status: payment.status,
        confirmedDate: payment.confirmedDate,
        value: payment.value,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("ASAAS Payment Error:", error);
    const friendly = mapErrorToFriendly(error);
    return new Response(JSON.stringify({
      error: friendly.message,
      code: friendly.code,
      detail: error?.message,
    }), {
      status: friendly.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
