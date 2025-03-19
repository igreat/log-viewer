import PriorityQueue from "../src/PriorityQueue";
import { Pair } from "../src/Trie";

describe("PriorityQueue", () => {
    let pq;
    const maxSize = 3;

    beforeEach(() => {
        pq = new PriorityQueue(maxSize);
    });

    test("initializes with an empty queue (n = 0)", () => {
        expect(pq.n).toBe(0);
        // The heap array is pre-filled with dummy Pair objects,
        // but only elements from index 1 to n are considered valid.
        expect(pq.getTopResults()).toEqual([]);
    });

    test("inserts elements without exceeding maxSize", () => {
        const pair1 = new Pair("apple", 5);
        const pair2 = new Pair("banana", 3);
        const pair3 = new Pair("cherry", 8);

        pq.insert(pair1);
        pq.insert(pair2);
        pq.insert(pair3);

        expect(pq.n).toBe(maxSize);
        const results = pq.getTopResults();
        // All inserted pairs should be in the queue
        expect(results).toContainEqual(pair1);
        expect(results).toContainEqual(pair2);
        expect(results).toContainEqual(pair3);
    });

    test("inserts extra element and removes the smallest frequency pair", () => {
        const pair1 = new Pair("apple", 5);
        const pair2 = new Pair("banana", 3);
        const pair3 = new Pair("cherry", 8);

        // Fill the priority queue to maxSize
        [pair1, pair2, pair3].forEach(pair => pq.insert(pair));
        expect(pq.n).toBe(maxSize);

        // Now, insert a new pair with frequency 7
        const newPair = new Pair("date", 7);
        pq.insert(newPair);

        // Because capacity is 3, one element should be removed.
        // The element with the smallest frequency is "banana" (freq: 3).
        expect(pq.n).toBe(maxSize);
        const results = pq.getTopResults();

        // The remaining pairs should be "apple" (5), "cherry" (8) and "date" (7)
        expect(results).toContainEqual(pair1);
        expect(results).toContainEqual(pair3);
        expect(results).toContainEqual(newPair);

        // Ensure that "banana" was removed.
        const bananaPresent = results.some(
            pair => pair.word === "banana" && pair.freq === 3
        );
        expect(bananaPresent).toBe(false);
    });

    test("inserts element with lower frequency than current minimum and gets removed", () => {
        // Insert higher frequency pairs
        pq.insert(new Pair("a", 50));
        pq.insert(new Pair("b", 60));
        pq.insert(new Pair("c", 70));
        expect(pq.n).toBe(maxSize);

        // Insert a pair with a much lower frequency
        const lowPair = new Pair("d", 10);
        pq.insert(lowPair);

        // Since lowPair is the smallest, it should be removed immediately.
        expect(pq.n).toBe(maxSize);
        const results = pq.getTopResults();
        const words = results.map(pair => pair.word);
        expect(words).not.toContain("d");
    });

    test("maintains proper ordering for internal heap operations", () => {
        // Insert elements out of order
        pq.insert(new Pair("one", 10));
        pq.insert(new Pair("two", 20));
        pq.insert(new Pair("three", 5));
        // The PQ should now have the three inserted elements.
        // Insert a new element that should cause the smallest element (freq: 5) to be removed.
        pq.insert(new Pair("four", 15));

        expect(pq.n).toBe(maxSize);
        const results = pq.getTopResults();
        const frequencies = results.map(pair => pair.freq);
        // The smallest frequency (5) should not be present.
        expect(frequencies).not.toContain(5);
        // The remaining frequencies should be 10, 15, and 20.
        expect(frequencies.sort((a, b) => a - b)).toEqual([10, 15, 20]);
    });
});