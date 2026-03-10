# ISS-006: Рефакторинг matcher.js (Chain of Responsibility)

## Type
chore

## Status
done

## Summary
Разделить длинную функцию `matchMessage` в `src/matcher.js` на набор отдельных функций-проверок.

## Context
В рамках `ISS-002` замечено, что функция `matchMessage` становится слишком большой. В ней подряд идут проверки scope, exclude, any, all, price. При добавлении нового функционала (стемминг, фильтры локации) функция превратится в спагетти. 

## Goal
Упростить чтение и поддержку кода `matcher.js`.

## Scope
Что входит в задачу:
- Вынос каждой логической проверки (словесные фильтры, фильтры цен) в отдельные функции.
- Модификация `matchMessage` таким образом, чтобы она применяла проверки последовательно.

Что не входит в задачу:
- Изменение логики матчинга (оно идет в ISS-003, ISS-005).

## Links
- Project doc: `workflow/project.md`
- Research: `workflow/issues/ISS-002-study-matching-logic.md`
- PR:
- Commits:

## Notes
Примерный вид:
```javascript
const checkers = [
    checkScope,
    checkExclude,
    checkKeywordsAny,
    checkKeywordsAll,
    checkPrice
];

// внутри цикла
if (!checkers.every(check => check(rule, message, appConfig))) continue;
```

## Outcome
Чем закончилась задача:
- Функция `matchMessage` была отрефакторена с использованием набора функций-чекеров (`checkScope`, `checkExclude`, `checkKeywordsAny`, `checkKeywordsAll`, `checkPrice`).
- Каждая логическая проверка вынесена в отдельную функцию для удобства поддержки и расширения.
- Состояние (найденная цена) передается через объект `matchContext`.
- Все тесты проходят успешно.
- Документация не потребовала обновлений, так как внешнее поведение системы не изменилось.
