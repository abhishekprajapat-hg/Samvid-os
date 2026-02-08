const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['Sale', 'Rent'],
        required: true
    },
    category: {
        type: String, // e.g., "Apartment", "Villa", "Commercial"
        default: 'Apartment'
    },
    status: {
        type: String,
        enum: ['Available', 'Sold', 'Hold'],
        default: 'Available'
    },
    specs: {
        beds: Number,
        baths: Number,
        area: Number // in Sq.Ft
    },
    description: String,
    images: [String], // Array of URLs from Cloudinary
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Property', PropertySchema);