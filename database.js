const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const usePostgres = !!process.env.POSTGRES_URL;

// Local JSON DB file config
const DB_FILE = path.join(__dirname, 'db.json');

const crypto = require('crypto');

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
    if (!storedValue || !storedValue.includes(':')) return false;
    const [salt, originalHash] = storedValue.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
}

const DEFAULT_PRODUCTS = [
    {
        id: 'prod_1',
        name_en: "Whispers of Autumn",
        name_bg: "Шепотът на есента",
        price: "€1,200",
        priceCents: 120000,
        type: "canvas",
        desc_en: "A deep exploration of seasons and textures, featuring rich layers of burgundy acrylic paint and real gold leaf highlights.",
        desc_bg: "Дълбоко изследване на сезоните и текстурите, включващо богати слоеве бордо акрилна боя и акценти от истинско златно фолио.",
        image: "/assets/card_artworks.png",
        filterClass: "hue-rotate(0deg)"
    },
    {
        id: 'prod_2',
        name_en: "Midnight Eclipse",
        name_bg: "Полунощно затъмнение",
        price: "€950",
        priceCents: 95000,
        type: "canvas",
        desc_en: "A cosmic journey rendered on heavily textured canvas with deep burgundy washes, cyclamen pigments, and structured gold arches.",
        desc_bg: "Космическо пътешествие, представено върху силно текстурирано платно с дълбоки промивки от бордо, цикламени пигменти и структурирани златни арки.",
        image: "/assets/card_artworks.png",
        filterClass: "hue-rotate(45deg)"
    },
    {
        id: 'prod_3',
        name_en: "Ethereal Dreams",
        name_bg: "Ефирни сънища",
        price: "€1,800",
        priceCents: 180000,
        type: "canvas",
        desc_en: "An expansive, sweeping artwork designed to anchor high-end spaces. Organic paint applications blended with shimmering gold veins.",
        desc_bg: "Експанзивно, мащабно произведение на изкуството, създадено да акостира в луксозни пространства. Органични нанасяния на боя, смесени с блестящи златни вени.",
        image: "/assets/card_artworks.png",
        filterClass: "hue-rotate(90deg)"
    },
    {
        id: 'prod_4',
        name_en: "Digital Fluidity I",
        name_bg: "Дигитална плавност I",
        price: "€120",
        priceCents: 12000,
        type: "print",
        desc_en: "High-resolution print capturing the fluid paint splatters of the main brand identity. Printed on 310gsm champagne cotton archival paper.",
        desc_bg: "Принт с висока резолюция, улавящ флуидните петна от боя от основната идентичност на бранда. Отпечатан върху 310-грамова памучна архивна хартия в цвят шампанско.",
        image: "/assets/hero_bg.png",
        filterClass: "contrast(110%)"
    },
    {
        id: 'prod_5',
        name_en: "Golden Arches",
        name_bg: "Златни арки",
        price: "€150",
        priceCents: 15000,
        type: "print",
        desc_en: "Geometric and abstract harmony. Clean lines overlapping natural watercolor structures. Limited edition run of 50 prints, signed by the artist.",
        desc_bg: "Геометрична и абстрактна хармония. Чисти линии, припокриващи естествени акварелни структури. Ограничен тираж от 50 принта, подписани от автора.",
        image: "/assets/card_books.png",
        filterClass: ""
    },
    {
        id: 'prod_6',
        name_en: "Crimson Illusion",
        name_bg: "Пурпурна илюзия",
        price: "€110",
        priceCents: 11000,
        type: "print",
        desc_en: "A deep, dramatic print exploring negative space, dark claret paint layers, and fine golden typography lines.",
        desc_bg: "Дълбок, драматичен принт, изследващ негативното пространство, тъмните слоеве боя в цвят бордо и фините златни типографски линии.",
        image: "/assets/card_design.png",
        filterClass: ""
    },
    {
        id: 'prod_7',
        name_en: "Inspirations & Visions: The Art of Gratsiela Ivanova",
        name_bg: "Вдъхновения и визии: Изкуството на Грациела Иванова",
        price: "€45",
        priceCents: 4500,
        type: "book",
        desc_en: "This limited-edition coffee table book details the creative philosophy and visual processes behind Gratsiela Ivanova's work. Featuring over 120 pages of high-resolution abstract painting collections, delicate watercolor sketches, editorial monograms, and reflective essays.",
        desc_bg: "Тази луксозна книга с ограничено издание описва подробно творческата философия и визуалните процеси зад работата на Грациела Иванова. Съдържа над 120 страници с колекции от абстрактни картини с висока резолюция, деликатни акварелни скици, редакционни монограми и отразяващи есета.",
        image: "/assets/card_books.png",
        filterClass: ""
    }
];

// Initialize Postgres connection pool
let pool;
let isInitialized = false;

if (usePostgres) {
    console.log('Postgres mode activated. Using database connection string.');
    pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
} else {
    console.log('Local mode activated. Using db.json file database.');
}

// Check and trigger database initialization
async function checkInit() {
    if (!usePostgres) return;
    if (isInitialized) return;
    await initDb();
}

// Database schema initialization
async function initDb() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Orders table
        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(255) PRIMARY KEY,
                date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                item_name VARCHAR(255) NOT NULL,
                item_price VARCHAR(50) NOT NULL,
                price_cents INTEGER NOT NULL,
                type VARCHAR(50) NOT NULL,
                payment_method VARCHAR(100) NOT NULL,
                payment_status VARCHAR(100) NOT NULL,
                shipping_status VARCHAR(100) NOT NULL,
                customer_name VARCHAR(255) NOT NULL,
                customer_email VARCHAR(255) NOT NULL,
                customer_address TEXT DEFAULT 'N/A',
                customer_phone VARCHAR(50) NOT NULL,
                stripe_session_id VARCHAR(255) UNIQUE
            )
        `);

        // Products table
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(255) PRIMARY KEY,
                name_en VARCHAR(255) NOT NULL,
                name_bg VARCHAR(255) NOT NULL,
                price VARCHAR(50) NOT NULL,
                price_cents INTEGER NOT NULL,
                type VARCHAR(50) NOT NULL,
                desc_en TEXT,
                desc_bg TEXT,
                image VARCHAR(255) NOT NULL,
                filter_class VARCHAR(255) DEFAULT ''
            )
        `);

        // Seed products if empty
        const res = await client.query('SELECT count(*) FROM products');
        const count = parseInt(res.rows[0].count, 10);
        if (count === 0) {
            console.log('Seeding default products into Vercel Postgres...');
            const seedQuery = `
                INSERT INTO products (id, name_en, name_bg, price, price_cents, type, desc_en, desc_bg, image, filter_class)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `;
            for (const p of DEFAULT_PRODUCTS) {
                await client.query(seedQuery, [
                    p.id, p.name_en, p.name_bg, p.price, p.priceCents, p.type, p.desc_en, p.desc_bg, p.image, p.filterClass
                ]);
            }
        }

        // Settings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT NOT NULL
            )
        `);

        // Seed default password if not exists
        const settingsRes = await client.query("SELECT count(*) FROM settings WHERE key = 'dashboard_password'");
        const settingsCount = parseInt(settingsRes.rows[0].count, 10);
        if (settingsCount === 0) {
            console.log('Seeding default dashboard password into Vercel Postgres...');
            const defaultPass = 'work';
            const hashed = hashPassword(defaultPass);
            await client.query("INSERT INTO settings (key, value) VALUES ('dashboard_password', $1)", [hashed]);
        }

        await client.query('COMMIT');
        isInitialized = true;
        console.log('Vercel Postgres database initialized successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to initialize Vercel Postgres database:', err);
    } finally {
        client.release();
    }
}

// Local JSON DB Helpers
function readDb() {
    try {
        let changed = false;
        if (!fs.existsSync(DB_FILE)) {
            const defaultPass = 'work';
            const hashed = hashPassword(defaultPass);
            const initialData = { 
                orders: [], 
                products: DEFAULT_PRODUCTS,
                settings: { dashboard_password: hashed }
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        
        if (!parsed.products) {
            parsed.products = DEFAULT_PRODUCTS;
            changed = true;
        }
        if (!parsed.settings || !parsed.settings.dashboard_password) {
            const defaultPass = 'work';
            const hashed = hashPassword(defaultPass);
            parsed.settings = parsed.settings || {};
            parsed.settings.dashboard_password = hashed;
            changed = true;
        }
        if (changed) {
            fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2));
        }
        return parsed;
    } catch (err) {
        console.error('Error reading database file:', err);
        return { orders: [], products: DEFAULT_PRODUCTS, settings: {} };
    }
}

function writeDb(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error('Error writing database file:', err);
        return false;
    }
}

// Database API Implementation

async function getOrders() {
    if (usePostgres) {
        await checkInit();
        try {
            const res = await pool.query('SELECT * FROM orders ORDER BY date DESC');
            return res.rows.map(row => ({
                id: row.id,
                date: row.date,
                itemName: row.item_name,
                itemPrice: row.item_price,
                priceCents: row.price_cents,
                type: row.type,
                paymentMethod: row.payment_method,
                paymentStatus: row.payment_status,
                shippingStatus: row.shipping_status,
                customerName: row.customer_name,
                customerEmail: row.customer_email,
                customerAddress: row.customer_address,
                customerPhone: row.customer_phone,
                stripeSessionId: row.stripe_session_id
            }));
        } catch (err) {
            console.error('Error fetching orders from Postgres:', err);
            return [];
        }
    } else {
        const db = readDb();
        return db.orders.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}

async function addOrder(orderData) {
    const newOrder = {
        id: 'ord_' + Date.now() + Math.random().toString(36).substr(2, 4),
        date: new Date().toISOString(),
        itemName: orderData.itemName,
        itemPrice: orderData.itemPrice,
        priceCents: orderData.priceCents,
        type: orderData.type, // "digital" or "physical"
        paymentMethod: orderData.paymentMethod,
        paymentStatus: orderData.paymentStatus || 'Pending',
        shippingStatus: orderData.shippingStatus || 'Pending',
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        customerAddress: orderData.customerAddress || 'N/A',
        customerPhone: orderData.customerPhone,
        stripeSessionId: orderData.stripeSessionId || null
    };

    if (usePostgres) {
        await checkInit();
        try {
            const query = `
                INSERT INTO orders (id, date, item_name, item_price, price_cents, type, payment_method, payment_status, shipping_status, customer_name, customer_email, customer_address, customer_phone, stripe_session_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `;
            await pool.query(query, [
                newOrder.id, newOrder.date, newOrder.itemName, newOrder.itemPrice, newOrder.priceCents, newOrder.type,
                newOrder.paymentMethod, newOrder.paymentStatus, newOrder.shippingStatus, newOrder.customerName,
                newOrder.customerEmail, newOrder.customerAddress, newOrder.customerPhone, newOrder.stripeSessionId
            ]);
            return newOrder;
        } catch (err) {
            console.error('Error saving order to Postgres:', err);
            throw err;
        }
    } else {
        const db = readDb();
        db.orders.push(newOrder);
        writeDb(db);
        return newOrder;
    }
}

async function updateOrder(orderId, updates) {
    if (usePostgres) {
        await checkInit();
        try {
            const keys = [];
            const values = [];
            let i = 1;

            if (updates.paymentStatus !== undefined) {
                keys.push(`payment_status = $${i++}`);
                values.push(updates.paymentStatus);
            }
            if (updates.shippingStatus !== undefined) {
                keys.push(`shipping_status = $${i++}`);
                values.push(updates.shippingStatus);
            }

            if (keys.length === 0) return null;

            values.push(orderId);
            const query = `
                UPDATE orders 
                SET ${keys.join(', ')} 
                WHERE id = $${i}
                RETURNING *
            `;
            const res = await pool.query(query, values);
            if (res.rows.length === 0) return null;
            
            const row = res.rows[0];
            return {
                id: row.id,
                date: row.date,
                itemName: row.item_name,
                itemPrice: row.item_price,
                priceCents: row.price_cents,
                type: row.type,
                paymentMethod: row.payment_method,
                paymentStatus: row.payment_status,
                shippingStatus: row.shipping_status,
                customerName: row.customer_name,
                customerEmail: row.customer_email,
                customerAddress: row.customer_address,
                customerPhone: row.customer_phone,
                stripeSessionId: row.stripe_session_id
            };
        } catch (err) {
            console.error('Error updating order in Postgres:', err);
            return null;
        }
    } else {
        const db = readDb();
        const orderIndex = db.orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return null;

        db.orders[orderIndex] = {
            ...db.orders[orderIndex],
            ...updates
        };
        writeDb(db);
        return db.orders[orderIndex];
    }
}

async function updateOrderBySessionId(sessionId, updates) {
    if (usePostgres) {
        await checkInit();
        try {
            const keys = [];
            const values = [];
            let i = 1;

            if (updates.paymentStatus !== undefined) {
                keys.push(`payment_status = $${i++}`);
                values.push(updates.paymentStatus);
            }
            if (updates.shippingStatus !== undefined) {
                keys.push(`shipping_status = $${i++}`);
                values.push(updates.shippingStatus);
            }

            if (keys.length === 0) return null;

            values.push(sessionId);
            const query = `
                UPDATE orders 
                SET ${keys.join(', ')} 
                WHERE stripe_session_id = $${i}
                RETURNING *
            `;
            const res = await pool.query(query, values);
            if (res.rows.length === 0) return null;
            
            const row = res.rows[0];
            return {
                id: row.id,
                date: row.date,
                itemName: row.item_name,
                itemPrice: row.item_price,
                priceCents: row.price_cents,
                type: row.type,
                paymentMethod: row.payment_method,
                paymentStatus: row.payment_status,
                shippingStatus: row.shipping_status,
                customerName: row.customer_name,
                customerEmail: row.customer_email,
                customerAddress: row.customer_address,
                customerPhone: row.customer_phone,
                stripeSessionId: row.stripe_session_id
            };
        } catch (err) {
            console.error('Error updating order by session ID in Postgres:', err);
            return null;
        }
    } else {
        const db = readDb();
        const orderIndex = db.orders.findIndex(o => o.stripeSessionId === sessionId);
        if (orderIndex === -1) return null;

        db.orders[orderIndex] = {
            ...db.orders[orderIndex],
            ...updates
        };
        writeDb(db);
        return db.orders[orderIndex];
    }
}

async function getOrderBySessionId(sessionId) {
    if (usePostgres) {
        await checkInit();
        try {
            const res = await pool.query('SELECT * FROM orders WHERE stripe_session_id = $1', [sessionId]);
            if (res.rows.length === 0) return null;
            const row = res.rows[0];
            return {
                id: row.id,
                date: row.date,
                itemName: row.item_name,
                itemPrice: row.item_price,
                priceCents: row.price_cents,
                type: row.type,
                paymentMethod: row.payment_method,
                paymentStatus: row.payment_status,
                shippingStatus: row.shipping_status,
                customerName: row.customer_name,
                customerEmail: row.customer_email,
                customerAddress: row.customer_address,
                customerPhone: row.customer_phone,
                stripeSessionId: row.stripe_session_id
            };
        } catch (err) {
            console.error('Error fetching order by session ID from Postgres:', err);
            return null;
        }
    } else {
        const db = readDb();
        return db.orders.find(o => o.stripeSessionId === sessionId) || null;
    }
}

async function getMetrics() {
    if (usePostgres) {
        await checkInit();
        try {
            const ordersRes = await pool.query('SELECT * FROM orders');
            const orders = ordersRes.rows;

            let stripeRevenueCents = 0;
            let codRevenueCents = 0;
            let totalOrders = orders.length;
            let paidOrdersCount = 0;
            let pendingCodCount = 0;

            orders.forEach(order => {
                if (order.payment_status === 'Paid') {
                    paidOrdersCount++;
                    stripeRevenueCents += order.price_cents;
                } else if (order.payment_method === 'Cash on Delivery') {
                    pendingCodCount++;
                    codRevenueCents += order.price_cents;
                }
            });

            return {
                totalOrders,
                paidOrdersCount,
                pendingCodCount,
                paidRevenue: (stripeRevenueCents / 100).toFixed(2),
                projectedCodRevenue: (codRevenueCents / 100).toFixed(2),
                totalRevenue: ((stripeRevenueCents + codRevenueCents) / 100).toFixed(2)
            };
        } catch (err) {
            console.error('Error calculating metrics from Postgres:', err);
            return {
                totalOrders: 0,
                paidOrdersCount: 0,
                pendingCodCount: 0,
                paidRevenue: '0.00',
                projectedCodRevenue: '0.00',
                totalRevenue: '0.00'
            };
        }
    } else {
        const db = readDb();
        const orders = db.orders;

        let stripeRevenueCents = 0;
        let codRevenueCents = 0;
        let totalOrders = orders.length;
        let paidOrdersCount = 0;
        let pendingCodCount = 0;

        orders.forEach(order => {
            if (order.paymentStatus === 'Paid') {
                paidOrdersCount++;
                stripeRevenueCents += order.priceCents;
            } else if (order.paymentMethod === 'Cash on Delivery') {
                pendingCodCount++;
                codRevenueCents += order.priceCents;
            }
        });

        return {
            totalOrders,
            paidOrdersCount,
            pendingCodCount,
            paidRevenue: (stripeRevenueCents / 100).toFixed(2),
            projectedCodRevenue: (codRevenueCents / 100).toFixed(2),
            totalRevenue: ((stripeRevenueCents + codRevenueCents) / 100).toFixed(2)
        };
    }
}

async function getProducts() {
    if (usePostgres) {
        await checkInit();
        try {
            const res = await pool.query('SELECT * FROM products');
            return res.rows.map(row => ({
                id: row.id,
                name_en: row.name_en,
                name_bg: row.name_bg,
                price: row.price,
                priceCents: row.price_cents,
                type: row.type,
                desc_en: row.desc_en,
                desc_bg: row.desc_bg,
                image: row.image,
                filterClass: row.filter_class
            }));
        } catch (err) {
            console.error('Error fetching products from Postgres:', err);
            return [];
        }
    } else {
        const db = readDb();
        return db.products || [];
    }
}

async function addProduct(prodData) {
    const newProduct = {
        id: 'prod_' + Date.now() + Math.random().toString(36).substr(2, 4),
        name_en: prodData.name_en,
        name_bg: prodData.name_bg,
        price: prodData.price,
        priceCents: prodData.priceCents,
        type: prodData.type,
        desc_en: prodData.desc_en,
        desc_bg: prodData.desc_bg,
        image: prodData.image || 'assets/card_artworks.png',
        filterClass: prodData.filterClass || ''
    };

    if (usePostgres) {
        await checkInit();
        try {
            const query = `
                INSERT INTO products (id, name_en, name_bg, price, price_cents, type, desc_en, desc_bg, image, filter_class)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `;
            await pool.query(query, [
                newProduct.id, newProduct.name_en, newProduct.name_bg, newProduct.price, newProduct.priceCents,
                newProduct.type, newProduct.desc_en, newProduct.desc_bg, newProduct.image, newProduct.filterClass
            ]);
            return newProduct;
        } catch (err) {
            console.error('Error saving product to Postgres:', err);
            throw err;
        }
    } else {
        const db = readDb();
        db.products.push(newProduct);
        writeDb(db);
        return newProduct;
    }
}

async function updateProduct(prodId, updates) {
    if (usePostgres) {
        await checkInit();
        try {
            const keys = [];
            const values = [];
            let i = 1;

            if (updates.name_en !== undefined) { keys.push(`name_en = $${i++}`); values.push(updates.name_en); }
            if (updates.name_bg !== undefined) { keys.push(`name_bg = $${i++}`); values.push(updates.name_bg); }
            if (updates.price !== undefined) { keys.push(`price = $${i++}`); values.push(updates.price); }
            if (updates.priceCents !== undefined) { keys.push(`price_cents = $${i++}`); values.push(updates.priceCents); }
            if (updates.type !== undefined) { keys.push(`type = $${i++}`); values.push(updates.type); }
            if (updates.desc_en !== undefined) { keys.push(`desc_en = $${i++}`); values.push(updates.desc_en); }
            if (updates.desc_bg !== undefined) { keys.push(`desc_bg = $${i++}`); values.push(updates.desc_bg); }
            if (updates.image !== undefined) { keys.push(`image = $${i++}`); values.push(updates.image); }
            if (updates.filterClass !== undefined) { keys.push(`filter_class = $${i++}`); values.push(updates.filterClass); }

            if (keys.length === 0) return null;

            values.push(prodId);
            const query = `
                UPDATE products 
                SET ${keys.join(', ')} 
                WHERE id = $${i}
                RETURNING *
            `;
            const res = await pool.query(query, values);
            if (res.rows.length === 0) return null;
            const row = res.rows[0];
            return {
                id: row.id,
                name_en: row.name_en,
                name_bg: row.name_bg,
                price: row.price,
                priceCents: row.price_cents,
                type: row.type,
                desc_en: row.desc_en,
                desc_bg: row.desc_bg,
                image: row.image,
                filterClass: row.filter_class
            };
        } catch (err) {
            console.error('Error updating product in Postgres:', err);
            return null;
        }
    } else {
        const db = readDb();
        const prodIndex = db.products.findIndex(p => p.id === prodId);
        if (prodIndex === -1) return null;

        db.products[prodIndex] = {
            ...db.products[prodIndex],
            ...updates
        };
        writeDb(db);
        return db.products[prodIndex];
    }
}

async function deleteProduct(prodId) {
    if (usePostgres) {
        await checkInit();
        try {
            const res = await pool.query('DELETE FROM products WHERE id = $1', [prodId]);
            return res.rowCount > 0;
        } catch (err) {
            console.error('Error deleting product from Postgres:', err);
            return false;
        }
    } else {
        const db = readDb();
        const prodIndex = db.products.findIndex(p => p.id === prodId);
        if (prodIndex === -1) return false;

        db.products.splice(prodIndex, 1);
        writeDb(db);
        return true;
    }
}

async function getDashboardPasswordHash() {
    if (usePostgres) {
        await checkInit();
        try {
            const res = await pool.query("SELECT value FROM settings WHERE key = 'dashboard_password'");
            if (res.rows.length > 0) {
                return res.rows[0].value;
            }
            const defaultPass = 'work';
            return hashPassword(defaultPass);
        } catch (err) {
            console.error('Error getting dashboard password from Postgres:', err);
            const defaultPass = 'work';
            return hashPassword(defaultPass);
        }
    } else {
        const db = readDb();
        if (db.settings && db.settings.dashboard_password) {
            return db.settings.dashboard_password;
        }
        const defaultPass = 'work';
        return hashPassword(defaultPass);
    }
}

async function updateDashboardPassword(newPassword) {
    const hashed = hashPassword(newPassword);
    if (usePostgres) {
        await checkInit();
        try {
            await pool.query(
                "INSERT INTO settings (key, value) VALUES ('dashboard_password', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                [hashed]
            );
            return true;
        } catch (err) {
            console.error('Error updating dashboard password in Postgres:', err);
            return false;
        }
    } else {
        const db = readDb();
        db.settings = db.settings || {};
        db.settings.dashboard_password = hashed;
        return writeDb(db);
    }
}

async function verifyDashboardPassword(inputPassword) {
    const hashed = await getDashboardPasswordHash();
    return verifyPassword(inputPassword, hashed);
}

module.exports = {
    getOrders,
    addOrder,
    updateOrder,
    updateOrderBySessionId,
    getOrderBySessionId,
    getMetrics,
    getProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getDashboardPasswordHash,
    updateDashboardPassword,
    verifyDashboardPassword
};
