const PB_URL = 'https://pb.nolimitnexus.com';
let adminToken = null;
let currentAdmin = null;

const dom = {
    authOverlay: document.getElementById('auth-overlay'),
    authForm: document.getElementById('auth-form'),
    authEmail: document.getElementById('auth-email'),
    authPassword: document.getElementById('auth-password'),
    authError: document.getElementById('auth-error'),
    appContainer: document.getElementById('app-container'),
    navItems: document.querySelectorAll('.nav-item'),
    sections: document.querySelectorAll('.page-section'),
    pageTitle: document.getElementById('page-title'),
    logoutBtn: document.getElementById('logout-btn'),
    currentAdminEmail: document.getElementById('current-admin-email'),
    toastContainer: document.getElementById('toast-container'),
    
    // Stats
    statCollections: document.getElementById('stat-collections'),
    statUsers: document.getElementById('stat-users'),
    statSuperusers: document.getElementById('stat-superusers'),
    systemOverview: document.getElementById('system-overview-card'),
    
    // Lists
    collectionsList: document.getElementById('collections-list'),
    superusersList: document.getElementById('superusers-list'),
    usersList: document.getElementById('users-list'),
    
    // Records
    collectionRecords: document.getElementById('collection-records'),
    recordsTitle: document.getElementById('records-title'),
    recordsThead: document.getElementById('records-thead'),
    recordsTbody: document.getElementById('records-tbody'),
    backToCollections: document.getElementById('back-to-collections')
};

// Initialization
lucide.createIcons();
checkAuth();

async function checkAuth() {
    const saved = localStorage.getItem('pb_admin_auth');
    if (saved) {
        try {
            const { token, model } = JSON.parse(saved);
            const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-refresh`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                adminToken = data.token;
                currentAdmin = data.record;
                localStorage.setItem('pb_admin_auth', JSON.stringify({ token: adminToken, model: currentAdmin }));
                enterApp();
                return;
            }
        } catch (e) { console.warn('Auth refresh failed'); }
        localStorage.removeItem('pb_admin_auth');
    }
    showAuth();
}

function showAuth() {
    dom.authOverlay.classList.remove('hidden');
    dom.appContainer.classList.add('hidden');
}

async function enterApp() {
    dom.authOverlay.classList.add('hidden');
    dom.appContainer.classList.remove('hidden');
    dom.currentAdminEmail.textContent = currentAdmin.email;
    dom.currentAdminEmail.title = currentAdmin.email;
    
    loadDashboard();
}

dom.authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    dom.authError.classList.add('hidden');
    const email = dom.authEmail.value;
    const password = dom.authPassword.value;

    try {
        const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: email, password })
        });
        
        if (!res.ok) throw new Error('Invalid credentials or not a superuser');
        
        const data = await res.json();
        adminToken = data.token;
        currentAdmin = data.record;
        localStorage.setItem('pb_admin_auth', JSON.stringify({ token: adminToken, model: currentAdmin }));
        enterApp();
    } catch (err) {
        dom.authError.textContent = err.message;
        dom.authError.classList.remove('hidden');
    }
});

dom.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('pb_admin_auth');
    adminToken = null;
    currentAdmin = null;
    showAuth();
});

// Navigation
dom.navItems.forEach(item => {
    item.addEventListener('click', () => {
        const target = item.dataset.target;
        switchTab(target);
    });
});

function switchTab(target) {
    dom.navItems.forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-target="${target}"]`)?.classList.add('active');
    
    dom.sections.forEach(s => s.classList.add('hidden'));
    document.getElementById(target)?.classList.remove('hidden');
    
    dom.pageTitle.textContent = target.charAt(0).toUpperCase() + target.slice(1);
    
    if (target === 'dashboard') loadDashboard();
    if (target === 'collections') loadCollections();
    if (target === 'superusers') loadSuperusers();
    if (target === 'users') loadUsers();
}

dom.backToCollections.addEventListener('click', () => {
    switchTab('collections');
});

// API Fetcher
async function fetchPB(endpoint) {
    const res = await fetch(`${PB_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

// Loaders
async function loadDashboard() {
    try {
        const [cols, supers, users] = await Promise.all([
            fetchPB('/api/collections?perPage=500'),
            fetchPB('/api/collections/_superusers/records'),
            fetchPB('/api/collections/users/records')
        ]);
        
        dom.statCollections.textContent = cols.items.length;
        dom.statSuperusers.textContent = supers.totalItems;
        dom.statUsers.textContent = users.totalItems;
        
        const sysCols = cols.items.filter(c => c.system).length;
        const customCols = cols.items.filter(c => !c.system).length;
        
        dom.systemOverview.innerHTML = `
            <div style="display:flex; flex-direction:column; gap: 12px;">
                <p><strong>System Collections:</strong> ${sysCols}</p>
                <p><strong>Custom Collections:</strong> ${customCols}</p>
                <p><strong>Database Target:</strong> pb.nolimitnexus.com</p>
                <p><strong>Connection Status:</strong> Active & Authenticated</p>
            </div>
        `;
    } catch (e) {
        showToast('Error loading dashboard', 'error');
    }
}

async function loadCollections() {
    try {
        const cols = await fetchPB('/api/collections?perPage=500');
        dom.collectionsList.innerHTML = '';
        cols.items.forEach(c => {
            const tr = document.createElement('tr');
            const typeBadge = c.type === 'auth' ? 'base' : (c.type === 'view' ? 'system' : '');
            const sysBadge = c.system ? '<span class="badge system">System</span>' : '<span class="badge base">Custom</span>';
            
            tr.innerHTML = `
                <td><strong>${c.name}</strong> <span style="color:var(--text-muted);font-size:0.8em;margin-left:8px;">${c.id}</span></td>
                <td><span class="badge ${typeBadge}">${c.type}</span></td>
                <td>${sysBadge}</td>
                <td>
                    <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="viewCollectionRecords('${c.id}', '${c.name}')">View Records</button>
                </td>
            `;
            dom.collectionsList.appendChild(tr);
        });
    } catch (e) {
        showToast('Error loading collections', 'error');
    }
}

window.viewCollectionRecords = async function(colId, colName) {
    try {
        const colDef = await fetchPB(`/api/collections/${colId}`);
        const records = await fetchPB(`/api/collections/${colId}/records?perPage=100`);
        
        dom.sections.forEach(s => s.classList.add('hidden'));
        dom.collectionRecords.classList.remove('hidden');
        dom.recordsTitle.textContent = `${colName} Records (${records.totalItems})`;
        
        const fields = colDef.fields.filter(f => !f.hidden);
        
        dom.recordsThead.innerHTML = `<tr>
            <th>ID</th>
            ${fields.map(f => `<th>${f.name}</th>`).join('')}
            <th>Created</th>
        </tr>`;
        
        dom.recordsTbody.innerHTML = '';
        records.items.forEach(r => {
            const tr = document.createElement('tr');
            const tdId = document.createElement('td');
            tdId.innerHTML = `<span style="font-family:monospace;font-size:0.85rem">${r.id}</span>`;
            tr.appendChild(tdId);
            
            fields.forEach(f => {
                const td = document.createElement('td');
                let val = r[f.name];
                if (typeof val === 'object') val = JSON.stringify(val);
                if (val && val.length > 50) val = val.substring(0, 50) + '...';
                td.textContent = val || '-';
                tr.appendChild(td);
            });
            
            const tdCreated = document.createElement('td');
            tdCreated.textContent = new Date(r.created).toLocaleString();
            tr.appendChild(tdCreated);
            
            dom.recordsTbody.appendChild(tr);
        });
        
    } catch (e) {
        showToast('Error loading records', 'error');
    }
}

async function loadSuperusers() {
    try {
        const supers = await fetchPB('/api/collections/_superusers/records');
        dom.superusersList.innerHTML = '';
        supers.items.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${u.email}</strong></td>
                <td><span style="font-family:monospace;color:var(--text-muted)">${u.id}</span></td>
                <td>${new Date(u.created).toLocaleString()}</td>
            `;
            dom.superusersList.appendChild(tr);
        });
    } catch (e) {
        showToast('Error loading superusers', 'error');
    }
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

async function loadUsers() {
    try {
        const users = await fetchPB('/api/collections/users/records?perPage=500&sort=-created');
        dom.usersList.innerHTML = '';
        users.items.forEach(u => {
            const tr = document.createElement('tr');
            const initial = (u.name || u.email || 'U')[0].toUpperCase();
            const color = stringToColor(u.name || u.email || u.id);
            
            tr.innerHTML = `
                <td><div class="user-avatar-small" style="background:${color}">${initial}</div></td>
                <td><strong>${u.name || '-'}</strong></td>
                <td>${u.username || '-'}</td>
                <td>${u.email || '<span style="color:var(--text-muted)">Hidden</span>'}</td>
                <td>${u.verified ? '<i data-lucide="check-circle" style="color:var(--success)"></i>' : '<i data-lucide="x-circle" style="color:var(--text-muted)"></i>'}</td>
                <td>${new Date(u.created).toLocaleDateString()}</td>
            `;
            dom.usersList.appendChild(tr);
        });
        lucide.createIcons();
    } catch (e) {
        showToast('Error loading users', 'error');
    }
}

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'alert-triangle'}"></i> <span>${msg}</span>`;
    dom.toastContainer.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s'; 
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
}
