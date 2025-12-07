from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import List

app = FastAPI()

# --- [설정] ---
SECRET_KEY = "super_secret_project_key_cloud_computing_2025" # 실제론 .env에서
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# CORS 설정
origins = ["http://localhost:3000", "http://54.180.32.224:3000", "*"]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- [데이터 모델] ---
class UserAuth(BaseModel):
    user_id: str
    password_hash: str

class Note(BaseModel):
    content: str  # 암호문

class Token(BaseModel):
    access_token: str
    token_type: str

# --- [DB 대용] ---
users_db = {} # { "user_id": "password_hash" }
notes_db = [] # [ {"user_id": "...", "content": "..."}, ... ]

# 토큰 추출기 (Authorization: Bearer ... 헤더에서 꺼냄)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- [핵심함수 1] 토큰 생성 ---
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- [핵심함수 2] 토큰 검증 (보안요원) ---
def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="자격 증명(토큰)이 유효하지 않습니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return user_id

@app.get("/")
def read_root():
    return {"status": "Cloud Vault Backend v4.0 (JWT Auth)"}

# 1. 회원가입
@app.post("/signup")
def signup(user: UserAuth):
    if user.user_id in users_db:
        raise HTTPException(status_code=400, detail="이미 존재하는 ID입니다.")
    users_db[user.user_id] = user.password_hash
    return {"message": "회원가입 성공"}

# 2. 로그인 (토큰 발급)
@app.post("/login", response_model=Token)
def login(user: UserAuth):
    stored_hash = users_db.get(user.user_id)
    if not stored_hash or stored_hash != user.password_hash:
        raise HTTPException(status_code=401, detail="ID 또는 비밀번호 오류")
    
    # 인증 성공 -> 토큰 발급
    access_token = create_access_token(data={"sub": user.user_id})
    return {"access_token": access_token, "token_type": "bearer"}

# 3. 메모 작성 (토큰 필수 ★)
@app.post("/notes")
def create_note(note: Note, user_id: str = Depends(get_current_user)):
    # Depends(get_current_user)가 토큰을 검사해서 user_id를 뽑아줌
    notes_db.append({"user_id": user_id, "content": note.content})
    return {"status": "success"}

# 4. 내 메모 조회 (토큰 필수 ★)
@app.get("/notes")
def get_notes(user_id: str = Depends(get_current_user)):
    return [n for n in notes_db if n["user_id"] == user_id]