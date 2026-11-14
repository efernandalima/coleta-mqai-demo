// Repositório de coletas. Hoje grava no próprio aparelho (localStorage).
// Toda a leitura/escrita de coletas passa por aqui: para sincronizar com um backend no futuro,
// basta estender este módulo (ver docs/ARQUITETURA.md) sem mexer nas telas.

import { MESES, TIPOS_PONTO, RESULTADOS_MICRO, MAX_PONTOS, ETAPAS } from "./config.js";
import { temResultado } from "./validacao.js";

const CHAVE = "mqai_demo_coletas_v1";
const CHAVE_RASCUNHO = CHAVE + "_draft";
const CHAVE_RESPONSAVEL = "mqai_demo_resp";              // último responsável pela análise
const CHAVE_RESPONSAVEL_COLETA = "mqai_demo_resp_coleta"; // último responsável pela coleta

function ler(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v === null ? padrao : JSON.parse(v); } catch { return padrao; }
}
function gravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch { return false; }
}

/** Converte registros antigos para o formato atual. */
export function normalizarColeta(c) {
  if (!c) return c;
  const atual = c.pontos ? c : converterPrimeiraVersao(c);
  // Coletas de antes das etapas: com data de análise e resultado contam como analisadas.
  if (!ETAPAS.includes(atual.status)) {
    return { ...atual, status: atual.dataAnalise && temResultado(atual) ? "analisada" : "coletada" };
  }
  return atual;
}

/** Registros da primeira versão (campos abreviados). */
function converterPrimeiraVersao(c) {
  return {
    id: c.id, mes: c.mes, linha: c.row,
    dataColeta: c.dColeta || "", dataAnalise: c.dAnalise || "", dataAnalise2: c.dAnalise2 || "",
    responsavel: c.resp || "", tratamentoEmOperacao: c.oper || "",
    justificativa: c.just || "", observacoes: c.obs || "", coordenadasNasObservacoes: c.coordObs !== false,
    pontos: (c.pts || []).map((p) => ({
      identificacao: p.ident || "", tipo: p.tipo || "", coord: p.coord || "",
      ph: p.ph || "", cor: p.cor || "", turb: p.turb || "", cloro: p.cloro || "",
      colTotais: p.ct || "", eColi: p.ec || "",
    })),
    criadoEm: c.criado || null, atualizadoEm: c.atualizado || null, exportadoEm: c.exportado || null,
  };
}

// ---------- validação de dados vindos de fora (cópias de segurança) ----------
const ID_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const texto = (v, max) => (v === null || v === undefined ? "" : String(v)).slice(0, max);
const opcao = (v, permitidos) => (permitidos.includes(v) ? v : "");
const data = (v) => (DATA_VALIDA.test(v || "") ? v : "");

/**
 * Confere e limpa uma coleta (ex.: vinda de um arquivo .json importado).
 * Devolve a coleta só com campos conhecidos, tamanhos limitados e opções válidas,
 * ou null se ela não tiver o mínimo necessário.
 */
export function sanitizarColeta(bruta) {
  const c = normalizarColeta(bruta);
  if (!c || typeof c !== "object") return null;
  if (!ID_VALIDO.test(String(c.id || ""))) return null;
  if (!MESES.includes(c.mes)) return null;
  const linha = Number(c.linha);
  if (!Number.isInteger(linha) || linha < 1 || linha > 1000) return null;
  if (!data(c.dataColeta)) return null;
  if (!Array.isArray(c.pontos) || c.pontos.length === 0 || c.pontos.length > MAX_PONTOS) return null;

  return {
    id: c.id,
    mes: c.mes,
    linha,
    dataColeta: data(c.dataColeta),
    dataAnalise: data(c.dataAnalise),
    dataAnalise2: data(c.dataAnalise2),
    responsavel: texto(c.responsavel, 120),
    responsavelColeta: texto(c.responsavelColeta, 120),
    status: opcao(c.status, ETAPAS) || "coletada",
    tratamentoEmOperacao: opcao(c.tratamentoEmOperacao, ["SIM", "NÃO"]),
    justificativa: texto(c.justificativa, 2000),
    observacoes: texto(c.observacoes, 2000),
    coordenadasNasObservacoes: c.coordenadasNasObservacoes !== false,
    pontos: c.pontos.map((p) => ({
      identificacao: texto(p?.identificacao, 80),
      tipo: opcao(p?.tipo, TIPOS_PONTO),
      coord: texto(p?.coord, 60),
      ph: texto(p?.ph, 12),
      cor: texto(p?.cor, 12),
      turb: texto(p?.turb, 12),
      cloro: texto(p?.cloro, 12),
      colTotais: opcao(p?.colTotais, RESULTADOS_MICRO),
      eColi: opcao(p?.eColi, RESULTADOS_MICRO),
    })),
    criadoEm: texto(c.criadoEm, 40) || null,
    atualizadoEm: texto(c.atualizadoEm, 40) || null,
    analisadaEm: texto(c.analisadaEm, 40) || null,
    exportadoEm: c.exportadoEm ? texto(c.exportadoEm, 40) : null,
    enviadoAntes: c.enviadoAntes === true,
  };
}

let cache = (ler(CHAVE, []) || []).map(normalizarColeta);

export const listarColetas = () => cache.slice();
export const buscarColeta = (id) => cache.find((c) => c.id === id) || null;

function persistir() {
  if (!gravar(CHAVE, cache)) throw new Error("Não foi possível salvar neste dispositivo. Exporte uma cópia de segurança.");}

export function salvarColeta(dados, id = null) {
  const agora = new Date().toISOString();
  if (id) {
    const i = cache.findIndex((c) => c.id === id);
    const antes = cache[i];
    // Se já estava na planilha, guarda que foi alterada depois da exportação (precisa gerar de novo).
    const enviadoAntes = !!(antes.exportadoEm || antes.enviadoAntes);
    cache[i] = { ...antes, ...dados, id, atualizadoEm: agora, exportadoEm: null, enviadoAntes };
  } else {
    cache.unshift({ ...dados, id: "c" + Date.now().toString(36), criadoEm: agora, atualizadoEm: agora, exportadoEm: null });
  }
  persistir();
}

export function excluirColeta(id) {
  cache = cache.filter((c) => c.id !== id);
  persistir();
}

export function marcarExportadas(ids) {
  const agora = new Date().toISOString();
  cache.forEach((c) => { if (ids.includes(c.id)) { c.exportadoEm = agora; c.enviadoAntes = false; } });
  persistir();
}

/**
 * Junta coletas de uma cópia de segurança. Ignora as que já existem e recusa as inválidas.
 * Retorna { importadas, recusadas }.
 */
export function importarColetas(lista) {
  if (!Array.isArray(lista)) throw new Error("O arquivo não tem uma lista de coletas.");
  let importadas = 0, recusadas = 0;
  for (const bruta of lista) {
    const c = sanitizarColeta(bruta);
    if (!c) { recusadas++; continue; }
    if (!cache.some((x) => x.id === c.id)) { cache.push(c); importadas++; }
  }
  persistir();
  return { importadas, recusadas };
}

/** Demo: grava as coletas de exemplo (substitui as de mesmo id, sem duplicar). */
export function carregarExemplos(lista) {
  const ids = new Set(lista.map((c) => c.id));
  cache = [...lista.map((c) => ({ ...c })), ...cache.filter((c) => !ids.has(c.id))];
  persistir();
  return lista.length;
}

/** Demo: apaga todas as coletas, o rascunho e os nomes lembrados neste aparelho. */
export function apagarTudo() {
  cache = [];
  persistir();
  limparRascunho();
  try { localStorage.removeItem(CHAVE_RESPONSAVEL); localStorage.removeItem(CHAVE_RESPONSAVEL_COLETA); } catch { /* ignora */ }
}

export const copiaDeSeguranca = () => ({ app: "coleta-mqai-demo", versao: 2, geradoEm: new Date().toISOString(), coletas: cache });

export const lerRascunho = () => ler(CHAVE_RASCUNHO, null);
export const salvarRascunho = (r) => gravar(CHAVE_RASCUNHO, r);
export const limparRascunho = () => { try { localStorage.removeItem(CHAVE_RASCUNHO); } catch { /* ignora */ } };

// O app lembra o último nome digitado (um para a coleta e outro para a análise) para não ter que digitar sempre.
const chaveResponsavel = (tipo) => (tipo === "coleta" ? CHAVE_RESPONSAVEL_COLETA : CHAVE_RESPONSAVEL);
export const lerResponsavel = (tipo) => { try { return localStorage.getItem(chaveResponsavel(tipo)) || ""; } catch { return ""; } };
export const lembrarResponsavel = (tipo, nome) => {
  if (!nome) return;
  try { localStorage.setItem(chaveResponsavel(tipo), nome); } catch { /* ignora */ }
};