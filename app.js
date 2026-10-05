/* Pater Noster Practice. No accounts, no tracking: progress lives in localStorage on this device. */
(function () {
  'use strict';

  const N = SENTENCES.length;
  // Lengths (s) of the normal-speed sentence clips; used to follow along inside the build-up tracks.
  const NORMAL_DUR = [6.288, 2.376, 5.088, 11.592, 5.544, 0.984];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
  const lineName = (a, b) => (a === b ? `line ${a + 1}` : `lines ${a + 1}–${b + 1}`);

  const store = {
    get(k, d) { try { const v = localStorage.getItem('pn.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('pn.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  const S = {
    speed: store.get('speed', 'normal'),
    tab: store.get('tab', 'pray'),
    loopFrom: store.get('loopFrom', 0),
    loopTo: store.get('loopTo', 1),
    loopGap: store.get('loopGap', '3000'),
    buildStep: store.get('buildStep', 1),
    buildMax: store.get('buildMax', 0),
    buildAuto: store.get('buildAuto', false),
    buildGap: store.get('buildGap', 'same'),
    memMode: store.get('memMode', 'letters'),
    known: store.get('known', []),
    showEnglish: store.get('showEnglish', true)
  };
  const save = (k) => store.set(k, S[k]);

  let TIMINGS = null;
  fetch('timings.json', { cache: 'no-cache' })
    .then((r) => r.ok ? r.json() : null)
    .then((j) => { TIMINGS = j; })
    .catch(() => { TIMINGS = null; });

  const clipSrc = (i, speed) => `audio/${speed || S.speed}/s${i + 1}.mp3`;
  const buildSrc = (n) => `audio/buildup/1-${n}.mp3`;

  function latinWordsHtml(i) {
    return SENTENCES[i].split(' ').map((w, j) =>
      `<span class="kw" data-w="${j}">${esc(w)}</span>`
    ).join(' ');
  }
  function enHtml(i) {
    return `<span class="en" lang="en">${esc(SENTENCES_EN[i])}</span>`;
  }
  function lineTextHtml(i) {
    return `<span class="line-text"><span class="latin" lang="la">${latinWordsHtml(i)}</span>${enHtml(i)}</span>`;
  }

  function applyEnglish() {
    document.body.classList.toggle('hide-en', !S.showEnglish);
    const box = $('#showEnglish');
    if (box) box.checked = !!S.showEnglish;
  }

  /* ---------------- Player: one audio element, a queue, gaps, loop, pause ---------------- */
  const audio = new Audio();
  audio.preload = 'auto';
  const P = { q: [], i: 0, loop: false, state: 'idle', label: '', timer: null, tick: null, due: 0, remaining: 0, pending: null, stepStart: 0, onEnd: null, onStop: null };

  function gapMs(v) {
    if (v === 'same') return Math.min(45000, Math.max(2000, performance.now() - P.stepStart));
    return Number(v) || 0;
  }

  function start(items, opts) {
    stop();
    pauseNative();
    opts = opts || {};
    P.q = items; P.i = 0; P.loop = !!opts.loop; P.label = opts.label || '';
    P.onEnd = opts.onEnd || null; P.onStop = opts.onStop || null;
    playCurrent();
  }

  function playCurrent() {
    const it = P.q[P.i];
    P.state = 'playing';
    if (it.stepStart !== false) P.stepStart = performance.now();
    if (it.onStart) it.onStart();
    highlight(it.hl.length > 1 && it.follow ? [it.hl[0]] : it.hl);
    clearWordHighlight();
    audio.src = it.src;
    const pr = audio.play();
    if (pr && pr.catch) pr.catch((e) => { if (e && e.name !== 'AbortError' && P.state === 'playing') { P.state = 'paused'; renderBar(); } });
    setMedia(it);
    renderBar();
  }

  function wait(ms, fn) {
    if (ms <= 0) { fn(); return; }
    P.state = 'waiting'; P.pending = fn; P.due = performance.now() + ms;
    P.timer = setTimeout(() => { clearTimers(); P.pending = null; fn(); }, ms);
    P.tick = setInterval(renderBar, 250);
    renderBar();
  }
  function clearTimers() { clearTimeout(P.timer); clearInterval(P.tick); P.timer = null; P.tick = null; }

  audio.addEventListener('ended', () => {
    if (P.state !== 'playing') return;
    const it = P.q[P.i];
    if (it.onDone) it.onDone();
    const last = P.i === P.q.length - 1;
    if (!last) { const g = gapMs(it.gapAfter); P.i++; highlightKeep(it); wait(g, playCurrent); return; }
    if (P.loop) { const g = gapMs(it.gapAfter); P.i = 0; highlightKeep(it); wait(g, playCurrent); return; }
    finish();
  });
  // Keep the just-played line lit during "your turn" pauses so he knows what to say.
  function highlightKeep(it) { highlight(it.hl); }

  audio.addEventListener('timeupdate', () => {
    const it = P.q[P.i];
    if (!it || P.state !== 'playing') return;
    if (it.follow && audio.duration) {
      // Build-up tracks are lines spoken back to back; light each line in turn.
      const durs = it.hl.map((k) => NORMAL_DUR[k]);
      const total = durs.reduce((a, b) => a + b, 0);
      const t = (audio.currentTime / audio.duration) * total;
      let acc = 0, idx = it.hl[it.hl.length - 1];
      for (let j = 0; j < durs.length; j++) { acc += durs[j]; if (t < acc) { idx = it.hl[j]; break; } }
      highlight([idx]);
    }
    updateKaraoke(it, audio.currentTime);
  });
  audio.addEventListener('pause', () => {
    // Paused from outside (lock screen, a phone call): reflect it.
    if (P.state === 'playing' && !audio.ended) { P.state = 'paused'; renderBar(); }
  });
  audio.addEventListener('play', () => { if (P.state === 'paused') { P.state = 'playing'; renderBar(); } });
  audio.addEventListener('error', () => {
    if (P.state === 'idle') return;
    const it = P.q[P.i];
    stop();
    toastBar(`Couldn't play ${it ? it.name : 'audio'}. Try again with a connection.`);
  });

  function pause() {
    if (P.state === 'playing') { P.state = 'paused'; audio.pause(); }
    else if (P.state === 'waiting') { P.remaining = Math.max(0, P.due - performance.now()); clearTimers(); P.state = 'paused-wait'; }
    renderBar();
  }
  function resume() {
    if (P.state === 'paused') { P.state = 'playing'; const pr = audio.play(); if (pr && pr.catch) pr.catch(() => {}); }
    else if (P.state === 'paused-wait') { const fn = P.pending; wait(P.remaining, fn); return; }
    renderBar();
  }
  function stop() {
    const was = P.state;
    clearTimers();
    P.state = 'idle'; P.pending = null;
    audio.pause();
    highlight([]);
    clearWordHighlight();
    renderBar();
    if (was !== 'idle' && P.onStop) { const f = P.onStop; P.onStop = null; f(); }
  }
  function finish() {
    clearTimers();
    P.state = 'idle';
    highlight([]);
    clearWordHighlight();
    renderBar();
    const f = P.onEnd; P.onEnd = null; P.onStop = null;
    if (f) f();
  }

  function highlight(list) {
    $$('.playing').forEach((el) => {
      if (el.closest('#tutText')) return; // tutorial has its own highlighter
      el.classList.remove('playing');
    });
    // Only mark lines in the active practice tabs (not tutText unless asked)
    list.forEach((i) => $$(`[data-s="${i}"]`).forEach((el) => {
      if (el.closest('#tutText')) return;
      el.classList.add('playing');
    }));
    const tab = $(`#tab-${S.tab}`);
    const el = list.length ? $(`[data-s="${list[0]}"]`, tab) : null;
    if (el && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      if (r.top < 60 || r.bottom > window.innerHeight - 170) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  /* ---------------- Karaoke ---------------- */
  function clearWordHighlight(root) {
    $$((root ? '' : '') + '.kw.active, .kw.spoken', root || document).forEach((el) => {
      el.classList.remove('active', 'spoken');
    });
  }

  function wordIndexAt(words, t) {
    if (!words || !words.length) return -1;
    let active = -1;
    for (let i = 0; i < words.length; i++) {
      if (t + 0.02 >= words[i].start) active = i;
      else break;
    }
    return active;
  }

  function timingForItem(it) {
    if (!TIMINGS || !it) return null;
    if (it.timingKey && TIMINGS[it.timingBucket]) {
      return TIMINGS[it.timingBucket][it.timingKey] || null;
    }
    return null;
  }

  function paintWords(scopeEls, words, t) {
    const active = wordIndexAt(words, t);
    scopeEls.forEach((scope) => {
      const kws = $$('.kw', scope);
      kws.forEach((el, j) => {
        el.classList.toggle('active', j === active);
        el.classList.toggle('spoken', active >= 0 && j < active);
      });
    });
  }

  function paintBuildupWords(words, t) {
    const active = wordIndexAt(words, t);
    $$('.kw.active, .kw.spoken').forEach((el) => {
      if (!el.closest('#tutText')) el.classList.remove('active', 'spoken');
    });
    if (active < 0) return;
    const byLine = {};
    words.forEach((w, gi) => {
      if (!byLine[w.line]) byLine[w.line] = [];
      byLine[w.line].push(gi);
    });
    Object.keys(byLine).forEach((lineStr) => {
      const line = +lineStr;
      const globals = byLine[line];
      let localActive = -1;
      let spoken = 0;
      globals.forEach((gi, li) => {
        if (gi < active) spoken++;
        if (gi === active) localActive = li;
      });
      $$(`[data-s="${line}"]`).filter((el) => !el.closest('#tutText')).forEach((scope) => {
        $$('.kw', scope).forEach((el, j) => {
          if (localActive >= 0) {
            el.classList.toggle('spoken', j < localActive);
            el.classList.toggle('active', j === localActive);
          } else {
            el.classList.toggle('spoken', j < spoken);
            el.classList.remove('active');
          }
        });
      });
    });
  }

  function updateKaraoke(it, t) {
    const clip = timingForItem(it);
    if (!clip || !clip.words) { clearWordHighlight(); return; }
    if (it.follow && clip.words[0] && clip.words[0].line != null) {
      paintBuildupWords(clip.words, t);
      return;
    }
    const line = it.hl && it.hl.length ? it.hl[0] : null;
    if (line == null) return;
    const scopes = $$(`[data-s="${line}"]`).filter((el) => !el.closest('#tutText'));
    paintWords(scopes, clip.words, t);
  }

  const bar = $('#player'), barLabel = $('#playerLabel'), barState = $('#playerState'), barPause = $('#playerPause');
  let toastTimer = null;
  function renderBar() {
    if (P.state === 'idle') { if (!toastTimer) bar.hidden = true; return; }
    clearTimeout(toastTimer); toastTimer = null;
    bar.hidden = false;
    const it = P.q[P.i] || {};
    barLabel.textContent = P.label || it.name || '';
    let st = '';
    if (P.state === 'playing') st = `${it.name || ''} · ${it.slow ? 'slow' : 'normal'}${P.loop ? ' · looping' : ''}`;
    else if (P.state === 'waiting') st = `Your turn… ${Math.ceil(Math.max(0, P.due - performance.now()) / 1000)} s`;
    else st = 'Paused';
    barState.textContent = st;
    const paused = P.state === 'paused' || P.state === 'paused-wait';
    barPause.textContent = paused ? '▶' : '❚❚';
    barPause.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = paused ? 'paused' : 'playing';
  }
  function toastBar(msg) {
    bar.hidden = false; barLabel.textContent = msg; barState.textContent = '';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastTimer = null; if (P.state === 'idle') bar.hidden = true; }, 4000);
  }
  barPause.addEventListener('click', () => (P.state === 'paused' || P.state === 'paused-wait' ? resume() : pause()));
  $('#playerStop').addEventListener('click', stop);

  function setMedia(it) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: it.hl.length === 1 ? SENTENCES[it.hl[0]] : `Pater Noster, ${it.name}`,
        artist: 'Pater Noster practice', album: 'Cor Fidelis tutorial',
        artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }]
      });
    } catch (e) { /* ignore */ }
  }
  if ('mediaSession' in navigator) {
    const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) { /* unsupported */ } };
    h('play', resume); h('pause', pause); h('stop', stop);
  }

  // Item builders
  function sentenceItem(i, speed, extra) {
    speed = speed || S.speed;
    return Object.assign({
      src: clipSrc(i, speed), hl: [i], name: `Line ${i + 1}`, slow: speed === 'slow',
      gapAfter: speed === 'slow' ? 300 : 450,
      timingBucket: speed, timingKey: `s${i + 1}`
    }, extra || {});
  }
  function playRange(a, b, opts) {
    const items = range(a, b).map((i, j, arr) => sentenceItem(i, null, { stepStart: j === 0 ? undefined : false }));
    items[items.length - 1].gapAfter = opts && opts.loop ? S.loopGap : 0;
    start(items, Object.assign({ label: `Pater Noster, ${lineName(a, b)}` }, opts));
  }

  /* ---------------- Native players (tutorial tab) ---------------- */
  const natives = $$('audio.native');
  function pauseNative() { natives.forEach((a) => { if (!a.paused) a.pause(); }); }
  natives.forEach((a) => a.addEventListener('play', () => {
    if (P.state !== 'idle') stop();
    natives.forEach((b) => { if (b !== a && !b.paused) b.pause(); });
  }));
  $('#chapters').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-t]'); if (!b) return;
    const a = $('#tutAudio');
    const go = () => { a.currentTime = Number(b.dataset.t); a.play().catch(() => {}); };
    if (a.readyState >= 1) go(); else { a.preload = 'auto'; a.addEventListener('loadedmetadata', go, { once: true }); a.load(); }
  });

  // Tutorial karaoke for whole-prayer section
  const tutAudio = $('#tutAudio');
  const tutText = $('#tutText');
  tutText.innerHTML = SENTENCES.map((s, i) =>
    `<li data-s="${i}" data-tut="1"><span class="num">${i + 1}</span>${lineTextHtml(i)}</li>`
  ).join('');

  function updateTutorialKaraoke() {
    if (!TIMINGS || !TIMINGS.tutorial) return;
    const t = tutAudio.currentTime;
    const sec = TIMINGS.tutorial;
    const inSection = t >= sec.sectionStart - 0.15 && t <= sec.sectionEnd + 0.4;
    $$('#tutText li').forEach((el) => el.classList.remove('playing'));
    if (!inSection || tutAudio.paused) {
      clearWordHighlight(tutText);
      return;
    }
    const words = sec.words;
    const active = wordIndexAt(words, t);
    // Clear then paint
    $$('.kw', tutText).forEach((el) => el.classList.remove('active', 'spoken'));
    if (active < 0) return;
    const activeLine = words[active].line;
    $(`#tutText li[data-s="${activeLine}"]`).classList.add('playing');

    const byLine = {};
    words.forEach((w, gi) => {
      if (!byLine[w.line]) byLine[w.line] = [];
      byLine[w.line].push(gi);
    });
    Object.keys(byLine).forEach((lineStr) => {
      const line = +lineStr;
      const globals = byLine[line];
      const scope = $(`#tutText li[data-s="${line}"]`);
      if (!scope) return;
      let localActive = -1;
      let spoken = 0;
      globals.forEach((gi, li) => {
        if (gi < active) spoken++;
        if (gi === active) localActive = li;
      });
      $$('.kw', scope).forEach((el, j) => {
        el.classList.toggle('active', j === localActive);
        el.classList.toggle('spoken', localActive >= 0 ? j < localActive : j < spoken);
      });
    });
  }
  tutAudio.addEventListener('timeupdate', updateTutorialKaraoke);
  tutAudio.addEventListener('pause', () => { /* keep last highlight */ });
  tutAudio.addEventListener('ended', () => {
    $$('#tutText li').forEach((el) => el.classList.remove('playing'));
    clearWordHighlight(tutText);
  });

  /* ---------------- Tabs, speed, chips, English ---------------- */
  function showTab(t) {
    S.tab = t; save('tab');
    $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    $$('.tab').forEach((s) => { s.hidden = s.id !== `tab-${t}`; });
    $('.speedbar').hidden = t === 'tutorial';
    window.scrollTo(0, 0);
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  function renderSpeed() { $$('#speedSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.speed === S.speed))); }
  $('#speedSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-speed]'); if (!b) return;
    S.speed = b.dataset.speed; save('speed'); renderSpeed();
  });

  $('#showEnglish').addEventListener('change', (e) => {
    S.showEnglish = !!e.target.checked; save('showEnglish'); applyEnglish();
  });

  $$('.chips[data-target]').forEach((box) => {
    const key = box.dataset.target;
    const render = () => $$('button', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(S[key]))));
    box.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S[key] = b.dataset.v; save(key); render(); });
    render();
  });

  /* ---------------- 1. Lines ---------------- */
  const prayList = $('#prayList');
  prayList.innerHTML = SENTENCES.map((s, i) => `
    <li class="line" data-s="${i}">
      <button type="button" class="line-play" data-play="${i}" aria-label="Play line ${i + 1}">
        <span class="num">${i + 1}</span>${lineTextHtml(i)}
      </button>
      <button type="button" class="line-loop" data-loop="${i}" aria-label="Repeat line ${i + 1} until stopped">↻</button>
    </li>`).join('');
  prayList.addEventListener('click', (e) => {
    const p = e.target.closest('[data-play]'), l = e.target.closest('[data-loop]');
    if (p) playRange(+p.dataset.play, +p.dataset.play);
    if (l) playRange(+l.dataset.loop, +l.dataset.loop, { loop: true });
  });

  const selFrom = $('#loopFrom'), selTo = $('#loopTo');
  const opts = SENTENCES.map((_, i) => `<option value="${i}">${i + 1}</option>`).join('');
  selFrom.innerHTML = opts; selTo.innerHTML = opts;
  selFrom.value = S.loopFrom; selTo.value = S.loopTo;
  function fixRange(changed) {
    let a = +selFrom.value, b = +selTo.value;
    if (a > b) { if (changed === 'from') b = a; else a = b; }
    selFrom.value = a; selTo.value = b; S.loopFrom = a; S.loopTo = b; save('loopFrom'); save('loopTo');
  }
  selFrom.addEventListener('change', () => fixRange('from'));
  selTo.addEventListener('change', () => fixRange('to'));
  $('#loopStart').addEventListener('click', () => playRange(S.loopFrom, S.loopTo, { loop: true }));
  $('#playAll').addEventListener('click', () => playRange(0, N - 1));

  /* ---------------- 2. Build-up ---------------- */
  const steps = $('#steps');
  steps.innerHTML = range(1, N).map((n) => `<button type="button" data-step="${n}" aria-label="Step ${n}: lines 1 to ${n}">${n}</button>`).join('');
  let buildDone = false;

  function stepItems(n, auto) {
    const gap = auto ? S.buildGap : 0;
    const mark = () => reach(n);
    const onStart = () => { setStep(n); };
    if (S.speed === 'normal') {
      return [{
        src: buildSrc(n), hl: range(0, n - 1), follow: true, name: `Step ${n}`, slow: false,
        gapAfter: gap, onDone: mark, onStart,
        timingBucket: 'buildup', timingKey: `1-${n}`
      }];
    }
    return range(0, n - 1).map((k) => ({
      src: clipSrc(k, 'slow'), hl: [k], name: `Step ${n}, line ${k + 1}`, slow: true,
      stepStart: k === 0 ? undefined : false, gapAfter: k === n - 1 ? gap : 300,
      onDone: k === n - 1 ? mark : null, onStart: k === 0 ? onStart : null,
      timingBucket: 'slow', timingKey: `s${k + 1}`
    }));
  }
  function reach(n) {
    if (n > S.buildMax) { S.buildMax = n; save('buildMax'); }
    if (n === N) buildDone = true;
    renderBuild();
  }
  function setStep(n) { S.buildStep = Math.min(N, Math.max(1, n)); save('buildStep'); buildDone = buildDone && n === N; renderBuild(); }

  function playStep(n) {
    setStep(n);
    if (S.buildAuto) {
      let items = [];
      for (let k = n; k <= N; k++) items = items.concat(stepItems(k, true));
      items[items.length - 1].gapAfter = 0;
      start(items, { label: `Build-up from step ${n}`, onEnd: renderBuild });
    } else {
      start(stepItems(n, false), { label: `Build-up step ${n} of ${N}`, onEnd: renderBuild });
    }
  }

  function renderBuild() {
    const n = S.buildStep;
    $$('button', steps).forEach((b) => {
      const k = +b.dataset.step;
      b.classList.toggle('reached', k <= S.buildMax);
      b.classList.toggle('current', k === n);
      b.setAttribute('aria-pressed', String(k === n));
    });
    $('#stepTitle').textContent = `Step ${n} of ${N} · ${lineName(0, n - 1)}`;
    $('#buildText').innerHTML = range(0, n - 1).map((i) =>
      `<li data-s="${i}"><span class="num">${i + 1}</span>${lineTextHtml(i)}</li>`
    ).join('') +
      (buildDone && n === N ? '<li class="done-msg">Well done. That is the whole prayer. Amen.</li>' : '');
    $('#buildBack').disabled = n <= 1;
    $('#buildNext').disabled = n >= N;
    $('#buildPlay').textContent = S.buildAuto ? '▶ Play from here' : '▶ Play step';
    $('#buildAuto').checked = !!S.buildAuto;
    $('#buildProgress').textContent = S.buildMax
      ? (S.buildMax >= N ? `You have reached the whole prayer (step ${N} of ${N}).` : `Furthest step reached: ${S.buildMax} of ${N}.`)
      : 'Start with step 1. Your progress is saved on this phone.';
    if (P.state !== 'idle') { const it = P.q[P.i]; if (it) highlight(it.follow ? [] : it.hl); }
  }
  steps.addEventListener('click', (e) => { const b = e.target.closest('[data-step]'); if (!b) return; stop(); buildDone = false; setStep(+b.dataset.step); });
  $('#buildBack').addEventListener('click', () => { stop(); buildDone = false; setStep(S.buildStep - 1); });
  $('#buildNext').addEventListener('click', () => { buildDone = false; playStep(S.buildStep + 1); });
  $('#buildPlay').addEventListener('click', () => { buildDone = false; playStep(S.buildStep); });
  $('#buildAuto').addEventListener('change', (e) => { S.buildAuto = e.target.checked; save('buildAuto'); renderBuild(); });
  $('#buildReset').addEventListener('click', () => {
    if (!confirm('Start the build-up again from step 1?')) return;
    stop(); S.buildMax = 0; save('buildMax'); buildDone = false; setStep(1);
  });

  /* ---------------- 3. Memory ---------------- */
  const memList = $('#memList');
  const revealed = new Set();
  function wordsHtml(s, mode, lineIndex) {
    if (mode === 'full') {
      return s.split(' ').map((tok, j) => `<span class="kw w" data-w="${j}">${esc(tok)}</span>`).join(' ');
    }
    return s.split(' ').map((tok, j) => {
      const m = /^([^\p{L}\p{M}]*)([\p{L}\p{M}])([\p{L}\p{M}]*)([^\p{L}\p{M}]*)$/u.exec(tok);
      if (!m) return `<span class="kw w" data-w="${j}">${esc(tok)}</span>`;
      const [, pre, first, rest, post] = m;
      if (mode === 'letters') {
        return `${esc(pre)}<span class="kw w" data-w="${j}">${esc(first)}<span class="rest">${esc(rest)}</span></span>${esc(post)}`;
      }
      return `${esc(pre)}<span class="kw w" data-w="${j}"><span class="rest">${esc(first + rest)}</span></span>${esc(post)}`;
    }).join(' ');
  }
  function renderMem() {
    const mode = S.memMode;
    $$('#memSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    memList.className = `mem-list mode-${mode}`;
    memList.innerHTML = SENTENCES.map((s, i) => {
      const known = S.known.includes(i), rev = revealed.has(i);
      const showEn = mode === 'full' || rev;
      return `<li class="mem${known ? ' known' : ''}${rev ? ' revealed' : ''}" data-s="${i}" data-i="${i}">
        <div class="mem-head"><span class="num">${i + 1}</span>
          <div class="mem-text">
            <div class="latin" lang="la">${wordsHtml(s, mode, i)}</div>
            ${showEn ? enHtml(i) : `<span class="en" lang="en" hidden></span>`}
          </div>
        </div>
        <div class="mem-actions">
          <button type="button" class="btn" data-act="hear">▶ Hear</button>
          ${mode === 'full' ? '' : `<button type="button" class="btn" data-act="reveal">${rev ? 'Hide' : 'Reveal'}</button>`}
          <button type="button" class="btn${known ? ' on' : ''}" data-act="known" aria-pressed="${known}">${known ? '✓ I know it' : 'I know it'}</button>
        </div></li>`;
    }).join('');
    const k = S.known.length;
    $('#knownCount').textContent = k === N ? `All ${N} lines known by heart. Deo gratias!` : `${k} of ${N} lines known by heart.`;
    if (P.state !== 'idle' && P.q[P.i]) highlight(P.q[P.i].hl);
  }
  memList.addEventListener('click', (e) => {
    const li = e.target.closest('.mem'); if (!li) return;
    const i = +li.dataset.i;
    const act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'hear') playRange(i, i);
      if (act.dataset.act === 'reveal') { revealed.has(i) ? revealed.delete(i) : revealed.add(i); renderMem(); }
      if (act.dataset.act === 'known') {
        S.known = S.known.includes(i) ? S.known.filter((x) => x !== i) : S.known.concat(i).sort((a, b) => a - b);
        save('known'); renderMem();
      }
      return;
    }
    const w = e.target.closest('.w');
    if (w) w.classList.toggle('shown');
  });
  $('#memSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]'); if (!b) return;
    S.memMode = b.dataset.mode; save('memMode'); revealed.clear(); renderMem();
  });
  $('#memHideAll').addEventListener('click', () => { revealed.clear(); renderMem(); });

  /* ---------------- Install hint ---------------- */
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferredPrompt = null;
  if (!standalone && !store.get('installDismissed', false)) {
    $('#installText').textContent = isIOS
      ? 'In Safari, tap Share, then “Add to Home Screen”.'
      : 'In Chrome, tap ⋮ then “Add to Home screen” or “Install app”.';
    $('#installCard').hidden = false;
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; });
  $('#installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (e) { /* ignore */ }
    deferredPrompt = null; $('#installCard').hidden = true;
  });
  $('#installDismiss').addEventListener('click', () => { store.set('installDismissed', true); $('#installCard').hidden = true; });
  window.addEventListener('appinstalled', () => { $('#installCard').hidden = true; });

  /* ---------------- Offline ---------------- */
  const pill = $('#offlinePill'), offStatus = $('#offlineStatus');
  async function checkOffline(tries) {
    if (!('caches' in window)) return;
    try {
      const cache = await caches.open('pater-noster-' + self.APP_VERSION);
      const hits = await Promise.all(self.ASSETS.map((a) => cache.match(a)));
      const have = hits.filter(Boolean).length, total = self.ASSETS.length;
      if (have === total) {
        pill.textContent = '✓ Offline ready'; pill.className = 'pill ok'; pill.hidden = false;
        offStatus.textContent = `Saved for offline use: all ${total} files, including every recording (version ${self.APP_VERSION}).`;
        return;
      }
      pill.textContent = 'Saving for offline…'; pill.className = 'pill'; pill.hidden = false;
      offStatus.textContent = `Saving for offline use: ${have} of ${total} files.`;
    } catch (e) { /* ignore */ }
    if (tries > 0) setTimeout(() => checkOffline(tries - 1), 1500);
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js', { scope: './' })
      .then(() => checkOffline(80))
      .catch(() => { offStatus.textContent = 'Offline saving is not available in this browser.'; });
    navigator.serviceWorker.addEventListener('controllerchange', () => checkOffline(20));
  } else {
    offStatus.textContent = 'Open the app over https to save it for offline use.';
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  /* ---------------- Init ---------------- */
  applyEnglish();
  renderSpeed();
  renderBuild();
  renderMem();
  showTab(['pray', 'build', 'memory', 'tutorial'].includes(S.tab) ? S.tab : 'pray');
})();
