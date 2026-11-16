'use strict';

(function () {
  var data = window.LOVESPACE_DATA;
  if (!data || !data.canEdit) return;

  var trigger = document.getElementById('spaceDelete');
  var modal = document.getElementById('spaceModal');
  var dialog = document.getElementById('spaceDialog');
  var title = document.getElementById('spaceModalTitle');
  var stepText = document.getElementById('spaceStepText');
  var stepCount = document.getElementById('spaceStepCount');
  var status = document.getElementById('spaceStatus');
  var confirm = document.getElementById('spaceConfirm');
  var cancel = document.getElementById('spaceCancel');
  var close = document.getElementById('spaceClose');
  if (!trigger || !modal || !dialog || !confirm) return;

  var steps = [
    '这会删除你们的名字、相爱日期、生日、照片、回忆、留言和情书。程序本身不会删除。',
    '删除后没有回收站，也不能恢复。照片和情书会一起消失。还要继续吗？',
    '最后确认：现在注销这个恋爱空间，回到初始化页面？'
  ];
  var step = 0;
  var busy = false;
  var lastFocus = null;

  function setStatus(message) {
    if (status) status.textContent = message || '';
  }

  function render() {
    if (stepText) stepText.textContent = steps[step] || steps[steps.length - 1];
    if (stepCount) stepCount.textContent = (step + 1) + ' / 3';
    if (confirm) {
      confirm.textContent = step < 2 ? '第 ' + (step + 1) + ' 次确认' : '第 3 次确认 · 注销';
      confirm.disabled = busy;
    }
  }

  function open() {
    lastFocus = document.activeElement;
    step = 0;
    busy = false;
    setStatus('');
    render();
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    window.setTimeout(function () { confirm.focus({ preventScroll: true }); }, 70);
  }

  function closeModal() {
    if (modal.hidden || busy) return;
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    setStatus('');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  }

  async function next() {
    if (busy) return;
    if (step < 2) {
      step += 1;
      setStatus('');
      render();
      return;
    }

    busy = true;
    confirm.disabled = true;
    confirm.textContent = '正在注销…';
    setStatus('正在删除本机的恋爱空间…');
    try {
      var response = await window.fetch('/api/setup', { method: 'DELETE' });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.message || '注销失败，请再试一次。');
      window.location.href = result.redirect || '/setup';
    } catch (error) {
      busy = false;
      setStatus(error.message);
      render();
    }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    var nodes = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
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

  trigger.hidden = false;
  trigger.addEventListener('click', open);
  confirm.addEventListener('click', next);
  if (cancel) cancel.addEventListener('click', closeModal);
  if (close) close.addEventListener('click', closeModal);
  modal.addEventListener('click', function (event) {
    if (event.target.hasAttribute('data-space-close')) closeModal();
  });
  document.addEventListener('keydown', function (event) {
    if (modal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    trapFocus(event);
  });
})();
