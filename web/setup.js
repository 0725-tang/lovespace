'use strict';

(function () {
  var form = document.getElementById('setupForm');
  if (!form) return;

  var me = document.getElementById('setupMe');
  var her = document.getElementById('setupHer');
  var anniversary = document.getElementById('setupAnniversary');
  var birthdayMe = document.getElementById('setupBirthdayMe');
  var birthdayHer = document.getElementById('setupBirthdayHer');
  var submit = document.getElementById('setupSubmit');
  var status = document.getElementById('setupStatus');

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function today() {
    var date = new Date();
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  var max = today();
  [anniversary, birthdayMe, birthdayHer].forEach(function (input) {
    if (input) input.max = max;
  });

  function setStatus(message, success) {
    if (!status) return;
    status.textContent = message || '';
    status.className = 'setup-status' + (success ? ' is-success' : '');
  }

  function validate() {
    if (!me.value.trim()) return '请填写你的名字。';
    if (!her.value.trim()) return '请填写恋人的名字。';
    if (!anniversary.value) return '请选择你们相爱的日期。';
    if (!birthdayMe.value) return '请选择你的生日。';
    if (!birthdayHer.value) return '请选择恋人的生日。';
    return '';
  }

  async function submitSetup(event) {
    event.preventDefault();
    var error = validate();
    if (error) {
      setStatus(error, false);
      return;
    }
    if (!window.fetch) {
      setStatus('这个浏览器不支持提交，请换一个浏览器。', false);
      return;
    }

    submit.disabled = true;
    submit.querySelector('span').textContent = '正在点亮宇宙…';
    setStatus('', false);
    try {
      var response = await window.fetch('/api/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          me: me.value.trim(),
          her: her.value.trim(),
          anniversary: anniversary.value,
          birthdayMe: birthdayMe.value,
          birthdayHer: birthdayHer.value
        })
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.message || '创建失败，请再试一次。');
      setStatus('已经创建好了，正在进入你们的宇宙…', true);
      window.setTimeout(function () {
        window.location.href = result.redirect || '/';
      }, 500);
    } catch (failure) {
      setStatus(failure.message, false);
      submit.disabled = false;
      submit.querySelector('span').textContent = '创建恋爱空间';
    }
  }

  form.addEventListener('submit', submitSetup);
})();
