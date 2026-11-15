# Coleta MQAI — Demo

> **Demo com dados fictícios. A versão original é usada em campo e não é pública.**

App de celular (PWA) para registrar coletas de **monitoramento da qualidade da água** em pequenas comunidades. Funciona **sem internet**, confere os resultados pela **Portaria 888/2021** na hora da digitação, gera o **relatório em PDF** e a **planilha**, e usa **IA** para sugerir a justificativa das não conformidades e resumir o mês.

**Demo:** <https://SEU-PROJETO.vercel.app> <!-- TODO: trocar pelo link da Vercel -->

<!-- TODO: GIF do fluxo completo (≈20 s): Carregar exemplos → Editar coleta fora do padrão → Sugerir justificativa (IA) → Relatório PDF -->
<!-- ![Fluxo do app](docs/img/fluxo.gif) -->

| Nova coleta | Alerta de não conformidade + IA | Painel do mês | Relatório PDF |
|---|---|---|---|
| _print_ <!-- ![](docs/img/nova-coleta.png) --> | _print_ <!-- ![](docs/img/ia-justificativa.png) --> | _print_ <!-- ![](docs/img/painel.png) --> | _print_ <!-- ![](docs/img/relatorio.png) --> |

## O problema

No processo original, cada coleta passava por quatro etapas manuais:

```
caderno de campo  →  planilha Excel  →  documento Word  →  relatório
```

O mesmo dado era **digitado 3 vezes**. Cada redigitação era uma chance de erro, um resultado fora do padrão só era percebido dias depois (já no escritório) e o fechamento do mês dependia de uma pessoa juntar tudo à mão.

## A solução

O dado é digitado **uma vez, no local da coleta**, e tudo o mais sai dele:

- **Formulário de campo** por sistema de abastecimento e ponto de coleta (captação → saída do tratamento → ponta de rede): pH, cor, turbidez, cloro, coliformes totais, E. coli e coordenadas por GPS.
- **Validação imediata** pela Portaria 888/2021: o app separa o que está *fora do padrão* (exige justificativa) do que é *erro de digitação* (pH 15, coordenada sem o sinal de menos), que bloqueia a conclusão até ser corrigido.
- **Funciona offline**: os dados ficam no aparelho; o app abre e salva sem sinal.
- **Relatório em PDF** por coleta ou do mês inteiro, e **planilha .xlsx** com uma aba por mês — gerados no próprio celular.
- **Painel do mês**: quais sistemas estão pendentes, aguardando análise, analisados ou já na planilha.

## Fluxo

```
1. Nova coleta      em campo: sistema, pontos, coordenadas (GPS) → salva como "aguardando análise"
2. Registrar análise  no dia seguinte: resultados → alertas da Portaria em tempo real
3. Justificar       se houver não conformidade: justificativa e ações (com sugestão da IA)
4. Concluir análise   o app confere pendências e libera a coleta
5. Exportar         relatório PDF · planilha .xlsx · resumo do mês (IA)
```

**Para testar em 1 minuto:** aba **Salvas → Carregar exemplos** (6 coletas fictícias: 2 conformes, 3 fora do padrão e 1 aguardando análise) → **Editar** uma coleta fora do padrão → **Sugerir justificativa e ações (IA)** → aba **Exportar → Resumo do mês (IA)**. **Reiniciar demo** apaga tudo.

## Onde a IA entra

| Onde | O que faz |
|---|---|
| Formulário, quando há parâmetro fora do padrão | **Sugerir justificativa e ações (IA)**: preenche o campo de justificativa com um texto editável, com o aviso *"Sugestão gerada por IA — revise antes de salvar"*. |
| Tela Exportar | **Resumo do mês (IA)**: texto curto com as não conformidades por sistema e as prioridades de ação. |

Como foi construído:

- **A chave nunca vai para o front-end.** O navegador chama `/api/sugerir`, uma função serverless (Vercel, sem dependências) que lê `GROQ_API_KEY` do ambiente e chama a API da Groq (modelo `llama-3.3-70b-versatile`).
- **Só dados técnicos saem do aparelho**: tipo de ponto, parâmetros, valores e limites da Portaria. Nomes de pessoas, coordenadas, datas e textos livres não são enviados (há teste automático para isso).
- **O prompt é montado no servidor**, não no navegador. O servidor descarta qualquer campo que não seja um dado técnico conhecido e recalcula a conformidade com as mesmas regras do app — o que chega do navegador não é tratado como instrução.
- **Prompt em português, técnico e restritivo**: usar somente os dados informados, não inventar valores, tratar parâmetro em branco como "não informado" e apresentar causas como hipóteses a verificar.
- **A IA sugere; a pessoa decide.** O texto é sempre editável e a responsabilidade pela justificativa continua com o técnico.
- **A demo sempre funciona**: sem internet ou sem chave configurada, o app mostra uma resposta de exemplo fixa, marcada como **exemplo**.

## Decisões técnicas

- **Offline-first.** A coleta acontece onde não há sinal. O service worker guarda o app inteiro no aparelho e os dados ficam em armazenamento local; a rede só é usada para a IA, que é opcional.
- **Sem build e sem framework.** HTML, CSS e JavaScript com módulos ES nativos. Publicar é copiar os arquivos; qualquer pessoa da equipe consegue abrir e entender o código, e não há cadeia de dependências para manter.
- **Regras de negócio em módulos puros.** A validação da Portaria 888/2021, as etapas da coleta, o mapeamento da planilha e a montagem do prompt não dependem do navegador e são cobertos por testes (`node --test`, sem biblioteca de testes).
- **"Não analisado" nunca vira zero.** Campo em branco fica em branco na planilha, no PDF e no prompt da IA.
- **Arquivos gerados no aparelho.** O PDF (jsPDF) e o .xlsx (XML montado à mão + JSZip) são criados no celular, sem servidor.
- **Segurança.** Content-Security-Policy restrita ao próprio site, todo texto digitado é escapado antes de ir para a tela e as cópias de segurança importadas são validadas campo a campo.

Mais detalhes em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Como rodar

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo. Não há dependências para instalar.

```bash
npm run dev     # abre em http://localhost:5173 (a IA responde com o exemplo)
npm test        # roda os testes
```

Para testar a IA de verdade no computador, use a CLI da Vercel, que também executa a função `/api/sugerir`:

```bash
npx vercel dev  # com GROQ_API_KEY definida em um arquivo .env.local
```

### Publicar na Vercel

1. Importe o repositório em **Add New → Project**, com Framework Preset **Other** (sem comando de build).
2. Em **Settings → Environment Variables**, crie `GROQ_API_KEY` com uma chave gratuita de <https://console.groq.com>.
3. Faça o deploy. Sem a chave, o app funciona normalmente e a IA mostra a resposta de exemplo.

Ao publicar uma versão nova, aumente `VERSAO` em `sw.js` (e inclua arquivos novos em `ARQUIVOS`) para os aparelhos receberem a atualização.

## Estrutura

```
index.html            telas do app
css/                  estilos
js/
  config.js           limites da Portaria, tipos de ponto, colunas da planilha
  validacao.js        regras de conformidade
  etapas.js           coletada → analisada → na planilha
  ia.js               dados técnicos, montagem do prompt e resposta de exemplo
  exemplos.js         as 6 coletas fictícias da demo
  excel.js            planilha modelo (.xlsx)
  relatorio-pdf.js    relatório PDF
  storage.js          coletas guardadas no aparelho
  ui/                 telas: formulário, lista, painel, exportar
api/sugerir.js        função serverless que chama o LLM (a chave fica só aqui)
data/sistemas.json    8 sistemas fictícios em 3 municípios fictícios
sw.js                 funcionamento offline
tests/                testes automáticos
```

## Sobre

Desenvolvido por **Fernanda Lima**.

Demo com dados fictícios. A versão original é usada em campo e não é pública.
