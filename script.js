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
  if (/toner\s*pad|calming\s*pad|peeling\s*pad|daily\s*pad|hydrating\s*pad|exfoliating\s*pad|brightening\s*pad|moisturizing\s*pad|pore\s*pad|ampoule\s*pad|\bpads?\b/.test(_n) ||
      /toner\s*pad|calming\s*pad|peeling\s*pad|daily\s*pad|hydrating\s*pad|exfoliating\s*pad|brightening\s*pad|moisturizing\s*pad|pore\s*pad|ampoule\s*pad|\bpads?\b/.test(_sub)) return 'toner pad';
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
    'barrier-safe exfoliant', // PHA (gluconolactone, lactobionic), enzyme-only, very low irritation — safe in recovery phase
    'gentle exfoliant',       // low-% lactic acid (≤5%), mild mandelic, very fine physical
    'moderate exfoliant',     // AHA 5–10%, BHA ≤2%, mild glycolic, peeling gels
    'aggressive exfoliant'    // AHA >10%, high-% glycolic, TCA, strong BHA, prescription-grade
  ],
  // ── Safety tags (stored as array on p.safetyTags) ────────────────────
  // Layering and contraindication flags — support routine logic and conflict detection
  safetyTags: [
    'avoid-damaged-barrier',  // contains actives that worsen a compromised barrier
    'recovery-safe',          // safe and beneficial during barrier repair / post-procedure
    'sensitive-skin-safe',    // formulated for reactive, redness-prone, or allergy-prone skin
    'not-device-safe',        // should not be used on same day as RF/LED/microcurrent devices
    'fungal-acne-safe'        // free from fatty acids, esters, and other fungal-acne feeding ingredients
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
  // Explicit per-product opt-out: corrects barrier/moisturizer creams whose INCI contains a
  // non-functional acid (e.g. a lactic/glycolic copolymer, or trace lactic acid in a urea/NMF
  // buffer) that the keyword fallback below would otherwise mis-read as an exfoliant.
  if (p.isExfoliant === false) return false;
  const ai = (p.activeIngredients || []).map(a => a.toLowerCase());
  if (ai.some(a => ['aha','bha','pha','lha'].includes(a))) return true;
  if (p.category === 'exfoliant') return true;
  if (p.subcategory === 'chemical exfoliant') return true;
  // Trust the curated exfoliation tag — covers genuine PHA/enzyme exfoliants by intent, not ingredient guessing.
  if (p.exfoliationIntensity) return true;
  // Azelaic is a legitimate tag-less active in some products (routes through the treatment/active slot) — keep it.
  if (hasAzelaicAcid(p)) return true;
  // NO generic AHA/BHA ingredient-guessing. Verified across the DB (2026-07-06): every genuine AHA/BHA/PHA
  // exfoliant carries a curated tag (activeIngredients / category / subcategory / exfoliationIntensity),
  // while the raw INCI keywords only ever matched TRACE pH-buffer acids — e.g. "lactic acid" in a hydrating
  // essence / sunscreen / retinal serum, or "salicylic acid" in a cleanser — mis-flagging non-exfoliants.
  // If a future product is a real exfoliant, tag it (or set exfoliationIntensity) rather than relying on INCI.
  return false;
}

// Classify a leave-on exfoliant's primary acid type for sub-path routing: 'bha' | 'aha' | 'pha' | null.
// Trusts curated activeIngredients tags first, then INCI keywords. BHA (salicylic) wins over PHA when both
// present (e.g. an SA product with gluconolactone), since salicylic is the active exfoliant.
function _acidType(p) {
  if (!p) return null;
  if (p.isExfoliant === false) return null; // honor the per-product exfoliant opt-out
  const ai = (p.activeIngredients || []).map(a => a.toLowerCase());
  // Azelaic is its own active (acne + PIH + redness) — check first so it isn't mis-typed as BHA/AHA.
  if (ai.includes('azelaic') || /azelaic/.test((p.name || '').toLowerCase()) || /\bazelaic acid\b/.test((p.ingredients || '').toLowerCase())) return 'azelaic';
  if (ai.includes('bha')) return 'bha';
  if (ai.includes('aha')) return 'aha';
  if (ai.includes('pha')) return 'pha';
  const ing = (p.ingredients || '').toLowerCase();
  if (/\b(salicylic acid|capryloyl salicylic|beta hydroxy)\b/.test(ing)) return 'bha';
  if (/\b(glycolic acid|lactic acid|mandelic acid|alpha hydroxy)\b/.test(ing)) return 'aha';
  if (/\b(gluconolactone|lactobionic|poly hydroxy)\b/.test(ing)) return 'pha';
  return null;
}

// Detect PHA specifically (barrier-safe exfoliants)
function hasPHA(p) {
  if (!p) return false;
  const ai = (p.activeIngredients || []).map(a => a.toLowerCase());
  if (ai.includes('pha')) return true;
  const ing = (p.ingredients || '').toLowerCase();
  return /\b(gluconolactone|lactobionic|maltobionic|galactose|poly.?hydroxy)\b/.test(ing);
}

// Detect BHA / salicylic acid
function hasBHA(p) {
  if (!p) return false;
  const ai = (p.activeIngredients || []).map(a => a.toLowerCase());
  if (ai.includes('bha') || ai.includes('salicylic acid')) return true;
  const ing = (p.ingredients || '').toLowerCase();
  return /\b(salicylic acid|beta hydroxy|capryloyl salicylic|lha)\b/.test(ing);
}

// Detect azelaic acid
function hasAzelaicAcid(p) {
  if (!p) return false;
  const ai = (p.activeIngredients || []).map(a => a.toLowerCase());
  if (ai.includes('azelaic acid')) return true;
  const ing = (p.ingredients || '').toLowerCase();
  return /\bazelaic acid\b/.test(ing);
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
    if (p.exfoliationIntensity === 'barrier-safe exfoliant')                             return '✔ barrier-safe exfoliant (PHA/enzyme)';
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
// Fragile barrier profile — broad safety predicate (shared by scoring + the Phase 3 retinal warning).
// True when the barrier is compromised or the skin is reactive/rosacea/very sensitive/red.
function _isFragileProfile(a) {
  if (!a) return false;
  const st = a.skinTypes || [];
  return a.barrierCondition === t('o_slightly') || a.barrierCondition === t('o_very_damaged')
    || a.sensitivity === t('o_high') || a.redness === t('o_high')
    || st.some(s => s === t('o_barrier') || s === t('o_reactive') || s === t('o_rosacea'));
}

function _safetyTagScore(p, phaseType, a) {
  if (!p) return 0;
  const sTags = Array.isArray(p.safetyTags) ? p.safetyTags : [];
  const fTags = Array.isArray(p.functionTags) ? p.functionTags : [];
  if (!sTags.length && !fTags.includes('device recovery safe')) return 0;
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
  if (isRec  && fTags.includes('device recovery safe'))   s += 2;  // lives in functionTags
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
  // Broadened: fragile = compromised barrier OR reactive/rosacea/high-sensitivity/high-redness.
  const fragile = _isFragileProfile(a);
  let s = 0;

  // Retinoid intensity — only fires when tag is present
  if (p.retinoidIntensity) {
    if (isRec) {
      if (p.retinoidIntensity === 'advanced retinoid') s -= 10;
      else if (p.retinoidIntensity === 'moderate retinoid') s -= 7;
      else /* beginner */ s -= 4;
    } else if (fragile) {
      // Strengthened: fragile barriers should steer away from ALL retinoid strengths,
      // including beginner (was previously unpenalised). Strong down-rank, not a hard block.
      if (p.retinoidIntensity === 'advanced retinoid') s -= 10;
      else if (p.retinoidIntensity === 'moderate retinoid') s -= 7;
      else /* beginner */ s -= 4;
    }
  }

  // Exfoliation intensity — only fires when tag is present
  if (p.exfoliationIntensity) {
    if (isRec) {
      if (p.exfoliationIntensity === 'aggressive exfoliant')   s -= 10;
      else if (p.exfoliationIntensity === 'moderate exfoliant') s -= 7;
      else if (p.exfoliationIntensity === 'gentle exfoliant')   s -= 3;
      // barrier-safe exfoliant (PHA/enzyme): no penalty in recovery phase — actually beneficial
      else if (p.exfoliationIntensity === 'barrier-safe exfoliant') s += 1;
    } else if (fragile) {
      if (p.exfoliationIntensity === 'aggressive exfoliant')   s -= 6;
      else if (p.exfoliationIntensity === 'moderate exfoliant') s -= 3;
      // gentle + barrier-safe: no penalty for sensitive/weak skin
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
    if (hasAzelaicAcid(p))                                               score += 2; // azelaic acid fades PIH + anti-inflammatory
    if (/bright|fade|dark spot|pigment/.test(_desc))                     score += 1;
  }
  if (goals.includes(t('g_acne')) || skinTypes.includes(t('o_acneprone'))) {
    if (/niacinamide/.test(ing))             score += 2;
    if (/salicylic|centella|cica/.test(ing)) score += 2;
    if (/acne|blemish|pore/.test(_desc))     score += 1;
  }
  if (goals.includes(t('g_comedones')) || skinTypes.includes(t('o_congested'))) {
    if (hasBHA(p))                                           score += 4; // BHA penetrates pore lining — best for comedones
    if (hasPHA(p))                                           score += 2; // PHA gently loosens congestion, barrier-safe
    if (hasAzelaicAcid(p))                                   score += 3; // anti-comedone + anti-inflammatory
    if (/niacinamide/.test(ing))                             score += 2; // pore-tightening, sebum regulation
    if (/salicylic|beta.?hydroxy|capryloyl/.test(ing))       score += 2; // additional BHA detection
    if (/\blha\b|capryloyl salicylic/.test(ing))             score += 2; // LHA — gentler BHA derivative
    if ((p.safetyTags || []).includes('fungal-acne-safe'))   score += 1; // safe formulation for congestion
    if (/pore|comedone|blackhead|congested|clog/.test(_desc)) score += 1;
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
// ─── ROUTINE LOAD INDICATOR ──────────────────────────────────────────────────
// Computes a per-night "intensity score" from active signals.
// Returns { score, level, signals } where level 0=none, 2=moderate, 3=high, 4=intense.

function computeDayLoad(isRet, isAHA, isBHA, isPeel, isDev, isHighSens, isDamagedBarrier) {
  let score = 0;
  const signals = [];

  if (isRet)  { score += 3; signals.push('retinal'); }
  if (isAHA)  { score += 2; signals.push('aha'); }
  if (isBHA)  { score += 1; signals.push('bha'); }
  if (isPeel) { score += 2; signals.push('peel'); }
  if (isDev)  { score += 1; signals.push('device'); }

  // Stacking combos — increase load beyond individual scores
  if (isRet && isDev)  { score += 2; signals.push('retinal+device'); }
  if (isAHA && isDev)  { score += 1; signals.push('aha+device'); }
  if (isPeel && isDev) { score += 1; signals.push('peel+device'); }

  // Skin condition modifiers — sensitive/barrier skin feels more load from same actives
  const hasActiveNight = isRet || isAHA || isPeel;
  if (isHighSens && hasActiveNight)    { score += 1; signals.push('sensitive'); }
  if (isDamagedBarrier && hasActiveNight) { score += 1; signals.push('barrier'); }

  let level;
  if (score <= 1)      level = 0; // light — don't show strip
  else if (score <= 3) level = 2; // moderate
  else if (score <= 5) level = 3; // high
  else                 level = 4; // intense

  return { score, level, signals };
}

// Renders the load indicator strip HTML. Returns '' when level is 0 (no display).
function renderLoadStrip(isRet, isAHA, isBHA, isPeel, isDev, isHighSens, isDamagedBarrier) {
  const { level, signals } = computeDayLoad(isRet, isAHA, isBHA, isPeel, isDev, isHighSens, isDamagedBarrier);
  if (level === 0) return '';

  // Dots — 3 total; fill based on level
  const cls = `lv${level}`;
  const filled = level - 1; // lv2→1, lv3→2, lv4→3
  const dots = [1, 2, 3].map(i =>
    `<div class="load-dot${i <= filled ? ` filled ${cls}` : ''}"></div>`
  ).join('');

  // Label
  const label = level === 2 ? t('load_label_moderate')
              : level === 3 ? t('load_label_high')
              :               t('load_label_intense');

  // Message — most specific signal wins
  let msg;
  if (signals.includes('retinal+device'))   msg = t('load_msg_retinal_device');
  else if (signals.includes('barrier'))     msg = t('load_msg_barrier_active');
  else if (signals.includes('retinal'))     msg = level >= 3 ? t('load_msg_high') : t('load_msg_retinal');
  else if (signals.includes('aha') || signals.includes('peel')) msg = level >= 3 ? t('load_msg_high') : t('load_msg_aha');
  else if (signals.includes('bha'))         msg = t('load_msg_bha');
  else if (signals.includes('device'))      msg = t('load_msg_device');
  else                                      msg = t('load_msg_high');
  if (level === 4 && !signals.includes('retinal+device') && !signals.includes('barrier'))
    msg = t('load_msg_intense');

  // Optional tip — one contextual suggestion
  let tip = '';
  if (signals.includes('retinal+device'))            tip = t('load_tip_retinal_device');
  else if (signals.includes('sensitive') && (signals.includes('aha') || signals.includes('peel')))
    tip = t('load_tip_sensitive_exf');
  else if (signals.includes('barrier'))              tip = t('load_tip_barrier_active');

  return `<div class="load-strip load-lv${level}">
    <div class="load-dots">${dots}</div>
    <div class="load-content">
      <div class="load-label">${label}</div>
      <div class="load-msg">${msg}</div>
      ${tip ? `<div class="load-tip">${tip}</div>` : ''}
    </div>
  </div>`;
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
  'Full moisturize + week prep':'dpgoal_full_moist',
  'Barrier protection + deep hydration':'dpgoal_barrier_hyd',
  'Booster mode — hydration infusion':'dpgoal_barrier_device',
  'Barrier banking + recovery':'dpgoal_barrier_bank',
  'Calming hydration':'dpgoal_barrier_calm',
  'Gentle radiance + moisture seal':'dpgoal_barrier_glow',
  'Clarity + spot control':'dpgoal_glow_spot',
  'PDRN device — PIH + radiance':'dpgoal_glow_device',
  'AHA texture refinement + glow':'dpgoal_glow_aha',
  'Booster + glow treatment':'dpgoal_glow_device2',
  'Radiance prep + hydration':'dpgoal_glow_radiance',
  'Leave-on BHA exfoliation':'dpgoal_clarity_bha_exf',
  'Calm + spot control':'dpgoal_calm_spot',
  'PDRN device treatment':'dpgoal_device_only',
  'Peeling gel exfoliation':'dpgoal_peel_night'
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
  const _dn=(typeof PRODUCT_DB!=='undefined'&&PRODUCT_DB.length)?PRODUCT_DB.length:'';
  const _db=(typeof PRODUCT_DB!=='undefined'&&PRODUCT_DB.length)?new Set(PRODUCT_DB.map(p=>p.brand)).size:'';
  const _dfmt=x=>String(x).split('{prodCount}').join(_dn).split('{brandCount}').join(_db);
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k=el.dataset.i18n;let v=t(k);
    if(!v||v===k)return;
    v=_dfmt(v);
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
  if(id==='home'){renderHomePhaseWidget();applyTranslations();}
}

/* ═══════════════════════════════════════════════
   PRODUCT DATABASE
═══════════════════════════════════════════════ */

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

/* ═══ LIBRARY HERO PANEL (§A-1 redesign, 2026-07-19) ═══
   Stat tiles + the Formula/Active "refine" disclosure. Kept as small,
   independent functions so the redesign doesn't entangle with the core
   filter/render logic above. */
function _libUpdateHero(shownCount){
  const totalEl=document.getElementById('lib-hero-total'),brandsEl=document.getElementById('lib-hero-brands'),shownEl=document.getElementById('lib-hero-shown'),badge=document.getElementById('lib-refine-badge');
  if(totalEl)totalEl.textContent=PRODUCT_DB.length;
  if(brandsEl)brandsEl.textContent=new Set(PRODUCT_DB.map(p=>p.brand)).size;
  if(shownEl)shownEl.textContent=shownCount;
  if(badge){
    const n=activeFilters.formula.length+activeFilters.active.length;
    badge.style.display=n?'inline-block':'none';
    badge.textContent=n;
  }
}
function toggleLibRefine(){
  const toggle=document.getElementById('lib-refine-toggle'),panel=document.getElementById('lib-refine-panel');
  if(!toggle||!panel)return;
  const open=toggle.classList.toggle('open');
  panel.classList.toggle('open',open);
  toggle.setAttribute('aria-expanded',open?'true':'false');
}

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
function renderLibrary(){
  const filtered=filterProducts(),countEl=document.getElementById('lib-count'),content=document.getElementById('library-content');
  if(countEl)countEl.textContent=tFmt('lib_count',{shown:filtered.length,total:PRODUCT_DB.length});
  _libUpdateHero(filtered.length);
  if(!content)return;
  if(!filtered.length){content.innerHTML=`<div class="empty-lib"><div class="empty-lib-icon">🔍</div><div>${t('lib_empty')}</div></div>`;return;}
  const brands={};filtered.forEach(p=>{if(!brands[p.brand])brands[p.brand]=[];brands[p.brand].push(p);});
  content.innerHTML=Object.entries(brands).map(([brand,prods])=>{
    const prodHTML=prods.map(p=>{
      const actives=prodActiveTags(p).slice(0,3);
      // Consolidated, verified-only suitability tags, grounded entirely in
      // the real ingredient database (same source as the Formula Score
      // rings — see prodDbSuitability). Replaces the old loose bestFor-text
      // concern tags, which could show unverified/conflicting claims next
      // to these grounded ones. No grading: a product either genuinely
      // qualifies or the tag doesn't show. Oily intentionally excluded —
      // no texture/comedogenicity data exists yet to ground it.
      // (2026-07-15, expanded 2026-07-19)
      const suit=prodDbSuitability(p);
      const suitTags=[
        suit.sensitiveSafe?t('label_sensitive'):null,
        suit.barrierSafe?t('label_barrier'):null,
        suit.agingSupport?t('label_aging'):null,
        suit.acneActiveSupport?t('label_acne'):null,
        suit.brighteningSupport?t('label_brightening'):null,
        suit.drySupport?t('label_dry'):null,
        suit.rednessSupport?t('label_redness'):null
      ].filter(Boolean);
      return `
      <div class="product-row" data-product-id="${p.id}" role="button" tabindex="0" aria-label="View details for ${p.brand} ${p.name}">
        <div class="prod-emoji-sm">${prodEmoji(p)}</div>
        <div class="prod-info">
          <div class="prod-name-row"><span class="prod-name-sm">${p.name}</span><span class="prod-cat-tag">${displayCategory(p)}</span></div>
          <div class="prod-flags">
            ${p.fragranceFree?`<span class="prod-flag safe">${t('flag_fragrance_free')}</span>`:`<span class="prod-flag danger">${t('flag_has_fragrance')}</span>`}
            ${p.alcoholFree?'':`<span class="prod-flag warn">${t('flag_has_alcohol')}</span>`}
            ${p.eoFree?'':`<span class="prod-flag warn">${t('flag_has_eo')}</span>`}
            ${p.medicubeMode&&p.medicubeMode!=='None'?`<span class="prod-flag device">💡 ${p.medicubeMode}</span>`:''}
          </div>
          ${actives.length?`<div class="prod-concerns">${actives.map(a=>`<span class="prod-concern">${a}</span>`).join('')}</div>`:''}
        </div>
        ${suitTags.length?`<div class="prod-ratings-sm">${suitTags.map(l=>`<span class="prod-suit-tag tag-special">${l}</span>`).join('')}</div>`:''}
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

/* ═══ FORMULA SCORE CARD — Knowledge Hub Phase 1C (2026-07-14) ═══
   scoreProductSafety(p) looks up each ingredient in p.ingredients against
   INGREDIENT_SCORES / INGREDIENT_SCORES_ALNUM (loaded from
   ingredient-scores.js, generated by Research/build_ingredient_scores_js.py
   from the audited Research/Ingredients Database.xlsx — 1,434/1,434 matched).
   Degrades gracefully: any ingredient that doesn't resolve is listed as
   "Not yet scored" and excluded from the ring average, never guessed. */
function _fscNormalize(s){
  return (s||'').trim().toUpperCase().replace(/\s+/g,' ').replace(/[.*]+$/,'').trim();
}
function _fscAlnumKey(s){
  return (s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
}
function _fscTokenize(ing){
  // Split on every separator variant actually present in the product DB:
  // ',' standard, '•' U+2022 bullet, '●' U+25CF black circle, '･' U+FF65
  // halfwidth middle dot (JP/KR brand INCI lists), and newlines (a few
  // pasted-from-PDF entries use line breaks instead of commas). Without
  // this, an ingredient string using an unhandled separator collapses into
  // one giant unmatched token — silently zeroing out that product's Formula
  // Score and Skin Suitability instead of erroring loudly.
  const raw=(ing||'').split(/[,•●･\n]/).map(s=>s.trim()).filter(Boolean);
  const out=[]; let i=0;
  while(i<raw.length){
    const tok=raw[i];
    // rejoin a bare-digit fragment with the next token — handles INCI names
    // that contain an internal comma, e.g. "1,2-Hexanediol" -> "1" + "2-Hexanediol"
    if(/^\d+$/.test(tok) && i+1<raw.length){ out.push(tok+','+raw[i+1]); i+=2; continue; }
    // rejoin the back half of a large ppm/ppb/% figure that got split at its
    // own thousands-comma, e.g. "...Leaf Water(94,753ppm)" -> "...Leaf Water(94"
    // + "753ppm)". The second fragment is pure digits + unit, not a real
    // ingredient, so glue it back onto the ingredient before it instead of
    // leaving both halves as separate unmatched junk tokens.
    if(/^[\d,.\s]*(ppm|ppb|%)\s*\)?$/i.test(tok) && out.length){
      out[out.length-1]=out[out.length-1]+','+tok; i+=1; continue;
    }
    // rejoin a chemical name split at an internal locant comma, e.g.
    // "...Cyclohexane-1" + "4-Dicarboxylate" -> "...Cyclohexane-1,4-Dicarboxylate",
    // or "DIETHYLHEXYL 2" + "6-NAPHTHALATE" -> "DIETHYLHEXYL 2,6-NAPHTHALATE".
    // Different from the bare-digit case above: here the FIRST fragment is a
    // full ingredient name that happens to END in a short locant number, not a
    // bare digit on its own — and this also fires correctly even when the list's
    // primary separator is a bullet/dot, since a bare comma inside a chemical
    // name still gets treated as a hard split by this tokenizer regardless.
    if(/[\s-]\d{1,2}$/.test(tok) && i+1<raw.length && /^\d{1,2}-[A-Za-z]/.test(raw[i+1])){
      out.push(tok+','+raw[i+1]); i+=2; continue;
    }
    out.push(tok); i+=1;
  }
  return out;
}
function _fscStripAnnotation(token){
  // Strip a trailing/embedded concentration annotation so a real ingredient
  // like "Oryza Sativa (Rice) Bran Water(71 %)" or "...Leaf Water(94,000ppm)"
  // still matches its plain-name card, instead of the whole token failing
  // to match just because a percentage or ppm figure got glued onto it.
  return (token||'')
    // Strip a leading FDA drug-facts label glued directly onto the first
    // ingredient of that section (no separating comma), e.g. "ACTIVE
    // INGREDIENTS: HOMOSALATE (8%)" -> "HOMOSALATE (8%)", or "Active
    // Ingredient(s) & Concentration: Octinoxate 7.5%" -> "Octinoxate 7.5%".
    .replace(/^\s*(active|inactive)\s+ingredient(s|\(s\))?\s*(&\s*concentration)?\s*:\s*/i, '')
    .replace(/^\s*ingredients?\s*:\s*/i, '')   // plain "Ingredients: Cyclopentasiloxane" -> "Cyclopentasiloxane"
    .replace(/\(\s*[\d,.]+\s*(%|ppm|ppb)?\s*\)/gi, '')   // "(71 %)" / "(94,000ppm)" / "(3,000ppb)"
    .replace(/\(\s*[\d,.]+\s*(%|ppm|ppb)?\s*$/gi, '')     // truncated trailing "(94" (data cut off, no closing paren)
    .replace(/\s*\*?\s*[\d,.]+\s*(ppm|ppb)\b/gi, '')      // bare "94,000ppm" / "3,000ppb" with no parens
    .replace(/\s*\*?\s*[\d,.]+\s*%/gi, '')                // bare "46.5%" / "2.7%" — no \b here, "%" itself is never a word char so \b can't match right after it
    .trim();
}
function _fscHasWaterWord(token){
  // Word-boundary check for Water/Aqua/Eau as a STANDALONE word — replace
  // anything that isn't a letter with a space first, so "Water(71%)"
  // normalizes to "Water   71  " (still matches \bWATER\b) while
  // "Watermelon" stays one glued word and correctly does NOT match.
  // Capped at 6 words: real noise-prefixed water tokens in this catalog
  // ("Inactive Ingredients: Water", "Zero Pore Pads Water", a stray batch
  // code glued to "Aqua/Water") are all 3-5 words. A handful of products
  // have NO separator at all in their raw ingredient string (e.g. "Aqua
  // Glycerin Hydroxyethyl Urea Butylene Glycol Niacinamide..."), so their
  // ENTIRE 15-20+ word ingredient list arrives as one token that happens to
  // start with "Aqua" — without this cap, that whole token would wrongly
  // match as plain inert water and hide every other real ingredient in it
  // behind a falsely "perfect" score instead of correctly staying unmatched.
  const words = (token||'').replace(/[^A-Za-z]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if(words.length > 6) return false;
  return /\b(WATER|AQUA|EAU)\b/i.test(words.join(' '));
}
function _fscMatch(token){
  if(typeof INGREDIENT_SCORES==='undefined') return null;
  const nk=_fscNormalize(token);
  if(INGREDIENT_SCORES[nk]) return INGREDIENT_SCORES[nk];
  const ak=_fscAlnumKey(token);
  if(typeof INGREDIENT_SCORES_ALNUM!=='undefined' && INGREDIENT_SCORES_ALNUM[ak]) return INGREDIENT_SCORES_ALNUM[ak];
  // Retry after stripping a concentration annotation — catches botanical
  // waters/extracts and this catalog's ppm-labeled Korean-brand INCI lists
  // that would otherwise silently fail to match at all.
  const stripped = _fscStripAnnotation(token);
  if(stripped && stripped !== token){
    const nk2=_fscNormalize(stripped);
    if(INGREDIENT_SCORES[nk2]) return INGREDIENT_SCORES[nk2];
    const ak2=_fscAlnumKey(stripped);
    if(typeof INGREDIENT_SCORES_ALNUM!=='undefined' && INGREDIENT_SCORES_ALNUM[ak2]) return INGREDIENT_SCORES_ALNUM[ak2];
  }
  // Water/Aqua/Eau catch-all — this single ingredient appears in more
  // naming variants than any other (combined "Water/Aqua/Eau", parenthetical
  // "Aqua (Water)", and occasional scrape noise like "Inactive Ingredients:
  // Water" or a batch code glued to the front of the list). It's always
  // inert per its own DB record (a:0,i:0,b:0), so it's safe to match it
  // generously via a word-boundary check rather than silently drop the #1
  // most common skincare ingredient from a product's score.
  if(typeof INGREDIENT_SCORES!=='undefined' && INGREDIENT_SCORES['WATER'] && _fscHasWaterWord(token)) return INGREDIENT_SCORES['WATER'];
  return null;
}
function scoreProductSafety(p){
  if(!p || !p.ingredients) return null;
  const tokens=_fscTokenize(p.ingredients);
  const matched=[], unmatched=[], seen=new Set();
  tokens.forEach(tok=>{
    const rec=_fscMatch(tok);
    const nk=_fscNormalize(tok);
    if(rec){
      if(seen.has(nk)) return;
      seen.add(nk);
      matched.push({name:tok, a:rec.a, i:rec.i, b:rec.b});
    } else {
      unmatched.push(tok);
    }
  });
  if(!matched.length) return null; // fully degrade — no card shown at all
  function wavg(dim){
    let num=0, den=0;
    matched.forEach(m=>{ const s=m[dim]; const w=s>=8?2:1; num+=s*w; den+=w; });
    return den?num/den:0;
  }
  function ringPct(avg){ return Math.max(0, Math.min(100, Math.round(100 - avg*10))); }
  const rings={ G: ringPct(wavg('i')), A: ringPct(wavg('a')), B: ringPct(wavg('b')) };
  // Keep original INCI list order (concentration order — highest first, per
  // the real ingredient list on the product), NOT sorted by score.
  return { rings, matched, unmatched };
}

/* Skin Suitability — SINGLE source of truth, grounded in the same real
   ingredient-database scoring as the Formula Score rings (scoreProductSafety).
   Reuses _fscQualText's own qualitative cutoffs (Gentle=82, Low risk=78,
   Barrier-friendly=77) so a "suitable for X" claim always agrees with what
   the Formula Score card itself already says — no second, independent
   heuristic that could disagree with it. If a product has zero scored
   ingredients (fsc===null), no sensitive/acne/barrier claim is made at all
   (graceful degrade, matches Formula Score's own behavior) — anti-aging
   support is the one dimension not covered by the ingredient database, so
   it stays keyed to the product's actual formulated actives list.
   (2026-07-15, replaces two separate bestFor-text/heuristic checks —
   openProductModal's isSensitiveSafe/isAcneSafe/isMatureSupport and
   renderLibrary's old prodSuitability() — that could disagree with the
   real ingredient data and with each other.) */
function prodDbSuitability(p, fsc){
  fsc = fsc !== undefined ? fsc : scoreProductSafety(p);
  const actives = p.activeIngredients||[];
  return {
    sensitiveSafe: !!fsc && fsc.rings.G>=82,
    acneSafe: !!fsc && fsc.rings.A>=78,
    barrierSafe: !!fsc && fsc.rings.B>=77,
    agingSupport: actives.some(a=>['retinol','peptides','pdrn'].includes(a)),
    /* Product-Library suitability chip additions (2026-07-19). Named
       distinctly from acneSafe (FSC A-ring gentleness gate — used by the
       product modal's "Skin Suitability" section) because these answer a
       different question: "does this contain an active that treats the
       concern" vs "is this safe to use if you have the concern". acneSafe
       is saturated (246/246 pass) so it can't differentiate the library
       list — acneActiveSupport is gated on the same safety ring PLUS a
       real anti-acne active, so it's both correct and meaningful. Oily is
       intentionally excluded — no texture/comedogenicity data exists yet
       to ground it (see memory: glowphase-oily-suitability-gap). */
    acneActiveSupport: !!fsc && fsc.rings.A>=78 && actives.some(a=>['bha','azelaic acid','niacinamide'].includes(a)),
    brighteningSupport: actives.some(a=>['vitamin c','niacinamide','arbutin','tranexamic acid','azelaic acid'].includes(a)),
    drySupport: actives.some(a=>['hyaluronic acid','ceramides','panthenol','centella'].includes(a)),
    rednessSupport: !!fsc && fsc.rings.G>=82 && actives.some(a=>['centella','azelaic acid'].includes(a))
  };
}

function _fscQualColor(s){ return s>=78?'#2B8C74':s>=55?'#5B7090':'#9A6020'; }
function _fscQualText(dim,s){
  if(dim==='G') return s>=82?'Gentle':s>=62?'Moderate':'Stronger formula';
  if(dim==='A') return s>=78?'Low risk':s>=56?'Generally safe':'Higher risk';
  return s>=77?'Barrier-friendly':s>=55?'Neutral':'Use with care';
}
function _fscBadgeTier(v){ return v<=3?'b-low':v<=6?'b-mid':'b-high'; }
const _FSC_R=34,_FSC_CX=42,_FSC_CY=42,_FSC_SW=7,_FSC_CIRC=213.63;
const _FSC_GRAD={ G:{id:'fscg-g',c1:'#C7B4FF',c2:'#9ED7EC'}, A:{id:'fscg-a',c1:'#C7B4FF',c2:'#AEEFFF'}, B:{id:'fscg-b',c1:'#C7B4FF',c2:'#DDF4FF'} };
function _fscBuildRing(dim,score){
  const g=_FSC_GRAD[dim];
  const off=(_FSC_CIRC*(1-score/100)).toFixed(2);
  const qc=_fscQualColor(score), qt=_fscQualText(dim,score);
  const lbl={G:'Gentle',A:'Acne-safe',B:'Barrier'}[dim];
  return `
    <div class="fsc-ring-wrap">
      <svg class="fsc-ring-svg" width="88" height="88" viewBox="0 0 84 84">
        <defs>
          <linearGradient id="${g.id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${g.c1}"/>
            <stop offset="100%" stop-color="${g.c2}"/>
          </linearGradient>
        </defs>
        <circle cx="${_FSC_CX}" cy="${_FSC_CY}" r="${_FSC_R}" fill="none" stroke="rgba(186,210,228,.26)" stroke-width="${_FSC_SW}"/>
        <circle cx="${_FSC_CX}" cy="${_FSC_CY}" r="${_FSC_R}" fill="none" stroke="url(#${g.id})" stroke-width="${_FSC_SW}"
          stroke-linecap="round" stroke-dasharray="${_FSC_CIRC}" stroke-dashoffset="${off}"
          transform="rotate(-90 ${_FSC_CX} ${_FSC_CY})"/>
        <text x="${_FSC_CX}" y="${_FSC_CY+8}" text-anchor="middle" font-family="DM Sans, sans-serif"
          font-size="20" font-weight="700" letter-spacing="-0.5" fill="#243142">${score}</text>
      </svg>
      <div class="fsc-label">${lbl}</div>
      <div class="fsc-qual" style="color:${qc}">${qt}</div>
    </div>`;
}
function _fscBuildTable(fsc){
  const rows=fsc.matched.map(ing=>`
    <div class="fsc-row">
      <div class="fsc-ing-name">${ing.name}</div>
      <div class="fsc-badge ${_fscBadgeTier(ing.a)}">${ing.a}</div>
      <div class="fsc-badge ${_fscBadgeTier(ing.i)}">${ing.i}</div>
      <div class="fsc-badge ${_fscBadgeTier(ing.b)}">${ing.b}</div>
    </div>`).join('');
  const unmatchedRows=(fsc.unmatched||[]).map(name=>`
    <div class="fsc-row unmatched">
      <div class="fsc-ing-name">${name}</div>
      <div class="fsc-notscored">${t('fsc_not_scored')||'Not yet scored'}</div>
    </div>`).join('');
  return `<div class="fsc-thead">
      <div class="fsc-th">${t('fsc_th_ingredient')||'Ingredient'}</div>
      <div class="fsc-th">${t('fsc_th_acne')||'Acne'}</div>
      <div class="fsc-th">${t('fsc_th_irr')||'Irr.'}</div>
      <div class="fsc-th">${t('fsc_th_barrier')||'Barr.'}</div>
    </div>${rows}${unmatchedRows}`;
}
// Hero-embedded rings block — sits beside the product image, inline with
// the rest of the hero (no separate card background — it's visually part
// of modal-hero, not a floating box).
function fscBuildHeroBlock(fsc){
  if(!fsc) return '';
  // Info explainer (2026-07-19): click-triggered "i" button + collapsible
  // panel, not a hover tooltip -- this is a mobile-first app and hover has
  // no touch equivalent, and it would've been the only hover-driven pattern
  // on the site. Mirrors the existing fsc-toggle/info-box glass-panel
  // language used by the ingredient-breakdown section below, but uses its
  // own toggle fn (fscInfoToggle) rather than fscToggle because that one
  // requires the button and panel to be true DOM siblings, and here the
  // rings sit between them. Copy is grounded directly in scoreProductSafety's
  // real formula (wavg/ringPct) and _fscQualColor's exact 78/55 cutoffs --
  // not invented. Approved via live preview, iterated 3x on Bow's feedback:
  // (1) too card-heavy/redundant with the ring labels, (2) mixed warm/cool
  // ink, (3) formula math too prominent for the app's beginner-friendly tone.
  return `<div class="fsc-hero-block">
    <div class="fsc-hdr"><span class="fsc-spark">✦</span><span class="fsc-title">${t('fsc_title')||'Formula Score'}</span><button type="button" class="fsc-info-btn" aria-label="${t('fsc_info_label')||'What do these scores mean?'}" onclick="fscInfoToggle(this)">i</button></div>
    <div class="fsc-rings">${_fscBuildRing('G',fsc.rings.G)}${_fscBuildRing('A',fsc.rings.A)}${_fscBuildRing('B',fsc.rings.B)}</div>
    <div class="fsc-info-panel">
      <div class="fsc-info-inner">
        <p class="fsc-info-lead">${t('fsc_info_lead')||'Each ring reflects how <b>gentle</b>, <b>breakout-safe</b>, and <b>barrier-friendly</b> this formula\'s ingredients are &mdash; the higher the %, the better the match.'}</p>
        <div class="fsc-info-legend">
          <span><i class="fsc-info-dot" style="background:#2B8C74"></i>${t('fsc_legend_ideal')||'&ge; 78 Ideal'}</span>
          <span><i class="fsc-info-dot" style="background:#5B7090"></i>${t('fsc_legend_moderate')||'55&ndash;77 Moderate'}</span>
          <span><i class="fsc-info-dot" style="background:#9A6020"></i>${t('fsc_legend_caution')||'&lt; 55 Caution'}</span>
        </div>
        <p class="fsc-info-trust">${t('fsc_info_trust')||'Ingredients we haven\'t scored yet are marked <b>"Not yet scored"</b> and left out of the average &mdash; never guessed.'}</p>
        <p class="fsc-info-formula">${t('fsc_info_formula')||'Calculated from our own ingredient database (not CosDNA): weighted-average risk per ingredient (0&ndash;10, higher-risk ingredients count double), converted to a 0&ndash;100 score.'}</p>
      </div>
    </div>
  </div>`;
}
function fscInfoToggle(btn){
  const block=btn.closest('.fsc-hero-block');
  const panel=block&&block.querySelector('.fsc-info-panel');
  if(!panel) return;
  panel.classList.toggle('open');
}
// Ingredient breakdown table — placed further down the modal, right after
// the Full INCI Ingredient List section. Rows follow scoreProductSafety's
// matched order, which is the original INCI list order (highest
// concentration first, trace ingredients last).
function fscBuildBreakdownBlock(fsc){
  if(!fsc) return '';
  const count=fsc.matched.length+(fsc.unmatched||[]).length;
  const label=(t('fsc_show_breakdown')||'Show ingredient breakdown')+` (${count})`;
  return `<div class="modal-sec">
    <div class="modal-sec-title">${t('fsc_breakdown_title')||'Ingredient Breakdown'}</div>
    <button class="fsc-toggle" onclick="fscToggle(this)"><span class="fsc-toggle-label">${label}</span><span class="fsc-chevron">▾</span></button>
    <div class="fsc-table-wrap"><div class="fsc-table">${_fscBuildTable(fsc)}</div></div>
    <p class="fsc-foot">${t('fsc_foot')||'Glowphase assessment · Based on ingredient research data'}</p>
  </div>`;
}
function fscToggle(btn){
  const wrap=btn.nextElementSibling;
  if(!wrap) return;
  const open=wrap.classList.toggle('open');
  btn.classList.toggle('open',open);
  const labelEl=btn.querySelector('.fsc-toggle-label');
  if(labelEl){
    const m=labelEl.textContent.match(/\((\d+)\)/);
    const count=m?m[1]:'';
    labelEl.textContent=(open?(t('fsc_hide_breakdown')||'Hide ingredient breakdown'):(t('fsc_show_breakdown')||'Show ingredient breakdown'))+(count?` (${count})`:'');
  }
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

  // Skin Suitability — TWO distinct, separately-labeled signals (Bow's
  // call, 2026-07-15: keep both, don't merge into one):
  // (1) "According to the brand" — the brand's own bestFor marketing text,
  //     unverified by us, shown as-is.
  // (2) "Glowphase verified" — our own read, grounded in the real
  //     ingredient database (same source as the Formula Score rings —
  //     see prodDbSuitability). These can legitimately disagree with the
  //     brand's claim; showing both lets the user see where they align
  //     or diverge instead of presenting one blended, unsourced answer.
  const bestForLower = (p.bestFor||'').toLowerCase();
  const brandSensitive = /sensitive|reactive/.test(bestForLower) && !/not.*sensitive|NOT.*sensitive/i.test(p.bestFor||'');
  const brandAcne = /acne|breakout/.test(bestForLower) && !/not.*acne/i.test(p.bestFor||'');
  const brandAging = /mature|aging|fine line|wrinkle|firm|elasticity/.test(bestForLower);

  const fsc = scoreProductSafety(p);
  const suit = prodDbSuitability(p, fsc);

  // Build warnings from formula
  const warnings = [];
  if(!p.fragranceFree) warnings.push(t('warn_fragrance'));
  if(!p.alcoholFree) warnings.push(t('warn_alcohol'));
  if(!p.eoFree) warnings.push(t('warn_eo'));

  // doNotCombine: split string into chips if comma-separated, else show as text
  const doNotChips = doNotCombine && doNotCombine.length > 5
    ? doNotCombine.split(/[,;]|\.(?=\s)/).map(s=>s.trim()).filter(s=>s&&s.length>2&&s.toLowerCase()!=='n/a').slice(0,6)
    : [];

  const _added = _modalIsAdded(p.id);
  const _descSplit = description ? _modalLeadSplit(description) : null;

  const modalHTML = `
    <div class="modal-hero">
      <button class="modal-close" onclick="closeModal()" aria-label="Close">✕</button>
      <div class="modal-hero-title">
        <div class="modal-brand-sm"><span class="modal-brand-star">✦</span>${p.brand||''}</div>
        <div class="modal-name-row">
          <div class="modal-name-lg">${p.name||''}</div>
          <div class="modal-tag-row">
            <span class="modal-tag cat">${displayCategory(p)}</span>
            ${p.fragranceFree?`<span class="modal-tag ff">${t('modal_tag_ff')}</span>`:`<span class="modal-tag noff">${t('modal_tag_hf')}</span>`}
            ${p.alcoholFree?`<span class="modal-tag ff">${t('modal_tag_af')}</span>`:`<span class="modal-tag noff">${t('modal_tag_ha')}</span>`}
            ${p.eoFree?`<span class="modal-tag ff">${t('modal_tag_eof')}</span>`:`<span class="modal-tag noff">${t('modal_tag_heo')}</span>`}
          </div>
        </div>
      </div>
      <div class="modal-hero-cols">
        <div class="modal-emoji">${prodEmoji(p)}</div>
        ${fscBuildHeroBlock(fsc)}
      </div>
    </div>
    <div class="modal-body">
      <div class="modal-cta-row">
        <button class="modal-cta-btn${_added?' added':''}" id="modal-cta-btn" onclick="modalAddToRoutine(${p.id},this)"${_added?' disabled':''}>
          <span class="modal-cta-icon">${_added?'✓':'✦'}</span>${_added?t('modal_added'):t('modal_add_routine')}${_added?'':'<span class="modal-cta-arrow">→</span>'}
        </button>
      </div>
      ${description?`<div class="modal-sec"><div class="modal-sec-title">${t('modal_what_it_does')}</div><div class="modal-text"><span class="modal-text-lead">${_descSplit.lead}</span>${_descSplit.rest?' '+_descSplit.rest:''}</div></div>`:''}

      ${actives.length?`<div class="modal-sec"><div class="modal-sec-title">${t('modal_key_actives')}</div><div class="modal-active-row">${actives.map(a=>`<span class="modal-active-chip">${a}</span>`).join('')}</div></div>`:''}
      
      ${concerns.length?`<div class="modal-sec"><div class="modal-sec-title">${t('modal_skin_concerns')}</div><div class="modal-concern-row">${concerns.map(c=>`<span class="modal-concern-chip">${c}</span>`).join('')}</div></div>`:''}
      
      ${(brandSensitive||brandAcne||brandAging||suit.sensitiveSafe||suit.acneSafe||suit.agingSupport)?`<div class="modal-sec">
        <div class="modal-sec-title">${t('modal_skin_suit')}</div>
        ${(brandSensitive||brandAcne||brandAging)?`<div style="margin-top:8px">
          <div style="font:700 0.6rem 'DM Sans',sans-serif;letter-spacing:0.3px;text-transform:uppercase;color:var(--m-ink-3);margin-bottom:4px">${t('modal_suit_brand_label')}</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:0.72rem;color:var(--ink2)">
            ${brandSensitive?`<div>${t('modal_suit_sensitive_brand')}</div>`:''}
            ${brandAcne?`<div>${t('modal_suit_acne_brand')}</div>`:''}
            ${brandAging?`<div>${t('modal_suit_aging_brand')}</div>`:''}
          </div>
        </div>`:''}
        ${(suit.sensitiveSafe||suit.acneSafe||suit.agingSupport)?`<div style="margin-top:${(brandSensitive||brandAcne||brandAging)?'14px':'8px'}">
          <div style="font:700 0.6rem 'DM Sans',sans-serif;letter-spacing:0.3px;text-transform:uppercase;color:var(--m-ink-3);margin-bottom:4px">${t('modal_suit_verified_label')}</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:0.72rem;color:var(--ink2)">
            ${suit.sensitiveSafe?`<div>${t('modal_suit_sensitive')}</div>`:''}
            ${suit.acneSafe?`<div>${t('modal_suit_acne')}</div>`:''}
            ${suit.agingSupport?`<div>${t('modal_suit_aging')}</div>`:''}
          </div>
        </div>`:''}
      </div>`:''}
      
      ${warnings.length?`<div class="modal-sec"><div class="modal-sec-title">${t('modal_ing_warnings')}</div><div class="info-box amber">${warnings.join('<br>')}</div></div>`:''}
      
      <div class="modal-sec">
        <div class="modal-sec-title">${t('modal_how_to_use')}</div>
        <div class="info-box lilac">
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
          <div class="info-box green"><strong>${t('modal_rec_mode')}</strong> ${p.medicubeMode}</div>
          ${p.medicubeMode==='Booster'?`<div class="info-box amber">${t('modal_booster_note')}</div>`:''}
          ${p.medicubeMode==='MC'?`<div class="info-box amber">${t('modal_mc_note')}</div>`:''}
          ${p.medicubeMode==='Derma Shot'?`<div class="info-box amber">${t('modal_derma_note')}</div>`:''}
        </div>` : `
        <div class="modal-sec">
          <div class="modal-sec-title">${t('modal_medicube_title')}</div>
          <div class="info-box amber">${t('modal_no_device')}</div>
        </div>`
      }
      
      <div class="modal-sec">
        <div class="modal-sec-title">${t('modal_inci_title')}</div>
        <div class="full-ing">${_modalInciList(p)}</div>
      </div>

      ${fscBuildBreakdownBlock(fsc)}

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

// Full INCI list: truncate to the top N tokens (INCI order = concentration
// order, so the first ones are the most significant) with a "+N more"
// expander, and bold any token that matches one of this product's own
// Key Active Ingredients (p.activeIngredients, cross-referenced via
// ACTIVE_LABELS — same source of truth prodActiveTags() uses, so this
// never invents a match the product data doesn't actually support).
function _modalInciMark(tok, activeStems){
  const low = tok.toLowerCase();
  return activeStems.some(k=>k && low.includes(k)) ? `<span class="modal-inci-active">${tok}</span>` : tok;
}
function _modalInciList(p){
  if(!p.ingredients) return `<em style="color:var(--ink2)">${t('modal_inci_missing')}</em>`;
  const tokens = p.ingredients.split(',').map(s=>s.trim()).filter(Boolean);
  const activeStems = (p.activeIngredients||[]).map(a=>{
    const k = String(a).toLowerCase();
    return (k.endsWith('s') && k.length>4) ? k.slice(0,-1) : k;
  });
  const LIMIT = 10;
  if(tokens.length<=LIMIT) return tokens.map(tok=>_modalInciMark(tok,activeStems)).join(', ');
  const head = tokens.slice(0,LIMIT).map(tok=>_modalInciMark(tok,activeStems)).join(', ');
  const tail = tokens.slice(LIMIT).map(tok=>_modalInciMark(tok,activeStems)).join(', ');
  const restCount = tokens.length-LIMIT;
  const moreLabel = `+${restCount} ${t('modal_inci_more')||'more ingredients'}`;
  return `${head}<span class="modal-inci-tail">, ${tail}</span><button type="button" class="modal-inci-more" data-more-label="${moreLabel}" onclick="_inciToggle(this)">${moreLabel} ▾</button>`;
}
function _inciToggle(btn){
  const tail = btn.previousElementSibling;
  if(!tail || !tail.classList.contains('modal-inci-tail')) return;
  const open = tail.classList.toggle('open');
  btn.textContent = open ? `${t('modal_inci_less')||'Show less'} ▴` : `${btn.dataset.moreLabel} ▾`;
}
function closeModal(){const m=document.getElementById('product-modal');if(m)m.classList.remove('open');}
function closeModalOutside(e){if(e.target.id==='product-modal')closeModal();}

/* ═══ PRODUCT MODAL — CTA + two-tone description lead (2026-07-15) ═══ */
// Mirrors addRecommendedProduct's own context branching so the modal's CTA
// button can show an accurate "already added" state on open.
function _modalIsAdded(pid){
  const myPage=document.getElementById('page-myroutine');
  const onMyRoutine=myPage&&myPage.classList.contains('active');
  if(onMyRoutine&&myRoutineState.selectedId){
    const routines=getSavedRoutines();
    const r=routines.find(x=>x.id===myRoutineState.selectedId);
    return !!(r&&r.selectedIds&&r.selectedIds.includes(pid));
  }
  return builderState.selectedIds.includes(pid);
}
function modalAddToRoutine(pid,btn){
  if(!btn||btn.classList.contains('added'))return;
  addRecommendedProduct(pid);
  btn.classList.add('added');
  btn.disabled=true;
  btn.innerHTML=`<span class="modal-cta-icon">✓</span>${t('modal_added')}`;
  _gpToast(t('modal_added'),'success');
}
// Splits a description into a bold "lead" word and a lighter "rest" — the
// two-tone weight trick borrowed from the reference Treatment Plan modal's
// step headings ("**Clear** breakouts & congestion"), which bolds one key
// word rather than a whole clause. Deliberately just the first word (not a
// full sentence, which for real product copy often runs 150-250+ chars and
// would swallow the entire paragraph in bold).
function _modalLeadSplit(desc){
  if(!desc) return {lead:'',rest:''};
  const trimmed=desc.trim();
  const words=trimmed.split(/\s+/);
  if(!words.length) return {lead:trimmed,rest:''};
  // Bold just the first word ("Rich barrier-repair...") unless it's too
  // short to read as an intentional lede on its own ("A ceramide-enriched..."
  // bolding only "A" looked like a stray typo) — keep pulling in words
  // until the bolded run has at least 4 letters/digits, so short articles
  // like "A"/"An" fold into the next word instead of standing alone.
  let lead='', i=0;
  while(i<words.length){
    lead = lead ? lead+' '+words[i] : words[i];
    i++;
    if(lead.replace(/[^a-zA-Z0-9]/g,'').length>=4) break;
  }
  return {lead, rest:words.slice(i).join(' ')};
}

/* ═══ SKIN READINESS GATE ═══ */
const _sgState={answers:{q1:null,q2:null,q3:null},targetPid:null,targetBtn:null};

function _sgScore(){
  const map={q1:{a:0,b:1,c:2},q2:{a:0,b:1,c:2},q3:{a:0,b:1,c:2}};
  return ['q1','q2','q3'].reduce((s,q)=>s+(map[q][_sgState.answers[q]]??0),0);
}

function openSkinGate(pid,btn){
  _sgState.answers={q1:null,q2:null,q3:null};
  _sgState.targetPid=pid;
  _sgState.targetBtn=btn;
  _renderSkinGateQuestions();
  document.getElementById('skin-gate-modal').classList.add('open');
}

function closeSkinGate(){
  document.getElementById('skin-gate-modal').classList.remove('open');
}

function _renderSkinGateQuestions(){
  const pid=_sgState.targetPid;
  const badge=pid==='p2'?t('sg_badge_p2'):pid==='p3'?t('sg_badge_p3'):t('sg_badge_p4');
  const allAnswered=_sgState.answers.q1&&_sgState.answers.q2&&_sgState.answers.q3;

  function optRow(q,key,label){
    const sel=_sgState.answers[q]===key?'selected':'';
    return `<div class="sg-option ${sel}" onclick="sgSelectAnswer('${q}','${key}')">
      <div class="sg-option-dot"></div>${label}</div>`;
  }

  document.getElementById('skin-gate-box').innerHTML=`
    <div class="sg-header">
      <div class="sg-phase-badge">🌸 ${badge}</div>
      <div class="sg-title">${t('sg_title')}</div>
      <div class="sg-subtitle">${t('sg_subtitle')}</div>
    </div>
    <div class="sg-body">
      <div class="sg-question">
        <div class="sg-q-label"><span class="sg-q-num">1</span>${t('sg_q1_label')}</div>
        <div class="sg-options">
          ${optRow('q1','a',t('sg_q1_a'))}
          ${optRow('q1','b',t('sg_q1_b'))}
          ${optRow('q1','c',t('sg_q1_c'))}
        </div>
      </div>
      <div class="sg-divider"></div>
      <div class="sg-question">
        <div class="sg-q-label"><span class="sg-q-num">2</span>${t('sg_q2_label')}</div>
        <div class="sg-options">
          ${optRow('q2','a',t('sg_q2_a'))}
          ${optRow('q2','b',t('sg_q2_b'))}
          ${optRow('q2','c',t('sg_q2_c'))}
        </div>
      </div>
      <div class="sg-divider"></div>
      <div class="sg-question">
        <div class="sg-q-label"><span class="sg-q-num">3</span>${t('sg_q3_label')}</div>
        <div class="sg-options">
          ${optRow('q3','a',t('sg_q3_a'))}
          ${optRow('q3','b',t('sg_q3_b'))}
          ${optRow('q3','c',t('sg_q3_c'))}
        </div>
      </div>
    </div>
    <div class="sg-footer">
      <button class="sg-btn-check" id="sg-check-btn" onclick="sgSubmit()" ${allAnswered?'':'disabled'}>${t('sg_btn_check')}</button>
      <button class="sg-btn-skip" onclick="sgProceed()">${t('sg_btn_skip')}</button>
    </div>`;
}

function sgSelectAnswer(q,key){
  _sgState.answers[q]=key;
  const box=document.getElementById('skin-gate-box');
  const scrollTop=box?box.scrollTop:0;
  _renderSkinGateQuestions();
  if(box)box.scrollTop=scrollTop;
}

function sgSubmit(){
  const score=_sgScore();
  let icon,title,msg,tips,buttons;

  if(score<=2){
    // READY
    document.getElementById('skin-gate-box').innerHTML=`
      <div class="sg-result">
        <div class="sg-result-icon">${t('sg_ready_icon')}</div>
        <div class="sg-result-title">${t('sg_ready_title')}</div>
        <div class="sg-result-msg">${t('sg_ready_msg')}</div>
        <button class="sg-btn-proceed" onclick="sgProceed()">${t('sg_ready_btn')}</button>
      </div>`;
  } else if(score<=4){
    // CAUTION — allow but warn
    document.getElementById('skin-gate-box').innerHTML=`
      <div class="sg-result">
        <div class="sg-result-icon">${t('sg_caution_icon')}</div>
        <div class="sg-result-title">${t('sg_caution_title')}</div>
        <div class="sg-result-msg">${t('sg_caution_msg')}</div>
        <div class="sg-result-tips">
          <div class="sg-result-tip"><div class="sg-result-tip-dot"></div>${t('sg_caution_tip1')}</div>
          <div class="sg-result-tip"><div class="sg-result-tip-dot"></div>${t('sg_caution_tip2')}</div>
          <div class="sg-result-tip"><div class="sg-result-tip-dot"></div>${t('sg_caution_tip3')}</div>
        </div>
        <button class="sg-btn-stay" onclick="closeSkinGate()">${t('sg_caution_btn_stay')}</button>
        <button class="sg-btn-anyway" onclick="sgProceed()">${t('sg_caution_btn_anyway')}</button>
      </div>`;
  } else {
    // NOT READY — recommend staying, but still allow
    document.getElementById('skin-gate-box').innerHTML=`
      <div class="sg-result">
        <div class="sg-result-icon">${t('sg_notready_icon')}</div>
        <div class="sg-result-title">${t('sg_notready_title')}</div>
        <div class="sg-result-msg">${t('sg_notready_msg')}</div>
        <div class="sg-result-tips">
          <div class="sg-result-tip"><div class="sg-result-tip-dot"></div>${t('sg_notready_tip1')}</div>
          <div class="sg-result-tip"><div class="sg-result-tip-dot"></div>${t('sg_notready_tip2')}</div>
          <div class="sg-result-tip"><div class="sg-result-tip-dot"></div>${t('sg_notready_tip3')}</div>
        </div>
        <button class="sg-btn-stay" onclick="closeSkinGate()">${t('sg_notready_btn')}</button>
        <button class="sg-btn-anyway" onclick="sgProceed()">${t('sg_notready_btn_anyway')}</button>
      </div>`;
  }
}

function sgProceed(){
  closeSkinGate();
  const pid=_sgState.targetPid;
  const btn=_sgState.targetBtn;
  if(!pid||!btn){return;}

  // Detect forward progression for graduation moment
  const card=btn.closest('.builder-card');
  const phasePanel=card?card.querySelector('.phase-panel'):null;
  const fromPid=phasePanel?phasePanel.dataset.pid:null;
  const _phaseOrder={p1:1,p2:2,p3:3,p4:4};
  const isForward=fromPid&&(_phaseOrder[pid]||0)>(_phaseOrder[fromPid]||0);
  const isRecoveryReturn=!!(_sbState.cardId&&_sbState.originalPid===pid);

  if(isForward||isRecoveryReturn){
    // Show graduation moment — switches phase after user dismisses
    showGraduation(fromPid,pid,isRecoveryReturn,function(){
      _doSwitchRoutinePhase(pid,btn);
    });
  } else {
    _doSwitchRoutinePhase(pid,btn);
  }
}

/* ═══ PHASE GRADUATION ═══ */
function showGraduation(fromPid,toPid,isRecoveryReturn,onComplete){
  const el=document.getElementById('grad-overlay');
  if(!el)return onComplete&&onComplete();

  // Pick the right message
  let icon,title,msg;
  if(isRecoveryReturn){
    icon=t('grad_recovery_icon');title=t('grad_recovery_title');msg=t('grad_recovery_msg');
  } else {
    icon=t('grad_to_'+toPid+'_icon')||'✨';
    title=t('grad_to_'+toPid+'_title')||'';
    msg=t('grad_to_'+toPid+'_msg')||'';
  }

  el.innerHTML=`
    <div class="grad-card">
      <div class="grad-glow"></div>
      <div class="grad-icon">${icon}</div>
      <div class="grad-title">${title}</div>
      <div class="grad-msg">${msg}</div>
      <button class="grad-btn" id="grad-continue-btn">${t('grad_continue')}</button>
    </div>`;
  el.classList.add('open');

  function _close(){
    el.classList.remove('open');
    if(onComplete)onComplete();
  }

  // User must click Continue — no auto-dismiss, progression is a conscious act
  document.getElementById('grad-continue-btn').onclick=_close;
}

/* ═══ STEP BACK / RECOVERY MODE ═══ */
// Stores cardId of the phase panel currently in recovery mode
const _sbState={cardId:null,originalPid:null};

function openStepBackSheet(triggerEl){
  // Find the builder-card this button lives in
  const card=triggerEl?triggerEl.closest('.builder-card'):null;
  const cardId=card?card.dataset.cardId:null;
  if(!cardId)return;
  // Store context for later
  const phasePanel=card.querySelector('.phase-panel');
  const originalPid=phasePanel?phasePanel.dataset.pid:null;
  _sbState.cardId=cardId;
  _sbState.originalPid=originalPid;

  // Build bottom sheet
  const ex=document.getElementById('sb-sheet-overlay');
  if(ex)ex.remove();
  const ov=document.createElement('div');
  ov.id='sb-sheet-overlay';
  ov.className='sb-sheet-overlay';
  ov.innerHTML=`
    <div class="sb-sheet">
      <div class="sb-sheet-handle"></div>
      <div class="sb-sheet-head">
        <span class="sb-sheet-emoji">🌿</span>
        <div class="sb-sheet-title">${t('sb_sheet_title')}</div>
      </div>
      <div class="sb-sheet-msg">${t('sb_sheet_msg')}</div>
      <div class="sb-sheet-tips">
        <div class="sb-sheet-tip"><div class="sb-sheet-tip-dot"></div>${t('sb_tip1')}</div>
        <div class="sb-sheet-tip"><div class="sb-sheet-tip-dot"></div>${t('sb_tip2')}</div>
        <div class="sb-sheet-tip"><div class="sb-sheet-tip-dot"></div>${t('sb_tip3')}</div>
      </div>
      <div class="sb-sheet-actions">
        <button class="sb-sheet-confirm" onclick="activateRecoveryMode()">${t('sb_confirm')}</button>
        <button class="sb-sheet-cancel" onclick="closeStepBackSheet()">${t('sb_cancel')}</button>
      </div>
    </div>`;
  ov.addEventListener('click',function(e){if(e.target===ov)closeStepBackSheet();});
  document.body.appendChild(ov);
}

function closeStepBackSheet(){
  const el=document.getElementById('sb-sheet-overlay');
  if(el&&el.parentNode)el.parentNode.removeChild(el);
}

function activateRecoveryMode(){
  closeStepBackSheet();
  const cardId=_sbState.cardId;
  if(!cardId)return;
  const card=document.querySelector(`.builder-card[data-card-id="${cardId}"]`);
  if(!card)return;
  const data=window._glowPhaseData&&window._glowPhaseData[cardId];
  if(!data)return;

  // Render p1 (barrier/recovery plan, zero actives) into active-phase-area
  const phaseArea=card.querySelector('.active-phase-area');
  if(!phaseArea)return;
  phaseArea.innerHTML=renderPhase(
    'p1',data.selected,data.c1,data.c2,
    data.toner,data.essence,data.nightSerum,data.moist,
    data.deviceGel,data.usesDevice,
    false,false,false,false,
    data.isMature,data.isHighSens,'active',false,
    data.eye,data.sleepingPack,data._answersWithDayProducts,data.mistProd,'Mon'
  );
  setTimeout(enhanceRoutineSteps,0);

  // Deactivate all night phase tabs — content no longer matches any single tab
  card.querySelectorAll('.phase-nav:not(.morning-phase-nav) .phase-tab').forEach(b=>b.classList.remove('active'));

  // Inject recovery banner directly UNDER the phase hero (not above the whole panel)
  const banner=document.createElement('div');
  banner.id='sb-recovery-banner';
  banner.className='sb-recovery-banner';
  banner.innerHTML=`
    <div class="sb-recovery-icon">🌿</div>
    <div class="sb-recovery-content">
      <div class="sb-recovery-title">${t('sb_banner_title')}</div>
      <div class="sb-recovery-body">${t('sb_banner_body')}</div>
    </div>
    <button class="sb-recovery-return" onclick="exitRecoveryMode()">${t('sb_banner_return')}</button>`;
  const _heroBox=phaseArea.querySelector('.phase-hero-box');
  if(_heroBox&&_heroBox.parentNode){ _heroBox.parentNode.insertBefore(banner,_heroBox.nextSibling); }
  else { phaseArea.insertBefore(banner,phaseArea.firstChild); }
  // Auto-save recovery state — no user action needed
  _gpAutoSavePhaseState(cardId,_sbState.originalPid||'p3',true);
}

function exitRecoveryMode(){
  const cardId=_sbState.cardId;
  const originalPid=_sbState.originalPid||'p3';
  if(!cardId)return;
  const card=document.querySelector(`.builder-card[data-card-id="${cardId}"]`);
  if(!card)return;
  // Route through the Skin Readiness Gate — user must confirm skin is ready before returning.
  // _sbState is intentionally NOT cleared here: if the user dismisses the gate,
  // the banner stays visible and they can try returning again without being stuck.
  const tabBtn=card.querySelector(`.phase-nav .phase-tab[data-phase="${originalPid}"]`);
  if(tabBtn) switchRoutinePhase(originalPid,tabBtn);
}

/* ═══ SUGGESTED PHASE SHIFT ═══ */

// Analyzes the last 4 WSC check scores and returns a suggestion level:
//   'stepback'  → 2+ consecutive scores ≥ 6 (significant stress)
//   'caution'   → 2+ consecutive scores ≥ 4 (mild/moderate stress)
//   null        → no action needed
function _detectPhaseShiftNeeded(r){
  const hist=r.wscHistory;
  if(!hist||hist.length<2)return null;
  // Look at most recent 2 entries
  const last2=hist.slice(-2).map(function(h){return h.score;});
  if(last2[0]>=6&&last2[1]>=6) return 'stepback';
  if(last2[0]>=4&&last2[1]>=4) return 'caution';
  return null;
}

// Injects the phase shift suggestion card into the routine card on My Routine page.
function renderPhaseShiftSuggestion(){
  const myPage=document.getElementById('page-myroutine');
  if(!myPage||!myPage.classList.contains('active'))return;

  document.querySelectorAll('.builder-card[data-card-id]').forEach(function(card){
    const cardId=card.dataset.cardId;
    if(!cardId||cardId==='gc-draft')return;
    if(card.querySelector('.pss-card'))return; // already injected
    const routineId=cardId.replace('gc-','');
    const routines=getSavedRoutines();
    const r=routines.find(function(x){return x.id===routineId;});
    if(!r)return;
    if(r.pssIgnored)return; // user dismissed — don't show again until next WSC

    const level=_detectPhaseShiftNeeded(r);
    if(!level)return;

    const el=document.createElement('div');
    el.className='pss-card pss-'+level;

    if(level==='caution'){
      el.innerHTML=`
        <div class="pss-head">
          <span class="pss-icon">🌿</span>
          <div>
            <div class="pss-title">${t('pss_caution_title')}</div>
            <div class="pss-tip">${t('pss_caution_tip')}</div>
          </div>
        </div>
        <div class="pss-msg">${t('pss_caution_msg')}</div>
        <div class="pss-actions">
          <button class="pss-btn-main" onclick="dismissPhaseShift('${routineId}',this)">${t('pss_caution_btn')}</button>
          <button class="pss-btn-dismiss" onclick="dismissPhaseShift('${routineId}',this)">${t('pss_dismiss')}</button>
        </div>`;
    } else {
      el.innerHTML=`
        <div class="pss-head">
          <span class="pss-icon">🛡</span>
          <div>
            <div class="pss-title">${t('pss_stepback_title')}</div>
          </div>
        </div>
        <div class="pss-msg">${t('pss_stepback_msg')}</div>
        <div class="pss-actions">
          <button class="pss-btn-main" onclick="_pssActivateStepBack('${routineId}',this)">${t('pss_stepback_btn_yes')}</button>
          <button class="pss-btn-secondary" onclick="dismissPhaseShift('${routineId}',this)">${t('pss_stepback_btn_no')}</button>
        </div>`;
    }

    // Insert after journey strip / before builder-step-hd
    const hd=card.querySelector('.builder-step-hd');
    if(hd)card.insertBefore(el,hd);
    else card.prepend(el);
  });
}

function dismissPhaseShift(routineId,btn){
  // Mark as ignored so it won't reappear until next WSC clears it
  const routines=getSavedRoutines();
  const idx=routines.findIndex(function(x){return x.id===routineId;});
  if(idx!==-1){routines[idx].pssIgnored=true;setSavedRoutines(routines);}
  // Remove card from DOM
  const card=btn?btn.closest('.pss-card'):null;
  if(card)card.remove();
}

function _pssActivateStepBack(routineId,btn){
  dismissPhaseShift(routineId,btn);
  const cardId='gc-'+routineId;
  const card=document.querySelector('.builder-card[data-card-id="'+cardId+'"]');
  if(!card)return;
  const phasePanel=card.querySelector('.phase-panel');
  const currentPid=phasePanel?phasePanel.dataset.pid:'p3';
  _sbState.cardId=cardId;
  _sbState.originalPid=currentPid;
  activateRecoveryMode();
}

/* ═══ WEEKLY SKIN CHECK ═══ */
const _WSC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const _wscState = {routineId:null, answers:{q1:null,q2:null,q3:null,q4:null}};

function _wscLastKey(routineId){ return 'gp_wsc_last_'+routineId; }

function _wscIsDue(routineId){
  if(!routineId||routineId==='draft')return false;
  try{
    // Never show before 7 days from routine creation — even on first-ever check
    const routines=getSavedRoutines();
    const r=routines.find(function(x){return x.id===routineId;});
    if(!r)return false;
    const createdAt=r.createdAt?new Date(r.createdAt).getTime():null;
    if(createdAt&&(Date.now()-createdAt)<_WSC_INTERVAL_MS)return false;
    // After the first 7 days, check if another 7 days have passed since last check
    const last=localStorage.getItem(_wscLastKey(routineId));
    if(!last)return true; // past 7-day minimum, never checked — show now
    return (Date.now()-parseInt(last,10))>=_WSC_INTERVAL_MS;
  }catch(e){return false;}
}

function _wscMarkDone(routineId){
  try{localStorage.setItem(_wscLastKey(routineId),Date.now().toString());}catch(e){}
}
// Whole days until the next weekly check is due (0 = due now). Counts from last check, or routine creation.
function _wscDaysLeft(routineId){
  try{
    var r=getSavedRoutines().find(function(x){return x.id===routineId;}); if(!r)return 0;
    var last=localStorage.getItem(_wscLastKey(routineId));
    var base=last?parseInt(last,10):(r.createdAt?new Date(r.createdAt).getTime():Date.now());
    return Math.max(0,Math.ceil((base+_WSC_INTERVAL_MS-Date.now())/86400000));
  }catch(e){return 0;}
}

// Generates a 1-sentence explanation of why the user is in their current phase.
function _generatePhaseExplanation(r){
  if(!r)return '';
  const a=r.answers||{};
  const inRecovery=!!r.inRecoveryMode;
  const phase=r.activePhase||'p1';
  if(inRecovery) return t('why_recovery');
  if(phase==='p1'){
    if(a.barrierCondition===t('o_very_damaged'))      return t('why_p1_damaged');
    if(a.currentIrritation===t('o_irritation_yes'))   return t('why_p1_reacting');
    if(a.sensitivity===t('o_high'))                   return t('why_p1_sensitive');
    if((a.skinTypes||[]).includes(t('o_reactive')))   return t('why_p1_sensitive');
    return t('why_p1_default');
  }
  if(phase==='p2'){
    return r.startingPhase==='p2'?t('why_p2_skipped'):t('why_p2_progressed');
  }
  if(phase==='p3'){
    return a.activeExperience===t('o_exp_regular')&&r.startingPhase==='p3'?t('why_p3_experienced'):t('why_p3_progressed');
  }
  return t('why_p4_progressed');
}

/* ═══ PHASE SUB-STATE SYSTEM ═══ */
// NOTE: the canonical _getPhaseSubStateLevel / _getPhaseSubState / _getPhaseSubStateTip /
// _injectPhaseSubStateBadge live once, below renderJourneyStrip. A duplicate copy that used to
// sit here was dead (JS function-declaration hoisting made the lower copy win) and was removed.

// Renders the journey strip showing "Day X · Phase Y" at the top of each saved routine card.
// Shows "Recovery Mode" when the user is in recovery. Never shown for draft routines.
function renderJourneyStrip(){
  // Only inject into My Routine page cards — never the builder result
  const myPage=document.getElementById('page-myroutine');
  if(!myPage)return;
  document.querySelectorAll('#page-myroutine .builder-card[data-card-id]').forEach(function(card){
    const cardId=card.dataset.cardId;
    if(!cardId||cardId==='gc-draft')return;
    // Remove old strip so it re-renders fresh on every renderMyRoutines call
    const oldStrip=card.querySelector('.js-strip');if(oldStrip)oldStrip.remove();
    const routineId=cardId.replace('gc-','');
    const r=getSavedRoutines().find(function(x){return x.id===routineId;});
    if(!r)return;
    // Fall back to createdAt for routines saved before phaseStartedAt was introduced
    const _startDate=r.phaseStartedAt||r.createdAt;
    if(!_startDate)return;

    const inRecovery=!!r.inRecoveryMode;
    const activePid=r.activePhase||'p1';
    const days=Math.max(1,Math.floor((Date.now()-new Date(_startDate).getTime())/(1000*60*60*24))+1);
    const weeks=Math.ceil(days/7);

    // Phase icons
    const _phIcons={p1:'🛡',p2:'💧',p3:'✨',p4:'🌿'};
    let icon,dayText,subText,extraClass='';
    if(inRecovery){
      icon='🌿';
      dayText=t('js_ctx_recovery')+' · '+t('js_week')+' '+weeks;
      subText=t('js_recovery_sub');
      extraClass='recovery';
    } else {
      const ctx=t('js_ctx_'+activePid)||('Phase '+activePid.replace('p',''));
      icon=_phIcons[activePid]||'🗓';
      const _stripFocus=(activePid==='p4')?(r.p4Focus||'aging'):undefined;
      const timeLabel=_getPhaseSubState(activePid,days,_stripFocus);
      dayText=ctx+' · '+timeLabel;
      const _tip=_getPhaseSubStateTip(activePid,days,_stripFocus);
      subText=t('js_week')+' '+weeks+' · '+t('js_day')+' '+days+(_tip?' · '+_tip:'');
    }

    const whyText=_generatePhaseExplanation(r);
    const whyId='js-why-'+routineId;

    const strip=document.createElement('div');
    strip.className='js-strip '+extraClass;
    strip.innerHTML=`
      <div class="js-strip-icon">${icon}</div>
      <div style="flex:1">
        <div class="js-strip-day">${dayText}</div>
        <div class="js-strip-phase">${subText}</div>
      </div>
      ${whyText?`<button class="js-why-btn" onclick="toggleWhyExplanation('${whyId}',this)" aria-label="${t('why_btn')}">ℹ</button>`:''}`;

    if(whyText){
      const whyRow=document.createElement('div');
      whyRow.id=whyId;
      whyRow.className='js-why-row';
      whyRow.style.display='none';
      whyRow.textContent=whyText;
      strip.appendChild(whyRow);
    }

    // Insert before the builder-step-hd
    const hd=card.querySelector('.builder-step-hd');
    if(hd)card.insertBefore(strip,hd);
    else card.prepend(strip);
  });
}

/* ═══ PHASE SUB-STATE SYSTEM ═══ */
// Thresholds: p1-p3 use 7/21 days, p4 uses 14/35 (longer maintenance); aging uses 21/56
function _getPhaseSubStateLevel(pid,days,focus){
  if(pid==='p4'&&focus==='aging')return days<=21?1:days<=56?2:3;
  const th=pid==='p4'?[14,35]:[7,21];
  return days<=th[0]?1:days<=th[1]?2:3;
}
// Returns the emotional stage label for the strip main line
function _getPhaseSubState(pid,days,focus){
  const lv=_getPhaseSubStateLevel(pid,days,focus);
  if(pid==='p4'&&focus){
    return t('js_sub_p4_'+focus+'_'+lv)||t('js_sub_'+pid+'_'+lv)||t('js_stable');
  }
  return t('js_sub_'+pid+'_'+lv)||t('js_stable');
}
// Returns the contextual tip shown as the secondary line
function _getPhaseSubStateTip(pid,days,focus){
  const lv=_getPhaseSubStateLevel(pid,days,focus);
  if(pid==='p4'&&focus){
    return t('js_sub_p4_'+focus+'_'+lv+'_tip')||t('js_sub_'+pid+'_'+lv+'_tip')||'';
  }
  return t('js_sub_'+pid+'_'+lv+'_tip')||'';
}
// Injects a small sub-state badge chip into a phase panel card header
function _injectPhaseSubStateBadge(card,pid){
  const _startDate=(function(){
    const rid=card.dataset.cardId&&card.dataset.cardId.replace('gc-','');
    const r=rid?getSavedRoutines().find(function(x){return x.id===rid;}):null;
    return r?(r.phaseStartedAt||r.createdAt):null;
  })();
  if(!_startDate)return;
  const days=Math.max(1,Math.floor((Date.now()-new Date(_startDate).getTime())/(1000*60*60*24))+1);
  const _rid=card.dataset.cardId&&card.dataset.cardId.replace('gc-','');
  const _r=_rid?getSavedRoutines().find(function(x){return x.id===_rid;}):null;
  const focus=(pid==='p4')?(_r&&_r.p4Focus||'aging'):undefined;
  const label=_getPhaseSubState(pid,days,focus);
  if(!label||label===t('js_stable'))return;
  // Remove existing badge if any
  const old=card.querySelector('.js-substate-badge');if(old)old.remove();
  const badge=document.createElement('span');
  badge.className='js-substate-badge';
  badge.textContent=label;
  // Insert inside the active phase panel header, after ph-duration
  const dur=card.querySelector('.phase-panel.active .ph-duration');
  if(dur)dur.insertAdjacentElement('afterend',badge);
}

/* ═══ CHECK-IN SYSTEM ═══ */
function _getTodayDate(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function _hasCheckedInToday(r){
  return !!(r.checkinHistory&&r.checkinHistory.includes(_getTodayDate()));
}
function _getCheckinStreak(r){
  if(!r.checkinHistory||!r.checkinHistory.length)return 0;
  const history=[...r.checkinHistory].sort();
  const today=_getTodayDate();
  let streak=0;
  // Build streak backwards from yesterday (or today if checked in)
  const startFrom=history.includes(today)?today:null;
  let check=new Date();
  if(!startFrom)check.setDate(check.getDate()-1);
  for(let i=0;i<90;i++){
    const ds=check.getFullYear()+'-'+String(check.getMonth()+1).padStart(2,'0')+'-'+String(check.getDate()).padStart(2,'0');
    if(history.includes(ds)){streak++;check.setDate(check.getDate()-1);}
    else break;
  }
  return streak;
}
function _getMissedDays(r){
  if(!r.checkinHistory||!r.checkinHistory.length)return 0;
  const today=_getTodayDate();
  if(r.checkinHistory.includes(today))return 0;
  const sorted=[...r.checkinHistory].sort();
  const last=sorted[sorted.length-1];
  const lastDate=new Date(last+'T12:00:00');
  const todayDate=new Date(today+'T12:00:00');
  const diff=Math.round((todayDate-lastDate)/(1000*60*60*24));
  return Math.max(0,diff-1);
}
function logCheckin(routineId){
  const routines=getSavedRoutines();
  const idx=routines.findIndex(function(x){return x.id===routineId;});
  if(idx===-1)return;
  const today=_getTodayDate();
  if(!routines[idx].checkinHistory)routines[idx].checkinHistory=[];
  if(!routines[idx].checkinHistory.includes(today)){
    routines[idx].checkinHistory.push(today);
    setSavedRoutines(routines);
  }
  const card=document.querySelector('#page-myroutine .builder-card[data-card-id="gc-'+routineId+'"]');
  if(card)_injectCheckinCard(card,routines[idx]);
}
function _injectCheckinCard(card,r){
  const old=card.querySelector('.gp-checkin-wrap');if(old)old.remove();
  const routineId=r.id;
  const doneToday=_hasCheckedInToday(r);
  const streak=_getCheckinStreak(r);
  const missed=_getMissedDays(r);
  let inner='';
  // Missed-days note moved into the Weekly Skin Check card (see _mrrWscCard).
  if(doneToday){
    const streakHtml=streak>=2?` <span class="gp-checkin-streak">${t6('checkin_streak').replace('{n}',streak)}</span>`:'';
    inner+=`<div class="gp-checkin-card done">
      <span class="gp-checkin-check">✓</span>
      <span class="gp-checkin-done-text">${t6('checkin_done')}${streakHtml}</span>
    </div>`;
  } else {
    inner+=`<div class="gp-checkin-card" onclick="(typeof openDscSheet==='function'?openDscSheet:logCheckin)('${routineId}')">
      <div class="gp-checkin-icon">🌙</div>
      <div class="gp-checkin-body">
        <div class="gp-checkin-title">${t6('checkin_title')}</div>
        <div class="gp-checkin-sub">${t6('checkin_sub')}</div>
      </div>
      <button class="gp-checkin-btn" onclick="event.stopPropagation();(typeof openDscSheet==='function'?openDscSheet:logCheckin)('${routineId}')">${t6('checkin_btn')}</button>
    </div>`;
  }
  const wrap=document.createElement('div');
  wrap.className='gp-checkin-wrap';
  wrap.innerHTML=inner;
  // My Routine redesign: place the check-in UNDER the routine steps (after the evening block).
  const eveBlock=card.querySelector('.mrr-evening');
  if(eveBlock){eveBlock.insertAdjacentElement('afterend',wrap);return;}
  const jsStrip=card.querySelector('.js-strip');
  if(jsStrip)jsStrip.insertAdjacentElement('afterend',wrap);
  else{const hd=card.querySelector('.builder-step-hd');if(hd)hd.insertAdjacentElement('afterend',wrap);else card.prepend(wrap);}
}
function renderCheckinCards(){
  const myPage=document.getElementById('page-myroutine');
  if(!myPage)return;
  document.querySelectorAll('#page-myroutine .builder-card[data-card-id]').forEach(function(card){
    const cardId=card.dataset.cardId;
    if(!cardId||cardId==='gc-draft')return;
    const routineId=cardId.replace('gc-','');
    const r=getSavedRoutines().find(function(x){return x.id===routineId;});
    if(!r)return;
    _injectCheckinCard(card,r);
  });
}

/* ═══ DAILY SKIN CHECK (DSC) ═══
   A fast 2-question check shown before the evening routine. It adjusts TONIGHT ONLY.
   It never changes phase, never touches the Weekly Skin Check, and never auto-activates
   Step Back (it can only SUGGEST it). Completing a DSC also logs the daily streak via
   logCheckin() — DSC IS the daily check-in, not a second competing action. */
const _dscState={routineId:null, answers:{q1:null,q2:null}};
function _dscLastKey(routineId){ return 'gp_dsc_last_'+routineId; }
// Daily cadence: due if not completed today, routine is real, and not already in recovery mode.
function _dscIsDue(routineId){
  if(!routineId||routineId==='draft')return false;
  try{
    const r=getSavedRoutines().find(function(x){return x.id===routineId;});
    if(!r)return false;
    if(r.inRecoveryMode)return false;                 // recovery already keeps tonight gentle
    const last=localStorage.getItem(_dscLastKey(routineId));
    if(!last)return true;                             // never done → due (incl. first night, by design)
    return last!==_getTodayDate();                    // due once per calendar day
  }catch(e){return false;}
}
function _dscMarkDone(routineId){
  try{localStorage.setItem(_dscLastKey(routineId),_getTodayDate());}catch(e){}
}
// Persist today's skin-state answer on the routine (capped 14-day history) — signal only, never phase.
function _dscHistoryPush(routineId,reactivity,q2){
  const routines=getSavedRoutines();
  const idx=routines.findIndex(function(x){return x.id===routineId;});
  if(idx===-1)return;
  const today=_getTodayDate();
  const hist=(routines[idx].dscHistory||[]).filter(function(e){return e.date!==today;});
  hist.push({date:today,reactivity:reactivity,q2:q2});
  while(hist.length>14)hist.shift();
  routines[idx].dscHistory=hist;
  routines[idx].dscToday={date:today,reactivity:reactivity,q2:q2};
  setSavedRoutines(routines);
}
// Step Back gate: 2 of the last 3 DSC days were "irritated" (reactivity 2). Suggestion only.
function _dscIrritatedStreak(r){
  if(!r||!r.dscHistory||!r.dscHistory.length)return false;
  const last3=r.dscHistory.slice(-3);
  return last3.filter(function(e){return e.reactivity>=2;}).length>=2;
}
// Pure resolver: (reactivity 0/1/2, q2 'balanced'|'dry'|'oily') → tonight-only adjustment object.
// reactivity 2 (irritated) → barrier night: suppress all of tonight's actives + hydration + warn.
// reactivity 1 (sensitive) → soften: skip tonight's single scheduled active + hydration.
// dry (calm)               → hydration boost only; actives KEPT.
// oily (calm)              → keep tonight lighter (no added richness); actives KEPT; no new actives.
function _dscResolve(reactivity,q2){
  const dryness=q2==='dry'?1:0;
  const oil=q2==='oily'?1:0;
  let tonightState='normal',activeReduce='none',warn=false;
  if(reactivity>=2){tonightState='barrier';activeReduce='suppress';warn=true;}
  else if(reactivity>=1){tonightState='soften';activeReduce='buffer';}
  const hydrationBoost=(dryness===1)||(reactivity>=1);
  const keepLight=(oil===1)&&(reactivity===0);
  return {reactivity:reactivity,dryness:dryness,oil:oil,tonightState:tonightState,activeReduce:activeReduce,hydrationBoost:hydrationBoost,keepLight:keepLight,warn:warn};
}

// ── DSC overlay (cloned from the WSC sheet; 2 questions) ──
function openDscSheet(routineId){
  _dscState.routineId=routineId;
  _dscState.answers={q1:null,q2:null};
  const ov=_dscGetOrCreateOverlay();
  _renderDscQuestions();
  ov.style.display='flex';
}
function closeDscSheet(){
  const ov=document.getElementById('dsc-sheet-overlay');
  if(ov)ov.style.display='none';
}
function _dscGetOrCreateOverlay(){
  let ov=document.getElementById('dsc-sheet-overlay');
  if(!ov){
    ov=document.createElement('div');
    ov.id='dsc-sheet-overlay';
    ov.className='sb-sheet-overlay'; // reuse existing overlay style
    ov.style.display='none';
    ov.addEventListener('click',function(e){if(e.target===ov)closeDscSheet();});
    const sheet=document.createElement('div');
    sheet.id='dsc-sheet-box';
    sheet.className='wsc-sheet';
    ov.appendChild(sheet);
    document.body.appendChild(ov);
  }
  return ov;
}
function _renderDscQuestions(){
  const all=_dscState.answers;
  const ready=all.q1&&all.q2;
  function optRow(q,key,label){
    const sel=_dscState.answers[q]===key?'selected':'';
    const m=String(label).match(/^([\p{Extended_Pictographic}‍️]+)\s*([\s\S]*)$/u);
    const emoji=m?m[1]:''; const txt=m?m[2]:label;
    return `<div class="wsc-option ${sel}" onclick="dscSelectAnswer('${q}','${key}')">${emoji?`<span class="dsc-opt-ic">${emoji}</span>`:''}<span class="dsc-opt-lb">${txt}</span></div>`;
  }
  document.getElementById('dsc-sheet-box').innerHTML=`
    <div class="wsc-handle"></div>
    <div class="wsc-title">${t('dsc_sheet_title')}</div>
    <div class="wsc-sub" style="font-size:.78rem;color:#999;margin:-4px 0 12px;text-align:center;line-height:1.4">${t('dsc_sheet_sub')}</div>
    <div class="wsc-question">
      <div class="wsc-q-label"><span class="dsc-qnum">1</span>${t('dsc_q1_label')}</div>
      <div class="wsc-options">
        ${optRow('q1','a',t('dsc_q1_a'))}${optRow('q1','b',t('dsc_q1_b'))}${optRow('q1','c',t('dsc_q1_c'))}
      </div>
    </div>
    <div class="wsc-divider"></div>
    <div class="wsc-question">
      <div class="wsc-q-label"><span class="dsc-qnum">2</span>${t('dsc_q2_label')}</div>
      <div class="wsc-options">
        ${optRow('q2','a',t('dsc_q2_a'))}${optRow('q2','b',t('dsc_q2_b'))}${optRow('q2','c',t('dsc_q2_c'))}
      </div>
    </div>
    <div class="wsc-footer">
      <button class="wsc-btn-submit" ${ready?'':'disabled'} onclick="dscApply()">${t('dsc_btn_apply')}</button>
      <button class="wsc-btn-skip" onclick="_dscSkip()">${t('dsc_btn_skip')}</button>
    </div>`;
}
function dscSelectAnswer(q,key){
  const box=document.getElementById('dsc-sheet-box');
  const scrollTop=box?box.scrollTop:0;
  _dscState.answers[q]=key;
  _renderDscQuestions();
  if(box)box.scrollTop=scrollTop;
}
function dscApply(){
  const routineId=_dscState.routineId;
  const reactivity={a:0,b:1,c:2}[_dscState.answers.q1]??0;
  const q2={a:'balanced',b:'dry',c:'oily'}[_dscState.answers.q2]||'balanced';
  _dscMarkDone(routineId);
  _dscHistoryPush(routineId,reactivity,q2);
  if(typeof logCheckin==='function')logCheckin(routineId); // DSC IS the daily check-in → updates streak
  closeDscSheet();
  // Re-render My Routine so tonight's adjustment + banner appear and the check-in card updates.
  if(typeof renderMyRoutines==='function')renderMyRoutines();
  // Suggest Step Back ONLY if 2-of-3 recent DSC days were irritated (suggestion, never auto-activate).
  try{
    const r=getSavedRoutines().find(function(x){return x.id===routineId;});
    if(r&&!r.inRecoveryMode&&_dscIrritatedStreak(r)&&typeof _dscShowStepBackSuggestion==='function')_dscShowStepBackSuggestion(routineId);
  }catch(e){}
}
function _dscSkip(){
  _dscMarkDone(_dscState.routineId); // mark done so it won't re-prompt today; no streak logged on a skip
  closeDscSheet();
}
// Auto-prompt before the evening routine. Weekly Skin Check takes precedence (one sheet/evening);
// skipped automatically when in recovery (via _dscIsDue) or already done today.
function checkAndShowDscPrompt(){
  const myPage=document.getElementById('page-myroutine');
  if(!myPage||!myPage.classList.contains('active'))return;
  const existing=document.getElementById('dsc-sheet-overlay');
  if(existing&&existing.style.display==='flex')return;            // already open — don't re-open
  const cards=document.querySelectorAll('#page-myroutine .builder-card[data-card-id]');
  for(let i=0;i<cards.length;i++){
    const cardId=cards[i].dataset.cardId;
    if(!cardId||cardId==='gc-draft')continue;
    const routineId=cardId.replace('gc-','');
    if(typeof _wscIsDue==='function'&&_wscIsDue(routineId))continue; // weekly check wins tonight
    if(!_dscIsDue(routineId))continue;
    openDscSheet(routineId);
    break;                                                          // one sheet at a time
  }
}
// Gentle Step Back suggestion (2-of-3 irritated). Reuses the existing manual step-back flow.
// NEVER auto-activates recovery — the user must tap "Ease into recovery".
function _dscShowStepBackSuggestion(routineId){
  const ov=_dscGetOrCreateOverlay();
  const box=document.getElementById('dsc-sheet-box');
  if(!box)return;
  box.innerHTML=`
    <div class="wsc-handle"></div>
    <div class="wsc-result">
      <div class="wsc-result-icon">🛡</div>
      <div class="wsc-result-title">${t('dsc_sb_title')}</div>
      <div class="wsc-result-msg">${t('dsc_sb_msg')}</div>
      <button class="wsc-btn-stay" onclick="closeDscSheet();_wscTriggerStepBack('${routineId}')">${t('dsc_sb_btn_yes')}</button>
      <button class="wsc-btn-anyway" onclick="closeDscSheet()">${t('dsc_sb_btn_no')}</button>
    </div>`;
  ov.style.display='flex';
}

/* ═══ MISSED-DAYS CATCH-UP (re-sync) ═══
   Shown when the user returns after a real gap (≥3 missed daily check-ins). Instead of trusting
   stale progress, a short current-state check RE-SYNCS everything:
     1) RESETS the weekly clock (_wscMarkDone) → next weekly is a fresh 7 days from now.
     2) Closes the gap (logs today) so missed-days resets to 0.
     3) Re-baselines progress: writes a FRESH wscHistory entry from how the skin is NOW, so the
        "How it's going" bar reads current reality (a stale "Controlled" drops if the concern regressed).
     4) Adjusts the routine to current skin: soften/barrier tonight via the DSC signal; if irritated,
        OFFERS recovery (never auto-activates — the user chooses, mirroring the DSC step-back). */
const _catchupState={routineId:null, answers:{q1:null,q2:null}};
function openCatchupSheet(routineId){
  _catchupState.routineId=routineId;
  _catchupState.answers={q1:null,q2:null};
  const ov=_catchupGetOrCreateOverlay();
  _renderCatchupQuestions();
  ov.style.display='flex';
}
function closeCatchupSheet(){const ov=document.getElementById('catchup-sheet-overlay');if(ov)ov.style.display='none';}
function _catchupGetOrCreateOverlay(){
  let ov=document.getElementById('catchup-sheet-overlay');
  if(!ov){
    ov=document.createElement('div');
    ov.id='catchup-sheet-overlay';
    ov.className='sb-sheet-overlay';
    ov.style.display='none';
    ov.addEventListener('click',function(e){if(e.target===ov)closeCatchupSheet();});
    const sheet=document.createElement('div');
    sheet.id='catchup-sheet-box';
    sheet.className='wsc-sheet';
    ov.appendChild(sheet);
    document.body.appendChild(ov);
  }
  return ov;
}
function _renderCatchupQuestions(){
  const all=_catchupState.answers;
  const _rd=(typeof getSavedRoutines==='function')?getSavedRoutines().find(function(x){return x.id===_catchupState.routineId;}):null;
  const _missed=(_rd&&typeof _getMissedDays==='function')?_getMissedDays(_rd):0;
  const _cq=(_rd&&typeof _wscConcernQ==='function')?_wscConcernQ(_rd):{show:false};
  const ready=all.q1&&(!_cq.show||all.q2);
  const L=_mrrL;
  function optRow(q,key,label){
    const sel=all[q]===key?'selected':'';
    return `<div class="wsc-option ${sel}" onclick="catchupSelectAnswer('${q}','${key}')"><div class="wsc-option-dot"></div>${label}</div>`;
  }
  document.getElementById('catchup-sheet-box').innerHTML=`
    <div class="wsc-handle"></div>
    <div class="wsc-title">${L('Welcome back','ยินดีต้อนรับกลับ')}</div>
    <div class="wsc-sub" style="font-size:.78rem;color:#8A95A0;margin:-4px 0 12px;text-align:center;line-height:1.45">${L("It's been "+_missed+" days. Let's re-sync to how your skin is right now.","ห่างหายไป "+_missed+" วัน มาซิงค์ให้ตรงกับผิวคุณตอนนี้กันใหม่")}</div>
    <div class="wsc-question">
      <div class="wsc-q-label"><span class="wsc-qnum">1</span>${L('How does your skin feel right now?','ตอนนี้ผิวรู้สึกอย่างไร?')}</div>
      <div class="wsc-options">
        ${optRow('q1','a',L('Calm & comfortable','สงบ & สบายผิว'))}${optRow('q1','b',L('A little off / unsettled','รู้สึกแปลก ๆ เล็กน้อย'))}${optRow('q1','c',L('Irritated / reactive','ระคายเคือง / ไวง่าย'))}
      </div>
    </div>
    ${_cq.show?`<div class="wsc-divider"></div>
    <div class="wsc-question">
      <div class="wsc-q-label"><span class="wsc-qnum">2</span>${_cq.label}</div>
      <div class="wsc-options">
        ${optRow('q2','a',_cq.opts[0])}${optRow('q2','b',_cq.opts[1])}${optRow('q2','c',_cq.opts[2])}
      </div>
    </div>`:''}
    <div class="wsc-footer">
      <button class="wsc-btn-submit" ${ready?'':'disabled'} onclick="catchupApply()">${L('Re-sync my routine','ซิงค์รูทีนใหม่')}</button>
      <button class="wsc-btn-skip" onclick="_catchupSkip()">${L('Not now','ไว้ก่อน')}</button>
    </div>`;
}
function catchupSelectAnswer(q,key){
  const box=document.getElementById('catchup-sheet-box');
  const scrollTop=box?box.scrollTop:0;
  _catchupState.answers[q]=key;
  _renderCatchupQuestions();
  if(box)box.scrollTop=scrollTop;
}
function _catchupSkip(){ closeCatchupSheet(); }
function catchupApply(){
  const routineId=_catchupState.routineId;
  const a=_catchupState.answers;
  const reactivity={a:0,b:1,c:2}[a.q1]??0;
  // 1) RESET the weekly clock — next weekly is a fresh 7 days from now.
  if(typeof _wscMarkDone==='function')_wscMarkDone(routineId);
  // 2) Close the gap + seed tonight's gentle adjustment (barrier if irritated, soften if off).
  if(typeof _dscMarkDone==='function')_dscMarkDone(routineId);
  if(typeof _dscHistoryPush==='function')_dscHistoryPush(routineId,reactivity,'balanced');
  if(typeof logCheckin==='function')logCheckin(routineId); // today counts → missed-days resets to 0
  // 3) Re-baseline progress — a FRESH weekly-history entry reflecting current skin.
  const routines=getSavedRoutines();
  const idx=routines.findIndex(function(x){return x.id===routineId;});
  if(idx!==-1){
    const rd=routines[idx];
    const score=reactivity===0?1:(reactivity===1?4:7);        // calm→good · off→mild · irritated→stress
    const w=reactivity===0?'a':(reactivity===1?'b':'c');       // feel proxy for the metric card
    const cq=(typeof _wscConcernQ==='function')?_wscConcernQ(rd):{show:false};
    const q5=cq.show?(a.q2||null):null;                        // concern-now → drives the progress bar
    const hist=rd.wscHistory||[];
    hist.push({date:new Date().toISOString(),score:score,q1:w,q2:w,q3:w,q4:w,q5:q5,focus:(rd.p3Focus||null),catchup:true});
    if(hist.length>4)hist.shift();
    rd.wscHistory=hist;
    delete rd.pssIgnored;            // re-evaluate phase-shift on next render
    delete rd.advanceSnoozedLen;     // clear stale advance snooze — progress has been re-based
    routines[idx]=rd;
    setSavedRoutines(routines);
  }
  closeCatchupSheet();
  if(typeof renderMyRoutines==='function')renderMyRoutines();
  // 4) If skin returned irritated, OFFER recovery (user chooses — never auto-activates).
  if(reactivity>=2){
    try{const r=getSavedRoutines().find(function(x){return x.id===routineId;});
      if(r&&!r.inRecoveryMode&&typeof _dscShowStepBackSuggestion==='function')setTimeout(function(){_dscShowStepBackSuggestion(routineId);},320);}catch(e){}
  }
}

function toggleWhyExplanation(id,btn){
  const row=document.getElementById(id);
  if(!row)return;
  const isOpen=row.style.display!=='none';
  row.style.display=isOpen?'none':'block';
  if(btn)btn.textContent=isOpen?'ℹ':t('why_hide');
  if(btn)btn.classList.toggle('active',!isOpen);
}

// Injects a one-line WSC status below the ph-duration on each visible phase card.
// Only shown on My Routine page. Updates on every render.
function updatePhaseCardWSCStatus(){
  const myPage=document.getElementById('page-myroutine');
  if(!myPage||!myPage.classList.contains('active'))return;
  document.querySelectorAll('.builder-card[data-card-id]').forEach(function(card){
    const cardId=card.dataset.cardId;
    if(!cardId||cardId==='gc-draft')return;
    const routineId=cardId.replace('gc-','');
    const r=getSavedRoutines().find(function(x){return x.id===routineId;});
    if(!r||!r.wscHistory||!r.wscHistory.length)return;
    const lastEntry=r.wscHistory[r.wscHistory.length-1];
    if(!lastEntry)return;
    const score=lastEntry.score;
    let statusHtml='';
    if(score<=2)     statusHtml='<div class="ph-wsc-status ok">✨ '+t('ph_wsc_ok')+'</div>';
    else if(score<=5)statusHtml='<div class="ph-wsc-status caution">🌿 '+t('ph_wsc_caution')+'</div>';
    else             statusHtml='<div class="ph-wsc-status stress">🛡 '+t('ph_wsc_stress')+'</div>';
    // Inject after each ph-duration in visible phase panels
    card.querySelectorAll('.ph-duration').forEach(function(el){
      if(el.nextElementSibling&&el.nextElementSibling.classList.contains('ph-wsc-status'))return;
      el.insertAdjacentHTML('afterend',statusHtml);
    });
  });
}

// Inject the weekly check banner into the correct builder-card
function checkAndShowWscBanner(){
  // Only show on My Routine page — not on the builder result
  const myPage=document.getElementById('page-myroutine');
  if(!myPage||!myPage.classList.contains('active'))return;
  // My Routine redesign: the top "Weekly Skin Check" progress card (.wsc) already provides the
  // check-in entry point, so skip the redundant in-card due-banner when it's present.
  if(document.querySelector('#myroutine-content .wsc'))return;
  document.querySelectorAll('.builder-card[data-card-id]').forEach(function(card){
    const cardId=card.dataset.cardId;
    if(!cardId||cardId==='gc-draft')return;
    const routineId=cardId.replace('gc-','');
    if(!_wscIsDue(routineId))return;
    // Only inject once
    if(card.querySelector('.wsc-banner'))return;
    const banner=document.createElement('div');
    banner.className='wsc-banner';
    banner.innerHTML=`
      <div class="wsc-banner-icon">🌸</div>
      <div class="wsc-banner-content">
        <div class="wsc-banner-title">${t('wsc_banner_title')}</div>
        <div class="wsc-banner-sub">${t('wsc_banner_sub')}</div>
      </div>
      <button class="wsc-banner-btn" onclick="openWscSheet('${routineId}')">${t('wsc_banner_btn')}</button>`;
    // Insert at very top of card, before builder-step-hd
    const hd=card.querySelector('.builder-step-hd');
    if(hd)card.insertBefore(banner,hd);
    else card.prepend(banner);
  });
}

function openWscSheet(routineId){
  _wscState.routineId=routineId;
  _wscState.answers={q1:null,q2:null,q3:null,q4:null,q5:null};
  const ov=_wscGetOrCreateOverlay(); // create DOM elements first
  _renderWscQuestions();              // wsc-sheet-box now exists
  ov.style.display='flex';           // then show
}

function closeWscSheet(){
  const ov=document.getElementById('wsc-sheet-overlay');
  if(ov)ov.style.display='none';
  // #Progression — if a concern-advance was queued during this weekly check, offer it now (after the result).
  if(window._gpPendingAdvance){const _pa=window._gpPendingAdvance;window._gpPendingAdvance=null;
    setTimeout(function(){if(typeof _gpAdvanceNotice==='function')_gpAdvanceNotice(_pa.rid,_pa.from,_pa.to);},350);}
}

function _wscGetOrCreateOverlay(){
  let ov=document.getElementById('wsc-sheet-overlay');
  if(!ov){
    ov=document.createElement('div');
    ov.id='wsc-sheet-overlay';
    ov.className='sb-sheet-overlay'; // reuse existing overlay style
    ov.style.display='none';
    ov.addEventListener('click',function(e){if(e.target===ov)closeWscSheet();});
    const sheet=document.createElement('div');
    sheet.id='wsc-sheet-box';
    sheet.className='wsc-sheet';
    ov.appendChild(sheet);
    document.body.appendChild(ov);
  }
  return ov;
}

// Adaptive weekly question (q5) — appears ONLY in Phase 3 and asks about the user's ACTIVE concern,
// so the check-in tracks THAT concern's progress (not a fixed script). a=doing well … c=no change.
// Kept OUT of _wscScore (barrier composite) — it's a separate concern-progress signal.
function _wscConcernQ(rd){
  if(!rd) return {show:false};
  var pid=rd.activePhase||rd.startingPhase||'p1';
  if(pid!=='p3') return {show:false};
  var focus=rd.p3Focus||((typeof _inferP3Focus==='function'&&rd.answers)?_inferP3Focus(rd.answers):'clarity');
  var st=((rd.focusSubtype||{})[focus])||[];
  var L=_mrrL;
  if(focus==='clarity') return {show:true,focus:focus,
    label:L('How are your breakouts & congestion?','สิว & การอุดตันเป็นอย่างไรบ้าง?'),
    opts:[L('Clear / under control','เคลียร์ / ควบคุมได้'),L('A few, on and off','มีบ้างเป็นบางครั้ง'),L('Frequent / worse','บ่อย / แย่ลง')]};
  if(focus==='tone'){
    var lbl=(st.indexOf('pie')!==-1&&st.indexOf('pih')===-1)?L('How is the redness from old marks?','รอยแดงจากสิวเก่าเป็นอย่างไร?')
      :(st.indexOf('melasma')!==-1&&st.length===1)?L('How are your melasma patches?','ฝ้าเป็นอย่างไรบ้าง?')
      :L('How are your dark marks & tone?','รอยด่างดำ & สีผิวเป็นอย่างไร?');
    return {show:true,focus:focus,label:lbl,
      opts:[L('Noticeably fading','จางลงชัดเจน'),L('Slowly fading','ค่อย ๆ จางลง'),L('No change yet','ยังไม่เปลี่ยน')]};
  }
  return {show:true,focus:focus,
    label:L('How is your texture & firmness?','ผิวเรียบเนียน & กระชับเป็นอย่างไร?'),
    opts:[L('Smoother / firmer','เนียน / กระชับขึ้น'),L('A little better','ดีขึ้นเล็กน้อย'),L('No change yet','ยังไม่เปลี่ยน')]};
}
function _renderWscQuestions(){
  const all=_wscState.answers;
  const _rd=(typeof getSavedRoutines==='function')?getSavedRoutines().find(function(x){return x.id===_wscState.routineId;}):null;
  const _cq=_wscConcernQ(_rd);
  const allAnswered=all.q1&&all.q2&&all.q3&&all.q4&&(!_cq.show||all.q5);

  function optRow(q,key,label){
    const sel=_wscState.answers[q]===key?'selected':'';
    return `<div class="wsc-option ${sel}" onclick="wscSelectAnswer('${q}','${key}')"><div class="wsc-option-dot"></div>${label}</div>`;
  }

  document.getElementById('wsc-sheet-box').innerHTML=`
    <div class="wsc-handle"></div>
    <div class="wsc-title">${t('wsc_sheet_title')}</div>
    <div class="wsc-sub">${t('wsc_sheet_sub')}</div>
    <div class="wsc-question">
      <div class="wsc-q-label"><span class="wsc-qnum">1</span>${t('wsc_q1_label')}</div>
      <div class="wsc-options">
        ${optRow('q1','a',t('wsc_q1_a'))}${optRow('q1','b',t('wsc_q1_b'))}${optRow('q1','c',t('wsc_q1_c'))}
      </div>
    </div>
    <div class="wsc-divider"></div>
    <div class="wsc-question">
      <div class="wsc-q-label"><span class="wsc-qnum">2</span>${t('wsc_q2_label')}</div>
      <div class="wsc-options">
        ${optRow('q2','a',t('wsc_q2_a'))}${optRow('q2','b',t('wsc_q2_b'))}${optRow('q2','c',t('wsc_q2_c'))}
      </div>
    </div>
    <div class="wsc-divider"></div>
    <div class="wsc-question">
      <div class="wsc-q-label"><span class="wsc-qnum">3</span>${t('wsc_q3_label')}</div>
      <div class="wsc-options">
        ${optRow('q3','a',t('wsc_q3_a'))}${optRow('q3','b',t('wsc_q3_b'))}${optRow('q3','c',t('wsc_q3_c'))}
      </div>
    </div>
    <div class="wsc-divider"></div>
    <div class="wsc-question">
      <div class="wsc-q-label"><span class="wsc-qnum">4</span>${t('wsc_q4_label')}</div>
      <div class="wsc-options">
        ${optRow('q4','a',t('wsc_q4_a'))}${optRow('q4','b',t('wsc_q4_b'))}${optRow('q4','c',t('wsc_q4_c'))}
      </div>
    </div>
    ${_cq.show?`<div class="wsc-divider"></div>
    <div class="wsc-question">
      <div class="wsc-q-label"><span class="wsc-qnum">5</span>${_cq.label}</div>
      <div class="wsc-options">
        ${optRow('q5','a',_cq.opts[0])}${optRow('q5','b',_cq.opts[1])}${optRow('q5','c',_cq.opts[2])}
      </div>
    </div>`:''}
    <div class="wsc-footer">
      <button class="wsc-btn-submit" ${allAnswered?'':'disabled'} onclick="wscSubmit()">${t('wsc_btn_submit')}</button>
      <button class="wsc-btn-skip" onclick="_wscSkip()">${t('wsc_btn_skip')}</button>
    </div>`;
}

function wscSelectAnswer(q,key){
  const box=document.getElementById('wsc-sheet-box');
  const scrollTop=box?box.scrollTop:0;
  _wscState.answers[q]=key;
  _renderWscQuestions();
  if(box)box.scrollTop=scrollTop;
}

function _wscScore(){
  const map={q1:{a:0,b:1,c:2},q2:{a:0,b:1,c:2},q3:{a:0,b:1,c:2},q4:{a:0,b:1,c:2}};
  return ['q1','q2','q3','q4'].reduce(function(s,q){return s+(map[q][_wscState.answers[q]]??0);},0);
}

function wscSubmit(){
  const score=_wscScore();
  const routineId=_wscState.routineId;
  _wscMarkDone(routineId);

  // Save score to history (last 4 checks) for trend detection
  const _routines=getSavedRoutines();
  const _ri=_routines.findIndex(function(x){return x.id===routineId;});
  if(_ri!==-1){
    const _hist=_routines[_ri].wscHistory||[];
    // Store per-question answers (q1 moisture, q2 irritation, q3 breakouts, q4 tolerance)
    // alongside the composite score so the My Routine progress card can show real per-metric trends.
    const _wa=_wscState.answers||{};
    _hist.push({date:new Date().toISOString(),score:score,q1:_wa.q1||null,q2:_wa.q2||null,q3:_wa.q3||null,q4:_wa.q4||null,q5:_wa.q5||null,focus:(_routines[_ri].p3Focus||null)});
    if(_hist.length>4)_hist.shift(); // keep last 4 only
    _routines[_ri].wscHistory=_hist;
    // Clear any existing phase-shift dismissal so next render re-evaluates
    delete _routines[_ri].pssIgnored;
    setSavedRoutines(_routines);
    // #Progression — if the active concern now reads Controlled and a next concern exists, QUEUE the
    // advance notice (shown after the weekly result is dismissed, in closeWscSheet). Never auto-advances.
    try{
      const _rAdv=_routines[_ri];
      if((_rAdv.activePhase||_rAdv.startingPhase)==='p3'&&typeof _journeyStage==='function'&&_journeyStage(_rAdv)===2){
        const _nx=(typeof _gpNextConcern==='function')?_gpNextConcern(_rAdv):null;
        const _hl=(_rAdv.wscHistory||[]).length;
        if(_nx&&_rAdv.advanceSnoozedLen!==_hl){window._gpPendingAdvance={rid:routineId,from:_rAdv.p3Focus,to:_nx};}
      }
    }catch(e){}
  }

  // Remove banner from card now that check is complete
  const card=document.querySelector('.builder-card[data-card-id="gc-'+routineId+'"]');
  if(card){const b=card.querySelector('.wsc-banner');if(b)b.remove();}

  // Refresh the My Routine Weekly Skin Check progress card in place with the new data.
  try{
    const _wscEl=document.querySelector('#myroutine-content .wsc');
    if(_wscEl&&typeof _mrrWscCard==='function'){
      const _rd=getSavedRoutines().find(function(x){return x.id===routineId;});
      if(_rd){const _tmp=document.createElement('div');_tmp.innerHTML=_mrrWscCard(_rd);const _fresh=_tmp.firstElementChild;if(_fresh)_wscEl.replaceWith(_fresh);}
    }
  }catch(e){}

  const box=document.getElementById('wsc-sheet-box');
  if(!box)return;

  if(score<=2){
    // All good — confirm progression
    box.innerHTML=`
      <div class="wsc-handle"></div>
      <div class="wsc-result">
        <div class="wsc-result-icon">✨</div>
        <div class="wsc-result-title">${t('wsc_great_title')}</div>
        <div class="wsc-result-msg">${t('wsc_great_msg')}</div>
        <button class="wsc-btn-proceed" onclick="closeWscSheet()">${t('wsc_great_btn')}</button>
      </div>`;
  } else if(score<=5){
    // Mild concerns — suggest barrier banking nights
    box.innerHTML=`
      <div class="wsc-handle"></div>
      <div class="wsc-result">
        <div class="wsc-result-icon">🌿</div>
        <div class="wsc-result-title">${t('wsc_caution_title')}</div>
        <div class="wsc-result-msg">${t('wsc_caution_msg')}</div>
        <div class="wsc-result-tip">💡 ${t('wsc_caution_tip')}</div>
        <button class="wsc-btn-stay" onclick="closeWscSheet()">${t('wsc_caution_btn')}</button>
      </div>`;
  } else {
    // Significant stress. Step-back only makes sense from p3/p4 (recovery mode renders the
    // gentle p1 plan). For p1/p2 there's no gentler phase, so show a "gentle reset" message
    // with no phase change instead of an empty/redundant step-back.
    const _r=getSavedRoutines().find(function(x){return x.id===routineId;});
    const _curPid=(_r&&(_r.activePhase||_r.startingPhase))||'p1';
    if(_curPid==='p3'||_curPid==='p4'){
      box.innerHTML=`
        <div class="wsc-handle"></div>
        <div class="wsc-result">
          <div class="wsc-result-icon">🛡</div>
          <div class="wsc-result-title">${t('wsc_stepback_title')}</div>
          <div class="wsc-result-msg">${t('wsc_stepback_msg')}</div>
          <button class="wsc-btn-stay" onclick="_wscTriggerStepBack('${routineId}')">${t('wsc_stepback_btn_yes')}</button>
          <button class="wsc-btn-anyway" onclick="closeWscSheet()">${t('wsc_stepback_btn_no')}</button>
        </div>`;
    } else {
      box.innerHTML=`
        <div class="wsc-handle"></div>
        <div class="wsc-result">
          <div class="wsc-result-icon">🛡</div>
          <div class="wsc-result-title">${t('wsc_gentle_title')}</div>
          <div class="wsc-result-msg">${t('wsc_gentle_msg')}</div>
          <button class="wsc-btn-stay" onclick="closeWscSheet()">${t('wsc_gentle_btn')}</button>
        </div>`;
    }
  }
}

function _wscSkip(){
  // Mark as done so it won't show again for 7 days
  _wscMarkDone(_wscState.routineId);
  closeWscSheet();
  const card=document.querySelector('.builder-card[data-card-id="gc-'+_wscState.routineId+'"]');
  if(card){const b=card.querySelector('.wsc-banner');if(b)b.remove();}
}

function _wscTriggerStepBack(routineId){
  closeWscSheet();
  // Seed _sbState and activate recovery mode — reuses the existing step-back system
  const cardId='gc-'+routineId;
  const card=document.querySelector('.builder-card[data-card-id="'+cardId+'"]');
  if(!card)return;
  const phasePanel=card.querySelector('.phase-panel');
  const currentPid=phasePanel?phasePanel.dataset.pid:'p3';
  _sbState.cardId=cardId;
  _sbState.originalPid=currentPid;
  activateRecoveryMode();
}

/* ═══ PHASE STATE AUTO-SAVE + RESTORE ═══ */

// Silently writes activePhase + inRecoveryMode to the saved routine in localStorage.
// Called automatically on every phase switch and recovery mode change — no user action needed.
function _gpAutoSavePhaseState(cardId,pid,inRecovery){
  if(!cardId||cardId==='gc-draft')return; // unsaved draft — nothing to persist
  const routineId=cardId.replace('gc-','');
  const routines=getSavedRoutines();
  const idx=routines.findIndex(r=>r.id===routineId);
  if(idx===-1)return; // routine not yet saved to localStorage — skip silently
  const prevPhase=routines[idx].activePhase;
  routines[idx].activePhase=pid;
  routines[idx].inRecoveryMode=!!inRecovery;
  // Only update phaseStartedAt when the phase genuinely changes — not on page-load restores
  if(pid!==prevPhase) routines[idx].phaseStartedAt=new Date().toISOString();
  setSavedRoutines(routines);
}

// Called after every DOM render (via attachDayInteractions).
// Reads each visible card's saved phase state and silently restores it —
// bypassing the Skin Readiness Gate because this is restoration, not new progression.
function restorePhaseState(){
  document.querySelectorAll('.builder-card[data-card-id]').forEach(function(card){
    const cardId=card.dataset.cardId;
    if(!cardId||cardId==='gc-draft')return;
    const routineId=cardId.replace('gc-','');
    const r=getSavedRoutines().find(function(x){return x.id===routineId;});
    if(!r)return;
    const savedPhase=r.activePhase;
    const inRecovery=r.inRecoveryMode;
    if(inRecovery&&savedPhase){
      // Restore recovery mode — seed _sbState then activate
      _sbState.cardId=cardId;
      _sbState.originalPid=savedPhase;
      activateRecoveryMode();
    } else if(savedPhase&&savedPhase!=='p1'){
      // Restore non-default phase — use _doSwitchRoutinePhase to bypass the gate
      const tabBtn=card.querySelector('.phase-nav .phase-tab[data-phase="'+savedPhase+'"]');
      if(tabBtn)_doSwitchRoutinePhase(savedPhase,tabBtn);
    }
    // Restore p4 focus if saved
    if(r.p4Focus&&r.p4Focus!=='aging'){
      const data=window._glowPhaseData&&window._glowPhaseData[cardId];
      if(data){
        data.p4Focus=r.p4Focus;
        if(data._answersWithDayProducts)data._answersWithDayProducts._p4Focus=r.p4Focus;
        // Re-render focus tabs if p4 is currently shown
        const phasePanel=card.querySelector('.phase-panel[data-pid="p4"]');
        if(phasePanel){
          const focusTab=card.querySelector('.p4focus-tab');
          if(focusTab)switchP4Focus(r.p4Focus,focusTab.parentNode.querySelector('.p4focus-tab:nth-child('+(r.p4Focus==='barrier'?1:r.p4Focus==='glow'?2:3)+')'));
        }
      }
    }
    // Restore p3 focus if saved (non-default). p3 tabs reuse the p4focus-tab class.
    if(r.p3Focus&&r.p3Focus!=='renew'){
      const data=window._glowPhaseData&&window._glowPhaseData[cardId];
      if(data){
        data.p3Focus=r.p3Focus;
        if(data._answersWithDayProducts)data._answersWithDayProducts._p3Focus=r.p3Focus;
        // Re-render focus tabs only if p3 is currently shown
        const phasePanel=card.querySelector('.phase-panel[data-pid="p3"]');
        if(phasePanel){
          const focusTab=card.querySelector('.p4focus-tab');
          if(focusTab)switchP3Focus(r.p3Focus,focusTab.parentNode.querySelector('.p4focus-tab:nth-child('+(r.p3Focus==='clarity'?1:r.p3Focus==='tone'?2:3)+')'));
        }
      }
    }
  });
}

/* ═══ ROUTINE BUILDER ═══ */
let builderState={step:0,answers:{},selectedIds:[],routineData:null,prodSearchQuery:''};
/* ═══ MY ROUTINE state — tracks which saved routine is currently displayed ═══ */
let myRoutineState={selectedId:null};
function getCurrentRoutineId(){try{return localStorage.getItem('gp_current_routine_id')||null;}catch(e){return null;}}
function setCurrentRoutineId(id){try{localStorage.setItem('gp_current_routine_id',id||'');}catch(e){}}
const QUIZ_STEPS=[
  {key:'skinTypes',label:'q_skin_type',multi:true,options:[{icon:'💧',key:'o_dry'},{icon:'✨',key:'o_oily'},{icon:'⚖️',key:'o_combo'},{icon:'🌸',key:'o_sensitive'},{icon:'🎯',key:'o_acneprone'},{icon:'💦',key:'o_dehydrated'},{icon:'⚡',key:'o_reactive'},{icon:'🌹',key:'o_rosacea'},{icon:'🌿',key:'o_mature'},{icon:'🛡',key:'o_barrier'},{icon:'🕳',key:'o_congested'}]},
  {key:'agingConcerns',label:'q_aging',multi:false,options:[{icon:'✅',key:'o_yes'},{icon:'❌',key:'o_no'}]},
  {key:'sensitivity',label:'q_sensitivity',multi:false,options:[{icon:'🟢',key:'o_low'},{icon:'🟡',key:'o_medium'},{icon:'🔴',key:'o_high'}]},
  {key:'acneLevel',label:'q_acne',multi:false,options:[{icon:'😊',key:'o_none'},{icon:'🔸',key:'o_occasional'},{icon:'🔴',key:'o_moderate'},{icon:'⚠️',key:'o_severe'}]},
  {key:'barrierCondition',label:'q_barrier',multi:false,options:[{icon:'✅',key:'o_healthy'},{icon:'🟡',key:'o_slightly'},{icon:'🔴',key:'o_very_damaged'},{icon:'❓',key:'o_unsure'}]},
  {key:'currentIrritation',label:'q_current_irritation',multi:false,options:[{icon:'✅',key:'o_irritation_no'},{icon:'🟡',key:'o_irritation_little'},{icon:'🔴',key:'o_irritation_yes'}]},
  {key:'activeExperience',label:'q_active_experience',multi:false,options:[{icon:'🌱',key:'o_exp_never'},{icon:'🔸',key:'o_exp_tried'},{icon:'⚡',key:'o_exp_regular'}]},
  {key:'redness',label:'q_redness',multi:false,options:[{icon:'✅',key:'o_none'},{icon:'🟡',key:'o_medium'},{icon:'🔴',key:'o_high'}]},
  {key:'goals',label:'q_goals',multi:true,options:[{icon:'🛡',key:'g_barrier'},{icon:'💧',key:'g_hydration'},{icon:'🌿',key:'g_calm'},{icon:'✨',key:'g_glow'},{icon:'🎯',key:'g_acne'},{icon:'🌓',key:'g_pih'},{icon:'🕰',key:'g_antiaging'},{icon:'💪',key:'g_elasticity'},{icon:'🔬',key:'g_texture'},{icon:'〰️',key:'g_fine_lines'},{icon:'📍',key:'g_wrinkles'},{icon:'🎨',key:'g_hyperpig'},{icon:'💎',key:'g_glass'},{icon:'🕳',key:'g_comedones'}]},
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
    <div class="prod-selection-meta">${_selectionMetaHtml()}</div>
  `;
}

// Over-selection detector — flags categories where the user stacked more than they need.
// The routine engine only uses 1–2 per slot, so extras just rotate and make picks feel random.
function _overSelectedCategories(){
  const sel=PRODUCT_DB.filter(p=>builderState.selectedIds.includes(p.id));
  const counts={};
  sel.forEach(p=>{const c=normalizedCategory(p);counts[c]=(counts[c]||0)+1;});
  const watch={cleanser:3,'oil cleanser':3,moisturizer:3,toner:3,'toner pad':3,essence:3,sunscreen:2,eye:2,'eye cream':2,mist:3,serum:4};
  const over=[];
  Object.keys(counts).forEach(c=>{const th=watch[c];if(th&&counts[c]>=th)over.push({cat:c,n:counts[c]});});
  return over.sort((a,b)=>b.n-a.n);
}
function _selectionMetaHtml(){
  const n=builderState.selectedIds.length;
  let html=`<div class="prod-selection-badge">${t('prod_selected_count')}: ${n}</div>`;
  // Over-selection nudge REMOVED (2026-07-02, Bow): routines build from ALL owned products; the engine
  // will rotate + match per night/phase (deferred engine work). No cap or "too many" message. See memory.
  // Multiple leave-on exfoliating acids (e.g. an AHA and a BHA) → explain they're split across paths, never stacked.
  const _sel=PRODUCT_DB.filter(p=>builderState.selectedIds.includes(p.id));
  const _isCl=p=>/cleanser/.test(normalizedCategory(p)||'');
  const _exf=_sel.filter(p=>hasExfoliantAcid(p)&&p.subcategory!=='spot treatment'&&!_isCl(p)&&normalizedCategory(p)!=='peeling gel');
  const _types=[...new Set(_exf.map(p=>_acidType(p)).filter(Boolean))];
  if(_exf.length>=2||_types.length>=2){
    const _names={bha:'BHA',aha:'AHA',azelaic:'Azelaic',pha:'PHA'};
    const acids=_types.map(x=>_names[x]||x).join(' + ');
    html+=`<div class="info-box amber" style="margin-top:8px;display:flex;align-items:flex-start;gap:8px"><span style="font-size:1.05em;flex-shrink:0">💡</span><div style="font-size:.8rem;line-height:1.5">${tFmt('prod_acid_split_note',{acids})}</div></div>`;
  }
  return html;
}

function handleProdSearch(val){
  builderState.prodSearchQuery=val;
  renderProductList();
}
function toggleBuilderProduct(id,el){
  const i=builderState.selectedIds.indexOf(id);
  if(i===-1){builderState.selectedIds.push(id);el.classList.add('selected');}
  else{builderState.selectedIds.splice(i,1);el.classList.remove('selected');}
  // Update selection counter + over-selection nudge without re-rendering the whole list
  const meta=document.querySelector('.prod-selection-meta');
  if(meta)meta.innerHTML=_selectionMetaHtml();
}
function generateRoutine(){builderState.step=QUIZ_STEPS.length+1;renderBuilderStep();}

/* ═══ PHASE 3 SUB-PATH INFERENCE ═══ */
// Maps quiz goals / skin types to a Phase 3 focus sub-path: 'clarity' | 'tone' | 'renew'.
// Priority (safest + highest-value first): acne / comedones / congested → clarity;
// PIH / hyperpigmentation → tone; texture / aging → renew. No clear signal → renew (legacy default).
function _inferP3Focus(a){
  const goals=(a&&a.goals)||[];
  const skinTypes=(a&&a.skinTypes)||[];
  const has=(k)=>goals.includes(t(k));
  if(has('g_acne')||has('g_comedones')||skinTypes.includes(t('o_congested'))) return 'clarity';
  if(has('g_pih')||has('g_hyperpig')) return 'tone';
  if(has('g_texture')||has('g_antiaging')||has('g_fine_lines')||has('g_wrinkles')) return 'renew';
  return 'renew';
}

/* ═══ ENTRY ASSESSMENT PLACEMENT ═══ */
// Computes the appropriate starting phase based on quiz answers.
// Safety guards always take priority; scoring system handles nuanced cases.
function _computeStartingPhase(a){
  const skinTypes=a.skinTypes||[];

  // ── SAFETY GUARDS (force Phase 1 regardless of score) ──────────────────────
  if(a.barrierCondition===t('o_very_damaged'))          return 'p1';
  if(a.currentIrritation===t('o_irritation_yes'))       return 'p1';
  if(a.redness===t('o_high'))                            return 'p1';
  if(a.acneLevel===t('o_severe'))                        return 'p1';
  if(skinTypes.includes(t('o_reactive')))                return 'p1';

  // ── SCORING ─────────────────────────────────────────────────────────────────
  let score=0;

  // Barrier health — most important signal
  if(a.barrierCondition===t('o_healthy'))               score+=3;
  else if(a.barrierCondition===t('o_unsure'))           score+=1;
  else                                                   score-=2; // slightly damaged

  // Sensitivity level
  if(a.sensitivity===t('o_low'))                        score+=2;
  else if(a.sensitivity===t('o_medium'))                score+=1;
  else                                                   score-=2; // high

  // Current irritation
  if(a.currentIrritation===t('o_irritation_no'))        score+=2;
  else if(a.currentIrritation===t('o_irritation_little'))score+=0;
  // yes already caught by safety guard above

  // Redness
  if(a.redness===t('o_none'))                           score+=1;
  else if(a.redness===t('o_medium'))                    score+=0;
  else                                                   score-=2; // high (not caught above = medium-high)

  // Active experience — key differentiator for Phase 3
  if(a.activeExperience===t('o_exp_regular'))           score+=3;
  else if(a.activeExperience===t('o_exp_tried'))        score+=1;
  // never = 0

  // Skin type modifiers
  if(skinTypes.includes(t('o_sensitive')))              score-=1;
  if(skinTypes.includes(t('o_barrier')))                score-=2;

  // Acne severity modifier
  if(a.acneLevel===t('o_moderate')||a.acneLevel===t('o_severe')) score-=1;

  // ── PLACEMENT ────────────────────────────────────────────────────────────────
  // Phase 3: requires BOTH regular active experience AND a high stability score.
  // Score alone is not enough — retinal/AHA should only go to users already familiar with actives.
  if(score>=7 && a.activeExperience===t('o_exp_regular')) return 'p3';
  // Phase 2: stable enough to skip barrier repair (score ≥ 3)
  if(score>=3) return 'p2';
  // Phase 1: everything else — barrier repair first
  return 'p1';
}

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
  rd.phases=(_needsAA||_hasActives)?4:2;   // Maintenance-for-all: any routine with a treatment track ends at P4 Maintenance (not aging-gated)
  // P4 maintenance focus from the user's dominant goal (was always defaulting to 'aging')
  if(!rd.p4Focus){
    const _g=rd.answers.goals||[];
    const _has=k=>_g.includes(t(k));
    if(_needsAA) rd.p4Focus='aging';
    else if(_has('g_barrier')||_has('g_calm')||rd.answers.sensitivity===t('o_high')||rd.answers.barrierCondition===t('o_very_damaged')||rd.answers.barrierCondition===t('o_slightly')) rd.p4Focus='barrier';
    else rd.p4Focus='glow';   // glow = general radiance + clarity/spot maintenance (covers glow/glass/pigment/acne)
  }
  // Entry assessment — compute and persist the starting phase
  if(!rd.startingPhase) rd.startingPhase=_computeStartingPhase(rd.answers);
  // Never place beyond the routine's phase count (e.g. p3 when only 2 phases)
  const _phaseNums={'p1':1,'p2':2,'p3':3,'p4':4};
  if((_phaseNums[rd.startingPhase]||1)>rd.phases) rd.startingPhase='p'+(rd.phases);
  builderState.routineData=rd;

  // Render the full result body + recommendations + personalised emergency + builder action buttons
  c.innerHTML=`
    ${renderRoutineResultBody(rd, true)}
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
  if(pid==='p3'){
    const focus=data.p3Focus||(data._answersWithDayProducts&&data._answersWithDayProducts._p3Focus)||'renew';
    // #3 sub-type gating — read the ACTIVE focus's 2b sub-types (empty array → identical to prior behavior).
    const _fs=(data._answersWithDayProducts&&data._answersWithDayProducts._focusSubtype)||{};
    const _st=_fs[focus]||[]; const _has=(k)=>_st.indexOf(k)!==-1;
    // Clarity — BHA-led for acne/clogged pores. Retinal-free. Suppress physical peel on ACTIVE inflamed acne (irritation).
    if(focus==='clarity')return{bha:data.bha,retinal:false,aha:data.ahaBHA||data.ahaAZ||data.aha,peel:(_has('active')?false:data.peel)};
    // Even Tone — PIE (vascular) & melasma need CALMING, not exfoliation (SKINCARE_RESEARCH §2):
    // azelaic-only, suppress AHA / retinal / physical peel to avoid prolonging redness / rebound.
    if(focus==='tone'){
      if(_has('pie')||_has('melasma'))return{bha:false,retinal:false,aha:data.ahaAZ||false,peel:false};
      return{bha:data.bha,retinal:false,aha:data.ahaAZ||data.ahaAHA||data.aha,peel:false};
    }
    // renew (default) → full Phase 3 actives below (paced retinal). Any exfoliant.
  }
  if(pid==='p4'){
    const focus=data.p4Focus||'aging';
    if(focus==='barrier')return{bha:false,retinal:false,aha:false,peel:false};
    // Glow — AHA for radiance/texture. Aging — AHA texture + paced retinal.
    if(focus==='glow')return{bha:data.bha,retinal:false,aha:data.ahaAHA||data.ahaAZ||data.aha,peel:false};
    if(focus==='aging')return{bha:data.bha,retinal:data.retinalProd,aha:data.ahaAHA||data.aha,peel:data.peel};
  }
  return{bha:data.bha,retinal:data.retinalProd,aha:data.aha,peel:data.peel};
}

/* Pure renderer — turns a routineData object into the full result HTML.
   Used by BOTH the Routine Builder (after generation) AND My Routine (saved view).
   This is what guarantees a saved routine displays identically to a freshly-built one.
   Uses the Glowphase safety layer (normalizedCategory + isSunscreenProduct + prodEmoji)
   so mislabeled sunscreens are still placed in the SPF slot and no "undefined" icons render. */
function renderRoutineResultBody(rd, _recordUsage, _asParts){
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
  // Deterministic best-fit picker for slots that previously used raw database order (.find()).
  // Identical scoring + tie-break to bestByCategory: highest scoreProductForUser(p,a), ties within
  // 2 pts resolved by _varSeed (routine id) — no randomness, one product, stable across re-renders.
  const _bestFit=(cands)=>{
    if(!cands||!cands.length)return null;
    if(cands.length===1)return cands[0];
    const scored=cands.map(p=>({p,s:scoreProductForUser(p,a)})).sort((x,y)=>y.s-x.s);
    const topScore=scored[0].s;
    const tier=scored.filter(x=>x.s>=topScore-2);
    return tier[_varSeed%tier.length].p;
  };
  // Oil/balm cleanser first (best-fit), then 'oil cleanser' category, then any cleanser — each rung best-fit, not database order.
  const c1=_bestFit(selected.filter(p=>p.subcategory==='cleansing balm'||p.subcategory==='cleansing oil'))||_bestFit(selected.filter(p=>normalizedCategory(p)==='oil cleanser'||p.subcategory==='oil cleanser'))||_bestFit(selected.filter(p=>normalizedCategory(p)==='cleanser'||p.subcategory==='cleanser'));
  // Water cleanser second (best-fit), excluding whatever c1 resolved to — preserves oil/balm-first separation and no duplication.
  const c2=_bestFit(selected.filter(p=>p.category==='cleanser'&&p.subcategory!=='cleansing balm'&&p.subcategory!=='cleansing oil'&&p!==c1));
  // Toner slot: regular toners + non-exfoliating toner pads (hydrating/calming pads)
  // Exfoliating toner pads (BHA/AHA/PHA) are routed to the exfoliant slot below — they are NOT toners.
  const _isExfPad=p=>normalizedCategory(p)==='toner pad'&&hasExfoliantAcid(p);
  const _isTonerSlotPad=p=>normalizedCategory(p)==='toner pad'&&!hasExfoliantAcid(p);
  // Toner pads must not displace a real liquid toner: only fall back to pads when no real toner is owned
  const _realToners=selected.filter(p=>normalizedCategory(p)==='toner');
  const allToners=_realToners.length?_realToners:selected.filter(p=>_isTonerSlotPad(p));
  const _safeToners=allToners.filter(p=>!hasExfoliantAcid(p));
  const toner=(()=>{if(!_safeToners.length)return allToners[0]||null;if(_safeToners.length===1)return _safeToners[0];const _tScored=_safeToners.map(p=>({p,s:scoreProductForUser(p,a)})).sort((x,y)=>y.s-x.s);const _tTop=_tScored[0].s;const _tTier=_tScored.filter(x=>x.s>=_tTop-2);return _tTier[_varSeed%_tTier.length].p;})();
  const essence=bestByCategory('essence');
  const serum=bestByCategory('serum');
  // Smart night serum: prefer calming+barrier-safe → barrier-safe → night-suitable → last resort
  const allSelectedSerums=selected.filter(p=>['serum','ampoule'].includes(normalizedCategory(p)));
  const nightSerum=(()=>{
    if(!allSelectedSerums.length)return null;
    const scored=allSelectedSerums.map(p=>({p,s:scoreProductForUser(p,a)+(isNightSuitableSerum(p)?2:0)+(isBarrierSafeProduct(p)?1:0)+(hasCalmingIngredient(p)?1:0)+(!p.daytimeOnly?0.5:0)})).sort((a,b)=>b.s-a.s);
    const topScore=scored[0].s;
    const tier=scored.filter(x=>x.s>=topScore-2);
    return tier[_varSeed%tier.length].p;
  })();
  // Dry skin: prefer rich/heavy moisturizers by boosting their score
  const moist=(()=>{
    // Moisturizer slot uses real moisturizers; gel creams are a separate optional support layer (Step 10).
    // A gel cream only becomes the moisturizer when no real moisturizer is owned.
    const _realMc=selected.filter(p=>normalizedCategory(p)==='moisturizer'||p.subcategory==='moisturizer');
    const _mc=_realMc.length?_realMc:selected.filter(p=>normalizedCategory(p)==='gel cream');
    if(!_mc.length)return null;
    if(_mc.length===1)return _mc[0];
    const scored=_mc.map(p=>({p,s:scoreProductForUser(p,a)+(isDrySkin&&isHeavyMoisturizer(p)?3:0)})).sort((x,y)=>y.s-x.s);
    const topScore=scored[0].s;
    const tier=scored.filter(x=>x.s>=topScore-2);
    return tier[_varSeed%tier.length].p;
  })();
// Sleeping masks/packs are occlusive last-step treatments — detect by category or subcategory
const sleepingPack=_bestFit(selected.filter(p=>normalizedCategory(p)==='sleeping mask'||p.subcategory==='sleeping mask'||p.subcategory==='sleeping pack'))||null;
  const mistProd=_bestFit(selected.filter(p=>normalizedCategory(p)==='mist'))||null;
  // Dedicated sunscreen category preferred first (best-fit), then any SPF-bearing product — mirrors prior priority.
  const spf=_bestFit(selected.filter(p=>normalizedCategory(p)==='sunscreen'||p.subcategory==='sunscreen'))||_bestFit(selected.filter(p=>isSunscreenProduct(p)));
  // Real device-gel category preferred first (best-fit), then any device-compatible (medicubeMode) product — mirrors prior priority.
  const deviceGel=_bestFit(selected.filter(p=>normalizedCategory(p)==='device gel'||p.subcategory==='device gel'))||_bestFit(selected.filter(p=>!!p.medicubeMode))||null;
  const eye=bestByCategory('eye')||bestByCategory('eye cream')||selected.find(p=>p.category==='eye cream'||p.subcategory==='eye cream');
  // Guard: if retinalProd or aha would point to the same product as moist,
  // null them out — a moisturizer containing retinol/AHA must not render twice
  // (once as moist, once as the active step). Use the product as moist only.
  const retinalProd=(()=>{
    const cands=selected.filter(p=>hasRetinoid(p)&&p!==moist&&p.category!=='eye cream'&&p.subcategory!=='eye cream');
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
  // Leave-on chemical exfoliant pool (toner pads incl.; excludes spot treatments, cleansers, toner-slot pads).
  // A salicylic/PHA cleanser delivers its acid during wash-off, never as a leave-on step → excluded.
  const _isCleanserType=p=>/cleanser/.test(normalizedCategory(p)||'')||/cleansing/.test((p.subcategory||'').toLowerCase());
  const _exfPool=selected.filter(p=>(hasExfoliantAcid(p)||_isExfPad(p))&&p.subcategory!=='spot treatment'&&p!==moist&&!_isTonerSlotPad(p)&&!_isCleanserType(p)&&normalizedCategory(p)!=='peeling gel');
  const _pickExf=(pool)=>{if(!pool||!pool.length)return null;const sc=pool.map(p=>({p,s:scoreProductForUser(p,a)})).sort((x,y)=>y.s-x.s);const top=sc[0].s;const tier=sc.filter(x=>x.s>=top-2);return tier[_varSeed%tier.length].p;};
  const aha=_pickExf(_exfPool);
  // Acid-type-specific picks so each sub-path features the right acid (Clarity→BHA, Even Tone/P4→AHA).
  // A user who owns BOTH an AHA and a BHA then gets both used — on their matching paths — instead of one dropped.
  const _ahaBHA=_pickExf(_exfPool.filter(p=>_acidType(p)==='bha'));
  const _ahaAHA=_pickExf(_exfPool.filter(p=>_acidType(p)==='aha'));
  const _ahaAZ=_pickExf(_exfPool.filter(p=>_acidType(p)==='azelaic'));
  // Peeling gels resolve to 'peeling gel' category — treat as exfoliant in routine
  // Step 3 peel slot = PHYSICAL exfoliation only (peeling gel / gommage). Chemical exfoliants (AHA/BHA/PHA, incl. category 'exfoliant') flow to the AHA/BHA active step instead.
  const peel=selected.find(p=>normalizedCategory(p)==='peeling gel');
  // Pre-compute per-day toner/essence/serum for each phase plan using selectBestForDay().
  // This drives day-by-day product rotation: Mon–Sun each score independently by phase type,
  // so users see a variety of their suitable products across the week rather than the same pick daily.
  // moist is intentionally kept fixed — one consistent moisturizer per routine, no duplication or stacking.
  const _dpDayKeys=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  // Day-rotation toner pool excludes exfoliating pads (those rotate through exfoliant slot)
  const _dpTonerCands=_safeToners.length?_safeToners:allToners.filter(p=>!_isExfPad(p));
  const _dpEssenceCands=selected.filter(p=>normalizedCategory(p)==='essence'||p.subcategory==='essence');
  const _dpSerumCands=selected.filter(p=>['serum','ampoule'].includes(normalizedCategory(p)));
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
  // Include p4Focus so renderPhase can pick the right day plan
  const _p4FocusInit=rd.p4Focus||'aging';
  // Phase 3 sub-path: use saved focus if present, else auto-infer from goals. Persist it for later renders.
  const _p3FocusInit=rd.p3Focus||_inferP3Focus(a);
  rd.p3Focus=_p3FocusInit;
  // Live barrier signal from the Weekly Skin Check (latest score within 3 days + recovery-mode flag),
  // passed into renderPhase so Phase 2+ suppression follows the weekly check instead of the day-one quiz.
  const _inRecoveryMode=!!rd.inRecoveryMode;
  const _recentWscScore=(()=>{const h=rd.wscHistory;if(!h||!h.length)return null;const last=h[h.length-1];const THREE_DAYS=3*24*60*60*1000;if(!last||!last.date||(Date.now()-new Date(last.date).getTime())>THREE_DAYS)return null;return last.score;})();
  // Daily Skin Check: resolve tonight's adjustment ONLY if an answer was logged for today.
  // Recomputed each evening; a new day with no answer → null → routine renders normally.
  const _dscTonight=(()=>{const dt=rd.dscToday;if(!dt||dt.date!==_getTodayDate())return null;return _dscResolve(dt.reactivity,dt.q2);})();
  const _answersWithDayProducts=Object.assign({},a,{_dayProducts,_p4Focus:_p4FocusInit,_p3Focus:_p3FocusInit,_inRecoveryMode,_recentWscScore,_dscTonight,_addedFocus:(rd.addedFocus||[]),_focusSubtype:(rd.focusSubtype||{})});
  const numPhases=rd.phases||(needsAntiAging?4:(hasActives?3:2));
  const phaseIds=['p1','p2','p3','p4'].slice(0,numPhases);
  // Entry assessment — determine starting phase
  const _startPid=rd.startingPhase&&phaseIds.includes(rd.startingPhase)?rd.startingPhase:'p1';
  // ── Activate the existing rotation memory (no scoring change) ──────────────────
  // Record the toner/essence/serum actually placed in this week's ACTIVE-phase rotation, so the
  // already-present _gpRotPenalty recency penalty starts working on future generations. Only runs
  // on a fresh BUILD (_recordUsage=true from renderRoutineResult). Saved-view / re-render callers
  // pass nothing → no record → a saved routine still displays identically each time it is opened.
  if(_recordUsage){
    try{
      const _rotWeek=_dayProducts[_startPid]||{};
      const _rotSeen=new Set();
      _dpDayKeys.forEach(d=>{
        const _rd=_rotWeek[d];
        if(_rd){[_rd.toner,_rd.essence,_rd.serum].forEach(pr=>{
          if(pr&&pr.id&&!_rotSeen.has(pr.id)){_rotSeen.add(pr.id);_gpRotMarkUsed(pr);}
        });}
      });
    }catch(_e){/* rotation memory is best-effort; never block render */}
  }
  // Actives available in the starting phase
  const _startBha=_startPid!=='p1'?bha:null;
  const _startRetinal=(_startPid==='p3'||_startPid==='p4')?retinalProd:null;
  const _startAha=(_startPid==='p3'||_startPid==='p4')?aha:null;
  const _startPeel=(_startPid==='p3'||_startPid==='p4')?peel:null;
  // Placement banner text
  const _eaBannerKey='ea_banner_'+_startPid;
  const _eaBanner=_startPid!=='p1'?`<div class="info-box" style="margin-bottom:14px;background:linear-gradient(135deg,rgba(174,239,255,0.18),rgba(221,244,255,0.22));border:1.5px solid rgba(142,200,219,0.4);display:flex;align-items:flex-start;gap:10px"><span style="font-size:1.2em;flex-shrink:0">🎯</span><div><strong>${t(_eaBannerKey+'_title')}</strong><div style="font-size:.82rem;color:#5E6E76;margin-top:3px;line-height:1.5">${t(_eaBannerKey+'_body')}</div></div></div>`:'';
  const conflicts=detectConflicts(selected);
  const analyses=analyzeRoutine(selected,a);

  // Store all computed params keyed by cardId so switchRoutinePhase/selectDay can re-render
  // without recomputing products from scratch. Only one phase + one day panel live in DOM at once.
  const cardId='gc-'+(rd.id||'draft');
  if(!window._glowPhaseData)window._glowPhaseData={};
  window._glowPhaseData[cardId]={
    selected,c1,c2,toner,essence,nightSerum,moist,deviceGel,usesDevice,
    bha,retinalProd,aha,ahaBHA:_ahaBHA,ahaAHA:_ahaAHA,ahaAZ:_ahaAZ,peel,isMature,isHighSens,isBarrierHealthy,
    eye,sleepingPack,mistProd,_answersWithDayProducts,numPhases,phaseIds,_startPid
  };
  // Route the starting-phase actives through _getPhaseActives so the first paint matches tab-switch re-renders
  // (acid-type-aware exfoliant included). _startBha/_startAha below remain for any legacy references.
  const _sa=_getPhaseActives(window._glowPhaseData[cardId],_startPid);
  // ── MY ROUTINE REDESIGN: return named section parts for the tabbed shell ──
  // (default path below is unchanged — the Builder result view still gets the full card string)
  if(_asParts){
    const _hdr=`<div class="builder-step-hd"><div class="step-badge">✓</div><div><div class="step-title">${rd.name||t('result_name_default')}</div><div class="step-sub">${tFmt('result_based_on',{n:selected.length})}</div></div></div>${isMature?`<div class="info-box blue" style="margin-bottom:14px">🌿 <strong>${t('result_mature_label')}</strong> ${t('result_mature_body')}</div>`:''}`;
    const _analyses=`<div class="analysis-wrap">${analyses.map(an=>`<div class="analysis-item"><div class="a-head ${an.type}">${an.icon} ${an.title}</div><div class="a-body">${an.body}</div></div>`).join('')}${conflicts.length?`<div class="analysis-item"><div class="a-head danger">⚠️ ${t('analysis_conflicts')}</div><div class="a-body">${conflicts.map(x=>`<div style="margin-bottom:5px">🚫 <strong>${x.combo}</strong> — ${t(x.reasonKey)}</div>`).join('')}</div></div>`:`<div class="analysis-item"><div class="a-head ok">✅ ${t('analysis_ok')}</div><div class="a-body">${t('result_no_conflict_body')}</div></div>`}</div>`;
    const _morning=renderMorningPhases(selected,toner,essence,serum,moist,spf,c1,c2,isHighSens,eye,a,mistProd);
    const _phaseDots={p1:'#4FB8D6',p2:'#2FB0D8',p3:'#9B86E0',p4:'#8AA4B4'};
    const _phaseNav=`<div class="mrr-sellabel">${t('myr_phase_label')}</div><div class="phase-nav mrr-phasenav" id="routine-phase-nav">${phaseIds.map((pid)=>`<button class="phase-tab mrr-pbtn pa-${pid} ${pid===_startPid?'active':''}" data-phase="${pid}" onclick="mrrPhaseTab('${pid}',this)"><span class="mrr-pdot" style="background:${_phaseDots[pid]}"></span>${t('myr_ph'+pid.replace('p',''))}</button>`).join('')}</div>`;
    const _area=`<div class="active-phase-area">${renderPhase(_startPid,selected,c1,c2,toner,essence,nightSerum,moist,deviceGel,usesDevice,_sa.bha,_sa.retinal,_sa.aha,_sa.peel,isMature,isHighSens,'active',_startPid==='p1'&&isBarrierHealthy,eye,sleepingPack,_answersWithDayProducts,mistProd,'Mon')}</div>`;
    const _eve=`<div class="mrr-evening">${_phaseNav}<div class="mrr-steps-wrap"><div class="mrr-stepslock"></div>${_area}</div></div>`;
    const _morn=`<div class="mrr-morning" style="display:none">${_morning}</div>`;
    const _toggle=`<div class="mrr-toggle"><button class="mrr-seg" onclick="mrrToggle(this,'morn')">☀️ ${t('myr_toggle_morning')}</button><button class="mrr-seg active" onclick="mrrToggle(this,'eve')">🌙 ${t('myr_toggle_evening')}</button></div>`;
    const _card=`<div class="builder-card mrr-card-accent pa-${_startPid}" data-card-id="${cardId}">${_hdr}${_eaBanner}${_toggle}${_morn}${_eve}</div>`;
    return { cardId, card:_card, analyses:_analyses };
  }
  return `
    <div class="builder-card" data-card-id="${cardId}">
      <div class="builder-step-hd"><div class="step-badge">✓</div><div><div class="step-title">${rd.name||t('result_name_default')}</div><div class="step-sub">${tFmt('result_based_on',{n:selected.length})}</div></div></div>
      ${isMature?`<div class="info-box blue" style="margin-bottom:14px">🌿 <strong>${t('result_mature_label')}</strong> ${t('result_mature_body')}</div>`:''}
      <div class="analysis-wrap">${analyses.map(an=>`<div class="analysis-item"><div class="a-head ${an.type}">${an.icon} ${an.title}</div><div class="a-body">${an.body}</div></div>`).join('')}${conflicts.length?`<div class="analysis-item"><div class="a-head danger">⚠️ ${t('analysis_conflicts')}</div><div class="a-body">${conflicts.map(x=>`<div style="margin-bottom:5px">🚫 <strong>${x.combo}</strong> — ${t(x.reasonKey)}</div>`).join('')}</div></div>`:`<div class="analysis-item"><div class="a-head ok">✅ ${t('analysis_ok')}</div><div class="a-body">${t('result_no_conflict_body')}</div></div>`}</div>
      ${_eaBanner}
      <div class="info-box rose" style="margin-bottom:6px;font-weight:600">${t('morning_routine')} — ${t('result_daily_every_day')}</div>
      ${renderMorningPhases(selected,toner,essence,serum,moist,spf,c1,c2,isHighSens,eye,a,mistProd)}
      <div class="info-box" style="margin-top:18px;margin-bottom:6px;font-weight:600">${t('night_routine')}</div>
      <div class="phase-nav" id="routine-phase-nav">${phaseIds.map((pid)=>`<button class="phase-tab ${pid===_startPid?'active':''}" data-phase="${pid}" onclick="switchRoutinePhase('${pid}',this)">${tFmt('result_phase_label',{n:pid.replace('p','')})}</button>`).join('')}</div>
      <div class="active-phase-area">${renderPhase(_startPid,selected,c1,c2,toner,essence,nightSerum,moist,deviceGel,usesDevice,_sa.bha,_sa.retinal,_sa.aha,_sa.peel,isMature,isHighSens,'active',_startPid==='p1'&&isBarrierHealthy,eye,sleepingPack,_answersWithDayProducts,mistProd,'Mon')}</div>
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
    ${barrierToner?bs('n',prodEmoji(barrierToner),barrierToner.brand,barrierToner.name,normalizedCategory(barrierToner)==='toner pad'?t('morning_toner_pad_note'):t('morning_toner_note')):''}
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
    ${morningToner?ns('n',prodEmoji(morningToner),morningToner.brand,morningToner.name,normalizedCategory(morningToner)==='toner pad'?t('morning_toner_pad_note'):t('morning_toner_note')):''}
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
    ${waterCleanse?mns('n',prodEmoji(waterCleanse),waterCleanse.brand,waterCleanse.name,t('morning_makeup_cleanser_note')):mns('re','💧','',t('water_rinse'),t('morning_water_rinse_makeup_note'))}
    ${morningToner?mns('n',prodEmoji(morningToner),morningToner.brand,morningToner.name,normalizedCategory(morningToner)==='toner pad'?t('morning_toner_pad_note'):t('morning_toner_note')):''}
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

// Returns the last WSC score (0-8) if completed within 3 days, else null
function _getRecentWscScore(btn){
  try{
    const card=btn?btn.closest('.builder-card'):null;
    if(!card)return null;
    const cardId=card.dataset.cardId;
    if(!cardId||cardId==='gc-draft')return null;
    const routineId=cardId.replace('gc-','');
    const r=getSavedRoutines().find(function(x){return x.id===routineId;});
    if(!r||!r.wscHistory||!r.wscHistory.length)return null;
    const last=r.wscHistory[r.wscHistory.length-1];
    const THREE_DAYS=3*24*60*60*1000;
    if(!last||!last.date||(Date.now()-new Date(last.date).getTime())>THREE_DAYS)return null;
    return last.score;
  }catch(e){return null;}
}

function switchRoutinePhase(pid,btn){
  // Only gate forward progression (p2, p3, p4)
  if(pid==='p2'||pid==='p3'||pid==='p4'){
    const recentScore=_getRecentWscScore(btn);

    if(recentScore!==null&&recentScore<=2){
      // Recent WSC was great — skip gate, show graduation directly
      const card=btn?btn.closest('.builder-card'):null;
      const phasePanel=card?card.querySelector('.phase-panel'):null;
      const fromPid=phasePanel?phasePanel.dataset.pid:null;
      const _phaseOrder={p1:1,p2:2,p3:3,p4:4};
      const isForward=fromPid&&(_phaseOrder[pid]||0)>(_phaseOrder[fromPid]||0);
      const isRecoveryReturn=!!(_sbState.cardId&&_sbState.originalPid===pid);
      if(isForward||isRecoveryReturn){
        showGraduation(fromPid,pid,isRecoveryReturn,function(){_doSwitchRoutinePhase(pid,btn);});
      } else {
        _doSwitchRoutinePhase(pid,btn);
      }
      return;
    }

    if(recentScore!==null&&recentScore>=3&&recentScore<=5){
      // Recent WSC showed mild concern — show single caution screen, no questions
      _showWscCautionGate(pid,btn);
      return;
    }

    // No recent WSC or score ≥ 6 — run full gate
    openSkinGate(pid,btn);
    return;
  }
  _doSwitchRoutinePhase(pid,btn);
}

// Single-screen caution gate when WSC score was 3-5
function _showWscCautionGate(pid,btn){
  const box=document.getElementById('skin-gate-box');
  if(!box){openSkinGate(pid,btn);return;}
  _sgState.targetPid=pid;
  _sgState.targetBtn=btn;
  box.innerHTML=`
    <div>
      <div class="sg-header" style="padding:0 0 18px">
        <div class="sg-phase-badge">🌿 ${t(pid==='p2'?'sg_badge_p2':pid==='p3'?'sg_badge_p3':'sg_badge_p4')}</div>
        <div class="sg-title">${t('sg_wsc_caution_title')}</div>
        <div class="sg-subtitle">${t('sg_wsc_caution_msg')}</div>
      </div>
      <div class="sg-footer" style="position:static">
        <button class="sg-btn-check" onclick="sgProceed()">${t('sg_wsc_caution_proceed')}</button>
        <button class="sg-btn-skip" onclick="closeSkinGate()">${t('sg_wsc_caution_stay')}</button>
      </div>
    </div>`;
  document.getElementById('skin-gate-modal').classList.add('open');
}

function _doSwitchRoutinePhase(pid,btn){
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
  // Re-apply amount guides and wait chips to newly rendered steps, then reflow into sidebar+detail
  setTimeout(function(){enhanceRoutineSteps();if(typeof _mrrReflowAll==='function')_mrrReflowAll();},0);
  // Auto-save active phase — no user action needed
  _gpAutoSavePhaseState(cardId,pid,false);
  // My Routine redesign: an actual switch (incl. a gate pass) unlocks the phase + refreshes chrome.
  try{
    if(!window._mrrUnlock)window._mrrUnlock={};
    window._mrrUnlock[cardId+'|'+pid]=1;
    var _mp=document.getElementById('page-myroutine');
    if(_mp&&_mp.classList.contains('active')&&card.querySelector('.mrr-steps-wrap'))_mrrUpdateChrome(card,pid,false);
  }catch(_e){}
}

/* ═══ PHASE 4 FOCUS ═══ */
function switchP4Focus(focus,btn){
  const card=btn?btn.closest('.builder-card'):null;
  if(!card)return;
  const cardId=card.dataset.cardId;
  const data=window._glowPhaseData&&window._glowPhaseData[cardId];
  if(!data)return;

  // Update runtime state
  data.p4Focus=focus;
  // Propagate to answers so renderPhase picks up the new plan
  if(data._answersWithDayProducts)data._answersWithDayProducts._p4Focus=focus;

  // Save focus to localStorage
  const routineId=cardId.replace('gc-','');
  const routines=getSavedRoutines();
  const idx=routines.findIndex(function(r){return r.id===routineId;});
  if(idx!==-1){routines[idx].p4Focus=focus;setSavedRoutines(routines);}

  // Update focus tab active state
  card.querySelectorAll('.p4focus-tab').forEach(function(b){b.classList.remove('active');});
  if(btn)btn.classList.add('active');

  // Update focus description text
  const descEl=card.querySelector('.p4focus-desc');
  if(descEl)descEl.textContent=t('p4focus_'+focus+'_desc');

  // Re-render the active phase with new focus actives + plan
  const pa=_getPhaseActives(data,'p4');
  const phaseArea=card.querySelector('.active-phase-area');
  if(!phaseArea)return;
  phaseArea.innerHTML=renderPhase(
    'p4',data.selected,data.c1,data.c2,
    data.toner,data.essence,data.nightSerum,data.moist,
    data.deviceGel,data.usesDevice,
    pa.bha,pa.retinal,pa.aha,pa.peel,
    data.isMature,data.isHighSens,'active',false,
    data.eye,data.sleepingPack,data._answersWithDayProducts,data.mistProd,data.selectedDay||'Mon'
  );
  // Sub-path switch re-renders the area with RAW steps — must reflow into the compact
  // sidebar+detail card (and re-anchor the lock overlay) like phase/day switches do,
  // otherwise the locked overlay covers the whole tall raw step list.
  setTimeout(function(){
    enhanceRoutineSteps();
    if(typeof _mrrReflowAll==='function')_mrrReflowAll();
    if(typeof _mrrPositionLock==='function' && card.querySelector('.mrr-steps-wrap.locked')){
      requestAnimationFrame(function(){ _mrrPositionLock(card); });
    }
  },0);
}

// 2a — which P3 sub-paths the user has a concern for (→ unlocked). Others render LOCKED.
function _p3Unlocked(a){
  a=a||{};
  var goals=((a.goals||[]).join(' ')).toLowerCase();
  var types=((a.skinTypes||[]).join(' ')).toLowerCase();
  var acne=(a.acneLevel||'').toLowerCase();
  var aging=(a.agingConcerns||'').toLowerCase();
  var clarity = (acne && acne.indexOf('none')===-1) || /acne|oily|congest|combinat/.test(types) || /acne|clarity|breakout|pore|congest|blemish/.test(goals);
  var tone    = /even tone|bright|dark spot|dark mark|pigment|hyperpig|glow|radian|dull/.test(goals);
  var renew   = (aging.indexOf('yes')!==-1) || /aging|age|texture|firm|line|wrinkle|smooth|elastic|renew/.test(goals);
  return {clarity:!!clarity, tone:!!tone, renew:!!renew};
}
// 2a — tap a LOCKED sub-path: first ask which sub-type of the concern (2b popup), THEN commit.
// The btn ref stays valid because nothing re-renders until _gp2aCommitUnlock runs switchP3Focus.
function gp2aUnlock(focus,btn){
  if(!btn)return;
  if(typeof _GP2B_TYPES==='object' && _GP2B_TYPES[focus]){ gp2bOpen(focus,btn); return; }
  _gp2aCommitUnlock(focus,btn,[]);
}
// 2a commit — PERSIST the added concern (+ its 2b sub-types) on the routine (stays across reloads),
// keep the render bundle in sync, then switch focus (re-picks the products for that focus).
// `subtypes` = ARRAY of selected sub-type keys (a user can have several — e.g. PIH + PIE).
function _gp2aCommitUnlock(focus,btn,subtypes){
  if(!btn)return;
  var subs=Array.isArray(subtypes)?subtypes:(subtypes?[subtypes]:[]);
  var card=btn.closest('.builder-card[data-card-id]');
  var cardId=card?card.dataset.cardId:'';
  var rid = cardId ? cardId.replace('gc-','') : (localStorage.getItem('gp_current_routine_id')||'');
  // 1) persist on the routine so it stays unlocked across reloads
  if(rid && typeof getSavedRoutines==='function'){
    var rs=getSavedRoutines(); var i=rs.findIndex(function(x){return x.id===rid;});
    if(i!==-1){ var af=rs[i].addedFocus||[]; if(af.indexOf(focus)===-1)af.push(focus);
      rs[i].addedFocus=af;
      if(subs.length){ var fs=rs[i].focusSubtype||{}; fs[focus]=subs; rs[i].focusSubtype=fs; }
      if(typeof setSavedRoutines==='function')setSavedRoutines(rs); }
  }
  // 2) keep the in-session render bundle in sync (switchP3Focus re-renders the tabs from it)
  var data=(cardId&&window._glowPhaseData)?window._glowPhaseData[cardId]:null;
  if(data&&data._answersWithDayProducts){ var b=data._answersWithDayProducts;
    var af2=b._addedFocus||[]; if(af2.indexOf(focus)===-1)af2.push(focus); b._addedFocus=af2;
    if(subs.length){ var fs2=b._focusSubtype||{}; fs2[focus]=subs; b._focusSubtype=fs2; } }
  // 3) switch focus to it (re-picks products + re-renders tabs → now unlocked)
  if(typeof switchP3Focus==='function') switchP3Focus(focus,btn);
}
// 2b — sub-type popup. Asks which kind of the concern so the engine (concern→active map) can pick
// the right active. The pick is stored on the routine as focusSubtype[focus], then unlock commits.
var _GP2B_TYPES={
  tone:['pih','pie','melasma','sunspot','dullness'],
  clarity:['active','clogged','oil','texture'],
  renew:['lines','firmness','texture','radiance']
};
function _gp2bContent(focus){
  function L(en,th){return (typeof _mrrL==='function')?_mrrL(en,th):en;}
  var C={
    tone:{title:L('Even Tone','ผิวสม่ำเสมอ'),
      sub:L('Which of these do you have? This helps us pick the right brightening actives — and skip the wrong ones.','คุณมีอาการไหนบ้าง? ช่วยให้เราเลือกสารช่วยเรื่องผิวได้ถูก'),
      opts:[
        ['pih',L('Brown marks (PIH)','รอยสีน้ำตาล (PIH)'),L('Flat brown or tan spots left after a breakout heals','รอยแบนสีน้ำตาลหลังสิวหาย')],
        ['pie',L('Red marks (PIE)','รอยแดง (PIE)'),L('Flat pink or red marks where a spot used to be','รอยแดง/ชมพูตรงที่เคยเป็นสิว')],
        ['melasma',L('Larger patches (melasma)','ฝ้า (melasma)'),L('Symmetrical brown–grey patches, often cheeks or forehead','ปื้นสีน้ำตาลเทา มักที่แก้มหรือหน้าผาก')],
        ['sunspot',L('Sun spots','จุดกระแดด'),L('Small defined brown spots from sun exposure','จุดน้ำตาลเล็กจากแดด')],
        ['dullness',L('Overall dullness','ผิวหมองคล้ำ'),L('No distinct spots — skin just looks tired or uneven','ไม่มีจุดชัด ผิวดูหมองหรือไม่สม่ำเสมอ')]
      ]},
    clarity:{title:L('Clarity','เคลียร์ผิว'),
      sub:L('What are you mainly dealing with? This tunes the exfoliant and treatment.','ปัญหาหลักคืออะไร? ช่วยปรับตัวผลัดผิวและทรีตเมนต์')
,
      opts:[
        ['active',L('Active breakouts','สิวอักเสบ'),L('Current pimples, whiteheads or inflamed spots','สิว หัวขาว หรือสิวอักเสบที่เป็นอยู่')],
        ['clogged',L('Clogged pores & blackheads','รูขุมขนอุดตัน & สิวหัวดำ'),L('Congestion and blackheads, not much redness','การอุดตันและสิวหัวดำ ไม่ค่อยแดง')],
        ['oil',L('Oil & shine','ความมัน'),L('Excess sebum, midday shine, enlarged pores','ผิวมัน รูขุมขนกว้าง')],
        ['texture',L('Bumpy texture','ผิวไม่เรียบ'),L('Rough or bumpy skin, closed comedones','ผิวสาก/เป็นตุ่ม สิวอุดตันหัวปิด')]
      ]},
    renew:{title:L('Texture & Aging','ผิวเรียบเนียน & ริ้วรอย'),
      sub:L('What matters most to you? This sets the strength and pace of the treatment.','อะไรสำคัญที่สุด? ช่วยตั้งความแรงและจังหวะของทรีตเมนต์'),
      opts:[
        ['lines',L('Fine lines & wrinkles','ริ้วรอย'),L('Early lines, expression creases','ริ้วรอยเริ่มแรก รอยพับจากการแสดงสีหน้า')],
        ['firmness',L('Firmness & elasticity','ความกระชับ'),L('Skin feels less bouncy or firm','ผิวหย่อนคล้อย ไม่กระชับ')],
        ['texture',L('Rough texture','ผิวสาก'),L('Uneven surface, roughness, large pores','ผิวไม่เรียบ สาก รูขุมขนกว้าง')],
        ['radiance',L('Radiance','ผิวกระจ่างใส'),L('Mainly want smoother, more glowing skin','อยากให้ผิวเนียนและกระจ่างใสขึ้น')]
      ]}
  };
  return C[focus]||null;
}
function gp2bClose(){var o=document.getElementById('gp2b-ov');if(o)o.remove();window._gp2bPending=null;}
function gp2bOpen(focus,btn){
  var c=_gp2bContent(focus); if(!c){_gp2aCommitUnlock(focus,btn,[]);return;}
  gp2bClose(); // clears any prior overlay + pending FIRST, so we don't wipe what we set below
  window._gp2bPending={focus:focus,btn:btn};
  window._gp2bSel=[]; // multi-select: users can have several sub-types (e.g. PIH + PIE)
  var ov=document.createElement('div'); ov.className='gp2b-ov'; ov.id='gp2b-ov';
  ov.onclick=function(e){if(e.target===ov)gp2bClose();};
  ov.innerHTML='<div class="gp2b-modal" role="dialog" aria-modal="true"><div class="gp2b-star">✦</div>'+
    '<div class="gp2b-title">'+c.title+'</div>'+
    '<div class="gp2b-sub">'+c.sub+'</div>'+
    '<div class="gp2b-hint">'+_mrrL('Select all that apply','เลือกได้มากกว่าหนึ่ง')+'</div>'+
    '<div class="gp2b-opts">'+c.opts.map(function(o){
      return '<button type="button" class="gp2b-opt" data-k="'+o[0]+'" onclick="gp2bToggle(\''+o[0]+'\',this)">'+
        '<span class="gp2b-tick">✓</span>'+
        '<span class="gp2b-txt"><span class="gp2b-opt-name">'+o[1]+'</span>'+
        '<span class="gp2b-opt-desc">'+o[2]+'</span></span></button>';
    }).join('')+'</div>'+
    '<div class="gp2b-foot">'+
      '<button type="button" class="gp2b-proceed" onclick="gp2bProceed()">'+
        _mrrL('Proceed','ดำเนินการ')+'</button>'+
      '<button type="button" class="gp2b-unlock" onclick="gp2bJustUnlock()">'+
        _mrrL('Not sure — just unlock','ไม่แน่ใจ — ปลดล็อกเลย')+'</button>'+
    '</div>'+
    '<button type="button" class="gp2b-stay" onclick="gp2bClose()">'+
      _mrrL('Stay on current focus','คงโฟกัสเดิมไว้')+'</button>'+
    '</div>';
  document.body.appendChild(ov);
}
// 2b — "Not sure": unlock the concern but store NO sub-type (engine falls back to a general active).
function gp2bJustUnlock(){
  var p=window._gp2bPending||{}; var rid=_gp2bRidFromBtn(p.btn); gp2bClose(); window._gp2bSel=[];
  if(!p.focus||!p.btn)return;
  _gp2aCommitUnlock(p.focus,p.btn,[]);
  if(rid)setTimeout(function(){ if(typeof openTreatmentGuide==='function')openTreatmentGuide(rid); },60);
}
// 2b — toggle a sub-type on/off (multi-select).
function gp2bToggle(key,el){
  var sel=window._gp2bSel||(window._gp2bSel=[]);
  var i=sel.indexOf(key);
  if(i===-1){sel.push(key);} else {sel.splice(i,1);}
  if(el)el.classList.toggle('selected',sel.indexOf(key)!==-1);
}
// 2b — confirm: commit all selected sub-types (or none → unlock without a sub-type), then close.
function gp2bProceed(){
  var p=window._gp2bPending||{}; var sel=(window._gp2bSel||[]).slice();
  var rid=_gp2bRidFromBtn(p.btn);
  gp2bClose(); window._gp2bSel=[];
  if(!p.focus||!p.btn)return;
  _gp2aCommitUnlock(p.focus,p.btn,sel);
  if(rid)setTimeout(function(){ if(typeof openTreatmentGuide==='function')openTreatmentGuide(rid); },60);
}
function _gp2bRidFromBtn(btn){var c=btn&&btn.closest?btn.closest('.builder-card[data-card-id]'):null;return c?c.dataset.cardId.replace('gc-',''):'';}
// 2a — "Add a concern to unlock" hint: briefly draw attention to the locked tabs.
function gp2aUnlockHint(btn){
  var wrap=btn&&btn.closest('.p4focus-wrap'); if(!wrap)return;
  wrap.querySelectorAll('.gp2a-tab.locked').forEach(function(t){
    t.classList.add('gp2a-flash'); setTimeout(function(){t.classList.remove('gp2a-flash');},1400);
  });
}

/* ═══ #3 CONCERN → ACTIVE MAP + TREATMENT PLAN GUIDE ═══
   Evidence-based (see SKINCARE_RESEARCH.md): order barrier→acne→pigment→aging,
   which maps to P3 sub-paths Clarity → Even Tone → Renew. Each sub-type has a
   ranked prefer-list of actives; the guide consolidates to multi-taskers. */
var GPG_ACT={azelaic:'🎯 Azelaic acid',bha:'🔬 BHA',niacinamide:'✨ Niacinamide',retinal:'🕰 Retinal',vitc:'🍋 Vitamin C',aha:'🔬 AHA',pha:'🔬 PHA',tranexamic:'🎨 Tranexamic acid',arbutin:'🌓 Arbutin',peptides:'💪 Peptides',spf:'☀️ SPF',calming:'🌿 Centella'};
var GPG_MAP={
  clarity:{active:['azelaic','bha'],clogged:['bha','retinal','azelaic'],oil:['niacinamide','bha'],texture:['retinal','bha','azelaic']},
  tone:{pie:['niacinamide','azelaic','calming'],pih:['azelaic','retinal','vitc'],melasma:['tranexamic','azelaic','arbutin'],sunspot:['vitc','retinal','azelaic'],dullness:['vitc','pha','niacinamide']},
  renew:{lines:['retinal','peptides'],firmness:['peptides','retinal','vitc'],texture:['retinal','pha'],radiance:['vitc','pha']}
};
// avoid / hold-back per sub-type (research: PIE & melasma dislike harsh acids/retinal)
var GPG_AVOID={tone:{pie:['aha','peel','retinal'],melasma:['aha','peel','retinal']}};
var GPG_ORDER={clarity:['active','clogged','oil','texture'],tone:['pie','pih','melasma','sunspot','dullness'],renew:['lines','firmness','texture','radiance']};
var GPG_CONCERN_ORDER=['clarity','tone','renew'];
function _gpgL(en,th){return (typeof _mrrL==='function')?_mrrL(en,th):en;}
function _gpgSubLabel(k){var M={active:_gpgL('Active breakouts','สิวอักเสบ'),clogged:_gpgL('Clogged pores','รูขุมขนอุดตัน'),oil:_gpgL('Oil & shine','ความมัน'),texture:_gpgL('Rough texture','ผิวสาก'),pie:_gpgL('Red marks (PIE)','รอยแดง'),pih:_gpgL('Brown marks (PIH)','รอยสีน้ำตาล'),melasma:_gpgL('Melasma','ฝ้า'),sunspot:_gpgL('Sun spots','จุดกระแดด'),dullness:_gpgL('Dullness','ผิวหมองคล้ำ'),lines:_gpgL('Fine lines','ริ้วรอย'),firmness:_gpgL('Firmness','ความกระชับ'),radiance:_gpgL('Radiance','ผิวกระจ่างใส')};return M[k]||k;}
function _gpgConcernMeta(c){var M={
  clarity:{name:_gpgL('Clear','เคลียร์ผิว'),desc:_gpgL('breakouts & congestion','สิว & การอุดตัน'),why:_gpgL('We calm breakouts first — this also stops new marks forming.','จัดการสิวก่อน — ช่วยไม่ให้เกิดรอยใหม่')},
  tone:{name:_gpgL('Even out','ปรับผิวสม่ำเสมอ'),desc:_gpgL('marks & tone','รอย & สีผิว'),why:_gpgL('Once skin is clear, fade what\'s left — red marks calm first, then brown.','เมื่อผิวเคลียร์แล้ว ค่อยจัดการรอย — รอยแดงก่อน แล้วรอยน้ำตาล')},
  renew:{name:_gpgL('Refine','ผิวเนียน & กระจ่างใส'),desc:_gpgL('texture & glow','ผิวเรียบ & กระจ่างใส'),why:_gpgL('Last — smoothing & glow work best on calm, even skin.','ท้ายสุด — ผลลัพธ์ดีที่สุดบนผิวที่สงบและสม่ำเสมอ')}};return M[c];}
// "Not sure" fallback — derive sub-types from routine-builder answers
function _gpgDerive(a){a=a||{};var goals=((a.goals||[]).join(' ')).toLowerCase(),types=((a.skinTypes||[]).join(' ')).toLowerCase(),acne=(a.acneLevel||'').toLowerCase(),aging=(a.agingConcerns||'').toLowerCase(),b=goals+' '+types+' '+acne+' '+aging;function h(re){return re.test(b);}
  var c=[];if(h(/acne|breakout|blemish|pimple|inflam/)||/[1-9]/.test(acne))c.push('active');if(h(/congest|blackhead|clog|comedone|pore/))c.push('clogged');if(h(/oil|shine|sebum/))c.push('oil');if(h(/bumpy|rough|texture/))c.push('texture');
  var t=[];if(h(/red|redness|rosacea|erythema|\bpie\b/))t.push('pie');if(h(/dark mark|dark spot|pih|post.?acne|brown|hyperpig/))t.push('pih');if(h(/melasma|patch/))t.push('melasma');if(h(/sun spot|freckle|uv spot/))t.push('sunspot');if(h(/dull|uneven|glow|radian|bright/))t.push('dullness');
  var r=[];if(h(/line|wrinkle/))r.push('lines');if(h(/firm|elasticity|sag|bounce/))r.push('firmness');if(h(/texture|rough|smooth/))r.push('texture');if(h(/glow|radian|dull/))r.push('radiance');
  return {clarity:c,tone:t,renew:r};}
// per-concern sub-types: use stored 2b focusSubtype[concern] if present, else derived
function _gpgSubtypes(rd){var a=rd._answersWithDayProducts||rd.answers||rd||{};var der=_gpgDerive(a);var fs=rd.focusSubtype||{};var out={};
  GPG_CONCERN_ORDER.forEach(function(c){var s=(fs[c]&&fs[c].length)?fs[c].slice():(der[c]||[]);
    // keep only known keys, ordered
    out[c]=GPG_ORDER[c].filter(function(k){return s.indexOf(k)!==-1;});});
  return out;}
// show each sub-type's LEAD active (prefer[0]); dedupe identical leads (multi-tasker covers several); cap 3.
function _gpgPick(concern,subs){var m=GPG_MAP[concern]||{};var byAct={},order=[];
  subs.forEach(function(s){var hero=(m[s]||[])[0];if(!hero)return;if(!byAct[hero]){byAct[hero]={act:hero,covers:[]};order.push(hero);}byAct[hero].covers.push(s);});
  return order.slice(0,3).map(function(a){return byAct[a];});}
function _gpgBuild(rd){
  var subs=_gpgSubtypes(rd);
  var seq=GPG_CONCERN_ORDER.filter(function(c){return (subs[c]||[]).length;});
  if(!seq.length)seq=['clarity']; // safety
  var _grad=rd.concernsGraduated||[];
  var _cur=rd.p3Focus||(seq.filter(function(c){return _grad.indexOf(c)===-1;})[0])||seq[0];
  var steps=seq.map(function(concern,i){
    var s=subs[concern];
    var chips=s.map(function(k,j){return (j?'<span class="gpg-arrow">→</span>':'')+'<span class="gpg-chip'+(j===0?' first':'')+'">'+_gpgSubLabel(k)+'</span>';}).join('');
    var acts=_gpgPick(concern,s).map(function(x){return '<span class="gpg-actpill">'+GPG_ACT[x.act]+' <small>('+x.covers.map(function(k){return _gpgSubLabel(k).replace(/\s*\(.*\)/,'');}).join(', ')+')</small></span>';}).join('');
    var M=_gpgConcernMeta(concern);
    var isGrad=_grad.indexOf(concern)!==-1;
    var isNow=(concern===_cur)&&!isGrad;
    var st=isGrad?'done':(isNow?'now':'next');
    var pill=isGrad?('✓ '+_gpgL('Done','สำเร็จ')):(isNow?_gpgL('Start here','เริ่มที่นี่'):_gpgL('Next','ถัดไป'));
    return '<div class="gpg-step '+st+'"><div class="gpg-node">'+(isGrad?'✓':(i+1))+'</div><div class="gpg-card">'
      +'<div class="gpg-head"><div class="gpg-name">'+M.name+' <span>'+M.desc+'</span></div><span class="gpg-pill '+st+'">'+pill+'</span></div>'
      +'<div class="gpg-chips">'+chips+'</div>'
      +'<div class="gpg-act">'+acts+'</div>'
      +'<div class="gpg-why">'+M.why+'</div>'
      +(isNow?'<button type="button" class="gpg-setup" onclick="gpgSetup(\''+concern+'\')">'+_gpgL('Set up my '+_gpgSubLabel(s[0]).toLowerCase().replace(/\s*\(.*\)/,''),'ตั้งค่า')+' →</button>':'')
      +'</div></div>';
  }).join('');
  return '<div class="gpg-modal" role="dialog" aria-modal="true"><div class="gpg-star">✦</div>'
    +'<div class="gpg-title">'+_gpgL('Your Treatment Plan','แผนการดูแลผิวของคุณ')+'</div>'
    +'<div class="gpg-sub">'+_gpgL('The smartest order for your skin — one focus at a time, so nothing fights.','ลำดับที่ดีที่สุดสำหรับผิวคุณ — ทีละอย่าง เพื่อไม่ให้ตีกัน')+'</div>'
    +'<div class="gpg-steps">'+steps+'</div>'
    +'<div class="gpg-spf">☀️ '+_gpgL('SPF every morning — it protects every result, especially your marks.','ครีมกันแดดทุกเช้า — ปกป้องทุกผลลัพธ์ โดยเฉพาะรอย')+'</div>'
    +'<button type="button" class="gpg-done" onclick="closeTreatmentGuide()">'+_gpgL('Got it','เข้าใจแล้ว')+' ✦</button>'
    +'</div>';
}
function closeTreatmentGuide(){var o=document.getElementById('gpg-ov');if(o)o.remove();}
function openTreatmentGuide(ref){
  var rd=null,rid='';
  if(ref&&ref.closest){var card=ref.closest('.builder-card[data-card-id]');if(card)rid=card.dataset.cardId.replace('gc-','');}
  else if(typeof ref==='string'){rid=ref.replace('gc-','');}
  if(rid&&typeof getSavedRoutines==='function')rd=getSavedRoutines().find(function(x){return x.id===rid;});
  if(!rd)rd=(typeof getSavedRoutines==='function')?(getSavedRoutines().find(function(x){return x.id===(localStorage.getItem('gp_current_routine_id')||'');})||getSavedRoutines()[0]):null;
  if(!rd)return;
  window._gpgRid=rd.id;
  closeTreatmentGuide();
  var ov=document.createElement('div');ov.id='gpg-ov';ov.className='gpg-ov';
  ov.onclick=function(e){if(e.target===ov)closeTreatmentGuide();};
  ov.innerHTML=_gpgBuild(rd);
  document.body.appendChild(ov);
}
// "Set up my …" → open the 2b sub-type quiz for that concern, anchored to this routine's card
function gpgSetup(concern){
  var rid=window._gpgRid||'';var card=document.querySelector('.builder-card[data-card-id="gc-'+rid+'"]')||document.querySelector('.builder-card[data-card-id]');
  closeTreatmentGuide();
  if(card&&typeof gp2bOpen==='function')gp2bOpen(concern,card);
}
// #Progression — next concern in the roadmap (Clarity→Tone→Renew) the user HAS and hasn't graduated.
function _gpNextConcern(rd){
  if(!rd)return null;
  var a=rd._answersWithDayProducts||rd.answers||rd||{};
  var u=(typeof _p3Unlocked==='function')?_p3Unlocked(a):{};
  var added=rd.addedFocus||[]; var grad=rd.concernsGraduated||[];
  var order=['clarity','tone','renew']; var cur=rd.p3Focus||'clarity';
  var has=function(f){return !!(u[f]||added.indexOf(f)!==-1);};
  for(var i=order.indexOf(cur)+1;i<order.length;i++){ if(has(order[i])&&grad.indexOf(order[i])===-1) return order[i]; }
  return null;
}
function _gpAdvanceClose(){var o=document.getElementById('gpadv-ov');if(o)o.remove();}
// Concern-done NOTICE — never auto-advances; the user chooses. Fired after a weekly check where the
// active concern reads Controlled and a next concern exists (queued in wscSubmit, shown on closeWscSheet).
function _gpAdvanceNotice(rid,fromFocus,toFocus){
  if(!fromFocus||!toFocus||typeof _gpgConcernMeta!=='function')return;
  var fromD=_gpgConcernMeta(fromFocus), toD=_gpgConcernMeta(toFocus);
  _gpAdvanceClose();
  var ov=document.createElement('div');ov.className='gpg-ov';ov.id='gpadv-ov';
  ov.onclick=function(e){if(e.target===ov)_gpAdvanceClose();};
  ov.innerHTML='<div class="gpg-modal" style="max-width:378px;text-align:center">'
    +'<div class="gpg-star">✦</div>'
    +'<div class="gpg-title">'+_mrrL('Nice progress','คืบหน้าดีมาก')+'</div>'
    +'<div class="gpg-sub">'+_mrrL('Your '+fromD.desc+' look under control. Ready to start on your '+toD.desc+'?','ผิวส่วน'+fromD.desc+'ดูควบคุมได้แล้ว พร้อมเริ่มดูแล'+toD.desc+'ไหม?')+'</div>'
    +'<div class="gpg-foot"><button type="button" class="gpg-proceed" onclick="gpAdvanceConcern(\''+rid+'\',\''+fromFocus+'\',\''+toFocus+'\')">'+_mrrL('Move to '+toD.name,'ไปที่ '+toD.name)+' →</button></div>'
    +'<button type="button" class="gpg-stay" onclick="_gpAdvanceStay(\''+rid+'\')">'+_mrrL('Stay a bit longer','อยู่ต่ออีกสักพัก')+'</button>'
    +'</div>';
  document.body.appendChild(ov);
}
function gpAdvanceConcern(rid,fromFocus,toFocus){
  var rs=getSavedRoutines();var i=rs.findIndex(function(x){return x.id===rid;});
  if(i!==-1){var g=rs[i].concernsGraduated||[];if(g.indexOf(fromFocus)===-1)g.push(fromFocus);rs[i].concernsGraduated=g;rs[i].p3Focus=toFocus;if(rs[i].focusSubtype){} delete rs[i].advanceSnoozedLen;setSavedRoutines(rs);}
  _gpAdvanceClose();
  if(typeof renderMyRoutines==='function')renderMyRoutines();
  setTimeout(function(){if(typeof openTreatmentGuide==='function')openTreatmentGuide(rid);},320);
}
function _gpAdvanceStay(rid){
  var rs=getSavedRoutines();var i=rs.findIndex(function(x){return x.id===rid;});
  if(i!==-1){rs[i].advanceSnoozedLen=(rs[i].wscHistory||[]).length;setSavedRoutines(rs);}
  _gpAdvanceClose();
}
function switchP3Focus(focus,btn){
  const card=btn?btn.closest('.builder-card'):null;
  if(!card)return;
  const cardId=card.dataset.cardId;
  const data=window._glowPhaseData&&window._glowPhaseData[cardId];
  if(!data)return;

  // Update runtime state
  data.p3Focus=focus;
  // Propagate to answers so renderPhase picks up the new plan
  if(data._answersWithDayProducts)data._answersWithDayProducts._p3Focus=focus;

  // Save focus to localStorage
  const routineId=cardId.replace('gc-','');
  const routines=getSavedRoutines();
  const idx=routines.findIndex(function(r){return r.id===routineId;});
  if(idx!==-1){routines[idx].p3Focus=focus;setSavedRoutines(routines);}

  // Update focus tab active state (p3 tabs reuse the p4focus-tab class)
  card.querySelectorAll('.p4focus-tab').forEach(function(b){b.classList.remove('active');});
  if(btn)btn.classList.add('active');

  // Update focus description text
  const descEl=card.querySelector('.p4focus-desc');
  if(descEl)descEl.textContent=t('p3focus_'+focus+'_desc');

  // Re-render the active phase with new focus actives + plan
  const pa=_getPhaseActives(data,'p3');
  const phaseArea=card.querySelector('.active-phase-area');
  if(!phaseArea)return;
  phaseArea.innerHTML=renderPhase(
    'p3',data.selected,data.c1,data.c2,
    data.toner,data.essence,data.nightSerum,data.moist,
    data.deviceGel,data.usesDevice,
    pa.bha,pa.retinal,pa.aha,pa.peel,
    data.isMature,data.isHighSens,'active',false,
    data.eye,data.sleepingPack,data._answersWithDayProducts,data.mistProd,data.selectedDay||'Mon'
  );
  // Sub-path switch re-renders the area with RAW steps — must reflow into the compact
  // sidebar+detail card (and re-anchor the lock overlay) like phase/day switches do.
  setTimeout(function(){
    enhanceRoutineSteps();
    if(typeof _mrrReflowAll==='function')_mrrReflowAll();
    if(typeof _mrrPositionLock==='function' && card.querySelector('.mrr-steps-wrap.locked')){
      requestAnimationFrame(function(){ _mrrPositionLock(card); });
    }
  },0);
}

/* ═══ PHASE RENDER ═══ */
const DAY_PLANS={
  p1:{Mon:{type:'normal',goal:'Deep hydration + barrier sealing',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Tue:{type:'device',goal:'Device-boosted hydration',device:true,deviceModes:['booster','air'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Wed:{type:'recovery',goal:'Rest + deep repair overnight',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'normal',goal:'Hydration + soothing',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Fri:{type:'device',goal:'Booster mode hydration infusion',device:true,deviceModes:['booster'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Sat:{type:'recovery',goal:'Skin reset + moisture lock',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Sun:{type:'recovery',goal:'Full recovery + week prep',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false}},
  p2:{Mon:{type:'normal',goal:'Hydration + spot acne control',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Tue:{type:'device',goal:'PDRN device treatment for PIH',device:true,deviceModes:['mc','derma'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Wed:{type:'recovery',goal:'Recovery from device treatment',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'normal',goal:'Glow boost + hydration',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Fri:{type:'device',goal:'Booster + PDRN treatment',device:true,deviceModes:['booster','mc'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Sat:{type:'recovery',goal:'Deep moisture + skin reset',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Sun:{type:'normal',goal:'Gentle prep for next week',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false}},
  p3:{Mon:{type:'normal',goal:'Hydration + spot acne',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Tue:{type:'active',goal:'Retinal introduction — eye area only',device:false,recovery:false,bha:false,retinal:true,aha:false,peel:false},Wed:{type:'recovery',goal:'Recovery after retinal',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'device',goal:'PDRN device + optional peel',device:true,deviceModes:['mc','derma'],recovery:false,bha:false,retinal:false,aha:false,peel:true},Fri:{type:'active',goal:'Second retinal night',device:false,recovery:false,bha:false,retinal:true,aha:false,peel:false},Sat:{type:'normal',goal:'Spot acne + glow',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Sun:{type:'recovery',goal:'Full recovery night',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false}},
  // p4 is an alias — actual plan is looked up via p4Focus in renderPhase
  p4:{Mon:{type:'normal',goal:'Peptide + anti-aging hydration',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Tue:{type:'active',goal:'Retinal maintenance',device:false,recovery:false,bha:false,retinal:true,aha:false,peel:false},Wed:{type:'recovery',goal:'Recovery + barrier maintenance',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'device',goal:'Anti-aging device treatment',device:true,deviceModes:['booster','mc'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Fri:{type:'active',goal:'AHA texture refinement',device:false,recovery:false,bha:false,retinal:false,aha:true,peel:false},Sat:{type:'recovery',goal:'Collagen support recovery',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Sun:{type:'normal',goal:'Full moisturize + week prep',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false}},
  // Phase 4 focus plans
  p4_aging:{Mon:{type:'normal',goal:'Peptide + anti-aging hydration',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Tue:{type:'active',goal:'Retinal maintenance',device:false,recovery:false,bha:false,retinal:true,aha:false,peel:false},Wed:{type:'recovery',goal:'Recovery + barrier maintenance',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'device',goal:'Anti-aging device treatment',device:true,deviceModes:['booster','mc'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Fri:{type:'active',goal:'AHA texture refinement',device:false,recovery:false,bha:false,retinal:false,aha:true,peel:false},Sat:{type:'recovery',goal:'Collagen support recovery',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Sun:{type:'normal',goal:'Full moisturize + week prep',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false}},
  p4_barrier:{Mon:{type:'normal',goal:'Barrier protection + deep hydration',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Tue:{type:'device',goal:'Booster mode — hydration infusion',device:true,deviceModes:['booster','air'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Wed:{type:'recovery',goal:'Barrier banking + recovery',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'normal',goal:'Calming hydration',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Fri:{type:'device',goal:'Booster mode — hydration infusion',device:true,deviceModes:['booster'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Sat:{type:'recovery',goal:'Barrier banking + recovery',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Sun:{type:'normal',goal:'Gentle radiance + moisture seal',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false}},
  p4_glow:{Mon:{type:'normal',goal:'Clarity + spot control',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Tue:{type:'device',goal:'PDRN device — PIH + radiance',device:true,deviceModes:['mc','derma'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Wed:{type:'recovery',goal:'Barrier banking + recovery',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'active',goal:'AHA texture refinement + glow',device:false,recovery:false,bha:false,retinal:false,aha:true,peel:false},Fri:{type:'device',goal:'Booster + glow treatment',device:true,deviceModes:['booster','mc'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Sat:{type:'recovery',goal:'Barrier banking + recovery',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Sun:{type:'normal',goal:'Radiance prep + hydration',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false}},
  // Phase 3 focus plans (sub-paths). p3_renew is a byte-identical copy of legacy p3 (default — no behavior change).
  p3_renew:{Mon:{type:'normal',goal:'Hydration + spot acne',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Tue:{type:'active',goal:'Retinal introduction — eye area only',device:false,recovery:false,bha:false,retinal:true,aha:false,peel:false},Wed:{type:'recovery',goal:'Recovery after retinal',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'device',goal:'PDRN device treatment',device:true,deviceModes:['mc','derma'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Fri:{type:'normal',goal:'Calm + spot control',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Sat:{type:'active',goal:'Peeling gel exfoliation',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:true},Sun:{type:'recovery',goal:'Full recovery night',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false}},
  p3_clarity:{Mon:{type:'normal',goal:'Hydration + spot BHA',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Tue:{type:'active',goal:'Leave-on BHA exfoliation',device:false,recovery:false,bha:false,retinal:false,aha:true,peel:false},Wed:{type:'recovery',goal:'Recovery + repair',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'device',goal:'PDRN device treatment',device:true,deviceModes:['mc','derma'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Fri:{type:'normal',goal:'Calm + spot control',device:false,recovery:false,bha:true,retinal:false,aha:false,peel:false},Sat:{type:'active',goal:'Peeling gel exfoliation',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:true},Sun:{type:'recovery',goal:'Full recovery night',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false}},
  p3_tone:{Mon:{type:'normal',goal:'Vitamin C + hydration',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Tue:{type:'active',goal:'Tone night — azelaic',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Wed:{type:'recovery',goal:'Recovery + repair',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false},Thu:{type:'device',goal:'PDRN device for PIH',device:true,deviceModes:['mc','derma'],recovery:false,bha:false,retinal:false,aha:false,peel:false},Fri:{type:'active',goal:'Gentle AHA + glow',device:false,recovery:false,bha:false,retinal:false,aha:true,peel:false},Sat:{type:'normal',goal:'Niacinamide + moisture',device:false,recovery:false,bha:false,retinal:false,aha:false,peel:false},Sun:{type:'recovery',goal:'Full recovery night',device:false,recovery:true,bha:false,retinal:false,aha:false,peel:false}}
};
const DAY_NAMES={Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday'};

function renderPhase(pid,selected,c1,c2,toner,essence,serum,moist,deviceGel,usesDevice,bha,retinal,aha,peel,isMature,isHighSens,activeClass,isOptional,eye,sleepingPack,answers,mistProd,selectedDay){
  // For p4, use the focus-specific day plan based on answers or _p4CurrentFocus
  const _p4Focus=(pid==='p4')?(answers&&answers._p4Focus)||'aging':'';
  const _p3Focus=(pid==='p3')?(answers&&answers._p3Focus)||'renew':'';
  const _planKey=pid==='p4'?('p4_'+_p4Focus):(pid==='p3'?('p3_'+_p3Focus):pid);
  const plan=DAY_PLANS[_planKey]||DAY_PLANS[pid]||DAY_PLANS.p1;
  const _rpA=answers||{};
  const _rpIsDry=(_rpA.skinTypes||[]).some(s=>s===t('o_dry'));
  const _rpDamagedBarrierRaw=_rpA.barrierCondition===t('o_slightly')||_rpA.barrierCondition===t('o_very_damaged')||(_rpA.skinTypes||[]).includes(t('o_barrier'));
  const _rpNeedsExtraOcclusion=_rpIsDry||_rpDamagedBarrierRaw;  // occlusion always tracks the raw barrier/dryness state
  // Live barrier signal from the Weekly Skin Check — the up-to-date read, vs the stale day-one assessment.
  const _liveBarrierStress=!!_rpA._inRecoveryMode||(_rpA._recentWscScore!=null&&_rpA._recentWscScore>=3);
  // ── Daily Skin Check (tonight-only) flags — recomputed each evening; never change phase/WSC. ──
  // _dscSuppress folds into the barrier-suppression flag below so tonight's actives are eased off
  // exactly like a barrier-recovery night (reusing the existing suppression path).
  const _dscT=_rpA._dscTonight||null;
  const _dscSuppress=!!(_dscT&&(_dscT.tonightState==='barrier'||_dscT.tonightState==='soften'));
  const _dscHydration=!!(_dscT&&_dscT.hydrationBoost);
  const _dscKeepLight=!!(_dscT&&_dscT.keepLight);
  const _dscWarn=!!(_dscT&&_dscT.warn);
  // Tonight-only banner explaining the DSC adjustment (kept honest + reassuring).
  const _dscBanner=(()=>{
    if(!_dscT)return '';
    let key=null,cls='rose';
    if(_dscT.tonightState==='barrier'){key='dsc_night_barrier';cls='amber';}
    else if(_dscT.tonightState==='soften'){key='dsc_night_soften';}
    else if(_dscT.keepLight){key='dsc_night_oily';}
    else if(_dscT.hydrationBoost){key='dsc_night_hydra';}
    if(!key)return '';
    return `<div class="info-box ${cls}" style="margin:8px 0;display:flex;align-items:flex-start;gap:8px"><div style="font-size:.8rem;line-height:1.5">🌙 ${t(key)}</div></div>`;
  })();
  // Effective (phase-aware) damaged-barrier flag used by every treatment-suppression gate below.
  // P1 = still rebuilding → day-one assessment OR live weekly stress. P2+ = phase presumes a healed/stable
  // barrier, so trust the journey and suppress ONLY when the live weekly check currently says stressed.
  // DSC adds a tonight-only suppression on top, without touching phase or the weekly read.
  const _rpDamagedBarrier=((pid==='p1')?(_rpDamagedBarrierRaw||_liveBarrierStress):_liveBarrierStress)||_dscSuppress;
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
    return `<button class="${cls} ${d===(selectedDay||'Mon')?'active':''}" data-phase="${pid}" data-day="${d}" onclick="selectDay('${pid}','${d}',this)">${d}${dp.recovery?' 🌿':((dp.retinal||dp.aha)?' 🌙':(dp.device&&usesDevice&&!_rpDamagedBarrier?' 💡':''))}</button>`;
  }).join('');
  const dayPanels=[selectedDay||'Mon'].map(d=>{
    const dp=plan[d];
    // Per-day rotation: read pre-computed toner/essence/serum for this day, fall back to fixed values
    const _phDayProds=(_rpA._dayProducts&&_rpA._dayProducts[pid]&&_rpA._dayProducts[pid][d])||{};
    const _effToner=_phDayProds.toner!==undefined?_phDayProds.toner:toner;
    const _effEssence=_phDayProds.essence!==undefined?_phDayProds.essence:essence;
    const _effSerum=_phDayProds.serum!==undefined?_phDayProds.serum:serum;
    const isRec=dp.recovery,isDev=dp.device&&usesDevice,isRet=dp.retinal&&retinal,isBHA=dp.bha&&bha,isPeel=dp.peel&&peel,isAHA=dp.aha&&aha;
    const _isRetinalSerum=retinal&&['serum','ampoule'].includes(normalizedCategory(retinal));
    const isBarrierPhase=pid==='p1';
    const isBarrierRecovery=isRec&&isBarrierPhase;
    const c1IsBalm=c1&&(c1.subcategory==='cleansing balm'||c1.subcategory==='cleansing oil');
    const oilCleanser=c1IsBalm?c1:null;
    const waterCleanser=c2||(!c1IsBalm&&c1?c1:null);
    const cardType=isRec?'recovery':isRet||isAHA?'actives':isDev?'device':'normal';
    // avoidList is computed further down, after _peelShown/_deviceShown are known,
    // so the "avoid tonight" chips match what actually renders (no peel-shown + avoid-peel contradiction).
    // Day-safe product filtering — one active focus per night, no stacking
    // Phase 1 (Barrier Repair): ALL days use isBarrierSafeProduct — no exceptions
    // Gap 1d: guaranteed toner fallbacks so the toner step never silently disappears
    // when the rotated pick is ineligible for the night type. Pool prefers real toners.
    const _rpTonerPool=(()=>{const r=(selected||[]).filter(p=>normalizedCategory(p)==='toner');return r.length?r:(selected||[]).filter(p=>normalizedCategory(p)==='toner pad'&&!hasExfoliantAcid(p));})();
    const _rpBestToner=(arr)=>{if(!arr||!arr.length)return null;if(arr.length===1)return arr[0];return arr.map(p=>({p,s:scoreProductForUser(p,_rpA)})).sort((x,y)=>y.s-x.s)[0].p;};
    const _fallbackTonerSafe=_rpBestToner(_rpTonerPool.filter(isBarrierSafeProduct));
    const _fallbackTonerAcidFree=_rpBestToner(_rpTonerPool.filter(p=>!hasExfoliantAcid(p)));
    // Gap 1c: optional toner-pad (Step 5) — a non-exfoliating pad shown after the toner, never replacing it
    const _dayTonerPadCand=_rpBestToner((selected||[]).filter(p=>normalizedCategory(p)==='toner pad'&&!hasExfoliantAcid(p)&&isBarrierSafeProduct(p)));
    const dayToner=isRec
      ?(_effToner&&isBarrierSafeProduct(_effToner)?_effToner:(_fallbackTonerSafe||null))  // Recovery: barrier-safe toners only — no AHA/BHA/PHA/vitamin C
      :(isBarrierPhase||isRet||isAHA||isBHA||isPeel)
        ?(_effToner&&isBarrierSafeProduct(_effToner)?_effToner:(_fallbackTonerSafe||null))
        :(_effToner&&!hasExfoliantAcid(_effToner)?_effToner:(_fallbackTonerAcidFree||null));  // Normal nights: acid-free toners only
    const dayTonerPad=(_dayTonerPadCand&&_dayTonerPadCand!==dayToner&&!_rpIsSimple&&!isBarrierRecovery)?_dayTonerPadCand:null;
    // Gap 2: optional Sheet Mask (Step 9) — advanced routines only, gentle/normal/device nights, never daily on active nights
    const _daySheetMask=_rpBestToner((selected||[]).filter(p=>normalizedCategory(p)==='sheet mask'));
    const _showSheetMask=!!(_daySheetMask&&!_rpIsSimple&&!_rpIsModerate&&!isBarrierRecovery&&!isRet&&!isAHA&&!isBHA&&!isPeel);
    // Gap 3: optional Gel Cream (Step 10) — lightweight support layer, never the main moisturizer
    const _dayGelCream=_rpBestToner((selected||[]).filter(p=>normalizedCategory(p)==='gel cream'&&p!==moist));
    const _showGelCream=!!(_dayGelCream&&!isBarrierRecovery&&(!_rpIsSimple||_dscHydration));
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
    const _retinoidDayEye=eye&&hasRetinoid(eye)&&isRet&&!isBarrierRecovery&&!_dscSuppress?eye:null;
    const dayEye=_normalDayEye;
    // ── Rule 4: Moderate step-count cap — max 7 steps per night routine ─────────
    // Pre-compute optional step visibility for moderate users before building HTML.
    // Mandatory steps are counted first; optional slots (up to 7 total) are filled
    // in priority order: essence → eye. Serum/actives/device/moist are non-negotiable.
    let _showEssence=!!(dayEssence&&!isBarrierRecovery&&!_rpIsSimple);
    let _showEye=!!(dayEye&&!isBarrierRecovery&&!_rpIsSimple);
    // ── Mist placement logic ──────────────────────────────────────────────────
    // Mist is optional — hidden on all active/recovery nights, barrier recovery, and simple complexity
    const _mistOkNight=!!(mistProd&&!isRec&&!isBarrierRecovery&&((!isPeel&&!isAHA&&!isBHA&&!isRet&&!_rpIsSimple)||_dscHydration));
    const _mistSub=_mistOkNight?mistSubtype(mistProd):null;
    let _showMistStep=_mistOkNight;
    if(_rpIsModerate&&(_showEssence||_showEye||_showMistStep)){
      let _base=0;
      if(oilCleanser)_base++;                                                                       // oil/balm cleanser
      _base++;                                                                                       // water cleanser (always rendered)
      if(isPeel&&peel&&!isRet&&!isBarrierRecovery&&!_rpDamagedBarrier)_base++;                            // peeling gel
      if(dayToner)_base++;                                                                          // toner (device overlays are not steps — excluded from count)
      if(daySerum)_base++;                                                     // serum
      if(isAHA&&aha&&!isBarrierRecovery&&!_rpDamagedBarrier)_base++;                                                   // AHA
      if(isBHA&&bha&&!isBarrierRecovery&&!_dscSuppress)_base++;                                                   // BHA
      if(moist&&!(sleepingPack&&!_rpNeedsExtraOcclusion))_base++;                                 // moisturizer
      if(isRet&&retinal&&!isBarrierRecovery&&!_dscSuppress)_base++;                                              // retinal
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
      if(isPeel&&peel&&!isRet&&!isBarrierRecovery&&!_rpDamagedBarrier)_base++;
      if(dayToner)_base++;
      if(daySerum)_base++;
      if(isAHA&&aha&&!isBarrierRecovery&&!_rpDamagedBarrier)_base++;
      if(isBHA&&bha&&!isBarrierRecovery&&!_dscSuppress)_base++;
      if(moist&&!(sleepingPack&&!_rpNeedsExtraOcclusion))_base++;
      if(isRet&&retinal&&!isBarrierRecovery&&!_dscSuppress)_base++;
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
    // Honest badges — only badge a peel/device step that will actually render below.
    const _peelShown=isPeel&&peel&&!isRet&&!isBarrierRecovery&&!_rpDamagedBarrier;
    const _deviceShown=_showBooster||_showAirShot||_showMC||_showDerma;
    // A peel/device step was dropped specifically because the barrier is recovering → explain it.
    const _barrierPausedTreatment=(_rpDamagedBarrier||isBarrierRecovery)&&((isPeel&&!_peelShown)||(isDev&&!_deviceShown));
    // Adaptive exfoliant night: this day is scheduled for a leave-on exfoliant, but the user owns none →
    // run it as a gentle hydration night and tell them what to add. (Generalizes to every aha-night / sub-path.)
    // Adaptive treatment nights — name the night by the active that actually renders; if the user owns none,
    // run gentle and say what to add. A matching acid CLEANSER counts as partial cover (acknowledged, not "missing").
    const _exfTypeLabel=(_p3Focus==='clarity')?'BHA':'AHA';
    const _exfActiveType=isAHA?_acidType(aha):null;
    // Format-aware exfoliant placement: route the night's chemical exfoliant to the step that matches
    // its PRODUCT FORMAT (toner/pad → toner zone with swipe; serum/ampoule/other → serum zone, leave-on).
    // Never a fixed late "leave on" slot. Safety: only when not recovery / barrier-suppressed.
    const _exfShow=isAHA&&!isBarrierRecovery&&!_rpDamagedBarrier;
    // Effective actives ACTUALLY applied tonight (mirror the step guards below) — feed THESE to the
    // load strip so DSC-suppressed / barrier-paused nights don't over-warn about actives the engine removed.
    const _effRet  = isRet && retinal && !isBarrierRecovery && !_dscSuppress;
    const _effAHA  = _exfShow;
    const _effBHA  = isBHA && bha && !isBarrierRecovery && !_dscSuppress;
    const _effPeel = _peelShown;
    const _effDev  = _deviceShown;
    const _exfCat=isAHA?normalizedCategory(aha):null;
    const _exfAtToner=_exfShow&&(_exfCat==='toner'||_exfCat==='toner pad');
    const _exfAtSerum=_exfShow&&!_exfAtToner;
    const _notSuppressed=!isBarrierRecovery&&!_rpDamagedBarrier;
    const _hasMatchingCleanser=(selected||[]).some(p=>/cleanser/.test(normalizedCategory(p)||'')&&_acidType(p)===_exfTypeLabel.toLowerCase());
    const _exfViaCleanser  = !!dp.aha && !isAHA && _notSuppressed && _hasMatchingCleanser;
    const _exfFullyMissing = !!dp.aha && !isAHA && _notSuppressed && !_hasMatchingCleanser;
    const _retMissing      = !!dp.retinal && !retinal && _notSuppressed;
    const _peelMissingNote = !!dp.peel && !peel && _notSuppressed;
    const _gentleGoal      = _exfFullyMissing || _retMissing || (!!dp.peel && !dp.device && !peel && _notSuppressed);
    const _exfGoalLabel    = _exfActiveType==='bha'?t('goal_bha_exf'):_exfActiveType==='aha'?t('goal_aha_exf'):_exfActiveType==='azelaic'?t('goal_azelaic_treat'):null;
    // Avoid-tonight chips — keyed to what actually renders (peel before device, using the *shown* flags).
    let avoidList=[];
    if(isRet)avoidList=[t('avoid_all_devices'),t('avoid_aha_toner'),t('avoid_bha_acne_gel'),t('avoid_peeling_gel')];
    else if(_peelShown)avoidList=[t('avoid_retinal_label'),t('avoid_aha_toner'),t('avoid_air_shot_label'),t('avoid_acne_gel_label')];
    else if(_deviceShown)avoidList=[t('avoid_retinal_label'),t('avoid_aha_label'),t('avoid_bha_acne_gel'),t('avoid_peeling_gel')];
    else if(isBHA)avoidList=[t('avoid_retinal_label'),t('avoid_aha_toner'),t('avoid_peeling_gel'),t('avoid_device_label')];
    else if(isAHA)avoidList=[t('avoid_retinal_label'),t('avoid_bha_acne_gel'),t('avoid_all_devices'),t('avoid_peeling_gel')];
    else if(isRec)avoidList=[t('avoid_all_actives'),t('avoid_all_device_modes')];
    else avoidList=[t('avoid_actives'),t('avoid_device_phase1')];
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
            <div><div class="day-name">${tDayName(d)}</div><div class="day-goal">🎯 ${_barrierPausedTreatment?t('day_goal_barrier_paused'):(_gentleGoal?t('day_goal_gentle'):(_exfGoalLabel||tDayGoal(dp.goal)))}</div></div>
            <div class="day-badges">
              ${isRec?`<span class="dbadge recovery">${t('dbadge_recovery')}</span>`:''}
              ${_deviceShown?`<span class="dbadge device">${t('dbadge_device')}</span>`:''}
              ${isRet?`<span class="dbadge retinal">${t('dbadge_retinal')}</span>`:''}
              ${isBHA?`<span class="dbadge actives">${t('dbadge_bha')}</span>`:''}
              ${_peelShown?`<span class="dbadge actives">${t('dbadge_peel')}</span>`:''}
              ${isAHA?`<span class="dbadge actives">${_exfActiveType==='bha'?'BHA':_exfActiveType==='azelaic'?'Azelaic':'AHA'}</span>`:''}
            </div>
          </div>
          <div class="day-card-body">
            <div class="label-xs">${isRec?t('recovery_night_label'):(isRet||isAHA||isBHA||isPeel)?t('treatment_night_label'):t('night_routine')}</div>
            ${!isRec?renderLoadStrip(_effRet,_effAHA,_effBHA,_effPeel,_effDev,isHighSens,_rpDamagedBarrier):''}
            ${_dscBanner}
            ${_barrierPausedTreatment?`<div class="info-box amber" style="margin:8px 0;display:flex;align-items:flex-start;gap:8px"><div style="font-size:.8rem;line-height:1.5">${t('barrier_paused_treatment')}</div></div>`:''}
            ${_exfFullyMissing?`<div class="info-box amber" style="margin:8px 0;display:flex;align-items:flex-start;gap:8px"><div style="font-size:.8rem;line-height:1.5">${tFmt('night_missing_exfoliant_body',{type:_exfTypeLabel})}</div></div>`:''}
            ${_exfViaCleanser?`<div class="info-box amber" style="margin:8px 0;display:flex;align-items:flex-start;gap:8px"><div style="font-size:.8rem;line-height:1.5">${tFmt('night_acid_via_cleanser_body',{type:_exfTypeLabel})}</div></div>`:''}
            ${_retMissing?`<div class="info-box amber" style="margin:8px 0;display:flex;align-items:flex-start;gap:8px"><div style="font-size:.8rem;line-height:1.5">${t('night_missing_retinal_body')}</div></div>`:''}
            ${_peelMissingNote?`<div class="info-box amber" style="margin:8px 0;display:flex;align-items:flex-start;gap:8px"><div style="font-size:.8rem;line-height:1.5">${t('night_missing_peel_body')}</div></div>`:''}
            ${oilCleanser?`<div class="routine-step ${isRec?'r-recovery':''}">${sn(isRec?'re':'n')}<div class="rs-emoji">${prodEmoji(oilCleanser)}</div><div class="rs-body"><div class="rs-brand">${oilCleanser.brand}</div><div class="rs-name">${oilCleanser.name}</div><div class="rs-note">${isRec?t('step_c1_recovery_note'):t('step_c1_note')}</div></div></div>`:''}
            ${waterCleanser?`<div class="routine-step">${sn()}<div class="rs-emoji">${prodEmoji(waterCleanser)}</div><div class="rs-body"><div class="rs-brand">${waterCleanser.brand}</div><div class="rs-name">${waterCleanser.name}</div><div class="rs-note">${t('step_c2_note')}</div></div></div>`:`<div class="routine-step">${sn('re')}<div class="rs-emoji">💧</div><div class="rs-body"><div class="rs-name">${t('step_cleanser_reminder')}</div><div class="rs-note">${t('step_cleanser_reminder_note')}</div></div></div>`}
            ${_showAirShot?_devOvl('Air Shot','#00C2FF',_airNote):''}
            ${isPeel&&peel&&!isRet&&!isBarrierRecovery&&!_rpDamagedBarrier?`<div class="routine-step r-active">${sn('ac')}<div class="rs-emoji">${prodEmoji(peel)}</div><div class="rs-body"><div class="rs-brand">${peel.brand}</div><div class="rs-name">${peel.name}</div><div class="rs-note">${t('step_peel_note')}</div></div></div>`:''}
            ${dayToner?`<div class="routine-step ${isRec?'r-recovery':''}">${sn(isRec?'re':'n')}<div class="rs-emoji">${prodEmoji(dayToner)}</div><div class="rs-body"><div class="rs-brand">${dayToner.brand}</div><div class="rs-name">${dayToner.name}</div><div class="rs-note">${normalizedCategory(dayToner)==='toner pad'?(isRec?t('step_toner_pad_recovery_note'):t('step_toner_pad_note')):(isRec?t('step_toner_recovery_note'):t('step_toner_note'))}</div></div></div>`:''}
            ${dayTonerPad?`<div class="routine-step ${isRec?'r-recovery':''}">${sn(isRec?'re':'n')}<div class="rs-emoji">${prodEmoji(dayTonerPad)}</div><div class="rs-body"><div class="rs-brand">${dayTonerPad.brand}</div><div class="rs-name">${dayTonerPad.name}</div><div class="rs-note">${isRec?t('step_toner_pad_recovery_note'):t('step_toner_pad_note')}</div></div></div>`:''}
            ${_exfAtToner?`<div class="routine-step r-active">${sn('ac')}<div class="rs-emoji">${prodEmoji(aha)}</div><div class="rs-body"><div class="rs-brand">${aha.brand}</div><div class="rs-name">${aha.name}</div><div class="rs-note">${t('step_exf_swipe_note')}</div></div></div>`:''}
            ${(!dayToner&&_effToner&&normalizedCategory(_effToner)==='toner pad'&&hasExfoliantAcid(_effToner)&&isRec)?`<div class="info-box amber" style="margin:4px 0 6px">${t('caution_exf_pad_skipped')}</div>`:''}
            ${_showBooster&&_boosterTarget===dayToner?_devOvl('Booster Mode','#FF8C00',_boosterNote):''}
            ${_showMistHydrating&&dayToner?`<div class="routine-step">${sn()}<div class="rs-emoji">💦</div><div class="rs-body"><div class="rs-brand">${mistProd.brand}</div><div class="rs-name">${mistProd.name}</div><div class="rs-note">Mist onto skin after toner — hold 15–20 cm away, 2 light passes.</div></div></div>`:''}
            ${_showEssence?`<div class="routine-step">${sn()}<div class="rs-emoji">${prodEmoji(dayEssence)}</div><div class="rs-body"><div class="rs-brand">${dayEssence.brand}</div><div class="rs-name">${dayEssence.name}</div></div></div>`:''}
            ${_showBooster&&_boosterTarget!==dayToner&&!!_boosterTarget?_devOvl('Booster Mode','#FF8C00',_boosterNote):''}
            ${daySerum?`<div class="routine-step">${sn()}<div class="rs-emoji">${prodEmoji(daySerum)}</div><div class="rs-body"><div class="rs-brand">${daySerum.brand}</div><div class="rs-name">${daySerum.name}</div></div></div>`:''}
            ${_exfAtSerum?`<div class="routine-step r-active">${sn('ac')}<div class="rs-emoji">${prodEmoji(aha)}</div><div class="rs-body"><div class="rs-brand">${aha.brand}</div><div class="rs-name">${aha.name}</div><div class="rs-note">${t('step_exf_serum_note')}</div></div></div>`:''}
            ${isRet&&retinal&&!isBarrierRecovery&&!_dscSuppress&&_isRetinalSerum?`<div class="routine-step r-retinal">${sn('rt')}<div class="rs-emoji">${prodEmoji(retinal)}</div><div class="rs-body"><div class="rs-brand">${retinal.brand}</div><div class="rs-name">${retinal.name}</div><div class="rs-note">${t('step_retinal_note')}</div></div></div>`:''}
            ${_showMC?_devOvl('MC Mode','#27AE60',_mcNote):''}
            ${_showDerma&&_dermaTarget===daySerum?_devOvl('Derma Shot','#E74C3C',_dermaNote):''}
            ${_showSheetMask?`<div class="routine-step">${sn()}<div class="rs-emoji">${prodEmoji(_daySheetMask)}</div><div class="rs-body"><div class="rs-brand">${_daySheetMask.brand}</div><div class="rs-name">${_daySheetMask.name}</div><div class="rs-note">${t('step_sheet_note')}</div></div></div>`:''}
            ${_showGelCream?`<div class="routine-step">${sn()}<div class="rs-emoji">${prodEmoji(_dayGelCream)}</div><div class="rs-body"><div class="rs-brand">${_dayGelCream.brand}</div><div class="rs-name">${_dayGelCream.name}</div><div class="rs-note">${t('step_gel_cream_note')}</div></div></div>`:''}
            ${_showMistMilky?`<div class="routine-step">${sn()}<div class="rs-emoji">💦</div><div class="rs-body"><div class="rs-brand">${mistProd.brand}</div><div class="rs-name">${mistProd.name}</div><div class="rs-note">Apply milky mist after serum to seal in actives before moisturizer.</div></div></div>`:''}
            ${_showMistBarrier?`<div class="routine-step">${sn()}<div class="rs-emoji">💦</div><div class="rs-body"><div class="rs-brand">${mistProd.brand}</div><div class="rs-name">${mistProd.name}</div><div class="rs-note">Barrier mist before moisturizer to add a hydrating, barrier-supporting layer.</div></div></div>`:''}
            ${_showEye?`<div class="routine-step">${sn()}<div class="rs-emoji">${prodEmoji(dayEye)}</div><div class="rs-body"><div class="rs-brand">${dayEye.brand}</div><div class="rs-name">${dayEye.name}</div><div class="rs-note">${t('step_eye_note')}</div></div></div>`:''}
            ${'' /* chemical exfoliant moved to format-aware position (toner/serum zone) above — no late leave-on slot */}
            ${isBHA&&bha&&!isBarrierRecovery&&!_dscSuppress?`<div class="routine-step r-active">${sn('ac')}<div class="rs-emoji">${prodEmoji(bha)}</div><div class="rs-body"><div class="rs-brand">${bha.brand}</div><div class="rs-name">${bha.name}</div><div class="rs-note">${t('step_bha_note')}</div></div></div>`:''}
            ${(moist&&!(sleepingPack&&!_rpNeedsExtraOcclusion))?`<div class="routine-step ${isRec?'r-recovery':''}">${sn(isRec?'re':'n')}<div class="rs-emoji">${prodEmoji(moist)}</div><div class="rs-body"><div class="rs-brand">${moist.brand}</div><div class="rs-name">${moist.name}</div>${isRet&&retinal&&!isBarrierRecovery&&!_dscSuppress&&!_isRetinalSerum?`<div class="rs-note">${t('step_moisturizer_before_retinal_note')}</div>`:''}</div></div>`:''}
            ${_showDerma&&_dermaTarget===moist?_devOvl('Derma Shot','#E74C3C',_dermaNote):''}
            ${isRet&&retinal&&!isBarrierRecovery&&!_dscSuppress&&!_isRetinalSerum&&retinal!==_retinoidDayEye?`<div class="routine-step r-retinal">${sn('rt')}<div class="rs-emoji">${prodEmoji(retinal)}</div><div class="rs-body"><div class="rs-brand">${retinal.brand}</div><div class="rs-name">${retinal.name}</div><div class="rs-note">${t('step_retinal_note')}</div></div></div>`:''}
            ${_retinoidDayEye?`<div class="routine-step r-retinal">${sn('rt')}<div class="rs-emoji">${prodEmoji(_retinoidDayEye)}</div><div class="rs-body"><div class="rs-brand">${_retinoidDayEye.brand}</div><div class="rs-name">${_retinoidDayEye.name}</div><div class="rs-note">${t('step_eye_note')}</div></div></div>`:''}
            ${sleepingPack&&!isBarrierRecovery&&!_dscKeepLight&&(!_rpIsSimple||_rpNeedsExtraOcclusion)&&(!_rpIsModerate||_rpNeedsExtraOcclusion)?`<div class="routine-step">${sn()}<div class="rs-emoji">🌙</div><div class="rs-body"><div class="rs-brand">${sleepingPack.brand}</div><div class="rs-name">${sleepingPack.name}</div></div></div>`:''}
            <div class="avoid-box"><div class="avoid-title">${t('avoid_tonight')}</div><div class="avoid-chips">${avoidList.map(a=>`<span class="avoid-chip">${a}</span>`).join('')}</div></div>
            ${isRet?`<div class="skin-note"><div class="skin-note-title">${t('retinal_rule')}</div>${t('retinal_rule_body')}</div>`:''}
            ${isRec?`<div class="skin-note"><div class="skin-note-title">${t('recovery_note')}</div>${t('recovery_note_body')}</div>`:''}
            ${isMature&&isDev?`<div class="skin-note"><div class="skin-note-title">${t('mature_skin_note_label')}</div>${t('mature_skin_note_body')}</div>`:''}
          </div>
        </div>
      </div>`;
  }).join('');
  const _sbStrip=(pid==='p3'||pid==='p4')?`<div class="sb-strip" onclick="openStepBackSheet(this)"><div class="sb-ic">🌿</div><div class="sb-txt"><div class="sb-t">${_mrrL('Skin reacting?','ผิวกำลังตอบสนอง?')}</div><div class="sb-s">${_mrrL('Step back to a gentler phase — progress saved','ถอยกลับไปเฟสที่อ่อนโยนกว่า — ความก้าวหน้าถูกบันทึก')}</div></div><button class="sb-go" onclick="event.stopPropagation();openStepBackSheet(this)">${_mrrL('Step back','ถอยกลับ')} →</button></div>`:'';

  // Phase 4 focus tabs
  const _focusTabs=pid==='p4'?`<div class="p4focus-wrap">
    <div class="p4focus-label">${_mrrL('FOCUS','โฟกัส')}</div>
    <div class="p4focus-tabs">
      <button class="p4focus-tab ${_p4Focus==='barrier'?'active':''}" onclick="switchP4Focus('barrier',this)">${t('p4focus_barrier_label')}</button>
      <button class="p4focus-tab ${_p4Focus==='glow'?'active':''}" onclick="switchP4Focus('glow',this)">${t('p4focus_glow_label')}</button>
      <button class="p4focus-tab ${_p4Focus==='aging'?'active':''}" onclick="switchP4Focus('aging',this)">${t('p4focus_aging_label')}</button>
    </div>
    <div class="p4focus-desc"><b>${t('p4focus_'+_p4Focus+'_title')}.</b> ${t('p4focus_'+_p4Focus+'_desc')}</div>
    <div class="p4focus-note">${t('p4focus_switch_note')}</div>
  </div>`:'';

  // Phase 3 focus tabs (sub-paths) — reuse p4focus styling
  // Fragile barrier profile → warn (don't block) when on the retinal Renew path
  const _p3Fragile=(_rpA.barrierCondition===t('o_slightly')||_rpA.barrierCondition===t('o_very_damaged')||_rpA.sensitivity===t('o_high')||_rpA.redness===t('o_high')||(_rpA.skinTypes||[]).some(s=>s===t('o_barrier')||s===t('o_reactive')||s===t('o_rosacea')));
  const _2aU=_p3Unlocked(_rpA);
  const _2aAdded=_rpA._addedFocus||[];
  const _2aTab=function(f,name,desc){
    var active=(_p3Focus===f);
    var unlocked=_2aU[f]||active||(_2aAdded.indexOf(f)!==-1);
    var cls='p4focus-tab gp2a-tab'+(active?' active':'')+(unlocked?'':' locked');
    var oc=unlocked?("switchP3Focus('"+f+"',this)"):("gp2aUnlock('"+f+"',this)");
    var pill=active?('<span class="gp2a-badge">'+_mrrL('Active','กำลังใช้')+'</span>')
            :(unlocked?'':('<span class="gp2a-lock">🔒 '+_mrrL('Locked','ล็อก')+'</span>'));
    return '<button class="'+cls+'" data-focus="'+f+'" onclick="'+oc+'">'+pill
      +'<span class="gp2a-name">'+(active?'✦ ':'')+name+'</span>'
      +'<span class="gp2a-desc">'+desc+'</span></button>';
  };
  const _p3FocusTabs=pid==='p3'?`<div class="p4focus-wrap">
    <div class="p4focus-label">${_mrrL('FOCUS','โฟกัส')}</div>
    <div class="p4focus-tabs gp2a-tabs">
      ${_2aTab('clarity',_mrrL('Clarity','เคลียร์ผิว'),_mrrL('Breakouts, congestion, texture & pores','สิว รูขุมขน ผิวไม่เรียบ'))}
      ${_2aTab('tone',_mrrL('Even Tone','ผิวสม่ำเสมอ'),_mrrL('Dark marks, uneven tone, dullness','จุดด่างดำ สีผิวไม่สม่ำเสมอ'))}
      ${_2aTab('renew',_mrrL('Texture & Aging','ผิวเรียบเนียน & ริ้วรอย'),_mrrL('Fine lines, firmness, smoothness','ริ้วรอย ความกระชับ'))}
    </div>
    ${(_p3Focus==='renew'&&_p3Fragile)?`<div class="p4focus-warn">⚠ ${t('p3focus_retinal_warn_body')}</div>`:''}
    <div class="gp2a-actions">
      <div class="gp2a-unlock-hint">＋ ${_mrrL('More than one concern?','มีมากกว่าหนึ่งปัญหา?')} <button class="gp2a-unlock-btn" onclick="gp2aUnlockHint(this)">${_mrrL('Add a concern to unlock','เพิ่มปัญหาเพื่อปลดล็อก')}</button></div>
      <button type="button" class="gpg-plan-btn" onclick="openTreatmentGuide(this)">✦ ${_mrrL('View my plan','ดูแผนของฉัน')}</button>
    </div>
  </div>`:'';

  // #3b-1 — Treatment-plan transparency note (p3 only, once per phase). Explains what 3a held back
  // for the active sub-type + suggests a missing ideal active. Skipped during recovery / live barrier
  // stress (that suppression is barrier-driven, not sub-type-driven — the recovery banner covers it).
  const _gpgNote=(()=>{
    if(pid!=='p3'||_rpA._inRecoveryMode||_liveBarrierStress)return '';
    const focus=_p3Focus;
    const st=((_rpA._focusSubtype||{})[focus])||[];
    if(!st.length)return '';
    const sel=selected||[];
    const _ingOf=(p)=>(((p.ingredients||'')+' '+((p.activeIngredients||[]).join(' '))).toLowerCase());
    const ownsRetinoid=sel.some(p=>hasRetinoid(p));
    const ownsAHA=sel.some(p=>hasExfoliantAcid(p)&&_acidType(p)==='aha');
    const owns={
      azelaic:sel.some(p=>hasAzelaicAcid(p)||_acidType(p)==='azelaic'),
      bha:sel.some(p=>_acidType(p)==='bha'||hasBHA(p)),
      niacinamide:sel.some(p=>/niacinamide/.test(_ingOf(p))),
      retinal:ownsRetinoid,
      vitc:sel.some(p=>hasStrongVitaminC(p)||/ascorb/.test(_ingOf(p))),
      tranexamic:sel.some(p=>/tranexamic/.test(_ingOf(p))),
      pha:sel.some(p=>hasPHA(p)),
      peptides:sel.some(p=>/peptide|matrixyl|palmitoyl|argireline|copper.?peptide/.test(_ingOf(p))),
      aha:ownsAHA
    };
    const ownsPeel=sel.some(p=>normalizedCategory(p)==='peeling gel');
    const _has=(k)=>st.indexOf(k)!==-1;
    // hold-back: owned actives that 3a suppressed for this sub-type
    let held=[];
    if(focus==='tone'&&(_has('pie')||_has('melasma'))){
      if(ownsRetinoid&&!retinal)held.push(_mrrL('retinal','เรตินัล'));
      if(ownsAHA&&!(aha&&_acidType(aha)==='aha'))held.push('AHA');
      if(ownsPeel&&!peel)held.push(_mrrL('peel','พีลลิ่ง'));
    } else if(focus==='clarity'&&_has('active')){
      if(ownsPeel&&!peel)held.push(_mrrL('peel','พีลลิ่ง'));
    }
    // consider-adding: highest-priority sub-type whose lead active isn't owned
    let suggest='';
    (GPG_ORDER[focus]||[]).filter(k=>_has(k)).forEach(k=>{
      if(suggest)return; const lead=((GPG_MAP[focus]||{})[k]||[])[0];
      if(lead&&owns[lead]===false)suggest=GPG_ACT[lead]||lead;
    });
    if(!held.length&&!suggest)return '';
    let rows='';
    if(held.length){
      const what=held.join(', ');
      const body=(focus==='clarity')
        ? _mrrL('Pausing your '+what+' while breakouts settle — scrubbing can inflame active acne.','พักการใช้ '+what+' ระหว่างที่สิวยังอยู่ — การขัดถูอาจทำให้สิวอักเสบ')
        : _mrrL('Holding your '+what+' tonight — we calm first; strong acids '+(_has('melasma')?'can trigger rebound':'can prolong redness')+'.','พัก '+what+' คืนนี้ — เน้นปลอบผิวก่อน');
      rows+='<div class="gpg-note-row">🌿 '+body+'</div>';
    }
    if(suggest)rows+='<div class="gpg-note-row">✦ '+_mrrL('Your plan points to '+suggest+' — consider adding one.','แผนแนะนำ '+suggest+' — ลองเพิ่มเข้าคลัง')+'</div>';
    return '<div class="gpg-phase-note">'+rows+'</div>';
  })();

  return `<div class="phase-panel ${activeClass}" id="rp-${pid}" data-pid="${pid}">${_focusTabs}${_p3FocusTabs}<div class="phase-hero-box ${ph.cls}"><div class="ph-tag">${tFmt('result_phase_label',{n:pid.replace('p','')})}</div><div class="ph-title">${ph.title}</div><div class="ph-desc">${ph.desc}</div><div class="ph-duration">${ph.dur}</div></div>${_gpgNote}${_sbStrip}${isOptional?`<div class="info-box amber" style="margin:10px 0 8px;display:flex;align-items:flex-start;gap:8px"><span style="font-size:1.1em;flex-shrink:0">💚</span><div><strong>${t('phase1_optional_badge')}</strong> — ${t('phase1_optional_note')}</div></div>`:''}<div class="day-nav-wrap"><div class="day-nav" id="dn-${pid}">${dayBtns}</div></div><div class="day-content-area">${dayPanels}</div></div>`;
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
  setTimeout(function(){
    if(typeof enhanceRoutineSteps==='function') enhanceRoutineSteps();
    if(typeof restorePhaseState==='function') restorePhaseState();
    if(typeof renderJourneyStrip==='function') renderJourneyStrip();
    if(typeof updatePhaseCardWSCStatus==='function') updatePhaseCardWSCStatus();
    if(typeof renderPhaseShiftSuggestion==='function') renderPhaseShiftSuggestion();
    if(typeof checkAndShowWscBanner==='function') checkAndShowWscBanner();
    if(typeof renderCheckinCards==='function') renderCheckinCards();
    // Daily check-in no longer auto-pops on entering My Routine (Bow 2026-07-03) —
    // it opens only when the user taps "Log it" (the .gp-checkin-card / .gp-checkin-btn → openDscSheet).
    if(typeof _injectPhaseSubStateBadge==='function'){
      document.querySelectorAll('#page-myroutine .builder-card[data-card-id]').forEach(function(card){
        const cardId=card.dataset.cardId;
        if(!cardId||cardId==='gc-draft')return;
        const routineId=cardId.replace('gc-','');
        const r=getSavedRoutines().find(function(x){return x.id===routineId;});
        if(r)_injectPhaseSubStateBadge(card,r.activePhase||'p1');
      });
    }
    if(typeof _mrrReflowAll==='function')_mrrReflowAll();
  },0);
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
  // Re-apply amount guides and wait chips to newly rendered steps, then reflow into sidebar+detail
  setTimeout(function(){
    enhanceRoutineSteps();
    if(typeof _mrrReflowAll==='function')_mrrReflowAll();
    // If this phase is locked, the steps card was just rebuilt (height may change) —
    // realign the lock overlay so it keeps covering only the card.
    if(typeof _mrrPositionLock==='function' && card.querySelector('.mrr-steps-wrap.locked')){
      requestAnimationFrame(function(){ _mrrPositionLock(card); });
    }
  },0);
}
function makeStep(type,num,emoji,brand,name,note){
  const colors={n:'linear-gradient(135deg,#c9897a,#a86b5e)',re:'linear-gradient(135deg,#8aaa92,#5a7f64)',dv:'linear-gradient(135deg,#7898c0,#5a7898)',ac:'linear-gradient(135deg,#9878c0,#7a60a8)',rt:'linear-gradient(135deg,#c8a040,#a07820)'};
  return `<div class="routine-step${type!=='n'?' r-'+{re:'recovery',dv:'device',ac:'active',rt:'retinal'}[type]:''}"><div class="rs-num ${type}" style="background:${colors[type]||colors.n};color:white">${num}</div><div class="rs-emoji">${emoji}</div><div class="rs-body">${brand?`<div class="rs-brand">${brand}</div>`:''}<div class="rs-name">${name}</div>${note?`<div class="rs-note">${note}</div>`:''}</div></div>`;
}

/* ═══ ANALYSIS + CONFLICT ═══ */
function detectConflicts(selected){
  const withAI=(ai)=>selected.filter(p=>(p.activeIngredients||[]).includes(ai));
  const dedupe=(...arrs)=>[...new Set(arrs.flat())];
  // Retinoid detection: retinal OR retinol OR tretinoin OR adapalene
  const retinalPs=dedupe(withAI('retinal'),selected.filter(p=>p.ingredients&&p.ingredients.toLowerCase().includes('retinal')));
  const retinolPs=dedupe(withAI('retinol'),selected.filter(p=>p.ingredients&&/\bretinol\b/.test((p.ingredients||'').toLowerCase())));
  const anyRetinoidPs=dedupe(retinalPs,retinolPs,selected.filter(p=>hasRetinoid(p)));
  // Exfoliant detection
  const glycolicPs=dedupe(withAI('aha'),selected.filter(p=>p.ingredients&&p.ingredients.toLowerCase().includes('glycolic acid')));
  const anyAcidPs=selected.filter(p=>hasExfoliantAcid(p));
  const bhaPs=selected.filter(p=>p.subcategory==='spot treatment'||(p.ingredients&&p.ingredients.toLowerCase().includes('salicylic acid')));
  const peelPs=selected.filter(p=>(p.category==='exfoliant'&&p.subcategory!=='chemical exfoliant')||normalizedCategory(p)==='peeling gel');
  // Other actives
  const bpPs=selected.filter(p=>hasBenzoylPeroxide(p));
  const strongVCPs=selected.filter(p=>hasStrongVitaminC(p));
  // Count retinoids and exfoliants to detect stacking
  const retinoidCountPs=selected.filter(p=>hasRetinoid(p));
  const exfoliantCountPs=selected.filter(p=>hasExfoliantAcid(p));

  const conflicts=[];
  // Each conflict now carries `type` (danger/warn, used for the new severity
  // summary + card styling) and `products` (which of the user's selected
  // items actually triggered it, for the new attribution line). `combo` and
  // `reasonKey` are unchanged so the My Routine Safety-tab consumer (which
  // reads only those two fields) keeps working without modification.
  const prodNames=(arr)=>{const seen=new Set();const out=[];arr.forEach(p=>{const n=`${p.brand} ${p.name}`;if(!seen.has(n)){seen.add(n);out.push(n);}});return out;};
  const push=(combo,reasonKey,type,prods)=>conflicts.push({combo,reasonKey,type,products:prodNames(prods)});

  // Original rules
  if(retinalPs.length&&glycolicPs.length)push('Retinal + Glycolic Acid','conf_reason_retinal_aha','danger',dedupe(retinalPs,glycolicPs));
  if(retinalPs.length&&bhaPs.length)push('Retinal + Salicylic Acid (BHA)','conf_reason_retinal_bha','danger',dedupe(retinalPs,bhaPs));
  if(retinalPs.length&&peelPs.length)push('Retinal + Physical Peeling Gel','conf_reason_retinal_peel','danger',dedupe(retinalPs,peelPs));
  if(glycolicPs.length&&peelPs.length)push('AHA + Peeling Gel','conf_reason_aha_peel','danger',dedupe(glycolicPs,peelPs));
  if(glycolicPs.length&&bhaPs.length)push('AHA + BHA','conf_reason_aha_bha','warn',dedupe(glycolicPs,bhaPs));
  // Extended rules
  if(retinolPs.length&&anyAcidPs.length&&!retinalPs.length)push('Retinol + Exfoliating Acid','conf_reason_retinol_acid','danger',dedupe(retinolPs,anyAcidPs));
  if(bpPs.length&&anyRetinoidPs.length)push('Benzoyl Peroxide + Retinoid','conf_reason_bp_retinoid','danger',dedupe(bpPs,anyRetinoidPs));
  if(bpPs.length&&strongVCPs.length)push('Benzoyl Peroxide + Vitamin C (L-Ascorbic Acid)','conf_reason_bp_vitc','warn',dedupe(bpPs,strongVCPs));
  if(retinoidCountPs.length>1)push('Multiple Retinoids','conf_reason_multi_retinoid','danger',retinoidCountPs);
  if(exfoliantCountPs.length>1)push('Multiple Exfoliating Acids','conf_reason_multi_acid','danger',exfoliantCountPs);
  if(strongVCPs.length&&anyAcidPs.length)push('Strong Vitamin C + Exfoliating Acid','conf_reason_vitc_acid','warn',dedupe(strongVCPs,anyAcidPs));
  // NEW (2026-07-20) — grounded in Research/Ingredients/A03-Vitamin-C.md's L-Ascorbic
  // Acid card: "if reactive, don't stack same-time with retinoids... space them out."
  // A conditional caution (warn), not a hard block like retinal+AHA — matches the
  // actual evidence strength rather than inventing a stricter rule than it supports.
  if(strongVCPs.length&&anyRetinoidPs.length)push('Strong Vitamin C + Retinoid','conf_reason_vitc_retinoid','warn',dedupe(strongVCPs,anyRetinoidPs));

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
  _confRenderPickerSummary();
  _confUpdateHero();
}
function toggleConflict(id,el){
  const i=conflictSelected.indexOf(id);
  if(i===-1){conflictSelected.push(id);el.classList.add('selected');}
  else{conflictSelected.splice(i,1);el.classList.remove('selected');}
  _confRenderPickerSummary();
  _confUpdateHero();
  _confResetResultStats();
}
function clearConflict(){
  conflictSelected=[];
  document.querySelectorAll('[id^="ck-"]').forEach(el=>el.classList.remove('selected'));
  document.getElementById('conflict-results').innerHTML='';
  _confRenderPickerSummary();
  _confUpdateHero();
  _confResetResultStats();
}
// ── §A-0 redesign helpers: hero stat strip + removable-chip picker summary ──
function _confUpdateHero(){
  const selEl=document.getElementById('conf-hero-selected');
  if(selEl)selEl.textContent=conflictSelected.length;
}
function _confResetResultStats(){
  // Selection changed since the last check ran — the old found/severity
  // numbers no longer describe the current picks, so blank them out rather
  // than leave a stale result on screen.
  const foundEl=document.getElementById('conf-hero-found'),sevEl=document.getElementById('conf-hero-severity');
  if(foundEl)foundEl.textContent='—';
  if(sevEl){sevEl.textContent='—';sevEl.className='conf-stat-n conf-stat-n-sm';}
}
function _confRenderPickerSummary(){
  const bar=document.getElementById('conf-picker-summary');if(!bar)return;
  if(!conflictSelected.length){bar.innerHTML=`<span class="conf-picker-empty">${t('conf_picker_empty')}</span>`;return;}
  bar.innerHTML=conflictSelected.map(id=>{
    const p=PRODUCT_DB.find(pr=>pr.id===id);if(!p)return '';
    return `<span class="conf-chip">${p.brand} ${p.name}<span class="conf-chip-x" onclick="_confRemoveSelected(${id})">✕</span></span>`;
  }).join('');
}
function _confRemoveSelected(id){
  const i=conflictSelected.indexOf(id);if(i===-1)return;
  conflictSelected.splice(i,1);
  const card=document.getElementById('ck-'+id);if(card)card.classList.remove('selected');
  _confRenderPickerSummary();
  _confUpdateHero();
  _confResetResultStats();
}
function runConflictCheck(){
  const sel=PRODUCT_DB.filter(p=>conflictSelected.includes(p.id)),r=document.getElementById('conflict-results');
  if(sel.length<2){r.innerHTML=`<div class="notice">${t('conflict_min_select')}</div>`;_confResetResultStats();return;}
  const conflicts=detectConflicts(sel),extras=[];
  const prodNames=(arr)=>{const seen=new Set();const out=[];arr.forEach(p=>{const n=`${p.brand} ${p.name}`;if(!seen.has(n)){seen.add(n);out.push(n);}});return out;};
  const fragPs=sel.filter(p=>!p.fragranceFree);
  if(fragPs.length)extras.push({type:'danger',title:t('conflict_frag_title'),body:t('conflict_frag_body'),products:prodNames(fragPs)});
  const eoPs=sel.filter(p=>!p.eoFree);
  if(eoPs.length)extras.push({type:'warn',title:t('conflict_eo_title'),body:t('conflict_eo_body'),products:prodNames(eoPs)});
  const acPs=sel.filter(p=>isStrongActive(p));
  if(acPs.length>2)extras.push({type:'danger',title:t('conflict_too_many_title'),body:tFmt('conflict_too_many_body',{count:acPs.length}),products:prodNames(acPs)});
  // Icon now matches severity (warn=caution, danger=hard-block) instead of a
  // blanket 🚫 on rule-based conflicts and no icon at all on the "extras"
  // checks (fragrance/EO/too-many-actives) — audit fix, 2026-07-20.
  const sevIcon=(type)=>type==='warn'?'⚠️':'🚨';
  const all=[
    ...conflicts.map(c=>({type:c.type||'danger',title:`${sevIcon(c.type||'danger')} ${c.combo}`,body:t(c.reasonKey),products:c.products})),
    ...extras.map(e=>({...e,title:`${sevIcon(e.type)} ${e.title}`}))
  ];
  // Hero stat strip — result count + severity summary (§A-0 redesign)
  const foundEl=document.getElementById('conf-hero-found'),sevEl=document.getElementById('conf-hero-severity');
  if(foundEl)foundEl.textContent=all.length;
  if(sevEl){
    const dangerN=all.filter(i=>i.type==='danger').length,warnN=all.filter(i=>i.type==='warn').length;
    let label,cls;
    if(dangerN){label=t('conf_severity_high');cls='severity-danger';}
    else if(warnN){label=t('conf_severity_caution');cls='severity-warn';}
    else{label=t('conf_severity_none');cls='';}
    sevEl.textContent=label;
    sevEl.className='conf-stat-n conf-stat-n-sm'+(cls?' '+cls:'');
  }
  if(!all.length){r.innerHTML=`<div class="conflict-result"><div class="conflict-head ok">${tFmt('conflict_none_head',{n:sel.length})}</div><div class="conflict-body">${t('conflict_none_body')}</div></div>`;}
  else{
    r.innerHTML=all.map(i=>{
      const prodLine=(i.products&&i.products.length)?`<div class="conf-body-products"><b>${t('conf_found_in')}</b> ${i.products.join(', ')}</div>`:'';
      return `<div class="conflict-result"><div class="conflict-head ${i.type}">${i.title}</div><div class="conflict-body">${i.body}${prodLine}</div></div>`;
    }).join('');
  }
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
  // Also includes exfoliating toner pads — pads with BHA/AHA/PHA are active exfoliants
  // regardless of their 'toner pad' category and must be stopped during barrier flares.
  const isHarshForEmergency=(p)=>isStrongActive(p)||hasStrongVitaminC(p)||(p.activeIngredients||[]).includes('azelaic acid')||(normalizedCategory(p)==='toner pad'&&hasExfoliantAcid(p));
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
  // Set phaseStartedAt on first save only — marks when the user committed to their routine
  if(!payload.phaseStartedAt) payload.phaseStartedAt=payload.createdAt||new Date().toISOString();
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
/* ═══════ MY ROUTINE REDESIGN — tabbed shell helpers ═══════ */
function _mrrHeroInner(pid){
  var n=pid.replace('p','');
  var crystals={p1:'Ice Crystal',p2:'Aqua Crystal',p3:'Aurora Crystal',p4:'Moon Crystal'};
  return '<div class="ph-tag">'+tFmt('result_phase_label',{n:n})+' · <span class="ph-sub-chip">'+(crystals[pid]||'')+'</span></div>'+
         '<div class="ph-title">'+t('phase'+n+'_title')+'</div>'+
         '<div class="ph-desc">'+t('phase'+n+'_desc')+'</div>'+
         '<div class="ph-duration">'+t('phase'+n+'_dur')+'</div>';
}
function mrrTab(btn,id,i){
  btn.parentNode.querySelectorAll('.mrr-tab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  for(var j=0;j<4;j++){var p=document.querySelector('[data-mrr-pane="'+id+'-'+j+'"]');if(p)p.classList.toggle('active',j===i);}
}
function mrrToggle(btn,mode){
  var card=btn.closest('.builder-card');if(!card)return;
  card.querySelectorAll('.mrr-toggle .mrr-seg').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  var morn=card.querySelector('.mrr-morning'),eve=card.querySelector('.mrr-evening');
  if(mode==='morn'){if(morn)morn.style.display='';if(eve)eve.style.display='none';}
  else{if(morn)morn.style.display='none';if(eve)eve.style.display='';}
}
// Re-render the night phase area WITHOUT auto-saving or unlocking (used for a locked-phase preview).
function _mrrRenderArea(card,pid){
  var cardId=card.dataset.cardId;
  var data=window._glowPhaseData&&window._glowPhaseData[cardId];if(!data)return;
  var pa=_getPhaseActives(data,pid);
  var isOptional=pid==='p1'&&data.isBarrierHealthy;
  var area=card.querySelector('.active-phase-area');if(!area)return;
  area.innerHTML=renderPhase(pid,data.selected,data.c1,data.c2,data.toner,data.essence,data.nightSerum,data.moist,data.deviceGel,data.usesDevice,pa.bha,pa.retinal,pa.aha,pa.peel,data.isMature,data.isHighSens,'active',isOptional,data.eye,data.sleepingPack,data._answersWithDayProducts,data.mistProd,data.selectedDay||'Mon');
  setTimeout(function(){enhanceRoutineSteps();if(typeof _mrrReflowAll==='function')_mrrReflowAll();},0);
}
function _mrrLockHtml(pid,cardId){
  var n=pid.replace('p','');
  return '<div class="sl-i">🔒</div><div class="sl-t">'+t('phase'+n+'_title')+' '+t('myr_locked_suffix')+'</div>'+
         '<div class="sl-d">'+t('myr_lock_desc')+'</div>'+
         '<button class="sl-btn" onclick="mrrUnlockGate(\''+cardId+'\',\''+pid+'\')">'+t('myr_lock_cta')+'</button>'+
         '<button class="sl-peek" onclick="mrrPeek(this)">'+t('myr_lock_peek')+'</button>';
}
function mrrPeek(btn){var sw=btn.closest('.mrr-steps-wrap');if(sw)sw.classList.remove('locked');}
// Size+place the lock overlay over ONLY the steps card (.mrr-stepwrap), so the
// hero / focus / day selector / nightcap above it stay clear (matches preview).
// Measured in rAF (after layout) — measuring synchronously right after the area
// re-renders gives a not-yet-laid-out card, which left the overlay covering the
// whole steps-wrap (hero + tabs + WSC) as a big white wash.
function _mrrPositionLock(card){
  if(!card)return;
  var sw=card.querySelector('.mrr-steps-wrap'),lk=card.querySelector('.mrr-stepslock');
  if(!sw||!lk)return;
  if(!sw.classList.contains('locked')){ lk.style.top=''; lk.style.height=''; lk.style.bottom=''; return; }
  var card2=sw.querySelector('.day-panel.active .mrr-stepwrap')||sw.querySelector('.mrr-stepwrap');
  if(!card2){ lk.style.top=''; lk.style.height=''; lk.style.bottom=''; return; }
  var swr=sw.getBoundingClientRect(),dr=card2.getBoundingClientRect();
  lk.style.top=(dr.top-swr.top)+'px'; lk.style.height=dr.height+'px'; lk.style.bottom='auto';
}
function _mrrUpdateChrome(card,pid,locked){
  if(!card)return;
  card.classList.remove('pa-p1','pa-p2','pa-p3','pa-p4');card.classList.add('mrr-card-accent','pa-'+pid);
  var sw=card.querySelector('.mrr-steps-wrap'),lk=card.querySelector('.mrr-stepslock');
  if(sw)sw.classList.toggle('locked',!!locked);
  if(lk){
    lk.innerHTML=locked?_mrrLockHtml(pid,card.dataset.cardId):'';
    if(locked){
      _mrrPositionLock(card); // best-effort sync
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ _mrrPositionLock(card); }); }); // authoritative, post-layout
    } else { lk.style.top=''; lk.style.height=''; lk.style.bottom=''; }
  }
}
// Keep every locked overlay aligned to its steps card on viewport/layout changes.
if(!window._mrrLockResizeBound){
  window._mrrLockResizeBound=true;
  window.addEventListener('resize',function(){
    document.querySelectorAll('.builder-card').forEach(function(c){
      if(c.querySelector('.mrr-steps-wrap.locked'))_mrrPositionLock(c);
    });
  });
}
function mrrPhaseTab(pid,btn){
  var card=btn.closest('.builder-card');if(!card)return;
  var cardId=card.dataset.cardId;
  var data=window._glowPhaseData&&window._glowPhaseData[cardId];
  var startPid=(data&&data._startPid)||'p1';
  var order={p1:1,p2:2,p3:3,p4:4};
  var unlocked=!(order[pid]>order[startPid])||(window._mrrUnlock&&window._mrrUnlock[cardId+'|'+pid]);
  card.querySelectorAll('.phase-nav:not(.morning-phase-nav) .phase-tab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  if(unlocked){_doSwitchRoutinePhase(pid,btn);}
  else{_mrrRenderArea(card,pid);_mrrUpdateChrome(card,pid,true);}
  // #3 — first time entering an unlocked Phase 3 this session, surface the treatment plan guide.
  if(pid==='p3'&&unlocked){var _rid=cardId.replace('gc-','');try{if(!sessionStorage.getItem('gpg_seen_'+_rid)){sessionStorage.setItem('gpg_seen_'+_rid,'1');setTimeout(function(){if(typeof openTreatmentGuide==='function')openTreatmentGuide(_rid);},280);}}catch(e){}}
}
// Lock CTA → run the EXISTING phase-advance gate (openSkinGate / caution / graduation via switchRoutinePhase).
function mrrUnlockGate(cardId,pid){
  var card=document.querySelector('.builder-card[data-card-id="'+cardId+'"]');
  var btn=card&&card.querySelector('.phase-nav:not(.morning-phase-nav) .phase-tab[data-phase="'+pid+'"]');
  if(btn)switchRoutinePhase(pid,btn);
}
function _mrrWscMetric(letter,labels){
  if(!letter)return {txt:'—',cls:'neu',rank:null};
  var idx={a:0,b:1,c:2}[letter];if(idx===undefined)return {txt:'—',cls:'neu',rank:null};
  return {txt:labels[idx],cls:['up','warn','bad'][idx],rank:2-idx};
}
function _mrrWscInsight(score){
  if(score==null)return '';
  var lbl='<b>'+t('myr_wsc_insight_label')+'</b> ';
  if(score<=2)return lbl+t('myr_wsc_insight_good');
  if(score<=5)return lbl+t('myr_wsc_insight_mid');
  return lbl+t('myr_wsc_insight_high');
}
// Derive an initial WSC baseline (q1 moisture, q2 sensitivity, q3 breakouts) from the
// routine-builder assessment answers, so the Weekly Skin Check card shows data from the
// start instead of an empty prompt. Letters: a=best, b=mid, c=needs-attention.
function _wscBaselineFromAnswers(rd){
  var a=(rd&&rd.answers)||null; if(!a||!Object.keys(a).length)return null;
  var types=(a.skinTypes||[]).join(' ');
  // q1 — moisture/hydration
  var q1='a';
  if(/dehydrat/i.test(types)||/very damaged/i.test(a.barrierCondition||''))q1='c';
  else if(/slightly|damaged/i.test(a.barrierCondition||'')||/\bdry\b|combination/i.test(types))q1='b';
  // q2 — sensitivity/irritation
  var sv=(a.sensitivity||'')+' '+(a.redness||'')+' '+(a.currentIrritation||'')+' '+types;
  var q2='a';
  if(/high|very|severe|rosacea|reactive/i.test(sv))q2='c'; else if(/mild|medium|moderate|little|some/i.test(sv))q2='b';
  // q3 — breakouts (check acneLevel for severe; skin types only bump to "a few")
  var acLevel=a.acneLevel||'';
  var q3='a';
  if(/frequent|severe|cystic|persistent/i.test(acLevel))q3='c';
  else if(/occasional|some|mild|moderate/i.test(acLevel)||/acne-prone|congested|clogged/i.test(types))q3='b';
  return {q1:q1,q2:q2,q3:q3,baseline:true};
}
// Your Journey panel — first-pass render (Bow 2026-07-02). Phase + working-on are REAL from the
// routine; progress STAGE is a placeholder (p4=Maintain, else Treating) until the check-in-driven
// progression engine lands. Uses the .gp-journey-* CSS shell (style.css v91). Merges atop the WSC card.
// Progress stage (0 Treating · 1 Improving · 2 Controlled · 3 Maintain) derived from real check-ins.
// WSC score is 0–8 where LOWER = better skin (a=0 best … c=2). Maintenance phase = Maintain.
function _journeyStage(rd){
  var pid=(rd&&(rd.activePhase||rd.startingPhase))||'p1';
  if(pid==='p4') return 3;                          // Maintenance phase → Maintain
  var hist=(rd&&rd.wscHistory)||[];
  if(!hist.length) return 0;                        // no check-ins yet → Treating
  // #Progression — in Phase 3 the bar tracks the ACTIVE concern via the adaptive q5 (a=doing well … c=no change).
  if(pid==='p3'){
    var _focus=rd.p3Focus||'clarity';
    var _cc=hist.filter(function(h){return h.q5&&(h.focus===_focus||!h.focus);});
    if(_cc.length){
      var _rk={a:0,b:1,c:2};
      var _q5a=_rk[_cc[_cc.length-1].q5];
      if(_cc.length>=2){var _q5b=_rk[_cc[_cc.length-2].q5];
        if(_q5a===0&&_q5b===0) return 2;            // two "doing well" in a row → Controlled
        if(_q5a<_q5b) return 1;                     // improving trend → Improving
      }
      return _q5a===0?1:0;                          // one good → Improving, else Treating
    }
    // no concern check-ins yet → fall through to the composite-score read below
  }
  var a=hist[hist.length-1].score;                  // most recent (lower=better)
  if(hist.length>=2){
    var b=hist[hist.length-2].score;
    if(a<=2 && b<=2) return 2;                       // two good checks in a row → Controlled
    if(a < b) return 1;                              // trending better → Improving
  }
  if(a<=2) return 1;                                 // one good check → Improving
  return 0;                                          // otherwise → Treating
}
function _mrrJourneyHtml(rd){
  if(!rd) return '';
  var pid=(rd.activePhase||rd.startingPhase||'p1');
  var pnum=pid.replace('p','');
  var pname=t('myr_ph'+pnum)||'';
  var working;
  if(pid==='p1') working=_mrrL('Barrier repair','ซ่อมเกราะผิว');
  else if(pid==='p2') working=_mrrL('Hydration','เติมความชุ่มชื้น');
  else if(pid==='p3'){
    var f3=rd.p3Focus||((typeof _inferP3Focus==='function'&&rd.answers)?_inferP3Focus(rd.answers):'clarity');
    working=(f3==='tone')?_mrrL('Even tone — dark marks','ผิวสม่ำเสมอ — จุดด่างดำ')
           :(f3==='renew')?_mrrL('Texture & aging','ผิวเรียบเนียน & ริ้วรอย')
           :_mrrL('Clarity — breakouts','ลดสิว & รูขุมขน');
  } else {
    var f4=rd.p4Focus||'aging';
    working=(f4==='barrier')?_mrrL('Barrier maintenance','ดูแลเกราะผิว')
           :(f4==='glow')?_mrrL('Glow & clarity','ผิวกระจ่างใส')
           :_mrrL('Firmness & aging','ความกระชับ & ริ้วรอย');
  }
  var stages=[_mrrL('Treating','กำลังรักษา'),_mrrL('Improving','กำลังดีขึ้น'),_mrrL('Controlled','ควบคุมได้'),_mrrL('Maintain','คงสภาพ')];
  var active=_journeyStage(rd);
  var segs='',labs='';
  for(var i=0;i<4;i++){
    segs+='<span class="gp-seg'+(i<=active?' done':'')+(i===active?' active':'')+'"></span>';
    labs+='<span class="gp-seg-label'+(i===active?' active':'')+'">'+stages[i]+'</span>';
  }
  return '<div class="gp-journey">'
    +'<div class="gp-journey-head"><span class="gp-journey-star">✦</span>'
      +'<span class="gp-journey-title">'+_mrrL('Your journey','เส้นทางผิวของคุณ')+'</span></div>'
    +'<div class="gp-journey-tiles">'
      +'<div class="gp-jtile"><div class="gp-jtile-k">'+_mrrL('Phase','เฟส')+'</div><div class="gp-jtile-v">'+pname+' · P'+pnum+'</div></div>'
      +'<div class="gp-jtile"><div class="gp-jtile-k">'+_mrrL('Working on','กำลังดูแล')+'</div><div class="gp-jtile-v">'+working+'</div></div>'
    +'</div>'
    +'<div class="gp-journey-goinglbl">'+_mrrL("How it's going","เป็นอย่างไรบ้าง")+'</div>'
    +'<div class="gp-seg-track">'+segs+'</div><div class="gp-seg-labels">'+labs+'</div>'
    +'<div class="gp-journey-note">✧ '+_mrrL("We'll track your progress from your weekly check-ins.","เราจะติดตามความคืบหน้าจากการเช็คอินของคุณ")+'</div>'
  +'</div>';
}
function _mrrWscCard(rd){
  var hist=(rd&&rd.wscHistory)||[];
  var rid=(rd&&rd.id)||'';
  // Weekly check-in is gated to every 7 days (_wscIsDue). When it's not due yet, show a disabled
  // "next check" pill instead of an always-clickable button — missed DAILY check-ins don't count
  // toward the weekly clock; a real gap routes to the catch-up re-sync below.
  var _wDue=(typeof _wscIsDue==='function')?_wscIsDue(rid):true;
  var _wLeft=(typeof _wscDaysLeft==='function')?_wscDaysLeft(rid):0;
  var _wBtn=_wDue
    ? '<button class="wsc-btn" onclick="openWscSheet(\''+rid+'\')">'+t('myr_wsc_cta')+' →</button>'
    : '<span class="wsc-btn wsc-btn-wait" aria-disabled="true">'+(_wLeft<=1?_mrrL('Next check tomorrow','เช็คครั้งต่อไปพรุ่งนี้'):_mrrL('Next check in '+_wLeft+' days','เช็คครั้งต่อไปใน '+_wLeft+' วัน'))+'</span>';
  var head='<div class="wsc-head"><div class="wsc-title">◇ '+t('myr_wsc_title')+'</div>'+_wBtn+'</div>';
  // Missed-days handling. A real gap (≥3 missed daily check-ins) routes to the catch-up re-sync —
  // it resets the weekly clock AND re-baselines progress to how the skin is NOW. A short 1–2 day
  // gap keeps the gentle passive note.
  var _missed=(typeof _getMissedDays==='function'&&rd)?_getMissedDays(rd):0;
  var _doneToday=(typeof _hasCheckedInToday==='function'&&rd)?_hasCheckedInToday(rd):false;
  var missedHtml='';
  if(!_doneToday&&_missed>=3){
    missedHtml='<div class="wsc-catchup"><div class="wsc-catchup-txt">'+_mrrL("You've missed "+_missed+" days — how's your skin right now?","คุณห่างหายไป "+_missed+" วัน — ตอนนี้ผิวเป็นอย่างไรบ้าง?")+'</div><button class="wsc-catchup-btn" onclick="openCatchupSheet(\''+rid+'\')">'+_mrrL('Re-sync my skin','ซิงค์ผิวใหม่')+' →</button></div>';
  } else if(!_doneToday&&_missed>=1){
    missedHtml='<div class="wsc-missed">'+(_missed===1?t6('checkin_missed_1'):t6('checkin_missed_n').replace('{n}',_missed))+'</div>';
  }
  var streak=(typeof _getCheckinStreak==='function')?_getCheckinStreak(rd):0;
  var last,prev=null,baselineMode=false;
  if(hist.length){ last=hist[hist.length-1]; prev=hist.length>1?hist[hist.length-2]:null; }
  else {
    var _bl=(typeof _wscBaselineFromAnswers==='function')?_wscBaselineFromAnswers(rd):null;
    if(!_bl){ return '<div class="wsc" style="position:relative;overflow:hidden">'+'<div class="gp-journey-depth"></div>'+'<div class="gp-journey-shimmer"></div>'+_mrrJourneyHtml(rd)+head+missedHtml+'<div class="wsc-insight">'+t('myr_wsc_empty')+'</div></div>'; }
    last=_bl; baselineMode=true;
  }
  var hyd=_mrrWscMetric(last.q1,['Hydrated','Slightly dry','Dry']);
  var sen=_mrrWscMetric(last.q2,['Low','Mild','High']);
  var brk=_mrrWscMetric(last.q3,['Clear','A few','Active']);
  function trend(cur,key){if(cur.rank===null)return '';if(!prev)return '<div class="wsc-d neu">· baseline</div>';var pm=_mrrWscMetric(prev[key],['','','']);if(pm.rank===null)return '<div class="wsc-d neu">· baseline</div>';var d=cur.rank-pm.rank;return d>0?'<div class="wsc-d up">↑ improving</div>':d<0?'<div class="wsc-d bad">↓ watch</div>':'<div class="wsc-d neu">→ steady</div>';}
  function colorOf(c){return c==='up'?'#0E9F6E':c==='warn'?'#C2680E':c==='bad'?'#C0556B':'var(--ink3)';}
  // Numeric value maps (rank 2=best,1=mid,0=low) — preview-style numbers derived from the check-in answer.
  var _HYD={2:'88',1:'64',0:'40'},_BRK={2:'1',1:'4',0:'7'};
  function numCell(metric,label,key,map,unit){var v=(metric.rank===null)?null:map[metric.rank];var n=(v==null)?'<div class="wsc-n sm">—</div>':'<div class="wsc-n">'+v+'<span>'+unit+'</span></div>';return '<div class="wsc-stat">'+n+'<div class="wsc-l">'+label+'</div>'+trend(metric,key)+'</div>';}
  function wordCell(metric,label,key){return '<div class="wsc-stat"><div class="wsc-n sm" style="color:'+colorOf(metric.cls)+'">'+metric.txt+'</div><div class="wsc-l">'+label+'</div>'+trend(metric,key)+'</div>';}
  var cons='<div class="wsc-stat"><div class="wsc-n">'+streak+'<span>/7</span></div><div class="wsc-l">'+t('myr_wsc_consistency')+'</div><div class="wsc-d '+(streak>=5?'up':streak>=3?'warn':'neu')+'">'+(streak>=5?'↑ strong':streak>=1?'→ keep going':'start a streak')+'</div></div>';
  var insight=baselineMode?('<b>'+_mrrL('From your skin assessment','จากการประเมินผิวของคุณ')+'</b> '+_mrrL('Check in weekly to track how your skin changes.','เช็คอินทุกสัปดาห์เพื่อติดตามการเปลี่ยนแปลงของผิว')):_mrrWscInsight(last.score);
  return '<div class="wsc" style="position:relative;overflow:hidden">'+'<div class="gp-journey-depth"></div>'+'<div class="gp-journey-shimmer"></div>'+_mrrJourneyHtml(rd)+head+missedHtml+'<div class="wsc-stats">'+numCell(hyd,t('myr_wsc_hydration'),'q1',_HYD,'%')+numCell(brk,t('myr_wsc_breakouts'),'q3',_BRK,'/10')+cons+wordCell(sen,t('myr_wsc_sensitivity'),'q2')+'</div>'+(insight?'<div class="wsc-insight">'+insight+'</div>':'')+'</div>';
}
function _mrrShell(parts,recsHtml,emergHtml,switcherHtml,actionsHtml,rd){
  var id=parts.cardId;
  return (switcherHtml||'')+_mrrWscCard(rd)+
    '<div class="mrr-tabs">'+
      '<button class="mrr-tab active" onclick="mrrTab(this,\''+id+'\',0)">'+t('myr_tab_routine')+'</button>'+
      '<button class="mrr-tab" onclick="mrrTab(this,\''+id+'\',1)">'+t('myr_tab_safety')+'</button>'+
      '<button class="mrr-tab" onclick="mrrTab(this,\''+id+'\',2)">'+t('myr_tab_suggestions')+'</button>'+
      '<button class="mrr-tab" onclick="mrrTab(this,\''+id+'\',3)">'+t('myr_tab_emergency')+'</button>'+
    '</div>'+
    '<div class="mrr-pane active" data-mrr-pane="'+id+'-0">'+parts.card+'</div>'+
    '<div class="mrr-pane" data-mrr-pane="'+id+'-1"><div class="builder-card">'+(parts.analyses||'')+'</div></div>'+
    '<div class="mrr-pane" data-mrr-pane="'+id+'-2">'+(recsHtml||'')+'</div>'+
    '<div class="mrr-pane" data-mrr-pane="'+id+'-3">'+(emergHtml||'')+'</div>'+
    (actionsHtml||'');
}
// Reflow the engine's vertical step list into the preview's sidebar + detail glass panel.
// Moves the REAL .routine-step cards into the detail column (preserves amount guides / content);
// keeps warnings (.avoid-box / .info-box) below. Re-runs on every day/phase render.
function _mrrEsc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function _mrrL(en,th){return (typeof LANG!=='undefined'&&LANG==='th')?th:en;}
function _mrrTag(type){
  var EN={n:'✓ Safe',re:'✓ Safe',ac:'Active',rt:'Retinal'},TH={n:'✓ ปลอดภัย',re:'✓ ปลอดภัย',ac:'แอคทีฟ',rt:'เรตินัล'};
  var m=(typeof LANG!=='undefined'&&LANG==='th')?TH:EN;return m[type]||'';
}
// Map a real product (matched by display name) to a clean step-category label like the preview
// ("Oil Cleanser", "Toner", "Serum"…). Active/retinal nights override to Exfoliation / Retinal.
var _mrrProdMap=null;
function _mrrProd(name){
  if(!_mrrProdMap){_mrrProdMap={};if(typeof PRODUCT_DB!=='undefined')PRODUCT_DB.forEach(function(p){_mrrProdMap[(p.name||'').trim()]=p;});}
  return _mrrProdMap[(name||'').trim()]||null;
}
function _mrrCat(name,type){
  if(type==='rt')return _mrrL('Retinal','เรตินัล');
  if(type==='ac')return _mrrL('Exfoliation','ผลัดเซลล์ผิว');
  var p=_mrrProd(name);
  var c=(p&&typeof normalizedCategory==='function')?(normalizedCategory(p)||'').toLowerCase():'';
  if(!c)return '';
  if(/cleansing oil|cleansing balm|oil cleanser/.test(c))return _mrrL('Oil Cleanser','ออยล์เคลนเซอร์');
  if(/cleanser|cleansing/.test(c))return _mrrL('Water Cleanser','คลีนเซอร์');
  if(/toner pad/.test(c))return _mrrL('Toner Pad','โทนเนอร์แพด');
  if(/toner/.test(c))return _mrrL('Toner','โทนเนอร์');
  if(/essence/.test(c))return _mrrL('Essence','เอสเซนส์');
  if(/eye/.test(c))return _mrrL('Eye Cream','อายครีม');
  if(/serum|ampoule/.test(c))return _mrrL('Serum','เซรั่ม');
  if(/sunscreen|spf|\bsun\b/.test(c))return _mrrL('Sunscreen','กันแดด');
  if(/sleeping|overnight/.test(c))return _mrrL('Sleeping Mask','สลีปปิ้งมาสก์');
  if(/sheet mask/.test(c))return _mrrL('Sheet Mask','ชีทมาสก์');
  if(/gel cream/.test(c))return _mrrL('Gel Cream','เจลครีม');
  if(/mist/.test(c))return _mrrL('Mist','มิสต์');
  if(/face oil|squalane|\boil\b/.test(c))return _mrrL('Face Oil','เฟเชียลออยล์');
  if(/moistur|cream|lotion/.test(c))return _mrrL('Moisturizer','มอยส์เจอไรเซอร์');
  if(/exfoli|peel|acid|aha|bha|pha/.test(c))return _mrrL('Exfoliation','ผลัดเซลล์ผิว');
  return '';
}
// A-6: small "dosage" line under the product (preview's "2–3 drops"). Uses a real product
// dosage field if it ever exists, else a clean amount hint by category. Placeholder until
// a real per-product dosage feature is built.
function _mrrDose(name,type){
  var p=_mrrProd(name);
  if(p&&(p.dosage||p.amount||p.dose||p.usage))return (p.dosage||p.amount||p.dose||p.usage);
  if(type==='rt')return _mrrL('pea-size','ขนาดเท่าถั่ว');
  var c=(p&&typeof normalizedCategory==='function')?(normalizedCategory(p)||'').toLowerCase():'';
  if(/cleansing oil|cleansing balm|oil cleanser/.test(c))return _mrrL('1–2 pumps','1–2 ปั๊ม');
  if(/cleanser|cleansing/.test(c))return _mrrL('massage 30s','นวด 30 วิ');
  if(/toner pad/.test(c))return _mrrL('1 pad','1 แผ่น');
  if(/toner/.test(c))return _mrrL('pat in 2–3 layers','ตบ 2–3 ชั้น');
  if(/essence/.test(c))return _mrrL('pat in','ตบให้ซึม');
  if(/eye/.test(c))return _mrrL('tap gently','แตะเบา ๆ');
  if(/serum|ampoule/.test(c))return _mrrL('2–3 drops','2–3 หยด');
  if(/sunscreen|spf/.test(c))return _mrrL('2 finger lengths','2 ข้อนิ้ว');
  if(/sleeping|overnight/.test(c))return _mrrL('thin layer','ชั้นบาง ๆ');
  if(/mist/.test(c))return _mrrL('2 light passes','พ่น 2 ครั้ง');
  if(/gel cream/.test(c))return _mrrL('thin layer','ชั้นบาง ๆ');
  if(/face oil|squalane/.test(c))return _mrrL('1–2 drops','1–2 หยด');
  if(/moistur|cream|lotion/.test(c))return _mrrL('pea-size','ขนาดเท่าถั่ว');
  if(/exfoli|peel|acid|aha|bha|pha/.test(c))return _mrrL('thin layer','ชั้นบาง ๆ');
  return _mrrL('as needed','ตามต้องการ');
}
// Rebuild the engine's vertical step list into the preview's exact sidebar + glass detail.
// Reads the REAL .routine-step data (emoji / product / brand / how-to note / step type) and
// re-renders it as the preview's clickable step list + premium .prod product card.
// Keeps warnings (.avoid-box / .info-box) below. Re-runs on every day/phase render.
function _mrrReflowOne(container,label){
  if(!container||container.querySelector('.mrr-stepwrap'))return;
  var steps=[].slice.call(container.querySelectorAll('.routine-step'));
  if(steps.length<2)return;
  var notes=[].slice.call(container.children).filter(function(c){return c.classList&&(c.classList.contains('avoid-box')||c.classList.contains('info-box')||c.classList.contains('skin-note'));});
  // Extract structured data from each engine .routine-step
  var data=steps.map(function(st,i){
    var emojiEl=st.querySelector('.rs-emoji'),nmEl=st.querySelector('.rs-name'),brEl=st.querySelector('.rs-brand'),ntEl=st.querySelector('.rs-note'),numEl=st.querySelector('.rs-num');
    var type='n';if(numEl){['re','ac','rt'].forEach(function(c){if(numEl.classList.contains(c))type=c;});}
    return {
      emoji:emojiEl?emojiEl.innerHTML.trim():'',
      name:nmEl?nmEl.textContent.trim():('Step '+(i+1)),
      brand:brEl?brEl.textContent.trim():'',
      note:ntEl?ntEl.textContent.trim():'',
      type:type
    };
  });
  var tagCls={n:'safe',re:'safe',ac:'dev',rt:'ret'};
  var wrap=document.createElement('div');wrap.className='mrr-stepwrap';
  // Per-phase accent rim (evening only — read the enclosing phase panel)
  var pp=container.closest('.phase-panel');var pid=pp&&pp.getAttribute('data-pid');
  if(pid)wrap.classList.add('pa-'+pid);
  // A-2: whole-routine "done today" → show the preview's green ✓ on each step (real check-in state)
  var _cardEl=container.closest('.builder-card'),_cid=_cardEl&&_cardEl.getAttribute('data-card-id'),doneToday=false;
  if(_cid){var _rid=_cid.replace(/^gc-/,'');var _rr=(typeof getSavedRoutines==='function')&&getSavedRoutines().find(function(x){return x.id===_rid;});if(_rr&&typeof _hasCheckedInToday==='function')doneToday=_hasCheckedInToday(_rr);}
  var side=document.createElement('div');side.className='mrr-side';
  var lbl=document.createElement('div');lbl.className='mrr-sidelabel';
  lbl.textContent=label+' — '+steps.length+' '+(t('myr_steps_word')||'steps');
  side.appendChild(lbl);
  var detail=document.createElement('div');detail.className='mrr-detailcol';
  data.forEach(function(d,i){
    var tagTxt=_mrrTag(d.type),tag=tagTxt?'<span class="mrr-ptag '+tagCls[d.type]+'">'+tagTxt+'</span>':'';
    var cat=_mrrCat(d.name,d.type);
    var headTitle=cat||d.name;                          // clean step-category label (preview), fallback to product
    var prodLine=d.brand?(d.brand+' '+d.name):d.name;   // the real product, brand + name (preview's sub line)
    // sidebar item: "N. Category" + product underneath (preview layout)
    var it=document.createElement('div');it.className='mrr-stepitem'+(i===0?' active':'')+(doneToday?' done':'');
    it.innerHTML='<div class="mrr-stepnum">'+(doneToday?'✓':(i+1))+'</div><div><div class="mrr-sititle">'+(i+1)+'. '+_mrrEsc(headTitle)+'</div><div class="mrr-sisub">'+_mrrEsc(prodLine)+'</div></div>';
    // detail: "Step N · Category" headline (+tag), instruction sub, then the real product card
    var det=document.createElement('div');det.className='mrr-detstep';det.style.display=(i===0)?'':'none';
    var stepLabel=_mrrL('Step ','ขั้นที่ ')+(i+1)+' · ';
    var html='<div class="mrr-detmain">'+stepLabel+_mrrEsc(headTitle)+'</div>'+
      (d.note?'<div class="mrr-detsub">'+_mrrEsc(d.note)+'</div>':'')+
      '<div class="mrr-prod"><div class="mrr-prod-e">'+d.emoji+'</div><div>'+
        '<div class="mrr-prod-n">'+_mrrEsc(prodLine)+'</div>'+
        '<div class="mrr-prod-m">'+_mrrEsc(_mrrDose(d.name,d.type))+'</div>'+
      '</div>'+tag+'</div>';
    det.innerHTML=html;
    detail.appendChild(det);
    it.addEventListener('click',function(){
      side.querySelectorAll('.mrr-stepitem').forEach(function(x){x.classList.remove('active');});
      it.classList.add('active');
      var all=detail.querySelectorAll('.mrr-detstep');
      for(var j=0;j<all.length;j++){all[j].style.display=(j===i)?'':'none';}
    });
    side.appendChild(it);
  });
  wrap.appendChild(side);wrap.appendChild(detail);
  container.innerHTML='';
  container.appendChild(wrap);
  notes.forEach(function(n){container.appendChild(n);});
}
function _mrrReflowSteps(card){
  if(!card)return;
  _mrrNightcap(card);
  // Evening (night) routine
  var body=card.querySelector('.day-panel.active .day-card-body')||card.querySelector('.day-card-body');
  if(body)_mrrReflowOne(body,_mrrL('Evening Routine','รูทีนกลางคืน'));
  // Morning routine — reflow each of the 3 mode panels (Barrier / Normal / Makeup Prep)
  card.querySelectorAll('.morning-phase-panel').forEach(function(p){
    _mrrReflowOne(p,_mrrL('Morning Routine','รูทีนเช้า'));
  });
  // The steps card (.mrr-stepwrap) was just (re)built here — this is the authoritative
  // moment to size the lock overlay to it. _mrrUpdateChrome's earlier rAF can fire before
  // this reflow runs, finding no card, so we re-anchor here once the card truly exists.
  if(typeof _mrrPositionLock==='function' && card.querySelector('.mrr-steps-wrap.locked')){
    _mrrPositionLock(card);
  }
}
// Add the "· Ice Crystal" sub-chip to the native phase hero's tag (preview look).
function _mrrFixHero(card){
  if(!card)return;
  var hero=card.querySelector('.active-phase-area .phase-hero-box')||card.querySelector('.phase-panel .phase-hero-box');
  if(!hero)return;
  var tag=hero.querySelector('.ph-tag');
  if(!tag||tag.querySelector('.mrr-crystal'))return;
  var m=hero.className.match(/\bp([1-4])\b/);
  if(!m)return;
  var chip=document.createElement('span');chip.className='mrr-crystal';chip.textContent=t('myr_crystal'+m[1]);
  tag.appendChild(document.createTextNode(' · '));   // A-4: "Phase 1 · ICE CRYSTAL" separator like the preview
  tag.appendChild(chip);
}
// ── Phase sub-state guide: skin-aware coaching suffix (UI/TEXT ONLY — engine untouched) ──
// Picks ONE clause by priority based on the user's profile + live state. '' when resilient.
function _skinAwareTipSuffix(r){
  if(!r)return '';
  var a=r.answers||{};
  // 1) reacting NOW — live signal (recovery mode or recent weekly check-in score >= 3)
  var reacting=!!r.inRecoveryMode;
  if(!reacting && r.wscHistory && r.wscHistory.length){
    var last=r.wscHistory[r.wscHistory.length-1];
    if(last && typeof last.score==='number' && last.score>=3) reacting=true;
  }
  if(reacting) return ' '+t('js_skin_mod_reacting');
  // 2) fragile / sensitive / reactive / rosacea
  if(typeof _isFragileProfile==='function' && _isFragileProfile(a)) return ' '+t('js_skin_mod_fragile');
  var st=Array.isArray(a.skinTypes)?a.skinTypes:[];
  var has=function(tok){return st.indexOf(t(tok))!==-1;};
  // 3) acne-prone / congested
  if(has('o_acneprone')||has('o_congested')) return ' '+t('js_skin_mod_acne');
  // 4) high redness / rosacea
  if(a.redness===t('o_high')||has('o_rosacea')) return ' '+t('js_skin_mod_redness');
  // 5) dehydrated / dry
  if(has('o_dehydrated')||has('o_dry')) return ' '+t('js_skin_mod_dehydrated');
  return '';
}
// Adds the sub-state chip to the hero tag + the skin-aware guide tip under the phase title.
function _mrrSubState(card){
  if(!card)return;
  var hero=card.querySelector('.active-phase-area .phase-hero-box')||card.querySelector('.phase-panel.active .phase-hero-box')||card.querySelector('.phase-panel .phase-hero-box');
  if(!hero)return;
  var tag=hero.querySelector('.ph-tag'), title=hero.querySelector('.ph-title');
  if(!tag||!title)return;
  var rid=card.dataset.cardId&&card.dataset.cardId.replace('gc-','');
  var r=rid?getSavedRoutines().find(function(x){return x.id===rid;}):null;
  if(!r)return;
  var pid=r.activePhase||'p1';
  // Only show on the user's ACTUAL current phase — not when previewing another phase tab.
  var heroM=hero.className.match(/\bp([1-4])\b/);
  if(heroM && ('p'+heroM[1])!==pid){
    var st1=hero.querySelector('.mrr-substate-tip'); if(st1)st1.remove();
    var st2=hero.querySelector('.ph-tag .mrr-substate'); if(st2)st2.remove();
    return;
  }
  var startD=r.phaseStartedAt||r.createdAt; if(!startD)return;
  var days=Math.max(1,Math.floor((Date.now()-new Date(startD).getTime())/86400000)+1);
  var focus=(pid==='p4')?(r.p4Focus||'aging'):undefined;
  var label=_getPhaseSubState(pid,days,focus);
  if(!label||label===t('js_stable'))return;  // mirror existing badge guard
  if(!tag.querySelector('.mrr-substate')){
    var chip=document.createElement('span');chip.className='mrr-substate';chip.textContent=label;
    tag.appendChild(document.createTextNode(' · '));tag.appendChild(chip);
  }
  var base=_getPhaseSubStateTip(pid,days,focus)||'';
  var sfx=_skinAwareTipSuffix(r); if(sfx)sfx=sfx.replace(/^\s+/,'');
  var tip=sfx?(base?base+'. '+sfx:sfx):base;
  var old=hero.querySelector('.mrr-substate-tip'); if(old)old.remove();
  if(tip && tip.trim()){
    var line=document.createElement('div');line.className='mrr-substate-tip';
    line.appendChild(document.createTextNode('✦ '+tip.trim()));
    title.insertAdjacentElement('afterend',line);
  }
}
// A-3: reformat the engine day header into the preview's one-line nightcap
// "Mon · 💧 Hydration night — {goal}". Night type read from the engine's day badges (by class).
function _mrrNightType(head){
  if(head.querySelector('.dbadge.recovery'))return '🌿 Barrier Recovery';
  if(head.querySelector('.dbadge.retinal'))return '🌙 Retinal';
  if(head.querySelector('.dbadge.device'))return '💡 Device';
  var act=head.querySelector('.dbadge.actives');
  if(act)return (act.textContent.trim()||'Treatment');   // BHA / AHA / Azelaic / Peel
  return '💧 Hydration';
}
function _mrrNightcap(card){
  if(!card)return;
  var head=card.querySelector('.day-panel.active .day-card-head')||card.querySelector('.day-card-head');
  if(!head||head.getAttribute('data-mrr-cap'))return;
  var dayBtn=card.querySelector('.day-nav .day-btn.active');
  var shortDay=dayBtn?(dayBtn.getAttribute('data-day')||''):'';
  var goalEl=head.querySelector('.day-goal');
  var goal=goalEl?goalEl.textContent.replace(/^[^A-Za-zก-๙]+/,'').trim():'';
  var type=_mrrNightType(head);
  head.setAttribute('data-mrr-cap','1');
  head.innerHTML='<div class="mrr-nightcap"><b>'+_mrrEsc(shortDay)+' · '+type+' '+_mrrL('night','ไนท์')+'</b>'+(goal?' — '+_mrrEsc(goal):'')+'</div>';
}
// Strip the night-type emoji badges off day chips so they're plain like the preview.
function _mrrCleanDays(card){
  card.querySelectorAll('.day-nav .day-btn[data-day]').forEach(function(b){
    var d=b.dataset.day; if(d && b.textContent.trim()!==d) b.textContent=d;
  });
}
// Match the preview header: "Your <Phase> routine" + "Saved & synced · last updated".
function _mrrUpdateHeader(routine,switcherHTML){
  var head=document.querySelector('#page-myroutine .section-head'); if(!head)return;
  // One-time: split the header into a left text column + right switcher slot (preview layout)
  if(!head.classList.contains('mrr-head-flex')){
    head.classList.add('mrr-head-flex');
    var left=document.createElement('div'); left.className='mrr-head-left';
    while(head.firstChild){ left.appendChild(head.firstChild); }
    head.appendChild(left);
    var right=document.createElement('div'); right.className='mrr-head-right'; head.appendChild(right);
  }
  var eyebrow=head.querySelector('.gp-eyebrow'), title=head.querySelector('.section-title'), sub=head.querySelector('.section-sub');
  var pid=(routine&&(routine.startingPhase||routine.activePhase))||'p1';
  var pname=t('myr_ph'+pid.replace('p',''))||'';
  if(title){ title.removeAttribute('data-i18n'); title.innerHTML=(t('myr_routine_title')||'Your <em>{p}</em> routine').replace('{p}',pname); }
  if(eyebrow){ eyebrow.removeAttribute('data-i18n'); eyebrow.innerHTML='<span class="gp-eyebrow-dot"></span>'+t('myr_eyebrow'); }
  if(sub){ sub.removeAttribute('data-i18n'); var d=routine&&(routine.updatedAt||routine.createdAt); sub.innerHTML=t('myr_synced')+(d?' · '+t('myr_last_updated')+' '+new Date(d).toLocaleDateString():''); }
  var right=head.querySelector('.mrr-head-right'); if(right) right.innerHTML=switcherHTML||'';
}
function _mrrReflowAll(){
  if(!document.getElementById('page-myroutine'))return;
  document.querySelectorAll('#page-myroutine .builder-card[data-card-id]').forEach(function(card){_mrrReflowSteps(card);_mrrFixHero(card);_mrrSubState(card);_mrrCleanDays(card);});
  // Re-anchor every locked overlay AFTER _mrrFixHero/_mrrCleanDays have mutated the hero/day
  // rows above the card — otherwise the overlay was measured against a pre-mutation card
  // position and ends up ~20px taller, overhanging below the card as a frosted band.
  function _repositionAllLocks(){
    document.querySelectorAll('#page-myroutine .builder-card').forEach(function(card){
      if(typeof _mrrPositionLock==='function' && card.querySelector('.mrr-steps-wrap.locked'))_mrrPositionLock(card);
    });
  }
  requestAnimationFrame(_repositionAllLocks);
  setTimeout(_repositionAllLocks,160); // safety net for late layout (fonts/images)
}
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
        <div style="margin-top:14px"><button onclick="triggerImport()" style="background:none;border:1px solid rgba(201,206,216,0.6);color:var(--ink2);padding:9px 18px;border-radius:100px;font-size:.8rem;font-weight:600;cursor:pointer">⤒ ${_mrrL('Import a saved routine','นำเข้ารูทีนที่บันทึกไว้')}</button></div>
      </div>`;
    return;
  }

  // CASE 2: no saved routines but an unsaved freshly-built one exists
  if(!routines.length&&builderState.routineData&&(builderState.selectedIds||[]).length){
    const rd=builderState.routineData;
    const _unsavedBanner=`
      <div class="info-box rose" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <span>${t('myr_unsaved_banner')}</span>
        <button class="btn btn-rose btn-sm" onclick="saveCurrentRoutine()">${t('myr_unsaved_save')}</button>
      </div>`;
    const _parts=renderRoutineResultBody(rd,false,true);
    c.innerHTML=_unsavedBanner+_mrrShell(_parts,renderRecommendationsHTML(rd),renderPersonalizedEmergencyHTML(rd),'','',rd);
    attachDayInteractions();
    _mrrUpdateHeader(rd);
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

  // Routine selector chips — always show the user's actual saved routine(s) (preview always shows them)
  const selectorHTML=routines.length>=1?`
    <div class="myr-selector">
      <div class="myr-selector-label">${t('myr_select_label')}</div>
      <div class="myr-chips">
        ${routines.map(r=>`
          <button class="myr-chip ${r.id===selectedId?'active':''}" onclick="loadRoutine('${r.id}')">
            <span class="myr-chip-name">${(r.name||'My Glowphase Routine').replace(/</g,'&lt;')}</span>
            <span class="myr-chip-meta">${r.phases||1} ${_mrrL('phases','เฟส')} · ${(r.selectedIds||[]).length} ${_mrrL('products','ผลิตภัณฑ์')}</span>
          </button>
        `).join('')}
      </div>
    </div>`:'';

  // Action bar for the currently displayed routine
  const _escQ=(current.name||'').replace(/'/g,"\\'");
  const _thF=(typeof LANG!=='undefined'&&LANG==='th');
  const _aL={edit:_thF?'แก้ไข':'Edit products',rebuild:_thF?'สร้างใหม่':'Rebuild',rename:_thF?'เปลี่ยนชื่อ':'Rename',del:_thF?'ลบ':'Delete',exp:_thF?'ส่งออก':'Export',imp:_thF?'นำเข้า':'Import'};
  const actionsHTML=`
    <div class="mrr-actbar">
      <div class="mrr-actgrp">
        <button class="mrr-actbtn" onclick="editRoutine('${current.id}')">✎ ${_aL.edit}</button>
        <button class="mrr-actbtn" onclick="rebuildRoutine('${current.id}')">↻ ${_aL.rebuild}</button>
        <button class="mrr-actbtn" onclick="openRenameModal('${current.id}','${_escQ}')">✦ ${_aL.rename}</button>
        <button class="mrr-actbtn danger" onclick="deleteRoutine('${current.id}')">🗑 ${_aL.del}</button>
      </div>
      <div class="mrr-actgrp">
        <button class="mrr-actbtn" onclick="exportRoutines()">⤓ ${_aL.exp}</button>
        <button class="mrr-actbtn" onclick="triggerImport()">⤒ ${_aL.imp}</button>
      </div>
    </div>`;

  const _parts=renderRoutineResultBody(current,false,true);
  c.innerHTML=_mrrShell(_parts,renderRecommendationsHTML(current),renderPersonalizedEmergencyHTML(current),'',actionsHTML,current);
  attachDayInteractions();
  _mrrUpdateHeader(current,selectorHTML);
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
  const wantsComédoneSupport=goals.includes(t('g_comedones'))||skinTypes.includes(t('o_congested'));

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

  // RULE 10: Comedone / congested skin without a BHA or pore-clearing exfoliant
  if(wantsComédoneSupport&&!selected.some(p=>hasBHA(p)||hasPHA(p)||(p.activeIngredients||[]).includes('lha'))){
    const bha=pick(p=>{
      if(!hasBHA(p)&&!hasPHA(p))return false;
      // For damaged barrier users, prefer PHA over BHA
      if(isDamaged||isSensitive)return hasPHA(p)||(p.exfoliationIntensity==='barrier-safe exfoliant');
      return true;
    },{category:'exfoliant'});
    if(bha)recs.push({product:bha,reason:t('pe_missing_bha'),supports:[t('g_comedones'),t('g_texture')],priority:3,caution:isDamaged?t('caution_acne_start'):null});
  }

  // RULE 11: Comedone + PIH overlap without azelaic acid — it handles both in one step
  if(wantsComédoneSupport&&wantsPIH&&!selected.some(p=>hasAzelaicAcid(p))){
    const az=pick(p=>hasAzelaicAcid(p),{category:'serum'});
    if(az)recs.push({product:az,reason:t('pe_missing_azelaic'),supports:[t('g_comedones'),t('g_pih'),t('g_calm')],priority:3});
  }

  // RULE 12: Too many strong actives — recommend calming recovery.
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

/* ═══ TOAST NOTIFICATION ═══ */
function _gpToast(msg,type){
  var old=document.getElementById('gp-toast');if(old)old.remove();
  var el=document.createElement('div');el.id='gp-toast';
  el.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;'
    +'padding:12px 22px;border-radius:14px;font-size:.92rem;font-weight:600;color:#fff;'
    +'box-shadow:0 4px 24px rgba(0,0,0,.18);max-width:88vw;text-align:center;pointer-events:none;'
    +'animation:_gpToastIn .25s ease;';
  el.style.background=type==='error'?'#c0392b':type==='success'?'#27ae60':'linear-gradient(135deg,#3E97AE,#2E7A8F)';
  el.textContent=msg;
  if(!document.getElementById('gp-toast-style')){
    var st=document.createElement('style');st.id='gp-toast-style';
    st.textContent='@keyframes _gpToastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(st);
  }
  document.body.appendChild(el);
  setTimeout(function(){el.style.opacity='0';el.style.transition='opacity .4s';setTimeout(function(){if(el.parentNode)el.remove();},400);},2800);
}

/* ═══ EXPORT / IMPORT ═══ */
function exportRoutines(){
  const routines=getSavedRoutines();
  if(!routines.length){
    _gpToast(LANG==='th'?'ยังไม่มีรูทีนที่บันทึกไว้':'No saved routines to export','error');
    return;
  }
  try{
    const blob=new Blob([JSON.stringify(routines,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download='glowphase-routines-'+Date.now()+'.json';
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    _gpToast(LANG==='th'?'ส่งออก '+routines.length+' รูทีนแล้ว ✓':'Exported '+routines.length+' routine'+(routines.length!==1?'s':'')+' ✓','success');
  }catch(err){_gpToast('Export failed: '+err.message,'error');}
}
function triggerImport(){var inp=document.getElementById('import-file');if(inp){inp.value='';inp.click();}}
function importRoutines(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(!Array.isArray(data))throw new Error(LANG==='th'?'รูปแบบไฟล์ไม่ถูกต้อง':'Invalid file format');
      const existing=getSavedRoutines();const existingIds=existing.map(r=>r.id);
      const newOnes=data.filter(r=>!existingIds.includes(r.id));
      setSavedRoutines([...existing,...newOnes]);
      const dup=data.length-newOnes.length;
      const msg=LANG==='th'
        ?'นำเข้า '+newOnes.length+' รูทีนแล้ว'+(dup?' ('+dup+' ซ้ำ)':'')
        :'Imported '+newOnes.length+' routine'+(newOnes.length!==1?'s':'')+(dup?' ('+dup+' duplicate'+(dup!==1?'s':'')+' skipped)':'');
      _gpToast(msg,'success');
      renderMyRoutines();
    }catch(err){_gpToast((t('alert_import_fail')||'Import failed: ')+err.message,'error');}
  };
  reader.readAsText(file);e.target.value='';
}

/* ═══ HOME PHASE WIDGET ═══ */
// Shared helper: computes the display data for the current phase state.
// Used by both the home widget and the journey strip.
function _getPhaseDisplayData(r){
  if(!r)return null;
  const _startDate=r.phaseStartedAt||r.createdAt;
  if(!_startDate)return null;
  const days=Math.max(1,Math.floor((Date.now()-new Date(_startDate).getTime())/(1000*60*60*24))+1);
  const weeks=Math.ceil(days/7);
  const activePid=r.activePhase||'p1';
  const inRecovery=!!r.inRecoveryMode;
  const _phIcons={p1:'🛡',p2:'💧',p3:'✨',p4:'🌿'};
  if(inRecovery){
    return{icon:'🌿',label:t('js_ctx_recovery')+' · '+t('js_week')+' '+weeks,sub:t('js_recovery_sub'),days,weeks,isRecovery:true};
  }
  const ctx=t('js_ctx_'+activePid)||('Phase '+activePid.replace('p',''));
  const timeLabel=days>28?t('js_stable'):t('js_week')+' '+weeks;
  return{icon:_phIcons[activePid]||'🗓',label:ctx+' · '+timeLabel,sub:t('js_day')+' '+days+' '+t('js_day_suffix'),days,weeks,isRecovery:false,pid:activePid};
}

function renderHomePhaseWidget(){
  const legacy=document.getElementById('home-phase-widget'); if(legacy)legacy.innerHTML='';
  const dash=document.getElementById('home-dashboard'); if(dash)dash.innerHTML='';
  const panel=document.getElementById('hero-snapshot'); if(!panel)return;
  if(!window._heroSnapDefault) window._heroSnapDefault=panel.innerHTML;   // cache marketing default (new users)
  const routines=getSavedRoutines();
  const restore=function(){ panel.innerHTML=window._heroSnapDefault; };
  if(!routines.length){ restore(); return; }
  const r=routines.slice().sort(function(a,b){return new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt);})[0];
  const d=_getPhaseDisplayData(r);
  if(!d){ restore(); return; }
  const h=new Date().getHours();
  const greet=h<12?'hd_greet_morning':(h<18?'hd_greet_afternoon':'hd_greet_evening');
  const stable=(d.days>28)&&!d.isRecovery;
  const icon=d.isRecovery?'🌿':(stable?'💎':d.icon);
  const barrierKey=d.isRecovery?'hd_barrier_recovering':'hd_barrier_stable';
  const barrierIcon=d.isRecovery?'🛡':'🩵';
  const phaseNames={p1:t('js_ctx_p1'),p2:t('js_ctx_p2'),p3:t('js_ctx_p3'),p4:t('js_ctx_p4')};
  const crystalNames={p1:'🔷 Ice Crystal',p2:'💧 Aqua Crystal',p3:'✨ Aurora Crystal',p4:'🌙 Moon Crystal'};
  let phaseName,crystal;
  if(d.isRecovery){ phaseName=t('js_ctx_recovery')||'Recovery'; crystal='🌿 Recovery'; }
  else if(stable){ phaseName=t('js_ctx_p4')||'Maintenance'; crystal='💎 Glass Skin'; }
  else { phaseName=phaseNames[d.pid]||d.label; crystal=crystalNames[d.pid]||'🔷 Ice Crystal'; }
  // MERGE: keep the rich Skin-Snapshot panel design, populate it with the user's real routine data
  panel.innerHTML=`
    <div class="gp-snap-head">
      <span class="gp-snap-greet">${t(greet)} <span class="hd-spark">✨</span></span>
      <span class="panel-label" style="margin:0">${t('hd_snap_label')}</span>
    </div>
    <div class="gp-pill"><span class="icon icon-ice">${icon}</span><span><b>${d.label}</b> · ${d.sub}</span></div>
    <div class="gp-pill"><span class="icon icon-mint">${barrierIcon}</span><span>${t('hd_barrier_label')} · <b>${t(barrierKey)}</b></span></div>
    <div class="phase-result-card">
      <div class="phase-result-label">Your Current Phase</div>
      <div class="phase-result-name"><span class="phase-crystal">◆</span> ${phaseName}</div>
      <div class="phase-result-sub">${d.sub}</div>
      <div>
        <span class="result-tag tag-aqua">◈ ${crystal}</span>
        <span class="result-tag tag-mint" style="margin-left:6px">${barrierIcon} ${t(barrierKey)}</span>
      </div>
      <button class="gp-snap-cta" style="margin-top:14px" onclick="showPage('myroutine',null)">${t('hd_cta')}</button>
    </div>`;
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
  if(id==='home')renderHomePhaseWidget();
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


/* Task 6 - Night Routine UX Polish */
var T6={
  en:{checkin_title:'Finished your routine?',checkin_sub:'Tap to log your progress',checkin_btn:'Log it',checkin_done:'Routine done today!',
    checkin_missed_1:'You missed yesterday — no worries, just keep going 💪',
    checkin_missed_n:'You missed {n} days — let\'s get back on track 💪',
    checkin_streak:'{n}-day streak 🔥',
    sos_title:'Skin Reacting?',sos_sub:'Follow these emergency steps',sos_close:'Got it',sos_tip1:'Stop the suspected product immediately',sos_tip2:'Rinse face with cool plain water',sos_tip3:'Apply a thin layer of Vaseline or barrier cream',sos_tip4:'Avoid acids and retinol for 5-7 days',sos_tip5:'See a doctor if swelling or hives develop'},
  th:{checkin_title:'ทำรูทีนเสร็จแล้ว?',checkin_sub:'แตะเพื่อสะสมความคืบหน้า',checkin_btn:'สะสม',checkin_done:'ทำรูทีนวันนี้แล้ว!',
    checkin_missed_1:'พลาดเมื่อวาน — ไม่เป็นไร ไปต่อเลย 💪',
    checkin_missed_n:'พลาดไป {n} วัน — กลับมาทำต่อได้เลย 💪',
    checkin_streak:'{n} วันต่อเนื่อง 🔥',
    sos_title:'ผิวแพ้?',sos_sub:'ทำตามขั้นตอนฉุกเฉน',sos_close:'เข้าใจแล้ว',sos_tip1:'หยุดใช้ผลิตภัณฑ์ที่สงสัยทันที',sos_tip2:'ล้างหน้าด้วน้ำสะอาด อุณหภูมิห้อง',sos_tip3:'ทา Vaseline หรือ barrier cream บางๆ',sos_tip4:'หลีกเลี่ยงกรดและเรตินอล 5-7 วัน',sos_tip5:'หากมีอาการบวมแดง ปรึกษาแพทย์'}
};
function t6(k){return(T6[LANG]&&T6[LANG][k])||T6.en[k]||k;}
var GP_AMOUNT_RULES=[
  // Water-only steps — must come FIRST to prevent cleanser keyword match on note text
  {kw:['water rinse','rinse face'],
    amt:'',      amt_th:'',
    wait:'Pat dry gently',  wait_th:'ซับหน้าเบาๆ'},
  {kw:['cleansing balm','cleansing oil','oil cleanser'],
    amt:'1-2 pumps - massage 60s',           amt_th:'ต1-2 ปั๊ม - นวด 60 วินาที',
    wait:'Pat dry before next step',         wait_th:'ซับให้แห้งก่อนขั้นตอนต่อไป'},
  {kw:['foam','cleansing foam','gel cleanser','cleanser'],
    amt:'Cherry-sized amount',               amt_th:'ปริมาณเท่าลูกเชอร์รี่',
    wait:'Pat dry - 30s',                    wait_th:'ซับให้แห้ง - 30 วินาที'},
  {kw:['toner pad','toner pads'],
    amt:'1 pad - swipe then pat',            amt_th:'1 แผ่น - ปัดแล้วแตะ',
    wait:'20-30s - let absorb',              wait_th:'20-30 วินาที - ให้ดูดซึม'},
  {kw:['toner','skin softener','lotion toner'],
    amt:'2-3 drops or half pad',             amt_th:'2-3 หยด หรือครึ่งแผ่น',
    wait:'30s - pat in',                     wait_th:'30 วินาที - แตะให้ซึม'},
  {kw:['essence'],
    amt:'2-3 drops - press and pat',         amt_th:'2-3 หยด - กดแล้วแตะ',
    wait:'30s',                              wait_th:'30 วินาที'},
  {kw:['retinol','retinal','tretinoin'],
    amt:'Rice-grain - less is more',         amt_th:'ปริมาณเท่าเมล็ดข้าว - น้อยแต่มาก',
    wait:'20-30 min before moisturiser',     wait_th:'20-30 นาทีก่อนครีมบำรุง'},
  {kw:['vitamin c','ascorbic acid'],
    amt:'2-3 drops evenly',                  amt_th:'2-3 หยด ทาทั่ว',
    wait:'1 min dry-down',                   wait_th:'1 นาที รอให้แห้ง'},
  {kw:['aha','bha','pha','exfoliant','peeling'],
    amt:'Thin layer - avoid eye area',       amt_th:'ทาบางๆ - หลีกเลี่ยงรอบดวงตา',
    wait:'10 min - no actives on top',       wait_th:'10 นาที - ไม่ใช้ actives ซ้อน'},
  {kw:['serum','ampoule'],
    amt:'2-3 drops - press in',              amt_th:'2-3 หยด - กดให้ซึม',
    wait:'60s - let sink in',                wait_th:'60 วินาที - รอให้ดูดซึม'},
  {kw:['eye cream','eye gel'],
    amt:'Millet grain each eye',             amt_th:'เมล็ดข้า฿ท่างต่อข้าง',
    wait:'',                                 wait_th:''},
  {kw:['sleeping mask','sleeping pack'],
    amt:'Thin layer - last step',            amt_th:'ทาบางๆ - ขั้นสุดท้าย',
    wait:'',                                 wait_th:''},
  {kw:['moisturizer','moisturiser','cream','gel cream'],
    amt:'Hazelnut-sized - warm first',       amt_th:'เฮเซลนัต - อุ่นในมือก่อน',
    wait:'',                                 wait_th:''},
  {kw:['sunscreen','spf'],
    amt:'1/4 tsp full face',                 amt_th:'1/4 ช้อนชา ทั่วใบหน้า',
    wait:'',                                 wait_th:''},
  {kw:['mist','spray'],
    amt:'Hold 20cm - 2-3 sprays',            amt_th:'ห่าง 20ซม - พ่น 2-3 ครั้ง',
    wait:'Pat lightly',                      wait_th:'แตะเบาๆ'}
];
function guessAmountForStep(tx){if(!tx)return null;var l=tx.toLowerCase();for(var i=0;i<GP_AMOUNT_RULES.length;i++){var r=GP_AMOUNT_RULES[i];for(var j=0;j<r.kw.length;j++){if(l.indexOf(r.kw[j])>=0)return r;}}return null;}
function enhanceRoutineSteps(){var ss=document.querySelectorAll('.routine-step');if(!ss.length)return;var isTH=typeof LANG!=='undefined'&&LANG==='th';ss.forEach(function(s){if(s.querySelector('.rs-amount'))return;var b=s.querySelector('.rs-body');if(!b)return;var tx=['.rs-name','.rs-note','.rs-brand'].map(function(q){var e=s.querySelector(q);return e?e.textContent:'';}).join(' ');var r=guessAmountForStep(tx);if(r&&(isTH?r.amt_th:r.amt)){var el=document.createElement('div');el.className='rs-amount';el.textContent=isTH?(r.amt_th||r.amt):r.amt;b.appendChild(el);}});var a=Array.prototype.slice.call(ss);a.forEach(function(s,i){if(i===a.length-1)return;if(s.nextElementSibling&&s.nextElementSibling.classList.contains('rs-wait-chip'))return;var tx=['.rs-name','.rs-note'].map(function(q){var e=s.querySelector(q);return e?e.textContent:'';}).join(' ');var r=guessAmountForStep(tx);var wt=isTH?(r&&r.wait_th!==undefined?r.wait_th:r&&r.wait):r&&r.wait;if(r&&wt){var c=document.createElement('div');c.className='rs-wait-chip';c.textContent=wt;s.parentNode.insertBefore(c,s.nextSibling);}});}

function triggerSkinReactionAlert(){var ex=document.getElementById('gp-sos-sheet');if(ex)ex.remove();var tips=[t6('sos_tip1'),t6('sos_tip2'),t6('sos_tip3'),t6('sos_tip4'),t6('sos_tip5')];var h=tips.map(function(tip){return '<div class="gp-sos-tip"><span class="gp-sos-tip-dot"></span>'+tip+'</div>';}).join('');var ov=document.createElement('div');ov.id='gp-sos-sheet';ov.className='gp-sos-overlay';ov.innerHTML='<div class="gp-sos-sheet"><div class="gp-sos-handle"></div><div class="gp-sos-head"><span class="gp-sos-icon">🚨</span><div><div class="gp-sos-title">'+t6('sos_title')+'</div><div class="gp-sos-sub">'+t6('sos_sub')+'</div></div></div>'+h+'<button class="gp-sos-close-btn" onclick="closeSosSheet()">'+t6('sos_close')+'</button></div>';ov.addEventListener('click',function(e){if(e.target===ov)closeSosSheet();});document.body.appendChild(ov);}
function closeSosSheet(){var el=document.getElementById('gp-sos-sheet');if(el){el.style.pointerEvents='none';if(el.parentNode)el.parentNode.removeChild(el);}}
function renderEmergencySOS(){if(document.getElementById('gp-sos-fab'))return;var f=document.createElement('button');f.id='gp-sos-fab';f.className='gp-sos-fab';f.title='Skin reaction emergency';f.innerHTML='🆘';f.onclick=triggerSkinReactionAlert;document.body.appendChild(f);}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',renderEmergencySOS);}else{renderEmergencySOS();}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',renderHomePhaseWidget);}else{renderHomePhaseWidget();}

document.addEventListener('DOMContentLoaded',()=>{
  const savedLang=localStorage.getItem('gp_lang')||'en';
  LANG=savedLang;
  document.querySelectorAll('.lang-btn').forEach(b=>{b.classList.toggle('active',b.textContent.toLowerCase()===savedLang);});
  applyTranslations();
  renderLibrary();
  initBuilder();
  renderConflictGrid();
  renderMyRoutines();
  /* Sync mobile drawer active-state on first load — previously only synced on showPage() navigation, so the drawer had no active pill until the user navigated once */
  var _initActiveBtn=document.querySelector('.nav-btn.active');
  if(_initActiveBtn && typeof _syncMobDrawerActive==='function') _syncMobDrawerActive(_initActiveBtn.dataset.page);
});

/* ── Mobile hamburger nav ── */
function toggleMobileNav(){
  var btn=document.getElementById('navHamburger');
  var drawer=document.getElementById('mobileNavDrawer');
  if(!btn||!drawer)return;
  var isOpen=drawer.classList.contains('open');
  if(isOpen){closeMobileNav();}else{openMobileNav();}
}
function openMobileNav(){
  var btn=document.getElementById('navHamburger');
  var drawer=document.getElementById('mobileNavDrawer');
  if(!btn||!drawer)return;
  btn.classList.add('open');
  btn.setAttribute('aria-expanded','true');
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden','false');
  document.addEventListener('click',_mobileNavOutsideClick,true);
}
function closeMobileNav(){
  var btn=document.getElementById('navHamburger');
  var drawer=document.getElementById('mobileNavDrawer');
  if(!btn||!drawer)return;
  btn.classList.remove('open');
  btn.setAttribute('aria-expanded','false');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden','true');
  document.removeEventListener('click',_mobileNavOutsideClick,true);
}
function _mobileNavOutsideClick(e){
  var drawer=document.getElementById('mobileNavDrawer');
  var btn=document.getElementById('navHamburger');
  if(drawer&&!drawer.contains(e.target)&&btn&&!btn.contains(e.target)){
    closeMobileNav();
  }
}
/* Keep active state in drawer in sync with main nav */
function _syncMobDrawerActive(pageId){
  document.querySelectorAll('.mob-nav-btn').forEach(function(b){
    b.classList.toggle('mob-active',b.dataset.page===pageId);
  });
}
/* Patch showPage to also sync drawer active state */
(function(){
  var _orig=window.showPage;
  if(typeof _orig==='function'){
    window.showPage=function(id,triggerBtn){
      _orig(id,triggerBtn);
      _syncMobDrawerActive(id);
    };
  }
})();

/* Crystal loading veil — remove node after the CSS fade finishes (CSS already auto-dismisses) */
window.addEventListener('load',function(){
  var l=document.getElementById('gp-loader');
  if(l) setTimeout(function(){ if(l&&l.parentNode) l.parentNode.removeChild(l); }, 1800);
});
