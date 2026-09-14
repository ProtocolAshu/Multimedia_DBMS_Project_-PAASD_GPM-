// File: models/Video.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');
const { SEARCHABLE_MODEL_ATTRIBUTES } = require('../lib/searchAttributes');

const Video = sequelize.define('Video', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    videoTitle: {
        type: DataTypes.STRING,
        allowNull: false
    },
    creator: {
        type: DataTypes.STRING,
        allowNull: false
    },
    videoThumbnail: {
        type: DataTypes.STRING,
        allowNull: false
    },
    videoEmbedCode: {
        type: DataTypes.STRING,
        allowNull: false
    },
    genre: {
        type: DataTypes.STRING
    },
    releaseYear: {
        type: DataTypes.INTEGER
    },
    duration: {
        type: DataTypes.INTEGER
    },
    language: {
        type: DataTypes.STRING
    },
    videoTags: {
        type: DataTypes.STRING
    },
    videoDescription: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    ...SEARCHABLE_MODEL_ATTRIBUTES, // rating, priceUSD — used by /api/search
    htmlLink: {
        type: DataTypes.STRING
    }
});

module.exports = Video;
