// Configurações e regras de negócio fixas do app (sem dependência de navegador).

export const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
export const MESES_EXTENSO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Tipos de ponto de coleta .
export const TIPOS_PONTO = [
  "CAPTAÇÃO SUPERFICIAL", "CAPTAÇÃO SUBTERRÂNEA", "CAPTAÇÃO ÁGUA DE CHUVA",
  "SAÍDA DO RESERVATÓRIO COM ÁGUA TRATADA", "SAÍDA DO RESERVATÓRIO COM ÁGUA BRUTA", "SAÍDA DO DISPOSITIVO DE TRATAMENTO",
  "CHAFARIZ (COLETIVO)", "CASA (OU CHAFARIZ INDIVIDUAL)", "ESPAÇO COMUNITÁRIO", "CISTERNA ÁGUA DE CHUVA",
];

// Pontos 1 a 3 têm tipos restritos (captação → saída do tratamento → consumo); do 4º em diante, qualquer tipo.
export const TIPOS_POR_PONTO = [TIPOS_PONTO.slice(0, 3), TIPOS_PONTO.slice(3, 6), TIPOS_PONTO.slice(6, 10)];
export const NOMES_PONTOS = ["Ponto 1 · Captação", "Ponto 2 · Saída do tratamento/reservatório", "Ponto 3 · Consumo (ponta de rede)"];
export const MAX_PONTOS = 8;
export const PONTOS_ESSENCIAIS = 3;

// Valores de referência (Portaria 888/2021).
export const VR = { ph: [6, 9], cor: [null, 15], turb: [null, 5], cloro: [0.2, 5] };

// Área aceita para as coordenadas: o Brasil inteiro, com margem.
// Coordenada fora deste retângulo é tratada como erro de digitação (ex.: esqueceu o sinal de menos).
export const REGIAO = { lat: [-33.8, 5.3], lon: [-74.1, -34.6] };

// GPS: para de procurar quando chega nesta precisão ou quando acaba o tempo (fica com a melhor leitura).
export const GPS = { precisaoDesejadaM: 15, tempoMaximoS: 20, precisaoRuimM: 50 };

// Parâmetros numéricos: chave interna, rótulo, unidade.
export const PARAMETROS = [
  ["ph", "pH", ""],
  ["cor", "Cor", "uH"],
  ["turb", "Turbidez", "uT"],
  ["cloro", "Cloro", "mg/L"],
];
export const RESULTADOS_MICRO = ["AUSENTE", "PRESENTE"];

// Etapas da coleta: em campo ("coletada") → resultado completo ("analisada") → na planilha.
export const ETAPAS = ["coletada", "analisada"];
// A análise normalmente sai no dia seguinte à coleta. Acima disso, o app mostra um alerta.
export const PRAZO_ANALISE_DIAS = 1;

// Mapeamento das colunas da planilha modelo da demo (abas JAN…DEZ), gerada por js/excel.js.
// Cada sistema ocupa a linha indicada em data/sistemas.json ("linha").
export const PLANILHA = {
  linhaCabecalho: 4,
  colunaPrimeiroPonto: 17, // Q
  colunasPorPonto: 8,      // identificação, tipo, pH, cor, turbidez, cloro, colif. totais, E. coli
  colunas: { aldeia: "G", operacao: "O", justificativa: "P", dataAnalise: "CC", responsavel: "CD", observacoes: "CE" },
  // Cadastro do sistema (campo de data/sistemas.json → coluna)
  cadastro: { id: "B", polo: "C", municipio: "D", aldeia: "G", siasi: "H", sistema: "I", tipo: "J", populacao: "K", pontosCaptacao: "L", pontosAmostragem: "M", tratamento: "N" },
};

export const NOME_APP = "Coleta MQAI — Demo";
export const AVISO_DEMO = "DEMONSTRAÇÃO — DADOS FICTÍCIOS";

// Textos fixos do relatório PDF (cabeçalho neutro da demo).
export const RELATORIO = {
  cabecalho: [
    "COLETA MQAI — DEMO",
    "Monitoramento da Qualidade da Água",
    "Relatório de análises físico-químicas e microbiológicas",
  ],
  colunasTabela: ["Cloro (mg/L)", "Turbidez", "pH", "Cor (uH)", "Coliformes totais", "E. Coli."],
  notas: [
    "Valores de referência (Portaria 888/2021):",
    "- Cloro residual livre = 0,2 a 5,0 mg/L (exceto na captação);",
    "- Coliformes totais e E. Coli = ausência em 100 mL;",
    "- VMP = valor máximo permitido;",
    "- Turbidez (VMP) = 5 uT;",
    "- pH = 6,0 a 9,0;",
    "- Cor aparente (VMP) = 15 uH.",
  ],
};
