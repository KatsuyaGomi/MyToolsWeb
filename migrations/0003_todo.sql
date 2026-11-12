-- 個人のボード全体を1行として保存し、revisionで端末間の更新競合を検出する。
-- 認証・既存ユーザーのデータは変更しない。
CREATE TABLE todoBoard (
  userId TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  content TEXT NOT NULL CHECK (json_valid(content)),
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
