import { tokenizeAndStem } from '../src/nlp.js';

const texts = [
    "Сдаю шикарную квартиру",
    "Продаю котел деревянный",
    "Ищу квартиры в Белграде",
    "Куплю кота"
];

const keywords = ["квартира", "кот"];

console.log("Stemming results:");
texts.forEach(text => {
    const tokens = tokenizeAndStem(text);
    console.log(`Text: "${text}"`);
    console.log(`Tokens: [${tokens.join(', ')}]`);

    keywords.forEach(kw => {
        const kwStem = tokenizeAndStem(kw)[0];
        const matched = tokens.includes(kwStem);
        console.log(`  Match with "${kw}" (stem: "${kwStem}"): ${matched}`);
    });
    console.log('---');
});
