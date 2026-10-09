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

// ---------------------------------------------------------------------------
// Validação de preços no servidor
// O navegador envia itens e total, mas NADA disso é confiável: o valor cobrado
// é sempre recalculado aqui a partir do banco (tabela price_grids + desconto
// progressivo do evento). O total enviado só serve para detectar carrinho
// desatualizado.
// ---------------------------------------------------------------------------
const MIN_ORDER_VALUE = 5; // piso do Asaas para PIX e cartão
const MAX_ITEMS_PER_ORDER = 500;
const ID_CHUNK = 100;

class CheckoutValidationError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Mesma regra de src/lib/progressiveDiscount.ts
function pickProgressiveDiscountPct(raw: unknown, photoCount: number): number {
  if (!Array.isArray(raw)) return 0;
  const rules = raw
    .map((r: any) => ({
      enabled: r?.enabled !== false && r?.active !== false,
      min_photos: Number(r?.min_photos) || 0,
      discount_pct: Number(r?.discount_pct) || 0,
    }))
    .filter((r) => r.enabled && r.min_photos > 0 && r.discount_pct > 0)
    .sort((a, b) => a.min_photos - b.min_photos);
  let pct = 0;
  for (const r of rules) {
    if (photoCount >= r.min_photos) pct = r.discount_pct;
  }
  return Math.min(Math.max(pct, 0), 100);
}

async function countOwnedIds(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  table: "event_photos" | "event_videos",
  eventId: string,
  ids: string[],
): Promise<number> {
  let found = 0;
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("id")
      .eq("event_id", eventId)
      .in("id", chunk);
    if (error) throw new Error(`Items lookup error: ${error.message}`);
    found += data?.length ?? 0;
  }
  return found;
}

async function priceCartFromDb(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  eventId: string,
  rawItems: any[],
) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > MAX_ITEMS_PER_ORDER) {
    throw new CheckoutValidationError(400, "INVALID_ITEMS", "Carrinho inválido. Atualize a página e tente novamente.");
  }

  const photoIds = new Set<string>();
  const videoIds = new Set<string>();
  for (const it of rawItems) {
    const p = typeof it?.photoId === "string" && it.photoId ? it.photoId : null;
    const v = typeof it?.videoId === "string" && it.videoId ? it.videoId : null;
    if ((p && v) || (!p && !v)) {
      throw new CheckoutValidationError(400, "INVALID_ITEMS", "Carrinho inválido. Atualize a página e tente novamente.");
    }
    if (p) photoIds.add(p);
    if (v) videoIds.add(v);
  }

  // Preços vigentes do evento (mesma escolha do front: primeira grade criada)
  const { data: grid, error: gridError } = await supabaseAdmin
    .from("price_grids")
    .select("photo_high_price, video_price")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (gridError) throw new Error(`Price lookup error: ${gridError.message}`);

  const photoPrice = Number(grid?.photo_high_price ?? 0);
  const videoPrice = Number(grid?.video_price ?? 0);
  if ((photoIds.size > 0 && !(photoPrice > 0)) || (videoIds.size > 0 && !(videoPrice > 0))) {
    throw new CheckoutValidationError(400, "PRICE_NOT_SET", "O fotógrafo ainda não configurou os preços deste evento.");
  }

  // Todos os itens precisam pertencer ao evento informado
  const [photosFound, videosFound] = await Promise.all([
    photoIds.size ? countOwnedIds(supabaseAdmin, "event_photos", eventId, [...photoIds]) : Promise.resolve(0),
    videoIds.size ? countOwnedIds(supabaseAdmin, "event_videos", eventId, [...videoIds]) : Promise.resolve(0),
  ]);
  if (photosFound !== photoIds.size || videosFound !== videoIds.size) {
    throw new CheckoutValidationError(400, "ITEMS_NOT_IN_EVENT", "Alguns itens do carrinho não estão mais disponíveis. Esvazie o carrinho e adicione novamente.");
  }

  // Desconto progressivo (colunas podem não existir em todos os ambientes:
  // se a consulta falhar, segue sem desconto, igual ao comportamento do site)
  let discountPct = 0;
  const { data: disc, error: discError } = await supabaseAdmin
    .from("events")
    .select("progressive_discount_enabled, progressive_discount_rules")
    .eq("id", eventId)
    .maybeSingle();
  if (!discError && disc?.progressive_discount_enabled) {
    discountPct = pickProgressiveDiscountPct(disc.progressive_discount_rules, photoIds.size);
  }

  const factor = 1 - discountPct / 100;
  const subtotal = round2(photoIds.size * photoPrice + videoIds.size * videoPrice);
  const total = round2(subtotal * factor);

  const items = [
    ...[...photoIds].map((id) => ({ photoId: id, videoId: null as string | null, price: round2(photoPrice * factor) })),
    ...[...videoIds].map((id) => ({ photoId: null as string | null, videoId: id, price: round2(videoPrice * factor) })),
  ];

  return { items, subtotal, discountPct, total };
}

// Map raw errors (Asaas / internal) to friendly Portuguese messages
function mapErrorToFriendly(error: any): { status: number; code: string; message: string } {
  if (error instanceof CheckoutValidationError) {
    return { status: error.status, code: error.code, message: error.message };
  }
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

// Marca o pedido como pago e credita o ledger uma única vez. Mesma regra do
// asaas-webhook (filtro ledger_credited=false garante que só quem "reivindicar"
// primeiro credita — webhook e polling podem disputar sem duplicar).
async function settlePaidOrder(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  orderId: string | null | undefined,
  asaasPaymentId: string,
) {
  if (!orderId) return;

  const { data: claimed, error } = await supabaseAdmin
    .from("orders")
    .update({ status: "pago", ledger_credited: true })
    .eq("id", orderId)
    .eq("asaas_payment_id", asaasPaymentId) // o pagamento precisa ser o deste pedido
    .eq("ledger_credited", false)
    .select("id, organizer_id, collective_owner_id, collective_fee, photographer_net")
    .maybeSingle();

  if (error) throw new Error(`settle claim error: ${error.message}`);
  if (!claimed) return; // já assentado (webhook ou chamada anterior)

  console.log(`[SETTLE] Order ${orderId} marked as paid via status check, crediting wallet_ledger`);

  const entries: Array<Record<string, unknown>> = [];
  if (claimed.organizer_id && Number(claimed.photographer_net) > 0) {
    entries.push({
      user_id: claimed.organizer_id,
      order_id: claimed.id,
      type: "credit_sale",
      amount: claimed.photographer_net,
      description: `Venda - pedido ${claimed.id}`,
    });
  }
  if (claimed.collective_owner_id && Number(claimed.collective_fee) > 0) {
    entries.push({
      user_id: claimed.collective_owner_id,
      order_id: claimed.id,
      type: "credit_sale_collective",
      amount: claimed.collective_fee,
      description: `Comissão de coletivo - pedido ${claimed.id}`,
    });
  }
  if (entries.length > 0) {
    const { error: ledgerError } = await supabaseAdmin.from("wallet_ledger").insert(entries);
    if (ledgerError) console.error("Error crediting wallet_ledger:", ledgerError);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const supabaseAdmin = getSupabaseAdmin();

    if (action === "create_checkout") {
      const { name, email, cpfCnpj, eventId, items: clientItems, total: clientTotal } = params;

      if (!name || !email || !cpfCnpj || !eventId || !clientItems?.length) {
        return new Response(JSON.stringify({ error: "Dados incompletos" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 0. Preço sempre vem do banco; o que o navegador mandou só é conferido.
      const priced = await priceCartFromDb(supabaseAdmin, eventId, clientItems);
      const total = priced.total;
      const items = priced.items;

      if (total < MIN_ORDER_VALUE) {
        throw new CheckoutValidationError(400, "BELOW_MINIMUM", "O valor mínimo de compra é R$ 5,00 (PIX e cartão). Adicione mais itens ao carrinho.");
      }
      if (typeof clientTotal !== "number" || Math.abs(clientTotal - total) > 0.01) {
        console.warn(`[PRICE_MISMATCH] event=${eventId} client=${clientTotal} server=${total}`);
        throw new CheckoutValidationError(409, "PRICE_CHANGED", "Os preços deste evento mudaram desde que você montou o carrinho. Esvazie o carrinho e adicione as fotos novamente.");
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
      // NOTA: order_items.resolution é vestígio de uma opção de resolução
      // reduzida que nunca foi exposta no checkout (vem sempre "high" do
      // carrinho). Gravamos sempre "high" — a coluna continua existindo no
      // banco (default 'high') só para não exigir uma migração agora.
      const orderItems = items.map((item) => ({
        order_id: order.id,
        photo_id: item.photoId,
        video_id: item.videoId,
        price: item.price,
        resolution: "high",
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

      // Rede de segurança contra webhook atrasado/perdido: o status vem da API do
      // Asaas (chamada autenticada com a nossa chave, não do navegador), então é
      // seguro assentar o pedido aqui. É idempotente com o asaas-webhook.
      if (payment.status === "RECEIVED" || payment.status === "CONFIRMED") {
        try {
          await settlePaidOrder(supabaseAdmin, payment.externalReference, payment.id);
        } catch (e) {
          console.error("settlePaidOrder error:", e);
        }
      }

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
