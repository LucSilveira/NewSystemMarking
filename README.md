# Skill Training Manager

## 1. Sobre o projeto

O **Skill Training Manager** é uma aplicação para acompanhamento e organização da preparação de competidores, centralizando informações sobre provas, fatores técnicos, áreas da ocupação, competências e avaliações.

O sistema permite cadastrar e consultar provas, mapear critérios técnicos e relacionar aspectos de cada prova às competências exigidas. Os dados são armazenados em arquivos JSON independentes, garantindo persistência local durante o desenvolvimento.

### Tecnologias utilizadas

- **Frontend:** React + Vite
- **Backend:** Node.js + JSON Server
- **Persistência:** arquivos JSON
- **Testes:** scripts automatizados do projeto

## 2. Estrutura do projeto

```text
skill-training-manager/
├── backend/
│   ├── src/          # Código do backend
│   ├── data/         # 11 arquivos JSON com os dados
│   ├── scripts/      # Scripts auxiliares do backend
│   └── tests/        # Testes automatizados
├── frontend/
│   └── src/
│       ├── pages/
│       │   └── Exams.jsx
│       └── styles.css
├── scripts/          # Scripts auxiliares do projeto
└── package.json      # Dependências e comandos disponíveis
