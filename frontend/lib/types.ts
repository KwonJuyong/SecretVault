export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  display_name: string | null;
  workspace_id: string;
}

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  email: string | null;
  created_at: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  owner_id: number;
  role: string | null;
  created_at: string | null;
}

export interface PageTreeItem {
  id: string;
  title: string;
  icon: string;
  parent_id: string | null;
  position: number;
  has_children: boolean;
  updated_at: string | null;
}

export interface PageData {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  content: string;
  icon: string;
  position: number;
  is_deleted: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface WorkspaceMember {
  user_id: string;
  display_name: string | null;
  role: string;
  joined_at: string | null;
}
