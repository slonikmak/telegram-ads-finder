import test from 'node:test';
import assert from 'node:assert';
import { matchMessage } from '../src/matcher.js';

const appConfig = {
    app: {
        base_currency: 'EUR'
    },
    exchange_rates: {
        RSD: 117
    }
};

test('matchMessage should match if second price satisfies rule', () => {
    const message = {
        id: 1,
        text_normalized: 'скидка 20 евро! квартира за 500 евро',
        price_value: 20, // first price
        price_currency: 'EUR',
        prices: [
            { value: 20, currency: 'EUR' },
            { value: 500, currency: 'EUR' }
        ]
    };

    const rules = [
        {
            id: 'rule-1',
            enabled: true,
            price: { min: 400, max: 600, currency: 'EUR', require_detected: true }
        }
    ];

    const matches = matchMessage(message, rules, appConfig);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].matchedPrice, 500);
});

test('matchMessage should not match if no price satisfies rule', () => {
    const message = {
        id: 1,
        text_normalized: 'скидка 20 евро! квартира за 1000 евро',
        price_value: 20,
        price_currency: 'EUR',
        prices: [
            { value: 20, currency: 'EUR' },
            { value: 1000, currency: 'EUR' }
        ]
    };

    const rules = [
        {
            id: 'rule-1',
            enabled: true,
            price: { min: 400, max: 600, currency: 'EUR', require_detected: true }
        }
    ];

    const matches = matchMessage(message, rules, appConfig);
    assert.strictEqual(matches.length, 0);
});

test('matchMessage should handle RSD to EUR conversion', () => {
    const message = {
        id: 1,
        text_normalized: 'цена 60.000 rsd',
        price_value: 60000,
        price_currency: 'RSD',
        prices: [
            { value: 60000, currency: 'RSD' }
        ]
    };

    const rules = [
        {
            id: 'rule-1',
            enabled: true,
            price: { min: 500, max: 600, currency: 'EUR' }
        }
    ];

    // 60000 / 117 = ~512.82
    const matches = matchMessage(message, rules, appConfig);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].matchedPrice, 60000);
});
