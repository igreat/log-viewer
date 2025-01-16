import { terminate } from "firebase/data-connect";
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
    matches.forEach((match) => {
      console.log(match.word);
    })
  }
}

function main() {
  console.log("TEST STARTING");
  let tester = new TrieTester();
  let defaultWords = ["ERROR", "Failed", "Application", "fdsa", "ERRNO"];
  tester.insertWords(defaultWords);
  let matches = tester.matchPrefix("E");
  tester.printMatches(matches)
  matches = tester.matchPrefix("F");
  tester.printMatches(matches)
  matches = tester.matchPrefix("App");
  tester.printMatches(matches)
  // tester.StringifyTest();
  console.log("TEST OVER");
}

main();