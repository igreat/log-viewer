import { PriorityQueue } from "./priorityQueue.js";
import { Pair } from "./Trie.js";

class PriorityQueueTester {
    pq;

    constructor() {
        this.pq = new PriorityQueue(5);
    }

    insertNode(node) {
        this.pq.insert(node);
    }

    printPQ() {
        const results = this.pq.getTopResults();
        console.log(results);
    }
}

const tester = new PriorityQueueTester;
tester.insertNode(new Pair("hello", 5));
tester.insertNode(new Pair("h", 9));
tester.insertNode(new Pair("qwertt", 1));
// tester.insertNode(new Pair("wasd", 1));
// tester.insertNode(new Pair("a", 8));
// tester.insertNode(new Pair("ab", 8));
// tester.insertNode(new Pair("ab", 12));
// tester.insertNode(new Pair("ab", -7));
// tester.insertNode(new Pair("ab", 13));
// tester.insertNode(new Pair("ab", 5));
tester.printPQ();