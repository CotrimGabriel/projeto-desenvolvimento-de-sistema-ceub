const CHAVE_TOKEN = "token_administrador";

const telaLogin = document.getElementById("tela-login");
const painelAdmin = document.getElementById("painel-admin");
const formularioLogin = document.getElementById("formulario-login");
const campoUsuario = document.getElementById("campo-usuario");
const campoSenha = document.getElementById("campo-senha");
const erroLogin = document.getElementById("erro-login");
const botaoEntrar = document.getElementById("botao-entrar");
const botaoSair = document.getElementById("botao-sair");
const nomeAdministrador = document.getElementById("nome-administrador");

function lerToken() {
    try {
        return sessionStorage.getItem(CHAVE_TOKEN);
    } catch (erro) {
        return null;
    }
}

function salvarToken(token) {
    try {
        sessionStorage.setItem(CHAVE_TOKEN, token);
    } catch (erro) {
        erroLogin.textContent = "Não foi possível manter a sessão neste navegador.";
    }
}

function apagarToken() {
    try {
        sessionStorage.removeItem(CHAVE_TOKEN);
    } catch (erro) {
        return;
    }
}

function mostrarLogin() {
    painelAdmin.hidden = true;
    telaLogin.hidden = false;
    campoUsuario.focus();
}

function mostrarPainel(usuario) {
    nomeAdministrador.textContent = usuario;
    telaLogin.hidden = true;
    painelAdmin.hidden = false;
}

async function lerMensagemDeErro(resposta, mensagemPadrao) {
    const corpo = await resposta.json().catch(() => ({}));
    return typeof corpo.detail === "string" ? corpo.detail : mensagemPadrao;
}

async function entrar(evento) {
    evento.preventDefault();
    erroLogin.textContent = "";

    const usuario = campoUsuario.value.trim();
    const senha = campoSenha.value;
    if (!usuario || !senha) {
        erroLogin.textContent = "Preencha o usuário e a senha.";
        return;
    }

    botaoEntrar.disabled = true;
    try {
        const resposta = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ username: usuario, password: senha }),
        });
        if (!resposta.ok) {
            erroLogin.textContent = await lerMensagemDeErro(resposta, "Não foi possível entrar.");
            campoSenha.value = "";
            campoSenha.focus();
            return;
        }
        const dados = await resposta.json();
        salvarToken(dados.access_token);
        formularioLogin.reset();
        await verificarSessao();
    } catch (erro) {
        erroLogin.textContent = "Erro ao falar com o servidor.";
    } finally {
        botaoEntrar.disabled = false;
    }
}

async function verificarSessao() {
    const token = lerToken();
    if (!token) {
        mostrarLogin();
        return;
    }
    try {
        const resposta = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!resposta.ok) {
            apagarToken();
            mostrarLogin();
            if (resposta.status === 401) {
                erroLogin.textContent = "Sua sessão expirou. Entre novamente.";
            }
            return;
        }
        const dados = await resposta.json();
        mostrarPainel(dados.usuario);
    } catch (erro) {
        mostrarLogin();
        erroLogin.textContent = "Erro ao falar com o servidor.";
    }
}

function sair() {
    apagarToken();
    mostrarLogin();
}

formularioLogin.addEventListener("submit", entrar);
botaoSair.addEventListener("click", sair);

verificarSessao();
