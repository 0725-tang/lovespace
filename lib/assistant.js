'use strict';

const DAY = 24 * 60 * 60 * 1000;

function daysSince(dateString) {
  const time = new Date(dateString).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / DAY));
}

function pickMemory(data, query) {
  const memories = data.memories || [];
  if (!memories.length) return null;
  const keywords = ['海', '雪', '雨', '生日', '电影', '家', '跨年', '第一次', '旅行'];
  const hit = keywords.find((keyword) => query.includes(keyword));
  if (hit) {
    const matched = memories.find((memory) => (memory.title + memory.body + memory.tags.join(' ')).includes(hit));
    if (matched) return matched;
  }
  return memories[Math.floor(Math.random() * memories.length)];
}

function localReply(messages, data) {
  const site = data.site || {};
  const couple = site.couple || {};
  const me = couple.me || '我';
  const her = couple.her || '你';
  const query = String((messages[messages.length - 1] || {}).content || '').trim();
  const days = daysSince(couple.anniversary);
  const city = couple.city || '你们所在的城市';
  const latest = (data.memories || [])[0];
  const memory = pickMemory(data, query);

  if (/多久|在一起|几天|纪念日|相爱/.test(query)) {
    return '从 ' + (couple.anniversary || '那一天') + ' 到现在，你们已经相爱 ' + days + ' 天啦。\n\n按小时算，是 ' + Math.floor(days * 24) + ' 个小时；按心跳算，就数不清了。要不要把今天也记进回忆库？';
  }
  if (/回忆|故事|照片|第一次|记得/.test(query) && memory) {
    return '给你翻到一段回忆：\n\n**' + memory.date + ' · ' + memory.title + '**\n' + (memory.quote || memory.excerpt) + '\n\n' + (memory.place ? '地点：' + memory.place + '。' : '') + '有些细节你以为忘了，其实只是藏进了某个瞬间里。';
  }
  if (/约会|去哪|周末|安排|计划|见面/.test(query)) {
    return '给你们三个不费力的约会方案：\n\n1. **回到第一次见面的地方**：不用刻意安排，走一遍当时的路，再拍一张同角度的照片。\n2. **一场“只买一样东西”的超市约会**：各自给对方挑一件 20 元以内的小东西，回家交换。\n3. **' + city + ' 的傍晚散步**：买一杯热饮，关掉导航，走到哪算哪。\n\n小提示：把见面那天写进 content/memories/ 文件夹，以后小星就能帮你们翻出来。';
  }
  if (/惊喜|礼物|仪式感|生日/.test(query)) {
    return '比起贵，惊喜更重要的是“被看见”。可以试试：\n\n- 把这天的照片做成一张只属于她的网页，链接发过去。\n- 录一段 30 秒语音，讲一件你记得、她以为你忘了的小事。\n- 在留言簿里先写一句，再假装不经意地让她点开。\n\n如果你愿意，我还可以陪你把惊喜的流程写成清单。';
  }
  if (/情话|文案|写|表白|土味/.test(query)) {
    return '给你两句，挑一句顺眼的：\n\n> “我不太懂宇宙，但我知道，所有星轨里我最想停下的那一站，是你。”\n\n> “遇见你之后，我的日子没有变短，只是每一天都值得被记住。”\n\n要不要我再按你们的真实回忆写一版？';
  }
  if (/生气|吵架|哄|道歉|不开心|难过/.test(query)) {
    return '先别急着讲道理，试试这个顺序：\n\n1. 先说“我在”，不是“你别想太多”。\n2. 说清楚你看见了她哪一点难受，而不是急着解释自己。\n3. 给一个具体的下一步，比如“今晚我来找你，我们边走边说”。\n\n如果她需要安静，也记得留一句：\n\n> “我在这儿，等你准备好再聊。”';
  }
  if (/吃什么|晚饭|夜宵|奶茶/.test(query)) {
    return '今晚可以吃点有回忆的：你们第一次约会吃过的那家，或者干脆去超市各挑三样，回家做一顿“盲盒晚餐”。\n\n如果她今天很累，就别问“吃什么”了，直接带着她常点的那份出现。';
  }
  if (/你好|在吗|嗨|hi|hello/i.test(query) || !query) {
    return '我在。你可以问我：你们在一起多久了、翻一段回忆、规划一次约会，或者让我帮你想一句只给她看的话。';
  }
  return '我记下了。\n\n' + (latest ? '你们最近的一条回忆是 **' + latest.title + '**（' + latest.date + '）。' : '') + '如果你想，我可以：\n\n- 把这句话扩成一段情书\n- 按你们的回忆规划一次约会\n- 想一个不落俗套的小惊喜\n\n也可以直接告诉我：她最近在为什么开心，或者为什么烦心。';
}

function buildSystemPrompt(data) {
  const site = data.site || {};
  const couple = site.couple || {};
  const memories = (data.memories || []).slice(0, 12).map((memory) => {
    const body = String(memory.body || '').slice(0, 700);
    return '- ' + memory.date + '《' + memory.title + '》' + (memory.place ? ' @' + memory.place : '') + '\n  ' + body;
  }).join('\n');
  return [
    '你是“' + ((site.assistant && site.assistant.name) || '小星') + '”，' + couple.me + ' 和 ' + couple.her + ' 的恋爱小助手。',
    '你说话温柔、具体、不说教，偶尔有一点俏皮，但绝不油腻。',
    '你只能依据下面的真实资料回答关于他们的事实；资料没有的，就坦率说不知道，不要编造日期、地点和事件。',
    '涉及吵架、边界、隐私、心理健康时，优先倾听和尊重双方意愿，不替任何一方做决定。',
    '回答控制在 180 字以内，除非用户要求写长文。可以用少量 Markdown。',
    '',
    '纪念日：' + (couple.anniversary || '未填写'),
    '城市：' + (couple.city || '未填写'),
    '照片数：' + ((data.stats && data.stats.photos) || 0),
    '回忆条目：' + ((data.stats && data.stats.memories) || 0),
    '',
    '真实回忆资料：',
    memories || '（还没有回忆条目）'
  ].join('\n');
}

function normalizeEndpoint(base) {
  const clean = String(base || '').replace(/\/+$/, '');
  if (!clean) return '';
  if (/\/chat\/completions$/.test(clean)) return clean;
  return clean + '/chat/completions';
}

function aiConfig(env = process.env) {
  return {
    endpoint: normalizeEndpoint(env.LOVE_AI_BASE_URL || env.OPENAI_BASE_URL),
    apiKey: env.LOVE_AI_API_KEY || env.OPENAI_API_KEY || '',
    model: env.LOVE_AI_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini'
  };
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
    .slice(-12)
    .map((message) => ({ role: message.role, content: String(message.content || '').slice(0, 2000) }))
    .filter((message) => message.content.trim());
}

async function generateReply(messages, data, options = {}) {
  const clean = sanitizeMessages(messages);
  const env = options.env || process.env;
  const config = aiConfig(env);
  const local = localReply(clean, data);
  if (!config.endpoint || !config.apiKey) {
    return { reply: local, offline: true, model: null, notice: '当前是本地模式：配置 LOVE_AI_BASE_URL 和 LOVE_AI_API_KEY 后，小星会变成真正的大模型助手。' };
  }
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + config.apiKey },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.8,
        max_tokens: 700,
        messages: [{ role: 'system', content: buildSystemPrompt(data) }, ...clean]
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const payload = await response.json();
    const reply = payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
    if (!reply) throw new Error('接口没有返回内容');
    return { reply: String(reply).trim(), offline: false, model: config.model, notice: null };
  } catch (error) {
    return { reply: local, offline: true, model: null, notice: '大模型接口暂时不可用（' + error.message + '），先用本地小星陪你聊。' };
  }
}

module.exports = { aiConfig, buildSystemPrompt, daysSince, generateReply, localReply, normalizeEndpoint, sanitizeMessages };
