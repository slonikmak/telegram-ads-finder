import { tokenizeAndStem } from '../src/nlp.js';
import { matchMessage } from '../src/matcher.js';

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

const appConfig = {
    app: { base_currency: 'EUR' },
    exchange_rates: { RSD: 117 }
};

const messages = [
    {
        id: 1,
        text_normalized: "сдаю свою квартиру в белграде",
        tokens_stemmed: tokenizeAndStem("сдаю свою квартиру в белграде"),
        price_value: 500,
        price_currency: 'EUR'
    },
    {
        id: 2,
        text_normalized: "продам котел отличный",
        tokens_stemmed: tokenizeAndStem("продам котел отличный"),
        price_value: 100,
        price_currency: 'EUR'
    },
    {
        id: 3,
        text_normalized: "мой кот любит поспать",
        tokens_stemmed: tokenizeAndStem("мой кот любит поспать"),
        price_value: null,
        price_currency: null
    }
];

console.log("Running integration matching tests...");

messages.forEach(msg => {
    const matches = matchMessage(msg, rules, appConfig);
    console.log(`Msg ${msg.id}: "${msg.text_normalized}"`);
    console.log(`  Matches: ${matches.map(m => m.ruleId).join(', ') || 'None'}`);
});

// Verification
const m1 = matchMessage(messages[0], rules, appConfig);
if (m1.length === 1 && m1[0].ruleId === 'r1') console.log("Test 1 PASSED: 'квартиру' matched 'квартира'");
else console.log("Test 1 FAILED");

const m2 = matchMessage(messages[1], rules, appConfig);
if (m2.length === 0) console.log("Test 2 PASSED: 'котел' did NOT match 'кот'");
else console.log("Test 2 FAILED");

const m3 = matchMessage(messages[2], rules, appConfig);
if (m3.length === 1 && m3[0].ruleId === 'r2') console.log("Test 3 PASSED: 'кот' matched 'кот'");
else console.log("Test 3 FAILED");
