import { Hono } from 'hono';
import { handleAdminUsers, isOwnerAdmin } from '../auth/adminApi.ts';
import { handleTodo } from '../tools/todo/api.ts';
import { handleCalendar } from '../tools/calendar/api.ts';
import { requireSession } from './middleware.ts';
import type { AppEnv } from './types.ts';

// このサブルーターに追加したAPIは、必ずセッション確認を通る。
export const privateRoutes = new Hono<AppEnv>();
privateRoutes.use('*', requireSession);

privateRoutes.all('/admin/users', /**
 * 管理者本人だけにアカウント管理を委譲する。
 * @param context 検証済みセッションを持つContext。
 * @returns ユーザー管理APIの応答。
 */ (context) => handleAdminUsers(context.req.raw, context.get('auth'), context.get('session'), context.env));

privateRoutes.all('/todo', /**
 * 所有者をセッションに固定してTodo処理へ渡す。
 * @param context 検証済みContext。
 * @returns Todo APIの応答。
 */ (context) => handleTodo(context.req.raw, context.env.DB!, context.get('session').user.id));

privateRoutes.all('/calendar', /**
 * 閲覧者をセッションに固定してカレンダー処理へ渡す。
 * @param context 検証済みContext。
 * @returns カレンダーAPIの応答。
 */ (context) => handleCalendar(context.req.raw, context.env.DB!, context.get('session').user.id));

privateRoutes.get('/me', /**
 * ログイン中のユーザー情報と管理者判定を返す。
 * @param context 検証済みContext。
 * @returns 公開可能な本人情報。
 */ (context) => {
  const session = context.get('session');
  return context.json({
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    isAdmin: isOwnerAdmin(session, context.env),
  });
});
