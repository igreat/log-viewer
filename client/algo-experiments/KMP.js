// JavaScript program to search the pattern in given text 
// using KMP Algorithm

function constructLps(pat, lps) {
    
    // len stores the length of longest prefix which 
    // is also a suffix for the previous index
    let len = 0;

    // lps[0] is always 0
    lps[0] = 0;

    let i = 1;
    while (i < pat.length) {
        
        // If characters match, increment the size of lps
        if (pat[i] === pat[len]) {
            len++;
            lps[i] = len;
            i++;
        }
        
        // If there is a mismatch
        else {
            if (len !== 0) {
                
                // Update len to the previous lps value 
                // to avoid redundant comparisons
                len = lps[len - 1];
            } else {
                
                // If no matching prefix found, set lps[i] to 0
                lps[i] = 0;
                i++;
            }
        }
    }
}

export function search(pat, txt) {
    const n = txt.length;
    const m = pat.length;

    const lps = new Array(m);
    const res = [];

    constructLps(pat, lps);

    // Pointers i and j, for traversing 
    // the text and pattern
    let i = 0;
    let j = 0;

    while (i < n) {
        
        // If characters match, move both pointers forward
        if (txt[i] === pat[j]) {
            i++;
            j++;

            // If the entire pattern is matched 
            // store the start index in result
            if (j === m) {
                res.push(i - j);
                
                // Use LPS of previous index to 
                // skip unnecessary comparisons
                j = lps[j - 1];
            }
        }
        
        // If there is a mismatch
        else {
            
            // Use lps value of previous index
            // to avoid redundant comparisons
            if (j !== 0)
                j = lps[j - 1];
            else
                i++;
        }
    }
    return res; 
}