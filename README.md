# napcat-plugin-twitter-push

一个给 NapCat 用的 X/Twitter 查询与推送插件。它可以在群里查看某个账号最近的推文，也可以把新推文定时推送到启用的 QQ 群。

## 这份 README 默认把你当作

- 已经装好了 NapCat，会导入插件 zip
- 愿意准备一点外部依赖，但不想看源码
- 想监控固定的 X/Twitter 账号，并把更新推到群里

## 先说最重要的

这个插件 **不是“导入就能用”的纯开箱插件**。

在真正安装前，你至少要准备好：

1. 本机可执行的 `xreach` 命令
2. 要监控的 X/Twitter 账号 `handle`
3. 可用的认证信息

如果你暂时不想折腾 `xreach` 或认证信息，这个插件现在不适合你。

## 这个插件适合谁

适合：

- 已经能在本机跑通 `xreach`
- 愿意提供 `auth_token` / `ct0` 或 Cookie 文件
- 想把某个账号的新推文推到群里

不太适合：

- 想“装上就能直接查推特”的人
- 不想准备认证信息的人

## 装之前要准备什么

### 1. `xreach` 命令

默认配置假设你机器上可以直接运行：

```text
xreach.cmd
```

如果不是这个名字，或者不在 PATH 里，就把它的完整路径填到 `xreachCmd`。

### 2. 目标账号

例如：

- `OpenAI`
- `github`

注意：填 `handle` 时不要带 `@`。

### 3. 认证信息

这三种方式至少准备一种：

- `twitterCookieFile`
- `authToken`
- `ct0`

实际使用里，直接填 `authToken + ct0` 往往最直观。

### 4. 管理员 QQ

`adminQqList` 需要填成逗号分隔字符串，例如：

```text
123456789,987654321
```

不是数组。

## 安装

### 1. 下载插件

从 [Releases](https://github.com/sanxi33/napcat-plugin-twitter-push/releases) 下载：

- `napcat-plugin-twitter-push.zip`

### 2. 导入 NapCat

在 NapCat 插件管理里导入 zip，并启用插件。

### 3. 先填最少配置

第一次建议先只填这些：

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
  "xreachCmd": "xreach.cmd",
  "authToken": "",
  "ct0": ""
}
```

其中最关键的是：

- `handle`
- `adminQqList`
- `xreachCmd`
- `authToken` / `ct0` 或 `twitterCookieFile`

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

1. 配好 `handle` 和认证信息
2. 在任意聊天里发 `球鳖 推特`
3. 能返回列表后，再去群里发 `球鳖 开启推特推送`

这样最容易判断问题到底是“查取失败”，还是“推送逻辑没开”。

## 一键跳到 NapCat WebUI 安装页

如果你的 NapCat 版本是 `4.15.19` 或更高，可以直接点下面按钮跳到插件安装界面：

<a href="https://napneko.github.io/napcat-plugin-index?pluginId=napcat-plugin-twitter-push" target="_blank">
  <img src="https://github.com/NapNeko/napcat-plugin-index/blob/pages/button.png?raw=true" alt="在 NapCat WebUI 中打开" width="170">
</a>

## 已知限制

- 插件本身不内置 X/Twitter 抓取能力，依赖外部 `xreach`
- X/Twitter 页面或接口变化可能导致 `xreach` 返回结构变化
- 认证失效后，查询和推送都会受影响

## License

MIT
