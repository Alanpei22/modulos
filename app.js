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

// ── Arranque ───────────────────────────────────────────────
initPinPad();
checkAuth();
