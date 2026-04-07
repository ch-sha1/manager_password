from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import test, passwords, auth, generator
from app.database import engine
from app import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Password Manager API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(test.router)
app.include_router(auth.router)
app.include_router(passwords.router)
app.include_router(generator.router)

@app.get("/")
async def root():
    return {"status": "ok"}

@app.get("/api/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
