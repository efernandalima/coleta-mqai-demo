// Bibliotecas grandes (PDF e Excel) são carregadas só quando forem usadas.
// Assim o app abre mais rápido. Funcionam sem internet: o sw.js guarda os arquivos no aparelho.
const carregando = {};

function carregarScript(src) {
  if (!carregando[src]) {
    carregando[src] = new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => ok();
      s.onerror = () => {
        delete carregando[src]; // permite tentar de novo
        falha(new Error("Não foi possível carregar o gerador de arquivos. Abra o aplicativo com internet uma vez e tente novamente."));      };
      document.head.append(s);
    });
  }
  return carregando[src];
}

export const carregarJsPDF = () => carregarScript("vendor/jspdf.umd.min.js");
export const carregarJSZip = () => carregarScript("vendor/jszip.min.js");