import { terminate } from "firebase/data-connect";
import { Trie } from "../src/Trie.js";
import { Node } from "../src/Trie.js";

class TrieTester{
  trie;
  constructor() {
    this.trie = new Trie();
  }

  insertWords(words) {
    console.log("INSERTING WORDS");
    words.forEach((e) => {
      this.trie.insertWord(e);
    })
  }

  matchPrefix(prefix) {
    console.log("MATCHING PREFIX: " + prefix);
    let matches = this.trie.collect(prefix);
    return matches;
  }

  matchAllWords() {
    console.log("MATCHING ALL WORDS");
    this.trie.collectAllWords();
  }
  
  StringifyTest() {
    console.log("STRINGIFY TEST");
    console.log(JSON.stringify(this.trie));
  }

  printMatches(matches) {
    console.log("PRINTING MATCHES");
    matches.forEach((match) => {
      console.log(match.word);
    })
  }

  buildTrieJSON = (node, trieJSON) => {
    if (node == null) {
      return null;
    }
    trieJSON['character'] = node.character;
    trieJSON['freq'] = node.freq;
    if (!trieJSON['left']){
      trieJSON['left'] = {};
    }
    trieJSON['left'] = this.buildTrieJSON(node.left, trieJSON['left']);
    if (!trieJSON['middle']){
      trieJSON['middle'] = {};
    }
    trieJSON['middle'] = this.buildTrieJSON(node.middle, trieJSON['middle']);
    if (!trieJSON['right']) {
      trieJSON['right'] = {};
    }
    trieJSON['right'] = this.buildTrieJSON(node.right, trieJSON['right']);
    return trieJSON;
  }
  
  trieToJSON = () => {
    let trieJSON = this.buildTrieJSON(this.trie.root, {});
    return trieJSON;
  }
  
  buildTrie = (trieJSON) => {
    if (trieJSON == null) {
      return null;
    }
    let node = new Node();
    node.character = trieJSON['character'];
    node.freq= trieJSON['freq'];
    node.left = this.buildTrie(trieJSON['left']);
    node.right = this.buildTrie(trieJSON['right']);
    node.middle = this.buildTrie(trieJSON['middle']);
    return node;
  }
  
  trieFromJSON = (trieJSON) => {
    let newTrie = new Trie();
    let rootNode = this.buildTrie(trieJSON);
    newTrie.root = rootNode;
    return newTrie;
  }
}

function main() {
  console.log("TEST STARTING");
  let tester = new TrieTester();
  let defaultWords = ["ERROR", "fdsa", "ERRNO"];
  tester.insertWords(defaultWords);
  let trieJSON = tester.trieToJSON();
  let words = tester.matchPrefix("E");
  tester.printMatches(words);
  let newTrie = tester.trieFromJSON(trieJSON);
  if (JSON.stringify(newTrie) === JSON.stringify(tester.trie)) {
    tester.trie = newTrie;
    words = tester.matchPrefix("P");
    tester.printMatches(words);
  }
  // tester.StringifyTest();
  console.log("TEST OVER");
}

main();