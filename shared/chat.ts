export interface ChatRoom {
  id: string;
  name: string;
  unread: number;
  muted: boolean;
}

export interface ChatMessage {
  id: number;
  roomId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  revision: number;
  changeId: number;
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
}

export interface ChatReader {
  id: string;
  name: string;
  lastReadId: number;
}

export interface ChatSnapshot {
  messages: ChatMessage[];
  readers: ChatReader[];
  version: number;
  hasMore: boolean;
}
