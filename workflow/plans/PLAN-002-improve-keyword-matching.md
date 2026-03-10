# PLAN-002: Интеграция Tokenization & Stemming

## Related Issue
ISS-005

## Related Req
REQ-002

## Objective
Встроить пословный поиск (токенизацию) и простой стемминг в `matcher.js`.

## Approach
Выбранный подход:
- Взять готовую легковесную npm-библиотеку (например, `natural` или какой-нибудь минималистичный snowball-stemmer для русского/английского).
- Написать утилиту (в `src/normalize.js` или `src/nlp.js`) для разбивки текста на токены.
- В `src/matcher.js` прогонять `keywords_any` и `keywords_all` через функцию стемминга при инициализации/вызове.

## Steps
1. Выбрать и установить легковесную библиотеку стеммера.
2. Подготовить функцию `tokenizeAndStem(text) -> ['root1', 'root2', ...]`.
3. В `src/matcher.js` заменить логику `message.text_normalized.includes(kw)` на пересечение массивов (`const hasAny = rule_keywords_stemmed.some(kw => message_tokens_stemmed.includes(kw))`).
4. Написать несколько локальных тестов (в виде скрипта) на русском для проверки склонений.

## Risks
Основные риски:
- Слишком грубый стемминг склеит непохожие слова.
- Падение производительности, если `tokenizeAndStem` будет вызываться на каждое сообщение в цикле по каждому правилу. Нужно стеммить сообщение *один раз* до цикла проверки `matchMessage`. А правила стеммить при загрузке конфигов в `src/config.js`.

## Validation
Как будет проверяться результат:
- Тестовые прогоны на реальных текстах.

## Progress
- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4

## Notes
Обязательно вынести стемминг сообщения до цикла `for (const rule of rules)`, в идеале даже в `index.js`, чтобы `msgEntity` уже содержал массив `.stemmed_tokens`.
