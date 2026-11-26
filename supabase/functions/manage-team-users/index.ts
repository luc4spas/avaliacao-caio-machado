import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TeamRole = "admin" | "equipe";
type TeamUser = {
  id: string;
  email: string;
  role: TeamRole;
  active: boolean;
  emailConfirmed: boolean;
  createdAt: string;
};
class RequestValidationError extends Error {}

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTeamRole(value: unknown): value is TeamRole {
  return value === "admin" || value === "equipe";
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RequestValidationError(`O campo ${name} é obrigatório.`);
  }
  return value.trim();
}

function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new RequestValidationError("Identificador de usuário inválido.");
  }
}

function assertRole(value: unknown): asserts value is TeamRole {
  if (!isTeamRole(value)) throw new RequestValidationError("Perfil inválido.");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro inesperado ao gerenciar usuários.";
}

function getDefaultApiKey(variableName: string): string | undefined {
  const rawKeys = Deno.env.get(variableName);
  if (!rawKeys) return undefined;

  let keys: unknown;
  try {
    keys = JSON.parse(rawKeys);
  } catch {
    throw new Error(`A variável ${variableName} não contém JSON válido.`);
  }

  if (!isRecord(keys) || typeof keys.default !== "string" || !keys.default) {
    throw new Error(`A variável ${variableName} não contém uma chave padrão.`);
  }
  return keys.default;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return respond(405, { error: "Método não permitido." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publicKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      getDefaultApiKey("SUPABASE_PUBLISHABLE_KEYS") ??
      Deno.env.get("SUPABASE_ANON_KEY");
    const secretKey =
      Deno.env.get("SUPABASE_SECRET_KEY") ??
      getDefaultApiKey("SUPABASE_SECRET_KEYS") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");

    if (!supabaseUrl || !publicKey || !secretKey) {
      console.error("Required Supabase Edge Function environment variables are missing.");
      return respond(500, { error: "A configuração segura do gerenciamento está incompleta." });
    }
    if (!authorization?.startsWith("Bearer ")) {
      return respond(401, { error: "Sessão inválida. Entre novamente." });
    }

    const caller = createClient(supabaseUrl, publicKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) {
      return respond(401, { error: "Sessão inválida. Entre novamente." });
    }

    const { data: isAdmin, error: roleCheckError } = await caller.rpc("has_role", {
      _user_id: authData.user.id,
      _role: "admin",
    });
    if (roleCheckError) {
      console.error("Could not verify the caller's admin role:", roleCheckError.message);
      return respond(500, { error: "Não foi possível verificar sua permissão." });
    }
    if (!isAdmin)
      return respond(403, { error: "Apenas administradores podem gerenciar usuários." });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return respond(400, { error: "Corpo da solicitação inválido." });
    }
    if (!isRecord(body) || typeof body.action !== "string") {
      return respond(400, { error: "Ação de gerenciamento inválida." });
    }

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (body.action === "list") {
      const perPage = 1000;
      const authUsers: User[] = [];

      for (let page = 1; ; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) throw new Error(`Não foi possível listar usuários: ${error.message}`);
        authUsers.push(...data.users);
        if (data.users.length < perPage) break;
      }

      const { data: roleRows, error: rolesError } = await admin
        .from("user_roles")
        .select("user_id, role, is_active");
      if (rolesError) throw new Error(`Não foi possível listar os perfis: ${rolesError.message}`);

      const usersById = new Map(authUsers.map((user) => [user.id, user]));
      const users: TeamUser[] = roleRows.map((row) => {
        const user = usersById.get(row.user_id);
        if (!user) throw new Error(`A conta de usuário ${row.user_id} não foi encontrada no Auth.`);

        const bannedUntil = user.banned_until ? Date.parse(user.banned_until) : Number.NaN;
        return {
          id: user.id,
          email: user.email ?? "",
          role: row.role,
          active: row.is_active && !(Number.isFinite(bannedUntil) && bannedUntil > Date.now()),
          emailConfirmed: Boolean(user.email_confirmed_at),
          createdAt: user.created_at,
        };
      });

      users.sort((first, second) => first.email.localeCompare(second.email));
      return respond(200, users);
    }

    if (body.action === "invite") {
      const email = requiredString(body.email, "e-mail").toLowerCase();
      assertRole(body.role);
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return respond(400, { error: "Informe um e-mail válido." });
      }

      const perPage = 1000;
      for (let page = 1; ; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) throw new Error(`Não foi possível verificar o e-mail: ${error.message}`);
        if (data.users.some((user) => user.email?.toLowerCase() === email)) {
          return respond(409, {
            error: "Este e-mail já possui uma conta. Altere ou reative o usuário na lista.",
          });
        }
        if (data.users.length < perPage) break;
      }

      const origin = request.headers.get("origin");
      let redirectTo: string | undefined;
      if (origin) {
        const callback = new URL("/reset-password", origin);
        if (callback.protocol !== "https:" && callback.hostname !== "localhost") {
          return respond(400, { error: "Origem de convite inválida." });
        }
        redirectTo = callback.toString();
      }

      const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        email,
        redirectTo ? { redirectTo } : undefined,
      );
      if (inviteError) throw new Error(`Não foi possível enviar o convite: ${inviteError.message}`);
      if (!invitation.user) throw new Error("O Supabase não retornou a conta criada pelo convite.");

      const { error: roleError } = await admin.rpc("set_team_user_role", {
        _user_id: invitation.user.id,
        _role: body.role,
      });

      if (roleError) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(invitation.user.id);
        if (cleanupError) {
          throw new Error(
            `O convite foi criado, mas não foi possível configurar o perfil (${roleError.message}) nem remover a conta incompleta (${cleanupError.message}).`,
          );
        }
        throw new Error(
          `Não foi possível configurar o perfil; a conta incompleta foi removida. ${roleError.message}`,
        );
      }

      return respond(200, { success: true });
    }

    if (body.action === "change-role") {
      const userId = requiredString(body.userId, "identificador de usuário");
      assertUuid(userId);
      assertRole(body.role);
      if (userId === authData.user.id && body.role !== "admin") {
        return respond(400, {
          error: "Você não pode remover seu próprio acesso de administrador.",
        });
      }

      const { data: currentRole, error: currentRoleError } = await admin
        .from("user_roles")
        .select("role, is_active")
        .eq("user_id", userId)
        .maybeSingle();
      if (currentRoleError) {
        throw new Error(`Não foi possível consultar o perfil: ${currentRoleError.message}`);
      }
      if (!currentRole) return respond(404, { error: "Usuário da equipe não encontrado." });

      if (currentRole.role === "admin" && body.role !== "admin" && currentRole.is_active) {
        const { count, error } = await admin
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "admin")
          .eq("is_active", true);
        if (error) {
          throw new Error(`Não foi possível verificar os administradores: ${error.message}`);
        }
        if ((count ?? 0) <= 1) {
          return respond(409, { error: "Não é possível remover o último administrador ativo." });
        }
      }

      const { error } = await admin.rpc("set_team_user_role", {
        _user_id: userId,
        _role: body.role,
      });
      if (error) throw new Error(`Não foi possível alterar o perfil: ${error.message}`);
      return respond(200, { success: true });
    }

    if (body.action === "set-active") {
      const userId = requiredString(body.userId, "identificador de usuário");
      assertUuid(userId);
      if (typeof body.active !== "boolean") {
        return respond(400, { error: "Estado de acesso inválido." });
      }
      if (userId === authData.user.id) {
        return respond(400, { error: "Você não pode desativar sua própria conta." });
      }

      const { data: currentRole, error: currentRoleError } = await admin
        .from("user_roles")
        .select("role, is_active")
        .eq("user_id", userId)
        .maybeSingle();
      if (currentRoleError) {
        throw new Error(`Não foi possível consultar o perfil: ${currentRoleError.message}`);
      }
      if (!currentRole) return respond(404, { error: "Usuário da equipe não encontrado." });
      if (currentRole.is_active === body.active) return respond(200, { success: true });

      if (!body.active && currentRole.role === "admin") {
        const { count, error } = await admin
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "admin")
          .eq("is_active", true);
        if (error) {
          throw new Error(`Não foi possível verificar os administradores: ${error.message}`);
        }
        if ((count ?? 0) <= 1) {
          return respond(409, { error: "Não é possível desativar o último administrador ativo." });
        }
      }

      if (body.active) {
        const { error: unbanError } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (unbanError) {
          throw new Error(`Não foi possível reativar a conta: ${unbanError.message}`);
        }

        const { error } = await admin.rpc("set_team_user_active", {
          _user_id: userId,
          _active: true,
        });
        if (error) {
          throw new Error(
            `A conta foi desbloqueada, mas o acesso não foi reativado: ${error.message}`,
          );
        }
      } else {
        const { error } = await admin.rpc("set_team_user_active", {
          _user_id: userId,
          _active: false,
        });
        if (error) throw new Error(`Não foi possível desativar o acesso: ${error.message}`);

        const { error: banError } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: "876000h",
        });
        if (banError) {
          throw new Error(
            `O acesso ao painel foi revogado, mas o login também não pôde ser bloqueado: ${banError.message}`,
          );
        }
      }

      return respond(200, { success: true });
    }

    return respond(400, { error: "Ação de gerenciamento desconhecida." });
  } catch (error) {
    console.error("manage-team-users failed:", error);
    if (error instanceof RequestValidationError) {
      return respond(400, { error: error.message });
    }
    return respond(500, { error: errorMessage(error) });
  }
});
