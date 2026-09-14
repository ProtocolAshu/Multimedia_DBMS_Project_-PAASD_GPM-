// File: controllers/searchController.js
// Request handlers for the multi-attribute search API.

const searchService = require('../services/searchService');

const VALID_TYPES = searchService.SEARCHABLE_TYPES.map((t) => t.type);

/** GET /api/search?minYear=&maxYear=&minRating=&maxRating=&minPrice=&maxPrice=&type= */
async function search(req, res) {
    try {
        const types = parseTypes(req.query.type);
        const { similarTo, k } = req.query;

        if (similarTo !== undefined && similarTo !== '') {
            const kNum = k === undefined || k === '' ? 5 : parseInt(k, 10);
            const results = await searchService.similarSearch(similarTo, kNum, types);
            return res.json({ mode: 'similar', count: results.length, results });
        }

        const results = await searchService.rangeSearch(req.query, types);
        return res.json({ mode: 'range', count: results.length, results });
    } catch (err) {
        const status = err.status || 500;
        if (status >= 500) console.error('Search error:', err);
        return res.status(status).json({ error: err.message });
    }
}

/** Parse ?type=music,video or repeated ?type=music&type=video */
function parseTypes(raw) {
    if (raw === undefined || raw === '') return [];
    const list = Array.isArray(raw) ? raw : String(raw).split(',');
    const cleaned = list.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    for (const t of cleaned) {
        if (!VALID_TYPES.includes(t)) {
            throw Object.assign(new Error(`Unknown type "${t}". Valid: ${VALID_TYPES.join(', ')}`), {
                status: 400
            });
        }
    }
    return cleaned;
}

module.exports = { search };
