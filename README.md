# napcat-plugin-twitter-push

一个为 NapCat 设计的 X/Twitter 查询与推送插件。它可以在群里查看某个账号最近的推文，也可以把新推文定时推送到启用的 QQ 群。

## 适用场景

- 监控固定的 X/Twitter 账号
- 在群聊中快速查看最新推文
- 将新推文自动推送到 QQ 群

## 环境要求

- 已部署 NapCat，并了解如何导入插件包 (`.zip`)
- 知道目标账号的 `handle`（不带 `@`）

可选：

- `twitterCookieFile`
- `twitterCookie`

某些网络环境下，补一个 Cookie 会更稳定。

## 安装步骤

### 1. 下载插件

前往 [Releases](https://github.com/sanxi33/napcat-plugin-twitter-push/releases) 页面，下载最新版本的 `napcat-plugin-twitter-push.zip`。

### 2. 导入 NapCat

在 NapCat 的插件管理界面中导入 zip 文件，并启用插件。

### 3. 默认配置

插件首次运行建议先使用以下配置：

```json
{
  "enabled": true,
  "commandPrefix": "/",
  "handle": "OpenAI",
  "requestTimeoutMs": 15000,
  "pollMinutes": 120,
  "adminQqList": "123456789",
  "pushStatePath": "data/twitter-push-state.json",
  "twitterCookieFile": "",
  "twitterCookie": ""
}
```

`handle` 就是账号主页 URL 里 `/` 后面的那一段，例如：

- `https://x.com/OpenAI` 的 `handle` 是 `OpenAI`
- `https://x.com/github` 的 `handle` 是 `github`

填写时不要带 `@`。

通常最关键的是：

- `handle`
- `adminQqList`

## 使用方法

查看最近推文：

```text
/推特
/twitter
/第1条推特
```

控制群推送：

```text
/开启推特推送
/关闭推特推送
```

## 验证安装

建议按以下顺序测试：

1. 配好 `handle`
2. 在任意聊天里发 `/推特`
3. 能返回列表后，再在群里发 `/开启推特推送`

## 快捷安装链接

NapCat 版本 ≥ `4.15.19` 时，可点击下方按钮快速跳转至插件安装页面：

<a href="https://napneko.github.io/napcat-plugin-index?pluginId=napcat-plugin-twitter-push" target="_blank">
  <img src="https://github.com/NapNeko/napcat-plugin-index/blob/pages/button.png?raw=true" alt="在 NapCat WebUI 中打开" width="170">
</a>

## 已知限制

- 插件依赖 X 的公开嵌入 / syndication 接口，不是官方开发者 API
- 公开接口的返回结构或可用性变化时，插件可能需要更新
- 某些网络环境下，补一个 Cookie 会更稳定

## License

MIT
