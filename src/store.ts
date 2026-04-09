import { prisma } from "./db.js";
import type { User, Task, Comment } from "./types.js";
import type { User as PrismaUser, Task as PrismaTask } from "./generated/prisma/client.js";

function toUser(row: PrismaUser): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email || "",
    avatar: row.avatar,
    color: row.color,
    role: row.role,
    active: row.active,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt.toISOString(),
  };
}

function toTask(row: PrismaTask): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assigneeId,
    startDate: row.startDate ? row.startDate.toISOString().split("T")[0] : null,
    endDate: row.endDate ? row.endDate.toISOString().split("T")[0] : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const store = {
  // Users
  async getUsers(): Promise<User[]> {
    const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toUser);
  },

  async getUserById(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? toUser(row) : null;
  },

  async getUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const row = await prisma.user.findUnique({ where: { email } });
    if (!row) return null;
    return { ...toUser(row), passwordHash: row.passwordHash || "" };
  },

  async createUser(data: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    avatar: string;
    color: string;
    role: "admin" | "member";
    active?: boolean;
    mustChangePassword?: boolean;
    createdAt: string;
  }): Promise<User> {
    const row = await prisma.user.create({
      data: {
        id: data.id,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        avatar: data.avatar,
        color: data.color,
        role: data.role,
        active: data.active ?? true,
        mustChangePassword: data.mustChangePassword ?? false,
        createdAt: new Date(data.createdAt),
      },
    });
    return toUser(row);
  },

  async updateUser(id: string, data: Partial<User & { passwordHash?: string }>): Promise<User | null> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.mustChangePassword !== undefined) updateData.mustChangePassword = data.mustChangePassword;
    if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;

    if (Object.keys(updateData).length === 0) return null;

    try {
      const row = await prisma.user.update({ where: { id }, data: updateData });
      return toUser(row);
    } catch {
      return null;
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  // Tasks
  async getTasks(): Promise<Task[]> {
    const rows = await prisma.task.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toTask);
  },

  async addTask(task: Task): Promise<Task> {
    const row = await prisma.task.create({
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        startDate: task.startDate ? new Date(task.startDate) : null,
        endDate: task.endDate ? new Date(task.endDate) : null,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
      },
    });
    return toTask(row);
  },

  async updateTask(id: string, data: Partial<Task>): Promise<Task | null> {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;

    try {
      const row = await prisma.task.update({ where: { id }, data: updateData });
      return toTask(row);
    } catch {
      return null;
    }
  },

  async deleteTask(id: string): Promise<boolean> {
    try {
      await prisma.task.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  // Comments
  async getCommentsByTaskId(taskId: string): Promise<Comment[]> {
    const rows = await prisma.comment.findMany({
      where: { taskId },
      include: { author: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      taskId: row.taskId,
      authorId: row.authorId,
      authorName: row.author.name,
      authorAvatar: row.author.avatar,
      authorColor: row.author.color,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  async addComment(data: { id: string; content: string; taskId: string; authorId: string }): Promise<Comment> {
    const row = await prisma.comment.create({
      data: {
        id: data.id,
        content: data.content,
        taskId: data.taskId,
        authorId: data.authorId,
      },
      include: { author: true },
    });
    return {
      id: row.id,
      content: row.content,
      taskId: row.taskId,
      authorId: row.authorId,
      authorName: row.author.name,
      authorAvatar: row.author.avatar,
      authorColor: row.author.color,
      createdAt: row.createdAt.toISOString(),
    };
  },

  async deleteComment(id: string): Promise<boolean> {
    try {
      await prisma.comment.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },
};
