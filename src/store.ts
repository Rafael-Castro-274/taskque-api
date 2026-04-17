import { prisma } from "./db.js";
import type { User, Task, Comment, Project, TaskBranch, Subtask } from "./types.js";
import type { User as PrismaUser, Task as PrismaTask, Project as PrismaProject } from "./generated/prisma/client.js";

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

function toTask(row: PrismaTask & {
  branches?: Array<{ id: string; taskId: string; projectId: string; branchName: string; createdAt: Date; project: PrismaProject }>;
  subtasks?: Array<{ id: string; title: string; done: boolean; taskId: string; createdAt: Date }>;
}): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assigneeId,
    branches: (row.branches || []).map((b) => ({
      id: b.id,
      taskId: b.taskId,
      projectId: b.projectId,
      projectName: b.project.name,
      branchName: b.branchName,
      createdAt: b.createdAt.toISOString(),
    })),
    subtasks: (row.subtasks || []).map((s) => ({
      id: s.id,
      title: s.title,
      done: s.done,
      taskId: s.taskId,
      createdAt: s.createdAt.toISOString(),
    })),
    startDate: row.startDate ? row.startDate.toISOString().split("T")[0] : null,
    endDate: row.endDate ? row.endDate.toISOString().split("T")[0] : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toProject(row: PrismaProject): Project {
  return {
    id: row.id,
    name: row.name,
    githubOwner: row.githubOwner,
    githubRepo: row.githubRepo,
    defaultBranch: row.defaultBranch,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
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
    const rows = await prisma.task.findMany({
      orderBy: { createdAt: "asc" },
      include: { branches: { include: { project: true } }, subtasks: { orderBy: { createdAt: "asc" } } },
    });
    return rows.map(toTask);
  },

  async addTask(task: Omit<Task, "branches"> & { branches?: TaskBranch[] }): Promise<Task> {
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
      include: { branches: { include: { project: true } }, subtasks: { orderBy: { createdAt: "asc" } } },
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
      const row = await prisma.task.update({
        where: { id },
        data: updateData,
        include: { branches: { include: { project: true } }, subtasks: { orderBy: { createdAt: "asc" } } },
      });
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

  // Projects
  async getProjects(): Promise<Project[]> {
    const rows = await prisma.project.findMany({ orderBy: { name: "asc" } });
    return rows.map(toProject);
  },

  async getActiveProjects(): Promise<Project[]> {
    const rows = await prisma.project.findMany({ where: { active: true }, orderBy: { name: "asc" } });
    return rows.map(toProject);
  },

  async getProjectById(id: string): Promise<Project | null> {
    const row = await prisma.project.findUnique({ where: { id } });
    return row ? toProject(row) : null;
  },

  async createProject(data: { id: string; name: string; githubOwner: string; githubRepo: string; defaultBranch: string }): Promise<Project> {
    const row = await prisma.project.create({ data });
    return toProject(row);
  },

  async updateProject(id: string, data: Partial<Pick<Project, "name" | "githubOwner" | "githubRepo" | "defaultBranch" | "active">>): Promise<Project | null> {
    try {
      const row = await prisma.project.update({ where: { id }, data });
      return toProject(row);
    } catch {
      return null;
    }
  },

  async deleteProject(id: string): Promise<boolean> {
    try {
      await prisma.project.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  // Task Branches
  async addTaskBranch(data: { id: string; taskId: string; projectId: string; branchName: string }): Promise<TaskBranch> {
    const row = await prisma.taskBranch.create({
      data,
      include: { project: true },
    });
    return {
      id: row.id,
      taskId: row.taskId,
      projectId: row.projectId,
      projectName: row.project.name,
      branchName: row.branchName,
      createdAt: row.createdAt.toISOString(),
    };
  },

  // Subtasks
  async addSubtask(data: { id: string; title: string; taskId: string }): Promise<Subtask> {
    const row = await prisma.subtask.create({ data });
    return { id: row.id, title: row.title, done: row.done, taskId: row.taskId, createdAt: row.createdAt.toISOString() };
  },

  async toggleSubtask(id: string): Promise<Subtask | null> {
    try {
      const current = await prisma.subtask.findUnique({ where: { id } });
      if (!current) return null;
      const row = await prisma.subtask.update({ where: { id }, data: { done: !current.done } });
      return { id: row.id, title: row.title, done: row.done, taskId: row.taskId, createdAt: row.createdAt.toISOString() };
    } catch {
      return null;
    }
  },

  async deleteSubtask(id: string): Promise<boolean> {
    try {
      await prisma.subtask.delete({ where: { id } });
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
