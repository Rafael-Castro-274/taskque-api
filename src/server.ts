import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { initDb, prisma } from "./db.js";
import { store } from "./store.js";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  authMiddleware,
  socketAuthMiddleware,
} from "./auth.js";
import type { User, Task } from "./types.js";
import { COLUMNS } from "./types.js";
import { welcomeEmail, taskAssignedEmail, taskStatusEmail } from "./mail.js";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label]));

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
}

// ===== Auth Routes (public) =====
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email e senha são obrigatórios" });
    return;
  }

  const user = await store.getUserByEmail(email);
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  if (!user.active) {
    res.status(403).json({ error: "Conta desativada. Contate o administrador." });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  const token = generateToken({ id: user.id, role: user.role });
  const { passwordHash: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

// ===== Auth Routes (protected) =====
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  const user = await store.getUserById(req.user!.id);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json(user);
});

app.put("/api/auth/profile", authMiddleware, async (req, res) => {
  const { name, avatar, color, password } = req.body;
  const data: Partial<User & { passwordHash?: string }> = {};

  if (name) data.name = name;
  if (avatar) data.avatar = avatar;
  if (color) data.color = color;
  if (password) {
    data.passwordHash = await hashPassword(password);
    data.mustChangePassword = false;
  }

  const user = await store.updateUser(req.user!.id, data);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json(user);
});

// ===== User Routes (protected) =====
app.get("/api/users", authMiddleware, async (_req, res) => {
  res.json(await store.getUsers());
});

app.post("/api/users", authMiddleware, async (req, res) => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Apenas admins podem criar usuários" });
    return;
  }

  const { name, email, avatar, color, role } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: "Nome e email são obrigatórios" });
    return;
  }

  const existing = await store.getUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Email já cadastrado" });
    return;
  }

  const tempPassword = generateTempPassword();

  const user = await store.createUser({
    id: uuidv4(),
    name,
    email,
    passwordHash: await hashPassword(tempPassword),
    avatar: avatar || name.slice(0, 2).toUpperCase(),
    color: color || "#3b82f6",
    role: role || "member",
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  });

  io.emit("user:created", user);
  welcomeEmail(user.name, email, tempPassword);
  res.status(201).json(user);
});

app.patch("/api/users/:id/toggle-active", authMiddleware, async (req, res) => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Apenas admins podem ativar/desativar usuários" });
    return;
  }

  const userId = req.params.id as string;
  const current = await store.getUserById(userId);
  if (!current) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  const user = await store.updateUser(userId, { active: !current.active });
  if (user) {
    io.emit("user:updated", user);
    res.json(user);
  }
});

app.delete("/api/users/:id", authMiddleware, async (req, res) => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Apenas admins podem deletar usuários" });
    return;
  }

  const userId = req.params.id as string;
  if (await store.deleteUser(userId)) {
    io.emit("user:deleted", userId);
    io.emit("tasks:sync", await store.getTasks());
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: "Usuário não encontrado" });
  }
});

// ===== REST endpoints =====
app.get("/api/tasks", authMiddleware, async (_req, res) => {
  res.json(await store.getTasks());
});

// ===== Comment Routes =====
app.get("/api/tasks/:taskId/comments", authMiddleware, async (req, res) => {
  const taskId = req.params.taskId as string;
  res.json(await store.getCommentsByTaskId(taskId));
});

// ===== Socket.io =====
io.use(socketAuthMiddleware);

io.on("connection", async (socket) => {
  console.log(`Client connected: ${socket.id} (user: ${socket.data.user.id})`);

  const [users, tasks] = await Promise.all([
    store.getUsers(),
    store.getTasks(),
  ]);
  socket.emit("init", { developers: users, tasks });

  // User events
  socket.on("user:create", async (data: { name: string; email: string; avatar: string; color: string; role?: string }) => {
    if (socket.data.user.role !== "admin") return;

    const existing = await store.getUserByEmail(data.email);
    if (existing) return;

    const tempPassword = generateTempPassword();

    const user = await store.createUser({
      id: uuidv4(),
      name: data.name,
      email: data.email,
      passwordHash: await hashPassword(tempPassword),
      avatar: data.avatar || data.name.slice(0, 2).toUpperCase(),
      color: data.color || "#3b82f6",
      role: (data.role as User["role"]) || "member",
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    });
    io.emit("user:created", user);
    welcomeEmail(user.name, data.email, tempPassword);
  });

  socket.on("user:update", async ({ id, data }: { id: string; data: Partial<User> }) => {
    // Members can only update themselves
    if (socket.data.user.role !== "admin" && socket.data.user.id !== id) return;

    const user = await store.updateUser(id, data);
    if (user) {
      io.emit("user:updated", user);
      io.emit("tasks:sync", await store.getTasks());
    }
  });

  socket.on("user:delete", async (id: string) => {
    if (socket.data.user.role !== "admin") return;

    if (await store.deleteUser(id)) {
      io.emit("user:deleted", id);
      io.emit("tasks:sync", await store.getTasks());
    }
  });

  // Task events
  socket.on("task:create", async (data: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    const task = await store.addTask({
      ...data,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    });
    io.emit("task:created", task);

    // Notify assignee
    if (task.assigneeId) {
      const assignee = await store.getUserById(task.assigneeId);
      if (assignee?.email) {
        taskAssignedEmail(assignee.email, assignee.name, task.title, STATUS_LABEL[task.status] || task.status);
      }
    }
  });

  socket.on("task:update", async ({ id, data }: { id: string; data: Partial<Task> }) => {
    const oldTask = data.assigneeId !== undefined ? await store.getUserById(id) : null;
    const task = await store.updateTask(id, data);
    if (task) {
      io.emit("task:updated", task);

      // Notify new assignee if changed
      if (data.assigneeId && task.assigneeId) {
        const assignee = await store.getUserById(task.assigneeId);
        if (assignee?.email) {
          taskAssignedEmail(assignee.email, assignee.name, task.title, STATUS_LABEL[task.status] || task.status);
        }
      }
    }
  });

  socket.on("task:move", async ({ id, status }: { id: string; status: Task["status"] }) => {
    // Get old status before update
    const tasks = await store.getTasks();
    const oldTask = tasks.find((t) => t.id === id);
    const oldStatus = oldTask?.status;

    const task = await store.updateTask(id, { status });
    if (task) {
      io.emit("task:updated", task);

      // Notify assignee of status change
      if (task.assigneeId && oldStatus && oldStatus !== status) {
        const assignee = await store.getUserById(task.assigneeId);
        if (assignee?.email) {
          taskStatusEmail(
            assignee.email,
            assignee.name,
            task.title,
            STATUS_LABEL[oldStatus] || oldStatus,
            STATUS_LABEL[status] || status,
          );
        }
      }
    }
  });

  socket.on("task:delete", async (id: string) => {
    if (await store.deleteTask(id)) io.emit("task:deleted", id);
  });

  // Comment events
  socket.on("comment:create", async ({ taskId, content }: { taskId: string; content: string }) => {
    if (!content.trim()) return;
    const comment = await store.addComment({
      id: uuidv4(),
      content: content.trim(),
      taskId,
      authorId: socket.data.user.id,
    });
    io.emit("comment:created", comment);
  });

  socket.on("comment:delete", async (id: string) => {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) return;
    // Only author or admin can delete
    if (comment.authorId !== socket.data.user.id && socket.data.user.role !== "admin") return;
    if (await store.deleteComment(id)) {
      io.emit("comment:deleted", { id, taskId: comment.taskId });
    }
  });

  socket.on("comment:list", async (taskId: string) => {
    const comments = await store.getCommentsByTaskId(taskId);
    socket.emit("comment:listed", { taskId, comments });
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ===== Start =====
const PORT = process.env.PORT || 3002;

async function start() {
  await initDb();

  // Seed admin user if none exists
  const users = await store.getUsers();
  const hasAdmin = users.some((u) => u.role === "admin");
  if (!hasAdmin) {
    await store.createUser({
      id: uuidv4(),
      name: "Admin",
      email: "admin@taskque.com",
      passwordHash: await hashPassword("admin123"),
      avatar: "AD",
      color: "#3b82f6",
      role: "admin",
      createdAt: new Date().toISOString(),
    });
    console.log("✔ Admin criado: admin@taskque.com / admin123");
  }

  httpServer.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
