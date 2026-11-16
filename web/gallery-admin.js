'use strict';

(function () {
  var data = window.LOVESPACE_DATA;
  if (!data || !data.canEdit) return;

  var addButton = document.getElementById('photoAdd');
  var modal = document.getElementById('photoModal');
  var dialog = document.getElementById('photoDialog');
  var form = document.getElementById('photoForm');
  if (!addButton || !modal || !dialog || !form) return;

  var fileInput = document.getElementById('photoFile');
  var preview = document.getElementById('photoPreview');
  var previewImage = document.getElementById('photoPreviewImage');
  var previewInfo = document.getElementById('photoPreviewInfo');
  var clearButton = document.getElementById('photoClear');
  var captionInput = document.getElementById('photoCaption');
  var dateInput = document.getElementById('photoDate');
  var placeInput = document.getElementById('photoPlace');
  var submit = document.getElementById('photoSubmit');
  var status = document.getElementById('photoStatus');
  var closeButton = document.getElementById('photoClose');
  var wall = document.getElementById('photoWall');
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
      image.onload = function () { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error('这张图片读不了。')); };
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
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片。');
    var bitmap;
    try {
      bitmap = await loadBitmap(file);
    } catch (error) {
      throw new Error('这张图片读不了，请换一张 JPG、PNG 或 WebP。');
    }
    var width = bitmap.width || bitmap.naturalWidth;
    var height = bitmap.height || bitmap.naturalHeight;
    var scale = Math.min(1, 1600 / Math.max(width, height));
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    var context = canvas.getContext('2d');
    context.fillStyle = '#0b0812';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', 0.86); });
    if (!blob) throw new Error('图片压缩失败，请换一张再试。');
    return {
      name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
      type: 'image/jpeg',
      data: await blobToDataUrl(blob),
      width: canvas.width,
      height: canvas.height,
      size: blob.size
    };
  }

  function clearPhoto() {
    photoFile = null;
    if (fileInput) fileInput.value = '';
    if (preview) preview.hidden = true;
    if (previewImage) previewImage.removeAttribute('src');
    if (previewInfo) previewInfo.textContent = '';
  }

  async function handleFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    photoBusy = true;
    submit.disabled = true;
    setStatus('正在压缩图片…', '');
    try {
      photoFile = await preparePhoto(file);
      if (preview) preview.hidden = false;
      if (previewImage) previewImage.src = photoFile.data;
      if (previewInfo) previewInfo.textContent = photoFile.name + ' · ' + photoFile.width + '×' + photoFile.height + ' · ' + formatBytes(photoFile.size);
      setStatus('照片已准备好。', '');
    } catch (error) {
      clearPhoto();
      setStatus(error.message, 'error');
      event.target.value = '';
    } finally {
      photoBusy = false;
      submit.disabled = false;
    }
  }

  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    if (!dateInput.value) dateInput.value = today();
    setStatus('', '');
    window.setTimeout(function () { captionInput.focus({ preventScroll: true }); }, 70);
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    setStatus('', '');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  }

  async function submitPhoto(event) {
    event.preventDefault();
    if (photoBusy) {
      setStatus('照片还在处理中。', 'error');
      return;
    }
    if (!photoFile) {
      setStatus('先选择一张照片。', 'error');
      return;
    }
    var caption = captionInput.value.trim();
    if (!caption) {
      setStatus('给这张照片起个标题。', 'error');
      captionInput.focus();
      return;
    }
    var payload = {
      caption: caption,
      date: dateInput.value,
      place: placeInput.value.trim(),
      photo: photoFile
    };
    submit.disabled = true;
    submit.textContent = '正在保存…';
    setStatus('正在把照片挂到墙上…', '');
    try {
      var response = await window.fetch('/api/photos', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.message || '保存失败。');
      setStatus('照片已经挂上墙了，正在刷新…', 'success');
      window.setTimeout(function () {
        window.location.hash = '#gallery';
        window.location.reload();
      }, 800);
    } catch (error) {
      setStatus(error.message, 'error');
      submit.disabled = false;
      submit.textContent = '添加到照片墙';
    }
  }

  async function deletePhoto(event) {
    var button = event.target.closest('.photo-delete');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    var file = button.getAttribute('data-file');
    var caption = button.getAttribute('data-caption') || '这张照片';
    if (!file) return;
    if (!window.confirm('从照片墙删除《' + caption + '》？\n\n如果它还是某篇回忆的封面，会被拒绝。')) return;
    button.disabled = true;
    try {
      var response = await window.fetch('/api/photos?file=' + encodeURIComponent(file), { method: 'DELETE' });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.message || '删除失败。');
      window.location.hash = '#gallery';
      window.location.reload();
    } catch (error) {
      button.disabled = false;
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

  addButton.hidden = false;
  addButton.addEventListener('click', openModal);
  closeButton.addEventListener('click', closeModal);
  clearButton.addEventListener('click', clearPhoto);
  fileInput.addEventListener('change', handleFile);
  form.addEventListener('submit', submitPhoto);
  modal.addEventListener('click', function (event) {
    if (event.target.hasAttribute('data-photo-close')) closeModal();
  });
  if (wall) wall.addEventListener('click', deletePhoto);
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
