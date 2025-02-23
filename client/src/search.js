import { applyFilters } from "./logService.js";
import { currentFilters } from "./filterGroup.js";
import { TOP_K } from "./utils.js";
import { Trie, Node } from "./Trie";

let suggestionTrie = new Trie();

export let generalFilter = null;

export const updateTextFilter = () => {
    const text = document.getElementById("log-search").value.trim();
    const regex = document.getElementById("use-regex").checked;
    const caseSensitive = document.getElementById("case-sensitive").checked;
    generalFilter = { text, regex, caseSensitive };

    // Combine general filter with current filters
    const filters = generalFilter.text ? [...currentFilters, generalFilter] : currentFilters;
    applyFilters(filters);
}

export const updateSearchSuggestions = () => {
    let searchSuggestions = getSearchSuggestions();
    searchSuggestions = searchSuggestions.map(p => p.word);
    populateSearchSuggestions(searchSuggestions);
}

export const updateSearchSugggestionTrie = () => {
    const text = document.getElementById("log-search").value.trim();
    suggestionTrie.insertWord(text);
    let trieJSON = trieToJSON();
    window.localStorage.setItem('suggestionTrie', JSON.stringify(trieJSON));
}

export const getSearchSuggestions = () => {
    const text = document.getElementById("log-search").value.trim();
    let results = suggestionTrie.collect(text, TOP_K);
    return results;
}

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

export const trieToJSON = () => {
    let trieJSON = buildTrieJSON(suggestionTrie.root, {});
    return trieJSON;
}

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

export const trieFromJSON = (trieJSON) => {
    let newTrie = new Trie();
    newTrie.root = buildTrie(newTrie.root, trieJSON);
    return newTrie;
}

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

export const initSearch = () => {
    if (!window.localStorage.getItem('suggestionTrie')) {
        window.localStorage.setItem("suggestionTrie", JSON.stringify(trieToJSON(suggestionTrie)));
    } else {
        let trieJSON = JSON.parse(window.localStorage.getItem("suggestionTrie"));
        suggestionTrie = trieFromJSON(trieJSON);
    }

    document.getElementById("log-search").addEventListener("keydown", (e) => {
        if (e.key == "Enter") {
            updateTextFilter();
            updateSearchSugggestionTrie();
        }
    })
    document.getElementById("log-search").addEventListener("input", updateSearchSuggestions);
    document.getElementById("use-regex").addEventListener("change", updateTextFilter);
    document.getElementById("case-sensitive").addEventListener("change", updateTextFilter);
}