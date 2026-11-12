-- 管理者ロールと、初期管理者を一度だけ作成するための状態。
ALTER TABLE "user" ADD COLUMN "role" TEXT DEFAULT 'user';
ALTER TABLE "user" ADD COLUMN "banned" INTEGER DEFAULT 0;
ALTER TABLE "user" ADD COLUMN "banReason" TEXT;
ALTER TABLE "user" ADD COLUMN "banExpires" DATE;
ALTER TABLE "session" ADD COLUMN "impersonatedBy" TEXT;

CREATE TABLE "adminSetup" (
  "id" INTEGER NOT NULL PRIMARY KEY CHECK ("id" = 1),
  "tokenHash" TEXT NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "usedAt" INTEGER
);
