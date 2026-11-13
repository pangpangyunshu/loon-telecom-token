# 电信营业厅 Token 抓取 · Loon 插件

在 iPhone 上用 Loon 抓取「电信营业厅」App 的登录结果，抓到后弹通知，点通知就能打开页面一键复制。

> 背景：`appgologin.189.cn` 的密码登录接口现在对同一出口 IP 的所有请求都返回
> `122001 请进行滑块验证`，且响应体里不携带滑块会话。所以改为「抓一次登录态 → 写缓存 →
> 后续走缓存」，缓存有效期内完全不碰风控接口。

## 安装

Loon → 配置 → 插件 → 右上角 `+` → 从 URL 安装，粘贴：

```
https://cdn.jsdelivr.net/gh/pangpangyunshu/loon-telecom-token@main/telecom-token.plugin
```

如果 jsDelivr 打不开，改用：

```
https://raw.githubusercontent.com/pangpangyunshu/loon-telecom-token/main/telecom-token.plugin
```

## 必须开启 MITM

插件只声明了 `appgologin.189.cn`，但**必须**：

1. Loon → 设置 → MitM → 生成证书 → 下载描述文件并安装；
2. iOS 设置 → 通用 → VPN与设备管理 → 安装该描述文件；
3. iOS 设置 → 通用 → 关于本机 → 证书信任设置 → 打开开关。

不做这一步，HTTPS 响应体抓不到，插件会一直没反应。

## 使用

1. 打开「电信营业厅」App，**退出登录**；
2. 重新登录（该拖滑块就拖）；
3. 登录成功弹出通知「电信 Token 已抓取 ✓」；
4. 点通知 → 打开复制页 → 点「一键复制 JSON」；
5. 把 JSON 粘贴到电脑上的 `token.txt`，运行 `python 注入Token.py` 写入缓存。

也可以直接在 Safari 打开 `http://telecom-token.local/` 查看和复制。

## 文件

| 文件 | 作用 |
|---|---|
| `telecom-token.plugin` | Loon 插件，声明 MITM 与两条脚本规则 |
| `telecom-token-capture.js` | 抓取端：解析登录响应，存 token/userId，弹通知 |
| `telecom-token-viewer.js` | 查看端：返回带复制按钮的 HTML 页面 |

## 抓到的数据

`loginSuccessResult` 里的全部字段，主要是：

- `token` — 登录令牌，用于换取 ticket
- `userId` — 用户 ID

两者配合电脑端的注入脚本生成 `chinaTelecom_cache.json`，之后签到脚本走缓存登录。

## 抓不到数据怎么排查

插件内置诊断。Safari 打开：

```
http://telecom-token.local/diag
```

- **页面能打开** → 插件和脚本都正常，问题在抓取是否命中。看页面里有没有
  `userLoginNormal` 这条请求：没有则说明 App 登录走的是别的接口，把日志发给开发者。
- **页面打不开** → 插件没生效。依次检查：插件开关是否启用、Loon 全局代理是否开启、
  MitM 是否开启、证书是否已安装并在「证书信任设置」里被信任。
- **有 `userLoginNormal` 但提示「响应体为空」** → 多为 `max-size` 或 requires-body 配置问题。

## 说明

- 抓取端一律 `$done({})` 原样放行，**不改写** App 的响应体。
- 本仓库只包含抓取逻辑，不包含任何账号、密码或登录态；缓存在本机，请勿上传。
- 命中 122001 时只会提示需要滑块，不会写入脏数据。