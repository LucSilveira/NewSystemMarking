# Skill Training Manager — v0.6.3

Projeto local de acompanhamento da preparação do competidor, com **React + Vite** no `frontend/`, **Node + JSON Server** no `backend/` e **11 arquivos JSON independentes** em `backend/data/`. A v0.6.3 aprimora o mapeamento de áreas e competências com grupos semânticos e opções de múltipla seleção em cartões azuis e brancos, incluindo realce de foco para navegação por teclado. Preserva os ajustes de estrutura e espaço da v0.6.2.

## Iniciar (Node.js 22+)

```bash
npm run install:all
npm run dev
```

- Interface: http://localhost:5173
- API: http://127.0.0.1:3001/api/health
- Provas: http://127.0.0.1:3001/api/exams

## O que mudou na interface de Provas

1. **Lista em cartões:** mostra título, trecho da descrição, módulo, pontuação, tipo, edição e país de referência. Há botões para **Visualizar** e **Editar**.
2. **Página própria da prova:** a leitura não abre mais o formulário. Existe a opção de editar, adaptar uma prova ou voltar ao catálogo.
3. **Quatro abas tanto na leitura quanto na edição:**
   - **Detalhes da prova:** identificação, título, descrição, módulo, pontuação, edição, país, tipo e link do documento.
   - **Fatores técnicos:** desafios, detalhes, áreas técnicas e competências da ocupação.
   - **CIS mapeado:** subcritérios expansíveis, aspectos M/J, pontuações, considerações e WSOS oficial.
   - **Análise técnica:** relação dos aspectos com áreas e competências, com classificação individual.
4. **Edição com mais espaço:** o botão Cancelar substitui a navegação redundante; os campos usam até 3 colunas em telas amplas, sem o campo Ocupação na edição (a ocupação existente permanece salva). No CIS, subcritérios e aspectos iniciam expandidos e têm ícones de expansão; na Análise técnica, os aspectos são agrupados por subcritério e revelam as opções ao clicar.
5. **Um único salvamento:** você pode alternar entre as quatro abas e salvar o conjunto de alterações ao final. O app avisa ao tentar sair com alterações não salvas.
6. **País de referência:** novo campo opcional `referenceCountry` em cada prova. Para dados antigos, o campo pode estar ausente e será exibido como "País não informado" até ser preenchido.

**Importante:** a classificação WSOS continua independente das áreas e das competências técnicas. A biblioteca permanece em `backend/data/competencies.json` e `backend/data/occupationAreas.json`; as ligações ficam em `backend/data/exams.json`.

## Mapeamento de competências (v0.6.2)

- Os aspectos agora armazenam `competencyIds[]` como uma lista simples, sem principal/secundárias.
- Vínculos `competencyLinks[]` anteriores são reconhecidos e convertidos ao editar e salvar a prova; nenhum JSON de trabalho é apagado automaticamente.
- A classificação em lote foi removida: cada aspecto tem seu próprio painel de relação com as áreas e competências.
- Múltiplos vínculos não multiplicam a pontuação CIS/WSOS da prova.
- O campo **Ocupação** não aparece mais na edição das provas: o protótipo trabalha com uma única ocupação, mas seu `occupationId` continua persistido.

## Teste sugerido

1. Acesse **Provas** e confira os sete cartões de Shanghai 2026.
2. Clique **Visualizar** em MB — Conference Mobile e percorra as quatro abas.
3. Clique em **Editar prova**; preencha o país de referência e uma descrição. Salve e volte à visualização.
4. Em **Fatores técnicos**, selecione áreas e competências da biblioteca.
5. Em **CIS mapeado**, cadastre um subcritério e um aspecto de exemplo; não invente notas oficiais em seus testes.
6. Em **Análise técnica**, clique no aspecto e marque quantas competências técnicas quiser associar; não existe competência principal. Salve.
7. Consulte `backend/data/exams.json` e confirme que os dados foram persistidos.

Se quiser experimentar um cadastro fictício com três aspectos mapeados, execute **com a API parada**:

```bash
npm run demo:mapping
```

Esse comando cria uma prova de demonstração sem alterar as sete provas iniciais. A operação cria backup. Não é necessário para usar o catálogo.

## Preservação de dados das versões anteriores

A v0.6.2 mantém exatamente os mesmos 11 arquivos em `backend/data/` e não exige migração dos registros da v0.5. **Se você já editou arquivos JSON em sua instalação anterior**, preserve-os: faça backup, copie a v0.6.2 para uma nova pasta e substitua apenas a pasta `backend/data/` da nova instalação pelos seus dados reais da versão anterior (com API parada). **Não copie nem substitua a pasta `backend/data/seed/`** com registros operacionais.

De preferência, rode antes:

```bash
npm run db:backup
npm run db:check
npm test
```

`db:reset` apaga a base de trabalho e restaura os exemplos. Não o execute para instalar a atualização.

## O que não mudou

- Dashboard, Execuções, Atividades, Competidores, Competências e Cadastros de apoio continuam disponíveis.
- A importação automática do CIS XLSX ainda não foi implementada. O arquivo XLSX não é armazenado.
- As avaliações continuam na modalidade de registro da v0.5; a remodelagem da correção será posterior à validação do cadastro.
- O link do documento da prova é somente uma referência, não um arquivo hospedado no sistema.
- Ainda **não há autenticação** nesta versão local. Não publique a API JSON Server na internet e não armazene URLs confidenciais. Na Vercel será necessária persistência externa.

## Organização de arquivos

```text
skill-training-manager/
├── backend/
│   ├── src/
│   ├── data/             # JSONs individuais, persistentes
│   ├── scripts/
│   └── tests/
├── frontend/
│   └── src/
│       ├── pages/Exams.jsx
│       └── styles.css
├── scripts/
└── package.json
```

A v0.6.2 altera apenas a interface. As validações no back-end, os vínculos existentes e a estrutura das notas de execução permanecem inalterados.

## Ajustes visuais da v0.6.2

- **CIS mapeado:** no cabeçalho do subcritério, o total de pontos aparece ao lado da quantidade de aspectos, abaixo do nome. A seta fica na extremidade direita.
- **Análise técnica:** a aplicação em lote não aparece mais; cada aspecto é associado individualmente. Os blocos dos subcritérios ficam em duas colunas em telas amplas e em uma nas telas menores; caso só exista um, ele ocupa a linha inteira.
- **Espaço dos formulários:** removido o limite de largura da seção. O formulário expandido de um aspecto ocupa o cartão inteiro, e as competências/áreas são organizadas em grade responsiva de opções.
- **Persistência:** esta atualização não altera a API, os endpoints, os 11 arquivos JSON, as associações salvas nem a pontuação CIS/WSOS.

**Atualização sem perder dados:** com o projeto desligado, substitua apenas `frontend/src/pages/Exams.jsx` e `frontend/src/styles.css` pelo patch. Não copie a pasta `backend/data/`, não execute `db:reset`.


## Atualização v0.6.3 — visual de competências e áreas

- **Análise técnica (visualização):** cada aspecto exibe dois blocos identificados, um para **Áreas da ocupação** e outro para **Competências relacionadas**, com indicação mesmo quando não há vínculos.
- **Análise técnica (edição):** as opções são agrupadas em seções separadas com legendas, ícones e contador de selecionados.
- **Fatores técnicos:** utiliza os mesmos cartões de múltipla seleção, para manter consistência entre as telas.
- **Checkbox personalizado:** todo o cartão é clicável; não selecionado aparece branco com contorno, selecionado fica azul com marca de seleção. O controle nativo permanece acessível por teclado e leitores de tela.
- **Sem alteração de dados:** não modifica `backend/data/`, endpoints, cálculos CIS/WSOS nem os IDs das associações.

Para atualizar uma instalação da **v0.6.2** sem perder dados, pare a aplicação, faça backup de `backend/data/` e substitua apenas `frontend/src/pages/Exams.jsx` e `frontend/src/styles.css`. **Não execute `db:reset`.**
