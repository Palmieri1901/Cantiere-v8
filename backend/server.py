import os
from fastapi import FastAPI, APIRouter, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from database import client as mongo_client
from auth import auth_router, seed_admin
from routers import (
    tariffe, clienti, lavori, stats, export,
    cantiere, backup, preventivo, report, anni,
    dipendenti, mobile, esterni, servizio
)

app = FastAPI(title="Cantiere Nautico API")

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def serve_frontend():
    base_dir = os.getcwd()
    static_exists = os.path.exists("static")
    files_in_dir = os.listdir(base_dir)
    static_files = os.listdir("static") if static_exists else []
    
    return JSONResponse(
        status_code=404,
        content={
            "message": "Debug path",
            "current_dir": base_dir,
            "root_contents": files_in_dir,
            "static_exists": static_exists,
            "static_contents": static_files
        }
    )

# Includi i router dell'applicazione
app.include_router(auth_router)
app.include_router(tariffe.router)
app.include_router(clienti.router)
app.include_router(lavori.router)
app.include_router(stats.router)
app.include_router(export.router)
app.include_router(cantiere.router)
app.include_router(backup.router)
app.include_router(preventivo.router)
app.include_router(report.router)
app.include_router(anni.router)
app.include_router(dipendenti.router)
app.include_router(mobile.router)
app.include_router(esterni.router)
app.include_router(servizio.router)