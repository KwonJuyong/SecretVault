'use client';

import { useState, useEffect, useRef } from 'react';
import CryptoJS from 'crypto-js';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Menu, Plus, ChevronLeft, FileText, LogOut, CheckCircle, Loader2, Trash2, User } from 'lucide-react';

interface DecryptedNote {
  id: number;
  title: string;
  content: string;
}

export default function Home() {
  const [view, setView] = useState<'login' | 'app'>('login');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const [profileOpen, setProfileOpen] = useState(false);

  const [inputId, setInputId] = useState('');
  const [inputPw, setInputPw] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [encKey, setEncKey] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  const deriveKeys = (password: string) => ({
    authHash: CryptoJS.SHA256(password + "AUTH_SALT").toString(),
    encKey: CryptoJS.SHA256(password + "DATA_SALT").toString()
  });

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
          setCurrentUserId(inputId);
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
      const res = await fetch('/api/notes', { headers: { 'Authorization': `Bearer ${token}` } });
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

  const saveToCloud = async (id: number | null, title: string, content: string) => {
    if (!title.trim()) return;
    setSaveStatus('saving');
    try {
      const encTitle = CryptoJS.AES.encrypt(title, encKey).toString();
      const encContent = CryptoJS.AES.encrypt(content, encKey).toString();
      let res;
      if (id === null) {
        res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify({ title: encTitle, content: encContent })
        });
      } else {
        res = await fetch(`/api/notes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify({ title: encTitle, content: encContent })
        });
      }
      if (res.ok) {
        const savedNote = await res.json();
        if (id === null) setActiveNoteId(savedNote.id); 
        setSaveStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString());
        fetchNotes(accessToken, encKey); 
      } else { setSaveStatus('error'); }
    } catch (e) { setSaveStatus('error'); }
  };

  const handleDeleteNote = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('정말 이 금고를 영구 삭제하시겠습니까? (복구 불가)')) return;

    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (res.ok) {
        if (activeNoteId === id) createNewNote();
        fetchNotes(accessToken, encKey);
      } else {
        alert('삭제 실패');
      }
    } catch (e) { alert('오류 발생'); }
  };

  const handleLogout = () => {
    setView('login');
    setAccessToken('');
    setEncKey('');
    setNotes([]);
    setEditTitle('');
    setEditContent('');
    setActiveNoteId(null);
  };

  useEffect(() => {
    if (!accessToken || !editTitle) return;
    const timer = setTimeout(() => { saveToCloud(activeNoteId, editTitle, editContent); }, 1000); 
    return () => clearTimeout(timer);
  }, [editTitle, editContent]);

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

  if (view === 'login') return (
    <div style={{height:'100vh', width:'100vw', display:'flex', justifyContent:'center', alignItems:'center', background:'#050505', color:'white', overflow:'hidden'}}>
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

  return (
    <div style={{display:'flex', height:'100vh', width:'100vw', background:'#0a0a0a', color:'#e0e0e0', fontFamily:'sans-serif', overflow:'hidden'}}>
      
      {/* 사이드바 */}
      <div style={{width: sidebarOpen ? '260px' : '0px', height: '100%', background:'#111', borderRight:'1px solid #333', transition:'width 0.3s ease', display:'flex', flexDirection:'column', flexShrink: 0}}>
        <div style={{padding:'20px', borderBottom:'1px solid #333', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0}}>
          <div style={{display:'flex', alignItems:'center', gap:'10px', fontWeight:'bold', color:'white'}}>
            <img src="/logo.png" style={{width:'20px', filter:'invert(1)'}} /><span>내 금고</span>
          </div>
          <button onClick={createNewNote} style={{background:'none', border:'none', cursor:'pointer', color:'#888', padding:'5px'}}><Plus size={20}/></button>
        </div>
        
        <div style={{flex:1, overflowY:'auto', padding:'10px'}}>
          {notes.map(note => (
            <div key={note.id} onClick={()=>selectNote(note)} 
              style={{
                padding:'12px', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px',
                background: activeNoteId === note.id ? '#222' : 'transparent', 
                color: activeNoteId === note.id ? 'white' : '#888',
                marginBottom:'4px', border: activeNoteId === note.id ? '1px solid #333' : '1px solid transparent',
                position: 'relative'
              }}>
              <div style={{display:'flex', alignItems:'center', gap:'10px', overflow:'hidden'}}>
                <FileText size={16} flex-shrink={0} />
                <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontSize:'14px'}}>{note.title}</span>
              </div>
              
              <button 
                onClick={(e) => handleDeleteNote(e, note.id)}
                style={{background:'none', border:'none', color:'#555', cursor:'pointer', padding:'4px', display:'flex'}}
                title="영구 삭제"
                onMouseOver={(e) => e.currentTarget.style.color = '#ff4444'}
                onMouseOut={(e) => e.currentTarget.style.color = '#555'}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div style={{flex:1, display:'flex', flexDirection:'column', height:'100%', overflow:'hidden'}}>
        
        {/* 상단바 */}
        <div style={{height:'60px', display:'flex', alignItems:'center', padding:'0 30px', borderBottom:'1px solid #333', flexShrink:0}}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:'none', border:'none', color:'#666', cursor:'pointer', marginRight:'20px'}}><ChevronLeft/></button>
          
          <div style={{flex:1}}/>
          
          <div style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'#666', marginRight:'20px'}}>
            {saveStatus === 'saving' && <><Loader2 size={14} className="animate-spin" /> 저장 중...</>}
            {saveStatus === 'saved' && lastSavedTime && <><CheckCircle size={14} color="#4caf50" /> 저장됨</>}
            {saveStatus === 'error' && <span style={{color:'red'}}>저장 실패!</span>}
          </div>

          <div style={{position:'relative'}}>
            <button 
              onClick={() => setProfileOpen(!profileOpen)}
              style={{
                display:'flex', alignItems:'center', gap:'8px', padding:'6px 12px', 
                background:'#222', border:'1px solid #333', borderRadius:'20px', 
                color:'white', cursor:'pointer', fontSize:'13px'
              }}
            >
              <User size={14} />
              <span>{currentUserId}</span>
            </button>

            {profileOpen && (
              <div style={{
                position:'absolute', top:'45px', right:'0', width:'200px', 
                background:'#161616', border:'1px solid #333', borderRadius:'8px', 
                boxShadow:'0 10px 30px rgba(0,0,0,0.5)', zIndex:100, overflow:'hidden'
              }}>
                <div style={{padding:'15px', borderBottom:'1px solid #333'}}>
                  <p style={{fontSize:'12px', color:'#888', marginBottom:'4px'}}>Signed in as</p>
                  <p style={{fontWeight:'bold', color:'white'}}>{currentUserId}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  style={{
                    width:'100%', padding:'12px', background:'transparent', border:'none', 
                    color:'#ff4444', cursor:'pointer', textAlign:'left', fontSize:'14px', 
                    display:'flex', alignItems:'center', gap:'8px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#222'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={14} /> 로그아웃
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{flex:1, display:'flex', overflow:'hidden'}}>
          {/* 입력창: 100% 높이 + flex 1 */}
          <div style={{flex:1, padding:'40px', borderRight:'1px solid #222', overflowY:'auto', height:'100%', display:'flex', flexDirection:'column'}}>
            <input 
              placeholder="제목 없음" 
              value={editTitle} 
              onChange={e=>setEditTitle(e.target.value)}
              style={{width:'100%', background:'transparent', border:'none', fontSize:'36px', fontWeight:'800', color:'white', marginBottom:'30px', outline:'none', flexShrink:0}}
            />
            <textarea 
              placeholder="내용을 입력하세요..." 
              value={editContent} onChange={e=>setEditContent(e.target.value)}
              style={{
                width:'100%', 
                height:'100%', // 높이 꽉 채우기 (문제 1 해결)
                flex: 1, 
                background:'transparent', border:'none', 
                color:'#ccc', fontSize:'16px', lineHeight:'1.7', resize:'none', outline:'none', fontFamily:'monospace'
              }}
            />
          </div>
          
          {/* 미리보기: 강제 줄바꿈 적용 */}
          <div style={{flex:1, padding:'40px', overflowY:'auto', background:'#0a0a0a', height:'100%'}}>
            <div className="markdown-body" style={{color:'#ddd', lineHeight:'1.7'}}>
              <h1 style={{fontSize:'36px', fontWeight:'800', borderBottom:'1px solid #333', paddingBottom:'20px', marginBottom:'30px'}}>{editTitle || '제목 없음'}</h1>
              {/* [수정할 부분] ReactMarkdown 컴포넌트 */}
              <ReactMarkdown 
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]} 
                components={{
                  h1: ({node, ...props}) => <h1 style={{fontSize:'2em', borderBottom:'1px solid #333', marginTop:'1.5em'}} {...props} />,
                  h2: ({node, ...props}) => <h2 style={{fontSize:'1.5em', borderBottom:'1px solid #333', marginTop:'1.5em'}} {...props} />,
                  code: ({node, ...props}) => <code style={{background:'#222', padding:'2px 6px', borderRadius:'4px', color:'#ff8787', fontFamily:'monospace'}} {...props} />,
                  blockquote: ({node, ...props}) => <blockquote style={{borderLeft:'3px solid #fff', paddingLeft:'20px', color:'#888', margin:'20px 0'}} {...props} />,
                  // ★ p 태그 스타일 강제 적용 (CSS가 안 먹을 경우 대비)
                  p: ({node, ...props}) => <p style={{marginBottom: '1em', minHeight: '1em', whiteSpace: 'pre-wrap'}} {...props} />
                }}
              >
                {/* ★ 핵심 마법 코드: 엔터(\n)를 '스페이스 두 번 + 엔터'로 강제 치환 */}
                {/* 이렇게 하면 엔터를 여러 번 쳐도 그대로 반영됩니다. */}
                {editContent ? editContent.replace(/\n/g, '  \n') : '*내용이 없습니다.*'}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputSt = {display:'block', width:'100%', padding:'16px', marginBottom:'12px', background:'#0a0a0a', border:'1px solid #444', color:'white', borderRadius:'8px', fontSize:'16px', outline:'none'};
const btnSt = {width:'100%', padding:'16px', background:'#ffffff', color:'black', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'800', fontSize:'16px', marginTop:'15px'};