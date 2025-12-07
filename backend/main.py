import os
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import JWTError, jwt

# SQLAlchemy (DB 연결용)
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import sessionmaker, Session, declarative_base

# ==========================================
# 1. 설정 및 DB 연결
# ==========================================
app = FastAPI()

# 데이터베이스 주소 (환경변수 없으면 기본값 사용)
# 도커 내부에서는 'db' 호스트명을 사용합니다.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/cloudvault")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# JWT 보안 설정
SECRET_KEY = "super_secret_project_key_cloud_computing_2025"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # 토큰 유효시간 30분

# CORS 설정 (프론트엔드 접속 허용)
origins = [
    "http://localhost:3000",
    "http://54.180.32.224:3000",
    "*"  # 개발 편의상 전체 허용
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. DB 테이블 모델 (Schema)
# ==========================================
class UserTable(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    password_hash = Column(String)

class NoteTable(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    
    # ★ [NEW] 제목과 본문을 분리해서 저장 (둘 다 암호문 상태로 저장됨)
    title = Column(Text)
    content = Column(Text)

# 테이블 생성 (서버 시작 시 테이블이 없으면 자동 생성)
Base.metadata.create_all(bind=engine)


# ==========================================
# 3. 데이터 통신 모델 (Pydantic)
# ==========================================
class UserAuth(BaseModel):
    user_id: str
    password_hash: str

class NoteInput(BaseModel):
    title: str    # ★ [NEW] 제목 추가
    content: str  # 본문

class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str


# ==========================================
# 4. 인증 및 유틸리티 함수
# ==========================================
# DB 세션 생성기
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# JWT 토큰 생성
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# JWT 토큰 검증 (로그인 확인)
def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
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


# ==========================================
# 5. API 엔드포인트
# ==========================================

@app.get("/")
def read_root():
    return {"status": "Cloud Vault Backend v6.0 (Title Support)"}

# [회원가입]
@app.post("/signup")
def signup(user: UserAuth, db: Session = Depends(get_db)):
    existing_user = db.query(UserTable).filter(UserTable.user_id == user.user_id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 존재하는 ID입니다.")
    
    new_user = UserTable(user_id=user.user_id, password_hash=user.password_hash)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "회원가입 성공"}

# [로그인]
@app.post("/login", response_model=Token)
def login(user: UserAuth, db: Session = Depends(get_db)):
    db_user = db.query(UserTable).filter(UserTable.user_id == user.user_id).first()
    if not db_user or db_user.password_hash != user.password_hash:
        raise HTTPException(status_code=401, detail="ID 또는 비밀번호 오류")
    
    access_token = create_access_token(data={"sub": user.user_id})
    return {"access_token": access_token, "token_type": "bearer"}

# [노트 저장] - 제목(title) 포함
@app.post("/notes")
def create_note(
    note: NoteInput, 
    user_id: str = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    new_note = NoteTable(
        user_id=user_id, 
        title=note.title,     # ★ 제목 저장
        content=note.content  # 본문 저장
    )
    db.add(new_note)
    db.commit()
    return {"status": "success"}

# [내 노트 조회] - 리스트 반환
@app.get("/notes", response_model=List[NoteResponse])
def get_notes(
    user_id: str = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 최신순 정렬 (ID 내림차순)
    return db.query(NoteTable).filter(NoteTable.user_id == user_id).order_by(NoteTable.id.desc()).all()