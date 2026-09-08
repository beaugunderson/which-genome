/* Explicit cell keys keep unknown prose out of numeric comparisons. */
(function () {
  'use strict';

  function cellValue(cell, type) {
    var key = (cell.dataset.sort || '').trim();
    var currency = cell.dataset.currency || '';
    var numeric = type === 'number' || type === 'price';
    var value = numeric ? Number(key) : key;
    var unknown = key === '' || (numeric && !Number.isFinite(value));
    if (type === 'price' && !/^[A-Z]{3}$/.test(currency)) unknown = true;
    return { value: value, currency: currency, unknown: unknown };
  }

  function compareCells(a, b, type, direction) {
    var left = cellValue(a, type);
    var right = cellValue(b, type);
    // Unknowns and currency groups never reverse with the amount direction.
    if (left.unknown || right.unknown) {
      if (left.unknown && right.unknown) return 0;
      return left.unknown ? 1 : -1;
    }
    if (type === 'price' && left.currency !== right.currency) {
      return left.currency.localeCompare(right.currency, 'en');
    }
    var comparison = type === 'text'
      ? left.value.localeCompare(right.value, 'en', { sensitivity: 'base' })
      : left.value - right.value;
    return direction === 'ascending' ? comparison : -comparison;
  }

  function productRows(body) {
    return Array.from(body.querySelectorAll('tr.product-row'));
  }

  function initDisclosures(table) {
    table.querySelectorAll('tr.product-row').forEach(function (row) {
      var button = row.querySelector('.disclosure');
      var panel = row.nextElementSibling;
      var details = panel.querySelector('.product-details');
      details.open = true;
      panel.hidden = true;
      button.hidden = false;
      function toggle() {
        panel.hidden = !panel.hidden;
        button.setAttribute('aria-expanded', String(!panel.hidden));
      }
      // Native button activation supplies Enter/Space without a second key handler.
      button.addEventListener('click', toggle);
      row.addEventListener('click', function (event) {
        if (event.target.closest('a, button, input, select, textarea, label, summary, [role="button"], [contenteditable]')) return;
        var selection = row.ownerDocument.defaultView.getSelection();
        if (selection && !selection.isCollapsed) return;
        toggle();
      });
    });
    table.classList.add('enhanced');
  }

  function initTable(table, status) {
    var headers = Array.from(table.querySelectorAll('thead th'));
    var bodies = Array.from(table.querySelectorAll('tbody[data-sortable="true"]'));
    var originalOrder = new Map();
    var panels = new Map();
    bodies.forEach(function (body) {
      productRows(body).forEach(function (row, index) {
        originalOrder.set(row, index);
        panels.set(row, row.nextElementSibling);
      });
    });

    headers.forEach(function (header, column) {
      var button = header.querySelector('button');
      button.addEventListener('click', function () {
        var direction = header.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
        headers.forEach(function (other) {
          other.setAttribute('aria-sort', 'none');
          other.querySelector('.sort-hint').textContent = '';
        });
        header.setAttribute('aria-sort', direction);
        header.querySelector('.sort-hint').textContent = direction === 'ascending' ? '▲' : '▼';
        bodies.forEach(function (body) {
          var rows = productRows(body);
          rows.sort(function (a, b) {
            return compareCells(a.cells[column], b.cells[column], header.dataset.type, direction)
              || originalOrder.get(a) - originalOrder.get(b);
          });
          rows.forEach(function (row) {
            body.appendChild(row);
            body.appendChild(panels.get(row));
          });
        });
        if (status) {
          var label = button.textContent.replace(/[▲▼]/g, '').trim();
          status.textContent = label + ': ' + direction + '. '
            + (header.dataset.type === 'price' ? 'Currency groups remain alphabetical. ' : '')
            + 'Unknown sort values last.';
        }
      });
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { cellValue: cellValue, compareCells: compareCells, initTable: initTable, initDisclosures: initDisclosures };
  }
  if (typeof document !== 'undefined') {
    var table = document.getElementById('services-table');
    if (table) {
      initTable(table, document.getElementById('sort-status'));
      initDisclosures(table);
    }
  }
}());
