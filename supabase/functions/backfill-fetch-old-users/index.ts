import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Função de migração TEMPORÁRIA — criada em 2026-10-03.
// Busca todos os usuários (auth.users) do projeto Supabase ANTIGO (gerenciado
// pela Lovable) via Admin API e grava numa tabela de staging neste projeto
// novo (_old_auth_users_staging). Não traz senha (a Admin API do GoTrue nunca
// expõe o hash de senha) — decisão combinada com o Tiago: recriar usuários
// com o mesmo UUID, sem senha (reset obrigatório no primeiro login).
// Desativar/remover após a migração de dados estar completa.
//
// Segurança: verify_jwt fica false (não é um usuário final chamando isso),
// mas só quem tiver a SUPABASE_SERVICE_ROLE_KEY deste projeto (nunca exposta
// no frontend) consegue disparar — sem isso, qualquer um com a URL pública
// conseguia rodar essa migração repetidamente.

const OLD_URL = "https://ccyrargjjpokfwbqkgcl.supabase.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const OLD_SERVICE_KEY = Deno.env.get("OLD_SUPABASE_SERVICE_ROLE_KEY");
  if (!OLD_SERVICE_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "OLD_SUPABASE_SERVICE_ROLE_KEY not configured" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let page = 1;
  const perPage = 1000;
  let totalFetched = 0;
  let totalStaged = 0;
  const errors: string[] = [];

  try {
    while (true) {
      const res = await fetch(`${OLD_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
        headers: {
          apikey: OLD_SERVICE_KEY,
          Authorization: `Bearer ${OLD_SERVICE_KEY}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        errors.push(`page ${page}: HTTP ${res.status} ${text}`);
        break;
      }

      const data = await res.json();
      const users = data.users ?? data; // GoTrue retorna { users: [...] } nas versões recentes
      if (!Array.isArray(users) || users.length === 0) break;

      totalFetched += users.length;

      const rows = users.map((u: any) => ({
        id: u.id,
        email: u.email ?? null,
        phone: u.phone ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        phone_confirmed_at: u.phone_confirmed_at ?? null,
        created_at: u.created_at ?? null,
        updated_at: u.updated_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        raw_app_meta_data: u.app_metadata ?? {},
        raw_user_meta_data: u.user_metadata ?? {},
        is_anonymous: u.is_anonymous ?? false,
        banned_until: u.banned_until ?? null,
      }));

      const { error: upErr } = await db.from("_old_auth_users_staging").upsert(rows, { onConflict: "id" });
      if (upErr) {
        errors.push(`page ${page} upsert: ${upErr.message}`);
      } else {
        totalStaged += rows.length;
      }

      if (users.length < perPage) break; // última página
      page++;
      if (page > 50) { errors.push("safety cap: too many pages (>50000 users?)"); break; } // guarda de segurança
    }

    return new Response(JSON.stringify({ ok: errors.length === 0, totalFetched, totalStaged, pages: page, errors }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e), totalFetched, totalStaged }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
