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

    // Action: lookup orders by email
    if (action === "lookup") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: orders, error } = await supabaseAdmin
        .from("orders")
        .select(`
          id, client_name, client_email, amount, status, payment_method, created_at, event_id,
          order_items ( id, photo_id, video_id, price )
        `)
        .eq("client_email", email.toLowerCase().trim())
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

    // Action: download - generate signed URLs for a paid order
    if (action === "download") {
      if (!order_id || !email) {
        return new Response(JSON.stringify({ error: "order_id e email são obrigatórios" }), {
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

      if (order.client_email.toLowerCase() !== email.toLowerCase().trim()) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (order.status !== "pago" && order.status !== "enviado") {
        return new Response(JSON.stringify({ error: "Pedido ainda não foi pago" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get order items with photo/video paths
      const { data: items, error: itemsErr } = await supabaseAdmin
        .from("order_items")
        .select("id, photo_id, video_id, price, resolution")
        .eq("order_id", order_id);

      if (itemsErr) throw itemsErr;

      // Map photo_id -> resolution (high = original, low = medium/social)
      const photoResolution = new Map<string, "high" | "low">();
      (items || []).forEach(i => {
        if (i.photo_id) {
          photoResolution.set(i.photo_id, (i.resolution === "low" ? "low" : "high"));
        }
      });

      const photoIds = Array.from(photoResolution.keys());
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

      // Resolve the actual S3 path based on the purchased resolution.
      // - high  -> /original/  (no watermark, full resolution)
      // - low   -> /medium/    (1200px — "Foto Social", CLEAN file, no watermark)
      // The Lambda pipeline writes processed variants under
      //   {dir}/medium/{filename}.jpg  and keeps the original at the original path.
      const resolvePhotoPath = (originalPath: string, resolution: "high" | "low") => {
        if (resolution === "high") return originalPath;
        const lastSlash = originalPath.lastIndexOf("/");
        if (lastSlash === -1) return originalPath;
        const dir = originalPath.substring(0, lastSlash);
        const filename = originalPath.substring(lastSlash + 1).replace(/\.[^.]+$/, ".jpg");
        return `${dir}/medium/${filename}`;
      };

      // Generate signed read URLs for all files (24h expiration)
      const allFiles = [
        ...photos.map(p => {
          const res = photoResolution.get(p.id) ?? "high";
          return {
            id: p.id,
            path: resolvePhotoPath(p.file_url, res),
            name: p.file_name,
            type: "photo",
            resolution: res,
          };
        }),
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
        .select("id, photo_id, video_id, resolution")
        .eq("order_id", order_id);

      const photoResolution = new Map<string, "high" | "low">();
      (items || []).forEach(i => {
        if (i.photo_id) photoResolution.set(i.photo_id, (i.resolution === "low" ? "low" : "high"));
      });
      const photoIds = Array.from(photoResolution.keys());
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

      const resolvePhotoPath = (originalPath: string, resolution: "high" | "low") => {
        if (resolution === "high") return originalPath;
        const lastSlash = originalPath.lastIndexOf("/");
        if (lastSlash === -1) return originalPath;
        const dir = originalPath.substring(0, lastSlash);
        const filename = originalPath.substring(lastSlash + 1).replace(/\.[^.]+$/, ".jpg");
        return `${dir}/medium/${filename}`;
      };

      const allFiles = [
        ...photos.map(p => ({
          id: p.id,
          path: resolvePhotoPath(p.file_url, photoResolution.get(p.id) ?? "high"),
          name: p.file_name,
          type: "photo" as const,
          resolution: photoResolution.get(p.id) ?? "high",
        })),
        ...videos.map(v => ({ id: v.id, path: v.file_url, name: v.file_name, type: "video" as const, resolution: "high" as const })),
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
