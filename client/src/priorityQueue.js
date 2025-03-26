import { Pair } from "./Trie.js";

/**
 * A min-heap-based priority queue that stores Pair objects.
 * It maintains only the top results (highest frequency) up to a specified maxSize.
 */
export default class PriorityQueue {
    /** @type {Pair[]} */
    heap;
    /** @type {number} Maximum number of elements to retain */
    maxSize;
    /** @type {number} Current number of elements in the heap */
    n;

    /**
     * Create a new PriorityQueue.
     * @param {number} maxSize - The maximum number of top results to keep.
     */
    constructor(maxSize) {
        this.heap = [];
        this.maxSize = maxSize;
        this.n = 0;
        for (let i = 0; i <= maxSize + 1; i++) {
            this.heap.push(new Pair("", 0));
        }
    }

    /**
     * Insert a Pair into the priority queue.
     * Maintains the heap invariant and removes the smallest element if necessary.
     * @param {Pair} pair - The pair to insert.
     */
    insert(pair) {
        this.heap[++this.n] = pair;
        this._swim(this.n);
        if (this.n > this.maxSize) {
            this._deleteMin();
        }
    }

    /**
     * Remove the minimum (lowest frequency) element from the heap.
     * Called internally to maintain maxSize.
     * @private
     */
    _deleteMin() {
        this._swap(1, this.n--);
        this._sink(1);
        this.heap[this.n + 1] = new Pair("", 0);
    }

    /**
     * Swim the element at index k up the heap to restore heap order.
     * @param {number} k - Index of the element to swim.
     * @private
     */
    _swim(k) {
        while (k > 1 && this._greater(this.heap[Math.floor(k / 2)], this.heap[k])) {
            this._swap(Math.floor(k / 2), k);
            k = Math.floor(k / 2);
        }
    }

    /**
     * Sink the element at index k down the heap to restore heap order.
     * @param {number} k - Index of the element to sink.
     * @private
     */
    _sink(k) {
        while (2 * k <= this.n) {
            let j = 2 * k;
            if (j < this.n && this._greater(this.heap[j], this.heap[j + 1])) {
                j++;
            }
            if (!this._greater(this.heap[k], this.heap[j])) {
                break;
            }
            this._swap(k, j);
            k = j;
        }
    }

    /**
     * Compare two Pair objects by frequency.
     * @param {Pair} p1 - The first pair.
     * @param {Pair} p2 - The second pair.
     * @returns {boolean} True if p1 has a higher frequency than p2.
     * @private
     */
    _greater(p1, p2) {
        if (p1.freq > p2.freq) {
            return true;
        }
        return false;
    }

    /**
     * Swap two elements in the heap.
     * @param {number} idx1 - Index of the first element.
     * @param {number} idx2 - Index of the second element.
     * @private
     */
    _swap(idx1, idx2) {
        const temp = this.heap[idx1];
        this.heap[idx1] = this.heap[idx2];
        this.heap[idx2] = temp;
    }

    /**
     * Retrieve the top results stored in the priority queue.
     * @returns {Pair[]} Array of Pair objects representing the top results.
     */
    getTopResults() {
        const result = this.heap.slice(1, this.n + 1);
        return result;
    }
}