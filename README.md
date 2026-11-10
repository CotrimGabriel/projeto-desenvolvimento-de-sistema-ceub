# Loja Tag: protótipo de taggeamento web

Protótipo de e-commerce do Projeto Final da disciplina de Desenvolvimento de Sistemas (CEUB). Cada visitante recebe uma tag anônima, e as categorias em que ele mais clica passam a aparecer primeiro na vitrine.

## Como funciona

1. Na primeira visita, o backend cria um ID anônimo e o grava no cookie `visitante_id`.
2. Cada clique em um produto, ou em "Adicionar ao carrinho", soma 1 ponto à categoria daquele produto.
3. A vitrine mostra primeiro a categoria mais clicada. Em caso de empate, vem primeiro a clicada mais recentemente.
4. Cada clique também é enviado para `window.dataLayer`, o que deixa o projeto pronto para uma integração com o Google Tag Manager.

O carrinho fica salvo no navegador (`localStorage`). A lista de prioridades fica salva no banco de dados.

## Área do administrador

O cliente compra sem login. O administrador entra pela página pelo link "Área do administrador" no topo da loja.

1. O usuário e a senha são enviados para `POST /api/auth/login`.
2. O backend compara a senha com o hash bcrypt salvo no banco. A senha nunca é guardada em texto puro.
3. Se estiver correta, o backend devolve um token JWT válido por 2 horas.
4. O navegador guarda o token no `sessionStorage` e o envia no cabeçalho `Authorization: Bearer` das rotas protegidas.
5. "Sair" apaga o token do navegador.

Usuário e senha incorretos recebem a mesma mensagem, para não revelar quais usuários existem.


O administrador inicial é criado na primeira execução, a partir das variáveis `ADMIN_USUARIO` e `ADMIN_SENHA`. O token é assinado com `JWT_SEGREDO`. 

## Tecnologias

- **Backend:** Python, FastAPI e SQLAlchemy
- **Autenticação:** bcrypt para as senhas e JWT para a sessão
- **Frontend:** HTML, CSS e JavaScript
- **Banco de dados:** PostgreSQL
- **Infraestrutura:** Docker e Docker Compose

## Estrutura

```text
projeto-desenvolvimento-de-sistema-ceub/
├── backend/
│   └── app.py
├── frontend/
│   ├── admin.html
│   ├── admin.js
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
- **Área do administrador:** <http://localhost:8000/admin.html>
- **Swagger:** <http://localhost:8000/docs>

## Como testar o taggeamento

1. Abra a loja e clique em um produto de Moda. A categoria sobe para o início da vitrine.
2. Clique duas vezes em um produto de Casa. Casa passa a ser a primeira categoria.
3. Recarregue a página. A ordem continua a mesma.
4. Abra a loja em outro navegador. Ele começa com uma lista própria.
5. Clique em "Limpar minhas tags". A vitrine volta à ordem inicial.
6. No console do navegador, digite `window.dataLayer` para ver os eventos enviados.

## Como testar o login

1. Clique em "Área do administrador" no topo da loja.
2. Entre com uma senha errada. A tela mostra "Usuário ou senha inválidos".
3. Entre com `admin` e `admin123`. O painel mostra o administrador logado.
4. Recarregue a página. A sessão continua ativa.
5. Clique em "Sair". A tela volta para o login.

No Swagger, clique em **Authorize**, informe o usuário e a senha, e teste a rota protegida `GET /api/auth/me`.

## Rotas da API

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/api/produtos` | Público | Lista os produtos pela prioridade do visitante |
| `POST` | `/api/eventos/clique` | Público | Registra o clique em um produto |
| `GET` | `/api/tags` | Público | Mostra a lista de prioridades do visitante |
| `DELETE` | `/api/tags` | Público | Apaga a lista de prioridades do visitante |
| `POST` | `/api/auth/login` | Público | Faz o login e devolve o token JWT |
| `GET` | `/api/auth/me` | Administrador | Mostra o administrador logado |

## Como parar

Para parar os containers:

```bash
docker compose down
```

Para parar e apagar também os dados do banco:

```bash
docker compose down -v
```
