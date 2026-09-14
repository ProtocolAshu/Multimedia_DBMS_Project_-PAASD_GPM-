// File: tests/kdtree.test.js
// Unit tests for lib/kdtree.js on small, hand-computed inputs.
import { describe, it, expect } from 'vitest';
import KDTree from '../lib/kdtree';
const { squaredDistance } = KDTree;

const p = (id, coords) => ({ id, coords });

describe('build()', () => {
    it('builds an empty tree from an empty array', () => {
        const tree = new KDTree().build([]);
        expect(tree.size).toBe(0);
        expect(tree.rangeQuery([0, 0, 0], [10, 10, 10])).toEqual([]);
        expect(tree.nearestNeighbors([0, 0, 0], 3)).toEqual([]);
    });

    it('stores all points and reports the correct size', () => {
        const points = [p(1, [1, 2, 3]), p(2, [4, 5, 6]), p(3, [7, 8, 9])];
        const tree = new KDTree().build(points);
        expect(tree.size).toBe(3);
        const all = tree.rangeQuery(
            [-Infinity, -Infinity, -Infinity],
            [Infinity, Infinity, Infinity]
        );
        expect(all).toHaveLength(3);
        expect(all.map((x) => x.id).sort()).toEqual([1, 2, 3]);
    });

    it('produces a balanced tree (height <= floor(log2 n) + 1)', () => {
        const n = 63; // perfectly balanced height for 63 nodes is 6
        const points = [];
        for (let i = 0; i < n; i++) points.push(p(i, [i, (i * 7) % 13, (i * 3) % 5]));
        const tree = new KDTree().build(points);

        const height = (node) => (node === null ? 0 : 1 + Math.max(height(node.left), height(node.right)));
        expect(height(tree.root)).toBeLessThanOrEqual(Math.floor(Math.log2(n)) + 1);
    });

    it('preserves the caller’s array (does not sort in place)', () => {
        const points = [p(1, [5, 5, 5]), p(2, [1, 1, 1]), p(3, [3, 3, 3])];
        const copy = points.slice();
        new KDTree().build(points);
        expect(points).toEqual(copy);
    });

    it('handles duplicate coordinates on the splitting axis', () => {
        const points = [
            p('a', [1, 1, 1]),
            p('b', [1, 2, 2]),
            p('c', [1, 3, 3]),
            p('d', [1, 4, 4])
        ];
        const tree = new KDTree().build(points);
        expect(tree.size).toBe(4);
        const all = tree.rangeQuery([1, 1, 1], [1, 4, 4]);
        expect(all.map((x) => x.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    });
});

describe('insert()', () => {
    it('inserts into an empty tree', () => {
        const tree = new KDTree();
        tree.insert(p(42, [1, 2, 3]));
        expect(tree.size).toBe(1);
        expect(tree.rangeQuery([0, 0, 0], [2, 3, 4])).toEqual([{ id: 42, coords: [1, 2, 3] }]);
    });

    it('inserts multiple points that are all findable', () => {
        const tree = new KDTree().build([p(1, [5, 5, 5])]);
        tree.insert(p(2, [2, 2, 2]));
        tree.insert(p(3, [8, 8, 8]));
        expect(tree.size).toBe(3);
        const all = tree.rangeQuery([0, 0, 0], [10, 10, 10]);
        expect(all.map((x) => x.id).sort()).toEqual([1, 2, 3]);
    });

    it('rejects points with mismatched dimensionality', () => {
        const tree = new KDTree().build([p(1, [1, 2, 3])]);
        expect(() => tree.insert(p(2, [1, 2]))).toThrow(/dims/);
    });
});

describe('rangeQuery()', () => {
    // Hand-computed fixture (3-D):
    //   A (1,1,1)  B (2,2,2)  C (3,3,3)  D (5,5,5)  E (10,10,10)
    const points = [
        p('A', [1, 1, 1]),
        p('B', [2, 2, 2]),
        p('C', [3, 3, 3]),
        p('D', [5, 5, 5]),
        p('E', [10, 10, 10])
    ];

    it('returns exactly the points inside a tight box', () => {
        const tree = new KDTree().build(points);
        // Box [2,3]^3 contains only B and C.
        const got = tree.rangeQuery([2, 2, 2], [3, 3, 3]).map((x) => x.id).sort();
        expect(got).toEqual(['B', 'C']);
    });

    it('returns a single point when the box collapses onto it', () => {
        const tree = new KDTree().build(points);
        expect(tree.rangeQuery([5, 5, 5], [5, 5, 5]).map((x) => x.id)).toEqual(['D']);
    });

    it('returns nothing for a disjoint box', () => {
        const tree = new KDTree().build(points);
        expect(tree.rangeQuery([6, 6, 6], [9, 9, 9])).toEqual([]);
    });

    it('includes boundary values (inclusive bounds)', () => {
        const tree = new KDTree().build(points);
        const got = tree.rangeQuery([1, 1, 1], [3, 3, 3]).map((x) => x.id).sort();
        expect(got).toEqual(['A', 'B', 'C']);
    });

    it('treats undefined bounds as unbounded', () => {
        const tree = new KDTree().build(points);
        // Only constrain the first axis to <= 3.
        const got = tree.rangeQuery([undefined, undefined, undefined], [3, undefined, undefined]);
        expect(got.map((x) => x.id).sort()).toEqual(['A', 'B', 'C']);
    });

    it('matches a brute-force filter on randomized inputs', () => {
        let seed = 12345;
        const rand = () => {
            // Deterministic LCG so failures are reproducible.
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const pts = [];
        for (let i = 0; i < 500; i++) {
            pts.push(p(i, [Math.floor(rand() * 100), Math.floor(rand() * 100), Math.floor(rand() * 100)]));
        }
        const tree = new KDTree().build(pts);
        for (let trial = 0; trial < 50; trial++) {
            const lo = [0, 0, 0].map(() => Math.floor(rand() * 60));
            const hi = [0, 0, 0].map(() => 40 + Math.floor(rand() * 60));
            const expected = pts
                .filter((q) => q.coords.every((c, d) => c >= lo[d] && c <= hi[d]))
                .map((q) => q.id)
                .sort();
            const got = tree.rangeQuery(lo, hi).map((q) => q.id).sort();
            expect(got).toEqual(expected);
        }
    });
});

describe('nearestNeighbors()', () => {
    const points = [
        p('A', [0, 0, 0]),
        p('B', [3, 0, 0]),   // dist^2 to origin = 9
        p('C', [0, 4, 0]),   // dist^2 = 16
        p('D', [1, 1, 1]),   // dist^2 = 3
        p('E', [10, 10, 10]) // dist^2 = 300
    ];

    it('returns the single nearest point', () => {
        const tree = new KDTree().build(points);
        // To [1,1,0]: D(1) < A(2) < B(5)
        expect(tree.nearestNeighbors([1, 1, 0], 1).map((x) => x.id)).toEqual(['D']);
    });

    it('returns k nearest in ascending distance order (hand-computed)', () => {
        const tree = new KDTree().build(points);
        // To origin: A(0) < D(3) < B(9) < C(16) < E(300)
        expect(tree.nearestNeighbors([0, 0, 0], 3).map((x) => x.id)).toEqual(['A', 'D', 'B']);
    });

    it('excludes nothing when k exceeds the tree size', () => {
        const tree = new KDTree().build(points);
        const got = tree.nearestNeighbors([0, 0, 0], 10);
        expect(got).toHaveLength(5);
        expect(got.map((x) => x.id)).toEqual(['A', 'D', 'B', 'C', 'E']);
    });

    it('returns [] for k = 0', () => {
        const tree = new KDTree().build(points);
        expect(tree.nearestNeighbors([0, 0, 0], 0)).toEqual([]);
    });

    it('finds a target that is itself in the tree (distance 0 first)', () => {
        const tree = new KDTree().build(points);
        const got = tree.nearestNeighbors([3, 0, 0], 2).map((x) => x.id);
        expect(got[0]).toBe('B');
    });

    it('matches brute-force kNN on randomized inputs', () => {
        let seed = 999;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const pts = [];
        for (let i = 0; i < 500; i++) {
            pts.push(p(i, [Math.floor(rand() * 100), Math.floor(rand() * 100), Math.floor(rand() * 100)]));
        }
        const tree = new KDTree().build(pts);
        for (let trial = 0; trial < 50; trial++) {
            const target = [rand() * 100, rand() * 100, rand() * 100];
            const k = 1 + Math.floor(rand() * 10);
            const got = tree.nearestNeighbors(target, k);
            const expected = pts
                .slice()
                .sort(
                    (a, b) =>
                        squaredDistance(target, a.coords) - squaredDistance(target, b.coords)
                )
                .slice(0, k);
            expect(got.map((x) => x.id)).toEqual(expected.map((x) => x.id));
        }
    });
});
