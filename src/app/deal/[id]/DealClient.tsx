'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'

interface Props {
  dealId: string
  initialData: Record<string, unknown>
  initialName: string
  initialPhotos: string[]
  initialPlans: string[]
}

// Original deal modeler HTML body (tabs-bar + app-body)
const DEAL_HTML = `<div id="tabs-bar" class="tabs-bar"></div>

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
      </div>
      <div id="pase-note" style="display:none;font-size:9px;color:var(--text-d);margin-top:8px;padding:8px 10px;background:rgba(139,105,20,0.07);border-left:2px solid var(--gold);line-height:1.7">
        <strong style="color:var(--gold)">Modo pase:</strong> sin CapEx ni reforma. Solo compra y venta rápida. El carry es un porcentaje fijo sobre el beneficio bruto.
      </div>

      <div class="idivider">Ubicación</div>
      <div class="irow full">
        <div class="field">
          <label>Dirección completa</label>
          <input id="dealAddress" value="Calle Cedaceros 8" oninput="update()"
            onblur="geocodeAddress()"
            placeholder="Calle, número — al salir del campo busca el CP">
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
      <span class="isec-lbl">Precios de salida</span>
      <span class="isec-arr open">▼</span>
    </div>
    <div class="ibody">
      <div class="sc-fields" style="margin-bottom:8px">
        <div class="sc-f p"><label>Pesimista (€/m²)</label><input type="number" id="exitP" value="15000" oninput="update()"></div>
        <div class="sc-f b"><label>Base (€/m²)</label><input type="number" id="exitB" value="16000" oninput="update()"></div>
        <div class="sc-f o"><label>Optimista (€/m²)</label><input type="number" id="exitO" value="17000" oninput="update()"></div>
      </div>
      <div class="irow full">
        <div class="field"><label>Comisión broker salida (%)</label><input type="number" id="brokerExit" value="3" step="0.1" oninput="update()"></div>
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

      <div class="idivider">
        Plusvalía + notaría venta
      </div>
      <div class="toggle-row" style="margin-bottom:8px">
        <button class="toggle-btn active" id="plusvalia-off-btn" onclick="setPlusvaliaMode(false)">Importe manual</button>
        <button class="toggle-btn" id="plusvalia-on-btn" onclick="setPlusvaliaMode(true)">Calcular automáticamente</button>
      </div>

      <!-- Modo manual: solo el campo de importe -->
      <div id="plusvalia-manual-fields">
        <div class="irow">
          <div class="field">
            <label>Plusvalía + notaría venta (€)</label>
            <input type="text" id="exitFixed" data-fmt="money" value="15000" placeholder="Estimación manual">
          </div>
          <div class="field">
            <label>Ajuste (€) <span class="tag-optional">±</span></label>
            <input type="text" id="exitFixedAjuste" data-fmt="money" value="0" placeholder="0">
          </div>
        </div>
      </div>

      <!-- Modo automático: datos catastrales -->
      <div id="plusvalia-auto-fields" style="display:none">
        <div style="font-size:10.5px;color:var(--text-d);margin:2px 0 8px;line-height:1.8">
          Datos del recibo del IBI del inmueble. Calcula la plusvalía municipal (IIVTNU) por el método más favorable (RDL 26/2021).
        </div>
        <div class="irow">
          <div class="field"><label>Valor catastral total (€)</label><input type="text" id="vcTotal" data-fmt="money" value="0" placeholder="Del recibo IBI" oninput="update()"></div>
          <div class="field"><label>Valor catastral suelo (€)</label><input type="text" id="vcSuelo" data-fmt="money" value="0" placeholder="Del recibo IBI" oninput="update()"></div>
        </div>
        <div class="irow">
          <div class="field"><label>Año adquisición por el vendedor</label><input type="number" id="vcAnyoAdq" value="2010" min="1950" max="2030" oninput="update()"></div>
          <div class="field"><label>Tipo impositivo plusvalía (%)</label><input type="number" id="plusvaliaTipo" value="29" step="0.5" oninput="update()"></div>
        </div>
        <div id="plusvalia-calc-display" style="background:var(--d4);border:1px solid var(--line);padding:10px 12px;margin:8px 0;font-size:10px;font-family:'DM Mono',monospace;line-height:1.9"></div>
        <div style="font-size:10.5px;color:var(--text-d);margin-top:4px">↑ El importe calculado se aplica automáticamente al campo "Plusvalía + notaría venta" del modo manual.</div>
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
        Pega el enlace de cualquier anuncio (Idealista, Fotocasa…) y el modelo extrae
        precio y m² automáticamente. O busca directamente en los datos del Registro.
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

      <!-- URL PASTE BAR -->
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:14px">
        <input type="url" id="comp-url-input"
          placeholder="Pega aquí el enlace del anuncio…"
          style="flex:1;background:var(--d4);border:1px solid var(--gold-d);color:var(--text-b);
                 font-family:'DM Mono',monospace;font-size:11px;padding:9px 12px;outline:none">
        <button id="comp-extract-btn" onclick="extractComp()"
          style="background:var(--gold);border:none;color:#fff;font-family:'Raleway',sans-serif;
                 font-size:9px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;
                 padding:9px 16px;cursor:pointer;white-space:nowrap;transition:all 0.15s;flex-shrink:0">
          ✦ Extraer datos
        </button>
      </div>
      <div id="comp-extract-status" style="font-size:10px;color:var(--text-d);margin-bottom:10px;min-height:16px"></div>

      <!-- COMP LIST -->
      <div class="comp-row header">
        <div></div>
        <div>Descripción</div>
        <div>Estado</div>
        <div>Precio</div>
        <div>M²</div>
        <div>€/m²</div>
        <div></div>
      </div>
      <div id="comp-rows-input"></div>
      <button class="comp-add-btn" onclick="addComp()">+ Añadir testigo manual</button>
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
    <div class="kpi-c"><div class="kpi-lbl">ROI neto inversor (base)</div><div class="kpi-v" id="kpi-roi">—</div><div class="kpi-n" id="kpi-roi-n">Post fees</div></div>
    <div class="kpi-c"><div class="kpi-lbl">TIR anual (base)</div><div class="kpi-v up" id="kpi-irr">—</div><div class="kpi-n" id="kpi-irr-n">Equity sin apalancar</div></div>
    <div class="kpi-c"><div class="kpi-lbl">Beneficio neto (base)</div><div class="kpi-v" id="kpi-profit">—</div><div class="kpi-n">Al inversor</div></div>
    <div class="kpi-c"><div class="kpi-lbl">Breakeven (€/m²)</div><div class="kpi-v" id="kpi-be">—</div><div class="kpi-n" id="kpi-be-n">—</div></div>
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
    <div class="osec-title"><span class="osec-tag">05</span>Protección de Capital — Breakeven</div>
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
  const [photos, setPhotos] = useState<string[]>(initialPhotos)
  const [plans, setPlans] = useState<string[]>(initialPlans)
  const [mobileView, setMobileView] = useState<'input' | 'output'>('input')
  const [displayName, setDisplayName] = useState(initialName)
  const scriptInjected = useRef(false)
  const [uploadContainer, setUploadContainer] = useState<Element | null>(null)
  const renderDbTabsRef = useRef<(() => void) | null>(null)
  const saveRef = useRef<(() => Promise<void>) | null>(null)

  // Collect all input/select values + toggle states + comparables from the DOM
  function getDealData(): Record<string, unknown> {
    const data: Record<string, unknown> = {}
    document.querySelectorAll('input[id], select[id]').forEach(el => {
      const input = el as HTMLInputElement
      if (input.id) data[input.id] = input.value
    })
    // Capture toggle states (dealMode, sfMode, taxOn, levMode…) and comparables
    // via deal-script.js's captureCurrentDeal() — these are not input fields
    type SnapFn = () => { fields: Record<string, string>; states: Record<string, unknown>; comps: unknown[] }
    const capture = (window as Window & { captureCurrentDeal?: SnapFn }).captureCurrentDeal
    if (capture) {
      const snap = capture()
      if (snap.states) data._states = snap.states
      if (snap.comps?.length) data._comps = snap.comps
    }
    return data
  }

  // Restore saved data into DOM using deal-script's applyDeal (handles states,
  // comparables, money formatting) then set any fields not in DEAL_FIELDS.
  function setDealData(data: Record<string, unknown>) {
    type ApplyFn = (deal: { fields: Record<string, string>; states?: unknown; comps?: unknown[] }) => void
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
        body: JSON.stringify({ data, name: dealName, photos, plans }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
    } catch {
      setSaveError(true)
      setTimeout(() => setSaveError(false), 3000)
    } finally {
      setSaving(false)
    }
  }, [dealId, photos, plans, initialName])

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
    const alreadyLoaded = !!document.querySelector('script[src="/deal-script.js"]')

    if (alreadyLoaded) {
      scriptInjected.current = true
      // Re-attach renderDbTabs ref from the previous mount's closure (exposed on window)
      if (w.__rwRenderDbTabs) renderDbTabsRef.current = w.__rwRenderDbTabs
      // Re-create upload container if it was lost on remount
      if (!document.getElementById('upload-section')) {
        const inputPanel = document.querySelector('.input-panel')
        if (inputPanel) {
          const container = document.createElement('div')
          container.id = 'upload-section'
          inputPanel.appendChild(container)
          setUploadContainer(container)
        }
      }
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

    // 2. Load jsPDF CDN
    const jspdfScript = document.createElement('script')
    jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'

    // 3. Load main deal modeler logic
    const mainScript = document.createElement('script')
    mainScript.src = '/deal-script.js'
    mainScript.onload = () => {
      // Block vanilla JS from managing tabs — we render them from DB
      w.renderTabs = () => {}

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

      // After the script initialises, restore saved data then force-recalculate dates
      setTimeout(() => {
        if (Object.keys(initialData).length > 0) {
          setDealData(initialData)
        }
        // Don't force-fill dates: only fill empty ones so saved custom dates are preserved
        w.autoFillDates?.()
        // Ensure output is calculated even if no states triggered update() above
        w.update?.()
        // Re-render tabs after data restore so active tab shows saved name
        renderDbTabs()
      }, 400)
    }

    // Load registro and jspdf in parallel, then load main script
    let depsLoaded = 0
    const onDepLoaded = () => { if (++depsLoaded === 2) document.body.appendChild(mainScript) }
    regScript.onload = onDepLoaded
    jspdfScript.onload = onDepLoaded

    document.body.appendChild(regScript)
    document.body.appendChild(jspdfScript)

    // Create upload container inside input panel
    const inputPanel = document.querySelector('.input-panel')
    if (inputPanel) {
      const container = document.createElement('div')
      container.id = 'upload-section'
      inputPanel.appendChild(container)
      setUploadContainer(container)
    }

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
            className="btn primary btn-brief"
            onClick={() => {
              if (typeof window !== 'undefined' && (window as Window & { copyExport?: () => void }).copyExport) {
                (window as Window & { copyExport?: () => void }).copyExport!()
              }
            }}
          >
            ⬇ Brief maquetación
          </button>

          <button
            className="btn primary"
            onClick={() => {
              if (typeof window !== 'undefined' && (window as Window & { exportPDF?: () => void }).exportPDF) {
                (window as Window & { exportPDF?: () => void }).exportPDF!()
              }
            }}
            style={{ background: 'var(--gold-d)' }}
          >
            ↓ PDF
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
      <div
        className={`deal-wrapper${mobileView === 'output' ? ' mobile-show-output' : ' mobile-show-input'}`}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
        dangerouslySetInnerHTML={{ __html: DEAL_HTML }}
      />

      {/* ── Image upload portal inside .input-panel ─────────────────────── */}
      {uploadContainer && createPortal(
        <div style={{ borderTop: '1px solid var(--line2)', padding: '0 0 16px' }}>
          <div className="isec-hd" style={{ cursor: 'default' }}>
            <span className="isec-lbl">Imágenes del activo</span>
          </div>
          <div className="ibody" style={{ paddingTop: 12 }}>
            <ImageUploadSection
              dealId={dealId}
              label="Fotos del activo"
              images={photos}
              onImagesChange={setPhotos}
              min={3}
              max={6}
            />
            <ImageUploadSection
              dealId={dealId}
              label="Planos"
              images={plans}
              onImagesChange={setPlans}
              min={1}
              max={6}
            />
          </div>
        </div>,
        uploadContainer
      )}
    </>
  )
}

// ── Inline image upload section ─────────────────────────────────────────────

interface UploadSectionProps {
  dealId: string
  label: string
  images: string[]
  onImagesChange: (images: string[]) => void
  min: number
  max: number
}

function ImageUploadSection({ dealId, label, images, onImagesChange, min, max }: UploadSectionProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList) {
    setUploading(true)
    const newUrls: string[] = []
    for (let i = 0; i < files.length && images.length + newUrls.length < max; i++) {
      const formData = new FormData()
      formData.append('file', files[i])
      formData.append('dealId', dealId)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (res.ok) {
          const { url } = await res.json() as { url: string }
          newUrls.push(url)
        }
      } catch {
        // continue with remaining files on individual failure
      }
    }
    if (newUrls.length > 0) onImagesChange([...images, ...newUrls])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeImage(index: number) {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  const countColor = images.length >= min ? 'var(--green, #22c55e)' : 'var(--amber, #f59e0b)'

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="idivider">
        {label}{'  '}
        <span style={{ color: countColor, fontVariantNumeric: 'tabular-nums' }}>
          {images.length}/{max}
        </span>
      </div>

      {images.length > 0 && (
        <div
          className="image-upload-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 8,
          }}
        >
          {images.map((url, i) => (
            <div
              key={url}
              style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 6, overflow: 'hidden', background: 'var(--d2)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${label} ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <button
                className="image-delete-btn"
                onClick={() => removeImage(i)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: '22px',
                  textAlign: 'center',
                  padding: 0,
                }}
                title="Eliminar"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length < max && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
          }}
          style={{
            border: `2px dashed ${dragOver ? 'var(--gold)' : 'var(--line)'}`,
            borderRadius: 8,
            padding: '16px 12px',
            textAlign: 'center',
            cursor: 'pointer',
            color: 'var(--text-d)',
            fontSize: 13,
            background: dragOver ? 'var(--d2)' : 'transparent',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          {uploading
            ? 'Subiendo…'
            : `Añadir ${label.toLowerCase()} · arrastra o haz clic (máx. ${max})`}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  )
}
