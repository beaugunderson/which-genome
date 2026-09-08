#!/usr/bin/env python3
"""Dependency-free checks of the actual static comparison and public audit."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


class ComparisonParser(HTMLParser):
    """Parse summary rows and their named, adjacent detail fields independently."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows, self.headers, self.links, self.ids, self.scripts = [], [], [], [], []
        self.section = None
        self.in_header = False
        self.row = self.cell = self.header = self.field = None
        self.in_detail = False
        self.detail_ids = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'a':
            self.links.append(attrs.get('href', ''))
            if self.row is not None:
                self.row['links'].append(attrs.get('href', ''))
        if tag == 'script':
            self.scripts.append(attrs.get('src', 'inline'))
        if tag == 'thead':
            self.in_header = True
        if tag == 'tbody':
            self.section = attrs.get('data-section')
        if tag == 'tr' and self.section:
            if attrs.get('class') == 'product-row':
                assert self.row is None
                self.row = {'id': attrs['id'], 'section': self.section, 'provider': attrs['data-provider'],
                            'cells': [], 'fields': {}, 'links': [], 'buttons': []}
            else:
                assert attrs.get('class') == 'detail-row'
                assert self.row and attrs['id'] == self.row['id'] + '-details'
                assert 'hidden' not in attrs, 'No-JS details must be accessible'
                self.detail_ids.append(attrs['id'])
                self.in_detail = True
        if tag == 'td' and self.row is not None:
            if self.in_detail:
                assert attrs.get('colspan') == '5'
            else:
                assert self.cell is None
                self.cell = {'attrs': attrs, 'text': ''}
        if tag == 'dd':
            assert self.in_detail
            self.field = attrs['data-field']
            self.row['fields'][self.field] = ''
        if tag == 'button' and self.row is not None:
            self.row['buttons'].append(attrs)
        if tag == 'th' and self.in_header:
            self.header = {'attrs': attrs, 'text': '', 'buttons': 0}
        if tag == 'button' and self.header is not None:
            self.header['buttons'] += 1

    def handle_data(self, data):
        if self.cell is not None:
            self.cell['text'] += data
        if self.header is not None:
            self.header['text'] += data
        if self.field is not None:
            self.row['fields'][self.field] += data

    def handle_endtag(self, tag):
        if tag == 'td' and self.cell is not None:
            self.row['cells'].append(self.cell)
            self.cell = None
        if tag == 'dd':
            self.field = None
        if tag == 'tr' and self.in_detail:
            self.rows.append(self.row)
            self.row = None
            self.in_detail = False
        if tag == 'th' and self.header is not None:
            self.headers.append(self.header)
            self.header = None
        if tag == 'thead':
            self.in_header = False
        if tag == 'tbody':
            self.section = None


def check():
    html = (ROOT / 'index.html').read_text()
    audit = (ROOT / 'research/2026-09-08.md').read_text()
    monitor = (ROOT / 'urls.yaml').read_text()
    parser = ComparisonParser()
    parser.feed(html)
    parser.close()
    assert parser.cell is None and parser.row is None
    assert len(parser.ids) == len(set(parser.ids)), 'Duplicate HTML IDs'
    assert len(parser.headers) == 5
    assert len(parser.detail_ids) == 26
    assert [h['text'] for h in parser.headers] == ['Test', 'Depth', 'Price', 'Results', 'Raw files']
    assert all(h['buttons'] == 1 and h['attrs']['aria-sort'] == 'none'
               and h['attrs']['scope'] == 'col' for h in parser.headers)
    assert parser.scripts == ['sort.js'], 'Keep progressive enhancement dependency-free'
    assert Counter(r['section'] for r in parser.rows) == {'consumer': 26}
    assert len({r['id'] for r in parser.rows}) == 26
    assert len({r['provider'] for r in parser.rows}) == 20
    assert html.count('<table ') == 1 and html.count('<tbody ') == 1
    assert 'bootstrap' not in html and 'fonts.googleapis' not in html
    assert html.count('class="product-details"') == 26
    assert '<details open' not in html, 'Keep methodology and extra sources collapsed'
    numeric_columns = [i for i, h in enumerate(parser.headers) if h['attrs']['data-type'] != 'text']
    assert numeric_columns == [1, 2, 3]
    for row in parser.rows:
        assert len(row['cells']) == 5, row['id']
        assert f'<a id="{row["id"]}"></a>' in audit, f'Missing audit anchor: {row["id"]}'
        assert any('/research/2026-09-08.md#' + row['id'] in link for link in row['links'])
        assert len(row['buttons']) == 1
        button = row['buttons'][0]
        assert button['aria-controls'] == row['id'] + '-details'
        assert button['aria-expanded'] == 'false' and 'hidden' in button
        assert button['type'] == 'button'
        assert {'buying', 'costs', 'results', 'files', 'assay'} <= row['fields'].keys()
        for i, cell in enumerate(row['cells']):
            assert cell['text'].strip(), (row['id'], i, 'Empty cell instead of explicit unknown')
            assert 'data-sort' in cell['attrs'], (row['id'], i, 'No explicit key')
            key = cell['attrs']['data-sort']
            if i in numeric_columns and key:
                assert re.fullmatch(r'\d+(?:\.\d+)?', key), (row['id'], i, key)
                assert float(key) > 0
            if i == 2 and key:
                assert cell['attrs']['data-currency'] in ('CZK', 'EUR', 'INR', 'USD')
                assert cell['attrs']['data-currency'] in cell['text']
            if cell['text'] == '—':
                assert key == ''
        if 'business days' in row['cells'][3]['text'] or 'working days' in row['cells'][3]['text']:
            assert row['cells'][3]['attrs']['data-sort'] == '', row['id']
        primary = [url for url in row['links'] if not url.startswith('https://github.com/')]
        assert primary and all(url.startswith('https://') for url in primary)
        assert all(url in audit for url in primary), (row['id'], 'Source missing from public audit')

    for link in parser.links:
        if link.startswith('#'):
            assert link[1:] in parser.ids, link
        if link.startswith('https://'):
            assert not parse_qs(urlsplit(link).query).get('osCsid'), link
    assert 'datetime="2026-09-08"' in html and 'research/2026-09-08.md' in html
    assert 'class="verification"' not in html
    for stale in ['Trustpilot', 'H600', 'Series A', 'Likely defunct', 'shut down February 2025', '~$', '150bp</td>', 'class="defunct"']:
        assert stale not in html, stale
    for term in ['breadth', 'not “no.”', 'Price groups', 'BAM and CRAM', 'CAP accreditation', 'wellness coach']:
        assert term.lower() in html.lower(), term

    rows_by_id = {r['id']: r for r in parser.rows}
    wes = rows_by_id['24genetics-wes']
    assert wes['cells'][4]['text'] == '—Download included'
    assert 'Raw data download included; format unspecified' in wes['fields']['buying']
    assert rows_by_id['nucleus-health']['fields']['sample'] == 'Cheek swabs'
    for row_id in ['circle-premium', 'geneplanet-premium', 'meridian']:
        assert rows_by_id[row_id]['cells'][1]['attrs']['data-sort'] == ''
    assert rows_by_id['selfdecode-kit']['cells'][2]['attrs']['data-sort'] == ''
    assert rows_by_id['human-longevity']['cells'][2]['attrs']['data-currency'] == 'USD'
    for row_id, total in [('genome-computer', '598'), ('mito-3', '265.31'),
                          ('mito-30', '643.29'), ('myheritage', '34')]:
        assert rows_by_id[row_id]['cells'][2]['attrs']['data-sort'] == total, 'Include known obligatory fees'
    for row in parser.rows:
        depth = row['cells'][1]['text']
        assert not any(term in depth for term in ['WGS', 'WES', 'Genome'])
        if row['id'] in ['24genetics-wes', 'circle-premium']:
            assert 'exome only' in depth
    by_id = {r['id']: ' '.join(c['text'] for c in r['cells']) + ' ' + ' '.join(r['fields'].values())
             for r in parser.rows}
    expected = {
        'gencove': ['USD 69', '0.5×', 'never both', 'imputed VCF'],
        'tellmegen': ['USD 329.99', '3 months', '29.99', 'CRAM: included', '4.99'],
        'dna-complete-essential': ['USD 245', 'USD 95/year', 'purchase anniversary'],
        'dna-complete-pro': ['USD 595', 'USD 195/year', 'CRAM: advertised'],
        'dna-complete-elite': ['USD 1,295', 'USD 495/year', 'not an included session'],
        '24genetics-wes': ['70×, exome only', 'USD 999', 'One telephone'],
        '24genetics-wgs': ['30×', 'USD 1,999', 'Two 15-minute'],
        'nucleus-health': ['USD 538', 'USD 1,026', 'USD 39/person/year', 'New York', 'no outside referral'],
        'dante-premium': ['USD 449', 'EUR 399', 'GBP 345', 'USD 599', 'USD 849', '45 checkout countries'],
        'geneplanet-premium': ['EUR 449', '5 weeks', 'Saliva tube', 'depth unpublished'],
        'myheritage': ['2×', 'CRAM: announced, not yet available', 'USD 29', 'USD 5', 'Cheek swab'],
        'macromo': ['CZK 29,000', 'Czech-market', '1 year'],
        'mito-3': ['Texas excluded', 'USD 265.31', 'preselected', 'may require request'],
        'mito-30': ['Texas excluded', 'USD 643.29', 'preselected'],
        'genome-computer': ['USD 499', 'USD 99/year', 'genome delivery'],
        'odin': ['USD 599', 'choose Human', 'BAM: included'],
        'meridian': ['INR 64,999', '~30× product vs ~25× terms', '30-minute doctor',
                     'Product and terms conflict on data retention/lifetime re-reading; confirm before ordering'],
        'veritas-mygenome-premium': ['EUR 1,950', 'provider-arranged', 'Prescribing Doctor', 'not explained'],
        'circle-premium': ['USD 349', 'Exome only, per older provider technical description', 'Current capture details/depth not published'],
        'human-longevity': ['USD 599', 'existing PCP', 'No outside prescription',
                           'Required primary care is not included; any external cost is unknown'],
        'sequencing-rare': ['USD 399', 'USD 599', 'USD 999', '21–30', 'USD 799', 'BAM: advertised', 'FASTQ included'],
        'selfdecode-kit': ['$399', '$1,499', '$1,999', 'currency code not independently confirmed'],
    }
    for row_id, terms in expected.items():
        assert all(term in by_id[row_id] for term in terms), (row_id, terms)
    for forbidden in ['clinical', 'research', 'pending']:
        assert f'data-section="{forbidden}"' not in html
    for row_id in ['banksia-30', 'banksia-60', 'mapmygenome', 'full-genomes', 'gph', 'nebula',
                   'nucleus-preview', 'sequencing-comprehensive', 'selfdecode-advanced', 'dante-all',
                   'veritas-mygenome-standard', 'geneplanet-wgs', 'sano']:
        assert row_id not in rows_by_id, row_id
    historical = (ROOT / 'research/2026-09-07.md').read_text()
    readme = (ROOT / 'README.md').read_text()
    assert 'SUPERSEDED' in historical
    for term in ['Provider-arranged', 'outside-referral-only', 'Sequencing.com', 'SelfDecode', 'CircleDNA', 'PCP']:
        assert term in readme and term.lower() in audit.lower(), term
    assert 'browser/http blocks alone' in audit.lower()

    # Deliberately validate this configuration's simple schema, not arbitrary YAML.
    urls, names = [], []
    for doc in re.split(r'^---\s*$', monitor, flags=re.M):
        fields = {}
        for key in ('kind', 'name', 'url'):
            matches = re.findall(r'^' + key + r': (.+)$', doc, flags=re.M)
            assert len(matches) == 1, (key, doc)
            fields[key] = matches[0] if key == 'kind' else json.loads(matches[0])
        assert fields['kind'] == 'url'
        assert fields['url'].startswith('https://')
        assert 'osCsid' not in fields['url'] and '/pages/research' not in fields['url']
        assert '/checkout' not in fields['url'] and '/order' not in urlsplit(fields['url']).path
        assert 'selector: html' in doc and 'method: pyhtml2text' in doc
        urls.append(fields['url'])
        names.append(fields['name'])
    assert len(urls) == len(set(urls)) == 48
    assert len(names) == len(set(names))
    for row in parser.rows:
        assert any(urlsplit(link).netloc == urlsplit(url).netloc for link in row['links'] for url in urls), row['id']
    return parser


if __name__ == '__main__':
    parsed = check()
    if '--json' in sys.argv:
        print(json.dumps({'headers': parsed.headers, 'rows': parsed.rows}))
    else:
        print('PASS: 26 consumer rows / 20 providers, 5 sortable columns + 26 detail panels, dated sources, 48 consumer monitors, scope/factual guards')
