export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  total_tasks: number;
  completed_tasks: number;
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
  campaign_name: string;
  user_name: string;
  [key: string]: string;
}
  [key: string]: string;
}
