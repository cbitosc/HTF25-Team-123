
let currentUser = null;
let allPatients = [];
let allAppointments = [];
let allStaff = [];

// 🌟 HELPER FUNCTION: Formats the ID based on the user's role 🌟
function formatId(id, role) {
    // Note: The internal DB ID is used here, not the custom ID (username)
    if (role === 'Doctor') {
        return Dr-${id};
    }
    if (role === 'Receptionist') {
        return Rec-${id};
    }
    if (role === 'Admin') {
        return Adm-${id};
    }
    return id;
}

// ----------------------------------------------------------------------
// NEW STAFF MANAGEMENT FUNCTIONS
// ----------------------------------------------------------------------

function showEditStaffModal(id, username, name, role, availability) {
    document.getElementById('edit-staff-id').value = id;
    document.getElementById('edit-staff-role').value = role;
    document.getElementById('edit-staff-username').value = username; // This is the custom Staff ID (e.g., D101)
    document.getElementById('edit-staff-name').value = name; // This is the readable name
    
    // Display formatted IDs in the modal
    document.getElementById('display-staff-id').textContent = id; // Show internal DB ID
    document.getElementById('display-staff-role').textContent = role;

    const availabilityContainer = document.getElementById('edit-availability-container');
    const availabilityInput = document.getElementById('edit-staff-availability');

    if (role === 'Doctor') {
        availabilityContainer.classList.remove('d-none');
        availabilityInput.value = availability || '';
    } else {
        availabilityContainer.classList.add('d-none');
        availabilityInput.value = '';
    }

    const modal = new bootstrap.Modal(document.getElementById('editStaffModal'));
    modal.show();
}

function handleEditStaffForm(e) {
    e.preventDefault();
    const id = document.getElementById('edit-staff-id').value;
    const username = document.getElementById('edit-staff-username').value; // Staff ID
    const name = document.getElementById('edit-staff-name').value; // Staff Name
    const role = document.getElementById('edit-staff-role').value;
    let available_days = (role === 'Doctor') ? document.getElementById('edit-staff-availability').value : undefined;

    const payload = {
        id: id,
        username: username,
        name: name,
    };
    if (role === 'Doctor') {
        payload.available_days = available_days;
    }

    fetch('/staff/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            bootstrap.Modal.getInstance(document.getElementById('editStaffModal')).hide();
            loadStaff(); // Reload the staff list
            loadAppointments(); // Refresh appointments as names/IDs may have changed
        } else {
            alert(data.error || 'Failed to update staff.');
        }
    });
}

// NEW: Function to handle staff deletion
function removeStaff(id, username) {
    if (!confirm(Are you sure you want to permanently remove ${username} (DB ID: ${id})? This action cannot be undone.)) {
        return;
    }

    fetch(/staff/${id}, {
        method: 'DELETE',
    })
    .then(res => res.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            loadStaff();
        } else {
            alert(data.error || 'Failed to remove staff member.');
        }
    })
    .catch(error => {
        console.error('Delete staff error:', error);
        alert('A network error occurred while attempting to delete the staff member.');
    });
}


// Show availability input only when Doctor is selected in the Add Staff form
document.getElementById('new-staff-role').addEventListener('change', (e) => {
    const container = document.getElementById('availability-input-container');
    if (e.target.value === 'Doctor') {
        container.classList.remove('d-none');
    } else {
        container.classList.add('d-none');
    }
});

// Handle Add Staff form submission (UPDATED)
document.getElementById('add-staff-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const custom_id = document.getElementById('new-staff-username').value; 
    const staff_name = document.getElementById('new-staff-name').value; // Get the new name
    const role = document.getElementById('new-staff-role').value;
    const availabilityInput = document.getElementById('new-staff-availability');
    const available_days = (role === 'Doctor') ? availabilityInput.value : '';
    const messageElement = document.getElementById('add-staff-message');

    messageElement.textContent = 'Adding...';

    fetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_id, staff_name, role, available_days }) // Send name to backend
    })
    .then(res => res.json())
    .then(data => {
        if (data.message) {
            messageElement.textContent = data.message;
            messageElement.classList.remove('text-danger');
            messageElement.classList.add('text-success');
            document.getElementById('add-staff-form').reset();
            loadStaff(); // Refresh the list
        } else {
            messageElement.textContent = data.error || 'Failed to add staff.';
            messageElement.classList.remove('text-success');
            messageElement.classList.add('text-danger');
        }
    });
});

document.getElementById('edit-staff-form').addEventListener('submit', handleEditStaffForm);


// ----------------------------------------------------------------------
// CORE APPLICATION LOGIC
// ----------------------------------------------------------------------

function completeAppointment(appointmentId, patientId) {
    if (!confirm("Are you sure this appointment is complete? The patient record will be permanently removed.")) {
        document.getElementById(appointment-check-${appointmentId}).checked = false;
        return;
    }

    fetch('/appointments/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointmentId, patient_id: patientId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            loadData(); 
        } else {
            alert(data.error || 'Failed to complete appointment.');
            document.getElementById(appointment-check-${appointmentId}).checked = false;
        }
    })
    .catch(error => {
        console.error('Completion error:', error);
        alert('A network error occurred while finalizing the appointment.');
        document.getElementById(appointment-check-${appointmentId}).checked = false;
    });
}

function showAuth(view) {
    const loginCard = document.getElementById('login-card');
    const signupCard = document.getElementById('signup-card');
    document.getElementById('login-message').textContent = '';
    document.getElementById('signup-message').textContent = '';

    if (view === 'login') {
        loginCard.style.display = 'block';
        signupCard.style.display = 'none';
    } else if (view === 'signup') {
        loginCard.style.display = 'none';
        signupCard.style.display = 'block';
    }
}

function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.user) {
            currentUser = data.user;
            
            document.getElementById('auth-section').classList.add('d-none');
            document.getElementById('main-section').classList.remove('d-none');
            
            loadData();
            showSection('dashboard');
        } else {
            document.getElementById('login-message').textContent = data.error;
        }
    })
    .catch(error => {
        console.error('Login Fetch Error:', error);
        document.getElementById('login-message').textContent = 'Could not connect to server.';
    });
}

function confirmLogout() {
    const modal = new bootstrap.Modal(document.getElementById('logoutModal'));
    modal.show();
}

function logout() {
    currentUser = null;
    
    document.getElementById('auth-section').classList.remove('d-none');
    document.getElementById('main-section').classList.add('d-none');
    
    document.getElementById('login-form').reset();
    showAuth('login');

    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('logoutModal'));
    if (modalInstance) {
        modalInstance.hide();
    }
}

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    document.getElementById(section + '-section').style.display = 'block';
}

function loadData() {
    loadPatients();
    loadAppointments();
    loadStaff();
    updateDashboard();
}

function updateDashboard() {
    document.getElementById('total-patients').textContent = allPatients.length;
    document.getElementById('total-appointments').textContent = allAppointments.length;
    document.getElementById('total-staff').textContent = allStaff.length;
}

function loadPatients() {
    document.getElementById('patient-spinner').style.display = 'block';
    fetch('/patients')
    .then(res => res.json())
    .then(patients => {
        allPatients = patients;
        renderPatients(patients);
        document.getElementById('patient-spinner').style.display = 'none';
        updateDashboard();
    });
}

function renderPatients(patients) {
    const list = document.getElementById('patient-list');
    list.innerHTML = '';
    patients.forEach(p => {
        list.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">
            <span><strong>ID: ${p.id}</strong> - ${p.name}, Age: ${p.age}, Condition: ${p.condition}</span>
        </li>`;
    });
}

function loadAppointments() {
    document.getElementById('appointment-spinner').style.display = 'block';
    fetch('/appointments')
    .then(res => res.json())
    .then(appointments => {
        allAppointments = appointments.sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
        renderAppointments(appointments);
        document.getElementById('appointment-spinner').style.display = 'none';
        updateDashboard();
    });
}

// Renders appointments with checkbox logic and formatted doctor ID
function renderAppointments(appointments) {
    const list = document.getElementById('appointment-list');
    list.innerHTML = '';
    appointments.forEach(a => {
        // Find the staff member's role based on their custom ID (a.doctor_id)
        // Note: The appointment API now returns doctor_staff_id and doctor_name
        
        let formattedStaffId = a.doctor_staff_id || 'N/A';
        
        list.innerHTML += `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            <div>
                <strong>Patient:</strong> ${a.patient_name} (ID: ${a.patient_id}) | 
                <strong>Staff:</strong> ${a.doctor_name} (${formattedStaffId}) | 
                <strong>Date:</strong> ${a.date} | 
                <strong>Time:</strong> ${a.time}
            </div>
            <div class="form-check">
                <input class="form-check-input" type="checkbox" 
                       id="appointment-check-${a.id}" 
                       onchange="completeAppointment(${a.id}, ${a.patient_id})">
                <label class="form-check-label" for="appointment-check-${a.id}">
                    Complete
                </label>
            </div>
        </li>`;
    });
}

function filterToday() {
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = allAppointments.filter(a => a.date === today);
    renderAppointments(todayAppointments);
}

// Loads and renders staff categorized by role
function loadStaff() {
    document.getElementById('staff-spinner').style.display = 'block';
    fetch('/staff')
    .then(res => res.json())
    .then(staff => {
        allStaff = staff;
        renderStaff(staff);
        document.getElementById('staff-spinner').style.display = 'none';
        updateDashboard();
    });
}

// Renders staff, applying the formatted ID
function renderStaff(staff) {
    // Clear all categorized lists
    document.getElementById('staff-list-Doctor').innerHTML = '';
    document.getElementById('staff-list-Receptionist').innerHTML = '';
    document.getElementById('staff-list-Admin').innerHTML = '';

    staff.forEach(s => {
        const listId = staff-list-${s.role};
        const list = document.getElementById(listId);
        
        // Doctor availability display
        let availabilityHtml = s.role === 'Doctor' ? 
            <span class="badge bg-secondary ms-2">${s.available_days || 'Not Set'}</span> : '';
        
        // Formatted ID (using the custom username/Staff ID for display)
        const customStaffId = s.username;

        // Edit button setup
        let editButton = `
            <button class="btn btn-sm btn-outline-secondary ms-2" 
                    onclick="showEditStaffModal(${s.id}, '${s.username}', '${s.name}', '${s.role}', '${s.available_days}')">
                <i class="bi bi-pencil"></i>
            </button>`;
        
        // Delete button
        let deleteButton = `
            <button class="btn btn-sm btn-outline-danger ms-1" 
                    onclick="removeStaff(${s.id}, '${s.name}')">
                <i class="bi bi-trash"></i>
            </button>`;

        list.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span>
                    <strong>${s.name}</strong> (${s.role}) 
                    <small class="text-muted">(${customStaffId})</small>
                    ${availabilityHtml}
                </span>
                <div>
                    ${editButton}
                    ${deleteButton}
                </div>
            </li>`;
    });
}


// Search patients
document.getElementById('search-patients').addEventListener('input', e => {
    const query = e.target.value.toLowerCase();
    const filtered = allPatients.filter(p => p.name.toLowerCase().includes(query));
    renderPatients(filtered);
});

// Form submissions
document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    login();
});

document.getElementById('patient-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('patient-name').value;
    const age = document.getElementById('patient-age').value;
    const condition = document.getElementById('patient-condition').value;

    fetch('/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, age, condition })
    }).then(() => {
        loadPatients();
        alert('Patient added successfully!');
    });
});

document.getElementById('appointment-form').addEventListener('submit', e => {
    e.preventDefault();
    const patient_id = document.getElementById('patient-id').value;
    const doctor_id = document.getElementById('doctor-id').value; // This is now the Staff ID (VARCHAR)
    const date = document.getElementById('appointment-date').value;
    const time = document.getElementById('appointment-time').value;

    fetch('/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id, doctor_id, date, time })
    }).then(() => {
        loadAppointments();
        alert('Appointment booked successfully!');
    });
});