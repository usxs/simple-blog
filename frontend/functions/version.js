// 部署版本端点：返回当前 CF Pages 部署的短 id（如 ff70f0bb），前端侧边栏「节点」右侧展示。
export async function onRequestGet(context) {
  const env = (context && context.env) || {};
  let version = '';
  // 生产部署的 CF_PAGES_URL 形如 https://<deploy-id>.<project>.pages.dev
  const m = String(env.CF_PAGES_URL || '').match(/^https?:\/\/([a-z0-9]+)\./i);
  if (m) version = m[1];
  if (!version && env.CF_PAGES_COMMIT_SHA) version = String(env.CF_PAGES_COMMIT_SHA).slice(0, 8);
  const body = {
    ok: true,
    version: version || 'dev',
    branch: env.CF_PAGES_BRANCH || '',
    commit: env.CF_PAGES_COMMIT_SHA || ''
  };
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60'
    }
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET' || context.request.method === 'HEAD') return onRequestGet(context);
  return new Response('Method Not Allowed', { status: 405 });
}
