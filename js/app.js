/* 사진전시관 — 다섯 개의 방 */
'use strict';

const IMG_EXT = ['jpg','jpeg','png','webp','gif','bmp'];
const VID_EXT = ['mp4','webm','mov','m4v'];

const state = {
  config: { title:'사진전시관', subtitle:'다섯 개의 방에 거는 사진들', accent:'#c9a227', accent2:'#e8c874', artist:'MetaSongi', year:'2026' },
  criteria: { min: 4, max: 24 },
  items: [],
  style: 'whitecube',
  seq: 0,
};
let walkCleanup = null;
let carCleanup = null;
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
  const n = addItems(files);
  e.target.value = '';
  if (n){ renderAll(); toast(`${n}점을 전시실에 걸었어요`); }
  else toast('사진·영상 파일이 없어요');
}

/* ---------- 갤러리 ---------- */
function renderAll(){ renderGallery(); renderCriteriaBar(); }
function renderGallery(){
  if (walkCleanup){ walkCleanup(); walkCleanup = null; }
  if (carCleanup){ carCleanup(); carCleanup = null; }
  document.body.classList.toggle('dark', state.style === 'darkroom');
  const g = $('#gallery');
  const items = state.items;
  $('#emptyState').style.display = items.length ? 'none' : 'block';
  g.style.display = items.length ? '' : 'none';
  if (!items.length) return;

  if (state.style === 'projector'){
    setActiveNav('whitecube'); state.style = 'whitecube';
    openProjector(); renderGallery(); return;
  }
  g.className = 'gallery fade g-' + state.style;
  ({
    whitecube: renderWhiteCube, darkroom: renderDarkroom, walkthrough: renderWalkthrough,
    magazine: renderMagazine, bento: renderBento, hscroll: renderHScroll,
    marquee: renderMarquee, carousel: renderCarousel, polaroid: renderPolaroid,
  })[state.style](g, items);
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
  const list = items.slice(0, 24);
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
  else if (n > max){ cls = 'warn'; html = `⚠️ 최대 ${max}장을 초과했어요 — 현재 ${n}장 <button class="btn sm" id="btnTrim">앞 ${max}장만 남기기</button>`; }
  bar.className = 'criteria ' + cls;
  bar.innerHTML = html;
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
      if (it) it[el.dataset.f] = el.textContent.trim();
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); el.blur(); } });
  });
}

/* ---------- 3D 전시관 워크스루 ---------- */
function renderWalkthrough(g, items){
  if (typeof THREE === 'undefined'){ toast('3D 라이브러리를 불러오지 못했어요'); return; }
  g.innerHTML = `
    <div class="walk-ui">
      <button class="btn" id="btnTour">🎧 도슨트 투어</button>
      <button class="btn" id="btnWalkHelp">❔ 조작법</button>
    </div>
    <div class="walk-hint">드래그: 시점 회전 · W A S D: 이동 · 작품 클릭: 크게 보기</div>`;
  const W = g.clientWidth, H = 620;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0e10);
  scene.fog = new THREE.Fog(0x0e0e10, 14, 34);
  const camera = new THREE.PerspectiveCamera(68, W/H, 0.1, 100);
  const EYE = 1.65;
  camera.position.set(0, EYE, 5.5);
  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  g.insertBefore(renderer.domElement, g.firstChild);

  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x2a2a30, 0.85));
  const ROOM = { w: 26, d: 18, h: 4.4 };
  const hw = ROOM.w/2, hd = ROOM.d/2;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.w, ROOM.d),
    new THREE.MeshStandardMaterial({ color: 0x8a6f52, roughness: .9 }));
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.w, ROOM.d),
    new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 1 }));
  ceil.rotation.x = Math.PI/2; ceil.position.y = ROOM.h; scene.add(ceil);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xece5d8, roughness: .95 });
  const mkWall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m);
  };
  mkWall(ROOM.w, ROOM.h, 0, ROOM.h/2, -hd, 0);
  mkWall(ROOM.w, ROOM.h, 0, ROOM.h/2,  hd, Math.PI);
  mkWall(ROOM.d, ROOM.h, -hw, ROOM.h/2, 0, Math.PI/2);
  mkWall(ROOM.d, ROOM.h,  hw, ROOM.h/2, 0, -Math.PI/2);
  // 천장 조명
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++){
    const pl = new THREE.PointLight(0xffe2b0, 0.55, 26);
    pl.position.set(i*8, ROOM.h-0.4, j*5.4); scene.add(pl);
  }

  // 작품 배치
  const loader = new THREE.TextureLoader();
  const photoMeshes = [];
  const FW = 1.9, FH = 1.2, ART_Y = 1.75;
  const walls = [
    { len: ROOM.w, fixed: -hd+0.06, axis: 'z', dir: 1 },   // 북
    { len: ROOM.w, fixed:  hd-0.06, axis: 'z', dir: -1 },  // 남
    { len: ROOM.d, fixed: -hw+0.06, axis: 'x', dir: 1 },   // 서
    { len: ROOM.d, fixed:  hw-0.06, axis: 'x', dir: -1 },  // 동
  ];
  const list = items.slice(0, 32);
  const perWall = Math.ceil(list.length / 4);
  const waypoints = [];
  list.forEach((it, i) => {
    const wI = Math.floor(i / perWall), k = i % perWall;
    const wall = walls[wI];
    const nThis = Math.min(perWall, list.length - wI*perWall);
    const t = nThis === 1 ? 0 : (k/(nThis-1) - 0.5);
    const along = t * (wall.len - 5);
    const pos = new THREE.Vector3();
    let ry = 0;
    if (wall.axis === 'z'){ pos.set(along, ART_Y, wall.fixed); ry = wall.dir > 0 ? 0 : Math.PI; }
    else { pos.set(wall.fixed, ART_Y, along); ry = wall.dir > 0 ? Math.PI/2 : -Math.PI/2; }

    const grp = new THREE.Group(); grp.position.copy(pos); grp.rotation.y = ry;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(FW+0.16, FH+0.16, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x161616, roughness: .6 }));
    frame.castShadow = true; grp.add(frame);
    const mat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), mat);
    photo.position.z = 0.045; photo.userData.itemId = it.id;
    grp.add(photo); photoMeshes.push(photo);
    if (it.type === 'image'){
      loader.load(it.url, tex => {
        const ia = tex.image.width / tex.image.height, fa = FW/FH;
        if (ia > fa){ tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = fa/ia; tex.offset.x = (1-tex.repeat.x)/2; }
        else { tex.wrapT = THREE.RepeatWrapping; tex.repeat.y = ia/fa; tex.offset.y = (1-tex.repeat.y)/2; }
        mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
      });
    } else {
      const v = document.createElement('video');
      v.src = it.url; v.muted = true; v.loop = true; v.playsInline = true;
      v.play().catch(()=>{});
      const vt = new THREE.VideoTexture(v); vt.minFilter = THREE.LinearFilter;
      mat.map = vt; mat.color.set(0xffffff);
      it._wv = v;
    }
    // 캡션 플레이트
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 112;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#f5f2ea'; cx.fillRect(0,0,512,112);
    cx.fillStyle = state.config.accent; cx.fillRect(0,0,512,10);
    cx.fillStyle = '#1c1a16'; cx.font = '600 40px "Noto Serif KR", serif';
    cx.fillText((it.title||'무제').slice(0,14), 28, 62);
    cx.fillStyle = '#8a8478'; cx.font = '26px sans-serif';
    cx.fillText(`${state.config.artist} · ${state.config.year}`, 28, 94);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.135),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
    plate.position.set(0, -(FH/2+0.24), 0.045); grp.add(plate);
    scene.add(grp);

    const normal = new THREE.Vector3(0,0,1).applyEuler(grp.rotation);
    waypoints.push({
      cam: pos.clone().add(normal.clone().multiplyScalar(3.1)).setY(EYE),
      look: pos.clone(),
    });
  });

  // 조작: 드래그 시점 + WASD 이동
  let yaw = Math.PI, pitch = 0; // 북쪽 벽을 바라보게
  let dragging = false, lx = 0, ly = 0, moved = 0;
  const keys = {};
  const el = renderer.domElement;
  const pDown = e => { dragging = true; lx = e.clientX; ly = e.clientY; moved = 0; stopTour(); };
  const pMove = e => {
    if (!dragging) return;
    const dx = e.clientX-lx, dy = e.clientY-ly; lx = e.clientX; ly = e.clientY;
    moved += Math.abs(dx)+Math.abs(dy);
    yaw -= dx*0.004; pitch = Math.max(-1.1, Math.min(1.1, pitch - dy*0.004));
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

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const onClick = e => {
    if (moved > 10) return;
    const r = el.getBoundingClientRect();
    ptr.x = ((e.clientX-r.left)/r.width)*2-1;
    ptr.y = -((e.clientY-r.top)/r.height)*2+1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(photoMeshes)[0];
    if (hit) openLightbox(hit.object.userData.itemId);
  };
  el.addEventListener('click', onClick);

  // 도슨트 투어
  const tour = { on:false, i:0, phase:'move', t:0, from:new THREE.Vector3(), fromLook:new THREE.Vector3() };
  const lookTarget = new THREE.Vector3(0, EYE, -hd);
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
    toast('드래그: 둘러보기 · W A S D / 방향키: 이동 · 작품 클릭: 크게 보기'));

  const fwd = new THREE.Vector3(), rgt = new THREE.Vector3();
  let raf = 0, alive = true, last = performance.now();
  const animate = now => {
    if (!alive) return;
    const dt = Math.min(0.05, (now-last)/1000); last = now;
    if (tour.on && waypoints.length){
      const wp = waypoints[tour.i];
      tour.t += dt;
      if (tour.phase === 'move'){
        const k = Math.min(1, tour.t/2.4), e = k*k*(3-2*k);
        camera.position.lerpVectors(tour.from, wp.cam, e);
        lookTarget.lerpVectors(tour.fromLook, wp.look, e);
        if (k >= 1){ tour.phase = 'hold'; tour.t = 0; }
      } else {
        if (tour.t > 2.6){
          tour.i = (tour.i+1) % waypoints.length;
          tour.phase = 'move'; tour.t = 0;
          tour.from.copy(camera.position); tour.fromLook.copy(lookTarget);
        }
      }
      const d = new THREE.Vector3().subVectors(lookTarget, camera.position);
      yaw = Math.atan2(-d.x, -d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    } else {
      const sp = 3.4 * dt;
      fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      rgt.set(-fwd.z, 0, fwd.x);
      if (keys['w'] || keys['arrowup']) camera.position.addScaledVector(fwd, sp);
      if (keys['s'] || keys['arrowdown']) camera.position.addScaledVector(fwd, -sp);
      if (keys['a'] || keys['arrowleft']) camera.position.addScaledVector(rgt, -sp);
      if (keys['d'] || keys['arrowright']) camera.position.addScaledVector(rgt, sp);
      camera.position.x = Math.max(-hw+0.8, Math.min(hw-0.8, camera.position.x));
      camera.position.z = Math.max(-hd+0.8, Math.min(hd-0.8, camera.position.z));
      camera.position.y = EYE;
      lookTarget.copy(camera.position).add(new THREE.Vector3(
        -Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw)*Math.cos(pitch)));
    }
    camera.lookAt(lookTarget);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  };
  animate(last);

  const onResize = () => {
    const w = g.clientWidth, h = 620;
    camera.aspect = w/h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  walkCleanup = () => {
    alive = false; cancelAnimationFrame(raf);
    el.removeEventListener('pointerdown', pDown);
    window.removeEventListener('pointermove', pMove);
    window.removeEventListener('pointerup', pUp);
    window.removeEventListener('keydown', kDown);
    window.removeEventListener('keyup', kUp);
    window.removeEventListener('resize', onResize);
    el.removeEventListener('click', onClick);
    list.forEach(it => { if (it._wv){ it._wv.pause(); it._wv.src=''; delete it._wv; } });
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material){ [].concat(o.material).forEach(m => { m.map?.dispose?.(); m.dispose(); }); }
    });
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
    const n = addItems(files);
    if (n){ renderAll(); toast(`${n}점을 전시실에 걸었어요`); }
    else if (files.length) toast('사진·영상 파일이 없어요');
  });
}

/* ---------- 초기화 ---------- */
function init(){
  loadConfig().then(() => {
    // 전시 제목 인라인 편집
    const h1 = $('#exTitle');
    h1.addEventListener('blur', () =>
      localStorage.setItem('ex_title_' + slug(state.config.title), h1.textContent.trim()));
    h1.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); h1.blur(); } });
  });

  $('#btnFolder').addEventListener('click', () => $('#folderInput').click());
  $('#btnEmptyFolder').addEventListener('click', () => $('#folderInput').click());
  $('#btnFiles').addEventListener('click', () => $('#fileInput').click());
  $('#folderInput').addEventListener('change', onFilesChosen);
  $('#fileInput').addEventListener('change', onFilesChosen);
  $('#btnDemo').addEventListener('click', loadDemo);
  $('#btnEmptyDemo').addEventListener('click', loadDemo);

  $('#btnLink').addEventListener('click', () => { $('#linkModal').hidden = false; });
  $('#btnLinkClose').addEventListener('click', () => $('#linkModal').hidden = true);
  $('#linkModal').addEventListener('click', e => { if (e.target.id === 'linkModal') e.target.hidden = true; });
  $('#btnLinkAdd').addEventListener('click', () => {
    const { n, bad } = addLinkItems($('#linkInput').value);
    $('#linkInput').value = '';
    $('#linkModal').hidden = true;
    if (n){ renderAll(); toast(`${n}점을 가져왔어요${bad ? ` (${bad}개 인식 실패)` : ''}`); }
    else toast('가져올 수 있는 링크가 없어요');
  });

  $('#btnCriteria').addEventListener('click', openCriteriaModal);
  $('#btnCritClose').addEventListener('click', () => $('#criteriaModal').hidden = true);
  $('#criteriaModal').addEventListener('click', e => { if (e.target.id === 'criteriaModal') e.target.hidden = true; });
  $('#btnCritSave').addEventListener('click', saveCriteria);

  $('#styleSwitch').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    setActiveNav(b.dataset.style);
    state.style = b.dataset.style;
    renderGallery();
    $('#gallery').scrollIntoView({ behavior:'smooth', block:'start' });
  }));

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
      if (it) it[id === 'lbTitle' ? 'title' : 'desc'] = n.textContent.trim();
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
