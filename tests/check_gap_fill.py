#!/usr/bin/env python3
"""Source-scoped regression guards for the additional 2026-09-08 gap fill."""
from pathlib import Path

from check_structure import check


def check_gap_fill():
    parsed = check()
    rows = {row['id']: row for row in parsed.rows}

    def has(row_id, field, *terms):
        value = rows[row_id]['fields'].get(field, '').lower()
        assert all(term.lower() in value for term in terms), (row_id, field, terms)

    def key(row_id, column):
        return rows[row_id]['cells'][column]['attrs']['data-sort']

    def source(row_id, url):
        assert url in rows[row_id]['links'], (row_id, url)

    # A read layout is not a bp length; conflicting receipt clocks aren't sortable.
    has('selfdecode-kit', 'read-length', 'paired-end', 'bp', 'unpublished')
    assert 'bp length unpublished' in rows['selfdecode-kit']['fields']['read-length']
    for row_id, estimates in [('selfdecode-kit', ('8–12', '10–20', 'business days')),
                              ('genome-computer', ('2–3', '4–6', 'accepts'))]:
        has(row_id, 'results', 'conflicting', *estimates)
        assert key(row_id, 3) == ''
    source('selfdecode-kit', 'https://selfdecode.helpscoutdocs.com/article/982-ordering-wgs-how-it-works-timelines-and-faqs')
    source('genome-computer', 'https://genome.computer/terms')
    has('dante-premium', 'results', '6–8', 'arrives at lab')
    assert key('dante-premium', 3) == '42'
    has('dante-premium', 'laboratory', 'partner', 'Italy', 'US/EU', 'unnamed')

    # Contractual report deadline is neither typical lab timing nor a FASTQ promise.
    for assay, city in [('wes', 'Lugo'), ('wgs', 'Granada')]:
        row_id = '24genetics-' + assay
        has(row_id, 'results', 'maximum', '9 weeks', 'offices', 'technical problems', 'raw-file')
        assert key(row_id, 3) == ''
        has(row_id, 'laboratory', city, 'operator unnamed')
        source(row_id, 'https://24genetics.com/genetic-data-protection/')
        source(row_id, 'https://24genetics.com/general-terms-and-conditions/')
        assert 'laboratory' in rows[row_id]['fields']
        assert 'accredited' not in rows[row_id]['fields']['laboratory'].lower()
        assert 'VCF' not in rows[row_id]['cells'][4]['text']
        assert 'BAM' not in rows[row_id]['cells'][4]['text']
    assert rows['24genetics-wes']['cells'][4]['text'] == '—Download included'
    assert 'FASTQ' not in rows['24genetics-wes']['fields']['files']
    assert key('24genetics-wes', 4) == ''
    assert key('circle-premium', 4) == ''

    # Email interpretation, not a timed/live genetic-counseling entitlement.
    has('tellmegen', 'counseling', 'USD 39.99', 'USD 89.99', 'emailed', 'one topic',
        'existing tellmeGen', 'not a live', 'certification unverified')
    source('tellmegen', 'https://shop.tellmegen.com/en-us/products/simple-consultation')
    has('tellmegen', 'laboratory', 'DANAK', 'entity accredited', 'does not establish human WGS scope')
    source('tellmegen', 'https://danak.org/TEST593')
    has('myheritage', 'laboratory', 'certificate copies', 'live status', 'scope unverified')
    # Copies/claims do not silently become independent assay accreditation.
    for row_id in ['mito-3', 'mito-30']:
        has(row_id, 'laboratory', 'CLIA/CAP', 'partner claimed', 'unnamed', 'not independently verified')
        has(row_id, 'sample', 'conflict')
        assert key(row_id, 3) == '14', 'Do not transfer GC direct terms to Mito'
    for row_id in ['dna-complete-essential', 'dna-complete-pro', 'dna-complete-elite']:
        has(row_id, 'counseling', 'paid', 'certified genetic counselor', 'provider claim', 'unpublished')
    has('dna-complete-elite', 'counseling', 'not an included session')
    has('genome-computer', 'counseling', 'no clinical interpretation', 'separate counselor', 'unknown')

    # Policy conditions do not resolve fee, renewal-model or ongoing hosting ambiguity.
    has('gencove', 'files', 'restore', 'fee unpublished')
    has('genome-computer', 'files', '90-day', 'ongoing paid hosting unclear')
    has('genome-computer', 'files', 'request', 'fee unknown')
    has('macromo', 'costs', '1 year', 'renewal price not established', 'auto-renew',
        'in app', 'needs confirmation')
    has('odin', 'files', 'retain option', 'delete option', '30 days')
    has('meridian', 'files', 'conflict', 'after download', '30 days')

    # Alignment-label cleanup must not turn an omitted format into unavailable.
    root = Path(__file__).resolve().parents[1]
    html = (root / 'index.html').read_text()
    assert 'Unlisted formats remain unverified, not unavailable.' in html
    for row in parsed.rows:
        alignment = row['fields']['files']
        if 'BAM:' in alignment or 'CRAM:' in alignment:
            assert 'unavailable' not in alignment.lower()
    has('gencove', 'files', 'never both')
    has('myheritage', 'files', 'announced, not yet available')
    has('selfdecode-kit', 'files', 'FAQ schema only', 'confirm')
    has('sequencing-rare', 'files', 'request may be required')
    # Deliberately unchanged current-assay and export unknowns.
    for row_id in ['circle-premium', 'geneplanet-premium', 'human-longevity', 'adntro']:
        assert 'read-length' not in rows[row_id]['fields']
        assert not any(fmt in rows[row_id]['cells'][4]['text'] for fmt in ['VCF', 'BAM', 'CRAM', 'FASTQ'])
    assert rows['myheritage']['cells'][4]['text'] == '—', 'Announced CRAM is not available'
    assert 'schema only' in rows['selfdecode-kit']['cells'][4]['text']
    assert 'CRAM or FASTQ' in rows['gencove']['cells'][4]['text']
    return parsed


if __name__ == '__main__':
    check_gap_fill()
    print('PASS: additional gap-fill source scope, conflicts, credential evidence, retention and unknown-format guards')
