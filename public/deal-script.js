

// ══════════════════════════════════════════════════
// CORS / localhost detection + launcher download
// ══════════════════════════════════════════════════
function checkLocalhostRequired() {
  // No-op: Anthropic API supports direct browser access via anthropic-dangerous-direct-browser-access header.
  // The CORS banner has been removed. API calls work from file:// and any origin.
}

function downloadLauncher(os) {
  const filename = location.href.split('/').pop() || 'Riverwalk_Deal_Modeler_v2.html';
  let script, fname, mime;

  if (os === 'mac') {
    script = `#!/bin/bash
# Riverwalk Deal Modeler — script de inicio
# Doble clic para arrancar. Cierra esta ventana para parar.
cd "$(dirname "$0")"
echo "Arrancando servidor en http://localhost:8080 ..."
python3 -m http.server 8080 &
SERVER_PID=$!
sleep 1
open "http://localhost:8080/${filename}"
echo "Servidor activo. Cierra esta ventana para parar."
wait $SERVER_PID`;
    fname = 'RW_Iniciar.command';
    mime = 'text/plain';
  } else {
    script = `@echo off
:: Riverwalk Deal Modeler - script de inicio
:: Doble clic para arrancar
cd /d "%~dp0"
echo Arrancando servidor en http://localhost:8080 ...
start /b python -m http.server 8080
timeout /t 2 > nul
start chrome "http://localhost:8080/${filename}"
echo Servidor activo. Cierra esta ventana para parar.
pause`;
    fname = 'RW_Iniciar.bat';
    mime = 'text/plain';
  }

  const blob = new Blob([script], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  a.click();
  URL.revokeObjectURL(a.href);

  // Show instructions
  setTimeout(() => {
    alert(os === 'mac'
      ? 'Pasos:\n1. El archivo RW_Iniciar.command se ha descargado\n2. Ábrelo en Finder → click derecho → Abrir (primera vez pide permiso)\n3. Se abrirá el Terminal y Chrome automáticamente con la herramienta\n\nA partir de ahora haz doble clic en ese archivo para arrancar.'
      : 'Pasos:\n1. El archivo RW_Iniciar.bat se ha descargado\n2. Muévelo a la misma carpeta que el HTML\n3. Doble clic en RW_Iniciar.bat para arrancar\n\nChrome se abrirá automáticamente con la herramienta.');
  }, 300);
}

// ══════════════════════════════════════════════════
// API KEY MANAGEMENT
// ══════════════════════════════════════════════════
function saveAPIKey() {
  const val = document.getElementById('rw-api-key')?.value?.trim() || '';
  if (val) localStorage.setItem('rw_api_key', val);
  updateAPIKeyStatus();
}

function loadAPIKey() {
  const stored = localStorage.getItem('rw_api_key') || '';
  const el = document.getElementById('rw-api-key');
  if (el && stored) el.value = stored;
  updateAPIKeyStatus();
}

function getAPIKey() {
  return document.getElementById('rw-api-key')?.value?.trim() || localStorage.getItem('rw_api_key') || '';
}

function updateAPIKeyStatus() {
  const key = getAPIKey();
  const el = document.getElementById('api-key-status');
  if (!el) return;
  if (!key) {
    el.textContent = '✕'; el.style.color = 'rgba(224,85,85,0.7)'; el.title = 'Sin API Key';
  } else if (key.startsWith('sk-ant-')) {
    el.textContent = '✓'; el.style.color = 'rgba(82,192,122,0.8)'; el.title = 'API Key OK';
  } else {
    el.textContent = '⚠'; el.style.color = 'rgba(255,165,0,0.8)'; el.title = 'Formato inesperado';
  }
}

function getAPIHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

function checkAPIKey() {
  // API key is managed server-side
  return true;
}

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════
const $  = id => document.getElementById(id);
// V() — only strips thousand-separator dots (.) on inputs with data-fmt="money"
// For plain number inputs it uses parseFloat directly, preserving decimals like 12.5
const V  = id => {
  const el = $(id); if (!el) return 0;
  if (el.dataset && el.dataset.fmt === 'money') {
    // Money fields: dots are thousand separators, comma is decimal
    const raw = el.value.replace(/\./g,'').replace(',','.').replace(/[^\d.\-]/g,'');
    return parseFloat(raw) || 0;
  }
  // All other inputs: plain parseFloat (handles 12.5, 25, etc.)
  return parseFloat(el.value) || 0;
};
const S  = id => $(id).value || '';
const fmt  = n => Math.round(n).toLocaleString('es-ES') + ' €';
const fmtD = (n,d=2) => n.toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d}) + ' €';
const fmtK = n => { const a=Math.abs(n),s=n<0?'−':''; return a>=1e6?s+(a/1e6).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' M€':a>=1000?s+Math.round(a/1000).toLocaleString('es-ES')+' k€':fmt(n); };
const fmtPct = (n,d=1) => (n*100).toFixed(d)+'%';

// ── Money input auto-format ─────────────────────────
// Inputs with data-fmt="money" get formatted on blur, raw on focus
function setupMoneyInputs() {
  document.querySelectorAll('[data-fmt="money"]').forEach(inp => {
    // format immediately
    _applyMoneyFmt(inp);
    inp.addEventListener('focus', function() {
      const raw = parseFloat(this.value.replace(/\./g,'').replace(',','.').replace(/[^\d.\-]/g,''));
      this.value = isNaN(raw) ? '' : raw === 0 ? '' : raw;
      this.select();
    });
    inp.addEventListener('blur', function() {
      _applyMoneyFmt(this);
      update();
    });
  });
}
function _applyMoneyFmt(inp) {
  const raw = parseFloat(inp.value.replace(/\./g,'').replace(',','.').replace(/[^\d.\-]/g,''));
  if (!isNaN(raw)) inp.value = raw.toLocaleString('es-ES', {maximumFractionDigits:0});
}

// ── Carry mode: 'roi' (simple) | 'irr' (time-weighted, institutional) ──
let sfCarryMode = 'roi'; // ROI simple — más sencillo de explicar

// ══════════════════════════════════════════════════
// IRR
// ══════════════════════════════════════════════════
function calcIRR(cfs, g=0.02) {
  let r = g;
  for (let i=0; i<3000; i++) {
    let npv=0, d=0;
    for (let t=0; t<cfs.length; t++) {
      const disc = Math.pow(1+r,t);
      npv += cfs[t]/disc;
      d   -= t*cfs[t]/(disc*(1+r));
    }
    if (Math.abs(d)<1e-14) break;
    const nr = r - npv/d;
    if (!isFinite(nr)||isNaN(nr)) { r+=0.001; continue; }
    if (Math.abs(nr-r)<1e-10) return nr;
    r = nr;
  }
  return r;
}
const annIRR = mr => Math.pow(1+mr,12)-1;

// ══════════════════════════════════════════════════
// UI TOGGLES
// ══════════════════════════════════════════════════
let sfMode       = 'tramos';
let zcOn         = true;
let dealMode     = 'reforma';
let ampliacionOn = false;
let taxOn        = true;
let plusvaliaOn  = false; // permanently disabled — manual estimation only
let levMode      = 'ltv'; // 'ltv' | 'ltc'

function setLevMode(mode) {
  levMode = mode;
  const tog = (id, cls, active) => { const el=$(id); if(el) el.classList.toggle(cls, active); };
  tog('lev-ltv-btn', 'active', mode === 'ltv');
  tog('lev-ltc-btn', 'active', mode === 'ltc');
  const desc = $('lev-mode-desc');
  const lbl  = $('lev-slider-label');
  if (mode === 'ltv') {
    if (desc) desc.innerHTML = '<strong style="color:var(--text-b)">LTV</strong> — Loan-to-Value: el banco presta un % del <strong>precio de compra</strong>. Más habitual en hipotecas y bridge estándar.';
    if (lbl)  lbl.textContent = 'LTV (% sobre precio compra)';
  } else {
    if (desc) desc.innerHTML = '<strong style="color:var(--text-b)">LTC</strong> — Loan-to-Cost: el banco presta un % del <strong>coste total del proyecto</strong> (precio + CapEx + fees). Más habitual en financiación promotora y bridge para reforma integral.';
    if (lbl)  lbl.textContent = 'LTC (% sobre coste total)';
  }
  update();
}

function setPlusvaliaMode(on) {
  plusvaliaOn = false; // always off — removed from model
  // Clear auto display when switching to manual
  // plusvalia-calc-display removed
  update();
}

function setTaxMode(on) {
  taxOn = on;
  const tog = (id, cls, active) => { const el=$(id); if(el) el.classList.toggle(cls, active); };
  const set = (id, val) => { const el=$(id); if(el) el.style.display = val; };
  tog('tax-on-btn',  'active',  on);
  tog('tax-off-btn', 'active', !on);
  set('tax-fields',   on ? '' : 'none');
  set('tax-off-note', on ? 'none' : '');
  const kpiNote = $('kpi-roi-n');
  if (kpiNote) kpiNote.textContent = on ? 'Post fees + impuestos' : 'Post fees · sin impuestos';
  update();
}

function syncAmpliacion() {
  const bp  = V('buyPrice');
  const pct = parseFloat($('ampliacionPct')?.value || 0);
  const imp = Math.round(bp * pct / 100);
  const el  = $('ampliacion-importe-display');
  if (el) el.textContent = bp > 0 ? imp.toLocaleString('es-ES') + ' €' : '—';
}

function setAmpliacion(on) {
  ampliacionOn = on;
  const set = (id, val) => { const el=$(id); if(el) el.style.display = val; };
  const tog = (id, cls, active) => { const el=$(id); if(el) el.classList.toggle(cls, active); };
  tog('ampliacion-no-btn', 'active', !on);
  tog('ampliacion-si-btn', 'active',  on);
  set('ampliacion-fields',    on ? '' : 'none');
  set('cf-ampliacion-block',  on ? '' : 'none');
  update();
}

function syncAmpliacion() {
  // Sync both % inputs (calendar and timing section share the same %)
  const pctCal = parseFloat($('ampliacionPctCal')?.value) || 0;
  const pctCf  = parseFloat($('ampliacionPct')?.value) || 0;
  // Use whichever was last changed — they mirror each other
  const bp = V('buyPrice');
  const importe = Math.round(bp * pctCal / 100);
  const el1 = $('ampliacion-importe-cal');
  const el2 = $('ampliacion-importe-display');
  if (el1) el1.textContent = importe.toLocaleString('es-ES') + ' €';
  if (el2) el2.textContent = importe.toLocaleString('es-ES') + ' €';
  // Mirror pct values
  const ampPct = $('ampliacionPct');
  if (ampPct && ampPct.value !== String(pctCal)) ampPct.value = pctCal;
  update();
}

function setDealMode(mode) {
  dealMode = mode;
  const set = (id, val) => { const el=$(id); if(el) el.style.display = val; };
  const tog = (id, cls, on) => { const el=$(id); if(el) el.classList.toggle(cls, on); };
  tog('mode-reforma-btn',   'active', mode === 'reforma');
  tog('mode-pase-btn',      'active', mode === 'pase');
  tog('mode-edificio-btn',  'active', mode === 'edificio');
  set('pase-note',           mode === 'pase'    ? '' : 'none');
  set('edificio-panel',      mode === 'edificio' ? '' : 'none');
  set('isec-capex',          mode === 'reforma' ? '' : 'none');
  set('cf-capex-block',      mode === 'reforma' ? '' : 'none');
  set('osec-sens1',          mode === 'reforma' ? '' : 'none');
  set('osec-sens2',          mode === 'reforma' ? '' : 'none');
  // In edificio mode, hide most input sections except basic data
  ['isec-precios','isec-calendario','isec-adquisicion','isec-fees','isec-lev','isec-comp'].forEach(id => {
    const el = $(id);
    if (el) el.style.display = mode === 'edificio' ? 'none' : '';
  });
  if (mode === 'edificio') { renderEdificioUnits(); updateEdificio(); }
  set('fees-reforma-fields', mode === 'reforma' ? '' : 'none');
  set('fees-pase-fields',    mode === 'pase'    ? '' : 'none');
  update();
}

function setSFMode(m) {
  sfMode = m;
  $('sf-tramos-btn').classList.toggle('active', m==='tramos');
  $('sf-fijo-btn').classList.toggle('active', m==='fijo');
  $('sf-tramos-fields').style.display = m==='tramos' ? '' : 'none';
  $('sf-fijo-fields').style.display   = m==='fijo'   ? '' : 'none';
  update();
}
function toggleZC(on) {
  zcOn = on;
  $('zc-off').classList.toggle('active', !on);
  $('zc-on').classList.toggle('active', on);
  $('zc-fields').style.display = on ? '' : 'none';
  update();
}
function toggleSec(hd) {
  const body = hd.nextElementSibling;
  const arr  = hd.querySelector('.isec-arr');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  arr.classList.toggle('open', !open);
}
function syncMgmt(el) {
  const v = parseFloat(el.value);
  $('mgmtFeePct').value = v;
  $('mgmtSlider-rv').textContent = v.toFixed(1) + '% sobre precio + CapEx neto';
  update();
}
function syncPaseMgmt(el) {
  const v = parseFloat(el.value);
  $('paseMgmtPct').value = v;
  $('paseMgmtSlider-rv').textContent = v.toFixed(1) + '% sobre precio del activo';
  update();
}
function syncSlider(el, hidId, slId) {
  const v = parseInt(el.value);
  $(hidId).value = v;
  const labels = {0:'0% — Sin apalancamiento',10:'10%',20:'20%',30:'30%',40:'40% — Moderado',50:'50%',60:'60% — Elevado',70:'70%'};
  const overLabels = {0:'0% — Sin provisión',5:'5%',10:'10%',15:'15%',20:'20% — Recomendado',25:'25%',30:'30%',35:'35%',40:'40%'};
  const map = slId === 'ltvSlider' ? labels : overLabels;
  $(slId+'-rv').textContent = map[v] || v+'%';
  update();
}
function setCarryMode(m) {
  sfCarryMode = m;
  $('carry-roi-btn').classList.toggle('active', m==='roi');
  $('carry-irr-btn').classList.toggle('active', m==='irr');
  const desc = $('carry-mode-desc');
  if (m === 'irr') {
    desc.innerHTML = '<strong style="color:var(--gold)">TIR anualizada:</strong> los umbrales (12,5% / 25%) son tasas anualizadas. En una operación de 14 meses, el carry solo aplica si la TIR real supera esos umbrales. Más honesto, más institucional.';
  } else {
    desc.innerHTML = '<strong style="color:var(--text-b)">ROI simple:</strong> los umbrales se aplican sobre el retorno total acumulado sobre capital invertido, sin ajustar por tiempo.';
  }
  update();
}
// ── Auto-fill cashflow dates from arras date + configured months ──────────
function addMonths(dateStr, months) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + Math.round(months));
  return d.toISOString().split('T')[0];
}

function autoFillDates(force) {
  const dArras = $('cfDateArras')?.value;
  if (!dArras) return;

  const arasM    = V('arasMonths')  + (ampliacionOn ? V('ampliacionMeses') : 0);
  const saleM    = V('monthsToSale');
  const ampM     = ampliacionOn ? V('ampliacionMeses') : 0;
  const baseAras = V('arasMonths'); // months before escritura without ampliacion

  const dEsc   = addMonths(dArras, baseAras);
  const dVenta = addMonths(dArras, arasM + saleM);

  // CapEx cert dates: spread across the construction period (escritura → venta)
  const dCert50  = addMonths(dEsc, saleM * 0.40);
  const dCert70  = addMonths(dEsc, saleM * 0.60);
  const dEntrega = addMonths(dEsc, saleM * 0.85);

  // Ampliacion dates
  const dAmpliacion  = ampliacionOn ? addMonths(dArras, baseAras) : '';
  const dEscAmp      = ampliacionOn ? addMonths(dArras, arasM)    : '';

  // Only fill if empty or force=true
  const fill = (id, val) => {
    const el = $(id);
    if (el && (force || !el.value)) el.value = val;
  };

  fill('cfDateEscritura',    dEsc);
  fill('cfDateVenta',        dVenta);
  fill('cfDateCert50',       dCert50);
  fill('cfDateCert70',       dCert70);
  fill('cfDateEntrega',      dEntrega);
  fill('cfDateAmpliacion',   dAmpliacion);
  fill('cfDateEscrituraAmp', dEscAmp);

  update();
}

function syncAras(el, src) {
  const bp = V('buyPrice');
  if (src==='pct') {
    const raw = Math.round(bp * V('arasPct') / 100);
    $('arasAmt').value = raw.toLocaleString('es-ES');
  } else if (src === 'amt') {
    const pct = bp > 0 ? (V('arasAmt')/bp*100).toFixed(1) : 0;
    $('arasPct').value = pct;
  } else {
    const pct = bp > 0 ? (V('arasAmt')/bp*100).toFixed(1) : 0;
    $('arasPct').value = pct;
  }
  syncAmpliacion();
  update();
}

// ══════════════════════════════════════════════════
// CORE CALCULATION
// ══════════════════════════════════════════════════

// IRR-based carry: convert annual thresholds to profit thresholds
// given the actual cashflow timing, compute what profit level
// corresponds to a given annualised IRR threshold.
function irrThresholdToProfit(targetAnnIRR, totalInvest, arasAmt, arasMonths, monthsSale, capexNet, ivaCapex, mgmtFee, ivaFees, comunidadTotal, ibiTotal, itp, notaria, intermediaryFee, brokerBuyFee) {
  // We use binary search: find grossProfit such that IRR(cashflows) = targetAnnIRR
  // The IRR cashflow structure mirrors buildCF but parameterised on netProfit
  const targetMonthly = Math.pow(1 + targetAnnIRR, 1/12) - 1;
  const exitMonth = Math.round(arasMonths + monthsSale);
  const totalMonths = arasMonths + monthsSale;

  function irrForProfit(netP) {
    const len = exitMonth + 1;
    const cf = new Array(len).fill(0);
    cf[0] -= arasAmt;
    const escritura = Math.min(Math.round(arasMonths), len-1);
    cf[escritura] -= (totalInvest - arasAmt - (capexNet + ivaCapex + mgmtFee + ivaFees));
    const constructionMonths = Math.max(1, Math.round(monthsSale * 0.7));
    const capexPerMonth = (capexNet + ivaCapex + mgmtFee + ivaFees) / constructionMonths;
    for (let i = 0; i < constructionMonths; i++) {
      const idx = Math.min(escritura + i, len-1);
      cf[idx] -= capexPerMonth;
    }
    const holdingPerMonth = (comunidadTotal + ibiTotal) / totalMonths;
    for (let i = 0; i <= exitMonth; i++) cf[i] -= holdingPerMonth;
    cf[exitMonth] += totalInvest + netP;
    const mr = calcIRR(cf, 0.02);
    return annIRR(mr);
  }

  // Binary search for netProfit that yields targetAnnIRR
  let lo = -totalInvest, hi = totalInvest * 5;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (irrForProfit(mid) < targetAnnIRR) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2; // this is the netProfit (before carry/tax) at the threshold
}

// calcSuccessFee: 2-arg version always works (ROI mode or fijo)
// Full version (many args) uses IRR carry when sfCarryMode='irr'
function calcSuccessFee(grossProfit, totalInvest, _irrUnused, arasAmt, arasMonths, monthsSale, capexNet, ivaCapex, mgmtFee, ivaFees, comunidadTotal, ibiTotal, itp, notaria, intermediaryFee, brokerBuyFee) {
  if (sfMode === 'fijo') return Math.max(0, grossProfit) * (V('sfFijoPct') / 100);
  const p0 = V('sf0P') / 100, p1 = V('sf1P') / 100, p2 = V('sf2P') / 100;
  const hasTimingParams = (arasAmt !== undefined);

  let t1, t2;
  if (sfCarryMode === 'irr' && hasTimingParams) {
    t1 = irrThresholdToProfit(V('sf1T')/100, totalInvest, arasAmt, arasMonths, monthsSale, capexNet, ivaCapex, mgmtFee, ivaFees, comunidadTotal, ibiTotal, itp, notaria, intermediaryFee, brokerBuyFee);
    t2 = irrThresholdToProfit(V('sf2T')/100, totalInvest, arasAmt, arasMonths, monthsSale, capexNet, ivaCapex, mgmtFee, ivaFees, comunidadTotal, ibiTotal, itp, notaria, intermediaryFee, brokerBuyFee);
  } else {
    // ROI-simple fallback (2-arg call, or roi mode)
    t1 = V('sf1T') / 100 * totalInvest;
    t2 = V('sf2T') / 100 * totalInvest;
  }
  if (grossProfit <= 0) return 0;
  let sf = Math.min(grossProfit, t1) * p0;
  if (grossProfit > t1) sf += (Math.min(grossProfit, t2) - t1) * p1;
  if (grossProfit > t2) sf += (grossProfit - t2) * p2;
  return sf;
}

// Convenience ROI-only version for sensitivity and breakeven approximations
function calcSFRoi(gP, totInv) {
  if (sfMode === 'fijo') return Math.max(0, gP) * (V('sfFijoPct') / 100);
  const p0 = V('sf0P')/100, p1 = V('sf1P')/100, p2 = V('sf2P')/100;
  const t1 = V('sf1T')/100 * totInv, t2 = V('sf2T')/100 * totInv;
  if (gP <= 0) return 0;
  let sf = Math.min(gP, t1) * p0;
  if (gP > t1) sf += (Math.min(gP, t2) - t1) * p1;
  if (gP > t2) sf += (gP - t2) * p2;
  return sf;
}

function calc() {
  const buyPrice   = V('buyPrice');
  const surfCapex  = V('surfCapex');
  const surfSale   = surfCapex; // en España el precio de venta es sobre metros construidos
  const arasAmt    = V('arasAmt');
  const arasMonths  = V('arasMonths') + (ampliacionOn ? V('ampliacionMeses') : 0);
  const monthsSale  = V('monthsToSale');
  const totalMonths = arasMonths + monthsSale;
  const iva = V('ivaObra') / 100;

  // ADQUISICIÓN
  const itp             = buyPrice * V('itpPct') / 100;
  const notaria         = V('notaria') + V('notariaAjuste');
  const comunidadTotal  = V('comunidad') * totalMonths;
  const ibiTotal        = V('ibi') * (totalMonths / 12);
  const intermediaryFee = V('intermediaryFee');
  const brokerBuyFixed  = V('brokerBuyFixed');
  const brokerBuyFee    = brokerBuyFixed > 0 ? brokerBuyFixed : buyPrice * V('brokerBuyPct') / 100;
  const totalAcq        = buyPrice + itp + notaria + comunidadTotal + ibiTotal + intermediaryFee + brokerBuyFee;

  // ── PASE MODE: sin CapEx, management fee sobre precio, carry sobre beneficio post-fees ──
  if (dealMode === 'pase') {
    const iva         = V('ivaObra') / 100;
    const capexNet    = 0;
    // Management fee — base = precio activo (sin capex, sin gastos)
    const paseMgmtPct  = V('paseMgmtPct') / 100;
    const mgmtFee      = buyPrice * paseMgmtPct;
    const mgmtFeeIVA   = mgmtFee * iva;
    const mgmtFeeTotal = mgmtFee + mgmtFeeIVA;
    const totalFeesNet  = mgmtFee;
    const ivaCapex     = 0;
    const ivaFees      = mgmtFeeIVA;
    const totalIVA     = ivaFees; // IVA mgmt fee — incluido como coste (recuperabilidad según estructura fiscal)
    const totalInvest  = totalAcq + mgmtFeeTotal;
    const brokerPct    = V('brokerExit') / 100;
    const exitFixed    = V('exitFixed') + V('exitFixedAjuste');
    const taxRate      = taxOn ? V('taxRate') / 100 : 0;
    const carryPct     = V('paseCarryPct') / 100;
    const carryIVAPct  = V('paseCarryIVA') / 100;

    function scPase(exitM2) {
      const saleGross    = exitM2 * surfSale;
      const brokerCost   = saleGross * brokerPct;
      const exitCosts    = brokerCost + exitFixed;
      // Beneficio bruto = venta - costes salida - inversión total (incl. mgmt fee)
      const grossProfit  = saleGross - exitCosts - totalInvest;
      // Carry sobre beneficio neto de toda la inversión (precio + CapEx + fees + IVA + gastos)
      // Base = venta bruta - costes salida - inversión total completa con IVA
      // Así el carry solo aplica sobre lo que excede el coste real global del proyecto
      const carry        = Math.max(0, grossProfit) * carryPct;
      const carryIVA     = carry * carryIVAPct;
      const carryTotal   = carry + carryIVA;
      const afterCarry   = grossProfit - carryTotal;
      const tax          = Math.max(0, afterCarry) * taxRate;
      const netProfit    = afterCarry - tax;
      const roiNet       = netProfit / totalInvest;
      return {
        saleGross, brokerCost, exitCosts, grossProfit,
        roiGross: grossProfit / totalInvest,
        sf: carryTotal, carry, carryIVA,
        afterSF: afterCarry, tax, netProfit, roiNet,
        roiPostCarry: afterCarry / totalInvest
      };
    }

    const pess = scPase(V('exitP'));
    const base = scPase(V('exitB'));
    const opt  = scPase(V('exitO'));

    // IRR for pase — arras out, (optional ampliacion), escritura out, venta in
    function getIRRpase(sc) {
      const hasAmp   = ampliacionOn;
      const ampMeses = hasAmp ? V('ampliacionMeses') : 0;
      const ampPctV  = hasAmp ? (parseFloat($('ampliacionPctCal')?.value || 0) / 100) : 0;
      const ampImp   = hasAmp ? Math.round(buyPrice * ampPctV) : 0;
      const exitMonth = Math.round(arasMonths + monthsSale + ampMeses);
      const cf = new Array(exitMonth + 1).fill(0);
      cf[0] -= arasAmt;
      if (hasAmp && ampMeses > 0) {
        const ampIdx = Math.min(Math.round(arasMonths), exitMonth);
        cf[ampIdx] -= ampImp; // additional arras at original arras end
      }
      const esc = Math.min(Math.round(arasMonths + ampMeses), exitMonth);
      cf[esc] -= (totalInvest - arasAmt - ampImp);
      const hold = (comunidadTotal + ibiTotal) / Math.max(1, totalMonths + ampMeses);
      for (let i = 0; i <= exitMonth; i++) cf[i] -= hold;
      cf[exitMonth] += totalInvest + sc.netProfit;
      return annIRR(calcIRR(cf, 0.025));
    }

    const irrBase = getIRRpase(base);
    const irrPess = getIRRpase(pess);
    const irrOpt  = getIRRpase(opt);
    const moicBase = totalInvest > 0 ? (totalInvest + base.netProfit) / totalInvest : 1;

    // Breakeven
    function bePase() {
      let lo = 1000, hi = 50000;
      for (let i = 0; i < 80; i++) {
        const mid = (lo+hi)/2;
        if (scPase(mid).netProfit > 0) hi = mid; else lo = mid;
      }
      return (lo+hi)/2;
    }

    // Leverage (simplified for pase)
    const ltvPct = V('ltv') / 100;
    const levCalcPase = (sc, ltvFrac) => {
      const loanBase = levMode === 'ltc' ? totalInvest : buyPrice;
      const loan     = loanBase * ltvFrac;
      const interest = loan * V('bridgeRate')/100 * V('bridgeMonths')/12;
      const equity = totalInvest - loan;
      const afterInt = sc.afterSF - interest;
      const taxLev = Math.max(0, afterInt) * taxRate;
      const netLev = afterInt - taxLev;
      return { loan, interest, equity, netProfitLev: netLev, roe: equity>0?netLev/equity:0, irr: 0, moic: equity > 0 ? (equity + netLev) / equity : 1 };
    };

    return {
      dealMode: 'pase',
      buyPrice, surfSale, surfCapex, arasAmt, arasMonths, monthsSale, totalMonths,
      itp, notaria, comunidadTotal, ibiTotal, intermediaryFee, brokerBuyFee,
      obraNet:0, decoNet:0, zcNet:0, capexNet, ivaCapex,
      mgmtFeeBase: buyPrice, mgmtFee, totalFeesNet, ivaFees, totalIVA,
      totalAcq, totalInvest,
      pess, base, opt,
      irrBase, irrPess, irrOpt, moicBase,
      lev0: levCalcPase(base,0), lev40: levCalcPase(base,0.4), lev60: levCalcPase(base,0.6), ltvPct,
      bePriceM2: bePase(),
      carryPct, carryIVA: V('paseCarryIVA')/100
    };
  }

  // ── REFORMA MODE (original) ───────────────────────────────────────────
  const overPct  = V('overPct') / 100;
  const obraNet  = V('obraM2') * surfCapex * (1 + overPct);
  const decoNet  = V('decoM2') * surfCapex * (1 + overPct);
  const zcNet    = zcOn ? V('zcCost') : 0;
  const capexNet = obraNet + decoNet + zcNet;

  // FEES RIVERWALK (sin IVA)
  const mgmtFeeBase = buyPrice + capexNet;
  const mgmtFee     = mgmtFeeBase * V('mgmtFeePct') / 100;
  const totalFeesNet = mgmtFee;

  // IVA
  const ivaCapex = capexNet * iva;
  const ivaFees  = totalFeesNet * iva;
  const totalIVA = ivaCapex + ivaFees;

  // TOTAL
  const totalInvest = totalAcq + capexNet + totalFeesNet + totalIVA;

  // EXIT
  const brokerPct = V('brokerExit') / 100;
  const exitFixed = V('exitFixed') + V('exitFixedAjuste');
  const taxRate   = taxOn ? V('taxRate') / 100 : 0;

  // Shared carry params bundle
  const cp = { arasAmt, arasMonths, monthsSale, capexNet, ivaCapex, mgmtFee, ivaFees,
               comunidadTotal, ibiTotal, itp, notaria, intermediaryFee, brokerBuyFee };

  // buildCF: exact tranche structure
  function buildCF(netProfit) {
    const exitMonth = Math.round(arasMonths + monthsSale);
    const len = exitMonth + 1;
    const cf  = new Array(len).fill(0);
    // Arras
    cf[0] -= arasAmt;
    // Arras: 50% mgmt fee + IVA
    cf[0] -= (mgmtFee * 0.5) * (1 + iva);
    // Escritura
    const esc = Math.min(Math.round(arasMonths), len - 1);
    cf[esc] -= (buyPrice - arasAmt) + itp + notaria + intermediaryFee + brokerBuyFee;
    // Escritura: 50% mgmt fee restante + IVA
    cf[esc] -= (mgmtFee * 0.5) * (1 + iva);
    // CapEx tramos: 50% escritura, 20% cert50, 20% cert70, 10% entrega
    // We approximate cert dates by month offsets from escritura
    const capexWithIVA = capexNet * (1 + iva);
    const cert50Month  = Math.min(esc + Math.round(monthsSale * 0.40), len - 1);
    const cert70Month  = Math.min(esc + Math.round(monthsSale * 0.60), len - 1);
    const entregaMonth = Math.min(esc + Math.round(monthsSale * 0.85), len - 1);
    cf[esc]         -= capexWithIVA * 0.50;
    cf[cert50Month] -= capexWithIVA * 0.20;
    cf[cert70Month] -= capexWithIVA * 0.20;
    cf[entregaMonth]-= capexWithIVA * 0.10;
    // Comunidad + IBI spread monthly
    const hold = (comunidadTotal + ibiTotal) / Math.max(1, totalMonths);
    for (let i = 0; i <= exitMonth; i++) cf[i] -= hold;
    // Exit
    cf[exitMonth] += totalInvest + netProfit;
    return cf;
  }

  function getIRRforProfit(netP) {
    const cf = buildCF(netP);
    const mr = calcIRR(cf, 0.025);
    return annIRR(mr);
  }

  // Scenario: need 2-pass because IRR carry depends on netProfit which depends on carry
  function sc(exitM2) {
    const saleGross   = exitM2 * surfSale;
    const brokerCost  = saleGross * brokerPct;
    const exitCosts   = brokerCost + exitFixed;
    const grossProfit = saleGross - exitCosts - totalInvest;
    const roiGross    = grossProfit / totalInvest;

    // For IRR carry we need to iterate: SF depends on IRR, IRR depends on netProfit, netProfit depends on SF
    // Solve iteratively (converges in 3-5 iterations)
    let sf = 0, netProfit = 0, irr = 0;
    for (let iter = 0; iter < 8; iter++) {
      sf = calcSuccessFee(grossProfit, totalInvest,
        irr, cp.arasAmt, cp.arasMonths, cp.monthsSale,
        cp.capexNet, cp.ivaCapex, cp.mgmtFee, cp.ivaFees,
        cp.comunidadTotal, cp.ibiTotal, cp.itp, cp.notaria,
        cp.intermediaryFee, cp.brokerBuyFee);
      const afterSF = grossProfit - sf;
      const tax     = Math.max(0, afterSF) * taxRate;
      netProfit     = afterSF - tax;
      irr           = getIRRforProfit(netProfit);
    }
    const afterSF = grossProfit - sf;
    const tax     = Math.max(0, afterSF) * taxRate;
    netProfit     = afterSF - tax;
    const roiNet  = netProfit / totalInvest;
    irr           = getIRRforProfit(netProfit);

    // Carry breakdown for display
    const t1Profit = sfCarryMode === 'irr'
      ? irrThresholdToProfit(V('sf1T')/100, totalInvest, cp.arasAmt, cp.arasMonths, cp.monthsSale, cp.capexNet, cp.ivaCapex, cp.mgmtFee, cp.ivaFees, cp.comunidadTotal, cp.ibiTotal, cp.itp, cp.notaria, cp.intermediaryFee, cp.brokerBuyFee)
      : V('sf1T')/100 * totalInvest;
    const t2Profit = sfCarryMode === 'irr'
      ? irrThresholdToProfit(V('sf2T')/100, totalInvest, cp.arasAmt, cp.arasMonths, cp.monthsSale, cp.capexNet, cp.ivaCapex, cp.mgmtFee, cp.ivaFees, cp.comunidadTotal, cp.ibiTotal, cp.itp, cp.notaria, cp.intermediaryFee, cp.brokerBuyFee)
      : V('sf2T')/100 * totalInvest;

    return {
      saleGross, brokerCost, exitCosts, grossProfit, roiGross,
      sf, afterSF: grossProfit - sf,
      roiPostCarry: (grossProfit - sf) / totalInvest,
      tax: Math.max(0, grossProfit - sf) * taxRate,
      netProfit, roiNet, irr, t1Profit, t2Profit
    };
  }

  const pess = sc(V('exitP'));
  const base = sc(V('exitB'));
  const opt  = sc(V('exitO'));

  // LEVERAGE (base scenario)
  const ltvPct      = V('ltv') / 100;
  const bridgeRate  = V('bridgeRate') / 100;
  const bridgeMonths= V('bridgeMonths');

  function levCalc(scResult, ltvFrac) {
    const loanBase = levMode === 'ltc' ? totalInvest : buyPrice;
    const loan      = loanBase * ltvFrac;
    const rate      = ltvFrac > 0.5 ? bridgeRate + 0.005 : bridgeRate;
    const interest  = loan * rate * (bridgeMonths / 12);
    const equity    = totalInvest - loan;
    const afterInt  = scResult.afterSF - interest;
    const taxLev    = Math.max(0, afterInt) * taxRate;
    const netLev    = afterInt - taxLev;
    const roe       = equity > 0 ? netLev / equity : 0;
    const cf        = buildCF(scResult.netProfit);
    if (Math.round(arasMonths) < cf.length) cf[Math.round(arasMonths)] += loan;
    cf[cf.length - 1] = equity + netLev;
    const mr = calcIRR(cf, 0.025);
    return { loan, interest, equity, netProfitLev: netLev, roe, irr: annIRR(mr), moic: equity > 0 ? (equity + netLev) / equity : 1 };
  }

  const lev0  = levCalc(base, 0);
  const lev40 = levCalc(base, 0.40);
  const lev60 = levCalc(base, 0.60);

  // BREAKEVEN (after carry + tax)
  function breakeven() {
    // Breakeven = precio al que beneficio bruto = 0 (antes de carry e impuestos)
    let lo = 3000, hi = 50000;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (sc(mid).grossProfit > 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }
  const bePriceM2 = breakeven();

  return {
    buyPrice, surfSale, surfCapex, arasAmt, arasMonths, monthsSale, totalMonths,
    itp, notaria, comunidadTotal, ibiTotal, intermediaryFee, brokerBuyFee,
    obraNet, decoNet, zcNet, capexNet, ivaCapex,
    mgmtFeeBase, mgmtFee, totalFeesNet, ivaFees, totalIVA,
    totalAcq, totalInvest,
    pess, base, opt,
    irrBase: base.irr, irrPess: pess.irr, irrOpt: opt.irr,
    lev0, lev40, lev60, ltvPct,
    bePriceM2
  };
}

// ══════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════
function render(m) {
  $('deal-name-display').textContent = (S('dealName') || '—') + (S('dealAddress') ? '  ·  ' + S('dealAddress') : '');

  // ── INVESTOR CAPITAL BANNER ────────────────────────
  const banner = $('investor-banner');
  if (banner) {
    const bannerLtvFrac = m.ltvPct || 0;
    const bannerIsLev   = bannerLtvFrac > 0;
    banner.style.display = bannerIsLev ? '' : 'none';
    if (bannerIsLev) {
      const bannerLoanBase = levMode === 'ltc' ? m.totalInvest : m.buyPrice;
      const bannerLoan     = bannerLoanBase * bannerLtvFrac;
      const bannerEquity   = m.totalInvest - bannerLoan;

      function levRet(sc) {
        const rate     = bannerLtvFrac > 0.5 ? V('bridgeRate')/100 + 0.005 : V('bridgeRate')/100;
        const interest = bannerLoan * rate * V('bridgeMonths') / 12;
        const afterFees = (sc.afterSF !== undefined ? sc.afterSF : sc.netProfit + (taxOn ? sc.tax : 0));
        const afterInt  = afterFees - interest;
        const tax2      = Math.max(0, afterInt) * (taxOn ? V('taxRate')/100 : 0);
        const net       = afterInt - tax2;
        return { net, roe: bannerEquity > 0 ? net / bannerEquity : 0, moic: bannerEquity > 0 ? (bannerEquity + net) / bannerEquity : 1 };
      }
      const bLp = levRet(m.pess), bLb = levRet(m.base), bLo = levRet(m.opt);

      $('banner-equity').textContent     = fmt(bannerEquity);
      $('banner-equity-sub').textContent = `${levMode.toUpperCase()} ${(bannerLtvFrac*100).toFixed(0)}% · deuda ${fmt(bannerLoan)} · coste total ${fmt(m.totalInvest)}`;

      const fillR = (id, lev, color) => {
        const el = $(id);
        if (el) { el.textContent = fmtPct(lev.roe); el.style.color = color; }
      };
      fillR('banner-roe-p', bLp, '#E05555');
      fillR('banner-roe-b', bLb, '#ffffff');
      fillR('banner-roe-o', bLo, '#52C07A');

      const fillN = (id, lev) => {
        const el = $(id);
        if (el) el.textContent = `ROE · ${fmtK(lev.net)} neto · ${lev.moic.toFixed(2)}×`;
      };
      fillN('banner-net-p', bLp);
      fillN('banner-net-b', bLb);
      fillN('banner-net-o', bLo);
    }
  }

  // KPIs
  const ltvFrac   = m.ltvPct || 0;
  const isLev     = ltvFrac > 0;
  const equityAmt = isLev ? m.lev0.equity : m.totalInvest; // lev0 always has equity = totalInvest - loan
  const loanAmt   = isLev ? (levMode === 'ltc' ? m.totalInvest : m.buyPrice) * ltvFrac : 0;

  const kTotalLbl = $('kpi-total-lbl');
  const kTotalN   = $('kpi-total-n');
  if (kTotalLbl) kTotalLbl.textContent = isLev ? 'Capital invertido (equity)' : 'Inversión total';
  $('kpi-total').textContent = fmtK(isLev ? m.lev0.equity : m.totalInvest);
  // add €/m² acquisition note
  const kpiTotalN2 = $('kpi-total-n');
  if (kpiTotalN2 && !isLev) {
    const acqPm2 = m.surfCapex > 0 ? Math.round(m.buyPrice / m.surfCapex) : 0;
    kpiTotalN2.textContent = `${fmt(m.totalInvest)} · compra a ${acqPm2.toLocaleString('es-ES')} €/m²`;
  }
  if (kTotalN) kTotalN.textContent = isLev
    ? `${levMode.toUpperCase()} ${(ltvFrac*100).toFixed(0)}% · deuda ${fmtK(loanAmt)}`
    : 'Todo incluido · sin apalancamiento';
  const kProfit = $('kpi-profit');
  kProfit.textContent = fmtK(m.base.netProfit);
  kProfit.className = 'kpi-v ' + (m.base.netProfit>0?'up':'down');
  const beMarg = ((V('exitP')/m.bePriceM2-1)*100).toFixed(0);
  $('kpi-be').textContent = Math.round(m.bePriceM2).toLocaleString('es-ES') + ' €/m²';
  const kpiBeTotal = $('kpi-be-n');
  if (kpiBeTotal) kpiBeTotal.textContent = 'Bruto s/carry · total mín. ' + fmtK(m.bePriceM2 * m.surfCapex);
  $('kpi-be-n').textContent = '+'+beMarg+'% sobre escenario pesimista';

  // Exit price total display (input panel)
  const surf = m.surfCapex || 0;
  const setET = (id, ep) => { const el=$(id); if(el && surf) el.textContent = fmt(Math.round(ep * surf)); };
  setET('exit-total-p', V('exitP'));
  setET('exit-total-b', V('exitB'));
  setET('exit-total-o', V('exitO'));

  // TIMELINE
  const escrituraMonth = m.arasMonths;
  const exitMonth = m.arasMonths + m.monthsSale;
  const restoBuyAmt = m.buyPrice - m.arasAmt + m.itp + m.notaria + m.intermediaryFee;
  $('timeline-strip').innerHTML = `
    <div class="tl-node">
      <div class="tl-dot filled"></div>
      <div class="tl-label">Arras</div>
      <div class="tl-amount">${fmt(m.arasAmt)}</div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:40px">
      <div class="tl-line" style="width:100%;margin-top:0"></div>
      <div class="tl-line-label">${m.arasMonths}m</div>
    </div>
    <div class="tl-node">
      <div class="tl-dot filled"></div>
      <div class="tl-label">Escritura</div>
      <div class="tl-amount">${fmtK(restoBuyAmt+m.capexNet+m.totalFeesNet+m.totalIVA)}</div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:40px">
      <div class="tl-line" style="width:100%;margin-top:0"></div>
      <div class="tl-line-label">${m.monthsSale}m obra+venta</div>
    </div>
    <div class="tl-node">
      <div class="tl-dot exit"></div>
      <div class="tl-label">Venta</div>
      <div class="tl-amount" style="color:var(--green)">${fmtK(m.base.saleGross)}</div>
    </div>
    <div style="margin-left:16px;font-size:9px;color:var(--text-d);white-space:nowrap">
      Total ${exitMonth} meses · Inversión total ${fmt(m.totalInvest)}
    </div>`;

  // AMPLIACION IMPACT NOTE
  const impEl = $('ampliacion-impact');
  if (impEl && ampliacionOn) {
    const extraMeses = V('ampliacionMeses');
    const baseIRR = m.irrBase;
    impEl.innerHTML = `<strong style="color:var(--gold)">+${extraMeses} meses:</strong> la ampliación extiende el período de arras, incrementando la duración total a <strong>${m.totalMonths}m</strong> y reduciendo la TIR al <strong>${isFinite(baseIRR)?fmtPct(baseIRR):'—'}</strong> (escenario base). Asegúrate de que el precio de compra justifica el coste de oportunidad adicional.`;
  } else if (impEl) {
    impEl.innerHTML = '';
  }

  // SCENARIOS
  const isPase = m.dealMode === 'pase';
  // isLev already declared above in KPI block

  // Pick the right leverage result for the active LTV
  const levActive = m.ltvPct === 0.40 ? m.lev40 : m.ltvPct === 0.60 ? m.lev60 : m.lev0;

  // When leveraged, build equiv leveraged scenario results for pess/opt
  // (lev calc in calc() only runs on base — approximate pess/opt here)
  function levSc(sc) {
    if (!isLev) return null;
    const loanBase = levMode === 'ltc' ? m.totalInvest : m.buyPrice;
    const loan     = loanBase * m.ltvPct;
    const rate     = m.ltvPct > 0.5 ? V('bridgeRate')/100 + 0.005 : V('bridgeRate')/100;
    const interest = loan * rate * V('bridgeMonths') / 12;
    const equity   = m.totalInvest - loan;
    const afterInt = sc.afterSF - interest;
    const tax      = Math.max(0, afterInt) * (taxOn ? V('taxRate')/100 : 0);
    const netLev   = afterInt - tax;
    const roe      = equity > 0 ? netLev / equity : 0;
    return { loan, interest, equity, netProfitLev: netLev, roe };
  }
  const levPess = levSc(m.pess);
  const levBase = levSc(m.base);
  const levOpt  = levSc(m.opt);

  function scCard(sc, cls, label, exitM2, irr, lev) {
    if (isPase) {
      const capital  = isLev ? lev.equity : m.totalInvest;
      const netShow  = isLev ? lev.netProfitLev : sc.netProfit;
      const roiShow  = isLev ? lev.roe : sc.roiNet;
      const moic     = capital > 0 ? ((capital + netShow) / capital).toFixed(2) : '—';
      const irrShow  = isFinite(irr) ? fmtPct(irr) : '—';
      const durationMeses = m.arasMonths + m.monthsSale + (ampliacionOn ? V('ampliacionMeses') : 0);
      const totalVentaPase = exitM2 * m.surfCapex;
      return `<div class="sc-card ${cls}">
        <div class="sc-head">
          <div>${label}</div>
          <div style="font-size:11px;font-family:'DM Mono',monospace;font-feature-settings:'tnum' 1;margin-top:3px">
            <span style="color:var(--text-b);font-weight:700">${fmt(totalVentaPase)}</span>
            <span style="opacity:0.55;font-size:9.5px"> · ${exitM2.toLocaleString('es-ES')} €/m²</span>
          </div>
        </div>
        <div class="sc-big" style="font-size:36px">${irrShow}</div>
        <div class="sc-irr" style="font-size:10px;margin-bottom:4px">${isLev?'TIR equity':'TIR anual'} · ${durationMeses}m</div>
        <div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text-b);margin-bottom:10px">${moic}× MOIC · ROI bruto ${fmtPct(sc.roiGross)}</div>
        <div class="sc-div"></div>
        <div class="sc-r key"><span>${isLev?'Equity':'Capital'}</span><span>${fmt(capital)}</span></div>
        ${isLev ? `<div class="sc-r red"><span>Deuda ${levMode.toUpperCase()} ${(m.ltvPct*100).toFixed(0)}%</span><span>${fmt(lev.loan)}</span></div>
        <div class="sc-r red"><span>Coste financiero</span><span>−${fmt(lev.interest)}</span></div>` : ''}
        <div class="sc-r"><span>Venta bruta</span><span>${fmt(sc.saleGross)}</span></div>
        <div class="sc-r red"><span>Costes salida + carry</span><span>−${fmt(sc.exitCosts + sc.sf)}</span></div>
        ${taxOn ? `<div class="sc-r red"><span>${S('taxStructure')==='sl'?'IS':'IRPF'} ${V('taxRate')}%</span><span>−${fmt(isLev?lev.netProfitLev-afterInt:sc.tax)}</span></div>` : ''}
        <div class="sc-div"></div>
        <div class="sc-r net"><span>Beneficio neto</span><span>${fmt(netShow)}</span></div>
      </div>`;
    }
    // Reforma
    const capital  = isLev ? lev.equity   : m.totalInvest;
    const netShow  = isLev ? lev.netProfitLev : sc.netProfit;
    const roiShow  = isLev ? lev.roe      : sc.roiNet;
    const heroVal  = isLev ? fmtPct(lev.roe) : fmtPct(sc.roiGross);
    const heroLbl  = isLev ? 'ROE neto (equity)' : 'ROI bruto operación';
    const totalVenta = exitM2 * m.surfCapex;
    return `<div class="sc-card ${cls}">
      <div class="sc-head">
        <div>${label}</div>
        <div style="font-size:11px;font-family:'DM Mono',monospace;font-feature-settings:'tnum' 1;margin-top:3px">
          <span style="color:var(--text-b);font-weight:700">${fmt(totalVenta)}</span>
          <span style="opacity:0.55;font-size:9.5px"> · ${exitM2.toLocaleString('es-ES')} €/m²</span>
        </div>
      </div>
      <div class="sc-big">${heroVal}</div>
      <div class="sc-irr">${heroLbl} · TIR: <span>${isFinite(irr)?fmtPct(irr):'—'}</span></div>
      <div class="sc-div"></div>
      ${isLev ? `
      <div class="sc-r key"><span>Equity desplegado</span><span>${fmt(capital)}</span></div>
      <div class="sc-r"><span>Deuda bridge · ${levMode.toUpperCase()} ${(m.ltvPct*100).toFixed(0)}%</span><span>${fmt(lev.loan)}</span></div>
      <div class="sc-r red"><span>Coste financiero</span><span>−${fmt(lev.interest)}</span></div>
      <div class="sc-r"><span>Beneficio bruto</span><span>${fmt(sc.grossProfit)}</span></div>
      ` : `
      <div class="sc-r key"><span>Venta bruta</span><span>${fmt(sc.saleGross)}</span></div>
      <div class="sc-r red"><span>Costes de salida</span><span>−${fmt(sc.exitCosts)}</span></div>
      <div class="sc-r"><span>Beneficio bruto</span><span>${fmt(sc.grossProfit)}</span></div>
      <div class="sc-r"><span>ROI bruto</span><span>${fmtPct(sc.roiGross)}</span></div>
      `}
      <div class="sc-div"></div>
      <div class="sc-r amb"><span>${isPase?'Carry':'Success fee'}</span><span>−${fmt(sc.sf)}</span></div>
      ${taxOn ? `<div class="sc-r red"><span>${S('taxStructure')==='sl'?'IS':'IRPF'} ${V('taxRate')}%</span><span>−${fmt(isLev?Math.max(0,lev.netProfitLev*(V('taxRate')/100)):sc.tax)}</span></div>` : ''}
      <div class="sc-div"></div>
      <div class="sc-r net"><span>Beneficio neto</span><span>${fmt(netShow)}</span></div>
    </div>`;
  }
  $('sc-cards').innerHTML =
    scCard(m.pess,'p','Pesimista',V('exitP'),m.irrPess,levPess) +
    scCard(m.base,'b','Base case',V('exitB'),m.irrBase,levBase) +
    scCard(m.opt, 'o','Optimista',V('exitO'),m.irrOpt, levOpt);

  // Update ROI KPI to reflect leverage
  const kRoi = $('kpi-roi');
  const kRoiN = $('kpi-roi-n');
  const roiKpiVal = isLev ? (levBase?.roe || m.base.roiGross) : m.base.roiGross;
  kRoi.textContent = fmtPct(roiKpiVal);
  kRoi.className = 'kpi-v ' + (roiKpiVal>0.2?'up':roiKpiVal>0.1?'warn':'down');
  if (kRoiN) kRoiN.textContent = isLev
    ? `ROE neto · ${levMode.toUpperCase()} ${(m.ltvPct*100).toFixed(0)}%`
    : 'Sin carry ni impuesto · carry ' + fmt(m.base.sf);

  // Update IRR KPI label
  const kIrrN = $('kpi-irr-n');
  if (kIrrN) kIrrN.textContent = isLev ? `TIR equity · ${levMode.toUpperCase()} ${(m.ltvPct*100).toFixed(0)}%` : 'TIR anual · sin apalancamiento';

  // ALERTS
  let alerts = '';
  if (m.arasAmt >= m.buyPrice) alerts += `<div class="alert"><strong>⚠ Arras:</strong> Las arras superan el precio de compra.</div>`;
  $('pnl-alerts').innerHTML = alerts;

  // P&L
  const b = m.base;

  if (isPase) {
    $('pnl-table').innerHTML = `
    <thead><tr>
      <th style="width:60%;text-align:left">Partida</th>
      <th>Total</th>
    </tr></thead>
    <tbody>
    <tr class="cat"><td colspan="2">ADQUISICIÓN</td></tr>
    <tr><td class="indent">Precio de compra</td><td>${fmt(m.buyPrice)}</td></tr>
    <tr><td class="indent">ITP (${V('itpPct')}%)</td><td>${fmt(m.itp)}</td></tr>
    <tr><td class="indent">Notaría + registro</td><td>${fmt(m.notaria)}</td></tr>
    ${m.comunidadTotal>0?`<tr><td class="indent">Comunidad (${m.totalMonths}m)</td><td>${fmt(m.comunidadTotal)}</td></tr>`:''}
    ${m.brokerBuyFee>0?`<tr><td class="indent">Broker fee compra</td><td>${fmt(m.brokerBuyFee)}</td></tr>`:''}
    ${m.intermediaryFee>0?`<tr><td class="indent">${S('intermediaryDesc')||'Fee adicional'}</td><td>${fmt(m.intermediaryFee)}</td></tr>`:''}
    <tr class="total"><td>INVERSIÓN TOTAL (precio + mgmt fee)</td><td>${fmt(m.totalInvest)}</td></tr>

    <tr class="cat"><td colspan="2">FEES RIVERWALK — PASE</td></tr>
    <tr class="fee"><td class="indent">Management fee (${V('paseMgmtPct')}% s/ precio activo${m.totalIVA>0?' + IVA':''})</td><td class="neg">−${fmt(m.mgmtFee + m.ivaFees)}</td></tr>
    <div style="display:none"></div>

    <tr class="cat"><td colspan="2">VENTA — Escenario Base (${V('exitB').toLocaleString('es-ES')} €/m²)</td></tr>
    <tr><td class="indent">Precio venta bruto (${m.surfCapex} m² construidos)</td><td>${fmt(b.saleGross)}</td></tr>
    <tr><td class="indent neg">Comisión broker salida (${V('brokerExit')}%)</td><td class="neg">−${fmt(b.brokerCost)}</td></tr>
    ${V('exitFixed')>0?`<tr><td class="indent neg">Notaría venta + costes salida</td><td class="neg">−${fmt(V('exitFixed')+V('exitFixedAjuste'))}</td></tr>`:''}
    <tr class="sub"><td>Beneficio bruto operativo</td><td>${fmt(b.grossProfit)}</td></tr>

    <tr class="cat"><td colspan="2">CARRY RIVERWALK</td></tr>
    <tr class="fee"><td class="indent">Carry (${V('paseCarryPct')}% s/ beneficio bruto)</td><td class="neg">−${fmt(b.carry)}</td></tr>
    <tr class="fee"><td class="indent">IVA sobre carry (${V('paseCarryIVA')}%)</td><td class="neg">−${fmt(b.carryIVA)}</td></tr>
    <tr class="sub fee"><td>Total carry + IVA</td><td class="neg">−${fmt(b.sf)}</td></tr>

    <tr class="cat tax"><td colspan="2">FISCALIDAD</td></tr>
    ${taxOn ? `<tr class="tax"><td class="indent">${S('taxStructure')==='sl'?'IS':'IRPF'} (${V('taxRate')}%)</td><td class="neg">−${fmt(b.tax)}</td></tr>` : ''}

    <tr class="total net"><td>BENEFICIO NETO AL INVERSOR</td><td class="${b.netProfit>=0?'pos':'neg'}">${fmt(b.netProfit)}</td></tr>
    <tr class="net"><td>ROI neto</td><td class="${b.netProfit>=0?'pos':'neg'}">${fmtPct(b.roiNet)}</td></tr>
    </tbody>`;
  } else {
  // ── REFORMA P&L ───────────────────────────────────────────────────────

  const sfLabel = sfMode === 'fijo'
    ? `Success fee fijo (${V('sfFijoPct')}%)`
    : `Success fee escalado (0%/30%/50% por tramos)`;

  $('pnl-table').innerHTML = `
  <thead><tr>
    <th style="width:50%;text-align:left">Partida</th>
    <th>Sin IVA</th><th>IVA</th><th>Total</th>
  </tr></thead>
  <tbody>
  <tr class="cat"><td colspan="4">ADQUISICIÓN</td></tr>
  <tr><td class="indent">Precio de compra</td><td>${fmt(m.buyPrice)}</td><td>—</td><td></td></tr>
  <tr><td class="indent">ITP (${V('itpPct')}%)</td><td>${fmt(m.itp)}</td><td>—</td><td></td></tr>
  <tr><td class="indent">Notaría + registro</td><td>${fmt(m.notaria)}</td><td>—</td><td></td></tr>
  <tr><td class="indent">Comunidad (${m.totalMonths}m × €${V('comunidad')})</td><td>${fmt(m.comunidadTotal)}</td><td>—</td><td></td></tr>
  ${m.ibiTotal>0?`<tr><td class="indent">IBI</td><td>${fmt(m.ibiTotal)}</td><td>—</td><td></td></tr>`:''}
  ${m.brokerBuyFee>0?`<tr><td class="indent">Broker fee compra (intermediario)</td><td>${fmt(m.brokerBuyFee)}</td><td>—</td><td></td></tr>`:''}
  ${m.intermediaryFee>0?`<tr><td class="indent">${S('intermediaryDesc')||'Fee adicional a terceros'}</td><td>${fmt(m.intermediaryFee)}</td><td>—</td><td></td></tr>`:''}
  <tr class="sub"><td>Subtotal adquisición</td><td></td><td></td><td>${fmt(m.totalAcq)}</td></tr>

  <tr class="cat"><td colspan="4">CAPEX</td></tr>
  <tr><td class="indent">Obra (€${V('obraM2')}/m² × ${m.surfCapex}m²${V('overPct')>0?' +'+V('overPct')+'% sobrecoste':''})</td><td>${fmt(m.obraNet)}</td><td>${fmt(m.obraNet*V('ivaObra')/100)}</td><td></td></tr>
  <tr><td class="indent">Decoración / FF&E (€${V('decoM2')}/m² × ${m.surfCapex}m²)</td><td>${fmt(m.decoNet)}</td><td>${fmt(m.decoNet*V('ivaObra')/100)}</td><td></td></tr>
  ${zcOn&&m.zcNet>0?`<tr><td class="indent">${S('zcDesc')||'Zonas comunes'}</td><td>${fmt(m.zcNet)}</td><td>${fmt(m.zcNet*V('ivaObra')/100)}</td><td></td></tr>`:''}
  <tr class="sub"><td>Subtotal CapEx</td><td>${fmt(m.capexNet)}</td><td style="color:var(--red);opacity:0.75">${fmt(m.ivaCapex)}</td><td>${fmt(m.capexNet+m.ivaCapex)}</td></tr>

  <tr class="cat"><td colspan="4">FEES RIVERWALK</td></tr>
  <tr class="fee"><td class="indent">Management fee (${V('mgmtFeePct')}% s/ precio + CapEx neto = ${fmt(m.mgmtFeeBase)})</td><td>${fmt(m.mgmtFee)}</td><td style="color:var(--red);opacity:0.75">${fmt(m.mgmtFee*V('ivaObra')/100)}</td><td></td></tr>
  <tr class="sub fee"><td>Subtotal fees Riverwalk</td><td>${fmt(m.totalFeesNet)}</td><td style="color:var(--red);opacity:0.75">${fmt(m.ivaFees)}</td><td>${fmt(m.totalFeesNet+m.ivaFees)}</td></tr>

  <tr class="cat" style="color:var(--red)"><td colspan="4">IVA SOPORTADO — NO RECUPERABLE</td></tr>
  <tr class="tax"><td class="indent" style="color:var(--text)">IVA CapEx + Fees (${V('ivaObra')}%)</td><td>—</td><td style="color:var(--red);opacity:0.75">${fmt(m.totalIVA)}</td><td class="neg">−${fmt(m.totalIVA)}</td></tr>

  <tr class="total"><td>INVERSIÓN TOTAL</td><td>${fmt(m.totalAcq+m.capexNet+m.totalFeesNet)}</td><td style="color:var(--red);opacity:0.75">${fmt(m.totalIVA)}</td><td>${fmt(m.totalInvest)}</td></tr>

  <tr class="cat"><td colspan="4">VENTA — Escenario Base (€${V('exitB').toLocaleString('es-ES')}/m²)</td></tr>
  <tr><td class="indent">Precio venta bruto (${m.surfCapex} m² × €${V('exitB').toLocaleString('es-ES')} construidos)</td><td colspan="2"></td><td>${fmt(b.saleGross)}</td></tr>
  <tr><td class="indent neg">Comisión broker salida (${V('brokerExit')}%)</td><td colspan="2"></td><td class="neg">−${fmt(b.brokerCost)}</td></tr>
  <tr><td class="indent neg">Notaría venta + costes salida</td><td colspan="2"></td><td class="neg">−${fmt(V('exitFixed')+V('exitFixedAjuste'))}</td></tr>
  <tr class="sub"><td>Beneficio bruto operativo</td><td colspan="2"></td><td>${fmt(b.grossProfit)}</td></tr>

  <tr class="cat"><td colspan="4">SUCCESS FEE RIVERWALK</td></tr>
  <tr class="fee"><td class="indent">${sfLabel}${sfCarryMode==='irr'?` <span style="font-size:9px;color:var(--text-d)">(umbral TIR: ${V('sf1T')}% / ${V('sf2T')}% anual → equiv. a ${fmt(b.t1Profit)} / ${fmt(b.t2Profit)} de beneficio en esta operación)</span>`:''}</td><td colspan="2"></td><td class="neg">−${fmt(b.sf)}</td></tr>

  <tr class="cat tax"><td colspan="4">FISCALIDAD</td></tr>
  ${taxOn ? `<tr class="tax"><td class="indent">${S('taxStructure')==='sl'?'Impuesto de Sociedades':'IRPF'} (${V('taxRate')}%)</td><td colspan="2"></td><td class="neg">−${fmt(b.tax)}</td></tr>` : ''}

  <tr class="total net"><td>BENEFICIO NETO AL INVERSOR</td><td colspan="2"></td><td class="${b.netProfit>=0?'pos':'neg'}">${fmt(b.netProfit)}</td></tr>
  <tr class="net"><td>ROI neto</td><td colspan="2"></td><td class="${b.netProfit>=0?'pos':'neg'}">${fmtPct(b.roiNet)}</td></tr>
  </tbody>`;
  } // end pase/reforma P&L if-else

  // LEVERAGE
  function levCard(l, label, ltvFrac, isRec) {
    return `<div class="lev-item${isRec?' rec':''}">
      <div class="lev-tag">${label}${isRec?' ← actual':''}</div>
      <div class="lev-head">${fmtPct(l.roe)}</div>
      <div class="lev-sub">ROE neto · ${(ltvFrac*100).toFixed(0)}% LTV</div>
      <div class="lev-r"><span>Equity desplegado</span><span>${fmt(l.equity)}</span></div>
      <div class="lev-r"><span>Deuda bridge</span><span>${l.loan>0?fmt(l.loan):'—'}</span></div>
      <div class="lev-r"><span>Coste financiero</span><span>${l.interest>0?'−'+fmt(l.interest):'€0'}</span></div>
      <div class="lev-r"><span>Beneficio neto</span><span>${fmt(l.netProfitLev)}</span></div>
      <div class="lev-r hl"><span>TIR anual</span><span>${isFinite(l.irr)?fmtPct(l.irr):'—'}</span></div>
    </div>`;
  }
  $('lev-strip').innerHTML =
    levCard(m.lev0, 'Sin apalancamiento', 0, m.ltvPct===0) +
    levCard(m.lev40,'LTV 40%', 0.40, m.ltvPct===0.40) +
    levCard(m.lev60,'LTV 60%', 0.60, m.ltvPct===0.60);

  // BREAKEVEN BAR
  const beMax  = Math.max(V('exitO')*1.08, 20000);
  const pPct   = n => Math.min(98, Math.max(2, n/beMax*100));
  $('be-fill').style.width = pPct(V('exitO'))+'%';
  $('be-markers').innerHTML = [
    {p:m.bePriceM2, label:'BE', color:'var(--red)'},
    {p:V('exitP'),  label:'−',  color:'var(--amber)'},
    {p:V('exitB'),  label:'Base',color:'var(--gold)'},
    {p:V('exitO'),  label:'+',  color:'var(--green)'},
  ].map(({p,label,color})=>`<div class="be-m" style="left:${pPct(p)}%;color:${color}">
    <div class="be-m-line"></div>
    <div class="be-m-label">${label}</div>
  </div>`).join('');

  const pessMarg = ((V('exitP')/m.bePriceM2-1)*100).toFixed(0);
  $('be-stats').innerHTML = `
    <div class="be-stat">
      <div class="be-stat-lbl">Precio breakeven</div>
      <div class="be-stat-v">€${Math.round(m.bePriceM2).toLocaleString('es-ES')}/m²</div>
      <div class="be-stat-n">Venta total mín. ${fmt(m.bePriceM2*m.surfCapex)}</div>
    </div>
    <div class="be-stat">
      <div class="be-stat-lbl">Margen sobre pesimista</div>
      <div class="be-stat-v" style="color:var(--green)">+${pessMarg}%</div>
      <div class="be-stat-n">€${V('exitP').toLocaleString('es-ES')} vs €${Math.round(m.bePriceM2).toLocaleString('es-ES')} BE</div>
    </div>
    <div class="be-stat">
      <div class="be-stat-lbl">Caída máx. desde base</div>
      <div class="be-stat-v" style="color:var(--amber)">${((1-m.bePriceM2/V('exitB'))*100).toFixed(0)}%</div>
      <div class="be-stat-n">Hasta no-pérdida desde €${V('exitB').toLocaleString('es-ES')}</div>
    </div>`;

  // ── MATRIZ 1: Precio salida × Duración — TIR como métrica principal ──
  const priceColsFixed = [...sensPrices];
  const durationRows = [
    { label: `${m.arasMonths + 8}m total`,  months: m.arasMonths + 8 },
    { label: `${m.arasMonths + 10}m total`, months: m.arasMonths + 10 },
    { label: `${m.totalMonths}m ← plan`,    months: m.totalMonths, isBase: true },
    { label: `${m.arasMonths + 15}m total`, months: m.arasMonths + 15 },
    { label: `${m.arasMonths + 18}m total`, months: m.arasMonths + 18 },
    { label: `${m.arasMonths + 24}m total`, months: m.arasMonths + 24 }
  ];

  let th1 = `<thead>
    <tr>
      <th style="min-width:120px;text-align:left;font-size:9px;padding:8px 12px" rowspan="2">Duración total<br><span style="color:var(--text-d);font-weight:300">arras → venta</span></th>
      <th colspan="${priceColsFixed.length}" style="text-align:center;font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-d);padding:6px 12px;border-bottom:1px solid var(--line2)">
        Precio de salida (€/m²) — ROI neto e IS incluidos, carry modo ${sfCarryMode==='irr'?'TIR ★':'ROI simple'}
      </th>
    </tr>
    <tr>`;
  priceColsFixed.forEach(p => {
    const isBase = p === V('exitB');
    const totalV1 = Math.round(p * m.surfCapex);
    th1 += `<th style="min-width:100px;white-space:nowrap;padding:5px 8px;text-align:center${isBase?';color:var(--gold)':''}">
      <div style="font-size:10px">${p.toLocaleString('es-ES')} €/m²${isBase?' ←':''}</div>
      <div style="font-size:9px;font-family:'DM Mono',monospace;font-feature-settings:'tnum' 1;opacity:0.65;margin-top:2px;font-weight:400">${fmtK(totalV1)}</div>
    </th>`;
  });
  th1 += `</tr>
    <tr style="background:var(--d4)">
      <td style="font-size:8px;color:var(--text-d);padding:5px 12px;font-family:'Raleway',sans-serif">← filas = timing</td>`;
  priceColsFixed.forEach(() => {
    th1 += `<td style="text-align:center;padding:4px 8px">
      <div style="font-size:9px;font-weight:600;color:var(--gold-l)">TIR anual</div>
      <div style="font-size:8px;color:var(--text-d)">ROI neto</div>
    </td>`;
  });
  th1 += `</tr></thead>`;

  let tb1 = '<tbody>';
  durationRows.forEach(row => {
    const months = row.months;
    const commAdj = V('comunidad') * months;
    const ibiAdj  = V('ibi') * months / 12;
    const acqAdj  = m.buyPrice + m.itp + m.notaria + commAdj + ibiAdj + m.intermediaryFee + m.brokerBuyFee;
    const totAdj  = acqAdj + m.capexNet + m.totalFeesNet + m.totalIVA;

    tb1 += `<tr${row.isBase ? ' style="background:rgba(196,151,90,0.06)"' : ''}>`;
    tb1 += `<td style="font-family:'Raleway',sans-serif;font-size:10px;text-align:left;padding:6px 12px;${row.isBase ? 'color:var(--gold)' : 'color:var(--text-d)'}">${row.label}</td>`;

    priceColsFixed.forEach(ep => {
      const saleG = ep * m.surfCapex;
      const brkr  = saleG * V('brokerExit') / 100;
      const gP    = saleG - brkr - (V('exitFixed')+V('exitFixedAjuste')) - totAdj;
      const sf    = calcSFRoi(gP, totAdj);
      const netB  = gP - sf;
      const tx    = Math.max(0, netB) * V('taxRate') / 100;
      const netP  = netB - tx;
      const roiN  = netP / totAdj;

      // IRR: exact tranche structure
      const exitM  = months;
      const escM   = Math.min(Math.round(m.arasMonths), exitM);
      const iva    = V('ivaObra') / 100;
      const capexW = m.capexNet * (1 + iva);
      const c50M   = Math.min(escM + Math.round((months - m.arasMonths) * 0.40), exitM);
      const c70M   = Math.min(escM + Math.round((months - m.arasMonths) * 0.60), exitM);
      const entM   = Math.min(escM + Math.round((months - m.arasMonths) * 0.85), exitM);
      const cfArr  = new Array(exitM + 1).fill(0);
      cfArr[0]    -= m.arasAmt + (m.mgmtFee * (1+iva) * 0.5);
      cfArr[escM] -= (m.buyPrice - m.arasAmt) + m.itp + m.notaria + m.intermediaryFee + m.brokerBuyFee + (m.mgmtFee * (1+iva) * 0.5) + capexW * 0.50;
      cfArr[c50M] -= capexW * 0.20;
      cfArr[c70M] -= capexW * 0.20;
      cfArr[entM] -= capexW * 0.10;
      const holdPM = (commAdj + ibiAdj) / months;
      for (let i = 0; i <= exitM; i++) cfArr[i] -= holdPM;
      cfArr[exitM] += totAdj + netP;

      const irrVal    = annIRR(calcIRR(cfArr, 0.025));
      const irrStr    = isFinite(irrVal) ? fmtPct(irrVal) : '—';
      const isBaseCol = ep === V('exitB');

      // Color by TIR (primary metric for duration matrix)
      const cls = !isFinite(irrVal) || irrVal < 0.05 ? 'c1'
                : irrVal < 0.18 ? 'c2'
                : irrVal < 0.30 ? 'c3' : 'c4';

      const saleGross1 = ep * m.surfCapex;
      tb1 += `<td class="${cls}" style="text-align:center;${isBaseCol ? 'background:rgba(196,151,90,0.08)' : ''}">
        <div style="font-size:12px;font-family:'DM Mono',monospace;font-weight:600">${irrStr}</div>
        <div style="font-size:8.5px;opacity:0.65;margin-top:1px">${(roiN*100).toFixed(1)}% ROI</div>
        <div style="font-size:8px;font-family:'DM Mono',monospace;color:var(--text-d);margin-top:2px;font-feature-settings:'tnum' 1">${fmtK(saleGross1)}</div>
      </td>`;
    });
    tb1 += '</tr>';
  });
  tb1 += '</tbody>';
  $('sens-table').innerHTML = th1 + tb1;

  const sensNote = $('sens-note');
  if (sensNote) sensNote.innerHTML = `<strong style="color:var(--text-b)">TIR anual</strong> (número grande) · ROI neto al inversor (número pequeño) · carry en modo ${sfCarryMode==='irr'?'<strong style="color:var(--gold)">TIR ★</strong>':'ROI simple'}`;

  // ── MATRIZ 2: CapEx × Precio salida — ROI como métrica principal ──
  const capexAdjs  = [-0.10, 0, 0.10, 0.20, 0.30];
  const priceColsCapex = [...sensPrices];

  let th2 = `<thead><tr>
    <th style="min-width:120px;text-align:left;font-size:9px;padding:8px 12px">CapEx \\ Precio →</th>`;
  priceColsCapex.forEach(p => {
    const isBase = p === V('exitB');
    const totalV2 = Math.round(p * m.surfCapex);
    th2 += `<th style="min-width:100px;white-space:nowrap;text-align:center${isBase?';color:var(--gold)':''}">
      <div style="font-size:10px">${p.toLocaleString('es-ES')} €/m²${isBase?' ←':''}</div>
      <div style="font-size:9px;font-family:'DM Mono',monospace;font-feature-settings:'tnum' 1;opacity:0.65;margin-top:2px;font-weight:400">${fmtK(totalV2)}</div>
    </th>`;
  });
  th2 += '</tr></thead>';

  let tb2 = '<tbody>';
  capexAdjs.forEach(adj => {
    const isBase = adj === 0;
    const lbl    = isBase ? 'CapEx base ←' : `CapEx ${adj > 0 ? '+' : ''}${(adj*100).toFixed(0)}%`;

    const iva       = V('ivaObra') / 100;
    const capexAdj  = (V('obraM2') + V('decoM2')) * m.surfCapex * (1 + adj) + (zcOn ? V('zcCost') : 0);
    const ivaAdj    = capexAdj * iva;
    const mgmtAdj   = (m.buyPrice + capexAdj) * V('mgmtFeePct') / 100;
    const mIVAAdj   = mgmtAdj * iva;
    const totAdj    = m.totalAcq + capexAdj + ivaAdj + mgmtAdj + mIVAAdj;

    tb2 += `<tr${isBase ? ' style="background:rgba(196,151,90,0.06)"' : ''}>`;
    tb2 += `<td style="font-family:'Raleway',sans-serif;font-size:10px;text-align:left;padding:6px 12px;${isBase ? 'color:var(--gold)' : 'color:var(--text-d)'}">${lbl}</td>`;

    priceColsCapex.forEach(ep => {
      const saleG    = ep * m.surfCapex;
      const brkr     = saleG * V('brokerExit') / 100;
      const gP       = saleG - brkr - (V('exitFixed')+V('exitFixedAjuste')) - totAdj;
      const sf       = calcSFRoi(gP, totAdj);
      const netB     = gP - sf;
      const tx       = Math.max(0, netB) * V('taxRate') / 100;
      const netP     = netB - tx;
      const roiN     = netP / totAdj;
      const isBaseC  = ep === V('exitB');
      const cls      = roiN < 0.05 ? 'c1' : roiN < 0.18 ? 'c2' : roiN < 0.25 ? 'c3' : 'c4';
      const saleGT   = Math.round(ep * m.surfCapex);

      tb2 += `<td class="${cls}" style="text-align:center;${isBaseC ? 'background:rgba(196,151,90,0.08)' : ''}">
        <div style="font-size:12px;font-family:'DM Mono',monospace;font-weight:600">${(roiN*100).toFixed(1)}%</div>
        <div style="font-size:8px;font-family:'DM Mono',monospace;color:var(--text-d);margin-top:2px;font-feature-settings:'tnum' 1">${fmtK(saleGT)}</div>
      </td>`;
    });
    tb2 += '</tr>';
  });
  tb2 += '</tbody>';
  $('sens-table2').innerHTML = th2 + tb2;

  // EXPORT BRIEF
  const d = new Date().toLocaleDateString('es-ES');
  $('export-brief').textContent =
`RIVERWALK — BRIEF PARA MAQUETACIÓN
${S('dealName')} · ${d}
${'═'.repeat(52)}

ACTIVO
  Dirección:        ${S('dealAddress')}, ${S('dealCP')} ${S('dealMunicipio')}
  Planta / Puerta:  ${S('dealFloor')}${S('dealPuerta')?' · '+S('dealPuerta'):''}
  Ref. catastral:   ${S('dealCatastro')||'—'}
  M² construidos:   ${V('surfCapex')} m² (base CapEx)
  M² construidos:   ${V('surfCapex')} m² (base CapEx y precio venta)

CALENDARIO
  Arras:            ${fmt(m.arasAmt)} (${((m.arasAmt/m.buyPrice)*100).toFixed(1)}% del precio)
  Meses arras→escritura: ${m.arasMonths}m
  Meses escritura→venta: ${m.monthsSale}m
  Total operación:  ${m.totalMonths} meses

INVERSIÓN TOTAL: ${fmt(m.totalInvest)}
  Adquisición:      ${fmt(m.totalAcq)}
  ${m.brokerBuyFee>0?`Broker fee compra: ${fmt(m.brokerBuyFee)}\n  `:''}CapEx (sin IVA):  ${fmt(m.capexNet)}
  Mgmt fee (${V('mgmtFeePct')}% s/precio+CapEx): ${fmt(m.mgmtFee)}
  IVA soportado:    ${fmt(m.totalIVA)}
${m.intermediaryFee>0?`  ${S('intermediaryDesc')}: ${fmt(m.intermediaryFee)}`:''}
${zcOn&&m.zcNet>0?`  ${S('zcDesc')}: ${fmt(m.zcNet)}`:''}

ESCENARIOS
  Pesimista: €${V('exitP').toLocaleString('es-ES')}/m² → ROI neto ${fmtPct(m.pess.roiNet)} · TIR ${isFinite(m.irrPess)?fmtPct(m.irrPess):'—'}
  Base:      €${V('exitB').toLocaleString('es-ES')}/m² → ROI neto ${fmtPct(m.base.roiNet)} · TIR ${isFinite(m.irrBase)?fmtPct(m.irrBase):'—'}
  Optimista: €${V('exitO').toLocaleString('es-ES')}/m² → ROI neto ${fmtPct(m.opt.roiNet)} · TIR ${isFinite(m.irrOpt)?fmtPct(m.irrOpt):'—'}

P&L BASE
  Venta bruta:       ${fmt(m.base.saleGross)}
  Costes salida:    −${fmt(m.base.exitCosts)}
  Beneficio bruto:   ${fmt(m.base.grossProfit)}  (ROI ${fmtPct(m.base.roiGross)})
  Success fee:      −${fmt(m.base.sf)}
  ${S('taxStructure')==='sl'?'IS':'IRPF'} ${V('taxRate')}%:     −${fmt(m.base.tax)}
  ─────────────────────────────────
  BENEFICIO NETO:    ${fmt(m.base.netProfit)}
  ROI NETO:          ${fmtPct(m.base.roiNet)}
  TIR ANUAL:         ${isFinite(m.irrBase)?fmtPct(m.irrBase):'—'}

BREAKEVEN:  €${Math.round(m.bePriceM2).toLocaleString('es-ES')}/m² · Margen +${((V('exitP')/m.bePriceM2-1)*100).toFixed(0)}% s/pesimista

${'═'.repeat(52)}
Riverwalk · info@riverwalk.es · www.riverwalk.es`;
}

// ══════════════════════════════════════════════════
// DEAL DATA HELPERS
// ══════════════════════════════════════════════════

function syncSurfaces(changed) {
  update();
}

async function geocodeAddress() {
  // API key managed server-side - proceed
  const address = ($('dealAddress')?.value || '').trim();
  const status  = $('geo-status');
  if (!address || address.length < 6) return;

  if (status) { status.textContent = '⟳ Buscando código postal…'; status.style.color = 'var(--text-d)'; }

  try {
    const response = await fetch('/api/anthropic', {
      method: 'POST',
      headers: getAPIHeaders(),
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `¿Cuál es el código postal y municipio de "${address}" en España? Responde SOLO con este JSON sin texto extra: {"cp":"28014","municipio":"Madrid"}`
        }]
      })
    });

    const data = await response.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const match = text.match(/\{[^}]+\}/);
    if (!match) throw new Error('no json');

    const parsed = JSON.parse(match[0]);
    if (parsed.cp && $('dealCP')) {
      $('dealCP').value = parsed.cp;
      // Auto-populate registro search CP
      const regCp = $('registro-cp');
      if (regCp && !regCp.value) regCp.value = parsed.cp;
    }
    if (parsed.municipio && $('dealMunicipio')) { $('dealMunicipio').value = parsed.municipio; }
    update();

    if (status) {
      status.textContent = parsed.cp
        ? `✓ ${parsed.cp} · ${parsed.municipio}`
        : '⚠ No encontrado — introduce el CP manualmente';
      status.style.color = parsed.cp ? 'var(--green)' : 'var(--amber)';
    }
  } catch(e) {
    if (status) { status.textContent = '⚠ No encontrado — introduce el CP manualmente'; status.style.color = 'var(--amber)'; }
  }
}

function openCatastro() {
  const ref = $('dealCatastro').value.trim().replace(/\s/g,'');
  if (!ref) return;
  // Validate: catastral ref is 20 chars
  const status = $('catastro-status');
  if (ref.length !== 20) {
    status.textContent = '⚠ Ref. catastral debe tener exactamente 20 caracteres (' + ref.length + ' introducidos)';
    status.style.color = 'var(--amber)';
    return;
  }
  // Catastro no admite deep-link directo con referencia catastral.
  // Lo más práctico: copiar la ref al portapapeles y abrir la página de búsqueda.
  navigator.clipboard?.writeText(ref).catch(()=>{});
  window.open(
    'https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCBusqueda.aspx',
    '_blank'
  );
  status.textContent = `✓ Referencia "${ref}" copiada — pégala en el campo de búsqueda`;
  status.style.color = 'var(--green)';
}

function validateCatastro() {
  const ref = $('dealCatastro').value.trim().replace(/\s/g,'');
  const status = $('catastro-status');
  if (!ref) { status.textContent = ''; return; }
  if (ref.length === 20) {
    status.textContent = '✓ Formato válido (20 caracteres)';
    status.style.color = 'var(--green)';
  } else {
    status.textContent = ref.length + '/20 caracteres';
    status.style.color = ref.length > 20 ? 'var(--red)' : 'var(--text-d)';
  }
}

// ══════════════════════════════════════════════════
// REGISTRO DE LA PROPIEDAD — BÚSQUEDA POR CP
// ══════════════════════════════════════════════════
function buscarRegistro() {
  const cp      = parseInt($('registro-cp')?.value) || 0;
  const tipo    = $('registro-tipo')?.value || '';
  const minPm2  = parseFloat($('registro-min')?.value) || 0;
  const maxPm2  = parseFloat($('registro-max')?.value) || Infinity;
  const minSup  = parseFloat($('registro-sup-min')?.value) || 0;
  const maxSup  = parseFloat($('registro-sup-max')?.value) || Infinity;

  if (!cp || cp < 10000) {
    const sumEl = $('registro-results-summary');
    if (sumEl) sumEl.textContent = 'Introduce un código postal válido (5 dígitos).';
    return;
  }

  // Filter REGISTRO_DATA
  // Format: [cp, precio, €m2, superficie, fecha, calle]
  const results = REGISTRO_DATA.filter(r =>
    r[0] === cp &&
    r[2] >= minPm2 && r[2] <= maxPm2 &&
    r[3] >= minSup && r[3] <= maxSup &&
    (tipo === '' ||
     (tipo === 'flat' && r[2] > 0) ||
     (tipo === 'terraced'))
  ).sort((a, b) => b[2] - a[2]); // sort by €/m² desc

  const sumEl    = $('registro-results-summary');
  const resEl    = $('registro-results');
  const statsEl  = $('registro-stats');
  const tbodyEl  = $('registro-tbody');

  if (!results.length) {
    if (sumEl) sumEl.textContent = `Sin transacciones en CP ${cp} con los filtros seleccionados.`;
    if (resEl)   resEl.style.display = 'none';
    if (statsEl) statsEl.style.display = 'none';
    return;
  }

  // Stats
  const pm2s  = results.map(r => r[2]);
  const avgPm2  = Math.round(pm2s.reduce((s,v)=>s+v,0) / pm2s.length);
  const medPm2  = pm2s.sort((a,b)=>a-b)[Math.floor(pm2s.length/2)];
  const minVal  = Math.min(...pm2s), maxVal = Math.max(...pm2s);
  const avgSup  = Math.round(results.map(r=>r[3]).reduce((s,v)=>s+v,0) / results.length);

  if (sumEl) sumEl.innerHTML = `<strong style="color:var(--text-b)">${results.length}</strong> transacciones en <strong style="color:var(--gold)">${cp}</strong> · Q1 2025`;

  if (statsEl) {
    statsEl.style.display = '';
    statsEl.innerHTML = `
      <span style="margin-right:16px">Media: <strong style="color:var(--text-b);font-family:'DM Mono',monospace;font-feature-settings:'tnum' 1">${avgPm2.toLocaleString('es-ES')} €/m²</strong></span>
      <span style="margin-right:16px">Mediana: <strong style="color:var(--text-b);font-family:'DM Mono',monospace;font-feature-settings:'tnum' 1">${medPm2.toLocaleString('es-ES')} €/m²</strong></span>
      <span style="margin-right:16px">Rango: <strong style="font-family:'DM Mono',monospace;font-feature-settings:'tnum' 1">${minVal.toLocaleString('es-ES')} – ${maxVal.toLocaleString('es-ES')} €/m²</strong></span>
      <span>Sup. media: <strong style="font-family:'DM Mono',monospace">${avgSup} m²</strong></span>`;
  }

  // Table rows (show max 80)
  const show = results.slice(0, 80);
  if (tbodyEl) {
    tbodyEl.innerHTML = show.map(r => {
      const [rcp, precio, pm2, sup, fecha, calle] = r;
      const pm2Color = pm2 > avgPm2 * 1.1 ? 'var(--green)' : pm2 < avgPm2 * 0.9 ? 'var(--red)' : 'var(--amber)';
      return `<tr style="border-bottom:1px solid var(--line2)" onmouseover="this.style.background='var(--d3)'" onmouseout="this.style.background=''">
        <td style="padding:6px 8px;font-size:11px;color:var(--text-d);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${calle}">${calle || '—'}</td>
        <td style="padding:6px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:11px;font-feature-settings:'tnum' 1">${precio.toLocaleString('es-ES')} €</td>
        <td style="padding:6px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:11px">${sup} m²</td>
        <td style="padding:6px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:${pm2Color};font-feature-settings:'tnum' 1">${pm2.toLocaleString('es-ES')} €/m²</td>
        <td style="padding:6px 8px;text-align:center;font-family:'DM Mono',monospace;font-size:10px;color:var(--text-d)">${fecha}</td>
        <td style="padding:6px 8px;text-align:center">
          <button onclick="addRegistroComp(${precio},${sup},${pm2},'${calle || 'Registro ' + cp} (${fecha})')"
            style="background:var(--gold);border:none;color:#fff;font-size:8px;letter-spacing:0.1em;
                   text-transform:uppercase;padding:4px 10px;cursor:pointer;font-family:'Raleway',sans-serif;
                   font-weight:600;white-space:nowrap">
            + Añadir
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  if (resEl) resEl.style.display = '';
}

function addRegistroComp(precio, sup, pm2, desc) {
  comps.push({
    desc: desc,
    source: 'Registro Q1 2025',
    tipo: 'reformado',
    precio: precio,
    m2: sup,
    url: ''
  });
  renderCompInputs();
  renderCompOutput();
  update();
  // Flash feedback
  const sumEl = $('registro-results-summary');
  if (sumEl) {
    const prev = sumEl.innerHTML;
    sumEl.innerHTML = `<span style="color:var(--green);font-weight:600">✓ Testigo añadido: ${desc.substring(0,40)}</span>`;
    setTimeout(() => { sumEl.innerHTML = prev; }, 2000);
  }
}

// Auto-populate CP from dealAddress field
function autoCPFromDeal() {
  const cp = V('dealCP');
  const el = $('registro-cp');
  if (el && cp && cp.toString().length === 5) {
    el.value = cp;
    buscarRegistro();
  }
}
// ══════════════════════════════════════════════════
function fmtDate(d) {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ══════════════════════════════════════════════════
// DOSSIER DATA — photos + narratives per deal
// ══════════════════════════════════════════════════
function getCurrentDossier() {
  if (!deals[activeDealIdx]) return { photos:[], narrative:{activo:'',zona:'',mercado:'',proyecto:'',tesis:''}, mapDataUrl:'', negotiation:[], estructura:{vehiculo:'',aportacion:'',ticketMinimo:50000}, calidades:{preset:'',customText:''}, orientacionOverride:'', catalizadores:[] };
  if (!deals[activeDealIdx].dossier) deals[activeDealIdx].dossier = { photos:[], plans:[], materials:[], narrative:{activo:'',zona:'',mercado:'',proyecto:'',tesis:''}, mapDataUrl:'', mapLat:null, mapLng:null, negotiation:[], estructura:{vehiculo:'',aportacion:'',ticketMinimo:50000}, calidades:{preset:'',customText:''}, orientacionOverride:'', catalizadores:[] };
  const d = deals[activeDealIdx].dossier;
  if (!d.negotiation) d.negotiation = [];
  if (!d.estructura) d.estructura = {vehiculo:'',aportacion:'',ticketMinimo:50000};
  if (!d.calidades) d.calidades = {preset:'',customText:''};
  if (d.orientacionOverride === undefined) d.orientacionOverride = '';
  if (!d.catalizadores) d.catalizadores = [];
  return d;
}

function saveDossierNarrative() {
  const d = getCurrentDossier();
  ['activo','zona','mercado','proyecto','tesis'].forEach(k => {
    const el = $('narr-' + k);
    if (el) d.narrative[k] = el.value;
  });
}

function loadDossierToForm() {
  const d = getCurrentDossier();
  ['activo','zona','mercado','proyecto','tesis'].forEach(k => {
    const el = $('narr-' + k);
    if (el) el.value = d.narrative[k] || '';
  });
  // Orientación override — restore select AND rebuild d.orientation from override
  // so buildSlides() always reads the correct orientation (avoids stale Overpass result in DB)
  const oriSel = $('dealOrientacion');
  if (oriSel) oriSel.value = d.orientacionOverride || '';
  if (d.orientacionOverride) {
    const ANGLES = { N:0, NE:45, E:90, SE:135, S:180, SO:225, O:270, NO:315 };
    d.orientation = {
      angle:        ANGLES[d.orientacionOverride] ?? 0,
      cardinal:     d.orientacionOverride,
      solar:        rwSolarDesc(d.orientacionOverride),
      uncertain:    false,
      streetBearing: null,
      streetName:   '',
    };
  }
  // Interiorism style
  const intSel = $('interiorismStyle');
  if (intSel) { intSel.value = d.interiorismStyle || ''; saveInteriorismStyle(); }
  // Calidades
  const cpSel = $('calidadesPreset');
  if (cpSel) { cpSel.value = d.calidades?.preset || ''; applyCalidadesPreset(); }
  const customEl = $('calidadesCustomText');
  if (customEl && d.calidades?.customText) customEl.value = d.calidades.customText;
  // Estructura
  if (d.estructura?.vehiculo) setVehiculo(d.estructura.vehiculo);
  if (d.estructura?.aportacion) setAportacion(d.estructura.aportacion);
  const tkEl = $('ticketMinimo');
  if (tkEl && d.estructura?.ticketMinimo) tkEl.value = d.estructura.ticketMinimo;
  // Negotiation + catalizadores
  renderNegHitos();
  renderCatalizadores();
  renderDossierPhotos();
}

// ── ORIENTACIÓN OVERRIDE ───────────────────────────
const INTERIORISM_IMGS = {
  'soft-minimalism':    '/interiorismo-soft-minimalism.jpg',
  'modern-classic':     '/interiorismo-modern-classic.jpg',
  'contemporary-warm':  '/interiorismo-contemporary-warm.jpg',
};

function saveInteriorismStyle() {
  const d = getCurrentDossier();
  const val = $('interiorismStyle')?.value || '';
  d.interiorismStyle = val;
  // Update preview thumbnail
  const preview    = $('interiorism-preview');
  const previewImg = $('interiorism-preview-img');
  if (preview && previewImg) {
    if (val && INTERIORISM_IMGS[val]) {
      previewImg.src      = INTERIORISM_IMGS[val];
      preview.style.display = '';
    } else {
      preview.style.display = 'none';
      previewImg.src = '';
    }
  }
}

function saveOrientacionOverride() {
  const d = getCurrentDossier();
  const val = $('dealOrientacion')?.value || '';
  d.orientacionOverride = val;
  if (val) {
    // Build a synthetic orientation object from the selected cardinal so the
    // compass in Presentar and PDF dossier updates immediately.
    const ANGLES = { N:0, NE:45, E:90, SE:135, S:180, SO:225, O:270, NO:315 };
    d.orientation = {
      angle:        ANGLES[val] ?? 0,
      cardinal:     val,
      solar:        rwSolarDesc(val),
      uncertain:    false,
      streetBearing: null,
      streetName:   '',
    };
  } else {
    // "Automático" selected: clear override and re-run the Overpass calculation
    d.orientation = null;
    rwFetchAndStoreOrientation();
  }
}

// ── ESTRUCTURACIÓN ─────────────────────────────────
function saveEstructura() {
  const d = getCurrentDossier();
  const tk = $('ticketMinimo')?.value?.replace(/\D/g,'');
  d.estructura.ticketMinimo = tk ? parseInt(tk) : 50000;
}

function setVehiculo(val) {
  const d = getCurrentDossier();
  d.estructura.vehiculo = val;
  document.querySelectorAll('[id^="veh-"][id$="-lbl"]').forEach(el => {
    el.style.borderColor = 'var(--d6)';
    el.style.background = 'var(--d4)';
  });
  const lbl = $('veh-'+val+'-lbl');
  if (lbl) { lbl.style.borderColor = 'rgba(196,151,90,0.5)'; lbl.style.background = 'rgba(196,151,90,0.06)'; }
  const radio = $('veh-'+val);
  if (radio) radio.checked = true;
}

function setAportacion(val) {
  const d = getCurrentDossier();
  d.estructura.aportacion = val;
  document.querySelectorAll('[id^="ap-"][id$="-lbl"]').forEach(el => {
    el.style.borderColor = 'var(--d6)';
    el.style.background = 'var(--d4)';
  });
  const lbl = $('ap-'+val+'-lbl');
  if (lbl) { lbl.style.borderColor = 'rgba(196,151,90,0.5)'; lbl.style.background = 'rgba(196,151,90,0.06)'; }
  const radio = $('ap-'+val);
  if (radio) radio.checked = true;
}

// ── CALIDADES ──────────────────────────────────────
const CALIDADES_DEFAULTS = {
  esencial: 'Suelos de parquet laminado de alta resistencia. Cocina equipada con electrodomésticos de gama media. Baños con sanitarios blancos estándar y revestimiento cerámico. Carpintería lacada en blanco. Iluminación LED empotrada. Acabado funcional, práctico y de bajo coste de mantenimiento.',
  premium: 'Suelos de madera natural o porcelánico gran formato (90×90). Cocina con encimera de cuarzo y electrodomésticos Siemens o Bosch integrados. Baños con doble lavabo, grifería de bronce o negro mate, y plato de ducha flush. Carpintería lacada en color. Iluminación con carril magnético y LED perimetral. Calidad percibida alta en cada punto de contacto.',
  signature: 'Suelos de madera de ingeniería o mármol pulido. Cocina de diseño con isla, encimera Dekton y electrodomésticos Miele o Gaggenau. Baños con sanitarios Geberit/Roca, griferías premium Hansgrohe, mamparas a medida y volúmenes de pladur curvado. Carpintería de autor con herrajes de diseño. Iluminación escénica con protocolo DALI. Domótica integrada. Acabado de autor — producto diferencial en la zona.'
};

function applyCalidadesPreset() {
  const d = getCurrentDossier();
  const val = $('calidadesPreset')?.value || '';
  d.calidades.preset = val;
  const preview = $('calidades-preview');
  const customInput = $('calidadesCustomText');
  if (val && !d.calidades.customText) {
    const text = CALIDADES_DEFAULTS[val] || '';
    if (preview) preview.textContent = text;
    if (customInput) customInput.value = text;
    d.calidades.customText = text;
  } else if (val) {
    if (preview) preview.textContent = d.calidades.customText || CALIDADES_DEFAULTS[val] || '';
    if (customInput) customInput.value = d.calidades.customText || CALIDADES_DEFAULTS[val] || '';
  } else {
    if (preview) preview.textContent = '';
    if (customInput) customInput.value = '';
  }
}

function toggleCalidadesEditor() {
  const ed = $('calidades-editor');
  if (ed) ed.style.display = ed.style.display === 'none' ? 'block' : 'none';
}

function saveCalidadesCustom() {
  const d = getCurrentDossier();
  d.calidades.customText = $('calidadesCustomText')?.value || '';
  const preview = $('calidades-preview');
  if (preview) preview.textContent = d.calidades.customText;
}

// ── NEGOTIATION TIMELINE ───────────────────────────
const NEG_TIPOS = {
  asking:       { label:'Precio inicial asking',  color:'#E05555' },
  oferta:       { label:'Oferta presentada',       color:'rgba(196,151,90,0.9)' },
  rechazada:    { label:'Oferta rechazada',        color:'#E05555' },
  contraoferta: { label:'Contraoferta vendedor',   color:'var(--amber)' },
  pactado:      { label:'Precio pactado ✓',       color:'#52C07A' },
};

function addNegHito(hito) {
  const d = getCurrentDossier();
  const newHito = hito || { tipo:'oferta', importe:0, fecha:'', nota:'' };
  d.negotiation.push(newHito);
  renderNegHitos();
}

function removeNegHito(idx) {
  const d = getCurrentDossier();
  d.negotiation.splice(idx, 1);
  renderNegHitos();
}

function renderNegHitos() {
  const d = getCurrentDossier();
  const container = $('neg-hitos-list');
  if (!container) return;
  container.innerHTML = d.negotiation.map((h, i) => `
    <div style="background:var(--d4);border:1px solid var(--d6);padding:10px 12px;position:relative">
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-bottom:6px;align-items:end">
        <div class="field" style="margin:0">
          <label style="font-size:9px">Tipo de hito</label>
          <select onchange="updateNegHito(${i},'tipo',this.value)" style="font-size:11px">
            ${Object.entries(NEG_TIPOS).map(([k,v])=>`<option value="${k}" ${h.tipo===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="margin:0">
          <label style="font-size:9px">Importe (€)</label>
          <input type="number" value="${h.importe||''}" onchange="updateNegHito(${i},'importe',+this.value)" placeholder="1.200.000" style="font-family:'DM Mono',monospace;font-size:11px">
        </div>
        <button onclick="removeNegHito(${i})" style="background:rgba(224,85,85,0.1);border:1px solid rgba(224,85,85,0.25);color:#E05555;font-size:10px;padding:6px 9px;cursor:pointer;align-self:end">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div class="field" style="margin:0">
          <label style="font-size:9px">Fecha</label>
          <input type="date" value="${h.fecha||''}" onchange="updateNegHito(${i},'fecha',this.value)" style="font-size:11px">
        </div>
        <div class="field" style="margin:0">
          <label style="font-size:9px">Nota (opcional)</label>
          <input type="text" value="${h.nota||''}" onchange="updateNegHito(${i},'nota',this.value)" placeholder="Condiciones, contexto…" style="font-size:11px">
        </div>
      </div>
    </div>`).join('');
}

function updateNegHito(idx, field, val) {
  const d = getCurrentDossier();
  if (d.negotiation[idx]) d.negotiation[idx][field] = val;
}

// ── CATALIZADORES ──────────────────────────────────
function addCatalizador() {
  const d = getCurrentDossier();
  if (d.catalizadores.length >= 4) return;
  d.catalizadores.push({ nombre: '', descripcion: '' });
  renderCatalizadores();
}

function removeCatalizador(idx) {
  const d = getCurrentDossier();
  d.catalizadores.splice(idx, 1);
  renderCatalizadores();
}

function updateCatalizador(idx, field, val) {
  const d = getCurrentDossier();
  if (d.catalizadores[idx]) d.catalizadores[idx][field] = val;
}

function renderCatalizadores() {
  const d = getCurrentDossier();
  const container = $('catalizadores-list');
  if (!container) return;
  container.innerHTML = d.catalizadores.map((c, i) => `
    <div style="background:var(--d4);border:1px solid var(--d6);padding:10px 12px;position:relative">
      <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
        <input type="text" value="${c.nombre||''}" onchange="updateCatalizador(${i},'nombre',this.value)" placeholder="Nombre del catalizador (ej: Nobu Hotel Madrid)" style="flex:1;font-size:11px;font-weight:500">
        <button onclick="removeCatalizador(${i})" style="background:rgba(224,85,85,0.1);border:1px solid rgba(224,85,85,0.25);color:#E05555;font-size:10px;padding:5px 8px;cursor:pointer;flex-shrink:0">✕</button>
      </div>
      <textarea onchange="updateCatalizador(${i},'descripcion',this.value)" placeholder="Descripción breve del proyecto y su impacto en la zona…" rows="2" style="width:100%;background:var(--d3);border:1px solid var(--d6);color:var(--text-b);font-family:'Raleway',sans-serif;font-size:10.5px;padding:6px 8px;resize:vertical;line-height:1.5">${c.descripcion||''}</textarea>
    </div>`).join('');
}

function handlePhotoUpload(input) {
  const d = getCurrentDossier();
  const available = 6 - d.photos.length;
  if (available <= 0) { alert('Máximo 6 fotos por operación.'); return; }
  const files = Array.from(input.files).slice(0, available);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 1200, maxH = 900;
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        d.photos.push({ dataUrl, caption: file.name.replace(/\.[^.]+$/, ''), category: 'general' });
        renderDossierPhotos();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderDossierPhotos() {
  const d = getCurrentDossier();
  const el = $('dossier-photos-grid');
  if (!el) return;
  const labelEl = $('photo-upload-label');
  if (labelEl) labelEl.style.display = d.photos.length >= 6 ? 'none' : '';
  el.innerHTML = d.photos.map((p, i) => `
    <div style="position:relative;aspect-ratio:4/3;overflow:hidden;background:var(--d4)">
      <img src="${p.dataUrl}" style="width:100%;height:100%;object-fit:cover">
      <div style="position:absolute;bottom:0;left:0;right:0;padding:4px 6px;background:rgba(0,0,0,0.6);display:flex;align-items:center;gap:4px">
        <input value="${p.caption}" placeholder="Descripción…"
          oninput="getCurrentDossier().photos[${i}].caption=this.value"
          style="flex:1;background:none;border:none;color:#fff;font-size:9px;outline:none;min-width:0">
        <button onclick="removeDossierPhoto(${i})" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:14px;padding:0;line-height:1">×</button>
      </div>
    </div>`).join('');
}

function removeDossierPhoto(i) {
  getCurrentDossier().photos.splice(i, 1);
  renderDossierPhotos();
}

// ══════════════════════════════════════════════════
// PRESENTATION MODE
// ══════════════════════════════════════════════════
let presSlideIdx = 0;
let presSlides   = [];
let presKeyHandler = null;

// SLIDE_DEFS moved to buildSlides section

async function openPresentation() {
  saveDossierNarrative();
  const d = getCurrentDossier();

  // Always reset coords so a changed address triggers fresh geocoding
  d.mapLat = null; d.mapLng = null;

  // Show presentation immediately, then geocode in background and refresh map slide
  const m = calc();
  presSlides = buildSlides(m, d);
  presSlideIdx = 0;
  const pm = $('presentation-mode');
  if (!pm) return;
  pm.style.display = 'block';
  renderPresSlide();
  renderPresDots();
  presKeyHandler = e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') presNav(1);
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   presNav(-1);
    if (e.key === 'Escape') closePresentation();
  };
  document.addEventListener('keydown', presKeyHandler);

  // Geocode and refresh the map slide once coords arrive
  if (S('dealAddress')) {
    await geocodeForMap(S('dealAddress'), S('dealCP'), S('dealMunicipio'));
    // Re-init the map if currently on the location slide
    const currentSlide = presSlides[presSlideIdx];
    if (currentSlide && currentSlide.needsMap) initPresMap();
    else if (presSlides.some(s => s.needsMap)) {
      // Map slide exists — re-render it so it picks up new coords when navigated to
      const mapIdx = presSlides.findIndex(s => s.needsMap);
      if (mapIdx > -1) presSlides[mapIdx]._mapReady = true;
    }
  }
}

function closePresentation() {
  const pm = $('presentation-mode');
  if (pm) pm.style.display = 'none';
  if (presKeyHandler) document.removeEventListener('keydown', presKeyHandler);
}

function presNav(dir) {
  presSlideIdx = Math.max(0, Math.min(presSlides.length - 1, presSlideIdx + dir));
  renderPresSlide();
  renderPresDots();
}

function renderPresSlide() {
  const slide = presSlides[presSlideIdx];
  if (!slide) return;
  const el = $('pres-slide');
  if (el) el.innerHTML = slide.html;

  const lbl = $('pres-slide-label');
  if (lbl) lbl.textContent = String(presSlideIdx+1).padStart(2,'0') + ' / ' + presSlides.length;
  const ttl = $('pres-slide-title');
  if (ttl) ttl.textContent = SLIDE_DEFS[presSlideIdx] ? SLIDE_DEFS[presSlideIdx].label : '';

  // Init Leaflet map if needed — wait for coords if geocoding is still in flight
  if (slide.needsMap) {
    const d = getCurrentDossier();
    if (d.mapLat) {
      // Coords already available — init immediately
      setTimeout(initPresMap, 150);
    } else if (S('dealAddress')) {
      // Geocode first, then init
      geocodeForMap(S('dealAddress'), S('dealCP'), S('dealMunicipio')).then(() => {
        if ($('pres-slide')) initPresMap(); // only if still on this slide
      });
    }
  }

  // Init Chart.js if needed
  if (slide.needsChart) {
    setTimeout(() => {
      const cp = parseInt(S('dealCP')) || 0;
      if (cp) initPresRegistroChart(cp);
    }, 100);
  }
}

function renderPresDots() {
  const el = $('pres-dots');
  if (!el) return;
  el.innerHTML = presSlides.map((_, i) =>
    `<div class="pres-dot${i===presSlideIdx?' active':''}" onclick="presSlideIdx=${i};renderPresSlide();renderPresDots()"></div>`
  ).join('');
}

// ══════════════════════════════════════════════════
// PLANS & MATERIALS UPLOAD
// ══════════════════════════════════════════════════
function handlePlanUpload(input) {
  const d = getCurrentDossier();
  if (!d.plans) d.plans = [];
  const avail = 3 - d.plans.length;
  if (avail <= 0) { alert('Máximo 3 planos.'); return; }
  Array.from(input.files).slice(0, avail).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1600 / img.width, 1200 / img.height);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        d.plans.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.8), caption: file.name.replace(/\.[^.]+$/, '') });
        renderDossierPlans();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function handleMaterialUpload(input) {
  const d = getCurrentDossier();
  if (!d.materials) d.materials = [];
  const avail = 9 - d.materials.length;
  if (avail <= 0) { alert('Máximo 9 materiales.'); return; }
  Array.from(input.files).slice(0, avail).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 600;
        const scale = Math.min(1, size / img.width, size / img.height);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        d.materials.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.82), label: file.name.replace(/\.[^.]+$/, '') });
        renderDossierMaterials();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderDossierPlans() {
  const d = getCurrentDossier();
  const el = $('dossier-plans-grid');
  if (!el) return;
  const lbl = $('plans-upload-label');
  if (lbl) lbl.style.display = (d.plans||[]).length >= 3 ? 'none' : '';
  el.innerHTML = (d.plans||[]).map((p, i) => `
    <div style="position:relative;aspect-ratio:4/3;overflow:hidden;background:var(--d4)">
      <img src="${p.dataUrl}" style="width:100%;height:100%;object-fit:cover">
      <div style="position:absolute;bottom:0;left:0;right:0;padding:3px 6px;background:rgba(0,0,0,0.65);display:flex;align-items:center;gap:4px">
        <input value="${p.caption}" placeholder="Plano…" oninput="getCurrentDossier().plans[${i}].caption=this.value"
          style="flex:1;background:none;border:none;color:#fff;font-size:9px;outline:none;min-width:0">
        <button onclick="getCurrentDossier().plans.splice(${i},1);renderDossierPlans()" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:13px;padding:0;line-height:1">×</button>
      </div>
    </div>`).join('');
}

function renderDossierMaterials() {
  const d = getCurrentDossier();
  const el = $('dossier-materials-grid');
  if (!el) return;
  const lbl = $('materials-upload-label');
  if (lbl) lbl.style.display = (d.materials||[]).length >= 9 ? 'none' : '';
  el.innerHTML = (d.materials||[]).map((m, i) => `
    <div style="position:relative;aspect-ratio:1;overflow:hidden;background:var(--d4)">
      <img src="${m.dataUrl}" style="width:100%;height:100%;object-fit:cover">
      <div style="position:absolute;bottom:0;left:0;right:0;padding:3px 6px;background:rgba(0,0,0,0.7);display:flex;align-items:center;gap:4px">
        <input value="${m.label}" placeholder="Mármol…" oninput="getCurrentDossier().materials[${i}].label=this.value"
          style="flex:1;background:none;border:none;color:#fff;font-size:9px;outline:none;min-width:0">
        <button onclick="getCurrentDossier().materials.splice(${i},1);renderDossierMaterials()" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:13px;padding:0;line-height:1">×</button>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════
// PRESENTATION — MAP + CHART SUPPORT
// ══════════════════════════════════════════════════
let presMapInstance = null;
let presChartInstance = null;

function initPresMap() {
  const container = document.getElementById('pres-map-container');
  if (!container) return;
  if (presMapInstance) { presMapInstance.remove(); presMapInstance = null; }
  const d = getCurrentDossier();
  const lat = d.mapLat || 40.4168;
  const lng = d.mapLng || -3.7038;
  presMapInstance = L.map(container, { zoomControl: true, attributionControl: false, scrollWheelZoom: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(presMapInstance);
  const icon = L.divIcon({
    html: '<div style="width:16px;height:16px;background:#C4975A;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(196,151,90,0.4)"></div>',
    iconSize: [16,16], iconAnchor: [8,8], className: ''
  });
  L.marker([lat, lng], { icon }).addTo(presMapInstance);
  presMapInstance.setView([lat, lng], 15);
  setTimeout(() => presMapInstance && presMapInstance.invalidateSize(), 200);
}

// ══════════════════════════════════════════════════
// ADDRESS AUTOCOMPLETE — Photon (Komoot / OSM)
// No API key required. Best Spanish street coverage.
// ══════════════════════════════════════════════════
let rwAcTimer = null;
let rwAcIdx   = -1;
let rwAcItems = [];

async function rwAcQuery(val) {
  clearTimeout(rwAcTimer);
  const q = (val || '').trim();
  if (q.length < 3) { rwAcHide(); return; }

  rwAcTimer = setTimeout(async () => {
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=es&limit=6&bbox=-9.4,35.9,4.3,43.8`;
      const res  = await fetch(url);
      const data = await res.json();

      rwAcItems = (data.features || []).filter(f => {
        const p = f.properties;
        // Only show results with a street (house number optional)
        return p.street || p.name;
      }).map(f => {
        const p  = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        const street = [p.name && !p.street ? p.name : p.street, p.housenumber].filter(Boolean).join(' ');
        const city   = [p.postcode, p.city || p.town || p.village].filter(Boolean).join(' ');
        const label  = [street, p.city || p.town || p.village, p.country].filter(Boolean).join(', ');
        return { label, street, postcode: p.postcode || '', city: p.city || p.town || p.village || '', lat, lon };
      });

      rwAcRender();
    } catch(e) { rwAcHide(); }
  }, 280);
}

function rwAcRender() {
  const drop = $('rw-ac-dropdown');
  if (!drop) return;
  if (!rwAcItems.length) { rwAcHide(); return; }

  rwAcIdx = -1;
  drop.innerHTML = rwAcItems.map((item, i) =>
    `<div class="rw-ac-item" data-i="${i}" onmousedown="rwAcSelect(${i})">
      ${item.street || item.label.split(',')[0]}
      <small>${[item.postcode, item.city].filter(Boolean).join(' · ')}</small>
    </div>`
  ).join('');
  drop.style.display = 'block';
}

function rwAcSelect(i) {
  const item = rwAcItems[i];
  if (!item) return;

  const inp = $('dealAddress');
  if (inp) inp.value = item.street || item.label.split(',')[0];

  if (item.postcode && $('dealCP'))    $('dealCP').value    = item.postcode;
  if (item.city    && $('dealMunicipio')) $('dealMunicipio').value = item.city;

  // Store coords immediately — no geocoding needed
  const d = getCurrentDossier();
  d.mapLat = item.lat;
  d.mapLng = item.lon;

  const status = $('geo-status');
  if (status) {
    status.textContent = `✓ ${item.label}`;
    status.style.color = 'var(--green)';
    setTimeout(() => { if (status) status.textContent = ''; }, 3000);
  }

  rwAcHide();
  update();
  // Kick off orientation calculation in background
  rwFetchAndStoreOrientation();
}

function rwAcKey(e) {
  const drop = $('rw-ac-dropdown');
  if (!drop || drop.style.display === 'none') return;
  const items = drop.querySelectorAll('.rw-ac-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    rwAcIdx = Math.min(rwAcIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === rwAcIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    rwAcIdx = Math.max(rwAcIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('active', i === rwAcIdx));
  } else if (e.key === 'Enter' && rwAcIdx >= 0) {
    e.preventDefault();
    rwAcSelect(rwAcIdx);
  } else if (e.key === 'Escape') {
    rwAcHide();
  }
}

function rwAcHide() {
  const drop = $('rw-ac-dropdown');
  if (drop) drop.style.display = 'none';
  rwAcIdx = -1;
}

// ══════════════════════════════════════════════════
// ORIENTATION ENGINE — Overpass API + solar description
// ══════════════════════════════════════════════════

function rwSolarDesc(cardinal) {
  const D = {
    N:  { icon:'↑', color:'#7bafd4', label:'Norte',
          short:'Sin sol directo',
          lines:['Luz fría y difusa todo el año','Fresco en verano · húmedo en invierno','Sin calor solar directo en ningún mes'] },
    NE: { icon:'↗', color:'#a8c8e8', label:'Noreste',
          short:'Sol de primera mañana',
          lines:['Sol entre las 7–10h en verano','Sin sol directo en invierno','Luminoso al amanecer · tardes frescas'] },
    E:  { icon:'→', color:'#f4c87a', label:'Este',
          short:'Sol de mañana todo el año',
          lines:['Sol 7–13h todo el año sin excepción','Tardes siempre en sombra','Fresco en verano · luminoso al despertar'] },
    SE: { icon:'↘', color:'#e8a83c', label:'Sureste',
          short:'Sol de mañana a mediodía',
          lines:['Sol 7–15h — orientación muy cotizada','Cálido en invierno · no sofocante en verano','Máxima luz natural sin sobrecalentamiento'] },
    S:  { icon:'↓', color:'#c49156', label:'Sur',
          short:'Sol pleno de mediodía',
          lines:['Sol directo 10–17h todo el año','Máxima luminosidad · muy cálido en verano','Prime en el mercado residencial español'] },
    SO: { icon:'↙', color:'#d4924a', label:'Suroeste',
          short:'Sol de tarde',
          lines:['Sol desde mediodía hasta las ~20h','Caluroso en tardes de julio y agosto','Luminoso para cenas en terraza en invierno'] },
    O:  { icon:'←', color:'#bf7a3c', label:'Oeste',
          short:'Sol de tarde intenso',
          lines:['Sol 14–20h todo el año','Muy caluroso en tardes de verano','Mañanas siempre en sombra y frescas'] },
    NO: { icon:'↖', color:'#8fb8d0', label:'Noroeste',
          short:'Sol de última tarde en verano',
          lines:['Sol sólo en verano tras las 17h','Sin sol directo de otoño a primavera','Fresco y moderado — bueno en climas cálidos'] },
  };
  return D[cardinal] || D['N'];
}

async function rwCalcOrientation(lat, lon, address) {
  try {
    // Query Overpass: ways near point with highway tag
    const q = `[out:json][timeout:8];way(around:100,${lat},${lon})[highway~"^(residential|primary|secondary|tertiary|unclassified|living_street|pedestrian|service|trunk)$"];out geom;`;
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
    const data = await res.json();

    const ways = data.elements?.filter(e => e.geometry?.length >= 2) || [];
    if (!ways.length) return null;

    // Pick way whose geometry is closest to our point
    let bestWay = null, bestDist = Infinity;
    for (const way of ways) {
      for (let i = 0; i < way.geometry.length - 1; i++) {
        const mLat = (way.geometry[i].lat + way.geometry[i+1].lat) / 2;
        const mLon = (way.geometry[i].lon + way.geometry[i+1].lon) / 2;
        const d = Math.hypot(mLat - lat, mLon - lon);
        if (d < bestDist) { bestDist = d; bestWay = way; }
      }
    }
    if (!bestWay) return null;

    // Find closest segment in best way
    const geom = bestWay.geometry;
    let minD = Infinity, segIdx = 0;
    for (let i = 0; i < geom.length - 1; i++) {
      const mLat = (geom[i].lat + geom[i+1].lat) / 2;
      const mLon = (geom[i].lon + geom[i+1].lon) / 2;
      const d = Math.hypot(mLat - lat, mLon - lon);
      if (d < minD) { minD = d; segIdx = i; }
    }

    const p1 = geom[segIdx], p2 = geom[segIdx + 1];
    const cosLat = Math.cos(lat * Math.PI / 180);
    const dLat = p2.lat - p1.lat;
    const dLon = (p2.lon - p1.lon) * cosLat;
    // Street bearing (direction the street runs)
    const streetBearing = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;

    // Facade = perpendicular to street
    // House number parity → side of street
    // Spain convention: odd = right side ascending street numbers
    const houseNum = parseInt((address.match(/\b(\d+)\b/) || [0,'0'])[1]);
    let facadeAngle;
    const uncertain = !houseNum;
    if (houseNum % 2 === 1) {
      facadeAngle = (streetBearing + 90) % 360;  // right side
    } else if (houseNum % 2 === 0 && houseNum > 0) {
      facadeAngle = (streetBearing - 90 + 360) % 360;  // left side
    } else {
      facadeAngle = (streetBearing + 90) % 360; // fallback
    }

    const cardinals = ['N','NE','E','SE','S','SO','O','NO'];
    const cardinal = cardinals[Math.round(facadeAngle / 45) % 8];
    const solar = rwSolarDesc(cardinal);

    return { angle: Math.round(facadeAngle), cardinal, solar, streetBearing: Math.round(streetBearing), uncertain, streetName: bestWay.tags?.name || '' };
  } catch(e) {
    console.warn('rwCalcOrientation error:', e);
    return null;
  }
}

async function rwFetchAndStoreOrientation() {
  const d = getCurrentDossier();
  if (!d.mapLat || !d.mapLng) return;
  // If the user has set a manual override, never overwrite it with the API result
  if (d.orientacionOverride) return;
  const addr = $('dealAddress')?.value || '';
  const result = await rwCalcOrientation(d.mapLat, d.mapLng, addr);
  if (result) {
    d.orientation = result;
    // Update geo-status to show orientation too
    const status = $('geo-status');
    if (status && !status.textContent.startsWith('✓')) return;
    if (status) {
      const prev = status.textContent;
      status.textContent = prev ? prev + ` · Fachada ${result.solar.label} (${result.angle}°)` : `Fachada ${result.solar.label} (${result.angle}°)`;
    }
  }
}


async function geocodeForMap(addr, cp, municipio) {
  if (!addr) return;
  try {
    const coords = await rwGeocode(addr, cp || S('dealCP'), municipio || S('dealMunicipio'));
    if (coords) {
      const d = getCurrentDossier();
      d.mapLat = coords.lat;
      d.mapLng = coords.lon;
      rwFetchAndStoreOrientation();
    }
  } catch(e) { console.log('geocodeForMap error:', e); }
}

function initPresRegistroChart(cp) {
  const canvas = document.getElementById('pres-registro-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (presChartInstance) { presChartInstance.destroy(); presChartInstance = null; }
  const records = REGISTRO_DATA.filter(r => r[0] === parseInt(cp));
  if (!records.length) return;
  const pm2s = records.map(r => r[2]).filter(v => v > 1000 && v < 30000);
  // Build histogram buckets of 1000€
  const min = Math.floor(Math.min(...pm2s) / 1000) * 1000;
  const max = Math.ceil(Math.max(...pm2s) / 1000) * 1000;
  const buckets = []; const labels = [];
  for (let v = min; v <= max; v += 1000) {
    labels.push(v.toLocaleString('es-ES'));
    buckets.push(pm2s.filter(p => p >= v && p < v + 1000).length);
  }
  const mediana = [...pm2s].sort((a,b)=>a-b)[Math.floor(pm2s.length/2)];
  const exitB = V('exitB');
  const bgColors = labels.map((l,i) => {
    const v = min + i * 1000;
    if (Math.abs(v - exitB) < 500) return 'rgba(196,151,90,0.9)';
    if (Math.abs(v - mediana) < 500) return 'rgba(82,192,122,0.6)';
    return 'rgba(255,255,255,0.18)';
  });
  presChartInstance = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: buckets, backgroundColor: bgColors, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 9 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.06)' } },
        y: { ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.06)' } }
      }
    }
  });
}

// ══════════════════════════════════════════════════
// PRESENTATION SLIDES — FULL REBUILD
// ══════════════════════════════════════════════════
const SLIDE_DEFS = [
  { id:'portada',      label:'Portada' },
  { id:'activo',       label:'01 · El activo' },
  { id:'ubicacion',    label:'02 · Ubicación' },
  { id:'zona',         label:'03 · La zona' },
  { id:'mercado',      label:'04 · El mercado' },
  { id:'testigos',     label:'05 · Proyección de venta' },
  { id:'proyecto',     label:'06 · El proyecto' },
  { id:'numeros',      label:'07 · Los números' },
  { id:'carry',        label:'08 · Alineación' },
  { id:'timeline',     label:'09 · Calendario' },
  { id:'sensibilidad', label:'10 · Protección capital' },
];

function buildSlides(m, d) {
  const fmt2 = v => (v||0).toLocaleString('es-ES',{maximumFractionDigits:0}) + ' €';
  const fmtP = v => ((v||0)*100).toFixed(1) + '%';
  const fmtK2 = v => v >= 1000000 ? (v/1000000).toFixed(2) + 'M €' : Math.round(v/1000) + 'K €';
  const photo = (arr, idx, style='') => (arr||[])[idx]
    ? `<img src="${arr[idx].dataUrl}" style="object-fit:cover;${style}">`
    : `<div style="${style};background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center"><span style="font-size:10px;color:rgba(255,255,255,0.15)">Sin imagen</span></div>`;
  const photoLabel = (arr, idx, style='', label='') => (arr||[])[idx]
    ? `<img src="${arr[idx].dataUrl}" style="object-fit:contain;background:#111;${style}">`
    : `<div style="${style};background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px"><span style="font-size:10px;letter-spacing:0.1em;color:rgba(255,255,255,0.2)">FOTO</span>${label?`<span style="font-size:10px;color:rgba(255,255,255,0.15)">(${label})</span>`:''}</div>`;

  const addr    = [S('dealAddress'), S('dealCP'), S('dealMunicipio')].filter(Boolean).join(' · ');
  const mz      = document.getElementById('microzona')?.value || '';
  const mzData  = MICROZONE_DATA.find(z => z.z === mz);
  const mzTier  = mzData?.tier || '';
  const buyPm2  = m.surfCapex > 0 ? Math.round(m.buyPrice / m.surfCapex) : 0;
  const exitPm2B = V('exitB');
  const cp      = S('dealCP');
  const reforComp = comps.filter(c => c.precio > 0 && c.m2 > 0 && c.tipo === 'reformado');
  const reformarComp = comps.filter(c => c.precio > 0 && c.m2 > 0 && c.tipo === 'reformar');
  const medRefPm2 = reforComp.length ? Math.round(reforComp.reduce((s,c)=>s+c.precio/c.m2,0)/reforComp.length) : 0;
  const medRfmPm2 = reformarComp.length ? Math.round(reformarComp.reduce((s,c)=>s+c.precio/c.m2,0)/reformarComp.length) : 0;
  const descuento = medRfmPm2 > 0 && buyPm2 > 0 ? ((medRfmPm2 - buyPm2) / medRfmPm2 * 100).toFixed(1) : null;

  // CSS for all slides
  const baseCSS = `<style>
    .ps-tag{font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(196,151,90,0.8);margin-bottom:10px;font-weight:600}
    .ps-h1{font-family:'Cormorant Garamond',serif;font-size:48px;font-weight:300;color:#fff;line-height:1.1;margin-bottom:8px}
    .ps-h2{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:300;color:#fff;line-height:1.15;margin-bottom:16px}
    .ps-body{font-size:13px;color:rgba(255,255,255,0.6);line-height:1.8}
    .ps-div{width:36px;height:1px;background:rgba(196,151,90,0.45);margin:18px 0}
    .ps-kv{display:flex;flex-direction:column}
    .ps-kv-v{font-family:'DM Mono',monospace;font-size:20px;color:#fff;font-feature-settings:'tnum' 1;font-weight:500}
    .ps-kv-l{font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-top:3px}
    .ps-data{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);padding:12px 16px}
    .ps-data-l{font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:4px}
    .ps-data-v{font-family:'DM Mono',monospace;font-size:13px;color:#fff;font-feature-settings:'tnum' 1}
    .inner{padding:44px 56px;height:100%;box-sizing:border-box;display:flex;flex-direction:column}
    .full{position:relative;height:100%;overflow:hidden}
    @keyframes tl-grow{from{width:0}to{width:100%}}
    @keyframes tl-pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
    @keyframes fade-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    .ps-anim{animation:fade-up 0.5s ease forwards}
  </style>
  <div style="position:absolute;bottom:18px;right:28px;z-index:200;pointer-events:none">
    <img src="/Riverwalk_Logo_Blanco.png" style="height:20px;width:auto;display:block;opacity:0.55">
  </div>`;

  const slides = [];

  // ── PORTADA ──────────────────────────────────────────────────────────────
  slides.push({ id:'portada', html: baseCSS + `
    <div class="full" style="display:grid;grid-template-columns:1fr 42%">
      <div class="inner" style="justify-content:space-between">
        <div></div>
        <div>
          <div class="ps-tag ps-anim" style="animation-delay:0.1s">Oportunidad de inversión</div>
          <div class="ps-h1 ps-anim" style="animation-delay:0.2s;font-size:56px">${S('dealName') || 'Activo prime Madrid'}</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.4);margin-top:4px" class="ps-anim">${addr}</div>
          ${mz ? `<div class="ps-anim" style="animation-delay:0.35s;margin-top:12px;display:inline-flex;align-items:center;gap:8px;padding:5px 14px;background:rgba(139,105,20,0.18);border:1px solid rgba(196,151,90,0.4)">
            <span style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(196,151,90,0.8)">${mz}</span>
            <span style="width:1px;height:12px;background:rgba(196,151,90,0.3)"></span>
            <span style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(196,151,90,0.55)">Tier ${mzTier}</span>
          </div>` : ''}
        </div>
        <div class="ps-div"></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:40px" class="ps-anim">
          ${[
            ['Inversión total', fmt2(m.totalInvest)],
            ['Precio salida base', fmt2(m.base.saleGross)],
            ['ROI bruto', fmtP(m.base.roiGross)],
          ].map(([l,v],i) => `<div class="ps-kv"><div class="ps-kv-v" style="${i===2?'color:rgba(196,151,90,0.9)':''}">${v}</div><div class="ps-kv-l">${l}</div></div>`).join('')}
        </div>
        <div style="font-size:9px;color:rgba(255,255,255,0.2);letter-spacing:0.1em">${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</div>
      </div>
      <div style="position:relative;overflow:hidden">
        ${photoLabel(d.photos, 0, 'position:absolute;inset:0;width:100%;height:100%', 'Fachada exterior')}
      </div>
    </div>` });

  // ── EL ACTIVO ──────────────────────────────────────────────────────────────
  slides.push({ id:'activo', html: baseCSS + `
  <style>
    .sl-light .ps-h2{color:#1A1D23}
    .sl-light .ps-body{color:rgba(26,29,35,0.62)}
    .sl-light .ps-data{background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08)}
    .sl-light .ps-data-l{color:rgba(0,0,0,0.4)}
    .sl-light .ps-data-v{color:#1A1D23}
  </style>
    <div class="inner sl-light" style="flex-direction:row;gap:44px;padding:36px 48px;background:#F7F5F2;position:relative">
      <div style="position:absolute;bottom:18px;right:28px;z-index:201;pointer-events:none">
        <img src="/Riverwalk_Logo_Negro.png" style="height:20px;width:auto;display:block;opacity:0.38">
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:0">
        <div class="ps-tag">El activo</div>
        <div class="ps-h2">${S('dealName') || '—'}</div>
        <div class="ps-body" style="margin-bottom:20px">${d.narrative?.activo || '<span style="opacity:0.25">Genera la descripción con ✦ Narrativa IA</span>'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${[
            ['Superficie', m.surfCapex + ' m²'],
            ['Precio compra', fmt2(m.buyPrice)],
            ['€/m² compra', buyPm2.toLocaleString('es-ES') + ' €/m²'],
            ['Microzona', mz || '—'],
          ].map(([l,v]) => `<div class="ps-data"><div class="ps-data-l">${l}</div><div class="ps-data-v">${v}</div></div>`).join('')}
        </div>
      </div>
      <div style="flex:0 0 42%;display:flex;flex-direction:column;gap:0;background:#FFFFFF;overflow:hidden;">
        <div style="flex:2;overflow:hidden;min-height:0;background:#FFFFFF;">
          ${(d.plans||[])[0]
            ? `<img src="${d.plans[0].dataUrl}" style="object-fit:contain;background:#FFFFFF;width:100%;height:100%;display:block;">`
            : `<div style="width:100%;height:100%;background:#F0EFEC;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px"><span style="font-size:10px;letter-spacing:0.1em;color:rgba(0,0,0,0.2)">PLANO</span></div>`}
        </div>
        <div style="flex:0 0 3px;background:#E8E4DC;"></div>
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:2px;min-height:0;background:#E8E4DC;">
          ${photoLabel(d.photos, 1, 'width:100%;height:100%', 'Salón')}
          ${photoLabel(d.photos, 2, 'width:100%;height:100%', 'Cocina')}
        </div>
        <div style="flex:0 0 2px;background:#E8E4DC;"></div>
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:2px;min-height:0;background:#E8E4DC;">
          ${photoLabel(d.photos, 3, 'width:100%;height:100%', 'Dormitorio')}
          ${photoLabel(d.photos, 4, 'width:100%;height:100%', 'Baño')}
        </div>
      </div>
    </div>` });

  // ── UBICACIÓN ──────────────────────────────────────────────────────────────
  // ── UBICACIÓN ──────────────────────────────────────────────────────────────
  const ori = d.orientation || null;
  const oriPanel = ori ? (() => {
    const sd = ori.solar;
    const ang = ori.angle;
    // Draw compass needle as inline SVG
    const compassSVG = `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(196,151,90,0.25)" stroke-width="1"/>
      <circle cx="32" cy="32" r="1.5" fill="rgba(196,151,90,0.8)"/>
      ${['N','NE','E','SE','S','SO','O','NO'].map((l,i) => {
        const a = i * 45 * Math.PI / 180;
        const r = 24, tr = 28;
        const x = 32 + Math.sin(a)*r, y = 32 - Math.cos(a)*r;
        const tx = 32 + Math.sin(a)*tr, ty = 32 - Math.cos(a)*tr + 1;
        const isMain = i % 2 === 0;
        return `<line x1="32" y1="32" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,${isMain?0.25:0.1})" stroke-width="${isMain?1:0.5}"/>
                <text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" fill="rgba(255,255,255,${l==='N'?0.9:0.3})" font-size="${isMain?6:0}" text-anchor="middle" dominant-baseline="middle" font-family="Raleway,sans-serif" font-weight="600">${l}</text>`;
      }).join('')}
      <!-- needle: points toward facade direction -->
      <g transform="rotate(${ang}, 32, 32)">
        <polygon points="32,8 29.5,32 32,28 34.5,32" fill="${sd.color}" opacity="0.9"/>
        <polygon points="32,56 29.5,32 32,36 34.5,32" fill="rgba(255,255,255,0.2)"/>
      </g>
    </svg>`;
    return `
    <div style="position:absolute;bottom:36px;right:40px;z-index:10;background:rgba(10,11,15,0.88);border:1px solid rgba(196,151,90,0.3);padding:20px 24px;max-width:300px;backdrop-filter:blur(4px)">
      <div style="font-size:8.5px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(196,151,90,0.6);margin-bottom:10px">Orientación fachada</div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
        ${compassSVG}
        <div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:26px;color:${sd.color};line-height:1">${sd.label}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:2px">${ang}° · ${ori.uncertain ? 'estimado' : 'nº '+($('dealAddress')?.value?.match(/\b(\d+)\b/)||['','?'])[1]}</div>
        </div>
      </div>
      <div style="font-size:10.5px;color:rgba(255,255,255,0.7);font-weight:600;margin-bottom:6px">${sd.short}</div>
      ${sd.lines.map(l => `<div style="font-size:9.5px;color:rgba(255,255,255,0.4);line-height:1.6">· ${l}</div>`).join('')}
    </div>`;
  })() : '';

  slides.push({ id:'ubicacion', needsMap:true, html: baseCSS + `
    <div class="full">
      <div id="pres-map-container" style="position:absolute;inset:0;z-index:0"></div>
      <div style="position:absolute;top:36px;left:40px;z-index:10;background:rgba(10,11,15,0.88);border:1px solid rgba(196,151,90,0.3);padding:20px 26px;max-width:360px;backdrop-filter:blur(4px)">
        <div class="ps-tag">Ubicación</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#fff;margin-bottom:6px">${S('dealAddress') || '—'}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.45)">${S('dealCP') || ''} ${S('dealMunicipio') || ''}</div>
        ${mz ? `<div style="margin-top:10px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(196,151,90,0.75)">${mz} · Tier ${mzTier}</div>` : ''}
      </div>
      ${oriPanel}
    </div>` });

  // ── LA ZONA ──────────────────────────────────────────────────────────────
  slides.push({ id:'zona', needsChart:true, html: baseCSS + `
    <div class="inner" style="padding:36px 48px">
      <div class="ps-tag">La zona · ${mz || 'Madrid prime'}</div>
      <div class="ps-h2" style="margin-bottom:12px">Contexto de mercado</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;flex:1;min-height:0">
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="ps-body">${d.narrative?.zona || '<span style="opacity:0.25">Genera el contexto de zona con ✦ Narrativa IA</span>'}</div>
          ${mzData ? `<div style="background:rgba(139,105,20,0.1);border:1px solid rgba(196,151,90,0.25);padding:16px 20px">
            <div class="ps-data-l">Prima microzona</div>
            <div style="font-family:'DM Mono',monospace;font-size:24px;color:rgba(196,151,90,0.9);margin:4px 0">${mzData.base >= 0 ? '+' : ''}${mzData.base}%</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.35)">sobre precio medio del CP · Tier ${mzTier}</div>
          </div>` : ''}
          ${medRefPm2 > 0 ? `<div class="ps-data"><div class="ps-data-l">Media testigos reformados</div><div class="ps-data-v">${medRefPm2.toLocaleString('es-ES')} €/m²</div></div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;min-height:0">
          <div style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:4px">Distribución €/m² en CP ${cp} · Registro Q1 2025</div>
          <div style="flex:1;position:relative;min-height:180px">
            <canvas id="pres-registro-chart"></canvas>
          </div>
          <div style="display:flex;gap:12px;font-size:9px;color:rgba(255,255,255,0.4)">
            <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:rgba(196,151,90,0.9);display:inline-block"></span>Precio salida base</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:rgba(82,192,122,0.6);display:inline-block"></span>Mediana CP</span>
          </div>
        </div>
      </div>
    </div>` });

  // ── EL MERCADO — Negociación bid/ask timeline ───────────────────────────────
  const negHitos = d.negotiation || [];
  const askingHito = negHitos.find(h => h.tipo === 'asking');
  const pactadoHito = negHitos.find(h => h.tipo === 'pactado');
  const askingPrice = askingHito?.importe || 0;
  const pactadoPrice = pactadoHito?.importe || m.buyPrice;
  const savingsAbs = askingPrice > 0 ? askingPrice - pactadoPrice : 0;
  const savingsPct = askingPrice > 0 ? ((savingsAbs / askingPrice) * 100).toFixed(1) : null;

  const negTiposConfig = {
    asking:       { label:'Precio inicial asking',  color:'#E05555',              icon:'⬤' },
    oferta:       { label:'Oferta presentada',       color:'rgba(196,151,90,0.9)', icon:'→' },
    rechazada:    { label:'Oferta rechazada',        color:'rgba(224,85,85,0.6)',  icon:'✕' },
    contraoferta: { label:'Contraoferta vendedor',   color:'var(--amber)',         icon:'↩' },
    pactado:      { label:'Precio pactado',          color:'#52C07A',              icon:'✓' },
  };

  const negHTML = negHitos.length > 0 ? `
    <div style="position:relative;padding-left:28px">
      <div style="position:absolute;left:10px;top:12px;bottom:12px;width:1px;background:rgba(255,255,255,0.1)"></div>
      ${negHitos.map((h, i) => {
        const cfg = negTiposConfig[h.tipo] || negTiposConfig.oferta;
        const isLast = i === negHitos.length - 1;
        const fmtImporte = h.importe > 0 ? h.importe.toLocaleString('es-ES') + ' €' : '—';
        const fmtFecha = h.fecha ? new Date(h.fecha).toLocaleDateString('es-ES', {day:'2-digit',month:'short',year:'numeric'}) : '';
        return `<div style="position:relative;margin-bottom:${isLast?0:14}px;animation:fade-up 0.4s ease forwards;animation-delay:${i*0.12}s;opacity:0">
          <div style="position:absolute;left:-22px;top:4px;width:10px;height:10px;border-radius:50%;background:${cfg.color};box-shadow:0 0 0 3px rgba(10,11,15,1),0 0 0 4px ${cfg.color}40"></div>
          <div style="padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-left:2px solid ${cfg.color}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="font-size:8.5px;letter-spacing:0.14em;text-transform:uppercase;color:${cfg.color}">${cfg.label}</div>
              ${fmtFecha ? `<div style="font-size:9px;color:rgba(255,255,255,0.3)">${fmtFecha}</div>` : ''}
            </div>
            <div style="font-family:'DM Mono',monospace;font-size:18px;color:#fff;font-feature-settings:'tnum' 1">${fmtImporte}</div>
            ${h.nota ? `<div style="font-size:9.5px;color:rgba(255,255,255,0.35);margin-top:4px;font-style:italic">${h.nota}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>` : `<div style="color:rgba(255,255,255,0.2);font-size:12px;font-style:italic;padding:20px 0">Añade los hitos de negociación en la sección "Negociación — Historial bid/ask" del panel izquierdo.</div>`;

  slides.push({ id:'mercado', html: baseCSS + `
    <div class="inner" style="padding:36px 48px">
      <div class="ps-tag">El mercado · La negociación</div>
      <div class="ps-h2" style="margin-bottom:20px">Del precio inicial al precio pactado</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;flex:1;min-height:0;align-items:start">
        <div style="overflow-y:auto;max-height:100%">${negHTML}</div>
        <div style="display:flex;flex-direction:column;gap:16px">
          ${savingsPct ? `<div style="padding:20px 24px;background:rgba(30,122,69,0.12);border:1px solid rgba(82,192,122,0.35)">
            <div class="ps-data-l" style="margin-bottom:8px">Resultado de la negociación</div>
            <div style="font-family:'DM Mono',monospace;font-size:40px;color:#52C07A;line-height:1;font-weight:600">−${savingsPct}%</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:6px">sobre el precio de salida del vendedor</div>
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between">
              <div>
                <div class="ps-data-l">Precio inicial</div>
                <div style="font-family:'DM Mono',monospace;color:rgba(255,255,255,0.5);font-size:14px;text-decoration:line-through">${askingPrice.toLocaleString('es-ES')} €</div>
              </div>
              <div style="text-align:right">
                <div class="ps-data-l">Precio pactado</div>
                <div style="font-family:'DM Mono',monospace;color:rgba(196,151,90,0.9);font-size:16px">${pactadoPrice.toLocaleString('es-ES')} €</div>
              </div>
            </div>
            <div style="margin-top:10px;padding:10px 14px;background:rgba(82,192,122,0.08);border:1px solid rgba(82,192,122,0.2)">
              <div class="ps-data-l">Ahorro negociado</div>
              <div style="font-family:'DM Mono',monospace;font-size:18px;color:#52C07A;margin-top:3px">${savingsAbs.toLocaleString('es-ES')} €</div>
            </div>
          </div>` : `<div style="padding:16px 20px;background:rgba(139,105,20,0.1);border:1px solid rgba(196,151,90,0.25)">
            <div class="ps-data-l" style="margin-bottom:6px">Precio de compra</div>
            <div style="font-family:'DM Mono',monospace;font-size:26px;color:rgba(196,151,90,0.9)">${m.buyPrice.toLocaleString('es-ES')} €</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:4px">${buyPm2.toLocaleString('es-ES')} €/m²</div>
          </div>`}
          ${descuento ? `<div style="padding:14px 18px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">
            <div class="ps-data-l" style="margin-bottom:4px">Descuento vs mercado a reformar</div>
            <div style="font-family:'DM Mono',monospace;font-size:20px;color:#52C07A">−${descuento}%</div>
            <div style="font-size:9.5px;color:rgba(255,255,255,0.3);margin-top:3px">respecto a comparables sin reformar</div>
          </div>` : ''}
        </div>
      </div>
    </div>` });

  // ── TESTIGOS ──────────────────────────────────────────────────────────────
  slides.push({ id:'testigos', html: baseCSS + `
    <div class="inner" style="padding:36px 48px">
      <div class="ps-tag">Proyección de venta</div>
      <div class="ps-h2">Escenarios de precio de salida</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;flex:1;min-height:0">
        <div>
          ${reforComp.length > 0 ? `<div style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:8px">Testigos reformados (${reforComp.length})</div>
          <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:16px">
            ${reforComp.slice(0,6).map(c=>`<div style="display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:7px 12px;background:rgba(255,255,255,0.03);font-size:11.5px">
              <div style="color:rgba(255,255,255,0.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.desc||'—'}</div>
              <div style="font-family:'DM Mono',monospace;color:rgba(255,255,255,0.35);font-size:10px">${c.m2}m²</div>
              <div style="font-family:'DM Mono',monospace;color:rgba(255,255,255,0.75)">${Math.round(c.precio/c.m2).toLocaleString('es-ES')} €/m²</div>
            </div>`).join('')}
          </div>` : ''}
          ${medRefPm2 > 0 ? `<div style="padding:14px 18px;background:rgba(139,105,20,0.1);border:1px solid rgba(196,151,90,0.3)">
            <div class="ps-data-l">Media testigos reformados</div>
            <div style="font-family:'DM Mono',monospace;font-size:22px;color:rgba(196,151,90,0.9);margin-top:4px">${medRefPm2.toLocaleString('es-ES')} €/m²</div>
          </div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;justify-content:center">
          ${[
            {lbl:'Pesimista · P25',  ep:V('exitP'), sc:m.pess, col:'#E05555',  bg:'rgba(192,57,43,0.06)'},
            {lbl:'Base · Mediana',   ep:V('exitB'), sc:m.base, col:'rgba(196,151,90,0.95)', bg:'rgba(139,105,20,0.12)', bold:true},
            {lbl:'Optimista · P75',  ep:V('exitO'), sc:m.opt,  col:'#52C07A',  bg:'rgba(30,122,69,0.06)'},
          ].map(({lbl,ep,sc,col,bg,bold})=>`<div style="padding:18px 20px;background:${bg};border:1px solid ${bold?'rgba(196,151,90,0.4)':'rgba(255,255,255,0.07)'}">
            <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:${col};margin-bottom:8px">${lbl}</div>
            <div style="font-family:'DM Mono',monospace;font-size:${bold?28:22}px;color:#fff;font-feature-settings:'tnum' 1;font-weight:${bold?600:400}">${ep.toLocaleString('es-ES')} €/m²</div>
            <div style="font-family:'DM Mono',monospace;font-size:12px;color:rgba(255,255,255,0.4);margin-top:5px">${fmt2(ep*m.surfCapex)} · ROI bruto <span style="color:${col}">${fmtP(sc.roiGross)}</span></div>
          </div>`).join('')}
        </div>
      </div>
    </div>` });

  // ── EL PROYECTO ──────────────────────────────────────────────────────────
  const interiorismImg = INTERIORISM_IMGS[d.interiorismStyle || ''] || null;
  slides.push({ id:'proyecto', html: baseCSS + `
  <style>
    .sl-light .ps-h2{color:#1A1D23}
    .sl-light .ps-body{color:rgba(26,29,35,0.62)}
    .sl-light .ps-data{background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08)}
    .sl-light .ps-data-l{color:rgba(0,0,0,0.4)}
    .sl-light .ps-data-v{color:#1A1D23}
  </style>
    <div class="inner sl-light" style="flex-direction:row;gap:36px;padding:36px 48px;background:#F7F5F2;position:relative">
      <div style="position:absolute;bottom:18px;right:28px;z-index:201;pointer-events:none">
        <img src="/Riverwalk_Logo_Negro.png" style="height:20px;width:auto;display:block;opacity:0.38">
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:0">
        <div class="ps-tag">El proyecto</div>
        <div class="ps-h2">Reforma integral · Paleta de calidades</div>
        <div class="ps-body" style="margin-bottom:20px">${d.narrative?.proyecto || '<span style="opacity:0.25">Genera la tesis del proyecto con ✦ Narrativa IA</span>'}</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${[
            ['Obra', V('obraM2').toLocaleString('es-ES') + ' €/m² + IVA'],
            ['Interiorismo', V('decoM2').toLocaleString('es-ES') + ' €/m² + IVA'],
            ['CapEx total', fmt2(m.capexNet * (1 + V('ivaObra')/100))],
            ['Superficie reforma', m.surfCapex + ' m²'],
          ].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:9px 14px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.07);font-size:12px">
            <span style="color:rgba(0,0,0,0.45)">${l}</span>
            <span style="font-family:'DM Mono',monospace;color:#1A1D23">${v}</span>
          </div>`).join('')}
        </div>
      </div>
      <div style="flex:0 0 44%;display:flex;flex-direction:column;gap:0;overflow:hidden;background:#FFFFFF;">
        <div style="flex:1;overflow:hidden;min-height:0;background:#FFFFFF;">
          ${(d.plans||[])[1]
            ? `<img src="${d.plans[1].dataUrl}" style="width:100%;height:100%;object-fit:contain;background:#FFFFFF;display:block;">`
            : ((d.plans||[])[0]
                ? `<img src="${d.plans[0].dataUrl}" style="width:100%;height:100%;object-fit:contain;background:#FFFFFF;display:block;">`
                : `<div style="width:100%;height:100%;background:#F0EFEC;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px"><span style="font-size:10px;letter-spacing:0.1em;color:rgba(0,0,0,0.2)">PLANO OBJETIVO</span></div>`)}
        </div>
        <div style="flex:0 0 3px;background:#E8E4DC;"></div>
        <div style="flex:1;overflow:hidden;min-height:0;background:#FFFFFF;">
          ${interiorismImg
            ? `<img src="${interiorismImg}" style="width:100%;height:100%;object-fit:cover;display:block;">`
            : `<div style="width:100%;height:100%;background:#F0EFEC;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px"><span style="font-size:10px;letter-spacing:0.1em;color:rgba(0,0,0,0.2)">TIPOLOGÍA DE INTERIORISMO</span></div>`
          }
        </div>
      </div>
    </div>` });

  // ── LOS NÚMEROS — 3 escenarios full screen ─────────────────────────────────
  slides.push({ id:'numeros', html: baseCSS + `
    <div class="full" style="display:grid;grid-template-columns:280px 1fr 1fr 1fr">
      <!-- Left panel: investment breakdown -->
      <div style="background:rgba(0,0,0,0.5);border-right:1px solid rgba(255,255,255,0.06);padding:36px 28px;display:flex;flex-direction:column;justify-content:center;gap:14px">
        <div class="ps-tag">Estructura</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:26px;color:#fff;margin-bottom:4px">La operación</div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${[
            ['Precio compra', fmt2(m.buyPrice), ''],
            ['ITP + Notaría', fmt2(m.itp + m.notaria), ''],
            ['CapEx + IVA', fmt2(m.capexNet * (1+V('ivaObra')/100)), ''],
            ['Management fee', fmt2(m.mgmtFee * (1+V('ivaObra')/100)), ''],
          ].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:8px 10px;background:rgba(255,255,255,0.03);font-size:11px">
            <span style="color:rgba(255,255,255,0.4)">${l}</span>
            <span style="font-family:'DM Mono',monospace;color:rgba(255,255,255,0.75);font-size:10.5px">${v}</span>
          </div>`).join('')}
          <div style="display:flex;justify-content:space-between;padding:10px;background:rgba(139,105,20,0.12);border:1px solid rgba(196,151,90,0.3);margin-top:4px">
            <span style="font-size:11px;color:rgba(255,255,255,0.7)">Total inversión</span>
            <span style="font-family:'DM Mono',monospace;color:rgba(196,151,90,0.9);font-size:12px">${fmt2(m.totalInvest)}</span>
          </div>
        </div>
      </div>
      <!-- 3 scenario panels -->
      ${[
        {lbl:'Pesimista',  ep:V('exitP'), sc:m.pess, col:'#E05555',              bg:'rgba(192,57,43,0.04)',  border:'rgba(192,57,43,0.2)'},
        {lbl:'Base case',  ep:V('exitB'), sc:m.base, col:'rgba(196,151,90,0.95)',bg:'rgba(139,105,20,0.1)', border:'rgba(196,151,90,0.4)'},
        {lbl:'Optimista',  ep:V('exitO'), sc:m.opt,  col:'#52C07A',              bg:'rgba(30,122,69,0.05)', border:'rgba(30,122,69,0.25)'},
      ].map(({lbl,ep,sc,col,bg,border})=>`<div style="background:${bg};border-left:1px solid ${border};padding:36px 32px;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:${col};margin-bottom:20px;font-weight:600">${lbl}</div>
        <!-- Hero ROI -->
        <div style="font-family:'Cormorant Garamond',serif;font-size:72px;color:${col};line-height:1;margin-bottom:6px;font-weight:300">${fmtP(sc.roiGross)}</div>
        <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:24px">ROI bruto operación</div>
        <!-- Metrics -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${[
            ['Precio salida', ep.toLocaleString('es-ES') + ' €/m²'],
            ['Venta bruta', fmt2(ep*m.surfCapex)],
            ['Beneficio bruto', fmt2(sc.grossProfit)],
            ['TIR anual', isFinite(sc.irr) ? fmtP(sc.irr) : '—'],
          ].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span style="font-size:11px;color:rgba(255,255,255,0.35)">${l}</span>
            <span style="font-family:'DM Mono',monospace;font-size:12px;color:rgba(255,255,255,0.75)">${v}</span>
          </div>`).join('')}
        </div>
        <!-- Carry deduction -->
        <div style="margin-top:20px;padding:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07)">
          <div style="font-size:9px;color:rgba(255,255,255,0.3);margin-bottom:6px;letter-spacing:0.1em;text-transform:uppercase">Carry Riverwalk</div>
          <div style="display:flex;justify-content:space-between">
            <span style="font-family:'DM Mono',monospace;font-size:13px;color:rgba(196,151,90,0.7)">−${fmt2(sc.sf)}</span>
            <span style="font-family:'DM Mono',monospace;font-size:13px;color:rgba(255,255,255,0.6)">${fmt2(sc.afterSF)} al inversor</span>
          </div>
        </div>
      </div>`).join('')}
    </div>` });

  // ── CARRY ──────────────────────────────────────────────────────────────────
  const sf1T=V('sf1T'), sf2T=V('sf2T'), sf1P=V('sf1P'), sf2P=V('sf2P');
  slides.push({ id:'carry', html: baseCSS + `
    <div class="inner" style="padding:36px 48px">
      <div class="ps-tag">Alineación de intereses</div>
      <div class="ps-h2">Nuestro modelo de carry</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;flex:1;align-items:start">
        <div>
          <div class="ps-body" style="margin-bottom:20px"><strong style="color:rgba(255,255,255,0.85)">El carry solo se activa si la operación supera los umbrales.</strong> Riverwalk cobra exclusivamente cuando el inversor gana. Es nuestro skin in the game.</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${[
              {lbl:`Hasta ROI ${sf1T}%`, carry:'0%', desc:'100% del beneficio para el inversor', col:'rgba(255,255,255,0.6)', bg:'rgba(255,255,255,0.03)'},
              {lbl:`ROI ${sf1T}% → ${sf2T}%`, carry:`${sf1P}%`, desc:`${100-sf1P}% para el inversor`, col:'rgba(196,151,90,0.85)', bg:'rgba(139,105,20,0.1)'},
              {lbl:`ROI > ${sf2T}%`, carry:`${sf2P}%`, desc:`${100-sf2P}% para el inversor`, col:'rgba(196,151,90,1)', bg:'rgba(139,105,20,0.15)'},
            ].map(({lbl,carry,desc,col,bg})=>`<div style="padding:14px 18px;background:${bg};border:1px solid rgba(196,151,90,0.15)">
              <div style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:${col};margin-bottom:6px">${lbl}</div>
              <div style="font-family:'DM Mono',monospace;font-size:20px;color:#fff">${carry} carry Riverwalk</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:3px">${desc}</div>
            </div>`).join('')}
          </div>
        </div>
        <div>
          <div style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:10px">Escenario base — distribución</div>
          ${[
            {l:'Beneficio bruto', v:fmt2(m.base.grossProfit), col:'rgba(255,255,255,0.75)'},
            {l:'Carry Riverwalk', v:'−'+fmt2(m.base.sf), col:'rgba(196,151,90,0.7)'},
            {l:'Al inversor (pre-tax)', v:fmt2(m.base.afterSF), col:'#52C07A'},
          ].map(({l,v,col})=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span style="font-size:12px;color:rgba(255,255,255,0.45)">${l}</span>
            <span style="font-family:'DM Mono',monospace;font-size:14px;color:${col}">${v}</span>
          </div>`).join('')}
          <div style="margin-top:16px;padding:18px;background:rgba(30,122,69,0.08);border:1px solid rgba(82,192,122,0.2)">
            <div class="ps-data-l">ROI al inversor · escenario base</div>
            <div style="font-family:'DM Mono',monospace;font-size:28px;color:#52C07A;margin-top:6px">${fmtP((m.base.afterSF)/m.totalInvest)}</div>
          </div>
          <div style="margin-top:10px;padding:14px 18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
            <div class="ps-data-l">TIR anual base</div>
            <div style="font-family:'DM Mono',monospace;font-size:20px;color:rgba(196,151,90,0.8);margin-top:4px">${isFinite(m.base.irr)?fmtP(m.base.irr):'—'}</div>
          </div>
        </div>
      </div>
    </div>` });

  // ── TIMELINE ANIMADO ──────────────────────────────────────────────────────
  const tlSteps = [
    {lbl:'Arras',    m:0,                  sub:'Firma contrato',     icon:'◆'},
    {lbl:'Escritura',m:m.arasMonths,       sub:m.arasMonths+'m',     icon:'◆'},
    {lbl:'Inicio obra',m:m.arasMonths+1,   sub:'CapEx',               icon:'◆'},
    {lbl:'Fin obra', m:m.arasMonths+Math.round(m.monthsSale*0.8), sub:'Entrega', icon:'◆'},
    {lbl:'Venta',    m:m.totalMonths,      sub:m.totalMonths+'m total',icon:'◆'},
  ];
  slides.push({ id:'timeline', html: baseCSS + `
    <div class="inner" style="justify-content:center;padding:48px 72px">
      <div class="ps-tag" style="text-align:center">Calendario</div>
      <div class="ps-h2" style="text-align:center;margin-bottom:48px">Temporalidad de la operación · ${m.totalMonths} meses</div>

      <!-- Timeline track -->
      <div style="position:relative;margin:0 40px 60px">
        <div style="height:2px;background:rgba(255,255,255,0.08);position:relative;overflow:hidden">
          <div style="position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,rgba(196,151,90,0.3),rgba(196,151,90,0.8));animation:tl-grow 1.2s ease forwards;animation-delay:0.3s;width:0"></div>
        </div>
        <div style="display:flex;justify-content:space-between;position:relative;margin-top:-6px">
          ${tlSteps.map((s,i)=>`<div style="display:flex;flex-direction:column;align-items:center;animation:tl-pop 0.4s ease forwards;animation-delay:${0.3+i*0.18}s;opacity:0">
            <div style="width:14px;height:14px;background:#C4975A;border-radius:50%;border:2px solid rgba(196,151,90,0.3);box-shadow:0 0 0 4px rgba(196,151,90,0.1)"></div>
            <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(196,151,90,0.8);margin-top:12px;font-weight:600;text-align:center">${s.lbl}</div>
            <div style="font-size:9px;color:rgba(255,255,255,0.35);margin-top:3px;text-align:center">${s.sub}</div>
          </div>`).join('')}
        </div>
      </div>

      <!-- Summary grid -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:700px;margin:0 auto">
        ${[
          ['Período arras', m.arasMonths + ' meses'],
          ['Reforma + venta', m.monthsSale + ' meses'],
          ['Total operación', m.totalMonths + ' meses'],
        ].map(([l,v])=>`<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);padding:20px;text-align:center">
          <div class="ps-data-l" style="margin-bottom:8px">${l}</div>
          <div style="font-family:'DM Mono',monospace;font-size:28px;color:#fff">${v}</div>
        </div>`).join('')}
      </div>
    </div>` });

  // ── PROTECCIÓN CAPITAL ────────────────────────────────────────────────────
  // ── SENSIBILIDAD ──────────────────────────────────────────────────────────
  const beM2      = Math.round(m.bePriceM2);
  const exitBase  = V('exitB');
  const marginPct = exitBase > 0 ? ((exitBase - beM2) / exitBase * 100).toFixed(1) : '—';
  const worstExit = Math.min(V('exitP'), ...(sensPrices || []));
  const worstRoi  = (() => {
    const ep = worstExit; const mo = m.totalMonths + 4;
    const commAdj = V('comunidad')*mo, ibiAdj = V('ibi')*mo/12;
    const totAdj = m.buyPrice+m.itp+m.notaria+commAdj+ibiAdj+m.intermediaryFee+m.brokerBuyFee+m.capexNet+m.totalFeesNet+m.totalIVA;
    const gP = ep*m.surfCapex - ep*m.surfCapex*V('brokerExit')/100 - (V('exitFixed')+V('exitFixedAjuste')) - totAdj;
    return gP/totAdj;
  })();

  // Duration columns: 4 scenarios
  const durCols = [
    { label: `${m.arasMonths + 2}m`, months: m.arasMonths + 2 },
    { label: `${m.totalMonths}m`, months: m.totalMonths },
    { label: `${m.totalMonths + 4}m`, months: m.totalMonths + 4 },
    { label: `${m.totalMonths + 8}m`, months: m.totalMonths + 8 },
  ];
  // Price rows: use configured sensPrices (up to 6)
  const priceCols = (sensPrices && sensPrices.length ? [...sensPrices] : [V('exitP'), V('exitB'), V('exitO')]).slice(0, 6);

  function cellROI(ep, mo) {
    const commAdj = V('comunidad')*mo, ibiAdj = V('ibi')*mo/12;
    const totAdj = m.buyPrice+m.itp+m.notaria+commAdj+ibiAdj+m.intermediaryFee+m.brokerBuyFee+m.capexNet+m.totalFeesNet+m.totalIVA;
    const brkCost = ep*m.surfCapex*V('brokerExit')/100 + (V('exitFixed')+V('exitFixedAjuste'));
    const gP = ep*m.surfCapex - brkCost - totAdj;
    return gP / totAdj;
  }

  function roiColor(roi) {
    if (roi < 0)    return { bg: 'rgba(180,30,30,0.35)',  text: '#E05555', border: 'rgba(224,85,85,0.25)' };
    if (roi < 0.08) return { bg: 'rgba(180,100,20,0.25)', text: 'rgba(255,165,0,0.9)', border: 'rgba(255,165,0,0.2)' };
    if (roi < 0.15) return { bg: 'rgba(139,105,20,0.22)', text: 'rgba(196,151,90,0.95)', border: 'rgba(196,151,90,0.2)' };
    return { bg: 'rgba(20,100,50,0.25)', text: '#52C07A', border: 'rgba(82,192,122,0.2)' };
  }

  const heatRows1 = priceCols.map(ep => {
    const isBase = Math.abs(ep - exitBase) < 200;
    return `<tr>${['<td style="padding:7px 12px;font-family:\'DM Mono\',monospace;font-size:10.5px;color:'+(isBase?'rgba(196,151,90,0.95)':'rgba(255,255,255,0.5)')+';white-space:nowrap;border-right:1px solid rgba(255,255,255,0.06);'+(isBase?'background:rgba(139,105,20,0.08);':'')+'">'+ep.toLocaleString('es-ES')+' €/m²'+(isBase?' ·':'')+'</td>',
      ...durCols.map(({months}) => {
        const roi = cellROI(ep, months);
        const {bg,text,border} = roiColor(roi);
        return `<td style="padding:7px 8px;text-align:center;background:${bg};border:1px solid ${border}"><div style="font-family:'DM Mono',monospace;font-size:12.5px;color:${text};font-weight:500;line-height:1">${(roi*100).toFixed(1)}%</div></td>`;
      })].join('')}</tr>`;
  }).join('');

  // Matrix 2: CapEx variation × price
  const capexAdjs = [-0.20,-0.10,0,+0.10,+0.20,+0.30];
  const capexExits = [V('exitP'),V('exitB'),V('exitO')].filter((v,i,a)=>a.indexOf(v)===i);

  function cellROI2(capexMult, ep) {
    const cn = m.capexNet * capexMult;
    const totalIVAAdj = cn * V('ivaObra')/100;
    const totAdj2 = m.buyPrice+m.itp+m.notaria+V('comunidad')*m.totalMonths+V('ibi')*m.totalMonths/12+m.intermediaryFee+m.brokerBuyFee+cn+m.totalFeesNet+totalIVAAdj;
    const brkCost = ep*m.surfCapex*V('brokerExit')/100 + (V('exitFixed')+V('exitFixedAjuste'));
    return (ep*m.surfCapex - brkCost - totAdj2) / totAdj2;
  }

  const heatRows2 = capexAdjs.map(adj => {
    const isBase = adj === 0;
    const lbl = isBase ? 'CapEx base ·' : `CapEx ${adj>0?'+':''}${(adj*100).toFixed(0)}%`;
    return `<tr>${['<td style="padding:7px 12px;font-family:\'DM Mono\',monospace;font-size:10.5px;color:'+(isBase?'rgba(196,151,90,0.95)':'rgba(255,255,255,0.5)')+';white-space:nowrap;border-right:1px solid rgba(255,255,255,0.06);'+(isBase?'background:rgba(139,105,20,0.08);':'')+'">' + lbl + '</td>',
      ...capexExits.map(ep => {
        const roi = cellROI2(1+adj, ep);
        const {bg,text,border} = roiColor(roi);
        return `<td style="padding:7px 8px;text-align:center;background:${bg};border:1px solid ${border}"><div style="font-family:'DM Mono',monospace;font-size:12.5px;color:${text};font-weight:500;line-height:1">${(roi*100).toFixed(1)}%</div></td>`;
      })].join('')}</tr>`;
  }).join('');

  const matrixLegend = `<div style="display:flex;gap:14px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)">
    ${[['#E05555','< 0% · Pérdidas'],['rgba(255,165,0,0.9)','0–8%'],['rgba(196,151,90,0.9)','8–15%'],['#52C07A','> 15% · Objetivo']].map(([c,l])=>`
    <div style="display:flex;align-items:center;gap:5px">
      <div style="width:8px;height:8px;background:${c};opacity:0.7;border-radius:1px;flex-shrink:0"></div>
      <span style="font-size:8.5px;color:rgba(255,255,255,0.3)">${l}</span>
    </div>`).join('')}
    <div style="margin-left:auto;font-size:8.5px;color:rgba(255,255,255,0.2)">· = escenario base</div>
  </div>`;

  slides.push({ id:'sensibilidad', html: baseCSS + `
    <div class="inner" style="padding:28px 44px;gap:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;flex-shrink:0">
        <div>
          <div class="ps-tag">Protección de capital</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#fff;margin-top:2px">Matrices de sensibilidad</div>
        </div>
        <div style="display:flex;gap:10px">
          <div style="padding:12px 18px;background:rgba(139,105,20,0.12);border:1px solid rgba(196,151,90,0.3);text-align:center;min-width:100px">
            <div style="font-family:'DM Mono',monospace;font-size:18px;color:rgba(196,151,90,0.95);line-height:1;margin-bottom:3px">${beM2.toLocaleString('es-ES')}<span style="font-size:10px"> €/m²</span></div>
            <div style="font-size:7.5px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.3)">Breakeven bruto</div>
          </div>
          <div style="padding:12px 18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);text-align:center;min-width:90px">
            <div style="font-family:'DM Mono',monospace;font-size:18px;color:#52C07A;line-height:1;margin-bottom:3px">${marginPct}<span style="font-size:10px">%</span></div>
            <div style="font-size:7.5px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.3)">Margen s/ base</div>
          </div>
          <div style="padding:12px 18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);text-align:center;min-width:90px">
            <div style="font-family:'DM Mono',monospace;font-size:18px;color:${worstRoi < 0 ? '#E05555' : '#52C07A'};line-height:1;margin-bottom:3px">${(worstRoi*100).toFixed(1)}<span style="font-size:10px">%</span></div>
            <div style="font-size:7.5px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.3)">Peor escenario</div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;flex:1;min-height:0;overflow:hidden">
        <div style="display:flex;flex-direction:column;min-height:0">
          <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:8px">ROI · Precio de salida × Duración</div>
          <div style="overflow:auto;flex:1">
            <table style="width:100%;border-collapse:separate;border-spacing:2px">
              <thead><tr>
                <th style="padding:5px 12px;text-align:left;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.25);font-weight:400;border-bottom:1px solid rgba(255,255,255,0.08)">€/m²</th>
                ${durCols.map(({label,months})=>`<th style="padding:5px 8px;text-align:center;font-family:'DM Mono',monospace;font-size:10px;color:${months===m.totalMonths?'rgba(196,151,90,0.8)':'rgba(255,255,255,0.35)'};font-weight:400;border-bottom:1px solid rgba(255,255,255,0.08)">${label}</th>`).join('')}
              </tr></thead>
              <tbody>${heatRows1}</tbody>
            </table>
          </div>
          ${matrixLegend}
        </div>
        <div style="display:flex;flex-direction:column;min-height:0">
          <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:8px">ROI · Variación CapEx × Precio salida</div>
          <div style="overflow:auto;flex:1">
            <table style="width:100%;border-collapse:separate;border-spacing:2px">
              <thead><tr>
                <th style="padding:5px 12px;text-align:left;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.25);font-weight:400;border-bottom:1px solid rgba(255,255,255,0.08)">CapEx</th>
                ${capexExits.map(ep=>`<th style="padding:5px 8px;text-align:center;font-family:'DM Mono',monospace;font-size:10px;color:${Math.abs(ep-exitBase)<200?'rgba(196,151,90,0.8)':'rgba(255,255,255,0.35)'};font-weight:400;border-bottom:1px solid rgba(255,255,255,0.08)">${ep.toLocaleString('es-ES')} €/m²</th>`).join('')}
              </tr></thead>
              <tbody>${heatRows2}</tbody>
            </table>
          </div>
          ${matrixLegend}
        </div>
      </div>
    </div>` });

  // ── HIGHLIGHTS ────────────────────────────────────────────────────────────
  const est = d.estructura || {};
  const VEHICULO_LABELS_H = { spv_unica:'SPV · Única operación', spv_multi:'SPV · Multi-activo', club_deal:'Club Deal' };
  const VEHICULO_DESC_H   = {
    spv_unica: 'Sociedad de propósito específico constituida exclusivamente para esta operación. Separación total de riesgo patrimonial y liquidación automática al cierre de la venta.',
    spv_multi: 'Vehículo permanente que opera sobre múltiples activos. Permite diversificación y acceso a operaciones futuras dentro del mismo vehículo.',
    club_deal:  'Grupo cerrado de inversores privados seleccionados. Estructura ágil sin vehículo societario formal, regida por pacto entre partes.'
  };
  const APORTACION_LABELS_H = { pp:'Préstamo participativo', cp:'Cuenta en participación', ac:'Ampliación de capital', ph:'Préstamo c/ garantía hipotecaria' };
  const APORTACION_DESC_H   = {
    pp: 'El inversor presta capital y recibe interés fijo más participación variable en el beneficio. Sin transmisión de propiedad ni acceso a la gestión operativa.',
    cp: 'El inversor cede capital a Riverwalk como gestor. Comparte riesgo y beneficio en proporción a su aportación, sin que se constituya una entidad jurídica separada.',
    ac: 'El inversor entra como socio de la sociedad, con los derechos societarios correspondientes. Participación directa en el capital social del vehículo.',
    ph: 'Retorno fijo garantizado con el activo inmobiliario como colateral. Sin participación en el upside. Perfil de riesgo más conservador.'
  };
  const ticketMin_h = est.ticketMinimo ? parseInt(est.ticketMinimo).toLocaleString('es-ES') + ' €' : '—';
  const vehiculoLabel_h = est.vehiculo ? VEHICULO_LABELS_H[est.vehiculo] : null;
  const vehiculoDesc_h  = est.vehiculo ? VEHICULO_DESC_H[est.vehiculo] : null;
  const aportLabel_h    = est.aportacion ? APORTACION_LABELS_H[est.aportacion] : null;
  const aportDesc_h     = est.aportacion ? APORTACION_DESC_H[est.aportacion] : null;

  slides.push({ id:'highlights', html: baseCSS + `
    <div class="inner" style="padding:36px 48px">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:6px">
        <svg viewBox="0 0 140 20" style="width:90px"><text x="0" y="16" font-family="Cormorant Garamond,serif" font-size="16" fill="rgba(196,151,90,0.6)" font-weight="300" letter-spacing="2">Riverwalk</text></svg>
        <div style="width:1px;height:18px;background:rgba(255,255,255,0.1)"></div>
        <div class="ps-tag" style="margin:0">Highlights de la inversión</div>
      </div>
      <div style="width:36px;height:1px;background:rgba(196,151,90,0.4);margin-bottom:20px"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;flex:1;align-items:start">
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            ${[
              ['Inversión total', fmt2(m.totalInvest), 'rgba(196,151,90,0.9)'],
              ['Ticket mínimo', ticketMin_h, 'rgba(255,255,255,0.8)'],
              ['ROI bruto base', fmtP(m.base.roiGross), '#52C07A'],
              ['TIR anual base', isFinite(m.base.irr)?fmtP(m.base.irr):'—', '#52C07A'],
              ['Plazo estimado', m.totalMonths + ' meses', 'rgba(255,255,255,0.8)'],
              ['Breakeven', beM2.toLocaleString('es-ES') + ' €/m²', 'rgba(255,255,255,0.7)'],
            ].map(([l,v,c])=>`<div style="padding:12px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07)">
              <div style="font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:4px">${l}</div>
              <div style="font-family:'DM Mono',monospace;font-size:14px;color:${c};font-feature-settings:'tnum' 1">${v}</div>
            </div>`).join('')}
          </div>
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07)">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border-bottom:1px solid rgba(255,255,255,0.06)">
              ${['Escenario','€/m²','ROI bruto','TIR anual'].map(h=>`<div style="padding:6px 10px;font-size:8px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.3)">${h}</div>`).join('')}
            </div>
            ${[
              {lbl:'Pesimista', ep:V('exitP'), sc:m.pess, col:'#E05555'},
              {lbl:'Base',      ep:V('exitB'), sc:m.base, col:'rgba(196,151,90,0.95)'},
              {lbl:'Optimista', ep:V('exitO'), sc:m.opt,  col:'#52C07A'},
            ].map(({lbl,ep,sc,col})=>`<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border-bottom:1px solid rgba(255,255,255,0.04)">
              <div style="padding:7px 10px;font-size:10px;color:${col}">${lbl}</div>
              <div style="padding:7px 10px;font-family:'DM Mono',monospace;font-size:10px;color:rgba(255,255,255,0.7)">${ep.toLocaleString('es-ES')}</div>
              <div style="padding:7px 10px;font-family:'DM Mono',monospace;font-size:10px;color:${col}">${fmtP(sc.roiGross)}</div>
              <div style="padding:7px 10px;font-family:'DM Mono',monospace;font-size:10px;color:${col}">${isFinite(sc.irr)?fmtP(sc.irr):'—'}</div>
            </div>`).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px">
          ${vehiculoLabel_h ? `<div style="padding:14px 18px;background:rgba(139,105,20,0.08);border:1px solid rgba(196,151,90,0.25)">
            <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(196,151,90,0.6);margin-bottom:6px">Vehículo de inversión</div>
            <div style="font-size:13px;color:#fff;font-weight:500;margin-bottom:6px">${vehiculoLabel_h}</div>
            <div style="font-size:10.5px;color:rgba(255,255,255,0.5);line-height:1.7">${vehiculoDesc_h}</div>
          </div>` : ''}
          ${aportLabel_h ? `<div style="padding:14px 18px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1)">
            <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:6px">Forma de aportación</div>
            <div style="font-size:13px;color:#fff;font-weight:500;margin-bottom:6px">${aportLabel_h}</div>
            <div style="font-size:10.5px;color:rgba(255,255,255,0.5);line-height:1.7">${aportDesc_h}</div>
          </div>` : ''}
          <div style="padding:14px 18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07)">
            <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:10px">Estructura de fees Riverwalk</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.05)">
                <span style="font-size:10.5px;color:rgba(255,255,255,0.45)">Management fee</span>
                <span style="font-family:'DM Mono',monospace;font-size:12px;color:rgba(255,255,255,0.7)">${V('mgmtFeePct')}% s/ precio + CapEx</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.05)">
                <span style="font-size:10.5px;color:rgba(255,255,255,0.45)">Carry ROI &lt; ${sf1T}%</span>
                <span style="font-family:'DM Mono',monospace;font-size:12px;color:rgba(82,192,122,0.8)">0% · íntegro al inversor</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.05)">
                <span style="font-size:10.5px;color:rgba(255,255,255,0.45)">Carry ROI ${sf1T}–${sf2T}%</span>
                <span style="font-family:'DM Mono',monospace;font-size:12px;color:rgba(196,151,90,0.8)">${sf1P}% Riverwalk · ${100-sf1P}% inversor</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:10.5px;color:rgba(255,255,255,0.45)">Carry ROI &gt; ${sf2T}%</span>
                <span style="font-family:'DM Mono',monospace;font-size:12px;color:rgba(196,151,90,0.9)">${sf2P}% Riverwalk · ${100-sf2P}% inversor</span>
              </div>
            </div>
          </div>
          <div style="font-size:9px;color:rgba(255,255,255,0.2);line-height:1.6;padding-top:4px">Documento de carácter informativo. Las rentabilidades proyectadas no garantizan resultados futuros.</div>
        </div>
      </div>
    </div>` });

  return slides;
}

// ══════════════════════════════════════════════════
// AI TERMINAL
// ══════════════════════════════════════════════════
let aiHistory = [];
let aiGenerating = false;

function openAITerminal() {
  const el = $('ai-terminal');
  if (!el) return;
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  $('ai-input')?.focus();
  if (!aiHistory.length) {
    addAIMessage('assistant', 'Hola. Soy tu asistente de narrativa para el dossier Riverwalk. Puedo generar textos para cada sección o refinar lo que ya tienes. Usa los botones de arriba para generación rápida, o escríbeme directamente.');
  }
}

function closeAITerminal() {
  const el = $('ai-terminal');
  if (el) el.style.display = 'none';
}

function addAIMessage(role, text, showInsertBtns = false) {
  const el = $('ai-messages');
  if (!el) return;
  const div = document.createElement('div');
  div.className = role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant';
  div.innerHTML = text.replace(/\n/g, '<br>');
  if (showInsertBtns && role === 'assistant') {
    const btnsDiv = document.createElement('div');
    btnsDiv.className = 'ai-insert';
    const sections = [{id:'activo',lbl:'→ Activo'},{id:'zona',lbl:'→ Zona'},{id:'mercado',lbl:'→ Mercado'},{id:'proyecto',lbl:'→ Proyecto'},{id:'tesis',lbl:'→ Tesis'}];
    sections.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'ai-insert-btn';
      btn.textContent = s.lbl;
      btn.onclick = () => {
        const field = $('narr-' + s.id);
        if (field) { field.value = div.innerText.replace(/→.*$/m,'').trim(); saveDossierNarrative(); }
        btn.textContent = '✓ Insertado';
        setTimeout(() => btn.textContent = s.lbl, 2000);
      };
      btnsDiv.appendChild(btn);
    });
    div.appendChild(btnsDiv);
  }
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function buildDealContext() {
  const m = calc();
  const mz = $('microzona')?.value || '';
  return `DEAL CONTEXT:
Activo: ${S('dealName')} — ${S('dealAddress')}, ${S('dealCP')} ${S('dealMunicipio')}
Microzona: ${mz} (Tier: ${MICROZONE_DATA.find(z=>z.z===mz)?.tier||'—'})
Superficie: ${m.surfCapex} m²
Precio compra: ${m.buyPrice.toLocaleString('es-ES')} € (${Math.round(m.buyPrice/m.surfCapex).toLocaleString('es-ES')} €/m²)
CapEx obra: ${V('obraM2')} €/m² · Decoración: ${V('decoM2')} €/m² · IVA: ${V('ivaObra')}%
CapEx total: ${m.capexNet.toLocaleString('es-ES')} € neto
Inversión total: ${m.totalInvest.toLocaleString('es-ES')} €
Precio salida base: ${V('exitB').toLocaleString('es-ES')} €/m² → ${(V('exitB')*m.surfCapex).toLocaleString('es-ES')} €
ROI bruto base: ${(m.base.roiGross*100).toFixed(1)}% · TIR: ${isFinite(m.base.irr)?(m.base.irr*100).toFixed(1)+'%':'—'}
Duración total: ${m.totalMonths} meses
Management fee: ${V('mgmtFeePct')}% · Carry tramos: 0% / ${V('sf1P')}% / ${V('sf2P')}% sobre umbrales ROI ${V('sf1T')}% / ${V('sf2T')}%
Comparables reformados (${comps.filter(c=>c.tipo==='reformado').length}): media ${Math.round(comps.filter(c=>c.precio>0&&c.m2>0&&c.tipo==='reformado').reduce((s,c)=>s+c.precio/c.m2,0)/Math.max(1,comps.filter(c=>c.tipo==='reformado').length))} €/m²
Comparables a reformar (${comps.filter(c=>c.tipo==='reformar').length}): media ${Math.round(comps.filter(c=>c.precio>0&&c.m2>0&&c.tipo==='reformar').reduce((s,c)=>s+c.precio/c.m2,0)/Math.max(1,comps.filter(c=>c.tipo==='reformar').length))} €/m²`;
}

const NARR_PROMPTS = {
  activo: 'Escribe una descripción del activo inmobiliario para un dossier de inversión (2-3 frases, tono profesional y atractivo, menciona lo más relevante del inmueble).',
  zona:   'Escribe un párrafo sobre el contexto de la microzona para inversores (evolución del mercado, demanda, por qué es una zona de interés).',
  mercado:'Escribe un análisis de la oportunidad de mercado (por qué el precio de adquisición es atractivo, contexto vs. precio de mercado para activos a reformar).',
  proyecto:'Escribe la tesis del proyecto de reforma (calidades premium, diferenciación, por qué esta reforma generará un activo líquido con demanda).',
  tesis:  'Escribe la tesis de inversión de cierre (resumen ejecutivo del por qué es una buena oportunidad, qué aporta Riverwalk, el retorno esperado).',
};

async function generateNarrative(section) {
  if (!checkAPIKey()) return;

  const field = $('narr-' + section);
  // Find the ✦ Generar button for this section
  const btn = field?.closest('.field')?.querySelector('button[onclick*="generateNarrative"]');

  const origBtnText = btn?.textContent || '✦ Generar';
  if (btn) { btn.textContent = '⟳'; btn.disabled = true; btn.style.opacity = '0.5'; }
  if (field) { field.style.opacity = '0.4'; }

  const prompt = NARR_PROMPTS[section] || 'Genera texto para esta sección del dossier.';
  const ctx = buildDealContext();
  const fullPrompt = `Eres el equipo de comunicación de Riverwalk Real Estate Investments, una firma de inversión inmobiliaria de alta gama en Madrid. Escribes con tono profesional, discreto y sofisticado — sin exageraciones ni superlativos vacíos.\n\n${ctx}\n\n${prompt}\n\nEscribe directamente el texto, sin preámbulo ni explicación. Máximo 120 palabras.`;

  try {
    const res = await fetch('/api/anthropic', {
      method: 'POST',
      headers: getAPIHeaders(),
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{ role: 'user', content: fullPrompt }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `Error ${res.status}`;
      if (res.status === 401) alert('API Key incorrecta o inválida. Revísala en la barra superior.');
      else alert(`Error al generar: ${msg}`);
      return;
    }

    const data = await res.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';

    if (field && text) {
      field.value = text;
      field.style.opacity = '1';
      // Brief green flash to confirm
      field.style.borderColor = 'rgba(82,192,122,0.6)';
      setTimeout(() => { field.style.borderColor = ''; }, 1200);
      saveDossierNarrative();
    }
  } catch(e) {
    alert('No se pudo conectar con la API de Anthropic. Verifica tu conexión a internet y que la API Key esté introducida.');
    console.error('generateNarrative error:', e);
  } finally {
    if (btn) { btn.textContent = origBtnText; btn.disabled = false; btn.style.opacity = ''; }
    if (field) field.style.opacity = '1';
  }
}

async function aiQuickGen(section) {
  if (section === 'todo') {
    for (const s of ['activo','zona','mercado','proyecto','tesis']) await generateNarrative(s);
    return;
  }
  await generateNarrative(section);
}

async function sendAIMessage() {
  if (aiGenerating) return;
  if (!checkAPIKey()) return;
  const inp = $('ai-input');
  const text = inp?.value?.trim();
  if (!text) return;
  inp.value = '';
  aiGenerating = true;
  addAIMessage('user', text);
  aiHistory.push({role:'user', content:text});
  const ctx = buildDealContext();
  const systemCtx = `Eres el asistente de narrativa de Riverwalk Real Estate Investments. Ayudas a generar y refinar textos para dossiers de inversión inmobiliaria en Madrid. Tono profesional, discreto, sofisticado, evita clichés.

${ctx}`;

  const messagesEl = $('ai-messages');
  const loadDiv = document.createElement('div');
  loadDiv.className = 'ai-msg-assistant';
  loadDiv.innerHTML = '<span style="opacity:0.4">⟳ Generando…</span>';
  if (messagesEl) { messagesEl.appendChild(loadDiv); messagesEl.scrollTop = messagesEl.scrollHeight; }

  try {
    // Inject system as first message in history (Anthropic best practice for direct browser calls)
    const msgs2 = [];
    if (aiHistory.length > 0) {
      msgs2.push({ role: 'user', content: systemCtx + ' Responde siempre en espanol.' });
      msgs2.push({ role: 'assistant', content: 'Listo, te ayudo con el dossier de Riverwalk.' });
      aiHistory.slice(-6).forEach(function(m) { msgs2.push(m); });
    } else {
      msgs2.push({ role: 'user', content: systemCtx + ' Mi primera consulta: ' + text });
    }

    var res2 = await fetch('/api/anthropic', {
      method: 'POST',
      headers: getAPIHeaders(),
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 600, messages: msgs2 })
    });

    if (!res2.ok) {
      var errData = {};
      try { errData = await res2.json(); } catch(ex) {}
      var errMsg = (errData.error && errData.error.message) ? errData.error.message : ('HTTP ' + res2.status);
      throw new Error(errMsg);
    }

    var data2 = await res2.json();
    var textBlocks = data2.content ? data2.content.filter(function(b){ return b.type === 'text'; }) : [];
    var reply = textBlocks.length > 0 ? textBlocks[0].text : 'Sin respuesta.';
    loadDiv.remove();
    addAIMessage('assistant', reply, true);
    aiHistory.push({ role: 'assistant', content: reply });
  } catch(e) {
    loadDiv.innerHTML = `<span style="color:#E05555">⚠ Error: ${e.message}</span><br><span style="font-size:10px;opacity:0.5">Verifica que la API Key es correcta y empieza por sk-ant-</span>`;
  } finally { aiGenerating = false; }
}

// Extend saveDealSnapshot and applyDeal to include dossier
// dossier hooks integrated into captureCurrentDeal and applyDeal below
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// INTELLIGENCE PLATFORM
// ══════════════════════════════════════════════════

const LS_DNA   = 'rw_deal_dna';
const LS_BENCH = 'rw_benchmarks';
const LS_INV   = 'rw_investors';

function lsGet(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

let intelActiveTab = 'dna';
const INTEL_TABS = [
  { id:'dna',       label:'Deal DNA' },
  { id:'benchmark', label:'Prime Benchmark' },
  { id:'investors', label:'Inversores' },
];

function openIntelligence() {
  const el = document.getElementById('intel-overlay');
  if (!el) return;
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  renderIntelTabs();
  renderIntelContent(intelActiveTab);
}

function closeIntelligence() {
  const el = document.getElementById('intel-overlay');
  if (el) el.style.display = 'none';
}

function renderIntelTabs() {
  const el = document.getElementById('intel-tabs');
  if (!el) return;
  el.innerHTML = INTEL_TABS.map(t =>
    `<button class="intel-tab${t.id===intelActiveTab?' active':''}" onclick="switchIntelTab('${t.id}')">${t.label}</button>`
  ).join('');
}

function switchIntelTab(tab) {
  intelActiveTab = tab;
  renderIntelTabs();
  renderIntelContent(tab);
}

function renderIntelContent(tab) {
  const el = document.getElementById('intel-content');
  if (!el) return;
  if (tab === 'dna')       el.innerHTML = buildDNAView();
  if (tab === 'benchmark') el.innerHTML = buildBenchmarkView();
  if (tab === 'investors') el.innerHTML = buildInvestorsView();
}

// ── DEAL DNA ────────────────────────────────────────────────────────────────
function buildDNAView() {
  const db = lsGet(LS_DNA);
  const fmt2 = v => (v||0).toLocaleString('es-ES',{maximumFractionDigits:0}) + ' €';
  const fmtP = v => ((v||0)*100).toFixed(1) + '%';
  const devStr = v => {
    if (v == null) return '<span style="color:rgba(255,255,255,0.3)">—</span>';
    const s = v > 0 ? '+' : '';
    const col = v > 0.05 ? '#E05555' : v < -0.05 ? '#52C07A' : 'rgba(255,255,255,0.4)';
    return `<span style="color:${col};font-family:'DM Mono',monospace">${s}${(v*100).toFixed(1)}%</span>`;
  };
  const closed = db.filter(d => d.actual);
  const avg = (arr, fn) => arr.length ? arr.reduce((s,d) => s+(fn(d)||0), 0)/arr.length : null;
  const avgCapex  = avg(closed, d => d.dev?.capex_dev);
  const avgMonths = avg(closed, d => d.dev?.months_dev);
  const avgRoi    = avg(closed, d => d.dev?.roi_dev);
  const m = (() => { try { return calc(); } catch { return null; } })();

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div>
        <div style="font-size:22px;font-family:'Cormorant Garamond',serif;color:#fff;margin-bottom:4px">Deal DNA</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.35)">${db.length} operaciones · la herramienta aprende de cada deal cerrado</div>
      </div>
      <button class="intel-btn gold" onclick="showArchiveForm()">+ Archivar deal activo</button>
    </div>

    ${closed.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
      ${[
        {v:db.length+'', l:'Deals archivados', col:'#fff'},
        {v:avgCapex!=null?(avgCapex>=0?'+':'')+( avgCapex*100).toFixed(1)+'%':'—', l:'Desviación CapEx (media)', col:avgCapex>0.05?'#E05555':avgCapex<-0.05?'#52C07A':'#fff'},
        {v:avgMonths!=null?(avgMonths>=0?'+':'')+( avgMonths*100).toFixed(1)+'%':'—', l:'Desviación plazos (media)', col:avgMonths>0.1?'#E05555':'#fff'},
        {v:avgRoi!=null?(avgRoi>=0?'+':'')+( avgRoi*100).toFixed(1)+'pp':'—', l:'ROI real vs proyectado', col:avgRoi>0?'#52C07A':avgRoi<0?'#E05555':'#fff'},
      ].map(k=>`<div class="intel-kpi"><div class="intel-kpi-val" style="color:${k.col}">${k.v}</div><div class="intel-kpi-lbl">${k.l}</div></div>`).join('')}
    </div>` : ''}

    ${db.length > 0 ? `<div class="intel-card" style="margin-bottom:16px;overflow-x:auto">
      <div class="intel-h" style="color:rgba(196,151,90,0.8)">Histórico</div>
      <table class="intel-table">
        <thead><tr><th>Activo</th><th>Microzona</th><th>Inversión</th><th>ROI proy.</th><th>ROI real</th><th>Δ ROI</th><th>Δ CapEx</th><th>Δ Plazos</th><th></th></tr></thead>
        <tbody>${db.map((d,i) => `<tr>
          <td style="color:#fff;font-weight:500">${d.name}</td>
          <td style="color:rgba(255,255,255,0.45)">${d.microzona||'—'}</td>
          <td style="font-family:'DM Mono',monospace">${fmt2(d.proj?.totalInvest)}</td>
          <td style="font-family:'DM Mono',monospace">${fmtP(d.proj?.roiGross)}</td>
          <td style="font-family:'DM Mono',monospace">${d.actual?.roiReal!=null?fmtP(d.actual.roiReal):'—'}</td>
          <td>${devStr(d.dev?.roi_dev)}</td>
          <td>${devStr(d.dev?.capex_dev)}</td>
          <td>${devStr(d.dev?.months_dev)}</td>
          <td><button onclick="deleteDNADeal(${i})" style="background:none;border:none;color:rgba(224,85,85,0.45);font-size:13px;cursor:pointer;padding:0 4px">×</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : `<div class="intel-card purple" style="text-align:center;padding:48px;margin-bottom:16px">
      <div style="font-size:11px;color:rgba(255,255,255,0.25);line-height:1.9">Aún no hay deals archivados.<br>Cada operación cerrada alimenta la base de conocimiento.<br>Con el tiempo la herramienta aprenderá tus patrones reales.</div>
    </div>`}

    <div id="dna-archive-form" style="display:none" class="intel-card gold">
      <div class="intel-h" style="color:rgba(196,151,90,0.8)">Actuals del deal activo</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        ${[
          ['dna-sale-real',   'Precio venta real (€)', m?Math.round(m.base.saleGross):'', 'number'],
          ['dna-capex-real',  'CapEx real total (€)',  m?Math.round(m.capexNet):'', 'number'],
          ['dna-months-real', 'Meses reales hasta venta', m?m.totalMonths:'', 'number'],
          ['dna-date-close',  'Fecha cierre', new Date().toISOString().slice(0,10), 'date'],
        ].map(([id,lbl,ph,type]) => `<div>
          <label style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);display:block;margin-bottom:5px">${lbl}</label>
          <input class="intel-input" id="${id}" type="${type}" placeholder="${ph}" ${type==='date'?'value="'+ph+'"':''}>
        </div>`).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button class="intel-btn gold" onclick="saveDNADeal()">Guardar en Deal DNA</button>
        <button onclick="document.getElementById('dna-archive-form').style.display='none'" style="background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.35);padding:7px 16px;cursor:pointer;font-size:9px;letter-spacing:0.12em;text-transform:uppercase">Cancelar</button>
      </div>
    </div>`;
}

function showArchiveForm() {
  const el = document.getElementById('dna-archive-form');
  if (el) { el.style.display = 'block'; el.scrollIntoView({behavior:'smooth'}); }
}

function saveDNADeal() {
  const m = (() => { try { return calc(); } catch { return null; } })();
  if (!m) return;
  const saleReal   = parseFloat(document.getElementById('dna-sale-real')?.value) || m.base.saleGross;
  const capexReal  = parseFloat(document.getElementById('dna-capex-real')?.value) || m.capexNet;
  const monthsReal = parseFloat(document.getElementById('dna-months-real')?.value) || m.totalMonths;
  const roiReal    = (saleReal - m.totalInvest - saleReal * (V('brokerExit')/100)) / m.totalInvest;
  const db = lsGet(LS_DNA);
  db.push({
    id: Date.now(),
    name: S('dealName') || 'Sin nombre',
    address: S('dealAddress') || '',
    microzona: document.getElementById('microzona')?.value || '',
    date_archived: new Date().toISOString().slice(0,10),
    proj: { totalInvest:m.totalInvest, buyPrice:m.buyPrice, capexNet:m.capexNet, roiGross:m.base.roiGross, irrBase:m.base.irr, months:m.totalMonths, surfCapex:m.surfCapex },
    actual: { saleReal, capexReal, monthsReal, roiReal, dateClose: document.getElementById('dna-date-close')?.value || '' },
    dev: { roi_dev: roiReal - m.base.roiGross, capex_dev: m.capexNet > 0 ? (capexReal-m.capexNet)/m.capexNet : 0, months_dev: m.totalMonths > 0 ? (monthsReal-m.totalMonths)/m.totalMonths : 0 },
  });
  lsSet(LS_DNA, db);
  document.getElementById('dna-archive-form').style.display = 'none';
  renderIntelContent('dna');
}

function deleteDNADeal(i) {
  if (!confirm('¿Eliminar este deal del historial?')) return;
  const db = lsGet(LS_DNA); db.splice(i, 1); lsSet(LS_DNA, db); renderIntelContent('dna');
}

// ── PRIME BENCHMARK ──────────────────────────────────────────────────────────
let benchFetching = false;

function buildBenchmarkView() {
  const stored = lsGet(LS_BENCH);
  const last = stored.length ? stored[stored.length-1] : null;
  const m = (() => { try { return calc(); } catch { return null; } })();
  const dealPm2 = m && m.surfCapex > 0 ? Math.round(m.base.saleGross / m.surfCapex) : 0;
  const mz = document.getElementById('microzona')?.value || 'Madrid prime';

  const pctVs = (a, b) => b && a ? ((a/b-1)*100).toFixed(0) + '%' : '—';

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div>
        <div style="font-size:22px;font-family:'Cormorant Garamond',serif;color:#fff;margin-bottom:4px">Prime Benchmark</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.35)">Madrid · Miami Beach · Londres prime · ${last ? 'actualizado ' + last.date : 'sin datos — pulsa actualizar'}</div>
      </div>
      <button class="intel-btn" onclick="fetchBenchmarks()" id="bench-btn">${benchFetching ? '⟳ Consultando…' : '⬡ Actualizar benchmarks'}</button>
    </div>

    ${dealPm2 > 0 ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,0.06);margin-bottom:16px">
      ${[
        {lbl:'Este activo · '+mz, val:dealPm2.toLocaleString('es-ES')+' €/m²', sub:'escenario base', col:'rgba(160,100,240,0.9)'},
        {lbl:'Miami Beach prime', val:last?.miami ? last.miami.toLocaleString('es-ES')+' €/m²' : '—', sub: last?.miami ? pctVs(dealPm2,last.miami)+' vs Miami' : 'pulsa actualizar', col:'rgba(196,151,90,0.85)'},
        {lbl:'Londres prime', val:last?.london ? last.london.toLocaleString('es-ES')+' €/m²' : '—', sub: last?.london ? pctVs(dealPm2,last.london)+' vs Londres' : 'pulsa actualizar', col:'rgba(82,192,122,0.85)'},
      ].map(k=>`<div style="background:#0a0b0f;padding:22px;text-align:center">
        <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:${k.col};opacity:0.75;margin-bottom:8px">${k.lbl}</div>
        <div style="font-family:'DM Mono',monospace;font-size:26px;color:${k.col};font-feature-settings:'tnum' 1">${k.val}</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:5px">${k.sub}</div>
      </div>`).join('')}
    </div>` : ''}

    <div class="intel-card" style="margin-bottom:14px;min-height:72px;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.85">
      ${last?.narrative || '<span style="color:rgba(255,255,255,0.2);font-style:italic">El análisis comparativo aparece aquí tras pulsar "Actualizar benchmarks" — requiere API Key y conexión a internet.</span>'}
    </div>

    ${last ? `<div style="font-size:10px;color:rgba(255,255,255,0.25);margin-bottom:16px">Fuentes: ${last.sources||'web search'} · €/$ ${last.usdEur||'—'} · €/£ ${last.gbpEur||'—'} · BCE ${last.ecbRate||'—'}%</div>` : ''}

    ${stored.length > 1 ? `<div class="intel-card">
      <div class="intel-h" style="color:rgba(255,255,255,0.35)">Histórico de snapshots</div>
      <table class="intel-table">
        <thead><tr><th>Fecha</th><th>Miami Beach</th><th>Londres prime</th><th>BCE</th></tr></thead>
        <tbody>${stored.slice(-5).reverse().map(s => `<tr>
          <td>${s.date}</td>
          <td style="font-family:'DM Mono',monospace">${s.miami ? s.miami.toLocaleString('es-ES')+' €/m²' : '—'}</td>
          <td style="font-family:'DM Mono',monospace">${s.london ? s.london.toLocaleString('es-ES')+' €/m²' : '—'}</td>
          <td style="font-family:'DM Mono',monospace">${s.ecbRate ? s.ecbRate+'%' : '—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}`;
}

async function fetchBenchmarks() {
  if (benchFetching || !checkAPIKey()) return;
  benchFetching = true;
  const btn = document.getElementById('bench-btn');
  if (btn) btn.textContent = '⟳ Consultando mercados…';
  const m = (() => { try { return calc(); } catch { return null; } })();
  const mz = document.getElementById('microzona')?.value || 'Madrid prime';
  const dealPm2 = m && m.surfCapex > 0 ? Math.round(m.base.saleGross / m.surfCapex) : 0;

  const prompt = `Eres analista de mercado inmobiliario prime. Busca datos actualizados de precios en los siguientes mercados y responde SOLO con JSON, sin texto adicional:

{
  "miami": precio medio €/m² luxury condos Miami Beach (Brickell, South Beach, Edgewater) — convierte $/sqft al tipo actual,
  "london": precio medio €/m² prime residential Londres (Mayfair, Knightsbridge, South Kensington) — convierte £/sqft al tipo actual,
  "madrid_ref": precio medio €/m² referencia Madrid prime (Recoletos, Jerónimos, Almagro) según datos recientes,
  "ecbRate": tipo BCE actual como string "X.XX",
  "usdEur": tipo €/$ actual como número,
  "gbpEur": tipo €/£ actual como número,
  "narrative": párrafo 3-4 frases en español tono Savills/Knight Frank contextualizando Madrid prime (${mz}) vs Miami y Londres, mencionando arbitraje de precio para inversor internacional${dealPm2 ? ' — el activo en análisis está a ' + dealPm2.toLocaleString('es-ES') + ' €/m²' : ''},
  "sources": "fuentes usadas"
}`;

  try {
    const res = await fetch('/api/anthropic', {
      method: 'POST', headers: getAPIHeaders(),
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 900,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const db = lsGet(LS_BENCH);
      db.push({ date: new Date().toLocaleDateString('es-ES'), ...parsed, fetched: new Date().toISOString() });
      lsSet(LS_BENCH, db);
    }
  } catch(e) {
    const errEl = document.getElementById('bench-narrative');
    if (errEl) errEl.innerHTML = `<span style="color:#E05555">⚠ Error: ${e.message}</span><br><span style="font-size:10px;opacity:0.5">Verifica la API Key y la conexión a internet.</span>`;
  } finally { benchFetching = false; renderIntelContent('benchmark'); }
}

// ── INVESTORS ────────────────────────────────────────────────────────────────
function buildInvestorsView() {
  const investors = lsGet(LS_INV);
  const m = (() => { try { return calc(); } catch { return null; } })();
  const matches = m ? investors.filter(inv =>
    (!inv.ticket_min || m.totalInvest >= inv.ticket_min) &&
    (!inv.ticket_max || m.totalInvest <= inv.ticket_max) &&
    (!inv.roi_min    || m.base.roiGross >= inv.roi_min/100) &&
    (!inv.plazo_max  || m.totalMonths <= inv.plazo_max)
  ) : [];

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div>
        <div style="font-size:22px;font-family:'Cormorant Garamond',serif;color:#fff;margin-bottom:4px">Inversores</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.35)">${investors.length} perfiles · ${matches.length} encajan con el deal activo</div>
      </div>
      <button class="intel-btn" onclick="showAddInvestor()">+ Nuevo perfil</button>
    </div>

    ${matches.length > 0 && m ? `<div class="intel-card purple" style="margin-bottom:16px">
      <div class="intel-h" style="color:rgba(160,100,240,0.8)">Encajan con este deal · ${m.totalInvest.toLocaleString('es-ES')} € · ROI ${(m.base.roiGross*100).toFixed(1)}% · ${m.totalMonths}m</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${matches.map(inv => `<div style="background:rgba(120,60,200,0.1);border:1px solid rgba(160,100,240,0.25);padding:10px 16px;display:flex;align-items:center;gap:14px">
          <div>
            <div style="font-size:13px;font-weight:500;color:#fff">${inv.name}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.4)">${inv.tipo||''}</div>
          </div>
          <button onclick="generateInvestorEmail('${inv.name}')" class="intel-btn" style="font-size:8px;padding:5px 12px">✉ Email</button>
        </div>`).join('')}
      </div>
    </div>` : ''}

    ${investors.length > 0 ? `<div class="intel-card" style="margin-bottom:16px;overflow-x:auto">
      <table class="intel-table">
        <thead><tr><th>Nombre</th><th>Tipo</th><th>Ticket</th><th>ROI mín</th><th>Plazo máx</th><th>Notas</th><th></th></tr></thead>
        <tbody>${investors.map((inv,i) => `<tr>
          <td style="color:#fff;font-weight:500">${inv.name}</td>
          <td style="color:rgba(255,255,255,0.45)">${inv.tipo||'—'}</td>
          <td style="font-family:'DM Mono',monospace;font-size:10.5px">${inv.ticket_min?inv.ticket_min.toLocaleString('es-ES')+'€':'—'}${inv.ticket_max?' – '+inv.ticket_max.toLocaleString('es-ES')+'€':''}</td>
          <td style="font-family:'DM Mono',monospace">${inv.roi_min?inv.roi_min+'%':'—'}</td>
          <td style="font-family:'DM Mono',monospace">${inv.plazo_max?inv.plazo_max+'m':'—'}</td>
          <td style="font-size:10px;color:rgba(255,255,255,0.4);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inv.notas||'—'}</td>
          <td><button onclick="deleteInvestor(${i})" style="background:none;border:none;color:rgba(224,85,85,0.45);font-size:13px;cursor:pointer;padding:0 4px">×</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : `<div class="intel-card" style="text-align:center;padding:48px;margin-bottom:16px">
      <div style="font-size:11px;color:rgba(255,255,255,0.25);line-height:1.9">Añade perfiles de inversor para que la herramienta<br>detecte quién encaja con cada deal y genere el email personalizado.</div>
    </div>`}

    <div id="inv-add-form" style="display:none" class="intel-card blue">
      <div class="intel-h" style="color:rgba(85,136,204,0.9)">Nuevo perfil</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        ${[
          ['inv-name',       'Nombre / firma',          '', 'text'],
          ['inv-tipo-sel',   'Tipo',                    '', 'select'],
          ['inv-ticket-min', 'Ticket mínimo (€)',        '', 'number'],
          ['inv-ticket-max', 'Ticket máximo (€)',        '', 'number'],
          ['inv-roi-min',    'ROI bruto mínimo (%)',     '', 'number'],
          ['inv-plazo-max',  'Plazo máximo (meses)',     '', 'number'],
        ].map(([id,lbl,ph,type]) => `<div>
          <label style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);display:block;margin-bottom:5px">${lbl}</label>
          ${type==='select'
            ? `<select class="intel-select" id="${id}" style="width:100%"><option>HNW</option><option>Family office</option><option>Institucional</option><option>HNWI internacional</option><option>LP privado</option></select>`
            : `<input class="intel-input" id="${id}" type="${type}" placeholder="${ph}">`}
        </div>`).join('')}
        <div style="grid-column:span 2">
          <label style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);display:block;margin-bottom:5px">Notas (apetito, zonas, contacto)</label>
          <input class="intel-input" id="inv-notas" placeholder="Prefiere Salamanca, conoce el mercado, ticket habitual 1-2M€…">
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="intel-btn" style="border-color:rgba(85,136,204,0.5);color:rgba(85,136,204,0.9)" onclick="saveInvestor()">Guardar perfil</button>
        <button onclick="document.getElementById('inv-add-form').style.display='none'" style="background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.35);padding:7px 16px;cursor:pointer;font-size:9px;letter-spacing:0.12em;text-transform:uppercase">Cancelar</button>
      </div>
    </div>`;
}

function showAddInvestor() {
  const el = document.getElementById('inv-add-form');
  if (el) { el.style.display='block'; el.scrollIntoView({behavior:'smooth'}); }
}

function saveInvestor() {
  const name = document.getElementById('inv-name')?.value?.trim();
  if (!name) { alert('Introduce un nombre.'); return; }
  const db = lsGet(LS_INV);
  db.push({
    id: Date.now(), name,
    tipo:       document.getElementById('inv-tipo-sel')?.value || 'HNW',
    ticket_min: parseFloat(document.getElementById('inv-ticket-min')?.value) || null,
    ticket_max: parseFloat(document.getElementById('inv-ticket-max')?.value) || null,
    roi_min:    parseFloat(document.getElementById('inv-roi-min')?.value) || null,
    plazo_max:  parseFloat(document.getElementById('inv-plazo-max')?.value) || null,
    notas:      document.getElementById('inv-notas')?.value || '',
    created:    new Date().toISOString().slice(0,10),
  });
  lsSet(LS_INV, db);
  document.getElementById('inv-add-form').style.display = 'none';
  renderIntelContent('investors');
}

function deleteInvestor(i) {
  if (!confirm('¿Eliminar este perfil?')) return;
  const db = lsGet(LS_INV); db.splice(i,1); lsSet(LS_INV, db); renderIntelContent('investors');
}

async function generateInvestorEmail(invName) {
  if (!checkAPIKey()) return;
  const m = (() => { try { return calc(); } catch { return null; } })();
  if (!m) return;
  const investors = lsGet(LS_INV);
  const inv = investors.find(i => i.name === invName);
  const bench = lsGet(LS_BENCH);
  const lastB = bench.length ? bench[bench.length-1] : null;
  const dealPm2 = m.surfCapex > 0 ? Math.round(m.base.saleGross/m.surfCapex) : 0;

  const prompt = `Eres el equipo de relaciones con inversores de Riverwalk Real Estate Investments, Madrid. Escribe un email profesional, conciso y sofisticado (máx. 180 palabras) para presentar esta oportunidad a ${invName} (${inv?.tipo||'inversor'}).

Activo: ${S('dealName')||'Activo prime Madrid'} · ${S('dealAddress')||''} · ${document.getElementById('microzona')?.value||'Madrid prime'}
Inversión: ${m.totalInvest.toLocaleString('es-ES')} € · ROI bruto ${(m.base.roiGross*100).toFixed(1)}% · TIR ${isFinite(m.base.irr)?(m.base.irr*100).toFixed(1)+'%':'—'} · ${m.totalMonths} meses
Precio salida base: ${dealPm2.toLocaleString('es-ES')} €/m²${lastB?.london ? ' (Londres prime: '+lastB.london.toLocaleString('es-ES')+' €/m²)' : ''}
Perfil inversor: ${inv?.notas||'Inversor prime Madrid'}

Estructura: Asunto + cuerpo. Firma: Riverwalk Real Estate Investments.`;

  openAITerminal();
  addAIMessage('user', `Genera email de presentación para ${invName}`);
  try {
    const res = await fetch('/api/anthropic', {
      method:'POST', headers:getAPIHeaders(),
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:500, messages:[{role:'user',content:prompt}] })
    });
    const data = await res.json();
    const text = data.content?.find(b=>b.type==='text')?.text || '⚠ Sin respuesta.';
    addAIMessage('assistant', text, false);
  } catch(e) { addAIMessage('assistant','⚠ Error generando email.',false); }
}

// ══════════════════════════════════════════════════
// PDF DOSSIER — A4 page-by-page export
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// PDF DOSSIER — html2canvas + jsPDF
// Renderiza los slides de presentación página a página


function initBookmarklet() {
  const bmCode = `(function(){
var price=null,m2=null,desc='',planta=null,ext=null,asc=null,source='';
if(location.href.includes('idealista')){
  source='Idealista';
  var priceSelectors=['.price-features__price .txt-bold','.price-features__price','.info-data-price .txt-bold','.info-data-price span','.main-info__title-price'];
  for(var i=0;i<priceSelectors.length;i++){var pe=document.querySelector(priceSelectors[i]);if(pe){var n=parseInt(pe.textContent.replace(/[^0-9]/g,''));if(n>10000){price=n;break;}}}
  var featureEls=document.querySelectorAll('.details-property-feature-one li,.info-features .feature-block span,.info-features li,li');
  featureEls.forEach(function(el){
    var t=el.textContent.trim();
    var mMatch=t.match(/^(\d{2,4})\s*m[xb2\u00b2]/);
    if(mMatch&&!t.toLowerCase().includes('parcela')&&!t.toLowerCase().includes('terreno')){var n=parseInt(mMatch[1]);if(n>20&&n<2000&&!m2)m2=n;}
  });
  featureEls.forEach(function(el){
    var t=el.textContent.toLowerCase().trim();
    if(t.includes('planta')){var fm=t.match(/(\d+)[a\u00aa\u00b0]?\s*planta/);if(fm)planta=parseInt(fm[1]);else if(t.includes('bajo'))planta=0;else if(t.includes('entrepl'))planta=-1;}
    if(t.includes('exterior')&&ext===null)ext=true;
    if(t.includes('interior sin')&&ext===null)ext=false;
    if(t.includes('ascensor'))asc=true;
  });
  var h1=document.querySelector('span.main-info__title-main,h1.main-info__title,h1');
  if(h1)desc=h1.textContent.trim().substring(0,80);
}else if(location.href.includes('fotocasa')){
  source='Fotocasa';
  var fp=document.querySelector('[class*="re-DetailHeader-price"],[class*="price-features__price"]');
  if(fp)price=parseInt(fp.textContent.replace(/[^0-9]/g,''));
  document.querySelectorAll('[class*="re-DetailInfo"] li,[class*="feature"] li,li').forEach(function(el){
    var t=el.textContent.trim();var tl=t.toLowerCase();
    var mMatch=t.match(/^(\d{2,4})\s*m[xb2\u00b2]/);
    if(mMatch&&!m2){var n=parseInt(mMatch[1]);if(n>20&&n<2000)m2=n;}
    if(tl.includes('planta')){var fm=tl.match(/(\d+)/);if(fm)planta=parseInt(fm[1]);}
    if(tl.includes('exterior')&&ext===null)ext=true;
    if(tl.includes('interior')&&ext===null)ext=false;
    if(tl.includes('ascensor'))asc=true;
  });
  var fh1=document.querySelector('h1');if(fh1)desc=fh1.textContent.trim().substring(0,80);
}
if(!price&&!m2){alert('No se encontraron datos. Abre la ficha completa del inmueble (no el listado).');return;}
var ppmText=price&&m2?Math.round(price/m2).toLocaleString('es-ES')+' \u20ac/m\u00b2':'';
var data='RW_COMP::'+JSON.stringify({precio:price,m2:m2,desc:desc,planta:planta,exterior:ext,ascensor:asc,source:source,url:location.href});
if(navigator.clipboard){
  navigator.clipboard.writeText(data).then(function(){alert('\u2713 Copiado ('+source+'):\n'+(price?price.toLocaleString('es-ES')+' \u20ac':'\u2014')+' \u00b7 '+(m2?m2+' m\u00b2':'\u2014')+' \u00b7 '+ppmText+'\n\nVuelve a Riverwalk y pulsa "\ud83d\udccb Pegar testigo"');});
}else{window.prompt('Copia y pega en Riverwalk:',data);}
})();`;
  const el = document.getElementById('bookmarklet-link');
  if (el) el.href = 'javascript:' + encodeURIComponent(bmCode);
}

// Read RW_COMP:: data from clipboard → add as comp
async function rwPasteComp() {
  const status = $('comp-extract-status');
  const setStatus = (msg, col) => { if(status){ status.textContent = msg; status.style.color = col || 'var(--text-d)'; } };
  if (!navigator.clipboard) { setStatus('Tu navegador no soporta portapapeles. Usa Chrome.', 'var(--red)'); return; }
  let text = '';
  try { text = await navigator.clipboard.readText(); }
  catch(e) { setStatus('Permite el acceso al portapapeles cuando Chrome lo solicite.', 'var(--amber)'); return; }
  text = text.trim();
  if (!text.startsWith('RW_COMP::')) { setStatus('Portapapeles sin datos de bookmarklet. Pulsa primero el bookmarklet en Idealista.', 'var(--amber)'); return; }
  let parsed;
  try { parsed = JSON.parse(text.slice('RW_COMP::'.length)); }
  catch(e) { setStatus('Datos corruptos. Vuelve a pulsar el bookmarklet.', 'var(--red)'); return; }
  const { precio, m2, desc, planta, exterior, ascensor, source, url } = parsed;
  if (!precio && !m2) { setStatus('El bookmarklet no extrajo precio ni m². Abre la ficha completa del anuncio.', 'var(--amber)'); return; }
  comps.push({ id:compNextId++, desc:desc||`${source||'Idealista'}`, url:url||'', source:source||'Idealista',
    tipo:'reformado', precio:precio||0, m2:m2||0, planta:planta??null, exterior:exterior??true, ascensor:ascensor??true });
  renderCompInputs(); renderCompOutput(); renderPricingEngine(); update();
  const ppm = precio&&m2 ? Math.round(precio/m2).toLocaleString('es-ES')+' €/m²' : '';
  setStatus(`✓ ${source||'Testigo'} añadido — ${precio?precio.toLocaleString('es-ES')+' €':'—'} · ${m2?m2+' m²':'—'}${ppm?' · '+ppm:''}`, 'var(--green)');
  setTimeout(() => setStatus(''), 4000);
}

// MOBILE QUICK ENTRY
// ══════════════════════════════════════════════════
let qeExt = true, qeAsc = true;

function toggleQuickEntry() {
  const panel = $('quick-entry-panel'), arr = $('quick-entry-arr');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : '';
  if (arr) arr.style.transform = open ? '' : 'rotate(180deg)';
}

function setQEExt(v) {
  qeExt = v;
  const styleFn = (btn, active) => {
    if (!btn) return;
    btn.style.background = active ? 'rgba(30,122,69,0.25)' : 'var(--d4)';
    btn.style.borderColor = active ? 'var(--green)' : 'var(--d6)';
    btn.style.color = active ? 'var(--green)' : 'var(--text-d)';
  };
  styleFn($('qe-ext-btn'), v); styleFn($('qe-int-btn'), !v);
  updateQEPreview();
}

function setQEAsc(v) {
  qeAsc = v;
  const styleFn = (btn, active) => {
    if (!btn) return;
    btn.style.background = active ? 'rgba(30,122,69,0.25)' : 'var(--d4)';
    btn.style.borderColor = active ? 'var(--green)' : 'var(--d6)';
    btn.style.color = active ? 'var(--green)' : 'var(--text-d)';
  };
  styleFn($('qe-asc-si'), v); styleFn($('qe-asc-no'), !v);
  updateQEPreview();
}

function updateQEPreview() {
  const precio = parseFloat($('qe-precio')?.value) || 0;
  const m2v    = parseFloat($('qe-m2')?.value) || 0;
  const prev   = $('qe-preview');
  if (!prev) return;
  if (precio && m2v) {
    const ppm = Math.round(precio / m2v);
    prev.textContent = `${precio.toLocaleString('es-ES')} €  ·  ${m2v} m²  ·  ${ppm.toLocaleString('es-ES')} €/m²`;
    prev.style.color = 'var(--gold)';
  } else {
    prev.textContent = precio || m2v ? 'Falta ' + (!precio ? 'precio' : 'm²') : '';
    prev.style.color = 'var(--amber)';
  }
}

function addQuickEntry() {
  const precio = parseFloat($('qe-precio')?.value) || 0;
  const m2v    = parseFloat($('qe-m2')?.value) || 0;
  if (!precio || !m2v) { alert('Introduce precio y m² antes de añadir.'); return; }
  comps.push({
    id: compNextId++,
    desc: $('qe-desc')?.value || `${$('qe-source')?.value||'Manual'} ${Math.round(precio/m2v).toLocaleString('es-ES')}€/m²`,
    url: '', source: $('qe-source')?.value || 'Manual',
    tipo: $('qe-tipo')?.value || 'reformado',
    precio, m2: m2v,
    planta: parseFloat($('qe-planta')?.value) || null,
    exterior: qeExt, ascensor: qeAsc
  });
  ['qe-precio','qe-m2','qe-desc','qe-planta'].forEach(id => { const el=$(id); if(el) el.value=''; });
  updateQEPreview();
  renderCompInputs(); renderCompOutput(); renderPricingEngine(); update();
  const prev = $('qe-preview');
  if (prev) { prev.textContent = '✓ Añadido'; prev.style.color = 'var(--green)'; setTimeout(() => { prev.textContent = ''; }, 2000); }
}

function handleRWCompPaste(text) {
  if (!text.startsWith('RW_COMP::')) return false;
  try {
    const data = JSON.parse(text.replace('RW_COMP::', ''));
    if (!data.precio && !data.m2) return false;
    comps.push({
      id: compNextId++,
      desc: data.desc || `${data.source||'Portal'} — importado`,
      url: data.url || '', source: data.source || 'Portal',
      tipo: 'reformado', precio: data.precio || 0, m2: data.m2 || 0,
      planta: data.planta || null, exterior: data.exterior, ascensor: data.ascensor
    });
    renderCompInputs(); renderCompOutput(); renderPricingEngine(); update();
    return true;
  } catch { return false; }
}

// ══════════════════════════════════════════════════
// PRICING ENGINE
// ══════════════════════════════════════════════════
const PORTAL_DISCOUNT_DEFAULT = 8;

// Microzone adjustment data (base/atico/atico_sin are % premiums relative to zone avg price)
const MICROZONE_DATA = [
  {z:'Jerónimos',      tier:'AA', base:20,  atico:15, atico_sin:10},
  {z:'Recoletos',      tier:'AA', base:18,  atico:12, atico_sin:9 },
  {z:'Cortes / Huertas', tier:'AA', base:16, atico:10, atico_sin:7},
  {z:'Justicia',       tier:'AA', base:14,  atico:12, atico_sin:7 },
  {z:'Almagro',        tier:'AA', base:16,  atico:14, atico_sin:7 },
  {z:'Palacio / Ópera',tier:'A',  base:8,   atico:14, atico_sin:7 },
  {z:'Pintor Rosales', tier:'A',  base:12,  atico:14, atico_sin:7 },
  {z:'Serrano / Goya', tier:'A',  base:10,  atico:12, atico_sin:6 },
  {z:'Ibiza',          tier:'A',  base:8,   atico:12, atico_sin:6 },
  {z:'Trafalgar',      tier:'A',  base:7,   atico:10, atico_sin:5 },
  {z:'Chueca',         tier:'A',  base:6,   atico:10, atico_sin:5 },
  {z:'Malasaña',       tier:'A',  base:4,   atico:10, atico_sin:5 },
  {z:'Lista / Ayala',  tier:'B',  base:0,   atico:8,  atico_sin:4 },
  {z:'Ríos Rosas',     tier:'B',  base:0,   atico:8,  atico_sin:4 },
  {z:'Retiro sur',     tier:'B',  base:2,   atico:8,  atico_sin:4 },
  {z:'Argüelles centro',tier:'B', base:2,   atico:8,  atico_sin:4 },
  {z:'Sol / Gran Vía', tier:'B',  base:0,   atico:6,  atico_sin:3 },
  {z:'Goya periferia', tier:'B',  base:-5,  atico:6,  atico_sin:3 },
  {z:'Pacífico',       tier:'C',  base:-8,  atico:5,  atico_sin:2 },
  {z:'Lavapiés',       tier:'C',  base:-12, atico:5,  atico_sin:2 },
];

// Planta adjustment map
const PLANTA_ADJ = { bajo:-0.12, entre:-0.07, '1sin':-0.05, base:0, alta:0.04, muyalta:0.07 };
// Orientation adjustment map
const ORIENT_ADJ = { ext_sur:0.06, ext_norte:0.02, int_luminoso:0, int_oscuro:-0.08 };

function getMicrozoneAdj() {
  const mz = $('microzona')?.value || '';
  if (!mz) return { base:0, atico:0, atico_sin:0, zone:null };
  return MICROZONE_DATA.find(z => z.z === mz) || { base:0, atico:0, atico_sin:0, zone:null };
}

function getPropertyAdjs() {
  const tipo    = $('prop-tipo')?.value || 'piso';
  const orient  = $('prop-orient')?.value || 'ext_sur';
  const planta  = $('prop-planta')?.value || 'base';
  const mz      = getMicrozoneAdj();

  const mzBase  = mz.base / 100;
  const aticoAdj = tipo === 'atico_terraza' ? mz.atico / 100
                 : tipo === 'atico_sin'     ? mz.atico_sin / 100
                 : 0;
  const orientAdj = ORIENT_ADJ[orient] || 0;
  const plantaAdj = PLANTA_ADJ[planta] || 0;

  // Ático already incorporates height — don't double-count floor premium
  const effectivePlanta = tipo !== 'piso' ? 0 : plantaAdj;

  const total = mzBase + aticoAdj + orientAdj + effectivePlanta;

  // Update adj display
  const adjEl = $('prop-adj-text');
  if (adjEl) {
    const parts = [];
    if (mz.z)          parts.push(`Microzona ${mz.z}: ${mz.base >= 0 ? '+' : ''}${mz.base}%`);
    if (aticoAdj)      parts.push(`Ático: +${(aticoAdj*100).toFixed(0)}%`);
    if (orientAdj)     parts.push(`Orientación: ${orientAdj >= 0 ? '+' : ''}${(orientAdj*100).toFixed(0)}%`);
    if (effectivePlanta) parts.push(`Planta: ${effectivePlanta >= 0 ? '+' : ''}${(effectivePlanta*100).toFixed(0)}%`);
    const totalSign = total >= 0 ? '+' : '';
    adjEl.innerHTML = parts.length
      ? parts.join(' · ') + `<br><strong style="color:var(--gold)">Total ajuste nuestro activo: ${totalSign}${(total*100).toFixed(0)}%</strong>`
      : '—';
  }

  return { total, mzBase, aticoAdj, orientAdj, plantaAdj: effectivePlanta };
}

function renderPricingEngine() {
  const el = $('pricing-engine-output');
  if (!el) return;

  const valid = comps.filter(c => c.precio > 0 && c.m2 > 0);
  if (valid.length < 3) {
    el.innerHTML = `<div style="font-size:10.5px;color:var(--text-d);font-style:italic;padding:8px 0">
      Añade al menos 3 testigos para calcular precio sugerido de salida.</div>`;
    return;
  }

  const surf     = V('surfCapex') || 100;
  const discount = (parseFloat($('portal-discount')?.value) || PORTAL_DISCOUNT_DEFAULT) / 100;

  // Get our activo's adjustments
  const ourAdj = getPropertyAdjs();

  const adjPpm = valid.map(c => {
    const raw     = c.precio / c.m2;
    const isReg   = c.source === 'Registro Q1 2025' || c.source === 'Registro';
    // Apply portal discount to normalize to closed price
    const portAdj = isReg ? raw : raw * (1 - discount);
    // Normalize comparable to "standard" (reformado, 2-3ª exterior, con ascensor)
    const stateAdj = c.tipo === 'reformar' ? 0.78 : c.tipo === 'estreno' ? 1.05 : 1.0;
    const floorAdj = c.planta === 0 ? 0.92 : c.planta === 1 ? 0.94 :
                     c.planta >= 6 ? 1.07 : c.planta >= 4 ? 1.04 : 1.0;
    const extAdj   = c.exterior === false ? 0.93 : c.exterior === true ? 1.04 : 1.0;
    const ascAdj   = c.ascensor === false && (c.planta || 0) > 2 ? 0.94 : 1.0;
    // Normalized = what this comp would cost as a standard piso
    const normalized = portAdj / (stateAdj * floorAdj * extAdj * ascAdj);
    return normalized;
  }).sort((a, b) => a - b);

  const n      = adjPpm.length;
  const p25    = adjPpm[Math.floor(n * 0.25)];
  const median = n % 2 === 0 ? (adjPpm[n/2-1] + adjPpm[n/2])/2 : adjPpm[Math.floor(n/2)];
  const p75    = adjPpm[Math.floor(n * 0.75)];
  // Apply our activo's adjustments to get final suggested price
  const applyOurAdj = v => v * (1 + ourAdj.total);
  const r500   = v => Math.round(v / 500) * 500;
  const [sugP, sugB, sugO] = [r500(applyOurAdj(p25)), r500(applyOurAdj(median)), r500(applyOurAdj(p75))];

  el.innerHTML = `
    <div style="font-size:8.5px;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;font-weight:600">
      Precio sugerido de salida · ${valid.length} testigos · ${n} ajustados
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);margin-bottom:12px">
      ${[
        {lbl:'Pesimista · P25',    val:sugP, col:'var(--red)',   sc:'P', bg:'rgba(192,57,43,0.1)'},
        {lbl:'Base · Mediana',     val:sugB, col:'var(--gold)',  sc:'B', bg:'rgba(139,105,20,0.12)', bold:true},
        {lbl:'Optimista · P75',    val:sugO, col:'var(--green)', sc:'O', bg:'rgba(30,122,69,0.08)'},
      ].map(({lbl,val,col,sc,bg,bold}) => `
        <div style="background:var(--d3);padding:14px;text-align:center${bold?';border:1px solid rgba(139,105,20,0.3)':''}">
          <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:${col};margin-bottom:6px;font-weight:600">${lbl}</div>
          <div style="font-family:'DM Mono',monospace;font-size:${bold?22:19}px;color:${col};font-feature-settings:'tnum' 1;font-weight:${bold?700:600}">${val.toLocaleString('es-ES')} €/m²</div>
          <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-d);margin-top:4px;font-feature-settings:'tnum' 1">${fmt(val * surf)}</div>
          <button onclick="applyExitPrice(${val},'${sc}')"
            style="margin-top:8px;background:${bg};border:1px solid ${col};color:${col};
                   font-family:'Raleway',sans-serif;font-size:8.5px;letter-spacing:0.12em;
                   text-transform:uppercase;padding:5px 10px;cursor:pointer;width:100%;font-weight:${bold?700:500}">
            ${bold?'✓ ':''}Aplicar al modelo
          </button>
        </div>`).join('')}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:9px 12px;background:var(--d4);font-size:10.5px;color:var(--text-d);margin-bottom:8px">
      <span>Descuento oferta→cierre (portales):</span>
      <div style="display:flex;align-items:center;gap:6px">
        <input type="number" id="portal-discount" value="${(discount*100).toFixed(0)}" min="0" max="25" step="1"
          oninput="renderPricingEngine()"
          style="width:52px;background:var(--d2);border:1px solid var(--d6);color:var(--text-b);
                 font-family:'DM Mono',monospace;font-size:13px;padding:5px 8px;text-align:center;font-feature-settings:'tnum' 1">
        <span>%</span>
      </div>
      <span style="color:var(--text-d);opacity:0.7">· Registro = precio cierre real (sin descuento)</span>
    </div>
    <div style="font-size:9.5px;color:var(--text-d);line-height:1.7;padding:8px 12px;background:var(--d4);border-left:2px solid var(--line)">
      <strong style="color:var(--text-b)">Metodología:</strong>
      (1) Normalizar comparables a "piso estándar" descontando portal ${(discount*100).toFixed(0)}%, estado, planta, orientación y ascensor ·
      (2) Calcular percentiles P25/mediana/P75 ·
      (3) Aplicar ajuste de nuestro activo (microzona + tipo + orientación + planta) ·
      Ajuste total aplicado: <strong style="color:var(--gold)">${ourAdj.total >= 0 ? '+' : ''}${(ourAdj.total*100).toFixed(0)}%</strong>
    </div>`;
}

function applyExitPrice(pm2, scenario) {
  const fieldMap = { P: 'exitP', B: 'exitB', O: 'exitO' };
  const el = $(fieldMap[scenario]);
  if (el) { el.value = pm2; update(); }
}

function calcDetailedCF(m) {
  const iva      = V('ivaObra') / 100;
  const capexTot = m.capexNet * (1 + iva);
  const mgmtTot  = m.mgmtFee  * (1 + iva);
  const b        = m.base;
  const isPase   = m.dealMode === 'pase';

  const dArras        = S('cfDateArras');
  const dEsc          = S('cfDateEscritura');
  const dAmpliacion   = ampliacionOn ? S('cfDateAmpliacion')   : null;
  const dEscAmp       = ampliacionOn ? S('cfDateEscrituraAmp') : null;
  // Use dEscAmp as the real escritura date when ampliacion active
  const dEscFinal     = (ampliacionOn && dEscAmp) ? dEscAmp : dEsc;

  const dCert50   = S('cfDateCert50');
  const dCert70   = S('cfDateCert70');
  const dEntrega  = S('cfDateEntrega');
  const dVenta    = S('cfDateVenta');

  const events = [];
  const add = (date, concepto, amount, tipo) => {
    if (date) events.push({ date, concepto, amount, tipo });
  };

  // Ampliación amount = % of price (always a % of total purchase price)
  const ampPct     = ampliacionOn ? (parseFloat($('ampliacionPct')?.value || 0) / 100) : 0;
  const ampImporte = ampliacionOn ? Math.round(m.buyPrice * ampPct) : 0;

  // Arras iniciales
  add(dArras, `Arras iniciales (${((m.arasAmt / m.buyPrice)*100).toFixed(1)}% s/precio)`, -m.arasAmt, 'compra');

  if (!isPase) {
    // Management fee: 50% en arras
    if (mgmtTot > 0) add(dArras, 'Management fee — 50% + IVA', -(mgmtTot * 0.5), 'fee-rw');
  } else {
    // Pase: management fee 50% en arras también
    const paseMgmt = m.mgmtFee * (1 + V('ivaObra')/100);
    if (paseMgmt > 0) add(dArras, `Management fee pase — 50% + IVA (${V('paseMgmtPct')}% s/precio)`, -(paseMgmt * 0.5), 'fee-rw');
  }

  // Ampliación de arras
  if (ampliacionOn && dAmpliacion && ampImporte > 0) {
    add(dAmpliacion, `Ampliación de arras (${(ampPct*100).toFixed(1)}% s/precio)`, -ampImporte, 'compra');
  }

  // Escritura (original si sin ampliación, o nueva fecha si con ampliación)
  const arasTotal = m.arasAmt + ampImporte;
  add(dEscFinal, 'Resto precio compra (escritura)', -(m.buyPrice - arasTotal), 'compra');
  add(dEscFinal, `ITP (${V('itpPct')}%)`, -m.itp, 'gasto');
  add(dEscFinal, 'Notaría + registro (compra)', -m.notaria, 'gasto');
  if (m.brokerBuyFee   > 0) add(dEscFinal, 'Broker fee compra', -m.brokerBuyFee, 'gasto');
  if (m.intermediaryFee > 0) add(dEscFinal, S('intermediaryDesc') || 'Fee adicional a terceros', -m.intermediaryFee, 'gasto');

  if (!isPase) {
    // Management fee: 50% en escritura
    if (mgmtTot > 0) add(dEscFinal, 'Management fee — 50% restante + IVA', -(mgmtTot * 0.5), 'fee-rw');
  } else {
    const paseMgmt = m.mgmtFee * (1 + V('ivaObra')/100);
    if (paseMgmt > 0) add(dEscFinal, 'Management fee pase — 50% restante + IVA', -(paseMgmt * 0.5), 'fee-rw');
  }
  if (!isPase) {
    // CapEx tramos
    if (capexTot > 0) {
      add(dEscFinal, 'CapEx tramo 1 — Escritura (50%) + IVA',      -(capexTot * 0.50), 'capex');
      add(dCert50,   'CapEx tramo 2 — Cert. 50% obra (20%) + IVA', -(capexTot * 0.20), 'capex');
      add(dCert70,   'CapEx tramo 3 — Cert. 70% obra (20%) + IVA', -(capexTot * 0.20), 'capex');
      add(dEntrega,  'CapEx tramo 4 — Entrega obra (10%) + IVA',    -(capexTot * 0.10), 'capex');
    }
    if (m.comunidadTotal + m.ibiTotal > 0) {
      add(dEntrega || dVenta, `Gastos holding (comunidad + IBI, ${m.totalMonths}m)`, -(m.comunidadTotal + m.ibiTotal), 'gasto');
    }
  } else {
    if (m.comunidadTotal + m.ibiTotal > 0) {
      add(dVenta, `Gastos holding (comunidad, ${m.totalMonths}m)`, -(m.comunidadTotal + m.ibiTotal), 'gasto');
    }
  }

  // Venta
  add(dVenta, `Venta — ${V('exitB').toLocaleString('es-ES')} €/m² × ${m.surfCapex} m² construidos`, b.saleGross, 'ingreso');
  add(dVenta, `Comisión broker salida (${V('brokerExit')}%)`, -b.brokerCost, 'gasto');
  const exitF = V('exitFixed') + V('exitFixedAjuste');
  if (exitF > 0) add(dVenta, 'Plusvalía municipal + notaría venta', -exitF, 'gasto');

  if (isPase) {
    add(dVenta, `Carry Riverwalk (${V('paseCarryPct')}% + IVA ${V('paseCarryIVA')}%)`, -b.sf, 'sf');
  } else {
    add(dVenta, 'Success fee Riverwalk', -b.sf, 'sf');
  }
  if (taxOn && b.tax > 0) add(dVenta, `${S('taxStructure')==='sl'?'IS':'IRPF'} (${V('taxRate')}%)`, -b.tax, 'tax');

  // Ordenar y calcular saldo acumulado
  events.sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  events.forEach(e => { balance += e.amount; e.balance = balance; });

  return events;
}

function renderCashflow(m) {
  const events = calcDetailedCF(m);

  // "Total desembolsado" = capital real salido de bolsillo (inversión + gastos de holding)
  // Excluye los costes deducidos del ingreso de venta (success fee, IS, broker salida, plusvalía)
  // que nunca fueron desembolsados — se restan del precio recibido
  const tiposInversion = ['compra', 'gasto', 'capex', 'fee-rw'];
  const totalOut = events
    .filter(e => e.amount < 0 && tiposInversion.includes(e.tipo))
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const totalIn  = events.filter(e=>e.amount>0).reduce((s,e)=>s+e.amount,0);
  const peakNeg  = events.length ? Math.min(...events.map(e=>e.balance)) : 0;
  const dArras   = S('cfDateArras'), dVenta = S('cfDateVenta');
  let durStr = '—';
  if (dArras && dVenta) {
    const days = Math.round((new Date(dVenta)-new Date(dArras))/86400000);
    durStr = `${Math.round(days/30.4)} meses (${days} días)`;
  }
  $('cf-summary').innerHTML = `
    <div class="cf-sum-item"><div class="cf-sum-lbl">Capital desembolsado</div><div class="cf-sum-val cf-out">${fmt(totalOut)}</div><div style="font-size:10.5px;color:var(--text-d);margin-top:2px">Compra + CapEx + fees + gastos</div></div>
    <div class="cf-sum-item"><div class="cf-sum-lbl">Pico capital comprometido</div><div class="cf-sum-val cf-bal-neg">${fmt(Math.abs(peakNeg))}</div><div style="font-size:10.5px;color:var(--text-d);margin-top:2px">Saldo más negativo del cashflow</div></div>
    <div class="cf-sum-item"><div class="cf-sum-lbl">Duración arras → venta</div><div class="cf-sum-val" style="color:var(--text-b)">${durStr}</div></div>`;

  if (!events.length) {
    $('cf-table').innerHTML = `<tr><td colspan="2" class="cf-missing" style="padding:16px 0;font-style:italic;color:var(--text-d)">Introduce las fechas en el panel izquierdo para generar el cashflow.</td></tr>`;
    return;
  }

  // ── HORIZONTAL layout: rows = concepts, cols = dates ──────────
  // Collect unique dates in order
  const dates = [...new Set(events.map(e=>e.date))].sort();
  const tipoColor = {
    compra:'var(--blue)', gasto:'var(--text-d)', capex:'var(--amber)',
    'fee-rw':'var(--gold)', ingreso:'var(--green)', tax:'var(--red)', sf:'var(--gold-d)'
  };

  // Aggregate by (concepto, tipo) across dates
  const rows = [];
  events.forEach(e => {
    let row = rows.find(r => r.concepto === e.concepto);
    if (!row) { row = { concepto: e.concepto, tipo: e.tipo, byDate: {} }; rows.push(row); }
    row.byDate[e.date] = (row.byDate[e.date] || 0) + e.amount;
  });

  // Build header
  let html = `<thead><tr>
    <th class="al" style="min-width:220px;position:sticky;left:0;background:var(--d2);z-index:2">Concepto</th>`;
  dates.forEach(d => {
    html += `<th style="min-width:130px;white-space:nowrap">${fmtDate(d)}</th>`;
  });
  html += `<th style="min-width:130px">Total</th></tr></thead><tbody>`;

  // Rows
  rows.forEach(row => {
    const rowTotal = Object.values(row.byDate).reduce((s,v)=>s+v,0);
    const isOut = rowTotal < 0;
    const color = tipoColor[row.tipo] || 'var(--text)';
    html += `<tr>
      <td class="al" style="position:sticky;left:0;background:var(--d3);border-left:2px solid ${color};padding-left:10px;font-size:11px">${row.concepto}</td>`;
    dates.forEach(d => {
      const v = row.byDate[d] || null;
      if (v === null) {
        html += `<td style="color:var(--text-d);opacity:0.3">—</td>`;
      } else {
        const cls = v < 0 ? 'cf-out' : 'cf-in';
        const sign = v < 0 ? '−' : '+';
        html += `<td class="${cls}">${sign}${fmt(Math.abs(v))}</td>`;
      }
    });
    const cls = rowTotal < 0 ? 'cf-out' : 'cf-in';
    const sign = rowTotal < 0 ? '−' : '+';
    html += `<td class="${cls}" style="font-weight:500;border-left:1px solid var(--line)">${sign}${fmt(Math.abs(rowTotal))}</td></tr>`;
  });

  // Saldo acumulado row
  html += `<tr style="background:var(--d4)">
    <td class="al" style="position:sticky;left:0;background:var(--d4);font-family:'Raleway',sans-serif;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);padding-left:10px">Saldo acumulado</td>`;
  let running = 0;
  dates.forEach(d => {
    events.filter(e=>e.date===d).forEach(e=>{ running+=e.amount; });
    const cls = running < 0 ? 'cf-bal-neg' : 'cf-bal-pos';
    html += `<td class="${cls}" style="font-weight:500">${fmt(running)}</td>`;
  });
  html += `<td></td></tr>`;

  // Net investor row
  const finalBal = events[events.length-1].balance;
  html += `<tr class="cf-total">
    <td class="al" style="position:sticky;left:0;background:var(--d3);font-family:'Raleway',sans-serif" colspan="1">Resultado neto al inversor</td>`;
  dates.forEach(()=>{ html += `<td></td>`; });
  html += `<td class="${finalBal>=0?'cf-bal-pos':'cf-bal-neg'}" style="font-size:13px">${fmt(finalBal)}</td></tr>`;

  html += '</tbody>';
  $('cf-table').innerHTML = html;
}

// ══════════════════════════════════════════════════
// CARRY ENGINE RENDER
// ══════════════════════════════════════════════════
function renderCarryEngine(m) {
  const b       = m.base;
  const totInv  = m.totalInvest;
  const months  = m.totalMonths;

  // Compute carry in ROI mode (always available)
  const t1Roi = V('sf1T')/100 * totInv;
  const t2Roi = V('sf2T')/100 * totInv;
  const sfRoi = calcSFRoi(b.grossProfit, totInv);

  // Compute carry in IRR mode (use b.sf which is already computed with current mode)
  const sfIrr = sfCarryMode === 'irr' ? b.sf : (() => {
    // Compute what IRR-carry would be even if not in that mode
    const t1i = irrThresholdToProfit(V('sf1T')/100, totInv, m.arasAmt, m.arasMonths, m.monthsSale, m.capexNet, m.ivaCapex, m.mgmtFee, m.ivaFees, m.comunidadTotal, m.ibiTotal, m.itp, m.notaria, m.intermediaryFee, m.brokerBuyFee);
    const t2i = irrThresholdToProfit(V('sf2T')/100, totInv, m.arasAmt, m.arasMonths, m.monthsSale, m.capexNet, m.ivaCapex, m.mgmtFee, m.ivaFees, m.comunidadTotal, m.ibiTotal, m.itp, m.notaria, m.intermediaryFee, m.brokerBuyFee);
    const p1 = V('sf1P')/100, p2 = V('sf2P')/100;
    const gP = b.grossProfit;
    if (gP <= 0) return 0;
    let sf = 0;
    if (gP > t1i) sf += (Math.min(gP, t2i) - t1i) * p1;
    if (gP > t2i) sf += (gP - t2i) * p2;
    return sf;
  })();
  const sfCurrentMode = sfCarryMode === 'irr' ? sfIrr : sfRoi;

  // Profit thresholds for IRR mode
  const t1Irr = irrThresholdToProfit(V('sf1T')/100, totInv, m.arasAmt, m.arasMonths, m.monthsSale, m.capexNet, m.ivaCapex, m.mgmtFee, m.ivaFees, m.comunidadTotal, m.ibiTotal, m.itp, m.notaria, m.intermediaryFee, m.brokerBuyFee);
  const t2Irr = irrThresholdToProfit(V('sf2T')/100, totInv, m.arasAmt, m.arasMonths, m.monthsSale, m.capexNet, m.ivaCapex, m.mgmtFee, m.ivaFees, m.comunidadTotal, m.ibiTotal, m.itp, m.notaria, m.intermediaryFee, m.brokerBuyFee);

  // Investor net in each mode
  const investorRoi = b.grossProfit - sfRoi - Math.max(0, b.grossProfit - sfRoi) * V('taxRate')/100;
  const investorIrr = b.grossProfit - sfIrr - Math.max(0, b.grossProfit - sfIrr) * V('taxRate')/100;
  const delta       = investorIrr - investorRoi;
  const deltaSign   = delta >= 0 ? '+' : '';

  const irrLabel  = `TIR anualizada — como PE institucional`;
  const roiLabel  = `ROI acumulado simple`;
  const activeIrr = sfCarryMode === 'irr';

  $('carry-explanation').innerHTML = `
    <div style="font-size:11px;color:var(--text-d);line-height:1.8;margin-bottom:18px;max-width:740px">
      El <strong style="color:var(--text-b)">success fee</strong> funciona por tramos, igual que el IRPF:
      cada tramo sólo aplica al beneficio que cae <em>dentro</em> de ese intervalo, nunca al total.
      El inversor recibe el 100% del retorno hasta el primer umbral — Riverwalk no cobra nada por debajo de él.
    </div>

    <div style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:var(--text-d);margin:0 0 10px">
      Estructura de tramos — ${sfMode === 'fijo' ? 'modo fijo activo' : 'modo escalado activo'}
    </div>

    ${sfMode === 'fijo' ? `
    <div style="background:var(--d4);border:1px solid var(--gold);padding:18px 22px;margin-bottom:16px;font-size:12px;color:var(--text)">
      <strong style="color:var(--gold)">Modo fijo:</strong> Riverwalk cobra un <strong>${V('sfFijoPct')}%</strong>
      sobre el beneficio bruto total de la operación, sin tramos ni umbrales.
      En el escenario base: <strong style="color:var(--gold-l)">${fmt(sfCurrentMode)}</strong>.
    </div>` : `
    <div class="carry-waterfall" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      <div class="carry-wf-item" style="border-top:2px solid var(--green)">
        <div class="carry-wf-tramo">Tramo 1 — protegido</div>
        <div class="carry-wf-pct" style="color:var(--green)">0%</div>
        <div class="carry-wf-from">
          Desde 0 hasta<br>
          <strong>${activeIrr ? V('sf1T')+'% TIR anual' : V('sf1T')+'% ROI'}</strong><br>
          <span style="font-size:9px;color:var(--text-d)">≡ ${fmt(activeIrr?t1Irr:t1Roi)} de beneficio</span>
        </div>
        <div class="carry-wf-note" style="color:var(--green)">100% para el inversor<br>Riverwalk no cobra nada</div>
      </div>
      <div class="carry-wf-item" style="border-top:2px solid var(--amber)">
        <div class="carry-wf-tramo">Tramo 2 — compartido</div>
        <div class="carry-wf-pct" style="color:var(--amber)">${V('sf1P')}%</div>
        <div class="carry-wf-from">
          Del ${activeIrr ? V('sf1T')+'% al '+V('sf2T')+'% TIR' : V('sf1T')+'% al '+V('sf2T')+'% ROI'}<br>
          <span style="font-size:9px;color:var(--text-d)">${fmt(activeIrr?t1Irr:t1Roi)} → ${fmt(activeIrr?t2Irr:t2Roi)}</span>
        </div>
        <div class="carry-wf-note">${100-V('sf1P')}% inversor · ${V('sf1P')}% Riverwalk<br><em>sólo sobre este tramo</em></div>
      </div>
      <div class="carry-wf-item" style="border-top:2px solid var(--red)">
        <div class="carry-wf-tramo">Tramo 3 — outperformance</div>
        <div class="carry-wf-pct" style="color:var(--red)">${V('sf2P')}%</div>
        <div class="carry-wf-from">
          Por encima del ${activeIrr ? V('sf2T')+'% TIR' : V('sf2T')+'% ROI'}<br>
          <span style="font-size:9px;color:var(--text-d)">a partir de ${fmt(activeIrr?t2Irr:t2Roi)}</span>
        </div>
        <div class="carry-wf-note">${100-V('sf2P')}% inversor · ${V('sf2P')}% Riverwalk<br><em>sólo sobre el exceso</em></div>
      </div>
    </div>

    <div style="background:var(--d3);border:1px solid var(--line);padding:14px 18px;margin-bottom:16px;font-size:11px;line-height:1.75;color:var(--text-d)">
      <strong style="color:var(--text-b)">Ejemplo con los números de esta operación (escenario base):</strong><br>
      Beneficio bruto: <strong>${fmt(b.grossProfit)}</strong>
      ${b.grossProfit <= (activeIrr?t1Irr:t1Roi) ? `<br>→ Por debajo del umbral 1. Riverwalk cobra <strong style="color:var(--green)">0 €</strong>.` :
        b.grossProfit <= (activeIrr?t2Irr:t2Roi) ? `
      <br>→ Tramo 1 (0 → ${fmt(activeIrr?t1Irr:t1Roi)}): Riverwalk cobra <strong>0 €</strong>
      <br>→ Tramo 2 (${fmt(activeIrr?t1Irr:t1Roi)} → ${fmt(b.grossProfit)}): Riverwalk cobra <strong>${fmtPct(V('sf1P')/100)}</strong> × ${fmt(b.grossProfit - (activeIrr?t1Irr:t1Roi))} = <strong style="color:var(--amber)">${fmt(sfCurrentMode)}</strong>` : `
      <br>→ Tramo 1 (0 → ${fmt(activeIrr?t1Irr:t1Roi)}): Riverwalk cobra <strong style="color:var(--green)">0 €</strong>
      <br>→ Tramo 2 (${fmt(activeIrr?t1Irr:t1Roi)} → ${fmt(activeIrr?t2Irr:t2Roi)}): ${fmtPct(V('sf1P')/100)} × ${fmt((activeIrr?t2Irr:t2Roi)-(activeIrr?t1Irr:t1Roi))} = <strong>${fmt(((activeIrr?t2Irr:t2Roi)-(activeIrr?t1Irr:t1Roi))*V('sf1P')/100)}</strong>
      <br>→ Tramo 3 (${fmt(activeIrr?t2Irr:t2Roi)} → ${fmt(b.grossProfit)}): ${fmtPct(V('sf2P')/100)} × ${fmt(b.grossProfit-(activeIrr?t2Irr:t2Roi))} = <strong>${fmt((b.grossProfit-(activeIrr?t2Irr:t2Roi))*V('sf2P')/100)}</strong>
      <br>→ <strong>Total success fee: <span style="color:var(--gold-l)">${fmt(sfCurrentMode)}</span></strong>`}
    </div>`}

    <div class="carry-method-strip">
      <div class="carry-method-card${!activeIrr?' active':''}">
        <div class="carry-method-title">ROI simple ${!activeIrr?'← modo activo':''}</div>
        <div class="carry-method-desc">
          Los umbrales son porcentajes del <strong>capital total invertido</strong>, sin ajuste por tiempo.
          Una operación de 8 meses y una de 24 meses con el mismo retorno absoluto generan idéntico carry.
          <br><br>
          Umbral 1 (${V('sf1T')}%): ${fmt(totInv)} × ${V('sf1T')}% = <strong>${fmt(t1Roi)}</strong><br>
          Umbral 2 (${V('sf2T')}%): ${fmt(totInv)} × ${V('sf2T')}% = <strong>${fmt(t2Roi)}</strong>
        </div>
      </div>
      <div class="carry-method-card${activeIrr?' active':''}">
        <div class="carry-method-title">TIR anualizada ★ ${activeIrr?'← modo activo':''}</div>
        <div class="carry-method-desc">
          Los umbrales son <strong>tasas anualizadas</strong>. El beneficio equivalente a ${V('sf1T')}% TIR anual
          depende del calendario de la operación. Una operación más corta exige mayor retorno absoluto
          para llegar al umbral — protege más al inversor cuando se cierra rápido.
          <br><br>
          Umbral 1 (${V('sf1T')}% anual, ${months}m) ≡ <strong>${fmt(t1Irr)}</strong><br>
          Umbral 2 (${V('sf2T')}% anual, ${months}m) ≡ <strong>${fmt(t2Irr)}</strong>
        </div>
      </div>
    </div>

    <div class="carry-timeline-note">
      <strong>Por qué importa el tiempo:</strong> Esta operación dura <strong>${months} meses</strong>.
      En modo TIR, el umbral del ${V('sf1T')}% anual equivale a un retorno acumulado del
      <strong>${fmtPct(Math.pow(1+V('sf1T')/100, months/12)-1)}</strong> en ${months} meses.
      Si la operación cerrase en 8 meses, ese umbral equivaldría al
      <strong>${fmtPct(Math.pow(1+V('sf1T')/100, 8/12)-1)}</strong> — más alto, más protección para el inversor.
      A 24 meses equivaldría al <strong>${fmtPct(Math.pow(1+V('sf1T')/100, 24/12)-1)}</strong>.
      El carry es simétrico y justo independientemente del timing.
    </div>`;

  // Impact grid
  const modeLabel = sfCarryMode === 'irr' ? 'TIR ★ (activo)' : 'ROI (activo)';
  $('carry-impact-strip').innerHTML = `
    <div style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:var(--text-d);margin-bottom:10px">
      Impacto del carry sobre el inversor — escenario base
    </div>
    <div class="carry-impact-grid">
      <div class="ci-item">
        <div class="ci-label">Carry en ROI simple</div>
        <div class="ci-val" style="color:var(--amber)">${fmt(sfRoi)}</div>
        <div class="ci-delta">${fmtPct(sfRoi/Math.max(1,b.grossProfit))} s/ bruto</div>
      </div>
      <div class="ci-item">
        <div class="ci-label">Carry en TIR anualizada</div>
        <div class="ci-val" style="color:var(--gold-l)">${fmt(sfIrr)}</div>
        <div class="ci-delta">${fmtPct(sfIrr/Math.max(1,b.grossProfit))} s/ bruto</div>
      </div>
      <div class="ci-item">
        <div class="ci-label">Δ carry (IRR vs ROI)</div>
        <div class="ci-val ${sfIrr <= sfRoi ? 'delta-pos' : 'delta-neg'}">${sfIrr <= sfRoi ? '−' : '+'}${fmt(Math.abs(sfIrr - sfRoi))}</div>
        <div class="ci-delta" style="color:var(--text-d)">${sfIrr <= sfRoi ? 'Riverwalk cobra menos' : 'Riverwalk cobra más'} en modo TIR</div>
      </div>
      <div class="ci-item" style="background:var(--d4)">
        <div class="ci-label">Beneficio neto inversor (modo activo: ${modeLabel})</div>
        <div class="ci-val up">${fmt(b.netProfit)}</div>
        <div class="ci-delta">${deltaSign}${fmt(Math.abs(delta))} vs modo alternativo</div>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════
// COMPARABLES
// ══════════════════════════════════════════════════
let comps = [
  { id:1, desc:'Casa Lamar — Cedaceros 9 (mismo bloque)',  url:'', source:'Idealista', tipo:'estreno',   precio:3937500, m2:225, planta:4, exterior:true, ascensor:true },
  { id:2, desc:'Comparable A — Centro prime',              url:'', source:'Idealista', tipo:'reformado', precio:3850000, m2:200, planta:3, exterior:true, ascensor:true },
  { id:3, desc:'Comparable B — Centro prime',              url:'', source:'Idealista', tipo:'reformado', precio:4300000, m2:234, planta:5, exterior:true, ascensor:true },
  { id:4, desc:'Comparable C — mismo edificio',            url:'', source:'Idealista', tipo:'reformado', precio:2200000, m2:120, planta:2, exterior:false, ascensor:true },
  { id:5, desc:'Comparable D — a reformar',                url:'', source:'Fotocasa',  tipo:'reformar',  precio:1690000, m2:200, planta:1, exterior:false, ascensor:false },
];
let compNextId = 6;
let extracting  = false;

const tipoLabel = { reformar:'A reformar', reformado:'Reformado', estreno:'Estreno' };
const tipoClass = { reformar:'comp-tipo-r', reformado:'comp-tipo-rr', estreno:'comp-tipo-e' };
const tipoColor = { reformar:'var(--red)', reformado:'var(--amber)', estreno:'var(--green)' };

function compPpm(c) {
  return c.precio > 0 && c.m2 > 0 ? Math.round(c.precio / c.m2) : null;
}

function detSrc(url) {
  if (!url) return 'Manual';
  if (url.includes('idealista'))  return 'Idealista';
  if (url.includes('fotocasa'))   return 'Fotocasa';
  if (url.includes('habitaclia')) return 'Habitaclia';
  if (url.includes('pisos.com'))  return 'Pisos.com';
  if (url.includes('catastro'))   return 'Catastro';
  return 'Otro';
}

// ── AI EXTRACTION ─────────────────────────────────
async function extractComp() {
  if (extracting) return;
  if (!checkAPIKey()) return;
  const urlInput = $('comp-url-input');
  const url      = (urlInput.value || '').trim();
  const status   = $('comp-extract-status');
  const btn      = $('comp-extract-btn');

  if (!url) {
    status.textContent = '⚠ Pega primero un enlace.';
    status.style.color = 'var(--amber)';
    return;
  }

  extracting = true;
  btn.textContent = '⟳ Extrayendo…';
  btn.style.background = 'var(--d5)';
  btn.style.color = 'var(--gold)';
  status.textContent = 'Consultando el anuncio…';
  status.style.color = 'var(--text-d)';

  try {
    const prompt = `Analiza este anuncio inmobiliario y extrae exactamente estos datos en JSON sin ningún texto extra:
URL: ${url}

Devuelve SOLO este JSON (sin markdown, sin explicación):
{
  "precio": número entero en euros (sin puntos ni símbolos),
  "m2": número entero de metros cuadrados útiles,
  "descripcion": string corto descriptivo del piso (máximo 60 caracteres, incluye calle/zona si aparece),
  "planta": string o null,
  "habitaciones": número o null
}

Si no puedes extraer el precio o los m², devuelve los campos como null. No inventes datos.`;

    const response = await fetch('/api/anthropic', {
      method: 'POST',
      headers: getAPIHeaders(),
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    // Extract text from response (may include tool_use blocks)
    const textBlock = data.content?.find(b => b.type === 'text');
    const raw = textBlock?.text || '';

    // Parse JSON — strip any markdown fences just in case
    const cleaned = raw.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to find JSON object in text
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('No JSON in response');
    }

    if (!parsed.precio && !parsed.m2) {
      status.textContent = '⚠ No se pudieron extraer datos del enlace. Rellena precio y m² manualmente.';
      status.style.color = 'var(--amber)';
      // Still add comp with URL so user can fill manually
      const newId = compNextId++;
      comps.push({
        id: newId, desc: url.substring(0,60), url,
        source: detSrc(url), tipo: 'reformado', precio: 0, m2: 0
      });
    } else {
      const desc = parsed.descripcion ||
        (parsed.habitaciones ? `${parsed.habitaciones} hab — ${detSrc(url)}` : detSrc(url));
      const newId = compNextId++;
      comps.push({
        id: newId,
        desc: desc.substring(0, 80),
        url,
        source: detSrc(url),
        tipo: 'reformado',        // user will select this
        precio: parsed.precio || 0,
        m2: parsed.m2 || 0
      });
      const ppm = parsed.precio && parsed.m2 ? Math.round(parsed.precio / parsed.m2) : null;
      status.textContent = `✓ Extraído — ${parsed.precio ? parsed.precio.toLocaleString('es-ES')+' €' : '?'}  ·  ${parsed.m2 ? parsed.m2+' m²' : '?'}${ppm ? '  ·  '+ppm.toLocaleString('es-ES')+' €/m²' : ''}. Selecciona el estado del inmueble.`;
      status.style.color = 'var(--green)';
    }

    urlInput.value = '';
    renderCompInputs();
    renderCompOutput();

  } catch (err) {
    status.textContent = `⚠ Error al leer el enlace: ${err.message}. Añadido manualmente — rellena precio y m².`;
    status.style.color = 'var(--red)';
    comps.push({
      id: compNextId++, desc: url.substring(0,60), url,
      source: detSrc(url), tipo: 'reformado', precio: 0, m2: 0
    });
    renderCompInputs();
    renderCompOutput();
  } finally {
    extracting = false;
    btn.textContent = '✦ Extraer datos';
    btn.style.background = 'var(--gold)';
    btn.style.color = '#fff';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // URL input: Enter triggers extract, RW_COMP:: prefix triggers direct import
  const inp = $('comp-url-input');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') extractComp(); });
  if (inp) inp.addEventListener('paste', e => {
    setTimeout(() => {
      const v = inp.value.trim();
      if (handleRWCompPaste(v)) { inp.value = ''; }
    }, 50);
  });

  // Global paste: catch RW_COMP:: from anywhere on the page (e.g. after mobile bookmarklet)
  document.addEventListener('paste', e => {
    const text = e.clipboardData?.getData('text') || '';
    if (text.startsWith('RW_COMP::')) {
      handleRWCompPaste(text);
      e.preventDefault();
    }
  });

  // Init bookmarklet href
  initBookmarklet();
  loadAPIKey();
  // checkLocalhostRequired() — removed: API works directly from browser with anthropic-dangerous-direct-browser-access

  // Initial pricing engine render
  renderPricingEngine();
});

function detectSourceFromUrl(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('idealista'))  return 'Idealista';
  if (u.includes('fotocasa'))   return 'Fotocasa';
  if (u.includes('pisos.com'))  return 'Pisos.com';
  if (u.includes('habitaclia')) return 'Habitaclia';
  if (u.includes('kyero'))      return 'Kyero';
  if (u.includes('rightmove'))  return 'Rightmove';
  if (u.includes('yaencontré') || u.includes('yaencontre')) return 'Yaencontré';
  return null;
}

function renderCompInputs() {
  const container = $('comp-rows-input');
  if (!container) return;
  container.innerHTML = comps.map(c => {
    const ppm    = compPpm(c);
    const ppmStr = ppm ? `<span class="${tipoClass[c.tipo]}">${ppm.toLocaleString('es-ES')} €</span>` : '<span style="color:var(--text-d)">—</span>';
    const urlEl  = c.url ? `<a href="${c.url}" target="_blank" rel="noopener" class="comp-link" title="${c.url}">↗ ${c.source}</a>` : `<span style="font-size:9px;color:var(--text-d)">${c.source}</span>`;
    return `<div class="comp-row" id="ci-${c.id}">
      <div style="display:flex;flex-direction:column;gap:3px;min-width:0">
        <input type="text" value="${c.desc.replace(/"/g,'&quot;')}" placeholder="Descripción breve…"
          oninput="comps.find(x=>x.id===${c.id}).desc=this.value;renderCompOutput()"
          style="font-family:'Raleway',sans-serif;font-size:11px;padding:4px 7px">
        <input type="url" value="${(c.url||'').replace(/"/g,'&quot;')}" placeholder="Enlace anuncio (opcional)"
          oninput="(function(el){
            const url=el.value.trim();
            const comp=comps.find(x=>x.id===${c.id});
            if(!comp)return;
            comp.url=url;
            const detected=detectSourceFromUrl(url);
            if(detected){ comp.source=detected; }
          })(this)"
          style="font-family:'DM Mono',monospace;font-size:9px;padding:3px 7px;color:var(--text-d);border-color:var(--line2)">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0 2px">
          <span style="font-size:9px;color:var(--text-d)">${c.source || 'Manual'}</span>
          ${c.url ? `<a href="${c.url}" target="_blank" rel="noopener" style="font-size:9px;color:var(--gold);text-decoration:none;letter-spacing:0.06em">↗ abrir</a>` : ''}
        </div>
      </div>
      <div>
        <select class="tipo-select"
          style="font-family:'Raleway',sans-serif;font-size:10px;padding:5px 6px;width:100%;
                 background:var(--d4);border:1px solid var(--d6);outline:none;
                 color:${tipoColor[c.tipo]};font-weight:500"
          onchange="comps.find(x=>x.id===${c.id}).tipo=this.value;renderCompInputs();renderCompOutput()">
          <option value="reformar"  ${c.tipo==='reformar'  ?'selected':''}>A reformar</option>
          <option value="reformado" ${c.tipo==='reformado' ?'selected':''}>Reformado</option>
          <option value="estreno"   ${c.tipo==='estreno'   ?'selected':''}>Estreno</option>
        </select>
      </div>
      <div>
        <input type="text" data-fmt="money" value="${c.precio ? Math.round(c.precio).toLocaleString('es-ES') : ''}"
          placeholder="Precio €"
          onblur="comps.find(x=>x.id===${c.id}).precio=parseFloat(this.value.replace(/\\./g,'').replace(',','.'))||0;renderCompInputs();renderCompOutput()"
          style="text-align:right;${!c.precio?'border-color:var(--amber);':''}"
          title="${!c.precio?'Rellena el precio':''}">
      </div>
      <div>
        <input type="number" value="${c.m2||''}" placeholder="m²"
          oninput="comps.find(x=>x.id===${c.id}).m2=parseFloat(this.value)||0;renderCompInputs();renderCompOutput()"
          style="text-align:right;${!c.m2?'border-color:var(--amber);':''}"
          title="${!c.m2?'Rellena los m²':''}">
      </div>
      <div class="comp-ppm">${ppmStr}</div>
      <div>
        <button type="button" class="comp-del-btn" onclick="removeComp(${c.id})" title="Eliminar">×</button>
      </div>
    </div>`;
  }).join('') || `<div style="font-size:11px;color:var(--text-d);padding:12px 0;font-style:italic">Sin testigos aún. Pega un enlace arriba o usa "+ Añadir testigo manual".</div>`;
}

function addComp() {
  comps.push({ id: compNextId++, desc:'', url:'', source:'Manual', tipo:'reformado', precio:0, m2:0 });
  renderCompInputs();
  renderCompOutput();
}

function removeComp(id) {
  comps = comps.filter(c => c.id !== id);
  renderCompInputs();
  renderCompOutput();
}

function renderCompOutput() {
  renderPricingEngine();
  const el = $('comp-output');
  if (!el) return;

  const valid = comps.filter(c => compPpm(c) !== null);
  if (!valid.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text-d);font-style:italic">Añade testigos con precio y m² para ver el análisis.</div>';
    return;
  }

  // Group by tipo
  const byTipo = { reformar:[], reformado:[], estreno:[] };
  valid.forEach(c => byTipo[c.tipo].push(compPpm(c)));

  const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
  const minArr = arr => arr.length ? Math.min(...arr) : null;
  const maxArr = arr => arr.length ? Math.max(...arr) : null;

  const avgR  = avg(byTipo.reformar);
  const avgRR = avg(byTipo.reformado);
  const avgE  = avg(byTipo.estreno);

  const allPpm = valid.map(c => compPpm(c));
  const globalMin = Math.min(...allPpm);
  const globalMax = Math.max(...allPpm);

  // Suggested exit: weighted avg of reformado + estreno
  const sellable = [...byTipo.reformado, ...byTipo.estreno];
  const suggestedBase = avg(sellable) || avg(allPpm);
  const suggestedLow  = Math.round(suggestedBase * 0.93 / 500) * 500;
  const suggestedHigh = Math.round(suggestedBase * 1.02 / 500) * 500;

  // Summary strip
  const stripItems = [
    { lbl:`A reformar (${byTipo.reformar.length})`,  val:avgR,  cls:'comp-tipo-r',  sub:`${byTipo.reformar.length ? minArr(byTipo.reformar).toLocaleString('es-ES')+' – '+maxArr(byTipo.reformar).toLocaleString('es-ES')+' €/m²' : '—'}` },
    { lbl:`Reformado (${byTipo.reformado.length})`,  val:avgRR, cls:'comp-tipo-rr', sub:`${byTipo.reformado.length ? minArr(byTipo.reformado).toLocaleString('es-ES')+' – '+maxArr(byTipo.reformado).toLocaleString('es-ES')+' €/m²' : '—'}` },
    { lbl:`Estreno (${byTipo.estreno.length})`,      val:avgE,  cls:'comp-tipo-e',  sub:`${byTipo.estreno.length ? minArr(byTipo.estreno).toLocaleString('es-ES')+' – '+maxArr(byTipo.estreno).toLocaleString('es-ES')+' €/m²' : '—'}` },
  ];

  let html = `<div class="comp-out-strip">`;
  stripItems.forEach(it => {
    html += `<div class="comp-out-item">
      <div class="comp-out-lbl">${it.lbl}</div>
      <div class="comp-out-val ${it.cls}">${it.val ? it.val.toLocaleString('es-ES')+' €/m²' : '—'}</div>
      <div style="font-size:10.5px;color:var(--text-d);margin-top:3px">${it.sub}</div>
    </div>`;
  });
  html += `</div>`;

  // Detail table
  html += `<table class="comp-table">
    <thead><tr>
      <th style="width:36%">Testigo</th>
      <th>Fuente</th>
      <th>Estado</th>
      <th>Precio</th>
      <th>M²</th>
      <th>€/m²</th>
    </tr></thead>
    <tbody>`;

  // Sort by tipo then ppm desc
  const tipoOrder = { estreno:0, reformado:1, reformar:2 };
  [...valid].sort((a,b) => tipoOrder[a.tipo] - tipoOrder[b.tipo] || compPpm(b) - compPpm(a))
    .forEach(c => {
      const ppm = compPpm(c);
      const urlEl = c.url ? `<a href="${c.url}" target="_blank" rel="noopener">↗</a>` : '';
      html += `<tr>
        <td>${c.desc || '—'} ${urlEl}</td>
        <td style="color:var(--text-d)">${c.source}</td>
        <td class="${tipoClass[c.tipo]}">${tipoLabel[c.tipo]}</td>
        <td>${fmt(c.precio)}</td>
        <td>${c.m2} m²</td>
        <td class="${tipoClass[c.tipo]}" style="font-weight:500">${ppm.toLocaleString('es-ES')} €/m²</td>
      </tr>`;
    });

  // Averages row
  if (sellable.length) {
    html += `<tr class="comp-avg">
      <td colspan="5">Media testigos vendibles (reformado + estreno)</td>
      <td style="color:var(--green);font-weight:500">${suggestedBase.toLocaleString('es-ES')} €/m²</td>
    </tr>`;
  }
  html += `</tbody></table>`;

  // Dot scatter
  const dotMin = Math.max(0, globalMin * 0.95);
  const dotMax = globalMax * 1.05;
  const dotRange = dotMax - dotMin;

  html += `<div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-d);margin:20px 0 10px">Dispersión de testigos por precio/m²</div>`;
  html += `<div class="comp-range-bar">
    <div class="comp-bar-track">
      <div class="comp-bar-range" style="left:0%;width:100%"></div>
      ${valid.map(c => {
        const ppm = compPpm(c);
        const pct = dotRange > 0 ? ((ppm - dotMin) / dotRange * 100).toFixed(1) : 50;
        return `<div style="position:absolute;left:${pct}%;transform:translateX(-50%);top:-6px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${tipoColor[c.tipo]};border:2px solid var(--d3);title='${c.desc}: ${ppm.toLocaleString('es-ES')} €/m²'" title="${c.desc}: ${ppm.toLocaleString('es-ES')} €/m²"></div>
        </div>`;
      }).join('')}
    </div>
    <div class="comp-bar-markers" style="margin-top:18px">
      <span>${Math.round(dotMin).toLocaleString('es-ES')} €</span>
      <span>${Math.round((dotMin+dotMax)/2).toLocaleString('es-ES')} €</span>
      <span>${Math.round(dotMax).toLocaleString('es-ES')} €</span>
    </div>
  </div>`;

  // Suggestion box
  const exitBCurrent = V('exitB');
  const diff = exitBCurrent - suggestedBase;
  const diffPct = suggestedBase > 0 ? (diff / suggestedBase * 100).toFixed(1) : '—';
  const diffStr = diff > 0 ? `<span style="color:var(--green)">+${Math.abs(diffPct)}% por encima</span> de la media de testigos` :
                  diff < 0 ? `<span style="color:var(--red)">${Math.abs(diffPct)}% por debajo</span> de la media de testigos` :
                  `en línea con la media de testigos`;

  html += `<div class="comp-suggestion">
    <strong>Rango sugerido de precio de salida:</strong> ${suggestedLow.toLocaleString('es-ES')} – ${suggestedHigh.toLocaleString('es-ES')} €/m²
    <span style="font-size:10px;color:var(--text-d);margin-left:8px">(basado en media de reformados + estreno ± ajuste conservador)</span>
    <br><br>
    Tu escenario base actual (<strong>${exitBCurrent.toLocaleString('es-ES')} €/m²</strong>) está ${diffStr}.
    ${Math.abs(diff) > 1000 ? `<br><span style="font-size:10px;color:var(--amber)">⚠ La diferencia es &gt;1.000 €/m². Revisa si tus escenarios de salida están bien alineados con los comparables.</span>` : ''}
  </div>`;

  el.innerHTML = html;
}

// ══════════════════════════════════════════════════
// SENSITIVITY PRICE CONFIG
// ══════════════════════════════════════════════════
let sensPrices = [12000, 13000, 14000, 15000, 16000, 17000];
let sensActivePreset = 'madrid-centro';

const sensPresets = [
  { id:'madrid-centro',  label:'Madrid Centro',    prices:[12000,13000,14000,15000,16000,17000] },
  { id:'madrid-prime',   label:'Madrid Prime',      prices:[14000,15000,16000,17000,18000,19000] },
  { id:'madrid-barrio',  label:'Madrid Barrios',    prices:[5000,6000,7000,8000,9000,10000] },
  { id:'malaga-centro',  label:'Málaga Centro',     prices:[5000,6000,7000,8000,9000,10000] },
  { id:'malaga-prime',   label:'Málaga Prime',      prices:[7000,8000,9000,10000,11000,12000] },
  { id:'barcelona',      label:'Barcelona',         prices:[8000,9000,10000,11000,12000,13000] },
  { id:'custom',         label:'Personalizado',     prices:null },
];

function applySensPreset(id) {
  const preset = sensPresets.find(p => p.id === id);
  if (!preset) return;
  sensActivePreset = id;
  if (preset.prices) {
    sensPrices = [...preset.prices];
  }
  renderSensPriceConfig();
  update();
}

function updateSensPrice(idx, val) {
  const v = parseInt(val) || 0;
  sensPrices[idx] = v;
  sensActivePreset = 'custom';
  renderSensPriceConfig();
  update();
}

function renderSensPriceConfig() {
  // Presets
  const presetsEl = $('sens-presets');
  if (presetsEl) {
    presetsEl.innerHTML = sensPresets.map(p =>
      `<button class="sens-preset-btn${sensActivePreset===p.id?' active':''}"
        onclick="applySensPreset('${p.id}')">${p.label}</button>`
    ).join('');
  }

  // Price inputs
  const inputsEl = $('sens-price-inputs');
  if (inputsEl) {
    inputsEl.innerHTML = sensPrices.map((p, i) =>
      `<div class="sens-price-inp">
        <label>Col. ${i+1}</label>
        <input type="number" value="${p}" step="500"
          onchange="updateSensPrice(${i}, this.value)"
          oninput="updateSensPrice(${i}, this.value)">
      </div>`
    ).join('');
  }

  // Preview
  const prevEl = $('sens-price-preview');
  if (prevEl) {
    const sorted = [...sensPrices].sort((a,b)=>a-b);
    const isSorted = sensPrices.every((v,i) => i===0 || v >= sensPrices[i-1]);
    prevEl.innerHTML = `
      <span style="color:${isSorted?'var(--green)':'var(--amber)'}">
        ${isSorted ? '✓' : '⚠ Reordena de menor a mayor →'}
      </span>
      ${sensPrices.map(p=>`<span style="font-family:'DM Mono',monospace;color:var(--gold-l)">${p.toLocaleString('es-ES')} €</span>`).join(' · ')}`;
  }
}

// ══════════════════════════════════════════════════
// NOTARÍA — Arancel RD 1426/1989 (escala progresiva)
// ══════════════════════════════════════════════════
function calcArancel(valor) {
  // Escala de honorarios por valor escriturado (RD 1426/1989, Número 2)
  const tramos = [
    { hasta: 6010.12,    base: 90.15,    rate: 0 },
    { hasta: 30050.61,   base: 90.15,    rate: 45.07  / 1000 },
    { hasta: 60101.21,   base: 90.15 + (30050.61-6010.12)*45.07/1000,    rate: 30.05/1000 },
    { hasta: 150253.03,  base: null,     rate: 19.23/1000 },
    { hasta: 601012.10,  base: null,     rate: 9.02/1000  },
    { hasta: Infinity,   base: null,     rate: 4.51/1000  },
  ];

  // Recalculate cumulative bases properly
  const limits   = [0, 6010.12, 30050.61, 60101.21, 150253.03, 601012.10];
  const rates    = [0, 45.07/1000, 30.05/1000, 19.23/1000, 9.02/1000, 4.51/1000];
  const firstFee = 90.15; // flat fee for first tramo

  let fee = 0;
  if (valor <= 0) return 0;

  // First tramo: flat
  if (valor <= limits[1]) return firstFee;
  fee = firstFee;

  for (let i = 1; i < limits.length - 1; i++) {
    const from = limits[i];
    const to   = limits[i + 1] || Infinity;
    if (valor <= from) break;
    const tramo = Math.min(valor, to) - from;
    fee += tramo * rates[i];
    if (valor <= to) break;
  }

  // Minimum fee
  fee = Math.max(fee, 90.15);

  // Add registro de la propiedad estimate (~60% of notary fee, typical)
  const registro = fee * 0.55;

  return { notario: Math.round(fee), registro: Math.round(registro), total: Math.round(fee + registro) };
}

// ══════════════════════════════════════════════════
// PLUSVALÍA — RDL 26/2021 (reforma art. 107 LHL)
// Método objetivo vs real — paga el menor
// ══════════════════════════════════════════════════
function calcPlusvalia(precioCompra, precioVenta, vcTotal, vcSuelo, anyoAdquisicion, anyoVenta, tipoImpositivo) {
  if (!vcSuelo || vcSuelo <= 0) return null;

  // Años de tenencia (del vendedor actual, no de Riverwalk)
  const anos = Math.max(0, anyoVenta - anyoAdquisicion);

  // ── Método objetivo (RDL 26/2021, coeficientes aprobados en PGE) ──────
  // Coeficientes máximos aprobados para 2024 (Ley PGE o similar)
  const coeficientes = {
    0: 0.14,   1: 0.13,   2: 0.15,   3: 0.16,   4: 0.17,
    5: 0.17,   6: 0.16,   7: 0.12,   8: 0.10,   9: 0.09,
    10: 0.08, 11: 0.08,  12: 0.08,  13: 0.08,  14: 0.10,
    15: 0.12, 16: 0.16,  17: 0.20,  18: 0.26,  19: 0.36,
  };
  const coef = coeficientes[Math.min(anos, 19)] ?? 0.45; // ≥20 años → 0.45
  const baseObjetivo = vcSuelo * coef;
  const cuotaObjetivo = baseObjetivo * (tipoImpositivo / 100);

  // ── Método real (proporción del suelo sobre ganancia real) ─────────────
  // Solo aplica si hay ganancia real (precio venta > precio compra)
  let cuotaReal = Infinity;
  let baseReal  = 0;
  if (precioVenta > precioCompra && vcTotal > 0) {
    const gananciaReal = precioVenta - precioCompra;
    const pctSuelo     = vcSuelo / vcTotal; // proporción del suelo
    baseReal           = gananciaReal * pctSuelo;
    cuotaReal          = baseReal * (tipoImpositivo / 100);
  }

  // Paga el menor de los dos
  const usaObjetivo = cuotaObjetivo <= cuotaReal;
  const cuotaFinal  = usaObjetivo ? cuotaObjetivo : cuotaReal;

  return {
    anos, coef,
    baseObjetivo: Math.round(baseObjetivo), cuotaObjetivo: Math.round(cuotaObjetivo),
    baseReal: Math.round(baseReal), cuotaReal: cuotaReal === Infinity ? null : Math.round(cuotaReal),
    usaObjetivo, cuotaFinal: Math.round(cuotaFinal)
  };
}

function renderNotariaCompra(buyPrice) {
  const nc = calcArancel(buyPrice);
  const nd = $('notaria-calc-display');
  if (nd && nc) {
    nd.innerHTML = `Arancel notario: <strong>${nc.notario.toLocaleString('es-ES')} €</strong> &nbsp;·&nbsp;
      Registro est.: <strong>${nc.registro.toLocaleString('es-ES')} €</strong> &nbsp;·&nbsp;
      <strong style="color:var(--gold)">Total: ${nc.total.toLocaleString('es-ES')} €</strong>
      <br><span style="color:var(--text-d);font-size:9px">Arancel RD 1426/1989 · escala progresiva sobre ${buyPrice.toLocaleString('es-ES')} €</span>`;
    if (V('notariaAjuste') === 0) {
      const el = $('notaria');
      if (el && !el.dataset.manualOverride) el.value = nc.total.toLocaleString('es-ES');
    }
  }
}

// ══════════════════════════════════════════════════
// INVESTMENT BREAKDOWN
// ══════════════════════════════════════════════════
let invBreakdownOpen = false;

function toggleInvBreakdown() {
  invBreakdownOpen = !invBreakdownOpen;
  const det = $('inv-breakdown-detail');
  const arr = $('inv-breakdown-arr');
  if (det) det.style.display = invBreakdownOpen ? 'block' : 'none';
  if (arr) arr.style.transform = invBreakdownOpen ? 'rotate(180deg)' : '';
}

function renderInvBreakdown(m) {
  const total  = m.totalInvest;
  if (!total) return;
  const isPase = m.dealMode === 'pase';
  const isLev  = (m.ltvPct || 0) > 0;
  const loanBase = levMode === 'ltc' ? total : m.buyPrice;
  const loan   = isLev ? loanBase * m.ltvPct : 0;
  const equity = total - loan;

  const partidas = [
    { lbl:'Precio compra',   val: m.buyPrice,      color:'#5B8FE0' },
    { lbl:'ITP',             val: m.itp,            color:'#7B8FD0' },
    { lbl:'Notaría',         val: m.notaria,        color:'#9090C0' },
    ...(!isPase ? [
      { lbl:'CapEx',         val: m.capexNet,       color:'#E0963A' },
      { lbl:'IVA soportado', val: m.ivaCapex,       color:'#C87A20' },
    ] : []),
    { lbl:'Mgmt fee',        val: m.mgmtFee,        color:'#C4975A' },
    { lbl:'IVA fees',        val: m.ivaFees,        color:'#A07840' },
    ...(m.intermediaryFee > 0 ? [
      { lbl: S('intermediaryDesc')?.substring(0,18) || 'Fee terceros', val: m.intermediaryFee, color:'#9090A0' }
    ] : []),
    ...(m.brokerBuyFee > 0 ? [
      { lbl:'Broker compra', val: m.brokerBuyFee,   color:'#8090B0' }
    ] : []),
    ...(m.comunidadTotal + m.ibiTotal > 0 ? [
      { lbl:'Comunidad + IBI', val: m.comunidadTotal + m.ibiTotal, color:'#708090' }
    ] : []),
  ].filter(p => p.val > 0);

  // ── SUMMARY BAR ────────────────────────────────────
  const barsEl = $('inv-breakdown-bars');
  if (barsEl) {
    barsEl.innerHTML = partidas.map(p =>
      `<div style="flex:${p.val/total};background:${p.color};min-width:2px" title="${p.lbl}: ${fmt(p.val)}"></div>`
    ).join('') + (isLev ? `
      <div style="flex:0 0 3px;background:rgba(255,255,255,0.4)"></div>
      <div style="flex:${loan/total};background:rgba(139,105,20,0.35);min-width:4px" title="Deuda financiada: ${fmt(loan)}"></div>
    ` : '');
  }

  // ── LEGEND ─────────────────────────────────────────
  const legEl = $('inv-breakdown-legend');
  if (legEl) {
    const items = isLev
      ? [
          { lbl: 'Equity inversor', color: '#5B8FE0',         val: equity },
          { lbl: 'Deuda bridge',    color: 'rgba(139,105,20,0.6)', val: loan },
          { lbl: 'Total proyecto',  color: 'var(--text-d)',    val: total  },
        ]
      : partidas.slice(0, 4);
    legEl.innerHTML = items.map(p =>
      `<div style="display:flex;align-items:center;gap:5px;font-size:9.5px;color:var(--text-d)">
        <div style="width:9px;height:9px;border-radius:1px;background:${p.color};flex-shrink:0"></div>
        ${p.lbl} <span style="font-family:'DM Mono',monospace;color:var(--text);font-feature-settings:'tnum' 1">${fmt(p.val)}</span>
      </div>`
    ).join('');
  }

  // ── DETAIL GRID ────────────────────────────────────
  const gridEl = $('inv-breakdown-grid');
  if (!gridEl) return;

  // Investor equity block when leveraged
  let equityBlock = '';
  if (isLev) {
    // per-scenario returns on equity
    function levScLocal(sc) {
      const rate     = m.ltvPct > 0.5 ? V('bridgeRate')/100 + 0.005 : V('bridgeRate')/100;
      const interest = loan * rate * V('bridgeMonths') / 12;
      const afterInt = sc.afterSF !== undefined ? sc.afterSF - interest : (sc.netProfit + (taxOn ? sc.tax : 0)) - interest;
      const tax      = Math.max(0, afterInt) * (taxOn ? V('taxRate')/100 : 0);
      const netLev   = afterInt - tax;
      const roe      = equity > 0 ? netLev / equity : 0;
      const moic     = equity > 0 ? (equity + netLev) / equity : 1;
      return { netLev, roe, moic, interest };
    }
    const lPess = levScLocal(m.pess);
    const lBase = levScLocal(m.base);
    const lOpt  = levScLocal(m.opt);

    const scRow = (label, lev, cls) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--line2);gap:8px">
        <span style="font-size:10.5px;color:var(--text-d);min-width:70px">${label}</span>
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-d);font-feature-settings:'tnum' 1">${fmt(lev.netLev)}</span>
        <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:${cls};font-feature-settings:'tnum' 1;min-width:52px;text-align:right">${fmtPct(lev.roe)}</span>
        <span style="font-family:'DM Mono',monospace;font-size:10.5px;color:${cls};min-width:42px;text-align:right">${lev.moic.toFixed(2)}×</span>
      </div>`;

    equityBlock = `
    <div style="background:var(--d2);border:1px solid rgba(139,105,20,0.3);margin-bottom:1px;padding:0">

      <!-- HERO: capital requerido -->
      <div style="background:linear-gradient(135deg,var(--d4),var(--d3));padding:20px 22px;border-bottom:1px solid var(--line)">
        <div style="font-size:8.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;font-weight:600">Capital requerido por el inversor</div>
        <div style="display:flex;align-items:flex-end;gap:24px;flex-wrap:wrap">
          <div>
            <div style="font-family:'DM Mono',monospace;font-size:32px;color:var(--text-b);letter-spacing:-0.02em;line-height:1;font-feature-settings:'tnum' 1">${fmt(equity)}</div>
            <div style="font-size:10px;color:var(--text-d);margin-top:5px">Equity · ${(equity/total*100).toFixed(0)}% del coste total</div>
          </div>
          <div style="border-left:1px solid var(--line);padding-left:24px">
            <div style="font-family:'DM Mono',monospace;font-size:18px;color:var(--text-d);line-height:1;font-feature-settings:'tnum' 1">${fmt(loan)}</div>
            <div style="font-size:10px;color:var(--text-d);margin-top:5px">Deuda ${levMode.toUpperCase()} ${(m.ltvPct*100).toFixed(0)}% · ${V('bridgeRate')}% anual</div>
          </div>
          <div style="border-left:1px solid var(--line);padding-left:24px">
            <div style="font-family:'DM Mono',monospace;font-size:18px;color:var(--text-d);line-height:1;font-feature-settings:'tnum' 1">${fmt(total)}</div>
            <div style="font-size:10px;color:var(--text-d);margin-top:5px">Coste total del proyecto</div>
          </div>
        </div>
      </div>

      <!-- RETORNO POR ESCENARIO SOBRE EL EQUITY -->
      <div style="padding:16px 22px">
        <div style="font-size:8.5px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-d);margin-bottom:10px;font-weight:500">Rentabilidad proyectada sobre capital invertido</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0 0 5px;border-bottom:1px solid var(--line);gap:8px;margin-bottom:2px">
          <span style="font-size:9px;color:var(--text-d);min-width:70px;font-weight:500">Escenario</span>
          <span style="font-size:9px;color:var(--text-d)">Beneficio neto</span>
          <span style="font-size:9px;color:var(--text-d);min-width:52px;text-align:right">ROE</span>
          <span style="font-size:9px;color:var(--text-d);min-width:42px;text-align:right">MOIC</span>
        </div>
        ${scRow('Pesimista', lPess, 'var(--red)')}
        ${scRow('Base case', lBase, 'var(--amber)')}
        ${scRow('Optimista', lOpt, 'var(--green)')}
        <div style="font-size:9.5px;color:var(--text-d);margin-top:10px;line-height:1.65;padding:8px 10px;background:rgba(139,105,20,0.05);border-left:2px solid var(--gold)">
          ROE = rentabilidad sobre el equity desplegado (${fmt(equity)}) · coste financiero: ${fmt(lBase.interest)} · plazo bridge: ${V('bridgeMonths')} meses
        </div>
      </div>
    </div>`;
  }

  // Partidas grid
  gridEl.innerHTML = equityBlock +
    `<div class="inv-grid">` +
    partidas.map(p => {
      const pct = (p.val / total * 100).toFixed(1);
      return `<div class="inv-item">
        <div class="inv-item-lbl">${p.lbl}</div>
        <div class="inv-item-val">${fmt(p.val)}</div>
        <div class="inv-item-pct">${pct}% del total</div>
        <div class="inv-item-bar" style="background:${p.color};width:${pct}%"></div>
      </div>`;
    }).join('') +
    `<div class="inv-item" style="background:var(--d4)">
      <div class="inv-item-lbl">TOTAL PROYECTO</div>
      <div class="inv-item-val" style="color:var(--gold)">${fmt(total)}</div>
      <div class="inv-item-pct">100%</div>
      <div class="inv-item-bar" style="background:var(--gold);width:100%"></div>
    </div>` +
    (isLev ? `<div class="inv-item" style="background:var(--d2);border:1px solid rgba(139,105,20,0.2)">
      <div class="inv-item-lbl" style="color:var(--gold)">EQUITY INVERSOR</div>
      <div class="inv-item-val" style="color:var(--text-b);font-size:16px">${fmt(equity)}</div>
      <div class="inv-item-pct">${(equity/total*100).toFixed(0)}% del total</div>
      <div class="inv-item-bar" style="background:var(--gold);width:${(equity/total*100).toFixed(0)}%"></div>
    </div>` : '') +
    `</div>`;
}

// ══════════════════════════════════════════════════
// MAIN UPDATE
// ══════════════════════════════════════════════════
function update() {
  try {
    // Auto-calculate notaría compra
    const buyPrice    = V('buyPrice');
    renderNotariaCompra(buyPrice);

    const m = calc();
    render(m);
    renderInvBreakdown(m);
    renderCarryEngine(m);
    renderCashflow(m);
    // Keep active deal snapshot current + sync tab label
    if (deals.length) {
      const n = $('dealName')?.value?.trim();
      if (n && deals[activeDealIdx]) {
        deals[activeDealIdx].name = n.substring(0,28);
        // Update tab label without full re-render to avoid focus loss
        const tabEl = document.querySelector(`.tab-item[data-idx="${activeDealIdx}"] .tab-name`);
        if (tabEl && !tabEl.querySelector('input')) tabEl.textContent = deals[activeDealIdx].name;
      }
    }
  } catch(e) { console.error('update error:', e); }
}

// ══════════════════════════════════════════════════
// EXPORT COPY
// ══════════════════════════════════════════════════
function copyExport() {
  navigator.clipboard.writeText($('export-brief').textContent).then(() => {
    const b = document.querySelector('.btn.primary');
    const o = b.textContent;
    b.textContent = '✓ Copiado';
    b.style.background = 'var(--green)';
    setTimeout(()=>{ b.textContent=o; b.style.background=''; }, 2000);
  });
}

// ══════════════════════════════════════════════════
// RESET
// ══════════════════════════════════════════════════
function resetForm() {
  const defs = {
    cfDateArras:'',cfDateEscritura:'',cfDateCert50:'',cfDateCert70:'',cfDateEntrega:'',cfDateVenta:'',
    dealName:'Nuevo activo',dealAddress:'',dealCP:'',dealMunicipio:'Madrid',
    dealFloor:'',dealPuerta:'',dealCatastro:'',
    surfCapex:236,
    arasAmt:100000,arasPct:10,arasMonths:2,monthsSale:12,
    buyPrice:1000000,itpPct:2,notaria:3000,comunidad:290,ibi:0,
    intermediaryFee:0,intermediaryDesc:'',
    obraM2:1800,decoM2:400,zcCost:0,zcDesc:'Rehabilitación portal / zonas comunes',
    ivaObra:21,
    finderFeePct:0,finderMonths:0,mgmtFeePct:4,mgmtSlider:4,
    brokerBuyPct:0,brokerBuyFixed:0,
    sf1T:12.5,sf2T:25,sf0P:0,sf1P:30,sf2P:50,sfFijoPct:30,
    exitP:13000,exitB:15000,exitO:17000,
    brokerExit:3,exitFixed:15000,
    ltv:0,ltvSlider:0,bridgeRate:5,bridgeMonths:14,
    overPct:0,overSlider:0,taxRate:25
  };
  Object.entries(defs).forEach(([k,v])=>{ const el=$(k); if(el)el.value=v; });
  $('ltvSlider-rv').textContent = '0% — Sin apalancamiento';
  $('overSlider-rv').textContent = '0% — Sin provisión';
  $('mgmtSlider-rv').textContent = '4.0% sobre precio + CapEx neto';
  sfMode='tramos'; setSFMode('tramos');
  zcOn=false; toggleZC(false);
  update();
}

// ══════════════════════════════════════════════════
// TABS — MULTI-DEAL
// ══════════════════════════════════════════════════

// All field IDs that represent deal-specific values
const DEAL_FIELDS = [
  'dealName','dealAddress','dealCP','dealMunicipio','dealFloor','dealPuerta','dealCatastro',
  'surfCapex',
  'exitP','exitB','exitO','brokerExit','exitFixed',
  'arasAmt','arasPct','arasMonths','monthsToSale',
  'cfDateArras','cfDateEscritura','cfDateCert50','cfDateCert70','cfDateEntrega','cfDateVenta',
  'cfDateAmpliacion','cfDateEscrituraAmp','ampliacionPct',
  'buyPrice','itpPct','notaria','comunidad','ibi',
  'brokerBuyPct','brokerBuyFixed','intermediaryFee','intermediaryDesc',
  'obraM2','decoM2','overPct','overSlider','zcCost','zcDesc','ivaObra',
  'mgmtFeePct','mgmtSlider',
  'sf1T','sf2T','sf0P','sf1P','sf2P','sfFijoPct',
  'paseCarryPct','paseCarryIVA','paseMgmtPct','paseMgmtSlider',
  'ltv','ltvSlider','bridgeRate','bridgeMonths',
  'taxRate','taxStructure',
  'ampliacionMeses','ampliacionPctCal',
  'cfDateAmpliacion','cfDateEscrituraAmp',
  // vcTotal, vcSuelo, vcAnyoAdq, plusvaliaTipo removed (plusvalia simplified)
  'notariaAjuste','exitFixedAjuste'
];

const DEAL_STATES = [
  'sfMode','sfCarryMode','zcOn'
];

let deals = [];        // array of { name, fields:{}, states:{}, comps:[], sensPrices:[] }
let activeDealIdx = 0;
let projects = [];          // [{id, name}]
let projectIdCounter = 1;
let activeConsolProjId = null;

function captureCurrentDeal() {
  const fields = {};
  DEAL_FIELDS.forEach(id => {
    const el = $(id);
    if (el) fields[id] = el.value;
  });
  const states = { sfMode, sfCarryMode, zcOn, dealMode, ampliacionOn, taxOn, plusvaliaOn, levMode, sensPrices: [...sensPrices] };
  saveDossierNarrative();
  const dossier = JSON.parse(JSON.stringify(getCurrentDossier()));
  return { fields, states, comps: JSON.parse(JSON.stringify(comps)), dossier };
}

function applyDeal(deal) {
  // Restore dossier data first
  if (deal.dossier) {
    deals[activeDealIdx].dossier = JSON.parse(JSON.stringify(deal.dossier));
  } else {
    if (!deals[activeDealIdx].dossier) deals[activeDealIdx].dossier = { photos:[], plans:[], materials:[], narrative:{activo:'',zona:'',mercado:'',proyecto:'',tesis:''}, mapDataUrl:'', mapLat:null, mapLng:null };
  }
  loadDossierToForm();
  // Fields
  DEAL_FIELDS.forEach(id => {
    const el = $(id);
    if (el && deal.fields[id] !== undefined) el.value = deal.fields[id];
  });
  // States
  if (deal.states) {
    if (deal.states.sfMode !== undefined)       setSFMode(deal.states.sfMode);
    if (deal.states.sfCarryMode !== undefined)  setCarryMode(deal.states.sfCarryMode);
    if (deal.states.zcOn !== undefined)         toggleZC(deal.states.zcOn);
    if (deal.states.dealMode !== undefined)     setDealMode(deal.states.dealMode);
    if (deal.states.ampliacionOn !== undefined) setAmpliacion(deal.states.ampliacionOn);
    if (deal.states.taxOn !== undefined)        setTaxMode(deal.states.taxOn);
    if (deal.states.plusvaliaOn !== undefined)  setPlusvaliaMode(deal.states.plusvaliaOn);
    if (deal.states.levMode !== undefined)      setLevMode(deal.states.levMode);
    if (deal.states.sensPrices)                { sensPrices = [...deal.states.sensPrices]; renderSensPriceConfig(); }
  }
  // Comps
  if (deal.comps) {
    comps = JSON.parse(JSON.stringify(deal.comps));
    renderCompInputs();
    renderCompOutput();
  }
  // Refresh slider labels
  const ltvVal = parseInt($('ltvSlider')?.value || 0);
  const ltvLabels = {0:'0% — Sin apalancamiento',10:'10%',20:'20%',30:'30%',40:'40% — Moderado',50:'50%',60:'60% — Elevado',70:'70%'};
  if ($('ltvSlider-rv')) $('ltvSlider-rv').textContent = ltvLabels[ltvVal] || ltvVal+'%';
  const overVal = parseInt($('overSlider')?.value || 0);
  const overLabels = {0:'0% — Sin provisión',5:'5%',10:'10%',15:'15%',20:'20% — Recomendado',25:'25%',30:'30%',35:'35%',40:'40%'};
  if ($('overSlider-rv')) $('overSlider-rv').textContent = overLabels[overVal] || overVal+'%';
  const mgmtVal = parseFloat($('mgmtSlider')?.value || 4);
  if ($('mgmtSlider-rv')) $('mgmtSlider-rv').textContent = mgmtVal.toFixed(1)+'% sobre precio + CapEx neto';
  setupMoneyInputs();
}

function saveDealSnapshot() {
  if (!deals.length) return;
  const snap = captureCurrentDeal();
  deals[activeDealIdx].fields  = snap.fields;
  deals[activeDealIdx].states  = snap.states;
  deals[activeDealIdx].comps   = snap.comps;
  // Sync name from dealName field
  const n = $('dealName')?.value;
  if (n) deals[activeDealIdx].name = n.substring(0,28) || `Deal ${activeDealIdx+1}`;
}

function switchTab(idx) {
  // Always restore normal layout first (in case we were in consolidado view)
  const ip = document.querySelector('.input-panel');
  const op = document.querySelector('.output-panel');
  const cv = $('consol-view');
  const layout = document.querySelector('.layout');
  if (ip) ip.style.display = '';
  if (op) op.style.display = '';
  if (cv) cv.classList.remove('active');
  if (layout) layout.style.gridTemplateColumns = '';
  activeConsolProjId = null;

  if (idx === activeDealIdx) { renderTabs(); return; }
  saveDealSnapshot();
  activeDealIdx = idx;
  applyDeal(deals[idx]);
  renderTabs();
  update();
}

function addDeal(name) {
  // Exit consolidado view if active
  const ip = document.querySelector('.input-panel');
  const op = document.querySelector('.output-panel');
  const cv = $('consol-view');
  const layout = document.querySelector('.layout');
  if (ip) ip.style.display = '';
  if (op) op.style.display = '';
  if (cv) cv.classList.remove('active');
  if (layout) layout.style.gridTemplateColumns = '';
  activeConsolProjId = null;

  saveDealSnapshot();
  const newDeal = {
    name: name || `Deal ${deals.length+1}`,
    fields: {}, states: { sfMode:'tramos', sfCarryMode:'roi', zcOn:false, dealMode:'reforma', ampliacionOn:false, taxOn:true, plusvaliaOn:false, levMode:'ltv', sensPrices:[12000,13000,14000,15000,16000,17000] },
    comps: []
  };
  // Defaults
  const defaults = {
    dealName:newDeal.name, dealAddress:'', dealCP:'', dealMunicipio:'Madrid',
    dealFloor:'', dealPuerta:'', dealCatastro:'',
    surfCapex:236,
    exitP:13000, exitB:15000, exitO:17000, brokerExit:3, exitFixed:8000, exitFixedAjuste:0,
    arasAmt:100000, arasPct:10, arasMonths:2, monthsToSale:12,
    cfDateArras:'', cfDateEscritura:'', cfDateCert50:'', cfDateCert70:'', cfDateEntrega:'', cfDateVenta:'',
    buyPrice:1000000, itpPct:2, notaria:3000, comunidad:290, ibi:0,
    brokerBuyPct:0, brokerBuyFixed:0, intermediaryFee:0, intermediaryDesc:'',
    obraM2:1800, decoM2:400, overPct:0, overSlider:0, zcCost:0, zcDesc:'Rehabilitación portal / zonas comunes', ivaObra:21,
    mgmtFeePct:4, mgmtSlider:4,
    sf1T:12.5, sf2T:25, sf0P:0, sf1P:30, sf2P:50, sfFijoPct:30,
    paseCarryPct:30, paseCarryIVA:21,
    ltv:0, ltvSlider:0, bridgeRate:5, bridgeMonths:14,
    taxRate:25, taxStructure:'sl'
  };
  DEAL_FIELDS.forEach(id => { newDeal.fields[id] = defaults[id] !== undefined ? String(defaults[id]) : ''; });
  deals.push(newDeal);
  activeDealIdx = deals.length - 1;
  applyDeal(newDeal);
  renderTabs();
  update();
}

function removeDeal(idx, e) {
  e.stopPropagation();
  if (deals.length <= 1) return;
  deals.splice(idx, 1);
  if (activeDealIdx >= deals.length) activeDealIdx = deals.length - 1;
  activeConsolProjId = null;
  const ip = document.querySelector('.input-panel');
  const op = document.querySelector('.output-panel');
  const cv = $('consol-view');
  const layout = document.querySelector('.layout');
  if (ip) ip.style.display = '';
  if (op) op.style.display = '';
  if (cv) cv.classList.remove('active');
  if (layout) layout.style.gridTemplateColumns = '';
  applyDeal(deals[activeDealIdx]);
  renderTabs();
  update();
}

function startRenameTab(idx, e) {
  e.stopPropagation();
  const tabEl = document.querySelector(`.tab-item[data-idx="${idx}"]`);
  if (!tabEl) return;
  const nameEl = tabEl.querySelector('.tab-name');
  const current = deals[idx].name;
  nameEl.innerHTML = `<input class="tab-name-input" value="${current.replace(/"/g,'&quot;')}"
    onblur="finishRename(${idx},this)"
    onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){this.value='${current}';this.blur();}"
    onclick="event.stopPropagation()">`;
  const inp = nameEl.querySelector('input');
  inp.focus(); inp.select();
}

function finishRename(idx, inp) {
  const val = inp.value.trim() || deals[idx].name;
  deals[idx].name = val.substring(0,28);
  if (idx === activeDealIdx && $('dealName')) $('dealName').value = val;
  renderTabs();
}

function renderTabs() {
  const bar = $('tabs-bar');
  if (!bar) return;

  const standalones = deals.map((d, i) => ({ d, i })).filter(x => !x.d.projectId);
  const projGroups  = {};
  deals.forEach((d, i) => {
    if (d.projectId) {
      if (!projGroups[d.projectId]) projGroups[d.projectId] = [];
      projGroups[d.projectId].push({ d, i });
    }
  });

  let html = '';
  standalones.forEach(({ d, i }) => {
    const isActive = i === activeDealIdx && !activeConsolProjId;
    html += `<div class="tab-item${isActive ? ' active' : ''}" data-idx="${i}"
      onclick="switchTab(${i})" ondblclick="startRenameTab(${i},event)">
      <span class="tab-name">${d.name}</span>
      ${deals.length > 1 ? `<button class="tab-close" onclick="removeDeal(${i},event)">×</button>` : ''}
    </div>`;
  });

  Object.entries(projGroups).forEach(([projId, units]) => {
    const proj = projects.find(p => p.id === projId);
    if (!proj) return;
    const isConsolActive = activeConsolProjId === projId;
    html += `<div class="proj-group">
      <div class="proj-label" ondblclick="renameProject('${projId}',event)">🏢 ${proj.name}</div>`;
    units.forEach(({ d, i }) => {
      const isActive = i === activeDealIdx && !activeConsolProjId;
      html += `<div class="tab-item${isActive ? ' active' : ''}" data-idx="${i}"
        onclick="exitConsol();switchTab(${i})" ondblclick="startRenameTab(${i},event)">
        <span class="tab-name">${d.name}</span>
        <button class="tab-close" onclick="removeDealFromProject(${i},event)">×</button>
      </div>`;
    });
    html += `<div class="tab-item" style="color:var(--gold);opacity:0.8;font-size:16px;padding:0 8px" onclick="addUnitPrompt('${projId}')" title="Añadir unidad">+</div>`;
    html += `<div class="tab-item tab-consol${isConsolActive ? ' active' : ''}" onclick="switchToConsol('${projId}')">📊 Consolidado</div>`;
    html += `</div>`;
  });

  html += `<button class="tab-add" onclick="addDeal()" title="Nueva operación">+</button>`;
  html += `<button class="tab-add" onclick="promptNewProject()" title="Nuevo proyecto multi-unidad" style="font-size:14px">🏢</button>`;
  bar.innerHTML = html;
}

function renameProject(projId, e) {
  e.stopPropagation();
  const proj = projects.find(p => p.id === projId);
  if (!proj) return;
  const name = window.prompt('Nombre del proyecto:', proj.name);
  if (name !== null && name.trim()) { proj.name = name.trim(); renderTabs(); }
}

function removeDealFromProject(idx, e) {
  e.stopPropagation();
  const projId = deals[idx].projectId;
  deals.splice(idx, 1);
  // If project now empty, remove it
  if (projId && !deals.some(d => d.projectId === projId)) {
    const pi = projects.findIndex(p => p.id === projId);
    if (pi !== -1) projects.splice(pi, 1);
  }
  if (activeDealIdx >= deals.length) activeDealIdx = deals.length - 1;
  activeConsolProjId = null;
  exitConsol();
  applyDeal(deals[activeDealIdx]);
  renderTabs();
  update();
}

// ══════════════════════════════════════════════════
// EDIFICIO MODE
// ══════════════════════════════════════════════════
let edificioUnits = [
  { id:1, name:'Piso 1º A', m2:80, pm2:0, capexOverride:null, isAmenity:false },
  { id:2, name:'Piso 2º B', m2:75, pm2:0, capexOverride:null, isAmenity:false },
  { id:3, name:'Ático',     m2:90, pm2:0, capexOverride:null, isAmenity:false },
];
let edifUnitId = 4;

function addEdificioUnit() {
  edificioUnits.push({ id:edifUnitId++, name:`Unidad ${edificioUnits.length+1}`, m2:70, pm2:0, capexOverride:null, isAmenity:false });
  renderEdificioUnits();
  updateEdificio();
}

function removeEdificioUnit(id) {
  edificioUnits = edificioUnits.filter(u => u.id !== id);
  renderEdificioUnits();
  updateEdificio();
}

function renderEdificioUnits() {
  const el = $('edificio-units-rows');
  if (!el) return;
  el.innerHTML = edificioUnits.map(u => `
    <div class="eu-row" id="eu-row-${u.id}">
      <input type="text" value="${u.name}" oninput="edificioUnits.find(x=>x.id===${u.id}).name=this.value;updateEdificio()"
        style="background:var(--d4);border:1px solid var(--d6);color:var(--text-b);font-size:11px;padding:4px 7px;width:100%">
      <input type="number" value="${u.m2}" oninput="edificioUnits.find(x=>x.id===${u.id}).m2=parseFloat(this.value)||0;updateEdificio()"
        style="text-align:center;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);font-size:11px;padding:4px 6px;width:100%">
      <input type="number" value="${u.pm2||''}" placeholder="auto" oninput="edificioUnits.find(x=>x.id===${u.id}).pm2=parseFloat(this.value)||0;updateEdificio()"
        style="text-align:right;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);font-size:11px;padding:4px 6px;width:100%">
      <input type="number" value="${u.capexOverride||''}" placeholder="pro-rata"
        oninput="edificioUnits.find(x=>x.id===${u.id}).capexOverride=parseFloat(this.value)||null;updateEdificio()"
        style="text-align:right;background:var(--d4);border:1px solid var(--line);color:${u.isAmenity?'var(--amber)':'var(--text-b)'};font-size:11px;padding:4px 6px;width:100%"
        title="${u.isAmenity?'Amenity — CapEx propio':'Vacío = pro-rata automático'}">
      <div id="eu-venta-${u.id}" style="text-align:right;font-family:'DM Mono',monospace;font-size:11px;color:var(--text-d)">—</div>
      <div style="display:flex;gap:3px">
        <button onclick="edificioUnits.find(x=>x.id===${u.id}).isAmenity=!edificioUnits.find(x=>x.id===${u.id}).isAmenity;renderEdificioUnits();updateEdificio()"
          style="background:${u.isAmenity?'rgba(139,105,20,0.2)':'var(--d4)'};border:1px solid ${u.isAmenity?'var(--gold)':'var(--d6)'};
                 color:${u.isAmenity?'var(--gold)':'var(--text-d)'};font-size:8px;padding:3px 5px;cursor:pointer"
          title="${u.isAmenity?'Amenity activo':'Marcar como amenity'}">A</button>
        <button onclick="removeEdificioUnit(${u.id})"
          style="background:none;border:none;color:var(--text-d);font-size:14px;cursor:pointer;padding:0 3px">×</button>
      </div>
    </div>`).join('');
}

function updateEdificio() {
  const buyPrice  = parseFloat($('edifBuyPrice')?.value?.replace(/\./g,'').replace(',','.')) || 0;
  const itpPct    = parseFloat($('edifItpPct')?.value) || 6;
  const obraM2    = parseFloat($('edifObraM2')?.value) || 1800;
  const decoM2    = parseFloat($('edifDecoM2')?.value) || 400;
  const capexPm2  = obraM2 + decoM2;
  const mesesObra = parseFloat($('edifMesesObra')?.value) || 14;
  const interval  = parseFloat($('edifMesesIntervalo')?.value) || 2;

  const totalM2   = edificioUnits.reduce((s, u) => s + u.m2, 0);
  const itp       = buyPrice * itpPct / 100;

  let totalCapex = 0, totalVenta = 0;

  edificioUnits.forEach(u => {
    const proRataFrac = totalM2 > 0 ? u.m2 / totalM2 : 0;
    const compra      = buyPrice * proRataFrac;
    const itpUnit     = itp * proRataFrac;
    const capex       = u.capexOverride !== null ? u.capexOverride : capexPm2 * u.m2;
    const exitPm2     = u.pm2 || 0;
    const venta       = exitPm2 * u.m2;
    totalCapex += capex;
    totalVenta += venta;
    const ventaEl = $(`eu-venta-${u.id}`);
    if (ventaEl) ventaEl.textContent = venta > 0 ? venta.toLocaleString('es-ES') + ' €' : '—';
  });

  // Summary
  const sumEl = $('edificio-summary');
  if (sumEl) {
    const fmtN = v => v.toLocaleString('es-ES', {maximumFractionDigits:0}) + ' €';
    const grossProfit = totalVenta - buyPrice - itp - totalCapex;
    sumEl.innerHTML = `
      Precio compra: <strong>${fmtN(buyPrice)}</strong> · ITP ${itpPct}%: <strong>${fmtN(itp)}</strong><br>
      CapEx total (estimado): <strong>${fmtN(totalCapex)}</strong><br>
      Superficie total: <strong>${totalM2} m²</strong><br>
      Precio venta total (base): <strong style="color:var(--gold)">${fmtN(totalVenta)}</strong><br>
      Beneficio bruto estimado: <strong style="color:${grossProfit>0?'var(--green)':'var(--red)'}">${fmtN(grossProfit)}</strong>
      ${totalVenta>0 ? ` · ROI bruto <strong>${((grossProfit/(buyPrice+itp+totalCapex))*100).toFixed(1)}%</strong>` : ''}`;
  }

  // Totals row
  $('edif-total-m2').textContent = totalM2 + ' m²';
  $('edif-total-capex').textContent = totalCapex.toLocaleString('es-ES',{maximumFractionDigits:0}) + ' €';
  $('edif-total-venta').textContent = totalVenta > 0 ? totalVenta.toLocaleString('es-ES',{maximumFractionDigits:0}) + ' €' : '—';
}


// ══════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════
setupMoneyInputs();
toggleZC(true);
validateCatastro();
syncSurfaces('capex');
renderSensPriceConfig();
renderCompInputs();
renderCompOutput();
autoFillDates();

// Init first deal from current form state
const initSnap = captureCurrentDeal();
initSnap.name = $('dealName')?.value || 'Cedaceros 8';
deals.push({ name: initSnap.name, fields: initSnap.fields, states: initSnap.states, comps: JSON.parse(JSON.stringify(comps)) });
renderTabs();

update();

// ══════════════════════════════════════════════════
// PDF EXPORT
// ══════════════════════════════════════════════════

// ── DARK MODE ─────────────────────────────────────
let darkMode = true; // start dark since topbar is always dark

function toggleDarkMode() {
  darkMode = !darkMode;
  document.body.classList.toggle('dark-mode', darkMode);
  const btn = document.getElementById('dark-toggle');
  if (btn) btn.textContent = darkMode ? '◐' : '◑';
}

// Init: apply dark mode on load
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('dark-mode');
});

function exportPDF() {
  const btn = document.querySelector('button[onclick="exportPDF()"]');

  // Populate print-only elements
  const m = calc();
  const logoEl  = document.querySelector('img[alt="Riverwalk"]');
  const logoSrc = logoEl ? logoEl.src : '';

  const printLogo   = document.getElementById('print-logo');
  const printFootLogo = document.getElementById('print-footer-logo');
  if (printLogo && logoSrc)     printLogo.src = logoSrc;
  if (printFootLogo && logoSrc) printFootLogo.src = logoSrc;

  const el = id => document.getElementById(id);
  const fecha = new Date().toLocaleDateString('es-ES', {day:'2-digit', month:'long', year:'numeric'});

  if (el('print-dealname')) el('print-dealname').textContent = S('dealName') || '—';
  if (el('print-dealaddr')) {
    const addr = [S('dealAddress'), S('dealCP'), S('dealMunicipio')].filter(Boolean).join(' · ');
    el('print-dealaddr').textContent = addr;
  }
  if (el('print-fecha'))  el('print-fecha').textContent  = fecha;
  if (el('print-mode'))   el('print-mode').textContent   = m.dealMode === 'pase' ? '⚡ Pase' : '🔨 Reforma integral';
  if (el('print-footer-right')) el('print-footer-right').textContent = S('dealName') || '';

  window.print();
}

// ══════════════════════════════════════════════════════════════════
// DOSSIER PDF v2 — Riverwalk · 8 slides · A4 Portrait
// Fotos, planos, mapa OSM, escenarios, narrativa
// ══════════════════════════════════════════════════════════════════

// ── IMAGEN STORAGE ─────────────────────────────────────────────
const rwDossierImages = {
  fachada:       null,
  interiores:    [null, null, null, null],
  planoActual:   null,
  planoObjetivo: null,
};
window.__rwDossierImages = rwDossierImages;

async function rwUploadAndSet(file, slot, idx) {
  const dealId = window.__rwDealId;
  if (!dealId) {
    const r = new FileReader();
    r.onload = ev => rwSetImage(slot, idx, ev.target.result);
    r.readAsDataURL(file);
    return;
  }
  const fd = new FormData();
  fd.append('file', file);
  fd.append('dealId', dealId);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json();
    if (json.url) rwSetImage(slot, idx, json.url);
  } catch {
    const r = new FileReader();
    r.onload = ev => rwSetImage(slot, idx, ev.target.result);
    r.readAsDataURL(file);
  }
}

function rwPickImage(slot, idx) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    rwUploadAndSet(f, slot, idx);
  };
  inp.click();
}

function rwDropImage(e, slot, idx) {
  e.preventDefault(); e.stopPropagation();
  const f = e.dataTransfer.files[0];
  if (!f || !f.type.startsWith('image/')) return;
  rwUploadAndSet(f, slot, idx);
}

// Sync rwDossierImages → d.photos / d.plans so the presentation mode sees them
function rwSyncToDossier() {
  const d = getCurrentDossier();
  // Rebuild photos array: [fachada, interior0, interior1, interior2, interior3]
  const photoSlots = [
    rwDossierImages.fachada,
    ...rwDossierImages.interiores
  ];
  d.photos = photoSlots
    .filter(Boolean)
    .map((dataUrl, i) => ({ dataUrl, caption: ['Fachada','Interior 1','Interior 2','Interior 3','Interior 4'][i] || '', category: 'general' }));

  // Rebuild plans array: [planoActual, planoObjetivo]
  if (!d.plans) d.plans = [];
  d.plans = [rwDossierImages.planoActual, rwDossierImages.planoObjetivo]
    .filter(Boolean)
    .map((dataUrl, i) => ({ dataUrl, caption: i === 0 ? 'Distribución actual' : 'Distribución objetivo' }));
}

function rwSetImage(slot, idx, dataUrl) {
  let dzId;
  if (slot === 'interior') {
    rwDossierImages.interiores[idx] = dataUrl;
    dzId = `rw-dz-int-${idx}`;
  } else if (slot === 'planoActual') {
    rwDossierImages.planoActual = dataUrl;
    dzId = 'rw-dz-plano-actual';
  } else if (slot === 'planoObjetivo') {
    rwDossierImages.planoObjetivo = dataUrl;
    dzId = 'rw-dz-plano-obj';
  } else {
    rwDossierImages.fachada = dataUrl;
    dzId = 'rw-dz-fachada';
  }
  const dz = document.getElementById(dzId);
  if (dz) {
    dz.style.backgroundImage = `url(${dataUrl})`;
    dz.style.backgroundSize  = slot === 'planoActual' || slot === 'planoObjetivo' ? 'contain' : 'cover';
    dz.style.backgroundPosition = 'center';
    dz.style.backgroundRepeat = 'no-repeat';
    const lbl = dz.querySelector('.rw-dz-lbl');
    if (lbl) lbl.style.display = 'none';
    const del = dz.querySelector('.rw-dz-del');
    if (del) del.style.display = 'flex';
  }
  rwSyncToDossier();
  window.__rwNotifyImages?.();
}

function rwClearImage(slot, idx, e) {
  e.stopPropagation();
  let dzId;
  if (slot === 'interior') {
    rwDossierImages.interiores[idx] = null; dzId = `rw-dz-int-${idx}`;
  } else if (slot === 'planoActual') {
    rwDossierImages.planoActual = null; dzId = 'rw-dz-plano-actual';
  } else if (slot === 'planoObjetivo') {
    rwDossierImages.planoObjetivo = null; dzId = 'rw-dz-plano-obj';
  } else {
    rwDossierImages.fachada = null; dzId = 'rw-dz-fachada';
  }
  const dz = document.getElementById(dzId);
  if (dz) {
    dz.style.backgroundImage = '';
    const lbl = dz.querySelector('.rw-dz-lbl');
    if (lbl) lbl.style.display = 'flex';
    const del = dz.querySelector('.rw-dz-del');
    if (del) del.style.display = 'none';
  }
  rwSyncToDossier();
  window.__rwNotifyImages?.();
}

function rwRestoreImages(photoUrls, planUrls) {
  (photoUrls || []).forEach((url, i) => {
    if (!url) return;
    if (i === 0) rwSetImage('fachada', null, url);
    else rwSetImage('interior', i - 1, url);
  });
  if ((planUrls || [])[0]) rwSetImage('planoActual', null, planUrls[0]);
  if ((planUrls || [])[1]) rwSetImage('planoObjetivo', null, planUrls[1]);
}

// ── LOADER ─────────────────────────────────────────────────────
function rwShowLoader() {
  let el = document.getElementById('rw-pdf-loader');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'rw-pdf-loader';
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,11,16,0.97);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);';
  el.innerHTML = `
    <div style="text-align:center;width:320px;">
      <svg viewBox="0 0 80 80" width="48" height="48" style="margin-bottom:20px;display:block;margin-left:auto;margin-right:auto;">
        <rect x="10" y="10" width="22" height="22" fill="none" stroke="rgba(196,151,90,0.3)" stroke-width="1"/>
        <rect x="48" y="10" width="22" height="22" fill="none" stroke="rgba(196,151,90,0.3)" stroke-width="1"/>
        <rect x="10" y="48" width="22" height="22" fill="rgba(196,151,90,0.15)" stroke="rgba(196,151,90,0.6)" stroke-width="1"/>
        <rect x="48" y="48" width="22" height="22" fill="rgba(196,151,90,0.08)" stroke="rgba(196,151,90,0.4)" stroke-width="1"/>
        <circle cx="21" cy="21" r="3" fill="rgba(196,151,90,0.4)"/>
        <circle cx="59" cy="21" r="3" fill="rgba(196,151,90,0.25)"/>
        <circle cx="21" cy="59" r="3" fill="rgba(196,151,90,0.9)"/>
        <circle cx="59" cy="59" r="3" fill="rgba(196,151,90,0.6)"/>
      </svg>
      <div style="font-family:'Cormorant Garamond',serif;font-size:11px;font-weight:300;letter-spacing:0.45em;color:rgba(196,151,90,0.7);text-transform:uppercase;margin-bottom:18px;">Riverwalk</div>
      <div id="rw-loader-title" style="font-family:'Raleway',sans-serif;font-size:14px;font-weight:400;color:rgba(255,255,255,0.85);letter-spacing:0.05em;margin-bottom:8px;">Generando dossier</div>
      <div id="rw-loader-msg" style="font-family:'Raleway',sans-serif;font-size:9.5px;color:rgba(255,255,255,0.3);letter-spacing:0.1em;min-height:14px;margin-bottom:24px;"></div>
      <div style="position:relative;width:100%;height:1px;background:rgba(255,255,255,0.06);">
        <div id="rw-loader-bar" style="position:absolute;left:0;top:0;height:1px;width:0%;background:linear-gradient(90deg,rgba(139,101,32,0.8),rgba(196,151,90,1));transition:width 0.5s ease;"></div>
      </div>
      <div id="rw-loader-pg" style="font-family:'DM Mono',monospace;font-size:8px;color:rgba(255,255,255,0.15);letter-spacing:0.12em;margin-top:10px;"></div>
    </div>`;
  document.body.appendChild(el);
}

function rwUpdateLoader(msg, pct, pg) {
  const m = document.getElementById('rw-loader-msg');
  const b = document.getElementById('rw-loader-bar');
  const p = document.getElementById('rw-loader-pg');
  if (m) m.textContent = msg;
  if (b) b.style.width = Math.min(100, Math.round(pct * 100)) + '%';
  if (p && pg != null) p.textContent = `Slide ${pg.cur} de ${pg.total}`;
}

function rwHideLoader() {
  const el = document.getElementById('rw-pdf-loader');
  if (!el) return;
  el.style.transition = 'opacity 0.7s ease';
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 750);
}

// ── HELPERS ────────────────────────────────────────────────────
const rwFmt  = v => (v || 0).toLocaleString('es-ES', {maximumFractionDigits:0}) + ' €';
const rwFmtK = v => {
  const a = Math.abs(v || 0);
  if (a >= 1e6) return (v/1e6).toFixed(2).replace('.',',').replace(/,?0+$/,'') + ' M€';
  return Math.round(v||0).toLocaleString('es-ES') + ' €';
};
const rwPct  = v => ((v||0)*100).toFixed(1).replace('.',',') + '%';

// ── GEOCODE (Photon → Nominatim → freeform) ───────────────────
async function rwGeocode(dealAddr, dealCP, dealMunicipio) {
  if (!dealAddr) return null;
  const headers = { 'Accept-Language': 'es', 'User-Agent': 'RiverwalkDealModeler/3.0' };

  // Parse house number once — used by all strategies
  // Handles: "Calle de Ponzano, 53" / "Ponzano 53" / "Calle Ponzano 53"
  const numMatch = dealAddr.match(/^(.*?)[,\s]+(\d+)\s*$/);
  const houseNum = numMatch?.[2] || '';
  const streetOnly = numMatch
    ? numMatch[1].replace(/^(Calle\s+de\s+|Calle\s+|Avenida\s+de\s+|Avenida\s+|Paseo\s+de\s+|Paseo\s+|Plaza\s+de\s+|Plaza\s+)/i,'').trim()
    : dealAddr;

  // ── Strategy 1: Photon (Komoot) ──────────────────────────────
  // Photon is purpose-built for address geocoding on OSM and gives exact
  // housenumber nodes when available — much more precise than Nominatim
  // for specific portal numbers.
  try {
    const q = [dealAddr, dealMunicipio || 'Madrid', 'España'].filter(Boolean).join(', ');
    const params = new URLSearchParams({ q, limit: '5', lang: 'es' });
    const r = await fetch(`https://photon.komoot.io/api/?${params}`, { headers });
    const json = await r.json();
    const feats = json.features || [];
    if (feats.length > 0) {
      // Prefer a feature that has the exact house number
      const best = houseNum
        ? (feats.find(f => f.properties?.housenumber === houseNum) || feats[0])
        : feats[0];
      const [lon, lat] = best.geometry.coordinates;
      console.log('Geocode Photon hit:', best.properties?.name, best.properties?.housenumber);
      return { lat, lon };
    }
  } catch(e) { console.warn('Geocode Photon failed:', e); }

  // ── Strategy 2: Nominatim structured ─────────────────────────
  // Nominatim structured query: street = "housenumber streetname" (no prefix)
  try {
    const streetPart = houseNum ? `${houseNum} ${streetOnly}` : dealAddr;
    const params = new URLSearchParams({
      street:         streetPart,
      countrycodes:   'es',
      format:         'json',
      limit:          '5',
      addressdetails: '1',
    });
    if (dealCP)        params.set('postalcode', dealCP);
    if (dealMunicipio) params.set('city', dealMunicipio);

    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers });
    const d = await r.json();
    if (d && d.length > 0) {
      // Prefer results where address.house_number matches exactly
      const best = houseNum
        ? (d.find(x => x.address?.house_number === houseNum) ||
           d.find(x => x.display_name.includes(houseNum)) ||
           d[0])
        : d[0];
      console.log('Geocode Nominatim structured hit:', best.display_name);
      return { lat: parseFloat(best.lat), lon: parseFloat(best.lon) };
    }
  } catch(e) { console.warn('Geocode Nominatim structured failed:', e); }

  // ── Strategy 3: Nominatim free-form fallback ──────────────────
  try {
    const parts = [dealAddr, dealCP, dealMunicipio || 'Madrid'].filter(Boolean);
    const params = new URLSearchParams({
      q:            parts.join(', '),
      countrycodes: 'es',
      format:       'json',
      limit:        '1',
    });
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers });
    const d = await r.json();
    if (d && d.length > 0) {
      console.log('Geocode Nominatim freeform hit:', d[0].display_name);
      return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
    }
  } catch(e) { console.warn('Geocode Nominatim freeform failed:', e); }

  return null;
}

// ── MAP RENDER ─────────────────────────────────────────────────
// ── TILE MAP RENDERER ─────────────────────────────────────────
// Draws CartoDB tiles directly onto a canvas — no Leaflet, no html2canvas.
// Tiles support CORS (Access-Control-Allow-Origin: *) so crossOrigin='anonymous' works.
async function rwRenderMap(lat, lon) {
  const ZOOM  = 16;
  const SCALE = 2;           // retina: each CSS px = 2 canvas px
  const MAP_W = 794;
  const MAP_H = 480;
  const TW    = 256;         // tile size in px

  // lat/lon → fractional tile coordinates at given zoom
  function ll2tile(lat, lon, z) {
    const n = Math.pow(2, z);
    const x = (lon + 180) / 360 * n;
    const latR = lat * Math.PI / 180;
    const y = (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n;
    return { x, y };
  }

  const center = ll2tile(lat, lon, ZOOM);

  // canvas in physical pixels
  const cW = MAP_W * SCALE;
  const cH = MAP_H * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width  = cW;
  canvas.height = cH;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f5f2eb';
  ctx.fillRect(0, 0, cW, cH);

  // How many tiles we need in each direction
  const tilesX = Math.ceil(cW / TW) + 2;
  const tilesY = Math.ceil(cH / TW) + 2;

  // Top-left tile index (may be fractional, so floor)
  const t0x = Math.floor(center.x - cW / 2 / TW);
  const t0y = Math.floor(center.y - cH / 2 / TW);

  // Pixel offset of the top-left tile corner on the canvas
  const ox = Math.round((t0x - center.x) * TW + cW / 2);
  const oy = Math.round((t0y - center.y) * TW + cH / 2);

  // Load one tile image
  function loadTile(tx, ty) {
    return new Promise(resolve => {
      // Wrap tile x (longitude wraps around)
      const n  = Math.pow(2, ZOOM);
      const wx = ((tx % n) + n) % n;
      const sub = ['a','b','c'][Math.abs(tx + ty) % 3];
      const url = `https://${sub}.basemaps.cartocdn.com/light_all/${ZOOM}/${wx}/${ty}.png`;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve({ img, tx, ty });
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // Load all needed tiles in parallel
  const jobs = [];
  for (let dx = 0; dx < tilesX; dx++) {
    for (let dy = 0; dy < tilesY; dy++) {
      jobs.push(loadTile(t0x + dx, t0y + dy).then(res => {
        if (!res) return;
        const px = ox + dx * TW;
        const py = oy + dy * TW;
        ctx.drawImage(res.img, px, py, TW, TW);
      }));
    }
  }
  await Promise.allSettled(jobs);

  // Marker pixel position on canvas
  const mx = Math.round((center.x - t0x) * TW + ox);
  const my = Math.round((center.y - t0y) * TW + oy);

  // Outer ring
  ctx.beginPath();
  ctx.arc(mx, my, 22, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(196,151,90,0.5)';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // White halo
  ctx.beginPath();
  ctx.arc(mx, my, 13, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();

  // Gold fill
  ctx.beginPath();
  ctx.arc(mx, my, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#C4975A';
  ctx.fill();

  return { url: canvas.toDataURL('image/jpeg', 0.93), w: MAP_W, h: MAP_H };
}

// ── PAGE WRAPPER ──────────────────────────────────────────────
const pg = (inner, bg = '#F7F4EE') =>
  `<div style="width:794px;height:1123px;overflow:hidden;background:${bg};font-family:'Raleway',sans-serif;position:relative;box-sizing:border-box;">${inner}</div>`;

// ── COMMON HEADER ─────────────────────────────────────────────
const hdr = (cap, sub, num, light) => `
  <div style="padding:28px 48px 18px;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid ${light?'rgba(255,255,255,0.1)':'rgba(196,151,90,0.2)'};">
    <div>
      <div style="font-size:7px;letter-spacing:0.24em;text-transform:uppercase;color:${light?'rgba(196,151,90,0.7)':'#C4975A'};font-weight:600;margin-bottom:3px;">${cap}</div>
      <div style="font-size:9.5px;color:${light?'rgba(255,255,255,0.3)':'#8B8074'};letter-spacing:0.03em;">${sub}</div>
    </div>
    <div style="font-family:'DM Mono',monospace;font-size:8px;color:${light?'rgba(196,151,90,0.3)':'#C0B8AD'};letter-spacing:0.1em;">0${num}</div>
  </div>`;

function ftr(light) {
  const logoSrc = light ? '/Riverwalk_Logo_Blanco.png' : '/Riverwalk_Logo_Negro.png';
  const logoOp  = light ? '0.4' : '0.5';
  return `<div style="position:absolute;bottom:0;left:0;right:0;padding:12px 48px;border-top:1px solid ${light?'rgba(255,255,255,0.07)':'rgba(196,151,90,0.15)'};display:flex;justify-content:space-between;align-items:center;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="${logoSrc}" style="height:11px;width:auto;display:block;opacity:${logoOp};">
      <span style="font-size:7px;color:${light?'rgba(255,255,255,0.2)':'rgba(160,148,130,0.65)'};letter-spacing:0.14em;text-transform:uppercase;">· Documento Confidencial</span>
    </div>
    <div style="font-size:7px;color:${light?'rgba(196,151,90,0.3)':'rgba(196,151,90,0.55)'};letter-spacing:0.12em;">${new Date().getFullYear()}</div>
  </div>`;
}

// ── WORD-SAFE TRUNCATION ──────────────────────────────────────
function rwTrunc(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  const cut = text.lastIndexOf(' ', maxLen);
  return (cut > maxLen * 0.6 ? text.substring(0, cut) : text.substring(0, maxLen)) + '…';
}

// ── SLIDE 1: PORTADA ──────────────────────────────────────────
function rwSlide1(dealName, dealAddr, dealType, dateStr, fachada) {
  const tipo = dealType === 'pase' ? 'Pase · Asignación' : dealType === 'edificio' ? 'Promoción · Edificio' : 'Fix & Flip · Reforma integral';
  const bgStyle = fachada
    ? `background:linear-gradient(to right, rgba(10,11,16,0.92) 52%, rgba(10,11,16,0.55) 100%), url(${fachada}) center/cover no-repeat;`
    : `background:#0F1014;`;

  return pg(`
    <div style="position:absolute;inset:0;${bgStyle}"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#8B6520,#C4975A,#8B6520);"></div>
    <!-- Logo top -->
    <div style="position:absolute;top:40px;left:44px;right:44px;display:flex;justify-content:space-between;align-items:center;">
      <img src="/Riverwalk_Logo_Blanco.png" style="height:22px;width:auto;display:block;opacity:0.75;">
      <div style="border:0.5px solid rgba(196,151,90,0.3);padding:5px 14px;">
        <span style="font-size:7px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(196,151,90,0.65);">${tipo}</span>
      </div>
    </div>
    <!-- Main -->
    <div style="position:absolute;top:50%;left:44px;right:${fachada?'50%':'44px'};transform:translateY(-55%);">
      <div style="width:28px;height:0.5px;background:rgba(196,151,90,0.6);margin-bottom:24px;"></div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:${dealName.length>22?38:48}px;font-weight:300;color:#FAFAF8;line-height:1.1;letter-spacing:0.02em;margin-bottom:14px;">${dealName}</div>
      ${dealAddr ? `<div style="font-size:10.5px;font-weight:300;color:rgba(255,255,255,0.4);letter-spacing:0.06em;">${dealAddr}</div>` : ''}
      <div style="width:100%;height:0.5px;background:rgba(196,151,90,0.15);margin-top:28px;"></div>
    </div>
    <!-- Bottom -->
    <div style="position:absolute;bottom:36px;left:44px;right:44px;display:flex;justify-content:space-between;">
      <div style="font-size:7.5px;color:rgba(255,255,255,0.15);letter-spacing:0.12em;">Documento de inversión privado</div>
      <div style="font-family:'DM Mono',monospace;font-size:7.5px;color:rgba(196,151,90,0.4);letter-spacing:0.08em;">${dateStr}</div>
    </div>
  `, '#0F1014');
}

// ── SLIDE 2: EL ACTIVO ────────────────────────────────────────
function rwSlide2(dealName, dealAddr, m, narr, fachada) {
  const HEADER_H = 74;
  const FOOTER_H = 40;
  const BODY_H   = 1123 - HEADER_H - FOOTER_H;

  const dataItems = [
    { l: 'Superficie', v: `${m.surfCapex} m²` },
    { l: 'Precio compra', v: rwFmtK(m.buyPrice) },
    { l: 'Inversión total', v: rwFmtK(m.totalInvest) },
    { l: 'Objetivo venta', v: `${(V('exitB')||0).toLocaleString('es-ES')} €/m²` },
    { l: 'ROI base', v: rwPct(m.base.roiNet) },
    { l: 'Duración', v: `${m.totalMonths} meses` },
  ];

  const photoCol = fachada ? `
    <div style="width:42%;flex-shrink:0;height:${BODY_H}px;overflow:hidden;position:relative;background:url('${fachada}') center/cover no-repeat;">
      <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(247,244,238,0) 60%,rgba(247,244,238,0.3) 100%);"></div>
    </div>` : `
    <div style="width:42%;flex-shrink:0;height:${BODY_H}px;background:linear-gradient(135deg,#1A1D23 0%,#2A2D35 100%);display:flex;align-items:center;justify-content:center;">
      <div style="font-size:8px;letter-spacing:0.2em;color:rgba(196,151,90,0.3);text-transform:uppercase;">Sin fotografía</div>
    </div>`;

  const rightCol = `
    <div style="flex:1;padding:40px 48px 40px 44px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;">
      <!-- Title block -->
      <div>
        <div style="font-size:7px;letter-spacing:0.28em;text-transform:uppercase;color:#C4975A;font-weight:700;margin-bottom:12px;">El activo</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:${dealName.length>22?32:40}px;font-weight:300;color:#1A1D23;line-height:1.1;margin-bottom:6px;">${dealName}</div>
        ${dealAddr ? `<div style="font-size:10px;color:rgba(90,82,72,0.55);letter-spacing:0.04em;margin-bottom:28px;">${dealAddr}</div>` : '<div style="margin-bottom:28px;"></div>'}
        <!-- Data grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(196,151,90,0.12);border:1px solid rgba(196,151,90,0.12);">
          ${dataItems.map(d => `
          <div style="padding:14px 16px;background:#F7F4EE;">
            <div style="font-family:'DM Mono',monospace;font-size:16px;color:#1A1D23;font-weight:500;margin-bottom:4px;line-height:1;">${d.v}</div>
            <div style="font-size:7px;letter-spacing:0.18em;text-transform:uppercase;color:#A09282;">${d.l}</div>
          </div>`).join('')}
        </div>
      </div>
      <!-- Narrative -->
      ${narr.activo && narr.activo.length > 15 ? `
      <div style="border-top:1px solid rgba(196,151,90,0.2);padding-top:18px;">
        <div style="font-size:6.5px;letter-spacing:0.26em;text-transform:uppercase;color:#C4975A;font-weight:700;margin-bottom:10px;">Descripción</div>
        <div style="font-size:11px;line-height:1.82;color:rgba(50,44,36,0.85);font-weight:300;">${rwTrunc(narr.activo, 320)}</div>
      </div>` : `
      <div style="border-top:1px solid rgba(196,151,90,0.2);padding-top:18px;">
        <div style="font-size:6.5px;letter-spacing:0.26em;text-transform:uppercase;color:#C4975A;font-weight:700;margin-bottom:10px;">Datos principales</div>
        <div style="font-size:11px;line-height:1.82;color:rgba(100,90,78,0.6);font-style:italic;">Añade una descripción del activo en el panel de dossier.</div>
      </div>`}
    </div>`;

  return pg(`
    ${hdr('El Activo', dealAddr || dealName, 2)}
    <div style="display:flex;height:${BODY_H}px;">
      ${photoCol}
      ${rightCol}
    </div>
    ${ftr()}
  `);
}

// ── SLIDE 3: ESTADO ACTUAL ────────────────────────────────────
function rwSlide3(dealName, interiores) {
  const imgs = interiores.filter(Boolean);
  if (imgs.length === 0) return null;

  const labels = ['Salón · estado actual', 'Cocina · estado actual', 'Dormitorio principal', 'Baño'];
  const grid = imgs.slice(0,4).map((src, i) => `
    <div style="position:relative;overflow:hidden;background:#1A1D23;aspect-ratio:4/3;">
      <img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;">
      <div style="position:absolute;bottom:0;left:0;right:0;padding:8px 12px;background:linear-gradient(transparent,rgba(0,0,0,0.6));">
        <div style="font-size:7.5px;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;">${labels[i] || ''}</div>
      </div>
    </div>`).join('');

  const cols = imgs.length <= 2 ? `repeat(${imgs.length},1fr)` : 'repeat(2,1fr)';

  return pg(`
    ${hdr('Estado actual', dealName, 3)}
    <div style="padding:18px 44px;height:calc(100% - 60px - 36px);">
      <div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:300;color:#1A1D23;margin-bottom:14px;">Estado actual del activo</div>
      <div style="display:grid;grid-template-columns:${cols};gap:8px;height:calc(100% - 44px);">
        ${grid}
      </div>
    </div>
    ${ftr()}
  `);
}

// ── SLIDE 4: LA OPORTUNIDAD ───────────────────────────────────
function rwSlide4(dealName, m, narr) {
  const lev = m.ltvPct > 0;
  const buyPm2 = m.surfCapex > 0 ? Math.round(m.buyPrice / m.surfCapex) : 0;

  // Hero KPIs
  const heroKpis = [
    { v: rwFmtK(m.totalInvest),       l: 'Inversión total',  c: '#1A1D23' },
    { v: rwFmtK(m.base.grossProfit),  l: 'Margen bruto',     c: '#1A6B3C' },
    { v: rwPct(lev ? m.lev0.roe : m.base.roiNet), l: lev ? 'ROE neto' : 'ROI neto', c: '#C4975A' },
    { v: m.irrBase > 0 ? rwPct(m.irrBase) : '—', l: 'TIR anualizada', c: '#2A5298' },
  ];

  // Cost breakdown
  const costs = [
    ['Precio compra',    rwFmt(m.buyPrice)],
    ['ITP + Notaría',    rwFmt(m.itp + m.notaria)],
    ['CapEx + IVA',      rwFmt(m.capexNet * (1 + V('ivaObra')/100))],
    ['Mgmt fee',         rwFmt(m.mgmtFee)],
    ['Total invertido',  rwFmtK(m.totalInvest)],
  ];

  // 3-scenario table
  const scRows = [
    { l: 'Pesimista', sc: m.pess, ep: V('exitP'), irr: m.irrPess, col: '#B85050' },
    { l: 'Base',      sc: m.base, ep: V('exitB'), irr: m.irrBase, col: '#C4975A' },
    { l: 'Optimista', sc: m.opt,  ep: V('exitO'), irr: m.irrOpt,  col: '#1A6B3C' },
  ];

  return pg(`
    ${hdr('La Oportunidad', dealName, 4)}
    <div style="padding:20px 44px 0;display:flex;flex-direction:column;gap:16px;">

      <!-- Hero KPI row -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;">
        ${heroKpis.map(k => `
        <div style="padding:18px 16px 14px;background:#F4F1EB;border-top:2px solid ${k.c};">
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:500;color:${k.c};margin-bottom:5px;line-height:1;">${k.v}</div>
          <div style="font-size:7px;letter-spacing:0.16em;text-transform:uppercase;color:#8B8074;">${k.l}</div>
        </div>`).join('')}
      </div>

      <!-- Two-column: costs + scenarios -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

        <!-- Left: cost breakdown -->
        <div>
          <div style="font-size:6.5px;letter-spacing:0.26em;text-transform:uppercase;color:#C4975A;font-weight:700;margin-bottom:10px;">Estructura de costes</div>
          ${costs.map(([l,v], i) => {
            const isTotal = i === costs.length - 1;
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;${isTotal?'background:#F4F1EB;border-top:1.5px solid rgba(196,151,90,0.35);margin-top:3px;':'border-bottom:1px solid rgba(196,151,90,0.12);'}">
              <span style="font-size:9px;color:${isTotal?'#1A1D23':'#8B8074'};letter-spacing:0.04em;${isTotal?'font-weight:600;':''}">${l}</span>
              <span style="font-family:'DM Mono',monospace;font-size:${isTotal?13:11}px;color:${isTotal?'#C4975A':'#1A1D23'};font-weight:${isTotal?'700':'400'};">${v}</span>
            </div>`;
          }).join('')}
          ${lev ? `
          <div style="margin-top:10px;padding:10px 12px;background:rgba(42,82,152,0.06);border:0.5px solid rgba(42,82,152,0.2);">
            <div style="font-size:6.5px;letter-spacing:0.2em;text-transform:uppercase;color:#2A5298;margin-bottom:6px;">Apalancado · LTV ${Math.round(m.ltvPct*100)}%</div>
            <div style="display:flex;justify-content:space-between;">
              <span style="font-size:9px;color:#8B8074;">Equity requerido</span>
              <span style="font-family:'DM Mono',monospace;font-size:11px;color:#2A5298;">${rwFmtK(m.lev0.equity)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
              <span style="font-size:9px;color:#8B8074;">ROE neto</span>
              <span style="font-family:'DM Mono',monospace;font-size:11px;color:#C4975A;">${rwPct(m.lev0.roe)}</span>
            </div>
          </div>` : ''}
        </div>

        <!-- Right: 3-scenario table -->
        <div>
          <div style="font-size:6.5px;letter-spacing:0.26em;text-transform:uppercase;color:#C4975A;font-weight:700;margin-bottom:10px;">Análisis de escenarios</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid rgba(196,151,90,0.25);">
                ${['Escenario','€/m² salida','ROI bruto','TIR anual'].map(h=>`<th style="padding:7px 8px;font-size:7px;letter-spacing:0.12em;text-transform:uppercase;color:#A09282;font-weight:400;text-align:left;">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${scRows.map(({l,sc,ep,irr,col})=>`
              <tr style="border-bottom:1px solid rgba(196,151,90,0.1);">
                <td style="padding:9px 8px;font-size:9px;color:${col};font-weight:600;letter-spacing:0.06em;">${l}</td>
                <td style="padding:9px 8px;font-family:'DM Mono',monospace;font-size:10px;color:#1A1D23;">${(ep||0).toLocaleString('es-ES')}</td>
                <td style="padding:9px 8px;font-family:'DM Mono',monospace;font-size:10px;color:${col};">${rwPct(sc.roiGross)}</td>
                <td style="padding:9px 8px;font-family:'DM Mono',monospace;font-size:10px;color:${irr>0?col:'#A09282'}">${irr>0?rwPct(irr):'—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          <div style="margin-top:10px;padding:10px 12px;background:#F4F1EB;border-left:2px solid #C4975A;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:9px;color:#8B8074;">Breakeven bruto</span>
              <span style="font-family:'DM Mono',monospace;font-size:12px;color:#1A1D23;font-weight:600;">${Math.round(m.bePriceM2).toLocaleString('es-ES')} €/m²</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
              <span style="font-size:9px;color:#8B8074;">€/m² compra</span>
              <span style="font-family:'DM Mono',monospace;font-size:12px;color:#1A1D23;">${buyPm2.toLocaleString('es-ES')} €/m²</span>
            </div>
          </div>
        </div>
      </div>

      ${narr.tesis && narr.tesis.length > 15 ? `
      <div style="border-left:2px solid #C4975A;padding:12px 16px;background:#FAF7F2;flex-shrink:0;">
        <div style="font-size:6.5px;letter-spacing:0.22em;text-transform:uppercase;color:#C4975A;margin-bottom:7px;font-weight:600;">Tesis inversora</div>
        <div style="font-size:10.5px;line-height:1.78;color:#3D3730;font-weight:300;">${rwTrunc(narr.tesis, 380)}</div>
      </div>` : ''}
    </div>
    ${ftr()}
  `);
}

// ── SLIDE 5: PLANOS ───────────────────────────────────────────
function rwSlide5(dealName, planoActual, planoObjetivo, narr) {
  if (!planoActual && !planoObjetivo) return null;

  const HEADER_H = 74;
  const FOOTER_H = 40;
  const BODY_H   = 1123 - HEADER_H - FOOTER_H; // 1009px

  // Plans often are horizontal (landscape); stack them vertically with equal height
  const hasBoth = planoActual && planoObjetivo;
  const planoCard = (src, title, flex) => `
    <div style="flex:${flex};display:flex;flex-direction:column;min-height:0;">
      <div style="font-size:7px;letter-spacing:0.22em;text-transform:uppercase;color:#C4975A;font-weight:600;margin-bottom:8px;">${title}</div>
      <div style="flex:1;background:#FFFFFF;overflow:hidden;display:flex;align-items:center;justify-content:center;border:0.5px solid rgba(196,151,90,0.15);min-height:0;">
        ${src
          ? `<img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;">`
          : `<div style="font-size:8.5px;color:#B0A898;letter-spacing:0.1em;text-transform:uppercase;">Sin imagen</div>`}
      </div>
    </div>`;

  return pg(`
    ${hdr('Distribución', dealName, 5)}
    <div style="padding:20px 44px;height:${BODY_H}px;box-sizing:border-box;display:flex;flex-direction:column;gap:0;">
      <div style="font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:300;color:#1A1D23;margin-bottom:16px;flex-shrink:0;">Distribución · Actual y objetivo</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:14px;min-height:0;">
        ${hasBoth
          ? planoCard(planoActual, 'Distribución actual', '1') + planoCard(planoObjetivo, 'Distribución objetivo', '1')
          : planoCard(planoActual || planoObjetivo, planoActual ? 'Distribución actual' : 'Distribución objetivo', '1')}
      </div>
      ${narr.proyecto && narr.proyecto.length > 10 ? `
      <div style="flex-shrink:0;margin-top:14px;padding:11px 14px;border-left:2px solid rgba(196,151,90,0.5);background:#FAF7F2;">
        <div style="font-size:9.5px;color:#5A5040;line-height:1.7;font-weight:300;">${rwTrunc(narr.proyecto, 220)}</div>
      </div>` : ''}
    </div>
    ${ftr()}
  `, '#FAFAF8');
}

// ── SLIDE 6: LA ZONA ──────────────────────────────────────────
function rwSlide6(dealName, dealAddr, mapData, narr, m, orientation) {
  const hasMap   = !!(mapData && mapData.url);
  const narrText = narr.zona || narr.mercado || '';
  const hasNarr  = narrText.length > 15;
  const MAP_H    = 520;

  // Orientation compass SVG (inline, no external deps)
  let oriPanel = '';
  if (orientation && orientation.solar) {
    const sd  = orientation.solar;
    const ang = orientation.angle || 0;
    const compassSVG = `<svg width="52" height="52" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
      <circle cx="26" cy="26" r="24" fill="none" stroke="rgba(196,151,90,0.3)" stroke-width="0.8"/>
      <circle cx="26" cy="26" r="1.5" fill="rgba(196,151,90,0.8)"/>
      ${['N','E','S','O'].map((l,i) => {
        const a = i * 90 * Math.PI / 180;
        const r = 17, tr = 21;
        const x = 26 + Math.sin(a)*r, y = 26 - Math.cos(a)*r;
        const tx = 26 + Math.sin(a)*tr, ty = 26 - Math.cos(a)*tr + 1;
        return `<line x1="26" y1="26" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,${l==='N'?0.5:0.2})" stroke-width="0.7"/>
                <text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" fill="rgba(255,255,255,${l==='N'?0.9:0.4})" font-size="5.5" text-anchor="middle" dominant-baseline="middle" font-family="Raleway,sans-serif" font-weight="600">${l}</text>`;
      }).join('')}
      <g transform="rotate(${ang}, 26, 26)">
        <polygon points="26,6 24,22 26,19 28,22" fill="${sd.color}" opacity="0.9"/>
        <polygon points="26,46 24,30 26,33 28,30" fill="rgba(255,255,255,0.15)"/>
      </g>
    </svg>`;
    oriPanel = `
    <div style="position:absolute;bottom:16px;right:44px;z-index:10;background:rgba(10,11,15,0.82);border:0.5px solid rgba(196,151,90,0.35);padding:12px 16px;backdrop-filter:blur(4px);display:flex;align-items:center;gap:12px;">
      ${compassSVG}
      <div>
        <div style="font-size:6px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(196,151,90,0.6);margin-bottom:3px;">Orientación fachada</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:16px;color:${sd.color};line-height:1;margin-bottom:2px;">${sd.label}</div>
        <div style="font-size:8px;color:rgba(255,255,255,0.35);">${ang}° · ${sd.short || ''}</div>
      </div>
    </div>`;
  }

  // Address label
  const addrLabel = hasMap ? `
    <div style="position:absolute;bottom:16px;left:44px;padding:5px 12px;background:rgba(247,244,238,0.93);border-left:2px solid #C4975A;z-index:10;">
      <div style="font-size:7.5px;color:#1A1D23;letter-spacing:0.08em;font-weight:500;">${dealAddr || 'Ubicación del activo'}</div>
    </div>` : '';

  const contentH = 1123 - 74 - MAP_H - 40; // header - map - footer

  // Word-safe split for narrative headline vs body
  const splitAt = Math.min(120, narrText.lastIndexOf(' ', 120));
  const headText = narrText.substring(0, splitAt);
  const bodyText = narrText.length > splitAt ? rwTrunc(narrText.substring(splitAt).trim(), 280) : '';

  return pg(`
    ${hdr('La Zona', dealAddr || dealName, 6)}
    <div style="width:794px;height:${MAP_H}px;overflow:hidden;position:relative;flex-shrink:0;background:#EDE9E0;">
      ${hasMap
        ? `<img src="${mapData.url}" style="width:794px;height:${MAP_H}px;display:block;image-rendering:auto;">
           <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(247,244,238,0) 60%,rgba(247,244,238,0.85) 88%,rgba(247,244,238,1) 100%);pointer-events:none;"></div>`
        : `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:#1A1D23;">
             <div style="text-align:center;">
               <div style="font-size:9px;color:rgba(196,151,90,0.5);letter-spacing:0.2em;text-transform:uppercase;">Sin mapa</div>
               <div style="font-size:8.5px;color:rgba(255,255,255,0.3);margin-top:6px;">${dealAddr || ''}</div>
             </div>
           </div>`}
      ${addrLabel}
      ${oriPanel}
    </div>

    <div style="padding:${hasNarr?'20px':'14px'} 44px;height:${contentH}px;box-sizing:border-box;display:flex;gap:36px;align-items:flex-start;overflow:hidden;">
      <div style="flex:1;min-width:0;overflow:hidden;">
        ${hasNarr ? `
        <div style="font-size:6.5px;letter-spacing:0.26em;text-transform:uppercase;color:#C4975A;font-weight:700;margin-bottom:10px;">Microzona</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:${narrText.length<100?20:17}px;font-weight:300;color:#1A1D23;line-height:1.5;margin-bottom:12px;">${headText}</div>
        ${bodyText ? `<div style="font-size:10px;line-height:1.85;color:rgba(50,44,36,0.75);font-weight:300;">${bodyText}</div>` : ''}
        ` : `
        <div style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:#1A1D23;">${dealAddr || dealName}</div>
        `}
      </div>
      ${m ? `
      <div style="flex-shrink:0;width:150px;">
        <div style="font-size:6.5px;letter-spacing:0.26em;text-transform:uppercase;color:#C4975A;font-weight:700;margin-bottom:12px;">Precio €/m²</div>
        ${[
          ['€/m² compra',  `${(m.surfCapex>0?Math.round(m.buyPrice/m.surfCapex):0).toLocaleString('es-ES')} €/m²`],
          ['Obj. venta',   `${(V('exitB')||0).toLocaleString('es-ES')} €/m²`],
          ['Breakeven',    `${Math.round(m.bePriceM2).toLocaleString('es-ES')} €/m²`],
        ].map(([l,v]) => `
        <div style="padding:10px 0;border-bottom:1px solid rgba(196,151,90,0.15);">
          <div style="font-family:'DM Mono',monospace;font-size:13px;color:#1A1D23;font-weight:500;margin-bottom:3px;">${v}</div>
          <div style="font-size:6.5px;letter-spacing:0.14em;text-transform:uppercase;color:#A09282;">${l}</div>
        </div>`).join('')}
      </div>` : ''}
    </div>
    ${ftr()}
  `);
}

// ── SLIDE 7: ESCENARIOS ───────────────────────────────────────
function rwSlide7(dealName, m) {
  const lev = m.ltvPct > 0;

  const scBlock = (sc, irr, label, dark) => {
    const roi = lev ? m.lev0.roe : sc.roiNet;
    const bg  = dark ? '#1A1D23' : '#F7F4EE';
    const tc  = dark ? '#FAFAF8' : '#1A1D23';
    const tc2 = dark ? 'rgba(255,255,255,0.38)' : 'rgba(80,70,58,0.65)';
    const sep = dark ? 'rgba(255,255,255,0.07)' : 'rgba(196,151,90,0.14)';
    const acc = dark ? 'rgba(196,151,90,0.65)' : '#C4975A';
    const bdr = dark ? 'none' : '1px solid rgba(196,151,90,0.18)';

    const rows = [
      ['Precio venta', rwFmt(sc.saleGross)],
      ['Margen bruto', rwFmt(sc.grossProfit)],
      ['ROI bruto', rwPct(sc.roiGross)],
      ...(sc.sf > 0 ? [['Carried interest', rwFmt(sc.sf)]] : []),
      ['Margen neto', rwFmt(sc.netProfit)],
      [lev ? 'ROE neto' : 'ROI neto', rwPct(roi)],
      ['TIR anualizada', irr > 0 ? rwPct(irr) : '—'],
      ['MOIC', (lev ? m.lev0.moic : (1 + sc.roiNet)).toFixed(2) + '×'],
    ];

    return `
    <div style="flex:1;background:${bg};border:${bdr};overflow:hidden;display:flex;flex-direction:column;">
      <!-- header -->
      <div style="padding:18px 20px 16px;border-bottom:1px solid ${sep};">
        <div style="font-size:7px;letter-spacing:0.26em;text-transform:uppercase;color:${acc};font-weight:600;margin-bottom:8px;">${label}</div>
        <div style="font-family:'DM Mono',monospace;font-size:26px;font-weight:500;color:${tc};line-height:1;">${rwFmtK(sc.saleGross)}</div>
        <div style="font-size:8.5px;color:${tc2};margin-top:5px;">${Math.round(sc.saleGross/m.surfCapex).toLocaleString('es-ES')} €/m²</div>
      </div>
      <!-- rows -->
      <div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly;padding:6px 0;">
        ${rows.map(([l,v]) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 20px;border-bottom:1px solid ${sep};">
          <span style="font-size:9.5px;color:${tc2};">${l}</span>
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:${tc};font-weight:${dark?'400':'500'};">${v}</span>
        </div>`).join('')}
      </div>
    </div>`;
  };

  return pg(`
    ${hdr('Escenarios Financieros', dealName, 7)}

    <!-- Title row -->
    <div style="padding:28px 48px 0;">
      <div style="font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:300;color:#1A1D23;letter-spacing:0.01em;margin-bottom:6px;">Análisis de escenarios</div>
      <div style="font-size:9.5px;color:rgba(90,80,68,0.55);letter-spacing:0.04em;margin-bottom:24px;">Escenario base a ${(V('exitB')||0).toLocaleString('es-ES')} €/m² · ${m.totalMonths} meses · superficie ${m.surfCapex} m²</div>
    </div>

    <!-- Columns -->
    <div style="padding:0 48px;display:flex;gap:8px;height:${lev ? 560 : 650}px;">
      ${scBlock(m.pess, m.irrPess, 'Pesimista', false)}
      ${scBlock(m.base, m.irrBase, 'Base', true)}
      ${scBlock(m.opt,  m.irrOpt,  'Optimista', false)}
    </div>

    <!-- Bottom summary / lev row -->
    ${lev ? `
    <div style="margin:16px 48px 0;padding:16px 20px;background:#1A1D23;display:grid;grid-template-columns:auto repeat(4,1fr);align-items:center;gap:0;">
      <div style="padding-right:24px;border-right:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:7px;letter-spacing:0.26em;text-transform:uppercase;color:rgba(196,151,90,0.65);font-weight:600;margin-bottom:2px;">Apalancado</div>
        <div style="font-size:8.5px;color:rgba(255,255,255,0.3);letter-spacing:0.04em;">LTV ${Math.round(m.ltvPct*100)}% · escenario base</div>
      </div>
      ${[
        ['Equity', rwFmtK(m.lev0.equity)],
        ['Deuda', rwFmtK(m.totalInvest * m.ltvPct)],
        ['ROE neto', rwPct(m.lev0.roe)],
        ['MOIC', m.lev0.moic.toFixed(2) + '×'],
      ].map(([l,v]) => `
      <div style="padding:0 16px;text-align:center;">
        <div style="font-family:'DM Mono',monospace;font-size:16px;color:#FAFAF8;margin-bottom:3px;">${v}</div>
        <div style="font-size:7px;color:rgba(255,255,255,0.28);letter-spacing:0.14em;text-transform:uppercase;">${l}</div>
      </div>`).join('')}
    </div>` : `
    <!-- Summary bar (sin leverage) -->
    <div style="margin:16px 48px 0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
      ${[
        ['Margen neto base', rwFmt(m.base.netProfit)],
        ['ROI neto base', rwPct(m.base.roiNet)],
        ['TIR base', m.irrBase > 0 ? rwPct(m.irrBase) : '—'],
        ['Breakeven', `${Math.round(m.bePriceM2).toLocaleString('es-ES')} €/m²`],
      ].map(([l,v]) => `
      <div style="padding:14px 18px;background:#1A1D23;text-align:center;">
        <div style="font-family:'DM Mono',monospace;font-size:18px;color:#FAFAF8;margin-bottom:4px;">${v}</div>
        <div style="font-size:7px;color:rgba(255,255,255,0.3);letter-spacing:0.14em;text-transform:uppercase;">${l}</div>
      </div>`).join('')}
    </div>`}

    ${ftr()}
  `);
}

// ── SLIDE 8: CIERRE ───────────────────────────────────────────
function rwSlide8() {
  return pg(`
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#8B6520,#C4975A,#8B6520);"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <!-- Geometric mark -->
      <svg viewBox="0 0 120 120" width="72" height="72" style="margin-bottom:32px;">
        <rect x="14" y="14" width="38" height="38" fill="none" stroke="rgba(196,151,90,0.25)" stroke-width="0.8"/>
        <rect x="68" y="14" width="38" height="38" fill="none" stroke="rgba(196,151,90,0.15)" stroke-width="0.8"/>
        <rect x="14" y="68" width="38" height="38" fill="rgba(196,151,90,0.1)" stroke="rgba(196,151,90,0.5)" stroke-width="0.8"/>
        <rect x="68" y="68" width="38" height="38" fill="rgba(196,151,90,0.05)" stroke="rgba(196,151,90,0.3)" stroke-width="0.8"/>
        <circle cx="33" cy="33" r="4" fill="rgba(196,151,90,0.3)"/>
        <circle cx="87" cy="33" r="4" fill="rgba(196,151,90,0.2)"/>
        <circle cx="33" cy="87" r="4" fill="rgba(196,151,90,1)"/>
        <circle cx="87" cy="87" r="4" fill="rgba(196,151,90,0.6)"/>
      </svg>
      <img src="/Riverwalk_Logo_Blanco.png" style="height:44px;width:auto;display:block;opacity:0.85;margin-bottom:12px;">
      <div style="width:40px;height:0.5px;background:rgba(196,151,90,0.3);margin:28px auto;"></div>
      <div style="font-size:9px;color:rgba(255,255,255,0.18);letter-spacing:0.14em;">Documento confidencial · Uso privado</div>
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,rgba(196,151,90,0.2),transparent);"></div>
  `, '#0F1014');
}

// ── PDF SLIDE: EL MERCADO ─────────────────────────────────────
function rwSlideMercadoPDF(dealName, negotiation, m) {
  const neg = negotiation || [];
  const askH  = neg.find(h => h.tipo === 'asking');
  const pactH = neg.find(h => h.tipo === 'pactado');
  const savAbs = (askH?.importe > 0 && pactH?.importe > 0) ? askH.importe - pactH.importe : 0;
  const savPct = (askH?.importe > 0 && pactH?.importe > 0) ? ((savAbs / askH.importe) * 100).toFixed(1) : null;

  const tipoCfg = {
    asking:       { label:'Precio inicial asking',  color:'#C0443A' },
    oferta:       { label:'Oferta presentada',       color:'#8B6520' },
    rechazada:    { label:'Oferta rechazada',        color:'#B05028' },
    contraoferta: { label:'Contraoferta vendedor',   color:'#7A6010' },
    pactado:      { label:'Precio pactado ✓',       color:'#1A6B3C' },
  };

  const buyPm2 = m.surfCapex > 0 ? Math.round(m.buyPrice / m.surfCapex) : 0;

  const timelineHTML = neg.length > 0 ? neg.map((h, i) => {
    const cfg = tipoCfg[h.tipo] || tipoCfg.oferta;
    const isPactado = h.tipo === 'pactado';
    const isLast = i === neg.length - 1;
    const fmtI = h.importe > 0 ? h.importe.toLocaleString('es-ES') + ' €' : '';
    const fmtF = h.fecha ? new Date(h.fecha).toLocaleDateString('es-ES', {month:'short', year:'numeric'}).toUpperCase() : '';
    return `
    <div style="display:flex;gap:14px;margin-bottom:${isLast?0:14}px;align-items:flex-start;">
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;padding-top:4px;">
        <div style="width:${isPactado?12:9}px;height:${isPactado?12:9}px;border-radius:50%;background:${cfg.color};flex-shrink:0;${isPactado?'box-shadow:0 0 0 3px rgba(26,107,60,0.15);':''}"></div>
        ${!isLast ? `<div style="width:1px;flex:1;min-height:16px;background:rgba(196,151,90,0.2);margin-top:4px;"></div>` : ''}
      </div>
      <div style="flex:1;padding:${isPactado?'16px 18px':'10px 16px'};background:${isPactado?'rgba(26,107,60,0.05)':'#FAF7F2'};border:0.5px solid ${isPactado?'rgba(26,107,60,0.2)':'rgba(196,151,90,0.15)'};${isPactado?'border-left:2px solid #1A6B3C;':''}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${fmtI?6:0}px;">
          <div style="font-size:6.5px;letter-spacing:0.18em;text-transform:uppercase;color:${cfg.color};font-weight:700;">${cfg.label}</div>
          ${fmtF?`<div style="font-family:'DM Mono',monospace;font-size:7.5px;color:#A09282;">${fmtF}</div>`:''}
        </div>
        ${fmtI?`<div style="font-family:'DM Mono',monospace;font-size:${isPactado?20:16}px;color:${isPactado?'#1A6B3C':'#1A1D23'};font-weight:${isPactado?600:400};line-height:1;">${fmtI}</div>`:''}
        ${h.nota?`<div style="font-size:9px;color:#8B8074;line-height:1.6;margin-top:6px;font-style:italic;">${h.nota}</div>`:''}
      </div>
    </div>`;
  }).join('') : `<div style="font-size:10px;color:#A09282;font-style:italic;padding:20px 0;">Sin historial de negociación registrado.</div>`;

  return pg(`
    ${hdr('El Mercado', dealName, 5)}
    <div style="padding:20px 44px 0;display:flex;gap:32px;height:calc(100% - 74px - 40px);overflow:hidden;">
      <!-- Left: timeline -->
      <div style="flex:1;overflow:hidden;">
        <div style="font-size:6.5px;letter-spacing:0.26em;text-transform:uppercase;color:#C4975A;font-weight:700;margin-bottom:14px;">Del precio inicial al precio pactado</div>
        ${timelineHTML}
      </div>
      <!-- Right: resultado -->
      <div style="width:210px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;justify-content:flex-start;padding-top:22px;">
        ${savPct ? `
        <div style="padding:24px 20px;background:#1A6B3C;text-align:center;">
          <div style="font-size:6.5px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:10px;">Ahorro negociado</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:40px;font-weight:300;color:#FFFFFF;line-height:1.1;">−${savPct}<span style="font-size:20px;">%</span></div>
          <div style="font-size:8px;color:rgba(255,255,255,0.5);margin-top:8px;">sobre precio inicial</div>
        </div>
        <div style="padding:14px 16px;background:#FAF7F2;border:0.5px solid rgba(196,151,90,0.2);">
          <div style="font-size:6.5px;letter-spacing:0.14em;text-transform:uppercase;color:#A09282;margin-bottom:6px;">Precio inicial</div>
          <div style="font-family:'DM Mono',monospace;font-size:13px;color:#A09282;text-decoration:line-through;">${askH.importe.toLocaleString('es-ES')} €</div>
        </div>
        <div style="padding:14px 16px;background:#F4F1EB;border-left:2px solid #C4975A;">
          <div style="font-size:6.5px;letter-spacing:0.14em;text-transform:uppercase;color:#A09282;margin-bottom:6px;">Precio pactado</div>
          <div style="font-family:'DM Mono',monospace;font-size:16px;color:#1A1D23;font-weight:600;">${pactH.importe.toLocaleString('es-ES')} €</div>
        </div>
        <div style="padding:14px 16px;background:#FAF7F2;border:0.5px solid rgba(26,107,60,0.2);">
          <div style="font-size:6.5px;letter-spacing:0.14em;text-transform:uppercase;color:#A09282;margin-bottom:6px;">Ahorro absoluto</div>
          <div style="font-family:'DM Mono',monospace;font-size:15px;color:#1A6B3C;font-weight:600;">${savAbs.toLocaleString('es-ES')} €</div>
        </div>` : `
        <div style="padding:16px 18px;background:#F4F1EB;border-left:2px solid #C4975A;">
          <div style="font-size:6.5px;letter-spacing:0.14em;text-transform:uppercase;color:#A09282;margin-bottom:8px;">Precio de compra</div>
          <div style="font-family:'DM Mono',monospace;font-size:20px;color:#1A1D23;">${m.buyPrice.toLocaleString('es-ES')} €</div>
          <div style="font-size:9px;color:#A09282;margin-top:4px;">${buyPm2.toLocaleString('es-ES')} €/m²</div>
        </div>`}
      </div>
    </div>
    ${ftr()}
  `);
}

// ── PDF SLIDE: EL PROYECTO ────────────────────────────────────
function rwSlideProyectoPDF(dealName, m, narr, planoObjetivo, materials, interiorismStyle) {
  const mats = materials || [];
  const interiorismImg = INTERIORISM_IMGS[interiorismStyle || ''] || null;
  const calidadesText = (window.__rwCalidadesText) || '';

  const reformData = [
    ['Obra (€/m²)',      V('obraM2').toLocaleString('es-ES') + ' €/m² + IVA'],
    ['Interiorismo',     V('decoM2').toLocaleString('es-ES') + ' €/m² + IVA'],
    ['CapEx total',      rwFmt(m.capexNet * (1 + V('ivaObra')/100))],
    ['Superficie',       m.surfCapex + ' m²'],
    ['Duración obras',   V('mesesObra') + ' meses (estimado)'],
  ];

  // Layout: top zone (text+table left | reform summary right), then plan, then interiorism image
  const BODY_H = 1123 - 74 - 40;
  const TOP_H  = Math.round(BODY_H * 0.38);
  const MAT_H  = interiorismImg ? 220 : 0;
  const PLAN_H = BODY_H - TOP_H - MAT_H - (MAT_H ? 28 : 16); // 28 = separator + gap when image present

  return pg(`
    ${hdr('El Proyecto', dealName, 6)}
    <div style="padding:18px 44px 0;height:${BODY_H}px;box-sizing:border-box;display:flex;flex-direction:column;gap:0;overflow:hidden;">

      <!-- TOP ZONE: text left + reform table right -->
      <div style="height:${TOP_H}px;display:flex;gap:24px;flex-shrink:0;overflow:hidden;">
        <!-- Left: title + narrative -->
        <div style="flex:1;display:flex;flex-direction:column;gap:10px;overflow:hidden;padding-right:4px;">
          <div>
            <div style="font-size:6.5px;letter-spacing:0.26em;text-transform:uppercase;color:#C4975A;font-weight:700;margin-bottom:8px;">El proyecto</div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:300;color:#1A1D23;margin-bottom:10px;">Reforma integral</div>
            ${narr.proyecto && narr.proyecto.length > 10 ? `
            <div style="font-size:10px;line-height:1.78;color:rgba(50,44,36,0.8);font-weight:300;">${rwTrunc(narr.proyecto, 340)}</div>` : ''}
          </div>
          ${calidadesText ? `
          <div style="padding:10px 14px;background:#F5F3EF;border-left:2px solid rgba(196,151,90,0.5);flex-shrink:0;">
            <div style="font-size:6px;letter-spacing:0.2em;text-transform:uppercase;color:#C4975A;margin-bottom:5px;font-weight:600;">Calidades</div>
            <div style="font-size:9px;line-height:1.65;color:#5A5040;">${rwTrunc(calidadesText, 240)}</div>
          </div>` : ''}
        </div>
        <!-- Right: reform data table -->
        <div style="flex:0 0 46%;display:flex;flex-direction:column;gap:1px;background:rgba(196,151,90,0.10);border:0.5px solid rgba(196,151,90,0.12);align-self:flex-start;width:46%;">
          ${reformData.map(([l,v]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 16px;background:#FFFFFF;">
            <span style="font-size:9px;color:#8B8074;letter-spacing:0.04em;">${l}</span>
            <span style="font-family:'DM Mono',monospace;font-size:11px;color:#1A1D23;font-weight:500;">${v}</span>
          </div>`).join('')}
        </div>
      </div>

      <!-- SEPARATOR -->
      <div style="height:16px;flex-shrink:0;display:flex;align-items:center;">
        <div style="font-size:6.5px;letter-spacing:0.22em;text-transform:uppercase;color:#C4975A;font-weight:600;">Distribución objetivo</div>
      </div>

      <!-- PLAN ZONE: sin borde para que se integre con el fondo blanco -->
      <div style="height:${PLAN_H}px;flex-shrink:0;background:#FFFFFF;overflow:hidden;display:flex;align-items:center;justify-content:center;">
        ${planoObjetivo
          ? `<img src="${planoObjetivo}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;">`
          : `<div style="font-size:8px;color:#B0A898;letter-spacing:0.1em;text-transform:uppercase;">Sin plano de distribución</div>`}
      </div>

      <!-- INTERIORISM IMAGE: contain para no recortar ni deformar -->
      ${interiorismImg ? `
      <div style="height:${MAT_H}px;flex-shrink:0;margin-top:12px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <img src="${interiorismImg}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;">
      </div>` : ''}

    </div>
    ${ftr()}
  `, '#FFFFFF');
}

// ── PDF SLIDE: TESTIGOS ───────────────────────────────────────
function rwSlideTestigosPDF(dealName, m) {
  const reforComp    = comps.filter(c => c.precio > 0 && c.m2 > 0 && c.tipo === 'reformado');
  const reformarComp = comps.filter(c => c.precio > 0 && c.m2 > 0 && c.tipo === 'reformar');
  const medRefPm2    = reforComp.length ? Math.round(reforComp.reduce((s,c)=>s+c.precio/c.m2,0)/reforComp.length) : 0;
  const medRfmPm2    = reformarComp.length ? Math.round(reformarComp.reduce((s,c)=>s+c.precio/c.m2,0)/reformarComp.length) : 0;
  const buyPm2       = m.surfCapex > 0 ? Math.round(m.buyPrice / m.surfCapex) : 0;
  const descuento    = medRfmPm2 > 0 && buyPm2 > 0 ? ((medRfmPm2 - buyPm2) / medRfmPm2 * 100).toFixed(1) : null;

  const compRow = (c, accent) => `
    <div style="display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:10px 14px;background:#FAF7F2;border-left:2px solid ${accent};margin-bottom:4px;">
      <div style="font-size:10px;color:#5A5040;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.desc || c.dir || '—'}</div>
      <div style="font-family:'DM Mono',monospace;color:#A09282;font-size:9.5px;white-space:nowrap;">${c.m2}m²</div>
      <div style="font-family:'DM Mono',monospace;color:#1A1D23;font-size:11.5px;font-weight:500;white-space:nowrap;">${Math.round(c.precio/c.m2).toLocaleString('es-ES')} €/m²</div>
    </div>`;

  const scRows = [
    { lbl:'Pesimista', ep:V('exitP'), sc:m.pess, col:'#B05050', bg:'rgba(176,80,80,0.05)' },
    { lbl:'Base',      ep:V('exitB'), sc:m.base, col:'#C4975A', bg:'rgba(196,151,90,0.08)' },
    { lbl:'Optimista', ep:V('exitO'), sc:m.opt,  col:'#1A6B3C', bg:'rgba(26,107,60,0.05)' },
  ];

  return pg(`
    ${hdr('Testigos de mercado', dealName, 8)}
    <div style="padding:18px 44px 0;display:grid;grid-template-columns:1fr 1fr;gap:24px;height:calc(100% - 74px - 40px);overflow:hidden;">
      <!-- Left: comparables -->
      <div style="display:flex;flex-direction:column;gap:16px;overflow:hidden;">
        ${reforComp.length > 0 ? `
        <div>
          <div style="font-size:6.5px;letter-spacing:0.22em;text-transform:uppercase;color:#C4975A;font-weight:700;margin-bottom:12px;">Testigos reformados (${reforComp.length})</div>
          ${reforComp.slice(0,5).map(c=>compRow(c,'rgba(26,107,60,0.5)')).join('')}
          ${medRefPm2 > 0 ? `<div style="margin-top:8px;padding:10px 12px;background:#F4F1EB;border-left:2px solid #C4975A;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:8.5px;color:#8B8074;">Media reformados</span>
            <span style="font-family:'DM Mono',monospace;font-size:14px;color:#C4975A;font-weight:600;">${medRefPm2.toLocaleString('es-ES')} €/m²</span>
          </div>` : ''}
        </div>` : ''}
        ${reformarComp.length > 0 ? `
        <div>
          <div style="font-size:6.5px;letter-spacing:0.22em;text-transform:uppercase;color:#8B8074;font-weight:700;margin-bottom:12px;">A reformar (${reformarComp.length})</div>
          ${reformarComp.slice(0,3).map(c=>compRow(c,'rgba(196,151,90,0.4)')).join('')}
          ${medRfmPm2 > 0 ? `<div style="margin-top:8px;padding:10px 12px;background:#FAF7F2;border:0.5px solid rgba(196,151,90,0.2);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:8.5px;color:#8B8074;">Media sin reformar</span>
            <span style="font-family:'DM Mono',monospace;font-size:14px;color:#1A1D23;">${medRfmPm2.toLocaleString('es-ES')} €/m²</span>
          </div>` : ''}
        </div>` : ''}
        ${!reforComp.length && !reformarComp.length ? `<div style="font-size:10px;color:#A09282;font-style:italic;padding:20px 0;">Sin testigos registrados. Añade comparables en la sección Testigos.</div>` : ''}
      </div>
      <!-- Right: price scenarios + discount -->
      <div style="display:flex;flex-direction:column;gap:10px;justify-content:flex-start;padding-top:4px;">
        <div style="font-size:6.5px;letter-spacing:0.22em;text-transform:uppercase;color:#C4975A;font-weight:700;margin-bottom:6px;">Escenarios de precio de salida</div>
        ${scRows.map(({lbl,ep,sc,col,bg})=>`
        <div style="padding:14px 16px;background:${bg};border-left:2px solid ${col};">
          <div style="font-size:7.5px;letter-spacing:0.14em;text-transform:uppercase;color:${col};margin-bottom:6px;font-weight:600;">${lbl}</div>
          <div style="font-family:'DM Mono',monospace;font-size:22px;color:#1A1D23;font-weight:500;line-height:1;">${ep.toLocaleString('es-ES')} <span style="font-size:11px;color:#A09282;">€/m²</span></div>
          <div style="display:flex;gap:16px;margin-top:8px;">
            <span style="font-size:8.5px;color:#8B8074;">Total: <span style="font-family:'DM Mono',monospace;color:#1A1D23;">${rwFmtK(ep*m.surfCapex)}</span></span>
            <span style="font-size:8.5px;color:#8B8074;">ROI: <span style="font-family:'DM Mono',monospace;color:${col};">${rwPct(sc.roiGross)}</span></span>
            <span style="font-size:8.5px;color:#8B8074;">TIR: <span style="font-family:'DM Mono',monospace;color:${col};">${sc.irr > 0 ? rwPct(sc.irr) : '—'}</span></span>
          </div>
        </div>`).join('')}
        ${descuento ? `
        <div style="padding:12px 14px;background:#F4F1EB;border:0.5px solid rgba(196,151,90,0.3);display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span style="font-size:9px;color:#8B8074;">Descuento compra vs mercado sin reformar</span>
          <span style="font-family:'DM Mono',monospace;font-size:16px;color:#1A6B3C;font-weight:700;">−${descuento}%</span>
        </div>` : ''}
      </div>
    </div>
    ${ftr()}
  `);
}

// ── PDF SLIDE: CALENDARIO ─────────────────────────────────────
function rwSlideCalendarioPDF(dealName, m) {
  const tlSteps = [
    { lbl:'Arras',       m: 0,                            sub: 'Firma del contrato' },
    { lbl:'Escritura',   m: m.arasMonths,                 sub: m.arasMonths + 'm' },
    { lbl:'Inicio obra', m: m.arasMonths + 1,             sub: 'Inicio CapEx' },
    { lbl:'Fin obras',   m: m.arasMonths + Math.round(m.monthsSale * 0.75), sub: 'Entrega' },
    { lbl:'Venta',       m: m.totalMonths,                sub: m.totalMonths + 'm total' },
  ];
  const maxM = m.totalMonths;

  const phaseData = [
    { l: 'Período arras',       v: m.arasMonths + ' meses',   c: '#8B8074' },
    { l: 'Reforma + comercialización', v: m.monthsSale + ' meses', c: '#C4975A' },
    { l: 'Total operación',     v: m.totalMonths + ' meses',  c: '#1A1D23' },
    { l: 'Precio compra',       v: rwFmtK(m.buyPrice),         c: '#1A1D23' },
    { l: 'Inversión total',     v: rwFmtK(m.totalInvest),      c: '#C4975A' },
    { l: 'Precio salida base',  v: rwFmtK(m.base.saleGross),   c: '#1A6B3C' },
  ];

  return pg(`
    ${hdr('Calendario', dealName, 9)}
    <div style="padding:28px 44px;height:calc(100% - 74px - 40px);box-sizing:border-box;display:flex;flex-direction:column;gap:40px;">
      <div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:#1A1D23;margin-bottom:8px;">Temporalidad de la operación</div>
        <div style="font-size:9.5px;color:#8B8074;">Duración total estimada: ${m.totalMonths} meses · ${Math.round(m.totalMonths/12*10)/10} años</div>
      </div>

      <!-- Timeline track -->
      <div style="position:relative;padding:0 20px;">
        <!-- Track bar -->
        <div style="height:3px;background:rgba(196,151,90,0.15);border-radius:2px;position:relative;">
          <div style="position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,#8B6520,#C4975A);border-radius:2px;width:100%;"></div>
        </div>
        <!-- Step nodes -->
        <div style="position:relative;margin-top:-7px;display:flex;justify-content:space-between;">
          ${tlSteps.map((s, i) => {
            const isPrimary = i === 0 || i === tlSteps.length - 1;
            return `
            <div style="display:flex;flex-direction:column;align-items:center;">
              <div style="width:${isPrimary?16:12}px;height:${isPrimary?16:12}px;border-radius:50%;background:${isPrimary?'#C4975A':'#F7F4EE'};border:2px solid #C4975A;flex-shrink:0;"></div>
              <div style="font-size:8px;letter-spacing:0.1em;text-transform:uppercase;color:#C4975A;margin-top:10px;font-weight:600;text-align:center;white-space:nowrap;">${s.lbl}</div>
              <div style="font-family:'DM Mono',monospace;font-size:9px;color:#A09282;margin-top:3px;text-align:center;">${s.sub}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Phase bar (visual) -->
      <div style="position:relative;height:32px;background:#F0EDE6;border-radius:2px;overflow:hidden;">
        <!-- Arras phase -->
        <div style="position:absolute;left:0;top:0;height:100%;width:${(m.arasMonths/maxM*100).toFixed(1)}%;background:rgba(139,128,116,0.3);border-right:2px solid rgba(139,128,116,0.5);">
          <div style="padding:0 8px;line-height:32px;font-size:7.5px;letter-spacing:0.1em;text-transform:uppercase;color:#5A5040;white-space:nowrap;overflow:hidden;">Arras</div>
        </div>
        <!-- Reforma phase -->
        <div style="position:absolute;left:${(m.arasMonths/maxM*100).toFixed(1)}%;top:0;height:100%;width:${(m.monthsSale/maxM*100).toFixed(1)}%;background:rgba(196,151,90,0.25);border-right:2px solid rgba(196,151,90,0.5);">
          <div style="padding:0 8px;line-height:32px;font-size:7.5px;letter-spacing:0.1em;text-transform:uppercase;color:#5A4010;white-space:nowrap;overflow:hidden;">Reforma &amp; Venta</div>
        </div>
      </div>

      <!-- Summary grid -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${phaseData.map(({l,v,c}) => `
        <div style="padding:14px 16px;background:#F4F1EB;border-top:2px solid rgba(196,151,90,0.25);">
          <div style="font-family:'DM Mono',monospace;font-size:18px;color:${c};margin-bottom:5px;line-height:1;">${v}</div>
          <div style="font-size:7px;letter-spacing:0.14em;text-transform:uppercase;color:#A09282;">${l}</div>
        </div>`).join('')}
      </div>
    </div>
    ${ftr()}
  `);
}

// ── PDF SLIDE: PROTECCIÓN DE CAPITAL ─────────────────────────
function rwSlideProteccionPDF(dealName, m) {
  const beM2     = Math.round(m.bePriceM2);
  const exitBase = V('exitB');
  const marginPct = exitBase > 0 ? ((exitBase - beM2) / exitBase * 100).toFixed(1) : '—';

  const durCols = [
    { label: `${m.arasMonths+2}m`, months: m.arasMonths+2 },
    { label: `${m.totalMonths}m ·`, months: m.totalMonths },
    { label: `${m.totalMonths+4}m`, months: m.totalMonths+4 },
    { label: `${m.totalMonths+8}m`, months: m.totalMonths+8 },
  ];
  const priceCols = (sensPrices && sensPrices.length ? [...sensPrices] : [V('exitP'),V('exitB'),V('exitO')]).slice(0,6);

  function cellROI(ep, mo) {
    const commAdj = V('comunidad')*mo, ibiAdj = V('ibi')*mo/12;
    const tot = m.buyPrice+m.itp+m.notaria+commAdj+ibiAdj+m.intermediaryFee+m.brokerBuyFee+m.capexNet+m.totalFeesNet+m.totalIVA;
    const brk = ep*m.surfCapex*V('brokerExit')/100 + (V('exitFixed')+V('exitFixedAjuste'));
    return (ep*m.surfCapex - brk - tot) / tot;
  }
  function cellROI2(capexMult, ep) {
    const cn = m.capexNet * capexMult;
    const tot2 = m.buyPrice+m.itp+m.notaria+V('comunidad')*m.totalMonths+V('ibi')*m.totalMonths/12+m.intermediaryFee+m.brokerBuyFee+cn+m.totalFeesNet+cn*V('ivaObra')/100;
    const brk = ep*m.surfCapex*V('brokerExit')/100 + (V('exitFixed')+V('exitFixedAjuste'));
    return (ep*m.surfCapex - brk - tot2) / tot2;
  }
  function roiStyle(roi) {
    if (roi < 0)    return 'background:rgba(180,30,30,0.15);color:#C0443A;border:0.5px solid rgba(192,68,58,0.25);';
    if (roi < 0.08) return 'background:rgba(180,100,20,0.12);color:#8B5A10;border:0.5px solid rgba(180,100,20,0.2);';
    if (roi < 0.15) return 'background:rgba(139,105,20,0.1);color:#7A6010;border:0.5px solid rgba(196,151,90,0.25);';
    return 'background:rgba(26,107,60,0.08);color:#1A6B3C;border:0.5px solid rgba(26,107,60,0.2);';
  }

  const capexAdjs = [-0.20,-0.10,0,+0.10,+0.20,+0.30];
  const capexExits = [V('exitP'),V('exitB'),V('exitO')].filter((v,i,a)=>a.indexOf(v)===i);

  const thStyle = 'padding:5px 10px;font-size:7.5px;letter-spacing:0.1em;text-transform:uppercase;color:#8B8074;font-weight:400;text-align:center;border-bottom:1px solid rgba(196,151,90,0.2);';
  const thLeftStyle = 'padding:5px 12px;font-size:7.5px;letter-spacing:0.1em;text-transform:uppercase;color:#8B8074;font-weight:400;text-align:left;border-bottom:1px solid rgba(196,151,90,0.2);';

  return pg(`
    ${hdr('Protección de Capital', dealName, 10)}
    <div style="padding:16px 44px 0;display:flex;flex-direction:column;gap:14px;height:calc(100% - 74px - 40px);overflow:hidden;">
      <!-- Header stats -->
      <div style="display:flex;gap:10px;flex-shrink:0;">
        ${[
          ['Breakeven bruto', beM2.toLocaleString('es-ES') + ' €/m²', '#C4975A'],
          ['Margen s/ base', marginPct + '%', '#1A6B3C'],
          ['Precio compra', `${(m.surfCapex>0?Math.round(m.buyPrice/m.surfCapex):0).toLocaleString('es-ES')} €/m²`, '#1A1D23'],
        ].map(([l,v,c])=>`
        <div style="flex:1;padding:12px 14px;background:#F4F1EB;border-top:2px solid ${c};">
          <div style="font-family:'DM Mono',monospace;font-size:18px;color:${c};line-height:1;margin-bottom:4px;">${v}</div>
          <div style="font-size:7px;letter-spacing:0.14em;text-transform:uppercase;color:#A09282;">${l}</div>
        </div>`).join('')}
      </div>

      <!-- Two matrices side by side -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex:1;min-height:0;overflow:hidden;">
        <!-- Matrix 1: Precio × Duración -->
        <div style="display:flex;flex-direction:column;">
          <div style="font-size:7.5px;letter-spacing:0.14em;text-transform:uppercase;color:#8B8074;margin-bottom:8px;font-weight:600;">ROI · Precio salida × Duración</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="${thLeftStyle}">€/m²</th>
              ${durCols.map(({label,months})=>`<th style="${thStyle.replace('#8B8074', months===m.totalMonths?'#C4975A':'#8B8074')}">${label}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${priceCols.map(ep => {
                const isBase = Math.abs(ep - exitBase) < 200;
                return `<tr>
                  <td style="padding:7px 12px;font-family:'DM Mono',monospace;font-size:10px;color:${isBase?'#C4975A':'#8B8074'};white-space:nowrap;border-bottom:1px solid rgba(196,151,90,0.1);${isBase?'font-weight:600;':''}">
                    ${ep.toLocaleString('es-ES')}${isBase?' ·':''}
                  </td>
                  ${durCols.map(({months}) => {
                    const roi = cellROI(ep, months);
                    const s = roiStyle(roi);
                    return `<td style="padding:7px 8px;text-align:center;${s}">
                      <div style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;line-height:1;">${(roi*100).toFixed(1)}%</div>
                    </td>`;
                  }).join('')}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <!-- Matrix 2: CapEx × Precio -->
        <div style="display:flex;flex-direction:column;">
          <div style="font-size:7.5px;letter-spacing:0.14em;text-transform:uppercase;color:#8B8074;margin-bottom:8px;font-weight:600;">ROI · Variación CapEx × Precio salida</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="${thLeftStyle}">CapEx</th>
              ${capexExits.map(ep=>`<th style="${thStyle.replace('#8B8074', Math.abs(ep-exitBase)<200?'#C4975A':'#8B8074')}">${ep.toLocaleString('es-ES')}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${capexAdjs.map(adj => {
                const isBase = adj === 0;
                const lbl = isBase ? 'CapEx base ·' : `${adj>0?'+':''}${(adj*100).toFixed(0)}%`;
                return `<tr>
                  <td style="padding:7px 12px;font-family:'DM Mono',monospace;font-size:10px;color:${isBase?'#C4975A':'#8B8074'};white-space:nowrap;border-bottom:1px solid rgba(196,151,90,0.1);${isBase?'font-weight:600;':''}">
                    ${lbl}
                  </td>
                  ${capexExits.map(ep => {
                    const roi = cellROI2(1+adj, ep);
                    const s = roiStyle(roi);
                    return `<td style="padding:7px 8px;text-align:center;${s}">
                      <div style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;line-height:1;">${(roi*100).toFixed(1)}%</div>
                    </td>`;
                  }).join('')}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Legend -->
      <div style="display:flex;gap:14px;padding:10px 0;border-top:1px solid rgba(196,151,90,0.15);flex-shrink:0;">
        ${[['#C0443A','rgba(180,30,30,0.15)','< 0% · Pérdidas'],['#8B5A10','rgba(180,100,20,0.12)','0–8% · Ajustado'],['#7A6010','rgba(139,105,20,0.1)','8–15% · Aceptable'],['#1A6B3C','rgba(26,107,60,0.08)','> 15% · Objetivo']].map(([c,bg,l])=>`
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:12px;height:12px;background:${bg};border:0.5px solid ${c};flex-shrink:0;border-radius:1px;"></div>
          <span style="font-size:8.5px;color:#8B8074;">${l}</span>
        </div>`).join('')}
        <div style="margin-left:auto;font-size:8px;color:#A09282;">· = escenario base</div>
      </div>
    </div>
    ${ftr()}
  `);
}

// ── PDF SLIDE: HIGHLIGHTS ─────────────────────────────────────
function rwSlideHighlightsPDF(dealName, m, d) {
  const est = d.estructura || {};
  const VEHICULO_LABELS = { spv_unica:'SPV · Única operación', spv_multi:'SPV · Multi-activo', club_deal:'Club Deal' };
  const VEHICULO_DESC   = {
    spv_unica:'Sociedad de propósito específico constituida para esta operación. Separación total de riesgo patrimonial.',
    spv_multi:'Vehículo multi-activo. Permite diversificación y acceso a operaciones futuras.',
    club_deal:'Grupo cerrado de inversores privados. Estructura ágil regida por pacto entre partes.'
  };
  const APORTACION_LABELS = { pp:'Préstamo participativo', cp:'Cuenta en participación', ac:'Ampliación de capital', ph:'Préstamo c/ garantía hipotecaria' };
  const APORTACION_DESC = {
    pp:'Interés fijo + participación variable en beneficio. Sin transmisión de propiedad.',
    cp:'Capital cedido al gestor. Comparte riesgo y beneficio en proporción a la aportación.',
    ac:'El inversor entra como socio de la sociedad, con derechos societarios.',
    ph:'Retorno fijo garantizado con el activo como colateral. Perfil más conservador.'
  };
  const sf1T=V('sf1T'), sf2T=V('sf2T'), sf1P=V('sf1P'), sf2P=V('sf2P');
  const beM2 = Math.round(m.bePriceM2);
  const ticketMin = est.ticketMinimo ? parseInt(est.ticketMinimo).toLocaleString('es-ES') + ' €' : '—';
  const vLabel = est.vehiculo ? VEHICULO_LABELS[est.vehiculo] : null;
  const vDesc  = est.vehiculo ? VEHICULO_DESC[est.vehiculo] : null;
  const aLabel = est.aportacion ? APORTACION_LABELS[est.aportacion] : null;
  const aDesc  = est.aportacion ? APORTACION_DESC[est.aportacion] : null;

  const roiPess = Math.max(0, m.pess.roiGross * 100);
  const roiBase = Math.max(0, m.base.roiGross * 100);
  const roiOpt  = Math.max(0, m.opt.roiGross * 100);
  const maxRoi  = Math.max(roiOpt, 60);

  return pg(`
    ${hdr('Highlights de la inversión', dealName, 11)}
    <div style="padding:18px 44px 0;display:grid;grid-template-columns:1fr 1fr;gap:24px;height:calc(100% - 74px - 40px);overflow:hidden;">
      <!-- LEFT: KPIs + escenarios -->
      <div style="display:flex;flex-direction:column;gap:12px;overflow:hidden;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          ${[
            ['Inversión total',  rwFmtK(m.totalInvest),       '#C4975A'],
            ['Ticket mínimo',    ticketMin,                    '#1A1D23'],
            ['ROI bruto base',   rwPct(m.base.roiGross),       '#1A6B3C'],
            ['TIR anual base',   m.irrBase>0?rwPct(m.irrBase):'—', '#1A6B3C'],
            ['Plazo estimado',   m.totalMonths + ' meses',    '#1A1D23'],
            ['Breakeven',        beM2.toLocaleString('es-ES') + ' €/m²', '#8B8074'],
          ].map(([l,v,c])=>`
          <div style="padding:10px 12px;background:#F4F1EB;border-left:2px solid rgba(196,151,90,0.3);">
            <div style="font-family:'DM Mono',monospace;font-size:14px;color:${c};line-height:1;margin-bottom:4px;">${v}</div>
            <div style="font-size:7px;letter-spacing:0.12em;text-transform:uppercase;color:#A09282;">${l}</div>
          </div>`).join('')}
        </div>

        <!-- ROI bars -->
        <div>
          <div style="font-size:6.5px;letter-spacing:0.2em;text-transform:uppercase;color:#8B8074;margin-bottom:8px;">Proyección ROI bruto por escenario</div>
          ${[
            {lbl:'Pesimista',  v:roiPess.toFixed(1)+'%', bar:(roiPess/maxRoi*100).toFixed(1), c:'#B05050', ep:V('exitP')},
            {lbl:'Base',       v:roiBase.toFixed(1)+'%', bar:(roiBase/maxRoi*100).toFixed(1), c:'#C4975A', ep:V('exitB')},
            {lbl:'Optimista',  v:roiOpt.toFixed(1)+'%',  bar:(roiOpt/maxRoi*100).toFixed(1),  c:'#1A6B3C', ep:V('exitO')},
          ].map(s=>`
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <div style="width:64px;font-size:7.5px;letter-spacing:0.1em;text-transform:uppercase;color:${s.c};flex-shrink:0;">${s.lbl}</div>
            <div style="flex:1;height:5px;background:rgba(196,151,90,0.12);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${s.bar}%;background:${s.c};border-radius:2px;"></div>
            </div>
            <div style="font-family:'DM Mono',monospace;font-size:12px;color:${s.c};font-weight:600;width:44px;text-align:right;">${s.v}</div>
            <div style="font-family:'DM Mono',monospace;font-size:8px;color:#A09282;width:80px;">${s.ep.toLocaleString('es-ES')} €/m²</div>
          </div>`).join('')}
        </div>

        <!-- Scenario mini-table -->
        <div style="background:#FAF7F2;border:0.5px solid rgba(196,151,90,0.2);">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border-bottom:1px solid rgba(196,151,90,0.15);">
            ${['Escenario','€/m²','ROI bruto','TIR anual'].map(h=>`<div style="padding:5px 8px;font-size:7px;letter-spacing:0.1em;text-transform:uppercase;color:#A09282;">${h}</div>`).join('')}
          </div>
          ${[
            {lbl:'Pesimista', ep:V('exitP'), sc:m.pess, col:'#B05050'},
            {lbl:'Base',      ep:V('exitB'), sc:m.base, col:'#C4975A'},
            {lbl:'Optimista', ep:V('exitO'), sc:m.opt,  col:'#1A6B3C'},
          ].map(({lbl,ep,sc,col})=>`
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border-bottom:1px solid rgba(196,151,90,0.08);">
            <div style="padding:6px 8px;font-size:9px;color:${col};font-weight:600;">${lbl}</div>
            <div style="padding:6px 8px;font-family:'DM Mono',monospace;font-size:9px;color:#1A1D23;">${ep.toLocaleString('es-ES')}</div>
            <div style="padding:6px 8px;font-family:'DM Mono',monospace;font-size:9px;color:${col};">${rwPct(sc.roiGross)}</div>
            <div style="padding:6px 8px;font-family:'DM Mono',monospace;font-size:9px;color:${col};">${sc.irr>0?rwPct(sc.irr):'—'}</div>
          </div>`).join('')}
        </div>
      </div>

      <!-- RIGHT: estructura + fees -->
      <div style="display:flex;flex-direction:column;gap:12px;overflow:hidden;">
        ${vLabel ? `<div style="padding:12px 14px;background:#FAF7F2;border-left:2px solid #C4975A;">
          <div style="font-size:6.5px;letter-spacing:0.18em;text-transform:uppercase;color:#C4975A;margin-bottom:5px;font-weight:700;">Vehículo de inversión</div>
          <div style="font-size:12px;color:#1A1D23;font-weight:600;margin-bottom:4px;">${vLabel}</div>
          <div style="font-size:9.5px;color:#8B8074;line-height:1.6;">${vDesc}</div>
        </div>` : ''}
        ${aLabel ? `<div style="padding:12px 14px;background:#F4F1EB;border:0.5px solid rgba(196,151,90,0.2);">
          <div style="font-size:6.5px;letter-spacing:0.18em;text-transform:uppercase;color:#8B8074;margin-bottom:5px;font-weight:700;">Forma de aportación</div>
          <div style="font-size:12px;color:#1A1D23;font-weight:600;margin-bottom:4px;">${aLabel}</div>
          <div style="font-size:9.5px;color:#8B8074;line-height:1.6;">${aDesc}</div>
        </div>` : ''}
        <!-- Fees structure -->
        <div style="background:#FAF7F2;border:0.5px solid rgba(196,151,90,0.2);">
          <div style="padding:8px 14px;border-bottom:1px solid rgba(196,151,90,0.15);">
            <div style="font-size:6.5px;letter-spacing:0.18em;text-transform:uppercase;color:#C4975A;font-weight:700;">Estructura de fees Riverwalk</div>
          </div>
          ${[
            ['Management fee',           `${V('mgmtFeePct')}% s/ precio + CapEx`],
            [`Carry ROI < ${sf1T}%`,     '0% — íntegro al inversor'],
            [`Carry ROI ${sf1T}–${sf2T}%`, `${sf1P}% Riverwalk · ${100-sf1P}% inversor`],
            [`Carry ROI > ${sf2T}%`,     `${sf2P}% Riverwalk · ${100-sf2P}% inversor`],
          ].map(([l,v])=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid rgba(196,151,90,0.08);">
            <span style="font-size:9.5px;color:#8B8074;">${l}</span>
            <span style="font-family:'DM Mono',monospace;font-size:10px;color:#1A1D23;">${v}</span>
          </div>`).join('')}
        </div>
        <div style="font-size:8.5px;color:#A09282;line-height:1.6;padding-top:4px;">Documento informativo. Las rentabilidades proyectadas no garantizan resultados futuros.</div>
      </div>
    </div>
    ${ftr()}
  `);
}

// ── MAIN ──────────────────────────────────────────────────────
async function exportDossierPDF() {
  if (typeof html2canvas === 'undefined') {
    alert('Necesitas conexión a internet la primera vez para cargar html2canvas.'); return;
  }

  const btn = document.querySelector('[onclick="exportDossierPDF()"]');
  const origTxt = btn?.textContent || '';
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  rwShowLoader();

  const container = document.createElement('div');
  container.id = 'rw-dossier-render';
  container.style.cssText = 'position:fixed;left:-900px;top:0;width:794px;height:1123px;z-index:-1;overflow:hidden;';
  document.body.appendChild(container);

  try {
    await document.fonts.ready;

    const m        = calc();
    const d        = getCurrentDossier();
    const dealName = ($('dealName')?.value || 'Operación Riverwalk').trim();
    const dealAddr = $('dealAddress')?.value  || '';
    const dealFloor= $('dealFloor')?.value    || '';
    const dealCP   = $('dealCP')?.value       || '';
    const dealMuni = $('dealMunicipio')?.value || '';
    const narr = {
      activo:   $('narr-activo')?.value   || '',
      zona:     $('narr-zona')?.value     || '',
      mercado:  $('narr-mercado')?.value  || '',
      proyecto: $('narr-proyecto')?.value || '',
      tesis:    $('narr-tesis')?.value    || '',
    };
    const dateStr = new Date().toLocaleDateString('es-ES', {day:'2-digit',month:'long',year:'numeric'}).toUpperCase();

    // Geocode + map — pass fields separately for structured Nominatim query
    rwUpdateLoader('Geolocalizando el activo…', 0.05);
    let mapData = null;
    if (dealAddr) {
      const coords = await rwGeocode(dealAddr, dealCP, dealMuni);
      if (coords) {
        rwUpdateLoader('Renderizando mapa…', 0.12);
        mapData = await rwRenderMap(coords.lat, coords.lon);
      }
    }

    // Build slides
    // Expose calidades text globally for rwSlideProyectoPDF
    const calidadesText = d.calidades?.customText || (d.calidades?.preset && window.CALIDADES_DEFAULTS ? window.CALIDADES_DEFAULTS[d.calidades.preset] : '') || '';
    window.__rwCalidadesText = calidadesText;

    const slides = [
      rwSlide1(dealName, dealAddr, dealMode, dateStr, rwDossierImages.fachada),
      rwSlide2(dealName, dealAddr, m, narr, rwDossierImages.fachada),
      rwSlide3(dealName, rwDossierImages.interiores),
      rwSlide4(dealName, m, narr),
      (d.negotiation && d.negotiation.length > 0) ? rwSlideMercadoPDF(dealName, d.negotiation, m) : null,
      rwSlide5(dealName, rwDossierImages.planoActual, rwDossierImages.planoObjetivo, narr),
      (narr.proyecto || rwDossierImages.planoObjetivo || d.interiorismStyle) ? rwSlideProyectoPDF(dealName, m, narr, rwDossierImages.planoObjetivo, [], d.interiorismStyle || '') : null,
      rwSlide6(dealName, dealAddr, mapData, narr, m, d.orientation || null),
      (comps && comps.filter(c=>c.precio>0&&c.m2>0).length > 0) ? rwSlideTestigosPDF(dealName, m) : null,
      rwSlide7(dealName, m),
      rwSlideCalendarioPDF(dealName, m),
      rwSlideProteccionPDF(dealName, m),
      rwSlideHighlightsPDF(dealName, m, d),
      rwSlide8(),
    ].filter(Boolean);

    const jsPDFCtor = window.jspdf?.jsPDF || window.jsPDF;
    const pdf = new jsPDFCtor({ orientation:'portrait', unit:'mm', format:'a4', compress:true });

    const msgs = [
      'Componiendo portada…',
      'Maquetando el activo…',
      'Insertando fotografías…',
      'Calculando la oportunidad…',
      'Negociación…',
      'Dibujando planos…',
      'El proyecto…',
      'Pintando el mapa…',
      'Testigos de mercado…',
      'Compilando escenarios…',
      'Calendario…',
      'Matrices de sensibilidad…',
      'Highlights…',
      'Cerrando con el logo…',
    ];

    for (let i = 0; i < slides.length; i++) {
      rwUpdateLoader(msgs[i] || `Slide ${i+1}…`, 0.18 + (i / slides.length) * 0.78, { cur: i+1, total: slides.length });
      container.innerHTML = slides[i];
      await new Promise(r => setTimeout(r, 160));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: i === 0 || i === slides.length - 1 ? '#0F1014' : '#FAFAF8',
        logging: false,
        width: 794, height: 1123,
        ignoreElements: el => el.classList?.contains('leaflet-tile-pane'),
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
    }

    rwUpdateLoader('Finalizando PDF…', 0.98, { cur: slides.length, total: slides.length });
    await new Promise(r => setTimeout(r, 300));

    const fn = dealName.replace(/[^a-zA-Z0-9 \-_áéíóúÁÉÍÓÚüÜñÑ]/g,'').trim().replace(/\s+/g,'_');
    pdf.save(`${fn || 'Dossier'}_Riverwalk.pdf`);

  } catch(e) {
    console.error('Dossier error:', e);
    alert('Error generando el dossier: ' + e.message);
  } finally {
    rwHideLoader();
    document.getElementById('rw-dossier-render')?.remove();
    if (btn) { btn.textContent = origTxt; btn.disabled = false; }
  }
}

