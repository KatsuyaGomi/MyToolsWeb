CREATE TABLE chatRoom (
  id TEXT PRIMARY KEY,
  groupId TEXT NOT NULL UNIQUE REFERENCES userGroup(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0,
  mutationId TEXT NOT NULL DEFAULT ''
);
CREATE TABLE chatMessage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roomId TEXT NOT NULL REFERENCES chatRoom(id) ON DELETE CASCADE,
  authorId TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  authorName TEXT NOT NULL,
  clientId TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(body) <= 2000),
  revision INTEGER NOT NULL DEFAULT 0,
  changeId INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  editedAt INTEGER,
  deletedAt INTEGER,
  UNIQUE(authorId, clientId)
);
CREATE INDEX chatMessage_room_id ON chatMessage(roomId, id);
CREATE INDEX chatMessage_changes ON chatMessage(roomId, changeId);
CREATE TABLE chatRead (
  roomId TEXT NOT NULL REFERENCES chatRoom(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  lastReadId INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(roomId, userId)
);
CREATE TABLE chatMute (
  roomId TEXT NOT NULL REFERENCES chatRoom(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  muted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(roomId, userId)
);
CREATE TABLE chatDevice (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  sessionId TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  activeRoomId TEXT,
  activeUntil INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX chatDevice_user ON chatDevice(userId);
CREATE TABLE chatPushJob (
  messageId INTEGER PRIMARY KEY REFERENCES chatMessage(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  nextAttemptAt INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE chatPushReceipt (
  messageId INTEGER NOT NULL REFERENCES chatMessage(id) ON DELETE CASCADE,
  deviceId TEXT NOT NULL,
  PRIMARY KEY(messageId, deviceId)
);
