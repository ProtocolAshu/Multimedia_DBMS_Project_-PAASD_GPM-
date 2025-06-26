// File: models/Newspaper.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database'); // Make sure this path is correct

const Newspaper = sequelize.define('Newspaper', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    publishDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    editionType: {
        type: DataTypes.ENUM('morning', 'evening', 'special', 'weekend'),
        allowNull: false,
        defaultValue: 'morning'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    coverImage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pdfPath: {
        type: DataTypes.STRING,
        allowNull: false
    },
    keywords: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('keywords');
            return rawValue ? rawValue.split(',') : [];
        },
        set(value) {
            this.setDataValue('keywords', Array.isArray(value) ? value.join(',') : value);
        }
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: false
});

module.exports = Newspaper;
