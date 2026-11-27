import {
  formatAssessmentScore,
  type Assessment,
  type AssessmentAnswer,
  type AssessmentScore,
} from "./assessments";
import { CONFIG } from "@/config";

export async function downloadPdf(
  name: string,
  assessment: Assessment,
  answers: AssessmentAnswer[],
  result: AssessmentScore,
  participantData: Record<string, string>,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(doc.splitTextToSize(assessment.title, 180), 15, y);
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(CONFIG.clinicName, 15, y);
  y += 10;
  doc.setFontSize(11);
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 15, y);
  y += 6;
  doc.text(`${assessment.participant_name_label}: ${name || "Não informado"}`, 15, y);
  y += 6;
  assessment.participant_fields.forEach((field) => {
    const value = participantData[field.id]?.trim();
    if (!value) return;
    const lines = doc.splitTextToSize(`${field.label}: ${value}`, 180);
    if (y + lines.length * 5 > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, 15, y);
    y += lines.length * 5;
  });
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.text(
    `${assessment.scoring.resultLabel || "Pontuação"}: ${formatAssessmentScore(result.score)} / 100 — ${result.band.label}`,
    15,
    y,
  );
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const resultLines = doc.splitTextToSize(result.band.description, 180);
  doc.text(resultLines, 15, y);
  y += resultLines.length * 5 + 6;
  if (Object.keys(result.breakdown).length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Escores por domínio", 15, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    Object.entries(result.breakdown).forEach(([category, score]) => {
      const lines = doc.splitTextToSize(`${category}: ${formatAssessmentScore(score)}/100`, 180);
      if (y + lines.length * 5 > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, 15, y);
      y += lines.length * 5;
    });
    y += 4;
  }
  answers.forEach((answer, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${answer.title}: ${answer.question}`, 180);
    if (y + lines.length * 5 + 18 > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, 15, y);
    y += lines.length * 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Resposta: ${answer.answer} (${answer.value})`, 15, y);
    y += 8;
    doc.setFont("helvetica", "normal");
  });
  doc.setFontSize(8);
  const disclaimer = doc.splitTextToSize(
    "Este questionário é uma ferramenta de triagem inicial e não substitui uma avaliação profissional.",
    180,
  );
  if (y + disclaimer.length * 4 > 285) {
    doc.addPage();
    y = 20;
  }
  doc.text(disclaimer, 15, y);
  doc.save(`${assessment.slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
