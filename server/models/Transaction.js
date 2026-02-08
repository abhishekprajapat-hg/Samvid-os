const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    dealName: { type: String, required: true }, // e.g., "Sharma Villa Deal"

    // LINKING THE OTHER MODULES
    leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true
    },
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },

    // MONEY MATH
    salePrice: { type: Number, required: true }, // Actual price sold at
    commissionRate: { type: Number, default: 2 }, // e.g., 2%
    commissionAmount: { type: Number }, // We will calculate this automatically

    status: {
        type: String,
        enum: ['Negotiation', 'Token Paid', 'Documentation', 'Closed', 'Cancelled'],
        default: 'Negotiation'
    },

    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);