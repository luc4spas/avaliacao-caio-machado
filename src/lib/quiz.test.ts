import { describe, it, expect } from "vitest";
import { getResult } from "./quiz";
describe("faixas", () => {
  it("0-14 baixo", () => { expect(getResult(14).level).toBe("Baixos indicativos"); });
  it("15-26 moderado", () => { expect(getResult(15).level).toBe("Indicativos moderados"); expect(getResult(26).level).toBe("Indicativos moderados"); });
  it("27-40 alto", () => { expect(getResult(27).level).toBe("Altos indicativos"); });
});
import { scoreAnswers, riskOf } from "./quiz";
describe("subescalas", () => {
  it("desatenção soma perguntas 1,2,3,4,7,8", () => {
    const a = [1, 1, 1, 1, 4, 4, 1, 1, 4, 4];
    expect(scoreAnswers(a).inattention).toBe(6);
    expect(scoreAnswers(a).hyperactivity).toBe(16);
    expect(scoreAnswers(a).total).toBe(22);
  });
  it("nível salvo", () => { expect(riskOf(14)).toBe("baixo"); expect(riskOf(26)).toBe("moderado"); expect(riskOf(27)).toBe("alto"); });
});
