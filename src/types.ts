export interface Project {
  id: number;
  name: string;
  description: string;
  team: string;
  created_at: string;
  total_tasks: number;
  completed_tasks: number;
}

export interface Team {
  id: number;
  name: string;
  description: string;
  color: string;
  created_at: string;
  project_count?: number;
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string;
  assignee: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface S1Case {
  case_id: string;
  dt: string;
  channel: string;
  subject: string;
  group_id: string;
  group_name: string;
  assigned_to: string;
  classification: string;
  quarter?: string;
  campaign_name: string;
  user_name: string;
  case_status?: string;
  case_state_id?: number;
  task_id?: number | null;
  task_status?: string | null;
  is_task_completed?: boolean;
  task_auto_completed?: boolean;
  is_case_resolved?: boolean;
  [key: string]: any;
}
