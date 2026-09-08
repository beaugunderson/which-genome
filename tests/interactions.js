// Run with installed playwright-cli run-code --filename=tests/interactions.js.
// No dependencies, external browsing, or provider requests.
async page => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const origin = page.url().split('/').slice(0, 3).join('/');
  check(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin), 'Use an isolated local server');
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const output = '/tmp/which-genome-design-browser';
  const widths = [1440, 1024, 768, 390];
  const measurements = [];
  const screenshots = [];
  const row = id => page.locator(`[id="${id}"]`);
  const panel = id => row(id + '-details');
  const button = id => row(id).locator('.disclosure');
  const open = async id => (await button(id).getAttribute('aria-expanded')) === 'true';

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin);
  check(await page.locator('.product-row').count() === 26, '26 products');
  check(await page.locator('.detail-row:visible').count() === 0, 'Initially collapsed');
  await row('24genetics-wes').locator('td').nth(1).click();
  check(await open('24genetics-wes'), 'Background click expands');
  await button('24genetics-wes').focus();
  await page.keyboard.press('Space');
  check(!await open('24genetics-wes'), 'Native Space collapses once');
  await page.keyboard.press('Enter');
  check(await open('24genetics-wes'), 'Native Enter expands once');
  check(await button('24genetics-wes').evaluate(el => el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none'), 'Visible keyboard focus');
  await button('24genetics-wgs').click();
  check(await open('24genetics-wes') && await open('24genetics-wgs'), 'Multiple rows open');
  // Prevent navigation only in the test; the real provider link must not collapse its panel.
  const source = panel('24genetics-wes').getByRole('link', { name: 'Visit provider', exact: true });
  await source.evaluate(el => el.addEventListener('click', event => event.preventDefault(), { once: true }));
  await source.click();
  check(await open('24genetics-wes'), 'Expanded source link does not collapse');
  await panel('24genetics-wes').getByText('More sources', { exact: true }).click();
  check(await open('24genetics-wes'), 'Nested details control does not collapse row');
  // Exercise the summary event guard with interactive descendants, not provider traffic.
  await row('24genetics-wes').evaluate(el => {
    const a = document.createElement('a');
    a.href = '#24genetics-wes'; a.textContent = 'Test link'; a.id = 'interaction-link';
    a.addEventListener('click', event => event.preventDefault());
    el.cells[0].append(a);
  });
  await page.locator('#interaction-link').click();
  check(await open('24genetics-wes'), 'Summary anchor is not hijacked');
  await page.locator('#interaction-link').evaluate(el => el.remove());
  await row('24genetics-wes').evaluate(el => {
    const range = document.createRange();
    range.selectNodeContents(el.querySelector('.provider'));
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    el.cells[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  check(await open('24genetics-wes'), 'Selected text is not hijacked');
  await page.evaluate(() => window.getSelection().removeAllRanges());
  // Actual pointer drag selects text and emits click without opening a closed row.
  const provider = row('adntro').locator('.provider');
  await provider.scrollIntoViewIfNeeded();
  const box = await provider.boundingBox();
  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  check(await page.evaluate(() => !window.getSelection().isCollapsed), 'Pointer drag selected text');
  check(!await open('adntro'), 'Pointer selection does not open row');
  await page.evaluate(() => window.getSelection().removeAllRanges());

  const original = await page.locator('.product-row').evaluateAll(rows => rows.map((r, index) => ({
    id: r.id, index, cells: Array.from(r.cells, c => ({ key: c.dataset.sort, currency: c.dataset.currency || '' }))
  })));
  for (let column = 0; column < 5; column++) {
    const header = page.locator('thead th').nth(column);
    const type = await header.getAttribute('data-type');
    for (const direction of ['ascending', 'descending']) {
      await header.locator('button').focus();
      await page.keyboard.press(direction === 'ascending' ? 'Enter' : 'Space');
      check(await header.getAttribute('aria-sort') === direction, 'Native sort key / ARIA');
      const expected = [...original].sort((a, b) => {
        const left = a.cells[column], right = b.cells[column];
        const lu = left.key === '' || (type === 'price' && !left.currency);
        const ru = right.key === '' || (type === 'price' && !right.currency);
        if (lu !== ru) return lu ? 1 : -1;
        if (lu) return a.index - b.index;
        if (type === 'price' && left.currency !== right.currency) return left.currency.localeCompare(right.currency, 'en');
        const cmp = type === 'text' ? left.key.localeCompare(right.key, 'en', { sensitivity: 'base' }) : Number(left.key) - Number(right.key);
        return (direction === 'ascending' ? cmp : -cmp) || a.index - b.index;
      }).map(r => r.id);
      const actual = await page.locator('.product-row').evaluateAll(rows => rows.map(r => r.id));
      check(JSON.stringify(actual) === JSON.stringify(expected), `Column ${column} ${direction}`);
      check(await page.locator('.product-row').evaluateAll(rows => rows.every(r => r.nextElementSibling.id === r.id + '-details')), 'Atomic summary/detail ordering');
      check(await open('24genetics-wes') && await open('24genetics-wgs'), 'Sort preserves open panels');
      check(!await panel('24genetics-wes').isHidden(), 'Sort preserves actual visible panel');
    }
  }
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(origin);
    const measure = async state => page.evaluate(({ width, state }) => {
      const wrapper = document.querySelector('.table-wrapper');
      const table = document.querySelector('table');
      const content = document.querySelector('.detail-row:not([hidden]) .detail-content');
      return { width, state, bodyWidth: document.documentElement.scrollWidth, viewport: innerWidth,
        tableWidth: table.getBoundingClientRect().width, regionWidth: wrapper.clientWidth,
        tableTop: table.getBoundingClientRect().top,
        expandedWidth: content ? content.getBoundingClientRect().width : null };
    }, { width, state });
    let m = await measure('closed');
    check(m.bodyWidth <= width, `No body overflow at ${width}`);
    if (width >= 1024) check(m.tableWidth <= m.regionWidth + 1, 'No desktop horizontal scroll');
    check(m.tableTop < 240, 'Table starts early');
    measurements.push(m);
    let filename = `${output}/closed-${width}.png`;
    await page.screenshot({ path: filename }); screenshots.push(filename);
    await button('24genetics-wes').focus();
    await page.keyboard.press('Enter');
    m = await measure('expanded');
    check(m.bodyWidth <= width, `No expanded body overflow at ${width}`);
    check(m.expandedWidth <= width, 'Expanded prose fits viewport');
    measurements.push(m);
    filename = `${output}/expanded-${width}.png`;
    await page.screenshot({ path: filename }); screenshots.push(filename);
  }
  // Opening from the right-hand columns must not leave mobile details offscreen.
  await page.goto(origin);
  await page.locator('.table-wrapper').evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await row('24genetics-wes').locator('td').last().click();
  const bounds = await panel('24genetics-wes').locator('.detail-content').boundingBox();
  check(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'Mobile details remain readable after horizontal scrolling');
  const scrolled = `${output}/expanded-scrolled-390.png`;
  await page.screenshot({ path: scrolled }); screenshots.push(scrolled);
  const contrast = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const luminance = hex => {
      const rgb = hex.trim().slice(1).match(/../g).map(c => parseInt(c, 16) / 255)
        .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const background = luminance(root.getPropertyValue('--paper'));
    return {
      ink: ratio(luminance(root.getPropertyValue('--ink')), background),
      muted: ratio(luminance(root.getPropertyValue('--muted')), background),
      focus: ratio(luminance('#61502c'), background),
      hoveredMuted: ratio(luminance(root.getPropertyValue('--muted')), luminance('#f0efe9'))
    };
  });
  check(contrast.ink >= 4.5 && contrast.muted >= 4.5 && contrast.hoveredMuted >= 4.5 && contrast.focus >= 3, 'Text and focus contrast');
  const context = await page.context().browser().newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const nojs = await context.newPage();
  try {
    await nojs.goto(origin);
    check(await nojs.locator('.product-row').count() === 26, 'No-JS summary inventory');
    const details = nojs.locator('[id="24genetics-wes-details"] .product-details');
    await details.locator(':scope > summary').focus();
    await nojs.keyboard.press('Enter');
    check(await details.evaluate(el => el.open), 'No-JS native keyboard detail access');
    check(await details.getByRole('link', { name: 'Visit provider', exact: true }).isVisible(), 'No-JS provider access');
    check(await nojs.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No-JS no body overflow');
    const filename = `${output}/nojs-390.png`;
    await nojs.screenshot({ path: filename }); screenshots.push(filename);
  } finally { await context.close(); }
  page.off('pageerror', onError);
  check(errors.length === 0, `Runtime errors: ${errors.join('; ')}`);
  return { passed: true, sortDirections: 10, interactions: ['background', 'Enter/Space', 'visible focus', 'multiple panels', 'panel link', 'summary link guard', 'nested control', 'selected text', 'pointer drag', 'atomic sort', 'no-JS'], measurements, contrast, screenshots, runtimeErrors: errors };
}
