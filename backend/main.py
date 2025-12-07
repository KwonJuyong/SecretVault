from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class EncryptedNote(BaseModel):
    content: str

@app.get("/")
def read_root():
    return {"message": "Cloud Vault Backend is Running!"}

@app.post("/notes")
def create_note(note: EncryptedNote):
    print(f"Received Encrypted Data: {note.content}")
    return {"status": "success", "message": "Data received"}