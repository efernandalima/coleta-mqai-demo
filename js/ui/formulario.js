// Tela "Nova coleta" e "Registrar análise": formulário, pontos, avaliação em tempo real e GPS.
//  - Nova coleta: data da coleta = hoje (não editável); resultados são opcionais.
//  - Registrar análise (aberta pela tela Salvas): data/responsável da análise e "Concluir análise".
import { MESES, TIPOS_PONTO, TIPOS_POR_PONTO, NOMES_PONTOS, PARAMETROS, MAX_PONTOS, PONTOS_ESSENCIAIS, GPS } from "../config.js";
import { $, $$, esc } from "../util.js";
import { avaliarParametro, valorImpossivel, avaliarCoordenada, foraDoPadrao, errosDeDigitacao, ehCaptacao } from "../validacao.js";
import { hojeISO, somarDias, pendenciasDaAnalise, alertasDaAnalise } from "../etapas.js";
import { listarSistemas, sistemaDaLinha, rotuloSistema } from "../sistemas.js";
import * as repo from "../storage.js";
import { emitir, ouvir } from "../eventos.js";
import { aviso } from "./toast.js";
import { dadosDaJustificativa, pedirSugestao, AVISO_IA, AVISO_EXEMPLO } from "../ia.js";

const CAMPOS_NUMERICOS = ["ph", "cor", "turb", "cloro"];

let pontos = [];
let idEmEdicao = null;
let modoAnalise = false; // true = "Registrar análise" de uma coleta salva

function pontoVazio(sistema, i) {
  const padrao = sistema?.pontosPadrao?.[i] || {};
  return { identificacao: padrao.identificacao || `Ponto ${i + 1}`, tipo: padrao.tipo || "", coord: "", ph: "", cor: "", turb: "", cloro: "", colTotais: "", eColi: "" };
}

const botoesMicro = (valor) =>
  [["AUSENTE", "Ausente"], ["PRESENTE", "Presente"], ["", "N/A"]]
    .map(([v, l]) => `<button type="button" data-v="${v}" class="${valor === v ? "on" : ""} ${v === "PRESENTE" ? "badv" : ""}">${l}</button>`)
    .join("");

function htmlPonto(p, i) {
  const tipos = i < PONTOS_ESSENCIAIS ? TIPOS_POR_PONTO[i] : TIPOS_PONTO;
  return `<div class="pt" data-i="${i}">
    <div class="pt-h"><strong>${esc(i < PONTOS_ESSENCIAIS ? NOMES_PONTOS[i] : "Ponto " + (i + 1))}</strong><span class="tag">${i < PONTOS_ESSENCIAIS ? "principal" : "adicional"}</span></div>
    <div class="row row-ident">
      <label>Identificação<input id="p${i}_identificacao" data-k="identificacao" value="${esc(p.identificacao)}"></label>
      <label>Tipo do ponto<select id="p${i}_tipo" data-k="tipo"><option value="">—</option>${tipos.map((t) => `<option ${t === p.tipo ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    </div>
    <label class="coord">Coordenadas<div class="gps"><input id="p${i}_coord" data-k="coord" value="${esc(p.coord)}" placeholder="-10.123456; -50.123456"><button type="button" class="btn ghost sm" data-gps="${i}">GPS</button></div><small></small></label>
    <div class="row3">
      ${PARAMETROS.map(([k, l, u]) => `<label class="num" data-num="${k}">${l}${u ? ` (${u})` : ""}<input id="p${i}_${k}" data-k="${k}" inputmode="decimal" value="${esc(p[k])}"><small></small></label>`).join("")}
    </div>
    <div class="row">
      <label>Coliformes totais<div class="seg" data-k="colTotais">${botoesMicro(p.colTotais)}</div></label>
      <label>E. coli<div class="seg" data-k="eColi">${botoesMicro(p.eColi)}</div></label>
    </div>
  </div>`;
}

function renderizarPontos() {
  $("#pts").innerHTML = pontos.map(htmlPonto).join("");
  $("#rmPt").hidden = pontos.length <= PONTOS_ESSENCIAIS;
  $("#addPt").hidden = pontos.length >= MAX_PONTOS;
  atualizarAvaliacao();
}

function atualizarAvaliacao() {
  pontos.forEach((p, i) => {
    for (const [k] of PARAMETROS) {
      const el = $(`.pt[data-i="${i}"] [data-num="${k}"]`);
      if (!el) continue;
      const impossivel = valorImpossivel(k, p[k]);
      const fora = avaliarParametro(k, p[k], p.tipo);
      el.classList.toggle("bad", !!fora);
      el.classList.toggle("erro", !!impossivel);
      $("small", el).textContent = impossivel ? `${impossivel}; verifique` : fora || (k === "cloro" && ehCaptacao(p.tipo) ? "captação: sem limite" : "");    }
    const elCoord = $(`.pt[data-i="${i}"] .coord`);
    if (elCoord) {
      const erro = avaliarCoordenada(p.coord);
      elCoord.classList.toggle("erro", !!erro);
      $("small", elCoord).textContent = erro || "";
    }
  });
  const fora = foraDoPadrao({ pontos });
  const erros = errosDeDigitacao({ pontos });
  $("#conf").innerHTML =
    (erros.length
      ? `<div class="alert erro"><b>${erros.length} valor(es) para conferir (erro de digitação?)</b><ul>${erros.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`
      : "") +
    (fora.length
      ? `<div class="alert"><b>${fora.length} resultado(s) fora do padrão</b><ul>${fora.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`
      : `<div class="alert ok">Todos os parâmetros informados estão dentro do padrão.</div>`);
  // A sugestão por IA só faz sentido quando há resultado fora do padrão.
  $("#iaBloco").hidden = !fora.length;
  if (!fora.length) $("#iaMsg").innerHTML = "";
  mostrarPendencias();
}

/** No modo "Registrar análise", mostra o que ainda falta para concluir. */
function mostrarPendencias() {
  if (!modoAnalise) { $("#pend").innerHTML = ""; return; }
  const c = lerFormulario();
  const falta = pendenciasDaAnalise(c);
  const alertas = alertasDaAnalise(c);
  $("#pend").innerHTML =
    (falta.length
      ? `<div class="alert info"><b>Para concluir a análise, falta:</b><ul>${falta.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`
      : `<div class="alert ok">Tudo preenchido. Pode concluir a análise.</div>`) +
    alertas.map((a) => `<div class="alert">${esc(a)}</div>`).join("");
}

function mostrarSistema(s) {
  $("#sisInfo").innerHTML = s
    ? `<span>Linha <b>${s.linha}</b></span><span>Código <b>${s.siasi}</b></span><span>Polo <b>${esc(s.polo)}</b></span><span>População <b>${s.populacao}</b></span><span>Tratamento <b>${esc(s.tratamento)}</b></span>`
    : "";
}

function definirOperacao(v) {
  $("#oper").dataset.val = v || "";
  $$("#oper button").forEach((b) => b.classList.toggle("on", b.dataset.v === (v || "")));
}

function lerFormulario() {
  return {
    mes: $("#mes").value,
    linha: Number($("#sis").value) || null,
    dataColeta: $("#dColeta").value,
    responsavelColeta: $("#respColeta").value.trim(),
    dataAnalise: $("#dAnalise").value,
    dataAnalise2: $("#dAnalise2").value,
    responsavel: $("#resp").value.trim(),
    tratamentoEmOperacao: $("#oper").dataset.val,
    justificativa: $("#just").value.trim(),
    observacoes: $("#obs").value.trim(),
    coordenadasNasObservacoes: $("#coordObs").checked,
    pontos: pontos.map((p) => ({ ...p })),
  };
}

function preencherFormulario(c) {
  $("#sis").value = c.linha || "";
  mostrarSistema(sistemaDaLinha(c.linha));
  $("#mes").value = c.mes || MESES[new Date().getMonth()];
  $("#dColeta").value = c.dataColeta || "";
  $("#dAnalise").value = c.dataAnalise || "";
  $("#dAnalise2").value = c.dataAnalise2 || "";
  $("#respColeta").value = c.responsavelColeta || "";
  $("#resp").value = c.responsavel || "";
  definirOperacao(c.tratamentoEmOperacao);
  $("#just").value = c.justificativa || "";
  $("#obs").value = c.observacoes || "";
  $("#coordObs").checked = c.coordenadasNasObservacoes !== false;
  $("#iaMsg").innerHTML = "";
  const s = sistemaDaLinha(c.linha);
  pontos = (c.pontos?.length ? c.pontos : [0, 1, 2].map((i) => pontoVazio(s, i))).map((p) => ({ ...p }));
  renderizarPontos();
}

/** Liga/desliga a parte de análise do formulário. */
function definirModo(analise) {
  modoAnalise = analise;
  $("#blocoAnalise").hidden = !analise;
  $("#concluir").hidden = !analise;
  $("#limpar").hidden = analise;
  $("#salvar").textContent = analise ? "Salvar sem concluir" : "Salvar coleta";
  $("#salvar").classList.toggle("ghost", analise);
  $("#formTitle").textContent = analise ? "Registrar análise" : "Nova coleta";
  emitir("modo-edicao", analise);
}

/** Datas permitidas na análise: entre a data da coleta e hoje. Sugere o dia seguinte à coleta. */
function prepararDatasDaAnalise() {
  const hoje = hojeISO();
  const coleta = $("#dColeta").value || hoje;
  ["#dAnalise", "#dAnalise2"].forEach((id) => { $(id).min = coleta; $(id).max = hoje; });
  if (!$("#dAnalise").value) {
    const diaSeguinte = somarDias(coleta, 1);
    $("#dAnalise").value = diaSeguinte <= hoje ? diaSeguinte : hoje;
  }
}

export function novaColeta() {
  idEmEdicao = null;
  const hoje = hojeISO();
  preencherFormulario({ dataColeta: hoje, mes: MESES[Number(hoje.slice(5, 7)) - 1], responsavelColeta: repo.lerResponsavel("coleta"), pontos: [] });
  definirModo(false);
  atualizarAvaliacao();
}

export function editarColeta(c) {
  idEmEdicao = c.id;
  preencherFormulario({ ...c, responsavel: c.responsavel || repo.lerResponsavel("analise") });
  definirModo(true);
  prepararDatasDaAnalise();
  atualizarAvaliacao();
}

const guardarRascunho = () => repo.salvarRascunho({ idEmEdicao, ...lerFormulario() });

function gravar(c, mensagem) {
  try {
    repo.salvarColeta(c, idEmEdicao);
  } catch (e) { aviso(e.message); return false; }
  repo.lembrarResponsavel("coleta", c.responsavelColeta);
  repo.lembrarResponsavel("analise", c.responsavel);
  repo.limparRascunho();
  aviso(mensagem);
  novaColeta();
  emitir("coletas-alteradas");
  emitir("mostrar-tela", "lista");
  return true;
}

/** Nova coleta: salva como "coletada". Registrar análise: guarda sem concluir. */
function salvar() {
  const c = lerFormulario();
  if (!c.linha) { aviso("Selecione a aldeia / sistema."); $("#sis").focus(); return; }
  if (!c.responsavelColeta) { aviso("Informe o responsável pela coleta."); $("#respColeta").focus(); return; }
  gravar({ ...c, status: "coletada", analisadaEm: null },
        modoAnalise ? "Análise salva, ainda não concluída." : "Coleta registrada. Registre a análise na aba Salvas quando o resultado estiver disponível.");
}

/** Confere as regras e marca a coleta como analisada (libera planilha e PDF). */
function concluirAnalise() {
  const c = lerFormulario();
  const falta = pendenciasDaAnalise(c);
  if (falta.length) {
    mostrarPendencias();
        aviso(`Há ${falta.length} pendência(s) para concluir a análise.`);
    $("#pend").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  gravar({ ...c, status: "analisada", analisadaEm: new Date().toISOString() },
    "Análise concluída. A coleta está liberada para a planilha e o PDF.");
}

const ROTULO_IA = "Sugerir justificativa e ações (IA)";

/**
 * Pede à IA uma sugestão de justificativa e ações e preenche o campo (editável).
 * Só os dados técnicos saem do aparelho (js/ia.js → dadosDaJustificativa).
 * Sem internet ou sem chave no servidor, vem uma resposta de exemplo, marcada como tal.
 */
async function sugerirComIA() {
  const botao = $("#iaSugerir");
  if ($("#just").value.trim() && !confirm("Substituir o texto atual da justificativa pela sugestão?")) return;
  botao.disabled = true; botao.textContent = "Gerando sugestão…";
  const c = lerFormulario();
  const r = await pedirSugestao("justificativa", dadosDaJustificativa(c, sistemaDaLinha(c.linha)), { online: navigator.onLine });
  botao.disabled = false; botao.textContent = ROTULO_IA;
  $("#just").value = r.texto.slice(0, 2000);
  $("#iaMsg").innerHTML = r.origem === "ia"
    ? `<div class="alert info"><span class="chip neu">IA</span> ${esc(AVISO_IA)}</div>`
    : `<div class="alert info"><span class="chip warn">exemplo</span> ${esc(AVISO_EXEMPLO)}</div>`;
  guardarRascunho(); mostrarPendencias();
  $("#just").focus();
}

/**
 * GPS: acompanha as leituras por alguns segundos e fica com a mais precisa.
 * Para antes se chegar na precisão desejada (config.js → GPS). Funciona sem internet.
 */
function obterGPS(i) {
  if (!navigator.geolocation) { aviso("Este navegador não permite o uso do GPS. Informe as coordenadas manualmente."); return; }  const botao = () => $(`[data-gps="${i}"]`);
  let melhor = null, encerrado = false, vigia = null;

  const encerrar = (erro) => {
    if (encerrado) return;
    encerrado = true;
    navigator.geolocation.clearWatch(vigia);
    clearTimeout(limite);
    if (botao()) { botao().disabled = false; botao().textContent = "GPS"; }
    if (!melhor) {
      aviso(`Não foi possível obter a localização${erro?.message ? ": " + erro.message : ""}. Tente novamente em área aberta ou informe as coordenadas manualmente.`);      return;
    }
    const m = Math.round(melhor.coords.accuracy);
    const v = `${melhor.coords.latitude.toFixed(6)}; ${melhor.coords.longitude.toFixed(6)}`;
    pontos[i].coord = v;
    const campo = $(`#p${i}_coord`); if (campo) campo.value = v;
    atualizarAvaliacao(); guardarRascunho();
    aviso(m > GPS.precisaoRuimM
          ? `Localização registrada com baixa precisão (±${m} m). Se possível, tente novamente em área aberta.`
      : `Localização registrada (precisão de ±${m} m).`);
  };

  if (botao()) { botao().disabled = true; botao().textContent = "Buscando…"; }
    aviso("Obtendo localização… permaneça parado em área aberta.");
  vigia = navigator.geolocation.watchPosition(
    (pos) => {
      if (!melhor || pos.coords.accuracy < melhor.coords.accuracy) melhor = pos;
      const m = Math.round(melhor.coords.accuracy);
      if (botao()) botao().textContent = `±${m} m`;
      if (m <= GPS.precisaoDesejadaM) encerrar();
    },
    (err) => { if (!melhor) encerrar(err); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: GPS.tempoMaximoS * 1000 },
  );
  const limite = setTimeout(() => encerrar(), GPS.tempoMaximoS * 1000);
}

export function iniciarFormulario() {
  $("#sis").innerHTML = `<option value="">Selecione…</option>` +
    listarSistemas().map((s) => `<option value="${s.linha}">${esc(rotuloSistema(s))} — ${esc(s.municipio)}</option>`).join("");
  $("#mes").innerHTML = MESES.map((m) => `<option>${m}</option>`).join("");

  // Campos dos pontos (delegação de eventos)
  const aoEditarPonto = (e) => {
    const pt = e.target.closest(".pt");
    const k = e.target.dataset.k;
    if (!pt || !k) return;
    // Números sempre com ponto decimal: "5,59" vira "5.59" enquanto a pessoa digita
    if (CAMPOS_NUMERICOS.includes(k) && e.target.value.includes(",")) {
      e.target.value = e.target.value.replace(/,/g, ".");
    }
    pontos[pt.dataset.i][k] = e.target.value;
    atualizarAvaliacao(); guardarRascunho();
  };
  $("#pts").addEventListener("input", aoEditarPonto);
  $("#pts").addEventListener("change", aoEditarPonto);
  $("#pts").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const i = Number(b.closest(".pt").dataset.i);
    if (b.dataset.gps !== undefined) { obterGPS(i); return; }
    const seg = b.closest(".seg");
    if (seg) {
      pontos[i][seg.dataset.k] = b.dataset.v;
      $$("button", seg).forEach((x) => x.classList.toggle("on", x === b));
      atualizarAvaliacao(); guardarRascunho();
    }
  });

  $$("#oper button").forEach((b) => b.addEventListener("click", () => { definirOperacao(b.dataset.v); guardarRascunho(); }));

  $("#sis").addEventListener("change", () => {
    const s = sistemaDaLinha($("#sis").value);
    mostrarSistema(s);
    if (s) {
      pontos = pontos.map((p, i) => ({ ...p, identificacao: s.pontosPadrao[i]?.identificacao || p.identificacao, tipo: s.pontosPadrao[i]?.tipo || p.tipo }));
      renderizarPontos();
    }
    guardarRascunho();
  });
  ["#mes", "#respColeta", "#dAnalise", "#dAnalise2", "#resp", "#just", "#obs", "#coordObs"].forEach((id) =>
    $(id).addEventListener("input", () => { guardarRascunho(); mostrarPendencias(); }));

  $("#addPt").addEventListener("click", () => {
    if (pontos.length < MAX_PONTOS) { pontos.push(pontoVazio(sistemaDaLinha($("#sis").value), pontos.length)); renderizarPontos(); guardarRascunho(); }
  });
  $("#rmPt").addEventListener("click", () => {
    if (pontos.length > PONTOS_ESSENCIAIS) { pontos.pop(); renderizarPontos(); guardarRascunho(); }
  });
  $("#limpar").addEventListener("click", () => { novaColeta(); repo.limparRascunho(); aviso("Formulário limpo."); });  $("#salvar").addEventListener("click", salvar);
  $("#concluir").addEventListener("click", concluirAnalise);
  $("#iaSugerir").addEventListener("click", sugerirComIA);
  // "Reiniciar demo" apagou as coletas: sai de uma eventual edição.
  ouvir("coletas-apagadas", novaColeta);
  ouvir("editar-coleta", (c) => { editarColeta(c); emitir("mostrar-tela", "nova"); });
  // Botão "Coletar" do Painel: abre a Nova coleta com a aldeia e o mês já escolhidos.
  ouvir("coletar-aldeia", ({ linha, mes }) => {
    novaColeta();
    $("#sis").value = linha;
    $("#sis").dispatchEvent(new Event("change"));
    if (mes) $("#mes").value = mes;
    guardarRascunho();
    emitir("mostrar-tela", "nova");
  });
  // "Voltar" enquanto edita uma coleta salva: cancela a edição (a coleta salva não muda).
  ouvir("voltando", (tela) => {
    if (tela === "nova" && idEmEdicao) { novaColeta(); repo.limparRascunho(); aviso("Edição cancelada. A coleta salva não foi alterada."); }
  });

  // Recupera um rascunho não salvo (ex.: o celular fechou o app no meio da coleta)
  const r = repo.lerRascunho();
  if (r && (r.linha || r.row)) {
    const c = repo.normalizarColeta(r);
    idEmEdicao = r.idEmEdicao || null;
    preencherFormulario({ ...c, dataColeta: c.dataColeta || hojeISO() });
    definirModo(!!idEmEdicao);
    if (idEmEdicao) prepararDatasDaAnalise();
    atualizarAvaliacao();
  } else {
    novaColeta();
  }
}