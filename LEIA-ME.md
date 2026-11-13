# Pharma_estat · @pharmamelo

Consultor de bioestatística para estudantes da saúde: desenho do estudo, teste estatístico,
tamanho amostral, revisão metodológica do projeto e análise dos dados com o R rodando no navegador.

- Sem servidor e sem cadastro. A planilha do aluno fica só na memória do navegador.
- Recomendações por regras fixas com referência (pasta `base/`), sem IA decidindo.
- Planejamento completo do projeto: doc "Planejamento — App de Bioestatística (@pharmamelo)".

## Rodar no computador

```
npm install
npm run dev          # abre em http://localhost:5173
npm test             # todos os testes (inclui o R; leva ~1 min)
npm run test:rapido  # sem os testes do R
npm run build        # gera a pasta dist/
```

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `base/` | Conteúdo científico em JSON: desenhos, testes, árvores, amostra, glossário, regras da revisão, referências |
| `src/motor/` | Motor das árvores de decisão e da revisão metodológica |
| `src/calculo/` | Distribuições e tamanho amostral (conferidos contra o R) |
| `src/r/` | Biblioteca de análises em R e ponte com o webR |
| `src/estado/` | Projeto (IndexedDB) e dados do estudo (só memória) |
| `src/ui/` | Telas, componentes e gráficos |
| `testes/` | 266 testes; `testes/referencia-r/` gera os valores de referência no próprio R |

## Publicar

Envie para a branch `main` de um repositório no GitHub com Pages ativado (Settings → Pages → Source: GitHub Actions).
O workflow `.github/workflows/publicar.yml` testa, gera e publica.
