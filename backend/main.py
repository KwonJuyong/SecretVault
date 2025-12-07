from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# ==========================================
# ★ CORS 설정 ★
# ==========================================
origins = [
    "http://localhost:3000",
    "http://54.180.32.224:3000",
    "*" # (테스트용) 모든 곳에서 접속 허용
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 데이터 모델
class EncryptedNote(BaseModel):
    content: str
    password_hash: str

notes_db = []

@app.get("/")
def read_root():
    return {"message": "Cloud Vault Backend is Running!"}

@app.post("/notes")
def create_note(note: EncryptedNote):
    print(f"받은 데이터: {note}") # 로그 확인용
    notes_db.append(note)
    return {"status": "success", "message": "Note saved securely"}

@app.get("/notes")
def get_notes():
    return notes_db