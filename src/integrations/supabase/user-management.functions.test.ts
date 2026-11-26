import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("./client", () => ({
  supabase: { functions: { invoke } },
}));

import { listTeamUsers } from "./user-management.functions";

const teamUser = {
  id: "c9631de4-e490-4b3b-b712-e729b12ea145",
  email: "equipe@example.com",
  role: "equipe",
  active: true,
  emailConfirmed: true,
  createdAt: "2026-11-26T00:00:00.000Z",
};

describe("listTeamUsers", () => {
  beforeEach(() => invoke.mockReset());

  it("accepts a direct array response", async () => {
    invoke.mockResolvedValue({ data: [teamUser], error: null });

    await expect(listTeamUsers()).resolves.toEqual([teamUser]);
  });

  it("accepts an object containing a users array", async () => {
    invoke.mockResolvedValue({ data: { users: [teamUser] }, error: null });

    await expect(listTeamUsers()).resolves.toEqual([teamUser]);
  });

  it("reports an unexpected response instead of crashing the route", async () => {
    invoke.mockResolvedValue({ data: { status: "ok" }, error: null });

    await expect(listTeamUsers()).rejects.toThrow(
      "A função retornou uma resposta inválida ao listar usuários.",
    );
  });
});
