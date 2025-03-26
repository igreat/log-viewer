import { applyFilters } from "./logService.js";
import { currentFilters } from "./filterGroup.js";
import { TOP_K } from "./utils.js";
import { Trie, Node } from "./Trie";

/** @type {Trie} */
let suggestionTrie = new Trie();

/** @type {Object|null} General text filter */
export let generalFilter = null;

/**
 * Update the general text filter based on the search input,
 * combine it with current filters, and apply them.
 */
export const updateTextFilter = () => {
    const text = document.getElementById("log-search").value.trim();
    const regex = document.getElementById("use-regex").checked;
    const caseSensitive = document.getElementById("case-sensitive").checked;
    generalFilter = { text, regex, caseSensitive };

    // Combine general filter with current filters
    const filters = generalFilter.text ? [...currentFilters, generalFilter] : currentFilters;
    applyFilters(filters);
}

/**
 * Update the search suggestions by retrieving suggestions from the trie
 * and populating the suggestions list.
 */
export const updateSearchSuggestions = () => {
    let searchSuggestions = getSearchSuggestions();
    searchSuggestions = searchSuggestions.map(p => p.word);
    populateSearchSuggestions(searchSuggestions);
}

/**
 * Update the search suggestion trie with the current search input
 * and store the updated trie in local storage.
 */
export const updateSearchSugggestionTrie = () => {
    const text = document.getElementById("log-search").value.trim();
    suggestionTrie.insertWord(text);
    let trieJSON = trieToJSON();
    window.localStorage.setItem('suggestionTrie', JSON.stringify(trieJSON));
}

/**
 * Get search suggestions from the trie for the current search input.
 * @returns {Object[]} Array of suggestion objects.
 */
export const getSearchSuggestions = () => {
    const text = document.getElementById("log-search").value.trim();
    let results = suggestionTrie.collect(text, TOP_K);
    return results;
}

/**
 * Populate the search suggestions list in the UI.
 * @param {string[]} results - Array of suggestion strings.
 */
export const populateSearchSuggestions = (results) => {
    const suggestionsBox = document.getElementById("search-suggestions");
    suggestionsBox.innerHTML = "";

    if (results.length === 0) {
        suggestionsBox.style.display = "none";
        return;
    }
    results.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        li.addEventListener("click", () => {
            document.getElementById("log-search").value = item;
            updateTextFilter();
            suggestionsBox.style.display = "none";
        });
        suggestionsBox.appendChild(li);
    })
    suggestionsBox.style.display = "block";
}

/**
 * Convert the current trie into a JSON object.
 * @returns {Object} JSON representation of the trie.
 */
export const trieToJSON = () => {
    let trieJSON = buildTrieJSON(suggestionTrie.root, {});
    return trieJSON;
}

/**
 * Recursively build a JSON object from a trie node.
 * @param {Node|null} node - The trie node.
 * @param {Object} trieJSON - The JSON object to populate.
 * @returns {Object|null} The populated JSON or null.
 */
const buildTrieJSON = (node, trieJSON) => {
    if (node == null) {
        return null;
    }
    trieJSON['character'] = node.character;
    trieJSON['freq'] = node.freq;
    if (!trieJSON['left']) {
        trieJSON['left'] = {};
    }
    trieJSON['left'] = buildTrieJSON(node.left, trieJSON['left']);
    if (!trieJSON['middle']) {
        trieJSON['middle'] = {};
    }
    trieJSON['middle'] = buildTrieJSON(node.middle, trieJSON['middle']);
    if (!trieJSON['right']) {
        trieJSON['right'] = {};
    }
    trieJSON['right'] = buildTrieJSON(node.right, trieJSON['right']);
    return trieJSON;
}

/**
 * Reconstruct a Trie from its JSON representation.
 * @param {Object} trieJSON - JSON representation of a trie.
 * @returns {Trie} The reconstructed trie.
 */
export const trieFromJSON = (trieJSON) => {
    let newTrie = new Trie();
    newTrie.root = buildTrie(newTrie.root, trieJSON);
    return newTrie;
}

/**
 * Recursively build a Trie node from JSON.
 * @param {Node|null} node - The current node (may be null).
 * @param {Object|null} trieJSON - JSON data for the node.
 * @returns {Node|null} The built node.
 */
const buildTrie = (node, trieJSON) => {
    if (trieJSON == null) {
        return null;
    }
    if (node == null) {
        node = new Node();
    }
    node.character = trieJSON['character'];
    node.freq = trieJSON['freq'];
    node.left = buildTrie(node.left, trieJSON['left']);
    node.right = buildTrie(node.right, trieJSON['right']);
    node.middle = buildTrie(node.middle, trieJSON['middle']);
    return node;
}

/**
 * Check if a given date string is a valid ISO date ending with 'Z'.
 * @param {string} dateString - The date string to validate.
 * @returns {boolean} True if valid, else false.
 */
export const isValidDate = (dateString) => {
    if (dateString[dateString.length - 1] != 'Z') {
        return false;
    }
    dateString = dateString.substring(0, dateString.length - 1);
    const DateTimeSplit = dateString.split("T");
    const Date = DateTimeSplit[0].split("-");
    const Time = DateTimeSplit[1].split(":");

    if (Date.length != 3 || Time.length != 3) {
        return false;
    }
    if (!(("0000" <= Date[0] && Date[0] <= "9999") &&
        ("00" <= Date[1] && Date[1] <= "11") &&
        ("00" <= Date[2] && Date[2] <= "31"))) {
        return false;
    }
    if (!(("00" <= Time[0] && Time[0] <= "59") &&
        ("00" <= Time[1] && Time[1] <= "59"))) {
        return false;
    }
    const SecondsSplit = Time[2].split(".");
    if (!(("00" <= SecondsSplit[0] && SecondsSplit[0] <= "59") &&
        ("000" <= SecondsSplit[1] && SecondsSplit[1] <= "999"))) {
        return false;
    }
    return true;
}

/**
 * Determine if a log's timestamp falls within the specified date range.
 * @param {Object} log - A log object with a "timestamp" field.
 * @returns {boolean} True if within range or if date filtering is disabled.
 */
export const isWithinDate = (log) => {
    if (!document.getElementById("apply-date-chkbox").checked) {
        return true;
    }
    const fromTimeStamp = document.getElementById("from-timestamp").value;
    const toTimeStamp = document.getElementById("to-timestamp").value;
    if (fromTimeStamp == "" || toTimeStamp == "") {
        return true;
    }
    if (!isValidDate(fromTimeStamp) || !isValidDate(toTimeStamp)) {
        console.log("INVALID TIMESTAMPS")
        return false;
    }
    const logTimeStamp = log["timestamp"];
    if (fromTimeStamp <= logTimeStamp && logTimeStamp <= toTimeStamp) {
        return true;
    }
    return false;
}

/**
 * Initialize search functionality by loading stored data,
 * setting up event listeners for text and date filters.
 */
export const initSearch = () => {
    // -- Loading From Local Storage
    if (!window.localStorage.getItem('suggestionTrie')) {
        window.localStorage.setItem("suggestionTrie", JSON.stringify(trieToJSON(suggestionTrie)));
    } else {
        let trieJSON = JSON.parse(window.localStorage.getItem("suggestionTrie"));
        suggestionTrie = trieFromJSON(trieJSON);
    }

    if (!window.localStorage.getItem("fromDate")) {
        window.localStorage.setItem("fromDate", "");
    } else {
        document.getElementById("from-timestamp").value = window.localStorage.getItem("fromDate");
    }

    if (!window.localStorage.getItem("toDate")) {
        window.localStorage.setItem("toDate", "");
    } else {
        document.getElementById("to-timestamp").value = window.localStorage.getItem("toDate");
    }

    if (!window.localStorage.getItem("useDate")) {
        window.localStorage.setItem("useDate", "true");
    } else if (window.localStorage.getItem("useDate") == "false") {
        document.getElementById("apply-date-chkbox").checked = false;
    } else {
        document.getElementById("apply-date-chkbox").checked = true;
    }

    // -- Text Filter
    document.getElementById("log-search").addEventListener("keydown", (e) => {
        if (e.key == "Enter") {
            updateTextFilter();
            updateSearchSugggestionTrie();
        }
    })
    document.getElementById("log-search").addEventListener("input", updateSearchSuggestions);
    document.getElementById("use-regex").addEventListener("change", updateTextFilter);
    document.getElementById("case-sensitive").addEventListener("change", updateTextFilter);

    // -- Date Filter
    document.getElementById("apply-date-btn").addEventListener("click", () => {
        applyFilters(currentFilters);
        console.log(document.getElementById("from-timestamp").value)
        window.localStorage.setItem("fromDate", document.getElementById("from-timestamp").value);
        window.localStorage.setItem("toDate", document.getElementById("to-timestamp").value);
        if (document.getElementById("apply-date-chkbox").checked) {
            window.localStorage.setItem("useDate", "true");
        } else {
            window.localStorage.setItem("useDate", "false");
        }
    })

    document.getElementById("clear-date-btn").addEventListener("click", () => {
        document.getElementById("from-timestamp").value = "";
        document.getElementById("to-timestamp").value = "";
        window.localStorage.setItem("fromDate", "");
        window.localStorage.setItem("toDate", "");
    })
}