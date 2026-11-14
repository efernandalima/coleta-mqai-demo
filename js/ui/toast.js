import { $ } from "../util.js";

let timer;
export function aviso(mensagem) {
  const t = $("#toast");
  t.textContent = mensagem;
  t.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (t.hidden = true), 3200);
}
