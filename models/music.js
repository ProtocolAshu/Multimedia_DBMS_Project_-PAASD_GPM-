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
    featuredArtists: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    album: {
        type: DataTypes.STRING
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    coverImage: {
        type: DataTypes.STRING
    },
    audioFile: {
        type: DataTypes.STRING,
        allowNull: false
    },
    genres: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    description: {
        type: DataTypes.TEXT
    },
    explicit: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    dateAdded: {
        type: DataTypes.DATE
    },
    htmlLink: {
        type: DataTypes.STRING
    }
}, {
    tableName: 'Music',
    timestamps: false
});

module.exports = Music;
