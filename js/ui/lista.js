// Tela "Salvas": lista das coletas no aparelho, com PDF, edição e exclusão.
import { $, esc, dataBR, baixarArquivo } from "../util.js";
import { foraDoPadrao, errosDeDigitacao } from "../validacao.js";
import { etapaDaColeta, alertasDaAnalise } from "../etapas.js";
import { listarSistemas, sistemaDaLinha, rotuloSistema } from "../sistemas.js";
import { coletasDeExemplo } from "../exemplos.js";
import * as repo from "../storage.js";
import { gerarRelatorioPDF, nomeDoRelatorio } from "../relatorio-pdf.js";
import { emitir, ouvir } from "../eventos.js";
import { aviso } from "./toast.js";

// Tudo o que vem da coleta passa por esc() antes de ir para a tela:
// impede que um texto digitado ou importado seja interpretado como HTML/código.
const mostrar = (v) => esc(String(v ?? "").trim().replace(/,/g, ".") || "–");
const inicial = (v) => (v ? esc(String(v)[0]) : "–");

const resumoPonto = (p, i) =>
  `P${i + 1}: pH ${mostrar(p.ph)} · Cor ${mostrar(p.cor)} · Turb ${mostrar(p.turb)} · Cl ${mostrar(p.cloro)} · CT ${inicial(p.colTotais)} · EC ${inicial(p.eColi)}`;

// Etiqueta de cada etapa: [texto, classe da etiqueta]
const ETIQUETA = {
  coletada: ["Aguardando análise", "warn"],
  analisada: ["Analisada", "neu"],
  enviada: ["Na planilha", "ok"],
};

// Botões de cada etapa: só coleta analisada gera PDF.
function acoes(etapa) {
  const pdf = `<button class="btn sm" data-act="pdf">Relatório PDF</button>`;
  const excluir = `<button class="btn danger sm" data-act="del">Excluir</button>`;
  return etapa === "coletada"
    ? `<button class="btn sm" data-act="edit">Registrar análise</button>${excluir}`
    : `${pdf}<button class="btn ghost sm" data-act="edit">Editar</button>${excluir}`;
}

function cartao(c) {
  const s = sistemaDaLinha(c.linha);
  const pr = foraDoPadrao(c);
  const erros = errosDeDigitacao(c);
  const etapa = etapaDaColeta(c);
  const [rotuloEtapa, classeEtapa] = ETIQUETA[etapa];
  const meta = [
    `Coleta ${esc(dataBR(c.dataColeta))}`,
    c.dataAnalise && etapa !== "coletada" ? `análise ${esc(dataBR(c.dataAnalise))}` : null,
    `aba ${esc(c.mes)}`,
    `linha ${esc(c.linha)}`,
    `${c.pontos.length} pontos`,
    c.responsavelColeta ? `coletor: ${esc(c.responsavelColeta)}` : null,
  ].filter(Boolean).join(" · ");
  const avisos = [
    pr.length && !c.justificativa ? "Sem justificativa (coluna P)" : null,
    c.enviadoAntes && etapa !== "enviada" ? "Alterada após a exportação: gere a planilha de novo" : null,    ...(etapa !== "coletada" ? alertasDaAnalise(c) : []),
  ].filter(Boolean);
  return `<div class="rec" data-id="${esc(c.id)}">
    <div class="top">
      <div><div class="nm">${esc(s ? rotuloSistema(s) : "Sistema?")}</div>
        <div class="meta">${meta}</div></div>
      <div class="rec-status">
        ${etapa === "enviada" ? `<span class="chip neu">Analisada</span>` : ""}
        <span class="chip ${classeEtapa}">${rotuloEtapa}</span>
        ${erros.length ? `<span class="chip warn">${erros.length} a conferir</span>` : ""}
        ${pr.length ? `<span class="chip bad">${pr.length} fora do padrão</span>` : etapa === "coletada" ? "" : `<span class="chip ok">Conforme</span>`}
      </div>
    </div>
    <div class="vals">${c.pontos.map(resumoPonto).join("<br>")}</div>
    ${avisos.map((a) => `<div class="meta aviso">${esc(a)}</div>`).join("")}
    <div class="actions">${acoes(etapa)}</div>
  </div>`;
}

export function renderizarLista() {
  const coletas = repo.listarColetas();
  // Contador do menu: coletas que ainda precisam de algo (análise ou envio).
  const pendentes = coletas.filter((c) => etapaDaColeta(c) !== "enviada").length;
  $("#nPend").textContent = pendentes;
  $("#nPend").hidden = !pendentes;
  $("#lista").innerHTML = coletas.length
    ? coletas.map(cartao).join("")
    : `<div class="alert info">Nenhuma coleta salva ainda. Toque em <b>Carregar exemplos</b> para ver o app com dados fictícios, ou registre uma na aba <b>Nova coleta</b>; os registros aparecem aqui mesmo sem internet.</div>`;
}

export function iniciarLista() {
  $("#lista").addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const cartaoEl = b.closest(".rec"), id = cartaoEl.dataset.id;
    const c = repo.buscarColeta(id);
    switch (b.dataset.act) {
      case "pdf":
        try { baixarArquivo(await gerarRelatorioPDF([c]), nomeDoRelatorio(c)); aviso("Relatório PDF gerado"); }
        catch (err) { console.error(err); aviso("Não foi possível gerar o PDF: " + err.message); }        break;
      case "edit":
        emitir("editar-coleta", c);
        break;
      case "del":
        $(".actions", cartaoEl).innerHTML = `<div class="confirm">Confirma a exclusão desta coleta? <button class="btn danger sm" data-act="delok">Sim, excluir</button><button class="btn ghost sm" data-act="cancel">Cancelar</button></div>`;        break;
      case "delok":
        repo.excluirColeta(id); emitir("coletas-alteradas"); aviso("Coleta excluída");
        break;
      case "cancel":
        renderizarLista();
        break;
    }
  });
  // ---- Demo: carregar exemplos e reiniciar ----
  const botoesDemo = $("#demoBotoes").innerHTML;
  $("#demoBotoes").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.id === "demoExemplos") {
      try {
        const n = repo.carregarExemplos(coletasDeExemplo(listarSistemas()));
        emitir("coletas-alteradas"); aviso(`${n} coletas de exemplo carregadas.`);
      } catch (err) { aviso(err.message); }
    } else if (b.id === "demoReiniciar") {
      const n = repo.listarColetas().length;
      $("#demoBotoes").innerHTML = `<div class="confirm">Apagar ${n ? `as ${n} coleta(s)` : "todos os dados"} deste aparelho? Não dá para desfazer. <button class="btn danger sm" type="button" data-act="reiniciar">Sim, apagar tudo</button><button class="btn ghost sm" type="button" data-act="cancelar">Cancelar</button></div>`;
    } else if (b.dataset.act === "reiniciar") {
      try {
        repo.apagarTudo();
        emitir("coletas-apagadas"); emitir("coletas-alteradas"); aviso("Demo reiniciada: nenhuma coleta neste aparelho.");
      } catch (err) { aviso(err.message); }
      $("#demoBotoes").innerHTML = botoesDemo;
    } else if (b.dataset.act === "cancelar") {
      $("#demoBotoes").innerHTML = botoesDemo;
    }
  });
  ouvir("coletas-alteradas", renderizarLista);
  renderizarLista();
}