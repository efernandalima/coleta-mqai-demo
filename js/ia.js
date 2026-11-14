// IA: sugestão de justificativa/ações e resumo do mês.
// Módulo puro (sem tela): roda no navegador, na função serverless (api/sugerir.js) e nos testes (Node).
//
//   navegador ──(só dados técnicos)──► /api/sugerir ──(prompt montado aqui)──► LLM
//
// - O navegador nunca monta o prompt nem conhece a chave: envia { tipo, dados } e recebe { texto }.
// - O servidor não confia no que chega: limparDados() descarta tudo o que não for dado técnico conhecido
//   e a conformidade é recalculada com as mesmas regras do app (validacao.js).
// - Sem internet, sem chave ou com erro: respostaDeExemplo() devolve um texto fixo, marcado como "exemplo".
import { VR, PARAMETROS, TIPOS_PONTO, RESULTADOS_MICRO, MESES, MESES_EXTENSO, MAX_PONTOS } from "./config.js";
import { avaliarParametro, valorImpossivel, ehCaptacao } from "./validacao.js";
import { numero } from "./util.js";

export const ROTA_IA = "/api/sugerir";
export const TIPOS_DE_PEDIDO = ["justificativa", "resumo"];
export const AVISO_IA = "Sugestão gerada por IA — revise antes de salvar";
export const AVISO_EXEMPLO = "Resposta de exemplo (IA indisponível: sem internet ou sem chave configurada) — revise antes de salvar";

const MAX_SISTEMAS = 60;
const br = (n) => n.toFixed(1).replace(".", ",");

/** Limites enviados ao modelo, derivados dos mesmos valores de referência usados na validação. */
export const LIMITES_PORTARIA = [
  `pH: ${br(VR.ph[0])} a ${br(VR.ph[1])}`,
  `Cor aparente: até ${VR.cor[1]} uH`,
  `Turbidez: até ${VR.turb[1]} uT`,
  `Cloro residual livre: ${br(VR.cloro[0])} a ${br(VR.cloro[1])} mg/L (exigido após o tratamento; não se aplica ao ponto de captação)`,
  "Coliformes totais e Escherichia coli: ausência em 100 mL",
];

// ---------- dados técnicos (o que sai do aparelho) ----------

const opcao = (v, permitidos) => (permitidos.includes(v) ? v : "");
// Texto curto de cadastro: só letras, números e pontuação simples (sem quebras de linha).
const rotulo = (v, max) => String(v ?? "").replace(/[^\p{L}\p{N} ,.()·\/-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Valor numérico válido como texto ("7", "0.1"); em branco ou impossível vira "". */
function valorLimpo(chave, v) {
  const n = numero(v);
  if (n === null || Number.isNaN(n) || n > 1e6 || valorImpossivel(chave, v)) return "";
  return String(n);
}

function limparPonto(p) {
  const limpo = { tipo: opcao(p?.tipo, TIPOS_PONTO) };
  for (const [k] of PARAMETROS) limpo[k] = valorLimpo(k, p?.[k]);
  limpo.colTotais = opcao(p?.colTotais, RESULTADOS_MICRO);
  limpo.eColi = opcao(p?.eColi, RESULTADOS_MICRO);
  return limpo;
}

const limparPontos = (pontos) => (Array.isArray(pontos) ? pontos.slice(0, MAX_PONTOS).map(limparPonto) : []);

/**
 * Confere e reduz o pedido ao que é dado técnico. Devolve null se o pedido for inválido.
 * Usada nos dois lados: no aparelho (antes de enviar) e no servidor (antes de montar o prompt).
 */
export function limparDados(tipo, dados) {
  if (!dados || typeof dados !== "object") return null;
  if (tipo === "justificativa") {
    const pontos = limparPontos(dados.pontos);
    if (!pontos.length) return null;
    return { tratamento: rotulo(dados.tratamento, 60), emOperacao: opcao(dados.emOperacao, ["SIM", "NÃO"]), pontos };
  }
  if (tipo === "resumo") {
    if (!MESES.includes(dados.mes) || !Array.isArray(dados.sistemas) || !dados.sistemas.length) return null;
    const sistemas = dados.sistemas.slice(0, MAX_SISTEMAS)
      .map((s) => ({ sistema: rotulo(s?.sistema, 60), tratamento: rotulo(s?.tratamento, 60), pontos: limparPontos(s?.pontos) }))
      .filter((s) => s.sistema && s.pontos.length);
    return sistemas.length ? { mes: dados.mes, sistemas } : null;
  }
  return null;
}

/** Dados da coleta para a sugestão de justificativa: sem aldeia, nomes, datas, coordenadas ou textos livres. */
export function dadosDaJustificativa(coleta, sistema) {
  return limparDados("justificativa", {
    tratamento: sistema?.tratamento,
    emOperacao: coleta.tratamentoEmOperacao,
    pontos: coleta.pontos,
  });
}

/** Dados do mês para o resumo: nome do sistema + resultados (a coleta mais recente de cada sistema). */
export function dadosDoResumo(mes, coletas, sistemaDaLinha, nomeDoSistema) {
  const porLinha = new Map();
  coletas.filter((c) => c.mes === mes)
    .sort((a, b) => (a.dataColeta || "").localeCompare(b.dataColeta || ""))
    .forEach((c) => porLinha.set(Number(c.linha), c));
  const sistemas = [...porLinha].sort(([a], [b]) => a - b).map(([linha, c]) => {
    const s = sistemaDaLinha(linha);
    return { sistema: s ? nomeDoSistema(s) : `Sistema da linha ${linha}`, tratamento: s?.tratamento, pontos: c.pontos };
  });
  return limparDados("resumo", { mes, sistemas });
}

// ---------- conformidade (mesmas regras do app) ----------

const unidade = (k) => PARAMETROS.find(([chave]) => chave === k)[2];
const comUnidade = (k, v) => (unidade(k) ? `${v} ${unidade(k)}` : v);

/** Não conformidades de uma lista de pontos: [{ ponto, tipo, chave, texto }]. */
export function naoConformidades(pontos) {
  const out = [];
  pontos.forEach((p, i) => {
    for (const [k, nome] of PARAMETROS) {
      const motivo = avaliarParametro(k, p[k], p.tipo);
      if (motivo) out.push({ ponto: i + 1, tipo: p.tipo, chave: k, motivo, texto: `${nome} ${comUnidade(k, p[k])} (${motivo})` });
    }
    if (p.colTotais === "PRESENTE") out.push({ ponto: i + 1, tipo: p.tipo, chave: "colTotais", texto: "coliformes totais presentes" });
    if (p.eColi === "PRESENTE") out.push({ ponto: i + 1, tipo: p.tipo, chave: "eColi", texto: "E. coli presente" });
  });
  return out;
}

const listaPorPonto = (ncs) => ncs.map((x) => `Ponto ${x.ponto}: ${x.texto}`).join("; ");

// ---------- prompt ----------

const SISTEMA_BASE = [
  "Você é um assistente técnico de vigilância da qualidade da água para consumo humano em sistemas de abastecimento de pequenas comunidades.",
  "Escreva em português do Brasil, em linguagem técnica e objetiva, sem saudações, sem markdown e sem repetir estas instruções.",
  "Regras:",
  "- Use somente os dados informados na mensagem. Não invente valores, datas, locais, nomes, medições nem causas confirmadas.",
  '- Parâmetro marcado como "não informado" não foi analisado: não presuma o resultado.',
  "- Apresente causas sempre como hipóteses a verificar em campo.",
  "- Avalie a conformidade somente pelos limites abaixo; a situação de cada parâmetro já vem indicada nos dados.",
  "- O texto é uma sugestão e será revisado por um técnico responsável.",
  "Limites de referência (Portaria 888/2021):",
  ...LIMITES_PORTARIA.map((l) => "- " + l),
].join("\n");

function linhaDoParametro(k, nome, p) {
  if (p[k] === "") return `  ${nome}: não informado`;
  const motivo = avaliarParametro(k, p[k], p.tipo);
  if (motivo) return `  ${nome}: ${comUnidade(k, p[k])} — FORA DO PADRÃO (${motivo})`;
  if (k === "cloro" && ehCaptacao(p.tipo)) return `  ${nome}: ${comUnidade(k, p[k])} (sem limite na captação)`;
  return `  ${nome}: ${comUnidade(k, p[k])} (conforme)`;
}

const linhaMicro = (nome, v) =>
  `  ${nome}: ${v === "" ? "não informado" : v === "PRESENTE" ? "PRESENTE — FORA DO PADRÃO" : "AUSENTE (conforme)"}`;

function descreverPonto(p, i) {
  return [
    `Ponto ${i + 1} — tipo: ${p.tipo || "não informado"}`,
    ...PARAMETROS.map(([k, nome]) => linhaDoParametro(k, nome, p)),
    linhaMicro("Coliformes totais", p.colTotais),
    linhaMicro("E. coli", p.eColi),
  ].join("\n");
}

function promptDaJustificativa(d) {
  return [
    `Tratamento do sistema: ${d.tratamento || "não informado"}.`,
    `Tratamento em operação no dia da coleta: ${d.emOperacao || "não informado"}.`,
    "",
    "Resultados da coleta:",
    ...d.pontos.map(descreverPonto),
    "",
    'Tarefa: redija o texto do campo "Justificativa para amostras fora do padrão e ações" do relatório desta coleta.',
    "Formato: um parágrafo curto com a justificativa (hipóteses prováveis para cada não conformidade, citando o ponto e o valor informado), " +
      'seguido de "Ações recomendadas:" com 2 a 4 ações corretivas ou de verificação, em frases curtas. Máximo de 700 caracteres.',
  ].join("\n");
}

function promptDoResumo(d) {
  const comNC = d.sistemas.filter((s) => naoConformidades(s.pontos).length);
  return [
    `Mês de referência: ${MESES_EXTENSO[MESES.indexOf(d.mes)]}.`,
    `Sistemas com análise concluída no mês: ${d.sistemas.length}. Sistemas com não conformidade: ${comNC.length}.`,
    "",
    "Situação por sistema:",
    ...d.sistemas.map((s) => {
      const ncs = naoConformidades(s.pontos);
      return `- ${s.sistema} (tratamento: ${s.tratamento || "não informado"}): ` +
        (ncs.length ? ncs.map((x) => `Ponto ${x.ponto} [${x.tipo || "tipo não informado"}]: ${x.texto}`).join("; ") : "conforme");
    }),
    "",
    "Tarefa: redija o resumo do mês para a coordenação.",
    "Formato: (1) uma frase de visão geral com os totais informados; (2) as não conformidades por sistema; " +
      "(3) as prioridades de ação, da mais urgente para a menos urgente, tratando primeiro o risco microbiológico. Máximo de 900 caracteres.",
  ].join("\n");
}

/**
 * Monta as mensagens para o modelo: { system, user }.
 * Devolve null se o pedido for inválido ou se não houver nada fora do padrão a justificar.
 */
export function montarPrompt(tipo, dadosBrutos) {
  const d = limparDados(tipo, dadosBrutos);
  if (!d) return null;
  if (tipo === "justificativa") {
    if (!naoConformidades(d.pontos).length) return null;
    return { system: SISTEMA_BASE, user: promptDaJustificativa(d) };
  }
  return { system: SISTEMA_BASE, user: promptDoResumo(d) };
}

// ---------- resposta de exemplo (sem internet ou sem chave) ----------

// Texto fixo por tipo de não conformidade: [hipótese, ação]
const EXEMPLO = {
  micro: [
    "A presença de coliformes/E. coli indica possível falha na desinfecção ou contaminação no reservatório ou na rede (hipótese a verificar).",
    "orientar a comunidade a tratar a água no domicílio até a normalização; inspecionar e higienizar o reservatório; reforçar a desinfecção e realizar nova coleta",
  ],
  cloroBaixo: [
    "O cloro residual abaixo do mínimo sugere subdosagem ou falha no dosador (hipótese a verificar).",
    "verificar o dosador e ajustar a dosagem de cloro; medir novamente o cloro residual na saída do tratamento e na ponta de rede",
  ],
  cloroAlto: [
    "O cloro residual acima do máximo sugere dosagem excessiva (hipótese a verificar).",
    "reduzir a dosagem de cloro e medir novamente o cloro residual",
  ],
  turb: [
    "A turbidez elevada pode estar associada ao arraste de sedimentos na rede ou no reservatório (hipótese a verificar).",
    "realizar descarga da rede e limpeza do reservatório; repetir a análise de turbidez",
  ],
  cor: [
    "A cor elevada pode estar associada a característica do manancial ou a sedimentos na rede (hipótese a verificar).",
    "realizar descarga da rede e repetir a análise de cor",
  ],
  ph: [
    "O pH fora da faixa pode refletir característica natural do manancial (hipótese a verificar).",
    "repetir a medição com o equipamento calibrado e acompanhar o pH nas próximas coletas",
  ],
};
const ORDEM_EXEMPLO = ["micro", "cloroBaixo", "cloroAlto", "turb", "cor", "ph"]; // do mais urgente para o menos

function classeDaNC(x) {
  if (x.chave === "colTotais" || x.chave === "eColi") return "micro";
  if (x.chave === "cloro") return x.motivo.startsWith("abaixo") ? "cloroBaixo" : "cloroAlto";
  return x.chave;
}
const classesPresentes = (ncs) => ORDEM_EXEMPLO.filter((k) => ncs.some((x) => classeDaNC(x) === k));
const maiuscula = (t) => t[0].toUpperCase() + t.slice(1);

/** Texto fixo de exemplo, montado só com os valores informados (nada é inventado). */
export function respostaDeExemplo(tipo, dadosBrutos) {
  const d = limparDados(tipo, dadosBrutos);
  if (!d) return "Não há dados suficientes para gerar o texto.";

  if (tipo === "justificativa") {
    const ncs = naoConformidades(d.pontos);
    if (!ncs.length) return "Todos os parâmetros informados estão dentro do padrão; não há o que justificar.";
    const classes = classesPresentes(ncs);
    return `Resultados fora do padrão: ${listaPorPonto(ncs)}. ` +
      classes.map((k) => EXEMPLO[k][0]).join(" ") +
      " Ações recomendadas: " + classes.map((k) => EXEMPLO[k][1]).join("; ") + ".";
  }

  const comNC = d.sistemas.map((s) => ({ s, ncs: naoConformidades(s.pontos) })).filter((x) => x.ncs.length);
  const linhas = [
    `Resumo de ${MESES_EXTENSO[MESES.indexOf(d.mes)]}: ${d.sistemas.length} sistema(s) com análise concluída, ${comNC.length} com não conformidade.`,
  ];
  if (!comNC.length) return linhas[0] + " Nenhuma ação corretiva pendente.";
  linhas.push("", "Não conformidades por sistema:", ...comNC.map((x) => `- ${x.s.sistema}: ${listaPorPonto(x.ncs)}`));
  linhas.push("", "Prioridades de ação:");
  classesPresentes(comNC.flatMap((x) => x.ncs)).forEach((k, i) => {
    const onde = comNC.filter((x) => x.ncs.some((nc) => classeDaNC(nc) === k)).map((x) => x.s.sistema).join(", ");
    linhas.push(`${i + 1}. ${onde}: ${maiuscula(EXEMPLO[k][1])}.`);
  });
  return linhas.join("\n");
}

// ---------- chamada (navegador) ----------

/**
 * Pede o texto à função /api/sugerir. Nunca falha: sem internet, sem chave no servidor ou com erro,
 * devolve a resposta de exemplo. Retorna { texto, origem: "ia" | "exemplo" }.
 */
export async function pedirSugestao(tipo, dados, { buscar = globalThis.fetch, online = true, limiteMs = 20000 } = {}) {
  const exemplo = () => ({ texto: respostaDeExemplo(tipo, dados), origem: "exemplo" });
  if (!online || !buscar || !limparDados(tipo, dados)) return exemplo();
  try {
    const r = await buscar(ROTA_IA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, dados }),
      signal: AbortSignal.timeout?.(limiteMs),
    });
    if (!r.ok) return exemplo();
    const texto = String((await r.json())?.texto || "").trim();
    return texto ? { texto, origem: "ia" } : exemplo();
  } catch {
    return exemplo();
  }
}
