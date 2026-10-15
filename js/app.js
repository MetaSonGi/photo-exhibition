/* 사진전시관 — 다섯 개의 방 */
'use strict';

const IMG_EXT = ['jpg','jpeg','png','webp','gif','bmp'];
const VID_EXT = ['mp4','webm','mov','m4v'];

const state = {
  config: { title:'사진전시관', subtitle:'다섯 개의 방에 거는 사진들', accent:'#c9a227', accent2:'#e8c874', artist:'MetaSongi', year:'2026' },
  criteria: { min: 4, max: 100 },
  items: [],
  style: 'walkthrough',
  walkTheme: 'whitecube',
  space: { light: 1, speed: 1 },
  seq: 0,
};
/* 3D 전시관 공간 디자인 테마 */
const WALK_THEMES = {
  whitecube:  { label:'화이트큐브', bg:0x0e0e10, fog:[0x0e0e10,14,34], wall:0xece5d8, floor:0x8a6f52, ceil:0x17171a, hemi:[0xfff6e8,0x2a2a30], lamp:0xffe2b0, lampI:0.55 },
  darkmood:   { label:'다크 무드', bg:0x060607, fog:[0x060607,11,28], wall:0x232328, floor:0x141416, ceil:0x0b0b0d, hemi:[0xa9bdf5,0x14151c], lamp:0xa9bdf5, lampI:0.7 },
  industrial: { label:'인더스트리얼', bg:0x131210, fog:[0x131210,13,32], wall:0x53524e, floor:0x3c3833, ceil:0x232220, hemi:[0xffd9a0,0x2e271c], lamp:0xffc37a, lampI:0.6 },
};
let walkCleanup = null;
let carCleanup = null;
const walkView = { x: 0, z: 0, yaw: 0, pitch: 0, valid: false };
const pj = { list: [], idx: 0, timer: null };

/* ---------- 헬퍼 ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer = null;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.hidden = true, 2600);
}
function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9가-힣]+/g,'-'); }

/* ---------- 전시품 로컬 저장 (새로고침해도 유지) ---------- */
let itemsReady = false;
function saveItems(){
  if (!itemsReady) return;
  try{ localStorage.setItem('ex_items_' + slug(state.config.title), JSON.stringify(state.items)); }
  catch(e){}
}
function loadItems(){
  try{
    const arr = JSON.parse(localStorage.getItem('ex_items_' + slug(state.config.title)) || '[]');
    if (!Array.isArray(arr)) return;
    let dropped = 0;
    state.items = arr.filter(it => {
      if (it && it.url && String(it.url).startsWith('blob:')){ dropped++; return false; }
      return it && it.url;
    });
    state.seq = state.items.reduce((m, it) => {
      const n = parseInt(String(it.id || '').replace(/\D/g, ''), 10);
      return n > m ? n : m;
    }, 0);
    if (dropped) setTimeout(() => toast(`직접 올린 파일 ${dropped}장은 새로고침 후 사라졌어요. 다시 올려주세요`), 800);
  }catch(e){}
  itemsReady = true;
}

/* ---------- 설정 ---------- */
async function loadConfig(){
  try{
    const r = await fetch('config.json');
    if (r.ok) Object.assign(state.config, await r.json());
  }catch(e){}
  const c = state.config;
  document.documentElement.style.setProperty('--accent', c.accent);
  document.documentElement.style.setProperty('--accent2', c.accent2);
  document.title = c.title;
  const savedTitle = localStorage.getItem('ex_title_' + slug(c.title));
  $('#exTitle').textContent = savedTitle || c.title;
  $('#exSubtitle').textContent = c.subtitle;
  try{
    const crit = JSON.parse(localStorage.getItem('ex_crit_' + slug(c.title)) || 'null');
    if (crit && crit.min >= 1 && crit.max >= crit.min) state.criteria = crit;
  }catch(e){}
  try{
    const wt = localStorage.getItem('ex_wtheme_' + slug(c.title));
    if (wt && WALK_THEMES[wt]) state.walkTheme = wt;
  }catch(e){}
  try{
    const sp = JSON.parse(localStorage.getItem('ex_space_' + slug(c.title)) || 'null');
    if (sp){ if (sp.light > 0) state.space.light = sp.light; if (sp.speed > 0) state.space.speed = sp.speed; }
    const au = JSON.parse(localStorage.getItem('ex_amb_' + slug(c.title)) || 'null');
    if (au){ if (typeof au.on === 'boolean') amb.on = au.on; if (au.vol >= 0) amb.vol = au.vol; if (typeof au.chime === 'boolean') amb.chime = au.chime; }
  }catch(e){}
}
function saveSpace(){
  try{
    localStorage.setItem('ex_space_' + slug(state.config.title), JSON.stringify(state.space));
    localStorage.setItem('ex_amb_' + slug(state.config.title), JSON.stringify({ on: amb.on, vol: amb.vol, chime: amb.chime }));
  }catch(e){}
}

/* ---------- 3D 공간 설정 ---------- */
function openSpaceModal(){
  const st = $('#spaceThemes');
  st.innerHTML = Object.entries(WALK_THEMES).map(([k, t]) =>
    `<button class="btn sm${k === state.walkTheme ? ' primary' : ''}" data-stheme="${k}">${t.label}</button>`).join('');
  st.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    state.walkTheme = b.dataset.stheme;
    localStorage.setItem('ex_wtheme_' + slug(state.config.title), state.walkTheme);
    openSpaceModal(); renderGallery();
    toast(`${WALK_THEMES[state.walkTheme].label} 공간으로 바꿨어요`);
  }));
  $('#setLight').value = Math.round(state.space.light * 100);
  $('#setLightV').textContent = Math.round(state.space.light * 100) + '%';
  $('#setSpeed').value = Math.round(state.space.speed * 100);
  $('#setSpeedV').textContent = Math.round(state.space.speed * 100) + '%';
  syncAmbUI();
  $('#spaceModal').hidden = false;
}
function syncAmbUI(){
  $('#setAmbToggle').textContent = amb.on ? '🔊 켜짐' : '🔇 꺼짐';
  $('#setAmbVol').value = amb.vol;
  $('#setAmbVolV').textContent = amb.vol + '%';
  $('#setChimeToggle').textContent = amb.chime ? '🔔 켜짐' : '🔕 꺼짐';
}

/* ---------- 작품 정보 편집 ---------- */
function openEditModal(){
  $('#editSearch').value = '';
  renderEditList('');
  $('#editModal').hidden = false;
}
function renderEditList(q){
  const list = $('#editList');
  const query = (q || '').trim();
  const rows = state.items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => !query || (it.title || '').includes(query));
  list.innerHTML = rows.map(({ it, i }) => {
    const thumb = it.type === 'image'
      ? (it.source === 'drive' ? String(it.url).replace('sz=w1920', 'sz=w200') : it.url) : '';
    return `<div class="edit-row">
      ${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : `<div class="edit-vid">▶</div>`}
      <div class="edit-fields">
        <div class="edit-no">No.${i + 1}${it.type === 'video' ? ' · 영상' : ''}</div>
        <input class="textin et" data-id="${it.id}" data-f="title" value="${esc(it.title)}" placeholder="제목">
        <input class="textin ed" data-id="${it.id}" data-f="desc" value="${esc(it.desc)}" placeholder="설명">
      </div>
    </div>`;
  }).join('') || '<p class="hint">검색 결과가 없어요.</p>';
  list.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      const it = state.items.find(x => x.id === inp.dataset.id);
      if (it){ it[inp.dataset.f] = inp.value; saveItems(); }
    });
  });
}
function closeEditModal(){
  $('#editModal').hidden = true;
  renderGallery(); // 3D 명판에 반영
}

/* ---------- 미디어 로드 ---------- */
function extOf(name){ const m = /\.([a-z0-9]+)$/i.exec(name||''); return m ? m[1].toLowerCase() : ''; }
function prettyTitle(name){
  const t = (name||'').replace(/\.[a-z0-9]+$/i,'').replace(/[_\-.]+/g,' ').replace(/\s+/g,' ').trim();
  return t || '무제';
}
function addItems(files){
  let n = 0;
  for (const f of files){
    const ext = extOf(f.name);
    const type = IMG_EXT.includes(ext) ? 'image' : VID_EXT.includes(ext) ? 'video' : null;
    if (!type) continue;
    state.items.push({
      id: 'w' + (++state.seq),
      name: f.name, title: prettyTitle(f.name),
      desc: '', url: URL.createObjectURL(f), type, source: 'folder',
    });
    n++;
  }
  return n;
}
/* 데모 → 내 사진으로 교체 */
function swapOutDemo(){
  const n = state.items.filter(i => i.source === 'demo').length;
  if (n) state.items = state.items.filter(i => i.source !== 'demo');
  return n;
}
async function loadDemo(){
  try{
    const r = await fetch('assets/demo/manifest.json');
    if (!r.ok) throw 0;
    const data = await r.json();
    state.items = state.items.filter(i => i.source !== 'demo');
    for (const m of data.items){
      state.items.push({
        id: 'w' + (++state.seq),
        name: m.file, title: m.title || prettyTitle(m.file),
        desc: m.desc || '', url: 'assets/demo/' + m.file,
        type: m.type || 'image', source: 'demo',
      });
    }
    renderAll();
    toast(`데모 전시 ${data.items.length}점을 걸었어요`);
  }catch(e){ toast('데모를 불러오지 못했어요'); }
}
function onFilesChosen(e){
  const files = [...(e.target.files || [])];
  const swapped = swapOutDemo();
  const n = addItems(files);
  e.target.value = '';
  if (n){ renderAll(); toast(`${n}점을 전시실에 걸었어요${swapped ? ` · 데모 ${swapped}점을 교체했어요` : ''}`); }
  else toast('사진·영상 파일이 없어요');
}

/* ---------- 갤러리 ---------- */
function renderAll(){ renderGallery(); renderCriteriaBar(); saveItems(); }
function renderGallery(){
  if (walkCleanup){ walkCleanup(); walkCleanup = null; }
  if (carCleanup){ carCleanup(); carCleanup = null; }
  document.body.classList.remove('dark');
  const g = $('#gallery');
  const items = state.items;
  $('#emptyState').style.display = items.length ? 'none' : 'block';
  g.style.display = items.length ? '' : 'none';
  if (!items.length) return;

  state.style = 'walkthrough';
  g.className = 'gallery fade g-walkthrough';
  renderWalkthrough(g, items);
}
function setActiveNav(style){
  document.querySelector('#styleSwitch .active')?.classList.remove('active');
  document.querySelector(`#styleSwitch [data-style="${style}"]`)?.classList.add('active');
}
function num2(n){ return String(n).padStart(2,'0'); }
function metaLine(){ return `${state.config.artist} · ${state.config.year}`; }

/* --- 화이트큐브 --- */
function renderWhiteCube(g, items){
  g.innerHTML = items.map((it, i) => `
    <article class="work" data-id="${it.id}">
      <div class="frame"><div class="inner">
        ${it.type === 'image'
          ? `<img src="${esc(it.url)}" alt="${esc(it.title)}" loading="lazy">`
          : `<video src="${esc(it.url)}" muted loop playsinline preload="metadata"></video>`}
      </div></div>
      <div class="plate">
        <span class="no">${num2(i+1)}</span>
        <div>
          <h3 contenteditable="true" spellcheck="false" data-f="title" data-id="${it.id}">${esc(it.title)}</h3>
          <p>${esc(metaLine())}${it.type==='video' ? ' · 영상' : ''}</p>
          <div class="desc" contenteditable="true" spellcheck="false" data-f="desc" data-id="${it.id}">${esc(it.desc)}</div>
        </div>
      </div>
    </article>`).join('');
  bindWorkCards(g);
  bindEditable(g);
  g.querySelectorAll('video').forEach(v => {
    const w = v.closest('.work');
    w.addEventListener('mouseenter', () => v.play().catch(()=>{}));
    w.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
  });
}
/* --- 다크룸 --- */
function renderDarkroom(g, items){
  g.innerHTML = items.map(it => `
    <article class="dwork" data-id="${it.id}">
      ${it.type === 'image'
        ? `<img src="${esc(it.url)}" alt="${esc(it.title)}" loading="lazy">`
        : `<video src="${esc(it.url)}" muted loop playsinline preload="metadata"></video>`}
      <div class="dcap"><h3>${esc(it.title)}</h3><p>${esc(metaLine())}</p></div>
    </article>`).join('');
  bindWorkCards(g);
}
/* --- 매거진 --- */
function renderMagazine(g, items){
  const [cover, ...rest] = items;
  const coverHTML = cover ? `
    <div class="mag-cover">
      <img src="${esc(cover.url)}" alt="${esc(cover.title)}">
      <div class="mag-title"><h2>${esc(cover.title)}</h2><p>${esc(state.config.subtitle)}</p></div>
    </div>` : '';
  const rows = rest.map((it, i) => `
    <div class="mag-row">
      <div class="mag-img">
        <img src="${esc(it.url)}" alt="${esc(it.title)}" loading="lazy">
        <div class="cap">FIG. ${num2(i+2)} — ${esc(it.title)}</div>
      </div>
      <div class="mag-text">
        <h3><span class="n">No.${num2(i+2)}</span>${esc(it.title)}</h3>
        <p class="${i===0?'drop':''}">${esc(it.desc || '작품 설명을 클릭해서 입력할 수 있습니다.')}</p>
        <p style="margin-top:10px;font-size:12px;color:var(--muted);letter-spacing:2px">${esc(metaLine())}</p>
      </div>
    </div>`).join('');
  g.innerHTML = coverHTML + rows + `<div class="mag-end"><div class="fin">끝</div>END OF EXHIBITION</div>`;
  g.querySelector('.mag-cover')?.addEventListener('click', () => openLightbox(cover.id));
  g.querySelectorAll('.mag-img img').forEach((img, i) =>
    img.addEventListener('click', () => openLightbox(rest[i].id)));
  g.querySelectorAll('.mag-img img,.mag-cover img').forEach(el => el.style.cursor = 'pointer');
}
/* --- 벤토 그리드 --- */
const BENTO_PAT = [[2,2],[1,1],[1,1],[1,2],[1,1],[2,1],[1,1],[1,1],[2,2],[1,1],[1,2],[2,1]];
function renderBento(g, items){
  g.innerHTML = items.map((it, i) => {
    const [c, r] = BENTO_PAT[i % BENTO_PAT.length];
    const media = it.type === 'image'
      ? `<img src="${esc(it.url)}" alt="${esc(it.title)}" loading="lazy">`
      : `<video src="${esc(it.url)}" muted playsinline preload="metadata"></video>`;
    return `<div class="bento-item" data-id="${it.id}" style="grid-column:span ${c};grid-row:span ${r}">
      ${media}
      ${it.type === 'video' ? '<span class="type-badge">▶</span>' : ''}
      <div class="bcap">${esc(it.title)}</div></div>`;
  }).join('');
  bindWorkCards2(g);
}
/* --- 가로 스크롤 --- */
function renderHScroll(g, items){
  g.innerHTML = items.map((it, i) => `
    <div class="hcard" data-id="${it.id}">
      ${it.type === 'image'
        ? `<img src="${esc(it.url)}" alt="${esc(it.title)}" loading="lazy">`
        : `<video src="${esc(it.url)}" muted loop playsinline preload="metadata"></video>`}
      <div class="hcap"><span>${num2(i+1)}</span>${esc(it.title)}</div>
    </div>`).join('');
  bindWorkCards2(g);
  g.querySelectorAll('video').forEach(v => {
    const card = v.closest('.hcard');
    card.addEventListener('mouseenter', () => v.play().catch(()=>{}));
    card.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
  });
}
/* --- 마퀴 --- */
function renderMarquee(g, items){
  const card = it => `
    <div class="mq-item" data-id="${it.id}">
      <img src="${esc(it.url)}" alt="${esc(it.title)}" loading="lazy" draggable="false">
      <div class="bcap">${esc(it.title)}</div>
    </div>`;
  const half = items.map(card).join('');
  g.innerHTML = `<div class="mq-row">${half}${half}</div><div class="mq-row rev">${half}${half}</div>
    <div class="walk-hint" style="position:static;transform:none;display:inline-block;margin-top:6px">마우스를 올리면 멈춤 · 클릭으로 크게 보기</div>`;
  bindWorkCards2(g);
}
/* --- 3D 캐러셀 --- */
function renderCarousel(g, items){
  const list = items.slice(0, 64);
  g.innerHTML = `<div class="car-stage" id="carStage"></div>
    <div class="walk-hint">드래그로 회전 · 클릭으로 크게 보기</div>`;
  const stage = $('#carStage');
  const n = list.length;
  const R = Math.max(420, n * 52);
  list.forEach(it => {
    const d = document.createElement('div');
    d.className = 'car-item'; d.dataset.id = it.id;
    d.innerHTML = `${it.type === 'image'
      ? `<img src="${esc(it.url)}" alt="${esc(it.title)}" draggable="false">`
      : `<video src="${esc(it.url)}" muted playsinline preload="metadata"></video>`}
      <div class="ccap">${esc(it.title)}</div>`;
    stage.appendChild(d);
  });
  const els = [...stage.children];
  let ang = 0, target = 0, dragging = false, lx = 0, moved = 0, raf = 0, alive = true;
  const layout = () => {
    els.forEach((el, i) => {
      const a = ang + i * (360 / n);
      const rad = a * Math.PI / 180;
      const facing = Math.cos(rad); // 1 = 정면
      const scale = 1 + Math.max(0, facing) * 0.18;
      el.style.transform =
        `translate(-50%,-50%) rotateY(${a}deg) translateZ(${R}px) scale(${scale.toFixed(3)})`;
      el.style.zIndex = Math.round(facing * 100);
      el.style.opacity = (0.25 + Math.max(0, facing) * 0.75).toFixed(2);
      el.style.pointerEvents = facing > 0.3 ? 'auto' : 'none';
    });
  };
  const loop = () => {
    if (!alive) return;
    if (!dragging) target += 0.14;
    ang += (target - ang) * 0.07;
    layout();
    raf = requestAnimationFrame(loop);
  };
  const dn = e => { dragging = true; lx = e.clientX; moved = 0; stage.style.cursor = 'grabbing'; };
  const mv = e => {
    if (!dragging) return;
    const dx = e.clientX - lx; lx = e.clientX; moved += Math.abs(dx);
    target += dx * 0.28;
  };
  const up = () => { dragging = false; stage.style.cursor = 'grab'; };
  stage.addEventListener('pointerdown', dn);
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
  stage.style.cursor = 'grab';
  stage.addEventListener('click', e => {
    if (moved > 8) return;
    const item = e.target.closest('.car-item');
    if (item) openLightbox(item.dataset.id);
  });
  layout(); loop();
  carCleanup = () => {
    alive = false; cancelAnimationFrame(raf);
    stage.removeEventListener('pointerdown', dn);
    window.removeEventListener('pointermove', mv);
    window.removeEventListener('pointerup', up);
  };
}
/* --- 폴라로이드 --- */
function renderPolaroid(g, items){
  g.innerHTML = items.map((it, i) => `
    <figure class="pol" data-id="${it.id}" style="--r:${((i * 37) % 11) - 5}deg">
      ${it.type === 'image'
        ? `<img src="${esc(it.url)}" alt="${esc(it.title)}" loading="lazy">`
        : `<video src="${esc(it.url)}" muted playsinline preload="metadata"></video>`}
      <figcaption>${esc(it.title)}</figcaption>
    </figure>`).join('');
  bindWorkCards2(g);
}
function bindWorkCards2(g){
  g.querySelectorAll('[data-id]').forEach(el =>
    el.addEventListener('click', () => openLightbox(el.dataset.id)));
}

/* ---------- 전시 기준 ---------- */
function renderCriteriaBar(){
  const bar = $('#criteriaBar');
  const n = state.items.length;
  const { min, max } = state.criteria;
  if (!n){ bar.hidden = true; return; }
  bar.hidden = false;
  let cls = 'ok', html = `🖼️ ${n}장 · 기준 ${min}~${max}장`;
  if (n < min){ cls = 'warn'; html = `⚠️ 최소 ${min}장이 필요해요 — 현재 ${n}장, ${min - n}장 더 걸어주세요`; }
  else if (n > max){ cls = 'warn'; html = `⚠️ 최대 ${max}장을 초과했어요 — 현재 ${n}장 <button class="btn sm" id="btnRaiseMax">기준을 ${n}장으로 늘리기</button> <button class="btn sm" id="btnTrim">앞 ${max}장만 남기기</button>`; }
  bar.className = 'criteria ' + cls;
  bar.innerHTML = html;
  $('#btnRaiseMax')?.addEventListener('click', () => {
    state.criteria.max = Math.max(state.criteria.max, state.items.length);
    localStorage.setItem('ex_crit_' + slug(state.config.title), JSON.stringify(state.criteria));
    renderAll();
    toast(`전시 기준을 ${state.criteria.min}~${state.criteria.max}장으로 늘렸어요`);
  });
  $('#btnTrim')?.addEventListener('click', () => {
    state.items = state.items.slice(0, max);
    renderAll();
    toast(`앞 ${max}장만 남겼어요`);
  });
}
function openCriteriaModal(){
  $('#critMin').value = state.criteria.min;
  $('#critMax').value = state.criteria.max;
  $('#criteriaModal').hidden = false;
}
function saveCriteria(){
  let mn = Math.max(1, parseInt($('#critMin').value, 10) || 1);
  let mx = Math.max(1, parseInt($('#critMax').value, 10) || 1);
  if (mn > mx) [mn, mx] = [mx, mn];
  state.criteria = { min: mn, max: mx };
  localStorage.setItem('ex_crit_' + slug(state.config.title), JSON.stringify(state.criteria));
  $('#criteriaModal').hidden = true;
  renderCriteriaBar();
  toast(`전시 기준을 ${mn}~${mx}장으로 정했어요`);
}

function bindWorkCards(g){
  g.querySelectorAll('[data-id]').forEach(el => {
    if (el.classList.contains('work') || el.classList.contains('dwork'))
      el.addEventListener('click', e => {
        if (e.target.isContentEditable) return;
        openLightbox(el.dataset.id);
      });
  });
}
function bindEditable(g){
  g.querySelectorAll('[contenteditable]').forEach(el => {
    el.addEventListener('click', e => e.stopPropagation());
    el.addEventListener('blur', () => {
      const it = state.items.find(x => x.id === el.dataset.id);
      if (it){ it[el.dataset.f] = el.textContent.trim(); saveItems(); }
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); el.blur(); } });
  });
}

/* ---------- 3D 전시관 워크스루 ---------- */

/* 3D 공간 음향: 은은한 앰비언트 패드 + 방향성 차임 (WebAudio, HRTF 패닝) */
const amb = { ctx:null, master:null, on:true, vol:50, chime:true };
function ambienceInit(){
  if (amb.ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try{
    const ctx = new AC(); amb.ctx = ctx;
    const master = ctx.createGain(); master.gain.value = (amb.vol / 100) * 0.26; master.connect(ctx.destination);
    amb.master = master;
    // 앰비언트 패드 (C3·G3·C4, 로우패스 + 느린 LFO)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.connect(master);
    [[130.81,'triangle'],[196.00,'triangle'],[261.63,'sine']].forEach(([f, t], i) => {
      const o = ctx.createOscillator(); o.type = t; o.frequency.value = f; o.detune.value = i*4 - 4;
      const g = ctx.createGain(); g.gain.value = 0.045;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06 + i*0.03;
      const lg = ctx.createGain(); lg.gain.value = 0.02;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(lp); o.start(); lfo.start();
    });
    // 방향성 차임 2곳 — 걸어다니며 방향을 느낄 수 있게
    const mkChime = (x, z, base, every) => {
      const pan = ctx.createPanner();
      pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse';
      pan.refDistance = 2; pan.maxDistance = 40;
      if (pan.positionX){ pan.positionX.value = x; pan.positionY.value = 2; pan.positionZ.value = z; }
      else pan.setPosition(x, 2, z);
      pan.connect(master);
      const play = () => {
        if (!amb.on || !amb.chime || !amb.ctx) return;
        const t = ctx.currentTime;
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.value = base * (Math.random() < 0.5 ? 1 : 1.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.08, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
        o.connect(g); g.connect(pan); o.start(t); o.stop(t + 4);
        setTimeout(play, every + Math.random()*5000);
      };
      setTimeout(play, 2500 + Math.random()*4000);
    };
    mkChime(-10, -4, 523.25, 9000);
    mkChime(10, 4, 392.00, 12000);
  }catch(e){ /* 오디오 미지원 환경 무시 */ }
}
function ambienceUpdate(camera, yaw, pitch){
  if (!amb.ctx || !amb.on) return;
  const L = amb.ctx.listener, p = camera.position;
  const fx = -Math.sin(yaw)*Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw)*Math.cos(pitch);
  try{
    if (L.positionX){
      L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
      L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(p.x, p.y, p.z); L.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }catch(e){}
}
function ambienceApplyVol(){
  if (amb.ctx && amb.master) amb.master.gain.value = (amb.vol / 100) * 0.26;
}
function ambienceSet(on){
  amb.on = on;
  if (amb.ctx){ on ? amb.ctx.resume().catch(()=>{}) : amb.ctx.suspend().catch(()=>{}); }
  saveSpace();
}

function renderWalkthrough(g, items){
  if (typeof THREE === 'undefined'){ toast('3D 라이브러리를 불러오지 못했어요'); return; }
  const theme = WALK_THEMES[state.walkTheme] || WALK_THEMES.whitecube;
  g.innerHTML = `
    <div class="walk-ui">
      <button class="btn" id="btnTour">🎧 도슨트 투어</button>
      <button class="btn" id="btnSpace">⚙️ 공간 설정</button>
      <button class="btn" id="btnEdit">📝 작품 편집</button>
      <button class="btn" id="btnWalkHelp">❔ 조작법</button>
    </div>
    <div class="walk-hint">드래그: 시점 회전 · W A S D: 이동 · 작품 클릭: 크게 보기</div>
    <div class="walk-loading" id="walkLoading">
      <div class="walk-loading-t">🖼️ 전시장을 준비하는 중…</div>
      <div class="walk-loading-bar"><div id="walkBar"></div></div>
    </div>
    <div class="walk-lookcard" id="walkLook" hidden></div>`;
  const W = g.clientWidth, H = Math.max(480, Math.min(760, Math.round(W * 0.5)));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.bg);
  scene.fog = new THREE.Fog(theme.bg, 25, 150);
  const camera = new THREE.PerspectiveCamera(68, W/H, 0.1, 400);
  const EYE = 1.65;
  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  g.insertBefore(renderer.domElement, g.firstChild);

  /* ---------- 전시장 레이아웃 (서펜타인 파티션) ---------- */
  const N = items.length;
  const SEGS_PER_ROW = 4, SEG_LEN = 15, SEG_T = 0.4, SEG_H = 4.2;
  const ROW_GAP = 9, SPACING = 3.0, ART_Y = 1.75, FW = 1.9, FH = 1.2;
  const perSide = Math.max(2, Math.floor(SEG_LEN / SPACING));
  const rows = Math.max(1, Math.ceil(N / (perSide * 2 * SEGS_PER_ROW)));
  const rowW = SEGS_PER_ROW * SEG_LEN + (SEGS_PER_ROW - 1) * 6;
  const hallW = rowW + 24, hallD = (rows - 1) * ROW_GAP + 30;
  const hw = hallW / 2, hd = hallD / 2, HH = 5.6;
  const firstRowZ = -(rows - 1) * ROW_GAP / 2;
  let yaw0 = 0, pitch0 = 0;
  const spawnZ = rows <= 2 ? Math.min(hd - 4, firstRowZ + 5.5) : hd - 4;
  if (walkView.valid){
    camera.position.set(walkView.x, EYE, walkView.z);
    yaw0 = walkView.yaw; pitch0 = walkView.pitch;
  } else {
    camera.position.set(0, EYE, spawnZ);
  }

  scene.add(new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], 0.95 * state.space.light));
  // 천장 조명 스트립 + 스포트라이트 (작품 조명)
  const stripMat = new THREE.MeshBasicMaterial({ color: theme.lamp });
  const stripGeo = new THREE.BoxGeometry(rowW, 0.09, 1.4);
  const glowMat = new THREE.MeshBasicMaterial({ color: theme.lamp, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowGeo = new THREE.PlaneGeometry(rowW, 4.2);
  for (let r = 0; r < rows; r++){
    const z = -(rows - 1) * ROW_GAP / 2 + r * ROW_GAP;
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, HH - 0.08, z); scene.add(strip);
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = Math.PI / 2; glow.position.set(0, HH - 0.5, z); scene.add(glow);
    for (const sx of [-rowW / 4, rowW / 4]){
      const sp = new THREE.SpotLight(theme.lamp, theme.lampI * 1.6 * state.space.light, 34, 0.62, 0.45, 1.1);
      sp.position.set(sx, HH - 0.3, z);
      sp.target.position.set(sx, 1.1, z);
      scene.add(sp); scene.add(sp.target);
    }
  }

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(hallW, hallD),
    new THREE.MeshStandardMaterial({ color: theme.floor, roughness: .3, metalness: .12 }));
  floor.rotation.x = -Math.PI/2; scene.add(floor);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(hallW, hallD),
    new THREE.MeshStandardMaterial({ color: theme.ceil, roughness: 1 }));
  ceil.rotation.x = Math.PI/2; ceil.position.y = HH; scene.add(ceil);
  const wallMat = new THREE.MeshStandardMaterial({ color: theme.wall, roughness: .95 });
  const mkWall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  };
  mkWall(hallW, HH, 0, HH/2, -hd, 0);
  mkWall(hallW, HH, 0, HH/2,  hd, Math.PI);
  mkWall(hallD, HH, -hw, HH/2, 0, Math.PI/2);
  mkWall(hallD, HH,  hw, HH/2, 0, -Math.PI/2);

  // 공간 음향
  ambienceInit();
  if (amb.on && amb.ctx) amb.ctx.resume().catch(() => {});

  /* ---------- 작품 배치 ---------- */
  const manager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(manager);
  loader.setCrossOrigin('anonymous');
  const bar = $('#walkBar'), loadingEl = $('#walkLoading');
  manager.onProgress = (u, loaded, total) => {
    if (bar) bar.style.width = Math.round(loaded / Math.max(1, total) * 100) + '%';
  };
  manager.onLoad = () => { if (loadingEl){ loadingEl.style.opacity = '0'; setTimeout(() => loadingEl.remove(), 600); } };
  setTimeout(() => loadingEl?.remove(), 20000); // 안전망: 20초 후 강제 제거

  const thumbUrl = it => (it.source === 'drive' ? String(it.url).replace('sz=w1920', 'sz=w400') : it.url);
  let texCount = 0;
  const wallGeo = new THREE.BoxGeometry(SEG_LEN, SEG_H, SEG_T);
  const frameGeo = new THREE.BoxGeometry(FW + 0.16, FH + 0.16, 0.07);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x191919, roughness: .5, metalness: .25 });
  const photoGeo = new THREE.PlaneGeometry(FW, FH);
  const colliders = [];
  const photoMeshes = [];
  const waypoints = [];

  const badgeTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#101014'; cx.fillRect(0, 0, 256, 160);
    cx.fillStyle = '#c9a227'; cx.beginPath();
    cx.moveTo(108, 58); cx.lineTo(108, 102); cx.lineTo(148, 80); cx.closePath(); cx.fill();
    cx.fillStyle = '#8a8478'; cx.font = '20px sans-serif'; cx.textAlign = 'center';
    cx.fillText('VIDEO', 128, 132);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  let idx = 0;
  outer:
  for (let r = 0; r < rows; r++){
    const z = -(rows - 1) * ROW_GAP / 2 + r * ROW_GAP;
    for (let s = 0; s < SEGS_PER_ROW; s++){
      const cx = -rowW / 2 + SEG_LEN / 2 + s * (SEG_LEN + 6);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(cx, SEG_H / 2, z); scene.add(wall);
      colliders.push({ minX: cx - SEG_LEN/2, maxX: cx + SEG_LEN/2, minZ: z - SEG_T/2, maxZ: z + SEG_T/2 });
      for (const side of [1, -1]){
        for (let k = 0; k < perSide; k++){
          if (idx >= N) break outer;
          const it = items[idx];
          const x = cx - (perSide - 1) * SPACING / 2 + k * SPACING;
          const grp = new THREE.Group();
          grp.position.set(x, ART_Y, z + side * (SEG_T/2 + 0.06));
          grp.rotation.y = side > 0 ? 0 : Math.PI;
          const frame = new THREE.Mesh(frameGeo, frameMat); grp.add(frame);
          const mat = new THREE.MeshBasicMaterial({ color: 0x2a2a2e });
          const photo = new THREE.Mesh(photoGeo, mat);
          photo.position.z = 0.045; photo.userData.itemId = it.id; photo.userData.index = idx;
          grp.add(photo); photoMeshes.push(photo);
          if (it.type === 'image'){
            texCount++;
            loader.load(thumbUrl(it),
              tex => {
                tex.colorSpace = THREE.SRGBColorSpace;
                const ia = tex.image.width / tex.image.height, fa = FW / FH;
                if (ia > fa){ tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = fa / ia; tex.offset.x = (1 - tex.repeat.x) / 2; }
                else { tex.wrapT = THREE.RepeatWrapping; tex.repeat.y = ia / fa; tex.offset.y = (1 - tex.repeat.y) / 2; }
                mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
              },
              undefined,
              () => { mat.color.set(0x3a3a40); });
          } else {
            mat.map = badgeTex; mat.color.set(0xffffff);
          }
          // 캡션 플레이트
          const cv = document.createElement('canvas'); cv.width = 512; cv.height = 112;
          const c2 = cv.getContext('2d');
          c2.fillStyle = '#f5f2ea'; c2.fillRect(0, 0, 512, 112);
          c2.fillStyle = state.config.accent; c2.fillRect(0, 0, 512, 10);
          c2.fillStyle = '#1c1a16'; c2.font = '600 40px "Noto Serif KR", serif';
          c2.fillText((it.title || '무제').slice(0, 14), 28, 62);
          c2.fillStyle = '#8a8478'; c2.font = '26px sans-serif';
          c2.fillText(`${state.config.artist} · ${state.config.year}`, 28, 94);
          const plateTex = new THREE.CanvasTexture(cv); plateTex.colorSpace = THREE.SRGBColorSpace;
          const plate = new THREE.Mesh(
            new THREE.PlaneGeometry(0.62, 0.135),
            new THREE.MeshBasicMaterial({ map: plateTex }));
          plate.position.set(0, -(FH/2 + 0.24), 0.045); grp.add(plate);
          scene.add(grp);
          const normal = new THREE.Vector3(0, 0, 1).applyEuler(grp.rotation);
          waypoints.push({
            cam: grp.position.clone().add(normal.clone().multiplyScalar(3.1)).setY(EYE),
            look: grp.position.clone(),
          });
          idx++;
        }
      }
    }
  }
  if (texCount === 0 && loadingEl) loadingEl.remove();

  /* ---------- 조작: 드래그 시점 + WASD 이동 + 충돌 ---------- */
  let walkJoyCleanup = null;
  let yaw = (typeof yaw0 !== 'undefined') ? yaw0 : 0;
  let pitch = (typeof pitch0 !== 'undefined') ? pitch0 : 0;
  let dragging = false, lx = 0, ly = 0, moved = 0;
  const keys = {};
  const el = renderer.domElement;
  const pDown = e => { dragging = true; lx = e.clientX; ly = e.clientY; moved = 0; stopTour(); };
  const pMove = e => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    yaw -= dx * 0.004; pitch = Math.max(-1.1, Math.min(1.1, pitch - dy * 0.004));
  };
  const pUp = () => dragging = false;
  el.addEventListener('pointerdown', pDown);
  window.addEventListener('pointermove', pMove);
  window.addEventListener('pointerup', pUp);
  const kDown = e => { keys[e.key.toLowerCase()] = true; stopTour();
    if (['arrowup','arrowdown',' '].includes(e.key.toLowerCase())) e.preventDefault(); };
  const kUp = e => keys[e.key.toLowerCase()] = false;
  window.addEventListener('keydown', kDown);
  window.addEventListener('keyup', kUp);

  // 모바일 가상 조이스틱
  let joyVec = null, joyEl = null;
  if ('ontouchstart' in window){
    joyEl = document.createElement('div');
    joyEl.className = 'walk-joy'; joyEl.innerHTML = '<div class="walk-joy-knob"></div>';
    g.appendChild(joyEl);
    const knob = joyEl.firstChild;
    let joyId = null, jcx = 0, jcy = 0;
    joyEl.addEventListener('touchstart', e => {
      const t = e.changedTouches[0]; joyId = t.identifier;
      const r = joyEl.getBoundingClientRect(); jcx = r.left + r.width/2; jcy = r.top + r.height/2;
      stopTour(); e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) if (t.identifier === joyId){
        let dx = (t.clientX - jcx) / 45, dy = (t.clientY - jcy) / 45;
        const l = Math.hypot(dx, dy); if (l > 1){ dx /= l; dy /= l; }
        joyVec = { x: dx, y: dy };
        knob.style.transform = `translate(${dx * 30}px,${dy * 30}px)`;
      }
    }, { passive: true });
    const joyEnd = e => {
      for (const t of e.changedTouches) if (t.identifier === joyId){
        joyId = null; joyVec = null; knob.style.transform = '';
      }
    };
    window.addEventListener('touchend', joyEnd);
    window.addEventListener('touchcancel', joyEnd);
    walkJoyCleanup = joyEnd;
  }

  const collide = p => {
    const R = 0.55;
    for (const b of colliders){
      const nx = Math.max(b.minX, Math.min(p.x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      const dx = p.x - nx, dz = p.z - nz, d2 = dx*dx + dz*dz;
      if (d2 < R * R && d2 > 1e-6){
        const d = Math.sqrt(d2);
        p.x = nx + dx / d * R; p.z = nz + dz / d * R;
      }
    }
    p.x = Math.max(-hw + 1, Math.min(hw - 1, p.x));
    p.z = Math.max(-hd + 1, Math.min(hd - 1, p.z));
  };

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const lookCard = $('#walkLook');
  const onClick = e => {
    if (moved > 10) return;
    const r = el.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(photoMeshes)[0];
    if (hit) openLightbox(hit.object.userData.itemId);
  };
  el.addEventListener('click', onClick);

  // 도슨트 투어
  const tour = { on:false, i:0, phase:'move', t:0, from:new THREE.Vector3(), fromLook:new THREE.Vector3() };
  const lookTarget = new THREE.Vector3(0, EYE, hd - 8);
  function stopTour(){ tour.on = false; const b = $('#btnTour'); if (b) b.textContent = '🎧 도슨트 투어'; }
  $('#btnTour').addEventListener('click', () => {
    if (!waypoints.length) return;
    tour.on = !tour.on;
    $('#btnTour').textContent = tour.on ? '⏸ 투어 정지' : '🎧 도슨트 투어';
    if (tour.on){
      tour.i = 0; tour.phase = 'move'; tour.t = 0;
      tour.from.copy(camera.position);
      tour.fromLook.copy(lookTarget);
    }
  });
  $('#btnWalkHelp').addEventListener('click', () =>
    toast('드래그: 둘러보기 · W A S D / 방향키: 이동 · 조이스틱(모바일): 이동 · 작품 클릭: 크게 보기'));
  $('#btnSpace').addEventListener('click', openSpaceModal);
  $('#btnEdit').addEventListener('click', openEditModal);

  const fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), cdir = new THREE.Vector3();
  let raf = 0, alive = true, last = performance.now(), frame = 0;
  const animate = now => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (tour.on && waypoints.length){
      const wp = waypoints[tour.i];
      tour.t += dt;
      if (tour.phase === 'move'){
        const k = Math.min(1, tour.t / 2.6), e2 = k * k * (3 - 2 * k);
        camera.position.lerpVectors(tour.from, wp.cam, e2);
        lookTarget.lerpVectors(tour.fromLook, wp.look, e2);
        if (k >= 1){ tour.phase = 'hold'; tour.t = 0; }
      } else if (tour.t > 2.8){
        tour.i = (tour.i + 1) % waypoints.length;
        tour.phase = 'move'; tour.t = 0;
        tour.from.copy(camera.position); tour.fromLook.copy(lookTarget);
      }
      const d = new THREE.Vector3().subVectors(lookTarget, camera.position);
      yaw = Math.atan2(-d.x, -d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    } else {
      const sp = 3.6 * dt * state.space.speed;
      fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      rgt.set(-fwd.z, 0, fwd.x);
      if (keys['w'] || keys['arrowup']) camera.position.addScaledVector(fwd, sp);
      if (keys['s'] || keys['arrowdown']) camera.position.addScaledVector(fwd, -sp);
      if (keys['a'] || keys['arrowleft']) camera.position.addScaledVector(rgt, -sp);
      if (keys['d'] || keys['arrowright']) camera.position.addScaledVector(rgt, sp);
      if (joyVec){
        camera.position.addScaledVector(fwd, -joyVec.y * sp).addScaledVector(rgt, joyVec.x * sp);
      }
      collide(camera.position);
      camera.position.y = EYE;
      lookTarget.copy(camera.position).add(new THREE.Vector3(
        -Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)));
    }
    camera.lookAt(lookTarget);
    walkView.x = camera.position.x; walkView.z = camera.position.z;
    walkView.yaw = yaw; walkView.pitch = pitch; walkView.valid = true;
    // 바라보는 작품 정보 카드
    if (lookCard && !tour.on && (++frame % 12 === 0)){
      camera.getWorldDirection(cdir);
      ray.set(camera.position, cdir);
      ray.far = 11;
      const hit = ray.intersectObjects(photoMeshes)[0];
      if (hit){
        const it = items[hit.object.userData.index];
        lookCard.hidden = false;
        lookCard.innerHTML = `<b>No.${hit.object.userData.index + 1} ${esc(it.title)}</b><span>${esc(state.config.artist)} · ${esc(state.config.year)}${it.type === 'video' ? ' · 영상' : ''}</span>`;
      } else lookCard.hidden = true;
    } else if (lookCard && tour.on) lookCard.hidden = true;
    ambienceUpdate(camera, yaw, pitch);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  };
  animate(last);

  const onResize = () => {
    const w = g.clientWidth, h = Math.max(480, Math.min(760, Math.round(w * 0.5)));
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  walkCleanup = () => {
    alive = false; cancelAnimationFrame(raf);
    if (amb.ctx) amb.ctx.suspend().catch(() => {});
    el.removeEventListener('pointerdown', pDown);
    window.removeEventListener('pointermove', pMove);
    window.removeEventListener('pointerup', pUp);
    window.removeEventListener('keydown', kDown);
    window.removeEventListener('keyup', kUp);
    window.removeEventListener('resize', onResize);
    el.removeEventListener('click', onClick);
    if (walkJoyCleanup){ window.removeEventListener('touchend', walkJoyCleanup); window.removeEventListener('touchcancel', walkJoyCleanup); walkJoyCleanup = null; }
    if (joyEl && joyEl.parentNode) joyEl.parentNode.removeChild(joyEl);
    scene.traverse(o => {
      if (o.geometry && ![wallGeo, frameGeo, photoGeo, stripGeo, glowGeo].includes(o.geometry)) o.geometry.dispose();
      if (o.material){ [].concat(o.material).forEach(m => { m.map?.dispose?.(); if (![frameMat, wallMat, stripMat].includes(m)) m.dispose(); }); }
    });
    [wallGeo, frameGeo, photoGeo, stripGeo, glowGeo].forEach(x => x.dispose());
    renderer.dispose();
    if (el.parentNode) el.parentNode.removeChild(el);
  };
}


/* ---------- 라이트박스 ---------- */
const lb = { list: [], idx: 0 };
function openLightbox(id){
  lb.list = state.items;
  lb.idx = Math.max(0, lb.list.findIndex(i => i.id === id));
  renderLb();
  $('#lightbox').hidden = false;
  document.body.style.overflow = 'hidden';
}
function renderLb(){
  const it = lb.list[lb.idx];
  if (!it){ closeLightbox(); return; }
  $('#lbMedia').innerHTML = it.type === 'image'
    ? `<img src="${esc(it.url)}" alt="${esc(it.title)}">`
    : `<video src="${esc(it.url)}" controls autoplay playsinline></video>`;
  $('#lbTitle').textContent = it.title;
  $('#lbTitle').dataset.id = it.id;
  $('#lbMeta').textContent = `${metaLine()} · No.${num2(lb.idx+1)}${it.type==='video'?' · 영상':''}`;
  $('#lbDesc').textContent = it.desc || '';
  $('#lbDesc').dataset.id = it.id;
}
function closeLightbox(){
  $('#lightbox').hidden = true; $('#lbMedia').innerHTML = '';
  document.body.style.overflow = '';
}
function lbNav(d){
  if (!lb.list.length) return;
  lb.idx = (lb.idx + d + lb.list.length) % lb.list.length;
  renderLb();
}

/* ---------- 프로젝터 ---------- */
function openProjector(){
  pj.list = state.items;
  if (!pj.list.length){ toast('상영할 사진이 없어요'); return; }
  pj.idx = 0;
  $('#projector').hidden = false;
  document.body.style.overflow = 'hidden';
  playPjItem();
}
function playPjItem(){
  clearTimeout(pj.timer);
  const it = pj.list[pj.idx];
  const st = $('#pjStage');
  st.querySelectorAll('img,video').forEach(n => n.remove());
  if (it.type === 'image'){
    const img = document.createElement('img');
    img.src = it.url; img.alt = it.title;
    st.appendChild(img);
    pj.timer = setTimeout(() => pjNav(1), 5200);
  } else {
    const v = document.createElement('video');
    v.src = it.url; v.controls = true; v.autoplay = true;
    v.style.cssText = 'max-width:92vw;max-height:78vh';
    v.onended = () => pjNav(1);
    st.appendChild(v);
  }
  $('#pjTitle').textContent = it.title;
  $('#pjMeta').textContent = `${metaLine()} · No.${num2(pj.idx+1)}`;
  $('#pjCount').textContent = `${pj.idx+1} / ${pj.list.length}`;
}
function pjNav(d){
  if (!pj.list.length) return;
  pj.idx = (pj.idx + d + pj.list.length) % pj.list.length;
  playPjItem();
}
function closeProjector(){
  clearTimeout(pj.timer);
  $('#projector').hidden = true;
  $('#pjStage').querySelectorAll('img,video').forEach(n => n.remove());
  document.body.style.overflow = '';
}

/* ---------- 링크로 가져오기 (구글 드라이브 공유 링크·직접 링크) ---------- */
function driveId(url){
  const m = url.match(/\/file\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : null;
}
function linkToItem(url){
  url = (url || '').trim();
  if (!url) return null;
  const id = driveId(url);
  if (id) return { url: `https://drive.google.com/thumbnail?id=${id}&sz=w1920`, name: 'drive-photo.jpg', type: 'image' };
  const clean = url.split('?')[0].split('#')[0];
  const name = (() => { try { return decodeURIComponent(clean.split('/').pop()) || 'link'; } catch(e){ return 'link'; } })();
  if (/\.(jpe?g|png|webp|gif|bmp)$/i.test(clean)) return { url, name, type: 'image' };
  if (/\.(mp4|webm|mov|m4v)$/i.test(clean)) return { url, name, type: 'video' };
  return null;
}
function addLinkItems(text){
  const lines = String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
  let n = 0, bad = 0;
  for (const line of lines){
    const m = linkToItem(line);
    if (!m){ bad++; continue; }
    state.items.push({
      id: 'w' + (++state.seq),
      name: m.name,
      title: m.name === 'drive-photo.jpg' ? '드라이브 사진' : prettyTitle(m.name),
      desc: '', url: m.url, type: m.type, source: 'link',
    });
    n++;
  }
  return { n, bad };
}

/* ---------- 드라이브 폴더 통째로 가져오기 ---------- */
const getDriveKey = () => (localStorage.getItem('ex_drivekey_' + slug(state.config.title)) || '').trim();
function driveFolderId(url){
  const m = String(url || '').match(/\/folders\/([\w-]+)/) || String(url || '').match(/[?&]id=([\w-]+)/);
  return m ? m[1] : null;
}
async function listDriveChildren(fid, key){
  const q = encodeURIComponent(`'${fid}' in parents and trashed=false`);
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=100&orderBy=name&key=${encodeURIComponent(key)}`);
  if (r.status === 400 || r.status === 403) throw new Error('key');
  if (!r.ok) throw new Error('api');
  return (await r.json()).files || [];
}
async function importDriveFolder(){
  const folderUrl = $('#driveFolderInput').value.trim();
  const keyInput = $('#driveKeyInput').value.trim();
  const key = keyInput || getDriveKey();
  const fid = driveFolderId(folderUrl);
  if (!fid){ toast('드라이브 폴더 링크를 입력해 주세요'); return; }
  if (!key){ toast('Drive API 키를 입력해 주세요 (위 안내 참고)'); return; }
  toast('폴더를 읽는 중…');
  try{
    const media = [];
    async function walk(id, depth, path){
      if (depth > 2 || media.length >= 500) return;
      const children = await listDriveChildren(id, key);
      for (const f of children){
        if (/^(image|video)\//.test(f.mimeType || '')) media.push({ ...f, path });
        else if (f.mimeType === 'application/vnd.google-apps.folder' && depth < 2)
          await walk(f.id, depth + 1, f.name);
      }
    }
    await walk(fid, 0, '');
    if (!media.length){ toast('폴더에 사진·영상이 없어요. 폴더 공유 설정을 확인해 주세요'); return; }
    localStorage.setItem('ex_drivekey_' + slug(state.config.title), key);
    const swapped = swapOutDemo();
    for (const f of media){
      const isVideo = (f.mimeType || '').startsWith('video');
      const title = f.path ? `${f.path} — ${prettyTitle(f.name)}` : prettyTitle(f.name);
      state.items.push({
        id: 'w' + (++state.seq),
        name: f.name, title, desc: '',
        url: isVideo
          ? `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${encodeURIComponent(key)}`
          : `https://drive.google.com/thumbnail?id=${f.id}&sz=w1920`,
        type: isVideo ? 'video' : 'image', source: 'drive',
      });
    }
    $('#driveFolderInput').value = '';
    $('#linkModal').hidden = true;
    renderAll();
    toast(`${media.length}점을 가져왔어요${swapped ? ` · 데모 ${swapped}점을 교체했어요` : ''}`);
    setTimeout(() => $('#gallery')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }catch(e){
    toast(e.message === 'key'
      ? 'API 키가 올바르지 않아요. 키를 확인해 주세요'
      : '폴더를 읽지 못했어요. 폴더가 "링크가 있는 모든 사용자"로 공유되어 있는지 확인해 주세요');
  }
}

/* ---------- AI 자동 설명 (Gemini BYOK) ---------- */
const getAiKey = () => (localStorage.getItem('ex_aikey_' + slug(state.config.title)) || '').trim();
function blobToB64(blob){
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] || '');
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}
async function autoDescribeCurrent(){
  const it = lb.list[lb.idx];
  if (!it){ toast('설명할 사진을 먼저 열어주세요'); return; }
  if (it.type !== 'image'){ toast('사진에만 자동 설명을 쓸 수 있어요'); return; }
  let key = getAiKey();
  if (!key){
    $('#aiKeyInput').value = '';
    $('#aiModal').hidden = false;
    toast('먼저 Gemini API 키를 등록해 주세요 (무료)');
    return;
  }
  toast('AI가 제목과 설명을 짓는 중…');
  try{
    const blob = await (await fetch(it.url)).blob();
    const b64 = await blobToB64(blob);
    if (!b64) throw new Error('img');
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [
          { text: '이 사진에 어울리는 전시 작품 제목(15자 이내 한국어)과 2문장 이내의 작품 설명을 지어줘. 반드시 아래 JSON 형식으로만 답해, 다른 말은 하지 마: {"title":"...","desc":"..."}' },
          { inline_data: { mime_type: blob.type || 'image/jpeg', data: b64 } },
        ]}]}) });
    if (!r.ok) throw new Error('api');
    const j = await r.json();
    const txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('parse');
    const d = JSON.parse(m[0]);
    if (d.title) it.title = String(d.title).slice(0, 30);
    if (d.desc) it.desc = String(d.desc).slice(0, 500);
    saveItems(); renderLb();
    toast('자동 설명을 넣었어요 — 클릭해서 직접 고칠 수 있어요');
  }catch(e){
    toast(e.message === 'img'
      ? '이 사진은 AI가 읽을 수 없어요 (외부 링크는 직접 설명을 입력해주세요)'
      : '자동 설명에 실패했어요. API 키를 확인해 주세요');
  }
}

/* ---------- 드래그앤드롭 ---------- */
function setupDrop(){
  let depth = 0;
  const show = on => document.body.style.outline = on ? '2px dashed var(--accent)' : '';
  window.addEventListener('dragenter', e => { e.preventDefault(); depth++; show(true); document.body.style.outlineOffset = '-10px'; });
  window.addEventListener('dragleave', e => { e.preventDefault(); if (--depth <= 0){ depth = 0; show(false); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault(); depth = 0; show(false);
    const files = [...(e.dataTransfer?.files || [])];
    const swapped = swapOutDemo();
    const n = addItems(files);
    if (n){ renderAll(); toast(`${n}점을 전시실에 걸었어요${swapped ? ` · 데모 ${swapped}점을 교체했어요` : ''}`); }
    else if (files.length) toast('사진·영상 파일이 없어요');
  });
}

/* ---------- 초기화 ---------- */
function init(){
  loadConfig().then(() => {
    loadItems();
    // 전시 제목 인라인 편집
    const h1 = $('#exTitle');
    h1.addEventListener('blur', () =>
      localStorage.setItem('ex_title_' + slug(state.config.title), h1.textContent.trim()));
    h1.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); h1.blur(); } });
    renderAll();
  });

  $('#btnFolder').addEventListener('click', () => $('#folderInput').click());
  $('#btnEmptyFolder').addEventListener('click', () => $('#folderInput').click());
  $('#btnFiles').addEventListener('click', () => $('#fileInput').click());
  $('#folderInput').addEventListener('change', onFilesChosen);
  $('#fileInput').addEventListener('change', onFilesChosen);
  $('#btnDemo').addEventListener('click', loadDemo);
  $('#btnEmptyDemo').addEventListener('click', loadDemo);

  $('#btnLink').addEventListener('click', () => {
    $('#driveKeyInput').value = getDriveKey();
    $('#linkModal').hidden = false;
  });
  $('#btnLinkClose').addEventListener('click', () => $('#linkModal').hidden = true);
  $('#linkModal').addEventListener('click', e => { if (e.target.id === 'linkModal') e.target.hidden = true; });
  $('#btnLinkAdd').addEventListener('click', () => {
    const raw = $('#linkInput').value;
    if (/\/drive\/folders\//.test(raw)){
      toast('폴더 링크는 아래 "📁 드라이브 폴더 통째로"에서 가져와 주세요');
      return;
    }
    const swapped = swapOutDemo();
    const { n, bad } = addLinkItems(raw);
    $('#linkInput').value = '';
    $('#linkModal').hidden = true;
    if (n){ renderAll(); toast(`${n}점을 가져왔어요${bad ? ` (${bad}개 인식 실패)` : ''}${swapped ? ` · 데모 ${swapped}점을 교체했어요` : ''}`); }
    else toast('가져올 수 있는 링크가 없어요');
  });
  $('#btnFolderAdd').addEventListener('click', importDriveFolder);

  $('#btnCriteria').addEventListener('click', openCriteriaModal);
  $('#btnCritClose').addEventListener('click', () => $('#criteriaModal').hidden = true);
  $('#criteriaModal').addEventListener('click', e => { if (e.target.id === 'criteriaModal') e.target.hidden = true; });
  $('#btnCritSave').addEventListener('click', saveCriteria);

  $('#btnSpaceClose').addEventListener('click', () => $('#spaceModal').hidden = true);
  $('#spaceModal').addEventListener('click', e => { if (e.target.id === 'spaceModal') e.target.hidden = true; });
  $('#setLight').addEventListener('input', e => {
    state.space.light = e.target.value / 100;
    $('#setLightV').textContent = e.target.value + '%';
  });
  $('#setLight').addEventListener('change', () => { saveSpace(); renderGallery(); });
  $('#setSpeed').addEventListener('input', e => {
    state.space.speed = e.target.value / 100;
    $('#setSpeedV').textContent = e.target.value + '%';
    saveSpace();
  });
  $('#setAmbToggle').addEventListener('click', () => { ambienceSet(!amb.on); syncAmbUI(); });
  $('#setAmbVol').addEventListener('input', e => {
    amb.vol = +e.target.value;
    $('#setAmbVolV').textContent = amb.vol + '%';
    ambienceApplyVol(); saveSpace();
  });
  $('#setChimeToggle').addEventListener('click', () => {
    amb.chime = !amb.chime; syncAmbUI(); saveSpace();
    toast(amb.chime ? '공간 차임을 켰어요' : '공간 차임을 껐어요');
  });
  $('#btnEditClose').addEventListener('click', closeEditModal);
  $('#editModal').addEventListener('click', e => { if (e.target.id === 'editModal') closeEditModal(); });
  $('#editSearch').addEventListener('input', e => renderEditList(e.target.value));

  $('#btnAi').addEventListener('click', () => {
    $('#aiKeyInput').value = getAiKey();
    $('#aiModal').hidden = false;
  });
  $('#btnAiClose').addEventListener('click', () => $('#aiModal').hidden = true);
  $('#aiModal').addEventListener('click', e => { if (e.target.id === 'aiModal') e.target.hidden = true; });
  $('#btnAiSave').addEventListener('click', () => {
    localStorage.setItem('ex_aikey_' + slug(state.config.title), $('#aiKeyInput').value.trim());
    $('#aiModal').hidden = true;
    toast($('#aiKeyInput').value.trim() ? 'AI 설명 키를 저장했어요' : 'AI 설명 키를 지웠어요');
  });
  $('#lbAiDesc').addEventListener('click', autoDescribeCurrent);


  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbPrev').addEventListener('click', () => lbNav(-1));
  $('#lbNext').addEventListener('click', () => lbNav(1));
  $('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });
  // 라이트박스 인라인 편집
  ['lbTitle','lbDesc'].forEach(id => {
    const n = document.getElementById(id);
    n.contentEditable = 'true'; n.spellcheck = false;
    n.addEventListener('click', e => e.stopPropagation());
    n.addEventListener('blur', () => {
      const it = state.items.find(x => x.id === n.dataset.id);
      if (it){ it[id === 'lbTitle' ? 'title' : 'desc'] = n.textContent.trim(); saveItems(); }
    });
    n.addEventListener('keydown', e => { if (e.key === 'Enter' && id === 'lbTitle'){ e.preventDefault(); n.blur(); } });
  });

  $('#pjPrev').addEventListener('click', () => pjNav(-1));
  $('#pjNext').addEventListener('click', () => pjNav(1));
  $('#pjClose').addEventListener('click', closeProjector);

  document.addEventListener('keydown', e => {
    if (!$('#lightbox').hidden){
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lbNav(-1);
      if (e.key === 'ArrowRight') lbNav(1);
    }
    if (!$('#projector').hidden){
      if (e.key === 'Escape') closeProjector();
      if (e.key === 'ArrowLeft') pjNav(-1);
      if (e.key === 'ArrowRight') pjNav(1);
    }
  });

  setupDrop();
  renderAll();
}
document.addEventListener('DOMContentLoaded', init);
