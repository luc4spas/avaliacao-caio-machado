import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Info, ShieldCheck } from "lucide-react";
import { listPublishedAssessments } from "@/integrations/supabase/assessments.functions";
import { CONFIG } from "@/config";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Avaliações | Caio Machado" },
      { name: "description", content: "Escolha uma avaliação para iniciar." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: AssessmentCatalog,
});

function AssessmentCatalog() {
  const assessments = useQuery({
    queryKey: ["published-assessments"],
    queryFn: listPublishedAssessments,
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8">
      <header className="mb-10 flex justify-center">
        <div className="rounded-2xl bg-brand-navy px-4 py-2 shadow-soft">
          <img src={CONFIG.logoUrl} alt={CONFIG.clinicName} className="h-12 w-auto" />
        </div>
      </header>
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
            Avaliações
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Selecione um questionário para começar. Cada avaliação apresenta seu próprio resultado.
          </p>
        </div>

        {assessments.isLoading ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
            Carregando avaliações…
          </p>
        ) : assessments.error ? (
          <p
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-center text-destructive"
          >
            Não foi possível carregar as avaliações. Tente novamente mais tarde.
          </p>
        ) : assessments.data?.length ? (
          <div className="grid gap-4">
            {assessments.data.map((assessment) => (
              <Link
                key={assessment.id}
                to="/avaliacoes/$slug"
                params={{ slug: assessment.slug }}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary"
              >
                <span>
                  <span className="block text-lg font-bold">{assessment.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {assessment.description || `${assessment.questions.length} perguntas`}
                  </span>
                </span>
                <ArrowRight className="size-5 shrink-0 text-primary transition group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
            Nenhuma avaliação disponível no momento.
          </p>
        )}

        <div className="flex gap-3 rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
          <Info className="size-5 shrink-0" />
          As avaliações são ferramentas de triagem e não substituem uma avaliação profissional.
        </div>
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          Seus dados são tratados com sigilo.
        </p>
      </section>
    </main>
  );
}
