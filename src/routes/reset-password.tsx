import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Nova senha | Caio Machado" },
    { name: "description", content: "Defina uma nova senha de acesso." },
    { property: "og:title", content: "Nova senha | Caio Machado" },
    { property: "og:description", content: "Defina uma nova senha de acesso." },
    { name: "robots", content: "noindex" },
  ] }),
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [pw, setPw] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setMsg("Não foi possível salvar. Abra novamente o link do e-mail.");
    nav({ to: "/admin" });
  };
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h1 className="text-xl font-bold">Criar nova senha</h1>
        <label htmlFor="np" className="sr-only">Nova senha</label>
        <input id="np" type="password" minLength={8} required placeholder="Nova senha (mín. 8 caracteres)" value={pw} onChange={(e) => setPw(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-ring" />
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        <button className="rounded-full bg-primary py-3.5 font-bold text-primary-foreground">Salvar senha</button>
      </form>
    </main>
  );
}
