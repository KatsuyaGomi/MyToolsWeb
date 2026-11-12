import { createAuthClient } from 'better-auth/react';

// アプリと同じオリジンの /api/auth を使用し、秘密鍵はブラウザーへ渡さない。
export const authClient = createAuthClient();
