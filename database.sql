CREATE DATABASE recampus;

-- Connect to recampus before running the statements below.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    college_id INTEGER,
    course VARCHAR(100),
    year INTEGER,
    role VARCHAR(20) DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS colleges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    location VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES users(id),
    college_id INTEGER REFERENCES colleges(id),
    category_id INTEGER REFERENCES categories(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    condition VARCHAR(50),
    image VARCHAR(255),
    status VARCHAR(30) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(30) DEFAULT 'pending',
    order_status VARCHAR(30) DEFAULT 'placed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    seller_id INTEGER NOT NULL REFERENCES users(id),
    price DECIMAL(10,2) NOT NULL,
    quantity INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    reviewer_id INTEGER NOT NULL REFERENCES users(id),
    seller_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO colleges (name, location)
SELECT 'Demo College', 'Mumbai'
WHERE NOT EXISTS (SELECT 1 FROM colleges WHERE name = 'Demo College');

INSERT INTO categories (name)
SELECT 'Academic Books'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Academic Books');

INSERT INTO categories (name)
SELECT 'Hostel Items'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Hostel Items');

INSERT INTO categories (name)
SELECT 'Electronics'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Electronics');

INSERT INTO categories (name)
SELECT 'Stationery'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Stationery');
