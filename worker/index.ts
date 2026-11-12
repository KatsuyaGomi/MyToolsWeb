export function handleRequest(request: Request): Response {
  const { pathname } = new URL(request.url);

  if (pathname === '/api/health') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { Allow: 'GET, HEAD' } },
      );
    }

    return new Response(
      request.method === 'HEAD' ? null : JSON.stringify({ status: 'ok' }),
      { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export default { fetch: handleRequest } satisfies ExportedHandler;
