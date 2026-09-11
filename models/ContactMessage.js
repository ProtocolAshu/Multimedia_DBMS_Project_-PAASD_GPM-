// File: models/ContactMessage.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const ContactMessage = sequelize.define('ContactMessage', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'ContactMessages',
    timestamps: true
});

module.exports = ContactMessage;
