import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !authorization) {
    return json({ error: "Configuração segura do Supabase ausente." }, 500);
  }

  const token = authorization.replace(/^Bearer\s+/i, "");
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  if (profile?.role !== "admin")
    return json({ error: "Somente administradores podem criar representantes." }, 403);

  const body = await request.json();
  const representationId = String(body.representation_id ?? "");
  const representationName = String(body.representation_name ?? "");
  const username = slug(String(body.username ?? body.representative_name ?? ""));
  const representationSlug = slug(representationName);
  if (!representationId || !username || !representationSlug) {
    return json({ error: "Representação e nome do representante são obrigatórios." }, 400);
  }

  const password = String(body.password ?? "") || `${representationSlug}represent`;
  if (password.length < 8)
    return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);
  const email = `${username}@accounts.grupoinvest.local`;
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: username, username },
  });
  if (createError || !created.user) {
    return json({ error: createError?.message ?? "Não foi possível criar o usuário." }, 409);
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ full_name: username, username, role: "representante" })
    .eq("id", created.user.id);
  const { error: membershipError } = await adminClient
    .from("representation_members")
    .insert({ user_id: created.user.id, representation_id: representationId });

  if (profileError || membershipError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json(
      {
        error:
          profileError?.message ?? membershipError?.message ?? "Não foi possível vincular a conta.",
      },
      500,
    );
  }

  return json({ username, password });
});
