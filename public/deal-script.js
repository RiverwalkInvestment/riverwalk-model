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
let sfCarryMode = 'irr'; // default to the honest approach

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
let plusvaliaOn  = false;
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
  plusvaliaOn = on;
  const tog = (id, cls, active) => { const el=$(id); if(el) el.classList.toggle(cls, active); };
  const set = (id, val) => { const el=$(id); if(el) el.style.display = val; };
  tog('plusvalia-off-btn', 'active', !on);
  tog('plusvalia-on-btn',  'active',  on);
  set('plusvalia-manual-fields', on ? 'none' : '');
  set('plusvalia-auto-fields',   on ? '' : 'none');
  // Clear auto display when switching to manual
  if (!on) { const d = $('plusvalia-calc-display'); if(d) d.innerHTML = ''; }
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
  tog('mode-reforma-btn', 'active', mode === 'reforma');
  tog('mode-pase-btn',    'active', mode === 'pase');
  set('pase-note',           mode === 'pase'    ? '' : 'none');
  set('isec-capex',          mode === 'reforma' ? '' : 'none');
  set('cf-capex-block',      mode === 'reforma' ? '' : 'none');
  set('osec-sens1',          mode === 'reforma' ? '' : 'none');
  set('osec-sens2',          mode === 'reforma' ? '' : 'none');
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
  body.style.display = open ? 'none' : '';
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
        afterSF: afterCarry, tax, netProfit, roiNet
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
      return { loan, interest, equity, netProfitLev: netLev, roe: equity>0?netLev/equity:0, irr: 0 };
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
    return { loan, interest, equity, netProfitLev: netLev, roe, irr: annIRR(mr) };
  }

  const lev0  = levCalc(base, 0);
  const lev40 = levCalc(base, 0.40);
  const lev60 = levCalc(base, 0.60);

  // BREAKEVEN (after carry + tax)
  function breakeven() {
    let lo = 3000, hi = 50000;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (sc(mid).netProfit > 0) hi = mid; else lo = mid;
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
  if (kTotalN) kTotalN.textContent = isLev
    ? `${levMode.toUpperCase()} ${(ltvFrac*100).toFixed(0)}% · deuda ${fmtK(loanAmt)}`
    : 'Todo incluido · sin apalancamiento';
  const kProfit = $('kpi-profit');
  kProfit.textContent = fmtK(m.base.netProfit);
  kProfit.className = 'kpi-v ' + (m.base.netProfit>0?'up':'down');
  const beMarg = ((V('exitP')/m.bePriceM2-1)*100).toFixed(0);
  $('kpi-be').textContent = Math.round(m.bePriceM2).toLocaleString('es-ES') + ' €/m²';
  $('kpi-be-n').textContent = '+'+beMarg+'% sobre escenario pesimista';

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
      return `<div class="sc-card ${cls}">
        <div class="sc-head">${label} — ${exitM2.toLocaleString('es-ES')} €/m²</div>
        <div class="sc-big" style="font-size:36px">${irrShow}</div>
        <div class="sc-irr" style="font-size:10px;margin-bottom:4px">${isLev?'TIR equity':'TIR anual'} · ${durationMeses}m</div>
        <div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text-b);margin-bottom:10px">${moic}× · ${isLev?'ROE':'ROI'} ${fmtPct(roiShow)}</div>
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
    const heroVal  = isLev ? fmtPct(lev.roe) : fmtPct(sc.roiNet);
    const heroLbl  = isLev ? 'ROE neto (equity)' : 'ROI neto';
    return `<div class="sc-card ${cls}">
      <div class="sc-head">${label} — ${exitM2.toLocaleString('es-ES')} €/m²</div>
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
  const roiKpiVal = isLev ? (levBase?.roe || m.base.roiNet) : m.base.roiNet;
  kRoi.textContent = fmtPct(roiKpiVal);
  kRoi.className = 'kpi-v ' + (roiKpiVal>0.2?'up':roiKpiVal>0.1?'warn':'down');
  if (kRoiN) kRoiN.textContent = isLev
    ? `ROE neto · ${levMode.toUpperCase()} ${(m.ltvPct*100).toFixed(0)}%`
    : (taxOn ? 'ROI neto · post fees + impuestos' : 'ROI neto · post fees');

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
    ${V('exitFixed')>0?`<tr><td class="indent neg">Plusvalía + notaría venta</td><td class="neg">−${fmt(V('exitFixed')+V('exitFixedAjuste'))}</td></tr>`:''}
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
  <tr><td class="indent neg">Plusvalía + notaría venta</td><td colspan="2"></td><td class="neg">−${fmt(V('exitFixed')+V('exitFixedAjuste'))}</td></tr>
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
    th1 += `<th style="min-width:90px;white-space:nowrap;padding:5px 8px${isBase?';color:var(--gold)':''}">${p.toLocaleString('es-ES')} €${isBase?' ←':''}</th>`;
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

      tb1 += `<td class="${cls}" style="text-align:center;${isBaseCol ? 'background:rgba(196,151,90,0.08)' : ''}">
        <div style="font-size:11px;font-family:'DM Mono',monospace;font-weight:500">${irrStr}</div>
        <div style="font-size:8.5px;opacity:0.65;margin-top:1px">${(roiN*100).toFixed(1)}% ROI</div>
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
    th2 += `<th style="min-width:90px;white-space:nowrap${isBase?';color:var(--gold)':''}">${p.toLocaleString('es-ES')} €/m²${isBase?' ←':''}</th>`;
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

      tb2 += `<td class="${cls}" style="text-align:center;${isBaseC ? 'background:rgba(196,151,90,0.08)' : ''}">
        <div style="font-size:11px;font-family:'DM Mono',monospace;font-weight:500">${(roiN*100).toFixed(1)}%</div>
        <div style="font-size:8.5px;opacity:0.65;margin-top:1px">${fmt(totAdj).replace(' €','')}</div>
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
  const address = ($('dealAddress')?.value || '').trim();
  const status  = $('geo-status');
  if (!address || address.length < 6) return;

  if (status) { status.textContent = '⟳ Buscando código postal…'; status.style.color = 'var(--text-d)'; }

  try {
    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });

    if (!response.ok) throw new Error('api error');
    const parsed = await response.json();

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
  { id:1, desc:'Casa Lamar — Cedaceros 9 (mismo bloque)',  url:'', source:'Idealista', tipo:'estreno',   precio:3937500, m2:225 },
  { id:2, desc:'Comparable A — Centro prime',              url:'', source:'Idealista', tipo:'reformado', precio:3850000, m2:200 },
  { id:3, desc:'Comparable B — Centro prime',              url:'', source:'Idealista', tipo:'reformado', precio:4300000, m2:234 },
  { id:4, desc:'Comparable C — mismo edificio',            url:'', source:'Idealista', tipo:'reformado', precio:2200000, m2:120 },
  { id:5, desc:'Comparable D — a reformar',                url:'', source:'Fotocasa',  tipo:'reformar',  precio:1690000, m2:200 },
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
    const response = await fetch('/api/extract-comp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) throw new Error(`api error ${response.status}`);
    const parsed = await response.json();

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

// Enter key on URL input triggers extract
document.addEventListener('DOMContentLoaded', () => {
  const inp = $('comp-url-input');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') extractComp(); });
});

function renderCompInputs() {
  const container = $('comp-rows-input');
  if (!container) return;
  container.innerHTML = comps.map(c => {
    const ppm    = compPpm(c);
    const ppmStr = ppm ? `<span class="${tipoClass[c.tipo]}">${ppm.toLocaleString('es-ES')} €</span>` : '<span style="color:var(--text-d)">—</span>';
    const urlEl  = c.url ? `<a href="${c.url}" target="_blank" rel="noopener" class="comp-link" title="${c.url}">↗ ${c.source}</a>` : `<span style="font-size:9px;color:var(--text-d)">${c.source}</span>`;
    return `<div class="comp-row" id="ci-${c.id}">
      <div style="font-size:9px;color:var(--text-d);text-align:center;font-family:'DM Mono',monospace">${c.id}</div>
      <div style="display:flex;flex-direction:column;gap:3px;min-width:0">
        <input type="text" value="${c.desc.replace(/"/g,'&quot;')}" placeholder="Descripción breve…"
          oninput="comps.find(x=>x.id===${c.id}).desc=this.value;renderCompOutput()"
          style="font-family:'Raleway',sans-serif;font-size:11px;padding:4px 7px">
        <div style="padding-left:2px">${urlEl}</div>
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
        <button class="comp-del-btn" onclick="removeComp(${c.id})" title="Eliminar">×</button>
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

function renderNotariaAndPlusvalia(buyPrice, exitPriceBase, vcTotal, vcSuelo, anyoAdq, anyoVenta, tipoPlus) {
  // ── Notaría compra ────────────────────────────────────────────────────
  const nc = calcArancel(buyPrice);
  const nd = $('notaria-calc-display');
  if (nd && nc) {
    nd.innerHTML = `
      Arancel notario compra: <strong>${nc.notario.toLocaleString('es-ES')} €</strong> &nbsp;·&nbsp;
      Registro est.: <strong>${nc.registro.toLocaleString('es-ES')} €</strong> &nbsp;·&nbsp;
      <strong style="color:var(--gold)">Total: ${nc.total.toLocaleString('es-ES')} €</strong>
      <br><span style="color:var(--text-d);font-size:9px">Arancel RD 1426/1989 · escala progresiva sobre ${buyPrice.toLocaleString('es-ES')} €</span>`;
    // Auto-fill notaria field if user hasn't manually adjusted
    if (V('notariaAjuste') === 0) {
      const el = $('notaria');
      if (el && !el.dataset.manualOverride) {
        el.value = nc.total.toLocaleString('es-ES');
      }
    }
  }

  // ── Notaría venta ────────────────────────────────────────────────────
  const nv = calcArancel(exitPriceBase);

  // ── Plusvalía ────────────────────────────────────────────────────────
  const pv = plusvaliaOn ? calcPlusvalia(buyPrice, exitPriceBase, vcTotal, vcSuelo, anyoAdq, anyoVenta, tipoPlus) : null;
  const pd = $('plusvalia-calc-display');
  if (pd && plusvaliaOn) {
    if (!vcSuelo || vcSuelo <= 0) {
      pd.innerHTML = `<span style="color:var(--amber)">⚠ Introduce el valor catastral del suelo para calcular la plusvalía automáticamente</span>`;
    } else if (pv) {
      const metodo = pv.usaObjetivo ? 'objetivo ✓' : 'real ✓';
      const alt    = pv.usaObjetivo ? `real ${pv.cuotaReal !== null ? pv.cuotaReal.toLocaleString('es-ES')+' €' : 'n/a (sin ganancia)'}` : `objetivo ${pv.cuotaObjetivo.toLocaleString('es-ES')} €`;
      pd.innerHTML = `
        Tenencia vendedor: <strong>${pv.anos} años</strong> · Coef. ${pv.coef} · VC suelo: ${vcSuelo.toLocaleString('es-ES')} €<br>
        Método <strong style="color:var(--green)">${metodo}</strong>: base ${pv.usaObjetivo?pv.baseObjetivo.toLocaleString('es-ES'):pv.baseReal.toLocaleString('es-ES')} € × ${tipoPlus}% = <strong style="color:var(--gold)">${pv.cuotaFinal.toLocaleString('es-ES')} €</strong>
        <span style="color:var(--text-d)"> (alternativa ${alt})</span><br>
        Notaría venta est.: <strong>${nv ? nv.total.toLocaleString('es-ES') : '—'} €</strong>
        <br><span style="color:var(--text-d);font-size:9px">RDL 26/2021 · Se aplica el método más favorable para el contribuyente</span>`;

      // Auto-fill exitFixed
      const ef = $('exitFixed');
      if (ef && V('exitFixedAjuste') === 0) {
        const total = pv.cuotaFinal + (nv ? nv.total : 0);
        ef.value = total.toLocaleString('es-ES');
      }
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
    // Calculate and display notaria + plusvalia before main calc
    const buyPrice    = V('buyPrice');
    const exitBase    = V('exitB');
    const vcTotal     = V('vcTotal');
    const vcSuelo     = V('vcSuelo');
    const anyoAdq     = parseInt($('vcAnyoAdq')?.value) || 2010;
    const anyoVenta   = new Date().getFullYear() + Math.round(V('arasMonths') + V('monthsToSale') / 12);
    const tipoPlus    = V('plusvaliaTipo') || 29;
    renderNotariaAndPlusvalia(buyPrice, exitBase, vcTotal, vcSuelo, anyoAdq, anyoVenta, tipoPlus);

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
  'vcTotal','vcSuelo','vcAnyoAdq','plusvaliaTipo',
  'notariaAjuste','exitFixedAjuste'
];

const DEAL_STATES = [
  'sfMode','sfCarryMode','zcOn'
];

let deals = [];        // array of { name, fields:{}, states:{}, comps:[], sensPrices:[] }
let activeDealIdx = 0;

function captureCurrentDeal() {
  const fields = {};
  DEAL_FIELDS.forEach(id => {
    const el = $(id);
    if (el) fields[id] = el.value;
  });
  const states = { sfMode, sfCarryMode, zcOn, dealMode, ampliacionOn, taxOn, plusvaliaOn, levMode, sensPrices: [...sensPrices] };
  return { fields, states, comps: JSON.parse(JSON.stringify(comps)) };
}

function applyDeal(deal) {
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
  if (idx === activeDealIdx) return;
  saveDealSnapshot();
  activeDealIdx = idx;
  applyDeal(deals[idx]);
  renderTabs();
  update();
}

function addDeal(name) {
  saveDealSnapshot();
  const newDeal = {
    name: name || `Deal ${deals.length+1}`,
    fields: {}, states: { sfMode:'tramos', sfCarryMode:'irr', zcOn:false, dealMode:'reforma', ampliacionOn:false, taxOn:true, sensPrices:[12000,13000,14000,15000,16000,17000] },
    comps: []
  };
  // Defaults
  const defaults = {
    dealName:newDeal.name, dealAddress:'', dealCP:'', dealMunicipio:'Madrid',
    dealFloor:'', dealPuerta:'', dealCatastro:'',
    surfCapex:236,
    exitP:13000, exitB:15000, exitO:17000, brokerExit:3, exitFixed:15000,
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
  if (deals.length <= 1) return; // always keep at least one
  deals.splice(idx, 1);
  if (activeDealIdx >= deals.length) activeDealIdx = deals.length - 1;
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
  bar.innerHTML = deals.map((d, i) =>
    `<div class="tab-item${i===activeDealIdx?' active':''}" data-idx="${i}"
      onclick="switchTab(${i})" ondblclick="startRenameTab(${i},event)">
      <span class="tab-name" title="Doble clic para renombrar">${d.name}</span>
      ${deals.length > 1 ? `<button class="tab-close" onclick="removeDeal(${i},event)" title="Cerrar">×</button>` : ''}
    </div>`
  ).join('') +
  `<button class="tab-add" onclick="addDeal()" title="Nueva operación">+</button>`;
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
  if (btn) btn.textContent = darkMode ? '☀ Light' : '☾ Dark';
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

