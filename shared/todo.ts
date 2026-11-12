export const priorities = { urgent: '緊急', high: '高', normal: '通常', low: '低' } as const;
export const statusColors = { blue: '青', amber: '黄', green: '緑', purple: '紫', gray: '灰' } as const;
export type Priority = keyof typeof priorities;
export type StatusColor = keyof typeof statusColors;

export interface TodoStatus {
  id: string;
  name: string;
  color: StatusColor;
}

export interface TodoTask {
  id: string;
  statusId: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
}

export interface TodoBoard {
  revision: number;
  statuses: TodoStatus[];
  // 配列の順番が各列内の優先順。上にあるタスクほど先に取り組む。
  tasks: TodoTask[];
}
