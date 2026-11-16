'use strict';

(function () {
  var data = window.LOVESPACE_DATA;
  if (!data) return;

  var config = (data.site && data.site.guestbook) || {};
  var form = document.getElementById('guestbookForm');
  if (!form) return;

  var nameInput = document.getElementById('guestName');
  var messageInput = document.getElementById('guestMessage');
  var counter = document.getElementById('guestbookCounter');
  var submit = document.getElementById('guestbookSubmit');
  var submitText = document.getElementById('guestbookSubmitText');
  var status = document.getElementById('guestbookStatus');
  var grid = document.getElementById('guestbookMessages');
  var countNode = document.getElementById('guestbookCount');
  var meta = document.getElementById('guestbookMeta');
  var maxLength = 240;
  var messages = Array.isArray(data.guestbook) ? data.guestbook.slice() : [];
  var busy = false;

  function setText(node, value) {
    if (node) node.textContent = String(value);
  }

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message || '';
    status.className = 'guestbook-status' + (kind ? ' is-' + kind : '');
  }

  function updateCounter() {
    if (!messageInput || !counter) return;
    var length = Array.from(messageInput.value).length;
    counter.textContent = length + ' / ' + maxLength;
    counter.classList.toggle('is-near-limit', length > maxLength - 35);
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function formatWhen(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    var diff = Math.max(0, Date.now() - date.getTime());
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 86400000 * 7) return Math.floor(diff / 86400000) + ' 天前';
    return date.getFullYear() + '.' + pad(date.getMonth() + 1) + '.' + pad(date.getDate());
  }

  function hueFor(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
    return 300 + (hash % 60);
  }

  function makeEmpty() {
    var box = document.createElement('div');
    box.className = 'guestbook-empty';
    var star = document.createElement('span');
    star.className = 'guestbook-empty__star';
    star.textContent = '✦';
    box.appendChild(star);
    var text = document.createElement('p');
    text.textContent = config.empty || '还没有留言。第一句，留给你。';
    box.appendChild(text);
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = '写下第一句';
    button.addEventListener('click', function () {
      if (messageInput) messageInput.focus({ preventScroll: false });
    });
    box.appendChild(button);
    return box;
  }

  function makeNote(message, highlightId) {
    var note = document.createElement('article');
    note.className = 'guestbook-note';
    if (highlightId && message.id === highlightId) note.classList.add('is-new');
    note.setAttribute('data-id', message.id || '');
    var name = String(message.name || '匿名星尘');
    note.style.setProperty('--note-hue', String(hueFor(name)));

    var top = document.createElement('div');
    top.className = 'guestbook-note__top';
    var avatar = document.createElement('span');
    avatar.className = 'guestbook-note__avatar';
    avatar.textContent = Array.from(name)[0] || '星';
    top.appendChild(avatar);
    var nameNode = document.createElement('span');
    nameNode.className = 'guestbook-note__name';
    nameNode.textContent = name;
    top.appendChild(nameNode);
    var time = document.createElement('time');
    time.className = 'guestbook-note__time';
    time.textContent = formatWhen(message.createdAt);
    if (message.createdAt) time.setAttribute('datetime', message.createdAt);
    top.appendChild(time);
    note.appendChild(top);

    var text = document.createElement('p');
    text.className = 'guestbook-note__text';
    text.textContent = String(message.message || '');
    note.appendChild(text);
    return note;
  }

  function render(highlightId) {
    if (!grid) return;
    grid.innerHTML = '';
    if (!messages.length) {
      grid.appendChild(makeEmpty());
      setText(countNode, '0');
      setText(meta, '还没有留言');
      return;
    }
    messages.forEach(function (message) {
      grid.appendChild(makeNote(message, highlightId));
    });
    setText(countNode, String(messages.length));
    setText(meta, messages.length + ' 条留言');
  }

  function setDisabled(reason) {
    if (nameInput) nameInput.disabled = true;
    if (messageInput) messageInput.disabled = true;
    if (submit) submit.disabled = true;
    setText(submitText, '只读');
    setStatus(reason, '');
  }

  async function loadMessages() {
    if (config.enabled === false) {
      setDisabled('留言簿已关闭。');
      return;
    }
    if (!window.fetch) {
      setStatus('这个浏览器不支持在线留言，先显示打开页面时的快照。', 'error');
      return;
    }
    try {
      var response = await window.fetch('/api/guestbook', {
        headers: { accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var payload = await response.json();
      if (!Array.isArray(payload.messages)) throw new Error('返回格式不正确');
      messages = payload.messages;
      render();
    } catch (error) {
      setStatus('留言簿暂时无法同步，当前显示的是打开页面时的快照。', 'error');
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    if (busy || config.enabled === false) return;
    var message = messageInput ? messageInput.value.trim() : '';
    if (!message) {
      setStatus('还没有写字呢。', 'error');
      if (messageInput) messageInput.focus();
      return;
    }
    busy = true;
    if (submit) submit.disabled = true;
    setText(submitText, '正在留下…');
    setStatus('正在把这颗星星挂到墙上。', '');
    try {
      var response = await window.fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          name: nameInput ? nameInput.value.trim() : '',
          message: message
        })
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.message || '留言没有成功');
      messages = [payload.message].concat(messages.filter(function (item) { return item.id !== payload.message.id; }));
      if (messageInput) messageInput.value = '';
      updateCounter();
      setStatus('已经留在墙上了。她点开链接时，会看见。', 'success');
      render(payload.message.id);
    } catch (error) {
      setStatus(error.message || '留言没有成功，请稍后再试。', 'error');
    } finally {
      busy = false;
      if (submit) submit.disabled = false;
      setText(submitText, config.button || '把这句话留下');
    }
  }

  if (messageInput) {
    messageInput.addEventListener('input', function () {
      updateCounter();
      if (status && status.classList.contains('is-error')) setStatus('', '');
    });
  }
  if (nameInput) {
    nameInput.addEventListener('input', function () {
      if (status && status.classList.contains('is-error')) setStatus('', '');
    });
  }
  form.addEventListener('submit', submitMessage);

  updateCounter();
  setText(submitText, config.button || '把这句话留下');
  render();
  if (config.enabled !== false) loadMessages();
  else setDisabled('留言簿已关闭。');
})();
