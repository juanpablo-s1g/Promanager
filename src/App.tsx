import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
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
  TrendingUp,
  Target,
  Zap,
  Award,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Project, Task, S1Case } from './types';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // S1 Analytics state
  const [activeView, setActiveView] = useState<'overview' | 'analytics' | 'reports'>('overview');
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
  const [addedCaseIds, setAddedCaseIds] = useState<Set<string>>(new Set());
  const [pendingCaseForProject, setPendingCaseForProject] = useState<S1Case | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [editingAssignee, setEditingAssignee] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    fetchProjects();
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

  const createProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
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
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok && selectedProject) {
        fetchTasks(selectedProject.id);
        fetchProjects();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const deleteProject = async (projectId: number) => {
    if (!confirm('Are you sure you want to delete this project and all its tasks?')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedProject(null);
        fetchProjects();
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
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
        'Campaign': c.campaign_name || '',
        'User': c.user_name || '',
      }));
      const ws = XLSX.utils.json_to_sheet(casesData);
      ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 50 }, { wch: 14 }, { wch: 10 }, { wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 20 }];
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
        ['ProManager Report', '', '', `Generated: ${new Date().toLocaleString()}`],
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

      XLSX.writeFile(workbook, `ProManager_Report_${today}.xlsx`);
    } catch (err) {
      console.error('Error exporting report:', err);
    }
  };

  const fetchS1Cases = async (offset = 0) => {
    if (!s1DateFrom) return;
    setS1Loading(true);
    setS1Error(null);
    try {
      const params = new URLSearchParams({ date_from: `${s1DateFrom} 00:00:00`, page_size: '100', offset: String(offset) });
      if (s1DateTo) params.append('date_to', `${s1DateTo} 23:59:59`);
      if (s1Campaigns) params.append('campaigns', s1Campaigns);
      const res = await fetch(`/api/s1-analytics/report?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setS1Cases(data.data || []);
        setS1Pagination({ offset, page_size: data.pagination?.page_size || 100, total: data.pagination?.total || 0 });
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

  const addCaseAsTask = async (s1Case: S1Case, projectId: number) => {
    try {
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
        setAddedCaseIds(prev => new Set(prev).add(s1Case.case_id));
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
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading ProManager...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xl">
            <LayoutDashboard className="w-6 h-6" />
            <span>ProManager</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => { setSelectedProject(null); setActiveView('overview'); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${!selectedProject && activeView === 'overview' ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <BarChart3 className="w-4 h-4" />
            Overview
          </button>
          <button 
            onClick={() => { setSelectedProject(null); setActiveView('reports'); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${!selectedProject && activeView === 'reports' ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <TrendingUp className="w-4 h-4" />
            Reports
          </button>
          <button 
            onClick={() => { setSelectedProject(null); setActiveView('analytics'); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${!selectedProject && activeView === 'analytics' ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Database className="w-4 h-4" />
            S1 Analytics
          </button>
          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Projects
          </div>
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => { setSelectedProject(project); setActiveView('overview'); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${selectedProject?.id === project.id ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <span className="truncate">{project.name}</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${selectedProject?.id === project.id ? 'rotate-90' : ''}`} />
            </button>
          ))}
          <button 
            onClick={() => setIsNewProjectModalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950 transition-colors mt-4"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={exportToExcel}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Report
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
              {selectedProject ? selectedProject.name : activeView === 'analytics' ? 'S1 Analytics - Cases Report' : activeView === 'reports' ? 'Project Reports & Statistics' : 'Dashboard Overview'}
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
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  U{i}
                </div>
              ))}
            </div>
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
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                      {s1Pagination.offset + 1}–{Math.min(s1Pagination.offset + s1Cases.length, s1Pagination.total)} of {s1Pagination.total}
                    </span>
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
                          <th className="text-center px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s1Cases.map((c, idx) => {
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
                              <td className="px-5 py-3.5 text-center">
                                {isAdded ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Added
                                  </span>
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
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Page {Math.floor(s1Pagination.offset / s1Pagination.page_size) + 1} of {Math.ceil(s1Pagination.total / s1Pagination.page_size)}
                      </span>
                      <button
                        disabled={s1Pagination.offset + s1Pagination.page_size >= s1Pagination.total}
                        onClick={() => fetchS1Cases(s1Pagination.offset + s1Pagination.page_size)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
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
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100">Recent Projects</h2>
                  <button 
                    onClick={() => setIsNewProjectModalOpen(true)}
                    className="text-sm text-sky-600 font-medium hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {projects.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LayoutDashboard className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">No projects yet. Create your first one!</p>
                    </div>
                  ) : (
                    projects.map(project => (
                      <div 
                        key={project.id} 
                        className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        onClick={() => setSelectedProject(project)}
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <h3 className="font-medium text-slate-800 dark:text-slate-100 truncate">{project.name}</h3>
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
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedProject.name}</h2>
                  <p className="text-slate-500 dark:text-slate-400">{selectedProject.description}</p>
                </div>
                <div className="flex items-center gap-3">
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
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add Case as Task</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Case #{addToProjectModalCase.case_id} — {addToProjectModalCase.subject || 'No subject'}
                </p>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select a project:</p>
                {projects.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No projects yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {projects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => addCaseAsTask(addToProjectModalCase, project.id)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-sky-50 dark:hover:bg-sky-950 hover:border-sky-200 dark:hover:border-sky-800 transition-colors text-left"
                      >
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{project.name}</span>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{project.total_tasks} tasks</p>
                        </div>
                        <PlusCircle className="w-5 h-5 text-sky-500" />
                      </button>
                    ))}
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
    </div>
  );
}

