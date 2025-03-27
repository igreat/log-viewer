/**
 * Boyer–Moore Substring Search
 *
 * Returns an array of all starting indices where `pattern` is found in `text`.
 * The implementation uses both the Bad Character rule and the Good Suffix rule.
 *
 * @param {string} text - The text in which to search.
 * @param {string} pattern - The pattern to search for.
 * @returns {number[]} An array of start indices of matches.
 */
export function boyerMooreSearch(text, pattern) {
    const n = text.length;
    const m = pattern.length;
  
    // Edge case: if pattern is empty, match at every position by convention or return empty
    if (m === 0) {
        return [...Array(n + 1).keys()]; // or simply return []
    }
  
    // 1. Build the "bad character" table.
    //    badChar[c] will store the rightmost index of character c in `pattern`.
    //    If c does not appear in `pattern`, it remains -1.
    const badChar = buildBadCharTable(pattern);
  
    // 2. Build the "good suffix" table.
    //    goodSuffix[i] indicates how far to shift if a mismatch happens at position i in the pattern.
    const goodSuffix = buildGoodSuffixTable(pattern);
  
    const matches = [];
    let s = 0; // s is the shift of the pattern with respect to text
  
    while (s <= n - m) {
        let j = m - 1;
  
        // Move backwards through pattern comparing to text
        while (j >= 0 && pattern[j] === text[s + j]) {
            j--;
        }
  
        if (j < 0) {
            matches.push(s);
            s += goodSuffix[0];
        } else {
            const charCode = text.charCodeAt(s + j);
            const badCharShift = j - (badChar[charCode] ?? -1);
    
            const goodSuffixShift = goodSuffix[j];
    
            s += Math.max(badCharShift, goodSuffixShift, 1);
        }
    }
    return matches;
}
  
  /**
   * Builds the bad character table for Boyer–Moore.
   * For simplicity, we’ll assume an extended ASCII set (0-255).
   *
   * @param {string} pattern
   * @returns {number[]} badChar - The last (rightmost) position of each character in pattern.
   */
function buildBadCharTable(pattern) {
    const tableSize = 256; // For extended ASCII
    const badChar = new Array(tableSize).fill(-1);

    for (let i = 0; i < pattern.length; i++) {
        badChar[pattern.charCodeAt(i)] = i;
    }

    return badChar;
}
  
  /**
   * Builds the good suffix table for Boyer–Moore using the standard suffix-based approach.
   * goodSuffix[i] tells how far to shift the pattern if a mismatch occurs at pattern[i].
   *
   * @param {string} pattern
   * @returns {number[]} goodSuffix - Shift distances by pattern index on mismatch.
   */
function buildGoodSuffixTable(pattern) {
    const m = pattern.length;
    const goodSuffix = new Array(m).fill(m); 
    const suffix = new Array(m).fill(0);
  
    // Step 1: Build the `suffix` array
    // suffix[i] = the length of the longest suffix of pattern[i..m-1] which is also a prefix of pattern.
    // We fill this from right to left.
    suffix[m - 1] = m;
    let g = m - 1;   // boundary for suffix that matches prefix
    let f = m - 1;   // backup pointer
  
    for (let i = m - 2; i >= 0; i--) {
        if (i > g && suffix[i + (m - 1 - f)] < i - g) {
            suffix[i] = suffix[i + (m - 1 - f)];
        } else {
            if (i < g) {
                g = i;
            }
            f = i;
            while (g >= 0 && pattern[g] === pattern[g + (m - 1 - f)]) {
                g--;
            }
            suffix[i] = f - g;
        }
    }
  
    // Step 2: Build the goodSuffix array
    // Initialize all shifts to m by default.
    // Then compute the actual shift values based on the suffix array.
    // A partial match of length suffix[i] implies a certain shift.
    for (let i = 0; i < m; i++) {
        goodSuffix[i] = m;
    }
  
    // Case 1: When suffix[i] = i + 1, the entire substring from i to end is a prefix
    // We fill the leftmost positions in goodSuffix
    let j = 0;
    for (let i = m - 1; i >= 0; i--) {
        if (suffix[i] === i + 1) {
            for (; j < m - 1 - i; j++) {
                if (goodSuffix[j] === m) {
                    goodSuffix[j] = m - 1 - i;
                }
            }
        }
    }
  
    // Case 2: Other cases based on suffix lengths
    for (let i = 0; i < m - 1; i++) {
        goodSuffix[m - 1 - suffix[i]] = m - 1 - i;
    }
  
    return goodSuffix;
  }
  