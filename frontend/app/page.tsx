'use client';

import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Menu, Plus, Save, ChevronLeft, FileText, LogOut } from 'lucide-react';

// --- [타입 정의] ---
interface DecryptedNote {
  id: number;
  title: string;
  content: string;
}

export default function Home() {
  // --- [상태 관리] ---
  const [view, setView] = useState<'login' | 'app'>('login');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const [inputId, setInputId] = useState('');
  const [inputPw, setInputPw] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [encKey, setEncKey] = useState('');

  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // --- [보안 로직] ---
  const deriveKeys = (password: string) => ({
    authHash: CryptoJS.SHA256(password + "AUTH_SALT").toString(),
    encKey: CryptoJS.SHA256(password + "DATA_SALT").toString()
  });

  // --- [API 통신] ---
  const handleAuth = async (type: 'login' | 'signup') => {
    if (!inputId || !inputPw) return alert('아이디와 비밀번호를 입력해주세요.');
    const { authHash, encKey } = deriveKeys(inputPw);
    
    try {
      const res = await fetch(`/api/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: inputId, password_hash: authHash })
      });

      if (res.ok) {
        if (type === 'signup') {
          alert('가입 완료! 로그인해주세요.');
          setView('login');
        } else {
          const data = await res.json();
          setAccessToken(data.access_token);
          setEncKey(encKey);
          setView('app');
          fetchNotes(data.access_token, encKey);
        }
      } else {
        alert('인증 실패');
      }
    } catch (e) { alert('서버 오류'); }
  };

  const fetchNotes = async (token: string, key: string) => {
    try {
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
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    if (!editTitle) return alert('제목을 입력하세요');
    const encTitle = CryptoJS.AES.encrypt(editTitle, encKey).toString();
    const encContent = CryptoJS.AES.encrypt(editContent, encKey).toString();

    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ title: encTitle, content: encContent })
    });
    await fetchNotes(accessToken, encKey);
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

  // --- [로그인 화면 (High Contrast Fix)] ---
  if (view === 'login') return (
    <div style={{
      height: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      background: '#050505', // 아주 깊은 블랙 (배경)
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '50px 40px', 
        background: '#161616', // 카드: 배경보다 명확히 밝은 톤
        border: '1px solid #333', // 테두리를 확실하게 줘서 구분감 형성
        borderRadius: '16px', 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: '0 0 60px rgba(255, 255, 255, 0.05)' // 은은한 흰색 글로우 효과
      }}>
        {/* 로고 영역 (색상 반전 필터 적용) */}
        <div style={{ marginBottom: '30px', position: 'relative' }}>
          <img 
            src="/logo.png" 
            alt="Vault Logo" 
            style={{ 
              width: '90px', 
              height: '90px', 
              filter: 'invert(1) brightness(2)', // ★ 핵심: 검은 아이콘을 강제로 하얗게 만듦!
              opacity: 0.9 
            }} 
          />
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 10px', letterSpacing: '-1px' }}>Secret Vault</h1>
        <p style={{ margin: '0 0 40px', color: '#888', fontSize: '15px' }}>Zero-Knowledge Security Storage</p>

        {/* 입력 폼 */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{position: 'relative'}}>
            <span style={{position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize:'14px', fontWeight:'600'}}>ID</span>
            <input 
              placeholder="Username" 
              value={inputId} 
              onChange={e => setInputId(e.target.value)} 
              style={modernInputSt} 
            />
          </div>
          
          <div style={{position: 'relative'}}>
            <span style={{position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize:'14px', fontWeight:'600'}}>PW</span>
            <input 
              type="password" 
              placeholder="Password" 
              value={inputPw} 
              onChange={e => setInputPw(e.target.value)} 
              style={modernInputSt} 
              onKeyDown={(e) => e.key === 'Enter' && handleAuth('login')}
            />
          </div>
          
          <button 
            onClick={() => handleAuth('login')} 
            style={modernBtnSt}
          >
            Enter Vault
          </button>
        </div>

        {/* 하단 구분선 */}
        <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
          New here? 
          <span 
            onClick={() => handleAuth('signup')} 
            style={{ color: '#fff', cursor: 'pointer', marginLeft: '8px', textDecoration: 'underline', fontWeight: 'bold' }}
          >
            Create Account
          </span>
        </div>
      </div>
    </div>
  );

  // --- [메인 앱] ---
  return (
    <div style={{display:'flex', height:'100vh', background:'#0a0a0a', color:'#e0e0e0', fontFamily:'sans-serif'}}>
      
      {/* 사이드바 */}
      <div style={{
        width: sidebarOpen ? '260px' : '0px', 
        background:'#111', 
        borderRight:'1px solid #333', 
        transition:'width 0.3s ease', overflow:'hidden', display:'flex', flexDirection:'column'
      }}>
        <div style={{padding:'20px', borderBottom:'1px solid #333', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'flex', alignItems:'center', gap:'10px', fontWeight:'bold', color:'white'}}>
            <img 
              src="/logo.png" 
              style={{ width:'24px', filter: 'invert(1)' }} // ★ 사이드바 아이콘도 하얗게!
            />
            <span>내 금고</span>
          </div>
          <Plus size={20} style={{cursor:'pointer', color:'#888'}} onClick={createNewNote}/>
        </div>
        
        <div style={{flex:1, overflowY:'auto', padding:'10px'}}>
          {notes.map(note => (
            <div key={note.id} onClick={()=>selectNote(note)} 
              style={{
                padding:'12px', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px',
                background: activeNoteId === note.id ? '#222' : 'transparent', 
                color: activeNoteId === note.id ? 'white' : '#888',
                marginBottom:'4px', transition: 'all 0.2s', border: activeNoteId === note.id ? '1px solid #333' : '1px solid transparent'
              }}>
              <FileText size={16} />
              <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontSize:'14px'}}>{note.title}</span>
            </div>
          ))}
        </div>

        <div style={{padding:'15px', borderTop:'1px solid #333'}}>
          <div onClick={()=>setView('login')} style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', color:'#666', fontSize:'14px', paddingLeft: '5px'}}>
            <LogOut size={16}/> <span>로그아웃</span>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div style={{flex:1, display:'flex', flexDirection:'column', height:'100vh', background:'#0a0a0a'}}>
        <div style={{height:'50px', display:'flex', alignItems:'center', padding:'0 20px', borderBottom:'1px solid #333'}}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:'none', border:'none', color:'#666', cursor:'pointer'}}>
            {sidebarOpen ? <ChevronLeft/> : <Menu/>}
          </button>
          <div style={{flex:1}}/>
          <button onClick={handleSave} style={{display:'flex', alignItems:'center', gap:'6px', background:'#fff', color:'black', border:'none', padding:'8px 16px', borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:'700'}}>
            <Save size={16}/> 저장
          </button>
        </div>

        <div style={{flex:1, display:'flex', overflow:'hidden'}}>
          <div style={{flex:1, padding:'40px', borderRight:'1px solid #333', overflowY:'auto'}}>
            <input 
              placeholder="제목 없음" 
              value={editTitle} onChange={e=>setEditTitle(e.target.value)}
              style={{width:'100%', background:'transparent', border:'none', fontSize:'36px', fontWeight:'800', color:'white', marginBottom:'30px', outline:'none', letterSpacing: '-0.5px'}}
            />
            <textarea 
              placeholder="내용을 입력하세요..." 
              value={editContent} onChange={e=>setEditContent(e.target.value)}
              style={{width:'100%', height:'calc(100% - 100px)', background:'transparent', border:'none', color:'#ccc', fontSize:'16px', lineHeight:'1.7', resize:'none', outline:'none', fontFamily:'monospace'}}
            />
          </div>

          <div style={{flex:1, padding:'40px', overflowY:'auto', background:'#0a0a0a'}}>
            <div className="markdown-body" style={{color:'#ddd', lineHeight:'1.7'}}>
              <h1 style={{fontSize:'36px', fontWeight:'800', borderBottom:'1px solid #333', paddingBottom:'20px', marginBottom:'30px'}}>{editTitle || '제목 없음'}</h1>
              <ReactMarkdown 
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]}
                components={{
                  h1: ({node, ...props}) => <h1 style={{fontSize:'2em', borderBottom:'1px solid #333', marginTop:'1.5em'}} {...props} />,
                  h2: ({node, ...props}) => <h2 style={{fontSize:'1.5em', borderBottom:'1px solid #333', marginTop:'1.5em'}} {...props} />,
                  code: ({node, ...props}) => <code style={{background:'#222', padding:'2px 6px', borderRadius:'4px', color:'#fff', fontFamily:'monospace'}} {...props} />,
                  blockquote: ({node, ...props}) => <blockquote style={{borderLeft:'3px solid #fff', paddingLeft:'20px', color:'#888', margin:'20px 0'}} {...props} />,
                }}
              >
                {editContent || '*내용이 없습니다.*'}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- [스타일 객체 (Enhanced Contrast)] ---
const modernInputSt = {
  display: 'block', 
  width: '100%', 
  padding: '16px 16px 16px 50px', 
  background: '#0a0a0a', // 입력창은 배경보다 더 어둡게
  border: '1px solid #444', // 경계선 밝기를 높여서 확실히 보이게
  color: 'white', 
  borderRadius: '8px',
  fontSize: '16px',
  outline: 'none',
  transition: 'border-color 0.2s ease',
  fontFamily: 'monospace'
};

const modernBtnSt = {
  width: '100%', 
  padding: '16px', 
  background: '#ffffff', 
  color: '#000000', 
  border: 'none', 
  borderRadius: '8px', 
  cursor: 'pointer', 
  fontWeight: '800', 
  fontSize: '16px',
  marginTop: '15px',
  transition: 'transform 0.1s'
};