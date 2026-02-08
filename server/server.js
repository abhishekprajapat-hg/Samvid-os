require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// --- IMPORT MODELS ---
const Lead = require('./models/Lead');
const Property = require('./models/Property');
const Transaction = require('./models/Transaction');

// 1. Initialize App
const app = express();
const PORT = process.env.PORT || 5000;

// 2. Middlewares
app.use(cors());
app.use(express.json());

// 3. Database Connection
console.log('  ⏳ ATTEMPTING CONNECTION...');
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000
})
    .then(() => console.log('  💽 DATABASE CONNECTED (MongoDB)'))
    .catch(err => console.error('  ❌ DB ERROR:', err.message));

// --- API ROUTES ---

// A. LEADS ROUTE (Get All & Create New)
app.get('/api/leads', async (req, res) => {
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.json(leads);
});

app.post('/api/leads', async (req, res) => {
    try {
        const newLead = new Lead(req.body);
        await newLead.save();
        res.json(newLead);
        console.log('  ✅ NEW LEAD SAVED:', newLead.name);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// B. INVENTORY ROUTE (Get All & Create New)
app.get('/api/properties', async (req, res) => {
    const properties = await Property.find();
    res.json(properties);
});

app.post('/api/properties', async (req, res) => {
    try {
        const newProperty = new Property(req.body);
        await newProperty.save();
        res.json(newProperty);
        console.log('  ✅ NEW ASSET ADDED:', newProperty.title);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 4. Start Server
// ==========================================
// 💰 FINANCIAL ROUTES
// ==========================================

// GET ALL TRANSACTIONS (With details of Lead and Property)
app.get('/api/finance', async (req, res) => {
    try {
        // .populate() is magic. It replaces the "ID" with the actual Name/Phone of the client.
        const deals = await Transaction.find()
            .populate('leadId', 'name phone')
            .populate('propertyId', 'title location')
            .sort({ date: -1 });
        res.json(deals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE A NEW DEAL
app.post('/api/finance', async (req, res) => {
    try {
        const { dealName, leadId, propertyId, salePrice, commissionRate, status } = req.body;

        // Auto-Calculate Commission (The System does the math)
        const commissionAmount = (salePrice * commissionRate) / 100;

        const newDeal = new Transaction({
            dealName, leadId, propertyId, salePrice, commissionRate, commissionAmount, status
        });

        await newDeal.save();

        // OPTIONAL: Auto-update the Lead status to "Closed" if deal is closed
        // if (status === 'Closed') { ... update lead ... }

        res.json(newDeal);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`
  ---------------------------------------
  🚀 SAMVID SERVER ONLINE
  📡 PORT: ${PORT}
  ---------------------------------------
  `);
});