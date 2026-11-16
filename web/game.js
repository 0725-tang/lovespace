'use strict';

(function () {
  var data = window.LOVESPACE_DATA;
  if (!data) return;

  var stage = document.getElementById('gameStage');
  var canvas = document.getElementById('gameCanvas');
  if (!stage || !canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var config = (data.site && data.site.game) || {};
  var duration = Math.max(12, Number(config.duration) || 30);
  var requestedDuration = Number(new URLSearchParams(window.location.search).get('game-seconds'));
  if (Number.isFinite(requestedDuration) && requestedDuration >= 5 && requestedDuration <= 120) duration = requestedDuration;
  var memories = Array.isArray(data.memories) ? data.memories : [];
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STORAGE_KEY = 'lovespace.game.best';

  var startScreen = document.getElementById('gameStartScreen');
  var result = document.getElementById('gameResult');
  var startButton = document.getElementById('gameStart');
  var restartButton = document.getElementById('gameRestart');
  var toast = document.getElementById('gameToast');

  var W = 0;
  var H = 0;
  var DPR = 1;
  var state = 'idle';
  var player = { x: 0, y: 0, target: 0, left: false, right: false };
  var items = [];
  var particles = [];
  var floaters = [];
  var fragments = [];
  var bgStars = [];
  var score = 0;
  var combo = 1;
  var catches = 0;
  var elapsed = 0;
  var timeLeft = duration;
  var spawnTimer = 0;
  var shake = 0;
  var startedAt = 0;
  var lastFrame = 0;
  var toastTimer = null;
  var lastHud = { score: -1, combo: -1, fragments: -1, time: -1 };

  var best = readBest();

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function readBest() {
    try {
      return Math.max(0, parseInt(window.localStorage.getItem(STORAGE_KEY), 10) || 0);
    } catch (error) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch (error) {
      /* 隐身模式下忽略即可 */
    }
  }

  function updateHud(force) {
    if (force || lastHud.score !== score) {
      setText('gameScore', score);
      lastHud.score = score;
    }
    if (force || lastHud.combo !== combo) {
      setText('gameCombo', '×' + combo);
      lastHud.combo = combo;
    }
    if (force || lastHud.fragments !== fragments.length) {
      setText('gameFragmentsCount', fragments.length);
      lastHud.fragments = fragments.length;
    }
    var seconds = Math.ceil(timeLeft);
    if (force || lastHud.time !== seconds) {
      setText('gameTime', seconds);
      lastHud.time = seconds;
    }
  }

  function resize() {
    var rect = stage.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    W = rect.width;
    H = rect.height;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    player.y = H - 52;
    player.x = player.x ? clamp(player.x, 52, W - 52) : W / 2;
    player.target = player.x;
    makeBackground();
  }

  function makeBackground() {
    bgStars = [];
    var count = Math.max(44, Math.min(110, Math.floor(W / 9)));
    for (var i = 0; i < count; i++) {
      bgStars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.15 + 0.3,
        alpha: Math.random() * 0.55 + 0.12,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.7 + 0.14
      });
    }
  }

  function startGame() {
    if (state === 'playing') return;
    state = 'playing';
    score = 0;
    combo = 1;
    catches = 0;
    elapsed = 0;
    timeLeft = duration;
    spawnTimer = 0.35;
    items = [];
    particles = [];
    floaters = [];
    fragments = [];
    shake = 0;
    player.x = W / 2;
    player.target = player.x;
    player.left = false;
    player.right = false;
    lastFrame = 0;
    startedAt = performance.now();
    lastHud = { score: -1, combo: -1, fragments: -1, time: -1 };
    spawnItem();
    spawnItem();
    spawnTimer = 0.5;
    startScreen.classList.add('is-hidden');
    startScreen.setAttribute('aria-hidden', 'true');
    result.hidden = true;
    result.classList.remove('is-visible');
    stage.classList.add('is-playing');
    stage.classList.remove('has-result');
    clearResultHearts();
    hideToast();
    updateHud(true);
    if (startButton && startButton.blur) startButton.blur();
    canvas.focus({ preventScroll: true });
    window.setTimeout(function () {
      if (stage.scrollIntoView) {
        stage.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      }
    }, 40);
  }

  function endGame() {
    if (state !== 'playing') return;
    state = 'ended';
    timeLeft = 0;
    updateHud(true);
    stage.classList.remove('is-playing');
    hideToast();

    var isRecord = score > best;
    if (isRecord) {
      best = score;
      saveBest(best);
    }
    setText('gameBest', best);
    setText('gameFinalScore', score);
    setText('gameResultKicker', isRecord ? 'NEW RECORD' : 'MISSION COMPLETE');
    setText('gameResultTitle', config.rewardTitle || '你接住了我的整片宇宙');
    setText('gameReward', config.reward || '其实，从遇见你的那天起，我的宇宙就没有冬天了。');
    setText('gameRewardSign', config.rewardSignature || '');
    setText('gameRank', rankFor(score));
    renderFragments();

    stage.classList.add('has-result');
    result.hidden = false;
    requestAnimationFrame(function () {
      result.classList.add('is-visible');
    });
    if (!reduced) makeResultHearts();
    result.scrollTop = 0;
  }

  function rankFor(value) {
    if (value >= 700) return '银河级捕手';
    if (value >= 450) return '星光收藏家';
    if (value >= 250) return '今晚的月亮';
    if (value > 0) return '心动见习生';
    return '下一次，星星会等你';
  }

  function renderFragments() {
    var box = document.getElementById('gameFragments');
    if (!box) return;
    box.innerHTML = '';
    var unique = [];
    fragments.forEach(function (memory) {
      if (!memory) return;
      if (!unique.some(function (item) { return item.title === memory.title; })) unique.push(memory);
    });
    if (!unique.length) {
      var empty = document.createElement('p');
      empty.className = 'game-fragments__empty';
      empty.textContent = '这次没有接住记忆碎片。没关系，星光记得你来过。';
      box.appendChild(empty);
      return;
    }
    var label = document.createElement('span');
    label.className = 'game-fragments__label';
    label.textContent = '你捡到的记忆碎片';
    box.appendChild(label);
    unique.slice(0, 5).forEach(function (memory) {
      var chip = document.createElement('span');
      chip.className = 'game-fragment';
      chip.textContent = memory.title;
      box.appendChild(chip);
    });
  }

  function clearResultHearts() {
    Array.prototype.forEach.call(result.querySelectorAll('.result-heart'), function (node) {
      node.remove();
    });
  }

  function makeResultHearts() {
    if (!result) return;
    for (var i = 0; i < 11; i++) {
      var heart = document.createElement('span');
      heart.className = 'result-heart';
      heart.textContent = '♥';
      heart.style.left = random(4, 94) + '%';
      heart.style.fontSize = random(9, 19) + 'px';
      heart.style.animationDelay = random(0, 1.8).toFixed(2) + 's';
      heart.style.animationDuration = random(2.8, 4.6).toFixed(2) + 's';
      result.appendChild(heart);
    }
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 1700);
  }

  function hideToast() {
    if (toastTimer) window.clearTimeout(toastTimer);
    if (toast) toast.classList.remove('is-visible');
  }

  function spawnItem() {
    var roll = Math.random();
    var type = 'heart';
    if (elapsed > 3 && roll < 0.07) type = 'memory';
    else if (roll < 0.27) type = 'star';
    else if (elapsed > 2 && roll < 0.41) type = 'cloud';

    var radius = type === 'memory' ? 25 : type === 'star' ? 18 : type === 'cloud' ? 23 : 18;
    items.push({
      type: type,
      x: random(38, W - 38),
      y: -36,
      r: radius,
      vy: 105 + elapsed * 5.1 + random(0, 34),
      rot: random(-0.24, 0.24),
      spin: random(-0.9, 0.9),
      phase: random(0, Math.PI * 2),
      wobble: random(6, 18),
      age: 0,
      memory: type === 'memory' && memories.length ? memories[Math.floor(Math.random() * memories.length)] : null
    });
  }

  function burst(x, y, color, count) {
    var amount = reduced ? Math.min(4, count) : count;
    for (var i = 0; i < amount; i++) {
      var angle = random(0, Math.PI * 2);
      var speed = random(40, 170);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        size: random(1, 3.2),
        life: 1,
        color: color
      });
    }
  }

  function addFloater(x, y, text, color) {
    floaters.push({ x: x, y: y, text: text, color: color, life: 1 });
  }

  function catchItem(item) {
    if (item.type === 'cloud') {
      score = Math.max(0, score - 15);
      combo = 1;
      shake = reduced ? 0 : 9;
      burst(item.x, item.y, 'rgba(132,112,155,0.9)', 8);
      addFloater(item.x, item.y, '-15', '#c7b4dd');
      showToast('一朵乌云偷走了一点光');
      return;
    }

    var base = item.type === 'heart' ? 10 : item.type === 'star' ? 30 : 50;
    catches += 1;
    combo = Math.min(5, 1 + Math.floor(catches / 3));
    var gain = base * combo;
    score += gain;
    var color = item.type === 'heart' ? 'rgba(255,143,163,0.9)' : item.type === 'star' ? 'rgba(232,201,154,0.95)' : 'rgba(183,166,255,0.95)';
    burst(item.x, item.y, color, item.type === 'memory' ? 16 : 10);
    addFloater(item.x, item.y, '+' + gain, item.type === 'heart' ? '#ffb3c0' : item.type === 'star' ? '#f2d8a5' : '#c9bfff');

    if (item.type === 'memory') {
      if (item.memory) {
        fragments.push(item.memory);
        showToast('记忆碎片 · ' + item.memory.title);
      } else {
        showToast('你捡到一枚记忆碎片');
      }
    }
    if (combo >= 5 && catches % 3 === 0) {
      addFloater(W / 2, H * 0.28, 'COMBO ×5', '#ffd2c1');
    }
  }

  function missItem(item) {
    if (item.type !== 'cloud') combo = 1;
  }

  function update(dt, now) {
    var current = now || performance.now();
    elapsed = Math.max(elapsed, (current - startedAt) / 1000);
    timeLeft = Math.max(0, duration - elapsed);
    if (timeLeft <= 0) {
      endGame();
      return;
    }

    if (player.left) player.target -= 540 * dt;
    if (player.right) player.target += 540 * dt;
    player.target = clamp(player.target, 52, W - 52);
    player.x += (player.target - player.x) * Math.min(1, dt * 13);

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnItem();
      var pace = Math.max(0.31, 0.69 - elapsed * 0.011);
      spawnTimer = pace * random(0.85, 1.18);
    }

    for (var i = items.length - 1; i >= 0; i--) {
      var item = items[i];
      item.age += dt;
      item.y += item.vy * dt;
      item.x += Math.sin(item.age * 2.1 + item.phase) * item.wobble * dt;
      item.rot += item.spin * dt;
      item.x = clamp(item.x, item.r + 6, W - item.r - 6);

      var caught = item.y + item.r * 0.55 > player.y - 14 && item.y < player.y + 28 && Math.abs(item.x - player.x) < 47 + item.r * 0.2;
      if (caught) {
        catchItem(item);
        items.splice(i, 1);
        continue;
      }
      if (item.y - item.r > H + 42) {
        missItem(item);
        items.splice(i, 1);
      }
    }

    for (var p = particles.length - 1; p >= 0; p--) {
      var particle = particles[p];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 95 * dt;
      particle.life -= dt * 1.65;
      if (particle.life <= 0) particles.splice(p, 1);
    }

    for (var f = floaters.length - 1; f >= 0; f--) {
      var floater = floaters[f];
      floater.y -= 38 * dt;
      floater.life -= dt * 1.1;
      if (floater.life <= 0) floaters.splice(f, 1);
    }

    shake = Math.max(0, shake - dt * 34);
    updateHud(false);
  }

  function drawBackground(now) {
    var gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#080511');
    gradient.addColorStop(0.52, '#110a1c');
    gradient.addColorStop(1, '#05030a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    var nebulaA = ctx.createRadialGradient(W * 0.26, H * 0.28, 0, W * 0.26, H * 0.28, Math.max(W, H) * 0.68);
    nebulaA.addColorStop(0, 'rgba(116, 72, 137, 0.19)');
    nebulaA.addColorStop(0.55, 'rgba(74, 43, 101, 0.07)');
    nebulaA.addColorStop(1, 'rgba(6, 4, 12, 0)');
    ctx.fillStyle = nebulaA;
    ctx.fillRect(0, 0, W, H);

    var nebulaB = ctx.createRadialGradient(W * 0.78, H * 0.7, 0, W * 0.78, H * 0.7, Math.max(W, H) * 0.54);
    nebulaB.addColorStop(0, 'rgba(144, 64, 86, 0.14)');
    nebulaB.addColorStop(1, 'rgba(6, 4, 12, 0)');
    ctx.fillStyle = nebulaB;
    ctx.fillRect(0, 0, W, H);

    var time = now * 0.001;
    for (var i = 0; i < bgStars.length; i++) {
      var star = bgStars[i];
      var alpha = star.alpha * (0.55 + Math.sin(time * star.speed + star.phase) * 0.25);
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 242, 230, ' + alpha.toFixed(3) + ')';
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255, 143, 163, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(W * 0.5, H + 52, Math.max(W * 0.54, 300), Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.beginPath();
    ctx.arc(W * 0.5, H + 92, Math.max(W * 0.7, 360), Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  function drawHeart(item) {
    var scale = item.r / 17;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rot);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(255, 118, 146, 0.75)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff8fa3';
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.bezierCurveTo(-20, -8, -15, -23, 0, -11);
    ctx.bezierCurveTo(15, -23, 20, -8, 0, 7);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 241, 234, 0.62)';
    ctx.beginPath();
    ctx.ellipse(-5.5, -8, 3.1, 2, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawStar(item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rot);
    ctx.shadowColor = 'rgba(255, 214, 151, 0.85)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#f4d39c';
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var radius = i % 2 === 0 ? item.r : item.r * 0.43;
      var angle = -Math.PI / 2 + (Math.PI * i) / 5;
      var x = Math.cos(angle) * radius;
      var y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCloud(item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rot * 0.2);
    ctx.shadowColor = 'rgba(76, 52, 101, 0.6)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(73, 57, 94, 0.93)';
    ctx.beginPath();
    ctx.arc(-15, 2, 13, 0, Math.PI * 2);
    ctx.arc(0, -7, 17, 0, Math.PI * 2);
    ctx.arc(18, 1, 12, 0, Math.PI * 2);
    ctx.rect(-15, 2, 33, 13);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(196, 166, 218, 0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -7, 17, Math.PI * 1.15, Math.PI * 1.72);
    ctx.stroke();
    ctx.fillStyle = 'rgba(247, 207, 131, 0.8)';
    ctx.beginPath();
    ctx.moveTo(4, 9);
    ctx.lineTo(-2, 18);
    ctx.lineTo(3, 18);
    ctx.lineTo(-4, 28);
    ctx.lineTo(8, 15);
    ctx.lineTo(2, 15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMemory(item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    var pulse = 1 + Math.sin(item.age * 4) * 0.08;
    ctx.scale(pulse, pulse);
    ctx.shadowColor = 'rgba(183, 166, 255, 0.9)';
    ctx.shadowBlur = 26;
    var gradient = ctx.createRadialGradient(-5, -6, 1, 0, 0, item.r);
    gradient.addColorStop(0, 'rgba(255, 241, 225, 0.95)');
    gradient.addColorStop(0.4, 'rgba(202, 184, 255, 0.88)');
    gradient.addColorStop(1, 'rgba(129, 103, 201, 0.5)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, item.r * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(228, 217, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, item.r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(item.rot);
    ctx.fillStyle = 'rgba(255, 250, 239, 0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(now) {
    var x = state === 'idle' ? W / 2 + Math.sin(now * 0.0011) * Math.min(46, W * 0.04) : player.x;
    var y = player.y;
    ctx.save();
    ctx.translate(x, y);

    var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 92);
    glow.addColorStop(0, 'rgba(255, 143, 163, 0.16)');
    glow.addColorStop(1, 'rgba(255, 143, 163, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 92, 0, Math.PI * 2);
    ctx.fill();

    var bowl = ctx.createLinearGradient(-46, 0, 46, 0);
    bowl.addColorStop(0, 'rgba(183, 166, 255, 0.9)');
    bowl.addColorStop(0.5, 'rgba(255, 197, 174, 1)');
    bowl.addColorStop(1, 'rgba(255, 143, 163, 0.9)');
    ctx.strokeStyle = bowl;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255, 143, 163, 0.72)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 180, 164, 0.08)';
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 231, 206, 0.9)';
    ctx.beginPath();
    ctx.arc(-42, 0, 2.2, 0, Math.PI * 2);
    ctx.arc(42, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 143, 163, 0.07)';
    ctx.beginPath();
    ctx.ellipse(0, 32, 56, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var particle = particles[i];
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    ctx.textAlign = 'center';
    ctx.font = '500 12px "Songti SC", "SimSun", serif';
    for (var i = 0; i < floaters.length; i++) {
      var floater = floaters[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, floater.life * 1.4));
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function draw(now) {
    if (!W || !H) return;
    ctx.save();
    if (shake > 0) ctx.translate(random(-shake, shake), random(-shake, shake));
    drawBackground(now);
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.type === 'heart') drawHeart(item);
      else if (item.type === 'star') drawStar(item);
      else if (item.type === 'cloud') drawCloud(item);
      else drawMemory(item);
    }
    drawPlayer(now);
    drawParticles();
    drawFloaters();
    ctx.restore();
  }

  function loop(now) {
    if (!lastFrame) lastFrame = now;
    var dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (state === 'playing') update(dt, now);
    draw(now);
    window.requestAnimationFrame(loop);
  }

  function setKey(key, pressed) {
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') player.left = pressed;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') player.right = pressed;
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'a' || event.key === 'd' || event.key === 'A' || event.key === 'D') {
      var rect = stage.getBoundingClientRect();
      var visible = rect.top < window.innerHeight && rect.bottom > 0;
      if (!visible) return;
      setKey(event.key, true);
      if (state === 'playing') event.preventDefault();
    }
    if ((event.key === ' ' || event.key === 'Enter') && state !== 'playing') {
      var box = stage.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) {
        event.preventDefault();
        startGame();
      }
    }
  });

  document.addEventListener('keyup', function (event) {
    setKey(event.key, false);
  });

  window.addEventListener('blur', function () {
    player.left = false;
    player.right = false;
  });

  canvas.addEventListener('pointermove', function (event) {
    if (state !== 'playing') return;
    var rect = canvas.getBoundingClientRect();
    player.target = clamp(event.clientX - rect.left, 52, W - 52);
  });

  canvas.addEventListener('pointerdown', function (event) {
    if (state !== 'playing') return;
    var rect = canvas.getBoundingClientRect();
    player.target = clamp(event.clientX - rect.left, 52, W - 52);
  });

  if (startButton) startButton.addEventListener('click', startGame);
  if (restartButton) restartButton.addEventListener('click', startGame);

  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) {
    var observer = new ResizeObserver(resize);
    observer.observe(stage);
  }

  setText('gameTime', duration);
  setText('gameBest', best);
  resize();
  updateHud(true);
  window.requestAnimationFrame(loop);
})();
