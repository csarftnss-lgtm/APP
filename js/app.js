/* PrepCoach — app de planificación para preparadores de culturismo.
   Vanilla JS, sin build. Estado persistido en IndexedDB (con respaldo en localStorage). */
(() => {
  'use strict';

  // =====================================================================
  // Utilidades
  // =====================================================================
  const $ = (s, r = document) => r.querySelector(s);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
  const mean = (arr) => (arr.length ? sum(arr) / arr.length : null);

  const nfCache = {};
  function fmt(n, d = 0) {
    if (n == null || !isFinite(n)) return '—';
    const k = d;
    nfCache[k] = nfCache[k] || new Intl.NumberFormat('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
    return nfCache[k].format(n);
  }
  const fmtS = (n, d = 2) => (n == null || !isFinite(n) ? '—' : (n > 0 ? '+' : '') + fmt(n, d));

  // Lee números escritos con coma o punto, tolerando texto alrededor ("19 años", "%21,5").
  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).replace(/\s/g, '');
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, ''));
    const m = s.match(/-?\d+(?:[.,]\d+)?/);
    return m ? parseFloat(m[0].replace(',', '.')) : null;
  }
  const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

  // Fechas (ISO local YYYY-MM-DD)
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
  const todayISO = () => iso(new Date());
  const fmtDate = (s, short = false) => { const d = parseISO(s); if (!d) return '—'; return short ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const dayName = (s) => DAYS[parseISO(s).getDay()];
  const mondayOf = (s) => { const d = parseISO(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return iso(d); };
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  function ageFrom(birth) {
    const b = parseISO(birth); if (!b) return null;
    const t = new Date(); let a = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
    return a;
  }
  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  // Íconos (trazos estilo Feather)
  const P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    clip: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    menu: '<path d="M3 11h18M5 11a7 7 0 0 1 14 0M4 15h16l-1 4H5z"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    down: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    up: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    arrowUp: '<path d="m18 15-6-6-6 6"/>',
    arrowDown: '<path d="m6 9 6 6 6-6"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.4 18.4 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22"/>',
    arrowR: '<path d="M5 12h14M13 5l7 7-7 7"/>',
    sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    send: '<path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    paste: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M12 10v7M9 14l3 3 3-3"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14.2a5.5 5.5 0 0 1 5.5 5.8"/>',
    cal: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  };
  const ic = (n, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;

  // =====================================================================
  // Modelo de datos
  // =====================================================================
  const ETAPAS = ['Pérdida de grasa', 'Mini cut', 'Mantenimiento', 'Ganancia de masa muscular', 'Recomposición', 'Preparación competencia', 'Peak week', 'Post competencia', 'Reverse diet'];
  // Etapas con el formulario completo; las demás quedan «por configurar» (solo objetivo y fechas).
  const STAGE_FULL = ['Pérdida de grasa', 'Mini cut'];
  // Objetivos cuyo % semanal es de aumento de peso (el resto, de pérdida).
  const GAIN_TYPES = ['Ganancia de masa muscular', 'Volumen', 'Reverse diet'];
  const DAY_COLORS = ['#d8b15f', '#5ea8ff', '#4cc38a', '#b58cff', '#ef7a6f', '#f0a33a', '#3fc6c6'];

  const Q_REC = ['Desayuno', 'Colación', 'Almuerzo', 'Colación', 'Cena', 'Otra comida', 'Otra comida'];
  const Q_FREC_L = ['Pan (cualquier tipo)', 'Cereales de desayuno (avena, hojuelas, etc.)', 'Vegetales', 'Arroz', 'Pastas', 'Papa', 'Frutas', 'Embutidos, cecinas', 'Atún (fresco, en lata)', 'Jurel en lata', 'Pescado fresco', 'Bebidas energéticas'];
  const Q_FREC_R = ['Frutos secos', 'Snacks dulces o salados (barritas de cereal, galletas)', 'Carne de vacuno', 'Carne de pollo', 'Carne de cerdo', 'Bebidas (normal, cero calorías)', 'Legumbres', 'Bebidas vegetales', 'Palta', 'Lácteos'];
  const Q_TEND = [
    ['pesar', '¿Prefieres pesar la comida o trabajar con porciones?'],
    ['variedad', '¿Prefieres comer siempre lo mismo o agregar algo de variedad al plan?'],
    ['protein', '¿Puedes permitirte comprar productos protein como yogurt, leche, barritas de proteínas?'],
    ['fuera', '¿Cuántas veces a la semana comes fuera de casa? ¿Qué comes?'],
    ['batidos', '¿Consumes batidos de proteína? (frecuencia, horario)'],
    ['noGusta', 'Alimentos que no te gustan o que preferirías evitar'],
    ['alergias', 'Alergias / Intolerancias'],
    ['cafeina', '¿Cuánta cafeína consumes al día? (café, bebidas energéticas, pre entrenos)'],
  ];
  const Q_PERI = [
    ['ayunas', '¿Entrenas en ayunas?'],
    ['antes', '¿Qué sueles comer antes del entrenamiento y con cuánta anticipación?'],
    ['durante', '¿Consumes algo durante la sesión? (agua, isotónica, geles, comida)'],
    ['despues', '¿Qué comes inmediatamente después del ejercicio?'],
  ];
  const Q_WEEK_ROWS = [
    ['tipo', 'Tipo de entrenamiento'],
    ['duracion', 'Duración'],
    ['rpe', 'Intensidad percibida (RPE 1-10, siendo 10 muy exigente y 1 muy poco exigente)'],
    ['cardio', '¿Cardio después de entrenar? Indica tipo y duración (si corresponde)'],
    ['deporte', '¿Tienes algún deporte o actividad física fuera del gimnasio?'],
  ];

  const FACTORS = [
    [1.2, 'Sedentario o actividad mínima. Trabajo de escritorio y no hace ejercicio.'],
    [1.375, '1-3 entrenamientos semanales. Trabajo de escritorio y algo de ejercicio regular, o trabajo ligeramente activo (de pie la mayor parte del día).'],
    [1.55, '3-5 entrenamientos semanales. Trabajo sedentario y entrenamiento fuerte, o de pie todo el día y entrenamiento moderado.'],
    [1.725, '6-7 entrenamientos semanales. Entrenamientos duros la mayoría de los días y trabajo de pie, o personas bastante activas.'],
    [1.9, 'Atletas de alto rendimiento. Ejercicio 2 veces al día, entrenamiento duro y trabajo intenso.'],
  ];

  function newQ(nombre = '') {
    return {
      fechaInicio: todayISO(), nombre, edad: '', sexo: '', altura: '', peso: '', grasa: '', masaMuscular: '', ocupacion: '', sueno: '', estres: '',
      motivo: [], motivoDetalle: '', pesoCambio: '', pesoCambioDetalle: '',
      suplementos: [{ cual: '', dia: '', horario: '', cantidad: '', marca: '' }],
      pasos: '', nivel: '', semana: {},
      peri: {}, rec: Q_REC.map((c) => ({ comida: c, horario: '', ej1: '', ej2: '' })),
      tend: {}, frec: {},
    };
  }
  // Textos iniciales de los dos recuadros editables de «Distribución de comidas» (se guardan por atleta en distNotes).
  const DIST_NOTES = {
    org: 'Puedes cambiar el momento de una preparación (por ejemplo, trasladar el sándwich del desayuno a la colación pre entreno). La colación pre entreno: 1 hora antes si es la colación indicada; 2 horas antes si trasladas ahí la preparación del desayuno.',
    tip: 'Concentra carbohidratos en el peri-entrenamiento (pre y post) y reparte la proteína de forma homogénea (≈0,4 g/kg por comida).',
  };
  // Pestaña «Planificación»: objetivo de la etapa, fechas y lista de objetivos (parte con 4 en blanco).
  const newPlanif = () => ({ objetivo: '', inicio: '', termino: '', objetivos: ['', '', '', ''] });
  // Etapa del proceso (Seguimiento › Configuración). diasEntreno y diasPeso: 0 = lunes … 6 = domingo.
  // objetivo: % semanal del peso (siempre positivo; el signo lo da el tipo de etapa).
  const newStage = (tipo = '', o = {}) => Object.assign({ id: uid(), tipo, inicio: '', fin: '', pesoInicial: null, grasaInicial: null,
    diasEntreno: [], pasos: null, objetivo: null, diasPeso: [], chart: { vars: ['peso', 'obj'], modo: 'semana' } }, o);
  const defaultStages = (inicio) => [
    newStage('Pérdida de grasa', { inicio, fin: addDays(inicio, 7 * 12 - 1), objetivo: 1, pasos: 10000, diasPeso: [0, 2, 4] }),
    newStage('Mini cut'), newStage('Mantenimiento'), newStage('Ganancia de masa muscular'),
  ];
  const newOption = () => ({ id: uid(), title: '', image: null, foods: [], notes: '' });
  const newMeal = (name, time, pct) => ({ id: uid(), name, time, pP: pct, pC: pct, pG: pct, options: [newOption()], sel: 0, active: 0 });
  function newDayType(name, color, ajuste, meals) {
    return { id: uid(), name, color, kcalMode: 'auto', ajuste, kcal: null, protGkg: 2.2, fatMode: 'gkg', fatGkg: 0.8, fatPct: 25, meals, notes: '' };
  }
  const trainMeals = () => [newMeal('Desayuno', '08:00', 20), newMeal('Almuerzo', '13:30', 25), newMeal('Pre entreno', '17:00', 20), newMeal('Post entreno', '20:00', 20), newMeal('Última comida', '22:30', 15)];
  const restMeals = () => [newMeal('Desayuno', '09:00', 20), newMeal('Colación', '11:30', 15), newMeal('Almuerzo', '14:00', 25), newMeal('Colación', '17:30', 15), newMeal('Última comida', '21:30', 25)];

  function newAthlete(nombre) {
    const dts = [newDayType('Entrenamiento', DAY_COLORS[0], 0, trainMeals()), newDayType('Descanso', DAY_COLORS[1], -10, restMeals())];
    return {
      id: uid(), createdAt: todayISO(), q: newQ(nombre),
      req: { nacimiento: '', edad: '', sexo: '', peso: '', altura: '', grasa: '', factor: 1.55, ecuacion: 'mifflin', tmbManual: null, objetivo: 'deficit', pctDef: 0.5, pctVol: 0.3, volUnit: 'mes', pctMant: 0, kcalKg: 7000, pasos: null, sumarPasos: false },
      dayTypes: dts, activeDay: dts[0].id,
      tracking: { config: { inicio: mondayOf(todayISO()), semanas: 11, pesoInicial: null, etapa: 'Pérdida de grasa', obj1: -1, cambio: 5, obj2: -0.5, tol: 0.25, metaPasos: 10000, stages: defaultStages(mondayOf(todayISO())) }, weeks: {}, daily: {} },
      ui: { trackTab: 'panel', panelWeek: null, chartMetric: 'abd' },
      calendar: {}, // calendario de alimentación: { 'aaaa-mm-dd': id del tipo de día }
      portal: newPortal(),
    };
  }
  // Acceso del cliente: enlace con token y cuenta del cliente vinculada (id opaco de claude.ai).
  const newPortal = () => ({ token: null, clientUid: null, linkedAt: null, planHash: null, planAt: null });
  function newState() {
    return {
      v: 1,
      foods: (window.SEED_FOODS || []).map(([name, porcion, gpp, kcal, p, c, g], i) => ({ id: 's' + i, name, porcion, gpp, kcal, p, c, g })),
      athletes: [], activeId: null,
    };
  }

  // =====================================================================
  // Persistencia
  // =====================================================================
  const DB = 'prepcoach', STORE = 'kv', LS_KEY = 'prepcoach-state';
  let S = null;
  const T = { foodQ: '', foodSort: 'name', foodDraft: null, foodSaved: null, linking: {}, claims: {}, conflicts: {}, names: {}, preview: false }; // estado transitorio (no persistido)

  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function loadState() {
    try {
      const db = await idb();
      const v = await new Promise((res, rej) => { const g = db.transaction(STORE, 'readonly').objectStore(STORE).get('state'); g.onsuccess = () => res(g.result); g.onerror = () => rej(g.error); });
      if (v) return v;
    } catch (e) { console.warn('IndexedDB no disponible', e); }
    try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; }
  }
  async function writeState() {
    try {
      const db = await idb();
      await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(S, 'state'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (e) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e2) { toast('No se pudo guardar: almacenamiento lleno. Exporta un respaldo.'); }
    }
  }
  // Dos modos: 'local' guarda en este navegador (IndexedDB); 'sync' usa la base de datos
  // del Artifact y sincroniza entre dispositivos (un documento por atleta + uno de alimentos).
  // Portal del cliente: el seguimiento de un atleta vinculado vive en portal/<uid>/d/track (lo escriben
  // coach y cliente, campo a campo); el plan publicado en portal/<uid>/d/plan (solo lectura para el cliente).
  let MODE = 'local', ready = true, loadNote = '';
  let CLIENT = false; // true cuando quien abre la app es un cliente con su enlace
  let cdb = null, cassets = null, cdownloads = null, cuser = null;
  const synced = {}; // id del atleta (o '__foods') -> contenido confirmado en la base de datos
  const trackBase = {}; // uid del cliente -> último seguimiento confirmado en la base de datos
  const trackSubs = {}; // uid -> función para cancelar la suscripción
  const CL = { uid: null, token: null, state: 'loading', plan: null, planAt: null }; // estado en modo cliente
  let saveTimer = null, flushing = false, flushAgain = false, saveState = 'ok';
  const SHARE_URL = 'https://claude.ai/artifact/C4FrvxbPgsLnpNXPjWr9H7';
  const trackPath = (u) => `portal/${u}/d/track`;
  const planPath = (u) => `portal/${u}/d/plan`;
  const linkedUid = (a) => (a && a.portal && a.portal.clientUid) || null;
  // Documento del atleta sin el seguimiento cuando este vive en el portal del cliente.
  const athleteBody = (a) => (linkedUid(a) ? Object.assign({}, a, { tracking: undefined }) : a);
  const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  // Cambios mínimos para pasar de prev a cur (las claves eliminadas quedan en null).
  function diffObj(prev, cur) {
    if (stable(prev) === stable(cur)) return undefined;
    if (!isPlain(prev) || !isPlain(cur)) return cur === undefined ? null : cur;
    const out = {}; let any = false;
    Object.keys(cur).forEach((k) => { if (cur[k] === undefined) return; const d = diffObj(prev[k], cur[k]); if (d !== undefined) { out[k] = d; any = true; } });
    Object.keys(prev).forEach((k) => { if (!(k in cur) && prev[k] != null) { out[k] = null; any = true; } });
    return any ? out : undefined;
  }
  function deepMerge(base, patch) {
    if (!isPlain(patch)) return patch === undefined ? base : patch;
    const out = isPlain(base) ? base : {};
    Object.keys(patch).forEach((k) => { out[k] = deepMerge(out[k], patch[k]); });
    return out;
  }
  function migrateTracking(t) {
    const base = newAthlete('').tracking;
    t = isPlain(t) ? t : {};
    const hadStages = isPlain(t.config) && Array.isArray(t.config.stages);
    t.config = Object.assign(base.config, isPlain(t.config) ? t.config : {});
    if (!hadStages) { t.weeks = isPlain(t.weeks) ? t.weeks : {}; t.config.stages = stagesFromLegacy(t, null); keepLegacyTargets(t); }
    t.weeks = isPlain(t.weeks) ? t.weeks : {}; t.daily = isPlain(t.daily) ? t.daily : {};
    return moveWeeklyToDaily(t);
  }

  function stable(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
    if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : stable(x))).join(',') + ']';
    return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  function save() {
    if (!CLIENT && S && A()) syncTimeline(A());
    setSaveState('saving');
    clearTimeout(saveTimer);
    if (MODE === 'sync') { saveTimer = setTimeout(flush, 700); return; }
    saveTimer = setTimeout(async () => { await writeState(); setSaveState('ok'); }, 350);
  }
  async function flush() {
    if (flushing) { flushAgain = true; return; }
    flushing = true;
    try {
      const jobs = [];
      if (CLIENT) {
        // El cliente solo escribe su seguimiento.
        const a = A(); if (a && CL.uid) jobs.push(writeTrack(CL.uid, a));
      } else {
        S.athletes.forEach((a) => {
          const body = athleteBody(a), j = stable(body);
          if (j !== synced[a.id]) jobs.push(writeDoc('athletes/' + a.id, body, a.id, j));
          if (linkedUid(a)) jobs.push(writeTrack(linkedUid(a), a));
        });
        Object.keys(synced).filter((id) => id !== '__foods' && !S.athletes.some((a) => a.id === id))
          .forEach((id) => jobs.push(cdb.doc('athletes/' + id).delete().then(() => { delete synced[id]; })));
        const fj = stable(S.foods);
        if (fj !== synced.__foods) jobs.push(writeDoc('meta/foods', { list: S.foods }, '__foods', fj));
      }
      await Promise.all(jobs);
      setSaveState('ok');
    } catch (e) { syncError(e); }
    flushing = false;
    if (flushAgain) { flushAgain = false; flush(); }
  }
  async function writeDoc(path, body, key, json) {
    const plain = JSON.parse(JSON.stringify(body));
    try { await cdb.doc(path).set(plain); } catch (e) {
      if (!e || e.code !== 'unavailable') throw e;
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 800));
      await cdb.doc(path).set(plain);
    }
    synced[key] = json;
  }
  // Envía solo los campos del seguimiento que cambiaron, para no pisar lo que anotó la otra persona.
  async function writeTrack(u, a) {
    const base = trackBase[u]; if (base === undefined) return;
    const d = diffObj(base, a.tracking); if (!d) return;
    const plain = JSON.parse(JSON.stringify(d));
    try { await cdb.doc(trackPath(u)).update(plain); } catch (e) {
      if (!e || e.code !== 'unavailable') throw e;
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 800));
      await cdb.doc(trackPath(u)).update(plain);
    }
    trackBase[u] = deepMerge(clone(base), plain);
  }
  // Llega el seguimiento desde la base de datos: se combina con lo que aún no se guardó aquí.
  function onTrack(u, snap) {
    const a = CLIENT ? A() : S.athletes.find((x) => linkedUid(x) === u);
    if (!a) return;
    if (!snap.exists) { if (CLIENT) { CL.state = 'pending'; ready = true; scheduleRender(); } return; }
    const remote = snap.data();
    if (trackBase[u] !== undefined && stable(remote) === stable(trackBase[u])) { if (CLIENT && CL.state !== 'ready') { CL.state = 'ready'; scheduleRender(); } return; }
    const pending = trackBase[u] === undefined ? undefined : diffObj(trackBase[u], a.tracking);
    a.tracking = migrateTracking(deepMerge(clone(remote), pending ? clone(pending) : undefined));
    trackBase[u] = clone(remote);
    if (CLIENT) { CL.state = 'ready'; ready = true; }
    scheduleRender();
  }
  function ensureTrackSubs() {
    const want = new Set(S.athletes.map(linkedUid).filter(Boolean));
    want.forEach((u) => { if (!trackSubs[u]) trackSubs[u] = cdb.doc(trackPath(u)).onSnapshot((s) => onTrack(u, s), (e) => { delete trackSubs[u]; syncError(e); }); });
    Object.keys(trackSubs).forEach((u) => { if (!want.has(u)) { trackSubs[u](); delete trackSubs[u]; delete trackBase[u]; } });
  }

  // ---- Vinculación de clientes (lado del coach) ----
  const planOf = (snap) => { const s = Object.assign({}, snap); delete s.updatedAt; return stable(s); };
  function planSnapshot(a) {
    const rc = reqCalc(a), used = new Map();
    const dayTypes = a.dayTypes.map((dt) => {
      const t = dayTargets(a, dt, rc);
      return {
        id: dt.id, name: dt.name, color: dt.color, notes: dt.notes || '',
        _t: t.ok ? { ok: true, kcal: t.kcal, p: t.p, c: t.c, g: t.g, peso: t.peso } : { ok: false, kcal: t.kcal ?? null },
        meals: dt.meals.map((m) => ({
          id: m.id, name: m.name, time: m.time || '', pP: m.pP, pC: m.pC, pG: m.pG, sel: m.sel || 0, active: m.sel || 0,
          // Indicaciones de la comida: solo se incluyen si existen, para no marcar como «cambiado» un plan ya publicado.
          ...(String(m.indic || '').trim() ? { indic: m.indic } : {}),
          options: m.options.map((o) => ({
            id: o.id, title: o.title || '', image: o.image || null, notes: o.notes || '',
            foods: o.foods.filter((l) => foodById(l.foodId)).map((l) => { const f = foodById(l.foodId); used.set(f.id, f); return { foodId: f.id, cantidad: l.cantidad || '', porciones: num(l.porciones) }; }),
          })),
        })),
      };
    });
    const cal = Object.fromEntries(Object.entries(a.calendar || {}).filter(([, id]) => a.dayTypes.some((d) => d.id === id)).sort(([x], [y]) => (x < y ? -1 : 1)));
    return { nombre: a.q.nombre || '', dayTypes, ...(Object.keys(cal).length ? { calendar: cal } : {}), foods: [...used.values()].map((f) => Object.assign({}, f)), updatedAt: new Date().toISOString() };
  }
  async function publishPlan(a) {
    const u = linkedUid(a); if (!u) return;
    const snap = planSnapshot(a);
    await cdb.doc(planPath(u)).set(JSON.parse(JSON.stringify(snap)));
    a.portal.planHash = planOf(snap); a.portal.planAt = snap.updatedAt; save();
  }
  async function linkClient(a, u) {
    if (T.linking[a.id]) return; T.linking[a.id] = true;
    try {
      const tr = JSON.parse(JSON.stringify(a.tracking));
      await cdb.doc(trackPath(u)).set(tr);
      trackBase[u] = tr;
      a.portal.clientUid = u; a.portal.linkedAt = new Date().toISOString();
      ensureTrackSubs();
      await publishPlan(a);
      save(); render();
      toast(`${a.q.nombre || 'Tu cliente'} se conectó a su portal.`);
    } catch (e) { a.portal.clientUid = null; syncError(e); }
    T.linking[a.id] = false;
  }
  // Cada cliente deja en portal/<su id> el token de su enlace; el coach lo empareja con el atleta.
  function processClaims() {
    if (CLIENT || !cdb) return;
    T.conflicts = {};
    Object.entries(T.claims).forEach(([u, c]) => {
      const a = S.athletes.find((x) => x.portal && x.portal.token && x.portal.token === c.token);
      if (!a) return;
      const other = S.athletes.find((x) => x !== a && linkedUid(x) === u);
      if (linkedUid(a) === u) return;
      if (linkedUid(a) || other) { T.conflicts[a.id] = u; return; }
      linkClient(a, u);
    });
  }
  function syncError(e) {
    setSaveState('error');
    const code = e && e.code;
    if (code === 'quota_exceeded') toast('La base de datos está llena. Exporta un respaldo y elimina atletas antiguos.');
    else if (code === 'invalid_argument') toast('No se pudo guardar: este atleta supera el tamaño máximo. Reduce notas o registros antiguos.');
    else if (code === 'revoked' || code === 'not_granted') toast('Se perdió el acceso a la base de datos. Recarga la página.');
    else toast('No se pudo sincronizar. Se reintentará con el próximo cambio.');
  }
  function setSaveState(st) {
    saveState = st;
    const el = $('#save-state'); if (!el) return;
    el.classList.toggle('saving', st === 'saving');
    el.classList.toggle('error', st === 'error');
    el.lastChild.textContent = st === 'saving' ? (MODE === 'sync' ? 'Sincronizando…' : 'Guardando…') : st === 'error' ? 'Sin sincronizar' : (MODE === 'sync' ? 'Sincronizado' : 'Guardado');
  }

  // Lecturas en vivo desde la base de datos del Artifact.
  function onAthletes(qs) {
    const seen = new Set();
    qs.docs.forEach((d) => {
      const id = d.id; seen.add(id);
      const i = S.athletes.findIndex((a) => a.id === id), local = i >= 0 ? S.athletes[i] : null;
      if (!local && synced[id] !== undefined) return;            // eliminado aquí, borrado pendiente
      if (local && stable(athleteBody(local)) !== synced[id]) return; // cambios locales aún sin guardar
      const sj = stable(d.data());
      if (local && sj === synced[id]) return;
      const fresh = migrateAthlete(JSON.parse(JSON.stringify(d.data()))); fresh.id = id;
      // Si el seguimiento vive en el portal del cliente, se conserva el que ya está en memoria.
      if (linkedUid(fresh) && local && linkedUid(local) === linkedUid(fresh)) fresh.tracking = local.tracking;
      synced[id] = stable(athleteBody(fresh));
      if (local) S.athletes[i] = fresh; else S.athletes.push(fresh);
    });
    S.athletes = S.athletes.filter((a) => seen.has(a.id) || synced[a.id] === undefined || stable(athleteBody(a)) !== synced[a.id]);
    Object.keys(synced).forEach((id) => { if (id !== '__foods' && !seen.has(id) && !S.athletes.some((a) => a.id === id)) delete synced[id]; });
    S.athletes.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    if (!S.athletes.find((a) => a.id === S.activeId)) S.activeId = S.athletes[0]?.id || null;
  }
  function onFoods(snap) {
    if (!snap.exists) return;
    const list = snap.data().list; if (!Array.isArray(list)) return;
    if (stable(S.foods) !== synced.__foods) return;
    const sj = stable(list); if (sj === synced.__foods) return;
    S.foods = JSON.parse(JSON.stringify(list)); synced.__foods = sj; dlVersion = -1;
  }
  function startSync() {
    synced.__foods = stable(S.foods);
    let confirmed = false;
    const timer = setTimeout(() => { if (!confirmed) { loadNote = 'La base de datos aún no responde. Los datos pueden no estar al día; aparecerán en cuanto se conecte.'; render(); } }, 10000);
    const subErr = (e) => { clearTimeout(timer); ready = true; loadNote = ''; syncError(e); render(); };
    cdb.doc('meta/foods').onSnapshot((snap) => { onFoods(snap); scheduleRender(); }, subErr);
    cdb.collection('athletes').onSnapshot((qs) => {
      onAthletes(qs);
      if (!qs.metadata.fromCache) { confirmed = true; clearTimeout(timer); loadNote = ''; }
      ready = true; ensureTrackSubs(); processClaims(); scheduleRender();
    }, subErr);
    // Solicitudes de acceso que dejan los clientes al abrir su enlace.
    cdb.collection('portal').onSnapshot((qs) => {
      T.claims = {};
      qs.docs.forEach((d) => { const v = d.data(); if (v && v.token) T.claims[d.id] = v; });
      processClaims(); scheduleRender();
    }, (e) => console.warn('portal', e));
  }

  // ---- Modo cliente: alguien que no es el dueño abre su enlace personal ----
  function clientAthlete() {
    const a = migrateAthlete({ id: 'me', q: { nombre: '' }, dayTypes: [{ id: 'none', name: 'Plan', color: DAY_COLORS[0], meals: [], notes: '' }] });
    a.activeDay = 'none';
    return a;
  }
  function onPlan(snap) {
    const a = A(); if (!a) return;
    if (!snap.exists) { CL.plan = null; scheduleRender(); return; }
    const p = JSON.parse(JSON.stringify(snap.data()));
    CL.plan = p; CL.planAt = p.updatedAt || null;
    const prevDay = a.activeDay;
    a.q.nombre = p.nombre || a.q.nombre;
    a.dayTypes = Array.isArray(p.dayTypes) && p.dayTypes.length ? p.dayTypes : a.dayTypes;
    a.activeDay = a.dayTypes.some((d) => d.id === prevDay) ? prevDay : a.dayTypes[0].id;
    a.calendar = isPlain(p.calendar) ? p.calendar : {};
    S.foods = Array.isArray(p.foods) ? p.foods : []; dlVersion = -1;
    scheduleRender();
  }
  async function startClient(token) {
    CLIENT = true; CL.token = token;
    S = { v: 1, foods: [], athletes: [clientAthlete()], activeId: 'me' };
    if (!curRoute.startsWith('cliente')) curRoute = 'cliente/plan';
    render(); // «Cargando tu portal…»
    const u = cuser ? await cuser.id() : null;
    if (!u) { CL.state = 'noid'; ready = true; render(); return; }
    CL.uid = u;
    try {
      const ref = cdb.doc('portal/' + u), cur = await ref.get();
      if (!cur.exists || cur.data().token !== token) await ref.set({ token, claimedAt: new Date().toISOString() });
    } catch (e) { CL.state = 'denied'; ready = true; render(); return; }
    CL.state = 'pending';
    const timer = setTimeout(() => { if (CL.state !== 'ready') { ready = true; render(); } }, 10000);
    cdb.doc(planPath(u)).onSnapshot(onPlan, (e) => console.warn('plan', e));
    trackSubs[u] = cdb.doc(trackPath(u)).onSnapshot((s) => { clearTimeout(timer); onTrack(u, s); }, (e) => { CL.state = 'denied'; ready = true; render(); });
  }

  // =====================================================================
  // Acceso a rutas
  // =====================================================================
  const A = () => S.athletes.find((a) => a.id === S.activeId) || null;
  function rootFor(path) {
    if (path[0] === '@') return [S, path.slice(1)];
    if (path[0] === '#') return [T, path.slice(1)];
    return [A(), path];
  }
  function getP(path) { const [r, p] = rootFor(path); return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), r); }
  function setP(path, val) {
    const [r, p] = rootFor(path); const ks = p.split('.'); let o = r;
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = val;
  }

  // Generadores de campos
  const vstr = (v) => (v == null ? '' : String(v));
  function I(path, o = {}) {
    const v = o.value !== undefined ? o.value : getP(path);
    const isNum = o.num;
    return `<input class="${o.cls || 'input'}${isNum && o.cls === 'cell' ? ' num' : ''}" ${o.type === 'date' ? 'type="date"' : 'type="text"'} ${isNum ? 'inputmode="decimal" data-type="num"' : ''} data-bind="${path}" ${o.live ? 'data-live' : ''} value="${esc(vstr(v))}" placeholder="${esc(o.ph || '')}" ${o.attrs || ''}>`;
  }
  // Fecha: se elige siempre en un calendario (no se escribe a mano). Se guarda en ISO (aaaa-mm-dd).
  function D(path, id = '') {
    const v = getP(path);
    return `<button type="button" class="input date-btn" ${id ? `id="${id}"` : ''} data-action="openCal" data-cal-path="${path}" aria-haspopup="dialog" title="Elegir fecha en el calendario">${ic('cal', 15)}<span class="${v ? '' : 'date-ph'}">${v ? fmtDate(v) : 'Elegir fecha'}</span></button>`;
  }
  // ---- Calendario emergente ----
  const CAL_M = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  let CAL = null; // { path, y, m, anchor }
  function calHTML() {
    const { y, m, path } = CAL, sel = getP(path) || '', today = todayISO();
    const first = new Date(y, m, 1, 12), lead = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    const cy = new Date().getFullYear(), years = []; for (let k = cy + 5; k >= 1930; k--) years.push(k);
    let cells = ''; for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) { const v = `${y}-${pad(m + 1)}-${pad(d)}`; cells += `<button type="button" class="cal-d${v === sel ? ' sel' : ''}${v === today ? ' today' : ''}" data-action="calPick" data-v="${v}">${d}</button>`; }
    // Encabezado en dos filas: mes y año escritos completos con flechas; debajo, los selectores para saltar rápido.
    return `<div class="cal-head"><button type="button" class="btn sm ghost icon" data-action="calNav" data-d="-1" aria-label="Mes anterior">${ic('chevL', 16)}</button>
        <div class="cal-title">${CAL_M[m]} ${y}</div>
        <button type="button" class="btn sm ghost icon" data-action="calNav" data-d="1" aria-label="Mes siguiente">${ic('chevR', 16)}</button></div>
      <div class="cal-jump">
        <select class="select cal-sel" id="cal-m" aria-label="Mes">${CAL_M.map((n, i) => `<option value="${i}" ${i === m ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <select class="select cal-sel" id="cal-y" aria-label="Año">${years.map((k) => `<option value="${k}" ${k === y ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="cal-grid"><b>L</b><b>M</b><b>M</b><b>J</b><b>V</b><b>S</b><b>D</b>${cells}</div>
      <div class="cal-foot"><button type="button" class="btn xs" data-action="calPick" data-v="${today}">Hoy</button>${sel ? '<button type="button" class="btn xs ghost danger" data-action="calPick" data-v="">Borrar</button>' : ''}<span class="spacer"></span><button type="button" class="btn xs ghost" data-action="calClose">Cerrar</button></div>`;
  }
  function calDraw() {
    let pop = document.getElementById('cal-pop');
    if (!CAL) { pop?.remove(); return; }
    if (!pop) { pop = document.createElement('div'); pop.id = 'cal-pop'; pop.className = 'cal-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Elegir fecha'); document.body.appendChild(pop); }
    pop.innerHTML = calHTML();
    const r = CAL.anchor.getBoundingClientRect(), W = 316, vw = window.innerWidth, vh = window.innerHeight;
    if (vw < 480) { pop.classList.add('sheet'); pop.style.left = ''; pop.style.top = ''; }
    else {
      pop.classList.remove('sheet');
      const h = pop.offsetHeight || 330, left = Math.min(Math.max(8, r.left), vw - W - 8), top = r.bottom + 6 + h > vh - 8 ? Math.max(8, r.top - h - 6) : r.bottom + 6;
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    }
  }
  function maskDate(v) {
    const d = String(v).replace(/\D/g, '').slice(0, 8);
    return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }
  function parseDMY(v) {
    const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return null;
    const [dd, mm, yy] = [+m[1], +m[2], +m[3]];
    if (yy < 1900 || yy > 2100) return null;
    const dt = new Date(yy, mm - 1, dd, 12);
    return dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd ? iso(dt) : null;
  }
  function TA(path, o = {}) {
    return `<textarea class="${o.cls || 'textarea'}" data-bind="${path}" rows="${o.rows || 3}" placeholder="${esc(o.ph || '')}" ${o.attrs || ''}>${esc(vstr(getP(path)))}</textarea>`;
  }
  function SEL(path, opts, o = {}) {
    const v = vstr(getP(path));
    return `<select class="${o.cls || 'select'}" data-bind="${path}" ${o.num ? 'data-type="num"' : ''} ${o.attrs || ''}>${opts.map((x) => { const [val, lab] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(val)}" ${String(val) === v ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
  }
  function F(label, control, hint = '', cls = '') {
    return `<div class="field ${cls}"><label>${label}</label>${control}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  }
  const suffix = (control, s) => `<div class="input-suffix">${control}<span>${s}</span></div>`;

  // =====================================================================
  // Cálculos — requerimientos
  // =====================================================================
  function eff(a) {
    const q = a.q, r = a.req;
    const peso = num(r.peso) ?? num(q.peso);
    let altura = num(r.altura) ?? num(q.altura);
    if (altura && altura < 3) altura *= 100;
    const edad = r.nacimiento ? ageFrom(r.nacimiento) : (num(r.edad) ?? num(q.edad));
    const sexo = r.sexo || q.sexo || 'Masculino';
    const grasa = num(r.grasa) ?? num(q.grasa);
    const ffm = peso != null && grasa != null ? peso * (1 - grasa / 100) : null;
    const fm = peso != null && grasa != null ? peso * grasa / 100 : null;
    return { peso, altura, edad, sexo, grasa, ffm, fm, male: sexo !== 'Femenino' };
  }

  const EQS = [
    { id: 'hb', name: 'Harris-Benedict (Roza y Shizgal, 1984)', ref: 'Revisión de la ecuación original. 168 hombres y 169 mujeres adultos.', need: ['peso', 'altura', 'edad'],
      f: (e) => e.male ? 88.362 + 13.397 * e.peso + 4.799 * e.altura - 5.677 * e.edad : 447.593 + 9.247 * e.peso + 3.098 * e.altura - 4.33 * e.edad },
    { id: 'mifflin', name: 'Mifflin-St Jeor (1990)', ref: '247 mujeres y 251 hombres de 20-77 años. 50% normopeso, 50% sobrepeso u obesidad.', need: ['peso', 'altura', 'edad'],
      f: (e) => 10 * e.peso + 6.25 * e.altura - 5 * e.edad + (e.male ? 5 : -161) },
    { id: 'mifflinMLG', name: 'Mifflin (masa libre de grasa)', ref: 'Variante de Mifflin basada en MLG.', need: ['ffm'], f: (e) => 19.7 * e.ffm + 413 },
    { id: 'owen', name: 'Owen (1986-87)', ref: 'Población adulta general. 44 mujeres (18-65 años) y 60 hombres (18-82 años). Normopeso y obesidad.', need: ['peso'],
      f: (e) => e.male ? 879 + 10.2 * e.peso : 795 + 7.18 * e.peso },
    { id: 'owenMLG', name: 'Owen (masa libre de grasa)', ref: 'Hombres ~20% de grasa; mujeres ~22% de grasa.', need: ['ffm'],
      f: (e) => e.male ? 290 + 22.3 * e.ffm : 334 + 19.7 * e.ffm },
    { id: 'cunningham', name: 'Cunningham (1980)', ref: 'Adultos sanos. Recomendada en atletas con composición corporal conocida.', need: ['ffm'], f: (e) => 500 + 22 * e.ffm },
    { id: 'katch', name: 'Katch-McArdle', ref: 'Basada en masa libre de grasa.', need: ['ffm'], f: (e) => 370 + 21.6 * e.ffm },
    { id: 'tinsleyMLG', name: 'Tinsley (masa libre de grasa)', ref: '27 adultos jóvenes (18-50 años), entrenamiento de fuerza >3 años, ~6 días/semana. Hombres 12,5% / mujeres 19% de grasa.', need: ['ffm'], f: (e) => 25.9 * e.ffm + 284 },
    { id: 'tinsleyKg', name: 'Tinsley (peso corporal)', ref: 'Misma muestra; usa peso total.', need: ['peso'], f: (e) => 24.8 * e.peso + 10 },
    { id: 'haaf', name: 'ten Haaf (2014)', ref: '90 atletas de 18-35 años (ciclistas, nadadores, fuerza, resistencia). ~5 días o 9 h semanales.', need: ['peso', 'altura', 'edad'],
      f: (e) => 11.936 * e.peso + 587.728 * (e.altura / 100) - 8.129 * e.edad + (e.male ? 191.027 : 0) + 29.279 },
    { id: 'haafMLG', name: 'ten Haaf (2014) MLG', ref: 'Misma muestra; usa masa libre de grasa.', need: ['ffm'], f: (e) => 22.771 * e.ffm + 484.264 },
    { id: 'delorenzo', name: 'De Lorenzo (1999)', ref: '51 atletas (~22 años, ~12% grasa). Waterpolo, judo y karate; 3 h/día, 6 días/semana.', need: ['peso', 'altura'], f: (e) => -857 + 9 * e.peso + 11.7 * e.altura },
    { id: 'muller', name: 'Müller (2001)', ref: 'Personas con obesidad tipo II y III (18-61 años).', need: ['peso', 'edad'],
      f: (e) => (0.047 * e.peso + 1.009 * (e.male ? 1 : 0) - 0.01452 * e.edad + 3.21) * 238.85 },
    { id: 'hannon', name: 'Hannon (2020) MLG', ref: '99 jugadores de fútbol de academia Premier League, 12-21 años, 12-22% de grasa.', need: ['ffm'], f: (e) => 1315 + 11.1 * e.ffm },
  ];
  function eqValue(eq, e) { return eq.need.every((k) => e[k] != null) ? eq.f(e) : null; }

  const SEM_MES = 30.44 / 7; // semanas por mes promedio
  function reqCalc(a) {
    const e = eff(a), r = a.req;
    const eq = EQS.find((x) => x.id === r.ecuacion);
    const tmb = r.ecuacion === 'manual' ? num(r.tmbManual) : (eq ? eqValue(eq, e) : null);
    const factor = num(r.factor) ?? 1.55;
    const pasos = num(r.pasos) ?? stepsFromQ(a);
    const pasosKcal = e.peso != null && pasos != null ? (2.74 * e.peso * pasos / 2) / 4184 : null;
    let get = tmb != null ? tmb * factor : null;
    if (get != null && r.sumarPasos && pasosKcal) get += pasosKcal;
    const kcalKg = num(r.kcalKg) ?? 7000;
    const def = {}; const vol = {}; const mant = {};
    if (e.peso != null) {
      // Déficit: % de pérdida de peso semanal.
      def.pct = num(r.pctDef) ?? 0; def.kgSem = e.peso * def.pct / 100; def.gSem = def.kgSem * 1000; def.kgMes = def.kgSem * SEM_MES;
      def.kcalSem = def.kgSem * kcalKg; def.kcalDia = def.kcalSem / 7;
      def.kcal = get != null ? get - def.kcalDia : null;
      // Volumen: % de aumento de peso semanal o mensual (según la unidad elegida).
      vol.unit = r.volUnit === 'sem' ? 'sem' : 'mes'; vol.pct = num(r.pctVol) ?? 0;
      const kgVol = e.peso * vol.pct / 100;
      vol.kgSem = vol.unit === 'sem' ? kgVol : kgVol / SEM_MES; vol.kgMes = vol.unit === 'sem' ? kgVol * SEM_MES : kgVol;
      vol.pctSem = vol.unit === 'sem' ? vol.pct : vol.pct / SEM_MES; vol.pctMes = vol.unit === 'sem' ? vol.pct * SEM_MES : vol.pct;
      vol.gSem = vol.kgSem * 1000; vol.gMes = vol.kgMes * 1000; vol.kcalSem = vol.kgSem * kcalKg; vol.kcalDia = vol.kcalSem / 7;
      vol.kcal = get != null ? get + vol.kcalDia : null;
      // Mantenimiento: ajuste fino de % de cambio de peso mensual (negativo = pérdida, positivo = ganancia).
      mant.pct = num(r.pctMant) ?? 0; mant.kgMes = e.peso * mant.pct / 100; mant.gMes = mant.kgMes * 1000; mant.kgSem = mant.kgMes / SEM_MES;
      mant.kcalSem = mant.kgSem * kcalKg; mant.kcalDia = mant.kcalSem / 7;
      mant.kcal = get != null ? get + mant.kcalDia : null;
    }
    const obj = r.objetivo === 'deficit' ? def.kcal : r.objetivo === 'volumen' ? vol.kcal : (mant.kcal ?? get);
    return { e, eq, tmb, factor, get, pasos, pasosKcal, def, vol, mant, obj, kcalKg };
  }
  function objPanel(r, rc) {
    const L = (l, v) => `<div class="stat-line"><span>${l}</span><b>${v}</b></div>`;
    if (r.objetivo === 'volumen') {
      const v = rc.vol, u = v.unit || 'mes';
      return `<div class="label" style="margin-bottom:8px">Calculadora de volumen</div>
        <div class="seg sm mb8">${[['sem', 'Semanal'], ['mes', 'Mensual']].map(([k, l]) => `<button class="${u === k ? 'active' : ''}" data-action="setVolUnit" data-v="${k}">${l}</button>`).join('')}</div>
        ${F(`% ↑ ${u === 'sem' ? 'semanal' : 'mensual'} del peso`, suffix(I('req.pctVol', { num: true, live: true }), '%'), `Equivale a ${fmt(u === 'sem' ? v.pctMes : v.pctSem, 2)} % ${u === 'sem' ? 'mensual' : 'semanal'}.`)}
        <div class="mt8">
          ${L('kg ↑ semanal', fmt(v.kgSem, 3))}${L('g ↑ semanal', fmt(v.gSem, 1))}
          ${L('kg ↑ mensual', fmt(v.kgMes, 3))}${L('g ↑ mensual', fmt(v.gMes, 1))}
          ${L('kcal ↑ semanal', fmt(v.kcalSem))}${L('kcal ↑ diarias', fmt(v.kcalDia))}
          <div class="stat-line"><span>Kcal a consumir</span><b class="kc">${fmt(v.kcal)}</b></div>
        </div>`;
    }
    if (r.objetivo === 'mantenimiento') {
      const m = rc.mant, sg = (x) => fmtS(x, 3);
      return `<div class="label" style="margin-bottom:8px">Calculadora de mantenimiento</div>
        ${F('% de cambio mensual del peso', suffix(I('req.pctMant', { num: true, live: true, ph: '0' }), '%'), 'Negativo = pérdida leve · 0 = mantener · positivo = ganancia leve.')}
        <div class="mt8">
          ${L('kg mensual', sg(m.kgMes))}${L('g mensual', m.gMes != null ? fmtS(Math.round(m.gMes), 0) : '—')}
          ${L('kg semanal', sg(m.kgSem))}
          ${L('kcal diarias vs GET', m.kcalDia != null ? fmtS(Math.round(m.kcalDia), 0) : '—')}
          <div class="stat-line"><span>Kcal a consumir</span><b class="kc">${fmt(m.kcal ?? rc.get)}</b></div>
        </div>`;
    }
    const d = rc.def;
    return `<div class="label" style="margin-bottom:8px">Calculadora de déficit</div>
      ${F('% ↓ semanal del peso', suffix(I('req.pctDef', { num: true, live: true }), '%'), 'Referencia habitual: 0,5–1 % del peso corporal por semana.')}
      <div class="mt8">
        ${L('kg ↓ semanal', fmt(d.kgSem, 3))}${L('g ↓ semanal', fmt(d.gSem, 1))}
        ${L('kg ↓ mensual (aprox.)', fmt(d.kgMes, 3))}
        ${L('kcal ↓ semanal', fmt(d.kcalSem, 1))}${L('kcal ↓ diario', fmt(d.kcalDia, 1))}
        <div class="stat-line"><span>Kcal a consumir</span><b class="kc">${fmt(d.kcal)}</b></div>
      </div>`;
  }
  function stepsFromQ(a) { const s = String(a.q.pasos || '').replace(/[.\s]/g, ''); const n = parseInt(s, 10); return isFinite(n) ? n : null; }

  function dayTargets(a, dt, rc) {
    if (dt._t) return dt._t; // plan publicado al cliente: metas ya calculadas por el coach
    rc = rc || reqCalc(a);
    const peso = rc.e.peso;
    const kcal = dt.kcalMode === 'manual' ? num(dt.kcal) : (rc.obj != null ? Math.round(rc.obj * (1 + (num(dt.ajuste) || 0) / 100)) : null);
    if (kcal == null || peso == null) return { kcal, p: null, c: null, g: null, ok: false };
    const p = (num(dt.protGkg) || 0) * peso;
    const g = dt.fatMode === 'pct' ? kcal * (num(dt.fatPct) || 0) / 100 / 9 : (num(dt.fatGkg) || 0) * peso;
    const c = (kcal - p * 4 - g * 9) / 4;
    return { kcal, p, c, g, ok: true, peso };
  }
  // Macros por tipo de día tomados de Planificación (entrenamiento y descanso).
  function planMacros(a, rc = reqCalc(a)) {
    const tr = a.dayTypes.find((d) => /entren/i.test(d.name)) || a.dayTypes[0];
    const rs = a.dayTypes.find((d) => /descans/i.test(d.name)) || a.dayTypes[1] || a.dayTypes[0];
    return { E: tr ? macroStr(dayTargets(a, tr, rc)) : '', D: rs ? macroStr(dayTargets(a, rs, rc)) : '' };
  }
  const macroStr = (t) => (t && t.ok ? `Kcal: ${Math.round(t.kcal)} · P: ${Math.round(t.p)} g · CHO: ${Math.round(t.c)} g · G: ${Math.round(t.g)} g` : '');

  // Alimentos y menú
  const foodById = (id) => S.foods.find((f) => f.id === id);
  const foodByName = (n) => { const k = String(n || '').trim().toLowerCase(); return k ? S.foods.find((f) => f.name.toLowerCase() === k) : null; };
  // ---- Buscador de alimentos (desplegable propio, con el estilo de la app) ----
  const FD = { el: null, key: null, items: [], idx: 0, typed: false };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function foodMatches(q) {
    const n = norm(q).trim(), words = n.split(/\s+/).filter(Boolean);
    const list = S.foods.filter((f) => words.every((w) => norm(f.name).includes(w)));
    list.sort((a, b) => (n && norm(a.name).startsWith(n) ? 0 : 1) - (n && norm(b.name).startsWith(n) ? 0 : 1) || a.name.localeCompare(b.name, 'es'));
    return list.slice(0, 80);
  }
  function hl(name, q) {
    const words = norm(q).trim().split(/\s+/).filter(Boolean); if (!words.length) return esc(name);
    const nn = norm(name), marks = new Array(name.length).fill(false);
    words.forEach((w) => { const i = nn.indexOf(w); if (i >= 0) for (let k = i; k < i + w.length; k++) marks[k] = true; });
    let out = '', open = false;
    for (let i = 0; i < name.length; i++) {
      if (marks[i] && !open) { out += '<mark>'; open = true; } else if (!marks[i] && open) { out += '</mark>'; open = false; }
      out += esc(name[i]);
    }
    return out + (open ? '</mark>' : '');
  }
  const ddInput = () => (FD.key ? document.querySelector(`[data-food="${FD.key}"]`) : null);
  function ddOpen(input) {
    if (FD.el && FD.key === input.dataset.food) { ddPos(); return; }
    ddClose(); FD.key = input.dataset.food; FD.typed = false;
    FD.el = document.createElement('div'); FD.el.id = 'food-dd'; FD.el.className = 'food-dd'; FD.el.setAttribute('role', 'listbox');
    FD.el.addEventListener('mousedown', (e) => e.preventDefault());
    FD.el.addEventListener('click', (e) => { const it = e.target.closest('[data-fid]'); if (it) ddPick(foodById(it.dataset.fid)); });
    document.body.appendChild(FD.el);
    input.setAttribute('aria-expanded', 'true');
    ddUpdate();
  }
  function ddUpdate() {
    const input = ddInput(); if (!FD.el || !input) return ddClose();
    const q = FD.typed ? input.value : '', cur = getP(FD.key)?.foodId;
    FD.items = foodMatches(q);
    FD.idx = Math.max(0, FD.items.findIndex((f) => f.id === cur));
    ddDraw(q); ddPos();
  }
  function ddDraw(q = FD.typed ? (ddInput()?.value || '') : '') {
    const cur = getP(FD.key)?.foodId;
    FD.el.innerHTML = FD.items.length
      ? `<div class="fdd-head">${q ? `${FD.items.length}${FD.items.length === 80 ? '+' : ''} ${FD.items.length === 1 ? 'coincidencia' : 'coincidencias'}` : `${S.foods.length} alimentos`} · por porción de intercambio</div>`
        + FD.items.map((f, i) => `<div class="fdd-item ${i === FD.idx ? 'active' : ''}" role="option" aria-selected="${i === FD.idx}" data-fid="${f.id}">
          <div class="fdd-name">${f.id === cur ? `<span class="fdd-check">${ic('check', 13)}</span>` : ''}<span class="fdd-text">${hl(f.name, q)}</span></div>
          <div class="fdd-meta">${esc(f.porcion || 'Porción')}${f.gpp ? ` · ${fmt(f.gpp)} g` : ' · por unidad'}</div>
          <div class="fdd-mac"><span class="kc">${fmt(f.kcal)} kcal</span><span><span class="kp">P ${fmt(f.p, 1)}</span> · <span class="kcarb">C ${fmt(f.c, 1)}</span> · <span class="kg">G ${fmt(f.g, 1)}</span></span></div></div>`).join('')
      : `<div class="fdd-empty">Sin coincidencias para “${esc(q)}”.<br>Agrégalo en <b>Base de alimentos</b> para usarlo en el menú.</div>`;
    FD.el.querySelector('.fdd-item.active')?.scrollIntoView({ block: 'nearest' });
  }
  function ddPos() {
    const input = ddInput(); if (!FD.el || !input) return ddClose();
    const r = input.getBoundingClientRect(), w = Math.min(Math.max(r.width, 380), window.innerWidth - 16);
    const h = Math.min(340, FD.el.scrollHeight), below = window.innerHeight - r.bottom;
    const top = below < h + 12 && r.top > below ? r.top - h - 6 : r.bottom + 6;
    Object.assign(FD.el.style, { top: `${Math.round(top)}px`, left: `${Math.round(clamp(r.left, 8, window.innerWidth - w - 8))}px`, width: `${Math.round(w)}px` });
  }
  function ddClose() {
    ddInput()?.setAttribute('aria-expanded', 'false');
    FD.el?.remove(); FD.el = null; FD.key = null; FD.items = [];
  }
  function ddPick(f) {
    if (!f || !FD.key) return;
    const key = FD.key, line = getP(key); line.foodId = f.id; line.foodName = f.name;
    const inp = ddInput(); if (inp) { inp.value = f.name; inp.blur(); }
    ddClose(); save(); render();
    const por = document.querySelector(`[data-food="${key}"]`)?.closest('tr')?.querySelector('[data-bind$=".porciones"]');
    if (por) { por.focus(); por.select(); }
  }
  function lineCalc(l) {
    const f = foodById(l.foodId); const por = num(l.porciones) ?? 0;
    if (!f) return { f: null, kcal: 0, p: 0, c: 0, g: 0, gramos: null };
    return { f, kcal: f.kcal * por, p: f.p * por, c: f.c * por, g: f.g * por, gramos: f.gpp ? f.gpp * por : null };
  }
  function optTotals(o) {
    const t = { kcal: 0, p: 0, c: 0, g: 0 };
    (o?.foods || []).forEach((l) => { const x = lineCalc(l); t.kcal += x.kcal; t.p += x.p; t.c += x.c; t.g += x.g; });
    return t;
  }
  function dayTotals(dt) {
    const t = { kcal: 0, p: 0, c: 0, g: 0 };
    dt.meals.forEach((m) => { const o = m.options[m.sel] || m.options[0]; const x = optTotals(o); t.kcal += x.kcal; t.p += x.p; t.c += x.c; t.g += x.g; });
    return t;
  }
  const adq = (v, t) => (t ? (v / t) * 100 : null);
  function adqCls(p) { if (p == null) return 'muted'; const d = Math.abs(p - 100); return d <= 5 ? 'sum-ok' : d <= 10 ? 'kc' : 'sum-bad'; }

  // =====================================================================
  // Cálculos — seguimiento
  // =====================================================================
  const cfgOf = (a) => a.tracking.config;
  const weekCount = (a) => clamp(Math.round(num(cfgOf(a).semanas) ?? 12), 1, 104);
  const weekStart = (a, k) => addDays(cfgOf(a).inicio, 7 * k);
  const weekDays = (a, k) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(a, k), i));
  const weekLabel = (k) => (k === 0 ? 'Semana inicial' : `Semana ${k}`);
  const wk = (a, k) => a.tracking.weeks[k] || {};
  const dailyOf = (a, d) => a.tracking.daily[d] || {};
  // ---- Etapas del proceso (Seguimiento › Configuración) ----
  // Las fechas de las etapas mandan: arman el calendario del registro diario y del seguimiento semanal,
  // y definen la etapa y el % buscado de cada semana. Una semana marcada a mano con otra etapa genera una alerta.
  const stagesOf = (a) => { const c = cfgOf(a); if (!Array.isArray(c.stages)) c.stages = []; return c.stages; };
  const stageFull = (s) => !!s && STAGE_FULL.includes(s.tipo);
  const stageDated = (s) => !!(s && s.tipo && parseISO(s.inicio) && parseISO(s.fin) && s.fin >= s.inicio);
  const dow = (d) => (parseISO(d).getDay() + 6) % 7; // 0 = lunes
  const DOW_L = ['L', 'M', 'X', 'J', 'V', 'S', 'D'], DOW_N = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const stageOfDay = (a, d) => stagesOf(a).find((s) => stageDated(s) && d >= s.inicio && d <= s.fin) || null;
  // Etapa de una semana del registro: la que cubre más días de esa semana (en empate, la primera de la lista).
  function stageOfWeek(a, k) {
    let best = null, bestN = 0;
    const days = weekDays(a, k);
    stagesOf(a).forEach((s) => { if (!stageDated(s)) return; const n = days.filter((d) => d >= s.inicio && d <= s.fin).length; if (n > bestN) { best = s; bestN = n; } });
    return best;
  }
  // % semanal con signo: negativo en etapas de pérdida, positivo en las de ganancia.
  function stageTarget(s) { const v = num(s && s.objetivo); return v == null ? null : GAIN_TYPES.includes(s.tipo) ? Math.abs(v) : -Math.abs(v); }
  function weekEtapa(a, k) {
    const own = wk(a, k).etapa; if (own) return own;
    const s = stageOfWeek(a, k); if (s) return s.tipo;
    return stagesOf(a).some(stageDated) ? 'Sin etapa' : (cfgOf(a).etapa || '');
  }
  // Semana marcada a mano con una etapa distinta de la que dicen las fechas de Configuración.
  function etapaMismatch(a, k) { const own = wk(a, k).etapa, s = stageOfWeek(a, k); return own && s && own !== s.tipo ? s : null; }
  function mismatchWeeks(a) { const out = []; for (let k = 0; k <= weekCount(a); k++) { const s = etapaMismatch(a, k); if (s) out.push({ k, own: wk(a, k).etapa, s }); } return out; }
  // Duración contando el primer y el último día: «12 semanas», «5 semanas y 3 días»…
  function stageDur(s) {
    if (!stageDated(s)) return '';
    const d = daysBetween(s.inicio, s.fin) + 1, w = Math.floor(d / 7), r = d % 7, pl = (n, a1, a2) => `${n} ${n === 1 ? a1 : a2}`;
    return w && r ? `${pl(w, 'semana', 'semanas')} y ${pl(r, 'día', 'días')}` : w ? pl(w, 'semana', 'semanas') : pl(r, 'día', 'días');
  }
  // Calendario del seguimiento = desde el primer día de la primera etapa hasta el último de la última.
  // Si cambia el inicio, los datos de cada semana (fotos, % buscado manual, etapa…) se mueven con sus fechas.
  function syncTimeline(a) {
    if (!a || !a.tracking || !isPlain(a.tracking.config)) return;
    const c = a.tracking.config, st = (Array.isArray(c.stages) ? c.stages : []).filter(stageDated);
    if (!st.length) return;
    const ini = st.map((s) => s.inicio).sort()[0], end = st.map((s) => s.fin).sort().pop();
    const N = clamp(Math.ceil((daysBetween(ini, end) + 1) / 7) - 1, 1, 104);
    if (parseISO(c.inicio) && c.inicio !== ini) {
      const shift = Math.round(daysBetween(c.inicio, ini) / 7);
      if (shift) {
        const w = a.tracking.weeks || {}, out = {};
        Object.keys(w).forEach((k) => { const n = parseInt(k, 10); out[isNaN(n) ? k : String(n - shift)] = w[k]; });
        a.tracking.weeks = out;
      }
    }
    c.inicio = ini; c.semanas = N;
  }
  // Etapas armadas desde la configuración anterior: la etapa configurada cubre el mismo calendario,
  // el mini cut del plan pasa a su etapa y se agregan las que falten (vacías).
  function stagesFromLegacy(t, mc) {
    const c = t.config, N = clamp(Math.round(num(c.semanas) ?? 12), 1, 104), o1 = num(c.obj1);
    const tipo = c.etapa === 'Volumen' ? 'Ganancia de masa muscular' : (c.etapa || 'Pérdida de grasa');
    const first = newStage(tipo, { inicio: parseISO(c.inicio) ? c.inicio : '', fin: parseISO(c.inicio) ? addDays(c.inicio, 7 * (N + 1) - 1) : '',
      pesoInicial: num(c.pesoInicial), pasos: num(c.metaPasos), objetivo: o1 != null ? Math.abs(o1) : null });
    const mini = newStage('Mini cut', isPlain(mc) ? { inicio: mc.inicio || '', fin: mc.termino || '', objetivo: num(mc.pct) } : {});
    return [first, ...['Mini cut', 'Mantenimiento', 'Ganancia de masa muscular'].filter((x) => x !== tipo).map((x) => (x === 'Mini cut' ? mini : newStage(x)))];
  }
  // Conserva el % buscado que cada semana tenía (objetivo inicial y posterior): si el de la etapa no coincide,
  // queda como ajuste manual de esa semana.
  function keepLegacyTargets(t) {
    const c = t.config, a = { tracking: t }, N = weekCount(a);
    for (let k = 1; k <= N; k++) {
      const w = t.weeks[k]; if (isPlain(w) && num(w.buscado) != null) continue;
      const old = k < (num(c.cambio) ?? 5) ? num(c.obj1) : num(c.obj2);
      if (old != null && old !== stageTarget(stageOfWeek(a, k))) (t.weeks[k] = isPlain(w) ? w : {}).buscado = old;
    }
  }
  // Alertas de fechas: etapas invertidas, superpuestas, con días sin etapa, que empiezan a mitad de semana
  // y semanas marcadas con otra etapa en el registro.
  function stageAlerts(a) {
    const out = [], st = stagesOf(a), name = (s) => `«${esc(s.tipo)}» (etapa ${st.indexOf(s) + 1})`;
    st.forEach((s) => { if (s.tipo && parseISO(s.inicio) && parseISO(s.fin) && s.fin < s.inicio) out.push(`${name(s)}: la fecha final es anterior a la inicial.`); });
    const dated = st.filter(stageDated).slice().sort((x, y) => (x.inicio < y.inicio ? -1 : x.inicio > y.inicio ? 1 : 0));
    for (let i = 1; i < dated.length; i++) {
      const p = dated[i - 1], s = dated[i];
      if (s.inicio <= p.fin) out.push(`${name(p)} y ${name(s)} se superponen del ${fmtDate(s.inicio)} al ${fmtDate(s.fin < p.fin ? s.fin : p.fin)}.`);
      else if (daysBetween(p.fin, s.inicio) > 1) { const n = daysBetween(p.fin, s.inicio) - 1; out.push(`Entre ${name(p)} y ${name(s)} quedan ${n} ${n === 1 ? 'día' : 'días'} sin etapa (${fmtDate(addDays(p.fin, 1))} – ${fmtDate(addDays(s.inicio, -1))}).`); }
    }
    const c0 = cfgOf(a).inicio;
    dated.forEach((s) => {
      if (s.inicio === c0 || !parseISO(c0)) return;
      const off = daysBetween(c0, s.inicio);
      if (off > 0 && off % 7) { const k = Math.floor(off / 7), ow = stageOfWeek(a, k); out.push(`${name(s)} empieza un ${DOW_N[dow(s.inicio)].toLowerCase()}, a mitad de la ${weekLabel(k).toLowerCase()} del registro (que parte el ${fmtDate(weekStart(a, k))}): esa semana queda como «${esc(ow ? ow.tipo : '—')}».`); }
    });
    const pm = planifMismatch(a), pf = planifOf(a);
    if (pm) out.push(pm.kind !== 'dates' ? `Plan › Planificación indica la etapa «${esc(pf.objetivo)}», que no está en esta lista.`
      : `Plan › Planificación indica «${esc(pf.objetivo)}» del ${rangeTxt(pf.inicio, pf.termino)}, pero aquí la etapa ${pm.i + 1} va del ${rangeTxt(pm.s.inicio, pm.s.fin)}.`);
    const mm = mismatchWeeks(a);
    if (mm.length) out.push(`${mm.length === 1 ? 'Una semana está marcada' : `${mm.length} semanas están marcadas`} en el seguimiento con otra etapa que la de estas fechas: ${mm.slice(0, 6).map((x) => `${weekLabel(x.k)} («${esc(x.own)}»; según fechas «${esc(x.s.tipo)}»)`).join(', ')}${mm.length > 6 ? '…' : ''}. El % buscado sigue las fechas de Configuración.`);
    return out;
  }
  function weekWeights(a, k) { return weekDays(a, k).map((d) => num(dailyOf(a, d).peso)).filter((v) => v != null); }
  function pesoInicial(a) { const s0 = stageOfWeek(a, 0); return num(s0 && s0.pesoInicial) ?? num(cfgOf(a).pesoInicial) ?? num(a.q.peso) ?? num(a.req.peso); }
  function weekAvg(a, k) { const w = weekWeights(a, k); if (w.length) return mean(w); return k === 0 ? pesoInicial(a) : null; }
  function buscado(a, k) {
    if (k === 0) return null;
    const own = num(wk(a, k).buscado); if (own != null) return own;
    return stageTarget(stageOfWeek(a, k)); // el de la etapa que, según sus fechas, cubre la semana
  }
  function logrado(a, k) {
    if (k === 0) return null;
    const cur = weekAvg(a, k); const prev = weekAvg(a, k - 1);
    return cur != null && prev ? ((cur - prev) / prev) * 100 : null;
  }
  function status(a, k) {
    const l = logrado(a, k), b = buscado(a, k), tol = num(cfgOf(a).tol) ?? 0.25;
    if (k === 0) return { key: 'none', label: 'Semana base', msg: 'La semana inicial fija el punto de partida.' };
    if (l == null) return { key: 'none', label: 'Faltan datos', msg: 'Se necesita el promedio de esta semana y de la anterior.' };
    if (b == null) return { key: 'none', label: 'Sin meta', msg: 'Define el % buscado para esta semana.' };
    const d = l - b;
    if (Math.abs(d) <= tol) return { key: 'ok', label: 'En ritmo', msg: 'Mantén el plan actual: el cambio está dentro de la tolerancia.' };
    if (b < 0) return l < b
      ? { key: 'warn', label: 'Muy rápido', msg: 'Baja más rápido que el objetivo: riesgo de perder masa muscular. Evalúa subir calorías.' }
      : { key: 'bad', label: 'Lento', msg: 'Por debajo del ritmo. Si la adherencia es menor a 4, el problema es la adherencia, no la dieta.' };
    if (b > 0) return l > b
      ? { key: 'warn', label: 'Muy rápido', msg: 'Sube más rápido que el objetivo: probable exceso de ganancia de grasa.' }
      : { key: 'bad', label: 'Lento', msg: 'Ganancia por debajo de lo buscado. Revisa adherencia y evalúa subir calorías.' };
    return { key: 'warn', label: d > 0 ? 'Por encima' : 'Por debajo', msg: 'El peso se aleja del mantenimiento buscado.' };
  }
  // Días de la semana con pasos registrados (para indicar si el promedio está incompleto).
  function weekStepsDays(a, k) { return weekDays(a, k).filter((d) => num(dailyOf(a, d).pasos) != null).length; }
  const stepsIncomplete = (a, k) => { const n = weekStepsDays(a, k); return n > 0 && n < 7 ? 7 - n : 0; };
  function weekSteps(a, k) {
    const st = weekDays(a, k).map((d) => num(dailyOf(a, d).pasos)).filter((v) => v != null);
    return st.length ? mean(st) : num(wk(a, k).pasos);
  }
  function currentWeek(a) { const d = daysBetween(cfgOf(a).inicio, todayISO()); return clamp(Math.floor(d / 7), 0, weekCount(a)); }
  function lastWeight(a) {
    const days = Object.keys(a.tracking.daily).filter((d) => num(a.tracking.daily[d].peso) != null).sort();
    return days.length ? { d: days[days.length - 1], v: num(a.tracking.daily[days[days.length - 1]].peso) } : null;
  }
  const sumPl = (w) => { const v = ['tri', 'sub', 'supra', 'abd'].map((k) => num(w[k])); return v.some((x) => x != null) ? sum(v) : null; };
  const sumAbd = (w) => { const a = num(w.sobre), b = num(w.bajo); return a != null || b != null ? (a || 0) + (b || 0) : null; };

  // Campos que se anotan día a día en el Registro diario (antes vivían en el Seguimiento semanal).
  // [campo, etiqueta, mín, máx, invertida]: en estrés el valor alto es el malo.
  const SCALES = [['adh', 'Adherencia', 0, 5], ['sueno', 'Sueño', 0, 5], ['estres', 'Estrés', 0, 5, true], ['saciedad', 'Saciedad', 0, 5], ['energia', 'Energía entreno', 0, 5]];
  // Color de un valor de escala: rojo en el peor extremo, verde en el mejor, con la gama intermedia.
  function scaleColor(v, min, max, rev) {
    if (v == null || !isFinite(v)) return null;
    let t = clamp((v - min) / (max - min), 0, 1); if (rev) t = 1 - t;
    return `hsl(${Math.round(t * 131)} 70% 52%)`;
  }
  // Hambre después de las comidas (1-7): el mejor punto está al medio, según la definición de cada valor.
  // 4-5 satisfecho (verde), 3 hambre tolerable (verde amarillento), 2 y 6 incómodo (naranjo), 1 y 7 extremos (rojo).
  const HUNGER_DEF = { 1: 'Hambre extrema, poca energía', 2: 'Hambre incómoda, distraído, irritable', 3: 'Hambriento, sin llegar a incomodar', 4: 'Satisfecho, podría comer un poco más', 5: 'Satisfecho, sin incomodidad', 6: 'Incómodamente lleno', 7: 'Lleno hasta la incomodidad, posibles náuseas' };
  const HUNGER_HUE = { 1: 0, 2: 24, 3: 78, 4: 118, 5: 131, 6: 28, 7: 0 };
  function hungerColor(v) {
    if (v == null || !isFinite(v)) return null;
    const x = clamp(v, 1, 7), lo = Math.floor(x), hi = Math.ceil(x);
    const h = HUNGER_HUE[lo] + (HUNGER_HUE[hi] - HUNGER_HUE[lo]) * (x - lo); // promedios: entre los dos valores vecinos
    return `hsl(${Math.round(h)} 70% 52%)`;
  }
  const scaleMeta = (f) => SCALES.find(([k]) => k === f) || (/^h\d+$/.test(f) ? [f, 'Hambre', 1, 7, 'hunger'] : null);
  const metaColor = (m, v) => (m[4] === 'hunger' ? hungerColor(v) : scaleColor(v, m[2], m[3], m[4]));
  const SKINFOLDS = [['tri', 'Tríceps'], ['sub', 'Subescapular'], ['supra', 'Suprailíaco'], ['abd', 'Abdominal']];
  const PERIMS = [['pecho', '1. Pecho'], ['brazo', '2/3. Brazos'], ['sobre', '4. 3 dedos sobre ombligo'], ['bajo', '6. 3 dedos bajo ombligo'], ['cadera', '7. Cadera'], ['muslo', '8/9. Muslos']];
  const DAILY_MOVED = new Set([...SCALES, ...SKINFOLDS, ...PERIMS].map(([f]) => f));
  // Promedio semanal de un campo diario y cuántos de los 7 días tienen dato.
  function weekField(a, k, f) {
    const vals = weekDays(a, k).map((d) => num(dailyOf(a, d)[f])).filter((v) => v != null);
    return { avg: vals.length ? mean(vals) : null, n: vals.length };
  }
  // Pliegues y perímetros de la semana (promedio de los días medidos), para totales y gráficos.
  function weekMeasures(a, k) { const o = {}; [...SKINFOLDS, ...PERIMS].forEach(([f]) => { o[f] = weekField(a, k, f).avg; }); return o; }
  // Columnas de hambre: tantas como comidas tenga el tipo de día con más comidas.
  function mealCols(a) {
    const refDay = a.dayTypes.reduce((b, d) => (!b || d.meals.length > b.meals.length ? d : b), null);
    const nMeals = Math.max(1, refDay ? refDay.meals.length : 0);
    const head = (h) => { const m = refDay && refDay.meals[h - 1]; return m && m.name && m.name.trim().toLowerCase() !== `comida ${h}` ? `${h}. ${esc(m.name)}` : `Comida ${h}`; };
    return { idx: Array.from({ length: nMeals }, (_, i) => i + 1), head };
  }
  // Aviso de promedio incompleto: n de 7 días con dato.
  const incMini = (n) => (n > 0 && n < 7 ? `<span class="inc-mini" title="Promedio parcial: ${n} de 7 días registrados, faltan ${7 - n}">${n}/7</span>` : '');
  // Datos antiguos del semanal (escalas, hambre, pliegues, perímetros, comentarios) pasan al primer día de su semana.
  function moveWeeklyToDaily(t) {
    Object.keys(t.weeks).forEach((k) => {
      const w = t.weeks[k]; if (!isPlain(w)) return;
      const keys = Object.keys(w).filter((f) => DAILY_MOVED.has(f) || /^h\d+$/.test(f) || f === 'com');
      if (!keys.length) return;
      const day = addDays(t.config.inicio, 7 * (parseInt(k, 10) || 0));
      const dd = isPlain(t.daily[day]) ? t.daily[day] : (t.daily[day] = {});
      keys.forEach((f) => {
        const v = w[f]; delete w[f];
        if (v == null || v === '') return;
        if (f === 'com') { const n = String(dd.nota || ''); if (!n.includes(String(v))) dd.nota = n ? `${n} · ${v}` : String(v); }
        else if (dd[f] == null || dd[f] === '') dd[f] = v;
      });
    });
    return t;
  }
  const pillCls = { ok: 'ok', warn: 'warn', bad: 'bad', none: '' };

  // =====================================================================
  // Router y render
  // =====================================================================
  // La ruta vive en memoria (el visor de Artifacts no expone rutas en la URL); se recuerda por navegador.
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* almacenamiento bloqueado */ } };
  // Apariencia (preferencia de este navegador): modo oscuro o claro y, en claro, paleta Coral o Pizarra.
  // Solo cambia colores: se aplica con atributos en <html> que leen las variables de styles.css.
  const THEME_KEY = 'prepcoach-theme';
  const PALETTES = {
    coral: { name: 'Coral', desc: 'Crema, beige y coral', prev: { bg: '#f5f2ec', card: '#ece8e0', acc: '#ef6b57', ink: '#1e1b17', btn: '#1e1b17' } },
    slate: { name: 'Pizarra', desc: 'Grises fríos, blanco y pizarra', prev: { bg: '#e9ecee', card: '#ffffff', acc: '#4d6c73', ink: '#111619', btn: '#1b2427' } },
  };
  const DARK_PREV = { bg: '#0a0c0f', card: '#13171c', acc: '#d8b15f', ink: '#e8ebf0', btn: '#d8b15f' };
  let THEME = (() => {
    try { const t = JSON.parse(lsGet(THEME_KEY) || 'null'); if (t && (t.mode === 'light' || t.mode === 'dark')) return { mode: t.mode, palette: PALETTES[t.palette] ? t.palette : 'coral' }; } catch { /* valor dañado */ }
    return { mode: 'dark', palette: 'coral' };
  })();
  function applyTheme() {
    const r = document.documentElement;
    if (THEME.mode === 'light') { r.setAttribute('data-pc-theme', 'light'); r.setAttribute('data-pc-palette', THEME.palette); }
    else { r.removeAttribute('data-pc-theme'); r.removeAttribute('data-pc-palette'); }
  }
  function setTheme(p) { THEME = { ...THEME, ...p }; lsSet(THEME_KEY, JSON.stringify(THEME)); applyTheme(); }
  applyTheme();
  const themeLabel = () => (THEME.mode === 'light' ? `Claro · ${PALETTES[THEME.palette].name}` : 'Oscuro');
  const themeBtn = () => `<button class="btn sm icon ghost theme-btn" data-action="openTheme" title="Apariencia: ${themeLabel()}" aria-label="Apariencia: ${themeLabel()}">${ic(THEME.mode === 'light' ? 'sun' : 'moon', 15)}</button>`;
  // Seguimiento es un apartado propio ('seg'); la ruta antigua 'plan/seg' se redirige.
  const normRoute = (r) => (r === 'plan/seg' || (r || '').startsWith('plan/seg/') ? 'seg' : r);
  let curRoute = normRoute(lsGet('prepcoach-route')) || 'inicio';
  // Comidas contraídas en el menú (preferencia de este navegador).
  const collapsed = new Set((() => { try { return JSON.parse(lsGet('prepcoach-collapsed') || '[]'); } catch { return []; } })());
  const saveCollapsed = () => lsSet('prepcoach-collapsed', JSON.stringify([...collapsed]));
  const route = () => curRoute.split('/');
  function go(r) {
    r = normRoute(r); closeDrawer(false);
    if (CLIENT && !r.startsWith('cliente')) r = 'cliente/plan';
    if (T.preview && !r.startsWith('cliente')) T.preview = false;
    curRoute = r; if (!T.preview) lsSet('prepcoach-route', r); render(); window.scrollTo(0, 0);
  }
  const isClientView = () => CLIENT || T.preview;

  // ---- Inicio de sesión del profesional ----
  // Credenciales provisorias, guardadas como huella SHA-256 (no en texto plano).
  const AUTH_HASH = '524afd342116ef9cf20885d3407fccae15b9591485a15f9e05af655d00b7ee62';
  const AUTH_KEY = 'prepcoach-auth';
  function sha256(text) {
    const rr = (v, n) => (v >>> n) | (v << (32 - n));
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const bytes = new TextEncoder().encode(text), len = bytes.length, size = ((len + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(size); buf.set(bytes); buf[len] = 0x80;
    const dv = new DataView(buf.buffer); dv.setUint32(size - 4, (len * 8) >>> 0); dv.setUint32(size - 8, Math.floor((len * 8) / 4294967296));
    const w = new Uint32Array(64);
    for (let o = 0; o < size; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  const ssGet = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
  const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* bloqueado */ } };
  let AUTH = lsGet(AUTH_KEY) === AUTH_HASH || ssGet(AUTH_KEY) === AUTH_HASH;
  let ROLE_PENDING = false; // en el Artifact, mientras se averigua si quien abre es el dueño o un cliente
  const PRO_NAME = 'Cesar';
  function tryLogin(user, pass, remember) {
    const h = sha256(`prepcoach|${norm(user).trim()}|${pass}`);
    if (h !== AUTH_HASH) return false;
    AUTH = true;
    if (remember) lsSet(AUTH_KEY, h); else ssSet(AUTH_KEY, h);
    return true;
  }
  function logout() {
    AUTH = false; T.preview = false;
    try { localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_KEY); } catch { /* bloqueado */ }
    curRoute = 'inicio'; lsSet('prepcoach-route', 'inicio');
    closeModal(); render(); window.scrollTo(0, 0);
  }
  let sbCollapsed = lsGet('prepcoach-sb') === '1';
  // Alto real de la barra superior (cambia en el teléfono), para fijar el total diario justo debajo.
  (() => { const tb = document.querySelector('.topbar'); if (!tb) return;
    const setH = () => document.documentElement.style.setProperty('--topbar-h', tb.getBoundingClientRect().height + 'px');
    setH(); try { new ResizeObserver(setH).observe(tb); } catch { window.addEventListener('resize', setH); } })();
  // Cajón del panel lateral (pantallas angostas): bloquea el contenido detrás y devuelve el foco al cerrar.
  function openDrawer() {
    document.body.classList.add('drawer-open');
    const main = $('#plan-main'); if (main) main.inert = true;
    $('.sb-toggle')?.setAttribute('aria-expanded', 'true');
    setTimeout(() => ($('.sidebar .sb-item.active') || $('.sidebar .sb-item'))?.focus(), 60);
  }
  function closeDrawer(restoreFocus = true) {
    if (!document.body.classList.contains('drawer-open')) return;
    document.body.classList.remove('drawer-open');
    const main = $('#plan-main'); if (main) main.inert = false;
    const t = $('.sb-toggle'); t?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) t?.focus();
  }
  let renderQueued = false;
  function scheduleRender() { if (renderQueued) return; renderQueued = true; queueMicrotask(() => { renderQueued = false; render(); }); }

  function render() {
    const act = document.activeElement;
    let fk = null, sel = null, raw = null;
    if (act && act.dataset && (act.dataset.bind || act.dataset.food || act.dataset.grams || act.dataset.date || act.dataset.mg)) {
      fk = act.dataset.bind ? `[data-bind="${act.dataset.bind}"]` : act.dataset.food ? `[data-food="${act.dataset.food}"]` : act.dataset.date ? `[data-date="${act.dataset.date}"]` : act.dataset.mg ? `[data-mg="${act.dataset.mg}"]` : `[data-grams="${act.dataset.grams}"]`;
      raw = act.value;
      try { sel = [act.selectionStart, act.selectionEnd]; } catch { sel = null; }
    }
    renderHeader();
    if (S.activeId) lsSet('prepcoach-active', S.activeId);
    const [r0, r1v] = route();
    let html;
    // Sin sesión iniciada el profesional solo ve el inicio de sesión (los clientes con enlace no lo necesitan).
    // Si la pantalla ya está, no se redibuja para no borrar lo que se está escribiendo.
    if (!CLIENT && !AUTH && !ROLE_PENDING) {
      if ($('#login-form')) return;
      $('#app').innerHTML = viewLogin();
      setTimeout(() => $('#login-user')?.focus(), 0);
      return;
    }
    if (!ready) html = viewLoading();
    else if (isClientView()) html = viewClient();
    else if (r0 === 'pg') html = viewPG();
    else if (!A()) html = viewEmpty();
    else if (r0 === 'cuestionario') html = viewQ();
    else if (r0 === 'plan') html = viewPlan(r1v || 'req');
    else if (r0 === 'seg') html = viewSegSection();
    else if (r0 === 'acceso') html = viewAccess();
    else html = viewHome();
    if (loadNote) html = `<div class="callout info" style="margin-bottom:16px">${esc(loadNote)}</div>` + html;
    // Conserva el desplazamiento de la página y de las tablas al redibujar en la misma vista
    // (por ejemplo, al elegir un valor en una tabla que se movió hacia el lado).
    const view = curRoute + '|' + (A() ? A().id + '|' + A().ui.trackTab : '');
    const scrollers = view === lastView ? [...$('#app').querySelectorAll(SCROLLERS)].map((el) => [el.scrollLeft, el.scrollTop]) : null;
    const winY = window.scrollY, winX = window.scrollX;
    $('#app').innerHTML = html;
    if (document.querySelector('.mn-land')) fitPreviewSheets();
    if (scrollers) {
      [...$('#app').querySelectorAll(SCROLLERS)].forEach((el, i) => { if (scrollers[i]) { el.scrollLeft = scrollers[i][0]; el.scrollTop = scrollers[i][1]; } });
      if (window.scrollY !== winY || window.scrollX !== winX) window.scrollTo(winX, winY);
    }
    lastView = view;
    syncDatalist();
    updateQSpy();
    if (FD.el && !(fk && fk.startsWith('[data-food="' + FD.key + '"'))) ddClose();
    if (fk) {
      const el = $(fk);
      if (el) {
        el.focus({ preventScroll: true });
        if (el.tagName !== 'SELECT') {
          if (raw != null && el.value !== raw) el.value = raw;
          if (sel && sel[0] != null) { try { el.setSelectionRange(sel[0], sel[1]); } catch { /* inputs sin selección */ } }
        }
      }
    }
  }
  const SCROLLERS = '.table-wrap, .week-table-wrap, .sb-nav';
  let lastView = '';

  // Marca en el índice lateral del cuestionario la sección que se está leyendo.
  function updateQSpy() {
    const idx = $('.q-index'); if (!idx) return;
    const secs = [...document.querySelectorAll('.q-section')]; if (!secs.length) return;
    let cur = secs[0].id;
    for (const s of secs) if (s.getBoundingClientRect().top <= 140) cur = s.id;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = secs[secs.length - 1].id;
    idx.querySelectorAll('a[data-id]').forEach((a) => {
      const on = a.dataset.id === cur;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }
  let spyQueued = false;
  window.addEventListener('scroll', () => { if (spyQueued) return; spyQueued = true; requestAnimationFrame(() => { spyQueued = false; updateQSpy(); }); }, { passive: true });

  let dlVersion = -1;
  function syncDatalist() {
    const v = S.foods.length + S.foods.map((f) => f.name).join('|').length;
    if (v === dlVersion) return; dlVersion = v;
    $('#dl-foods').innerHTML = S.foods.map((f) => `<option value="${esc(f.name)}">${esc(f.porcion || (f.gpp ? f.gpp + ' g' : ''))}</option>`).join('');
  }

  function renderHeader() {
    const [r0] = route();
    if (!CLIENT && !AUTH) { $('#mainnav').innerHTML = ''; $('#topbar-right').innerHTML = themeBtn(); return; }
    if (CLIENT) {
      // El cliente solo ve su portal: sin selector de atletas ni respaldos.
      $('#mainnav').innerHTML = '';
      $('#topbar-right').innerHTML = `<span class="save-state" id="save-state"><span class="dot"></span>Sincronizado</span>
        ${A() && A().q.nombre ? `<span class="pill gold">${esc(A().q.nombre)}</span>` : ''}${themeBtn()}`;
      setSaveState(saveState);
      return;
    }
    // En el inicio los tres apartados ya están como recuadros: el menú superior solo aparece dentro de un apartado,
    // para cambiar de uno a otro sin volver al inicio.
    // Población general es un apartado totalmente aparte: dentro de él solo se muestra el botón de Inicio,
    // y no aparece en el menú de los apartados del atleta.
    // En Acceso del cliente tampoco se repiten los apartados: solo el botón de Inicio.
    const inSection = ['cuestionario', 'plan', 'seg', 'pg', 'acceso'].includes(r0), isPG = r0 === 'pg';
    $('#mainnav').innerHTML = inSection && (A() || isPG) ? (isPG || r0 === 'acceso' ? [['inicio', 'Inicio']] : [['inicio', 'Inicio'], ['cuestionario', 'Cuestionario inicial'], ['plan', 'Plan'], ['seg', 'Seguimiento']])
      .map(([k, l]) => `<a href="#/${k}" class="${r0 === k ? 'active' : ''}">${k === 'inicio' ? ic('chevL', 14) + ' ' : ''}${l}</a>`).join('') : '';
    const a = A();
    $('#topbar-right').innerHTML = `
      <span class="save-state" id="save-state"><span class="dot"></span>Guardado</span>
      ${S.athletes.length && !isPG ? `<select class="select" id="athlete-select" style="width:auto;min-width:180px;height:34px" title="Atleta activo">
        ${S.athletes.map((x) => `<option value="${x.id}" ${a && x.id === a.id ? 'selected' : ''}>${esc(x.q.nombre || 'Sin nombre')}</option>`).join('')}
      </select>` : ''}
      ${isPG ? '' : `<button class="btn sm primary" data-action="newAthlete">${ic('plus', 14)} Atleta</button>`}
      <button class="btn sm icon ghost" data-action="exportJSON" title="Exportar respaldo (JSON)">${ic('down', 15)}</button>
      <button class="btn sm icon ghost" data-action="importJSON" title="Importar respaldo (JSON)">${ic('up', 15)}</button>
      ${themeBtn()}
      <button class="btn sm ghost logout-btn" data-action="logout" title="Cerrar sesión de ${esc(PRO_NAME)}">${ic('logout', 15)}<span>Salir</span></button>`;
    setSaveState(saveState);
  }

  // =====================================================================
  // Vistas — inicio
  // =====================================================================
  function viewLoading() {
    return CLIENT ? viewClientStatus() : `<div class="card empty"><div class="e-ic">${ic('db', 30)}</div><h2>Cargando tus atletas…</h2><p>Conectando con la base de datos sincronizada.</p></div>`;
  }
  function viewEmpty() {
    return `${homeHead(null)}
    <div class="card card-pad row" style="justify-content:space-between;margin-bottom:18px">
      <div><b>Crea tu primer atleta</b><div class="small muted">Con un atleta activo se habilitan el cuestionario, la planificación y el seguimiento.</div></div>
      <button class="btn primary" data-action="newAthlete">${ic('plus', 15)} Crear atleta</button>
    </div>
    ${launchGrid(null)}`;
  }

  const Q_SECTIONS = [
    ['q-datos', 'Datos básicos', (q) => !!(q.nombre && q.peso)],
    ['q-obj', 'Objetivo', (q) => q.motivo.length > 0 || !!q.motivoDetalle],
    ['q-sup', 'Suplementación', (q) => q.suplementos.some((s) => s.cual)],
    ['q-act', 'Nivel de actividad física', (q) => !!(q.pasos || q.nivel)],
    ['q-peri', 'Nutrición peri-entrenamiento', (q) => Object.values(q.peri || {}).some(Boolean)],
    ['q-rec', 'Recordatorio de 24 h', (q) => q.rec.some((r) => r.ej1 || r.horario)],
    ['q-tend', 'Tendencia de consumo', (q) => Object.values(q.tend || {}).some(Boolean)],
    ['q-frec', 'Frecuencia de consumo', (q) => Object.values(q.frec || {}).some((x) => x && (x.consume || x.frec))],
  ];

  // ---- Inicio de sesión ----
  function viewLogin() {
    return `<div class="login-wrap">
      <section class="card login-card" aria-labelledby="login-title">
        <div class="login-brand"><span class="brand-mark login-mark">P</span>
          <div><div class="eyebrow">PrepCoach</div><h1 id="login-title">Inicio de sesión</h1><p class="muted">Acceso del preparador</p></div></div>
        <form id="login-form" class="login-form" novalidate>
          <div class="field"><label for="login-user">Nombre</label>
            <input class="input" id="login-user" name="username" autocomplete="username" autocapitalize="words" spellcheck="false" required></div>
          <div class="field"><label for="login-pass">Contraseña</label>
            <div class="pass-wrap"><input class="input" id="login-pass" name="password" type="password" autocomplete="current-password" required>
              <button type="button" class="pass-eye" data-action="togglePass" aria-label="Mostrar contraseña" aria-pressed="false">${ic('eye', 16)}</button></div></div>
          <label class="chip login-remember"><input type="checkbox" id="login-remember" checked><span class="box"></span>Mantener la sesión iniciada en este navegador</label>
          <div class="login-error" id="login-error" role="alert" hidden></div>
          <button class="btn primary login-btn" type="submit">Ingresar ${ic('arrowR', 16)}</button>
        </form>
      </section>
      <p class="login-foot small muted">Tus clientes no pasan por aquí: entran directo a su portal con su enlace personal.</p>
    </div>`;
  }

  // ---- Menú inicial: los tres apartados del atleta activo ----
  function homeHead(a) {
    const initials = a ? (a.q.nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') : '';
    const rc = a ? reqCalc(a) : null;
    const meta = a ? [rc.e.edad != null ? rc.e.edad + ' años' : null, weekEtapa(a, currentWeek(a)), `${S.athletes.length} ${S.athletes.length === 1 ? 'atleta' : 'atletas'} en total`].filter(Boolean).map(esc).join(' · ') : '';
    // Botón al acceso del cliente (bajo «Cambiar o gestionar»), con un punto que indica su estado.
    const acc = !a ? null : linkedUid(a) ? ['ok', 'Conectado'] : a.portal.token ? ['warn', 'Esperando al cliente'] : ['none', 'Sin enlace'];
    return `<div class="home-head">
      <div class="home-hello">
        <div class="eyebrow">Hola, ${esc(PRO_NAME)}</div>
        <h1 class="page-title">¿Qué vas a trabajar hoy?</h1>
        <div class="page-sub">Cuestionario, Plan y Seguimiento comparten los datos del atleta activo: lo que cambies en uno se refleja en los demás. Población general funciona por separado.</div>
      </div>
      ${a ? `<div class="card athlete-bar">
        <span class="avatar sm">${esc(initials)}</span>
        <div class="ab-text"><span class="ab-label">Atleta activo</span><b>${esc(a.q.nombre || 'Sin nombre')}</b><span class="small muted">${meta}</span></div>
        <div class="ab-actions">
          <button class="btn sm" data-action="manageAthletes">${ic('user', 14)} Cambiar o gestionar</button>
          <button class="btn sm primary" data-action="newAthlete">${ic('plus', 14)} Nuevo atleta</button>
          <a class="btn sm ab-access" href="#/acceso" title="Acceso del cliente · ${acc[1]}" aria-label="Acceso del cliente (${acc[1]})">${ic('link', 14)} Acceso del cliente <span class="ab-dot ${acc[0]}" aria-hidden="true"></span></a>
        </div>
      </div>` : ''}
    </div>`;
  }

  function launchCard(o) {
    const title = o.disabled ? `<span class="lc-link">${o.title}</span>` : `<a class="lc-link" href="${o.href}">${o.title}</a>`;
    return `<article class="card launch-card ${o.disabled ? 'is-disabled' : ''}" style="--lc:${o.color}">
      <div class="lc-top"><span class="lc-ic">${ic(o.icon, 22)}</span><span class="lc-num">${o.n}</span></div>
      <h2>${title}</h2>
      <p class="lc-desc">${o.desc}</p>
      ${o.status ? `<div class="lc-status">${o.status}</div>` : ''}
      ${o.chips && !o.disabled ? `<div class="lc-chips">${o.chips}</div>` : ''}
      <div class="lc-cta">${o.disabled ? 'Crea un atleta para empezar' : `${o.cta} ${ic('arrowR', 16)}`}</div>
    </article>`;
  }

  function launchGrid(a) {
    const dis = !a;
    let qStatus = '', pStatus = '', sStatus = '', qChips = '', pChips = '', sChips = '';
    if (a) {
      const q = a.q, done = Q_SECTIONS.filter((s) => s[2](q)).length, next = Q_SECTIONS.find((s) => !s[2](q));
      qStatus = `<div class="q-progress"><div class="progress"><span style="width:${(done / Q_SECTIONS.length) * 100}%"></span></div><span class="small muted nowrap">${done} de ${Q_SECTIONS.length} secciones</span></div>`;
      qChips = next ? `<a class="lc-chip" href="#/cuestionario" data-action="goQ" data-id="${next[0]}">Continuar en: ${next[1]}</a>` : '<span class="pill ok">Cuestionario completo</span>';
      const rc = reqCalc(a);
      pStatus = `<div class="lc-rows">${a.dayTypes.map((dt) => { const t = dayTargets(a, dt, rc), tot = dayTotals(dt), p = adq(tot.kcal, t.kcal); return `<div class="lc-row"><span><span class="color-dot" style="background:${dt.color}"></span> ${esc(dt.name)}</span><span><b class="kc">${t.kcal != null ? fmt(t.kcal) + ' kcal' : '—'}</b>${p != null ? ` <span class="small ${adqCls(p)}">menú ${fmt(p)}%</span>` : ''}</span></div>`; }).join('')}</div>`;
      pChips = [['req', 'Requerimientos'], ['menu', 'Menú diario'], ['dist', 'Distribución'], ['alimentos', 'Base de alimentos']].map(([k, l]) => `<a class="lc-chip" href="#/plan/${k}">${l}</a>`).join('');
      const cw = currentWeek(a), lw = lastWeight(a);
      let st = null; for (let k = Math.min(cw, weekCount(a)); k >= 1; k--) { const s = status(a, k); if (s.key !== 'none') { st = s; break; } }
      sStatus = `<div class="lc-rows">
        <div class="lc-row"><span>Semana</span><b>${cw} / ${weekCount(a)}</b></div>
        <div class="lc-row"><span>Último peso</span><b>${lw ? `${fmt(lw.v, 1)} kg <span class="small muted">${fmtDate(lw.d, true)}</span>` : '—'}</b></div>
        <div class="lc-row"><span>Estado</span>${st ? `<span class="pill ${pillCls[st.key]}">${st.label}</span>` : '<span class="pill">Sin datos</span>'}</div>
        <div class="lc-row"><span>Portal del cliente</span>${linkedUid(a) ? '<span class="pill ok">Conectado</span>' : a.portal.token ? '<span class="pill warn">Enlace enviado</span>' : '<span class="pill">Sin acceso</span>'}</div>
      </div>`;
      sChips = [['panel', 'Panel'], ['diario', 'Registro diario'], ['semanal', 'Semanal'], ['guia', 'Instrucciones']].map(([k, l]) => `<button type="button" class="lc-chip" data-action="trackTab" data-v="${k}">${l}</button>`).join('');
    }
    const pgN = (S.pg && S.pg.clients || []).length;
    const pgCard = launchCard({ n: '04', icon: 'people', color: 'var(--c-g)', title: 'Población general', href: '#/pg',
      desc: 'Abordaje nutricional para población general, con su propio enfoque. Es independiente de los atletas: no comparte datos con los otros apartados.',
      status: `<div class="lc-rows"><div class="lc-row"><span>Estado</span><span class="pill">${pgN ? pgN + ' registrados' : 'En blanco'}</span></div><div class="lc-row"><span>Portal del cliente</span><span class="pill">Espacio propio (reservado)</span></div></div>`,
      cta: 'Abrir población general' });
    return `<div class="launch-grid">
      ${launchCard({ n: '01', icon: 'clip', color: 'var(--accent)', title: 'Cuestionario inicial', href: '#/cuestionario', desc: 'Datos básicos, objetivo, suplementación, actividad física, nutrición peri-entrenamiento, recordatorio de 24 h y consumo.', status: qStatus, chips: qChips, cta: 'Abrir cuestionario', disabled: dis })}
      ${launchCard({ n: '02', icon: 'target', color: 'var(--c-c)', title: 'Plan', href: '#/plan/req', desc: 'Requerimientos, distribución de comidas y menú diario por tipo de día, con la base de alimentos.', status: pStatus, chips: pChips, cta: 'Abrir planificación', disabled: dis })}
      ${launchCard({ n: '03', icon: 'chart', color: 'var(--ok)', title: 'Seguimiento', href: '#/seg', desc: 'Panel de progreso, registro diario, seguimiento semanal, instrucciones y configuración.', status: sStatus, chips: sChips, cta: 'Abrir seguimiento', disabled: dis })}
      ${pgCard}
    </div>`;
  }

  // ---- Población general: apartado independiente, por ahora en blanco ----
  function viewPG() {
    return `<div class="plan-layout ${sbCollapsed ? 'sb-collapsed' : ''}">
      <aside class="sidebar" id="plan-sidebar" aria-label="Secciones de población general">
        <div class="sb-head"><div class="sb-athlete"><span class="avatar sm">${ic('people', 16)}</span><div class="sb-ath-text"><b>Población general</b><span>Apartado independiente</span></div></div>
          <button class="btn xs ghost icon sb-close" data-action="closeDrawer" aria-label="Cerrar panel">${ic('x', 15)}</button></div>
        <nav class="sb-nav"><div class="sb-group"><div class="sb-label">Población general</div>
          <a class="sb-item active" href="#/pg" aria-current="page"><span class="sb-ic">${ic('people', 17)}</span><span class="sb-text">Inicio del apartado</span></a></div></nav>
        <button class="sb-collapse" data-action="toggleSidebar" aria-label="${sbCollapsed ? 'Expandir' : 'Contraer'} panel lateral">${ic(sbCollapsed ? 'chevR' : 'chevL', 16)}<span class="sb-text">Contraer panel</span></button>
      </aside>
      <div class="sb-backdrop" data-action="closeDrawer" aria-hidden="true"></div>
      <div class="plan-main" id="plan-main">
        <div class="page-head"><div class="plan-head">
          <button class="btn sm sb-toggle" data-action="openDrawer" aria-controls="plan-sidebar" aria-expanded="false">${ic('sidebar', 15)}<span>Secciones</span></button>
          <div><div class="eyebrow">Población general</div><div class="page-title">Población general</div></div>
        </div></div>
        <div class="pg-blank" aria-label="Apartado en blanco"></div>
      </div>
    </div>`;
  }

  function viewHome() {
    return homeHead(A()) + launchGrid(A());
  }
  // Acceso del cliente del atleta activo: vista propia, a la que se entra desde el recuadro del atleta en el inicio.
  function viewAccess() {
    const a = A();
    return `<div class="page-head">
        <div><div class="eyebrow">Atleta activo · ${esc(a.q.nombre || 'Sin nombre')}</div><h1 class="page-title">Acceso del cliente</h1></div>
        <a class="btn sm" href="#/inicio">${ic('chevL', 14)} Volver al inicio</a>
      </div>
      ${segAccess(a)}`;
  }

  // Gestión de atletas en una ventana, para que el inicio muestre solo los tres apartados.
  function athletesModal() {
    const a = A();
    return `<div class="modal-head row" style="justify-content:space-between"><h3>Atletas</h3><span class="small muted">${S.athletes.length} registrados</span></div>
      <div class="modal-body"><div class="table-wrap"><table class="t">
        <thead><tr><th>Nombre</th><th>Etapa</th><th class="num">Último peso</th><th></th></tr></thead>
        <tbody>${S.athletes.map((x) => { const l = lastWeight(x); return `<tr>
          <td><b>${esc(x.q.nombre || 'Sin nombre')}</b> ${a && x.id === a.id ? '<span class="pill gold">Activo</span>' : ''} ${linkedUid(x) ? '<span class="pill ok">Portal</span>' : ''}</td>
          <td>${esc(weekEtapa(x, currentWeek(x)))}</td>
          <td class="num">${l ? fmt(l.v, 1) + ' kg' : '—'}</td>
          <td class="right nowrap">${a && x.id === a.id ? '' : `<button class="btn xs" data-action="switchAthlete" data-id="${x.id}">Abrir</button>`} <button class="btn xs ghost" data-action="dupAthlete" data-id="${x.id}" title="Duplicar plan">${ic('copy', 13)}</button> <button class="btn xs ghost danger" data-action="delAthlete" data-id="${x.id}" title="Eliminar">${ic('trash', 13)}</button></td>
        </tr>`; }).join('')}</tbody></table></div></div>
      <div class="modal-foot"><button class="btn ghost" data-action="closeModal">Cerrar</button><button class="btn primary" data-action="newAthlete">${ic('plus', 14)} Nuevo atleta</button></div>`;
  }

  // =====================================================================
  // Vista — cuestionario inicial
  // =====================================================================
  function viewQ() {
    const a = A(), q = a.q;
    const qa = (path, label, rows = 2) => F(label, TA(path, { rows }));
    const radios = (path, opts) => `<div class="chips">${opts.map((o) => `<label class="chip"><input type="radio" name="${path}" data-bind="${path}" value="${esc(o)}" ${getP(path) === o ? 'checked' : ''}><span class="box"></span>${esc(o)}</label>`).join('')}</div>`;
    const checks = (path, opts) => `<div class="chips">${opts.map((o) => `<label class="chip"><input type="checkbox" data-bind="${path}" data-multi value="${esc(o)}" ${(getP(path) || []).includes(o) ? 'checked' : ''}><span class="box"></span>${esc(o)}</label>`).join('')}</div>`;
    const sec = (id, n, title, body, sub = '') => `<section class="card q-section" id="${id}">
      <div class="card-head"><span class="sec-num">${n}</span><h3>${title}</h3>${sub ? `<span class="sub">${sub}</span>` : ''}</div>
      <div class="card-body">${body}</div></section>`;
    const frecTable = (list) => `<div class="table-wrap"><table class="t">
      <thead><tr><th>Alimento</th><th style="width:120px">¿Lo consumes?</th><th>Frecuencia / horario</th></tr></thead>
      <tbody>${list.map((f) => { const k = slug(f); return `<tr><td><b>${esc(f)}</b></td>
        <td class="pad0">${SEL(`q.frec.${k}.consume`, [['', '—'], 'Sí', 'No', 'A veces'], { cls: 'cell' })}</td>
        <td class="pad0">${I(`q.frec.${k}.frec`, { cls: 'cell', ph: 'Ej.: casi siempre, mañana y tarde' })}</td></tr>`; }).join('')}</tbody></table></div>`;

    const body = `
      ${sec('q-instr', '00', 'Instrucciones de cómo responder la encuesta', `<div class="callout">Esta encuesta está diseñada para <b>conocer</b> tu alimentación, actividad física y objetivos. Es importante que respondas cada apartado con la mayor cantidad de datos posibles: todo eso me ayuda a desarrollar un plan nutricional adaptado a lo que necesitas. Recuerda, no hay respuestas incorrectas.</div>`)}

      ${sec('q-datos', '01', 'Datos básicos', `<div class="grid g3">
        ${F('Fecha de inicio del cuestionario', D('q.fechaInicio'))}
        ${F('Nombre', I('q.nombre', { ph: 'Nombre y apellido', live: true }), '', 'span2')}
        ${F('Edad', suffix(I('q.edad', { ph: '—' }), 'años'))}
        ${F('Sexo', SEL('q.sexo', [['', 'Seleccionar'], 'Masculino', 'Femenino']))}
        ${F('Altura (cm)', suffix(I('q.altura', { ph: '—' }), 'cm'))}
        ${F('Peso (kg)', suffix(I('q.peso', { ph: '—' }), 'kg'))}
        ${F('% Graso (si lo conoces)', suffix(I('q.grasa', { ph: '—' }), '%'))}
        ${F('Cantidad de masa muscular (si lo conoces)', suffix(I('q.masaMuscular', { ph: '—' }), 'kg'))}
        ${F('Ocupación / actividad laboral principal', I('q.ocupacion'), '', 'span2')}
        ${F('Horas de sueño promedio por noche', I('q.sueno', { ph: 'Ej.: 7-8 h' }))}
        ${F('Nivel de estrés percibido (1-10)', I('q.estres', { ph: '1-10' }))}
      </div>`)}

      ${sec('q-obj', '02', 'Objetivo', `<div class="qa-list">
        ${F('Motivo de la consulta', checks('q.motivo', ['Pérdida de grasa', 'Aumento de masa muscular']) + TA('q.motivoDetalle', { rows: 2, ph: 'Detalle del objetivo' }))}
        ${F('¿Tu peso ha cambiado en los últimos 3 meses?', radios('q.pesoCambio', ['Estoy ganando peso', 'Estoy perdiendo peso', 'He estado estable']) + TA('q.pesoCambioDetalle', { rows: 2, ph: 'Comentario' }))}
      </div>`)}

      ${sec('q-sup', '03', 'Suplementación', `<div class="hint" style="margin-bottom:10px">Suplementos que consumes: cuál, qué día, horario, cantidad y marca.</div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Cuál</th><th>Qué día</th><th>Horario</th><th>Cantidad</th><th>Marca</th><th style="width:40px"></th></tr></thead>
        <tbody>${q.suplementos.map((s, i) => `<tr>${['cual', 'dia', 'horario', 'cantidad', 'marca'].map((k) => `<td class="pad0">${I(`q.suplementos.${i}.${k}`, { cls: 'cell' })}</td>`).join('')}
          <td><button class="btn xs ghost danger icon" data-action="delSup" data-i="${i}" title="Quitar">${ic('x', 13)}</button></td></tr>`).join('')}</tbody></table></div>
        <button class="btn sm mt12" data-action="addSup">${ic('plus', 14)} Agregar suplemento</button>`)}

      ${sec('q-act', '04', 'Nivel de actividad física', `
        <div class="callout info"><b>Aclaración:</b> la actividad física la llevas y planificas tú; esto solo lo necesito para estimar tu gasto calórico diario.</div>
        <div class="grid g3 mt16">
          ${F('Cantidad de pasos diarios en promedio', I('q.pasos', { ph: 'Ej.: 10.000' }))}
          ${F('¿Cómo describirías tu nivel de entrenamiento actual?', radios('q.nivel', ['Principiante (menos de 1 año entrenando con continuidad)', 'Intermedio (1-3 años)', 'Avanzado (más de 3 años, con programación estructurada)']), '', 'span2')}
        </div>
        <div class="table-wrap mt16"><table class="t week-table"><thead><tr><th></th>${WEEK.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
        <tbody>${Q_WEEK_ROWS.map(([k, l]) => `<tr><td>${l}</td>${WEEK.map((_, i) => `<td class="pad0">${TA(`q.semana.${k}.${i}`, { cls: 'cell', rows: 2 })}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`)}

      ${sec('q-peri', '05', 'Nutrición peri-entrenamiento', `<div class="qa-list">${Q_PERI.map(([k, l]) => qa(`q.peri.${k}`, l)).join('')}</div>`)}

      ${sec('q-rec', '06', 'Alimentación — Recordatorio de 24 h', `
        <div class="callout"><b>Instrucciones:</b> describe <b>detalladamente</b> tu alimentación diaria, es decir, lo que comes generalmente. Toma como ejemplo lo que comiste ayer. De ser posible agrega dos ejemplos de cada comida: la que haces frecuentemente y otra que haces de forma menos frecuente. Agrega los horarios en que comes cada comida.
        <div class="mt8">Lo que me ayuda: <i>“3 huevos revueltos sin aceite, 150 g de carne de vacuno en freidora de aire solo con sal”</i>. Lo que no me ayuda: <i>“Elijo una proteína y carbohidratos”</i>.</div>
        <div class="mt8"><b>Si tu alimentación varía mucho entre días de entrenamiento y descanso, describe ambos si puedes.</b></div></div>
        <div class="table-wrap mt16"><table class="t"><thead><tr><th style="width:130px">Comida</th><th style="width:110px">Horario</th><th>Ejemplo de comida 1</th><th>Ejemplo de comida 2</th></tr></thead>
        <tbody>${q.rec.map((r, i) => `<tr><td><b>${esc(r.comida)}</b></td><td class="pad0">${I(`q.rec.${i}.horario`, { cls: 'cell', ph: '00:00' })}</td>
          <td class="pad0">${TA(`q.rec.${i}.ej1`, { cls: 'cell', rows: 2 })}</td><td class="pad0">${TA(`q.rec.${i}.ej2`, { cls: 'cell', rows: 2 })}</td></tr>`).join('')}</tbody></table></div>`)}

      ${sec('q-tend', '07', 'Tendencia de consumo', `<div class="grid g2">${Q_TEND.map(([k, l]) => qa(`q.tend.${k}`, l)).join('')}</div>`)}

      ${sec('q-frec', '08', 'Frecuencia de consumo', `<div class="hint" style="margin-bottom:12px">Anotar si consumes o no alguno de los alimentos de la lista y en qué horario.</div>
        <div class="grid g2">${frecTable(Q_FREC_L)}${frecTable(Q_FREC_R)}</div>`)}

      <div class="card card-pad center"><b style="font-size:16px">¡Gracias por responder el cuestionario!</b></div>
      <a class="card next-stage no-print" href="#/plan/req" aria-label="Siguiente etapa del proceso: Plan">
        <span class="ns-ic">${ic('target', 22)}</span>
        <span class="ns-text"><span class="ns-eyebrow">Siguiente etapa del proceso</span><b>Plan</b><span class="small muted">Requerimientos, planificación de la etapa, menú diario y distribución de comidas.</span></span>
        <span class="ns-go">${ic('arrowR', 20)}</span>
      </a>`;

    return `
    <div class="page-head">
      <div><div class="eyebrow">Sección 01</div><div class="page-title">Cuestionario inicial</div><div class="page-sub">${esc(q.nombre || 'Atleta')} · completa la información base antes de iniciar la planificación.</div></div>
      <div class="row no-print">${MODE === 'sync' ? '' : `<button class="btn" data-action="print">${ic('print', 15)} Imprimir / PDF</button>`}<a class="btn primary" href="#/plan/req">Ir a requerimientos →</a></div>
    </div>
    <div class="q-layout">
      <nav class="q-index">
        <a href="#/cuestionario" data-action="goQ" data-id="q-instr"><span class="n">00</span>Instrucciones</a>
        ${Q_SECTIONS.map(([id, l, fn], i) => `<a href="#/cuestionario" data-action="goQ" data-id="${id}"><span class="n">${pad(i + 1)}</span>${l}<span class="ck ${fn(q) ? 'done' : ''}"></span></a>`).join('')}
      </nav>
      <div>${body}</div>
    </div>`;
  }

  // =====================================================================
  // Vista — planificación
  // =====================================================================
  // El acceso del cliente ya no es una sección de Seguimiento: vive en el inicio (homeAccess).
  const SEG_TABS = [['panel', 'Panel'], ['diario', 'Registro diario de peso'], ['semanal', 'Seguimiento semanal'], ['guia', 'Instrucciones y escalas'], ['config', 'Configuración']];
  const CLIENT_SEG_TABS = SEG_TABS.filter(([k]) => k !== 'config');
  const PLAN_NAV = [
    ['Plan', [['req', 'Requerimientos', 'calc'], ['planif', 'Planificación', 'target'], ['menu', 'Menú diario', 'menu'], ['dist', 'Distribución de comidas', 'clock'], ['minuta', 'Minuta', 'down']]],
    ['Recursos', [['alimentos', 'Base de alimentos', 'db']]],
  ];
  const SEG_ICONS = { panel: 'chart', diario: 'edit', semanal: 'clip', guia: 'menu', config: 'target', acceso: 'user' };
  const PLAN_LABEL = Object.fromEntries(PLAN_NAV.flatMap(([, items]) => items.map(([k, l]) => [k, l])));

  // Orden de los apartados de Plan: al final de cada uno, una tarjeta lleva al siguiente (y la última, a Seguimiento).
  const PLAN_FLOW = [
    ['req', 'Requerimientos', 'calc', 'Gasto energético, objetivo y macros de cada tipo de día.'],
    ['planif', 'Planificación', 'target', 'Objetivo de la etapa, fechas, objetivos y mini cut.'],
    ['menu', 'Menú diario', 'menu', 'Calendario de alimentación y comidas de cada tipo de día.'],
    ['dist', 'Distribución de comidas', 'clock', 'Horarios e indicaciones de cada comida.'],
    ['minuta', 'Descargar planificación', 'down', 'Vista previa y descarga del documento en PDF.'],
  ];
  function nextStepCard(tab) {
    const i = PLAN_FLOW.findIndex(([k]) => k === tab); if (i < 0) return '';
    const nx = PLAN_FLOW[i + 1] || [null, 'Seguimiento', 'chart', 'Panel, registro diario, seguimiento semanal y configuración de etapas.'];
    const href = nx[0] ? `#/plan/${nx[0]}` : '#/seg';
    return `<a class="card next-stage no-print" href="${href}" aria-label="Siguiente apartado: ${esc(nx[1])}">
        <span class="ns-ic">${ic(nx[2], 22)}</span>
        <span class="ns-text"><span class="ns-eyebrow">${nx[0] ? `Siguiente apartado · ${i + 2} de ${PLAN_FLOW.length}` : 'Siguiente etapa del proceso'}</span><b>${esc(nx[1])}</b><span class="small muted">${esc(nx[3])}</span></span>
        <span class="ns-go">${ic('arrowR', 20)}</span>
      </a>`;
  }
  function viewPlan(tab) {
    const views = { req: viewReq, planif: viewPlanif, menu: viewMenu, dist: viewDist, minuta: viewMinuta, alimentos: viewFoods };
    if (tab === 'minicut') tab = 'planif'; // el Mini cut ahora vive dentro de «Planificación»
    if (!views[tab]) tab = 'req';
    const a = A(), segLabel = '';
    return `<div class="plan-layout ${sbCollapsed ? 'sb-collapsed' : ''}">
      ${sidebar(tab)}
      <div class="plan-main" id="plan-main">
        <div class="page-head">
          <div class="plan-head">
            <button class="btn sm sb-toggle" data-action="openDrawer" aria-controls="plan-sidebar" aria-expanded="false">${ic('sidebar', 15)}<span>Secciones</span></button>
            <div><div class="eyebrow">Plan · ${esc(a.q.nombre || 'Atleta')}</div><div class="page-title">${tab === 'minuta' ? minutaLabel() : PLAN_LABEL[tab]}${segLabel ? ` <span class="title-sub">· ${segLabel}</span>` : ''}</div></div>
          </div>
        </div>
        ${views[tab]()}
        ${isClientView() ? '' : nextStepCard(tab)}
      </div>
    </div>`;
  }

  // Apartado Seguimiento: mismo esqueleto que Planificación, con su propio panel lateral.
  // Orden de los apartados de Seguimiento (el del panel lateral): al final de cada uno, una tarjeta lleva al siguiente;
  // Configuración, el último, devuelve al Panel.
  const SEG_FLOW = [
    ['panel', 'Panel', 'chart', 'Cómo va la semana: peso, cambio frente a la meta, pasos y escalas.'],
    ['diario', 'Registro diario de peso', 'edit', 'Peso, pasos, escalas, hambre y medidas de cada día.'],
    ['semanal', 'Seguimiento semanal', 'clip', 'Promedios, % buscado y logrado, macros y fotos de cada semana.'],
    ['guia', 'Instrucciones y escalas', 'menu', 'Cómo pesarse, medirse y usar las escalas.'],
    ['config', 'Configuración', 'target', 'Etapas, fechas, metas y gráficos de cada etapa.'],
  ];
  function nextSegCard(tab) {
    const i = SEG_FLOW.findIndex(([k]) => k === tab); if (i < 0) return '';
    const last = i === SEG_FLOW.length - 1, nx = last ? SEG_FLOW[0] : SEG_FLOW[i + 1];
    return `<button type="button" class="card next-stage no-print" data-action="trackTab" data-v="${nx[0]}" aria-label="${last ? 'Volver al' : 'Siguiente apartado:'} ${esc(nx[1])}">
        <span class="ns-ic">${ic(nx[2], 22)}</span>
        <span class="ns-text"><span class="ns-eyebrow">${last ? 'Volver al inicio del seguimiento' : `Siguiente apartado · ${i + 2} de ${SEG_FLOW.length}`}</span><b>${esc(nx[1])}</b><span class="small muted">${esc(nx[3])}</span></span>
        <span class="ns-go">${ic(last ? 'chevL' : 'arrowR', 20)}</span>
      </button>`;
  }
  function viewSegSection() {
    const a = A(), tab = SEG_TABS.some(([k]) => k === a.ui.trackTab) ? a.ui.trackTab : 'panel';
    const label = SEG_TABS.find(([k]) => k === tab)[1];
    return `<div class="plan-layout ${sbCollapsed ? 'sb-collapsed' : ''}">
      ${segSidebar(tab)}
      <div class="plan-main" id="plan-main">
        <div class="page-head">
          <div class="plan-head">
            <button class="btn sm sb-toggle" data-action="openDrawer" aria-controls="plan-sidebar" aria-expanded="false">${ic('sidebar', 15)}<span>Secciones</span></button>
            <div><div class="eyebrow">Seguimiento · ${esc(a.q.nombre || 'Atleta')}</div><div class="page-title">${label}</div></div>
          </div>
        </div>
        ${viewSeg()}
        ${nextSegCard(tab)}
      </div>
    </div>`;
  }
  function segSidebar(tab) {
    const a = A(), cw = currentWeek(a);
    let st = null;
    for (let k = Math.min(cw, weekCount(a)); k >= 1; k--) { const s = status(a, k); if (s.key !== 'none') { st = s; break; } }
    const initials = (a.q.nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
    const dot = (k) => (k === 'panel' && st ? `<span class="sb-dot" style="background:var(--${st.key === 'ok' ? 'ok' : st.key === 'warn' ? 'warn' : 'bad'})" title="Último estado: ${st.label}"></span>` : '');
    return `<aside class="sidebar" id="plan-sidebar" aria-label="Secciones de seguimiento">
      <div class="sb-head">
        <div class="sb-athlete" title="${esc(a.q.nombre || '')}"><span class="avatar sm">${esc(initials)}</span>
          <div class="sb-ath-text"><b>${esc(a.q.nombre || 'Sin nombre')}</b><span>${esc(weekEtapa(a, cw))} · Semana ${cw}/${weekCount(a)}</span></div></div>
        <button class="btn xs ghost icon sb-close" data-action="closeDrawer" aria-label="Cerrar panel">${ic('x', 15)}</button>
      </div>
      <nav class="sb-nav"><div class="sb-group"><div class="sb-label">Seguimiento</div>
        ${SEG_TABS.map(([k, l]) => `<button type="button" class="sb-item ${k === tab ? 'active' : ''}" data-action="trackTab" data-v="${k}" ${k === tab ? 'aria-current="page"' : ''} title="${l}"><span class="sb-ic">${ic(SEG_ICONS[k], 17)}</span><span class="sb-text">${l}</span>${dot(k)}</button>`).join('')}
      </div></nav>
      <button class="sb-collapse" data-action="toggleSidebar" aria-label="${sbCollapsed ? 'Expandir' : 'Contraer'} panel lateral" title="${sbCollapsed ? 'Expandir' : 'Contraer'} panel">${ic(sbCollapsed ? 'chevR' : 'chevL', 16)}<span class="sb-text">Contraer panel</span></button>
    </aside>
    <div class="sb-backdrop" data-action="closeDrawer" aria-hidden="true"></div>`;
  }

  // Panel lateral de la planificación: fijo al hacer scroll, contraíble en escritorio y como cajón en el teléfono.
  function sidebar(tab) {
    const a = A(), cur = activeDay(a), segTab = a.ui.trackTab || 'panel', cw = currentWeek(a);
    let st = null;
    for (let k = Math.min(cw, weekCount(a)); k >= 1; k--) { const s = status(a, k); if (s.key !== 'none') { st = s; break; } }
    const initials = (a.q.nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
    const sub = (k) => {
      if ((k === 'menu' || k === 'dist') && k === tab) {
        return `<div class="sb-sub" role="group" aria-label="Tipos de día">${a.dayTypes.map((d) => `<button class="sb-subitem ${d.id === cur.id ? 'active' : ''}" data-action="sbDay" data-id="${d.id}" data-t="${k}" ${d.id === cur.id ? 'aria-current="true"' : ''}><span class="sw" style="background:${d.color}"></span><span class="sb-text">${esc(d.name)}</span></button>`).join('')}</div>`;
      }
      if (k === 'seg' && tab === 'seg') {
        return `<div class="sb-sub" role="group" aria-label="Vistas de seguimiento">${SEG_TABS.map(([v, l]) => `<button class="sb-subitem ${v === segTab ? 'active' : ''}" data-action="trackTab" data-v="${v}" ${v === segTab ? 'aria-current="true"' : ''}><span class="sb-text">${l}</span></button>`).join('')}</div>`;
      }
      return '';
    };
    const badge = (k) => {
      if (k === 'alimentos') return `<span class="sb-badge">${S.foods.length}</span>`;
      if (k === 'seg' && st) return `<span class="sb-dot" style="background:var(--${st.key === 'ok' ? 'ok' : st.key === 'warn' ? 'warn' : 'bad'})" title="Último estado: ${st.label}"></span>`;
      return '';
    };
    return `<aside class="sidebar" id="plan-sidebar" aria-label="Secciones del plan">
      <div class="sb-head">
        <div class="sb-athlete" title="${esc(a.q.nombre || '')}"><span class="avatar sm">${esc(initials)}</span>
          <div class="sb-ath-text"><b>${esc(a.q.nombre || 'Sin nombre')}</b><span>${esc(weekEtapa(a, cw))} · Semana ${cw}/${weekCount(a)}</span></div></div>
        <button class="btn xs ghost icon sb-close" data-action="closeDrawer" aria-label="Cerrar panel">${ic('x', 15)}</button>
      </div>
      <nav class="sb-nav">${PLAN_NAV.map(([g, items]) => `<div class="sb-group"><div class="sb-label">${g}</div>
        ${items.map(([k, l0, icn0]) => { const l = k === 'minuta' ? minutaLabel() : l0, icn = icn0; return `<a class="sb-item ${k === tab ? 'active' : ''}" href="#/plan/${k}" ${k === tab ? 'aria-current="page"' : ''} title="${l}"><span class="sb-ic">${ic(icn, 17)}</span><span class="sb-text">${l}</span>${badge(k)}</a>${sub(k)}`; }).join('')}
      </div>`).join('')}</nav>
      <button class="sb-collapse" data-action="toggleSidebar" aria-label="${sbCollapsed ? 'Expandir' : 'Contraer'} panel lateral" title="${sbCollapsed ? 'Expandir' : 'Contraer'} panel">${ic(sbCollapsed ? 'chevR' : 'chevL', 16)}<span class="sb-text">Contraer panel</span></button>
    </aside>
    <div class="sb-backdrop" data-action="closeDrawer" aria-hidden="true"></div>`;
  }

  function daySeg(a, extra = '') {
    const cur = activeDay(a);
    return `<div class="daytype-head no-print">
      <div class="seg">${a.dayTypes.map((d) => `<button class="${d.id === cur.id ? 'active' : ''}" data-action="setDay" data-id="${d.id}"><span class="sw" style="background:${d.color}"></span>${esc(d.name)}</button>`).join('')}</div>
      <button class="btn sm ghost" data-action="addDayType">${ic('plus', 14)} Tipo de día</button>
      <button class="btn sm ghost" data-action="editDayType" data-id="${cur.id}" title="Renombrar / color">${ic('edit', 14)}</button>
      <button class="btn sm ghost" data-action="dupDayType" data-id="${cur.id}" title="Duplicar tipo de día">${ic('copy', 14)}</button>
      ${a.dayTypes.length > 1 ? `<button class="btn sm ghost danger" data-action="delDayType" data-id="${cur.id}" title="Eliminar tipo de día">${ic('trash', 14)}</button>` : ''}
      <span class="spacer"></span>${extra}
    </div>`;
  }
  function activeDay(a) { return a.dayTypes.find((d) => d.id === a.activeDay) || a.dayTypes[0]; }

  function targetTiles(t, peso, totals) {
    const items = [['Energía', 'kcal', t.kcal, totals?.kcal, 'var(--c-kcal)', null], ['Proteínas', 'g', t.p, totals?.p, 'var(--c-p)', 4], ['Carbohidratos', 'g', t.c, totals?.c, 'var(--c-c)', 4], ['Grasas', 'g', t.g, totals?.g, 'var(--c-g)', 9]];
    const SHORT = { 'Energía': 'Kcal', 'Proteínas': 'Prot.', Carbohidratos: 'Carbs', Grasas: 'Grasas' }; // etiqueta corta para la barra fija en el móvil
    return `<div class="target-grid">${items.map(([l, u, v, tot, c, k]) => `<div class="target" style="--c:${c}">
      <div class="t-l"><span class="tl-full">${l}</span><span class="tl-short">${SHORT[l]}</span></div><div class="t-v">${fmt(v)}<small> ${u}</small></div>
      <div class="t-s">${k ? `${peso && v != null ? fmt(v / peso, 2) + ' g/kg · ' : ''}${t.kcal && v != null ? fmt((v * k / t.kcal) * 100) + '%' : ''}` : 'objetivo diario'}</div>
      ${totals ? `<div class="progress"><span style="width:${clamp(adq(tot, v) || 0, 0, 100)}%"></span></div><div class="t-s mt8">Menú: <b>${fmt(tot)}</b> ${u} · <span class="${adqCls(adq(tot, v))}">${fmt(adq(tot, v))}%</span></div>` : ''}
    </div>`).join('')}</div>`;
  }

  // ---------------- Requerimientos ----------------
  function viewReq() {
    const a = A(), r = a.req, q = a.q, rc = reqCalc(a), e = rc.e;
    const ph = (v, u = '') => (v ? `Cuestionario: ${v}${u}` : '—');
    const eqRows = EQS.map((eq) => { const v = eqValue(eq, e); return `<tr class="${r.ecuacion === eq.id ? 'selected' : ''}" data-action="setEq" data-id="${eq.id}">
      <td style="width:30px"><span class="eq-radio"></span></td><td><b>${eq.name}</b><div class="small muted">${eq.ref}</div></td>
      <td class="num"><b>${v != null ? fmt(v) : '—'}</b></td><td class="num muted">${v != null ? fmt(v * rc.factor) : '—'}</td></tr>`; }).join('');
    const fac = num(r.factor);
    return `
    <div class="grid" style="grid-template-columns: 1.15fr 1fr 0.9fr; align-items:start">
      <section class="card">
        <div class="card-head"><h3>Datos del atleta</h3><span class="spacer"></span><button class="btn xs" data-action="useQ">Usar datos del cuestionario</button></div>
        <div class="card-body grid g2">
          ${F('Nombre y apellido', `<input class="input" value="${esc(q.nombre)}" disabled>`)}
          ${F('Fecha de nacimiento', D('req.nacimiento'), r.nacimiento && e.edad != null ?`Edad calculada: <b>${e.edad} años</b>` : '')}
          ${!r.nacimiento ? F('Edad (años)', I('req.edad', { num: true, live: true, ph: ph(q.edad) })) : ''}
          ${F('Sexo', SEL('req.sexo', [['', q.sexo ? `Cuestionario: ${q.sexo}` : 'Masculino (por defecto)'], 'Masculino', 'Femenino']))}
          ${F('Peso (kg)', suffix(I('req.peso', { num: true, live: true, ph: ph(q.peso) }), 'kg'))}
          ${F('Altura (cm)', suffix(I('req.altura', { num: true, live: true, ph: ph(q.altura) }), 'cm'))}
          ${F('Introducción del % graso', suffix(I('req.grasa', { num: true, live: true, ph: ph(q.grasa) }), '%'), 'Necesario para las ecuaciones basadas en MLG.')}
          <div class="field"><label>Composición</label>
            <div class="stat-line"><span>FFM (kg)</span><b>${fmt(e.ffm, 1)} <span class="muted small">${e.grasa != null ? fmt(100 - e.grasa, 1) + '%' : ''}</span></b></div>
            <div class="stat-line"><span>FM (kg)</span><b>${fmt(e.fm, 1)} <span class="muted small">${e.grasa != null ? fmt(e.grasa, 1) + '%' : ''}</span></b></div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Factor de actividad</h3></div>
        <div class="card-body grid" style="gap:8px">
          ${FACTORS.map(([v, d]) => `<div class="factor-opt ${fac === v ? 'active' : ''}" data-action="setFactor" data-v="${v}"><b>${String(v).replace('.', ',')}</b><span>${d}</span></div>`).join('')}
          ${F('Factor personalizado', I('req.factor', { num: true, live: true }))}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Gasto energético</h3></div>
        <div class="card-body">
          <div class="label">Kcal diarias (GET)</div>
          <div class="big-num">${fmt(rc.get)}<small> kcal</small></div>
          <div class="mt12">
            <div class="stat-line"><span>Ecuación TMB</span><b class="small">${r.ecuacion === 'manual' ? 'Manual / calorimetría' : rc.eq?.name || '—'}</b></div>
            <div class="stat-line"><span>TMB</span><b>${fmt(rc.tmb)} kcal</b></div>
            <div class="stat-line"><span>Factor</span><b>× ${fmt(rc.factor, 3)}</b></div>
          </div>
          <div class="callout mt16" style="padding:12px">
            <div class="label">Gasto energético de los pasos diarios</div>
            <div class="small muted">(2,74 × kg × pasos / 2) / 4184</div>
            <div class="grid g2 mt8">
              ${F('Pasos', I('req.pasos', { num: true, live: true, ph: stepsFromQ(a) != null ? fmt(stepsFromQ(a)) : '—' }))}
              <div class="field"><label>Gasto</label><div class="big-num" style="font-size:20px">${fmt(rc.pasosKcal)}<small> kcal</small></div></div>
            </div>
            <label class="chip mt8" style="border-radius:8px"><input type="checkbox" data-bind="req.sumarPasos" ${r.sumarPasos ? 'checked' : ''}><span class="box"></span>Sumar al GET</label>
          </div>
        </div>
      </section>
    </div>

    <section class="card mt16">
      <div class="card-head"><h3>Ecuaciones de TMB</h3><span class="sub">Selecciona la ecuación que vinculará el cálculo</span></div>
      <div class="table-wrap" style="border:0;border-radius:0">
        <table class="t eq-table"><thead><tr><th></th><th>Fórmula y muestra</th><th class="num">TMB (kcal)</th><th class="num">× factor</th></tr></thead>
        <tbody>${eqRows}
          <tr class="${r.ecuacion === 'manual' ? 'selected' : ''}" data-action="setEq" data-id="manual"><td><span class="eq-radio"></span></td><td><b>Manual / calorimetría indirecta</b><div class="small muted">Ingresa un valor medido u otra ecuación.</div></td>
            <td class="num" style="width:150px">${I('req.tmbManual', { cls: 'cell', num: true, live: true, ph: 'kcal' })}</td><td class="num muted">${r.ecuacion === 'manual' && rc.tmb ? fmt(rc.tmb * rc.factor) : '—'}</td></tr>
        </tbody></table>
      </div>
    </section>

    <section class="card mt16">
      <div class="card-head"><h3>Objetivo energético</h3><span class="sub">Elige el objetivo para ver su calculadora</span><span class="spacer"></span>
        <div class="seg">${[['deficit', 'Déficit'], ['mantenimiento', 'Mantenimiento'], ['volumen', 'Volumen']].map(([k, l]) => `<button class="${r.objetivo === k ? 'active' : ''}" data-action="setObj" data-v="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="card-body obj-grid">
        <div class="obj-panel">${objPanel(r, rc)}</div>
        <div class="obj-summary">
          <div class="label">Kcal objetivo · ${r.objetivo === 'deficit' ? 'déficit' : r.objetivo === 'volumen' ? 'volumen' : 'mantenimiento'}</div>
          <div class="big-num kc">${fmt(rc.obj)}<small> kcal</small></div>
          <div class="stat-line"><span>GET (mantenimiento)</span><b>${fmt(rc.get)}</b></div>
          <div class="stat-line"><span>Diferencia vs GET</span><b>${rc.obj != null && rc.get != null ? fmtS(Math.round(rc.obj - rc.get), 0) : '—'} kcal</b></div>
          ${F('Kcal por kg de tejido', I('req.kcalKg', { num: true, live: true }), '', 'mt12')}
          <div class="callout mt12 small">Durante restricciones calóricas prolongadas, la estimación de 3585 kcal para perder 0,46 kg de grasa deja de ser válida; sigue siendo útil para períodos cortos (~10 semanas). Según el modelo Body Weight Planner, el déficit real para perder 0,46 kg de grasa se acerca más a 5500 kcal. <span class="muted">— Asker Jeukendrup, p. 609</span></div>
        </div>
      </div>
    </section>

    <div class="row mt24" style="justify-content:space-between">
      <div><h3 style="font-size:17px">Objetivos por tipo de día</h3><div class="muted small">Calorías y macronutrientes de cada día (entrenamiento, descanso u otro que definas).</div></div>
      <button class="btn sm" data-action="addDayType">${ic('plus', 14)} Tipo de día</button>
    </div>
    <div class="grid g2 mt12">${a.dayTypes.map((dt, i) => dayTypeCard(a, dt, i, rc)).join('')}</div>`;
  }

  function dayTypeCard(a, dt, i, rc) {
    const t = dayTargets(a, dt, rc), base = `dayTypes.${i}`;
    return `<section class="card">
      <div class="card-head"><span class="color-dot" style="background:${dt.color}"></span><h3>${esc(dt.name)}</h3><span class="spacer"></span>
        <button class="btn xs ghost" data-action="editDayType" data-id="${dt.id}">${ic('edit', 13)}</button>
        ${a.dayTypes.length > 1 ? `<button class="btn xs ghost danger" data-action="delDayType" data-id="${dt.id}">${ic('trash', 13)}</button>` : ''}
      </div>
      <div class="card-body">
        <div class="grid g3">
          ${F('Calorías', SEL(`${base}.kcalMode`, [['auto', 'Según objetivo ± %'], ['manual', 'Manual']]))}
          ${dt.kcalMode === 'manual' ? F('Kcal del día', I(`${base}.kcal`, { num: true, live: true })) : F('Ajuste vs objetivo', suffix(I(`${base}.ajuste`, { num: true, live: true }), '%'), `Base: ${fmt(rc.obj)} kcal`)}
          ${F('Proteínas', suffix(I(`${base}.protGkg`, { num: true, live: true }), 'g/kg'))}
          ${F('Grasas', SEL(`${base}.fatMode`, [['gkg', 'Por g/kg'], ['pct', 'Por % de kcal']]))}
          ${dt.fatMode === 'pct' ? F('% de las kcal', suffix(I(`${base}.fatPct`, { num: true, live: true }), '%')) : F('Grasas', suffix(I(`${base}.fatGkg`, { num: true, live: true }), 'g/kg'))}
          ${F('Carbohidratos', `<input class="input" value="Resto de las kcal" disabled>`)}
        </div>
        <div class="mt16">${t.ok ? targetTiles(t, t.peso) : '<div class="callout small">Completa peso, ecuación y objetivo para calcular las metas de este día.</div>'}</div>
        ${t.ok && t.c < 0 ? '<div class="callout mt12 small" style="border-color:var(--bad)">Los carbohidratos quedan negativos: reduce proteína o grasa, o sube las calorías.</div>' : ''}
        ${t.ok ? `<div class="mt12">${macroBar(t)}</div>` : ''}
      </div></section>`;
  }
  function macroBar(t) {
    const tot = t.p * 4 + t.c * 4 + t.g * 9 || 1;
    return `<div class="macro-bar"><span style="width:${(t.p * 4 / tot) * 100}%;background:var(--c-p)"></span><span style="width:${(Math.max(0, t.c) * 4 / tot) * 100}%;background:var(--c-c)"></span><span style="width:${(t.g * 9 / tot) * 100}%;background:var(--c-g)"></span></div>
      <div class="macro-legend mt8"><span><i style="background:var(--c-p)"></i>P ${fmt((t.p * 4 / tot) * 100)}%</span><span><i style="background:var(--c-c)"></i>C ${fmt((t.c * 4 / tot) * 100)}%</span><span><i style="background:var(--c-g)"></i>G ${fmt((t.g * 9 / tot) * 100)}%</span></div>`;
  }

  // ---------------- Planificación de la etapa ----------------
  // Objetivo de la etapa con sus fechas y la lista de objetivos (editable). Es lo primero del documento que se descarga.
  const planifOf = (a) => {
    if (!isPlain(a.planif)) a.planif = newPlanif();
    if (!Array.isArray(a.planif.objetivos)) a.planif.objetivos = ['', '', '', ''];
    return a.planif;
  };
  // Duración de inicio a término (ambos incluidos): «12 semanas», «5 semanas y 3 días» o «4 días». null si falta una fecha o están invertidas.
  function planifDuration(p) {
    if (!parseISO(p.inicio) || !parseISO(p.termino)) return null;
    const d0 = daysBetween(p.inicio, p.termino); if (d0 < 0) return null;
    const d = d0 + 1; // se cuentan el primer y el último día, igual que en las etapas de Seguimiento › Configuración
    const w = Math.floor(d / 7), r = d % 7, pl = (n, s, pls) => `${n} ${n === 1 ? s : pls}`;
    return w && r ? `${pl(w, 'semana', 'semanas')} y ${pl(r, 'día', 'días')}` : w ? pl(w, 'semana', 'semanas') : pl(r, 'día', 'días');
  }
  // Etapa de Seguimiento › Configuración que corresponde a la de Planificación: mismo objetivo; si hay varias,
  // la de fechas iguales, luego la que se cruza con estas fechas, luego la primera.
  function planifStage(a) {
    const p = planifOf(a); if (!p.objetivo) return null;
    const c = stagesOf(a).map((s, i) => ({ s, i })).filter((x) => x.s.tipo === p.objetivo);
    const ok = parseISO(p.inicio) && parseISO(p.termino);
    return c.find((x) => x.s.inicio === p.inicio && x.s.fin === p.termino)
      || (ok && c.find((x) => stageDated(x.s) && p.inicio <= x.s.fin && p.termino >= x.s.inicio)) || c[0] || null;
  }
  // null si coincide (o si aún no se elige objetivo); si no, qué no coincide.
  function planifMismatch(a) {
    const p = planifOf(a); if (!p.objetivo) return null;
    if (!ETAPAS.includes(p.objetivo)) return { kind: 'notlist' };
    const m = planifStage(a);
    if (!m) return { kind: 'nostage' };
    if (m.s.inicio !== p.inicio || m.s.fin !== p.termino) return { kind: 'dates', ...m };
    return null;
  }
  const rangeTxt = (i, f) => `${parseISO(i) ? fmtDate(i) : 'sin fecha'} – ${parseISO(f) ? fmtDate(f) : 'sin fecha'}`;
  function planifAlert(a) {
    const p = planifOf(a), mm = planifMismatch(a); if (!mm) return '';
    const here = parseISO(p.inicio) || parseISO(p.termino) ? `aquí <b>${rangeTxt(p.inicio, p.termino)}</b>` : 'aquí aún no hay fechas';
    const body = mm.kind === 'notlist'
      ? `«${esc(p.objetivo)}» se escribió a mano y no es uno de los objetivos de la lista. Elige el que corresponda para que coincida con las etapas de Seguimiento › Configuración.`
      : mm.kind === 'nostage'
      ? `«${esc(p.objetivo)}» no está entre las etapas de Seguimiento › Configuración.`
      : `Las fechas no coinciden con la etapa ${mm.i + 1} «${esc(mm.s.tipo)}» de Seguimiento › Configuración: ${here}; en Configuración <b>${rangeTxt(mm.s.inicio, mm.s.fin)}</b>.`;
    const btns = mm.kind === 'notlist' ? '' : mm.kind === 'nostage'
      ? `<button class="btn sm" data-action="planifAddStage">${ic('plus', 14)} Agregar la etapa «${esc(p.objetivo)}» con estas fechas</button>`
      : `${stageDated(mm.s) ? `<button class="btn sm" data-action="planifUseStage">Usar las fechas de Configuración</button>` : ''}${parseISO(p.inicio) && parseISO(p.termino) ? `<button class="btn sm ghost" data-action="planifToStage">Llevar estas fechas a Configuración</button>` : ''}`;
    return `<div class="callout alert-callout mt12" role="alert"><b>La etapa no coincide.</b> ${body}<div class="row mt8" style="gap:8px;flex-wrap:wrap">${btns}</div></div>`;
  }
  function viewPlanif() {
    const a = A(), p = planifOf(a), dur = planifDuration(p), n = p.objetivos.length;
    const inverted = parseISO(p.inicio) && parseISO(p.termino) && daysBetween(p.inicio, p.termino) < 0;
    const date = (k, label) => `<div class="field"><label for="pf-${k}">${label}</label>${D(`planif.${k}`, `pf-${k}`)}</div>`;
    return `
    <section class="card">
      <div class="card-head"><span class="sec-num">01</span><h3>Etapa</h3><span class="sub">Qué se busca y en qué plazo</span></div>
      <div class="card-body">
        <div class="pf-grid">
          <div class="field"><label for="pf-objetivo">Objetivo de la etapa</label>${SEL('planif.objetivo', [['', 'Selecciona un objetivo'], ...(p.objetivo && !ETAPAS.includes(p.objetivo) ? [p.objetivo] : []), ...ETAPAS], { attrs: 'id="pf-objetivo"' })}</div>
          ${date('inicio', 'Fecha de inicio')}
          ${date('termino', 'Fecha de término')}
        </div>
        ${inverted ? `<div class="hint mt12" style="color:var(--warn)" role="alert">La fecha de término es anterior a la de inicio.</div>` : dur ? `<div class="hint mt12">Duración de la etapa: <b>${dur}</b>.</div>` : ''}
        ${planifAlert(a)}
      </div>
    </section>
    <section class="card mt16">
      <div class="card-head"><span class="sec-num">02</span><h3>Objetivos de la etapa</h3><span class="sub">${n} ${n === 1 ? 'objetivo' : 'objetivos'}</span><span class="spacer"></span>
        <button class="btn primary sm" data-action="addObjetivo">${ic('plus', 14)} Agregar objetivo</button></div>
      <div class="card-body">
        ${n ? `<ol class="pf-list">${p.objetivos.map((_, i) => `<li class="pf-item"><span class="meal-idx" aria-hidden="true">${i + 1}</span>
          ${TA(`planif.objetivos.${i}`, { rows: 2, ph: `Objetivo ${i + 1}`, attrs: `aria-label="Objetivo ${i + 1}"` })}
          <button class="btn sm ghost icon danger" data-action="delObjetivo" data-i="${i}" title="Eliminar objetivo" aria-label="Eliminar objetivo ${i + 1}">${ic('trash', 14)}</button></li>`).join('')}</ol>`
          : '<div class="muted center" style="padding:18px">Sin objetivos. Pulsa «Agregar objetivo».</div>'}
      </div>
    </section>
    ${viewMiniCut('mt16')}`;
  }

  // ---------------- Mini cut ----------------
  // Fase corta de déficit. Es la misma etapa «Mini cut» de Seguimiento › Configuración: fechas y % se comparten.
  // Si hay varias, se muestra la que está en curso, si no la próxima, si no la última.
  function miniCutStage(a) {
    const ms = stagesOf(a).map((s, i) => ({ s, i })).filter((x) => x.s.tipo === 'Mini cut');
    if (!ms.length) return null;
    const today = todayISO();
    return ms.find((x) => stageDated(x.s) && x.s.fin >= today) || ms.slice().reverse().find((x) => stageDated(x.s)) || ms[0];
  }
  function miniCutCalc(a, st) {
    const m = { inicio: st.inicio, termino: st.fin, pct: st.objetivo }, pct = num(m.pct);
    const hasDates = !!(parseISO(m.inicio) && parseISO(m.termino)), days = hasDates ? daysBetween(m.inicio, m.termino) : null;
    const c = { m, pct, days, valid: hasDates && days > 0, inverted: hasDates && days < 0, pctOk: pct != null && pct > 0 && pct < 100, daily: [], weeks: [] };
    if (!c.valid) return c;
    // Pesajes dentro del mini cut (fechas ISO: se comparan como texto).
    const dly = (a.tracking && a.tracking.daily) || {};
    c.daily = Object.keys(dly).filter((d) => d >= m.inicio && d <= m.termino).sort()
      .map((d) => ({ d, t: daysBetween(m.inicio, d), v: num(dly[d] && dly[d].peso) })).filter((p) => p.v != null);
    // Promedio de cada semana del mini cut (semana 1 = días 0 a 6 desde la fecha inicial).
    for (let k = 0; k * 7 <= days; k++) {
      const vs = c.daily.filter((p) => Math.floor(p.t / 7) === k).map((p) => p.v);
      if (vs.length) c.weeks.push({ k, t: Math.min(k * 7 + 3, days), n: vs.length, v: vs.reduce((x, y) => x + y, 0) / vs.length });
    }
    // Peso de partida: el peso inicial de la etapa; si no está, el promedio de la semana 1; si no, el de Requerimientos.
    const w1 = c.weeks.find((w) => w.k === 0), own = num(st.pesoInicial);
    c.p0 = own ?? (w1 ? w1.v : eff(a).peso);
    c.p0src = own != null ? 'peso inicial de la etapa' : w1 ? 'promedio de la semana 1' : 'peso de Requerimientos';
    if (c.p0 == null || !c.pctOk) return c;
    // Trayectoria objetivo (t = días desde la fecha inicial). Si el peso de partida es el promedio de la semana 1,
    // se ancla al centro de esa semana, donde también se grafica ese promedio.
    const t0 = own == null && w1 ? w1.t : 0;
    c.target = (t) => c.p0 * Math.pow(1 - pct / 100, (t - t0) / 7);
    c.pEnd = c.target(days); c.kgTotal = c.p0 - c.pEnd; c.pctTotal = (c.kgTotal / c.p0) * 100;
    const rc = reqCalc(a);
    c.kcalDia = ((c.p0 * pct) / 100) * rc.kcalKg / 7; c.kcal = rc.get != null ? rc.get - c.kcalDia : null;
    const last = c.weeks[c.weeks.length - 1];
    if (last && last.k > 0) {
      c.last = last; c.expected = c.target(last.t); c.lost = c.p0 - last.v; c.expLost = c.p0 - c.expected;
      c.goal = c.kgTotal > 0 ? (c.lost / c.kgTotal) * 100 : null;
    }
    return c;
  }
  function miniCutChart(c) {
    const day = (t) => parseISO(addDays(c.m.inicio, t)).getTime();
    const target = [];
    for (let t = 0; t < c.days; t += 7) target.push({ x: day(t), y: c.target(t), label: `Objetivo ${fmtDate(addDays(c.m.inicio, t))} · ${fmt(c.target(t), 2)} kg` });
    target.push({ x: day(c.days), y: c.pEnd, label: `Objetivo final ${fmtDate(c.m.termino)} · ${fmt(c.pEnd, 2)} kg` });
    const dots = c.daily.map((p) => ({ x: day(p.t), y: p.v, label: `${fmtDate(p.d)} · ${fmt(p.v, 1)} kg` }));
    const avgs = c.weeks.map((w) => ({ x: day(w.t), y: w.v, label: `Semana ${w.k + 1} · ${fmt(w.v, 2)} kg (${w.n} pesaje${w.n === 1 ? '' : 's'})` }));
    return chartSVG([{ pts: target, color: 'var(--muted)', type: 'dash' }, { pts: dots, color: 'var(--chart-dots)', type: 'dots' }, { pts: avgs, color: 'var(--accent)', type: 'line' }], { fmtY: (v) => fmt(v, 1), height: 280 });
  }
  function viewMiniCut(cls = '') {
    const a = A(), ms = miniCutStage(a);
    const head = `<div class="card-head"><span class="sec-num">03</span><h3>Mini cut</h3><span class="sub">Fase corta de déficit: plazo, meta y avance</span></div>`;
    if (!ms) return `<section class="card ${cls}" id="minicut">${head}<div class="card-body"><div class="muted center" style="padding:18px">No hay una etapa de Mini cut en «Seguimiento › Configuración».</div>
      <div class="center"><button class="btn primary sm" data-action="addStage" data-tipo="Mini cut">${ic('plus', 14)} Agregar etapa Mini cut</button></div></div></section>`;
    const c = miniCutCalc(a, ms.s), m = c.m, sp = `tracking.config.stages.${ms.i}`;
    const date = (k, f, label) => `<div class="field"><label for="mc-${k}">${label}</label>${D(`${sp}.${f}`, `mc-${k}`)}</div>`;
    const L = (l, v) => `<div class="stat-line"><span>${l}</span><b>${v}</b></div>`;
    const dur = c.valid ? stageDur(ms.s) : null, today = todayISO();
    const empty = (msg) => `<div class="muted center" style="padding:30px">${msg}</div>`;
    let note = '';
    if (c.inverted) note = '<div class="hint mt12" style="color:var(--warn)" role="alert">La fecha final es anterior a la fecha inicial.</div>';
    else if (dur) note = `<div class="hint mt12">Duración del mini cut: <b>${dur}</b>.</div>`;
    let body;
    if (!c.valid) body = empty(c.inverted ? 'Corrige las fechas para ver el plan del mini cut.' : 'Elige la fecha inicial y la final para ver el plan y el avance del mini cut.');
    else if (c.p0 == null) body = empty('Falta el peso del atleta: ingrésalo en «Requerimientos» o registra pesajes en «Seguimiento › Registro diario de peso».');
    else if (!c.pctOk) body = empty('Indica el % de pérdida buscado por semana para calcular la trayectoria.');
    else {
      const elapsed = daysBetween(m.inicio, today);
      const when = elapsed < 0 ? `Comienza el ${fmtDate(m.inicio)}` : elapsed > c.days ? 'Terminado' : `Día ${elapsed + 1} de ${c.days + 1}`;
      const goalW = c.goal != null ? Math.max(0, Math.min(100, c.goal)) : 0;
      body = `
        <div class="grid g2">
          <div>
            <div class="label">Plan</div>
            ${L('Peso inicial', `${fmt(c.p0, 1)} kg <span class="muted small">· ${c.p0src}</span>`)}
            ${L('Peso final esperado', `${fmt(c.pEnd, 1)} kg`)}
            ${L('Pérdida esperada', `${fmtS(-c.kgTotal, 2)} kg <span class="muted small">(${fmtS(-c.pctTotal, 1)} %)</span>`)}
            ${L('Déficit diario estimado', `${fmt(c.kcalDia)} kcal`)}
            ${L('Kcal a consumir', c.kcal != null ? `<span class="kc">${fmt(c.kcal)}</span>` : '<span class="muted small">Completa el GET en Requerimientos</span>')}
          </div>
          <div>
            <div class="label">Avance</div>
            ${L('Momento', when)}
            ${c.last ? `
              ${L(`Promedio semana ${c.last.k + 1}`, `${fmt(c.last.v, 2)} kg`)}
              ${L('Objetivo a esa fecha', `${fmt(c.expected, 2)} kg`)}
              ${L('Diferencia frente al objetivo', `${fmtS(c.last.v - c.expected, 2)} kg <span class="muted small">${c.last.v - c.expected > 0 ? '(por encima)' : '(en meta o por debajo)'}</span>`)}
              <div class="stat-line" style="display:block"><div style="display:flex;justify-content:space-between"><span>Pérdida lograda</span><b>${fmtS(-c.lost, 2)} de ${fmtS(-c.kgTotal, 2)} kg${c.goal != null ? ` · ${fmt(c.goal, 0)} %` : ''}</b></div>
                <div class="progress" role="progressbar" aria-label="Avance hacia la meta del mini cut" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(goalW)}"><span style="width:${goalW}%;--c:var(--ok)"></span></div></div>`
            : `<div class="small muted mt8">El avance aparece cuando haya pesajes desde la semana 2 del mini cut en «Seguimiento › Registro diario de peso».</div>`}
          </div>
        </div>
        <div class="row mt16" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div class="label" style="margin:0">Avance del peso</div>
          <div class="legend"><span><i class="dot" style="background:var(--chart-dots)"></i>Peso diario</span><span><i style="background:var(--accent)"></i>Promedio semanal</span><span><i class="dash"></i>Trayectoria objetivo</span></div>
        </div>
        <div class="mt8 mc-chart">${miniCutChart(c)}</div>
        ${c.daily.length ? '' : '<div class="small muted mt8">Aún no hay pesajes entre estas fechas: el gráfico muestra solo la trayectoria objetivo.</div>'}`;
    }
    return `
    <section class="card ${cls}" id="minicut">
      ${head}
      <div class="card-body">
        <div class="grid g3">
          ${date('inicio', 'inicio', 'Fecha inicial')}
          ${date('termino', 'fin', 'Fecha final')}
          ${F('% de pérdida de grasa buscado', suffix(I(`${sp}.objetivo`, { num: true, live: true, ph: 'Ej.: 1' }), '% / sem'), 'Del peso corporal, por semana. En un mini cut suele ser 0,75–1,25 %.')}
        </div>
        <div class="hint mt8">Son los mismos datos de la etapa ${ms.i + 1} «Mini cut» en Seguimiento › Configuración: lo que cambies aquí se ve allá y en el registro.</div>
        ${note}
        <div class="mt16">${body}</div>
      </div>
    </section>`;
  }

  // ---------------- Distribución ----------------
  // Nombre de la preparación en el Menú diario: la descripción de la opción principal (★) o, si no tiene, la de la primera opción que tenga.
  function mealMenuName(m) {
    const t = (o) => String((o && o.title) || '').trim();
    return t(m.options[m.sel || 0]) || t(m.options.find((o) => t(o))) || '';
  }
  function viewDist() {
    const a = A(), dt = activeDay(a), di = a.dayTypes.indexOf(dt), t = dayTargets(a, dt);
    // Lista de comidas: nombre, imagen de la opción principal (★) del menú, hora e indicaciones para el atleta.
    const mealImg = (m) => { const o = m.options[m.sel || 0]; return (o && o.image) || (m.options.find((x) => x.image) || {}).image || null; };
    const n = dt.meals.length;
    const items = dt.meals.map((m, i) => {
      const base = `dayTypes.${di}.meals.${i}`, img = mealImg(m), nm = esc(m.name || `Comida ${i + 1}`);
      // «Traer nombre del menú»: copia al nombre la descripción que tiene la opción principal (★) en el Menú diario.
      // Tiempo de comida (m.name: Desayuno, Almuerzo…) y nombre de la comida (descripción de la opción ★ del Menú diario), enlazados.
      const si = clamp(m.sel || 0, 0, Math.max(0, m.options.length - 1)), dish = (m.options[si] && m.options[si].title) || '';
      // El nombre ocupa todo el ancho del recuadro y crece hacia abajo si es largo, para que siempre se lea completo.
      return `<article class="card dm-item">
        <div class="dm-name"><span class="meal-idx">${pad(i + 1)}</span>
          <div class="dm-names">
            <label class="dm-lab" for="dm-tm-${i}">Tiempo de comida</label>
            <div class="dm-name-wrap" data-v="${esc(m.name || '')}"><textarea class="input" id="dm-tm-${i}" rows="1" data-bind="${base}.name" data-live data-oneline placeholder="Ej.: Desayuno" aria-label="Tiempo de comida ${i + 1}">${esc(m.name || '')}</textarea></div>
            ${m.options.length ? `<label class="dm-lab" for="dm-dish-${i}">Nombre de la comida <span class="muted">· opción ★ del Menú diario</span></label>
            <div class="dm-name-wrap dm-dish" data-v="${esc(dish)}"><textarea class="input" id="dm-dish-${i}" rows="1" data-bind="${base}.options.${si}.title" data-live data-oneline placeholder="Ej.: Avena con yogur, plátano y pan con huevo" aria-label="Nombre de la comida ${i + 1}">${esc(dish)}</textarea></div>` : ''}
          </div></div>
        <div class="dm-left">
          <button type="button" class="dm-img${img ? ' has' : ''}" data-action="openMealInMenu" data-id="${m.id}" title="${img ? 'Ver esta comida en el Menú diario' : 'Agregar la imagen en el Menú diario'}">
            ${img ? `<img src="${imgSrc(img)}" alt="Imagen de ${nm}" loading="lazy">` : `<span class="dm-ph">${ic('image', 22)}<span>Sin imagen</span><span class="small">Se agrega en el Menú diario</span></span>`}
            <span class="dm-link">${ic('menu', 13)} ${img ? 'Ver en el menú' : 'Ir al menú'}</span>
          </button>
        </div>
        <div class="dm-right">
          <div class="dm-top">
            <div class="field dm-time"><label for="dm-time-${i}">Hora</label>${I(`${base}.time`, { ph: '00:00', attrs: `id="dm-time-${i}" autocomplete="off"` })}</div>
            <span class="spacer"></span>
            <div class="dm-actions">
              <button class="btn sm ghost icon" data-action="moveMeal" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} title="Subir" aria-label="Subir ${nm}">${ic('arrowUp', 14)}</button>
              <button class="btn sm ghost icon" data-action="moveMeal" data-i="${i}" data-d="1" ${i === n - 1 ? 'disabled' : ''} title="Bajar" aria-label="Bajar ${nm}">${ic('arrowDown', 14)}</button>
              <button class="btn sm ghost icon danger" data-action="delMeal" data-i="${i}" title="Eliminar comida" aria-label="Eliminar ${nm}">${ic('trash', 14)}</button>
            </div>
          </div>
          <div class="field dm-ind"><label for="dm-ind-${i}">Indicaciones</label>${TA(`${base}.indic`, { rows: 4, ph: 'Instrucciones para esta comida: cómo prepararla, cuándo tomarla, qué se puede cambiar…', attrs: `id="dm-ind-${i}"` })}</div>
        </div>
      </article>`;
    }).join('');
    // Recuadros finales editables (por atleta). Mientras no se editen muestran el texto de siempre.
    const note = (k, title, cls) => `<div class="callout small callout-edit ${cls}">
        <label class="ce-head" for="dn-${k}"><b>${title}</b>${ic('edit', 13)}</label>
        <textarea class="textarea" id="dn-${k}" data-bind="distNotes.${k}" rows="4" placeholder="Escribe aquí…">${esc((a.distNotes && a.distNotes[k] != null) ? a.distNotes[k] : DIST_NOTES[k])}</textarea>
      </div>`;
    return `
    ${daySeg(a)}
    ${t.ok ? `<div class="dm-sticky" role="group" aria-label="Calorías y macros del día · ${esc(dt.name)}">${targetTiles(t, t.peso)}</div>` : '<div class="callout">Completa los requerimientos para ver las calorías y los macros del día.</div>'}
    <div class="dm-head">
      <div><h3>Distribución de comidas diarias · ${esc(dt.name)}</h3><div class="sub">${n} ${n === 1 ? 'comida' : 'comidas'} · la imagen es la de la opción principal (★) del Menú diario</div></div>
      <span class="spacer"></span>
      <button class="btn primary sm" data-action="addMeal">${ic('plus', 14)} Agregar comida</button>
    </div>
    <div class="dm-list">${items || '<div class="card card-pad muted center">Este día aún no tiene comidas. Pulsa «Agregar comida».</div>'}</div>
    <div class="grid g2 mt16">
      ${note('org', 'Cómo organizarte', '')}
      ${note('tip', 'Tip', 'info')}
    </div>`;
  }

  // ---------------- Menú diario ----------------
  // ---------------- Calendario de alimentación (Menú diario) ----------------
  // Qué tipo de día de la minuta toca cada fecha. a.calendar = { 'aaaa-mm-dd': id del tipo de día }.
  const calOf = (a) => { if (!isPlain(a.calendar)) a.calendar = {}; return a.calendar; };
  const calType = (a, d) => { const id = a && a.calendar && a.calendar[d]; return id ? (a.dayTypes || []).find((x) => x.id === id) || null : null; };
  const dtInitial = (dt) => (String((dt && dt.name) || '?').trim()[0] || '?').toUpperCase();
  // Tipo de día de entrenamiento y de descanso (por nombre; si no, el 1.º y el 2.º).
  function trainRest(a) {
    const dts = a.dayTypes || [];
    const train = dts.find((x) => /entren/i.test(x.name || '')) || dts[0];
    const rest = dts.find((x) => /descans/i.test(x.name || '')) || dts.find((x) => x !== train) || train;
    return { train, rest };
  }
  let fcFolded = lsGet('prepcoach-calfold') === '1';
  // Mes visible del calendario ('aaaa-mm'): siempre parte en el mes actual; las flechas solo cambian la vista.
  const fcMonth = () => T.fcMonth || todayISO().slice(0, 7);
  const fcShift = (ym, n) => { const [y, m] = ym.split('-').map(Number), d = new Date(y, m - 1 + n, 1, 12); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const fcBrushOf = (a) => (T.fcBrush === 'clear' ? 'clear' : a.dayTypes.some((x) => x.id === T.fcBrush) ? T.fcBrush : a.dayTypes[0].id);
  function fcDayBtn(a, iso, today) {
    const dt = calType(a, iso), dn = +iso.slice(8), isToday = iso === today;
    const lab = `${DAYS[parseISO(iso).getDay()]} ${fmtDate(iso)}${isToday ? ' (hoy)' : ''}${dt ? ' · ' + dt.name : ' · sin asignar'}`;
    return `<button type="button" class="fc-day${dt ? ' on' : ''}${isToday ? ' today' : ''}" data-fc="${iso}"${dt ? ` style="--dc:${esc(dt.color || 'var(--accent)')}"` : ''} title="${esc(lab)}" aria-label="${esc(lab)}">`
      + `<span class="n">${dn}</span>${isToday ? '<em>Hoy</em>' : ''}${dt ? `<span class="t">${esc(dt.name)}</span><span class="i">${esc(dtInitial(dt))}</span>` : ''}</button>`;
  }
  function feedCalendar(a) {
    const ym = fcMonth(), [y, m] = ym.split('-').map(Number), cal = calOf(a), today = todayISO(), brush = fcBrushOf(a);
    const counts = {}; Object.keys(cal).forEach((d) => { if (d.startsWith(`${ym}-`) && calType(a, d)) counts[cal[d]] = (counts[cal[d]] || 0) + 1; });
    const total = Object.values(counts).reduce((x, n) => x + n, 0), mName = `${CAL_M[m - 1]} ${y}`;
    const bBtn = (id, label, sw, n) => `<button type="button" class="fc-brush${brush === id ? ' on' : ''}" data-action="fcBrush" data-id="${esc(id)}" aria-pressed="${brush === id}">${sw}${esc(label)}${n != null ? `<small>${n}</small>` : ''}</button>`;
    const brushes = a.dayTypes.map((dt) => bBtn(dt.id, dt.name, `<span class="sw" style="--dc:${esc(dt.color || 'var(--accent)')}">${esc(dtInitial(dt))}</span>`, counts[dt.id] || 0)).join('')
      + bBtn('clear', 'Quitar', '<span class="sw clear"></span>')
      + (a.dayTypes.length < 3 ? `<button type="button" class="fc-brush add" data-action="addDayType">${ic('plus', 13)} Tercer tipo de día</button>` : '');
    const lead = (new Date(y, m - 1, 1, 12).getDay() + 6) % 7, nd = new Date(y, m, 0).getDate();
    let cells = '<span class="fc-blank"></span>'.repeat(lead);
    for (let d = 1; d <= nd; d++) cells += fcDayBtn(a, `${ym}-${pad(d)}`, today);
    const isNow = ym === today.slice(0, 7);
    return `<section class="card fc-card no-print" id="feed-cal" aria-label="Calendario de alimentación">
      <div class="card-head"><h3>Calendario de alimentación</h3><span class="sub">${total ? `${total} ${total === 1 ? 'día asignado' : 'días asignados'} en ${CAL_M[m - 1].toLowerCase()}` : 'Asigna a cada día su tipo de alimentación'}</span><span class="spacer"></span>
        <button type="button" class="btn sm ghost" data-action="fcFold" aria-expanded="${!fcFolded}">${ic(fcFolded ? 'arrowDown' : 'arrowUp', 14)} ${fcFolded ? 'Mostrar' : 'Ocultar'}</button></div>
      ${fcFolded ? '' : `<div class="card-body">
        <div class="fc-tools"><div class="fc-brushes" role="group" aria-label="Tipo de día a aplicar">${brushes}</div>
          <div class="fc-quick"><button type="button" class="btn sm" data-action="fcFill" title="Llena los días sin asignar de cada etapa con sus días de entrenamiento (Seguimiento › Configuración)">${ic('cal', 14)} Completar con Configuración</button>
            <button type="button" class="btn sm ghost danger" data-action="fcClear" ${total ? '' : 'disabled'}>Vaciar ${CAL_M[m - 1].toLowerCase()}</button></div></div>
        <div class="fc-nav mt16">
          <button type="button" class="btn sm icon" data-action="fcMonth" data-d="-1" aria-label="Mes anterior" title="Mes anterior">${ic('chevL', 16)}</button>
          <div class="fc-title" aria-live="polite">${mName}</div>
          <button type="button" class="btn sm icon" data-action="fcMonth" data-d="1" aria-label="Mes siguiente" title="Mes siguiente">${ic('chevR', 16)}</button>
          ${isNow ? '' : '<button type="button" class="btn xs ghost" data-action="fcToday">Volver al mes actual</button>'}
        </div>
        <div class="fc-grid mt8">${DOW_N.map((l) => `<span class="fc-dow" title="${l}">${l.slice(0, 3)}</span>`).join('')}${cells}</div>
        <div class="hint mt12">Elige un tipo de día y toca los días (o arrastra sobre varios). Tocar un día que ya tiene ese tipo lo deja sin asignar. Las asignaciones quedan guardadas al cambiar de mes. El calendario sale en el documento que se descarga y define las comidas de «Hambre» en el registro diario.</div>
      </div>`}
    </section>`;
  }
  function viewMenu() {
    const a = A(), dt = activeDay(a), di = a.dayTypes.indexOf(dt), t = dayTargets(a, dt), tot = dayTotals(dt);
    const SHORT = { Kcal: 'Kcal', 'Proteínas': 'P', Carbohidratos: 'C', Grasas: 'G' };
    const sumItem = (l, v, tv, u, cls) => { const p = adq(v, tv); return `<div class="sum-item"><div class="si-top"><span class="si-l"><span class="si-full">${l}</span><span class="si-short">${SHORT[l] || l}</span></span><span class="adq ${adqCls(p)}">${p != null ? fmt(p) + '%' : ''}</span></div>
      <div class="si-v"><span class="${cls}">${fmt(v)}</span> <small>/ ${fmt(tv)} ${u}</small></div><div class="progress" style="--c:var(${cls === 'kc' ? '--c-kcal' : cls === 'kp' ? '--c-p' : cls === 'kcarb' ? '--c-c' : '--c-g'})"><span style="width:${clamp(p || 0, 0, 100)}%"></span></div></div>`; };
    return `${feedCalendar(a)}
    ${daySeg(a, `${dt.meals.length && dt.meals.every((m) => collapsed.has(m.id))
      ? `<button class="btn sm ghost" data-action="expandAll">${ic('arrowDown', 14)} Expandir todas</button>`
      : `<button class="btn sm ghost" data-action="collapseAll">${ic('arrowUp', 14)} Contraer todas</button>`}`)}
    <div class="menu-sticky">
    <section class="card day-summary" aria-label="Total diario">
      <div class="row ds-head"><b>${esc(dt.name)} · total del día</b><span class="muted small ds-sub">Suma de las opciones principales (★) vs. macros calculados · adecuación</span></div>
      <div class="sum-grid">
        ${sumItem('Kcal', tot.kcal, t.kcal, 'kcal', 'kc')}${sumItem('Proteínas', tot.p, t.p, 'g', 'kp')}${sumItem('Carbohidratos', tot.c, t.c, 'g', 'kcarb')}${sumItem('Grasas', tot.g, t.g, 'g', 'kg')}
      </div>
    </section>
    ${clip ? `<div class="clip-bar no-print" role="status">${ic('paste', 16)}<div><b>Copiado:</b> ${clip.kind === 'opt' ? 'opción' : 'alimento'} «${esc(clip.label)}» <span class="muted">· de ${esc(clip.from)}</span><div class="small muted">Usa <b>Pegar</b> en la comida donde lo quieras (también en otros tipos de día).</div></div><span class="spacer"></span><button class="btn xs ghost" data-action="clearClip">${ic('x', 13)} Cancelar</button></div>` : ''}
    </div>
    <div class="meals">${dt.meals.map((m, i) => mealCard(a, dt, di, m, i, t)).join('')}</div>
    <div class="row mt16 no-print"><button class="btn" data-action="addMeal">${ic('plus', 14)} Agregar comida</button></div>
    <section class="card mt16">
      <div class="card-head"><h3>Notas generales del día</h3><span class="sub">Hidratación, reemplazos, indicaciones de la etapa…</span></div>
      <div class="card-body">${TA(`dayTypes.${di}.notes`, { rows: 4, ph: 'Ej.: 2 vasos de agua antes de cada comida. Puedes acompañar con café o té sin azúcar…' })}</div>
    </section>`;
  }

  function mealCard(a, dt, di, m, i, t) {
    const mi = `dayTypes.${di}.meals.${i}`;
    const oi = clamp(m.active || 0, 0, m.options.length - 1), o = m.options[oi], op = `${mi}.options.${oi}`;
    const tot = optTotals(o);
    const lines = o.foods.map((l, li) => {
      const x = lineCalc(l), lp = `${op}.foods.${li}`, fName = x.f ? x.f.name : (l.foodName || '');
      return `<tr>
        <td class="pad0 c-food"><input class="cell ${!x.f && fName ? 'invalid' : ''}" data-food="${lp}" value="${esc(fName)}" placeholder="Buscar alimento…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="food-dd"></td>
        <td class="porc">${x.f ? esc(x.f.porcion || (x.f.gpp ? x.f.gpp + ' g' : '')) : ''}</td>
        <td class="c-qty"><label class="qty-field">${ic('edit', 13)}${I(`${lp}.cantidad`, { cls: 'qty-input', ph: 'Escribe la indicación…', attrs: `aria-label="Cantidad indicada para el atleta" title="Ej.: 1 unidad picada, 2 cdas, 1 taza cocida"` })}</label></td>
        <td class="pad0 c-n">${I(`${lp}.porciones`, { cls: 'cell', num: true, live: true, ph: '0' })}</td>
        <td class="pad0 c-n">${x.f && x.f.gpp ? `<input class="cell num" inputmode="decimal" data-grams="${lp}" data-gpp="${x.f.gpp}" value="${x.gramos != null ? r1(x.gramos) : ''}" placeholder="g">` : '<span class="muted small" style="padding:0 8px">unidad</span>'}</td>
        <td class="m kc">${fmt(x.kcal)}</td><td class="m kp">${fmt(x.p, 1)}</td><td class="m kcarb">${fmt(x.c, 1)}</td><td class="m kg">${fmt(x.g, 1)}</td>
        <td class="nowrap no-print" style="width:64px"><button class="btn xs ghost icon ${clip && clip.kind === 'food' && clip.data === l ? 'copied' : ''}" data-action="copyLine" data-p="${op}" data-i="${li}" title="Copiar este alimento para pegarlo en otra comida">${ic('copy', 13)}</button><button class="btn xs ghost icon danger" data-action="delLine" data-p="${op}" data-i="${li}" title="Quitar">${ic('x', 13)}</button></td></tr>`;
    }).join('');
    const col = collapsed.has(m.id), main = optTotals(m.options[m.sel] || m.options[0]);
    // Equivalencia con la opción principal (★): visible al crear o editar otra opción de la misma comida.
    const selN = `${i + 1}.${(m.sel || 0) + 1}`, cmp = oi !== m.sel;
    const dv = (v, ref, d = 0) => { const x = v - ref, ok = Math.abs(x) <= Math.max(d ? 2 : 25, Math.abs(ref) * 0.05);
      return `<span class="eq-d ${ok ? 'ok' : 'off'}">${x > 0 ? '+' : x < 0 ? '−' : '±'}${fmt(Math.abs(x), d)}</span>`; };
    const eqBox = cmp ? `<div class="eq-box">
        <div class="eq-head">${ic('star', 15)}<b>Equivalencia con ★ Opción ${selN}</b><span class="muted small">la opción que cuenta en el total del día</span></div>
        <div class="eq-grid">
          <div class="eq-l"></div><div class="eq-c kc">Kcal</div><div class="eq-c kp">P (g)</div><div class="eq-c kcarb">C (g)</div><div class="eq-c kg">G (g)</div>
          <div class="eq-l">★ Opción ${selN}</div><div class="eq-c">${fmt(main.kcal)}</div><div class="eq-c">${fmt(main.p, 1)}</div><div class="eq-c">${fmt(main.c, 1)}</div><div class="eq-c">${fmt(main.g, 1)}</div>
          <div class="eq-l">Esta opción (${i + 1}.${oi + 1})</div><div class="eq-c"><b>${fmt(tot.kcal)}</b></div><div class="eq-c"><b>${fmt(tot.p, 1)}</b></div><div class="eq-c"><b>${fmt(tot.c, 1)}</b></div><div class="eq-c"><b>${fmt(tot.g, 1)}</b></div>
          <div class="eq-l">Diferencia</div><div class="eq-c">${dv(tot.kcal, main.kcal)}</div><div class="eq-c">${dv(tot.p, main.p, 1)}</div><div class="eq-c">${dv(tot.c, main.c, 1)}</div><div class="eq-c">${dv(tot.g, main.g, 1)}</div>
        </div>
        <div class="small muted mt8">Verde = equivalente (±5 %, o ±25 kcal / ±2 g). Ámbar = conviene ajustar porciones.</div>
      </div>` : '';
    return `<section class="card meal ${col ? 'collapsed' : ''}" id="meal-${m.id}">
      <div class="meal-top" data-action="toggleMeal" data-id="${m.id}">
        <button type="button" class="meal-chev" aria-expanded="${!col}" aria-label="${col ? 'Mostrar' : 'Ocultar'} ${esc(m.name)}" title="${col ? 'Mostrar comida' : 'Ocultar comida'}">${ic('arrowDown', 16)}</button>
        <span class="meal-idx">${pad(i + 1)}</span>
        <div class="meal-name-edit"><input class="meal-name-in" data-bind="${mi}.name" data-live value="${esc(m.name || '')}" placeholder="Tiempo de comida (ej.: Desayuno)" aria-label="Tiempo de comida ${i + 1}" title="Tiempo de comida: se edita aquí y se actualiza en Distribución, Seguimiento y la minuta"><div class="meal-time">${esc(m.time || '')}${col ? ` · ${m.options.length} ${m.options.length === 1 ? 'opción' : 'opciones'}` : ''}</div></div>
        <span class="spacer"></span>
        <div class="meal-target">
          ${col || m.options.length > 1 ? `<div class="meal-main">★ Opción ${i + 1}.${(m.sel || 0) + 1}: <b>${fmt(main.kcal)} kcal</b> · P ${fmt(main.p)} · C ${fmt(main.c)} · G ${fmt(main.g)}</div>` : ''}
        </div>
        ${clip ? `<button type="button" class="btn sm paste-btn no-print" data-action="pasteClip" data-m="${mi}" title="Pegar ${clip.kind === 'opt' ? 'como opción nueva de esta comida' : 'en la opción visible de esta comida'}: ${esc(clip.label)}">${ic('paste', 14)} Pegar ${clip.kind === 'opt' ? 'opción' : 'alimento'}</button>` : ''}
        <button type="button" class="btn sm ghost icon danger no-print" data-action="delMeal" data-i="${i}" title="Eliminar esta comida" aria-label="Eliminar ${esc(m.name)}">${ic('trash', 15)}</button>
      </div>
      <div class="meal-content" ${col ? 'hidden' : ''}>
      <div class="opt-tabs">
        ${m.options.map((x, k) => `<button class="opt-tab ${k === oi ? 'active' : ''}" data-action="viewOpt" data-m="${mi}" data-k="${k}">${k === m.sel ? '<span class="star">★</span>' : ''}Opción ${i + 1}.${k + 1}</button>`).join('')}
        <button class="btn xs ghost" data-action="addOpt" data-m="${mi}">${ic('plus', 13)} Opción</button>
        <span class="spacer"></span>
        ${oi !== m.sel ? `<button class="btn xs" data-action="setMain" data-m="${mi}" data-k="${oi}">★ Usar en el total del día</button>` : '<span class="small muted">★ Cuenta en el total del día</span>'}
        <button class="btn xs" data-action="copyTo" data-m="${mi}" data-k="${oi}" title="Copiar esta opción o la comida completa a otro tipo de día">${ic('send', 13)} Copiar a otro día</button>
        <button class="btn xs ghost ${clip && clip.kind === 'opt' && clip.srcId === o.id ? 'copied' : ''}" data-action="copyOpt" data-m="${mi}" data-k="${oi}" title="Copiar esta opción para pegarla en otra comida">${ic('copy', 13)} ${clip && clip.kind === 'opt' && clip.srcId === o.id ? 'Copiada' : 'Copiar'}</button>
        ${m.options.length > 1 ? `<button class="btn xs ghost danger" data-action="delOpt" data-m="${mi}" data-k="${oi}" title="Eliminar opción">${ic('trash', 13)}</button>` : ''}
      </div>
      <div class="meal-body">
        ${o.image ? `<div class="img-drop img-has"><img src="${imgSrc(o.image)}" alt="Imagen de la opción"><div class="img-actions">${filePick(`${op}.image`, false, 'btn xs', `${ic('image', 13)} Cambiar`)}<button class="btn xs danger" data-action="clearImage" data-p="${op}.image">${ic('trash', 13)}</button></div></div>`
          : filePick(`${op}.image`, false, 'img-drop', `<div class="img-cta">${ic('image', 22)}<span>Agregar imagen de la preparación</span><span class="small">JPG, PNG o foto de la cámara · se optimiza automáticamente</span></div>`)}
        ${eqBox}
        ${F('Nombre de la comida', I(`${op}.title`, { ph: 'Ej.: Avena con yogur, plátano y pan con huevo', attrs: 'aria-label="Nombre de la comida"' }), oi === m.sel ? 'Es el nombre que aparece en Distribución de comidas, en la minuta y en el portal del cliente.' : '')}
        <div class="table-wrap">
          <table class="t foods-table">
            <thead><tr><th>Alimento</th><th>Porción de intercambio</th><th class="qty-th">${ic('edit', 12)} Cantidad indicada <span>(para el atleta)</span></th><th class="num">Porciones</th><th class="num">Gramos</th><th class="num">Kcal</th><th class="num">P (g)</th><th class="num">C (g)</th><th class="num">G (g)</th><th></th></tr></thead>
            <tbody>${lines || `<tr><td colspan="10" class="muted center" style="padding:18px">Sin alimentos. Agrega el primero.</td></tr>`}</tbody>
            <tfoot>
              <tr><td colspan="5"><b>Aporte total</b></td><td class="m kc">${fmt(tot.kcal)}</td><td class="m kp">${fmt(tot.p, 1)}</td><td class="m kcarb">${fmt(tot.c, 1)}</td><td class="m kg">${fmt(tot.g, 1)}</td><td></td></tr>
              ${cmp ? `<tr class="target-row eq-row"><td colspan="5">★ Opción ${selN} (total del día) · diferencia</td>
                <td class="m">${fmt(main.kcal)} ${dv(tot.kcal, main.kcal)}</td><td class="m">${fmt(main.p, 1)} ${dv(tot.p, main.p, 1)}</td><td class="m">${fmt(main.c, 1)} ${dv(tot.c, main.c, 1)}</td><td class="m">${fmt(main.g, 1)} ${dv(tot.g, main.g, 1)}</td><td></td></tr>` : ''}
            </tfoot>
          </table>
        </div>
        <div class="no-print"><button class="btn sm" data-action="addLine" data-p="${op}">${ic('plus', 14)} Agregar alimento</button></div>
        ${F('Notas', TA(`${op}.notes`, { rows: 3, ph: 'Reemplazos, preparación, indicaciones…' }))}
      </div>
      </div>
    </section>`;
  }

  // ---------------- Seguimiento ----------------
  function viewSeg() {
    const a = A(), tab = a.ui.trackTab || 'panel';
    const v = { panel: segPanel, diario: segDaily, semanal: segWeekly, guia: segGuide, config: segConfig };
    return (v[tab] || segPanel)(a);
  }

  function segPanel(a) {
    const N = weekCount(a), cw = currentWeek(a);
    let k = a.ui.panelWeek; if (k == null || k > N || k < 0) k = cw;
    const st = status(a, k), l = logrado(a, k), b = buscado(a, k), avg = weekAvg(a, k), avg0 = weekAvg(a, 0);
    const w = wk(a, k), n = weekWeights(a, k).length, steps = weekSteps(a, k), sk = stageOfWeek(a, k), meta = num(sk && sk.pasos) ?? num(cfgOf(a).metaPasos);
    const kpi = (lab, val, note) => `<div class="card kpi"><div class="k-label">${lab}</div><div class="k-value">${val}</div><div class="k-note">${note}</div></div>`;
    const metric = a.ui.chartMetric || 'abd';
    const metrics = [['abd', 'Suma abdominal (cm)', (x) => sumAbd(x)], ['pl', 'Σ 4 pliegues (mm)', (x) => sumPl(x)], ['pecho', 'Pecho (cm)', (x) => num(x.pecho)], ['brazo', 'Brazos (cm)', (x) => num(x.brazo)], ['cadera', 'Cadera (cm)', (x) => num(x.cadera)], ['muslo', 'Muslos (cm)', (x) => num(x.muslo)]];
    const mdef = metrics.find((x) => x[0] === metric) || metrics[0];
    const mPts = Array.from({ length: N + 1 }, (_, i) => ({ x: parseISO(weekStart(a, i)).getTime(), y: mdef[2](weekMeasures(a, i)), label: weekLabel(i) })).filter((p) => p.y != null);
    // Escalas de la semana: promedio de los días anotados, con aviso si faltan días.
    const scv = (f) => weekField(a, k, f);
    const incNote = (...rs) => { const r = rs.find((x) => x.n > 0 && x.n < 7); return r ? `<span class="inc-pill">Incompleto · ${r.n}/7 días · faltan ${7 - r.n}</span> ` : ''; };
    const adh = scv('adh'), sue = scv('sueno'), ene = scv('energia'), sac = scv('saciedad');
    const scTxt = (r) => (r.avg != null ? `<span class="sc-val" style="--sc:${scaleColor(r.avg, 0, 5)}">${fmt(r.avg, 1)}</span>` + (r.n < 7 ? '<small>*</small>' : '') : '—');
    return `
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div class="muted">Selecciona una semana para consultar su progreso, compararlo con el objetivo y revisar la evolución del proceso.</div>
      <div class="row"><span class="label">Semana a consultar</span>
        <select class="select" data-bind="ui.panelWeek" data-type="num" style="width:auto;min-width:220px">${Array.from({ length: N + 1 }, (_, i) => i).map((i) => `<option value="${i}" ${i === k ? 'selected' : ''}>${weekLabel(i)} · ${fmtDate(weekStart(a, i))}${i === cw ? ' (actual)' : ''}</option>`).join('')}</select></div>
    </div>
    <section class="card status-hero">
      <div><div class="k-label label">CÓMO VAS ESTA SEMANA</div><div class="status-big ${st.key}">${st.label.toUpperCase()}</div><div class="muted small mt8">${st.msg}</div></div>
      <div><div class="label">Cambio semanal logrado</div><div class="big-num" style="font-size:28px">${l != null ? fmtS(l) + '%' : '—'}</div></div>
      <div><div class="label">Objetivo · ${weekLabel(k)} · ${fmtDate(weekStart(a, k))}</div><div class="big-num" style="font-size:28px">${b != null ? fmtS(b) + '%' : '—'}</div></div>
      <div><div class="label">Diferencia frente a la meta</div><div class="big-num" style="font-size:28px">${l != null && b != null ? fmtS(l - b) + ' pp' : '—'}</div><div class="small muted">Tolerancia ± ${fmt(num(cfgOf(a).tol), 2)} pp · Etapa: ${esc(weekEtapa(a, k))}</div></div>
    </section>
    <div class="grid g4 mt16">
      ${kpi('Peso promedio · semana', avg != null ? `${fmt(avg, 2)}<small>kg</small>` : '—', 'Promedio de los pesajes diarios de la semana.')}
      ${kpi('Cambio desde el inicio', avg != null && avg0 != null ? `${fmtS(avg - avg0, 1)}<small>kg</small>` : '—', `Frente al peso inicial (${fmt(avg0, 1)} kg).`)}
      ${kpi('Semana analizada', `${weekLabel(k)}`, `${fmtDate(weekStart(a, k))} – ${fmtDate(addDays(weekStart(a, k), 6))}`)}
      ${kpi('Pesajes · 7 días', `${n}<small>/ 7</small>`, n < 3 ? 'Mínimo recomendado: 3 pesajes semanales.' : 'Días con peso registrado durante la semana.')}
      ${(() => { const sd = weekStepsDays(a, k), miss = stepsIncomplete(a, k);
        const note = (miss ? `<span class="inc-pill">Incompleto · ${sd}/7 días · faltan ${miss} por ingresar</span>` : sd === 7 ? '<span class="small">Semana completa · 7/7 días.</span> ' : '')
          + (meta ? ` Meta diaria: ${fmt(meta)} pasos.` : sd ? '' : ' Promedio de pasos, cuando se registra.');
        return kpi('Pasos · promedio diario', steps != null ? `${fmt(steps)}${miss ? '<small>*</small>' : ''}` : '—', note); })()}
      ${kpi('Adherencia · promedio', adh.avg != null ? `${scTxt(adh)}<small>/ 5</small>` : '—', incNote(adh) + 'Si baja de 4, el problema es la adherencia, no la dieta.')}
      ${kpi('Sueño / energía · promedio', `${scTxt(sue)} / ${scTxt(ene)}`, incNote(sue, ene) + 'Escalas 0–5. Bajo 3 sostenido es señal de alerta.')}
      ${kpi('Saciedad · promedio', sac.avg != null ? `${scTxt(sac)}<small>/ 5</small>` : '—', incNote(sac) + 'Saciedad percibida (escala 0 a 5).')}
    </div>
    <section class="card mt16">
      <div class="card-head"><h3>Evolución del peso</h3><span class="spacer"></span>
        <div class="legend"><span><i class="dot" style="background:var(--chart-dots)"></i>Peso diario</span><span><i style="background:var(--accent)"></i>Promedio semanal</span><span><i class="dash"></i>Trayectoria objetivo</span></div></div>
      <div class="card-body">${weightChart(a)}</div>
    </section>
    <section class="card mt16">
      <div class="card-head"><h3>Composición corporal por semana</h3><span class="spacer"></span>
        ${SEL('ui.chartMetric', metrics.map((x) => [x[0], x[1]]), { attrs: 'style="width:auto;height:32px"' })}</div>
      <div class="card-body">${mPts.length ? chartSVG([{ pts: mPts, color: 'var(--c-c)', type: 'line' }], { fmtY: (v) => fmt(v, 1), height: 220 }) : '<div class="muted center" style="padding:30px">Registra pliegues o perímetros en el “Registro diario de peso” para ver la tendencia (se grafica el promedio de cada semana).</div>'}</div>
    </section>`;
  }

  function weightChart(a) {
    const N = weekCount(a);
    const daily = [];
    for (let k = 0; k <= N; k++) weekDays(a, k).forEach((d) => { const v = num(dailyOf(a, d).peso); if (v != null) daily.push({ x: parseISO(d).getTime(), y: v, label: `${fmtDate(d)} · ${fmt(v, 1)} kg` }); });
    const avgs = []; const target = [];
    let tgt = weekAvg(a, 0);
    for (let k = 0; k <= N; k++) {
      const x = parseISO(addDays(weekStart(a, k), 3)).getTime();
      const v = weekAvg(a, k); if (v != null) avgs.push({ x, y: v, label: `${weekLabel(k)} · ${fmt(v, 2)} kg` });
      if (tgt != null) { if (k > 0) tgt = tgt * (1 + (buscado(a, k) || 0) / 100); target.push({ x, y: tgt, label: `Objetivo ${weekLabel(k)} · ${fmt(tgt, 2)} kg` }); }
    }
    if (!daily.length && avgs.length <= 1) return '<div class="muted center" style="padding:40px">Aún no hay pesajes. Regístralos en “Registro diario de peso”.</div>';
    return chartSVG([{ pts: target, color: 'var(--muted)', type: 'dash' }, { pts: daily, color: 'var(--chart-dots)', type: 'dots' }, { pts: avgs, color: 'var(--accent)', type: 'line' }], { fmtY: (v) => fmt(v, 1), height: 300 });
  }

  function chartSVG(series, { height = 280, fmtY = (v) => v } = {}) {
    const W = 1000, H = height, L = 52, R = 18, Tp = 14, B = 30;
    const all = series.flatMap((s) => s.pts);
    if (!all.length) return '';
    let x0 = Math.min(...all.map((p) => p.x)), x1 = Math.max(...all.map((p) => p.x));
    if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
    let y0 = Math.min(...all.map((p) => p.y)), y1 = Math.max(...all.map((p) => p.y));
    const padY = (y1 - y0) * 0.12 || 1; y0 -= padY; y1 += padY;
    const sx = (x) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
    const sy = (y) => Tp + (1 - (y - y0) / (y1 - y0)) * (H - Tp - B);
    let g = '';
    for (let i = 0; i <= 4; i++) { const y = y0 + ((y1 - y0) * i) / 4; g += `<line x1="${L}" x2="${W - R}" y1="${sy(y)}" y2="${sy(y)}" stroke="var(--chart-grid)" stroke-width="1"/><text x="${L - 8}" y="${sy(y) + 4}" text-anchor="end" font-size="11" fill="var(--chart-label)">${fmtY(y)}</text>`; }
    const ticks = 7;
    for (let i = 0; i <= ticks; i++) { const x = x0 + ((x1 - x0) * i) / ticks; g += `<text x="${sx(x)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--chart-label)">${fmtDate(iso(new Date(x)), true)}</text>`; }
    const body = series.map((s) => {
      if (!s.pts.length) return '';
      const pts = [...s.pts].sort((p, q) => p.x - q.x);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
      const dots = pts.map((p) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${s.type === 'dots' ? 3.2 : s.type === 'dash' ? 0 : 4}" fill="${s.type === 'line' ? 'var(--bg)' : s.color}" stroke="${s.color}" stroke-width="${s.type === 'line' ? 2 : 0}"><title>${esc(p.label || fmtY(p.y))}</title></circle>`).join('');
      if (s.type === 'dots') return dots;
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.type === 'dash' ? 1.5 : 2.5}" ${s.type === 'dash' ? 'stroke-dasharray="5 5"' : ''} stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    }).join('');
    return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico">${g}${body}</svg></div>`;
  }

  // Grupos de columnas visibles en el registro diario y semanas plegadas (preferencias de este navegador).
  const DAILY_GROUPS = [['esc', 'Escalas'], ['ham', 'Hambre'], ['pl', 'Pliegues'], ['per', 'Perímetros']];
  const dailyShow = (() => { try { return Object.assign({ esc: true, ham: true, pl: true, per: true }, JSON.parse(lsGet('prepcoach-dailycols') || '{}')); } catch { return { esc: true, ham: true, pl: true, per: true }; } })();
  const wkFold = (() => { try { return JSON.parse(lsGet('prepcoach-wkfold') || '{}'); } catch { return {}; } })();
  const isFolded = (a, k) => (wkFold[k] !== undefined ? wkFold[k] : k > currentWeek(a) + 1);

  // Escala como menú desplegable (conserva valores antiguos fuera de rango o con decimales).
  // Con `color` cada número lleva su color de la escala (rojo = peor, verde = mejor; `color.rev` lo invierte;
  // `color.hunger` usa la clasificación del hambre después de las comidas).
  function scaleSel(path, min, max, label, color) {
    const cur = vstr(getP(path)), opts = [''];
    for (let v = min; v <= max; v++) opts.push(String(v));
    if (cur !== '' && !opts.includes(cur)) opts.push(cur);
    const col = (v) => (!color ? null : color.hunger ? hungerColor(num(v)) : scaleColor(num(v), min, max, color.rev));
    const c = cur !== '' ? col(cur) : null;
    const tip = color && color.hunger && HUNGER_DEF[cur] ? ` title="${cur} · ${esc(HUNGER_DEF[cur])}"` : '';
    return `<select class="cell${c ? ' sc-c' : ''}" data-bind="${path}" data-type="num" aria-label="${esc(label)} (${min}-${max})"${tip}${c ? ` style="--sc:${c}"` : ''}>${opts.map((v) => {
      const oc = v !== '' ? col(v) : null, ot = color && color.hunger && HUNGER_DEF[v] ? ` title="${esc(HUNGER_DEF[v])}"` : '';
      return `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}${oc ? ` style="color:${oc}"` : ''}${ot}>${v === '' ? '—' : esc(v)}</option>`;
    }).join('')}</select>`;
  }

  // Etapa de la semana: por defecto la que dicen las fechas de Configuración; se puede marcar otra a mano
  // (queda la alerta «No coincide» con opción de volver a Configuración).
  function etapaCell(a, k, cls = 'cell', tag = false) {
    const own = wk(a, k).etapa || '', der = stageOfWeek(a, k), mm = etapaMismatch(a, k);
    if (isClientView()) return `${esc(weekEtapa(a, k))}${mm ? ' <span class="busc-tag manual" style="display:inline-block;margin:0 0 0 6px">No coincide</span>' : ''}`;
    const opts = [['', der ? der.tipo : 'Sin etapa'], ...(own && !ETAPAS.includes(own) ? [own] : []), ...ETAPAS.filter((x) => !(x === (der && der.tipo) && !own))];
    return `${SEL(`tracking.weeks.${k}.etapa`, opts, { cls, attrs: `aria-label="Etapa de la ${weekLabel(k).toLowerCase()}"` })}${mm
      ? `<button type="button" class="busc-tag manual" data-action="resetEtapa" data-k="${k}" title="No coincide con Configuración: según las fechas esta semana es «${esc(mm.tipo)}». Toca para usar Configuración.">No coincide ↺</button>`
      : tag && !own && der ? '<span class="busc-tag" title="Etapa según las fechas de Seguimiento › Configuración">Config.</span>' : ''}`;
  }
  // Aviso arriba del registro y del seguimiento semanal cuando hay semanas marcadas con otra etapa.
  function mismatchCallout(a) {
    const mm = mismatchWeeks(a); if (!mm.length) return '';
    return `<div class="callout alert-callout" role="alert" style="margin-bottom:12px"><b>Las etapas no coinciden con Configuración.</b>
      ${mm.slice(0, 6).map((x) => `${weekLabel(x.k)} está marcada como «${esc(x.own)}», pero según las fechas corresponde a «${esc(x.s.tipo)}»`).join('; ')}${mm.length > 6 ? '…' : ''}.
      ${isClientView() ? '' : `<div class="mt8"><button class="btn sm" data-action="applyStageDates">Usar las fechas de Configuración</button></div>`}</div>`;
  }

  // Tipo de día de la minuta que corresponde a una fecha: el del calendario de alimentación (Menú diario); si no está,
  // lo anotado en «Entreno» (sí / no); si tampoco, los días de entrenamiento de la etapa en Configuración. null si no se sabe.
  function dayTypeFor(a, d) {
    const dts = a.dayTypes || []; if (!dts.length) return null;
    const cd = calType(a, d); if (cd) return { dt: cd, src: 'Según el calendario de alimentación (Plan › Menú diario)' };
    const { train, rest } = trainRest(a);
    const e = dailyOf(a, d).entreno;
    if (e === 'si' || e === 'no') return { dt: e === 'si' ? train : rest, src: 'Según lo anotado en «Entreno»' };
    const s = stageOfDay(a, d);
    if (s && (s.diasEntreno || []).length) return { dt: s.diasEntreno.includes(dow(d)) ? train : rest, src: 'Según los días de entrenamiento de la etapa (Configuración)' };
    return null;
  }
  // Tipo de día y días de pesaje que define la etapa.
  function dayTags(a, d) {
    const t = [], s = stageOfDay(a, d), td = dayTypeFor(a, d);
    if (td) t.push(`<span class="day-tag dtype" style="--dc:${esc(td.dt.color || 'var(--muted)')}" title="${esc(td.src)}">${esc(td.dt.name)}</span>`);
    if (s && (s.diasPeso || []).includes(dow(d))) t.push('<span class="day-tag peso" title="Día de reporte de peso (Configuración)">Pesaje</span>');
    return t.length ? `<span class="day-tags">${t.join('')}</span>` : '';
  }
  // Celda de hambre: muestra la comida de ese tipo de día en esa posición. Si el tipo de día tiene menos comidas,
  // la celda queda vacía (salvo que ya tenga un valor anotado, que se conserva visible).
  function hungerCell(a, d, h, first) {
    const td = dayTypeFor(a, d), m = td && td.dt.meals[h - 1], path = `tracking.daily.${d}.h${h}`, cls = `pad0 sc-td h-td${first ? ' g-start' : ''}`;
    if (td && !m && getP(path) == null) return `<td class="${cls} h-na" title="${esc(td.dt.name)}: ${td.dt.meals.length} comidas"><span class="muted">—</span></td>`;
    const name = m ? (String(m.name || '').trim() || `Comida ${h}`) : `Comida ${h}`;
    return `<td class="${cls}">${td ? `<span class="h-meal" title="${esc(name)}${m && m.time ? ' · ' + esc(m.time) : ''}">${esc(name)}</span>` : ''}${scaleSel(path, 1, 7, `Hambre · ${name}`, { hunger: true })}</td>`;
  }
  function segDaily(a) {
    const N = weekCount(a), today = todayISO(), cfg = cfgOf(a), meals = mealCols(a), sh = dailyShow;
    const entry = (path, unit) => `<div class="entry-wrap">${I(path, { cls: 'entry', num: true, live: true, ph: '—', attrs: `aria-label="${unit}"` })}<span>${unit}</span></div>`;
    const numCell = (d, f, label) => `<td class="pad0 m-td">${I(`tracking.daily.${d}.${f}`, { cls: 'cell', num: true, live: true, ph: '—', attrs: `aria-label="${esc(label)}"` })}</td>`;
    const nCols = 5 + (sh.esc ? SCALES.length : 0) + (sh.ham ? meals.idx.length : 0) + (sh.pl ? SKINFOLDS.length + 1 : 0) + (sh.per ? PERIMS.length + 1 : 0);
    let rows = '';
    for (let k = 0; k <= N; k++) {
      const days = weekDays(a, k), avg = weekAvg(a, k), n = weekWeights(a, k).length, steps = weekSteps(a, k);
      const l = k > 0 ? logrado(a, k) : null, folded = isFolded(a, k);
      const trained = days.filter((d) => dailyOf(a, d).entreno === 'si').length;
      rows += `<tr class="week-row" id="wk-${k}"><td colspan="${nCols}"><div class="wk-head">
        <div class="wk-title"><button type="button" class="wk-fold" data-action="foldWeek" data-k="${k}" aria-expanded="${!folded}" title="${folded ? 'Mostrar' : 'Ocultar'} los días de esta semana">${ic(folded ? 'chevR' : 'arrowDown', 14)}</button>
          <b>${weekLabel(k)}</b><span>${fmtDate(days[0])} – ${fmtDate(days[6])}${k === 0 ? ' · peso de partida' : ''}</span><span class="wk-etapa">${etapaCell(a, k, 'cell wk-etapa-sel')}</span></div>
        <div class="wk-stats">
          <span class="wk-stat"><small>Promedio</small><b>${avg != null ? fmt(avg, 2) + ' kg' : '—'}</b></span>
          <span class="wk-stat"><small>Pesajes</small><b>${n}/7</b></span>
          <span class="wk-stat"><small>Entrenos</small><b>${trained}/7</b></span>
          <span class="wk-stat"><small>Pasos prom.</small><b>${steps != null ? fmt(steps) : '—'}</b>${stepsIncomplete(a, k) ? `<span class="inc-pill" title="Promedio parcial: faltan ${stepsIncomplete(a, k)} días por ingresar">Incompleto · ${weekStepsDays(a, k)}/7</span>` : ''}</span>
          ${k > 0 ? `<span class="wk-stat"><small>Cambio</small>${l != null ? `<span class="pill ${pillCls[status(a, k).key]}">${fmtS(l)}%</span>` : '<b>—</b>'}</span>` : ''}
        </div></div></td></tr>`;
      if (folded) continue;
      rows += days.map((d) => {
        const dd = dailyOf(a, d), pl = sumPl(dd), ab = sumAbd(dd);
        return `<tr class="${d === today ? 'today' : ''}">
        <td class="day-cell sticky-col"><span class="day-name">${dayName(d)}</span><span class="day-date">${fmtDate(d, true)}</span>${d === today ? '<span class="pill gold">Hoy</span>' : ''}${dayTags(a, d)}</td>
        <td class="entry-td">${entry(`tracking.daily.${d}.peso`, 'kg')}</td>
        <td class="entry-td">${entry(`tracking.daily.${d}.pasos`, 'pasos')}</td>
        <td class="pad0 train-td">${SEL(`tracking.daily.${d}.entreno`, [['', '—'], ['si', 'Sí'], ['no', 'No']], { cls: 'cell', attrs: 'aria-label="Entrenamiento"' })}</td>
        ${sh.esc ? SCALES.map(([f, lab, mn, mx, rev], i) => `<td class="pad0 sc-td${i === 0 ? ' g-start' : ''}">${scaleSel(`tracking.daily.${d}.${f}`, mn, mx, lab, { rev: !!rev })}</td>`).join('') : ''}
        ${sh.ham ? meals.idx.map((h, i) => hungerCell(a, d, h, i === 0)).join('') : ''}
        ${sh.pl ? SKINFOLDS.map(([f, lab], i) => numCell(d, f, lab).replace('m-td', i === 0 ? 'm-td g-start' : 'm-td')).join('') + `<td class="num computed">${pl != null ? fmt(pl, 1) : '—'}</td>` : ''}
        ${sh.per ? PERIMS.map(([f, lab], i) => numCell(d, f, lab).replace('m-td', i === 0 ? 'm-td g-start' : 'm-td')).join('') + `<td class="num computed">${ab != null ? fmt(ab, 1) : '—'}</td>` : ''}
        <td class="pad0 com-td g-start">${I(`tracking.daily.${d}.nota`, { cls: 'cell', ph: 'Sueño, digestión, sensaciones…' })}</td></tr>`;
      }).join('');
    }
    const grp = (on, span, label) => (on ? `<th colspan="${span}" class="g-start">${label}</th>` : '');
    return `${mismatchCallout(a)}
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div class="muted">Peso en ayunas, después de ir al baño y sin tomar agua. Escalas, hambre, pliegues y perímetros se anotan el día que se miden; el seguimiento semanal muestra sus promedios. En «Hambre» aparecen las comidas del tipo de día de cada fila: Entrenamiento si en «Entreno» marcas Sí, Descanso si marcas No; sin anotar, se usan los días de entrenamiento de la etapa. Un día en blanco no rompe nada.</div>
      <button class="btn sm" data-action="goToday">Ir a la semana actual</button>
    </div>
    <div class="col-toggles" role="group" aria-label="Columnas visibles">
      <span class="label">Mostrar columnas</span>
      ${DAILY_GROUPS.map(([g, l]) => `<label class="chip"><input type="checkbox" data-action="toggleDailyCol" data-g="${g}" ${sh[g] ? 'checked' : ''}><span class="box"></span>${l}</label>`).join('')}
      <span class="legend-group">
        ${sh.esc ? `<span class="small muted">Escalas: <span class="scale-legend" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map((v) => `<i style="background:${scaleColor(v, 0, 5)}">${v}</i>`).join('')}</span> · en estrés, al revés</span>` : ''}
        ${sh.ham ? `<span class="small muted">Hambre: <span class="scale-legend" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7].map((v) => `<i style="background:${hungerColor(v)}" title="${v} · ${esc(HUNGER_DEF[v])}">${v}</i>`).join('')}</span> · ideal 4–5</span>` : ''}
      </span>
    </div>
    <div class="table-wrap week-table-wrap"><table class="t daily-table">
      <thead>
        <tr class="grp"><th class="sticky-col"></th><th colspan="3">Registro</th>${grp(sh.esc, SCALES.length, 'Escalas (0-5)')}${grp(sh.ham, meals.idx.length, 'Hambre después de las comidas (1-7)')}${grp(sh.pl, SKINFOLDS.length + 1, 'Pliegues (mm)')}${grp(sh.per, PERIMS.length + 1, 'Perímetros (cm)')}<th class="g-start"></th></tr>
        <tr><th class="sticky-col">Día</th><th class="entry-th">Peso en ayunas</th><th class="entry-th">Pasos</th><th class="train-th">Entreno</th>
          ${sh.esc ? SCALES.map(([, lab], i) => `<th class="${i === 0 ? 'g-start' : ''}">${lab}</th>`).join('') : ''}
          ${sh.ham ? meals.idx.map((h, i) => `<th class="${i === 0 ? 'g-start' : ''}" title="La comida de cada fila depende del tipo de día (Entrenamiento o Descanso)">Comida ${h}</th>`).join('') : ''}
          ${sh.pl ? SKINFOLDS.map(([, lab], i) => `<th class="${i === 0 ? 'g-start' : ''}">${lab}</th>`).join('') + '<th class="num">Σ</th>' : ''}
          ${sh.per ? PERIMS.map(([, lab], i) => `<th class="${i === 0 ? 'g-start' : ''}">${lab}</th>`).join('') + '<th class="num">Σ abd.</th>' : ''}
          <th class="g-start">Comentarios del día</th></tr>
      </thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  function segWeekly(a) {
    const N = weekCount(a), cfg = cfgOf(a), cw = currentWeek(a), meals = mealCols(a);
    const c = (k, f, ph = '') => `<td class="pad0">${I(`tracking.weeks.${k}.${f}`, { cls: 'cell', num: true, live: true, ph })}</td>`;
    // Promedio semanal de un campo diario, con aviso si faltan días.
    const avgCell = (k, f, first) => {
      const r = weekField(a, k, f), m = scaleMeta(f), c = m && r.avg != null ? metaColor(m, r.avg) : null;
      return `<td class="num computed avg-td${first ? ' g-start' : ''}">${r.avg != null ? `<b${c ? ` class="sc-val" style="--sc:${c}"` : ''}>${fmt(r.avg, 1)}</b>${incMini(r.n)}` : '<span class="muted">—</span>'}</td>`;
    };
    const ro = isClientView(); // el cliente no cambia etapa, % buscado ni macros: los define el coach
    // Macros sincronizados con Planificación: la semana actual y las futuras siempre muestran el plan vigente
    // (y la actual guarda una copia, para que quede registrada al terminar la semana); las pasadas muestran lo registrado.
    const pm = planMacros(a);
    let snap = false;
    const macCell = (k, f, live) => {
      const stored = wk(a, k)[f] || '', usePlan = k >= cw || !stored, v = usePlan ? live : stored;
      if (k === cw && !ro && live && stored !== live) { setP(`tracking.weeks.${k}.${f}`, live); snap = true; }
      const parts = String(v || '').match(/Kcal:\s*([\d.]+).*?P:\s*([\d.]+).*?CHO:\s*([\d.]+).*?G:\s*([\d.]+)/);
      const body = parts ? `<span class="kc"><b>${fmt(+parts[1])}</b> kcal</span><span><span class="kp">P ${fmt(+parts[2])}</span> · <span class="kcarb">C ${fmt(+parts[3])}</span> · <span class="kg">G ${fmt(+parts[4])}</span></span>` : (v ? esc(v) : '<span class="muted">Completa Planificación</span>');
      const tag = usePlan ? `<span class="mac-tag" title="Se toma y actualiza automáticamente desde Plan">${ic('target', 11)} Plan${k < cw ? ' actual' : ''}</span>` : `<span class="mac-tag past" title="Macros registrados durante esa semana">Registrado</span>`;
      return `<td class="computed mac mac-sync">${body}${tag}</td>`;
    };
    // % buscado: muestra el valor de Configuración (objetivo inicial o posterior según la semana);
    // si se escribe otro valor queda como ajuste manual de esa semana, con opción de volver a Configuración.
    const buscadoCell = (k) => {
      const own = num(wk(a, k).buscado), cfgV = stageTarget(stageOfWeek(a, k));
      const v = own != null ? own : cfgV;
      return `<td class="pad0 busc-td${own != null ? ' manual' : ''}" style="min-width:96px">${I(`tracking.weeks.${k}.buscado`, { cls: 'cell', num: true, live: true, value: v != null ? v : '', ph: '—', attrs: own == null ? 'data-cfg="1"' : '' })}
        ${own != null ? `<button type="button" class="busc-tag manual" data-action="resetBuscado" data-k="${k}" title="Ajuste manual de esta semana. Toca para volver al valor de Configuración (${cfgV != null ? fmtS(cfgV) + '%' : '—'})">Manual ↺</button>` : `<span class="busc-tag" title="Valor de la etapa en Seguimiento › Configuración">Config.</span>`}</td>`;
    };
    const roText = (v) => `<td class="computed small" style="white-space:pre-wrap;min-width:170px">${v ? esc(v) : '<span class="muted">—</span>'}</td>`;
    let body = '';
    for (let k = 0; k <= N; k++) {
      const w = wk(a, k), avg = weekAvg(a, k), l = logrado(a, k), st = status(a, k), steps = weekSteps(a, k);
      const hasDailySteps = weekDays(a, k).some((d) => num(dailyOf(a, d).pasos) != null);
      body += `<tr class="${k === cw ? 'today' : ''}">
        <td class="lbl sticky-col">${weekLabel(k)}</td>
        <td class="nowrap">${fmtDate(weekStart(a, k))}</td><td>${dayName(weekStart(a, k))}</td>
        <td class="${ro ? 'computed nowrap' : 'pad0'}${etapaMismatch(a, k) ? ' etapa-warn' : ''}" style="min-width:${ro ? 0 : 190}px">${etapaCell(a, k, 'cell', true)}</td>
        <td class="num computed"><b>${avg != null ? fmt(avg, 2) : '—'}</b></td>
        ${k === 0 ? '<td class="computed"></td>' : ro ? `<td class="num computed">${buscado(a, k) != null ? fmtS(buscado(a, k)) + '%' : '—'}</td>` : buscadoCell(k)}
        <td class="num computed nowrap">${l != null ? `<span class="pill ${pillCls[st.key]}" title="${esc(st.label)}">${fmtS(l)}%</span>` : '—'}</td>
        ${macCell(k, 'macrosE', pm.E)}${macCell(k, 'macrosD', pm.D)}
        <td class="center">${!ro && k < cw && (w.macrosE || w.macrosD) && (w.macrosE !== pm.E || w.macrosD !== pm.D) ? `<button class="btn xs ghost" data-action="fillMacros" data-k="${k}" title="Reemplazar lo registrado por los macros actuales de Planificación">${ic('copy', 13)}</button>` : ''}</td>
        ${hasDailySteps ? `<td class="num computed nowrap">${fmt(steps)}${stepsIncomplete(a, k) ? `<div class="inc-pill" title="Promedio parcial: faltan ${stepsIncomplete(a, k)} días por ingresar">Incompleto · ${weekStepsDays(a, k)}/7</div>` : ''}</td>` : c(k, 'pasos')}
        ${SCALES.map(([f], i) => avgCell(k, f, i === 0)).join('')}
        ${meals.idx.map((h, i) => avgCell(k, 'h' + h, i === 0)).join('')}
        <td class="g-start"><div class="photo-thumbs">${(w.fotos || []).map((src, i) => `<img src="${imgSrc(src)}" data-action="viewPhoto" data-k="${k}" data-i="${i}" alt="Foto">`).join('')}${filePick(`tracking.weeks.${k}.fotos`, true, 'btn xs ghost icon', ic('camera', 13), 'title="Agregar foto"')}</div></td>
      </tr>`;
    }
    if (snap) save(); // deja registrada la copia de la semana actual
    return `${mismatchCallout(a)}
    <div class="muted" style="margin-bottom:6px">Peso y % logrado se calculan desde el registro diario. Si no hay pasos diarios registrados, puedes ingresar el promedio semanal a mano. El % buscado vacío toma el valor de la configuración.</div>
    <div class="muted" style="margin-bottom:12px">Escalas y hambre son el <b>promedio de los días anotados</b> en el Registro diario. Si a la semana le faltan días, el promedio lleva <span class="inc-mini">4/7</span> (días con dato de 7).</div>
    <div class="table-wrap week-table-wrap">
      <table class="t wk-table">
        <thead>
          <tr class="grp"><th class="sticky-col" colspan="1"></th><th colspan="9" style="border-left:0"></th><th></th><th colspan="${SCALES.length}" class="g-start">Escalas · promedio semanal (0-5)</th><th colspan="${meals.idx.length}" class="g-start">Hambre después de las comidas · promedio semanal (1-7)</th><th class="g-start"></th></tr>
          <tr><th class="sticky-col">Semana</th><th>Fecha</th><th>Día</th><th>Etapa del proceso</th><th class="num">Peso</th><th class="num">% buscado</th><th class="num">% logrado</th><th>Macros días de entrenamiento</th><th>Macros días de descanso</th><th></th>
            <th class="num">Prom. pasos</th>
            ${SCALES.map(([, lab], i) => `<th class="num${i === 0 ? ' g-start' : ''}">${lab}</th>`).join('')}
            ${meals.idx.map((h, i) => `<th class="num${i === 0 ? ' g-start' : ''}">${meals.head(h)}</th>`).join('')}
            <th class="g-start">Foto de referencia</th></tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
  }

  function segGuide() {
    const hunger = [
      [7, 'Satisfecho hasta el punto de la incomodidad, posiblemente con náuseas.'],
      [6, 'Incómodamente satisfecho, necesitarías entre 1 y 2 horas para digerir si tuvieras que entrenar.'],
      [5, 'Satisfecho, pero no incómodamente.'],
      [4, 'Satisfecho, pero podría comer un poco más.'],
      [3, 'Hambriento, pero no hasta el punto de sentirme incómodo.'],
      [2, 'Hambre incómoda, distraído, irritable.'],
      [1, 'Hambre extrema, poca energía, muy centrado en la comida, débil.'],
    ];
    return `<div class="grid g2" style="align-items:start">
      <section class="card"><div class="card-head"><h3>Hambre después de las comidas (1-7)</h3><span class="sub">Califica de forma general</span></div>
        <div class="card-body"><ul class="scale-list">${hunger.map(([n, t]) => `<li><b class="hunger-num" style="--sc:${hungerColor(n)}">${n}</b><span>${t}</span></li>`).join('')}</ul>
          <div class="hint mt8">El color indica qué tan cerca está del punto ideal (4–5): verde satisfecho, naranjo incómodo y rojo en los extremos.</div></div></section>
      <section class="card"><div class="card-head"><h3>Escalas 0-5</h3></div>
        <div class="card-body prose">
          <p><b>Adherencia a la alimentación:</b> 5 = cumplí el plan completo · 3 = me salí en una comida · 0 = no seguí nada.</p>
          <p><b>Calidad del sueño / descanso:</b> 5 = dormí bien y desperté descansado · 0 = pésima noche.</p>
          <p><b>Nivel de estrés:</b> va al revés: 0 = tranquilo, 5 = muy estresado.</p>
          <p><b>Nivel de saciedad:</b> 0 = hambre todo el día · 5 = muy saciado.</p>
          <p><b>Nivel de energía durante los entrenamientos:</b> 5 = muy bien.</p>
          <p><b>Pesajes:</b> mínimo 3 pesajes semanales (por ejemplo lunes, miércoles y viernes), por la mañana, en ayunas, después de ir al baño y sin tomar agua.</p>
        </div></section>
      <section class="card"><div class="card-head"><h3>Instrucciones de medición</h3></div>
        <div class="card-body prose">
          <p>Intenta medirte siempre a la misma hora. Lo mejor es medirse por la mañana en ayunas.</p>
          <ul><li><b>Estómago:</b> apriétalo como si fueras a recibir un golpe.</li><li><b>Piernas:</b> de pie y apretadas. Mide el punto más grueso.</li>
          <li><b>Brazos:</b> flexiona el bíceps y mide el punto más grueso.</li><li><b>Pecho / espalda:</b> toma aire, aprieta pecho y dorsales, y coloca la cinta sobre la línea de los pezones.</li></ul>
          <p>Practica cada medición hasta que puedas repetir el mismo número de forma fiable tres veces seguidas.</p>
        </div></section>
      <section class="card"><div class="card-head"><h3>Consideraciones</h3></div>
        <div class="card-body prose">
          <p>Fíjate en las tendencias semanales, no en los cambios puntuales. Las fluctuaciones son normales.</p>
          <ul>
            <li>Una disminución de 2 a 2,5 cm en al menos dos zonas del abdomen puede corresponder aproximadamente a una pérdida de ~1,8 kg de grasa (estimación, no regla estricta).</li>
            <li>Con ~18% de grasa en hombres (o ~26% en mujeres), la grasa abdominal suele disminuir primero en la parte superior, luego la media y finalmente la inferior; al ganar peso ocurre lo contrario.</li>
            <li>En muchas mujeres la grasa se almacena preferentemente en las piernas, por lo que la disminución de muslos puede ser más significativa que la del abdomen.</li>
            <li>Al final de una dieta, la parte superior y media del abdomen pueden estabilizarse; si la inferior disminuye, probablemente indica pérdida de grasa lumbar.</li>
            <li>Reducciones en extremidades, pecho y espalda durante una definición no indican necesariamente pérdida muscular. En volumen todas las medidas aumentan y parte será grasa.</li>
            <li>Si las medidas abdominales disminuyen mientras pecho y extremidades se mantienen estables, es una clara señal de pérdida de grasa con mantenimiento o ganancia muscular.</li>
          </ul>
        </div></section>
    </div>`;
  }

  // ---------------- Configuración: etapas del proceso ----------------
  // Variables del gráfico de cada etapa: [id, etiqueta, grupo, valor del día]. 'obj' es la trayectoria objetivo.
  const STAGE_VARS = [
    ['peso', 'Peso', 'peso', (d) => num(d.peso)], ['obj', 'Trayectoria objetivo', 'peso', null],
    ['pl', 'Σ 4 pliegues', 'pl', (d) => sumPl(d)],
    ['abd', 'Suma abdominal', 'per', (d) => sumAbd(d)], ['pecho', 'Pecho', 'per', (d) => num(d.pecho)], ['brazo', 'Brazos', 'per', (d) => num(d.brazo)],
    ['cadera', 'Cadera', 'per', (d) => num(d.cadera)], ['muslo', 'Muslos', 'per', (d) => num(d.muslo)],
    ['pasos', 'Pasos', 'pasos', (d) => num(d.pasos)],
    ...SCALES.map(([f, l]) => [f, l, 'esc', (d) => num(d[f])]),
  ];
  // Un panel por unidad (nunca dos escalas en un mismo eje); dentro del panel, color fijo por variable.
  const VAR_GROUPS = [['peso', 'Peso', 'kg'], ['pl', 'Pliegues', 'mm'], ['per', 'Perímetros', 'cm'], ['pasos', 'Pasos diarios', 'pasos'], ['esc', 'Escalas', '0–5']];
  const varColor = (id) => { if (id === 'obj') return 'var(--muted)'; const v = STAGE_VARS.find((x) => x[0] === id), same = STAGE_VARS.filter((x) => x[2] === v[2] && x[0] !== 'obj'); return `var(--vz-${same.indexOf(v) % 5 + 1})`; };
  const stageChartCfg = (s) => { if (!isPlain(s.chart)) s.chart = { vars: ['peso', 'obj'], modo: 'semana' }; if (!Array.isArray(s.chart.vars)) s.chart.vars = []; return s.chart; };

  // Series de una etapa: valores diarios o promedio de cada semana de la etapa (bloques de 7 días desde su inicio).
  function stageSeries(a, s) {
    const ch = stageChartCfg(s), days = daysBetween(s.inicio, s.fin), dly = a.tracking.daily || {}, weekly = ch.modo !== 'dia';
    const keys = Object.keys(dly).filter((d) => d >= s.inicio && d <= s.fin).sort();
    const daily = (fn) => keys.map((d) => ({ d, t: daysBetween(s.inicio, d), v: fn(dly[d] || {}) })).filter((p) => p.v != null && isFinite(p.v));
    const byWeek = (pts) => {
      const g = {}; pts.forEach((p) => { (g[Math.floor(p.t / 7)] = g[Math.floor(p.t / 7)] || []).push(p.v); });
      return Object.keys(g).map(Number).sort((x, y) => x - y).map((k) => ({ t: Math.min(k * 7 + 3, days), v: mean(g[k]), k, n: g[k].length }));
    };
    const tip = (p, l, u) => (p.k != null ? `Semana ${p.k + 1} de la etapa · ${l}: ${fmt(p.v, 1)} ${u} (${p.n} día${p.n === 1 ? '' : 's'})` : `${fmtDate(p.d)} · ${l}: ${fmt(p.v, 1)} ${u}`);
    const out = [];
    STAGE_VARS.forEach(([id, label, grp, fn]) => {
      if (!ch.vars.includes(id)) return;
      const unit = VAR_GROUPS.find((g) => g[0] === grp)[2];
      if (id === 'obj') {
        const tg = stageTarget(s), pw = daily(STAGE_VARS[0][3]), w1 = pw.filter((p) => p.t < 7), own = num(s.pesoInicial);
        const p0 = own ?? (w1.length ? mean(w1.map((p) => p.v)) : eff(a).peso), t0 = own != null || !w1.length ? 0 : Math.min(3, days);
        if (p0 == null || tg == null) { out.push({ id, label, grp, unit, pts: [], dash: true, note: 'Falta el peso inicial o el objetivo' }); return; }
        const f = (t) => p0 * Math.pow(1 + tg / 100, (t - t0) / 7), pts = [];
        for (let t = 0; t < days; t += 7) pts.push({ t, v: f(t) });
        pts.push({ t: days, v: f(days) });
        out.push({ id, label, grp, unit, dash: true, pts: pts.map((p) => ({ ...p, tip: `Objetivo ${fmtDate(addDays(s.inicio, p.t))}: ${fmt(p.v, 2)} kg` })) });
        return;
      }
      const raw = daily(fn), pts = weekly ? byWeek(raw) : raw;
      out.push({ id, label, grp, unit, pts: pts.map((p) => ({ ...p, tip: tip(p, label, unit) })) });
    });
    return out;
  }
  // Gráfico de la etapa: un panel por unidad con el mismo eje de tiempo, etiqueta directa al final de cada línea.
  function stageChartSVG(a, s, series) {
    const days = Math.max(1, daysBetween(s.inicio, s.fin)), W = 1000, L = 52, R = 190, Tp = 12, B = 26;
    const sx = (t) => L + (t / days) * (W - L - R);
    const ticks = Math.min(7, days);
    return VAR_GROUPS.filter(([g]) => series.some((x) => x.grp === g)).map(([g, gl, unit]) => {
      const ser = series.filter((x) => x.grp === g), all = ser.flatMap((x) => x.pts.map((p) => p.v));
      if (!all.length) return `<div class="sm-panel"><div class="sm-title">${gl} <span class="muted">· ${unit}</span></div><div class="muted small" style="padding:14px 0">Sin datos en estas fechas. Se anotan en «Registro diario de peso».</div></div>`;
      const H = g === 'peso' ? 220 : 170;
      let y0 = Math.min(...all), y1 = Math.max(...all);
      if (g === 'esc') { y0 = 0; y1 = 5; } else { const pad = (y1 - y0) * 0.12 || Math.max(1, Math.abs(y1) * 0.02); y0 -= pad; y1 += pad; if (g === 'pasos') y0 = Math.max(0, y0); }
      const sy = (v) => Tp + (1 - (v - y0) / (y1 - y0)) * (H - Tp - B);
      const dec = g === 'pasos' ? 0 : 1;
      let grid = '';
      const nT = g === 'esc' ? 5 : 4;
      for (let i = 0; i <= nT; i++) { const v = y0 + ((y1 - y0) * i) / nT; grid += `<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--chart-grid)" stroke-width="1"/><text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end" font-size="11" fill="var(--chart-label)">${fmt(v, g === 'esc' ? 0 : dec)}</text>`; }
      for (let i = 0; i <= ticks; i++) { const t = Math.round((days * i) / ticks); grid += `<text x="${sx(t)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--chart-label)">${fmtDate(addDays(s.inicio, t), true)}</text>`; }
      // Etiquetas al final de cada línea, separadas para que no se pisen.
      const labs = ser.filter((x) => x.pts.length).map((x) => { const lp = x.pts[x.pts.length - 1]; return { x, y: sy(lp.v), v: lp.v }; }).sort((p, q) => p.y - q.y);
      for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 14) labs[i].y = labs[i - 1].y + 14;
      const over = labs.length ? labs[labs.length - 1].y - (H - B) : 0; if (over > 0) labs.forEach((l) => { l.y -= over; });
      const marks = ser.map((x) => {
        if (!x.pts.length) return '';
        const col = varColor(x.id), d = x.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t).toFixed(1)},${sy(p.v).toFixed(1)}`).join(' ');
        const line = `<path d="${d}" fill="none" stroke="${col}" stroke-width="${x.dash ? 1.5 : 2}" ${x.dash ? 'stroke-dasharray="5 5"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
        const pts = x.dash ? '' : x.pts.map((p) => `<circle cx="${sx(p.t).toFixed(1)}" cy="${sy(p.v).toFixed(1)}" r="${s.chart.modo === 'dia' ? 3 : 4}" fill="${col}" stroke="var(--surface)" stroke-width="2"/>`).join('');
        const hit = x.pts.map((p) => `<circle cx="${sx(p.t).toFixed(1)}" cy="${sy(p.v).toFixed(1)}" r="10" fill="transparent"><title>${esc(p.tip)}</title></circle>`).join('');
        return line + pts + hit;
      }).join('');
      const tags = labs.map((l) => `<rect x="${W - R + 10}" y="${l.y - 4}" width="10" height="${l.x.dash ? 2 : 8}" rx="2" fill="${varColor(l.x.id)}"/><text x="${W - R + 26}" y="${l.y + 4}" font-size="12" fill="var(--text-2)">${esc(l.x.id === 'obj' ? 'Objetivo' : l.x.label)} ${fmt(l.v, dec)}</text>`).join('');
      return `<div class="sm-panel"><div class="sm-title">${gl} <span class="muted">· ${unit}</span></div>
        <div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(gl)}: ${esc(ser.map((x) => x.label).join(', '))}">${grid}${marks}${tags}</svg></div></div>`;
    }).join('');
  }
  // Tabla con los mismos datos del gráfico (también sirve cuando los colores no se distinguen bien).
  function stageTable(s, series) {
    const ser = series.filter((x) => x.pts.length); if (!ser.length) return '';
    const weekly = s.chart.modo !== 'dia', ts = [...new Set(ser.flatMap((x) => x.pts.map((p) => p.t)))].sort((x, y) => x - y);
    const head = (t) => { if (weekly) { const p = ser.flatMap((x) => x.pts).find((q) => q.t === t && q.k != null); return p ? `Semana ${p.k + 1}` : fmtDate(addDays(s.inicio, t)); } return fmtDate(addDays(s.inicio, t)); };
    return `<details class="mt8 stage-table"><summary>Ver los datos en una tabla</summary><div class="table-wrap mt8"><table class="t"><thead><tr><th>${weekly ? 'Semana' : 'Fecha'}</th>${ser.map((x) => `<th class="num">${esc(x.label)} <span class="muted">(${esc(x.unit)})</span></th>`).join('')}</tr></thead>
      <tbody>${ts.map((t) => `<tr><td class="nowrap">${head(t)}</td>${ser.map((x) => { const p = x.pts.find((q) => q.t === t); return `<td class="num">${p ? fmt(p.v, x.grp === 'pasos' ? 0 : 1) : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }
  function stageChartBlock(a, s, i) {
    const ch = stageChartCfg(s);
    const chips = VAR_GROUPS.map(([g, gl]) => `<div class="vgroup"><span class="vgroup-l">${gl}</span>${STAGE_VARS.filter((v) => v[2] === g).map(([id, l]) => {
      const on = ch.vars.includes(id);
      return `<button type="button" class="vchip${on ? ' on' : ''}" data-action="toggleStageVar" data-i="${i}" data-v="${id}" aria-pressed="${on}"><span class="sw${id === 'obj' ? ' dash' : ''}" style="--sw:${varColor(id)}"></span>${l}</button>`;
    }).join('')}</div>`).join('');
    let body;
    if (!stageDated(s)) body = '<div class="muted center" style="padding:24px">Define la fecha inicial y la final para ver el gráfico.</div>';
    else if (!ch.vars.length) body = '<div class="muted center" style="padding:24px">Elige una o más variables para graficar.</div>';
    else { const ser = stageSeries(a, s); body = stageChartSVG(a, s, ser) + stageTable(s, ser); }
    return `<div class="stage-chart mt16">
      <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div class="label" style="margin:0">Gráfico de la etapa</div>
        <div class="seg sm">${[['semana', 'Promedio semanal'], ['dia', 'Diario']].map(([k, l]) => `<button class="${(ch.modo === 'dia' ? 'dia' : 'semana') === k ? 'active' : ''}" data-action="setStageMode" data-i="${i}" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="vchips mt8" role="group" aria-label="Variables del gráfico">${chips}</div>
      <div class="hint mt8">Elige las variables que quieras cruzar. Cada unidad va en su propio panel, con las mismas fechas, para compararlas sin mezclar escalas.</div>
      <div class="mt12">${body}</div></div>`;
  }
  const dayPicker = (i, f, s) => `<div class="dow-pick" role="group">${DOW_L.map((l, d) => { const on = (s[f] || []).includes(d);
    return `<button type="button" class="dow${on ? ' on' : ''}" data-action="toggleStageDay" data-i="${i}" data-f="${f}" data-d="${d}" aria-pressed="${on}" title="${DOW_N[d]}" aria-label="${DOW_N[d]}">${l}</button>`; }).join('')}</div>`;
  function stageCard(a, s, i) {
    const p = `tracking.config.stages.${i}`, full = stageFull(s);
    const opts = [['', 'Selecciona un objetivo'], ...(s.tipo && !ETAPAS.includes(s.tipo) ? [s.tipo] : []), ...ETAPAS];
    const date = (k, label) => `<div class="field"><label for="st-${s.id}-${k}">${label}</label>${D(`${p}.${k}`, `st-${s.id}-${k}`)}</div>`;
    const sub = stageDated(s) ? `${fmtDate(s.inicio)} – ${fmtDate(s.fin)} · ${stageDur(s)}` : s.tipo ? 'Sin fechas: aún no se refleja en el registro' : 'Elige el objetivo de esta etapa';
    let fields = '';
    if (!s.tipo) fields = '<div class="callout small mt16">Selecciona un objetivo para configurar esta etapa.</div>';
    else if (!full) fields = '<div class="callout small mt16">Configuración pendiente: los campos de esta etapa se definirán más adelante. Sus fechas ya se usan en el registro diario y el seguimiento semanal.</div>';
    else {
      const dly = a.tracking.daily || {}, w1 = stageDated(s) ? Object.keys(dly).filter((d) => d >= s.inicio && d < addDays(s.inicio, 7)).map((d) => num(dly[d].peso)).filter((v) => v != null) : [];
      const auto = w1.length ? mean(w1) : eff(a).peso, autoTxt = w1.length ? 'promedio de los pesajes de su 1.ª semana' : 'peso de Requerimientos';
      const nE = (s.diasEntreno || []).length, nP = (s.diasPeso || []).length;
      fields = `
        <div class="grid g4 mt16">
          ${F('Peso inicial', suffix(I(`${p}.pesoInicial`, { num: true, live: true, ph: auto != null ? fmt(auto, 1) : '—' }), 'kg'), auto != null ? `Vacío: se usa el ${autoTxt}.` : 'Se usa para la trayectoria objetivo.')}
          ${F('% de grasa inicial', suffix(I(`${p}.grasaInicial`, { num: true, ph: 'Si corresponde' }), '%'), 'Opcional.')}
          ${F('Meta de pasos diarios', I(`${p}.pasos`, { num: true, ph: 'Ej.: 10000' }), 'Se muestra en el panel de la semana.')}
          ${F('Objetivo de pérdida de grasa', suffix(I(`${p}.objetivo`, { num: true, live: true, ph: s.tipo === 'Mini cut' ? 'Ej.: 1' : 'Ej.: 0,7' }), '% / sem'), s.tipo === 'Mini cut' ? 'Del peso corporal. En un mini cut suele ser 0,75–1,25 %.' : 'Del peso corporal. Referencia habitual: 0,5–1 %.')}
        </div>
        <div class="grid g2 mt16">
          <div class="field"><label>Días de entrenamiento</label>${dayPicker(i, 'diasEntreno', s)}<div class="hint">${nE ? `${nE} ${nE === 1 ? 'día' : 'días'} por semana.` : 'Toca los días que entrena.'} Se marcan en el registro diario.</div></div>
          <div class="field"><label>Días de reporte de peso</label>${dayPicker(i, 'diasPeso', s)}<div class="hint">${nP ? `${nP} ${nP === 1 ? 'pesaje' : 'pesajes'} por semana.` : 'Toca los días de pesaje.'}${nP && nP < 3 ? ' Mínimo recomendado: 3.' : ''} Se marcan en el registro diario.</div></div>
        </div>
        ${stageChartBlock(a, s, i)}`;
    }
    return `<section class="card mt16 stage-card" id="stage-${s.id}">
      <div class="card-head"><span class="sec-num">${pad(i + 1)}</span><h3>${esc(s.tipo || 'Nueva etapa')}</h3><span class="sub">${sub}</span><span class="spacer"></span>
        <button class="btn xs ghost danger" data-action="delStage" data-i="${i}" title="Eliminar etapa" aria-label="Eliminar etapa ${i + 1}">${ic('trash', 13)}</button></div>
      <div class="card-body">
        <div class="grid g3">${F('Objetivo', SEL(`${p}.tipo`, opts))}${date('inicio', 'Fecha inicial')}${date('fin', 'Fecha final')}</div>
        ${fields}
      </div></section>`;
  }
  function segConfig(a) {
    const st = stagesOf(a), al = stageAlerts(a), N = weekCount(a), c0 = cfgOf(a).inicio, dated = st.some(stageDated);
    return `
    ${al.length ? `<div class="callout alert-callout" role="alert"><b>Revisa las fechas de las etapas</b><ul class="alert-list">${al.map((x) => `<li>${x}</li>`).join('')}</ul>
      ${mismatchWeeks(a).length ? '<button class="btn sm mt8" data-action="applyStageDates">Usar las fechas de Configuración en todas las semanas</button>' : ''}</div>` : ''}
    <section class="card${al.length ? ' mt16' : ''}"><div class="card-head"><h3>Calendario del seguimiento</h3><span class="sub">${dated ? 'Se arma con las fechas de las etapas' : 'Define las fechas de una etapa para armarlo'}</span></div>
      <div class="card-body grid g3">
        ${F('Semana inicial', `<input class="input" value="${fmtDate(c0)}" disabled>`, 'Primer día de la primera etapa.')}
        ${F('Último día', `<input class="input" value="${fmtDate(addDays(c0, 7 * (N + 1) - 1))} · ${weekLabel(N)}" disabled>`, `${N + 1} semanas en el registro diario y el seguimiento semanal.`)}
        ${F('Tolerancia (± puntos porcentuales)', suffix(I('tracking.config.tol', { num: true }), 'pp'), 'Margen para considerar que una semana va «en ritmo».')}
      </div></section>
    ${st.map((s, i) => stageCard(a, s, i)).join('')}
    <div class="row mt16"><button class="btn primary" data-action="addStage">${ic('plus', 15)} Agregar siguiente etapa</button></div>
    <div class="callout mt16 small">Las fechas de cada etapa definen la etapa y el % buscado de cada semana en el registro diario y el seguimiento semanal. Si allí marcas una semana con otra etapa, aparece una alerta para que revises cuál es la correcta. El número que manda es el % de cambio semanal del peso promedio: bajar más rápido que el objetivo no es mejor, en una etapa de definición se paga con músculo.</div>`;
  }


  // ---------------- Acceso del cliente (lado del coach) ----------------
  const fmtDT = (s) => { if (!s) return '—'; const d = new Date(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  function randomToken(n = 24) {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', b = new Uint8Array(n);
    crypto.getRandomValues(b); return Array.from(b, (x) => abc[x % abc.length]).join('');
  }
  const clientLink = (a) => (a.portal.token ? `${MODE === 'sync' ? SHARE_URL : location.origin + location.pathname}#c${a.portal.token}` : '');
  function resolveName(u) {
    if (!cuser || T.names[u] !== undefined) return;
    T.names[u] = '';
    cuser.profiles([u]).then((ps) => { T.names[u] = (ps[u] && ps[u].name) || ''; scheduleRender(); }).catch(() => {});
  }

  function segAccess(a) {
    const p = a.portal, u = linkedUid(a), link = clientLink(a), sync = MODE === 'sync';
    if (u) resolveName(u);
    const who = u ? (T.names[u] || 'Tu cliente') : '';
    const st = !p.token ? { k: 'none', t: 'Sin enlace', d: 'Genera un enlace personal para invitar a tu cliente a su portal.' }
      : !u ? { k: 'warn', t: 'Esperando al cliente', d: 'El enlace está listo. Cuando tu cliente lo abra con su cuenta de claude.ai, quedará conectado automáticamente.' }
        : { k: 'ok', t: 'Conectado', d: `${esc(who)} anota y revisa su seguimiento. Ambos ven los cambios en tiempo real.` };
    const upToDate = u && planOf(planSnapshot(a)) === p.planHash;
    const step = (n, title, body) => `<section class="card"><div class="card-head"><span class="sec-num">${n}</span><h3>${title}</h3></div><div class="card-body">${body}</div></section>`;
    return `
    ${sync ? '' : `<div class="callout info" style="margin-bottom:16px">El acceso del cliente funciona en la versión publicada de PrepCoach (Artifact), donde los datos se sincronizan. Aquí puedes revisar cómo se verá con la <b>vista previa</b>.</div>`}
    <section class="card status-hero" style="grid-template-columns: 1.4fr 1fr 1fr">
      <div><div class="label">ESTADO DEL ACCESO</div><div class="status-big ${st.k === 'none' ? 'none' : st.k}">${st.t.toUpperCase()}</div><div class="muted small mt8">${st.d}</div></div>
      <div><div class="label">Cliente</div><div style="font-size:18px;font-weight:650;margin-top:4px">${u ? esc(who) : '—'}</div><div class="small muted">${u ? 'Conectado el ' + fmtDT(p.linkedAt) : 'Sin cuenta vinculada'}</div></div>
      <div><div class="label">Plan publicado</div><div style="margin-top:6px">${u ? (upToDate ? `<span class="pill ok">Al día · ${fmtDT(p.planAt)}</span>` : `<span class="pill warn">Cambios sin publicar</span>`) : '<span class="pill">—</span>'}</div></div>
    </section>
    ${T.conflicts[a.id] ? `<div class="callout mt16" style="border-color:var(--warn)"><b>Otra cuenta intentó usar este enlace.</b> ${u ? 'No puede ver ni anotar nada: el portal sigue vinculado solo a tu cliente. Revisa en «Compartir» quién tiene acceso y quita a quien no reconozcas.' : 'Si no fue tu cliente, genera un enlace nuevo: el actual dejará de funcionar.'}</div>` : ''}
    <div class="grid g2 mt16" style="align-items:start">
      ${step('01', 'Enlace personal', p.token ? `
        <div class="hint" style="margin-bottom:8px">Envíaselo a tu cliente por WhatsApp o email. Es único para ${esc(a.q.nombre || 'este atleta')}.</div>
        <div class="row" style="flex-wrap:nowrap"><input class="input" id="client-link" readonly value="${esc(link)}" style="font-size:12.5px"><button class="btn primary sm" data-action="copyLink">${ic('copy', 14)} Copiar</button></div>
        ${!u ? `<button class="btn sm ghost mt12" data-action="regenLink">Generar un enlace nuevo</button>` : ''}`
        : `<p class="muted" style="margin:0 0 12px">Aún no hay enlace para ${esc(a.q.nombre || 'este atleta')}.</p><button class="btn primary" data-action="genLink">${ic('send', 15)} Generar enlace</button>`)}
      ${step('02', 'Dale permiso en «Compartir»', `
        <ol class="steps">
          <li>Abre el menú <b>Compartir</b> de este Artifact (arriba, en claude.ai).</li>
          <li>Invita el <b>email de tu cliente</b> con el rol <b>Editor</b>. Es el único rol que le permite anotar datos.</li>
          <li>No actives el enlace público: con él, las personas de fuera pierden el permiso de escritura.</li>
          <li>Tu cliente debe iniciar sesión en claude.ai (una cuenta gratuita sirve) y abrir el enlace del paso 1.</li>
        </ol>`)}
      ${step('03', 'Plan de alimentación', `
        <p class="muted" style="margin:0 0 12px">Tu cliente ve el plan que publiques, en solo lectura. Así puedes ajustarlo con calma y publicarlo cuando esté listo.</p>
        <div class="row">
          <button class="btn primary sm" data-action="publishPlanNow" ${u && sync ? '' : 'disabled'}>${ic('up', 14)} ${upToDate ? 'Volver a publicar' : 'Publicar plan'}</button>
          <button class="btn sm" data-action="previewClient">${ic('user', 14)} Vista previa como cliente</button>
        </div>
        ${!u ? '<div class="hint mt8">Podrás publicar cuando tu cliente esté conectado. Al conectarse se publica automáticamente.</div>' : ''}`)}
      ${step('04', 'Qué ve y qué puede hacer', `
        <ul class="steps">
          <li><b>Su seguimiento:</b> panel, registro diario de peso, seguimiento semanal e instrucciones. Anota peso, pasos, pliegues, perímetros, escalas, fotos y comentarios; tú ves todo al instante y también puedes anotar.</li>
          <li><b>Su plan:</b> comidas, opciones, cantidades, imágenes y notas, sin poder editarlo. Puede descargar su minuta.</li>
          <li><b>No ve:</b> requerimientos, cuestionario, distribución, configuración, la base de alimentos ni a tus otros atletas.</li>
        </ul>`)}
    </div>
    ${u ? `<section class="card mt16"><div class="card-body row" style="justify-content:space-between">
      <div><b>Quitar el acceso</b><div class="small muted">El seguimiento queda guardado en tu app. Quita también al cliente del menú Compartir.</div></div>
      <button class="btn danger" data-action="revokeAccess">${ic('x', 14)} Quitar acceso</button></div></section>` : ''}
    <div class="callout small mt16"><b>Privacidad.</b> Cada cliente solo puede leer y escribir su propio portal; tus atletas, requerimientos y base de alimentos quedan reservados para ti. Ten en cuenta que el rol Editor de claude.ai también permite publicar versiones de un Artifact: invita solo a clientes de confianza y, si alguien deja de trabajar contigo, quítale el acceso aquí y en Compartir.</div>`;
  }

  // ---------------- Portal del cliente ----------------
  function viewClientStatus() {
    const msg = {
      loading: ['Cargando tu portal…', 'Conectando con tu coach.'],
      nolink: ['Esta app es privada', 'Para entrar a tu portal, abre el enlace personal que te envió tu coach.'],
      noid: ['No pudimos identificar tu cuenta', 'Inicia sesión en claude.ai y vuelve a abrir tu enlace. Si ya iniciaste sesión, pide a tu coach que te invite por email como Editor.'],
      denied: ['Aún no tienes permiso para anotar', 'Pide a tu coach que te invite por email con el rol Editor desde «Compartir» y vuelve a abrir tu enlace.'],
      pending: ['Tu solicitud llegó a tu coach', 'Tu portal se activará en cuanto tu coach abra PrepCoach. Esta página se actualizará sola. Si tarda, pídele un enlace nuevo.'],
    }[CL.state] || ['Cargando…', ''];
    return `<div class="card empty"><div class="e-ic">${ic(CL.state === 'pending' ? 'clock' : 'user', 30)}</div><h2>${msg[0]}</h2><p>${msg[1]}</p></div>`;
  }

  function viewClient() {
    if (CLIENT && CL.state !== 'ready') return viewClientStatus();
    // 'cliente/pg': espacio reservado del portal para clientes de Población general (en blanco por ahora; no aparece en el menú de los atletas).
    const a = A(), tab = route()[1] === 'seg' ? 'seg' : route()[1] === 'pg' ? 'pg' : 'plan';
    const segTab = (CLIENT_SEG_TABS.find(([k]) => k === a.ui.trackTab) || CLIENT_SEG_TABS[0]);
    return `<div class="plan-layout ${sbCollapsed ? 'sb-collapsed' : ''}">
      ${clientSidebar(tab, segTab[0])}
      <div class="plan-main" id="plan-main">
        ${T.preview ? `<div class="callout info row" style="justify-content:space-between;margin-bottom:16px"><span><b>Vista previa</b> del portal de ${esc(a.q.nombre || 'tu cliente')}. Muestra el plan actual, que puede tener cambios sin publicar.</span><button class="btn sm" data-action="exitPreview">Salir de la vista previa</button></div>` : ''}
        <div class="page-head"><div class="plan-head">
          <button class="btn sm sb-toggle" data-action="openDrawer" aria-controls="plan-sidebar" aria-expanded="false">${ic('sidebar', 15)}<span>Secciones</span></button>
          <div><div class="eyebrow">Portal de ${esc(a.q.nombre || 'atleta')}</div><div class="page-title">${tab === 'seg' ? `Mi seguimiento <span class="title-sub">· ${segTab[1]}</span>` : tab === 'pg' ? 'Población general' : 'Mi plan de alimentación'}</div></div>
        </div></div>
        ${tab === 'seg' ? ({ panel: segPanel, diario: segDaily, semanal: segWeekly, guia: segGuide })[segTab[0]](a) : tab === 'pg' ? '<div class="pg-blank" aria-label="Espacio en blanco"></div>' : viewClientPlan(a)}
      </div>
    </div>`;
  }

  function clientSidebar(tab, segTab) {
    const a = A(), cur = activeDay(a), cw = currentWeek(a);
    const initials = (a.q.nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
    const item = (k, l, icn, sub) => `<a class="sb-item ${k === tab ? 'active' : ''}" href="#/cliente/${k}" ${k === tab ? 'aria-current="page"' : ''} title="${l}"><span class="sb-ic">${ic(icn, 17)}</span><span class="sb-text">${l}</span></a>${k === tab ? sub : ''}`;
    const daysSub = a.dayTypes.length > 1 ? `<div class="sb-sub" role="group" aria-label="Tipos de día">${a.dayTypes.map((d) => `<button class="sb-subitem ${d.id === cur.id ? 'active' : ''}" data-action="clientDay" data-id="${d.id}"><span class="sw" style="background:${d.color}"></span><span class="sb-text">${esc(d.name)}</span></button>`).join('')}</div>` : '';
    const segSub = `<div class="sb-sub" role="group" aria-label="Vistas de seguimiento">${CLIENT_SEG_TABS.map(([v, l]) => `<button class="sb-subitem ${v === segTab ? 'active' : ''}" data-action="trackTab" data-v="${v}"><span class="sb-text">${l}</span></button>`).join('')}</div>`;
    return `<aside class="sidebar" id="plan-sidebar" aria-label="Secciones del portal">
      <div class="sb-head">
        <div class="sb-athlete"><span class="avatar sm">${esc(initials)}</span>
          <div class="sb-ath-text"><b>${esc(a.q.nombre || 'Mi portal')}</b><span>${esc(weekEtapa(a, cw))} · Semana ${cw}/${weekCount(a)}</span></div></div>
        <button class="btn xs ghost icon sb-close" data-action="closeDrawer" aria-label="Cerrar panel">${ic('x', 15)}</button>
      </div>
      <nav class="sb-nav">
        <div class="sb-group"><div class="sb-label">Mi plan</div>${item('plan', 'Plan de alimentación', 'menu', daysSub)}</div>
        <div class="sb-group"><div class="sb-label">Mi seguimiento</div>${item('seg', 'Seguimiento', 'chart', segSub)}</div>
      </nav>
      <button class="sb-collapse" data-action="toggleSidebar" aria-label="${sbCollapsed ? 'Expandir' : 'Contraer'} panel lateral" title="${sbCollapsed ? 'Expandir' : 'Contraer'} panel">${ic(sbCollapsed ? 'chevR' : 'chevL', 16)}<span class="sb-text">Contraer panel</span></button>
    </aside>
    <div class="sb-backdrop" data-action="closeDrawer" aria-hidden="true"></div>`;
  }

  function viewClientPlan(a) {
    if (CLIENT && !CL.plan) return `<div class="card empty"><div class="e-ic">${ic('menu', 30)}</div><h2>Tu plan aún no está publicado</h2><p>Tu coach te avisará cuando esté listo. Mientras tanto puedes anotar tu seguimiento.</p><a class="btn primary" href="#/cliente/seg">Ir a mi seguimiento</a></div>`;
    const dt = activeDay(a), di = a.dayTypes.indexOf(dt), t = dayTargets(a, dt);
    const canDl = CLIENT ? !!cdownloads : true;
    return `
    <div class="daytype-head">
      ${a.dayTypes.length > 1 ? `<div class="seg">${a.dayTypes.map((d) => `<button class="${d.id === dt.id ? 'active' : ''}" data-action="clientDay" data-id="${d.id}"><span class="sw" style="background:${d.color}"></span>${esc(d.name)}</button>`).join('')}</div>` : ''}
      <span class="spacer"></span>
      ${CLIENT && CL.planAt ? `<span class="small muted">Actualizado el ${fmtDT(CL.planAt)}</span>` : ''}
      ${canDl ? `<button class="btn sm" data-action="printMenu" ${T.pdfBusy ? 'disabled' : ''} aria-busy="${T.pdfBusy ? 'true' : 'false'}">${ic('down', 14)} ${T.pdfBusy ? 'Generando PDF…' : 'Descargar minuta'}</button>` : ''}
    </div>
    ${t.ok ? targetTiles(t, t.peso) : ''}
    <div class="meals mt16">${dt.meals.map((m, i) => mealCardRO(a, dt, di, m, i, t)).join('') || '<div class="card card-pad muted center">Este día aún no tiene comidas.</div>'}</div>
    ${dt.notes ? `<section class="card mt16"><div class="card-head"><h3>Indicaciones del día</h3></div><div class="card-body prose"><p style="white-space:pre-wrap">${esc(dt.notes)}</p></div></section>` : ''}`;
  }

  function mealCardRO(a, dt, di, m, i, t) {
    const mi = `dayTypes.${di}.meals.${i}`, oi = clamp(m.active || 0, 0, Math.max(0, m.options.length - 1)), o = m.options[oi];
    if (!o) return '';
    const tot = optTotals(o), col = collapsed.has(m.id);
    const rows = o.foods.map((l) => {
      const x = lineCalc(l); if (!x.f) return '';
      return `<tr><td><b>${esc(x.f.name)}</b>${x.f.porcion ? `<div class="small muted">Porción de intercambio: ${esc(x.f.porcion)}</div>` : ''}</td><td>${l.cantidad ? esc(l.cantidad) : '<span class="muted">—</span>'}</td>
        <td class="num">${fmt(num(l.porciones), 2)}</td>
        <td class="m kc">${fmt(x.kcal)}</td><td class="m kp">${fmt(x.p, 1)}</td><td class="m kcarb">${fmt(x.c, 1)}</td><td class="m kg">${fmt(x.g, 1)}</td></tr>`;
    }).join('');
    return `<section class="card meal ${col ? 'collapsed' : ''}">
      <div class="meal-top" data-action="toggleMeal" data-id="${m.id}">
        <button type="button" class="meal-chev" aria-expanded="${!col}" aria-label="${col ? 'Mostrar' : 'Ocultar'} ${esc(m.name)}">${ic('arrowDown', 16)}</button>
        <span class="meal-idx">${pad(i + 1)}</span>
        <div><div class="meal-name">${esc(m.name)}</div><div class="meal-time">${esc(m.time || '')}${m.options.length > 1 ? ` · ${m.options.length} opciones` : ''}</div></div>
        <span class="spacer"></span>
        <div class="meal-target"><div>Aporte: <b class="kc">${fmt(tot.kcal)} kcal</b> · <span class="kp">P ${fmt(tot.p)}</span> · <span class="kcarb">C ${fmt(tot.c)}</span> · <span class="kg">G ${fmt(tot.g)}</span></div></div>
      </div>
      <div class="meal-content" ${col ? 'hidden' : ''}>
        ${m.options.length > 1 ? `<div class="opt-tabs">${m.options.map((x, k) => `<button class="opt-tab ${k === oi ? 'active' : ''}" data-action="viewOpt" data-m="${mi}" data-k="${k}">Opción ${k + 1}</button>`).join('')}<span class="spacer"></span><span class="small muted">Elige la opción que prefieras</span></div>` : ''}
        <div class="meal-body">
          ${String(m.indic || '').trim() ? `<div class="callout small" style="white-space:pre-wrap"><b>Indicaciones:</b> ${esc(m.indic)}</div>` : ''}
          ${o.image ? `<div class="img-drop img-has"><img src="${imgSrc(o.image)}" alt="${esc(o.title || m.name)}"></div>` : ''}
          ${o.title ? `<div class="opt-title">${esc(o.title)}</div>` : ''}
          <div class="table-wrap"><table class="t foods-table">
            <thead><tr><th>Alimento</th><th>Cantidad</th><th class="num">Porciones</th><th class="num">Kcal</th><th class="num">P (g)</th><th class="num">C (g)</th><th class="num">G (g)</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" class="muted center" style="padding:16px">Sin alimentos.</td></tr>'}</tbody>
            <tfoot><tr><td colspan="3"><b>Aporte total</b></td><td class="m kc">${fmt(tot.kcal)}</td><td class="m kp">${fmt(tot.p, 1)}</td><td class="m kcarb">${fmt(tot.c, 1)}</td><td class="m kg">${fmt(tot.g, 1)}</td></tr></tfoot>
          </table></div>
          ${o.notes ? `<div class="callout small" style="white-space:pre-wrap"><b>Notas:</b> ${esc(o.notes)}</div>` : ''}
        </div>
      </div>
    </section>`;
  }

  // ---------------- Base de alimentos ----------------
  function viewFoods() {
    const q = T.foodQ.trim().toLowerCase();
    const list = S.foods.map((f, i) => [f, i]).filter(([f]) => !q || f.name.toLowerCase().includes(q)).sort((x, y) => x[0].name.localeCompare(y[0].name, 'es'));
    const c = (i, k, n = true) => `<td class="pad0">${I(`@foods.${i}.${k}`, { cls: 'cell', num: n })}</td>`;
    // Ficha del alimento nuevo: no entra en la base hasta pulsar «Guardar alimento».
    const d = T.foodDraft;
    const ff = (k, label, o = {}) => `<div class="field ff-${k}"><label for="ff-${k}">${label}</label>${I(`#foodDraft.${k}`, { ...o, attrs: `id="ff-${k}" autocomplete="off"` })}</div>`;
    const draft = !d ? '' : `<div class="card food-form" role="group" aria-labelledby="ff-title">
        <div class="card-head"><span class="sec-num">${ic('plus', 12)}</span><h3 id="ff-title">Nuevo alimento</h3><span class="sub">Valores por porción de intercambio</span></div>
        <div class="card-body">
          <div class="ff-grid">
            ${ff('name', 'Nombre del alimento', { ph: 'Ej.: Pechuga de pollo' })}
            ${ff('porcion', 'Porción de intercambio', { ph: 'Ej.: 1 taza' })}
            ${ff('gpp', 'g por porción', { num: true, ph: 'Por unidad' })}
            ${ff('kcal', 'Kcal', { num: true, ph: '0' })}
            ${ff('p', 'Proteína (g)', { num: true, ph: '0' })}
            ${ff('c', 'Carbohidratos (g)', { num: true, ph: '0' })}
            ${ff('g', 'Grasa total (g)', { num: true, ph: '0' })}
          </div>
          <div class="ff-foot">
            <span class="hint">Al guardar se agrega a la base en orden alfabético. Sin “g por porción” se mide por unidad.</span>
            <span class="spacer"></span>
            <button class="btn sm" data-action="cancelFood">Cancelar</button>
            <button class="btn sm primary" data-action="saveFood">${ic('check', 14)} Guardar alimento</button>
          </div>
        </div>
      </div>`;
    return `
    <div class="row" style="margin-bottom:14px">
      <div style="flex:1;max-width:420px">${I('#foodQ', { live: true, ph: 'Buscar alimento…' })}</div>
      <span class="muted small">${list.length} de ${S.foods.length} alimentos · valores por porción de intercambio</span><span class="spacer"></span>
      <button class="btn primary sm" data-action="addFood">${ic('plus', 14)} Nuevo alimento</button>
    </div>
    ${draft}
    <div class="table-wrap week-table-wrap"><table class="t food-table"><thead><tr><th>Alimento</th><th>Porción de intercambio</th><th class="num">g por porción</th><th class="num">Kcal</th><th class="num">Proteína (g)</th><th class="num">Carbohidratos (g)</th><th class="num">Grasa total (g)</th><th class="num" title="4·P + 4·C + 9·G">Kcal calc.</th><th></th></tr></thead>
    <tbody>${list.map(([f, i]) => `<tr${f.id === T.foodSaved ? ' class="food-new"' : ''}>
      <td class="pad0" style="min-width:260px">${I(`@foods.${i}.name`, { cls: 'cell' })}</td>
      <td class="pad0" style="min-width:150px">${I(`@foods.${i}.porcion`, { cls: 'cell' })}</td>
      ${c(i, 'gpp')}${c(i, 'kcal')}${c(i, 'p')}${c(i, 'c')}${c(i, 'g')}
      <td class="num computed">${fmt((f.p || 0) * 4 + (f.c || 0) * 4 + (f.g || 0) * 9)}</td>
      <td><button class="btn xs ghost icon danger" data-action="delFood" data-id="${f.id}" title="Eliminar">${ic('trash', 13)}</button></td></tr>`).join('')}</tbody></table></div>
    <div class="hint mt8">Los alimentos sin “g por porción” se miden por unidad. Para cambios de producto, edita aquí y el menú se recalcula.</div>`;
  }

  // ---------------- Minuta: vista previa y descarga ----------------
  // Pestaña propia bajo «Menú diario»: muestra tal cual lo que saldrá en el archivo o la impresión del tipo de día elegido.
  function viewMinuta() {
    const a = A(), dl = MODE === 'sync';
    return `
    <div class="daytype-head no-print">
      <ol class="mn-order" aria-label="Contenido del archivo, en orden"><li>Planificación</li><li>Calendario de alimentación</li><li>Minuta ejemplo de cada tipo de día</li><li>Distribución de las comidas</li><li>Resumen del seguimiento semanal</li></ol>
      <span class="spacer"></span>
      <button class="btn primary" data-action="printPlan" ${(!dl || cdownloads) && !T.pdfBusy ? '' : 'disabled'} aria-busy="${T.pdfBusy ? 'true' : 'false'}">${ic('down', 15)} ${T.pdfBusy ? 'Generando PDF…' : minutaLabel()}</button>
    </div>
    <p class="mn-info muted small">Vista previa hoja por hoja, tal como sale el <b>PDF</b> (A4). Las minutas van en hojas horizontales, una por tipo de día, con todas sus comidas y opciones en una sola hoja. En la minuta solo entran las opciones que tienen alimentos.</p>
    <div class="mn-stage"><div class="mn-sheets" id="minuta-preview" role="document" aria-label="Vista previa de la planificación">${planDocBody(a, (v) => imgSrc(v), true)}</div></div>`;
  }

  // =====================================================================
  // Impresión de minuta
  // =====================================================================
  // Esquema de color de cada minuta según su tipo de día (Entrenamiento dorado, Descanso azul…), para distinguirlas a simple vista.
  const hexRgb = (h) => { const m = String(h || '').replace('#', '').match(/^([0-9a-f]{6})$/i); const n = m ? parseInt(m[1], 16) : 0xd8b15f; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mixHex = (h, to, t) => { const a = hexRgb(h), b = hexRgb(to); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  function dayScheme(dt) {
    const a = A(), list = (a && a.dayTypes) || [dt], idx = Math.max(0, list.indexOf(dt));
    let c = /^#[0-9a-f]{6}$/i.test(dt.color || '') ? dt.color : DAY_COLORS[idx % DAY_COLORS.length];
    if (list.slice(0, idx).some((d) => (d.color || '').toLowerCase() === c.toLowerCase())) c = DAY_COLORS[idx % DAY_COLORS.length];
    return { c, band: mixHex(c, '#000000', 0.62), light: mixHex(c, '#ffffff', 0.35), soft: mixHex(c, '#ffffff', 0.95), soft2: mixHex(c, '#ffffff', 0.88), line: mixHex(c, '#ffffff', 0.55), ink: mixHex(c, '#000000', 0.45) };
  }
  const schemeStyle = (sc) => `--pm-c:${sc.c};--pm-band:${sc.band};--pm-light:${sc.light};--pm-soft:${sc.soft};--pm-soft2:${sc.soft2};--pm-line:${sc.line};--pm-ink:${sc.ink}`;
  const MINUTA_BASE = 'font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;background:#fff;font-size:12px';
  const MINUTA_RULES = `h1,h2,h3{margin:0}.pm-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:16px}
    h1{font-size:22px}.pm-eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--pm-ink,#8a6a1f);font-weight:700}.pm-targets{text-align:right;font-size:11px;color:#333}
    .pm-meal{margin-bottom:18px}.pm-meal h2{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:14px;line-height:1.3;color:#fff;background:var(--pm-band,#111);border-radius:3px;padding:6px 10px;margin-bottom:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pm-meal h2 span{flex:none;font-weight:700;color:var(--pm-light,#f0cd82);font-size:12px}
    .pm-opt{break-inside:avoid;margin:0 0 14px;padding:10px 12px 12px;border:1.5px solid var(--pm-c,#d8b15f);border-left-width:5px;border-radius:8px;background:var(--pm-soft,#fffdf7);-webkit-print-color-adjust:exact;print-color-adjust:exact}.pm-opt h3{font-size:12.5px;margin-bottom:6px}
    .pm-opt img{max-height:180px;max-width:280px;object-fit:cover;border-radius:6px;display:block;margin-bottom:6px}
    table{width:100%;border-collapse:collapse;font-size:11px}th,td{border-bottom:1px solid #e3e3e3;padding:3px 5px;text-align:right}
    th:nth-child(-n+2),td:nth-child(-n+2){text-align:left}th{background:#f3f3f3;font-weight:600}tfoot td{font-weight:700;border-top:1px solid #999}
    .pm-total{display:flex;flex-wrap:wrap;align-items:baseline;gap:3px 14px;margin-top:6px;padding:5px 8px;border:1px solid var(--pm-line,#e6d9b8);background:var(--pm-soft2,#faf6ec);border-radius:4px;font-size:11.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .pm-tl{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--pm-ink,#8a6a1f)}
    .pm-scheme .pm-head{border-bottom-color:var(--pm-band,#111)}.pm-scheme .pd-h,.pm-scheme h1{border-left:6px solid var(--pm-c,#d8b15f);padding-left:8px}
    .pm-notes{font-size:11px;color:#333;margin-top:5px}.pm-day{border-top:1px solid #ccc;padding-top:8px}
    .pd-cover{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:3px solid #111;padding-bottom:12px;margin-bottom:6px}
    .pd-cover h1{font-size:26px}.pd-meta{text-align:right;font-size:11px;color:#333}
    .pd-sec{margin-top:22px}.pd-break{break-before:page}
    .pd-sec-title{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:#f3efe4;border-left:4px solid #d8b15f;padding:7px 10px;margin-bottom:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .pd-sec-title span{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#111;color:#fff;font-size:11px;letter-spacing:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .pd-day{margin-bottom:22px}.pd-h{font-size:19px}
    .pd-kv{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}.pd-kv div{flex:1 1 150px;border:1px solid #ddd;border-radius:4px;padding:7px 10px}.pd-kv div:first-child{flex-basis:100%}
    .pd-kv span{display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8a6a1f;font-weight:700;margin-bottom:2px}.pd-kv b{font-size:13px}
    .pd-sub{font-size:13px;margin:0 0 6px}.pd-goals{margin:0;padding-left:22px;font-size:12px}.pd-goals li{margin-bottom:6px;padding-left:2px}
    .pd-empty{font-size:11.5px;color:#666;font-style:italic;margin:0 0 6px}.pd-mute{color:#999}
    .pd-dist{table-layout:fixed}.pd-dist th,.pd-dist td{text-align:left;vertical-align:top;padding:5px 6px;overflow-wrap:anywhere}.pd-dist th:first-child{width:30px}.pd-dist th:nth-child(2){width:32%}.pd-dist th:nth-child(3){width:64px}.pd-dist td:first-child{color:#666}.pd-dist td:nth-child(3){white-space:nowrap}
    .pd-note{font-size:11.5px;color:#222;border:1px solid #e6d9b8;background:#faf6ec;border-radius:4px;padding:8px 10px;margin-top:8px;break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .pd-stats{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:11.5px;margin-bottom:10px}
    .pd-scroll{overflow-x:auto}.pd-wk{min-width:600px;font-size:10px}.pd-wk th,.pd-wk td{padding:3px 4px}.pd-wk th{vertical-align:bottom}.pd-wk td{white-space:nowrap}.pd-wk th:nth-child(3),.pd-wk td:nth-child(3){text-align:left}
    .pd-pill{display:inline-block;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:700;background:#eee;color:#555;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .pd-pill.ok{background:#e0f3e8;color:#17663f}.pd-pill.warn{background:#fdefd6;color:#8a5200}.pd-pill.bad{background:#fbe2e2;color:#a12626}
    .pd-foot{font-size:10.5px;color:#666;margin:8px 0 0}
    .pd-cal-legend{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:11.5px;margin-bottom:12px}.pd-cal-legend span{display:inline-flex;align-items:center;gap:6px}
    .pd-cal-legend i{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:3px;font-style:normal;font-size:9px;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .pd-cal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 16px}
    .pd-cal-m{table-layout:fixed;font-size:10px;break-inside:avoid}.pd-cal-m th,.pd-cal-m td{text-align:center!important;padding:2px 1px;border:1px solid #e3e3e3}
    .pd-cal-m thead tr:first-child th{font-size:11.5px;background:#fff;border:0;padding-bottom:4px}.pd-cal-m thead tr:last-child th{font-size:9px;color:#666;background:#f6f6f6}
    .pd-cal-m td.on{font-weight:600;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pd-cal-m td i{font-style:normal;font-size:7.5px;font-weight:700;margin-left:2px}`;
  const MINUTA_CSS = `body{margin:24px;${MINUTA_BASE}}
    ${MINUTA_RULES}`;
  // Vista previa dentro de la app: las mismas reglas del archivo, limitadas a la hoja .mn-paper para que no afecten al resto.
  (() => {
    const scoped = MINUTA_RULES.replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel, decl) => `${sel.split(',').map((s) => `.mn-paper ${s.trim()}`).join(',')}{${decl}}`);
    const st = document.createElement('style'); st.id = 'minuta-preview-css'; st.textContent = `.mn-paper{${MINUTA_BASE}}${scoped}`; document.head.appendChild(st);
  })();
  async function inlineImage(v) {
    if (!v || String(v).startsWith('data:')) return v;
    try { const r = await fetch(imgSrc(v)); if (!r.ok) return ''; return await blobToDataURL(await r.blob()); } catch { return ''; }
  }
  // Solo se imprimen las opciones que tienen al menos un alimento; las comidas sin ninguna opción con alimentos se omiten.
  const minutaHasFood = (o) => (o.foods || []).some((l) => l.foodId || String(l.foodName || '').trim());
  const minutaMeals = (dt) => dt.meals.map((m) => ({ m, opts: m.options.filter(minutaHasFood) })).filter((x) => x.opts.length);
  const minutaLabel = () => 'Descargar planificación';
  // Contenido de la minuta: lo usan el archivo descargado, la impresión y la vista previa (imgOf resuelve cada imagen).
  function minutaBody(a, dt, pmeals, imgOf, head = null) {
    const t = dayTargets(a, dt), tot = dayTotals(dt);
    const meals = pmeals.map(({ m, opts }, i) => `<div class="pm-meal"><h2>${esc(String(m.name || '').trim() || `Comida ${i + 1}`)}${m.time ? ` <span>${esc(m.time)}</span>` : ''}</h2>
      ${opts.map((o, k) => { const ot = optTotals(o); return `<div class="pm-opt">
        <h3>Opción ${k + 1}${o.title ? ' — ' + esc(o.title) : ''}</h3>
        ${o.image && imgOf(o.image) ? `<img src="${imgOf(o.image)}" alt="">` : ''}
        <table><thead><tr><th>Alimento</th><th>Cantidad</th></tr></thead><tbody>
        ${o.foods.filter((l) => l.foodId || String(l.foodName || '').trim()).map((l) => { const x = lineCalc(l); return `<tr><td>${esc(x.f ? x.f.name : l.foodName || '')}</td><td>${esc(l.cantidad || '—')}</td></tr>`; }).join('')}
        </tbody></table>
        <div class="pm-total"><span class="pm-tl">Aporte total</span><b>${fmt(ot.kcal)} kcal</b><span>Proteína ${fmt(ot.p, 1)} g</span><span>Carbohidratos ${fmt(ot.c, 1)} g</span><span>Grasa ${fmt(ot.g, 1)} g</span></div>
        ${o.notes ? `<div class="pm-notes"><b>Notas:</b> ${esc(o.notes).replace(/\n/g, '<br>')}</div>` : ''}</div>`; }).join('')}</div>`).join('');
    return `<div class="pm-scheme" style="${schemeStyle(dayScheme(dt))}"><div class="pm-head"><div>${head ? `<div class="pm-eyebrow">${esc(head.eyebrow)}</div><h2 class="pd-h">${esc(head.title)}</h2>` : `<div class="pm-eyebrow">Minuta · ${esc(dt.name)}</div><h1>${esc(a.q.nombre || '')}</h1>`}</div>
      <div class="pm-targets">Objetivo: <b>${fmt(t.kcal)} kcal</b> · P ${fmt(t.p)} g · C ${fmt(t.c)} g · G ${fmt(t.g)} g<br>Menú (opciones ★): ${fmt(tot.kcal)} kcal · P ${fmt(tot.p)} · C ${fmt(tot.c)} · G ${fmt(tot.g)}</div></div>
      ${meals}${dt.notes ? `<div class="pm-notes pm-day"><b>Notas generales:</b><br>${esc(dt.notes).replace(/\n/g, '<br>')}</div>` : ''}</div>`;
  }
  // Minuta del tipo de día activo (botón del portal del cliente): también se descarga en PDF.
  async function printMenu() {
    const a = A(), dt = activeDay(a), pmeals = minutaMeals(dt);
    if (!pmeals.length) { toast('No hay opciones con alimentos para incluir en la minuta.'); return; }
    const base = `minuta-${slug(dt.name)}-${slug(a.q.nombre || 'atleta')}`, images = pmeals.flatMap(({ opts }) => opts.map((o) => o.image)).filter(Boolean);
    await savePdf({ base, images, build: (imgOf) => minutaPdfDef(a, dt, pmeals, imgOf), okMsg: 'Minuta descargada en PDF.', failMsg: 'No se pudo descargar la minuta.',
      fallback: async () => { const imgs = await htmlImages(images); await deliverDoc({ body: minutaBody(a, dt, pmeals, (v) => imgs.get(v)), title: `Minuta ${dt.name} · ${a.q.nombre || ''}`, fname: `${base}.html`, what: 'Minuta descargada', fail: 'No se pudo descargar la minuta.' }); } });
  }
  // Entrega un documento: en el Artifact se descarga como HTML listo para imprimir o guardar en PDF (el visor no permite imprimir);
  // en local se imprime directamente.
  async function deliverDoc({ body, title, fname, what, fail }) {
    if (MODE === 'sync') {
      const doc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${MINUTA_CSS}</style></head><body><div id="print-root">${body}</div></body></html>`;
      try { await cdownloads.save({ filename: fname, data: doc }); toast(`${what}. Ábrela en el navegador para imprimir o guardar como PDF.`); }
      catch (e) { if (e && e.code !== 'declined') toast(fail); }
      return;
    }
    const root = document.createElement('div'); root.id = 'print-root'; root.className = 'mn-paper'; root.innerHTML = body;
    document.body.appendChild(root);
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); root.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  }

  // ---- Planificación completa: 1) planificación de la etapa, 2) minuta ejemplo de cada tipo de día, 3) distribución de comidas, 4) resumen del seguimiento semanal ----
  // Meses del calendario de alimentación que tienen al menos un día asignado ('aaaa-mm'), y días por tipo en ellos.
  function calDocData(a) {
    const days = Object.keys(a.calendar || {}).filter((d) => calType(a, d)).sort();
    const months = [...new Set(days.map((d) => d.slice(0, 7)))];
    const counts = {}; days.forEach((d) => { const id = a.calendar[d]; counts[id] = (counts[id] || 0) + 1; });
    const grid = (ym) => { // semanas del mes (lunes a domingo) con la fecha ISO o null
      const [y, m] = ym.split('-').map(Number), lead = (new Date(y, m - 1, 1, 12).getDay() + 6) % 7, nd = new Date(y, m, 0).getDate();
      const cells = Array(lead).fill(null).concat(Array.from({ length: nd }, (_, i) => `${ym}-${pad(i + 1)}`));
      while (cells.length % 7) cells.push(null);
      return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
    };
    return { months, counts, grid, label: (ym) => `${CAL_M[+ym.slice(5) - 1]} ${ym.slice(0, 4)}` };
  }
  function planDocBody(a, imgOf, sheets = false) {
    const nl = (s) => esc(s).replace(/\n/g, '<br>');
    // 1 · Planificación de la etapa: objetivo, fechas y objetivos
    const pf = planifOf(a), objs = pf.objetivos.map((s) => String(s || '').trim()).filter(Boolean), dur = planifDuration(pf);
    const kv = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
    const planif = `<div class="pd-kv">${kv('Objetivo de la etapa', String(pf.objetivo || '').trim() ? esc(String(pf.objetivo).trim()) : '—')}${kv('Fecha de inicio', parseISO(pf.inicio) ? fmtDate(pf.inicio) : '—')}${kv('Fecha de término', parseISO(pf.termino) ? fmtDate(pf.termino) : '—')}${dur ? kv('Duración', dur) : ''}</div>
      <h3 class="pd-sub">Objetivos de la etapa</h3>
      ${objs.length ? `<ol class="pd-goals">${objs.map((o) => `<li>${nl(o)}</li>`).join('')}</ol>` : '<p class="pd-empty">Aún no se han definido objetivos para esta etapa.</p>'}`;
    // 2 · Calendario de alimentación: los meses con días asignados
    const cd = calDocData(a);
    const calHtml = cd.months.length ? `<div class="pd-cal-legend">${a.dayTypes.filter((dt) => cd.counts[dt.id]).map((dt) => `<span><i style="background:${dayScheme(dt).light}">${esc(dtInitial(dt))}</i>${esc(dt.name)} <b>${cd.counts[dt.id]} ${cd.counts[dt.id] === 1 ? 'día' : 'días'}</b></span>`).join('')}</div>
      <div class="pd-cal">${cd.months.map((ym) => `<table class="pd-cal-m"><thead><tr><th colspan="7">${cd.label(ym)}</th></tr><tr>${DOW_L.map((l) => `<th>${l}</th>`).join('')}</tr></thead><tbody>
        ${cd.grid(ym).map((w) => `<tr>${w.map((d) => { if (!d) return '<td></td>'; const dt = calType(a, d); return dt ? `<td class="on" style="background:${dayScheme(dt).light}">${+d.slice(8)}<i>${esc(dtInitial(dt))}</i></td>` : `<td>${+d.slice(8)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`).join('')}</div>`
      : '<p class="pd-empty">Aún no se han asignado días en el calendario de alimentación del Menú diario.</p>';
    // 3 · Minuta ejemplo de cada tipo de día
    const minutas = a.dayTypes.map((dt, i) => {
      const pm = minutaMeals(dt);
      return `<div class="pd-day${i ? ' pd-break' : ''}">${pm.length
        ? minutaBody(a, dt, pm, imgOf, { eyebrow: 'Minuta ejemplo', title: dt.name })
        : `<div class="pm-head"><div><div class="pm-eyebrow">Minuta ejemplo</div><h2 class="pd-h">${esc(dt.name)}</h2></div></div><p class="pd-empty">Este tipo de día aún no tiene opciones con alimentos en el Menú diario.</p>`}</div>`;
    }).join('');
    // 4 · Distribución de comidas: horario e indicaciones de cada comida, por tipo de día
    const dist = a.dayTypes.map((dt) => {
      const t = dayTargets(a, dt);
      return `<div class="pd-day"><div class="pm-head"><div><div class="pm-eyebrow">Distribución de comidas</div><h2 class="pd-h">${esc(dt.name)}</h2></div>
        ${t.ok ? `<div class="pm-targets">Objetivo del día: <b>${fmt(t.kcal)} kcal</b><br>Proteínas ${fmt(t.p)} g · Carbohidratos ${fmt(t.c)} g · Grasas ${fmt(t.g)} g</div>` : ''}</div>
        ${dt.meals.length ? `<table class="pd-dist"><thead><tr><th>#</th><th>Comida</th><th>Hora</th><th>Indicaciones</th></tr></thead><tbody>
          ${dt.meals.map((m, i) => `<tr><td>${pad(i + 1)}</td><td><b>${esc(m.name || `Comida ${i + 1}`)}</b></td><td>${esc(m.time || '—')}</td><td>${String(m.indic || '').trim() ? nl(String(m.indic).trim()) : '<span class="pd-mute">—</span>'}</td></tr>`).join('')}
        </tbody></table>` : '<p class="pd-empty">Este tipo de día aún no tiene comidas.</p>'}</div>`;
    }).join('');
    const noteOf = (k) => String((a.distNotes && a.distNotes[k] != null) ? a.distNotes[k] : DIST_NOTES[k]).trim();
    const notes = [['org', 'Cómo organizarte'], ['tip', 'Tip']].filter(([k]) => noteOf(k)).map(([k, l]) => `<div class="pd-note"><b>${l}.</b> ${nl(noteOf(k))}</div>`).join('');
    // 5 · Resumen del seguimiento semanal: desde la semana inicial hasta la actual
    const cw = currentWeek(a), cfg = cfgOf(a), ks = Array.from({ length: cw + 1 }, (_, k) => k);
    const withAvg = ks.filter((k) => weekAvg(a, k) != null), any = withAvg.some((k) => weekWeights(a, k).length) || ks.some((k) => weekSteps(a, k) != null || SCALES.some(([f]) => weekField(a, k, f).avg != null));
    const p0 = weekAvg(a, 0), kLast = withAvg.length ? withAvg[withAvg.length - 1] : null, pL = kLast != null ? weekAvg(a, kLast) : null;
    const sc = (k, f) => { const v = weekField(a, k, f).avg; return v != null ? fmt(v, 1) : '—'; };
    const seg = any ? `<div class="pd-stats">
        <span>Inicio: <b>${fmtDate(cfg.inicio)}</b></span><span>Semana actual: <b>${cw} de ${weekCount(a)}</b></span>
        ${p0 != null ? `<span>Peso inicial: <b>${fmt(p0, 2)} kg</b></span>` : ''}
        ${pL != null && kLast > 0 ? `<span>Último promedio (${weekLabel(kLast).toLowerCase()}): <b>${fmt(pL, 2)} kg</b></span>` : ''}
        ${p0 && pL != null && kLast > 0 ? `<span>Cambio total: <b>${fmtS(pL - p0, 2)} kg (${fmtS(((pL - p0) / p0) * 100, 1)}%)</b></span>` : ''}
      </div>
      <div class="pd-scroll"><table class="pd-wk"><thead><tr><th>Semana</th><th>Inicio</th><th>Etapa</th><th>Peso (kg)</th><th>% buscado</th><th>% logrado</th><th>Estado</th><th>Pasos</th>${SCALES.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>
        ${ks.map((k) => { const avg = weekAvg(a, k), b = buscado(a, k), l = logrado(a, k), st = status(a, k), steps = weekSteps(a, k);
          return `<tr><td><b>${k === 0 ? 'Inicial' : weekLabel(k)}</b></td><td>${fmtDate(weekStart(a, k), true)}</td><td>${esc(weekEtapa(a, k))}</td><td>${avg != null ? fmt(avg, 2) : '—'}</td><td>${b != null ? fmtS(b) + '%' : '—'}</td><td>${l != null ? fmtS(l) + '%' : '—'}</td><td><span class="pd-pill ${st.key}">${esc(st.label)}</span></td><td>${steps != null ? fmt(steps) : '—'}</td>${SCALES.map(([f]) => `<td>${sc(k, f)}</td>`).join('')}</tr>`; }).join('')}
      </tbody></table></div>
      <p class="pd-foot">Peso: promedio de los días registrados en la semana. Escalas (0-5): promedio de los días anotados; en Estrés el valor alto es el desfavorable.</p>`
      : '<p class="pd-empty">Aún no hay registros de seguimiento.</p>';
    const sec = (n, title, html, brk = true) => `<section class="pd-sec${brk ? ' pd-break' : ''}"><div class="pd-sec-title"><span>${n}</span>${title}</div>${html}</section>`;
    if (sheets) {
      // Vista previa hoja por hoja: vertical para Planificación, Distribución y Seguimiento; horizontal para cada minuta.
      const sheet = (html) => `<div class="mn-paper mn-sheet">${html}</div>`;
      const land = a.dayTypes.map((dt, i) => {
        const pm = minutaMeals(dt), t = dayTargets(a, dt), tot = dayTotals(dt);
        const head = `${i ? '' : '<div class="pd-sec-title"><span>3</span>Minuta ejemplo</div>'}<div class="pm-head"><div><div class="pm-eyebrow">Minuta ejemplo</div><h2 class="pd-h">${esc(dt.name)}</h2></div>
          ${pm.length ? `<div class="pm-targets">Objetivo: <b>${fmt(t.kcal)} kcal</b> · P ${fmt(t.p)} g · C ${fmt(t.c)} g · G ${fmt(t.g)} g<br>Menú (opciones ★): ${fmt(tot.kcal)} kcal · P ${fmt(tot.p)} · C ${fmt(tot.c)} · G ${fmt(tot.g)}</div>` : ''}</div>`;
        const body = pm.length ? minutaGridHTML(dt, pm, imgOf) : '<p class="pd-empty">Este tipo de día aún no tiene opciones con alimentos en el Menú diario.</p>';
        return `<div class="mn-sheet mn-land-wrap"><div class="mn-paper mn-land"><div class="mg-fit pm-scheme" style="${schemeStyle(dayScheme(dt))}">${head}${body}</div></div></div>`;
      }).join('');
      return sheet(`<header class="pd-cover"><div><div class="pm-eyebrow">Planificación nutricional</div><h1>${esc(a.q.nombre || 'Atleta')}</h1></div>
        <div class="pd-meta">Generada el ${fmtDate(todayISO())}<br>${a.dayTypes.map((d) => esc(d.name)).join(' · ')}</div></header>${sec(1, 'Planificación', planif, false)}`) + sheet(sec(2, 'Calendario de alimentación', calHtml, false))
        + land + sheet(sec(4, 'Distribución de las comidas', dist + notes, false)) + sheet(sec(5, 'Resumen del seguimiento semanal', seg, false));
    }
    return `<header class="pd-cover"><div><div class="pm-eyebrow">Planificación nutricional</div><h1>${esc(a.q.nombre || 'Atleta')}</h1></div>
        <div class="pd-meta">Generada el ${fmtDate(todayISO())}<br>${a.dayTypes.map((d) => esc(d.name)).join(' · ')}</div></header>
      ${sec(1, 'Planificación', planif, false)}
      ${sec(2, 'Calendario de alimentación', calHtml)}
      ${sec(3, 'Minuta ejemplo', minutas)}
      ${sec(4, 'Distribución de las comidas', dist + notes)}
      ${sec(5, 'Resumen del seguimiento semanal', seg)}`;
  }
  // Minuta horizontal en HTML para la vista previa: misma estructura que el PDF (fila por comida, columna por opción).
  function minutaGridHTML(dt, pm, imgOf) {
    // Una sola cuadrícula: la columna de los tiempos de comida toma el ancho del título más largo y el resto queda para las opciones.
    const rows = pm.map(({ m, opts }, i) => {
      const cells = opts.map((o, k) => {
        const ot = optTotals(o), img = o.image ? imgOf(o.image) : '';
        const foods = o.foods.filter((l) => l.foodId || String(l.foodName || '').trim()).map((l) => { const x = lineCalc(l), c = String(l.cantidad || '').trim(); return `<tr><td>${esc(x.f ? x.f.name : l.foodName || '')}</td><td class="${c ? '' : 'mg-miss'}">${esc(c || '—')}</td></tr>`; }).join('');
        return `<div class="mg-opt"><div class="mg-on">Opción ${k + 1}</div>${o.title ? `<div class="mg-dish">${esc(o.title)}</div>` : ''}
          ${img ? `<img class="mg-img" src="${img}" alt="">` : ''}
          <table class="mg-ft"><tbody>${foods}</tbody></table>
          <div class="mg-tot">${fmt(ot.kcal)} kcal · P ${fmt(ot.p, 1)} g · C ${fmt(ot.c, 1)} g · G ${fmt(ot.g, 1)} g</div>
          ${o.notes ? `<div class="mg-notes"><b>Notas:</b> ${esc(o.notes).replace(/\n/g, '<br>')}</div>` : ''}</div>`;
      }).join('');
      return `<div class="mg-row"><div class="mg-meal"><b>${esc(String(m.name || '').trim() || `Comida ${i + 1}`)}</b>${m.time ? `<span>${esc(m.time)}</span>` : ''}</div>
        <div class="mg-opts" style="grid-template-columns:repeat(${opts.length},minmax(0,1fr))">${cells}</div></div>`;
    }).join('');
    return `<div class="mg-grid">${rows}</div>` + (dt.notes ? `<div class="mg-notes mg-day"><b>Notas generales:</b> ${esc(dt.notes).replace(/\n/g, '<br>')}</div>` : '');
  }
  // Hoja horizontal A4 a 96 ppp (1123 × 794 px) con los márgenes del PDF; se escala para caber en la pantalla.
  const LAND_PX = { w: 1123, h: 794, avail: 794 - 53 - 61 };
  function scalePreviewSheets() {
    document.querySelectorAll('.mn-land-wrap').forEach((w) => { const s = w.clientWidth / LAND_PX.w; w.style.setProperty('--s', s); w.style.height = Math.round(LAND_PX.h * s) + 'px'; });
  }
  // Igual que en el PDF: letra e imagen más grandes con las que la minuta completa cabe en la hoja.
  function fitPreviewSheets() {
    scalePreviewSheets();
    document.querySelectorAll('.mn-land').forEach((el) => {
      const fit = el.querySelector('.mg-fit'); if (!fit) return;
      const hasImg = !!fit.querySelector('.mg-img');
      const ok = (f, ih) => { el.style.setProperty('--mg-fs', f); el.style.setProperty('--mg-ih', ih); el.classList.toggle('mg-noimg', !ih); return fit.offsetHeight <= LAND_PX.avail; };
      for (const [ih, fonts] of MINUTA_FITS) {
        if (ih && !hasImg) continue;
        let lo = 0, hi = fonts.length - 1, best = -1;
        while (lo <= hi) { const mid = (lo + hi) >> 1; if (ok(fonts[mid], ih)) { best = mid; hi = mid - 1; } else lo = mid + 1; }
        if (best >= 0) { ok(fonts[best], ih); return; }
      }
      ok(5, 0);
    });
  }
  // ---- La planificación se descarga en PDF (hojas A4, texto real y seleccionable) ----
  // El generador de PDF (pdfmake) pesa ~2 MB: se carga solo al pulsar el botón, la primera vez.
  const PDF_LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js'];
  let pdfLibP = null;
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = false; s.onload = res; s.onerror = () => { s.remove(); rej(new Error('No se pudo cargar ' + src)); }; document.head.appendChild(s); });
  function loadPdfLib() {
    if (!pdfLibP) pdfLibP = (async () => { for (const u of PDF_LIBS) await loadScript(u); if (!window.pdfMake || !window.pdfMake.vfs) throw new Error('pdfmake no disponible'); return window.pdfMake; })().catch((e) => { pdfLibP = null; throw e; });
    return pdfLibP;
  }
  // Imagen lista para el PDF: data URL en JPEG o PNG (otros formatos se convierten a JPEG). null si no se puede leer.
  async function pdfImage(v) {
    try {
      const d = await inlineImage(v); if (!d) return null;
      if (/^data:image\/(jpeg|jpg|png)[;,]/i.test(d)) return d;
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = d; });
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/jpeg', 0.88);
    } catch { return null; }
  }
  const pdfBlob = (pdfMake, def) => new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('El PDF tardó demasiado en generarse')), 45000);
    try { pdfMake.createPdf(def).getBlob((b) => { clearTimeout(to); res(b); }); } catch (e) { clearTimeout(to); rej(e); }
  });
  // ---- Piezas comunes de los PDF (planificación completa y minuta del cliente) ----
  function pdfKit() {
    const GOLD = '#8a6a1f', BAR = '#d8b15f', W = 523;
    const str = (v) => String(v == null ? '' : v);
    const rule = (w, c, mt, mb) => ({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: W, y2: 0, lineWidth: w, lineColor: c }], margin: [0, mt, 0, mb] });
    const head = (eyebrow, title, right) => ({ columns: [{ width: '*', stack: [{ text: eyebrow.toUpperCase(), style: 'eyebrow' }, { text: title, style: 'h2', margin: [0, 1, 0, 0] }] }, { width: 'auto', text: right || '', style: 'meta', alignment: 'right', margin: [0, 6, 0, 0] }], columnGap: 12 });
    const dayHead = (eyebrow, title, right) => [head(eyebrow, title, right), rule(1.2, '#111', 5, 8)];
    const secTitle = (n, t, brk) => Object.assign({ table: { widths: [2, '*'], body: [[{ text: '', fillColor: BAR }, { text: `${n}    ${t.toUpperCase()}`, style: 'sec', fillColor: '#f3efe4', margin: [4, 3, 0, 3] }]] }, layout: 'noBorders', margin: [0, brk ? 0 : 14, 0, 12] }, brk ? { pageBreak: 'before' } : {});
    const lines = { hLineWidth: (i) => (i === 0 ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => '#e3e3e3', paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 3, paddingBottom: () => 3 };
    const th = (t, al) => ({ text: t, style: 'th', fillColor: '#f3f3f3', alignment: al || 'left' });
    const box = (content, mt = 6) => ({ table: { widths: ['*'], body: [[Object.assign({ fillColor: '#faf6ec', margin: [3, 2, 3, 2] }, content)]] }, layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#e6d9b8', vLineColor: () => '#e6d9b8' }, margin: [0, mt, 0, 0] });
    const empty = (t) => ({ text: t, italics: true, color: '#666', fontSize: 8.5, margin: [0, 0, 0, 6] });
    return { GOLD, BAR, W, str, rule, head, dayHead, secTitle, lines, th, box, empty };
  }
  // Comidas de un tipo de día (solo las opciones con alimentos) y sus notas generales.
  function pdfDayMeals(kit, dt, pm, imgOf) {
    const { str, rule, lines, th } = kit, out = [], sc = dayScheme(dt), BAR = sc.c;
    const box = (content, mt = 6) => ({ table: { widths: ['*'], body: [[Object.assign({ fillColor: sc.soft2, margin: [3, 2, 3, 2] }, content)]] }, layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => sc.line, vLineColor: () => sc.line }, margin: [0, mt, 0, 0] });
    const optBlock = (m, o, i, k) => {
      const ot = optTotals(o), img = o.image ? imgOf(o.image) : null;
      const foods = o.foods.filter((l) => l.foodId || str(l.foodName).trim()).map((l) => { const x = lineCalc(l); return [str(x.f ? x.f.name : l.foodName), str(l.cantidad) || '—']; });
      const stack = [{ text: `Opción ${k + 1}${o.title ? ' — ' + o.title : ''}`, bold: true, fontSize: 9.5, margin: [0, 0, 0, 5] }];
      if (img) stack.push({ image: img, fit: [210, 135], margin: [0, 0, 0, 6] });
      stack.push({ table: { headerRows: 1, widths: ['*', '*'], body: [[th('Alimento'), th('Cantidad')]].concat(foods) }, layout: lines, fontSize: 8.5 });
      stack.push(box({ text: [{ text: 'APORTE TOTAL    ', style: 'eyebrow', color: sc.ink }, { text: `${fmt(ot.kcal)} kcal`, bold: true }, `     Proteína ${fmt(ot.p, 1)} g     Carbohidratos ${fmt(ot.c, 1)} g     Grasa ${fmt(ot.g, 1)} g`], fontSize: 8.5 }));
      if (o.notes) stack.push({ text: [{ text: 'Notas: ', bold: true }, str(o.notes)], fontSize: 8.5, color: '#333', margin: [0, 5, 0, 0] });
      return { table: { widths: ['*'], body: [[{ stack }]] }, layout: { hLineWidth: () => 1, vLineWidth: (j) => (j === 0 ? 4 : 1), hLineColor: () => BAR, vLineColor: () => BAR, paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 8, paddingBottom: () => 8, fillColor: () => sc.soft }, margin: [0, 0, 0, 12] };
    };
    pm.forEach(({ m, opts }, i) => {
      // Título de la comida (como en el Menú diario) en una banda oscura, bien distinta de sus opciones.
      const title = [{ table: { widths: ['*'], body: [[{ fillColor: sc.band, margin: [5, 3, 5, 3], columns: [
        { width: '*', text: str(m.name).trim() || `Comida ${i + 1}`, bold: true, color: '#fff', fontSize: 11 },
        { width: 'auto', text: str(m.time), bold: true, color: sc.light, fontSize: 9, margin: [0, 2, 0, 0] }], columnGap: 10 }]] }, layout: 'noBorders', margin: [0, 6, 0, 9] }];
      // El título de la comida no se separa de su primera opción al cambiar de hoja.
      opts.forEach((o, k) => out.push({ unbreakable: true, stack: (k === 0 ? title : []).concat([optBlock(m, o, i, k)]) }));
    });
    if (dt.notes) out.push(rule(0.5, '#ccc', 2, 6), { text: [{ text: 'Notas generales\n', bold: true }, str(dt.notes)], fontSize: 8.5, color: '#333', margin: [0, 0, 0, 8] });
    return out;
  }
  // Minuta en una hoja horizontal: una fila por comida (tiempo de comida a la izquierda) y una columna por opción.
  // Letra e imágenes se ajustan para que la minuta completa quepa en una hoja, según cuántas comidas y opciones tenga:
  // se prueban tamaños de mayor a menor y se usa el primero que el generador confirma que ocupa una sola hoja.
  const PDF_LAND_W = 770; // ancho útil de A4 horizontal con los márgenes del documento
  // Grupos por tamaño de imagen (de mayor a menor) con la letra mínima aceptable para conservar la imagen; el último, sin imágenes.
  const MINUTA_FITS = [[64, [9.5, 9, 8.5, 8, 7.5]], [54, [9.5, 9, 8.5, 8, 7.5]], [46, [9, 8.5, 8, 7.5]], [38, [8, 7.5, 7, 6.5]], [30, [7, 6.5, 6]], [24, [6.5, 6]], [0, [9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5]]];
  function minutaGridData(kit, pm, imgOf) {
    const { str } = kit;
    return pm.map(({ m, opts }) => ({ m, opts: opts.map((o) => ({ o, ot: optTotals(o), img: o.image ? imgOf(o.image) : null,
      foods: o.foods.filter((l) => l.foodId || str(l.foodName).trim()).map((l) => { const x = lineCalc(l); return [str(x.f ? x.f.name : l.foodName), str(l.cantidad).trim()]; }) })) }));
  }
  const MG = { MW: 92, GAP: 5 };
  // Ancho de la franja de tiempos de comida: el del título (u hora) más largo, para dejar el resto a las opciones.
  const mgMealW = (data, fs) => Math.round(Math.min(170, Math.max(52, Math.max(...data.map(({ m }) => Math.max(String(m.name || 'Comida 10').trim().length * (fs + 1.5) * 0.57, String(m.time || '').length * fs * 0.6))) + 14)));
  const mgOptW = (n, mw = MG.MW) => (PDF_LAND_W - mw - 4 - 2 * n) / n - 12;
  function pdfMinutaGrid(kit, dt, data, fs, imgH) {
    const { str } = kit, sc = dayScheme(dt), MW = mgMealW(data, fs);
    const rows = data.map(({ m, opts }, i) => {
      const iw = Math.max(40, mgOptW(opts.length, MW));
      const cells = opts.map((d, k) => {
        // Arriba y centrado: «Opción N», el nombre de la comida y la imagen; abajo, los alimentos con su cantidad en columnas separadas.
        const st = [{ text: `Opción ${k + 1}`, bold: true, color: sc.ink, fontSize: fs + 0.5, alignment: 'center' }];
        if (d.o.title) st.push({ text: d.o.title, bold: true, fontSize: fs + 0.5, alignment: 'center', margin: [0, 1, 0, 0] });
        if (d.img && imgH) st.push({ image: d.img, fit: [iw, imgH], alignment: 'center', margin: [0, 4, 0, 0] });
        if (d.foods.length) st.push({ margin: [0, 4, 0, 0], table: { widths: ['*', 'auto'], body: d.foods.map(([nm, c]) => [{ text: nm, fontSize: fs }, { text: c || '—', bold: true, fontSize: fs, alignment: 'right', color: c ? '#111' : '#999' }]) },
          layout: { hLineWidth: (j, node) => (j === 0 || j === node.table.body.length ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => sc.line, paddingLeft: () => 1, paddingRight: () => 1, paddingTop: () => 1, paddingBottom: () => 1 } });
        st.push({ text: `${fmt(d.ot.kcal)} kcal · P ${fmt(d.ot.p, 1)} g · C ${fmt(d.ot.c, 1)} g · G ${fmt(d.ot.g, 1)} g`, fontSize: fs - 0.5, bold: true, color: sc.ink, alignment: 'center', margin: [0, 3, 0, 0] });
        if (d.o.notes) st.push({ text: [{ text: 'Notas: ', bold: true }, str(d.o.notes)], fontSize: fs - 0.5, color: '#333', margin: [0, 2, 0, 0] });
        return { stack: st, fillColor: sc.soft };
      });
      const meal = { fillColor: sc.band, margin: [4, 4, 4, 4], alignment: 'center', stack: [{ text: str(m.name).trim() || `Comida ${i + 1}`, bold: true, color: '#fff', fontSize: fs + 1.5, alignment: 'center' }, m.time ? { text: str(m.time), bold: true, color: sc.light, fontSize: fs, alignment: 'center', margin: [0, 2, 0, 0] } : ''] };
      const opt = { table: { widths: cells.map(() => '*'), body: [cells] }, layout: { hLineWidth: () => 1, vLineWidth: (j) => (j === 0 ? 3 : 1), hLineColor: () => sc.c, vLineColor: () => sc.c, paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 3, paddingBottom: () => 3 } };
      return [meal, opt];
    });
    const out = [{ lineHeight: 1.05, table: { widths: [MW, '*'], dontBreakRows: true, body: rows }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: (j) => (j ? 4 : 0), paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => MG.GAP } }];
    if (dt.notes) out.push({ text: [{ text: 'Notas generales: ', bold: true }, str(dt.notes)], fontSize: fs, color: '#333', margin: [0, 4, 0, 0] });
    return out;
  }
  // Cuenta las hojas que ocupa un documento (para elegir el tamaño que deja la minuta en una sola hoja).
  const pdfPages = (pdfMake, def) => new Promise((res) => {
    try { pdfMake.createPdf(def).getBuffer((buf) => { let n = 0; const sstr = new TextDecoder('latin1').decode(buf); const re = /\/Type\s*\/Page(?!s)/g; while (re.exec(sstr)) n++; res(n || 1); }); } catch { res(99); }
  });
  // Elige letra/imagen para una hoja: makeNodes(fs, imgH) devuelve el contenido completo de esa hoja (encabezado + minuta).
  async function fitMinutaPage(kit, data, makeNodes) {
    const pdfMake = window.pdfMake; if (!pdfMake) return [7, 0];
    const hasImg = data.some((d) => d.opts.some((o) => o.img));
    const fits = async (f, ih) => (await pdfPages(pdfMake, Object.assign(pdfDoc(kit, 't', 't', makeNodes(f, ih)), { pageOrientation: 'landscape' }))) === 1;
    for (const [ih, fonts] of MINUTA_FITS) {
      if (ih && !hasImg) continue;
      // búsqueda binaria: la letra más grande de este grupo que deja la minuta en una sola hoja
      let lo = 0, hi = fonts.length - 1, best = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (await fits(fonts[mid], ih)) { best = mid; hi = mid - 1; } else lo = mid + 1; }
      if (best >= 0) return [fonts[best], ih];
    }
    return [5, 0]; // minuta muy extensa: letra mínima; si aun así no cabe, continúa en otra hoja horizontal
  }

  const landRule = (w, c, mt, mb) => ({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: PDF_LAND_W, y2: 0, lineWidth: w, lineColor: c }], margin: [0, mt, 0, mb] });
  // Documento A4 con pie de página (texto a la izquierda, número de hoja a la derecha).
  const pdfDoc = (kit, title, footerText, content) => ({
    pageSize: 'A4', pageMargins: [36, 40, 36, 46],
    info: { title, author: 'PrepCoach' },
    footer: (cur, total) => ({ columns: [{ text: footerText, alignment: 'left' }, { text: `${cur} / ${total}`, alignment: 'right' }], fontSize: 7.5, color: '#888', margin: [36, 16, 36, 0] }),
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#111', lineHeight: 1.15 },
    styles: { eyebrow: { fontSize: 7, bold: true, color: kit.GOLD, characterSpacing: 0.5 }, h1: { fontSize: 21, bold: true }, h2: { fontSize: 14, bold: true }, h3: { fontSize: 10.5, bold: true }, meta: { fontSize: 8, color: '#333' }, sec: { fontSize: 10, bold: true, characterSpacing: 0.8 }, th: { fontSize: 7.5, bold: true } },
    content,
  });
  // Minuta de un solo tipo de día (la que descarga el cliente desde su portal).
  async function minutaPdfDef(a, dt, pm, imgOf) {
    const kit = pdfKit(), name = a.q.nombre || 'Atleta', t = dayTargets(a, dt), tot = dayTotals(dt), data = minutaGridData(kit, pm, imgOf);
    const head = () => [
      { columns: [{ width: '*', stack: [{ text: `MINUTA · ${kit.str(dt.name)}`.toUpperCase(), style: 'eyebrow', color: dayScheme(dt).ink }, { text: name, style: 'h1', margin: [0, 2, 0, 0] }] },
        { width: 'auto', text: `Objetivo: ${fmt(t.kcal)} kcal · P ${fmt(t.p)} g · C ${fmt(t.c)} g · G ${fmt(t.g)} g\nMenú (opciones principales): ${fmt(tot.kcal)} kcal · P ${fmt(tot.p)} · C ${fmt(tot.c)} · G ${fmt(tot.g)}`, style: 'meta', alignment: 'right', margin: [0, 10, 0, 0] }], columnGap: 12 },
      landRule(2.5, dayScheme(dt).c, 5, 8)];
    const [fs, ih] = await fitMinutaPage(kit, data, (f, h) => head().concat(pdfMinutaGrid(kit, dt, data, f, h)));
    return Object.assign(pdfDoc(kit, `Minuta ${dt.name} · ${name}`, `Minuta ${dt.name} · ${name}`, head().concat(pdfMinutaGrid(kit, dt, data, fs, ih))), { pageOrientation: 'landscape' });
  }
  // Mismo contenido y orden que la vista previa (planDocBody), descrito para pdfmake.
  async function planPdfDef(a, imgOf) {
    const kit = pdfKit(), { W, str, rule, dayHead, secTitle, lines, th, box, empty } = kit, name = a.q.nombre || 'Atleta';

    // 1 · Planificación de la etapa
    const pf = planifOf(a), objs = pf.objetivos.map((s) => str(s).trim()).filter(Boolean), dur = planifDuration(pf);
    const kv = (l, v, extra) => Object.assign({ stack: [{ text: l.toUpperCase(), style: 'eyebrow' }, { text: v, bold: true, fontSize: 10.5, margin: [0, 2, 0, 0] }], margin: [3, 3, 3, 3] }, extra || {});
    const row2 = [kv('Fecha de inicio', parseISO(pf.inicio) ? fmtDate(pf.inicio) : '—'), kv('Fecha de término', parseISO(pf.termino) ? fmtDate(pf.termino) : '—')].concat(dur ? [kv('Duración', dur)] : []);
    const planif = [
      { table: { widths: row2.map(() => '*'), body: [[kv('Objetivo de la etapa', str(pf.objetivo).trim() || '—', { colSpan: row2.length })].concat(row2.slice(1).map(() => ({}))), row2] }, layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#ddd', vLineColor: () => '#ddd' } },
      { text: 'Objetivos de la etapa', style: 'h3', margin: [0, 12, 0, 5] },
      objs.length ? { ol: objs.map((o) => ({ text: o, margin: [0, 0, 0, 4] })), margin: [4, 0, 0, 0], fontSize: 9.5 } : empty('Aún no se han definido objetivos para esta etapa.'),
    ];

    // 2 · Calendario de alimentación: los meses con días asignados, de a tres por fila
    const cd = calDocData(a);
    const calMonth = (ym) => ({ table: { widths: Array(7).fill('*'), body: [
        [{ text: cd.label(ym), colSpan: 7, bold: true, fontSize: 9, alignment: 'center', margin: [0, 1, 0, 2] }, {}, {}, {}, {}, {}, {}],
        DOW_L.map((l) => ({ text: l, fontSize: 6.5, bold: true, color: '#666', alignment: 'center' })),
      ].concat(cd.grid(ym).map((w) => w.map((d) => { if (!d) return { text: '' }; const dt = calType(a, d);
        return dt ? { text: [{ text: String(+d.slice(8)) }, { text: ' ' + dtInitial(dt), fontSize: 5.5, bold: true }], fillColor: dayScheme(dt).light, alignment: 'center' } : { text: String(+d.slice(8)), color: '#555', alignment: 'center' }; }))) },
      layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#ddd', vLineColor: () => '#ddd', paddingLeft: () => 1, paddingRight: () => 1, paddingTop: () => 2, paddingBottom: () => 2 }, fontSize: 7.5 });
    const calPdf = [];
    if (cd.months.length) {
      const used = a.dayTypes.filter((dt) => cd.counts[dt.id]);
      calPdf.push({ table: { widths: used.flatMap(() => [12, 'auto']), body: [used.flatMap((dt) => [{ text: dtInitial(dt), fillColor: dayScheme(dt).light, bold: true, fontSize: 7, alignment: 'center' }, { text: `${str(dt.name)} · ${cd.counts[dt.id]} ${cd.counts[dt.id] === 1 ? 'día' : 'días'}`, fontSize: 8.5, margin: [2, 0, 10, 0] }])] }, layout: 'noBorders', margin: [0, 0, 0, 10] });
      for (let i = 0; i < cd.months.length; i += 3) {
        const row = cd.months.slice(i, i + 3).map((ym) => Object.assign({ width: '*' }, calMonth(ym)));
        while (row.length < 3) row.push({ width: '*', text: '' });
        calPdf.push({ columns: row, columnGap: 12, margin: [0, 0, 0, 12], unbreakable: true });
      }
    } else calPdf.push(empty('Aún no se han asignado días en el calendario de alimentación del Menú diario.'));

    // 3 · Minuta ejemplo de cada tipo de día
    const minutas = [];
    for (let di = 0; di < a.dayTypes.length; di++) {
      const dt = a.dayTypes[di];
      const pm = minutaMeals(dt), t = dayTargets(a, dt), tot = dayTotals(dt);
      const hd = dayHead('Minuta ejemplo', dt.name, pm.length ? `Objetivo: ${fmt(t.kcal)} kcal · P ${fmt(t.p)} g · C ${fmt(t.c)} g · G ${fmt(t.g)} g\nMenú (opciones principales): ${fmt(tot.kcal)} kcal · P ${fmt(tot.p)} · C ${fmt(tot.c)} · G ${fmt(tot.g)}` : '');
      // Cada minuta ocupa su propia hoja horizontal (la primera comparte hoja con el título de la sección).
      if (di) { hd[0].pageBreak = 'before'; hd[0].pageOrientation = 'landscape'; }
      const dsc = dayScheme(dt); hd[0].columns[0].stack[0].color = dsc.ink; hd[1] = landRule(2.5, dsc.c, 5, 8);
      minutas.push(...hd);
      if (!pm.length) { minutas.push(empty('Este tipo de día aún no tiene opciones con alimentos en el Menú diario.')); continue; }
      const data = minutaGridData(kit, pm, imgOf);
      // Para medir, la hoja se arma igual que en el documento (la primera minuta lleva además el título de la sección).
      const testHead = () => { const h = dayHead('Minuta ejemplo', dt.name, hd[0].columns[1].text); h[0].columns[0].stack[0].color = dsc.ink; h[1] = landRule(2.5, dsc.c, 5, 8); if (di) return h; const st = secTitle(3, 'Minuta ejemplo', true); delete st.pageBreak; return [st].concat(h); };
      const [fs, ih] = await fitMinutaPage(kit, data, (f, h) => testHead().concat(pdfMinutaGrid(kit, dt, data, f, h)));
      minutas.push(...pdfMinutaGrid(kit, dt, data, fs, ih));
    }

    // 4 · Distribución de las comidas
    const dist = [];
    a.dayTypes.forEach((dt) => {
      const t = dayTargets(a, dt);
      dist.push({ unbreakable: dt.meals.length <= 12, margin: [0, 0, 0, 16], stack: dayHead('Distribución de comidas', dt.name, t.ok ? `Objetivo del día: ${fmt(t.kcal)} kcal\nProteínas ${fmt(t.p)} g · Carbohidratos ${fmt(t.c)} g · Grasas ${fmt(t.g)} g` : '').concat(dt.meals.length
        ? [{ table: { headerRows: 1, widths: [16, 150, 38, '*'], body: [[th('#'), th('Comida'), th('Hora'), th('Indicaciones')]].concat(dt.meals.map((m, i) => [{ text: pad(i + 1), color: '#666' }, { text: str(m.name) || `Comida ${i + 1}`, bold: true }, str(m.time) || '—', str(m.indic).trim() ? str(m.indic).trim() : { text: '—', color: '#999' }])) }, layout: Object.assign({}, lines, { paddingTop: () => 4, paddingBottom: () => 4 }), fontSize: 8.5 }]
        : [empty('Este tipo de día aún no tiene comidas.')]) });
    });
    const noteOf = (k) => str((a.distNotes && a.distNotes[k] != null) ? a.distNotes[k] : DIST_NOTES[k]).trim();
    [['org', 'Cómo organizarte'], ['tip', 'Tip']].filter(([k]) => noteOf(k)).forEach(([k, l]) => dist.push(Object.assign(box({ text: [{ text: l + '. ', bold: true }, noteOf(k)], fontSize: 8.5 }, 0), { margin: [0, 0, 0, 6], unbreakable: true })));

    // 5 · Resumen del seguimiento semanal
    const cw = currentWeek(a), cfg = cfgOf(a), ks = Array.from({ length: cw + 1 }, (_, k) => k);
    const withAvg = ks.filter((k) => weekAvg(a, k) != null), any = withAvg.some((k) => weekWeights(a, k).length) || ks.some((k) => weekSteps(a, k) != null || SCALES.some(([f]) => weekField(a, k, f).avg != null));
    const p0 = weekAvg(a, 0), kLast = withAvg.length ? withAvg[withAvg.length - 1] : null, pL = kLast != null ? weekAvg(a, kLast) : null;
    const PILL = { ok: ['#17663f', '#e0f3e8'], warn: ['#8a5200', '#fdefd6'], bad: ['#a12626', '#fbe2e2'], none: ['#555', '#eeeeee'] };
    const r = (t) => ({ text: t, alignment: 'right' });
    const stat = (l, v) => [{ text: l + ': ' }, { text: v + '      ', bold: true }];
    const seg = any ? [
      { text: [].concat(stat('Inicio', fmtDate(cfg.inicio)), stat('Semana actual', `${cw} de ${weekCount(a)}`), p0 != null ? stat('Peso inicial', `${fmt(p0, 2)} kg`) : [], pL != null && kLast > 0 ? stat(`Último promedio (${weekLabel(kLast).toLowerCase()})`, `${fmt(pL, 2)} kg`) : [], p0 && pL != null && kLast > 0 ? stat('Cambio total', `${fmtS(pL - p0, 2)} kg (${fmtS(((pL - p0) / p0) * 100, 1)}%)`) : []), fontSize: 8.5, margin: [0, 0, 0, 8] },
      { table: { headerRows: 1, widths: [38, 22, '*', 28, 34, 34, 46, 26, 40, 24, 24, 34, 32],
        body: [[th('Semana'), th('Inicio'), th('Etapa'), th('Peso (kg)', 'right'), th('% buscado', 'right'), th('% logrado', 'right'), th('Estado', 'center'), th('Pasos', 'right')].concat(SCALES.map(([, l]) => th(l, 'right')))].concat(ks.map((k) => {
          const avg = weekAvg(a, k), b = buscado(a, k), l = logrado(a, k), st = status(a, k), steps = weekSteps(a, k), pc = PILL[st.key] || PILL.none;
          return [{ text: k === 0 ? 'Inicial' : weekLabel(k), bold: true }, fmtDate(weekStart(a, k), true), str(weekEtapa(a, k)), r(avg != null ? fmt(avg, 2) : '—'), r(b != null ? fmtS(b) + '%' : '—'), r(l != null ? fmtS(l) + '%' : '—'),
            { text: st.label, bold: true, color: pc[0], fillColor: pc[1], alignment: 'center' }, r(steps != null ? fmt(steps) : '—')].concat(SCALES.map(([f]) => { const v = weekField(a, k, f).avg; return r(v != null ? fmt(v, 1) : '—'); }));
        })) }, layout: Object.assign({}, lines, { paddingLeft: () => 3, paddingRight: () => 3 }), fontSize: 7.5 },
      { text: 'Peso: promedio de los días registrados en la semana. Escalas (0-5): promedio de los días anotados; en Estrés el valor alto es el desfavorable.', fontSize: 7.5, color: '#666', margin: [0, 7, 0, 0] },
    ] : [empty('Aún no hay registros de seguimiento.')];

    return pdfDoc(kit, `Planificación · ${name}`, `Planificación nutricional · ${name}`, [].concat(
        [{ columns: [{ width: '*', stack: [{ text: 'PLANIFICACIÓN NUTRICIONAL', style: 'eyebrow' }, { text: name, style: 'h1', margin: [0, 2, 0, 0] }] }, { width: 'auto', text: `Generada el ${fmtDate(todayISO())}\n${a.dayTypes.map((d) => str(d.name)).join(' · ')}`, style: 'meta', alignment: 'right', margin: [0, 10, 0, 0] }], columnGap: 12 }, rule(2, '#111', 6, 0)],
        [secTitle(1, 'Planificación', false)], planif,
        [secTitle(2, 'Calendario de alimentación', true)], calPdf,
        [Object.assign(secTitle(3, 'Minuta ejemplo', true), { pageOrientation: 'landscape' })], minutas,
        [Object.assign(secTitle(4, 'Distribución de las comidas', true), { pageOrientation: 'portrait' })], dist,
        [secTitle(5, 'Resumen del seguimiento semanal', true)], seg
    ));
  }
  // Genera un PDF y lo entrega. Si no se puede generar (sin conexión o generador bloqueado), entrega la versión HTML con fallback().
  async function savePdf({ base, images, build, okMsg, failMsg, fallback }) {
    const dl = MODE === 'sync';
    if (dl && !cdownloads) { toast('En esta vista no se pueden descargar archivos.'); return; }
    if (T.pdfBusy) return;
    T.pdfBusy = true; render();
    let blob = null;
    try {
      const pdfMake = await loadPdfLib(), imgs = new Map();
      for (const v of images) if (v && !imgs.has(v)) imgs.set(v, await pdfImage(v));
      blob = await pdfBlob(pdfMake, await build((v) => imgs.get(v)));
    } catch (e) { console.error('PDF', e); }
    T.pdfBusy = false; render();
    if (!blob) { toast('No se pudo generar el PDF. Se entrega en HTML: ábrelo e imprímelo como PDF.'); await fallback(); return; }
    if (dl) {
      try { await cdownloads.save({ filename: `${base}.pdf`, data: blob }); toast(okMsg); }
      catch (e) { if (e && e.code !== 'declined') toast(failMsg); }
      return;
    }
    // Fuera del Artifact (uso local): descarga directa del navegador.
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${base}.pdf`; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast(okMsg);
  }
  const htmlImages = async (images) => { const m = new Map(); for (const v of images) if (v && !m.has(v)) m.set(v, MODE === 'sync' ? await inlineImage(v) : imgSrc(v)); return m; };
  async function printPlan() {
    const a = A(), base = `planificacion-${slug(a.q.nombre || 'atleta')}`;
    const images = a.dayTypes.flatMap((dt) => minutaMeals(dt).flatMap(({ opts }) => opts.map((o) => o.image))).filter(Boolean);
    await savePdf({ base, images, build: (imgOf) => planPdfDef(a, imgOf), okMsg: 'Planificación descargada en PDF.', failMsg: 'No se pudo descargar la planificación.',
      fallback: async () => { const imgs = await htmlImages(images); await deliverDoc({ body: planDocBody(a, (v) => imgs.get(v)), title: `Planificación · ${a.q.nombre || ''}`, fname: `${base}.html`, what: 'Planificación descargada', fail: 'No se pudo descargar la planificación.' }); } });
  }

  // =====================================================================
  // Modales y avisos
  // =====================================================================
  let modalCb = null;
  function openModal(html, cb = null, wide = false) {
    modalCb = cb;
    $('#modal-root').innerHTML = `<div class="modal-back" data-action="closeModalBack"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`;
    const f = $('#modal-root input'); if (f) f.focus();
  }
  function closeModal() { $('#modal-root').innerHTML = ''; modalCb = null; }
  // Diálogo «Apariencia»: modo (oscuro / claro) y paleta del modo claro (Coral / Pizarra).
  function themeModalHtml() {
    const light = THEME.mode === 'light';
    const prev = (p) => `<span class="tp-prev" aria-hidden="true" style="--p-bg:${p.bg};--p-card:${p.card};--p-acc:${p.acc};--p-ink:${p.ink};--p-btn:${p.btn}"><span class="tp-card"><span class="tp-line"></span><span class="tp-bars"><i></i><i></i><i></i><i></i><i></i></span></span><span class="tp-pill"></span><span class="tp-pill"></span></span>`;
    const opt = (attrs, on, p, icon, name, desc) => `<button type="button" class="theme-opt" role="radio" aria-checked="${on}" ${attrs}>${prev(p)}
      <span class="to-name">${icon ? ic(icon, 14) : ''}${name}<span class="to-check">${ic('check', 14)}</span></span><span class="to-desc">${desc}</span></button>`;
    return `<div class="modal-head"><h3>Apariencia</h3><div class="muted small">Solo cambian los colores. Se guarda en este navegador.</div></div>
      <div class="modal-body">
        <div class="theme-sec"><span class="label" id="tm-l">Modo</span>
          <div class="theme-opts" role="radiogroup" aria-labelledby="tm-l">
            ${opt('data-action="setThemeMode" data-mode="dark"', !light, DARK_PREV, 'moon', 'Oscuro', 'Fondo oscuro con dorado')}
            ${opt('data-action="setThemeMode" data-mode="light"', light, PALETTES[THEME.palette].prev, 'sun', 'Claro', `Paleta ${PALETTES[THEME.palette].name}`)}
          </div></div>
        <div class="theme-sec${light ? '' : ' is-off'}"><span class="label" id="tp-l">Paleta del modo claro</span>
          <div class="theme-opts" role="radiogroup" aria-labelledby="tp-l">
            ${Object.entries(PALETTES).map(([k, p]) => opt(`data-action="setThemePalette" data-palette="${k}"`, light && THEME.palette === k, p.prev, '', p.name, p.desc)).join('')}
          </div>
          <div class="hint">${light ? 'Puedes cambiar de paleta cuando quieras.' : 'Al elegir una paleta se activa el modo claro.'}</div></div>
      </div>
      <div class="modal-foot"><button class="btn primary" data-action="closeModal">Listo</button></div>`;
  }
  function refreshThemeModal(focusSel) {
    renderHeader();
    const m = $('#modal-root .modal'); if (!m) return;
    m.innerHTML = themeModalHtml();
    m.querySelector(`.theme-opt${focusSel}`)?.focus();
  }
  function confirmModal(title, text, onOk, okLabel = 'Eliminar') {
    openModal(`<div class="modal-head"><h3>${title}</h3></div><div class="modal-body"><div class="muted">${text}</div></div>
      <div class="modal-foot"><button class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn primary" data-action="modalOk">${okLabel}</button></div>`, onOk);
  }
  function promptModal(title, fields, onOk, okLabel = 'Guardar') {
    openModal(`<div class="modal-head"><h3>${title}</h3></div><div class="modal-body">${fields}</div>
      <div class="modal-foot"><button class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn primary" data-action="modalOk">${okLabel}</button></div>`, onOk);
  }
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // =====================================================================
  // Imágenes
  // =====================================================================
  let pendingImg = null;
  // Selector de imagen: un <label> con un input de archivo real dentro. Tocar el recuadro abre el selector de forma nativa,
  // lo que funciona también en el teléfono y dentro de la app (donde un clic programado sobre un input oculto puede bloquearse).
  const filePick = (path, push, cls, inner, attrs = '') => `<label class="${cls} file-pick" ${attrs}><input type="file" accept="image/*" class="file-pick-in" data-img-path="${path}"${push ? ' data-img-push' : ''} aria-label="Elegir imagen">${inner}</label>`;
  async function handleImageFile(file, target) {
    if (!file || !target) return;
    try {
      toast('Subiendo imagen…');
      const data = await storeImage(await compressImage(file));
      if (target.push) { const arr = getP(target.path) || []; arr.push(data); setP(target.path, arr); } else setP(target.path, data);
      commit(); toast('Imagen agregada.');
    } catch (e) {
      const c = e && e.code;
      toast(c === 'no_assets' || c === 'not_granted' ? 'En esta vista no se pueden subir imágenes.' : c === 'quota_or_state' ? 'El almacenamiento de imágenes está lleno.' : c === 'too_large' ? 'La imagen es demasiado grande.' : 'No se pudo cargar la imagen. Intenta con otro archivo JPG o PNG.');
    }
  }
  // Alternativas al selector: arrastrar una imagen sobre el recuadro o pegarla (Ctrl/Cmd+V) con el recuadro seleccionado.
  const pickTarget = (lbl) => { const i = lbl && lbl.querySelector('.file-pick-in'); return i ? { path: i.dataset.imgPath, push: i.hasAttribute('data-img-push') } : null; };
  document.addEventListener('dragover', (ev) => { const l = ev.target.closest && ev.target.closest('.file-pick'); if (!l) return; ev.preventDefault(); l.classList.add('drag-over'); });
  document.addEventListener('dragleave', (ev) => { const l = ev.target.closest && ev.target.closest('.file-pick'); if (l) l.classList.remove('drag-over'); });
  document.addEventListener('drop', (ev) => {
    const l = ev.target.closest && ev.target.closest('.file-pick'); if (!l) return;
    ev.preventDefault(); l.classList.remove('drag-over');
    const f = [...(ev.dataTransfer && ev.dataTransfer.files || [])].find((x) => /^image\//.test(x.type));
    if (f) handleImageFile(f, pickTarget(l)); else toast('Arrastra un archivo de imagen (JPG o PNG).');
  });
  document.addEventListener('paste', (ev) => {
    const l = document.activeElement && document.activeElement.closest && document.activeElement.closest('.file-pick'); if (!l) return;
    const it = [...(ev.clipboardData && ev.clipboardData.items || [])].find((x) => x.kind === 'file' && /^image\//.test(x.type));
    if (it) { ev.preventDefault(); handleImageFile(it.getAsFile(), pickTarget(l)); }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('file-pick-in')) return;
    const file = el.files && el.files[0], target = { path: el.dataset.imgPath, push: el.hasAttribute('data-img-push') };
    el.value = '';
    handleImageFile(file, target);
  });
  function compressImage(file, max = 1400, q = 0.82) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const s = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob((b) => (b ? res(b) : rej(new Error('canvas'))), 'image/jpeg', q);
        };
        img.onerror = rej; img.src = fr.result;
      };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  const blobToDataURL = (b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
  // En modo sincronizado la imagen se sube al almacenamiento del Artifact y se guarda su id.
  async function storeImage(blob) {
    if (MODE !== 'sync') return blobToDataURL(blob);
    if (!cassets) throw { code: 'no_assets' };
    return (await cassets.upload(blob, { type: 'image/jpeg' })).id;
  }
  const imgSrc = (v) => (!v ? '' : String(v).startsWith('data:') ? v : '/_blob/' + v);

  // =====================================================================
  // Acciones
  // =====================================================================
  const dtIndex = () => A().dayTypes.indexOf(activeDay(A()));
  let copyCtx = null;
  // Portapapeles interno del menú: una opción completa o un alimento suelto, para pegarlo en cualquier comida.
  let clip = null; // { kind: 'opt' | 'food', data, label, from }
  function mealOptions(dt, name) {
    const k = String(name || '').trim().toLowerCase(), hit = dt.meals.find((m) => m.name.trim().toLowerCase() === k);
    return dt.meals.map((m, i) => `<option value="${m.id}" ${hit && m.id === hit.id ? 'selected' : ''}>${pad(i + 1)} · ${esc(m.name)}${m.time ? ' · ' + esc(m.time) : ''}</option>`).join('')
      + `<option value="__new" ${hit ? '' : 'selected'}>➕ Nueva comida: ${esc(name)}</option>`;
  }
  const commit = () => { save(); render(); };

  const actions = {
    newAthlete() {
      promptModal('Nuevo atleta', F('Nombre y apellido', '<input class="input" id="m-name" placeholder="Ej.: Sebastián Muñoz">'), () => {
        const n = $('#m-name').value.trim() || 'Nuevo atleta';
        const at = newAthlete(n); S.athletes.push(at); S.activeId = at.id; closeModal(); save(); go('cuestionario');
      }, 'Crear');
    },
    switchAthlete(el) { S.activeId = el.dataset.id; closeModal(); commit(); },
    manageAthletes() { openModal(athletesModal(), null, true); },
    logout() { logout(); },
    togglePass(el) {
      const inp = $('#login-pass'); if (!inp) return;
      const show = inp.type === 'password'; inp.type = show ? 'text' : 'password';
      el.setAttribute('aria-pressed', String(show)); el.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      el.innerHTML = ic(show ? 'eyeOff' : 'eye', 16); inp.focus();
    },
    dupAthlete(el) {
      const src = S.athletes.find((x) => x.id === el.dataset.id); const c = clone(src);
      c.id = uid(); c.q.nombre = (c.q.nombre || 'Atleta') + ' (copia)'; c.tracking.daily = {}; c.tracking.weeks = {}; c.createdAt = todayISO();
      c.portal = newPortal(); // la copia no hereda el acceso del cliente original
      S.athletes.push(c); S.activeId = c.id; closeModal(); toast('Plan duplicado (sin seguimiento).'); commit();
    },
    delAthlete(el) {
      const x = S.athletes.find((a) => a.id === el.dataset.id);
      confirmModal('Eliminar atleta', `Se eliminará <b>${esc(x.q.nombre || 'Sin nombre')}</b> con su cuestionario, planificación y seguimiento. Esta acción no se puede deshacer.`, () => {
        S.athletes = S.athletes.filter((a) => a.id !== x.id);
        if (S.activeId === x.id) S.activeId = S.athletes[0]?.id || null;
        closeModal(); commit();
      });
    },
    async exportJSON() {
      const fname = `prepcoach-respaldo-${todayISO()}.json`;
      if (MODE === 'sync' || cdownloads) {
        if (!cdownloads) { toast('En esta vista no se pueden descargar archivos.'); return; }
        try { await cdownloads.save({ filename: fname, data: JSON.stringify(S) }); toast('Respaldo descargado.'); }
        catch (e) { if (e && e.code !== 'declined') toast('No se pudo descargar el respaldo.'); }
        return;
      }
      const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const l = document.createElement('a');
      l.href = url; l.download = fname; l.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    importJSON() { $('#json-input').click(); },
    goQ(el, ev) { ev.preventDefault(); if (route()[0] !== 'cuestionario') go('cuestionario'); setTimeout(() => document.getElementById(el.dataset.id)?.scrollIntoView({ behavior: 'smooth' }), 60); },
    print() { window.print(); },
    addSup() { A().q.suplementos.push({ cual: '', dia: '', horario: '', cantidad: '', marca: '' }); commit(); },
    delSup(el) { A().q.suplementos.splice(+el.dataset.i, 1); commit(); },

    setEq(el, ev) { if (ev.target.closest('input')) return; A().req.ecuacion = el.dataset.id; commit(); },
    setFactor(el) { A().req.factor = parseFloat(el.dataset.v); commit(); },
    setObj(el) { A().req.objetivo = el.dataset.v; commit(); },
    setVolUnit(el) { const r = A().req; if (r.volUnit === el.dataset.v) return; const p = num(r.pctVol); const k = 30.44 / 7; if (p != null) r.pctVol = Math.round((el.dataset.v === 'sem' ? p / k : p * k) * 1000) / 1000; r.volUnit = el.dataset.v; commit(); },
    useQ() {
      const a = A(), q = a.q, r = a.req;
      r.peso = num(q.peso); r.altura = num(q.altura) != null && num(q.altura) < 3 ? num(q.altura) * 100 : num(q.altura); r.edad = num(q.edad); r.sexo = q.sexo || ''; r.grasa = num(q.grasa); r.pasos = stepsFromQ(a);
      toast('Datos copiados desde el cuestionario.'); commit();
    },

    setDay(el) { A().activeDay = el.dataset.id; commit(); },
    // Calendario de alimentación (Menú diario)
    fcMonth(el) { T.fcMonth = fcShift(fcMonth(), +el.dataset.d || 0); render(); },
    fcToday() { T.fcMonth = null; render(); },
    fcBrush(el) { T.fcBrush = el.dataset.id; render(); },
    fcFold() { fcFolded = !fcFolded; lsSet('prepcoach-calfold', fcFolded ? '1' : '0'); render(); },
    fcFill() {
      const a = A(), cal = calOf(a), { train, rest } = trainRest(a);
      const st = stagesOf(a).filter((s) => stageDated(s) && (s.diasEntreno || []).length);
      if (!st.length) { toast('Primero marca los días de entrenamiento de la etapa en Seguimiento › Configuración.'); return; }
      let n = 0;
      st.forEach((s) => { for (let d = s.inicio; d <= s.fin; d = addDays(d, 1)) if (!calType(a, d)) { cal[d] = s.diasEntreno.includes(dow(d)) ? train.id : rest.id; n++; } });
      toast(n ? `${n} ${n === 1 ? 'día asignado' : 'días asignados'} según los días de entrenamiento de las etapas.` : 'No había días sin asignar dentro de las etapas.');
      commit();
    },
    fcClear() {
      const a = A(), ym = fcMonth(), cal = calOf(a), ks = Object.keys(cal).filter((d) => d.startsWith(`${ym}-`)), mn = `${CAL_M[+ym.slice(5) - 1].toLowerCase()} de ${ym.slice(0, 4)}`;
      confirmModal('Vaciar mes', `Se quitará el tipo de día de los <b>${ks.length}</b> días asignados en ${mn}. Los demás meses no cambian.`, () => { ks.forEach((d) => { delete cal[d]; }); closeModal(); commit(); }, 'Vaciar');
    },
    addDayType() {
      promptModal('Nuevo tipo de día', `${F('Nombre', '<input class="input" id="m-name" placeholder="Ej.: Recarga, Día alto, Competencia">')}
        ${F('Copiar comidas desde', `<select class="select" id="m-copy"><option value="">Comidas por defecto</option>${A().dayTypes.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>`)}`, () => {
        const a = A(); const n = $('#m-name').value.trim() || 'Nuevo día'; const from = a.dayTypes.find((d) => d.id === $('#m-copy').value);
        const dt = from ? Object.assign(clone(from), { id: uid(), name: n }) : newDayType(n, '', 0, trainMeals());
        dt.color = DAY_COLORS[a.dayTypes.length % DAY_COLORS.length];
        if (from) dt.meals.forEach((m) => { m.id = uid(); m.options.forEach((o) => { o.id = uid(); }); });
        a.dayTypes.push(dt); a.activeDay = dt.id; closeModal(); commit();
      }, 'Crear');
    },
    editDayType(el) {
      const dt = A().dayTypes.find((d) => d.id === el.dataset.id);
      promptModal('Editar tipo de día', `${F('Nombre', `<input class="input" id="m-name" value="${esc(dt.name)}">`)}
        ${F('Color', `<div class="chips">${DAY_COLORS.map((c) => `<label class="chip"><input type="radio" name="m-color" value="${c}" ${c === dt.color ? 'checked' : ''}><span class="color-dot" style="background:${c}"></span></label>`).join('')}</div>`)}`, () => {
        dt.name = $('#m-name').value.trim() || dt.name; dt.color = ($('input[name="m-color"]:checked') || {}).value || dt.color; closeModal(); commit();
      });
    },
    dupDayType(el) {
      const a = A(); const src = a.dayTypes.find((d) => d.id === el.dataset.id); const c = clone(src);
      c.id = uid(); c.name = src.name + ' (copia)'; c.color = DAY_COLORS[a.dayTypes.length % DAY_COLORS.length];
      c.meals.forEach((m) => { m.id = uid(); m.options.forEach((o) => { o.id = uid(); }); });
      a.dayTypes.push(c); a.activeDay = c.id; commit();
    },
    delDayType(el) {
      const a = A(); const dt = a.dayTypes.find((d) => d.id === el.dataset.id);
      confirmModal('Eliminar tipo de día', `Se eliminará <b>${esc(dt.name)}</b> con sus comidas y menú.`, () => {
        a.dayTypes = a.dayTypes.filter((d) => d.id !== dt.id); a.activeDay = a.dayTypes[0].id;
        const cal = calOf(a); Object.keys(cal).forEach((d) => { if (cal[d] === dt.id) delete cal[d]; });
        closeModal(); commit();
      });
    },
    addMeal() {
      const a = A(), dt = activeDay(a); dt.meals.push(newMeal(`Comida ${dt.meals.length + 1}`, '', 0)); commit();
      // En «Distribución de comidas» la comida nueva queda al final de la lista: se lleva la vista hasta ella, con el nombre listo para escribir.
      if (curRoute.startsWith('plan/dist')) setTimeout(() => { const el = $(`[data-bind="dayTypes.${a.dayTypes.indexOf(dt)}.meals.${dt.meals.length - 1}.name"]`); el?.scrollIntoView({ block: 'center' }); el?.focus({ preventScroll: true }); el?.select(); }, 0);
    },
    // «Traer nombre del menú»: el nombre de la comida pasa a ser la descripción de su opción principal en el Menú diario.
    nameFromMenu(el) {
      const m = activeDay(A()).meals[+el.dataset.i], t = m && mealMenuName(m);
      if (!t) { toast('Esta comida aún no tiene descripción en el Menú diario.'); return; }
      m.name = t; commit(); toast(`Nombre traído del menú: «${t}».`);
    },
    // Desde la imagen de una comida en «Distribución»: abre esa comida en el Menú diario (ahí se agrega o cambia la imagen).
    openMealInMenu(el) {
      const id = el.dataset.id; collapsed.delete(id); saveCollapsed(); go('plan/menu');
      setTimeout(() => document.getElementById('meal-' + id)?.scrollIntoView({ block: 'start' }), 60);
    },
    delMeal(el) {
      const dt = activeDay(A()); const m = dt.meals[+el.dataset.i];
      confirmModal('Eliminar comida', `Se eliminará <b>${esc(m.name)}</b> y todas sus opciones de menú.`, () => { dt.meals.splice(+el.dataset.i, 1); closeModal(); commit(); });
    },
    moveMeal(el) {
      const dt = activeDay(A()); const i = +el.dataset.i, j = i + +el.dataset.d;
      if (j < 0 || j >= dt.meals.length) return; [dt.meals[i], dt.meals[j]] = [dt.meals[j], dt.meals[i]]; commit();
    },

    copyTo(el) {
      const a = A(), from = activeDay(a), src = getP(el.dataset.m), k = +el.dataset.k;
      const def = a.dayTypes.find((d) => d.id !== from.id) || from;
      copyCtx = { src, k };
      promptModal('Copiar a otro tipo de día', `
        <div class="callout small">La copia queda <b>independiente</b>: lo que cambies después en una no afecta a la otra.</div>
        ${F('Qué copiar', `<select class="select" id="m-what"><option value="opt">Solo la opción ${esc(String(k + 1))}${src.options[k].title ? ' · ' + esc(src.options[k].title.slice(0, 40)) : ''}</option><option value="all">La comida completa (${src.options.length} ${src.options.length === 1 ? 'opción' : 'opciones'})</option></select>`)}
        ${F('Tipo de día de destino', `<select class="select" id="m-day">${a.dayTypes.map((d) => `<option value="${d.id}" ${d.id === def.id ? 'selected' : ''}>${esc(d.name)}${d.id === from.id ? ' (este mismo día)' : ''}</option>`).join('')}</select>`)}
        ${F('Comida de destino', `<select class="select" id="m-meal">${mealOptions(def, src.name)}</select>`, 'Se agrega como opción nueva de esa comida. Si la comida está vacía, la copia ocupa su lugar.')}`, () => {
        const dest = a.dayTypes.find((d) => d.id === $('#m-day').value), mid = $('#m-meal').value;
        const opts = ($('#m-what').value === 'all' ? src.options : [src.options[k]]).map((o) => Object.assign(clone(o), { id: uid() }));
        let target;
        if (mid === '__new') {
          target = Object.assign(newMeal(src.name, src.time, 0), { pP: src.pP, pC: src.pC, pG: src.pG, options: opts, sel: 0, active: 0 });
          dest.meals.push(target);
        } else {
          target = dest.meals.find((m) => m.id === mid);
          const o0 = target.options[0], empty = target.options.length === 1 && !o0.title && !o0.image && !o0.foods.length && !o0.notes;
          if (empty) { target.options = opts; target.sel = 0; target.active = 0; } else { target.active = target.options.length; target.options.push(...opts); }
          collapsed.delete(target.id); saveCollapsed();
        }
        copyCtx = null; closeModal(); commit();
        toast(`Copiado a ${dest.name} · ${target.name}${mid === '__new' ? '. Ajusta sus porcentajes en Distribución.' : ''}`);
      }, 'Copiar');
    },
    // Objetivos de la etapa (pestaña Planificación)
    // Planificación ↔ etapas de Configuración
    planifUseStage() { const a = A(), p = planifOf(a), m = planifStage(a); if (!m) return; p.inicio = m.s.inicio; p.termino = m.s.fin; toast('Fechas tomadas de Seguimiento › Configuración.'); commit(); },
    planifToStage() { const a = A(), p = planifOf(a), m = planifStage(a); if (!m) return; m.s.inicio = p.inicio; m.s.fin = p.termino; toast(`Etapa ${m.i + 1} de Configuración actualizada.`); commit(); },
    planifAddStage() { const a = A(), p = planifOf(a); stagesOf(a).push(newStage(p.objetivo, { inicio: parseISO(p.inicio) ? p.inicio : '', fin: parseISO(p.termino) ? p.termino : '' })); toast(`Etapa «${p.objetivo}» agregada en Seguimiento › Configuración.`); commit(); },
    // Etapas del proceso (Seguimiento › Configuración)
    addStage(el) {
      const st = stagesOf(A()), ends = st.filter(stageDated).map((x) => x.fin).sort();
      const s = newStage(el.dataset.tipo || '', { inicio: ends.length ? addDays(ends[ends.length - 1], 1) : '' });
      st.push(s); commit();
      setTimeout(() => document.getElementById(`stage-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    },
    delStage(el) {
      const st = stagesOf(A()), i = +el.dataset.i, x = st[i]; if (!x) return;
      confirmModal('Eliminar etapa', `Se eliminará la etapa <b>${i + 1} · ${esc(x.tipo || 'sin objetivo')}</b> con su configuración. Los pesajes y registros del seguimiento no se borran.`, () => {
        st.splice(i, 1); closeModal(); commit();
      }, 'Eliminar');
    },
    toggleStageDay(el) {
      const s = stagesOf(A())[+el.dataset.i]; if (!s) return;
      const f = el.dataset.f, d = +el.dataset.d, arr = Array.isArray(s[f]) ? s[f] : [];
      s[f] = arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d].sort((x, y) => x - y); commit();
    },
    toggleStageVar(el) {
      const s = stagesOf(A())[+el.dataset.i]; if (!s) return;
      const ch = stageChartCfg(s), v = el.dataset.v;
      ch.vars = ch.vars.includes(v) ? ch.vars.filter((x) => x !== v) : [...ch.vars, v]; commit();
    },
    setStageMode(el) { const s = stagesOf(A())[+el.dataset.i]; if (!s) return; stageChartCfg(s).modo = el.dataset.v === 'dia' ? 'dia' : 'semana'; commit(); },
    resetEtapa(el) { const w = A().tracking.weeks[el.dataset.k]; if (w) delete w.etapa; commit(); },
    applyStageDates() {
      const a = A(), mm = mismatchWeeks(a);
      mm.forEach((x) => { delete a.tracking.weeks[x.k].etapa; });
      toast(`${mm.length} ${mm.length === 1 ? 'semana vuelve' : 'semanas vuelven'} a la etapa de Configuración.`); commit();
    },
    addObjetivo() {
      const p = planifOf(A()); p.objetivos.push(''); commit();
      setTimeout(() => { const el = $(`[data-bind="planif.objetivos.${p.objetivos.length - 1}"]`); el?.scrollIntoView({ block: 'center' }); el?.focus({ preventScroll: true }); }, 0);
    },
    delObjetivo(el) {
      const p = planifOf(A()), i = +el.dataset.i, txt = String(p.objetivos[i] || '').trim();
      const del = () => { p.objetivos.splice(i, 1); closeModal(); commit(); };
      if (!txt) { del(); return; }
      confirmModal('Eliminar objetivo', `Se eliminará el objetivo ${i + 1}: «${esc(txt.length > 90 ? txt.slice(0, 90) + '…' : txt)}».`, del);
    },
    openCal(el) {
      const path = el.dataset.calPath, d = parseISO(getP(path)) || new Date();
      CAL = { path, y: d.getFullYear(), m: d.getMonth(), anchor: el }; calDraw();
      setTimeout(() => document.querySelector('#cal-pop .cal-d.sel, #cal-pop .cal-d.today')?.focus(), 0);
    },
    calNav(el) { if (!CAL) return; const d = new Date(CAL.y, CAL.m + +el.dataset.d, 1); CAL.y = d.getFullYear(); CAL.m = d.getMonth(); calDraw(); },
    calPick(el) { if (!CAL) return; setP(CAL.path, el.dataset.v || ''); CAL = null; calDraw(); commit(); },
    calClose() { CAL = null; calDraw(); },
    toggleMeal(el, ev) { if (ev && ev.target && ev.target.closest && ev.target.closest('input, textarea, select')) return; const id = el.dataset.id; collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); saveCollapsed(); render(); },
    collapseAll() { activeDay(A()).meals.forEach((m) => collapsed.add(m.id)); saveCollapsed(); render(); },
    expandAll() { activeDay(A()).meals.forEach((m) => collapsed.delete(m.id)); saveCollapsed(); render(); },
    viewOpt(el) { getP(el.dataset.m).active = +el.dataset.k; commit(); },
    addOpt(el) { const m = getP(el.dataset.m); m.options.push(newOption()); m.active = m.options.length - 1; commit(); },
    copyOpt(el) {
      const dt = activeDay(A()), m = getP(el.dataset.m), k = +el.dataset.k, o = m.options[k];
      const n = dt.meals.indexOf(m) + 1;
      clip = { kind: 'opt', data: clone(o), srcId: o.id, label: o.title ? o.title.slice(0, 50) : `Opción ${n}.${k + 1} · ${o.foods.length} ${o.foods.length === 1 ? 'alimento' : 'alimentos'}`, from: `${dt.name} · ${m.name}` };
      render(); toast('Opción copiada. Pulsa «Pegar opción» en la comida donde la quieras.');
    },
    copyLine(el) {
      const dt = activeDay(A()), o = getP(el.dataset.p), l = o.foods[+el.dataset.i], m = dt.meals.find((x) => x.options.includes(o));
      const f = l.foodId ? S.foods.find((x) => x.id === l.foodId) : null;
      clip = { kind: 'food', data: l, copy: clone(l), label: `${f ? f.name : l.foodName || 'Alimento'}${l.cantidad ? ' · ' + l.cantidad : ''}`, from: `${dt.name} · ${m ? m.name : ''}` };
      render(); toast('Alimento copiado. Pulsa «Pegar alimento» en la comida donde lo quieras.');
    },
    pasteClip(el) {
      if (!clip) return;
      const m = getP(el.dataset.m);
      if (clip.kind === 'opt') {
        const c = Object.assign(clone(clip.data), { id: uid() });
        const o0 = m.options[0], empty = m.options.length === 1 && !o0.title && !o0.image && !o0.foods.length && !o0.notes;
        if (empty) { m.options = [c]; m.sel = 0; m.active = 0; } else { m.options.push(c); m.active = m.options.length - 1; }
        toast(`Opción pegada en ${m.name}${empty ? '' : ' como opción nueva'}.`);
      } else {
        const oi = clamp(m.active || 0, 0, m.options.length - 1);
        m.options[oi].foods.push(clone(clip.copy));
        toast(`Alimento pegado en ${m.name} · Opción ${oi + 1}.`);
      }
      collapsed.delete(m.id); saveCollapsed(); commit();
    },
    clearClip() { clip = null; render(); },
    dupOpt(el) { const m = getP(el.dataset.m); const c = clone(m.options[+el.dataset.k]); c.id = uid(); m.options.splice(+el.dataset.k + 1, 0, c); m.active = +el.dataset.k + 1; if (m.sel > +el.dataset.k) m.sel++; commit(); },
    delOpt(el) {
      const m = getP(el.dataset.m); const k = +el.dataset.k;
      confirmModal('Eliminar opción', 'Se eliminará esta opción con sus alimentos, imagen y notas.', () => {
        m.options.splice(k, 1); if (m.sel >= m.options.length || m.sel === k) m.sel = 0; else if (m.sel > k) m.sel--; m.active = clamp(k - 1, 0, m.options.length - 1); closeModal(); commit();
      });
    },
    setMain(el) { getP(el.dataset.m).sel = +el.dataset.k; commit(); },
    addLine(el) { getP(el.dataset.p).foods.push({ foodId: null, foodName: '', cantidad: '', porciones: 1 }); commit(); setTimeout(() => { const ins = document.querySelectorAll(`[data-food^="${el.dataset.p}.foods."]`); ins[ins.length - 1]?.focus(); }, 0); },
    delLine(el) { getP(el.dataset.p).foods.splice(+el.dataset.i, 1); commit(); },
    pickImage(el, ev) { if (ev.target.closest('.img-actions') && el.classList.contains('img-drop')) return; pendingImg = { path: el.dataset.p, push: false }; $('#file-input').click(); },
    clearImage(el) { setP(el.dataset.p, null); commit(); },
    printMenu() { printMenu(); },
    printPlan() { printPlan(); },

    trackTab(el) {
      A().ui.trackTab = el.dataset.v; closeDrawer(false);
      if (isClientView()) { if (!CLIENT) save(); go('cliente/seg'); return; }
      save(); if (route()[0] === 'seg') { render(); window.scrollTo(0, 0); } else go('seg');
    },
    clientDay(el) { A().activeDay = el.dataset.id; if (!CLIENT) save(); go('cliente/plan'); },

    // Acceso del cliente
    genLink() { A().portal.token = randomToken(); delete T.conflicts[A().id]; commit(); },
    regenLink() {
      confirmModal('Generar un enlace nuevo', 'El enlace anterior dejará de funcionar. Tendrás que enviarle el nuevo a tu cliente.', () => {
        A().portal.token = randomToken(); delete T.conflicts[A().id]; closeModal(); commit();
      }, 'Generar');
    },
    copyLink() {
      const v = clientLink(A()), inp = $('#client-link');
      const fallback = () => { inp?.focus(); inp?.select(); toast('Selecciona el enlace y cópialo con Ctrl+C.'); };
      try { navigator.clipboard.writeText(v).then(() => toast('Enlace copiado.'), fallback); } catch { fallback(); }
    },
    publishPlanNow() {
      const a = A(); toast('Publicando plan…');
      publishPlan(a).then(() => { render(); toast(`Plan publicado para ${a.q.nombre || 'tu cliente'}.`); }).catch(syncError);
    },
    previewClient() { T.preview = true; closeDrawer(false); curRoute = 'cliente/plan'; render(); window.scrollTo(0, 0); },
    // Al salir de la vista previa se vuelve a Acceso del cliente, desde donde se abrió.
    exitPreview() { T.preview = false; go('acceso'); },
    revokeAccess() {
      const a = A(), u = linkedUid(a);
      confirmModal('Quitar acceso al cliente', `${esc(a.q.nombre || 'Tu cliente')} dejará de ver su portal y no podrá anotar datos. El seguimiento queda guardado en tu app. Quítalo también del menú <b>Compartir</b>.`, async () => {
        closeModal();
        a.portal = newPortal(); delete T.claims[u];
        ensureTrackSubs();
        try {
          await flush(); // guarda el seguimiento de vuelta en el atleta antes de borrar el portal
          await Promise.all([cdb.doc(planPath(u)).delete(), cdb.doc(trackPath(u)).delete(), cdb.doc('portal/' + u).delete()]);
          toast('Acceso quitado.');
        } catch (e) { syncError(e); }
        render();
      }, 'Quitar acceso');
    },
    sbDay(el) { A().activeDay = el.dataset.id; save(); go('plan/' + el.dataset.t); },
    toggleSidebar() { sbCollapsed = !sbCollapsed; lsSet('prepcoach-sb', sbCollapsed ? '1' : '0'); render(); },
    openDrawer() { openDrawer(); },
    closeDrawer() { closeDrawer(); },
    goToday() {
      const k = currentWeek(A());
      if (isFolded(A(), k)) { wkFold[k] = false; lsSet('prepcoach-wkfold', JSON.stringify(wkFold)); render(); }
      document.getElementById(`wk-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    foldWeek(el) { const a = A(), k = +el.dataset.k; wkFold[k] = !isFolded(a, k); lsSet('prepcoach-wkfold', JSON.stringify(wkFold)); render(); },
    toggleDailyCol(el) { dailyShow[el.dataset.g] = el.checked; lsSet('prepcoach-dailycols', JSON.stringify(dailyShow)); render(); },
    resetBuscado(el) { const w = A().tracking.weeks[el.dataset.k]; if (w) delete w.buscado; commit(); },
    fillMacros(el) {
      const a = A(), k = el.dataset.k, rc = reqCalc(a);
      const tr = a.dayTypes.find((d) => /entren/i.test(d.name)) || a.dayTypes[0];
      const rs = a.dayTypes.find((d) => /descans/i.test(d.name)) || a.dayTypes[1] || a.dayTypes[0];
      setP(`tracking.weeks.${k}.macrosE`, macroStr(dayTargets(a, tr, rc)));
      setP(`tracking.weeks.${k}.macrosD`, macroStr(dayTargets(a, rs, rc)));
      commit();
    },
    addPhoto(el) { pendingImg = { path: `tracking.weeks.${el.dataset.k}.fotos`, push: true }; $('#file-input').click(); },
    viewPhoto(el) {
      const k = el.dataset.k, i = +el.dataset.i, src = wk(A(), k).fotos[i];
      openModal(`<div class="lightbox"><img src="${imgSrc(src)}" alt="Foto de referencia"></div><div class="modal-foot"><span class="muted small" style="margin-right:auto">${weekLabel(+k)} · ${fmtDate(weekStart(A(), +k))}</span><button class="btn danger" data-action="delPhoto" data-k="${k}" data-i="${i}">${ic('trash', 14)} Eliminar</button><button class="btn" data-action="closeModal">Cerrar</button></div>`, null, true);
    },
    delPhoto(el) { wk(A(), el.dataset.k).fotos.splice(+el.dataset.i, 1); closeModal(); commit(); },

    addFood() {
      // Abre la ficha «Nuevo alimento» sobre la tabla; el alimento entra en la base solo al pulsar «Guardar alimento».
      if (!T.foodDraft) { T.foodDraft = { name: '', porcion: '', gpp: null, kcal: null, p: null, c: null, g: null }; render(); }
      setTimeout(() => { const el = $('#ff-name'); el?.scrollIntoView({ block: 'center' }); el?.focus({ preventScroll: true }); }, 0);
    },
    cancelFood() { T.foodDraft = null; render(); },
    saveFood() {
      const d = T.foodDraft; if (!d) return;
      const name = String(d.name || '').trim();
      const bad = (msg) => { toast(msg); const el = $('#ff-name'); el?.classList.add('invalid'); el?.focus(); };
      if (!name) return bad('Escribe el nombre del alimento para guardarlo.');
      if (S.foods.some((x) => x.name.trim().toLowerCase() === name.toLowerCase())) return bad(`Ya existe «${name}» en la base. Usa otro nombre o edita el existente.`);
      const f = { id: uid(), name, porcion: String(d.porcion || '').trim(), gpp: d.gpp ?? null, kcal: d.kcal ?? 0, p: d.p ?? 0, c: d.c ?? 0, g: d.g ?? 0 };
      // Se agrega a la base y se muestra en su lugar alfabético (con la búsqueda limpia), resaltado unos segundos.
      S.foods.push(f); T.foodDraft = null; T.foodQ = ''; T.foodSaved = f.id; commit();
      toast(`«${name}» se guardó en la base de alimentos.`);
      setTimeout(() => {
        const row = $(`[data-bind="@foods.${S.foods.indexOf(f)}.name"]`)?.closest('tr');
        row?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        setTimeout(() => { if (T.foodSaved === f.id) { T.foodSaved = null; row?.classList.remove('food-new'); } }, 4000);
      }, 0);
    },
    delFood(el) {
      const f = S.foods.find((x) => x.id === el.dataset.id);
      const used = S.athletes.some((a) => a.dayTypes.some((d) => d.meals.some((m) => m.options.some((o) => o.foods.some((l) => l.foodId === f.id)))));
      confirmModal('Eliminar alimento', `Se eliminará <b>${esc(f.name)}</b> de la base.${used ? ' <br><br><span style="color:var(--warn)">Está en uso en algún menú: esas líneas quedarán sin datos.</span>' : ''}`, () => { S.foods = S.foods.filter((x) => x.id !== f.id); closeModal(); commit(); });
    },

    // Apariencia: el cambio se aplica al momento y el diálogo se actualiza en el sitio.
    openTheme() { openModal(themeModalHtml()); setTimeout(() => $('#modal-root .theme-opt[aria-checked="true"]')?.focus(), 0); },
    setThemeMode(el) { setTheme({ mode: el.dataset.mode }); refreshThemeModal(`[data-mode="${el.dataset.mode}"]`); },
    setThemePalette(el) { setTheme({ mode: 'light', palette: el.dataset.palette }); refreshThemeModal(`[data-palette="${el.dataset.palette}"]`); },
    closeModal() { closeModal(); },
    closeModalBack(el, ev) { if (ev.target === el) closeModal(); },
    modalOk() { if (modalCb) modalCb(); },
  };

  // =====================================================================
  // Eventos
  // =====================================================================
  function readBound(el) {
    const path = el.dataset.bind;
    if (el.type === 'checkbox' && el.hasAttribute('data-multi')) {
      const arr = new Set(getP(path) || []); el.checked ? arr.add(el.value) : arr.delete(el.value); setP(path, [...arr]);
    } else if (el.type === 'checkbox') setP(path, el.checked);
    else if (el.type === 'radio') { if (el.checked) setP(path, el.value); }
    else if (el.dataset.type === 'num') setP(path, num(el.value));
    else setP(path, el.value);
  }

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.bind) {
      if (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio') return; // se maneja en change
      // Campos de una sola línea que se muestran en varias (nombre de la comida): sin saltos de línea.
      if (el.hasAttribute('data-oneline') && /[\r\n]/.test(el.value)) el.value = el.value.replace(/\s*[\r\n]+\s*/g, ' ');
      readBound(el); if (el.dataset.bind[0] !== '#') save();
      if (el.dataset.bind.startsWith('#foodDraft.')) el.classList.remove('invalid');
      if (el.hasAttribute('data-live')) scheduleRender();
      else if (el.dataset.bind === 'q.nombre') renderHeader();
    } else if (el.dataset.food) {
      const f = foodByName(el.value); const line = getP(el.dataset.food);
      line.foodName = el.value; line.foodId = f ? f.id : null; save();
      el.classList.remove('invalid');
      if (!FD.el || FD.key !== el.dataset.food) ddOpen(el);
      FD.typed = true; ddUpdate();
    } else if (el.dataset.date) {
      const masked = maskDate(el.value), path = el.dataset.date;
      if (masked !== el.value) { el.value = masked; try { el.setSelectionRange(masked.length, masked.length); } catch { /* sin cursor */ } }
      if (!masked) { el.classList.remove('invalid'); if (getP(path)) { setP(path, ''); save(); scheduleRender(); } return; }
      const isoV = masked.length === 10 ? parseDMY(masked) : null;
      el.classList.toggle('invalid', masked.length === 10 && !isoV);
      if (isoV && isoV !== getP(path)) { setP(path, isoV); save(); scheduleRender(); }
    } else if (el.dataset.mg) {
      const g = num(el.value), tot = parseFloat(el.dataset.tot);
      setP(el.dataset.mg, g != null && tot ? Math.round((g / tot) * 100 * 10000) / 10000 : null); save(); scheduleRender();
    } else if (el.dataset.grams) {
      const g = num(el.value), gpp = parseFloat(el.dataset.gpp);
      setP(`${el.dataset.grams}.porciones`, g != null && gpp ? Math.round((g / gpp) * 1000) / 1000 : null); save(); scheduleRender();
    }
  });
  // Envío del inicio de sesión (con una pausa breve tras varios intentos fallidos).
  let loginFails = 0, loginLockUntil = 0;
  document.addEventListener('submit', (ev) => {
    if (ev.target.id !== 'login-form') return;
    ev.preventDefault();
    const err = $('#login-error'), user = $('#login-user').value, pass = $('#login-pass').value;
    const show = (msg) => { err.textContent = msg; err.hidden = false; const c = $('.login-card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); };
    if (Date.now() < loginLockUntil) { show(`Demasiados intentos. Espera ${Math.ceil((loginLockUntil - Date.now()) / 1000)} segundos.`); return; }
    if (!user.trim() || !pass) { show('Escribe tu nombre y tu contraseña.'); return; }
    if (tryLogin(user, pass, $('#login-remember').checked)) {
      loginFails = 0; curRoute = 'inicio'; lsSet('prepcoach-route', 'inicio');
      render(); window.scrollTo(0, 0);
      return;
    }
    loginFails++;
    if (loginFails >= 5) { loginLockUntil = Date.now() + 30000; loginFails = 0; }
    show('Nombre o contraseña incorrectos.');
    $('#login-pass').value = ''; $('#login-pass').focus();
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.id === 'athlete-select') { S.activeId = el.value; commit(); return; }
    if (el.id === 'm-day' && copyCtx) { const d = A().dayTypes.find((x) => x.id === el.value); $('#m-meal').innerHTML = mealOptions(d, copyCtx.src.name); return; }
    if (el.dataset.date) {
      // Al salir del campo: si la fecha quedó incompleta o no existe, se avisa y se vuelve al valor guardado.
      if (el.value && !parseDMY(el.value)) {
        toast('Fecha no válida. Escríbela como dd/mm/aaaa, por ejemplo 08/10/1999.');
        const v = getP(el.dataset.date); el.value = v ? fmtDate(v) : ''; el.classList.remove('invalid');
      }
      return;
    }
    if (el.dataset.bind && (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio' || el.type === 'date')) {
      readBound(el); save(); render();
    } else if (el.dataset.food) {
      // al salir del campo: si no coincide exacto, intenta una coincidencia única por texto
      const line = getP(el.dataset.food);
      if (!line.foodId && el.value) {
        const m = foodMatches(el.value);
        if (m.length === 1) { line.foodId = m[0].id; line.foodName = m[0].name; save(); }
      }
      // se refresca un instante después para no interferir con un clic en curso
      setTimeout(scheduleRender, 150);
    }
  });
  document.addEventListener('focusin', (ev) => { const el = ev.target; if (el.dataset && el.dataset.food) ddOpen(el); });
  document.addEventListener('focusout', (ev) => {
    if (!ev.target.dataset || !ev.target.dataset.food) return;
    setTimeout(() => { const a = document.activeElement; if (!(a && a.dataset && a.dataset.food === FD.key)) ddClose(); }, 0);
  });
  document.addEventListener('keydown', (ev) => {
    const el = ev.target; if (!el.dataset || !el.dataset.food || !FD.el) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault(); if (!FD.items.length) return;
      FD.idx = (FD.idx + (ev.key === 'ArrowDown' ? 1 : -1) + FD.items.length) % FD.items.length; ddDraw();
    } else if (ev.key === 'Enter') {
      if (FD.items[FD.idx]) { ev.preventDefault(); ddPick(FD.items[FD.idx]); }
    } else if (ev.key === 'Escape') { ev.stopPropagation(); ddClose(); }
  });
  window.addEventListener('scroll', () => { if (FD.el) ddPos(); }, { passive: true, capture: true });
  window.addEventListener('resize', () => { if (FD.el) ddPos(); scalePreviewSheets(); if (CAL) { CAL = null; calDraw(); } });
  document.addEventListener('change', (ev) => {
    if (!CAL || !ev.target.closest || !ev.target.closest('#cal-pop')) return;
    if (ev.target.id === 'cal-m') CAL.m = +ev.target.value; else if (ev.target.id === 'cal-y') CAL.y = +ev.target.value; else return;
    calDraw();
  });
  document.addEventListener('pointerdown', (ev) => {
    if (CAL && !ev.target.closest('#cal-pop') && !ev.target.closest('[data-action="openCal"]')) { CAL = null; calDraw(); }
  });
  document.addEventListener('keydown', (ev) => { if (CAL && ev.key === 'Escape') { CAL = null; calDraw(); } });
  // Calendario de alimentación: con el mouse se toca o se arrastra sobre los días; en pantallas táctiles y con
  // teclado, cada toque (o Enter) cambia un día. Tocar un día que ya tiene el tipo elegido lo deja sin asignar.
  let fcPaint = null, fcSkipClick = false;
  function fcApply(el) {
    const a = A(); if (!a || !fcPaint) return;
    const d = el.dataset.fc, cal = calOf(a), dt = fcPaint.val ? a.dayTypes.find((x) => x.id === fcPaint.val) : null;
    if (dt) cal[d] = dt.id; else delete cal[d];
    // Se actualiza el mismo botón (si se reemplazara, el navegador perdería el «soltar» del mouse).
    const tmp = document.createElement('div'); tmp.innerHTML = fcDayBtn(a, d, todayISO()); const nb = tmp.firstElementChild;
    el.className = nb.className; el.setAttribute('style', nb.getAttribute('style') || ''); el.title = nb.title;
    el.setAttribute('aria-label', nb.getAttribute('aria-label')); el.innerHTML = nb.innerHTML;
  }
  const fcStart = (el) => { const a = A(), b = fcBrushOf(a); fcPaint = { val: b === 'clear' || (a.calendar || {})[el.dataset.fc] === b ? null : b }; fcApply(el); };
  document.addEventListener('pointerdown', (ev) => {
    if (fcPaint) fcEnd(); // por si un «soltar» anterior no llegó
    fcSkipClick = false;
    const el = ev.target.closest && ev.target.closest('[data-fc]');
    if (!el || ev.pointerType === 'touch' || ev.button > 0) return;
    ev.preventDefault(); fcStart(el);
  });
  document.addEventListener('pointerover', (ev) => { if (!fcPaint) return; const el = ev.target.closest && ev.target.closest('[data-fc]'); if (el) fcApply(el); });
  function fcEnd() { if (!fcPaint) return; fcPaint = null; fcSkipClick = true; setTimeout(() => { fcSkipClick = false; }, 0); save(); render(); }
  document.addEventListener('pointerup', fcEnd); document.addEventListener('pointercancel', fcEnd);
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-fc]'); if (!el) return;
    if (fcSkipClick) { fcSkipClick = false; return; }
    fcStart(el); fcPaint = null; save(); render();
  });
  document.addEventListener('click', (ev) => {
    const link = ev.target.closest('a[href^="#/"]');
    if (link && !link.dataset.action) { ev.preventDefault(); go(link.getAttribute('href').slice(2)); return; }
    const el = ev.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (fn) { if (el.tagName === 'A') ev.preventDefault(); fn(el, ev); }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && $('#modal-root').innerHTML) closeModal();
    else if (ev.key === 'Escape' && document.body.classList.contains('drawer-open')) closeDrawer();
    if (ev.key === 'Enter' && $('#modal-root .modal') && ev.target.tagName === 'INPUT') { ev.preventDefault(); actions.modalOk(); }
    else if (ev.key === 'Enter' && ev.target.hasAttribute && ev.target.hasAttribute('data-oneline')) { ev.preventDefault(); ev.target.blur(); }
    // Enter en cualquier campo de la ficha «Nuevo alimento» la guarda.
    else if (ev.key === 'Enter' && ev.target.dataset?.bind?.startsWith('#foodDraft.')) { ev.preventDefault(); actions.saveFood(); }
  });

  $('#file-input').addEventListener('change', async (ev) => {
    const file = ev.target.files[0]; ev.target.value = '';
    if (!file || !pendingImg) return;
    const target = pendingImg; pendingImg = null;
    handleImageFile(file, target);
  });
  $('#json-input').addEventListener('change', async (ev) => {
    const file = ev.target.files[0]; ev.target.value = ''; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.athletes) || !Array.isArray(data.foods)) throw new Error('formato');
      confirmModal('Importar respaldo', `El respaldo contiene <b>${data.athletes.length}</b> atleta(s) y <b>${data.foods.length}</b> alimentos. Reemplazará todos los datos actuales.`, () => {
        S = migrate(data); closeModal(); save(); go('inicio'); toast('Respaldo importado.');
      }, 'Importar');
    } catch { toast('El archivo no es un respaldo válido de PrepCoach.'); }
  });

  // Completa campos que falten en datos antiguos o importados.
  function migrate(s) {
    s.foods = s.foods || newState().foods; s.athletes = (s.athletes || []).map(migrateAthlete);
    s.pg = s.pg && typeof s.pg === 'object' ? s.pg : { clients: [] }; // Población general: datos propios, sin relación con los atletas
    if (!s.athletes.find((a) => a.id === s.activeId)) s.activeId = s.athletes[0]?.id || null;
    return s;
  }
  // Si el tiempo de comida quedó con el nombre del plato (antes se podía «traer nombre del menú»),
  // se recupera el tiempo de comida de la plantilla cuando la posición y la hora coinciden.
  function fixMealNames(a) {
    for (const dt of a.dayTypes || []) {
      const tpl = /entren/i.test(dt.name) ? trainMeals() : /descans/i.test(dt.name) ? restMeals() : null;
      (dt.meals || []).forEach((m, i) => {
        const dish = mealMenuName(m), nm = String(m.name || '').trim();
        if (!dish || nm !== dish) return;
        const t = tpl && tpl[i] && tpl[i].time === m.time ? tpl[i] : tpl && tpl.find((x) => x.time === m.time);
        if (t) m.name = t.name;
      });
    }
  }
  function migrateAthlete(a) {
    const base = newAthlete('');
    a.q = Object.assign(base.q, a.q || {}); a.req = Object.assign(base.req, a.req || {});
    const hadStages = !!(a.tracking && isPlain(a.tracking.config) && Array.isArray(a.tracking.config.stages));
    a.tracking = a.tracking || base.tracking; a.tracking.config = Object.assign(base.tracking.config, a.tracking.config || {});
    a.tracking.weeks = a.tracking.weeks || {}; a.tracking.daily = a.tracking.daily || {};
    // Antes de las etapas: se arman desde la configuración anterior (y el mini cut del plan), sin perder metas.
    if (!hadStages) { a.tracking.config.stages = stagesFromLegacy(a.tracking, a.minicut); keepLegacyTargets(a.tracking); }
    moveWeeklyToDaily(a.tracking);
    a.ui = Object.assign(base.ui, a.ui || {});
    if (!a.dayTypes || !a.dayTypes.length) { a.dayTypes = base.dayTypes; a.activeDay = base.activeDay; }
    a.portal = Object.assign(newPortal(), isPlain(a.portal) ? a.portal : {});
    a.calendar = isPlain(a.calendar) ? a.calendar : {};
    fixMealNames(a);
    syncTimeline(a);
    return a;
  }

  // =====================================================================
  // Arranque
  // =====================================================================
  // Token del enlace del cliente: #c<token>. Se recuerda por si el visor no conserva el ancla.
  function clientToken() {
    const m = (location.hash || '').match(/^#c([A-Za-z0-9]{12,64})$/);
    if (m) { lsSet('prepcoach-client-token', m[1]); return m[1]; }
    return lsGet('prepcoach-client-token');
  }
  (async () => {
    const use = window.claude && typeof window.claude.use === 'function' ? window.claude.use.bind(window.claude) : null;
    if (use) {
      // Dentro de un Artifact: primero se intenta la base de datos sincronizada.
      MODE = 'sync'; ready = false; ROLE_PENDING = true; S = newState(); S.activeId = lsGet('prepcoach-active'); render();
      cdb = await use('db').catch(() => null);
      if (cdb) {
        [cassets, cdownloads, cuser] = await Promise.all([use('assets').catch(() => null), use('downloads').catch(() => null), use('user').catch(() => null)]);
        const owner = cuser ? await cuser.isOwner() : true;
        ROLE_PENDING = false;
        const token = owner ? null : clientToken();
        if (!owner && token) { await startClient(token); return; }
        if (!owner) { CLIENT = true; CL.state = 'nolink'; ready = true; render(); return; }
        if ((location.hash || '').startsWith('#c')) setTimeout(() => toast('Abriste el enlace de un cliente. Como dueño ves la app completa; usa «Vista previa como cliente» para ver su portal.'), 800);
        startSync();
        render(); // muestra el inicio de sesión (o la carga) mientras llegan los datos
        return;
      }
      MODE = 'local'; ready = true; ROLE_PENDING = false;
      loadNote = 'La sincronización no está disponible en esta vista: los datos se guardan solo en este navegador.';
    }
    S = migrate((await loadState()) || newState());
    render();
  })();
})();
