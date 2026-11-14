// Regras das etapas da coleta. Módulo puro: roda no navegador e nos testes (Node).
//
//   🟡 coletada  → salva em campo (data da coleta = dia de hoje, resultados opcionais)
//   🔵 analisada → "Concluir análise" conferiu tudo; pode ir para a planilha e gerar PDF
//   🟢 enviada   → analisada e já gravada na planilha (exportadoEm preenchido)
import { PONTOS_ESSENCIAIS, PRAZO_ANALISE_DIAS, PARAMETROS } from "./config.js";
import { ehCaptacao, foraDoPadrao, errosDeDigitacao } from "./validacao.js";

const vazio = (v) => String(v ?? "").trim() === "";

/** Data de hoje no formato do campo de data (aaaa-mm-dd), no fuso do aparelho. */
export function hojeISO(d = new Date()) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function somarDias(iso, dias) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return hojeISO(d);
}

export const diasEntre = (de, ate) => Math.round((Date.parse(ate + "T12:00:00") - Date.parse(de + "T12:00:00")) / 864e5);

/**
 * O ponto foi coletado? (tem coordenada ou algum resultado).
 * Identificação e tipo não contam: vêm preenchidos do cadastro da aldeia.
 */
export const pontoColetado = (p) =>
  ["coord", "ph", "cor", "turb", "cloro", "colTotais", "eColi"].some((k) => !vazio(p?.[k]));

/** "coletada" | "analisada" | "enviada" */
export function etapaDaColeta(c) {
  if (c.status !== "analisada") return "coletada";
  return c.exportadoEm ? "enviada" : "analisada";
}

export const podeEnviar = (c) => c.status === "analisada";

/** O que falta para concluir a análise. Lista vazia = pode concluir. */
export function pendenciasDaAnalise(c, hoje = hojeISO()) {
  const out = [];
  if (!c.dataAnalise) out.push("Data da análise");
  else {
    if (c.dataColeta && c.dataAnalise < c.dataColeta) out.push("A data da análise não pode ser antes da coleta");
    if (c.dataAnalise > hoje) out.push("A data da análise não pode ser no futuro");
  }
  if (vazio(c.responsavel)) out.push("Responsável técnico pela análise");

  // Nem sempre dá para coletar todos os pontos (ex.: aldeia sem água no dia).
  // Basta 1 ponto; cada ponto coletado precisa estar completo; ponto em branco é ignorado.
  const coletados = c.pontos.map((p, i) => ({ p, i })).filter(({ p }) => pontoColetado(p));
  if (!coletados.length) out.push("Resultado de pelo menos um ponto");
  coletados.forEach(({ p, i }) => {
    const falta = [];
    if (vazio(p.tipo)) falta.push("tipo do ponto");
    for (const [k, rotulo] of PARAMETROS) {
      if (k === "cloro" && ehCaptacao(p.tipo)) continue; // cloro não é exigido na captação
      if (vazio(p[k])) falta.push(rotulo);
    }
    if (vazio(p.colTotais)) falta.push("coliformes totais");
    if (vazio(p.eColi)) falta.push("E. coli");
    if (falta.length) out.push(`Ponto ${i + 1}: ${falta.join(", ")}`);
  });
  const essenciais = coletados.filter(({ i }) => i < PONTOS_ESSENCIAIS).length;
  if (coletados.length && essenciais < PONTOS_ESSENCIAIS && vazio(c.observacoes)) {
    out.push("Observações: motivo de não coletar todos os pontos (ex.: aldeia sem água no dia)");
  }

  // Valores impossíveis e coordenadas erradas precisam ser corrigidos antes de concluir.
  errosDeDigitacao(c).forEach((e) => out.push("Corrigir " + e));

  if (foraDoPadrao(c).length && vazio(c.justificativa)) out.push("Justificativa (há resultado fora do padrão)");
  return out;
}

/** Avisos que não impedem concluir (ex.: análise feita muito depois da coleta). */
export function alertasDaAnalise(c) {
  const out = [];
  if (c.dataColeta && c.dataAnalise) {
    const dias = diasEntre(c.dataColeta, c.dataAnalise);
    if (dias > PRAZO_ANALISE_DIAS) {
      out.push(`Análise ${dias} dias após a coleta (o prazo usual é o dia seguinte). Confira o prazo da análise microbiológica.`);    }
  }
  return out;
}