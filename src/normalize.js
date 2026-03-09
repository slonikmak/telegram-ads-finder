export function normalizeText(input) {
    if (!input) return '';

    return input
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ')
        // Keep letters (latin, cyrillic, serbian), numbers, currency symbols, and basic punctuation
        // Serbian latin specific: č, ć, dž, đ, lj, nj, š, ž
        .replace(/[^\p{L}\p{N}\s€$£¥dinдинара]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
