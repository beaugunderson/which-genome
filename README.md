## which-genome

Powers [whichgenome.com](https://whichgenome.com/): a static comparison of **human WGS/WES an individual can buy with a credit card**. No framework, build step or runtime data fetch. Open `index.html` or serve this directory; `sort.js` progressively enhances one consumer table. All styling uses local CSS and system fonts; there are no external runtime dependencies.

### Inclusion rule — consumer purchases only

Include a current, fixed-price individual sequencing offer with primary product evidence and an explicit retail order route. **Provider-arranged doctor consultation or prescription is allowed**: clearly state the step, included/additional fee, ordering sequence and restrictions. Ordinary account registration, consent and shipping forms are not institutional barriers.

Exclude **outside-referral-only, B2B/institutional, study enrollment, quote-only, prelaunch/waitlist and unestablished retail services**. Do not add a public pending, legacy, defunct or clinical directory. Keep exclusion/history evidence in the audit, not the comparison. Medical use does not itself disqualify a retail test. Record successor context briefly on the current brand rather than maintaining old-brand rows.

A rendered final card form is strong evidence but **not mandatory**: current primary product, fixed price, self-service purchase implementation and terms can establish retail access. Automation/security failures are not closure or contrary availability evidence. Do not bias the comparison toward anti-bot-friendly shops. Stop verification before purchasing, registering accounts, submitting personal information or contacting providers.

Specific decisions established in this review:
- **Veritas myGenome:** include provider-arranged prescribing consultation (included pre/post counseling). Advertised purchase → consultation → kit sequence; standard cart's unexplained Prescribing Doctor field remains visible caveat, not a license to invent a value.
- **Human Longevity:** retail WGS with existing/established-at-start PCP and PCP-contact requirement; no outside prescription in reviewed terms. Do not describe this as merely an included quick chat.
- **CircleDNA Premium:** WES according to explicit official technical documentation, with current capture/depth unpublished. Newer NGS wording and different data-point counts do not establish an assay change. Distinguish older WES documentation from current product wording.
- **Sequencing.com / SelfDecode:** retain explicit primary retail offers despite blocked automated checkouts; record verification limits in audit, not pending rows.

### Evidence and maintenance

Current audit: [2026-09-08](research/2026-09-08.md). The [2026-09-07 broad directory audit](research/2026-09-07.md) is **superseded historical research**, not current inclusion guidance. Current inventory: **26 rows / 20 providers**; identical-assay report bundles are compacted with prices/speed differences preserved. Sellers are not independent laboratories.

Edit **static `index.html` directly**. Keep stable row IDs and matching audit anchors; add dated primary product/purchase/terms passages and exact stable URLs. Distinguish observed checkout price from promotion/schema, lab from HQ, depth from breadth, BAM from CRAM, counseling from coaching, and CAP/CLIA from ISO. Unlisted file formats remain unverified, not unavailable. Unknown means genuinely unpublished/unestablished, not no; do easy primary extraction before leaving unknowns. Never infer specification changes from generic metadata dates or marketing point counts. A purchase route does not establish fulfillment, sequence quality or accreditation.

### Presentation rule

The five-column summary supports initial choice: **Test, Depth, Price, Results, Raw files**. Row expansion gives buying requirements, costs/options, technical details and sources. Research rationale stays in the dated audit, out of the main comparison. Keep summary notes short, required renewals visible and obligatory first-year fees in the total. Write depth as `30×` or `70×, exome only`, never a redundant WGS/WES prefix; unknown depth is `—` (with `exome only` when established). Do not infer a missing depth.

Click a non-interactive summary-row area or use its native disclosure button (Enter/Space). Selection and links do not toggle panels; multiple rows may stay open. Sorting moves summary/detail pairs together and preserves expansion. Without JavaScript, adjacent native details provide the same information. Small screens scroll only the comparison region; expanded prose fits the viewport.

All summary cells use explicit `data-sort`; empty keys mean unknown. Numeric columns: depth, price, results timing. Use lower comparable range values; calendar-day turnaround converts weeks ×7/months ×30, not working days. Conflicting/ambiguous or mixed metrics and maximum-only report deadlines have no numeric key. Price sorting uses **fixed alphabetic native-currency groups** in either direction, no FX conversion. Only established currency/amount pairs get price keys. Dante sorts by its USD base option with other currencies visible; Genome Computer includes the first USD 99 annual fee in USD 598, Mito uses its shipping-inclusive nonmember total, and MyHeritage includes the observed USD 5 US shipping; SelfDecode's unconfirmed product-dollar currency stays unkeyed. Unknowns stay last, equal keys preserve source order. Keyboard Enter/Space activates native header buttons. Table/details remain readable without JavaScript.

Expanded rows link primary sources and GitHub's dated audit; the local Markdown is immediately available, while new GitHub content requires separately authorized publication. No commit, push or deployment is authorized by this refresh.

### Optional change monitors

`urls.yaml` contains **48 canonical consumer product/policy URLs**, no institutional, quote/contact-only or session-token purchase monitors. [urlwatch](https://urlwatch.readthedocs.io/) is optional and separately installed with CSS/html2text filter dependencies:

```sh
urlwatch --urls urls.yaml --list
urlwatch --urls urls.yaml --test-filter 1
urlwatch --urls urls.yaml
```

First run establishes a baseline, not a factual audit. Run serially at respectful intervals; do not commit caches/credentials. Review changed passages before advancing dates or facts. **Script-stripping filters miss JS prices, API data and hidden content**; manually inspect Dante, Nucleus, GenePlanet, Macromo and other dynamic offers. Do not monitor hashed JS URLs as durable targets. HTTP403/404/429, empty extracts and redirects are investigation leads, not closure or unchanged-price evidence. No live urlwatch run is claimed; it is not installed here.

### Local checks

Python3 and Node.js only; no package installation:

```sh
python3 tests/check_structure.py
python3 tests/check_gap_fill.py
node tests/sort.test.js
node --check sort.js
node --check tests/sort.test.js
node --check tests/interactions.js
python3 -m py_compile tests/check_structure.py tests/check_gap_fill.py
git diff --check
git diff --cached --name-only  # must remain empty
```

Python checks actual HTML, one-table scope, counts, source/audit/monitor links and factual regression guards. Node exercises the actual comparator/events for all five columns in both directions and checks atomic summary/detail pairs. These are not live claim-verification tests. Browser regression (installed `playwright-cli`, no project packages): serve with `python3 -m http.server 8765 --bind 127.0.0.1`, open an isolated named session with `playwright-cli -s=genome-check open http://127.0.0.1:8765`, then run `playwright-cli -s=genome-check run-code --filename=tests/interactions.js`. The test uses the page's current local origin, writes screenshots to `/tmp/which-genome-design-browser/` and returns JSON results through the CLI. It covers pointer/keyboard disclosure, selection/link guards, multiple panels, all sort directions, no-JS details and 1440/1024/768/390px overflow. Close only that named session afterward. Keep browser artifacts outside the repository.
