"""Ponto de entrada da API (uvicorn app.interface.main:app).

Nesta task (T02) só criamos a instância do FastAPI para o container ter algo
executável. Nenhuma rota é registrada aqui ainda — POST /api/v1/heartbeats
entra em T10, junto com o router de heartbeats.
"""

from fastapi import FastAPI

app = FastAPI(title="Equipment Monitor API")