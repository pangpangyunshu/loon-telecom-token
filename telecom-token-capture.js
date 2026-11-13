/*
 * 电信营业厅 登录抓取（Loon 抓取端）
 * 拦截 POST /login/client/userLoginNormal 的响应，提取 token / userId
 * 存持久化存储 + 弹通知（点击通知直接打开复制页）
 */

const STORE_KEY = 'china_telecom_login_result';
const VIEW_URL = 'http://telecom-token.local/';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const m = s => (s ? String(s).slice(0, 10) + '…' : '(空)');

function pass() { $done({}); }

function pickResult(obj) {
  const layers = [obj, obj.responseData, isObj(obj.responseData) ? obj.responseData.data : null];
  for (const layer of layers) {
    if (isObj(layer) && isObj(layer.loginSuccessResult)) return layer.loginSuccessResult;
  }
  return null;
}

function main() {
  let raw = (typeof $response !== 'undefined' && $response.body) || '';
  raw = String(raw).replace(/^\uFEFF/, '').trim();
  if (!raw) { console.log('[电信] 响应体为空，检查 requires-body / max-size'); return pass(); }

  let obj = null;
  try { obj = JSON.parse(raw); } catch (e) { console.log('[电信] 非 JSON，跳过'); return pass(); }
  if (!isObj(obj)) return pass();

  const result = pickResult(obj);
  const resp = isObj(obj.responseData) ? obj.responseData : {};
  const code = resp.resultCode !== undefined ? String(resp.resultCode) : '';
  const desc = resp.resultDesc || '';

  if (!result || !result.token || !result.userId) {
    if (code === '122001') {
      console.log('[电信] 命中滑块 122001，请在 App 内手动拖滑块');
      $notification.post('电信登录', '需要滑块验证', '回到 App 手动完成后重新登录');
    } else if (code) {
      console.log('[电信] 无登录结果 resultCode=' + code + ' desc=' + desc);
    }
    return pass();
  }

  $persistentStore.write(JSON.stringify({ ts: Date.now(), data: result }), STORE_KEY);
  console.log('==== 电信登录结果 ====');
  console.log(JSON.stringify(result));
  console.log('======================');

  // 第 4 个参数带 url：点击通知直接打开复制页（Loon 不支持时会被忽略，不影响使用）
  $notification.post(
    '电信 Token 已抓取 ✓',
    'token ' + m(result.token) + '  userId ' + String(result.userId).slice(0, 10) + '…',
    '点击此通知打开复制页',
    { url: VIEW_URL }
  );

  return pass();
}

main();