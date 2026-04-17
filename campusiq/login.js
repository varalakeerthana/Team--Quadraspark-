/**
 * CampusIQ — login.js
 * Role-based login & registration: Student, Admin, Staff
 */

// ═══════════════════════════════════════════════
//  REDIRECT IF ALREADY LOGGED IN
// ═══════════════════════════════════════════════
if (localStorage.getItem('campusiq_user')) {
  window.location.href = 'index.html';
}

// ═══════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════
const USERS_KEY = 'campusiq_users';  // { students:[], admins:[], staff:[] }

let currentRole = 'student';
let isRegisterMode = false;

// ═══════════════════════════════════════════════
//  STORAGE HELPERS
// ═══════════════════════════════════════════════
function getUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  if (raw) return JSON.parse(raw);
  // Default seed data
  return { students: [], admins: [], staff: [] };
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ═══════════════════════════════════════════════
//  ROLE SWITCHING
// ═══════════════════════════════════════════════
function setRole(role) {
  currentRole = role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-role="${role}"]`).classList.add('active');

  // Toggle field visibility for login tab
  document.getElementById('studentFields').style.display = role === 'student' ? 'block' : 'none';
  document.getElementById('adminFields').style.display   = role === 'admin'   ? 'block' : 'none';
  document.getElementById('staffFields').style.display   = role === 'staff'   ? 'block' : 'none';

  // Toggle field visibility for register tab
  document.getElementById('regStudentFields').style.display = role === 'student' ? 'block' : 'none';
  document.getElementById('regAdminFields').style.display   = role === 'admin'   ? 'block' : 'none';
  document.getElementById('regStaffFields').style.display   = role === 'staff'   ? 'block' : 'none';

  // Card title
  const titles = { student: 'Student Portal', admin: 'Admin Portal', staff: 'Staff Portal' };
  document.getElementById('cardTitle').textContent = titles[role];

  clearErrors();
}

// ═══════════════════════════════════════════════
//  TAB SWITCHING (Login ↔ Register)
// ═══════════════════════════════════════════════
function switchToRegister() {
  isRegisterMode = true;
  document.getElementById('tabLogin').style.display    = 'none';
  document.getElementById('tabRegister').style.display = 'block';
  document.getElementById('cardSub').textContent = 'Create your account';
  clearErrors();
}

function switchToLogin() {
  isRegisterMode = false;
  document.getElementById('tabLogin').style.display    = 'block';
  document.getElementById('tabRegister').style.display = 'none';
  document.getElementById('cardSub').textContent = 'Sign in to continue';
  clearErrors();
}

// ═══════════════════════════════════════════════
//  TOGGLE PASSWORD VISIBILITY
// ═══════════════════════════════════════════════
function togglePassword(fieldId, iconId) {
  const field = document.getElementById(fieldId);
  field.type = field.type === 'password' ? 'text' : 'password';
}

// ═══════════════════════════════════════════════
//  VALIDATION HELPERS
// ═══════════════════════════════════════════════
function validateStudentId(id) {
  return /^1005\d{8}$/.test(id);
}

function validatePhone(phone) {
  return /^\d{10}$/.test(phone);
}

function validateEmail(email) {
  return /^[^\s@]+@gmail\.com$/i.test(email);
}

function validatePassword(pw) {
  return pw.length >= 8;
}

function showError(msg, elId = 'errorMsg') {
  const el = document.getElementById(elId);
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
  document.getElementById('loginCard').classList.add('shake');
  setTimeout(() => document.getElementById('loginCard').classList.remove('shake'), 500);
}

function clearErrors() {
  ['errorMsg', 'regErrorMsg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; }
  });
}

// ═══════════════════════════════════════════════
//  LOGIN HANDLER
// ═══════════════════════════════════════════════
function handleLogin(e) {
  e.preventDefault();
  clearErrors();

  const password = document.getElementById('password').value.trim();
  const btn      = document.getElementById('loginBtn');
  btn.classList.add('loading');
  document.getElementById('loginBtnText').textContent = 'Signing in';

  setTimeout(() => {
    let user = null;

    if (currentRole === 'student') {
      const id    = document.getElementById('studentId').value.trim();
      const phone = document.getElementById('studentPhone').value.trim();
      const email = document.getElementById('studentEmail').value.trim();

      if (!id || !phone || !email || !password) {
        return fail('Please fill in all fields.');
      }
      if (!validateStudentId(id)) {
        return fail('Student ID must start with 1005 and be exactly 12 digits.');
      }
      if (!validatePhone(phone)) {
        return fail('Phone number must be exactly 10 digits.');
      }
      if (!validateEmail(email)) {
        return fail('Please enter a valid Gmail address (@gmail.com).');
      }
      if (!validatePassword(password)) {
        return fail('Password must be at least 8 characters.');
      }

      const users = getUsers();
      const found = users.students.find(s => s.id === id && s.password === password);
      if (!found) return fail('Invalid student ID or password. Please register first.');
      user = { username: found.id, role: 'student', name: found.name, email: found.email, phone: found.phone, branch: found.branch };

    } else if (currentRole === 'admin') {
      const username = document.getElementById('adminUsername').value.trim();
      const category = document.getElementById('adminCategory').value;

      if (!username || !category || !password) {
        return fail('Please fill in all fields.');
      }
      if (!validatePassword(password)) {
        return fail('Password must be at least 8 characters.');
      }

      const users = getUsers();
      const found = users.admins.find(a => a.username === username && a.password === password && a.category === category);
      if (!found) return fail('Invalid admin credentials. Please register or check your category.');
      user = { username: found.username, role: 'admin', category: found.category };

    } else if (currentRole === 'staff') {
      const name     = document.getElementById('staffName').value.trim();
      const category = document.getElementById('staffCategory').value;
      const staffId  = document.getElementById('staffId').value.trim();

      if (!name || !category || !password) {
        return fail('Please fill in all fields.');
      }
      if (!validatePassword(password)) {
        return fail('Password must be at least 8 characters.');
      }

      const users = getUsers();
      const found = users.staff.find(s =>
        s.name === name &&
        s.category === category &&
        s.password === password &&
        (!staffId || s.staffId === staffId)
      );
      if (!found) return fail('Invalid staff credentials. Please register first.');
      user = { username: found.staffId, role: 'staff', name: found.name, category: found.category };
    }

    if (user) {
      localStorage.setItem('campusiq_user', JSON.stringify(user));
      window.location.href = 'index.html';
    }

    function fail(msg) {
      btn.classList.remove('loading');
      document.getElementById('loginBtnText').textContent = 'Sign In';
      showError(msg, 'errorMsg');
    }
  }, 600);
}

// ═══════════════════════════════════════════════
//  REGISTRATION HANDLER
// ═══════════════════════════════════════════════
function handleRegister(e) {
  e.preventDefault();
  clearErrors();

  const regBtn = document.getElementById('regBtn');
  regBtn.classList.add('loading');
  document.getElementById('regBtnText').textContent = 'Creating account';

  setTimeout(() => {
    const users = getUsers();

    if (currentRole === 'student') {
      const id       = document.getElementById('reg_studentId').value.trim();
      const name     = document.getElementById('reg_name').value.trim();
      const phone    = document.getElementById('reg_phone').value.trim();
      const email    = document.getElementById('reg_email').value.trim();
      const branch   = document.getElementById('reg_branch').value.trim();
      const password = document.getElementById('reg_password').value.trim();
      const confirm  = document.getElementById('reg_confirm').value.trim();

      if (!id || !name || !phone || !email || !branch || !password || !confirm) return failReg('Please fill in all fields.');
      if (!validateStudentId(id)) return failReg('Student ID must start with 1005 and be exactly 12 digits.');
      if (!validatePhone(phone)) return failReg('Phone number must be exactly 10 digits.');
      if (!validateEmail(email)) return failReg('Please enter a valid Gmail address.');
      if (!validatePassword(password)) return failReg('Password must be at least 8 characters.');
      if (password !== confirm) return failReg('Passwords do not match.');
      if (users.students.find(s => s.id === id)) return failReg('Student ID already registered.');

      users.students.push({ id, name, phone, email, branch, password });
      saveUsers(users);
      successReg(`Account created! You can now sign in.`);

    } else if (currentRole === 'admin') {
      const username = document.getElementById('reg_adminUsername').value.trim();
      const category = document.getElementById('reg_adminCategory').value;
      const password = document.getElementById('reg_password').value.trim();
      const confirm  = document.getElementById('reg_confirm').value.trim();

      if (!username || !category || !password || !confirm) return failReg('Please fill in all fields.');
      if (!validatePassword(password)) return failReg('Password must be at least 8 characters.');
      if (password !== confirm) return failReg('Passwords do not match.');
      if (users.admins.find(a => a.category === category)) return failReg(`An admin for "${category}" already exists. Only one admin per category is allowed.`);
      if (users.admins.find(a => a.username === username)) return failReg('Username already taken.');

      users.admins.push({ username, category, password });
      saveUsers(users);
      successReg('Admin account created! You can now sign in.');

    } else if (currentRole === 'staff') {
      const name     = document.getElementById('reg_staffName').value.trim();
      const category = document.getElementById('reg_staffCategory').value;
      const password = document.getElementById('reg_password').value.trim();
      const confirm  = document.getElementById('reg_confirm').value.trim();

      if (!name || !category || !password || !confirm) return failReg('Please fill in all fields.');
      if (!validatePassword(password)) return failReg('Password must be at least 8 characters.');
      if (password !== confirm) return failReg('Passwords do not match.');

      const staffId = 'STF' + Date.now().toString().slice(-6);
      users.staff.push({ staffId, name, category, password });
      saveUsers(users);
      successReg(`Staff account created! Your Staff ID: ${staffId}. Sign in with your details.`);
    }

    function failReg(msg) {
      regBtn.classList.remove('loading');
      document.getElementById('regBtnText').textContent = 'Create Account';
      showError(msg, 'regErrorMsg');
    }

    function successReg(msg) {
      regBtn.classList.remove('loading');
      document.getElementById('regBtnText').textContent = 'Create Account';
      const el = document.getElementById('regErrorMsg');
      el.textContent = msg;
      el.style.color = 'var(--success)';
      setTimeout(() => switchToLogin(), 2500);
    }
  }, 700);
}
