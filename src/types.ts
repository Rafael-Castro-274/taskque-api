export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  color: string;
  role: "admin" | "member";
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export type Developer = User;

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  taskId: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "backlog" | "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigneeId: string | null;
  branches: TaskBranch[];
  subtasks: Subtask[];
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  githubOwner: string;
  githubRepo: string;
  defaultBranch: string;
  active: boolean;
  createdAt: string;
}

export interface TaskBranch {
  id: string;
  taskId: string;
  projectId: string;
  projectName: string;
  branchName: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorColor: string;
  createdAt: string;
}

export type TaskStatus = Task["status"];
export type TaskPriority = Task["priority"];

export const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "A Fazer" },
  { key: "in_progress", label: "Em Progresso" },
  { key: "review", label: "Revisão" },
  { key: "done", label: "Concluído" },
];
