// File: models/Game.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Game = sequelize.define('Game', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    gameName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    developer: {
        type: DataTypes.STRING,
        allowNull: false
    },
    gameThumbnail: {
        type: DataTypes.STRING,
        allowNull: false
    },
    releaseYear: {
        type: DataTypes.STRING
    },
    genre: {
        type: DataTypes.STRING
    },
    platform: {
        type: DataTypes.STRING
    },
    ageRating: {
        type: DataTypes.STRING
    },
    multiplayer: {
        type: DataTypes.STRING
    },
    keyFeatures: {
        type: DataTypes.TEXT
    },
    gameDescription: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    embedCode: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    gameLink: {
        type: DataTypes.STRING
    },
    htmlLink: {
        type: DataTypes.STRING
    }
});

module.exports = Game;
