import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CONFIG } from "@/config";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Acesso da equipe | Caio Machado" },
    { name: "description", content: "Acesso restrito ao painel da equipe clínica." },
    { property: "og:title", content: "Acesso da equipe | Caio Machado" },
    { property: "og:description", content: "Acesso restrito ao painel da equipe clínica." },
    { name: "robots", content: "noindex" },
  ] }),
  component: Login,
});

const input = "w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "reset">("login");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg("E-mail ou senha incorretos.");
      nav({ to: "/admin" });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      setMsg(error ? "Não foi possível enviar o e-mail." : "Se o e-mail tiver acesso, enviamos um link para criar uma nova senha.");
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-3 flex justify-center"><div className="rounded-2xl bg-brand-navy px-4 py-2"><img src={CONFIG.logoUrl} alt={CONFIG.clinicName} className="h-11 w-auto" /></div></div>
        <h1 className="text-center text-xl font-bold">{mode === "login" ? "Acesso da equipe" : "Recuperar senha"}</h1>
        <label className="sr-only" htmlFor="em">E-mail</label>
        <input id="em" type="email" required className={input} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === "login" && (<><label className="sr-only" htmlFor="pw">Senha</label>
        <input id="pw" type="password" required className={input} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} /></>)}
        {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
        <button disabled={busy} className="mt-1 flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />}{mode === "login" ? "Entrar" : "Enviar link"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "login" ? "reset" : "login"); setMsg(null); }} className="min-h-11 text-sm text-muted-foreground hover:text-foreground">
          {mode === "login" ? "Esqueci minha senha" : "Voltar para o login"}
        </button>
      </form>
    </main>
  );
}
