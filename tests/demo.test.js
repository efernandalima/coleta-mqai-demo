// Testes da demo: cadastro fictício, coletas de exemplo, função serverless e ausência de dados reais.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { coletasDeExemplo } from "../js/exemplos.js";
import { sanitizarColeta, carregarExemplos, apagarTudo, listarColetas } from "../js/storage.js";
import { foraDoPadrao } from "../js/validacao.js";
import { pendenciasDaAnalise, etapaDaColeta } from "../js/etapas.js";
import { TIPOS_PONTO } from "../js/config.js";
import handler from "../api/sugerir.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (arq) => fs.readFileSync(path.join(RAIZ, arq), "utf8");
const sistemas = JSON.parse(ler("data/sistemas.json"));
const HOJE = "2026-11-14";

// ---------- cadastro fictício ----------

test("cadastro: 8 sistemas fictícios em 3 municípios, com o formato de campos original", () => {
  assert.equal(sistemas.length, 8);
  assert.deepEqual([...new Set(sistemas.map((s) => s.municipio))], ["MUNICÍPIO A", "MUNICÍPIO B", "MUNICÍPIO C"]);
  const campos = ["linha", "id", "polo", "municipio", "aldeia", "siasi", "sistema", "tipo", "populacao", "pontosCaptacao", "pontosAmostragem", "tratamento", "pontosPadrao"];
  for (const s of sistemas) {
    assert.deepEqual(Object.keys(s), campos);
    assert.match(s.aldeia, /^ALDEIA DEMO \d+$/);
    assert.ok(s.pontosPadrao.length >= 3);
    for (const p of s.pontosPadrao) {
      assert.deepEqual(Object.keys(p), ["identificacao", "tipo"]);
      assert.ok(TIPOS_PONTO.includes(p.tipo), p.tipo);
    }
  }
  assert.equal(new Set(sistemas.map((s) => s.linha)).size, 8); // uma linha da planilha por sistema
});

// ---------- coletas de exemplo ----------

test("exemplos: 6 coletas — 2 conformes, 3 fora do padrão e 1 aguardando análise", () => {
  const ex = coletasDeExemplo(sistemas, HOJE);
  assert.equal(ex.length, 6);
  assert.equal(new Set(ex.map((c) => c.linha)).size, 6); // um sistema por coleta
  const analisadas = ex.filter((c) => etapaDaColeta(c) === "analisada");
  assert.equal(analisadas.filter((c) => foraDoPadrao(c).length === 0).length, 2);
  assert.equal(analisadas.filter((c) => foraDoPadrao(c).length > 0).length, 3);
  assert.equal(ex.filter((c) => etapaDaColeta(c) === "coletada").length, 1);
});

test("exemplos fora do padrão: turbidez 7 uT; cloro 0,1 mg/L fora da captação; E. coli presente", () => {
  const fora = coletasDeExemplo(sistemas, HOJE).map(foraDoPadrao).filter((f) => f.length);
  assert.deepEqual(fora, [
    ["Ponto 3: Turbidez 7 (acima de 5 uT)"],
    ["Ponto 2: Cloro 0.1 (abaixo de 0.2 mg/L)"],
    ["Ponto 3: coliformes totais presentes", "Ponto 3: E. coli presente"],
  ]);
});

test("exemplos analisados estão completos (sem pendências) e o que aguarda não tem resultado", () => {
  for (const c of coletasDeExemplo(sistemas, HOJE)) {
    if (c.status === "analisada") assert.deepEqual(pendenciasDaAnalise(c, HOJE), [], c.id);
    else assert.ok(c.pontos.every((p) => p.ph === "" && p.eColi === "") && c.dataAnalise === "");
  }
});

test("exemplos: mês atual, datas no passado e formato aceito pelo app", () => {
  for (const c of coletasDeExemplo(sistemas, HOJE)) {
    assert.equal(c.mes, "NOV");
    assert.ok(c.dataColeta < HOJE && (c.dataAnalise === "" || c.dataAnalise <= HOJE));
    const limpa = sanitizarColeta(c);
    assert.ok(limpa, c.id);
    assert.deepEqual(limpa.pontos, c.pontos);
  }
});

test("carregar exemplos duas vezes não duplica; reiniciar a demo apaga tudo", () => {
  // No Node não existe localStorage: um substituto em memória basta para o teste.
  const memoria = new Map();
  globalThis.localStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  };
  carregarExemplos(coletasDeExemplo(sistemas, HOJE));
  carregarExemplos(coletasDeExemplo(sistemas, HOJE));
  assert.equal(listarColetas().length, 6);
  assert.equal(JSON.parse(memoria.get("mqai_demo_coletas_v1")).length, 6);
  apagarTudo();
  assert.equal(listarColetas().length, 0);
  assert.equal(memoria.get("mqai_demo_coletas_v1"), "[]");
  delete globalThis.localStorage;
});

// ---------- função serverless ----------

function chamar(req) {
  const res = { cabecalhos: {}, codigo: 0, corpo: null,
    setHeader(k, v) { this.cabecalhos[k] = v; }, status(c) { this.codigo = c; return this; }, json(d) { this.corpo = d; return this; } };
  return handler({ headers: {}, ...req }, res).then(() => res);
}
const pedido = { tipo: "justificativa", dados: { tratamento: "SIM, COM DESINFECÇÃO", emOperacao: "SIM", pontos: [{ tipo: "CHAFARIZ (COLETIVO)", turb: "7" }] } };

test("api/sugerir: só POST, só do próprio site e sem chave responde 503 (o app mostra o exemplo)", async () => {
  const chave = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    assert.equal((await chamar({ method: "GET" })).codigo, 405);
    assert.equal((await chamar({ method: "POST", headers: { origin: "https://outro.site", host: "demo.vercel.app" }, body: pedido })).codigo, 403);
    const r = await chamar({ method: "POST", headers: { origin: "https://demo.vercel.app", host: "demo.vercel.app" }, body: pedido });
    assert.equal(r.codigo, 503);
    assert.deepEqual(r.corpo, { erro: "sem_chave" });
    assert.equal(r.cabecalhos["Cache-Control"], "no-store");
  } finally { if (chave !== undefined) process.env.GROQ_API_KEY = chave; }
});

test("api/sugerir: com chave, monta o prompt no servidor, chama a Groq e devolve só o texto", async () => {
  const chave = process.env.GROQ_API_KEY, fetchOriginal = globalThis.fetch;
  process.env.GROQ_API_KEY = "chave-de-teste";
  let enviado;
  globalThis.fetch = async (url, opcoes) => {
    enviado = { url, ...opcoes, corpo: JSON.parse(opcoes.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: " Sugestão. " } }] }) };
  };
  try {
    const r = await chamar({ method: "POST", body: JSON.stringify(pedido) });
    assert.equal(r.codigo, 200);
    assert.deepEqual(r.corpo, { texto: "Sugestão.", modelo: "llama-3.3-70b-versatile" });
    assert.equal(enviado.url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(enviado.headers.Authorization, "Bearer chave-de-teste");
    assert.equal(enviado.corpo.model, "llama-3.3-70b-versatile");
    assert.ok(enviado.corpo.messages[0].content.includes("Não invente valores"));
    assert.ok(enviado.corpo.messages[1].content.includes("Turbidez: 7 uT — FORA DO PADRÃO (acima de 5 uT)"));
    assert.equal(JSON.stringify(r.corpo).includes("chave-de-teste"), false);
    // pedido sem nada fora do padrão ou malformado: 400, sem chamar a Groq
    enviado = null;
    assert.equal((await chamar({ method: "POST", body: { tipo: "justificativa", dados: { pontos: [{ turb: "1" }] } } })).codigo, 400);
    assert.equal((await chamar({ method: "POST", body: "{não é json" })).codigo, 400);
    assert.equal(enviado, null);
    // Groq fora do ar: 502 (o app mostra o exemplo)
    globalThis.fetch = async () => ({ ok: false, status: 500 });
    assert.equal((await chamar({ method: "POST", body: pedido })).codigo, 502);
  } finally {
    globalThis.fetch = fetchOriginal;
    if (chave === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = chave;
  }
});

// ---------- demo pública: sem dados nem identidade reais ----------

function arquivosPublicados(dir = RAIZ) {
  const ignorar = new Set([".git", "node_modules", "vendor", "fonts", "icons", "tests", ".vscode"]);
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (ignorar.has(e.name)) return [];
    const caminho = path.join(dir, e.name);
    if (e.isDirectory()) return arquivosPublicados(caminho);
    return /\.(html|js|json|css|webmanifest|md)$/.test(e.name) ? [caminho] : [];
  });
}

test("nenhum arquivo publicado cita o órgão, o distrito, o povo ou a planilha real", () => {
  const proibido = /minist[ée]rio da sa[úu]de|sesai|dsei|potiguara|aisan|pmqai|mqai_pot|script\.google/i;
  for (const arq of arquivosPublicados()) {
    const achado = fs.readFileSync(arq, "utf8").match(proibido);
    assert.equal(achado, null, `${path.relative(RAIZ, arq)}: "${achado?.[0]}"`);
  }
});

test("service worker: arquivos novos na lista, todos existem e /api/ fica fora do cache", () => {
  const sw = ler("sw.js");
  const lista = [...sw.matchAll(/^\s+"\.\/([^"]+)",$/gm)].map((m) => m[1]);
  for (const novo of ["js/ia.js", "js/exemplos.js"]) assert.ok(lista.includes(novo), novo);
  for (const arq of lista) assert.ok(fs.existsSync(path.join(RAIZ, arq)), arq);
  assert.equal(lista.some((a) => a.startsWith("api/")), false);
  assert.ok(sw.includes(`url.pathname.startsWith("/api/")`));
  // todo módulo do app precisa estar na lista para funcionar offline
  for (const dir of ["js", "js/ui"]) {
    for (const f of fs.readdirSync(path.join(RAIZ, dir)).filter((n) => n.endsWith(".js"))) assert.ok(lista.includes(`${dir}/${f}`), `${dir}/${f}`);
  }
});

test("a chave da IA não aparece no front-end", () => {
  for (const arq of arquivosPublicados().filter((a) => !a.includes(`${path.sep}api${path.sep}`) && !a.endsWith(".md"))) {
    assert.equal(fs.readFileSync(arq, "utf8").includes("GROQ_API_KEY"), false, path.relative(RAIZ, arq));
  }
});
