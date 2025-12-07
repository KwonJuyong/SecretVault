'use client';

import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';

export default function Home() {
  const [note, setNote] = useState(''); // 입력한 메모
  const [password, setPassword] = useState(''); // 잠금 비밀번호
  const [status, setStatus] = useState(''); // 상태 메시지
  const [apiUrl, setApiUrl] = useState('');

  // 환경변수에서 API 주소 가져오기
  useEffect(() => {
    setApiUrl('http://54.180.32.224:8000'); 
  }, []);

  // 1. 암호화 및 저장 (Client-Side Encryption)
  const handleSave = async () => {
    if (!note || !password) {
      alert('메모와 비밀번호를 모두 입력해주세요.');
      return;
    }

    try {
      // 핵심: 브라우저에서 암호화 수행 (서버는 절대 원문을 모름)
      const encrypted = CryptoJS.AES.encrypt(note, password).toString();
      
      console.log('원본:', note);
      console.log('암호화됨:', encrypted);

      // 백엔드로 전송
      const response = await fetch(`${apiUrl}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: encrypted, // 암호문만 보냄
          password_hash: CryptoJS.SHA256(password).toString() // 검증용 해시
        }),
      });

      if (response.ok) {
        setStatus(`✅ 저장 성공! (서버에 저장된 데이터: ${encrypted.substring(0, 15)}...)`);
        setNote(''); // 입력창 비우기
      } else {
        setStatus('❌ 저장 실패');
      }
    } catch (error) {
      console.error(error);
      setStatus('❌ 에러 발생');
    }
  };

  return (
    <main style={{ padding: '50px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>🔒 Zero-Knowledge Cloud Vault</h1>
      <p style={{ color: '#666' }}>AWS도 당신의 데이터를 훔쳐볼 수 없습니다.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
        <textarea
          placeholder="나만의 비밀 메모를 입력하세요..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={5}
          style={{ padding: '10px', fontSize: '16px', width: '100%' }}
        />
        
        <input
          type="password"
          placeholder="암호화 키 (비밀번호)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '10px', fontSize: '16px' }}
        />

        <button 
          onClick={handleSave}
          style={{ 
            padding: '15px', 
            backgroundColor: '#0070f3', 
            color: 'white', 
            border: 'none', 
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 'bold'
          }}
        >
          🔒 안전하게 클라우드에 저장
        </button>
      </div>

      {status && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
          {status}
        </div>
      )}
    </main>
  );
}