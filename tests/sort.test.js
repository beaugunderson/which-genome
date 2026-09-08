'use strict';
// Real static-table data + a minimal DOM fixture; no browser or npm dependency.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { cellValue, compareCells, initTable } = require('../sort.js');
const data = JSON.parse(execFileSync('python3', [path.join(__dirname, 'check_structure.py'), '--json'], { encoding: 'utf8' }));
const cell = (key, currency = '') => ({ dataset: { sort: key, currency } });

for (const direction of ['ascending', 'descending']) {
  for (const type of ['number', 'price']) {
    for (const key of ['', 'Unknown', 'Quote', '30x', 'Infinity', 'NaN']) {
      assert.equal(cellValue(cell(key, 'USD'), type).unknown, true, key);
      assert(compareCells(cell(key, 'USD'), cell('10', 'USD'), type, direction) > 0);
    }
  }
  assert(compareCells(cell('999', 'EUR'), cell('1', 'USD'), 'price', direction) < 0,
    'Fixed currency groups must not compare EUR 999 numerically to USD 1');
  assert(compareCells(cell('9', ''), cell('999', 'USD'), 'price', direction) > 0,
    'Unverified currency stays last');
  assert(compareCells(cell('9', 'UNVERIFIED'), cell('999', 'USD'), 'price', direction) > 0);
  assert.equal(compareCells(cell(''), cell(''), 'number', direction), 0);
  assert(compareCells(cell(''), cell('Available'), 'text', direction) > 0);
}
assert(compareCells(cell('9', 'USD'), cell('10', 'USD'), 'price', 'ascending') < 0);
assert(compareCells(cell('9', 'USD'), cell('10', 'USD'), 'price', 'descending') > 0);
assert(compareCells(cell('2'), cell('10'), 'number', 'ascending') < 0, 'Numeric, not lexicographic');
assert.equal(cellValue(cell('0'), 'number').unknown, false, 'Zero is not unknown');

class Header {
  constructor(source) {
    this.dataset = { type: source.attrs['data-type'] };
    this.attrs = { 'aria-sort': 'none' };
    this.hint = { textContent: '▲▼' };
    this.button = {
      textContent: source.text,
      addEventListener: (event, callback) => {
        assert.equal(event, 'click');
        this.click = callback;
      },
    };
  }
  getAttribute(name) { return this.attrs[name]; }
  setAttribute(name, value) { this.attrs[name] = value; }
  querySelector(selector) {
    if (selector === 'button') return this.button;
    if (selector === '.sort-hint') return this.hint;
    throw new Error('Unexpected header selector: ' + selector);
  }
}
class Body {
  constructor(rows) {
    this.original = rows.map(row => ({
      id: row.id,
      product: true,
      cells: row.cells.map(c => cell(c.attrs['data-sort'], c.attrs['data-currency'])),
      nextElementSibling: { id: row.id + '-details', hidden: false },
    }));
    this.rows = this.original.flatMap(row => [row, row.nextElementSibling]);
  }
  querySelectorAll(selector) {
    assert.equal(selector, 'tr.product-row');
    return this.rows.filter(row => row.product);
  }
  appendChild(row) {
    this.rows.splice(this.rows.indexOf(row), 1);
    this.rows.push(row);
  }
}
const headers = data.headers.map(h => new Header(h));
const bodies = ['consumer'].map(section =>
  new Body(data.rows.filter(row => row.section === section)));
const table = {
  querySelectorAll(selector) {
    if (selector === 'thead th') return headers;
    if (selector === 'tbody[data-sortable="true"]') return bodies;
    throw new Error('Unexpected table selector: ' + selector);
  },
};
const status = { textContent: '' };
initTable(table, status);

// Independent expected ordering: unknowns last, fixed currency, numeric/text key,
// original source order for ties, including after a different column was sorted.
function expected(body, column, type, direction) {
  const records = body.original.map((row, index) => {
    const key = row.cells[column].dataset.sort.trim();
    const currency = row.cells[column].dataset.currency;
    const unknown = key === '' || (type === 'price' && !currency);
    return { row, index, key, currency, unknown };
  });
  records.sort((a, b) => {
    if (a.unknown !== b.unknown) return a.unknown ? 1 : -1;
    if (a.unknown) return a.index - b.index;
    if (type === 'price' && a.currency !== b.currency) return a.currency < b.currency ? -1 : 1;
    const cmp = type === 'text'
      ? a.key.localeCompare(b.key, 'en', { sensitivity: 'base' })
      : Number(a.key) - Number(b.key);
    return (direction === 'ascending' ? cmp : -cmp) || a.index - b.index;
  });
  return records.map(r => r.row.id);
}
function verifyClick(column, direction) {
  headers[column].click();
  assert.equal(headers[column].getAttribute('aria-sort'), direction);
  assert.equal(headers.filter(h => h.getAttribute('aria-sort') !== 'none').length, 1);
  assert.equal(headers[column].hint.textContent, direction === 'ascending' ? '▲' : '▼');
  assert(status.textContent.includes(direction));
  assert(status.textContent.includes('Unknown sort values last'));
  assert(!status.textContent.includes('pending'));
  for (const body of bodies) {
    assert.deepEqual(body.rows.filter(r => r.product).map(r => r.id),
      expected(body, column, headers[column].dataset.type, direction));
    for (let i = 0; i < body.rows.length; i += 2) {
      const row = body.rows[i];
      const panel = body.rows[i + 1];
      assert.equal(panel, row.nextElementSibling, 'Move each detail panel with its summary');
      assert.equal(panel.id, row.id + '-details');
      assert.equal(panel.hidden, false, 'Expanded panel state survives sorting');
    }

  }
}
for (let column = 0; column < headers.length; column++) {
  verifyClick(column, 'ascending');
  verifyClick(column, 'descending');
}
// Revisit numeric columns after text sorting: original ties and unknowns stay stable.
for (const column of [2, 1, 3, 4, 0, 2]) verifyClick(column, 'ascending');
console.log('PASS: real 26-pair fixture; all 5 columns both directions; unknowns, native currency groups, stable ties, atomic expanded pairs and sort events/ARIA');
