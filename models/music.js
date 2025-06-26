// File: models/Music.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Music = sequelize.define('Music', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    artist: {
        type: DataTypes.STRING,
        allowNull: false
    },
    coverImage: {
        type: DataTypes.STRING,
        allowNull: false
    },
    releaseYear: {
        type: DataTypes.STRING
    },
    genre: {
        type: DataTypes.STRING
    },
    album: {
        type: DataTypes.STRING
    },
    explicit: {
        type: DataTypes.STRING
    },
    featuredArtists: {
        type: DataTypes.STRING
    },
    keyFeatures: {
        type: DataTypes.TEXT
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    audioFile: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    musicLink: {
        type: DataTypes.STRING
    },
    streamingLink: {
        type: DataTypes.STRING
    }
});

module.exports = Music;
