import PriorityQueue from "./PriorityQueue.js";

/**
 * Represents a node in the trie.
 */
export class Node {
    /** @type {Node|null} Left child node. */
    left;
    /** @type {Node|null} Right child node. */
    right;
    /** @type {Node|null} Middle child node. */
    middle;
    /** @type {string} Character stored at this node. */
    character;
    /** @type {number} Frequency count if the node marks end of a word. */
    freq;

    constructor() {
        this.freq = 0;
        this.right = null;
        this.middle = null;
        this.left = null;
    }
}

/**
 * Represents a word and its frequency.
 */
export class Pair {
    /** @type {string} The word. */
    word;
    /** @type {number} Frequency count of the word. */
    freq;

    /**
     * @param {string} word 
     * @param {number} freq 
     */
    constructor(word, freq) {
        this.word = word;
        this.freq = freq;
    }
}

/**
 * A trie data structure for storing and retrieving words with frequency.
 */
export class Trie {
    /** @type {Node|null} The root node of the trie. */
    root;
    /** @type {any} (Unused) Matches storage. */
    matches;

    constructor() {
        this.root = null;
    }

    /**
     * Inserts a word into the trie.
     * @param {string} s - The word to insert.
     */
    insertWord(s) {
        this.root = this._insertWord(this.root, s, 0);
    }

    /**
     * Helper method to insert a word recursively.
     * @param {Node|null} currNode - Current node in the trie.
     * @param {string} s - The word to insert.
     * @param {number} idx - Current character index.
     * @returns {Node} The updated node.
     */
    _insertWord(currNode, s, idx) {
        if (currNode == null) {
            currNode = new Node();
            currNode.character = s[idx];
        }
        if (s[idx] > currNode.character) {
            currNode.right = this._insertWord(currNode.right, s, idx);
        } else if (s[idx] < currNode.character) {
            currNode.left = this._insertWord(currNode.left, s, idx);
        } else if (idx < s.length - 1) {
            currNode.middle = this._insertWord(currNode.middle, s, idx + 1);
        } else if (idx == s.length - 1) {
            currNode.freq++;
        }
        return currNode;
    }

    /**
     * Gets the node where the given prefix ends.
     * @param {string} prefix - The prefix to search.
     * @returns {Node|null} The node corresponding to the prefix or null if not found.
     */
    getStartNode(prefix) {
        var startNode = this._getStartNode(this.root, prefix, 0);
        return startNode;
    }

    /**
     * Recursively search for the node matching a prefix.
     * @param {Node|null} currNode - Current node.
     * @param {string} prefix - The prefix.
     * @param {number} idx - Current index in the prefix.
     * @returns {Node|null} The node matching the prefix.
     */
    _getStartNode(currNode, prefix, idx) {
        if (currNode == null) {
            return null;
        }
        if (prefix[idx] > currNode.character) {
            return this._getStartNode(currNode.right, prefix, idx);
        } else if (prefix[idx] < currNode.character) {
            return this._getStartNode(currNode.left, prefix, idx);
        }
        if (idx == prefix.length - 1) {
            return currNode;
        }
        return this._getStartNode(currNode.middle, prefix, idx + 1);
    }

    /**
     * Collects up to a given number of word matches that start with the prefix.
     * @param {string} prefix - The search prefix.
     * @param {number} numberOfMatches - Maximum number of matches.
     * @returns {Pair[]} Array of pairs (word and frequency).
     */
    collect(prefix, numberOfMatches) {
        let matches = [];
        if (prefix == "") {
            return matches;
            // this._collect(this.root, "", matches);
        } else {
            var currNode = this.getStartNode(prefix);
            if (currNode == null) {
                return matches;
            }
            if (currNode != null && currNode.freq > 0) {
                matches.push(new Pair(prefix, currNode.freq));
            }
            this._collect(currNode.middle, prefix, matches);
        }

        const pq = new PriorityQueue(numberOfMatches);

        matches.forEach((pair) => {
            pq.insert(pair);
        })
        const result = pq.getTopResults();
        return result;
    }

    /**
     * Recursively collects words from the trie.
     * @param {Node|null} currNode - Current node.
     * @param {string} word - Word built so far.
     * @param {Pair[]} matches - Array to store matches.
     */
    _collect(currNode, word, matches) {
        if (currNode == null) {
            return;
        }
        if (currNode.freq > 0) {
            matches.push(new Pair(word + currNode.character, currNode.freq));
        }
        this._collect(currNode.left, word, matches);
        this._collect(currNode.middle, word + currNode.character, matches);
        this._collect(currNode.right, word, matches);
    }

    /**
     * (Helper) Prints matches to the console.
     * @param {Pair[]} matches - Array of matches.
     */
    _printMatches(matches) {
        matches.forEach((e) => { console.log(e.word + " " + e.freq) });
    }
}