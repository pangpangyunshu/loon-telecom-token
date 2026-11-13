/*
 * 电信营业厅 · 查看页 / 诊断页（Loon 查看端）
 *
 *   https://appgologin.189.cn:9031/token   显示抓到的手机号 / token / userId，一键复制 JSON
 *   https://appgologin.189.cn:9031/diag    显示登录请求与响应的摘要（抓不到时排查用）
 *
 * 为什么页面挂在 appgologin.189.cn 上：这个域名本身可达、且 MITM 已覆盖；
 * 早期的 http://telecom-token.local/ 会被 iOS 的 mDNS 直接接管，脚本永远不触发。
 */

const KEY_RESULT = 'ct_login_result_v2';
const KEY_DIAG = 'ct_diag_v1';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmt(ts) {
  if (!ts) return '未知';
  const d = new Date(ts);
  const p = n => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function maskPhone(p) {
  p = String(p || '');
  return p.length === 11 ? p.slice(0, 3) + '****' + p.slice(-4) : p;
}

function shell(title, inner) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<style>
  :root{color-scheme:light dark}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;padding:16px;font:15px/1.55 -apple-system,"PingFang SC",sans-serif;background:#f2f2f7;color:#111}
  @media(prefers-color-scheme:dark){
    body{background:#000;color:#f2f2f7}
    .card{background:#1c1c1e!important;box-shadow:none!important}
    .mono.value,textarea,.drow{background:#2c2c2e!important;color:#f2f2f7!important}
    .tip,.small{color:#aeaeb2!important}
  }
  h1{font-size:19px;margin:4px 0 14px}
  .card{background:#fff;border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .label{font-size:12px;color:#8e8e93;margin:12px 0 6px;letter-spacing:.3px}
  .label:first-child{margin-top:0}
  .mono{font-family:ui-monospace,Menlo,monospace;word-break:break-all}
  .mono.value{background:#f2f2f7;border-radius:9px;padding:10px 12px;font-size:13px;-webkit-user-select:all;user-select:all}
  .small{font-size:12px;color:#8e8e93}
  textarea{width:100%;border:none;border-radius:9px;padding:10px 12px;font-family:ui-monospace,Menlo,monospace;font-size:12px;background:#f2f2f7;color:#111;resize:vertical;word-break:break-all}
  .btn{width:100%;margin-top:8px;padding:11px 12px;font-size:15px;border:none;border-radius:10px;background:#e5e5ea;color:#007aff;font-weight:600;cursor:pointer;font-family:inherit}
  .btn:active{opacity:.6}.btn.primary{background:#007aff;color:#fff}
  .empty{text-align:center;padding:22px 8px;color:#8e8e93;font-size:14px}
  .tip{font-size:13px;color:#3c3c43}
  .warn{margin-top:8px;padding:9px 11px;border-radius:9px;background:rgba(255,149,0,.16);color:#c96a00;font-size:12.5px}
  .ok{margin-top:8px;padding:9px 11px;border-radius:9px;background:rgba(52,199,89,.16);color:#248a3d;font-size:12.5px}
  .drow{background:#f7f7fa;border-radius:9px;padding:9px 11px;margin-bottom:7px;font:12px/1.5 ui-monospace,Menlo,monospace;word-break:break-all}
  .dreq{border-left:3px solid #ff9500}.drsp{border-left:3px solid #34c759}
  .dh{color:#8e8e93;font-size:11px}
</style></head>
<body><h1>${esc(title)}</h1>${inner}
<script>
function copyText(text,btn){
  function done(){if(!btn)return;var o=btn.textContent;btn.textContent='已复制 ✓';setTimeout(function(){btn.textContent=o;},1300);}
  function fallback(){
    var ta=document.getElementById('raw');
    if(!ta){alert('请手动长按选中复制');return;}
    ta.value=text;
    ta.removeAttribute('readonly');ta.focus();ta.select();
    try{ta.setSelectionRange(0,ta.value.length);}catch(e){}
    try{document.execCommand('copy');done();}catch(e){alert('请手动长按选中复制');}
    ta.setAttribute('readonly','readonly');
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(fallback);
  }else{fallback();}
}
</script></body></html>`;
}

function tokenPage(rec) {
  const data = (rec && rec.data) || null;
  const ok = data && data.token && data.userId;
  const phone = (rec && rec.phone) || '';
  const stale = ok && rec.ts && (Date.now() - rec.ts > 6 * 3600 * 1000);

  if (!ok) {
    return shell('电信登录结果', `
  <div class="card"><div class="empty">
    还没有抓到登录结果。<br><br>
    请在「电信营业厅」App 里<b>退出登录</b>，再重新登录一次（滑块该拖就拖）。<br><br>
    抓不到就去 <span class="mono">/diag</span> 看诊断日志。
  </div></div>
  <div class="card tip">
    <b>检查清单</b><br>
    1. Loon 里这个插件是启用状态<br>
    2. MitM 已开启，且证书已安装并在「证书信任设置」里打开<br>
    3. App 是<b>退出登录后重新登录</b>，不是切回已登录状态
  </div>`);
  }

  // 给电脑端用的最小 JSON：手机号 + token + userId
  const minimal = JSON.stringify({ phone: phone, token: data.token, userId: data.userId });
  const full = JSON.stringify({ ts: rec.ts, phone: phone, data: data });

  return `
  <div class="card">
    <div class="label">抓取时间</div>
    <div class="mono small">${esc(fmt(rec.ts))}</div>
    ${stale ? '<div class="warn">⚠️ 已超过 6 小时，token 可能失效，建议重新抓一次</div>' : '<div class="ok">✓ 抓取成功</div>'}
    <div class="label">手机号${phone ? '' : '（未解析到，注入时需手填）'}</div>
    <div class="mono value">${esc(phone ? maskPhone(phone) : '—')}</div>
    <div class="label">token</div>
    <div class="mono value" id="tk">${esc(data.token)}</div>
    <button class="btn" onclick="copyText(document.getElementById('tk').textContent,this)">复制 token</button>
    <div class="label">userId</div>
    <div class="mono value" id="uid">${esc(data.userId)}</div>
    <button class="btn" onclick="copyText(document.getElementById('uid').textContent,this)">复制 userId</button>
  </div>
  <div class="card">
    <div class="label">给电脑端用的 JSON（推荐复制这个）</div>
    <textarea id="raw" readonly rows="5">${esc(minimal)}</textarea>
    <button class="btn primary" onclick="copyText(${JSON.stringify(minimal)},this)">一键复制 JSON</button>
    <button class="btn" onclick="copyText(${JSON.stringify(full)},this)">复制完整 JSON（含字段）</button>
  </div>
  <div class="card tip">
    <b>接着做：</b><br>
    1. 复制上面的 JSON，通过微信/隔空投送到电脑<br>
    2. 存成脚本目录下的 <span class="mono">token.txt</span><br>
    3. 直接跑主脚本，它会自动读进去（不需要再手动跑注入工具）
  </div>`;
}

function aliveBlock(alive) {
  if (alive && alive.ts) {
    return `<div class="card">
    <div class="label">脚本运行状态</div>
    <div class="ok">✓ 抓取脚本已经被触发过</div>
    <div class="small">最近一次：${esc(fmt(alive.ts))} · ${esc(alive.what || '')}</div>
    <div class="small">说明插件规则和脚本都生效了，剩下只差「有没有抓到登录接口」。</div>
  </div>`;
  }
  return `<div class="card">
    <div class="label">脚本运行状态</div>
    <div class="warn">✗ 抓取脚本从未被触发</div>
    <div class="small">App 的请求根本没进到脚本里，按顺序查：</div>
    <div class="small">1) 插件是否启用　2) MitM 开关是否打开</div>
    <div class="small">3) 证书是否安装并在「证书信任设置」里信任</div>
    <div class="small">4) App 是否走了别的域名，或用了 QUIC（HTTP/3）</div>
  </div>`;
}


function diagPage(list, alive) {
  const head = aliveBlock(alive);
  const items = Array.isArray(list) ? list.slice().reverse() : [];
  if (!items.length) {
    return shell('诊断日志', `${head}
  <div class="card"><div class="empty">
    还没有请求记录。<br><br>
    1. 在 App 里退出登录并重新登录一次<br>
    2. 回到这个页面刷新
  </div></div>`);
  }

  const plain = items.map(e => e.k === 'REQ'
    ? `[${e.t}] REQ ${e.u}  phone=${e.phone || '-'}  bodylen=${e.len || 0}`
    : `[${e.t}] RSP ${e.s}  len=${e.len || 0}  ${e.u}\n        ${e.b || ''}`
  ).join('\n');

  const rows = items.map(e => e.k === 'REQ'
    ? `<div class="drow dreq"><span class="dh">${esc(e.t)} REQ${e.login ? ' · 登录接口' : ''}</span><br>${esc(e.u)}<br><span class="dh">phone=${esc(e.phone || '-')} · body ${esc(e.len || 0)}B</span></div>`
    : `<div class="drow drsp"><span class="dh">${esc(e.t)} RSP ${esc(e.s)} · ${esc(e.len || 0)}B</span><br>${esc(e.u)}<br><span class="dh">${esc(e.b || '')}</span></div>`
  ).join('');

  const hasLogin = items.some(e => e.login || String(e.u || '').indexOf('userLoginNormal') !== -1);
  const tip = hasLogin
    ? '看到了 userLoginNormal：脚本已经看到登录请求。没有 token 就看对应 RSP 的 resultCode，122001 就是滑块。'
    : '没有 userLoginNormal：脚本在跑，但 App 登录没走这个接口，或没有真正「退出后重新登录」。';

  return shell('诊断日志', `${head}
  <div class="card">
    <div class="label">最近 ${items.length} 条（新的在上）</div>
    <textarea id="raw" readonly rows="7">${esc(plain)}</textarea>
    <button class="btn primary" onclick="copyText(document.getElementById('raw').value,this)">复制全部日志</button>
  </div>
  <div class="card"><div class="label">明细</div>${rows}</div>
  <div class="card tip">${esc(tip)}</div>`);
}

function main() {
  const url = (typeof $request !== 'undefined' && $request.url) || '';
  const isPush = url.indexOf('/push') !== -1;
  if (!isPush && url.indexOf('/token') === -1 && url.indexOf('/diag') === -1) return $done({});

  let body;
  if (url.indexOf('/push') !== -1) {
    const m = url.match(/[?&]url=([^&]*)/);
    const target = m ? decodeURIComponent(m[1]) : '';
    if (!target) {
      let cur = '';
      try { cur = String($persistentStore.read('ct_push') || ''); } catch (e) { cur = ''; }
      body = shell('调试推送设置', `
  <div class="card">
    <div class="label">当前推送地址</div>
    <div class="mono value">${esc(cur || '（未设置）')}</div>
  </div>
  <div class="card tip">
    <b>怎么设置</b><br>
    1. 电脑上运行调试接收端，记下它打印的那行地址；<br>
    2. 手机 Safari 打开下面格式的网址：<br>
    <span class="mono">http://ct-token.com/push?url=http://电脑IP:8899/</span><br>
    3. 回 App 退出登录 → 重新登录，数据就会实时发到电脑上。
  </div>`);
    } else {
      try { $persistentStore.write(target, 'ct_push'); } catch (e) {}
      body = shell('调试推送已设置', `
  <div class="card">
    <div class="ok">✓ 已保存推送地址</div>
    <div class="mono value">${esc(target)}</div>
    <div class="small">现在去 App 里退出登录 → 重新登录，电脑上的接收端会逐条打印。</div>
  </div>
  <div class="card tip">清空：打开 <span class="mono">/push?url=</span> 重新设置，或卸载插件。</div>`);
    }
    return $done({ status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, body: body });
  }
  if (url.indexOf('/diag') !== -1) {
    let list = [];
    try {
      const s = $persistentStore.read(KEY_DIAG);
      list = s ? JSON.parse(s) : [];
    } catch (e) { list = []; }
    let alive = null;
    try {
      const a = $persistentStore.read('ct_alive');
      if (a) alive = JSON.parse(a);
    } catch (e) { alive = null; }
    body = diagPage(list, alive);
  } else {
    let rec = null;
    try {
      const s = $persistentStore.read(KEY_RESULT);
      if (s) rec = JSON.parse(s);
    } catch (e) { rec = null; }
    // 兼容老版本直接存 {token,userId} 的情况
    if (rec && !rec.data && rec.token) rec = { ts: 0, phone: '', data: rec };
    body = tokenPage(rec);
  }

  $done({
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    body: body,
  });
}

main();