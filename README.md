# Loja Tag: protótipo de taggeamento web

Protótipo de e-commerce do Projeto Final da disciplina de Desenvolvimento de Sistemas (CEUB). Cada visitante recebe uma tag anônima, e as categorias em que ele mais clica passam a aparecer primeiro na vitrine.

## Como funciona

1. Na primeira visita, o backend cria um ID anônimo e o grava no cookie `visitante_id`.
2. Cada clique em um produto, ou em "Adicionar ao carrinho", soma 1 ponto à categoria daquele produto.
3. A vitrine mostra primeiro a categoria mais clicada. Em caso de empate, vem primeiro a clicada mais recentemente.
4. Cada clique também é enviado para `window.dataLayer`, o que deixa o projeto pronto para uma integração com o Google Tag Manager.

O carrinho fica salvo no navegador (`localStorage`). A lista de prioridades fica salva no banco de dados.

## Tecnologias

- **Backend:** Python, FastAPI e SQLAlchemy
- **Frontend:** HTML, CSS e JavaScript
- **Banco de dados:** PostgreSQL
- **Infraestrutura:** Docker e Docker Compose

## Estrutura

```text
projeto-desenvolvimento-de-sistema-ceub/
├── backend/
│   └── app.py
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── docker-compose.yml
└── README.md
```

## Como executar

É preciso ter o Docker Desktop aberto e acesso à internet na primeira execução. Na pasta do projeto, rode:

```bash
docker compose up
```

Quando o terminal mostrar `Uvicorn running`, acesse:

- **Loja:** <http://localhost:8000>
- **Swagger:** <http://localhost:8000/docs>

## Como testar o taggeamento

1. Abra a loja e clique em um produto de Moda. A categoria sobe para o início da vitrine.
2. Clique duas vezes em um produto de Casa. Casa passa a ser a primeira categoria.
3. Recarregue a página. A ordem continua a mesma.
4. Abra a loja em outro navegador. Ele começa com uma lista própria.
5. Clique em "Limpar minhas tags". A vitrine volta à ordem inicial.
6. No console do navegador, digite `window.dataLayer` para ver os eventos enviados.

## Rotas da API

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/produtos` | Lista os produtos pela prioridade do visitante |
| `POST` | `/api/eventos/clique` | Registra o clique em um produto |
| `GET` | `/api/tags` | Mostra a lista de prioridades do visitante |
| `DELETE` | `/api/tags` | Apaga a lista de prioridades do visitante |

## Como parar

Para parar os containers:

```bash
docker compose down
```

Para parar e apagar também os dados do banco:

```bash
docker compose down -v
```
