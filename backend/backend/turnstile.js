/**
 * Cloudflare Turnstile 服务端校验（零依赖，Node 22+）。
 *
 * 只有同时配置 TURNSTILE_SITE_KEY 与 TURNSTILE_SECRET_KEY 时才启用；
 * 未配置时评论继续走算术验证码，友链保持原有的频率限制。
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 5000;

function config(env) {
  const source = env || process.env;
  const siteKey = String(source.TURNSTILE_SITE_KEY || '').trim();
  const secret = String(source.TURNSTILE_SECRET_KEY || '').trim();
  return {
    enabled: Boolean(siteKey && secret),
    siteKey,
    secret
  };
}

/**
 * 校验前端提交的 Turnstile token。
 * @param {{ token?: string, ip?: string, action?: string, env?: NodeJS.ProcessEnv }} input
 * @returns {Promise<{ok: boolean, skipped?: boolean, unavailable?: boolean, error?: string}>}
 */
async function verify(input) {
  const options = input || {};
  const cfg = config(options.env);
  if (!cfg.enabled) return { ok: true, skipped: true };

  const token = String(options.token || '').trim();
  if (!token || token.length > 4096) {
    return { ok: false, error: '请先完成人机验证' };
  }

  const form = new URLSearchParams();
  form.set('secret', cfg.secret);
  form.set('response', token);
  const ip = String(options.ip || '').trim();
  if (ip && ip !== 'unknown') form.set('remoteip', ip);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: form,
      signal: controller.signal
    });
    if (!response.ok) {
      return { ok: false, unavailable: true, error: '人机验证服务暂时不可用，请稍后再试' };
    }
    const data = await response.json();
    if (!data || data.success !== true) {
      return { ok: false, error: '人机验证未通过，请重试' };
    }
    // Cloudflare 的公开测试密钥不会返回 action；仅测试模式放行，生产密钥不会出现该标记。
    const testToken = Boolean(data.metadata && data.metadata.result_with_testing_key);
    if (!testToken && options.action && data.action !== options.action) {
      return { ok: false, error: '人机验证校验失败，请重试' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, unavailable: true, error: '人机验证服务暂时不可用，请稍后再试' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { config, verify };
