import fs from 'fs';
import path from 'path';

var EventType = ((EventType2) => {
  EventType2.MESSAGE = 'message';
  return EventType2;
})(EventType || {});

const TIMELINE_URL = 'https://syndication.twitter.com/srv/timeline-profile/screen-name/';
const TWEET_URL = 'https://cdn.syndication.twimg.com/tweet-result';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const DEFAULT_CONFIG = {
  enabled: true,
  commandPrefix: '/',
  handle: '',
  requestTimeoutMs: 15000,
  pollMinutes: 120,
  adminQqList: [],
  pushStatePath: 'data/twitter-push-state.json',
  twitterCookie: '',
  twitterCookieFile: '',
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
  out.adminQqList = Array.isArray(out.adminQqList)
    ? out.adminQqList.map((item) => String(item).trim()).filter(Boolean)
    : String(out.adminQqList || '').split(',').map((item) => item.trim()).filter(Boolean);
  out.pushStatePath = String(out.pushStatePath || 'data/twitter-push-state.json');
  out.twitterCookie = String(out.twitterCookie || '').trim();
  out.twitterCookieFile = String(out.twitterCookieFile || '').trim();
  out.authToken = String(out.authToken || '').trim();
  out.ct0 = String(out.ct0 || '').trim();
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

function resolveCookie() {
  if (currentConfig.twitterCookie) return currentConfig.twitterCookie;
  try {
    if (currentConfig.twitterCookieFile && fs.existsSync(currentConfig.twitterCookieFile)) {
      return fs.readFileSync(currentConfig.twitterCookieFile, 'utf-8').trim();
    }
  } catch {}
  if (currentConfig.authToken && currentConfig.ct0) {
    return `dnt=1; auth_token=${currentConfig.authToken}; ct0=${currentConfig.ct0};`;
  }
  return '';
}

function buildTwitterHeaders(cookie) {
  return {
    'User-Agent': BROWSER_UA,
    Origin: 'https://publish.twitter.com',
    ...(cookie ? { Cookie: cookie } : {})
  };
}

async function fetchText(url, cookie) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), currentConfig.requestTimeoutMs + 5000);
  try {
    const response = await fetch(url, { headers: buildTwitterHeaders(cookie), signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`http_${response.status}${text ? `:${text.slice(0, 120)}` : ''}`);
    }
    return text;
  } finally {
    clearTimeout(timerId);
  }
}

async function fetchJson(url, cookie) {
  const text = await fetchText(url, cookie);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`json_parse_failed:${String(error)}|${text.slice(0, 120)}`);
  }
}

function extractTimelineData(html) {
  const match = String(html || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match?.[1]) throw new Error('timeline_data_missing');
  return match[1];
}

async function fetchTimelineEntries(handle) {
  const cookie = resolveCookie();
  const html = await fetchText(`${TIMELINE_URL}${encodeURIComponent(handle)}`, cookie);
  const data = JSON.parse(extractTimelineData(html));
  return data?.props?.pageProps?.timeline?.entries || [];
}

function filterTimelineTweets(entries) {
  return entries
    .map((entry) => entry?.content?.tweet || null)
    .filter(Boolean)
    .filter((tweet) => !tweet?.in_reply_to_name)
    .filter((tweet) => !String(tweet?.text || '').startsWith('RT @'));
}

function tokenFromID(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

async function fetchTweetById(id) {
  const sid = String(id || '').trim();
  if (!sid) return null;
  const url = new URL(TWEET_URL);
  url.searchParams.set('id', sid);
  url.searchParams.set('token', tokenFromID(sid));
  url.searchParams.set('dnt', '1');
  const data = await fetchJson(url.toString(), resolveCookie());
  return data && Object.keys(data).length ? data : null;
}

function formatTs(ts) {
  const date = ts ? new Date(ts) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

function cqEscape(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/,/g, '&#44;');
}

function extractTweetText(tweet) {
  return String(tweet?.full_text || tweet?.text || '').trim();
}

function extractTweetImageUrls(tweet) {
  const urls = [];
  const add = (url) => {
    const s = String(url || '').trim();
    if (!s || !/^https?:\/\//i.test(s) || urls.includes(s)) return;
    urls.push(s);
  };

  for (const media of (tweet?.extended_entities?.media || [])) {
    add(media?.media_url_https || media?.media_url || media?.url);
  }
  for (const media of (tweet?.entities?.media || [])) {
    add(media?.media_url_https || media?.media_url || media?.url);
  }
  for (const media of (tweet?.media || [])) {
    add(media?.media_url_https || media?.media_url || media?.url);
  }

  if (!urls.length && tweet?.retweeted_status) {
    return extractTweetImageUrls(tweet.retweeted_status);
  }

  return urls.slice(0, 6);
}

function findQuotedTweetId(tweet) {
  const currentId = String(tweet?.id_str || tweet?.id || '');
  const urls = []
    .concat(tweet?.entities?.urls || [])
    .concat(tweet?.quoted_status_permalink ? [tweet.quoted_status_permalink] : []);

  for (const item of urls) {
    const value = String(item?.expanded_url || item?.url || '').trim();
    const match = value.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/i);
    if (match?.[1] && match[1] !== currentId) return match[1];
  }
  return '';
}

async function resolveQuoteSource(tweet) {
  try {
    const quoteId = findQuotedTweetId(tweet);
    if (!quoteId) return null;
    const source = await fetchTweetById(quoteId);
    if (!source?.text) return null;
    const author = source?.user?.screen_name || source?.user?.name || '引用推文';
    return {
      text: `//@${author}:${String(source.text || '').trim()}`,
      images: extractTweetImageUrls(source)
    };
  } catch {
    return null;
  }
}

function toWeiboStyleRetweetText(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/^RT\s+@([^:]+):\s*([\s\S]+)$/i);
  if (!match) return { text: raw, hasSource: false };
  return { text: `//@${match[1]}:${String(match[2] || '').trim()}`, hasSource: true };
}

async function formatTweet(tweet) {
  const ts = formatTs(tweet?.created_at || tweet?.createdAt);
  const rawText = extractTweetText(tweet);
  let body = rawText;
  let imageUrls = extractTweetImageUrls(tweet);

  if (tweet?.retweeted_status) {
    const sourceAuthor = tweet?.retweeted_status?.user?.screen_name || '原作者';
    const sourceText = extractTweetText(tweet.retweeted_status);
    const parsed = toWeiboStyleRetweetText(rawText);
    body = parsed.hasSource ? parsed.text : `//@${sourceAuthor}:${sourceText}`;
    imageUrls = imageUrls.slice(0, 1);
  } else {
    const quoteSource = await resolveQuoteSource(tweet);
    if (quoteSource?.text) {
      body = `${rawText}${rawText ? '\n\n' : ''}${quoteSource.text}`;
      if (!imageUrls.length && quoteSource.images?.length) imageUrls = quoteSource.images;
      imageUrls = imageUrls.slice(0, 1);
    }
  }

  const images = imageUrls.map((url) => `[CQ:image,file=${cqEscape(url)}]`);
  return images.length ? `${ts ? `${ts}\n\n` : ''}${body}\n${images.join('\n')}` : `${ts ? `${ts}\n\n` : ''}${body}`;
}

async function getTimelineTweets(handle, limit = 10) {
  const entries = await fetchTimelineEntries(handle);
  const tweets = filterTimelineTweets(entries)
    .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime());
  return tweets.slice(0, Math.max(1, limit));
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

async function handleList(ctx, event) {
  if (!currentConfig.handle) return sendMsg(ctx, event, '请先在配置里设置 handle');
  const items = await getTimelineTweets(currentConfig.handle, 8);
  if (!items.length) return sendMsg(ctx, event, '暂无推文数据');
  const top = items.slice(0, 8).map((item, index) => `${index + 1}. ${extractTweetText(item).replace(/\n/g, ' ').slice(0, 50)}...`).join('\n');
  return sendMsg(ctx, event, `推特列表(@${currentConfig.handle})：\n${top}\n\n可发：第N条推特`);
}

async function handleDetail(ctx, event, idx) {
  if (!currentConfig.handle) return sendMsg(ctx, event, '请先在配置里设置 handle');
  const items = await getTimelineTweets(currentConfig.handle, Math.max(8, idx + 2));
  const tweet = items[idx - 1];
  if (!tweet) return sendMsg(ctx, event, '序号超出范围');
  return sendMsg(ctx, event, await formatTweet(tweet));
}

function startPoller() {
  if (timer) clearInterval(timer);
  timer = setInterval(async () => {
    if (!ctxRef || !currentConfig.enabled || !currentConfig.handle) return;
    try {
      const items = await getTimelineTweets(currentConfig.handle, 8);
      const latest = items[0];
      if (!latest?.id_str) return;

      const key = currentConfig.handle;
      const oldId = String(state.lastTweetIdByHandle[key] || '');
      const latestId = String(latest.id_str);
      if (oldId === latestId) return;
      state.lastTweetIdByHandle[key] = latestId;
      saveState();
      if (!oldId) return;

      const message = await formatTweet(latest);
      for (const [gid, enabled] of Object.entries(state.enabledGroups || {})) {
        if (!enabled) continue;
        await sendGroup(gid, message);
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
    ctx.NapCatConfig.text('commandPrefix', '命令前缀', '/', ''),
    ctx.NapCatConfig.text('handle', 'X账号', '', '填主页链接里 / 后面的用户名，例如 x.com/OpenAI 里的 OpenAI'),
    ctx.NapCatConfig.number('pollMinutes', '轮询间隔 (分钟)', 120, '1-1440'),
    ctx.NapCatConfig.number('requestTimeoutMs', '请求超时(ms)', 15000, '3000-60000'),
    ctx.NapCatConfig.text('pushStatePath', '状态文件路径', 'data/twitter-push-state.json', ''),
    ctx.NapCatConfig.text('twitterCookieFile', 'Twitter Cookie文件', '', '可选，某些环境下可提升抓取稳定性'),
    ctx.NapCatConfig.text('twitterCookie', 'Twitter Cookie字符串', '', '可直接粘贴 Cookie，可选'),
    ctx.NapCatConfig.text('adminQqList', '管理员QQ(逗号分隔)', '', '可控制开启/关闭推送')
  );

  try {
    if (ctx.configPath && fs.existsSync(ctx.configPath)) {
      currentConfig = sanitizeConfig(JSON.parse(fs.readFileSync(ctx.configPath, 'utf-8')));
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
export const plugin_on_config_change = async (ctx, ui, key, value, cur) => {
  currentConfig = sanitizeConfig(cur);
  startPoller();
};
export const plugin_onevent = async () => {};
export const plugin_cleanup = async () => {
  if (timer) clearInterval(timer);
  timer = null;
};
