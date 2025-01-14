class Node {
  left;
  right;
  middle;
  character;
  freq;
  constructor() {
    this.freq = 0;
    this.right = null;
    this.middle = null;
    this.left = null;
  }
}

class Pair {
  word;
  freq;
  constructor(word, freq) {
    this.word = word;
    this.freq = freq;
  }
}

export class Trie {
  root;
  matches;

  constructor() {
    this.root = null;
    this.matches = [];
  }

  insertWord(s) {
    this.root = this._insertWord(this.root, s, 0);
  }

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
    } else if (idx == s.length - 1){
      currNode.freq++;
    }
    return currNode;
  }

  getStartNode(prefix) {
    var startNode = this._getStartNode(this.root, prefix, 0);
    return startNode;
  }

  _getStartNode(currNode, prefix, idx) {
    if (currNode == null) {
      return null;
    }
    if (idx == prefix.length - 1) {
      return currNode;
    }
    if (prefix[idx] > currNode.character) {
      return this._getStartNode(currNode.right, prefix, idx);
    } else if (prefix[idx] < currNode.character) {
      return this._getStartNode(currNode.left, prefix, idx);
    }
    return this._getStartNode(currNode.middle, prefix, idx + 1);
  }

  collect(prefix) {
    if (prefix == "") {
      this._collect(this.root, "");
    } else {
      var currNode = this.getStartNode(prefix);
      this.matches = []
      if (currNode == null) {
        return;
      }
      if (currNode != null && currNode.freq > 0) {
        this.matches.push(new Pair(prefix, currNode.freq));
      }
      this._collect(currNode.middle, prefix);
    }
    this.matches = this.matches.sort((a, b) => b.freq - a.freq); // sorts matches in desc
    this._printMatches();
  }

  _collect(currNode, word) {
    if (currNode == null) {
      return;
    }
    if (currNode.freq > 0) {
      this.matches.push(new Pair(word + currNode.character, currNode.freq));
      currNode.freq++;
    }
    this._collect(currNode.left, word);
    this._collect(currNode.middle, word + currNode.character);
    this._collect(currNode.right, word);
  }

  _printMatches() {
    this.matches.forEach((e) => {console.log(e.word + " " + e.freq)});
  }
}