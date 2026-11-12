CREATE TABLE calendarEvent (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  startAt TEXT NOT NULL,
  endAt TEXT NOT NULL CHECK (endAt > startAt),
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
  revision INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX calendarEvent_owner_start ON calendarEvent(userId, startAt);
CREATE INDEX calendarEvent_visibility_start ON calendarEvent(visibility, startAt);
