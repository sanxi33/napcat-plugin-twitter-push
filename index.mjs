import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';

var EventType = ((EventType2) => {
  EventType2.MESSAGE = 'message';
  return EventType2;
})(EventType || {});

const DEFAULT_CONFIG = {
  enabled: true,
  commandPrefix: '球鳖',
  handle: '',
  requestTimeoutMs: 15000,
  pollMinutes: 120,
  adminQqList: [],
  pushStatePath: 'data/twitter-push-state.json',
  twitterCookieFile: '',
  xreachCmd: 'xreach.cmd',
  authToken: '',
  ct0: ''
};

export let plugin_config_ui = [];
let currentConfig = { ...DEFAULT_CONFIG };
let logger = null;
let ctxRef = null;
let timer = null;
let state = { enabledGroups: {}, lastTweetIdByHandle: {} };

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[！!。,.，？?；;：:“”"'`~·]/g, '').replace(/\s+/g, '');
}

function sanitizeConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_CONFIG };
  const out = { ...DEFAULT_CONFIG, ...raw };
  out.enabled = Boolean(out.enabled);
  out.commandPrefix = String(out.commandPrefix || '').trim();
  out.handle = String(out.handle || '').replace(/^@/, '').trim();
  out.requestTimeoutMs = Math.max(3000, Math.min(60000, Number(out.requestTimeoutMs) || 15000));
  out.pollMinutes = Math.max(1, Math.min(1440, Number(out.pollMinutes) || 120));
  out.adminQqList = Array.isArray(out.adminQqList) ? out.adminQqList.map((item) => String(item)) : [];
  out.pushStatePath = String(out.pushStatePath || 'data/twitter-push-state.json');
  out.twitterCookieFile = String(out.twitterCookieFile || '');
  out.xreachCmd = String(out.xreachCmd || 'xreach.cmd');
  out.authToken = String(out.authToken || '');
  out.ct0 = String(out.ct0 || '');
  return out;
}

function stripPrefix(text) {
  const trimmed = String(text || '').trim();
  if (!currentConfig.commandPrefix) return trimmed;
  if (trimmed.startsWith(currentConfig.commandPrefix)) return trimmed.slice(currentConfig.commandPrefix.length).trim();
  return trimmed;
}

function getStatePath() {
  const p = currentConfig.pushStatePath;
  if (path.isAbsolute(p)) return p;
  return path.join(ctxRef.dataPath, p.replace(/^data[\\/]/, ''));
}

function loadState() {
  try {
    const sp = getStatePath();
    if (fs.existsSync(sp)) state = JSON.parse(fs.readFileSync(sp, 'utf-8'));
  } catch {
    state = { enabledGroups: {}, lastTweetIdByHandle: {} };
  }
}

function saveState() {
  try {
    const sp = getStatePath();
    const dir = path.dirname(sp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(sp, JSON.stringify(state, null, 2), 'utf-8');
  } catch {}
}

function isAdmin(userId) {
  return currentConfig.adminQqList.includes(String(userId || ''));
}

function parseCookie() {
  try {
    if (!currentConfig.twitterCookieFile) return { authToken: '', ct0: '' };
    const raw = fs.readFileSync(currentConfig.twitterCookieFile, 'utf-8');
    const auth = (raw.match(/auth_token=([^;\s]+)/) || [])[1] || '';
    const ct0 = (raw.match(/ct0=([^;\s]+)/) || [])[1] || '';
    return { authToken: auth, ct0 };
  } catch {
    return { authToken: '', ct0: '' };
  }
}

function runXreachTweets(handle, count = 8) {
  return new Promise((resolve, reject) => {
    const parsed = parseCookie();
    const authToken = currentConfig.authToken || parsed.authToken;
    const ct0 = currentConfig.ct0 || parsed.ct0;
    if (!authToken || !ct0) return reject(new Error('缺少 auth_token/ct0，请配置 twitterCookieFile 或直接填写 authToken/ct0'));

    const args = ['--auth-token', authToken, '--ct0', ct0, 'tweets', handle, '--count', String(Math.max(2, count)), '--json'];
    const xreachBin = String(currentConfig.xreachCmd || 'xreach.cmd').trim() || 'xreach.cmd';
    execFile(xreachBin, args, { shell: true, windowsHide: true, timeout: currentConfig.requestTimeoutMs + 5000, maxBuffer: 1024 * 1024 * 8 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message || 'xreach_failed'));
      try {
        const data = JSON.parse(stdout);
        resolve(data?.items || []);
      } catch (error) {
        reject(new Error(`xreach_json_parse_failed:${String(error)}`));
      }
    });
  });
}

function runXreachTweet(urlOrId) {
  return new Promise((resolve, reject) => {
    const parsed = parseCookie();
    const authToken = currentConfig.authToken || parsed.authToken;
    const ct0 = currentConfig.ct0 || parsed.ct0;
    if (!authToken || !ct0) return reject(new Error('缺少 auth_token/ct0，请配置 twitterCookieFile 或直接填写 authToken/ct0'));

    const args = ['--auth-token', authToken, '--ct0', ct0, 'tweet', String(urlOrId), '--json'];
    const xreachBin = String(currentConfig.xreachCmd || 'xreach.cmd').trim() || 'xreach.cmd';
    execFile(xreachBin, args, { shell: true, windowsHide: true, timeout: currentConfig.requestTimeoutMs + 5000, maxBuffer: 1024 * 1024 * 8 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message || 'xreach_tweet_failed'));
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`xreach_tweet_json_parse_failed:${String(error)}`));
      }
    });
  });
}

async function sendMsg(ctx, event, message) {
  const params = {
    message,
    message_type: event.message_type,
    ...(event.message_type === 'group' && event.group_id ? { group_id: String(event.group_id) } : {}),
    ...(event.message_type === 'private' && event.user_id ? { user_id: String(event.user_id) } : {})
  };
  await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config);
}

async function sendGroup(groupId, message) {
  await ctxRef.actions.call('send_msg', { message, message_type: 'group', group_id: String(groupId) }, ctxRef.adapterName, ctxRef.pluginManager.config);
}

function cqEscape(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/,/g, '&#44;');
}

function extractTweetImageUrls(tweet) {
  const urls = [];
  const add = (url) => {
    const s = String(url || '').trim();
    if (!s) return;
    if (!/^https?:\/\//i.test(s)) return;
    if (urls.includes(s)) return;
    urls.push(s);
  };

  if (Array.isArray(tweet?.media)) {
    for (const media of tweet.media) {
      if (String(media?.type || '').toLowerCase() === 'photo') add(media?.url);
    }
  }

  for (const photo of (tweet?.media?.photos || [])) add(photo?.url || photo?.src || photo?.mediaUrl || photo?.media_url_https);
  for (const media of (tweet?.extendedEntities?.media || [])) add(media?.media_url_https || media?.media_url || media?.url);
  for (const media of (tweet?.entities?.media || [])) add(media?.media_url_https || media?.media_url || media?.url);
  for (const photo of (tweet?.photos || [])) add(photo?.url || photo?.src);

  return urls.slice(0, 6);
}

function formatTs(ts) {
  const date = ts ? new Date(ts) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

function toWeiboStyleRetweetText(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/^RT\s+@([^:]+):\s*([\s\S]+)$/i);
  if (!match) return { text: raw, hasSource: false };
  return { text: `//@${match[1]}:${String(match[2] || '').trim()}`, hasSource: true };
}

async function resolveQuoteSource(tweet) {
  try {
    const sn = tweet?.user?.screenName || currentConfig.handle;
    const id = tweet?.id;
    if (!sn || !id) return null;

    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(`https://x.com/${sn}/status/${id}`)}`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;
    const data = await response.json();
    const html = String(data?.html || '');

    const match = html.match(/https:\/\/t\.co\/([A-Za-z0-9]+)/);
    if (!match) return null;
    const shortUrl = `https://t.co/${match[1]}`;

    const redirected = await fetch(shortUrl, { redirect: 'follow' });
    const finalUrl = String(redirected?.url || '');
    const sid = (finalUrl.match(/\/status\/(\d+)/) || [])[1];
    if (!sid) return null;

    const source = await runXreachTweet(sid);
    const author = source?.user?.screenName || source?.user?.name || '引用推文';
    const text = String(source?.text || '').trim();
    if (!text) return null;
    return {
      chain: `//@${author}:${text}`,
      images: extractTweetImageUrls(source),
    };
  } catch {
    return null;
  }
}

async function formatTweet(tweet) {
  const ts = formatTs(tweet?.createdAt);
  const raw = String(tweet?.text || '').trim();

  let body = raw;
  let quoteImages = [];
  const parsed = toWeiboStyleRetweetText(raw);
  if (tweet?.isRetweet) {
    body = parsed.text;
  } else if (tweet?.isQuote) {
    const source = await resolveQuoteSource(tweet);
    if (source?.chain) {
      body = `${raw}${source.chain}`;
      quoteImages = source.images || [];
    } else {
      body = parsed.hasSource ? parsed.text : `${raw}//@引用推文:（源内容未返回）`;
    }
  }

  const text = `${ts ? `${ts}\n\n` : ''}${body}`;
  let imageUrls = extractTweetImageUrls(tweet);
  if ((tweet?.isRetweet || tweet?.isQuote) && imageUrls.length === 0 && quoteImages.length > 0) {
    imageUrls = quoteImages;
  }
  if (tweet?.isRetweet || tweet?.isQuote) imageUrls = imageUrls.slice(0, 1);
  const images = imageUrls.map((url) => `[CQ:image,file=${cqEscape(url)}]`);
  return images.length ? `${text}\n${images.join('\n')}` : text;
}

async function handleList(ctx, event) {
  if (!currentConfig.handle) return sendMsg(ctx, event, '请先在配置里设置 handle');
  const items = await runXreachTweets(currentConfig.handle, 8);
  if (!items.length) return sendMsg(ctx, event, '暂无推文数据');
  const top = items.slice(0, 8).map((item, index) => `${index + 1}. ${String(item.text || '').replace(/\n/g, ' ').slice(0, 50)}...`).join('\n');
  return sendMsg(ctx, event, `推特列表(@${currentConfig.handle})：\n${top}\n\n可发：第N条推特`);
}

async function handleDetail(ctx, event, idx) {
  if (!currentConfig.handle) return sendMsg(ctx, event, '请先在配置里设置 handle');
  const items = await runXreachTweets(currentConfig.handle, Math.max(8, idx + 2));
  const tweet = items[idx - 1];
  if (!tweet) return sendMsg(ctx, event, '序号超出范围');
  return sendMsg(ctx, event, await formatTweet(tweet));
}

function startPoller() {
  if (timer) clearInterval(timer);
  timer = setInterval(async () => {
    if (!ctxRef || !currentConfig.enabled || !currentConfig.handle) return;
    try {
      const items = await runXreachTweets(currentConfig.handle, 8);
      const sorted = items
        .filter((item) => item?.createdAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latest = sorted[0] || items[0];
      if (!latest?.id) return;
      const key = currentConfig.handle;
      const oldId = String(state.lastTweetIdByHandle[key] || '');
      const latestId = String(latest.id);
      if (oldId === latestId) return;
      state.lastTweetIdByHandle[key] = latestId;
      saveState();
      if (!oldId) return;

      const msg = await formatTweet(latest);
      for (const [gid, enabled] of Object.entries(state.enabledGroups || {})) {
        if (!enabled) continue;
        await sendGroup(gid, msg);
      }
    } catch (error) {
      logger?.warn('twitter poll failed', error);
    }
  }, currentConfig.pollMinutes * 60 * 1000);
}

export const plugin_init = async (ctx) => {
  ctxRef = ctx;
  logger = ctx.logger;
  plugin_config_ui = ctx.NapCatConfig.combine(
    ctx.NapCatConfig.boolean('enabled', '启用插件', true, '总开关'),
    ctx.NapCatConfig.text('commandPrefix', '命令前缀', '球鳖', ''),
    ctx.NapCatConfig.text('handle', 'X账号', '', '无需@，例如 OpenAI'),
    ctx.NapCatConfig.number('pollMinutes', '轮询间隔 (分钟)', 120, '1-1440'),
    ctx.NapCatConfig.number('requestTimeoutMs', '请求超时(ms)', 15000, '3000-60000'),
    ctx.NapCatConfig.text('twitterCookieFile', 'Twitter Cookie文件', '', '可选，留空则依赖下方 authToken/ct0'),
    ctx.NapCatConfig.text('xreachCmd', 'xreach命令路径', 'xreach.cmd', '默认假设 xreach.cmd 已在 PATH 中'),
    ctx.NapCatConfig.text('authToken', 'auth_token(可选)', '', '留空则从 cookie 文件读取'),
    ctx.NapCatConfig.text('ct0', 'ct0(可选)', '', '留空则从 cookie 文件读取'),
    ctx.NapCatConfig.text('pushStatePath', '状态文件路径', 'data/twitter-push-state.json', ''),
    ctx.NapCatConfig.text('adminQqList', '管理员QQ(逗号分隔)', '', '可控制开启/关闭推送')
  );

  try {
    if (ctx.configPath && fs.existsSync(ctx.configPath)) {
      const cfg = JSON.parse(fs.readFileSync(ctx.configPath, 'utf-8'));
      if (typeof cfg.adminQqList === 'string') cfg.adminQqList = cfg.adminQqList.split(',').map((item) => item.trim()).filter(Boolean);
      currentConfig = sanitizeConfig(cfg);
    }
  } catch {}

  loadState();
  startPoller();
};

export const plugin_onmessage = async (ctx, event) => {
  if (!currentConfig.enabled) return;
  if (event.post_type !== EventType.MESSAGE) return;
  const raw = String(event.raw_message || '').replace(/\[CQ:[^\]]+\]/g, '').trim();
  if (!raw) return;
  const text = stripPrefix(raw);
  const norm = normalize(text);

  try {
    if (norm.includes('开启推特推送')) {
      if (event.message_type !== 'group') return sendMsg(ctx, event, '该命令仅群聊可用');
      if (!isAdmin(event.user_id)) return sendMsg(ctx, event, '仅管理员可操作');
      state.enabledGroups[String(event.group_id)] = true;
      saveState();
      return sendMsg(ctx, event, '已开启本群推特推送');
    }
    if (norm.includes('关闭推特推送')) {
      if (event.message_type !== 'group') return sendMsg(ctx, event, '该命令仅群聊可用');
      if (!isAdmin(event.user_id)) return sendMsg(ctx, event, '仅管理员可操作');
      state.enabledGroups[String(event.group_id)] = false;
      saveState();
      return sendMsg(ctx, event, '已关闭本群推特推送');
    }

    const detailMatch = text.match(/^第\s*(\d+)\s*条推特$/i);
    if (detailMatch) return await handleDetail(ctx, event, Number(detailMatch[1]));

    const twitterTriggers = ['推特', 'twitter'];
    if (twitterTriggers.includes(norm)) {
      return await handleList(ctx, event);
    }
  } catch (error) {
    logger?.warn('twitter command failed', error);
    return await sendMsg(ctx, event, `推特查询失败：${String(error?.message || '').slice(0, 120)}`);
  }
};

export const plugin_get_config = async () => currentConfig;
export const plugin_set_config = async (ctx, cfg) => {
  if (typeof cfg.adminQqList === 'string') cfg.adminQqList = cfg.adminQqList.split(',').map((item) => item.trim()).filter(Boolean);
  currentConfig = sanitizeConfig(cfg);
  try {
    const dir = path.dirname(ctx.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ctx.configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
  } catch {}
  startPoller();
};
export const plugin_on_config_change = async (ctx, ui, key, value, cur) => {
  if (typeof cur.adminQqList === 'string') cur.adminQqList = cur.adminQqList.split(',').map((item) => item.trim()).filter(Boolean);
  currentConfig = sanitizeConfig(cur);
  startPoller();
};
export const plugin_onevent = async () => {};
export const plugin_cleanup = async () => {
  if (timer) clearInterval(timer);
  timer = null;
};
