'use client';

import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Menu, Plus, Save, ChevronLeft, FileText, LogOut } from 'lucide-react';

// --- [타입 정의] ---
interface Note {
  id: number;
  title: string;
  content: string;
}

interface DecryptedNote {
  id: number;
  title: string;
  content: string;
}

export default function Home() {
  // --- [상태 관리] ---
  const [view, setView] = useState<'login' | 'app'>('login');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // 인증 및 키
  const [inputId, setInputId] = useState('');
  const [inputPw, setInputPw] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [encKey, setEncKey] = useState('');

  // 데이터
  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  
  // 에디터 입력값
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // --- [보안 로직] ---
  const deriveKeys = (password: string) => ({
    authHash: CryptoJS.SHA256(password + "AUTH_SALT").toString(),
    encKey: CryptoJS.SHA256(password + "DATA_SALT").toString()
  });

  // --- [API 통신] ---
  const handleAuth = async (type: 'login' | 'signup') => {
    if (!inputId || !inputPw) return alert('ID/PW 입력 필요');
    const { authHash, encKey } = deriveKeys(inputPw);
    
    // Nginx를 통해 /api 경로로 호출
    const res = await fetch(`/api/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: inputId, password_hash: authHash })
    });

    if (res.ok) {
      if (type === 'signup') {
        alert('가입 성공! 로그인하세요.');
      } else {
        const data = await res.json();
        setAccessToken(data.access_token);
        setEncKey(encKey);
        setView('app');
        fetchNotes(data.access_token, encKey);
      }
    } else {
      alert('실패 (ID/PW 확인)');
    }
  };

  const fetchNotes = async (token: string, key: string) => {
    const res = await fetch('/api/notes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    const decrypted = data.map((n: any) => {
      try {
        return {
          id: n.id,
          title: CryptoJS.AES.decrypt(n.title, key).toString(CryptoJS.enc.Utf8) || '(제목 없음)',
          content: CryptoJS.AES.decrypt(n.content, key).toString(CryptoJS.enc.Utf8) || ''
        };
      } catch { return { id: n.id, title: '🔒 손상된 데이터', content: '' }; }
    });
    setNotes(decrypted);
  };

  const handleSave = async () => {
    if (!editTitle) return alert('제목을 입력하세요');
    
    const encTitle = CryptoJS.AES.encrypt(editTitle, encKey).toString();
    const encContent = CryptoJS.AES.encrypt(editContent, encKey).toString();

    await fetch('/api/notes', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ title: encTitle, content: encContent })
    });

    await fetchNotes(accessToken, encKey);
    // 저장 후 입력창 유지 (연속 작업 가능하도록)
  };

  const selectNote = (note: DecryptedNote) => {
    setActiveNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const createNewNote = () => {
    setActiveNoteId(null);
    setEditTitle('');
    setEditContent('');
  };

  // --- [로그인 화면 (디자인 리뉴얼)] ---
  if (view === 'login') return (
    <div style={{
      height: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      background: '#1e1e1e', // 배경: 고급스러운 다크 그레이
      color: '#e0e0e0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <div style={{
        width: '400px', 
        padding: '50px 40px', 
        background: '#252525', // 카드: 배경보다 살짝 밝은 그레이
        borderRadius: '16px', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', // 깊은 그림자 효과
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* 로고 & 타이틀 */}
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '80px', height: '80px', marginBottom: '15px' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#fff' }}>Secret Vault</h1>
          <p style={{ margin: '10px 0 0', color: '#888', fontSize: '14px' }}>Zero-Knowledge Cloud Storage</p>
        </div>

        {/* 입력 폼 */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            placeholder="User ID" 
            value={inputId} 
            onChange={e => setInputId(e.target.value)} 
            style={inputSt} 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={inputPw} 
            onChange={e => setInputPw(e.target.value)} 
            style={inputSt} 
            onKeyDown={(e) => e.key === 'Enter' && handleAuth('login')}
          />
          
          <button 
            onClick={() => handleAuth('login')} 
            style={btnSt}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            로그인
          </button>
        </div>

        {/* 하단 링크 */}
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          계정이 없으신가요? 
          <span 
            onClick={() => handleAuth('signup')} 
            style={{ color: '#4dabf7', cursor: 'pointer', marginLeft: '8px', fontWeight: '500' }}
          >
            회원가입
          </span>
        </div>
      </div>
    </div>
  );

  // --- [메인 앱 (Notion Style)] ---
  return (
    <div style={{display:'flex', height:'100vh', background:'#1e1e1e', color:'#e0e0e0', fontFamily:'sans-serif'}}>
      
      {/* 1. 사이드바 (Left Panel) */}
      <div style={{
        width: sidebarOpen ? '260px' : '0px', 
        background:'#252525', // 사이드바 색상 변경
        borderRight:'1px solid #333', 
        transition:'width 0.3s', overflow:'hidden', display:'flex', flexDirection:'column'
      }}>
        <div style={{padding:'20px', borderBottom:'1px solid #333', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'flex', alignItems:'center', gap:'8px', fontWeight:'bold', color:'white'}}>
            <img src="/logo.png" style={{width:'20px', height:'20px'}} />
            <span>내 금고</span>
          </div>
          <Plus size={20} style={{cursor:'pointer', color:'#888'}} onClick={createNewNote}/>
        </div>
        
        <div style={{flex:1, overflowY:'auto', padding:'10px'}}>
          {notes.map(note => (
            <div key={note.id} onClick={()=>selectNote(note)} 
              style={{
                padding:'10px', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px',
                background: activeNoteId === note.id ? '#3a3a3a' : 'transparent', 
                color: activeNoteId === note.id ? 'white' : '#bbb',
                marginBottom:'5px', transition: 'background 0.2s'
              }}>
              <FileText size={16} />
              <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontSize:'14px'}}>{note.title}</span>
            </div>
          ))}
        </div>

        <div style={{padding:'15px', borderTop:'1px solid #333'}}>
          <div onClick={()=>setView('login')} style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', color:'#ff6b6b', fontSize:'14px'}}>
            <LogOut size={16}/> <span>로그아웃</span>
          </div>
        </div>
      </div>

      {/* 2. 메인 컨텐츠 (Right Panel) */}
      <div style={{flex:1, display:'flex', flexDirection:'column', height:'100vh', background:'#1e1e1e'}}>
        
        {/* 상단 툴바 */}
        <div style={{height:'50px', display:'flex', alignItems:'center', padding:'0 20px', borderBottom:'1px solid #333'}}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:'none', border:'none', color:'#888', cursor:'pointer'}}>
            {sidebarOpen ? <ChevronLeft/> : <Menu/>}
          </button>
          <div style={{flex:1}}/>
          <button onClick={handleSave} style={{display:'flex', alignItems:'center', gap:'6px', background:'#228be6', color:'white', border:'none', padding:'8px 16px', borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:'600'}}>
            <Save size={16}/> 저장
          </button>
        </div>

        {/* 에디터 영역 (Split View: 입력 | 프리뷰) */}
        <div style={{flex:1, display:'flex', overflow:'hidden'}}>
          
          {/* 입력창 (Markdown Source) */}
          <div style={{flex:1, padding:'40px', borderRight:'1px solid #333', overflowY:'auto'}}>
            <input 
              placeholder="제목 없음" 
              value={editTitle} onChange={e=>setEditTitle(e.target.value)}
              style={{width:'100%', background:'transparent', border:'none', fontSize:'32px', fontWeight:'700', color:'white', marginBottom:'30px', outline:'none'}}
            />
            <textarea 
              placeholder="여기에 내용을 입력하세요... (Markdown & LaTeX 지원)" 
              value={editContent} onChange={e=>setEditContent(e.target.value)}
              style={{width:'100%', height:'calc(100% - 100px)', background:'transparent', border:'none', color:'#ccc', fontSize:'16px', lineHeight:'1.7', resize:'none', outline:'none', fontFamily:'monospace'}}
            />
          </div>

          {/* 프리뷰 (Rendered View) */}
          <div style={{flex:1, padding:'40px', overflowY:'auto', background:'#1e1e1e'}}>
            <div className="markdown-body" style={{color:'#ddd', lineHeight:'1.7'}}>
              {/* 제목 프리뷰 */}
              <h1 style={{fontSize:'32px', borderBottom:'1px solid #333', paddingBottom:'20px', marginBottom:'30px', fontWeight:'700'}}>{editTitle || '제목 없음'}</h1>
              
              {/* 본문 프리뷰 (Markdown + Math) */}
              <ReactMarkdown 
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]}
                components={{
                  h1: ({node, ...props}) => <h1 style={{fontSize:'2em', borderBottom:'1px solid #444', paddingBottom:'0.3em', marginTop:'1em'}} {...props} />,
                  h2: ({node, ...props}) => <h2 style={{fontSize:'1.5em', borderBottom:'1px solid #444', paddingBottom:'0.3em', marginTop:'1em'}} {...props} />,
                  p: ({node, ...props}) => <p style={{marginBottom:'1em'}} {...props} />,
                  code: ({node, ...props}) => <code style={{background:'#333', padding:'2px 5px', borderRadius:'4px', fontFamily:'monospace', color:'#ff8787'}} {...props} />,
                  blockquote: ({node, ...props}) => <blockquote style={{borderLeft:'4px solid #4dabf7', paddingLeft:'15px', color:'#aaa', margin:'1em 0'}} {...props} />,
                  ul: ({node, ...props}) => <ul style={{paddingLeft:'20px', marginBottom:'1em'}} {...props} />,
                  ol: ({node, ...props}) => <ol style={{paddingLeft:'20px', marginBottom:'1em'}} {...props} />,
                }}
              >
                {editContent || '*미리보기가 여기에 표시됩니다.*'}
              </ReactMarkdown>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// 스타일 객체
const inputSt = {
  display: 'block', 
  width: '100%', 
  padding: '14px', 
  marginBottom: '12px', 
  background: '#333', 
  border: '1px solid #444', 
  color: 'white', 
  borderRadius: '8px',
  fontSize: '16px',
  outline: 'none',
  transition: 'border-color 0.2s'
};

const btnSt = {
  width: '100%', 
  padding: '14px', 
  background: '#228be6', 
  color: 'white', 
  border: 'none', 
  borderRadius: '8px', 
  cursor: 'pointer', 
  fontWeight: '600', 
  fontSize: '16px',
  marginTop: '10px',
  transition: 'transform 0.1s'
};