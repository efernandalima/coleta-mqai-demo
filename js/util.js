// Funções utilitárias puras (exceto baixarArquivo, que usa o navegador).

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Converte texto digitado ("5,59", "0.2") em número. "" → null; texto inválido → NaN. */
export function numero(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** "2026-09-24" → "24/09/2026" */
export const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

/** Data ISO → número de série do Excel (dias desde 30/12/1899). */
export function serialExcel(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

export function numeroColuna(letras) {
  let n = 0;
  for (const ch of letras) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}
export function letrasColuna(n) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** Maiúsculas sem acento, para comparar nomes de aldeia. */
export const normalizar = (s) => String(s || "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Nome de arquivo sem acentos/caracteres especiais (alguns navegadores descartam o nome se houver). */
export const nomeArquivoSeguro = (n) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w .()-]/g, "_");

export function baixarArquivo(blob, nome) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivoSeguro(nome);
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
