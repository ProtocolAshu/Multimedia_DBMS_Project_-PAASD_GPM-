// File: tests/search.test.js
// Integration tests for GET /api/search (range + similarTo modes).
//
// DB_STORAGE (see database.js) redirects Sequelize to an in-memory
// SQLite database so the tests never touch the real database.sqlite.
// vi.hoisted runs before the imports below, so the models pick up the
// environment variable when ../database is first required.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.hoisted(() => {
    process.env.DB_STORAGE = ':memory:';
});

import request from 'supertest';
import express from 'express';
import searchRoutes from '../routes/search';
import Music from '../models/music';
import Video from '../models/Video';

// Load the remaining searchable models for their side effects: they
// register with Sequelize, so sequelize.sync() below creates their
// tables. searchService requires them lazily (after sync), which would
// otherwise leave Games/Books/... missing in the fresh in-memory DB.
import '../models/Game';
import '../models/Book';
import '../models/Painting';
import '../models/Article';
import '../models/Newspaper';

const sequelize = Music.sequelize;

let app;

beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/search', searchRoutes);

    await sequelize.sync();

    // Records with hand-computed coordinates (year, rating, priceUSD):
    await Music.bulkCreate([
        { id: 'm1', title: 'Old cheap classic', artist: 'X', audioFile: 'a.mp3', year: 1970, rating: 9, priceUSD: 5 },
        { id: 'm2', title: 'Modern pop', artist: 'Y', audioFile: 'b.mp3', year: 2020, rating: 6, priceUSD: 15 },
        { id: 'm3', title: 'Premium jazz', artist: 'Z', audioFile: 'c.mp3', year: 1995, rating: 8, priceUSD: 40 }
    ]);
    await Video.bulkCreate([
        { id: 'v1', videoTitle: 'Blockbuster', creator: 'C', videoThumbnail: 't.png', videoEmbedCode: '<iframe></iframe>', videoDescription: 'd', releaseYear: 2019, rating: 7, priceUSD: 20 },
        { id: 'v2', videoTitle: 'Indie gem', creator: 'C', videoThumbnail: 't.png', videoEmbedCode: '<iframe></iframe>', videoDescription: 'd', releaseYear: 2005, rating: 8, priceUSD: 10 }
    ]);
});

afterAll(async () => {
    await sequelize.close();
});

describe('GET /api/search (range mode)', () => {
    it('returns records inside the year box', async () => {
        const res = await request(app).get('/api/search').query({ minYear: 1990, maxYear: 2010 });
        expect(res.status).toBe(200);
        expect(res.body.mode).toBe('range');
        const titles = res.body.results.map((r) => r.title).sort();
        // m3 (1995) and v2 (2005) fall in [1990, 2010].
        expect(titles).toEqual(['Indie gem', 'Premium jazz']);
    });

    it('filters by rating bounds', async () => {
        const res = await request(app).get('/api/search').query({ minRating: 8 });
        expect(res.status).toBe(200);
        const titles = res.body.results.map((r) => r.title).sort();
        expect(titles).toEqual(['Indie gem', 'Old cheap classic', 'Premium jazz']);
    });

    it('combines year and price bounds', async () => {
        const res = await request(app)
            .get('/api/search')
            .query({ minYear: 2000, maxPrice: 16 });
        expect(res.status).toBe(200);
        const titles = res.body.results.map((r) => r.title).sort();
        // m2 (2020, $15) and v2 (2005, $10)
        expect(titles).toEqual(['Indie gem', 'Modern pop']);
    });

    it('restricts to a requested type', async () => {
        const res = await request(app).get('/api/search').query({ type: 'video', minYear: 1900 });
        expect(res.status).toBe(200);
        const types = new Set(res.body.results.map((r) => r.type));
        expect([...types]).toEqual(['video']);
    });

    it('400s when no bounds are provided', async () => {
        const res = await request(app).get('/api/search');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/at least one bound/i);
    });

    it('400s on a non-numeric bound', async () => {
        const res = await request(app).get('/api/search').query({ minYear: 'abc' });
        expect(res.status).toBe(400);
    });

    it('400s on an unknown type', async () => {
        const res = await request(app).get('/api/search').query({ type: 'spaceship', minYear: 1900 });
        expect(res.status).toBe(400);
    });
});

describe('GET /api/search (similarTo mode)', () => {
    it('returns k nearest neighbors, excluding the target itself', async () => {
        const res = await request(app).get('/api/search').query({ similarTo: 'm1', k: 2 });
        expect(res.status).toBe(200);
        expect(res.body.mode).toBe('similar');
        expect(res.body.results).toHaveLength(2);
        // m1 = (1970, 9, 5). Euclidean distances:
        //   v2 (2005,8,10): sqrt(1225+1+25)  ≈ 35.4
        //   m3 (1995,8,40): sqrt(625+1+1225)  ≈ 43.6
        //   m2 (2020,6,15): sqrt(2500+9+100)  ≈ 51.1
        //   v1 (2019,7,20): sqrt(2401+4+225)  ≈ 51.3
        // Nearest two: v2 then m3.
        expect(res.body.results.map((r) => r.title)).toEqual(['Indie gem', 'Premium jazz']);
    });

    it('caps k at the number of available records', async () => {
        const res = await request(app).get('/api/search').query({ similarTo: 'm1', k: 50 });
        expect(res.status).toBe(200);
        expect(res.body.results).toHaveLength(4); // 5 records minus the target
    });

    it('404s for an unknown id', async () => {
        const res = await request(app).get('/api/search').query({ similarTo: 'nope', k: 2 });
        expect(res.status).toBe(404);
    });

    it('400s for an invalid k', async () => {
        const res = await request(app).get('/api/search').query({ similarTo: 'm1', k: 'x' });
        expect(res.status).toBe(400);
    });

    it('defaults k to 5 when omitted', async () => {
        const res = await request(app).get('/api/search').query({ similarTo: 'm1' });
        expect(res.status).toBe(200);
        expect(res.body.results.length).toBeLessThanOrEqual(5);
    });
});
