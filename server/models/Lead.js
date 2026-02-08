const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    email: {
        type: String
    },
    status: {
        type: String,
        enum: ['New', 'Contacted', 'Qualified', 'Lost', 'Closed'],
        default: 'New'
    },
    budget: {
        type: Number
    },
    type: {
        type: String,
        enum: ['Buyer', 'Renter', 'Investor'],
        default: 'Buyer'
    },
    notes: {
        type: String
    },
    assignedTo: {
        type: String, // We will link this to User ID later
        default: 'Unassigned'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Lead', LeadSchema);