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

# 1. 설정 및 DB 연결
app = FastAPI()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/cloudvault")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

SECRET_KEY = "super_secret_project_key_cloud_computing_2025"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

origins = ["http://localhost:3000", "http://54.180.32.224:3000", "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. DB 테이블 모델
class UserTable(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    password_hash = Column(String)

class NoteTable(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    title = Column(Text)
    content = Column(Text)

Base.metadata.create_all(bind=engine)

# 3. 데이터 통신 모델
class UserAuth(BaseModel):
    user_id: str
    password_hash: str

class NoteInput(BaseModel):
    title: str
    content: str

class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# 4. 유틸리티 함수
def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None: raise HTTPException(status_code=401)
    except JWTError: raise HTTPException(status_code=401)
    return user_id

# 5. API 엔드포인트
@app.get("/")
def read_root():
    return {"status": "Cloud Vault Backend v7.0 (Update Support)"}

@app.post("/signup")
def signup(user: UserAuth, db: Session = Depends(get_db)):
    if db.query(UserTable).filter(UserTable.user_id == user.user_id).first():
        raise HTTPException(status_code=400, detail="ID Exists")
    new_user = UserTable(user_id=user.user_id, password_hash=user.password_hash)
    db.add(new_user)
    db.commit()
    return {"message": "Success"}

@app.post("/login", response_model=Token)
def login(user: UserAuth, db: Session = Depends(get_db)):
    db_user = db.query(UserTable).filter(UserTable.user_id == user.user_id).first()
    if not db_user or db_user.password_hash != user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid Auth")
    return {"access_token": create_access_token(data={"sub": user.user_id}), "token_type": "bearer"}

# [저장 - Create] ★ 중요: 저장 후 생성된 ID를 반환하도록 수정
@app.post("/notes", response_model=NoteResponse)
def create_note(note: NoteInput, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    new_note = NoteTable(user_id=user_id, title=note.title, content=note.content)
    db.add(new_note)
    db.commit()
    db.refresh(new_note) # ID 발급 확인
    return new_note

# [수정 - Update] ★ 새로 추가된 기능 (덮어쓰기)
@app.put("/notes/{note_id}", response_model=NoteResponse)
def update_note(note_id: int, note: NoteInput, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # 내 노트이면서 ID가 일치하는 것을 찾음
    db_note = db.query(NoteTable).filter(NoteTable.id == note_id, NoteTable.user_id == user_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db_note.title = note.title
    db_note.content = note.content
    db.commit()
    db.refresh(db_note)
    return db_note

@app.get("/notes", response_model=List[NoteResponse])
def get_notes(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(NoteTable).filter(NoteTable.user_id == user_id).order_by(NoteTable.id.desc()).all()