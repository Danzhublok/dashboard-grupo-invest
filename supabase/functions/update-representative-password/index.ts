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
  if (profile?.role !== "admin") {
    return json({ error: "Somente administradores podem alterar senhas." }, 403);
  }

  const body = await request.json();
  const targetUserId = String(body.target_user_id ?? "");
  const password = String(body.password ?? "");
  if (!targetUserId || password.length < 8) {
    return json({ error: "Informe uma senha com pelo menos 8 caracteres." }, 400);
  }

  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .single();
  if (targetProfile?.role !== "representante") {
    return json({ error: "Somente senhas de representantes podem ser alteradas." }, 400);
  }

  const { error } = await adminClient.auth.admin.updateUserById(targetUserId, { password });
  if (error) return json({ error: error.message }, 400);
  return json({ success: true });
});
