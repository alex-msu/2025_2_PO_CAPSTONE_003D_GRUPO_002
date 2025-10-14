from fastapi import FastAPI

app = FastAPI(title="IA Patentes (placeholder)")

@app.get("/")
def root():
    return {"ok": True, "service": "ia", "placeholder": True}

@app.get("/health")
def health():
    return "ok"