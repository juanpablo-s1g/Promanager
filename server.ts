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
    team TEXT,
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

// Create teams table
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL
  );
`);

// Add team column to existing databases
try {
  db.exec(`ALTER TABLE projects ADD COLUMN team TEXT;`);
} catch (e) {
  // Column already exists or other error, continue
}
// Add default teams if none exist
const teamCount = db.prepare(`SELECT COUNT(*) as count FROM teams`).get() as { count: number };
if (teamCount.count === 0) {
  const defaultTeams = [
    { name: 'Development', description: 'Frontend and backend development team', color: '#3B82F6' },
    { name: 'Design', description: 'UI/UX and product design team', color: '#8B5CF6' },
    { name: 'Marketing', description: 'Marketing and growth team', color: '#10B981' },
    { name: 'Analytics', description: 'Data analytics and reporting team', color: '#F59E0B' }
  ];
  
  const insertTeam = db.prepare(`INSERT INTO teams (name, description, color) VALUES (?, ?, ?)`);
  defaultTeams.forEach(team => {
    insertTeam.run(team.name, team.description, team.color);
  });
}
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
    const { name, description, team } = req.body;
    const result = db.prepare("INSERT INTO projects (name, description, team) VALUES (?, ?, ?)").run(name, description, team);
    res.json({ id: result.lastInsertRowid, name, description, team });
  });

  app.patch("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    const { name, description, team } = req.body;
    const result = db.prepare("UPDATE projects SET name = ?, description = ?, team = ? WHERE id = ?").run(name, description, team, id);
    res.json({ success: true, changes: result.changes });
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
    const { status, priority, assignee, title, description, project_id } = req.body;
    const fields = [];
    const values = [];
    if (status) { fields.push("status = ?"); values.push(status); }
    if (priority) { fields.push("priority = ?"); values.push(priority); }
    if (assignee !== undefined) { fields.push("assignee = ?"); values.push(assignee); }
    if (title) { fields.push("title = ?"); values.push(title); }
    if (description !== undefined) { fields.push("description = ?"); values.push(description); }
    if (project_id !== undefined) { fields.push("project_id = ?"); values.push(project_id); }
    
    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });
    
    values.push(req.params.id);
    db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    res.json({ success: true });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Find tasks by S1 case IDs (returns latest task per case_id)
  app.post("/api/tasks/find-by-cases", (req, res) => {
    const { case_ids } = req.body;
    if (!Array.isArray(case_ids) || case_ids.length === 0) {
      return res.json([]);
    }
    const patterns = case_ids.map((id: string) => `[Case #${id}]%`);
    const conditions = patterns.map(() => "title LIKE ?").join(" OR ");
    const rows = db.prepare(
      `SELECT id, project_id, title FROM tasks WHERE ${conditions} ORDER BY id DESC`
    ).all(...patterns);
    // Keep only the latest (highest id) task per case_id
    const seen = new Set<string>();
    const results: { case_id: string; task_id: number; project_id: number }[] = [];
    for (const row of rows as any[]) {
      const match = row.title.match(/^\[Case #([^\]]+)\]/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        results.push({ case_id: match[1], task_id: row.id, project_id: row.project_id });
      }
    }
    res.json(results);
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
    const url = `${S1_API_URL}/api/public/get/?${params.toString()}`;
    console.log(`Debug: S1 API Call - URL: ${url.replace(token, '[TOKEN]')}`);
    
    try {
      const apiRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await apiRes.json();
      console.log(`Debug: S1 API Response - success: ${data.success}, result_code: ${data.result_code || 'none'}${data.data ? `, data_count: ${data.data.length}` : ''}`);
      return data;
    } catch (error) {
      console.error("Debug: S1 API fetch error:", error);
      return { success: false, error: "Network error" };
    }
  }

  async function fetchAllS1Pages(token: string, type: string, extraParams: Record<string, string>): Promise<any[]> {
    let allData: any[] = [];
    let offset = 0;
    const pageSize = 5000;
    console.log(`Debug: Starting fetchAllS1Pages for type: ${type} with params:`, extraParams);
    while (true) {
      const params = new URLSearchParams({ type, cpgid: "8322880", ...extraParams, offset: String(offset), page_size: String(pageSize) });
      console.log(`Debug: Fetching ${type} page with offset: ${offset}`);
      const data = await s1ApiFetch(token, params);
      console.log(`Debug: ${type} API response - success: ${data.success}, data length: ${data.data?.length || 0}`);
      if (!data.success) {
        console.log(`Debug: ${type} API error:`, data);
        break;
      }
      if (!data.data || data.data.length === 0) break;
      allData = allData.concat(data.data);
      if (!data.pagination || allData.length >= data.pagination.total) break;
      offset += pageSize;
    }
    console.log(`Debug: Completed fetchAllS1Pages for ${type} - total records: ${allData.length}`);
    return allData;
  }

  app.get("/api/test-groups", async (req, res) => {
    try {
      console.log("=== TESTING GROUP ENDPOINT ===");
      let token = await getS1Token();
      
      // Test group_cat endpoint directly
      const groupData = await fetchAllS1Pages(token, "group_cat", { campaigns: "8322880" });
      console.log(`TEST: Fetched ${groupData.length} groups`);
      console.log("TEST: First 3 groups:", groupData.slice(0, 3));
      
      // Build group map
      const groupMap: Record<string, string> = {};
      for (const g of groupData) {
        if (g.group_id) {
          groupMap[String(g.group_id)] = g.group_name || g.name || `Group ${g.group_id}`;
        }
      }
      console.log("TEST: Group map keys:", Object.keys(groupMap));
      console.log("TEST: Group map sample:", Object.entries(groupMap).slice(0, 5));
      
      return res.json({
        success: true,
        groupCount: groupData.length,
        groupMap,
        rawGroups: groupData.slice(0, 3)
      });
    } catch (error) {
      console.error("Group test error:", error);
      return res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.get("/api/s1-analytics/debug", async (req, res) => {
    try {
      console.log("=== DEBUG ENDPOINT CALLED ===");
      const { date_from } = req.query;
      if (!date_from) {
        return res.status(400).json({ success: false, error: "date_from is required" });
      }

      let token = await getS1Token();
      const dateParams: Record<string, string> = { date_from: date_from as string };

      // Get just one case to inspect its structure
      const casesParams = new URLSearchParams({
        type: "cases_detail",
        cpgid: "8322880",
        ...dateParams,
        offset: "0",
        page_size: "1",
      });
      
      console.log(`DEBUG: Calling cases_detail with params: ${casesParams.toString()}`);
      let casesData = await s1ApiFetch(token, casesParams);
      
      if (!casesData.success && casesData.result_code === "S1ERR_INVALID_TOKEN") {
        s1Token = null;
        token = await getS1Token();
        casesData = await s1ApiFetch(token, casesParams);
      }
      
      console.log("DEBUG: Cases response:", JSON.stringify(casesData, null, 2));
      
      // Get case_state for same date
      const stateParams = new URLSearchParams({
        type: "case_state",
        cpgid: "8322880",
        ...dateParams,
        offset: "0",
        page_size: "1",
      });
      
      console.log(`DEBUG: Calling case_state with params: ${stateParams.toString()}`);
      const stateData = await s1ApiFetch(token, stateParams);
      console.log("DEBUG: Case state response:", JSON.stringify(stateData, null, 2));
      
      return res.json({
        success: true,
        cases: casesData,
        states: stateData,
        debug: "Check server console for detailed logs"
      });
      
    } catch (error) {
      console.error("DEBUG endpoint error:", error);
      return res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.get("/api/s1-analytics/report", async (req, res) => {
    try {
      const { date_from, date_to, offset, page_size, campaigns } = req.query;
      console.log("============ API CALL START ============");
      console.log(`API CALL: /api/s1-analytics/report with date_from="${date_from}", date_to="${date_to || 'none'}"`);
      if (!date_from) {
        return res.status(400).json({ success: false, error: "date_from is required" });
      }

      let token = await getS1Token();
      const dateParams: Record<string, string> = { date_from: date_from as string };
      if (date_to) dateParams.date_to = date_to as string;

      // 1. Fetch cases_detail (paginated by user)
      const casesParams = new URLSearchParams({
        type: "cases_detail",
        cpgid: "8322880",
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

      // 2. Fetch all related data for complete case information
      // - case_tags_detail: tags and classifications
      // - group_cat: group names (REQUIRES campaigns parameter)
      // - cases_status_detail: case status information
      const [allTags, allGroups, allCaseStates] = await Promise.all([
        fetchAllS1Pages(token, "case_tags_detail", dateParams),
        fetchAllS1Pages(token, "group_cat", { campaigns: campaigns as string || "8322880" }), // group_cat requires campaigns parameter
        fetchAllS1Pages(token, "cases_status_detail", dateParams),
      ]);
      
      console.log("============ GROUPS DEBUG ============");
      console.log(`GROUPS: campaigns param used: "${campaigns || '8322880'}"`);
      console.log(`GROUPS: Fetched ${allGroups.length} groups`);

      // Debug logging with comprehensive information
      console.log(`Debug: Fetched ${allTags.length} tags, ${allGroups.length} groups, ${allCaseStates.length} case states`);
      console.log(`Debug: Groups sample:`, allGroups.slice(0, 2));
      console.log(`GROUP DEBUG: Raw group data structure:`, allGroups.length > 0 ? Object.keys(allGroups[0]) : 'No groups');
      if (allGroups.length > 0) {
        console.log(`GROUP DEBUG: First group sample:`, allGroups[0]);
        console.log(`GROUP DEBUG: Group name field candidates:`, {
          group_name: allGroups[0].group_name,
          name: allGroups[0].name,
          group_id: allGroups[0].group_id
        });
      }

      // Build comprehensive lookup maps for data crossing
      
      // 1. Group lookup: group_id -> group_name
      const groupMap: Record<string, string> = {};
      for (const g of allGroups) {
        if (g.group_id) {
          const groupName = g.group_name || g.name || g.display_name || g.title || `Group ${g.group_id}`;
          groupMap[String(g.group_id)] = groupName;
        }
      }
      console.log(`GROUP DEBUG: Built group map with ${Object.keys(groupMap).length} entries`);
      if (Object.keys(groupMap).length > 0) {
        const firstGroup = Object.entries(groupMap)[0];
        console.log(`GROUP DEBUG: Sample group mapping - ID ${firstGroup[0]}: "${firstGroup[1]}"`);
        console.log(`GROUP DEBUG: All group IDs available:`, Object.keys(groupMap));
      } else {
        console.log(`GROUP DEBUG: NO GROUPS FOUND - Raw group data length: ${allGroups.length}`);
      }

      // Build case state lookup: case_id -> case_status (from cases_status_detail API)
      const caseStateMap: Record<string, string> = {};
      for (const state of allCaseStates) {
        if (state.case_id) {
          // Try multiple possible field names for status from cases_status_detail
          const statusValue = state.case_status || state.status || state.state || state.case_state || "";
          caseStateMap[String(state.case_id)] = statusValue;
        }
      }
      
      // Debug logging for case state map
      const stateMapSize = Object.keys(caseStateMap).length;
      console.log(`Debug: Built case state map with ${stateMapSize} entries from cases_status_detail API`);
      if (stateMapSize > 0) {
        const firstEntry = Object.entries(caseStateMap)[0];
        console.log(`Debug: Sample case state entry - Case ${firstEntry[0]}: "${firstEntry[1]}"`);
        // Log first state object structure for debugging
        console.log("Debug: First case state object structure:", Object.keys(allCaseStates[0] || {}));
      }

      // TEMPORARY: Create test case status to verify UI works
      if (stateMapSize === 0 && (casesData.data || []).length > 0) {
        console.log("Debug: No case states from API - creating test data");
        const firstCaseId = String((casesData.data || [])[0]?.case_id);
        const secondCaseId = String((casesData.data || [])[1]?.case_id);
        if (firstCaseId) caseStateMap[firstCaseId] = "active";
        if (secondCaseId) caseStateMap[secondCaseId] = "resolved";
        console.log(`Debug: Test case states created for cases ${firstCaseId} and ${secondCaseId}`);
      }

      // Build tag lookup: case_id -> { assigned_to, classification, quarter }
      const tagMap: Record<string, { assigned_to: string; classification: string; quarter: string }> = {};
      for (const tag of allTags) {
        const cid = String(tag.case_id);
        if (!tagMap[cid]) tagMap[cid] = { assigned_to: "", classification: "", quarter: "" };
        if (tag.category === "AssignedTo" && tag.tag_name) {
          tagMap[cid].assigned_to = tagMap[cid].assigned_to
            ? `${tagMap[cid].assigned_to}, ${tag.tag_name}`
            : tag.tag_name;
        } else if (tag.category === "Classification" && tag.tag_name) {
          tagMap[cid].classification = tagMap[cid].classification
            ? `${tagMap[cid].classification}, ${tag.tag_name}`
            : tag.tag_name;
        } else if (tag.category === "Quarter" && tag.tag_name) {
          tagMap[cid].quarter = tagMap[cid].quarter
            ? `${tagMap[cid].quarter}, ${tag.tag_name}`
            : tag.tag_name;
        }
      }

      // Get all case IDs for task lookup
      const caseIds = (casesData.data || []).map((c: any) => c.case_id);
      
      // Build task lookup: case_id -> { task_id, task_status }
      const taskMap: Record<string, { task_id: number; task_status: string }> = {};
      if (caseIds.length > 0) {
        const patterns = caseIds.map((id: string) => `[Case #${id}]%`);
        const conditions = patterns.map(() => "title LIKE ?").join(" OR ");
        const taskRows = db.prepare(
          `SELECT id, title, status FROM tasks WHERE ${conditions} ORDER BY id DESC`
        ).all(...patterns) as any[];
        
        // Keep only the latest task per case_id
        const seenCases = new Set<string>();
        for (const row of taskRows) {
          const match = row.title.match(/^\[Case #([^\]]+)\]/);
          if (match && !seenCases.has(match[1])) {
            seenCases.add(match[1]);
            taskMap[match[1]] = {
              task_id: row.id,
              task_status: row.status
            };
          }
        }
      }

      // Merge into each case and determine completion status
      const mergedData = (casesData.data || [])
        .map((c: any, index: number) => {
          const caseId = String(c.case_id);
          const taskInfo = taskMap[caseId];
          
          // Get case state from case_state API
          const apiCaseState = caseStateMap[caseId] || "";
          
          // Debug logging for first few cases
          if (index < 3) {
            console.log(`Debug: Case ${caseId} - apiCaseState: "${apiCaseState}", c.status: "${c.status || 'undefined'}", c.state: "${c.state || 'undefined'}", c.case_status: "${c.case_status || 'undefined'}"`);
          }
          
          // Determine case status from multiple sources
          const caseStatus = apiCaseState || c.status || c.state || c.case_status || "";
          const isCaseResolved = /resolved|closed|finished|completed|ended|eliminado|resuelto/i.test(caseStatus);
          
          // If case is resolved and there's an associated task, mark it as completed
          let shouldMarkTaskComplete = false;
          if (isCaseResolved && taskInfo && taskInfo.task_status !== 'done') {
            shouldMarkTaskComplete = true;
            // Update task status to 'done' in database
            try {
              db.prepare(`UPDATE tasks SET status = 'done' WHERE id = ?`).run(taskInfo.task_id);
              taskInfo.task_status = 'done'; // Update local reference
            } catch (error) {
              console.error(`Failed to update task ${taskInfo.task_id} status:`, error);
            }
          }

          // Debug first few cases group mapping
          if (index < 3) {
            console.log(`GROUP MAPPING DEBUG Case ${caseId}:`);
            console.log(`  - Original group_id: "${c.group_id}"`);
            console.log(`  - Mapped group_name: "${groupMap[String(c.group_id)] || 'NOT_FOUND'}"`);
            console.log(`  - Final group_name: "${groupMap[String(c.group_id)] || c.group_name || `Unknown Group (${c.group_id})`}"`);
          }
          
          return {
            ...c,
            // Cross-reference with group data to show group name instead of ID
            group_name: groupMap[String(c.group_id)] || c.group_name || `Unknown Group (${c.group_id})`,
            group_id: c.group_id, // Keep original ID for reference
            // Cross-reference with tags and classifications
            assigned_to: tagMap[caseId]?.assigned_to || "",
            classification: tagMap[caseId]?.classification || "",
            quarter: tagMap[caseId]?.quarter || "",
            // Cross-reference with status data
            case_status: caseStatus,
            case_state_id: c.case_state_id || null,
            // Task information
            task_id: taskInfo?.task_id || null,
            task_status: taskInfo?.task_status || null,
            is_task_completed: taskInfo?.task_status === 'done',
            task_auto_completed: shouldMarkTaskComplete,
            is_case_resolved: isCaseResolved
          };
        });

      // Log case information (including resolved cases for sync purposes)
      const totalCases = (casesData.data || []).length;
      const resolvedCases = mergedData.filter((c: any) => c.is_case_resolved).length;
      const activeCases = mergedData.filter((c: any) => !c.is_case_resolved).length;
      console.log(`S1 Analytics: ${totalCases} cases retrieved, ${activeCases} active, ${resolvedCases} resolved (kept for sync)`);
      
      // CASE_STATUS DEBUG - Log first case details
      if (mergedData.length > 0) {
        const firstCase = mergedData[0];
        console.log(`CASE_STATUS DEBUG: First case #${firstCase.case_id}:`);
        console.log(`  - case_status: "${firstCase.case_status || 'EMPTY'}"`); 
        console.log(`  - original status: "${firstCase.status || 'EMPTY'}"`); 
        console.log(`  - original state: "${firstCase.state || 'EMPTY'}"`); 
        console.log(`  - caseStateMap entry: "${caseStateMap[String(firstCase.case_id)] || 'NOT_FOUND'}"`); 
        console.log(`  - caseStateMap size: ${Object.keys(caseStateMap).length}`);
        console.log(`  - allCaseStates length: ${allCaseStates.length}`);
      }

      res.json({
        success: true,
        data: mergedData,
        pagination: {
          ...casesData.pagination,
          total_cases: totalCases,
          active_cases: activeCases,
          resolved_cases: resolvedCases
        },
      });
    } catch (err: any) {
      console.error("S1 Analytics report error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Teams routes
  app.get("/api/teams", (req, res) => {
    const teams = db.prepare(`SELECT * FROM teams ORDER BY name`).all();
    res.json(teams);
  });

  app.post("/api/teams", (req, res) => {
    const { name, description, color } = req.body;
    const result = db.prepare(`INSERT INTO teams (name, description, color) VALUES (?, ?, ?)`).run(name, description, color);
    res.json({ id: result.lastInsertRowid, name, description, color });
  });

  app.patch("/api/teams/:id", (req, res) => {
    const { id } = req.params;
    const { name, description, color } = req.body;
    const result = db.prepare(`UPDATE teams SET name = ?, description = ?, color = ? WHERE id = ?`).run(name, description, color, id);
    res.json({ success: true, changes: result.changes });
  });

  app.delete("/api/teams/:id", (req, res) => {
    const { id } = req.params;
    db.prepare(`DELETE FROM teams WHERE id = ?`).run(id);
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
