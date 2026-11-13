# 电信营业厅 Token 抓取 · Loon 插件（iPhone）

用 Loon 在 iPhone 上抓「电信营业厅」App 的登录态（`token` + `userId`，并自动解析出手机号），
抓完弹通知，点通知进复制页一键复制 JSON。拿到的 JSON 丢给电脑端的签到脚本，
以后就走「缓存 token」登录，**不再碰那个会返回 `122001 请进行滑块验证` 的密码登录接口**。

## 为什么需要它

`https://appgologin.189.cn:9031/login/client/userLoginNormal` 现在对同一出口 IP 的**所有**请求
一律返回 `122001 请进行滑块验证`（用不存在的手机号测试也一样），而且响应里 `attach`/`data` 是空的
——滑块会话根本不由这个接口下发，纯协议没有可对接的入口。

所以改成：**在 App 里手动过一次滑块 → 抓下登录态 → 脚本走缓存**。
缓存有效期内完全不打风控接口，抓一次能用一段时间，过期再抓一次即可。

## 安装

Loon → 配置 → 插件 → 右上角 `+` → 从 URL 安装，粘贴：

```
https://cdn.jsdelivr.net/gh/pangpangyunshu/loon-telecom-token@main/telecom-token.plugin
```

jsDelivr 打不开时换 raw：

```
https://raw.githubusercontent.com/pangpangyunshu/loon-telecom-token/main/telecom-token.plugin
```

## 必须开启 MITM

只装插件不够，HTTPS 响应体要能解出来：

1. Loon → 设置 → MitM → 打开开关 + 生成证书；
2. 证书要在 iOS「设置 → 通用 → VPN与设备管理」里安装；
3. iOS「设置 → 通用 → 关于本机 → 证书信任设置」里把 Loon 的开关打开。

第 3 步没做的话，插件会「看起来启用了但一直没反应」，这是最常见的失败原因。

## 使用

1. 打开「电信营业厅」App → 我的 → **退出登录**；
2. 重新登录（滑块该拖就拖）；
3. 登录成功会弹通知「电信 Token 已抓取 ✓」，点通知打开复制页（或 Safari 打开
   `https://appgologin.189.cn:9031/token`）；
4. 点「一键复制 JSON」，得到形如：

   ```json
   {"phone":"133xxxxxxxx","token":"...","userId":"..."}
   ```

5. 把这个 JSON 存成电脑上主脚本目录里的 `token.txt`（脚本同目录），
   然后直接跑主脚本——它会自动读取并写入 `chinaTelecom_cache.json`。

抓到的 JSON 里 `phone` 是脚本从登录请求体里反解出来的（电信对手机号做了「每字符 +2」的混淆），
电脑端靠它自动匹配是多账号里的哪一个，省掉手填。

## 文件

| 文件 | 作用 |
|---|---|
| `telecom-token.plugin` | Loon 插件：声明 MITM 域名 + 三条脚本规则 |
| `telecom-token-capture.js` | 抓取端：请求阶段解析手机号，响应阶段取 token/userId，存持久化并弹通知 |
| `telecom-token-viewer.js` | 查看端：`/token` 复制页、`/diag` 诊断页 |

## 页面地址

```
复制页：https://appgologin.189.cn:9031/token
诊断页：https://appgologin.189.cn:9031/diag
```

> 早期版本用过 `http://telecom-token.local/`，**打不开是正常的**：`.local` 是 iOS 保留的 mDNS 后缀，
> 系统在 DNS 阶段就处理掉了，请求进不了 Loon。所以页面改挂在 `appgologin.189.cn` 上
> —— 这个域名本身可达，且 MITM 已覆盖。

## 抓不到怎么排查

先看诊断页：

- **有 `userLoginNormal` 的 REQ，也有 RSP，但没有 token** → 响应里没登录结果，多半是命中了 122001；
  回 App 手动把滑块拖过去再登录。
- **只有 REQ，没有 RSP** → 响应阶段没触发，检查 MITM 证书信任、插件里 `max-size`。
- **完全没记录** → 插件没启用 / MITM 没开 / 证书没信任；确认 App 是真的「退出登录后重新登录」。
- **RSP 的 len 很小或为 0** → 响应体没读到，`requires-body=1` 与 `max-size` 要保证够大。

## 常见问题

**改了脚本，手机端没生效？**
插件里的 `script-path` 指向 `@main`，jsDelivr 对 `@main` 有缓存（通常十几分钟到 12 小时）。
急用就换成 `raw.githubusercontent.com` 的地址，或把 URL 里的 `@main` 换成某个具体 commit。

**jsDelivr 连不上，插件装了却一直没反应？**
本插件的 `script-path` 默认走 `cdn.jsdelivr.net`。个别网络下它不可用，表现是：插件显示已启用，
但 App 登录后既不弹通知，诊断页也没有任何记录。这时把插件里 4 处
`https://cdn.jsdelivr.net/gh/pangpangyunshu/loon-telecom-token@main/`
换成
`https://raw.githubusercontent.com/pangpangyunshu/loon-telecom-token/main/`
（Loon → 配置 → 插件 → 点开插件编辑），即可。两条线路互为备份，哪条通就用哪条。

**抓到了但电脑端说 token 无效？**
token 有有效期，复制页超过 6 小时会给提示。过期就重新抓一次；不要反复用密码登录去试，
那只会加深风控。

**会不会影响 App 正常使用？**
抓取脚本一律 `$done({})` 原样放行，不改写任何请求或响应；复制页是本地生成 HTML，不真正联网。

## 说明

- 本仓库只包含抓取逻辑，**不包含任何账号、密码或登录态**。
- 抓到的东西等同于登录凭证，缓存在你自己手机上，别上传、别分享。
- 只用于抓自己的账号；解密、伪造验证码这类事这里不做，也不会做。