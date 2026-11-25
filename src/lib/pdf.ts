import { QUESTIONS, OPTIONS, getResult } from "./quiz";
import { CONFIG } from "@/config";

export async function downloadPdf(name: string, answers: number[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const score = answers.reduce((a, b) => a + b, 0);
  const r = getResult(score);
  let y = 20;
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("Triagem de Indicativos de TDAH Adulto", 15, y); y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(CONFIG.clinicName, 15, y); y += 10;
  doc.setFontSize(11);
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 15, y); y += 6;
  doc.text(`Nome: ${name || "Não informado"}`, 15, y); y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Pontuação: ${score} / 40 — ${r.level}`, 15, y); y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const t = doc.splitTextToSize(r.text, 180); doc.text(t, 15, y); y += t.length * 5 + 6;
  QUESTIONS.forEach((q, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${q.title}: ${q.text}`, 180);
    doc.text(lines, 15, y); y += lines.length * 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Resposta: ${OPTIONS[answers[i] ?? 0]} (${answers[i] ?? 0})`, 15, y); y += 8;
    doc.setFont("helvetica", "normal");
  });
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize("Este questionário é uma ferramenta de triagem inicial e não substitui um diagnóstico médico ou psicológico.", 180), 15, 285);
  doc.save(`triagem-tdah-${new Date().toISOString().slice(0, 10)}.pdf`);
}
