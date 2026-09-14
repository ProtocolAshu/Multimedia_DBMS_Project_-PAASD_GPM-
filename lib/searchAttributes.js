// File: lib/searchAttributes.js
// Canonical definition of the numeric attributes used for multi-dimensional
// (k-d tree) search. Every searchable content type exposes the same three
// dimensions — year, rating, priceUSD — so /api/search and the k-d tree can
// treat all records uniformly.

// Sequelize column definitions added to every searchable model.
const SEARCHABLE_MODEL_ATTRIBUTES = {
    rating: {
        type: 'INTEGER', // 0-10
        allowNull: true,
        validate: { min: 0, max: 10 }
    },
    priceUSD: {
        type: 'FLOAT',
        allowNull: true,
        validate: { min: 0 }
    }
};

// Which field of each model provides the "year" dimension. Some models
// already had a year column (sometimes a STRING) under a different name;
// the search layer reads it from there and parses it to a number.
const YEAR_SOURCE_FIELDS = {
    Music: 'year',
    Video: 'releaseYear',
    Game: 'releaseYear',
    Book: 'publicationYear',
    Painting: 'yearCreated',
    Newspaper: 'publishYear',
    Article: 'publicationYear'
};

module.exports = {
    SEARCHABLE_MODEL_ATTRIBUTES,
    YEAR_SOURCE_FIELDS
};
