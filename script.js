// Database Config
const DB_NAME = 'NoteSafeDB_V2';
const DB_VERSION = 1;
let db;
let currentFolderId = 1;
let currentEditId = null;
let tempFile = null;
let pinCode = [];

// DOM Elements
const els = {
    screen: document.getElementById('security-screen'),
    pinDisplay: document.getElementById('pin-display'),
    numpad: document.getElementById('numpad'),
    setupMsg: document.getElementById('setup-msg'),
    msgArea: document.getElementById('messages-area'),
    foldersList: document.getElementById('folders-list'),
    input: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    attachBtn: document.getElementById('attach-btn'),
    fileInput: document.getElementById('media-input'),
    preview: document.getElementById('attachment-preview'),
    title: document.getElementById('current-folder-title'),
    count: document.getElementById('msg-count'),
    sidebar: document.getElementById('sidebar'),
    menuBtn: document.getElementById('menu-btn'),
    emptyState: document.getElementById('empty-state'),
    themeToggle: document.getElementById('theme-toggle'),
    addFolder: document.getElementById('add-folder-btn'),
    modal: document.getElementById('modal-overlay'),
    search: document.getElementById('search-input'),
    resetPin: document.getElementById('reset-pin')
};

// --- Initialization ---
function init() {
    initDB();
    checkAuth();
    loadTheme();
    setupEventListeners();
}

function initDB() {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains('folders')) {
            const fStore = db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
            fStore.put({ id: 1, name: 'عام' });
        }
        if (!db.objectStoreNames.contains('messages')) {
            const mStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
            mStore.createIndex('folderId', 'folderId', { unique: false });
        }
    };
    req.onsuccess = (e) => {
        db = e.target.result;
        refreshUI();
    };
}

// --- Security System ---
function checkAuth() {
    const savedPin = localStorage.getItem('safePin');
    if (!savedPin) {
        els.setupMsg.style.display = 'block';
    }
}

els.numpad.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const num = btn.dataset.num;

    if (num) {
        if (pinCode.length < 4) pinCode.push(num);
    } else if (action === 'clear') {
        pinCode.pop();
    } else if (action === 'enter') {
        processPin();
        return;
    }
    
    updatePinDisplay();
    if (pinCode.length === 4) setTimeout(processPin, 100);
});

function updatePinDisplay() {
    const dots = els.pinDisplay.querySelectorAll('span');
    dots.forEach((dot, i) => {
        dot.className = i < pinCode.length ? 'filled' : '';
    });
}

function processPin() {
    const entered = pinCode.join('');
    const saved = localStorage.getItem('safePin');

    if (!saved) {
        if (entered.length === 4) {
            localStorage.setItem('safePin', entered);
            unlockApp();
        }
    } else {
        if (entered === saved) {
            unlockApp();
        } else {
            pinCode = [];
            updatePinDisplay();
            els.pinDisplay.classList.add('shake');
            setTimeout(() => els.pinDisplay.classList.remove('shake'), 400);
        }
    }
}

function unlockApp() {
    els.screen.style.opacity = '0';
    setTimeout(() => els.screen.style.display = 'none', 300);
}

els.resetPin.onclick = () => {
    if(confirm('هل تريد إعادة ضبط الرمز؟ سيتم إعادة تحميل الصفحة.')) {
        localStorage.removeItem('safePin');
        location.reload();
    }
};

// --- Core Functions ---
function refreshUI() {
    loadFolders();
    loadMessages();
}

function loadFolders() {
    const tx = db.transaction('folders', 'readonly');
    const store = tx.objectStore('folders');
    store.getAll().onsuccess = (e) => {
        els.foldersList.innerHTML = '';
        e.target.result.forEach(f => {
            const div = document.createElement('div');
            div.className = `folder-item ${f.id === currentFolderId ? 'active' : ''}`;
            div.innerHTML = `
                <span>${f.name}</span>
                ${f.id !== 1 ? `<div class="folder-actions"><i class="fas fa-trash" onclick="deleteFolder(${f.id}, event)"></i></div>` : ''}
            `;
            div.onclick = (e) => {
                if(!e.target.classList.contains('fa-trash')) {
                    currentFolderId = f.id;
                    els.title.innerText = f.name;
                    refreshUI();
                    if(window.innerWidth <= 768) els.sidebar.classList.remove('open');
                }
            };
            els.foldersList.appendChild(div);
        });
    };
}

function loadMessages() {
    const tx = db.transaction('messages', 'readonly');
    const index = tx.objectStore('messages').index('folderId');
    index.getAll(currentFolderId).onsuccess = (e) => {
        const msgs = e.target.result;
        els.msgArea.innerHTML = '';
        els.count.innerText = `${msgs.length} ملاحظة`;
        els.emptyState.style.display = msgs.length ? 'none' : 'block';
        
        const filter = els.search.value.toLowerCase();

        msgs.forEach(msg => {
            if (filter && !msg.text.toLowerCase().includes(filter)) return;
            renderMessage(msg);
        });
        scrollToBottom();
    };
}

function renderMessage(msg) {
    const div = document.createElement('div');
    div.className = 'message my-message';
    
    let mediaHTML = '';
    if (msg.file) {
        const url = URL.createObjectURL(msg.file);
        const type = msg.file.type;
        if (type.startsWith('image')) mediaHTML = `<div class="media-wrapper"><img src="${url}" loading="lazy"></div>`;
        else if (type.startsWith('video')) mediaHTML = `<div class="media-wrapper"><video src="${url}" controls></video></div>`;
        else if (type.startsWith('audio')) mediaHTML = `<div class="media-wrapper"><audio src="${url}" controls></audio></div>`;
    }

    div.innerHTML = `
        ${mediaHTML}
        <div class="msg-text">${msg.text}</div>
        <div class="msg-info">
            <div class="msg-actions">
                <i class="fas fa-edit" onclick="startEdit(${msg.id})"></i>
                <i class="fas fa-trash" onclick="deleteMsg(${msg.id})"></i>
            </div>
            <span class="msg-time">${new Date(msg.timestamp).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</span>
        </div>
    `;
    els.msgArea.appendChild(div);
}

// --- Input Handling ---
els.input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if(this.value === '') this.style.height = 'auto';
});

els.attachBtn.onclick = () => els.fileInput.click();

els.fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('video')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = function() {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 600) { // 10 minutes
                alert('عذراً، الفيديو يجب أن يكون أقل من 10 دقائق');
                return;
            }
            setAttachment(file);
        }
        video.src = URL.createObjectURL(file);
    } else {
        setAttachment(file);
    }
};

function setAttachment(file) {
    tempFile = file;
    els.preview.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'preview-thumb';
    
    if (file.type.startsWith('image')) {
        const url = URL.createObjectURL(file);
        div.style.backgroundImage = `url(${url})`;
    } else {
        div.innerHTML = '<i class="fas fa-file-video" style="margin:20px; color:#555"></i>';
    }

    div.innerHTML += `<button class="remove-thumb" onclick="clearAttachment()">×</button>`;
    els.preview.appendChild(div);
}

window.clearAttachment = () => {
    tempFile = null;
    els.preview.innerHTML = '';
    els.fileInput.value = '';
};

els.sendBtn.onclick = async () => {
    const text = els.input.value.trim();
    if (!text && !tempFile) return;

    const data = {
        folderId: currentFolderId,
        text: text,
        file: tempFile,
        timestamp: Date.now()
    };

    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');

    if (currentEditId) {
        const msg = await new Promise(res => store.get(currentEditId).onsuccess = e => res(e.target.result));
        msg.text = text;
        if (tempFile) msg.file = tempFile;
        store.put(msg);
        currentEditId = null;
    } else {
        store.add(data);
    }

    tx.oncomplete = () => {
        els.input.value = '';
        els.input.style.height = 'auto';
        clearAttachment();
        loadMessages();
    };
};

// --- Actions ---
window.deleteMsg = (id) => {
    if(confirm('حذف الملاحظة؟')) {
        const tx = db.transaction('messages', 'readwrite');
        tx.objectStore('messages').delete(id);
        tx.oncomplete = loadMessages;
    }
};

window.startEdit = (id) => {
    const tx = db.transaction('messages', 'readonly');
    tx.objectStore('messages').get(id).onsuccess = (e) => {
        const msg = e.target.result;
        els.input.value = msg.text;
        els.input.focus();
        currentEditId = id;
    };
};

window.deleteFolder = (id, e) => {
    e.stopPropagation();
    if(confirm('سيتم حذف المجلد وجميع محتوياته!')) {
        const tx = db.transaction(['folders', 'messages'], 'readwrite');
        tx.objectStore('folders').delete(id);
        const idx = tx.objectStore('messages').index('folderId');
        idx.getAllKeys(id).onsuccess = (evt) => {
            evt.target.result.forEach(k => tx.objectStore('messages').delete(k));
        };
        tx.oncomplete = () => {
            if(currentFolderId === id) currentFolderId = 1;
            refreshUI();
        };
    }
};

// --- UI Helpers ---
function scrollToBottom() {
    els.msgArea.scrollTop = els.msgArea.scrollHeight;
}

function loadTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') document.body.setAttribute('data-theme', 'dark');
}

els.themeToggle.onclick = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
};

els.menuBtn.onclick = () => els.sidebar.classList.toggle('open');
els.search.oninput = loadMessages;

// --- Modal Logic ---
els.addFolder.onclick = () => {
    els.modal.style.display = 'flex';
    document.getElementById('folder-name-input').focus();
};

document.getElementById('modal-cancel').onclick = () => els.modal.style.display = 'none';

document.getElementById('modal-save').onclick = () => {
    const name = document.getElementById('folder-name-input').value;
    if(name) {
        const tx = db.transaction('folders', 'readwrite');
        tx.objectStore('folders').add({ name: name });
        tx.oncomplete = () => {
            els.modal.style.display = 'none';
            document.getElementById('folder-name-input').value = '';
            loadFolders();
        };
    }
};

// Start
init();