// File: database.js
const { Sequelize } = require('sequelize');
const path = require('path');

// DB_STORAGE lets tests and scripts redirect the database (e.g. to
// ':memory:') without touching the real database.sqlite.
const storage = process.env.DB_STORAGE || path.join(__dirname, 'database.sqlite');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage,
    logging: false // Set to console.log to see SQL queries
});

module.exports = sequelize;