'use strict';

(function () {
  var data = window.LOVESPACE_DATA;
  if (!data || !data.canEdit) return;

  var writeButton = document.getElementById('letterWrite');
  var editButton = document.getElementById('letterEdit');
  var modal = document.getElementById('letterEditor');
  var dialog = document.getElementById('letterEditorDialog');
  var form = document.getElementById('letterEditorForm');
  if (!writeButton || !editButton || !modal || !dialog || !form) return;

  var title = document.getElementById('letterEditorTitle');
  var codeInput = document.getElementById('letterEditorCode');
  var confirmInput = document.getElementById('letterEditorCodeConfirm');
  var hintInput = document.getElementById('letterEditorHint');
  var bodyInput = document.getElementById('letterEditorBody');
  var signatureInput = document.getElementById('letterEditorSignature');
  var psInput = document.getElementById('letterEditorPs');
  var submit = document.getElementById('letterEditorSubmit');
  var status = document.getElementById('letterEditorStatus');
  var closeButton = document.getElementById('letterEditorClose');
  var hasLetter = Boolean(data.site && data.site.letter && data.site.letter.encrypted);
  var lastFocus = null;

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message || '';
    status.className = 'memory-status' + (kind ? ' is-' + kind : '');
  }

  function setBusy(busy) {
    if (submit) {
      submit.disabled = busy;
      submit.textContent = busy ? '正在封好…' : '封好这封信';
    }
    Array.prototype.forEach.call(form.querySelectorAll('input, textarea'), function (node) {
      node.disabled = busy;
    });
  }

  function resetForm() {
    codeInput.value = '';
    confirmInput.value = '';
    hintInput.value = '';
    bodyInput.value = '';
    signatureInput.value = '';
    psInput.value = '';
  }

  function fillForm(letter) {
    codeInput.value = letter.code || '';
    confirmInput.value = letter.code || '';
    hintInput.value = letter.hint || '';
    bodyInput.value = (letter.paragraphs || []).join('\n\n');
    signatureInput.value = letter.signature || '';
    psInput.value = letter.ps || '';
  }

  async function openEditor(editing) {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    setStatus('', '');
    resetForm();
    if (title) title.textContent = editing ? '改一改这封信' : '写一封只给 TA 看的信';
    if (editing) {
      setBusy(true);
      setStatus('正在打开信封…', '');
      try {
        var response = await window.fetch('/api/letter', { headers: { accept: 'application/json' } });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(result.message || '读取情书失败。');
        if (result.letter) fillForm(result.letter);
        setStatus('', '');
      } catch (error) {
        setStatus(error.message, 'error');
      } finally {
        setBusy(false);
      }
    }
    window.setTimeout(function () {
      if (codeInput) codeInput.focus({ preventScroll: true });
    }, 80);
  }

  function closeEditor() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    setStatus('', '');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  }

  async function submitLetter(event) {
    event.preventDefault();
    var code = codeInput.value.trim();
    var confirm = confirmInput.value.trim();
    var body = bodyInput.value.trim();
    if (!code) {
      setStatus('先设置一个拆信暗号。', 'error');
      codeInput.focus();
      return;
    }
    if (code.length < 2) {
      setStatus('暗号至少 2 个字符。', 'error');
      codeInput.focus();
      return;
    }
    if (code !== confirm) {
      setStatus('两次输入的暗号不一样。', 'error');
      confirmInput.focus();
      return;
    }
    if (!body) {
      setStatus('情书正文不能为空。', 'error');
      bodyInput.focus();
      return;
    }

    setBusy(true);
    setStatus('正在把信折好、封上…', '');
    try {
      var response = await window.fetch('/api/letter', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          code: code,
          hint: hintInput.value.trim(),
          body: body,
          signature: signatureInput.value.trim(),
          ps: psInput.value.trim()
        })
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.message || '保存失败，请再试一次。');
      setStatus('信已经封好了，正在回到情书…', 'success');
      window.setTimeout(function () {
        window.location.hash = '#letter';
        window.location.reload();
      }, 700);
    } catch (error) {
      setStatus(error.message, 'error');
      setBusy(false);
    }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    var nodes = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
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

  if (hasLetter) {
    editButton.hidden = false;
    writeButton.hidden = true;
  } else {
    writeButton.hidden = false;
    editButton.hidden = true;
  }

  writeButton.addEventListener('click', function () { openEditor(false); });
  editButton.addEventListener('click', function () { openEditor(true); });
  closeButton.addEventListener('click', closeEditor);
  form.addEventListener('submit', submitLetter);
  modal.addEventListener('click', function (event) {
    if (event.target.hasAttribute('data-letter-editor-close')) closeEditor();
  });
  document.addEventListener('keydown', function (event) {
    if (modal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeEditor();
      return;
    }
    trapFocus(event);
  });
})();
