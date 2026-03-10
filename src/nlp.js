import natural from 'natural';

const wordTokenizer = new natural.WordTokenizer();
const stemmerRu = natural.PorterStemmerRu;
const stemmerEn = natural.PorterStemmer;

/**
 * Tokenizes text and stems each token.
 * Handles both Russian and English using simple Cyrillic detection.
 *
 * @param {string} text
 * @returns {string[]} Array of stemmed tokens
 */
export function tokenizeAndStem(text) {
    if (!text) return [];

    const tokens = wordTokenizer.tokenize(text.toLowerCase());

    return tokens.map(token => {
        // Simple heuristic: if it contains at least one Cyrillic character, use Russian stemmer
        if (/[а-яё]/i.test(token)) {
            return stemmerRu.stem(token);
        }
        // Fallback to English stemmer
        return stemmerEn.stem(token);
    });
}
