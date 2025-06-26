// File: models/Painting.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Painting = sequelize.define('Painting', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    paintingName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    artistName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    paintingImage: {
        type: DataTypes.STRING,
        allowNull: false
    },
    yearCreated: {
        type: DataTypes.STRING
    },
    medium: {
        type: DataTypes.STRING
    },
    dimensions: {
        type: DataTypes.STRING
    },
    artMovement: {
        type: DataTypes.STRING
    },
    currentLocation: {
        type: DataTypes.STRING
    },
    technique: {
        type: DataTypes.STRING
    },
    mainSubject: {
        type: DataTypes.STRING
    },
    paintingDescription: {
        type: DataTypes.TEXT
    },
    primaryVideo: {
        type: DataTypes.STRING
    },
    artistVideo: {
        type: DataTypes.STRING
    },
    technicalVideo: {
        type: DataTypes.STRING
    },
    virtualTour: {
        type: DataTypes.STRING
    },
    htmlLink: {
        type: DataTypes.STRING
    }
});

module.exports = Painting;
