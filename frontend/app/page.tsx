'use client';

import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // 수식 스타일
import { Menu, Plus, Save, ChevronLeft, FileText, LogOut } from 'lucide-react'; // 아이콘

// --- [타입 정의] ---
interface Note {
  id: number; // DB ID
  title: string; // 암호문
  content: string; // 암호문
}

interface DecryptedNote {
  id: number;
  title: string; // 평문
  content: string; // 평문
}

export default function Home() {
  // --- [상태 관리] ---
  const [view, setView] = useState<'login' | 'app'>('login');
  const [sidebarOpen, setSidebarOpen] = useState(true); // 사이드바 토글
  
  // 인증 및 키
  const [inputId, setInputId] = useState('');
  const [inputPw, setInputPw] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [encKey, setEncKey] = useState('');

  // 데이터
  const [notes, setNotes] = useState<DecryptedNote[]>([]); // 복호화된 리스트
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null); // 현재 선택된 노트
  
  // 에디터 입력값 (제목/본문)
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
    
    const res = await fetch(`http://54.180.32.224:8000/${type}`, {
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
      alert('실패');
    }
  };

  const fetchNotes = async (token: string, key: string) => {
    const res = await fetch('http://54.180.32.224:8000/notes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    // 리스트 전체 복호화 (제목 표시를 위해)
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
    
    // 제목과 본문 모두 암호화
    const encTitle = CryptoJS.AES.encrypt(editTitle, encKey).toString();
    const encContent = CryptoJS.AES.encrypt(editContent, encKey).toString();

    await fetch('http://54.180.32.224:8000/notes', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ title: encTitle, content: encContent })
    });

    // 저장 후 목록 갱신 및 초기화
    await fetchNotes(accessToken, encKey);
    setEditTitle('');
    setEditContent('');
    setActiveNoteId(null); // 새 글 작성 모드로 복귀하려면 이걸 조정
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

  // --- [로그인 화면] ---
  if (view === 'login') return (
    <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#191919', color:'white'}}>
      <div style={{width:'300px', padding:'30px', background:'#2d2d2d', borderRadius:'10px'}}>
        <h2 style={{textAlign:'center', marginBottom:'20px'}}>🔐 Vault Login</h2>
        <input placeholder="ID" value={inputId} onChange={e=>setInputId(e.target.value)} style={inputSt}/>
        <input type="password" placeholder="PW" value={inputPw} onChange={e=>setInputPw(e.target.value)} style={inputSt}/>
        <button onClick={()=>handleAuth('login')} style={btnSt}>로그인</button>
        <button onClick={()=>handleAuth('signup')} style={{...btnSt, background:'#444', marginTop:'10px'}}>회원가입</button>
      </div>
    </div>
  );

  // --- [메인 앱 (Notion Style)] ---
  return (
    <div style={{display:'flex', height:'100vh', background:'#191919', color:'#e0e0e0', fontFamily:'sans-serif'}}>
      
      {/* 1. 사이드바 (Left Panel) */}
      <div style={{
        width: sidebarOpen ? '260px' : '0px', 
        background:'#202020', borderRight:'1px solid #333', 
        transition:'width 0.3s', overflow:'hidden', display:'flex', flexDirection:'column'
      }}>
        <div style={{padding:'20px', borderBottom:'1px solid #333', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <span style={{fontWeight:'bold'}}>📂 내 금고</span>
          <Plus size={20} style={{cursor:'pointer'}} onClick={createNewNote}/>
        </div>
        
        <div style={{flex:1, overflowY:'auto', padding:'10px'}}>
          {notes.map(note => (
            <div key={note.id} onClick={()=>selectNote(note)} 
              style={{
                padding:'10px', borderRadius:'5px', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px',
                background: activeNoteId === note.id ? '#333' : 'transparent', marginBottom:'5px'
              }}>
              <FileText size={16} color="#888"/>
              <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{note.title}</span>
            </div>
          ))}
        </div>

        <div style={{padding:'15px', borderTop:'1px solid #333'}}>
          <div onClick={()=>setView('login')} style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', color:'#ff5555'}}>
            <LogOut size={16}/> <span>로그아웃</span>
          </div>
        </div>
      </div>

      {/* 2. 메인 컨텐츠 (Right Panel) */}
      <div style={{flex:1, display:'flex', flexDirection:'column', height:'100vh'}}>
        
        {/* 상단 툴바 */}
        <div style={{height:'50px', display:'flex', alignItems:'center', padding:'0 20px', borderBottom:'1px solid #333'}}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:'none', border:'none', color:'#888', cursor:'pointer'}}>
            {sidebarOpen ? <ChevronLeft/> : <Menu/>}
          </button>
          <div style={{flex:1}}/>
          <button onClick={handleSave} style={{display:'flex', alignItems:'center', gap:'5px', background:'#2383e2', color:'white', border:'none', padding:'8px 15px', borderRadius:'5px', cursor:'pointer'}}>
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
              style={{width:'100%', background:'transparent', border:'none', fontSize:'36px', fontWeight:'bold', color:'white', marginBottom:'20px', outline:'none'}}
            />
            <textarea 
              placeholder="여기에 마크다운을 입력하세요... (수식은 $...$ 사용)" 
              value={editContent} onChange={e=>setEditContent(e.target.value)}
              style={{width:'100%', height:'calc(100% - 80px)', background:'transparent', border:'none', color:'#ccc', fontSize:'16px', lineHeight:'1.6', resize:'none', outline:'none'}}
            />
          </div>

          {/* 프리뷰 (Rendered View) */}
          <div style={{flex:1, padding:'40px', overflowY:'auto', background:'#1e1e1e'}}>
            <div className="markdown-body" style={{color:'#ddd', lineHeight:'1.7'}}>
              {/* 제목 프리뷰 */}
              <h1 style={{borderBottom:'1px solid #444', paddingBottom:'10px', marginBottom:'20px'}}>{editTitle || '제목 없음'}</h1>
              
              {/* 본문 프리뷰 (Markdown + Math) */}
              <ReactMarkdown 
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]}
                components={{
                  // 스타일 커스텀
                  h1: ({node, ...props}) => <h1 style={{fontSize:'2em', borderBottom:'1px solid #444', paddingBottom:'0.3em'}} {...props} />,
                  h2: ({node, ...props}) => <h2 style={{fontSize:'1.5em', borderBottom:'1px solid #444', paddingBottom:'0.3em'}} {...props} />,
                  code: ({node, ...props}) => <code style={{background:'#333', padding:'2px 5px', borderRadius:'3px'}} {...props} />,
                  blockquote: ({node, ...props}) => <blockquote style={{borderLeft:'4px solid #555', paddingLeft:'10px', color:'#999'}} {...props} />
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

// 간단 스타일
const inputSt = {display:'block', width:'100%', padding:'10px', marginBottom:'10px', background:'#333', border:'none', color:'white', borderRadius:'5px'};
const btnSt = {width:'100%', padding:'12px', background:'#2383e2', color:'white', border:'none', borderRadius:'5px', cursor:'pointer', fontWeight:'bold'};