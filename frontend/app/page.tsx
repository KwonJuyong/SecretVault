'use client';

import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';

// 메모 데이터 타입 정의
interface Note {
  content: string; // 암호문
  password_hash: string;
}

export default function Home() {
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState<Note[]>([]); // 불러온 메모 리스트
  const [status, setStatus] = useState('');
  
  // 조회용 상태
  const [decryptPass, setDecryptPass] = useState('');
  const [decryptedContent, setDecryptedContent] = useState<{ [key: number]: string }>({});

  // 1. 초기 로딩 (저장된 메모들 가져오기)
  const fetchNotes = async () => {
    try {
      const res = await fetch('http://54.180.32.224:8000/notes');
      const data = await res.json();
      setNotes(data); // 최신순 정렬은 백엔드나 여기서 처리 가능
    } catch (err) {
      console.error('메모 로딩 실패:', err);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // 2. 암호화 및 저장
  const handleSave = async () => {
    if (!note || !password) return alert('내용과 비밀번호를 입력하세요.');

    const encrypted = CryptoJS.AES.encrypt(note, password).toString();
    const passwordHash = CryptoJS.SHA256(password).toString();

    const response = await fetch('http://54.180.32.224:8000/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: encrypted, password_hash: passwordHash }),
    });

    if (response.ok) {
      setStatus('✅ 안전하게 암호화되어 클라우드에 전송되었습니다.');
      setNote('');
      setPassword('');
      fetchNotes(); // 리스트 갱신
    } else {
      setStatus('❌ 저장 실패');
    }
  };

  // 3. 복호화 (내용 확인)
  const handleDecrypt = (index: number, encryptedContent: string, correctHash: string) => {
    const inputPass = prompt('이 메모를 열려면 비밀번호를 입력하세요:');
    if (!inputPass) return;

    // 1차 검증: 비밀번호 해시가 서버와 일치하는지?
    if (CryptoJS.SHA256(inputPass).toString() !== correctHash) {
      alert('⛔ 비밀번호가 틀렸습니다! (복호화 불가)');
      return;
    }

    try {
      // 핵심: 복호화 시도
      const bytes = CryptoJS.AES.decrypt(encryptedContent, inputPass);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);

      if (originalText) {
        // 성공 시 해당 인덱스의 내용만 보여줌
        setDecryptedContent({ ...decryptedContent, [index]: originalText });
      } else {
        alert('복호화 실패: 데이터가 손상되었거나 키가 다릅니다.');
      }
    } catch (e) {
      alert('복호화 오류 발생');
    }
  };

  return (
    <main style={{ backgroundColor: '#1a1a1a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif', padding: '40px' }}>
      
      {/* 헤더 섹션 */}
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔐 Cloud Vault</h1>
        <p style={{ color: '#888' }}>AWS도 훔쳐볼 수 없는 Zero-Knowledge 저장소</p>
      </div>

      {/* 입력 섹션 (카드 UI) */}
      <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#2d2d2d', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
        <h3 style={{ marginBottom: '15px', color: '#4CAF50' }}>새 보안 메모 작성</h3>
        <textarea
          placeholder="여기에 비밀 내용을 입력하세요..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: '15px', borderRadius: '8px', border: 'none', backgroundColor: '#404040', color: 'white', fontSize: '16px', marginBottom: '15px' }}
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="password"
            placeholder="잠금 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ flex: 1, padding: '15px', borderRadius: '8px', border: 'none', backgroundColor: '#404040', color: 'white' }}
          />
          <button 
            onClick={handleSave}
            style={{ flex: 1, backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
          >
            🔒 암호화 저장
          </button>
        </div>
        {status && <p style={{ marginTop: '15px', color: '#0070f3', fontSize: '14px' }}>{status}</p>}
      </div>

      {/* 리스트 섹션 (격자 레이아웃) */}
      <div style={{ maxWidth: '800px', margin: '50px auto 0' }}>
        <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '10px', marginBottom: '20px' }}>📦 저장된 금고 목록 ({notes.length}개)</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
          {notes.map((item, idx) => (
            <div key={idx} style={{ backgroundColor: '#2d2d2d', padding: '20px', borderRadius: '10px', border: '1px solid #444', position: 'relative' }}>
              
              {/* 복호화 성공 여부에 따라 다른 화면 표시 */}
              {decryptedContent[idx] ? (
                <div style={{ animation: 'fadeIn 0.5s' }}>
                  <span style={{ fontSize: '24px' }}>🔓</span>
                  <p style={{ marginTop: '10px', fontSize: '18px', color: '#fff', wordBreak: 'break-all' }}>
                    {decryptedContent[idx]}
                  </p>
                  <p style={{ fontSize: '12px', color: '#4CAF50', marginTop: '10px' }}>복호화 완료됨</p>
                </div>
              ) : (
                <div>
                  <span style={{ fontSize: '24px' }}>🔒</span>
                  <p style={{ marginTop: '10px', fontFamily: 'monospace', color: '#888', fontSize: '12px', wordBreak: 'break-all', height: '60px', overflow: 'hidden' }}>
                    {item.content.substring(0, 50)}...
                  </p>
                  <button
                    onClick={() => handleDecrypt(idx, item.content, item.password_hash)}
                    style={{ width: '100%', marginTop: '15px', padding: '10px', backgroundColor: '#444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                  >
                    내용 확인하기
                  </button>
                </div>
              )}

            </div>
          ))}
        </div>
      </div>
    </main>
  );
}