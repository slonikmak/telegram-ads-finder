# ISS-007: Cleanup по результатам code review ISS-003–006

## Type
chore

## Status
done

## Summary
Устранить три мелких замечания, выявленных при ревью: мёртвый код в `nlp.js`, лишняя аллокация объекта при каждом вызове `tokenizeAndStem`, и формат интеграционного теста, который не совместим с `node:test`.

## Context
По итогам ревью ISS-003–006 зафиксированы следующие проблемы:

1. **`src/nlp.js`** — `const tokenizer = new natural.WordPunctTokenizer()` создаётся на уровне модуля, но нигде не используется. Мёртвый код.
2. **`src/nlp.js`** — `new natural.WordTokenizer()` создаётся внутри функции `tokenizeAndStem` при каждом вызове. Должен создаваться один раз на уровне модуля.
3. **`test/matching_integration.test.js`** — использует `console.log("PASSED/FAILED")` вместо `node:test` + `assert`. Из-за этого `npm test` не считает эти проверки тест-кейсами: даже если логика сломается и выведется «FAILED», тест всё равно покажется зелёным.

## Goal
- `src/nlp.js` не содержит мёртвого кода, `WordTokenizer` создаётся один раз на уровне модуля.
- `test/matching_integration.test.js` переписан в формате `node:test` + `assert`, покрывает те же три сценария.
- `npm test` проходит (15+ тестов зелёные).

## Scope
Что входит в задачу:
- Исправить `src/nlp.js`: убрать неиспользуемый `WordPunctTokenizer`, вынести `WordTokenizer` на уровень модуля.
- Переписать `test/matching_integration.test.js` с `console.log` на `node:test` + `assert`.

Что не входит в задачу:
- Изменение логики стемминга или токенизации.
- Изменение логики matcher или конфига.

## Links
- Project doc: `workflow/project.md`
- Research: code review ISS-003–006
- PR:
- Commits:

## Notes
При переписывании `matching_integration.test.js` нужно оставить те же три сценария:
1. «квартиру» матчит правило с `keywords_any: ['квартира']` (стемминг + склонения).
2. «котел» НЕ матчит правило с `keywords_any: ['кот']` (нет ложных совпадений подстрок).
3. «кот» матчит правило с `keywords_any: ['кот']`, даже при наличии `exclude: ['котел']`.

## Outcome
Чем закончилась задача:
- Удалён неиспользуемый `WordPunctTokenizer` из `src/nlp.js`.
- `WordTokenizer` вынесен на уровень модуля, создаётся один раз.
- `test/matching_integration.test.js` переписан на `node:test` + `assert`; три сценария теперь являются полноценными тест-кейсами.
- `npm test`: 17 тестов, все зелёные (было 15).
- Коммит: ISS-007.
