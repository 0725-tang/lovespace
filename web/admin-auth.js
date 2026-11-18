'use strict';

(function () {
  var data = window.LOVESPACE_DATA;
  if (!data) return;

  var passwordButton = document.getElementById('editorPassword');
  var loginButton = document.getElementById('editorLogin');
  var logoutButton = document.getElementById('editorLogout');
  var modal = document.getElementById('editorAuthModal');
  var dialog = document.getElementById('editorAuthDialog');
  var form = document.getElementById('editorAuthForm');
  if (!passwordButton || !loginButton || !logoutButton || !modal || !form) return;

  var title = document.getElementById('editorAuthTitle');
  var text = document.getElementById('editorAuthText');
  var passwordInput = document.getElementById('editorAuthPassword');
  var confirmField = document.getElementById('editorAuthConfirmField');
  var confirmInput = document.getElementById('editorAuthConfirm');
  var submit = document.getElementById('editorAuthSubmit');
  var status = document.getElementById('editorAuthStatus');
  var closeButton = document.getElementById('editorAuthClose');
  var mode = 'login';
  var lastFocus = null;

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message || '';
    status.className = 'memory-status' + (kind ? ' is-' + kind : '');
  }

  function setBusy(busy) {
    submit.disabled = busy;
    submit.textContent = busy ? '正在验证…' : (mode === 'set' ? '保存密码' : '进入管理模式');
  }

  function open(modeName) {
    mode = modeName;
    lastFocus = document.activeElement;
    passwordInput.value = '';
    confirmInput.value = '';
    confirmField.hidden = mode !== 'set';
    setStatus('', '');
    setBusy(false);
    if (mode === 'set') {
      title.textContent = data.editorEnabled ? '修改公网管理密码' : '设置公网管理密码';
      text.textContent = '设置后，在公网链接上输入这个密码，就能添加照片、回忆和删除留言。';
      submit.textContent = '保存密码';
    } else {
      title.textContent = '管理这个空间';
      text.textContent = '输入管理密码后，可以在公网链接上添加照片、写回忆和删除留言。';
      submit.textContent = '进入管理模式';
    }
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    window.setTimeout(function () { passwordInput.focus({ preventScroll: true }); }, 70);
  }

  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    setStatus('', '');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  }

  async function submitForm(event) {
    event.preventDefault();
    var password = passwordInput.value;
    if (password.length < 4) {
      setStatus('管理密码至少 4 个字符。', 'error');
      passwordInput.focus();
      return;
    }
    if (mode === 'set' && password !== confirmInput.value) {
      setStatus('两次输入的密码不一样。', 'error');
      confirmInput.focus();
      return;
    }

    setBusy(true);
    setStatus('', '');
    try {
      var endpoint = mode === 'set' ? '/api/editor/password' : '/api/editor/login';
      var response = await window.fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ password: password })
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.message || '操作失败。');
      setStatus(mode === 'set' ? '密码已保存，正在刷新…' : '验证通过，正在进入…', 'success');
      window.setTimeout(function () { window.location.reload(); }, 500);
    } catch (error) {
      setStatus(error.message, 'error');
      setBusy(false);
    }
  }

  async function logout() {
    logoutButton.disabled = true;
    try {
      var response = await window.fetch('/api/editor/logout', { method: 'POST' });
      if (!response.ok) throw new Error('退出失败。');
      window.location.reload();
    } catch (error) {
      logoutButton.disabled = false;
      window.alert(error.message);
    }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    var nodes = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
      .filter(function (node) { return node.offsetParent !== null; });
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (data.localEditor) {
    passwordButton.hidden = false;
    passwordButton.textContent = data.editorEnabled ? '修改公网管理密码' : '设置公网管理密码';
  } else if (data.editorLoggedIn) {
    logoutButton.hidden = false;
  } else if (data.editorEnabled) {
    loginButton.hidden = false;
  }

  passwordButton.addEventListener('click', function () { open('set'); });
  loginButton.addEventListener('click', function () { open('login'); });
  logoutButton.addEventListener('click', logout);
  closeButton.addEventListener('click', close);
  form.addEventListener('submit', submitForm);
  modal.addEventListener('click', function (event) {
    if (event.target.hasAttribute('data-editor-auth-close')) close();
  });
  document.addEventListener('keydown', function (event) {
    if (modal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    trapFocus(event);
  });
})();
