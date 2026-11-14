// Barramento de eventos simples para as telas conversarem sem depender umas das outras.
// Eventos usados: "coletas-alteradas", "editar-coleta" (detail: coleta), "mostrar-tela" (detail: nome).
const bus = new EventTarget();
export const emitir = (nome, detail) => bus.dispatchEvent(new CustomEvent(nome, { detail }));
export const ouvir = (nome, fn) => bus.addEventListener(nome, (e) => fn(e.detail));
