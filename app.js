// ── Configuración ──────────────────────────────────────────
const LABELS = ['Fabritech', 'Mayorista', 'Boston', 'Distribuidor', 'Saracell'];
const FIELDS = ['ARS_FAB', 'ARS_MAY', 'ARS_BOS', 'ARS_DIST', 'ARS_SARA'];
const PIN       = '2210';
const AUTH_KEY  = 'modulos_auth';
const DATA_KEY  = 'modulos_data';
const AUTH_DAYS = 30;

// ── Auth ───────────────────────────────────────────────────
let pinBuffer = '';

function checkAuth() {
  const stored = localStorage.getItem(AUTH_KEY);
  if (stored) {
    const days = (Date.now() - parseInt(stored)) / 86400000;
    if (days < AUTH_DAYS) { showApp(); return; }
  }
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').classList.add('app-hidden');
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.remove('app-hidden');
  loadData();
  initNav();
  initStock();
}

function initPinPad() {
  document.querySelectorAll('.pin-btn[data-n]').forEach(btn => {
    btn.addEventListener('click', () => addPin(btn.dataset.n));
  });
  document.getElementById('pin-back').addEventListener('click', backPin);
  document.getElementById('pin-clear').addEventListener('click', clearPin);

  // Teclado físico
  document.addEventListener('keydown', e => {
    const ls = document.getElementById('login-screen');
    if (ls.style.display === 'none') return;
    if (e.key >= '0' && e.key <= '9') addPin(e.key);
    else if (e.key === 'Backspace') backPin();
    else if (e.key === 'Escape') clearPin();
  });
}

function addPin(digit) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += digit;
  updatePinDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 180);
}

function backPin() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
}

function clearPin() {
  pinBuffer = '';
  updatePinDots();
}

function updatePinDots() {
  document.querySelectorAll('#pin-dots span').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinBuffer.length);
  });
}

function checkPin() {
  if (pinBuffer === PIN) {
    localStorage.setItem(AUTH_KEY, Date.now().toString());
    const card = document.getElementById('login-screen');
    card.classList.add('success');
    setTimeout(showApp, 650);
  } else {
    document.getElementById('pin-error').textContent = 'PIN incorrecto. Intentá de nuevo.';
    document.getElementById('login-screen').classList.add('shake');
    setTimeout(() => {
      document.getElementById('login-screen').classList.remove('shake');
      document.getElementById('pin-error').textContent = '';
      clearPin();
    }, 650);
  }
}

// ── Carga de datos ─────────────────────────────────────────
let DATA = [];

async function loadData() {
  // Intentar desde localStorage primero
  const cached = localStorage.getItem(DATA_KEY);
  if (cached) {
    try { DATA = JSON.parse(cached); initApp(); return; } catch (e) {}
  }
  // Fallback a data.json
  try {
    const res = await fetch('data.json');
    DATA = await res.json();
    initApp();
  } catch (err) {
    console.error('Error cargando datos:', err);
    document.getElementById('count').textContent = 'Error al cargar datos';
  }
}

// ── Inicialización ─────────────────────────────────────────
function initApp() {
  const marcas = [...new Set(DATA.map(d => d.MARCA))].sort();
  const sel = document.getElementById('f-marca');
  while (sel.options.length > 1) sel.remove(1);
  marcas.forEach(m => {
    const o = document.createElement('option');
    o.value = m; o.textContent = m;
    sel.appendChild(o);
  });

  document.getElementById('search').addEventListener('input', scheduleRender);
  document.getElementById('f-marca').addEventListener('change', scheduleRender);
  document.getElementById('f-fuente').addEventListener('change', scheduleRender);
  document.getElementById('f-best').addEventListener('change', scheduleRender);

  initPWA();
  initAdmin();
  initDetail();
  render();
}

// ── Helpers ────────────────────────────────────────────────
function fmt(v) {
  return v ? '$' + v.toLocaleString('es-AR') : '';
}

function bestIdx(row) {
  let b = -1, bv = Infinity;
  FIELDS.forEach((f, i) => {
    const v = row[f];
    if (v && v < bv) { bv = v; b = i; }
  });
  return b;
}

// ── Render ─────────────────────────────────────────────────
let renderTimer;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 60);
}

function render() {
  const q       = document.getElementById('search').value.trim().toLowerCase();
  const fMarca  = document.getElementById('f-marca').value;
  const fFuente = document.getElementById('f-fuente').value;
  const fBest   = document.getElementById('f-best').value;
  const fi      = fFuente !== '' ? parseInt(fFuente) : -1;
  const bi      = fBest   !== '' ? parseInt(fBest)   : -1;
  const words   = q ? q.split(/\s+/).filter(Boolean) : [];

  const filtered = DATA.filter(r => {
    if (fMarca && r.MARCA !== fMarca) return false;
    if (fi >= 0 && !r[FIELDS[fi]]) return false;
    if (bi >= 0 && bestIdx(r) !== bi) return false;
    if (words.length) {
      const hay = (r.MARCA + ' ' + r.MODELO + ' ' + (r.VARIANTE || '')).toLowerCase();
      return words.every(w => hay.includes(w));
    }
    return true;
  });

  document.getElementById('count').textContent =
    filtered.length.toLocaleString('es-AR') + ' variante' + (filtered.length !== 1 ? 's' : '');

  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('empty');
  const thead = document.querySelector('#tbl thead');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
    thead.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  thead.style.display = '';

  let prevMarca = '', prevModelo = '', zebra = 0;
  const rows = [];

  filtered.forEach(r => {
    if (r.MARCA !== prevMarca) {
      rows.push(`<tr class="sep"><td colspan="9">▌ ${r.MARCA}</td></tr>`);
      prevMarca = r.MARCA; prevModelo = ''; zebra = 0;
    }
    if (r.MODELO !== prevModelo) {
      rows.push(`<tr class="grp"><td></td><td colspan="8"> ${r.MODELO}</td></tr>`);
      prevModelo = r.MODELO; zebra = 0;
    }

    const b  = bestIdx(r);
    const ev = zebra++ % 2 === 0 ? 'ev' : 'od';
    const v  = (r.VARIANTE && r.VARIANTE !== 'nan') ? r.VARIANTE : '—';

    let c = `<tr class="row ${ev}">
      <td>${r.MARCA}</td><td>${r.MODELO}</td><td>${v}</td>`;

    FIELDS.forEach((f, i) => {
      const fmtd = fmt(r[f]);
      c += fmtd
        ? `<td class="${i === b ? 'best' : 'p'}">${fmtd}</td>`
        : `<td class="nd">—</td>`;
    });

    c += `<td class="win">${b >= 0 ? LABELS[b] : ''}</td></tr>`;
    rows.push(c);
  });

  tbody.innerHTML = rows.join('');

  // Click en fila → detalle
  tbody.querySelectorAll('tr.row').forEach((tr, idx) => {
    tr.addEventListener('click', () => openDetail(filtered[idx]));
  });
}

// ── Admin Panel ────────────────────────────────────────────
let parsedData = null;

// Mapa de nombres de columna alternativos
const COL_MAP = {
  MARCA:    ['marca', 'brand', 'fabricante'],
  MODELO:   ['modelo', 'model', 'equipo'],
  VARIANTE: ['variante', 'variant', 'calidad', 'quality', 'descripcion', 'descripción', 'detalle'],
  ARS_FAB:  ['ars_fab', 'fabritech', 'fab', 'fabri'],
  ARS_MAY:  ['ars_may', 'mayorista', 'may', 'mayor'],
  ARS_BOS:  ['ars_bos', 'boston', 'bos'],
  ARS_DIST: ['ars_dist', 'distribuidor', 'dist', 'distrib'],
  ARS_SARA: ['ars_sara', 'saracell', 'sara', 'sarace'],
};

function mapColumns(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const lower = String(h).toLowerCase().trim();
    for (const [field, aliases] of Object.entries(COL_MAP)) {
      if (lower === field.toLowerCase() || aliases.includes(lower)) {
        map[field] = i; break;
      }
    }
  });
  return map;
}

function initAdmin() {
  document.getElementById('admin-btn').addEventListener('click', openAdmin);
  document.getElementById('modal-close').addEventListener('click', closeAdmin);
  document.getElementById('admin-modal').addEventListener('click', e => {
    if (e.target.id === 'admin-modal') closeAdmin();
  });

  const zone  = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => {
    if (input.files[0]) processFile(input.files[0]);
  });

  document.getElementById('preview-cancel').addEventListener('click', resetUpload);
  document.getElementById('preview-apply').addEventListener('click', applyData);
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-template').addEventListener('click', downloadTemplate);
}

function openAdmin() {
  document.getElementById('admin-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAdmin() {
  document.getElementById('admin-modal').classList.add('hidden');
  document.body.style.overflow = '';
  resetUpload();
}

function resetUpload() {
  parsedData = null;
  document.getElementById('upload-zone').classList.remove('hidden');
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('file-input').value = '';
}

function processFile(file) {
  const reader  = new FileReader();
  const isCSV   = file.name.toLowerCase().endsWith('.csv');

  reader.onload = e => {
    try {
      let rows;
      if (isCSV) {
        rows = e.target.result
          .split('\n')
          .map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
      } else {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      }

      if (rows.length < 2) {
        showToast('❌ El archivo está vacío o tiene formato incorrecto', 'error'); return;
      }

      const colMap = mapColumns(rows[0]);

      if (colMap.MARCA === undefined || colMap.MODELO === undefined) {
        showToast('❌ No se encontraron columnas MARCA y MODELO', 'error'); return;
      }

      const parsed = [];
      for (let i = 1; i < rows.length; i++) {
        const r     = rows[i];
        const marca = String(r[colMap.MARCA] || '').trim();
        const modelo = String(r[colMap.MODELO] || '').trim();
        if (!marca || !modelo) continue;

        const entry = { MARCA: marca, MODELO: modelo };
        entry.VARIANTE = colMap.VARIANTE !== undefined
          ? String(r[colMap.VARIANTE] || '').trim() : '';

        FIELDS.forEach(f => {
          const idx = colMap[f];
          if (idx !== undefined) {
            const raw = String(r[idx] || '').replace(/[^0-9.,]/g, '').replace(',', '.');
            entry[f] = raw ? Math.round(parseFloat(raw) || 0) : 0;
          } else {
            entry[f] = 0;
          }
        });

        parsed.push(entry);
      }

      if (!parsed.length) {
        showToast('❌ No se pudieron leer datos del archivo', 'error'); return;
      }

      parsedData = parsed;
      showPreview(parsed, file.name);

    } catch (err) {
      console.error(err);
      showToast('❌ Error al leer el archivo: ' + err.message, 'error');
    }
  };

  isCSV ? reader.readAsText(file, 'UTF-8') : reader.readAsArrayBuffer(file);
}

function showPreview(data, filename) {
  document.getElementById('upload-zone').classList.add('hidden');
  document.getElementById('upload-preview').classList.remove('hidden');

  const marcas  = new Set(data.map(r => r.MARCA)).size;
  const modelos = new Set(data.map(r => r.MODELO)).size;

  document.getElementById('preview-info').innerHTML = `
    <div class="preview-filename">📄 ${filename}</div>
    <div class="preview-stats-grid">
      <div class="stat-box"><div class="stat-num">${data.length.toLocaleString('es-AR')}</div><div class="stat-lbl">variantes</div></div>
      <div class="stat-box"><div class="stat-num">${marcas}</div><div class="stat-lbl">marcas</div></div>
      <div class="stat-box"><div class="stat-num">${modelos}</div><div class="stat-lbl">modelos</div></div>
    </div>
    <p class="preview-warn">⚠️ Esto reemplazará todos los precios actuales.</p>
  `;
}

function applyData() {
  if (!parsedData) return;
  DATA = parsedData;
  localStorage.setItem(DATA_KEY, JSON.stringify(DATA));
  closeAdmin();
  initApp();
  showToast('✅ Precios actualizados correctamente', 'success');
}

function exportData() {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'data.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('💾 data.json descargado', 'success');
}

function downloadTemplate() {
  const header = [['MARCA','MODELO','VARIANTE','ARS_FAB','ARS_MAY','ARS_BOS','ARS_DIST','ARS_SARA']];
  const rows   = [
    ['SAMSUNG','A10','SIN MARCO NEGRO', 0, 10725, 0, 0, 9000],
    ['SAMSUNG','A10','CON MARCO NEGRO', 8500, 11000, 9200, 0, 8900],
    ['MOTOROLA','G9 PLUS','ORIGINAL', 15000, 0, 14500, 16000, 0],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Precios');
  XLSX.writeFile(wb, 'plantilla_precios.xlsx');
  showToast('📋 Plantilla descargada', 'success');
}

// ── Modal Detalle ──────────────────────────────────────────
let detailInited = false;
function initDetail() {
  if (detailInited) return;
  detailInited = true;
  document.getElementById('detail-close').addEventListener('click', closeDetail);
  document.getElementById('detail-modal').addEventListener('click', e => {
    if (e.target.id === 'detail-modal') closeDetail();
  });
}

function openDetail(row) {
  const b = bestIdx(row);
  const v = (row.VARIANTE && row.VARIANTE !== 'nan') ? row.VARIANTE : '';

  document.getElementById('d-marca').textContent    = row.MARCA;
  document.getElementById('d-modelo').textContent   = row.MODELO;
  document.getElementById('d-variante').textContent = v;

  // Colores por proveedor
  const colors = ['#2E75B6','#375623','#7F6000','#843C0C','#6B2D8B'];

  const cards = LABELS.map((label, i) => {
    const val  = row[FIELDS[i]];
    const isBest = i === b;
    const color  = colors[i];
    if (!val) return `
      <div class="dc-card dc-empty">
        <div class="dc-label">${label}</div>
        <div class="dc-price dc-nd">Sin precio</div>
      </div>`;
    return `
      <div class="dc-card ${isBest ? 'dc-best' : ''}" style="${isBest ? '' : `--dc-color:${color}`}">
        <div class="dc-label">${label}</div>
        <div class="dc-price">$&nbsp;${val.toLocaleString('es-AR')}</div>
        ${isBest ? '<div class="dc-badge">✅ Más barato</div>' : ''}
      </div>`;
  }).join('');

  document.getElementById('detail-body').innerHTML = cards;
  document.getElementById('detail-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  document.getElementById('detail-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

// ── Toast ──────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ── PWA ────────────────────────────────────────────────────
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  let deferredPrompt = null;
  const banner = document.getElementById('install-banner');

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    banner.classList.add('show');
  });

  document.getElementById('install-btn').addEventListener('click', () => {
    banner.classList.remove('show');
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; }
  });

  window.addEventListener('appinstalled', () => banner.classList.remove('show'));

  const isIOS        = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  if (isIOS && !isStandalone) {
    document.getElementById('ios-tip').classList.add('show');
  }
}

// ══════════════════════════════════════════════════════════
// ── Stock de Celulares ────────────────────────────────────
// ══════════════════════════════════════════════════════════

const STOCK_KEY = 'celulares_stock';
let STOCK       = [];
let editingPhoneId = null;
let navInited      = false;
let stockInited    = false;

// ── Navegación de vistas ──────────────────────────────────
function initNav() {
  if (navInited) return;
  navInited = true;
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function switchView(view) {
  document.getElementById('view-modulos').style.display = view === 'modulos' ? 'flex' : 'none';
  document.getElementById('view-stock').style.display   = view === 'stock'   ? 'flex' : 'none';
  document.querySelectorAll('.nav-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  if (view === 'stock') renderStock();
}

// ── Carga y guardado ──────────────────────────────────────
function loadStock() {
  try {
    const raw = localStorage.getItem(STOCK_KEY);
    STOCK = raw ? JSON.parse(raw) : [];
  } catch (e) { STOCK = []; }
}

function saveStockData() {
  localStorage.setItem(STOCK_KEY, JSON.stringify(STOCK));
}

// ── Inicialización ────────────────────────────────────────
function initStock() {
  if (stockInited) return;
  stockInited = true;
  loadStock();

  document.getElementById('add-phone-btn').addEventListener('click', () => openPhoneModal());
  document.getElementById('phone-modal-close').addEventListener('click', closePhoneModal);
  document.getElementById('phone-cancel-btn').addEventListener('click', closePhoneModal);
  document.getElementById('phone-save-btn').addEventListener('click', savePhone);
  document.getElementById('phone-modal').addEventListener('click', e => {
    if (e.target.id === 'phone-modal') closePhoneModal();
  });

  document.getElementById('stock-search').addEventListener('input', scheduleStockRender);
  document.getElementById('sf-marca').addEventListener('change', scheduleStockRender);
  document.getElementById('sf-estado').addEventListener('change', scheduleStockRender);
  document.getElementById('sf-vendido').addEventListener('change', scheduleStockRender);
}

// ── Render del listado ────────────────────────────────────
let stockTimer;
function scheduleStockRender() {
  clearTimeout(stockTimer);
  stockTimer = setTimeout(renderStock, 60);
}

function renderStock() {
  const q       = (document.getElementById('stock-search').value || '').trim().toLowerCase();
  const fMarca  = document.getElementById('sf-marca').value;
  const fEstado = document.getElementById('sf-estado').value;
  const fVend   = document.getElementById('sf-vendido').value;
  const words   = q ? q.split(/\s+/).filter(Boolean) : [];

  // Actualizar opciones de marca con el stock completo
  const marcas     = [...new Set(STOCK.map(p => p.marca))].sort();
  const sfMarcaEl  = document.getElementById('sf-marca');
  const prevMarca  = sfMarcaEl.value;
  while (sfMarcaEl.options.length > 1) sfMarcaEl.remove(1);
  marcas.forEach(m => {
    const o = document.createElement('option');
    o.value = m; o.textContent = m;
    sfMarcaEl.appendChild(o);
  });
  sfMarcaEl.value = prevMarca;

  const filtered = STOCK.filter(p => {
    if (fMarca  && p.marca  !== fMarca)  return false;
    if (fEstado && p.estado !== fEstado) return false;
    if (fVend === '0' && p.vendido)      return false;
    if (fVend === '1' && !p.vendido)     return false;
    if (words.length) {
      const hay = (p.marca + ' ' + p.modelo + ' ' + (p.imei || '')).toLowerCase();
      return words.every(w => hay.includes(w));
    }
    return true;
  });

  const enStock  = filtered.filter(p => !p.vendido);
  const totalVal = enStock.reduce((s, p) => s + (p.precio || 0), 0);
  document.getElementById('stock-count').textContent =
    filtered.length + ' equipo' + (filtered.length !== 1 ? 's' : '');
  document.getElementById('stock-value').textContent =
    enStock.length > 0 ? '$ ' + totalVal.toLocaleString('es-AR') : '';

  const listEl  = document.getElementById('stock-list');
  const emptyEl = document.getElementById('stock-empty');

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = '';
    return;
  }
  emptyEl.style.display = 'none';

  const badgeClass = { Nuevo: 'badge-new', Usado: 'badge-used', Reacondicionado: 'badge-refurb' };

  listEl.innerHTML = filtered.map(p => {
    const specs = [p.almacenamiento, p.ram ? p.ram + ' RAM' : ''].filter(Boolean).join(' · ');
    const fecha = p.fecha
      ? new Date(p.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : '';
    const fVenta = p.fecha_venta
      ? new Date(p.fecha_venta).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : '';
    return `
<div class="phone-card-item${p.vendido ? ' phone-sold' : ''}">
  <div class="pc-top">
    <div class="pc-title">
      <span class="pc-marca">${esc(p.marca)}</span>
      <span class="pc-modelo">${esc(p.modelo)}</span>
    </div>
    <span class="pc-badge ${badgeClass[p.estado] || ''}">${esc(p.estado) || '—'}</span>
  </div>
  ${specs  ? `<div class="pc-specs">${esc(specs)}</div>` : ''}
  ${p.imei ? `<div class="pc-imei">IMEI: ${esc(p.imei)}</div>` : ''}
  ${p.notas ? `<div class="pc-notas">${esc(p.notas)}</div>` : ''}
  <div class="pc-bottom">
    <div class="pc-price">${p.precio ? '$ ' + p.precio.toLocaleString('es-AR') : '—'}</div>
    <div class="pc-actions">
      ${p.vendido && fVenta ? `<span class="pc-date">Vta: ${fVenta}</span>` : ''}
      ${!p.vendido && fecha  ? `<span class="pc-date">Ing: ${fecha}</span>` : ''}
      ${!p.vendido ? `<button class="pc-btn pc-btn-edit" onclick="openPhoneModal('${p.id}')">✏️</button>` : ''}
      ${!p.vendido
        ? `<button class="pc-btn pc-btn-sell" onclick="markSold('${p.id}')">Vender</button>`
        : `<button class="pc-btn pc-btn-unsell" onclick="markSold('${p.id}')">Reactivar</button>`}
      <button class="pc-btn pc-btn-del" onclick="deletePhone('${p.id}')">🗑️</button>
    </div>
  </div>
</div>`;
  }).join('');
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Modal agregar / editar ────────────────────────────────
function openPhoneModal(id) {
  editingPhoneId = id || null;
  const titleEl = document.getElementById('phone-modal-title');

  if (id) {
    const p = STOCK.find(x => x.id === id);
    if (!p) return;
    titleEl.textContent = '✏️ Editar Equipo';
    document.getElementById('f-phone-marca').value   = p.marca || '';
    document.getElementById('f-phone-modelo').value  = p.modelo || '';
    document.getElementById('f-phone-estado').value  = p.estado || '';
    document.getElementById('f-phone-precio').value  = p.precio || '';
    document.getElementById('f-phone-storage').value = p.almacenamiento || '';
    document.getElementById('f-phone-ram').value     = p.ram || '';
    document.getElementById('f-phone-imei').value    = p.imei || '';
    document.getElementById('f-phone-notas').value   = p.notas || '';
  } else {
    titleEl.textContent = '📱 Agregar Equipo';
    ['f-phone-marca','f-phone-modelo','f-phone-precio','f-phone-imei','f-phone-notas'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('f-phone-estado').value  = '';
    document.getElementById('f-phone-storage').value = '';
    document.getElementById('f-phone-ram').value     = '';
  }

  document.getElementById('phone-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('f-phone-marca').focus(), 350);
}

function closePhoneModal() {
  document.getElementById('phone-modal').classList.add('hidden');
  document.body.style.overflow = '';
  editingPhoneId = null;
}

function savePhone() {
  const marca   = document.getElementById('f-phone-marca').value.trim();
  const modelo  = document.getElementById('f-phone-modelo').value.trim();
  const estado  = document.getElementById('f-phone-estado').value;
  const precio  = parseInt(document.getElementById('f-phone-precio').value) || 0;
  const storage = document.getElementById('f-phone-storage').value;
  const ram     = document.getElementById('f-phone-ram').value;
  const imei    = document.getElementById('f-phone-imei').value.trim();
  const notas   = document.getElementById('f-phone-notas').value.trim();

  if (!marca)  { showToast('❌ Ingresá la marca', 'error');           return; }
  if (!modelo) { showToast('❌ Ingresá el modelo', 'error');          return; }
  if (!estado) { showToast('❌ Seleccioná el estado', 'error');       return; }
  if (!precio) { showToast('❌ Ingresá el precio', 'error');          return; }
  if (imei && !/^\d{15}$/.test(imei)) {
    showToast('❌ El IMEI debe tener exactamente 15 dígitos', 'error'); return;
  }

  if (editingPhoneId) {
    const idx = STOCK.findIndex(x => x.id === editingPhoneId);
    if (idx >= 0) {
      STOCK[idx] = { ...STOCK[idx], marca, modelo, estado, precio, almacenamiento: storage, ram, imei, notas };
    }
    showToast('✅ Equipo actualizado', 'success');
  } else {
    STOCK.unshift({
      id: Date.now().toString(),
      marca, modelo, estado, precio,
      almacenamiento: storage, ram, imei, notas,
      fecha: new Date().toISOString(),
      vendido: false,
    });
    showToast('✅ Equipo agregado al stock', 'success');
  }

  saveStockData();
  closePhoneModal();
  renderStock();
}

function markSold(id) {
  const p = STOCK.find(x => x.id === id);
  if (!p) return;
  p.vendido = !p.vendido;
  if (p.vendido) p.fecha_venta = new Date().toISOString();
  else           delete p.fecha_venta;
  saveStockData();
  renderStock();
  showToast(p.vendido ? '✅ Marcado como vendido' : '↩️ Reactivado al stock', p.vendido ? 'success' : 'info');
}

function deletePhone(id) {
  const p = STOCK.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar ${p.marca} ${p.modelo}?`)) return;
  STOCK = STOCK.filter(x => x.id !== id);
  saveStockData();
  renderStock();
  showToast('🗑️ Equipo eliminado', 'info');
}

// ── Arranque ───────────────────────────────────────────────
initPinPad();
checkAuth();
