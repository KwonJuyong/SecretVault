import type { Translations } from './en';

const ko: Translations = {
  // Common
  loading: '로딩 중...',
  saving: '저장 중...',
  saved: '저장됨',
  saveFailed: '저장 실패',
  cancel: '취소',
  confirm: '확인',
  delete: '삭제',
  close: '닫기',
  view: '보기',
  edit: '편집',

  // Auth - Login
  secureWorkspace: '팀을 위한\n안전한 워크스페이스.',
  secureWorkspaceDesc: '종단간 암호화 협업 플랫폼. 메모, 문서, 리서치를 제로 지식 암호화로 안전하게 보호합니다.',
  allRightsReserved: 'All rights reserved.',
  welcomeBack: '다시 오신 것을 환영합니다',
  signInToWorkspace: '워크스페이스에 로그인하세요',
  email: '이메일',
  enterEmail: '이메일을 입력하세요',
  password: '비밀번호',
  enterPassword: '비밀번호를 입력하세요',
  signIn: '로그인',
  loadingWorkspace: '워크스페이스 로딩 중...',
  enterEmailAndPassword: '이메일과 비밀번호를 입력해주세요.',
  invalidCredentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
  loginFailed: '로그인에 실패했습니다.',
  noAccount: '계정이 없으신가요?',
  createOne: '계정 만들기',

  // Auth - Signup
  startCollaborating: '지금 바로 안전한\n협업을 시작하세요.',
  startCollaboratingDesc: '무료 계정을 만들고 암호화된 워크스페이스를 몇 초 만에 설정하세요. 팀원을 초대하고 함께 작업하세요.',
  createAccount: '계정 만들기',
  setupWorkspace: '암호화된 워크스페이스 설정',
  username: '사용자 이름',
  confirmPassword: '비밀번호 확인',
  chooseDisplayName: '표시 이름을 선택하세요',
  createPassword: '비밀번호를 만드세요',
  confirmYourPassword: '비밀번호를 다시 입력하세요',
  fillAllFields: '모든 필수 항목을 입력해주세요.',
  passwordsNoMatch: '비밀번호가 일치하지 않습니다.',
  passwordTooShort: '비밀번호는 최소 4자 이상이어야 합니다.',
  signupFailed: '회원가입에 실패했습니다.',
  haveAccount: '이미 계정이 있으신가요?',

  // Topbar
  closeSidebar: '사이드바 닫기',
  openSidebar: '사이드바 열기',
  closePanel: '패널 닫기',
  openPanel: '패널 열기',
  share: '공유',

  // Dashboard (PageTreeView)
  yourPages: '내 페이지',
  startNewPageHint: '새 페이지를 만들어 아이디어를 기록해 보세요.',
  addSubPage: '하위 페이지 추가',
  newPage: '새 페이지',
  pageSuffix: '페이지',
  pagesSuffix: '페이지',
  rootSuffix: '최상위',

  // Sidebar
  search: '검색',
  myPages: '내 페이지',
  noPagesYet: '아직 페이지가 없습니다',
  createFirstPage: '첫 번째 페이지 만들기',
  sharedWithMe: '공유된 페이지',
  noSharedPages: '공유된 페이지 없음',
  fromEmail: '{email}님이 공유',
  sharedPage: '공유된 페이지',
  trash: '휴지통',
  help: '도움말',
  account: '계정',
  displayName: '표시 이름',
  displayNamePlaceholder: '표시 이름',
  signOut: '로그아웃',

  // Right Panel
  overview: '개요',
  contents: '목차',
  noHeadings: '제목 없음',
  pages: '페이지',
  noPages: '페이지 없음',
  export: '내보내기',
  markdownExport: 'Markdown (.md)',
  pdfExport: 'PDF',

  // Width toggle
  wideLayout: '넓은 레이아웃',
  narrowLayout: '좁은 레이아웃',

  // Trash Panel
  trashEmpty: '휴지통이 비어 있습니다',
  restore: '복원',
  deletePermanently: '영구 삭제',
  permanentDeleteConfirm: '이 페이지를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',

  // Editor
  changeIcon: '아이콘 변경',
  untitled: '제목 없음',
  // Invite links
  inviteLinkCreated: '초대 링크가 생성되었습니다',
  inviteLinkNotice: '해당 주소로 가입된 계정이 없어, 가입까지 함께 진행할 수 있는 링크를 만들었습니다. 상대방에게 직접 전달하세요 — 이 링크를 가진 사람은 누구나 이 워크스페이스에 참여할 수 있으며, 7일 후 만료됩니다. 이 링크는 다시 보여드릴 수 없습니다.',
  copyLink: '링크 복사',
  inviteLinkInvalid: '유효하지 않은 초대 링크입니다.',
  inviteLinkExpired: '만료되었거나 이미 사용된 초대 링크입니다.',
  inviteJoinTitle: '{workspace} 참여',
  inviteInvitedBy: '{email} 님이 초대했습니다',
  inviteSignInFirst: '초대를 수락하려면 로그인하거나 계정을 만드세요.',
  inviteKeyNotice: '수락하면 브라우저에서 이 워크스페이스가 열립니다. 서버는 키를 볼 수 없습니다.',
  inviteAccept: '초대 수락',
  inviteWrongAccount: '이 초대는 {email} 주소로 발급되었습니다. 해당 계정으로 로그인해 주세요.',

  favorites: '즐겨찾기',
  recent: '최근 항목',
  addToFavorites: '즐겨찾기에 추가',
  removeFromFavorites: '즐겨찾기에서 제거',
  lockedPage: '🔒 잠김 — 키 없음',
  inviteNeedsWorkspaceKey: '이 워크스페이스의 키를 가지고 있지 않아 다른 사람에게 접근 권한을 줄 수 없습니다. 워크스페이스 소유자에게 초대를 요청하세요.',
  lockedPageNotice: '이 페이지의 키가 없어 복호화할 수 없습니다. 기존 내용을 보호하기 위해 편집이 비활성화되었습니다. 페이지 소유자에게 공유를 요청하세요.',

  // Editor Toolbar
  undo: '실행 취소',
  redo: '다시 실행',
  bold: '굵게 (Ctrl+B)',
  italic: '기울임 (Ctrl+I)',
  underline: '밑줄 (Ctrl+U)',
  strikethrough: '취소선',
  inlineCode: '인라인 코드',
  heading1: '제목 1',
  heading2: '제목 2',
  heading3: '제목 3',
  bulletList: '글머리 기호 목록',
  numberedList: '번호 매기기 목록',
  taskList: '작업 목록',
  quote: '인용',
  codeBlock: '코드 블록',
  divider: '구분선',
  insertTable: '표 삽입',
  insertImage: '이미지 삽입',

  // Slash Menu
  blocks: '블록',
  noMatchingCommands: '일치하는 명령이 없습니다',
  h1Label: '제목 1',
  h1Desc: '큰 섹션 제목',
  h2Label: '제목 2',
  h2Desc: '중간 섹션 제목',
  h3Label: '제목 3',
  h3Desc: '작은 섹션 제목',
  textLabel: '텍스트',
  textDesc: '일반 텍스트 단락',
  bulletLabel: '글머리 기호 목록',
  bulletDesc: '순서 없는 목록',
  numberedLabel: '번호 매기기 목록',
  numberedDesc: '순서 있는 목록',
  todoLabel: '할 일',
  todoDesc: '체크박스 작업',
  quoteLabel: '인용',
  quoteDesc: '인용 블록',
  codeLabel: '코드',
  codeDesc: '코드 블록',
  dividerLabel: '구분선',
  dividerDesc: '수평 구분선',
  tableLabel: '표',
  tableDesc: '표 삽입 (3x3)',
  imageLabel: '이미지',
  imageDesc: '이미지 업로드',
  mathInlineLabel: '인라인 수식',
  mathInlineDesc: '인라인 LaTeX 수식 ($e^2$)',
  mathBlockLabel: '블록 수식',
  mathBlockDesc: '디스플레이 LaTeX 수식 ($$...$$)',
  subpageLabel: '하위 페이지',
  subpageDesc: '중첩된 페이지 만들기',
  tocLabel: '목차',
  tocDesc: '인라인 목차 삽입',
  tocEmpty: '제목을 추가하면 목차가 표시됩니다',

  // Block Menu
  blockMenuTurnInto: '변환',
  blockMenuDuplicate: '복제',
  blockMenuDelete: '삭제',
  blockMenuBack: '뒤로',

  // Share Modal
  sharePage: '페이지 공유',
  enterEmailToShare: '공유할 이메일을 입력하세요',
  sharedWith: '공유 대상',
  notSharedYet: '아직 공유되지 않았습니다',
  removeAccess: '{email}의 접근 권한을 삭제하시겠습니까?',
  sharedWithEmail: '{email}와 공유됨',
  failedToShare: '공유에 실패했습니다',

  // Search Modal
  searchPages: '페이지 검색...',
  noPagesFound: '페이지를 찾을 수 없습니다.',
  noPagesYetSearch: '아직 페이지가 없습니다.',
  kbdNavigate: '이동',
  kbdSelect: '선택',
  kbdClose: '닫기',

  // Workspace Switcher
  workspaces: '워크스페이스',
  createWorkspace: '워크스페이스 만들기',
  workspaceSettings: '워크스페이스 설정',

  // Workspace Settings
  workspaceSettingsTitle: '워크스페이스 설정',
  inviteMember: '멤버 초대',
  emailPlaceholder: '이메일',
  owner: '소유자',
  member: '멤버',
  admin: '관리자',
  invite: '초대',
  invitedSuccess: '{email}님이 초대되었습니다!',
  members: '멤버',
  removeFromWorkspace: '{email}님을 이 워크스페이스에서 제거하시겠습니까?',
  you: '(나)',
  removeMember: '멤버 제거',
  failedToInvite: '멤버 초대에 실패했습니다',

  // Create Workspace Modal
  icon: '아이콘',
  name: '이름',
  workspaceNamePlaceholder: '예: 연구실',
  descriptionOptional: '설명 (선택사항)',
  workspaceDescPlaceholder: '이 워크스페이스의 용도는?',
  workspaceNameRequired: '워크스페이스 이름을 입력해주세요',
  creating: '생성 중...',
  failedToCreateWorkspace: '워크스페이스 생성에 실패했습니다',

  // User Guide (TipsModal)
  userGuide: '사용자 가이드',

  // Getting Started
  guideGettingStarted: '시작하기',
  guideGettingStartedDesc: 'SecretVault는 종단간 암호화 노트 및 협업 앱입니다. 회원가입 후 개인 워크스페이스가 자동으로 생성됩니다. 작성한 내용은 서버로 전송되기 전에 브라우저에서 암호화됩니다.',

  // Sharing
  guideSharingTitle: '페이지 공유',
  guideSharingStep1: '공유할 페이지를 엽니다.',
  guideSharingStep2: '상단 바의 Share 버튼을 클릭합니다.',
  guideSharingStep3: '상대방의 이메일 주소를 입력하고 확인합니다.',
  guideSharingStep4: '공유된 페이지는 상대방 사이드바의 "공유된 페이지" 섹션에 나타납니다.',
  guideSharingRevoke: '공유 해제: Share를 다시 열어 해당 사용자 옆의 제거 버튼을 클릭하세요.',

  // Export
  guideExportTitle: '페이지 내보내기',
  guideExportStep1: '오른쪽 상단 버튼으로 오른쪽 패널을 엽니다.',
  guideExportStep2: '내보내기 탭으로 이동합니다.',
  guideExportStep3: '현재 페이지를 Markdown(.md) 또는 PDF로 다운로드합니다.',

  // Language
  guideLangTitle: '언어 설정',
  guideLangDesc: '상단 바의 EN / KO 버튼을 클릭하면 영어와 한국어를 전환할 수 있습니다.',

  // Account
  guideAccountTitle: '계정 & 프로필',
  guideAccountStep1: '사이드바 하단의 이름을 클릭하면 계정 메뉴가 열립니다.',
  guideAccountStep2: '표시 이름을 수정하고 저장합니다.',
  guideAccountStep3: 'Sign Out을 클릭하여 로그아웃합니다.',
  guideAccountPasswordNote: '비밀번호 변경: 제로 지식 암호화 특성상 비밀번호 변경은 지원되지 않습니다. 비밀번호를 잊으면 데이터를 복구할 수 없으니 안전하게 보관하세요.',

  // Workspace
  guideWorkspaceTitle: '워크스페이스',
  guideWorkspaceStep1: '사이드바 상단의 워크스페이스 이름을 클릭하면 워크스페이스를 전환하거나 새로 만들 수 있습니다.',
  guideWorkspaceStep2: '워크스페이스 이름 옆 톱니바퀴 아이콘을 클릭하면 워크스페이스 설정이 열립니다.',
  guideWorkspaceStep3: '소유자와 관리자는 멤버 초대 필드에 이메일을 입력하여 멤버를 초대할 수 있습니다.',
  guideWorkspaceStep4: '멤버 이름 옆의 제거 버튼으로 멤버를 내보낼 수 있습니다.',

  guideSlashCommands: '슬래시 명령어',
  guideSlashIntro: '빈 줄 시작 부분에 /를 입력하세요:',
  guideSlashHeading: '제목 (H1, H2, H3)',
  guideSlashBullet: '글머리 기호 목록',
  guideSlashNumbered: '번호 매기기 목록',
  guideSlashTodo: '체크박스 작업 목록',
  guideSlashQuote: '인용 블록',
  guideSlashCode: '코드 블록 (구문 강조 포함)',
  guideSlashTable: '3x3 표 삽입',
  guideSlashImage: '이미지 업로드',
  guideSlashDivider: '수평 구분선',
  guideSlashMath: '인라인 또는 블록 LaTeX 수식',
  guideSlashSubpage: '하위 페이지 생성 및 연결',

  guideKeyboardShortcuts: '키보드 단축키',
  guideBold: '굵게',
  guideItalic: '기울임',
  guideUnderline: '밑줄',
  guideStrikethrough: '취소선',
  guideInlineCode: '인라인 코드',
  guideUndo: '실행 취소',
  guideRedo: '다시 실행',
  guideSearch: '페이지 검색',

  guideMarkdownShortcuts: '마크다운 단축키',
  guideMarkdownIntro: '줄 시작 부분에 입력 + 스페이스:',
  guideH1: '제목 1',
  guideH2: '제목 2',
  guideH3: '제목 3',
  guideBulletList: '글머리 기호 목록',
  guideNumberedList: '번호 매기기 목록',
  guideTaskList: '작업 목록',
  guideBlockquote: '인용 블록',
  guideCodeBlock: '코드 블록',
  guideDivider: '구분선',
  guideInlineFormatting: '인라인 서식:',
  guideBoldMd: '굵게',
  guideItalicMd: '기울임',
  guideStrikethroughMd: '취소선',
  guideInlineCodeMd: '인라인 코드',

  guideLatexMath: 'LaTeX 수식',
  guideLatexIntro: '달러 기호 사이에 수식을 입력하세요:',
  guideInlineMath: '인라인 수식 (텍스트 옆에 렌더링)',
  guideBlockMath: '블록 수식 (가운데 정렬 표시)',
  guideLatexTip: '또는 슬래시 메뉴에서 /math를 사용하세요. 수식을 클릭하면 편집할 수 있습니다.',

  guideCodeBlocks: '코드 블록',
  guideCodeBlocksDesc: '/code 또는 ```을 입력하여 삽입합니다. 코드 블록 편집 시 도구 모음에 언어 선택기가 나타납니다. 25개 이상의 언어 구문 강조를 지원합니다.',

  guideTables: '표',
  guideTablesDesc: '/table을 입력하여 삽입합니다. 도구 모음에 컨트롤이 나타납니다:',
  guideTablesAdd: '행과 열 추가/제거',
  guideTablesHeader: '헤더 행 전환',
  guideTablesMerge: '셀 병합 및 분할',
  guideTablesResize: '열 테두리를 드래그하여 크기 조정',
  guideTablesNav: 'Tab / Shift+Tab으로 셀 이동.',

  guideBlockReorder: '블록 순서 변경',
  guideBlockReorderDesc: '블록(단락, 제목, 코드 등) 위에 마우스를 올리면 왼쪽에 \u25B2 \u25BC 버튼이 나타납니다. 클릭하여 블록을 위아래로 이동합니다.',

  guideImages: '이미지',
  guideImagesDesc: '붙여넣기(Ctrl+V), 드래그 앤 드롭, 또는 /image를 사용하세요. 이미지는 콘텐츠와 함께 암호화됩니다.',

  guidePagesSubpages: '페이지 & 하위 페이지',
  guidePagesSubpagesDesc: '사이드바에서 +를 클릭하여 페이지를 만듭니다. /sub-page를 사용하여 커서 위치에 연결된 하위 페이지를 만들고 바로 이동합니다. 하위 페이지는 문서에서 클릭 가능한 링크로 나타납니다. 사이드바에서 펼치기/접기.',

  guideSearchTitle: '검색',
  guideSearchDesc: 'Ctrl+K를 눌러 검색합니다. 화살표 키로 이동, Enter로 선택합니다.',

  guideTrash: '휴지통',
  guideTrashDesc: '삭제된 페이지는 휴지통으로 이동합니다. 사이드바에서 복원하거나 영구 삭제할 수 있습니다.',

  guideWorkspaceProfile: '워크스페이스 & 프로필',
  guideWorkspaceProfileDesc: '각 사용자는 개인 워크스페이스를 받습니다. 소유자/관리자는 워크스페이스 설정에서 멤버를 초대할 수 있습니다. 사이드바 하단의 이름을 클릭하여 표시 이름을 수정하거나 로그아웃합니다.',

  guideSecurity: '보안',
  guideSecurityDesc: '제로 지식 암호화: 모든 콘텐츠는 서버로 전송되기 전에 브라우저에서 암호화됩니다. 서버는 데이터를 읽을 수 없습니다. 비밀번호를 잊으면 데이터를 복구할 수 없습니다.',

  // Profile Modal
  profile: '프로필',
  yourDisplayName: '표시 이름을 입력하세요',
  saveChanges: '변경사항 저장',
  savedExclaim: '저장됨!',

  // Language
  language: '언어',
};

export default ko;
