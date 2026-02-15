import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { persist } from 'zustand/middleware';
import { UniqueIdentifier } from '@dnd-kit/core';
import { Column } from '../components/board-column';

export type Status = 'TODO' | 'IN_PROGRESS' | 'DONE';

const defaultCols = [
  {
    id: 'TODO' as const,
    title: '待办'
  },
  {
    id: 'IN_PROGRESS' as const,
    title: '进行中'
  },
  {
    id: 'DONE' as const,
    title: '已完成'
  }
] satisfies Column[];

export type ColumnId = (typeof defaultCols)[number]['id'];

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: Status;
};

export type State = {
  tasks: Task[];
  columns: Column[];
  draggedTask: string | null;
};

const initialTasks: Task[] = [
  {
    id: 'task1',
    status: 'TODO',
    title: '设计系统信息架构',
    description: '梳理后台菜单、路由和权限模型。'
  },
  {
    id: 'task2',
    status: 'TODO',
    title: '搭建用户与角色管理模块',
    description: '创建用户列表、角色与权限分配等基础功能。'
  },
  {
    id: 'task3',
    status: 'IN_PROGRESS',
    title: '集成登录与鉴权方案',
    description: '接入 Clerk 或自建认证系统，并配置受保护路由。'
  },
  {
    id: 'task4',
    status: 'DONE',
    title: '初始化管理后台模板',
    description: '基于 Next Shadcn 模板创建工程并完成中文本地化。'
  }
];

export type Actions = {
  addTask: (title: string, description?: string) => void;
  addCol: (title: string) => void;
  dragTask: (id: string | null) => void;
  removeTask: (title: string) => void;
  removeCol: (id: UniqueIdentifier) => void;
  setTasks: (updatedTask: Task[]) => void;
  setCols: (cols: Column[]) => void;
  updateCol: (id: UniqueIdentifier, newName: string) => void;
};

export const useTaskStore = create<State & Actions>()(
  persist(
    (set) => ({
      tasks: initialTasks,
      columns: defaultCols,
      draggedTask: null,
      addTask: (title: string, description?: string) =>
        set((state) => ({
          tasks: [
            ...state.tasks,
            { id: uuid(), title, description, status: 'TODO' }
          ]
        })),
      updateCol: (id: UniqueIdentifier, newName: string) =>
        set((state) => ({
          columns: state.columns.map((col) =>
            col.id === id ? { ...col, title: newName } : col
          )
        })),
      addCol: (title: string) =>
        set((state) => ({
          columns: [
            ...state.columns,
            { title, id: state.columns.length ? title.toUpperCase() : 'TODO' }
          ]
        })),
      dragTask: (id: string | null) => set({ draggedTask: id }),
      removeTask: (id: string) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id)
        })),
      removeCol: (id: UniqueIdentifier) =>
        set((state) => ({
          columns: state.columns.filter((col) => col.id !== id)
        })),
      setTasks: (newTasks: Task[]) => set({ tasks: newTasks }),
      setCols: (newCols: Column[]) => set({ columns: newCols })
    }),
    {
      name: 'task-store',
      version: 1,
      migrate: (persisted) => {
        const v = persisted as Partial<State> | undefined | null;
        return {
          tasks: Array.isArray(v?.tasks) ? (v?.tasks as Task[]) : initialTasks,
          columns: Array.isArray(v?.columns) ? (v?.columns as Column[]) : defaultCols,
          draggedTask: typeof v?.draggedTask === 'string' || v?.draggedTask === null ? v.draggedTask : null
        } satisfies State;
      },
      skipHydration: true
    }
  )
);
