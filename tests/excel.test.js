import { test } from "node:test";
import assert from "node:assert/strict";
import { celulasDaColeta, textoObservacoes, conteudoDaAba, xmlDaAba, arquivosDaPlanilhaDemo } from "../js/excel.js";

const coleta = {
  mes: "SET", linha: 5, dataColeta: "2026-09-24", dataAnalise: "2026-09-24", dataAnalise2: "2026-09-25",
  responsavel: "Analista de Laboratório (exemplo)", tratamentoEmOperacao: "", justificativa: "", observacoes: "",
  coordenadasNasObservacoes: true,
  pontos: [
    { identificacao: "Captação 1", tipo: "CAPTAÇÃO SUBTERRÂNEA", coord: "-10.123456; -50.123456", ph: "5.59", cor: "6", turb: "0.0", cloro: "0.2", colTotais: "AUSENTE", eColi: "AUSENTE" },
    { identificacao: "Captação 1", tipo: "SAÍDA DO RESERVATÓRIO COM ÁGUA TRATADA", coord: "", ph: "5,33", cor: "", turb: "0.0", cloro: "0,0", colTotais: "", eColi: "AUSENTE" },
  ],
};

const sistemas = [
  { linha: 5, id: 1, polo: "POLO A", municipio: "MUNICÍPIO A", aldeia: "ALDEIA DEMO 1", siasi: 90001, sistema: "SAA 1", tipo: "SAA", populacao: 420, pontosCaptacao: 1, pontosAmostragem: 3, tratamento: "SIM, COM DESINFECÇÃO" },
  { linha: 6, id: 2, polo: "POLO A", municipio: "MUNICÍPIO A", aldeia: "ALDEIA DEMO 1", siasi: 90001, sistema: "SAA 2", tipo: "SAA", populacao: 420, pontosCaptacao: 1, pontosAmostragem: 3, tratamento: "SIM, COM DESINFECÇÃO" },
];

test("ponto 1 vai para Q–X e ponto 2 para Y–AF", () => {
  const c = celulasDaColeta(coleta);
  assert.equal(c.Q, "Captação 1");
  assert.equal(c.R, "CAPTAÇÃO SUBTERRÂNEA");
  assert.equal(c.S, 5.59);
  assert.equal(c.V, 0.2);
  assert.equal(c.X, "AUSENTE");
  assert.equal(c.AA, 5.33);
  assert.equal(c.AD, 0);
});

test("parâmetro em branco fica vazio, nunca 0", () => {
  const c = celulasDaColeta(coleta);
  assert.equal(c.AB, null); // cor do ponto 2
  assert.equal(c.AE, null); // coliformes do ponto 2
});

test("data da análise vira data do Excel e responsável vai para CD", () => {
  const c = celulasDaColeta(coleta);
  assert.equal(c.CC, 46289); // 24/09/2026
  assert.equal(c.CD, "Analista de Laboratório (exemplo)");
  assert.equal(c.O, null);
});

test("observações incluem datas e coordenadas", () => {
  assert.equal(textoObservacoes(coleta), "Coleta em 24/09/2026; análises em 24/09/2026 e 25/09/2026. Coordenadas: P1 (-10.123456; -50.123456)");
});

test("aba da planilha modelo: aviso de demonstração, cadastro e coleta na linha do sistema", () => {
  const aba = conteudoDaAba("SET", 2026, sistemas, [coleta]);
  assert.equal(aba[1].A, "Coleta MQAI — Demo · Planilha modelo");
  assert.equal(aba[2].A, "DEMONSTRAÇÃO — DADOS FICTÍCIOS · Setembro de 2026");
  assert.equal(aba[4].G, "Aldeia");
  assert.equal(aba[4].S, "Ponto 1 · pH");
  assert.equal(aba[5].G, "ALDEIA DEMO 1");
  assert.equal(aba[5].D, "MUNICÍPIO A");
  assert.equal(aba[5].S, 5.59);
  assert.equal(aba[6].I, "SAA 2");
  assert.equal(aba[6].S, undefined); // sistema sem coleta no mês: só o cadastro
});

test("aba de outro mês traz só o cadastro; duas coletas no mês: vale a mais recente", () => {
  assert.equal(conteudoDaAba("OUT", 2026, sistemas, [coleta])[5].S, undefined);
  const nova = { ...coleta, dataColeta: "2026-09-28", pontos: [{ ...coleta.pontos[0], ph: "7.1" }] };
  const aba = conteudoDaAba("SET", 2026, sistemas, [nova, coleta]);
  assert.equal(aba[5].S, 7.1);
  assert.equal(aba[5].AA, undefined); // o ponto 2 da coleta antiga não sobra na linha
});

test("XML da aba: células em ordem, texto escapado e vazios omitidos", () => {
  const xml = xmlDaAba({ 5: { CC: 46289, G: "A & B <c>", S: 5.59, T: null } });
  assert.ok(xml.includes(`<row r="5"><c r="G5" t="inlineStr"><is><t xml:space="preserve">A &amp; B &lt;c&gt;</t></is></c><c r="S5"><v>5.59</v></c><c r="CC5" s="2"><v>46289</v></c></row>`));
  assert.equal(xml.includes("T5"), false);
});

test("planilha modelo tem 12 abas (JAN…DEZ) e nenhum arquivo externo", () => {
  const arquivos = arquivosDaPlanilhaDemo([coleta], sistemas, 2026);
  assert.equal(Object.keys(arquivos).filter((a) => a.startsWith("xl/worksheets/")).length, 12);
  assert.ok(arquivos["xl/workbook.xml"].includes(`<sheet name="SET" sheetId="9" r:id="rId9"/>`));
  assert.ok(arquivos["xl/worksheets/sheet9.xml"].includes("ALDEIA DEMO 1"));
  assert.ok(arquivos["[Content_Types].xml"].includes("/xl/worksheets/sheet12.xml"));
});
