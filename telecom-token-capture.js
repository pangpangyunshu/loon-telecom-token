/*
 * 电信营业厅 · 抓取 + 诊断（Loon）
 *   - 拦截 189 请求：记录 URL（诊断用）
 *   - 拦截 189 响应：记录状态与前 400 字节（诊断用）
 *   - 命中 userLoginNormal：提取 token/userId，存持久化并弹通知
 * 查看：http://telecom-token.local/      复制页
 *       http://telecom-token.local/diag 诊断日志
 * 一律原样放行，绝不改写响应。
 */

const STORE_KEY = 'china_telecom_login_result';
const DIAG_KEY = 'diag_log_v1';
const VIEW_URL = 'https://appgologin.189.cn:9031/token';
const MAX_LOG = 60;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const m = s => (s ? String(s).slice(0, 10) + '…' : '(空)');
const short = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; };

function clock() {
  const d = new Date(); const p = x => (x < 10 ? '0' + x : '' + x);
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function loadLog() {
  try { const s = $persistentStore.read(DIAG_KEY); const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}

function pushLog(entry) {
  try {
    const list = loadLog();
    list.push(entry);
    while (list.length > MAX_LOG) list.shift();
    $persistentStore.write(JSON.stringify(list), DIAG_KEY);
  } catch (e) {}
}

function pickResult(obj) {
  const layers = [obj, obj.responseData, isObj(obj.responseData) ? obj.responseData.data : null];
  for (const layer of layers) {
    if (isObj(layer) && isObj(layer.loginSuccessResult)) return layer.loginSuccessResult;
  }
  return null;
}

// 只处理 189 域名，避免规则写宽时把无关流量也记进来
function isTarget(url) {
  return !!/189\.cn/.test(url) || /dlife\.cn/.test(url);
}

// ---------- 请求阶段 ----------
function onRequest() {
  const url = ($request && $request.url) || '';
  if (!url || !isTarget(url)) return $done({});

  const body = ($request && $request.body) || '';
  const entry = { t: clock(), k: 'REQ', m: ($request.method || 'GET'), u: short(url, 240) };
  if (url.indexOf('appgologin.189.cn') !== -1 && body) entry.rqb = short(String(body).replace(/\s+/g, ' '), 500);
  pushLog(entry);
  console.log('[诊断] REQ ' + entry.m + ' ' + entry.u);
  return $done({});
}

// ---------- 响应阶段 ----------
function onResponse() {
  const url = ($response && $response.url) || ($request && $request.url) || '';
  if (!url) return $done({});
  if (!isTarget(url)) return $done({});

  const rawBody = ($response && $response.body) || '';
  const text = String(rawBody).replace(/^\uFEFF/, '');

  pushLog({
    t: clock(), k: 'RSP', s: ($response && $response.status) || 0,
    u: short(url, 240), len: text.length, b: short(text.replace(/\s+/g, ' '), 400),
  });
  console.log('[诊断] RSP ' + (($response && $response.status) || 0) + ' len=' + text.length + ' ' + short(url, 160));

  // 只处理登录接口
  if (url.indexOf('userLoginNormal') === -1) return $done({});

  if (!text) {
    console.log('[抓取] 登录响应体为空 —— 检查 requires-body=1 与 max-size');
    $notification.post('电信抓取', '响应体为空', '脚本拿不到 body，检查 max-size 配置');
    return $done({});
  }

  let obj = null;
  try { obj = JSON.parse(text); } catch (e) {
    console.log('[抓取] 登录响应不是 JSON：' + short(text, 200));
    return $done({});
  }
  if (!isObj(obj)) return $done({});

  const result = pickResult(obj);
  const resp = isObj(obj.responseData) ? obj.responseData : {};
  const code = resp.resultCode !== undefined ? String(resp.resultCode) : '';
  const desc = resp.resultDesc || '';

  if (!result || !result.token || !result.userId) {
    if (code === '122001') {
      console.log('[抓取] 命中滑块 122001');
      $notification.post('电信登录', '需要滑块验证', '回到 App 手动完成后重新登录');
    } else {
      console.log('[抓取] 无登录结果 code=' + code + ' desc=' + desc);
      $notification.post('电信登录', '未取到 token [' + code + ']', short(desc, 40) || '点开查看');
    }
    return $done({});
  }

  $persistentStore.write(JSON.stringify({ ts: Date.now(), data: result }), STORE_KEY);
  console.log('==== 电信登录结果 ====');
  console.log(JSON.stringify(result));

  $notification.post(
    '电信 Token 已抓取 ✓',
    'token ' + m(result.token) + '  userId ' + String(result.userId).slice(0, 10) + '…',
    '点击此通知打开复制页',
    { url: VIEW_URL }
  );
  return $done({});
}

if (typeof $response !== 'undefined' && $response) onResponse();
else onRequest();