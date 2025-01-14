import { Trie } from "../src/Trie.js";

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
    this.trie.collect(prefix);
  }

  matchAllWords() {
    console.log("MATCHING ALL WORDS");
    this.trie.collectAllWords();
  }
}

function main() {
  console.log("TEST STARTING");
  let tester = new TrieTester();
  tester.insertWords(["sea", "seaborn", "seafhasd", "varun", "varuqweh", "hello"]);
  tester.matchAllWords();
  tester.matchPrefix("se");
  tester.matchPrefix("fhjkf");
  tester.matchPrefix("");
  console.log("TEST OVER");
}

main();