import test from 'node:test';
import assert from 'node:assert';
import { extractPrice, extractPrices } from '../src/price.js';

const mockFxConfig = {
    exchange_rates: {
        RSD: 117
    }
};

test('extractPrice should extract multiple prices correctly', () => {
    const text = 'Цена 500 EUR или 60.000 RSD';
    const result = extractPrices(text, mockFxConfig);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].value, 500);
    assert.strictEqual(result[1].value, 60000);
    assert.strictEqual(result[1].currency, 'RSD');
});

test('extractPrice should extract single price correctly', () => {
    const text = 'Цена 500 EUR';
    const result = extractPrice(text, mockFxConfig);
    assert.strictEqual(result.value, 500);
    assert.strictEqual(result.currency, 'EUR');
});

test('extractPrice should fix decimal issue (1.5)', () => {
    const text = 'Цена 1.5 EUR';
    const result = extractPrice(text, mockFxConfig);
    assert.strictEqual(result.value, 1.5);
});

test('extractPrice should handle thousands (1.000)', () => {
    const text = 'Цена 1.000 EUR';
    const result = extractPrice(text, mockFxConfig);
    assert.strictEqual(result.value, 1000);
});

test('extractPrice should handle mixed symbols (1.000,50)', () => {
    const text = 'Цена 1.000,50 EUR';
    const result = extractPrice(text, mockFxConfig);
    assert.strictEqual(result.value, 1000.5);
});

test('extractPrice should handle space as separator (1 000)', () => {
    const text = 'Цена 1 000 EUR';
    const result = extractPrice(text, mockFxConfig);
    assert.strictEqual(result.value, 1000);
});
