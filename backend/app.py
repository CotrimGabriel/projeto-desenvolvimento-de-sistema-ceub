import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

DATABASE_URL = os.environ["DATABASE_URL"]
PASTA_FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
UM_ANO_EM_SEGUNDOS = 60 * 60 * 24 * 365

engine = create_engine(DATABASE_URL)
SessaoLocal = sessionmaker(bind=engine)
Base = declarative_base()

CATALOGO = {
    "Eletrônicos": [
        ("Fone Bluetooth", 149.90, "🎧"),
        ("Mouse Gamer", 89.90, "🖱️"),
        ("Teclado Mecânico", 249.90, "⌨️"),
    ],
    "Moda": [
        ("Camiseta Básica", 49.90, "👕"),
        ("Calça Jeans", 139.90, "👖"),
        ("Tênis Casual", 229.90, "👟"),
    ],
    "Casa": [
        ("Luminária de Mesa", 79.90, "💡"),
        ("Jogo de Panelas", 299.90, "🍳"),
        ("Cafeteira", 189.90, "☕"),
    ],
}


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True)
    nome = Column(String(50), nullable=False, unique=True)


class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True)
    nome = Column(String(100), nullable=False)
    preco = Column(Float, nullable=False)
    emoji = Column(String(10), nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    categoria = relationship("Categoria")


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(String(36), primary_key=True)
    criado_em = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class Interesse(Base):
    __tablename__ = "interesses"

    usuario_id = Column(String(36), ForeignKey("usuarios.id"), primary_key=True)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), primary_key=True)
    cliques = Column(Integer, nullable=False)
    ultimo_clique = Column(DateTime(timezone=True), nullable=False)
    categoria = relationship("Categoria")


class ProdutoResposta(BaseModel):
    id: int
    nome: str
    preco: float
    emoji: str
    categoria_id: int
    categoria: str


class PrioridadeResposta(BaseModel):
    categoria_id: int
    categoria: str
    cliques: int


class CliqueEntrada(BaseModel):
    produto_id: int


class ErroResposta(BaseModel):
    detail: str


def popular_banco():
    with SessaoLocal() as db:
        if db.query(Categoria).first():
            return
        for nome_categoria, itens in CATALOGO.items():
            categoria = Categoria(nome=nome_categoria)
            db.add(categoria)
            db.flush()
            for nome, preco, emoji in itens:
                db.add(Produto(nome=nome, preco=preco, emoji=emoji, categoria_id=categoria.id))
        db.commit()


@asynccontextmanager
async def ciclo_de_vida(app):
    Base.metadata.create_all(engine)
    popular_banco()
    yield


app = FastAPI(
    title="API de Taggeamento Web",
    description="Protótipo de e-commerce que ordena os produtos conforme as categorias clicadas por cada visitante.",
    version="1.0.0",
    lifespan=ciclo_de_vida,
)


@app.exception_handler(Exception)
async def tratar_erro_inesperado(request: Request, erro: Exception):
    return JSONResponse(status_code=500, content={"detail": "Erro interno no servidor"})


def obter_sessao():
    with SessaoLocal() as db:
        yield db


def obter_usuario(
    response: Response,
    visitante_id: str | None = Cookie(default=None),
    db: Session = Depends(obter_sessao),
) -> Usuario:
    usuario = db.get(Usuario, visitante_id) if visitante_id else None
    if usuario is None:
        usuario = Usuario(id=str(uuid.uuid4()))
        db.add(usuario)
        db.commit()
        response.set_cookie(
            key="visitante_id",
            value=usuario.id,
            max_age=UM_ANO_EM_SEGUNDOS,
            httponly=True,
            samesite="lax",
        )
    return usuario


def buscar_interesses(db: Session, usuario: Usuario) -> list[Interesse]:
    return (
        db.query(Interesse)
        .filter(Interesse.usuario_id == usuario.id)
        .order_by(Interesse.cliques.desc(), Interesse.ultimo_clique.desc())
        .all()
    )


def montar_prioridades(interesses: list[Interesse]) -> list[PrioridadeResposta]:
    return [
        PrioridadeResposta(
            categoria_id=interesse.categoria_id,
            categoria=interesse.categoria.nome,
            cliques=interesse.cliques,
        )
        for interesse in interesses
    ]


@app.get("/api/produtos", response_model=list[ProdutoResposta], summary="Lista os produtos pela prioridade do visitante", tags=["Produtos"])
def listar_produtos(usuario: Usuario = Depends(obter_usuario), db: Session = Depends(obter_sessao)):
    interesses = buscar_interesses(db, usuario)
    posicoes = {interesse.categoria_id: indice for indice, interesse in enumerate(interesses)}
    produtos = sorted(
        db.query(Produto).all(),
        key=lambda produto: (posicoes.get(produto.categoria_id, len(posicoes)), produto.categoria_id, produto.id),
    )
    return [
        ProdutoResposta(
            id=produto.id,
            nome=produto.nome,
            preco=produto.preco,
            emoji=produto.emoji,
            categoria_id=produto.categoria_id,
            categoria=produto.categoria.nome,
        )
        for produto in produtos
    ]


@app.post(
    "/api/eventos/clique",
    response_model=list[PrioridadeResposta],
    summary="Registra o clique em um produto",
    tags=["Tags"],
    responses={404: {"model": ErroResposta, "description": "Produto não encontrado"}},
)
def registrar_clique(
    entrada: CliqueEntrada,
    usuario: Usuario = Depends(obter_usuario),
    db: Session = Depends(obter_sessao),
):
    produto = db.get(Produto, entrada.produto_id)
    if produto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado")

    agora = datetime.now(timezone.utc)
    comando = insert(Interesse).values(
        usuario_id=usuario.id,
        categoria_id=produto.categoria_id,
        cliques=1,
        ultimo_clique=agora,
    )
    comando = comando.on_conflict_do_update(
        index_elements=["usuario_id", "categoria_id"],
        set_={"cliques": Interesse.cliques + 1, "ultimo_clique": agora},
    )
    db.execute(comando)
    db.commit()
    return montar_prioridades(buscar_interesses(db, usuario))


@app.get("/api/tags", response_model=list[PrioridadeResposta], summary="Mostra a lista de prioridades do visitante", tags=["Tags"])
def listar_tags(usuario: Usuario = Depends(obter_usuario), db: Session = Depends(obter_sessao)):
    return montar_prioridades(buscar_interesses(db, usuario))


@app.delete("/api/tags", status_code=status.HTTP_204_NO_CONTENT, summary="Apaga a lista de prioridades do visitante", tags=["Tags"])
def limpar_tags(usuario: Usuario = Depends(obter_usuario), db: Session = Depends(obter_sessao)):
    db.query(Interesse).filter(Interesse.usuario_id == usuario.id).delete()
    db.commit()


app.mount("/", StaticFiles(directory=PASTA_FRONTEND, html=True), name="frontend")
