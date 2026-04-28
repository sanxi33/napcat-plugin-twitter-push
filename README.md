# napcat-plugin-twitter-push

在 QQ 群里直接看 X/Twitter 推文，还能定时把新推文自动推送到群聊。不用挂梯子盯网页。

## 下载安装

去 [Releases](https://github.com/sanxi33/napcat-plugin-twitter-push/releases) 下载最新的 `napcat-plugin-twitter-push.zip`，在 NapCat 插件管理里导入启用即可。

NapCat 版本 >= `4.15.19` 的，点这个按钮直接跳转安装页：

<a href="https://napneko.github.io/napcat-plugin-index?pluginId=napcat-plugin-twitter-push" target="_blank">
  <img src="https://github.com/NapNeko/napcat-plugin-index/blob/pages/button.png?raw=true" alt="在 NapCat WebUI 中打开" width="170">
</a>

## 配置

关键字段就两个：

- `handle` —— 目标账号的 ID（不带 `@`），比如 `OpenAI`、`github`
- `adminQqList` —— 你的 QQ 号，用来控制开关

`handle` 其实就是主页 URL 里 `/` 后面那段：`https://x.com/OpenAI` → `OpenAI`。填的时候别带 `@`。

完整默认配置：

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

`twitterCookie` 和 `twitterCookieFile` 可选。有些网络环境下补个 Cookie 会更稳定。

## 命令

查推文：

```
/推特
/twitter
/第1条推特
```

控制推送：

```
/开启推特推送
/关闭推特推送
```

上手顺序：填好 `handle`，发个 `/推特` 看看能不能拉到列表，没问题了再在群里开推送。

## 注意

- 走的是 X 的公开嵌入 / syndication 接口，不是官方开发者 API
- 公开接口可能变更，到时候插件得跟着更新
- 某些网络环境下建议配个 Cookie

## License

MIT
