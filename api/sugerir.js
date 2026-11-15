// Função serverless (Vercel, Node 20+, sem dependências): pede ao LLM da Groq a sugestão de
// justificativa/ações ou o resumo do mês.
//
// - A chave fica só no servidor (variável de ambiente GROQ_API_KEY); o navegador nunca a recebe.
// - O navegador envia { tipo, dados } com dados técnicos; o prompt é montado aqui (js/ia.js),
//   depois de descartar qualquer campo que não seja um dado técnico conhecido.
// - Sem chave (503) ou com erro (502): o app mostra a resposta de exemplo.
import { montarPrompt, TIPOS_DE_PEDIDO } from "../js/ia.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELO = "llama-3.3-70b-versatile";
const LIMITE_MS = 15000;
const TAMANHO_MAX_PEDIDO = 60000; // caracteres do JSON recebido

/** Aceita só chamadas do próprio site (o navegador sempre envia Origin em POST). */
function mesmaOrigem(req) {
  const origem = req.headers.origin;
  if (!origem) return true;
  try {
    return new URL(origem).host === req.headers.host;
  } catch {
    return false;
  }
}

function lerCorpo(req) {
  let corpo = req.body;
  if (typeof corpo === "string") {
    if (corpo.length > TAMANHO_MAX_PEDIDO) return null;
    try {
      corpo = JSON.parse(corpo);
    } catch {
      return null;
    }
  }
  if (!corpo || typeof corpo !== "object") return null;
  return JSON.stringify(corpo).length > TAMANHO_MAX_PEDIDO ? null : corpo;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Use POST." });
  }
  if (!mesmaOrigem(req)) return res.status(403).json({ erro: "Origem não permitida." });

  const chave = process.env.GROQ_API_KEY;
  if (!chave) return res.status(503).json({ erro: "sem_chave" });

  const corpo = lerCorpo(req);
  const prompt = corpo && TIPOS_DE_PEDIDO.includes(corpo.tipo) ? montarPrompt(corpo.tipo, corpo.dados) : null;
  if (!prompt) return res.status(400).json({ erro: "Pedido inválido ou sem resultado fora do padrão." });

  try {
    const resposta = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO,
        temperature: 0.2,
        max_tokens: 1500,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      }),
      signal: AbortSignal.timeout(LIMITE_MS),
    });
    if (!resposta.ok) {
      console.error("Groq respondeu", resposta.status);
      return res.status(502).json({ erro: "ia_indisponivel" });
    }
    const dados = await resposta.json();
    const texto = String(dados?.choices?.[0]?.message?.content || "").trim();
    if (!texto) return res.status(502).json({ erro: "ia_indisponivel" });
    return res.status(200).json({ texto, modelo: MODELO });
  } catch (e) {
    console.error("Falha ao chamar a Groq:", e?.name || e);
    return res.status(502).json({ erro: "ia_indisponivel" });
  }
}
