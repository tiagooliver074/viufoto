import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Migrado em 2026-10-02: antes passava por connector-gateway.lovable.dev
// (LOVABLE_API_KEY + AWS_S3_API_KEY). Agora assina direto com o SDK da AWS,
// usando a mesma credencial IAM já usada pelo Rekognition (viufoto-s3-user,
// que já tem AmazonS3FullAccess) — elimina a dependência de infraestrutura
// viva da Lovable para gerar os links de download de pedidos pagos.
const BUCKET = Deno.env.get("S3_BUCKET")!;
const REGION = Deno.env.get("AWS_S3_REGION") || Deno.env.get("AWS_REKOGNITION_REGION") || "sa-east-1";
const ACCESS_KEY_ID = Deno.env.get("AWS_REKOGNITION_ACCESS_KEY_ID")!;
const SECRET_ACCESS_KEY = Deno.env.get("AWS_REKOGNITION_SECRET_ACCESS_KEY")!;
const READ_EXPIRES_IN = 86400; // 24h — mesmo prazo usado antes via gateway da Lovable

const s3 = new S3Client({ region: REGION, credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY } });

async function signRead(objectPath: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: objectPath });
  return await getSignedUrl(s3, cmd, { expiresIn: READ_EXPIRES_IN });
}

// Segurança (item 4 da auditoria, 2026-10-04): "lookup" e "download" aceitavam
// qualquer e-mail digitado pelo chamador como prova de dono do pedido — sem
// verificação nenhuma. Quem soubesse (ou adivinhasse) o e-mail de um cliente
// conseguia ver todo o histórico de compras dele e, pior, baixar as fotos de
// verdade. Agora exigimos posse real do e-mail via OTP do Supabase Auth: o
// cliente pede um código em "Meus Pedidos", confirma (supabase.auth.verifyOtp)
// e o navegador passa a enviar um JWT de sessão real nas chamadas seguintes —
// chamada que o front-end já inclui sozinho via supabase.functions.invoke.
// getVerifiedEmail decodifica esse JWT contra o GoTrue; a chave anon/publishable
// (usada por chamadas sem login) não tem usuário associado e retorna null aqui.
async function getVerifiedEmail(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user?.email) return null;
    return user.email.toLowerCase();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!BUCKET || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { action, order_id, email, token } = body;

    // Action: lookup orders by email — exige e-mail verificado por OTP (ver
    // getVerifiedEmail acima). Nunca confia no "email" do corpo da requisição
    // para decidir o que mostrar: ele é ignorado para fins de autorização.
    if (action === "lookup") {
      const verifiedEmail = await getVerifiedEmail(req);
      if (!verifiedEmail) {
        return new Response(JSON.stringify({ error: "Verifique seu e-mail para consultar seus pedidos" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: orders, error } = await supabaseAdmin
        .from("orders")
        .select(`
          id, client_name, client_email, amount, status, payment_method, created_at, event_id,
          order_items ( id, photo_id, video_id, price )
        `)
        .eq("client_email", verifiedEmail)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch event names for each order
      const eventIds = [...new Set((orders || []).map(o => o.event_id))];
      let eventMap: Record<string, string> = {};
      if (eventIds.length > 0) {
        const { data: events } = await supabaseAdmin
          .from("events")
          .select("id, name")
          .in("id", eventIds);
        if (events) {
          eventMap = Object.fromEntries(events.map(e => [e.id, e.name]));
        }
      }

      const enriched = (orders || []).map(o => ({
        ...o,
        event_name: eventMap[o.event_id] || "Evento",
        item_count: o.order_items?.length || 0,
      }));

      return new Response(JSON.stringify({ orders: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: download - generate signed URLs for a paid order.
    // email agora é opcional no corpo quando a chamada já carrega uma sessão
    // verificada (Authorization de usuário real) — ver checagem de dono abaixo.
    if (action === "download") {
      if (!order_id) {
        return new Response(JSON.stringify({ error: "order_id é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate order belongs to email and is paid
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .select("id, status, client_email, event_id")
        .eq("id", order_id)
        .single();

      if (orderErr || !order) {
        return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Autorização (item 4 da auditoria, 2026-10-04): se vier um JWT de sessão
      // real (cliente passou pelo OTP em "Meus Pedidos"), confiamos no e-mail
      // verificado pelo GoTrue — nunca no "email" do corpo. Sem sessão (fluxo
      // imediato logo após o pagamento, mesma aba, com o order_id que acabou de
      // ser criado), mantemos a checagem original por order_id + email digitado:
      // o order_id é um UUID não adivinhável e só o navegador que pagou o tem.
      const verifiedEmail = await getVerifiedEmail(req);
      const ownerEmail = verifiedEmail ?? (email ? String(email).toLowerCase().trim() : null);
      if (!ownerEmail || order.client_email.toLowerCase() !== ownerEmail) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (order.status !== "pago" && order.status !== "enviado") {
        return new Response(JSON.stringify({ error: "Pedido ainda não foi pago" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get order items with photo/video paths.
      // NOTA: a coluna order_items.resolution ("high"/"low") é vestígio de uma
      // opção de resolução reduzida ("Foto Social") que nunca foi exposta na
      // UI de compra (nenhum fluxo do carrinho define "low") nem tem um
      // arquivo comercial correspondente gerado pela Lambda de imagem — por
      // isso foi removida da lógica de entrega. Hoje todo pedido entrega o
      // arquivo ORIGINAL (alta resolução, sem marca d'água).
      const { data: items, error: itemsErr } = await supabaseAdmin
        .from("order_items")
        .select("id, photo_id, video_id, price")
        .eq("order_id", order_id);

      if (itemsErr) throw itemsErr;

      const photoIds = (items || []).filter(i => i.photo_id).map(i => i.photo_id!);
      const videoIds = (items || []).filter(i => i.video_id).map(i => i.video_id!);

      // Fetch file paths from event_photos and event_videos
      let photos: { id: string; file_url: string; file_name: string | null }[] = [];
      let videos: { id: string; file_url: string; file_name: string | null }[] = [];

      if (photoIds.length > 0) {
        const { data } = await supabaseAdmin
          .from("event_photos")
          .select("id, file_url, file_name")
          .in("id", photoIds);
        photos = data || [];
      }

      if (videoIds.length > 0) {
        const { data } = await supabaseAdmin
          .from("event_videos")
          .select("id, file_url, file_name")
          .in("id", videoIds);
        videos = data || [];
      }

      // Entrega sempre o arquivo ORIGINAL (alta resolução, sem marca d'água) —
      // não existe mais um tier de resolução reduzida nesta função.
      const allFiles = [
        ...photos.map(p => ({
          id: p.id,
          path: p.file_url,
          name: p.file_name,
          type: "photo",
        })),
        ...videos.map(v => ({ id: v.id, path: v.file_url, name: v.file_name, type: "video" })),
      ];

      const signedFiles = [];
      for (const file of allFiles) {
        // Skip legacy Supabase URLs
        if (file.path.startsWith("http")) {
          signedFiles.push({ ...file, url: file.path });
          continue;
        }

        try {
          const url = await signRead(file.path);
          signedFiles.push({ ...file, url });
        } catch {
          signedFiles.push({ ...file, url: null, error: "Erro interno" });
        }
      }

      // Update order status to "enviado" if it was "pago"
      if (order.status === "pago") {
        await supabaseAdmin
          .from("orders")
          .update({ status: "enviado" })
          .eq("id", order_id);
      }

      return new Response(JSON.stringify({ files: signedFiles }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: photographer_resend — fotógrafo/organizador baixa links de um pedido pago
    // para reenviar ao cliente (caso ele não tenha recebido o email).
    if (action === "photographer_resend") {
      const authHeader = req.headers.get("Authorization");
      if (!order_id || !authHeader) {
        return new Response(JSON.stringify({ error: "order_id e autenticação são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .select("id, status, client_email, client_name, event_id, amount")
        .eq("id", order_id)
        .maybeSingle();
      if (orderErr || !order) {
        return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Autorização: organizador do evento, fotógrafo do evento, ou super_admin
      const [{ data: ev }, { data: ph }, { data: roleRow }] = await Promise.all([
        supabaseAdmin.from("events").select("organizer_id, name").eq("id", order.event_id).maybeSingle(),
        supabaseAdmin.from("event_photographers").select("photographer_id").eq("event_id", order.event_id).eq("photographer_id", user.id).maybeSingle(),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle(),
      ]);
      const isOwner = ev?.organizer_id === user.id;
      const isPhotog = !!ph;
      const isAdmin = !!roleRow;
      if (!isOwner && !isPhotog && !isAdmin) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (order.status !== "pago" && order.status !== "enviado") {
        return new Response(JSON.stringify({ error: "Pedido ainda não foi pago" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("id, photo_id, video_id")
        .eq("order_id", order_id);

      const photoIds = (items || []).filter(i => i.photo_id).map(i => i.photo_id!);
      const videoIds = (items || []).filter(i => i.video_id).map(i => i.video_id!);

      let photos: { id: string; file_url: string; file_name: string | null }[] = [];
      let videos: { id: string; file_url: string; file_name: string | null }[] = [];
      if (photoIds.length > 0) {
        const { data } = await supabaseAdmin.from("event_photos").select("id, file_url, file_name").in("id", photoIds);
        photos = data || [];
      }
      if (videoIds.length > 0) {
        const { data } = await supabaseAdmin.from("event_videos").select("id, file_url, file_name").in("id", videoIds);
        videos = data || [];
      }

      const allFiles = [
        ...photos.map(p => ({
          id: p.id,
          path: p.file_url,
          name: p.file_name,
          type: "photo" as const,
        })),
        ...videos.map(v => ({ id: v.id, path: v.file_url, name: v.file_name, type: "video" as const })),
      ];

      const signedFiles: any[] = [];
      for (const file of allFiles) {
        if (file.path.startsWith("http")) {
          signedFiles.push({ ...file, url: file.path });
          continue;
        }
        try {
          const url = await signRead(file.path);
          signedFiles.push({ ...file, url });
        } catch {
          signedFiles.push({ ...file, url: null });
        }
      }

      // Marca pedido como enviado
      if (order.status === "pago") {
        await supabaseAdmin.from("orders").update({ status: "enviado" }).eq("id", order_id);
      }

      return new Response(JSON.stringify({
        files: signedFiles,
        order: { id: order.id, client_name: order.client_name, client_email: order.client_email, event_name: ev?.name ?? null },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use: lookup, download, photographer_resend" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("order-download error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
