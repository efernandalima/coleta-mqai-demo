// Relatório de análises em PDF, com cabeçalho neutro da demo (usa o global jspdf).
import { MESES, MESES_EXTENSO, RELATORIO, AVISO_DEMO } from "./config.js";
import { dataBR } from "./util.js";
import { sistemaDaLinha, aldeiaTemVariosSistemas } from "./sistemas.js";
import { pontoColetado } from "./etapas.js";
import { carregarJsPDF } from "./bibliotecas.js";

export function nomeDoRelatorio(coleta) {
  const s = sistemaDaLinha(coleta.linha);
  const mes = MESES_EXTENSO[MESES.indexOf(coleta.mes)] || coleta.mes;
  return `${mes} - ${s.aldeia.trim()}${aldeiaTemVariosSistemas(s) ? " " + s.sistema : ""} (demo).pdf`;
}
export const nomeDoRelatorioMensal = (mes, ano) => `Relatório MQAI (demo) - ${MESES_EXTENSO[MESES.indexOf(mes)]} ${ano}.pdf`;

// Valores com ponto decimal (coletas antigas digitadas com vírgula também saem com ponto)
const mostrar = (v) => { v = String(v ?? "").trim().replace(/,/g, "."); return v === "" ? "—" : v; };

// Medidas em mm (A4).
const M = { esq: 30, dir: 180, alturaLinha: 5.6, limitePagina: 270, colunas: [30, 57.9, 79.6, 94.3, 120.5, 156, 180] };

// Cabeçalho neutro da demo, desenhado em vetor e texto (sem imagens):
// faixa escura no topo de todas as páginas com o aviso de demonstração.
function cabecalho(doc, continuacao) {
  doc.setFillColor(7, 29, 65);
  doc.rect(0, 0, 210, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(AVISO_DEMO, 105, 9, { align: "center" });
  doc.setTextColor(0, 0, 0);
  if (continuacao) return 30;
  doc.setFont("times", "bold"); doc.setFontSize(13);
  RELATORIO.cabecalho.forEach((t, i) => doc.text(t, 105, 27 + i * 5.5, { align: "center" }));
  doc.setDrawColor(7, 29, 65); doc.setLineWidth(0.5);
  doc.line(M.esq, 43, M.dir, 43);
  doc.setDrawColor(0, 0, 0);
  return 56;
}

function paginaDaColeta(doc, c) {
  const s = sistemaDaLinha(c.linha);
  const L = M.esq, W = M.dir - M.esq;
  let y = cabecalho(doc, false);
  const quebra = (precisa) => { if (y + precisa > M.limitePagina) { doc.addPage(); y = cabecalho(doc, true); } };

  // Responsável
  doc.setFont("times", "bold"); doc.setFontSize(11);
  const rotulo = "Responsáveis técnicos pelas análises:";
  doc.text(rotulo, L, y);
  const lw = doc.getTextWidth(rotulo);
  doc.setFont("times", "normal");
  doc.text(doc.splitTextToSize(c.responsavel || "—", W - lw - 3)[0], L + lw + 2.2, y);
  y += 15;

  // Aldeia (com marcador e sublinhado)
  doc.setFontSize(12); doc.circle(L + 0.6, y - 1.3, 0.55, "F");
  const nome = `${s.aldeia.trim()}${aldeiaTemVariosSistemas(s) ? ` (${s.sistema})` : ""}`;
  doc.text(nome, L + 12, y);
  doc.setLineWidth(0.25); doc.line(L + 12, y + 0.8, L + 12 + doc.getTextWidth(nome), y + 0.8);
  doc.text(":", L + 12 + doc.getTextWidth(nome) + 0.3, y);
  y += 13;

  // Datas
  doc.setFontSize(11);
  let x = L;
  const trecho = (t, negrito) => {
    doc.setFont("times", negrito ? "bold" : "normal");
    doc.text(t.trim(), x, y); x += doc.getTextWidth(t.trim()) + (t.endsWith(" ") ? 1.6 : 0);
  };
  trecho("DATA DA COLETA: ", true); trecho(dataBR(c.dataColeta) + " ", false);
  trecho("DATA DA ANÁLISE: ", true); trecho(dataBR(c.dataAnalise) + (c.dataAnalise2 ? " e " + dataBR(c.dataAnalise2) : ""), false);
  y += 6;
  doc.setFont("times", "bold"); doc.text("ANÁLISES FÍSICO-QUÍMICAS E MICROBIOLÓGICAS:", L, y);
  y += 3.5;

  // Tabela: por ponto, uma faixa de título + linha de rótulos + linha de valores
  const H = M.alturaLinha, col = M.colunas;
  doc.setFontSize(10.5); doc.setLineWidth(0.2);
    // Só os pontos coletados (pode ser 1 só, ex.: aldeia sem água no dia). O número do ponto é mantido.
  c.pontos.forEach((p, i) => {
    if (!pontoColetado(p)) return;
    quebra(3 * H);
    const titulo = `Ponto ${i + 1} – ${p.coord ? `Coordenadas (${p.coord})` : p.identificacao || ""}`;
    doc.setFont("times", "normal");
    doc.rect(L, y, W, H); doc.text(titulo, L + W / 2, y + 4, { align: "center" }); y += H;
    const valores = [p.cloro, p.turb, p.ph, p.cor, p.colTotais, p.eColi].map(mostrar);
    [RELATORIO.colunasTabela, valores].forEach((linha) => {
      linha.forEach((t, j) => { doc.rect(col[j], y, col[j + 1] - col[j], H); doc.text(String(t), col[j] + 1.8, y + 4.1); });
      y += H;
    });
  });

  // Notas de referência
  y += 7; doc.setFont("times", "normal"); doc.setFontSize(10);
  RELATORIO.notas.forEach((n) => { quebra(4); doc.text(n, L, y); y += 4; });

  // Justificativa e observações (só quando preenchidas)
  const extras = [
    c.justificativa ? "Justificativa / ações tomadas: " + c.justificativa : null,
    c.observacoes ? "Observações: " + c.observacoes : null,
  ].filter(Boolean);
  if (extras.length) {
    y += 4; doc.setFontSize(10.5);
    extras.forEach((t) => { doc.splitTextToSize(t, W).forEach((l) => { quebra(4.6); doc.text(l, L, y); y += 4.6; }); y += 1.5; });
  }
}

/** Gera um PDF com uma página (ou mais) por coleta. Devolve um Blob. */
export async function gerarRelatorioPDF(coletas) {
  await carregarJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  coletas.forEach((c, i) => { if (i > 0) doc.addPage(); paginaDaColeta(doc, c); });
  return doc.output("blob");
}
