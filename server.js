const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();
const db = require('./database');
const emailHelper = require('./email');

// Initialize Stripe (checking key configuration)
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = (stripeKey.startsWith('sk_') && !stripeKey.includes('placeholder')) ? require('stripe')(stripeKey) : null;

// Stripe request options (e.g. for Organization Keys requiring Stripe-Context)
const stripeOptions = {};
if (process.env.STRIPE_ACCOUNT_ID) {
    stripeOptions.stripeContext = process.env.STRIPE_ACCOUNT_ID;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// STRIPE WEBHOOK ENDPOINT (Needs raw parser before standard json parsers are registered)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe) {
        return res.status(500).send('Stripe is not configured');
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle completed checkout session
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log(`Payment received for session: ${session.id}`);

        const order = await db.getOrderBySessionId(session.id);
        if (order && order.paymentStatus !== 'Paid') {
            await db.updateOrderBySessionId(session.id, {
                paymentStatus: 'Paid'
            });
            const updatedOrder = await db.getOrderBySessionId(session.id);
            emailHelper.sendOrderNotificationEmail(updatedOrder).catch(err => {
                console.error('Failed to send order notification email:', err);
            });
        }
    }

    res.json({ received: true });
});

// STANDARD MIDDLEWARE FOR OTHER ENDPOINTS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static('public'));

// Helper to parse price e.g. "€1,200" or "€45" to cents
function parsePriceToCents(priceStr) {
    const numericStr = priceStr.replace(/[^\d]/g, '');
    const amount = parseInt(numericStr, 10);
    return amount ? amount * 100 : 0;
}

// Helper to verify dashboard authorization headers
async function isAuthorized(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    
    // Expecting token in form: "Bearer <hash>"
    const token = authHeader.split(' ')[1];
    const storedHash = await db.getDashboardPasswordHash();
    return token === storedHash;
}

// --- STRIPE CHECKOUT API ---
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { itemName, itemPrice, type, customerName, customerEmail, customerAddress, customerPhone } = req.body;
        
        if (!itemName || !itemPrice || !customerName || !customerEmail) {
            return res.status(400).json({ error: 'Missing required buyer or product details' });
        }

        const priceCents = parsePriceToCents(itemPrice);
        const domainUrl = process.env.DOMAIN_URL || `http://localhost:${PORT}`;

        let sessionId = 'local_session_' + Date.now();
        let checkoutUrl = `${domainUrl}/success.html?session_id=${sessionId}`;

        // Create actual Stripe checkout session if key is configured
        if (stripe) {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'eur',
                            product_data: {
                                name: itemName,
                            },
                            unit_amount: priceCents,
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                customer_email: customerEmail,
                success_url: `${domainUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${domainUrl}/cancel.html`,
            }, Object.keys(stripeOptions).length ? stripeOptions : undefined);
            sessionId = session.id;
            checkoutUrl = session.url;
        } else {
            console.warn('Stripe key is placeholder. Falling back to local simulated payment checkout URL.');
        }

        // Save order in db
        await db.addOrder({
            itemName,
            itemPrice,
            priceCents,
            type, // "digital" or "physical"
            paymentMethod: 'Stripe Card',
            paymentStatus: 'Unpaid', // Will be marked paid on verification or webhook
            shippingStatus: 'Pending',
            customerName,
            customerEmail,
            customerAddress,
            customerPhone,
            stripeSessionId: sessionId
        });

        res.json({ sessionId, url: checkoutUrl });
    } catch (err) {
        console.error('Error creating checkout session:', err);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// --- VERIFY SESSION API (Works locally without webhooks) ---
app.get('/api/verify-checkout-session', async (req, res) => {
    const { session_id } = req.query;
    if (!session_id) {
        return res.status(400).json({ error: 'Missing session_id' });
    }

    try {
        const order = await db.getOrderBySessionId(session_id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // If using simulated local payment session
        if (session_id.startsWith('local_session_')) {
            const wasPaid = order.paymentStatus === 'Paid';
            await db.updateOrderBySessionId(session_id, { paymentStatus: 'Paid' });
            const updatedOrder = await db.getOrderBySessionId(session_id);
            
            if (!wasPaid) {
                emailHelper.sendOrderNotificationEmail(updatedOrder).catch(err => {
                    console.error('Failed to send order notification email:', err);
                });
            }
            
            const responseOrder = { ...updatedOrder };
            if (updatedOrder.type === 'digital') {
                responseOrder.downloadUrl = `/api/download?session_id=${session_id}`;
            }
            return res.json({ status: 'success', order: responseOrder });
        }

        // If actual Stripe is configured, verify status with Stripe API
        if (stripe) {
            const session = await stripe.checkout.sessions.retrieve(session_id, Object.keys(stripeOptions).length ? stripeOptions : undefined);
            if (session.payment_status === 'paid') {
                const wasPaid = order.paymentStatus === 'Paid';
                await db.updateOrderBySessionId(session_id, { paymentStatus: 'Paid' });
                const updatedOrder = await db.getOrderBySessionId(session_id);
                
                if (!wasPaid) {
                    emailHelper.sendOrderNotificationEmail(updatedOrder).catch(err => {
                        console.error('Failed to send order notification email:', err);
                    });
                }
                
                const responseOrder = { ...updatedOrder };
                if (updatedOrder.type === 'digital') {
                    responseOrder.downloadUrl = `/api/download?session_id=${session_id}`;
                }
                return res.json({ status: 'success', order: responseOrder });
            } else {
                return res.json({ status: 'unpaid', order });
            }
        }

        const responseOrder = { ...order };
        if (order.paymentStatus === 'Paid' && order.type === 'digital') {
            responseOrder.downloadUrl = `/api/download?session_id=${session_id}`;
        }
        res.json({ status: 'unpaid', order: responseOrder });
    } catch (err) {
        console.error('Error verifying Stripe session:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// --- CASH ON DELIVERY API ---
app.post('/api/create-cod-order', async (req, res) => {
    try {
        const { itemName, itemPrice, type, customerName, customerEmail, customerAddress, customerPhone } = req.body;
        
        if (!itemName || !itemPrice || !customerName || !customerEmail || !customerAddress || !customerPhone) {
            return res.status(400).json({ error: 'Missing required order or contact details' });
        }

        const priceCents = parsePriceToCents(itemPrice);

        // Add order to DB
        const order = await db.addOrder({
            itemName,
            itemPrice,
            priceCents,
            type, // "physical"
            paymentMethod: 'Cash on Delivery',
            paymentStatus: 'Pending COD',
            shippingStatus: 'Pending',
            customerName,
            customerEmail,
            customerAddress,
            customerPhone
        });

        // Send order notification email asynchronously
        emailHelper.sendOrderNotificationEmail(order).catch(err => {
            console.error('Failed to send order email:', err);
        });

        res.json({ status: 'success', order });
    } catch (err) {
        console.error('Error creating Cash on Delivery order:', err);
        res.status(500).json({ error: 'Failed to register order' });
    }
});

// --- CONTACT API ENDPOINT ---
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const success = await emailHelper.sendContactEmail({ name, email, subject, message });
        if (success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to send message email' });
        }
    } catch (err) {
        console.error('Error handling contact form submission:', err);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

// --- ARTIST DASHBOARD API ENDPOINTS ---

// Dashboard Login validation
app.post('/api/dashboard-login', async (req, res) => {
    const { password } = req.body;

    const isValid = await db.verifyDashboardPassword(password);
    if (isValid) {
        const token = await db.getDashboardPasswordHash();
        res.json({ success: true, token: token });
    } else {
        res.status(401).json({ success: false, error: 'Incorrect dashboard access credentials' });
    }
});

// Change dashboard password
app.post('/api/change-password', async (req, res) => {
    if (!(await isAuthorized(req))) {
        return res.status(401).json({ error: 'Unauthorized access' });
    }

    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters long' });
        }

        const success = await db.updateDashboardPassword(newPassword);
        if (success) {
            const newHash = await db.getDashboardPasswordHash();
            res.json({ success: true, token: newHash });
        } else {
            res.status(500).json({ error: 'Failed to update password' });
        }
    } catch (err) {
        console.error('Error changing password:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch dashboard metrics and order details
app.get('/api/dashboard-data', async (req, res) => {
    if (!(await isAuthorized(req))) {
        return res.status(401).json({ error: 'Unauthorized access' });
    }

    try {
        const metrics = await db.getMetrics();
        const orders = await db.getOrders();
        res.json({ metrics, orders });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch dashboard reports' });
    }
});

// Update order status (Paid, Shipped, etc.)
app.post('/api/update-order-status', async (req, res) => {
    if (!(await isAuthorized(req))) {
        return res.status(401).json({ error: 'Unauthorized access' });
    }

    const { orderId, paymentStatus, shippingStatus } = req.body;
    if (!orderId) {
        return res.status(400).json({ error: 'Missing orderId' });
    }

    try {
        const updates = {};
        if (paymentStatus) updates.paymentStatus = paymentStatus;
        if (shippingStatus) updates.shippingStatus = shippingStatus;

        const updatedOrder = await db.updateOrder(orderId, updates);
        if (!updatedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ success: true, order: updatedOrder });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// --- PRODUCTS ENDPOINTS ---

// Public endpoint to get all products
app.get('/api/products', async (req, res) => {
    try {
        const products = await db.getProducts();
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Protected endpoint to add a product
app.post('/api/products', async (req, res) => {
    if (!(await isAuthorized(req))) {
        return res.status(401).json({ error: 'Unauthorized access' });
    }

    try {
        const { name_en, name_bg, price, type, desc_en, desc_bg, image, filterClass } = req.body;
        if (!name_en || !name_bg || !price || !type) {
            return res.status(400).json({ error: 'Missing required product information' });
        }

        const priceCents = parsePriceToCents(price);
        const product = await db.addProduct({
            name_en,
            name_bg,
            price,
            priceCents,
            type,
            desc_en,
            desc_bg,
            image,
            filterClass
        });

        res.json({ success: true, product });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Protected endpoint to update a product
app.put('/api/products/:id', async (req, res) => {
    if (!(await isAuthorized(req))) {
        return res.status(401).json({ error: 'Unauthorized access' });
    }

    const productId = req.params.id;
    try {
        const updates = { ...req.body };
        if (updates.price) {
            updates.priceCents = parsePriceToCents(updates.price);
        }

        const product = await db.updateProduct(productId, updates);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ success: true, product });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Protected endpoint to delete a product
app.delete('/api/products/:id', async (req, res) => {
    if (!(await isAuthorized(req))) {
        return res.status(401).json({ error: 'Unauthorized access' });
    }

    const productId = req.params.id;
    try {
        const success = await db.deleteProduct(productId);
        if (!success) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

const DIGITAL_FILES_MAP = {
    'digital fluidity i': 'digital_fluidity_1.png',
    'дигитална плавност i': 'digital_fluidity_1.png',
    'golden arches': 'golden_arches.png',
    'златни арки': 'golden_arches.png',
    'crimson illusion': 'crimson_illusion.png',
    'пурпурна илюзия': 'crimson_illusion.png'
};

function getDigitalFileName(itemName) {
    if (!itemName) return 'digital_fluidity_1.png';
    const key = itemName.toLowerCase().trim();
    
    // Look for exact match
    if (DIGITAL_FILES_MAP[key]) {
        return DIGITAL_FILES_MAP[key];
    }
    
    // Look for partial match
    for (const [name, fileName] of Object.entries(DIGITAL_FILES_MAP)) {
        if (key.includes(name) || name.includes(key)) {
            return fileName;
        }
    }
    
    // Default fallback
    return 'digital_fluidity_1.png';
}

// --- SECURE DIGITAL DOWNLOAD API ---
app.get('/api/download', async (req, res) => {
    const { session_id } = req.query;
    if (!session_id) {
        return res.status(400).json({ error: 'Missing session_id parameter' });
    }

    try {
        const order = await db.getOrderBySessionId(session_id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.paymentStatus !== 'Paid') {
            return res.status(403).json({ error: 'Order has not been paid yet' });
        }

        if (order.type !== 'digital') {
            return res.status(400).json({ error: 'This order is not for a digital product' });
        }

        const fileName = getDigitalFileName(order.itemName);
        const filePath = path.join(__dirname, 'digital_products', fileName);

        if (!fs.existsSync(filePath)) {
            console.error(`Digital asset not found at path: ${filePath}`);
            return res.status(404).json({ error: 'Digital file not found on server' });
        }

        // Send the file securely
        res.download(filePath, fileName);
    } catch (err) {
        console.error('Error handling digital download:', err);
        res.status(500).json({ error: 'Failed to process download' });
    }
});

// Serve frontend routing defaults
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    if (!stripe) {
        console.warn('NOTE: Stripe secret key is not set. Payments will run in simulation mode.');
    } else {
        console.log('Stripe SDK initialized successfully.');
    }
});

module.exports = app;
