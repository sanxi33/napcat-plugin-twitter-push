# napcat-plugin-twitter-push

一个给 NapCat 用的 X/Twitter 查询与推送插件。它可以在群里查看某个账号最近的推文，也可以把新推文定时推送到启用的 QQ 群。

## 这份 README 默认把你当作

- 已经装好了 NapCat，会导入插件 zip
- 希望插件尽量是“导入后直接配好就能用”
- 想监控固定的 X/Twitter 账号，并把更新推到群里

## 先说结论

当前版本已经改成了**纯 `.mjs` 实现**：

- 不需要安装 `xreach`
- 不需要申请官方开发者 API
- 不需要额外可执行命令

它现在走的是 X 的公开嵌入 / syndication 数据接口。

这意味着：

- 对普通用户来说，安装路径更简单了
- 但稳定性取决于 X 当前对公开接口的策略，不如官方 API 那样有长期承诺

## 这个插件适合谁

适合：

- 想监控固定的 X/Twitter 账号
- 想在群里快速查看最新推文
- 想把新推文推送到 QQ 群

不太适合：

- 需要官方 API 级别稳定性的人
- 不知道目标账号 handle 的人

## 装之前要准备什么

普通用户一般只需要准备这 3 件事：

1. 要监控的账号 handle
2. 管理员 QQ
3. 可选的 Cookie（某些环境下可提升抓取稳定性）

### 1. 目标账号

例如：

- `OpenAI`
- `github`

注意：填 `handle` 时不要带 `@`。

### 2. 管理员 QQ

`adminQqList` 需要写成逗号分隔字符串，例如：

```text
123456789,987654321
```

### 3. Cookie（可选）

大多数人可以先不填。  
如果你的环境里查询不稳定，再补其中一种：

- `twitterCookieFile`
- `twitterCookie`

## 安装

### 1. 下载插件

从 [Releases](https://github.com/sanxi33/napcat-plugin-twitter-push/releases) 下载：

- `napcat-plugin-twitter-push.zip`

### 2. 导入 NapCat

在 NapCat 插件管理里导入 zip，并启用插件。

### 3. 先填最少配置

第一次建议先这样填：

```json
{
  "enabled": true,
  "commandPrefix": "球鳖",
  "handle": "OpenAI",
  "requestTimeoutMs": 15000,
  "pollMinutes": 120,
  "adminQqList": "123456789",
  "pushStatePath": "data/twitter-push-state.json",
  "twitterCookieFile": "",
  "twitterCookie": ""
}
```

其中最关键的是：

- `handle`
- `adminQqList`

## 怎么用

查看最近推文：

- `球鳖 推特`
- `球鳖 twitter`

查看第 N 条：

- `球鳖 第1条推特`

群管理员控制推送：

- `球鳖 开启推特推送`
- `球鳖 关闭推特推送`

## 第一次怎么确认自己装好了

建议先这样测：

1. 配好 `handle`
2. 在任意聊天里发 `球鳖 推特`
3. 能返回列表后，再去群里发 `球鳖 开启推特推送`

这样最容易判断问题到底是“抓取失败”，还是“推送逻辑没开”。

## 一键跳到 NapCat WebUI 安装页

如果你的 NapCat 版本是 `4.15.19` 或更高，可以直接点下面按钮跳到插件安装界面：

<a href="https://napneko.github.io/napcat-plugin-index?pluginId=napcat-plugin-twitter-push" target="_blank">
  <img src="https://github.com/NapNeko/napcat-plugin-index/blob/pages/button.png?raw=true" alt="在 NapCat WebUI 中打开" width="170">
</a>

## 已知限制

- 插件依赖 X 的公开嵌入 / syndication 接口，不是官方开发者 API
- 公开接口的返回结构或可用性变化时，插件可能需要更新
- 某些网络环境下，补一个 Cookie 会更稳定

## License

MIT
