'use client';

import { useState } from 'react';
import CryptoJS from 'crypto-js';

interface Note {
  user_id: string;
  content: string;
}

export default function Home() {
  const [view, setView] = useState<'login' | 'signup' | 'dashboard'>('login');
  
  // 입력 상태
  const [inputId, setInputId] = useState('');
  const [inputPw, setInputPw] = useState('');
  const [noteInput, setNoteInput] = useState('');

  // ★ 보안 세션 상태 (토큰 & 키) ★
  const [accessToken, setAccessToken] = useState(''); // 서버 통행증 (JWT)
  const [encryptionKey, setEncryptionKey] = useState(''); // 데이터 해독키 (로컬 전용)
  const [currentUser, setCurrentUser] = useState('');
  
  const [decryptedNotes, setDecryptedNotes] = useState<string[]>([]);

  // 키 파생 함수
  const deriveKeys = (password: string) => {
    return {
      authHash: CryptoJS.SHA256(password + "AUTH_SALT").toString(),
      encKey: CryptoJS.SHA256(password + "DATA_SALT").toString()
    };
  };

  // 1. 회원가입
  const handleSignup = async () => {
    if (!inputId || !inputPw) return;
    const { authHash } = deriveKeys(inputPw);

    const res = await fetch('http://54.180.32.224:8000/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: inputId, password_hash: authHash })
    });

    if (res.ok) { alert('가입 성공!'); setView('login'); }
    else alert('가입 실패');
  };

  // 2. 로그인 (토큰 받아오기)
  const handleLogin = async () => {
    if (!inputId || !inputPw) return;
    const { authHash, encKey } = deriveKeys(inputPw);

    const res = await fetch('http://54.180.32.224:8000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: inputId, password_hash: authHash })
    });

    if (res.ok) {
      const data = await res.json();
      setAccessToken(data.access_token); // ★ 토큰 저장
      setEncryptionKey(encKey);          // ★ 키 저장
      setCurrentUser(inputId);
      setView('dashboard');
      fetchNotes(data.access_token, encKey); // 데이터 로딩
    } else {
      alert('로그인 실패');
    }
  };

  // 3. 노트 불러오기 (헤더에 토큰 실어 보내기)
  const fetchNotes = async (token: string, key: string) => {
    const res = await fetch('http://54.180.32.224:8000/notes', {
      headers: { 'Authorization': `Bearer ${token}` } // ★ 신분증 제시
    });
    
    if (res.ok) {
      const data = await res.json();
      // 자동 복호화
      const decrypted = data.map((n: any) => {
        try {
          const bytes = CryptoJS.AES.decrypt(n.content, key);
          return bytes.toString(CryptoJS.enc.Utf8) || '(복호화 오류)';
        } catch { return '(데이터 손상)'; }
      });
      setDecryptedNotes(decrypted);
    }
  };

  // 4. 저장 (헤더에 토큰 실어 보내기)
  const handleSave = async () => {
    if (!noteInput) return;
    const encrypted = CryptoJS.AES.encrypt(noteInput, encryptionKey).toString();

    await fetch('http://54.180.32.224:8000/notes', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` // ★ 신분증 제시
      },
      body: JSON.stringify({ content: encrypted })
    });

    setNoteInput('');
    fetchNotes(accessToken, encryptionKey);
  };

  const handleLogout = () => {
    setAccessToken(''); setEncryptionKey(''); setCurrentUser('');
    setInputId(''); setInputPw(''); setDecryptedNotes([]);
    setView('login');
  };

  // --- [간소화된 UI] ---
  const containerStyle = { minHeight: '100vh', backgroundColor: '#121212', color: '#e0e0e0', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' };
  const boxStyle = { width: '100%', maxWidth: '400px', padding: '30px', backgroundColor: '#1e1e1e', borderRadius: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' };
  const inputSt = { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#2c2c2c', color: 'white' };
  const btnSt = { width: '100%', padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#1976d2', color: 'white', fontWeight: 'bold' as 'bold', cursor: 'pointer' };

  if (view !== 'dashboard') {
    return (
      <div style={containerStyle}>
        <div style={boxStyle}>
          <h2 style={{textAlign:'center', marginBottom:'20px'}}>🔐 Cloud Vault (JWT)</h2>
          <input placeholder="ID" value={inputId} onChange={e=>setInputId(e.target.value)} style={inputSt}/>
          <input type="password" placeholder="PW" value={inputPw} onChange={e=>setInputPw(e.target.value)} style={inputSt}/>
          {view==='login' ? 
            <><button onClick={handleLogin} style={btnSt}>로그인</button><p onClick={()=>setView('signup')} style={{textAlign:'center', marginTop:'15px', color:'#64b5f6', cursor:'pointer'}}>회원가입</p></> : 
            <><button onClick={handleSignup} style={{...btnSt, backgroundColor:'#388e3c'}}>회원가입 완료</button><p onClick={()=>setView('login')} style={{textAlign:'center', marginTop:'15px', color:'#64b5f6', cursor:'pointer'}}>돌아가기</p></>
          }
        </div>
      </div>
    );
  }

  return (
    <div style={{...containerStyle, alignItems:'flex-start', paddingTop:'50px'}}>
      <div style={{width:'100%', maxWidth:'600px'}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
          <h3>👋 {currentUser}님 (보안접속 중)</h3>
          <button onClick={handleLogout} style={{...btnSt, width:'auto', backgroundColor:'#d32f2f', padding:'5px 15px'}}>로그아웃</button>
        </div>
        <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
          <input placeholder="비밀 메모 입력..." value={noteInput} onChange={e=>setNoteInput(e.target.value)} style={{...inputSt, marginBottom:0}} onKeyDown={e=>e.key==='Enter'&&handleSave()}/>
          <button onClick={handleSave} style={{...btnSt, width:'80px'}}>저장</button>
        </div>
        <div style={{display:'grid', gap:'10px'}}>
          {decryptedNotes.map((n, i) => (
            <div key={i} style={{padding:'15px', backgroundColor:'#1e1e1e', borderRadius:'8px', border:'1px solid #333'}}>{n}</div>
          ))}
        </div>
      </div>
    </div>
  );
}