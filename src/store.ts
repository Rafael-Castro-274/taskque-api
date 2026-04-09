import { pool } from "./db.js";
import type { User, Task } from "./types.js";

function toUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string) || "",
    avatar: row.avatar as string,
    color: row.color as string,
    role: (row.role as User["role"]) || "member",
    createdAt: (row.created_at as Date).toISOString(),
  };
}

function toTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as Task["status"],
    priority: row.priority as Task["priority"],
    assigneeId: (row.assignee_id as string) || null,
    startDate: row.start_date ? (row.start_date as Date).toISOString().split("T")[0] : null,
    endDate: row.end_date ? (row.end_date as Date).toISOString().split("T")[0] : null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export const store = {
  // Users
  async getUsers(): Promise<User[]> {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at");
    return rows.map(toUser);
  },

  async getUserById(id: string): Promise<User | null> {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows.length ? toUser(rows[0]) : null;
  },

  async getUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!rows.length) return null;
    return { ...toUser(rows[0]), passwordHash: rows[0].password_hash as string };
  },

  async createUser(data: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    avatar: string;
    color: string;
    role: User["role"];
    createdAt: string;
  }): Promise<User> {
    const { rows } = await pool.query(
      `INSERT INTO users (id, name, email, password_hash, avatar, color, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [data.id, data.name, data.email, data.passwordHash, data.avatar, data.color, data.role, data.createdAt]
    );
    return toUser(rows[0]);
  },

  async updateUser(id: string, data: Partial<User & { passwordHash?: string }>): Promise<User | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.email !== undefined) { fields.push(`email = $${idx++}`); values.push(data.email); }
    if (data.avatar !== undefined) { fields.push(`avatar = $${idx++}`); values.push(data.avatar); }
    if (data.color !== undefined) { fields.push(`color = $${idx++}`); values.push(data.color); }
    if (data.role !== undefined) { fields.push(`role = $${idx++}`); values.push(data.role); }
    if (data.passwordHash !== undefined) { fields.push(`password_hash = $${idx++}`); values.push(data.passwordHash); }

    if (fields.length === 0) return null;

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows.length ? toUser(rows[0]) : null;
  },

  async deleteUser(id: string): Promise<boolean> {
    const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [id]);
    return (rowCount ?? 0) > 0;
  },

  // Tasks
  async getTasks(): Promise<Task[]> {
    const { rows } = await pool.query("SELECT * FROM tasks ORDER BY created_at");
    return rows.map(toTask);
  },

  async addTask(task: Task): Promise<Task> {
    const { rows } = await pool.query(
      `INSERT INTO tasks (id, title, description, status, priority, assignee_id, start_date, end_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        task.id, task.title, task.description, task.status, task.priority,
        task.assigneeId, task.startDate, task.endDate, task.createdAt, task.updatedAt,
      ]
    );
    return toTask(rows[0]);
  },

  async updateTask(id: string, data: Partial<Task>): Promise<Task | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
    if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }
    if (data.priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(data.priority); }
    if (data.assigneeId !== undefined) { fields.push(`assignee_id = $${idx++}`); values.push(data.assigneeId); }
    if (data.startDate !== undefined) { fields.push(`start_date = $${idx++}`); values.push(data.startDate); }
    if (data.endDate !== undefined) { fields.push(`end_date = $${idx++}`); values.push(data.endDate); }

    fields.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows.length ? toTask(rows[0]) : null;
  },

  async deleteTask(id: string): Promise<boolean> {
    const { rowCount } = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
    return (rowCount ?? 0) > 0;
  },
};
