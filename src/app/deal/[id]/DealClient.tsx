'use client'
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'

interface Props {
  dealId: string
  initialData: Record<string, unknown>
  initialName: string
  initialPhotos: string[]
  initialPlans: string[]
}

// Original deal modeler HTML body (tabs-bar + app-body)
const DEAL_HTML = `
<div id="print-cover" style="display:none;padding:32px 40px 24px;border-bottom:3px solid var(--gold);margin-bottom:0;background:#fff">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <img id="print-logo" style="height:24px;mix-blend-mode:multiply" alt="Riverwalk">
      <div style="font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-d);margin-top:6px">Real Estate Investments</div>
    </div>
    <div style="text-align:right">
      <div id="print-dealname" style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:400;color:var(--text-b);line-height:1.1"></div>
      <div id="print-dealaddr" style="font-size:10px;color:var(--text-d);margin-top:3px"></div>
      <div id="print-fecha" style="font-size:10.5px;color:var(--text-d);margin-top:2px;font-family:'DM Mono',monospace"></div>
      <div id="print-mode" style="display:inline-block;margin-top:8px;background:var(--d3);color:var(--text-d);font-size:8px;letter-spacing:0.15em;text-transform:uppercase;padding:3px 10px;border-left:2px solid var(--gold)"></div>
    </div>
  </div>
</div>

<div id="print-footer" style="display:none;position:fixed;bottom:0;left:0;right:0;padding:8px 32px;background:var(--d3);border-top:1px solid var(--line);justify-content:space-between;align-items:center;font-size:8px;color:var(--text-d);letter-spacing:0.1em">
  <img style="height:12px;mix-blend-mode:multiply;opacity:0.5" id="print-footer-logo" alt="Riverwalk">
  <span id="print-footer-mid">Riverwalk Real Estate Investments · Confidencial</span>
  <span id="print-footer-right"></span>
</div>

<div id="tabs-bar" class="tabs-bar"></div>

<div class="app-body">

<!-- ════════════════════════════════ INPUT PANEL ═══════════════════════════════ -->
<div class="input-panel">

  <!-- DEAL INFO -->
  <div class="isec">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Datos del deal</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <div class="irow full"><div class="field"><label>Nombre del activo</label><input id="dealName" value="Cedaceros 8 — 4ª Planta" oninput="update()"></div></div>

      <div class="idivider">Tipo de operación</div>
      <div class="toggle-row" style="margin-bottom:0">
        <button class="toggle-btn active" id="mode-reforma-btn" onclick="setDealMode('reforma')">🔨 Reforma integral</button>
        <button class="toggle-btn" id="mode-pase-btn" onclick="setDealMode('pase')">⚡ Pase</button>
        <button class="toggle-btn" id="mode-edificio-btn" onclick="setDealMode('edificio')">🏢 Edificio</button>
      </div>

      <div id="edificio-panel" style="display:none">
        <div style="font-size:10.5px;color:var(--text-d);margin:6px 0 10px;padding:8px 10px;background:rgba(139,105,20,0.07);border-left:2px solid var(--gold);line-height:1.7">
          <strong style="color:var(--gold)">Modo edificio:</strong> precio de compra único para el edificio. Define las unidades con su superficie y precio de salida. CapEx pro-rata de superficie, ajustable por unidad. Gastos (ITP, notaría) pro-rata.
        </div>
        <div class="irow">
          <div class="field"><label>Precio compra edificio (€)</label><input type="text" id="edifBuyPrice" data-fmt="money" value="3000000" oninput="updateEdificio()"></div>
          <div class="field"><label>ITP (%)</label><input type="number" id="edifItpPct" value="6" step="0.1" oninput="updateEdificio()"></div>
        </div>
        <div class="irow">
          <div class="field"><label>CapEx €/m² (reforma)</label><input type="number" id="edifObraM2" value="1800" oninput="updateEdificio()"></div>
          <div class="field"><label>Decoración €/m²</label><input type="number" id="edifDecoM2" value="400" oninput="updateEdificio()"></div>
        </div>
        <div class="irow">
          <div class="field"><label>Meses escritura → venta primera unidad</label><input type="number" id="edifMesesObra" value="14" oninput="updateEdificio()"></div>
          <div class="field"><label>Intervalo entre ventas (meses)</label><input type="number" id="edifMesesIntervalo" value="2" oninput="updateEdificio()"></div>
        </div>
        <div style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-d);margin:12px 0 6px;font-weight:500">Unidades del edificio</div>
        <div class="edificio-units">
          <div class="eu-row header">
            <div>Nombre / uso</div><div style="text-align:center">m²</div><div style="text-align:right">€/m² salida</div><div style="text-align:right">CapEx override</div><div style="text-align:right">Precio venta</div><div></div>
          </div>
          <div id="edificio-units-rows"></div>
          <div class="eu-total" id="edificio-units-total">
            <div style="color:var(--text-d)">TOTAL</div><div id="edif-total-m2" style="text-align:center">—</div><div></div><div id="edif-total-capex" style="text-align:right">—</div><div id="edif-total-venta" style="text-align:right;color:var(--gold)">—</div><div></div>
          </div>
        </div>
        <button onclick="addEdificioUnit()"
          style="margin-top:8px;width:100%;background:var(--d4);border:1px dashed var(--d6);color:var(--text-d);
                 font-family:'Raleway',sans-serif;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;
                 padding:8px;cursor:pointer">
          + Añadir unidad / amenity
        </button>
        <div style="margin-top:14px;padding:12px;background:var(--d3);border:1px solid var(--line)">
          <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-d);margin-bottom:8px">Resumen del proyecto</div>
          <div id="edificio-summary" style="font-size:11px;font-family:'DM Mono',monospace;color:var(--text-d);line-height:2;font-feature-settings:'tnum' 1"></div>
        </div>
      </div>

      <div id="pase-note" style="display:none;font-size:9px;color:var(--text-d);margin-top:8px;padding:8px 10px;background:rgba(139,105,20,0.07);border-left:2px solid var(--gold);line-height:1.7">
        <strong style="color:var(--gold)">Modo pase:</strong> sin CapEx ni reforma. Solo compra y venta rápida. El carry es un porcentaje fijo sobre el beneficio bruto.
      </div>

      <div class="idivider">Ubicación</div>
      <div class="irow full">
        <div class="field">
          <label>Dirección completa</label>
          <div style="position:relative">
            <input id="dealAddress" value="Calle Cedaceros 8"
              oninput="update();rwAcQuery(this.value)"
              onblur="geocodeAddress();setTimeout(rwAcHide,180)"
              onkeydown="rwAcKey(event)"
              placeholder="Calle, número…"
              autocomplete="off">
            <div id="rw-ac-dropdown" style="display:none;"></div>
          </div>
          <div id="geo-status" style="font-size:9px;margin-top:3px;min-height:14px"></div>
        </div>
      </div>
      <div class="irow">
        <div class="field">
          <label>Código postal</label>
          <input id="dealCP" value="28014" oninput="update()" placeholder="28xxx">
        </div>
        <div class="field"><label>Municipio</label><input id="dealMunicipio" value="Madrid" oninput="update()"></div>
      </div>
      <div class="irow">
        <div class="field"><label>Planta</label><input id="dealFloor" value="4ª" oninput="update()" placeholder="1ª, Bajo, Ático..."></div>
        <div class="field"><label>Puerta / Letra</label><input id="dealPuerta" value="" oninput="update()" placeholder="A, B, Dcha..."></div>
      </div>
      <div class="irow">
        <div class="field">
          <label>Orientación fachada</label>
          <select id="dealOrientacion" onchange="saveOrientacionOverride()" style="font-family:'DM Mono',monospace;font-size:12px">
            <option value="">— Automático (Overpass API) —</option>
            <option value="N">↑ Norte</option>
            <option value="NE">↗ Noreste</option>
            <option value="E">→ Este</option>
            <option value="SE">↘ Sureste</option>
            <option value="S">↓ Sur</option>
            <option value="SO">↙ Suroeste</option>
            <option value="O">← Oeste</option>
            <option value="NO">↖ Noroeste</option>
          </select>
          <div style="font-size:9px;color:var(--text-d);margin-top:3px">Si el automático no es correcto, selecciona la orientación real de la fachada principal.</div>
        </div>
      </div>

      <div class="idivider">Referencia catastral</div>
      <div class="irow full">
        <div class="field">
          <label>Ficha catastral (ref. catastro)</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input id="dealCatastro" value="2489901VK3728H0004UZ" style="flex:1;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.05em" oninput="validateCatastro();update()" placeholder="20 caracteres">
            <button onclick="openCatastro()" style="background:var(--d6);border:1px solid var(--line);color:var(--gold);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;padding:7px 10px;cursor:pointer;flex-shrink:0" title="Abrir en Sede del Catastro">↗</button>
          </div>
          <div id="catastro-status" style="font-size:10.5px;color:var(--text-d);margin-top:3px"></div>
        </div>
      </div>

      <div class="idivider">Superficies</div>
      <div style="font-size:10.5px;color:var(--text-d);margin:2px 0 8px;line-height:1.8">
        Los <strong style="color:var(--text-b)">metros construidos</strong> son la base tanto para el CapEx como para el precio de venta, que en España se escritura y negocia siempre sobre construidos.
      </div>
      <div class="irow full">
        <div class="field">
          <label>M² construidos (base CapEx y precio venta)</label>
          <input type="number" id="surfCapex" value="236" min="0" oninput="update()" placeholder="Con tabiques, muros y proporcional de zonas comunes">
        </div>
      </div>

      <div class="idivider">Precio de compra y arras</div>
      <div class="irow full">
        <div class="field"><label>Precio de compra (€)</label><input type="text" id="buyPrice" data-fmt="money" value="1675000" oninput="syncAras(null,'price')"></div>
      </div>
      <div class="irow">
        <div class="field"><label>Arras — importe (€)</label><input type="text" id="arasAmt" data-fmt="money" value="167500" onblur="syncAras(null,'amt');update()"></div>
        <div class="field"><label>Arras — % del precio</label><input type="number" id="arasPct" value="10" step="1" oninput="syncAras(this,'pct')" title="Se sincroniza con el importe"></div>
      </div>
    </div>
  </div>

  <!-- SALIDA -->
  <div class="isec">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl" id="isec-precios-lbl">Precios de salida</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <div class="sc-fields" style="margin-bottom:4px">
        <div class="sc-f p"><label>Pesimista (€/m²)</label><input type="number" id="exitP" value="15000" oninput="update()"></div>
        <div class="sc-f b"><label>Base (€/m²)</label><input type="number" id="exitB" value="16000" oninput="update()"></div>
        <div class="sc-f o"><label>Optimista (€/m²)</label><input type="number" id="exitO" value="17000" oninput="update()"></div>
      </div>
      <div id="exit-total-display" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="text-align:center;font-family:'DM Mono',monospace;font-size:10px;color:var(--red);font-feature-settings:'tnum' 1" id="exit-total-p">—</div>
        <div style="text-align:center;font-family:'DM Mono',monospace;font-size:10px;color:var(--amber);font-feature-settings:'tnum' 1" id="exit-total-b">—</div>
        <div style="text-align:center;font-family:'DM Mono',monospace;font-size:10px;color:var(--green);font-feature-settings:'tnum' 1" id="exit-total-o">—</div>
      </div>
      <div class="irow full">
        <div class="field"><label>Comisión broker salida (%)</label><input type="number" id="brokerExit" value="3" step="0.1" oninput="update()"></div>
      </div>

      <div class="idivider">Microzona y características del activo <span class="tag-optional">para precio sugerido</span></div>
      <div style="font-size:10.5px;color:var(--text-d);margin:2px 0 8px;line-height:1.8">
        Estos datos ajustan el precio sugerido en el motor de valoración. No modifican los campos de precio arriba — tú decides si aplicar la sugerencia.
      </div>
      <div class="irow full">
        <div class="field">
          <label>Microzona</label>
          <select id="microzona" onchange="renderPricingEngine()" style="font-size:12px;padding:8px 10px;background:var(--d4);border:1px solid var(--d6);color:var(--text-b)">
            <option value="">— Sin microzona —</option>
            <optgroup label="── Tier AA ──">
              <option>Jerónimos</option><option>Recoletos</option><option>Cortes / Huertas</option><option>Justicia</option><option>Almagro</option>
            </optgroup>
            <optgroup label="── Tier A ──">
              <option>Palacio / Ópera</option><option>Pintor Rosales</option><option>Serrano / Goya</option><option>Ibiza</option><option>Trafalgar</option><option>Chueca</option><option>Malasaña</option>
            </optgroup>
            <optgroup label="── Tier B ──">
              <option>Lista / Ayala</option><option>Ríos Rosas</option><option>Retiro sur</option><option>Argüelles centro</option><option>Sol / Gran Vía</option><option>Goya periferia</option>
            </optgroup>
            <optgroup label="── Tier C ──">
              <option>Pacífico</option><option>Lavapiés</option>
            </optgroup>
          </select>
        </div>
      </div>
      <div class="irow">
        <div class="field">
          <label>Tipo de unidad</label>
          <select id="prop-tipo" onchange="renderPricingEngine()" style="font-size:12px;padding:8px 10px;background:var(--d4);border:1px solid var(--d6);color:var(--text-b)">
            <option value="piso">Piso</option>
            <option value="atico_terraza">Ático con terraza</option>
            <option value="atico_sin">Ático sin terraza</option>
          </select>
        </div>
        <div class="field">
          <label>Orientación</label>
          <select id="prop-orient" onchange="renderPricingEngine()" style="font-size:12px;padding:8px 10px;background:var(--d4);border:1px solid var(--d6);color:var(--text-b)">
            <option value="ext_sur">Exterior sur/este</option>
            <option value="ext_norte">Exterior norte/oeste</option>
            <option value="int_luminoso">Interior luminoso</option>
            <option value="int_oscuro">Interior oscuro</option>
          </select>
        </div>
      </div>
      <div class="irow">
        <div class="field">
          <label>Planta</label>
          <select id="prop-planta" onchange="renderPricingEngine()" style="font-size:12px;padding:8px 10px;background:var(--d4);border:1px solid var(--d6);color:var(--text-b)">
            <option value="bajo">Bajo / Semisótano (−12%)</option>
            <option value="entre">Entresuelo / 1ª (−7%)</option>
            <option value="1sin">2ª sin ascensor (−5%)</option>
            <option value="base" selected>2ª–3ª con ascensor (base)</option>
            <option value="alta">4ª–5ª con ascensor (+4%)</option>
            <option value="muyalta">6ª–7ª con ascensor (+7%)</option>
          </select>
        </div>
        <div id="prop-adj-display" style="display:flex;align-items:flex-end;padding-bottom:2px">
          <div style="font-size:9.5px;color:var(--text-d);line-height:1.6" id="prop-adj-text">—</div>
        </div>
      </div>
    </div>
  </div>

  <!-- TIMING -->
  <div class="isec">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Calendario de la operación</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <div class="irow">
        <div class="field"><label>Meses entre arras y escritura</label><input type="number" id="arasMonths" value="2" min="1" oninput="autoFillDates();update()"></div>
        <div class="field"><label>Meses escritura → venta</label><input type="number" id="monthsToSale" value="12" min="1" oninput="autoFillDates();update()"></div>
      </div>

      <div class="idivider">
        Ampliación de arras
        <span class="tag-optional">opcional</span>
      </div>
      <div style="font-size:10.5px;color:var(--text-d);margin:2px 0 8px;line-height:1.8">
        Si se negocia una prórroga del período de arras, modela el coste de oportunidad adicional y el impacto en TIR.
      </div>
      <div class="toggle-row" style="margin-bottom:8px">
        <button class="toggle-btn active" id="ampliacion-no-btn" onclick="setAmpliacion(false)">Sin ampliación</button>
        <button class="toggle-btn" id="ampliacion-si-btn" onclick="setAmpliacion(true)">Con ampliación</button>
      </div>
      <div id="ampliacion-fields" style="display:none">
        <div class="irow">
          <div class="field">
            <label>Meses adicionales negociados</label>
            <input type="number" id="ampliacionMeses" value="2" min="1" oninput="update()">
          </div>
          <div class="field">
            <label>Arras adicionales (% del precio)</label>
            <input type="number" id="ampliacionPctCal" value="5" step="0.5" min="0" max="50" oninput="syncAmpliacion()">
            <div style="font-size:10.5px;color:var(--text-d);margin-top:3px" id="ampliacion-importe-cal">—</div>
          </div>
        </div>
        <div id="ampliacion-impact" style="font-size:10.5px;color:var(--text-d);margin-top:4px;padding:7px 10px;background:rgba(139,105,20,0.06);border-left:2px solid var(--gold)"></div>
      </div>
    </div>
  </div>

  <!-- ADQUISICIÓN -->
  <div class="isec">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Fechas del cashflow</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <div style="font-size:10.5px;color:var(--text-d);margin:4px 0 10px;line-height:1.8">
        Introduce la fecha de arras y el resto se calcula automáticamente a partir de los meses configurados. Puedes ajustar cualquier fecha manualmente.
      </div>
      <div class="date-input-row">
        <div class="field">
          <label>Fecha arras <span class="date-badge pago">pago</span></label>
          <input type="date" id="cfDateArras" value="2025-12-19"
            oninput="autoFillDates(); update()"
            style="font-family:'DM Mono',monospace;font-size:11px">
        </div>
        <div style="display:flex;align-items:flex-end;padding-bottom:1px">
          <button onclick="autoFillDates(true)"
            style="background:var(--gold);border:none;color:#fff;font-family:'Raleway',sans-serif;
                   font-size:8px;letter-spacing:0.15em;text-transform:uppercase;font-weight:600;
                   padding:8px 12px;cursor:pointer;white-space:nowrap;flex-shrink:0">
            ↻ Recalcular fechas
          </button>
        </div>
      </div>
      <div class="date-input-row">
        <div class="field">
          <label>Fecha escritura <span class="date-badge pago">pago</span></label>
          <input type="date" id="cfDateEscritura" oninput="update()" style="font-family:'DM Mono',monospace;font-size:11px">
        </div>
        <div class="field">
          <label>Fecha venta <span class="date-badge ingreso">ingreso</span></label>
          <input type="date" id="cfDateVenta" oninput="update()" style="font-family:'DM Mono',monospace;font-size:11px">
        </div>
      </div>

      <!-- Ampliación de arras — fecha, visible sólo si ampliacionOn -->
      <div id="cf-ampliacion-block" style="display:none">
        <div class="idivider">Ampliación de arras <span class="date-badge pago">pago adicional</span></div>
        <div class="date-input-row">
          <div class="field">
            <label>Fecha pago ampliación arras</label>
            <input type="date" id="cfDateAmpliacion" oninput="update()" style="font-family:'DM Mono',monospace;font-size:11px">
          </div>
          <div class="field">
            <label>Arras adicionales (% s/precio compra)</label>
            <input type="number" id="ampliacionPct" value="5" step="0.5" min="0" max="50" oninput="syncAmpliacion();update()" style="text-align:right">
            <div style="font-size:9px;color:var(--gold);margin-top:3px;font-family:'DM Mono',monospace" id="ampliacion-importe-display">— €</div>
          </div>
        </div>
        <div class="date-input-row full">
          <div class="field">
            <label>Nueva fecha escritura (tras ampliación) <span class="date-badge pago">desembolso final</span></label>
            <input type="date" id="cfDateEscrituraAmp" oninput="update()" style="font-family:'DM Mono',monospace;font-size:11px">
          </div>
        </div>
      </div>

      <!-- CapEx dates — sólo en modo reforma -->
      <div id="cf-capex-block">
        <div class="idivider">Tramos CapEx — certificaciones</div>
        <div style="font-size:10.5px;color:var(--text-d);margin:2px 0 8px;line-height:1.8">
          50% en escritura · 20% cert. 50% · 20% cert. 70% · 10% entrega
        </div>
        <div class="date-input-row">
          <div class="field">
            <label>Certificación 50% obra <span class="date-badge pago">auto</span></label>
            <input type="date" id="cfDateCert50" oninput="update()" style="font-family:'DM Mono',monospace;font-size:11px">
          </div>
          <div class="field">
            <label>Certificación 70% obra <span class="date-badge pago">auto</span></label>
            <input type="date" id="cfDateCert70" oninput="update()" style="font-family:'DM Mono',monospace;font-size:11px">
          </div>
        </div>
        <div class="date-input-row full">
          <div class="field">
            <label>Entrega de obra <span class="date-badge pago">auto · último tramo CapEx</span></label>
            <input type="date" id="cfDateEntrega" oninput="update()" style="font-family:'DM Mono',monospace;font-size:11px">
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ADQUISICIÓN -->
  <div class="isec">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Adquisición</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <div class="irow">
        <div class="field"><label>ITP (%)</label><input type="number" id="itpPct" value="2" step="0.1" oninput="update()"></div>
        <div class="field"><label>Tipo ITP <span class="tag-optional">si procede</span></label>
          <select id="itpTipo" onchange="update()" style="font-size:11px;padding:5px 6px">
            <option value="manual">% manual (arriba)</option>
            <option value="tpo">TPO 6% — 2ª transmisión</option>
            <option value="ajd">AJD 0,75% — obra nueva</option>
          </select>
        </div>
      </div>

      <div class="idivider">Gastos notariales — calculados automáticamente</div>
      <div style="font-size:10.5px;color:var(--text-d);margin:2px 0 8px;line-height:1.8">
        Arancel RD 1426/1989 + registro estimado. Se recalcula automáticamente con el precio de compra.
      </div>
      <div id="notaria-calc-display" style="background:var(--d4);border:1px solid var(--line);padding:10px 12px;margin-bottom:8px;font-size:10px;font-family:'DM Mono',monospace;line-height:1.9"></div>
      <div class="irow">
        <div class="field">
          <label>Notaría compra (€) <span class="tag-optional">auto-calculado</span></label>
          <input type="text" id="notaria" data-fmt="money" value="3000" placeholder="Auto-calculado">
        </div>
        <div class="field">
          <label>Ajuste manual (€) <span class="tag-optional">±</span></label>
          <input type="text" id="notariaAjuste" data-fmt="money" value="0" placeholder="0 — añadir o restar">
        </div>
      </div>

      <div class="idivider">Costes de salida variables</div>
      <div style="font-size:10.5px;color:var(--text-d);margin:2px 0 8px;line-height:1.8">
        Notaría de venta, plusvalía municipal y otros costes variables al cierre. Estimación manual por operación.
      </div>
      <div class="irow">
        <div class="field">
          <label>Notaría venta + otros costes (€)</label>
          <input type="text" id="exitFixed" data-fmt="money" value="8000" placeholder="Ej: 8.000 €">
        </div>
        <div class="field">
          <label>Ajuste (€) <span class="tag-optional">±</span></label>
          <input type="text" id="exitFixedAjuste" data-fmt="money" value="0" placeholder="0">
        </div>
      </div>

      <div class="irow">
        <div class="field"><label>Comunidad/mes (€)</label><input type="text" id="comunidad" data-fmt="money" value="290"></div>
        <div class="field"><label>IBI anual (€)</label><input type="text" id="ibi" data-fmt="money" value="0"></div>
      </div>
      <div class="idivider">Broker fee de compra <span class="tag-optional">opcional</span></div>
      <div style="font-size:10.5px;color:var(--text-d);margin:2px 0 8px;line-height:1.8">Comisión a inmobiliaria o intermediario externo sobre el precio de compra.</div>
      <div class="irow">
        <div class="field"><label>Broker fee (% s/precio compra)</label><input type="number" id="brokerBuyPct" value="0" step="0.5" oninput="update()" placeholder="0"></div>
        <div class="field"><label>O importe fijo (€)</label><input type="text" id="brokerBuyFixed" data-fmt="money" value="0" placeholder="0 — prevalece si > 0"></div>
      </div>
      <div class="idivider">Fees adicionales a terceros <span class="tag-optional">opcional</span></div>
      <div class="irow full"><div class="field"><label>Intermediarios / desbloqueo proindiviso (€)</label><input type="text" id="intermediaryFee" data-fmt="money" value="40000" placeholder="0 si no aplica"></div></div>
      <div class="irow full"><div class="field"><label>Descripción del concepto</label><input id="intermediaryDesc" value="Prima al hermano bloqueante (25% proindiviso)" oninput="update()" placeholder="Ej: comisión intermediario, proindiviso..."></div></div>
    </div>
  </div>

  <!-- CAPEX -->
  <div class="isec" id="isec-capex">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">CapEx (sin IVA)</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <div class="irow">
        <div class="field"><label>Obra (€/m²)</label><input type="number" id="obraM2" value="1800" oninput="update()"></div>
        <div class="field"><label>Decoración FF&E (€/m²)</label><input type="number" id="decoM2" value="400" oninput="update()"></div>
      </div>
      <div class="irow full">
        <div class="field">
          <label>Provisión sobrecoste obra (%)</label>
          <input type="range" id="overSlider" min="0" max="40" step="5" value="0" oninput="syncSlider(this,'overPct','overSlider')">
          <div class="rv" id="overSlider-rv">0% — Sin provisión</div>
          <input type="hidden" id="overPct" value="0">
        </div>
      </div>
      <div class="idivider">Zonas comunes <span class="tag-optional">opcional</span></div>
      <div class="irow full">
        <div class="field">
          <label>Activar partida zonas comunes</label>
          <div class="toggle-row">
            <button class="toggle-btn" id="zc-off" onclick="toggleZC(false)">No aplica</button>
            <button class="toggle-btn active" id="zc-on" onclick="toggleZC(true)">Incluir</button>
          </div>
        </div>
      </div>
      <div id="zc-fields">
        <div class="irow">
          <div class="field"><label>Coste zonas comunes (€)</label><input type="text" id="zcCost" data-fmt="money" value="0" placeholder="0"></div>
          <div class="field"><label>Descripción</label><input id="zcDesc" value="Rehabilitación portal / zonas comunes" oninput="update()"></div>
        </div>
      </div>
      <div class="idivider">IVA</div>
      <div class="irow full">
        <div class="field"><label>IVA sobre obra y fees (%)</label><input type="number" id="ivaObra" value="21" step="1" oninput="update()"></div>
      </div>
    </div>
  </div>

  <!-- FEES RIVERWALK -->
  <div class="isec">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Fees Riverwalk</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <!-- Pase: management fee sobre precio activo + carry sobre beneficio post-fees -->
      <div id="fees-pase-fields" style="display:none">
        <div style="font-size:10.5px;color:var(--text-d);margin:6px 0 10px;line-height:1.8">
          En el pase no hay obra, así que la base del management fee es el <strong style="color:var(--text-b)">precio del activo</strong>. El carry se aplica sobre el beneficio bruto <strong style="color:var(--text-b)">después de descontar</strong> el management fee.
        </div>
        <div class="idivider">Management fee</div>
        <div class="irow full">
          <div class="field">
            <label>Management fee (%) + IVA — base = precio activo</label>
            <input type="range" id="paseMgmtSlider" min="0" max="5" step="0.5" value="2" oninput="syncPaseMgmt(this)">
            <div class="rv" id="paseMgmtSlider-rv">2.0% sobre precio del activo</div>
            <input type="hidden" id="paseMgmtPct" value="2">
          </div>
        </div>
        <div class="idivider">Carry sobre beneficio neto de fees</div>
        <div class="irow">
          <div class="field"><label>Carry Riverwalk (% s/ beneficio post-fees)</label><input type="number" id="paseCarryPct" value="30" step="1" oninput="update()"></div>
          <div class="field"><label>IVA sobre carry (%)</label><input type="number" id="paseCarryIVA" value="21" step="1" oninput="update()"></div>
        </div>
      </div>

      <!-- Reforma: management fee + success fee -->
      <div id="fees-reforma-fields">
      <div style="font-size:10.5px;color:var(--text-d);margin:6px 0 8px;line-height:1.8">
        Base = <strong style="color:var(--text-b)">precio de compra + CapEx neto (sin IVA)</strong>. Rango habitual 3–5%. El IVA del fee se añade encima como coste separado del proyecto.
      </div>
      <div class="irow full">
        <div class="field">
          <label>Management fee (%) + IVA</label>
          <input type="range" id="mgmtSlider" min="3" max="5" step="0.5" value="4" oninput="syncMgmt(this)">
          <div class="rv" id="mgmtSlider-rv">4.0% sobre precio + CapEx neto</div>
          <input type="hidden" id="mgmtFeePct" value="4">
        </div>
      </div>
      <div class="idivider">Success Fee — modelo</div>
      <div class="toggle-row">
        <button class="toggle-btn active" id="sf-tramos-btn" onclick="setSFMode('tramos')">Escalado por tramos</button>
        <button class="toggle-btn" id="sf-fijo-btn" onclick="setSFMode('fijo')">Fijo 30%</button>
      </div>
      <div id="sf-tramos-fields">
        <div class="idivider" style="margin-top:6px">Cálculo de umbrales</div>
        <div class="toggle-row">
          <button class="toggle-btn" id="carry-roi-btn" onclick="setCarryMode('roi')" title="Los umbrales son % de ROI total sobre capital invertido">ROI simple</button>
          <button class="toggle-btn active" id="carry-irr-btn" onclick="setCarryMode('irr')" title="Los umbrales son TIR anualizada — como PE institucional">TIR anualizada ★</button>
        </div>
        <div id="carry-mode-desc" style="font-size:10.5px;color:var(--text-d);margin:4px 0 8px;line-height:1.8">
          <strong style="color:var(--gold)">TIR anualizada:</strong> los umbrales (12,5% / 25%) son tasas anualizadas. En una operación de 14 meses, el carry solo aplica si la TIR real supera esos umbrales. Más honesto, más institucional.
        </div>
        <div class="irow tri">
          <div class="field"><label>Umbral 1 (% anual)</label><input type="number" id="sf1T" value="12.5" step="0.5" oninput="update()"></div>
          <div class="field"><label>Umbral 2 (% anual)</label><input type="number" id="sf2T" value="25" step="0.5" oninput="update()"></div>
          <div class="field"><label>–</label><input disabled value="∞"></div>
        </div>
        <div class="irow tri">
          <div class="field"><label>0–U1: part. (%)</label><input type="number" id="sf0P" value="0" oninput="update()"></div>
          <div class="field"><label>U1–U2: part. (%)</label><input type="number" id="sf1P" value="30" oninput="update()"></div>
          <div class="field"><label>+U2: part. (%)</label><input type="number" id="sf2P" value="50" oninput="update()"></div>
        </div>
      </div>
      <div id="sf-fijo-fields" style="display:none">
        <div class="irow full">
          <div class="field"><label>Success Fee fijo (% sobre beneficio bruto)</label><input type="number" id="sfFijoPct" value="30" oninput="update()"></div>
        </div>
      </div>
      </div><!-- end fees-reforma-fields -->
    </div>
  </div>

  <!-- APALANCAMIENTO -->
  <div class="isec">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Apalancamiento</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <div class="toggle-row" style="margin-bottom:10px">
        <button class="toggle-btn active" id="lev-ltv-btn" onclick="setLevMode('ltv')">LTV — s/ precio compra</button>
        <button class="toggle-btn" id="lev-ltc-btn" onclick="setLevMode('ltc')">LTC — s/ coste total</button>
      </div>
      <div id="lev-mode-desc" style="font-size:9px;color:var(--text-d);margin:-4px 0 10px;line-height:1.7;padding:7px 10px;background:rgba(139,105,20,0.05);border-left:2px solid var(--line)">
        <strong style="color:var(--text-b)">LTV</strong> — Loan-to-Value: el banco presta un % del precio de compra. Más habitual en hipotecas estándar.
      </div>
      <div class="field" style="margin-bottom:10px">
        <label id="lev-slider-label">Porcentaje (%)</label>
        <input type="range" id="ltvSlider" min="0" max="70" step="10" value="0" oninput="syncSlider(this,'ltv','ltvSlider')">
        <div class="rv" id="ltvSlider-rv">0% — Sin apalancamiento</div>
        <input type="hidden" id="ltv" value="0">
      </div>
      <div class="irow">
        <div class="field"><label>Tipo interés bridge (% anual)</label><input type="number" id="bridgeRate" value="5" step="0.25" oninput="update()"></div>
        <div class="field"><label>Meses del bridge</label><input type="number" id="bridgeMonths" value="14" oninput="update()"></div>
      </div>
    </div>
  </div>

  <!-- COMPARABLES -->
  <div class="isec">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Testigos de mercado</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <div style="font-size:10.5px;color:var(--text-d);margin:4px 0 12px;line-height:1.8">
        Tres formas de añadir testigos: <strong style="color:var(--text-b)">bookmarklet</strong> desde Idealista/Fotocasa en un clic, <strong style="color:var(--text-b)">Registro</strong> con datos reales de cierre, o <strong style="color:var(--text-b)">entrada rápida</strong> desde el móvil.
      </div>

      <!-- BOOKMARKLET -->
      <div style="background:rgba(139,105,20,0.06);border:1px solid rgba(139,105,20,0.2);padding:12px 14px;margin-bottom:12px">
        <div style="font-size:8.5px;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;font-weight:600">🔖 Bookmarklet — importar desde Idealista / Fotocasa</div>
        <div style="font-size:10.5px;color:var(--text-d);line-height:1.75;margin-bottom:10px">
          Instala el botón en Chrome y úsalo en cualquier anuncio para capturar precio, m², planta y orientación en un clic.
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <a id="bookmarklet-link" href="#"
            style="display:inline-block;background:var(--d5);border:1px solid var(--gold);color:var(--gold);
                   font-family:'Raleway',sans-serif;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;
                   font-weight:600;padding:8px 14px;text-decoration:none;cursor:move;user-select:none;flex-shrink:0"
            ondragstart="event.dataTransfer.setData('text/plain',this.href)"
            onclick="alert('Arrastra este botón a la barra de favoritos de Chrome.\\n\\nCuando estés en un anuncio de Idealista o Fotocasa, pulsa ese favorito → los datos se copian al portapapeles → vuelve aquí y pulsa \\'Pegar testigo\\'.');return false;"
            title="Arrastra a la barra de favoritos de Chrome">
            📌 Importar testigo
          </a>
          <span style="font-size:9px;color:var(--text-d)">← arrastra a Favoritos de Chrome</span>
        </div>
      </div>

      <!-- MOBILE QUICK ENTRY -->
      <div style="margin-bottom:12px">
        <button onclick="toggleQuickEntry()"
          style="width:100%;background:var(--d4);border:1px solid var(--line);color:var(--text-d);
                 font-family:'Raleway',sans-serif;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;
                 font-weight:600;padding:9px 14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between">
          <span>📱 Entrada rápida</span>
          <span id="quick-entry-arr" style="transition:transform 0.2s">▼</span>
        </button>
        <div id="quick-entry-panel" style="display:none;background:var(--d3);border:1px solid var(--line2);border-top:none;padding:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div class="field"><label>Precio total (€)</label>
              <input type="number" id="qe-precio" placeholder="450000" oninput="updateQEPreview()"
                style="font-size:16px;padding:12px 10px;-webkit-appearance:none"></div>
            <div class="field"><label>Superficie (m²)</label>
              <input type="number" id="qe-m2" placeholder="85" oninput="updateQEPreview()"
                style="font-size:16px;padding:12px 10px;-webkit-appearance:none"></div>
          </div>
          <div class="field" style="margin-bottom:8px"><label>Descripción / calle</label>
            <input type="text" id="qe-desc" placeholder="Ej: Velázquez 12, 3º ext."
              style="font-size:15px;padding:11px 10px"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div class="field"><label>Estado</label>
              <select id="qe-tipo" style="font-size:13px;padding:10px 8px;background:var(--d4);border:1px solid var(--d6);color:var(--text-b)">
                <option value="reformado">Reformado</option>
                <option value="estreno">Estreno</option>
                <option value="reformar">A reformar</option>
              </select></div>
            <div class="field"><label>Fuente</label>
              <select id="qe-source" style="font-size:13px;padding:10px 8px;background:var(--d4);border:1px solid var(--d6);color:var(--text-b)">
                <option>Idealista</option><option>Fotocasa</option><option>Manual</option><option>Registro</option>
              </select></div>
          </div>
          <div style="display:grid;grid-template-columns:80px 1fr 1fr;gap:6px;margin-bottom:10px">
            <div class="field"><label>Planta</label>
              <input type="number" id="qe-planta" placeholder="—" min="0" max="30"
                style="font-size:14px;padding:10px 8px;text-align:center"></div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <label style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-d);font-weight:500">Orientación</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px">
                <button id="qe-ext-btn" onclick="setQEExt(true)"
                  style="padding:10px 4px;background:rgba(30,122,69,0.25);border:1px solid var(--green);
                         color:var(--green);font-size:10px;cursor:pointer;font-weight:700">Ext</button>
                <button id="qe-int-btn" onclick="setQEExt(false)"
                  style="padding:10px 4px;background:var(--d4);border:1px solid var(--d6);
                         color:var(--text-d);font-size:10px;cursor:pointer">Int</button>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <label style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-d);font-weight:500">Ascensor</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px">
                <button id="qe-asc-si" onclick="setQEAsc(true)"
                  style="padding:10px 4px;background:rgba(30,122,69,0.25);border:1px solid var(--green);
                         color:var(--green);font-size:10px;cursor:pointer;font-weight:700">Sí</button>
                <button id="qe-asc-no" onclick="setQEAsc(false)"
                  style="padding:10px 4px;background:var(--d4);border:1px solid var(--d6);
                         color:var(--text-d);font-size:10px;cursor:pointer">No</button>
              </div>
            </div>
          </div>
          <div id="qe-preview" style="font-family:'DM Mono',monospace;font-size:12px;color:var(--gold);
               margin-bottom:10px;min-height:18px;font-feature-settings:'tnum' 1;text-align:center"></div>
          <button onclick="addQuickEntry()"
            style="width:100%;background:var(--gold);border:none;color:#fff;font-family:'Raleway',sans-serif;
                   font-size:11px;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;padding:13px;cursor:pointer">
            + Añadir testigo
          </button>
        </div>
      </div>

      <!-- REGISTRO SEARCH -->
      <div style="background:rgba(139,105,20,0.06);border:1px solid rgba(139,105,20,0.2);padding:12px 14px;margin-bottom:14px">
        <div style="font-size:8.5px;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;font-weight:600">
          🏛 Registro de la Propiedad — Q1 2025 · 10.864 transacciones Madrid
        </div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <input type="text" id="registro-cp" placeholder="Código postal (ej: 28006)"
            maxlength="5"
            onkeydown="if(event.key==='Enter') buscarRegistro()"
            style="width:130px;background:var(--d4);border:1px solid var(--gold-d);color:var(--text-b);
                   font-family:'DM Mono',monospace;font-size:13px;padding:8px 10px;outline:none;letter-spacing:0.05em">
          <select id="registro-tipo"
            style="background:var(--d4);border:1px solid var(--d6);color:var(--text-b);
                   font-family:'Raleway',sans-serif;font-size:11px;padding:8px 10px;outline:none;flex:1">
            <option value="">Todos los tipos</option>
            <option value="flat">Piso (Flat)</option>
            <option value="terraced">Adosado (Terraced)</option>
          </select>
          <button onclick="buscarRegistro()"
            style="background:var(--gold);border:none;color:#fff;font-family:'Raleway',sans-serif;
                   font-size:9px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;
                   padding:8px 14px;cursor:pointer;white-space:nowrap;flex-shrink:0">
            Buscar
          </button>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
          <span style="font-size:9.5px;color:var(--text-d)">€/m² entre</span>
          <input type="number" id="registro-min" placeholder="mín" value=""
            style="width:70px;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);
                   font-family:'DM Mono',monospace;font-size:12px;padding:6px 8px;outline:none;font-feature-settings:'tnum' 1">
          <span style="font-size:9.5px;color:var(--text-d)">y</span>
          <input type="number" id="registro-max" placeholder="máx" value=""
            style="width:70px;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);
                   font-family:'DM Mono',monospace;font-size:12px;padding:6px 8px;outline:none;font-feature-settings:'tnum' 1">
          <span style="font-size:9.5px;color:var(--text-d)">superficie entre</span>
          <input type="number" id="registro-sup-min" placeholder="m²" value=""
            style="width:60px;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);
                   font-family:'DM Mono',monospace;font-size:12px;padding:6px 8px;outline:none">
          <span style="font-size:9.5px;color:var(--text-d)">–</span>
          <input type="number" id="registro-sup-max" placeholder="m²" value=""
            style="width:60px;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);
                   font-family:'DM Mono',monospace;font-size:12px;padding:6px 8px;outline:none">
        </div>
        <div id="registro-results-summary" style="font-size:9.5px;color:var(--text-d);margin-bottom:6px"></div>
        <div id="registro-results" style="max-height:220px;overflow-y:auto;display:none">
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
              <tr style="position:sticky;top:0;background:var(--d3)">
                <th style="text-align:left;padding:5px 8px;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-d);font-weight:500;border-bottom:1px solid var(--line)">Calle</th>
                <th style="text-align:right;padding:5px 8px;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-d);font-weight:500;border-bottom:1px solid var(--line)">Precio</th>
                <th style="text-align:right;padding:5px 8px;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-d);font-weight:500;border-bottom:1px solid var(--line)">M²</th>
                <th style="text-align:right;padding:5px 8px;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);font-weight:600;border-bottom:1px solid var(--line)">€/m²</th>
                <th style="text-align:center;padding:5px 8px;font-size:8px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-d);font-weight:500;border-bottom:1px solid var(--line)">Fecha</th>
                <th style="border-bottom:1px solid var(--line)"></th>
              </tr>
            </thead>
            <tbody id="registro-tbody"></tbody>
          </table>
        </div>
        <div id="registro-stats" style="display:none;margin-top:8px;padding:8px 10px;background:var(--d3);font-size:10.5px;color:var(--text-d);line-height:1.7"></div>
      </div>

      <!-- BOOKMARKLET PASTE -->
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
        <button type="button" onclick="rwPasteComp()"
          style="flex:1;background:rgba(139,105,20,0.12);border:1px solid rgba(196,151,90,0.35);
                 color:var(--gold);font-family:'Raleway',sans-serif;font-size:10px;letter-spacing:0.15em;
                 text-transform:uppercase;font-weight:600;padding:9px 16px;cursor:pointer">
          📋 Pegar testigo desde bookmarklet
        </button>
      </div>
      <div id="comp-extract-status" style="font-size:10px;color:var(--text-d);margin-bottom:10px;min-height:16px"></div>

      <!-- COMP LIST -->
      <div class="comp-row header">
        <div>Descripción</div>
        <div>Estado</div>
        <div>Precio</div>
        <div>M²</div>
        <div>€/m²</div>
        <div></div>
      </div>
      <div id="comp-rows-input"></div>
      <button class="comp-add-btn" onclick="addComp()">+ Añadir testigo manual</button>

      <!-- PRICING ENGINE OUTPUT -->
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--line2)">
        <div style="font-size:8.5px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-d);margin-bottom:8px;font-weight:500">Motor de valoración → precios de salida</div>
        <div id="pricing-engine-output"></div>
      <!-- PLANS + MATERIALS in dossier -->
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line2)">
        <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-d);margin-bottom:8px;font-weight:500">Planos y distribución (máx. 3)</div>
        <div id="dossier-plans-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px"></div>
        <label style="display:block;width:100%;background:var(--d4);border:1px dashed var(--d6);color:var(--text-d);font-family:'Raleway',sans-serif;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;padding:8px;cursor:pointer;text-align:center" id="plans-upload-label">
          + Añadir plano
          <input type="file" accept="image/*" multiple style="display:none" id="plans-file-input" onchange="handlePlanUpload(this)">
        </label>
      </div>

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line2)">
        <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-d);margin-bottom:8px;font-weight:500">Tipología de interiorismo</div>
        <div style="position:relative">
          <select id="interiorismStyle" onchange="saveInteriorismStyle()" style="width:100%;background:var(--d4);border:1px solid var(--d6);color:var(--text);font-family:'Raleway',sans-serif;font-size:11px;padding:10px 32px 10px 12px;cursor:pointer;appearance:none;-webkit-appearance:none;outline:none">
            <option value="">— Seleccionar tipología —</option>
            <option value="soft-minimalism">Soft Minimalism</option>
            <option value="modern-classic">Modern Classic</option>
            <option value="contemporary-warm">Contemporary Warm Luxury</option>
          </select>
          <div style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--text-d);font-size:10px">▾</div>
        </div>
        <div id="interiorism-preview" style="margin-top:8px;display:none;overflow:hidden;border:1px solid var(--line2)">
          <img id="interiorism-preview-img" style="width:100%;height:80px;object-fit:cover;display:block;" src="" alt="">
        </div>
      </div>

      </div>
    </div>
  </div>

  <!-- SENSITIVITY PRICES -->
  <div class="isec">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Rango de precios — matrices de sensibilidad</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <div style="font-size:10.5px;color:var(--text-d);margin:4px 0 12px;line-height:1.8">
        Define los 6 precios de las columnas de ambas matrices. Ajústalos a la zona del activo.
        Los precios deben estar en orden ascendente.
      </div>

      <!-- PRESETS -->
      <div style="font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-d);margin-bottom:6px">Presets por zona</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px" id="sens-presets"></div>

      <!-- CUSTOM INPUTS -->
      <div style="font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-d);margin-bottom:8px">Personalizar columnas</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px" id="sens-price-inputs"></div>
      <div style="margin-top:10px;font-size:9px;color:var(--text-d)" id="sens-price-preview"></div>
    </div>
  </div>

  <!-- FISCAL -->
  <div class="isec">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Fiscalidad</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <div style="font-size:10.5px;color:var(--text-d);margin:4px 0 10px;line-height:1.8">
        La fiscalidad depende de la estrategia de cada inversor. Actívala para ver el impacto real post-impuestos o desactívala para analizar el retorno bruto.
      </div>
      <div class="toggle-row" style="margin-bottom:10px">
        <button class="toggle-btn" id="tax-off-btn" onclick="setTaxMode(false)">Sin impuesto</button>
        <button class="toggle-btn active" id="tax-on-btn" onclick="setTaxMode(true)">Con impuesto</button>
      </div>
      <div id="tax-fields">
        <div class="irow">
          <div class="field"><label>Tipo impositivo (%)</label><input type="number" id="taxRate" value="25" step="1" oninput="update()"></div>
          <div class="field"><label>Estructura</label>
            <select id="taxStructure" onchange="update()">
              <option value="sl">S.L. — IS 25%</option>
              <option value="pf">Persona física — IRPF</option>
            </select>
          </div>
        </div>
      </div>
      <div id="tax-off-note" style="display:none;font-size:9px;color:var(--amber);padding:8px 10px;background:rgba(184,101,10,0.06);border-left:2px solid var(--amber);line-height:1.7">
        Los retornos se muestran <strong style="color:var(--text-b)">pre-impuestos</strong>. Cada inversor aplica su propia estructura fiscal. Recuerda incluir la fiscalidad en tu análisis final antes de tomar decisiones.
      </div>
    </div>
  </div>

  <!-- NEGOCIACIÓN — HISTORIAL BID/ASK -->
  <div class="isec" id="isec-negociacion">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Negociación — Historial bid/ask</span>
      <span class="isec-arr">▶</span>
    </div>
    <div class="ibody" style="display:none">
      <div style="font-size:10.5px;color:var(--text-d);margin:4px 0 12px;line-height:1.8">
        Registra el recorrido de negociación desde el precio inicial hasta el precio pactado. Se mostrará como un timeline visual en la presentación.
      </div>
      <div id="neg-hitos-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px"></div>
      <button type="button" onclick="addNegHito()" style="width:100%;background:rgba(196,151,90,0.08);border:1px dashed rgba(196,151,90,0.3);color:rgba(196,151,90,0.7);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;padding:8px;cursor:pointer;font-family:'Raleway',sans-serif">+ Añadir hito</button>
    </div>
  </div>

  <!-- ESTRUCTURACIÓN DE LA OPERACIÓN -->
  <div class="isec" id="isec-estructura">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Estructuración de la operación</span>
      <span class="isec-arr">▶</span>
    </div>
    <div class="ibody" style="display:none">
      <div style="font-size:10.5px;color:var(--text-d);margin:4px 0 12px;line-height:1.8">
        Define la estructura de inversión para los inversores. Solo se mostrará lo que selecciones en los highlights finales.
      </div>

      <div class="idivider">Ticket de inversión</div>
      <div class="irow full">
        <div class="field">
          <label>Ticket mínimo de inversión (€)</label>
          <input type="text" id="ticketMinimo" data-fmt="money" value="50000" oninput="saveEstructura()" placeholder="50.000 €">
        </div>
      </div>

      <div class="idivider">Vehículo de inversión</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px" id="vehiculo-options">
        <label onclick="setVehiculo('spv_unica')" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--d4);border:1px solid var(--d6);cursor:pointer;transition:all 0.15s" id="veh-spv_unica-lbl">
          <input type="radio" name="vehiculo" value="spv_unica" id="veh-spv_unica" onchange="setVehiculo('spv_unica')" style="margin-top:2px;flex-shrink:0">
          <div>
            <div style="font-size:11px;color:var(--text-b);font-weight:500;margin-bottom:2px">SPV Única operación</div>
            <div style="font-size:10px;color:var(--text-d);line-height:1.6">Sociedad de propósito específico constituida para este activo concreto. Se liquida al completarse la venta.</div>
          </div>
        </label>
        <label onclick="setVehiculo('spv_multi')" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--d4);border:1px solid var(--d6);cursor:pointer;transition:all 0.15s" id="veh-spv_multi-lbl">
          <input type="radio" name="vehiculo" value="spv_multi" id="veh-spv_multi" onchange="setVehiculo('spv_multi')" style="margin-top:2px;flex-shrink:0">
          <div>
            <div style="font-size:11px;color:var(--text-b);font-weight:500;margin-bottom:2px">SPV Multi-activo</div>
            <div style="font-size:10px;color:var(--text-d);line-height:1.6">Vehículo permanente que opera sobre varios activos. Permite diversificación dentro del mismo vehículo y acceso a futuras operaciones.</div>
          </div>
        </label>
        <label onclick="setVehiculo('club_deal')" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--d4);border:1px solid var(--d6);cursor:pointer;transition:all 0.15s" id="veh-club_deal-lbl">
          <input type="radio" name="vehiculo" value="club_deal" id="veh-club_deal" onchange="setVehiculo('club_deal')" style="margin-top:2px;flex-shrink:0">
          <div>
            <div style="font-size:11px;color:var(--text-b);font-weight:500;margin-bottom:2px">Club Deal</div>
            <div style="font-size:10px;color:var(--text-d);line-height:1.6">Grupo cerrado de inversores privados seleccionados. Estructura ágil sin vehículo societario formal, regida por pacto entre partes.</div>
          </div>
        </label>
      </div>

      <div class="idivider">Forma de aportación del capital</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
        <label onclick="setAportacion('pp')" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--d4);border:1px solid var(--d6);cursor:pointer;transition:all 0.15s" id="ap-pp-lbl">
          <input type="radio" name="aportacion" value="pp" id="ap-pp" onchange="setAportacion('pp')" style="margin-top:2px;flex-shrink:0">
          <div>
            <div style="font-size:11px;color:var(--text-b);font-weight:500;margin-bottom:2px">Préstamo participativo</div>
            <div style="font-size:10px;color:var(--text-d);line-height:1.6">El inversor presta capital y recibe interés fijo más participación variable en el beneficio. Sin transmisión de propiedad ni acceso a la gestión.</div>
          </div>
        </label>
        <label onclick="setAportacion('cp')" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--d4);border:1px solid var(--d6);cursor:pointer;transition:all 0.15s" id="ap-cp-lbl">
          <input type="radio" name="aportacion" value="cp" id="ap-cp" onchange="setAportacion('cp')" style="margin-top:2px;flex-shrink:0">
          <div>
            <div style="font-size:11px;color:var(--text-b);font-weight:500;margin-bottom:2px">Cuenta en participación</div>
            <div style="font-size:10px;color:var(--text-d);line-height:1.6">El inversor cede capital a Riverwalk como gestor, compartiendo riesgo y beneficio en proporción a su aportación. Sin personalidad jurídica propia.</div>
          </div>
        </label>
        <label onclick="setAportacion('ac')" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--d4);border:1px solid var(--d6);cursor:pointer;transition:all 0.15s" id="ap-ac-lbl">
          <input type="radio" name="aportacion" value="ac" id="ap-ac" onchange="setAportacion('ac')" style="margin-top:2px;flex-shrink:0">
          <div>
            <div style="font-size:11px;color:var(--text-b);font-weight:500;margin-bottom:2px">Ampliación de capital</div>
            <div style="font-size:10px;color:var(--text-d);line-height:1.6">El inversor entra como socio de la sociedad operativa o del vehículo. Participación directa en el capital social con los derechos que correspondan.</div>
          </div>
        </label>
        <label onclick="setAportacion('ph')" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--d4);border:1px solid var(--d6);cursor:pointer;transition:all 0.15s" id="ap-ph-lbl">
          <input type="radio" name="aportacion" value="ph" id="ap-ph" onchange="setAportacion('ph')" style="margin-top:2px;flex-shrink:0">
          <div>
            <div style="font-size:11px;color:var(--text-b);font-weight:500;margin-bottom:2px">Préstamo con garantía hipotecaria</div>
            <div style="font-size:10px;color:var(--text-d);line-height:1.6">Retorno fijo garantizado con el activo como colateral. Sin participación en el upside. Perfil de riesgo más conservador.</div>
          </div>
        </label>
      </div>
    </div>
  </div>

  <!-- DOSSIER DE PRESENTACIÓN -->
  <div class="isec" id="isec-dossier">
    <div class="isec-hd" onclick="toggleSec(this)">
      <span class="isec-lbl">Dossier de presentación</span>
      <span class="isec-arr">▶</span>
    </div>
    <div class="ibody" style="display:none">
      <div style="font-size:10.5px;color:var(--text-d);margin:4px 0 12px;line-height:1.8">
        Añade fotos y textos narrativos para el modo presentación y el dossier PDF. El botón <strong style="color:var(--gold)">✦ Narrativa IA</strong> genera los textos automáticamente.
      </div>

      <!-- IMÁGENES DEL DOSSIER -->
      <div style="margin-bottom:4px;">

        <!-- Fachada -->
        <div style="font-size:7.5px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-d);margin-bottom:6px;font-weight:500">Fachada exterior</div>
        <div id="rw-dz-fachada"
          onclick="rwPickImage('fachada')"
          ondragover="event.preventDefault()"
          ondrop="rwDropImage(event,'fachada')"
          style="width:100%;height:100px;background:var(--d4);border:1px dashed var(--d6);cursor:pointer;position:relative;background-size:cover;background-position:center;margin-bottom:10px;">
          <div class="rw-dz-lbl" style="display:flex;align-items:center;justify-content:center;height:100%;pointer-events:none;">
            <span style="font-size:9px;color:var(--text-d);letter-spacing:0.1em;">+ Fachada · clic o arrastra</span>
          </div>
          <div class="rw-dz-del" onclick="rwClearImage('fachada',0,event)" style="display:none;position:absolute;top:4px;right:4px;width:18px;height:18px;background:rgba(10,11,16,0.8);align-items:center;justify-content:center;cursor:pointer;font-size:10px;color:rgba(255,255,255,0.7);">✕</div>
        </div>

        <!-- Interiores -->
        <div style="font-size:7.5px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-d);margin-bottom:6px;font-weight:500">Estado actual · interiores (hasta 4)</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:10px;">
          <div id="rw-dz-int-0" onclick="rwPickImage('interior',0)" ondragover="event.preventDefault()" ondrop="rwDropImage(event,'interior',0)" style="height:72px;background:var(--d4);border:1px dashed var(--d6);cursor:pointer;position:relative;background-size:cover;background-position:center;"><div class="rw-dz-lbl" style="display:flex;align-items:center;justify-content:center;height:100%;pointer-events:none;"><span style="font-size:8.5px;color:var(--text-d);">+ Salón</span></div><div class="rw-dz-del" onclick="rwClearImage('interior',0,event)" style="display:none;position:absolute;top:3px;right:3px;width:16px;height:16px;background:rgba(10,11,16,0.8);align-items:center;justify-content:center;cursor:pointer;font-size:9px;color:rgba(255,255,255,0.7);">✕</div></div>
          <div id="rw-dz-int-1" onclick="rwPickImage('interior',1)" ondragover="event.preventDefault()" ondrop="rwDropImage(event,'interior',1)" style="height:72px;background:var(--d4);border:1px dashed var(--d6);cursor:pointer;position:relative;background-size:cover;background-position:center;"><div class="rw-dz-lbl" style="display:flex;align-items:center;justify-content:center;height:100%;pointer-events:none;"><span style="font-size:8.5px;color:var(--text-d);">+ Cocina</span></div><div class="rw-dz-del" onclick="rwClearImage('interior',1,event)" style="display:none;position:absolute;top:3px;right:3px;width:16px;height:16px;background:rgba(10,11,16,0.8);align-items:center;justify-content:center;cursor:pointer;font-size:9px;color:rgba(255,255,255,0.7);">✕</div></div>
          <div id="rw-dz-int-2" onclick="rwPickImage('interior',2)" ondragover="event.preventDefault()" ondrop="rwDropImage(event,'interior',2)" style="height:72px;background:var(--d4);border:1px dashed var(--d6);cursor:pointer;position:relative;background-size:cover;background-position:center;"><div class="rw-dz-lbl" style="display:flex;align-items:center;justify-content:center;height:100%;pointer-events:none;"><span style="font-size:8.5px;color:var(--text-d);">+ Dormitorio</span></div><div class="rw-dz-del" onclick="rwClearImage('interior',2,event)" style="display:none;position:absolute;top:3px;right:3px;width:16px;height:16px;background:rgba(10,11,16,0.8);align-items:center;justify-content:center;cursor:pointer;font-size:9px;color:rgba(255,255,255,0.7);">✕</div></div>
          <div id="rw-dz-int-3" onclick="rwPickImage('interior',3)" ondragover="event.preventDefault()" ondrop="rwDropImage(event,'interior',3)" style="height:72px;background:var(--d4);border:1px dashed var(--d6);cursor:pointer;position:relative;background-size:cover;background-position:center;"><div class="rw-dz-lbl" style="display:flex;align-items:center;justify-content:center;height:100%;pointer-events:none;"><span style="font-size:8.5px;color:var(--text-d);">+ Baño</span></div><div class="rw-dz-del" onclick="rwClearImage('interior',3,event)" style="display:none;position:absolute;top:3px;right:3px;width:16px;height:16px;background:rgba(10,11,16,0.8);align-items:center;justify-content:center;cursor:pointer;font-size:9px;color:rgba(255,255,255,0.7);">✕</div></div>
        </div>

        <!-- Planos -->
        <div style="font-size:7.5px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-d);margin-bottom:6px;font-weight:500">Planos de distribución</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px;">
          <div id="rw-dz-plano-actual" onclick="rwPickImage('planoActual')" ondragover="event.preventDefault()" ondrop="rwDropImage(event,'planoActual')" style="height:82px;background:var(--d4);border:1px dashed var(--d6);cursor:pointer;position:relative;background-size:contain;background-repeat:no-repeat;background-position:center;"><div class="rw-dz-lbl" style="display:flex;align-items:center;justify-content:center;height:100%;pointer-events:none;"><span style="font-size:8.5px;color:var(--text-d);">+ Plano actual</span></div><div class="rw-dz-del" onclick="rwClearImage('planoActual',0,event)" style="display:none;position:absolute;top:3px;right:3px;width:16px;height:16px;background:rgba(10,11,16,0.8);align-items:center;justify-content:center;cursor:pointer;font-size:9px;color:rgba(255,255,255,0.7);">✕</div></div>
          <div id="rw-dz-plano-obj" onclick="rwPickImage('planoObjetivo')" ondragover="event.preventDefault()" ondrop="rwDropImage(event,'planoObjetivo')" style="height:82px;background:var(--d4);border:1px dashed rgba(196,151,90,0.35);cursor:pointer;position:relative;background-size:contain;background-repeat:no-repeat;background-position:center;"><div class="rw-dz-lbl" style="display:flex;align-items:center;justify-content:center;height:100%;pointer-events:none;"><span style="font-size:8.5px;color:rgba(196,151,90,0.55);">+ Plano objetivo</span></div><div class="rw-dz-del" onclick="rwClearImage('planoObjetivo',0,event)" style="display:none;position:absolute;top:3px;right:3px;width:16px;height:16px;background:rgba(10,11,16,0.8);align-items:center;justify-content:center;cursor:pointer;font-size:9px;color:rgba(255,255,255,0.7);">✕</div></div>
        </div>

      </div>

      <!-- CALIDADES PRESET -->
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line2)">
        <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-d);margin-bottom:8px;font-weight:500">Memoria de calidades — Preset</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
          <select id="calidadesPreset" onchange="applyCalidadesPreset()" style="flex:1;font-family:'DM Mono',monospace;font-size:11px">
            <option value="">— Sin preset —</option>
            <option value="esencial">Esencial · Acabados funcionales</option>
            <option value="premium">Premium · Acabados de nivel</option>
            <option value="signature">Signature · Acabados de autor</option>
          </select>
          <button onclick="toggleCalidadesEditor()" style="background:rgba(196,151,90,0.1);border:1px solid rgba(196,151,90,0.3);color:rgba(196,151,90,0.8);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;padding:6px 10px;cursor:pointer;font-family:'Raleway',sans-serif;flex-shrink:0">✏ Editar</button>
        </div>
        <div id="calidades-preview" style="font-size:10px;color:var(--text-d);line-height:1.7;padding:8px 10px;background:var(--d4);border:1px solid var(--d6);min-height:36px"></div>
        <div id="calidades-editor" style="display:none;margin-top:8px">
          <textarea id="calidadesCustomText" rows="4" placeholder="Describe los acabados: suelos, cocina, baños, carpintería, iluminación…" oninput="saveCalidadesCustom()" style="width:100%;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);font-family:'Raleway',sans-serif;font-size:11px;padding:8px 10px;resize:vertical;line-height:1.6"></textarea>
        </div>
      </div>

      <!-- CATALIZADORES -->
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line2)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-d);font-weight:500">Catalizadores de zona</div>
          <button onclick="addCatalizador()" style="background:rgba(196,151,90,0.08);border:1px solid rgba(196,151,90,0.25);color:rgba(196,151,90,0.7);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;padding:4px 10px;cursor:pointer;font-family:'Raleway',sans-serif">+ Añadir</button>
        </div>
        <div style="font-size:9.5px;color:var(--text-d);margin-bottom:8px;line-height:1.6">Proyectos y referencias que refuerzan la tesis de la zona (hotels de lujo, promociones clave, marcas âncla...).</div>
        <div id="catalizadores-list" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>

      <!-- NARRATIVES -->
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--line2)">
        <div style="font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-d);margin-bottom:10px;font-weight:500">Textos narrativos</div>

        <div class="field" style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <label style="margin:0">Descripción del activo</label>
            <button onclick="generateNarrative('activo')" style="background:rgba(60,100,180,0.15);border:1px solid #5588cc;color:#88aadd;font-size:8px;letter-spacing:0.1em;text-transform:uppercase;padding:3px 8px;cursor:pointer;font-family:'Raleway',sans-serif">✦ Generar</button>
          </div>
          <textarea id="narr-activo" rows="3" placeholder="Piso en quinta planta con ascensor, exterior sur, finca de principios del s.XX en buen estado de conservación…" oninput="saveDossierNarrative()" style="width:100%;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);font-family:'Raleway',sans-serif;font-size:11px;padding:8px 10px;resize:vertical;line-height:1.6"></textarea>
        </div>

        <div class="field" style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <label style="margin:0">Contexto de la zona</label>
            <button onclick="generateNarrative('zona')" style="background:rgba(60,100,180,0.15);border:1px solid #5588cc;color:#88aadd;font-size:8px;letter-spacing:0.1em;text-transform:uppercase;padding:3px 8px;cursor:pointer;font-family:'Raleway',sans-serif">✦ Generar</button>
          </div>
          <textarea id="narr-zona" rows="3" placeholder="La microzona de Justicia se consolida como una de las más dinámicas del mercado prime madrileño…" oninput="saveDossierNarrative()" style="width:100%;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);font-family:'Raleway',sans-serif;font-size:11px;padding:8px 10px;resize:vertical;line-height:1.6"></textarea>
        </div>

        <div class="field" style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <label style="margin:0">Análisis de mercado y oportunidad</label>
            <button onclick="generateNarrative('mercado')" style="background:rgba(60,100,180,0.15);border:1px solid #5588cc;color:#88aadd;font-size:8px;letter-spacing:0.1em;text-transform:uppercase;padding:3px 8px;cursor:pointer;font-family:'Raleway',sans-serif">✦ Generar</button>
          </div>
          <textarea id="narr-mercado" rows="3" placeholder="El activo se adquiere con un descuento del X% sobre el precio de mercado para pisos a reformar en la zona…" oninput="saveDossierNarrative()" style="width:100%;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);font-family:'Raleway',sans-serif;font-size:11px;padding:8px 10px;resize:vertical;line-height:1.6"></textarea>
        </div>

        <div class="field" style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <label style="margin:0">Tesis del proyecto y calidades</label>
            <button onclick="generateNarrative('proyecto')" style="background:rgba(60,100,180,0.15);border:1px solid #5588cc;color:#88aadd;font-size:8px;letter-spacing:0.1em;text-transform:uppercase;padding:3px 8px;cursor:pointer;font-family:'Raleway',sans-serif">✦ Generar</button>
          </div>
          <textarea id="narr-proyecto" rows="3" placeholder="La reforma seguirá un estándar de acabados premium: suelos de madera natural, cocina integrada, baños en mármol…" oninput="saveDossierNarrative()" style="width:100%;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);font-family:'Raleway',sans-serif;font-size:11px;padding:8px 10px;resize:vertical;line-height:1.6"></textarea>
        </div>

        <div class="field">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <label style="margin:0">Tesis de inversión (cierre)</label>
            <button onclick="generateNarrative('tesis')" style="background:rgba(60,100,180,0.15);border:1px solid #5588cc;color:#88aadd;font-size:8px;letter-spacing:0.1em;text-transform:uppercase;padding:3px 8px;cursor:pointer;font-family:'Raleway',sans-serif">✦ Generar</button>
          </div>
          <textarea id="narr-tesis" rows="3" placeholder="Riverwalk presenta una operación de reforma integral en el corazón de Madrid con un retorno bruto del X%…" oninput="saveDossierNarrative()" style="width:100%;background:var(--d4);border:1px solid var(--d6);color:var(--text-b);font-family:'Raleway',sans-serif;font-size:11px;padding:8px 10px;resize:vertical;line-height:1.6"></textarea>
        </div>
      </div>
    </div>
  </div>

</div><!-- END INPUT PANEL -->

<!-- ═══════════════════════════════ OUTPUT PANEL ═══════════════════════════════ -->
<div class="output-panel">

  <!-- INVESTOR CAPITAL BANNER — visible only when leveraged -->
  <div id="investor-banner" style="display:none;background:linear-gradient(135deg,#0F1014 0%,#1a1c24 100%);border-bottom:2px solid var(--gold);padding:16px 28px">
    <div style="display:flex;align-items:center;gap:32px;flex-wrap:wrap">
      <div style="flex:0 0 auto">
        <div style="font-size:8.5px;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);margin-bottom:6px;font-weight:600">Capital requerido por el inversor</div>
        <div style="font-family:'DM Mono',monospace;font-size:38px;color:#ffffff;letter-spacing:-0.03em;line-height:1;font-feature-settings:'tnum' 1" id="banner-equity">—</div>
        <div style="font-size:10.5px;color:rgba(255,255,255,0.45);margin-top:5px" id="banner-equity-sub">—</div>
      </div>
      <div style="width:1px;height:52px;background:rgba(255,255,255,0.1);flex-shrink:0"></div>
      <div style="flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,0.06)">
        <div style="padding:10px 16px;background:rgba(255,255,255,0.03)">
          <div style="font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:5px">Pesimista</div>
          <div style="font-family:'DM Mono',monospace;font-size:18px;font-feature-settings:'tnum' 1;line-height:1" id="banner-roe-p">—</div>
          <div style="font-size:9.5px;color:rgba(255,255,255,0.3);margin-top:3px" id="banner-net-p">—</div>
        </div>
        <div style="padding:10px 16px;background:rgba(139,105,20,0.12);border-left:1px solid rgba(139,105,20,0.3)">
          <div style="font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);margin-bottom:5px">Base case</div>
          <div style="font-family:'DM Mono',monospace;font-size:18px;color:#ffffff;font-feature-settings:'tnum' 1;line-height:1" id="banner-roe-b">—</div>
          <div style="font-size:9.5px;color:rgba(255,255,255,0.45);margin-top:3px" id="banner-net-b">—</div>
        </div>
        <div style="padding:10px 16px;background:rgba(255,255,255,0.03)">
          <div style="font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:5px">Optimista</div>
          <div style="font-family:'DM Mono',monospace;font-size:18px;font-feature-settings:'tnum' 1;line-height:1" id="banner-roe-o">—</div>
          <div style="font-size:9.5px;color:rgba(255,255,255,0.3);margin-top:3px" id="banner-net-o">—</div>
        </div>
      </div>
    </div>
  </div>

  <!-- KPI STRIP -->
  <div class="kpi-strip">
    <div class="kpi-c"><div class="kpi-lbl" id="kpi-total-lbl">Inversión total</div><div class="kpi-v gold" id="kpi-total">—</div><div class="kpi-n" id="kpi-total-n">Todo incluido</div></div>
    <div class="kpi-c"><div class="kpi-lbl">ROI bruto operación</div><div class="kpi-v" id="kpi-roi">—</div><div class="kpi-n" id="kpi-roi-n">Post fees</div></div>
    <div class="kpi-c"><div class="kpi-lbl">TIR anual (base)</div><div class="kpi-v up" id="kpi-irr">—</div><div class="kpi-n" id="kpi-irr-n">Equity sin apalancar</div></div>
    <div class="kpi-c"><div class="kpi-lbl">Beneficio neto (base)</div><div class="kpi-v" id="kpi-profit">—</div><div class="kpi-n">Al inversor</div></div>
    <div class="kpi-c"><div class="kpi-lbl">Breakeven bruto (€/m²)</div><div class="kpi-v" id="kpi-be">—</div><div class="kpi-n" id="kpi-be-n">—</div></div>
  </div>

  <!-- INVESTMENT BREAKDOWN -->
  <div id="inv-breakdown" style="border-bottom:1px solid var(--line2);background:var(--d2)">
    <div id="inv-breakdown-summary"
      onclick="toggleInvBreakdown()"
      style="display:flex;align-items:center;gap:16px;padding:10px 28px;cursor:pointer;user-select:none">
      <div style="font-size:8px;letter-spacing:0.18em;text-transform:uppercase;color:var(--text-d);flex-shrink:0">Desglose inversión</div>
      <div id="inv-breakdown-bars" style="flex:1;display:flex;gap:2px;height:8px;border-radius:2px;overflow:hidden"></div>
      <div id="inv-breakdown-legend" style="display:flex;gap:12px;flex-shrink:0"></div>
      <div id="inv-breakdown-arr" style="font-size:10px;color:var(--text-d);flex-shrink:0;transition:transform 0.2s">▼</div>
    </div>
    <div id="inv-breakdown-detail" style="display:none;padding:0 28px 14px;display:none">
      <div id="inv-breakdown-grid"></div>
    </div>
  </div>

  <!-- TIMELINE -->
  <div class="timeline-strip" id="timeline-strip"></div>

  <!-- SCENARIOS -->
  <div class="osec">
    <div class="osec-title"><span class="osec-tag">01</span>Escenarios de retorno</div>
    <div class="sc-cards" id="sc-cards"></div>
  </div>

  <!-- P&L -->
  <div class="osec">
    <div class="osec-title"><span class="osec-tag">02</span>P&L Completo — Escenario Base</div>
    <div id="pnl-alerts"></div>
    <table class="pnl" id="pnl-table"></table>
  </div>

  <!-- LEVERAGE -->
  <div class="osec">
    <div class="osec-title"><span class="osec-tag">03</span>Apalancamiento — Impacto en ROE</div>
    <div class="lev-strip" id="lev-strip"></div>
    <div class="callout">
      <strong>Nota:</strong> El apalancamiento reduce el beneficio absoluto (pagas intereses) pero mejora el ROE porque despliega menos equity. La decisión depende de si tienes otros proyectos en paralelo. Bridge loan en Madrid Centro actualmente disponible entre 4.5–6%.
    </div>
  </div>

  <!-- COMPARABLES OUTPUT -->
  <div class="osec">
    <div class="osec-title"><span class="osec-tag">04</span>Testigos de Mercado</div>
    <div id="comp-output">
      <div style="font-size:11px;color:var(--text-d);font-style:italic">
        Añade testigos en el panel izquierdo para ver el análisis aquí.
      </div>
    </div>
  </div>

  <!-- BREAKEVEN -->
  <div class="osec">
    <div class="osec-title"><span class="osec-tag">05</span>Protección de Capital — Breakeven bruto</div>
    <div class="be-wrap">
      <div style="font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-d)">Espectro de precio/m² — breakeven a techo de mercado</div>
      <div class="be-track"><div class="be-fill" id="be-fill"></div></div>
      <div class="be-markers" id="be-markers"></div>
    </div>
    <div class="be-stats" id="be-stats"></div>
  </div>

  <!-- CARRY ENGINE -->
  <div class="osec">
    <div class="osec-title"><span class="osec-tag">06</span>Carry Engine — Success Fee</div>
    <div id="carry-explanation"></div>
    <div id="carry-impact-strip" style="margin-top:16px"></div>
  </div>

  <!-- SENSITIVITY -->
  <div class="osec">
    <div class="osec-title"><span class="osec-tag">07</span>Sensibilidad — Duración × Precio</div>
    <div style="font-size:11px;color:var(--text-d);margin-bottom:14px;line-height:1.7">
      La <strong style="color:var(--text-b)">TIR</strong> es la métrica correcta para el eje de duración:
      el ROI apenas varía con el tiempo (la comunidad es irrelevante frente al volumen invertido),
      pero la TIR anualizada cae significativamente cuando una operación se alarga.
    </div>
    <div style="overflow-x:auto"><table class="sens" id="sens-table"></table></div>
    <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;align-items:center;font-size:9px;color:var(--text-d)">
      <span id="sens-note">TIR anual (grande) · ROI neto (pequeño)</span> &nbsp;·&nbsp;
      <span class="c1" style="padding:2px 7px">TIR &lt;5%</span>
      <span class="c2" style="padding:2px 7px">5–18%</span>
      <span class="c3" style="padding:2px 7px">18–30%</span>
      <span class="c4" style="padding:2px 7px">&gt;30%</span>
    </div>
  </div>

  <!-- SENSITIVITY 2 -->
  <div class="osec" style="background:var(--d2)">
    <div class="osec-title"><span class="osec-tag">08</span>Sensibilidad — CapEx × Precio</div>
    <div style="font-size:11px;color:var(--text-d);margin-bottom:14px;line-height:1.7">
      El <strong style="color:var(--text-b)">ROI neto</strong> como métrica principal.
      El número pequeño bajo cada porcentaje es la inversión total en esa combinación.
      Todos los escenarios son <em>post success fee e IS</em>.
    </div>
    <div style="overflow-x:auto"><table class="sens" id="sens-table2"></table></div>
    <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;align-items:center;font-size:9px;color:var(--text-d)">
      ROI neto al inversor:
      <span class="c1" style="padding:2px 7px">&lt;5%</span>
      <span class="c2" style="padding:2px 7px">5–18%</span>
      <span class="c3" style="padding:2px 7px">18–25%</span>
      <span class="c4" style="padding:2px 7px">&gt;25%</span>
    </div>
  </div>

  <!-- CASHFLOW DETALLADO -->
  <div class="osec">
    <div class="osec-title"><span class="osec-tag">09</span>Cashflow Detallado — Escenario Base</div>
    <div class="cf-summary-strip" id="cf-summary"></div>
    <div style="overflow-x:auto">
      <table class="cf-table" id="cf-table"></table>
    </div>
    <div class="callout" style="margin-top:14px;border-left-color:var(--red)">
      <strong style="color:var(--text-b)">IVA soportado en CapEx y fees:</strong>
      La venta de vivienda usada (segunda transmisión) está <strong>exenta de IVA</strong> conforme al art. 20.1.22 de la Ley del IVA.
      El IVA soportado en obra y management fee se incluye en el modelo como coste del proyecto. Su recuperabilidad depende de la estructura fiscal de cada operación — consulta con tu asesor para determinar si aplica deducción por prorrata o régimen de IVA específico.
      Los números del modelo lo recogen correctamente como parte de la inversión total.
    </div>
  </div>

  <!-- EXPORT -->
  <div class="osec">
    <div class="osec-title"><span class="osec-tag">10</span>Metodología de cálculo</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line2)">

      <div style="background:var(--d3);padding:18px 20px">
        <div style="font-size:8.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;font-weight:600">TIR — Tasa Interna de Retorno</div>
        <div style="font-size:11.5px;color:var(--text-d);line-height:1.8">
          <strong style="color:var(--text-b)">Método:</strong> Newton-Raphson sobre flujos mensuales (hasta 3.000 iter., convergencia ε=10⁻¹⁰).<br>
          <strong style="color:var(--text-b)">Anualización:</strong> TIR anual = (1 + TIR_mensual)¹² − 1 <em>(compuesta)</em>.<br>
          <strong style="color:var(--text-b)">Por qué compuesta y no simple:</strong> estándar PE europeo (EVCA/ILPA). La simple (×12) inflaría la cifra en operaciones cortas — no maquilla.<br>
          <strong style="color:var(--text-b)">Cashflow:</strong> salidas en arras, escritura y tramos CapEx; entrada en venta neta de carry e impuestos.
        </div>
      </div>

      <div style="background:var(--d3);padding:18px 20px">
        <div style="font-size:8.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;font-weight:600">Carry / Success Fee</div>
        <div style="font-size:11.5px;color:var(--text-d);line-height:1.8">
          <strong style="color:var(--text-b)">Base:</strong> todo lo que excede la inversión real completa — precio, CapEx, todos los gastos y el IVA soportado. No maquilla nada.<br>
          <strong style="color:var(--text-b)">Fórmula:</strong> Beneficio bruto = Venta − Costes salida − Inversión total completa.<br>
          <strong style="color:var(--text-b)">En modo TIR:</strong> los umbrales son TIR anualizadas. El modelo calcula el beneficio equivalente para la duración real del deal — más justo que ROI simple porque ajusta al tiempo.
        </div>
      </div>

      <div style="background:var(--d3);padding:18px 20px">
        <div style="font-size:8.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;font-weight:600">Management Fee</div>
        <div style="font-size:11.5px;color:var(--text-d);line-height:1.8">
          <strong style="color:var(--text-b)">Base reforma:</strong> precio compra + CapEx neto (sin IVA). Excluye ITP, notaría y gastos a terceros.<br>
          <strong style="color:var(--text-b)">Base pase:</strong> precio del activo.<br>
          <strong style="color:var(--text-b)">Cobro:</strong> 50% en arras + 50% en escritura, con IVA encima.<br>
          <strong style="color:var(--text-b)">IVA del fee:</strong> incluido en la inversión total. Recuperabilidad según estructura fiscal del vehículo — no predefinida en el modelo.
        </div>
      </div>

      <div style="background:var(--d3);padding:18px 20px">
        <div style="font-size:8.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;font-weight:600">Apalancamiento y ROE</div>
        <div style="font-size:11.5px;color:var(--text-d);line-height:1.8">
          <strong style="color:var(--text-b)">Interés bridge:</strong> simple — préstamo × tipo anual × (meses / 12). No capitaliza.<br>
          <strong style="color:var(--text-b)">LTV:</strong> % sobre precio compra. <strong style="color:var(--text-b)">LTC:</strong> % sobre coste total del proyecto.<br>
          <strong style="color:var(--text-b)">ROE:</strong> (beneficio neto − intereses) / equity desplegado.<br>
          <strong style="color:var(--text-b)">Spread:</strong> +0,5% cuando LTV &gt; 50% (referencia orientativa mercado bridge Madrid).
        </div>
      </div>

      <div style="background:var(--d3);padding:18px 20px">
        <div style="font-size:8.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;font-weight:600">Plusvalía municipal (IIVTNU)</div>
        <div style="font-size:11.5px;color:var(--text-d);line-height:1.8">
          <strong style="color:var(--text-b)">Normativa:</strong> RDL 26/2021 — método dual desde nov. 2021.<br>
          <strong style="color:var(--text-b)">Método objetivo:</strong> VC suelo × coeficiente por años tenencia (tabla 2024) × 29% (Madrid).<br>
          <strong style="color:var(--text-b)">Método real:</strong> ganancia × (VC suelo / VC total) × 29%.<br>
          <strong style="color:var(--text-b)">Se aplica el menor</strong> de los dos — derecho del contribuyente desde la reforma.
        </div>
      </div>

      <div style="background:var(--d3);padding:18px 20px">
        <div style="font-size:8.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;font-weight:600">Notaría (Arancel RD 1426/1989)</div>
        <div style="font-size:11.5px;color:var(--text-d);line-height:1.8">
          <strong style="color:var(--text-b)">Escala progresiva:</strong> 90,15€ plano hasta 6.010€; tramos decrecientes hasta 4,51€/millar sobre 601.012€.<br>
          <strong style="color:var(--text-b)">Registro:</strong> estimado al 55% del arancel (ratio habitual Madrid residencial).<br>
          <strong style="color:var(--text-b)">Nota:</strong> se auto-calcula sobre precio escriturado. Usa el ajuste manual ± para copias adicionales o escrituras complejas.
        </div>
      </div>

    </div>
  </div>

  <div class="osec">
    <div class="osec-title"><span class="osec-tag">11</span>Brief para Maquetación</div>
    <div class="export-card" id="export-brief"></div>
  </div>

</div><!-- END OUTPUT PANEL -->
</div><!-- END APP BODY -->

`

// Overlay HTML appended directly to document.body so position:fixed works correctly
// (a parent with overflow:hidden would otherwise clip fixed children).
const OVERLAY_HTML = `
<!-- CONSOLIDADO VIEW -->
<div id="consol-view" class="consol-view" style="padding:24px 28px;max-width:1100px;margin:0 auto">
  <div style="font-size:8px;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);margin-bottom:6px;font-weight:600" id="consol-proj-name">Proyecto</div>
  <div style="font-size:22px;font-family:'Cormorant Garamond',serif;color:var(--text-b);margin-bottom:20px">Análisis consolidado</div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--line);margin-bottom:20px" id="consol-kpis"></div>
  <div style="font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-d);margin-bottom:8px;font-weight:500">Desglose por unidad</div>
  <div style="border:1px solid var(--line);margin-bottom:20px">
    <div class="cu-row header">
      <div>Unidad</div><div style="text-align:right">m²</div><div style="text-align:right">Inversión</div><div style="text-align:right">Venta base</div><div style="text-align:right">Benef. bruto</div><div style="text-align:right">ROI bruto</div><div></div>
    </div>
    <div id="consol-units-rows"></div>
    <div class="cu-row" style="font-weight:600;background:rgba(139,105,20,0.08);border-top:1px solid rgba(139,105,20,0.25)" id="consol-total-row"></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
    <div style="background:var(--d3);border:1px solid var(--line);padding:16px">
      <div style="font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;font-weight:600">Carry consolidado — sobre el conjunto</div>
      <div id="consol-carry" style="font-size:11px;font-family:'DM Mono',monospace;color:var(--text-d);line-height:2;font-feature-settings:'tnum' 1"></div>
    </div>
    <div style="background:var(--d3);border:1px solid var(--line);padding:16px">
      <div style="font-size:8px;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;font-weight:600">Cashflow agregado</div>
      <div id="consol-cashflow" style="font-size:11px;font-family:'DM Mono',monospace;color:var(--text-d);line-height:2;font-feature-settings:'tnum' 1"></div>
    </div>
  </div>
  <div style="font-size:9.5px;color:var(--text-d);padding:10px 12px;background:var(--d4);border-left:2px solid var(--gold-d);line-height:1.7">
    Management fee y carry calculados sobre el <strong style="color:var(--text-b)">conjunto del proyecto</strong>, no por unidad individual.
  </div>
</div>

<!-- PRESENTATION MODE -->
<div id="presentation-mode" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:9000;background:#0F1014;font-family:'Raleway',sans-serif;overflow:hidden">
  <div style="position:absolute;top:0;left:0;right:0;height:48px;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:space-between;padding:0 24px;z-index:2;border-bottom:1px solid rgba(139,105,20,0.25)">
    <div style="display:flex;align-items:center;gap:16px">
      <span id="pres-slide-label" style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.4)">01 / 09</span>
      <span id="pres-slide-title" style="font-size:11px;color:rgba(255,255,255,0.6)"></span>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <button onclick="presNav(-1)" style="background:none;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.7);width:32px;height:32px;cursor:pointer;font-size:16px">‹</button>
      <button onclick="presNav(1)"  style="background:none;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.7);width:32px;height:32px;cursor:pointer;font-size:16px">›</button>
      <button onclick="closePresentation()" style="background:rgba(255,255,255,0.08);border:none;color:rgba(255,255,255,0.5);padding:6px 14px;cursor:pointer;font-size:10px;letter-spacing:0.1em;text-transform:uppercase">✕ Cerrar</button>
    </div>
  </div>
  <div id="pres-slide" style="position:absolute;top:48px;left:0;right:0;bottom:40px;overflow:hidden"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:40px;background:rgba(0,0,0,0.5);display:flex;align-items:center;padding:0 24px;gap:8px" id="pres-dots"></div>
</div>

<!-- AI TERMINAL -->
<div id="ai-terminal" style="display:none;position:fixed;right:20px;bottom:20px;width:420px;height:560px;z-index:8500;background:#0F1014;border:1px solid rgba(85,136,204,0.4);flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.8)">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(85,136,204,0.2);background:rgba(60,100,180,0.15)">
    <div>
      <div style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#88aadd;font-weight:600">✦ Terminal IA — Riverwalk</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px">Genera narrativa para el dossier</div>
    </div>
    <button onclick="closeAITerminal()" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:18px;cursor:pointer;padding:0 4px">×</button>
  </div>
  <div style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;flex-wrap:wrap;gap:5px">
    <span style="font-size:8.5px;color:rgba(255,255,255,0.3);width:100%;margin-bottom:2px">Generación rápida →</span>
    <button onclick="aiQuickGen('activo')"   class="ai-quick-btn">Activo</button>
    <button onclick="aiQuickGen('zona')"     class="ai-quick-btn">Zona</button>
    <button onclick="aiQuickGen('mercado')"  class="ai-quick-btn">Mercado</button>
    <button onclick="aiQuickGen('proyecto')" class="ai-quick-btn">Proyecto</button>
    <button onclick="aiQuickGen('tesis')"    class="ai-quick-btn">Tesis</button>
    <button onclick="aiQuickGen('todo')"     class="ai-quick-btn" style="border-color:rgba(139,105,20,0.5);color:var(--gold)">✦ Todo</button>
  </div>
  <div id="ai-messages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;font-size:11.5px;line-height:1.65"></div>
  <div style="padding:10px 12px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px">
    <input id="ai-input" type="text" placeholder="Refina o pide algo específico…"
      onkeydown="if(event.key==='Enter')sendAIMessage()"
      style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;font-family:'Raleway',sans-serif;font-size:12px;padding:9px 12px;outline:none">
    <button onclick="sendAIMessage()" style="background:rgba(60,100,180,0.3);border:1px solid #5588cc;color:#88aadd;font-size:11px;padding:8px 14px;cursor:pointer;white-space:nowrap">Enviar</button>
  </div>
</div>

<!-- INTELLIGENCE PLATFORM -->
<div id="intel-overlay" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:9100;background:#0a0b0f;font-family:'Raleway',sans-serif;overflow:hidden;">
  <div style="height:52px;background:rgba(120,60,200,0.12);border-bottom:1px solid rgba(160,100,240,0.2);display:flex;align-items:center;justify-content:space-between;padding:0 28px;flex-shrink:0">
    <div style="display:flex;align-items:center;gap:20px">
      <div style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(160,100,240,0.8);font-weight:600">⬡ Riverwalk Intelligence</div>
      <div id="intel-tabs" style="display:flex;gap:2px"></div>
    </div>
    <button onclick="closeIntelligence()" style="background:rgba(255,255,255,0.06);border:none;color:rgba(255,255,255,0.4);padding:6px 16px;cursor:pointer;font-size:10px;letter-spacing:0.1em;text-transform:uppercase">✕ Cerrar</button>
  </div>
  <div id="intel-content" style="flex:1;overflow-y:auto;padding:28px 32px"></div>
</div>
`

// Cache-buster for deal-script.js — bump this string whenever deal-script.js changes
// so the browser fetches the latest version instead of the cached one.
const DEAL_SCRIPT_VER = '20260406-16'

// Module-level flag: prevents createAndGo from firing more than once at a time,
// guarding against double-clicks or remount-induced duplicate deal creation.
let _creatingDeal = false

export default function DealClient({
  dealId,
  initialData,
  initialName,
  initialPhotos,
  initialPlans,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [mobileView, setMobileView] = useState<'input' | 'output'>('input')
  const [displayName, setDisplayName] = useState(initialName)
  const scriptInjected = useRef(false)
  const renderDbTabsRef = useRef<(() => void) | null>(null)
  const saveRef = useRef<(() => Promise<void>) | null>(null)
  // Refs hold the latest photo/plan URLs so save() always reads up-to-date values
  // even if React hasn't committed the state update yet (stale-closure prevention).
  const photosRef = useRef<string[]>(initialPhotos)
  const plansRef = useRef<string[]>(initialPlans)
  // Ref for the deal HTML wrapper — we set innerHTML here exactly once so that
  // React re-renders (mobileView toggle, save state, etc.)
  // NEVER reset the DOM and lose the user's typed values.
  const dealWrapperRef = useRef<HTMLDivElement>(null)

  // Set DEAL_HTML into the wrapper once, synchronously after mount (before paint
  // and before scripts load). Then, for new deals, immediately clear demo values.
  // Using a ref instead of dangerouslySetInnerHTML means React never touches
  // innerHTML again on subsequent re-renders — that was the root cause of the
  // Cedaceros revert bug: some re-render could reset innerHTML to DEAL_HTML.
  useLayoutEffect(() => {
    const wrapper = dealWrapperRef.current
    if (!wrapper) return
    wrapper.innerHTML = DEAL_HTML

    if (Object.keys(initialData).length > 0) return
    // New deal: blank all demo-data values immediately after setting innerHTML
    wrapper.querySelectorAll<HTMLInputElement>('input[id]').forEach(el => {
      el.value = el.id === 'dealName' ? initialName : ''
    })
    wrapper.querySelectorAll<HTMLSelectElement>('select[id]').forEach(el => {
      el.selectedIndex = 0
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Collect all input/select/textarea values + toggle states + comparables from the DOM
  function getDealData(): Record<string, unknown> {
    const data: Record<string, unknown> = {}
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => {
      const input = el as HTMLInputElement
      if (input.id) data[input.id] = input.value
    })
    // Capture toggle states (dealMode, sfMode, taxOn, levMode…), comparables, and dossier
    // via deal-script.js's captureCurrentDeal() — these are not input fields
    type SnapFn = () => { fields: Record<string, string>; states: Record<string, unknown>; comps: unknown[]; dossier: unknown }
    const capture = (window as Window & { captureCurrentDeal?: SnapFn }).captureCurrentDeal
    if (capture) {
      const snap = capture()
      if (snap.states) data._states = snap.states
      if (snap.comps?.length) data._comps = snap.comps
      if (snap.dossier) data._dossier = snap.dossier
    }
    return data
  }

  // Restore saved data into DOM using deal-script's applyDeal (handles states,
  // comparables, money formatting) then set any fields not in DEAL_FIELDS.
  function setDealData(data: Record<string, unknown>) {
    type ApplyFn = (deal: { fields: Record<string, string>; states?: unknown; comps?: unknown[]; dossier?: unknown }) => void
    const apply = (window as Window & { applyDeal?: ApplyFn }).applyDeal

    const fields: Record<string, string> = {}
    Object.entries(data).forEach(([key, value]) => {
      if (!key.startsWith('_')) fields[key] = String(value ?? '')
    })

    if (apply) {
      // applyDeal sets DEAL_FIELDS, restores toggle states, restores comps,
      // refreshes slider labels, calls setupMoneyInputs — no per-field events
      apply({
        fields,
        states: data._states as Record<string, unknown> | undefined,
        comps: data._comps as unknown[] | undefined,
        dossier: data._dossier as unknown | undefined,
      })
      // Also set fields not in DEAL_FIELDS (e.g. finderFeePct, taxStructure extras)
      Object.entries(fields).forEach(([key, value]) => {
        const el = document.getElementById(key) as HTMLInputElement | null
        if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT') && el.value !== value) {
          el.value = value
        }
      })
    } else {
      // Fallback if applyDeal not available (shouldn't happen after script loads)
      Object.entries(fields).forEach(([key, value]) => {
        const el = document.getElementById(key) as HTMLInputElement | null
        if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) {
          el.value = value
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
      })
    }
  }

  const save = useCallback(async () => {
    setSaving(true)
    setSaveError(false)
    const data = getDealData()
    // Read name from the #dealName input directly (not from #deal-name-display
    // which shows "dealName · address" — a display string, not the deal name)
    const dealName = (data.dealName as string | undefined)?.trim() || initialName
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, name: dealName, photos: photosRef.current, plans: plansRef.current }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.error('[save] PUT failed', res.status, errText)
        throw new Error(`HTTP ${res.status}`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      // Update topbar name to reflect the just-saved name
      setDisplayName(dealName)
      // Defer renderDbTabs + update() to run after React commits state changes,
      // avoiding any timing conflict between React's re-render and direct DOM writes
      setTimeout(() => {
        renderDbTabsRef.current?.()
        ;(window as Window & { update?: () => void }).update?.()
      }, 0)
    } catch (err) {
      console.error('[save] error', err)
      setSaveError(true)
      setTimeout(() => setSaveError(false), 3000)
    } finally {
      setSaving(false)
    }
  }, [dealId, initialName])

  useEffect(() => {
    type RWWin = Window & {
      renderTabs?: () => void
      addDeal?: (name?: string) => void
      renderNotariaAndPlusvalia?: (...args: unknown[]) => void
      setAmpliacion?: (on: boolean) => void
      syncAmpliacion?: () => void
      autoFillDates?: (force?: boolean) => void
      update?: () => void
      __rwRenderDbTabs?: () => void
      __rwDealId?: string
      __rwDossierImages?: { fachada: string|null; interiores: (string|null)[]; planoActual: string|null; planoObjetivo: string|null }
      __rwNotifyImages?: () => void
      rwRestoreImages?: (photos: string[], plans: string[]) => void
    }
    const w = window as RWWin

    // visibilitychange: when the user switches back to this tab, refresh tabs and
    // recalculate output so the panel is never blank after a focus change.
    const onVisible = () => {
      if (document.hidden) return
      setTimeout(() => {
        renderDbTabsRef.current?.()
        w.update?.()
      }, 0)
    }
    document.addEventListener('visibilitychange', onVisible)

    // DOM-based guard: if deal-script.js is already in the DOM (e.g. React Strict Mode
    // double-mount in dev, or HMR remount), skip re-injection to avoid re-declaring
    // 'let' globals that would throw SyntaxError and corrupt state.
    const alreadyLoaded = !!document.querySelector(`script[src="/deal-script.js?v=${DEAL_SCRIPT_VER}"]`)

    if (alreadyLoaded) {
      scriptInjected.current = true
      // Re-attach renderDbTabs ref from the previous mount's closure (exposed on window)
      if (w.__rwRenderDbTabs) renderDbTabsRef.current = w.__rwRenderDbTabs
      // Refresh output and tabs on remount so nothing appears blank
      setTimeout(() => { renderDbTabsRef.current?.(); w.update?.() }, 0)
      const interval = setInterval(() => saveRef.current?.(), 60_000)
      return () => {
        clearInterval(interval)
        document.removeEventListener('visibilitychange', onVisible)
      }
    }

    if (scriptInjected.current) {
      const interval = setInterval(() => saveRef.current?.(), 60_000)
      return () => {
        clearInterval(interval)
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
    scriptInjected.current = true

    // 1. Load REGISTRO_DATA (large static dataset)
    const regScript = document.createElement('script')
    regScript.src = '/deal-registro.js'

    // 2. Load Leaflet CSS + JS CDN (maps)
    const leafletLink = document.createElement('link')
    leafletLink.rel = 'stylesheet'
    leafletLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(leafletLink)
    const leafletScript = document.createElement('script')
    leafletScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'

    // 3. Load Chart.js CDN
    const chartScript = document.createElement('script')
    chartScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'

    // 4. Load html2canvas CDN (for dossier screenshots)
    const html2canvasScript = document.createElement('script')
    html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'

    // 5. Load jsPDF CDN
    const jspdfScript = document.createElement('script')
    jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'

    // 6. Load main deal modeler logic
    const mainScript = document.createElement('script')
    mainScript.src = `/deal-script.js?v=${DEAL_SCRIPT_VER}`
    mainScript.onload = () => {
      // Block vanilla JS from managing tabs — we render them from DB
      w.renderTabs = () => {}

      // For new deals: neutralise every path that could restore demo defaults.
      //
      // deal-script.js's init sequence ran synchronously and:
      //   1. captureCurrentDeal() stored the DOM state into deals[0].fields/states
      //   2. renderTabs() painted a tab with onclick="switchTab(0)"
      //
      // Even though we already patched deals[0].fields to blank, applyDeal() also
      // restores deals[0].states (dealMode, zcOn, etc.) which reverts toggles the user
      // may have changed. More importantly, some path is still calling applyDeal()
      // during normal interaction (exact caller unknown without browser devtools).
      //
      // Nuclear fix for new deals: override applyDeal() to a no-op for the entire
      // page view. A new deal has exactly one tab, so applyDeal() has no legitimate
      // use — switchTab(0) returns early, addDeal is overridden to navigate away,
      // and removeDeal cannot remove the only remaining tab.
      if (Object.keys(initialData).length === 0) {
        type WDeals = Window & {
          deals?: Array<{ name: string; fields: Record<string, string>; states: Record<string, unknown>; comps: unknown[] }>
          applyDeal?: (deal: unknown) => void
        }
        const wDeals = window as WDeals
        // Patch fields + states to blank so even if applyDeal somehow bypasses
        // the override below (e.g. called before this line executes), it restores
        // blank values, not Cedaceros.
        if (wDeals.deals?.[0]) {
          Object.keys(wDeals.deals[0].fields).forEach(k => {
            wDeals.deals![0].fields[k] = k === 'dealName' ? initialName : ''
          })
          // Patch states so mode toggles are not reverted either
          wDeals.deals[0].states = {
            sfMode: 'tramos', sfCarryMode: 'irr', zcOn: false,
            dealMode: 'reforma', ampliacionOn: false, taxOn: true, plusvaliaOn: false,
            levMode: 'ltv', sensPrices: [12000, 13000, 14000, 15000, 16000, 17000],
          }
        }
        // Override applyDeal itself — the definitive guard against any revert path
        wDeals.applyDeal = () => {}
        // Belt-and-suspenders: also clear DOM inputs so the initial render is blank
        document.querySelectorAll<HTMLInputElement>('input[id]').forEach(el => {
          el.value = el.id === 'dealName' ? initialName : ''
        })
        document.querySelectorAll<HTMLSelectElement>('select[id]').forEach(el => {
          el.selectedIndex = 0
        })
      }

      // Wrap renderNotariaAndPlusvalia so errors don't abort update() and kill the output panel.
      // calcArancel() can return a plain number (not object) for small values, causing TypeError.
      const origRNP = w.renderNotariaAndPlusvalia
      w.renderNotariaAndPlusvalia = (...args) => { try { origRNP?.(...args) } catch {} }

      // Override setAmpliacion so toggling ampliación also:
      //   1. Updates the "— €" amount display (syncAmpliacion)
      //   2. Auto-fills the newly-visible date fields (autoFillDates)
      const origSetAmpliacion = w.setAmpliacion
      w.setAmpliacion = (on: boolean) => {
        origSetAmpliacion?.(on)
        w.syncAmpliacion?.()
        w.autoFillDates?.()
      }

      // "+" in tabs-bar and topbar button both create a real DB deal.
      // _creatingDeal guards against double-firing (rapid clicks, remount cycles).
      const createAndGo = (name?: string) => {
        if (_creatingDeal) return
        _creatingDeal = true
        fetch('/api/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name || 'Nueva operación' }),
        })
          .then(r => r.json())
          .then((d: { id: string }) => { window.location.href = `/deal/${d.id}` })
          .catch(() => { _creatingDeal = false })
      }
      w.addDeal = createAndGo

      // Fetch all deals and render DB-backed navigation tabs
      const renderDbTabs = () => {
        fetch('/api/deals')
          .then(r => r.json())
          .then((allDeals: Array<{ id: string; name: string }>) => {
            const bar = document.getElementById('tabs-bar')
            if (!bar) return
            bar.innerHTML =
              allDeals.map(d =>
                `<div class="tab-item${d.id === dealId ? ' active' : ''}"
                  onclick="window.location.href='/deal/${d.id}'"
                  style="cursor:pointer"
                  title="${d.name.replace(/[<>"]/g, '')}">
                  <span class="tab-name">${d.name.replace(/[<>]/g, '')}</span>
                </div>`
              ).join('') +
              `<button class="tab-add" id="rw-tab-add" title="Nueva operación">+</button>`

            document.getElementById('rw-tab-add')?.addEventListener('click', () => createAndGo())
          })
          .catch(() => {})
      }
      renderDbTabs()
      renderDbTabsRef.current = renderDbTabs
      // Expose on window so remounts can re-attach the ref without re-injecting scripts
      w.__rwRenderDbTabs = renderDbTabs

      // Expose dealId so deal-script.js can upload images to the right deal
      w.__rwDealId = dealId
      // Called by deal-script.js after any image add/remove — syncs to React state so save() persists them
      w.__rwNotifyImages = () => {
        const imgs = w.__rwDossierImages
        if (!imgs) return
        const photoUrls = ([imgs.fachada, ...imgs.interiores] as (string|null)[]).filter((u): u is string => !!u)
        const planUrls = ([imgs.planoActual, imgs.planoObjetivo] as (string|null)[]).filter((u): u is string => !!u)
        photosRef.current = photoUrls
        plansRef.current = planUrls
      }

      // After the script initialises, restore saved data then force-recalculate dates
      setTimeout(() => {
        if (Object.keys(initialData).length > 0) {
          setDealData(initialData)
        }
        // Restore saved images into the named drop zones
        if (initialPhotos.length > 0 || initialPlans.length > 0) {
          w.rwRestoreImages?.(initialPhotos, initialPlans)
        }
        // New deals: already blanked by useLayoutEffect before scripts loaded.
        // Don't re-clear here — user may have started typing by this point.
        w.autoFillDates?.()
        // Ensure output is calculated even if no states triggered update() above
        w.update?.()
        // Re-render tabs after data restore so active tab shows saved name
        renderDbTabs()
      }, 400)
    }

    // Load all deps in parallel, then load main script when all are ready
    let depsLoaded = 0
    const TOTAL_DEPS = 5
    const onDepLoaded = () => { if (++depsLoaded === TOTAL_DEPS) document.body.appendChild(mainScript) }
    regScript.onload = onDepLoaded
    leafletScript.onload = onDepLoaded
    chartScript.onload = onDepLoaded
    html2canvasScript.onload = onDepLoaded
    jspdfScript.onload = onDepLoaded
    // Treat failed CDN loads as loaded (non-critical)
    leafletScript.onerror = onDepLoaded
    chartScript.onerror = onDepLoaded
    html2canvasScript.onerror = onDepLoaded

    document.body.appendChild(regScript)
    document.body.appendChild(leafletScript)
    document.body.appendChild(chartScript)
    document.body.appendChild(html2canvasScript)
    document.body.appendChild(jspdfScript)

    // Autosave every 60 seconds — call via ref so it always uses the latest closure
    saveRef.current = save
    const interval = setInterval(() => saveRef.current?.(), 60_000)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep saveRef current so the autosave interval always uses the latest closure
  useEffect(() => { saveRef.current = save }, [save])

  // Re-run update() whenever the mobile output panel becomes visible.
  // useEffect fires after React has committed the DOM (output panel visible),
  // so render() in deal-script.js can write to its elements correctly.
  useEffect(() => {
    if (mobileView !== 'output') return
    const timer = setTimeout(() => {
      ;(window as Window & { update?: () => void }).update?.()
    }, 50)
    return () => clearTimeout(timer)
  }, [mobileView])

  // Append fixed overlays directly to document.body so position:fixed escapes
  // the overflow:hidden parent and renders as true full-screen elements.
  useEffect(() => {
    const OVERLAY_IDS = ['consol-view', 'presentation-mode', 'ai-terminal', 'intel-overlay']
    // Skip if already injected (strict-mode double-mount / HMR)
    if (document.getElementById('presentation-mode')) return
    const tmp = document.createElement('div')
    tmp.innerHTML = OVERLAY_HTML
    while (tmp.firstChild) document.body.appendChild(tmp.firstChild)
    return () => { OVERLAY_IDS.forEach(id => document.getElementById(id)?.remove()) }
  }, [])

  return (
    <>
      {/* ── Custom React topbar ─────────────────────────────────────────── */}
      <div className="topbar">
        <a
          href="/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          <Image
            src="/Riverwalk_Logo_Blanco.png"
            alt="Riverwalk"
            width={120}
            height={20}
            priority
          />
        </a>

        <div className="topbar-sep" />
        <div className="topbar-label">Deal Modeler v2</div>
        <div className="topbar-sep" />
        <div className="topbar-deal" id="deal-name-display">
          {displayName}
        </div>

        <div className="topbar-right">
          <button
            id="dark-toggle"
            className="btn"
            onClick={() => { if (typeof window !== 'undefined' && (window as any).toggleDarkMode) (window as any).toggleDarkMode() }}
            title="Modo oscuro"
            style={{ fontSize: 14, padding: '4px 10px', minWidth: 0 }}
          >
            ◑
          </button>
          <div className="topbar-sep" />
          <div className="status-dot" />
          <div className="status-lbl">Tiempo real</div>
          <div className="topbar-sep" />

          <button className="btn btn-reset" onClick={async () => {
            if (_creatingDeal) return
            _creatingDeal = true
            const res = await fetch('/api/deals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'Nueva operación' }),
            })
            if (res.ok) {
              const deal = await res.json()
              window.location.href = `/deal/${deal.id}`
            } else {
              _creatingDeal = false
            }
          }}>
            + Nuevo deal
          </button>

          <button
            className="btn"
            onClick={save}
            disabled={saving}
            style={saved ? { background: 'var(--green)', color: '#fff' } : saveError ? { background: 'var(--red)', color: '#fff' } : undefined}
          >
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : saveError ? '✗ Error al guardar' : 'Guardar'}
          </button>

          <button
            className="btn primary"
            onClick={() => { if (typeof window !== 'undefined' && (window as any).openPresentation) (window as any).openPresentation() }}
            style={{ background: 'rgba(139,105,20,0.25)', border: '1px solid var(--gold)' }}
          >
            ▶ Presentar
          </button>

          <button
            className="btn primary"
            onClick={() => { if (typeof window !== 'undefined' && (window as any).exportDossierPDF) (window as any).exportDossierPDF() }}
            style={{ background: 'rgba(139,105,20,0.35)', border: '1px solid var(--gold)' }}
            title="Generar PDF dossier — página por página A4"
          >
            ⬇ PDF Dossier
          </button>

          <button
            className="btn primary"
            onClick={() => { if (typeof window !== 'undefined' && (window as any).openAITerminal) (window as any).openAITerminal() }}
            style={{ background: 'rgba(60,100,180,0.2)', border: '1px solid #5588cc' }}
            title="Terminal IA — genera textos de presentación"
          >
            ✦ Narrativa IA
          </button>

          <button
            className="btn primary"
            onClick={() => { if (typeof window !== 'undefined' && (window as any).openIntelligence) (window as any).openIntelligence() }}
            style={{ background: 'rgba(120,60,200,0.2)', border: '1px solid rgba(160,100,240,0.5)' }}
            title="Intelligence Platform"
          >
            ⬡ Intel
          </button>
        </div>
      </div>

      {/* ── Mobile panel switcher (hidden on desktop via CSS) ───────────── */}
      <div className="mobile-panel-toggle">
        <button
          className={`mobile-panel-btn${mobileView === 'input' ? ' active' : ''}`}
          onClick={() => setMobileView('input')}
        >
          Datos de entrada
        </button>
        <button
          className={`mobile-panel-btn${mobileView === 'output' ? ' active' : ''}`}
          onClick={() => setMobileView('output')}
        >
          Resultados
        </button>
      </div>

      {/* ── Original deal modeler HTML body ─────────────────────────────── */}
      {/* innerHTML is set once via dealWrapperRef in useLayoutEffect — NOT via
          dangerouslySetInnerHTML — so React re-renders never reset user input. */}
      <div
        ref={dealWrapperRef}
        className={`deal-wrapper${mobileView === 'output' ? ' mobile-show-output' : ' mobile-show-input'}`}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
      />

    </>
  )
}

