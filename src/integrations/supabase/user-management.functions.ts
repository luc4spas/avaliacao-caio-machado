import { supabase } from "./client";

type TeamRole = "admin" | "equipe";
type TeamUser = {
  id: string;
  email: string;
  role: TeamRole;
  active: boolean;
  emailConfirmed: boolean;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTeamUser(value: unknown): value is TeamUser {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["email"] === "string" &&
    (value["role"] === "admin" || value["role"] === "equipe") &&
    typeof value["active"] === "boolean" &&
    typeof value["emailConfirmed"] === "boolean" &&
    typeof value["createdAt"] === "string"
  );
}

type ManagementRequest =
  | { action: "list" }
  | { action: "invite"; email: string; role: TeamRole }
  | { action: "change-role"; userId: string; role: TeamRole }
  | { action: "set-active"; userId: string; active: boolean };

async function invokeUserManagement<T>(body: ManagementRequest): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("manage-team-users", { body });

  if (error) {
    const response = error.context;
    if (response instanceof Response) {
      const payload: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      if (
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
      ) {
        throw new Error(payload.error);
      }
    }

    throw new Error(error.message);
  }

  if (!data) throw new Error("A função de gerenciamento não retornou uma resposta.");
  return data;
}

export function listTeamUsers(): Promise<TeamUser[]> {
  return invokeUserManagement<unknown>({ action: "list" }).then((response) => {
    const users = Array.isArray(response)
      ? response
      : isRecord(response) && Array.isArray(response["users"])
        ? response["users"]
        : null;

    if (!users) {
      if (isRecord(response) && typeof response["error"] === "string") {
        throw new Error(response["error"]);
      }
      throw new Error("A função retornou uma resposta inválida ao listar usuários.");
    }

    if (!users.every(isTeamUser)) {
      throw new Error("A função retornou usuários em um formato inválido.");
    }

    return users;
  });
}

export function inviteTeamUser(input: {
  email: string;
  role: TeamRole;
}): Promise<{ success: true }> {
  return invokeUserManagement({ action: "invite", ...input });
}

export function changeTeamUserRole(input: {
  userId: string;
  role: TeamRole;
}): Promise<{ success: true }> {
  return invokeUserManagement({ action: "change-role", ...input });
}

export function setTeamUserActive(input: {
  userId: string;
  active: boolean;
}): Promise<{ success: true }> {
  return invokeUserManagement({ action: "set-active", ...input });
}
