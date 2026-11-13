/*
 * 电信营业厅 · 登录态抓取（Loon 抓取端）
 *
 * 做什么：
 *   1) 在请求阶段截住 POST /login/client/userLoginNormal，从请求体里还原出手机号
 *      （电信把手机号做了「每字符 +2」的混淆，这里反解回来，用于电脑端自动匹配账号）
 *   2) 在响应阶段解析 loginSuccessResult，取出 token / userId
 *   3) 全部存进 Loon 持久化存储，然后弹通知；点通知直接打开复制页
 *   4) 一律 $done({}) 原样放行，绝不改写 App 的响应，不影响 App 自身登录
 *
 * 抓不到时看诊断页：https://appgologin.189.cn:9031/diag
 */

const KEY_RESULT = 'ct_login_result_v2';   // 抓到的登录态
const KEY_DIAG = 'ct_diag_v1';             // 诊断日志
const KEY_PHONE = 'ct_last_phone';         // 请求阶段解析出的手机号
const VIEW_URL = 'https://appgologin.189.cn:9031/token';
const DIAG_URL = 'https://appgologin.189.cn:9031/diag';
const LOGIN_PATH = '/login/client/userLoginNormal';
const MAX_DIAG = 40;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const short = (s, n) => {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n) + '…' : s;
};
const masked = s => (s ? String(s).slice(0, 3) + '****' + String(s).slice(-4) : '');

function clock() {
  const d = new Date();
  const p = x => (x < 10 ? '0' + x : '' + x);
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

/* ---------- 持久化 ---------- */

function storeRead(key) {
  try { return $persistentStore.read(key); } catch (e) { return null; }
}

function storeWrite(value, key) {
  try { $persistentStore.write(value, key); } catch (e) {}
}

function pushDiag(entry) {
  let list = [];
  try {
    const s = storeRead(KEY_DIAG);
    list = s ? JSON.parse(s) : [];
    if (!Array.isArray(list)) list = [];
  } catch (e) { list = []; }
  list.push(entry);
  while (list.length > MAX_DIAG) list.shift();
  storeWrite(JSON.stringify(list), KEY_DIAG);
}

/* ---------- 手机号还原 ---------- */

// 电信对手机号做「每字符 +2」的混淆，这里反解
function unshift2(s) {
  if (!s) return '';
  const str = String(s);
  let out = '';
  for (let i = 0; i < str.length; i++) out += String.fromCharCode(str.charCodeAt(i) - 2);
  return out;
}

const isPhone = s => /^1\d{10}$/.test(String(s == null ? '' : s).trim());

function phoneFromRequestBody(body) {
  if (!body) return '';
  const text = String(body);

  // ① 结构化取字段，再反解
  try {
    const obj = JSON.parse(text);
    if (isObj(obj)) {
      const fd = (isObj(obj.content) && isObj(obj.content.fieldData)) ? obj.content.fieldData : {};
      const hi = isObj(obj.headerInfos) ? obj.headerInfos : {};
      const cands = [fd.phoneNum, hi.userLoginName, fd.account, fd.phone];
      for (const c of cands) {
        if (!c) continue;
        const d = unshift2(c);
        if (isPhone(d)) return d.trim();
        if (isPhone(c)) return String(c).trim();
      }
    }
  } catch (e) {
    // 不是 JSON 就走下面的正则兜底
  }

  // ② 兜底：整段反解后找 11 位手机号
  const m = unshift2(text).match(/1[3-9]\d{9}/);
  return m ? m[0] : '';
}

/* ---------- 登录结果定位 ---------- */

function digResult(obj, depth) {
  depth = depth || 0;
  if (!isObj(obj) || depth > 6) return null;
  if (isObj(obj.loginSuccessResult)) return obj.loginSuccessResult;
  if (obj.token && obj.userId) return obj;
  for (const k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    const hit = digResult(obj[k], depth + 1);
    if (hit) return hit;
  }
  return null;
}

function isLoginUrl(url) {
  return String(url || '').indexOf(LOGIN_PATH) !== -1;
}

/* ---------- 请求阶段：只为拿手机号 ---------- */

function onRequest() {
  const url = ($request && $request.url) || '';
  const isLogin = isLoginUrl(url);
  const body = ($request && $request.body) || '';
  // 心跳：只要脚本被触发就记一笔，诊断页靠它判断「脚本活着没有」
  storeWrite(JSON.stringify({ ts: Date.now(), what: 'REQ ' + short(url, 100) }), 'ct_alive');

  let phone = '';
  if (isLogin) {
    phone = phoneFromRequestBody(body);
    if (phone) {
      storeWrite(phone, KEY_PHONE);
      console.log('[抓取] 登录请求手机号 ' + masked(phone));
    } else {
      console.log('[抓取] 登录请求里没解析到手机号（body 长度 ' + String(body).length + '）');
    }
  }
  pushDiag({
    t: clock(), k: 'REQ', u: short(url, 200), login: isLogin,
    phone: masked(phone), len: String(body).length,
  });
  return $done({});
}

/* ---------- 响应阶段：抓 token ---------- */

function onResponse() {
  const url = ($response && $response.url) || ($request && $request.url) || '';
  storeWrite(JSON.stringify({ ts: Date.now(), what: 'RSP ' + short(url, 100) }), 'ct_alive');
  if (!isLoginUrl(url)) {
    // 非登录接口：只留一条足迹，证明脚本确实被触发过
    pushDiag({
      t: clock(), k: 'RSP', u: short(url, 200), s: ($response && $response.status) || 0,
      len: String(($response && $response.body) || '').length, b: '',
    });
    return $done({});
  }

  const rawBody = ($response && $response.body) || '';
  const text = String(rawBody).replace(/^\uFEFF/, '').trim();
  const status = ($response && $response.status) || 0;

  pushDiag({
    t: clock(), k: 'RSP', u: short(url, 200), s: status,
    len: text.length, b: short(text.replace(/\s+/g, ' '), 300),
  });

  if (!text) {
    console.log('[抓取] 响应体为空：检查插件里 requires-body=1 与 max-size');
    $notification.post('电信抓取失败', '响应体为空', '检查插件 max-size / MITM 是否生效');
    return $done({});
  }

  let obj = null;
  try { obj = JSON.parse(text); } catch (e) { obj = null; }
  if (!isObj(obj)) {
    console.log('[抓取] 响应不是 JSON：' + short(text, 160));
    return $done({});
  }

  const resp = isObj(obj.responseData) ? obj.responseData : {};
  const code = resp.resultCode !== undefined ? String(resp.resultCode) : '';
  const desc = resp.resultDesc || '';
  const result = digResult(obj, 0);

  if (!result || !result.token || !result.userId) {
    if (code === '122001') {
      console.log('[抓取] 命中滑块 122001');
      $notification.post('电信登录', '需要滑块验证', '回 App 手动拖滑块完成登录，完成后会自动抓取');
    } else {
      console.log('[抓取] 无 token code=' + code + ' desc=' + desc);
      $notification.post('电信登录未成功', '[' + (code || '?') + '] ' + short(desc, 30),
        '打开诊断页看请求记录：' + DIAG_URL);
    }
    return $done({});
  }

  // 手机号：优先请求阶段解析的，其次响应里明文的
  let phone = storeRead(KEY_PHONE) || '';
  phone = String(phone).trim();
  if (!isPhone(phone)) {
    const cands = [result.phoneNum, result.phone, result.mobile, result.loginName];
    phone = '';
    for (const c of cands) {
      if (c && isPhone(c)) { phone = String(c).trim(); break; }
    }
  }

  storeWrite(JSON.stringify({
    ts: Date.now(),
    phone: phone,
    data: result,
  }), KEY_RESULT);

  console.log('======== 电信登录结果 ========');
  console.log('phone=' + (phone || '(未取到)'));
  console.log(JSON.stringify(result));
  console.log('=============================');

  $notification.post(
    '电信 Token 已抓取 ✓',
    (phone ? masked(phone) + '  ' : '') + 'userId ' + short(result.userId, 10),
    '点此通知打开复制页，一键复制 JSON',
    { url: VIEW_URL }
  );
  return $done({});
}

/* ---------- 入口 ---------- */

if (typeof $response !== 'undefined' && $response) onResponse();
else onRequest();