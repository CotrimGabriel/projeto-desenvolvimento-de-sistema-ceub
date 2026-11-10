const CHAVE_CARRINHO = "carrinho";

const vitrine = document.getElementById("vitrine");
const listaPrioridades = document.getElementById("lista-prioridades");
const itensCarrinho = document.getElementById("itens-carrinho");
const quantidadeCarrinho = document.getElementById("quantidade-carrinho");
const totalCarrinho = document.getElementById("total-carrinho");
const botaoLimparTags = document.getElementById("limpar-tags");
const aviso = document.getElementById("aviso");

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const cards = new Map();

let carrinho = lerCarrinho();
let ultimaAtualizacao = 0;
let cliquesPendentes = 0;
let temporizadorAviso;

window.dataLayer = window.dataLayer || [];

function lerCarrinho() {
    try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE_CARRINHO));
        return Array.isArray(salvo) ? salvo : [];
    } catch (erro) {
        return [];
    }
}

function salvarCarrinho() {
    try {
        localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
    } catch (erro) {
        mostrarAviso("Não foi possível salvar o carrinho neste navegador.");
    }
}

function mostrarAviso(mensagem) {
    aviso.textContent = mensagem;
    aviso.classList.add("visivel");
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => aviso.classList.remove("visivel"), 3000);
}

async function requisitar(url, opcoes) {
    const resposta = await fetch(url, opcoes);
    if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({}));
        throw new Error(typeof erro.detail === "string" ? erro.detail : "Erro ao falar com o servidor.");
    }
    return resposta.status === 204 ? null : resposta.json();
}

function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) {
        elemento.className = classe;
    }
    if (texto !== undefined) {
        elemento.textContent = texto;
    }
    return elemento;
}

function criarCard(produto) {
    const card = criarElemento("article", "card");
    card.tabIndex = 0;
    card.dataset.id = produto.id;

    const botao = criarElemento("button", "botao-principal", "Adicionar ao carrinho");
    botao.type = "button";

    card.append(
        criarElemento("span", `card-categoria categoria-${produto.categoria_id}`, produto.categoria),
        criarElemento("div", "card-emoji", produto.emoji),
        criarElemento("h3", "", produto.nome),
        criarElemento("p", "card-preco", formatoMoeda.format(produto.preco)),
        botao
    );

    card.addEventListener("click", () => registrarClique(produto, "clique_card"));
    card.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" && evento.target === card) {
            registrarClique(produto, "clique_card");
        }
    });
    botao.addEventListener("click", (evento) => {
        evento.stopPropagation();
        adicionarAoCarrinho(produto);
        registrarClique(produto, "adicionar_carrinho");
    });

    return card;
}

function mostrarProdutos(produtos) {
    const posicoesAntigas = new Map();
    cards.forEach((card, id) => posicoesAntigas.set(id, card.getBoundingClientRect()));
    const elementoFocado = document.activeElement;

    produtos.forEach((produto) => {
        if (!cards.has(produto.id)) {
            cards.set(produto.id, criarCard(produto));
        }
        vitrine.appendChild(cards.get(produto.id));
    });

    if (elementoFocado && vitrine.contains(elementoFocado)) {
        elementoFocado.focus({ preventScroll: true });
    }

    cards.forEach((card, id) => animarCard(card, posicoesAntigas.get(id)));
}

function animarCard(card, posicaoAntiga) {
    if (!posicaoAntiga) {
        return;
    }
    const posicaoNova = card.getBoundingClientRect();
    const deslocamentoX = posicaoAntiga.left - posicaoNova.left;
    const deslocamentoY = posicaoAntiga.top - posicaoNova.top;
    if (deslocamentoX === 0 && deslocamentoY === 0) {
        return;
    }

    card.classList.remove("movendo");
    card.style.transform = `translate(${deslocamentoX}px, ${deslocamentoY}px)`;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            card.classList.add("movendo");
            card.style.transform = "";
        });
    });
}

function mostrarPrioridades(prioridades) {
    listaPrioridades.replaceChildren();
    if (prioridades.length === 0) {
        listaPrioridades.appendChild(criarElemento("li", "vazio", "Clique em um produto para criar a sua lista."));
        return;
    }
    prioridades.forEach((prioridade, indice) => {
        const textoCliques = prioridade.cliques === 1 ? "1 clique" : `${prioridade.cliques} cliques`;
        const texto = `${indice + 1}º ${prioridade.categoria} · ${textoCliques}`;
        listaPrioridades.appendChild(criarElemento("li", `categoria-${prioridade.categoria_id}`, texto));
    });
}

async function carregarTela() {
    const numero = ++ultimaAtualizacao;
    try {
        const produtos = await requisitar("/api/produtos");
        const prioridades = await requisitar("/api/tags");
        if (numero === ultimaAtualizacao) {
            mostrarProdutos(produtos);
            mostrarPrioridades(prioridades);
        }
    } catch (erro) {
        mostrarAviso("Não foi possível carregar a loja. Tente novamente.");
    }
}

async function registrarClique(produto, acao) {
    window.dataLayer.push({
        event: "clique_produto",
        acao: acao,
        produto_id: produto.id,
        produto_nome: produto.nome,
        categoria: produto.categoria,
    });

    cliquesPendentes += 1;
    try {
        await requisitar("/api/eventos/clique", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ produto_id: produto.id }),
        });
    } catch (erro) {
        mostrarAviso(erro.message);
    } finally {
        cliquesPendentes -= 1;
    }

    if (cliquesPendentes === 0) {
        await carregarTela();
    }
}

async function limparTags() {
    try {
        await requisitar("/api/tags", { method: "DELETE" });
        await carregarTela();
        mostrarAviso("Suas tags foram apagadas.");
    } catch (erro) {
        mostrarAviso(erro.message);
    }
}

function adicionarAoCarrinho(produto) {
    const item = carrinho.find((itemAtual) => itemAtual.id === produto.id);
    if (item) {
        item.quantidade += 1;
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            emoji: produto.emoji,
            quantidade: 1,
        });
    }
    atualizarCarrinho();
}

function alterarQuantidade(id, variacao) {
    const item = carrinho.find((itemAtual) => itemAtual.id === id);
    if (!item) {
        return;
    }
    item.quantidade += variacao;
    if (item.quantidade <= 0) {
        removerDoCarrinho(id);
        return;
    }
    atualizarCarrinho();
}

function removerDoCarrinho(id) {
    carrinho = carrinho.filter((item) => item.id !== id);
    atualizarCarrinho();
}

function criarBotaoCarrinho(texto, classe, rotulo, acao) {
    const botao = criarElemento("button", classe, texto);
    botao.type = "button";
    botao.setAttribute("aria-label", rotulo);
    botao.addEventListener("click", acao);
    return botao;
}

function criarItemCarrinho(item) {
    const linha = criarElemento("li", "item-carrinho");
    const controles = criarElemento("div", "item-controles");

    controles.append(
        criarBotaoCarrinho("−", "", `Diminuir ${item.nome}`, () => alterarQuantidade(item.id, -1)),
        criarElemento("span", "", item.quantidade),
        criarBotaoCarrinho("+", "", `Aumentar ${item.nome}`, () => alterarQuantidade(item.id, 1)),
        criarElemento("span", "", formatoMoeda.format(item.preco * item.quantidade)),
        criarBotaoCarrinho("Remover", "remover", `Remover ${item.nome}`, () => removerDoCarrinho(item.id))
    );

    linha.append(criarElemento("div", "item-nome", `${item.emoji} ${item.nome}`), controles);
    return linha;
}

function atualizarCarrinho() {
    salvarCarrinho();
    itensCarrinho.replaceChildren();

    if (carrinho.length === 0) {
        itensCarrinho.appendChild(criarElemento("li", "vazio", "Seu carrinho está vazio."));
    } else {
        carrinho.forEach((item) => itensCarrinho.appendChild(criarItemCarrinho(item)));
    }

    const quantidade = carrinho.reduce((soma, item) => soma + item.quantidade, 0);
    const total = carrinho.reduce((soma, item) => soma + item.preco * item.quantidade, 0);
    quantidadeCarrinho.textContent = quantidade;
    totalCarrinho.textContent = formatoMoeda.format(total);
}

botaoLimparTags.addEventListener("click", limparTags);

atualizarCarrinho();
carregarTela();
