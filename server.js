
const express = require('express');
const sqlite3 = require('sqlite3').verbose(); 
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); 

// SQLite Database Setup
const db = new sqlite3.Database('./hospital.db'); 

// Function to initialize tables and insert sample data
function initializeDatabase() {
    db.serialize(() => {
        // Create tables (UPDATED: Added 'name' to users. 'doctor_id' in appointments now refers to users.username)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE, /* Stores the Staff ID, e.g., D101, R201 */
            name TEXT, /* Stores the staff member's readable name */
            password TEXT,
            role TEXT,
            available_days TEXT DEFAULT ''
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            age INTEGER,
            condition TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            doctor_id TEXT, /* CHANGED: Now stores the Staff ID (username) */
            date TEXT,
            time TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(id),
            FOREIGN KEY (doctor_id) REFERENCES users(username) /* CHANGED: Foreign key references username */
        )`);

        // Insert sample data (username is the ID, name is the full name)
        db.run(INSERT OR IGNORE INTO users (username, name, password, role, available_days) VALUES ('admin', 'System Admin', 'pass123', 'Admin', ''));
        db.run(INSERT OR IGNORE INTO users (username, name, password, role, available_days) VALUES ('D101', 'Dr. Alice Smith', 'pass123', 'Doctor', 'Mon,Wed,Fri'));
        db.run(INSERT OR IGNORE INTO users (username, name, password, role, available_days) VALUES ('R201', 'John Doe', 'pass123', 'Receptionist', ''));
        
        console.log("Database tables checked/created and sample data inserted.");
    });
}

// Simple authentication Middleware (Unchanged)
function authenticate(req, res, next) {
    const { username, password } = req.body;
    db.get(SELECT * FROM users WHERE username = ? AND password = ?, [username, password], (err, user) => {
        if (err || !user) {
            if (err) console.error("Authentication DB Error:", err);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        req.user = user;
        next();
    });
}

// -------------------------------------------------------------------------------------
// API Routes

app.post('/login', authenticate, (req, res) => {
    res.json({ message: 'Login successful', user: req.user });
});

// UPDATED: Signup now handles name and custom_id (as username)
app.post('/signup', (req, res) => {
    const { custom_id, staff_name, role, available_days = '' } = req.body;
    
    const username = custom_id; 
    const default_password = 'temp_password'; 
    const name = staff_name || username; // Use staff_name if provided, otherwise use the ID

    if (!['Doctor', 'Receptionist', 'Admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified.' });
    }

    db.run(INSERT INTO users (username, name, password, role, available_days) VALUES (?, ?, ?, ?, ?), 
           [username, name, default_password, role, available_days], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: ID ${username} already exists. Please choose another. });
            }
            console.error("Signup DB Error:", err);
            return res.status(500).json({ error: 'Server error during sign up.' });
        }
        res.status(201).json({ 
            message: Account created successfully with ID ${username} and default password 'temp_password'., 
            id: this.lastID 
        });
    });
});

// Update staff details (rename, update ID, or set availability)
app.post('/staff/update', (req, res) => {
    const { id, username, name, available_days } = req.body;

    if (!id) return res.status(400).json({ error: 'Internal Staff ID is required for update.' });

    let updates = [];
    let values = [];

    // NOTE: This updates the username (Staff ID), which is the Foreign Key in appointments.
    if (username) {
        updates.push('username = ?');
        values.push(username);
    }
    if (name) {
        updates.push('name = ?');
        values.push(name);
    }
    if (available_days !== undefined) {
        updates.push('available_days = ?');
        values.push(available_days);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields provided for update.' });
    }

    values.push(id); 
    const sql = UPDATE users SET ${updates.join(', ')} WHERE id = ?;

    db.run(sql, values, function(err) {
        if (err) {
            console.error("Staff update error:", err);
            if (err.message.includes('UNIQUE constraint failed')) {
                 return res.status(409).json({ error: ID ${username} already exists. });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Staff updated successfully.' });
    });
});


// Appointment completion and deletion - Unchanged logic, but doctor_id is now TEXT
app.post('/appointments/complete', (req, res) => {
    const { appointment_id, patient_id } = req.body;
    
    if (!appointment_id || !patient_id) {
        return res.status(400).json({ error: 'Missing appointment ID or patient ID.' });
    }
    
    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");

        // 1. Delete the appointment record
        db.run(DELETE FROM appointments WHERE id = ?, [appointment_id], function(err) {
            if (err) {
                db.run("ROLLBACK;");
                console.error("Delete appointment error:", err);
                return res.status(500).json({ error: 'Failed to delete appointment.' });
            }
        });

        // 2. Delete the patient record
        db.run(DELETE FROM patients WHERE id = ?, [patient_id], function(err) {
            if (err) {
                db.run("ROLLBACK;");
                console.error("Delete patient error:", err);
                return res.status(500).json({ error: 'Failed to delete patient.' });
            }
            
            // 3. Commit the transaction if successful
            db.run("COMMIT;", (commitErr) => {
                if (commitErr) {
                    console.error("Commit error:", commitErr);
                    return res.status(500).json({ error: 'Database transaction failed.' });
                }
                res.json({ message: 'Appointment and patient record deleted successfully.' });
            });
        });
    });
});

app.get('/patients', (req, res) => {
    db.all(SELECT * FROM patients, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/patients', (req, res) => {
    const { name, age, condition } = req.body;
    db.run(INSERT INTO patients (name, age, condition) VALUES (?, ?, ?), [name, age, condition], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// UPDATED: Join now selects user 'name' instead of 'username' for the doctor's readable name
app.get('/appointments', (req, res) => {
    db.all(`SELECT a.*, p.name AS patient_name, p.id AS patient_id, u.name AS doctor_name, u.username AS doctor_staff_id 
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN users u ON a.doctor_id = u.username`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// UPDATED: Appointment booking now expects doctor_id (Staff ID) as TEXT
app.post('/appointments', (req, res) => {
    const { patient_id, doctor_id, date, time } = req.body;
    db.run(INSERT INTO appointments (patient_id, doctor_id, date, time) VALUES (?, ?, ?, ?), [patient_id, doctor_id, date, time], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.get('/staff', (req, res) => {
    // Selects both the internal DB ID and the custom Staff ID (username) and readable name
    db.all(SELECT id, username, name, role, available_days FROM users, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Start server
initializeDatabase(); 
app.listen(PORT, () => {
    console.log(Server running on http://localhost:${PORT});
});