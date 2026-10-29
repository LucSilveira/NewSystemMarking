# Skill Training Manager 0.8 — múltiplas ocupações

## Modelo aprovado

**Ocupação** é o escopo de provas, critérios CIS, áreas, competências e WSOS.

- `occupations.json`: cadastro de ocupações identificado por `id` (não por índice).
- `evaluators.json`: pessoas responsáveis, `occupationIds: []`; **não são contas de login** nesta POC.
- `competitors.json`: participantes individuais, `occupationId`, foto opcional; não têm acesso à aplicação.
- `teams.json`: grupos de 2+ competidores da mesma ocupação; a ocupação #54 tem uma dupla inicial.
- `exams.json`: cada prova com `occupationId`; o mesmo código de módulo MA pode existir em várias ocupações/edições.
- `examTypes.json`: cada tipo é vinculado à ocupação; os cinco tipos antigos permanecem na #17.
- `wsos.json`, `occupationAreas.json`, `competencies.json`: continuam específicos da ocupação.
- `executions.json`: uma tentativa é de **um competidor** numa prova da mesma ocupação. A futura correção coletiva da equipe deve ser modelada separadamente, sem copiar a nota entre integrantes.

## Importar os participantes na base já utilizada

**NÃO** substitua `backend/data/*.json` pelos arquivos de exemplo do ZIP, pois isso apagaria seus registros locais.

1. Pare a API e crie um backup de `backend/data`.
2. Aplique os arquivos do patch na raiz do projeto.
3. Execute `npm run db:seed-school`. É uma operação não destrutiva e repetível: acrescenta ocupações e pessoas ausentes; não zera outras coleções.
4. Execute `npm run db:check` e `npm test`.
5. Inicie `npm run dev`.

**Importante:** se você já cadastrou Matheus usando nome abreviado ou apelido, confira possível duplicata na ocupação #17. O script não altera nomes existentes nem presume que duas pessoas de mesmo primeiro nome são idênticas.

### Contexto de ocupação

O seletor no topo define a ocupação em foco. Provas, competências, competidores, edições, atividades e execuções exibem somente dados daquele contexto. `Cadastros de apoio` mostra todas as ocupações, avaliadores e equipes para manutenção; o botão `Ocupações da escola` abre a visão geral.

Esta é uma POC local: **o filtro de interface não é controle de acesso**. Não publique uma API de leitura/escrita com dados pessoais na internet sem autenticação, autorização por avaliador e armazenamento seguro. A área `Avaliadores` é apenas um cadastro de referência neste momento.

### Regras

- Nenhuma ocupação precisa ter avaliador ou competidor.
- Uma ocupação pode ter vários avaliadores/competidores.
- Um avaliador pode ser vinculado a mais de uma ocupação.
- Integrantes de uma equipe precisam pertencer à mesma ocupação.
- Uma execução exige correspondência entre ocupação do competidor e da prova.
- Um tipo de prova da #17 não é automaticamente oferecido na #05, por exemplo.
- CIS e competências existentes da #17 continuam com suas IDs originais.

### Próxima etapa

Após validar o escopo da escola, o módulo **Execuções** poderá receber a correção por aspectos e gerar consolidado WSOS e competências sem misturar notas de diferentes ocupações. O contexto de acesso real dos professores deverá ser implementado antes de produção.
