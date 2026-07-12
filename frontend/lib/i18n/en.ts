const en = {
  // Common
  loading: 'Loading...',
  saving: 'Saving...',
  saved: 'Saved',
  saveFailed: 'Save failed',
  cancel: 'Cancel',
  confirm: 'Confirm',
  delete: 'Delete',
  close: 'Close',
  view: 'View',
  edit: 'Edit',

  // Auth - Login
  secureWorkspace: 'Secure workspace\nfor your team.',
  secureWorkspaceDesc: 'End-to-end encrypted collaboration platform. Your notes, documents, and research — protected with zero-knowledge encryption.',
  allRightsReserved: 'All rights reserved.',
  welcomeBack: 'Welcome back',
  signInToWorkspace: 'Sign in to your workspace',
  email: 'Email',
  enterEmail: 'Enter your email',
  password: 'Password',
  enterPassword: 'Enter your password',
  signIn: 'Sign In',
  loadingWorkspace: 'Loading workspace...',
  enterEmailAndPassword: 'Please enter your email and password.',
  invalidCredentials: 'Invalid email or password.',
  loginFailed: 'Login failed.',
  noAccount: "Don't have an account?",
  createOne: 'Create one',

  // Auth - Signup
  startCollaborating: 'Start collaborating\nsecurely today.',
  startCollaboratingDesc: 'Create your free account and set up your encrypted workspace in seconds. Invite your team members and start working together.',
  createAccount: 'Create account',
  setupWorkspace: 'Set up your encrypted workspace',
  username: 'Username',
  confirmPassword: 'Confirm Password',
  chooseDisplayName: 'Choose a display name',
  createPassword: 'Create a password',
  confirmYourPassword: 'Confirm your password',
  fillAllFields: 'Please fill in all required fields.',
  passwordsNoMatch: 'Passwords do not match.',
  passwordTooShort: 'Password must be at least 4 characters.',
  signupFailed: 'Signup failed.',
  haveAccount: 'Already have an account?',

  // Topbar
  closeSidebar: 'Close sidebar',
  openSidebar: 'Open sidebar',
  closePanel: 'Close panel',
  openPanel: 'Open panel',
  share: 'Share',

  // Dashboard (PageTreeView)
  yourPages: 'Your pages',
  startNewPageHint: 'Start a new page to capture your ideas.',
  addSubPage: 'Add sub-page',
  newPage: 'New page',
  pageSuffix: 'page',
  pagesSuffix: 'pages',
  rootSuffix: 'root',

  // Sidebar
  search: 'Search',
  myPages: 'My Pages',
  noPagesYet: 'No pages yet',
  createFirstPage: 'Create your first page',
  sharedWithMe: 'Shared with me',
  noSharedPages: 'No shared pages',
  fromEmail: 'From {email}',
  sharedPage: 'Shared page',
  trash: 'Trash',
  help: 'Help',
  account: 'Account',
  displayName: 'Display Name',
  displayNamePlaceholder: 'Display name',
  signOut: 'Sign Out',

  // Right Panel
  overview: 'Overview',
  contents: 'Contents',
  noHeadings: 'No headings',
  pages: 'Pages',
  noPages: 'No pages',
  export: 'Export',
  markdownExport: 'Markdown (.md)',
  pdfExport: 'PDF',

  // Width toggle
  wideLayout: 'Wide layout',
  narrowLayout: 'Narrow layout',

  // Trash Panel
  trashEmpty: 'Trash is empty',
  restore: 'Restore',
  deletePermanently: 'Delete permanently',
  permanentDeleteConfirm: 'Permanently delete this page? This cannot be undone.',

  // Editor
  changeIcon: 'Change icon',
  untitled: 'Untitled',
  // Invite links
  inviteLinkCreated: 'Invite link created',
  inviteLinkNotice: "That address has no account yet, so here is a link they can sign up through. Send it to them directly — anyone holding it can join this workspace, and it expires in 7 days. We can't show it again.",
  copyLink: 'Copy link',
  inviteLinkInvalid: 'This invite link is not valid.',
  inviteLinkExpired: 'This invite link has expired or has already been used.',
  inviteJoinTitle: 'Join {workspace}',
  inviteInvitedBy: 'Invited by {email}',
  inviteSignInFirst: 'Sign in or create an account to accept this invite.',
  inviteKeyNotice: 'Accepting unlocks this workspace in your browser. The server never sees the key.',
  inviteAccept: 'Accept invite',
  inviteWrongAccount: 'This invite was issued for {email}. Sign in with that account to accept it.',

  favorites: 'Favorites',
  recent: 'Recent',
  addToFavorites: 'Add to favorites',
  removeFromFavorites: 'Remove from favorites',
  lockedPage: '🔒 Locked — no key',
  inviteNeedsWorkspaceKey: "You don't hold this workspace's key, so you can't grant access to anyone else. Ask the workspace owner to invite them.",
  lockedPageNotice: "You don't have the key for this page, so it can't be decrypted. Editing is disabled to protect the existing content. Ask the page owner to share it with you.",

  // Editor Toolbar
  undo: 'Undo',
  redo: 'Redo',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  inlineCode: 'Inline Code',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  bulletList: 'Bullet List',
  numberedList: 'Numbered List',
  taskList: 'Task List',
  quote: 'Quote',
  codeBlock: 'Code Block',
  divider: 'Divider',
  insertTable: 'Insert Table',
  insertImage: 'Insert Image',

  // Slash Menu
  blocks: 'Blocks',
  noMatchingCommands: 'No matching commands',
  h1Label: 'Heading 1',
  h1Desc: 'Big section heading',
  h2Label: 'Heading 2',
  h2Desc: 'Medium section heading',
  h3Label: 'Heading 3',
  h3Desc: 'Small section heading',
  textLabel: 'Text',
  textDesc: 'Plain text paragraph',
  bulletLabel: 'Bullet List',
  bulletDesc: 'Unordered list item',
  numberedLabel: 'Numbered List',
  numberedDesc: 'Ordered list item',
  todoLabel: 'To-do',
  todoDesc: 'Task with checkbox',
  quoteLabel: 'Quote',
  quoteDesc: 'Blockquote',
  codeLabel: 'Code',
  codeDesc: 'Code block',
  dividerLabel: 'Divider',
  dividerDesc: 'Horizontal line separator',
  tableLabel: 'Table',
  tableDesc: 'Insert a table (3x3)',
  imageLabel: 'Image',
  imageDesc: 'Upload an image',
  mathInlineLabel: 'Inline Math',
  mathInlineDesc: 'Inline LaTeX formula ($e^2$)',
  mathBlockLabel: 'Block Math',
  mathBlockDesc: 'Display LaTeX equation ($$...$$)',
  subpageLabel: 'Sub-page',
  subpageDesc: 'Create a nested page',
  tocLabel: 'Table of Contents',
  tocDesc: 'Insert inline table of contents',
  tocEmpty: 'Add headings to see the table of contents',

  // Block Menu
  blockMenuTurnInto: 'Turn into',
  blockMenuDuplicate: 'Duplicate',
  blockMenuDelete: 'Delete',
  blockMenuBack: 'Back',

  // Share Modal
  sharePage: 'Share Page',
  enterEmailToShare: 'Enter email to share',
  sharedWith: 'Shared with',
  notSharedYet: 'Not shared with anyone yet',
  removeAccess: "Remove {email}'s access?",
  sharedWithEmail: 'Shared with {email}',
  failedToShare: 'Failed to share',

  // Search Modal
  searchPages: 'Search pages...',
  noPagesFound: 'No pages found.',
  noPagesYetSearch: 'No pages yet.',
  kbdNavigate: 'Navigate',
  kbdSelect: 'Select',
  kbdClose: 'Close',

  // Workspace Switcher
  workspaces: 'Workspaces',
  createWorkspace: 'Create Workspace',
  workspaceSettings: 'Workspace settings',

  // Workspace Settings
  workspaceSettingsTitle: 'Workspace Settings',
  inviteMember: 'Invite Member',
  emailPlaceholder: 'Email',
  owner: 'Owner',
  member: 'Member',
  admin: 'Admin',
  invite: 'Invite',
  invitedSuccess: '{email} has been invited!',
  members: 'Members',
  removeFromWorkspace: 'Remove {email} from this workspace?',
  you: '(you)',
  removeMember: 'Remove member',
  failedToInvite: 'Failed to invite member',

  // Create Workspace Modal
  icon: 'Icon',
  name: 'Name',
  workspaceNamePlaceholder: 'e.g. Research Lab',
  descriptionOptional: 'Description (optional)',
  workspaceDescPlaceholder: "What's this workspace for?",
  workspaceNameRequired: 'Workspace name is required',
  creating: 'Creating...',
  failedToCreateWorkspace: 'Failed to create workspace',

  // User Guide (TipsModal)
  userGuide: 'User Guide',

  // Getting Started
  guideGettingStarted: 'Getting Started',
  guideGettingStartedDesc: 'SecretVault is an end-to-end encrypted note-taking and collaboration app. After signing up, a personal workspace is created automatically. Everything you write is encrypted in your browser before being sent to the server.',

  // Sharing
  guideSharingTitle: 'Sharing a Page',
  guideSharingStep1: 'Open the page you want to share.',
  guideSharingStep2: 'Click the Share button in the top bar.',
  guideSharingStep3: "Enter the recipient's email address and confirm.",
  guideSharingStep4: 'The shared page appears under "Shared with me" in the recipient\'s sidebar.',
  guideSharingRevoke: 'To revoke access: open Share again and click the remove button next to the user.',

  // Export
  guideExportTitle: 'Exporting Pages',
  guideExportStep1: 'Open the right panel using the button in the top-right corner.',
  guideExportStep2: 'Go to the Export tab.',
  guideExportStep3: 'Download the current page as Markdown (.md) or PDF.',

  // Language
  guideLangTitle: 'Language',
  guideLangDesc: 'Click the EN / KO button in the top bar to switch between English and Korean.',

  // Account
  guideAccountTitle: 'Account & Profile',
  guideAccountStep1: 'Click your name at the bottom of the sidebar to open the account menu.',
  guideAccountStep2: 'Edit your display name and save.',
  guideAccountStep3: 'Click Sign Out to log out.',
  guideAccountPasswordNote: 'Password change: Due to zero-knowledge encryption, password changing is not supported. If you forget your password, your data cannot be recovered — keep it safe.',

  // Workspace
  guideWorkspaceTitle: 'Workspaces',
  guideWorkspaceStep1: 'Click the workspace name at the top of the sidebar to switch workspaces or create a new one.',
  guideWorkspaceStep2: 'Click the gear icon next to the workspace name to open Workspace Settings.',
  guideWorkspaceStep3: 'Owners and admins can invite members by entering their email in the Invite Member field.',
  guideWorkspaceStep4: 'Members can be removed by clicking Remove next to their name.',

  guideSlashCommands: 'Slash Commands',
  guideSlashIntro: 'Type / at the start of an empty line:',
  guideSlashHeading: 'Headings (H1, H2, H3)',
  guideSlashBullet: 'Bullet list',
  guideSlashNumbered: 'Numbered list',
  guideSlashTodo: 'Task list with checkboxes',
  guideSlashQuote: 'Blockquote',
  guideSlashCode: 'Code block (with syntax highlighting)',
  guideSlashTable: 'Insert 3x3 table',
  guideSlashImage: 'Upload an image',
  guideSlashDivider: 'Horizontal divider',
  guideSlashMath: 'Inline or Block LaTeX equation',
  guideSlashSubpage: 'Create & link a sub-page',

  guideKeyboardShortcuts: 'Keyboard Shortcuts',
  guideBold: 'Bold',
  guideItalic: 'Italic',
  guideUnderline: 'Underline',
  guideStrikethrough: 'Strikethrough',
  guideInlineCode: 'Inline code',
  guideUndo: 'Undo',
  guideRedo: 'Redo',
  guideSearch: 'Search pages',

  guideMarkdownShortcuts: 'Markdown Shortcuts',
  guideMarkdownIntro: 'Type at start of line + Space:',
  guideH1: 'Heading 1',
  guideH2: 'Heading 2',
  guideH3: 'Heading 3',
  guideBulletList: 'Bullet list',
  guideNumberedList: 'Numbered list',
  guideTaskList: 'Task list',
  guideBlockquote: 'Blockquote',
  guideCodeBlock: 'Code block',
  guideDivider: 'Divider',
  guideInlineFormatting: 'Inline formatting:',
  guideBoldMd: 'Bold',
  guideItalicMd: 'Italic',
  guideStrikethroughMd: 'Strikethrough',
  guideInlineCodeMd: 'Inline code',

  guideLatexMath: 'LaTeX Math',
  guideLatexIntro: 'Type math between dollar signs:',
  guideInlineMath: 'Inline math (renders next to text)',
  guideBlockMath: 'Block math (centered display)',
  guideLatexTip: 'Or use /math from the slash menu. Click any math to edit it.',

  guideCodeBlocks: 'Code Blocks',
  guideCodeBlocksDesc: 'Type /code or ``` to insert. A language selector appears in the toolbar when editing a code block. Supports syntax highlighting for 25+ languages.',

  guideTables: 'Tables',
  guideTablesDesc: 'Type /table to insert. Controls appear in the toolbar:',
  guideTablesAdd: 'Add/remove rows and columns',
  guideTablesHeader: 'Toggle header row',
  guideTablesMerge: 'Merge and split cells',
  guideTablesResize: 'Drag column borders to resize',
  guideTablesNav: 'Use Tab / Shift+Tab to navigate cells.',

  guideBlockReorder: 'Block Reordering',
  guideBlockReorderDesc: 'Hover over any block (paragraph, heading, code, etc.) to see \u25B2 \u25BC buttons on the left. Click to move the block up or down.',

  guideImages: 'Images',
  guideImagesDesc: 'Paste (Ctrl+V), drag & drop, or use /image. Images are encrypted with your content.',

  guidePagesSubpages: 'Pages & Sub-pages',
  guidePagesSubpagesDesc: 'Click + in sidebar to create pages. Use /sub-page to create a linked sub-page at cursor position and navigate to it directly. Sub-pages appear as clickable links in the document. Expand/collapse in sidebar.',

  guideSearchTitle: 'Search',
  guideSearchDesc: 'Press Ctrl+K to search. Arrow keys navigate, Enter selects.',

  guideTrash: 'Trash',
  guideTrashDesc: 'Deleted pages go to Trash. Restore or permanently delete from the sidebar.',

  guideWorkspaceProfile: 'Workspace & Profile',
  guideWorkspaceProfileDesc: 'Each user gets a personal workspace. Owners/admins can invite members via Workspace Settings. Click your name at the bottom of the sidebar to edit your display name or sign out.',

  guideSecurity: 'Security',
  guideSecurityDesc: 'Zero-knowledge encryption: all content is encrypted in your browser before being sent to the server. The server cannot read your data. If you forget your password, data cannot be recovered.',

  // Profile Modal
  profile: 'Profile',
  yourDisplayName: 'Your display name',
  saveChanges: 'Save Changes',
  savedExclaim: 'Saved!',

  // Language
  language: 'Language',
};

export default en;
export type Translations = typeof en;
