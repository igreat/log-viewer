export function naiveSubstringSearch(text, pattern) {
    const results = [];
    const textLength = text.length;
    const patternLength = pattern.length;
    // Loop over each possible start position in the text
    for (let i = 0; i <= textLength - patternLength; i++) {
        let match = true;
    
        // Compare character-by-character
        for (let j = 0; j < patternLength; j++) {
            if (text[i + j] !== pattern[j]) {
                match = false;
                break;
            }
        }
    
        // If all characters matched, record the start index
        if (match) {
            results.push(i);
        }
    }
    return results;
}