// Cadastro dos sistemas/aldeias da demo (fictícios). Fonte: data/sistemas.json.
// "linha" é a linha do sistema nas abas mensais da planilha modelo.

let SISTEMAS = [];

export async function carregarSistemas(url = "data/sistemas.json") {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Não foi possível carregar a lista de aldeias (${r.status}).`);
  SISTEMAS = await r.json();
  return SISTEMAS;
}

/** Permite injetar a lista (usado nos testes). */
export const definirSistemas = (lista) => { SISTEMAS = lista; };

export const listarSistemas = () => SISTEMAS;
export const sistemaDaLinha = (linha) => SISTEMAS.find((s) => s.linha === Number(linha)) || null;
export const rotuloSistema = (s) => `${s.aldeia.trim()} · ${s.sistema}`;

/** Aldeias com mais de um sistema (ex.: SAA 1 e SAA 2) precisam do sistema no nome. */
export const aldeiaTemVariosSistemas = (s) => SISTEMAS.filter((x) => x.aldeia === s.aldeia).length > 1;
