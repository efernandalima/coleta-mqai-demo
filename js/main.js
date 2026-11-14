// Ponto de entrada: carrega os dados de referência e inicia as telas.
import { $ } from "./util.js";
import { carregarSistemas } from "./sistemas.js";
import { iniciarNavegacao } from "./ui/navegacao.js";
import { iniciarFormulario } from "./ui/formulario.js";
import { iniciarLista } from "./ui/lista.js";
import { iniciarExportar } from "./ui/exportar.js";
import { aviso } from "./ui/toast.js";
import { iniciarPainel } from "./ui/painel.js";
import { iniciarLembrete } from "./ui/lembrete.js";

// Mostra a faixa "Nova versão disponível" quando um sw.js novo é publicado.
function avisarNovaVersao(registro) {
  const sw = navigator.serviceWorker;
  // Se já havia uma versão ativa, a troca é uma atualização (e não a 1ª instalação).
  let versaoAtiva = sw.controller;
  sw.addEventListener("controllerchange", () => {
    if (versaoAtiva) $("#atualizacao").hidden = false;
    versaoAtiva = sw.controller;
  });
  $("#atualizar").addEventListener("click", () => location.reload());

  // Procura versão nova ao voltar para o app e a cada 30 minutos (só com internet).
  const procurar = () => { if (navigator.onLine) registro.update().catch(() => {}); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") procurar(); });
  setInterval(procurar, 30 * 60 * 1000);
}

function registrarAppOffline() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js")
      .then(avisarNovaVersao)
      .catch((e) => console.warn("Service worker:", e));
    // Pede ao navegador para não apagar os dados quando faltar espaço.
    navigator.storage?.persist?.().catch(() => {});
  }
  let pedidoInstalacao = null;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); pedidoInstalacao = e; $("#instalar").hidden = false; });
  $("#instalar").addEventListener("click", async () => {
    if (!pedidoInstalacao) return;
    pedidoInstalacao.prompt(); await pedidoInstalacao.userChoice;
    pedidoInstalacao = null; $("#instalar").hidden = true;
  });
  addEventListener("appinstalled", () => { $("#instalar").hidden = true; aviso("Aplicativo instalado. Ele funciona mesmo sem internet."); });}
async function iniciar() {
  try {
    await carregarSistemas();
  } catch (e) {
    $("#view-nova").innerHTML = `<div class="alert">${e.message} Abra o app uma vez com internet.</div>`;
    return;
  }
  iniciarNavegacao();
  iniciarFormulario();
  iniciarLista();
  iniciarExportar();
  iniciarPainel();
  iniciarLembrete();
  registrarAppOffline();
}

iniciar();
