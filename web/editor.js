'use strict';

(function () {
  var data = window.LOVESPACE_DATA;
  if (!data || !data.canEdit) return;

  var openButton = document.getElementById('memoryOpen');
  var modal = document.getElementById('memoryModal');
  var dialog = document.getElementById('memoryDialog');
  var form = document.getElementById('memoryForm');
  if (!openButton || !modal || !dialog || !form) return;

  var dateInput = document.getElementById('memoryDate');
  var titleInput = document.getElementById('memoryTitle');
  var placeInput = document.getElementById('memoryPlace');
  var moodInput = document.getElementById('memoryMood');
  var weatherInput = document.getElementById('memoryWeather');
  var tagsInput = document.getElementById('memoryTags');
  var quoteInput = document.getElementById('memoryQuote');
  var bodyInput = document.getElementById('memoryBody');
  var coverInput = document.getElementById('memoryCover');
  var photoInput = document.getElementById('memoryPhoto');
  var photoPreview = document.getElementById('memoryPhotoPreview');
  var photoImage = document.getElementById('memoryPhotoImage');
  var photoInfo = document.getElementById('memoryPhotoInfo');
  var photoClear = document.getElementById('memoryPhotoClear');
  var submit = document.getElementById('memorySubmit');
  var status = document.getElementById('memoryStatus');
  var closeButton = document.getElementById('memoryClose');
  var photoFile = null;
  var photoBusy = false;
  var lastFocus = null;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function today() {
    var date = new Date();
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message || '';
    status.className = 'memory-status' + (kind ? ' is-' + kind : '');
  }

  function populateCovers() {
    if (!coverInput) return;
    var photos = Array.isArray(data.photos) ? data.photos : [];
    photos.forEach(function (photo) {
      var option = document.createElement('option');
      option.value = photo.src;
      option.textContent = photo.caption + (photo.place ? ' · ' + photo.place : '');
      coverInput.appendChild(option);
    });
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function loadBitmap(file) {
    if (window.createImageBitmap) return window.createImageBitmap(file);
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var url = URL.createObjectURL(file);
      image.onload = function () {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('这张图片读不了。'));
      };
      image.src = url;
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('读取图片失败。')); };
      reader.readAsDataURL(blob);
    });
  }

  async function preparePhoto(file) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      throw new Error('请选择 JPG、PNG 或 WebP 图片。');
    }
    var bitmap;
    try {
      bitmap = await loadBitmap(file);
    } catch (error) {
      throw new Error('这张图片读不了，请换一张 JPG、PNG 或 WebP。');
    }
    var width = bitmap.width || bitmap.naturalWidth;
    var height = bitmap.height || bitmap.naturalHeight;
    var scale = Math.min(1, 1600 / Math.max(width, height));
    var targetWidth = Math.max(1, Math.round(width * scale));
    var targetHeight = Math.max(1, Math.round(height * scale));
    var canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    var context = canvas.getContext('2d');
    context.fillStyle = '#0b0812';
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    if (bitmap.close) bitmap.close();
    var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', 0.86); });
    if (!blob) throw new Error('图片压缩失败，请换一张再试。');
    var data = await blobToDataUrl(blob);
    return {
      name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
      type: 'image/jpeg',
      data: data,
      width: targetWidth,
      height: targetHeight,
      size: blob.size
    };
  }

  function markUploadOption(name) {
    if (!coverInput) return;
    var existing = coverInput.querySelector('option[data-upload]');
    if (existing) existing.remove();
    var option = document.createElement('option');
    option.value = '';
    option.textContent = '使用上传的照片：' + name;
    option.setAttribute('data-upload', '1');
    coverInput.insertBefore(option, coverInput.firstChild);
    coverInput.value = '';
    coverInput.disabled = true;
  }

  function clearPhoto() {
    photoFile = null;
    if (photoInput) photoInput.value = '';
    if (photoPreview) photoPreview.hidden = true;
    if (photoImage) photoImage.removeAttribute('src');
    if (photoInfo) photoInfo.textContent = '';
    if (coverInput) {
      var uploadedOption = coverInput.querySelector('option[data-upload]');
      if (uploadedOption) uploadedOption.remove();
      coverInput.value = '';
      coverInput.disabled = false;
    }
    setStatus('', '');
  }

  async function handlePhoto(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    photoBusy = true;
    if (submit) submit.disabled = true;
    setStatus('正在压缩图片…', '');
    try {
      photoFile = await preparePhoto(file);
      if (photoPreview) photoPreview.hidden = false;
      if (photoImage) photoImage.src = photoFile.data;
      if (photoInfo) photoInfo.textContent = photoFile.name + ' · ' + photoFile.width + '×' + photoFile.height + ' · ' + formatBytes(photoFile.size);
      markUploadOption(photoFile.name);
      setStatus('照片已准备好，保存时会一起放进照片墙。', '');
    } catch (error) {
      clearPhoto();
      setStatus(error.message, 'error');
      event.target.value = '';
    } finally {
      photoBusy = false;
      if (submit) submit.disabled = false;
    }
  }


  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    if (dateInput && !dateInput.value) dateInput.value = today();
    setStatus('', '');
    window.setTimeout(function () {
      if (titleInput) titleInput.focus({ preventScroll: true });
    }, 80);
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    setStatus('', '');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  }

  function setBusy(busy) {
    if (submit) {
      submit.disabled = busy;
      submit.textContent = busy ? '正在保存…' : '保存这篇回忆';
    }
    Array.prototype.forEach.call(form.querySelectorAll('input, select, textarea'), function (node) {
      node.disabled = busy;
    });
    if (!busy && coverInput) coverInput.disabled = Boolean(photoFile);
  }

  async function submitMemory(event) {
    event.preventDefault();
    if (photoBusy) {
      setStatus('照片还在处理中，稍等一下。', 'error');
      return;
    }
    var date = dateInput ? dateInput.value : '';
    var title = titleInput ? titleInput.value.trim() : '';
    var body = bodyInput ? bodyInput.value.trim() : '';
    if (!date) {
      setStatus('先选一个日期。', 'error');
      if (dateInput) dateInput.focus();
      return;
    }
    if (!title) {
      setStatus('还差一个标题。', 'error');
      if (titleInput) titleInput.focus();
      return;
    }
    if (!body) {
      setStatus('还没有写正文。', 'error');
      if (bodyInput) bodyInput.focus();
      return;
    }

    var payload = {
      date: date,
      title: title,
      place: placeInput ? placeInput.value.trim() : '',
      mood: moodInput ? moodInput.value.trim() : '',
      weather: weatherInput ? weatherInput.value.trim() : '',
      tags: tagsInput ? tagsInput.value.trim() : '',
      quote: quoteInput ? quoteInput.value.trim() : '',
      body: body,
      cover: coverInput ? coverInput.value : '',
      photo: photoFile || undefined
    };

    setBusy(true);
    setStatus('正在把这篇回忆写进 Markdown…', '');
    try {
      var response = await window.fetch('/api/memories', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        if (response.status === 403) throw new Error('这个入口只在本机可用。请用电脑上的 localhost 打开网站。');
        throw new Error(result.message || '保存失败，请稍后再试。');
      }
      setStatus('已经写好，正在回到时间线…', 'success');
      window.setTimeout(function () {
        window.location.hash = '#timeline';
        window.location.reload();
      }, 850);
    } catch (error) {
      setStatus(error.message, 'error');
      setBusy(false);
    }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    var nodes = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
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

  populateCovers();
  openButton.hidden = false;
  openButton.addEventListener('click', openModal);
  if (closeButton) closeButton.addEventListener('click', closeModal);
  if (photoInput) photoInput.addEventListener('change', handlePhoto);
  if (photoClear) photoClear.addEventListener('click', clearPhoto);

  var timelineList = document.getElementById('timelineList');
  if (timelineList) {
    timelineList.addEventListener('click', async function (event) {
      var button = event.target.closest('.memory-delete');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      var slug = button.getAttribute('data-slug');
      var title = button.getAttribute('data-title') || '这篇回忆';
      if (!slug) return;
      if (!window.confirm('删除《' + title + '》？\n\n这篇回忆会从时间线消失，但封面照片会保留在照片墙。')) return;
      button.disabled = true;
      try {
        var response = await window.fetch('/api/memories?slug=' + encodeURIComponent(slug), { method: 'DELETE' });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(result.message || '删除失败。');
        window.location.hash = '#timeline';
        window.location.reload();
      } catch (error) {
        button.disabled = false;
        window.alert(error.message);
      }
    });
  }
  form.addEventListener('submit', submitMemory);
  modal.addEventListener('click', function (event) {
    if (event.target.hasAttribute('data-memory-close')) closeModal();
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
