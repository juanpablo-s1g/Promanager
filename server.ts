import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("projects.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    assignee TEXT,
    status TEXT DEFAULT 'todo', -- todo, in-progress, done
    priority TEXT DEFAULT 'medium', -- low, medium, high
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
  );
`);

async function startServer() {
  const app = express();
  const PORT = 4100;

  app.use(express.json());

  // API Routes
  app.get("/api/projects", (req, res) => {
    const projects = db.prepare(`
      SELECT p.*, 
             COUNT(t.id) as total_tasks,
             SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      GROUP BY p.id
    `).all();
    res.json(projects);
  });

  app.post("/api/projects", (req, res) => {
    const { name, description } = req.body;
    const result = db.prepare("INSERT INTO projects (name, description) VALUES (?, ?)").run(name, description);
    res.json({ id: result.lastInsertRowid, name, description });
  });

  app.delete("/api/projects/:id", (req, res) => {
    db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/projects/:id/tasks", (req, res) => {
    const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ?").all(req.params.id);
    res.json(tasks);
  });

  app.post("/api/projects/:id/tasks", (req, res) => {
    const { title, description, assignee, status, priority } = req.body;
    const result = db.prepare(`
      INSERT INTO tasks (project_id, title, description, assignee, status, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, title, description, assignee, status || 'todo', priority || 'medium');
    res.json({ id: result.lastInsertRowid, project_id: req.params.id, title, description, assignee, status, priority });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { status, priority, assignee, title, description } = req.body;
    const fields = [];
    const values = [];
    if (status) { fields.push("status = ?"); values.push(status); }
    if (priority) { fields.push("priority = ?"); values.push(priority); }
    if (assignee !== undefined) { fields.push("assignee = ?"); values.push(assignee); }
    if (title) { fields.push("title = ?"); values.push(title); }
    if (description !== undefined) { fields.push("description = ?"); values.push(description); }
    
    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });
    
    values.push(req.params.id);
    db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    res.json({ success: true });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Reports endpoint
  app.get("/api/reports", (req, res) => {
    const projects = db.prepare(`
      SELECT p.*, 
             COUNT(t.id) as total_tasks,
             SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
             SUM(CASE WHEN t.status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_tasks,
             SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todo_tasks,
             SUM(CASE WHEN t.priority = 'high' THEN 1 ELSE 0 END) as high_priority,
             SUM(CASE WHEN t.priority = 'medium' THEN 1 ELSE 0 END) as medium_priority,
             SUM(CASE WHEN t.priority = 'low' THEN 1 ELSE 0 END) as low_priority
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all();

    const allTasks = db.prepare(`
      SELECT t.*, p.name as project_name 
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id
      ORDER BY t.created_at DESC
    `).all() as any[];

    const assigneeStats = db.prepare(`
      SELECT 
        COALESCE(NULLIF(t.assignee, ''), 'Unassigned') as assignee,
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN t.status = 'in-progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todo
      FROM tasks t
      GROUP BY COALESCE(NULLIF(t.assignee, ''), 'Unassigned')
      ORDER BY total DESC
    `).all();

    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter((t: any) => t.status === 'done').length;
    const inProgressTasks = allTasks.filter((t: any) => t.status === 'in-progress').length;
    const todoTasks = allTasks.filter((t: any) => t.status === 'todo').length;
    const highPriority = allTasks.filter((t: any) => t.priority === 'high').length;
    const mediumPriority = allTasks.filter((t: any) => t.priority === 'medium').length;
    const lowPriority = allTasks.filter((t: any) => t.priority === 'low').length;

    res.json({
      summary: {
        totalProjects: projects.length,
        totalTasks,
        doneTasks,
        inProgressTasks,
        todoTasks,
        highPriority,
        mediumPriority,
        lowPriority,
        completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        avgTasksPerProject: projects.length > 0 ? Math.round((totalTasks / projects.length) * 10) / 10 : 0,
      },
      projects,
      assigneeStats,
      recentTasks: allTasks.slice(0, 10),
    });
  });

  // --- S1 Analytics Integration ---
  const S1_API_URL = process.env.S1_ANALYTICS_API_URL || "https://api.analytics.va.s1g.in";
  const S1_API_KEY = process.env.S1_ANALYTICS_API_KEY || "";
  let s1Token: string | null = null;
  let s1TokenExpiry = 0;

  async function getS1Token(): Promise<string> {
    if (s1Token && Date.now() < s1TokenExpiry) {
      return s1Token;
    }
    const res = await fetch(`${S1_API_URL}/api/public/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `key=${encodeURIComponent(S1_API_KEY)}`,
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.result_message || "Failed to obtain S1 Analytics token");
    }
    s1Token = data.data.token;
    s1TokenExpiry = Date.now() + (data.data.expires_in - 60) * 1000;
    return s1Token!;
  }

  async function s1ApiFetch(token: string, params: URLSearchParams): Promise<any> {
    const apiRes = await fetch(`${S1_API_URL}/api/public/get/?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return apiRes.json();
  }

  async function fetchAllS1Pages(token: string, type: string, extraParams: Record<string, string>): Promise<any[]> {
    let allData: any[] = [];
    let offset = 0;
    const pageSize = 5000;
    while (true) {
      const params = new URLSearchParams({ type, ...extraParams, offset: String(offset), page_size: String(pageSize) });
      const data = await s1ApiFetch(token, params);
      if (!data.success || !data.data || data.data.length === 0) break;
      allData = allData.concat(data.data);
      if (!data.pagination || allData.length >= data.pagination.total) break;
      offset += pageSize;
    }
    return allData;
  }

  app.get("/api/s1-analytics/report", async (req, res) => {
    try {
      const { date_from, date_to, offset, page_size, campaigns } = req.query;
      if (!date_from) {
        return res.status(400).json({ success: false, error: "date_from is required" });
      }

      let token = await getS1Token();
      const dateParams: Record<string, string> = { date_from: date_from as string };
      if (date_to) dateParams.date_to = date_to as string;

      // 1. Fetch cases_detail (paginated by user)
      const casesParams = new URLSearchParams({
        type: "cases_detail",
        ...dateParams,
        offset: (offset as string) || "0",
        page_size: (page_size as string) || "100",
      });
      let casesData = await s1ApiFetch(token, casesParams);

      // Handle token expiry
      if (!casesData.success && casesData.result_code === "S1ERR_INVALID_TOKEN") {
        s1Token = null;
        token = await getS1Token();
        casesData = await s1ApiFetch(token, casesParams);
      }
      if (!casesData.success) {
        return res.json(casesData);
      }

      // 2. Fetch case_tags_detail (all pages for the date range)
      // 3. Fetch group_cat (if campaigns provided)
      const [allTags, allGroups] = await Promise.all([
        fetchAllS1Pages(token, "case_tags_detail", dateParams),
        campaigns
          ? fetchAllS1Pages(token, "group_cat", { campaigns: campaigns as string })
          : Promise.resolve([]),
      ]);

      // Build group lookup: group_id -> group_name
      const groupMap: Record<string, string> = {};
      for (const g of allGroups) {
        if (g.group_id) groupMap[g.group_id] = g.group_name || "";
      }

      // Build tag lookup: case_id -> { assigned_to, classification }
      const tagMap: Record<string, { assigned_to: string; classification: string }> = {};
      for (const tag of allTags) {
        const cid = String(tag.case_id);
        if (!tagMap[cid]) tagMap[cid] = { assigned_to: "", classification: "" };
        if (tag.category === "AssignedTo" && tag.tag_name) {
          tagMap[cid].assigned_to = tagMap[cid].assigned_to
            ? `${tagMap[cid].assigned_to}, ${tag.tag_name}`
            : tag.tag_name;
        } else if (tag.category === "Classification" && tag.tag_name) {
          tagMap[cid].classification = tagMap[cid].classification
            ? `${tagMap[cid].classification}, ${tag.tag_name}`
            : tag.tag_name;
        }
      }

      // Merge into each case
      const mergedData = (casesData.data || []).map((c: any) => ({
        ...c,
        group_name: groupMap[c.group_id] || "",
        assigned_to: tagMap[String(c.case_id)]?.assigned_to || "",
        classification: tagMap[String(c.case_id)]?.classification || "",
      }));

      res.json({
        success: true,
        data: mergedData,
        pagination: casesData.pagination,
      });
    } catch (err: any) {
      console.error("S1 Analytics report error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
