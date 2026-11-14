// Tela "Painel": situação das aldeias no mês, pelas coletas salvas neste aparelho
// (pendente, aguardando análise, analisada, na planilha).
import { MESES, MESES_EXTENSO } from "../config.js";
import { $, $$, esc } from "../util.js";
import { listarSistemas } from "../sistemas.js";
import * as repo from "../storage.js";
import { situacaoDoMes, contarEtapas, agruparPorPolo, filtrarSituacao } from "../painel.js";
import { emitir, ouvir } from "../eventos.js";

// Texto e cor de cada etapa
const ETAPA = {
  pendente: ["Pendente", "neutro"],
  coletada: ["Aguardando análise", "warn"],
  analisada: ["Analisada", "neu"],
  enviada: ["Analisada · na planilha", "ok"],
};

let filtro = "todas";

// Botão de cada linha, conforme a etapa
function acao(x) {
  if (x.etapa === "pendente") return `<button class="btn ghost sm" data-act="coletar" data-linha="${x.sistema.linha}">Coletar</button>`;
  if (x.etapa === "coletada") return `<button class="btn sm" data-act="analisar" data-id="${esc(x.coleta.id)}">Registrar análise</button>`;
  if (x.etapa === "analisada") return `<button class="btn sm" data-act="enviar">Exportar</button>`;
  return "";
}

// Texto pequeno embaixo do nome
function detalhe(x) {
  return esc(ETAPA[x.etapa][0]) +
    (x.foraDoPadrao ? " · <em>fora do padrão</em>" : "") +
    (x.quantidade > 1 ? ` · ${x.quantidade} coletas no mês` : "");
}

function linha(x) {
  const classe = ETAPA[x.etapa][1];
  return `<li class="pn-item" data-etapa="${x.etapa}">
    <span class="pn-ponto ${classe}" aria-hidden="true"></span>
    <div class="pn-nome">
      <b>${esc(x.sistema.aldeia.trim())}</b> <span>${esc(x.sistema.sistema)}</span>
      <small>${detalhe(x)}</small>
    </div>
    ${acao(x)}
  </li>`;
}

function resumoAparelho(n) {
  return `
    <div class="pn-num"><b>${n.pendente}</b><span>Pendentes</span></div>
    <div class="pn-num"><b>${n.coletada}</b><span>Aguardando análise</span></div>
    <div class="pn-num"><b>${n.analisadas}</b><span>Analisadas</span>${n.aEnviar ? `<small>${n.aEnviar} a exportar</small>` : ""}</div>
    <div class="pn-num"><b>${n.enviada}</b><span>Na planilha</span></div>`;
}

function renderizar() {
  const mes = $("#pnMes").value;
  const situacao = situacaoDoMes(listarSistemas(), repo.listarColetas(), mes);

  const n = contarEtapas(situacao);
  const pct = n.total ? Math.round((n.enviada / n.total) * 100) : 0;
  $("#pnResumo").innerHTML = resumoAparelho(n);
  $("#pnBarra").style.setProperty("--pct", pct + "%");
  $("#pnBarraTxt").textContent = `${n.enviada} de ${n.total} sistemas na planilha (${pct}%)` +
    (n.foraDoPadrao ? ` · ${n.foraDoPadrao} fora do padrão` : "");

  const visiveis = filtrarSituacao(situacao, filtro);
  $("#pnLista").innerHTML = visiveis.length
    ? agruparPorPolo(visiveis).map((g) => {
        const total = situacao.filter((x) => (x.sistema.polo || "").trim() === g.polo);
        const feitos = total.filter((x) => x.etapa === "enviada").length;
        return `<section class="pn-polo"><h3>${esc(g.polo)} <small>${feitos}/${total.length} na planilha</small></h3>
          <ul>${g.itens.map(linha).join("")}</ul></section>`;
      }).join("")
    : `<div class="alert info">Nenhum sistema nesta situação em ${esc(MESES_EXTENSO[MESES.indexOf(mes)])}.</div>`;
}

export function iniciarPainel() {
  const atual = MESES[new Date().getMonth()];
  $("#pnMes").innerHTML = MESES.map((m, i) => `<option value="${m}" ${m === atual ? "selected" : ""}>${MESES_EXTENSO[i]}</option>`).join("");
  $("#pnMes").addEventListener("change", renderizar);

  $("#pnFiltro").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    filtro = b.dataset.f;
    $$("#pnFiltro button").forEach((x) => x.classList.toggle("on", x === b));
    renderizar();
  });

  $("#pnLista").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    if (b.dataset.act === "coletar") emitir("coletar-aldeia", { linha: Number(b.dataset.linha), mes: $("#pnMes").value });
    if (b.dataset.act === "analisar") emitir("editar-coleta", repo.buscarColeta(b.dataset.id));
    if (b.dataset.act === "enviar") emitir("mostrar-tela", "exportar");
  });

  ouvir("tela-aberta", (t) => { if (t === "painel") renderizar(); });
  ouvir("coletas-alteradas", () => { if (!$("#view-painel").hidden) renderizar(); });
}