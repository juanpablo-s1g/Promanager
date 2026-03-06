import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

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
  const PORT = 3000;

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
