export const QUESTIONS = [
  ["Dificuldade para finalizar detalhes", "Com que frequência você tem dificuldade para concluir os detalhes finais de um projeto depois que as partes mais desafiadoras ou interessantes já foram feitas?"],
  ["Organização de tarefas", "Com que frequência você tem dificuldade para colocar as coisas em ordem quando precisa realizar uma tarefa que exige planejamento?"],
  ["Esquecimentos no dia a dia", "Com que frequência você tem problemas para se lembrar de compromissos, prazos ou obrigações?"],
  ["Procrastinação em tarefas complexas", "Quando precisa fazer algo que exige muita concentração mental, com que frequência você evita ou adia o início?"],
  ["Inquietação física", "Com que frequência você fica mexendo as mãos, os pés ou se contorcendo na cadeira quando precisa permanecer sentado por muito tempo?"],
  ["Sensação de \"motor ligado\"", "Com que frequência você se sente excessivamente ativo e compelido a fazer coisas, como se estivesse \"movido a motor\" ou com dificuldade para relaxar?"],
  ["Distração com estímulos externos", "Com que frequência você se distrai facilmente com barulhos, conversas ou atividades ao seu redor enquanto tenta focar no trabalho ou nos estudos?"],
  ["Perda de objetos", "Com que frequência você perde ou tem dificuldade para encontrar objetos necessários no dia a dia (chaves, celular, carteira, documentos)?"],
  ["Impulsividade na fala", "Com que frequência você termina as frases das pessoas antes que elas terminem de falar ou interrompe conversas sem perceber?"],
  ["Gestão do tempo e espera", "Com que frequência você tem dificuldade para esperar a sua vez em filas, reuniões ou situações que exigem paciência, ou subestima constantemente o tempo necessário para realizar tarefas?"],
].map(([title, text]) => ({ title: title!, text: text! }));

export const OPTIONS = ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Muito frequentemente"];

export function getResult(score: number) {
  if (score <= 14)
    return { level: "Baixos indicativos", text: "As dificuldades relatadas estão dentro da variação comum do dia a dia, podendo estar ligadas a estresse pontual, cansaço ou sobrecarga." };
  if (score <= 26)
    return { level: "Indicativos moderados", text: "Existem sinais relevantes que podem estar impactando sua rotina. Vale a pena observar se esses comportamentos ocorrem em mais de um ambiente (trabalho, casa, relacionamentos) e se existem desde a infância ou adolescência." };
  return { level: "Altos indicativos", text: "Há uma presença frequente de sintomas compatíveis com o TDAH adulto. É altamente recomendável buscar uma avaliação profissional." };
}

export const INATTENTION_IDX = [0, 1, 2, 3, 6, 7];
export const HYPER_IDX = [4, 5, 8, 9];
export type Risk = "baixo" | "moderado" | "alto";
export const RISK_LABEL: Record<Risk, string> = { baixo: "Baixo", moderado: "Moderado", alto: "Alto" };

export function riskOf(score: number): Risk {
  return score <= 14 ? "baixo" : score <= 26 ? "moderado" : "alto";
}

export function scoreAnswers(answers: number[]) {
  const sum = (idx: number[]) => idx.reduce((a, i) => a + (answers[i] ?? 0), 0);
  const total = answers.reduce((a, b) => a + b, 0);
  return { total, inattention: sum(INATTENTION_IDX), hyperactivity: sum(HYPER_IDX), risk: riskOf(total) };
}

export type StoredAnswer = { question: string; title: string; answer: string; value: number };
export function buildAnswers(answers: number[]): StoredAnswer[] {
  return QUESTIONS.map((q, i) => ({ question: q.text, title: q.title, answer: OPTIONS[answers[i] ?? 0]!, value: answers[i] ?? 0 }));
}

export const CRM_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "em_contato", label: "Em contato" },
  { value: "agendado", label: "Agendado" },
  { value: "avaliado", label: "Avaliado" },
  { value: "arquivado", label: "Arquivado" },
] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number]["value"];
