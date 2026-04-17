/**
 * CampusIQ — script.js
 * Full role-based issue management: Student | Admin | Staff
 * Features: AI image detection, duplicate detection, inappropriate content filter,
 *           staff assignment (min 1, max 4), status flow, priority system
 */

// ═══════════════════════════════════════════════
//  AUTH GUARD
// ═══════════════════════════════════════════════
const rawUser = localStorage.getItem('campusiq_user');
if (!rawUser) window.location.href = 'login.html';

// ═══════════════════════════════════════════════
//  GLOBALS
// ═══════════════════════════════════════════════
const currentUser = JSON.parse(rawUser);  // { username, role, name?, category? }
const isAdmin     = currentUser.role === 'admin';
const isStaff     = currentUser.role === 'staff';
const isStudent   = currentUser.role === 'student';

const ISSUES_KEY  = 'campusiq_issues';
const USERS_KEY   = 'campusiq_users';

let allIssues   = [];
let currentView = 'all';
let statusFilter= 'all';

// Issue being assigned / updated (modal state)
let activeIssueId       = null;
let selectedStaffIds    = [];
let resolvedPhotoData   = null;
let issuePrivacy        = 'public';

// ── Priority map — higher number = higher priority ──
const PRIORITY = {
  'Sexual Assault': 10,
  'Ragging':        9,
  'Safety':         8,
  'Electrical':     7,
  'Plumbing':       6,
  'IT / Network':   5,
  'Infrastructure': 4,
  'Cleanliness':    3,
  'Academic':       2,
  'Administrative': 1,
  'Canteen / Food': 1,
  'Other':          0,
};

// ── Inappropriate keywords ──
const BAD_WORDS = ['abuse', 'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'cunt', 'dick', 'porn', 'kill', 'murder'];

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Dark mode
  if (localStorage.getItem('campusiq_dark') === 'true') {
    document.body.classList.add('dark');
    document.getElementById('moonIcon').style.display = 'none';
    document.getElementById('sunIcon').style.display  = 'block';
  }

  // Sidebar user info
  const displayName = currentUser.name || currentUser.username;
  document.getElementById('sidebarUsername').textContent = displayName;
  document.getElementById('sidebarRole').textContent     = currentUser.role;
  document.getElementById('sidebarAvatar').textContent   = displayName[0].toUpperCase();

  // Role-based UI
  if (isAdmin) {
    document.querySelectorAll('.student-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.staff-only').forEach(el => el.style.display = 'none');
    document.getElementById('adminCategorySub').textContent = `Category: ${currentUser.category}`;
    showSection('admin');
    loadAdminIssues();
  } else if (isStaff) {
    document.querySelectorAll('.student-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.staff-only').forEach(el => el.style.display = 'block');
    showSection('staff');
    loadStaffIssues();
  } else {
    // Student
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.staff-only').forEach(el => el.style.display = 'none');
    autoFillStudentForm();
    showSection('dashboard');
    updateDashboardStats();
  }
});

// ═══════════════════════════════════════════════
//  AUTO-FILL STUDENT FORM FROM SESSION
// ═══════════════════════════════════════════════
function autoFillStudentForm() {
  if (!isStudent) return;
  const users   = getUsers();
  const student = users.students.find(s => s.id === currentUser.username);
  if (student) {
    document.getElementById('f_name').value   = student.name   || '';
    document.getElementById('f_phone').value  = student.phone  || '';
    document.getElementById('f_branch').value = student.branch || '';
  }
}

// ═══════════════════════════════════════════════
//  DARK MODE
// ═══════════════════════════════════════════════
function toggleDark() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('campusiq_dark', isDark);
  document.getElementById('moonIcon').style.display = isDark ? 'none'  : 'block';
  document.getElementById('sunIcon').style.display  = isDark ? 'block' : 'none';
}

// ═══════════════════════════════════════════════
//  SIDEBAR
// ═══════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

// ═══════════════════════════════════════════════
//  SECTION NAVIGATION
// ═══════════════════════════════════════════════
const SECTIONS = {
  dashboard: { id: 'sectionDashboard', title: 'Dashboard',        sub: 'Your issue reporting overview' },
  submit:    { id: 'sectionSubmit',    title: 'Report an Issue',  sub: 'Fill in the details below' },
  issues:    { id: 'sectionIssues',    title: 'Issues',           sub: '' },
  admin:     { id: 'sectionAdmin',     title: 'Admin Panel',      sub: 'Manage reported issues' },
  staff:     { id: 'sectionStaff',     title: 'My Assignments',   sub: 'Issues assigned to you' },
};

function showSection(name) {
  Object.values(SECTIONS).forEach(s => document.getElementById(s.id).classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  const s = SECTIONS[name];
  if (!s) return;
  document.getElementById(s.id).classList.remove('hidden');
  document.getElementById('topbarTitle').textContent = s.title;
  document.getElementById('searchWrap').style.display = name === 'issues' ? 'flex' : 'none';
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ═══════════════════════════════════════════════
//  STORAGE HELPERS
// ═══════════════════════════════════════════════
function getIssues() {
  return JSON.parse(localStorage.getItem(ISSUES_KEY) || '[]');
}
function saveIssues(issues) {
  localStorage.setItem(ISSUES_KEY, JSON.stringify(issues));
}
function getUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : { students: [], admins: [], staff: [] };
}

// ═══════════════════════════════════════════════
//  DASHBOARD STATS (Student)
// ═══════════════════════════════════════════════
function updateDashboardStats() {
  const issues = getIssues().filter(i => i.user === currentUser.username);
  document.getElementById('statTotal').textContent      = issues.length;
  document.getElementById('statPending').textContent    = issues.filter(i => i.status === 'Pending').length;
  document.getElementById('statInProgress').textContent = issues.filter(i => i.status === 'In Progress').length;
  document.getElementById('statResolved').textContent   = issues.filter(i => i.status === 'Resolved').length;
  document.getElementById('statSatisfied').textContent  = issues.filter(i => i.satisfied).length;
}

// ═══════════════════════════════════════════════
//  PRIVACY TOGGLE
// ═══════════════════════════════════════════════
function setPrivacy(mode) {
  issuePrivacy = mode;
  document.getElementById('privPublic').classList.toggle('active', mode === 'public');
  document.getElementById('privPrivate').classList.toggle('active', mode === 'private');
}

// ═══════════════════════════════════════════════
//  FILE UPLOAD & AI IMAGE DETECTION
// ═══════════════════════════════════════════════
function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;

  // AI image detection simulation
  const warningEl = document.getElementById('aiImageWarning');
  warningEl.style.display = 'none';
  warningEl.textContent = '';

  let suspicions = [];

  // Check 1: Missing metadata (too small for a real photo)
  if (file.size < 5000) {
    suspicions.push('File size is unusually small — may be a fake/generated image.');
  }
  // Check 2: Abnormally large (could be manipulated)
  if (file.size > 10 * 1024 * 1024) {
    suspicions.push('File size is very large — please ensure this is a genuine photo.');
  }
  // Check 3: Non-standard format name patterns
  if (/dalle|ai_gen|midjourney|stable|generated/i.test(file.name)) {
    suspicions.push('Filename suggests this may be an AI-generated image.');
  }

  if (suspicions.length > 0) {
    warningEl.innerHTML = `⚠️ <strong>Image Warning:</strong> ${suspicions.join(' ')}`;
    warningEl.style.display = 'block';
  }

  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('photoPreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('fileDropText').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

// ═══════════════════════════════════════════════
//  INAPPROPRIATE CONTENT DETECTION
// ═══════════════════════════════════════════════
function hasInappropriateContent(text) {
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w));
}

// ═══════════════════════════════════════════════
//  DUPLICATE ISSUE DETECTION
// ═══════════════════════════════════════════════
function findSimilarIssues(title, description) {
  const issues = getIssues().filter(i => i.user === currentUser.username);
  const queryWords = (title + ' ' + description).toLowerCase().split(/\s+/).filter(w => w.length > 3);

  return issues.filter(issue => {
    const issueText = (issue.title + ' ' + (issue.description || '')).toLowerCase();
    const matchCount = queryWords.filter(w => issueText.includes(w)).length;
    return matchCount >= Math.max(2, Math.floor(queryWords.length * 0.4));
  });
}

// ═══════════════════════════════════════════════
//  SUBMIT ISSUE
// ═══════════════════════════════════════════════
function submitIssue(e) {
  e.preventDefault();

  const name        = document.getElementById('f_name').value.trim();
  const phone       = document.getElementById('f_phone').value.trim();
  const branch      = document.getElementById('f_branch').value.trim();
  const title       = document.getElementById('f_title').value.trim();
  const location    = document.getElementById('f_location').value.trim();
  const category    = document.getElementById('f_category').value;
  const description = document.getElementById('f_description').value.trim();
  const photoEl     = document.getElementById('f_photo');

  if (!title || !location || !category) {
    showSubmitMsg('Please fill in all required fields.', 'error');
    return;
  }

  // Inappropriate content check
  if (hasInappropriateContent(title) || hasInappropriateContent(description)) {
    showSubmitMsg('⚠️ Submission blocked: offensive language detected. Please revise your content.', 'error');
    return;
  }

  // Duplicate detection
  const similar = findSimilarIssues(title, description);
  if (similar.length > 0) {
    const proceed = confirm(`⚠️ Possible Duplicate: You may have already reported a similar issue ("${similar[0].title}"). Do you still want to submit?`);
    if (!proceed) return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Submitting…';

  const readPhoto = () => new Promise(resolve => {
    const file = photoEl.files[0];
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target.result);
    reader.readAsDataURL(file);
  });

  readPhoto().then(photo => {
    const issue = {
      id:          Date.now().toString(),
      user:        currentUser.username,
      name,
      phone,
      branch,
      title,
      location,
      category,
      description,
      privacy:     issuePrivacy,
      status:      'Pending',
      satisfied:   false,
      assignedTo:  [],    // array of staff IDs
      photo:       photo || null,
      resolvedPhoto: null,
      createdAt:   new Date().toISOString(),
      resolvedAt:  null,
      priority:    PRIORITY[category] || 0,
    };

    const issues = getIssues();
    issues.unshift(issue);
    saveIssues(issues);

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
        Submit Issue`;
      showSubmitMsg('✓ Issue submitted successfully!', 'success');
      resetForm();
      updateDashboardStats();
      setTimeout(() => loadIssues('mine'), 1500);
    }, 700);
  });
}

function showSubmitMsg(msg, type) {
  const el = document.getElementById('submitMsg');
  el.textContent = msg;
  el.className = 'submit-msg ' + type;
  setTimeout(() => { el.textContent = ''; el.className = 'submit-msg'; }, 5000);
}

function resetForm() {
  document.getElementById('issueForm').reset();
  document.getElementById('photoPreview').style.display = 'none';
  document.getElementById('fileDropText').textContent = 'Click to upload an image';
  document.getElementById('aiImageWarning').style.display = 'none';
  issuePrivacy = 'public';
  document.getElementById('privPublic').classList.add('active');
  document.getElementById('privPrivate').classList.remove('active');
  autoFillStudentForm();
}

// ═══════════════════════════════════════════════
//  LOAD & RENDER ISSUES (Student / generic)
// ═══════════════════════════════════════════════
function loadIssues(view) {
  currentView = view;
  showSection('issues');

  const titleEl = document.getElementById('issuesTitle');
  const subEl   = document.getElementById('issuesSub');
  if (view === 'mine') {
    titleEl.textContent = 'My Issues';
    subEl.textContent   = 'Issues you have reported';
  } else {
    titleEl.textContent = 'All Issues';
    subEl.textContent   = 'All reported issues';
  }

  document.getElementById('spinnerWrap').classList.remove('hidden');
  document.getElementById('issuesGrid').innerHTML = '';
  document.getElementById('emptyState').classList.add('hidden');

  setTimeout(() => {
    document.getElementById('spinnerWrap').classList.add('hidden');
    renderIssues();
  }, 400);
}

function renderIssues() {
  let issues = getIssues();

  // Student: filter by ownership; hide private issues of others
  if (isStudent) {
    if (currentView === 'mine') {
      issues = issues.filter(i => i.user === currentUser.username);
    } else {
      issues = issues.filter(i => i.privacy !== 'private' || i.user === currentUser.username);
    }
  }

  // Filter by status
  if (statusFilter !== 'all') {
    issues = issues.filter(i => i.status === statusFilter);
  }

  // Search
  const query = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  if (query) {
    issues = issues.filter(i =>
      i.title.toLowerCase().includes(query) ||
      i.location.toLowerCase().includes(query) ||
      i.category.toLowerCase().includes(query) ||
      (i.name || '').toLowerCase().includes(query)
    );
  }

  allIssues = issues;
  const grid  = document.getElementById('issuesGrid');
  const empty = document.getElementById('emptyState');

  if (!issues.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    document.getElementById('emptyMsg').textContent =
      currentView === 'mine' ? "You haven't submitted any issues yet." : "No issues match your criteria.";
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = issues.map(issue => buildIssueCard(issue)).join('');
}

// ═══════════════════════════════════════════════
//  BUILD ISSUE CARD (Student view)
// ═══════════════════════════════════════════════
function buildIssueCard(issue) {
  const isOwner   = isStudent && issue.user === currentUser.username;
  const statusCls = { Pending: 'badge-pending', 'In Progress': 'badge-progress', Resolved: 'badge-resolved' }[issue.status] || 'badge-pending';
  const date      = new Date(issue.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const priorityLabel = issue.priority >= 8 ? '🔴 High' : issue.priority >= 5 ? '🟡 Medium' : '🟢 Low';

  let satisfiedHTML = '';
  if (issue.satisfied) {
    satisfiedHTML = `<span class="satisfied-tag">✓ Satisfied</span>`;
  } else if (isOwner && issue.status === 'Resolved') {
    satisfiedHTML = `<button class="btn-satisfied" onclick="markSatisfied('${issue.id}')">Mark Satisfied</button>`;
  }

  let detailsHTML = '';
  if (isStudent) {
    detailsHTML = `
      <div class="issue-info">
        <div class="info-row"><span class="info-label">Name</span><span class="info-value">${escHtml(issue.name)}</span></div>
        <div class="info-row"><span class="info-label">Branch</span><span class="info-value">${escHtml(issue.branch)}</span></div>
        ${issue.description ? `<div class="info-row"><span class="info-label">Details</span><span class="info-value">${escHtml(issue.description)}</span></div>` : ''}
        <div class="info-row"><span class="info-label">Privacy</span><span class="info-value">${issue.privacy === 'private' ? '🔒 Private' : '🌐 Public'}</span></div>
      </div>`;
  }

  const photoHTML = issue.photo
    ? `<img src="${issue.photo}" class="issue-photo-thumb" alt="Issue photo" onclick="openModal('${issue.id}')" title="Click to enlarge"/>`
    : '';

  const resolvedPhotoHTML = issue.resolvedPhoto
    ? `<img src="${issue.resolvedPhoto}" class="issue-photo-thumb" alt="Resolved photo" onclick="openModalDirect('${issue.resolvedPhoto}')" title="Resolved photo"/>`
    : '';

  const resolvedDate = issue.resolvedAt
    ? `<div class="info-row"><span class="info-label">Resolved</span><span class="info-value">${new Date(issue.resolvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>`
    : '';

  return `
    <div class="issue-card" id="card-${issue.id}">
      <div class="issue-card-header">
        <span class="issue-title">${escHtml(issue.title)}</span>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;">
          <span class="issue-badge ${statusCls}">${issue.status}</span>
          <span class="priority-tag">${priorityLabel}</span>
        </div>
      </div>
      <div class="issue-card-body">
        <div class="issue-meta">
          <span class="meta-chip">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
            ${escHtml(issue.location)}
          </span>
          <span class="meta-chip">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
            ${escHtml(issue.category)}
          </span>
        </div>
        ${detailsHTML}
        ${resolvedDate}
      </div>
      ${photoHTML}
      ${resolvedPhotoHTML}
      <div class="issue-card-footer">
        <span class="issue-date">${date}</span>
        ${satisfiedHTML}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════
//  FILTER & SEARCH
// ═══════════════════════════════════════════════
function filterByStatus(status, btn) {
  statusFilter = status;
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderIssues();
}

function filterIssues() {
  renderIssues();
}

// ═══════════════════════════════════════════════
//  MARK SATISFIED (Student, only when Resolved)
// ═══════════════════════════════════════════════
function markSatisfied(id) {
  const issues = getIssues();
  const idx    = issues.findIndex(i => i.id === id);
  if (idx === -1) return;

  const issue = issues[idx];
  if (issue.user !== currentUser.username || issue.status !== 'Resolved') return;

  issues[idx].satisfied = true;
  saveIssues(issues);
  renderIssues();
  updateDashboardStats();
}

// ═══════════════════════════════════════════════
//  ADMIN: LOAD ISSUES FOR CATEGORY
// ═══════════════════════════════════════════════
function loadAdminIssues() {
  const issues = getIssues()
    .filter(i => i.category === currentUser.category)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));  // highest priority first

  // Update admin stats
  document.getElementById('adminStatTotal').textContent      = issues.length;
  document.getElementById('adminStatPending').textContent    = issues.filter(i => i.status === 'Pending').length;
  document.getElementById('adminStatInProgress').textContent = issues.filter(i => i.status === 'In Progress').length;
  document.getElementById('adminStatResolved').textContent   = issues.filter(i => i.status === 'Resolved').length;

  const container = document.getElementById('adminIssuesList');
  if (!issues.length) {
    container.innerHTML = `<div class="empty-state" style="padding:2rem;"><h3>No issues in your category</h3><p>Issues for "${currentUser.category}" will appear here.</p></div>`;
    return;
  }

  container.innerHTML = `<div class="issues-grid">${issues.map(issue => buildAdminCard(issue)).join('')}</div>`;
}

// ─── Build admin issue card ───
function buildAdminCard(issue) {
  const statusCls = { Pending: 'badge-pending', 'In Progress': 'badge-progress', Resolved: 'badge-resolved' }[issue.status] || 'badge-pending';
  const date      = new Date(issue.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const priorityLabel = issue.priority >= 8 ? '🔴 High' : issue.priority >= 5 ? '🟡 Medium' : '🟢 Low';

  // Assigned staff names
  const users = getUsers();
  const assignedNames = (issue.assignedTo || []).map(sid => {
    const s = users.staff.find(st => st.staffId === sid);
    return s ? s.name : sid;
  });
  const assignedHTML = assignedNames.length
    ? `<div class="assigned-list"><span class="info-label">Assigned:</span> ${assignedNames.map(n => `<span class="staff-chip">${escHtml(n)}</span>`).join('')}</div>`
    : '';

  const canDelete = issue.satisfied;
  const deleteBtn = canDelete ? `<button class="btn-delete" onclick="deleteIssue('${issue.id}')">Delete</button>` : '';

  const resolvedDate = issue.resolvedAt
    ? `<div class="info-row"><span class="info-label">Resolved</span><span class="info-value">${new Date(issue.resolvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>`
    : '';

  const photoHTML = issue.photo
    ? `<img src="${issue.photo}" class="issue-photo-thumb" alt="Issue photo" onclick="openModal('${issue.id}')" title="Click to enlarge"/>`
    : '';

  return `
    <div class="issue-card" id="card-${issue.id}">
      <div class="issue-card-header">
        <span class="issue-title">${escHtml(issue.title)}</span>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
          <span class="issue-badge ${statusCls}">${issue.status}</span>
          <span class="priority-tag">${priorityLabel}</span>
        </div>
      </div>
      <div class="issue-card-body">
        <div class="issue-meta">
          <span class="meta-chip"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>${escHtml(issue.location)}</span>
          <span class="meta-chip"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>${escHtml(issue.name || issue.user)}</span>
        </div>
        <div class="issue-info">
          <div class="info-row"><span class="info-label">Branch</span><span class="info-value">${escHtml(issue.branch || '—')}</span></div>
          ${issue.description ? `<div class="info-row"><span class="info-label">Details</span><span class="info-value">${escHtml(issue.description)}</span></div>` : ''}
          ${resolvedDate}
        </div>
        ${assignedHTML}
      </div>
      ${photoHTML}
      <div class="issue-card-footer">
        <span class="issue-date">${date}</span>
        <button class="btn-status btn-assign" onclick="openAssignModal('${issue.id}')">
          ${assignedNames.length ? 'Edit Assignment' : 'Assign Staff'}
        </button>
        ${issue.satisfied ? `<span class="satisfied-tag">✓ Satisfied</span>` : ''}
        ${deleteBtn}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════
//  ADMIN: ASSIGN STAFF MODAL
// ═══════════════════════════════════════════════
function openAssignModal(issueId) {
  activeIssueId    = issueId;
  selectedStaffIds = [];

  const issues = getIssues();
  const issue  = issues.find(i => i.id === issueId);
  if (!issue) return;

  selectedStaffIds = [...(issue.assignedTo || [])];

  document.getElementById('assignIssueTitle').textContent = `Issue: ${issue.title}`;
  document.getElementById('assignError').textContent = '';

  // Get staff of same category
  const users        = getUsers();
  const eligibleStaff = users.staff.filter(s => s.category === currentUser.category);

  if (!eligibleStaff.length) {
    document.getElementById('staffList').innerHTML = `<p style="color:var(--text-2);font-size:.875rem;">No staff registered for "${currentUser.category}" category yet.</p>`;
  } else {
    document.getElementById('staffList').innerHTML = eligibleStaff.map(s => `
      <label class="staff-option ${selectedStaffIds.includes(s.staffId) ? 'selected' : ''}" id="soption-${s.staffId}">
        <input type="checkbox" value="${s.staffId}"
          ${selectedStaffIds.includes(s.staffId) ? 'checked' : ''}
          onchange="toggleStaffSelection('${s.staffId}', this)"/>
        <div class="staff-option-info">
          <span class="staff-option-name">${escHtml(s.name)}</span>
          <span class="staff-option-id">${escHtml(s.staffId)} · ${escHtml(s.category)}</span>
        </div>
      </label>`).join('');
  }

  document.getElementById('assignModal').classList.remove('hidden');
}

function toggleStaffSelection(staffId, checkbox) {
  if (checkbox.checked) {
    if (selectedStaffIds.length >= 4) {
      checkbox.checked = false;
      document.getElementById('assignError').textContent = 'Maximum 4 staff can be assigned per issue.';
      return;
    }
    selectedStaffIds.push(staffId);
    document.getElementById(`soption-${staffId}`)?.classList.add('selected');
  } else {
    selectedStaffIds = selectedStaffIds.filter(id => id !== staffId);
    document.getElementById(`soption-${staffId}`)?.classList.remove('selected');
  }
  document.getElementById('assignError').textContent = '';
}

function confirmAssign() {
  if (selectedStaffIds.length === 0) {
    document.getElementById('assignError').textContent = 'Please select at least 1 staff member.';
    return;
  }

  const issues = getIssues();
  const idx    = issues.findIndex(i => i.id === activeIssueId);
  if (idx === -1) return;

  issues[idx].assignedTo = [...selectedStaffIds];
  if (issues[idx].status === 'Pending') {
    issues[idx].status = 'In Progress';
  }
  saveIssues(issues);
  closeAssignModal();
  loadAdminIssues();
}

function closeAssignModal() {
  document.getElementById('assignModal').classList.add('hidden');
  activeIssueId    = null;
  selectedStaffIds = [];
}

// ═══════════════════════════════════════════════
//  ADMIN: DELETE ISSUE (only when satisfied)
// ═══════════════════════════════════════════════
function deleteIssue(id) {
  if (!isAdmin) return;
  const issues = getIssues();
  const issue  = issues.find(i => i.id === id);
  if (!issue?.satisfied) {
    alert('Issue can only be deleted after the student marks it as satisfied.');
    return;
  }
  if (!confirm(`Delete issue "${issue.title}"? This cannot be undone.`)) return;
  saveIssues(issues.filter(i => i.id !== id));
  loadAdminIssues();
}

// ═══════════════════════════════════════════════
//  STAFF: LOAD ASSIGNED ISSUES
// ═══════════════════════════════════════════════
function loadStaffIssues() {
  const issues = getIssues().filter(i =>
    Array.isArray(i.assignedTo) && i.assignedTo.includes(currentUser.username)
  );

  const container = document.getElementById('staffIssuesList');
  if (!issues.length) {
    container.innerHTML = `<div class="empty-state" style="padding:2rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:48px;height:48px;opacity:.3;"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><h3>No assignments yet</h3><p>Issues assigned to you will appear here.</p></div>`;
    return;
  }

  container.innerHTML = `<div class="issues-grid">${issues.map(issue => buildStaffCard(issue)).join('')}</div>`;
}

// ─── Build staff issue card ───
function buildStaffCard(issue) {
  const statusCls = { Pending: 'badge-pending', 'In Progress': 'badge-progress', Resolved: 'badge-resolved' }[issue.status] || 'badge-pending';
  const date      = new Date(issue.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const priorityLabel = issue.priority >= 8 ? '🔴 High' : issue.priority >= 5 ? '🟡 Medium' : '🟢 Low';

  const photoHTML = issue.photo
    ? `<img src="${issue.photo}" class="issue-photo-thumb" alt="Issue photo" onclick="openModal('${issue.id}')" title="Click to enlarge"/>`
    : '';

  const resolvedPhotoHTML = issue.resolvedPhoto
    ? `<img src="${issue.resolvedPhoto}" class="issue-photo-thumb" alt="Resolved photo" style="border-top:2px solid var(--success);"/>`
    : '';

  return `
    <div class="issue-card" id="card-${issue.id}">
      <div class="issue-card-header">
        <span class="issue-title">${escHtml(issue.title)}</span>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
          <span class="issue-badge ${statusCls}">${issue.status}</span>
          <span class="priority-tag">${priorityLabel}</span>
        </div>
      </div>
      <div class="issue-card-body">
        <div class="issue-meta">
          <span class="meta-chip"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>${escHtml(issue.location)}</span>
          <span class="meta-chip">${escHtml(issue.category)}</span>
        </div>
        <div class="issue-info">
          ${issue.description ? `<div class="info-row"><span class="info-label">Details</span><span class="info-value">${escHtml(issue.description)}</span></div>` : ''}
          <div class="info-row"><span class="info-label">Reported</span><span class="info-value">${date}</span></div>
          ${issue.resolvedAt ? `<div class="info-row"><span class="info-label">Resolved</span><span class="info-value">${new Date(issue.resolvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>` : ''}
        </div>
      </div>
      ${photoHTML}
      ${resolvedPhotoHTML}
      <div class="issue-card-footer">
        <span class="issue-date">${date}</span>
        <button class="btn-status btn-assign" onclick="openStatusModal('${issue.id}')">Update Status</button>
        ${issue.satisfied ? `<span class="satisfied-tag">✓ Satisfied</span>` : ''}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════
//  STAFF: UPDATE STATUS MODAL
// ═══════════════════════════════════════════════
function openStatusModal(issueId) {
  activeIssueId    = issueId;
  resolvedPhotoData = null;

  const issues = getIssues();
  const issue  = issues.find(i => i.id === issueId);
  if (!issue) return;

  document.getElementById('statusIssueTitle').textContent = `Issue: ${issue.title}`;
  document.getElementById('statusSelect').value = issue.status;
  document.getElementById('resolvedPhotoGroup').style.display = issue.status === 'Resolved' ? 'block' : 'none';
  document.getElementById('resolvedPhotoText').textContent = 'Click to upload photo';

  document.getElementById('statusModal').classList.remove('hidden');

  // Show/hide resolved photo section based on select
  document.getElementById('statusSelect').onchange = function () {
    document.getElementById('resolvedPhotoGroup').style.display = this.value === 'Resolved' ? 'block' : 'none';
  };
}

function handleResolvedPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    resolvedPhotoData = e.target.result;
    document.getElementById('resolvedPhotoText').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

function confirmStatusUpdate() {
  const newStatus = document.getElementById('statusSelect').value;
  const issues    = getIssues();
  const idx       = issues.findIndex(i => i.id === activeIssueId);
  if (idx === -1) return;

  issues[idx].status = newStatus;
  if (newStatus === 'Resolved') {
    issues[idx].resolvedAt = new Date().toISOString();
    if (resolvedPhotoData) {
      issues[idx].resolvedPhoto = resolvedPhotoData;
    }
  } else {
    issues[idx].resolvedAt = null;
  }

  saveIssues(issues);
  closeStatusModal();
  loadStaffIssues();
}

function closeStatusModal() {
  document.getElementById('statusModal').classList.add('hidden');
  activeIssueId    = null;
  resolvedPhotoData = null;
}

// ═══════════════════════════════════════════════
//  PHOTO MODAL
// ═══════════════════════════════════════════════
function openModal(id) {
  const issues = getIssues();
  const issue  = issues.find(i => i.id === id);
  if (!issue?.photo) return;
  document.getElementById('modalImg').src = issue.photo;
  document.getElementById('photoModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function openModalDirect(src) {
  document.getElementById('modalImg').src = src;
  document.getElementById('photoModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('photoModal').classList.add('hidden');
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════
//  LOGOUT
// ═══════════════════════════════════════════════
function logout() {
  localStorage.removeItem('campusiq_user');
  window.location.href = 'login.html';
}

// ═══════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
