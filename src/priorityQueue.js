import { Pair } from "./Trie.js";

export class PriorityQueue {
    heap;
    maxSize;
    n;

    constructor(maxSize) {
        this.heap = [];
        this.maxSize = maxSize;
        this.n = 0; 
        for (let i = 0; i <= maxSize + 1; i++) {
            this.heap.push(new Pair("",0));
        }
    }

    insert(pair) {
        this.heap[++this.n] = pair;
        this._swim(this.n);
        if (this.n > this.maxSize) {
            this._deleteMin();
        }
    }

    _deleteMin() {
        this._swap(1, this.n--);
        this._sink(1);
        this.heap[this.n + 1] = new Pair("", 0);
    }

    _swim(k) {
        while (k > 1 && this._greater(this.heap[Math.floor(k / 2)], this.heap[k])) {
            this._swap(Math.floor(k/2), k);
            k = Math.floor(k / 2);
        }
    }

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

    _greater(p1, p2) {
        if (p1.freq > p2.freq) {
            return true;
        }
        return false;
    }

    _swap(idx1, idx2) {
        const temp = this.heap[idx1];
        this.heap[idx1] = this.heap[idx2];
        this.heap[idx2] = temp;
    }

    getTopResults() {
        const result = this.heap.slice(1, this.n + 1);
        return result;
    }
}