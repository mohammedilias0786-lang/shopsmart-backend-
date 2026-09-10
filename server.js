require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const app = express();
app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ===== Health check =====
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'ShopSmart Razorpay backend running' });
});

// ===== 1. Create Razorpay Order =====
app.post('/api/create-razorpay-order', async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount < 100) {
            return res.status(400).json({ error: 'Invalid amount. Min ₹1 (100 paise).' });
        }

        const options = {
            amount: Math.round(amount),
            currency: 'INR',
            receipt: 'receipt_' + Date.now(),
            notes: { source: 'ShopSmart Website' }
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (err) {
        console.error('Create order error:', err);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// ===== 2. Verify Payment Signature =====
app.post('/api/verify-payment', (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, error: 'Missing fields' });
        }

        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            res.json({
                success: true,
                message: 'Payment verified',
                payment_id: razorpay_payment_id,
                order_id: razorpay_order_id
            });
        } else {
            res.status(400).json({ success: false, error: 'Invalid signature' });
        }
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

// ===== 3. Get payment details =====
app.get('/api/payment/:paymentId', async (req, res) => {
    try {
        const payment = await razorpay.payments.fetch(req.params.paymentId);
        res.json(payment);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch payment' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Razorpay backend running on port ${PORT}`);
});
