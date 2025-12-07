'use client';

import { useState, useEffect, useCallback } from 'react';
import CryptoJS from 'crypto-js';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Menu, Plus, ChevronLeft, FileText, LogOut, CheckCircle, Loader2 } from 'lucide-react';

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

  // ★ 자동 저장 상태 관리
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // --- [보안 로직] ---
  const deriveKeys = (password: string) => ({
    authHash: CryptoJS.SHA256(password + "AUTH_SALT").toString(),
    encKey: CryptoJS.SHA256(password + "DATA_SALT").toString()
  });

  // --- [API 통신] ---
  const handleAuth = async (type: 'login' | 'signup') => {
    if (!inputId || !inputPw) return alert('아이디/비번을 입력하세요.');
    const { authHash, encKey } = deriveKeys(inputPw);
    
    try {
      const res = await fetch(`/api/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: inputId, password_hash: authHash })
      });

      if (res.ok) {
        if (type === 'signup') {
          alert('가입 성공! 로그인하세요.');
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
        } catch { return { id: n.id, title: '🔒 데이터 손상', content: '' }; }
      });
      setNotes(decrypted);
    } catch (e) { console.error(e); }
  };

  // ★ 실제 저장 로직 (자동 호출됨)
  const saveToCloud = async (title: string, content: string) => {
    if (!title.trim()) return; // 제목 없으면 저장 안 함
    
    setSaveStatus('saving'); // 저장 중... 아이콘 표시

    try {
      const encTitle = CryptoJS.AES.encrypt(title, encKey).toString();
      const encContent = CryptoJS.AES.encrypt(content, encKey).toString();

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ title: encTitle, content: encContent })
      });

      if (res.ok) {
        setSaveStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString());
        // 목록 갱신 (제목이 바뀌었을 수도 있으니)
        fetchNotes(accessToken, encKey); 
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      setSaveStatus('error');
    }
  };

  // ★ 디바운싱 효과 (타이핑 멈추면 1초 뒤 저장)
  useEffect(() => {
    if (!accessToken || !editTitle) return;

    const timer = setTimeout(() => {
      saveToCloud(editTitle, editContent);
    }, 1000); // 1초 대기

    return () => clearTimeout(timer); // 1초 안에 또 치면 타이머 리셋
  }, [editTitle, editContent]); // 제목이나 내용이 바뀔 때마다 실행

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

  // --- [로그인 화면] ---
  if (view === 'login') return (
    <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#050505', color:'white'}}>
      <div style={{width:'400px', padding:'50px 40px', background:'#161616', border:'1px solid #333', borderRadius:'16px', display:'flex', flexDirection:'column', alignItems:'center', boxShadow:'0 0 60px rgba(255,255,255,0.05)'}}>
        <div style={{marginBottom:'30px'}}><img src="/logo.png" style={{width:'80px', filter:'invert(1) brightness(2)'}} /></div>
        <h1 style={{fontSize:'28px', fontWeight:'800', marginBottom:'40px'}}>Secret Vault</h1>
        <div style={{width:'100%', display:'flex', flexDirection:'column', gap:'15px'}}>
          <input placeholder="Username" value={inputId} onChange={e=>setInputId(e.target.value)} style={inputSt}/>
          <input type="password" placeholder="Password" value={inputPw} onChange={e=>setInputPw(e.target.value)} style={inputSt} onKeyDown={e=>e.key==='Enter'&&handleAuth('login')}/>
          <button onClick={()=>handleAuth('login')} style={btnSt}>Enter Vault</button>
        </div>
        <div style={{marginTop:'30px', color:'#666', fontSize:'14px'}}>New? <span onClick={()=>handleAuth('signup')} style={{color:'white', cursor:'pointer', fontWeight:'bold', textDecoration:'underline'}}>Create Account</span></div>
      </div>
    </div>
  );

  // --- [메인 앱 (Live Edit)] ---
  return (
    <div style={{display:'flex', height:'100vh', background:'#0a0a0a', color:'#e0e0e0', fontFamily:'sans-serif'}}>
      
      {/* 1. 사이드바 */}
      <div style={{
        width: sidebarOpen ? '260px' : '0px', 
        background:'#111', borderRight:'1px solid #333', 
        transition:'width 0.3s ease', overflow:'hidden', display:'flex', flexDirection:'column'
      }}>
        <div style={{padding:'20px', borderBottom:'1px solid #333', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'flex', alignItems:'center', gap:'10px', fontWeight:'bold', color:'white'}}>
            <img src="/logo.png" style={{width:'20px', filter:'invert(1)'}} />
            <span>내 금고</span>
          </div>
          <button onClick={createNewNote} style={{background:'none', border:'none', cursor:'pointer', color:'#888', padding:'5px'}}>
            <Plus size={20} />
          </button>
        </div>
        
        <div style={{flex:1, overflowY:'auto', padding:'10px'}}>
          {notes.map(note => (
            <div key={note.id} onClick={()=>selectNote(note)} 
              style={{
                padding:'12px', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px',
                background: activeNoteId === note.id ? '#222' : 'transparent', 
                color: activeNoteId === note.id ? 'white' : '#888',
                marginBottom:'4px', border: activeNoteId === note.id ? '1px solid #333' : '1px solid transparent'
              }}>
              <FileText size={16} />
              <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontSize:'14px'}}>{note.title}</span>
            </div>
          ))}
        </div>
        
        <div style={{padding:'15px', borderTop:'1px solid #333'}}>
           <div onClick={()=>setView('login')} style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', color:'#666', fontSize:'14px', paddingLeft:'5px'}}>
            <LogOut size={16}/> <span>로그아웃</span>
          </div>
        </div>
      </div>

      {/* 2. 메인 컨텐츠 (Live Editor) */}
      <div style={{flex:1, display:'flex', flexDirection:'column', height:'100vh', background:'#0a0a0a'}}>
        
        {/* 상단 상태바 */}
        <div style={{height:'60px', display:'flex', alignItems:'center', padding:'0 30px', borderBottom:'1px solid #333'}}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:'none', border:'none', color:'#666', cursor:'pointer', marginRight:'20px'}}>
            {sidebarOpen ? <ChevronLeft/> : <Menu/>}
          </button>
          
          <div style={{flex:1}}/>
          
          {/* ★ 저장 상태 표시기 */}
          <div style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'#666'}}>
            {saveStatus === 'saving' && (
              <>
                <Loader2 size={14} className="animate-spin" /> 저장 중...
              </>
            )}
            {saveStatus === 'saved' && lastSavedTime && (
              <>
                <CheckCircle size={14} color="#4caf50" /> {lastSavedTime}에 저장됨
              </>
            )}
            {saveStatus === 'error' && <span style={{color:'red'}}>저장 실패!</span>}
          </div>
        </div>

        {/* 컨텐츠 영역 (2단 분할: 입력 | 결과) */}
        <div style={{flex:1, display:'flex', overflow:'hidden'}}>
          
          {/* [Left] 입력창 */}
          <div style={{flex:1, padding:'40px', borderRight:'1px solid #222', overflowY:'auto'}}>
            <input 
              placeholder="제목 없음" 
              value={editTitle} 
              onChange={e=>setEditTitle(e.target.value)}
              style={{
                width:'100%', background:'transparent', border:'none', 
                fontSize:'36px', fontWeight:'800', color:'white', marginBottom:'30px', outline:'none'
              }}
            />
            <textarea 
              placeholder="내용을 입력하세요..." 
              value={editContent} onChange={e=>setEditContent(e.target.value)}
              style={{
                width:'100%', height:'calc(100% - 100px)', background:'transparent', border:'none', 
                color:'#ccc', fontSize:'16px', lineHeight:'1.7', resize:'none', outline:'none', fontFamily:'monospace'
              }}
            />
          </div>

          {/* [Right] 실시간 미리보기 (Live Preview) */}
          <div style={{flex:1, padding:'40px', overflowY:'auto', background:'#0a0a0a'}}>
            <div className="markdown-body" style={{color:'#ddd', lineHeight:'1.7'}}>
              <h1 style={{fontSize:'36px', fontWeight:'800', borderBottom:'1px solid #333', paddingBottom:'20px', marginBottom:'30px'}}>
                {editTitle || '제목 없음'}
              </h1>
              <ReactMarkdown 
                remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}
                components={{
                  h1: ({node, ...props}) => <h1 style={{fontSize:'2em', borderBottom:'1px solid #333', marginTop:'1.5em'}} {...props} />,
                  h2: ({node, ...props}) => <h2 style={{fontSize:'1.5em', borderBottom:'1px solid #333', marginTop:'1.5em'}} {...props} />,
                  code: ({node, ...props}) => <code style={{background:'#222', padding:'2px 6px', borderRadius:'4px', color:'#ff8787', fontFamily:'monospace'}} {...props} />,
                  blockquote: ({node, ...props}) => <blockquote style={{borderLeft:'3px solid #fff', paddingLeft:'20px', color:'#888', margin:'20px 0'}} {...props} />
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

// 스타일
const inputSt = {display:'block', width:'100%', padding:'16px', marginBottom:'12px', background:'#0a0a0a', border:'1px solid #444', color:'white', borderRadius:'8px', fontSize:'16px', outline:'none'};
const btnSt = {width:'100%', padding:'16px', background:'#ffffff', color:'black', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'800', fontSize:'16px', marginTop:'15px'};