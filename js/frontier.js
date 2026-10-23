/*
 * frontier.js
 * -----------
 * The three open-list data structures used by the searches:
 *   Stack         - last in, first out   (DFS, DLS, IDDLS)
 *   Queue         - first in, first out  (BFS)
 *   PriorityQueue - smallest key first   (UCS, GBFS, A*)
 * Every structure exposes add(), take(), size and peek(k) (the next k items
 * that would be taken, used only for drawing the open list).
 *
 * Bowri Setty Jaswanth · 24BDS0071
 */
var Frontier = (function () {
  "use strict";

  function Stack() {
    this.items = [];
  }
  Stack.prototype.add = function (x) {
    this.items.push(x);
  };
  Stack.prototype.take = function () {
    return this.items.pop();
  };
  Object.defineProperty(Stack.prototype, "size", {
    get: function () {
      return this.items.length;
    },
  });
  Stack.prototype.peek = function (k) {
    return this.items.slice(Math.max(0, this.items.length - k)).reverse();
  };

  function Queue() {
    this.items = [];
    this.front = 0;
  }
  Queue.prototype.add = function (x) {
    this.items.push(x);
  };
  Queue.prototype.take = function () {
    var x = this.items[this.front];
    this.items[this.front] = undefined;
    this.front++;
    if (this.front > 5000 && this.front > this.items.length / 2) {
      this.items = this.items.slice(this.front);
      this.front = 0;
    }
    return x;
  };
  Object.defineProperty(Queue.prototype, "size", {
    get: function () {
      return this.items.length - this.front;
    },
  });
  Queue.prototype.peek = function (k) {
    return this.items.slice(this.front, this.front + k);
  };

  /** Binary heap. `before(a, b)` returns true when a should come out before b. */
  function PriorityQueue(before) {
    this.heap = [];
    this.before = before;
  }
  PriorityQueue.prototype.add = function (x) {
    var h = this.heap;
    var i = h.length;
    h.push(x);
    while (i > 0) {
      var parent = (i - 1) >> 1;
      if (!this.before(h[i], h[parent])) break;
      var t = h[i];
      h[i] = h[parent];
      h[parent] = t;
      i = parent;
    }
  };
  PriorityQueue.prototype.take = function () {
    var h = this.heap;
    var best = h[0];
    var last = h.pop();
    if (h.length) {
      h[0] = last;
      var i = 0;
      for (;;) {
        var l = 2 * i + 1;
        var r = l + 1;
        var m = i;
        if (l < h.length && this.before(h[l], h[m])) m = l;
        if (r < h.length && this.before(h[r], h[m])) m = r;
        if (m === i) break;
        var t = h[i];
        h[i] = h[m];
        h[m] = t;
        i = m;
      }
    }
    return best;
  };
  Object.defineProperty(PriorityQueue.prototype, "size", {
    get: function () {
      return this.heap.length;
    },
  });
  PriorityQueue.prototype.peek = function (k) {
    var self = this;
    // The best items always sit in the first few heap levels.
    return this.heap
      .slice(0, 63)
      .sort(function (a, b) {
        return self.before(a, b) ? -1 : self.before(b, a) ? 1 : 0;
      })
      .slice(0, k);
  };

  return { Stack: Stack, Queue: Queue, PriorityQueue: PriorityQueue };
})();

if (typeof module !== "undefined") module.exports = Frontier;
