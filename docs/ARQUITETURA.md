# Arquitetura

> Demo com dados fictícios. A versão original é usada em campo e não é pública.

## Visão geral

PWA (Progressive Web App) **offline-first**. Toda a lógica roda no celular; a Vercel entrega arquivos estáticos e uma única função serverless, usada só pela IA.

- **Linguagem:** JavaScript (ES Modules nativos do navegador), HTML e CSS. Sem framework e sem etapa de build.
- **Bibliotecas:** JSZip (empacotar o .xlsx) e jsPDF (gerar PDF), guardadas em `vendor/` para funcionar sem internet.
- **Armazenamento:** `localStorage` do aparelho, isolado no módulo `js/storage.js`.
- **Offline:** `sw.js` (service worker) guarda todos os arquivos do app no aparelho. Chamadas a `/api/` nunca passam pelo cache.
- **IA:** `api/sugerir.js` (função serverless, Node 20+, sem dependências) chama a API da Groq com a chave que fica só no servidor.

## Camadas

```
            ┌──────────────────────────── Interface (js/ui/) ────────────────────────────┐
            │ formulario.js   lista.js   painel.js   exportar.js   navegacao.js  toast.js │
            └───────┬──────────────┬─────────────────┬──────────────────────────────────┘
                    │              │                 │        (eventos.js liga as telas)
            ┌───────▼──────────────▼─────────────────▼──────────────────────────────────┐
  Domínio   │ validacao.js (Portaria 888/2021)   etapas.js   painel.js   lembrete.js     │
            │ excel.js (planilha modelo)   relatorio-pdf.js   ia.js   exemplos.js        │
            │ config.js (limites, tipos de ponto, colunas da planilha, textos do PDF)    │
            └───────┬──────────────────────────────────────────────┬────────────────────┘
            ┌───────▼───────────────┐   ┌──────────────────────┐   │ { tipo, dados técnicos }
  Dados     │ storage.js (coletas)  │   │ sistemas.js          │   ▼
            └───────────────────────┘   └──────────▲───────────┘  api/sugerir.js ──► LLM (Groq)
                                          data/sistemas.json       (usa js/ia.js para montar o prompt)
```

Regras:

- As telas (`js/ui/`) não falam umas com as outras diretamente; usam `eventos.js` (`coletas-alteradas`, `coletas-apagadas`, `editar-coleta`, `mostrar-tela`).
- Toda leitura/escrita de coletas passa por `storage.js`. Nenhuma tela usa `localStorage` direto.
- `validacao.js`, `etapas.js`, `painel.js`, `ia.js`, `exemplos.js`, `config.js`, `util.js` e a montagem da planilha em `excel.js` são puros e têm testes (`npm test`).
- Regras que mudam com a planilha ou a portaria ficam em `config.js` e `data/sistemas.json`, não espalhadas pelo código.

## Modelo de dados (coleta)

```json
{
  "id": "c1abc", "mes": "SET", "linha": 5, "status": "coletada | analisada",
  "dataColeta": "2026-09-24", "dataAnalise": "2026-09-25", "dataAnalise2": "",
  "responsavelColeta": "…", "responsavel": "…", "tratamentoEmOperacao": "SIM | NÃO | ",
  "justificativa": "…", "observacoes": "…", "coordenadasNasObservacoes": true,
  "pontos": [
    { "identificacao": "Captação 1", "tipo": "CAPTAÇÃO SUBTERRÂNEA", "coord": "-10.123456; -50.123456",
      "ph": "5.59", "cor": "6", "turb": "0.0", "cloro": "0.2", "colTotais": "AUSENTE", "eColi": "AUSENTE" }
  ],
  "criadoEm": "ISO", "atualizadoEm": "ISO", "analisadaEm": "ISO | null", "exportadoEm": "ISO | null"
}
```

`linha` é a linha do sistema nas abas JAN…DEZ da planilha. Os valores ficam como texto digitado; a conversão para número acontece na exportação. Campo em branco significa "não analisado" e nunca vira zero.

Etapas: **coletada** (salva em campo) → **analisada** ("Concluir análise" conferiu tudo) → **na planilha** (`exportadoEm` preenchido).

## Validação (Portaria 888/2021)

| Parâmetro | Limite |
|---|---|
| pH | 6,0 a 9,0 |
| Cor aparente | até 15 uH |
| Turbidez | até 5 uT |
| Cloro residual livre | 0,2 a 5,0 mg/L (não se aplica ao ponto de captação) |
| Coliformes totais e E. coli | ausência em 100 mL |

Dois tipos de problema, tratados de forma diferente:

- **Fora do padrão**: valor possível, mas fora do limite (ex.: turbidez 7 uT). Gera alerta e exige justificativa.
- **Valor impossível**: erro de digitação (pH 15, cloro negativo, coordenada sem o sinal de menos). Bloqueia "Concluir análise" até corrigir e não pede justificativa.

## IA

```
navegador                                  api/sugerir.js (Vercel)                    Groq
────────────────────────────────────────   ───────────────────────────────────────   ──────────
dadosDaJustificativa() / dadosDoResumo()
  → só dados técnicos
POST /api/sugerir { tipo, dados }  ─────►  confere método e origem
                                           limparDados()  → descarta o que não é dado técnico
                                           montarPrompt() → { system, user }  ─────►  llama-3.3-70b-versatile
       { texto }  ◄──────────────────────  devolve só o texto  ◄──────────────────
sem internet / 503 (sem chave) / erro
  → respostaDeExemplo(), marcada "exemplo"
```

- **Chave**: `process.env.GROQ_API_KEY`, lida só na função. Um teste confere que o nome da variável não aparece em nenhum arquivo do front-end.
- **O que sai do aparelho**: para a justificativa, o tratamento do sistema e, por ponto, tipo, pH, cor, turbidez, cloro, coliformes totais e E. coli. Para o resumo, também o nome do sistema. Nunca saem nomes de pessoas, coordenadas, datas, identificação do ponto ou textos livres.
- **Prompt montado no servidor** (`js/ia.js`, o mesmo módulo testado no Node). O tipo de ponto só é aceito se estiver na lista do app, os valores só se forem números válidos, e a situação de cada parâmetro (conforme / fora do padrão) é recalculada com `validacao.js`. Assim, texto vindo do navegador não chega ao modelo como instrução.
- **Instruções ao modelo**: português, linguagem técnica e objetiva, usar somente os dados informados, não inventar valores, parâmetro em branco é "não informado", causas como hipóteses a verificar. Temperatura 0,2 e resposta limitada a 500 tokens.
- **Resposta de exemplo**: texto fixo por tipo de não conformidade, montado só com os valores informados. Aparece sempre com a etiqueta **exemplo**.
- **Limites**: a função aceita só POST do próprio site e pedidos pequenos; não há limite de chamadas por visitante — o teto é a cota da chave na Groq.

## Planilha modelo (.xlsx)

Gerada do zero no aparelho por `js/excel.js`: os XML do arquivo são montados por funções puras e o JSZip só empacota. Uma aba por mês (JAN…DEZ); linhas 1–2 com o título e o aviso de demonstração, linha 4 com os títulos das colunas e, a partir da linha 5, uma linha por sistema.

| Dado | Coluna |
|---|---|
| Cadastro do sistema (nº, polo, município, aldeia, código, sistema, tipo, população, pontos, tratamento) | B–N |
| Tratamento em operação | O |
| Justificativa | P |
| Ponto *n* (1–8): identificação, tipo, pH, cor, turbidez, cloro, colif. totais, E. coli | a partir de Q, 8 colunas por ponto |
| Data da análise | CC (data do Excel) |
| Responsável | CD |
| Observações (+ data da coleta e coordenadas) | CE |

Se houver duas coletas do mesmo sistema no mês, vale a mais recente.

## Dados de exemplo

`js/exemplos.js` monta 6 coletas a partir de `data/sistemas.json`, com datas relativas ao dia de hoje: 2 conformes, 3 fora do padrão (turbidez 7 uT; cloro 0,1 mg/L fora da captação; E. coli presente) e 1 aguardando análise. "Carregar exemplos" não duplica (os ids são fixos) e "Reiniciar demo" apaga coletas, rascunho e nomes lembrados no aparelho.

## E o backend?

A versão de campo não precisa de servidor de aplicação. Ele passa a valer a pena se surgir pelo menos uma destas necessidades:

1. Juntar automaticamente as coletas de vários técnicos, sem trocar arquivos de cópia.
2. Acompanhar as coletas da equipe em tempo real (painel, cobertura mensal).
3. Não depender do celular para guardar os dados (perda/troca de aparelho).

O caminho previsto, sem reescrever o app:

- **API** com banco de dados e login.
- `storage.js` continua gravando no aparelho primeiro (offline) e ganha uma fila de sincronização: ao voltar a internet, envia as coletas com `atualizadoEm` mais recente que a última sincronização.
- Contrato sugerido: `POST /api/coletas` (lote de coletas, upsert por `id`) e `GET /api/coletas?desde=ISO`.
- Por serem dados de saúde, avaliar LGPD, controle de acesso por equipe e hospedagem adequada antes de publicar.
