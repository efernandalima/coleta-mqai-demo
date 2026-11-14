// Tela "Exportar": planilha modelo (.xlsx), PDF do mês, resumo do mês por IA e cópia de segurança.
import { MESES, MESES_EXTENSO } from "../config.js";
import { $, esc, baixarArquivo } from "../util.js";
import { listarSistemas, sistemaDaLinha, rotuloSistema } from "../sistemas.js";
import * as repo from "../storage.js";
import { gerarRelatorioPDF, nomeDoRelatorioMensal } from "../relatorio-pdf.js";
import { gerarPlanilhaDemo, nomeDaPlanilhaDemo } from "../excel.js";
import { dadosDoResumo, pedirSugestao, AVISO_IA, AVISO_EXEMPLO } from "../ia.js";
import { podeEnviar } from "../etapas.js";
import { emitir, ouvir } from "../eventos.js";
import { aviso } from "./toast.js";

// Só coletas com a análise concluída vão para a planilha, o PDF e o resumo.
const analisadas = () => repo.listarColetas().filter(podeEnviar);
const aguardandoAnalise = () => repo.listarColetas().filter((c) => !podeEnviar(c)).length;
const selecionadas = () => ($("#filtro").value === "all" ? analisadas() : analisadas().filter((c) => !c.exportadoEm));
const avisoAguardando = () => {
  const n = aguardandoAnalise();
  return n ? `<div class="alert">${n} coleta(s) aguardando análise não entram. Conclua a análise em <b>Salvas</b>.</div>` : "";
};
const msg = (alvo, html, tipo = "") => ($(alvo).innerHTML = `<div class="alert ${tipo}">${html}</div>`);
const anoDasColetas = (coletas) => (coletas[0]?.dataColeta || "").slice(0, 4) || new Date().getFullYear();

function renderizarPrevia() {
  const coletas = selecionadas();
  if (!coletas.length) {
    $("#prev").innerHTML = `<div class="alert info">Nenhuma coleta analisada ${$("#filtro").value === "all" ? "" : "pendente "}para incluir na planilha.</div>` + avisoAguardando();
    return;
  }
  const contagem = {};
  coletas.forEach((c) => { const k = c.mes + "|" + c.linha; contagem[k] = (contagem[k] || 0) + 1; });
  const duplicadas = Object.entries(contagem).filter(([, n]) => n > 1).map(([k]) => {
    const [mes, linha] = k.split("|"); const s = sistemaDaLinha(linha); return `${s ? s.aldeia : linha} (${mes})`;
  });
  const lista = coletas.map((c) => { const s = sistemaDaLinha(c.linha); return `${s ? `${s.aldeia} ${s.sistema}` : "?"} → aba ${c.mes}, linha ${c.linha}`; });
  $("#prev").innerHTML = `<div class="alert info">${coletas.length} coleta(s) serão escritas: ${esc(lista.join("; "))}.</div>` +
    (duplicadas.length ? `<div class="alert">Mais de uma coleta no mesmo mês para: ${esc(duplicadas.join(", "))}. A planilha tem uma linha por sistema; fica valendo a coleta mais recente.</div>` : "") +
    avisoAguardando();
}

/** Preenche um seletor com os meses que têm coleta analisada (PDF e resumo por IA). */
function renderizarMeses(seletor) {
  const coletas = analisadas();
  const meses = MESES.filter((m) => coletas.some((c) => c.mes === m));
  const atual = $(seletor).value;
  $(seletor).innerHTML = meses.length
    ? meses.map((m) => `<option value="${m}">${MESES_EXTENSO[MESES.indexOf(m)]} (${coletas.filter((c) => c.mes === m).length} coleta(s))</option>`).join("")
    : `<option value="">Nenhuma coleta analisada</option>`;
  if (meses.includes(atual)) $(seletor).value = atual;
}

async function gerarPlanilha() {
  const coletas = selecionadas();
  if (!coletas.length) { msg("#xlsxMsg", "Não há coletas analisadas para incluir." + (aguardandoAnalise() ? " Conclua a análise na aba Salvas." : "")); return; }
  msg("#xlsxMsg", "Gerando a planilha…", "info");
  try {
    const ano = anoDasColetas(coletas);
    const { arquivo, registro } = await gerarPlanilhaDemo(coletas, listarSistemas(), ano);
    baixarArquivo(arquivo, nomeDaPlanilhaDemo(ano));
    repo.marcarExportadas(coletas.map((c) => c.id));
    emitir("coletas-alteradas");
    msg("#xlsxMsg", `<b>Planilha gerada com ${registro.length} coleta(s).</b><ul>${registro.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>`, "ok");
  } catch (e) { console.error(e); msg("#xlsxMsg", "Não foi possível gerar a planilha: " + esc(e.message)); }
}

async function gerarPDFdoMes() {
  const mes = $("#pdfMes").value;
  if (!mes) { msg("#pdfMsg", "Não há coletas analisadas."); return; }
  const coletas = analisadas().filter((c) => c.mes === mes)
    .sort((a, b) => a.linha - b.linha || (a.dataColeta || "").localeCompare(b.dataColeta || ""));
  try {
    baixarArquivo(await gerarRelatorioPDF(coletas), nomeDoRelatorioMensal(mes, anoDasColetas(coletas)));
    msg("#pdfMsg", `PDF gerado com ${coletas.length} coleta(s).`, "ok");
  } catch (e) { console.error(e); msg("#pdfMsg", "Não foi possível gerar o PDF: " + esc(e.message)); }
}

/**
 * Resumo do mês por IA: não conformidades por sistema e prioridades de ação.
 * Sem internet ou sem chave no servidor, mostra a resposta de exemplo, marcada como tal.
 */
async function resumirMes() {
  const mes = $("#iaMes").value;
  if (!mes) { msg("#iaResumo", "Não há coletas analisadas." + (aguardandoAnalise() ? " Conclua a análise na aba Salvas." : " Carregue os exemplos na aba Salvas.")); return; }
  const botao = $("#iaResumoBtn");
  botao.disabled = true;
  msg("#iaResumo", "Gerando o resumo…", "info");
  const dados = dadosDoResumo(mes, analisadas(), sistemaDaLinha, rotuloSistema);
  const r = await pedirSugestao("resumo", dados, { online: navigator.onLine });
  botao.disabled = false;
  $("#iaResumo").innerHTML =
    (r.origem === "ia"
      ? `<div class="alert info"><span class="chip neu">IA</span> ${esc(AVISO_IA.replace("salvar", "usar"))}</div>`
      : `<div class="alert info"><span class="chip warn">exemplo</span> ${esc(AVISO_EXEMPLO.replace("salvar", "usar"))}</div>`) +
    `<div class="ia-texto">${esc(r.texto)}</div>`;
}

function exportarCopia() {
  const blob = new Blob([JSON.stringify(repo.copiaDeSeguranca(), null, 1)], { type: "application/json" });
  baixarArquivo(blob, `coletas_mqai_${new Date().toISOString().slice(0, 10)}.json`);
}

const TAMANHO_MAX_COPIA = 5 * 1024 * 1024; // 5 MB

async function importarCopia(e) {
  const f = e.target.files[0]; if (!f) return;
  e.target.value = "";
  if (f.size > TAMANHO_MAX_COPIA) { aviso("O arquivo excede o tamanho esperado para uma cópia de segurança."); return; }
  try {
    const d = JSON.parse(await f.text());
    const { importadas, recusadas } = repo.importarColetas(Array.isArray(d) ? d : d.coletas);
    emitir("coletas-alteradas");
    aviso(`${importadas} coleta(s) importada(s)` + (recusadas ? `, ${recusadas} recusada(s) por dados inválidos` : ""));
  } catch { aviso("Arquivo de cópia de segurança inválido."); }
}

function renderizar() {
  renderizarPrevia();
  renderizarMeses("#pdfMes");
  renderizarMeses("#iaMes");
}

export function iniciarExportar() {
  $("#xlsxGerar").addEventListener("click", gerarPlanilha);
  $("#filtro").addEventListener("change", renderizarPrevia);
  $("#pdfMesBtn").addEventListener("click", gerarPDFdoMes);
  $("#iaResumoBtn").addEventListener("click", resumirMes);
  $("#bkExp").addEventListener("click", exportarCopia);
  $("#bkImp").addEventListener("change", importarCopia);
  ouvir("tela-aberta", (t) => {
    if (t !== "exportar") return;
    // Ao abrir a tela, apaga mensagens anteriores (evita aviso desatualizado).
    ["#xlsxMsg", "#pdfMsg", "#iaResumo"].forEach((id) => ($(id).innerHTML = ""));
    renderizar();
  });
  ouvir("coletas-alteradas", () => { if (!$("#view-exportar").hidden) renderizar(); });
}
