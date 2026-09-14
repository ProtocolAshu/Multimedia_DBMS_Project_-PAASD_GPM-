// File: scripts/clean-test-rows.js
// One-off cleanup: removes the test rows (m1-m3, v1, v2) that earlier test
// runs inserted into the real database.sqlite before the tests were
// isolated to an in-memory database via DB_STORAGE.
//
// Run with: node scripts/clean-test-rows.js

const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('database.sqlite');
db.serialize(() => {
    db.run("DELETE FROM Music WHERE id IN ('m1', 'm2', 'm3')", (e) =>
        console.log('Music:', e ? e.message : 'cleaned')
    );
    db.run("DELETE FROM Videos WHERE id IN ('v1', 'v2')", (e) =>
        console.log('Video:', e ? e.message : 'cleaned')
    );
    db.close();
});
