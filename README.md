# napcat-plugin-twitter-push

一个 NapCat 原生插件，用于查询指定 X/Twitter 账号的推文，并支持定时推送到 QQ 群。

## 功能

- 查看推文列表：`推特`
- 查看指定条目：`第N条推特`
- 群管理员可开启/关闭本群推送
- 定时轮询最新推文并推送到已启用群

## 依赖

这个插件依赖本地可执行的 `xreach` 命令。

默认配置假设你已经安装并可直接运行：

```text
xreach.cmd
```

如果不在 PATH 中，可以在配置里填绝对路径。

## 配置

```json
{
  "enabled": true,
  "commandPrefix": "球鳖",
  "handle": "",
  "requestTimeoutMs": 15000,
  "pollMinutes": 120,
  "adminQqList": [],
  "pushStatePath": "data/twitter-push-state.json",
  "twitterCookieFile": "",
  "xreachCmd": "xreach.cmd",
  "authToken": "",
  "ct0": ""
}
```

- `handle`：目标账号，不带 `@`
- `adminQqList`：可控制本群推送开关的管理员 QQ 列表
- `twitterCookieFile`：可选，Twitter Cookie 文件路径
- `authToken` / `ct0`：可直接填认证信息，优先级高于 cookie 解析
- `xreachCmd`：`xreach` 命令路径

## 安装

1. 安装并确认本机可运行 `xreach`
2. 下载当前仓库 [Releases](https://github.com/sanxi33/napcat-plugin-twitter-push/releases) 中的 `napcat-plugin-twitter-push.zip`
3. 在 NapCat 插件管理中导入压缩包
4. 配置 `handle`、认证信息和管理员 QQ

## 已知限制

- 插件本身不内置 Twitter 抓取能力，依赖外部 `xreach`
- Twitter 页面和接口变化可能导致 `xreach` 返回结构变化
- 推文推送依赖认证信息有效

## License

MIT
