import { $, $$ } from "../util.js";
import { emitir, ouvir } from "../eventos.js";

const TELAS = ["nova", "lista", "painel", "exportar"];
const TELA_INICIAL = "nova";

let telaAtual = TELA_INICIAL;
let passos = 0;          // quantas telas foram abertas depois da inicial (para o "Voltar")
let editando = false;    // formulário está editando uma coleta salva

function atualizarBotaoVoltar() {
  $("#voltar").hidden = telaAtual === TELA_INICIAL && !editando;
}

function exibir(nome) {
  telaAtual = nome;
  TELAS.forEach((t) => ($("#view-" + t).hidden = t !== nome));
  $$("nav button").forEach((b) => b.classList.toggle("on", b.dataset.v === nome));
  atualizarBotaoVoltar();
  window.scrollTo(0, 0);
  emitir("tela-aberta", nome);
}

/** Abre uma tela e registra no histórico, para o "Voltar" (do app e do celular) funcionar. */
export function mostrarTela(nome) {
  if (nome !== telaAtual) {
    history.pushState({ tela: nome }, "");
    passos++;
  }
  exibir(nome);
}

/** Volta para a tela anterior; se não houver, vai para a tela inicial. */
export function voltar() {
  if (passos > 0) { history.back(); return; } // dispara o "popstate" abaixo
  emitir("voltando", telaAtual);
  exibir(TELA_INICIAL);
}

export function iniciarNavegacao() {
  history.replaceState({ tela: TELA_INICIAL }, "");
  $$("nav button").forEach((b) => b.addEventListener("click", () => mostrarTela(b.dataset.v)));
  $("#voltar").addEventListener("click", voltar);

  // Botão "voltar" do celular / do navegador
  addEventListener("popstate", (e) => {
    if (passos > 0) passos--;
    emitir("voltando", telaAtual);
    exibir(e.state?.tela || TELA_INICIAL);
  });

  ouvir("mostrar-tela", mostrarTela);
  ouvir("modo-edicao", (ativo) => { editando = ativo; atualizarBotaoVoltar(); });

    const status = () => ($("#netStatus").textContent = `${navigator.onLine ? "Conectado" : "Sem conexão"} · dados fictícios, armazenados neste dispositivo`);
  addEventListener("online", status);
  addEventListener("offline", status);
  status();
  atualizarBotaoVoltar();
}
