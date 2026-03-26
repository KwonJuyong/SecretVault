export interface LoginResponse {
  access_token: string;
  token_type: string;
  email: string;
  display_name: string | null;
  workspace_id: string;
}

export interface UserProfile {
  email: string;
  display_name: string | null;
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

export interface SharedPageItem {
  id: string;
  title: string;
  icon: string;
  workspace_id: string;
  workspace_name: string;
  permission: string;
  shared_by_email: string | null;
  updated_at: string | null;
}

export interface WorkspaceMember {
  email: string;
  display_name: string | null;
  role: string;
  joined_at: string | null;
}
