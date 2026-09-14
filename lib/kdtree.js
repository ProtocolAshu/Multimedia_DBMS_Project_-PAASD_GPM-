// File: lib/kdtree.js
// A standalone k-d tree for multi-dimensional numeric search.
// Framework-free: no Express, Sequelize, or other imports — plain JavaScript.

/**
 * A k-d tree over points of the form { id, coords: number[] }.
 *
 * The tree is binary, with each level splitting on one coordinate
 * (axis = depth % k). build() produces a balanced tree by choosing the
 * median point along the splitting axis.
 */
class KDTree {
    /**
     * @param {number} [k=3] dimensionality of the coordinate vectors.
     *        Derived automatically from the first point passed to build()
     *        or insert() when omitted.
     */
    constructor(k = 3) {
        this.k = k;
        this.root = null;
        this.size = 0;
    }

    /**
     * Build a balanced tree from an array of points, replacing any
     * existing contents. Returns `this` for chaining.
     * @param {Array<{id: *, coords: number[]}>} points
     */
    build(points) {
        this.root = null;
        this.size = 0;
        if (!Array.isArray(points) || points.length === 0) {
            return this;
        }
        this.k = points[0].coords.length;
        const pts = points.slice(); // do not mutate the caller's array
        this.root = this._buildRec(pts, 0);
        this.size = points.length;
        return this;
    }

    /** Internal recursive builder: splits on the median of each axis. */
    _buildRec(points, depth) {
        if (points.length === 0) return null;

        const axis = depth % this.k;
        points.sort((a, b) => a.coords[axis] - b.coords[axis]);
        const mid = points.length >> 1;

        // Always split at the median so the tree stays balanced. Points
        // equal to the node on the splitting axis may end up on either
        // side; all queries use inclusive comparisons, so that is safe.
        const node = {
            point: points[mid],
            left: this._buildRec(points.slice(0, mid), depth + 1),
            right: this._buildRec(points.slice(mid + 1), depth + 1)
        };
        return node;
    }

    /**
     * Insert a single point into the tree (O(log n) on balanced input).
     * @param {{id: *, coords: number[]}} point
     */
    insert(point) {
        if (!point || !Array.isArray(point.coords) || point.coords.length === 0) {
            throw new TypeError('insert expects { id, coords: number[] }');
        }
        if (this.size === 0) this.k = point.coords.length;
        if (point.coords.length !== this.k) {
            throw new Error(`point has ${point.coords.length} dims, tree has ${this.k}`);
        }
        this.root = this._insertRec(this.root, point, 0);
        this.size++;
    }

    _insertRec(node, point, depth) {
        if (node === null) {
            return { point, left: null, right: null };
        }
        const axis = depth % this.k;
        if (point.coords[axis] < node.point.coords[axis]) {
            node.left = this._insertRec(node.left, point, depth + 1);
        } else {
            node.right = this._insertRec(node.right, point, depth + 1);
        }
        return node;
    }

    /**
     * All points with minBounds[d] <= coords[d] <= maxBounds[d] for every d.
     * Bounds entries may be undefined/-Infinity/+Infinity to leave a
     * dimension unconstrained.
     * @param {number[]} minBounds
     * @param {number[]} maxBounds
     * @returns {Array<{id: *, coords: number[]}>}
     */
    rangeQuery(minBounds, maxBounds) {
        const results = [];
        const lo = this._normalizeBounds(minBounds, -Infinity);
        const hi = this._normalizeBounds(maxBounds, Infinity);
        this._rangeRec(this.root, lo, hi, 0, results);
        return results;
    }

    _rangeRec(node, lo, hi, depth, results) {
        if (node === null) return;
        const p = node.point.coords;

        if (this._inside(p, lo, hi)) {
            results.push(node.point);
        }

        const axis = depth % this.k;
        // Left subtree can only contain matches if this node's axis value
        // is above the lower bound.
        if (lo[axis] <= p[axis]) {
            this._rangeRec(node.left, lo, hi, depth + 1, results);
        }
        if (p[axis] <= hi[axis]) {
            this._rangeRec(node.right, lo, hi, depth + 1, results);
        }
    }

    _inside(coords, lo, hi) {
        for (let d = 0; d < this.k; d++) {
            if (coords[d] < lo[d] || coords[d] > hi[d]) return false;
        }
        return true;
    }

    _normalizeBounds(bounds, fallback) {
        const out = [];
        for (let d = 0; d < this.k; d++) {
            const v = bounds ? bounds[d] : undefined;
            out.push(typeof v === 'number' && Number.isFinite(v) ? v : fallback);
        }
        return out;
    }

    /**
     * The k points nearest to `target` by Euclidean distance, sorted
     * nearest-first. Ties are broken arbitrarily (first-found wins).
     * @param {number[]} target
     * @param {number} k
     * @returns {Array<{id: *, coords: number[]}>}
     */
    nearestNeighbors(target, k) {
        if (k <= 0) return [];
        if (!Array.isArray(target) || target.length !== this.k) {
            throw new Error(`target has ${target ? target.length : 'no'} dims, tree has ${this.k}`);
        }

        // Max-heap of { point, dist } implemented as an array, size <= k.
        const heap = [];

        const consider = (point) => {
            const dist = squaredDistance(target, point.coords);
            if (heap.length < k) {
                heapPush(heap, { point, dist });
            } else if (dist < heap[0].dist) {
                heap[0] = { point, dist };
                siftDown(heap, 0);
            }
        };

        const visit = (node, depth) => {
            if (node === null) return;
            consider(node.point);
            const axis = depth % this.k;
            const diff = target[axis] - node.point.coords[axis];
            const near = diff < 0 ? node.left : node.right;
            const far = diff < 0 ? node.right : node.left;
            visit(near, depth + 1);
            // Only descend the far side if it could be closer than the
            // current k-th best (axis distance alone is a lower bound).
            if (diff * diff < heap[0].dist || heap.length < k) {
                visit(far, depth + 1);
            }
        };
        visit(this.root, 0);

        return heap
            .slice()
            .sort((a, b) => a.dist - b.dist)
            .map((entry) => entry.point);
    }
}

/** Squared Euclidean distance (avoids a sqrt per comparison). */
function squaredDistance(a, b) {
    let sum = 0;
    for (let d = 0; d < a.length; d++) {
        const diff = a[d] - b[d];
        sum += diff * diff;
    }
    return sum;
}

// --- small max-heap helpers for the kNN candidate list -------------------

function heapPush(heap, entry) {
    heap.push(entry);
    let i = heap.length - 1;
    while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heap[parent].dist >= heap[i].dist) break;
        [heap[parent], heap[i]] = [heap[i], heap[parent]];
        i = parent;
    }
}

function siftDown(heap, i) {
    const n = heap.length;
    while (true) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let largest = i;
        if (l < n && heap[l].dist > heap[largest].dist) largest = l;
        if (r < n && heap[r].dist > heap[largest].dist) largest = r;
        if (largest === i) break;
        [heap[i], heap[largest]] = [heap[largest], heap[i]];
        i = largest;
    }
}

module.exports = KDTree;
module.exports.squaredDistance = squaredDistance;
