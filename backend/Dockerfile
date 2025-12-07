FROM python:3.9

WORKDIR /app

# 1. requirements.txt 복사
COPY requirements.txt .

# 2. 라이브러리 설치
RUN pip install --no-cache-dir -r requirements.txt

# 3. 소스코드 복사
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]