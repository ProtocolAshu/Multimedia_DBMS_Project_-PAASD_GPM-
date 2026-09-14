// File: scripts/benchmark-search.js
// Benchmarks a representative range query using the k-d tree vs a naive
// linear array filter, at N = 1,000 / 10,000 / 100,000 synthetic records.
//
// Run with: npm run benchmark

const KDTree = require('../lib/kdtree');

const SIZES = [1000, 10000, 100000];
const WARMUP_ROUNDS = 3;
const MEASURED_ROUNDS = 10;

// Deterministic PRNG so runs are comparable.
let seed = 42;
function rand() {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
}

/** Synthetic records in the same 3-D space as /api/search. */
function makeRecords(n) {
    const records = [];
    for (let i = 0; i < n; i++) {
        records.push({
            id: i,
            coords: [
                1900 + Math.floor(rand() * 126), // year:  1900-2025
                Math.floor(rand() * 101) / 10,   // rating: 0-10
                Math.floor(rand() * 10000) / 100 // priceUSD: 0-100
            ]
        });
    }
    return records;
}

// A representative range query: a mid-range window that selects roughly
// 1-2% of the data across all three dimensions.
const QUERY = { lo: [1980, 7.0, 20], hi: [1999, 8.0, 30] };

function naiveRangeFilter(records, lo, hi) {
    return records.filter((r) =>
        r.coords.every((c, d) => c >= lo[d] && c <= hi[d])
    );
}

function timeQueryRounds(fn, rounds) {
    // Returns average ms per call. Runs fn `rounds` times.
    const times = [];
    for (let i = 0; i < rounds; i++) {
        const t0 = process.hrtime.bigint();
        const result = fn();
        const t1 = process.hrtime.bigint();
        times.push(Number(t1 - t0) / 1e6);
        if (result === undefined) throw new Error('query returned undefined');
    }
    return times.reduce((a, b) => a + b, 0) / times.length;
}

function fmt(ms) {
    if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`;
    return `${ms.toFixed(3)} ms`;
}

function run() {
    const rows = [];

    for (const n of SIZES) {
        seed = 42; // same data at every N prefix? No — reset gives same sequence per size
        const records = makeRecords(n);
        const points = records.map((r) => ({ id: r.id, coords: r.coords }));

        // Build the tree (excluded from query timings, reported separately).
        const buildT0 = process.hrtime.bigint();
        const tree = new KDTree(3).build(points);
        const buildMs = Number(process.hrtime.bigint() - buildT0) / 1e6;

        // Warmup both paths so JIT compilation is not measured.
        for (let i = 0; i < WARMUP_ROUNDS; i++) {
            tree.rangeQuery(QUERY.lo, QUERY.hi);
            naiveRangeFilter(records, QUERY.lo, QUERY.hi);
        }

        const kdAvg = timeQueryRounds(() => tree.rangeQuery(QUERY.lo, QUERY.hi), MEASURED_ROUNDS);
        const naiveAvg = timeQueryRounds(() => naiveRangeFilter(records, QUERY.lo, QUERY.hi), MEASURED_ROUNDS);

        // Sanity check: both must find the same set of ids.
        const kdIds = tree.rangeQuery(QUERY.lo, QUERY.hi).map((p) => p.id).sort((a, b) => a - b);
        const naiveIds = naiveRangeFilter(records, QUERY.lo, QUERY.hi).map((p) => p.id).sort((a, b) => a - b);
        if (kdIds.length !== naiveIds.length || kdIds.some((v, i) => v !== naiveIds[i])) {
            throw new Error(`Mismatch at N=${n}: k-d tree and naive results differ`);
        }

        rows.push({ n, buildMs, kdAvg, naiveAvg, matches: kdIds.length });
    }

    // Print a markdown table.
    console.log('Range query: 1980 <= year <= 1999, 7.0 <= rating <= 8.0, 20 <= priceUSD <= 30');
    console.log(`Timings are averages over ${MEASURED_ROUNDS} runs after ${WARMUP_ROUNDS} warmup rounds.\n`);
    console.log('| N       | Naive filter | k-d tree query | k-d tree build | Matches | Speedup |');
    console.log('|---------|--------------|----------------|----------------|---------|---------|');
    for (const r of rows) {
        const speedup = r.naiveAvg / r.kdAvg;
        console.log(
            `| ${r.n.toLocaleString()} | ${fmt(r.naiveAvg).padStart(12)} | ${fmt(r.kdAvg).padStart(14)} | ${fmt(r.buildMs).padStart(14)} | ${r.matches} | ${speedup.toFixed(1)}x |`
        );
    }
    console.log('\nNote: build time is a one-off cost per dataset load (see services/searchService.js).');
}

run();
