# OrionTV 认证问题

## 结论

启用 `PASSWORD` 不会令 Joyflix 的 API 产生内部错误。真正的问题在
OrionTV 1.3.13（截至 2026-07-26 的最新版）的 Cookie 处理：

1. `POST /api/login` 成功后，OrionTV 把响应中的 `Set-Cookie` 保存到
   AsyncStorage。
2. OrionTV 的共用 `_fetch()` 没有读取该值，也没有在后续请求中发送
   `Cookie`。
3. Joyflix 中间件依照 API 约定返回 `401 Unauthorized`。
4. OrionTV 将后续请求失败显示成“服务器内部错误，请联系管理员”。

这与 OrionTV issue
[#272](https://github.com/orion-lib/OrionTV/issues/272) 描述的行为一致。

## 修复

修复必须在 OrionTV 客户端发送认证 Cookie。Joyflix 随附的补丁会：

- 从 AsyncStorage 读取登录时保存的 Cookie；
- 仅取 `name=value` 部分，避免把 `Path`、`Expires` 等响应属性误当成请求
  Cookie；
- 合并原请求标头，并设置 `credentials: "include"`；
- 收到 `401` 或登出后删除失效 Cookie。

在 OrionTV 仓库根目录执行：

```bash
git apply /path/to/joyflix/patches/oriontv-cookie-auth.patch
git apply /path/to/joyflix/patches/oriontv-standalone-metro.patch
yarn eslint services/api.ts
yarn tsc --noEmit --skipLibCheck --target esnext --moduleResolution node \
  --module esnext --jsx react-jsx --esModuleInterop services/api.ts
yarn build
```

然后在 Android TV 安装新构建的 APK。

## 本次可安装 APK

测试成品位于：

```text
artifacts/oriontv/OrionTV-1.3.13-joyflix-auth-fix.apk
```

GitHub Release：

<https://github.com/UOE73/OrionTV/releases/tag/v1.3.13-joyflix.1>

Joyflix 根目录的 `.gitignore` 已排除整个 `/artifacts/` 目录，因此 APK 不会
进入 Git commit，也不会随此项目的 Git 部署上传到 Vercel。

此 APK 是 `release` build，但 OrionTV 1.3.13 的 upstream Gradle 配置仍以
debug keystore 签署。它适合验证本次认证修复；如果电视上已有签章不同的
`com.oriontv`，必须先卸载旧版才能安装，卸载会清除 OrionTV 的本机设置。

## 长期维护建议

建议 fork `orion-lib/OrionTV`，在 fork 内建立修复分支并套用这两个补丁，
而不是把 OrionTV 原始码或 Android build 目录并入 Joyflix。正式发布时应在
fork 内配置一把持久保存的 release signing key；后续所有 APK 都使用同一把
key，Android 才能直接升级。keystore 与密码只能放在 CI secrets，不应提交到
Git。

## 为什么不在 Joyflix 绕过认证

服务器看不到 Cookie 时，没有资料能区分“已成功登录但 OrionTV 忘了发送
Cookie”的请求与任意未认证请求。若按 User-Agent 放行或公开影视 API，
任何人都可以伪造同样的请求，`PASSWORD` 保护会形同虚设。因此 Joyflix
继续对未认证 API 返回标准的 `401`，不加入不安全的服务器端绕过。

## 验证方式

部署修正版 OrionTV 后，可从 Joyflix 请求日志确认：

- `POST /api/login` 返回 `200` 和 `Set-Cookie: auth=...`；
- 后续 `/api/douban`、`/api/search/resources` 等请求包含
  `Cookie: auth=...`；
- 这些请求返回 `200`，而不是 `401`。
