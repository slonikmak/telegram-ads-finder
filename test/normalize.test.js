import test from 'node:test';
import assert from 'node:assert';
import { normalizeText } from '../src/normalize.js';

test('normalizeText should keep internal hyphens', () => {
    assert.strictEqual(normalizeText('1-комнатная'), '1-комнатная');
    assert.strictEqual(normalizeText('Санкт-Петербург'), 'санкт-петербург');
});

test('normalizeText should remove redundant characters but keep letters and numbers', () => {
    assert.strictEqual(normalizeText('Цена: 100$!'), 'цена 100$');
    assert.strictEqual(normalizeText('Hello, world...'), 'hello world');
});

test('normalizeText should handle currency symbols', () => {
    assert.strictEqual(normalizeText('100€ 100$ 100£ 100¥'), '100€ 100$ 100£ 100¥');
});

test('normalizeText should convert ё to е', () => {
    assert.strictEqual(normalizeText('зелёный'), 'зеленый');
});

test('normalizeText should remove extra spaces', () => {
    assert.strictEqual(normalizeText('  hello   world  '), 'hello world');
});
