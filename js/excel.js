// Planilha modelo da demo (.xlsx), gerada do zero no aparelho — sem arquivo de modelo externo.
// Um .xlsx é um .zip com XML dentro: este módulo monta os XML (funções puras, testadas no Node)
// e o JSZip só empacota. Cada mês é uma aba (JAN…DEZ) com o cadastro dos sistemas e as coletas.
import { MESES, MESES_EXTENSO, PLANILHA, MAX_PONTOS, AVISO_DEMO, NOME_APP } from "./config.js";
import { numero, dataBR, serialExcel, numeroColuna, letrasColuna } from "./util.js";
import { carregarJSZip } from "./bibliotecas.js";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PACOTE = "http://schemas.openxmlformats.org/package/2006";
const C = PLANILHA.colunas;

// Estilos das células (posição em <cellXfs> de ESTILOS_XML)
const NEGRITO = 1, DATA = 2;

/**
 * Quais células escrever para uma coleta: { "S": 5.59, "W": "AUSENTE", ... }.
 * null = deixar a célula vazia (parâmetro não analisado nunca vira 0). Função pura.
 */
export function celulasDaColeta(coleta) {
  const cel = {};
  cel[C.operacao] = coleta.tratamentoEmOperacao || null;
  cel[C.justificativa] = coleta.justificativa || null;
  coleta.pontos.forEach((p, i) => {
    const base = PLANILHA.colunaPrimeiroPonto + PLANILHA.colunasPorPonto * i;
    cel[letrasColuna(base)] = p.identificacao || null;
    cel[letrasColuna(base + 1)] = p.tipo || null;
    ["ph", "cor", "turb", "cloro"].forEach((k, j) => {
      const n = numero(p[k]);
      cel[letrasColuna(base + 2 + j)] = n === null || Number.isNaN(n) ? null : n;
    });
    cel[letrasColuna(base + 6)] = p.colTotais || null;
    cel[letrasColuna(base + 7)] = p.eColi || null;
  });
  cel[C.dataAnalise] = coleta.dataAnalise ? serialExcel(coleta.dataAnalise) : null;
  cel[C.responsavel] = coleta.responsavel || null;
  cel[C.observacoes] = textoObservacoes(coleta);
  return cel;
}

export function textoObservacoes(coleta) {
  const partes = [];
  if (coleta.observacoes) partes.push(coleta.observacoes);
  partes.push(`Coleta em ${dataBR(coleta.dataColeta)}` +
    (coleta.responsavelColeta ? ` por ${coleta.responsavelColeta}` : "") +
    (coleta.dataAnalise2 ? `; análises em ${dataBR(coleta.dataAnalise)} e ${dataBR(coleta.dataAnalise2)}` : ""));
  if (coleta.coordenadasNasObservacoes !== false) {
    const cs = coleta.pontos.map((p, i) => (p.coord ? `P${i + 1} (${p.coord})` : null)).filter(Boolean);
    if (cs.length) partes.push("Coordenadas: " + cs.join("; "));
  }
  return partes.join(". ");
}

// ---------- conteúdo de cada aba (funções puras) ----------

/** Títulos das colunas (linha PLANILHA.linhaCabecalho). */
export function cabecalhoDaAba() {
  const cab = {
    B: "Nº", C: "Polo", D: "Município", G: "Aldeia", H: "Código", I: "Sistema", J: "Tipo", K: "População",
    L: "Pontos de captação", M: "Pontos de amostragem", N: "Tratamento",
    [C.operacao]: "Tratamento em operação?",
    [C.justificativa]: "Justificativa (fora do padrão) e ações",
    [C.dataAnalise]: "Data da análise",
    [C.responsavel]: "Responsável técnico",
    [C.observacoes]: "Observações",
  };
  const campos = ["Identificação", "Tipo", "pH", "Cor (uH)", "Turbidez (uT)", "Cloro (mg/L)", "Coliformes totais", "E. coli"];
  for (let i = 0; i < MAX_PONTOS; i++) {
    campos.forEach((t, j) => {
      cab[letrasColuna(PLANILHA.colunaPrimeiroPonto + PLANILHA.colunasPorPonto * i + j)] = `Ponto ${i + 1} · ${t}`;
    });
  }
  return cab;
}

/**
 * Conteúdo de uma aba mensal: { nºDaLinha: { coluna: valor } }.
 * Linhas 1–2: título e aviso de demonstração; linha 4: títulos; depois uma linha por sistema.
 * Se houver duas coletas do mesmo sistema no mês, vale a mais recente.
 */
export function conteudoDaAba(mes, ano, sistemas, coletas) {
  const linhas = {
    1: { A: `${NOME_APP} · Planilha modelo` },
    2: { A: `${AVISO_DEMO} · ${MESES_EXTENSO[MESES.indexOf(mes)]} de ${ano}` },
    [PLANILHA.linhaCabecalho]: cabecalhoDaAba(),
  };
  sistemas.forEach((s) => {
    const cel = {};
    for (const [campo, col] of Object.entries(PLANILHA.cadastro)) cel[col] = s[campo] ?? null;
    linhas[s.linha] = cel;
  });
  coletas
    .filter((c) => c.mes === mes && linhas[c.linha] && Number(c.linha) > PLANILHA.linhaCabecalho)
    .sort((a, b) => (a.dataColeta || "").localeCompare(b.dataColeta || ""))
    .forEach((c) => {
      const cel = linhas[c.linha];
      // Apaga os pontos de uma coleta anterior do mesmo sistema antes de escrever a mais recente.
      for (let n = PLANILHA.colunaPrimeiroPonto; n <= numeroColuna(C.observacoes); n++) delete cel[letrasColuna(n)];
      Object.assign(cel, celulasDaColeta(c));
    });
  return linhas;
}

// Texto seguro para XML (sem caracteres de controle, que corrompem o arquivo).
const escXml = (v) => String(v)
  .replace(/[^\x09\x0A\x0D\x20-퟿-�]/g, "")
  .replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));

function xmlDaCelula(ref, valor, estilo) {
  const s = estilo ? ` s="${estilo}"` : "";
  if (typeof valor === "number") return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escXml(valor)}</t></is></c>`;
}

/** XML de uma aba a partir do conteúdo (linhas e colunas em ordem crescente, como o Excel exige). */
export function xmlDaAba(linhas) {
  const corpo = Object.keys(linhas).map(Number).sort((a, b) => a - b).map((n) => {
    const celulas = Object.entries(linhas[n])
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .sort(([a], [b]) => numeroColuna(a) - numeroColuna(b))
      .map(([col, v]) => {
        const titulo = n <= PLANILHA.linhaCabecalho;
        const estilo = titulo ? NEGRITO : col === C.dataAnalise && typeof v === "number" ? DATA : 0;
        return xmlDaCelula(col + n, v, estilo);
      });
    return `<row r="${n}">${celulas.join("")}</row>`;
  });
  const ultima = numeroColuna(C.observacoes);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="${NS}">` +
    `<sheetViews><sheetView workbookViewId="0"><pane xSplit="9" ySplit="${PLANILHA.linhaCabecalho}" topLeftCell="J${PLANILHA.linhaCabecalho + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>` +
    `<cols><col min="1" max="6" width="11" customWidth="1"/><col min="7" max="7" width="22" customWidth="1"/><col min="8" max="${ultima}" width="18" customWidth="1"/></cols>` +
    `<sheetData>${corpo.join("")}</sheetData></worksheet>`;
}

const ESTILOS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="${NS}">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs></styleSheet>`;

/** Todos os arquivos internos do .xlsx: { "xl/workbook.xml": "<…>", … }. Função pura. */
export function arquivosDaPlanilhaDemo(coletas, sistemas, ano) {
  const arquivos = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="${NS_PACOTE}/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      MESES.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      `</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="${NS_PACOTE}/relationships">` +
      `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="${NS}" xmlns:r="${NS_REL}"><sheets>` +
      MESES.map((m, i) => `<sheet name="${m}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
      `</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="${NS_PACOTE}/relationships">` +
      MESES.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${MESES.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": ESTILOS_XML,
  };
  MESES.forEach((m, i) => {
    arquivos[`xl/worksheets/sheet${i + 1}.xml`] = xmlDaAba(conteudoDaAba(m, ano, sistemas, coletas));
  });
  return arquivos;
}

export const nomeDaPlanilhaDemo = (ano) => `Planilha modelo MQAI (demo) - ${ano}.xlsx`;

/**
 * Gera a planilha modelo com as coletas e devolve { arquivo: Blob, registro: string[] }.
 * @param {object[]} coletas   coletas analisadas a incluir
 * @param {object[]} sistemas  cadastro (data/sistemas.json)
 */
export async function gerarPlanilhaDemo(coletas, sistemas, ano = new Date().getFullYear()) {
  await carregarJSZip();
  const zip = new JSZip();
  for (const [caminho, xml] of Object.entries(arquivosDaPlanilhaDemo(coletas, sistemas, ano))) zip.file(caminho, xml);
  const arquivo = await zip.generateAsync({
    type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 },
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const registro = coletas.map((c) => {
    const s = sistemas.find((x) => x.linha === Number(c.linha));
    return `${c.mes} · linha ${c.linha} · ${s ? `${s.aldeia.trim()} ${s.sistema}` : ""}`;
  });
  return { arquivo, registro };
}
