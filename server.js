const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/')));

// MySQL Connection Configuration
let db;

async function connectDB() {
    try {
        db = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: '', // Default XAMPP/WAMP password is empty
            database: 'gear_galaxy'
        });
        console.log('SUCCESS: Connected to MySQL database "gear_galaxy"');
    } catch (err) {
        console.error('CRITICAL: Could not connect to MySQL.');
        console.error('Error Details:', err.message);
        console.log('--- TROUBLESHOOTING ---');
        console.log('1. Make sure MySQL (XAMPP/WAMP) is RUNNING.');
        console.log('2. Make sure you created a database named "gear_galaxy".');
        console.log('3. If you have a password for MySQL root, update line 23 in server.js');
    }
}

connectDB();

// Middleware to check DB connection
app.use((req, res, next) => {
    if (!db) {
        return res.status(503).json({ error: 'Database not connected. Please check server console for errors.' });
    }
    next();
});

// Owner Signup API
app.post('/api/owner/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, phoneNumber, password } = req.body;
        const query = 'INSERT INTO owners (first_name, last_name, email, phone_number, password) VALUES (?, ?, ?, ?, ?)';
        const [result] = await db.execute(query, [firstName, lastName, email, phoneNumber, password]);
        res.status(201).json({ message: 'Owner registered successfully', ownerId: result.insertId });
    } catch (err) {
        console.error('Error inserting owner:', err.message);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Customer Signup API
app.post('/api/customer/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, phoneNumber, password } = req.body;
        const query = 'INSERT INTO customers (first_name, last_name, email, phone_number, password) VALUES (?, ?, ?, ?, ?)';
        const [result] = await db.execute(query, [firstName, lastName, email, phoneNumber, password]);
        res.status(201).json({ message: 'Customer registered successfully', customerId: result.insertId });
    } catch (err) {
        console.error('Error inserting customer:', err.message);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Add Car API
app.post('/api/cars/add', async (req, res) => {
    try {
        const { ownerId, brand, model, year, color, fuelType, transmission, pricePerDay, description, imagePath } = req.body;
        const query = 'INSERT INTO cars (owner_id, brand, model, year, color, fuel_type, transmission, price_per_day, description, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        const [result] = await db.execute(query, [ownerId, brand, model, year, color, fuelType, transmission, pricePerDay, description, imagePath]);
        res.status(201).json({ message: 'Car added successfully', carId: result.insertId });
    } catch (err) {
        console.error('Error inserting car:', err.message);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get Available Cars
app.get('/api/cars', async (req, res) => {
    try {
        const query = 'SELECT * FROM cars WHERE status = "available"';
        const [results] = await db.execute(query);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Rent a Car
app.post('/api/rentals/create', async (req, res) => {
    const { carId, customerId, startDate, endDate, totalPrice } = req.body;
    
    try {
        await db.beginTransaction();

        const rentalQuery = 'INSERT INTO rentals (car_id, customer_id, start_date, end_date, total_price) VALUES (?, ?, ?, ?, ?)';
        const [rentalResult] = await db.execute(rentalQuery, [carId, customerId, startDate, endDate, totalPrice]);

        const updateCarQuery = 'UPDATE cars SET status = "rented" WHERE id = ?';
        await db.execute(updateCarQuery, [carId]);

        await db.commit();
        res.status(201).json({ message: 'Rental successful', rentalId: rentalResult.insertId });
    } catch (err) {
        await db.rollback();
        console.error('Rental error:', err.message);
        res.status(500).json({ error: 'Rental process failed' });
    }
});

// Get Owner Dashboard Data (Cars + Rentals)
app.get('/api/owner/:ownerId/dashboard', async (req, res) => {
    try {
        const ownerId = req.params.ownerId;
        const query = `
            SELECT c.*, r.start_date, r.end_date, r.total_price, cust.first_name as cust_fname, cust.last_name as cust_lname, cust.email as cust_email, cust.phone_number as cust_phone
            FROM cars c
            LEFT JOIN rentals r ON c.id = r.car_id AND r.status = 'active'
            LEFT JOIN customers cust ON r.customer_id = cust.id
            WHERE c.owner_id = ?
        `;
        const [results] = await db.execute(query, [ownerId]);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Get Customer Rental History
app.get('/api/customer/:customerId/history', async (req, res) => {
    try {
        const customerId = req.params.customerId;
        const query = `
            SELECT r.*, c.brand, c.model, c.image_path
            FROM rentals r
            JOIN cars c ON r.car_id = c.id
            WHERE r.customer_id = ?
            ORDER BY r.created_at DESC
        `;
        const [results] = await db.execute(query, [customerId]);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
