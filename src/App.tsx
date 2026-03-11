import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown,
  ChevronLeft,
  Download, 
  LayoutDashboard, 
  CheckSquare,
  Users,
  BarChart3,
  ArrowLeft,
  MoreVertical,
  Search,
  PlusCircle,
  Database,
  Moon,
  Sun,
  Edit3,
  TrendingUp,
  Target,
  Zap,
  Award,
  Activity,
  Filter,
  FolderOpen,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Project, Task, S1Case, Team } from './types';
import { exportReportPDF, exportReportDOCX } from './exportReport';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // S1 Analytics state
  const [activeView, setActiveView] = useState<'overview' | 'analytics' | 'reports' | 'teams'>('overview');
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [s1Cases, setS1Cases] = useState<S1Case[]>([]);
  const [s1Loading, setS1Loading] = useState(false);
  const [s1Error, setS1Error] = useState<string | null>(null);
  const [s1DateFrom, setS1DateFrom] = useState('');
  const [s1DateTo, setS1DateTo] = useState('');
  const [s1Campaigns, setS1Campaigns] = useState('');
  const [s1Pagination, setS1Pagination] = useState({ offset: 0, page_size: 100, total: 0 });
  const [addToProjectModalCase, setAddToProjectModalCase] = useState<S1Case | null>(null);
  const [addedCaseIds, setAddedCaseIds] = useState<Map<string, { projectId: number; taskId: number }>>(new Map());
  const [pendingCaseForProject, setPendingCaseForProject] = useState<S1Case | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [editingAssignee, setEditingAssignee] = useState<number | null>(null);

  // Function to map case_state_id to Spanish text
  const getCaseStateText = (case_state_id?: number): string => {
    if (!case_state_id) return 'Sin Estado';
    
    const stateMap: Record<number, string> = {
      1: 'En Cola',
      2: 'En curso',
      3: 'Pendiente',
      4: 'Esperando Respuesta',
      5: 'Resuelto'
    };
    
    return stateMap[case_state_id] || `Estado ${case_state_id}`;
  };

  // Function to get case state color based on state_id
  const getCaseStateColor = (case_state_id?: number): string => {
    if (!case_state_id) return 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800';
    
    switch (case_state_id) {
      case 1: // En Cola
        return 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 2: // En curso
        return 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 3: // Pendiente
        return 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 4: // Esperando Respuesta
        return 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 5: // Resuelto
        return 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800';
    }
  };

  // Teams state
  const [teams, setTeams] = useState<Team[]>([]);
  const [isNewTeamModalOpen, setIsNewTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isEditingProjectTeam, setIsEditingProjectTeam] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Alert and Confirmation system
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'info' });
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // S1 Analytics table filters
  const [s1Filters, setS1Filters] = useState<Record<string, string>>({
    group_name: '',
    assigned_to: '',
    classification: '',
    channel: '',
    quarter: '',
    case_status: '',
    task_status: '',
    subject: '',
  });

  const s1FilterOptions = useMemo(() => {
    const opts: Record<string, string[]> = { group_name: [], assigned_to: [], classification: [], channel: [], quarter: [], case_status: [], task_status: [] };
    const sets: Record<string, Set<string>> = {
      group_name: new Set(),
      assigned_to: new Set(),
      classification: new Set(),
      channel: new Set(),
      quarter: new Set(),
      case_status: new Set(),
      task_status: new Set(),
    };
    // Only include filter options from active cases (not resolved)
    for (const c of s1Cases.filter(c => !c.is_case_resolved)) {
      if (c.group_name) sets.group_name.add(c.group_name);
      if (c.assigned_to) sets.assigned_to.add(c.assigned_to);
      if (c.classification) sets.classification.add(c.classification);
      if (c.channel) sets.channel.add(c.channel);
      if (c.quarter) sets.quarter.add(c.quarter);
      if (c.case_state_id) sets.case_status.add(getCaseStateText(c.case_state_id));
      if (c.task_status) sets.task_status.add(c.task_status);
    }
    for (const key of Object.keys(sets)) {
      opts[key] = [...sets[key]].sort();
    }
    return opts;
  }, [s1Cases]);

  const filteredS1Cases = useMemo(() => {
    return s1Cases.filter(c => {
      // First filter out resolved/eliminated cases for display (but keep for sync)
      if (c.is_case_resolved) return false;
      
      // Then apply user filters
      if (s1Filters.group_name && (c.group_name || '') !== s1Filters.group_name) return false;
      if (s1Filters.assigned_to && (c.assigned_to || '') !== s1Filters.assigned_to) return false;
      if (s1Filters.classification && (c.classification || '') !== s1Filters.classification) return false;
      if (s1Filters.channel && (c.channel || '') !== s1Filters.channel) return false;
      if (s1Filters.quarter && (c.quarter || '') !== s1Filters.quarter) return false;
      if (s1Filters.case_status && getCaseStateText(c.case_state_id) !== s1Filters.case_status) return false;
      if (s1Filters.task_status && (c.task_status || '') !== s1Filters.task_status) return false;
      if (s1Filters.subject && !(c.subject || '').toLowerCase().includes(s1Filters.subject.toLowerCase())) return false;
      return true;
    });
  }, [s1Cases, s1Filters]);

  const activeFilterCount = Object.values(s1Filters).filter(v => v !== '').length;

  // Get team stats
  const teamStats = useMemo(() => {
    const stats: Record<string, { totalProjects: number; totalTasks: number; completedTasks: number; color: string }> = {};
    
    for (const project of projects) {
      const teamName = project.team || 'Unassigned';
      const team = teams.find(t => t.name === teamName);
      
      if (!stats[teamName]) {
        stats[teamName] = {
          totalProjects: 0,
          totalTasks: 0,
          completedTasks: 0,
          color: team?.color || '#64748b'
        };
      }
      
      stats[teamName].totalProjects++;
      stats[teamName].totalTasks += project.total_tasks;
      stats[teamName].completedTasks += project.completed_tasks;
    }
    
    return stats;
  }, [projects, teams]);

  const toggleTeamCollapse = (teamName: string) => {
    setCollapsedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamName)) {
        next.delete(teamName);
      } else {
        next.add(teamName);
      }
      return next;
    });
  };

  // Group projects by team
  const projectsByTeam = useMemo(() => {
    const grouped: Record<string, Project[]> = {};
    for (const project of projects) {
      const team = project.team || 'Unassigned';
      if (!grouped[team]) grouped[team] = [];
      grouped[team].push(project);
    }
    return grouped;
  }, [projects]);
  const filteredProjects = useMemo(() => {
    if (selectedTeamFilter === 'all') {
      return projects;
    }
    return projects.filter(project => {
      const projectTeam = project.team || 'Unassigned';
      return projectTeam === selectedTeamFilter;
    });
  }, [projects, selectedTeamFilter]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    fetchProjects();
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchTasks(selectedProject.id);
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async (projectId: number) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      setTeams(data);
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  };

  const createProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const team = formData.get('team') as string;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, team }),
      });
      if (res.ok) {
        const newProject = await res.json();
        setIsNewProjectModalOpen(false);
        await fetchProjects();
        if (pendingCaseForProject) {
          await addCaseAsTask(pendingCaseForProject, newProject.id);
          setPendingCaseForProject(null);
        }
      }
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  const createTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const color = formData.get('color') as string;

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color }),
      });
      if (res.ok) {
        setIsNewTeamModalOpen(false);
        await fetchTeams();
        // Reset form
        (e.target as HTMLFormElement).reset();
      }
    } catch (err) {
      console.error('Error creating team:', err);
    }
  };

  const deleteTeam = async (teamId: number) => {
    showConfirm(
      'Eliminar Equipo',
      '¿Estás seguro de que quieres eliminar este equipo? Esta acción no se puede deshacer.',
      async () => {
        try {
          const res = await fetch(`/api/teams/${teamId}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            await fetchTeams();
            await fetchProjects();
            showAlert('Éxito', 'El equipo ha sido eliminado correctamente.', 'success');
          } else {
            showAlert('Error', 'Error al eliminar el equipo. Inténtalo de nuevo.', 'error');
          }
        } catch (err) {
          console.error('Error deleting team:', err);
          showAlert('Error de Conexión', 'Error al eliminar el equipo. Verifica tu conexión.', 'error');
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      }
    );
  };

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  const showConfirm = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    options?: {
      onCancel?: () => void;
      confirmText?: string;
      cancelText?: string;
    }
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      onCancel: options?.onCancel,
      confirmText: options?.confirmText || 'Confirmar',
      cancelText: options?.cancelText || 'Cancelar'
    });
  };

  const updateProjectTeam = async (projectId: number, newTeam: string) => {
    const projectToUpdate = projects.find(p => p.id === projectId);
    if (!projectToUpdate) return;

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: projectToUpdate.name, 
          description: projectToUpdate.description, 
          team: newTeam 
        }),
      });
      if (res.ok) {
        await fetchProjects();
        // Update selectedProject if it's the one being updated
        if (selectedProject?.id === projectId) {
          setSelectedProject({ ...selectedProject, team: newTeam });
        }
        setIsEditingProjectTeam(false);
      } else {
        showAlert('Error', 'Error al actualizar el equipo del proyecto.', 'error');
      }
    } catch (err) {
      console.error('Error updating project team:', err);
      showAlert('Error de Conexión', 'Error al actualizar el equipo del proyecto.', 'error');
    }
  };

  const updateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTeam) return;
    
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const color = formData.get('color') as string;

    try {
      const res = await fetch(`/api/teams/${editingTeam.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color }),
      });
      if (res.ok) {
        setEditingTeam(null);
        await fetchTeams();
        await fetchProjects();
      } else {
        showAlert('Error', 'Error al actualizar el equipo.', 'error');
      }
    } catch (err) {
      console.error('Error updating team:', err);
      showAlert('Error de Conexión', 'Error al actualizar el equipo.', 'error');
    }
  };

  const createTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProject) return;

    const formData = new FormData(e.currentTarget);
    const taskData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      assignee: formData.get('assignee') as string,
      priority: formData.get('priority') as string,
      status: 'todo'
    };

    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      if (res.ok) {
        setIsNewTaskModalOpen(false);
        fetchTasks(selectedProject.id);
        fetchProjects(); // Update project stats
      }
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const updateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok && selectedProject) {
        fetchTasks(selectedProject.id);
        fetchProjects();
      }
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  const updateTaskAssignee = async (taskId: number, newAssignee: string) => {
    setEditingAssignee(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee: newAssignee }),
      });
      if (res.ok && selectedProject) {
        fetchTasks(selectedProject.id);
      }
    } catch (err) {
      console.error('Error updating task assignee:', err);
    }
  };

  const deleteTask = async (taskId: number) => {
    showConfirm(
      'Eliminar Tarea',
      '¿Estás seguro de que quieres eliminar esta tarea?',
      async () => {
        try {
          const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
          if (res.ok && selectedProject) {
            fetchTasks(selectedProject.id);
            fetchProjects();
            showAlert('Éxito', 'La tarea ha sido eliminada correctamente.', 'success');
          } else {
            showAlert('Error', 'Error al eliminar la tarea.', 'error');
          }
        } catch (err) {
          console.error('Error deleting task:', err);
          showAlert('Error de Conexión', 'Error al eliminar la tarea.', 'error');
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      }
    );
  };

  const deleteProject = async (projectId: number) => {
    showConfirm(
      'Eliminar Proyecto',
      '¿Estás seguro de que quieres eliminar este proyecto y todas sus tareas?',
      async () => {
        try {
          const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
          if (res.ok) {
            setSelectedProject(null);
            fetchProjects();
            showAlert('Éxito', 'El proyecto ha sido eliminado correctamente.', 'success');
          } else {
            showAlert('Error', 'Error al eliminar el proyecto.', 'error');
          }
        } catch (err) {
          console.error('Error deleting project:', err);
          showAlert('Error de Conexión', 'Error al eliminar el proyecto.', 'error');
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      }
    );
  };

  const exportToExcel = async () => {
    const workbook = XLSX.utils.book_new();
    const today = new Date().toISOString().slice(0, 10);

    // If on analytics view and there are cases, export S1 cases
    if (activeView === 'analytics' && s1Cases.length > 0) {
      const casesData = s1Cases.map(c => ({
        'Case ID': c.case_id,
        'Date': c.dt,
        'Subject': c.subject || '',
        'Channel': c.channel || '',
        'Group ID': c.group_id || '',
        'Group Name': c.group_name || '',
        'Assigned To': c.assigned_to || '',
        'Classification': c.classification || '',
        'Quarter': c.quarter || '',
        'Case Status': getCaseStateText(c.case_state_id),
        'Task ID': c.task_id || '',
        'Task Status': c.task_status || '',
        'Is Task Completed': c.is_task_completed ? 'Yes' : 'No',
        'Auto Completed': c.task_auto_completed ? 'Yes' : 'No',
        'Campaign': c.campaign_name || '',
        'User': c.user_name || '',
      }));
      const ws = XLSX.utils.json_to_sheet(casesData);
      ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 50 }, { wch: 14 }, { wch: 10 }, { wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, ws, 'S1 Cases');
      XLSX.writeFile(workbook, `S1_Analytics_Cases_${today}.xlsx`);
      return;
    }

    // Full report export
    try {
      const res = await fetch('/api/reports');
      const report = await res.json();

      // Sheet 1: Summary
      const summaryData = [
        ['S1 Projects Report', '', '', `Generated: ${new Date().toLocaleString()}`],
        [],
        ['Metric', 'Value'],
        ['Total Projects', report.summary.totalProjects],
        ['Total Tasks', report.summary.totalTasks],
        ['Completed Tasks', report.summary.doneTasks],
        ['In Progress Tasks', report.summary.inProgressTasks],
        ['To Do Tasks', report.summary.todoTasks],
        ['Completion Rate', `${report.summary.completionRate}%`],
        ['Avg Tasks per Project', report.summary.avgTasksPerProject],
        [],
        ['Priority', 'Count'],
        ['High', report.summary.highPriority],
        ['Medium', report.summary.mediumPriority],
        ['Low', report.summary.lowPriority],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 28 }];
      wsSummary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
      XLSX.utils.book_append_sheet(workbook, wsSummary, 'Summary');

      // Sheet 2: Projects
      const projectsData = report.projects.map((p: any) => ({
        'Project': p.name,
        'Description': p.description || '',
        'Total Tasks': p.total_tasks,
        'Done': p.completed_tasks,
        'In Progress': p.in_progress_tasks || 0,
        'To Do': p.todo_tasks || 0,
        'High Priority': p.high_priority || 0,
        'Medium Priority': p.medium_priority || 0,
        'Low Priority': p.low_priority || 0,
        'Progress (%)': p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0,
        'Created': new Date(p.created_at).toLocaleDateString(),
      }));
      const wsProjects = XLSX.utils.json_to_sheet(projectsData);
      wsProjects['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 13 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, wsProjects, 'Projects');

      // Sheet 3: All Tasks
      const tasksData = report.recentTasks.length > 0 ? report.recentTasks : [];
      // Fetch all tasks, not just recent 10
      const allTasksRes = await fetch('/api/reports');
      const allReport = await allTasksRes.json();
      // Use full tasks from all projects
      const fullTasks: any[] = [];
      for (const p of report.projects) {
        const tRes = await fetch(`/api/projects/${p.id}/tasks`);
        const tData = await tRes.json();
        tData.forEach((t: any) => fullTasks.push({ ...t, project_name: p.name }));
      }
      const tasksSheet = (fullTasks.length > 0 ? fullTasks : tasksData).map((t: any) => ({
        'Project': t.project_name || '',
        'Task': t.title,
        'Description': t.description || '',
        'Assignee': t.assignee || 'Unassigned',
        'Status': t.status,
        'Priority': t.priority,
        'Created': new Date(t.created_at).toLocaleDateString(),
      }));
      if (tasksSheet.length > 0) {
        const wsTasks = XLSX.utils.json_to_sheet(tasksSheet);
        wsTasks['!cols'] = [{ wch: 28 }, { wch: 50 }, { wch: 45 }, { wch: 25 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(workbook, wsTasks, 'Tasks');
      }

      // Sheet 4: Workload by Assignee
      if (report.assigneeStats.length > 0) {
        const assigneeData = report.assigneeStats.map((a: any) => ({
          'Assignee': a.assignee,
          'Total Tasks': a.total,
          'Done': a.done,
          'In Progress': a.in_progress,
          'To Do': a.todo,
          'Completion (%)': a.total > 0 ? Math.round((a.done / a.total) * 100) : 0,
        }));
        const wsAssignee = XLSX.utils.json_to_sheet(assigneeData);
        wsAssignee['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, wsAssignee, 'Workload');
      }

      XLSX.writeFile(workbook, `S1_Projects_Report_${today}.xlsx`);
    } catch (err) {
      console.error('Error exporting report:', err);
    }
  };

  const fetchS1Cases = async (offset = 0) => {
    if (!s1DateFrom) return;
    console.log(`Debug Frontend: Fetching S1 cases with date_from: ${s1DateFrom}, date_to: ${s1DateTo || 'not set'}, offset: ${offset}`);
    setS1Loading(true);
    setS1Error(null);
    if (offset === 0) setS1Filters({ group_name: '', assigned_to: '', classification: '', channel: '', quarter: '', case_status: '', task_status: '', subject: '' });
    try {
      const params = new URLSearchParams({ 
        date_from: `${s1DateFrom} 00:00:00`, 
        page_size: '100', 
        offset: String(offset),
        campaigns: s1Campaigns || '8322880'  // Always include campaigns for group_cat API
      });
      if (s1DateTo) params.append('date_to', `${s1DateTo} 23:59:59`);
      console.log(`Debug Frontend: API params: ${params.toString()}`);
      const res = await fetch(`/api/s1-analytics/report?${params.toString()}`);
      console.log('Debug Frontend: Response status:', res.status);
      const data = await res.json();
      if (data.success) {
        const cases: S1Case[] = data.data || [];
        console.log(`Debug Frontend: Received ${cases.length} cases from API`);
        if (cases.length > 0) {
          console.log(`Debug Frontend: First case sample:`, cases[0]);
        }
        setS1Cases(cases);
        setS1Pagination({ offset, page_size: data.pagination?.page_size || 100, total: data.pagination?.total || 0 });
        // Detect cases already added as tasks
        if (cases.length > 0) {
          const caseIds = cases.map(c => c.case_id);
          try {
            const findRes = await fetch('/api/tasks/find-by-cases', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ case_ids: caseIds }),
            });
            if (findRes.ok) {
              const found: { case_id: string; task_id: number; project_id: number }[] = await findRes.json();
              if (found.length > 0) {
                setAddedCaseIds(prev => {
                  const next = new Map(prev);
                  for (const f of found) {
                    next.set(f.case_id, { projectId: f.project_id, taskId: f.task_id });
                  }
                  return next;
                });
              }
            }
          } catch (e) {
            console.error('Error detecting existing cases:', e);
          }
        }
      } else {
        setS1Error(data.result_message || data.error || 'Error fetching cases');
        setS1Cases([]);
      }
    } catch (err) {
      setS1Error('Connection error with S1 Analytics');
      setS1Cases([]);
    } finally {
      setS1Loading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const res = await fetch('/api/reports');
      const report = await res.json();
      exportReportPDF(report, s1Cases);
    } catch (err) {
      showAlert('Error de Exportación', 'Error al exportar el PDF. Inténtalo de nuevo.', 'error');
    }
  };

  const handleExportDOCX = async () => {
    try {
      const res = await fetch('/api/reports');
      const report = await res.json();
      await exportReportDOCX(report, s1Cases);
    } catch (err) {
      showAlert('Error de Exportación', 'Error al exportar el DOCX. Inténtalo de nuevo.', 'error');
    }
  };

  const addCaseAsTask = async (s1Case: S1Case, projectId: number) => {
    try {
      const existing = addedCaseIds.get(s1Case.case_id);

      // If already assigned to the same project, just close the modal
      if (existing && existing.projectId === projectId) {
        setAddToProjectModalCase(null);
        return;
      }

      // If reassigning to a different project, move the task
      if (existing) {
        const res = await fetch(`/api/tasks/${existing.taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId }),
        });
        if (res.ok) {
          setAddedCaseIds(prev => {
            const next = new Map(prev);
            next.set(s1Case.case_id, { projectId, taskId: existing.taskId });
            return next;
          });
          setAddToProjectModalCase(null);
          fetchProjects();
          if (selectedProject?.id === projectId || selectedProject?.id === existing.projectId) {
            fetchTasks(selectedProject!.id);
          }
        }
        return;
      }

      // New task
      const taskData = {
        title: `[Case #${s1Case.case_id}] ${s1Case.subject || 'S1 Analytics Case'}`,
        description: `Group: ${s1Case.group_name || s1Case.group_id || 'N/A'} | Assigned To: ${s1Case.assigned_to || 'N/A'} | Classification: ${s1Case.classification || 'N/A'} | Channel: ${s1Case.channel || 'N/A'} | Date: ${s1Case.dt || 'N/A'}`,
        assignee: s1Case.user_name || '',
        priority: 'medium',
        status: 'todo'
      };
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      if (res.ok) {
        const newTask = await res.json();
        setAddedCaseIds(prev => {
          const next = new Map(prev);
          next.set(s1Case.case_id, { projectId, taskId: newTask.id });
          return next;
        });
        setAddToProjectModalCase(null);
        fetchProjects();
        if (selectedProject?.id === projectId) {
          fetchTasks(projectId);
        }
      }
    } catch (err) {
      console.error('Error adding case as task:', err);
    }
  };

  const getChannelBadge = (channel: string) => {
    const ch = (channel || '').toLowerCase();
    if (ch.includes('whatsapp')) return 'bg-green-50 text-green-700 border-green-200';
    if (ch.includes('facebook') || ch.includes('messenger')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (ch.includes('webchat') || ch.includes('chat')) return 'bg-violet-50 text-violet-700 border-violet-200';
    if (ch.includes('email') || ch.includes('mail')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (ch.includes('sms')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    if (ch.includes('twitter') || ch.includes('x')) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (ch.includes('instagram')) return 'bg-pink-50 text-pink-700 border-pink-200';
    return 'bg-indigo-50 text-indigo-600 border-indigo-200';
  };

  const fetchReports = async () => {
    setReportLoading(true);
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'reports') fetchReports();
  }, [activeView]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 border-rose-100 dark:border-rose-800';
      case 'medium': return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-800';
      case 'low': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-800';
      default: return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'in-progress': return <Clock className="w-4 h-4 text-sky-500" />;
      default: return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading S1 Projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-72'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 relative`}>
        {/* Header */}
        <div className={`${sidebarCollapsed ? 'p-2' : 'p-6'} border-b border-slate-100 dark:border-slate-800 flex items-center justify-between`}>
          <div className={`flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xl transition-opacity ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            <img src="/s1_logo.png" alt="S1 Logo" className="w-6 h-6 object-contain" />
            <span>S1 Projects</span>
          </div>
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${sidebarCollapsed ? 'p-3 mx-auto' : 'p-1'} rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0`}
            title={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronLeft className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
        
        <nav className={`flex-1 ${sidebarCollapsed ? 'p-2' : 'p-4'} space-y-2 overflow-y-auto`}>
          {/* Main Navigation */}
          <div className="space-y-1">
            <button 
              onClick={() => { setSelectedProject(null); setActiveView('overview'); }}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'} rounded-xl text-sm font-medium transition-all duration-200 ${!selectedProject && activeView === 'overview' ? 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title={sidebarCollapsed ? 'Overview' : ''}
            >
              <BarChart3 className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Overview</span>}
            </button>
            <button 
              onClick={() => { setSelectedProject(null); setActiveView('reports'); }}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'} rounded-xl text-sm font-medium transition-all duration-200 ${!selectedProject && activeView === 'reports' ? 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title={sidebarCollapsed ? 'Reports' : ''}
            >
              <TrendingUp className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Reports</span>}
            </button>
            <button 
              onClick={() => { setSelectedProject(null); setActiveView('analytics'); }}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'} rounded-xl text-sm font-medium transition-all duration-200 ${!selectedProject && activeView === 'analytics' ? 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title={sidebarCollapsed ? 'S1 Analytics' : ''}
            >
              <Database className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>S1 Analytics</span>}
            </button>
            <button 
              onClick={() => { setSelectedProject(null); setActiveView('teams'); }}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'} rounded-xl text-sm font-medium transition-all duration-200 ${!selectedProject && activeView === 'teams' ? 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title={sidebarCollapsed ? 'Teams' : ''}
            >
              <Users className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Teams</span>}
            </button>
          </div>

          {/* Teams Section */}
          {!sidebarCollapsed && (
            <>
              <div className="pt-6 pb-2">
                <h3 className="px-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Teams & Projects
                </h3>
              </div>
              
              <div className="space-y-1">
                {Object.entries(projectsByTeam).map(([teamName, teamProjects]) => {
                  const typedTeamProjects = teamProjects as Project[];
                  const stats = teamStats[teamName] || { totalProjects: 0, totalTasks: 0, completedTasks: 0, color: '#64748b' };
                  const isCollapsed = collapsedTeams.has(teamName);
                  const completionRate = stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0;
                  
                  return (
                    <div key={teamName} className="space-y-1">
                      {/* Team Header */}
                      <button
                        onClick={() => toggleTeamCollapse(teamName)}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" 
                              style={{ backgroundColor: stats.color }}
                            />
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate">
                                {teamName}
                              </span>
                              <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                                {stats.totalProjects}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                <div 
                                  className="h-1.5 rounded-full transition-all duration-300" 
                                  style={{ 
                                    width: `${completionRate}%`, 
                                    backgroundColor: stats.color 
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {Math.round(completionRate)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                      
                      {/* Team Projects */}
                      {!isCollapsed && (
                        <div className="ml-6 space-y-0.5 border-l border-slate-200 dark:border-slate-700">
                          {typedTeamProjects.map(project => {
                            const progressWidth = project.total_tasks > 0 ? (project.completed_tasks / project.total_tasks) * 100 : 0;
                            return (
                              <button
                                key={project.id}
                                onClick={() => { setSelectedProject(project); setActiveView('overview'); }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ml-4 mr-2 relative group ${
                                  selectedProject?.id === project.id 
                                    ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 shadow-sm border border-sky-200 dark:border-sky-800' 
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium truncate">{project.name}</span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">
                                      {project.completed_tasks}/{project.total_tasks}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1">
                                      <div 
                                        className="h-1 rounded-full transition-all duration-300" 
                                        style={{ 
                                          width: `${progressWidth}%`, 
                                          backgroundColor: stats.color 
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-all duration-200 opacity-0 group-hover:opacity-100 ${selectedProject?.id === project.id ? 'rotate-90 opacity-100' : ''}`} />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <button 
                onClick={() => setIsNewProjectModalOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950 transition-all duration-200 mt-4 border-2 border-dashed border-sky-200 dark:border-sky-800 hover:border-sky-300 dark:hover:border-sky-700"
              >
                <Plus className="w-5 h-5" />
                <span>New Project</span>
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={exportToExcel}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-sm font-normal hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Export XLSX
          </button>
          <button 
            onClick={handleExportPDF}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-sm font-normal hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 mt-2"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          <button 
            onClick={handleExportDOCX}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-sm font-normal hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 mt-2"
          >
            <Download className="w-4 h-4" />
            Export DOCX
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {selectedProject && (
              <button 
                onClick={() => setSelectedProject(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {selectedProject ? selectedProject.name : activeView === 'analytics' ? 'S1 Analytics - Cases Report' : activeView === 'reports' ? 'Project Reports & Statistics' : activeView === 'teams' ? 'Team Management' : 'Dashboard Overview'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          {!selectedProject && activeView === 'analytics' ? (
            /* S1 Analytics View */
            <div className="space-y-6">
              {/* Search Filters */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Cases Report — S1 Analytics</h2>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date From *</label>
                    <input 
                      type="date" 
                      value={s1DateFrom}
                      onChange={e => setS1DateFrom(e.target.value)}
                      className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date To</label>
                    <input 
                      type="date" 
                      value={s1DateTo}
                      onChange={e => setS1DateTo(e.target.value)}
                      className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Campaign ID</label>
                    <input 
                      type="text" 
                      value={s1Campaigns}
                      onChange={e => setS1Campaigns(e.target.value)}
                      placeholder="e.g. 10000"
                      className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 w-36"
                    />
                  </div>
                  <button
                    onClick={() => fetchS1Cases(0)}
                    disabled={!s1DateFrom || s1Loading}
                    className="flex items-center gap-2 px-6 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Search className="w-4 h-4" />
                    {s1Loading ? 'Searching...' : 'Search Cases'}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {s1Error && (
                <div className="bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm">
                  {s1Error}
                </div>
              )}

              {/* Results Table */}
              {s1Cases.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="font-semibold text-slate-800 dark:text-slate-100">Cases Found</h2>
                      <span className="px-2.5 py-0.5 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 rounded-full text-xs font-bold">{s1Pagination.total}</span>
                      {addedCaseIds.size > 0 && (
                        <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-bold">{addedCaseIds.size} added</span>
                      )}
                      {activeFilterCount > 0 && (
                        <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full text-xs font-bold">
                          {filteredS1Cases.length} of {s1Cases.filter(c => !c.is_case_resolved).length} active cases
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {activeFilterCount > 0 && (
                        <button
                          onClick={() => setS1Filters({ group_name: '', assigned_to: '', classification: '', channel: '', quarter: '', case_status: '', task_status: '', subject: '' })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
                        >
                          <X className="w-3 h-3" />
                          Clear filters
                        </button>
                      )}
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                        {s1Pagination.offset + 1}–{Math.min(s1Pagination.offset + s1Cases.length, s1Pagination.total)} of {s1Pagination.total}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-700">
                          <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Case ID</th>
                          <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Subject</th>
                          <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Group</th>
                          <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Assigned To</th>
                          <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Classification</th>
                          <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Quarter</th>
                          <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Case Status</th>
                          <th className="text-left px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Task Status</th>
                          <th className="text-center px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Action</th>
                        </tr>
                        <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                          <td className="px-5 py-2"></td>
                          <td className="px-5 py-2">
                            <input
                              type="text"
                              value={s1Filters.subject}
                              onChange={e => setS1Filters(prev => ({ ...prev, subject: e.target.value }))}
                              placeholder="Filter subject..."
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-sky-500 dark:text-slate-200 placeholder:text-slate-400"
                            />
                          </td>
                          <td className="px-5 py-2">
                            <select
                              value={s1Filters.group_name}
                              onChange={e => setS1Filters(prev => ({ ...prev, group_name: e.target.value }))}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-sky-500 dark:text-slate-200 appearance-none cursor-pointer"
                            >
                              <option value="">All</option>
                              {s1FilterOptions.group_name.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-2">
                            <select
                              value={s1Filters.assigned_to}
                              onChange={e => setS1Filters(prev => ({ ...prev, assigned_to: e.target.value }))}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-sky-500 dark:text-slate-200 appearance-none cursor-pointer"
                            >
                              <option value="">All</option>
                              {s1FilterOptions.assigned_to.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-2">
                            <select
                              value={s1Filters.classification}
                              onChange={e => setS1Filters(prev => ({ ...prev, classification: e.target.value }))}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-sky-500 dark:text-slate-200 appearance-none cursor-pointer"
                            >
                              <option value="">All</option>
                              {s1FilterOptions.classification.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-2">
                            <select
                              value={s1Filters.quarter}
                              onChange={e => setS1Filters(prev => ({ ...prev, quarter: e.target.value }))}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-sky-500 dark:text-slate-200 appearance-none cursor-pointer"
                            >
                              <option value="">All</option>
                              {s1FilterOptions.quarter.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-2">
                            <select
                              value={s1Filters.case_status}
                              onChange={e => setS1Filters(prev => ({ ...prev, case_status: e.target.value }))}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-sky-500 dark:text-slate-200 appearance-none cursor-pointer"
                            >
                              <option value="">All</option>
                              {s1FilterOptions.case_status.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-2">
                            <select
                              value={s1Filters.task_status}
                              onChange={e => setS1Filters(prev => ({ ...prev, task_status: e.target.value }))}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-sky-500 dark:text-slate-200 appearance-none cursor-pointer"
                            >
                              <option value="">All</option>
                              {s1FilterOptions.task_status.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-2"></td>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredS1Cases.map((c, idx) => {
                          const isAdded = addedCaseIds.has(c.case_id);
                          return (
                            <tr 
                              key={c.case_id} 
                              className={`border-b border-slate-50 dark:border-slate-800 transition-colors ${
                                isAdded 
                                  ? 'bg-emerald-50/40 dark:bg-emerald-950/40' 
                                  : idx % 2 === 0 ? 'bg-white dark:bg-slate-900 hover:bg-sky-50/50 dark:hover:bg-sky-950/30' : 'bg-slate-50/30 dark:bg-slate-800/30 hover:bg-sky-50/50 dark:hover:bg-sky-950/30'
                              }`}
                            >
                              <td className="px-5 py-3.5">
                                <span className={`font-mono text-xs font-bold px-2 py-1 rounded ${isAdded ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' : 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300'}`}>
                                  #{c.case_id}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-slate-800 dark:text-slate-200 font-medium">{c.subject || '-'}</td>
                              <td className="px-5 py-3.5">
                                <div>
                                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{c.group_name || '-'}</span>
                                  {c.group_id && (
                                    <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono">ID: {c.group_id}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="text-xs text-slate-700 dark:text-slate-300">{c.assigned_to || '-'}</span>
                              </td>
                              <td className="px-5 py-3.5">
                                {c.classification ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800">
                                    {c.classification}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5">
                                {c.quarter ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                                    {c.quarter}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                                  getCaseStateColor(c.case_state_id)
                                }`}>
                                  {getCaseStateText(c.case_state_id)}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                {c.task_id ? (
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                                      c.task_status === 'done' 
                                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                        : c.task_status === 'in-progress'
                                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                        : 'bg-gray-50 dark:bg-gray-950 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800'
                                    }`}>
                                      {c.task_status === 'done' ? '✓ Done' : c.task_status === 'in-progress' ? '⏳ In Progress' : '📝 To Do'}
                                    </span>
                                    {c.task_auto_completed && (
                                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium" title="Task automatically marked as completed due to resolved case">
                                        Auto-completed
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">No task</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                {isAdded ? (
                                  <button
                                    onClick={() => setAddToProjectModalCase(c)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-800 active:scale-95 transition-all cursor-pointer"
                                    title="Click to reassign to another project"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Added
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setAddToProjectModalCase(c)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-700 active:scale-95 transition-all shadow-sm"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5" />
                                    Add as Task
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {s1Pagination.total > s1Pagination.page_size && (
                    <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                      <button
                        disabled={s1Pagination.offset === 0}
                        onClick={() => fetchS1Cases(Math.max(0, s1Pagination.offset - s1Pagination.page_size))}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-sky-950 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Page {Math.floor(s1Pagination.offset / s1Pagination.page_size) + 1} of {Math.ceil(s1Pagination.total / s1Pagination.page_size)}
                      </span>
                      <button
                        disabled={s1Pagination.offset + s1Pagination.page_size >= s1Pagination.total}
                        onClick={() => fetchS1Cases(s1Pagination.offset + s1Pagination.page_size)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-sky-950 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {!s1Loading && s1Cases.length === 0 && !s1Error && s1DateFrom && (
                <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 text-center">
                  <Database className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No cases found for the selected date range.</p>
                </div>
              )}
            </div>
          ) : !selectedProject && activeView === 'reports' ? (
            /* Reports View */
            <div className="space-y-6">
              {reportLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : reportData ? (
                <>
                  {/* Summary KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-lg">
                          <LayoutDashboard className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Projects</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{reportData.summary.totalProjects}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 rounded-lg">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Tasks</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{reportData.summary.totalTasks}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                          <Target className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Completion</span>
                      </div>
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{reportData.summary.completionRate}%</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
                          <Zap className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">In Progress</span>
                      </div>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{reportData.summary.inProgressTasks}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-lg">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">High Priority</span>
                      </div>
                      <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{reportData.summary.highPriority}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Task Status Distribution */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-sky-500" />
                        Task Status Distribution
                      </h3>
                      {reportData.summary.totalTasks > 0 ? (
                        <div className="space-y-4">
                          {/* Visual donut-style ring */}
                          <div className="flex items-center justify-center mb-2">
                            <div className="relative w-36 h-36">
                              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="3" />
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-emerald-500"
                                  strokeWidth="3" strokeDasharray={`${(reportData.summary.doneTasks / reportData.summary.totalTasks) * 97.4} 97.4`} strokeLinecap="round" />
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-sky-500"
                                  strokeWidth="3" strokeDasharray={`${(reportData.summary.inProgressTasks / reportData.summary.totalTasks) * 97.4} 97.4`}
                                  strokeDashoffset={`-${(reportData.summary.doneTasks / reportData.summary.totalTasks) * 97.4}`} strokeLinecap="round" />
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-slate-400 dark:text-slate-500"
                                  strokeWidth="3" strokeDasharray={`${(reportData.summary.todoTasks / reportData.summary.totalTasks) * 97.4} 97.4`}
                                  strokeDashoffset={`-${((reportData.summary.doneTasks + reportData.summary.inProgressTasks) / reportData.summary.totalTasks) * 97.4}`} strokeLinecap="round" />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{reportData.summary.completionRate}%</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">completed</span>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-xl py-2.5 px-2">
                              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{reportData.summary.doneTasks}</div>
                              <div className="text-[10px] font-medium text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider">Done</div>
                            </div>
                            <div className="bg-sky-50 dark:bg-sky-950/50 rounded-xl py-2.5 px-2">
                              <div className="text-lg font-bold text-sky-600 dark:text-sky-400">{reportData.summary.inProgressTasks}</div>
                              <div className="text-[10px] font-medium text-sky-600/70 dark:text-sky-400/70 uppercase tracking-wider">In Progress</div>
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl py-2.5 px-2">
                              <div className="text-lg font-bold text-slate-600 dark:text-slate-300">{reportData.summary.todoTasks}</div>
                              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">To Do</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No tasks yet</p>
                      )}
                    </div>

                    {/* Priority Breakdown */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Priority Breakdown
                      </h3>
                      {reportData.summary.totalTasks > 0 ? (
                        <div className="space-y-4">
                          {[
                            { label: 'High', count: reportData.summary.highPriority, color: 'bg-rose-500', bg: 'bg-rose-100 dark:bg-rose-950', text: 'text-rose-700 dark:text-rose-300' },
                            { label: 'Medium', count: reportData.summary.mediumPriority, color: 'bg-amber-500', bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300' },
                            { label: 'Low', count: reportData.summary.lowPriority, color: 'bg-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300' },
                          ].map(p => (
                            <div key={p.label}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.bg} ${p.text}`}>
                                    {p.count}
                                  </span>
                                  <span className="text-xs text-slate-400 dark:text-slate-500 w-10 text-right">
                                    {reportData.summary.totalTasks > 0 ? Math.round((p.count / reportData.summary.totalTasks) * 100) : 0}%
                                  </span>
                                </div>
                              </div>
                              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${reportData.summary.totalTasks > 0 ? (p.count / reportData.summary.totalTasks) * 100 : 0}%` }}
                                  transition={{ duration: 0.6, ease: 'easeOut' }}
                                  className={`h-full rounded-full ${p.color}`}
                                />
                              </div>
                            </div>
                          ))}
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400">Avg per project</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">{reportData.summary.avgTasksPerProject} tasks</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No tasks yet</p>
                      )}
                    </div>
                  </div>

                  {/* Workload by Assignee */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                      <Users className="w-4 h-4 text-violet-500" />
                      Workload by Assignee
                    </h3>
                    {reportData.assigneeStats.length > 0 ? (
                      <div className="space-y-3">
                        {reportData.assigneeStats.map((a: any) => {
                          const maxTotal = Math.max(...reportData.assigneeStats.map((s: any) => s.total));
                          return (
                            <div key={a.assignee} className="flex items-center gap-4">
                              <div className="w-28 shrink-0">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate block">{a.assignee}</span>
                              </div>
                              <div className="flex-1 flex h-7 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${maxTotal > 0 ? (a.done / maxTotal) * 100 : 0}%` }}
                                  transition={{ duration: 0.5, ease: 'easeOut' }}
                                  className="bg-emerald-500 h-full flex items-center justify-center"
                                  title={`Done: ${a.done}`}
                                >
                                  {a.done > 0 && <span className="text-[10px] font-bold text-white">{a.done}</span>}
                                </motion.div>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${maxTotal > 0 ? (a.in_progress / maxTotal) * 100 : 0}%` }}
                                  transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                                  className="bg-sky-500 h-full flex items-center justify-center"
                                  title={`In Progress: ${a.in_progress}`}
                                >
                                  {a.in_progress > 0 && <span className="text-[10px] font-bold text-white">{a.in_progress}</span>}
                                </motion.div>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${maxTotal > 0 ? (a.todo / maxTotal) * 100 : 0}%` }}
                                  transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
                                  className="bg-slate-400 dark:bg-slate-500 h-full flex items-center justify-center"
                                  title={`Todo: ${a.todo}`}
                                >
                                  {a.todo > 0 && <span className="text-[10px] font-bold text-white">{a.todo}</span>}
                                </motion.div>
                              </div>
                              <div className="w-14 shrink-0 text-right">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{a.total}</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500"> tasks</span>
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Done</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> In Progress</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" /> To Do</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No tasks assigned yet</p>
                    )}
                  </div>

                  {/* Project Ranking */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">Project Progress Ranking</h3>
                    </div>
                    {reportData.projects.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                            <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">#</th>
                            <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Project</th>
                            <th className="text-center px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Tasks</th>
                            <th className="text-center px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Done</th>
                            <th className="text-center px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">In Progress</th>
                            <th className="text-center px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">To Do</th>
                            <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider w-52">Progress</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...reportData.projects]
                            .sort((a: any, b: any) => {
                              const pctA = a.total_tasks > 0 ? a.completed_tasks / a.total_tasks : 0;
                              const pctB = b.total_tasks > 0 ? b.completed_tasks / b.total_tasks : 0;
                              return pctB - pctA;
                            })
                            .map((p: any, idx: number) => {
                              const pct = p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0;
                              return (
                                <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="px-6 py-3.5">
                                    <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-[10px] font-bold ${idx === 0 ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' : idx === 1 ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : idx === 2 ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                      {idx + 1}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-slate-200">{p.name}</td>
                                  <td className="px-6 py-3.5 text-center text-slate-600 dark:text-slate-300 font-medium">{p.total_tasks}</td>
                                  <td className="px-6 py-3.5 text-center"><span className="text-emerald-600 dark:text-emerald-400 font-medium">{p.completed_tasks}</span></td>
                                  <td className="px-6 py-3.5 text-center"><span className="text-sky-600 dark:text-sky-400 font-medium">{p.in_progress_tasks || 0}</span></td>
                                  <td className="px-6 py-3.5 text-center"><span className="text-slate-500 dark:text-slate-400 font-medium">{p.todo_tasks || 0}</span></td>
                                  <td className="px-6 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${pct}%` }}
                                          transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.05 }}
                                          className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-sky-500' : 'bg-amber-500'}`}
                                        />
                                      </div>
                                      <span className={`text-xs font-bold w-10 text-right ${pct === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {pct}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-12 text-center">
                        <p className="text-sm text-slate-400 dark:text-slate-500">No projects yet</p>
                      </div>
                    )}
                  </div>

                  {/* Recent Tasks */}
                  {reportData.recentTasks.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-sky-500" />
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Recent Tasks</h3>
                      </div>
                      <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {reportData.recentTasks.map((t: any) => (
                          <div key={t.id} className="px-6 py-3 flex items-center gap-4">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'done' ? 'bg-emerald-500' : t.status === 'in-progress' ? 'bg-sky-500' : 'bg-slate-400'}`} />
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-medium ${t.status === 'done' ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                {t.title}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{t.project_name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{t.assignee || 'Unassigned'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 text-center">
                  <TrendingUp className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No report data available.</p>
                </div>
              )}
            </div>
          ) : !selectedProject && activeView === 'teams' ? (
            /* Teams Management View */
            <div className="space-y-6">
              {/* Teams Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Team Management</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Organize projects by teams and manage team members</p>
                </div>
                <button 
                  onClick={() => setIsNewTeamModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Team
                </button>
              </div>

              {/* Teams Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map(team => {
                  const teamProjects = projects.filter(p => p.team === team.name);
                  return (
                    <motion.div 
                      key={team.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div 
                              className={`w-4 h-4 rounded-full`}
                              style={{ backgroundColor: team.color }}
                            ></div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{team.name}</h3>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{team.description}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setEditingTeam(team)}
                            className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950 rounded-lg transition-colors"
                            title="Editar equipo"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteTeam(team.id)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
                            title="Eliminar equipo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Projects</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{teamProjects.length}</span>
                        </div>
                        
                        {teamProjects.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Recent Projects</h4>
                            {teamProjects.slice(0, 3).map(project => (
                              <button
                                key={project.id}
                                onClick={() => { setSelectedProject(project); setActiveView('overview'); }}
                                className="w-full text-left p-2 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              >
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{project.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{project.tasks?.length || 0} tasks</div>
                              </button>
                            ))}
                            {teamProjects.length > 3 && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-1">
                                +{teamProjects.length - 3} more projects
                              </div>
                            )}
                          </div>
                        )}
                        
                        {teamProjects.length === 0 && (
                          <div className="text-center py-4 text-slate-400 dark:text-slate-500 text-sm">
                            No projects yet
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                
                {teams.length === 0 && (
                  <div className="col-span-full bg-white dark:bg-slate-900 p-12 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 text-center">
                    <Users className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No teams yet</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">Create your first team to organize projects</p>
                    <button 
                      onClick={() => setIsNewTeamModalOpen(true)}
                      className="px-4 py-2 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition-colors"
                    >
                      Create Team
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : !selectedProject ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-lg">
                      <LayoutDashboard className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{projects.length}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Total Projects</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {projects.reduce((acc, p) => acc + p.completed_tasks, 0)}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Tasks Completed</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {projects.reduce((acc, p) => acc + (p.total_tasks - p.completed_tasks), 0)}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Active Tasks</div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-slate-800 dark:text-slate-100">Projects</h2>
                    <button 
                      onClick={() => setIsNewProjectModalOpen(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      New Project
                    </button>
                  </div>
                  
                  {/* Team Filter */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Filtrar por equipo:</label>
                    <select 
                      value={selectedTeamFilter}
                      onChange={(e) => setSelectedTeamFilter(e.target.value)}
                      className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:text-slate-200 min-w-[180px]"
                    >
                      <option value="all">Todos los equipos ({projects.length})</option>
                      {teams.map(team => {
                        const teamProjectsCount = projects.filter(p => p.team === team.name).length;
                        return (
                          <option key={team.id} value={team.name}>
                            {team.name} ({teamProjectsCount})
                          </option>
                        );
                      })}
                      {projects.some(p => !p.team) && (
                        <option value="Unassigned">
                          Sin equipo ({projects.filter(p => !p.team).length})
                        </option>
                      )}
                    </select>
                    
                    {selectedTeamFilter !== 'all' && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: teams.find(t => t.name === selectedTeamFilter)?.color || '#6B7280' }}
                        ></div>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Mostrando: {selectedTeamFilter}
                        </span>
                        <button 
                          onClick={() => setSelectedTeamFilter('all')}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          title="Ver todos"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProjects.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LayoutDashboard className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">
                        {selectedTeamFilter === 'all' 
                          ? 'No hay proyectos. ¡Crea el primero!' 
                          : `No hay proyectos en el equipo ${selectedTeamFilter}`
                        }
                      </p>
                    </div>
                  ) : (
                    filteredProjects.map(project => (
                      <div 
                        key={project.id} 
                        className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        onClick={() => setSelectedProject(project)}
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-slate-800 dark:text-slate-100 truncate">{project.name}</h3>
                            {project.team && (
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md flex-shrink-0">
                                <div 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: teams.find(t => t.name === project.team)?.color || '#6B7280' }}
                                ></div>
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{project.team}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{project.description}</p>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="w-48">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-slate-500 dark:text-slate-400">Progress</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {project.total_tasks > 0 ? Math.round((project.completed_tasks / project.total_tasks) * 100) : 0}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${project.total_tasks > 0 ? (project.completed_tasks / project.total_tasks) * 100 : 0}%` }}
                                className="h-full bg-sky-500 rounded-full"
                              />
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{project.completed_tasks}/{project.total_tasks}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500">Tasks</div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedProject.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-slate-500 dark:text-slate-400">{selectedProject.description}</p>
                    {selectedProject.team && (
                      <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: teams.find(t => t.name === selectedProject.team)?.color || '#6B7280' }}
                        ></div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{selectedProject.team}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!isEditingProjectTeam ? (
                    <button 
                      onClick={() => setIsEditingProjectTeam(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      title="Cambiar equipo"
                    >
                      <Users className="w-4 h-4" />
                      Cambiar Equipo
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select 
                        defaultValue={selectedProject.team || ''}
                        onChange={(e) => updateProjectTeam(selectedProject.id, e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:text-slate-200"
                      >
                        <option value="">Sin equipo</option>
                        {teams.map(team => (
                          <option key={team.id} value={team.name}>{team.name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => setIsEditingProjectTeam(false)}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        title="Cancelar"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={() => setIsNewTaskModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Task
                  </button>
                  <button 
                    onClick={() => deleteProject(selectedProject.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Task List */}
              <div className="grid grid-cols-1 gap-4">
                <AnimatePresence mode="popLayout">
                  {tasks.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 text-center"
                    >
                      <CheckSquare className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                      <p className="text-slate-500 dark:text-slate-400">No tasks in this project yet.</p>
                      <button 
                        onClick={() => setIsNewTaskModalOpen(true)}
                        className="mt-4 text-sky-600 font-medium hover:underline"
                      >
                        Create your first task
                      </button>
                    </motion.div>
                  ) : (
                    tasks.map(task => (
                      <motion.div
                        layout
                        key={task.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 group"
                      >
                        <button 
                          onClick={() => updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                          className={`p-1 rounded-full transition-colors ${task.status === 'done' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950' : 'text-slate-300 dark:text-slate-600 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950'}`}
                        >
                          <CheckCircle2 className="w-6 h-6" />
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-medium truncate ${task.status === 'done' ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                              {task.title}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {editingAssignee === task.id ? (
                                <input
                                  autoFocus
                                  defaultValue={task.assignee || ''}
                                  placeholder="Type a name..."
                                  className="bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-600 rounded px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-sky-500 w-32 text-slate-800 dark:text-slate-200"
                                  onBlur={(e) => updateTaskAssignee(task.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') updateTaskAssignee(task.id, (e.target as HTMLInputElement).value);
                                    if (e.key === 'Escape') setEditingAssignee(null);
                                  }}
                                />
                              ) : (
                                <button
                                  onClick={() => setEditingAssignee(task.id)}
                                  className="hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors cursor-pointer"
                                >
                                  {task.assignee || 'Unassigned'}
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1 capitalize">
                              {getStatusIcon(task.status)}
                              {task.status.replace('-', ' ')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <select 
                            value={task.status}
                            onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-sky-500 dark:text-slate-300"
                          >
                            <option value="todo">Todo</option>
                            <option value="in-progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                          <button 
                            onClick={() => deleteTask(task.id)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* New Project Modal */}
      <AnimatePresence>
        {isNewProjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewProjectModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Create New Project</h3>
              </div>
              <form onSubmit={createProject} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project Name</label>
                  <input 
                    name="name" 
                    required 
                    autoFocus
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 dark:placeholder-slate-400"
                    placeholder="e.g. Mobile App Redesign"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Team</label>
                  <select 
                    name="team" 
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200"
                  >
                    <option value="">Select a team...</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.name}>{team.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <textarea 
                    name="description" 
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 dark:placeholder-slate-400 resize-none"
                    placeholder="What is this project about?"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsNewProjectModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 transition-colors"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Task Modal */}
      <AnimatePresence>
        {isNewTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewTaskModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add New Task</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">to {selectedProject?.name}</p>
              </div>
              <form onSubmit={createTask} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Task Title</label>
                  <input 
                    name="title" 
                    required 
                    autoFocus
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 dark:placeholder-slate-400"
                    placeholder="What needs to be done?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assignee</label>
                    <input 
                      name="assignee" 
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 dark:placeholder-slate-400"
                      placeholder="Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                    <select 
                      name="priority"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200"
                    >
                      <option value="low">Low</option>
                      <option value="medium" selected>Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (Optional)</label>
                  <textarea 
                    name="description" 
                    rows={2}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 dark:placeholder-slate-400 resize-none"
                    placeholder="More details..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsNewTaskModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 transition-colors"
                  >
                    Add Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Case to Project Modal */}
      <AnimatePresence>
        {addToProjectModalCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddToProjectModalCase(null)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {addedCaseIds.has(addToProjectModalCase.case_id) ? 'Reassign Case' : 'Add Case as Task'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Case #{addToProjectModalCase.case_id} — {addToProjectModalCase.subject || 'No subject'}
                </p>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {addedCaseIds.has(addToProjectModalCase.case_id) ? 'Select a different project:' : 'Select a project:'}
                </p>
                {projects.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No projects yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {projects.map(project => {
                      const currentMapping = addedCaseIds.get(addToProjectModalCase.case_id);
                      const isCurrent = currentMapping?.projectId === project.id;
                      return (
                        <button
                          key={project.id}
                          onClick={() => addCaseAsTask(addToProjectModalCase, project.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${
                            isCurrent
                              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950'
                              : 'border-slate-200 dark:border-slate-600 hover:bg-sky-50 dark:hover:bg-sky-950 hover:border-sky-200 dark:hover:border-sky-800'
                          }`}
                        >
                          <div>
                            <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{project.name}</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {project.total_tasks} tasks{isCurrent && ' · Current'}
                            </p>
                          </div>
                          {isCurrent
                            ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            : <PlusCircle className="w-5 h-5 text-sky-500" />
                          }
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  onClick={() => { setAddToProjectModalCase(null); setPendingCaseForProject(addToProjectModalCase); setIsNewProjectModalOpen(true); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400 rounded-xl text-sm font-medium hover:bg-sky-50 dark:hover:bg-sky-950 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create New Project
                </button>
                <button 
                  onClick={() => setAddToProjectModalCase(null)}
                  className="w-full mt-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Team Modal */}
      <AnimatePresence>
        {isNewTeamModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewTeamModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Create New Team</h3>
              </div>
              <form onSubmit={createTeam} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Team Name</label>
                  <input 
                    name="name" 
                    required 
                    autoFocus
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 dark:placeholder-slate-400"
                    placeholder="e.g. Development Team"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <textarea 
                    name="description" 
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 dark:placeholder-slate-400 resize-none"
                    placeholder="What does this team work on?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Team Color</label>
                  <div className="grid grid-cols-8 gap-2">
                    {[
                      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
                      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
                      '#6B7280', '#F97316', '#8B5A2B', '#059669'
                    ].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={(e) => {
                          // Uncheck all others and check this one
                          const form = (e.target as HTMLButtonElement).closest('form');
                          if (form) {
                            const colorInputs = form.querySelectorAll('input[name="color"]') as NodeListOf<HTMLInputElement>;
                            colorInputs.forEach(input => input.checked = false);
                            const targetInput = form.querySelector(`input[value="${color}"]`) as HTMLInputElement;
                            if (targetInput) targetInput.checked = true;
                          }
                        }}
                        className="w-8 h-8 rounded-lg border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-colors relative"
                        style={{ backgroundColor: color }}
                      >
                        <input 
                          type="radio" 
                          name="color" 
                          value={color} 
                          required
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsNewTeamModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 transition-colors"
                  >
                    Create Team
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Team Modal */}
      <AnimatePresence>
        {editingTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTeam(null)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Editar Equipo</h3>
              </div>
              <form onSubmit={updateTeam} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Equipo</label>
                  <input 
                    name="name" 
                    required 
                    autoFocus
                    defaultValue={editingTeam.name}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 dark:placeholder-slate-400"
                    placeholder="e.g. Development Team"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
                  <textarea 
                    name="description" 
                    rows={3}
                    defaultValue={editingTeam.description}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-200 dark:placeholder-slate-400 resize-none"
                    placeholder="¿En qué trabaja este equipo?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Color del Equipo</label>
                  <div className="grid grid-cols-8 gap-2">
                    {[
                      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
                      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
                      '#6B7280', '#F97316', '#8B5A2B', '#059669'
                    ].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={(e) => {
                          // Uncheck all others and check this one
                          const form = (e.target as HTMLButtonElement).closest('form');
                          if (form) {
                            const colorInputs = form.querySelectorAll('input[name="color"]') as NodeListOf<HTMLInputElement>;
                            colorInputs.forEach(input => input.checked = false);
                            const targetInput = form.querySelector(`input[value="${color}"]`) as HTMLInputElement;
                            if (targetInput) targetInput.checked = true;
                          }
                        }}
                        className="w-8 h-8 rounded-lg border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-colors relative"
                        style={{ backgroundColor: color }}
                      >
                        <input 
                          type="radio" 
                          name="color" 
                          value={color} 
                          required
                          defaultChecked={editingTeam.color === color}
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setEditingTeam(null)}
                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 transition-colors"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Alert Modal */}
      <AnimatePresence>
        {alertModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className={`p-6 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 ${
                alertModal.type === 'success' ? 'text-green-600 dark:text-green-400' :
                alertModal.type === 'error' ? 'text-red-600 dark:text-red-400' :
                alertModal.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                'text-blue-600 dark:text-blue-400'
              }`}>
                {alertModal.type === 'success' && <CheckCircle2 className="w-6 h-6" />}
                {alertModal.type === 'error' && <AlertCircle className="w-6 h-6" />}
                {alertModal.type === 'warning' && <AlertCircle className="w-6 h-6" />}
                {alertModal.type === 'info' && <AlertCircle className="w-6 h-6" />}
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{alertModal.title}</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 dark:text-slate-300 mb-6">{alertModal.message}</p>
                <button 
                  onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                  className={`w-full px-4 py-2 rounded-xl font-medium transition-colors ${
                    alertModal.type === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' :
                    alertModal.type === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' :
                    alertModal.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' :
                    'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (confirmModal.onCancel) confirmModal.onCancel();
                setConfirmModal({ ...confirmModal, isOpen: false });
              }}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 text-red-600 dark:text-red-400">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{confirmModal.title}</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 dark:text-slate-300 mb-6">{confirmModal.message}</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      if (confirmModal.onCancel) confirmModal.onCancel();
                      setConfirmModal({ ...confirmModal, isOpen: false });
                    }}
                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    {confirmModal.cancelText || 'Cancelar'}
                  </button>
                  <button 
                    onClick={confirmModal.onConfirm}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                  >
                    {confirmModal.confirmText || 'Confirmar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

