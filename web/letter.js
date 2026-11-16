'use strict';

(function () {
  var data = window.LOVESPACE_DATA;
  if (!data) return;

  var site = data.site || {};
  var letter = site.letter || {};
  var cipher = letter.cipher || null;
  var encrypted = Boolean(letter.encrypted && cipher);
  var unlocked = false;
  var payload = null;
  var lastFocus = null;

  var modal = document.getElementById('letterModal');
  var dialog = document.getElementById('letterDialog');
  var lockView = document.getElementById('letterLockView');
  var content = document.getElementById('letterContent');
  var codeInput = document.getElementById('letterCode');
  var form = document.getElementById('letterForm');
  var submit = document.getElementById('letterSubmit');
  var errorBox = document.getElementById('letterError');
  var openButton = document.getElementById('letterOpen');
  var envelope = document.getElementById('envelope');
  var emptyNote = document.getElementById('letterEmpty');
  var hintBox = document.getElementById('letterHintBox');
  if (!modal || !dialog || !lockView || !content || !form) return;

  if (!encrypted || !cipher) {
    if (emptyNote) emptyNote.hidden = false;
    if (hintBox) hintBox.hidden = true;
    if (openButton) openButton.hidden = true;
    if (envelope) {
      envelope.classList.add('is-inert');
      envelope.setAttribute('aria-disabled', 'true');
      envelope.removeAttribute('role');
      envelope.removeAttribute('tabindex');
    }
    return;
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function bytesFromBase64(value) {
    var binary = window.atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function concatBytes(first, second) {
    var result = new Uint8Array(first.length + second.length);
    result.set(first, 0);
    result.set(second, first.length);
    return result;
  }

  async function decryptLetter(sealed, code) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('unsupported');
    }
    var encoder = new TextEncoder();
    var material = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(code),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    var key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: bytesFromBase64(sealed.salt),
        iterations: sealed.iterations || 120000,
        hash: 'SHA-256'
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    var encryptedBytes = concatBytes(bytesFromBase64(sealed.data), bytesFromBase64(sealed.tag));
    var plain = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytesFromBase64(sealed.iv), tagLength: 128 },
      key,
      encryptedBytes
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function formatToday() {
    var date = new Date();
    return date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');
  }

  function clearError() {
    if (errorBox) errorBox.textContent = '';
    if (codeInput) codeInput.classList.remove('is-error');
  }

  function setError(message) {
    if (errorBox) errorBox.textContent = message;
    if (codeInput) codeInput.classList.add('is-error');
  }

  function setBusy(busy) {
    if (!submit) return;
    submit.disabled = busy;
    submit.textContent = busy ? '拆信中…' : '拆开信';
  }

  function showLock() {
    lockView.hidden = false;
    content.hidden = true;
    clearError();
    setBusy(false);
    if (codeInput) {
      codeInput.value = '';
      codeInput.disabled = false;
    }
    window.setTimeout(function () {
      if (codeInput) codeInput.focus({ preventScroll: true });
    }, 80);
  }

  function makeConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var box = document.getElementById('letterConfetti');
    if (!box) return;
    box.innerHTML = '';
    for (var i = 0; i < 14; i++) {
      var heart = document.createElement('span');
      heart.textContent = '♥';
      heart.style.left = (4 + Math.random() * 92) + '%';
      heart.style.fontSize = (8 + Math.random() * 11).toFixed(1) + 'px';
      heart.style.animationDelay = (Math.random() * 1.4).toFixed(2) + 's';
      heart.style.animationDuration = (3.2 + Math.random() * 1.4).toFixed(2) + 's';
      box.appendChild(heart);
    }
  }

  function showLetter(result, animate) {
    payload = result;
    unlocked = true;
    lockView.hidden = true;
    content.hidden = false;
    clearError();
    setBusy(false);
    setText('letterDate', formatToday());
    setText('letterRevealTitle', '致 ' + ((site.couple && site.couple.her) || '你'));
    var box = document.getElementById('letterParagraphs');
    if (box) {
      box.innerHTML = '';
      var paragraphs = Array.isArray(result.paragraphs) ? result.paragraphs : [];
      paragraphs.forEach(function (text, index) {
        var p = document.createElement('p');
        p.textContent = text;
        p.style.setProperty('--i', String(index));
        box.appendChild(p);
      });
    }
    var signature = document.getElementById('letterSignature');
    if (signature) {
      signature.textContent = result.signature || '';
      signature.hidden = !result.signature;
    }
    var ps = document.getElementById('letterPs');
    if (ps) {
      ps.textContent = result.ps || '';
      ps.hidden = !result.ps;
    }
    if (animate) makeConfetti();
    if (openButton && openButton.firstElementChild) openButton.firstElementChild.textContent = '再读一遍';
    if (letter) letter.read = true;
    window.setTimeout(function () {
      var close = document.getElementById('letterClose');
      if (close) close.focus({ preventScroll: true });
    }, 240);
  }

  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    if (unlocked && payload) showLetter(payload, false);
    else showLock();
    window.setTimeout(function () {
      if (dialog) dialog.focus({ preventScroll: true });
    }, 30);
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    clearError();
    if (codeInput) codeInput.value = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  }

  async function submitCode(event) {
    event.preventDefault();
    if (!encrypted) {
      setError('这封信还没有设置暗号。请在 content/site.json 里填写 letter.code。');
      return;
    }
    var code = codeInput ? codeInput.value.trim() : '';
    if (!code) {
      setError('先输入暗号，再看信。');
      if (codeInput) codeInput.focus();
      return;
    }
    clearError();
    setBusy(true);
    if (codeInput) codeInput.disabled = true;
    try {
      var result = await decryptLetter(cipher, code);
      if (codeInput) codeInput.value = '';
      showLetter(result, true);
    } catch (error) {
      dialog.classList.add('is-shaking');
      window.setTimeout(function () { dialog.classList.remove('is-shaking'); }, 460);
      if (error && error.message === 'unsupported') {
        setError('这个浏览器暂时不支持加密信件。请换一个现代浏览器，或通过本地服务打开。');
      } else {
        setError('暗号不对，再想想。');
      }
      if (codeInput) {
        codeInput.disabled = false;
        codeInput.focus();
        codeInput.select();
      }
      setBusy(false);
    }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab' || !dialog) return;
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

  if (openButton) openButton.addEventListener('click', openModal);
  if (envelope) {
    envelope.addEventListener('click', openModal);
    envelope.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal();
      }
    });
  }
  var closeButton = document.getElementById('letterClose');
  if (closeButton) closeButton.addEventListener('click', closeModal);
  var foldButton = document.getElementById('letterFold');
  if (foldButton) foldButton.addEventListener('click', closeModal);
  modal.addEventListener('click', function (event) {
    if (event.target.hasAttribute('data-letter-close')) closeModal();
  });
  form.addEventListener('submit', submitCode);
  if (codeInput) {
    codeInput.addEventListener('input', clearError);
  }
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
