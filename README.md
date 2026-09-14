# The Multimedia Store

Data Modelling and Multimedia Databases' final project — a web application for
storing, browsing, and managing multimedia content of seven types:

| Type | Upload page | List page |
|---|---|---|
| Books | `/form.html` | `/book-list.html` |
| Videos | `/videos-form.html` | `/video-list.html` |
| Games | `/game-form.html` | `/game-list.html` |
| Paintings | `/painting-form.html` | `/painting-list.html` |
| Articles | `/article-form.html` | `/article-list.html` |
| Newspapers | `/newspaper-form.html` | `/newspaper-list.html` |
| Music | `/music-form.html` | `/music-list.html` |

## Tech stack

- **Backend:** Node.js + Express
- **Database:** SQLite via Sequelize ORM (`database.sqlite`)
- **File uploads:** Multer (images, PDFs, audio stored in `uploads/`)
- **Auth:** JWT with bcrypt password hashing; roles (`admin`/`client`) and
  security-question-based password recovery
- **Search:** multi-attribute k-d tree over (year, rating, priceUSD) —
  `lib/kdtree.js`, served at `/api/search`

Each uploaded item gets a static detail page generated into
`public/<type>/` (e.g. `public/books/book_1743613528327.html`) and a row in the
database.

## Running

```bash
npm install
npm start          # serves on http://localhost:3000
# or on another port:
PORT=3030 npm start
```

On first run, Sequelize creates any missing tables and (if needed) migrates an
older `database.sqlite` by adding the `Music.htmlLink` column and the
search columns (`rating`, `priceUSD`, and per-type year fields).

## Tests and benchmark

```bash
npm test           # vitest unit + integration tests (k-d tree, /api/search)
npm run benchmark  # k-d tree vs naive linear filter at N = 1k / 10k / 100k
```

## Multi-attribute search API

`GET /api/search` projects every record of every content type into a
3-D point (year, rating, priceUSD) and answers queries with a k-d tree
(`lib/kdtree.js`).

**Range mode** — all records inside a bounding box. Any combination of
bounds; at least one is required:

```
GET /api/search?minYear=1990&maxYear=2010&minRating=8&maxPrice=25
GET /api/search?type=music,video&minPrice=10
```

**Similarity mode** — the k nearest neighbors of a record by Euclidean
distance in (year, rating, priceUSD) space:

```
GET /api/search?similarTo=<id>&k=5          # k defaults to 5, max 100
```

Records missing a numeric attribute fall back to neutral defaults
(year 1900, rating 5, $20) so they still participate in the space. Results
include `type`, `id`, `title`, and the record's `coords`.

## Project layout

```
server.js              Express app entry point: middleware, route mounting
database.js            Sequelize connection (SQLite)
routes/                URL wiring (one file per content area, + search, auth)
controllers/           Request handlers
services/              Business logic: page generators, search, upload storage
lib/kdtree.js          Framework-free k-d tree (range + k-nearest-neighbor)
lib/searchAttributes.js  Shared search column definitions
models/                Sequelize models (User, Book, Video, Game, Article,
                       Newspaper, Painting, Music, ContactMessage)
tests/                 vitest suites (k-d tree unit, /api/search integration)
scripts/               benchmark-search.js (k-d tree vs naive filter)
public/                Front-end pages (Bootstrap) + generated detail pages
uploads/               Uploaded media files
```

## Notes

- `JWT_SECRET` environment variable overrides the default token-signing key
  when deploying beyond local development.
