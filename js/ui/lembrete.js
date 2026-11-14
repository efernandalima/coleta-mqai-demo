// Aviso no topo de "Nova coleta": coletas paradas no aparelho há mais de 2 dias.
import { $, esc, dataBR } from "../util.js";
import { sistemaDaLinha } from "../sistemas.js";
import * as repo from "../storage.js";
import { coletasAtrasadas, DIAS_LEMBRETE } from "../lembrete.js";
import { emitir, ouvir } from "../eventos.js";

const MAX_NOMES = 3;

// "Aldeia X (12/11), Aldeia Y (13/11) e mais 2"
function nomes(coletas) {
  const lista = coletas.slice(0, MAX_NOMES).map((c) => `${sistemaDaLinha(c.linha)?.aldeia?.trim() || "Aldeia"} (${dataBR(c.dataColeta).slice(0, 5)})`);
  const resto = coletas.length - MAX_NOMES;
  return esc(lista.join(", ")) + (resto > 0 ? ` e mais ${resto}` : "");
}

function mostrar() {
  const { semEnviar, semAnalise } = coletasAtrasadas(repo.listarColetas());
  const itens = [];
  if (semEnviar.length) {
    itens.push(`<li><b>${semEnviar.length} coleta(s) analisada(s) ainda fora da planilha</b>: ${nomes(semEnviar)}.
      <button type="button" class="btn sm" data-ir="exportar">Exportar agora</button></li>`);
  }
  if (semAnalise.length) {
    itens.push(`<li><b>${semAnalise.length} coleta(s) aguardando análise</b>: ${nomes(semAnalise)}.
      <button type="button" class="btn ghost sm" data-ir="lista">Ver em Salvas</button></li>`);
  }
  $("#lembrete").innerHTML = itens.length
    ? `<div class="alert lembrete" role="status"><b>Coletas paradas há mais de ${DIAS_LEMBRETE} dias neste aparelho</b><ul>${itens.join("")}</ul></div>`
    : "";
}

export function iniciarLembrete() {
  $("#lembrete").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ir]");
    if (b) emitir("mostrar-tela", b.dataset.ir);
  });
  ouvir("coletas-alteradas", mostrar);
  ouvir("tela-aberta", (t) => { if (t === "nova") mostrar(); });
  mostrar();
}
