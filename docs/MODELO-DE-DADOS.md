# Modelo de dados — Skill Training Manager v0.6.1

A aplicação mantém cada coleção em um JSON independente dentro de `backend/data/`.

## Cadastros e relações

- `occupations`: uma ocupação ativa no protótipo (Web Technologies, #17).
- `occupationAreas`: áreas técnicas da ocupação, distintas da classificação WSOS.
- `wsos`: seções WSOS oficiais (`code`, `name`, `referenceWeight`, `occupationId`).
- `competencies`: catálogo de competências técnicas com `id`, `name`, `description`, `occupationId`, `areaIds[]`.
- `exams`: descrição, edição, país, pontuação, `areaIds[]`, `competencyIds[]`, `subcriteria[]` e eventual `sourceExamId`.
- `exams[].subcriteria[].aspects[]`: código/ID, descrição, método M/J, pontuação máxima, considerações, descritores de Judgement, `wsosSection`, `areaIds[]` e **`competencyIds[]`**.

O campo `competencyIds[]` de um aspecto é uma lista simples: **não existe competência principal nem competência secundária**. Todo vínculo de competência é equivalente. Cada competência do aspecto precisa estar listada entre as `competencyIds[]` da prova.

A pontuação original pertence ao aspecto CIS e é somada **uma única vez** no resultado da prova e do WSOS. Um aspecto pode aparecer em filtros e indicadores de várias competências técnicas, mas as pontuações de diferentes competências não devem ser somadas para reconstruir a nota geral (isso causaria duplicação).

O `wsosSection` é o valor oficial associado ao aspecto no CIS; não é inferido a partir das áreas técnicas ou das competências vinculadas.

## Compatibilidade com versões anteriores

A v0.5/v0.6 podia usar `competencyLinks: [{"competencyId":"...","role":"primary"|"related"}]`. A v0.6.1 **continua lendo esses dados**, e, ao abrir uma prova no modo de edição, converte os vínculos para `competencyIds[]`, sem perda de IDs. Ao salvar, os aspectos editados passam a usar o formato simplificado.

Não é necessário migrar, resetar ou sobrescrever `backend/data/` para instalar esta atualização. Faça backup e mantenha seus arquivos JSON de trabalho.

## Execuções e históricos

- `executions`: competidor, prova e snapshot da estrutura CIS, com notas e cobertura da correção.
- `technicalAssessments`: observações e níveis de domínio atribuídos independentemente pelo Avaliador.
- `activities`: programação de treinamentos, simulados e competições.
- `competitors`: registros sem login próprio.

A v0.6.1 **não alterou a tela de Execuções**. O cálculo histórico por competência técnica será implementado em etapa posterior, usando os vínculos estabelecidos nas provas.
