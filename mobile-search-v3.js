/* Mobile Search V3
   - Fila/Scaffale OR Bancale/Carrello: one of the two is enough
   - exact article + size queries
   - grouped availability accordion
   - mobile left-edge swipe back
   - corrected master position integrity semantics
*/
(function installWarehouseMobileSearchV3(){
  'use strict';
  if (window.WarehouseMobileSearchV3) return;

  const VERSION = '2026.08.20-mobile-search-v3';
  const VALID_STATES = ['NUOVO', 'SCARICATO', 'USATO'];
  const SIZE_RE = /^(?:[2-9]?XS|[2-9]?XL|XXS|XXL|XS|S|M|L|XL|TU|UNI|UNICA|[0-9]{1,3})$/i;
  const openGroups = new Set();
  const screenHistory = [];
  let goingBack = false;
  let showWrapped = false;
  let integrityObserver = null;

  const byId = id => document.getElementById(id);
  const text = value => String(value ?? '');
  const norm = value => text(value).trim().toUpperCase();
  const escapeHtml = value => {
    if (typeof esc === 'function') return esc(value);
    return text(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  };

  function locationOfRow(row) {
    if (typeof locationOf === 'function') return norm(locationOf(row));
    return norm(row?.fila_scaffale || row?.fila || '');
  }

  function hasPosition(location, pallet) {
    return Boolean(norm(location) || norm(pallet));
  }

  function ensurePositionUi() {
    const locationInput = byId('filaScaffale');
    const palletInput = byId('bancale');

    if (locationInput) {
      const label = locationInput.closest('label');
      if (label) {
        for (const node of label.childNodes) {
          if (node.nodeType === 3 && /Fila\/Scaffale/i.test(node.textContent || '')) {
            node.textContent = 'Fila/Scaffale';
          }
        }
        let note = label.querySelector('.msv3PositionNote');
        if (!note) {
          note = document.createElement('small');
          note.className = 'uxOptionalNote msv3PositionNote';
          label.appendChild(note);
        }
        note.textContent = 'Inserisci Fila/Scaffale oppure Bancale/Carrello. È sufficiente uno dei due.';
      }
      locationInput.placeholder = 'Es. 13 · facoltativo se indichi il Bancale';
    }

    if (palletInput) {
      const label = palletInput.closest('label');
      if (label) {
        label.dataset.uxRequired = '';
        for (const node of label.childNodes) {
          if (node.nodeType === 3 && /^Bancale/i.test((node.textContent || '').trim())) {
            node.textContent = 'Bancale / Carrello';
          }
        }
      }
      palletInput.placeholder = 'Es. 38 · facoltativo se indichi Fila/Scaffale';
    }

    window.validateLocation = function validateFlexibleLocation() {
      const location = norm(byId('filaScaffale')?.value);
      const pallet = norm(byId('bancale')?.value);
      if (!hasPosition(location, pallet)) {
        alert('Inserisci almeno una posizione: Fila/Scaffale oppure Bancale/Carrello.');
        byId('filaScaffale')?.focus();
        return false;
      }
      return true;
    };
  }

  function ensureStockEditorUi() {
    const locationInput = byId('stockEditLocation');
    const palletInput = byId('stockEditPallet');

    if (locationInput) {
      const label = locationInput.closest('label');
      if (label) {
        for (const node of label.childNodes) {
          if (node.nodeType === 3 && /Fila\/Scaffale/i.test(node.textContent || '')) {
            node.textContent = 'Fila/Scaffale';
          }
        }
        let note = label.querySelector('.msv3EditNote');
        if (!note) {
          note = document.createElement('small');
          note.className = 'uxOptionalNote msv3EditNote';
          label.appendChild(note);
        }
        note.textContent = 'Puoi cercare per Fila/Scaffale, Bancale/Carrello oppure entrambi.';
      }
    }

    if (palletInput) {
      const label = palletInput.closest('label');
      if (label) {
        for (const node of label.childNodes) {
          if (node.nodeType === 3 && /^Bancale/i.test((node.textContent || '').trim())) {
            node.textContent = 'Bancale / Carrello';
          }
        }
      }
    }

    window.stockEditRowsAtSource = function stockEditRowsAtFlexibleSource() {
      const location = norm(stockEditSource?.fila_scaffale);
      const pallet = norm(stockEditSource?.bancale);
      const rows = typeof stockBuckets === 'function' ? stockBuckets() : [];
      return rows.filter(row => {
        const locationMatches = !location || locationOfRow(row) === location;
        const palletMatches = !pallet || norm(row.bancale) === pallet;
        return locationMatches && palletMatches;
      });
    };

    window.loadStockPallet = function loadFlexibleStockPosition() {
      if (!requireLogin()) return;
      const location = norm(byId('stockEditLocation')?.value);
      const pallet = norm(byId('stockEditPallet')?.value);

      if (!hasPosition(location, pallet)) {
        alert('Inserisci Fila/Scaffale oppure Bancale/Carrello.');
        byId('stockEditLocation')?.focus();
        return;
      }

      stockEditSource = { fila_scaffale: location, bancale: pallet };
      const rows = window.stockEditRowsAtSource();
      if (!rows.length) {
        stockEditRowsDraft = [];
        byId('stockEditEditor')?.classList.add('hidden');
        setStatus(
          'stockEditSearchStatus',
          `Nessuna giacenza trovata${location ? ' in Fila/Scaffale ' + location : ''}${pallet ? ' su Bancale/Carrello ' + pallet : ''}.`,
          'error'
        );
        return;
      }

      stockEditBuildDraft(rows);
      setStatus(
        'stockEditSearchStatus',
        `Trovate ${rows.length} righe${location ? ' · Fila/Scaffale ' + location : ''}${pallet ? ' · Bancale/Carrello ' + pallet : ''}.`,
        'good'
      );
      byId('stockEditEditor')?.classList.remove('hidden');
      renderStockEditRows();
    };

    window.addStockEditRow = function addFlexibleStockEditRow() {
      const location = norm(stockEditSource?.fila_scaffale);
      const pallet = norm(stockEditSource?.bancale);
      if (!hasPosition(location, pallet)) {
        alert('Cerca prima una posizione: Fila/Scaffale oppure Bancale/Carrello.');
        return;
      }

      stockEditRowsDraft.push({
        edit_id: uid(),
        original: null,
        deleted: false,
        article_base: '',
        size: '',
        quantity: 0,
        state: 'NUOVO',
        fila_scaffale: location,
        bancale: pallet
      });
      renderStockEditRows();
      setTimeout(() => {
        const rows = document.querySelectorAll('#stockEditRows .stockEditRow');
        rows[rows.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 30);
    };
  }

  function parseSearch(rawValue) {
    const query = norm(rawValue).replace(/\s+/g, ' ').trim();
    if (!query) return { raw: '', article: '', size: '' };

    // Supported: I00215 S, I00215-S, I00215 - S
    const split = query.match(/^(.*?)(?:\s*-\s*|\s+)([A-Z0-9]+)$/i);
    if (split && SIZE_RE.test(split[2])) {
      const article = norm(split[1]).replace(/[\s-]+$/, '');
      if (article) return { raw: query, article, size: norm(split[2]) };
    }

    const lastDash = query.lastIndexOf('-');
    if (lastDash > 0) {
      const possibleSize = norm(query.slice(lastDash + 1));
      if (SIZE_RE.test(possibleSize)) {
        return {
          raw: query,
          article: norm(query.slice(0, lastDash)),
          size: possibleSize
        };
      }
    }

    return { raw: query, article: '', size: '' };
  }

  function genericRowMatch(row, query) {
    const tokens = norm(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return true;
    const haystack = [
      row.article_base,
      row.size,
      row.state,
      locationOfRow(row),
      row.bancale
    ].map(norm).join(' ');
    return tokens.every(token => haystack.includes(token));
  }

  function rowMatchesSearch(row, parsed) {
    if (parsed.article && parsed.size) {
      return norm(row.article_base) === parsed.article && norm(row.size) === parsed.size;
    }
    return genericRowMatch(row, parsed.raw);
  }

  function groupKey(row) {
    return `${norm(row.article_base)}|${norm(row.size)}`;
  }

  function availabilityHtml(row) {
    const location = locationOfRow(row);
    const pallet = norm(row.bancale);
    const payload = encodeURIComponent(JSON.stringify({
      article_base: row.article_base,
      size: row.size || '',
      state: row.state || 'NUOVO',
      fila_scaffale: location,
      bancale: pallet
    }));

    return `
      <div class="msv2AvailabilityRow">
        <div class="msv2AvailMain">
          <b>${Number(row.quantity || 0).toLocaleString('it-IT')} pz</b>
          <span class="msv2State">${escapeHtml(row.state || '—')}</span>
        </div>
        <div class="msv2Place">
          ${location ? `<span>Fila/Scaffale <b>${escapeHtml(location)}</b></span>` : ''}
          ${pallet ? `<span>Bancale/Carrello <b>${escapeHtml(pallet)}</b></span>` : ''}
          ${!location && !pallet ? '<span class="msv2Missing">POSIZIONE NON ASSEGNATA</span>' : ''}
        </div>
        <div class="uxQuickActions msv2Actions">
          <button type="button" class="uxQuickOut" onclick="uxQuickOperation('SCARICA','${payload}')">SCARICA</button>
          <button type="button" class="uxQuickIn" onclick="uxQuickOperation('CARICA','${payload}')">CARICA</button>
          <button type="button" class="uxQuickEdit" onclick="uxQuickEdit('${payload}')">MODIFICA</button>
        </div>
      </div>`;
  }

  window.msv3ToggleGroup = function toggleAvailabilityGroup(encodedKey) {
    const key = decodeURIComponent(encodedKey);
    if (openGroups.has(key)) openGroups.delete(key);
    else openGroups.add(key);
    window.renderStock?.();
  };

  function renderGroupedStock() {
    const searchInput = byId('searchInput');
    if (!searchInput) return;

    const parsed = parseSearch(searchInput.value);
    const selectedState = norm(byId('uxSearchState')?.value);
    const allRows = typeof stockBuckets === 'function' ? stockBuckets() : [];
    const rows = allRows.filter(row => {
      return rowMatchesSearch(row, parsed) && (!selectedState || norm(row.state) === selectedState);
    });

    const totalPieces = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const groupsMap = new Map();
    for (const row of rows) {
      const key = groupKey(row);
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key).push(row);
    }
    const groups = [...groupsMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    const summary = byId('uxSearchSummary');
    if (summary) {
      if (parsed.article && parsed.size) {
        summary.textContent = `${parsed.article} · taglia ${parsed.size} · ${rows.length} disponibilità · ${totalPieces.toLocaleString('it-IT')} pezzi`;
      } else {
        summary.textContent = `${groups.length} articoli/taglie · ${rows.length} disponibilità · ${totalPieces.toLocaleString('it-IT')} pezzi`;
      }
    }

    const list = byId('stockList');
    if (!list) return;
    if (!groups.length) {
      list.innerHTML = '<p>Nessuna giacenza trovata.</p>';
      return;
    }

    list.innerHTML = groups.map(([key, groupRows]) => {
      const first = groupRows[0];
      const groupTotal = groupRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      const expanded = openGroups.has(key);
      const encodedKey = encodeURIComponent(key);
      const states = [...new Set(groupRows.map(row => norm(row.state)).filter(Boolean))];
      const sortedRows = [...groupRows].sort((a, b) => {
        const av = `${locationOfRow(a)}|${norm(a.bancale)}|${norm(a.state)}`;
        const bv = `${locationOfRow(b)}|${norm(b.bancale)}|${norm(b.state)}`;
        return av.localeCompare(bv);
      });

      return `
        <div class="msv2StockGroup">
          <button type="button" class="msv2GroupHead" onclick="msv3ToggleGroup('${encodedKey}')" aria-expanded="${expanded ? 'true' : 'false'}">
            <div>
              <div class="sku">${escapeHtml(first.article_base)}${first.size ? ` · ${escapeHtml(first.size)}` : ''}</div>
              <div class="msv2GroupSub">${groupRows.length} disponibilità · ${states.map(escapeHtml).join(' / ')}</div>
            </div>
            <div class="msv2GroupQty">
              <b>${groupTotal.toLocaleString('it-IT')}</b>
              <span>pezzi</span>
              <i>${expanded ? '⌃' : '⌄'}</i>
            </div>
          </button>
          <div class="msv2GroupBody ${expanded ? '' : 'hidden'}">
            ${sortedRows.map(availabilityHtml).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function installSearch() {
    const input = byId('searchInput');
    if (input) {
      input.placeholder = 'Articolo o articolo + taglia · es. I00215-S';
      if (!input.dataset.msv3Input) {
        input.dataset.msv3Input = '1';
        input.addEventListener('input', () => window.renderStock?.());
      }
    }
    window.renderStock = renderGroupedStock;
  }

  function visibleScreen() {
    return [...document.querySelectorAll('.screen.on')][0] || null;
  }

  function wrapScreenHistory() {
    if (showWrapped || typeof window.show !== 'function') return;
    const originalShow = window.show;

    window.show = function showWithHistory(id) {
      const current = visibleScreen()?.id || '';
      if (!goingBack) {
        if (id === 'home') screenHistory.length = 0;
        else if (current && current !== id) screenHistory.push(current);
      }
      return originalShow.apply(this, arguments);
    };
    window.show.__msv3Original = originalShow;
    showWrapped = true;
  }

  function smartBack() {
    const openDialogs = [...document.querySelectorAll('dialog[open]')];
    const dialog = openDialogs[openDialogs.length - 1];
    if (dialog) {
      try { dialog.close(); } catch {}
      return true;
    }

    const current = visibleScreen();
    if (!current || current.id === 'home') return false;

    let fallback = 'home';
    if (current.id === 'bridge' && typeof bridgeBackScreen !== 'undefined' && bridgeBackScreen) fallback = bridgeBackScreen;
    else if (current.id === 'results') fallback = 'operation';
    else if (current.id === 'requestReview') fallback = 'requestNew';
    else if (current.id === 'requestDetail') fallback = 'requests';
    else if (current.id === 'requestNew') fallback = 'requests';

    const target = screenHistory.length ? screenHistory.pop() : fallback;
    goingBack = true;
    try {
      window.show(target);
    } finally {
      goingBack = false;
    }
    return true;
  }

  function installSwipeBack() {
    wrapScreenHistory();
    if (document.documentElement.dataset.msv3Swipe) return;
    document.documentElement.dataset.msv3Swipe = '1';

    let start = null;
    let tracking = false;

    document.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX > 42) return;
      start = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      tracking = true;
    }, { passive: true });

    document.addEventListener('touchmove', event => {
      if (!tracking || !start || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = Math.abs(touch.clientY - start.y);
      if (dx > 35 && dx > dy * 1.25) document.body.classList.add('msv2SwipingBack');
    }, { passive: true });

    document.addEventListener('touchend', event => {
      if (!tracking || !start) {
        tracking = false;
        return;
      }
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = Math.abs(touch.clientY - start.y);
      const elapsed = Date.now() - start.time;
      document.body.classList.remove('msv2SwipingBack');
      tracking = false;
      if (dx >= 82 && dx > dy * 1.35 && elapsed < 900) smartBack();
      start = null;
    }, { passive: true });

    document.addEventListener('touchcancel', () => {
      tracking = false;
      start = null;
      document.body.classList.remove('msv2SwipingBack');
    }, { passive: true });
  }

  function correctedIntegrity() {
    const rows = db?.master?.rows || [];
    const seen = new Map();
    let missingArticle = 0;
    let noPosition = 0;
    let noShelf = 0;
    let noPallet = 0;
    let invalidState = 0;
    let invalidQty = 0;

    for (const row of rows) {
      const article = norm(row.article_base);
      const location = locationOfRow(row);
      const pallet = norm(row.bancale);
      const state = norm(row.state);
      if (!article) missingArticle++;
      if (!location) noShelf++;
      if (!pallet) noPallet++;
      if (!location && !pallet) noPosition++;
      if (!VALID_STATES.includes(state)) invalidState++;
      if (!Number.isFinite(Number(row.quantity)) || Number(row.quantity) < 0) invalidQty++;
      const key = [article, norm(row.size), state, location, pallet].join('|');
      seen.set(key, (seen.get(key) || 0) + 1);
    }

    let duplicates = 0;
    for (const count of seen.values()) if (count > 1) duplicates += count - 1;
    const blocking = missingArticle + noPosition + invalidState + invalidQty;
    return { rows: rows.length, missingArticle, noPosition, noShelf, noPallet, invalidState, invalidQty, duplicates, blocking, ok: blocking === 0 };
  }

  function showCorrectIntegrity() {
    const report = correctedIntegrity();
    let dialog = byId('msv3IntegrityDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'msv3IntegrityDialog';
      dialog.innerHTML = `
        <div class="dialogHead"><h2 id="msv3IntegrityTitle"></h2><button type="button" id="msv3IntegrityClose">×</button></div>
        <div id="msv3IntegrityBody"></div>
        <button type="button" class="btn primary" id="msv3IntegrityOk">CHIUDI</button>`;
      document.body.appendChild(dialog);
      byId('msv3IntegrityClose').onclick = () => dialog.close();
      byId('msv3IntegrityOk').onclick = () => dialog.close();
    }

    byId('msv3IntegrityTitle').textContent = report.ok ? 'Master verificato' : 'Controllo Master';
    byId('msv3IntegrityBody').innerHTML = `
      <p><b>${report.rows.toLocaleString('it-IT')}</b> giacenze importate.</p>
      <table class="uxTable"><tbody>
        <tr><td>Articoli mancanti</td><td><b>${report.missingArticle}</b></td></tr>
        <tr><td>Senza alcuna posizione</td><td><b>${report.noPosition}</b></td></tr>
        <tr><td>Stato non valido</td><td><b>${report.invalidState}</b></td></tr>
        <tr><td>Quantità non valida</td><td><b>${report.invalidQty}</b></td></tr>
        <tr><td>Duplicati identici</td><td><b>${report.duplicates}</b></td></tr>
        <tr><td>Senza Fila/Scaffale <small>(consentito se c'è Bancale)</small></td><td><b>${report.noShelf}</b></td></tr>
        <tr><td>Senza Bancale/Carrello <small>(consentito se c'è Fila)</small></td><td><b>${report.noPallet}</b></td></tr>
      </tbody></table>
      <p>${report.ok ? '✓ Il master è utilizzabile: per ogni giacenza basta almeno Fila/Scaffale oppure Bancale/Carrello.' : 'Controlla le anomalie bloccanti indicate sopra.'}</p>`;
    dialog.showModal();
  }

  function applyIntegrityFix() {
    const report = correctedIntegrity();
    for (const metric of document.querySelectorAll('.uxMetric')) {
      const label = metric.querySelector('span')?.textContent;
      if (label !== 'INTEGRITÀ MASTER') continue;
      const value = metric.querySelector('b');
      const wanted = report.ok ? 'OK' : String(report.blocking);
      if (value && value.textContent !== wanted) value.textContent = wanted;
      metric.classList.toggle('good', report.ok);
      metric.classList.toggle('error', !report.ok);
    }

    const button = byId('uxIntegrityBtn');
    if (button && !button.dataset.msv3Integrity) {
      button.dataset.msv3Integrity = '1';
      button.onclick = showCorrectIntegrity;
    }
  }

  function installIntegrityFix() {
    applyIntegrityFix();
    if (integrityObserver) return;
    const host = byId('localMasterPanel') || document.body;
    integrityObserver = new MutationObserver(() => applyIntegrityFix());
    integrityObserver.observe(host, { childList: true, subtree: true, characterData: true });
  }

  function install() {
    ensurePositionUi();
    ensureStockEditorUi();
    installSearch();
    installSwipeBack();
    installIntegrityFix();
    window.renderStock?.();
  }

  install();
  setTimeout(install, 160);

  window.WarehouseMobileSearchV3 = {
    version: VERSION,
    install,
    parseSearch,
    rowMatchesSearch,
    hasPosition,
    smartBack,
    correctedIntegrity
  };
})();
