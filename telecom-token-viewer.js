/*
 * 电信营业厅 登录结果查看页 / 诊断页（Loon 查看端）
 *   http://telecom-token.local/       → 显示抓到的 token / userId，可一键复制
 *   http://telecom-token.local/diag   → 显示诊断脚本记录的 189 请求日志
 */

const STORE_KEY = 'china_telecom_login_result';
const DIAG_KEY = 'diag_log_v1';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmt(ts) {
  if (!ts) return '未知';
  const d = new Date(ts);
  const p = n => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function fields(data) {
  return Object.keys(data)
    .filter(k => k !== 'token' && k !== 'userId' && data[k] !== null && data[k] !== '' && typeof data[k] !== 'object')
    .map(k => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(data[k])}</span></div>`)
    .join('');
}

function shell(title, inner) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>${esc(title)}</title>
<style>
  :root{color-scheme:light dark}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;padding:16px;font:15px/1.55 -apple-system,"PingFang SC",sans-serif;background:#f2f2f7;color:#111}
  @media(prefers-color-scheme:dark){
    body{background:#000;color:#f2f2f7}
    .card{background:#1c1c1e!important}
    .mono.value,textarea,.drow{background:#2c2c2e!important;color:#f2f2f7!important}
    .tip{color:#aeaeb2!important}.kv{border-color:#2c2c2e!important}
  }
  h1{font-size:19px;margin:4px 0 14px}
  .card{background:#fff;border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .label{font-size:12px;color:#8e8e93;margin:12px 0 6px;letter-spacing:.3px}
  .label:first-child{margin-top:0}
  .mono{font-family:ui-monospace,Menlo,monospace;word-break:break-all}
  .mono.value{background:#f2f2f7;border-radius:9px;padding:10px 12px;font-size:13px;-webkit-user-select:all;user-select:all}
  .small{font-size:12px;color:#8e8e93}
  textarea{width:100%;border:none;border-radius:9px;padding:10px 12px;font-family:ui-monospace,Menlo,monospace;font-size:12px;background:#f2f2f7;color:#111;resize:vertical;word-break:break-all}
  .btn{width:100%;margin-top:8px;padding:11px 12px;font-size:15px;border:none;border-radius:10px;background:#e5e5ea;color:#007aff;font-weight:600;cursor:pointer}
  .btn:active{opacity:.6}.btn.primary{background:#007aff;color:#fff}
  .empty{text-align:center;padding:22px 8px;color:#8e8e93;font-size:14px}
  .tip{font-size:13px;color:#3c3c43}
  .warn{margin-top:8px;padding:9px 11px;border-radius:9px;background:rgba(255,149,0,.14);color:#c96a00;font-size:12.5px}
  .kv{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #f2f2f7;font-size:13px}
  .kv .k{color:#8e8e93;flex:0 0 auto}.kv .v{font-family:ui-monospace,Menlo,monospace;word-break:break-all;text-align:right}
  .drow{background:#f7f7fa;border-radius:9px;padding:9px 11px;margin-bottom:7px;font:12px/1.5 ui-monospace,Menlo,monospace;word-break:break-all}
  .dreq{border-left:3px solid #ff9500}.drsp{border-left:3px solid #34c759}
  .dh{color:#8e8e93;font-size:11px}
</style></head>
<body><h1>${esc(title)}</h1>${inner}
<script>
function copyText(text,btn){
  function done(){if(!btn)return;var o=btn.textContent;btn.textContent='已复制 ✓';setTimeout(function(){btn.textContent=o;},1300);}
  function fallback(){
    var ta=document.getElementById('raw');if(!ta){alert('请手动长按选中复制');return;}
    ta.value=text;ta.removeAttribute('readonly');ta.select();ta.setSelectionRange(0,ta.value.length);
    try{document.execCommand('copy');done();}catch(e){alert('请手动长按选中复制');}
    ta.setAttribute('readonly','readonly');
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done).catch(fallback);}
  else{fallback();}
}
</script></body></html>`;
}

function tokenPage(rec) {
  const has = rec && rec.data && rec.data.token && rec.data.userId;
  const data = has ? rec.data : null;
  const stale = has && rec.ts && Date.now() - rec.ts > 6 * 3600 * 1000;

  const inner = has ? `
  <div class="card">
    <div class="label">抓取时间</div>
    <div class="mono small">${esc(fmt(rec.ts))}${rec.ts ? '' : '（旧数据）'}</div>
    ${stale ? '<div class="warn">⚠️ 超过 6 小时，token 可能已过期</div>' : ''}
    <div class="label">token</div>
    <div class="mono value" id="tk">${esc(data.token)}</div>
    <button class="btn" onclick="copyText(document.getElementById('tk').textContent,this)">复制 token</button>
    <div class="label">userId</div>
    <div class="mono value" id="uid">${esc(data.userId)}</div>
    <button class="btn" onclick="copyText(document.getElementById('uid').textContent,this)">复制 userId</button>
    ${fields(data)}
  </div>
  <div class="card">
    <div class="label">完整 JSON（粘贴到电脑 token.txt 用这个）</div>
    <textarea id="raw" readonly rows="6">${esc(JSON.stringify(data))}</textarea>
    <button class="btn primary" onclick="copyText(document.getElementById('raw').value,this)">一键复制 JSON</button>
  </div>
  <div class="card tip">
    <b>接着做：</b><br>1. 点「一键复制 JSON」<br>2. 粘到电脑的 <span class="mono">token.txt</span><br>3. 跑 <span class="mono">python 注入Token.py</span>
  </div>` : `
  <div class="card"><div class="empty">
    还没有抓到登录结果。<br><br>
    请先在「电信营业厅」App 里<b>退出登录</b>，再重新登录一次（滑块该拖就拖）。<br><br>
    还是抓不到？打开 <span class="mono">http://telecom-token.local/diag</span> 看诊断日志。
  </div></div>`;

  return shell('电信登录结果', inner);
}

function diagPage(list) {
  const items = Array.isArray(list) ? list.slice().reverse() : [];
  const plain = items.map(e =>
    e.k === 'REQ' ? `[${e.t}] REQ ${e.m} ${e.u}` : `[${e.t}] RSP ${e.s} len=${e.len} ${e.u}\n        ${e.b || ''}`
  ).join('\n');

  const rows = items.map(e => e.k === 'REQ'
    ? `<div class="drow dreq"><span class="dh">${esc(e.t)} REQ ${esc(e.m)}</span><br>${esc(e.u)}</div>`
    : `<div class="drow drsp"><span class="dh">${esc(e.t)} RSP ${esc(e.s)} · ${esc(e.len)}B</span><br>${esc(e.u)}<br><span class="dh">${esc(e.b || '')}</span></div>`
  ).join('');

  const inner = items.length ? `
  <div class="card">
    <div class="label">最近 ${items.length} 条记录（新的在上）</div>
    <textarea id="raw" readonly rows="6">${esc(plain)}</textarea>
    <button class="btn primary" onclick="copyText(document.getElementById('raw').value,this)">复制全部日志</button>
  </div>
  <div class="card"><div class="label">明细</div>${rows}</div>
  <div class="card tip">没有看到 <span class="mono">userLoginNormal</span>？说明 App 登录走的不是这个接口，把这份日志发给开发者。</div>`
  : `<div class="card"><div class="empty">
      还没有记录。<br><br>
      1. 确认诊断插件已启用<br>
      2. 在 App 里<b>退出登录</b>并重新登录一次<br>
      3. 回到这个页面刷新
    </div></div>`;

  return shell('诊断日志', inner);
}

function main() {
  const url = (typeof $request !== 'undefined' && $request.url) || '';
  if (url && url.indexOf('telecom-token.local') === -1) return $done({});

  const wantDiag = url.indexOf('/diag') !== -1;
  let body;

  if (wantDiag) {
    let list = [];
    try {
      const s = $persistentStore.read(DIAG_KEY);
      list = s ? JSON.parse(s) : [];
    } catch (e) { list = []; }
    body = diagPage(list);
  } else {
    let rec = null;
    try {
      const s = $persistentStore.read(STORE_KEY);
      if (s) rec = JSON.parse(s);
    } catch (e) { rec = null; }
    if (rec && !rec.data && rec.token) rec = { ts: 0, data: rec };
    body = tokenPage(rec);
  }

  $done({
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    body,
  });
}

main();