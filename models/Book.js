// File: models/Book.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');
const { SEARCHABLE_MODEL_ATTRIBUTES } = require('../lib/searchAttributes');

const Book = sequelize.define('Book', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    bookName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    authorName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bookImage: DataTypes.STRING,
    bookPdf: DataTypes.STRING,
    birthYear: DataTypes.STRING,
    deathYear: DataTypes.STRING,
    publicationYear: DataTypes.INTEGER, // year dimension for /api/search
    language: DataTypes.STRING,
    genre: DataTypes.STRING,
    literaryMovement: DataTypes.STRING,
    importantThemes: DataTypes.STRING,
    keyCharacters: DataTypes.STRING,
    bookSummary: DataTypes.TEXT,
    ...SEARCHABLE_MODEL_ATTRIBUTES, // rating, priceUSD — used by /api/search
    youtubeLink: DataTypes.STRING,
    bookLink: DataTypes.STRING,
    htmlLink: DataTypes.STRING
}, {
    tableName: 'books',
    timestamps: false
});

module.exports = Book;
