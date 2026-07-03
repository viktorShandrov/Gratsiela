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
        filterClass: "hue-rotate(0deg)",
        materials_en: "Acrylic and Gold Leaf on Canvas",
        materials_bg: "Акрил и златно фолио върху платно",
        dimensions: "80x100 cm",
        symbolism_en: "Represents the transitions of life, highlighting moments of abundance and golden memories.",
        symbolism_bg: "Представя преходите на живота, подчертавайки моменти на изобилие и златни спомени."
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
        filterClass: "hue-rotate(45deg)",
        materials_en: "Mixed Media on Canvas",
        materials_bg: "Смесена техника върху платно",
        dimensions: "70x90 cm",
        symbolism_en: "Symbolizes the light hidden in darkness, guiding the soul through mysterious transitions.",
        symbolism_bg: "Символизира светлината, скрита в тъмнината, водеща душата през мистериозни преходи."
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
        filterClass: "hue-rotate(90deg)",
        materials_en: "Mixed Media on Canvas",
        materials_bg: "Смесена техника върху платно",
        dimensions: "100x120 cm",
        symbolism_en: "Explores the dream state, connecting the subconscious mind with waking reality.",
        symbolism_bg: "Изследва състоянието на сън, свързвайки подсъзнанието с будния живот."
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
        filterClass: "contrast(110%)",
        materials_en: "Fine Art Giclée Print on 310gsm Cotton Paper",
        materials_bg: "Giclée принт върху 310g памучна архивна хартия",
        dimensions: "50x70 cm",
        symbolism_en: "A dynamic depiction of creative expression and flow.",
        symbolism_bg: "Динамично изобразяване на творческото себеизразяване и поток."
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
        filterClass: "",
        materials_en: "Limited Edition Fine Art Print",
        materials_bg: "Ограничен тираж художествен принт",
        dimensions: "40x50 cm",
        symbolism_en: "Bridges the gap between structure and fluid emotion.",
        symbolism_bg: "Свързва структурата с флуидната емоция."
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
        filterClass: "",
        materials_en: "Giclée Fine Art Print",
        materials_bg: "Художествен принт (Giclée)",
        dimensions: "30x40 cm",
        symbolism_en: "Contemplates the unseen layers of emotion and desire.",
        symbolism_bg: "Смислено разглежда невидимите пластове емоции и желания."
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
        filterClass: "",
        materials_en: "Hardcover Book, 120 pages",
        materials_bg: "Твърди корици, 120 страници",
        dimensions: "24x30 cm",
        symbolism_en: "An archival journey through creative growth and inspiration.",
        symbolism_bg: "Архивно пътешествие през творческото израстване и вдъхновение."
    },
    {
        id: 'prod_balance',
        name_en: "Balance",
        name_bg: "Баланс",
        price: "€240",
        priceCents: 24000,
        type: "canvas",
        desc_en: "Yellow embodies solar energy, joy, and vitality, while deep blue symbolizes freedom, mystery, and the inner depth of human nature. The painting expresses the idea that every person carries within themselves both a light and a dark side – not as opposites of good and evil, but as forces that find their meaning in balance. The 'dark' side is the ability to protect oneself, to set boundaries, to stand up for justice, and to show character when necessary. Cyclamen accents are a symbol of courage, confidence, charisma, and those bright features that give individuality and completeness to the personality.",
        desc_bg: "Жълтото въплъщава слънчевата енергия, радостта и жизнеността, а дълбокото синьо символизира свободата, мистерията и вътрешната дълбочина на човешката природа. Картината изразява идеята, че всеки човек носи в себе си както светла, така и тъмна страна – не като противоположности на доброто и злото, а като сили, които намират своя смисъл в баланса. „Тъмната“ страна е способността да защитиш себе си, да поставяш граници, да отстояваш справедливостта и да проявяваш характер, когато е необходимо. Цикламените акценти са символ на смелостта, увереността, харизмата и онези ярки черти, които придават индивидуалност и завършеност на личността.",
        image: "/assets/card_artworks.png",
        filterClass: "",
        materials_en: "Oil on Canvas",
        materials_bg: "Маслени бои на платно",
        dimensions: "50x70 cm",
        symbolism_en: "Explores the coexistence of light and dark sides of human nature, showing how boundaries and strength form a harmonious whole.",
        symbolism_bg: "Изследва съвместното съществуване на светлата и тъмната страна на човешката природа, показвайки как границите и силата образуват хармонично цяло."
    },
    {
        id: 'prod_fate',
        name_en: "Fate (Diptych)",
        name_bg: "Съдба (Диптих)",
        price: "€800",
        priceCents: 80000,
        type: "canvas",
        desc_en: "Diptych consisting of two companion paintings: 'Before the Meeting' and 'In Harmony'. Together, the two artworks tell a story of destiny – that kindred souls do not find each other by chance, but rather fate quietly guides them toward one another until the perfect moment arrives for their paths to cross and build a shared future.",
        desc_bg: "Диптих от две картини: „Преди среща“ и „В хармония“. Заедно двете картини разказват история за предопределението – че някои души не се намират сякаш случайно, а реално съдбата тихо ги води една към друга, докато настъпи точният момент те да се срещнат и изградят своя общ път.",
        image: "/assets/card_artworks.png",
        filterClass: "",
        materials_en: "Oil on Canvas",
        materials_bg: "Маслени бои на платно",
        dimensions: "2x (60x60) cm",
        symbolism_en: "Left painting - 'Before the Meeting': Symbolizes the invisible map of life – the path fate maps out long before two kindred souls cross paths. Forms and lines remind us that every event, choice, and experience is part of a grand design. Right painting - 'In Harmony': Represents life after the meeting – a state of mutual completion, balance, and inner peace. Different shapes and colors exist in unity, showing that true connection is built on acceptance and trust.",
        symbolism_bg: "Лява картина – „Преди среща“: Тази картина символизира невидимата карта на живота – пътят, който съдбата е начертала много преди две сродни души да се срещнат. Формите и линиите напомнят, че всяко събитие, избор и преживяване е част от един по-голям замисъл, който постепенно ги води един към друг. Това е моментът, в който съдбата вече е решила, че техните пътища ще се пресекат, макар те все още да не го осъзнават. Дясна картина – „В хармония“: Втората творба представя живота след срещата – състояние на взаимно допълване, баланс и вътрешен мир. Различните форми и цветове съществуват в единство, символизирайки, че истинската връзка се изгражда чрез приемане, доверие и общ ритъм. Тя е отражение на хармонията, която две сродни души създават, когато намерят своето място една до друга."
    },
    {
        id: 'prod_under_protection',
        name_en: "Under Protection",
        name_bg: "Под закрила",
        price: "€1,200",
        priceCents: 120000,
        type: "canvas",
        desc_en: "The painting represents two kindred souls seen from a heavenly point of view – as if through the eyes of God, who quietly watches over them and arranges events in the best way. Abstract shapes recreate the ocean and the sandy shore as a symbol of tranquility, romance, and the eternal bond between two souls. The artwork reminds us that true love brings a sense of harmony, security, and protection, and some relationships are blessed to enhance the energy of the planet, improving relationships and understanding. The message shows that quality relationships are truly what gives meaning to this world.",
        desc_bg: "Картината представя две сродни души, видени от небесна гледна точка – сякаш през погледа на Бог, който тихо бди над тях и нарежда събитията по най-добрия начин. Абстрактните форми пресъздават океана и пясъчния бряг като символ на спокойствието, романтиката и вечната връзка между две души. Творбата напомня, че истинската любов носи усещане за хармония, сигурност и закрила, а някои връзки са благословени с цел засилване на енергията на планетата. В следствие света се подобрява в качествата на взаимоотношенията и разбирателството. Посланието на картината показва, че качествените взаимоотношения са реално това, което дава смисъл на този свят.",
        image: "/assets/card_artworks.png",
        filterClass: "",
        materials_en: "Oil on Canvas",
        materials_bg: "Маслени бои на платно",
        dimensions: "уточняват се при запитване",
        symbolism_en: "Traces the protective guidance over soul connections, using oceanic structures and shores to represent peace, romance, and spiritual blessings.",
        symbolism_bg: "Проследява закрилящото напътствие над връзките между душите, използвайки океански структури и брегове за символизиране на мир, романтика и духовна благословия."
    },
    {
        id: 'prod_blossoming',
        name_en: "Blossoming",
        name_bg: "Процъфтяване",
        price: "€1,200",
        priceCents: 120000,
        type: "canvas",
        desc_en: "Like a bouquet of peonies, this painting symbolizes love, abundance, and the blossoming of life. Among the colors, two kindred souls stand out, living in luxury, romance, and meaningful depth, turning every moment into a beautiful experience. Like peonies, their connection blossoms over time and reminds us that true love brings beauty, prosperity, and inner wealth at the same time.",
        desc_bg: "Като букет от божури, тази картина символизира любовта, изобилието и процъфтяването на живота. Сред цветовете се открояват две сродни души, които живеят в разкош, романтика и смислова дълбочина, превръщайки всеки миг в красиво преживяване. Подобно на божурите, тяхната връзка разцъфтява с времето и напомня, че истинската любов носи едновременно красота, благополучие и вътрешно богатство.",
        image: "/assets/card_artworks.png",
        filterClass: "",
        materials_en: "Oil on Canvas",
        materials_bg: "Маслени бои на платно",
        dimensions: "уточняват се при запитване",
        symbolism_en: "Uses the peony flower motif to portray a blossoming love relationship, highlighting values of luxury, romance, and shared internal abundance.",
        symbolism_bg: "Използва мотива за цъфтящите божури, за да покаже разцъфтяващата любовна връзка, наблягайки на ценности като лукс, романтика и споделено вътрешно изобилие."
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
                filter_class VARCHAR(255) DEFAULT '',
                materials_en VARCHAR(255) DEFAULT '',
                materials_bg VARCHAR(255) DEFAULT '',
                dimensions VARCHAR(255) DEFAULT '',
                symbolism_en TEXT DEFAULT '',
                symbolism_bg TEXT DEFAULT '',
                images TEXT DEFAULT '[]',
                digital_download_url VARCHAR(1000) DEFAULT ''
            )
        `);

        // Migration: Ensure new columns exist in case the table was created previously
        await client.query(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS materials_en VARCHAR(255) DEFAULT '';
            ALTER TABLE products ADD COLUMN IF NOT EXISTS materials_bg VARCHAR(255) DEFAULT '';
            ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions VARCHAR(255) DEFAULT '';
            ALTER TABLE products ADD COLUMN IF NOT EXISTS symbolism_en TEXT DEFAULT '';
            ALTER TABLE products ADD COLUMN IF NOT EXISTS symbolism_bg TEXT DEFAULT '';
            ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT DEFAULT '[]';
            ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_download_url VARCHAR(1000) DEFAULT '';
        `);

        // Settings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT NOT NULL
            )
        `);

        // Check if default products have already been seeded once
        const seedCheckRes = await client.query("SELECT count(*) FROM settings WHERE key = 'default_products_seeded'");
        const seedCheckCount = parseInt(seedCheckRes.rows[0].count, 10);

        if (seedCheckCount === 0) {
            console.log('Seed flag not found. Seeding default products into Postgres...');
            const seedQuery = `
                INSERT INTO products (id, name_en, name_bg, price, price_cents, type, desc_en, desc_bg, image, filter_class, materials_en, materials_bg, dimensions, symbolism_en, symbolism_bg, images, digital_download_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (id) DO NOTHING
            `;
            for (const p of DEFAULT_PRODUCTS) {
                await client.query(seedQuery, [
                    p.id, p.name_en, p.name_bg, p.price, p.priceCents, p.type, p.desc_en, p.desc_bg, p.image, p.filterClass || '',
                    p.materials_en || '', p.materials_bg || '', p.dimensions || '', p.symbolism_en || '', p.symbolism_bg || '',
                    JSON.stringify(p.images || [p.image || 'assets/card_artworks.png']), p.digitalDownloadUrl || ''
                ]);
            }
            // Mark default seeding as complete
            await client.query("INSERT INTO settings (key, value) VALUES ('default_products_seeded', 'true')");
        } else {
            console.log('Default products already seeded once. Skipping seeding to respect admin deletions.');
        }

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
            return res.rows.map(row => {
                let parsedImages = [];
                try {
                    parsedImages = JSON.parse(row.images || '[]');
                } catch(e) {
                    parsedImages = [];
                }
                if (parsedImages.length === 0 && row.image) {
                    parsedImages = [row.image];
                }
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
                    filterClass: row.filter_class,
                    materials_en: row.materials_en,
                    materials_bg: row.materials_bg,
                    dimensions: row.dimensions,
                    symbolism_en: row.symbolism_en,
                    symbolism_bg: row.symbolism_bg,
                    images: parsedImages,
                    digitalDownloadUrl: row.digital_download_url || ''
                };
            });
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
        filterClass: prodData.filterClass || '',
        materials_en: prodData.materials_en || '',
        materials_bg: prodData.materials_bg || '',
        dimensions: prodData.dimensions || '',
        symbolism_en: prodData.symbolism_en || '',
        symbolism_bg: prodData.symbolism_bg || '',
        images: prodData.images || [prodData.image || 'assets/card_artworks.png'],
        digitalDownloadUrl: prodData.digitalDownloadUrl || ''
    };

    if (usePostgres) {
        await checkInit();
        try {
            const query = `
                INSERT INTO products (id, name_en, name_bg, price, price_cents, type, desc_en, desc_bg, image, filter_class, materials_en, materials_bg, dimensions, symbolism_en, symbolism_bg, images, digital_download_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            `;
            await pool.query(query, [
                newProduct.id, newProduct.name_en, newProduct.name_bg, newProduct.price, newProduct.priceCents,
                newProduct.type, newProduct.desc_en, newProduct.desc_bg, newProduct.image, newProduct.filterClass,
                newProduct.materials_en, newProduct.materials_bg, newProduct.dimensions, newProduct.symbolism_en, newProduct.symbolism_bg,
                JSON.stringify(newProduct.images), newProduct.digitalDownloadUrl
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
            if (updates.materials_en !== undefined) { keys.push(`materials_en = $${i++}`); values.push(updates.materials_en); }
            if (updates.materials_bg !== undefined) { keys.push(`materials_bg = $${i++}`); values.push(updates.materials_bg); }
            if (updates.dimensions !== undefined) { keys.push(`dimensions = $${i++}`); values.push(updates.dimensions); }
            if (updates.symbolism_en !== undefined) { keys.push(`symbolism_en = $${i++}`); values.push(updates.symbolism_en); }
            if (updates.symbolism_bg !== undefined) { keys.push(`symbolism_bg = $${i++}`); values.push(updates.symbolism_bg); }
            if (updates.images !== undefined) { keys.push(`images = $${i++}`); values.push(JSON.stringify(updates.images)); }
            if (updates.digitalDownloadUrl !== undefined) { keys.push(`digital_download_url = $${i++}`); values.push(updates.digitalDownloadUrl); }

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

            let parsedImages = [];
            try {
                parsedImages = JSON.parse(row.images || '[]');
            } catch(e) {
                parsedImages = [];
            }
            if (parsedImages.length === 0 && row.image) {
                parsedImages = [row.image];
            }

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
                filterClass: row.filter_class,
                materials_en: row.materials_en,
                materials_bg: row.materials_bg,
                dimensions: row.dimensions,
                symbolism_en: row.symbolism_en,
                symbolism_bg: row.symbolism_bg,
                images: parsedImages,
                digitalDownloadUrl: row.digital_download_url || ''
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
