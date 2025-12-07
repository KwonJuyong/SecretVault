from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from datetime import datetime, timedelta
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import os

app = FastAPI()

# --- [1. 설정 & DB 연결] ---
# .env 파일에 있는 주소를 가져오거나, 없으면 기본값 사용
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/cloudvault")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# JWT 설정
SECRET_KEY = "super_secret_project_key_cloud_computing_2025"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# CORS 설정
origins = ["http://localhost:3000", "http://54.180.32.224:3000", "*"]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- [2. DB 테이블 모델 (Schema)] ---
# 엑셀 시트 2개를 만든다고 생각하시면 됩니다.

class UserTable(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True) # 아이디
    password_hash = Column(String) # 비밀번호 해시

class NoteTable(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # 작성자 ID
    content = Column(Text) # 암호문

# 테이블 생성 (서버 켜질 때 없으면 자동 생성)
Base.metadata.create_all(bind=engine)

# --- [3. 데이터 모델 (Pydantic)] ---
class UserAuth(BaseModel):
    user_id: str
    password_hash: str

class Note(BaseModel):
    content: str

class Token(BaseModel):
    access_token: str
    token_type: str

# --- [4. 유틸리티 함수] ---
# DB 세션 가져오기 (쓰고 나면 자동으로 닫음)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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

@app.get("/")
def read_root():
    return {"status": "Cloud Vault Backend v5.0 (Real DB Connected)"}

# --- [5. API 로직 (DB 사용)] ---

@app.post("/signup")
def signup(user: UserAuth, db: Session = Depends(get_db)):
    # 중복 체크
    existing_user = db.query(UserTable).filter(UserTable.user_id == user.user_id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 존재하는 ID입니다.")
    
    # DB에 저장
    new_user = UserTable(user_id=user.user_id, password_hash=user.password_hash)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "회원가입 성공"}

@app.post("/login", response_model=Token)
def login(user: UserAuth, db: Session = Depends(get_db)):
    # DB에서 찾기
    db_user = db.query(UserTable).filter(UserTable.user_id == user.user_id).first()
    
    if not db_user or db_user.password_hash != user.password_hash:
        raise HTTPException(status_code=401, detail="ID 또는 비밀번호 오류")
    
    access_token = create_access_token(data={"sub": user.user_id})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/notes")
def create_note(note: Note, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # DB에 저장
    new_note = NoteTable(user_id=user_id, content=note.content)
    db.add(new_note)
    db.commit()
    return {"status": "success"}

@app.get("/notes")
def get_notes(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # DB에서 내 글만 조회
    return db.query(NoteTable).filter(NoteTable.user_id == user_id).all()