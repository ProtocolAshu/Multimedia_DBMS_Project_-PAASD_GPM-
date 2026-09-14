// File: services/searchService.js
// Multi-attribute search service: loads records via Sequelize models,
// projects them into 3-D points (year, rating, priceUSD), and answers
// range / k-nearest-neighbor queries with the k-d tree from lib/kdtree.js.

const KDTree = require('../lib/kdtree');
const { YEAR_SOURCE_FIELDS } = require('../lib/searchAttributes');

// Searchable content types, in a stable order. `model` is resolved lazily
// so requiring this service never triggers Sequelize connections at import
// time (keeps unit tests and the benchmark script lightweight).
const SEARCHABLE_TYPES = [
    { type: 'music', model: () => require('../models/music') },
    { type: 'video', model: () => require('../models/Video') },
    { type: 'game', model: () => require('../models/Game') },
    { type: 'book', model: () => require('../models/Book') },
    { type: 'painting', model: () => require('../models/Painting') },
    { type: 'article', model: () => require('../models/Article') },
    { type: 'newspaper', model: () => require('../models/Newspaper') }
];

const DIMENSIONS = ['year', 'rating', 'priceUSD'];

// Query-parameter suffix for each dimension. The public API uses
// minPrice/maxPrice (not minPriceUSD), so the suffix cannot be derived
// from the dimension name alone.
const BOUND_KEY_SUFFIX = {
    year: 'Year',
    rating: 'Rating',
    priceUSD: 'Price'
};

// Sensible fallbacks for records missing a numeric attribute, so every
// record still participates in the 3-D space.
const DEFAULTS = { year: 1900, rating: 5, priceUSD: 20 };

function parseNumber(value) {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
    return Number.isFinite(n) ? n : null;
}

/**
 * Extract the [year, rating, priceUSD] coordinate for a record.
 * Year comes from each model's native year-ish field (see
 * lib/searchAttributes.js); rating/priceUSD are dedicated columns.
 */
function recordToCoords(record, modelName) {
    const yearField = YEAR_SOURCE_FIELDS[modelName];
    return [
        parseNumber(record.get ? record.get(yearField) : record[yearField]) ?? DEFAULTS.year,
        parseNumber(record.get ? record.get('rating') : record.rating) ?? DEFAULTS.rating,
        parseNumber(record.get ? record.get('priceUSD') : record.priceUSD) ?? DEFAULTS.priceUSD
    ];
}

/** Convert a Sequelize instance into a serializable search result. */
function toResult(record, type) {
    const raw = record.get ? record.get() : record;
    return {
        type,
        id: raw.id,
        title:
            raw.title ||
            raw.bookName ||
            raw.gameName ||
            raw.paintingName ||
            raw.videoTitle ||
            raw.name ||
            raw.id,
        coords: {
            year: raw.year ?? raw.releaseYear ?? raw.publicationYear ?? raw.yearCreated ?? raw.publishYear ?? null,
            rating: raw.rating ?? null,
            priceUSD: raw.priceUSD ?? null
        }
    };
}

/**
 * Load all searchable records and build a k-d tree over them.
 * @param {string[]} [types] subset of SEARCHABLE_TYPES types to include
 */
async function buildSearchIndex(types) {
    const selected = SEARCHABLE_TYPES.filter(
        (t) => !types || types.length === 0 || types.includes(t.type)
    );

    const points = [];
    const recordsByType = new Map();
    for (const entry of selected) {
        const Model = entry.model();
        const modelName = Model.name;
        const rows = await Model.findAll();
        recordsByType.set(entry.type, rows);
        for (const row of rows) {
            points.push({
                id: `${entry.type}:${row.id}`,
                coords: recordToCoords(row, modelName)
            });
        }
    }

    const tree = new KDTree(DIMENSIONS.length);
    tree.build(points);
    return { tree, recordsByType };
}

/** Parse and validate a min/max bound pair from query params. */
function parseBounds(query) {
    const bounds = {};
    for (const dim of DIMENSIONS) {
        for (const side of ['min', 'max']) {
            const key = side + BOUND_KEY_SUFFIX[dim];
            const raw = query[key];
            if (raw === undefined || raw === '') continue;
            const value = parseFloat(raw);
            if (!Number.isFinite(value)) {
                throw Object.assign(new Error(`${key} must be a number`), { status: 400 });
            }
            bounds[key] = value;
        }
    }
    return bounds;
}

/**
 * Range search: all records whose (year, rating, priceUSD) fall inside the
 * requested bounding box.
 */
async function rangeSearch(query, types) {
    const { tree, recordsByType } = await buildSearchIndex(types);
    const bounds = parseBounds(query);
    if (Object.keys(bounds).length === 0) {
        throw Object.assign(
            new Error('Provide at least one bound (e.g. minYear, maxRating, minPrice)'),
            { status: 400 }
        );
    }

    const lo = DIMENSIONS.map((d) => bounds['min' + BOUND_KEY_SUFFIX[d]]);
    const hi = DIMENSIONS.map((d) => bounds['max' + BOUND_KEY_SUFFIX[d]]);
    const matches = tree.rangeQuery(lo, hi);

    return hydrateResults(matches, recordsByType, bounds);
}

/**
 * Similarity search: k records nearest to the record with the given id.
 */
async function similarSearch(id, k, types) {
    if (!Number.isFinite(k) || k < 1 || k > 100) {
        throw Object.assign(new Error('k must be an integer between 1 and 100'), { status: 400 });
    }
    const { tree, recordsByType } = await buildSearchIndex(types);
    k = Math.min(k, tree.size);

    // "type:id" composite keys make ids unique across content types.
    let target = null;
    let targetType = null;
    for (const entry of SEARCHABLE_TYPES) {
        if (types && types.length > 0 && !types.includes(entry.type)) continue;
        if (tree.size === 0) break;
        const rows = recordsByType.get(entry.type) || [];
        if (rows.some((r) => String(r.id) === String(id))) {
            target = `${entry.type}:${id}`;
            targetType = entry.type;
            break;
        }
    }
    if (target === null) {
        throw Object.assign(new Error(`No searchable record with id ${id}`), { status: 404 });
    }

    const targetPoint = findPoint(tree, target);
    const neighbors = tree.nearestNeighbors(targetPoint.coords, k + 1); // +1: skip self
    const results = neighbors
        .filter((pt) => pt.id !== target)
        .slice(0, k)
        .map((pt) => {
            const [type, ...rest] = pt.id.split(':');
            const recordId = rest.join(':');
            return hydrateOne(type, recordId, recordsByType, null);
        })
        .filter(Boolean);
    return results;
}

// --- helpers --------------------------------------------------------------

function findPoint(tree, id) {
    // Points array is not retained, so recover the point via a full-range
    // query and filter. Only used once per similarTo request.
    const all = tree.rangeQuery([], []);
    return all.find((pt) => pt.id === id);
}

function hydrateResults(matches, recordsByType, bounds) {
    const results = [];
    for (const pt of matches) {
        const [type, ...rest] = pt.id.split(':');
        const recordId = rest.join(':');
        const rec = hydrateOne(type, recordId, recordsByType, bounds);
        if (rec) results.push(rec);
    }
    return results;
}

function hydrateOne(type, recordId, recordsByType, _bounds) {
    const rows = recordsByType.get(type);
    if (!rows) return null;
    const row = rows.find((r) => String(r.id) === String(recordId));
    if (!row) return null;
    return toResult(row, type);
}

module.exports = {
    DIMENSIONS,
    SEARCHABLE_TYPES,
    buildSearchIndex,
    rangeSearch,
    similarSearch,
    recordToCoords,
    toResult,
    parseBounds
};
