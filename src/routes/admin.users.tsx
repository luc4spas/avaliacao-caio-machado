import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MailPlus, Search, ShieldCheck, UserRound, UserRoundX } from "lucide-react";
import {
  changeTeamUserRole,
  inviteTeamUser,
  listTeamUsers,
  setTeamUserActive,
} from "@/integrations/supabase/user-management.functions";

type TeamRole = "admin" | "equipe";
type Feedback = { kind: "success" | "error"; message: string };
const control =
  "h-11 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export const Route = createFileRoute("/admin/users")({ component: TeamUsers });

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

function TeamUsers() {
  const { role, user } = useRouteContext({ from: "/admin" });
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("equipe");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const usersQuery = useQuery({
    queryKey: ["team-users"],
    queryFn: () => listTeamUsers(),
    enabled: role === "admin" && typeof window !== "undefined",
  });

  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ["team-users"] });
  const invite = useMutation({
    mutationFn: (data: { email: string; role: TeamRole }) => inviteTeamUser(data),
    onSuccess: async () => {
      setEmail("");
      setFeedback({ kind: "success", message: "Convite enviado por e-mail." });
      await refreshUsers();
    },
    onError: (error) => setFeedback({ kind: "error", message: getErrorMessage(error) }),
  });
  const changeRole = useMutation({
    mutationFn: (data: { userId: string; role: TeamRole }) => changeTeamUserRole(data),
    onSuccess: async () => {
      setFeedback({ kind: "success", message: "Permissão atualizada." });
      await refreshUsers();
    },
    onError: (error) => setFeedback({ kind: "error", message: getErrorMessage(error) }),
  });
  const changeActive = useMutation({
    mutationFn: (data: { userId: string; active: boolean }) => setTeamUserActive(data),
    onSuccess: async (_, variables) => {
      setFeedback({
        kind: "success",
        message: variables.active ? "Acesso reativado." : "Acesso desativado.",
      });
      await refreshUsers();
    },
    onError: async (error) => {
      setFeedback({ kind: "error", message: getErrorMessage(error) });
      await refreshUsers();
    },
  });

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (usersQuery.data ?? []).filter((teamUser) =>
      teamUser.email.toLowerCase().includes(query),
    );
  }, [usersQuery.data, search]);
  const isBusy = invite.isPending || changeRole.isPending || changeActive.isPending;

  const submitInvite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    invite.mutate({ email, role: newRole });
  };

  const updateRole = (userId: string, value: string) => {
    if (value !== "admin" && value !== "equipe") return;
    if (value === "admin" && !window.confirm("Conceder acesso de administrador a esta conta?"))
      return;
    setFeedback(null);
    changeRole.mutate({ userId, role: value });
  };

  const toggleActive = (teamUser: NonNullable<typeof usersQuery.data>[number]) => {
    const active = !teamUser.active;
    const action = active ? "reativar" : "desativar";
    if (!window.confirm(`Deseja ${action} o acesso de ${teamUser.email}?`)) return;
    setFeedback(null);
    changeActive.mutate({ userId: teamUser.id, active });
  };

  if (role !== "admin") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-bold">Acesso restrito</h1>
        <p className="mt-1 text-muted-foreground">
          Somente administradores podem gerenciar usuários.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Usuários da equipe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Convide membros da equipe e controle o acesso ao painel clínico.
        </p>
      </header>

      <form
        onSubmit={submitInvite}
        className="grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft md:grid-cols-[minmax(0,1fr)_180px_auto]"
      >
        <label className="sr-only" htmlFor="team-user-email">
          E-mail do novo usuário
        </label>
        <input
          id="team-user-email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="E-mail do novo usuário"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={`${control} w-full`}
        />
        <label className="sr-only" htmlFor="team-user-role">
          Perfil do novo usuário
        </label>
        <select
          id="team-user-role"
          value={newRole}
          onChange={(event) => setNewRole(event.target.value === "admin" ? "admin" : "equipe")}
          className={control}
        >
          <option value="equipe">Equipe</option>
          <option value="admin">Administrador</option>
        </select>
        <button
          type="submit"
          disabled={isBusy}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60"
        >
          <MailPlus className="size-4" />
          {invite.isPending ? "Enviando…" : "Enviar convite"}
        </button>
      </form>

      <p className="flex items-start gap-2 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Administradores gerenciam usuários e têm acesso completo. A equipe pode consultar o CRM e
        atualizar status e anotações.
      </p>

      {feedback && (
        <p
          role="status"
          className={`rounded-xl border p-3 text-sm ${
            feedback.kind === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border bg-card text-foreground"
          }`}
        >
          {feedback.message}
        </p>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
        <label className="sr-only" htmlFor="team-user-search">
          Buscar por e-mail
        </label>
        <input
          id="team-user-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por e-mail"
          className={`${control} w-full pl-9`}
        />
      </div>

      {usersQuery.isLoading ? (
        <p className="text-muted-foreground">Carregando usuários…</p>
      ) : usersQuery.error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {getErrorMessage(usersQuery.error)}
        </p>
      ) : filteredUsers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {usersQuery.data?.length
            ? "Nenhum usuário corresponde à busca."
            : "Nenhum usuário da equipe encontrado."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="hidden grid-cols-[minmax(0,1fr)_170px_170px_130px] gap-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Conta</span>
            <span>Perfil</span>
            <span>Status</span>
            <span>Acesso</span>
          </div>
          {filteredUsers.map((teamUser) => {
            const isSelf = teamUser.id === user.id;
            const status = !teamUser.active
              ? "Desativado"
              : teamUser.emailConfirmed
                ? "Ativo"
                : "Convite pendente";
            return (
              <div
                key={teamUser.id}
                className="grid gap-3 border-b border-border p-4 last:border-0 md:grid-cols-[minmax(0,1fr)_170px_170px_130px] md:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                    <UserRound className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{teamUser.email || "Conta sem e-mail"}</p>
                    <p className="text-xs text-muted-foreground">
                      {isSelf
                        ? "Sua conta"
                        : `Criada em ${new Date(teamUser.createdAt).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground md:block">
                  <span className="md:hidden">Perfil:</span>
                  <select
                    aria-label={`Perfil de ${teamUser.email}`}
                    value={teamUser.role}
                    disabled={isBusy || isSelf}
                    onChange={(event) => updateRole(teamUser.id, event.target.value)}
                    className={`${control} w-full disabled:opacity-60`}
                  >
                    <option value="equipe">Equipe</option>
                    <option value="admin">Administrador</option>
                  </select>
                </label>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="md:hidden">Status:</span>
                  <span
                    className={`size-2 rounded-full ${teamUser.active ? "bg-emerald-500" : "bg-muted-foreground"}`}
                  />
                  {status}
                </p>
                <button
                  type="button"
                  disabled={isBusy || isSelf}
                  onClick={() => toggleActive(teamUser)}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                >
                  {teamUser.active ? (
                    <UserRoundX className="size-4" />
                  ) : (
                    <UserRound className="size-4" />
                  )}
                  {teamUser.active ? "Desativar" : "Reativar"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
