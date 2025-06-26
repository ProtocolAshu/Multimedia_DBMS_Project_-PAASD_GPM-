// File: models/Article.js (updated)
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Article = sequelize.define('Article', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    authorName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    shortDescription: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    coverImage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    categories: {
        type: DataTypes.STRING,
        allowNull: true
    },
    content: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    htmlLink: {
        type: DataTypes.STRING,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: false // We're managing createdAt manually
});

module.exports = Article;
