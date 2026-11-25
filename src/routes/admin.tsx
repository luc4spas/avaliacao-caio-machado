import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CONFIG } from "@/config";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  head: () => ({ meta: [
    { title: "Painel | Caio Machado" },
    { name: "description", content: "Painel da equipe clínica." },
    { property: "og:title", content: "Painel | Caio Machado" },
    { property: "og:description", content: "Painel da equipe clínica." },
    { name: "robots", content: "noindex" },
  ] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient(); const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const isAdmin = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => (await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })).data === true,
  });
  const signOut = async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); nav({ to: "/login", replace: true }); };
  const link = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground";
  const active = { className: "bg-secondary text-secondary-foreground" };

  const nav_ = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 rounded-2xl bg-brand-navy px-3 py-2"><img src={CONFIG.logoUrl} alt={CONFIG.clinicName} className="h-10 w-auto" /></div>
      <Link to="/admin" activeOptions={{ exact: true }} activeProps={active} className={link} onClick={() => setOpen(false)}><LayoutDashboard className="size-4" />Dashboard</Link>
      <Link to="/admin/crm" activeProps={active} className={link} onClick={() => setOpen(false)}><Users className="size-4" />CRM de Pacientes</Link>
      <div className="mt-auto border-t border-border pt-4">
        <p className="mb-2 truncate px-3 text-xs text-muted-foreground">{user.email}</p>
        <button onClick={signOut} className={link + " w-full"}><LogOut className="size-4" />Sair</button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-card lg:block">{nav_}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Fechar menu" className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-card shadow-soft">{nav_}</aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
        <button aria-label="Abrir menu" onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-xl hover:bg-muted">{open ? <X /> : <Menu />}</button>
        <span className="font-bold">Painel</span>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {isAdmin.isLoading ? <p className="text-muted-foreground">Carregando…</p>
          : isAdmin.data ? <Outlet />
          : <div className="rounded-2xl border border-border bg-card p-6"><h1 className="text-lg font-bold">Acesso não autorizado</h1><p className="mt-1 text-muted-foreground">Esta conta não tem permissão para ver o painel.</p></div>}
      </main>
    </div>
  );
}
