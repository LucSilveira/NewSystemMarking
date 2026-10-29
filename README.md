# Skill Training Manager

## 1. Sobre o projeto

O **Skill Training Manager** é uma aplicação para acompanhamento e organização da preparação de competidores, centralizando informações sobre provas, fatores técnicos, áreas da ocupação, competências e avaliações.

O sistema permite cadastrar e consultar provas, mapear critérios técnicos e relacionar aspectos de cada prova às competências exigidas. Os dados são armazenados em arquivos JSON independentes, garantindo persistência local durante o desenvolvimento.

### Tecnologias utilizadas

- **Frontend:** React + Vite
- **Backend:** Node.js + JSON Server
- **Persistência:** 11 arquivos JSON independentes
- **Testes:** scripts automatizados do projeto

## 2. Estrutura do projeto

```
    skill-training-manager/
    ├── backend/
    │   ├── src/          # Código do backend
    │   ├── data/         # Arquivos JSON com os dados
    │   ├── scripts/      # Scripts auxiliares do backend
    │   └── tests/        # Testes automatizados
    ├── frontend/
    │   └── src/
    │       ├── pages/
    │       │   └── Exams.jsx
    │       └── styles.css
    ├── scripts/          # Scripts auxiliares do projeto
    └── package.json      # Dependências e comandos disponíveis
```

### Principais componentes

- **Frontend:** interface responsável pela interação com o usuário.
- **Backend:** API local responsável pelo acesso e pela manipulação dos dados.
- **Dados:** arquivos JSON independentes armazenados em `backend/data/`.
- **Scripts e testes:** ferramentas para validação, manutenção, backup e demonstração de funcionalidades.

## 3. Como executar o projeto

### Requisitos

- Node.js 22 ou superior
- npm

### Instalação

Na raiz do projeto, execute:

    npm run install:all

Esse comando instala as dependências necessárias para o frontend e o backend.

### Inicialização

Após a instalação, execute:

    npm run dev

A aplicação será iniciada em ambiente de desenvolvimento.

### Endereços de acesso

| Serviço | Endereço |
|---|---|
| Interface web | http://localhost:5173 |
| API — verificação de saúde | http://127.0.0.1:3001/api/health |
| API — provas | http://127.0.0.1:3001/api/exams |

## 4. Comandos auxiliares

Os comandos abaixo devem ser executados na raiz do projeto.

| Comando | Descrição |
|---|---|
| `npm test` | Executa os testes automatizados. |
| `npm run db:backup` | Cria um backup dos dados. |
| `npm run db:check` | Verifica a integridade da base de dados. |
| `npm run demo:mapping` | Cria uma prova demonstrativa para testar o mapeamento de competências. |

> **Atenção:** execute `npm run demo:mapping` somente com a API parada. O comando cria uma prova de demonstração e realiza backup.

O comando `npm run db:reset` restaura os dados de exemplo e apaga os dados atuais de trabalho. Utilize-o somente quando desejar reiniciar a base.

## 5. Observações

- O projeto funciona localmente e utiliza arquivos JSON para persistência.
- A aplicação ainda não possui autenticação.
- A importação automática de arquivos CIS em XLSX ainda não foi implementada.
- A publicação em ambientes como a Vercel exige uma solução de persistência externa e ajustes na infraestrutura do backend.
