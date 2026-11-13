-- 既存ユーザーを自動でグループへ追加しない。
-- 未所属のPublic予定は、この変更後は本人のみが閲覧できる。
CREATE TABLE userGroup (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(name) BETWEEN 1 AND 60)
);
CREATE TABLE groupMembership (
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  groupId TEXT NOT NULL REFERENCES userGroup(id) ON DELETE CASCADE,
  PRIMARY KEY (userId, groupId)
);
CREATE INDEX groupMembership_group ON groupMembership(groupId, userId);
CREATE TABLE groupSettings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  mutationId TEXT NOT NULL DEFAULT ''
);
INSERT INTO groupSettings(id) VALUES (1);
