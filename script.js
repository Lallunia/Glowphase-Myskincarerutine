/* ═══════════════════════════════════════════════
   CATEGORY + ICON NORMALIZATION (Glowphase safety layer)
   - Detects sunscreens by name even when category is wrong
   - Provides a single source of truth for category icons
   - Guarantees no "undefined" ever renders in routine cards
═══════════════════════════════════════════════ */
const CAT_EMOJI = {
  'cleanser': '🧼',
  'cleansing balm': '🫧',
  'cleansing oil': '🫧',
  'cleansing water': '🫧',
  'toner': '💧',
  'toner pad': '🩹',
  'essence': '✨',
  'serum': '✨',
  'ampoule': '✨',
  'moisturizer': '🧴',
  'gel cream': '💦',
  'cream': '🧴',
  'sunscreen': '☀️',
  'spf': '☀️',
  'eye': '👁️',
  'eye cream': '👁️',
  'eye serum': '👁️',
  'exfoliant': '🍑',
  'peeling gel': '🍑',
  'acne': '🎯',
  'acne treatment': '🎯',
  'spot treatment': '🎯',
  'device gel': '💎',
  'oil cleanser': '🫧',
  'mist': '💦',
  'emulsion': '🥛',
  'wash-off mask': '🌿',
  'occlusive': '🛡️',
  'balm': '🛡️',
  'barrier cream': '🧴',
  'lightweight cream': '🧴',
  'rich cream': '🧴',
  'sleeping cream': '🌙',
  'treatment': '🌿',
  'mask': '🌿',
  'sheet mask': '🎭',
  'sleeping mask': '🌙',
  'sleeping pack': '🌙',
  'other': '🧴'
};

// Detect a sunscreen via product name (even if category is wrong in raw data)
function isSunscreenProduct(p) {
  if (!p) return false;
  if (p.category === 'sunscreen' || p.category === 'spf') return true;
  const name = (p.name || '').toLowerCase();
  // Matches: sunscreen, sun cream, sun gel, sun stick, sun fluid, sun milk,
  // sun balm, sun lotion, sun serum, sunblock, SPF, UVMune, UV Lock, "UV" as word, tone-up sunscreen
  if (/\b(sunscreen|sunblock|spf|uvmune|uvlock)\b/i.test(name)) return true;
  if (/\bsun\s+(cream|gel|stick|fluid|milk|balm|lotion|serum)\b/i.test(name)) return true;
  if (/\buv\b/i.test(name) && /(serum|fluid|cream|lotion|gel|stick|defense|defence|protect|shield)/i.test(name)) return true;
  return false;
}

// Normalize category at read time — fixes mislabeled entries without mutating data
function normalizedCategory(p) {
  if (!p) return 'other';
  if (isSunscreenProduct(p)) return 'sunscreen';
  // Name-based overrides — catch mislabeled products before falling back to p.category
  const _n = (p.name || '').toLowerCase();
  const _sub = (p.subcategory || '').toLowerCase();
  // Toner Pad — must resolve BEFORE toner check so pads don't collapse into toner
  // Includes all pad subcategory variants: calming, hydrating, exfoliating, brightening
  if (/toner\s*pad|calming\s*pad|peeling\s*pad|daily\s*pad|hydrating\s*pad|exfoliating\s*pad|brightening\s*pad/.test(_n) ||
      /toner\s*pad|calming\s*pad|peeling\s*pad|daily\s*pad|hydrating\s*pad|exfoliating\s*pad|brightening\s*pad/.test(_sub)) return 'toner pad';
  // Wash-Off Mask — must resolve BEFORE sheet mask / sleeping mask
  if (/wash[\s-]*off\s*mask|rinse[\s-]*off\s*mask|clay\s*mask|mud\s*mask/.test(_n) ||
      /wash[\s-]*off\s*mask|rinse[\s-]*off\s*mask|clay\s*mask|mud\s*mask/.test(_sub) ||
      _sub === 'wash-off mask') return 'wash-off mask';
  // Sheet Mask — must resolve BEFORE treatment/mask to avoid wrong bucket
  if (/sheet\s*mask|mask\s*pack/.test(_n) || /sheet\s*mask|mask\s*pack/.test(_sub)) return 'sheet mask';
  // Sleeping Mask / Sleeping Pack
  if (/sleeping\s*mask|overnight\s*mask/.test(_n) ||
      /sleeping\s*mask|overnight\s*mask/.test(_sub)) return 'sleeping mask';
  // Peeling Gel — must resolve BEFORE exfoliant so subcategory stays accurate
  if (/peeling\s*gel|peel\s*gel|gommage/.test(_n) ||
      /peeling\s*gel|peel\s*gel|gommage/.test(_sub)) return 'peeling gel';
  // Ampoule — concentrated treatment; check name and subcategory
  if (/\bampoule\b|\bampule\b/.test(_n) || /\bampoule\b|\bampule\b/.test(_sub) ||
      _sub === 'ampoule') return 'ampoule';
  // Emulsion — lightweight lotion-type moisturizer
  if (/\bemulsion\b/.test(_n) || /\bemulsion\b/.test(_sub) ||
      _sub === 'emulsion') return 'emulsion';
  // Spot Treatment — promote from subcategory to top-level category
  if (_sub === 'spot treatment' || /spot\s*treatment|blemish\s*treatment/.test(_sub)) return 'spot treatment';
  // Occlusive / Balm — sealing layer products
  if (/\bocclusive\b/.test(_n) || /\bocclusive\b/.test(_sub) ||
      _sub === 'occlusive' || _sub === 'balm') return 'occlusive';
  // Gel Cream (subcategory under moisturizer)
  if (/gel\s*cream|water\s*cream/.test(_n) ||
      /gel\s*cream|water\s*cream/.test(_sub)) return 'gel cream';
  return p.category || 'other';
}

/* ═══════════════════════════════════════════════
   GLOWPHASE PRODUCT SCHEMA v2.0
   Canonical reference for all valid categories, subcategories, and fields.
   Used by importProductDB() for validation.
═══════════════════════════════════════════════ */
const GLOWPHASE_SCHEMA = {
  // ── Top-level categories (value of p.category) ──────────────────────────
  categories: [
    'cleanser',       // face wash
    'toner',          // includes toner pads (resolved by normalizedCategory)
    'essence',
    'ampoule',        // high-concentration treatment
    'serum',
    'emulsion',       // lightweight lotion
    'moisturizer',    // cream / lotion
    'eye',            // eye cream / serum
    'sunscreen',
    'exfoliant',
    'mist',
    'treatment',      // masks, multi-step treatments
    'spot treatment', // blemish / acne spot products
    'wash-off mask',  // rinse-off masks (clay, mud, etc.)
    'occlusive',      // balms, occlusives, sealing layers
    'oil cleanser',
    'other'
  ],
  // ── Subcategory values (value of p.subcategory) ──────────────────────────
  subcategories: {
    cleanser:       ['cleansing balm', 'cleansing oil', 'cleansing water', 'foam cleanser', 'gel cleanser'],
    toner:          ['calming pad', 'hydrating pad', 'exfoliating pad', 'brightening pad', 'toner pad'],
    essence:        ['essence'],
    ampoule:        ['ampoule'],
    serum:          [],
    emulsion:       ['emulsion'],
    moisturizer:    ['gel cream', 'barrier cream', 'lightweight cream', 'rich cream', 'sleeping cream'],
    eye:            ['eye cream', 'eye serum'],
    mist:           ['hydrating mist', 'milky mist', 'barrier mist', 'glow mist', 'soothing mist', 'setting mist'],
    treatment:      ['sheet mask', 'sleeping mask'],
    'spot treatment': ['spot treatment'],
    'wash-off mask':  ['clay mask', 'mud mask'],
    occlusive:      ['balm', 'occlusive'],
    exfoliant:      ['peeling gel', 'chemical exfoliant', 'physical exfoliant'],
    sunscreen:      []
  },
  // ── Texture tags (stored as array on p.texture) ───────────────────────
  // Describes the physical feel / weight of the product
  textureTags: [
    'watery',         // very thin, water-like consistency
    'milky',          // opaque, lotion-like but fluid
    'gel',            // gel or jelly texture
    'lightweight',    // light feel, absorbs quickly
    'medium-weight',  // moderate thickness
    'rich',           // thick, emollient
    'occlusive',      // sealing, film-forming
    'sticky',         // tacky finish
    'fast-absorbing', // sinks in within seconds
    'makeup-friendly',// sits well under makeup without pilling
    'non-pilling'     // does not pill when layered
  ],
  // ── Finish tags (stored as array on p.finish) ────────────────────────
  // Describes how the skin looks after the product absorbs
  finishTags: [
    'glowy',          // lit-from-within radiance
    'dewy',           // moist, fresh sheen
    'matte',          // no shine
    'satin',          // soft sheen, between dewy and matte
    'glass-skin'      // ultra-smooth, reflective, poreless look
  ],
  // ── Function tags (stored as array on p.functionTags) ────────────────
  // Internal intelligence tags for scoring engine and routine logic
  functionTags: [
    'barrier support',     // helps restore/maintain skin barrier
    'calming',             // soothes irritation, redness, or sensitivity
    'redness support',     // specifically targets redness / rosacea-prone skin
    'hydration support',   // primary role is delivering/retaining moisture
    'glow support',        // brightening, radiance-boosting
    'acne-safe',           // formulated to be non-comedogenic / acne-friendly
    'pore care',           // targets pore appearance or congestion
    'overnight repair',    // designed for nighttime regeneration
    'elasticity support',  // supports collagen / skin firmness over time
    'firming',             // immediate or cumulative lifting/tightening effect
    'makeup prep',         // optimised as a base layer under makeup
    'recovery safe',       // gentle enough for compromised/post-treatment skin
    'device recovery safe' // safe to use after RF/LED/microcurrent device sessions
  ],
  // ── Retinoid intensity (stored as single string on p.retinoidIntensity) ──
  // Only set on products that contain a retinoid active. Omit entirely if no retinoid.
  // Used by scoring engine to match product strength to user tolerance.
  retinoidIntensity: [
    'beginner retinoid',  // low-strength: bakuchiol, low-% retinyl esters, HPR ≤0.1%
    'moderate retinoid',  // mid-strength: retinol 0.1–0.5%, retinal 0.05–0.1%, HPR ≤0.5%
    'advanced retinoid'   // high-strength: retinol ≥0.5%, retinal ≥0.1%, prescription tretinoin/adapalene
  ],
  // ── Exfoliation intensity (stored as single string on p.exfoliationIntensity) ──
  // Only set on products that deliver chemical or physical exfoliation. Omit if none.
  exfoliationIntensity: [
    'gentle exfoliant',     // PHA, low-% lactic acid (≤5%), enzyme, very fine physical
    'moderate exfoliant',   // AHA 5–10%, BHA ≤2%, mild mandelic/glycolic, peeling gels
    'aggressive exfoliant'  // AHA >10%, high-% glycolic, TCA, strong BHA, prescription-grade
  ],
  // ── Safety tags (stored as array on p.safetyTags) ────────────────────
  // Layering and contraindication flags — support routine logic and conflict detection
  safetyTags: [
    'avoid-damaged-barrier',  // contains actives that worsen a compromised barrier
    'recovery-safe',          // safe and beneficial during barrier repair / post-procedure
    'sensitive-skin-safe',    // formulated for reactive, redness-prone, or allergy-prone skin
    'not-device-safe'         // should not be used on same day as RF/LED/microcurrent devices
  ],
  // ── Required fields ────────────────────────────────────────────────────
  required: ['id', 'brand', 'name', 'category'],
  // ── Optional fields ────────────────────────────────────────────────────
  optional: [
    'subcategory', 'texture', 'finish', 'functionTags',
    'retinoidIntensity', 'exfoliationIntensity', 'safetyTags',
    'ingredients', 'fragranceFree', 'alcoholFree', 'eoFree',
    'activeIngredients', 'description', 'descriptionTH', 'bestFor', 'bestForTH',
    'howOften', 'howOftenTH', 'doNotCombine', 'doNotCombineTH',
    'medicubeMode', 'imageUrl', 'thumbnailUrl', 'daytimeOnly', 'makeupPrep', 'sourceUrl'
  ]
};

// Classify a mist product into functional subtype for placement logic
// Returns: 'setting' | 'barrier' | 'milky' | 'soothing' | 'glow' | 'hydrating'
function mistSubtype(p) {
  if (!p || normalizedCategory(p) !== 'mist') return null;
  const _all = ((p.name||'') + ' ' + (p.subcategory||'') + ' ' + (p.description||'')).toLowerCase();
  if (/setting|fix\b|finish|fixer/.test(_all)) return 'setting';
  if (/barrier|repair|shield|protect/.test(_all)) return 'barrier';
  if (/milk|milky|cream/.test(_all)) return 'milky';
  if (/sooth|calm|cica|centella/.test(_all)) return 'soothing';
  if (/glow|radianc|brighten/.test(_all)) return 'glow';
  return 'hydrating'; // default — most mists are hydrating
}

// Pretty label for UI display — never "undefined"
function displayCategory(p) {
  return normalizedCategory(p) || 'Product';
}

// Fallback icon lookup by category string
function getCategoryIcon(category) {
  if (!category) return '🧴';
  const c = String(category).toLowerCase();
  return CAT_EMOJI[c] || '🧴';
}

// ═══════════════════════════════════════════════
//   INGREDIENT SAFETY HELPERS (Glowphase barrier protection system)
// ═══════════════════════════════════════════════

// Detect retinoids: retinol, retinal, tretinoin, adapalene
function hasRetinoid(p) {
  if (!p) return false;
  const ai = (p.activeIngredients || []).map(a => a.toLowerCase());
  if (ai.some(a => ['retinal','retinol','tretinoin','adapalene'].includes(a))) return true;
  const ing = (p.ingredients || '').toLowerCase();
  return /\b(retinal(?:dehyde)?|retinol|retinyl|tretinoin|adapalene|retinoic acid|hydroxypinacolone retinoate)\b/.test(ing);
}

// Detect exfoliating acids: AHA, BHA, PHA, LHA or exfoliant category
function hasExfoliantAcid(p) {
  if (!p) return false;
  const ai = (p.activeIngredients || []).map(a => a.toLowerCase());
  if (ai.some(a => ['aha','bha','pha','lha'].includes(a))) return true;
  if (p.category === 'exfoliant') return true;
  if (p.subcategory === 'chemical exfoliant') return true;
  const ing = (p.ingredients || '').toLowerCase();
  return /\b(glycolic acid|lactic acid|mandelic acid|salicylic acid|beta hydroxy|poly hydroxy|lactobionic|gluconolactone|capryloyl salicylic)\b/.test(ing);
}

// Detect benzoyl peroxide
function hasBenzoylPeroxide(p) {
  if (!p) return false;
  const ing = (p.ingredients || '').toLowerCase();
  const ai = (p.activeIngredients || []).map(a => a.toLowerCase());
  return ai.includes('benzoyl peroxide') || /benzoyl peroxide/.test(ing);
}

// Detect strong Vitamin C (L-ascorbic acid only — MAP/SAP are gentler)
function hasStrongVitaminC(p) {
  if (!p) return false;
  const ing = (p.ingredients || '').toLowerCase();
  const ai = (p.activeIngredients || []).map(a => a.toLowerCase());
  return ai.includes('vitamin c') ||
    /\bl-ascorbic acid\b/.test(ing) ||
    /\bascorbic acid\b/.test(ing);
}

// Combined: any "strong active" that requires cautious layering
function isStrongActive(p) {
  return hasRetinoid(p) || hasExfoliantAcid(p) || hasBenzoylPeroxide(p);
}

// Safe for barrier repair / recovery: no retinoids, no exfoliant acids, no BP, no strong vitC
function isBarrierSafeProduct(p) {
  if (!p) return false;
  return !hasRetinoid(p) && !hasExfoliantAcid(p) && !hasBenzoylPeroxide(p) && !hasStrongVitaminC(p);
}

// Actively supports barrier: contains ceramides, panthenol, centella, HA, etc.
function isBarrierSupportProduct(p) {
  if (!p) return false;
  const ing = (p.ingredients || '').toLowerCase();
  const ai = (p.activeIngredients || []).map(a => a.toLowerCase());
  const barrierIngredients = [
    'ceramide','panthenol','centella','madecassoside','beta-glucan','beta glucan',
    'allantoin','hyaluronic acid','sodium hyaluronate','glycerin','squalane',
    'cholesterol','oat','mugwort','heartleaf','green tea','propolis','rice',
    'cica','asiaticoside','asiatic acid','madecassic acid'
  ];
  return barrierIngredients.some(bi => ing.includes(bi)) ||
    ai.some(a => ['ceramide','panthenol','centella','ha','beta-glucan'].includes(a));
}

// ─── Rotation memory ─────────────────────────────────────────────────────────
// Tracks recently used products across sessions so selectBestForDay() can penalise
// over-used picks and encourage weekly variety. Stored in localStorage with a 7-day TTL;
// entries older than 7 days are pruned on every read.
const _GP_ROT_KEY = '_gpRot';
const _GP_ROT_TTL = 7 * 24 * 60 * 60 * 1000;
function _gpRotLoad() {
  try {
    const raw = localStorage.getItem(_GP_ROT_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    const now = Date.now();
    Object.keys(data).forEach(k => { if (now - (data[k].last || 0) > _GP_ROT_TTL) delete data[k]; });
    return data;
  } catch(e) { return {}; }
}
function _gpRotSave(rot) {
  try { localStorage.setItem(_GP_ROT_KEY, JSON.stringify(rot)); } catch(e) {}
}
// Record a product as used today — call after routine is built/rendered.
function _gpRotMarkUsed(p) {
  if (!p || !p.id) return;
  const rot = _gpRotLoad();
  const entry = rot[p.id] || { count: 0, days: [] };
  const today = Math.floor(Date.now() / 86400000);
  if (!entry.days.includes(today)) { entry.days.push(today); entry.count = (entry.count || 0) + 1; }
  entry.last = Date.now();
  rot[p.id] = entry;
  _gpRotSave(rot);
}
// Returns recency penalty: 0 (not used recently) → up to -5 (used every day this week).
function _gpRotPenalty(p, rot) {
  if (!p || !p.id || !rot) return 0;
  const entry = rot[p.id];
  if (!entry) return 0;
  const today = Math.floor(Date.now() / 86400000);
  const recentDays = (entry.days || []).filter(d => today - d < 7);
  return -Math.min(recentDays.length, 5);
}

// ─── Debug helpers ────────────────────────────────────────────────────────────
// DEV ONLY — never shown to normal users. Zero runtime cost when disabled.
//
// Enable (session):   window._gpDebug = true
// Enable (persist):   localStorage.setItem('gpDebug','1')
// Disable:            window._gpDebug = false  |  localStorage.removeItem('gpDebug')
//
// After generating a routine:
//   _gpDebugReport()       — pretty console.table grouped by day/slot
//   _gpDebugHelp()         — print all dev commands + score priority map
//   _gpResetRotation()     — wipe rotation memory (force fresh picks)
//   _gpDebugClear()        — clear _gpScoreLog without regenerating
//   window._gpScoreLog     — raw array of all scored entries
function _gpDebugOn() {
  return !!(window._gpDebug || (typeof localStorage !== 'undefined' && localStorage.getItem('gpDebug') === '1'));
}

// Phase-compatibility label for a product — used in debug output only.
function _phaseCompat(p, phaseType) {
  if (!p) return '—';
  const sTags = Array.isArray(p.safetyTags)   ? p.safetyTags   : [];
  const fTags = Array.isArray(p.functionTags) ? p.functionTags : [];
  const isRec = phaseType === 'recovery' || phaseType === 'barrier';
  if (isRec) {
    if (sTags.includes('avoid-damaged-barrier'))                                          return '⚠ avoid-recovery';
    if (sTags.includes('recovery-safe') || fTags.includes('recovery safe'))              return '✔ recovery-safe';
    if (p.retinoidIntensity === 'advanced retinoid')                                     return '⚠ too-intense (advanced retinoid)';
    if (p.exfoliationIntensity === 'aggressive exfoliant')                               return '⚠ too-intense (aggressive exfoliant)';
    return 'neutral';
  }
  if (phaseType === 'device') {
    if (sTags.includes('not-device-safe'))                                               return '✘ not-device-safe';
    if (fTags.includes('device recovery safe'))                                          return '✔ device-safe';
    return 'neutral';
  }
  if (phaseType === 'active') {
    if (p.retinoidIntensity || p.exfoliationIntensity)                                  return '✔ active-phase product';
    return 'neutral';
  }
  return 'neutral';
}

// Core debug logger — called once per candidate per selectBestForDay() call.
// Writes a grouped collapsible console entry with full score breakdown.
function _gpDbg(entry) {
  if (!_gpDebugOn()) return;
  if (!window._gpScoreLog) window._gpScoreLog = [];
  window._gpScoreLog.push(entry);

  const p   = entry.product  || {};
  const bd  = entry.breakdown || {};
  const sel = entry.selected;
  const sfx = (bd.safetyScore || 0) <= -6;          // hard safety-filtered
  const icon= sel ? '✅' : sfx ? '🚫' : '⬜';
  const sgn = v => (v == null ? '—' : (v >= 0 ? '+' : '') + v);
  const css = sel
    ? 'color:#2e7d32;font-weight:bold'
    : sfx ? 'color:#c62828;font-weight:bold' : 'color:#666';

  console.groupCollapsed(
    `%c[GP] ${icon} #${p.id||'?'} ${p.brand||''} ${p.name||'?'} ` +
    `| total=${sgn(entry.score)}  user=${sgn(bd.userScore)}  phase=${sgn(bd.phaseScore)}  rot=${sgn(bd.rotPen)}`,
    css
  );

  // Reason ──────────────────────────────────────────────────────────────────
  console.log('%c→ ' + (entry.reason || ''), sel ? 'color:#2e7d32' : sfx ? 'color:#c62828' : '');

  // Score totals ────────────────────────────────────────────────────────────
  console.log('%cScores', 'font-weight:bold', {
    total: sgn(entry.score), user: sgn(bd.userScore),
    phase: sgn(bd.phaseScore), rotation: sgn(bd.rotPen),
  });

  // Phase sub-score breakdown ───────────────────────────────────────────────
  console.log('%cPhase sub-scores', 'font-weight:bold', {
    '1 safety':      sgn(bd.safetyScore),
    '2 intensity':   sgn(bd.intensityScore),
    '3 phaseBase':   sgn(bd.phaseBaseScore),
    '4 complexity':  sgn(bd.complexityPen),
    '5 dayConflict': sgn(bd.dayConflict),
    '6 dupFunc':     sgn(bd.dupFunc),
    '7 texLayer':    sgn(bd.texLayer),
  });

  // Tags ────────────────────────────────────────────────────────────────────
  const deviceSafe = !(p.safetyTags||[]).includes('not-device-safe');
  console.log('%cTags', 'font-weight:bold', {
    texture:              (p.texture        ||[]).join(', ') || '—',
    finish:               (p.finish         ||[]).join(', ') || '—',
    functionTags:         (p.functionTags   ||[]).join(', ') || '—',
    safetyTags:           (p.safetyTags     ||[]).join(', ') || '—',
    retinoidIntensity:    p.retinoidIntensity    || '—',
    exfoliationIntensity: p.exfoliationIntensity || '—',
    deviceCompatible:     deviceSafe ? '✔' : '✘ not-device-safe',
    safetyGated:          sfx ? `⚠ score=${sgn(bd.safetyScore)}` : 'ok',
  });

  // Role + phase compatibility ───────────────────────────────────────────────
  console.log('%cRole & phase', 'font-weight:bold', {
    funcRole:     bd.role      || '—',
    texWeight:    bd.texWeight || '—',
    phaseType:    bd.phaseType || '—',
    category:     bd.category  || '—',
    phaseCompat:  _phaseCompat(p, bd.phaseType || ''),
  });

  // Rotation & tier ─────────────────────────────────────────────────────────
  const tierStr = bd.inTier
    ? `yes — within top-${bd.tierGap}pt window`
    : `no  — ${sgn((entry.score||0) - (bd.topScore||0))} from top`;
  console.log('%cRotation & tier', 'font-weight:bold', {
    rotPen:      sgn(bd.rotPen),
    recentDays:  bd.recentDays || 0,
    inTier:      tierStr,
    tierGap:     bd.tierGap,
    tierRank:    `${bd.tierRank != null ? bd.tierRank + 1 : '?'} / ${bd.totalCandidates || '?'}`,
    dayIndex:    bd.dayIndex,
    varietySeed: bd.varietySeed,
  });

  console.groupEnd();
}

// ─── Dev console API ─────────────────────────────────────────────────────────
// All functions below are dev-only utilities. They are no-ops or no-output
// when debug is off, and are never referenced by the normal UI code path.

// Print a formatted scoring table grouped by day/slot.
// Call from DevTools after generating a routine with debug enabled.
// eslint-disable-next-line no-unused-vars
function _gpDebugReport() {
  const log = window._gpScoreLog || [];
  if (!log.length) {
    console.log('%c[GlowPhase Debug] No score log — generate a routine first (with window._gpDebug = true).', 'color:#c62828');
    return;
  }
  console.log(`%c[GlowPhase Debug] Score report — ${log.length} scored entries`, 'font-size:13px;font-weight:bold;color:#880e4f');

  // Group by dayIndex + phaseType + category
  const groups = {};
  log.forEach(e => {
    const bd  = e.breakdown || {};
    const key = `day=${bd.dayIndex??'?'} | phase=${bd.phaseType||'?'} | cat=${bd.category||'?'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  Object.entries(groups).forEach(([key, entries]) => {
    const sel = entries.find(e => e.selected);
    const picked = sel ? `${(sel.product||{}).brand||''} ${(sel.product||{}).name||'?'}`.trim() : 'none';
    console.groupCollapsed(`%c${key}  →  picked: ${picked}`, 'font-weight:bold;color:#1565c0');

    const sgn = v => (v == null ? '—' : (v>=0?'+':'')+v);
    const rows = entries.map(e => {
      const p  = e.product  || {};
      const bd = e.breakdown || {};
      return {
        '':                 e.selected ? '✅' : ((bd.safetyScore||0) <= -6 ? '🚫' : ''),
        'brand + name':     `${p.brand||''} ${p.name||'?'}`.trim(),
        'total':            sgn(e.score),
        'user':             sgn(bd.userScore),
        'phase':            sgn(bd.phaseScore),
        'rot':              sgn(bd.rotPen),
        'safety':           sgn(bd.safetyScore),
        'intensity':        sgn(bd.intensityScore),
        'phaseBase':        sgn(bd.phaseBaseScore),
        'complexity':       sgn(bd.complexityPen),
        'funcRole':         bd.role || '—',
        'texWeight':        bd.texWeight || '—',
        'functionTags':     (p.functionTags||[]).join(', ')||'—',
        'safetyTags':       (p.safetyTags||[]).join(', ')||'—',
        'retinoidInt':      p.retinoidIntensity    || '—',
        'exfInt':           p.exfoliationIntensity || '—',
        'phaseCompat':      _phaseCompat(p, bd.phaseType||''),
        'inTier':           bd.inTier ? '✔' : '',
        'tierRank':         bd.tierRank != null ? bd.tierRank + 1 : '—',
        'recentDays':       bd.recentDays || 0,
      };
    });
    console.table(rows);
    console.groupEnd();
  });

  // Summary footer
  const picked  = log.filter(e => e.selected).length;
  const gated   = log.filter(e => (e.breakdown||{}).safetyScore <= -6).length;
  const skipped = log.filter(e => !e.selected && !e.safetyFiltered).length;
  console.log(`%cSummary: ${picked} selected, ${gated} safety-filtered 🚫, ${skipped} scored-out ⬜`, 'color:#555');
}

// Print usage guide for the debug console API.
// eslint-disable-next-line no-unused-vars
function _gpDebugHelp() {
  console.log('%c[GlowPhase Debug API]', 'font-size:13px;font-weight:bold;color:#880e4f');
  /* eslint-disable no-console */
  console.log([
    '',
    '  ENABLE / DISABLE',
    '  ─────────────────────────────────────────────────────',
    '  window._gpDebug = true          (session only)',
    '  localStorage.setItem("gpDebug","1")   (persistent)',
    '  window._gpDebug = false         (disable session)',
    '  localStorage.removeItem("gpDebug")    (clear persist)',
    '',
    '  AFTER GENERATING A ROUTINE',
    '  ─────────────────────────────────────────────────────',
    '  _gpDebugReport()           pretty table grouped by day/slot',
    '  _gpScoreLog                raw array of all scored entries',
    '  _gpScoreLog.filter(e=>e.selected)              picked products only',
    '  _gpScoreLog.filter(e=>(e.breakdown?.safetyScore??0)<=-6)  gated products',
    '',
    '  UTILITIES',
    '  ─────────────────────────────────────────────────────',
    '  _gpResetRotation()         wipe rotation memory → force fresh picks',
    '  _gpDebugClear()            clear _gpScoreLog without re-generating',
    '',
    '  SCORE PRIORITY ORDER',
    '  ─────────────────────────────────────────────────────',
    '  1. Safety tags        _safetyTagScore        -8 to +3',
    '  2. Active intensity   _activeIntensityScore  -10 to 0',
    '  3. Concern match      scoreProductForUser    ingredient + functionTag bonuses',
    '  4. Function tags      _functionTagScore      +1 to +3 per goal match',
    '  5. Phase match        scoreProductForPhase   phase-type bonuses',
    '  6. Finish/texture     _finishTagBonus        ±1 per preference match',
    '  7. Complexity         _complexityPenalty     barrier × sens condition',
    '  8. Day context        conflict + dupRole + texOrder penalties',
    '  9. Rotation           _gpRotPenalty          0 to -5 by recency',
    '',
    '  SAFETY FLAGS (automatic score gates)',
    '  ─────────────────────────────────────────────────────',
    '  avoid-damaged-barrier → -8 in recovery/barrier phases',
    '  not-device-safe       → -8 in device phase',
    '  avoid-damaged-barrier → -4 for sensitive/weak skin in any phase',
    '',
  ].join('\n'));
  /* eslint-enable no-console */
}

// Clear the score log (does not regenerate the routine).
// eslint-disable-next-line no-unused-vars
function _gpDebugClear() {
  window._gpScoreLog = [];
  console.log('%c[GlowPhase] Score log cleared.', 'color:#555');
}

// Wipe rotation memory so the engine picks as if the user has no history.
// Useful when testing variety logic.
// eslint-disable-next-line no-unused-vars
function _gpResetRotation() {
  try {
    localStorage.removeItem(_GP_ROT_KEY);
    console.log('%c[GlowPhase] Rotation memory cleared — regenerate your routine to see fresh picks.', 'color:#555');
  } catch(e) { /* no-op */ }
}

// ─── Texture weight ───────────────────────────────────────────────────────────
// Returns a texture weight 1 (most watery) → 5 (most occlusive).
// Used to detect light-over-heavy layering violations (routine goes lightest → heaviest).
function _texWeight(p) {
  if (!p) return 3;
  // ── Tag-based: use explicit texture tags when populated ──────────────────
  const txTags = Array.isArray(p.texture) ? p.texture : [];
  if (txTags.length) {
    if (txTags.includes('occlusive'))                                    return 5;
    if (txTags.includes('rich'))                                         return 4.5;
    if (txTags.includes('sticky'))                                       return 4;
    if (txTags.includes('medium-weight'))                                return 3.5;
    if (txTags.includes('gel'))                                          return 3;
    if (txTags.includes('milky'))                                        return 2.5;
    if (txTags.includes('lightweight') || txTags.includes('fast-absorbing')) return 2;
    if (txTags.includes('watery'))                                       return 1;
  }
  // ── Heuristic fallback (for products without texture tags) ───────────────
  const tx = ((p.name || '') + ' ' + (p.description || '') + ' ' + (p.subcategory || '')).toLowerCase();
  const cat = normalizedCategory(p);
  if (/mist|spray|setting spray/.test(tx) || cat === 'mist') return 1;
  if (cat === 'toner' || cat === 'essence') return 2;
  if (/toner|essence|lotion\b/.test(tx)) return 2;
  if (cat === 'serum' || /serum|ampoule|ampule|booster/.test(tx)) return 3;
  if (/lotion|emulsion|fluid/.test(tx)) return 3;
  if (cat === 'moisturizer' || /cream|moisturizer|moisturiser/.test(tx)) return 4;
  if (/balm|butter|ointment|occlusive|\boil\b|sleeping.?mask|sleeping.?pack/.test(tx)) return 5;
  return 3;
}

// ─── Function role ────────────────────────────────────────────────────────────
// Returns the primary functional role of a product as a string.
// Centralises the role-detection logic previously duplicated inside selectBestForDay().
function _funcRole(p) {
  if (!p) return 'general';
  // ── Tag-based: functionTags → unambiguous role when present ─────────────
  const fTags = Array.isArray(p.functionTags) ? p.functionTags : [];
  if (fTags.includes('barrier support'))      return 'barrier_lipid';
  if (fTags.includes('calming') || fTags.includes('redness support')) return 'calming';
  if (fTags.includes('hydration support'))    return 'deep_hydration';
  if (fTags.includes('elasticity support') || fTags.includes('firming')) return 'peptide';
  if (fTags.includes('glow support'))         return 'vitamin_c';
  if (fTags.includes('overnight repair'))     return 'renewal';
  // pore care, acne-safe, makeup prep, recovery safe, device recovery safe → ingredient fallback
  // (these are modifier tags, not primary role selectors)
  // ── Ingredient fallback (for products without relevant functionTags) ─────
  const tx = ((p.ingredients || '') + ' ' + (p.activeIngredients || []).join(' ') + ' ' + (p.description || '') + ' ' + (p.name || '')).toLowerCase();
  if (/peptide|matrixyl|palmitoyl|argireline|copper.?peptide|oligopeptide/.test(tx)) return 'peptide';
  if (/niacinamide|vitamin.?b3/.test(tx))                                             return 'niacinamide';
  if (/vitamin.?c|ascorbic|ascorbyl|magnesium.?ascorbyl/.test(tx))                  return 'vitamin_c';
  if (/ceramide|squalane|fatty.?acid|cholesterol|linoleic/.test(tx))                return 'barrier_lipid';
  if (/centella|cica|madecassoside|panthenol|beta.?glucan|mugwort|heartleaf/.test(tx)) return 'calming';
  if (/hyaluronic|sodium.?hyaluronate|polyglutamic|tremella/.test(tx))              return 'deep_hydration';
  if (/adenosine|egf|growth.?factor|bakuchiol/.test(tx))                            return 'renewal';
  if (/salicylic|bha|beta.?hydroxy/.test(tx))                                       return 'bha_exfoliant';
  if (/glycolic|lactic|mandelic|\baha\b|alpha.?hydroxy/.test(tx))                   return 'aha_exfoliant';
  if (/retinol|retinal|retinoid|tretinoin/.test(tx))                                return 'retinoid';
  return 'general';
}

// ─── Ingredient conflict penalty ──────────────────────────────────────────────
// Returns a scoring penalty when two products would create a known ingredient conflict.
// Penalises probability rather than hard-blocking (hard blocks are in renderPhase logic).
function _ingredientConflictPenalty(pA, pB) {
  if (!pA || !pB) return 0;
  const txA = ((pA.ingredients || '') + ' ' + (pA.activeIngredients || []).join(' ')).toLowerCase();
  const txB = ((pB.ingredients || '') + ' ' + (pB.activeIngredients || []).join(' ')).toLowerCase();
  let pen = 0;
  const hasVitC = tx => /l-ascorbic|ethyl ascorbic|ascorbyl/.test(tx) && !/magnesium.?ascorbyl.?phosphate/.test(tx);
  const hasNiac = tx => /niacinamide/.test(tx);
  const hasAHA  = tx => /glycolic|lactic|mandelic|\baha\b/.test(tx);
  const hasBHA  = tx => /salicylic/.test(tx);
  const hasRet  = tx => /retinol|retinal|tretinoin/.test(tx);
  // Vitamin C (pure) + niacinamide: mild, debated conflict
  if ((hasVitC(txA) && hasNiac(txB)) || (hasVitC(txB) && hasNiac(txA))) pen -= 2;
  // AHA/BHA + retinoid: pH/irritation stacking
  if ((hasAHA(txA) || hasBHA(txA)) && hasRet(txB)) pen -= 4;
  if ((hasAHA(txB) || hasBHA(txB)) && hasRet(txA)) pen -= 4;
  // Double exfoliant (AHA + BHA or same type × 2 serums)
  if ((hasAHA(txA) || hasBHA(txA)) && (hasAHA(txB) || hasBHA(txB))) pen -= 3;
  // Vitamin C + AHA/BHA: pH competition
  if (hasVitC(txA) && (hasAHA(txB) || hasBHA(txB))) pen -= 2;
  if (hasVitC(txB) && (hasAHA(txA) || hasBHA(txA))) pen -= 2;
  return pen;
}
// Aggregate ingredient conflict penalty: candidate p vs all already-selected day products.
function _dayConflictPenalty(p, alreadySelected) {
  if (!alreadySelected || !alreadySelected.length) return 0;
  return alreadySelected.reduce((sum, sel) => sum + _ingredientConflictPenalty(p, sel), 0);
}

// ─── Duplicate function penalty ───────────────────────────────────────────────
// Penalises adding a product whose primary functional role is already covered by
// another product selected for the same day. Stackable roles (general/calming/hydration)
// are exempt because layering multiple hydrating or calming products is harmless.
const _STACKABLE_ROLES = new Set(['general', 'calming', 'deep_hydration']);
function _dupFuncPenalty(p, alreadySelected) {
  if (!alreadySelected || !alreadySelected.length) return 0;
  const role = _funcRole(p);
  if (_STACKABLE_ROLES.has(role)) return 0;
  const overlaps = alreadySelected.filter(sel => _funcRole(sel) === role).length;
  if (overlaps === 0) return 0;
  return overlaps === 1 ? -2 : -4;
}

// ─── Texture layer penalty ────────────────────────────────────────────────────
// Penalises selecting a lighter product when a significantly heavier product is
// already slotted for the same day (heavier products should go on last).
function _texLayerPenalty(p, alreadySelected) {
  if (!alreadySelected || !alreadySelected.length) return 0;
  const myWeight = _texWeight(p);
  let pen = 0;
  alreadySelected.forEach(sel => {
    // If an already-selected product is 2+ weights heavier, it would wrongly precede this lighter one
    if (_texWeight(sel) - myWeight >= 2) pen -= 2;
  });
  return pen;
}

// ─── Complexity penalty ───────────────────────────────────────────────────────
// Reduces score for products that add inappropriate complexity given phase type
// and the user's skin condition — reinforces safe routine construction.
function _complexityPenalty(p, phaseType, a) {
  if (!p || !a) return 0;
  let pen = 0;
  const ing = ((p.ingredients || '') + ' ' + (p.activeIngredients || []).join(' ')).toLowerCase();
  const isRec  = phaseType === 'recovery' || phaseType === 'barrier';
  const isSens = a.sensitivity === t('o_high') || (a.skinTypes || []).some(s => s === t('o_sensitive'));
  const isWeak = a.barrierCondition === t('o_very_damaged') || a.barrierCondition === t('o_slightly');
  if (isRec) {
    // Anti-double-count: skip binary penalty when _activeIntensityScore will handle it via tag
    if (!p.exfoliationIntensity && hasExfoliantAcid(p)) pen -= 5;
    if (!p.retinoidIntensity    && hasRetinoid(p))      pen -= 5;
    if (hasStrongVitaminC(p))                           pen -= 3;
  }
  // Skip binary exfoliant/retinoid penalties for sens+weak when tags will score instead
  if (isSens && isWeak && hasStrongVitaminC(p))                                               pen -= 3;
  if ((isSens || isWeak) && /denatured alcohol|alcohol denat/.test(ing))                      pen -= 3;
  if (isSens && /\bfragrance\b|\bparfum\b/.test(ing) && !/fragrance.?free/.test(ing))        pen -= 2;
  return pen;
}

// ─── Safety tag score ─────────────────────────────────────────────────────────
// Priority 1 — safety violations dominate all other signals.
// Returns large negatives when a product is unsafe for current skin state,
// and small positives when it is explicitly safe/beneficial.
function _safetyTagScore(p, phaseType, a) {
  if (!p) return 0;
  const sTags = Array.isArray(p.safetyTags) ? p.safetyTags : [];
  if (!sTags.length) return 0;
  let s = 0;
  const isRec    = phaseType === 'recovery' || phaseType === 'barrier';
  const isSens   = a && (a.sensitivity === t('o_high') || (a.skinTypes || []).some(st => st === t('o_sensitive')));
  const isWeak   = a && (a.barrierCondition === t('o_very_damaged') || a.barrierCondition === t('o_slightly'));
  const isDevice = phaseType === 'device';

  // Hard-negative: product explicitly marked as not safe for current condition
  if (isRec   && sTags.includes('avoid-damaged-barrier')) s -= 8;
  if (isDevice && sTags.includes('not-device-safe'))      s -= 8;
  if ((isSens || isWeak) && sTags.includes('avoid-damaged-barrier')) s -= 4;

  // Positive: product is explicitly safe/beneficial for current state
  if (isRec  && sTags.includes('recovery-safe'))          s += 3;
  if (isRec  && sTags.includes('device recovery safe'))   s += 2;  // via functionTags mirror
  if ((isSens || isWeak) && sTags.includes('sensitive-skin-safe')) s += 2;
  if (isDevice && !sTags.includes('not-device-safe'))     s += 1;  // implicitly device-compatible

  return s;
}

// ─── Active intensity score ───────────────────────────────────────────────────
// Priority 2 — graduated penalty replacing binary hasRetinoid/hasExfoliantAcid checks.
// Only fires when p.retinoidIntensity or p.exfoliationIntensity tags are present;
// falls back to _complexityPenalty's binary checks otherwise (anti-double-count).
function _activeIntensityScore(p, phaseType, a) {
  if (!p) return 0;
  const isRec  = phaseType === 'recovery' || phaseType === 'barrier';
  const isSens = a && (a.sensitivity === t('o_high') || (a.skinTypes || []).some(st => st === t('o_sensitive')));
  const isWeak = a && (a.barrierCondition === t('o_very_damaged') || a.barrierCondition === t('o_slightly'));
  let s = 0;

  // Retinoid intensity — only fires when tag is present
  if (p.retinoidIntensity) {
    if (isRec) {
      if (p.retinoidIntensity === 'advanced retinoid') s -= 10;
      else if (p.retinoidIntensity === 'moderate retinoid') s -= 7;
      else /* beginner */ s -= 4;
    } else if (isSens || isWeak) {
      if (p.retinoidIntensity === 'advanced retinoid') s -= 5;
      else if (p.retinoidIntensity === 'moderate retinoid') s -= 2;
      // beginner retinoid: no penalty for sens/weak
    }
  }

  // Exfoliation intensity — only fires when tag is present
  if (p.exfoliationIntensity) {
    if (isRec) {
      if (p.exfoliationIntensity === 'aggressive exfoliant') s -= 10;
      else if (p.exfoliationIntensity === 'moderate exfoliant') s -= 7;
      else /* gentle */  s -= 3;
    } else if (isSens || isWeak) {
      if (p.exfoliationIntensity === 'aggressive exfoliant') s -= 6;
      else if (p.exfoliationIntensity === 'moderate exfoliant') s -= 3;
      // gentle exfoliant: no penalty for sens/weak
    }
  }

  return s;
}

// ─── Function tag score ───────────────────────────────────────────────────────
// Priority 3 — personalization bonus: match product function tags to user goals.
// Rewards products whose declared functions align with what the user is trying to achieve.
function _functionTagScore(p, a) {
  if (!p || !a) return 0;
  const fTags = Array.isArray(p.functionTags) ? p.functionTags : [];
  if (!fTags.length) return 0;
  const goals     = a.goals || [];
  const skinTypes = a.skinTypes || [];
  const isSens    = a.sensitivity === t('o_high') || skinTypes.some(s => s === t('o_sensitive'));
  const isWeak    = a.barrierCondition === t('o_very_damaged') || a.barrierCondition === t('o_slightly');
  let s = 0;

  // Map user goals → relevant functionTags
  if (goals.includes(t('g_barrier')) || skinTypes.includes(t('o_barrier')) || isWeak) {
    if (fTags.includes('barrier support')) s += 3;
    if (fTags.includes('recovery safe'))   s += 2;
  }
  if (goals.includes(t('g_calm')) || isSens) {
    if (fTags.includes('calming'))         s += 3;
    if (fTags.includes('redness support')) s += 2;
  }
  if (goals.includes(t('g_hydration')) || skinTypes.includes(t('o_dehydrated'))) {
    if (fTags.includes('hydration support')) s += 2;
  }
  if (goals.includes(t('g_glow')) || goals.includes(t('g_glass'))) {
    if (fTags.includes('glow support'))    s += 2;
    if (fTags.includes('makeup prep'))     s += 1;
  }
  if (goals.includes(t('g_acne')) || skinTypes.includes(t('o_acneprone'))) {
    if (fTags.includes('acne-safe'))       s += 2;
    if (fTags.includes('pore care'))       s += 2;
  }
  if (goals.includes(t('g_elasticity'))) {
    if (fTags.includes('elasticity support')) s += 3;
    if (fTags.includes('firming'))            s += 2;
    if (fTags.includes('overnight repair'))   s += 1;
  }
  if (goals.includes(t('g_texture'))) {
    if (fTags.includes('pore care'))       s += 2;
    if (fTags.includes('glow support'))    s += 1;
  }

  return s;
}

// ─── Finish tag bonus ─────────────────────────────────────────────────────────
// Priority 5 — texture/finish preference: reward finishes that match skin type + goals.
function _finishTagBonus(p, a) {
  if (!p || !a) return 0;
  const finTags = Array.isArray(p.finish) ? p.finish : [];
  if (!finTags.length) return 0;
  const goals     = a.goals || [];
  const skinTypes = a.skinTypes || [];
  let s = 0;

  // Oily/combo/acne-prone → prefer matte/satin
  if (skinTypes.some(st => st === t('o_oily') || st === t('o_acneprone') || st === t('o_combo'))) {
    if (finTags.includes('matte'))  s += 1;
    if (finTags.includes('satin')) s += 1;
    if (finTags.includes('glowy') || finTags.includes('dewy')) s -= 1;
  }
  // Dry/mature → prefer dewy/glowy
  if (skinTypes.some(st => st === t('o_dry') || st === t('o_mature'))) {
    if (finTags.includes('dewy') || finTags.includes('glowy')) s += 1;
  }
  // Glow/glass goals → reward glowy/dewy/glass-skin
  if (goals.includes(t('g_glow')) || goals.includes(t('g_glass'))) {
    if (finTags.includes('glass-skin')) s += 2;
    if (finTags.includes('glowy'))      s += 1;
    if (finTags.includes('dewy'))       s += 1;
  }
  // Makeup prep flag + finish
  if (p.makeupPrep && finTags.includes('satin')) s += 1;

  return s;
}

// Score a product's fitness against user answers — higher = better match for their goals/skin.
// Enhanced: more granular concern matching, description bonuses, texture fit, phase goal bonuses.
function scoreProductForUser(p, a) {
  if (!p || !a) return 0;
  let score = 0;
  const goals    = a.goals || [];
  const skinTypes = a.skinTypes || [];
  const ing  = ((p.ingredients || '') + ' ' + (p.activeIngredients || []).join(' ')).toLowerCase();
  const _desc = (p.description || '').toLowerCase();

  // ── Skin concern scoring ──────────────────────────────────────────────────
  if (goals.includes(t('g_barrier')) || skinTypes.includes(t('o_barrier'))) {
    if (/ceramide|madecassoside|madecassic|centella|cica|panthenol|beta.?glucan|squalane|snail|mucin|oat/.test(ing)) score += 3;
    if (/barrier|repair|shield|strengthen/.test(_desc)) score += 1;
  }
  if (goals.includes(t('g_hydration')) || skinTypes.includes(t('o_dehydrated'))) {
    if (/hyaluronic|sodium hyaluronate|glycerin|beta.?glucan|polyglutamic|aloe/.test(ing)) score += 2;
    if (/hydrat|moisture|plump/.test(_desc)) score += 1;
  }
  if (goals.includes(t('g_calm'))) {
    if (hasCalmingIngredient(p)) score += 3;
    if (/calm|sooth|redness|sensitiv/.test(_desc)) score += 1;
  }
  if (goals.includes(t('g_pih')) || goals.includes(t('g_hyperpig'))) {
    if (/niacinamide/.test(ing))                                         score += 3;
    if (/vitamin.?c|ascorbic|arbutin|tranexamic|kojic/.test(ing))       score += 2;
    if (/bright|fade|dark spot|pigment/.test(_desc))                     score += 1;
  }
  if (goals.includes(t('g_acne')) || skinTypes.includes(t('o_acneprone'))) {
    if (/niacinamide/.test(ing))             score += 2;
    if (/salicylic|centella|cica/.test(ing)) score += 2;
    if (/acne|blemish|pore/.test(_desc))     score += 1;
  }
  if (goals.includes(t('g_elasticity'))) {
    if (/peptide|adenosine|egf|growth factor/.test(ing))  score += 3;
    if (/collagen|firm|lift|elasticit/.test(ing))         score += 2;
    if (/firm|lift|anti.?ag(e|ing)/.test(_desc))          score += 1;
  }
  if (goals.includes(t('g_glow')) || goals.includes(t('g_glass'))) {
    if (/niacinamide|galactomyces|vitamin.?c|ascorbic/.test(ing)) score += 2;
    if (/glow|radianc|glass|luminous/.test(_desc))                score += 1;
  }
  if (goals.includes(t('g_texture'))) {
    if (/niacinamide|pha|polyhydroxy/.test(ing)) score += 2;
    if (/texture|smooth|pore|refin/.test(_desc)) score += 1;
  }

  // ── Barrier condition safety ───────────────────────────────────────────────
  if (a.barrierCondition === t('o_very_damaged') || a.barrierCondition === t('o_slightly') || a.sensitivity === t('o_high')) {
    if (isBarrierSafeProduct(p))  score += 2;
    if (hasCalmingIngredient(p))  score += 1;
    // Anti-double-count: skip binary penalties when intensity tags will score via _activeIntensityScore
    if (!p.exfoliationIntensity && hasExfoliantAcid(p)) score -= 4;
    if (!p.retinoidIntensity    && hasRetinoid(p))      score -= 3;
    if (hasStrongVitaminC(p))     score -= 2;
  }
  if (goals.includes(t('g_barrier')) || skinTypes.includes(t('o_barrier')) || a.barrierCondition === t('o_slightly') || a.barrierCondition === t('o_very_damaged')) {
    if (isBarrierSupportProduct(p)) score += 2;
  }

  // ── Function tags + finish bonus (tag-based personalization) ──────────────
  score += _functionTagScore(p, a);
  score += _finishTagBonus(p, a);

  // ── Skin type texture match ────────────────────────────────────────────────
  const _st = skinTypes;
  if (_st.some(s => s === t('o_oily') || s === t('o_acneprone') || s === t('o_combo'))) {
    if (/gel|lightweight|light weight|oil.?free|water.?based|watery|fluid|matte/.test(_desc)) score += 2;
    if (/rich|heavy|occlusive|thick|balm|butter|ointment|intensive/.test(_desc))              score -= 1;
  }
  if (_st.some(s => s === t('o_dry'))) {
    if (/rich|cream|intensive|nourishing|barrier|occlusive|thick/.test(_desc)) score += 2;
    if (/gel|oil.?free|watery/.test(_desc))                                    score -= 1;
  }
  if (_st.some(s => s === t('o_sensitive')) || a.sensitivity === t('o_high')) {
    if (/fragrance.?free|unscented|gentle|soothing|calming/.test(_desc))                   score += 2;
    if (/fragrance|parfum/.test(ing) && !/fragrance.?free/.test(ing))                      score -= 2;
    if (/denatured alcohol|alcohol denat/.test(ing))                                        score -= 2;
  }
  if (_st.some(s => s === t('o_mature'))) {
    if (/peptide|adenosine|collagen|egf|growth factor|bakuchiol/.test(ing)) score += 2;
    if (/anti.?ag(e|ing)|firm|lift/.test(_desc))                            score += 1;
  }

  // ── Ownership bonus ────────────────────────────────────────────────────────
  // All candidates passed to selectBestForDay() are owned products; this +1 marks
  // them as "user owns" vs catalogue in debug score breakdowns.
  score += 1;

  return score;
}

// Score bonus for a product's fitness to a specific phase type and product category.
// Now accepts optional _dayContext = { alreadySelected: [] } for day-level penalties
// (ingredient conflicts, duplicate functions, texture order violations).
// phaseType: 'recovery' | 'barrier' | 'active' | 'device' | 'normal'
// category:  'toner' | 'essence' | 'serum'
function scoreProductForPhase(p, phaseType, category, a, _dayContext) {
  if (!p) return 0;
  let s = 0;
  const ing    = ((p.ingredients || '') + ' ' + (p.activeIngredients || []).join(' ')).toLowerCase();
  const already = (_dayContext && _dayContext.alreadySelected) || [];
  const fTags  = Array.isArray(p.functionTags) ? p.functionTags : [];

  // ── Priority 1: Safety tag score (dominates — large negatives override everything) ─
  s += _safetyTagScore(p, phaseType, a);

  // ── Priority 2: Active intensity score (graduated; anti-double-counts _complexityPenalty) ─
  s += _activeIntensityScore(p, phaseType, a);

  if (phaseType === 'recovery' || phaseType === 'barrier') {
    // Recovery / barrier repair: strongly prefer calming, barrier-safe products
    if (isBarrierSafeProduct(p))    s += 3;
    if (hasCalmingIngredient(p))    s += 2;
    if (isBarrierSupportProduct(p)) s += 2;
    // functionTag bonuses for recovery phase
    if (fTags.includes('recovery safe'))          s += 3;
    if (fTags.includes('barrier support'))        s += 2;
    if (fTags.includes('calming'))                s += 2;
    if (fTags.includes('redness support'))        s += 1;
    if (fTags.includes('overnight repair'))       s += 1;
    if (fTags.includes('device recovery safe'))   s += 1;
    if (category === 'serum') {
      if (!p.daytimeOnly)           s += 1;
      if (isNightSuitableSerum(p))  s += 2;
    }
    // Binary ingredient penalties only when NO intensity tag (anti-double-count)
    if (!p.exfoliationIntensity && hasExfoliantAcid(p)) s -= 6;
    if (!p.retinoidIntensity    && hasRetinoid(p))      s -= 6;
    if (hasStrongVitaminC(p)) s -= 3;
  } else if (phaseType === 'active') {
    // Active nights: pair with calming, barrier-supporting layers
    if (hasCalmingIngredient(p))    s += 2;
    if (isBarrierSafeProduct(p))    s += 2;
    // functionTag bonuses for active phase (supporting cast)
    if (fTags.includes('calming'))              s += 2;
    if (fTags.includes('barrier support'))      s += 1;
    if (fTags.includes('hydration support'))    s += 1;
    if (category === 'serum') {
      if (!p.daytimeOnly)           s += 1;
      if (isNightSuitableSerum(p))  s += 2;
    }
    // Avoid stacking extra actives — binary penalty only when no intensity tag
    if (!p.exfoliationIntensity && hasExfoliantAcid(p)) s -= 4;
  } else if (phaseType === 'device') {
    // Device nights: hydration-boosting ingredients work best with device amplification
    if (/hyaluronic|sodium hyaluronate|glycerin|beta.?glucan|polyglutamic/.test(ing)) s += 2;
    if (hasCalmingIngredient(p))    s += 1;
    // functionTag bonuses for device phase
    if (fTags.includes('hydration support'))    s += 2;
    if (fTags.includes('device recovery safe')) s += 2;
    if (fTags.includes('calming'))              s += 1;
    if (fTags.includes('barrier support'))      s += 1;
    if (category === 'serum') {
      if (!p.daytimeOnly)           s += 1;
      if (isNightSuitableSerum(p))  s += 1;
    }
  } else {
    // Normal nights: light preference for calming and night-suitable layers
    if (hasCalmingIngredient(p))    s += 1;
    if (fTags.includes('overnight repair'))  s += 1;
    if (fTags.includes('hydration support')) s += 1;
    if (category === 'serum') {
      if (!p.daytimeOnly)           s += 1;
      if (isNightSuitableSerum(p))  s += 1;
    }
  }

  // Day-context-aware penalties (only applied when sibling products for the same day are known)
  if (already.length) {
    s += _dayConflictPenalty(p, already);
    s += _dupFuncPenalty(p, already);
    s += _texLayerPenalty(p, already);
  }
  // Complexity penalty (phase × skin condition — defers to intensity tags via anti-double-count)
  s += _complexityPenalty(p, phaseType, a);

  return s;
}

// Select the best product for a specific day with ingredient-role diversity rotation.
// — Scores each candidate by goal-fit + phase-fit + day-context penalties.
// — Rotation memory penalty discourages using the same product every night.
// — Week-seed ensures Monday's pick varies week-to-week (not just day-to-day).
// — Tier window: narrow (2 pts) for recovery/barrier/active; wider (4 pts) for normal/device.
// — Within tier, products are interleaved by functional role, shifted by varietySeed.
// — Debug: full breakdown logged to window._gpScoreLog when _gpDebug is truthy.
function selectBestForDay(candidates, a, dayIndex, phaseType, category, _dayContext) {
  if (!candidates || !candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const rot = _gpRotLoad();
  // weekSeed changes every 7 days; varietySeed shifts role-rotation start weekly per day-slot
  const weekSeed    = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const varietySeed = (weekSeed ^ (dayIndex * 31)) & 0xff;

  const scored = candidates.map(p => {
    const userScore  = scoreProductForUser(p, a);
    const phaseScore = scoreProductForPhase(p, phaseType, category, a, _dayContext);
    const rotPen     = _gpRotPenalty(p, rot);
    return { p, s: userScore + phaseScore + rotPen, userScore, phaseScore, rotPen };
  }).sort((x, y) => y.s - x.s);

  const topScore = scored[0].s;
  const tierGap  = (phaseType === 'recovery' || phaseType === 'barrier' || phaseType === 'active') ? 2 : 4;
  const tier     = scored.filter(x => x.s >= topScore - tierGap);

  // Role order list — varietySeed offsets the start position each week so the same role
  // does not always land on Monday. Products rotate through roles Mon → Sun.
  const _roleList = ['peptide','niacinamide','vitamin_c','barrier_lipid','calming','deep_hydration','renewal','bha_exfoliant','aha_exfoliant','retinoid','general'];
  const _roleOrder = r => { const i = _roleList.indexOf(r); return i === -1 ? _roleList.length : i; };

  const byRole = [...tier].sort((x, y) => {
    const rx = (_roleOrder(_funcRole(x.p)) + varietySeed) % (_roleList.length + 1);
    const ry = (_roleOrder(_funcRole(y.p)) + varietySeed) % (_roleList.length + 1);
    const rd = rx - ry;
    return rd !== 0 ? rd : y.s - x.s;
  });

  const pick = byRole[dayIndex % byRole.length].p;

  // Debug logging — DEV ONLY, zero cost when disabled
  if (_gpDebugOn()) {
    const _dbgAlready = (_dayContext && _dayContext.alreadySelected) || [];
    const _dbgToday   = Math.floor(Date.now() / 86400000);
    scored.forEach(({ p, s, userScore, phaseScore, rotPen }) => {
      const chosen         = p === pick;
      const inTier         = s >= topScore - tierGap;
      const tierRank       = inTier ? byRole.findIndex(x => x.p === p) : -1;
      const safetyScore    = _safetyTagScore(p, phaseType, a);
      const intensityScore = _activeIntensityScore(p, phaseType, a);
      const complexityPen  = _complexityPenalty(p, phaseType, a);
      const dayConflict    = _dbgAlready.length ? _dayConflictPenalty(p, _dbgAlready) : 0;
      const dupFunc        = _dbgAlready.length ? _dupFuncPenalty(p, _dbgAlready)     : 0;
      const texLayer       = _dbgAlready.length ? _texLayerPenalty(p, _dbgAlready)    : 0;
      const phaseBaseScore = phaseScore - safetyScore - intensityScore - complexityPen - dayConflict - dupFunc - texLayer;
      const _rotEntry      = rot[p.id];
      const recentDays     = _rotEntry ? (_rotEntry.days || []).filter(d => _dbgToday - d < 7).length : 0;
      let reason;
      if (chosen) {
        reason = `✅ selected — role=${_funcRole(p)}, tierRank=${tierRank}, dayIndex=${dayIndex}, varietySeed=${varietySeed}`;
      } else if (safetyScore <= -8 || intensityScore <= -8) {
        reason = `🚫 safety-filtered — safetyScore=${safetyScore}, intensityScore=${intensityScore}`;
      } else if (!inTier) {
        reason = `❌ below tier — score=${s}, top=${topScore}, gap=${tierGap}`;
      } else {
        reason = `⏭ in tier, not chosen this day — role=${_funcRole(p)}, tierRank=${tierRank}`;
      }
      _gpDbg({
        product: p,
        score: s,
        selected: chosen,
        breakdown: {
          userScore, phaseScore, rotPen,
          safetyScore, intensityScore, phaseBaseScore,
          complexityPen, dayConflict, dupFunc, texLayer,
          role: _funcRole(p), texWeight: _texWeight(p),
          phaseType, category,
          dayIndex, varietySeed, tierGap,
          tierRank, totalCandidates: scored.length, inTier,
          recentDays, topScore
        },
        reason
      });
    });
  }

  return pick;
}

// Calming/barrier-repair ingredient check — used for smart night serum selection.
// Only counts meaningful barrier markers; excludes common humectants (HA, glycerin, allantoin)
// so daytime glow serums with trace soothing ingredients are NOT counted as "night serums".
function hasCalmingIngredient(p){
  if(!p)return false;
  const text=((p.ingredients||'')+' '+(p.description||'')).toLowerCase();
  return /centella|cica|madecassoside|madecassic|asiaticoside|panthenol|ceramide|beta.?glucan|heartleaf|houttuynia|mugwort|propolis|squalane/.test(text);
}

// Returns false for serums whose primary purpose is daytime glow/makeup-prep
// and that lack meaningful calming/barrier benefit.
// Prevents e.g. ABC Glow Whipped Serum from appearing in barrier or treatment nights.
function isNightSuitableSerum(p){
  if(!p)return false;
  // Explicitly daytime-only products (e.g. glow/makeup-prep serums) must not
  // appear in any evening or night routine phase.
  if(p.daytimeOnly)return false;
  if(p.makeupPrep&&!hasCalmingIngredient(p))return false;
  return true;
}

// Returns true for truly heavy/occlusive moisturizers (petrolatum ointments,
// sleeping packs, thick rich-night creams) — used to prevent over-layering
// with heavy serums on barrier-phase nights.
// Lightweight lotions/gels that happen to contain trace petrolatum are excluded.
function isHeavyMoisturizer(p){
  if(!p)return false;
  // Only moisturizer-class products can be "heavy" — serums, toners, essences,
  // cleansers, and SPFs never qualify regardless of their ingredient list.
  // (Some products list "Petrolatum" under a "Formulated without:" disclaimer,
  //  which would otherwise cause a false positive on the ingredient scan.)
  const cat=normalizedCategory(p);
  if(!['moisturizer','treatment','barrier cream','sleeping mask','sleeping pack'].includes(cat))return false;
  const desc=(p.description||'').toLowerCase();
  // Exclude products whose *description* calls them lightweight / gel-cream / jelly —
  // trace petrolatum in a lightweight lotion does not make it occlusive
  if(/\b(lightweight|light lotion|light cream|gel.?cream|jelly)\b/.test(desc))return false;
  const text=(desc+' '+(p.ingredients||'').toLowerCase());
  return /\b(petrolatum|ointment|sleeping pack|sleeping mask|night pack|night balm)\b/.test(text)
      || /\bthick,?\s*(intensely|deeply|very)\b/.test(text);
}

// Returns true for ampoule-weight serums (explicitly labelled ampoules, or
// growth-factor concentrates) that would feel redundant under a heavy occlusive.
// Deliberately narrow — only products whose *name or description* lead with
// "ampoule" or "growth factor" qualify. Serums that merely contain an oil as
// one ingredient among many do NOT qualify, so lightweight serums stay visible.
function isAmpouleWeightSerum(p){
  if(!p)return false;
  const nameDesc=((p.name||'')+' '+(p.description||'')).toLowerCase();
  return /\bampoule\b/.test(nameDesc)||/\bgrowth.?factor\b/.test(nameDesc);
}

// ═══════════════════════════════════════════════

/* ─── CATEGORY PLACEHOLDER SVG ───────────────────────────────────────────
   Returns a data: URI SVG icon for the given skincare category.
   Used when p.image is absent OR fails to load — never shows broken icon.
   The SVG has a transparent background so container gradients show through. */
function _gph(cat) {
  var c = (cat || '').toLowerCase();
  var col = '#9B7080';  // warm dusty rose — visible on all container backgrounds
  var s = 'stroke="' + col + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  var icon;

  if (/toner/.test(c)) {
    // Water droplet
    icon = '<path ' + s + ' d="M12 4c0 0-5.5 6-5.5 9.5a5.5 5.5 0 0 0 11 0C17.5 10 12 4 12 4z"/>';
  } else if (/serum|ampoule|ampule|vial/.test(c)) {
    // Dropper bottle
    icon = '<rect ' + s + ' x="10" y="3" width="4" height="8" rx="2"/>'
         + '<path ' + s + ' d="M10 11q-2 2-2 4a4 4 0 0 0 8 0q0-2-2-4"/>'
         + '<line ' + s + ' x1="10" y1="6" x2="14" y2="6"/>';
  } else if (/moisturizer|cream|lotion|balm/.test(c)) {
    // Cream jar with lid
    icon = '<rect ' + s + ' x="5" y="10" width="14" height="9" rx="2"/>'
         + '<path ' + s + ' d="M7 10V8a5 5 0 0 1 10 0v2"/>'
         + '<line ' + s + ' x1="8" y1="14" x2="16" y2="14"/>';
  } else if (/sun|spf|sunscreen/.test(c)) {
    // Sun with rays
    icon = '<circle ' + s + ' cx="12" cy="12" r="4"/>'
         + '<line ' + s + ' x1="12" y1="2" x2="12" y2="5"/>'
         + '<line ' + s + ' x1="12" y1="19" x2="12" y2="22"/>'
         + '<line ' + s + ' x1="2" y1="12" x2="5" y2="12"/>'
         + '<line ' + s + ' x1="19" y1="12" x2="22" y2="12"/>'
         + '<line ' + s + ' x1="5.6" y1="5.6" x2="7.8" y2="7.8"/>'
         + '<line ' + s + ' x1="16.2" y1="16.2" x2="18.4" y2="18.4"/>'
         + '<line ' + s + ' x1="5.6" y1="18.4" x2="7.8" y2="16.2"/>'
         + '<line ' + s + ' x1="16.2" y1="7.8" x2="18.4" y2="5.6"/>';
  } else if (/eye/.test(c)) {
    // Eye outline
    icon = '<path ' + s + ' d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/>'
         + '<circle ' + s + ' cx="12" cy="12" r="2.5"/>';
  } else if (/exfoliant|aha|bha|pha|peel|peeling/.test(c)) {
    // Dot sparkle pattern
    icon = '<circle fill="' + col + '" cx="7.5" cy="7.5" r="1.5"/>'
         + '<circle fill="' + col + '" cx="16.5" cy="7.5" r="1.5"/>'
         + '<circle fill="' + col + '" cx="12" cy="12" r="2"/>'
         + '<circle fill="' + col + '" cx="7.5" cy="16.5" r="1.5"/>'
         + '<circle fill="' + col + '" cx="16.5" cy="16.5" r="1.5"/>';
  } else if (/mask|sheet/.test(c)) {
    // Face / sheet mask
    icon = '<rect ' + s + ' x="6" y="3" width="12" height="18" rx="6"/>'
         + '<circle fill="' + col + '" cx="9.5" cy="10" r="1.2"/>'
         + '<circle fill="' + col + '" cx="14.5" cy="10" r="1.2"/>'
         + '<path ' + s + ' d="M9 15q3 2 6 0"/>';
  } else if (/sleeping|sleep|overnight/.test(c)) {
    // Crescent moon
    icon = '<path ' + s + ' d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  } else if (/mist|spray/.test(c)) {
    // Spray mist
    icon = '<path ' + s + ' d="M8 4h6v8H8z" rx="1"/>'
         + '<path ' + s + ' d="M11 12v3"/>'
         + '<line ' + s + ' x1="16" y1="5" x2="18" y2="3"/>'
         + '<line ' + s + ' x1="16" y1="8" x2="19" y2="8"/>'
         + '<line ' + s + ' x1="16" y1="11" x2="18" y2="13"/>'
         + '<circle ' + s + ' cx="11" cy="17" r="2"/>';
  } else if (/cleansing oil|oil clean/.test(c)) {
    // Teardrop (oil)
    icon = '<path ' + s + ' d="M12 3c0 0-6 6.5-6 10.5a6 6 0 0 0 12 0C18 9.5 12 3 12 3z"/>'
         + '<path stroke="' + col + '" stroke-width="1" fill="none" opacity="0.45" d="M10 12.5q1.5-2 4 0"/>';
  } else if (/cleanser|foam|wash/.test(c)) {
    // Foam bubbles
    icon = '<circle ' + s + ' cx="9" cy="15" r="3"/>'
         + '<circle ' + s + ' cx="15" cy="15" r="3"/>'
         + '<circle ' + s + ' cx="12" cy="10" r="3"/>';
  } else if (/essence/.test(c)) {
    // Small round bottle
    icon = '<rect ' + s + ' x="10" y="4" width="4" height="12" rx="2"/>'
         + '<path ' + s + ' d="M9 16q-2 2-2 3h10q0-1-2-3"/>';
  } else if (/lip/.test(c)) {
    // Lips
    icon = '<path ' + s + ' d="M7 10q5-4 10 0 0 6-5 7-5-1-5-7z"/>'
         + '<path ' + s + ' d="M9 10q3 3 6 0"/>';
  } else {
    // Generic bottle (fallback)
    icon = '<path ' + s + ' d="M9 2h6l1 4H8L9 2z"/>'
         + '<rect ' + s + ' x="7" y="6" width="10" height="15" rx="2"/>'
         + '<line ' + s + ' x1="10" y1="11" x2="14" y2="11"/>'
         + '<line ' + s + ' x1="10" y1="14" x2="14" y2="14"/>';
  }

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' + icon + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Single safe accessor for product display icon — used everywhere
// Priority: imageUrl (from Excel) > image (legacy) > icon > SVG placeholder
function prodEmoji(p) {
  if (!p) return '<img src="' + _gph('other') + '" class="prod-img-fallback" alt="">';
  var cat = normalizedCategory(p);
  var imgSrc = p.imageUrl || p.image || null;
  if (imgSrc) {
    // Real product image — lazy load, fall back to category SVG if broken
    return '<img src="' + imgSrc + '" alt="' + (p.name||'').replace(/"/g,'&quot;') + '" class="prod-img-real" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=_gph(\'' + cat + '\');this.className=\'prod-img-fallback\'">';
  }
  if (p.icon) return p.icon;  // explicit emoji icon (e.g. "🌙") — still honoured
  // No image at all — render SVG placeholder directly (never triggers broken icon)
  return '<img src="' + _gph(cat) + '" class="prod-img-fallback" alt="">';
}

'use strict';
/* ═══════════════════════════════════════════════
   TRANSLATIONS (EN / TH)
═══════════════════════════════════════════════ */
const T = {
  en:{
    nav_home:'Home',nav_products:'Products',nav_builder:'Routine Builder',
    nav_myroutine:'My Routine',nav_device:'Device Guide',nav_conflict:'Conflict Checker',nav_emergency:'Emergency',
    home_label:'Your Personalised Skin Journey',
    hero_tagline:'Skin intelligence, beautifully phased.',
    hero_sub:'Personalised routines for sensitive, acne-prone, mature, and barrier-compromised skin. 232 products from 52 worldwide brands, fully analysed.',
    home_sub:'Personalised routines for sensitive, acne-prone, mature, and barrier-compromised skin. Explore worldwide skincare brands, analyse ingredients, and get a science-backed routine made for you.',
    home_features_label:'Everything you need',
    home_journey_eyebrow:'✦ Everything you need ✦',
    home_journey_title:'Your complete <em>skin journey</em>',
    pill_barrier:'🛡 Barrier-First',pill_aging:'✨ Anti-Aging Support',pill_worldwide:'🌍 Worldwide Brands',pill_brands:'🌍 52 Brands · 232 Products',pill_device:'💡 Medicube Booster Pro',pill_ff:'🌿 Fragrance-Free Focus',
    btn_browse:'Browse Products',btn_build:'Build My Routine',
    feat_library:'Product Library',feat_library_desc:'232 products across 52 worldwide brands with full INCI ingredient lists, safety flags, and concern analysis.',
    feat_builder:'Routine Builder',feat_builder_desc:'Quiz-based personalised routine generator with phased skincare schedules and day-by-day protocols.',
    feat_saved:'My Routines',feat_saved_desc:'Save, manage, export, and import your personalised skincare routines across devices.',
    feat_device:'Device Guide',feat_device_desc:'Medicube Booster Pro pairing guide for every phase, mode, and skin type.',
    feat_conflict:'Conflict Checker',feat_conflict_desc:'Check ingredient combinations before using them together on your skin.',
    feat_emergency:'Emergency Routine',feat_emergency_desc:'Instant barrier repair protocol when your skin suddenly flares or reacts.',
    home_disclaimer:'⚠️ Always patch test · Verify ingredient lists on your physical carton · This is a guide, not medical advice',
    library_sub:'232 products · 52 brands worldwide · Full INCI ingredient lists · A–Z by brand',
    notice_db_title:'Demo Database Active.',
    notice_db_body:'To load your own product database, use the import function or provide a JSON/JS data file. Products will automatically populate all sections.',
    filter_category:'Category',filter_concern:'Concern',filter_formula:'Formula',filter_actives:'Active Ingredients',
    btn_reset:'Reset',btn_build_routine:'Build Routine',btn_check_conflicts:'Check Conflicts',btn_clear:'Clear',
    builder_sub:'Answer a few questions, select your products, get a personalised phased routine',
    myroutine_sub:'Save, manage, and revisit your personalised skincare routines',
    btn_export:'⬆ Export Routines',btn_import:'⬇ Import Routines',btn_new_routine:'+ New Routine',
    device_sub:'How to use each device mode safely with your skincare products',
    device_booster_desc:'Uses vibration + micro-current to press water-based products deeper. Best after toner is applied to skin.',
    device_booster_avoid:'⛔ Avoid: retinal, AHA, BHA, peeling gel same day',
    device_mc_desc:'Micro-current mode. Pairs with PDRN gel. For post-acne marks, lifting, texture. Phase 2+ only.',
    device_mc_avoid:'⛔ Never on active pimples · Phase 2+ · Not with retinal',
    device_derma_desc:'Pneumatic pressure for deeper penetration. Best for PIH marks when barrier is fully repaired. Phase 2+.',
    device_derma_avoid:'⛔ Never on broken/inflamed skin · Max 2 min · Phase 2+',
    device_air_desc:'Pressurised air on completely dry, clean skin BEFORE any product. No product needed. 1–2 passes max for sensitive skin.',
    device_air_avoid:'⛔ Never same day as retinal, AHA, BHA, peeling gel · Mature/sensitive: use rarely',
    device_freq_title:'📅 Frequency by Phase & Skin Type',
    device_universal_rules:'⛔ Universal Device Rules',
    rule_no_broken:'Never on broken/inflamed skin',rule_device_active:'Device day ≠ Active night',
    rule_air_dry:'Air Shot = dry skin only, before products',rule_recovery_after:'Always recovery day after intense session',
    rule_mature_limit:'Mature/sensitive skin: reduce Air Shot frequency',
    conflict_sub:'Select products you plan to use together and check for dangerous combinations',
    conflict_select_label:'Select products to check',
    emergency_title:'Emergency Barrier Routine',
    emergency_sub:'When skin suddenly burns, stings, flares or feels stripped. Dynamic protocol based on your products.',
    /* Personalised Emergency Routine (embedded in routine result + My Routine) */
    pe_section_title:'🆘 Your Emergency Barrier Routine',
    pe_section_sub:'Personalised barrier-repair protocol based on your selected products. Use only if skin suddenly burns, stings, flares, or feels stripped.',
    pe_step1_title:'1. Stop These Immediately',
    pe_step1_no_harsh:'Your routine has no harsh actives — pause any device modes you use.',
    pe_stop_label:'Stop these products',
    pe_all_devices:'All Device Modes',
    pe_stop_makeup:'Makeup (if possible)',
    pe_step2_title:'2. Recovery Routine — Follow for {days} days',
    pe_step2_mn:'MORNING & NIGHT',
    pe_step2_morning:'MORNING ONLY',
    pe_step2_water:'Water rinse only · Skip foaming cleanser',
    pe_step2_water_note:'Gentle lukewarm water. No cleanser if face feels stripped.',
    pe_step2_toner_note:'Pat in 2–3 hydrating layers. No rubbing.',
    pe_step2_serum_note:'Calming serum only — Centella / Panthenol / B5. No actives.',
    pe_step2_moist_note:'Generous occlusive layer. Do not rub in.',
    pe_step2_spf_note:'Mandatory. SPF protects a healing barrier.',
    pe_step2_fallback_toner:'Or any fragrance-free hydrating toner.',
    pe_step2_fallback_serum:'Calming serum. Pat in gently.',
    pe_step2_fallback_moist:'Barrier cream with Ceramides.',
    pe_step2_fallback_spf:'Mineral SPF 50+ (fragrance-free).',
    pe_step3_title:'3. Safe to Continue From Your Routine',
    pe_step3_empty:'No safe-for-flare products found in your selection. Add a fragrance-free toner, a calming serum, a ceramide moisturizer, and a mineral SPF.',
    pe_step4_title:'4. Missing From Your Recovery Kit',
    pe_step4_none:'Your recovery kit is complete ✓',
    pe_missing_moist:'No moisturizer — barrier cannot heal without occlusion',
    pe_missing_spf:'No sunscreen — UV re-injures a damaged barrier',
    pe_missing_cleanser:'No gentle cleanser — water rinse only until you add one',
    pe_missing_calming:'No calming serum (Centella / Panthenol) — calming step recommended',
    pe_missing_barrier:'No barrier cream (Ceramide / Cica) — strongly recommended',
    pe_step5_title:'5. Possible Causes for Your Skin',
    pe_cause_high_sens:'High sensitivity — common triggers: new product, weather change, over-cleansing',
    pe_cause_actives:'Multiple actives selected — likely over-exfoliation',
    pe_cause_device:'Device use can re-injure a stressed barrier — pause all modes',
    pe_cause_barrier:'Compromised barrier — even gentle products can trigger irritation',
    pe_cause_conflicts:'Conflicting ingredient combinations in your routine',
    pe_cause_generic:'Common: new product reaction · sun exposure · hot water · fragranced products',
    pe_step6_title:'6. Ingredients to Avoid During Irritation',
    pe_avoid_retinal:'Retinal / Retinol',pe_avoid_aha:'AHA',pe_avoid_bha:'BHA',pe_avoid_vc:'Vitamin C',pe_avoid_aa:'Azelaic Acid',pe_avoid_exf:'Exfoliating Acids',pe_avoid_fr:'Fragrance / Parfum',pe_avoid_al:'Alcohol Denat.',pe_avoid_eo:'Essential Oils',pe_avoid_peel:'Peeling Gels',
    pe_step7_title:'7. When to Restart Actives',
    pe_step7_body:'After {days} days, if there is no stinging with toner, no redness at rest, and no flaking → slowly return to Phase 1. Wait 1 full week of calm skin before reintroducing actives. Reintroduce only ONE active at a time, every 3 days, at night only.',
    pe_duration_low:'3',pe_duration_mid:'5',pe_duration_high:'7',
    pe_empty_title:'Build a routine first',
    pe_empty_body:'Your personalised Emergency Routine is generated from your selected products and skin profile. Build a routine in Routine Builder first.',
    rename_title:'Rename Routine',btn_save:'Save',btn_cancel:'Cancel',
    q_skin_type:'What is your skin type?',q_aging:'Do you have aging concerns?',
    q_acne:'Current acne level?',q_barrier:'How is your skin barrier?',
    q_redness:'Redness / Inflammation level?',q_goals:'What are your main skin goals?',
    q_device:'Do you use Medicube Booster Pro?',q_makeup:'Do you wear makeup regularly?',
    q_complexity:'Routine complexity preference?',q_avoid:'Ingredients to avoid?',q_sensitivity:'Sensitivity level?',
    o_dry:'Dry',o_oily:'Oily',o_combo:'Combination',o_sensitive:'Sensitive',o_acneprone:'Acne-Prone',
    o_dehydrated:'Dehydrated',o_reactive:'Reactive',o_rosacea:'Rosacea-Prone',o_mature:'Mature',o_barrier:'Barrier-Damaged',
    o_yes:'Yes',o_no:'No',o_sometimes:'Sometimes',
    o_none:'None',o_occasional:'Occasional',o_moderate:'Moderate',o_severe:'Severe',
    o_healthy:'Healthy',o_slightly:'Slightly Damaged',o_very_damaged:'Very Damaged',o_unsure:'Unsure',
    o_low:'Low',o_medium:'Medium',o_high:'High',
    o_simple:'Simple (3–5 steps)',o_moderate_r:'Moderate (5–7)',o_advanced:'Advanced (7+)',
    o_fragrance:'Fragrance / Parfum',o_alcohol:'Alcohol Denat.',o_eo:'Essential Oils',o_silicones:'Silicones',
    g_barrier:'Barrier Repair',g_hydration:'Hydration',g_calm:'Calm Redness',g_glow:'Glow',
    g_acne:'Clear Acne',g_pih:'Fade Post-Acne Marks',g_antiaging:'Anti-Aging',g_elasticity:'Elasticity & Firmness',
    g_texture:'Texture',g_fine_lines:'Fine Lines',g_wrinkles:'Wrinkles',g_hyperpig:'Hyperpigmentation',g_glass:'Glass Skin',
    phase1_title:'🛡 Barrier Repair + Calm Inflammation',phase1_desc:'Rebuild skin barrier, reduce redness, hydrate. No actives.',phase1_dur:'⏱ Weeks 1–4 · Until no stinging, redness at rest, or flaking',phase1_optional_badge:'Optional for Healthy Skin',phase1_optional_note:'Your barrier currently appears healthy. This phase is a gentle buffer — you can shorten it to 1–2 weeks if skin feels stable and calm.',
    phase2_title:'💧 Hydration + Glow',phase2_desc:'Barrier stable. Add PDRN device treatments and spot treatments. PIH starts fading.',phase2_dur:'⏱ Weeks 5–8 · When skin no longer stings or flakes',
    phase3_title:'✨ Actives + Acne Marks + Texture',phase3_desc:'Barrier fully repaired. Introduce retinal, exfoliants. Fade PIH.',phase3_dur:'⏱ Week 9+ · Only when fully calm',
    phase4_title:'🌿 Maintenance + Anti-Aging Support',phase4_desc:'Stable skin. Focus on collagen support, prevention, and long-term health.',phase4_dur:'⏱ Ongoing · Adjust as seasons and skin change',
    morning_routine:'☀️ Daily Morning Base Routine',night_routine:'🌙 Night Routine',recovery_night_label:'🌿 Recovery Night',treatment_night_label:'🌙 Treatment Night',step_c1_recovery_note:'Optional if no makeup or sunscreen was worn.',
    avoid_tonight:'⛔ Avoid Tonight',avoid_today:'⛔ Avoid Today',
    recovery_note:'🌿 Recovery Note',retinal_rule:'🌙 Retinal Rule',
    btn_start_over:'← Start Over',btn_save_routine:'💾 Save Routine',btn_check_ingredients:'Check Ingredients',
    saved_empty:'No saved routines yet. Build a routine to get started.',
    analysis_conflicts:'Ingredient Conflicts Detected',analysis_ok:'No Major Ingredient Conflicts Found',
    analysis_missing_spf:'Missing Sunscreen',analysis_missing_moist:'Missing Moisturizer',
    analysis_too_many:'Too Many Active Products',analysis_mature_note:'Mature Skin Detected',
    water_rinse:'Water Rinse Only',no_cleanser_note:'No cleanser in the morning. Gentle lukewarm water.',
    verify_inci:'Verify INCI on your carton',missing_spf_note:'No sunscreen selected. SPF is essential every morning.',
    prod_select_title:'Select Your Products',prod_select_sub:'Click to add · Click again to remove',
    prod_search_placeholder:'Search by brand, product name, category, or ingredient...',
    prod_no_match:'No products found matching your search.',
    prod_search_btn:'🔍 Search',prod_reset_search:'Reset Search',
    prod_selected_count:'Selected',prod_build_routine:'✨ Build My Routine',
    /* My Routine — full result view */
    myr_empty_title:'No routine saved yet',
    myr_empty_body:'Build your first personalised routine to see it here.',
    myr_empty_cta:'✨ Build My Routine',
    myr_unsaved_banner:'You have a freshly built routine — save it to keep it in My Routine.',
    myr_unsaved_save:'💾 Save This Routine',
    myr_select_label:'Your saved routines',
    myr_btn_edit:'✎ Edit Products',
    myr_btn_rebuild:'↻ Rebuild From Scratch',
    myr_btn_rename:'Rename',
    myr_btn_delete:'🗑 Delete',
    myr_delete_confirm:'Delete this saved routine? This cannot be undone.',
    myr_last_updated:'Last updated',
    /* Recommendations */
    rec_section_title:'✨ Suggested for Your Routine',
    rec_section_sub:'Products from the Glowphase library that fill gaps in your selection. Verify ingredients on your physical carton before use.',
    rec_none:'Your routine looks complete for your selected concerns. ✓',
    rec_reason_no_spf:'No sunscreen selected — SPF is essential every morning',
    rec_reason_no_moist:'No moisturizer selected — barrier cannot seal without one',
    rec_reason_no_cleanser:'No cleanser selected — gentle cleansing is the foundation',
    rec_reason_no_toner:'No toner selected — hydration layer missing',
    rec_reason_calming:'Sensitive / redness-prone skin needs a dedicated calming step',
    rec_reason_acne:'Acne-prone skin without dedicated acne support',
    rec_reason_aging:'Anti-aging concerns without a peptide / retinal / PDRN product',
    rec_reason_barrier:'Compromised barrier without a dedicated ceramide-rich repair product',
    rec_reason_hydration:'Dehydrated skin without enough hyaluronic acid support',
    rec_reason_too_many:'Multiple strong actives selected — add a calming recovery product',
    rec_reason_pih:'Post-acne mark concerns without a brightening / PIH product',
    rec_supports:'Supports',
    rec_caution:'⚠ Caution',
    rec_ff:'Fragrance-Free',rec_af:'Alcohol-Free',rec_eof:'EO-Free',
    rec_verify_inci:'⚠ Verify ingredient list on physical carton before use',
    rec_btn_add:'+ Add to Routine',rec_btn_view:'View Details',
    /* Routine Builder — newly-wired keys (EN values match the original hardcoded strings) */
    bldr_step_label:'Step {n} of {total}',
    bldr_select_all:' · Select all that apply',
    bldr_back:'← Back',
    bldr_next:'Next →',
    result_name_default:'Your Personalised Glowphase Routine',
    result_based_on:'Based on your answers · {n} selected products',
    result_mature_label:'Mature Skin Detected:',
    result_mature_body:'Reduced Air Shot frequency, prioritised hydration and elasticity support, recovery days included.',
    result_no_conflict_body:'Follow phase schedules to avoid overloading.',
    result_daily_every_day:'Daily, Every Day',
    morning_toner_note:'Pat in with hands. Layer 2–3 times.',
    morning_moist_note:'AM moisturizer.',
    morning_spf_note:'Always last AM step. Never skip.',
    /* Morning phase system */
    morning_phase_barrier_tab:'🛡️ Barrier Repair',
    morning_phase_normal_tab:'✨ Normal',
    morning_phase_makeup_tab:'💄 Makeup Prep',
    morning_phase_barrier_note:'For sensitive, irritated, or overworked skin. No actives, no exfoliants.',
    morning_cleanser_optional:'Optional if skin feels dry in the morning.',
    morning_makeup_cleanser_note:'Optional. Gentle water rinse or light cleanser only.',
    morning_makeup_serum_note:'Lightweight layer for glow and smooth texture.',
    morning_makeup_moist_note:'Let absorb 5 min before applying makeup.',
    morning_makeup_spf_tip:'⏱️ Wait 5 minutes after SPF before applying makeup.',
    result_phase_label:'Phase {n}',
    dbadge_recovery:'🌿 Recovery',
    dbadge_device:'💡 Device',
    dbadge_retinal:'🌙 Retinal',
    dbadge_bha:'Spot BHA',
    dbadge_peel:'Peel',
    dbadge_aha:'AHA',
    step_c1_note:'Optional · Skip if you did not wear makeup or sunscreen today.',
    step_c2_note:'Skip if skin is sensitive today.',
    step_cleanser_reminder:'Cleanse with a gentle water-based cleanser.',
    step_peel_note:'⚠️ T-zone only. Feather-light pressure.',
    step_air_note:'Dry skin only, before toner. 1–2 passes.',
    step_air_mature_note:'⚠️ Mature/sensitive: 1 pass max',
    step_toner_note:'Layer 2–3 times.',
    step_toner_recovery_note:'Calming base layer — pat gently, no rubbing.',
    step_booster_note:'Apply toner/essence to skin, then use device.',
    step_mcderma_note:'Apply {gel}, focus on PIH marks.',
    step_pdrn_gel:'PDRN gel',
    step_aha_note:'1×/week max. Leave on.',
    step_bha_note:'🎯 Optional — use only on active breakouts tonight. Skip if skin is clear.',
    step_moisturizer_before_retinal_note:'Apply moisturizer first — buffers skin before retinal.',
    step_retinal_note:'Eye area ONLY. Tiny amount.',
    step_overnight_note:'Rich overnight repair layer.',
    step_eye_note:'Pat gently around orbital bone. Do not rub.',
    step_eye_morning_note:'Pat gently before moisturizer.',
    avoid_all_devices:'All Devices',
    avoid_aha_toner:'AHA Toner',
    avoid_bha_acne_gel:'BHA Acne Gel',
    avoid_peeling_gel:'Peeling Gel',
    avoid_retinal_label:'Retinal',
    avoid_aha_label:'AHA',
    avoid_air_shot_label:'Air Shot',
    avoid_acne_gel_label:'Acne Gel',
    avoid_all_actives:'All Actives',
    avoid_all_device_modes:'All Device Modes',
    avoid_actives:'Actives',
    avoid_device_phase1:'Device (Phase 1)',
    avoid_device_label:'Device',
    retinal_rule_body:'Eye area only · 2×/week max · Always SPF next morning · Apply after moisturizer',
    recovery_note_body:'Less is more tonight. Barrier rebuilds during recovery. No actives, no device.',
    mature_skin_note_label:'🌿 Mature Skin Note',
    mature_skin_note_body:'Reduce Air Shot to 1× per session. Focus on MC Mode for firmness and elasticity support.',
    analyses_missing_spf_body:'No sunscreen selected. SPF is essential every morning.',
    analyses_missing_moist_body:'No moisturizer selected. Barrier cannot repair without proper moisturizer.',
    analyses_too_many_body:'{n} actives selected with compromised barrier. Placed in Phase 3+ schedules only.',
    analyses_mature_body:'Routine adapted for mature skin: reduced Air Shot, prioritised elasticity, extra recovery days.',
    analyses_unverified_title:'Unverified Ingredient Lists',
    analyses_unverified_body:'Some selected products have placeholder ingredient lists. Verify your physical carton before use.',
    analyses_organised_title:'{n} products organised into {mode} routine',
    analyses_organised_phased:'phased',
    analyses_organised_simple:'a',
    analyses_organised_body:'Phase 1 focuses on barrier repair. Actives introduced in Phase 3+ only.',
    analysis_sensitive_actives:'Too Many Actives for Sensitive Skin',
    analyses_sensitive_actives_body:'{n} strong actives selected. For sensitive skin, introduce only 1 active at a time and always prioritise barrier repair first.',
    analysis_retinoid_barrier:'Retinoid with Compromised Barrier',
    analyses_retinoid_barrier_body:'Your barrier needs recovery first. Start retinoids only after barrier is repaired — use Barrier Repair phase for at least 2–4 weeks first.',
    analysis_multi_retinoid:'Multiple Retinoids Detected',
    analyses_multi_retinoid_body:'Never use more than one retinoid at a time. Remove one retinoid product to avoid severe irritation and over-exfoliation.',
    analysis_barrier_support:'Add Barrier Support',
    analyses_barrier_support_body:'You have active treatments but no barrier-supporting product (ceramides, centella, panthenol). Always pair actives with barrier support.',
    /* Day plan goals */
    dpgoal_deep_hyd_barrier:'Deep hydration + barrier sealing',
    dpgoal_device_hydration:'Device-boosted hydration',
    dpgoal_rest_repair:'Rest + deep repair overnight',
    dpgoal_hyd_soothing:'Hydration + soothing',
    dpgoal_booster_hyd:'Booster mode hydration infusion',
    dpgoal_reset_lock:'Skin reset + moisture lock',
    dpgoal_full_recovery:'Full recovery + week prep',
    dpgoal_hyd_spot_acne:'Hydration + spot acne control',
    dpgoal_pdrn_pih:'PDRN device treatment for PIH',
    dpgoal_recovery_device:'Recovery from device treatment',
    dpgoal_glow_hyd:'Glow boost + hydration',
    dpgoal_booster_pdrn:'Booster + PDRN treatment',
    dpgoal_deep_moist_reset:'Deep moisture + skin reset',
    dpgoal_gentle_prep:'Gentle prep for next week',
    dpgoal_hyd_spot:'Hydration + spot acne',
    dpgoal_retinal_intro:'Retinal introduction — eye area only',
    dpgoal_recovery_retinal:'Recovery after retinal',
    dpgoal_pdrn_peel:'PDRN device + optional peel',
    dpgoal_second_retinal:'Second retinal night',
    dpgoal_spot_glow:'Spot acne + glow',
    dpgoal_full_recovery_night:'Full recovery night',
    dpgoal_peptide_aa:'Peptide + anti-aging hydration',
    dpgoal_retinal_maint:'Retinal maintenance',
    dpgoal_recovery_barrier:'Recovery + barrier maintenance',
    dpgoal_aa_device:'Anti-aging device treatment',
    dpgoal_aha_refine:'AHA texture refinement',
    dpgoal_collagen_recovery:'Collagen support recovery',
    dpgoal_full_moist:'Full moisturize + week prep',
    /* Product Library category chip labels */
    chip_oil_cleanser:'Oil Cleanser',
    chip_mist:'Mist',
    chip_sleeping_mask:'Sleeping Mask',
    chip_essence:'Essence',
    chip_ampoule:'Ampoule',
    chip_emulsion:'Emulsion',
    chip_spot_treatment:'Spot Treatment',
    chip_wash_off_mask:'Wash-Off Mask',
    chip_occlusive:'Occlusive / Balm',
    /* Day short labels (button labels stay 3-letter English; full names below) */
    dayname_Mon:'Monday',dayname_Tue:'Tuesday',dayname_Wed:'Wednesday',dayname_Thu:'Thursday',
    dayname_Fri:'Friday',dayname_Sat:'Saturday',dayname_Sun:'Sunday',
    /* Product Library */
    lib_count:'Showing {shown} of {total} products',lib_empty:'No products match your search.',
    flag_fragrance_free:'Fragrance-Free',flag_has_fragrance:'Has Fragrance',flag_has_alcohol:'Contains Alcohol',flag_has_eo:'Essential Oils',
    label_sensitive:'Sensitive',label_barrier:'Barrier',label_aging:'Aging',
    /* Product Modal */
    modal_what_it_does:'What It Does',modal_key_actives:'Key Active Ingredients',modal_skin_concerns:'Skin Concerns Addressed',
    modal_skin_suit:'Skin Suitability',modal_sensitive_skin:'Sensitive Skin',modal_barrier_repair:'Barrier Repair',modal_anti_aging:'Anti-Aging',
    modal_ing_warnings:'⚠️ Ingredient Warnings',modal_how_to_use:'How to Use',modal_best_for:'Best for:',modal_how_often:'How often:',
    modal_dnc:'Do Not Combine With',modal_routine_compat:'Routine Compatibility',
    modal_no_conflicts:'✅ No significant ingredient conflicts. Safe to layer with most other products.',
    modal_medicube_compat:'💡 Medicube Booster Pro Compatibility',modal_rec_mode:'Recommended Mode:',
    modal_booster_note:'💧 Use during Booster Mode to press water-based actives deeper into skin.',
    modal_mc_note:'🟣 Use during MC Mode for micro-current pairing. Phase 2+ only.',
    modal_derma_note:'🔴 Use during Derma Shot Mode for deeper penetration. Phase 2+ only.',
    modal_medicube_title:'💡 Medicube Booster Pro',modal_no_device:'Not intended for device use. Apply manually only.',
    modal_inci_title:'Full INCI Ingredient List',
    modal_inci_missing:'Ingredient data missing — verify ingredient list on your physical carton before use.',
    modal_close:'Close',
    warn_fragrance:'⚠️ Contains fragrance/parfum — caution if fragrance-sensitive',
    warn_alcohol:'⚠️ Contains drying alcohol — caution if dry or barrier-compromised',
    warn_eo:'⚠️ Contains essential oils — caution if reactive',
    modal_tag_ff:'Fragrance-Free',modal_tag_hf:'Has Fragrance',modal_tag_af:'Alcohol-Free',
    modal_tag_ha:'Contains Alcohol',modal_tag_eof:'EO-Free',modal_tag_heo:'Essential Oils',
    modal_suit_sensitive:'✅ Suitable for sensitive skin per brand claims',
    modal_suit_acne:'✅ Suitable for acne-prone skin per brand claims',
    modal_suit_aging:'✅ Supports mature skin / elasticity / fine lines',
    /* Conflict Checker */
    conf_reason_retinal_aha:'Never same night — major barrier disruption.',
    conf_reason_retinal_bha:'Use on separate nights only.',
    conf_reason_retinal_peel:'Never same night — over-exfoliation and PIH risk.',
    conf_reason_aha_peel:'Never on the same night.',
    conf_reason_aha_bha:'Too much for sensitive skin — use on separate nights.',
    conf_reason_retinol_acid:'Never same night — causes barrier damage and irritation.',
    conf_reason_bp_retinoid:'BP oxidises retinoids and strips barrier — use on separate nights.',
    conf_reason_bp_vitc:'BP oxidises Vitamin C — use on separate AM/PM routines.',
    conf_reason_multi_retinoid:'Never stack retinoids — severe irritation and barrier damage risk.',
    conf_reason_multi_acid:'Stacking acids causes over-exfoliation — use only one acid per routine.',
    conf_reason_vitc_acid:'High irritation risk — use Vitamin C in AM and acids in PM only.',
    conflict_min_select:'Select at least 2 products to check.',
    conflict_frag_title:'Fragrance Detected',conflict_frag_body:'One or more products contain fragrance — not recommended for sensitive skin.',
    conflict_eo_title:'Essential Oil Detected',conflict_eo_body:'One or more products contain essential oils — may irritate reactive skin.',
    conflict_too_many_title:'Too Many Active/Exfoliant Products',
    conflict_too_many_body:'{count} active products — max 1 per night for sensitive skin.',
    conflict_none_head:'✅ No Major Conflicts Found in {n} Selected Products',
    conflict_none_body:'These products are generally safe to use together. Follow phase schedules.',
    /* Alerts */
    alert_build_first:'Build a routine first.',alert_routine_saved:'Routine saved to Glowphase! ✓',
    alert_no_export:'No saved routines to export.',
    alert_import_done:'Imported {count} routines. {dup} already existed.',alert_import_fail:'Import failed: ',lib_search_ph:'Search brand, product, ingredient, active...',brand_count:'{n} products',conflict_search_ph:'Search products...',rename_ph:'Routine name...',
    db_custom_loaded:'✅ Custom database loaded. {n} products imported.',
    /* Caution strings */
    caution_acne_start:'Start 2-3× per week and patch test first',
    caution_retinoid_intro:'Introduce slowly (2× per week). Always pair with SPF. Not during pregnancy.',
    caution_recovery_nights:'Use on recovery nights between actives',
    /* My Routines */
    myr_phase_unit:'phase(s)',
  },
  th:{
    nav_home:'หน้าแรก',nav_products:'ผลิตภัณฑ์',nav_builder:'สร้างรูทีน',
    nav_myroutine:'รูทีนของฉัน',nav_device:'คู่มืออุปกรณ์',nav_conflict:'ตรวจสอบส่วนผสม',nav_emergency:'ฉุกเฉิน',
    home_label:'การดูแลผิวส่วนตัวของคุณ',
    hero_tagline:'วิทยาศาสตร์ผิว สวยงามในทุกเฟส',
    hero_sub:'รูทีนดูแลผิวเฉพาะบุคคลสำหรับผิวแพ้ง่าย ผิวเป็นสิว ผิวผู้ใหญ่ และเกราะผิวบกพร่อง · 232 ผลิตภัณฑ์จาก 52 แบรนด์ทั่วโลก พร้อมการวิเคราะห์เต็มรูปแบบ',
    home_sub:'รูทีนดูแลผิวส่วนตัวสำหรับผิวแพ้ง่าย สิว ผิวผู้ใหญ่ และผิวที่ขาดน้ำ ค้นหาแบรนด์สกินแคร์ทั่วโลก วิเคราะห์ส่วนผสม และรับรูทีนที่เหมาะกับคุณ',
    home_features_label:'ทุกสิ่งที่คุณต้องการ',
    home_journey_eyebrow:'✦ ทุกสิ่งที่คุณต้องการ ✦',
    home_journey_title:'<em>เส้นทางผิวสวย</em>ครบทุกขั้น',
    pill_barrier:'🛡 เน้นซ่อมแซมผิว',pill_aging:'✨ ต้านริ้วรอย',pill_worldwide:'🌍 แบรนด์ทั่วโลก',pill_brands:'🌍 52 แบรนด์ · 232 ผลิตภัณฑ์',pill_device:'💡 Medicube Booster Pro',pill_ff:'🌿 ปราศจากน้ำหอม',
    btn_browse:'ดูผลิตภัณฑ์',btn_build:'สร้างรูทีนของฉัน',
    feat_library:'คลังผลิตภัณฑ์',feat_library_desc:'232 ผลิตภัณฑ์จาก 52 แบรนด์ทั่วโลก พร้อมรายการส่วนผสม INCI ครบถ้วน สัญลักษณ์ความปลอดภัย และการวิเคราะห์ปัญหาผิว',
    feat_builder:'สร้างรูทีน',feat_builder_desc:'เครื่องสร้างรูทีนเฉพาะบุคคลแบบควิซ พร้อมตารางเป็นเฟสและโปรโตคอลรายวัน',
    feat_saved:'รูทีนของฉัน',feat_saved_desc:'บันทึก จัดการ ส่งออก และนำเข้ารูทีนดูแลผิวเฉพาะบุคคลข้ามอุปกรณ์',
    feat_device:'คู่มืออุปกรณ์',feat_device_desc:'คู่มือจับคู่ Medicube Booster Pro สำหรับทุกเฟส ทุกโหมด และทุกประเภทผิว',
    feat_conflict:'ตรวจสอบส่วนผสม',feat_conflict_desc:'ตรวจสอบการใช้ส่วนผสมร่วมกันก่อนใช้บนผิวของคุณ',
    feat_emergency:'รูทีนฉุกเฉิน',feat_emergency_desc:'โปรโตคอลซ่อมแซมเกราะผิวทันทีเมื่อผิวเกิดอาการกะทันหันหรือมีปฏิกิริยา',
    home_disclaimer:'⚠️ ทดสอบแพ้ก่อนเสมอ · ตรวจสอบส่วนผสมบนบรรจุภัณฑ์จริง · นี่คือคู่มือ ไม่ใช่คำแนะนำทางการแพทย์',
    library_sub:'ค้นหาแบรนด์สกินแคร์ทั่วโลก · จัดกลุ่มตามแบรนด์',
    notice_db_title:'กำลังใช้ฐานข้อมูลตัวอย่าง',
    notice_db_body:'หากต้องการโหลดฐานข้อมูลผลิตภัณฑ์ของคุณ ใช้ฟังก์ชันนำเข้าหรือไฟล์ JSON/JS',
    filter_category:'หมวดหมู่',filter_concern:'ปัญหาผิว',filter_formula:'สูตร',filter_actives:'ส่วนผสมออกฤทธิ์',
    btn_reset:'รีเซ็ต',btn_build_routine:'สร้างรูทีน',btn_check_conflicts:'ตรวจสอบส่วนผสม',btn_clear:'ล้างทั้งหมด',
    builder_sub:'ตอบคำถามไม่กี่ข้อ เลือกผลิตภัณฑ์ที่คุณมี แล้วรับรูทีนเฉพาะบุคคลที่เหมาะกับผิวคุณ',
    myroutine_sub:'บันทึกและจัดการรูทีนดูแลผิวส่วนตัว',
    btn_export:'⬆ ส่งออกรูทีน',btn_import:'⬇ นำเข้ารูทีน',btn_new_routine:'+ รูทีนใหม่',
    device_sub:'วิธีใช้แต่ละโหมดของอุปกรณ์อย่างปลอดภัยกับผลิตภัณฑ์ดูแลผิว',
    device_booster_desc:'ใช้การสั่นและไมโครเคอร์เรนต์กดผลิตภัณฑ์ที่มีน้ำเป็นส่วนประกอบลึกขึ้น เหมาะใช้หลังทาโทนเนอร์',
    device_booster_avoid:'⛔ หลีกเลี่ยง: เรตินัล AHA BHA เจลลอกเซลล์ในวันเดียวกัน',
    device_mc_desc:'โหมดไมโครเคอร์เรนต์ ใช้กับ PDRN เจล สำหรับรอยสิว การยกกระชับ และพื้นผิว ตั้งแต่เฟส 2 เป็นต้นไป',
    device_mc_avoid:'⛔ ห้ามใช้บนสิวอักเสบ · ตั้งแต่เฟส 2 · ไม่ร่วมกับเรตินัล',
    device_derma_desc:'แรงดันอากาศสำหรับการซึมลึก เหมาะสำหรับรอยดำเมื่อสภาพผิวดีขึ้น ตั้งแต่เฟส 2',
    device_derma_avoid:'⛔ ห้ามใช้บนผิวอักเสบ · สูงสุด 2 นาที · ตั้งแต่เฟส 2',
    device_air_desc:'แรงดันอากาศบนผิวแห้งสะอาดก่อนใช้ผลิตภัณฑ์ ไม่ต้องใช้ผลิตภัณฑ์ 1-2 ครั้งต่อวัน',
    device_air_avoid:'⛔ ห้ามใช้วันเดียวกับเรตินัล AHA BHA เจลลอก · ผิวแพ้/ผู้สูงวัย: ใช้น้อยลง',
    device_freq_title:'📅 ความถี่ตามเฟสและประเภทผิว',
    device_universal_rules:'⛔ กฎการใช้อุปกรณ์ทั่วไป',
    rule_no_broken:'ห้ามใช้บนผิวอักเสบ/แตก',rule_device_active:'วันใช้อุปกรณ์ ≠ คืนใช้ส่วนผสมออกฤทธิ์',
    rule_air_dry:'Air Shot = ผิวแห้งสะอาดเท่านั้น ก่อนใช้ผลิตภัณฑ์',rule_recovery_after:'พักฟื้นหลังใช้อุปกรณ์เสมอ',
    rule_mature_limit:'ผิวแพ้ง่าย/ผู้สูงวัย: ลดความถี่ Air Shot',
    conflict_sub:'เลือกผลิตภัณฑ์ที่ต้องการใช้ร่วมกันเพื่อตรวจหาส่วนผสมที่อาจขัดแย้ง',
    conflict_select_label:'เลือกผลิตภัณฑ์ที่ต้องการตรวจสอบ',
    emergency_title:'รูทีนฉุกเฉินซ่อมแซมผิว',
    emergency_sub:'เมื่อผิวรู้สึกแสบ ระคายเคือง อักเสบกะทันหัน โปรแกรมตามผลิตภัณฑ์ที่คุณใช้',
    /* Personalised Emergency Routine */
    pe_section_title:'🆘 รูทีนฉุกเฉินซ่อมแซมเกราะผิวของคุณ',
    pe_section_sub:'โปรโตคอลซ่อมแซมเกราะผิวเฉพาะบุคคล อิงจากผลิตภัณฑ์ที่คุณเลือก ใช้เฉพาะเมื่อผิวเกิดอาการแสบ ระคายเคือง อักเสบ หรือรู้สึกถูกชะล้างมากเกินไป',
    pe_step1_title:'1. หยุดใช้ทันที',
    pe_step1_no_harsh:'รูทีนของคุณไม่มีสารออกฤทธิ์รุนแรง — ให้หยุดใช้โหมดอุปกรณ์ทั้งหมดถ้าใช้อยู่',
    pe_stop_label:'หยุดใช้ผลิตภัณฑ์เหล่านี้',
    pe_all_devices:'ทุกโหมดอุปกรณ์',
    pe_stop_makeup:'เครื่องสำอาง (ถ้าทำได้)',
    pe_step2_title:'2. รูทีนพักฟื้น — ใช้ต่อเนื่อง {days} วัน',
    pe_step2_mn:'เช้า & กลางคืน',
    pe_step2_morning:'เฉพาะตอนเช้า',
    pe_step2_water:'ล้างหน้าด้วยน้ำเปล่า · งดคลีนเซอร์',
    pe_step2_water_note:'ใช้น้ำอุ่นเล็กน้อย งดคลีนเซอร์ถ้าผิวรู้สึกตึงแห้ง',
    pe_step2_toner_note:'แตะเบาๆ 2–3 ชั้น เน้นเติมน้ำ ห้ามถู',
    pe_step2_serum_note:'ใช้เฉพาะเซรั่มปลอบประโลม — Centella / Panthenol / B5 ห้ามใช้สารออกฤทธิ์',
    pe_step2_moist_note:'ทาหนาๆ เพื่อปิดกั้นเกราะผิว ห้ามถูเข้าผิว',
    pe_step2_spf_note:'จำเป็น SPF ปกป้องเกราะผิวที่กำลังฟื้นฟู',
    pe_step2_fallback_toner:'หรือโทนเนอร์เพิ่มความชุ่มชื้นปราศจากน้ำหอม',
    pe_step2_fallback_serum:'เซรั่มปลอบประโลม แตะเบาๆ',
    pe_step2_fallback_moist:'ครีมซ่อมแซมเกราะผิวที่มี Ceramides',
    pe_step2_fallback_spf:'Mineral SPF 50+ (ปราศจากน้ำหอม)',
    pe_step3_title:'3. ใช้ต่อได้จากรูทีนของคุณ',
    pe_step3_empty:'ไม่พบผลิตภัณฑ์ที่ปลอดภัยสำหรับช่วงผิวอักเสบในรูทีน เพิ่มโทนเนอร์ปราศจากน้ำหอม เซรั่มปลอบประโลม มอยส์เจอไรเซอร์ Ceramide และ Mineral SPF',
    pe_step4_title:'4. สิ่งที่ขาดจากชุดพักฟื้นของคุณ',
    pe_step4_none:'ชุดพักฟื้นของคุณครบถ้วน ✓',
    pe_missing_moist:'ไม่มีมอยส์เจอไรเซอร์ — เกราะผิวต้องการการปิดกั้นจึงจะฟื้นได้',
    pe_missing_spf:'ไม่มีครีมกันแดด — UV จะทำลายเกราะผิวที่บาดเจ็บซ้ำ',
    pe_missing_cleanser:'ไม่มีคลีนเซอร์อ่อนโยน — ใช้น้ำเปล่าล้างจนกว่าจะมี',
    pe_missing_calming:'ไม่มีเซรั่มปลอบประโลม (Centella / Panthenol) — แนะนำให้เพิ่ม',
    pe_missing_barrier:'ไม่มีครีมเซราไมด์ (Ceramide / Cica) — แนะนำอย่างยิ่ง',
    pe_step5_title:'5. สาเหตุที่เป็นไปได้สำหรับผิวของคุณ',
    pe_cause_high_sens:'ผิวแพ้ง่ายมาก — มักเกิดจากผลิตภัณฑ์ใหม่ อากาศเปลี่ยน หรือล้างหน้ามากเกินไป',
    pe_cause_actives:'มีสารออกฤทธิ์หลายตัวในรูทีน — น่าจะมาจากการผลัดเซลล์มากเกินไป',
    pe_cause_device:'การใช้อุปกรณ์อาจทำร้ายเกราะผิวที่อ่อนแอ — หยุดทุกโหมด',
    pe_cause_barrier:'เกราะผิวบกพร่อง — แม้ผลิตภัณฑ์อ่อนโยนก็อาจทำให้ระคายเคือง',
    pe_cause_conflicts:'มีส่วนผสมที่ขัดแย้งกันในรูทีน',
    pe_cause_generic:'พบบ่อย: ผลิตภัณฑ์ใหม่ · แสงแดด · น้ำร้อน · ผลิตภัณฑ์ที่มีน้ำหอม',
    pe_step6_title:'6. ส่วนผสมที่ควรหลีกเลี่ยงระหว่างผิวอักเสบ',
    pe_avoid_retinal:'Retinal / Retinol',pe_avoid_aha:'AHA',pe_avoid_bha:'BHA',pe_avoid_vc:'Vitamin C',pe_avoid_aa:'Azelaic Acid',pe_avoid_exf:'Exfoliating Acids',pe_avoid_fr:'Fragrance / Parfum',pe_avoid_al:'Alcohol Denat.',pe_avoid_eo:'Essential Oils',pe_avoid_peel:'Peeling Gels',
    pe_step7_title:'7. เมื่อไหร่จึงกลับมาใช้สารออกฤทธิ์',
    pe_step7_body:'หลังครบ {days} วัน หากไม่มีอาการแสบเวลาใช้โทนเนอร์ ไม่มีรอยแดงตอนพัก และไม่มีผิวลอก → ค่อยๆ กลับสู่ Phase 1 รอให้ผิวสงบครบ 1 สัปดาห์ก่อนกลับมาใช้สารออกฤทธิ์ เพิ่มทีละชนิด ทุก 3 วัน และใช้เฉพาะกลางคืนเท่านั้น',
    pe_duration_low:'3',pe_duration_mid:'5',pe_duration_high:'7',
    pe_empty_title:'สร้างรูทีนก่อน',
    pe_empty_body:'รูทีนฉุกเฉินส่วนตัวของคุณจะสร้างจากผลิตภัณฑ์ที่เลือกและโปรไฟล์ผิว สร้างรูทีนใน Routine Builder ก่อน',
    rename_title:'เปลี่ยนชื่อรูทีน',btn_save:'บันทึก',btn_cancel:'ยกเลิก',
    q_skin_type:'ผิวของคุณเป็นแบบไหน?',q_aging:'กังวลเรื่องริ้วรอยหรือไม่?',
    q_acne:'ผิวของคุณเป็นสิวมากน้อยแค่ไหนตอนนี้?',q_barrier:'สภาพเกราะผิว (Barrier) ตอนนี้เป็นอย่างไร?',
    q_redness:'มีรอยแดง / การอักเสบบนผิวมากน้อยแค่ไหน?',q_goals:'เป้าหมายในการดูแลผิวของคุณคืออะไร?',
    q_device:'ใช้ Medicube Booster Pro หรือไม่?',q_makeup:'แต่งหน้าเป็นประจำหรือไม่?',
    q_complexity:'อยากให้รูทีนซับซ้อนแค่ไหน?',q_avoid:'มีส่วนผสมที่อยากหลีกเลี่ยงไหม?',q_sensitivity:'ผิวคุณไวต่อสิ่งกระตุ้นมากแค่ไหน?',
    o_dry:'ผิวแห้ง',o_oily:'ผิวมัน',o_combo:'ผิวผสม',o_sensitive:'ผิวแพ้ง่าย',o_acneprone:'ผิวเป็นสิวง่าย',
    o_dehydrated:'ผิวขาดน้ำ',o_reactive:'ผิวระคายเคืองง่าย',o_rosacea:'โรซาเซีย',o_mature:'ผิวที่เริ่มมีอายุ',o_barrier:'เกราะผิวเสียหาย',
    o_yes:'ใช่',o_no:'ไม่ใช่',o_sometimes:'บางครั้ง',
    o_none:'ไม่มี',o_occasional:'นาน ๆ ครั้ง',o_moderate:'ปานกลาง',o_severe:'รุนแรง',
    o_healthy:'แข็งแรงดี',o_slightly:'เสียหายเล็กน้อย',o_very_damaged:'เสียหายมาก',o_unsure:'ไม่แน่ใจ',
    o_low:'ต่ำ',o_medium:'ปานกลาง',o_high:'สูง',
    o_simple:'เรียบง่าย (3–5 ขั้นตอน)',o_moderate_r:'ปานกลาง (5–7 ขั้นตอน)',o_advanced:'ละเอียด (7 ขั้นตอนขึ้นไป)',
    o_fragrance:'น้ำหอม / Parfum',o_alcohol:'Alcohol Denat.',o_eo:'Essential Oils',o_silicones:'Silicones',
    g_barrier:'ซ่อมแซมเกราะผิว',g_hydration:'เติมความชุ่มชื้น',g_calm:'ปลอบประโลม / ลดรอยแดง',g_glow:'ผิวเปล่งปลั่ง',
    g_acne:'ลดสิว',g_pih:'จางรอยสิว',g_antiaging:'ลดเลือนริ้วรอย',g_elasticity:'ยืดหยุ่นและกระชับ',
    g_texture:'ผิวเรียบเนียน',g_fine_lines:'ริ้วรอยตื้น ๆ',g_wrinkles:'ริ้วรอยลึก',g_hyperpig:'ฝ้า / จุดด่างดำ',g_glass:'Glass Skin',
    phase1_title:'🛡 ซ่อมแซมเกราะผิว + ลดการอักเสบ',phase1_desc:'ฟื้นฟูเกราะผิว ลดรอยแดง เติมความชุ่มชื้น ยังงดสารออกฤทธิ์ทุกชนิด',phase1_dur:'⏱ สัปดาห์ที่ 1–4 · จนกว่าผิวจะไม่แสบ แดง หรือลอก',phase1_optional_badge:'ขั้นตอนเสริม (สำหรับผิวแข็งแรง)',phase1_optional_note:'เกราะผิวของคุณดูแข็งแรงดี ขั้นตอนนี้เป็นแค่บัฟเฟอร์ป้องกัน — ย่นระยะได้เหลือ 1–2 สัปดาห์ หากผิวนิ่งและสงบ',
    phase2_title:'💧 เติมความชุ่มชื้น + ผิวเปล่งปลั่ง',phase2_desc:'เมื่อเกราะผิวแข็งแรงแล้ว เริ่มใช้ PDRN และผลิตภัณฑ์ลดรอย รอยสิวเริ่มจางลง',phase2_dur:'⏱ สัปดาห์ที่ 5–8 · เมื่อผิวไม่แสบหรือลอกอีก',
    phase3_title:'✨ สารออกฤทธิ์ + รอยสิว + พื้นผิว',phase3_desc:'เกราะผิวฟื้นฟูสมบูรณ์ เริ่มใช้ Retinal และผลัดเซลล์อย่างอ่อนโยน รอยสิวจางลงชัดเจน',phase3_dur:'⏱ สัปดาห์ที่ 9 เป็นต้นไป · เฉพาะตอนผิวสงบเท่านั้น',
    phase4_title:'🌿 บำรุงระยะยาว + ต้านวัย',phase4_desc:'ผิวอยู่ในภาวะสมดุล เน้นเสริมคอลลาเจน ความยืดหยุ่น และสุขภาพผิวระยะยาว',phase4_dur:'⏱ ต่อเนื่อง · ปรับตามฤดูกาลและสภาพผิว',
    morning_routine:'☀️ รูทีนเช้าพื้นฐาน',night_routine:'🌙 รูทีนกลางคืน',recovery_night_label:'🌿 คืนฟื้นฟูผิว',treatment_night_label:'🌙 คืนบำรุงพิเศษ',step_c1_recovery_note:'ไม่จำเป็นหากไม่ได้แต่งหน้าหรือทาครีมกันแดด',
    avoid_tonight:'⛔ หลีกเลี่ยงคืนนี้',avoid_today:'⛔ หลีกเลี่ยงวันนี้',
    recovery_note:'🌿 บันทึกวันพักฟื้น',retinal_rule:'🌙 กฎการใช้ Retinal',
    btn_start_over:'← เริ่มใหม่',btn_save_routine:'💾 บันทึกรูทีน',btn_check_ingredients:'ตรวจสอบส่วนผสม',
    saved_empty:'ยังไม่มีรูทีนที่บันทึก สร้างรูทีนเพื่อเริ่มต้น',
    analysis_conflicts:'พบส่วนผสมที่อาจขัดแย้งกัน',analysis_ok:'ไม่พบส่วนผสมที่ขัดแย้งรุนแรง',
    analysis_missing_spf:'ยังไม่ได้เลือกครีมกันแดด',analysis_missing_moist:'ยังไม่ได้เลือกมอยส์เจอไรเซอร์',
    analysis_too_many:'ใช้สารออกฤทธิ์มากเกินไป',analysis_mature_note:'ตรวจพบสัญญาณผิวที่เริ่มมีอายุ',
    water_rinse:'ล้างหน้าด้วยน้ำเปล่า',no_cleanser_note:'งดคลีนเซอร์ในช่วงเช้า ใช้น้ำอุ่นเล็กน้อยก็พอ',
    verify_inci:'ตรวจสอบส่วนผสมบนบรรจุภัณฑ์จริงก่อนใช้',missing_spf_note:'ยังไม่ได้เลือกครีมกันแดด — SPF จำเป็นต้องใช้ทุกเช้า',
    prod_select_title:'เลือกผลิตภัณฑ์ของคุณ',prod_select_sub:'แตะเพื่อเพิ่ม · แตะอีกครั้งเพื่อนำออก',
    prod_search_placeholder:'ค้นหาด้วยแบรนด์ ชื่อผลิตภัณฑ์ หมวดหมู่ หรือส่วนผสม...',
    prod_no_match:'ไม่พบผลิตภัณฑ์ที่ตรงกัน',
    prod_search_btn:'🔍 ค้นหา',
    prod_reset_search:'ล้างการค้นหา',
    prod_selected_count:'เลือกแล้ว',
    prod_build_routine:'✨ สร้างรูทีนของฉัน',
    days_sunday:'วันอาทิตย์',days_monday:'วันจันทร์',days_tuesday:'วันอังคาร',days_wednesday:'วันพุธ',
    days_thursday:'วันพฤหัสบดี',days_friday:'วันศุกร์',days_saturday:'วันเสาร์',
    day_morning:'☀️ รูทีนเช้าพื้นฐาน',day_night:'🌙 รูทีนกลางคืน',
    /* My Routine — full result view */
    myr_empty_title:'ยังไม่มีรูทีนที่บันทึก',
    myr_empty_body:'สร้างรูทีนส่วนตัวของคุณเพื่อแสดงที่นี่',
    myr_empty_cta:'✨ สร้างรูทีนของฉัน',
    myr_unsaved_banner:'คุณมีรูทีนที่เพิ่งสร้าง — กดบันทึกเพื่อเก็บไว้ใน "รูทีนของฉัน"',
    myr_unsaved_save:'💾 บันทึกรูทีนนี้',
    myr_select_label:'รูทีนที่บันทึกไว้',
    myr_btn_edit:'✎ แก้ไขผลิตภัณฑ์',
    myr_btn_rebuild:'↻ สร้างใหม่ทั้งหมด',
    myr_btn_rename:'เปลี่ยนชื่อ',
    myr_btn_delete:'🗑 ลบ',
    myr_delete_confirm:'ลบรูทีนนี้? ไม่สามารถกู้คืนได้',
    myr_last_updated:'อัปเดตล่าสุด',
    /* Recommendations */
    rec_section_title:'✨ ผลิตภัณฑ์แนะนำสำหรับรูทีนคุณ',
    rec_section_sub:'ผลิตภัณฑ์จากคลัง Glowphase ที่เติมเต็มสิ่งที่ขาดในรูทีนของคุณ ตรวจสอบส่วนผสมบนบรรจุภัณฑ์จริงก่อนใช้',
    rec_none:'รูทีนของคุณครอบคลุมปัญหาที่เลือกแล้ว ✓',
    rec_reason_no_spf:'ไม่มีครีมกันแดด — SPF จำเป็นต้องใช้ทุกเช้า',
    rec_reason_no_moist:'ไม่มีมอยส์เจอไรเซอร์ — เกราะผิวต้องการการปิดกั้น',
    rec_reason_no_cleanser:'ไม่มีคลีนเซอร์ — การล้างหน้าอย่างอ่อนโยนเป็นพื้นฐาน',
    rec_reason_no_toner:'ไม่มีโทนเนอร์ — ขาดชั้นเพิ่มความชุ่มชื้น',
    rec_reason_calming:'ผิวแพ้ง่าย/มีรอยแดงต้องการขั้นตอนปลอบประโลม',
    rec_reason_acne:'ผิวเป็นสิวแต่ไม่มีผลิตภัณฑ์ดูแลสิวเฉพาะ',
    rec_reason_aging:'มีปัญหาริ้วรอยแต่ไม่มีเปปไทด์ / เรตินัล / PDRN',
    rec_reason_barrier:'เกราะผิวบกพร่องแต่ไม่มีครีมเซราไมด์ซ่อมแซมเฉพาะ',
    rec_reason_hydration:'ผิวขาดน้ำแต่ไม่มี HA เพียงพอ',
    rec_reason_too_many:'เลือกสารออกฤทธิ์แรงหลายชนิด — เพิ่มผลิตภัณฑ์ปลอบประโลม',
    rec_reason_pih:'มีรอยดำหลังสิวแต่ไม่มีผลิตภัณฑ์ลดรอย',
    rec_supports:'ช่วยเรื่อง',
    rec_caution:'⚠ ข้อควรระวัง',
    rec_ff:'ปราศจากน้ำหอม',rec_af:'ปราศจากแอลกอฮอล์',rec_eof:'ปราศจากน้ำมันหอมระเหย',
    rec_verify_inci:'⚠ ตรวจสอบส่วนผสมบนบรรจุภัณฑ์จริงก่อนใช้',
    rec_btn_add:'+ เพิ่มในรูทีน',rec_btn_view:'ดูรายละเอียด',
    /* Routine Builder — Thai for newly-wired keys */
    bldr_step_label:'ขั้นที่ {n} จาก {total}',
    bldr_select_all:' · เลือกได้หลายข้อ',
    bldr_back:'← ย้อนกลับ',
    bldr_next:'ถัดไป →',
    result_name_default:'รูทีน Glowphase เฉพาะบุคคลของคุณ',
    result_based_on:'อิงจากคำตอบของคุณ · เลือกผลิตภัณฑ์ {n} ชิ้น',
    result_mature_label:'ตรวจพบผิวที่เริ่มมีอายุ:',
    result_mature_body:'ลดความถี่ Air Shot เน้นเติมความชุ่มชื้นและเสริมความยืดหยุ่น พร้อมเพิ่มวันพักฟื้น',
    result_no_conflict_body:'ทำตามตารางเฟสเพื่อไม่ให้ผิวรับมากเกินไป',
    result_daily_every_day:'ทุกวัน ทุกเช้า',
    morning_toner_note:'แตะลงผิวด้วยมือ ทาซ้อน 2–3 ชั้น',
    morning_moist_note:'มอยส์เจอไรเซอร์ตอนเช้า',
    morning_spf_note:'ขั้นสุดท้ายของรูทีนเช้าเสมอ ห้ามข้าม',
    /* Morning phase system */
    morning_phase_barrier_tab:'🛡️ เสริมแบริเออร์',
    morning_phase_normal_tab:'✨ ปกติ',
    morning_phase_makeup_tab:'💄 เตรียมแต่งหน้า',
    morning_phase_barrier_note:'เหมาะสำหรับผิวที่บอบบาง ระคายเคือง หรือโอเวอร์ใช้ผิว ไม่มี actives ไม่ผลัดผิว',
    morning_cleanser_optional:'ไม่จำเป็นถ้าผิวรู้สึกแห้งตอนเช้า',
    morning_makeup_cleanser_note:'ไม่จำเป็น ล้างน้ำเปล่าเบาๆ หรือคลีนเซอร์อ่อนโยนเท่านั้น',
    morning_makeup_serum_note:'ชั้นบางเบาเพื่อความเงาและผิวเรียบก่อนแต่งหน้า',
    morning_makeup_moist_note:'รอซึมซาบ 5 นาที ก่อนแต่งหน้า',
    morning_makeup_spf_tip:'⏱️ รอ 5 นาที หลังทา SPF ก่อนแต่งหน้า',
    result_phase_label:'เฟส {n}',
    dbadge_recovery:'🌿 พักฟื้น',
    dbadge_device:'💡 อุปกรณ์',
    dbadge_retinal:'🌙 Retinal',
    dbadge_bha:'แต้มสิว BHA',
    dbadge_peel:'Peel',
    dbadge_aha:'AHA',
    step_c1_note:'ไม่บังคับ · ข้ามได้ถ้าวันนี้ไม่ได้ทา SPF หรือแต่งหน้า',
    step_c2_note:'ข้ามไปถ้าผิววันนี้บอบบาง',
    step_cleanser_reminder:'ล้างหน้าด้วยคลีนเซอร์ที่ไม่ทำลายเกราะผิว',
    step_peel_note:'⚠️ เฉพาะบริเวณ T-zone กดเบาที่สุด',
    step_air_note:'เฉพาะผิวแห้ง ก่อนใช้โทนเนอร์ 1–2 ครั้งพอ',
    step_air_mature_note:'⚠️ ผิวอายุ / ผิวแพ้ง่าย: ทำได้สูงสุด 1 ครั้ง',
    step_toner_note:'ทาซ้อน 2–3 ชั้น',
    step_toner_recovery_note:'ชั้นฐานเพื่อลดอักเสบ — แตะเบา ๆ ห้ามถู',
    step_booster_note:'ทาโทนเนอร์ / เอสเซนส์ลงผิวก่อน แล้วจึงใช้อุปกรณ์',
    step_mcderma_note:'ทา {gel} เน้นบริเวณรอยดำ',
    step_pdrn_gel:'PDRN gel',
    step_aha_note:'สัปดาห์ละ 1 ครั้งสูงสุด ทิ้งไว้บนผิว',
    step_bha_note:'🎯 ไม่บังคับ — แต้มเฉพาะจุดที่มีสิวอักเสบคืนนี้ ข้ามได้หากผิวไม่มีสิว',
    step_moisturizer_before_retinal_note:'ทามอยส์เจอไรเซอร์ก่อน — ช่วยบัฟเฟอร์ผิวก่อนใช้ Retinal',
    step_retinal_note:'เฉพาะรอบดวงตา ปริมาณน้อยมาก',
    step_overnight_note:'ชั้นบำรุงเข้มข้นข้ามคืน',
    step_eye_note:'แตะเบา ๆ รอบเบ้าตา ห้ามถู',
    step_eye_morning_note:'แตะเบา ๆ ก่อนทามอยส์เจอไรเซอร์',
    avoid_all_devices:'อุปกรณ์ทุกชนิด',
    avoid_aha_toner:'AHA Toner',
    avoid_bha_acne_gel:'BHA Acne Gel',
    avoid_peeling_gel:'Peeling Gel',
    avoid_retinal_label:'Retinal',
    avoid_aha_label:'AHA',
    avoid_air_shot_label:'Air Shot',
    avoid_acne_gel_label:'Acne Gel',
    avoid_all_actives:'สารออกฤทธิ์ทุกชนิด',
    avoid_all_device_modes:'โหมดอุปกรณ์ทุกโหมด',
    avoid_actives:'สารออกฤทธิ์',
    avoid_device_phase1:'อุปกรณ์ (เฟส 1)',
    avoid_device_label:'อุปกรณ์',
    retinal_rule_body:'เฉพาะรอบดวงตา · สัปดาห์ละไม่เกิน 2 ครั้ง · ตามด้วย SPF เช้าเสมอ · ทาหลังมอยส์เจอไรเซอร์',
    recovery_note_body:'คืนนี้ใช้ให้น้อย ผิวจะซ่อมแซมเองในช่วงพักฟื้น งดสารออกฤทธิ์และอุปกรณ์ทุกชนิด',
    mature_skin_note_label:'🌿 หมายเหตุสำหรับผิวที่เริ่มมีอายุ',
    mature_skin_note_body:'ลด Air Shot เหลือ 1 ครั้งต่อรอบ เน้น MC Mode เพื่อความกระชับและความยืดหยุ่น',
    analyses_missing_spf_body:'ยังไม่ได้เลือกครีมกันแดด SPF จำเป็นต้องใช้ทุกเช้า',
    analyses_missing_moist_body:'ยังไม่ได้เลือกมอยส์เจอไรเซอร์ เกราะผิวไม่สามารถฟื้นฟูได้หากไม่มีการปิดกั้น',
    analyses_too_many_body:'เลือกสารออกฤทธิ์ {n} ชนิดในขณะที่เกราะผิวไม่แข็งแรง — จะจัดให้ใช้ตั้งแต่เฟส 3 เป็นต้นไปเท่านั้น',
    analyses_mature_body:'ปรับรูทีนสำหรับผิวที่เริ่มมีอายุ: ลด Air Shot เน้นความยืดหยุ่น เพิ่มวันพักฟื้น',
    analyses_unverified_title:'ส่วนผสมยังไม่ได้ตรวจสอบ',
    analyses_unverified_body:'ผลิตภัณฑ์บางชิ้นมีรายการส่วนผสมแบบตัวอย่าง ควรตรวจสอบบรรจุภัณฑ์จริงก่อนใช้',
    analyses_organised_title:'จัดเรียง {n} ผลิตภัณฑ์เป็นรูทีน{mode}',
    analyses_organised_phased:'แบบเป็นเฟส',
    analyses_organised_simple:'',
    analyses_organised_body:'เฟส 1 เน้นซ่อมแซมเกราะผิว สารออกฤทธิ์เริ่มใช้ตั้งแต่เฟส 3 เป็นต้นไป',
    analysis_sensitive_actives:'สารออกฤทธิ์มากเกินไปสำหรับผิวแพ้ง่าย',
    analyses_sensitive_actives_body:'เลือกสารออกฤทธิ์แรง {n} ชนิด สำหรับผิวแพ้ง่าย ควรแนะนำสารออกฤทธิ์ทีละชนิด และเน้นซ่อมแซมเกราะผิวก่อนเสมอ',
    analysis_retinoid_barrier:'ใช้เรตินอยด์ขณะเกราะผิวอ่อนแอ',
    analyses_retinoid_barrier_body:'เกราะผิวต้องการการฟื้นฟูก่อน ควรเริ่มใช้เรตินอยด์หลังจากซ่อมแซมเกราะผิวแล้วเท่านั้น — ใช้เฟสซ่อมแซมเกราะผิวอย่างน้อย 2–4 สัปดาห์ก่อน',
    analysis_multi_retinoid:'ตรวจพบเรตินอยด์หลายชนิด',
    analyses_multi_retinoid_body:'อย่าใช้เรตินอยด์มากกว่าหนึ่งชนิดพร้อมกัน ลบผลิตภัณฑ์เรตินอยด์หนึ่งชิ้นออกเพื่อป้องกันการระคายเคืองรุนแรงและการผลัดเซลล์มากเกินไป',
    analysis_barrier_support:'เพิ่มผลิตภัณฑ์บำรุงเกราะผิว',
    analyses_barrier_support_body:'คุณมีสารออกฤทธิ์แต่ไม่มีผลิตภัณฑ์บำรุงเกราะผิว (เซราไมด์ เซนเทลลา แพนทีนอล) ควรจับคู่สารออกฤทธิ์กับผลิตภัณฑ์ซ่อมแซมเกราะผิวเสมอ',
    /* Day plan goals */
    dpgoal_deep_hyd_barrier:'เติมความชุ่มชื้นลึก + ปิดกั้นเกราะผิว',
    dpgoal_device_hydration:'เพิ่มความชุ่มชื้นด้วยอุปกรณ์',
    dpgoal_rest_repair:'พักผิว + ซ่อมแซมข้ามคืน',
    dpgoal_hyd_soothing:'เติมความชุ่มชื้น + ปลอบประโลม',
    dpgoal_booster_hyd:'อัดฉีดความชุ่มชื้นด้วย Booster Mode',
    dpgoal_reset_lock:'รีเซ็ตผิว + ล็อกความชุ่มชื้น',
    dpgoal_full_recovery:'พักฟื้นเต็มที่ + เตรียมพร้อมสัปดาห์ถัดไป',
    dpgoal_hyd_spot_acne:'เติมความชุ่มชื้น + แต้มสิว',
    dpgoal_pdrn_pih:'ใช้ PDRN กับอุปกรณ์เพื่อลดรอยดำ',
    dpgoal_recovery_device:'พักฟื้นหลังใช้อุปกรณ์',
    dpgoal_glow_hyd:'เพิ่มความเปล่งปลั่ง + ความชุ่มชื้น',
    dpgoal_booster_pdrn:'Booster + PDRN ร่วมกัน',
    dpgoal_deep_moist_reset:'บำรุงเข้มข้น + รีเซ็ตผิว',
    dpgoal_gentle_prep:'เตรียมผิวอย่างอ่อนโยนสำหรับสัปดาห์ถัดไป',
    dpgoal_hyd_spot:'เติมความชุ่มชื้น + แต้มสิว',
    dpgoal_retinal_intro:'เริ่มใช้ Retinal — เฉพาะรอบดวงตา',
    dpgoal_recovery_retinal:'พักฟื้นหลังใช้ Retinal',
    dpgoal_pdrn_peel:'PDRN ด้วยอุปกรณ์ + Peel ตามเหมาะสม',
    dpgoal_second_retinal:'คืนใช้ Retinal ครั้งที่สอง',
    dpgoal_spot_glow:'แต้มสิว + เพิ่มความเปล่งปลั่ง',
    dpgoal_full_recovery_night:'คืนพักฟื้นเต็มที่',
    dpgoal_peptide_aa:'เพปไทด์ + เติมความชุ่มชื้นต้านวัย',
    dpgoal_retinal_maint:'ใช้ Retinal ดูแลต่อเนื่อง',
    dpgoal_recovery_barrier:'พักฟื้น + ดูแลเกราะผิว',
    dpgoal_aa_device:'ใช้อุปกรณ์เพื่อชะลอวัย',
    dpgoal_aha_refine:'AHA ปรับผิวเรียบเนียน',
    dpgoal_collagen_recovery:'พักฟื้นเสริมคอลลาเจน',
    dpgoal_full_moist:'บำรุงเต็มที่ + เตรียมพร้อมสัปดาห์ถัดไป',
    /* Product Library category chip labels */
    chip_oil_cleanser:'คลีนซิ่งออยล์/บาล์ม',
    chip_mist:'มิสต์/สเปรย์บำรุงผิว',
    chip_sleeping_mask:'สลีปปิ้งมาส์ก',
    chip_essence:'เอสเซ่นส์',
    chip_ampoule:'แอมพูล',
    chip_emulsion:'อิมัลชัน',
    chip_spot_treatment:'สปอตทรีทเมนต์',
    chip_wash_off_mask:'มาส์กล้างออก',
    chip_occlusive:'ออคคลูซีฟ / บาล์ม',
    /* Day full names */
    dayname_Mon:'จันทร์',dayname_Tue:'อังคาร',dayname_Wed:'พุธ',dayname_Thu:'พฤหัสบดี',
    dayname_Fri:'ศุกร์',dayname_Sat:'เสาร์',dayname_Sun:'อาทิตย์',
    /* Product Library */
    lib_count:'แสดง {shown} จาก {total} ผลิตภัณฑ์',lib_empty:'ไม่พบผลิตภัณฑ์ที่ตรงกับการค้นหาของคุณ',
    flag_fragrance_free:'ปราศจากน้ำหอม',flag_has_fragrance:'มีน้ำหอม',flag_has_alcohol:'มีแอลกอฮอล์',flag_has_eo:'มีน้ำมันหอมระเหย',
    label_sensitive:'ผิวแพ้ง่าย',label_barrier:'เกราะผิว',label_aging:'ต้านวัย',
    /* Product Modal */
    modal_what_it_does:'สรรพคุณ',modal_key_actives:'ส่วนผสมออกฤทธิ์หลัก',modal_skin_concerns:'ปัญหาผิวที่ตอบสนอง',
    modal_skin_suit:'ความเหมาะสมกับผิว',modal_sensitive_skin:'ผิวแพ้ง่าย',modal_barrier_repair:'ซ่อมแซมเกราะผิว',modal_anti_aging:'ต้านวัย',
    modal_ing_warnings:'⚠️ คำเตือนเกี่ยวกับส่วนผสม',modal_how_to_use:'วิธีการใช้',modal_best_for:'เหมาะสำหรับ:',modal_how_often:'ความถี่:',
    modal_dnc:'ห้ามใช้ร่วมกับ',modal_routine_compat:'ความเข้ากันในรูทีน',
    modal_no_conflicts:'✅ ไม่มีส่วนผสมที่ขัดแย้งกัน ปลอดภัยที่จะใช้ร่วมกับผลิตภัณฑ์อื่นๆ',
    modal_medicube_compat:'💡 ความเข้ากันกับ Medicube Booster Pro',modal_rec_mode:'โหมดที่แนะนำ:',
    modal_booster_note:'💧 ใช้ระหว่าง Booster Mode เพื่อกดส่วนผสมที่มีน้ำซึมลึกสู่ผิว',
    modal_mc_note:'🟣 ใช้ระหว่าง MC Mode เพื่อจับคู่กระแสไมโคร Phase 2 ขึ้นไปเท่านั้น',
    modal_derma_note:'🔴 ใช้ระหว่าง Derma Shot Mode เพื่อการซึมผ่านที่ลึกยิ่งขึ้น Phase 2 ขึ้นไปเท่านั้น',
    modal_medicube_title:'💡 Medicube Booster Pro',modal_no_device:'ไม่ได้ออกแบบสำหรับใช้กับอุปกรณ์ ให้ทาด้วยมือเท่านั้น',
    modal_inci_title:'รายการส่วนผสม INCI แบบเต็ม',
    modal_inci_missing:'ไม่มีข้อมูลส่วนผสม — โปรดตรวจสอบรายการส่วนผสมบนกล่องผลิตภัณฑ์ก่อนใช้',
    modal_close:'ปิด',
    warn_fragrance:'⚠️ มีน้ำหอม/parfum — ระวังหากแพ้กลิ่นหอม',
    warn_alcohol:'⚠️ มีแอลกอฮอล์ที่ทำให้แห้ง — ระวังหากผิวแห้งหรือเกราะผิวเสียหาย',
    warn_eo:'⚠️ มีน้ำมันหอมระเหย — ระวังหากผิวตอบสนองไวต่อสิ่งกระตุ้น',
    modal_tag_ff:'ปราศจากน้ำหอม',modal_tag_hf:'มีน้ำหอม',modal_tag_af:'ปราศจากแอลกอฮอล์',
    modal_tag_ha:'มีแอลกอฮอล์',modal_tag_eof:'ปราศจากน้ำมันหอมระเหย',modal_tag_heo:'มีน้ำมันหอมระเหย',
    modal_suit_sensitive:'✅ เหมาะสำหรับผิวแพ้ง่ายตามที่แบรนด์ระบุ',
    modal_suit_acne:'✅ เหมาะสำหรับผิวเป็นสิวตามที่แบรนด์ระบุ',
    modal_suit_aging:'✅ เหมาะสำหรับผิวสูงวัย / ความยืดหยุ่น / ริ้วรอยละเอียด',
    /* Conflict Checker */
    conf_reason_retinal_aha:'ห้ามใช้คืนเดียวกัน — ทำลายเกราะผิวอย่างรุนแรง',
    conf_reason_retinal_bha:'ใช้ในคืนแยกกันเท่านั้น',
    conf_reason_retinal_peel:'ห้ามใช้คืนเดียวกัน — เสี่ยงผลัดเซลล์มากเกินและรอยดำ',
    conf_reason_aha_peel:'ห้ามใช้ในคืนเดียวกัน',
    conf_reason_aha_bha:'มากเกินไปสำหรับผิวแพ้ง่าย — ใช้คืนแยกกัน',
    conf_reason_retinol_acid:'ห้ามใช้คืนเดียวกัน — ทำลายเกราะผิวและระคายเคือง',
    conf_reason_bp_retinoid:'BP ทำลาย retinoid และชะล้างเกราะผิว — ใช้คืนแยกกัน',
    conf_reason_bp_vitc:'BP ทำลาย Vitamin C — แยกใช้เช้า/เย็น',
    conf_reason_multi_retinoid:'ห้ามใช้ retinoid ซ้อนกัน — เสี่ยงระคายเคืองรุนแรงและเกราะผิวเสียหาย',
    conf_reason_multi_acid:'ใช้กรดซ้อนกันทำให้ผลัดเซลล์มากเกิน — ใช้กรดเพียงชนิดเดียวต่อรูทีน',
    conf_reason_vitc_acid:'เสี่ยงระคายเคืองสูง — ใช้ Vitamin C ตอนเช้า กรดตอนกลางคืนเท่านั้น',
    conflict_min_select:'เลือกอย่างน้อย 2 ผลิตภัณฑ์เพื่อตรวจสอบ',
    conflict_frag_title:'พบน้ำหอม',conflict_frag_body:'มีผลิตภัณฑ์ที่มีน้ำหอม — ไม่แนะนำสำหรับผิวแพ้ง่าย',
    conflict_eo_title:'พบน้ำมันหอมระเหย',conflict_eo_body:'มีผลิตภัณฑ์ที่มีน้ำมันหอมระเหย — อาจระคายเคืองผิวไวต่อสิ่งกระตุ้น',
    conflict_too_many_title:'มีผลิตภัณฑ์สารออกฤทธิ์มากเกินไป',
    conflict_too_many_body:'มีสารออกฤทธิ์ {count} ชนิด — สูงสุด 1 ชนิดต่อคืนสำหรับผิวแพ้ง่าย',
    conflict_none_head:'✅ ไม่พบส่วนผสมที่ขัดแย้งรุนแรงใน {n} ผลิตภัณฑ์ที่เลือก',
    conflict_none_body:'ผลิตภัณฑ์เหล่านี้ปลอดภัยที่จะใช้ร่วมกัน ทำตามตารางเฟส',
    /* Alerts */
    alert_build_first:'สร้างรูทีนก่อนนะคะ',alert_routine_saved:'บันทึกรูทีนไปยัง Glowphase แล้ว! ✓',
    alert_no_export:'ไม่มีรูทีนที่บันทึกไว้เพื่อส่งออก',
    alert_import_done:'นำเข้า {count} รูทีน {dup} มีอยู่แล้ว',alert_import_fail:'นำเข้าล้มเหลว: ',lib_search_ph:'ค้นหาแบรนด์ ผลิตภัณฑ์ ส่วนผสม...',brand_count:'{n} รายการ',conflict_search_ph:'ค้นหาผลิตภัณฑ์...',rename_ph:'ชื่อรูทีน...',
    db_custom_loaded:'✅ โหลดฐานข้อมูลที่กำหนดเองแล้ว นำเข้า {n} ผลิตภัณฑ์',
    /* Caution strings */
    caution_acne_start:'เริ่มต้น 2-3 ครั้ง/สัปดาห์ และทดสอบผลก่อน',
    caution_retinoid_intro:'เริ่มช้าๆ (2 ครั้ง/สัปดาห์) ใช้คู่กับกันแดดเสมอ ห้ามใช้ขณะตั้งครรภ์',
    caution_recovery_nights:'ใช้ในคืนพักฟื้นระหว่างการใช้สารออกฤทธิ์',
    /* My Routines */
    myr_phase_unit:'เฟส',
  }
};
let LANG = localStorage.getItem('gp_lang') || 'en';
function t(k){ return (T[LANG]&&T[LANG][k])||(T.en[k])||k; }
/* String interpolation helper: tFmt('Step {n} of {total}', {n:1,total:5}) */
function tFmt(k, vars){
  let s = t(k);
  if(!vars) return s;
  Object.keys(vars).forEach(name=>{ s = s.split('{'+name+'}').join(vars[name]); });
  return s;
}
/* Translate a DAY_PLANS goal string (English canonical) into the current LANG.
   Returns the input untouched if no mapping is found. */
const _DPGOAL_MAP = {
  'Deep hydration + barrier sealing':'dpgoal_deep_hyd_barrier',
  'Device-boosted hydration':'dpgoal_device_hydration',
  'Rest + deep repair overnight':'dpgoal_rest_repair',
  'Hydration + soothing':'dpgoal_hyd_soothing',
  'Booster mode hydration infusion':'dpgoal_booster_hyd',
  'Skin reset + moisture lock':'dpgoal_reset_lock',
  'Full recovery + week prep':'dpgoal_full_recovery',
  'Hydration + spot acne control':'dpgoal_hyd_spot_acne',
  'PDRN device treatment for PIH':'dpgoal_pdrn_pih',
  'Recovery from device treatment':'dpgoal_recovery_device',
  'Glow boost + hydration':'dpgoal_glow_hyd',
  'Booster + PDRN treatment':'dpgoal_booster_pdrn',
  'Deep moisture + skin reset':'dpgoal_deep_moist_reset',
  'Gentle prep for next week':'dpgoal_gentle_prep',
  'Hydration + spot acne':'dpgoal_hyd_spot',
  'Retinal introduction — eye area only':'dpgoal_retinal_intro',
  'Recovery after retinal':'dpgoal_recovery_retinal',
  'PDRN device + optional peel':'dpgoal_pdrn_peel',
  'Second retinal night':'dpgoal_second_retinal',
  'Spot acne + glow':'dpgoal_spot_glow',
  'Full recovery night':'dpgoal_full_recovery_night',
  'Peptide + anti-aging hydration':'dpgoal_peptide_aa',
  'Retinal maintenance':'dpgoal_retinal_maint',
  'Recovery + barrier maintenance':'dpgoal_recovery_barrier',
  'Anti-aging device treatment':'dpgoal_aa_device',
  'AHA texture refinement':'dpgoal_aha_refine',
  'Collagen support recovery':'dpgoal_collagen_recovery',
  'Full moisturize + week prep':'dpgoal_full_moist'
};
function tDayGoal(s){ const k=_DPGOAL_MAP[s]; return k?t(k):s; }
function tDayName(code){ return t('dayname_'+code) || code; }
function setLang(lang,btn){
  LANG=lang;localStorage.setItem('gp_lang',lang);
  document.querySelectorAll('.lang-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  applyTranslations();renderCurrentPage();
}
function applyTranslations(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k=el.dataset.i18n;const v=t(k);
    if(!v||v===k)return;
    if(/[<&]/.test(v))el.innerHTML=v;else el.textContent=v;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
    const k=el.dataset.i18nPlaceholder;const v=t(k);
    if(v&&v!==k)el.placeholder=v;
  });
}
function renderCurrentPage(){
  const a=document.querySelector('.page.active');if(!a)return;
  const id=a.id.replace('page-','');
  if(id==='library')renderLibrary();
  if(id==='builder')initBuilder();
  if(id==='myroutine')renderMyRoutines();
  if(id==='conflict')renderConflictGrid();
}

/* ═══════════════════════════════════════════════
   PRODUCT DATABASE
═══════════════════════════════════════════════ */
let PRODUCT_DB=[{"id":1,"brand":"Aestura","name":"Atobarrier 365 Cream","category":"moisturizer","ingredients":"WATER / AQUA / EAU, BUTYLENE GLYCOL, GLYCERIN, BUTYLENE GLYCOL DICAPRYLATE/ DICAPRATE, CETYL ETHYLHEXANOATE, SQUALANE, PENTAERYTHRITYL TETRAISOSTEARATE, DICAPRYLYL CARBONATE, BEHENYL ALCOHOL, DIMETHICONE, HYDROXYPROPYL BISPALMITAMIDE MEA, STEARIC ACID, BETAINE, MANNITOL, C14-22 ALCOHOLS, PALMITIC ACID, HYDROXYPROPYL BISLAURAMIDE MEA, ARACHIDYL ALCOHOL, CHOLESTEROL, POLYACRYLATE-13, C12-20 ALKYL GLUCOSIDE, ALLANTOIN, ARACHIDYL GLUCOSIDE, NIACINAMIDE, CERAMIDE NP, GLYCERYL CAPRYLATE, ETHYLHEXYLGLYCERIN, HYDROGENATED POLYISOBUTENE, CARBOMER, TROMETHAMINE, DIMETHICONOL, POLYGLYCERYL-10 LAURATE, HYDROGENATED LECITHIN, ETHYLHEXYL PALMITATE, ACRYLATES / AMMONIUM METHACRYLATE COPOLYMER, SORBITAN ISOSTEARATE, SILICA, PHYTOSPHINGOSINE, SPHINGOLIPIDS, ARACHIDIC ACID, TOCOPHEROL, OLEIC ACID","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","ceramides"],"description":"Rich barrier-repair cream with Ceramide NP, Hydroxypropyl Bispalmitamide MEA and Phytosphingosine that restores the lipid barrier and provides long-lasting moisture for dry, atopic-prone skin. One of Korea's most trusted over-the-counter barrier creams.","descriptionTH":"ครีมซ่อมแซมผิวที่มีส่วนผสมของเซราไมด์และฟิโตสฟิงโกซีนช่วยฟื้นฟูเกราะป้องกันไขมันและให้ความชุ่มชื้นนานสำหรับผิวแห้งและผิวแพ้ง่าย","bestFor":"sensitive, redness-prone, damaged barrier, dry, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts. Safe to layer over actives.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ ใช้ทับสารออกฤทธิ์ได้","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1_Atobarrier365-Cream_thumbnail_Product-80ml__1200x1200_961c8e7e-0afb-48bd-bea7-d47f285ab4d4.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1_Atobarrier365-Cream_thumbnail_Product-80ml__1200x1200_961c8e7e-0afb-48bd-bea7-d47f285ab4d4.png"},{"id":2,"brand":"Aestura","name":"Atobarrier 365 Hydro Essence","category":"essence","ingredients":"WATER / AQUA / EAU, BUTYLENE GLYCOL, GLYCERIN, SQUALANE, 1,2-HEXANEDIOL, ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER, CARBOMER, TROMETHAMINE, GLYCERYL CAPRYLATE, ETHYLHEXYLGLYCERIN, DISODIUM EDTA, NATTO GUM, STEARIC ACID, HYDROXYPROPYL BISPALMITAMIDE MEA, MANNITOL, PCA, LACTIC ACID, GLUCOSE, GLYCINE, UREA, SODIUM GLYCEROPHOSPHATE, SERINE, GLUTAMIC ACID, TOCOPHEROL, ACRYLATES / AMMONIUM METHACRYLATE COPOLYMER, POTASSIUM MAGNESIUM ASPARTATE, ASPARTIC ACID, LEUCINE, SODIUM CHLORIDE, ALANINE, LYSINE, ARGININE, CALCIUM GLUCONATE, MAGNESIUM GLUCONATE, TYROSINE, PHENYLALANINE, PROLINE, THREONINE, VALINE, ISOLEUCINE, CITRIC ACID, CHOLESTEROL, HISTIDINE, SILICA, ACETYL GLUCOSAMINE, CREATINE, URIC ACID, CYSTEINE, METHIONINE","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Featherweight essence with Ceramide NP, panthenol and skin-identical NMF that hydrates multiple layers of the skin and reinforces a weakened barrier. Apply before serum for extra hydration layering.","descriptionTH":"เอสเซนส์น้ำหนักเบาที่มีเซราไมด์ แพนทีนอล และ NMF ช่วยเติมน้ำในผิวหลายชั้นและเสริมสร้างเกราะป้องกันผิวที่อ่อนแอ","bestFor":"oily","bestForTH":"ผิวมัน","howOften":"AM + PM daily after toner, before serum","howOftenTH":"เช้า-เย็น ทุกวัน หลังโทนเนอร์ก่อนเซรั่ม","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1_Atobarrier365-Hydro_Essence_thumbnail_Product-200ml__1200x1200_5b44c8c6-f402-4c16-94ed-8a8df78a6ded.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1_Atobarrier365-Hydro_Essence_thumbnail_Product-200ml__1200x1200_5b44c8c6-f402-4c16-94ed-8a8df78a6ded.png"},{"id":3,"brand":"Aestura","name":"Atobarrier 365 Lotion","category":"moisturizer","ingredients":"WATER / AQUA / EAU, BUTYLENE GLYCOL, GLYCERIN, DIMETHICONE, SQUALANE, PENTAERYTHRITYL TETRAISOSTEARATE, BETAINE, POLYGLYCERYL-3 METHYLGLUCOSE DISTEARATE, BUTYLENE GLYCOL DICAPRYLATE/DICAPRATE, CAPRYLIC/CAPRIC TRIGLYCERIDE, PALMITIC ACID, 1,2-HEXANEDIOL, STEARIC ACID, HYDROXYETHYL ACRYLATE/SODIUM ACRYLOYLDIMETHYL TAURATE COPOLYMER, GLYCERYL STEARATE, HYDROXYPROPYL BISPALMITAMIDE MEA, GLYCERYL STEARATE CITRATE, CHOLESTEROL, NIACINAMIDE, DIMETHICONOL, HYDROXYPROPYL BISLAURAMIDE MEA, BEHENYL ALCOHOL, GLYCERYL CAPRYLATE, CARBOMER, DISODIUM EDTA, ETHYLHEXYLGLYCERIN, TROMETHAMINE, SORBITAN ISOSTEARATE, PHYTOSPHINGOSINE, MANNITOL, CERAMIDE NP, TOCOPHEROL, HYDROGENATED LECITHIN, ACRYLATES/AMMONIUM METHACRYLATE COPOLYMER, SILICA, SPHINGOLIPIDS, ARACHIDIC ACID, OLEIC ACID","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","ceramides"],"description":"Lightweight ceramide-rich lotion with Hydroxypropyl Bispalmitamide MEA and Phytosphingosine that replenishes barrier lipids and soothes dry, itchy skin. Can be used on face and body.","descriptionTH":"โลชั่นน้ำหนักเบาที่อุดมด้วยเซราไมด์ช่วยเติมเต็มไขมันเกราะผิวและบรรเทาอาการคันสำหรับผิวแห้ง ใช้ได้ทั้งหน้าและลำตัว","bestFor":"damaged barrier, dry, dull skin","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1_Atobarrier365-Lotion_thumbnail_Product-150ml__1200x1200_e661801c-e140-4f23-88b6-44e02e95da4c.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1_Atobarrier365-Lotion_thumbnail_Product-150ml__1200x1200_e661801c-e140-4f23-88b6-44e02e95da4c.png"},{"id":4,"brand":"Anua","name":"Azelaic Acid 10 Hyaluron Redness Soothing Serum","category":"serum","ingredients":"Water, Azelaic Acid, Propylene Glycol, Sodium Hydroxide, Dipropylene Glycol, 1,2-Hexanediol, Panthenol, Hydroxyethylcellulose, Betaine Salicylate, Glycerin, Biosaccharide Gum-1, Ethylhexylglycerin, Allantoin, Dipotassium Glycyrrhizate, Melia Azadirachta Leaf Extract, Camellia Sinensis Leaf Water, Sodium Hyaluronate, Melia Azadirachta Flower Extract, Niacinamide, Aloe Barbadensis Leaf Juice, Beta-Glucan, Centella Asiatica Extract, Centella Asiatica Leaf Extract, Centella Asiatica Root Extract, Madecassoside, Asiaticoside, Asiatic Acid, Madecassic Acid, Squalane, Zinc PCA, Butylene Glycol, Pentylene Glycol, Caprylyl/Capryl Glucoside, Hydrogenated Lecithin, Ceramide NP","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["azelaic acid","hyaluronic acid","centella","ceramides","niacinamide","bha"],"description":"Fragrance-free serum with 10% azelaic acid, 7-Cica complex (Centella asiatica fractions + madecassoside), zinc PCA and 3 molecular weights of hyaluronic acid. Calms redness, fights acne-causing bacteria, fades PIH and refines texture. Gentler than pure salicylic acid for sensitive rosacea-prone skin.","descriptionTH":"เซรั่มปราศจากน้ำหอม มีกรดอาเซลาอิก 10% สารสกัดเซนเทลลา สังกะสี PCA และไฮยาลูโรนิกแอซิดสามขนาดโมเลกุล ช่วยลดรอยแดง ต้านแบคทีเรียที่ทำให้เกิดสิว จางรอยดำ PIH และเรียบผิว","bestFor":"damaged barrier, dry, oily, combination, acne-prone, dull skin, hyperpigmentation","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวเป็นสิว, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"Start 2-3x/week PM, build to twice daily. Always SPF in AM.","howOftenTH":"เริ่ม 2-3 ครั้ง/สัปดาห์ ตอนเย็น ค่อยๆ เพิ่มเป็นเช้า-เย็น ใช้ครีมกันแดดทุกเช้า","doNotCombine":"Avoid same session with strong retinol, high-% vitamin C or AHA/BHA exfoliants.","doNotCombineTH":"หลีกเลี่ยงการใช้พร้อมเรตินอล วิตามินซีเข้มข้น หรือ AHA/BHA ในครั้งเดียวกัน","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-ampoule-serum-azelaic-acid-10-hyaluron-redness-soothing-serum-1239193732.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-ampoule-serum-azelaic-acid-10-hyaluron-redness-soothing-serum-1239193732.jpg"},{"id":5,"brand":"Anua","name":"Heartleaf 77 Soothing Toner","category":"toner","ingredients":"Houttuynia Cordata Flower/Leaf/Stem Water, Water, 1,2-Hexanediol, Glycerin, Betaine, Butylene Glycol, Isopentyldiol, Panthenol, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Disodium EDTA, Tromethamine, Centella Asiatica Extract, Arctium Lappa Root Extract, Phellinus Linteus Extract, Portulaca Oleracea Extract, Chamomilla Recutita (Matricaria) Flower Extract, Vitex Agnus-Castus Extract, Sodium Hyaluronate, Hydroxypropyltrimonium Hyaluronate, Hydrolyzed Hyaluronic Acid, Sodium Acetylated Hyaluronate, Hyaluronic Acid, Sodium Hyaluronate Crosspolymer, Potassium Hyaluronate","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella"],"description":"Best-selling soothing toner with Houttuynia cordata (heartleaf) extract as the #1 ingredient at 77%, plus 5 forms of hyaluronic acid, centella, and allantoin. Deeply calms inflammation and redness while layering light hydration. Alcohol-free and fragrance-free. Ideal for skin barrier recovery.","descriptionTH":"โทนเนอร์ขายดีที่มีสารสกัดเฮิร์ทลีฟ 77% พร้อมไฮยาลูโรนิกแอซิด 5 รูปแบบ เซนเทลลา และอัลแลนทอยน์ ลดการอักเสบและรอยแดงพร้อมเพิ่มความชุ่มชื้น ปราศจากแอลกอฮอล์และน้ำหอม","bestFor":"sensitive, redness-prone, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง","howOften":"AM + PM daily. Layer 2-3 times for extra hydration (7-skin method).","howOftenTH":"เช้า-เย็น ทุกวัน ซับซ้อนได้ 2-3 ชั้นเพื่อเพิ่มความชุ่มชื้น","doNotCombine":"No significant conflicts. Safe before serums and moisturizers.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","makeupPrep":true,"imageUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-toner-heartleaf-77-soothing-toner-1239193744.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-toner-heartleaf-77-soothing-toner-1239193744.jpg"},{"id":6,"brand":"Anua","name":"Heartleaf Pore Cleansing Oil Mild","category":"oil cleanser","subcategory":"cleansing oil","ingredients":"Ethylhexyl Stearate, Sorbeth-30 Tetraoleate, Cetyl Ethylhexanoate, Caprylic/Capric Triglyceride, Triethylhexanoin, Rosmarinus Officinalis (Rosemary) Leaf Oil, Helianthus Annuus (Sunflower) Seed Oil, Houttuynia Cordata Extract , Isododecane, Water, Sorbitan Sesquioleate, Tocopherol","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Mild oil cleanser with heartleaf (Houttuynia cordata) extract, rosemary and sunflower oil that dissolves makeup and sebum while soothing reactive skin. Emulsifies with water for easy rinsing. Best for first-cleanse step.","descriptionTH":"คลีนซิ่งออยล์อ่อนโยนที่มีสารสกัดเฮิร์ทลีฟ โรสแมรี่ และดอกทานตะวัน ละลายเครื่องสำอางและไขมันส่วนเกินพร้อมบรรเทาผิวแพ้ง่าย","bestFor":"sensitive, redness-prone","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย","howOften":"PM daily as first cleanse, before gentle cleanser","howOftenTH":"ตอนเย็น ทุกวัน เป็นขั้นตอนทำความสะอาดแรก","doNotCombine":"N/A — wash-off product","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-cleanser-heartleaf-pore-cleansing-oil-mild-1239193741.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-cleanser-heartleaf-pore-cleansing-oil-mild-1239193741.jpg"},{"id":7,"brand":"Anua","name":"Heartleaf Pore Control Cleansing Oil","category":"oil cleanser","subcategory":"cleansing oil","ingredients":"Ethylhexyl Palmitate, Sorbeth-30 Tetraoleate, Sorbitan Sesquioleate, Caprylic/Capric Triglyceride, Butyl Avocadate, Fragrance, Helianthus Annuus (Sunflower) Seed Oil, Macadamia Ternifolia Seed Oil, Olea Europaea (Olive) Fruit Oil, Simmondsia Chinensis (Jojoba) Seed Oil, Vitis Vinifera (Grape) Seed Oil, Caprylyl Glycol, Ethylhexylglycerin, Curcuma Longa (Turmeric) Root Extract, Melia Azadirachta Flower Extract, Tocopherol, Melia Azadirachta Leaf Extract, Houttuynia Cordata Extract, Corallina Officinalis Extract, Melia Azadirachta Bark Extract, Moringa Oleifera Seed Oil, Ocimum Sanctum Leaf Extract","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Pore-focused cleansing oil with heartleaf extract, jojoba and macadamia oils. Contains fragrance/parfum — not recommended for fragrance-sensitive skin. Good for removing heavy SPF and makeup on normal-to-oily skin.","descriptionTH":"คลีนซิ่งออยล์สำหรับดูแลรูขุมขน มีสารสกัดเฮิร์ทลีฟ โจโจ้บา และมาคาเดเมีย มีส่วนผสมน้ำหอม ไม่แนะนำสำหรับผิวแพ้น้ำหอม","bestFor":"All skin types. Caution: contains fragrance","bestForTH":"ผิวทุกประเภท. ระวัง: มีน้ำหอม","howOften":"PM daily as first cleanse","howOftenTH":"ตอนเย็น ทุกวัน เป็นขั้นตอนทำความสะอาดแรก","doNotCombine":"N/A — wash-off. Contains fragrance — avoid if sensitive.","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก มีน้ำหอม หลีกเลี่ยงหากแพ้น้ำหอม","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-cleanser-heartleaf-pore-control-cleansing-oil-1239193742.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-cleanser-heartleaf-pore-control-cleansing-oil-1239193742.jpg"},{"id":8,"brand":"Anua","name":"PDRN Hyaluronic Acid Capsule 100 Serum","category":"serum","ingredients":"Water, Butylene Glycol, Propanediol, Glycerin, Hydrolyzed Hyaluronic Acid, 1,2-Hexanediol, Niacinamide, Glyceryl Oleate, Lauryl Glucoside, Myristyl Glucoside, Polyglyceryl-6 Laurate, Hydrogenated Lecithin, Glutathione, Hydrolyzed Collagen, Sodium Hyaluronate, Coptis Japonica Root Extract, Adenosine, Melia Azadirachta Leaf Extract, Melia Azadirachta Flower Extract, Coccinia Indica Fruit Extract, Sodium DNA, Solanum Melongena (Eggplant) Fruit Extract, Hyaluronic Acid, Hydrolyzed Sodium Hyaluronate, Hydroxypropyltrimonium Hyaluronate, Potassium Hyaluronate, Sodium Hyaluronate Crosspolymer, Sodium Acetylated Hyaluronate, Ocimum Sanctum Leaf Extract, Citric Acid, Curcuma Longa (Turmeric) Root Extract, Corallina Officinalis Extract, Sodium Citrate, Pentylene Glycol","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","pdrn","niacinamide"],"description":"Premium fragrance-free serum featuring salmon DNA-derived Sodium DNA (PDRN), 11 types of hyaluronic acid, niacinamide, glutathione and hydrolyzed collagen. Targets dehydration, dullness, and post-acne marks. Distinctive green color from Sodium DNA complex. Visible plumping within minutes.","descriptionTH":"เซรั่มปรีเมียมปราศจากน้ำหอมที่มี Sodium DNA (PDRN) จากดีเอ็นเอแซลมอน ไฮยาลูโรนิกแอซิด 11 ชนิด ไนอาซินาไมด์ กลูตาไธโอน และคอลลาเจนไฮโดรไลซ์ มีสีเขียวเฉพาะจาก Sodium DNA Complex","bestFor":"dry, oily, combination, dull skin, mature skin","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"AM + PM daily after toner, before moisturizer","howOftenTH":"เช้า-เย็น ทุกวัน หลังโทนเนอร์ก่อนมอยส์เจอไรเซอร์","doNotCombine":"No significant conflicts. Compatible with most actives.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ ใช้ร่วมกับสารออกฤทธิ์ส่วนใหญ่ได้","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-ampoule-serum-pdrn-hyaluronic-acid-capsule-100-serum-1239193734.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-ampoule-serum-pdrn-hyaluronic-acid-capsule-100-serum-1239193734.jpg"},{"id":9,"brand":"Anua","name":"Peach 70 Niacinamide Serum","category":"serum","ingredients":"Prunus Persica (Peach) Fruit Extract, Glycerin, Niacinamide, Butylene Glycol, Diethoxyethyl Succinate, Water, 1,2-Hexanediol, Lactobacillus Ferment, Sodium Hyaluronate, Sphingomonas Ferment Extract, Alpha-Arbutin, Melia Azadirachta Flower Extract, Ocimum Sanctum Leaf Extract, Melia Azadirachta Leaf Extract, Carthamus Tinctorius (Safflower) Seed Oil, Salvia Hispanica Seed Oil, Curcuma Longa (Turmeric) Root Extract, Corallina Officinalis Extract, Hydrolyzed Hyaluronic Acid, Chamaecyparis Obtusa Leaf Extract, Prunus Persica (Peach) Flower Extract, Centella Asiatica Extract, Artemisia Princeps Leaf Extract, Pentylene Glycol, Polyglyceryl-10 Laurate, Betaine Salicylate, Sodium Phytate, Cellulose, Caprylic/Capric Triglyceride, Hydrogenated Lecithin, Panthenol, Polyglutamic Acid, Linoleic Acid, Linolenic Acid, Polyglyceryl-10 Oleate, Sucrose Palmitate, Cyanocobalamin, 3-O-Ethyl Ascorbic Acid, Ceramide NP, Lactobionic Acid, Asiaticoside, Madecassic Acid, Asiatic Acid, Xanthan Gum, Fragrance(Parfum)","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["arbutin","vitamin c","hyaluronic acid","centella","ceramides","niacinamide","bha"],"description":"Brightening serum with 70% peach (Prunus persica) fruit extract, 5% niacinamide, alpha-arbutin, betaine salicylate (gentle BHA) and ceramide NP. Evens skin tone, refines pores and lightly exfoliates. Contains fragrance/parfum — caution for fragrance-sensitive users.","descriptionTH":"เซรั่มเพิ่มความกระจ่างใสที่มีสารสกัดพีช 70% ไนอาซินาไมด์ 5% อัลฟา-อาร์บูติน เบตาอีน ซาลิไซเลต และเซราไมด์ NP ปรับสีผิวให้สม่ำเสมอ ลดรูขุมขนและช่วยผลัดเซลล์ผิวเบาๆ มีน้ำหอม","bestFor":"damaged barrier, dry, oily, combination, acne-prone, dull skin, hyperpigmentation, mature skin. Caution: contains fragrance","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวเป็นสิว, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย. ระวัง: มีน้ำหอม","howOften":"AM + PM daily. Always SPF in AM. Start every other day if new to BHA.","howOftenTH":"เช้า-เย็น ทุกวัน ใช้ครีมกันแดดทุกเช้า เริ่มวันเว้นวันหากเพิ่งเริ่มใช้ BHA","doNotCombine":"Contains fragrance. Avoid same session with strong vitamin C serums.","doNotCombineTH":"มีน้ำหอม หลีกเลี่ยงการใช้พร้อมวิตามินซีเข้มข้น","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-global-ampoule-serum-peach-70-niacinamide-serum-1239193727.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-global-ampoule-serum-peach-70-niacinamide-serum-1239193727.jpg"},{"id":10,"brand":"Anua","name":"Rice 70 Glow Milky Toner","category":"toner","ingredients":"Oryza Sativa (Rice) Bran Water(71 %), Butylene Glycol, Glycerin. Dipropylene Glycol, Niacinamide, Propanediol, Water, 1,2-Hexanediol, Methyl Gluceth-20, Panthenol, Betaine, Oryza Sativa (Rice) Extract(3,753ppm), Hydroxyacetophenone, Diphenyl Dime thicone, Triethylhexanoin, Hydrogenated Lecithin, Adenosine. Ethylhexylglycerin, Carbomer, Tromethamine, Xanthan Gum. Glyceryl Acrylate/Acrylic Acid Copolymer, Theobroma Cacao (Cocoa) Seed Extract, Sodium Hyaluronate, Hydrolyzed Hyaluronic Acid, Hyaluronic Acid, Dextrin, Hydrolyzed Rice Protein (3,000ppb), Oryza Sativa (Rice) Seed Protein(3,000ppb), Ceramide NP, Sodium Lauroyi Lactylate, Arbutin, Ascorbic Acid, Allantoin, Ceramide AP, Phytosphingosine, Cholesterol, Ceramide EOP","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid","ceramides","niacinamide","arbutin"],"description":"Fragrance-free milky toner with 71% rice bran water, niacinamide, arbutin, ceramide NP, vitamin C derivatives and phytosphingosine. Brightens dull skin, gently evens tone and reinforces the barrier. Smooth, silky texture with a subtle glow finish.","descriptionTH":"โทนเนอร์สีขาวขุ่นปราศจากน้ำหอมที่มีน้ำรำข้าว 71% ไนอาซินาไมด์ อาร์บูติน เซราไมด์ NP อนุพันธ์วิตามินซี และฟิโตสฟิงโกซีน เพิ่มความกระจ่างใส ปรับสีผิวและเสริมสร้างเกราะผิว","bestFor":"sensitive, redness-prone, damaged barrier, dry, oily, combination, dull skin, hyperpigmentation","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM + PM daily after cleansing","howOftenTH":"เช้า-เย็น ทุกวัน หลังล้างหน้า","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","makeupPrep":true,"imageUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-toner-rice-70-glow-milky-toner-1239193716.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-toner-rice-70-glow-milky-toner-1239193716.jpg"},{"id":11,"brand":"Anua","name":"Rice Ceramide 7 Hydrating Barrier Serum","category":"serum","ingredients":"Oryza Sativa (Rico) Bran Water, Dipropylene GI col, Glycerin, Methylpropanediol, Water, Butylene GIycoI, Methyl Gluceth-10, Niacinamide, 1,2-Hexanediol, Panthenol, Hydroxyethyl Urea, Pentvle ne Glycol, Sodium Polyacrylate, Oryza Sativa (Rice) Extract, Caprylic/Capric Triglyceride, Carbomer, Hydrogenated Lecithin, Ethylhexylglycerin, Polyquatemnium-51, Adenosine, Allantoin, Sodium Phytate, Xanthan Gum, Ceramide NP, Sodium Hyaluronate, Alpha-Arbutin, Angelica Keiskei Extract, Corchorus Olitorius Leaf Extract, Dioscorea Japonica Root Extract, Hibiscus Esculentus Fruit Extract, Nelumbo Nucifera Root Extract, Beta-GIuc an, Tocopherol, Defatted Rice Bran Extract, Arbutin, Zinc Stearate, Defatted Rice Bran, Oryza Sativa (Rice) Bran, Hydrolyzed Rice Protein, Oryza Sativa (Rice) Seed Protein, Honey Extract, Hyaluronic Acid, Hydrolyzed Hyaluronic Acid","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide","arbutin","ceramides"],"description":"Non-comedogenic, fragrance-free serum with rice bran water as the base, 7 types of ceramides, 3% niacinamide, polyglutamic acid, zinc stearate and sodium hyaluronate. Strengthens the skin barrier, controls excess oil and keeps sensitive acne-prone skin comfortably hydrated without clogging pores.","descriptionTH":"เซรั่มไม่อุดรูขุมขน ปราศจากน้ำหอม มีน้ำรำข้าวเป็นฐาน เซราไมด์ 7 ชนิด ไนอาซินาไมด์ 3% กรดโพลีกลูตามิก สังกะสีสเตียเรต และโซเดียมไฮยาลูโรเนต เสริมสร้างเกราะผิว ควบคุมน้ำมัน","bestFor":"sensitive, redness-prone, damaged barrier, dry, oily, combination, dull skin, hyperpigmentation, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย","howOften":"AM + PM daily after toner","howOftenTH":"เช้า-เย็น ทุกวัน หลังโทนเนอร์","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-ampoule-serum-rice-ceramide-7-hydrating-barrier-serum-1239193730.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-ampoule-serum-rice-ceramide-7-hydrating-barrier-serum-1239193730.jpg"},{"id":12,"brand":"Anua","name":"Rice Enzyme Brightening Cleansing Powder","category":"cleanser","ingredients":"Zea Mays (Comn) Starch, Kaolin (CI 77004), Sodium Bicarbonate, Sodium Cocoyl lsethionate, Sodium Lauroyl Glutamate,Citric Acid, Sodium Polyacrylate, Diglycerin, Allantoin, Water, Ma itodextrin, Papain, Oryza Sativa (Rice) Powder, Oryza Sativa (Rice) Lees Extract, Oryza Sativa (Rice) Bran Water, Butylene Glycol, 1,2-Hexanediol, Ceramide NP, Ascorbic Acid, Alpha-Arbutin, Glucose, Oryza Sativa Rice) Extract, Protease, Dipropylene Glycol Glycerin, Tartaric Acid, Lactic Acid, Oryza Sativa (Rice) Seed Protein, Hydrolyzed Rice Protein, Caprylyl Glycol","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","ceramides","arbutin"],"description":"Gentle enzyme cleansing powder with papain (papaya enzyme), kaolin, rice powder, rice lees extract and gentle AHAs (lactic, tartaric, citric acid). Removes dead skin build-up and brightens dull complexion. Not suitable if latex-allergic (papain cross-reactivity). Do not use daily if skin is sensitive.","descriptionTH":"ผงล้างหน้าเอนไซม์อ่อนโยนที่มีปาเปน คาโอลิน ผงข้าว สารสกัดกากข้าว และกรด AHA อ่อนๆ ขจัดเซลล์ผิวที่สะสมและทำให้ผิวกระจ่างใสขึ้น ปั้นฟองกับน้ำก่อนใช้","bestFor":"damaged barrier, dull skin, hyperpigmentation","bestForTH":"ผิวแบเรียร์เสีย, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"2-3x per week (PM). Not daily.","howOftenTH":"2-3 ครั้ง/สัปดาห์ ตอนเย็น ไม่ใช้ทุกวัน","doNotCombine":"Avoid same day as retinol, high-% AHA/BHA or peeling treatments. Latex allergy risk.","doNotCombineTH":"หลีกเลี่ยงการใช้ในวันเดียวกับเรตินอล AHA/BHA เข้มข้น หรือทรีทเมนต์ลอกผิว ระวังการแพ้ยาง","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-cleanser-rice-enzyme-brightening-cleansing-powder-1239193705.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-cleanser-rice-enzyme-brightening-cleansing-powder-1239193705.jpg"},{"id":13,"imageUrl":"https://media.augustinusbader.com/catalog/product/cache/1a4a2600ea10a3f89257e67d78389a05/a/b/ab2022-the-cream-50ml-v2_1.png","brand":"Augustinus Bader","name":"The Cream","category":"moisturizer","ingredients":"Aqua/Water/Eau, Caprylic/Capric Triglyceride, Pentylene Glycol, Propylene Glycol, Glycerin, Hydrogenated Phosphatidylcholine, Sorbitol, Tocopheryl Acetate, Butylene Glycol, Butyrospermum Parkii (Shea) Butter, Xanthan Gum, Panthenol, Sodium Carbomer, Alcohol, Aloe Barbadensis Leaf Juice, Hydrolyzed Rice Protein, Retinyl Palmitate, Helianthus Annuus (Sunflower) Seed Oil, Squalane, Phenoxyethanol, Cholesterol, Hydrogenated Lecithin, Ascorbyl Palmitate, Carbomer, Ceramide NP, Lecithin, Glycine Soja (Soybean) Protein, Superoxide Dismutase, Sodium Hydroxide, Alanyl Glutamine, Arginine, Ceramide NG, Citric Acid, Dextran, Glycine, Lysine, Oleic Acid, Palmitic Acid, Palmitoyl Tripeptide-8, Phenylalanine, Proline, Scenedesmus Rubescens Extract, Ascorbic Acid, Ethylhexylglycerin, Sodium Benzoate, Tocopherol, Brassica Alba Seed Extract, Disodium EDTA, Oligopeptide-177, Sodium Ascorbate, Sodium Dextran Sulfate, Potassium Sorbate.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["retinol","peptides","ceramides","vitamin c"],"description":"Luxury lightweight moisturizer with TFC8 (Trigger Factor Complex) — a patented blend of amino acids, vitamins and synthesised molecules that supports the skin's natural renewal. Contains squalane, panthenol, shea butter and retinyl palmitate. Minimizes pores, smooths fine lines and improves radiance with consistent use.","descriptionTH":"มอยส์เจอไรเซอร์หรูน้ำหนักเบาที่มีสารสกัด TFC8 (Trigger Factor Complex) เพื่อสนับสนุนการต่ออายุผิวตามธรรมชาติ มีสควาเลน แพนทีนอล เชียบัตเตอร์ และเรตินิลพาลมิเตต ลดรูขุมขน เรียบริ้วรอย","bestFor":"damaged barrier, dry, dull skin, hyperpigmentation, mature skin, fine lines. Caution: avoid during pregnancy","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: ห้ามใช้ระหว่างตั้งครรภ์","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts. Compatible with actives.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ ใช้ร่วมกับสารออกฤทธิ์ได้","medicubeMode":"MC","thumbnailUrl":"https://media.augustinusbader.com/catalog/product/cache/1a4a2600ea10a3f89257e67d78389a05/a/b/ab2022-the-cream-50ml-v2_1.png"},{"id":14,"brand":"Augustinus Bader","name":"The Rich Cream","category":"moisturizer","ingredients":"Aqua/Water/Eau, Coco-Caprylate/Caprate, Helianthus Annuus (Sunflower) Seed Oil, Squalane, Glycerin, Argania Spinosa Kernel Oil, Ethyl Oleate, Persea Gratissima (Avocado) Oil, Polyglyceryl-4 Oleate, Magnesium Sulfate, Oenothera Biennis (Evening Primrose) Oil, Panthenol, Polyglyceryl-6 Oleate, Zinc PCA, Polyhydroxystearic Acid, Butylene Glycol, Butyrospermum Parkii (Shea) Butter, Potassium Sorbate, Sodium Benzoate, Tocopherol, Sodium Hyaluronate, Hydrolyzed Rice Protein, Maltodextrin, Citric Acid, Camellia Sinensis Leaf Extract, Hydrogenated Lecithin, Tocopheryl Acetate, Xanthan Gum, Alanyl Glutamine, Arginine, Oligopeptide-177, Phenylalanine, Sisymbrium Irio Seed Oil, Sodium Chloride, Dextran, Palmitoyl Tripeptide-8.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","peptides"],"description":"Richer, more emollient version of The Cream with TFC8, shea butter, avocado oil, evening primrose oil and argania spinosa (argan) oil. Deeply nourishing for dry, mature, post-procedure or depleted skin. Fragrance-free. Firmer texture suitable for colder climates.","descriptionTH":"เวอร์ชั่นที่เข้มข้นกว่าของ The Cream มี TFC8 เชียบัตเตอร์ น้ำมันอะโวคาโด น้ำมันอีฟนิ่งพริมโรส และน้ำมันอาร์แกน บำรุงอย่างลึกล้ำสำหรับผิวแห้ง ผิวเจริญวัย หรือผิวที่หมดแรง ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, dry, oily, acne-prone, mature skin, fine lines","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวมัน, ผิวเป็นสิว, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://media.augustinusbader.com/catalog/product/cache/1a4a2600ea10a3f89257e67d78389a05/a/b/ab2022_the-rich-cream-50ml_2.png","thumbnailUrl":"https://media.augustinusbader.com/catalog/product/cache/1a4a2600ea10a3f89257e67d78389a05/a/b/ab2022_the-rich-cream-50ml_2.png"},{"id":15,"brand":"Beauty of Joseon","name":"Apricot Blossom Peeling Gel","category":"treatment","ingredients":"AQUA, PRUNUS MUME FLOWER WATER, CELLULOSE, METHYLPROPANEDIOL, 1,2-HEXANEDIOL, CARBOMER, ARGININE, ETHYLHEXYLGLYCERIN, ALLANTOIN, SORBITOL, DISODIUM EDTA, BUTYLENE GLYCOL, PYRUS MALUS (APPLE) FRUIT EXTRACT, CAMELLIA SINENSIS LEAF EXTRACT, HOUTTUYNIA CORDATA EXTRACT, NELUMBO NUCIFERA FLOWER EXTRACT, ORYZA SATIVA (RICE) EXTRACT, PRUNUS MUME FRUIT EXTRACT, VACCINIUM ANGUSTIFOLIUM (BLUEBERRY) FRUIT EXTRACT","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Gentle gommage-style physical exfoliator with 19% apricot blossom (Prunus mume) flower water and 8% plant cellulose that forms visible peeling balls to lift dead skin. No chemical acids. Brightens dull complexion and improves absorption of subsequent products.","descriptionTH":"เจลผลัดเซลล์ผิวแบบกอมมาจที่อ่อนโยน มีน้ำดอกแอปริคอทบลอสซั่ม 19% และเซลลูโลสจากพืช 8% ที่ก่อตัวเป็นก้อนเพื่อขจัดเซลล์ผิวที่ตายแล้ว ไม่มีกรดเคมี","bestFor":"dull skin","bestForTH":"ผิวหมองคล้ำ","howOften":"1-2x per week only. Not daily. PM use preferred.","howOftenTH":"1-2 ครั้ง/สัปดาห์เท่านั้น ไม่ใช้ทุกวัน แนะนำใช้ตอนเย็น","doNotCombine":"Do not use same session as retinol, AHA, BHA or peeling treatments.","doNotCombineTH":"อย่าใช้ในครั้งเดียวกับเรตินอล AHA BHA หรือทรีทเมนต์ลอกผิว","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/apricot-blossom-peeling-gel-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/apricot-blossom-peeling-gel-1-front.webp"},{"id":16,"brand":"Beauty of Joseon","name":"Calming Serum (Green Tea + Panthenol)","category":"serum","ingredients":"Water, Camellia Sinensis Leaf Water, Methylpropanediol, 1,2-Hexanediol, Niacinamide, Glycerin, Methyl Gluceth-20, Butylene Glycol, Ammonium Acryloyldimethyltaurate/VP Copolymer, Sodium Acrylic Acid/MA Copolymer, Sodium Hyaluronate, Ethylhexylglycerin, Carbomer, Macadamia Ternifolia Seed Oil, Tromethamine, Xanthan Gum, Panthenol, Adenosine, Coptis Japonica Root Extract, Sodium Phytate, Trisodium Ethylenediamine Disuccinate, Caprylyl Glycol, Hydrogenated Lecithin, Malachite Extract, Centella Asiatica Extract, Ficus Carica (Fig) Fruit Extract, Arginine, Lactococcus Ferment Lysate, Ceramide NP, Fructooligosaccharides, Glycolipids, Cyperus Rotundus Root Extract, Sodium Chloride","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","niacinamide","ceramides"],"description":"Lightweight soothing serum with green tea (Camellia sinensis) leaf water as the primary ingredient, 10% panthenol (vitamin B5), niacinamide, ceramide NP and centella. Specifically formulated for stressed, inflamed or reactive skin. Reduces TEWL and accelerates recovery after breakouts or irritation.","descriptionTH":"เซรั่มบรรเทาน้ำหนักเบาที่มีน้ำชาเขียวเป็นส่วนผสมหลัก แพนทีนอล 10% ไนอาซินาไมด์ เซราไมด์ NP และเซนเทลลา สูตรเฉพาะสำหรับผิวที่เครียด อักเสบ หรือระคายเคือง","bestFor":"sensitive, redness-prone, damaged barrier, dry, oily, combination, dull skin, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"AM + PM daily after toner","howOftenTH":"เช้า-เย็น ทุกวัน หลังโทนเนอร์","doNotCombine":"No significant conflicts. Excellent base layer before actives.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ เป็น base layer ที่ดีก่อนสารออกฤทธิ์","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/001_61356454-461b-424d-8ef7-32589fb88d92.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/001_61356454-461b-424d-8ef7-32589fb88d92.png"},{"id":17,"brand":"Beauty of Joseon","name":"Dynasty Cream Nourishing Cream Moisturizer","category":"moisturizer","ingredients":"AQUA, GLYCERIN, HYDROGENATED POLYDECENE, 1,2-HEXANEDIOL, NIACINAMIDE, SQUALANE, BUTYLENE GLYCOL, PROPANEDIOL, BUTYLENE GLYCOL DICAPRYLATE/DICAPRATE, CETEARYL OLIVATE, SORBITAN OLIVATE, AMMONIUM ACRYLOYLDIMETHYLTAURATE/VP COPOLYMER, XANTHAN GUM, PANAX GINSENG ROOT WATER, ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER, TROMETHAMINE, CARTHAMUS TINCTORIUS (SAFFLOWER) SEED OIL, HYDROGENATED COCONUT OIL, GLYCERYL ACRYLATE/ACRYLIC ACID COPOLYMER, ORYZA SATIVA (RICE) BRAN WATER, ETHYLHEXYLGLYCERIN, ADENOSINE, CAPRYLIC/CAPRIC TRIGLYCERIDE, DISODIUM EDTA, HYALURONIC ACID, HYDROLYZED HYALURONIC ACID, SODIUM HYALURONATE, HONEY EXTRACT, CERAMIDE NP, HYDROGENATED LECITHIN, COPTIS JAPONICA ROOT EXTRACT, RAPHANUS SATIVUS (RADISH) SEED EXTRACT, THEOBROMA CACAO (COCOA) SEED EXTRACT, LYCIUM CHINENSE FRUIT EXTRACT, DEXTRIN, PHELLINUS LINTEUS EXTRACT, SCUTELLARIA BAICALENSIS ROOT EXTRACT","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide","ceramides"],"description":"Rich nourishing cream with 10% Panax ginseng root water, niacinamide, squalane, hyaluronic acid, ceramide NP and honey extract. Provides deep hydration, supports elasticity and gives skin a subtle luminous finish. Fragrance-free formulation.","descriptionTH":"ครีมบำรุงเข้มข้นที่มีน้ำรากโสม Panax 10% ไนอาซินาไมด์ สควาเลน ไฮยาลูโรนิกแอซิด เซราไมด์ NP และสารสกัดน้ำผึ้ง ให้ความชุ่มชื้นลึก รองรับความยืดหยุ่น ปราศจากน้ำหอม","bestFor":"damaged barrier, dry, dull skin, mature skin","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"AM + PM daily as final moisturizer","howOftenTH":"เช้า-เย็น ทุกวัน เป็นมอยส์เจอไรเซอร์ขั้นตอนสุดท้าย","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/dynasty-cream-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/dynasty-cream-1-front.webp"},{"id":18,"brand":"Beauty of Joseon","name":"Ginseng Essence Water","category":"essence","ingredients":"AQUA, BUTYLENE GLYCOL, GLYCERIN, PROPANEDIOL, NIACINAMIDE, 1,2-HEXANEDIOL, PANAX GINSENG ROOT WATER, HYDROXYACETOPHENONE, GLYCERYL GLUCOSIDE, PANTHENOL, XANTHAN GUM, ALLANTOIN, DIPOTASSIUM GLYCYRRHIZATE, ADENOSINE, DEXTRIN, THEOBROMA CACAO (COCOA) EXTRACT, DISODIUM EDTA, GLUCOSE, PANAX GINSENG CALLUS CULTURE EXTRACT, PANAX GINSENG ROOT EXTRACT, PANAX GINSENG BERRY EXTRACT, ETHYLHEXYLGLYCERIN, LACTOBACILLUS/PANAX GINSENG ROOT FERMENT FILTRATE, SODIUM HYALURONATE","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide"],"description":"First-essence style watery toner with 60% Panax ginseng root water, niacinamide, glyceryl glucoside and panthenol. Prepares skin to absorb subsequent skincare steps more effectively. Anti-aging, brightening and hydrating.","descriptionTH":"โทนเนอร์น้ำสไตล์ first essence ที่มีน้ำรากโสม Panax 60% ไนอาซินาไมด์ ไกลเซอริลกลูโคไซด์ และแพนทีนอล เตรียมผิวให้ซึมซาบผลิตภัณฑ์ต่อๆ ไปได้ดียิ่งขึ้น","bestFor":"sensitive, redness-prone, dry, oily, combination, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ","howOften":"AM + PM daily after cleansing, before serum","howOftenTH":"เช้า-เย็น ทุกวัน หลังล้างหน้า ก่อนเซรั่ม","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/ginseng-essence-water-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/ginseng-essence-water-1-front.webp"},{"id":19,"brand":"Beauty of Joseon","name":"Glow Deep Serum: Rice + Alpha-Arbutin","category":"serum","ingredients":"ORYZA SATIVA (RICE) BRAN WATER, AQUA, GLYCERIN, BUTYLENE GLYCOL, 1,2-HEXANEDIOL, DIPROPYLENE GLYCOL, ALPHA-ARBUTIN, NIACINAMIDE, METHYL GLUCETH-20, PANTHENOL, POLYGLYCERIN-3, TREHALOSE, GLYCERYL GLUCOSIDE, HYDROLYZED JOJOBA ESTERS, HYDROXYETHYL ACRYLATE/SODIUM ACRYLOYLDIMETHYL TAURATE COPOLYMER, ETHYLHEXYLGLYCERIN, HYDROXYETHYLCELLULOSE, XANTHAN GUM, ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER, ARGININE, DISODIUM EDTA, SORBITAN ISOSTEARATE, GLUCOSE, COIX LACRYMA-JOBI MA-YUEN SEED EXTRACT, COPTIS JAPONICA ROOT EXTRACT, GLYCINE SOJA (SOYBEAN) SEED EXTRACT, HORDEUM DISTICHON (BARLEY) EXTRACT, ORYZA SATIVA (RICE) EXTRACT, SESAMUM INDICUM (SESAME) SEED EXTRACT, TRITICUM VULGARE (WHEAT) SEED EXTRACT, VIGNA RADIATA SEED EXTRACT, ZEA MAYS (CORN) KERNEL EXTRACT","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","arbutin"],"description":"Brightening serum with 30% rice bran water, 2% alpha-arbutin, niacinamide, glyceryl glucoside and grain complex (barley, sesame, wheat, corn, soybean). Inhibits melanin production and fades dark spots. Fragrance-free. Works synergistically with vitamin C for maximum brightening.","descriptionTH":"เซรั่มเพิ่มความกระจ่างใสที่มีน้ำรำข้าว 30% อัลฟา-อาร์บูติน 2% ไนอาซินาไมด์ ไกลเซอริลกลูโคไซด์ และสารสกัดธัญพืช ยับยั้งการผลิตเมลานินและจางรอยดำ ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, oily, combination, dull skin, hyperpigmentation","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM + PM daily. SPF essential in AM.","howOftenTH":"เช้า-เย็น ทุกวัน ต้องใช้ครีมกันแดดตอนเช้า","doNotCombine":"Avoid direct combination with high-% vitamin C serums in same session.","doNotCombineTH":"หลีกเลี่ยงการผสมโดยตรงกับวิตามินซีเข้มข้นในครั้งเดียวกัน","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/glow-deep-serum-rice-alpha-arbutin-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/glow-deep-serum-rice-alpha-arbutin-1-front.webp"},{"id":20,"brand":"Beauty of Joseon","name":"Glow Serum: Propolis + Niacinamide","category":"serum","ingredients":"AQUA, DIPROPYLENE GLYCOL, GLYCERIN, BUTYLENE GLYCOL, PROPOLIS EXTRACT, NIACINAMIDE, 1,2-HEXANEDIOL, BETAINE SALICYLATE, SODIUM POLYACRYLOYLDIMETHYL TAURATE, TROMETHAMINE, POLYGLYCERYL-10 LAURATE, XANTHAN GUM, CAPRYLYL GLYCOL, CARBOMER, ETHYLHEXYLGLYCERIN, MELIA AZADIRACHTA FLOWER EXTRACT, OCIMUM SANCTUM LEAF EXTRACT, MELIA AZADIRACHTA LEAF EXTRACT, SODIUM HYALURONATE, CURCUMA LONGA (TURMERIC) ROOT EXTRACT, DEXTRIN, THEOBROMA CACAO (COCOA) EXTRACT, CORALLINA OFFICINALIS EXTRACT, MELALEUCA ALTERNIFOLIA (TEA TREE) EXTRACT, CENTELLA ASIATICA EXTRACT, METHYLPROPANEDIOL, LOTUS CORNICULATUS SEED EXTRACT, PENTYLENE GLYCOL, OCTANEDIOL, CALOPHYLLUM INOPHYLLUM SEED OIL, TOCOPHEROL","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","niacinamide","bha"],"description":"Hydrating glow serum with 60% propolis extract (brown propolis), 2% niacinamide and tea tree extract. Calms minor inflammation, brightens and adds an instant healthy radiance. Avoid if allergic to bee/propolis products.","descriptionTH":"เซรั่มเพิ่มความกระจ่างใสที่มีสารสกัดโพรโพลิส 60% ไนอาซินาไมด์ 2% และสารสกัดใบชา ลดการอักเสบเล็กน้อย เพิ่มความกระจ่างใส หลีกเลี่ยงหากแพ้โพรโพลิส","bestFor":"dry, oily, combination, acne-prone, dull skin","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวเป็นสิว, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Avoid if allergic to bee products. Caution with strong vitamin C.","doNotCombineTH":"หลีกเลี่ยงหากแพ้ผลิตภัณฑ์จากผึ้ง ระวังเมื่อใช้ร่วมกับวิตามินซีเข้มข้น","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/glow-serum-propolis-niacinamide-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/glow-serum-propolis-niacinamide-1-front.webp"},{"id":21,"brand":"Beauty of Joseon","name":"Green Plum Refreshing Cleanser","category":"cleanser","ingredients":"AQUA, PRUNUS MUME FRUIT WATER, COCAMIDOPROPYL HYDROXYSULTAINE, SODIUM COCOYL ISETHIONATE, GLYCERIN, SODIUM CHLORIDE, 1,2-HEXANEDIOL, HYDROXYACETOPHENONE, COCONUT ACID, CAPRYLYL GLYCOL, ETHYLHEXYLGLYCERIN, CITRIC ACID, DISODIUM EDTA, PHASEOLUS RADIATUS SEED EXTRACT, SODIUM ISETHIONATE, GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE, DEXTRIN, MELIA AZADIRACHTA LEAF EXTRACT, MELIA AZADIRACHTA FLOWER EXTRACT, GARDENIA FLORIDA FRUIT EXTRACT, PROPYLENE GLYCOL LAURATE, SODIUM CITRATE, BUTYLENE GLYCOL, CAMELLIA SINENSIS LEAF EXTRACT, HOUTTUYNIA CORDATA EXTRACT, NELUMBO NUCIFERA FLOWER EXTRACT, ORYZA SATIVA (RICE) EXTRACT, PRUNUS MUME FRUIT EXTRACT, VACCINIUM ANGUSTIFOLIUM (BLUEBERRY) FRUIT EXTRACT","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Low-pH gel cleanser with green plum (Prunus mume) fruit water and gentle amino acid surfactants. Mildly exfoliating from the plum's natural AHAs. Leaves skin clean without tightness. Good for AM cleansing on oily skin.","descriptionTH":"เจลล้างหน้า pH ต่ำที่มีน้ำผลพลัมเขียวและสารลดแรงตึงผิวกรดอะมิโนอ่อนโยน ผลัดเซลล์ผิวเล็กน้อยจาก AHA ธรรมชาติ ทำความสะอาดโดยไม่ตึงผิว","bestFor":"sensitive, redness-prone, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off product","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/green-plum-refreshing-cleanser-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/green-plum-refreshing-cleanser-1-front.webp"},{"id":22,"brand":"Beauty of Joseon","name":"Ground Rice & Honey Glow Mask","category":"treatment","ingredients":"AQUA, KAOLIN, HONEY, GLYCERIN, PROPANEDIOL, DIPROPYLENE GLYCOL, ORYZA SATIVA (RICE) HULL POWDER, ISONONYL ISONONANOATE, 1,2-HEXANEDIOL, CETYL ALCOHOL, CAPRYLIC/CAPRIC TRIGLYCERIDE, POLYGLYCERYL-3 METHYLGLUCOSE DISTEARATE, BUTYLENE GLYCOL, GLYCERYL STEARATE, ORYZA SATIVA (RICE) BRAN, BENTONITE, PALMITIC ACID, STEARIC ACID, HYDROXYACETOPHENONE, BEHENYL ALCOHOL, CELLULOSE, ZEA MAYS (CORN) STARCH, ETHYLHEXYLGLYCERIN, XANTHAN GUM, POTASSIUM CETYL PHOSPHATE, ORYZA SATIVA (RICE) LEES EXTRACT, POLYACRYLATE-13, HYDROGENATED POLYISOBUTENE, SODIUM PHYTATE, POLYGLYCERYL-10 LAURATE, ETHYLHEXYL PALMITATE, SORBITAN ISOSTEARATE, ORYZA SATIVA (RICE) EXTRACT, MENTHYL LACTATE, HONEY EXTRACT","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Wash-off brightening mask with ground rice hull powder, honey, propolis and kaolin. The rice hull provides gentle physical exfoliation while honey and propolis deeply nourish. Reveals glowing skin in 10-15 minutes. Avoid if allergic to bee products.","descriptionTH":"มาส์กล้างออกเพื่อเพิ่มความกระจ่างใสที่มีผงเปลือกข้าว น้ำผึ้ง โพรโพลิส และคาโอลิน เปลือกข้าวช่วยผลัดเซลล์ผิวเบาๆ หลีกเลี่ยงหากแพ้ผลิตภัณฑ์จากผึ้ง","bestFor":"dull skin","bestForTH":"ผิวหมองคล้ำ","howOften":"1-2x per week as a PM treatment","howOftenTH":"1-2 ครั้ง/สัปดาห์ เป็นทรีทเมนต์ตอนเย็น","doNotCombine":"Do not use same session as retinol or chemical exfoliants.","doNotCombineTH":"อย่าใช้ในครั้งเดียวกับเรตินอลหรือกรดเคมี","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/ground-rice-honey-glow-mask-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/ground-rice-honey-glow-mask-1-front.webp"},{"id":23,"brand":"Beauty of Joseon","name":"Radiance Cleansing Balm","category":"oil cleanser","subcategory":"cleansing balm","ingredients":"CETYL ETHYLHEXANOATE, CAPRYLIC/CAPRIC TRIGLYCERIDE, PEG-20 GLYCERYL TRIISOSTEARATE, SYNTHETIC WAX, PEG-10 ISOSTEARATE, SORBITAN SESQUIOLEATE, HIPPOPHAE RHAMNOIDES OIL, ORYZA SATIVA (RICE) BRAN OIL, AQUA, ORYZA SATIVA (RICE) SEED WATER, GLYCERIN, PROPANEDIOL, 1,2-HEXANEDIOL, LACTOBACILLUS/SOYBEAN FERMENT EXTRACT, BUTYLENE GLYCOL, COIX LACRYMA-JOBI MA-YUEN SEED EXTRACT, ORYZA SATIVA (RICE) EXTRACT, AVENA SATIVA (OAT) MEAL EXTRACT, ETHYLHEXYLGLYCERIN, CAPRYLYL GLYCOL","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Sherbet-textured first-cleanse balm with rice bran oil, sea buckthorn oil and oat extract. Melts SPF, makeup and excess sebum effortlessly. Rinses clean without leaving residue. One of the most recommended Korean cleansing balms for sensitive skin.","descriptionTH":"คลีนซิ่งบาล์มเนื้อเชอร์เบทสำหรับทำความสะอาดรอบแรกที่มีน้ำมันรำข้าว น้ำมันซีบัคธอร์น และสารสกัดข้าวโอ๊ต ละลายครีมกันแดด เครื่องสำอาง ล้างออกสะอาด","bestFor":"sensitive, dull skin","bestForTH":"ผิวบอบบาง, ผิวหมองคล้ำ","howOften":"PM daily as first cleanse","howOftenTH":"ตอนเย็น ทุกวัน เป็นขั้นตอนทำความสะอาดแรก","doNotCombine":"N/A — wash-off product","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/radiance-cleansing-balm-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/radiance-cleansing-balm-1-front.webp"},{"id":24,"brand":"Beauty of Joseon","name":"Red Bean Water Gel","category":"toner","ingredients":"AQUA, BUTYLENE GLYCOL, GLYCERIN, 1,2-HEXANEDIOL, METHYL TRIMETHICONE, PHASEOLUS ANGULARIS SEED EXTRACT, ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER, TROMETHAMINE, GLYCERYL GLUCOSIDE, C12-14 ALKETH-12, MALTODEXTRIN, AMMONIUM ACRYLOYLDIMETHYLTAURATE/VP COPOLYMER, DIMETHICONE/VINYL DIMETHICONE CROSSPOLYMER, DIMETHICONE CROSSPOLYMER, ETHYLHEXYLGLYCERIN, BETAINE, PANTHENOL, ALLANTOIN, DIPOTASSIUM GLYCYRRHIZATE, POLYQUATERNIUM-51, XANTHAN GUM, DISODIUM EDTA, GLYCERYL ACRYLATE/ACRYLIC ACID COPOLYMER, DIOSCOREA JAPONICA ROOT EXTRACT, GLUCOSE, SODIUM CITRATE, BETA-GLUCAN, HYDROLYZED CORN STARCH, CITRIC ACID, SUCROSE, MAGNESIUM ASCORBYL PHOSPHATE, CAPRYLYL GLYCOL, HELIANTHUS ANNUUS (SUNFLOWER) SEED OIL, TOCOPHEROL, CYANOCOBALAMIN, GLYCINE, SERINE, GLUTAMIC ACID, ASPARTIC ACID, LEUCINE, ACETYL HEXAPEPTIDE-8, ALANINE, LYSINE, ARGININE, TYROSINE, PHENYLALANINE, PROLINE, THREONINE, VALINE, ISOLEUCINE, HISTIDINE, CYSTEINE, METHIONINE, PHOSPHORIC ACID, ASCORBIC ACID, SH-OLIGOPEPTIDE-1, SH-OLIGOPEPTIDE-2, SH-POLYPEPTIDE-1","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","peptides"],"description":"Oil-free gel moisturizer with red bean (Phaseolus angularis) extract, niacinamide, sodium hyaluronate, peptides and magnesium ascorbyl phosphate (vitamin C derivative). Controls sebum, refines pores and provides light hydration. Suitable for warm climates.","descriptionTH":"เจลมอยส์เจอไรเซอร์ไม่มีน้ำมันที่มีสารสกัดถั่วแดง ไนอาซินาไมด์ โซเดียมไฮยาลูโรเนต เปปไทด์ และอนุพันธ์วิตามินซี ควบคุมน้ำมันส่วนเกิน ลดรูขุมขน","bestFor":"sensitive, redness-prone, damaged barrier, dull skin, hyperpigmentation","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/red-bean-water-gel-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/red-bean-water-gel-1-front.webp"},{"id":25,"brand":"Beauty of Joseon","name":"Relief Sun: Rice + Probiotics SPF50+","category":"sunscreen","ingredients":"AQUA, DIBUTYL ADIPATE, PROPANEDIOL, DIETHYLAMINO HYDROXYBENZOYL HEXYL BENZOATE, POLYMETHYLSILSESQUIOXANE, ETHYLHEXYL TRIAZONE, METHYLENE BIS-BENZOTRIAZOLYL TETRAMETHYLBUTYLPHENOL (NANO), NIACINAMIDE, COCO-CAPRYLATE/CAPRATE, CAPRYLYL METHICONE, DIETHYLHEXYL BUTAMIDO TRIAZONE, GLYCERIN, 1,2-HEXANEDIOL, BUTYLENE GLYCOL, PENTYLENE GLYCOL, BEHENYL ALCOHOL, POLY C10-30 ALKYL ACRYLATE, POLYGLYCERYL-3 METHYLGLUCOSE DISTEARATE, DECYL GLUCOSIDE, ORYZA SATIVA (RICE) EXTRACT, TROMETHAMINE, CARBOMER, ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER, SODIUM STEAROYL GLUTAMATE, POLYACRYLATE CROSSPOLYMER-6, ETHYLHEXYLGLYCERIN, ADENOSINE, XANTHAN GUM, T-BUTYL ALCOHOL, TOCOPHEROL, ORYZA SATIVA (RICE) GERM EXTRACT, CAMELLIA SINENSIS LEAF EXTRACT, SACCHARUM OFFICINARUM (SUGARCANE) EXTRACT, MACROCYSTIS PYRIFERA (KELP) EXTRACT, LACTOBACILLUS/PUMPKIN FERMENT EXTRACT, BACILLUS/SOYBEAN FERMENT EXTRACT, ASPERGILLUS FERMENT, COCOS NUCIFERA (COCONUT) FRUIT EXTRACT, PANAX GINSENG ROOT EXTRACT, MONASCUS/RICE FERMENT, LACTOBACILLUS/RICE FERMENT, SACCHAROMYCES/RICE FERMENT FILTRATE","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide"],"description":"Beloved lightweight chemical sunscreen SPF50+/PA++++ with rice extract, 5 grain ferment strains (lactobacillus, bacillus, aspergillus, saccharomyces, monascus), adenosine and kelp extract. Non-white-cast, non-greasy matte-dewy finish. Fragrance-free formulation.","descriptionTH":"ครีมกันแดดเคมี SPF50+/PA++++ ที่ได้รับความนิยมสูงสุด มีสารสกัดข้าว เชื้อจุลินทรีย์หมัก 5 สายพันธุ์ ไม่ทิ้งคราบขาว ไม่มัน ปราศจากน้ำหอม","bestFor":"dull skin","bestForTH":"ผิวหมองคล้ำ","howOften":"AM daily, reapply every 2 hours outdoors","howOftenTH":"ทุกเช้า ทาซ้ำทุก 2 ชั่วโมงเมื่ออยู่กลางแจ้ง","doNotCombine":"N/A — sunscreen.","doNotCombineTH":"ไม่มี — ครีมกันแดด","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/relief-sunscreen-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/relief-sunscreen-1-front.webp"},{"id":26,"brand":"Beauty of Joseon","name":"Revive Eye Serum (Ginseng + Retinal)","category":"eye","ingredients":"AQUA, GLYCERIN, DIPROPYLENE GLYCOL, CAPRYLIC/CAPRIC TRIGLYCERIDE, 1,2-HEXANEDIOL, BUTYLENE GLYCOL DICAPRYLATE/DICAPRATE, NIACINAMIDE, PENTAERYTHRITYL TETRAETHYLHEXANOATE, CETEARYL ALCOHOL, CETEARYL OLIVATE, SORBITAN OLIVATE, BUTYLENE GLYCOL, HYDROGENATED LECITHIN, PANAX GINSENG ROOT EXTRACT, CARBOMER, GLYCERYL STEARATE, TROMETHAMINE, MACADAMIA TERNIFOLIA SEED OIL, ETHYLHEXYLGLYCERIN, ADENOSINE, CHOLESTEROL, DEXTRIN, POLYGLYCERYL-10 OLEATE, THEOBROMA CACAO (COCOA) EXTRACT, DISODIUM EDTA, BRASSICA CAMPESTRIS (RAPESEED) STEROLS, PHYTOSTERYL/BEHENYL/OCTYLDODECYL LAUROYL GLUTAMATE, RETINAL, SILICA, ALUMINUM/MAGNESIUM HYDROXIDE STEARATE, SODIUM HYALURONATE, TOCOPHEROL, POTASSIUM CETYL PHOSPHATE, PENTAERYTHRITYL TETRA-DI-T-BUTYL HYDROXYHYDROCINNAMATE, CERAMIDE NP, PALMITOYL TRIPEPTIDE-5","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["peptides","hyaluronic acid","retinol","ceramides","niacinamide"],"description":"Fragrance-free, gentle eye serum with retinal (retinaldehyde) encapsulated in liposomes for controlled release, 10% Panax ginseng root extract, niacinamide, squalane and ceramide NP. Targets fine lines, crow's feet and dullness around the eye area. Retinal is more stable and less irritating than retinol.","descriptionTH":"เซรั่มรอบดวงตาปราศจากน้ำหอม มีเรตินัลห่อหุ้มในลิโพโซม สารสกัดรากโสม Panax 10% ไนอาซินาไมด์ สควาเลน และเซราไมด์ NP แก้ไขริ้วรอย รอยตีนกา และความหมองคล้ำรอบดวงตา","bestFor":"damaged barrier, dry, oily, combination, dull skin, mature skin, fine lines. Caution: avoid during pregnancy","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: ห้ามใช้ระหว่างตั้งครรภ์","howOften":"PM daily. Start every other night. Always SPF next AM.","howOftenTH":"ตอนเย็น ทุกวัน เริ่มวันเว้นวัน ใช้ครีมกันแดดทุกเช้า","doNotCombine":"Do not combine with other retinoids, AHA/BHA, or vitamin C in same session. Avoid in pregnancy.","doNotCombineTH":"ห้ามใช้ร่วมกับเรตินอยด์อื่น AHA/BHA หรือวิตามินซีในครั้งเดียวกัน หลีกเลี่ยงระหว่างตั้งครรภ์","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/revive-eye-serum-ginseng-retinal-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/revive-eye-serum-ginseng-retinal-1-front.webp"},{"id":27,"brand":"Beauty of Joseon","name":"Revive Serum: Ginseng + Snail Mucin","category":"serum","ingredients":"AQUA, BUTYLENE GLYCOL, DIPROPYLENE GLYCOL, 1,2-HEXANEDIOL, GLYCERIN, NIACINAMIDE, PROPANEDIOL, PANAX GINSENG ROOT WATER, TREHALOSE, SNAIL SECRETION FILTRATE, CARBOMER, TROMETHAMINE, XANTHAN GUM, MALT EXTRACT, SODIUM POLYACRYLATE, ADENOSINE, GLYCERYL ACRYLATE/ACRYLIC ACID COPOLYMER, DISODIUM EDTA, GANODERMA LUCIDUM (MUSHROOM) EXTRACT, PANAX GINSENG ROOT EXTRACT, PHELLINUS LINTEUS EXTRACT, CENTELLA ASIATICA EXTRACT, SODIUM HYALURONATE, HYDROLYZED HYALURONIC ACID, FORSYTHIA SUSPENSA FRUIT EXTRACT, LONICERA JAPONICA (HONEYSUCKLE) FLOWER EXTRACT, SCUTELLARIA BAICALENSIS ROOT EXTRACT, SODIUM ACETYLATED HYALURONATE","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","niacinamide"],"description":"Hydrating anti-aging serum with ginseng root water, snail secretion filtrate, centella asiatica extract and multiple hyaluronic acid forms. Plumps skin, supports repair and gives a glowing finish.","descriptionTH":"เซรั่มต้านริ้วรอยที่ให้ความชุ่มชื้น มีน้ำรากโสม น้ำเมือกหอยทาก สารสกัดเซนเทลลา และไฮยาลูโรนิกแอซิดหลายรูปแบบ เติมเต็มผิว รองรับการฟื้นตัว","bestFor":"sensitive, redness-prone, dry, oily, combination, dull skin, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/revive-serum-ginseng-snail-mucin-1-front.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0558/4135/7989/files/revive-serum-ginseng-snail-mucin-1-front.webp"},{"id":28,"imageUrl":"https://static.thcdn.com/productimg/original/14921315-9785336744458419.jpg","brand":"Bioderma","name":"Atoderm Intensive Eye Cream","category":"eye","ingredients":"AQUA/WATER/EAU, GLYCERIN, PARAFFINUM LIQUIDUM/MINERAL OIL/HUILE MINERALE, HELIANTHUS ANNUUS (SUNFLOWER) SEED OIL, DIPROPYLENE, GLYCOL, BRASSICA CAMPESTRIS (RAPESEED) SEED OIL, HYDROXYETHYL ACRYLATE/SODIUM ACRYLOYLDIMETHYL TAURATE COPOLYMER, SUCROSE, STEARATE, 1,2-HEXANEDIOL, GLYCYRRHETINIC ACID, SODIUM CITRATE, POLYSORBATE 60, SORBITAN ISOSTEARATE, MANNITOL, SODIUM LAUROYL, LACTYLATE, XYLITOL, CITRIC ACID, PENTYLENE GLYCOL, RHAMNOSE, TOCOPHEROL, PHYTOSPHINGOSINE, CERAMIDE NP, SODIUM HYALURONATE, ETHYLHEXYLGLYCERIN, CERAMIDE AP, CHOLESTEROL, CARBOMER, XANTHAN GUM, FRUCTOOLIGOSACCHARIDES, CAPRYLIC/CAPRIC TRIGLYCERIDE, LAMINARIA OCHROLEUCA EXTRACT, CERAMIDE EOP. [BI 478]","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Dermatologist-tested, fragrance-free eye cream for atopic-prone and very dry skin around the eye area. Contains niacinamide, ceramide NP/AP/EOP, glycyrrhetinic acid (licorice) and emollient lipids. Reduces irritation and supports the delicate periorbital skin barrier.","descriptionTH":"ครีมรอบดวงตาที่ทดสอบโดยผู้เชี่ยวชาญผิวหนัง ปราศจากน้ำหอม สำหรับผิวแพ้และผิวแห้งมากรอบดวงตา มีไนอาซินาไมด์ เซราไมด์ NP/AP/EOP กรดไกลเซอไรเธนิก","bestFor":"damaged barrier, dry, mature skin","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","thumbnailUrl":"https://static.thcdn.com/productimg/original/14921315-9785336744458419.jpg"},{"id":29,"imageUrl":"https://back-ac-prod.bioderma.com/media/catalog/product/cache/b443460c314aa18d2c50e93a48ddeb50/e/0/e0959c7d2924fc45cc600c7debfb1f1b-_7b171692_7d__7bbio_sensibio_h2o_7d__7b28709a_7d_1.png","brand":"Bioderma","name":"Sensibio H2O Micellar Water","category":"toner","ingredients":"AQUA/WATER/EAU, PEG-6 CAPRYLIC/CAPRIC GLYCERIDES, DISODIUM EDTA, CETRIMONIUM BROMIDE, PROPYLENE GLYCOL, CUCUMIS SATIVUS, (CUCUMBER) FRUIT EXTRACT, FRUCTOOLIGOSACCHARIDES, MANNITOL, XYLITOL","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"The original gentle micellar water — fragrance-free, no-rinse formula with mild PEG-6 caprylic/capric glycerides micelles and cucumber extract. Removes makeup, SPF and daily grime without rubbing. Hypoallergenic and tested on sensitive skin.","descriptionTH":"ไมเซลลาร์วอเตอร์อ่อนโยนต้นตำรับ ปราศจากน้ำหอม ไม่ต้องล้างออก มีไมเซลล์ PEG-6 และสารสกัดแตงกวา ลบเครื่องสำอางโดยไม่ต้องถู","bestFor":"All skin types","bestForTH":"ผิวทุกประเภท","howOften":"AM and/or PM as needed","howOftenTH":"เช้าและ/หรือเย็น ตามความต้องการ","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","thumbnailUrl":"https://back-ac-prod.bioderma.com/media/catalog/product/cache/b443460c314aa18d2c50e93a48ddeb50/e/0/e0959c7d2924fc45cc600c7debfb1f1b-_7b171692_7d__7bbio_sensibio_h2o_7d__7b28709a_7d_1.png"},{"id":30,"brand":"COSRX","name":"AHA/BHA Clarifying Toner","category":"toner","ingredients":"Water, Salix Alba (Willow) Bark Water, Pyrus Malus (Apple) Fruit Water, Butylene Glycol, 1,2-Hexanediol, Sodium Lactate, Glycolic Acid, Betaine Salicylate, Allantoin, Panthenol, Ethyl Hexanediol","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["bha","aha"],"description":"Lightweight exfoliating toner with willow bark water (natural BHA source), glycolic acid (AHA) and betaine salicylate. Mildly unclogs pores and resurfaces dull skin. Low-concentration for everyday use.","descriptionTH":"โทนเนอร์ผลัดเซลล์ผิวน้ำหนักเบาที่มีน้ำเปลือกวิลโลว์ กรดไกลโคลิก และเบตาอีน ซาลิไซเลต เปิดรูขุมขนและผลัดผิวหมองคล้ำเบาๆ","bestFor":"oily, acne-prone","bestForTH":"ผิวมัน, ผิวเป็นสิว","howOften":"PM daily or every other day. Not for sensitive/compromised barrier.","howOftenTH":"ตอนเย็น ทุกวันหรือวันเว้นวัน ไม่เหมาะสำหรับผิวแพ้ง่ายหรือเกราะผิวเสียหาย","doNotCombine":"Avoid same session with retinol, vitamin C, other strong acids.","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับเรตินอล วิตามินซี หรือกรดเข้มข้นอื่น","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/ahabha-clarifying-treatment-toner-cosrx-official-1.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/ahabha-clarifying-treatment-toner-cosrx-official-1.jpg"},{"id":31,"brand":"COSRX","name":"Advanced Snail 92 All in One Cream","category":"moisturizer","ingredients":"Snail Secretion Filtrate, Betaine, Caprylic/Capric Triglyceride, Butylene Glycol, Cetearyl Olivate, Sorbitan Olivate, Cetearyl Alcohol, Carbomer, Ethyl Hexanediol, Phenoxyethanol, Arginine, Dimethicone, Sodium Polyacrylate, Sodium Hyaluronate, Allantoin, Palmitic Acid, Panthenol, Xanthan Gum, Stearic acid, Adenosine, Water, Myristic Acid","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid"],"description":"Cult-favourite lightweight gel-cream with 92% snail secretion filtrate, panthenol, allantoin and adenosine. Hydrates, calms redness, helps fade acne marks and supports repair. Fragrance-free and non-comedogenic.","descriptionTH":"เจลครีมขายดีที่มีน้ำเมือกหอยทาก 92% แพนทีนอล อัลแลนทอยน์ และอะดีโนซีน ให้ความชุ่มชื้น ลดรอยแดง ช่วยจางรอยดำหลังสิว ปราศจากน้ำหอมและไม่อุดรูขุมขน","bestFor":"sensitive, redness-prone, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/snail_cream_thumbnail.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/snail_cream_thumbnail.png"},{"id":32,"brand":"COSRX","name":"Advanced Snail 96 Mucin Essence","category":"essence","ingredients":"Snail Secretion Filtrate, Betaine, Butylene Glycol, 1,2-Hexanediol, Sodium Polyacrylate, Phenoxyethanol, Sodium Hyaluronate, Allantoin, Ethyl Hexanediol, Carbomer, Panthenol, Arginine","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid"],"description":"Hero essence with 96.3% snail secretion filtrate, betaine and panthenol. Extremely hydrating, promotes skin repair and helps fade PIH. The slippery texture makes it an ideal slip medium for device use (Medicube MC Mode).","descriptionTH":"เอสเซนส์หลักที่มีน้ำเมือกหอยทาก 96.3% เบตาอีน และแพนทีนอล ให้ความชุ่มชื้นสูงมาก ส่งเสริมการซ่อมแซมผิวและช่วยจางรอยดำ PIH เนื้อสัมผัสลื่นเหมาะสำหรับ MC Mode","bestFor":"sensitive, redness-prone, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง","howOften":"AM + PM daily after toner","howOftenTH":"เช้า-เย็น ทุกวัน หลังโทนเนอร์","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/james_800x1067_1_1_4e9750cc-2cd6-4817-ace5-be2305a85806.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/james_800x1067_1_1_4e9750cc-2cd6-4817-ace5-be2305a85806.jpg"},{"id":33,"brand":"COSRX","name":"Advanced The Vitamin C 23 Serum","category":"serum","ingredients":"Aqua/Water, Ascorbic Acid(23%), Butylene Glycol, Dimethicone, Panthenol, 3-O-Ethyl Ascorbic Acid, Squalane, Sodium Hydroxide, Caffeine, Sodium Hyaluronate, Sodium Metaphosphate, Adenosine, Acetyl Glucosamine, Gardenia Florida Fruit Extract, Allantoin, Dextrin, Tocotrienols, Tocopherol, Elaeis Guineensis (Palm) Oil, Arginine, Niacinamide, Pentylene Glycol, Glutathione, Helianthus Annuus (Sunflower) Seed Oil, Methyl Trimethicone, Carthamus Tinctorius (Safflower) Seed Oil, Camellia Japonica Seed Oil, Daucus Carota Sativa (Carrot) Root Extract, Glycyrrhiza Glabra (Licorice) Root Extract, Beta-Carotene","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid","niacinamide"],"description":"Potent 23% pure L-ascorbic acid serum with vitamin E, niacinamide, glutathione and squalane. Maximum-strength brightening for experienced users. Expect tingling. Store in refrigerator after opening. Not for sensitive or compromised-barrier skin. Always follow with SPF.","descriptionTH":"เซรั่มกรดแอสคอร์บิกบริสุทธิ์ 23% กับวิตามินอี ไนอาซินาไมด์ กลูตาไธโอน และสควาเลน ความเข้มข้นสูงสุดสำหรับผู้ใช้ที่มีประสบการณ์ ไม่เหมาะสำหรับผิวแพ้ง่าย ต้องใช้ครีมกันแดดเสมอ","bestFor":"oily, combination, normal — experienced users only. Caution: not for sensitive skin, contains alcohol","bestForTH":"ผิวมัน, ผิวผสม, ผิวปกติ — สำหรับผู้มีประสบการณ์. ระวัง: ไม่เหมาะสำหรับผิวบอบบาง, มีแอลกอฮอล์","howOften":"AM daily or every other day. Always SPF immediately after.","howOftenTH":"ทุกเช้าหรือวันเว้นวัน ต้องทาครีมกันแดดทันทีหลังใช้","doNotCombine":"NEVER combine with retinol, AHA, BHA, benzoyl peroxide, high-% niacinamide or copper peptides in same session.","doNotCombineTH":"ห้ามใช้ร่วมกับเรตินอล AHA BHA เบนโซอิลเพอร์ออกไซด์ ไนอาซินาไมด์เข้มข้น หรือคอปเปอร์เปปไทด์ในครั้งเดียวกัน","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/Advanced_VitaminC23_00.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/Advanced_VitaminC23_00.webp"},{"id":34,"brand":"COSRX","name":"BHA Blackhead Power Liquid","category":"treatment","subcategory":"spot treatment","ingredients":"Salix Alba (Willow) Bark Water, Butylene Glycol, Betaine Salicylate, Niacinamide, 1,2-Hexanediol, Arginine, Panthenol, Sodium Hyaluronate, Xanthan Gum, Ethyl Hexanediol","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide","bha"],"description":"4% betaine salicylate (a gentle BHA-equivalent) liquid exfoliant with willow bark water, niacinamide and sodium hyaluronate. Dissolves the sebum plugs causing blackheads and rough skin texture without the stronger irritation of pure salicylic acid.","descriptionTH":"เอกโฟลิแอนต์ลิควิดที่มีเบตาอีน ซาลิไซเลต 4% น้ำเปลือกวิลโลว์ ไนอาซินาไมด์ และโซเดียมไฮยาลูโรเนต ละลายไขมันที่อุดตันทำให้เกิดสิวหัวดำ","bestFor":"oily, acne-prone, dull skin","bestForTH":"ผิวมัน, ผิวเป็นสิว, ผิวหมองคล้ำ","howOften":"PM daily or every other day. Not for inflamed/broken skin.","howOftenTH":"ตอนเย็น ทุกวันหรือวันเว้นวัน ไม่ใช้กับผิวอักเสบหรือผิวที่มีแผล","doNotCombine":"Avoid same session with retinol, AHA, strong vitamin C.","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับเรตินอล AHA และวิตามินซีเข้มข้น","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/bha-blackhead-power-liquid-cosrx-official-1.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/bha-blackhead-power-liquid-cosrx-official-1.jpg"},{"id":35,"brand":"COSRX","name":"Full Fit Propolis Toner","category":"toner","ingredients":"Propolis Extract, Honey Extract, Butylene Glycol, 1,2-Hexanediol, Glycerin, Betaine, Cassia Obtusifolia Seed Extract, Panthenol, Polyglyceryl-10 Laurate, Polyglyceryl-10 Myristate, Ethylhexylglycerin, Sodium Hyaluronate, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Caprylic/Capric Triglyceride","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid"],"description":"Nourishing toner with 72.6% propolis extract and honey extract. Rich in natural antioxidants. Gives skin a honey-like glow and smooth texture. Not for those allergic to bee/propolis products.","descriptionTH":"โทนเนอร์บำรุงที่มีสารสกัดโพรโพลิส 72.6% และน้ำผึ้ง อุดมด้วยสารต้านอนุมูลอิสระธรรมชาติ ให้ผิวดูเปล่งปลั่งเหมือนน้ำผึ้ง ไม่เหมาะสำหรับผู้แพ้โพรโพลิส","bestFor":"sensitive, redness-prone, dry, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Avoid if bee/propolis-allergic.","doNotCombineTH":"หลีกเลี่ยงหากแพ้ผลิตภัณฑ์จากผึ้งหรือโพรโพลิส","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/full-fit-propolis-synergy-toner-cosrx-official-1.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/full-fit-propolis-synergy-toner-cosrx-official-1.jpg"},{"id":36,"brand":"COSRX","name":"Low pH Good Morning Gel Cleanser","category":"cleanser","ingredients":"Water, Cocamidopropyl Betaine, Sodium Lauroyl Methyl Isethionate, Sodium Chloride, Polysorbate 20, Styrax Japonicus Branch/Fruit/Leaf Extract, Butylene Glycol, Saccharomyces Ferment, Cryptomeria Japonica Leaf Extract, Nelumbo Nucifera Leaf Extract, Pinus Palustris Leaf Extract, Ulmus Davidiana Root Extract, Oenothera Biennis (Evening Primrose) Flower Extract, Pueraria Lobata Root Extract, Melaleuca Alternifolia (Tea Tree) Leaf Oil, Allantoin, Caprylyl Glycol, Ethylhexylglycerin, Betaine Salicylate, Citric Acid, Ethyl Hexanediol, 1,2-Hexanediol, Trisodium Ethylenediamine Disuccinate, Sodium Benzoate, Disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":["bha"],"description":"Mild low-pH (5.0-5.5) gel cleanser with tea tree leaf oil, betaine salicylate and multiple botanical extracts. Controls morning oiliness and preps skin for actives. Not for very sensitive skin — the tea tree oil may irritate reactive users.","descriptionTH":"เจลล้างหน้า pH ต่ำ (5.0-5.5) มีน้ำมันชาเขียว เบตาอีน ซาลิไซเลต ควบคุมความมันตอนเช้าและเตรียมผิวสำหรับสารออกฤทธิ์ ไม่เหมาะสำหรับผิวแพ้ง่ายมาก","bestFor":"acne-prone, dull skin. Caution: contains essential oils","bestForTH":"ผิวเป็นสิว, ผิวหมองคล้ำ. ระวัง: มีน้ำมันหอมระเหย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/low-ph-good-morning-gel-cleanser-cosrx-official-1.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/low-ph-good-morning-gel-cleanser-cosrx-official-1.jpg"},{"id":37,"brand":"COSRX","name":"The 6 Peptide Skin Booster Serum","category":"serum","ingredients":"Water, Cocamidopropyl Betaine, Sodium Lauroyl Methyl Isethionate, Sodium Chloride, Polysorbate 20, Styrax Japonicus Branch/Fruit/Leaf Extract, Butylene Glycol, Saccharomyces Ferment, Cryptomeria Japonica Leaf Extract, Nelumbo Nucifera Leaf Extract, Pinus Palustris Leaf Extract, Ulmus Davidiana Root Extract, Oenothera Biennis (Evening Primrose) Flower Extract, Pueraria Lobata Root Extract, Melaleuca Alternifolia (Tea Tree) Leaf Oil, Allantoin, Caprylyl Glycol, Ethylhexylglycerin, Betaine Salicylate, Citric Acid, Ethyl Hexanediol, 1,2-Hexanediol, Trisodium Ethylenediamine Disuccinate, Sodium Benzoate, Disodium EDTAWater, Dipropylene Glycol, Glycerin, Pentylene Glycol, 1,2-Hexanediol, Niacinamide, Acetyl Hexapeptide-8, Copper Tripeptide-1, sh-Polypeptide-121, Dipeptide Diaminobutyroyl Benzylamide Diacetate, Oligopeptide-68, Palmitoyl Tripeptide-8, Allantoin, Sodium Hyaluronate, Acetyl Glucosamine, Serine, Alanine, Glycine, Threonine, Arginine, Proline, Betaine, Sodium PCA, Sodium Lactate, PCA, Glutamic Acid, Lysine HCl, Tocopherol, Dextran, Glycine Soja (Soybean) Oil, Hydrogenated Lecithin, Ammonium Acryloyldimethyltaurate/VP Copolymer, Polyacrylate Crosspolymer-6, Butylene Glycol, Xanthan Gum, Ethylhexylglycerin, Adenosine, Polyquaternium-51, Disodium EDTA, Citric Acid, Caprylyl Glycol, t-Butyl Alcohol, Potassium Sorbate, Sodium Oleate","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":["hyaluronic acid","peptides","niacinamide","bha"],"description":"Peptide-focused booster serum with six peptides (Acetyl Hexapeptide-8, Copper Tripeptide-1, sh-Polypeptide-121, Dipeptide Diaminobutyroyl Benzylamide Diacetate, Oligopeptide-68, Palmitoyl Tripeptide-8) plus niacinamide, hyaluronic acid and acetyl glucosamine. Targets firmness, plumpness and elasticity.","descriptionTH":"เซรั่มบูสเตอร์ที่เน้นเปปไทด์ 6 ชนิด บวกกับไนอาซินาไมด์ ไฮยาลูโรนิกแอซิด และอะซีทิลกลูโคซามีน มุ่งเป้าที่ความกระชับ ความอิ่มน้ำ และความยืดหยุ่น","bestFor":"dry, oily, combination, acne-prone, dull skin, mature skin, fine lines. Caution: contains essential oils","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวเป็นสิว, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: มีน้ำมันหอมระเหย","howOften":"AM + PM daily after toner","howOftenTH":"เช้า-เย็น ทุกวัน หลังโทนเนอร์","doNotCombine":"Avoid same session with high-% vitamin C, strong AHA/BHA (can degrade peptides).","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับวิตามินซีเข้มข้น AHA/BHA แรง","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/1_23a79a66-a967-4533-9e71-cd88b0c6efb2.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/1_23a79a66-a967-4533-9e71-cd88b0c6efb2.jpg"},{"id":38,"brand":"COSRX","name":"The Peptide Collagen Hydrogel Eye Patches","category":"eye","ingredients":"Water, Dipropylene Glycol, Glycerin, Niacinamide, Ceratonia Siliqua (Carob) Gum, Chondrus Crispus Powder, Chondrus Crispus, Cellulose Gum, Hydroxyacetophenone, Algin, Caprylyl Glycol, Potassium Chloride, Betaine, Panthenol, Sucrose, Ethylhexylglycerin, Sodium Polyacrylate,_x000B_Polyglyceryl-10 Laurate, Adenosine, Polyglyceryl-10 Myristate, Maltodextrin, Caffeine, Collagen, Butylene Glycol, Cyanocobalamin, 1,2-Hexanediol, Sodium Hyaluronate, Dipotassium Glycyrrhizate, Pantolactone, Pentylene Glycol, Acetyl Hexapeptide-8, Dunaliella Salina Extract, sh_x000B_Polypeptide-121, Palmitoyl Tripeptide-5, Hydrolyzed Hyaluronic Acid, Hyaluronic Acid, Potassium Hyaluronate, Hydrolyzed Sodium Hyaluronate, Acetyl Tetrapeptide-5, Citric Acid, Disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","peptides","niacinamide"],"description":"Hydrogel under-eye patches with peptides, collagen, caffeine, sodium hyaluronate and dipotassium glycyrrhizate. Instantly depuffs, plumps and hydrates the eye area. Leave on for 15-20 minutes.","descriptionTH":"แผ่นเจลใต้ตาที่มีเปปไทด์ คอลลาเจน คาเฟอีน โซเดียมไฮยาลูโรเนต ลดอาการบวม เติมเต็มและให้ความชุ่มชื้นบริเวณตาทันที วางทิ้งไว้ 15-20 นาที","bestFor":"sensitive, redness-prone, dull skin, mature skin, fine lines","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"2-3x per week or as needed","howOftenTH":"2-3 ครั้ง/สัปดาห์ หรือตามความต้องการ","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/Peptide-eye-patch2___800x1067-_-_-jpg.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0513/3775/6828/files/Peptide-eye-patch2___800x1067-_-_-jpg.webp"},{"id":39,"imageUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/skincare/moisturizers/am-facial-moisturizing-lotion-with-sunscreen/am-30-facial-moisturizer_front.jpg?rev=675a526e833f404e8ab1a167f77c7b58&w=500&hash=CD9919F3984E40887B168EB0484332EC","brand":"CeraVe","name":"AM Facial Moisturizing Lotion SPF 50","category":"sunscreen","ingredients":"ACTIVE INGREDIENTS: HOMOSALATE (8%), ZINC OXIDE (7%), OCTISALATE (5%), OCTOCRYLENE (5%)\nINACTIVE INGREDIENTS: WATER, GLYCERIN, DIMETHICONE, PROPANEDIOL, BUTYLOCTYL SALICYLATE, STEARETH-20, CELLULOSE, NIACINAMIDE, ETHYLHEXYL METHOXYCRYLENE, STEARETH-2, CERAMIDE NP, CERAMIDE AP, CERAMIDE EOP, SORBITAN ISOSTEARATE, CARBOMER, GLYCINE SOJA (SOYBEAN) OIL, TRIETHOXYCAPRYLYLSILANE, CETEARYL ALCOHOL, BEHENTRIMONIUM METHOSULFATE, TRIETHYL CITRATE, SODIUM HYALURONATE, SODIUM LAUROYL LACTYLATE, CHOLESTEROL, AMMONIUM POLYACRYLOYLDIMETHYL TAURATE, TOCOPHEROL, CHLORPHENESIN, HYDROXYACETOPHENONE, CAPRYLYL GLYCOL, HYDROXYETHYL ACRYLATE/SODIUM ACRYLOYLDIMETHYL TAURATE COPOLYMER, TRISODIUM ETHYLENEDIAMINE DISUCCINATE, PHYTOSPHINGOSINE, XANTHAN GUM, POLYHYDROXYSTEARIC ACID, POLYSORBATE 60, ORYZA SATIVA (RICE) BRAN WAX, BENZOIC ACID, C12-22 ALKYL ACRYLATE/HYDROXYETHYLACRYLATE COPOLYMER","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide","ceramides"],"description":"Lightweight chemical sunscreen moisturizer with ceramides (NP, AP, EOP), niacinamide, sodium hyaluronate and zinc oxide. MVE technology provides slow-release hydration throughout the day. Non-comedogenic and fragrance-free.","descriptionTH":"มอยส์เจอไรเซอร์ครีมกันแดดเคมีน้ำหนักเบาที่มีเซราไมด์ ไนอาซินาไมด์ โซเดียมไฮยาลูโรเนต และสังกะสีออกไซด์ เทคโนโลยี MVE ให้ความชุ่มชื้นตลอดวัน ไม่อุดรูขุมขน ปราศจากน้ำหอม","bestFor":"damaged barrier, dull skin","bestForTH":"ผิวแบเรียร์เสีย, ผิวหมองคล้ำ","howOften":"AM daily as final moisturizer step. Reapply outdoors.","howOftenTH":"ทุกเช้า เป็นขั้นตอนสุดท้าย ทาซ้ำเมื่ออยู่กลางแจ้ง","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","thumbnailUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/skincare/moisturizers/am-facial-moisturizing-lotion-with-sunscreen/am-30-facial-moisturizer_front.jpg?rev=675a526e833f404e8ab1a167f77c7b58&w=500&hash=CD9919F3984E40887B168EB0484332EC"},{"id":40,"brand":"CeraVe","name":"Eye Repair Cream","category":"eye","ingredients":"AQUA / WATER / EAU, NIACINAMIDE, CETYL ALCOHOL, CAPRYLIC/CAPRIC TRIGLYCERIDE, GLYCERIN, PROPANEDIOL, ISONONYL ISONONANOATE, JOJOBA ESTERS, PEG-20 METHYL GLUCOSE SESQUISTEARATE, CETEARYL ALCOHOL, DIMETHICONE, METHYL GLUCOSE SESQUISTEARATE, ASPARAGOPSIS ARMATA EXTRACT, CERAMIDE NP, CERAMIDE AP, POTASSIUM SORBATE, CERAMIDE EOP, SORBITOL, CARBOMER, ZINC CITRATE, BEHENTRIMONIUM METHOSULFATE, TRIETHANOLAMINE, ALOE BARBADENSIS LEAF EXTRACT, SODIUM LAUROYL LACTYLATE, SODIUM HYDROXIDE, EQUISETUM ARVENSE EXTRACT, SODIUM HYALURONATE, CHOLESTEROL, PHENOXYETHANOL, PRUNUS AMYGDALUS DULCIS OIL / SWEET ALMOND OIL, TOCOPHEROL, ASCOPHYLLUM NODOSUM EXTRACT, LAURETH-4, HYDROGENATED VEGETABLE OIL, TETRASODIUM EDTA, MALTODEXTRIN, PHYTOSPHINGOSINE, XANTHAN GUM, BUTYLENE GLYCOL, ETHYLHEXYLGLYCERIN, CHRYSANTHELLUM INDICUM EXTRACT","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide","ceramides"],"description":"Fragrance-free, gentle eye cream with ceramides (NP, AP, EOP), niacinamide, hyaluronic acid and natural botanical extracts. Targets dark circles and reduces puffiness. Safe for contact lens wearers.","descriptionTH":"ครีมรอบดวงตาอ่อนโยนปราศจากน้ำหอมที่มีเซราไมด์ ไนอาซินาไมด์ ไฮยาลูโรนิกแอซิด แก้ไขรอยคล้ำใต้ตาและลดอาการบวม ปลอดภัยสำหรับผู้ใส่เลนส์สัมผัส","bestFor":"damaged barrier, dry, dull skin, mature skin","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/products-v3/eye-repair-cream/700x700/cerave_eye_repair_cream_05oz_front-700x700-v2.jpg?rev=e5232fe389da49259af0c41c824b5b41","thumbnailUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/products-v3/eye-repair-cream/700x700/cerave_eye_repair_cream_05oz_front-700x700-v2.jpg?rev=e5232fe389da49259af0c41c824b5b41"},{"id":41,"brand":"CeraVe","name":"Foaming Facial Cleanser","category":"cleanser","ingredients":"AQUA / WATER / EAU, COCAMIDOPROPYL HYDROXYSULTAINE, GLYCERIN, SODIUM LAUROYL SARCOSINATE, PEG-150 PENTAERYTHRITYL TETRASTEARATE, NIACINAMIDE, PEG-6 CAPRYLIC/CAPRIC GLYCERIDES, SODIUM METHYL COCOYL TAURATE, PROPYLENE GLYCOL, CERAMIDE NP, CERAMIDE AP, CERAMIDE EOP, CARBOMER, METHYLPARABEN, SODIUM CHLORIDE, SODIUM LAUROYL LACTYLATE, CHOLESTEROL, DISODIUM EDTA, PROPYLPARABEN, CITRIC ACID, TETRASODIUM EDTA, HYDROLYZED HYALURONIC ACID, PHYTOSPHINGOSINE, XANTHAN GUM.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide","ceramides"],"description":"Non-comedogenic foaming cleanser with ceramides (NP, AP, EOP), niacinamide and hyaluronic acid. Effectively removes excess oil without disrupting the barrier. Best for oily and combination skin types.","descriptionTH":"คลีนเซอร์โฟมที่ไม่อุดรูขุมขน มีเซราไมด์ ไนอาซินาไมด์ และไฮยาลูโรนิกแอซิด ขจัดน้ำมันส่วนเกินได้อย่างมีประสิทธิภาพ เหมาะที่สุดสำหรับผิวมันและผิวผสม","bestFor":"sensitive, damaged barrier, dull skin","bestForTH":"ผิวบอบบาง, ผิวแบเรียร์เสีย, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/products-v3/foaming-facial-cleanser/700x700/cerave_foaming-facial-cleanser-12oz_front-700x700-v2.jpg?rev=da10428fc5104c97a980e0d5ff5ce9bb","thumbnailUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/products-v3/foaming-facial-cleanser/700x700/cerave_foaming-facial-cleanser-12oz_front-700x700-v2.jpg?rev=da10428fc5104c97a980e0d5ff5ce9bb"},{"id":42,"brand":"CeraVe","name":"Healing Ointment","category":"moisturizer","ingredients":"Active Ingredients: PETROLATUM 46.5%\nInactive Ingredient: MINERAL OIL, PARAFFIN, OZOKERITE, DIMETHICONE, CERAMIDE NP, CERAMIDE AP, CERAMIDE EOP, CARBOMER, WATER, SODIUM LAUROYL LACTYLATE, PROLINE, CHOLESTEROL, PHENOXYETHANOL, TOCOPHERYL ACETATE, TOCOPHEROL, HYDROLYZED HYALURONIC ACID, PANTHENOL, PANTOLACTONE, PHYTOSPHINGOSINE, XANTHAN GUM, ETHYLHEXYLGLYCERIN","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Heavy occlusive petrolatum-based ointment (46.5% petrolatum) with ceramides (NP, AP, EOP), hyaluronic acid and panthenol. Seals moisture in and protects very dry, chapped or post-procedure skin. Can be used as a 'slug' (last step over all other products).","descriptionTH":"ยาขี้ผึ้งแบบปิดกั้นหนักที่มีวาสลีน 46.5% เซราไมด์ ไฮยาลูโรนิกแอซิด และแพนทีนอล ปิดกั้นความชุ่มชื้นและปกป้องผิวแห้งมาก ผิวแตก หรือผิวหลังทำหัตถการ ใช้เป็นขั้นตอน slug ได้","bestFor":"sensitive, redness-prone, damaged barrier, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"PM as needed, especially after actives or when very dry","howOftenTH":"ตอนเย็น ตามความต้องการ โดยเฉพาะหลังสารออกฤทธิ์หรือเมื่อผิวแห้งมาก","doNotCombine":"Do not slug directly over strong retinol or high-% AHA — can amplify irritation.","doNotCombineTH":"ห้ามปิดกั้นทับเรตินอลแรงหรือ AHA เข้มข้นโดยตรง อาจเพิ่มการระคายเคือง","medicubeMode":"None","imageUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/skincare/moisturizers/healing-ointment/2025/healing-ointment_front.jpg?rev=c41d50fa05b34fa59e5affe3b389b681","thumbnailUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/skincare/moisturizers/healing-ointment/2025/healing-ointment_front.jpg?rev=c41d50fa05b34fa59e5affe3b389b681"},{"id":43,"brand":"CeraVe","name":"Hydrating Facial Cleanser","category":"cleanser","ingredients":"Aqua / Water / Eau, Glycerin, Cetearyl Alcohol, Peg-40 Stearate, Stearyl Alcohol, Potassium Phosphate, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Glyceryl Stearate, Behentrimonium Methosulfate, Sodium Lauroyl Lactylate, Sodium Hyaluronate, Cholesterol, Phenoxyethanol, Disodium EDTA, Dipotassium Phosphate, Tocopherol, Phytosphingosine, Xanthan Gum, Cetyl Alcohol, Polysorbate 20, Ethylhexylglycerin","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Best-selling gentle, non-foaming cream cleanser with ceramides (NP, AP, EOP), hyaluronic acid and glycerin. Does not disrupt the skin's natural pH or barrier. Suitable for twice-daily use on dry, normal and sensitive skin types including eczema.","descriptionTH":"คลีนเซอร์ครีมอ่อนโยนไม่มีโฟมขายดีที่มีเซราไมด์ ไฮยาลูโรนิกแอซิด และกลีเซอริน ไม่รบกวน pH ธรรมชาติ เหมาะสำหรับใช้สองครั้งต่อวันสำหรับผิวแห้ง ผิวปกติ และผิวแพ้ง่าย","bestFor":"sensitive, damaged barrier","bestForTH":"ผิวบอบบาง, ผิวแบเรียร์เสีย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/skincare/cleansers/hydrating-facial-cleanser/photos/2022/700x700/cerave_daily_hydrating-cleanser_12oz_front-700x700-v2.jpg?rev=8dcf681b75c042deaaa0c6ea1581d4df","thumbnailUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/skincare/cleansers/hydrating-facial-cleanser/photos/2022/700x700/cerave_daily_hydrating-cleanser_12oz_front-700x700-v2.jpg?rev=8dcf681b75c042deaaa0c6ea1581d4df"},{"id":44,"brand":"CeraVe","name":"Moisturizing Cream","category":"moisturizer","ingredients":"AQUA / WATER / EAU, GLYCERIN, CETEARYL ALCOHOL, CAPRYLIC/CAPRIC TRIGLYCERIDE, CETYL ALCOHOL, CETEARETH-20, PETROLATUM, POTASSIUM PHOSPHATE, CERAMIDE NP, CERAMIDE AP, CERAMIDE EOP, CARBOMER, DIMETHICONE, BEHENTRIMONIUM METHOSULFATE, SODIUM LAUROYL LACTYLATE, SODIUM HYALURONATE, CHOLESTEROL, PHENOXYETHANOL, DISODIUM EDTA, DIPOTASSIUM PHOSPHATE, TOCOPHEROL, PHYTOSPHINGOSINE, XANTHAN GUM, ETHYLHEXYLGLYCERIN","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Dermatologist #1 recommended rich moisturizing cream with three essential ceramides (1, 3, 6-II), hyaluronic acid, glycerin and MVE controlled-release technology. Fragrance-free, non-comedogenic. Suitable for face and body.","descriptionTH":"ครีมมอยส์เจอไรเซอร์เข้มข้นที่แพทย์ผิวหนังแนะนำอันดับ 1 มีเซราไมด์จำเป็น 3 ชนิด ไฮยาลูโรนิกแอซิด กลีเซอริน และเทคโนโลยี MVE ปลดปล่อยช้า ปราศจากน้ำหอม ไม่อุดรูขุมขน","bestFor":"damaged barrier, dry","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"AM + PM daily. Can be used multiple times on very dry areas.","howOftenTH":"เช้า-เย็น ทุกวัน ใช้ซ้ำได้หลายครั้งบริเวณที่แห้งมาก","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/products-v4/moisturizing-cream/cerave_moisturizing_cream_16oz_jar_front-700x700-v3.jpg?rev=7e37e9cc45754615b1532d77df5a0b52","thumbnailUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/products-v4/moisturizing-cream/cerave_moisturizing_cream_16oz_jar_front-700x700-v3.jpg?rev=7e37e9cc45754615b1532d77df5a0b52"},{"id":45,"brand":"CeraVe","name":"PM Facial Moisturizing Lotion","category":"moisturizer","ingredients":"AQUA / WATER / EAU, GLYCERIN, CAPRYLIC/CAPRIC TRIGLYCERIDE, NIACINAMIDE, CETEARYL ALCOHOL, POTASSIUM PHOSPHATE, CERAMIDE NP, CERAMIDE AP, CERAMIDE EOP, CARBOMER, DIMETHICONE, CETEARETH-20, BEHENTRIMONIUM METHOSULFATE, SODIUM LAUROYL LACTYLATE, SODIUM HYALURONATE, CHOLESTEROL, PHENOXYETHANOL, DISODIUM EDTA, DIPOTASSIUM PHOSPHATE, CAPRYLYL GLYCOL, PHYTOSPHINGOSINE, XANTHAN GUM, POLYGLYCERYL-3 DIISOSTEARATE, ETHYLHEXYLGLYCERIN","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide","ceramides"],"description":"Lightweight night lotion with ceramides (NP, AP, EOP), 4% niacinamide, hyaluronic acid and MVE technology. Strengthens the barrier overnight and brightens skin with continued use. Oil-free formulation suitable for oily or combination skin.","descriptionTH":"โลชั่นบำรุงคืนน้ำหนักเบาที่มีเซราไมด์ ไนอาซินาไมด์ 4% ไฮยาลูโรนิกแอซิด และเทคโนโลยี MVE เสริมสร้างเกราะผิวข้ามคืน สูตรไม่มีน้ำมัน เหมาะสำหรับผิวมันหรือผิวผสม","bestFor":"damaged barrier, dry, dull skin","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ","howOften":"PM daily","howOftenTH":"ตอนเย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/products-v3/pm-facial-moisturizing-lotion/700x700/cerave_pm-facial-moisturizing-lotion-3oz_front-700x700-v2.jpg?rev=8953e1e5ce79401eaee4c3b01473a236","thumbnailUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/products-v3/pm-facial-moisturizing-lotion/700x700/cerave_pm-facial-moisturizing-lotion-3oz_front-700x700-v2.jpg?rev=8953e1e5ce79401eaee4c3b01473a236"},{"id":46,"brand":"CeraVe","name":"Renewing SA Cleanser","category":"cleanser","ingredients":"Aqua/Water/Eau, Cocamidopropyl Hydroxysultaine, Glycerin, Sodium Lauroyl Sarcosinate, Niacinamide, Gluconolactone, Peg-150 Pentaerythrityl Tetrastearate, Sodium Methyl Cocoyl Taurate, Zea Mays Oil/Corn Oil, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Calcium Gluconate, Sodium Chloride, Salicylic Acid, Sodium Benzoate, Sodium Lauroyl Lactylate, Cholecalciferol, Cholesterol, Phenoxyethanol, Disodium Edta, Tetrasodium Edta, Hydrolyzed Hyaluronic Acid, Phytosphingosine, Xanthan Gum, Ethylhexylglycerin","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide","bha","ceramides"],"description":"Salicylic acid (BHA) + ceramide cleanser with gluconolactone (PHA) that gently exfoliates rough, bumpy texture (keratosis pilaris) without stripping. Contains ceramides to support the barrier. Suitable for daily use on body and face.","descriptionTH":"คลีนเซอร์กรดซาลิไซลิก (BHA) + เซราไมด์ พร้อมกลูโคโนแลคโตน (PHA) ที่ผลัดเซลล์ผิวหยาบและตะปุ่มตะป่ำ (KP) เบาๆ โดยไม่ตึงผิว มีเซราไมด์เพื่อรองรับเกราะผิว","bestFor":"damaged barrier, acne-prone, dull skin","bestForTH":"ผิวแบเรียร์เสีย, ผิวเป็นสิว, ผิวหมองคล้ำ","howOften":"AM or PM daily, or every other day for sensitive skin","howOftenTH":"เช้าหรือเย็น ทุกวัน หรือวันเว้นวันสำหรับผิวแพ้ง่าย","doNotCombine":"N/A — wash-off. Ease in alongside retinol.","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก ค่อยๆ เพิ่มเมื่อใช้ร่วมกับเรตินอล","medicubeMode":"None","imageUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/products-v3/renewing-sa-cleanser/700x700/renewing_sa_cleanser_8oz_front_new-700x700-v2.jpg?rev=06afd4d433644497b84c85d5562b0484","thumbnailUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/products-v3/renewing-sa-cleanser/700x700/renewing_sa_cleanser_8oz_front_new-700x700-v2.jpg?rev=06afd4d433644497b84c85d5562b0484"},{"id":47,"brand":"CeraVe","name":"Resurfacing Retinol Serum","category":"serum","ingredients":"AQUA/WATER/EAU, PROPANEDIOL, DIMETHICONE, CETEARYL ETHYLHEXANOATE, NIACINAMIDE, AMMONIUM POLYACRYLOYLDIMETHYL TAURATE, DIPOTASSIUM GLYCYRRHIZATE, HYDROGENATED LECITHIN, POTASSIUM PHOSPHATE, CERAMIDE NP, CERAMIDE AP, CERAMIDE EOP, CARBOMER, CETEARYL ALCOHOL, BEHENTRIMONIUM METHOSULFATE, DIMETHICONOL, LECITHIN, SODIUM CITRATE, RETINOL, SODIUM HYALURONATE, SODIUM LAUROYL LACTYLATE, CHOLESTEROL, PHENOXYETHANOL, ALCOHOL, ISOPROPYL MYRISTATE, CAPRYLYL GLYCOL, CITRIC ACID, TRISODIUM ETHYLENEDIAMINE DISUCCINATE, PENTYLENE GLYCOL, PHYTOSPHINGOSINE, XANTHAN GUM, POLYSORBATE 20, ETHYLHEXYLGLYCERIN","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["retinol","hyaluronic acid","niacinamide","ceramides"],"description":"Encapsulated retinol serum with ceramides (NP, AP, EOP), niacinamide, licochalcone (from licorice) and MVE technology for gradual release. Targets post-acne marks, uneven texture and pores. Encapsulation reduces irritation vs. standard retinol. Start 2-3x/week and build gradually.","descriptionTH":"เซรั่มเรตินอลแบบห่อหุ้มที่มีเซราไมด์ ไนอาซินาไมด์ ลิโคคาลโคน และเทคโนโลยี MVE สำหรับปลดปล่อยแบบค่อยเป็นค่อยไป แก้ไขรอยดำหลังสิว พื้นผิวไม่สม่ำเสมอ การห่อหุ้มลดการระคายเคือง","bestFor":"damaged barrier, dry, oily, combination, dull skin, mature skin, fine lines. Caution: avoid during pregnancy","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: ห้ามใช้ระหว่างตั้งครรภ์","howOften":"PM, start 2-3x/week, gradually increase to nightly","howOftenTH":"ตอนเย็น เริ่ม 2-3 ครั้ง/สัปดาห์ ค่อยๆ เพิ่มเป็นทุกคืน","doNotCombine":"Do not combine with AHA/BHA, vitamin C, benzoyl peroxide in same session. Avoid in pregnancy.","doNotCombineTH":"ห้ามใช้ร่วมกับ AHA/BHA วิตามินซี เบนโซอิลเพอร์ออกไซด์ในครั้งเดียวกัน หลีกเลี่ยงระหว่างตั้งครรภ์","medicubeMode":"None","imageUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/skincare/serums/resurfacing-retinol-serum/cerave_resurfacing_retinol-serum-pump-700x700-v1.jpg?rev=b943cbf81120424f869b26fe971dbf45","thumbnailUrl":"https://www.cerave.com/-/media/project/loreal/brand-sites/cerave/americas/us/skincare/serums/resurfacing-retinol-serum/cerave_resurfacing_retinol-serum-pump-700x700-v1.jpg?rev=b943cbf81120424f869b26fe971dbf45"},{"id":48,"brand":"Cetaphil","name":"Gentle Skin Cleanser","category":"cleanser","ingredients":"AQUA, GLYCERIN, CETEARYL ALCOHOL, PANTHENOL, NIACINAMIDE, PANTOLACTONE, XANTHAN GUM, SODIUM COCOYL ISETHIONATE, SODIUM BENZOATE, CITRIC ACID. FIL.1747.V00","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide"],"description":"Classic, minimal-ingredient gentle cream cleanser loved worldwide for 75+ years. Fragrance-free, soap-free and non-comedogenic. Works without water or can be rinsed. Extremely well-tolerated even on broken, post-procedure or eczema skin.","descriptionTH":"คลีนเซอร์ครีมอ่อนโยนที่มีส่วนผสมน้อยที่สุด เป็นที่รักทั่วโลกมากกว่า 75 ปี ปราศจากน้ำหอม สบู่ และไม่อุดรูขุมขน ใช้ได้โดยไม่ต้องล้างออกหรือล้างออกก็ได้","bestFor":"sensitive, redness-prone, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://www.cetaphil.co.uk/on/demandware.static/Sites-Galderma-UK-Site/-/default/dwf25da582/images/Cetaphil_Logo_285.png","thumbnailUrl":"https://www.cetaphil.co.uk/on/demandware.static/Sites-Galderma-UK-Site/-/default/dwf25da582/images/Cetaphil_Logo_285.png"},{"id":49,"brand":"Cetaphil","name":"Hydrating Night Cream","category":"moisturizer","ingredients":"AQUA, HYDROGENATED POLY(C6-14 OLEFIN), CAPRYLIC/CAPRIC TRIGLYCERIDE, DIMETHICONE, GLYCERIN, BUTYLENE GLYCOL, CETEARYL OLIVATE, SORBITAN OLIVATE, CYCLOPENTASILOXANE, 1,2-HEXANEDIOL, ASCORBYL PALMITATE, CAPRYLYL GLYCOL, CETEARYL ALCOHOL, CETEARYL METHICONE, CITRIC ACID, GLYCERYL STEARATE, HYDROLYZED HYALURONIC ACID, ISOHEXADECANE, ISOPROPYL LAUROYL SARCOSINATE, LEUCONOSTOC/RADISH ROOT FERMENT FILTRATE, LINOLEIC ACID, LYCOPENE, MARRUBIUM VULGARE EXTRACT, OLEA EUROPAEA FRUIT OIL, PEG-100 STEARATE, PEG-40 STEARATE, PHENOXYETHANOL, PHOSPHOLIPIDS, POLYMETHYLSILSESQUIOXANE, RETINYL PALMITATE, SODIUM BENZOATE, SODIUM POLYACRYLATE, STEARETH-2, STEARETH-21, TOCOPHERYL ACETATE. FIL.1408.V00","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["retinol","hyaluronic acid","vitamin c"],"description":"Rich PM moisturizer with hyaluronic acid, vitamin E, retinyl palmitate (vitamin A), niacinamide and shea butter. Replenishes moisture overnight. Not fully fragrance-free — check label if sensitive.","descriptionTH":"ครีมบำรุงคืนเข้มข้นที่มีไฮยาลูโรนิกแอซิด วิตามินอี เรตินิลพาลมิเตต ไนอาซินาไมด์ และเชียบัตเตอร์ เติมความชุ่มชื้นข้ามคืน ไม่ใช่ปราศจากน้ำหอมทั้งหมด","bestFor":"dry, mature skin, fine lines. Caution: avoid during pregnancy","bestForTH":"ผิวแห้ง, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: ห้ามใช้ระหว่างตั้งครรภ์","howOften":"PM daily","howOftenTH":"ตอนเย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://www.cetaphil.co.uk/on/demandware.static/Sites-Galderma-UK-Site/-/default/dwf25da582/images/Cetaphil_Logo_285.png","thumbnailUrl":"https://www.cetaphil.co.uk/on/demandware.static/Sites-Galderma-UK-Site/-/default/dwf25da582/images/Cetaphil_Logo_285.png"},{"id":50,"brand":"Cetaphil","name":"Moisturising Lotion","category":"moisturizer","ingredients":"Aqua, Glycerin, Isopropyl Palmitate, Cetearyl Alcohol, Ceteareth-20, Panthenol, Niacinamide, Tocopheryl Acetate, Dimethicone, Persea Gratissima Oil, Helianthus Annuus Seed Oil, Pantolactone, Glyceryl Stearate, Sodium Benzoate, Benzyl Alcohol, Citric Acid. FIL.1745.V00","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide"],"description":"Lightweight daily moisturizing lotion with glycerin, niacinamide, panthenol, vitamin E and macadamia nut oil. Non-greasy and suitable for year-round use. Works for face and body.","descriptionTH":"โลชั่นบำรุงประจำวันน้ำหนักเบาที่มีกลีเซอริน ไนอาซินาไมด์ แพนทีนอล วิตามินอี และน้ำมันมาคาเดเมีย ไม่มัน เหมาะสำหรับใช้ตลอดทั้งปี","bestFor":"sensitive, redness-prone, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://www.cetaphil.co.uk/on/demandware.static/Sites-Galderma-UK-Site/-/default/dwf25da582/images/Cetaphil_Logo_285.png","thumbnailUrl":"https://www.cetaphil.co.uk/on/demandware.static/Sites-Galderma-UK-Site/-/default/dwf25da582/images/Cetaphil_Logo_285.png"},{"id":51,"imageUrl":"https://www.clinique.com/media/export/cms/products/600x750/cl_sku_61EP01_600x750_0.png","brand":"Clinique","name":"All About Eyes™ Eye Cream with Vitamin C","category":"eye","ingredients":"Ingredients: Cyclopentasiloxane, Water\\Aqua\\Eau, Isostearyl Palmitate, Polyethylene, Butylene Glycol, Polysilicone-11, Ethylene/Acrylic Acid Copolymer, Morus Bombycis (Mulberry) Root Extract, Caffeine, Phytosphingosine, Triticum Vulgare (Wheat) Bran Extract, Scutellaria Baicalensis Root Extract, Whey Protein\\Lactis Protein\\Protéine Du Petit-Lait, Olea Europaea (Olive) Fruit Extract, Camellia Sinensis (Green Tea) Leaf Extract, Cholesterol, Linoleic Acid, Tocopheryl Acetate, Magnesium Ascorbyl Phosphate, Pyridoxine Dipalmitate, Sucrose, Glycerin, Dimethicone, Glyceryl Laurate, Peg/Ppg-18/18 Dimethicone, Petrolatum, Cetyl Peg/Ppg-10/1 Dimethicone, Propylene Carbonate, Sodium Chloride, Quaternium-90 Bentonite, Disodium Edta, Phenoxyethanol, Iron Oxides (Ci 77491, Ci 77492, Ci 77499) <ILN41964>","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c"],"description":"Lightweight eye cream with magnesium ascorbyl phosphate (vitamin C derivative), caffeine, squalane and peptides. Targets dark circles, puffiness and fine lines. Oil-free formula.","descriptionTH":"ครีมรอบดวงตาน้ำหนักเบาที่มีอนุพันธ์วิตามินซี คาเฟอีน สควาเลน และเปปไทด์ แก้ไขรอยคล้ำใต้ตา อาการบวมและริ้วรอย","bestFor":"dull skin, hyperpigmentation, mature skin","bestForTH":"ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","thumbnailUrl":"https://www.clinique.com/media/export/cms/products/600x750/cl_sku_61EP01_600x750_0.png"},{"id":52,"imageUrl":"https://www.clinique.com/media/export/cms/products/600x750/cl_sku_76X201_600x750_0.png","brand":"Clinique","name":"Clarifying Lotion 1","category":"moisturizer","ingredients":"Ingredients: Water\\Aqua\\Eau, Alcohol Denat., Glycerin, Butylene Glycol, Hamamelis Virginiana (Witch Hazel), Trehalose, Salicylic Acid, Acetyl Glucosamine, Sodium Hyaluronate, Sodium Hydroxide, Tetrahydroxypropyl Ethylenediamine, Disodium Edta, Phenoxyethanol, Benzophenone-4, Yellow 5 (Ci 19140), Blue 1 (Ci 42090) <ILN37003>","fragranceFree":true,"alcoholFree":false,"eoFree":true,"activeIngredients":["hyaluronic acid","bha"],"description":"Mildest exfoliating toner in Clinique's 3-step system for very dry skin with salicylic acid and witch hazel. Contains alcohol denat. and artificial colorants. Generally not recommended for sensitive users by current standards.","descriptionTH":"โทนเนอร์ผลัดเซลล์ผิวอ่อนโยนที่สุดในระบบ 3 ขั้นตอนของ Clinique มีกรดซาลิไซลิกและวิตช์ ฮาเซล มีแอลกอฮอล์ Denat. และสีย้อมสังเคราะห์","bestFor":"dry, oily, acne-prone. Caution: contains alcohol","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวเป็นสิว. ระวัง: มีแอลกอฮอล์","howOften":"AM + PM as part of Clinique system","howOftenTH":"เช้า-เย็น ในระบบ Clinique","doNotCombine":"Contains Alcohol Denat. Avoid with retinol, strong actives same session.","doNotCombineTH":"มีแอลกอฮอล์ Denat. หลีกเลี่ยงการใช้ร่วมกับเรตินอล สารออกฤทธิ์แรงในครั้งเดียวกัน","medicubeMode":"None","thumbnailUrl":"https://www.clinique.com/media/export/cms/products/600x750/cl_sku_76X201_600x750_0.png"},{"id":53,"imageUrl":"https://www.clinique.com/media/export/cms/products/600x750/cl_sku_7T5R01_600x750_0.png","brand":"Clinique","name":"Dramatically Different Moisturizing Lotion+","category":"moisturizer","ingredients":"Ingredients: Water\\Aqua\\Eau, Mineral Oil\\Paraffinum Liquidum\\Huile Minérale, Glycerin, Petrolatum, Stearic Acid, Glyceryl Stearate, Sesamum Indicum (Sesame) Oil, Urea, Lanolin Alcohol, Triethanolamine, Hordeum Vulgare (Barley) Extract\\Extrait D'Orge, Cucumis Sativus (Cucumber) Fruit Extract, Helianthus Annuus (Sunflower) Seedcake, Propylene Glycol Dicaprate, Sodium Hyaluronate, Butylene Glycol, Pentylene Glycol, Trisodium Edta, Phenoxyethanol, Yellow 6 (Ci 15985), Yellow 5 (Ci 19140), Red 33 (Ci 17200) <ILN39477>","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid"],"description":"Updated iconic lightweight lotion with hyaluronic acid, barley and cucumber extracts and barrier-supporting lipids. Provides 24-hour hydration. Contains mineral oil. Not fragrance-free.","descriptionTH":"โลชั่นน้ำหนักเบาที่เป็นสัญลักษณ์ได้รับการอัปเดต มีไฮยาลูโรนิกแอซิด สารสกัดข้าวบาร์เลย์และแตงกวา ให้ความชุ่มชื้น 24 ชั่วโมง มีน้ำมันแร่ ไม่ใช่ปราศจากน้ำหอม","bestFor":"dry","bestForTH":"ผิวแห้ง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","thumbnailUrl":"https://www.clinique.com/media/export/cms/products/600x750/cl_sku_7T5R01_600x750_0.png"},{"id":54,"imageUrl":"https://www.clinique.com/media/export/cms/products/600x750/cl_sku_KWW301_600x750_0.png","brand":"Clinique","name":"Moisture Surge™ 100H Auto-Replenishing Hydrator","category":"moisturizer","ingredients":"Ingredients: Water\\Aqua\\Eau, Dimethicone, Butylene Glycol, Glycerin, Trisiloxane, Trehalose, Sucrose, Ammonium Acryloyldimethyltaurate/Vp Copolymer, Hydroxyethyl Urea, Camellia Sinensis (Green Tea) Leaf Extract, Silybum Marianum (Lady'S Thistle) Extract, Betula Alba (Birch) Bark Extract, Saccharomyces Lysate Extract, Aloe Barbadensis Leaf Water, Aloe Barbadensis Leaf Extract, Thermus Thermophillus Ferment, Caffeine, Sorbitol, Palmitoyl Hexapeptide-12, Sodium Hyaluronate, Caprylyl Glycol, Oleth-10, Sodium Polyaspartate, Aloe Barbadensis Leaf Polysaccharides, Lactobacillus Ferment Lysate, Saccharide Isomerate, Hydrogenated Lecithin, Tocopheryl Acetate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Glyceryl Polymethacrylate, Tromethamine, Peg-8, Hexylene Glycol, Magnesium Ascorbyl Phosphate, Citric Acid, Bht, Disodium Edta, Sodium Citrate, Potassium Sorbate, Sodium Benzoate, Phenoxyethanol, Red 4 (Ci 14700), Yellow 5 (Ci 19140) <ILN48715>","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid","peptides"],"description":"Bestselling gel moisturizer with aloe vera leaf water, HA and Thermus thermophillus ferment that self-activates with skin's moisture. Lightweight, refreshing texture suitable for all skin types, especially oily/dehydrated.","descriptionTH":"เจลมอยส์เจอไรเซอร์ขายดีที่มีน้ำว่านหางจระเข้ HA และ Thermus thermophillus ferment ที่เปิดใช้งานเองกับความชุ่มชื้นในผิว เนื้อสัมผัสเบาและสดชื่น","bestFor":"dry, dull skin, hyperpigmentation, mature skin, fine lines","bestForTH":"ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","thumbnailUrl":"https://www.clinique.com/media/export/cms/products/600x750/cl_sku_KWW301_600x750_0.png"},{"id":55,"imageUrl":"https://www.clinique.com/media/export/cms/products/600x750/cl_sku_6CY401_600x750_0.png","brand":"Clinique","name":"Take The Day Off™ Cleansing Balm","category":"oil cleanser","subcategory":"cleansing balm","ingredients":"Ingredients: Ethylhexyl Palmitate, Carthamus Tinctorius (Safflower) Seed Oil, Caprylic/Capric Triglyceride, Sorbeth-30 Tetraoleate, Polyethylene, Peg-5 Glyceryl Triisostearate, Water\\Aqua\\Eau, Tocopherol, Phenoxyethanol <ILN30654>","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Dermatologist-developed fragrance-free cleansing balm with safflower and caprylic/capric triglyceride oils. Effortlessly melts even waterproof makeup and SPF. Rinses clean. Widely considered one of the best cleansing balms for all skin types.","descriptionTH":"คลีนซิ่งบาล์มที่พัฒนาโดยผู้เชี่ยวชาญผิวหนัง ปราศจากน้ำหอม ละลายแม้เครื่องสำอางกันน้ำ ล้างออกสะอาด","bestFor":"sensitive","bestForTH":"ผิวบอบบาง","howOften":"PM daily as first cleanse","howOftenTH":"ตอนเย็น ทุกวัน เป็นขั้นตอนทำความสะอาดแรก","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","thumbnailUrl":"https://www.clinique.com/media/export/cms/products/600x750/cl_sku_6CY401_600x750_0.png"},{"id":56,"brand":"Cure","name":"Aqua Gel Gentle Exfoliator","category":"treatment","ingredients":"Butylene Glycol, Isopropyl Alcohol, Rosmarinus Officinalis (Rosemary) Leaf Extract, Gingko Biloba Leaf Extract, Aloe Barbadensis Leaf Extract, Steartrimonium Bromide, Dicocodimonium Chloride, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Glycerin, Water (Activated Hydrogen Water)","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Bestselling Japanese gommage exfoliator with activated hydrogen water, steartrimonium bromide and rosemary extract. Activates as you massage and rolls off dead skin without acids. Fragrance-free, colorant-free, preservative-free. Suitable for sensitive and barrier-compromised skin.","descriptionTH":"เจลผลัดเซลล์ผิวกอมมาจขายดีจากญี่ปุ่นที่มีน้ำไฮโดรเจนที่ถูกกระตุ้น เปิดใช้งานเมื่อนวดและกลิ้งเอาเซลล์ผิวที่ตายออกโดยไม่ใช้กรด ปราศจากน้ำหอม สีย้อม และสารกันเสีย","bestFor":"normal, combination, oily — dull skin, texture. Caution: contains isopropyl alcohol","bestForTH":"ผิวปกติ, ผิวผสม, ผิวมัน — ผิวหมองคล้ำ, พื้นผิวขรุขระ. ระวัง: มีแอลกอฮอล์","howOften":"1-2x per week maximum (PM preferred)","howOftenTH":"สูงสุด 1-2 ครั้ง/สัปดาห์ (แนะนำตอนเย็น)","doNotCombine":"Do not use same session as retinol, AHA/BHA or other exfoliants.","doNotCombineTH":"อย่าใช้ในครั้งเดียวกับเรตินอล AHA/BHA หรือสารผลัดเซลล์ผิวอื่น","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0042/1602/9251/files/gentle-aqua-gel-exfoliator-face-body.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0042/1602/9251/files/gentle-aqua-gel-exfoliator-face-body.jpg"},{"id":57,"brand":"Dr. Althea","name":"147 Barrier Cream","category":"moisturizer","ingredients":"Aqua (Water), Aloe Barbadensis Leaf Water, Butylene Glycol, Glycerin, Hydrogenated Polydecene, C12-14 Pareth-12, Ethylhexyl Olivate, Cetearyl Olivate, Ethylhexylglycerin, Squalane, Ceramide NP, Ethylhexyl Alcohol, Behenyl Alcohol, Vinyl Dimethicone, C12-14 Alketh-12, Glucoside, Sodium Polyacrylate, Hydrogenated Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Hydroxyethylcellulose, Xanthan Gum, Tromethamine, Disodium EDTA, Hydrogenated Lecithin, Coptis Japonica Root Extract, Centella Asiatica Extract, Ficus Carica (Fig) Fruit Extract, Ceramide NG, Madecassic Acid, Asiaticoside, Asiatic Acid, Ceramide AP, Betaine, Cholesterol, Hydrolyzed Sodium Hyaluronate, Beta-Glucan, Dimethylsilanol Hyaluronate, Hydrolyzed Hyaluronic Acid, Hydrolyzed Sodium Hyaluronate, Sodium Hyaluronate, Hydroxy Propyltrimonium Hyaluronate, Sodium Hyaluronate Crosspolymer, Hydroxyacetophenone, Hyaluronic Acid, Sodium Hyaluronate Dimethylsilanol, Sodium Acetylated Hyaluronate.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","ceramides"],"description":"Rich ceramide-forward barrier cream with 5 ceramides, cholesterol, phytosphingosine, centella asiatica extract and peony extract. Note: contains Pelargonium Graveolens flower oil (geranium essential oil) despite minimalist marketing — not truly fragrance-free. Use caution if essential oil sensitive.","descriptionTH":"ครีมเสริมสร้างเกราะผิวที่เน้นเซราไมด์ 5 ชนิด คอเลสเตอรอล ฟิโตสฟิงโกซีน สารสกัดเซนเทลลา และสารสกัดโบตั๋น หมายเหตุ: มีน้ำมันดอกโรซ่าเจอเรเนียม (น้ำมันหอมระเหย) ไม่ใช่ปราศจากน้ำหอมจริงๆ ระวังหากแพ้น้ำมันหอมระเหย","bestFor":"sensitive, redness-prone, damaged barrier, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"AM + PM daily as final moisturizer","howOftenTH":"เช้า-เย็น ทุกวัน เป็นมอยส์เจอไรเซอร์ขั้นตอนสุดท้าย","doNotCombine":"Caution if essential oil sensitive. May be too rich for very acne-prone.","doNotCombineTH":"ระวังหากแพ้น้ำมันหอมระเหย อาจหนักเกินไปสำหรับผิวเป็นสิวมาก","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/147_cream.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/147_cream.png"},{"id":58,"brand":"Dr. Althea","name":"345 Relief Cream","category":"moisturizer","ingredients":"Aqua (Water), Melaleuca Alternifolia (Tea Tree) Leaf Water, Propanediol, Glycerin, 1,2-Hexanediol, Hydrogenated Polydecene, Vinyl Dimethicone, C14-22 Alcohols, Niacinamide, Caprylic/Capric Triglyceride, Panthenol, Dicaprylyl Carbonate, Butylene Glycol, Ammonium Acryloyldimethyltaurate/Vp Copolymer, Caprylyl Methicone, Polymethylsilsesquioxane, C12-20 Alkyl Glucoside, Hydroxyacetophenone, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Polyquaternium-51, Ethylhexylglycerin, Tromethamine, Sodium Hyaluronate, Sodium Stearoyl Glutamate, Coptis Japonica Root Extract, Centella Asiatica Leaf Water, Beta-Glucan, Resveratrol, Hydrolyzed Hyaluronic Acid, Camellia Sinensis Leaf Water, Tocopherol, Madecassoside, Sodium Dna, Centella Asiatica Extract, Ceramide Np, Tannic Acid, Disodium Edta, Sodium Phytate","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","pdrn","centella","ceramides","niacinamide"],"description":"Lightweight non-comedogenic soothing cream inspired by 3 centella fractions, 4% panthenol (high dose) and 5% niacinamide. Calms redness and inflammation, restores moisture and supports the barrier. Fragrance-free. PDRN (Sodium DNA) included. No essential oils.","descriptionTH":"ครีมบรรเทาน้ำหนักเบาที่ไม่อุดรูขุมขน มีสารสกัดเซนเทลลา 3 ชนิด แพนทีนอล 4% และไนอาซินาไมด์ 5% ลดรอยแดงและการอักเสบ ปราศจากน้ำหอม มี PDRN (Sodium DNA) รวมอยู่","bestFor":"sensitive, redness-prone, damaged barrier, dry, acne-prone, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวเป็นสิว, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345cream.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345cream.jpg"},{"id":59,"brand":"Dr. Althea","name":"345 Relief Cream Mist","category":"mist","ingredients":"Oryza Sativa (Rice) Bran Water, 1,2-Hexanediol, Triethylhexanoin, Glycerin, Hydrogenated Poly(C6-14 Olefin), Tocopherol, Water, Butylene Glycol, Methylpropanediol, Pentylene Glycol, Streptococcus Thermophilus Ferment, Pyrus Malus (Apple) Juice, Panthenol, Hydrolyzed Hyaluronic Acid, Polyquaternium-51, Betaine, Trilaurate-4 Phosphate, Cynanchum Atratum Extract, Althaea Rosea Flower Extract, Oryza Sativa (Rice) Extract, Sea Salt, Aspergillus Ferment, Sodium Phytate, Citric Acid, Madecassoside, Hydroxypropyltrimonium Hyaluronate, Centella Asiatica Leaf Extract, Houttuynia Cordata Extract, Aloe Barbadensis Leaf Water, Bifida Ferment Extract, Hyaluronic Acid, Silanetriol, Avena Sativa (Oat) Kernel Extract, Lactobacillus Ferment, Hydrolyzed Rice Protein, Rice Amino Acids","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella"],"description":"Hydrating calming mist with rice bran water, centella asiatica leaf extract, madecassoside, panthenol and ferment ingredients. Refreshes and settles skin throughout the day. Fragrance-free. Can be used over or under makeup.","descriptionTH":"มิสต์บรรเทาที่ให้ความชุ่มชื้นมีน้ำรำข้าว สารสกัดใบเซนเทลลา แมเดคาสโซไซด์ แพนทีนอล รีเฟรชและบรรเทาผิวตลอดวัน ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, dry, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวหมองคล้ำ","howOften":"AM + PM and as needed throughout day","howOftenTH":"เช้า-เย็น และตามความต้องการตลอดวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","makeupPrep":true,"imageUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_cream_mist_1.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/345_cream_mist_1.jpg"},{"id":60,"brand":"Dr. Althea","name":"ABC Glow Whipped Serum","category":"serum","ingredients":"Collagen Water, 1,2-Hexanediol, Propanediol, C12-14 Alketh-12, Water, Butylene Glycol, Glycerin, , Zea Mays (Corn) Kernel Extract, Fructan, Glucose, Hydroxyacetophenone, , Coptis Japonica Root Extract, Ethylhexylglycerin, Disodium Edta, Hippophae Rhamnoides Water, Allantoin, Bakuchiol","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["bakuchiol"],"description":"Innovative vegan whipped (mousse) texture serum with A (bakuchiol — retinol alternative), B (vitamin B3 niacinamide), C (triple collagen water). Brightens, firms and softens texture gently. Fragrance-free. Suitable for those who cannot tolerate retinol.","descriptionTH":"เซรั่มเนื้อวิปโฟมนวัตกรรม vegan ที่มี A (บาคูชิออล สารทดแทนเรตินอล) B (ไนอาซินาไมด์) C (น้ำคอลลาเจนสามชั้น) เพิ่มความกระจ่างใส กระชับ ปราศจากน้ำหอม เหมาะสำหรับผู้ที่ทนต่อเรตินอลไม่ได้","bestFor":"sensitive, redness-prone, mature skin, fine lines","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM daily (morning / makeup prep only)","howOftenTH":"เช้าทุกวัน (ใช้เช้า / เตรียมผิวก่อนแต่งหน้าเท่านั้น)","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","makeupPrep":true,"daytimeOnly":true,"imageUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/nonilotion_b824e111-9af1-49b3-96ab-99e2abf36b66.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/nonilotion_b824e111-9af1-49b3-96ab-99e2abf36b66.jpg"},{"id":61,"brand":"Dr. Althea","name":"Aqua Marine Jelly Mist","category":"mist","ingredients":"Aqua (Water), Sea Water, Butylene Glycol, 1,2-Hexanediol, Tripropylene Glycol, Glycereth-26, Methylpropanediol, Glycerin, Beta-Glucan, Xylitol, Propanediol, Hyaluronic Acid, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate, Sodium Chloride, Hydroxyacetophenone, Glycereth-25 PCA Isostearate, Gellan Gum, Sodium DNA, Trisodium Ethylenediamine Disuccinate, Malachite Extract, Arginine, Ethylhexylglycerin, Methyl Diisopropyl Propionamide, Disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","pdrn"],"description":"Vegan jelly mist with deep sea water, vegan Sodium DNA (PDRN-like), triple hyaluronic acid, malachite extract and xylitol. Delivers instant, bouncy hydration and a glass-skin glow. Unique jelly texture settles flat without dripping.","descriptionTH":"มิสต์เจล vegan ที่มีน้ำทะเลลึก Sodium DNA จากวีแกน ไฮยาลูโรนิกแอซิดสามชนิด สารสกัดมาลาไคต์ และไซลิทอล ให้ความชุ่มชื้นและผิวดู glass-skin ทันที","bestFor":"sensitive, redness-prone, damaged barrier, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"AM + PM and as needed throughout day","howOftenTH":"เช้า-เย็น และตามความต้องการตลอดวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","makeupPrep":true,"imageUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/AQUA_MIST.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/AQUA_MIST.jpg"},{"id":62,"brand":"Dr. Althea","name":"Aqua Marine Watery Cream","category":"moisturizer","ingredients":"Bambusa Vulgaris Water, 1,2-Hexanediol, Propanediol, Water, Glycerin, Hydrogenated Polydecene, C14-22 Alcohols, C12-20 Alkyl Glucoside, Caprylic/Capric Triglyceride, Codium Fragile Extract, Palmaria Palmata Extract, Chondrus Crispus Extract, Sargassum Pallidum Extract, Butylene Glycol, Hyaluronic Acid, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate, Panthenol, Vinyl Dimethicone, Cetyl Alcohol, Carbomer, Tromethamine, Sodium DNA, Hydrogenated Lecithin, Dextrin, Gardenia Florida Fruit Extract, Polyglutamic Acid, Hydrolyzed Sodium Hyaluronate, Hydroxypropyltrimonium Hyaluronate, Potassium Hyaluronate, Sodium Hyaluronate Crosspolymer, Pentylene Glycol, Sodium Acetylated Hyaluronate, Guaiazulene, Agave Tequilana Leaf Extract, Sodium Retinoyl Hyaluronate, Zinc Hydrolyzed Hyaluronate, Dimethylsilanol Hyaluronate, Sodium Benzoate, Ascorbyl Propyl Hyaluronate, Ascorbylpropyl Hydrolyzed Hyaluronat, Caulerpa Lentillifera Extract, Ethylhexylglycerin, Disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid","pdrn"],"description":"Vegan fragrance-free watery cream with bamboo water base, 4 types of sea algae, 7-type hyaluronic acid complex and soothing guaiazulene (natural blue pigment). Extremely lightweight — suitable for humid climates and oily skin.","descriptionTH":"ครีมน้ำ vegan ปราศจากน้ำหอมที่มีฐานน้ำไผ่ สาหร่ายทะเล 4 ชนิด กลุ่มไฮยาลูโรนิกแอซิด 7 ชนิด และกัวยาซูลีนที่ให้ความเย็นสบาย น้ำหนักเบามากๆ เหมาะสำหรับสภาพอากาศชื้นและผิวมัน","bestFor":"sensitive, redness-prone, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/aquamarinecream.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/aquamarinecream.jpg"},{"id":63,"brand":"Dr. Althea","name":"PDRN Reju 5000 Cream","category":"moisturizer","ingredients":"Aqua (Water), Glycerin, Centella Asiatica Leaf Water, Panthenol, Butylene Glycol, Dicaprylyl Ether, 1,2-Hexanediol, Vinyl Dimethicone, Caprylyl Methicone, Hydrogenated Polydecene, Pentylene Glycol, Dicaprylyl Carbonate, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Sodium DNA, Dimethiconol, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Cetearyl Olivate, Aminomethyl Propanediol, Sorbitan Olivate, Glyceryl Acrylate/Acrylic Acid Copolymer, Xanthan Gum, Ethylhexylglycerin, Sodium Hyaluronate, Hyaluronic Acid, Hydrolyzed Hyaluronic Acid, Sodium Phytate, Tocopherol, Aureobasidium Pullulans Ferment, Caprylic/Capric Triglyceride, Beta-Sitosterol, Hydrogenated Lecithin, Polyglyceryl-4 Caprate, Polyglyceryl-6 Caprylate, sh-Oligopeptide-1","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["pdrn","hyaluronic acid","centella","peptides"],"description":"Soothing lightweight barrier cream with 5,000ppm fermentation-derived PDRN, 5% panthenol, 5% centella asiatica leaf water, triple HA and beta-sitosterol. Fragrance-free and vegan. Supports post-procedure recovery and sensitive barrier restoration.","descriptionTH":"ครีมเสริมสร้างเกราะผิวน้ำหนักเบาที่บรรเทาได้ มี PDRN จากการหมักด้วยโปรไบโอติก 5,000ppm แพนทีนอล 5% น้ำใบเซนเทลลา 5% HA สามชนิด ปราศจากน้ำหอม vegan","bestFor":"sensitive, redness-prone, damaged barrier, dry, mature skin, fine lines","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/147_cream_bf03e5f0-e8f1-4c9e-8710-ef2061216165.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0082/1346/3093/files/147_cream_bf03e5f0-e8f1-4c9e-8710-ef2061216165.jpg"},{"id":64,"brand":"Dr. Barbara Sturm","name":"Enzyme Cleanser","category":"cleanser","ingredients":"sodium lauroyl glutamate,triticum vulgare (wheat) starch,cellulose,sucrose,kaolin,aqua/water/eau,portulaca oleracea extract,xanthan gum,maltodextrin,niacinamide,aloe barbadensis leaf juice,ascorbic acid,ectoin,sodium\npolyglutamate,papain,biosaccharide gum-1, *Derived from certified organic agriculture","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","niacinamide"],"description":"Powder-to-foam enzyme cleanser with subtilisin (papaya-derived enzyme), portulaca oleracea (purslane) extract, niacinamide, panthenol and aloe vera. Gently exfoliates and brightens without stripping. Mix powder with water to activate.","descriptionTH":"คลีนเซอร์ผงเอนไซม์ที่กลายเป็นโฟมมีซับทิลิซีน (เอนไซม์จากมะละกอ) สารสกัดพอร์ทูลาคา ไนอาซินาไมด์ แพนทีนอล และว่านหางจระเข้ ผลัดเซลล์ผิวและเพิ่มความกระจ่างใสเบาๆ","bestFor":"dull skin, hyperpigmentation","bestForTH":"ผิวหมองคล้ำ, จุดด่างดำ","howOften":"2-3x per week (PM)","howOftenTH":"2-3 ครั้ง/สัปดาห์ (ตอนเย็น)","doNotCombine":"Avoid same day as retinol, strong acids.","doNotCombineTH":"หลีกเลี่ยงวันเดียวกับเรตินอล กรดเข้มข้น","medicubeMode":"None","imageUrl":"https://cdn11.bigcommerce.com/s-dwdwr5marw/products/528/images/8204/ENZYME_CLEANSER_PDP_1__24444.1750147122.386.513.jpg?c=1","thumbnailUrl":"https://cdn11.bigcommerce.com/s-dwdwr5marw/products/528/images/8204/ENZYME_CLEANSER_PDP_1__24444.1750147122.386.513.jpg?c=1"},{"id":65,"brand":"Dr. Barbara Sturm","name":"Glow Drops","category":"serum","ingredients":"Aqua/Water/Eau, Prunus Amygdalus Dulcis (Sweet Almond) Oil, C12-15 Alkyl Benzoate, Glycerin, Lactobacillus/Portulaca Oleracea Ferment Extract, Butylene Glycol, Glyceryl Stearate, Panthenol, Sodium Hyaluronate\nPolygonum Bistorta Root Extract, Leuconostoc/Radish Root Ferment Filtrate, Biosaccharide Gum-1, Rosa Canina Fruit Extract, Cetearyl Alcohol, Stearic Acid\nCarbomer, Sodium Lauroyl Glutamate, Ethylhexylglycerin, Mica, Hexylene Glycol, Sodium Hydroxide, Alcohol, Caprylic/Capric Triglyceride, Synthetic Fluorphlogopite, Pantolactone\nXanthan Gum, Ascorbyl Palmitate, Citric Acid, Ascorbic Acid, Dimethicone, Phenoxyethanol, Alumina, Tin Oxide, Iron Oxides (CI 77491), Titanium Dioxide (CI 77891)","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid"],"description":"Illuminating serum with purslane ferment, panthenol, sodium hyaluronate and mica (for glow). Adds instant dewy radiance. Contains alcohol — not suitable for dry or alcohol-sensitive skin.","descriptionTH":"เซรั่มเพิ่มความกระจ่างใสที่มีเฟอร์เมนต์ผักพอร์ทูลาคา แพนทีนอล โซเดียมไฮยาลูโรเนต และไมก้า เพิ่มความกระจ่างใสทันที มีแอลกอฮอล์ ไม่เหมาะสำหรับผิวแห้งหรือแพ้แอลกอฮอล์","bestFor":"sensitive, redness-prone, dry, dull skin, hyperpigmentation","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts. Contains alcohol.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ มีแอลกอฮอล์","medicubeMode":"Booster","imageUrl":"https://cdn11.bigcommerce.com/s-dwdwr5marw/products/547/images/10991/_GLOW_DROPS_SERUM__85984__69119.1750147184.386.513.jpg?c=1","thumbnailUrl":"https://cdn11.bigcommerce.com/s-dwdwr5marw/products/547/images/10991/_GLOW_DROPS_SERUM__85984__69119.1750147184.386.513.jpg?c=1"},{"id":66,"brand":"Dr. Barbara Sturm","name":"Hyaluronic Serum","category":"serum","ingredients":"Aqua/Water/Eau, Butylene Glycol, Lactobacillus/Portulaca Oleracea Ferment Extract, Sodium Hyaluronate, Leuconostoc/Radish Root Ferment Filtrate, Phenoxyethanol, Ethylhexylglycerin, Potassium Sorbate","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid"],"description":"Minimalist fragrance-free serum with high- and low-molecular-weight sodium hyaluronate, purslane extract, phenoxyethanol and ethylhexylglycerin. Two HA sizes penetrate different skin layers for comprehensive plumping.","descriptionTH":"เซรั่มที่มีส่วนผสมน้อยชนิด ปราศจากน้ำหอม มีโซเดียมไฮยาลูโรเนตน้ำหนักโมเลกุลสูงและต่ำ สารสกัดพอร์ทูลาคา HA สองขนาดซึมซาบชั้นผิวที่แตกต่างกัน","bestFor":"dry","bestForTH":"ผิวแห้ง","howOften":"AM + PM daily after toner","howOftenTH":"เช้า-เย็น ทุกวัน หลังโทนเนอร์","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn11.bigcommerce.com/s-dwdwr5marw/products/546/images/12158/NEW_HA_1_1__28496.1750147182.386.513.jpg?c=1","thumbnailUrl":"https://cdn11.bigcommerce.com/s-dwdwr5marw/products/546/images/12158/NEW_HA_1_1__28496.1750147182.386.513.jpg?c=1"},{"id":67,"imageUrl":"https://static.thcdn.com/productimg/original/14869945-1385323085508084.jpg","brand":"Dr.Jart+","name":"Ceramidin™ Skin Barrier Milky Serum Toner","category":"toner","ingredients":"Water\\Aqua\\Eau, Dipropylene Glycol, Betaine, Propanediol, Alcohol Denat., Glycosyl Trehalose, Glycerin, 1,2-Hexanediol, Panthenol, Pentylene Glycol, Erythritol, Hydrogenated Starch Hydrolysate, Triethylhexanoin, Diphenyl Dimethicone, Polyglyceryl-10 Myristate, Ceramide Np, Sucrose Distearate, Ethylhexylglycerin, Sodium Hyaluronate, Theobroma Cacao (Cocoa) Seed Extract, Pelargonium Graveolens Flower Oil, Olea Europaea (Olive) Fruit Oil, Citrus Aurantium Bergamia (Bergamot) Fruit Oil, C12-14 Pareth-12, Hydrogenated Lecithin, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tromethamine, Carbomer, Glyceryl Polymethacrylate, Glyceryl Stearate, Dextrin, Salvia Officinalis (Sage) Oil, Citronellol, Disodium Edta, Yellow 5 (Ci 19140)","fragranceFree":true,"alcoholFree":false,"eoFree":false,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Hydrating milky serum-toner with ceramide NP, panthenol, sucrose distearate and diphenyl dimethicone. Strengthens barrier and adds a subtle luminous finish. Contains alcohol denat. and fragrance — not recommended for sensitive/fragrance-sensitive skin.","descriptionTH":"โทนเนอร์เซรั่มแบบครีมที่ให้ความชุ่มชื้นมีเซราไมด์ NP แพนทีนอล เสริมสร้างเกราะผิว มีแอลกอฮอล์ Denat. และน้ำหอม ไม่แนะนำสำหรับผิวแพ้น้ำหอม","bestFor":"damaged barrier, dry. Caution: contains essential oils, contains alcohol","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง. ระวัง: มีน้ำมันหอมระเหย, มีแอลกอฮอล์","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains Alcohol Denat. and fragrance.","doNotCombineTH":"มีแอลกอฮอล์ Denat. และน้ำหอม","medicubeMode":"Booster","thumbnailUrl":"https://static.thcdn.com/productimg/original/14869945-1385323085508084.jpg"},{"id":68,"imageUrl":"https://static.thcdn.com/productimg/original/14869945-1245323085507877.jpg","brand":"Dr.Jart+","name":"Ceramidin™ Skin Barrier Moisturising Cream","category":"moisturizer","ingredients":"Water\\Aqua\\Eau, Glycerin, Caprylic/Capric Triglyceride, Dipropylene Glycol, Cetearyl Alcohol, Hydrogenated Polydecene, Methyl Trimethicone, Hydrogenated Poly(C6-14 Olefin), Butyrospermum Parkii (Shea) Butter, 1,2-Hexanediol, Phenyl Trimethicone, Dicaprylyl Ether, Cetearyl Olivate, Panthenol, Glyceryl Stearate, Behenyl Alcohol, Sorbitan Olivate, Theobroma Cacao (Cocoa) Seed Extract, 2,3-Butanediol, Cetearyl Glucoside, Ceramide Np, Ceramide Ng, Ceramide Ns, Ceramide As, Ceramide Ap, Cholesterol, Pentaerythrityl Distearate, Hydrogenated Lecithin, Palmitic Acid, Stearic Acid, Microcrystalline Cellulose, Glyceryl Stearate Se, Ammonium Acryloyldimethyltaurate/Vp Copolymer, Cellulose Gum, Dextrin, Glyceryl Polymethacrylate, Pelargonium Graveolens Flower Oil, Olea Europaea (Olive) Fruit Oil, Citrus Aurantium Bergamia (Bergamot) Fruit Oil, Salvia Officinalis (Sage) Oil, Citronellol, Tocopherol, Yellow 5 (Ci 19140)","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":["ceramides"],"description":"Iconic barrier-restoration cream with 5 ceramides (NP, NG, NS, AS, AP), cholesterol and multiple emollient lipids. Rich and deeply nourishing. Does contain fragrance (Pelargonium Graveolens/geranium and Bergamot) — important to note for fragrance-sensitive users.","descriptionTH":"ครีมฟื้นฟูเกราะผิวที่เป็นสัญลักษณ์ มีเซราไมด์ 5 ชนิด คอเลสเตอรอล และไขมันบำรุงหลายชนิด เข้มข้นและบำรุงอย่างลึกล้ำ มีน้ำหอม (เจอเรเนียม และเบอร์กาม็อต)","bestFor":"dry, damaged barrier — sensitive with tolerance. Caution: contains essential oils","bestForTH":"ผิวแห้ง, ผิวแบเรียร์เสีย — ผิวบอบบางที่ทนได้. ระวัง: มีน้ำมันหอมระเหย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts. Contains fragrance.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ มีน้ำหอม","medicubeMode":"Derma Shot","thumbnailUrl":"https://static.thcdn.com/productimg/original/14869945-1245323085507877.jpg"},{"id":69,"imageUrl":"https://static.thcdn.com/productimg/original/15840346-2055323085280879.jpg","brand":"Dr.Jart+","name":"Ceramidin™ Skin Barrier Moisturizing Eye Cream","category":"eye","ingredients":"WATER\\AQUA\\EAU, BUTYLENE GLYCOL, CAPRYLIC/CAPRIC TRIGLYCERIDE, GLYCERIN, BUTYROSPERMUM PARKII (SHEA) BUTTER, PROPANEDIOL, PENTYLENE GLYCOL, BEHENYL ALCOHOL, RICINUS COMMUNIS (CASTOR) SEED OIL, CAPRYLIC/CAPRIC/MYRISTIC/STEARIC TRIGLYCERIDE, CETEARYL ALCOHOL, PANTHENOL, VINYL DIMETHICONE, THEOBROMA CACAO (COCOA) EXTRACT, THEOBROMA CACAO (COCOA) SEED EXTRACT, CETEARYL OLIVATE, CERAMIDE NP, GLYCERYL CAPRYLATE, DIPOTASSIUM GLYCYRRHIZATE, ADENOSINE, HYDROXYETHYL ACRYLATE/SODIUM ACRYLOYLDIMETHYL TAURATE COPOLYMER, C14-22 ALCOHOLS, C12-16 ALCOHOLS, 1,2-HEXANEDIOL, SORBITAN OLIVATE, PALMITIC ACID, HYDROGENATED LECITHIN, ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER, C12-20 ALKYL GLUCOSIDE, TROMETHAMINE, XANTHAN GUM, SYNTHETIC BEESWAX, SORBITAN ISOSTEARATE, DEXTRIN, FRAGRANCE (PARFUM), SODIUM PHYTATE, YELLOW 5 (CI 19140)","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["ceramides"],"description":"Ceramide-rich eye cream with 5 types of ceramides, panthenol and dipotassium glycyrrhizate. Strengthens the thin skin barrier around the eye area and locks in moisture. Contains fragrance/parfum — caution for very sensitive eye areas.","descriptionTH":"ครีมรอบดวงตาที่อุดมด้วยเซราไมด์ 5 ชนิด แพนทีนอล และไดโพแทสเซียมไกลซิราไรเซต เสริมสร้างเกราะผิวบางรอบดวงตาและล็อคความชุ่มชื้น มีน้ำหอม — ระวังสำหรับบริเวณรอบดวงตาที่แพ้ง่ายมาก","bestFor":"damaged barrier, dry, mature skin. Caution: contains fragrance","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมีริ้วรอย. ระวัง: มีน้ำหอม","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts. Avoid with retinol in eye area same session.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ หลีกเลี่ยงการใช้กับเรตินอลบริเวณตาในครั้งเดียวกัน","medicubeMode":"MC","thumbnailUrl":"https://static.thcdn.com/productimg/original/15840346-2055323085280879.jpg"},{"id":70,"imageUrl":"https://static.thcdn.com/productimg/original/13938507-1995335528158795.jpg","brand":"Dr.Jart+","name":"Cicapair Tiger Grass Color Correcting Treatment","category":"other","ingredients":"WATER/AQUA/EAU, ZINC OXIDE, ISONONYL ISONONANOATE, C12-15 ALKYL BENZOATE, GLYCERIN, BUTYLOCTYL SALICYLATE, LAURYL PEG-10 TRIS(TRIMETHYLSILOXY)SILYLETHYL DIMETHICONE, LAURYL POLYGLYCERYL-3 POLYDIMETHYLSILOXYETHYL DIMETHICONE, TITANIUM DIOXIDE, CAPRYLIC/CAPRIC TRIGLYCERIDE, TRIHEPTANOIN, SYNTHETIC FLUORPHLOGOPITE, DISTEARDIMONIUM HECTORITE, MAGNESIUM SULFATE, PENTYLENE GLYCOL, BEESWAX/CERA ALBA/CIRE D’ABEILLE, CENTELLA ASIATICA LEAF EXTRACT, NIACINAMIDE, ALLANTOIN, GLYCERYL CAPRYLATE, ASIATICOSIDE, MADECASSIC ACID, ASIATIC ACID, PALMITOYL TRIPEPTIDE-8, CAPRYLYL GLYCOL, BUTYLENE GLYCOL, POLYGLYCERYL-4 OLEATE, SODIUM STEAROYL GLUTAMATE, TOCOPHEROL, DIMETHICONE, ZEA MAYS (CORN) STARCH, SILICA DIMETHYL SILYLATE, ALUMINUM HYDROXIDE, HYDROGENATED LECITHIN, STEARIC ACID, SODIUM SURFACTIN, ISOPENTYLDIOL, PROPANEDIOL, ZEIN, DEXTRIN, TRIETHOXYCAPRYLYLSILANE, IRON OXIDES (CI 77492), TITANIUM DIOXIDE (CI 77891), CHROMIUM OXIDE GREENS (CI 77288), IRON OXIDES (CI 77491)","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["centella","niacinamide","peptides"],"description":"Green-to-beige colour-correcting tinted treatment with centella asiatica, zinc oxide and titanium dioxide providing SPF30. Neutralises redness instantly while providing UV protection. Good as a base coat for redness-prone skin.","descriptionTH":"ผลิตภัณฑ์ปรับสีสีเขียวเปลี่ยนเป็นเบจที่มีเซนเทลลา สังกะสีออกไซด์ และไทเทเนียมไดออกไซด์ให้ SPF30 ลบรอยแดงทันทีพร้อมป้องกัน UV","bestFor":"sensitive, redness-prone, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวหมองคล้ำ","howOften":"AM daily when coverage needed. Follow with higher SPF if prolonged sun exposure.","howOftenTH":"ทุกเช้าเมื่อต้องการความคุ้มครอง ใช้ครีมกันแดด SPF สูงกว่าหากอยู่กลางแจ้งนาน","doNotCombine":"N/A — last step before makeup","doNotCombineTH":"ไม่มี — ขั้นตอนสุดท้ายก่อนแต่งหน้า","medicubeMode":"None","thumbnailUrl":"https://static.thcdn.com/productimg/original/13938507-1995335528158795.jpg"},{"id":71,"imageUrl":"https://static.thcdn.com/productimg/original/15147266-1815323085028960.jpg","brand":"Dr.Jart+","name":"Cicapair™ Intensive Soothing Repair Serum","category":"serum","ingredients":"Ingredients WATER\\AQUA\\EAU, GLYCERIN, BUTYLENE GLYCOL, PROPANEDIOL, METHYL GLUCETH-20, ETHOXYDIGLYCOL, BETAINE, ALLANTOIN, OCTYLDODECANOL, ETHYLHEXYLGLYCERIN, ASIATICOSIDE, MADECASSIC ACID, GLYCOLIPIDS, ASIATIC ACID, POLYGLYCERYL-4 OLEATE, CENTELLA ASIATICA LEAF EXTRACT, SODIUM STEAROYL GLUTAMATE, PALMITOYL TRIPEPTIDE-8, 1,2-HEXANEDIOL, ISOPENTYLDIOL, CARBOMER, XANTHAN GUM, TROMETHAMINE, POLYGLYCERYL-10 LAURATE, HYDROGENATED LECITHIN, C12-13 ALKETH-9, SODIUM SURFACTIN, DEXTRAN, YELLOW 5 (CI 19140), BLUE 1 (CI 42090)","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["centella","peptides"],"description":"Centella asiatica-based calming serum with four cica actives (Asiaticoside, Madecassic acid, Asiatic acid), Jartbiome postbiotics and Palmitoyl Tripeptide-8. Significantly reduces visible redness. A go-to product for sensitive, reactive or post-acne skin.","descriptionTH":"เซรั่มบรรเทาที่มีเซนเทลลาเป็นหลักมีสาร cica สี่ชนิด โพสต์ไบโอติก Jartbiome และ Palmitoyl Tripeptide-8 ลดรอยแดงที่มองเห็นได้อย่างมีนัยสำคัญ","bestFor":"sensitive, redness-prone, mature skin, fine lines","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","thumbnailUrl":"https://static.thcdn.com/productimg/original/15147266-1815323085028960.jpg"},{"id":72,"imageUrl":"https://static.thcdn.com/productimg/original/14867789-6545323084441704.jpg","brand":"Dr.Jart+","name":"Cryo Rubber™ Moisturizing Hydrogel Mask with Hyaluronic Acid","category":"moisturizer","ingredients":"STEP 01\nWater/Aqua/Eau, Dipropylene Glycol, Glycerin, Caprylic/Capric Triglyceride, Butylene Glycol, 1,2-Hexanediol, PEG-240/HDI Copolymer Bis-Decyltetradeceth-20 Ether, Hyaluronic Acid, Acetyl Hexapeptide-8, Betaine, Caprylyl Glycol, Tocopherol, Isohexadecane, Dimethicone, Glyceryl Acrylate/Acrylic Acid Copolymer, Glyceryl Stearate, PEG-100 Stearate, Sorbitan Isostearate, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Polysorbate 60, Potassium Laurate, Sodium Phytate, Phenoxyethanol, Blue 1 (CI 42090). STEP 02\nWater/Aqua/Eau, Methylpropanediol, Chondrus Crispus, Glycerin, 1,2-Hexanediol, Ceratonia Siliqua (Carob) Gum, Allantoin, Dipotassium Glycyrrhizate, Panthenol, Sucrose, Aluminum Hydroxide, Polyglyceryl-10 Laurate, Citric Acid, Xanthan Gum, Potassium Chloride, Fragrance (Parfum), Tetramethyl-1, Acetyloctahydronaphthalenes, Disodium EDTA, Sodium Citrate, Phenoxyethanol, Titanium Dioxide (CI 77891), Ultramarines (CI 77007), Blue 1 (CI 42090).","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","peptides"],"description":"Innovative two-step rubber peel-off mask (serum ampoule + alginate rubber mask). Delivers HA, Acetyl Hexapeptide-8 and antioxidants deep into skin. Leave on 30 minutes. Delivers intense hydration and plumping in one session.","descriptionTH":"มาส์กยางล้างออกสองขั้นตอนนวัตกรรม มาส์กยางสร้างชั้นปิดแน่นส่ง HA เปปไทด์ และสารต้านอนุมูลอิสระเข้าสู่ผิวลึก วางทิ้งไว้ 30 นาที ให้ความชุ่มชื้นอย่างเข้มข้น","bestFor":"dry, mature skin, fine lines. Caution: contains fragrance","bestForTH":"ผิวแห้ง, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: มีน้ำหอม","howOften":"1-2x per week as PM treatment","howOftenTH":"1-2 ครั้ง/สัปดาห์ เป็นทรีทเมนต์ตอนเย็น","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"None","thumbnailUrl":"https://static.thcdn.com/productimg/original/14867789-6545323084441704.jpg"},{"id":73,"imageUrl":"https://static.thcdn.com/productimg/original/16157036-1285323084782429.jpg","brand":"Dr.Jart+","name":"Every Sun Day™ Ultra-Sheer Priming Sunscreen Stick SPF 50","category":"sunscreen","ingredients":"Water\\Aqua\\Eau, Dimethicone, Isododecane, Isononyl Isononanoate, Phenyl Trimethicone, Titanium Dioxide (Nano), Pentaerythrityl Tetraisostearate, Butyloctyl Salicylate, Methyl Trimethicone, Dipropylene Glycol, Lauryl Peg-10 Tris(Trimethylsiloxy)Silylethyl Dimethicone, Zinc Oxide (Nano), Niacinamide, Acrylates/Dimethicone Copolymer, Polyglyceryl-4 Isostearate, Pentylene Glycol, Disteardimonium Hectorite, Dipentaerythrityl Hexahydroxystearate/Hexastearate/Hexarosinate, Caprylyl Glycol, Glyceryl Caprylate, Glycerin, Allantoin, Ethylhexylglycerin, Butylene Glycol, Caprylic/Capric Triglyceride, Polyglyceryl-4 Oleate, Centella Asiatica Leaf Extract, Sodium Stearoyl Glutamate, Asiaticoside, Madecassic Acid, Palmitoyl Tripeptide-8, Asiatic Acid, Magnesium Sulfate, Triethoxycaprylylsilane, Synthetic Fluorphlogopite, Zein, Silica Dimethyl Silylate, Isopentyldiol, Propanediol, Zea Mays (Corn) Starch, Aluminum Hydroxide, Hydrogenated Lecithin, Sodium Surfactin, Tocopherol, Dextran , Titanium Dioxide (Ci 77891), Iron Oxides (Ci 77491), Iron Oxides (Ci 77492), Chromium Oxide Greens (Ci 77288)","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["centella","niacinamide","peptides"],"description":"Convenient chemical sunscreen stick with titanium dioxide and zinc oxide (nano), niacinamide and centella asiatica. Matte-satin finish that doubles as a makeup primer. Good for reapplication over makeup.","descriptionTH":"ครีมกันแดดสติ๊กเคมีที่สะดวกมีไทเทเนียมไดออกไซด์และสังกะสีออกไซด์ ไนอาซินาไมด์ และเซนเทลลา ให้ผิวดูแมทสาทินและใช้เป็นไพรเมอร์ได้","bestFor":"sensitive, redness-prone, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวหมองคล้ำ","howOften":"AM daily, reapply every 2h outdoors","howOftenTH":"ทุกเช้า ทาซ้ำทุก 2 ชั่วโมงกลางแจ้ง","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","thumbnailUrl":"https://static.thcdn.com/productimg/original/16157036-1285323084782429.jpg"},{"id":74,"brand":"Drunk Elephant","name":"B-Hydra™ Intensive Hydration Serum with Hyaluronic Acid","category":"serum","ingredients":"Water/Aqua/Eau, Coconut Alkanes, Ammonium Acryloyldimethyltaurate/VP Copolymer, Glycerin, Pentylene Glycol, Sclerocarya Birrea Seed Oil, Wheat Amino Acids, Ananas Sativus (Pineapple) Fruit Extract, Berberis Vulgaris Root Extract, Citrullus Lanatus (Watermelon) Fruit Extract, Lens Esculenta (Lentil) Fruit Extract, Pyrus Malus (Apple) Fruit Extract, Coco-Caprylate/Caprate, Panthenol, Sodium PCA, Sodium Hyaluronate Crosspolymer, Dipotassium Glycyrrhizate, Niacinamide, Cyclodextrin, Sodium Hyaluronate, Sodium Lactate, Phenoxyethanol, Hydroxyproline, Trisodium Ethylenediamine Disuccinate, Citric Acid, Caprylyl Glycol, Chlorphenesin, Ethylhexylglycerin","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide"],"description":"Pro-vitamin B5 hydration serum with sodium hyaluronate crosspolymer, pineapple ceramide, watermelon and apple extract, dipotassium glycyrrhizate and panthenol. Intensely plumps dehydrated skin. Fragrance-free (clean from the Suspicious 6).","descriptionTH":"เซรั่มให้ความชุ่มชื้นด้วยโปรวิตามินบี5 มีโซเดียมไฮยาลูโรเนตครอสโพลิเมอร์ เซราไมด์สับปะรด แตงโมและสารสกัดแอปเปิ้ล แพนทีนอล เติมน้ำผิวที่ขาดน้ำอย่างเข้มข้น ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, dry, oily, combination, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://www.drunkelephant.com/dw/image/v2/BBSK_PRD/on/demandware.static/-/Sites-itemmaster_drunkelephant/default/dwc909f280/products/images/2026/April/B-Hydra_new-images/B-Hydra-PDP_1.jpg?sw=540&amp;sh=540&amp;sm=fit","thumbnailUrl":"https://www.drunkelephant.com/dw/image/v2/BBSK_PRD/on/demandware.static/-/Sites-itemmaster_drunkelephant/default/dwc909f280/products/images/2026/April/B-Hydra_new-images/B-Hydra-PDP_1.jpg?sw=540&amp;sh=540&amp;sm=fit"},{"id":75,"imageUrl":"https://www.drunkelephant.com/dw/image/v2/BBSK_PRD/on/demandware.static/-/Sites-itemmaster_drunkelephant/default/dwf4173c32/products/images/2026/February/C-Firma_new_images/C-Firma_new_PDP_1.jpg?sw=1408&sh=1408&sm=fit","brand":"Drunk Elephant","name":"C-Firma Fresh Vitamin-C Day Serum","category":"serum","ingredients":"Water/Aqua/Eau, Dimethyl Isosorbide, Ascorbic Acid, Laureth-23, Glycerin, Tocopherol, Lactobacillus/Pumpkin Ferment Extract, Sclerocarya Birrea Seed Oil, Dipotassium Glycyrrhizate, Glycyrrhiza Glabra (Licorice) Root Extract, Vitis Vinifera (Grape) Juice Extract, Ferulic Acid, Phyllanthus Emblica Fruit Extract, Camellia Sinensis Leaf Extract, Lactobacillus/Punica Granatum Fruit Ferment Extract, Propanediol, Gluconolactone, Sodium Hyaluronate Crosspolymer, Sodium Hyaluronate, Oryza Sativa (Rice) Bran Extract, Glutamylamidoethyl Imidazole, Tetrahydrobisdemethoxydiferuloylmethane, Tetrahydrodemethoxydiferuloylmethane, Tetrahydrodiferuloylmethane, Pentylene Glycol, Caprylhydroxamic Acid, Leuconostoc/Radish Root Ferment Filtrate, Sorbic Acid, Phenoxyethanol, Sodium Benzoate, Caprylyl Glycol, Chondrus Crispus (Carrageenan) Extract, Ethylhexylglycerin.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid"],"description":"High-performance antioxidant day serum with 15% L-ascorbic acid + ferulic acid + vitamin E (CE Ferulic formula) and pumpkin/pomegranate ferment extract. Brightens dark spots, strengthens collagen and provides powerful free radical protection. Refrigerate after mixing.","descriptionTH":"เซรั่มกลางวันต้านอนุมูลอิสระประสิทธิภาพสูงที่มีกรดแอสคอร์บิก 15% + กรดเฟอรูลิก + วิตามินอี และสารสกัดจากการหมักฟักทองและทับทิม เพิ่มความกระจ่างใสรอยดำ เสริมสร้างคอลลาเจน เก็บตู้เย็นหลังผสม","bestFor":"dry, dull skin, hyperpigmentation","bestForTH":"ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM daily only. Always SPF immediately after.","howOftenTH":"ทุกเช้าเท่านั้น ต้องทาครีมกันแดดทันทีหลังใช้","doNotCombine":"NEVER combine with retinol, AHA/BHA, copper peptides in same session.","doNotCombineTH":"ห้ามใช้ร่วมกับเรตินอล AHA/BHA คอปเปอร์เปปไทด์ในครั้งเดียวกัน","medicubeMode":"None","thumbnailUrl":"https://www.drunkelephant.com/dw/image/v2/BBSK_PRD/on/demandware.static/-/Sites-itemmaster_drunkelephant/default/dwf4173c32/products/images/2026/February/C-Firma_new_images/C-Firma_new_PDP_1.jpg?sw=1408&sh=1408&sm=fit"},{"id":76,"brand":"Drunk Elephant","name":"Protini™ Polypeptide Firming Refillable Moisturizer","category":"moisturizer","ingredients":"Water/Aqua/Eau, Dimethyl Isosorbide, Ascorbic Acid, Laureth-23, Glycerin, Tocopherol, Lactobacillus/Pumpkin Ferment Extract, Sclerocarya Birrea Seed Oil, Dipotassium Glycyrrhizate, Glycyrrhiza Glabra (Licorice) Root Extract, Vitis Vinifera (Grape) Juice Extract, Ferulic Acid, Phyllanthus Emblica Fruit Extract, Camellia Sinensis Leaf Extract, Lactobacillus/Punica Granatum Fruit Ferment Extract, Propanediol, Gluconolactone, Sodium Hyaluronate Crosspolymer, Sodium Hyaluronate, Oryza Sativa (Rice) Bran Extract, Glutamylamidoethyl Imidazole, Tetrahydrobisdemethoxydiferuloylmethane, Tetrahydrodemethoxydiferuloylmethane, Tetrahydrodiferuloylmethane, Pentylene Glycol, Caprylhydroxamic Acid, Leuconostoc/Radish Root Ferment Filtrate, Sorbic Acid, Phenoxyethanol, Sodium Benzoate, Caprylyl Glycol, Chondrus Crispus (Carrageenan) Extract, Ethylhexylglycerin.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid"],"description":"Multi-peptide and amino acid moisturizer with 6 signal peptides, 8 amino acids, pygmy waterlily and fermented ingredients. Firms and plumps with consistent use. Fragrance-free. Comes in refillable packaging.","descriptionTH":"มอยส์เจอไรเซอร์ที่มีเปปไทด์หลายชนิดและกรดอะมิโน มีซิกนัลเปปไทด์ 6 ชนิด กรดอะมิโน 8 ชนิด กระชับและเติมเต็มผิวเมื่อใช้อย่างต่อเนื่อง ปราศจากน้ำหอม","bestFor":"dry, dull skin, hyperpigmentation, mature skin, fine lines","bestForTH":"ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://www.drunkelephant.com/dw/image/v2/BBSK_PRD/on/demandware.static/-/Sites-itemmaster_drunkelephant/default/dwc318f9ff/products/images/2026/January/Protini_new_images/Protini-PDP_2026_Standard-Hero.jpg?sw=540&amp;sh=540&amp;sm=fit","thumbnailUrl":"https://www.drunkelephant.com/dw/image/v2/BBSK_PRD/on/demandware.static/-/Sites-itemmaster_drunkelephant/default/dwc318f9ff/products/images/2026/January/Protini_new_images/Protini-PDP_2026_Standard-Hero.jpg?sw=540&amp;sh=540&amp;sm=fit"},{"id":77,"brand":"Drunk Elephant","name":"T.L.C. Sukari Babyfacial™ AHA + BHA Mask","category":"treatment","ingredients":"Water/Aqua/Eau, Glycolic Acid, Butylene Glycol, Propanediol, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Glycerin, Sodium Hydroxide, Salicylic Acid, Tartaric Acid, Aloe Barbadensis Leaf Extract, Camellia Sinensis Leaf Extract, Lactobacillus/Pumpkin Fruit Ferment Filtrate, Lactobacillus/Punica Granatum Fruit Ferment Extract, Opuntia Ficus-Indica Fruit Extract, Pyrus Malus (Apple) Fruit Extract, Silybum Marianum Extract, Saccharomyces Cerevisiae Extract, Vitis Vinifera (Grape) Juice Extract, Cicer Arietinum Seed Extract, Sclerocarya Birrea Seed Oil, Passiflora Edulis Seed Oil, Leuconostoc/Radish Root Ferment Filtrate, Sodium Hyaluronate Crosspolymer, Sodium PCA, Allantoin, Dipotassium Glycyrrhizate, Sorbitan Isostearate, Phytosphingosine, Lactic Acid, Citric Acid, Tetrasodium Glutamate Diacetate, Polysorbate 60, Tocopherol, Chlorphenesin, Phenoxyethanol, Pentylene Glycol, Potassium Sorbate, Sodium Carbonate, Sodium Benzoate, Ethylhexylglycerin, Titanium Dioxide (CI 77891)","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","bha","aha"],"description":"Powerful weekly resurfacing mask with 25% AHA (glycolic, tartaric, lactic, citric) and 2% BHA (salicylic acid). Strong tingling/warmth is expected. Leave on for only 20 minutes. NOT for sensitive, reactive or barrier-compromised skin.","descriptionTH":"มาส์กผลัดเซลล์ผิวรายสัปดาห์ที่ทรงพลังมี AHA 25% และ BHA 2% คาดว่าจะรู้สึกร้อนแสบ วางทิ้งไว้เพียง 20 นาที ไม่เหมาะสำหรับผิวแพ้ง่ายหรือเกราะผิวเสียหาย","bestFor":"oily, acne-prone","bestForTH":"ผิวมัน, ผิวเป็นสิว","howOften":"1x per week max (PM). Always SPF next morning.","howOftenTH":"สูงสุด 1 ครั้ง/สัปดาห์ (ตอนเย็น) ต้องทาครีมกันแดดทุกเช้าถัดไป","doNotCombine":"NEVER same session or same week as retinol, strong vitamin C, benzoyl peroxide.","doNotCombineTH":"ห้ามใช้ในครั้งเดียวกันหรือสัปดาห์เดียวกับเรตินอล วิตามินซีเข้มข้น เบนโซอิลเพอร์ออกไซด์","medicubeMode":"None","imageUrl":"https://www.drunkelephant.com/dw/image/v2/BBSK_PRD/on/demandware.static/-/Sites-itemmaster_drunkelephant/default/dwedb27ec3/products/images/2026/May/TLC_Sukari_Babyfacial/Babyfacial-PDP_1.jpg?sw=540&amp;sh=540&amp;sm=fit","thumbnailUrl":"https://www.drunkelephant.com/dw/image/v2/BBSK_PRD/on/demandware.static/-/Sites-itemmaster_drunkelephant/default/dwedb27ec3/products/images/2026/May/TLC_Sukari_Babyfacial/Babyfacial-PDP_1.jpg?sw=540&amp;sh=540&amp;sm=fit"},{"id":78,"imageUrl":"https://static.thcdn.com/productimg/original/10364543-1855326899332361.jpg","brand":"Elemis","name":"Pro-Collagen Marine Cream","category":"moisturizer","ingredients":"Aqua/Water/Eau, Glycerin, Caprylic/Capric Triglyceride, Glyceryl Stearate SE, Isononyl Isononanoate, Dicaprylyl Carbonate, Dimethicone, Phenoxyethanol, Polyacrylate-13, Cetyl Alcohol, Stearic Acid, Tocopheryl Acetate, Coco-Caprylate/Caprate, Xanthan Gum, Polyisobutene, Fragrance (Parfum), Tocopherol, Butyrospermum Parkii (Shea Butter), Chlorphenesin, Triticum Vulgare (Wheat) Germ Oil, Chlorella Vulgaris Extract, Glyceryl Polyacrylate, Daucus Carota Sativa (Carrot) Root Extract, Glyceryl Acrylate/Acrylic Acid Copolymer, Disodium EDTA, Padina Pavonica Thallus Extract, Sodium Dehydroacetate, Polysorbate 20, Sorbitan Isostearate, Ginkgo Biloba Leaf Extract, Porphyridium Cruentum Extract, Mimosa Tenuiflora Bark Extract, Rosa Damascena Flower Extract, Collagen Amino Acids, Linalool, Citronellol, Leuconostoc/Radish Root Ferment Filtrate, Potassium Sorbate, Sodium Benzoate, Limonene, Geraniol, Citric Acid.","fragranceFree":false,"alcoholFree":true,"eoFree":false,"activeIngredients":[],"description":"Luxury anti-aging moisturizer with padina pavonica (sea algae), ginkgo biloba and chlorella vulgaris extracts that firm and smooth. Contains fragrance (parfum) with multiple identified allergens — not recommended for sensitive or fragrance-allergic users.","descriptionTH":"มอยส์เจอไรเซอร์ต้านริ้วรอยระดับหรูมีสาหร่าย Padina pavonica ใบแปะก๊วย และสารสกัด Chlorella vulgaris เพื่อกระชับและเรียบผิว มีน้ำหอม (parfum) พร้อมสารก่อแพ้หลายชนิด","bestFor":"dry, mature skin. Caution: contains fragrance, contains essential oils","bestForTH":"ผิวแห้ง, ผิวมีริ้วรอย. ระวัง: มีน้ำหอม, มีน้ำมันหอมระเหย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance.","doNotCombineTH":"มีน้ำหอม","medicubeMode":"Derma Shot","thumbnailUrl":"https://static.thcdn.com/productimg/original/10364543-1855326899332361.jpg"},{"id":79,"brand":"EltaMD","name":"EltaMD Barrier Renewal Complex","category":"other","ingredients":"Water, Ethylhexyl Isononanoate, Niacinamide, Glycerin, Squalane, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Glyceryl Stearate, PEG-100 Stearate,Phenoxyethanol, Xylitylglucoside, Anhydroxylitol, Polyisobutene, Carbomer, Xylitol, Actinidia Chinensis (Kiwi) Fruit Extract, Piptadenia Colubrina Peel Extract, Ethylhexylglycerin, Sodium Hyaluronate, PEG-7 Trimethylolpropane Coconut Ether, Bromelain, Ceteareth-25, Tocopherol, Disodium EDTA, Glycine Soja (Soybean) Oil, Maltodextrin, Cetyl Alcohol, Microcrystalline Cellulose, Benzyl Alcohol, Behenic Acid, Ceramide NP, Cholesterol, Diethylene Glycol, Potassium Sorbate, Silica, Ceramide NS, Ceramide AP, Ceramide EOP, Ceramide EOS, Caprooyl Phytosphingosine, Caprooyl Sphingosine, Ascorbyl Palmitate, Butylene Glycol, Citric Acid, Sodium Hydroxide, Sodium Bisulfite, Biotin, Ficin, Glutamine, Proline.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid","niacinamide","ceramides"],"description":"Ceramide-rich night cream with cholesterol, phytosphingosine, 5 peptides, bromelain (pineapple enzyme), panthenol and xylityl glucoside. Supports barrier lipid synthesis overnight. Fragrance-free.","descriptionTH":"ครีมบำรุงคืนที่อุดมด้วยเซราไมด์ คอเลสเตอรอล ฟิโตสฟิงโกซีน เปปไทด์ 5 ชนิด โบรเมเลน แพนทีนอล สนับสนุนการสังเคราะห์ไขมันเกราะผิวข้ามคืน ปราศจากน้ำหอม","bestFor":"damaged barrier, dull skin","bestForTH":"ผิวแบเรียร์เสีย, ผิวหมองคล้ำ","howOften":"PM daily","howOftenTH":"ตอนเย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0467/8120/2585/files/Barrier_Renewal_Complex_02562A.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0467/8120/2585/files/Barrier_Renewal_Complex_02562A.jpg"},{"id":80,"brand":"EltaMD","name":"EltaMD UV Clear Broad-Spectrum SPF 46","category":"sunscreen","ingredients":"Active Ingredient(s) & Concentration: Octinoxate 7.5%,Zinc Oxide 9.0%. Inactive Ingredients: Water, Cyclopentasiloxane, Niacinamide, Octyldodecyl Neopentanoate, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Butylene Glycol, Phenoxyethanol, Polyisobutene, Triethoxycaprylylsilane, Tocopheryl Acetate, PEG-7 Trimethylolpropane Coconut Ether, Oleth-3 Phosphate, Iodopropynyl Butylcarbamate, Lactic Acid, Sodium Hyaluronate, Phosphoric Acid.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide"],"description":"Dermatologist-favourite hybrid sunscreen (zinc oxide 9% + octinoxate 7.5%) with 5% niacinamide, sodium hyaluronate and lactic acid. Sheer, lightweight finish that actually helps manage acne and rosacea. Widely used post-procedure.","descriptionTH":"ครีมกันแดดไฮบริดที่แพทย์ผิวหนังชอบ (สังกะสีออกไซด์ 9% + ออคตินอกเซต 7.5%) มีไนอาซินาไมด์ 5% โซเดียมไฮยาลูโรเนต และกรดแลกติก เนื้อเบาบาง น้ำหนักเบาที่ช่วยจัดการสิวและโรซาเซียได้จริง","bestFor":"oily, dull skin","bestForTH":"ผิวมัน, ผิวหมองคล้ำ","howOften":"AM daily, reapply every 2h outdoors","howOftenTH":"ทุกเช้า ทาซ้ำทุก 2 ชั่วโมงกลางแจ้ง","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0467/8120/2585/files/2-award.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0467/8120/2585/files/2-award.png"},{"id":81,"brand":"Eucerin","name":"Anti-Pigment Skin Illuminating Serum","category":"serum","ingredients":"Aqua, Glycerin, Alcohol Denat, Cetyl Alcohol, Dibutyl Adipate, Caprylic/Capric Triglyceride, Dicaprylyl Carbonate, Propylheptyl Caprylate, Isobutylamido Thiazolyl Resorcinol, Sodium Hyaluronate, Tocopherol, Sodium Stearoyl Glutamate, Dimethicone, Carbomer, Phenoxyethanol, Ethylhexylglycerin, Trisodium EDTA, Sodium Hydroxide, Sodium Chloride, Parfum","fragranceFree":false,"alcoholFree":false,"eoFree":true,"activeIngredients":["hyaluronic acid"],"description":"Dermatologist-tested brightening serum with Thiamidol (patented Eucerin molecule that inhibits melanin production at the tyrosinase enzyme level), sodium hyaluronate and vitamin E. Clinically proven to visibly reduce dark spots in 4 weeks. Fragrance-free. Contains alcohol denat.","descriptionTH":"เซรั่มเพิ่มความกระจ่างใสที่ทดสอบโดยผู้เชี่ยวชาญผิวหนัง มีสาร Thiamidol ที่จดสิทธิบัตรของ Eucerin โซเดียมไฮยาลูโรเนต และวิตามินอี พิสูจน์ทางคลินิกว่าลดรอยดำภายใน 4 สัปดาห์ มีแอลกอฮอล์ Denat.","bestFor":"dry. Caution: contains fragrance","bestForTH":"ผิวแห้ง. ระวัง: มีน้ำหอม","howOften":"AM + PM daily. SPF essential in AM.","howOftenTH":"เช้า-เย็น ทุกวัน ต้องใช้ครีมกันแดดตอนเช้า","doNotCombine":"Contains Alcohol Denat. Caution with strong AHA or retinol.","doNotCombineTH":"มีแอลกอฮอล์ Denat. ระวังเมื่อใช้ร่วมกับ AHA แรงหรือเรตินอล","medicubeMode":"Booster","imageUrl":"https://images-1.eucerin.com/~/media/eucerin%20relaunch%20media/media-center-items/1/3/f/7462a571b52d4dd7a2784d413af41228-screen.jpg","thumbnailUrl":"https://images-1.eucerin.com/~/media/eucerin%20relaunch%20media/media-center-items/1/3/f/7462a571b52d4dd7a2784d413af41228-screen.jpg"},{"id":82,"brand":"Eucerin","name":"Eucerin Sun Oil Control Gel-Cream SPF 50+","category":"sunscreen","ingredients":"Aqua, C12-15 Alkyl Benzoate, Alcohol Denat, Butyl Methoxydibenzoylmethane, Butylene Glycol Dicaprylate/Dicaprate, Ethylhexyl Triazone, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Dibutyl Adipate, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Glyceryl Stearate Citrate, Phenylbenzimidazole Sulfonic Acid, Silica, Tapioca Starch, Behenyl Alcohol, Cetearyl Alcohol, Silica Dimethyl Silylate, Carnitine, Glycyrrhetinic Acid, Glycyrrhiza Inflata Root Extract, Glycerin, Dimethicone, Copernicia Cerifera Cera, Hydroxypropyl Methylcellulose, Xanthan Gum, Sodium Hydroxide, Trisodium EDTA, Hydroxyacetophenone, Ethylhexylglycerin, Phenoxyethanol","fragranceFree":true,"alcoholFree":false,"eoFree":true,"activeIngredients":[],"description":"Mattifying, oil-controlling chemical sunscreen SPF50+/UVA 42 with L-carnitine (controls sebum production), silica (oil absorption), capryloyl glycine and glycyrrhetinic acid. Non-comedogenic.","descriptionTH":"ครีมกันแดดเคมี SPF50+/UVA42 แบบแมทที่ควบคุมน้ำมัน มีแอล-คาร์นิทีน ซิลิก้า คาปรีลอยล์ไกลซีน และกรดไกลเซอไรเธนิก ไม่อุดรูขุมขน","bestFor":"All skin types","bestForTH":"ผิวทุกประเภท","howOften":"AM daily, reapply every 2h outdoors","howOftenTH":"ทุกเช้า ทาซ้ำทุก 2 ชั่วโมงกลางแจ้ง","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","imageUrl":"https://images-1.eucerin.com/~/media/eucerin%20relaunch%20media/media-center-items/1/4/0/e8092d0879fe468daf42b6e4cd8af6a5-screen.jpg","thumbnailUrl":"https://images-1.eucerin.com/~/media/eucerin%20relaunch%20media/media-center-items/1/4/0/e8092d0879fe468daf42b6e4cd8af6a5-screen.jpg"},{"id":83,"brand":"Eucerin","name":"UreaRepair Cream","category":"moisturizer","ingredients":"Aqua, Glycerin, Urea, Caprylic/Capric Triglyceride, Ethylhexyl Cocoate, Squalane, Sodium Lactate, Butyrospermum Parkii Butter, Decyl Oleate, Polyglyceryl-3 Diisostearate, Hydrogenated Castor Oil, Ceramide NP, Lactic Acid, Tocopherol, Cholesterol, Alanine, Carnitine, Glycine, Sodium PCA, Arginine HCL, Phytosphingosine, Tapioca Starch, Magnesium Sulfate, 1,2-Hexanediol, Phenoxyethanol, Sodium Chloride","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["ceramides"],"description":"5% urea-based facial/body repair cream with squalane, ceramide NP, cholesterol, phytosphingosine and lactic acid. Urea binds water AND gently exfoliates (keratolytic effect). Restores very dry, rough or scaly skin. Fragrance-free.","descriptionTH":"ครีมซ่อมแซมผิวหน้า/ร่างกายที่มียูเรีย 5% สควาเลน เซราไมด์ NP คอเลสเตอรอล ฟิโตสฟิงโกซีน และกรดแลกติก ยูเรียจับน้ำและผลัดเซลล์ผิวเบาๆ ปราศจากน้ำหอม","bestFor":"damaged barrier, dry, oily","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Caution combining with retinol or strong AHA in same area on very sensitive skin.","doNotCombineTH":"ระวังการใช้ร่วมกับเรตินอลหรือ AHA แรงในบริเวณเดียวกันบนผิวแพ้ง่ายมาก","medicubeMode":"Derma Shot","imageUrl":"https://images-1.eucerin.com/~/media/eucerin%20relaunch%20media/media-center-items/e/4/4/41f4cc2da81048138ba8ec8fbf5f39e7-screen.jpg","thumbnailUrl":"https://images-1.eucerin.com/~/media/eucerin%20relaunch%20media/media-center-items/e/4/4/41f4cc2da81048138ba8ec8fbf5f39e7-screen.jpg"},{"id":84,"brand":"Farmacy","name":"Green Clean Cleansing Balm","category":"oil cleanser","subcategory":"cleansing balm","ingredients":"CETYL ETHYLHEXANOATE, HELIANTHUS ANNUUS (SUNFLOWER) SEED OIL, POLYGLYCERYL-6 DICAPRATE, HELIANTHUS ANNUUS (SUNFLOWER) SEED WAX, POLYGLYCERYL-10 DIOLEATE, STEARYL BEHENATE, C10-18 TRIGLYCERIDES, POLYHYDROXYSTEARIC ACID, MORINGA OLEIFERA SEED OIL*, OCIMUM SANCTUM LEAF EXTRACT*, ERUCA SATIVA LEAF EXTRACT*, CARICA PAPAYA (PAPAYA) FRUIT EXTRACT,  ZINGIBER OFFICINALE (GINGER) ROOT OIL, LINUM USITATISSIMUM (LINSEED) SEED OIL, BRASSICA CAMPESTRIS (RAPESEED) SEED OIL, SORBITAN SESQUIOLEATE, CITRUS AURANTIUM DULCIS (ORANGE) PEEL OIL, CANANGA ODORATA FLOWER OIL, CITRUS AURANTIUM BERGAMIA (BERGAMOT) FRUIT OIL, CITRUS AURANTIFOLIA (LIME) OIL, STEAROYL GLUTAMIC ACID, CAPRYLIC/CAPRIC TRIGLYCERIDE, GLYCERYL LAURATE, TOCOPHEROL, LECITHIN, CHROMIUM OXIDE GREENS (CI 77288), CITRAL, LIMONENE, LINALOOL\n\n*KEY INGREDIENTS COMPRISED IN SUPER GREENS BLEND:\n\nMORINGA = MORINGA OLEIFERA SEED OIL*\n\nHOLY BASIL = OCIMUM SANCTUM LEAF EXTRACT*\n\nARUGULA = ERUCA SATIVA LEAF EXTRACT*","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":[],"description":"Sunflower wax and oil cleansing balm with moringa oil, holy basil, arugula extract and papaya enzyme. Melts makeup and SPF thoroughly. Contains essential oils (orange, bergamot, lime, cananga/ylang ylang) — not for fragrance-sensitive skin.","descriptionTH":"คลีนซิ่งบาล์มน้ำมันดอกทานตะวันมีน้ำมันมะรุม โหระพาศักดิ์สิทธิ์ สารสกัดผักรูโกลา และเอนไซม์มะละกอ มีน้ำมันหอมระเหย ไม่เหมาะสำหรับผิวแพ้น้ำหอม","bestFor":"All skin types. Caution: contains essential oils","bestForTH":"ผิวทุกประเภท. ระวัง: มีน้ำมันหอมระเหย","howOften":"PM daily as first cleanse","howOftenTH":"ตอนเย็น ทุกวัน เป็นขั้นตอนทำความสะอาดแรก","doNotCombine":"N/A — wash-off. Contains essential oils.","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก มีน้ำมันหอมระเหย","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/2474/1834/files/Farmacy_GreenCleanCleansingBalm_100ml_Hero.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/2474/1834/files/Farmacy_GreenCleanCleansingBalm_100ml_Hero.jpg"},{"id":85,"brand":"Farmacy","name":"Honey Halo Ultra-Hydrating Ceramide Moisturizer","category":"moisturizer","ingredients":"WATER/AQUA/EAU, GLYCERIN, BUTYROSPERMUM PARKII (SHEA) BUTTER, CAPRYLIC/CAPRIC TRIGLYCERIDE, C13-15 ALKANE, CETEARYL ALCOHOL, PENTAERYTHRITYL TETRAISOSTEARATE, 1,2-HEXANEDIOL, BIS-DIGLYCERYPOLYACYLADIPATE-1, DIISOSTEARYL MALATE, XYLITYLGLUCOSIDE, HONEY EXTRACT/MEL/EXTRAIT DE MIEL, BETAINE, PANTHENOL, HYDROGENATED RAPESEED OIL, HELIANTHUS ANNUUS (SUNFLOWER) SEED OIL UNSAPONIFIABLES, CERAMIDE NP, PROPOLIS EXTRACT, ROYAL JELLY EXTRACT, TOCOPHEROL, FICUS CARICA (FIG) FRUIT EXTRACT, HIPPOPHAE RHAMNOIDES OIL, GLUCOSE, BISABOLOL, XYLITOL, ANHYDROXYLITOL, CETEARYL GLUCOSIDE, TRIOLEIN, ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER, HYDROXYETHYL ACRYLATE/SODIUM ACRYLOYLDIMETHYLTARUATE COPOLYMER, ARGININE, FLAVOR (AROMA), HYDROXYACETOPHENONE, XANTHAN GUM, GLYCERYL DIOLEATE, SODIUM DILAURAMIDOGUTAMIDELYSINE, SODIUM PHYTATE, SORBITAN ISOSTEARATE, CITRIC ACID, POTASSIUM SORBATE, SODIUM BENZOATE (*NATURAL FLAVOR / AROME NATUREL)","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["ceramides"],"description":"Honey- and ceramide-rich moisturizer with propolis extract, royal jelly, manuka honey, ceramide NP, shea butter and fig extract. Rich but non-greasy. Avoid if allergic to bee products.","descriptionTH":"มอยส์เจอไรเซอร์ที่อุดมด้วยน้ำผึ้งและเซราไมด์ มีสารสกัดโพรโพลิส นมผึ้ง น้ำผึ้งมานูก้า เชียบัตเตอร์ เข้มข้นแต่ไม่มัน หลีกเลี่ยงหากแพ้ผลิตภัณฑ์จากผึ้ง","bestFor":"sensitive, redness-prone, damaged barrier, dry, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Avoid if bee/propolis-allergic.","doNotCombineTH":"หลีกเลี่ยงหากแพ้ผลิตภัณฑ์จากผึ้ง/โพรโพลิส","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/2474/1834/files/Farmacy_HoneyHalo_50ml_Hero_balanced_2000x2000_24db588f-fbca-47ca-80cb-174e73387796.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/2474/1834/files/Farmacy_HoneyHalo_50ml_Hero_balanced_2000x2000_24db588f-fbca-47ca-80cb-174e73387796.jpg"},{"id":86,"imageUrl":"https://www.fresh.com/on/demandware.static/-/Sites-fresh_master_catalog/default/dw3664ccba/product_images/H00006118_plp.jpg","brand":"Fresh","name":"Rose Deep Hydration Cream","category":"moisturizer","ingredients":"Aqua (Water), Glycerin, C15-19 Alkane, Butylene Glycol, Propanediol, Isostearyl Isostearate, Hexyl Laurate, Pentylene Glycol, 1,2-Hexanediol, Behenyl Alcohol, Steareth-2, Prunus Domestica Seed Oil, Rosa Damascena Flower Water, Rosa Damascena Extract, Angelica Keiskei Leaf/Stem Extract, Acacia Senegal Gum, Rosa Damascena Flower Extract, Rosa Damascena Flower Oil, Cucumis Sativus (Cucumber) Fruit Extract, Tocopheryl Acetate, Silica, Dimethicone, Ammonium Acryloyldimethyltaurate/Vp Copolymer, Steareth-21, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Sodium Hyaluronate, Squalane, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tromethamine, Xanthan Gum, Dimethiconol, Polysorbate 60, Caprylic/Capric Triglyceride, Algin, Sodium Chloride, Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate, Sorbitan Isostearate, Trisodium Ethylenediamine Disuccinate , Serine, Caramel, Caprylyl Glycol, Citric Acid, Sodium Hydroxide, Chlorphenesin, Sodium Benzoate, Potassium Sorbate, Citronellol, Geraniol <18729>Disclaimer: Fresh product ingredient listings are updated periodically, Before using a Fresh product, please read the ingredient list on the packaging of your product to be sure that the ingredients are appropriate for your personal use,","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":["hyaluronic acid"],"description":"Luxurious rose water and HA moisturizer with Rosa Damascena extract, plum seed oil, cucumber fruit extract, squalane and algin. Intensely hydrating with a dewy finish. Contains natural rose fragrance — not for fragrance-sensitive skin.","descriptionTH":"มอยส์เจอไรเซอร์น้ำดอกกุหลาบและ HA หรูมีสารสกัด Rosa Damascena น้ำมันเมล็ดลูกพลัม สารสกัดแตงกวา สควาเลน ให้ความชุ่มชื้นอย่างเข้มข้น มีน้ำหอมกุหลาบธรรมชาติ","bestFor":"dry. Caution: contains essential oils","bestForTH":"ผิวแห้ง. ระวัง: มีน้ำมันหอมระเหย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance.","doNotCombineTH":"มีน้ำหอม","medicubeMode":"MC","thumbnailUrl":"https://www.fresh.com/on/demandware.static/-/Sites-fresh_master_catalog/default/dw3664ccba/product_images/H00006118_plp.jpg"},{"id":87,"imageUrl":"https://www.fresh.com/dw/image/v2/BDJQ_PRD/on/demandware.static/-/Sites-fresh_master_catalog/default/dwf472c5d3/product_images/H00006238_plp.jpg","brand":"Fresh","name":"Soy Face Cleanser","category":"cleanser","ingredients":"Aqua (Water), Coco-Glucoside, Butylene Glycol, Glycerin, Propanediol, Xanthan Gum, 1,2-Hexanediol, Polyglyceryl-10 Laurate, Centaurea Cyanus Flower Water, Cucumis Sativus (Cucumber) Fruit Extract, Helianthus Annuus (Sunflower) Seed Oil, Borago Officinalis Seed Oil, Hydrolyzed Soy Protein, Rosa Damascena Extract, Rosa Damascena Flower Water, Aloe Barbadensis Leaf Juice, Panax Ginseng Root Extract, Malva Sylvestris (Mallow) Flower Extract, Rosa Damascena Flower Oil, Tocopherol, Caprylic/Capric Triglyceride, Caprylyl Glycol, Hydrolyzed Jojoba Esters, Silica, Citric Acid, Pentylene Glycol, Caramel, Sodium Hydroxide, Sodium Benzoate, Potassium Sorbate <16057> Disclaimer: Fresh product ingredient listings are updated periodically. Before using a Fresh product, please read the ingredient list on the packaging of your product to be sure that the ingredients are appropriate for your personal use.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Gentle, pH-balanced gel cleanser with hydrolyzed soy protein, coco-glucoside, cucumber fruit extract and rosewater. Removes impurities while maintaining the skin's natural lipid barrier. Contains Rosa Damascena flower oil fragrance — not for fragrance-sensitive.","descriptionTH":"เจลล้างหน้าอ่อนโยน pH สมดุล มีโปรตีนถั่วเหลืองไฮโดรไลซ์ โคโค-กลูโคไซด์ สารสกัดแตงกวา และน้ำดอกกุหลาบ มีน้ำมัน Rosa Damascena ไม่เหมาะสำหรับผู้แพ้น้ำหอม","bestFor":"sensitive","bestForTH":"ผิวบอบบาง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off. Contains fragrance.","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก มีน้ำหอม","medicubeMode":"None","thumbnailUrl":"https://www.fresh.com/dw/image/v2/BDJQ_PRD/on/demandware.static/-/Sites-fresh_master_catalog/default/dwf472c5d3/product_images/H00006238_plp.jpg"},{"id":88,"brand":"Glow Recipe","name":"Plum Plump Hyaluronic Cream","category":"moisturizer","ingredients":"Water/Aqua/Eau, Propanediol, Glycerin, C13-15 Alkane, Caprylic/Capric Triglyceride, C9-12 Alkane, Prunus Domestica Seed Oil*, Pentylene Glycol, Squalane, Terminalia Ferdinandiana Seed Oil*, Hyaluronic Acid, Sodium Acetylated Hyaluronate, Sodium Hyaluronate, Davidsonia Jerseyana Fruit Extract*, Terminalia Ferdinandiana Fruit Extract*, Podocarpus Elatus Fruit Extract*, Polyglutamic Acid, Pleiogynium Timoriense Fruit Extract*, Sodium Hyaluronate Crosspolymer, Hydrolyzed Sodium Hyaluronate, Epilobium Fleischeri (Alpine Willowherb) Flower/Leaf/Stem Extract, Niacinamide, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Xylitylglucoside, Isononyl Isononanoate, Caprylyl Glycol, Anhydroxylitol, Cetearyl Alcohol, Glyceryl Stearate, Arginine, Ethylhexylglycerin, Sodium Chloride, Xylitol, Stearic Acid, Tremella Fuciformis Polysaccharide, Sodium Lauroyl Glutamate, Genipa Americana Fruit Extract, Glucose, Lithospermum Erythrorhizon Root Extract, Potassium Phosphate, Butylene Glycol, Disodium Phosphate, Potassium Chloride, 1,2-Hexanediol, Citric Acid, Potassium Sorbate, Sodium Hydroxide, Phenoxyethanol, Fragrance/Parfum**. *Plum Extracts/Oils **Natural Fragrance","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide"],"description":"Plumping gel-cream with 5 types of hyaluronic acid, plum seed oil, polyglutamic acid, niacinamide, tremella mushroom and peptides. Bouncy, glass-skin texture. Contains natural plum fragrance — caution for fragrance-sensitive.","descriptionTH":"เจลครีมเติมเต็มผิวที่มีไฮยาลูโรนิกแอซิด 5 ชนิด น้ำมันเมล็ดพลัม กรดโพลีกลูตามิก ไนอาซินาไมด์ เห็ดเทรเมลลา และเปปไทด์ เนื้อสัมผัสเด้งดึ๋ง มีน้ำหอมพลัมธรรมชาติ","bestFor":"dry, oily, combination, dull skin. Caution: contains fragrance","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ. ระวัง: มีน้ำหอม","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance.","doNotCombineTH":"มีน้ำหอม","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0543/8301/files/NEW5_14_24_PDP_CLAIM_REFRESH_PLUM_CREAM-01.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0543/8301/files/NEW5_14_24_PDP_CLAIM_REFRESH_PLUM_CREAM-01.jpg"},{"id":89,"brand":"Glow Recipe","name":"Watermelon Glow Niacinamide Dew Drops","category":"toner","ingredients":"Aqua/Water/Eau, Propanediol, Glycereth-26, Glycerin, Niacinamide, 2,3-Butanediol, 1,2-Hexanediol, Cetyl Ethylhexanoate, Citrullus Lanatus Fruit Extract, Sodium Hyaluronate, Eclipta Prostrata Extract, Melia Azadirachta Leaf Extract, Polyglyceryl-3 Methylglucose Distearate, Tromethamine, Glyceryl Stearate, Carbomer, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Ethylhexylglycerin, Xanthan Gum, Polyquaternium-51, Moringa Oleifera Seed Oil, Fragrance/Parfum, Benzyl Benzoate.","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide"],"description":"Dewy illuminating serum-hybrid with niacinamide, hyaluronic acid, citrullus lanatus (watermelon fruit extract), moringa seed oil. Gives instant glass-skin glow. Contains fragrance and benzyl benzoate — caution for sensitive/fragrance-allergic skin.","descriptionTH":"เซรั่มไฮบริดที่ให้ผิวดูมีน้ำมีนวล มีไนอาซินาไมด์ ไฮยาลูโรนิกแอซิด สารสกัดแตงโม น้ำมันเมล็ดมะรุม มีน้ำหอมและเบนซิลเบนโซเอต","bestFor":"dry, oily, combination, dull skin. Caution: contains fragrance","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ. ระวัง: มีน้ำหอม","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance and benzyl benzoate.","doNotCombineTH":"มีน้ำหอมและเบนซิลเบนโซเอต","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0543/8301/files/10_21_2410_21_24_WM_DEWDROPS-_1.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0543/8301/files/10_21_2410_21_24_WM_DEWDROPS-_1.jpg"},{"id":90,"brand":"Haruharu Wonder","name":"Black Rice Hyaluronic Toner / / Free of Alcohol & Fragrance","category":"toner","ingredients":"Water, Betaine, Glycerin, Propanediol, Scutellaria Baicalensis Root Extract, Oryza Sativa (Rice) Extract(2,000ppm), Phyllostachys Pubescens Shoot Bark Extract(2,000ppm), Xanthan Gum, Cellulose Gum, 1,2-Hexanediol, Butylene Glycol, Pulsatilla Koreana Extract, Zanthoxylum Piperitum Fruit Extract, Usnea Barbata (Lichen) Extract, Aspergillus Ferment, Sodium Gluconate, Hyaluronic Acid(600ppm), Beta-Glucan, Tamarindus Indica Seed Gum, Panax Ginseng Root Extract, Glucose, Cyclodextrin","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid"],"description":"Fragrance-free, alcohol-free, silicone-free toner with fermented black rice extract (2,000ppm), bamboo extract, Pulsatilla koreana and aspergillus ferment. Rich in antioxidants. Slightly exfoliating from organic acids. Very popular for sensitive skin.","descriptionTH":"โทนเนอร์ปราศจากน้ำหอม แอลกอฮอล์ และซิลิโคน มีสารสกัดข้าวดำหมัก (2,000ppm) สารสกัดไผ่ Pulsatilla koreana และ aspergillus ferment อุดมด้วยสารต้านอนุมูลอิสระ เป็นที่นิยมมากสำหรับผิวแพ้ง่าย","bestFor":"sensitive, redness-prone, damaged barrier, dry, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","makeupPrep":true,"imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/BLACK_RICE_hyaluronic_toner_free_of_alcohol_fragrance_150ml_5e323adf-be3b-4390-97d4-f09aa862098d.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/BLACK_RICE_hyaluronic_toner_free_of_alcohol_fragrance_150ml_5e323adf-be3b-4390-97d4-f09aa862098d.jpg"},{"id":91,"brand":"Haruharu Wonder","name":"Botanical 2GF Wonderful Ampoule","category":"serum","ingredients":"Water,Pentylene Glycol,Propanediol,Glycerin,Oryza Sativa (Rice) Extract,Butylene Glycol,AmmoniumAcryloyldimethyltaurate/VP Copolymer,1,2-Hexanediol,Zanthoxylum Piperitum Fruit Extract,Pulsatilla KoreanaExtract,Usnea Barbata (Lichen) Extract,Aspergillus Ferment,Cyclodextrin,Panax Ginseng Root Extract,PhyllostachysPubescens Shoot Bark Extract,Sodium Hyaluronate,Xanthan Gum,Dipotassium Glycyrrhizate,Adenosine,DisodiumEDTA,Mannitol,Sodium Chloride,Rice sh-Oligopeptide-1,Chlorella Vulgaris Extract,Madecassoside,DisodiumPhosphate,Rice sh-Polypeptide-1,Cynanchum Atratum Extract,Sodium Phosphate,Potassium Phosphate,PotassiumChloride","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","peptides"],"description":"Growth-factor ampoule with rice sh-Oligopeptide-1 (EGF equivalent), rice sh-Polypeptide-1 (FGF equivalent), rice extract (2,000ppm), panax ginseng, madecassoside, adenosine and multiple botanical extracts. Supports cellular renewal and firmness for mature skin.","descriptionTH":"แอมพูลโกรทแฟกเตอร์ที่มี rice sh-Oligopeptide-1 (เทียบเท่า EGF) rice sh-Polypeptide-1 (เทียบเท่า FGF) สารสกัดข้าว (2,000ppm) โสม Panax แมเดคาสโซไซด์ อะดีโนซีน รองรับการต่ออายุเซลล์และความกระชับสำหรับผิวเจริญวัย","bestFor":"sensitive, redness-prone, dry, dull skin, mature skin, fine lines","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/black_rice_hyaluronic_botanical_2GF_wonderful_ampoule_30ml.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/black_rice_hyaluronic_botanical_2GF_wonderful_ampoule_30ml.jpg"},{"id":92,"brand":"Holika Holika","name":"Good Cera Super Ceramide Cream","category":"moisturizer","ingredients":"Water, Butylene Glycol, Glycerin, Cyclopentasiloxane, Butylene Glycol Dicaprylate/Dicaprate, Ethylhexyl Isononanoate, Hydrogenated Polyisobutene, Glyceryl Stearate, 1,2-Hexanediol, Cetearyl Alcohol, Stearic Acid, Polysorbate 60, Polyglyceryl-3 Methylglucose Distearate, Pentaerythrityl Tetraethylhexanoate, Stearyl Behenate, Dimethicone, Dimethicone/Vinyl Dimethicone Crosspolymer, Cetearyl Glucoside, Phytosteryl/Isostearyl/Cetyl/Stearyl/Behenyl Dimer Dilinoleate, Ceramide NP, Hydrogenated Polydecene, Butyrospermum Parkii (Shea) Butter, Ceteareth-20, Glyceryl Citrate/Lactate/Linoleate/Oleate, Hydroxypropyl Bispalmitamide MEA, Glycosphingolipids, Ceramide AP, Meadowfoam Estolide, Glycine Soja (Soybean) Sterols, Caprylic/Capric Triglyceride, Ceramide EOP, Glyceryl Polymethacrylate, Aleuritic Acid, Yeast Extract, Glycoproteins, Betaine, Sodium Hyaluronate, Polyquaternium-51, Cocos Nucifera Oil (Coconut Oil), Aloe Barbadensis Leaf Extract, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Squalane, Carbomer, Tromethamine, Tocopheryl Acetate, Glycerylamidoethyl Methacrylate/Stearyl Methacrylate Copolymer, Alteromonas Ferment Extract, Bacillus Ferment, Propylene Glycol, Theobroma Cacao (Cocoa) Seed Extract, Dipropylene Glycol, Lavandula Angustifolia (Lavender) Oil, Citrus Grandis (Grapefruit) Peel Oil, Cymbopogon Citratus Leaf Oil, Pelargonium Graveolens Oil, Citrus Aurantium Dulcis (Orange) Peel Oil, Pogostemon Cablin Oil, Santalum Album (Sandalwood) Oil, Chamomilla Recutita (Matricaria) Flower Oil, Niacinamide, Allantoin, Disodium EDTA, Ethylhexylglycerin","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide","ceramides"],"description":"Ceramide-complex cream with 3 ceramide types (NP, AP, EOP), glycosphingolipids, shea butter, bakuchiol, coconut oil and peptides. Contains essential oils (lavender, grapefruit, lemongrass, geranium, orange, patchouli, sandalwood, chamomile) — not fragrance-free.","descriptionTH":"ครีมสารประกอบเซราไมด์ที่มีเซราไมด์ 3 ชนิด เชียบัตเตอร์ บาคูชิออล น้ำมันมะพร้าว และเปปไทด์ มีน้ำมันหอมระเหย (ลาเวนเดอร์ เกรปฟรุต ตะไคร้ เจอเรเนียม ส้ม แพทชูลี จันทน์เทศ คาโมมายล์) ไม่ใช่ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, damaged barrier, dry, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains multiple essential oils — avoid if fragrance-sensitive.","doNotCombineTH":"มีน้ำมันหอมระเหยหลายชนิด — หลีกเลี่ยงหากแพ้น้ำหอม","medicubeMode":"Derma Shot","imageUrl":"https://www.holikaholika.co.uk/2177-facebook/good-cera-super-ceramide-cream.jpg","thumbnailUrl":"https://www.holikaholika.co.uk/2177-facebook/good-cera-super-ceramide-cream.jpg"},{"id":93,"brand":"Illiyoon","name":"Ceramide Ato Concentrate Cream","category":"moisturizer","ingredients":"Water, Glycerin, Butyrospermum Parkii (Shea) Butter, Hydrogenated Polydecene, Caprylic/Capric Triglyceride, Squalane, 1,2-Hexanediol, Panthenol, Ceramide NP, Stearic Acid, Cholesterol, Phytosphingosine, Hydrogenated Lecithin, Betaine, Allantoin, Dipotassium Glycyrrhizate, Caprylyl Glycol, Ethylhexylglycerin, Carbomer, Tromethamine, Disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["ceramides"],"description":"Thick, intensely nourishing ceramide cream with ceramide NP, cholesterol, phytosphingosine, hydrogenated lecithin, panthenol, allantoin and dipotassium glycyrrhizate. Perfect for severe dry skin, eczema flares and cracked skin. Fragrance-free.","descriptionTH":"ครีมเซราไมด์เข้มข้นที่บำรุงอย่างเข้มข้นมีเซราไมด์ NP คอเลสเตอรอล ฟิโตสฟิงโกซีน ไฮโดรจีเนตเลซิทิน แพนทีนอล อัลแลนทอยน์ เหมาะสำหรับผิวแห้งมาก ผิวแพ้กำเริบ และผิวแตก ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, damaged barrier, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"AM + PM daily. Can reapply as needed.","howOftenTH":"เช้า-เย็น ทุกวัน ทาซ้ำได้ตามความต้องการ","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0699/1727/8453/files/12312312_c0f6ec62-f822-4fa2-8ad8-bea6a403c5c4.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0699/1727/8453/files/12312312_c0f6ec62-f822-4fa2-8ad8-bea6a403c5c4.webp"},{"id":94,"brand":"Illiyoon","name":"Ceramide Ato Lotion","category":"moisturizer","ingredients":"Water, Glycerin, Propanediol, Hydrogenated Rice Bran Oil, Cyclopentasiloxane, Hydrogenated Poly(C6-14 Olefin), Cyclohexasiloxane, Dimethicone, Cetyl Ethylhexanoate, Diisostearyl Malate, 1,2-Hexanediol, Butylene Glycol, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, C14-22 Alcohols, Arachidyl Alcohol, Stearic Acid, Glyceryl Stearate, Palmitic Acid, Behenyl Alcohol, C12-20 Alkyl Glucoside, Glyceryl Caprylate, Arachidyl Glucoside, Panax Ginseng Root Water, Disodium EDTA, Ethylhexylglycerin, Sorbitan Isostearate, Polysorbate 60, Perilla Ocymoides Seed Extract, Bupleurum Falcatum Root Extract, Angelica Acutiloba Root Extract, Ophiopogon Japonicus Root Extract, Hydroxypropyl Bispalmitamide MEA(Ceramide PC-104 65.5ppm), Mannitol, Glucose, Glycine Max (Soybean) Oil, Myristic Acid, Acrylates/Ammonium Methacrylate Copolymer, Arachidic Acid, Ceramide NP (4ppm), Cholesterol, Silica, Phytosphingosine, Hydrogenated Lecithin, Tocopherol, Canola Oil, Rosmarinus Officinalis (Rosemary) Leaf Extract","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["ceramides"],"description":"Lightweight ceramide lotion suitable for face and body with ceramide NP, Hydroxypropyl Bispalmitamide MEA, panax ginseng root water and rice bran oil. More liquid texture than the cream. Good for layering or warmer climates.","descriptionTH":"โลชั่นเซราไมด์น้ำหนักเบา เหมาะสำหรับหน้าและร่างกาย มีเซราไมด์ NP Hydroxypropyl Bispalmitamide MEA น้ำรากโสม Panax และน้ำมันรำข้าว เนื้อสัมผัสเหลวกว่าครีม","bestFor":"damaged barrier, dry","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0699/1727/8453/files/Illiyoon_Ceramide_Ato_Lotion_350ml.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0699/1727/8453/files/Illiyoon_Ceramide_Ato_Lotion_350ml.webp"},{"id":95,"brand":"Ingu","name":"Acne Clearing Toner","category":"toner","ingredients":"Deionized Water, Garcinia Mangostana Peel Extract, Glyceryl Glucoside, Chondrus Crispus Extract (and) Sodium Hyaluronate, Butylene Glycol, Phenoxyethanol, Centella Asiatica Extract, Triethanolamine, Polyglyceryl-6 Laurate, Lauryl Gluco- side, Myristyl Glucoside, PEG-60 Almond Glycerides, Glycolic acid, Caprylyl Glycol, Glycerin, Lactic acid, Chlorphenesin, Sodium magnesium silicate, Citric acid, Disodium EDTA, Xanthan gum, Carbomer, Nordihydroguaiaretic Acid, Oleanolic Acid","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","aha"],"description":"Thai 4D-Acne Clearing toner with alpha-mangosteen from mangosteen peel extract, glycolic acid, lactic acid, and centella asiatica. Targets acne-causing bacteria (C. acnes) and clogged pores. Fragrance-free. Start slowly — contains multiple exfoliating acids.","descriptionTH":"โทนเนอร์ 4D-Acne Clearing ของไทย มีอัลฟา-แมงกอสทีนจากสารสกัดเปลือกมังคุด กรดไกลโคลิก กรดแลกติก และเซนเทลลา มุ่งเป้าที่แบคทีเรีย C. acnes และรูขุมขนอุดตัน ปราศจากน้ำหอม","bestFor":"dry, oily","bestForTH":"ผิวแห้ง, ผิวมัน","howOften":"PM daily or every other day. Build up slowly.","howOftenTH":"ตอนเย็น ทุกวันหรือวันเว้นวัน ค่อยๆ เพิ่มทีละน้อย","doNotCombine":"Avoid same session with retinol, other AHA/BHA, vitamin C.","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับเรตินอล AHA/BHA อื่น วิตามินซี","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0627/3646/6057/files/Untitleddesign_6.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0627/3646/6057/files/Untitleddesign_6.png"},{"id":96,"brand":"Ingu","name":"Anti Acne Gel","category":"treatment","subcategory":"spot treatment","ingredients":"Deionized water, Propanediol, Glycerin, Niacinamide, Garcinia Mangostana Peel Extract, Hydrolyzed Jojoba Esters, Panthenol, PEG-8, Butylene Glycol, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Silica, Polyacrylate Crosspolymer-6, Salicylic Acid, Triethanolamine, Maltodextrin, Syringa Vulgaris (Lilac) Extract, Mirabilis Jalapa Extract, Olive Oil PEG-7 Esters, Phenoxyethanol, Disodium EDTA, Chlorphenesin.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","bha"],"description":"Fragrance-free targeted acne spot gel with encapsulated salicylic acid (BHA), 5% niacinamide, panthenol and alpha-mangosteen from mangosteen peel extract. Calms active breakouts and reduces inflammation at the blemish site without over-drying surrounding skin.","descriptionTH":"เจลสิวแบบ spot treatment ปราศจากน้ำหอม มีกรดซาลิไซลิกแบบ encapsulated (BHA) ไนอาซินาไมด์ 5% แพนทีนอล และอัลฟา-แมงกอสทีนจากสารสกัดเปลือกมังคุด บรรเทาสิวที่กำลังเกิด","bestFor":"oily, acne-prone, dull skin","bestForTH":"ผิวมัน, ผิวเป็นสิว, ผิวหมองคล้ำ","howOften":"PM spot application daily as needed","howOftenTH":"ตอนเย็น ทาเฉพาะจุดตามความต้องการทุกวัน","doNotCombine":"Avoid applying over retinol or benzoyl peroxide in same area.","doNotCombineTH":"หลีกเลี่ยงการทาทับเรตินอลหรือเบนโซอิลเพอร์ออกไซด์ในบริเวณเดียวกัน","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0627/3646/6057/files/Untitled_design_5.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0627/3646/6057/files/Untitled_design_5.png"},{"id":97,"brand":"Ingu","name":"Green Tea Retinol Serum Shot","category":"serum","ingredients":"Deionized water, Glycerin, Camellia Sinensis Leaf Extract, Hydrolyzed Jojoba Esters, Butylene Glycol, Polyacrylate Crosspolymer-6, Xylitylglucoside, Glycine Soja (Soybean) Oil, Caprylyl/Capryl Glucoside, Anhydroxylitol, Propanediol, Phenoxyethanol, Xylitol, Allantoin, Carrageenan, Chlorphenesin, Trisodium Ethylenediamine Disuccinate, Retinol, Cetyl Palmitate, Lauryl Glucoside, Sorbitan Stearate, Hydrogenated Lecithin, Hydroxypropyl Cyclodextrin, Mirabilis Jalapa Extract, Caprylyl Glycol, Palmitoyl Tripeptide-38","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["retinol","peptides"],"description":"Encapsulated 3% retinol serum with Camellia sinensis (green tea) extract as base, Palmitoyl Tripeptide-38 (Matrixyl Synthe'6 at 2%) and Pacifeel technology. Anti-aging formula with antioxidant support. Start very slowly — 3% retinol is intermediate-high strength.","descriptionTH":"เซรั่มเรตินอล 3% แบบห่อหุ้ม มีสารสกัดชาเขียวเป็นฐาน Palmitoyl Tripeptide-38 และเทคโนโลยี Pacifeel สูตรต้านริ้วรอยที่รองรับด้วยสารต้านอนุมูลอิสระ เริ่มใช้ทีละน้อยมาก","bestFor":"mature skin, fine lines. Caution: avoid during pregnancy","bestForTH":"ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: ห้ามใช้ระหว่างตั้งครรภ์","howOften":"PM, start 1x/week, build very slowly. Always SPF next AM.","howOftenTH":"ตอนเย็น เริ่ม 1 ครั้ง/สัปดาห์ ค่อยๆ เพิ่มอย่างช้าๆ ต้องทาครีมกันแดดทุกเช้า","doNotCombine":"NEVER with AHA/BHA, vitamin C, benzoyl peroxide same session. Avoid in pregnancy.","doNotCombineTH":"ห้ามใช้กับ AHA/BHA วิตามินซี เบนโซอิลเพอร์ออกไซด์ในครั้งเดียวกัน หลีกเลี่ยงระหว่างตั้งครรภ์","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0627/3646/6057/files/Screenshot_2568-04-18_at_14.26.15.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0627/3646/6057/files/Screenshot_2568-04-18_at_14.26.15.png"},{"id":98,"brand":"Innisfree","name":"Daily UV Defense Sunscreen","category":"sunscreen","ingredients":"Active Ingredients: Avobenzone (2.5%), Homosalate (7.0%), Octisalate (4.3%)\nInactive Ingredients: \nWater / Aqua / Eau, Butyloctyl Salicylate, Dipropylene Glycol, Ethylhexyl Methoxycrylene, Glycerin, Silica, 1,2-Hexanediol, Arachidyl Alcohol, Behenyl Alcohol, Cetyl Alcohol, Pentylene Glycol, Arachidyl Glucoside, Ammonium Polyacryloyldimethyl Taurate, Glyceryl Stearate, PEG-100 Stearate, Fragrance / Parfum, Ethylhexylglycerin, Limonene, T-Butyl Alcohol, Linalool, Tocopherol, Simmondsia Chinensis (Jojoba) Seed Oil, Helianthus Annuus (Sunflower) Seed Oil, Hamamelis Virginiana (Witch Hazel) Flower Water, Butylene Glycol, Camellia Sinensis Leaf Extract, Centella Asiatica Extract, Caprylyl Glycol","fragranceFree":false,"alcoholFree":true,"eoFree":false,"activeIngredients":["centella"],"description":"Lightweight chemical sunscreen with green tea antioxidants, jojoba and sunflower oil. SPF36/PA+ (US version). Contains fragrance/parfum — not recommended for sensitive skin.","descriptionTH":"ครีมกันแดดเคมีน้ำหนักเบาที่มีสารต้านอนุมูลอิสระชาเขียว โจโจ้บา และน้ำมันดอกทานตะวัน SPF36/PA+ (เวอร์ชั่น US) มีน้ำหอม ไม่แนะนำสำหรับผิวแพ้ง่าย","bestFor":"All skin types. Caution: contains fragrance, contains essential oils","bestForTH":"ผิวทุกประเภท. ระวัง: มีน้ำหอม, มีน้ำมันหอมระเหย","howOften":"AM daily, reapply every 2h outdoors","howOftenTH":"ทุกเช้า ทาซ้ำทุก 2 ชั่วโมงกลางแจ้ง","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0089/3367/1012/files/01_FullSize_IF_SUN-DUV50-50ml_Packshot_2025_02.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0089/3367/1012/files/01_FullSize_IF_SUN-DUV50-50ml_Packshot_2025_02.jpg"},{"id":99,"brand":"Innisfree","name":"Green Tea Seed Hyaluronic Serum","category":"serum","ingredients":"Water / Aqua / Eau, Propanediol, Glycerin, 1,2-Hexanediol, Niacinamide, Betaine, Saccharide Isomerate, Camellia Sinensis Seed Oil, Xylitol, Cetearyl Olivate, Hydrogenated Lecithin, Butylene Glycol, Sorbitan Olivate, Lactobacillus Ferment Lysate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Squalane, Panthenol, Allantoin, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Tromethamine, Ethylhexylglycerin, Ceratonia Siliqua (Carob) Gum, Sodium Metaphosphate, Camellia Sinensis Leaf Extract, Dipotassium Glycyrrhizate, Sodium Hyaluronate, Hyaluronic Acid, Dextrin, Theobroma Cacao (Cocoa) Extract, 3-O-Ethyl Ascorbic Acid, Sorbitan Isostearate, Sodium Citrate, Citric Acid, Glyceryl Oleate, Tocopherol, Lecithin, Sucrose, Lauryl Glucoside, Polyglyceryl-6 Laurate, Myristyl Glucoside, Xanthan Gum, Lactic Acid, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate Crosspolymer, Sodium Acetylated Hyaluronate","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid","niacinamide"],"description":"Beloved serum with Jeju green tea seed oil, multiple forms of HA (including acetylated, crosspolymer, sodium forms), niacinamide, 3-O-Ethyl Ascorbic Acid (vitamin C derivative) and ceramide NP. Provides long-lasting barrier hydration and subtle brightening.","descriptionTH":"เซรั่มที่เป็นที่รักมีน้ำมันเมล็ดชาเขียวจากเกาะเจจู HA หลายรูปแบบ ไนอาซินาไมด์ 3-O-เอทิลแอสคอร์บิกแอซิด (อนุพันธ์วิตามินซี) และเซราไมด์ NP ให้ความชุ่มชื้นเกราะผิวที่ยาวนาน","bestFor":"dry, oily, combination, dull skin, hyperpigmentation, mature skin","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0089/3367/1012/files/IF_BottleRePlay_Packshot.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0089/3367/1012/files/IF_BottleRePlay_Packshot.jpg"},{"id":100,"brand":"Innisfree","name":"Jeju’s Cherry Blossom Glow Jelly Cream","category":"moisturizer","ingredients":"Water / Aqua / Eau, Glycerin, Propanediol, Dipropylene Glycol, Niacinamide, Betaine, 1,2-Hexanediol, Carbomer, Tromethamine, Sodium Metaphosphate, Ammonium Acryloyldimethyltaurate/Beheneth-25 Methacrylate Crosspolymer, Ethylhexylglycerin, Fragrance / Parfum, Prunus Yedoensis Leaf Extract, Tocopherol\nFor informational purposes only. While we endeavor to keep this ingredient list accurate, please be advised that our ingredient list may change. We recommend you refer to the ingredient list on the individual product package for the most up to date ingredient list.","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide"],"description":"Light, jelly-texture moisturizer with Jeju cherry blossom (Prunus yedoensis) leaf extract and niacinamide. Gives a glowing, moisturized finish. Contains fragrance/parfum — not for sensitive or fragrance-allergic skin.","descriptionTH":"มอยส์เจอไรเซอร์เนื้อเจลเบาที่มีสารสกัดใบดอกซากุระจากเกาะเจจู และไนอาซินาไมด์ ให้ผิวกระจ่างใสและชุ่มชื้น มีน้ำหอม/parfum ไม่เหมาะสำหรับผิวแพ้น้ำหอม","bestFor":"dull skin. Caution: contains fragrance","bestForTH":"ผิวหมองคล้ำ. ระวัง: มีน้ำหอม","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance.","doNotCombineTH":"มีน้ำหอม","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0089/3367/1012/files/01_IF_CB-JC_Packshot_2024_01_1080x1080_c8ec9552-baa1-4450-8500-021b480c6e92_1.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0089/3367/1012/files/01_IF_CB-JC_Packshot_2024_01_1080x1080_c8ec9552-baa1-4450-8500-021b480c6e92_1.jpg"},{"id":101,"brand":"Innisfree","name":"Retinol Cica Moisture Recovery Serum","category":"serum","ingredients":"Water / Aqua / Eau, Glycerin, Propanediol, Niacinamide, Dibutyl Adipate, Butylene Glycol, Caprylic/Capric Triglyceride, 1,2-Hexanediol, Hydrogenated Lecithin, Ammonium Acryloyldimethyltaurate/VP Copolymer, Helianthus Annuus (Sunflower) Seed Oil, Cholesterol, Allantoin, Glycine Soja (Soybean) Oil, Tocopherol, Tocopheryl Acetate, Sodium Methyl Stearoyl Taurate, Daucus Carota Sativa (Carrot) Root Extract, Pentylene Glycol, Ethylhexylglycerin, Adenosine, Asiaticoside, Madecassic Acid, Camellia Sinensis Seed Extract, Asiatic Acid, Retinol, Stearyl Glycyrrhetinate, Hyaluronic Acid, Mannitol, Ceramide NP, Carbomer, Beta-Glucan, Beta-Carotene, Phytosphingosine, Salicylic Acid, Acacia Senegal Gum, Acetyl Tetrapeptide-11, Propylene Glycol Alginate","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["peptides","hyaluronic acid","retinol","centella","ceramides","niacinamide","bha"],"description":"Encapsulated retinol + cica (asiaticoside, madecassic acid, asiatic acid) serum designed to smooth fine lines while minimising irritation from retinol through centella's calming effect. Ceramide NP and HA included. Beginner-friendly.","descriptionTH":"เซรั่มเรตินอลแบบห่อหุ้ม + cica (เซนเทลลา) สูตรที่ออกแบบมาเพื่อเรียบริ้วรอยพร้อมลดการระคายเคืองจากเรตินอล มีเซราไมด์ NP และ HA รวมอยู่ เหมาะสำหรับผู้เริ่มต้น","bestFor":"damaged barrier, dry, oily, combination, acne-prone, dull skin, mature skin, fine lines. Caution: avoid during pregnancy","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวเป็นสิว, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: ห้ามใช้ระหว่างตั้งครรภ์","howOften":"PM, start 2-3x/week, build gradually","howOftenTH":"ตอนเย็น เริ่ม 2-3 ครั้ง/สัปดาห์ ค่อยๆ เพิ่ม","doNotCombine":"Do not use with AHA/BHA, vitamin C, benzoyl peroxide same session. Avoid in pregnancy.","doNotCombineTH":"ห้ามใช้กับ AHA/BHA วิตามินซี เบนโซอิลเพอร์ออกไซด์ในครั้งเดียวกัน หลีกเลี่ยงระหว่างตั้งครรภ์","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0089/3367/1012/files/01_IF_RC-S_Packshot_2024_01_1080x1080_97dfceff-1091-4bc8-9aa7-691f6c878225_1.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0089/3367/1012/files/01_IF_RC-S_Packshot_2024_01_1080x1080_97dfceff-1091-4bc8-9aa7-691f6c878225_1.jpg"},{"id":102,"brand":"Innisfree","name":"Super Volcanic Pore Clay Mask original","category":"treatment","ingredients":"Water / Aqua / Eau, Butylene Glycol, Titanium Dioxide (Ci 77891), Silica, Glycerin, Trehalose, Volcanic Ash, Caprylic/Capric Triglyceride, Polyvinyl Alcohol, Bentonite, Kaolin, Glyceryl Stearate, Cetearyl Alcohol, Pvp, 1,2-Hexanediol, Peg-100 Stearate, Polysorbate 60, Palmitic Acid, Stearic Acid, Iron Oxides (Ci 77499), Hydrogenated Vegetable Oil, Xanthan Gum, Juglans Regia (Walnut) Shell Powder, Sorbitan Stearate, Zea Mays (Corn) Starch, Polyacrylate-13, Polysorbate 20, Iron Oxides (Ci 77492), Mannitol, Microcrystalline Cellulose, Sodium Metaphosphate, Lactic Acid, Lactic Acid/Glycolic Acid Copolymer, Polyisobutene, Iron Oxides (Ci 77491), Menthoxypropanediol, Tetrasodium Pyrophosphate, Ethylhexylglycerin, Sorbitan Isostearate, Polyquaternium-10, Lecithin, Tocopherol","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["aha"],"description":"Volcanic ash clay mask with kaolin, bentonite and lactic/glycolic acid copolymer (mild AHA). Absorbs excess oil, detoxifies pores and smooths skin surface. Not for very sensitive or active-inflamed skin.","descriptionTH":"มาส์กดินเหนียวเถ้าภูเขาไฟมีคาโอลิน เบนโทไนต์ และกรดแลกติก/ไกลโคลิกโคโพลิเมอร์ ดูดซับน้ำมันส่วนเกิน ดีท็อกซ์รูขุมขน ไม่เหมาะสำหรับผิวแพ้ง่ายมากหรือผิวอักเสบ","bestFor":"oily","bestForTH":"ผิวมัน","howOften":"1-2x per week (PM)","howOftenTH":"1-2 ครั้ง/สัปดาห์ (ตอนเย็น)","doNotCombine":"Do not use same session as retinol, strong AHA/BHA.","doNotCombineTH":"อย่าใช้ในครั้งเดียวกับเรตินอล AHA/BHA เข้มข้น","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0089/3367/1012/files/1-IF_V-CM_Packshot_2026_1080x1080_fd7e52ce-608a-49b9-a09b-62066dc4abd8.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0089/3367/1012/files/1-IF_V-CM_Packshot_2026_1080x1080_fd7e52ce-608a-49b9-a09b-62066dc4abd8.jpg"},{"id":103,"imageUrl":"https://laglace.shop/uploads/products/69b8defe336a2_Artboard%2035.png","brand":"La Glace","name":"Acne Care Daily Calming Pads","category":"toner","ingredients":"Aqua Glycerin Hydroxyethyl Urea Butylene Glycol Niacinamide Betaine Salicylic Acid Hamamelis Virginiana Extract Honey Peg 7 Glyceryl Cocoate Peg 6 Caprylic Capric Glycerides Lactobacillus Ferment Sodium Citrate Aloe Barbadensis Leaf Extract Centella Asiatica Extract Panthenol Sodium Hyaluronate Hyaluronic Acid Hydrolyzed Sodium Hyaluronate Hydrolyzed Hyaluronic Acid Potassium Hyaluronate Sodium Acetylated Hyaluronate Sodium Hyaluronate Crosspolymer Hydroxypropyltrimonium Hyaluronate Zinc Hydrolyzed Hyaluronate Ascorbylpropyl Hydrolyzed Hyaluronate Ascorbyl Propyl Hyaluronate Dimethylsilanol Hyaluronate Phenoxyethanol Tocopheryl Acetate Tea Tree Oil Potassium Sorbate Ethylhexylglycerin Sodium Benzoate Disodium Edta","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid","centella","niacinamide","bha"],"description":"Thai-brand alcohol-, silicone- and fragrance-free toner pads with salicylic acid (BHA), niacinamide, witch hazel, Lactobacillus ferment, centella asiatica extract and tea tree oil. Dual-textured pads. Targets active breakouts, controls oil and calms post-acne inflammation.","descriptionTH":"แผ่นโทนเนอร์แบรนด์ไทย ปราศจากแอลกอฮอล์ ซิลิโคน และน้ำหอม มีกรดซาลิไซลิก (BHA) ไนอาซินาไมด์ วิตช์ ฮาเซล Lactobacillus ferment สารสกัดเซนเทลลา และน้ำมันชาเขียว แผ่นสองด้าน","bestFor":"dry, oily, combination, acne-prone, dull skin, mature skin","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวเป็นสิว, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Avoid same session with retinol, AHA, strong vitamin C.","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับเรตินอล AHA วิตามินซีเข้มข้น","medicubeMode":"None","thumbnailUrl":"https://laglace.shop/uploads/products/69b8defe336a2_Artboard%2035.png"},{"id":104,"imageUrl":"https://laglace.shop/uploads/products/69b84515249c8_Artboard%201.png","brand":"La Glace","name":"Daily Moisturizing Pads Aqualock12","category":"toner","ingredients":"Aqua Glycerin Butylene Glycol Portulaca Oleracea Extract Niacinamide Glyceryl Glucoside Betaine Peg 7 Glyceryl Cocoate Peg 6 Caprylic Capric Glycerides Sodium Citrate Allantoin Panthenol Sodium Hyaluronate Hyaluronic Acid Hydrolyzed Sodium Hyaluronate Hydrolyzed Hyaluronic Acid Potassium Hyaluronate Sodium Acetylated Hyaluronate Sodium Hyaluronate Crosspolymer Hydroxypropyltrimonium Hyaluronate Zinc Hydrolyzed Hyaluronate Ascorbylpropyl Hydrolyzed Hyaluronate Ascorbyl Propyl Hyaluronate Dimethylsilanol Hyaluronate Pentylene Glycol Beta Glucan Caprylyl Glycol Phenoxyethanol Ethylhexylglycerin Disodium Edta","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid","niacinamide"],"description":"Thai-brand fragrance-free hydrating toner pads with 12 hyaluronic acid types, niacinamide, glyceryl glucoside, beta-glucan and panthenol. Non-comedogenic. Gentle enough for twice-daily use on sensitive skin.","descriptionTH":"แผ่นโทนเนอร์ให้ความชุ่มชื้นแบรนด์ไทยปราศจากน้ำหอม มีไฮยาลูโรนิกแอซิด 12 ชนิด ไนอาซินาไมด์ ไกลเซอริลกลูโคไซด์ เบตา-กลูแคน และแพนทีนอล ไม่อุดรูขุมขน","bestFor":"sensitive, redness-prone, damaged barrier, dry, oily, combination, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","makeupPrep":true,"thumbnailUrl":"https://laglace.shop/uploads/products/69b84515249c8_Artboard%201.png"},{"id":105,"imageUrl":"https://www.cremedelamer.com/media/export/cms/products/340x340/LM_SKU_332002_26766_340x340_0.png","brand":"La Mer","name":"Crème de la Mer","category":"moisturizer","ingredients":"Algae Extract, Mineral Oil\\Paraffinum Liquidum\\Huile Minerale, Petrolatum, Glycerin, Isohexadecane, Microcrystalline Wax\\Cera Microcristallina\\Cire Microcristalline, Lanolin Alcohol, Citrus Aurantifolia (Lime) Peel Extract, Sesamum Indicum (Sesame) Seed Oil, Eucalyptus Globulus (Eucalyptus) Leaf Oil, Sesamum Indicum (Sesame) Seed Powder, Medicago Sativa (Alfalfa) Seed Powder, Helianthus Annuus (Sunflower) Seedcake, Prunus Amygdalus Dulcis (Sweet Almond) Seed Meal, Sodium Gluconate, Copper Gluconate, Calcium Gluconate, Magnesium Gluconate, Zinc Gluconate, Magnesium Sulfate, Paraffin, Tocopheryl Succinate, Niacin, Water\\Aqua\\Eau, Beta-Carotene, Decyl Oleate, Aluminum Distearate, Octyldodecanol, Citric Acid, Cyanocobalamin, Magnesium Stearate, Panthenol, Zea Mays (Corn) Oil, Limonene, Geraniol, Linalool, Hydroxycitronellal, Citronellol, Benzyl Salicylate, Benzyl Benzoate, Sodium Benzoate, Alcohol Denat., Fragrance (Parfum)","fragranceFree":false,"alcoholFree":false,"eoFree":false,"activeIngredients":[],"description":"Iconic luxury moisturizer with fermented Miracle Broth algae (sea kelp), mineral oil, lanolin alcohol, lime peel extract and vitamins. Deeply nourishing for dry, mature skin. Contains fragrance (parfum) with linalool, geraniol, citronellol and limonene.","descriptionTH":"มอยส์เจอไรเซอร์หรูที่เป็นสัญลักษณ์มี Miracle Broth จากสาหร่ายทะเลหมัก น้ำมันแร่ ลาโนลินแอลกอฮอล์ สารสกัดเปลือกมะนาว และวิตามิน บำรุงอย่างลึกล้ำ มีน้ำหอม (parfum)","bestFor":"dry, mature skin. Caution: contains fragrance, contains essential oils, contains alcohol","bestForTH":"ผิวแห้ง, ผิวมีริ้วรอย. ระวัง: มีน้ำหอม, มีน้ำมันหอมระเหย, มีแอลกอฮอล์","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance.","doNotCombineTH":"มีน้ำหอม","medicubeMode":"Derma Shot","thumbnailUrl":"https://www.cremedelamer.com/media/export/cms/products/340x340/LM_SKU_332002_26766_340x340_0.png"},{"id":106,"imageUrl":"https://static.thcdn.com/productimg/original/16432937-2065335529910075.jpg","brand":"La Roche-Posay","name":"Anthelios UVMune 400 Invisible Fluid Spf50+ Sun Cream For Sensitive Skin","category":"sunscreen","ingredients":"AQUA / WATER ● ALCOHOL DENAT. ● TRIETHYL CITRATE ● DIISOPROPYL SEBACATE ● SILICA ● ETHYLHEXYL SALICYLATE ● BIS ETHYLHEXYLOXYPHENOL METHOXYPHENYL TRIAZINE ● ETHYLHEXYL TRIAZONE ● BUTYL METHOXYDIBENZOYLMETHANE ● GLYCERIN ● PROPANEDIOL ● C12 22 ALKYL ACRYLATE/HYDROXYETHYLACRYLATE COPOLYMER ● SODIUM CITRATE ● METHOXYPROPYLAMINO CYCLOHEXENYLIDENE ETHOXYETHYLCYANOACETATE ● PERLITE ● TOCOPHEROL ● CAPRYLIC/CAPRIC TRIGLYCERIDE ● ACRYLATES/C10 30 ALKYL ACRYLATE CROSSPOLYMER ● CAPRYLYL GLYCOL ● CITRIC ACID ● DIETHYLAMINO HYDROXYBENZOYL HEXYL BENZOATE ● DROMETRIZOLE TRISILOXANE ● HYDROXYETHYLCELLULOSE ● TEREPHTHALYLIDENE DICAMPHOR SULFONIC ACID ● TRIETHANOLAMINE ● TRISODIUM ETHYLENEDIAMINE DISUCCINATE,","fragranceFree":true,"alcoholFree":false,"eoFree":true,"activeIngredients":[],"description":"Advanced chemical sunscreen featuring Mexoryl 400 that extends UV-A protection to 380-400nm (ultra-long UV-A waves linked to aging and deeper skin damage), plus Mexoryl SX/XL and Tinosorb M. Non-greasy invisible fluid. Available in EU/Asia.","descriptionTH":"ครีมกันแดดเคมีขั้นสูงที่มี Mexoryl 400 ที่ขยายการป้องกัน UV-A ไปถึง 380-400nm พร้อม Mexoryl SX/XL และ Tinosorb M ของเหลวล่องหนไม่มัน ใช้ได้ใน EU/เอเชีย","bestFor":"All skin types. Caution: contains alcohol","bestForTH":"ผิวทุกประเภท. ระวัง: มีแอลกอฮอล์","howOften":"AM daily, reapply every 2h outdoors","howOftenTH":"ทุกเช้า ทาซ้ำทุก 2 ชั่วโมงกลางแจ้ง","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","thumbnailUrl":"https://static.thcdn.com/productimg/original/16432937-2065335529910075.jpg"},{"id":107,"imageUrl":"https://static.thcdn.com/productimg/original/13938508-3695335528324410.jpg","brand":"La Roche-Posay","name":"Cicaplast Baume B5 Repairing Balm","category":"moisturizer","ingredients":"AQUA / WATER / EAU ● HYDROGENATED POLYISOBUTENE ● DIMETHICONE ● GLYCERIN ● BUTYROSPERMUM PARKII BUTTER / SHEA BUTTER ● PANTHENOL ● ZEA MAYS STARCH / CORN STARTCH ● PROPANEDIOL ● BUTYLENE GLYCOL ● CETYL PEG/PPG-10/1 DIMETHICONE ● TRIHYDROXYSTEARIN ● CENTELLA ASIATICA LEAF EXTRACT ● POLYMNIA SONCHIFOLIA ROOT JUICE ● ZINC GLUCONATE ● MADECASSOSIDE ● MANGANESE GLUCONATE ● ALPHA-GLUCAN OLIGOSACCHARIDE ● SILICA ● ALUMINIUM HYDROXIDE ● MAGNESIUM SULFATE ● MANNOSE ● CAPRYLOYL GLYCINE ● CAPRYLYL GLYCOL ● VITREOSCILLA FERMENT ● CITRIC ACID ● TRISODIUM ETHYLENEDIAMINE DISUCCINATE ● LACTOBACILLUS ● ACETYLATED GLYCOL STEARATE ● MALTODEXTRIN ● POLYGLYCERYL-4 ISOSTEARATE ● TOCOPHEROL ● PENTAERYTHRITYL TETRA-DI-T-BUTYL HYDROXYHYDROCINNAMATE ● CI77891 / TITANIUM DIOXIDE. (CODE F.I.L.: N70011474/1)","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["centella"],"description":"Multipurpose soothing and repairing balm with 5% panthenol (vitamin B5), madecassoside, zinc gluconate (anti-irritant), shea butter and Vitreoscilla ferment (microbiome support). Widely used on irritated, damaged, post-procedure or cracked skin. Fragrance-free.","descriptionTH":"บาล์มบรรเทาและซ่อมแซมอเนกประสงค์ที่มีแพนทีนอล 5% (วิตามิน B5) แมเดคาสโซไซด์ สังกะสีกลูโคเนต เชียบัตเตอร์ และ Vitreoscilla ferment ใช้กันอย่างแพร่หลายบนผิวที่ระคายเคือง ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, damaged barrier, dry, oily, acne-prone","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวเป็นสิว","howOften":"AM + PM as needed on affected areas","howOftenTH":"เช้า-เย็น ตามความต้องการบริเวณที่ต้องการ","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","thumbnailUrl":"https://static.thcdn.com/productimg/original/13938508-3695335528324410.jpg"},{"id":108,"imageUrl":"https://static.thcdn.com/productimg/original/11091822-6325335528240509.jpg","brand":"La Roche-Posay","name":"EFFACLAR PURIFYING CLEANSING GEL","category":"cleanser","ingredients":"Aqua / Water, Sodium Laureth Sulfate, PEG-8, CocoAQUA / WATER / EAU • SODIUM LAURETH SULFATE • PEG-8 • COCO-BETAINE • HEXYLENE GLYCOL • SODIUM CHLORIDE • PUNICA GRANATUM PERICARP EXTRACT • ZINC PCA • PEG-120 METHYL GLUCOSE DIOLEATE • SODIUM CITRATE • SODIUM HYDROXIDE • CAPRYLYL GLYCOL • CITRIC ACID • TRISODIUM ETHYLENEDIAMINE DISUCCINATE • MALTODEXTRIN • PENTYLENE GLYCOL • TOCOPHEROL • SODIUM BENZOATE • PHENOXYETHANOL • PARFUM / FRAGRANCE (F.I.L. N70028514/2).-Betaine, Hexylene Glycol, Sodium Chloride, PEG-120 Methyl Glucose Dioleate, Zinc PCA, Sodium Hydroxide, Citric Acid, Sodium Benzoate, Phenoxyethanol, Caprylyl Glycol, Parfum / Fragrance","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Foaming cleansing gel with sodium laureth sulfate (stronger surfactant), zinc PCA and pomegranate extract. Effectively removes excess sebum and makeup. Contains fragrance — caution for sensitive skin. Best for oily acne-prone skin only.","descriptionTH":"เจลล้างหน้าโฟมมีโซเดียมลอเรทซัลเฟต สังกะสี PCA และสารสกัดทับทิม ขจัดไขมันส่วนเกินได้อย่างมีประสิทธิภาพ มีน้ำหอม เหมาะที่สุดสำหรับผิวมันที่เป็นสิวเท่านั้น","bestFor":"acne-prone. Caution: contains fragrance","bestForTH":"ผิวเป็นสิว. ระวัง: มีน้ำหอม","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off. Contains fragrance.","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก มีน้ำหอม","medicubeMode":"None","thumbnailUrl":"https://static.thcdn.com/productimg/original/11091822-6325335528240509.jpg"},{"id":109,"imageUrl":"https://static.thcdn.com/productimg/original/11091821-1415335527893589.jpg","brand":"La Roche-Posay","name":"Effaclar Duo+M: Anti-Blemish Corrective Gel Moisturiser","category":"moisturizer","ingredients":"AQUA / WATER / EAU • GLYCERIN • DIMETHICONE • ISOCETYL STEARATE • NIACINAMIDE • ISOPROPYL LAUROYLSARCOSINATE • SILICA • AMMONIUM POLYACRYLOYLDIMETHYL TAURATE • ORYZA SATIVA STARCH / RICE STARCH • PUNICA GRANATUM PERICARP EXTRACT • POTASSIUM CETYL PHOSPHATE • SORBITAN OLEATE • ZINC PCA • GLYCERYL STEARATE SE • ISOHEXADECANE • SODIUM HYDROXIDE • MYRISTYL MYRISTATE • 2-OLEAMIDO-1,3-OCTADECANEDIOL • MANNOSE • POLOXAMER 338 • PROPANEDIOL • HYDROXYETHOXYPHENYL BUTANONE • CAPRYLOYL SALICYLIC ACID • CAPRYLYLGLYCOL • VITREOSCILLA FERMENT • CITRIC ACID • TRISODIUM ETHYLENEDIAMINEDISUCCINATE • MALTODEXTRIN • XANTHANGUM • PENTYLENE GLYCOL • POLYSORBATE 80 • ACRYLAMIDE/SODIUM ACRYLOYLDIMETHYLTAURATE COPOLYMER • SALICYLIC ACID • PIROCTONE OLAMINE • PARFUM/FRAGRANCE.","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","bha"],"description":"Multi-action anti-acne gel moisturizer with 5.5% niacinamide, 0.4% capryloyl salicylic acid (lipo-hydroxy acid), zinc PCA, procerad ceramide and piroctone olamine (anti-fungal/anti-bacterial). Targets existing blemishes and prevents new ones. Contains fragrance.","descriptionTH":"เจลมอยส์เจอไรเซอร์ต้านสิวหลายฤทธิ์มีไนอาซินาไมด์ 5.5% กรดคาปรีลอยล์ซาลิไซลิก 0.4% สังกะสี PCA เซราไมด์ procerad และไพโรคโทนอลามีน มีน้ำหอม","bestFor":"oily, acne-prone, dull skin. Caution: contains fragrance","bestForTH":"ผิวมัน, ผิวเป็นสิว, ผิวหมองคล้ำ. ระวัง: มีน้ำหอม","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance. Caution combining with other BHA/retinol.","doNotCombineTH":"มีน้ำหอม ระวังการใช้ร่วมกับ BHA/เรตินอลอื่น","medicubeMode":"MC","thumbnailUrl":"https://static.thcdn.com/productimg/original/11091821-1415335527893589.jpg"},{"id":110,"imageUrl":"https://static.thcdn.com/productimg/original/17222049-1425335527733431.jpg","brand":"La Roche-Posay","name":"Hyalu B5 Suractivated Serum","category":"serum","ingredients":"AQUA / WATER • GLYCERIN • ALCOHOL DENAT • PROPYLENE GLYCOL • PANTHENOL • PENTYLENE GLYCOL • DIMETHICONE • PEG-6 CAPRYLIC/CAPRIC GLYCERIDES • PPG-6-DECYLTETRADECETH-3 • GLYCERYL ISOSTEARATE • MADECASSOSIDE • SODIUM HYALURONATE • AMMONIUM POLYACRYLOYLDIMETHYL TAURATE • DISODIUM EDTA • HYDROLYZED HYALURONIC ACID • CAPRYLYL GLYCOL • CITRIC ACID • XANTHAN GUM • BUTYLENE GLYCOL • TOCOPHEROL • PHENOXYETHANOL • PARFUM /FRAGRANCE","fragranceFree":false,"alcoholFree":false,"eoFree":true,"activeIngredients":["hyaluronic acid","centella"],"description":"Plumping serum with two molecular weights of sodium hyaluronate, hydrolyzed hyaluronic acid (deeper penetrating), panthenol (B5), madecassoside (cica), dimethicone and glycerin. Visibly reduces expression lines with consistent use. Contains alcohol denat. and fragrance.","descriptionTH":"เซรั่มเติมเต็มมีโซเดียมไฮยาลูโรเนตสองน้ำหนักโมเลกุล ไฮยาลูโรนิกแอซิดไฮโดรไลซ์ แพนทีนอล (B5) แมเดคาสโซไซด์ ลดเส้นริ้วรอยที่มองเห็นได้ มีแอลกอฮอล์ Denat. และน้ำหอม","bestFor":"dry. Caution: contains fragrance, contains alcohol","bestForTH":"ผิวแห้ง. ระวัง: มีน้ำหอม, มีแอลกอฮอล์","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains Alcohol Denat. and fragrance.","doNotCombineTH":"มีแอลกอฮอล์ Denat. และน้ำหอม","medicubeMode":"Booster","thumbnailUrl":"https://static.thcdn.com/productimg/original/17222049-1425335527733431.jpg"},{"id":111,"imageUrl":"https://static.thcdn.com/productimg/original/11855111-1145335528389177.jpg","brand":"La Roche-Posay","name":"Toleriane Sensitive skin moisturiser","category":"moisturizer","ingredients":"609913 20 - INGREDIENTS : AQUA/WATER • ISOCETYL STERATE • COCO-CAPRYLATE/CAPARTE • SQUALANE • BUTYROSPERMUM • PARKII BUTTER/ SHEA BUTTER • GLYCERIN • PROPANEDIOL • CETYL ALCOHOL • ALUMINUM STARCH OCTENYLSUCCINATE • GLYCERYL STERATE • PENTYLENE GLYCOL • PEG-100 STERATE • NIACINAMIDE • CETEARYL ALCOHOL • SODIUM HYDROXIDE • CAPRYLYL • GLYCOL • CITRIC ACID • ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER . (CODE: F.I.L B221814/1)","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide"],"description":"Minimalist prebiotic moisturizer with only 12 ingredients including niacinamide, squalane, shea butter, allantoin and ceramide. Developed for highly reactive skin prone to redness. Fragrance-free and paraben-free. Widely used post-procedure.","descriptionTH":"มอยส์เจอไรเซอร์โพรไบโอติกที่มีส่วนผสมน้อยที่สุด เพียง 12 รายการ รวมถึงไนอาซินาไมด์ สควาเลน เชียบัตเตอร์ อัลแลนทอยน์ และเซราไมด์ พัฒนาขึ้นสำหรับผิวที่มีปฏิกิริยาง่ายมากและมีแนวโน้มเป็นรอยแดง ปราศจากน้ำหอม","bestFor":"dry, dull skin","bestForTH":"ผิวแห้ง, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","thumbnailUrl":"https://static.thcdn.com/productimg/original/11855111-1145335528389177.jpg"},{"id":112,"brand":"Laneige","name":"Bouncy & Firm Sleeping Mask","category":"treatment","subcategory":"sleeping mask","ingredients":"WATER, BUTYLENE GLYCOL, CYCLOPENTASILOXANE, GLYCERIN, CYCLOHEXASILOXANE, TREHALOSE, SODIUM HYALURONATE, OENOTHERA BIENNIS (EVENING PRIMROSE) ROOT EXTRACT, PRUNUS ARMENIACA (APRICOT) FRUIT EXTRACT, BETA-GLUCAN, CHENOPODIUM QUINOA SEED EXTRACT, ASCORBYL GLUCOSIDE, MAGNESIUM SULFATE, ZINC SULFATE, MANGANESE SULFATE, CALCIUM CHLORIDE, POTASSIUM ALGINATE, AMMONIUM ACRYLOYLDIMETHYLTAURATE / VP COPOLYMER, POLYSORBATE 20, DIMETHICONE, DIMETHICONOL, DIMETHICONE / VINYL DIMETHICONE CROSSPOLYMER, PROPANEDIOL, ETHYLHEXYLGLYCERIN, STEARYL BEHENATE, POLYGLYCERYL-3 METHYLGLUCOSE DISTEARATE, HYDROXYPROPYL BISPALMITAMIDE MEA, INULIN LAURYL CARBAMATE, ALCOHOL, 1,2-HEXANEDIOL, CAPRYLYL GLYCOL, CARBOMER, TROMETHAMINE, DISODIUM EDTA, PHENOXYETHANOL, FRAGRANCE, BLUE 1 (CI 42090).","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid"],"description":"Overnight firming sleeping mask with collagen, peptides (Acetyl Tetrapeptide-11), beta-glucan, apricot fruit extract, evening primrose root extract and quinoa seed extract. Improves firmness and elasticity by morning. Contains fragrance.","descriptionTH":"มาส์กกระชับผิวข้ามคืนที่มีคอลลาเจน เปปไทด์ เบตา-กลูแคน สารสกัดผลแอปริคอท สารสกัดรากอีฟนิ่งพริมโรส และสารสกัดเมล็ดคีนัว มีน้ำหอม","bestFor":"damaged barrier, dull skin, hyperpigmentation. Caution: contains fragrance","bestForTH":"ผิวแบเรียร์เสีย, ผิวหมองคล้ำ, จุดด่างดำ. ระวัง: มีน้ำหอม","howOften":"PM 2-3x per week as sleeping mask","howOftenTH":"ตอนเย็น 2-3 ครั้ง/สัปดาห์ เป็นมาส์กนอน","doNotCombine":"Contains fragrance. No other conflicts.","doNotCombineTH":"มีน้ำหอม ไม่มีข้อห้ามอื่น","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0255/0189/2660/files/Product_01_9129acd1-a5ce-46e2-9d30-bbd77479f839.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0255/0189/2660/files/Product_01_9129acd1-a5ce-46e2-9d30-bbd77479f839.jpg"},{"id":113,"brand":"Laneige","name":"Lip Sleeping Mask Berry","category":"treatment","ingredients":"DIISOSTEARYL MALATE, HYDROGENATED POLYISOBUTENE, PHYTO- STERYL/ISOSTEARYL/CETYL/STEARYL/BEHENYL DIMER DILINOLEATE, HYDROGENATED POLY(C6-14 OLEFIN), POLYBUTENE, MICROCRYSTALLINE WAX / CERA MICROCRISTALLINA / CIRE MICROCRI STALLINE, BUTYROSPERMUM PARKII (SHEA) BUTTER, SYNTHETIC WAX, ETHYLENE/PROPYLENE/STYRENE COPOLYMER, SUCROSE TETRASTEARATE TRIACETATE, MICA, EUPHORBIA CERIFERA (CANDELILLA) WAX / CANDELILLA CERA HYDROCARBONS / CIRE DE CANDELILLA, CANDELILLA WAX ESTERS, ASTROCARYUM MURUMURU SEED BUTTER, TITANIUM DIOXIDE (CI 77891), FRAGRANCE / PARFUM, GLYCERYL CAPRYLATE, POLYGLYCERYL-2 DIISOSTEARATE, BUTYLENE/ETHYLENE/STYRENE COPOLYMER, COPERNICIA CERIFERA (CARNAUBA) WAX / COPERNICIA CERIFERA CERA / CIRE DE CARNAUBA, METHICONE, POLYGLYCERYL-2 TRIISOSTEARATE, COCOS NUCIFERA (COCONUT) OIL, YELLOW 6 LAKE (CI 15985), PENTAERYTHRITYL TETRA-DI-T-BUTYL HYDROXYHYDROCINNAMATE, RED 6 (CI 15850), ASCORBIC ACID, WATER / AQUA / EAU, GLYCERIN, PROPANEDIOL, BHT, PUNICA GRANATUM FRUIT JUICE, RUBUS IDAEUS (RASPBERRY) JUICE, VITIS VINIFERA (GRAPE) JUICE","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c"],"description":"Cult overnight lip treatment with berry extracts (pomegranate, raspberry, grape), vitamin C (ascorbic acid), shea butter and BHT. Nourishes and plumps dry, chapped lips overnight. Contains flavor/aroma (berry scent).","descriptionTH":"ทรีทเมนต์ริมฝีปากข้ามคืนที่ขายดีมีสารสกัดเบอร์รี่ วิตามินซี เชียบัตเตอร์ และ BHT บำรุงและเติมเต็มริมฝีปากแห้งแตกข้ามคืน มีกลิ่นเบอร์รี่","bestFor":"dull skin, hyperpigmentation. Caution: contains fragrance","bestForTH":"ผิวหมองคล้ำ, จุดด่างดำ. ระวัง: มีน้ำหอม","howOften":"PM nightly on lips","howOftenTH":"ตอนเย็น ทุกคืนบนริมฝีปาก","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0255/0189/2660/files/PDPImage_1000x1000_LSM.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0255/0189/2660/files/PDPImage_1000x1000_LSM.jpg"},{"id":114,"brand":"Laneige","name":"Water Bank Blue Hyaluronic Cream Moisturizer","category":"moisturizer","ingredients":"Water/Aqua/Eau, Glycerin, Butylene Glycol, Squalane, Dicaprylyl Ether, Polyglyceryl-3 Methylglucose Distearate, Methyl Trimethicone, Glyceryl Stearate, Pentaerythrityl Tetraethylhexanoate, 1,2-Hexanediol, Stearyl Dimethicone, Bis-Hydroxyethoxypropyl Dimethicone, Cetyl Alcohol, Lactobacillus Ferment Lysate, Caprylic/Capric/Myristic/Stearic Triglyceride, Palmitic Acid, Stearic Acid, Panthenol, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Propanediol, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Xanthan Gum, Glyceryl Caprylate, Dextrin, Tromethamine, Ethylhexylglycerin, Disodium EDTA, Sorbitan Isostearate, Allantoin, Hydrolyzed Hyaluronic Acid, Ceramide NP, Fragrance/Parfum, Beta-Glucan, Cholesterol, Mannitol, Tocopherol, Acetyl Tetrapeptide-11, Undaria Pinnatifida Extract.","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","peptides","ceramides"],"description":"Hydrating gel-cream with blue hyaluronic acid (HA from Lactobacillus ferment lysate), Undaria pinnatifida (seaweed) extract, ceramide NP, beta-glucan, acetyl tetrapeptide-11 and mineral electrolytes. Plumps and strengthens the moisture barrier. Contains fragrance.","descriptionTH":"เจลครีมที่ให้ความชุ่มชื้ตมีไฮยาลูโรนิกแอซิดสีน้ำเงิน สารสกัดสาหร่าย Undaria pinnatifida เซราไมด์ NP เบตา-กลูแคน Acetyl Tetrapeptide-11 และแร่อิเล็กโทรไลต์ เติมเต็มและเสริมสร้างเกราะความชุ่มชื้น มีน้ำหอม","bestFor":"damaged barrier, dry, dull skin, mature skin, fine lines. Caution: contains fragrance","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: มีน้ำหอม","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance.","doNotCombineTH":"มีน้ำหอม","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0255/0189/2660/files/LN_WBCM_24AD_Product_02.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0255/0189/2660/files/LN_WBCM_24AD_Product_02.jpg"},{"id":115,"brand":"Laneige","name":"Water Sleeping Mask","category":"treatment","subcategory":"sleeping mask","ingredients":"Water / Aqua / Eau, Butylene Glycol, Glycerin, Trehalose, Methyl Trimethicone, 1,2-hexanediol, Squalane, Phenyl Trimethicone, Pca Dimethicone, Caprylyl Methicone, Ammonium Acryloyldimethyltaurate/vp Copolymer, Carbomer, Tromethamine, Lactobacillus Ferment Lysate, Niacinamide, Glyceryl Caprylate, Acrylates/c10-30 Alkyl Acrylate Crosspolymer, Propanediol, Ethylhexylglycerin, Malachite Extract, Xylitylglucoside, Propylene Glycol, Anhydroxylitol, Fragrance / Parfum, Sodium Hyaluronate, Sodium Metaphosphate, Xylitol, Raffinose, Oenothera Biennis (Evening Primrose) Oil, Hydroxypropyltrimonium Hyaluronate, Tryptophan, Lactobacillus Ferment, Beta-glucan, Limonene, Linalool, Acrylates/stearyl Methacrylate Copolymer, Tremella Fuciformis Sporocarp Extract, Hyaluronic Acid, Sodium Trimetaphosphate, Xanthan Gum, Polyglutamic Acid, Ceramide Np, Tocopherol","fragranceFree":false,"alcoholFree":true,"eoFree":false,"activeIngredients":["hyaluronic acid","niacinamide","ceramides"],"description":"Lightweight overnight sleeping mask with sleepscent (Ylang Ylang, Sandalwood, Rose, Jasmine aroma), Lactobacillus ferment lysate, evening primrose oil, apricot extract, niacinamide and HA. Overnight hydration boost and brightening. Contains fragrance.","descriptionTH":"มาส์กนอนน้ำหนักเบาที่มีกลิ่นหอมผ่อนคลาย Lactobacillus ferment lysate น้ำมันอีฟนิ่งพริมโรส สารสกัดแอปริคอท ไนอาซินาไมด์ และ HA เพิ่มความชุ่มชื้นข้ามคืน มีน้ำหอม","bestFor":"damaged barrier, dull skin. Caution: contains fragrance, contains essential oils","bestForTH":"ผิวแบเรียร์เสีย, ผิวหมองคล้ำ. ระวัง: มีน้ำหอม, มีน้ำมันหอมระเหย","howOften":"PM 2-3x per week as sleeping mask","howOftenTH":"ตอนเย็น 2-3 ครั้ง/สัปดาห์ เป็นมาส์กนอน","doNotCombine":"Contains fragrance.","doNotCombineTH":"มีน้ำหอม","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0255/0189/2660/files/WSM_AD_PDP_2.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0255/0189/2660/files/WSM_AD_PDP_2.jpg"},{"id":116,"brand":"Medicube","name":"Collagen Night Wrapping Mask","category":"treatment","subcategory":"sleeping mask","ingredients":"Water, Polyvinyl Alcohol, Glycerin, Agave Americana Stem Extract, Niacinamide, Sodium Hyaluronate, 1,2-Hexanediol, Caprylyl Glycol, Polyglyceryl-10 Laurate, Chlorella Vulgaris Extract, Glucose, Butylene Glycol, Ethylhexylglycerin, Fructooligosaccharides, Fructose, Adenosine, Xanthan Gum, Cynanchum Atratum Extract, Caprylic/Capric Triglyceride, Hydrogenated Lecithin, Althaea Rosea Flower Extract, Ceramide NP, Tocopherol, Pancratium Maritimum Extract, Collagen Extract, Sodium Stearoyl Glutamate","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide","ceramides"],"description":"Occlusive overnight wrapping mask with collagen extract, niacinamide, ceramide NP, chlorella vulgaris extract, hyaluronic acid and fructooligosaccharides (prebiotic). Locks in moisture and plumps skin overnight. Contains fragrance.","descriptionTH":"มาส์กห่อผิวข้ามคืนแบบปิดกั้นมีสารสกัดคอลลาเจน ไนอาซินาไมด์ เซราไมด์ NP ไฮยาลูโรนิกแอซิด และฟรุกโตโอลิโกแซคคาไรด์ ล็อคความชุ่มชื้นและเติมเต็มผิวข้ามคืน มีน้ำหอม","bestFor":"damaged barrier, dull skin, mature skin","bestForTH":"ผิวแบเรียร์เสีย, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"PM 2-3x per week as sleeping mask","howOftenTH":"ตอนเย็น 2-3 ครั้ง/สัปดาห์ เป็นมาส์กนอน","doNotCombine":"Contains fragrance.","doNotCombineTH":"มีน้ำหอม","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/00_6d878aff-381d-4cd6-b9e1-d8b924225025.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/00_6d878aff-381d-4cd6-b9e1-d8b924225025.jpg"},{"id":117,"brand":"Medicube","name":"Deep Vita C Capsule Cream","category":"moisturizer","ingredients":"Hippophae Rhamnoides Water, Glycerin, Water, Niacinamide, Methylpropanediol, Propanediol, 1,2-Hexanediol, Butylene Glycol, Dipropylene Glycol, Caprylic/Capric Triglyceride, Glycereth-26, Ethylhexyl Palmitate, Cetearyl Alcohol, Arginine, Carbomer, Ammonium Acryloyldimethyltaurate/VP Copolymer, Cetearyl Olivate, Helianthus Annuus (Sunflower) Seed Oil, Sorbitan Olivate, Simethicone, Polyglyceryl-10 Laurate, Ethylhexylglycerin, Adenosine, Fragrance, Polyacrylate-13, Glycine Soja (Soybean) Oil, Disodium EDTA, Polyisobutene, Hydrolyzed Sclerotium Gum, Glyceryl Stearate, Gluconolactone, Polysorbate 20, Sorbitan Isostearate, Hydrogenated Lecithin, Bixa Orellana Seed Oil, Polyglyceryl-10 Stearate, Alpha-Arbutin, Panthenol, Sodium Ascorbyl Phosphate, Pentylene Glycol, Ferulic acid, Tocopherol, Ascorbyl Glucoside, 3-O-Ethyl Ascorbic Acid, Bisabolol, Ascorbic Acid, Hydroxyphenyl Propamidobenzoic Acid, Pyridoxine, Ubiquinone, Biotin, Folic Acid, Sodium Hyaluronate, Ascorbyl Propyl Hyaluronate, Ascorbyl Palmitate, Cyanocobalamin, Thiamine HCl, Riboflavin, Linoleic Acid, Beta-Carotene, Rutin, Hydroxycinnamic Acid","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid","niacinamide","arbutin"],"description":"Vitamin C capsule moisturizer with sea buckthorn water as base, niacinamide, sodium ascorbyl phosphate, ascorbic acid, ferulic acid, 3-O-ethyl ascorbic acid, ascorbyl glucoside, panthenol, alpha-arbutin and ceramide NP. Comprehensive vitamin C brightening system. Contains fragrance.","descriptionTH":"ครีมแคปซูลวิตามินซีมีน้ำซีบัคธอร์นเป็นฐาน ไนอาซินาไมด์ โซเดียมแอสคอร์บิลฟอสเฟต กรดแอสคอร์บิก กรดเฟอรูลิก แอสคอร์บิลกลูโคไซด์ แพนทีนอล อัลฟา-อาร์บูติน และเซราไมด์ NP มีน้ำหอม","bestFor":"dry, oily, combination, dull skin, hyperpigmentation, mature skin. Caution: contains fragrance","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย. ระวัง: มีน้ำหอม","howOften":"AM + PM daily. SPF essential in AM.","howOftenTH":"เช้า-เย็น ทุกวัน ต้องใช้ครีมกันแดดตอนเช้า","doNotCombine":"Contains fragrance. Caution combining with strong AHA/BHA or retinol.","doNotCombineTH":"มีน้ำหอม ระวังการใช้ร่วมกับ AHA/BHA แรงหรือเรตินอล","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/c096afcff419378df8afcb96182a4365.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/c096afcff419378df8afcb96182a4365.jpg"},{"id":118,"brand":"Medicube","name":"PDRN Booster Gel","category":"serum","ingredients":"Aqua, Glycerin, Niacinamide, Carbomer, Chlorphenesin, Potassium Hydroxide, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Ethylhexyllycerin, Adenosine, Disodium EDTA, Sodium DNA, Dipropylene Glycol, Butylene Glycol, 1,2-Hexanediol, Pentylene Glycol, Hibiscus Esculentus Fruit Extract, Sucrose, Morus Bombycis Leaf Extract, Citrus Junos Peel Extract, Betaine, Castanea Crenata (Chestnut) Shell Extract, Polyonum Faopyrum (Buckwheat) Seed Extract, Fraaria Ananassa (Strawberry) Fruit Extract, Anacardium Occidentale (Cashew) Extract, Morina Oleifera Seed Extract, Acetyl Hexapeptide-8, Copper Tripeptide-1, Acetyl Tetrapeptide-5, Palmitoyl Pentapeptide-4, Hexapeptide-9, Palmitoyl Hexapeptide-12, Palmitoyl Tripeptide-5","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["pdrn","peptides","niacinamide"],"description":"The official slip medium for the Medicube AGE-R Booster Pro device. Contains salmon-derived Sodium DNA (PDRN), niacinamide, multiple peptides (Acetyl Hexapeptide-8, Copper Tripeptide-1, Palmitoyl Pentapeptide-4, Palmitoyl Tripeptide-5), prebiotic plant extracts and adenosine. Contains fragrance.","descriptionTH":"สื่อ slip อย่างเป็นทางการสำหรับอุปกรณ์ Medicube AGE-R Booster Pro มี Sodium DNA (PDRN) จากแซลมอน ไนอาซินาไมด์ เปปไทด์หลายชนิด สารสกัดพืชพรีไบโอติก และอะดีโนซีน มีน้ำหอม","bestFor":"oily, combination, dull skin, mature skin, fine lines","bestForTH":"ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"During Medicube Booster Pro sessions","howOftenTH":"ระหว่างการใช้งาน Medicube Booster Pro","doNotCombine":"Do not use with active AHA/BHA sessions (device amplifies penetration).","doNotCombineTH":"ห้ามใช้กับการใช้ AHA/BHA (อุปกรณ์เพิ่มการซึมซาบ)","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0552/1401/4526/files/Medicube_20-_20PDRN_20Booster_20Gel.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0552/1401/4526/files/Medicube_20-_20PDRN_20Booster_20Gel.png"},{"id":119,"brand":"Medicube","name":"PDRN Pink Peptide Serum","category":"serum","ingredients":"Salmon DNA PDRN\nWater, Glycerin, Dipropylene Glycol, Isopropyl Myristate, Glycereth-26, Niacinamide, 1,2- Hexanediol, Sodium DNA, Butylene Glycol, Polyglycerin-3, Sodium Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Polyisobutene, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Milt Extract, Tromethamine, Glyceryl Acrylate/Acrylic Acid Copolymer, PVM/MA Copolymer, Ethylhexylglycerin, Caprylyl Glycol, Fragrance, Melia Azadirachta Leaf Extract, Adenosine, Caprylyl/Capryl Glucoside, Sorbitan Oleate, Melia Azadirachta Flower Extract, Sodium Hyaluronate, Disodium EDTA, Curcuma Longa (Turmeric) Root Extract, Cyanocobalamin, Hydrolyzed Collagen, Ubiquinone, Ocimum Sanctum Leaf Extract, Corallina Officinalis Extract, Palmitoyl Pentapeptide-4, Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7, Copper Tripeptide-1, Acetyl Hexapeptide-8, Salmon Egg Extract, Atelocollagen\n\nRose PDRN","fragranceFree":false,"alcoholFree":true,"eoFree":true,"activeIngredients":["pdrn","hyaluronic acid","peptides","niacinamide"],"description":"Concentrated PDRN + peptide serum with salmon-derived Sodium DNA, 6 peptides (Palmitoyl Pentapeptide-4, Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7, Copper Tripeptide-1, Acetyl Hexapeptide-8), atelocollagen, hyaluronic acid and salmon egg extract. Contains fragrance.","descriptionTH":"เซรั่ม PDRN + เปปไทด์เข้มข้นมี Sodium DNA จากแซลมอน เปปไทด์ 6 ชนิด อะเทโลคอลลาเจน ไฮยาลูโรนิกแอซิด และสารสกัดไข่แซลมอน มีน้ำหอม","bestFor":"dry, oily, combination, dull skin, mature skin, fine lines. Caution: contains fragrance","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: มีน้ำหอม","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance. Caution with strong acids same session.","doNotCombineTH":"มีน้ำหอม ระวังการใช้ร่วมกับกรดเข้มข้นในครั้งเดียวกัน","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/PDRN_01_afffce45-a253-43cc-a113-3bbb60bd4c32.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/PDRN_01_afffce45-a253-43cc-a113-3bbb60bd4c32.jpg"},{"id":120,"brand":"Medicube","name":"TXA Niacinamide Capsule Cream","category":"moisturizer","ingredients":"water, glycerin, niacinamide (50,000 ppm), methylpropanediol, propanediol, 1,2-hexanediol, dipropylene glycol, caprylic/capric triglyceride, glyceryl glucoside, butylene glycol, arginine, ethylhexyl palmitate, carbomer, cetearyl alcohol, cetearyl olivate, sorbitan olivate, C12-14 alketh-12, ammonium acryloyldimethyltaurate/VP copolymer, simethicone, ethylhexylglycerin, melia azadirachta flower extract, melia azadirachta leaf extract, adenosine, polyacrylate-13, disodium EDTA, cyanocobalamin, triethyl citrate, betaine, polyisobutene, glyceryl stearate, hydrolyzed sclerotium gum, tranexamic acid, abelmoschus esculentus (okra) fruit extract, panthenol, coccinia indica fruit extract, corallina officinalis extract, polysorbate 20, sorbitan isostearate, glutathione, fragaria vesca (strawberry) fruit extract, castanea crenata (chestnut) shell extract, citrus junos peel extract, betula platyphylla japonica bark/leaf extract, ricinus communis (castor) seed oil, bisabolol, ferulic acid, cymbopogon citratus leaf oil, illicium verum (anise) fruit/seed oil, octyldodecanol, hydrolyzed hyaluronic acid, 3-O-ethyl ascorbic acid, sodium hyaluronate, alpha-arbutin, hydrogenated lecithin, ceramide NP, hydroxypropyltrimonium hyaluronate, caprylyl glycol, sodium acetylated hyaluronate, hyaluronic acid, sodium hyaluronate crosspolymer, hydrolyzed sodium hyaluronate, potassium hyaluronate","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid","tranexamic acid","ceramides","niacinamide","arbutin"],"description":"Clinically tested brightening cream with 5% niacinamide (50,000ppm), tranexamic acid (TXA), alpha-arbutin, glutathione, ceramide NP and 7-type HA. Brand-published human patch testing shows 0.00% irritation rate — confirmed safe for sensitive and acne-prone skin. Fragrance-free per current INCI.","descriptionTH":"ครีมเพิ่มความกระจ่างใสที่ทดสอบทางคลินิกมีไนอาซินาไมด์ 5% ทรานซาเนมิกแอซิด (TXA) อัลฟา-อาร์บูติน กลูตาไธโอน เซราไมด์ NP และ HA 7 ชนิด การทดสอบแพ้ผิวหนังแสดงอัตราการระคายเคือง 0.00% ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, damaged barrier, dry, dull skin, hyperpigmentation, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย","howOften":"AM + PM daily. SPF essential in AM.","howOftenTH":"เช้า-เย็น ทุกวัน ต้องใช้ครีมกันแดดตอนเช้า","doNotCombine":"Caution combining with strong AHA/BHA same session.","doNotCombineTH":"ระวังการใช้ร่วมกับ AHA/BHA แรงในครั้งเดียวกัน","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/TXA_00_84831587-cfc2-4ab9-b4a3-c98f0964cc41.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/TXA_00_84831587-cfc2-4ab9-b4a3-c98f0964cc41.jpg"},{"id":121,"brand":"Medicube","name":"Triple Collagen Serum","category":"serum","ingredients":"Water(Aqua), Glycerin, Butylene Glycol, Cetyl Ethylhexanoate, Niacinamide, Glycereth-26, Alcohol Denat., 1,2-Hexanediol, Cyclopentasiloxane, Cyclohexasiloxane, Trehalose, Dimethicone, Carbomer, Cetearyl Olivate, Tromethamine, Sorbitan Olivate, Ethylhexylglycerin, Collagen Extract, Fragrance, Adenosine, Disodium EDTA, Benzyl Benzoate, Linalool, Limonene, Geraniol, Atelocollagen, Desamido Collagen, Citronellol, Hydrolyzed Collagen, Sodium Hyaluronate, Soluble Collagen, Hyaluronic Acid, Hydroxycitronellal, Sodium Hyaluronate Crosspolymer, Hydrolyzed Sodium Hyaluronate, Hydrolyzed Hyaluronic Acid, Collagen, Collagen Amino Acids, Sodium Acetylated Hyaluronate, Procollagen, Hydroxypropyltrimonium Hyaluronate, Citral, Benzyl Alcohol","fragranceFree":false,"alcoholFree":false,"eoFree":false,"activeIngredients":["hyaluronic acid","niacinamide"],"description":"Triple-collagen (hydrolyzed + atelo + soluble), niacinamide and HA serum for glass-skin glow. Contains added fragrance (linalool, limonene, geraniol, citronellol) — caution for fragrance-sensitive skin.","descriptionTH":"เซรั่มคอลลาเจนสามชนิด ไนอาซินาไมด์ และ HA สำหรับผิว glass-skin มีน้ำหอมที่เพิ่มเข้าไป ระวังสำหรับผิวแพ้น้ำหอม","bestFor":"dry, oily, combination, dull skin, mature skin. Caution: contains fragrance, contains essential oils, contains alcohol","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, ผิวมีริ้วรอย. ระวัง: มีน้ำหอม, มีน้ำมันหอมระเหย, มีแอลกอฮอล์","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance (linalool, limonene, geraniol). Caution with strong actives.","doNotCombineTH":"มีน้ำหอม (ลินาลูล ลิโมนีน เจอราเนียล) ระวังเมื่อใช้กับสารออกฤทธิ์แรง","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/00_e28ee073-2062-47ca-8fca-5a117657a736.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/00_e28ee073-2062-47ca-8fca-5a117657a736.jpg"},{"id":122,"brand":"Medicube","name":"Zero Pore Pads","category":"toner","ingredients":"Zero Pore Pads Water, Methylpropanediol, Trometamin, Lactic Acid, Alcohol Denat., 1,2-Hexanediol, Panthenol, Glycereth-26, Salicylic Acid, Ammonium Acryloyldimethyltaurate/VP, Copolymer, Betaine, Trehalose, Polyglyceryl-10 Laurate, Ethylhexylglycerin, Glycerin, Allantoin, Polyglyceryl-10 Myristate, Disodium EDTA, Butylene Glycol, Sodium Hyaluronate, Betaine Salicylate, Citrus Aurantium Dulcis (Orange) Peel Oil, Citrus Limon (Lemon) Peel Oil, Citrus Grandis (Grapefruit) Peel Oil, Citrus Aurantium Bergamia (Bergamot) Fruit Oil, Rosmarinus Officinalis (Rosemary) Leaf Oil, Eucalyptus Globulus Leaf Oil, Lavandula Angustifolia (Lavender) Oil, Vitis Vinifera (Grape) Fruit Extract, Citrus Aurantifolia (Lime) Fruit Extract, Citrus Limon (Lemon) Fruit Extract, Pyrus Malus (Apple) Fruit Extract, Citrus Aurantium Dulcis (Orange) Fruit Extract, Ethyl Hexanediol, Centella Asiatica Extract, Slix Alba (Willow) Bark Extract, Origanum Vulgare Leaf Extract, Chamaecyparis Obtusa Leaf Extract, Lactobacillus/Soybean Ferment Extract, Cinnamomum Cassia Bark Extract, Scutellaria Baicalensis Root Extract, Portulaca Oleracea Extract, Oenothera Biennis (Evening Primrose) Flower Extract, Pinus Palustris Leaf Extract, Ulmus Davidiana Root Extract, Pueraria Lobata Root Extract, Limonene","fragranceFree":true,"alcoholFree":false,"eoFree":false,"activeIngredients":["hyaluronic acid","centella","bha"],"description":"Dual-textured exfoliating pads with 4.5% AHA lactic acid and 0.45% BHA salicylic acid for pore care and gentle resurfacing.","descriptionTH":"แผ่นผลัดเซลล์ผิวสองด้านที่มีกรดแลกติก 4.5% AHA และกรดซาลิไซลิก 0.45% BHA สำหรับดูแลรูขุมขนและผลัดผิวเบาๆ","bestFor":"dry, oily, acne-prone. Caution: contains essential oils, contains alcohol","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวเป็นสิว. ระวัง: มีน้ำมันหอมระเหย, มีแอลกอฮอล์","howOften":"PM, start 2-3x/week, build up","howOftenTH":"ตอนเย็น เริ่ม 2-3 ครั้ง/สัปดาห์ ค่อยๆ เพิ่ม","doNotCombine":"Avoid same session with retinol, vitamin C, or other acids.","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับเรตินอล วิตามินซี หรือกรดอื่น","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/ZeroPorePads_3_604112a1-5eea-46cd-a60a-c9a0d99c36d8.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0156/3905/2336/files/ZeroPorePads_3_604112a1-5eea-46cd-a60a-c9a0d99c36d8.jpg"},{"id":123,"brand":"Mediheal","name":"Collagen Ampoule Pads","category":"toner","ingredients":"Water, Glycerin, Glycereth-26, 1,2- Hexanediol, Diphenyl Dimethicone, Triethylhexanoin, Betaine, Hydroxyacetophenone, Hydrogenated Lecithin, Polyglyceryl-10 Oleate, Hydroxyethyl Urea, Dipotassium Glycyrrhizate, Sodium Citrate, Allantoin, Octyldodeceth-16, Xanthan Gum, Hydroxyethylcellulose, Collagen Extract, Adenosine, Citric Acid, Disodium EDTA, Olea Europaea (Olive) Fruit Oil, Butylene Glycol, Pelargonium Graveolens Flower Oil, Lavandula Angustifolia (Lavender) Oil, Anthemis Nobilis Flower Oil, Citrus Aurantium Dulcis (Orange) Peel Oil, Juniperus Mexicana Oil, Mangifera Indica (Mango) Fruit Extract, Lactobacillus Ferment, Ceramide NP, Milk Protein Extract, Caprylyl Glycol, Tripeptide- 1, Acetyl Hexapeptide- 8. Copper Tripeptide- 1, Palmitoyl Tripeptide-1, Palmitoyl Pentapeptide-4","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["peptides","ceramides"],"description":"Hydrating, plumping toner pads with multiple collagens and niacinamide for firmness and glow.","descriptionTH":"แผ่นโทนเนอร์ที่ให้ความชุ่มชื้นและเติมเต็มผิวด้วยคอลลาเจนหลายชนิดและไนอาซินาไมด์ เพื่อความกระชับและผิวกระจ่างใส","bestFor":"sensitive, redness-prone, damaged barrier, dull skin, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0053/9033/6034/files/80.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0053/9033/6034/files/80.jpg"},{"id":124,"brand":"Mediheal","name":"Teatree Essential Mask Calming Moisture","category":"moisturizer","ingredients":"Water, Glycerin, 1,2-Hexanediol, Methylpropanediol, Propanediol, Hydroxyacetophenone, Melaleuca Alternifolia (Tea Tree) Extract, Butylene Glycol, Panthenol, Allantoin, Betaine, Trehalose, Melaleuca Alternifolia (Tea Tree) Leaf Water, Lactobacillus Ferment, Adenosine, Disodium EDTA, Carbomer, Melaleuca Alternifolia (Tea Tree) Leaf Oil, Arginine, Octyldodeceth-16, Xanthan Gum, Glycine, Glutamic Acid, Aspartic Acid, 4-Terpineol, Sodium Polyacrylate, Sodium Chloride, Serine, Histidine, Alanine, Threonine, Proline, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Magnesium Chloride, Calcium Chloride","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":[],"description":"Single-use cotton sheet mask with tea tree extract that calms and refreshes breakout-prone skin.","descriptionTH":"มาส์กผ้าฝ้ายแบบใช้ครั้งเดียวที่มีสารสกัดชาเขียวที่บรรเทาและรีเฟรชผิวที่เป็นสิว","bestFor":"acne-prone, dull skin, mature skin. Caution: contains essential oils","bestForTH":"ผิวเป็นสิว, ผิวหมองคล้ำ, ผิวมีริ้วรอย. ระวัง: มีน้ำมันหอมระเหย","howOften":"2-3x per week","howOftenTH":"2-3 ครั้ง/สัปดาห์","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0053/9033/6034/files/Untitled_design_77.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0053/9033/6034/files/Untitled_design_77.png"},{"id":125,"brand":"Medik8","name":"C-Tetra® serum 7% C-vitamin","category":"serum","ingredients":"Simmondsia Chinensis (Jojoba) Seed Oil, Cyclopentasiloxane, Cyclohexasiloxane, Tetrahexyldecyl Ascorbate, Citrus Grandis (Grapefruit) Peel Oil, Tocopheryl Acetate, PPG-12/SMDI Copolymer, Limonene, Citral, Linalool, Geraniol.","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":[],"description":"Lipid-soluble 7% tetrahexyldecyl ascorbate serum that brightens gently without irritation. More stable than L-ascorbic acid. Suitable for sensitive skin.","descriptionTH":"เซรั่มวิตามินซีแบบละลายในไขมัน 7% ที่เพิ่มความกระจ่างใสเบาๆ โดยไม่ระคายเคือง เสถียรกว่ากรดแอสคอร์บิก เหมาะสำหรับผิวแพ้ง่าย","bestFor":"mature skin, dull skin, fine lines, hyperpigmentation. Caution: contains essential oils, not for sensitive skin","bestForTH":"ผิวมีริ้วรอย, ผิวหมองคล้ำ, ริ้วรอยตื้น, จุดด่างดำ. ระวัง: มีน้ำมันหอมระเหย, ไม่เหมาะสำหรับผิวบอบบาง","howOften":"AM daily","howOftenTH":"ทุกเช้า","doNotCombine":"Caution layering with strong AHA same session.","doNotCombineTH":"ระวังการเลเยอร์กับ AHA แรงในครั้งเดียวกัน","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0895/7876/6682/files/C-Tetra_Packshot.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0895/7876/6682/files/C-Tetra_Packshot.webp"},{"id":126,"brand":"Medik8","name":"Crystal Retinal","category":"serum","ingredients":"Aqua (Water), Caprylic/Capric Triglyceride, Glycerin, Isododecane, Cetearyl Olivate, Sodium Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Cetearyl Alcohol, PPG-12/SMDI Copolymer, Sorbitan Olivate, Tocopheryl Acetate, Titanium Dioxide, Eclipta Prostrata Extract, Cyclodextrin, Squalane, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Phenoxyethanol, Melia Azadirachta Leaf Extract, Hydroxypropyl Methylcellulose, Sodium Hyaluronate, Tetrahexyldecyl Ascorbate, Rubus Chamaemorus (Cloudberry) Seed Oil, Alumina, Isostearic Acid, Lecithin, Polyglyceryl-3 Polyricinoleate, Polyhydroxystearic Acid, Stearic Acid, Pentylene Glycol, Retinal, Moringa Oleifera Seed Oil, Sodium Polyaspartate, Climbazole, Disodium EDTA, Lonicera Japonica (Honeysuckle) Flower Extract, Lonicera Caprifolium (Honeysuckle) Flower Extract, Daucus Carota Sativa (Carrot) Seed Oil, Ethylhexylglycerin, 3-O-Ethyl Ascorbic Acid, Dipteryx Odorata (Tonka) Bean Extract, Hydroxyacetophenone, Polysorbate 60, Sorbitan Isostearate, Vanilla Planifolia (Vanilla) Fruit Extract, Decylene Glycol, 1,2-Hexanediol, BHT, Coumarin.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["retinol","hyaluronic acid","vitamin c"],"description":"Encapsulated retinaldehyde serum in graduated strengths (1, 3, 6, 10, 20) for stepwise anti-aging. More potent than retinol, less irritating than retinoic acid.","descriptionTH":"เซรั่มเรตินาลดีไฮด์แบบห่อหุ้มในความเข้มข้นแบบค่อยเป็นค่อยไป (1, 3, 6, 10, 20) สำหรับการต้านริ้วรอยแบบขั้นตอน มีประสิทธิภาพมากกว่าเรตินอล ระคายเคืองน้อยกว่ากรดเรตินอยก","bestFor":"dry, dull skin, hyperpigmentation, mature skin, fine lines. Caution: avoid during pregnancy","bestForTH":"ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: ห้ามใช้ระหว่างตั้งครรภ์","howOften":"PM daily (start every other night)","howOftenTH":"ตอนเย็น ทุกวัน (เริ่มวันเว้นวัน)","doNotCombine":"Same session with AHA/BHA, vitamin C, BP; avoid in pregnancy.","doNotCombineTH":"หลีกเลี่ยงการใช้ร่วมกับ AHA/BHA วิตามินซี BP ในครั้งเดียวกัน หลีกเลี่ยงระหว่างตั้งครรภ์","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0895/7876/6682/files/20230922_-_PDP_Asset_1_-_Crystal_Retinal_1_-_Packshot_-_ROW_05ac2f78-bda6-4a79-8fcc-1104e08d4df6.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0895/7876/6682/files/20230922_-_PDP_Asset_1_-_Crystal_Retinal_1_-_Packshot_-_ROW_05ac2f78-bda6-4a79-8fcc-1104e08d4df6.webp"},{"id":127,"brand":"Murad","name":"Clarifying Cleanser","category":"cleanser","ingredients":"Water/Aqua/Eau, Sodium C14-16 Olefin Sulfonate, Cocamidopropyl Betaine, Salicylic Acid, Citric Acid, Urea, Yeast Amino Acids, Trehalose, Inositol, Taurine, Betaine, Camellia Sinensis Leaf Extract, Menthol, Hydrolyzed Corn Starch Octenylsuccinate, Glycerin, PPG-26-Buteth-26, PEG-40 Hydrogenated Castor Oil, PEG-150 Distearate, Acrylates Copolymer, Cocamidopropyl Dimethylamine, Glyceryl Stearate, Tetrasodium Glutamate Diacetate, Sodium Hydroxide, Leuconostoc/Radish Root Ferment Filtrate, Potassium Sorbate, Sodium Benzoate, Benzoic Acid, Phenoxyethanol, Limonene, Fragrance (Parfum)","fragranceFree":false,"alcoholFree":true,"eoFree":false,"activeIngredients":["bha"],"description":"Salicylic acid + green tea foaming cleanser for acne-prone skin. Unclogs pores and controls oil.","descriptionTH":"คลีนเซอร์โฟมกรดซาลิไซลิก + ชาเขียวสำหรับผิวเป็นสิว เปิดรูขุมขนและควบคุมน้ำมัน","bestFor":"acne-prone. Caution: contains fragrance, contains essential oils","bestForTH":"ผิวเป็นสิว. ระวัง: มีน้ำหอม, มีน้ำมันหอมระเหย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0803/5408/3119/files/765300_Clarifying_Cleanser_PDP1_Soldier_1.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0803/5408/3119/files/765300_Clarifying_Cleanser_PDP1_Soldier_1.png"},{"id":128,"brand":"Murad","name":"Rapid Dark Spot Correcting Serum","category":"serum","ingredients":"Ingredients: Water/Aqua/Eau, Alcohol Denat., Glycolic Acid, Butylene Glycol, Glycerin, Methyl Gluceth-20, Tranexamic Acid, 4-Ethylresorcinol, Hexapeptide-2, Rice Amino Acids, Urea, Yeast Amino Acids, Trehalose, Inositol, Taurine, Betaine, Zinc Gluconate, Dipotassium Glycyrrhizate, Allantoin, Hydroxyethylcellulose, Sodium Metabisulfite, Sodium Sulfite, Sodium Hydroxide, PPG-26-Buteth-26, PEG-40 Hydrogenated Castor Oil, Polyquaternium-4, Disodium EDTA, Limonene, Benzyl Salicylate, Linalool, Fragrance (Parfum) Formulated without: Parabens, Sulfates, Phthalates, Gluten, Animal-derived ingredients, Mineral oil, Formaldehyde, Oxybenzone, Petrolatum","fragranceFree":false,"alcoholFree":false,"eoFree":false,"activeIngredients":["tranexamic acid","peptides","aha"],"description":"Resorcinol- and glycolic acid-based brightening serum that targets stubborn hyperpigmentation.","descriptionTH":"เซรั่มเพิ่มความกระจ่างใสที่มีเรสออร์ซินอลและกรดไกลโคลิกที่มุ่งเป้าที่รอยดำที่ดื้อรั้น","bestFor":"oily, acne-prone, dull skin, hyperpigmentation, mature skin, fine lines. Caution: contains fragrance, contains essential oils, contains alcohol","bestForTH":"ผิวมัน, ผิวเป็นสิว, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: มีน้ำหอม, มีน้ำมันหอมระเหย, มีแอลกอฮอล์","howOften":"AM + PM daily. SPF essential in AM.","howOftenTH":"เช้า-เย็น ทุกวัน ต้องใช้ครีมกันแดดตอนเช้า","doNotCombine":"Caution combining with retinol, vitamin C, other AHA.","doNotCombineTH":"ระวังการใช้ร่วมกับเรตินอล วิตามินซี หรือ AHA อื่น","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0803/5408/3119/files/713950_RDSCS_Carousel_1_Soldier_AMZ.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0803/5408/3119/files/713950_RDSCS_Carousel_1_Soldier_AMZ.png"},{"id":129,"brand":"Naturium","name":"Azelaic Acid Emulsion 10%","category":"moisturizer","ingredients":"Aqua, Azelaic Acid, Butylene Glycol, C12-15 Alkyl Benzoate, Glycerin, Caprylic/Capric Triglyceride, Methylpropanediol, Pentylene Glycol, Isostearyl Alcohol, C13-15 Alkane, Ethylhexyl Olivate, Butylene Glycol Cocoate, Niacinamide, Allantoin, Sebacic Acid, Acetyl Rheum Rhaponticum Root Extract, Astrocaryum Murumuru Seed Butter, Gossypium Herbaceum (Cotton) Seed Oil, Bidens Pilosa Extract, Linum Usitatissimum (Linseed) Seed Oil, Avena Sativa (Oat) Kernel Extract, Carbomer, Hydroxyacetophenone, Silica, Benzyl Alcohol, Panthenyl Triacetate, Xanthan Gum, Sodium Hydroxide, Ethylcellulose, Squalane, Ethylhexylglycerin, Lactobacillus Ferment, Sodium Benzoate, Potassium Sorbate, Tocopherol.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["azelaic acid","niacinamide"],"description":"Lightweight 10% azelaic acid emulsion that evens tone, reduces redness and softens texture.","descriptionTH":"อีมัลชั่นกรดอาเซลาอิก 10% น้ำหนักเบาที่ปรับสีผิวให้สม่ำเสมอ ลดรอยแดง และเรียบผิว","bestFor":"sensitive, redness-prone, oily, combination, dull skin, hyperpigmentation","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM + PM daily, start slow","howOftenTH":"เช้า-เย็น ทุกวัน เริ่มใช้ทีละน้อย","doNotCombine":"Caution same session with strong retinol or AHA.","doNotCombineTH":"ระวังการใช้ร่วมกับเรตินอลแรงหรือ AHA ในครั้งเดียวกัน","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR_Azelaic-Acid-Emulsion-10_Cap-on.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR_Azelaic-Acid-Emulsion-10_Cap-on.webp"},{"id":130,"brand":"Naturium","name":"Multi-Peptide Moisturizer","category":"moisturizer","ingredients":"Aqua, Glycerin, Dimethicone, Simmondsia Chinensis (Jojoba) Seed Oil, Squalane, Glyceryl Stearate, Cetyl Alcohol, Niacinamide, Stearyl Alcohol, Palmitoyl Tripeptide-5, Pantolactone, Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7, Hydrolyzed Plukenetia Volubilis Seed Extract, Dunaliella Salina Extract, Sodium Hyaluronate, 3-O-Ethyl Ascorbic Acid, Panthenol, Caryodendron Orinocense Seed Oil, Honokiol, Magnolol, Palmitic Acid, Sorbitan Oleate, Aluminum Starch Octenylsuccinate, Hydroxyacetophenone, Stearic Acid, Acrylamide/Sodium Acryloyldimethyltaurate Copolymer, Polyglyceryl-6 Laurate, 1,2-Hexanediol, Boron Nitride, Caprylyl Glycol, Polyglyceryl-10 Oleate, Isohexadecane, Butylene Glycol, Chlorphenesin, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tocopheryl Acetate, Polysorbate 80, Sorbitan Palmitate, Sodium Hydroxide, Sodium Benzoate, Carbomer, Sodium Lactate, Phenoxyethanol, Polysorbate 20, Citric Acid, Ethylhexylglycerin, Potassium Sorbate.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid","peptides","niacinamide"],"description":"Peptide-rich gel-cream moisturizer with HA and niacinamide that supports firmness and hydration.","descriptionTH":"เจลครีมมอยส์เจอไรเซอร์ที่อุดมด้วยเปปไทด์ มี HA และไนอาซินาไมด์ที่รองรับความกระชับและความชุ่มชื้น","bestFor":"sensitive, redness-prone, dry, oily, combination, dull skin, hyperpigmentation, mature skin, fine lines","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Avoid same session with high-% vitamin C.","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับวิตามินซีเข้มข้น","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR-10065_Multi-Peptide-Moisturizer-Front-CapOn-bonebkgd.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR-10065_Multi-Peptide-Moisturizer-Front-CapOn-bonebkgd.jpg"},{"id":131,"brand":"Naturium","name":"Vitamin C Complex Serum","category":"serum","ingredients":"Water (Aqua), Glycerin, Propanediol, Sodium Ascorbyl Phosphate, Ascorbic Acid, Glutathione, Ananas Sativus (Pineapple) Fruit Extract, Carica Papaya (Papaya) Fruit Extract, Mangifera Indica (Mango) Fruit Extract, Terminalia Ferdinandiana Fruit Extract, Pleiogynium Timoriense Fruit Extract, Podocarpus Elatus Fruit Extract, Aloe Barbadensis Leaf Juice, Sodium Hyaluronate, Carbomer, Tocopheryl Acetate, Phenoxyethanol, Caprylyl Glycol, Citric Acid, Hydroxyethylcellulose, Sodium Hydroxide, Beta-Glucan, Potassium Sorbate, Hexylene Glycol, Sorbitol, Xanthan Gum, Algin, Benzoic Acid, Sorbic Acid, 1,2-Hexanediol, Sodium Benzoate, Disodium Phosphate, Gold, Polysorbate 60, Sodium Phosphate.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid"],"description":"Multi-form vitamin C serum (THD ascorbate + others) for gentle brightening.","descriptionTH":"เซรั่มวิตามินซีหลายรูปแบบ (THD ascorbate และอื่นๆ) สำหรับเพิ่มความกระจ่างใสเบาๆ","bestFor":"sensitive, redness-prone, damaged barrier, dry, dull skin, hyperpigmentation","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM daily","howOftenTH":"ทุกเช้า","doNotCombine":"Caution with strong AHA/retinol same session.","doNotCombineTH":"ระวังการใช้ร่วมกับ AHA แรง/เรตินอลในครั้งเดียวกัน","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR_VitaminC_ComplexSerum_brighter_Front_CapOn_2_ecomm.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0105/2265/6823/files/NATR_VitaminC_ComplexSerum_brighter_Front_CapOn_2_ecomm.webp"},{"id":132,"imageUrl":"https://www.paulaschoice.com/dw/image/v2/BBNX_PRD/on/demandware.static/-/Sites-pc-catalog/default/dw006e394e/images/products/2-percent-bha-liquid-exfoliant-2010-portrait.png","brand":"Paula's Choice","name":"2% BHA Liquid Exfoliant","category":"exfoliant","ingredients":"Water\nMethylpropanediol\nButylene Glycol\nSalicylic Acid\nPolysorbate 20\nCamellia Oleifera\nSodium Hydroxide\nTetrasodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["bha"],"description":"Cult salicylic acid liquid exfoliant formulated at pH 3.5 with 2% salicylic acid, methylpropanediol, butylene glycol and green tea extract that unclogs pores and smooths texture.","descriptionTH":"กรดซาลิไซลิก 2% เอกโฟลิแอนต์ลิควิดที่ pH 3.5 กับน้ำชาเขียว เปิดรูขุมขนและเรียบผิว","bestFor":"oily, acne-prone","bestForTH":"ผิวมัน, ผิวเป็นสิว","howOften":"PM daily or every other day","howOftenTH":"ตอนเย็น ทุกวันหรือวันเว้นวัน","doNotCombine":"Same session with retinol, vitamin C, AHAs — avoid.","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับเรตินอล วิตามินซี AHA","medicubeMode":"None","imageUrl":"https://www.paulaschoice.com/on/demandware.static/-/Library-Sites-paulachoice/default/dw5dd89f2a/share.jpg","thumbnailUrl":"https://www.paulaschoice.com/dw/image/v2/BBNX_PRD/on/demandware.static/-/Sites-pc-catalog/default/dw006e394e/images/products/2-percent-bha-liquid-exfoliant-2010-portrait.png"},{"id":133,"imageUrl":"https://www.paulaschoice.com/dw/image/v2/BBNX_PRD/on/demandware.static/-/Sites-pc-catalog/default/dw2ea9d869/images/products/clinical-niacinamide-20-percent-treatment-8030-L_new.png","brand":"Paula's Choice","name":"Niacinamide 20% Treatment","category":"serum","ingredients":"Water\nNiacinamide\nPentylene Glycol\nButylene Glycol\nGlycerin\nAcetyl Glucosamine\nAscorbyl Glucoside\nGlycyrrhiza Glabra (Licorice) Root Extract\nSpiraea Ulmaria Extract\nPortulaca Oleracea Extract\nCamellia Japonica Flower Extract\nEpigallocatechin Gallate\nBoerhavia Diffusa Root Extract\nCamellia Sinensis Leaf Extract\nAllantoin\nLecithin\nPullulan\nPanthenol\nSilica\nXanthan Gum\nSclerotium Gum\nPropanediol\nSodium Phytate\nPhenoxyethanol\nEthylhexylglycerin","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","niacinamide"],"description":"Highly concentrated 20% niacinamide booster serum that targets pores, tone and texture.","descriptionTH":"เซรั่มบูสเตอร์ไนอาซินาไมด์ 20% ที่มีความเข้มข้นสูงมุ่งเป้าที่รูขุมขน สีผิว และพื้นผิว","bestFor":"sensitive, redness-prone, oily, combination, dull skin, hyperpigmentation","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM + PM daily, start slow","howOftenTH":"เช้า-เย็น ทุกวัน เริ่มใช้ทีละน้อย","doNotCombine":"Avoid same session with strong vitamin C.","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับวิตามินซีเข้มข้น","medicubeMode":"Booster","imageUrl":"https://www.paulaschoice.com/on/demandware.static/-/Library-Sites-paulachoice/default/dw5dd89f2a/share.jpg","thumbnailUrl":"https://www.paulaschoice.com/dw/image/v2/BBNX_PRD/on/demandware.static/-/Sites-pc-catalog/default/dw2ea9d869/images/products/clinical-niacinamide-20-percent-treatment-8030-L_new.png"},{"id":134,"brand":"Paula's Choice","name":"Omega+ Complex Moisturizer","category":"moisturizer","ingredients":"Water\nButyrospermum Parkii Butter\nCeteareth-6 Olivate\nButylene Glycol\nC13-15 Alkane\nGlycerin\nGlyceryl Stearate\nPolyglyceryl-4 Laurate\nDecyl Oleate\nLinum Usitatissimum (Linseed) Seed Oil\nSalvia Hispanica (Chia) Seed Oil\nOlea Europaea (Olive) Fruit Oil\nPassiflora Edulis Seed Oil\nBorago Officinalis Seed Oil\nHydrogenated Olive Oil\nPsidium Guajava Fruit Extract\nOlea Europaea Oil Unsaponifiables\nLimnanthes Alba (Meadowfoam) Seed Oil\nLinoleic Acid\nLinolenic Acid\nOleic Acid\nEuterpe Oleracea (Acai) Sterols\nCeramide AP\nCeramide EOP\nCeramide NP\nSerine\nAlanine\nGlycine\nProline\nLysine HCI\nThreonine\nArginine\nSqualane\nCholesterol\nPhytosphingosine\nAnastatica Hierochuntica Extract\nLecithin\nSodium Hyaluronate\nSodium Lactate\nBoerhavia Diffusa Root Extract\nAdenosine\nPhytic Acid\nGlutamic Acid\nBetaine\nPullulan\nPCA\nSodium PCA\nCarbomer, Sodium Polyacrylate Starch\nSclerotium Gum\nXanthan Gum\nSodium Lauroyl Lactylate\nPhenoxyethanol\nEthylhexylglycerin","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Omega fatty acid- and ceramide-rich moisturizer that strengthens the barrier for dehydrated skin.","descriptionTH":"มอยส์เจอไรเซอร์ที่อุดมด้วยกรดไขมันโอเมก้าและเซราไมด์ที่เสริมสร้างเกราะผิวสำหรับผิวขาดน้ำ","bestFor":"damaged barrier, dry, mature skin","bestForTH":"ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://www.paulaschoice.com/on/demandware.static/-/Library-Sites-paulachoice/default/dw5dd89f2a/share.jpg","thumbnailUrl":"https://www.paulaschoice.com/on/demandware.static/-/Library-Sites-paulachoice/default/dw5dd89f2a/share.jpg"},{"id":135,"imageUrl":"https://static.thcdn.com/productimg/original/15206625-1865223008740401.jpg","brand":"Paula's Choice","name":"Repairing Serum","category":"serum","ingredients":"Water, Glycerin, Sodium Lauroyl Lactylate, Sodium Hyaluronate, Polysorbate 20, Caprylic/Capric Triglyceride, PEG/PPG-14/4 Dimethicone, Xanthan Gum, Disodium EDTA, Sodium Cocoyl Amino Acids, Ceramide NP, Ethylhexylglycerin, Epilobium Angustifolium (Willow Herb) Extract, Ceramide AP, Cholesterol, Phytosphingosine, Beta-Glucan, Sarcosine, Carbomer, Chrysanthemum Parthenium (Feverfew) Flower Extract, Sea Whip Extract, Glycine Soja (Soybean), Seed Extract, Hyaluronic Acid, Glycyrrhiza Glabra (Licorice) Root Extract, Ceramide EOP, Magnesium Aspartate, Potassium Aspartate, Ubiquinone, Phenoxyethanol, 1, 2-Hexanediol, Caprylyl Glycol, Leuconostoc/Radish Root Ferment Filtrate, Calcium Chloride, Propylene Glycol, Tocopherol, Sodium, Metabisulfite, Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate, Sodium Benzoate, Potassium Sorbate","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Peptide-, ceramide- and antioxidant-loaded serum that supports barrier repair and elasticity.","descriptionTH":"เซรั่มที่บรรจุเปปไทด์ เซราไมด์ และสารต้านอนุมูลอิสระที่รองรับการซ่อมแซมเกราะผิวและความยืดหยุ่น","bestFor":"sensitive, redness-prone, damaged barrier, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://www.paulaschoice.com/on/demandware.static/-/Library-Sites-paulachoice/default/dw5dd89f2a/share.jpg","thumbnailUrl":"https://static.thcdn.com/productimg/original/15206625-1865223008740401.jpg"},{"id":136,"imageUrl":"https://www.paulaschoice.com/dw/image/v2/BBNX_PRD/on/demandware.static/-/Sites-pc-catalog/default/dweb8c75c3/images/products/calm-rescue-and-repair-intensive-moisturizer-9250-portrait.png","brand":"Paula's Choice","name":"Rescue & Repair Intensive Moisturizer","category":"moisturizer","ingredients":"Water\nC13-15 Alkane\nGlycerin\nPropanediol\nHelianthus Annuus (Sunflower) Seed Oil\nCetearyl Alcohol\nArachidyl Alcohol\nStearic Acid\nInulin\nBehenyl Alcohol\nCetyl Alcohol\nButylene Glycol\nHydrogenated Lecithin\nMyristyl Myristate\nArachidyl Glucoside\nAcrylates/C10-30 Alkyl Acrylate Crosspolymer\nCaprylyl Glycol\nAllantoin\nTocopherol\nEthylhexylglycerin\nHexylene Glycol\nXanthan Gum\nAlpha-Glucan Oligosaccharide\nSodium Phytate\nGlycogen\nYeast Extract\nLaminaria Digitata Extract\nAlbatrellus Confluens (Mushroom) Extract\nOpuntia Ficus-Indica Stem Extract\nGalactoarabinan\nSchizophyllan\nCitric Acid\nMaltodextrin\nAcetyl Hexapeptide-8\nPhenoxyethanol\nPotassium Sorbate","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["peptides"],"description":"Rich, fragrance-free repair moisturizer with shea butter, ceramides and antioxidants for compromised skin.","descriptionTH":"มอยส์เจอไรเซอร์ซ่อมแซมเข้มข้น ปราศจากน้ำหอม มีเชียบัตเตอร์ เซราไมด์ และสารต้านอนุมูลอิสระ สำหรับผิวที่บกพร่อง","bestFor":"sensitive, redness-prone, mature skin, fine lines","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://www.paulaschoice.com/on/demandware.static/-/Library-Sites-paulachoice/default/dw5dd89f2a/share.jpg","thumbnailUrl":"https://www.paulaschoice.com/dw/image/v2/BBNX_PRD/on/demandware.static/-/Sites-pc-catalog/default/dweb8c75c3/images/products/calm-rescue-and-repair-intensive-moisturizer-9250-portrait.png"},{"id":137,"imageUrl":"https://purito.com/wp-content/uploads/2024/02/Oat-in-Calming-Gel-Cream.png","brand":"Purito","name":"Oat In Calming Gel Cream","category":"moisturizer","ingredients":"Avena Sativa (Oat) Seed Water (77%), Butylene Glycol, Glycerin, 2,3-Butanediol, 1,2-Hexanediol, Aqua/Water, Ammonium Acryloyldimethyltaurate/VP Copolymer, Squalane, Hydroxyacetophenone, Carbomer, Dipotassium Glycyrrhizate, Panthenol, Tromethamine, Ethylhexylglycerin, Inulin Lauryl Carbamate, Sodium Surfactin, Beta-Glucan","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Oat extract + ceramide gel-cream that hydrates and calms sensitive, reactive skin. Fragrance-free.","descriptionTH":"เจลครีมที่มีสารสกัดข้าวโอ๊ต + เซราไมด์ที่ให้ความชุ่มชื้นและบรรเทาผิวแพ้ง่าย ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, damaged barrier","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://purito.com/wp-content/uploads/2024/02/purito-og-image.jpg","thumbnailUrl":"https://purito.com/wp-content/uploads/2024/02/Oat-in-Calming-Gel-Cream.png"},{"id":138,"imageUrl":"https://purito.com/wp-content/uploads/2024/02/centella_cream_unscented-new-x2.png","brand":"Purito","name":"Wonder Releaf Centella Cream Unscented","category":"moisturizer","ingredients":"Water, Caprylic/Capric Triglyceride, Macadamia Ternifolia Seed Oil, Squalane, Butylene Glycol, Cetearyl Alcohol, Glycerin, Centella Asiatica Extract(29,891ppm), Niacinamide, 1,2-\nHexanediol, Potassium Cetyl Phosphate, Ceramide NP, Madecassic Acid, Asiaticoside, Asiatic Acid, Behenic Acid, Betaine, Tromethamine, Butyrospermum Parkii (Shea) Butter, Hydrogenated Lecithin, Palmitic Acid, Stearic Acid, Caprylyl Glycol, Candida Bombicola/Glucose/Methyl Rapeseedate Ferment, Carbomer, Xanthan Gum, Hydroxyethylcellulose, Oryza Sativa (Rice) Germ Oil, Cocos Nucifera (Coconut) Oil, Sodium Carbomer, Adenosine, Phytosphingosine, Myristic Acid, Arachidic Acid, Tremella Fuciformis (Mushroom) Extract, Perilla Ocymoides Seed Extract, Sodium Hyaluronate, Beta-Glucan","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","niacinamide","ceramides"],"description":"Fragrance-free centella moisturizer that calms redness and supports barrier repair.","descriptionTH":"ครีมเซนเทลลาปราศจากน้ำหอมที่บรรเทารอยแดงและรองรับการซ่อมแซมเกราะผิว","bestFor":"sensitive, redness-prone, damaged barrier, dry, dull skin, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://purito.com/wp-content/uploads/2024/02/purito-og-image.jpg","thumbnailUrl":"https://purito.com/wp-content/uploads/2024/02/centella_cream_unscented-new-x2.png"},{"id":139,"imageUrl":"https://purito.com/wp-content/uploads/2024/02/centella_serum_unscented-thumb-x2.png","brand":"Purito","name":"Wonder Releaf Centella Serum Unscented","category":"serum","ingredients":"Water, Glycerin, Dipropylene Glycol, Propanediol, Centella Asiatica Extract(34,860ppm), Butylene Glycol, Niacinamide, 1,2-Hexanediol, Sodium Hyaluronate, Panthenol, Madecassoside, Asiaticoside, Madecassic Acid, Asiatic Acid, Centella Asiatica Callus Extracellular Vesicles(10ppm), Allantoin, Palmitoyl Tetrapeptide-7, Palmitoyl Hexapeptide-12, Palmitoyl Tripeptide-1, Palmitoyl Dipeptide-10, Carbomer, Polyglyceryl-10 Laurate, Polyglyceryl-10 Myristate, Hydrolyzed Jojoba Esters, Tromethamine, Ethylhexylglycerin, Xanthan Gum, Dipotassium Glycyrrhizate, Adenosine, Disodium EDTA, Sucrose Stearate, Glyceryl Stearate, Hydrogenated lecithin, Polyglyceryl-10 Stearate, Ceramide NP, Camellia Sinensis Leaf Extract, Pancratium Maritimum Extract","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["peptides","hyaluronic acid","centella","ceramides","niacinamide"],"description":"Fragrance-free 49% centella asiatica extract serum that visibly calms irritation. Popular pairing with the Medicube Booster Pro for sensitive skin.","descriptionTH":"เซรั่มสารสกัดเซนเทลลา 49% ปราศจากน้ำหอมที่บรรเทาการระคายเคืองที่มองเห็นได้ เป็นที่นิยมใช้ร่วมกับ Medicube Booster Pro สำหรับผิวแพ้ง่าย","bestFor":"sensitive, redness-prone, damaged barrier, dry, oily, combination, dull skin, mature skin, fine lines","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://purito.com/wp-content/uploads/2024/02/purito-og-image.jpg","thumbnailUrl":"https://purito.com/wp-content/uploads/2024/02/centella_serum_unscented-thumb-x2.png"},{"id":140,"brand":"Pyunkang Yul","name":"Calming Moisture Barrier Cream","category":"moisturizer","ingredients":"Water, Dipropylene Glycol, Glycerin, Caprylic/Capric Triglyceride, Isohexadecane, Cetearyl Alcohol, Ethylhexyl Palmitate, Cetyl Ethylhexanoate, Stearic Acid, Hydroxypropyltrimonium Hyaluronate, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate, Lonicera Japonica (Honeysuckle) Flower Extract, Melaleuca Alternifolia (Tea Tree) Leaf Extract, Sodium Hyaluronate Crosspolymer, Sodium Acetylated Hyaluronate, Ammonium Acryloyldimethyltaurate/VP Copolymer, Cetearyl Glucoside, Pentylene Glycol, Trehalose, Ceramide NP, Arachidic Acid, Glucose, Palmitic Acid, Oleic Acid, Centella Asiatica Extract, Madecassoside, Madecassic Acid, Asiaticoside, Asiatic Acid, Squalane, Olea Europaea (Olive) Fruit Oil, Butyrospermum Parkii (Shea) Butter, Camellia Japonica Flower Extract, Salvia Officinalis (Sage) Leaf Extract, Hydroxyacetophenone, Butylene Glycol, Caprylyl Glycol, Tocopherol, Disodium EDTA, 1,2-Hexanediol, Tromethamine, Hydrogenated Lecithin, Ethylhexylglycerin","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","ceramides"],"description":"Minimalist centella and ceramide cream that calms and reinforces the barrier. Fragrance-free.","descriptionTH":"ครีมเซนเทลลาและเซราไมด์ที่มีส่วนผสมน้อย บรรเทาและเสริมสร้างเกราะผิว ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, damaged barrier, dry, acne-prone","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวเป็นสิว","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0940/1807/6983/files/01_-_-_-_-50ml_d5302b96-2574-46e0-8c12-2d73e449f6d8.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0940/1807/6983/files/01_-_-_-_-50ml_d5302b96-2574-46e0-8c12-2d73e449f6d8.jpg"},{"id":141,"brand":"Pyunkang Yul","name":"Calming Moisture Nourishing Cream","category":"moisturizer","ingredients":"Water, Glycerin, Dipropylene Glycol, Hydrogenated Polydecene, Cetyl Ethylhexanoate, Butyrospermum Parkii (Shea) Butter, Polyglyceryl-3 Distearate, Cetearyl Alcohol, Glyceryl Stearate, Trimethylpentanediol/Adipic Acid/Glycerin Crosspolymer, Caprylyl Methicone, Vinyl Dimethicone, Glyceryl Caprylate, Sorbitan Sesquioleate, Sodium Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Glyceryl Stearate Citrate, Dimethiconol, Carbomer, Polyisobutene, Caprylic/Capric Triglyceride, Ethylhexyl Palmitate, Niacinamide, Ethylhexylglycerin, Xanthan Gum, Sorbitan Oleate, Caprylyl/Capryl Glucoside, Hydrogenated Lecithin, Disodium EDTA, Squalane, Collagen Extract, Butylene Glycol, Tromethamine, 1,2-Hexanediol, Pentylene Glycol, Caprylyl Glycol, Hydroxyacetophenone, Sodium Hyaluronate, Hydrolyzed Hyaluronic Acid, Hydroxypropyltrimonium Hyaluronate, Lonicera Japonica (Honeysuckle) Flower Extract, Centella Asiatica Extract, Sodium Hyaluronate Crosspolymer, Sodium Acetylated Hyaluronate, Ceramide NP, Leucine, Lysine, Melaleuca Alternifolia (Tea Tree) Leaf Extract, Madecassoside, Madecassic Acid, Asiaticoside, Asiatic Acid, Phenylalanine, Valine, Threonine, Tocopherol, Ceramide NS, Ceramide AS, Ceramide AP, Ceramide EOP","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","niacinamide","ceramides"],"description":"Richer centella + macadamia nourishing cream that deeply hydrates dry sensitive skin.","descriptionTH":"ครีมบำรุงเซนเทลลา + มาคาเดเมียที่เข้มข้นกว่าซึ่งให้ความชุ่มชื้นลึกสำหรับผิวแห้งแพ้ง่าย","bestFor":"sensitive, redness-prone, damaged barrier, dry, acne-prone, dull skin, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวเป็นสิว, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0940/1807/6983/files/1760604367377_87979f7ab4174e92852793738a7eab70.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0940/1807/6983/files/1760604367377_87979f7ab4174e92852793738a7eab70.jpg"},{"id":142,"brand":"Pyunkang Yul","name":"Essence Toner","category":"toner","ingredients":"Water, Glycerin, 1,2-Hexanediol, Butylene Glycol, Astragalus Membranaceus Root Extract, Bis-PEG-18 Methyl Ether Dimethyl Silane, Carbomer, Arginine, Hydroxyethylcellulose, BHT, Disodium Phosphate, Sodium Phosphate, Polysorbate 60","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Minimalist 91% coptis japonica root water essence-toner that gently hydrates and preps skin. Fragrance-free.","descriptionTH":"โทนเนอร์เอสเซนส์ที่มีน้ำรากโกโตะ 91% ที่มีส่วนผสมน้อย ให้ความชุ่มชื้นเบาๆ และเตรียมผิว ปราศจากน้ำหอม","bestFor":"sensitive","bestForTH":"ผิวบอบบาง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","makeupPrep":true,"imageUrl":"https://cdn.shopify.com/s/files/1/0940/1807/6983/files/01_200ml.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0940/1807/6983/files/01_200ml.jpg"},{"id":143,"brand":"Rhode","name":"Barrier Restore Cream","category":"moisturizer","ingredients":"water/aqua/eau, glycerin, caprylic/capric triglyceride, butyrospermum parkii (shea) butter, behenyl alcohol, xylitylglucoside, niacinamide, squalane, sodium acrylates copolymer, acetyl tetrapeptide-2, palmitoyl heptapeptide-27, palmitoyl oligopeptide-78, palmitoyl octapeptide-24, phenoxyethanol, anhydroxylitol, 1,2-hexanediol, hydroxyethyl acrylate/sodium acryloyldimethyl taurate copolymer, xylitol, lecithin, ethylhexylglycerin, glucose, bisabolol, sodium hyaluronate, teprenone, polysorbate 60, sorbitan isostearate, caprylyl glycol, euterpe oleracea fruit extract, potassium sorbate, citric acid, sorbic acid, lactic acid/glycolic acid copolymer, tocopherol, polyvinyl alcohol, sodium hydroxide","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","peptides","niacinamide","aha"],"description":"Fragrance-free rich-yet-lightweight peptide, niacinamide, shea butter and HA moisturizer designed to comfort and restore the skin barrier.","descriptionTH":"มอยส์เจอไรเซอร์ปราศจากน้ำหอมที่มีเปปไทด์ ไนอาซินาไมด์ เชียบัตเตอร์ และ HA ที่เบาแต่เข้มข้น ออกแบบมาเพื่อบรรเทาและฟื้นฟูเกราะผิว","bestFor":"dry, oily, dull skin, mature skin, fine lines","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0606/5451/8510/products/brc-2000x2000_1.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0606/5451/8510/products/brc-2000x2000_1.png"},{"id":144,"brand":"Rhode","name":"Glazing Milk","category":"toner","ingredients":"water (aqua) (eau), c12-15 alkyl benzoate, coconut alkanes, glycerin, polyglyceryl-3 oleate, polyglyceryl-10 mono/dioleate, tocopheryl acetate, sodium hyaluronate, sodium hyaluronate crosspolymer, hydrolyzed sodium hyaluronate, sodium acetylated hyaluronate, ceramide np, ceramide ap, ceramide eop, beta-glucan, copper gluconate, magnesium aspartate, oleic acid, linoleic acid, linolenic acid, xanthan gum, zinc gluconate, euterpe oleracea sterols, phosphatidylglycerol, phytosphingosine, caprylyl glycol, cholesterol, coco-caprylate/caprate, peg-7 glyceryl cocoate, cetyl hydroxyethylcellulose, carbomer, sodium lauroyl lactylate, pentylene glycol, 1,2-hexanediol, sodium phytate, phenoxyethanol, ethylhexylglycerin, sodium benzoate, chlorphenesin, citric acid","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Lightweight prep milk with niacinamide, allantoin and beta-glucan that softens and primes skin.","descriptionTH":"นมเตรียมผิวน้ำหนักเบาที่มีไนอาซินาไมด์ อัลแลนทอยน์ และเบตา-กลูแคนที่นุ่มผิวและเตรียมพื้นผิว","bestFor":"sensitive, redness-prone, damaged barrier, dry, oily, acne-prone","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมัน, ผิวเป็นสิว","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","makeupPrep":true,"imageUrl":"https://cdn.shopify.com/s/files/1/0606/5451/8510/files/glazing-milk-sq.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0606/5451/8510/files/glazing-milk-sq.png"},{"id":145,"brand":"Rhode","name":"Peptide Glazing Fluid","category":"serum","ingredients":"water (aqua) (eau), glycerin, butylene glycol, sclerocarya birrea seed oil, niacinamide, tetradecane, capryloyl glycerin/sebacic acid copolymer, diheptyl succinate, acetyl hexapeptide-8, sodium hyaluronate, hydroxyacetophenone, caprylyl glycol, glyceryl oleate, dilauryl thiodipropionate, acrylates/c10-30 alkyl acrylate crosspolymer, carbomer, sucrose palmitate, sodium phosphate, disodium phosphate, phenoxyethanol, sodium hydroxide, benzyl alcohol","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","peptides","niacinamide"],"description":"Peptide, HA and marula-oil glow serum that gives a glassy dewy finish.","descriptionTH":"เซรั่มเปปไทด์ HA และน้ำมันมารูลาที่ให้ผิว glass-skin dewy","bestFor":"dry, oily, combination, dull skin, mature skin, fine lines","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","makeupPrep":true,"imageUrl":"https://cdn.shopify.com/s/files/1/0606/5451/8510/products/glaze-2000x2000_1.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0606/5451/8510/products/glaze-2000x2000_1.png"},{"id":146,"brand":"Rhode","name":"Pineapple Refresh","category":"cleanser","ingredients":"water (aqua) (eau), glycerin, acrylates copolymer, potassium cocoyl glycinate, lauramidopropyl betaine, caprylic/capric triglyceride, potassium cocoate, glycolipids, tocopherol, ananas sativus (pineapple) fruit extract, hippophae rhamnoides fruit oil, camellia oleifera leaf extract, lauroyl lysine, polyglutamic acid, hydroxyacetophenone, lactobacillus ferment, saccharide isomerate, caprylyl glycol, phytosteryl/octyldodecyl lauroyl glutamate, hydroxypropyltrimonium hyaluronate, polyglyceryl-4 caprate, polyglyceryl-6 caprylate, caprylyl glyceryl ether, 1,2-hexanediol, sodium citrate, leuconostoc/radish root ferment filtrate, citric acid, sodium hydroxide","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Gentle gel cleanser with pineapple extract, ceramides and HA for a non-stripping, hydrating cleanse.","descriptionTH":"เจลล้างหน้าอ่อนโยนที่มีสารสกัดสับปะรด เซราไมด์ และ HA สำหรับการทำความสะอาดที่ไม่ตึงผิว","bestFor":"sensitive, dull skin","bestForTH":"ผิวบอบบาง, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0606/5451/8510/files/cleanser-main-png-2000x2000-revision.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0606/5451/8510/files/cleanser-main-png-2000x2000-revision.png"},{"id":147,"brand":"Round Lab","name":"1025 Dokdo Ampoule","category":"serum","ingredients":"Water, Butylene Glycol, Glycerin, Dipropylene Glycol, Propanediol, 1,2-Hexanediol, Sea Water, Hydrolyzed Hyaluronic Acid, Hydrolyzed Collagen, Panthenol, Chondrus Crispus Extract, Saccharum Officinarum (Sugarcane) Extract, Tromethamine, Ethylhexylglycerin, Caprylic/Capric Triglyceride, Betaine, Dipotassium Glycyrrhizate, Glyceryl Glucoside, Hydrogenated Lecithin, Ceramide NP, Tocopherol, Carbomer, Xanthan Gum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Mineral-rich Ulleungdo/Dokdo deep sea water ampoule with HA and panthenol for plump hydration.","descriptionTH":"แอมพูลน้ำทะเลลึก Ulleungdo/Dokdo ที่อุดมด้วยแร่ธาตุ มี HA และแพนทีนอล สำหรับความชุ่มชื้นแบบเติมเต็ม","bestFor":"sensitive, redness-prone, damaged barrier, dry, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/1025-dokdo-ampoule-round-lab-1.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/1025-dokdo-ampoule-round-lab-1.jpg"},{"id":148,"brand":"Round Lab","name":"1025 Dokdo Cleansing Balm","category":"oil cleanser","subcategory":"cleansing balm","ingredients":"Ethylhexyl Palmitate, Isopropyl Palmitate, Sorbeth-30 Tetraoleate, Helianthus Annuus (Sunflower) Seed Oil, Synthetic Wax, Sorbitan Sesquioleate, Sea Water, Oenothera Biennis (Evening Primrose) Oil, Vitis Vinifera (Grape) Seed Oil, Limnanthes Alba (Meadowfoam) Seed Oil, 1,2-Hexanediol, Butylene Glycol, Protease, Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate, Bis-Ethoxydiglycol Cyclohexane-1,4-Dicarboxylate, Citrus Aurantium Bergamia (Bergamot) Fruit Oil, Salvia Officinalis (Sage) Oil, Tocopherol, Limonene, Linalool.","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":[],"description":"Gentle cleansing balm with Dokdo seawater minerals that melts SPF and makeup without stripping.","descriptionTH":"คลีนซิ่งบาล์มอ่อนโยนที่มีแร่ธาตุน้ำทะเล Dokdo ละลายครีมกันแดดและเครื่องสำอางโดยไม่ตึงผิว","bestFor":"All skin types. Caution: contains essential oils","bestForTH":"ผิวทุกประเภท. ระวัง: มีน้ำมันหอมระเหย","howOften":"PM daily as first cleanse","howOftenTH":"ตอนเย็น ทุกวัน เป็นขั้นตอนทำความสะอาดแรก","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Dokdo_Cleansing_Balm_50ml.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Dokdo_Cleansing_Balm_50ml.webp"},{"id":149,"brand":"Round Lab","name":"1025 Dokdo Cleansing Oil","category":"oil cleanser","subcategory":"cleansing oil","ingredients":"Water,Oenothera Biennis (Evening Primrose) Oil, Limnanthes Alba (Meadowfoam) Seed Oil, Persea Gratissima (Avocado) Oil, Vitis Vinifera (Grape) Seed Oil, Canola Oil,Macadamia Integrifolia Seed Oil,Sea Water,Butylene Glycol, Allantoin, Panthenol, 1,2-Hexanediol, Caprylic/Capric Triglyceride, Phosphatidylcholine, Hyaluronic Acid, Ceramide NP, Glycine, Hydrolyzed Hyaluronic Acid, Glutamic Acid, Serine, Sodium Hyaluronate, Lysine, Alanine, Arginine, Threonine, Proline, Citrus Aurantium Bergamia (Bergamot) Fruit Oil, Salvia Officinalis (Sage) Oil, Tocopherol, Limonene, Linalool","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Lightweight oil cleanser with sea water minerals that emulsifies easily and removes impurities gently.","descriptionTH":"คลีนซิ่งออยล์น้ำหนักเบาที่มีแร่ธาตุน้ำทะเล ละลายน้ำได้ง่ายและขจัดสิ่งสกปรกเบาๆ","bestFor":"damaged barrier. Caution: contains essential oils","bestForTH":"ผิวแบเรียร์เสีย. ระวัง: มีน้ำมันหอมระเหย","howOften":"PM daily as first cleanse","howOftenTH":"ตอนเย็น ทุกวัน เป็นขั้นตอนทำความสะอาดแรก","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/1025-dokdo-cleansing-oil-round-lab-1_e3e7ee17-149e-4bcb-814d-88ce57e96d63.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/1025-dokdo-cleansing-oil-round-lab-1_e3e7ee17-149e-4bcb-814d-88ce57e96d63.jpg"},{"id":150,"brand":"Round Lab","name":"1025 Dokdo Cream","category":"moisturizer","ingredients":"Water, Glycerin, Caprylic/Capric Triglyceride, Dipropylene Glycol, Hydrogenated Poly(C6-14 Olefin), Cetearyl Alcohol, Methyl Trimethicone, 1,2-Hexanediol, Caprylyl Methicone, Phenyl Trimethicone, C12-16 Alcohols, Butyrospermum Parkii (Shea) Butter, Sea Water, Chondrus Crispus Extract, Saccharum Officinarum (Sugarcane) Extract, Hyaluronic Acid, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate, Glyceryl Stearate SE, Ceramide AP, Ceramide AS, Ceramide EOP, Ceramide NP, Ceramide NS, Polymethylsilsesquioxane, Palmitic Acid, Cetearyl Glucoside, Cetearyl Olivate, Sorbitan Olivate, Hydrogenated Lecithin, Copernicia Cerifera (Carnauba) Wax, Stearic Acid, Ammonium Acryloyldimethyltaurate/VP Copolymer, Ethylhexylglycerin, Glyceryl Caprylate, Allantoin, Panthenol, Butylene Glycol, Beta-Glucan, Cholesterol, Phytosphingosine, Disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Soothing gel-cream with Ulleungdo and Dokdo deep sea water plus panthenol for sensitive skin.","descriptionTH":"เจลครีมบรรเทาที่มีน้ำทะเลลึก Ulleungdo และ Dokdo บวกกับแพนทีนอล สำหรับผิวแพ้ง่าย","bestFor":"sensitive, redness-prone, damaged barrier, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/1025-dokdo-cream-round-lab-1_66b8271b-613f-4510-82e8-b15abb0f1e37.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/1025-dokdo-cream-round-lab-1_66b8271b-613f-4510-82e8-b15abb0f1e37.jpg"},{"id":151,"brand":"Round Lab","name":"1025 Dokdo Lotion","category":"moisturizer","ingredients":"Water, Glycerin, Macadamia Integrifolia Seed Oil, 1,2-Hexanediol, Pentylene Glycol, Chondrus Crispus Extract, Saccharum Officinarum (Sugarcane) Extract, Sea Water, Hyaluronic Acid, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate, Panthenol, Squalane, Butylene Glycol, Polyglyceryl-3 Methylglucose Distearate, Glyceryl Stearate, Hydrogenated Polydecene, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Jojoba Esters, Caprylyl Glycol, Tromethamine, Sodium Phytate, Tocopherol, Sodium Carboxymethyl Beta-Glucan, Ethylhexylglycerin, Cetearyl Alcohol, Carbomer","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid"],"description":"Lightweight, fragrance-free lotion with deep sea water and HA for everyday sensitive-skin hydration.","descriptionTH":"โลชั่นน้ำหนักเบา ปราศจากน้ำหอม ที่มีน้ำทะเลลึกและ HA สำหรับความชุ่มชื้นประจำวันของผิวแพ้ง่าย","bestFor":"sensitive, redness-prone, damaged barrier, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/1025-dokdo-lotion-round-lab-1.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/1025-dokdo-lotion-round-lab-1.jpg"},{"id":152,"brand":"Round Lab","name":"1025 Dokdo Toner","category":"toner","ingredients":"Water, Butylene Glycol, Glycerin, Pentylene Glycol, Propanediol, Chondrus Crispus Extract, Saccharum Officinarum (Sugarcane) Extract, Sea Water, 1,2-Hexanediol, Protease, Betaine, Panthenol, Ethylhexylglycerin, Allantoin, Xanthan Gum, Disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Bestselling gentle hydrating toner with mineral-rich Ulleungdo/Dokdo sea water, panthenol and HA. Fragrance-free.","descriptionTH":"โทนเนอร์ให้ความชุ่มชื้นอ่อนโยนขายดีที่มีน้ำทะเล Ulleungdo/Dokdo อุดมด้วยแร่ธาตุ แพนทีนอล และ HA ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Dokdo_Toner_2025.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Dokdo_Toner_2025.png"},{"id":153,"brand":"Round Lab","name":"Birch Juice Moisturizing Ampoule","category":"serum","ingredients":"Water, Butylene Glycol, Glycerin, Pentylene Glycol, Methy|propanediol, 1,2-Hexanediol, Betula Platyphylla Japonica Juice, XylityIglucoside, Chlorella Vulgaris Extract, Xylitol, Lactobacillus Ferment, Curcuma Longa (Turmeric) Root Extract, Hydrolyzed Hyaluronic Acid, Hyaluronic Acid, Sodium Hyaluronate, Anhydroxylitol, Glucose, Fructooligosaccharides, Fructose, Ammonium Acryloy|dimethy|taurate/VP Copolymer, Ethylhexyl glycerin, Dipotassium Glycyrrhizate, Dextrin, Beta-Glucan, Glyceryl Glucoside, Tocopherol, Dipropylene Glycol, Dimethylsilanol Hyaluronate, Hydrolyzed Sodium Hyaluronate, Potassium Hyaluronate, Hydroxypro pyltrimonium Hyaluronate, Sodium Hyaluronate Crosspolymer, Sodium Hyaluronate Dimethylsilanol, Sodium Acetylated Hyaluronate, Caprylyl/Capryl Glucoside, Hydrogenated Lecithin, Ceramide NP, Xanthan Gum, Gardenia Florida Fruit Extract","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Birch sap and 10-type hyaluronic acid complex ampoule that delivers long-lasting rich hydration for up to 72 hours.","descriptionTH":"แอมพูลน้ำต้นเบิร์ชและกลุ่มไฮยาลูโรนิกแอซิด 10 ชนิดที่ให้ความชุ่มชื้นอย่างลึกล้ำและยาวนานสูงสุด 72 ชั่วโมง","bestFor":"sensitive, redness-prone, damaged barrier, dry, dull skin, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Birch_Ampoule_new.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Birch_Ampoule_new.webp"},{"id":154,"brand":"Round Lab","name":"Birch Moisturizing Cleanser","category":"cleanser","ingredients":"Water, Glycerin, Sodium Cocoyl Alaninate, Lauryl Hydroxysultaine, Disodium Cocoamphodiacetate, Sodium Methyl Cocoyl Taurate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Betula Platyphylla Japonica Juice(10,000ppm),Butylene Glycol, Sodium Hyaluronate, Hyaluronic Acid, Sodium Chloride, Glyceryl Glucoside, Ascorbic Acid, 1,2-Hexanediol, Artemisia Annua Extract, Anthemis Nobilis Flower Oil, Pinus Sylvestris Leaf Oil, Quillaja Saponaria Bark Extract, Caprylyl Glycol, Coco-Glucoside, Glyceryl Caprylate, Sodium Cocoyl Isethionate, Hexylene Glycol, Citric Acid, Disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid"],"description":"Mild birch sap cleanser that hydrates while cleansing for dry, dehydrated skin.","descriptionTH":"คลีนเซอร์น้ำต้นเบิร์ชอ่อนโยนที่ให้ความชุ่มชื้นพร้อมทำความสะอาดสำหรับผิวแห้ง ผิวขาดน้ำ","bestFor":"sensitive, redness-prone, dull skin, hyperpigmentation","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/birch-moisturizing-cleanser-round-lab-1.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/birch-moisturizing-cleanser-round-lab-1.png"},{"id":155,"brand":"Round Lab","name":"Birch Moisturizing Cream","category":"moisturizer","ingredients":"Water, Glycerin, Isononyl Isononanoate, Isododecane, 1,2-Hexanediol, Pentylene Glycol, Polydecene, Betula Platyphylla Japonica Juice(10,000ppm), Jojoba Esters, Panthenol, Glyceryl Glucoside, Acacia Senegal Gum, Hydrolyzed Hibiscus Esculentus Extract, Sodium Hyaluronate, Hyaluronic Acid, Lupinus Albus Seed Extract, Moringa Oleifera Seed Extract, Melia Azadirachta Leaf Extract, Melia Azadirachta Flower Extract, Coccinia Indica Fruit Extract, Aloe Barbadensis Flower Extract, Solanum Melongena (Eggplant) Fruit Extract, Ocimum Sanctum Leaf Extract, Corallina Officinalis Extract, Curcuma Longa (Turmeric) Root Extract, Ascorbic Acid, Pentaerythrityl Tetraethylhexanoate, Ammonium Acryloyldimethyltaurate/VP Copolymer, Polyglyceryl-3 Methylglucose Distearate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tromethamine, Glyceryl Acrylate/Acrylic Acid Copolymer, Ethylhexylglycerin, Agar, Dipotassium Glycyrrhizate, Glyceryl Caprylate, Butylene Glycol, Disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid"],"description":"Birch sap and panthenol cream that provides long-lasting moisture for dry skin.","descriptionTH":"ครีมน้ำต้นเบิร์ชและแพนทีนอลที่ให้ความชุ่มชื้นยาวนานสำหรับผิวแห้ง","bestFor":"sensitive, redness-prone, dry, dull skin, hyperpigmentation","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/birch-moisturizing-cream-round-lab-3.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/birch-moisturizing-cream-round-lab-3.jpg"},{"id":156,"brand":"Round Lab","name":"Birch Moisturizing Serum","category":"serum","ingredients":"Water, Methylpropanediol, Glycerin, 1,2-Hexanediol, Polyglycerin-3, Caprylic/Capric Triglyceride, Betula Platyphylla Japonica Juice(10,000ppm), Sodium Hyaluronate, Glyceryl Glucoside, Hydrolyzed Hyaluronic Acid, Butylene Glycol, Hyaluronic Acid, Ascorbic Acid, Beta-Glucan, Dipotassium Glycyrrhizate, Hydrogenated Lecithin, Ethylhexylglycerin, Eclipta Prostrata Leaf Extract, Laminaria Japonica Extract, Avena Sativa (Oat) Kernel Extract, Cynara Scolymus (Artichoke) Leaf Extract, Pteris Multifida Extract, Melia Azadirachta Leaf Extract, Melia Azadirachta Flower Extract, Coccinia Indica Fruit Extract, Aloe Barbadensis Flower Extract, Solanum Melongena (Eggplant) Fruit Extract, Ocimum Sanctum Leaf Extract, Corallina Officinalis Extract, Curcuma Longa (Turmeric) Root Extract, Cyclohexasiloxane, Dipropylene Glycol, Ammonium Acryloyldimethyltaurate/VP Copolymer, Xanthan Gum, Fructooligosaccharides, Carbomer, Disodium EDTA, Polyquaternium-51, Tromethamine, Tocopherol","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid"],"description":"Watery hydrating serum with birch sap and multi-weight HA for plump skin.","descriptionTH":"เซรั่มให้ความชุ่มชื้นแบบน้ำที่มีน้ำต้นเบิร์ชและ HA น้ำหนักโมเลกุลหลายชนิด สำหรับผิวอิ่มน้ำ","bestFor":"sensitive, redness-prone, damaged barrier, dry, dull skin, hyperpigmentation","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Birch_Serum_2026.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Birch_Serum_2026.jpg"},{"id":157,"brand":"Round Lab","name":"Birch Moisturizing Sunscreen UVLock SPF 45+ Broad Spectrum","category":"sunscreen","ingredients":"Hydrating Soothing UV Protection WATER, ACRYLATES COPOLYMER, CAPRYLYL METHICONE, SPARASSIS CRISPA EXTRACT, TOCOPHEROL (VITAMIN E), NIACINAMIDE,POLYGLYCERYL-3 DISTEARATEAVOBENZONE, HOMOSALATE, CALCIUM ALUMINUM BOROSILICATE, 1,2-HEXANEDIOL, OCTISALATE, BUTYLOCTYL SALICYLATE, POLY C10-30 ALKYL ACRYLATE, CETEARYL ALCOHOL, TROMETHAMINE, GLYCERYL STEARATE CITRATE, BETULA PLATYPHYLLA JAPONICA JUICE, ARTEMISIA ANNUA EXTRACT, ANTHEMIS NOBILIS FLOWER OIL, ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER, GLYCERIN, BUTYLENE GLYCOL, SODIUM HYALURONATE, CARBOMER, ETHYLHEXYLGLYCERIN, HYALURONIC ACID, GLYCERYL GLUCOSIDE, PROPANEDIOL, PINUS SYLVESTRIS LEAF OIL, ALLANTOIN, PORTULACA OLERACEA EXTRACT, SODIUM STEAROYL GLUTAMATE, GLYCERYL POLYMETHACRYLATE, TRIETHOXYCAPRYLYLSILANE, PENTYLENE GLYCOL, METHYLPROPANEDIOL, BIOSACCHARIDE GUM-1, BENZOTRIAZOLYL DODECYL P-CRESOL, DIETHYLHEXYL 2,6-NAPHTHALATE, POLYMETHYLSILSESQUIOXANE","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide"],"description":"Chemical sunscreen with birch sap that hydrates while providing UV protection.","descriptionTH":"ครีมกันแดดเคมีที่มีน้ำต้นเบิร์ชที่ให้ความชุ่มชื้นพร้อมป้องกัน UV","bestFor":"sensitive, redness-prone, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวหมองคล้ำ","howOften":"AM daily","howOftenTH":"ทุกเช้า","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/BIRCH_JUICE_MOISTURIZING_UVLOCK3_Large_10126e46-dfcc-4cd5-970c-146d4be65989.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/BIRCH_JUICE_MOISTURIZING_UVLOCK3_Large_10126e46-dfcc-4cd5-970c-146d4be65989.webp"},{"id":158,"brand":"Round Lab","name":"Birch Moisturizing Toner","category":"toner","ingredients":"Water, Glycine, Propanediol, Glycereth-26, Pentylene Glycol, Betula Platyphylla Japonica Juice(10,000ppm), 1,2-Hexanediol, Chondrus Crispus Extract, Saccharum Officinarum (Sugarcane) Extract, Sodium Hyaluronate, Hyaluronic Acid, Panthenol, Tromethamine, Dipotassium Glycyrrhizate, Glyceryl Caprylate, Glyceryl Glucoside, Butylene Glycol, Ascorbic Acid, Carbomer, Xanthan Gum, Disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["vitamin c","hyaluronic acid"],"description":"Birch sap hydrating toner that softens and preps skin without stickiness. Fragrance-free.","descriptionTH":"โทนเนอร์ให้ความชุ่มชื้นน้ำต้นเบิร์ชที่นุ่มผิวและเตรียมผิวโดยไม่เหนียวเหนอะหนะ ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, dry, dull skin, hyperpigmentation","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Screenshot2026-04-13at4.27.42PM.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Screenshot2026-04-13at4.27.42PM.png"},{"id":159,"brand":"Round Lab","name":"Dokdo Cleansing Water","category":"cleanser","ingredients":"Water, Dipropylene Glycol, Glycerin, Polyglyceryl-4 Caprate, 1,2-Hexanediol, Sea Water , Hyaluronic Acid, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate, Panthenol, Allantoin, Ceramide NP, Pentylene Glycol, C12-14 Pareth-12, Caprylyl Glycol, Ethylhexylglycerin, Butylene Glycol, Tocopherol, Disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Mild Dokdo seawater micellar cleansing water that removes light makeup and impurities gently. Fragrance-free.","descriptionTH":"น้ำล้างเครื่องสำอางไมเซลลาร์ที่อ่อนโยนด้วยน้ำทะเล Dokdo ขจัดเครื่องสำอางเบาและสิ่งสกปรกได้เบาๆ ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, damaged barrier","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย","howOften":"AM and/or PM as needed","howOftenTH":"เช้าและ/หรือเย็น ตามความต้องการ","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Dokdo_Cleansing_Water.webp","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/Dokdo_Cleansing_Water.webp"},{"id":160,"brand":"Round Lab","name":"Mugwort Calming Cleanser","category":"cleanser","ingredients":"Water, Glycerin, Sodium Cocoyl Glycinate, Sodium Lauroyl Glutamate, Butylene Glycol, Coco-Betaine, Betaine, Hydroxypropyl Starch Phosphate, Artemisia Vulgaris Extract (10,045ppm), Artemisia Princeps Leaf Extract 800pm, Madecassoside, Asiaticoside, Asiatic Acid, Madecassic Acid, Panthenol, Allantoin, Melia Azadirachta Leaf Extract, Malt Extract, Camellia Sinensis Leaf Extract, Melia Azadirachta Flower Extract, Sodium Chloride, Aspartic Acid, Caprylyl Glycol, Polyquaternium-67, 1,2-Hexanediol, Ethylhexylglycerin, Citric Acid, Salvia Officinalis (Sage) Oil","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["centella"],"description":"Mild mugwort-based cleanser that calms reactive, irritated skin.","descriptionTH":"คลีนเซอร์กวัดแก่อ่อนโยนที่บรรเทาผิวระคายเคืองและผิวแพ้ง่าย","bestFor":"sensitive, redness-prone","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/mugwort-calming-cleanser-round-lab-1.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/mugwort-calming-cleanser-round-lab-1.png"},{"id":161,"brand":"Round Lab","name":"Soybean Nourishing Cream","category":"moisturizer","ingredients":"Water, Glycerin, Ethylhexyl Stearate, Hydrogenated Polyisobutene, Polyglyceryl-3 Distearate, Disostearyl Malate, Caprylic/Capric Triglyceride, Butylene Glycol, Vinyl Dimethicone, Hydrogenated Coco-Glycerides, 1,2-Hexanediol, Glycine Max (Soybean) Seed Extract(10,000ppm), Ceramide NP, Melia Azadirachta Flower Extract, Melia Azadirachta Leaf Extract, Panthenol, Curcuma Longa (Turmeric) Root Extract, Ocimum Sanctum Leaf Extract, Corallina Officinalis Extract, Glyceryl Stearate, Pentylene Glycol, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Boron Nitride, Palmitic Acid, Hydroxyacetophenone, Stearic Acid, Glyceryl Stearate Citrate, Dipotassium Glycyrrhizate, Ethylhexylglycerin, Hydrogenated Lecithin, Adenosine, Tromethamine, Sorbitan Isostearate, Dextrin, Cetearyl Alcohol, Xanthan Gum, Carbomer, Disodium EDTA, Theobroma Cacao (Cocoa) Seed Extract","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["ceramides"],"description":"Fermented soybean and ceramide nourishing cream that boosts firmness and hydration.","descriptionTH":"ครีมบำรุงถั่วเหลืองหมักและเซราไมด์ที่เพิ่มความกระชับและความชุ่มชื้น","bestFor":"sensitive, redness-prone, damaged barrier, dry, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/soybean-nourishing-cream-round-lab-1.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/soybean-nourishing-cream-round-lab-1.png"},{"id":162,"brand":"SK-II","name":"PITERA™ Facial Treatment Essence","category":"essence","ingredients":"Galactomyces Ferment Filtrate (PITERA™)\nButylene Glycol\nPentylene Glycol\nWater\nSodium Benzoate\nMethylparaben\nSorbic Acid","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Iconic essence containing more than 90% PITERA (Galactomyces Ferment Filtrate) that brightens, smooths and supports skin renewal.","descriptionTH":"เอสเซนส์ที่มี PITERA (Galactomyces Ferment Filtrate) มากกว่า 90% ที่เพิ่มความกระจ่างใส เรียบ และรองรับการต่ออายุผิว","bestFor":"mature skin, dull skin, sensitive — all skin types","bestForTH":"ผิวมีริ้วรอย, ผิวหมองคล้ำ, ผิวบอบบาง — ผิวทุกประเภท","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn11.bigcommerce.com/s-x3hur0xe4r/products/151/images/3065/FTE__97266.1778600666.386.513.png?c=1","thumbnailUrl":"https://cdn11.bigcommerce.com/s-x3hur0xe4r/products/151/images/3065/FTE__97266.1778600666.386.513.png?c=1"},{"id":163,"brand":"Shiseido","name":"Ultimune Power Infusing Serum","category":"serum","ingredients":"WATER(AQUA/EAU)･GLYCERIN･BUTYLENE GLYCOL･ALCOHOL DENAT.･DIMETHICONE･ DIGLYCERIN･PEG/PPG-17/4 DIMETHYL ETHER･PEG-8･ISODECYL NEOPENTANOATE･TREHALOSE･AMMONIUM ACRYLOYLDIMETHYLTAURATE/BEHENETH-25 METHACRYLATE CROSSPOLYMER･PEG-14M･TOCOPHERYL ACETATE･PEG/PPG-14/7 DIMETHYL ETHER･PHYTOSTERYL/OCTYLDODECYL LAUROYL GLUTAMATE･ROSA DAMASCENA FLOWER WATER･ECTOIN･XYLITOL･LAURYL BETAINE･ORIGANUM MAJORANA LEAF EXTRACT･HYDROXYPROLINE･CAMELLIA JAPONICA SEED OIL･CAMELLIA JAPONICA FLOWER EXTRACT･HOUTTUYNIA CORDATA EXTRACT･SODIUM CARBOXYMETHYL BETA-GLUCAN･CAMELLIA JAPONICA LEAF EXTRACT･CAMELLIA JAPONICA SEED EXTRACT･LACTOBACILLUS/HIBISCUS SABDARIFFA FLOWER FERMENT FILTRATE･IRIS FLORENTINA ROOT EXTRACT･GANODERMA LUCIDUM (MUSHROOM) STEM EXTRACT･TRIETHYLHEXANOIN･ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER･ALCOHOL･DISODIUM EDTA･POTASSIUM HYDROXIDE･SILICA･ISOCETETH-10･ LINALOOL･SODIUM METABISULFITE･CITRONELLOL･ASPERGILLUS FERMENT･BHT･SODIUM BICARBONATE･ TOCOPHEROL･PHENOXYETHANOL･CHLORPHENESIN･SODIUM BENZOATE･FRAGRANCE (PARFUM)･","fragranceFree":false,"alcoholFree":false,"eoFree":false,"activeIngredients":[],"description":"Antioxidant defense serum with ImuGeneration RED Technology that supports resilience and radiance.","descriptionTH":"เซรั่มต้านอนุมูลอิสระที่มีเทคโนโลยี ImuGeneration RED ที่รองรับความทนทานของผิวและความกระจ่างใส","bestFor":"mature skin, damaged barrier, dull skin. Caution: contains fragrance, contains essential oils, contains alcohol","bestForTH":"ผิวมีริ้วรอย, ผิวแบเรียร์เสีย, ผิวหมองคล้ำ. ระวัง: มีน้ำหอม, มีน้ำมันหอมระเหย, มีแอลกอฮอล์","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance — caution if sensitive.","doNotCombineTH":"มีน้ำหอม — ระวังหากผิวแพ้ง่าย","medicubeMode":"Booster","imageUrl":"https://www.shiseido.com/dw/image/v2/BBSK_PRD/on/demandware.static/-/Sites-itemmaster_shiseido/default/dwac9257fc/images/2025/May/0768614224464_1.jpg?sw=650&amp;sh=650&amp;sm=fit&amp;strip=false","thumbnailUrl":"https://www.shiseido.com/dw/image/v2/BBSK_PRD/on/demandware.static/-/Sites-itemmaster_shiseido/default/dwac9257fc/images/2025/May/0768614224464_1.jpg?sw=650&amp;sh=650&amp;sm=fit&amp;strip=false"},{"id":164,"brand":"Skin1004","name":"Centella Light Cleansing Oil","category":"oil cleanser","subcategory":"cleansing oil","ingredients":"Ethylhexyl Stearate, Cetyl Ethylhexanoate, Sorbeth-30 Tetraoleate, Caprylic/Capric Triglyceride, Citrus Aurantium Bergamia (Bergamot) Fruit Oil, Centella Asiatica Extract, Simmondsia Chinensis (Jojoba) Seed Oil, Olea Europaea (Olive) Fruit Oil, Helianthus Annuus (Sunflower) Seed Oil, Ethylhexylglycerin, Pelargonium Graveolens Flower Oil, Rosa Damascena Flower Oil, Limonene, Linalool","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":["centella"],"description":"Centella-rich lightweight cleansing oil that removes SPF and makeup gently.","descriptionTH":"คลีนซิ่งออยล์น้ำหนักเบาที่อุดมด้วยเซนเทลลา ลบครีมกันแดดและเครื่องสำอางเบาๆ","bestFor":"All skin types — gentle oil cleansing. Caution: contains essential oils","bestForTH":"ผิวทุกประเภท — ทำความสะอาดอย่างอ่อนโยน. ระวัง: มีน้ำมันหอมระเหย","howOften":"PM daily as first cleanse","howOftenTH":"ตอนเย็น ทุกวัน เป็นขั้นตอนทำความสะอาดแรก","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0590/4538/0253/files/skin1004-cleanser-centella-light-cleansing-oil-42321970594038.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0590/4538/0253/files/skin1004-cleanser-centella-light-cleansing-oil-42321970594038.jpg"},{"id":165,"brand":"Skin1004","name":"Hyalu-Cica Water-Fit Sun Serum UV","category":"sunscreen","ingredients":"Active ingredients: Avobenzone* 2.7%, Homosalate 13.6%, Octisalate* 4.5%, Octocrylene 9%\nInactive ingredients: Water, Butyloctyl Salicylate, Propanediol, Polymethylsilsesquioxane, C20-22 Alkyl Phosphate, C20-22 Alcohols, Panthenol, 1,2-Hexanediol, Caprylyl Methicone, Pentylene Glycol, Dimethicone/Vinyl Dimethicone Crosspolymer, Cetyl Alcohol, Vp/Eicosene Copolymer, Glyceryl Stearate, Tromethamine, Polyacrylate Crosspolymer-6, Ammonium Acryloyldimethyltaurate/Vp Copolymer, Silica, Butylene Glycol, Centella Asiatica Extract, Ethylhexylglycerin, Hydrolyzed Sodium Hyaluronate, Sodium Hyaluronate, Tocopherol, Glycerin, Portulaca Oleracea Extract, Camellia Sinensis Leaf Extract, Hyaluronic Acid, Oryza Sativa (Rice) Extract, Avena Sativa (Oat) Meal Extract, Glycine Max (Soybean) Seed Extract","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella"],"description":"Fragrance- and alcohol-free chemical SPF50+/PA++++ serum sunscreen with centella and HA. Non-comedogenic. Global/Korean version uses next-gen organic filters.","descriptionTH":"เซรั่มครีมกันแดดเคมี SPF50+/PA++++ ปราศจากน้ำหอมและแอลกอฮอล์ที่มีเซนเทลลาและ HA ไม่อุดรูขุมขน","bestFor":"sensitive, redness-prone, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวหมองคล้ำ","howOften":"AM daily, reapply every 2h","howOftenTH":"ทุกเช้า ทาซ้ำทุก 2 ชั่วโมง","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0590/4538/0253/files/skin1004-50ml-hyalu-cica-water-fit-sun-serum-uv-1204112543.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0590/4538/0253/files/skin1004-50ml-hyalu-cica-water-fit-sun-serum-uv-1204112543.png"},{"id":166,"brand":"Skin1004","name":"Madagascar Centella Ampoule","category":"serum","ingredients":"Water, Glycerin, Butylene Glycol, Centella Asiatica Extract, 1,2-Hexanediol, Cellulose Gum, Ethylhexylglycerin","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["centella"],"description":"100% madagascar centella asiatica extract ampoule that visibly calms redness and irritation.","descriptionTH":"แอมพูลสารสกัดเซนเทลลา 100% จากมาดากัสการ์ที่ลดรอยแดงและการระคายเคืองที่มองเห็นได้","bestFor":"sensitive, redness-prone","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0590/4538/0253/files/skin1004-ampoule-serum-100ml-60-off-centella-ampoule-100ml-1236473896.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0590/4538/0253/files/skin1004-ampoule-serum-100ml-60-off-centella-ampoule-100ml-1236473896.png"},{"id":167,"brand":"Skin1004","name":"Probio-Cica Enrich Cream","category":"moisturizer","ingredients":"Water, Glycerin, Diglycerin, 1,2-Hexanediol, Butylene Glycol, Niacinamide, Polyglyceryl-3 Distearate, Caprylic/Capric Triglyceride, Neopentyl Glycol Diheptanoate, Hydrogenated Poly(C6-14 Olefin), Isostearyl Isostearate, Pentaerythrityl Tetraisostearate, Heptyl Undecylenate, Bis-Diglyceryl Polyacyladipate-2, Glyceryl Stearate, C14-22 Alcohols, Centella Asiatica Extract, Butyrospermum Parkii (Shea) Butter, Cetearyl Alcohol, Polyglyceryl-2 Stearate, Sodium Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Glyceryl Stearate Citrate, Arginine, Stearyl Alcohol, Polyisobutene, C12-20 Alkyl Glucoside, Squalane, Sodium Polyacrylate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Carbomer, Sodium Surfactin, Hydroxystearic Acid, Ethylhexylglycerin, Adenosine, Hydrogenated Lecithin, Sorbitan Oleate, Caprylyl/Capryl Glucoside, Macadamia Ternifolia Seed Oil, Sodium Hyaluronate, Moringa Oleifera Seed Oil, Sodium Phytate, Ceramide NP, Dextrin, Theobroma Cacao (Cocoa) Extract, Glyceryl Acrylate/Acrylic Acid Copolymer, Polyglyceryl-10 Myristate, Phytosphingosine, Stearic Acid, Lactobacillus Ferment, Madecassic Acid, Asiaticoside, Sucrose Distearate, Asiatic Acid, Phytosterols, Lauric Acid, Polyglutamic Acid","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","niacinamide","ceramides"],"description":"Fragrance-free fermented centella, ceramide NP and shea butter cream that strengthens the barrier.","descriptionTH":"ครีมเซนเทลลาหมัก เซราไมด์ NP และเชียบัตเตอร์ปราศจากน้ำหอมที่เสริมสร้างเกราะผิว","bestFor":"sensitive, redness-prone, damaged barrier, dry, dull skin, mature skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0590/4538/0253/files/skin1004-cream-probio-cica-enrich-cream-40032154747126.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0590/4538/0253/files/skin1004-cream-probio-cica-enrich-cream-40032154747126.png"},{"id":168,"brand":"Skin1004","name":"Tea-Trica Relief Ampoule","category":"serum","ingredients":"Water, Melaleuca Alternifolia (Tea Tree) Leaf Water(94,000ppm), Glycerin, Butylene Glycol, Methyl Gluceth-20, Dipropylene Glycol, Glycereth-26, 1,2-Hexanediol, Centella Asiatica Extract(5,621ppm), Hydroxyacetophenone, Ammonium Acryloyldimethyltaurate/VP Copolymer, Propanediol, Polyglyceryl-10 Laurate, Ethylhexylglycerin, Pentylene Glycol, Caprylyl Glycol, Pinus Palustris Leaf Extract, Chamaecyparis Obtusa Water, Disodium EDTA, Melaleuca Alternifolia (Tea Tree) Leaf Oil(200ppm), Oenothera Biennis (Evening Primrose) Flower Extract, Pueraria Lobata Root Extract, Ulmus Davidiana Root Extract","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":["centella"],"description":"Non-comedogenic ampoule with 55% centella extract, 9.4% Melaleuca Alternifolia (tea tree) leaf water and 200ppm tea tree leaf oil that calms breakouts and inflammation.","descriptionTH":"แอมพูลไม่อุดรูขุมขนที่มีสารสกัดเซนเทลลา 55% น้ำใบชาเขียว 9.4% และน้ำมันชาเขียว 200ppm ที่บรรเทาสิวและการอักเสบ","bestFor":"acne-prone. Caution: contains essential oils","bestForTH":"ผิวเป็นสิว. ระวัง: มีน้ำมันหอมระเหย","howOften":"AM + PM daily on affected areas","howOftenTH":"เช้า-เย็น ทุกวันบริเวณที่ต้องการ","doNotCombine":"Caution if tea tree-sensitive; avoid layering with strong retinol same session.","doNotCombineTH":"ระวังหากแพ้ชาเขียว หลีกเลี่ยงการเลเยอร์กับเรตินอลแรงในครั้งเดียวกัน","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0590/4538/0253/products/skin1004-ampoule-serum-100ml-tea-trica-relief-ampoule-38642934055158.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0590/4538/0253/products/skin1004-ampoule-serum-100ml-tea-trica-relief-ampoule-38642934055158.png"},{"id":169,"brand":"Sulwhasoo","name":"Concentrated Ginseng Rejuvenating Eye Cream","category":"eye","ingredients":"WATER / AQUA / EAU, SQUALANE, BUTYLENE GLYCOL, POLYGLYCERYL-3 METHYLGLUCOSE DISTEARATE, DIMETHICONE, CETYL ETHYLHEXANOATE, PROPANEDIOL, GLYCERYL STEARATE, CETEARYL ALCOHOL, PHYTOSTERYL ISOSTEARYL DIMER DILINOLEATE, BEHENYL ALCOHOL, 1,2-HEXANEDIOL, GLYCERIN, HYDROGENATED CASTOR OIL ISOSTEARATE, PANAX GINSENG ROOT WATER, POLYACRYLATE-13, SILICA, AMMONIUM ACRYLOYLDIMETHYLTAURATE/BEHENETH-25 METHACRYLATE CROSSPOLYMER, POLYISOBUTENE, FRAGRANCE / PARFUM, HYDROLYZED GINSENG SAPONINS, GLYCERYL CAPRYLATE, GLYCINE SOJA (SOYBEAN) OIL, POLYMETHYL METHACRYLATE, ETHYLHEXYLGLYCERIN, SODIUM METAPHOSPHATE, POLYSORBATE 20, THYMOL TRIMETHOXYCINNAMATE, SORBITAN ISOSTEARATE, DEXTRIN, THEOBROMA CACAO (COCOA) EXTRACT, LINALOOL, RETINOL, MANNITOL, PANAX GINSENG ROOT EXTRACT, SODIUM CHLORIDE, LIMONENE, REHMANNIA GLUTINOSA ROOT EXTRACT, PAEONIA LACTIFLORA ROOT EXTRACT, PANAX GINSENG FLOWER EXTRACT, POLYGONATUM ODORATUM RHIZOME EXTRACT, NELUMBO NUCIFERA FLOWER EXTRACT, LILIUM TIGRINUM BULB EXTRACT, CAPRYLYL GLYCOL, TOCOPHEROL, ACETYL HEPTAPEPTIDE-4, ACETYL TETRAPEPTIDE-11, HEXAPEPTIDE-9, ACETYL HEXAPEPTIDE-8, SODIUM HYDROXIDE, ACETYL OCTAPEPTIDE-3","fragranceFree":false,"alcoholFree":true,"eoFree":false,"activeIngredients":["retinol","peptides"],"description":"Luxury ginseng-based anti-aging eye cream that targets wrinkles and dark circles.","descriptionTH":"ครีมรอบดวงตาต้านริ้วรอยระดับหรูที่มีโสมเป็นหลัก มุ่งเป้าที่ริ้วรอยและรอยคล้ำใต้ตา","bestFor":"mature skin, fine lines. Caution: contains fragrance, contains essential oils, avoid during pregnancy","bestForTH":"ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: มีน้ำหอม, มีน้ำมันหอมระเหย, ห้ามใช้ระหว่างตั้งครรภ์","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance.","doNotCombineTH":"มีน้ำหอม","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0249/8399/4413/files/Brand.com_1080x1080_NewCGREyeCream_01.Packshot_15ml.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0249/8399/4413/files/Brand.com_1080x1080_NewCGREyeCream_01.Packshot_15ml.jpg"},{"id":170,"brand":"Sulwhasoo","name":"First Care Activating Eye Serum","category":"eye","ingredients":"WATER / AQUA / EAU, GLYCERIN, METHYL GLUCETH-20, PROPANEDIOL, 1,2-HEXANEDIOL, SQUALANE, ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER, TROMETHAMINE, BUTYLENE GLYCOL, GLYCERYL POLYMETHACRYLATE, DIMETHICONE, XYLITOL, PULLULAN, SODIUM POLYACRYLOYLDIMETHYL TAURATE, BORON NITRIDE, CETEARYL ALCOHOL, ETHYLHEXYLGLYCERIN, GLYCERYL CAPRYLATE, PECTIN, SCUTELLARIA BAICALENSIS ROOT EXTRACT, XANTHAN GUM, CALCIUM CHLORIDE, ADENOSINE, FRAGRANCE / PARFUM, DEXTRIN, THEOBROMA CACAO (COCOA) EXTRACT, LIMONENE, POLYMETHYLSILSESQUIOXANE, SODIUM METAPHOSPHATE, PANAX GINSENG ROOT EXTRACT, ZEA MAYS (CORN) KERNEL EXTRACT, CAFFEINE, ASCORBYL TETRAISOPALMITATE, SODIUM HYALURONATE, DIPOTASSIUM GLYCYRRHIZATE, LINALOOL, REHMANNIA GLUTINOSA ROOT EXTRACT, PAEONIA LACTIFLORA ROOT EXTRACT, ZIZIPHUS JUJUBA FRUIT EXTRACT, POLYGONATUM ODORATUM RHIZOME EXTRACT, CITRONELLOL, NELUMBO NUCIFERA FLOWER EXTRACT, LILIUM TIGRINUM BULB EXTRACT, CYANOCOBALAMIN, GLYCYRRHIZA GLABRA (LICORICE) ROOT EXTRACT, CAMELLIA SINENSIS LEAF EXTRACT, TOCOPHEROL, CAPRYLYL GLYCOL, HYDROLYZED DNA, ACETYL HEPTAPEPTIDE-4, ACETYL HEXAPEPTIDE-8, SODIUM HYDROXIDE, ACETYL OCTAPEPTIDE-3","fragranceFree":false,"alcoholFree":true,"eoFree":false,"activeIngredients":["vitamin c","hyaluronic acid","peptides"],"description":"First-step ginseng eye serum that hydrates, brightens and preps the eye area.","descriptionTH":"เซรั่มรอบดวงตาขั้นตอนแรกที่มีโสม ให้ความชุ่มชื้น เพิ่มความกระจ่างใส และเตรียมบริเวณตา","bestFor":"dry, dull skin, hyperpigmentation, mature skin, fine lines. Caution: contains fragrance, contains essential oils","bestForTH":"ผิวแห้ง, ผิวหมองคล้ำ, จุดด่างดำ, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: มีน้ำหอม, มีน้ำมันหอมระเหย","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Contains fragrance.","doNotCombineTH":"มีน้ำหอม","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0249/8399/4413/files/FCASEyeSerumThumbnail_THUMBNAIL_1080px1_1ratio.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0249/8399/4413/files/FCASEyeSerumThumbnail_THUMBNAIL_1080px1_1ratio.jpg"},{"id":171,"brand":"The Inkey List","name":"10% Niacinamide Serum","category":"serum","ingredients":"Water (Aqua / Eau), Niacinamide, Glycerin, Propanediol, Butylene Glycol, Phenoxyethanol, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Hydroxyethylcellulose, Phospholipids, Squalane, Xanthan Gum, Glycine Soja (Soybean) Oil, Allantoin, Sodium Phytate, Polysorbate 60, Panthenol, Glycolipids, Leuconostoc/Radish Root Ferment Filtrate, Sorbitan Isostearate, Glycine Soja (Soybean) Sterols, Citric Acid, Hyaluronic Acid, Disodium Phosphate, Sodium Phosphate.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","niacinamide"],"description":"Affordable 10% niacinamide + 1% hyaluronic acid serum for pores, oil control and tone.","descriptionTH":"เซรั่มไนอาซินาไมด์ 10% + ไฮยาลูโรนิกแอซิด 1% ราคาประหยัดสำหรับรูขุมขน การควบคุมน้ำมัน และสีผิว","bestFor":"sensitive, redness-prone, dry, oily, combination, dull skin","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Avoid same session with strong vitamin C.","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับวิตามินซีเข้มข้น","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0370/9111/5143/products/TheINKEYList_NiacinamideSerum_30mlbottle_1000x1000_5c1f85db-53c9-48cd-975e-e70371e617a1.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0370/9111/5143/products/TheINKEYList_NiacinamideSerum_30mlbottle_1000x1000_5c1f85db-53c9-48cd-975e-e70371e617a1.png"},{"id":172,"brand":"The Inkey List","name":"Hyaluronic Acid Serum","category":"serum","ingredients":"Water (Aqua/Eau), Propanediol, Sodium Hyaluronate, Glycerin, Butylene Glycol, Phenoxyethanol, Ammonium Acryloyldimethyltaurate/Vp Copolymer, Leuconostoc/Radish Root Ferment Filtrate, Hyaluronic Acid, Carbomer, Sodium Lactate, Polysorbate 20, Palmitoyl Tetrapeptide-7, Palmitoyl Tripeptide-1.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","peptides"],"description":"Lightweight 2% HA serum that delivers immediate hydration and plumping.","descriptionTH":"เซรั่ม HA 2% น้ำหนักเบาที่ให้ความชุ่มชื้นและการเติมเต็มทันที","bestFor":"dry, mature skin, fine lines","bestForTH":"ผิวแห้ง, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://cdn.shopify.com/s/files/1/0370/9111/5143/files/HA_60ML_Packshot-Primary_75d44a8b-f652-4537-a699-74b21b59d9ea.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0370/9111/5143/files/HA_60ML_Packshot-Primary_75d44a8b-f652-4537-a699-74b21b59d9ea.png"},{"id":173,"brand":"The Inkey List","name":"Retinol Serum","category":"serum","ingredients":"Water (Aqua / Eau), Glycerin, Butylene Glycol, Propanediol, Dicaprylyl Carbonate, Retinyl Acetate, Dimethicone, Phenoxyethanol, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Caprylyl Glycol, Phospholipids, Squalane, Glycine Soja (Soybean) Oil, Carbomer, Polysorbate 60, Tocopheryl Acetate, Glycolipids, Sodium Hydroxide, Sodium Phytate, Sorbitan Isostearate, Glycine Soja (Soybean) Sterols, Tetrahexyldecyl Ascorbate, Leuconostoc/Radish Root Ferment Filtrate, Hyaluronic Acid, Sodium Lactate, Tocopherol, Polysorbate 20, Palmitoyl Tetrapeptide-7, Palmitoyl Tripeptide-1","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["retinol","hyaluronic acid","peptides"],"description":"Beginner-friendly stabilized retinol + squalane serum for fine lines and uneven texture.","descriptionTH":"เซรั่มเรตินอลที่เสถียรและสควาเลน เหมาะสำหรับผู้เริ่มต้น ใช้สำหรับริ้วรอยและพื้นผิวไม่สม่ำเสมอ","bestFor":"dry, mature skin, fine lines. Caution: avoid during pregnancy","bestForTH":"ผิวแห้ง, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: ห้ามใช้ระหว่างตั้งครรภ์","howOften":"PM, start 2-3x/week","howOftenTH":"ตอนเย็น เริ่ม 2-3 ครั้ง/สัปดาห์","doNotCombine":"Same session with AHA/BHA, vitamin C, BP; avoid in pregnancy.","doNotCombineTH":"หลีกเลี่ยงการใช้ร่วมกับ AHA/BHA วิตามินซี BP ในครั้งเดียวกัน หลีกเลี่ยงระหว่างตั้งครรภ์","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0370/9111/5143/files/Packshot.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0370/9111/5143/files/Packshot.png"},{"id":174,"brand":"The Inkey List","name":"Salicylic Acid Cleanser","category":"cleanser","ingredients":"Water (Aqua/Eau), Propanediol, Glycerin, Sodium Methyl Cocoyl Taurate, Cocamidopropyl Betaine, PEG-120 Methyl Glucose Dioleate, Salicylic Acid, PEG-150 Pentaerythrityl Tetrastearate, PEG-6 Caprylic/Capric Glycerides, Betaine, Zinc PCA, Phenoxyethanol, Sodium Chloride, Allantoin, Sodium Hydroxide, Coco-Glucoside, Glyceryl Oleate, Benzyl Alcohol, Coconut Acid, Ethylhexylglycerin, Sodium Benzoate, Citric Acid, Dehydroacetic Acid, Trisodium Ethylenediamine Disuccinate, Tocopherol, Hydrogenated Palm Glycerides Citrate.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["bha"],"description":"2% salicylic acid foaming cleanser that targets oil and clogged pores.","descriptionTH":"คลีนเซอร์โฟมกรดซาลิไซลิก 2% ที่มุ่งเป้าที่น้ำมันและรูขุมขนอุดตัน","bestFor":"acne-prone","bestForTH":"ผิวเป็นสิว","howOften":"AM or PM daily","howOftenTH":"เช้าหรือเย็น ทุกวัน","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0370/9111/5143/products/TheINKEYList_SalicylicAcidCleaser_150mlbottle_englishandfrenchUK_1000x1000_560cec04-3b92-4259-b0fb-a93d9318eaee.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0370/9111/5143/products/TheINKEYList_SalicylicAcidCleaser_150mlbottle_englishandfrenchUK_1000x1000_560cec04-3b92-4259-b0fb-a93d9318eaee.png"},{"id":175,"imageUrl":"https://static.thcdn.com/productimg/original/11382032-2335216249641545.jpg","brand":"The Ordinary","name":"Azelaic Acid Suspension 10%","category":"serum","ingredients":"Aqua (Water), Isodecyl Neopentanoate, Dimethicone, Azelaic Acid, Dimethicone/Bis-Isobutyl Ppg-20 Crosspolymer, Dimethyl Isosorbide, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Polysilicone-11, Isohexadecane, Tocopherol, Trisodium Ethylenediamine Disuccinate, Isoceteth-20, Polysorbate 60, Triethanolamine, Ethoxydiglycol, Phenoxyethanol, Chlorphenesin.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["azelaic acid"],"description":"Affordable 10% azelaic acid silicone gel that evens tone and reduces redness.","descriptionTH":"เจลซิลิโคนกรดอาเซลาอิก 10% ราคาประหยัดที่ปรับสีผิวให้สม่ำเสมอและลดรอยแดง","bestFor":"oily, combination, dull skin, hyperpigmentation","bestForTH":"ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, จุดด่างดำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Caution layering with strong retinol/AHA same session.","doNotCombineTH":"ระวังการเลเยอร์กับเรตินอลแรง/AHA ในครั้งเดียวกัน","medicubeMode":"None","imageUrl":"https://theordinary.com/on/demandware.static/-/Library-Sites-DeciemSharedLibrary/default/dw665025d6/theordinary/homepage/slotA/heroes-slot-a-mobile.jpg","thumbnailUrl":"https://static.thcdn.com/productimg/original/11382032-2335216249641545.jpg"},{"id":176,"imageUrl":"https://static.thcdn.com/productimg/original/11429303-5575317607540019.jpg","brand":"The Ordinary","name":"Glycolic Acid 7% Exfoliating Toner","category":"toner","ingredients":"Aqua (Water), Glycolic Acid, Rosa Damascena Flower Water, Centaurea Cyanus Flower Water, Aloe Barbadensis Leaf Water, Propanediol, Glycerin, Triethanolamine, Aminomethyl Propanol, Panax Ginseng Root Extract, Tasmannia Lanceolata Fruit/Leaf Extract, Aspartic Acid, Alanine, Glycine, Serine, Valine, Isoleucine, Proline, Threonine, Histidine, Phenylalanine, Glutamic Acid, Arginine, Pca, Sodium Pca, Sodium Lactate, Fructose, Glucose, Sucrose, Urea, Hexyl Nicotinate, Dextrin, Citric Acid, Polysorbate 20, Gellan Gum, Trisodium Ethylenediamine Disuccinate, Sodium Chloride, Hexylene Glycol, Potassium Sorbate, Sodium Benzoate, 1,2-Hexanediol, Caprylyl Glycol.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["aha"],"description":"7% glycolic acid + amino acid toner that resurfaces and brightens.","descriptionTH":"โทนเนอร์กรดไกลโคลิก 7% + กรดอะมิโนที่ผลัดเซลล์ผิวและเพิ่มความกระจ่างใส","bestFor":"oily, acne-prone","bestForTH":"ผิวมัน, ผิวเป็นสิว","howOften":"PM daily or alternate","howOftenTH":"ตอนเย็น ทุกวันหรือวันเว้นวัน","doNotCombine":"Same session with retinol, vitamin C, other AHA/BHA — avoid.","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับเรตินอล วิตามินซี AHA/BHA อื่น","medicubeMode":"None","imageUrl":"https://theordinary.com/on/demandware.static/-/Library-Sites-DeciemSharedLibrary/default/dw665025d6/theordinary/homepage/slotA/heroes-slot-a-mobile.jpg","thumbnailUrl":"https://static.thcdn.com/productimg/original/11429303-5575317607540019.jpg"},{"id":177,"imageUrl":"https://static.thcdn.com/productimg/original/15061690-2175232040524468.jpg","brand":"The Ordinary","name":"Hyaluronic Acid 2% + B5 (with Ceramides)","category":"serum","ingredients":"Aqua (Water), Sodium Hyaluronate, Propanediol, Pentylene Glycol, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate Crosspolymer, Phospholipids, Sphingolipids, Panthenol, Ahnfeltiopsis Concinna Extract, Glycerin, Polysorbate 20, Citric Acid, Sodium Citrate, p-Anisic Acid, Tocopherol, Trisodium Ethylenediamine Disuccinate, Caprylyl Glycol, Ethoxydiglycol, Ethylhexylglycerin, Hexylene Glycol, Phenoxyethanol, Chlorphenesin.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid"],"description":"Multi-weight HA + B5 + ceramides hydrating serum (newer reformulated version with ceramides).","descriptionTH":"เซรั่มให้ความชุ่มชื้นที่มี HA น้ำหนักโมเลกุลหลายชนิด + B5 + เซราไมด์ (เวอร์ชั่นสูตรใหม่ที่มีเซราไมด์)","bestFor":"sensitive, redness-prone, damaged barrier, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","imageUrl":"https://theordinary.com/on/demandware.static/-/Library-Sites-DeciemSharedLibrary/default/dw665025d6/theordinary/homepage/slotA/heroes-slot-a-mobile.jpg","thumbnailUrl":"https://static.thcdn.com/productimg/original/15061690-2175232040524468.jpg"},{"id":178,"imageUrl":"https://static.thcdn.com/productimg/original/14853143-8055328247994844.jpg","brand":"The Ordinary","name":"Multi-Peptide + Copper Peptides 1% Serum","category":"serum","ingredients":"Aqua (Water), Glycerin, Lactococcus Ferment Lysate, Copper Tripeptide-1, Acetyl Hexapeptide-8, Pentapeptide-18, Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7, Palmitoyl Tripeptide-38, Dipeptide Diaminobutyroyl Benzylamide Diacetate, Acetylarginyltryptophyl Diphenylglycine, Sodium Hyaluronate Crosspolymer, Sodium Hyaluronate, Allantoin, Glycine, Alanine, Serine, Valine, Isoleucine, Proline, Threonine, Histidine, Phenylalanine, Arginine, Aspartic Acid, Trehalose, Fructose, Glucose, Maltose, Urea, Sodium Pca, Pca, Sodium Lactate, Citric Acid, Hydroxypropyl Cyclodextrin, Sodium Chloride, Sodium Hydroxide, Butylene Glycol, Pentylene Glycol, Acacia Senegal Gum, Xanthan Gum, Carbomer, Polysorbate 20, Dimethyl Isosorbide, Sodium Benzoate, Caprylyl Glycol, Ethylhexylglycerin, Phenoxyethanol, Chlorphenesin.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","peptides"],"description":"Multi-peptide + 1% copper peptide serum that supports firmness and elasticity (formerly Buffet + Copper Peptides).","descriptionTH":"เปปไทด์หลายชนิด + เซรั่มคอปเปอร์เปปไทด์ 1% ที่รองรับความกระชับและความยืดหยุ่น (เดิมชื่อ Buffet + Copper Peptides)","bestFor":"sensitive, redness-prone, dry, mature skin, fine lines","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง, ผิวมีริ้วรอย, ริ้วรอยตื้น","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Avoid same session with high-% vitamin C, strong AHA/retinol.","doNotCombineTH":"หลีกเลี่ยงการใช้ในครั้งเดียวกับวิตามินซีเข้มข้น AHA แรง/เรตินอล","medicubeMode":"Booster","imageUrl":"https://theordinary.com/on/demandware.static/-/Library-Sites-DeciemSharedLibrary/default/dw665025d6/theordinary/homepage/slotA/heroes-slot-a-mobile.jpg","thumbnailUrl":"https://static.thcdn.com/productimg/original/14853143-8055328247994844.jpg"},{"id":179,"imageUrl":"https://static.thcdn.com/productimg/original/13187076-1905317607695014.jpg","brand":"The Ordinary","name":"Niacinamide 10% + Zinc 1%","category":"serum","ingredients":"Aqua (Water), Niacinamide, Pentylene Glycol, Zinc PCA, Dimethyl Isosorbide, Tamarindus Indica Seed Gum, Xanthan Gum, Isoceteth-20, Ethoxydiglycol, Phenoxyethanol, Chlorphenesin.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide"],"description":"Iconic affordable niacinamide + zinc serum that targets blemishes and pore appearance.","descriptionTH":"เซรั่มไนอาซินาไมด์ + สังกะสีราคาประหยัดที่เป็นสัญลักษณ์ มุ่งเป้าที่สิวและรูขุมขน","bestFor":"oily, combination, acne-prone, dull skin","bestForTH":"ผิวมัน, ผิวผสม, ผิวเป็นสิว, ผิวหมองคล้ำ","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"Do not pair with direct or indirect vitamin C in same session — can reduce effectiveness of both.","doNotCombineTH":"ห้ามจับคู่กับวิตามินซีโดยตรงหรือโดยอ้อมในครั้งเดียวกัน อาจลดประสิทธิภาพของทั้งคู่","medicubeMode":"Booster","imageUrl":"https://theordinary.com/on/demandware.static/-/Library-Sites-DeciemSharedLibrary/default/dw665025d6/theordinary/homepage/slotA/heroes-slot-a-mobile.jpg","thumbnailUrl":"https://static.thcdn.com/productimg/original/13187076-1905317607695014.jpg"},{"id":180,"imageUrl":"https://static.thcdn.com/productimg/original/15068150-1925328241357452.jpg","brand":"The Ordinary","name":"Retinal 0.2% Emulsion","category":"serum","ingredients":"Aqua (Water), Coco-Caprylate/Caprate, Propanediol, Pentylene Glycol, Hydroxyapatite, Retinal, Cetylhydroxyproline Palmitamide, 4-t-Butylcyclohexanol, Hydroxyphenyl Propamidobenzoic Acid, Ergothioneine, Biosaccharide Gum-1, Bisabolol, Brassica Campestris Sterols, Zingiber Officinale Root Extract, Butylene Glycol, Isohexadecane, Hexyldecanol, Maltodextrin, Caesalpinia Spinosa Gum, Polyacrylate Crosspolymer-6, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Stearic Acid, Isoceteth-20, Polysorbate 60, Ascorbyl Palmitate, Tocopherol, Lactic Acid, Sodium Lactate, Sodium Hydroxide, Ethylhexylglycerin, Phenoxyethanol, Chlorphenesin.","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["retinol","vitamin c"],"description":"0.2% retinaldehyde + cica + squalane emulsion that smooths fine lines with relatively low irritation.","descriptionTH":"อีมัลชั่นเรตินาลดีไฮด์ 0.2% + cica + สควาเลนที่เรียบริ้วรอยโดยมีการระคายเคืองค่อนข้างน้อย","bestFor":"oily, mature skin, fine lines. Caution: avoid during pregnancy","bestForTH":"ผิวมัน, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: ห้ามใช้ระหว่างตั้งครรภ์","howOften":"PM, start 2-3x/week","howOftenTH":"ตอนเย็น เริ่ม 2-3 ครั้ง/สัปดาห์","doNotCombine":"Same session with AHA/BHA, vitamin C, BP; avoid in pregnancy.","doNotCombineTH":"หลีกเลี่ยงการใช้ร่วมกับ AHA/BHA วิตามินซี BP ในครั้งเดียวกัน หลีกเลี่ยงระหว่างตั้งครรภ์","medicubeMode":"None","imageUrl":"https://theordinary.com/on/demandware.static/-/Library-Sites-DeciemSharedLibrary/default/dw665025d6/theordinary/homepage/slotA/heroes-slot-a-mobile.jpg","thumbnailUrl":"https://static.thcdn.com/productimg/original/15068150-1925328241357452.jpg"},{"id":181,"brand":"Torriden","name":"Balanceful Toner Pads","category":"toner","ingredients":"Water, Dipropylene Glycol, Butylene Glycol, Gluconolactone, Panthenol, Allantoin, Sodium Hyaluronate, Centella Asiatica Extract, Madecassoside, Asiatic Acid, Madecassic Acid, Asiaticoside, Capryloyl Salicylic Acid, Hamamelis Virginiana (Witch Hazel) Extract, Althaea Rosea Flower Extract, Nymphaea Caerulea Flower Extract, Swertia Japonica Extract, Lactobacillus Ferment, Glycerin, Hydroxyacetophenone, Pantolactone, Polyglyceryl-10 Laurate, Glyceryl Acrylate/Acrylic Acid Copolymer, PVM/MA Copolymer, Hydrogenated Phosphatidylcholine, Sucrose Stearate, Sodium Guaiazulene Sulfonate, Caprylic/Capric Triglyceride, Caprylyl Glycol, Cholesterol, Arginine, Melia Azadirachta Flower Extract, Melia Azadirachta Leaf Extract, Dipotassium Glycyrrhizate, 1,2-Hexanediol, Disodium EDTA, Ethylhexylglycerin","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","bha"],"description":"PHA/LHA/AHA-soaked toner pads with centella and birch sap that gently exfoliate and balance.","descriptionTH":"แผ่นโทนเนอร์ที่แช่ด้วย PHA/LHA/AHA พร้อมเซนเทลลาและน้ำต้นเบิร์ชที่ผลัดเซลล์ผิวเบาๆ และปรับสมดุลผิว","bestFor":"dry, oily, acne-prone, dull skin, mature skin","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวเป็นสิว, ผิวหมองคล้ำ, ผิวมีริ้วรอย","howOften":"PM daily or 3-4x/week","howOftenTH":"ตอนเย็น ทุกวันหรือ 3-4 ครั้ง/สัปดาห์","doNotCombine":"Caution same session with retinol, strong actives.","doNotCombineTH":"ระวังการใช้ในครั้งเดียวกับเรตินอล สารออกฤทธิ์แรง","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0920/1644/3758/files/01_99b3b498-7ff6-4b24-89ef-1b788f112395.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0920/1644/3758/files/01_99b3b498-7ff6-4b24-89ef-1b788f112395.jpg"},{"id":182,"brand":"Torriden","name":"DIVE IN Soothing Cream","category":"moisturizer","ingredients":"Water, Butylene Glycol, Glycerin, 1,2-Hexanediol, Hydrogenated Didecene, Allantoin, Trehalose, Hamamelis Virginiana (Witch Hazel) Extract, Panthenol, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate, Sodium Hyaluronate Crosspolymer, Sodium Acetylated Hyaluronate, Hydrolyzed Sodium Hyaluronate, Glyceryl Acrylate/Acrylic Acid Copolymer, PVM/MA Copolymer, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, 2,3-Butanediol, Cetearyl Alcohol, C14-22 Alcohols, C12-20 Alkyl Glucoside, Pentylene Glycol, Sorbitan Isostearate, Caprylic/Capric Triglyceride, Melia Azadirachta Leaf Extract, Melia Azadirachta Flower Extract, Coccinia Indica Fruit Extract, Solanum Melongena (Eggplant) Fruit Extract, Ocimum Sanctum Leaf Extract, Curcuma Longa (Turmeric) Root Extract, Corallina Officinalis Extract, Salvia Sclarea (Clary) Extract, Lavandula Angustifolia (Lavender) Flower Extract, Hyacinthus Orientalis (Hyacinth) Extract, Chamomilla Recutita (Matricaria) Flower Extract, Centaurea Cyanus Flower Extract, Borago Officinalis Extract, Disodium EDTA, Carbomer, Tromethamine, Xanthan Gum, Glutathione, Malachite Extract, Ethylhexylglycerin","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid"],"description":"Fragrance-free 5-type HA cream with centella that hydrates and calms reactive skin.","descriptionTH":"ครีม HA 5 ชนิดปราศจากน้ำหอมที่มีเซนเทลลา ให้ความชุ่มชื้นและบรรเทาผิวระคายเคืองง่าย","bestFor":"sensitive, redness-prone, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแห้ง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"MC","imageUrl":"https://cdn.shopify.com/s/files/1/0920/1644/3758/files/DIVEINSoothingCream-jar-1_64bb3003-ef23-44bd-bb46-0f50fae2eee7.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0920/1644/3758/files/DIVEINSoothingCream-jar-1_64bb3003-ef23-44bd-bb46-0f50fae2eee7.jpg"},{"id":183,"brand":"Torriden","name":"Dive-In Serum","category":"serum","ingredients":"Water, Butylene Glycol, Glycerin, Dipropylene Glycol, 1,2-Hexanediol, Panthenol, Sodium Hyaluronate, Hydrolyzed Hyaluronic Acid, Sodium Acetylated Hyaluronate, Sodium Hyaluronate Crosspolymer, Hydrolyzed Sodium Hyaluronate, Allantoin, Trehalose, Betaine, Propanediol, Portulaca Oleracea Extract, Hamamelis Virginiana (Witch Hazel) Leaf Extract, Madecassoside, Madecassic Acid, Ceramide NP, Beta-Glucan, Malachite Extract, Cholesterol, Pentylene Glycol, Glyceryl Acrylate/Acrylic Acid Copolymer, PVM/MA Copolymer, Polyglyceryl-10 Laurate, Xanthan Gum, Tromethamine, Carbomer, Ethylhexylglycerin, Scutellaria Baicalensis Root Extract, Paeonia Suffruticosa Root Extract","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","ceramides"],"description":"Bestselling 5-type low-molecular HA serum that deeply hydrates and plumps. Fragrance-free.","descriptionTH":"เซรั่ม HA โมเลกุลต่ำ 5 ชนิดขายดีที่ให้ความชุ่มชื้นลึกและเติมเต็มผิว ปราศจากน้ำหอม","bestFor":"sensitive, redness-prone, damaged barrier, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Booster","makeupPrep":true,"imageUrl":"https://cdn.shopify.com/s/files/1/0920/1644/3758/files/DIVEINSerum1_631ac0e3-a77b-422a-a806-bf34477cac19.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0920/1644/3758/files/DIVEINSerum1_631ac0e3-a77b-422a-a806-bf34477cac19.jpg"},{"id":184,"brand":"Torriden","name":"SOLID IN Cream","category":"moisturizer","ingredients":"Water, Propanediol, Glycerin, Simmondsia Chinensis (Jojoba) Seed Oil, Caprylic/Capric Triglyceride, Ethylhexyl Palmitate, Panthenol, 1,2-Hexanediol, Glyceryl Stearate, Cetearyl Olivate, Sorbitan Olivate, Hydrogenated Poly(C6-14 Olefin), Ceramide NP, Ceramide NS, Ceramide AS, Ceramide EOP, Ceramide AP, Cholesterol, Allantoin, Glucose, Betaine, Sodium Hyaluronate, Phytosterols, Stearic Acid, Butylene Glycol, Sodium Polyacrylate, Myristyl Glucoside, Polyglycerin-3, C13-16 Isoalkane, Heptyl Undecylenate, Vinyl Dimethicone, Carbomer, Tromethamine, Arachidyl Alcohol, Hydrogenated Lecithin, Polyglyceryl-6 Distearate, Candelilla/Jojoba/Rice Bran Polyglyceryl-3 Esters, Ethylhexylglycerin, Behenyl Alcohol, Lauryl Glucoside, Polyglyceryl-6 Laurate, Disodium EDTA, Dipropylene Glycol, Arachidyl Glucoside, Tocopherol, Adansonia Digitata Seed Oil, Hydrogenated Rice Bran Oil, Coptis Japonica Root Extract","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides"],"description":"Ceramide- and panthenol-rich barrier cream that restores compromised skin.","descriptionTH":"ครีมเสริมสร้างเกราะผิวที่อุดมด้วยเซราไมด์และแพนทีนอลที่ฟื้นฟูผิวที่บกพร่อง","bestFor":"sensitive, redness-prone, damaged barrier, dry","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวแห้ง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","imageUrl":"https://cdn.shopify.com/s/files/1/0920/1644/3758/files/SOLIDINCream1_d93a1bc3-ea6c-4ba8-95f2-51f5077af764.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0920/1644/3758/files/SOLIDINCream1_d93a1bc3-ea6c-4ba8-95f2-51f5077af764.jpg"},{"id":185,"imageUrl":"https://www.vanicream.com/product/images/gentle-facial-cleanser-8-oz-front.jpg","brand":"Vanicream","name":"Gentle Facial Cleanser","category":"cleanser","ingredients":"water, glycerin, coco-glucoside, sodium cocoyl glycinate, acrylates copolymer, caprylyl glycol, mica, sodium chloride, 1,2-hexanediol, titanium dioxide, sodium hydroxide, disodium EDTA","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Fragrance- and dye-free cleanser for highly sensitive, allergy-prone skin. No fragrance, dye, lanolin, paraben, formaldehyde or gluten.","descriptionTH":"คลีนเซอร์ปราศจากน้ำหอมและสีย้อมสำหรับผิวแพ้ง่ายมาก ปราศจากน้ำหอม สีย้อม ลาโนลิน พาราเบน ฟอร์มาลดีไฮด์ หรือกลูเตน","bestFor":"sensitive","bestForTH":"ผิวบอบบาง","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"N/A — wash-off","doNotCombineTH":"ไม่มี — ผลิตภัณฑ์ล้างออก","medicubeMode":"None","thumbnailUrl":"https://www.vanicream.com/product/images/gentle-facial-cleanser-8-oz-front.jpg"},{"id":186,"imageUrl":"https://www.vanicream.com/product/images/pump-tc22o-front.jpg","brand":"Vanicream","name":"Moisturizing Cream","category":"moisturizer","ingredients":"water, petrolatum, sorbitol, cetearyl alcohol, propylene glycol, ceteareth-20, simethicone, glyceryl stearate, PEG-30 stearate, sorbic acid, BHT","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":[],"description":"Bland, fragrance-free thick cream that restores moisture without common irritants (no fragrance, dye, paraben, formaldehyde, lanolin or gluten).","descriptionTH":"ครีมข้นปราศจากน้ำหอมที่ฟื้นฟูความชุ่มชื้นโดยไม่มีสารระคายเคืองทั่วไป (ปราศจากน้ำหอม สีย้อม พาราเบน ฟอร์มาลดีไฮด์ ลาโนลิน หรือกลูเตน)","bestFor":"All skin types","bestForTH":"ผิวทุกประเภท","howOften":"AM + PM daily","howOftenTH":"เช้า-เย็น ทุกวัน","doNotCombine":"No significant conflicts.","doNotCombineTH":"ไม่มีข้อห้ามสำคัญ","medicubeMode":"Derma Shot","thumbnailUrl":"https://www.vanicream.com/product/images/pump-tc22o-front.jpg","makeupPrep":false},{"id":187,"brand":"d’Alba","name":"White Truffle First Spray Serum","category":"serum","ingredients":"Water, Dipropylene Glycol, Neopentyl Glycol Diheptanoate, Glycereth-26, 1,2-Hexanediol, Niacinamide, Sorbitol, Hydroxyethyl Urea, Persea Gratissima (Avocado) Oil, Salvia Hispanica Seed Extract, Ocimum Basilicum (Basil) Flower/Leaf/Stem Extract, Betaine, Avena Sativa (Oat) Kernel Extract, Butylene Glycol, Tuber Magnatum Extract, Glycerin, Helianthus Annuus (Sunflower) Seed Oil, Tocopheryl Acetate, Disodium EDTA, Dipotassium Glycyrrhizate, Adenosine, Sodium Palmitoyl Proline, Bifida Ferment Lysate, Nymphaea Alba Flower Extract, Hydrolyzed Hyaluronic Acid, Glycine Soja (Soybean) Oil, Saussurea Involucrata Extract, Panax Ginseng Root Extract, Nelumbo Nucifera Flower Extract, Morus Alba Bark Extract, Lilium Candidum Flower Extract, Leontopodium Alpinum Extract, Houttuynia Cordata Extract, Freesia Refracta Extract, Carbomer, Bellis Perennis (Daisy) Flower Extract, Arginine, Potassium Sorbate, Bixa Orellana Seed Oil, Tocopherol, Fragrance, Linalool, Hexyl Cinnamal, Limonene, Citronellol","fragranceFree":false,"alcoholFree":true,"eoFree":false,"activeIngredients":["hyaluronic acid","niacinamide"],"description":"Bestselling double-layer spray serum with white truffle, avocado oil and niacinamide for instant glow. Contains added parfum/fragrance (linalool, limonene, citronellol, hexyl cinnamal) — caution if fragrance-sensitive.","descriptionTH":"เซรั่มสเปรย์สองชั้นขายดีที่มีทรัฟเฟิลขาว น้ำมันอะโวคาโด และไนอาซินาไมด์สำหรับความกระจ่างใสทันที มีน้ำหอม (ลินาลูล ลิโมนีน ซิทรอนเนลลอล เฮกซิลซินนามัล) ระวังหากแพ้น้ำหอม","bestFor":"dry, oily, combination, dull skin, mature skin, fine lines. Caution: contains fragrance, contains essential oils","bestForTH":"ผิวแห้ง, ผิวมัน, ผิวผสม, ผิวหมองคล้ำ, ผิวมีริ้วรอย, ริ้วรอยตื้น. ระวัง: มีน้ำหอม, มีน้ำมันหอมระเหย","howOften":"AM + PM and as needed","howOftenTH":"เช้า-เย็น และตามความต้องการ","doNotCombine":"Caution if fragrance-sensitive (linalool, limonene, citronellol).","doNotCombineTH":"ระวังหากแพ้น้ำหอม (ลินาลูล ลิโมนีน ซิทรอนเนลลอล)","medicubeMode":"Booster","makeupPrep":true,"imageUrl":"https://cdn.shopify.com/s/files/1/0591/1094/9047/files/100ml_18802f44-6c65-4476-af0b-7a8e86a25e8c.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0591/1094/9047/files/100ml_18802f44-6c65-4476-af0b-7a8e86a25e8c.png"},{"id":188,"brand":"d’Alba","name":"White Truffle Waterfull Tone-Up Sunscreen SPF 50+","category":"sunscreen","ingredients":"Water, Propanediol, Butyloctyl Salicylate, Caprylic/Capric Triglyceride, 2,3-Butanediol, Methyl Trimethicone, 1,2-Hexanediol, Pentylene Glycol, Glycerin, Coco-Caprylate/Caprate, Polyhydroxystearic Acid, VP/Eicosene Copolymer, Alumina, Stearic Acid, Ammonium Polyacryloyldimethyl Taurate, Citrus Aurantium Dulcis (Orange) Oil, Ammonium Acryloyldimethyltaurate/Vp Copolymer, Polyurethane-15, Inulin Lauryl Carbamate, Hydroxypropyl Methylcellulose Stearoxy Ether, Ethylhexylglycerin, Citrus Nobilis (Mandarin Orange) Peel Oil, Sodium Stearoyl Glutamate, Xanthan Gum, Iron Oxides(CI 77492), Triethoxycaprylylsilane, Sodium Polyacrylate, Iron Oxides(CI 77491), Litsea Cubeba Fruit Oil, T-Butyl Alcohol, Pvm/Ma Copolymer, Sodium Hyaluronate, Methyl Methacrylate Crosspolymer, Polyether-1, BHT, Tocopherol, Glutathione, Ceramide NP, Hydrolyzed Sodium Hyaluronate, Panthenol, Melaleuca Alternifolia (Tea Tree) Leaf Water, Butylene Glycol, Centella Asiatica Leaf Extract, Centella Asiatica Extract","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","ceramides"],"description":"Tone-up chemical sunscreen with white truffle and HA that brightens with a fresh dewy finish.","descriptionTH":"ครีมกันแดดเคมีที่ปรับโทนผิวด้วยทรัฟเฟิลขาวและ HA ที่เพิ่มความกระจ่างใสพร้อมผิวดูมีน้ำมีนวล","bestFor":"sensitive, redness-prone, damaged barrier, acne-prone","bestForTH":"ผิวบอบบาง, ผิวแดงง่าย, ผิวแบเรียร์เสีย, ผิวเป็นสิว","howOften":"AM daily","howOftenTH":"ทุกเช้า","doNotCombine":"N/A","doNotCombineTH":"ไม่มี","medicubeMode":"None","imageUrl":"https://cdn.shopify.com/s/files/1/0591/1094/9047/files/b15aef97dfabe02b4154cfc2d8893c1e.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0591/1094/9047/files/b15aef97dfabe02b4154cfc2d8893c1e.png"},{"id":189,"brand":"AXIS-Y","name":"Dark Spot Correcting Glow Serum","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":false,"activeIngredients":["bha","niacinamide","centella","Centella Asiatica","Niacinamide","Salicylic Acid","Tea Tree Leaf Water","Zinc PCA"],"bestFor":"Acne-prone skin, Oily skin, Combination skin, Blemish-prone skin, Redness-prone skin","bestForTH":"Acne-prone skin, Oily skin, Combination skin, Blemish-prone skin, Redness-prone skin","howOften":"AM & PM","howOftenTH":"AM & PM","description":"A targeted blemish spot treatment formulated with salicylic acid to unclog pores, niacinamide to reduce redness and post-acne marks, and centella asiatica to soothe inflammation. Lightweight gel texture absorbs quickly without residue.","descriptionTH":"A targeted blemish spot treatment formulated with salicylic acid to unclog pores, niacinamide to reduce redness and post-acne marks, and centella asiatica to soothe inflammation. Lightweight gel texture absorbs quickly without residue.","doNotCombine":"Do not combine with other strong exfoliants (AHAs, retinol) in same routine step. Avoid using over broken or irritated skin.","doNotCombineTH":"Do not combine with other strong exfoliants (AHAs, retinol) in same routine step. Avoid using over broken or irritated skin.","medicubeMode":"Booster Mode","makeupPrep":true,"ingredients":"Water, Glycerin, Niacinamide, Sodium Hyaluronate, Propanediol, Erythritol, Butylene Glycol, Squalane, Oryza Sativa (Rice) Bran Extract, Calendula Officinalis Flower Extract, Carica Papaya (Papaya) Fruit Extract, Hippophae Rhamnoides Fruit Extract, Malpighia Glabra (Acerola) Fruit Extract, Polyglyceryl-10 Laurate, Chlorphenesin, Arginine, Ethylhexylglycerin, Carbomer, Glutathione, 1,2-Hexanediol, Hydroxypropyl Cyclodextrin, Disodium EDTA, Hydroxyethylcellulose, Allantoin, Rosmarinus Officinalis (Rosemary) Leaf Oil","sourceUrl":"https://www.axis-y.com/products/dark-spot-correcting-glow-serum","imageUrl":"https://cdn.shopify.com/s/files/1/0578/0157/2530/files/Glow_Serum.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0578/0157/2530/files/Glow_Serum.png"},{"id":190,"brand":"Haruharu Wonder","name":"Black Rice Hyaluronic Anti-wrinkle Serum","category":"serum","fragranceFree":true,"alcoholFree":false,"eoFree":false,"activeIngredients":["niacinamide","hyaluronic acid","peptides","Black Rice Extract","Niacinamide","Adenosine","Sodium Hyaluronate","Peptides"],"bestFor":"Mature skin, Dry skin, Combination skin, Anti-aging, Brightening, Sensitive skin (patch test recommended)","bestForTH":"Mature skin, Dry skin, Combination skin, Anti-aging, Brightening, Sensitive skin (patch test recommended)","howOften":"AM & PM","howOftenTH":"AM & PM","description":"A fermented black rice serum delivering antioxidant-rich nourishment alongside niacinamide for brightening and adenosine for smoothing fine lines. Lightweight serum texture suitable for layering.","descriptionTH":"A fermented black rice serum delivering antioxidant-rich nourishment alongside niacinamide for brightening and adenosine for smoothing fine lines. Lightweight serum texture suitable for layering.","doNotCombine":"Avoid combining with strong AHAs/BHAs in same step. Retinol users: use on alternate nights or PM only.","doNotCombineTH":"Avoid combining with strong AHAs/BHAs in same step. Retinol users: use on alternate nights or PM only.","medicubeMode":"Booster Mode","makeupPrep":false,"ingredients":"Deionized Water, Glycerin, Lecithin, Caprylic/Capric Triglyceride, Camellia Seed Oil, Hydrogenated Lecithin, Helianthus Annuus (Sunflower) Seed Oil, Oryza Sativa (Rice) Extract, Phyllostachys Pubescens Shoot Bark Extract, Aspergillus Ferment, Hyaluronic Acid, Panax Ginseng Root Extract, Cyclodextrin, Sclerotium Gum, C12-16 Alcohols, Palmitic Acid, Alteromonas Ferment Extract, Usnea Barbata (Lichen) Extract, Zanthoxylum Piperitum Fruit Extract, Pulsatilla Koreana Extract, Beta-glucan, 1,2-Hexanediol, Glycine Soja (Soybean) Sterois, Behenyl Alcohol, Simmondsia Chinensis (Jojoba) Seed Oil, Glyceryl Stearate, Sodium Phytate, Tocopherol, Adenosine, Phenethyl Alcohol, Butylene Glycol, Alcohol, Lavandula Angustifolia (Lavender) Oil","sourceUrl":"https://haruharuwonder.com/products/haruharuwonder-black-rice-hyaluronic-anti-wrinkle-serum-50ml","imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/black_rice_hyaluronic_anti-wrinkle_serum_50ml.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/black_rice_hyaluronic_anti-wrinkle_serum_50ml.jpg"},{"id":191,"brand":"Haruharu Wonder","name":"Black Rice 5 Ceramide Barrier Moisturizing Cream","category":"moisturizer","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","hyaluronic acid","ceramides","Black Rice Extract","Ceramide NP","Ceramide NS","Ceramide AS","Ceramide AP","Ceramide EOP","Niacinamide","Sodium Hyaluronate"],"bestFor":"Dry skin, Sensitive skin, Barrier-damaged skin, Mature skin, All skin types, Eczema-prone skin","bestForTH":"Dry skin, Sensitive skin, Barrier-damaged skin, Mature skin, All skin types, Eczema-prone skin","howOften":"AM & PM","howOftenTH":"AM & PM","description":"A rich barrier-repair cream featuring all five ceramide types (NP, NS, AS, AP, EOP) to reinforce the skin's lipid matrix. Black rice extract provides antioxidant protection while niacinamide brightens and evens skin tone. Ideal for restoring compromised skin barriers.","descriptionTH":"A rich barrier-repair cream featuring all five ceramide types (NP, NS, AS, AP, EOP) to reinforce the skin's lipid matrix. Black rice extract provides antioxidant protection while niacinamide brightens and evens skin tone. Ideal for restoring compromised skin barriers.","doNotCombine":"Generally compatible with most actives. Avoid combining with very high-strength retinol in same application step.","doNotCombineTH":"Generally compatible with most actives. Avoid combining with very high-strength retinol in same application step.","medicubeMode":"Derma Shot Mode","makeupPrep":true,"ingredients":"Water, Glycerin, Butylene Glycol, Caprylic/Capric Triglyceride, Dicaprylyl Carbonate, 1,2-Hexanediol, Ceramide NP(10,105ppm), Sodium Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Cetearyl Olivate, Polyisobutene, Hydrogenated Lecithin, Polyglyceryl-3 Distearate, Sorbitan Olivate, Cetearyl Alcohol, Carbomer, Arginine, Mannitol, Stearic Acid, Arachidyl Alcohol, Allantoin, Xanthan Gum, Behenyl Alcohol, Ethylhexylglycerin, Sorbitan Oleate, Caprylyl/Capryl Glucoside, Arachidyl Glucoside, Glyceryl Stearate Citrate, Hydrogenated Olive Oil Decyl Esters, Oryza Sativa (Rice) Extract(200ppm), Phyllostachys Pubescens Shoot Bark Extract, Disodium EDTA, Aspergillus Ferment, Hydrogenated Olive Oil Stearyl Esters, Ceramide NS(15ppm), Phytosphingosine, Cholesterol, Oryza Sativa (Rice) Lees Extract(10ppm), Panax Ginseng Root Extract, Tocopherol, Ceramide AS(5ppm), Ceramide AP(5ppm), Cyclodextrin, Ceramide EOP(0.01ppm)","sourceUrl":"https://haruharuwonder.com/products/haruharuwonder-black-rice-5-ceramide-barrier-moisturizing-cream-50ml","imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/1743404349188_df579c8d68aa4417bca398c890a834e6.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/1743404349188_df579c8d68aa4417bca398c890a834e6.jpg"},{"id":192,"brand":"Haruharu Wonder","name":"Black Rice Moisture 5.5 Soft Cleansing Gel","category":"cleanser","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","centella","Black Rice Extract","Hyaluronic Acid","Centella Asiatica","Amino Acids"],"bestFor":"All skin types, Dry skin, Sensitive skin, Dehydrated skin","bestForTH":"All skin types, Dry skin, Sensitive skin, Dehydrated skin","howOften":"Daily","howOftenTH":"Daily","description":"A gentle gel cleanser that removes impurities without stripping moisture. Enriched with hyaluronic acid and black rice extract, it leaves skin feeling clean, soft, and hydrated after washing. Low-lather, non-foaming formula gentle enough for sensitive skin.","descriptionTH":"A gentle gel cleanser that removes impurities without stripping moisture. Enriched with hyaluronic acid and black rice extract, it leaves skin feeling clean, soft, and hydrated after washing. Low-lather, non-foaming formula gentle enough for sensitive skin.","doNotCombine":"N/A — rinse-off product. Do not mix with other cleansers.","doNotCombineTH":"N/A — rinse-off product. Do not mix with other cleansers.","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Glycerin, Coco-Betaine, Propanediol, Pentylene Glycol, Sodium Chloride, 1,2-Hexanediol, Xanthan Gum, Hydroxyethylcellulose, Potassium Cocoyl Glycinate, Potassium Cocoate, Oryza Sativa (Rice) Extract, Phyllostachys Pubescens Shoot Bark Extract, Panax Ginseng Root Extract, Aspergillus Ferment Extract Filtrate, Beta-Glucan, Butylene Glycol, Trehalose, Citric Acid, Cyclodextrin, Zanthoxylum Piperitum Fruit Extract, Pulsatilla Koreana Extract, Usnea Barbata (Lichen) Extract, Ethylhexylglycerin","sourceUrl":"https://haruharuwonder.com/products/haruharuwonder-black-rice-moisture-5-5-soft-cleansing-gel-100ml","imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/black_rice_moisture_5.5_soft_cleansing_gel_100ml.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/black_rice_moisture_5.5_soft_cleansing_gel_100ml.jpg"},{"id":193,"brand":"Haruharu Wonder","name":"Black Rice Moisture Airyfit Daily Sunscreen SPF50+/PA++++ Unscented","category":"sunscreen","fragranceFree":true,"alcoholFree":false,"eoFree":true,"activeIngredients":["panthenol","niacinamide","centella","Zinc Oxide","Titanium Dioxide","Niacinamide","Panthenol","Centella Asiatica"],"bestFor":"Acne-prone skin, Oily skin, Sensitive skin, Combination skin, All skin types","bestForTH":"Acne-prone skin, Oily skin, Sensitive skin, Combination skin, All skin types","howOften":"Every morning","howOftenTH":"Every morning","description":"A lightweight mineral sunscreen designed for acne-prone and sensitive skin. Zinc oxide and titanium dioxide provide broad-spectrum UV protection without chemical filters. Niacinamide helps control sebum and reduce post-acne marks. Airyfit texture feels comfortable for daily wear.","descriptionTH":"A lightweight mineral sunscreen designed for acne-prone and sensitive skin. Zinc oxide and titanium dioxide provide broad-spectrum UV protection without chemical filters. Niacinamide helps control sebum and reduce post-acne marks. Airyfit texture feels comfortable for daily wear.","doNotCombine":"Do not apply before active serums — use as final step. Not for PM use.","doNotCombineTH":"Do not apply before active serums — use as final step. Not for PM use.","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, DibuyiAdipate Propanedial, Butylocty Salicylate, Ethylhexy/Trazone, Terephthalyidene Dicamphor Sulfonic Acid, Glycerin, Niacinamide, Tromethamine, Polyglycer y/ 3 Distearate, 1,2-Hexanediol, Pentylene Glycol, Diethylamino Hydroxybenzovi Hexyl Benzoate, Ceteary Alcohol, Capryivi Methicone, Polvsilicone-15, Stellaria Media (Chickweed) Extract, Helianthus Annuus (Sunflower) Flower Extract, Vaccinium Vitis-idata Fruit Extract, Oryza Sativa (Rice) Extract, Bellis Perennis (Daisy) Flower Extract, Houttuynia Cordata Extract, Oryza Sativa (Rice) Bran Oil, Hydrogenated Lecithin, Polymethyl sisesquioxane, Palmitic Acid, Butylene Glycol, Stearic Acid, Glyceryl Stearate, Bis-Ethylhexyloxyphenol Methoxyphenyl Thazine, Potassium Cetyl Phosphate, Poly C10-30 Alkyl Acrylate, Methyloropanedid, Carbomer, Ammonium /Acryloyldimethyta urate/P Copolymer, Acrylates/C10-30 Alkyl Acrylate Crosspoly mer, Glyceryl Stearate Citrate, Ethyhexviglycerin, Adenosine, Polvether-1, Myristic Acid, Biosaccharide Gum-1, Tocopherol, Moringa Oleifera Seed Oil, Ceramide NP, Phytosphingosine, Phenethyl Alcohol, Sodium Chloride, Disodium Phosphate, Potassium Chloride, Potassium Phosphate","sourceUrl":"https://haruharuwonder.com/products/haruharuwonder-black-rice-moisture-airyfit-daily-sunscreen-unscented-spf50-50ml","imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/black_rice_moisture_airyfit_daily_sunscreen_SPF50_PA_50ml.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/black_rice_moisture_airyfit_daily_sunscreen_SPF50_PA_50ml.jpg"},{"id":194,"brand":"Haruharu Wonder","name":"Black Rice Moisture Cleansing Oil","category":"oil cleanser","subcategory":"cleansing oil","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["centella","Black Rice Bran Oil","Sunflower Seed Oil","Jojoba Seed Oil","Squalane","Centella Asiatica"],"bestFor":"All skin types, Dry skin, Sensitive skin, Makeup wearers","bestForTH":"All skin types, Dry skin, Sensitive skin, Makeup wearers","howOften":"Daily","howOftenTH":"Daily","description":"A nourishing oil cleanser that effectively dissolves makeup, SPF, and excess sebum without leaving a greasy residue. Formulated with lightweight black rice bran oil and squalane for a clean rinse that maintains skin's natural moisture barrier.","descriptionTH":"A nourishing oil cleanser that effectively dissolves makeup, SPF, and excess sebum without leaving a greasy residue. Formulated with lightweight black rice bran oil and squalane for a clean rinse that maintains skin's natural moisture barrier.","doNotCombine":"N/A — rinse-off product. Step 1 of double cleanse.","doNotCombineTH":"N/A — rinse-off product. Step 1 of double cleanse.","medicubeMode":"None","makeupPrep":true,"ingredients":"Oryza Sativa (Rice) Bran Oil, Caprylic/Capric Triglyceride, Helianthus Annuus (Sunflower) Seed Oil, Olea Europaea (Olive) Fruit Oil, Sorbeth-30 Tetraoleate, Simmondsia Chinensis (Jojoba) Seed Oil, Macadamia Integrifolia Seed Oil, Tocopherol, Ethylhexylglycerin","sourceUrl":"https://haruharuwonder.com/products/haruharuwonder-black-rice-moisture-cleansing-oil","imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/cleansingoil_icon_f208744a-4ebf-4944-b2cd-8177738f1879.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/cleansingoil_icon_f208744a-4ebf-4944-b2cd-8177738f1879.png"},{"id":195,"brand":"Haruharu Wonder","name":"Black Rice Moisture Pure Mineral Relief Sunscreen SPF50+/PA++++ Unscented","category":"sunscreen","fragranceFree":true,"alcoholFree":false,"eoFree":true,"activeIngredients":["niacinamide","hyaluronic acid","centella","Zinc Oxide","Titanium Dioxide","Niacinamide","Hyaluronic Acid","Centella Asiatica"],"bestFor":"Sensitive skin, Acne-prone skin, All skin types, Oily skin","bestForTH":"Sensitive skin, Acne-prone skin, All skin types, Oily skin","howOften":"Every morning","howOftenTH":"Every morning","description":"A tone-up mineral sunscreen with a brightening, blurring finish. Physical UV filters zinc oxide and titanium dioxide protect without chemical irritants. Niacinamide helps control excess oil while hyaluronic acid maintains hydration throughout the day.","descriptionTH":"A tone-up mineral sunscreen with a brightening, blurring finish. Physical UV filters zinc oxide and titanium dioxide protect without chemical irritants. Niacinamide helps control excess oil while hyaluronic acid maintains hydration throughout the day.","doNotCombine":"Apply as final AM step. Not for PM use.","doNotCombineTH":"Apply as final AM step. Not for PM use.","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Zinc Oxide, Cyclohexasiloxane, Butyloctyl Salicylate, Propanediol, Propylheptyl Caprylate, Caprylyl Methicone, Polyglyceryl-3 Polydimethylsiloxyethyl Dimethicone, Methyl Methacrylate Crosspolymer, Niacinamide, Methyl Trimethicone, Isododecane, Stellaria Media (Chickweed) Extract, Helianthus Annuus (Sunflower) Flower Extract, Vaccinium Vitis-Idaea Fruit Extract, Oryza Sativa (Rice) Extract, Bellis Perennis (Daisy) Flower Extract, Houttuynia Cordata Extract, Oryza Sativa (Rice) Bran Oil, Sodium Hyaluronate, Hydrogenated Lecithin, Disteardimonium Hectorite, Magnesium Sulfate, Triethoxycaprylylsilane, Butylene Glycol, 1,2-Hexanediol, Polyglyceryl-2 Dipolyhydroxystearate, Polymethylsilsesquioxane, Lauryl Polyglyceryl-3 Polydimethylsiloxyethyl Dimethicone, Glyceryl Caprylate, Caprylyl Glycol, Ethylhexylglycerin, Tocopherol, Glycerin, Moringa Oleifera Seed Oil, Ceramide NP, Phytosphingosine, Phenethyl Alcohol, Sodium Chloride, Disodium Phosphate, Potassium Chloride, Potassium Phosphate","sourceUrl":"https://haruharuwonder.com/products/haruharuwonder-black-rice-pure-mineral-relief-daily-sunscreen-unscented-spf50-50ml","imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/black_rice_pure_mineral_relief_daily_sunscreen_SPF50_PA_50ml.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/black_rice_pure_mineral_relief_daily_sunscreen_SPF50_PA_50ml.jpg"},{"id":196,"brand":"Haruharu Wonder","name":"Black Rice Probiotics Barrier Essence Unscented","category":"essence","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","ceramides","Lactobacillus Ferment Filtrate","Black Rice Extract","Beta-Glucan","Ceramide NP","Sodium Hyaluronate"],"bestFor":"Sensitive skin, Barrier-damaged skin, Dry skin, Combination skin, Microbiome-sensitive skin","bestForTH":"Sensitive skin, Barrier-damaged skin, Dry skin, Combination skin, Microbiome-sensitive skin","howOften":"AM & PM","howOftenTH":"AM & PM","description":"A probiotic barrier essence powered by Lactobacillus ferment to support the skin's microbiome and reinforce the moisture barrier. Beta-glucan calms and soothes while ceramide NP and hyaluronic acid deliver deep, lasting hydration.","descriptionTH":"A probiotic barrier essence powered by Lactobacillus ferment to support the skin's microbiome and reinforce the moisture barrier. Beta-glucan calms and soothes while ceramide NP and hyaluronic acid deliver deep, lasting hydration.","doNotCombine":"Generally well-tolerated. Avoid combining with very high-concentration AHAs that may disrupt barrier microbiome.","doNotCombineTH":"Generally well-tolerated. Avoid combining with very high-concentration AHAs that may disrupt barrier microbiome.","medicubeMode":"Derma Shot Mode","makeupPrep":false,"ingredients":"Water, Butylene Glycol, Helianthus Annuus (Sunflower) Seed Oil, Caprylic/Capric Triglyceride, Hydrogenated Polyisobutene, Limnanthes Alba (Meadowfoam) Seed Oil, Butylene Glycol Dicaprylate/Dicaprate, 1,2-Hexanediol, Potassium Cetyl Phosphate, Cetearyl Alcohol, Hydroxyacetophenone, Glycerin, Glyceryl Stearate, Oryza Sativa (Rice) Extract(2,000ppm), Phyllostachys Pubescens Shoot Bark Extract(2,000ppm), Hydrogenated Lecithin, Polyglyceryl-10 Laurate, Polyglyceryl-3 Methylglucose Distearate, Xanthan Gum, Galactomyces Ferment Filtrate(1,000ppm), Panthenol, Bifida Ferment Filtrate(1,000ppm), Aspergillus Ferment, Ethylhexylglycerin, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Ceramide NP, Disodium EDTA, Pentylene Glycol, Tromethamine, Butyrospermum Parkii (Shea) Butter, Phytosterols, Oryza Sativa (Rice) Lees Extract(100ppm), Panax Ginseng Root Extract, Stearic Acid, Palmitic Acid, Caprylyl Glycol, Squalane, Hydrolyzed Wheat Protein, Cyclodextrin, Arachidic Acid, Myristic Acid, Oleic Acid, Ceramide NS, Phytosphingosine, Cholesterol, Ceramide AS, Ceramide AP, Ceramide EOP","sourceUrl":"https://haruharuwonder.com/products/haruharuwonder-black-rice-probiotics-barrier-essence","imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/barrier_esence_icon_e8417f3b-e6ea-4458-b61a-6a82b0ea9409.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/barrier_esence_icon_e8417f3b-e6ea-4458-b61a-6a82b0ea9409.png"},{"id":197,"brand":"Haruharu Wonder","name":"Centella Phyto & 5 Peptide Concentrate Cream","category":"moisturizer","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","peptides","ceramides","Palmitoyl Tripeptide-1","Palmitoyl Tetrapeptide-7","Black Rice Extract","Niacinamide","Ceramide NP","Adenosine"],"bestFor":"Mature skin, Dry skin, Combination skin, Anti-aging, Barrier-repair","bestForTH":"Mature skin, Dry skin, Combination skin, Anti-aging, Barrier-repair","howOften":"AM & PM","howOftenTH":"AM & PM","description":"An advanced peptide cream combining Matrixyl 3000 complex (Palmitoyl Tripeptide-1 + Palmitoyl Tetrapeptide-7) with adenosine to visibly reduce the appearance of fine lines and wrinkles. Ceramide NP and niacinamide support the skin barrier and promote an even skin tone.","descriptionTH":"An advanced peptide cream combining Matrixyl 3000 complex (Palmitoyl Tripeptide-1 + Palmitoyl Tetrapeptide-7) with adenosine to visibly reduce the appearance of fine lines and wrinkles. Ceramide NP and niacinamide support the skin barrier and promote an even skin tone.","doNotCombine":"Avoid combining with high-strength vitamin C (L-ascorbic acid) in the same step as peptides may degrade. Use peptide cream separately from pure vitamin C serums.","doNotCombineTH":"Avoid combining with high-strength vitamin C (L-ascorbic acid) in the same step as peptides may degrade. Use peptide cream separately from pure vitamin C serums.","medicubeMode":"Derma Shot Mode","makeupPrep":false,"ingredients":"Water, Glycerin, Butylene Glycol, Caprylic/Capric Triglyceride, Helianthus Annuus (Sunflower) Seed Oil, Polyglyceryl-3 Distearate, 1,2-Hexanediol, Cetyl Alcohol, Cetyl Palmitate, Ammonium Acryloyldimethyltaurate/VP Copolymer, Sorbitan Palmitate, Sorbitan Olivate, Glyceryl Stearate, Stearyl Alcohol, Xanthan Gum, Glyceryl Stearate Citrate, Myristyl Alcohol, Squalane, Caffeine, Hydrolyzed Soy Protein, Hydrogenated Lecithin, Pentylene Glycol, Ethylhexylglycerin, Adenosine, Butyrospermum Parkii (Shea) Butter, Phytosterols, Lauryl Alcohol, Centella Asiatica Extract, Hydrolyzed Pea Protein, Madecassoside, Asiaticoside, Caprylyl Glycol, Xylitylglucoside, Anhydroxylitol, Copper Tripeptide-1, Xylitol, Acetyl Hexapeptide-8, Asiatic Acid, Madecassic Acid, Glucose, Ceramide NP, Hippophae Rhamnoides Fruit Extract, Oligopeptide-32, Oligopeptide-29, Palmitoyl Pentapeptide-4","sourceUrl":"https://haruharuwonder.com/products/haruharuwonder-centella-phyto-5-peptide-concentrate-cream","imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/CENTELLA_phyto_5_peptide_concentrate_cream_30ml_15973552-70cc-46d4-b0be-1180cb18eef3.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/CENTELLA_phyto_5_peptide_concentrate_cream_30ml_15973552-70cc-46d4-b0be-1180cb18eef3.jpg"},{"id":198,"brand":"Haruharu Wonder","name":"Centella 5% Niacinamide Radiance Gel Cream Unscented","category":"moisturizer","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["panthenol","niacinamide","hyaluronic acid","Niacinamide 5%","Black Rice Extract","Hyaluronic Acid","Panthenol","Beta-Glucan"],"bestFor":"Oily skin, Combination skin, Acne-prone skin, Brightening, All skin types","bestForTH":"Oily skin, Combination skin, Acne-prone skin, Brightening, All skin types","howOften":"AM & PM","howOftenTH":"AM & PM","description":"A lightweight gel moisturiser formulated with 5% niacinamide to minimise pores, regulate sebum production, and fade post-acne hyperpigmentation. Hyaluronic acid provides multi-layer hydration while the gel texture feels refreshing and non-greasy.","descriptionTH":"A lightweight gel moisturiser formulated with 5% niacinamide to minimise pores, regulate sebum production, and fade post-acne hyperpigmentation. Hyaluronic acid provides multi-layer hydration while the gel texture feels refreshing and non-greasy.","doNotCombine":"Do not combine with high-dose Vitamin C (L-ascorbic acid) at same time — may cause temporary flushing. Space apart morning and night.","doNotCombineTH":"Do not combine with high-dose Vitamin C (L-ascorbic acid) at same time — may cause temporary flushing. Space apart morning and night.","medicubeMode":"Booster Mode","makeupPrep":true,"ingredients":"Water, Niacinamide(5%), Propanediol, Centella Asiatica Leaf Water (3.8%), Glycerin, Butylene Glycol Dicaprylate/Dicaprate, Squalane (2%), 1,2-Hexanediol, Cetearyl Olivate, Panthenol, Ammonium Acryloyldimethyltaurate/VP Copolymer, Sorbitan Olivate, Carbomer, Sclerotium Gum, Tromethamine, Helianthus Annuus (Sunflower) Seed Oil, Xanthan Gum, Madecassoside (1,000ppm), Ethylhexylglycerin, Disodium EDTA, Xylitol, Ascorbic Acid","sourceUrl":"https://haruharuwonder.com/products/haruharuwonder-centella-5-niacinamide-radiance-gel-cream","imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/1730378976696_454457d599df4ded90762416649b407f_f026024c-d66b-4dfa-baf6-ef8eeeff62c5.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/1730378976696_454457d599df4ded90762416649b407f_f026024c-d66b-4dfa-baf6-ef8eeeff62c5.jpg"},{"id":199,"brand":"Haruharu Wonder","name":"Centella Sunflower Makeup-Melting Cleansing Balm","category":"oil cleanser","subcategory":"cleansing balm","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["ceramides","centella","Sunflower Seed Oil","Centella Asiatica","Ceramide NP","Glycerin","Beeswax"],"bestFor":"All skin types, Sensitive skin, Dry skin, Makeup wearers","bestForTH":"All skin types, Sensitive skin, Dry skin, Makeup wearers","howOften":"Daily","howOftenTH":"Daily","description":"A balm-textured first-step cleanser that melts away makeup, SPF, and excess sebum with sunflower seed oil and centella asiatica. Contains ceramide NP to support the moisture barrier during cleansing. Rinses clean without a greasy residue.","descriptionTH":"A balm-textured first-step cleanser that melts away makeup, SPF, and excess sebum with sunflower seed oil and centella asiatica. Contains ceramide NP to support the moisture barrier during cleansing. Rinses clean without a greasy residue.","doNotCombine":"N/A — rinse-off product. First step of double cleanse, PM only.","doNotCombineTH":"N/A — rinse-off product. First step of double cleanse, PM only.","medicubeMode":"None","makeupPrep":true,"ingredients":"Cetyl Ethylhexanoate, PEG-20 Glyceryl Triisostearate, Synthetic Wax, Helianthus Annuus (Sunflower) Seed Oil Unsaponifiables(5,000ppm), Argania Spinosa Kernel Oil, Butyrospermum Parkii (Shea) Butter, Simmondsia Chinensis (Jojoba) Seed Oil, Squalane, Olea Europaea (Olive) Fruit Oil, 1,2-Hexanediol, Water, Panthenol, Butylene Glycol, Propanediol, Centella Asiatica Extract(0.01ppm), Melaleuca Alternifolia (Tea Tree) Flower/Leaf/Stem Extract, Calendula Officinalis Flower Extract, Ethylhexylglycerin","sourceUrl":"https://haruharuwonder.com/products/haruharuwonder-haruharu-wonder-centella-sunflower-makeup-melting-cleansing-balm-100g","imageUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/centella_sunflower_makeup-melting_cleansing_balm_100g.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0707/0190/8217/files/centella_sunflower_makeup-melting_cleansing_balm_100g.jpg"},{"id":200,"brand":"Mixsoon","name":"Centella Cleansing Foam","category":"cleanser","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["centella","Centella Asiatica Extract 60%","Madecassoside","Asiaticoside","Glycerin"],"bestFor":"• Everyday use\n• Gentle cleansing of face and makeup\n• All skin types","bestForTH":"• Everyday use\n• Gentle cleansing of face and makeup\n• All skin types","howOften":"Daily","howOftenTH":"Daily","description":"mixsoon Centella Cleansing Foam is a gentle yet effective cleanser that refreshes and soothes skin with the calming power of Centella Asiatica, sourced locally from Jeju. Infused with natural ingredients, it deeply removes impurities, excess oil, and makeup without stripping the skin, leaving it soft, hydrated, and balanced. The pH 4~5 formula helps maintain a healthy skin barrier while providing a thorough cleanse, and the key ingredient Centella Asiatica is known for its soothing and healing properties, calming redness, irritation, and inflammation. Suitable for all skin types, including sensitive skin, it delivers a refreshing cleanse without the harsh effects typical of other foaming cleansers.","descriptionTH":"mixsoon Centella Cleansing Foam is a gentle yet effective cleanser that refreshes and soothes skin with the calming power of Centella Asiatica, sourced locally from Jeju. Infused with natural ingredients, it deeply removes impurities, excess oil, and makeup without stripping the skin, leaving it soft, hydrated, and balanced. The pH 4~5 formula helps maintain a healthy skin barrier while providing a thorough cleanse, and the key ingredient Centella Asiatica is known for its soothing and healing properties, calming redness, irritation, and inflammation. Suitable for all skin types, including sensitive skin, it delivers a refreshing cleanse without the harsh effects typical of other foaming cleansers.","doNotCombine":"N/A — rinse-off product.","doNotCombineTH":"N/A — rinse-off product.","medicubeMode":"None","makeupPrep":true,"ingredients":"Water/Aqua, sodium cocoyl isethionate, glycerin, hydroxypropyl starch phosphate, sodium methyl cocoyl taurate, propanediol, potassium cocoyl glycinate, acrylates copolymer, cetearyl alcohol, potassium cocoate, sorbitan olivate, salicylic acid, glycol distearate, glyceryl stearate, citric acid, caprylyl glycol, butylene glycol, 1,2-hexanediol, glyceryl caprylate, centella asiatica extract, disodium edta.","sourceUrl":"https://mixsoon.us/collections/best/products/mixsoon-centella-cleansing-foam-150ml","imageUrl":"https://cdn.shopify.com/s/files/1/0797/3299/8445/files/Centella_cleansing_foam_170038ad-56c9-407d-a0c4-6fbcc220701a.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0797/3299/8445/files/Centella_cleansing_foam_170038ad-56c9-407d-a0c4-6fbcc220701a.png"},{"id":201,"brand":"Mixsoon","name":"Bean Cleansing Oil","category":"oil cleanser","subcategory":"cleansing oil","fragranceFree":false,"alcoholFree":true,"eoFree":false,"activeIngredients":["Soybean Oil","Sunflower Seed Oil","Jojoba Seed Oil","Vitamin E (Tocopherol)"],"bestFor":"• Everyday use\n• Removing makeup and sunscreen\n• All skin types","bestForTH":"• Everyday use\n• Removing makeup and sunscreen\n• All skin types","howOften":"Daily","howOftenTH":"Daily","description":"Discover the refreshing power of the mixsoon Bean Cleansing Oil, a lightweight yet deeply effective formula that removes makeup, sunscreen, and impurities without leaving any greasy residue. Enriched with patented fermented soybean extract, it nourishes, soothes, and supports a healthy skin barrier, while fermented pomegranate, barley, and pear deliver antioxidants and hydration for soft, balanced, refreshed skin. Formulated with plant-derived oils such as soybean, jojoba, and sunflower seed oil, it gently dissolves even waterproof makeup while minimizing irritation, leaving skin moisturized and comfortable without tightness or dryness. Suitable for all skin types.","descriptionTH":"Discover the refreshing power of the mixsoon Bean Cleansing Oil, a lightweight yet deeply effective formula that removes makeup, sunscreen, and impurities without leaving any greasy residue. Enriched with patented fermented soybean extract, it nourishes, soothes, and supports a healthy skin barrier, while fermented pomegranate, barley, and pear deliver antioxidants and hydration for soft, balanced, refreshed skin. Formulated with plant-derived oils such as soybean, jojoba, and sunflower seed oil, it gently dissolves even waterproof makeup while minimizing irritation, leaving skin moisturized and comfortable without tightness or dryness. Suitable for all skin types.","doNotCombine":"N/A — rinse-off product.","doNotCombineTH":"N/A — rinse-off product.","medicubeMode":"None","makeupPrep":false,"ingredients":"Ethylhexyl Palmitate, Sorbeth-30 Tetraoleate, Triethylhexanoin, Glycine Soja (Soybean) Oil, Caprylic/Capric Triglyceride, Simmondsia Chinensis (Jojoba) Seed Oil, Fragrance (Parfum), Tocopherol, Helianthus Annuus (Sunflower) Seed Oil, Caprylyl Glycol, Ethylhexylglycerin, Water (Aqua), Propanediol, Glycerin, Lactobacillus/Soybean Ferment Extract, Lactobacillus/Punica Granatum Fruit Ferment Extract, Saccharomyces/Barley Seed Ferment Filtrate, Lactobacillus/Pear Juice Ferment Filtrate","sourceUrl":"https://mixsoon.us/collections/best/products/mixsoon-bean-cleansing-oil-195ml","imageUrl":"https://cdn.shopify.com/s/files/1/0797/3299/8445/files/cleansingoilbestsellers.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0797/3299/8445/files/cleansingoilbestsellers.png"},{"id":202,"brand":"Mixsoon","name":"Bean Cream","category":"moisturizer","fragranceFree":false,"alcoholFree":true,"eoFree":false,"activeIngredients":["niacinamide","peptides","ceramides","Soybean Extract","Rosehip Oil","Ceramide NP","Niacinamide","Peptides"],"bestFor":"• Dry, dehydrated, or rough skin\n• Skin in need of barrier support and long-lasting moisture","bestForTH":"• Dry, dehydrated, or rough skin\n• Skin in need of barrier support and long-lasting moisture","howOften":"AM & PM","howOftenTH":"AM & PM","description":"A rich yet lightweight cream that delivers intense hydration while strengthening the skin barrier. Formulated with a skin-friendly pH of 5~6, it helps maintain a healthy balance while supporting barrier function. Powered by fermented soybean extract, it locks in moisture for soft, smooth, and nourished skin all day. Enriched with barley, pomegranate, and pear extracts, it deeply nourishes, improves skin texture, and promotes a radiant, youthful-looking complexion. The non-greasy formula absorbs quickly, soothes irritation, prevents moisture loss, and leaves skin feeling balanced, silky, and revitalized. Suitable for daily use on all skin types.","descriptionTH":"A rich yet lightweight cream that delivers intense hydration while strengthening the skin barrier. Formulated with a skin-friendly pH of 5~6, it helps maintain a healthy balance while supporting barrier function. Powered by fermented soybean extract, it locks in moisture for soft, smooth, and nourished skin all day. Enriched with barley, pomegranate, and pear extracts, it deeply nourishes, improves skin texture, and promotes a radiant, youthful-looking complexion. The non-greasy formula absorbs quickly, soothes irritation, prevents moisture loss, and leaves skin feeling balanced, silky, and revitalized. Suitable for daily use on all skin types.","doNotCombine":"Avoid with pure L-ascorbic acid vitamin C (may interact with niacinamide). Contains essential oils — patch test recommended for very sensitive skin.","doNotCombineTH":"Avoid with pure L-ascorbic acid vitamin C (may interact with niacinamide). Contains essential oils — patch test recommended for very sensitive skin.","medicubeMode":"Derma Shot Mode","makeupPrep":false,"ingredients":"Water/Aqua, Glycerin, Caprylic/Capric Triglyceride, Hydrogenated Polyisobutene, Polyglyceryl-3 Distearate, Hydrogenated Co\nco-Glycerides, Limnanthes Alba (Meadow foam) Seed Oil, ButyleneGlycol, Diisostearyl\nMalate, Vinyl Dimethicone, Cetearyl Alcohol, Stearic Acid, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Glyceryl Stearate, Hydroxyacetophenone, Sorbi\ntanIsostearate, Glyceryl Stearate Citrate, Carbomer, Tromethamine, Panthenol, Dipotassium Glycyrrhizate, Hydrogenated Lecithin,\nPropanediol, Ethylhexylglycerin, Adenosine, Melia Azadirachta Flower Extract, Eclipta Prostrata Extract, Coccinia Indica Fruit Extract, Disodium EDTA, Sodium Polyacrylate, Ocimum Sanctum Leaf Extract, Melia Azadirach\nta Leaf Extract, Curcuma Longa (Turmeric) Root Extract, Corallina Officinalis Extract, La\nctobacillus/Soybean Ferment Extract, Lactobacillus/Punica Granatum Fruit Ferment Extract, Saccharomyces/Barley Seed Ferment Filtrate, Lactobacillus/Pear Juice Ferment Fil\ntrate, Palmitic Acid, Citrus Aurantium Bergamia (Bergamot) Fruit Oil, Oleic Acid, Lavandula Angustifolia","sourceUrl":"https://mixsoon.us/collections/best/products/mixsoon-bean-cream-50ml","imageUrl":"https://cdn.shopify.com/s/files/1/0797/3299/8445/files/beancreambestseller.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0797/3299/8445/files/beancreambestseller.png"},{"id":203,"brand":"Mixsoon","name":"Bean Essence","category":"essence","subcategory":"essence","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","hyaluronic acid","Soybean Ferment Filtrate","Beta-Glucan","Niacinamide","Sodium Hyaluronate"],"bestFor":"• Dry, dehydrated, or rough skin\n• Skin in need of barrier support and long-lasting moisture","bestForTH":"• Dry, dehydrated, or rough skin\n• Skin in need of barrier support and long-lasting moisture","howOften":"AM & PM","howOftenTH":"AM & PM","description":"The MIXSOON Bean Essence is a purifying essence infused with beans that helps improve and refine the skin texture for a smooth and spotless result. The bean extract inside the formula gently removes impurities, cleanses the clogged pores, controls the excess sebum and minimizes the visible appearance of pores for a smooth, refined texture. The essence is also rich in various vitamins, calcium, and amino acids that nourish and condition the skin for a healthy, radiant-looking complexion.","descriptionTH":"The MIXSOON Bean Essence is a purifying essence infused with beans that helps improve and refine the skin texture for a smooth and spotless result. The bean extract inside the formula gently removes impurities, cleanses the clogged pores, controls the excess sebum and minimizes the visible appearance of pores for a smooth, refined texture. The essence is also rich in various vitamins, calcium, and amino acids that nourish and condition the skin for a healthy, radiant-looking complexion.","doNotCombine":"Generally well-tolerated. Avoid very high-strength actives immediately after.","doNotCombineTH":"Generally well-tolerated. Avoid very high-strength actives immediately after.","medicubeMode":"Booster Mode","makeupPrep":false,"ingredients":"Water/Aqua, Propanediol, Glycerin, Lactobacillus/Soybean Ferment Extract, Lactobacillus/Punica Granatum Fruit Ferment Extract, Saccharomyces/Barley Seed Ferment Filtrate, Lactobacillus/Pear Juice Ferment Filtrate","sourceUrl":"https://mixsoon.us/collections/best/products/mixsoon-bean-essence-50ml","imageUrl":"https://cdn.shopify.com/s/files/1/0797/3299/8445/files/beanessencebestseller.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0797/3299/8445/files/beanessencebestseller.png"},{"id":204,"imageUrl":"https://media.meds.se/meds/images/image-png-2024-01-29-110423159/460/460/fill/c/glacier-water-hyaluronic-acid-serum-png.png","brand":"Mixsoon","name":"Glacier Water Hyaluronic Acid Serum","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["panthenol","hyaluronic acid","Hyaluronic Acid (5 types)","Beta-Glucan","Glycerin","Panthenol","Allantoin"],"bestFor":"Intense hydration for dry, dehydrated, or tired skin\nCooling and soothing sensitive or overheated skin\nImproving elasticity and achieving a plump, radiant finish","bestForTH":"Intense hydration for dry, dehydrated, or tired skin\nCooling and soothing sensitive or overheated skin\nImproving elasticity and achieving a plump, radiant finish","howOften":"AM & PM","howOftenTH":"AM & PM","description":"The mixsoon Glacier Water Hyaluronic Acid Serum offers an invigorating burst of hydration designed to restore and rejuvenate dry, tired skin. Enriched with a unique blend of three types of hyaluronic acid, this serum deeply penetrates the skin to hydrate from within while improving elasticity and firmness. The inclusion of pure Glacier Water infuses the skin with refreshing moisture, providing an immediate soothing and cooling effect for a smooth, luminous finish. Its lightweight formula absorbs quickly without leaving any greasy residue, ensuring a fresh, plump complexion all day long while protecting the skin with a moisture-rich glow.","descriptionTH":"The mixsoon Glacier Water Hyaluronic Acid Serum offers an invigorating burst of hydration designed to restore and rejuvenate dry, tired skin. Enriched with a unique blend of three types of hyaluronic acid, this serum deeply penetrates the skin to hydrate from within while improving elasticity and firmness. The inclusion of pure Glacier Water infuses the skin with refreshing moisture, providing an immediate soothing and cooling effect for a smooth, luminous finish. Its lightweight formula absorbs quickly without leaving any greasy residue, ensuring a fresh, plump complexion all day long while protecting the skin with a moisture-rich glow.","doNotCombine":"Compatible with most actives. Apply before heavier serums and creams.","doNotCombineTH":"Compatible with most actives. Apply before heavier serums and creams.","medicubeMode":"Booster Mode","makeupPrep":false,"ingredients":"Water/Aqua, Butylene Glycol , 1,2-Hexanediol , Sodium Hyaluronate","sourceUrl":"https://mixsoon.com/products/glacier-water-hyaluronic-acid-serum","imageUrl":"https://media.meds.se/meds/images/image-png-2024-01-29-110423159/460/460/fill/c/glacier-water-hyaluronic-acid-serum-png.png","thumbnailUrl":"https://media.meds.se/meds/images/image-png-2024-01-29-110423159/460/460/fill/c/glacier-water-hyaluronic-acid-serum-png.png"},{"id":205,"brand":"numbuzin","name":"No.3 Skin Softening Serum","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["panthenol","niacinamide","hyaluronic acid","Niacinamide 10%","Galactomyces Ferment Filtrate","Panthenol","Sodium Hyaluronate"],"bestFor":"Oily skin, Combination skin, Acne-prone skin, Brightening, Pore-minimising, All skin types","bestForTH":"Oily skin, Combination skin, Acne-prone skin, Brightening, Pore-minimising, All skin types","howOften":"AM & PM","howOftenTH":"AM & PM","description":"A galactomyces-powered brightening serum featuring 10% niacinamide for pore minimisation and sebum control. Galactomyces ferment filtrate promotes a glass-skin effect while panthenol and hyaluronic acid maintain hydration. Suitable for daily use.","descriptionTH":"A galactomyces-powered brightening serum featuring 10% niacinamide for pore minimisation and sebum control. Galactomyces ferment filtrate promotes a glass-skin effect while panthenol and hyaluronic acid maintain hydration. Suitable for daily use.","doNotCombine":"Do not combine with high-concentration L-ascorbic acid vitamin C at same time.","doNotCombineTH":"Do not combine with high-concentration L-ascorbic acid vitamin C at same time.","medicubeMode":"Booster Mode","makeupPrep":true,"ingredients":"Bifida Ferment Lysate, Galactomyces Ferment Filtrate, Butylene Glycol, Methyl Gluceth-20, Water, Niacinamide, PEG-90, 1,2-Hexanediol, Glycerin, Squalane, Alteromonas Ferment Extract, Silk Extract, Goat Milk Extract, Sodium Hyaluronate, Panthenol, Adenosine, Glycereth-26, Xanthan Gum, Polyglyceryl-3 Distearate, Glyceryl Stearate SE, Glyceryl Stearate Citrate, Polyglyceryl-3 Methylglucose Distearate, Carbomer, Tromethamine, Ethylhexylglycerin, Caprylyl Glycol, TROPOLONE, Disodium EDTA","sourceUrl":"https://us.numbuzin.com/products/no-3-skin-softening-serum-1","imageUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/250527_________09.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/250527_________09.jpg"},{"id":206,"brand":"numbuzin","name":"No.3 Blue Bio-Retinol Pore Refining Serum","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","retinal","peptides","Bakuchiol (Bio-Retinol)","Retinal","Niacinamide","Adenosine","Peptides"],"bestFor":"Mature skin, Anti-aging, Dry skin, Combination skin, Sensitive skin (patch test recommended)","bestForTH":"Mature skin, Anti-aging, Dry skin, Combination skin, Sensitive skin (patch test recommended)","howOften":"PM only","howOftenTH":"ช่วงกลางคืนเท่านั้น","description":"A retinal + bakuchiol firming serum that combines retinal (more potent than retinol) with gentle bakuchiol for visible anti-aging results with reduced irritation. Adenosine and peptides further support collagen synthesis and skin firmness. PM use only.","descriptionTH":"A retinal + bakuchiol firming serum that combines retinal (more potent than retinol) with gentle bakuchiol for visible anti-aging results with reduced irritation. Adenosine and peptides further support collagen synthesis and skin firmness. PM use only.","doNotCombine":"Do NOT combine with AHAs/BHAs, vitamin C, or benzoyl peroxide in same routine step. Use PM only. Avoid during pregnancy/breastfeeding.","doNotCombineTH":"Do NOT combine with AHAs/BHAs, vitamin C, or benzoyl peroxide in same routine step. Use PM only. Avoid during pregnancy/breastfeeding.","medicubeMode":"None","makeupPrep":false,"ingredients":"Water, Niacinamide, Butylene Glycol, Propanediol, Glycerin, Dipropylene Glycol, Pentylene Glycol, Glyceryl Glucoside, Hydrolyzed Collagen, Chlorella Vulgaris Extract, Centella Asiatica Extract, Acacia Senegal Gum, Cynanchum Atratum Extract, Macadamia Ternifolia Seed Oil, Althaea Rosea Flower Extract, Glycine Soja (Soybean) Oil, Melia Azadirachta Flower Extract, Coccinia Indica Fruit Extract, Melia Azadirachta Leaf Extract, Aloe Barbadensis Flower Extract, Solanum Melongena (Eggplant) Fruit Extract, Ocimum Sanctum Leaf Extract, Corallina Officinalis Extract, Curcuma Longa (Turmeric) Root Extract, 1,2-Hexanediol, Caprylic/Capric Triglyceride, Glycereth-26, C12-14 Alketh-12, Polysorbate 20, Calcium Chloride, Salicylic Acid, Gellan Gum, Honokiol, Panthenol, PPG-13-Decyltetradeceth-24, Hydrolyzed Sclerotium Gum, Sodium Citrate, Glucose, Adenosine, Citric Acid, Panax Ginseng Adventitious Root Extracellular Vesicles, Dextrin, Lecithin, Silica, Centella Asiatica Callus Extracellular Vesicles, Ethylhexylglycerin, Retinol, Hydrogenated Lecithin, Brassica Campestris (Rapeseed) Sterols, Glycine, Cholesterol, Polyglyceryl-10 Laurate, Phytosteryl/Behenyl/Octyldodecyl Lauroyl Glutamate, Tocopheryl Acetate, Aluminum/Magnesium Hydroxide Stearate, Pentaerythrityl Tetra-di-t-butyl Hydroxyhydrocinnamate, Potassium Cetyl Phosphate, Diethylhexyl Syringylidenemalonate, Tocopherol, Tris(Tetramethylhydroxypiperidinol) Citrate, Copper Tripeptide-1, Hydroxyethylcellulose, Gardenia Florida Fruit Extract","sourceUrl":"https://us.numbuzin.com/products/no-3-blue-bio-retinol-pore-refining-serum","imageUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/No.3BlueBio-RetinolSerum_Main3.png","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/No.3BlueBio-RetinolSerum_Main3.png"},{"id":207,"brand":"numbuzin","name":"No.3 Rice Enzyme Skin Softening Cleansing Foam","category":"cleanser","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","Rice Bran Extract","Rice Enzyme (Oryza Sativa)","Niacinamide","Amino Acids"],"bestFor":"All skin types, Dull skin, Brightening-focused, Sensitive skin","bestForTH":"All skin types, Dull skin, Brightening-focused, Sensitive skin","howOften":"Daily","howOftenTH":"Daily","description":"A brightening foam cleanser powered by rice bran extract and rice enzymes to gently resurface dull, uneven skin. The mild enzyme exfoliation promotes a radiant, clear complexion without stripping the skin barrier. Niacinamide enhances brightening while amino acids condition.","descriptionTH":"A brightening foam cleanser powered by rice bran extract and rice enzymes to gently resurface dull, uneven skin. The mild enzyme exfoliation promotes a radiant, clear complexion without stripping the skin barrier. Niacinamide enhances brightening while amino acids condition.","doNotCombine":"N/A — rinse-off product. Do not use with other enzyme cleansers simultaneously.","doNotCombineTH":"N/A — rinse-off product. Do not use with other enzyme cleansers simultaneously.","medicubeMode":"None","makeupPrep":true,"ingredients":"GLYCERIN, WATER, CELLULOSE, SODIUM COCOYL GLYCINATE, SODIUM LAUROYL GLUTAMATE, KAOLIN, DISODIUM COCOAMPHODIACETATE, 1,2-HEXANEDIOL, HYDRATED SILICA, LAURYL BETAINE, SODIUM CHLORIDE, SODIUM METHYL COCOYL TAURATE, ETHYLHEXYLGLYCERIN, HYDROXYACETOPHENONE, ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER, POLYGLYCERIN-3, CITRIC ACID, ORYZA SATIVA (RICE) EXTRACT, ORYZA SATIVA (RICE) LEES EXTRACT, LACTOBACILLUS/RICE FERMENT, HEXYLENE GLYCOL, BUTYLENE GLYCOL, HYDROGENATED LECITHIN, FICUS CARICA (FIG) FRUIT EXTRACT, CENTELLA ASIATICA EXTRACT, BETA-GLUCAN, CERAMIDE NP, HYDROXYPROPYL STARCH PHOSPHATE, CARBOMER, MANNITOL, PAPAIN, BROMELAIN, PROTEASE, ORYZANOL, KOJIC DIPALMITATE, LIPASE","sourceUrl":"https://us.numbuzin.com/products/no-3-rice-enzyme-skin-softening-cleansing-foam","imageUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/30.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/30.jpg"},{"id":208,"brand":"numbuzin","name":"No.5 Vitamin Boosting Essential Toner","category":"toner","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["panthenol","niacinamide","hyaluronic acid","Niacinamide 5%","Beta-Glucan","Hyaluronic Acid","Panthenol","Allantoin"],"bestFor":"All skin types, Oily skin, Combination skin, Dehydrated skin, Brightening","bestForTH":"All skin types, Oily skin, Combination skin, Dehydrated skin, Brightening","howOften":"AM & PM","howOftenTH":"AM & PM","description":"A hydrating brightening toner formulated with 5% niacinamide and beta-glucan to prep and balance the skin while addressing pores and uneven tone. Lightweight watery texture absorbs quickly, leaving skin soft and ready for the next skincare steps.","descriptionTH":"A hydrating brightening toner formulated with 5% niacinamide and beta-glucan to prep and balance the skin while addressing pores and uneven tone. Lightweight watery texture absorbs quickly, leaving skin soft and ready for the next skincare steps.","doNotCombine":"Compatible with most actives. Avoid mixing with very acidic toners (pH < 3.5) as may reduce niacinamide efficacy.","doNotCombineTH":"Compatible with most actives. Avoid mixing with very acidic toners (pH < 3.5) as may reduce niacinamide efficacy.","medicubeMode":"Booster Mode","makeupPrep":true,"ingredients":"Water, Dipropylene Glycol, Glycerin, Niacinamide, 1,2-Hexanediol, Butylene Glycol, Polyglycerin-3, Hippophae Rhamnoides Water, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tromethamine, Erythritol, Pentylene Glycol, 3-O-Ethyl Ascorbic Acid, Ethylhexylglycerin, Polyglyceryl-4 Caprate, Adenosine, Glutathione, Hydrogenated Lecithin, Disodium EDTA, Madecassoside, Coptis Japonica Root Extract, Decyl Glucoside, Caprylyl Glycol, Ceramide NP, Ascorbic Acid, Bisabolol, Panthenol, Tocopherol, Arbutin, Acetyl Hexapeptide-8, Hexapeptide-9, Nonapeptide-1, Palmitoyl Pentapeptide-4, Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7","sourceUrl":"https://us.numbuzin.com/products/no-5-vitamin-boosting-essential-toner","imageUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/32.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/32.jpg"},{"id":209,"brand":"numbuzin","name":"No.9 NAD+ Retinol Volumetox Eye Cream","category":"eye","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","peptides","ceramides","Adenosine","Peptides (Palmitoyl Tripeptide-1)","Niacinamide","Ceramide NP","Caffeine"],"bestFor":"Mature skin, Anti-aging, All skin types, Dark circles, Eye puffiness","bestForTH":"Mature skin, Anti-aging, All skin types, Dark circles, Eye puffiness","howOften":"PM only","howOftenTH":"ช่วงกลางคืนเท่านั้น","description":"A targeted eye cream formulated with peptides and adenosine to reduce the appearance of fine lines and crow's feet. Caffeine helps depuff and improve microcirculation, while ceramide NP and niacinamide strengthen the delicate eye area barrier.","descriptionTH":"A targeted eye cream formulated with peptides and adenosine to reduce the appearance of fine lines and crow's feet. Caffeine helps depuff and improve microcirculation, while ceramide NP and niacinamide strengthen the delicate eye area barrier.","doNotCombine":"Avoid contact with eyes. Do not combine with retinol in same application to eye area.","doNotCombineTH":"Avoid contact with eyes. Do not combine with retinol in same application to eye area.","medicubeMode":"Derma Shot Mode","makeupPrep":false,"ingredients":"Water, Butylene Glycol, Glycerin, Propanediol, Macadamia Integrifolia Seed Oil, Niacinamide, Olea Europaea (Olive) Fruit Oil, Cetyl Ethylhexanoate, Methylpropanediol, Butyrospermum Parkii (Shea) Butter, Methyl Hydrogenated Rosinate, Polysorbate 60, Cyclopentasiloxane, 1,2-Hexanediol, Cetyl Alcohol, Stearic Acid, Glycereth-26, Glyceryl Stearate, Dimethicone, PEG-100 Stearate, Cyclohexasiloxane, Hydrogenated Lecithin, Ammonium Acryloyldimethyltaurate/VP Copolymer, Sorbitan Stearate, Behenic Acid, Cocos Nucifera (Coconut) Oil, Hydroxyacetophenone, Polyacrylate-13, Vinyl Dimethicone, Batyl Alcohol, Dimethicone/Vinyl Dimethicone Crosspolymer, Phytosteryl Isostearate, Polyisobutene, Ceramide NP, Nicotinamide Adenine Dinucleotide, Caprylic/Capric Triglyceride, Macadamia Ternifolia Seed Oil, Citric Acid, Retinol, Ethylhexylglycerin, Polyglyceryl-4 Oleate, Adenosine, Hydrolyzed Gardenia Florida Extract, Hydrolyzed Malt Extract, Hydrolyzed Viola Tricolor Extract, Theobroma Cacao (Cocoa) Seed Extract, Brassica Campestris (Rapeseed) Sterols, Polysorbate 20, Disodium EDTA, Sorbitan Isostearate, Dextrin, Cholesterol, Polyglyceryl-10 Laurate, Ammonium Polyacryloyldimethyl Taurate, Hyaluronic Acid, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate, Phytosteryl/Behenyl/Octyldodecyl Lauroyl Glutamate, Aluminum/Magnesium Hydroxide Stearate, Pentaerythrityl Tetra-di-t-butyl Hydroxyhydrocinnamate, Potassium Cetyl Phosphate, Hydroxypropyl Cyclodextrin, Chitosan, Tris(Tetramethylhydroxypiperidinol) Citrate, Acetyl tetrapeptide-5, Resveratrol, Acetyl Dipeptide-1 Cetyl Ester, Acetyl Hexapeptide-1, Acetyl Hexapeptide-8, Acetyl Octapeptide-3, Acetyl Tetrapeptide-2, Acetyl Tetrapeptide-3, Acetyl Tetrapeptide-9, Arginine/Lysine Polypeptide, Biotinoyl Tripeptide-1, Copper Tripeptide-1, Dipeptide Diaminobutyroyl Benzylamide Diacetate, Dipeptide-2, Dipeptide-4, Hexapeptide-11, Hexapeptide-12, Hexapeptide-9, Myristoyl Pentapeptide-17, Nicotinoyl Dipeptide-23, Nicotinoyl Tripeptide-1, Nicotinoyl Tripeptide-35, Nonapeptide-1, Oligopeptide-29, Oligopeptide-32, Palmitoyl Hexapeptide-12, Palmitoyl Pentapeptide-4, Palmitoyl Pentapeptide-5, Palmitoyl Tetrapeptide-10, Palmitoyl Tetrapeptide-7, Palmitoyl Tripeptide-1, Palmitoyl Tripeptide-29, Palmitoyl Tripeptide-38, Palmitoyl Tripeptide-5, Palmitoyl Tripeptide-8, sh-Decapeptide-7, sh-Octapeptide-4, sh-Oligopeptide-1, sh-Oligopeptide-2, sh-Polypeptide-1, sh-Polypeptide-11, sh-Polypeptide-16, sh-Polypeptide-22, sh-Polypeptide-3, sh-Polypeptide-62, sh-Polypeptide-9, sr-(Oligopeptide-91 Clostridium Botulinum Polypeptide-1), Tetrapeptide-30, Tripeptide-1, Tripeptide-10 citrulline, Tripeptide-29","sourceUrl":"https://us.numbuzin.com/products/no-9-nad-retinol-volumetox-eye-cream","imageUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/15.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/15.jpg"},{"id":210,"brand":"numbuzin","name":"No.5+ Glutathione Vitamin Concentrated Serum","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","vitamin c","tranexamic acid","arbutin","Glutathione","Niacinamide 10%","Tranexamic Acid","Ascorbyl Glucoside (Vitamin C)","Alpha Arbutin"],"bestFor":"Hyperpigmentation, Brightening, Dull skin, Post-acne marks, All skin types","bestForTH":"Hyperpigmentation, Brightening, Dull skin, Post-acne marks, All skin types","howOften":"AM & PM","howOftenTH":"AM & PM","description":"An intensive brightening serum powered by glutathione, 10% niacinamide, tranexamic acid, and stabilised vitamin C to target hyperpigmentation, post-acne marks, and uneven skin tone from multiple pathways. Suitable for visible radiance improvements within weeks.","descriptionTH":"An intensive brightening serum powered by glutathione, 10% niacinamide, tranexamic acid, and stabilised vitamin C to target hyperpigmentation, post-acne marks, and uneven skin tone from multiple pathways. Suitable for visible radiance improvements within weeks.","doNotCombine":"Avoid combining with niacinamide from other sources in excessive concentrations (already contains 10%). Space apart from pure L-ascorbic acid (this contains the gentler Ascorbyl Glucoside). Do not use with AHAs/BHAs in the same step.","doNotCombineTH":"Avoid combining with niacinamide from other sources in excessive concentrations (already contains 10%). Space apart from pure L-ascorbic acid (this contains the gentler Ascorbyl Glucoside). Do not use with AHAs/BHAs in the same step.","medicubeMode":"Booster Mode","makeupPrep":true,"ingredients":"Water, Butylene Glycol, Niacinamide, Panthenol, Tranexamic Acid, 1,2-Hexanediol, Neopentyl Glycol Dicaprate, Caprylic/Capric Triglyceride, Sorbitol, Vaccinium Vitis-Idaea Fruit Extract, Behenyl Alcohol, Pentylene Glycol, Glycerin, Chondrus Crispus Extract, Butyrospermum Parkii (Shea) Butter, 3-O-Ethyl Ascorbic Acid, Saccharum Officinarum (Sugarcane) Extract, Carbomer, Alpha-Arbutin, Bisabolol, Tromethamine, Ethylhexylglycerin, Bifida Ferment Lysate, Adenosine, Hydrogenated Lecithin, Allantoin, Sodium Hyaluronate, Xanthan Gum, Glutathione, Disodium EDTA, Melia Azadirachta Flower Extract, Ocimum Sanctum Leaf Extract, Melia Azadirachta Leaf Extract, Ceramide NP, Curcuma Longa (Turmeric) Root Extract, Corallina Officinalis Extract, Beta-Glucan, Dipotassium Glycyrrhizate, Tocopherol, Ascorbic Acid, Ascorbyl Glucoside, Tocopheryl Acetate, Hydroxypropyl Cyclodextrin, Ubiquinone, Thioctic Acid, Tremella Fuciformis (Mushroom) Extract, Potassium Hydroxide","sourceUrl":"https://us.numbuzin.com/products/no-5-vitamin-concentrated-serum","imageUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/260428___________04RD.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/260428___________04RD.jpg"},{"id":211,"brand":"numbuzin","name":"No.1 Pure-Full Calming Herb Toner","category":"toner","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["panthenol","centella","Centella Asiatica Extract","Madecassoside","Cica Asiatica Ferment","Beta-Glucan","Panthenol"],"bestFor":"Sensitive skin, Redness-prone skin, Barrier-damaged skin, Reactive skin, All skin types","bestForTH":"Sensitive skin, Redness-prone skin, Barrier-damaged skin, Reactive skin, All skin types","howOften":"AM & PM","howOftenTH":"AM & PM","description":"A calming centella toner designed to soothe redness, reduce inflammation, and restore barrier function. Madecassoside targets irritation while beta-glucan and panthenol deliver deep soothing hydration. Fragrance-free and gentle enough for post-procedure or compromised skin.","descriptionTH":"A calming centella toner designed to soothe redness, reduce inflammation, and restore barrier function. Madecassoside targets irritation while beta-glucan and panthenol deliver deep soothing hydration. Fragrance-free and gentle enough for post-procedure or compromised skin.","doNotCombine":"Compatible with most gentle actives. Avoid pairing with strong exfoliants on barrier-compromised skin.","doNotCombineTH":"Compatible with most gentle actives. Avoid pairing with strong exfoliants on barrier-compromised skin.","medicubeMode":"Booster Mode","makeupPrep":true,"ingredients":"Water, 1,2-Hexanediol, Dipropylene Glycol, Propanediol, Butylene Glycol, Glycerin, Glycyrrhiza Uralensis (Licorice) Root Extract, Houttuynia Cordata Extract, Carbomer, Centella Asiatica Extract, Hydroxyethylcellulose, Arginine, Allantoin, Disodium EDTA, Polygonum Multiflorum Extract, Betaine, Hyacinthus Orientalis (Hyacinth) Extract, Panthenol, Nymphaea Alba Flower Extract","sourceUrl":"https://us.numbuzin.com/products/no-1-pure-full-calming-herb-toner","imageUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/US_1_300ml.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/US_1_300ml.jpg"},{"id":212,"brand":"numbuzin","name":"No.3 Super Glowing Essence Toner","category":"toner","fragranceFree":false,"alcoholFree":true,"eoFree":false,"activeIngredients":["niacinamide","Galactomyces Ferment Filtrate","Rose Water","Niacinamide","Rose Hip Extract"],"bestFor":"Dull skin, Brightening, Combination skin, Oily skin, Normal skin","bestForTH":"Dull skin, Brightening, Combination skin, Oily skin, Normal skin","howOften":"AM & PM","howOftenTH":"AM & PM","description":"A galactomyces-powered glow toner with a rosy essence texture. Rose water and rose hip extract provide antioxidant hydration while niacinamide brightens and refines texture. Note: contains rose geranium essential oil — patch test recommended for sensitive skin.","descriptionTH":"A galactomyces-powered glow toner with a rosy essence texture. Rose water and rose hip extract provide antioxidant hydration while niacinamide brightens and refines texture. Note: contains rose geranium essential oil — patch test recommended for sensitive skin.","doNotCombine":"Not recommended for very sensitive or essential-oil-reactive skin. Patch test first. Avoid with strong exfoliants on compromised skin.","doNotCombineTH":"Not recommended for very sensitive or essential-oil-reactive skin. Patch test first. Avoid with strong exfoliants on compromised skin.","medicubeMode":"Booster Mode","makeupPrep":false,"ingredients":"WATER, DIPROPYLENE GLYCOL, GLYCERETH-26, 1,2-HEXANEDIOL, NIACINAMIDE, BUTYLENE GLYCOL, GLYCERIN, METHYL GLUCETH-20, SPIRAEA ULMARIA EXTRACT, LACTOCOCCUS/BEAN SEED EXTRACT FERMENTFILTRATE, LACTOBACILLUS/RICE FERMENT, CHLORELLA FERMENT, LACTOBACILLUS/ALGAE EXTRACT FERMENT, SACCHAROMYCES/GRAPE FERMENT EXTRACT, LACTOBACILLUS/PUMPKIN FERMENT EXTRACT, LACTOBACILLUS/SOYBEAN FERMENT EXTRACT, LACTOBACILLUS/SOYBEAN EXTRACT FERMENTFILTRATE, SACCHAROMYCES/RICE FERMENT FILTRATE, SACCHAROMYCES/BARLEY SEED FERMENTFILTRATE, SACCHAROMYCES/CALCIUM FERMENT, SACCHAROMYCES/LAMINARIA SACCHARINA FERMENT, SACCHAROMYCES/POTATO EXTRACT FERMENTFILTRATE, LACTOBACILLUS/ERIODICTYON CALIFORNICUM FERMENT EXTRACT, LACTOBACILLUS/WATER HYACINTH FERMENT, LACTOBACILLUS/RYE FLOUR FERMENT, LACTOBACILLUS/HIBISCUS SABDARIFFA FLOWER FERMENT FILTRATE, LACTOBACILLUS/MILK FERMENT FILTRATE, LACTOBACILLUS/GINSENG ROOT FERMENT FILTRATE, LACTOBACILLUS/ACEROLA CHERRY FERMENT, LACTOBACILLUS FERMENT, LACTOBACILLUS FERMENT LYSATE FILTRATE, LACTOCOCCUS/MILK FERMENT LYSATE, LACTOCOCCUS FERMENT, LACTOCOCCUS FERMENT EXTRACT, LACTOCOCCUS FERMENT LYSATE, STREPTOCOCCUS THERMOPHILUS FERMENT, AUREOBASIDIUM PULLULANS FERMENT FILTRATE, BIFIDA FERMENT FILTRATE, BIFIDA FERMENT EXTRACT, LEUCONOSTOC/RADISH ROOT FERMENT FILTRATE, LACTOBACILLUS/WASABIA JAPONICA ROOT FERMENT EXTRACT, LACTOBACILLUS/PUNICA GRANATUM FRUIT FERMENT EXTRACT, BACILLUS/GLUTAMIC ACID FERMENT FILTRATE, BACILLUS/RICE BRAN EXTRACT/SOYBEAN EXTRACT FERMENT FILTRATE, MONASCUS/RICE FERMENT, SACCHAROMYCES/RICE BRAN FERMENT FILTRATE EXTRACT, SACCHAROMYCES/RICE BRAN FERMENT, LACTOBACILLUS/PEAR JUICE FERMENT FILTRATE, PICHIA FERMENT LYSATE FILTRATE, ALTEROMONAS FERMENT EXTRACT, SACCHAROMYCES/COIX LACRYMA-JOBI MA-YUEN SEED FERMENT FILTRATE, SACCHAROMYCES/SOY PROTEIN FERMENT, SPHINGOMONAS FERMENT EXTRACT, SACCHAROMYCES/MALACHITE FERMENT, SACCHAROMYCES FERMENT, SACCHAROMYCES FERMENT FILTRATE, SCHIZOSACCHAROMYCES FERMENT FILTRATE, ASPERGILLUS FERMENT, ASPERGILLUS/GLUCOSE/SOYBEAN/STARCH FERMENT FILTRATE, PELARGONIUM GRAVEOLENS FLOWER OIL, SODIUM HYALURONATE, POLYGLYCERYL-10 LAURATE, CETEARYL ALCOHOL, BETAINE, ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER, TROMETHAMINE, POLYQUATERNIUM-51, HYDROXYETHYLCELLULOSE, ADENOSINE, GERANIOL, CITRONELLOL","sourceUrl":"https://us.numbuzin.com/products/no-3-super-glowing-essence-toner","imageUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/250527_________08.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/250527_________08.jpg"},{"id":213,"brand":"numbuzin","name":"No.1 Pantothenic Skincare 100 Powder","category":"treatment","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["panthenol","Pantothenic Acid (Vitamin B5) 100%","Panthenol"],"bestFor":"Dry skin, Dehydrated skin, Sensitive skin, Barrier-repair, All skin types","bestForTH":"Dry skin, Dehydrated skin, Sensitive skin, Barrier-repair, All skin types","howOften":"As needed","howOftenTH":"As needed","description":"A pure pantothenic acid (Vitamin B5) powder booster that intensifies the hydration and barrier-repair benefits of any serum or moisturiser. Mixes seamlessly into water-based products for a customisable skincare boost. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A pure pantothenic acid (Vitamin B5) powder booster that intensifies the hydration and barrier-repair benefits of any serum or moisturiser. Mixes seamlessly into water-based products for a customisable skincare boost. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"Compatible with most skincare actives. Mix into water-based products only (not oils). Do not mix into sunscreen as this may affect SPF efficacy.","doNotCombineTH":"Compatible with most skincare actives. Mix into water-based products only (not oils). Do not mix into sunscreen as this may affect SPF efficacy.","medicubeMode":"None","makeupPrep":true,"ingredients":"Silica, Dimethicone, Zea Mays (Corn) Starch, Aluminum Starch Octenylsuccinate, Vinyl Dimethicone/Methicone Silsesquioxane Crosspolymer, Mica (CI 77019), Dimethicone/Vinyl Dimethicone Crosspolymer, Caprylic/Capric Triglyceride, Octyldodecyl Stearoyl Stearate, Calamine, Pantothenic Acid, Zinc PCA, Caprylyl Glycol, Niacinamide, Ethylhexylglycerin, Macadamia Ternifolia Seed Oil, Centella Asiatica Extract, Dipotassium Glycyrrhizate, Madecassoside, Tocopherol","sourceUrl":"https://us.numbuzin.com/products/no-1-pantothenic-skincare-100-powder","imageUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/45.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0573/3793/8117/files/45.jpg"},{"id":214,"imageUrl":"https://cdn.shopify.com/s/files/1/0563/1701/8217/files/S-13_af029c1e-dc11-4984-b82e-8c81c4002b30.jpg?v=1779327018","brand":"SKINTIFIC","name":"5% Ceramide Niacinamide Barrier Repair Serum","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["ceramides","niacinamide","panthenol","allantoin","centella"],"bestFor":"Dry skin, Sensitive skin, Damaged barrier, Redness, Dehydration, All skin types","bestForTH":"Dry skin, Sensitive skin, Damaged barrier, Redness, Dehydration, All skin types","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A barrier-rebuilding serum combining 5% ceramide complex with niacinamide to restore the skin's protective moisture barrier. Soothes redness, repairs dryness, and strengthens skin resilience against environmental stressors. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A barrier-rebuilding serum combining 5% ceramide complex with niacinamide to restore the skin's protective moisture barrier. Soothes redness, repairs dryness, and strengthens skin resilience against environmental stressors. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"Avoid layering with high-strength AHA/BHA in the same step","doNotCombineTH":"Avoid layering with high-strength AHA/BHA in the same step","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Glycerin, Niacinamide, Ceramide NP, Ceramide AP, Ceramide EOP, Panthenol, Allantoin, Centella Asiatica Extract, Sodium Hyaluronate, Carbomer, Phenoxyethanol, Ethylhexylglycerin","sourceUrl":"https://www.skintific.com/products/5-ceramide-niacinamide-barrier-repair-serum","imageUrl":"https://www.skintific.com/cdn/shop/products/5ceramide-serum.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0563/1701/8217/files/S-13_af029c1e-dc11-4984-b82e-8c81c4002b30.jpg?v=1779327018"},{"id":215,"brand":"SKINTIFIC","name":"Mugwort Pore Cleansing Balancing Toner","category":"toner","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["mugwort","bha","niacinamide","centella","hyaluronic acid"],"bestFor":"Oily skin, Combination skin, Enlarged pores, Blackheads, Acne-prone skin","bestForTH":"Oily skin, Combination skin, Enlarged pores, Blackheads, Acne-prone skin","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A pore-refining toner infused with mugwort extract and BHA to gently exfoliate, remove excess sebum, and minimise pores. Niacinamide brightens while centella asiatica soothes skin. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A pore-refining toner infused with mugwort extract and BHA to gently exfoliate, remove excess sebum, and minimise pores. Niacinamide brightens while centella asiatica soothes skin. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"Avoid combining with strong retinol or high-concentration AHA in the same step","doNotCombineTH":"Avoid combining with strong retinol or high-concentration AHA in the same step","medicubeMode":"None","makeupPrep":false,"ingredients":"Water, Glycerin, Artemisia Vulgaris Extract, Salicylic Acid, Niacinamide, Centella Asiatica Extract, Betaine, Hyaluronic Acid, 1,2-Hexanediol, Sodium PCA, Allantoin, Panthenol","sourceUrl":"https://www.skintific.com/products/mugwort-pore-cleansing-balancing-toner","imageUrl":"https://www.skintific.com/cdn/shop/products/mugwort-toner.jpg","thumbnailUrl":"https://www.skintific.com/cdn/shop/products/mugwort-toner.jpg"},{"id":216,"imageUrl":"https://cdn.shopify.com/s/files/1/0563/1701/8217/files/05_b7b10cf3-5c3f-49f9-a12b-69a31a610636.jpg?v=1775553036","brand":"SKINTIFIC","name":"5X Ceramide Moisturizing Gel Cream","category":"moisturizer","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["ceramides","hyaluronic acid","niacinamide","panthenol","squalane"],"bestFor":"All skin types, Dry skin, Combination skin, Barrier repair, Hydration","bestForTH":"All skin types, Dry skin, Combination skin, Barrier repair, Hydration","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A lightweight gel-cream moisturiser with 5X ceramide complex to repair and strengthen the skin barrier. Provides long-lasting hydration without heaviness, leaving skin plump, smooth, and balanced. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A lightweight gel-cream moisturiser with 5X ceramide complex to repair and strengthen the skin barrier. Provides long-lasting hydration without heaviness, leaving skin plump, smooth, and balanced. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"None known","doNotCombineTH":"None known","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Glycerin, Squalane, Niacinamide, Ceramide NP, Ceramide AP, Ceramide EOP, Ceramide NG, Ceramide NS, Sodium Hyaluronate, Panthenol, Allantoin, Dimethicone, Carbomer, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin","sourceUrl":"https://www.skintific.com/products/5x-ceramide-moisturizing-gel-cream","imageUrl":"https://www.skintific.com/cdn/shop/products/5x-ceramide-gel-cream.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0563/1701/8217/files/05_b7b10cf3-5c3f-49f9-a12b-69a31a610636.jpg?v=1775553036"},{"id":217,"imageUrl":"https://cdn.shopify.com/s/files/1/0563/1701/8217/files/S-315-_1.jpg?v=1776134577","brand":"SKINTIFIC","name":"Low pH Pore Cleansing Gel Cleanser","category":"cleanser","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["bha","green tea","niacinamide","panthenol"],"bestFor":"Oily skin, Acne-prone skin, Enlarged pores, Blackheads, Combination skin","bestForTH":"Oily skin, Acne-prone skin, Enlarged pores, Blackheads, Combination skin","howOften":"AM and/or PM","howOftenTH":"AM and/or PM","description":"A low-pH gel cleanser formulated with BHA to deeply cleanse pores and remove excess oil. Green tea extract provides antioxidant protection while niacinamide brightens, leaving skin clean and balanced. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A low-pH gel cleanser formulated with BHA to deeply cleanse pores and remove excess oil. Green tea extract provides antioxidant protection while niacinamide brightens, leaving skin clean and balanced. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"Avoid combining with other exfoliating cleansers or strong physical scrubs","doNotCombineTH":"Avoid combining with other exfoliating cleansers or strong physical scrubs","medicubeMode":"None","makeupPrep":false,"ingredients":"Water, Glycerin, Cocamidopropyl Betaine, Sodium Laureth Sulfate, Salicylic Acid, Niacinamide, Camellia Sinensis Leaf Extract, Panthenol, Allantoin, Citric Acid, Phenoxyethanol, Ethylhexylglycerin","sourceUrl":"https://www.skintific.com/products/low-ph-pore-cleansing-gel-cleanser","imageUrl":"https://www.skintific.com/cdn/shop/products/low-ph-cleanser.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0563/1701/8217/files/S-315-_1.jpg?v=1776134577"},{"id":218,"brand":"SKINTIFIC","name":"Mugwort Jelly Cleanser","category":"cleanser","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["mugwort","centella","allantoin","panthenol","hyaluronic acid"],"bestFor":"Sensitive skin, Acne-prone skin, Redness, Irritation, Calming, All skin types","bestForTH":"Sensitive skin, Acne-prone skin, Redness, Irritation, Calming, All skin types","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A gentle jelly-textured cleanser enriched with mugwort and centella asiatica to calm and soothe sensitive or reactive skin. Effectively removes impurities and excess oil without stripping the skin's natural moisture. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A gentle jelly-textured cleanser enriched with mugwort and centella asiatica to calm and soothe sensitive or reactive skin. Effectively removes impurities and excess oil without stripping the skin's natural moisture. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"None known","doNotCombineTH":"None known","medicubeMode":"None","makeupPrep":false,"ingredients":"Water, Glycerin, Cocamidopropyl Betaine, Decyl Glucoside, Artemisia Vulgaris Extract, Centella Asiatica Extract, Allantoin, Panthenol, Sodium Hyaluronate, Carbomer, Sodium Hydroxide, Phenoxyethanol, Ethylhexylglycerin","sourceUrl":"https://www.skintific.com/products/mugwort-jelly-cleanser","imageUrl":"https://www.skintific.com/cdn/shop/products/mugwort-jelly-cleanser.jpg","thumbnailUrl":"https://www.skintific.com/cdn/shop/products/mugwort-jelly-cleanser.jpg"},{"id":219,"brand":"SKINTIFIC","name":"1000 Hyaluronic Acid Water Drip Serum","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid","panthenol"],"bestFor":"Dehydrated skin, All skin types, Plumping, Hydration boost, Fine lines","bestForTH":"Dehydrated skin, All skin types, Plumping, Hydration boost, Fine lines","howOften":"AM and PM","howOftenTH":"AM and PM","description":"An ultra-hydrating serum with 1000 types of hyaluronic acid molecules that penetrate multiple skin layers to deliver deep, lasting moisture. Leaves skin visibly plumper, smoother, and deeply hydrated. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"An ultra-hydrating serum with 1000 types of hyaluronic acid molecules that penetrate multiple skin layers to deliver deep, lasting moisture. Leaves skin visibly plumper, smoother, and deeply hydrated. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"None known","doNotCombineTH":"None known","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Glycerin, Sodium Hyaluronate, Hydrolyzed Hyaluronic Acid, Hyaluronic Acid, Sodium Hyaluronate Crosspolymer, Panthenol, Betaine, Allantoin, Carbomer, Phenoxyethanol, Ethylhexylglycerin","sourceUrl":"https://www.skintific.com/products/1000-hyaluronic-acid-water-drip-serum","imageUrl":"https://www.skintific.com/cdn/shop/products/1000ha-water-drip-serum.jpg","thumbnailUrl":"https://www.skintific.com/cdn/shop/products/1000ha-water-drip-serum.jpg"},{"id":220,"imageUrl":"https://cdn.shopify.com/s/files/1/0563/1701/8217/files/04_0330d2fa-23fe-4fc3-8b0f-123e0f47ed35.jpg?v=1763436284","brand":"SKINTIFIC","name":"Niacinamide 10% + Zinc Bright Spot Serum","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide","zinc pca","tranexamic acid","arbutin","panthenol"],"bestFor":"Hyperpigmentation, Dark spots, Oily skin, Acne marks, Uneven skin tone, Brightening","bestForTH":"Hyperpigmentation, Dark spots, Oily skin, Acne marks, Uneven skin tone, Brightening","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A brightening serum combining 10% niacinamide with zinc PCA to fade dark spots, control sebum, and visibly even skin tone. Tranexamic acid and alpha-arbutin amplify brightening effects for a clearer, luminous complexion. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A brightening serum combining 10% niacinamide with zinc PCA to fade dark spots, control sebum, and visibly even skin tone. Tranexamic acid and alpha-arbutin amplify brightening effects for a clearer, luminous complexion. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"Avoid combining with high-strength Vitamin C (LAA) or strong AHA in the same step","doNotCombineTH":"Avoid combining with high-strength Vitamin C (LAA) or strong AHA in the same step","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Glycerin, Niacinamide, Zinc PCA, Tranexamic Acid, Alpha-Arbutin, Panthenol, Sodium Hyaluronate, Allantoin, Carbomer, Phenoxyethanol, Ethylhexylglycerin","sourceUrl":"https://www.skintific.com/products/niacinamide-10-zinc-bright-spot-serum","imageUrl":"https://www.skintific.com/cdn/shop/products/niacinamide-10-zinc-serum.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0563/1701/8217/files/04_0330d2fa-23fe-4fc3-8b0f-123e0f47ed35.jpg?v=1763436284"},{"id":221,"brand":"Dr. Althea","name":"Pro-Activator Ampoule Toner","category":"toner","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["ferment filtrate","beta-glucan","niacinamide","panthenol","centella","hyaluronic acid"],"bestFor":"Dull skin, Dehydrated skin, All skin types, Brightening, Prep step, Hydration","bestForTH":"Dull skin, Dehydrated skin, All skin types, Brightening, Prep step, Hydration","howOften":"AM and PM","howOftenTH":"AM and PM","description":"An essence-toner hybrid that primes skin for better absorption of subsequent products. Fermented yeast extract and beta-glucan deliver deep hydration while niacinamide brightens, creating the perfect canvas for your routine. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"An essence-toner hybrid that primes skin for better absorption of subsequent products. Fermented yeast extract and beta-glucan deliver deep hydration while niacinamide brightens, creating the perfect canvas for your routine. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"None known","doNotCombineTH":"None known","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Glycerin, Saccharomyces Ferment Filtrate, Beta-Glucan, Niacinamide, Panthenol, Centella Asiatica Extract, Sodium Hyaluronate, Allantoin, 1,2-Hexanediol, Phenoxyethanol","sourceUrl":"https://en.draltehea.com/product/pro-activator-ampoule-toner","imageUrl":"https://en.draltehea.com/web/product/big/pro-activator-ampoule-toner.jpg","thumbnailUrl":"https://en.draltehea.com/web/product/big/pro-activator-ampoule-toner.jpg"},{"id":222,"brand":"Dr. Althea","name":"Pro Cleansing Oil","category":"oil cleanser","subcategory":"cleansing oil","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["sunflower oil","rice bran oil","jojoba oil","niacinamide","ceramides"],"bestFor":"All skin types, Makeup removal, Sunscreen removal, Deep cleansing, First cleanse","bestForTH":"All skin types, Makeup removal, Sunscreen removal, Deep cleansing, First cleanse","howOften":"PM only (first cleanse)","howOftenTH":"PM only (first cleanse)","description":"A lightweight cleansing oil that effortlessly melts away makeup, SPF, and impurities without stripping the skin. Enriched with nourishing plant oils and ceramide to leave skin clean, soft, and balanced after the first cleanse. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A lightweight cleansing oil that effortlessly melts away makeup, SPF, and impurities without stripping the skin. Enriched with nourishing plant oils and ceramide to leave skin clean, soft, and balanced after the first cleanse. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"Use as first cleanse only; follow with a water-based cleanser","doNotCombineTH":"Use as first cleanse only; follow with a water-based cleanser","medicubeMode":"None","makeupPrep":false,"ingredients":"Dicaprylyl Carbonate, Caprylic/Capric Triglyceride, Helianthus Annuus Seed Oil, Oryza Sativa Bran Oil, Simmondsia Chinensis Seed Oil, Niacinamide, Ceramide NP, PEG-20 Glyceryl Triisostearate, Tocopherol","sourceUrl":"https://en.draltehea.com/product/pro-cleansing-oil","imageUrl":"https://en.draltehea.com/web/product/big/pro-cleansing-oil.jpg","thumbnailUrl":"https://en.draltehea.com/web/product/big/pro-cleansing-oil.jpg"},{"id":223,"brand":"Dr. Althea","name":"Collagen Plump Toner","category":"toner","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["peptides","niacinamide","hyaluronic acid","collagen"],"bestFor":"Mature skin, Loss of elasticity, Fine lines, Dehydrated skin, Plumping, Anti-aging","bestForTH":"Mature skin, Loss of elasticity, Fine lines, Dehydrated skin, Plumping, Anti-aging","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A plumping toner infused with hydrolyzed collagen and peptides to visibly firm and volumise skin. Tremella mushroom extract provides intense hydration while niacinamide brightens, restoring a youthful, bouncy complexion. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A plumping toner infused with hydrolyzed collagen and peptides to visibly firm and volumise skin. Tremella mushroom extract provides intense hydration while niacinamide brightens, restoring a youthful, bouncy complexion. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"None known","doNotCombineTH":"None known","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Glycerin, Hydrolyzed Collagen, Tripeptide-1, Niacinamide, Sodium Hyaluronate, Tremella Fuciformis Sporocarp Extract, Panthenol, Allantoin, 1,2-Hexanediol, Phenoxyethanol","sourceUrl":"https://en.draltehea.com/product/collagen-plump-toner","imageUrl":"https://en.draltehea.com/web/product/big/collagen-plump-toner.jpg","thumbnailUrl":"https://en.draltehea.com/web/product/big/collagen-plump-toner.jpg"},{"id":224,"brand":"Dr. Althea","name":"Retinol Firming Eye Cream","category":"eye cream","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["retinol","peptides","ceramides","caffeine","hyaluronic acid"],"bestFor":"Mature skin, Crow's feet, Fine lines, Puffiness, Dark circles, Firming","bestForTH":"Mature skin, Crow's feet, Fine lines, Puffiness, Dark circles, Firming","howOften":"PM only","howOftenTH":"PM only","description":"A firming eye cream with low-dose retinol and multi-peptide complex to address crow's feet, fine lines, and loss of firmness around the eye area. Caffeine reduces puffiness while ceramide reinforces the delicate skin barrier. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A firming eye cream with low-dose retinol and multi-peptide complex to address crow's feet, fine lines, and loss of firmness around the eye area. Caffeine reduces puffiness while ceramide reinforces the delicate skin barrier. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"Do not combine with other retinol products or AHA/BHA around the eye area","doNotCombineTH":"Do not combine with other retinol products or AHA/BHA around the eye area","medicubeMode":"None","makeupPrep":false,"ingredients":"Water, Glycerin, Retinol, Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7, Caffeine, Ceramide NP, Sodium Hyaluronate, Squalane, Niacinamide, Panthenol, Caprylic/Capric Triglyceride, Phenoxyethanol","sourceUrl":"https://en.draltehea.com/product/retinol-firming-eye-cream","imageUrl":"https://en.draltehea.com/web/product/big/retinol-firming-eye-cream.jpg","thumbnailUrl":"https://en.draltehea.com/web/product/big/retinol-firming-eye-cream.jpg"},{"id":225,"brand":"Round Lab","name":"1025 Dokdo Tone-Up Sunscreen","category":"sunscreen","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["titanium dioxide","zinc oxide","niacinamide","hyaluronic acid","panthenol"],"bestFor":"All skin types, Daily sun protection, Brightening, Tone-up, Dewy finish","bestForTH":"All skin types, Daily sun protection, Brightening, Tone-up, Dewy finish","howOften":"AM only","howOftenTH":"AM only","description":"A tone-up sunscreen with SPF 50+ PA++++ that blurs imperfections and brightens skin while providing broad-spectrum sun protection. Formulated with mineral-rich Dokdo water for a lightweight, dewy finish. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A tone-up sunscreen with SPF 50+ PA++++ that blurs imperfections and brightens skin while providing broad-spectrum sun protection. Formulated with mineral-rich Dokdo water for a lightweight, dewy finish. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"Apply as the final step in your morning routine","doNotCombineTH":"Apply as the final step in your morning routine","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Titanium Dioxide, Zinc Oxide, Cyclopentasiloxane, Niacinamide, Sodium Hyaluronate, Glycerin, Panthenol, Dimethicone, Cetyl Alcohol, 1,2-Hexanediol, Phenoxyethanol","sourceUrl":"https://roundlab.com/en/product/1025-dokdo-tone-up-sunscreen","imageUrl":"https://roundlab.com/en/cdn/shop/products/1025-tone-up-sunscreen.jpg","thumbnailUrl":"https://roundlab.com/en/cdn/shop/products/1025-tone-up-sunscreen.jpg"},{"id":226,"brand":"Round Lab","name":"Birch Juice Moisturizing Mist","category":"mist","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["birch water","hyaluronic acid","allantoin","panthenol"],"bestFor":"All skin types, Dehydrated skin, On-the-go hydration, Refreshing, Sensitive skin","bestForTH":"All skin types, Dehydrated skin, On-the-go hydration, Refreshing, Sensitive skin","howOften":"As needed throughout the day","howOftenTH":"As needed throughout the day","description":"A lightweight hydrating mist with 98% birch juice that instantly refreshes and replenishes moisture throughout the day. Free from harsh additives, it can be used over or under makeup for a dewy boost anytime. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A lightweight hydrating mist with 98% birch juice that instantly refreshes and replenishes moisture throughout the day. Free from harsh additives, it can be used over or under makeup for a dewy boost anytime. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"None known","doNotCombineTH":"None known","medicubeMode":"None","makeupPrep":false,"ingredients":"Betula Platyphylla Japonica Juice, Glycerin, Sodium Hyaluronate, Allantoin, Panthenol, Betaine, 1,2-Hexanediol, Phenoxyethanol","sourceUrl":"https://roundlab.com/en/product/birch-juice-moisturizing-mist","imageUrl":"https://roundlab.com/en/cdn/shop/products/birch-juice-mist.jpg","thumbnailUrl":"https://roundlab.com/en/cdn/shop/products/birch-juice-mist.jpg"},{"id":227,"imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/mugwort-calming-toner-round-lab-1.png?v=1772849391","brand":"Round Lab","name":"Mugwort Calming Toner","category":"toner","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["mugwort","centella","beta-glucan","allantoin","niacinamide","hyaluronic acid"],"bestFor":"Sensitive skin, Acne-prone skin, Redness, Irritation, Calming, Oily skin","bestForTH":"Sensitive skin, Acne-prone skin, Redness, Irritation, Calming, Oily skin","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A calming toner with high concentration of mugwort extract to soothe irritated, reactive skin. Centella asiatica and beta-glucan strengthen the skin barrier while allantoin reduces redness for a calm, balanced complexion. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A calming toner with high concentration of mugwort extract to soothe irritated, reactive skin. Centella asiatica and beta-glucan strengthen the skin barrier while allantoin reduces redness for a calm, balanced complexion. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"None known","doNotCombineTH":"None known","medicubeMode":"None","makeupPrep":true,"ingredients":"Artemisia Vulgaris Extract, Water, Glycerin, Beta-Glucan, Centella Asiatica Extract, Allantoin, Niacinamide, Sodium Hyaluronate, Panthenol, 1,2-Hexanediol, Phenoxyethanol","sourceUrl":"https://roundlab.com/en/product/mugwort-calming-toner","imageUrl":"https://roundlab.com/en/cdn/shop/products/mugwort-calming-toner.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/mugwort-calming-toner-round-lab-1.png?v=1772849391"},{"id":228,"imageUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/mugwort-calming-moisturizer-round-lab-1.png?v=1772849461","brand":"Round Lab","name":"Mugwort Calming Cream","category":"moisturizer","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["mugwort","ceramides","centella","beta-glucan","allantoin","niacinamide"],"bestFor":"Sensitive skin, Redness, Irritation, Barrier repair, Acne-prone skin, Calming","bestForTH":"Sensitive skin, Redness, Irritation, Barrier repair, Acne-prone skin, Calming","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A soothing moisturiser rich in mugwort extract and ceramide to calm inflammation, repair the skin barrier, and provide lasting hydration. Ideal for sensitive or acne-prone skin that needs gentle, effective calming care. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A soothing moisturiser rich in mugwort extract and ceramide to calm inflammation, repair the skin barrier, and provide lasting hydration. Ideal for sensitive or acne-prone skin that needs gentle, effective calming care. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"None known","doNotCombineTH":"None known","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Glycerin, Artemisia Vulgaris Extract, Ceramide NP, Centella Asiatica Extract, Beta-Glucan, Allantoin, Squalane, Dimethicone, Niacinamide, Panthenol, Carbomer, Sodium Hydroxide, Phenoxyethanol, Ethylhexylglycerin","sourceUrl":"https://roundlab.com/en/product/mugwort-calming-cream","imageUrl":"https://roundlab.com/en/cdn/shop/products/mugwort-calming-cream.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0651/7656/8022/files/mugwort-calming-moisturizer-round-lab-1.png?v=1772849461"},{"id":229,"imageUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1_Atobarrier365-FoamingCleanser_thumbnail_product-150ml__1200x1200_ee99c37c-1566-4a5a-8342-59f6d5b460db.png?v=1733993670","brand":"Aestura","name":"Atobarrier 365 Ceramide Foam Cleanser","category":"cleanser","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["ceramides","panthenol","allantoin","centella"],"bestFor":"Dry skin, Sensitive skin, Eczema-prone skin, Barrier repair, Gentle cleansing","bestForTH":"Dry skin, Sensitive skin, Eczema-prone skin, Barrier repair, Gentle cleansing","howOften":"AM and/or PM","howOftenTH":"AM and/or PM","description":"A ceramide-enriched foam cleanser that gently removes impurities while reinforcing the skin's moisture barrier. Dermatologist-tested for sensitive and eczema-prone skin, leaving the skin clean, soft, and never stripped. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A ceramide-enriched foam cleanser that gently removes impurities while reinforcing the skin's moisture barrier. Dermatologist-tested for sensitive and eczema-prone skin, leaving the skin clean, soft, and never stripped. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"None known","doNotCombineTH":"None known","medicubeMode":"None","makeupPrep":false,"ingredients":"Water, Glycerin, Cocamidopropyl Betaine, Sodium Laureth Sulfate, Ceramide NP, Ceramide AP, Ceramide EOP, Panthenol, Allantoin, Centella Asiatica Extract, Sodium Hyaluronate, Citric Acid, Phenoxyethanol","sourceUrl":"https://www.aestura.com/en/product/atobarrier365-ceramide-foam-cleanser","imageUrl":"https://www.aestura.com/cdn/shop/products/atobarrier-foam-cleanser.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1_Atobarrier365-FoamingCleanser_thumbnail_product-150ml__1200x1200_ee99c37c-1566-4a5a-8342-59f6d5b460db.png?v=1733993670"},{"id":230,"imageUrl":"https://int.aestura.com/cdn/shop/files/1_Atobarrier365-Hydro_Essence_thumbnail_Product-200ml__1200x1200_5b44c8c6-f402-4c16-94ed-8a8df78a6ded.png?v=1734030285","brand":"Aestura","name":"Atobarrier 365 Ceramide Toner","category":"toner","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["ceramides","panthenol","allantoin","beta-glucan","hyaluronic acid"],"bestFor":"Dry skin, Sensitive skin, Barrier repair, Dehydration, Eczema-prone skin","bestForTH":"Dry skin, Sensitive skin, Barrier repair, Dehydration, Eczema-prone skin","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A hydrating, ceramide-rich toner that replenishes moisture and reinforces the skin barrier after cleansing. Formulated for sensitive and eczema-prone skin, it delivers instant hydration and prepares skin for subsequent care. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A hydrating, ceramide-rich toner that replenishes moisture and reinforces the skin barrier after cleansing. Formulated for sensitive and eczema-prone skin, it delivers instant hydration and prepares skin for subsequent care. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"None known","doNotCombineTH":"None known","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Glycerin, Ceramide NP, Panthenol, Allantoin, Beta-Glucan, Sodium Hyaluronate, Betaine, 1,2-Hexanediol, Phenoxyethanol","sourceUrl":"https://www.aestura.com/en/product/atobarrier365-ceramide-toner","imageUrl":"https://www.aestura.com/cdn/shop/products/atobarrier-toner.jpg","thumbnailUrl":"https://int.aestura.com/cdn/shop/files/1_Atobarrier365-Hydro_Essence_thumbnail_Product-200ml__1200x1200_5b44c8c6-f402-4c16-94ed-8a8df78a6ded.png?v=1734030285"},{"id":231,"imageUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1200x1200___365.png?v=1742801803","brand":"Aestura","name":"Theracne 365 Soothing Gel","category":"moisturizer","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["madecassoside","centella","panthenol","allantoin","niacinamide","hyaluronic acid"],"bestFor":"Acne-prone skin, Post-breakout redness, Irritation, Soothing, Sensitive skin","bestForTH":"Acne-prone skin, Post-breakout redness, Irritation, Soothing, Sensitive skin","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A lightweight soothing gel formulated with madecassoside and centella asiatica to reduce acne-associated redness and irritation. Accelerates recovery of troubled skin while providing oil-free, non-comedogenic hydration. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"A lightweight soothing gel formulated with madecassoside and centella asiatica to reduce acne-associated redness and irritation. Accelerates recovery of troubled skin while providing oil-free, non-comedogenic hydration. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"None known","doNotCombineTH":"None known","medicubeMode":"None","makeupPrep":true,"ingredients":"Water, Glycerin, Madecassoside, Centella Asiatica Extract, Panthenol, Allantoin, Niacinamide, Sodium Hyaluronate, Carbomer, Sodium Hydroxide, 1,2-Hexanediol, Phenoxyethanol","sourceUrl":"https://www.aestura.com/en/product/theracne365-soothing-gel","imageUrl":"https://www.aestura.com/cdn/shop/products/theracne-soothing-gel.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1200x1200___365.png?v=1742801803"},{"id":232,"imageUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1200x1200___365_1a9fcd7a-3389-4d02-aa50-2ffb1e6d5fcf.png?v=1742874026","brand":"Aestura","name":"Theracne 365 Cleanser","category":"cleanser","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["bha","madecassoside","centella","allantoin","panthenol"],"bestFor":"Acne-prone skin, Oily skin, Blackheads, Breakouts, Sebum control","bestForTH":"Acne-prone skin, Oily skin, Blackheads, Breakouts, Sebum control","howOften":"AM and/or PM","howOftenTH":"AM and/or PM","description":"An acne-care cleanser with salicylic acid and madecassoside to clear pores, reduce blackheads, and calm inflammation. Centella asiatica soothes post-acne irritation while allantoin ensures skin stays hydrated and comfortable after cleansing. Fragrance-free, alcohol-free, and EO-free.","descriptionTH":"An acne-care cleanser with salicylic acid and madecassoside to clear pores, reduce blackheads, and calm inflammation. Centella asiatica soothes post-acne irritation while allantoin ensures skin stays hydrated and comfortable after cleansing. Fragrance-free, alcohol-free, and EO-free.","doNotCombine":"Avoid combining with other exfoliating cleansers","doNotCombineTH":"Avoid combining with other exfoliating cleansers","medicubeMode":"None","makeupPrep":false,"ingredients":"Water, Glycerin, Cocamidopropyl Betaine, Sodium Laureth Sulfate, Salicylic Acid, Madecassoside, Centella Asiatica Extract, Allantoin, Panthenol, Citric Acid, Phenoxyethanol, Ethylhexylglycerin","sourceUrl":"https://www.aestura.com/en/product/theracne365-acne-cleanser","imageUrl":"https://www.aestura.com/cdn/shop/products/theracne-cleanser.jpg","thumbnailUrl":"https://cdn.shopify.com/s/files/1/0723/3775/2306/files/1200x1200___365_1a9fcd7a-3389-4d02-aa50-2ffb1e6d5fcf.png?v=1742874026"},
{"id":233,"brand":"Purito","name":"TXA 6 Niacinamide 10 Retinal Serum","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["tranexamic acid", "niacinamide", "retinal", "ceramide NP", "centella asiatica", "glutathione", "adenosine", "coenzyme Q10"],"bestFor":"Dark Spots, Hyperpigmentation, Dullness, Uneven Skin Tone, Fine Lines & Texture, Sensitive Skin","bestForTH":"Dark Spots, Hyperpigmentation, Dullness, Uneven Skin Tone, Fine Lines & Texture, Sensitive Skin","howOften":"PM daily","howOftenTH":"PM daily","description":"A multi-active brightening serum combining Tranexamic Acid (6%) and Niacinamide (10%) to visibly reduce dark spots, hyperpigmentation, and uneven skin tone. Encapsulated Retinal (25ppm) gently resurfaces and renews, while Ceramide NP strengthens the skin barrier. Centella Asiatica calms inflammation and Glutathione provides antioxidant support. Fragrance-free and gentle enough for sensitive skin. Shake 3-5 times before use to disperse the capsules. PM only recommended for the Retinal component.","descriptionTH":"A multi-active brightening serum combining Tranexamic Acid (6%) and Niacinamide (10%) to visibly reduce dark spots, hyperpigmentation, and uneven skin tone. Encapsulated Retinal (25ppm) gently resurfaces and renews, while Ceramide NP strengthens the skin barrier. Centella Asiatica calms inflammation and Glutathione provides antioxidant support. Fragrance-free and gentle enough for sensitive skin. Shake 3-5 times before use to disperse the capsules. PM only recommended for the Retinal component.","doNotCombine":"Avoid combining with other retinoids (tretinoin, retinol). Use caution with strong AHAs/BHAs and vitamin C in the same step — may cause irritation. Start 2-3 nights per week and increase gradually.","doNotCombineTH":"Avoid combining with other retinoids (tretinoin, retinol). Use caution with strong AHAs/BHAs and vitamin C in the same step — may cause irritation. Start 2-3 nights per week and increase gradually.","medicubeMode":"None","makeupPrep":false,"ingredients":"Water, Niacinamide(10%), Tranexamic Acid(6%), Glycerin, Caprylic/Capric Triglyceride, 1,2-Hexanediol, Methylpropanediol, Pentylene Glycol, PVP, Ammonium Acryloyldimethyltaurate/VP Copolymer, Butylene Glycol, Agar, Gellan Gum, Ethylhexylglycerin, Sodium Citrate, Hydroxyacetophenone, Citric Acid, Hydroxydecyl Ubiquinone, Adenosine, Lactococcus Ferment Lysate, Hydrogenated Lecithin, Centella Asiatica Extract, Ficus Carica (Fig) Fruit Extract, Fructooligosaccharides, Cyanocobalamin, Xanthan Gum, Retinal(25 ppm), Ceramide NP, Arginine, Tocopherol, Glutathione, Bisabolol, Helianthus Annuus (Sunflower) Seed Oil, Allantoin, Xanthophylls, Sodium Chloride, Phenylpropanol, Levulinic Acid, Sodium Levulinate","sourceUrl":"https://purito.com/product/txa-6-niacinamide-10-retinal-serum/","imageUrl":"https://purito.com/wp-content/uploads/2025/09/TXA-6-Niacinamide-10-Retinal-Serum_pc.jpg","thumbnailUrl":"https://purito.com/wp-content/uploads/2025/09/thumb-1.png"},
{"id":234,"imageUrl":"https://assets.icanet.se/image/upload/c_limit,h_720,w_720/dpr_auto/f_webp/q_auto/v1715252862/1063950_wwdrxj.webp","brand":"CeraVe","name":"Hydrating Hyaluronic Acid Serum","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["hyaluronic acid", "ceramide NP", "ceramide AP", "ceramide EOP", "panthenol", "cholesterol", "phytosphingosine"],"bestFor":"Dehydration & Dryness, Rough & Uneven Texture, Impaired Skin Barrier, All Skin Types, Sensitive Skin","bestForTH":"Dehydration & Dryness, Rough & Uneven Texture, Impaired Skin Barrier, All Skin Types, Sensitive Skin","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A dermatologist-developed lightweight gel-cream serum that delivers intense, long-lasting hydration. Three essential ceramides (NP, AP, EOP) work alongside multi-molecular hyaluronic acid and panthenol (vitamin B5) to replenish moisture and restore the skin barrier. MVE patented delivery technology ensures controlled, continuous release of ceramides throughout the day. 98% of consumers tested reported smoother skin after four weeks of use. Non-comedogenic, fragrance-free, and suitable for all skin types including sensitive. Apply before moisturizer AM and PM.","descriptionTH":"A dermatologist-developed lightweight gel-cream serum that delivers intense, long-lasting hydration. Three essential ceramides (NP, AP, EOP) work alongside multi-molecular hyaluronic acid and panthenol (vitamin B5) to replenish moisture and restore the skin barrier. MVE patented delivery technology ensures controlled, continuous release of ceramides throughout the day. 98% of consumers tested reported smoother skin after four weeks of use. Non-comedogenic, fragrance-free, and suitable for all skin types including sensitive. Apply before moisturizer AM and PM.","doNotCombine":"Generally safe with most actives. Layer after water-based serums, before oils and moisturizers. Avoid applying high-concentration exfoliants simultaneously in the same step.","doNotCombineTH":"Generally safe with most actives. Layer after water-based serums, before oils and moisturizers. Avoid applying high-concentration exfoliants simultaneously in the same step.","medicubeMode":"None","makeupPrep":false,"ingredients":"Aqua / Water, Glycerin, Cetearyl Ethylhexanoate, Dimethicone, Ammonium Polyacryloyldimethyl Taurate, Sodium Hyaluronate, Panthenol, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Cetearyl Alcohol, Behentrimonium Methosulfate, Sodium Hydroxide, Sodium Lauroyl Lactylate, Cholesterol, Phenoxyethanol, Disodium EDTA, Isopropyl Myristate, Caprylyl Glycol, Citric Acid, Xanthan Gum, Phytosphingosine, Ethylhexylglycerin","sourceUrl":"https://www.cerave.com/skincare/facial-serums/hydrating-hyaluronic-acid-serum","imageUrl":"https://assets.icanet.se/image/upload/c_limit,h_720,w_720/dpr_auto/f_webp/q_auto/v1715252862/1063950_wwdrxj.webp","thumbnailUrl":"https://assets.icanet.se/image/upload/c_limit,h_720,w_720/dpr_auto/f_webp/q_auto/v1715252862/1063950_wwdrxj.webp"},
{"id":235,"imageUrl":"https://www.skin1004.com/cdn/shop/files/skin1004-ampoule-serum-30ml-tone-brightening-capsule-ampoule-40753987485942.png?v=1718006331","brand":"Skin1004","name":"Madagascar Centella Tone Brightening Capsule Ampoule","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["niacinamide", "tranexamic acid", "3-O-ethyl ascorbic acid", "centella asiatica extract", "madecassoside", "panthenol"],"bestFor":"Dark Spots & Hyperpigmentation, Post-Acne Marks, Dullness, Uneven Skin Tone, Redness & Sensitivity, All Skin Types","bestForTH":"Dark Spots & Hyperpigmentation, Post-Acne Marks, Dullness, Uneven Skin Tone, Redness & Sensitivity, All Skin Types","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A lightweight brightening ampoule targeting multiple pathways of hyperpigmentation. Niacinamide inhibits melanin transfer, Tranexamic Acid blocks the plasminogen cascade, and 3-O-Ethyl Ascorbic Acid (a stable vitamin C derivative) inhibits tyrosinase activity. Centella Asiatica and Madecassoside provide soothing, barrier-repairing support. Visibly clarifies skin tone, fades dark spots, and reduces post-acne marks without irritation. Fragrance-free and suitable for sensitive skin. Use AM and PM after toner, before moisturizer.","descriptionTH":"A lightweight brightening ampoule targeting multiple pathways of hyperpigmentation. Niacinamide inhibits melanin transfer, Tranexamic Acid blocks the plasminogen cascade, and 3-O-Ethyl Ascorbic Acid (a stable vitamin C derivative) inhibits tyrosinase activity. Centella Asiatica and Madecassoside provide soothing, barrier-repairing support. Visibly clarifies skin tone, fades dark spots, and reduces post-acne marks without irritation. Fragrance-free and suitable for sensitive skin. Use AM and PM after toner, before moisturizer.","doNotCombine":"Use caution layering multiple brightening actives with high-concentration AHAs/BHAs. Avoid combining with strong retinoids in the same step — apply at separate times if using both.","doNotCombineTH":"Use caution layering multiple brightening actives with high-concentration AHAs/BHAs. Avoid combining with strong retinoids in the same step — apply at separate times if using both.","medicubeMode":"None","makeupPrep":false,"ingredients":"Water, Niacinamide, Glycerin, Caprylic/Capric Triglyceride, Cetearyl Olivate, Sorbitan Olivate, Dipropylene Glycol, 1,2-Hexanediol, Tranexamic Acid, 3-O-Ethyl Ascorbic Acid, Butylene Glycol, Centella Asiatica Extract, Madecassoside, Panthenol, Sodium Hyaluronate, Gluconolactone, Xanthan Gum, Sodium Gluconate, Calcium Gluconate, Phenoxyethanol, Ethylhexylglycerin","sourceUrl":"https://www.skin1004.com/products/skin1004-madagascar-centella-tone-brightening-capsule-ampoule","imageUrl":"https://www.skin1004.com/cdn/shop/files/skin1004-ampoule-serum-30ml-tone-brightening-capsule-ampoule-40753987485942.png?v=1718006331","thumbnailUrl":"https://www.skin1004.com/cdn/shop/files/skin1004-ampoule-serum-30ml-tone-brightening-capsule-ampoule-40753987485942.png?v=1718006331"},
{"id":236,"imageUrl":"https://doctoraltheaglobal.com/cdn/shop/files/aquaserum_3a8e700f-7aa4-4db6-a64b-8b190917dfeb.jpg?v=1756436520","brand":"Dr. Althea","name":"Aqua Marine Deep Serum","category":"serum","fragranceFree":true,"alcoholFree":true,"eoFree":true,"activeIngredients":["sodium hyaluronate", "sodium hyaluronate crosspolymer", "hydrolyzed hyaluronic acid", "niacinamide", "panthenol", "adenosine", "centella asiatica extract", "sodium DNA", "guaiazulene"],"bestFor":"Dehydration & Deep Dryness, Dullness, Uneven Skin Tone, Inflammation & Redness, Fine Lines, Loss of Elasticity, Sensitive Skin","bestForTH":"Dehydration & Deep Dryness, Dullness, Uneven Skin Tone, Inflammation & Redness, Fine Lines, Loss of Elasticity, Sensitive Skin","howOften":"AM and PM","howOftenTH":"AM and PM","description":"A deep-hydrating serum with a multi-molecular hyaluronic acid complex: Sodium Hyaluronate hydrates the surface layer, Sodium Hyaluronate Crosspolymer forms a moisture-locking film, and Hydrolyzed Hyaluronic Acid penetrates deeper skin layers. Niacinamide brightens and minimises pores, Panthenol soothes and repairs, Adenosine boosts elasticity, and Centella Asiatica calms inflammation. Sodium DNA supports cellular renewal. Guaiazulene — a pure isolated compound — gives the serum its signature deep blue color and delivers anti-inflammatory benefits. Note: the blue color may briefly tint skin during application, fading quickly. Fragrance-free and suitable for sensitive skin. Use AM and PM before moisturizer.","descriptionTH":"A deep-hydrating serum with a multi-molecular hyaluronic acid complex: Sodium Hyaluronate hydrates the surface layer, Sodium Hyaluronate Crosspolymer forms a moisture-locking film, and Hydrolyzed Hyaluronic Acid penetrates deeper skin layers. Niacinamide brightens and minimises pores, Panthenol soothes and repairs, Adenosine boosts elasticity, and Centella Asiatica calms inflammation. Sodium DNA supports cellular renewal. Guaiazulene — a pure isolated compound — gives the serum its signature deep blue color and delivers anti-inflammatory benefits. Note: the blue color may briefly tint skin during application, fading quickly. Fragrance-free and suitable for sensitive skin. Use AM and PM before moisturizer.","doNotCombine":"Minimal conflicts. Avoid applying alongside high-concentration retinoids in the same step. Layer before oils and moisturizers.","doNotCombineTH":"Minimal conflicts. Avoid applying alongside high-concentration retinoids in the same step. Layer before oils and moisturizers.","medicubeMode":"None","makeupPrep":false,"ingredients":"Water, Glycerin, Hydroxyethyl Urea, Sodium Hyaluronate, Sodium Hyaluronate Crosspolymer, Hydrolyzed Hyaluronic Acid, Niacinamide, Panthenol, Butylene Glycol, 1,2-Hexanediol, Pentylene Glycol, Adenosine, Centella Asiatica Extract, Sodium DNA, Guaiazulene, Polyacrylate Crosspolymer-6, Carbomer, Triethanolamine, Phenoxyethanol, Oleyl Alcohol, Ethylhexylglycerin","sourceUrl":"https://doctoraltheaglobal.com/collections/all-products/products/aqua-marine-deep-serum","imageUrl":"https://doctoraltheaglobal.com/cdn/shop/files/aquaserum_3a8e700f-7aa4-4db6-a64b-8b190917dfeb.jpg?v=1756436520","thumbnailUrl":"https://doctoraltheaglobal.com/cdn/shop/files/aquaserum_3a8e700f-7aa4-4db6-a64b-8b190917dfeb.jpg?v=1756436520"},{"id": 237, "brand": "Aestura", "name": "ATOBARRIER 365 CREAM MIST", "category": "mist", "ingredients": "WATER / AQUA / EAU, GLYCERIN, BUTYLENE GLYCOL, CAPRYLIC/CAPRIC TRIGLYCERIDE, HYDROGENATED POLY(C6-14 OLEFIN), DIMETHICONE, CETYL ETHYLHEXANOATE, HYDROXYPROPYL BISLAURAMIDE MEA, 1,2-HEXANEDIOL, SODIUM SURFACTIN, CHOLESTEROL, GLYCERYL CAPRYLATE, DISODIUM EDTA, ETHYLHEXYLGLYCERIN, BEHENIC ACID, TOCOPHEROL", "fragranceFree": true, "alcoholFree": true, "eoFree": true, "makeupPrep": true, "activeIngredients": ["ceramides"], "description": "Cream mist with 10,000 ppm ceramide that forms a strong moisture film and restores the skin barrier. A special emulsifying method allows the ceramide to bind moisture and deliver hydration throughout the day.", "descriptionTH": "มิสต์ครีมที่มีเซราไมด์ความเข้มข้น 10,000 ppm สร้างฟิล์มความชุ่มชื้นและฟื้นฟูเกราะป้องกันผิว ด้วยวิธีการ emulsifying พิเศษที่ทำให้เซราไมด์จับกับความชุ่มชื้นและให้ความชุ่มชื้นตลอดวัน", "bestFor": "dry, sensitive, barrier-damaged skin", "bestForTH": "ผิวแห้ง, ผิวบอบบาง, ผิวแบเรียร์เสีย", "howOften": "AM + PM, or throughout the day as needed", "howOftenTH": "เช้า-เย็น หรือใช้ตลอดวันตามต้องการ", "doNotCombine": "No significant conflicts.", "doNotCombineTH": "ไม่มีข้อห้ามสำคัญ", "medicubeMode": "Derma Shot", "sourceUrl": "https://int.aestura.com/products/atobarrier-365-cream-mist", "imageUrl": "https://int.aestura.com/cdn/shop/files/1_Atobarrier365-Cream-Mist_thumbnail_Product-120ml__1200x1200_20c0d83e-a5ce-4db3-aef6-00dfa13a8971.png?v=1733993733", "thumbnailUrl": "https://int.aestura.com/cdn/shop/files/1_Atobarrier365-Cream-Mist_thumbnail_Product-120ml__1200x1200_20c0d83e-a5ce-4db3-aef6-00dfa13a8971.png?v=1733993734"}];

// ── Schema validation helper ─────────────────────────────────────────────
function _validateProductDB(data){
  if(!Array.isArray(data)) return {ok:false,errors:['Data must be an array'],warnings:[]};
  const errors=[],warnings=[];
  const validCats=new Set(GLOWPHASE_SCHEMA.categories);
  data.forEach((p,i)=>{
    const ref=`[${i}] id=${p.id||'?'} "${p.name||'?'}"`;
    GLOWPHASE_SCHEMA.required.forEach(f=>{ if(p[f]==null||p[f]==='') errors.push(`${ref}: missing required field "${f}"`); });
    if(p.category && !validCats.has(p.category)) warnings.push(`${ref}: unknown category "${p.category}" (will use normalizedCategory)`);
    if(p.id!=null && (typeof p.id!=='number'||p.id<1)) warnings.push(`${ref}: id should be a positive integer`);
    if(p.texture!=null){
      if(!Array.isArray(p.texture)) warnings.push(`${ref}: "texture" should be an array`);
      else { const validTex=new Set(GLOWPHASE_SCHEMA.textureTags); p.texture.forEach(t=>{ if(!validTex.has(t)) warnings.push(`${ref}: unknown texture tag "${t}"`); }); }
    }
    if(p.finish!=null){
      if(!Array.isArray(p.finish)) warnings.push(`${ref}: "finish" should be an array`);
      else { const validFin=new Set(GLOWPHASE_SCHEMA.finishTags); p.finish.forEach(f=>{ if(!validFin.has(f)) warnings.push(`${ref}: unknown finish tag "${f}"`); }); }
    }
    if(p.functionTags!=null){
      if(!Array.isArray(p.functionTags)) warnings.push(`${ref}: "functionTags" should be an array`);
      else { const validFn=new Set(GLOWPHASE_SCHEMA.functionTags); p.functionTags.forEach(f=>{ if(!validFn.has(f)) warnings.push(`${ref}: unknown functionTag "${f}"`); }); }
    }
    if(p.retinoidIntensity!=null){
      if(typeof p.retinoidIntensity!=='string') warnings.push(`${ref}: "retinoidIntensity" should be a string`);
      else if(!GLOWPHASE_SCHEMA.retinoidIntensity.includes(p.retinoidIntensity)) warnings.push(`${ref}: unknown retinoidIntensity "${p.retinoidIntensity}"`);
    }
    if(p.exfoliationIntensity!=null){
      if(typeof p.exfoliationIntensity!=='string') warnings.push(`${ref}: "exfoliationIntensity" should be a string`);
      else if(!GLOWPHASE_SCHEMA.exfoliationIntensity.includes(p.exfoliationIntensity)) warnings.push(`${ref}: unknown exfoliationIntensity "${p.exfoliationIntensity}"`);
    }
    if(p.safetyTags!=null){
      if(!Array.isArray(p.safetyTags)) warnings.push(`${ref}: "safetyTags" should be an array`);
      else { const validSafe=new Set(GLOWPHASE_SCHEMA.safetyTags); p.safetyTags.forEach(t=>{ if(!validSafe.has(t)) warnings.push(`${ref}: unknown safetyTag "${t}"`); }); }
    }
  });
  return {ok:errors.length===0,errors,warnings};
}

function loadProductDB(data){
  if(!Array.isArray(data)) return;
  const {ok,errors,warnings}=_validateProductDB(data);
  if(!ok){ alert('Product DB import failed:\n'+errors.slice(0,5).join('\n')+(errors.length>5?`\n…and ${errors.length-5} more`:'')); return; }
  if(warnings.length) console.warn('[Glowphase] Product DB import warnings:\n'+warnings.join('\n'));
  PRODUCT_DB=data;
  renderLibrary(); renderConflictGrid();
  document.getElementById('lib-data-notice').innerHTML=tFmt('db_custom_loaded',{n:data.length});
}
function loadProductDBFromJSON(j){ try{loadProductDB(JSON.parse(j));}catch(e){alert('Invalid JSON: '+e.message);} }

// ── Product DB export: JSON ──────────────────────────────────────────────
function exportProductDB(){
  const json=JSON.stringify(PRODUCT_DB,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='glowphase_products.json'; a.click(); URL.revokeObjectURL(a.href);
}

// ── Product DB export: CSV ───────────────────────────────────────────────
function exportProductDBCSV(){
  const cols=['id','brand','name','category','subcategory','texture','finish','functionTags',
    'retinoidIntensity','exfoliationIntensity','safetyTags',
    'fragranceFree','alcoholFree','eoFree',
    'activeIngredients','ingredients','description','descriptionTH','bestFor','bestForTH',
    'howOften','howOftenTH','doNotCombine','doNotCombineTH',
    'medicubeMode','imageUrl','thumbnailUrl','daytimeOnly','makeupPrep','sourceUrl'];
  const esc=v=>{ if(v==null)return ''; const s=Array.isArray(v)?v.join('|'):String(v); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`  :s; };
  const rows=[cols.join(','),...PRODUCT_DB.map(p=>cols.map(c=>esc(p[c])).join(','))];
  const blob=new Blob([rows.join('\n')],{type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='glowphase_products.csv'; a.click(); URL.revokeObjectURL(a.href);
}

// ── Product DB import: trigger file picker ───────────────────────────────
function importProductDB(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange=e=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader();
    r.onload=ev=>loadProductDBFromJSON(ev.target.result); r.readAsText(f); };
  inp.click();
}

window.Glowphase={
  loadProductDB,loadProductDBFromJSON,
  exportProductDB,exportProductDBCSV,importProductDB,
  get PRODUCT_DB(){return PRODUCT_DB},
  get SCHEMA(){return GLOWPHASE_SCHEMA}
};

/* ═══ FILTERS ═══ */
let activeFilters={category:[],concern:[],formula:[],active:[]};
let conflictSelected=[];
function toggleChip(btn){ const f=btn.dataset.filter,v=btn.dataset.value,arr=activeFilters[f],i=arr.indexOf(v); if(i===-1){arr.push(v);btn.classList.add('active');}else{arr.splice(i,1);btn.classList.remove('active');} renderLibrary(); }
function resetLibrary(){ activeFilters={category:[],concern:[],formula:[],active:[]}; document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); document.getElementById('lib-search').value=''; renderLibrary(); }

/* ═══ LIBRARY RENDER ═══ */
function filterProducts(){
  const q=(document.getElementById('lib-search')||{}).value||''; const ql=q.toLowerCase();
  return PRODUCT_DB.filter(p=>{
    if(activeFilters.category.length){const catMatch=activeFilters.category.some(f=>normalizedCategory(p)===f);if(!catMatch)return false;}
    if(activeFilters.concern.length&&!activeFilters.concern.some(c=>prodConcernTags(p).includes(c)))return false;
    if(activeFilters.formula.length){ for(const f of activeFilters.formula){ if(f==='fragrance-free'&&!p.fragranceFree)return false; if(f==='alcohol-free'&&!p.alcoholFree)return false; if(f==='eo-free'&&!p.eoFree)return false; } }
    if(activeFilters.active.length&&!activeFilters.active.some(a=>p.activeIngredients&&p.activeIngredients.includes(a)))return false;
    if(ql){ const s=[p.brand,p.name,p.category,...(p.concerns||[]),...(p.keyIngredients||[]),...(p.activeIngredients||[]),...(p.formula||[])].join(' ').toLowerCase(); if(!s.includes(ql))return false; }
    return true;
  });
}
/* ═══ INGREDIENT INTELLIGENCE — derived from actual data ═══ */
const ACTIVE_LABELS = {
  'hyaluronic acid':'💧 Hyaluronic Acid','niacinamide':'✨ Niacinamide','ceramides':'🛡 Ceramides',
  'centella':'🌿 Centella','retinol':'🕰 Retinol','vitamin c':'🍊 Vitamin C',
  'peptides':'💪 Peptides','pdrn':'🧬 PDRN','azelaic acid':'🎯 Azelaic Acid',
  'bha':'🔬 BHA','aha':'🔬 AHA','arbutin':'🌓 Arbutin','tranexamic acid':'🎨 Tranexamic Acid','retinal':'🕰 Retinal','panthenol':'💦 Panthenol'
};
function prodActiveTags(p){
  return (p.activeIngredients||[]).filter(a=>ACTIVE_LABELS[a]).map(a=>ACTIVE_LABELS[a]);
}
function prodConcernTags(p){
  // Derive concern tags from bestFor text
  const txt = (p.bestFor||'').toLowerCase();
  const tags = [];
  if(/sensitive|reactive/.test(txt)) tags.push('Sensitive');
  if(/acne|breakout|blemish/.test(txt)) tags.push('Acne-Prone');
  if(/mature|aging|fine line|wrinkle/.test(txt)) tags.push('Mature');
  if(/dry|dehydrat/.test(txt)) tags.push('Dry');
  if(/oily|combination/.test(txt)) tags.push('Oily');
  if(/barrier|eczema|atopic|compromised|damaged/.test(txt)) tags.push('Barrier');
  if(/redness|rosacea|inflamed/.test(txt)) tags.push('Redness');
  if(/hyperpig|dark spot|pih|post.?acne mark|dull/.test(txt)) tags.push('Brightening');
  return tags;
}
function prodSuitability(p){
  // Three quick ratings based on actual data
  const txt = (p.bestFor||'').toLowerCase();
  const avoid = (p.doNotCombine||'').toLowerCase();
  let sensitive = 3;
  if(!p.fragranceFree) sensitive -= 1;
  if(!p.alcoholFree) sensitive -= 1;
  if(!p.eoFree) sensitive -= 1;
  if(/sensitive|reactive/.test(txt)) sensitive += 2;
  if(/not.*sensitive|NOT.*sensitive/i.test(txt)) sensitive = Math.min(sensitive,1);
  if(/avoid|caution/.test(avoid) && /retinol|aha|bha/i.test(avoid)) sensitive -= 1;
  sensitive = Math.max(1,Math.min(5,sensitive));
  
  let barrier = 2;
  const actives = (p.activeIngredients||[]);
  if(actives.includes('ceramides')) barrier += 2;
  if(actives.includes('centella')) barrier += 1;
  if(actives.includes('hyaluronic acid')) barrier += 1;
  if(actives.includes('pdrn')) barrier += 1;
  if(actives.some(a=>['retinol','bha','aha','azelaic acid'].includes(a))) barrier -= 1;
  barrier = Math.max(1,Math.min(5,barrier));
  
  let aging = 1;
  if(actives.includes('peptides')) aging += 2;
  if(actives.includes('retinol')) aging += 2;
  if(actives.includes('vitamin c')) aging += 1;
  if(actives.includes('pdrn')) aging += 1;
  if(actives.includes('niacinamide')) aging += 1;
  aging = Math.max(1,Math.min(5,aging));
  
  return {sensitive,barrier,aging};
}

function renderLibrary(){
  const filtered=filterProducts(),countEl=document.getElementById('lib-count'),content=document.getElementById('library-content');
  if(countEl)countEl.textContent=tFmt('lib_count',{shown:filtered.length,total:PRODUCT_DB.length});
  if(!content)return;
  if(!filtered.length){content.innerHTML=`<div class="empty-lib"><div class="empty-lib-icon">🔍</div><div>${t('lib_empty')}</div></div>`;return;}
  const brands={};filtered.forEach(p=>{if(!brands[p.brand])brands[p.brand]=[];brands[p.brand].push(p);});
  content.innerHTML=Object.entries(brands).map(([brand,prods])=>{
    const prodHTML=prods.map(p=>{
      const r=prodSuitability(p);
      const concerns=prodConcernTags(p);
      const actives=prodActiveTags(p).slice(0,3);
      return `
      <div class="product-row" data-product-id="${p.id}" role="button" tabindex="0" aria-label="View details for ${p.brand} ${p.name}">
        <div class="prod-emoji-sm">${prodEmoji(p)}</div>
        <div class="prod-info">
          <div class="prod-name-row"><span class="prod-name-sm">${p.name}</span><span class="prod-cat-tag">${displayCategory(p)}</span></div>
          <div class="prod-flags">
            ${p.fragranceFree?`<span class="prod-flag safe">${t('flag_fragrance_free')}</span>`:`<span class="prod-flag danger">${t('flag_has_fragrance')}</span>`}
            ${p.alcoholFree?'':`<span class="prod-flag warn">${t('flag_has_alcohol')}</span>`}
            ${p.eoFree?'':`<span class="prod-flag warn">${t('flag_has_eo')}</span>`}
            ${p.medicubeMode&&p.medicubeMode!=='None'?`<span class="prod-flag safe">💡 ${p.medicubeMode}</span>`:''}
          </div>
          ${actives.length?`<div class="prod-concerns">${actives.map(a=>`<span class="prod-concern">${a}</span>`).join('')}${concerns.slice(0,2).map(c=>`<span class="prod-concern">${c}</span>`).join('')}</div>`:''}
        </div>
        <div class="prod-ratings-sm">${ratingMini(r.sensitive,t('label_sensitive'))}${ratingMini(r.barrier,t('label_barrier'))}${r.aging>=3?ratingMini(r.aging,t('label_aging')):''}</div>
      </div>`;
    }).join('');
    return `<div class="brand-group"><div class="brand-header open" onclick="toggleBrand(this)"><span class="brand-name">${brand}</span><span class="brand-count">${tFmt('brand_count',{n:prods.length})}</span><span class="brand-arrow">▼</span></div><div class="brand-products">${prodHTML}</div></div>`;
  }).join('');
  
  // EVENT DELEGATION — single listener, survives re-renders
  if(!content._delegated){
    content.addEventListener('click',function(e){
      const row=e.target.closest('.product-row[data-product-id]');
      if(!row)return;
      const id=parseInt(row.dataset.productId,10);
      if(!isNaN(id))openProductModal(id);
    });
    content.addEventListener('keydown',function(e){
      if(e.key!=='Enter'&&e.key!==' ')return;
      const row=e.target.closest('.product-row[data-product-id]');
      if(!row)return;
      e.preventDefault();
      const id=parseInt(row.dataset.productId,10);
      if(!isNaN(id))openProductModal(id);
    });
    content._delegated=true;
  }
}
function toggleBrand(h){h.classList.toggle('open');}
function ratingMini(val,label){
  const v=val||0;
  const dots=Array.from({length:5},(_,i)=>`<div class="dot${i<v?' on'+((v<=2)?' danger':v<=3?' warn':''):''}"></div>`).join('');
  return `<div class="rating-mini"><div class="rating-mini-label">${label}</div><div class="dots">${dots}</div></div>`;
}

/* ═══ PRODUCT MODAL — schema-aware, defensive ═══ */
function openProductModal(id){
  const p=PRODUCT_DB.find(x=>x.id===id);
  if(!p){console.warn('Product not found:',id);return;}
  
  const isThai = (typeof LANG !== 'undefined' && LANG === 'th');
  const description = (isThai && p.descriptionTH) ? p.descriptionTH : (p.description||'');
  const bestFor = (isThai && p.bestForTH) ? p.bestForTH : (p.bestFor||'—');
  const howOften = (isThai && p.howOftenTH) ? p.howOftenTH : (p.howOften||'—');
  const doNotCombine = (isThai && p.doNotCombineTH) ? p.doNotCombineTH : (p.doNotCombine||'');
  
  const actives = prodActiveTags(p);
  const concerns = prodConcernTags(p);
  const r = prodSuitability(p);
  
  // Detect skin-type notes from bestFor text
  const bestForLower = (p.bestFor||'').toLowerCase();
  const isSensitiveSafe = /sensitive|reactive/.test(bestForLower) && !/not.*sensitive|NOT.*sensitive/i.test(p.bestFor||'');
  const isAcneSafe = /acne|breakout/.test(bestForLower) && !/not.*acne/i.test(p.bestFor||'');
  const isMatureSupport = /mature|aging|fine line|wrinkle|firm|elasticity/.test(bestForLower) || (p.activeIngredients||[]).some(a=>['retinol','peptides','pdrn'].includes(a));
  
  // Build warnings from formula
  const warnings = [];
  if(!p.fragranceFree) warnings.push(t('warn_fragrance'));
  if(!p.alcoholFree) warnings.push(t('warn_alcohol'));
  if(!p.eoFree) warnings.push(t('warn_eo'));
  
  // doNotCombine: split string into chips if comma-separated, else show as text
  const doNotChips = doNotCombine && doNotCombine.length > 5 
    ? doNotCombine.split(/[,;]|\.(?=\s)/).map(s=>s.trim()).filter(s=>s&&s.length>2&&s.toLowerCase()!=='n/a').slice(0,6)
    : [];
  
  const modalHTML = `
    <div class="modal-hero">
      <button class="modal-close" onclick="closeModal()" aria-label="Close">✕</button>
      <div class="modal-emoji">${prodEmoji(p)}</div>
      <div>
        <div class="modal-brand-sm">${p.brand||''}</div>
        <div class="modal-name-lg">${p.name||''}</div>
        <div class="modal-tag-row">
          <span class="modal-tag cat">${displayCategory(p)}</span>
          ${p.fragranceFree?`<span class="modal-tag ff">${t('modal_tag_ff')}</span>`:`<span class="modal-tag noff">${t('modal_tag_hf')}</span>`}
          ${p.alcoholFree?`<span class="modal-tag ff">${t('modal_tag_af')}</span>`:`<span class="modal-tag noff">${t('modal_tag_ha')}</span>`}
          ${p.eoFree?`<span class="modal-tag ff">${t('modal_tag_eof')}</span>`:`<span class="modal-tag noff">${t('modal_tag_heo')}</span>`}
        </div>
      </div>
    </div>
    <div class="modal-body">
      ${description?`<div class="modal-sec"><div class="modal-sec-title">${t('modal_what_it_does')}</div><div class="modal-text">${description}</div></div>`:''}
      
      ${actives.length?`<div class="modal-sec"><div class="modal-sec-title">${t('modal_key_actives')}</div><div class="modal-key-ings">${actives.map(a=>`<span class="key-ing">${a}</span>`).join('')}</div></div>`:''}
      
      ${concerns.length?`<div class="modal-sec"><div class="modal-sec-title">${t('modal_skin_concerns')}</div><div class="modal-key-ings">${concerns.map(c=>`<span class="key-ing">${c}</span>`).join('')}</div></div>`:''}
      
      <div class="modal-sec">
        <div class="modal-sec-title">${t('modal_skin_suit')}</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;padding:8px 0">
          ${ratingMini(r.sensitive,t('modal_sensitive_skin'))}
          ${ratingMini(r.barrier,t('modal_barrier_repair'))}
          ${ratingMini(r.aging,t('modal_anti_aging'))}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;font-size:0.72rem;color:var(--ink2)">
          ${isSensitiveSafe?`<div>${t('modal_suit_sensitive')}</div>`:''}
          ${isAcneSafe?`<div>${t('modal_suit_acne')}</div>`:''}
          ${isMatureSupport?`<div>${t('modal_suit_aging')}</div>`:''}
        </div>
      </div>
      
      ${warnings.length?`<div class="modal-sec"><div class="modal-sec-title">${t('modal_ing_warnings')}</div><div class="info-box amber">${warnings.join('<br>')}</div></div>`:''}
      
      <div class="modal-sec">
        <div class="modal-sec-title">${t('modal_how_to_use')}</div>
        <div class="info-box green">
          <strong>${t('modal_best_for')}</strong> ${bestFor}<br>
          <strong>${t('modal_how_often')}</strong> ${howOften}
        </div>
      </div>
      
      ${doNotCombine && doNotCombine.toLowerCase()!=='n/a' && doNotCombine.toLowerCase().indexOf('no significant')!==0 ? `
        <div class="modal-sec">
          <div class="modal-sec-title">${t('modal_dnc')}</div>
          ${doNotChips.length 
            ? `<div class="tag-row">${doNotChips.map(c=>`<span class="tag red">${c}</span>`).join('')}</div>`
            : `<div class="info-box amber">${doNotCombine}</div>`
          }
        </div>` : `
        <div class="modal-sec">
          <div class="modal-sec-title">${t('modal_routine_compat')}</div>
          <div class="info-box green">${t('modal_no_conflicts')}</div>
        </div>`
      }
      
      ${p.medicubeMode && p.medicubeMode!=='None' ? `
        <div class="modal-sec">
          <div class="modal-sec-title">${t('modal_medicube_compat')}</div>
          <div class="info-box green">
            <strong>${t('modal_rec_mode')}</strong> ${p.medicubeMode}<br>
            ${p.medicubeMode==='Booster'?t('modal_booster_note'):''}
            ${p.medicubeMode==='MC'?t('modal_mc_note'):''}
            ${p.medicubeMode==='Derma Shot'?t('modal_derma_note'):''}
          </div>
        </div>` : `
        <div class="modal-sec">
          <div class="modal-sec-title">${t('modal_medicube_title')}</div>
          <div class="info-box amber">${t('modal_no_device')}</div>
        </div>`
      }
      
      <div class="modal-sec">
        <div class="modal-sec-title">${t('modal_inci_title')}</div>
        <div class="full-ing">${p.ingredients?p.ingredients:`<em style="color:var(--ink2)">${t('modal_inci_missing')}</em>`}</div>
      </div>
      
      <div style="text-align:center;padding-top:8px"><button class="btn btn-rose" onclick="closeModal()">${t('modal_close')}</button></div>
    </div>`;
  
  try {
    const box = document.getElementById('modal-box');
    if(!box){console.warn('modal-box element missing');return;}
    box.innerHTML = modalHTML;
    const modal = document.getElementById('product-modal');
    if(modal){
      modal.classList.add('open');
      modal.scrollTop = 0;
      const inner = modal.querySelector('.modal');
      if(inner) inner.scrollTop = 0;
    }
  } catch(err) {
    console.error('Modal render error:',err);
  }
}
function highlightIngs(text,flagged){ let r=text;(flagged||[]).forEach(f=>{const re=new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');r=r.replace(re,`<span class="hi">${f}</span>`);});return r; }
function closeModal(){const m=document.getElementById('product-modal');if(m)m.classList.remove('open');}
function closeModalOutside(e){if(e.target.id==='product-modal')closeModal();}

/* ═══ ROUTINE BUILDER ═══ */
let builderState={step:0,answers:{},selectedIds:[],routineData:null,prodSearchQuery:''};
/* ═══ MY ROUTINE state — tracks which saved routine is currently displayed ═══ */
let myRoutineState={selectedId:null};
function getCurrentRoutineId(){try{return localStorage.getItem('gp_current_routine_id')||null;}catch(e){return null;}}
function setCurrentRoutineId(id){try{localStorage.setItem('gp_current_routine_id',id||'');}catch(e){}}
const QUIZ_STEPS=[
  {key:'skinTypes',label:'q_skin_type',multi:true,options:[{icon:'💧',key:'o_dry'},{icon:'✨',key:'o_oily'},{icon:'⚖️',key:'o_combo'},{icon:'🌸',key:'o_sensitive'},{icon:'🎯',key:'o_acneprone'},{icon:'💦',key:'o_dehydrated'},{icon:'⚡',key:'o_reactive'},{icon:'🌹',key:'o_rosacea'},{icon:'🌿',key:'o_mature'},{icon:'🛡',key:'o_barrier'}]},
  {key:'agingConcerns',label:'q_aging',multi:false,options:[{icon:'✅',key:'o_yes'},{icon:'❌',key:'o_no'}]},
  {key:'sensitivity',label:'q_sensitivity',multi:false,options:[{icon:'🟢',key:'o_low'},{icon:'🟡',key:'o_medium'},{icon:'🔴',key:'o_high'}]},
  {key:'acneLevel',label:'q_acne',multi:false,options:[{icon:'😊',key:'o_none'},{icon:'🔸',key:'o_occasional'},{icon:'🔴',key:'o_moderate'},{icon:'⚠️',key:'o_severe'}]},
  {key:'barrierCondition',label:'q_barrier',multi:false,options:[{icon:'✅',key:'o_healthy'},{icon:'🟡',key:'o_slightly'},{icon:'🔴',key:'o_very_damaged'},{icon:'❓',key:'o_unsure'}]},
  {key:'redness',label:'q_redness',multi:false,options:[{icon:'✅',key:'o_none'},{icon:'🟡',key:'o_medium'},{icon:'🔴',key:'o_high'}]},
  {key:'goals',label:'q_goals',multi:true,options:[{icon:'🛡',key:'g_barrier'},{icon:'💧',key:'g_hydration'},{icon:'🌿',key:'g_calm'},{icon:'✨',key:'g_glow'},{icon:'🎯',key:'g_acne'},{icon:'🌓',key:'g_pih'},{icon:'🕰',key:'g_antiaging'},{icon:'💪',key:'g_elasticity'},{icon:'🔬',key:'g_texture'},{icon:'〰️',key:'g_fine_lines'},{icon:'📍',key:'g_wrinkles'},{icon:'🎨',key:'g_hyperpig'},{icon:'💎',key:'g_glass'}]},
  {key:'usesDevice',label:'q_device',multi:false,options:[{icon:'✅',key:'o_yes'},{icon:'❌',key:'o_no'}]},
  {key:'wearsMakeup',label:'q_makeup',multi:false,options:[{icon:'✅',key:'o_yes'},{icon:'❌',key:'o_no'},{icon:'🔸',key:'o_sometimes'}]},
  {key:'complexity',label:'q_complexity',multi:false,options:[{icon:'🌱',key:'o_simple'},{icon:'⚖️',key:'o_moderate_r'},{icon:'🔬',key:'o_advanced'}]},
  {key:'avoidIngredients',label:'q_avoid',multi:true,options:[{icon:'🚫',key:'o_fragrance'},{icon:'🍺',key:'o_alcohol'},{icon:'🌿',key:'o_eo'},{icon:'💧',key:'o_silicones'}]},
];
function initBuilder(){
  /* One-shot guard: when editRoutine() seeds state and then calls showPage('builder'),
     showPage triggers this initBuilder which would otherwise wipe the seeded state.
     If _preserveOnce is set, clear it and skip the reset for this single call. */
  if(builderState && builderState._preserveOnce){
    builderState._preserveOnce=false;
    renderBuilderStep();
    return;
  }
  builderState={step:0,answers:{},selectedIds:[],routineData:null,prodSearchQuery:''};
  renderBuilderStep();
}
function renderBuilderStep(){
  const c=document.getElementById('builder-content');if(!c)return;
  const s=builderState.step;
  if(s<QUIZ_STEPS.length){
    const q=QUIZ_STEPS[s];
    const ans=builderState.answers[q.key];
    const ansArr=Array.isArray(ans)?ans:(ans?[ans]:[]);
    const pct=Math.round(((s+1)/QUIZ_STEPS.length)*100);
    c.innerHTML=`
      <div class="builder-card">
        <div class="builder-step-hd">
          <div class="step-badge">${s+1}</div>
          <div><div class="step-title">${t(q.label)}</div><div class="step-sub">${tFmt('bldr_step_label',{n:s+1,total:QUIZ_STEPS.length})}${q.multi?t('bldr_select_all'):''}</div></div>
        </div>
        <div class="quiz-q">
          <div class="quiz-options">${q.options.map(o=>`<button type="button" class="qopt${q.multi?' multi-select':''} ${ansArr.includes(t(o.key))?'active':''}" onclick="selectQuizOption('${q.key}','${o.key}',${q.multi},this)"><span class="qopt-icon">${o.icon}</span>${t(o.key)}</button>`).join('')}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          ${s>0?`<button type="button" class="btn btn-ghost" onclick="builderBack()">${t('bldr_back')}</button>`:''}
          <button type="button" class="btn btn-rose" onclick="builderNext()">${t('bldr_next')}</button>
        </div>
        <div class="builder-progress"><div class="builder-progress-fill" style="width:${pct}%"></div></div>
      </div>`;
  } else if(s===QUIZ_STEPS.length){
    renderProductSelect(c);
  } else {
    renderRoutineResult(c);
  }
}
function selectQuizOption(key,optKey,multi,btn){
  const val=t(optKey);
  if(multi){
    let arr=builderState.answers[key]||[];
    const i=arr.indexOf(val);
    if(i===-1)arr.push(val);else arr.splice(i,1);
    builderState.answers[key]=arr;
    btn.classList.toggle('active',arr.includes(val));
  } else {
    builderState.answers[key]=val;
    btn.closest('.quiz-options').querySelectorAll('.qopt').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
}
function builderNext(){if(builderState.step<QUIZ_STEPS.length){builderState.step++;renderBuilderStep();}}
function builderBack(){if(builderState.step>0){builderState.step--;renderBuilderStep();}}

function renderProductSelect(c){
  // Render full structure ONCE. Search input is created and never re-rendered.
  c.innerHTML=`
    <div class="builder-card">
      <div class="builder-step-hd"><div class="step-badge">📦</div><div><div class="step-title">${t('prod_select_title')}</div><div class="step-sub">${t('prod_select_sub')}</div></div></div>
      <div class="prod-search-container">
        <input type="text" class="prod-search-input" id="prod-search-box" placeholder="${t('prod_search_placeholder')}" value="${builderState.prodSearchQuery||''}" autocomplete="off">
        <button class="prod-search-btn" type="button" id="prod-reset-btn">${t('prod_reset_search')}</button>
      </div>
      <div id="prod-results-area"></div>
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-rose" type="button" onclick="generateRoutine()">${t('prod_build_routine')}</button>
        <button class="btn btn-ghost" type="button" onclick="builderBack()">${t('bldr_back')}</button>
      </div>
    </div>`;
  
  // Attach listeners DIRECTLY to the search input (no re-render of input!)
  const input=c.querySelector('#prod-search-box');
  const resetBtn=c.querySelector('#prod-reset-btn');
  if(input){
    input.addEventListener('input',function(e){
      builderState.prodSearchQuery=e.target.value;
      renderProductList(); // Only updates the LIST, never the input
    });
  }
  if(resetBtn){
    resetBtn.addEventListener('click',function(){
      builderState.prodSearchQuery='';
      if(input)input.value='';
      renderProductList();
    });
  }
  
  // Initial product list render
  renderProductList();
}

function renderProductList(){
  const resultsArea=document.getElementById('prod-results-area');
  if(!resultsArea)return;
  
  const searchQuery=builderState.prodSearchQuery||'';
  let filtered=PRODUCT_DB;
  if(searchQuery.trim()){
    const q=searchQuery.toLowerCase();
    filtered=PRODUCT_DB.filter(p=>{
      const searchText=[p.brand,p.name,p.category,...(p.concerns||[]),...(p.keyIngredients||[]),...(p.activeIngredients||[]),...(p.formula||[])].join(' ').toLowerCase();
      return searchText.includes(q);
    });
  }
  const selectedCount=builderState.selectedIds.length;
  const grouped={};filtered.forEach(p=>{if(!grouped[p.brand])grouped[p.brand]=[];grouped[p.brand].push(p);});
  const brandList=Object.keys(grouped).sort();
  
  if(filtered.length===0){
    resultsArea.innerHTML=`<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">${t('prod_no_match')}</div></div>`;
    return;
  }
  
  resultsArea.innerHTML=`
    <div class="prod-picker-scroll">
      ${brandList.map(brand=>{
        const prods=grouped[brand];
        return `<div class="prod-brand-group">
          <div class="prod-brand-header">${brand} <span class="brand-count">${prods.length}</span></div>
          <div class="prod-brand-list">
            ${prods.map(p=>`
              <div class="prod-pick-card ${builderState.selectedIds.includes(p.id)?'selected':''}" id="bpk-${p.id}" onclick="toggleBuilderProduct(${p.id},this)">
                <div class="prod-pick-emoji">${prodEmoji(p)}</div>
                <div class="prod-pick-info">
                  <div class="prod-pick-brand">${p.brand}</div>
                  <div class="prod-pick-name">${p.name}</div>
                  <div class="prod-pick-cat">${displayCategory(p)}</div>
                </div>
                <div class="prod-pick-check">✓</div>
              </div>
            `).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="prod-selection-badge">${t('prod_selected_count')}: ${selectedCount}</div>
  `;
}

function handleProdSearch(val){
  builderState.prodSearchQuery=val;
  renderProductList();
}
function toggleBuilderProduct(id,el){
  const i=builderState.selectedIds.indexOf(id);
  if(i===-1){builderState.selectedIds.push(id);el.classList.add('selected');}
  else{builderState.selectedIds.splice(i,1);el.classList.remove('selected');}
  // Update selection counter badge without re-rendering whole list
  const badge=document.querySelector('.prod-selection-badge');
  if(badge)badge.textContent=`${t('prod_selected_count')}: ${builderState.selectedIds.length}`;
}
function generateRoutine(){builderState.step=QUIZ_STEPS.length+1;renderBuilderStep();}

/* ═══ ROUTINE RESULT ═══ */
/* Renders the routine result inside the Routine Builder (with builder-specific actions) */
function renderRoutineResult(c){
  // Preserve id across re-renders of the same session result; only create a new id
  // the first time we land on the result step.
  const existingId=builderState.routineData&&builderState.routineData.id;
  const rd={
    id:existingId||Date.now().toString(),
    name:(builderState.routineData&&builderState.routineData.name)||'My Glowphase Routine',
    createdAt:(builderState.routineData&&builderState.routineData.createdAt)||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    goals:builderState.answers.goals||[],
    skinTypes:builderState.answers.skinTypes||[],
    selectedIds:builderState.selectedIds.slice(),
    answers:Object.assign({},builderState.answers)
  };
  // Compute phase count so we can persist it on routineData (used by saved routine cards)
  const _selected=PRODUCT_DB.filter(p=>rd.selectedIds.includes(p.id));
  const _hasActives=_selected.some(p=>hasRetinoid(p)||hasExfoliantAcid(p)||hasBenzoylPeroxide(p));
  const _needsAA=rd.answers.agingConcerns===t('o_yes')||(rd.answers.goals||[]).some(g=>[t('g_antiaging'),t('g_elasticity'),t('g_fine_lines'),t('g_wrinkles')].includes(g));
  rd.phases=_needsAA?4:(_hasActives?3:2);
  builderState.routineData=rd;

  // Render the full result body + recommendations + personalised emergency + builder action buttons
  c.innerHTML=`
    ${renderRoutineResultBody(rd)}
    ${renderRecommendationsHTML(rd)}
    ${renderPersonalizedEmergencyHTML(rd)}
    <div class="builder-card" style="margin-top:14px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-rose" onclick="saveCurrentRoutine()">${t('btn_save_routine')}</button>
        <button class="btn btn-ghost" onclick="initBuilder()">${t('btn_start_over')}</button>
        <button class="btn btn-outline" onclick="showPage('conflict',null)">${t('btn_check_ingredients')}</button>
      </div>
    </div>`;
  attachDayInteractions();
}

/* Returns the bha/retinal/aha/peel active-ingredient flags for a given phase.
   p1 = Barrier Repair → no actives; p2 adds BHA; p3/p4 add retinal, AHA, peel.
   data is the object stored in window._glowPhaseData[cardId]. */
function _getPhaseActives(data,pid){
  if(pid==='p1')return{bha:false,retinal:false,aha:false,peel:false};
  if(pid==='p2')return{bha:data.bha,retinal:false,aha:false,peel:false};
  return{bha:data.bha,retinal:data.retinalProd,aha:data.aha,peel:data.peel};
}

/* Pure renderer — turns a routineData object into the full result HTML.
   Used by BOTH the Routine Builder (after generation) AND My Routine (saved view).
   This is what guarantees a saved routine displays identically to a freshly-built one.
   Uses the Glowphase safety layer (normalizedCategory + isSunscreenProduct + prodEmoji)
   so mislabeled sunscreens are still placed in the SPF slot and no "undefined" icons render. */
function renderRoutineResultBody(rd){
  const selected=PRODUCT_DB.filter(p=>(rd.selectedIds||[]).includes(p.id));
  const a=rd.answers||{};
  const isMature=(a.skinTypes||[]).includes(t('o_mature'));
  const isHighSens=a.sensitivity===t('o_high');
  const isBarrierHealthy=a.barrierCondition===t('o_healthy');
  const isDrySkin=(a.skinTypes||[]).some(s=>s===t('o_dry'));
  const isDamagedBarrier=a.barrierCondition===t('o_slightly')||a.barrierCondition===t('o_very_damaged')||(a.skinTypes||[]).includes(t('o_barrier'));
  const needsExtraOcclusion=isDrySkin||isDamagedBarrier;
  const isSimplePref=a.complexity===t('o_simple');
  const _varSeed=parseInt((rd.id||Date.now().toString()).slice(-2))||0;
  const hasActives=selected.some(p=>hasRetinoid(p)||hasExfoliantAcid(p)||hasBenzoylPeroxide(p));
  const usesDevice=a.usesDevice===t('o_yes');
  const needsAntiAging=a.agingConcerns===t('o_yes')||(a.goals||[]).some(g=>[t('g_antiaging'),t('g_elasticity'),t('g_fine_lines'),t('g_wrinkles')].includes(g));
  const byCategory=(cat)=>selected.find(p=>normalizedCategory(p)===cat||p.subcategory===cat);
  const byCategories=(cats)=>selected.filter(p=>cats.includes(normalizedCategory(p)));
  // Goal-aware product picker: scores each candidate against user answers and picks the best fit.
  // Falls back to first match when scores are tied or only one candidate exists.
  const bestByCategory=(cat)=>{
    const candidates=selected.filter(p=>normalizedCategory(p)===cat||p.subcategory===cat);
    if(!candidates.length)return null;
    if(candidates.length===1)return candidates[0];
    const scored=candidates.map(p=>({p,s:scoreProductForUser(p,a)})).sort((a,b)=>b.s-a.s);
    const topScore=scored[0].s;
    const tier=scored.filter(x=>x.s>=topScore-2);
    return tier[_varSeed%tier.length].p;
  };
  const c1=selected.find(p=>p.subcategory==='cleansing balm'||p.subcategory==='cleansing oil')||byCategory('oil cleanser')||byCategory('cleanser');
  const c2=selected.find(p=>p.category==='cleanser'&&p.subcategory!=='cleansing balm'&&p.subcategory!=='cleansing oil'&&p!==c1);
  // Toner pads are functionally toners in the routine — include both categories
  const allToners=selected.filter(p=>normalizedCategory(p)==='toner'||normalizedCategory(p)==='toner pad');
  const _safeToners=allToners.filter(p=>!hasExfoliantAcid(p));
  const toner=(()=>{if(!_safeToners.length)return allToners[0]||null;if(_safeToners.length===1)return _safeToners[0];const _tScored=_safeToners.map(p=>({p,s:scoreProductForUser(p,a)})).sort((x,y)=>y.s-x.s);const _tTop=_tScored[0].s;const _tTier=_tScored.filter(x=>x.s>=_tTop-2);return _tTier[_varSeed%_tTier.length].p;})();
  const essence=bestByCategory('essence');
  const serum=bestByCategory('serum');
  // Smart night serum: prefer calming+barrier-safe → barrier-safe → night-suitable → last resort
  const allSelectedSerums=selected.filter(p=>normalizedCategory(p)==='serum');
  const nightSerum=(()=>{
    if(!allSelectedSerums.length)return null;
    const scored=allSelectedSerums.map(p=>({p,s:scoreProductForUser(p,a)+(isNightSuitableSerum(p)?2:0)+(isBarrierSafeProduct(p)?1:0)+(hasCalmingIngredient(p)?1:0)+(!p.daytimeOnly?0.5:0)})).sort((a,b)=>b.s-a.s);
    const topScore=scored[0].s;
    const tier=scored.filter(x=>x.s>=topScore-2);
    return tier[_varSeed%tier.length].p;
  })();
  // Dry skin: prefer rich/heavy moisturizers by boosting their score
  const moist=(()=>{
    // Gel creams are a subcategory of moisturizer — include them in moisturizer selection
    const _mc=selected.filter(p=>normalizedCategory(p)==='moisturizer'||normalizedCategory(p)==='gel cream'||p.subcategory==='moisturizer');
    if(!_mc.length)return null;
    if(_mc.length===1)return _mc[0];
    const scored=_mc.map(p=>({p,s:scoreProductForUser(p,a)+(isDrySkin&&isHeavyMoisturizer(p)?3:0)})).sort((x,y)=>y.s-x.s);
    const topScore=scored[0].s;
    const tier=scored.filter(x=>x.s>=topScore-2);
    return tier[_varSeed%tier.length].p;
  })();
// Sleeping masks/packs are occlusive last-step treatments — detect by category or subcategory
const sleepingPack=selected.find(p=>normalizedCategory(p)==='sleeping mask'||p.subcategory==='sleeping mask'||p.subcategory==='sleeping pack')||null;
  const mistProd=selected.find(p=>normalizedCategory(p)==='mist')||null;
  const spf=byCategory('sunscreen')||selected.find(p=>isSunscreenProduct(p));
  const deviceGel=byCategory('device gel')||selected.find(p=>!!p.medicubeMode)||null;
  const eye=bestByCategory('eye')||bestByCategory('eye cream')||selected.find(p=>p.category==='eye cream'||p.subcategory==='eye cream');
  // Guard: if retinalProd or aha would point to the same product as moist,
  // null them out — a moisturizer containing retinol/AHA must not render twice
  // (once as moist, once as the active step). Use the product as moist only.
  const retinalProd=(()=>{
    const cands=selected.filter(p=>hasRetinoid(p)&&p!==moist);
    if(!cands.length)return null;
    const scored=cands.map(p=>({p,s:scoreProductForUser(p,a)})).sort((a,b)=>b.s-a.s);
    const topScore=scored[0].s;
    const tier=scored.filter(x=>x.s>=topScore-2);
    return tier[_varSeed%tier.length].p;
  })();
  const bha=(()=>{
    const cands=selected.filter(p=>p.subcategory==='spot treatment');
    if(!cands.length)return null;
    const scored=cands.map(p=>({p,s:scoreProductForUser(p,a)})).sort((a,b)=>b.s-a.s);
    const topScore=scored[0].s;
    const tier=scored.filter(x=>x.s>=topScore-2);
    return tier[_varSeed%tier.length].p;
  })();
  const aha=(()=>{
    const cands=selected.filter(p=>hasExfoliantAcid(p)&&normalizedCategory(p)!=='exfoliant'&&p.subcategory!=='spot treatment'&&p!==moist);
    if(!cands.length)return null;
    const scored=cands.map(p=>({p,s:scoreProductForUser(p,a)})).sort((a,b)=>b.s-a.s);
    const topScore=scored[0].s;
    const tier=scored.filter(x=>x.s>=topScore-2);
    return tier[_varSeed%tier.length].p;
  })();
  // Peeling gels resolve to 'peeling gel' category — treat as exfoliant in routine
  const peel=selected.find(p=>normalizedCategory(p)==='exfoliant'||normalizedCategory(p)==='peeling gel');
  // Pre-compute per-day toner/essence/serum for each phase plan using selectBestForDay().
  // This drives day-by-day product rotation: Mon–Sun each score independently by phase type,
  // so users see a variety of their suitable products across the week rather than the same pick daily.
  // moist is intentionally kept fixed — one consistent moisturizer per routine, no duplication or stacking.
  const _dpDayKeys=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const _dpTonerCands=_safeToners.length?_safeToners:allToners;
  const _dpEssenceCands=selected.filter(p=>normalizedCategory(p)==='essence'||p.subcategory==='essence');
  const _dpSerumCands=selected.filter(p=>normalizedCategory(p)==='serum');
  const _dayProducts={};
  ['p1','p2','p3','p4'].forEach(pid=>{
    const _dpPlan=DAY_PLANS[pid]||DAY_PLANS.p1;
    _dayProducts[pid]={};
    _dpDayKeys.forEach((d,di)=>{
      const _dpDay=_dpPlan[d];
      const _phType=_dpDay.recovery?'recovery':(_dpDay.retinal||_dpDay.aha)?'active':(_dpDay.device&&usesDevice)?'device':(pid==='p1'?'barrier':'normal');
      const _dayToner   = selectBestForDay(_dpTonerCands,   a, di, _phType, 'toner');
      const _dayEssence = selectBestForDay(_dpEssenceCands, a, di, _phType, 'essence', { alreadySelected: [_dayToner].filter(Boolean) });
      const _daySerum   = selectBestForDay(_dpSerumCands,   a, di, _phType, 'serum',   { alreadySelected: [_dayToner, _dayEssence].filter(Boolean) });
      _dayProducts[pid][d] = { toner: _dayToner, essence: _dayEssence, serum: _daySerum };
    });
  });
  // Attach computed rotation map to answers so renderPhase() can read per-day picks
  const _answersWithDayProducts=Object.assign({},a,{_dayProducts});
  const numPhases=rd.phases||(needsAntiAging?4:(hasActives?3:2));
  const phaseIds=['p1','p2','p3','p4'].slice(0,numPhases);
  const conflicts=detectConflicts(selected);
  const analyses=analyzeRoutine(selected,a);

  // Store all computed params keyed by cardId so switchRoutinePhase/selectDay can re-render
  // without recomputing products from scratch. Only one phase + one day panel live in DOM at once.
  const cardId='gc-'+(rd.id||'draft');
  if(!window._glowPhaseData)window._glowPhaseData={};
  window._glowPhaseData[cardId]={
    selected,c1,c2,toner,essence,nightSerum,moist,deviceGel,usesDevice,
    bha,retinalProd,aha,peel,isMature,isHighSens,isBarrierHealthy,
    eye,sleepingPack,mistProd,_answersWithDayProducts,numPhases,phaseIds
  };
  return `
    <div class="builder-card" data-card-id="${cardId}">
      <div class="builder-step-hd"><div class="step-badge">✓</div><div><div class="step-title">${rd.name||t('result_name_default')}</div><div class="step-sub">${tFmt('result_based_on',{n:selected.length})}</div></div></div>
      ${isMature?`<div class="info-box blue" style="margin-bottom:14px">🌿 <strong>${t('result_mature_label')}</strong> ${t('result_mature_body')}</div>`:''}
      <div class="analysis-wrap">${analyses.map(an=>`<div class="analysis-item"><div class="a-head ${an.type}">${an.icon} ${an.title}</div><div class="a-body">${an.body}</div></div>`).join('')}${conflicts.length?`<div class="analysis-item"><div class="a-head danger">⚠️ ${t('analysis_conflicts')}</div><div class="a-body">${conflicts.map(x=>`<div style="margin-bottom:5px">🚫 <strong>${x.combo}</strong> — ${x.reason}</div>`).join('')}</div></div>`:`<div class="analysis-item"><div class="a-head ok">✅ ${t('analysis_ok')}</div><div class="a-body">${t('result_no_conflict_body')}</div></div>`}</div>
      <div class="info-box rose" style="margin-bottom:6px;font-weight:600">${t('morning_routine')} — ${t('result_daily_every_day')}</div>
      ${renderMorningPhases(selected,toner,essence,serum,moist,spf,c1,c2,isHighSens,eye,a,mistProd)}
      <div class="info-box" style="margin-top:18px;margin-bottom:6px;font-weight:600">${t('night_routine')}</div>
      <div class="phase-nav" id="routine-phase-nav">${phaseIds.map((pid,i)=>`<button class="phase-tab ${i===0?'active':''}" data-phase="${pid}" onclick="switchRoutinePhase('${pid}',this)">${tFmt('result_phase_label',{n:i+1})}</button>`).join('')}</div>
      <div class="active-phase-area">${renderPhase('p1',selected,c1,c2,toner,essence,nightSerum,moist,deviceGel,usesDevice,false,false,false,false,isMature,isHighSens,'active',isBarrierHealthy,eye,sleepingPack,_answersWithDayProducts,mistProd,'Mon')}</div>
    </div>`;
}

/* ═══ MORNING PHASES ═══ */
/* Always renders 3 morning phase tabs: Barrier Repair / Normal / Makeup Prep.
   Replaces the old single static morning block. */
function renderMorningPhases(selected,toner,essence,serum,moist,spf,c1,c2,isHighSens,eye,answers,mistProd){
  const _mpIsSimple=answers&&answers.complexity===t('o_simple');
  const _mpMistSub=mistProd?mistSubtype(mistProd):null;
  const _mpMistHydrating=!!(mistProd&&(_mpMistSub==='hydrating'||_mpMistSub==='soothing'||_mpMistSub==='glow'));
  const _mpMistMilky=!!(mistProd&&_mpMistSub==='milky');
  const _mpMistBarrier=!!(mistProd&&_mpMistSub==='barrier');
  const _mpMistSetting=!!(mistProd&&_mpMistSub==='setting');
  const c1IsBalm=c1&&(c1.subcategory==='cleansing balm'||c1.subcategory==='cleansing oil');
  const waterCleanse=c2||(!c1IsBalm&&c1?c1:null);
  const makeupSerum=selected.find(p=>p.makeupPrep&&(p.category==='serum'||p.category==='essence')&&!hasRetinoid(p)&&!hasExfoliantAcid(p))
    ||(serum&&!hasRetinoid(serum)&&!hasExfoliantAcid(serum)?serum:null)
    ||(essence&&!hasRetinoid(essence)&&!hasExfoliantAcid(essence)?essence:null);
  const panelSt='background:var(--off-white);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:22px';
  // Eye cream morning filters: exclude retinoid eye creams (belong at night)
  const morningEye=eye&&!hasRetinoid(eye)?eye:null;

  /* Barrier Repair Phase */
  let bn=0;const bs=(tp,e,b,n,note)=>makeStep(tp,++bn,e,b,n,note);
  // Barrier Repair morning: show toner unless it contains exfoliant acids (AHA/BHA/PHA) — same logic as normal morning
  const barrierToner = toner && !hasExfoliantAcid(toner) ? toner : null;
  const barrierHtml=`
    <div class="info-box rose" style="margin-bottom:10px;font-size:0.82rem;font-weight:500">ℹ️ ${t('morning_phase_barrier_note')}</div>
    ${bs('re','💧','',t('water_rinse'),t('no_cleanser_note'))}
    ${barrierToner?bs('n',prodEmoji(barrierToner),barrierToner.brand,barrierToner.name,t('morning_toner_note')):''}
    ${moist?bs('n',prodEmoji(moist),moist.brand,moist.name,t('morning_moist_note')):''}
    ${!spf?`<div class="info-box amber">${t('missing_spf_note')}</div>`:bs('n',prodEmoji(spf),spf.brand,spf.name,t('morning_spf_note'))}`;

  // Morning-safe filtering — retinoids and strong acid serums belong at night only
  const morningToner=toner&&!hasExfoliantAcid(toner)?toner:null;
  const morningEssence=essence&&!hasRetinoid(essence)&&!hasExfoliantAcid(essence)?essence:null;
  const morningSerum=serum&&!hasRetinoid(serum)&&!hasExfoliantAcid(serum)?serum:null;

  /* Normal Phase */
  let nn=0;const ns=(tp,e,b,n,note)=>makeStep(tp,++nn,e,b,n,note);
  const normalHtml=`
    ${waterCleanse?ns('n',prodEmoji(waterCleanse),waterCleanse.brand,waterCleanse.name,t('morning_cleanser_optional')):ns('re','💧','',t('water_rinse'),t('no_cleanser_note'))}
    ${morningToner?ns('n',prodEmoji(morningToner),morningToner.brand,morningToner.name,t('morning_toner_note')):''}
    ${_mpMistHydrating&&morningToner?ns('n',prodEmoji(mistProd),mistProd.brand,mistProd.name,'Mist onto face after toner for deeper hydration.'):''}
    ${morningEssence&&!_mpIsSimple?ns('n',prodEmoji(morningEssence),morningEssence.brand,morningEssence.name,''):''}
    ${morningSerum?ns('n',prodEmoji(morningSerum),morningSerum.brand,morningSerum.name,''):''}
    ${_mpMistMilky?ns('n',prodEmoji(mistProd),mistProd.brand,mistProd.name,'Apply milky mist after serum before moisturizer.'):''}
    ${morningEye&&!_mpIsSimple?ns('n',prodEmoji(morningEye),morningEye.brand,morningEye.name,t('step_eye_morning_note')):''}
    ${moist?ns('n',prodEmoji(moist),moist.brand,moist.name,t('morning_moist_note')):''}
    ${_mpMistBarrier?ns('n',prodEmoji(mistProd),mistProd.brand,mistProd.name,'Barrier mist after moisturizer to seal before SPF.'):''}
    ${!spf?`<div class="info-box amber">${t('missing_spf_note')}</div>`:ns('n',prodEmoji(spf),spf.brand,spf.name,t('morning_spf_note'))}
    ${_mpMistSetting?ns('n',prodEmoji(mistProd),mistProd.brand,mistProd.name,'Setting mist as final step to lock in morning routine.'):''}`;

  /* Makeup Prep Phase */
  let mn=0;const mns=(tp,e,b,n,note)=>makeStep(tp,++mn,e,b,n,note);
  const makeupHtml=`
    ${waterCleanse?mns('n',prodEmoji(waterCleanse),waterCleanse.brand,waterCleanse.name,t('morning_makeup_cleanser_note')):mns('re','💧','',t('water_rinse'),t('morning_makeup_cleanser_note'))}
    ${morningToner?mns('n',prodEmoji(morningToner),morningToner.brand,morningToner.name,t('morning_toner_note')):''}
    ${_mpMistHydrating&&morningToner?mns('n',prodEmoji(mistProd),mistProd.brand,mistProd.name,'Mist onto face after toner for deeper hydration.'):''}
    ${makeupSerum?mns('n',prodEmoji(makeupSerum),makeupSerum.brand,makeupSerum.name,t('morning_makeup_serum_note')):''}
    ${morningEye&&!_mpIsSimple?mns('n',prodEmoji(morningEye),morningEye.brand,morningEye.name,t('step_eye_morning_note')):''}
    ${moist?mns('n',prodEmoji(moist),moist.brand,moist.name,t('morning_makeup_moist_note')):''}
    ${!spf?`<div class="info-box amber">${t('missing_spf_note')}</div>`:mns('n',prodEmoji(spf),spf.brand,spf.name,t('morning_spf_note'))}
    ${_mpMistSetting?mns('n',prodEmoji(mistProd),mistProd.brand,mistProd.name,'Setting mist as final step to lock in makeup and SPF.'):''}
    <div class="info-box rose" style="margin-top:8px;font-size:0.82rem">${t('morning_makeup_spf_tip')}</div>`;

  return `<div class="morning-phases-container">
    <div class="phase-nav morning-phase-nav" style="margin-bottom:0">
      <button class="phase-tab active" onclick="switchMorningPhase('barrier',this)">${t('morning_phase_barrier_tab')}</button>
      <button class="phase-tab" onclick="switchMorningPhase('normal',this)">${t('morning_phase_normal_tab')}</button>
      <button class="phase-tab" onclick="switchMorningPhase('makeup',this)">${t('morning_phase_makeup_tab')}</button>
    </div>
    <div class="morning-phase-panel" data-mphase="barrier" style="${panelSt}">${barrierHtml}</div>
    <div class="morning-phase-panel" data-mphase="normal" style="${panelSt};display:none">${normalHtml}</div>
    <div class="morning-phase-panel" data-mphase="makeup" style="${panelSt};display:none">${makeupHtml}</div>
  </div>`;
}

/* Tab switcher for morning phases — scoped to .morning-phases-container so
   multiple saved routines on the same page don't interfere with each other. */
function switchMorningPhase(mid,btn){
  const scope=btn?btn.closest('.morning-phases-container'):null;
  if(!scope)return;
  scope.querySelectorAll('.morning-phase-panel').forEach(p=>{p.style.display='none';});
  scope.querySelectorAll('.morning-phase-nav .phase-tab').forEach(b=>b.classList.remove('active'));
  const panel=scope.querySelector('[data-mphase="'+mid+'"]');
  if(panel)panel.style.display='';
  if(btn)btn.classList.add('active');
}

function switchRoutinePhase(pid,btn){
  const card=btn?btn.closest('.builder-card'):null;
  if(!card)return;
  const cardId=card.dataset.cardId;
  // Only deactivate night-phase tabs — must NOT touch morning phase tabs (barrier/normal/makeup)
  // which also carry the .phase-tab class but live inside .morning-phase-nav.
  card.querySelectorAll('.phase-nav:not(.morning-phase-nav) .phase-tab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const data=window._glowPhaseData&&window._glowPhaseData[cardId];
  if(!data)return;
  const pa=_getPhaseActives(data,pid);
  const isOptional=pid==='p1'&&data.isBarrierHealthy;
  const phaseArea=card.querySelector('.active-phase-area');
  if(!phaseArea)return;
  // Re-render only the selected phase into the active-phase-area — no other phases touch the DOM.
  phaseArea.innerHTML=renderPhase(
    pid,data.selected,data.c1,data.c2,
    data.toner,data.essence,data.nightSerum,data.moist,
    data.deviceGel,data.usesDevice,
    pa.bha,pa.retinal,pa.aha,pa.peel,
    data.isMature,data.isHighSens,'active',isOptional,
    data.eye,data.sleepingPack,data._answersWithDayProducts,data.mistProd,data.selectedDay||'Mon'
  );
}

/* ═══ PHASE RENDER ═══ */
const DAY_PLANS={
  p1:{Mon:{type:'normal',goal:'Deep hydration + barrier sealing',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Tue:{type:'device',goal:'Device-boosted hydration',device:true,deviceModes:['booster','air'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Wed:{type:'recovery',goal:'Rest + deep repair overnight',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'normal',goal:'Hydration + soothing',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Fri:{type:'device',goal:'Booster mode hydration infusion',device:true,deviceModes:['booster'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Sat:{type:'recovery',goal:'Skin reset + moisture lock',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Sun:{type:'recovery',goal:'Full recovery + week prep',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false}},
  p2:{Mon:{type:'normal',goal:'Hydration + spot acne control',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Tue:{type:'device',goal:'PDRN device treatment for PIH',device:true,deviceModes:['mc','derma'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Wed:{type:'recovery',goal:'Recovery from device treatment',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'normal',goal:'Glow boost + hydration',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Fri:{type:'device',goal:'Booster + PDRN treatment',device:true,deviceModes:['booster','mc'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Sat:{type:'recovery',goal:'Deep moisture + skin reset',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Sun:{type:'normal',goal:'Gentle prep for next week',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false}},
  p3:{Mon:{type:'normal',goal:'Hydration + spot acne',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Tue:{type:'active',goal:'Retinal introduction — eye area only',device:false,recovery:false,bha:false,retinal:true,aha:false,peel:false},Wed:{type:'recovery',goal:'Recovery after retinal',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'device',goal:'PDRN device + optional peel',device:true,deviceModes:['mc','derma'],recovery:false,bha:false,retinal:false,aha:false,peel:true},Fri:{type:'active',goal:'Second retinal night',device:false,recovery:false,bha:false,retinal:true,aha:false,peel:false},Sat:{type:'normal',goal:'Spot acne + glow',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Sun:{type:'recovery',goal:'Full recovery night',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false}},
  p4:{Mon:{type:'normal',goal:'Peptide + anti-aging hydration',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Tue:{type:'active',goal:'Retinal maintenance',device:false,recovery:false,bha:false,retinal:true,aha:false,peel:false},Wed:{type:'recovery',goal:'Recovery + barrier maintenance',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'device',goal:'Anti-aging device treatment',device:true,deviceModes:['booster','mc'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Fri:{type:'active',goal:'AHA texture refinement',device:false,recovery:false,bha:false,retinal:false,aha:true,peel:false},Sat:{type:'recovery',goal:'Collagen support recovery',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Sun:{type:'normal',goal:'Full moisturize + week prep',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false}}
};
const DAY_NAMES={Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday'};

function renderPhase(pid,selected,c1,c2,toner,essence,serum,moist,deviceGel,usesDevice,bha,retinal,aha,peel,isMature,isHighSens,activeClass,isOptional,eye,sleepingPack,answers,mistProd,selectedDay){
  const plan=DAY_PLANS[pid]||DAY_PLANS.p1;
  const _rpA=answers||{};
  const _rpIsDry=(_rpA.skinTypes||[]).some(s=>s===t('o_dry'));
  const _rpDamagedBarrier=_rpA.barrierCondition===t('o_slightly')||_rpA.barrierCondition===t('o_very_damaged')||(_rpA.skinTypes||[]).includes(t('o_barrier'));
  const _rpNeedsExtraOcclusion=_rpIsDry||_rpDamagedBarrier;
  const _rpIsSimple=_rpA.complexity===t('o_simple');
const _rpIsModerate=_rpA.complexity===t('o_moderate_r');
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const phases={p1:{title:t('phase1_title'),desc:t('phase1_desc'),dur:t('phase1_dur'),cls:'p1'},p2:{title:t('phase2_title'),desc:t('phase2_desc'),dur:t('phase2_dur'),cls:'p2'},p3:{title:t('phase3_title'),desc:t('phase3_desc'),dur:t('phase3_dur'),cls:'p3'},p4:{title:t('phase4_title'),desc:t('phase4_desc'),dur:t('phase4_dur'),cls:'p4'}};
  const ph=phases[pid];
  const dayBtns=days.map(d=>{
    const dp=plan[d];let cls='day-btn';
    if(dp.recovery)cls+=' recovery';
    else if(dp.retinal||dp.aha)cls+=' active-night';
    else if(dp.device&&usesDevice)cls+=' device-day';
    return `<button class="${cls} ${d===(selectedDay||'Mon')?'active':''}" data-phase="${pid}" data-day="${d}" onclick="selectDay('${pid}','${d}',this)">${d}${dp.recovery?' 🌿':((dp.retinal||dp.aha)?' 🌙':(dp.device&&usesDevice?' 💡':''))}</button>`;
  }).join('');
  const dayPanels=[selectedDay||'Mon'].map(d=>{
    const dp=plan[d];
    // Per-day rotation: read pre-computed toner/essence/serum for this day, fall back to fixed values
    const _phDayProds=(_rpA._dayProducts&&_rpA._dayProducts[pid]&&_rpA._dayProducts[pid][d])||{};
    const _effToner=_phDayProds.toner!==undefined?_phDayProds.toner:toner;
    const _effEssence=_phDayProds.essence!==undefined?_phDayProds.essence:essence;
    const _effSerum=_phDayProds.serum!==undefined?_phDayProds.serum:serum;
    const isRec=dp.recovery,isDev=dp.device&&usesDevice,isRet=dp.retinal&&retinal,isBHA=dp.bha&&bha,isPeel=dp.peel&&peel,isAHA=dp.aha&&aha;
    const isBarrierPhase=pid==='p1';
    const isBarrierRecovery=isRec&&isBarrierPhase;
    const c1IsBalm=c1&&(c1.subcategory==='cleansing balm'||c1.subcategory==='cleansing oil');
    const oilCleanser=c1IsBalm?c1:null;
    const waterCleanser=c2||(!c1IsBalm&&c1?c1:null);
    const cardType=isRec?'recovery':isRet||isAHA?'actives':isDev?'device':'normal';
    let avoidList=[];
    if(isRet)avoidList=[t('avoid_all_devices'),t('avoid_aha_toner'),t('avoid_bha_acne_gel'),t('avoid_peeling_gel')];
    else if(isDev)avoidList=[t('avoid_retinal_label'),t('avoid_aha_label'),t('avoid_bha_acne_gel'),t('avoid_peeling_gel')];
    else if(isBHA)avoidList=[t('avoid_retinal_label'),t('avoid_aha_toner'),t('avoid_peeling_gel'),t('avoid_device_label')];
    else if(isPeel)avoidList=[t('avoid_retinal_label'),t('avoid_aha_toner'),t('avoid_air_shot_label'),t('avoid_acne_gel_label')];
    else if(isAHA)avoidList=[t('avoid_retinal_label'),t('avoid_bha_acne_gel'),t('avoid_all_devices'),t('avoid_peeling_gel')];
    else if(isRec)avoidList=[t('avoid_all_actives'),t('avoid_all_device_modes')];
    else avoidList=[t('avoid_actives'),t('avoid_device_phase1')];
    // Day-safe product filtering — one active focus per night, no stacking
    // Phase 1 (Barrier Repair): ALL days use isBarrierSafeProduct — no exceptions
    const dayToner=isRec
      ?(_effToner&&isBarrierSafeProduct(_effToner)?_effToner:null)  // Recovery: barrier-safe toners only — no AHA/BHA/PHA/vitamin C
      :(isBarrierPhase||isRet||isAHA||isBHA||isPeel)
        ?(_effToner&&isBarrierSafeProduct(_effToner)?_effToner:null)
        :(_effToner&&!hasExfoliantAcid(_effToner)?_effToner:null);  // Normal nights: acid-free toners only
    const dayEssence=isRec
      ?(_effEssence&&isBarrierSafeProduct(_effEssence)?_effEssence:null)  // Recovery: barrier-safe essences only
      :(isBarrierPhase||isRet||isAHA||isBHA||isPeel)
        ?(_effEssence&&isBarrierSafeProduct(_effEssence)?_effEssence:null)
        :(_effEssence&&!isStrongActive(_effEssence)?_effEssence:null);
    // On barrier-phase nights: suppress ampoule-weight serums when paired with
    // a heavy occlusive moisturizer — prevents the "2 moisturizers" sensation.
    // Lightweight hydrating/calming serums are always allowed alongside a rich cream.
    const serumBlockedByHeavyMoist=isBarrierPhase&&isHeavyMoisturizer(moist)&&isAmpouleWeightSerum(_effSerum);
    const daySerum=isRec
      ?(_effSerum&&isBarrierSafeProduct(_effSerum)&&hasCalmingIngredient(_effSerum)&&isNightSuitableSerum(_effSerum)&&!serumBlockedByHeavyMoist?_effSerum:null)  // Recovery: calming barrier-safe serums only (centella/ceramide/panthenol etc.)
      :(isBarrierPhase||isRet||isAHA||isBHA||isPeel)
        ?(_effSerum&&isBarrierSafeProduct(_effSerum)&&isNightSuitableSerum(_effSerum)&&!serumBlockedByHeavyMoist?_effSerum:null)
        :(_effSerum&&!isStrongActive(_effSerum)&&isNightSuitableSerum(_effSerum)?_effSerum:null);
    // Eye cream evening: barrier-safe on recovery/barrier days; no retinoid eye creams on retinal nights; no acid eye creams on AHA/BHA nights
    const _normalDayEye=eye&&!hasRetinoid(eye)?(isRec||isBarrierPhase)?(isBarrierSafeProduct(eye)?eye:null):(isAHA||isBHA)?(!hasExfoliantAcid(eye)?eye:null):isRet?null:eye:null;
    const _retinoidDayEye=eye&&hasRetinoid(eye)&&isRet&&!isBarrierRecovery?eye:null;
    const dayEye=_normalDayEye;
    // ── Rule 4: Moderate step-count cap — max 7 steps per night routine ─────────
    // Pre-compute optional step visibility for moderate users before building HTML.
    // Mandatory steps are counted first; optional slots (up to 7 total) are filled
    // in priority order: essence → eye. Serum/actives/device/moist are non-negotiable.
    let _showEssence=!!(dayEssence&&!isBarrierRecovery&&!_rpIsSimple);
    let _showEye=!!(dayEye&&!isBarrierRecovery&&!_rpIsSimple);
    // ── Mist placement logic ──────────────────────────────────────────────────
    // Mist is optional — hidden on all active/recovery nights, barrier recovery, and simple complexity
    const _mistOkNight=!!(mistProd&&!isRec&&!isBarrierRecovery&&!isPeel&&!isAHA&&!isBHA&&!isRet&&!_rpIsSimple);
    const _mistSub=_mistOkNight?mistSubtype(mistProd):null;
    let _showMistStep=_mistOkNight;
    if(_rpIsModerate&&(_showEssence||_showEye||_showMistStep)){
      let _base=0;
      if(oilCleanser)_base++;                                                                       // oil/balm cleanser
      _base++;                                                                                       // water cleanser (always rendered)
      if(isPeel&&peel&&!isBarrierRecovery)_base++;                                                 // peeling gel
      if(dayToner)_base++;                                                                          // toner (device overlays are not steps — excluded from count)
      if(daySerum&&!isBarrierRecovery)_base++;                                                     // serum
      if(isAHA&&aha&&!isBarrierRecovery)_base++;                                                   // AHA
      if(isBHA&&bha&&!isBarrierRecovery)_base++;                                                   // BHA
      if(moist&&!(sleepingPack&&!_rpNeedsExtraOcclusion))_base++;                                 // moisturizer
      if(isRet&&retinal&&!isBarrierRecovery)_base++;                                              // retinal
      if(_retinoidDayEye)_base++;                                                                  // retinoid eye (post-retinal)
      const _slots=7-_base;
      // Fill slots: essence first (prep layer), then eye (targeted treatment), mist last (lowest priority)
      _showEssence=_showEssence&&_slots>=1;
      _showEye=_showEye&&(_slots>=2||(!_showEssence&&_slots>=1));
      const _usedOptional=(_showEssence?1:0)+(_showEye?1:0);
      _showMistStep=_showMistStep&&(_slots-_usedOptional)>=1;
    } else if(!_rpIsModerate&&(_showEssence||_showEye||_showMistStep)){
      let _base=0;
      if(oilCleanser)_base++;
      _base++;
      if(isPeel&&peel&&!isBarrierRecovery)_base++;
      if(dayToner)_base++;
      if(daySerum&&!isBarrierRecovery)_base++;
      if(isAHA&&aha&&!isBarrierRecovery)_base++;
      if(isBHA&&bha&&!isBarrierRecovery)_base++;
      if(moist&&!(sleepingPack&&!_rpNeedsExtraOcclusion))_base++;
      if(isRet&&retinal&&!isBarrierRecovery)_base++;
      if(_retinoidDayEye)_base++;
      const _slots=7-_base;
      const _usedOptional=(_showEssence?1:0)+(_showEye?1:0);
      _showMistStep=_showMistStep&&(_slots-_usedOptional)>=1;
    }
    const _showMistHydrating=_showMistStep&&(_mistSub==='hydrating'||_mistSub==='soothing'||_mistSub==='glow');
    const _showMistMilky=_showMistStep&&_mistSub==='milky';
    const _showMistBarrier=_showMistStep&&_mistSub==='barrier';
    // Setting mist: AM only — never shown in night routine
    // ── Device overlay compatibility ─────────────────────────────────────────────
    // Device modes are instruction overlays that attach to skincare products.
    // They do NOT receive step numbers and do NOT consume step slots.
    const _devModes=isDev?(dp.deviceModes||[]):[];
    // Booster Mode (orange): after toner or essence, blocked on actives/recovery nights
    const _boosterOk=_devModes.includes('booster')&&!isBarrierRecovery&&!isPeel&&!isRet&&!isAHA&&!isBHA;
    const _boosterTarget=_boosterOk?(dayToner&&!hasExfoliantAcid(dayToner)&&!hasBenzoylPeroxide(dayToner)?dayToner:(dayEssence&&!hasExfoliantAcid(dayEssence)?dayEssence:null)):null;
    const _showBooster=_boosterOk&&!!_boosterTarget;
    // Air Shot (neon blue): on dry skin before toner, blocked on recovery/damaged barrier/actives
    const _showAirShot=_devModes.includes('air')&&!isBarrierRecovery&&!isRec&&!_rpDamagedBarrier&&!isPeel&&!isRet&&!isAHA;
    // MC Mode (green): after PDRN gel or serum, blocked on recovery/damaged barrier/any exfoliant night
    const _mcOk=_devModes.includes('mc')&&!isBarrierRecovery&&!isRec&&!_rpDamagedBarrier&&!isPeel&&!isAHA&&!isBHA;
    const _mcTarget=_mcOk?(deviceGel||daySerum):null;
    const _showMC=_mcOk&&!!_mcTarget;
    // Derma Shot (red): after serum or moisturizer, blocked on recovery/peel/retinal/aha nights
    const _dermaOk=_devModes.includes('derma')&&!isBarrierRecovery&&!isRec&&!isPeel&&!isRet&&!isAHA;
    const _dermaTarget=_dermaOk?(daySerum||moist):null;
    const _showDerma=_dermaOk&&!!_dermaTarget;
    // Precompute overlay note strings (avoids backtick nesting issues in the template)
    const _airNote='Pat skin completely dry after cleansing. Use Air Shot on dry clean skin before toner — 1–2 smooth passes across cheeks and forehead.'+(isHighSens||isMature?' Max 1 pass for sensitive/mature skin.':'');
    const _boosterNote=_boosterTarget?('Apply '+_boosterTarget.name+' to damp skin, then glide Booster Mode across face for deeper hydration absorption.'):'';
    const _mcNote=_mcTarget?('Apply '+(_mcTarget===deviceGel&&deviceGel?deviceGel.name:(_mcTarget?_mcTarget.name:'treatment'))+' to targeted areas, then use MC Mode on '+(isPeel||isBHA?'congested and textured areas.':'acne marks and spots.')):'';
    const _dermaNote=_dermaTarget?('After applying '+(_dermaTarget?_dermaTarget.name:'serum')+', use Derma Shot along jawline and cheeks with upward lifting motions.'):'';
    // Device overlay renderer — colored instructional callout, no step number
    const _devOvl=(label,color,note)=>`<div style="display:flex;align-items:flex-start;gap:9px;padding:7px 10px 7px 12px;margin:2px 0 5px 10px;border-left:3px solid ${color};border-radius:0 8px 8px 0;background:${color}1a"><span style="font-size:1em;flex-shrink:0;margin-top:1px">&#x1F4A1;</span><div style="flex:1"><div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span style="font-size:.7em;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.04em">Medicube Booster Pro</span><span style="font-size:.7em;font-weight:700;color:#fff;background:${color};border-radius:20px;padding:2px 8px">${label}</span></div><div style="font-size:.78em;color:#666;line-height:1.4">${note}</div></div></div>`;
    // Debug trace (inspect via window._glowPhaseDebug in console)
    if(typeof window!=='undefined'){if(!window._glowPhaseDebug)window._glowPhaseDebug=[];window._glowPhaseDebug.push({phase:pid,day:d,modes:_devModes,air:{show:_showAirShot,blocked:!_showAirShot&&_devModes.includes('air')?{recovery:isBarrierRecovery,rec:isRec,damaged:_rpDamagedBarrier,peel:isPeel,ret:isRet,aha:isAHA}:null},booster:{show:_showBooster,target:_boosterTarget?_boosterTarget.name:null,blocked:!_showBooster&&_devModes.includes('booster')?{peel:isPeel,ret:isRet,aha:isAHA,bha:isBHA,noCompat:_boosterOk&&!_boosterTarget}:null},mc:{show:_showMC,target:_mcTarget?_mcTarget.name:null},derma:{show:_showDerma,target:_dermaTarget?_dermaTarget.name:null}});}
    let stepNum=0;
    const sn=(type='n')=>`<div class="rs-num ${type}">${++stepNum}</div>`;
    return `
      <div class="day-panel active" data-day="${d}">
        <div class="day-card">
          <div class="day-card-head ${cardType}">
            <div><div class="day-name">${tDayName(d)}</div><div class="day-goal">🎯 ${tDayGoal(dp.goal)}</div></div>
            <div class="day-badges">
              ${isRec?`<span class="dbadge recovery">${t('dbadge_recovery')}</span>`:''}
              ${isDev?`<span class="dbadge device">${t('dbadge_device')}</span>`:''}
              ${isRet?`<span class="dbadge retinal">${t('dbadge_retinal')}</span>`:''}
              ${isBHA?`<span class="dbadge actives">${t('dbadge_bha')}</span>`:''}
              ${isPeel?`<span class="dbadge actives">${t('dbadge_peel')}</span>`:''}
              ${isAHA?`<span class="dbadge actives">${t('dbadge_aha')}</span>`:''}
            </div>
          </div>
          <div class="day-card-body">
            <div class="label-xs">${isRec?t('recovery_night_label'):(isRet||isAHA||isBHA||isPeel)?t('treatment_night_label'):t('night_routine')}</div>
            ${oilCleanser?`<div class="routine-step ${isRec?'r-recovery':''}">${sn(isRec?'re':'n')}<div class="rs-emoji">${prodEmoji(oilCleanser)}</div><div class="rs-body"><div class="rs-brand">${oilCleanser.brand}</div><div class="rs-name">${oilCleanser.name}</div><div class="rs-note">${isRec?t('step_c1_recovery_note'):t('step_c1_note')}</div></div></div>`:''}
            ${waterCleanser?`<div class="routine-step">${sn()}<div class="rs-emoji">${prodEmoji(waterCleanser)}</div><div class="rs-body"><div class="rs-brand">${waterCleanser.brand}</div><div class="rs-name">${waterCleanser.name}</div></div></div>`:`<div class="routine-step">${sn()}<div class="rs-emoji">🧴</div><div class="rs-body"><div class="rs-name">${t('step_cleanser_reminder')}</div></div></div>`}
            ${_showAirShot?_devOvl('Air Shot','#00C2FF',_airNote):''}
            ${isPeel&&peel&&!isBarrierRecovery?`<div class="routine-step r-active">${sn('ac')}<div class="rs-emoji">${prodEmoji(peel)}</div><div class="rs-body"><div class="rs-brand">${peel.brand}</div><div class="rs-name">${peel.name}</div><div class="rs-note">${t('step_peel_note')}</div></div></div>`:''}
            ${dayToner?`<div class="routine-step ${isRec?'r-recovery':''}">${sn(isRec?'re':'n')}<div class="rs-emoji">${prodEmoji(dayToner)}</div><div class="rs-body"><div class="rs-brand">${dayToner.brand}</div><div class="rs-name">${dayToner.name}</div><div class="rs-note">${isRec?t('step_toner_recovery_note'):t('step_toner_note')}</div></div></div>`:''}
            ${_showBooster&&_boosterTarget===dayToner?_devOvl('Booster Mode','#FF8C00',_boosterNote):''}
            ${_showMistHydrating&&dayToner?`<div class="routine-step">${sn()}<div class="rs-emoji">💦</div><div class="rs-body"><div class="rs-brand">${mistProd.brand}</div><div class="rs-name">${mistProd.name}</div><div class="rs-note">Mist onto skin after toner — hold 15–20 cm away, 2 light passes.</div></div></div>`:''}
            ${_showEssence?`<div class="routine-step">${sn()}<div class="rs-emoji">${prodEmoji(dayEssence)}</div><div class="rs-body"><div class="rs-brand">${dayEssence.brand}</div><div class="rs-name">${dayEssence.name}</div></div></div>`:''}
            ${_showBooster&&_boosterTarget!==dayToner&&!!_boosterTarget?_devOvl('Booster Mode','#FF8C00',_boosterNote):''}
            ${daySerum&&!isBarrierRecovery?`<div class="routine-step">${sn()}<div class="rs-emoji">${prodEmoji(daySerum)}</div><div class="rs-body"><div class="rs-brand">${daySerum.brand}</div><div class="rs-name">${daySerum.name}</div></div></div>`:''}
            ${_showMC?_devOvl('MC Mode','#27AE60',_mcNote):''}
            ${_showDerma&&_dermaTarget===daySerum?_devOvl('Derma Shot','#E74C3C',_dermaNote):''}
            ${_showMistMilky?`<div class="routine-step">${sn()}<div class="rs-emoji">💦</div><div class="rs-body"><div class="rs-brand">${mistProd.brand}</div><div class="rs-name">${mistProd.name}</div><div class="rs-note">Apply milky mist after serum to seal in actives before moisturizer.</div></div></div>`:''}
            ${_showEye?`<div class="routine-step">${sn()}<div class="rs-emoji">${prodEmoji(dayEye)}</div><div class="rs-body"><div class="rs-brand">${dayEye.brand}</div><div class="rs-name">${dayEye.name}</div><div class="rs-note">${t('step_eye_note')}</div></div></div>`:''}
            ${isAHA&&aha&&!isBarrierRecovery?`<div class="routine-step r-active">${sn('ac')}<div class="rs-emoji">${prodEmoji(aha)}</div><div class="rs-body"><div class="rs-brand">${aha.brand}</div><div class="rs-name">${aha.name}</div><div class="rs-note">${t('step_aha_note')}</div></div></div>`:''}
            ${isBHA&&bha&&!isBarrierRecovery?`<div class="routine-step r-active">${sn('ac')}<div class="rs-emoji">${prodEmoji(bha)}</div><div class="rs-body"><div class="rs-brand">${bha.brand}</div><div class="rs-name">${bha.name}</div><div class="rs-note">${t('step_bha_note')}</div></div></div>`:''}
            ${(moist&&!(sleepingPack&&!_rpNeedsExtraOcclusion))?`<div class="routine-step ${isRec?'r-recovery':''}">${sn(isRec?'re':'n')}<div class="rs-emoji">${prodEmoji(moist)}</div><div class="rs-body"><div class="rs-brand">${moist.brand}</div><div class="rs-name">${moist.name}</div>${isRet&&retinal&&!isBarrierRecovery?`<div class="rs-note">${t('step_moisturizer_before_retinal_note')}</div>`:''}</div></div></div>`:''}
            ${_showDerma&&_dermaTarget===moist?_devOvl('Derma Shot','#E74C3C',_dermaNote):''}
            ${_showMistBarrier?`<div class="routine-step">${sn()}<div class="rs-emoji">💦</div><div class="rs-body"><div class="rs-brand">${mistProd.brand}</div><div class="rs-name">${mistProd.name}</div><div class="rs-note">Barrier mist over moisturizer to lock in hydration overnight.</div></div></div>`:''}
            ${isRet&&retinal&&!isBarrierRecovery?`<div class="routine-step r-retinal">${sn('rt')}<div class="rs-emoji">${prodEmoji(retinal)}</div><div class="rs-body"><div class="rs-brand">${retinal.brand}</div><div class="rs-name">${retinal.name}</div><div class="rs-note">${t('step_retinal_note')}</div></div></div>`:''}
            ${_retinoidDayEye?`<div class="routine-step r-retinal">${sn('rt')}<div class="rs-emoji">${prodEmoji(_retinoidDayEye)}</div><div class="rs-body"><div class="rs-brand">${_retinoidDayEye.brand}</div><div class="rs-name">${_retinoidDayEye.name}</div><div class="rs-note">${t('step_eye_note')}</div></div></div>`:''}
            ${sleepingPack&&!isBarrierRecovery&&(!_rpIsSimple||_rpNeedsExtraOcclusion)&&(!_rpIsModerate||_rpNeedsExtraOcclusion)?`<div class="routine-step">${sn()}<div class="rs-emoji">🌙</div><div class="rs-body"><div class="rs-brand">${sleepingPack.brand}</div><div class="rs-name">${sleepingPack.name}</div></div></div>`:''}
            <div class="avoid-box"><div class="avoid-title">${t('avoid_tonight')}</div><div class="avoid-chips">${avoidList.map(a=>`<span class="avoid-chip">${a}</span>`).join('')}</div></div>
            ${isRet?`<div class="skin-note"><div class="skin-note-title">${t('retinal_rule')}</div>${t('retinal_rule_body')}</div>`:''}
            ${isRec?`<div class="skin-note"><div class="skin-note-title">${t('recovery_note')}</div>${t('recovery_note_body')}</div>`:''}
            ${isMature&&isDev?`<div class="skin-note"><div class="skin-note-title">${t('mature_skin_note_label')}</div>${t('mature_skin_note_body')}</div>`:''}
          </div>
        </div>
      </div>`;
  }).join('');
  return `<div class="phase-panel ${activeClass}" id="rp-${pid}" data-pid="${pid}"><div class="phase-hero-box ${ph.cls}"><div class="ph-tag">${tFmt('result_phase_label',{n:pid.replace('p','')})}</div><div class="ph-title">${ph.title}</div><div class="ph-desc">${ph.desc}</div><div class="ph-duration">${ph.dur}</div></div>${isOptional?`<div class="info-box amber" style="margin:10px 0 8px;display:flex;align-items:flex-start;gap:8px"><span style="font-size:1.1em;flex-shrink:0">💚</span><div><strong>${t('phase1_optional_badge')}</strong> — ${t('phase1_optional_note')}</div></div>`:''}<div class="day-nav-wrap"><div class="day-nav" id="dn-${pid}">${dayBtns}</div></div><div class="day-content-area">${dayPanels}</div></div>`;
}

/* Render a single day-panel HTML string by delegating to renderPhase with
   selectedDay set, then extracting the .day-content-area inner content.
   Used by selectDay() to replace only the day panel without re-rendering the
   full phase header and day navigation. */
function _renderDayPanelHtml(d,pid,c1,c2,toner,essence,serum,moist,deviceGel,usesDevice,bha,retinal,aha,peel,isMature,isHighSens,eye,sleepingPack,answers,mistProd){
  const tmp=document.createElement('div');
  tmp.innerHTML=renderPhase(pid,null,c1,c2,toner,essence,serum,moist,deviceGel,usesDevice,bha,retinal,aha,peel,isMature,isHighSens,'active',false,eye,sleepingPack,answers,mistProd,d);
  const area=tmp.querySelector('.day-content-area');
  return area?area.innerHTML:'';
}

/* ═══ DAY INTERACTION ═══ */
// Day buttons use inline onclick="selectDay(pid,day,this)" defined in renderPhase().
// The inline handler passes `this` so selectDay can scope to the enclosing .phase-panel
// and avoid touching elements in other (hidden) pages that share the same IDs.
// Event delegation is intentionally NOT used: attaching a delegated handler on
// #builder-content / #myroutine-content caused selectDay to fire twice per click
// (once from the inline onclick, once from delegation) producing a visible flash
// as active classes were stripped and re-applied.
function attachDayInteractions(){
  // No-op — kept to avoid "not defined" errors from existing call sites.
  // All day interaction is handled by inline onclick in renderPhase().
}
function dayClickHandler(e){
  const btn=e.target.closest('.day-btn[data-phase][data-day]');
  if(!btn)return;
  selectDay(btn.dataset.phase,btn.dataset.day,btn);
}
function selectDay(pid,day,btn){
  const card=btn?btn.closest('.builder-card'):null;
  if(!card)return;
  const cardId=card.dataset.cardId;
  // Update day nav buttons within the currently rendered phase panel
  const phasePanel=card.querySelector('.phase-panel');
  if(phasePanel){
    phasePanel.querySelectorAll('.day-nav .day-btn').forEach(b=>b.classList.remove('active'));
  }
  if(btn)btn.classList.add('active');
  const data=window._glowPhaseData&&window._glowPhaseData[cardId];
  if(!data)return;
  const pa=_getPhaseActives(data,pid);
  // Replace only the day-content-area — phase header and day nav stay intact.
  const dayContent=card.querySelector('.day-content-area');
  if(!dayContent)return;
  dayContent.innerHTML=_renderDayPanelHtml(
    day,pid,data.c1,data.c2,data.toner,data.essence,data.nightSerum,data.moist,
    data.deviceGel,data.usesDevice,pa.bha,pa.retinal,pa.aha,pa.peel,
    data.isMature,data.isHighSens,data.eye,data.sleepingPack,data._answersWithDayProducts,data.mistProd
  );
  // Persist selected day so phase switches can restore the user's position
  data.selectedDay=day;
}
function makeStep(type,num,emoji,brand,name,note){
  const colors={n:'linear-gradient(135deg,#c9897a,#a86b5e)',re:'linear-gradient(135deg,#8aaa92,#5a7f64)',dv:'linear-gradient(135deg,#7898c0,#5a7898)',ac:'linear-gradient(135deg,#9878c0,#7a60a8)',rt:'linear-gradient(135deg,#c8a040,#a07820)'};
  return `<div class="routine-step${type!=='n'?' r-'+{re:'recovery',dv:'device',ac:'active',rt:'retinal'}[type]:''}"><div class="rs-num ${type}" style="background:${colors[type]||colors.n};color:white">${num}</div><div class="rs-emoji">${emoji}</div><div class="rs-body">${brand?`<div class="rs-brand">${brand}</div>`:''}<div class="rs-name">${name}</div>${note?`<div class="rs-note">${note}</div>`:''}</div></div>`;
}

/* ═══ ANALYSIS + CONFLICT ═══ */
function detectConflicts(selected){
  const has=(ai)=>selected.some(p=>(p.activeIngredients||[]).includes(ai));
  // Retinoid detection: retinal OR retinol OR tretinoin OR adapalene
  const hasRetinal=has('retinal')||selected.some(p=>p.ingredients&&p.ingredients.toLowerCase().includes('retinal'));
  const hasRetinol=has('retinol')||selected.some(p=>p.ingredients&&/\bretinol\b/.test((p.ingredients||'').toLowerCase()));
  const hasAnyRetinoid=hasRetinal||hasRetinol||selected.some(p=>hasRetinoid(p));
  // Exfoliant detection
  const hasGlycolic=has('aha')||selected.some(p=>p.ingredients&&p.ingredients.toLowerCase().includes('glycolic acid'));
  const hasAnyAcid=selected.some(p=>hasExfoliantAcid(p));
  const hasBHA=selected.some(p=>p.subcategory==='spot treatment'||(p.ingredients&&p.ingredients.toLowerCase().includes('salicylic acid')));
  const hasPeel=selected.some(p=>(p.category==='exfoliant'&&p.subcategory!=='chemical exfoliant')||normalizedCategory(p)==='peeling gel');
  // Other actives
  const hasBP=selected.some(p=>hasBenzoylPeroxide(p));
  const hasStrongVC=selected.some(p=>hasStrongVitaminC(p));
  // Count retinoids and exfoliants to detect stacking
  const retinoidCount=selected.filter(p=>hasRetinoid(p)).length;
  const exfoliantCount=selected.filter(p=>hasExfoliantAcid(p)).length;
  const conflicts=[];
  // Original rules
  if(hasRetinal&&hasGlycolic)conflicts.push({combo:'Retinal + Glycolic Acid',reasonKey:'conf_reason_retinal_aha'});
  if(hasRetinal&&hasBHA)conflicts.push({combo:'Retinal + Salicylic Acid (BHA)',reasonKey:'conf_reason_retinal_bha'});
  if(hasRetinal&&hasPeel)conflicts.push({combo:'Retinal + Physical Peeling Gel',reasonKey:'conf_reason_retinal_peel'});
  if(hasGlycolic&&hasPeel)conflicts.push({combo:'AHA + Peeling Gel',reasonKey:'conf_reason_aha_peel'});
  if(hasGlycolic&&hasBHA)conflicts.push({combo:'AHA + BHA',reasonKey:'conf_reason_aha_bha'});
  // Extended rules
  if(hasRetinol&&hasAnyAcid&&!hasRetinal)conflicts.push({combo:'Retinol + Exfoliating Acid',reasonKey:'conf_reason_retinol_acid'});
  if(hasBP&&hasAnyRetinoid)conflicts.push({combo:'Benzoyl Peroxide + Retinoid',reasonKey:'conf_reason_bp_retinoid'});
  if(hasBP&&hasStrongVC)conflicts.push({combo:'Benzoyl Peroxide + Vitamin C (L-Ascorbic Acid)',reasonKey:'conf_reason_bp_vitc'});
  if(retinoidCount>1)conflicts.push({combo:'Multiple Retinoids',reasonKey:'conf_reason_multi_retinoid'});
  if(exfoliantCount>1)conflicts.push({combo:'Multiple Exfoliating Acids',reasonKey:'conf_reason_multi_acid'});
  if(hasStrongVC&&hasAnyAcid)conflicts.push({combo:'Strong Vitamin C + Exfoliating Acid',reasonKey:'conf_reason_vitc_acid'});
  return conflicts;
}
function analyzeRoutine(selected,answers){
  const analyses=[];
  const isMature=(answers.skinTypes||[]).includes(t('o_mature'));
  const isHighSens=answers.sensitivity===t('o_high');
  const isBarrierDamaged=answers.barrierCondition&&answers.barrierCondition!==t('o_healthy');
  // Missing essentials
  if(!selected.some(p=>isSunscreenProduct(p)))analyses.push({type:'danger',icon:'⚠️',title:t('analysis_missing_spf'),body:t('analyses_missing_spf_body')});
  if(!selected.some(p=>p.category==='moisturizer'))analyses.push({type:'warn',icon:'⚠️',title:t('analysis_missing_moist'),body:t('analyses_missing_moist_body')});
  // Active count — uses expanded isStrongActive helper
  const actives=selected.filter(p=>isStrongActive(p));
  if(actives.length>2&&isBarrierDamaged)analyses.push({type:'danger',icon:'🚨',title:t('analysis_too_many'),body:tFmt('analyses_too_many_body',{n:actives.length})});
  // Sensitive skin + multiple actives
  if(isHighSens&&actives.length>1)analyses.push({type:'danger',icon:'🚨',title:t('analysis_sensitive_actives'),body:tFmt('analyses_sensitive_actives_body',{n:actives.length})});
  // Damaged barrier + retinoids
  const retinoidProds=selected.filter(p=>hasRetinoid(p));
  if(isBarrierDamaged&&retinoidProds.length>0)analyses.push({type:'warn',icon:'⚠️',title:t('analysis_retinoid_barrier'),body:t('analyses_retinoid_barrier_body')});
  // Multiple retinoids stacked
  if(retinoidProds.length>1)analyses.push({type:'danger',icon:'🚨',title:t('analysis_multi_retinoid'),body:t('analyses_multi_retinoid_body')});
  // Mature skin note
  if(isMature)analyses.push({type:'ok',icon:'🌿',title:t('analysis_mature_note'),body:t('analyses_mature_body')});
  // Barrier support check — if actives present but no barrier support product
  if(actives.length>0&&!selected.some(p=>isBarrierSupportProduct(p)))analyses.push({type:'warn',icon:'💧',title:t('analysis_barrier_support'),body:t('analyses_barrier_support_body')});
  if(selected.some(p=>!p.verified))analyses.push({type:'warn',icon:'⚠️',title:t('analyses_unverified_title'),body:t('analyses_unverified_body')});
  analyses.push({type:'ok',icon:'✅',title:tFmt('analyses_organised_title',{n:selected.length,mode:selected.length?t('analyses_organised_phased'):t('analyses_organised_simple')}),body:t('analyses_organised_body')});
  return analyses;
}

/* ═══ CONFLICT CHECKER ═══ */
function renderConflictGrid(){
  const g=document.getElementById('conflict-grid');if(!g)return;
  const q=(document.getElementById('conflict-search')||{}).value||'';
  const ql=q.toLowerCase();
  const filtered=ql?PRODUCT_DB.filter(p=>{
    const s=[p.brand,p.name,...(p.activeIngredients||[])].join(' ').toLowerCase();
    return s.includes(ql)||(p.ingredients&&p.ingredients.toLowerCase().includes(ql));
  }):PRODUCT_DB;
  g.innerHTML=filtered.map(p=>`<div class="prod-pick-card ${conflictSelected.includes(p.id)?'selected':''}" id="ck-${p.id}" onclick="toggleConflict(${p.id},this)"><div class="prod-pick-emoji">${prodEmoji(p)}</div><div class="prod-pick-info"><div class="prod-pick-brand">${p.brand}</div><div class="prod-pick-name">${p.name}</div></div><div class="prod-pick-check">✓</div></div>`).join('');
}
function toggleConflict(id,el){const i=conflictSelected.indexOf(id);if(i===-1){conflictSelected.push(id);el.classList.add('selected');}else{conflictSelected.splice(i,1);el.classList.remove('selected');}}
function clearConflict(){conflictSelected=[];document.querySelectorAll('[id^="ck-"]').forEach(el=>el.classList.remove('selected'));document.getElementById('conflict-results').innerHTML='';}
function runConflictCheck(){
  const sel=PRODUCT_DB.filter(p=>conflictSelected.includes(p.id)),r=document.getElementById('conflict-results');
  if(sel.length<2){r.innerHTML=`<div class="notice">${t('conflict_min_select')}</div>`;return;}
  const conflicts=detectConflicts(sel),extras=[];
  if(sel.some(p=>!p.fragranceFree))extras.push({type:'danger',title:t('conflict_frag_title'),body:t('conflict_frag_body')});
  if(sel.some(p=>!p.eoFree))extras.push({type:'warn',title:t('conflict_eo_title'),body:t('conflict_eo_body')});
  const acCount=sel.filter(p=>isStrongActive(p)).length;
  if(acCount>2)extras.push({type:'danger',title:t('conflict_too_many_title'),body:tFmt('conflict_too_many_body',{count:acCount})});
  const all=[...conflicts.map(c=>({type:'danger',title:`🚫 ${c.combo}`,body:t(c.reasonKey)})),...extras];
  if(!all.length){r.innerHTML=`<div class="conflict-result"><div class="conflict-head ok">${tFmt('conflict_none_head',{n:sel.length})}</div><div class="conflict-body">${t('conflict_none_body')}</div></div>`;}
  else{r.innerHTML=all.map(i=>`<div class="conflict-result"><div class="conflict-head ${i.type}">${i.title}</div><div class="conflict-body">${i.body}</div></div>`).join('');}
}

/* ═══ EMERGENCY ═══ */
/* ═══ PERSONALISED EMERGENCY ROUTINE ═══
   Replaces the old standalone Emergency tab. Always derives content from a
   given routineData (selectedIds + answers) so the protocol is specific to
   the user's actual products, skin profile, sensitivity, actives, conflicts,
   barrier state, and device usage. */
function _peRecoveryDaysKey(a){
  const s=a&&a.sensitivity;
  if(s===t('o_high'))return 'pe_duration_high';
  if(s===t('o_low'))return 'pe_duration_low';
  return 'pe_duration_mid';
}
function renderPersonalizedEmergencyHTML(rd){
  if(!rd||!(rd.selectedIds||[]).length){
    return `<div class="builder-card pe-card" style="margin-top:18px">
      <div class="pe-section-title">${t('pe_section_title')}</div>
      <div class="info-box blue" style="margin-top:8px"><strong>${t('pe_empty_title')}</strong><br>${t('pe_empty_body')}</div>
    </div>`;
  }
  const sel=PRODUCT_DB.filter(p=>(rd.selectedIds||[]).includes(p.id));
  const a=rd.answers||{};
  // isHarshForEmergency: covers all retinoids (incl. tretinoin/adapalene), all AHA/BHA/PHA
  // by ingredient string, benzoyl peroxide, strong vitamin C, and azelaic acid.
  const isHarshForEmergency=(p)=>isStrongActive(p)||hasStrongVitaminC(p)||(p.activeIngredients||[]).includes('azelaic acid');
  const stopProducts=sel.filter(p=>isHarshForEmergency(p)||normalizedCategory(p)==='exfoliant'||p.subcategory==='peeling');
  const safeProducts=sel.filter(p=>
    ['toner','essence','serum','moisturizer','sunscreen','cleanser'].includes(normalizedCategory(p))
    &&p.fragranceFree!==false
    &&p.alcoholFree!==false
    &&p.eoFree!==false
    &&!isHarshForEmergency(p)
  );
  const hasToner=safeProducts.some(p=>normalizedCategory(p)==='toner');
  const hasSerum=safeProducts.some(p=>['serum','essence'].includes(normalizedCategory(p)));
  const hasMoist=safeProducts.some(p=>normalizedCategory(p)==='moisturizer');
  const hasSPF=safeProducts.some(p=>normalizedCategory(p)==='sunscreen');
  const hasCleanser=safeProducts.some(p=>normalizedCategory(p)==='cleanser');
  const hasBarrierCream=sel.some(p=>(p.activeIngredients||[]).includes('ceramides')||(p.ingredients||'').toLowerCase().includes('ceramide'));
  const hasCalmingSerum=sel.some(p=>(p.activeIngredients||[]).includes('centella')||((p.ingredients||'').toLowerCase().match(/centella|panthenol|madecassoside/)));
  const usesDevice=a.usesDevice===t('o_yes');
  const isHighSens=a.sensitivity===t('o_high');
  const isBarrier=a.barrierCondition===t('o_very_damaged')||a.barrierCondition===t('o_slightly')||(a.skinTypes||[]).includes(t('o_barrier'));
  const tooManyActives=stopProducts.length>=3;
  let conflictsCount=0;
  try{conflictsCount=(typeof detectConflicts==='function'?(detectConflicts(sel)||[]).length:0);}catch(e){conflictsCount=0;}
  const days=t(_peRecoveryDaysKey(a));

  /* Step 1 — Stop */
  const stopHTML=stopProducts.length
    ? `<div class="avoid-box" style="margin-top:0">
        <div class="avoid-title">${t('pe_stop_label')}</div>
        <div class="avoid-chips">
          ${stopProducts.map(p=>`<span class="avoid-chip">${prodEmoji(p)} ${p.brand?p.brand+' · ':''}${p.name}</span>`).join('')}
          ${usesDevice?`<span class="avoid-chip">${t('pe_all_devices')}</span>`:''}
          <span class="avoid-chip">${t('pe_stop_makeup')}</span>
        </div>
      </div>`
    : `<div class="info-box blue" style="margin-top:0">${t('pe_step1_no_harsh')}${usesDevice?` · ${t('pe_all_devices')}`:''}</div>`;

  /* Step 2 — Recovery routine using user's safe products (or fallbacks) */
  const tonerProd=safeProducts.find(p=>normalizedCategory(p)==='toner');
  const serumProd=safeProducts.find(p=>['serum','essence'].includes(normalizedCategory(p))&&((p.activeIngredients||[]).includes('centella')||(p.activeIngredients||[]).includes('panthenol')||((p.ingredients||'').toLowerCase().match(/centella|panthenol|madecassoside/))))
                  ||safeProducts.find(p=>['serum','essence'].includes(normalizedCategory(p)));
  const moistProd=safeProducts.find(p=>normalizedCategory(p)==='moisturizer');
  const spfProd=safeProducts.find(p=>normalizedCategory(p)==='sunscreen');

  const step2HTML=`
    <div class="label-xs">${t('pe_step2_mn')}</div>
    ${makeStep('re','1','💧','',t('pe_step2_water'),t('pe_step2_water_note'))}
    ${tonerProd
      ? makeStep('re','2',prodEmoji(tonerProd),tonerProd.brand,tonerProd.name,t('pe_step2_toner_note'))
      : makeStep('re','2','💧','','Hydrating Toner',t('pe_step2_fallback_toner'))}
    ${serumProd
      ? makeStep('re','3',prodEmoji(serumProd),serumProd.brand,serumProd.name,t('pe_step2_serum_note'))
      : makeStep('re','3','✨','','Centella / Panthenol Serum',t('pe_step2_fallback_serum'))}
    ${moistProd
      ? makeStep('re','4',prodEmoji(moistProd),moistProd.brand,moistProd.name,t('pe_step2_moist_note'))
      : makeStep('re','4','🧴','','Ceramide Barrier Cream',t('pe_step2_fallback_moist'))}
    <div class="label-xs" style="margin-top:10px">${t('pe_step2_morning')}</div>
    ${spfProd
      ? makeStep('n','5',prodEmoji(spfProd),spfProd.brand,spfProd.name,t('pe_step2_spf_note'))
      : makeStep('n','5','☀️','','Mineral SPF 50+',t('pe_step2_fallback_spf'))}`;

  /* Step 3 — Safe to continue (from user's products) */
  const step3HTML=safeProducts.length
    ? `<div class="avoid-chips">${safeProducts.map(p=>`<span class="avoid-chip" style="background:var(--sage-lt);color:var(--sage-dk);border-color:var(--sage)">${prodEmoji(p)} ${p.brand?p.brand+' · ':''}${p.name}</span>`).join('')}</div>`
    : `<div class="info-box blue" style="margin-top:0">${t('pe_step3_empty')}</div>`;

  /* Step 4 — Missing essentials */
  const missing=[];
  if(!hasMoist)missing.push(t('pe_missing_moist'));
  if(!hasSPF)missing.push(t('pe_missing_spf'));
  if(!hasCleanser)missing.push(t('pe_missing_cleanser'));
  if(!hasCalmingSerum)missing.push(t('pe_missing_calming'));
  if(!hasBarrierCream)missing.push(t('pe_missing_barrier'));
  const step4HTML=missing.length
    ? `<ul class="pe-missing-list">${missing.map(m=>`<li>⚠ ${m}</li>`).join('')}</ul>`
    : `<div class="info-box green" style="margin-top:0">${t('pe_step4_none')}</div>`;

  /* Step 5 — Possible causes (personalised) */
  const causes=[];
  if(isHighSens)causes.push(t('pe_cause_high_sens'));
  if(tooManyActives)causes.push(t('pe_cause_actives'));
  if(usesDevice)causes.push(t('pe_cause_device'));
  if(isBarrier)causes.push(t('pe_cause_barrier'));
  if(conflictsCount>0)causes.push(t('pe_cause_conflicts'));
  if(!causes.length)causes.push(t('pe_cause_generic'));
  const step5HTML=`<ul class="pe-cause-list">${causes.map(c=>`<li>• ${c}</li>`).join('')}</ul>`;

  /* Step 6 — Ingredients to avoid (chips) */
  const avoidChips=['pe_avoid_retinal','pe_avoid_aha','pe_avoid_bha','pe_avoid_vc','pe_avoid_aa','pe_avoid_exf','pe_avoid_fr','pe_avoid_al','pe_avoid_eo','pe_avoid_peel'];
  const step6HTML=`<div class="avoid-chips">${avoidChips.map(k=>`<span class="avoid-chip">${t(k)}</span>`).join('')}</div>`;

  /* Step 7 — When to restart actives (uses computed days) */
  const step7Body=t('pe_step7_body').replace(/\{days\}/g,days);
  const step7HTML=`<div class="skin-note" style="margin-top:0">${step7Body}</div>`;

  /* Compose */
  return `
    <div class="builder-card pe-card" style="margin-top:18px">
      <div class="pe-section-title" style="font-family:'Playfair Display',serif;font-size:1.15rem;color:var(--ink);margin-bottom:6px">${t('pe_section_title')}</div>
      <div class="pe-section-sub" style="font-size:.78rem;color:var(--muted);margin-bottom:14px;line-height:1.6">${t('pe_section_sub')}</div>

      <div class="pe-step-title" style="font-size:.85rem;font-weight:600;color:var(--red);margin:10px 0 8px">${t('pe_step1_title')}</div>
      ${stopHTML}

      <div class="pe-step-title" style="font-size:.85rem;font-weight:600;color:var(--sage-dk);margin:18px 0 8px">${t('pe_step2_title').replace(/\{days\}/g,days)}</div>
      ${step2HTML}

      <div class="pe-step-title" style="font-size:.85rem;font-weight:600;color:var(--sage-dk);margin:18px 0 8px">${t('pe_step3_title')}</div>
      ${step3HTML}

      <div class="pe-step-title" style="font-size:.85rem;font-weight:600;color:var(--red);margin:18px 0 8px">${t('pe_step4_title')}</div>
      ${step4HTML}

      <div class="pe-step-title" style="font-size:.85rem;font-weight:600;color:var(--ink);margin:18px 0 8px">${t('pe_step5_title')}</div>
      ${step5HTML}

      <div class="pe-step-title" style="font-size:.85rem;font-weight:600;color:var(--red);margin:18px 0 8px">${t('pe_step6_title')}</div>
      ${step6HTML}

      <div class="pe-step-title" style="font-size:.85rem;font-weight:600;color:var(--ink);margin:18px 0 8px">${t('pe_step7_title')}</div>
      ${step7HTML}
    </div>`;
}

/* ═══ MY ROUTINES ═══
   Design philosophy: My Routine is the user's destination for their finished plan.
   It is NEVER a launcher back into the Routine Builder. The full routine result
   (phases, day cards, products, warnings) renders inline here. To re-edit, the user
   must explicitly click "Edit Products" or "Rebuild From Scratch". */
let renameTargetId=null;
function getSavedRoutines(){try{return JSON.parse(localStorage.getItem('gp_routines')||'[]');}catch(e){return[];}}
function setSavedRoutines(arr){localStorage.setItem('gp_routines',JSON.stringify(arr));}

/* Save the routine currently built in the Routine Builder.
   If an existing saved routine shares the same id, update it (versioning).
   Otherwise push a new entry. */
function saveCurrentRoutine(){
  if(!builderState.routineData){alert(t('alert_build_first'));return;}
  const routines=getSavedRoutines();
  const existing=routines.findIndex(r=>r.id===builderState.routineData.id);
  const payload={...builderState.routineData,updatedAt:new Date().toISOString()};
  if(existing>-1)routines[existing]=payload;
  else routines.push(payload);
  setSavedRoutines(routines);
  setCurrentRoutineId(payload.id);
  myRoutineState.selectedId=payload.id;
  alert(t('alert_routine_saved'));
  // If the user is currently viewing My Routine, refresh it
  const myPage=document.getElementById('page-myroutine');
  if(myPage&&myPage.classList.contains('active'))renderMyRoutines();
}

/* The main My Routine renderer.
   Three states:
     1. Has saved routines  → routine selector chips + full result + actions + recommendations
     2. No saved routines BUT a freshly-built unsaved routine exists in builderState → show
        the unsaved routine in full with a "Save This Routine" prompt at the top
     3. Nothing at all      → empty state with a CTA to the Routine Builder
*/
function renderMyRoutines(){
  const c=document.getElementById('myroutine-content');if(!c)return;
  const routines=getSavedRoutines();

  // CASE 3: truly empty
  if(!routines.length&&!(builderState.routineData&&(builderState.selectedIds||[]).length)){
    c.innerHTML=`
      <div class="empty-saved">
        <div style="font-size:2.6rem;margin-bottom:14px">💾</div>
        <div style="font-family:'Playfair Display',serif;font-size:1.2rem;margin-bottom:8px;color:var(--ink)">${t('myr_empty_title')}</div>
        <div style="margin-bottom:18px">${t('myr_empty_body')}</div>
        <button class="btn btn-rose" onclick="showPage('builder',null);initBuilder()">${t('myr_empty_cta')}</button>
      </div>`;
    return;
  }

  // CASE 2: no saved routines but an unsaved freshly-built one exists
  if(!routines.length&&builderState.routineData&&(builderState.selectedIds||[]).length){
    const rd=builderState.routineData;
    c.innerHTML=`
      <div class="info-box rose" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <span>${t('myr_unsaved_banner')}</span>
        <button class="btn btn-rose btn-sm" onclick="saveCurrentRoutine()">${t('myr_unsaved_save')}</button>
      </div>
      ${renderRoutineResultBody(rd)}
      ${renderRecommendationsHTML(rd)}
      ${renderPersonalizedEmergencyHTML(rd)}`;
    attachDayInteractions();
    return;
  }

  // CASE 1: one or more saved routines. Decide which to display.
  let selectedId=myRoutineState.selectedId||getCurrentRoutineId();
  if(!selectedId||!routines.find(r=>r.id===selectedId)){
    // Default to most recently updated
    const sorted=routines.slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
    selectedId=sorted[0].id;
  }
  myRoutineState.selectedId=selectedId;
  setCurrentRoutineId(selectedId);
  const current=routines.find(r=>r.id===selectedId);

  // Routine selector chips (only show if 2+ routines, to keep single-routine view calm)
  const selectorHTML=routines.length>1?`
    <div class="myr-selector">
      <div class="myr-selector-label">${t('myr_select_label')}</div>
      <div class="myr-chips">
        ${routines.map(r=>`
          <button class="myr-chip ${r.id===selectedId?'active':''}" onclick="loadRoutine('${r.id}')">
            <span class="myr-chip-name">${(r.name||'My Glowphase Routine').replace(/</g,'&lt;')}</span>
            <span class="myr-chip-meta">${r.phases||1} ${t('myr_phase_unit')}</span>
          </button>
        `).join('')}
      </div>
    </div>`:'';

  // Action bar for the currently displayed routine
  const actionsHTML=`
    <div class="builder-card" style="margin-top:14px">
      <div class="myr-actions">
        <div class="myr-actions-meta">
          <strong>${(current.name||'My Glowphase Routine').replace(/</g,'&lt;')}</strong>
          <span class="myr-actions-date">${t('myr_last_updated')}: ${new Date(current.updatedAt||current.createdAt).toLocaleDateString()}</span>
        </div>
        <div class="myr-actions-btns">
          <button class="btn btn-rose btn-sm" onclick="editRoutine('${current.id}')">${t('myr_btn_edit')}</button>
          <button class="btn btn-outline btn-sm" onclick="rebuildRoutine('${current.id}')">${t('myr_btn_rebuild')}</button>
          <button class="btn btn-ghost btn-sm" onclick="openRenameModal('${current.id}','${(current.name||'').replace(/'/g,"\\'")}')">${t('myr_btn_rename')}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRoutine('${current.id}')">${t('myr_btn_delete')}</button>
        </div>
      </div>
    </div>`;

  c.innerHTML=`
    ${selectorHTML}
    ${renderRoutineResultBody(current)}
    ${renderRecommendationsHTML(current)}
    ${renderPersonalizedEmergencyHTML(current)}
    ${actionsHTML}`;
  attachDayInteractions();
}

/* Open a saved routine in the My Routine view (does NOT navigate to builder).
   This fixes the original bug where clicking "Open" sent the user back to the questionnaire. */
function loadRoutine(id){
  const r=getSavedRoutines().find(x=>x.id===id);
  if(!r)return;
  myRoutineState.selectedId=id;
  setCurrentRoutineId(id);
  renderMyRoutines();
}

/* Explicit "Edit Products" — loads the saved routine's selected products into the builder
   and jumps to the product selection step, NOT the questionnaire start.
   _preserveOnce is a one-shot guard: showPage('builder') invokes initBuilder() which would
   otherwise wipe the state we just seeded. The flag tells initBuilder to skip the reset
   for this single call, then clears itself so the normal "new routine" flow is unaffected. */
function editRoutine(id){
  const r=getSavedRoutines().find(x=>x.id===id);if(!r)return;
  builderState.answers=Object.assign({},r.answers||{});
  builderState.selectedIds=(r.selectedIds||[]).slice();
  builderState.routineData=Object.assign({},r);
  builderState.step=QUIZ_STEPS.length; // product selection step (the step AFTER the last quiz question)
  builderState._preserveOnce=true;     // guard initBuilder() against wiping our seeded state
  showPage('builder',null);
}

/* Explicit "Rebuild From Scratch" — preserves quiz answers so the user doesn't lose
   their skin profile, but resets product selection and routine data. */
function rebuildRoutine(id){
  const r=getSavedRoutines().find(x=>x.id===id);if(!r)return;
  builderState.answers=Object.assign({},r.answers||{});
  builderState.selectedIds=[];
  builderState.routineData=null;
  builderState.step=0;
  showPage('builder',null);
  renderBuilderStep();
}

function duplicateRoutine(id){const routines=getSavedRoutines();const r=routines.find(x=>x.id===id);if(!r)return;routines.push({...r,id:Date.now().toString(),name:(r.name||'Routine')+' (copy)',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});setSavedRoutines(routines);renderMyRoutines();}

function deleteRoutine(id){
  if(!confirm(t('myr_delete_confirm')))return;
  setSavedRoutines(getSavedRoutines().filter(r=>r.id!==id));
  // Clear the currently-selected pointer if it was this routine
  if(myRoutineState.selectedId===id)myRoutineState.selectedId=null;
  if(getCurrentRoutineId()===id)setCurrentRoutineId('');
  renderMyRoutines();
}

function openRenameModal(id,name){renameTargetId=id;document.getElementById('rename-input').value=name;document.getElementById('rename-modal').classList.add('open');}
function closeRenameModal(){document.getElementById('rename-modal').classList.remove('open');renameTargetId=null;}
function confirmRename(){if(!renameTargetId)return;const name=document.getElementById('rename-input').value.trim();if(!name)return;const routines=getSavedRoutines();const r=routines.find(x=>x.id===renameTargetId);if(r){r.name=name;r.updatedAt=new Date().toISOString();setSavedRoutines(routines);}closeRenameModal();renderMyRoutines();}

/* ═══════════════════════════════════════════════════════════
   RECOMMENDATIONS ENGINE
   Detects gaps in the user's selected products and recommends safe matches
   from the existing PRODUCT_DB only. Respects fragrance/alcohol/EO avoid
   preferences as hard filters. Designed to be skincare-safe: prefers gentle,
   barrier-friendly products for sensitive/rosacea-prone/damaged-barrier users.
   Uses isSunscreenProduct() so mislabeled SPFs are recognised correctly.
═══════════════════════════════════════════════════════════ */
function generateRecommendations(rd){
  const answers=rd.answers||{};
  const selectedIds=(rd.selectedIds||[]);
  const selected=PRODUCT_DB.filter(p=>selectedIds.includes(p.id));

  const skinTypes=answers.skinTypes||[];
  const goals=answers.goals||[];
  const sensitivity=answers.sensitivity||'';
  const barrier=answers.barrierCondition||'';
  const acneLevel=answers.acneLevel||'';
  const redness=answers.redness||'';
  const avoid=answers.avoidIngredients||[];
  const isSensitive=skinTypes.includes(t('o_sensitive'))||skinTypes.includes(t('o_rosacea'))||skinTypes.includes(t('o_reactive'))||sensitivity===t('o_high');
  const isAcneProne=skinTypes.includes(t('o_acneprone'))||acneLevel===t('o_moderate')||acneLevel===t('o_severe')||acneLevel===t('o_occasional');
  const isMature=skinTypes.includes(t('o_mature'));
  const isDamaged=skinTypes.includes(t('o_barrier'))||barrier===t('o_very_damaged')||barrier===t('o_slightly');
  const isDehydrated=skinTypes.includes(t('o_dehydrated'));
  const isHighRedness=redness===t('o_high')||redness===t('o_medium');
  const needsAntiAging=answers.agingConcerns===t('o_yes')||goals.some(g=>[t('g_antiaging'),t('g_elasticity'),t('g_fine_lines'),t('g_wrinkles')].includes(g));
  const wantsAcneSupport=goals.includes(t('g_acne'))||isAcneProne;
  const wantsCalm=goals.includes(t('g_calm'))||isHighRedness||isSensitive;
  const wantsBarrier=goals.includes(t('g_barrier'))||isDamaged;
  const wantsHydration=goals.includes(t('g_hydration'))||isDehydrated;
  const wantsPIH=goals.includes(t('g_pih'))||goals.includes(t('g_hyperpig'));

  // Hard avoidance filter — never recommend anything the user explicitly excluded
  const userAvoidsFrag=avoid.includes(t('o_fragrance'));
  const userAvoidsAlc=avoid.includes(t('o_alcohol'));
  const userAvoidsEO=avoid.includes(t('o_eo'));
  const passesAvoid=(p)=>{
    if(userAvoidsFrag&&p.fragranceFree===false)return false;
    if(userAvoidsAlc&&p.alcoholFree===false)return false;
    if(userAvoidsEO&&p.eoFree===false)return false;
    if(selectedIds.includes(p.id))return false;
    return true;
  };
  // For sensitive/damaged-barrier users, prefer fully fragrance-free + alcohol-free + EO-free
  // even if user didn't explicitly avoid them. This is a skincare-safety override.
  const isGentle=(p)=>p.fragranceFree!==false&&p.alcoholFree!==false&&p.eoFree!==false;

  // Score products: higher = better match for user profile
  const scoreProduct=(p,context={})=>{
    let s=0;
    const ai=(p.activeIngredients||[]).map(x=>x.toLowerCase());
    const bestFor=(p.bestFor||'').toLowerCase();
    const desc=(p.description||'').toLowerCase();
    const dnc=(p.doNotCombine||'').toLowerCase();

    // Gentle bonus
    if(isGentle(p))s+=4;
    if(p.fragranceFree)s+=1;
    if(p.alcoholFree)s+=1;
    if(p.eoFree)s+=1;

    // Skincare-safety guard rails — penalize harsh products for vulnerable users
    if(isSensitive||isDamaged){
      // Avoid strong actives for compromised skin
      if(ai.includes('retinol')||ai.includes('retinal'))s-=8;
      if(ai.includes('aha'))s-=6;
      if(ai.includes('bha')&&context.category!=='acne-treatment')s-=3;
      if(bestFor.includes('not for sensitive')||bestFor.includes('resilient skin')||bestFor.includes('experienced users'))s-=15;
      if(dnc.includes('not for sensitive'))s-=10;
    }
    if(isAcneProne&&(bestFor.includes('dry, mature')&&!bestFor.includes('acne')))s-=3;

    // Match positives
    if(wantsCalm&&(ai.includes('centella')||desc.includes('soothing')||desc.includes('calm')||bestFor.includes('sensitive')||bestFor.includes('redness')))s+=6;
    if(wantsBarrier&&(ai.includes('ceramides')||desc.includes('barrier')||desc.includes('ceramide')))s+=6;
    if(wantsHydration&&ai.includes('hyaluronic acid'))s+=4;
    if(wantsAcneSupport&&(ai.includes('azelaic acid')||ai.includes('bha')||bestFor.includes('acne-prone')))s+=5;
    if(needsAntiAging&&(ai.includes('peptides')||ai.includes('pdrn')||ai.includes('retinal')||ai.includes('retinol')))s+=5;
    if(wantsPIH&&(ai.includes('arbutin')||ai.includes('vitamin c')||ai.includes('azelaic acid')||ai.includes('tranexamic acid')||desc.includes('brighten')||desc.includes('pih')))s+=4;

    // Best-for alignment
    if(skinTypes.includes(t('o_dry'))&&bestFor.includes('dry'))s+=2;
    if(skinTypes.includes(t('o_oily'))&&bestFor.includes('oily'))s+=2;
    if(skinTypes.includes(t('o_combo'))&&bestFor.includes('combination'))s+=2;
    if(isMature&&bestFor.includes('mature'))s+=3;
    if(isSensitive&&bestFor.includes('sensitive'))s+=4;
    return s;
  };

  const pick=(filterFn,context={})=>{
    const candidates=PRODUCT_DB.filter(p=>passesAvoid(p)&&filterFn(p));
    if(!candidates.length)return null;
    candidates.sort((a,b)=>scoreProduct(b,context)-scoreProduct(a,context));
    return candidates[0];
  };

  const hasCategory=(cat)=>selected.some(p=>normalizedCategory(p)===cat);
  const hasSunscreen=selected.some(p=>isSunscreenProduct(p));
  const recs=[];

  // RULE 1: No sunscreen — single highest-priority gap. SPF is non-negotiable.
  // Use isSunscreenProduct() so mislabeled SPFs still count toward "has SPF".
  if(!hasSunscreen){
    const spf=pick(p=>isSunscreenProduct(p),{category:'sunscreen'});
    if(spf)recs.push({product:spf,reason:t('rec_reason_no_spf'),supports:[t('g_barrier'),t('g_antiaging')],priority:1});
  }

  // RULE 2: No moisturizer — barrier cannot seal.
  // Exclude eye-area products: they're categorized as "moisturizer" in the DB but
  // an eye cream is NOT a face moisturizer. Skin-safety guard.
  if(!hasCategory('moisturizer')){
    const moist=pick(p=>normalizedCategory(p)==='moisturizer'&&!/eye/i.test(p.name||''),{category:'moisturizer'});
    if(moist)recs.push({product:moist,reason:t('rec_reason_no_moist'),supports:[t('g_barrier'),t('g_hydration')],priority:1});
  }

  // RULE 3: No cleanser
  if(!hasCategory('cleanser')){
    const cl=pick(p=>normalizedCategory(p)==='cleanser',{category:'cleanser'});
    if(cl)recs.push({product:cl,reason:t('rec_reason_no_cleanser'),supports:[t('g_barrier')],priority:2});
  }

  // RULE 4: No toner (hydration foundation)
  if(!hasCategory('toner')&&(wantsHydration||isDehydrated||isSensitive)){
    const tn=pick(p=>normalizedCategory(p)==='toner',{category:'toner'});
    if(tn)recs.push({product:tn,reason:t('rec_reason_no_toner'),supports:[t('g_hydration')],priority:3});
  }

  // RULE 5: Sensitive / redness without calming product
  if(wantsCalm&&!selected.some(p=>(p.activeIngredients||[]).includes('centella'))){
    const calm=pick(p=>(p.activeIngredients||[]).includes('centella')&&['serum','moisturizer','toner'].includes(normalizedCategory(p)),{category:'calming'});
    if(calm)recs.push({product:calm,reason:t('rec_reason_calming'),supports:[t('g_calm'),t('g_barrier')],priority:2});
  }

  // RULE 6: Acne-prone without acne support
  if(wantsAcneSupport&&!selected.some(p=>(p.activeIngredients||[]).some(ai=>['bha','azelaic acid'].includes(ai)))){
    const acne=pick(p=>{
      const ai=p.activeIngredients||[];
      const ok=ai.includes('azelaic acid')||(ai.includes('bha')&&normalizedCategory(p)!=='cleanser');
      // For sensitive users, prefer azelaic over BHA (gentler)
      if(isSensitive)return ai.includes('azelaic acid');
      return ok;
    },{category:'acne-treatment'});
    if(acne)recs.push({product:acne,reason:t('rec_reason_acne'),supports:[t('g_acne'),t('g_pih')],priority:2,caution:isSensitive?t('caution_acne_start'):null});
  }

  // RULE 7: Aging concern without anti-aging product
  if(needsAntiAging&&!selected.some(p=>(p.activeIngredients||[]).some(ai=>['peptides','pdrn','retinal','retinol'].includes(ai)))){
    const aa=pick(p=>{
      const ai=p.activeIngredients||[];
      // For sensitive users, prefer peptides/PDRN over retinol/retinal
      if(isSensitive||isDamaged)return ai.includes('peptides')||ai.includes('pdrn');
      return ai.includes('peptides')||ai.includes('pdrn')||ai.includes('retinal')||ai.includes('retinol');
    },{category:'anti-aging'});
    if(aa){
      const usesRetinoid=hasRetinoid(aa);
      recs.push({product:aa,reason:t('rec_reason_aging'),supports:[t('g_antiaging'),t('g_elasticity')],priority:3,caution:usesRetinoid?t('caution_retinoid_intro'):null});
    }
  }

  // RULE 8: Damaged barrier without dedicated ceramide repair
  if(wantsBarrier&&!selected.some(p=>(p.activeIngredients||[]).includes('ceramides')&&normalizedCategory(p)==='moisturizer')){
    const br=pick(p=>(p.activeIngredients||[]).includes('ceramides')&&normalizedCategory(p)==='moisturizer',{category:'barrier'});
    if(br)recs.push({product:br,reason:t('rec_reason_barrier'),supports:[t('g_barrier')],priority:2});
  }

  // RULE 9: PIH/hyperpigmentation concerns without brightening product
  if(wantsPIH&&!selected.some(p=>{
    const ai=p.activeIngredients||[];
    return ai.includes('arbutin')||ai.includes('tranexamic acid')||ai.includes('azelaic acid')||(ai.includes('vitamin c')&&normalizedCategory(p)==='serum');
  })){
    const pih=pick(p=>{
      const ai=p.activeIngredients||[];
      const ok=ai.includes('arbutin')||ai.includes('tranexamic acid')||ai.includes('azelaic acid')||(ai.includes('vitamin c')&&normalizedCategory(p)==='serum');
      if(!ok)return false;
      // For sensitive users, avoid high-% L-ascorbic acid products
      if(isSensitive&&/23%|20%/.test(p.description||''))return false;
      return true;
    },{category:'brightening'});
    if(pih)recs.push({product:pih,reason:t('rec_reason_pih'),supports:[t('g_pih'),t('g_hyperpig')],priority:3});
  }

  // RULE 10: Too many strong actives — recommend calming recovery.
  // Vitamin C (especially high-%) IS a dermatological active and should count here.
  const activeCount=selected.filter(p=>isStrongActive(p)||hasStrongVitaminC(p)).length;
  if(activeCount>=3&&!recs.some(r=>r.reason===t('rec_reason_calming'))){
    const calmRec=pick(p=>(p.activeIngredients||[]).includes('centella')&&['serum','moisturizer'].includes(normalizedCategory(p))&&isGentle(p),{category:'recovery'});
    if(calmRec)recs.push({product:calmRec,reason:t('rec_reason_too_many'),supports:[t('g_calm'),t('g_barrier')],priority:1,caution:t('caution_recovery_nights')});
  }

  // Dedupe by product id — if the same product was picked for two rules,
  // keep the higher-priority entry and merge reasons so the user understands
  // both gaps it fills. This avoids showing the same card twice.
  const seen=new Map();
  for(const r of recs){
    const pid=r.product.id;
    if(!seen.has(pid)){seen.set(pid,r);continue;}
    const existing=seen.get(pid);
    if(r.priority<existing.priority){
      r.reason=r.reason+' · '+existing.reason;
      r.supports=Array.from(new Set([...(r.supports||[]),...(existing.supports||[])]));
      seen.set(pid,r);
    } else {
      existing.reason=existing.reason+' · '+r.reason;
      existing.supports=Array.from(new Set([...(existing.supports||[]),...(r.supports||[])]));
    }
  }
  const deduped=Array.from(seen.values());

  // Sort by priority, then return up to 6 (keeps the section focused, not overwhelming)
  deduped.sort((a,b)=>a.priority-b.priority);
  return deduped.slice(0,6);
}

/* Renders the recommendation section. Always called at the bottom of the routine result. */
function renderRecommendationsHTML(rd){
  const recs=generateRecommendations(rd);
  if(!recs.length){
    return `
      <div class="builder-card rec-card-empty" style="margin-top:14px">
        <div class="rec-section-title">${t('rec_section_title')}</div>
        <div class="info-box green" style="margin-top:8px">${t('rec_none')}</div>
      </div>`;
  }
  return `
    <div class="builder-card" style="margin-top:14px">
      <div class="rec-section-title">${t('rec_section_title')}</div>
      <div class="rec-section-sub">${t('rec_section_sub')}</div>
      <div class="rec-grid">
        ${recs.map(r=>renderRecommendationCard(r)).join('')}
      </div>
    </div>`;
}

function renderRecommendationCard(r){
  const p=r.product;
  const ingMissing=!p.ingredients||p.ingredients.length<30; // very short = placeholder
  const flags=[];
  if(p.fragranceFree)flags.push(`<span class="rec-flag ff">${t('rec_ff')}</span>`);
  if(p.alcoholFree)flags.push(`<span class="rec-flag af">${t('rec_af')}</span>`);
  if(p.eoFree)flags.push(`<span class="rec-flag eof">${t('rec_eof')}</span>`);
  const category=displayCategory(p);
  const catLabel=category.charAt(0).toUpperCase()+category.slice(1);
  return `
    <div class="rec-card">
      <div class="rec-card-head">
        <div class="rec-card-emoji">${prodEmoji(p)}</div>
        <div class="rec-card-titles">
          <div class="rec-card-brand">${p.brand}</div>
          <div class="rec-card-name">${p.name}</div>
          <div class="rec-card-cat">${catLabel}</div>
        </div>
      </div>
      <div class="rec-card-reason">${r.reason}</div>
      ${r.supports&&r.supports.length?`<div class="rec-card-supports"><span class="rec-supports-label">${t('rec_supports')}:</span> ${r.supports.map(s=>`<span class="rec-support-tag">${s}</span>`).join('')}</div>`:''}
      ${flags.length?`<div class="rec-card-flags">${flags.join('')}</div>`:''}
      ${r.caution?`<div class="rec-card-caution">${t('rec_caution')}: ${r.caution}</div>`:''}
      ${ingMissing?`<div class="rec-card-verify">${t('rec_verify_inci')}</div>`:''}
      <div class="rec-card-actions">
        <button class="btn btn-rose btn-sm" onclick="addRecommendedProduct(${p.id})">${t('rec_btn_add')}</button>
        <button class="btn btn-ghost btn-sm" onclick="openProductModal(${p.id})">${t('rec_btn_view')}</button>
      </div>
    </div>`;
}

/* Adds a recommended product into the current routine context.
   Behavior depends on where we are:
   - In Routine Builder result: add to builderState.selectedIds and re-render result
   - In My Routine viewing a saved routine: add to the saved routine and persist */
function addRecommendedProduct(productId){
  const myPage=document.getElementById('page-myroutine');
  const onMyRoutine=myPage&&myPage.classList.contains('active');
  if(onMyRoutine&&myRoutineState.selectedId){
    const routines=getSavedRoutines();
    const r=routines.find(x=>x.id===myRoutineState.selectedId);
    if(!r)return;
    r.selectedIds=r.selectedIds||[];
    if(r.selectedIds.includes(productId))return;
    r.selectedIds.push(productId);
    r.updatedAt=new Date().toISOString();
    setSavedRoutines(routines);
    renderMyRoutines();
    return;
  }
  // Builder context
  if(builderState.selectedIds.includes(productId))return;
  builderState.selectedIds.push(productId);
  if(builderState.routineData){
    builderState.routineData.selectedIds=builderState.selectedIds.slice();
    builderState.routineData.updatedAt=new Date().toISOString();
  }
  renderBuilderStep();
}

/* ═══ EXPORT / IMPORT ═══ */
function exportRoutines(){
  const routines=getSavedRoutines();if(!routines.length){alert(t('alert_no_export'));return;}
  const blob=new Blob([JSON.stringify(routines,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='glowphase-routines-'+Date.now()+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}
function triggerImport(){document.getElementById('import-file').click();}
function importRoutines(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);if(!Array.isArray(data))throw new Error('Invalid format');
      const existing=getSavedRoutines();const existingIds=existing.map(r=>r.id);
      const newOnes=data.filter(r=>!existingIds.includes(r.id));
      setSavedRoutines([...existing,...newOnes]);
      alert(tFmt('alert_import_done',{count:newOnes.length,dup:data.length-newOnes.length}));
      renderMyRoutines();
    }catch(err){alert(t('alert_import_fail')+err.message);}
  };
  reader.readAsText(file);e.target.value='';
}

/* ═══ PAGE NAVIGATION ═══ */
function showPage(id,triggerBtn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const page=document.getElementById('page-'+id);if(page)page.classList.add('active');
  document.querySelectorAll(`.nav-btn[data-page="${id}"]`).forEach(b=>b.classList.add('active'));
  window.scrollTo(0,0);
  if(id==='library')renderLibrary();
  if(id==='builder')initBuilder();
  if(id==='myroutine')renderMyRoutines();
  if(id==='conflict')renderConflictGrid();
}

/* ═══ INIT ═══ */

// ── VIDEO HERO — works with local file path ──
(function(){
  const vid = document.getElementById('hero-vid');
  if(!vid) return;
  function showVid() {
    if(vid.classList.contains('loaded')) return;
    vid.classList.add('loaded');
  }
  // Listen for any video data
  vid.addEventListener('loadeddata', showVid, {once:true});
  vid.addEventListener('canplay', showVid, {once:true});
  vid.addEventListener('playing', showVid, {once:true});
  // Fallback: show after 1.5s regardless (network/permission delay)
  setTimeout(showVid, 1500);
  // Ensure muted (required for autoplay in all browsers)
  vid.muted = true;
  const p = vid.play();
  if(p && p.catch) p.catch(() => {
    // Autoplay blocked - still show video element (may play on click)
    showVid();
  });
  // Also trigger play on first user interaction if needed
  document.addEventListener('click', function tryPlay() {
    if(!vid.classList.contains('loaded')) {
      vid.play().catch(() => {});
    }
    document.removeEventListener('click', tryPlay);
  }, {once: true});
})();

document.addEventListener('DOMContentLoaded',()=>{
  const savedLang=localStorage.getItem('gp_lang')||'en';
  LANG=savedLang;
  document.querySelectorAll('.lang-btn').forEach(b=>{b.classList.toggle('active',b.textContent.toLowerCase()===savedLang);});
  applyTranslations();
  renderLibrary();
  initBuilder();
  renderConflictGrid();
  renderMyRoutines();
});
