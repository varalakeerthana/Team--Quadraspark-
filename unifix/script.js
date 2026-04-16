/**
 * CampusIQ — Issue Reporting System
 * script.js — Full application logic (v2)
 * Roles: Student | Admin | Staff
 */

// ═══════════════════════════════════════════════
//  AUTH GUARD
// ═══════════════════════════════════════════════
const rawUser = localStorage.getItem('campusiq_user');
if (!rawUser) window.location.href = 'login.html';

// ═══════════════════════════════════════════════
//  GLOBALS
// ═══════════════════════════════════════════════
const currentUser = JSON.parse(rawUser); // { username, role, category?, name? }
const isAdmin     = currentUser.role === 'admin';
const isStaff     = currentUser.role === 'staff';
const isStudent   = currentUser.role === 'student';
const ISSUES_KEY  = 'campusiq_issues';

let allIssues    = [];
let currentView  = 'all';   // 'all' | 'mine' | 'assigned'
let statusFilter = 'all';

// Predefined priority by category
const PRIORITY_MAP = {
  'Sexual Assault': 'Critical',
  'Ragging':        'Critical',
  'Safety':         'High',
  'Electrical':     'High',
  'Plumbing':       'Medium',
  'Network':        'Medium',
  'Cleanliness':    'Low',
  'Infrastructure': 'Medium',
  'Academic':       'Low',
  'Administrative': 'Low',
  'Canteen / Food': 'Low',
  'Other':          'Low',
};

// Profanity filter (basic)
const BAD_WORDS = ['spam', 'fake', 'cheat', 'abuse', 'scam'];

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Dark mode persistence
  if (localStorage.getItem('campusiq_dark') === 'true') {
    document.body.classList.add('dark');
    document.getElementById('moonIcon').style.display = 'none';
    document.getElementById('sunIcon').style.display  = 'block';
  }

  // Fill sidebar user info
  const displayName = currentUser.name || currentUser.username;
  document.getElementById('sidebarUsername').textContent = displayName;
  document.getElementById('sidebarRole').textContent     = currentUser.role + (currentUser.category ? ` · ${currentUser.category}` : '');
  document.getElementById('sidebarAvatar').textContent   = displayName[0].toUpperCase();

  // Hide all role-specific nav items first
  document.querySelectorAll('.student-only').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.admin-only').forEach(el   => el.style.display = 'none');
  document.querySelectorAll('.staff-only').forEach(el   => el.style.display = 'none');

  // Show relevant nav items based on role
  if (isStudent) {
    document.querySelectorAll('.student-only').forEach(el => el.style.display = '');
    showSection('dashboard');
    updateDashboardStats();
  } else if (isAdmin) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    document.getElementById('adminPanelSub').textContent =
      `Managing issues${currentUser.category !== 'All' ? ` · Category: ${currentUser.category}` : ''}`;
    showSection('admin');
  } else if (isStaff) {
    document.querySelectorAll('.staff-only').forEach(el => el.style.display = '');
    document.getElementById('staffPanelSub').textContent = `Category: ${currentUser.category}`;
    showSection('staff');
  }
});

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
  dashboard: { id: 'sectionDashboard', title: 'Dashboard' },
  submit:    { id: 'sectionSubmit',    title: 'Report an Issue' },
  issues:    { id: 'sectionIssues',    title: 'Issues' },
  admin:     { id: 'sectionAdmin',     title: 'Admin Panel' },
  staff:     { id: 'sectionStaff',     title: 'My Assignments' },
};

function showSection(name) {
  Object.values(SECTIONS).forEach(s => document.getElementById(s.id)?.classList.add('hidden'));
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

// ═══════════════════════════════════════════════
//  DASHBOARD STATS (student)
// ═══════════════════════════════════════════════
function updateDashboardStats() {
  const issues = getIssues().filter(i => i.user === currentUser.username);
  document.getElementById('statTotal').textContent     = issues.length;
  document.getElementById('statPending').textContent   = issues.filter(i => i.status === 'Pending').length;
  document.getElementById('statResolved').textContent  = issues.filter(i => i.status === 'Resolved').length;
  document.getElementById('statSatisfied').textContent = issues.filter(i => i.satisfied).length;
}

// ═══════════════════════════════════════════════
//  VISIBILITY TOGGLE
// ═══════════════════════════════════════════════
let issueVisibility = 'public';

function setVisibility(vis) {
  issueVisibility = vis;
  document.getElementById('visPublic').classList.toggle('active', vis === 'public');
  document.getElementById('visPrivate').classList.toggle('active', vis === 'private');
  document.getElementById('visNote').textContent = vis === 'public'
    ? 'Your name and contact details will be visible to admins and staff.'
    : 'Your personal details will be hidden from other students. Only admins can see them.';
}

// ═══════════════════════════════════════════════
//  FILE UPLOAD & PREVIEW
// ═══════════════════════════════════════════════
function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;

  const fakeWarn = document.getElementById('fakeImageWarning');

  // ── AI-SIMULATED: Fake image detection ──
  // Flag if file is suspiciously small (< 5KB) or has unexpected mime mismatch
  const isSuspicious = file.size < 5120; // < 5 KB
  fakeWarn.style.display = isSuspicious ? 'block' : 'none';

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
//  AI-SIMULATED FEATURES
// ═══════════════════════════════════════════════

/** Duplicate detection: compare title + location */
function checkDuplicate(title, location) {
  const issues = getIssues();
  const t = title.toLowerCase().trim();
  const l = location.toLowerCase().trim();
  return issues.find(i =>
    i.title.toLowerCase().trim() === t &&
    i.location.toLowerCase().trim() === l
  );
}

/** Inappropriate content detection */
function checkInappropriate(text) {
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w));
}

// ═══════════════════════════════════════════════
//  SUBMIT ISSUE (student only)
// ═══════════════════════════════════════════════
function submitIssue(e) {
  e.preventDefault();
  if (!isStudent) return;

  const name     = document.getElementById('f_name').value.trim();
  const phone    = document.getElementById('f_phone').value.trim();
  const branch   = document.getElementById('f_branch').value.trim();
  const title    = document.getElementById('f_title').value.trim();
  const location = document.getElementById('f_location').value.trim();
  const category = document.getElementById('f_category').value;
  const photoEl  = document.getElementById('f_photo');

  // Basic validation
  if (!name || !phone || !branch || !title || !location || !category) {
    showSubmitMsg('Please fill in all required fields.', 'error'); return;
  }
  if (!/^\d{10}$/.test(phone)) {
    showSubmitMsg('Phone must be exactly 10 digits.', 'error'); return;
  }

  // ── AI: Inappropriate content check ──
  if (checkInappropriate(title)) {
    showSubmitMsg('⚠ Issue title contains inappropriate content. Please revise.', 'error'); return;
  }

  // ── AI: Duplicate detection ──
  const dup = checkDuplicate(title, location);
  if (dup) {
    const proceed = confirm(`⚠ A similar issue titled "${dup.title}" at "${dup.location}" already exists (ID: ${dup.id}). Do you still want to submit?`);
    if (!proceed) return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  const readPhoto = () => new Promise(resolve => {
    const file = photoEl.files[0];
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target.result);
    reader.readAsDataURL(file);
  });

  readPhoto().then(photo => {
    const issue = {
      id:            Date.now().toString(),
      user:          currentUser.username,
      name,
      phone,
      branch,
      title,
      location,
      category,
      priority:      PRIORITY_MAP[category] || 'Low',
      status:        'Pending',
      visibility:    issueVisibility,
      assignedStaff: null,
      satisfied:     false,
      photo:         photo || null,
      resolvedImage: null,
      reportedDate:  new Date().toISOString(),
      resolvedDate:  null,
    };

    const issues = getIssues();
    issues.unshift(issue);
    saveIssues(issues);

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg> Submit Issue`;
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
  document.getElementById('fakeImageWarning').style.display = 'none';
  issueVisibility = 'public';
  setVisibility('public');
}

// ═══════════════════════════════════════════════
//  LOAD & RENDER ISSUES
// ═══════════════════════════════════════════════
function loadIssues(view) {
  currentView  = view;
  statusFilter = 'all';

  // Reset filter chips
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-chip')?.classList.add('active');

  showSection('issues');

  const titles = {
    all:      { title: 'All Issues',       sub: 'All reported issues across campus' },
    mine:     { title: 'My Issues',        sub: 'Issues you have submitted' },
    assigned: { title: 'Assigned to Me',   sub: 'Issues assigned to you for resolution' },
  };
  const t = titles[view] || titles.all;
  document.getElementById('issuesTitle').textContent = t.title;
  document.getElementById('issuesSub').textContent   = t.sub;

  document.getElementById('spinnerWrap').classList.remove('hidden');
  document.getElementById('issuesGrid').innerHTML = '';
  document.getElementById('emptyState').classList.add('hidden');

  setTimeout(() => {
    document.getElementById('spinnerWrap').classList.add('hidden');
    renderIssues();
  }, 500);
}

function renderIssues() {
  let issues = getIssues();

  // ── Filter by view ──
  if (currentView === 'mine') {
    issues = issues.filter(i => i.user === currentUser.username);
  } else if (currentView === 'assigned') {
    // Staff sees issues in their category OR explicitly assigned to them
    issues = issues.filter(i =>
      i.category === currentUser.category ||
      (i.assignedStaff && i.assignedStaff.toLowerCase().includes((currentUser.name || '').toLowerCase()))
    );
  } else if (isAdmin && currentUser.category !== 'All') {
    // Admin with specific category sees only their category
    issues = issues.filter(i => i.category === currentUser.category);
  }

  // ── Filter by status ──
  if (statusFilter !== 'all') {
    issues = issues.filter(i => i.status === statusFilter);
  }

  // ── Search ──
  const query = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  if (query) {
    issues = issues.filter(i =>
      i.title.toLowerCase().includes(query)    ||
      i.location.toLowerCase().includes(query) ||
      i.category.toLowerCase().includes(query) ||
      (i.name || '').toLowerCase().includes(query)
    );
  }

  // ── Sort by priority (Critical > High > Medium > Low) then date ──
  const pOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  issues.sort((a, b) => (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4) || new Date(b.reportedDate) - new Date(a.reportedDate));

  allIssues = issues;
  const grid  = document.getElementById('issuesGrid');
  const empty = document.getElementById('emptyState');

  if (!issues.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    document.getElementById('emptyMsg').textContent =
      currentView === 'mine'     ? "You haven't submitted any issues yet." :
      currentView === 'assigned' ? "No issues are assigned to you yet."    :
                                   "No issues match your current filter.";
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = issues.map(issue => buildIssueCard(issue)).join('');
}

// ═══════════════════════════════════════════════
//  BUILD ISSUE CARD
// ═══════════════════════════════════════════════
function buildIssueCard(issue) {
  const isOwner   = isStudent && issue.user === currentUser.username;
  const statusCls = issue.status === 'Pending'     ? 'badge-pending'    :
                    issue.status === 'In Progress'  ? 'badge-inprogress' : 'badge-resolved';
  const priorityCls = `priority-${(issue.priority || 'low').toLowerCase()}`;

  const reportedDate = new Date(issue.reportedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const resolvedDate = issue.resolvedDate
    ? new Date(issue.resolvedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // ── Satisfied section ──
  let satisfiedHTML = '';
  if (issue.satisfied) {
    satisfiedHTML = `<span class="satisfied-tag">✓ Satisfied</span>`;
  } else if (isOwner && issue.status === 'Resolved') {
    satisfiedHTML = `<button class="btn-satisfied" onclick="markSatisfied('${issue.id}')">Mark Satisfied</button>`;
  }

  // ── Admin actions ──
  let adminActionsHTML = '';
  if (isAdmin) {
    const canDelete = issue.status === 'Resolved' && issue.satisfied;
    adminActionsHTML = `
      <button class="btn-status btn-assign" onclick="openAssignModal('${issue.id}')">
        ${issue.assignedStaff ? `✎ ${escHtml(issue.assignedStaff)}` : '+ Assign Staff'}
      </button>
      ${canDelete ? `<button class="btn-delete" onclick="deleteIssue('${issue.id}')">Delete</button>` : ''}
    `;
  }

  // ── Staff actions ──
  let staffActionsHTML = '';
  if (isStaff) {
    const canProgress = issue.status === 'Pending';
    const canResolve  = issue.status === 'In Progress';
    staffActionsHTML = `
      ${canProgress ? `<button class="btn-status btn-inprogress" onclick="setStatus('${issue.id}', 'In Progress')">Mark In Progress</button>` : ''}
      ${canResolve  ? `<button class="btn-status btn-resolved"   onclick="openResolvedImgModal('${issue.id}')">Mark Resolved</button>` : ''}
    `;
  }

  // ── Personal details visibility ──
  let detailsHTML = '';
  const showDetails = isAdmin || isStaff || isOwner ||
    (isStudent && issue.visibility === 'public');

  if (showDetails) {
    detailsHTML = `
      <div class="issue-info">
        <div class="info-row"><span class="info-label">Name</span><span class="info-value">${escHtml(issue.name)}</span></div>
        <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${isAdmin || isStaff || isOwner ? escHtml(issue.phone) : '•••••••••'}</span></div>
        <div class="info-row"><span class="info-label">Branch</span><span class="info-value">${escHtml(issue.branch)}</span></div>
        ${isAdmin || isStaff ? `<div class="info-row"><span class="info-label">Reporter</span><span class="info-value">${escHtml(issue.user)}</span></div>` : ''}
        ${issue.assignedStaff ? `<div class="info-row"><span class="info-label">Staff</span><span class="info-value staff-name">${escHtml(issue.assignedStaff)}</span></div>` : ''}
        ${resolvedDate ? `<div class="info-row"><span class="info-label">Resolved</span><span class="info-value">${resolvedDate}</span></div>` : ''}
      </div>`;
  } else {
    detailsHTML = `<p class="private-note">🔒 Reporter details are private</p>`;
  }

  // ── Photo ──
  const photoHTML = issue.photo
    ? `<img src="${issue.photo}" class="issue-photo-thumb" alt="Issue photo" onclick="openPhotoModal('${issue.id}', 'photo')" title="Click to enlarge"/>`
    : '';
  const resolvedPhotoHTML = issue.resolvedImage
    ? `<img src="${issue.resolvedImage}" class="issue-photo-thumb resolved-img" alt="Resolved photo" onclick="openPhotoModal('${issue.id}', 'resolvedImage')" title="Resolved — click to enlarge"/>`
    : '';

  return `
    <div class="issue-card" id="card-${issue.id}">
      <div class="issue-card-header">
        <div>
          <span class="issue-title">${escHtml(issue.title)}</span>
          <span class="priority-badge ${priorityCls}">${issue.priority || 'Low'}</span>
        </div>
        <span class="issue-badge ${statusCls}">${issue.status}</span>
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
          ${issue.visibility === 'private' && !isAdmin && !isStaff ? '<span class="meta-chip privacy-chip">🔒 Private</span>' : ''}
        </div>
        ${detailsHTML}
      </div>
      ${photoHTML}
      ${resolvedPhotoHTML}
      <div class="issue-card-footer">
        <span class="issue-date">Reported: ${reportedDate}</span>
        ${satisfiedHTML}
        ${adminActionsHTML}
        ${staffActionsHTML}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════
//  FILTER BY STATUS
// ═══════════════════════════════════════════════
function filterByStatus(status, btn) {
  statusFilter = status;
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderIssues();
}

function filterIssues() { renderIssues(); }

// ═══════════════════════════════════════════════
//  SET STATUS (Staff: Pending → In Progress → Resolved)
// ═══════════════════════════════════════════════
function setStatus(id, newStatus) {
  if (!isStaff && !isAdmin) return;
  const issues = getIssues();
  const idx    = issues.findIndex(i => i.id === id);
  if (idx === -1) return;
  issues[idx].status = newStatus;
  if (newStatus === 'Resolved') issues[idx].resolvedDate = new Date().toISOString();
  saveIssues(issues);
  renderIssues();
}

// ═══════════════════════════════════════════════
//  MARK SATISFIED (student owner, status = Resolved)
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
//  DELETE ISSUE (admin only, resolved + satisfied)
// ═══════════════════════════════════════════════
function deleteIssue(id) {
  if (!isAdmin) return;
  const issues = getIssues();
  const issue  = issues.find(i => i.id === id);
  if (!issue) return;
  if (issue.status !== 'Resolved' || !issue.satisfied) {
    alert('Issue can only be deleted after it is Resolved AND the student marks Satisfied.');
    return;
  }
  if (!confirm(`Delete issue "${issue.title}"? This cannot be undone.`)) return;
  saveIssues(issues.filter(i => i.id !== id));
  renderIssues();
}

// ═══════════════════════════════════════════════
//  ASSIGN STAFF MODAL (admin)
// ═══════════════════════════════════════════════
let assigningIssueId = null;

function openAssignModal(id) {
  assigningIssueId = id;
  const issue = getIssues().find(i => i.id === id);
  document.getElementById('assignIssueTitle').textContent = `Issue: "${issue?.title}"`;
  document.getElementById('assignStaffName').value = issue?.assignedStaff || '';
  document.getElementById('assignStaffCategory').value = issue?.category || '';
  document.getElementById('assignModal').classList.remove('hidden');
}

function closeAssignModal() {
  document.getElementById('assignModal').classList.add('hidden');
  assigningIssueId = null;
}

function confirmAssign() {
  const staffName = document.getElementById('assignStaffName').value.trim();
  const staffCat  = document.getElementById('assignStaffCategory').value;
  if (!staffName || !staffCat) { alert('Please enter staff name and category.'); return; }

  const issues = getIssues();
  const idx    = issues.findIndex(i => i.id === assigningIssueId);
  if (idx === -1) return;
  issues[idx].assignedStaff         = staffName;
  issues[idx].assignedStaffCategory = staffCat;
  saveIssues(issues);
  closeAssignModal();
  renderIssues();
}

// ═══════════════════════════════════════════════
//  RESOLVED IMAGE MODAL (staff)
// ═══════════════════════════════════════════════
let resolvingIssueId = null;
let resolvedImgData  = null;

function openResolvedImgModal(id) {
  resolvingIssueId = id;
  resolvedImgData  = null;
  document.getElementById('resolvedImgPreview').style.display = 'none';
  document.getElementById('resolvedImgDropText').textContent = 'Click to upload';
  document.getElementById('resolvedImgInput').value = '';
  document.getElementById('resolvedImgModal').classList.remove('hidden');
}

function closeResolvedImgModal() {
  document.getElementById('resolvedImgModal').classList.add('hidden');
  resolvingIssueId = null;
  resolvedImgData  = null;
}

function previewResolvedImg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    resolvedImgData = e.target.result;
    document.getElementById('resolvedImgPreview').src = resolvedImgData;
    document.getElementById('resolvedImgPreview').style.display = 'block';
    document.getElementById('resolvedImgDropText').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

function confirmResolvedImg() {
  if (!resolvingIssueId) return;
  const issues = getIssues();
  const idx    = issues.findIndex(i => i.id === resolvingIssueId);
  if (idx === -1) return;
  issues[idx].status        = 'Resolved';
  issues[idx].resolvedDate  = new Date().toISOString();
  issues[idx].resolvedImage = resolvedImgData || null;
  saveIssues(issues);
  closeResolvedImgModal();
  renderIssues();
}

// ═══════════════════════════════════════════════
//  PHOTO MODAL
// ═══════════════════════════════════════════════
function openPhotoModal(id, field) {
  const issue = getIssues().find(i => i.id === id);
  if (!issue || !issue[field]) return;
  document.getElementById('modalImg').src = issue[field];
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
