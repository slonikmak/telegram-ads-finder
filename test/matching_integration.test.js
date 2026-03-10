import test from 'node:test';
import assert from 'node:assert';
import { tokenizeAndStem } from '../src/nlp.js';
import { matchMessage } from '../src/matcher.js';

const appConfig = {
    app: { base_currency: 'EUR' },
    exchange_rates: { RSD: 117 }
};

const rules = [
    {
        id: 'r1',
        enabled: true,
        name: 'Kvartira Belgrade',
        keywords_any: ['квартира', 'bg'],
    },
    {
        id: 'r2',
        enabled: true,
        name: 'Exclude Kotel',
        keywords_any: ['кот'],
        exclude: ['котел']
    }
];

// Pre-process rules (simulating src/config.js logic)
rules.forEach(rule => {
    if (rule.keywords_any) rule.keywords_any_stemmed = rule.keywords_any.map(kw => tokenizeAndStem(kw));
    if (rule.keywords_all) rule.keywords_all_stemmed = rule.keywords_all.map(kw => tokenizeAndStem(kw));
    if (rule.exclude) rule.exclude_stemmed = rule.exclude.map(kw => tokenizeAndStem(kw));
});

const messages = [
    {
        id: 1,
        text_normalized: 'сдаю свою квартиру в белграде',
        tokens_stemmed: tokenizeAndStem('сдаю свою квартиру в белграде'),
        price_value: 500,
        price_currency: 'EUR'
    },
    {
        id: 2,
        text_normalized: 'продам котел отличный',
        tokens_stemmed: tokenizeAndStem('продам котел отличный'),
        price_value: 100,
        price_currency: 'EUR'
    },
    {
        id: 3,
        text_normalized: 'мой кот любит поспать',
        tokens_stemmed: tokenizeAndStem('мой кот любит поспать'),
        price_value: null,
        price_currency: null
    }
];

test('stemming: "квартиру" should match rule with keyword "квартира"', () => {
    const matches = matchMessage(messages[0], rules, appConfig);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].ruleId, 'r1');
});

test('word boundary: "котел" should NOT match rule with keyword "кот"', () => {
    const matches = matchMessage(messages[1], rules, appConfig);
    assert.strictEqual(matches.length, 0);
});

test('exclude: "кот" should match rule even with exclude ["котел"] when text does not contain "котел"', () => {
    const matches = matchMessage(messages[2], rules, appConfig);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].ruleId, 'r2');
});
