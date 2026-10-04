import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { S3Client, PutObjectCommand, GetObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Migrado em 2026-10-02: antes passava por connector-gateway.lovable.dev
// (LOVABLE_API_KEY + AWS_S3_API_KEY). Agora assina direto com o SDK da AWS,
// usando a mesma credencial IAM já usada pelo Rekognition (viufoto-s3-user,
// que já tem AmazonS3FullAccess) — elimina a dependência de infraestrutura
// viva da Lovable para upload/leitura de fotos e vídeos.
const BUCKET = Deno.env.get("S3_BUCKET")!;
const REGION = Deno.env.get("AWS_S3_REGION") || Deno.env.get("AWS_REKOGNITION_REGION") || "sa-east-1";
const ACCESS_KEY_ID = Deno.env.get("AWS_REKOGNITION_ACCESS_KEY_ID")!;
const SECRET_ACCESS_KEY = Deno.env.get("AWS_REKOGNITION_SECRET_ACCESS_KEY")!;

const UPLOAD_EXPIRES_IN = 3600; // 1h — tempo suficiente pro upload, re-assinado em retry se expirar
const READ_EXPIRES_IN = 3600; // 1h — galeria pública/privada, re-assinada a cada carregamento de página

const s3 = new S3Client({ region: REGION, credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY } });

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function signUpload(objectPath: string): Promise<{ url: string; expires_in: number; method: string }> {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: objectPath });
  const url = await getSignedUrl(s3, cmd, { expiresIn: UPLOAD_EXPIRES_IN });
  return { url, expires_in: UPLOAD_EXPIRES_IN, method: "PUT" };
}

async function signRead(objectPath: string): Promise<{ url: string; expires_in: number; method: string }> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: objectPath });
  const url = await getSignedUrl(s3, cmd, { expiresIn: READ_EXPIRES_IN });
  return { url, expires_in: READ_EXPIRES_IN, method: "GET" };
}

// Camada de validação de backend (2ª linha de defesa, além do frontend) — regra
// oficial da plataforma: apenas .mp4/.mov são aceitos no caminho /videos/.
// Não valida tamanho aqui porque o presign não recebe o Content-Length do arquivo;
// o tamanho é reforçado no client (useS3Upload.ts) e, de forma definitiva, no
// Lambda Video Processor ao inspecionar o objeto já no S3.
function validateUploadPath(objectPath: string): string | null {
  const isVideoPath = /\/videos\//i.test(objectPath);
  if (isVideoPath && !/\.(mp4|mov)$/i.test(objectPath)) {
    return "Formato de vídeo não suportado. Apenas .mp4 ou .mov são aceitos.";
  }
  return null;
}

// ─── Proteção contra download grátis do original (sem pagar) ───
// toThumbPath/toMediumPath (src/lib/cdnConfig.ts) sempre geram "<dir>/thumb/<arquivo>"
// ou "<dir>/medium/<arquivo>" — essas derivadas são a prévia pública da galeria e
// continuam liberadas sem autenticação. Qualquer outro caminho é potencialmente o
// ORIGINAL em alta resolução; antes de assiná-lo, confirmamos que ele é mesmo o
// file_url de uma foto/vídeo de evento e, se for, exigimos que quem pede seja o
// organizador do evento, um fotógrafo vinculado a ele, ou um super_admin — nunca um
// visitante anônimo que só leu o file_url público de event_photos/event_videos.
// Compradores recebem o link do original pela função order-download, que já faz
// sua própria verificação de pagamento e assina direto, sem passar por aqui.
function isDerivativePath(objectPath: string): boolean {
  return /\/(thumb|medium)\//i.test(objectPath);
}

async function findOriginalOwnerEvent(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  paths: string[],
): Promise<Map<string, string>> {
  const ownerByPath = new Map<string, string>();
  if (paths.length === 0) return ownerByPath;

  const [{ data: photos }, { data: videos }] = await Promise.all([
    supabaseAdmin.from("event_photos").select("file_url, event_id").in("file_url", paths),
    supabaseAdmin.from("event_videos").select("file_url, event_id").in("file_url", paths),
  ]);

  (photos || []).forEach((p: any) => ownerByPath.set(p.file_url, p.event_id));
  (videos || []).forEach((v: any) => { if (!ownerByPath.has(v.file_url)) ownerByPath.set(v.file_url, v.event_id); });

  return ownerByPath;
}

async function getAuthorizedUserId(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  authHeader: string | null,
): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

async function isAuthorizedForEvent(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  eventId: string,
): Promise<boolean> {
  const [{ data: ev }, { data: ph }, { data: roleRow }] = await Promise.all([
    supabaseAdmin.from("events").select("organizer_id").eq("id", eventId).maybeSingle(),
    supabaseAdmin.from("event_photographers").select("photographer_id").eq("event_id", eventId).eq("photographer_id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle(),
  ]);
  return ev?.organizer_id === userId || !!ph || !!roleRow;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!BUCKET || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    return new Response(JSON.stringify({ error: "S3 credentials not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action, object_path, objects } = body;
    const supabaseAdmin = getSupabaseAdmin();

    // Read actions (sign_read, sign_read_batch) can work without auth for public gallery
    const isReadAction = action === "sign_read" || action === "sign_read_batch";

    // Write actions require authentication
    if (!isReadAction) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "sign_upload") {
      if (!object_path) {
        return new Response(JSON.stringify({ error: "object_path required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const validationError = validateUploadPath(object_path);
      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const data = await signUpload(object_path);
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        throw new Error(`Sign upload error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (action === "sign_upload_batch") {
      if (!objects || !Array.isArray(objects)) {
        return new Response(JSON.stringify({ error: "objects array required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Parallel signing — drastically lower wall-clock for large batches.
      const results = await Promise.all(
        objects.map(async (obj: { path: string }) => {
          const validationError = validateUploadPath(obj.path);
          if (validationError) {
            return { path: obj.path, error: validationError };
          }
          try {
            const data = await signUpload(obj.path);
            return { path: obj.path, ...data };
          } catch (e: any) {
            return { path: obj.path, error: e?.message || "failed" };
          }
        })
      );

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sign_read") {
      if (!object_path) {
        return new Response(JSON.stringify({ error: "object_path required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isDerivativePath(object_path)) {
        const ownerByPath = await findOriginalOwnerEvent(supabaseAdmin, [object_path]);
        const eventId = ownerByPath.get(object_path);
        if (eventId) {
          const userId = await getAuthorizedUserId(supabaseAdmin, req.headers.get("Authorization"));
          const authorized = userId ? await isAuthorizedForEvent(supabaseAdmin, userId, eventId) : false;
          if (!authorized) {
            return new Response(JSON.stringify({
              error: "Esta é a foto/vídeo original. Compre o pedido para baixá-la, ou entre com a conta do organizador/fotógrafo do evento.",
            }), {
              status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      try {
        const data = await signRead(object_path);
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        throw new Error(`Sign read error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (action === "sign_read_batch") {
      if (!objects || !Array.isArray(objects)) {
        return new Response(JSON.stringify({ error: "objects array required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const paths: string[] = objects.map((o: { path: string }) => o.path).filter(Boolean);
      const originalPaths = paths.filter((p) => !isDerivativePath(p));
      const ownerByPath = await findOriginalOwnerEvent(supabaseAdmin, originalPaths);

      // Autoriza (ou não) uma vez por usuário/evento, não por arquivo — evita repetir
      // a mesma consulta de ownership para cada foto de um mesmo pedido em lote.
      let userId: string | null = null;
      let userIdResolved = false;
      const authorizedEvents = new Map<string, boolean>();
      const isAuthorizedForPath = async (path: string): Promise<boolean> => {
        const eventId = ownerByPath.get(path);
        if (!eventId) return true; // não é original de evento conhecido (ex.: asset administrativo) — segue liberado
        if (!userIdResolved) {
          userId = await getAuthorizedUserId(supabaseAdmin, req.headers.get("Authorization"));
          userIdResolved = true;
        }
        if (!userId) return false;
        if (authorizedEvents.has(eventId)) return authorizedEvents.get(eventId)!;
        const ok = await isAuthorizedForEvent(supabaseAdmin, userId, eventId);
        authorizedEvents.set(eventId, ok);
        return ok;
      };

      // Parallel signing for the gallery — was the main TTFB bottleneck.
      const results = await Promise.all(
        objects.map(async (obj: { path: string }) => {
          try {
            if (!isDerivativePath(obj.path) && ownerByPath.has(obj.path)) {
              const authorized = await isAuthorizedForPath(obj.path);
              if (!authorized) return { path: obj.path, error: "not_authorized" };
            }
            const data = await signRead(obj.path);
            return { path: obj.path, ...data };
          } catch {
            return { path: obj.path, error: "failed" };
          }
        })
      );

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      return new Response(JSON.stringify({ success: true, message: "DB record will be deleted by client" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: sign_upload, sign_upload_batch, sign_read, sign_read_batch" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("s3-presign error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
