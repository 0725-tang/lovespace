'use strict';

(function () {
  var data = window.LOVESPACE_DATA;
  var photoList = [];
  var lightboxIndex = 0;
  var lastFocused = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var node = $(id);
    if (node) node.textContent = value === undefined || value === null ? '' : String(value);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function dateParts(value) {
    if (!value) return null;
    var raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      var bits = raw.split('-');
      return { year: bits[0], month: bits[1], day: bits[2] };
    }
    var date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return {
      year: String(date.getFullYear()),
      month: String(date.getMonth() + 1).padStart(2, '0'),
      day: String(date.getDate()).padStart(2, '0')
    };
  }

  function formatDate(value, separator) {
    var parts = dateParts(value);
    if (!parts) return value || '';
    return parts.year + separator + parts.month + separator + parts.day;
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function showError(message) {
    var banner = $('errorBanner');
    if (!banner) return;
    var text = banner.querySelector('p');
    if (text && message) text.textContent = message;
    banner.hidden = false;
  }

  function revealPage() {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
  }

  function hydrateCopy() {
    var site = data.site || {};
    var couple = site.couple || {};
    var hero = site.hero || {};
    var anniversary = dateParts(couple.anniversary);

    document.title = (couple.her || '你') + ' × ' + (couple.me || '我') + ' · ' + (site.siteName || 'LoveSpace');
    var description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', hero.subtitle || '一个只围绕她转的小宇宙。');

    setText('heroEyebrow', hero.eyebrow);
    setText('heroTitle', hero.title);
    setText('heroAccent', hero.titleAccent);
    setText('heroSubtitle', hero.subtitle);
    setText('heroMe', couple.me);
    setText('heroHer', couple.her);
    setText('meOrbitName', couple.me);
    setText('herOrbitName', couple.her);
    setText('meEmoji', couple.meEmoji || '🌙');
    setText('herEmoji', couple.herEmoji || '🌸');
    setText('counterLabel', site.counter && site.counter.label);
    setText('counterNote', site.counter && site.counter.note);
    setText('nextLabel', site.next && site.next.label);
    setText('nextNote', site.next && site.next.note);
    setText('galleryEyebrow', site.gallery && site.gallery.eyebrow);
    setText('galleryTitle', site.gallery && site.gallery.title);
    setText('gallerySubtitle', site.gallery && site.gallery.subtitle);
    setText('timelineEyebrow', site.timeline && site.timeline.eyebrow);
    setText('timelineTitle', site.timeline && site.timeline.title);
    setText('timelineSubtitle', site.timeline && site.timeline.subtitle);
    setText('gameEyebrow', site.game && site.game.eyebrow);
    setText('gameTitle', site.game && site.game.title);
    setText('gameSubtitle', site.game && site.game.subtitle);
    setText('letterEyebrow', site.letter && site.letter.eyebrow);
    setText('letterTitle', site.letter && site.letter.title);
    setText('letterSubtitle', site.letter && site.letter.subtitle);
    setText('letterHint', site.letter && site.letter.hint);
    setText('letterModalHint', site.letter && site.letter.hint);
    setText('letterSeal', (site.letter && site.letter.seal) || 'L');
    setText('letterPaperSeal', (site.letter && site.letter.seal) || 'L');
    setText('guestbookEyebrow', site.guestbook && site.guestbook.eyebrow);
    setText('guestbookTitle', site.guestbook && site.guestbook.title);
    setText('guestbookSubtitle', site.guestbook && site.guestbook.subtitle);
    setText('guestbookQuote', String((site.guestbook && site.guestbook.quote) || '').replace(/\\n/g, '\n').replace(/\\r\\n/g, '\n'));
    setText('guestbookNote', site.guestbook && site.guestbook.note);
    setText('guestbookSubmitText', (site.guestbook && site.guestbook.button) || '把这句话留下');
    var guestNameInput = document.getElementById('guestName');
    var guestMessageInput = document.getElementById('guestMessage');
    if (guestNameInput && site.guestbook && site.guestbook.namePlaceholder) guestNameInput.placeholder = site.guestbook.namePlaceholder;
    if (guestMessageInput && site.guestbook && site.guestbook.placeholder) guestMessageInput.placeholder = site.guestbook.placeholder;
    setText('footerLine', site.footer && site.footer.line);
    setText('footerCredit', site.footer && site.footer.credit);
    setText('footerNames', (couple.me || '') + ' × ' + (couple.her || ''));

    var birthdays = couple.birthdays || {};
    var birthdayMe = dateParts(birthdays.me);
    var birthdayHer = dateParts(birthdays.her);
    var birthdayBits = [];
    if (birthdayMe) birthdayBits.push('你的生日 ' + birthdayMe.month + '.' + birthdayMe.day);
    if (birthdayHer) birthdayBits.push('TA 的生日 ' + birthdayHer.month + '.' + birthdayHer.day);
    setText('footerBirthdays', birthdayBits.join(' · '));

    var nextMeet = document.querySelector('.next-meet');
    if (nextMeet) nextMeet.hidden = !(site.next && site.next.date);

    var sinceYear = anniversary ? anniversary.year : '';
    setText('heroSince', sinceYear ? 'EST. ' + sinceYear : '');
    setText('headerSince', anniversary ? 'SINCE ' + anniversary.year + '.' + anniversary.month + '.' + anniversary.day : '');
    setText('footerYear', String(new Date().getFullYear()));

    var next = dateParts(site.next && site.next.date);
    if (next) {
      setText('nextLabel', site.next.label);
    }
  }

  function daysTogether() {
    var start = new Date((data.site.couple || {}).anniversary);
    if (Number.isNaN(start.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
  }

  function buildStat(label, value, unit) {
    var stat = el('div', 'stat');
    stat.appendChild(el('span', 'stat__label', label));
    var row = el('span', 'stat__value');
    var number = el('span', 'stat__number', '0');
    number.setAttribute('data-count', String(value));
    row.appendChild(number);
    if (unit) row.appendChild(el('small', '', unit));
    stat.appendChild(row);
    return stat;
  }

  function renderStats() {
    var grid = $('statsGrid');
    if (!grid) return;
    var stats = data.stats || {};
    grid.appendChild(buildStat('相爱天数', daysTogether(), '天'));
    grid.appendChild(buildStat('照片数量', stats.photos || 0, '张'));
    grid.appendChild(buildStat('回忆条目', stats.memories || 0, '篇'));
    grid.appendChild(buildStat('一起走过的城市', stats.cities || 0, '座'));

    var numbers = grid.querySelectorAll('[data-count]');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      numbers.forEach(function (node) {
        node.textContent = node.getAttribute('data-count');
      });
      return;
    }
    var observer = new IntersectionObserver(function (entries, obs) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      numbers.forEach(function (node) {
        animateNumber(node, Number(node.getAttribute('data-count') || 0));
      });
      obs.disconnect();
    }, { threshold: 0.35 });
    observer.observe(grid);
  }

  function animateNumber(node, target) {
    var start = performance.now();
    var duration = 1300;
    function frame(now) {
      var progress = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = Math.round(target * eased).toString();
      if (progress < 1) requestAnimationFrame(frame);
      else node.textContent = String(target);
    }
    requestAnimationFrame(frame);
  }

  function renderGallery() {
    var wall = $('photoWall');
    var filters = $('galleryFilters');
    if (!wall || !filters) return;
    photoList = Array.isArray(data.photos) ? data.photos : [];
    wall.innerHTML = '';
    filters.innerHTML = '';
    wall.classList.toggle('is-empty', !photoList.length);
    var gallerySection = $('gallery');
    if (gallerySection) gallerySection.classList.toggle('is-empty', !photoList.length);

    var years = photoList.map(function (photo) { return photo.year; }).filter(Boolean);
    var uniqueYears = Array.from(new Set(years)).sort().reverse();

    var allButton = el('button', 'filter is-active', '全部');
    allButton.type = 'button';
    allButton.setAttribute('data-year', 'all');
    allButton.setAttribute('aria-pressed', 'true');
    filters.appendChild(allButton);

    uniqueYears.forEach(function (year) {
      var button = el('button', 'filter', year);
      button.type = 'button';
      button.setAttribute('data-year', year);
      button.setAttribute('aria-pressed', 'false');
      filters.appendChild(button);
    });

    filters.addEventListener('click', function (event) {
      var button = event.target.closest('.filter');
      if (!button) return;
      var year = button.getAttribute('data-year');
      Array.prototype.forEach.call(filters.querySelectorAll('.filter'), function (node) {
        var active = node === button;
        node.classList.toggle('is-active', active);
        node.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      Array.prototype.forEach.call(wall.querySelectorAll('.photo-item'), function (item) {
        var visible = year === 'all' || item.getAttribute('data-year') === year;
        item.classList.toggle('is-filtered', !visible);
      });
    });

    photoList.forEach(function (photo, index) {
      var variants = ['photo-card--wide', 'photo-card--tall', '', 'photo-card--square', 'photo-card--tall'];
      var card = el('button', 'photo-card ' + variants[index % variants.length]);
      card.type = 'button';
      card.setAttribute('data-photo-index', String(index));
      card.setAttribute('data-year', photo.year || '');
      card.setAttribute('aria-label', '查看照片：' + (photo.caption || '我们的照片'));

      var media = el('span', 'photo-card__media');
      var image = document.createElement('img');
      image.src = photo.src;
      image.alt = photo.alt || photo.caption || '我们的照片';
      image.loading = index < 2 ? 'eager' : 'lazy';
      image.decoding = 'async';
      media.appendChild(image);
      card.appendChild(media);
      card.appendChild(el('span', 'photo-card__index', pad(index + 1)));

      var meta = el('span', 'photo-card__meta');
      meta.appendChild(el('span', 'photo-card__date', formatDate(photo.date, '.')));
      meta.appendChild(el('span', 'photo-card__title', photo.caption));
      if (photo.place) meta.appendChild(el('span', 'photo-card__place', photo.place));
      card.appendChild(meta);

      var item = el('div', 'photo-item');
      item.setAttribute('data-year', photo.year || '');
      item.appendChild(card);
      if (data.canEdit) {
        var deleteButton = el('button', 'photo-delete', '×');
        deleteButton.type = 'button';
        deleteButton.setAttribute('data-file', photo.src);
        deleteButton.setAttribute('data-caption', photo.caption || '这张照片');
        deleteButton.setAttribute('aria-label', '删除照片：' + (photo.caption || '这张照片'));
        deleteButton.title = '从照片墙删除';
        item.appendChild(deleteButton);
      }
      wall.appendChild(item);
    });

    if (!photoList.length) {
      var emptyGallery = el('div', 'empty-state');
      emptyGallery.appendChild(el('span', 'empty-state__star', '✳'));
      emptyGallery.appendChild(el('h3', 'empty-state__title', '照片墙还是空的'));
      emptyGallery.appendChild(el('p', 'empty-state__text', data.canEdit ? '点右上角的“+ 添加照片”，把第一张放进来。' : '等第一张照片被放进来。'));
      wall.appendChild(emptyGallery);
    }

    wall.addEventListener('click', function (event) {
      var card = event.target.closest('.photo-card');
      if (!card) return;
      openLightbox(Number(card.getAttribute('data-photo-index')));
    });
  }

  function renderTimeline() {
    var list = $('timelineList');
    if (!list) return;
    var memories = Array.isArray(data.memories) ? data.memories : [];
    list.innerHTML = '';
    list.classList.toggle('is-empty', !memories.length);

    if (!memories.length) {
      var emptyTimeline = el('div', 'empty-state empty-state--timeline');
      emptyTimeline.appendChild(el('span', 'empty-state__star', '✳'));
      emptyTimeline.appendChild(el('h3', 'empty-state__title', '时间线还没有回忆'));
      emptyTimeline.appendChild(el('p', 'empty-state__text', data.canEdit ? '点上面的“+ 新建回忆”，写下第一件想记住的事。' : '等第一篇回忆被写进来。'));
      list.appendChild(emptyTimeline);
      return;
    }

    memories.forEach(function (memory, index) {
      var item = el('article', 'timeline__item');
      item.setAttribute('data-reveal', '');

      var dot = el('span', 'timeline__dot');
      dot.setAttribute('aria-hidden', 'true');
      item.appendChild(dot);

      var card = el('div', 'timeline__card');

      if (memory.cover) {
        var photoIndex = photoList.findIndex(function (photo) { return photo.src === memory.cover; });
        var media = el('button', 'timeline__media');
        media.type = 'button';
        media.setAttribute('data-photo-index', photoIndex >= 0 ? String(photoIndex) : '');
        media.setAttribute('aria-label', '查看这张照片：' + memory.title);
        var image = document.createElement('img');
        image.src = memory.cover;
        image.alt = memory.title;
        image.loading = 'lazy';
        image.decoding = 'async';
        media.appendChild(image);
        if (photoIndex >= 0) {
          media.addEventListener('click', function () {
            openLightbox(photoIndex);
          });
        } else {
          media.disabled = true;
        }
        card.appendChild(media);
      } else {
        card.classList.add('timeline__card--text');
      }

      var body = el('div', 'timeline__body');
      var meta = el('div', 'timeline__meta');
      meta.appendChild(el('span', '', formatDate(memory.date, '.')));
      if (memory.place) meta.appendChild(el('span', '', memory.place));
      if (memory.mood) meta.appendChild(el('span', '', memory.mood));
      body.appendChild(meta);

      body.appendChild(el('h3', 'timeline__title', memory.title));
      if (memory.quote) body.appendChild(el('p', 'timeline__quote', memory.quote));
      if (memory.excerpt) body.appendChild(el('p', 'timeline__excerpt', memory.excerpt));

      if (memory.tags && memory.tags.length) {
        var tags = el('div', 'timeline__tags');
        memory.tags.slice(0, 4).forEach(function (tag) {
          tags.appendChild(el('span', 'timeline__tag', tag));
        });
        body.appendChild(tags);
      }

      card.appendChild(body);
      if (data.canEdit) {
        var removeMemory = el('button', 'memory-delete', '×');
        removeMemory.type = 'button';
        removeMemory.setAttribute('data-slug', memory.slug);
        removeMemory.setAttribute('data-title', memory.title);
        removeMemory.setAttribute('aria-label', '删除回忆：' + memory.title);
        removeMemory.title = '删除这篇回忆';
        card.appendChild(removeMemory);
      }
      item.appendChild(card);
      list.appendChild(item);
    });

    var end = el('div', 'timeline__end');
    end.appendChild(el('span', '', '未完待续'));
    list.appendChild(end);
  }

  function openLightbox(index) {
    if (!photoList.length) return;
    lightboxIndex = (index + photoList.length) % photoList.length;
    var photo = photoList[lightboxIndex];
    var lightbox = $('lightbox');
    if (!lightbox || !photo) return;
    lastFocused = document.activeElement;
    setText('lightboxDate', formatDate(photo.date, '.'));
    setText('lightboxTitle', photo.caption);
    setText('lightboxPlace', photo.place || '');
    setText('lightboxCounter', (lightboxIndex + 1) + ' / ' + photoList.length);
    var image = $('lightboxImage');
    image.src = photo.src;
    image.alt = photo.alt || photo.caption || '我们的照片';
    lightbox.hidden = false;
    document.body.classList.add('no-scroll');
    var close = $('lightboxClose');
    if (close) close.focus();
  }

  function closeLightbox() {
    var lightbox = $('lightbox');
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.classList.remove('no-scroll');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function stepLightbox(direction) {
    openLightbox(lightboxIndex + direction);
  }

  function setupLightbox() {
    var lightbox = $('lightbox');
    if (!lightbox) return;
    $('lightboxClose').addEventListener('click', closeLightbox);
    $('lightboxPrev').addEventListener('click', function () { stepLightbox(-1); });
    $('lightboxNext').addEventListener('click', function () { stepLightbox(1); });
    lightbox.addEventListener('click', function (event) {
      if (event.target.hasAttribute('data-lightbox-close')) closeLightbox();
    });
    document.addEventListener('keydown', function (event) {
      if (lightbox.hidden) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') stepLightbox(-1);
      if (event.key === 'ArrowRight') stepLightbox(1);
    });

    var touchStart = 0;
    var dialog = lightbox.querySelector('.lightbox__dialog');
    if (dialog) {
      dialog.addEventListener('touchstart', function (event) {
        if (event.touches.length === 1) touchStart = event.touches[0].clientX;
      }, { passive: true });
      dialog.addEventListener('touchend', function (event) {
        if (!touchStart || !event.changedTouches.length) return;
        var distance = event.changedTouches[0].clientX - touchStart;
        if (Math.abs(distance) > 54) stepLightbox(distance > 0 ? -1 : 1);
        touchStart = 0;
      }, { passive: true });
    }
  }

  function setupReveal() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!nodes.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      nodes.forEach(function (node) { node.classList.add('is-visible'); });
      return;
    }
    nodes.forEach(function (node, index) {
      if (node.classList.contains('timeline__item')) {
        node.style.transitionDelay = (index % 3) * 70 + 'ms';
      }
    });
    document.body.classList.add('reveal-ready');
    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(function (node) { observer.observe(node); });
  }

  function setupNavigation() {
    var header = $('siteHeader');
    var progress = $('scrollProgress');
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
    var sections = links.map(function (link) {
      return document.getElementById(link.getAttribute('href').replace('#', ''));
    });
    var ticking = false;

    function update() {
      var top = window.scrollY || window.pageYOffset;
      if (header) header.classList.toggle('is-scrolled', top > 24);
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.width = max > 0 ? Math.min(100, (top / max) * 100) + '%' : '0%';

      var current = 'universe';
      sections.forEach(function (section) {
        if (section && section.offsetTop - window.innerHeight * 0.42 <= top) current = section.id;
      });
      links.forEach(function (link) {
        link.classList.toggle('is-active', link.getAttribute('href') === '#' + current);
      });
      ticking = false;
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    update();
  }

  function startCounters() {
    var start = new Date((data.site.couple || {}).anniversary);
    var next = new Date((data.site.next || {}).date);
    var startValid = !Number.isNaN(start.getTime());
    var nextValid = !Number.isNaN(next.getTime());
    var nextNoteOriginal = (data.site.next && data.site.next.note) || '';

    function tick() {
      var now = Date.now();
      if (startValid) {
        var diff = Math.max(0, now - start.getTime());
        var days = Math.floor(diff / 86400000);
        var hours = Math.floor(diff / 3600000) % 24;
        var minutes = Math.floor(diff / 60000) % 60;
        var seconds = Math.floor(diff / 1000) % 60;
        setText('daysTogether', String(days));
        setText('hoursTogether', pad(hours));
        setText('minutesTogether', pad(minutes));
        setText('secondsTogether', pad(seconds));
      }

      if (nextValid) {
        var remaining = Math.max(0, next.getTime() - now);
        var d = Math.floor(remaining / 86400000);
        var h = Math.floor(remaining / 3600000) % 24;
        var m = Math.floor(remaining / 60000) % 60;
        var s = Math.floor(remaining / 1000) % 60;
        setText('nextDays', pad(d));
        setText('nextHours', pad(h));
        setText('nextMinutes', pad(m));
        setText('nextSeconds', pad(s));
        if (remaining <= 0) {
          setText('nextNote', '这一天已经变成了回忆。下一场见面，等你写进 content/site.json。');
        } else {
          setText('nextNote', nextNoteOriginal);
        }
      }
    }

    tick();
    window.setInterval(tick, 1000);
  }

  function startStarfield() {
    var canvas = $('starfield');
    if (!canvas) return;
    var context = canvas.getContext('2d');
    if (!context) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var width = 0;
    var height = 0;
    var dpr = 1;
    var stars = [];
    var shooting = [];
    var pointer = { x: 0, y: 0 };
    var target = { x: 0, y: 0 };
    var lastShot = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.min(240, Math.max(80, Math.floor(width / 6)));
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.25 + 0.35,
          depth: Math.random() * 0.85 + 0.15,
          alpha: Math.random() * 0.55 + 0.18,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.55 + 0.18,
          tone: Math.random() > 0.82 ? (Math.random() > 0.5 ? '255,170,180' : '232,201,154') : '255,244,235'
        });
      }
    }

    function draw(now) {
      var time = now * 0.001;
      pointer.x += (target.x - pointer.x) * 0.035;
      pointer.y += (target.y - pointer.y) * 0.035;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';

      for (var i = 0; i < stars.length; i++) {
        var star = stars[i];
        var twinkle = Math.sin(time * star.speed + star.phase) * 0.5 + 0.5;
        var alpha = star.alpha * (0.55 + twinkle * 0.55);
        var x = star.x + pointer.x * 22 * star.depth;
        var y = star.y + pointer.y * 14 * star.depth;
        context.beginPath();
        context.fillStyle = 'rgba(' + star.tone + ',' + alpha.toFixed(3) + ')';
        context.arc(x, y, star.r, 0, Math.PI * 2);
        context.fill();
        if (star.r > 1.3) {
          context.strokeStyle = 'rgba(' + star.tone + ',' + (alpha * 0.32).toFixed(3) + ')';
          context.lineWidth = 0.6;
          context.beginPath();
          context.moveTo(x - 5, y);
          context.lineTo(x + 5, y);
          context.moveTo(x, y - 5);
          context.lineTo(x, y + 5);
          context.stroke();
        }
      }

      if (now - lastShot > 4200 + Math.random() * 4800) {
        lastShot = now;
        shooting.push({
          x: Math.random() * width * 1.1,
          y: Math.random() * height * 0.45,
          vx: -(5 + Math.random() * 4),
          vy: 2 + Math.random() * 1.6,
          life: 1
        });
      }

      for (var j = shooting.length - 1; j >= 0; j--) {
        var shot = shooting[j];
        shot.x += shot.vx * 1.8;
        shot.y += shot.vy * 1.8;
        shot.life -= 0.012;
        if (shot.life <= 0 || shot.x < -200 || shot.y > height + 100) {
          shooting.splice(j, 1);
          continue;
        }
        var gradient = context.createLinearGradient(shot.x, shot.y, shot.x - shot.vx * 13, shot.y - shot.vy * 13);
        gradient.addColorStop(0, 'rgba(255,236,216,' + (0.78 * shot.life).toFixed(3) + ')');
        gradient.addColorStop(1, 'rgba(255,143,163,0)');
        context.strokeStyle = gradient;
        context.lineWidth = 1.3;
        context.beginPath();
        context.moveTo(shot.x, shot.y);
        context.lineTo(shot.x - shot.vx * 13, shot.y - shot.vy * 13);
        context.stroke();
      }

      context.globalCompositeOperation = 'source-over';
      if (!reduce) requestAnimationFrame(draw);
    }

    resize();
    if (reduce) {
      draw(0);
      window.addEventListener('resize', function () { resize(); draw(0); });
      return;
    }

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', function (event) {
      target.x = event.clientX / width - 0.5;
      target.y = event.clientY / height - 0.5;
    }, { passive: true });
    requestAnimationFrame(draw);
  }

  function setupPreloader() {
    var timer = window.setTimeout(revealPage, 2600);
    window.addEventListener('load', function () {
      window.clearTimeout(timer);
      window.setTimeout(revealPage, 560);
    });
  }

  function init() {
    if (!data) {
      showError('没有读取到站点数据。请运行 npm start，再打开 http://localhost:4321。');
      revealPage();
      return;
    }
    hydrateCopy();
    renderGallery();
    renderTimeline();
    renderStats();
    setupLightbox();
    setupReveal();
    setupNavigation();
    startCounters();
    startStarfield();
    setupPreloader();
    if (window.LOVESPACE_ERROR) {
      showError('站点数据读取失败：' + (window.LOVESPACE_ERROR.message || '请检查 content/ 目录。'));
    }
  }

  try {
    init();
  } catch (error) {
    console.error('[lovespace] 页面初始化失败', error);
    showError('页面初始化失败：' + error.message);
    revealPage();
  }
})();
