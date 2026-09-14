// File: scripts/refactor-server.js
// One-off mechanical refactor: splits the monolithic server.js into
// routes/, controllers/, and services/ by extracting exact line ranges.
// Run once, then delete. Aborts loudly if any range does not start with
// the expected code (guards against line drift).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const lines = src.split('\n');

/** Inclusive 1-indexed line range, with an assertion on the first line. */
function grab(a, b, expectStart) {
    const chunk = lines.slice(a - 1, b).join('\n');
    const firstNonEmpty = chunk.trimStart().split('\n')[0];
    if (expectStart && !firstNonEmpty.startsWith(expectStart)) {
        throw new Error(`Range ${a}-${b}: expected "${expectStart}", got "${firstNonEmpty}"`);
    }
    return chunk;
}

/**
 * Convert an `app.METHOD('path', <middleware>, async (req, res) => {...});`
 * block into `const name = async (req, res) => {...};` (middleware moves to
 * the route file).
 */
function toHandler(a, b, name, expectStart) {
    let code = grab(a, b, expectStart).trim();
    let idx = code.indexOf('async (req, res) =>');
    if (idx === -1) idx = code.indexOf('(req, res) =>');
    if (idx === -1) throw new Error(`Handler ${name}: could not find arrow head`);
    if (!code.endsWith('});')) throw new Error(`Handler ${name}: does not end with });`);
    code = 'const ' + name + ' = ' + code.slice(idx);
    code = code.replace(/\}\);\s*$/, '};');
    // Handlers now live in controllers/ — repoint paths that were
    // relative to the old server.js location.
    code = code.replace(/path\.join\(__dirname, 'public'/g, "path.join(__dirname, '..', 'public'");
    return code;
}

function write(rel, content) {
    const file = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content.replace(/\n{3,}/g, '\n\n') + '\n');
    console.log('wrote', rel);
}

// ---------------------------------------------------------------------------
// 1. services/pageGenerators.js — the seven generate*Page functions
// ---------------------------------------------------------------------------
write('services/pageGenerators.js', `
// File: services/pageGenerators.js
// Static HTML detail-page generators for each content type (verbatim from
// the original server.js).

${grab(606, 864, 'function generateBookPage')}

${grab(867, 1105, 'function generateVideoPage')}

${grab(1108, 1364, 'function generateGamePage')}

${grab(1449, 1796, 'function generatePaintingPage')}

${grab(1905, 2123, 'function generateArticlePage')}

${grab(2151, 2421, 'function generateNewspaperPage')}

${grab(2502, 2712, 'function generateMusicPage')}

module.exports = {
    generateBookPage,
    generateVideoPage,
    generateGamePage,
    generatePaintingPage,
    generateArticlePage,
    generateNewspaperPage,
    generateMusicPage
};
`);

// ---------------------------------------------------------------------------
// 2. services/uploadMiddleware.js — multer configurations
// ---------------------------------------------------------------------------
write('services/uploadMiddleware.js', `
// File: services/uploadMiddleware.js
// Multer storage configuration for general uploads and newspaper uploads.

const multer = require('multer');
const path = require('path');
const fs = require('fs');

${grab(78, 91, 'const storage = multer.diskStorage').replace(/path\.join\(__dirname, 'uploads'/g, "path.join(__dirname, '..', 'uploads'")}

${grab(2126, 2148, 'const newspaperStorage = multer.diskStorage').replace(/path\.join\(__dirname, 'uploads', 'newspapers'\)/g, "path.join(__dirname, '..', 'uploads', 'newspapers')")}

module.exports = { upload, newspaperUpload };
`);

// ---------------------------------------------------------------------------
// 3. controllers
// ---------------------------------------------------------------------------
write('controllers/authController.js', `
// File: controllers/authController.js
// Registration, login, JWT session check, logout, and the three-step
// security-question password reset flow.

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');

const SECRET_KEY = process.env.JWT_SECRET || 'Pass'; // Set JWT_SECRET in production

${toHandler(98, 145, 'register', "app.post('/register'")}

${toHandler(153, 202, 'login', "app.post('/api/login'")}

${toHandler(205, 223, 'verifyEmail', "app.post('/api/forgot-password/verify-email'")}

${toHandler(226, 244, 'verifySecurity', "app.post('/api/forgot-password/verify-security'")}

${toHandler(247, 266, 'resetPassword', "app.post('/api/forgot-password/reset'")}

${toHandler(269, 288, 'checkSession', "app.get('/check_session'")}

${toHandler(291, 294, 'logout', "app.post('/logout'")}

module.exports = { register, login, verifyEmail, verifySecurity, resetPassword, checkSession, logout };
`);

write('controllers/contactController.js', `
// File: controllers/contactController.js
// Contact form handler.

const ContactMessage = require('../models/ContactMessage');

${toHandler(297, 318, 'contactMessage', "app.post('/api/contact'")}

module.exports = { contactMessage };
`);

write('controllers/bookController.js', `
// File: controllers/bookController.js
// Book upload and listing handlers.

const path = require('path');
const fs = require('fs');
const Book = require('../models/Book');
const { generateBookPage } = require('../services/pageGenerators');

${toHandler(322, 373, 'uploadBook', "app.post('/upload-book'")}

${toHandler(376, 384, 'getBooks', "app.get('/books'")}

${toHandler(387, 399, 'getBookById', "app.get('/books/:id'")}

module.exports = { uploadBook, getBooks, getBookById };
`);

write('controllers/videoController.js', `
// File: controllers/videoController.js
// Video upload and listing handlers.

const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const { generateVideoPage } = require('../services/pageGenerators');

${toHandler(403, 447, 'uploadVideo', "app.post('/upload-video'")}

${toHandler(450, 458, 'getVideos', "app.get('/videos'")}

${toHandler(461, 473, 'getVideoById', "app.get('/videos/:id'")}

module.exports = { uploadVideo, getVideos, getVideoById };
`);

write('controllers/gameController.js', `
// File: controllers/gameController.js
// Game upload, update, and listing handlers.

const path = require('path');
const fs = require('fs');
const Game = require('../models/Game');
const { generateGamePage } = require('../services/pageGenerators');

${toHandler(476, 522, 'uploadGame', "app.post('/upload-game'")}

${toHandler(525, 576, 'updateGame', "app.post('/update-game/:id'")}

${toHandler(579, 587, 'getGames', "app.get('/games'")}

${toHandler(590, 602, 'getGameById', "app.get('/games/:id'")}

module.exports = { uploadGame, updateGame, getGames, getGameById };
`);

write('controllers/paintingController.js', `
// File: controllers/paintingController.js
// Painting upload and listing handlers.

const path = require('path');
const fs = require('fs');
const Painting = require('../models/Painting');
const { generatePaintingPage } = require('../services/pageGenerators');

${toHandler(1371, 1420, 'uploadPainting', "app.post('/upload-painting'")}

${toHandler(1423, 1431, 'getPaintings', "app.get('/paintings'")}

${toHandler(1434, 1446, 'getPaintingById', "app.get('/paintings/:id'")}

module.exports = { uploadPainting, getPaintings, getPaintingById };
`);

write('controllers/articleController.js', `
// File: controllers/articleController.js
// Article creation and listing handlers.

const path = require('path');
const fs = require('fs');
const Article = require('../models/Article');
const { generateArticlePage } = require('../services/pageGenerators');

${toHandler(1799, 1874, 'createArticle', "app.post('/create-article'")}

${toHandler(1877, 1887, 'getArticles', "app.get('/articles'")}

${toHandler(1890, 1902, 'getArticleById', "app.get('/articles/:id'")}

module.exports = { createArticle, getArticles, getArticleById };
`);

write('controllers/musicController.js', `
// File: controllers/musicController.js
// Music upload and listing handlers.

const path = require('path');
const fs = require('fs');
const Music = require('../models/music');
const { generateMusicPage } = require('../services/pageGenerators');

${toHandler(2426, 2473, 'uploadMusic', "app.post('/upload-music'")}

${toHandler(2476, 2484, 'getMusic', "app.get('/music'")}

${toHandler(2487, 2499, 'getMusicById', "app.get('/music/:id'")}

module.exports = { uploadMusic, getMusic, getMusicById };
`);

write('controllers/newspaperController.js', `
// File: controllers/newspaperController.js
// Newspaper upload, listing, and year/edition filtering handlers.

const path = require('path');
const fs = require('fs');
const sequelize = require('../database');
const Newspaper = require('../models/Newspaper');
const { generateNewspaperPage } = require('../services/pageGenerators');

${toHandler(2716, 2774, 'uploadNewspaper', "app.post('/upload-newspaper'")}

${toHandler(2777, 2787, 'getNewspapers', "app.get('/newspapers'")}

${toHandler(2790, 2818, 'filterNewspapers', "app.get('/newspapers/filter'")}

${toHandler(2821, 2833, 'getNewspaperById', "app.get('/newspapers/:id'")}

module.exports = { uploadNewspaper, getNewspapers, filterNewspapers, getNewspaperById };
`);

write('controllers/pageController.js', `
// File: controllers/pageController.js
// Static HTML page serving (catch-all and root route).

const path = require('path');
const fs = require('fs');

${toHandler(2837, 2848, 'serveHtmlPage', "app.get('/:page.html'")}

${toHandler(2851, 2853, 'root', "app.get('/', (req, res)")}

module.exports = { serveHtmlPage, root };
`);

// ---------------------------------------------------------------------------
// 4. routes
// ---------------------------------------------------------------------------
write('routes/auth.js', `
// File: routes/auth.js
const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');

router.post('/register', auth.register);
router.post('/api/login', auth.login);
router.post('/api/forgot-password/verify-email', auth.verifyEmail);
router.post('/api/forgot-password/verify-security', auth.verifySecurity);
router.post('/api/forgot-password/reset', auth.resetPassword);
router.get('/check_session', auth.checkSession);
router.post('/logout', auth.logout);

module.exports = router;
`);

write('routes/contact.js', `
// File: routes/contact.js
const express = require('express');
const router = express.Router();
const contact = require('../controllers/contactController');

router.post('/api/contact', contact.contactMessage);

module.exports = router;
`);

write('routes/books.js', `
// File: routes/books.js
const express = require('express');
const router = express.Router();
const books = require('../controllers/bookController');
const { upload } = require('../services/uploadMiddleware');

router.post('/upload-book', upload.fields([
    { name: 'bookImage', maxCount: 1 },
    { name: 'bookPdf', maxCount: 1 }
]), books.uploadBook);

router.get('/books', books.getBooks);
router.get('/books/:id', books.getBookById);

module.exports = router;
`);

write('routes/videos.js', `
// File: routes/videos.js
const express = require('express');
const router = express.Router();
const videos = require('../controllers/videoController');
const { upload } = require('../services/uploadMiddleware');

router.post('/upload-video', upload.single('videoThumbnail'), videos.uploadVideo);

router.get('/videos', videos.getVideos);
router.get('/videos/:id', videos.getVideoById);

module.exports = router;
`);

write('routes/games.js', `
// File: routes/games.js
const express = require('express');
const router = express.Router();
const games = require('../controllers/gameController');
const { upload } = require('../services/uploadMiddleware');

router.post('/upload-game', upload.single('gameThumbnail'), games.uploadGame);
router.post('/update-game/:id', upload.single('gameThumbnail'), games.updateGame);

router.get('/games', games.getGames);
router.get('/games/:id', games.getGameById);

module.exports = router;
`);

write('routes/paintings.js', `
// File: routes/paintings.js
const express = require('express');
const router = express.Router();
const paintings = require('../controllers/paintingController');
const { upload } = require('../services/uploadMiddleware');

router.post('/upload-painting', upload.single('paintingImage'), paintings.uploadPainting);

router.get('/paintings', paintings.getPaintings);
router.get('/paintings/:id', paintings.getPaintingById);

module.exports = router;
`);

write('routes/articles.js', `
// File: routes/articles.js
const express = require('express');
const router = express.Router();
const articles = require('../controllers/articleController');
const { upload } = require('../services/uploadMiddleware');

router.post('/create-article', upload.any(), articles.createArticle);

router.get('/articles', articles.getArticles);
router.get('/articles/:id', articles.getArticleById);

module.exports = router;
`);

write('routes/music.js', `
// File: routes/music.js
const express = require('express');
const router = express.Router();
const music = require('../controllers/musicController');
const { upload } = require('../services/uploadMiddleware');

router.post('/upload-music', upload.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]), music.uploadMusic);

router.get('/music', music.getMusic);
router.get('/music/:id', music.getMusicById);

module.exports = router;
`);

write('routes/newspapers.js', `
// File: routes/newspapers.js
const express = require('express');
const router = express.Router();
const newspapers = require('../controllers/newspaperController');
const { newspaperUpload } = require('../services/uploadMiddleware');

router.post('/upload-newspaper', newspaperUpload.fields([
    { name: 'frontPageImage', maxCount: 1 },
    { name: 'newspaperPdf', maxCount: 1 }
]), newspapers.uploadNewspaper);

router.get('/newspapers', newspapers.getNewspapers);
// /newspapers/filter must be registered before /newspapers/:id
router.get('/newspapers/filter', newspapers.filterNewspapers);
router.get('/newspapers/:id', newspapers.getNewspaperById);

module.exports = router;
`);

write('routes/pages.js', `
// File: routes/pages.js
// Catch-all HTML page serving — must be mounted after all API routes.
const express = require('express');
const router = express.Router();
const pages = require('../controllers/pageController');

router.get('/:page.html', pages.serveHtmlPage);
router.get('/', pages.root);

module.exports = router;
`);

// ---------------------------------------------------------------------------
// 5. new slim server.js (backup the original first)
// ---------------------------------------------------------------------------
fs.copyFileSync(path.join(ROOT, 'server.js'), path.join(ROOT, 'server.js.bak'));

write('server.js', `
// File: server.js
// Express application entry point: middleware, static assets, route
// mounting, and server lifecycle. Route handlers live in controllers/,
// URL wiring in routes/, and business logic (page generation, search,
// upload storage) in services/.

const express = require('express');
const path = require('path');

const sequelize = require('./database');

const app = express();
const port = process.env.PORT || 3000;

${grab(66, 75, '// Middleware setup')}

// Routes (order matters: the /:page.html catch-all in routes/pages.js
// must stay mounted last so it never shadows the API routes above).
// Requiring these modules transitively loads every model, so the
// sequelize.sync() block below sees the full model set — same as the
// original server.js, where models were required before sync().
app.use('/api/search', require('./routes/search'));
app.use(require('./routes/auth'));
app.use(require('./routes/contact'));
app.use(require('./routes/books'));
app.use(require('./routes/videos'));
app.use(require('./routes/games'));
app.use(require('./routes/paintings'));
app.use(require('./routes/articles'));
app.use(require('./routes/music'));
app.use(require('./routes/newspapers'));
app.use(require('./routes/pages'));

// Sync tables and run startup migrations. This must come AFTER the route
// requires above so every model is registered with Sequelize first.
${grab(21, 61, 'sequelize.sync()')}

${grab(2855, 2858, '// Start the server')}

${grab(2860, 2870, '// Graceful shutdown')}
`);

console.log('\nRefactor complete. Original backed up to server.js.bak.');
console.log('Next: node --check every new file, run tests, start the app,');
console.log('verify routes, then delete server.js.bak and this script.');
