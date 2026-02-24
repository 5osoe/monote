const DB_NAME = 'menote_db';
const DB_VER = 1;
const CONFIG = {
    maxAttempts: 5,
    lockoutDuration: 30000,
    limits: {
        image: 5 * 1024 * 1024,
        video: 50 * 1024 * 1024,
        audio: 20 * 1024 * 1024
    }
};

const State = {
    db: null,
    pin: '',
    cryptoKey: null,
    currentFolderId: 1,
    tempFile: null,
    searchDebounce: null,
    isSetupMode: false,
    inputBuffer: '',
    attempts: 0
};

const UI = {
    secLayer: document.getElementById('security-layer'),
    appLayer: document.getElementById('app-layer'),
    pinDots: document.getElementById('pin-dots').children,
    msg: document.getElementById('security-message'),
    numpad: document.getElementById('numpad'),
    sidebar: document.getElementById('sidebar'),
    folderList: document.getElementById('folder-list'),
    notesContainer: document.getElementById('notes-container'),
    noteInput: document.getElementById('note-input'),
    folderTitle: document.getElementById('current-folder-title'),
    modal: document.getElementById('modal-overlay'),
    toast: document.getElementById('toast'),
    filePreview: document.getElementById('file-preview')
};

async function init() {
    setupEventListeners();
    await openDB();
    checkSecurityStatus();
}

function setupEventListeners() {
    UI.numpad.addEventListener('click', handlePinInput);
    document.getElementById('menu-toggle').addEventListener('click', () => UI.sidebar.classList.toggle('active'));
    document.getElementById('add-folder-btn').addEventListener('click', () => openModal('New Folder'));
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-confirm').addEventListener('click', handleModalSubmit);
    document.getElementById('attach-btn').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('file-input').addEventListener('change', handleFileSelect);
    document.getElementById('send-btn').addEventListener('click', saveNote);
    UI.noteInput.addEventListener('input', autoGrow);
    document.getElementById('search-input').addEventListener('input', handleSearch);
    document.getElementById('reset-pin-btn').addEventListener('click', startResetPin);
    
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !UI.sidebar.contains(e.target) && 
            !document.getElementById('menu-toggle').contains(e.target) &&
            UI.sidebar.classList.contains('active')) {
            UI.sidebar.classList.remove('active');
        }
    });
}

async function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('folders')) {
                const fStore = db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
                fStore.put({ id: 1, name: 'General' });
            }
            if (!db.objectStoreNames.contains('notes')) {
                const nStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
                nStore.createIndex('folderId', 'folderId', { unique: false });
            }
        };
        req.onsuccess = (e) => {
            State.db = e.target.result;
            resolve();
        };
        req.onerror = reject;
    });
}

function checkSecurityStatus() {
    const storedHash = localStorage.getItem('menote_hash');
    const lockoutTime = parseInt(localStorage.getItem('menote_lockout') || '0');
    
    if (Date.now() < lockoutTime) {
        enforceLockout(lockoutTime);
        return;
    }

    if (!storedHash) {
        State.isSetupMode = true;
        UI.msg.textContent = 'Create New PIN';
    } else {
        State.isSetupMode = false;
        UI.msg.textContent = 'Enter PIN to Unlock';
    }
}

async function handlePinInput(e) {
    if (e.target.tagName !== 'BUTTON' || UI.secLayer.classList.contains('locked')) return;
    
    const val = e.target.dataset.val;
    const action = e.target.dataset.action;

    if (val !== undefined) {
        if (State.inputBuffer.length < 4) {
            State.inputBuffer += val;
            updatePinUI();
        }
    } else if (action === 'clear') {
        State.inputBuffer = '';
        updatePinUI();
    } else if (action === 'enter') {
        if (State.inputBuffer.length === 4) processPinSubmission();
    }
}

function updatePinUI() {
    Array.from(UI.pinDots).forEach((dot, i) => {
        dot.className = i < State.inputBuffer.length ? 'active' : '';
    });
}

async function processPinSubmission() {
    const enteredPin = State.inputBuffer;
    State.inputBuffer = '';
    updatePinUI();

    if (State.isSetupMode) {
        const hash = await hashPin(enteredPin);
        localStorage.setItem('menote_hash', hash);
        State.pin = enteredPin;
        State.cryptoKey = await deriveKey(enteredPin);
        unlockApp();
    } else {
        const storedHash = localStorage.getItem('menote_hash');
        const attemptHash = await hashPin(enteredPin);

        if (attemptHash === storedHash) {
            State.attempts = 0;
            State.pin = enteredPin;
            State.cryptoKey = await deriveKey(enteredPin);
            unlockApp();
        } else {
            handleFailedAttempt();
        }
    }
}

function handleFailedAttempt() {
    State.attempts++;
    UI.msg.textContent = `Incorrect PIN (${State.attempts}/${CONFIG.maxAttempts})`;
    UI.msg.style.color = 'var(--error)';
    
    if (State.attempts >= CONFIG.maxAttempts) {
        const lockoutEnd = Date.now() + CONFIG.lockoutDuration;
        localStorage.setItem('menote_lockout', lockoutEnd);
        enforceLockout(lockoutEnd);
    } else {
        setTimeout(() => {
            UI.msg.textContent = 'Enter PIN to Unlock';
            UI.msg.style.color = 'var(--text-muted)';
        }, 1500);
    }
}

function enforceLockout(endTime) {
    UI.secLayer.classList.add('locked');
    UI.numpad.style.opacity = '0.5';
    UI.numpad.style.pointerEvents = 'none';
    
    const interval = setInterval(() => {
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        if (remaining <= 0) {
            clearInterval(interval);
            localStorage.removeItem('menote_lockout');
            State.attempts = 0;
            UI.secLayer.classList.remove('locked');
            UI.numpad.style.opacity = '1';
            UI.numpad.style.pointerEvents = 'all';
            UI.msg.textContent = 'Enter PIN to Unlock';
        } else {
            UI.msg.textContent = `Try again in ${remaining}s`;
        }
    }, 1000);
}

function unlockApp() {
    UI.secLayer.style.opacity = '0';
    setTimeout(() => {
        UI.secLayer.style.display = 'none';
        UI.appLayer.classList.add('visible');
        loadFolders();
        loadNotes();
    }, 300);
}

function startResetPin() {
    if(confirm('Resetting PIN requires entering current PIN again. Continue?')) {
        State.inputBuffer = '';
        UI.secLayer.style.display = 'flex';
        UI.secLayer.style.opacity = '1';
        UI.appLayer.classList.remove('visible');
        UI.msg.textContent = 'Verify Current PIN';
        State.isSetupMode = false;
        
        const oldProcess = processPinSubmission;
        processPinSubmission = async function() {
            const entered = State.inputBuffer;
            const h = await hashPin(entered);
            if(h === localStorage.getItem('menote_hash')) {
                State.inputBuffer = '';
                updatePinUI();
                State.isSetupMode = true;
                UI.msg.textContent = 'Enter New PIN';
                processPinSubmission = oldProcess;
            } else {
                handleFailedAttempt();
                State.inputBuffer = '';
                updatePinUI();
            }
        };
    }
}

async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(pin) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('menote_salt'), iterations: 100000, hash: 'SHA-256' },
        keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
}

async function encryptData(text) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv }, State.cryptoKey, enc.encode(text)
    );
    return {
        data: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv)
    };
}

async function decryptData(data, ivArr) {
    try {
        const iv = new Uint8Array(ivArr);
        const encrypted = new Uint8Array(data);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv }, State.cryptoKey, encrypted
        );
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        return '[Encrypted Content]';
    }
}

function loadFolders() {
    const tx = State.db.transaction('folders', 'readonly');
    const store = tx.objectStore('folders');
    const req = store.getAll();
    
    req.onsuccess = () => {
        UI.folderList.innerHTML = '';
        req.result.forEach(folder => {
            const el = document.createElement('div');
            el.className = `folder-item ${folder.id === State.currentFolderId ? 'active' : ''}`;
            el.innerHTML = `<span>${folder.name}</span>`;
            
            if (folder.id !== 1) {
                const delBtn = document.createElement('button');
                delBtn.className = 'folder-delete';
                delBtn.textContent = '×';
                delBtn.onclick = (e) => { e.stopPropagation(); deleteFolder(folder.id); };
                el.appendChild(delBtn);
            }
            
            el.onclick = () => switchFolder(folder.id, folder.name);
            UI.folderList.appendChild(el);
        });
    };
}

function switchFolder(id, name) {
    State.currentFolderId = id;
    UI.folderTitle.textContent = name;
    loadFolders();
    loadNotes();
    if (window.innerWidth <= 768) UI.sidebar.classList.remove('active');
}

function deleteFolder(id) {
    if (confirm('Delete folder and all its notes?')) {
        const tx = State.db.transaction(['folders', 'notes'], 'readwrite');
        tx.objectStore('folders').delete(id);
        const nStore = tx.objectStore('notes');
        const idx = nStore.index('folderId');
        idx.openCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
        tx.oncomplete = () => {
            if (State.currentFolderId === id) switchFolder(1, 'General');
            else loadFolders();
        };
    }
}

function openModal(title) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-input').value = '';
    UI.modal.style.display = 'flex';
    document.getElementById('modal-input').focus();
}

function closeModal() {
    UI.modal.style.display = 'none';
}

function handleModalSubmit() {
    const name = document.getElementById('modal-input').value.trim();
    if (!name) return;
    
    const tx = State.db.transaction('folders', 'readwrite');
    tx.objectStore('folders').add({ name });
    tx.oncomplete = () => {
        closeModal();
        loadFolders();
    };
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    let limit = 0;
    if (file.type.startsWith('image')) limit = CONFIG.limits.image;
    else if (file.type.startsWith('video')) limit = CONFIG.limits.video;
    else if (file.type.startsWith('audio')) limit = CONFIG.limits.audio;
    else {
        showToast('Unsupported file type');
        return;
    }

    if (file.size > limit) {
        showToast('File size limit exceeded');
        return;
    }

    State.tempFile = file;
    UI.filePreview.style.display = 'block';
    UI.filePreview.innerHTML = `
        <div class="preview-tag">
            ${file.name}
            <span class="preview-remove" onclick="clearFile()">×</span>
        </div>
    `;
}

window.clearFile = function() {
    State.tempFile = null;
    document.getElementById('file-input').value = '';
    UI.filePreview.style.display = 'none';
    UI.filePreview.innerHTML = '';
};

async function saveNote() {
    const text = UI.noteInput.value.trim();
    if (!text && !State.tempFile) return;

    const encrypted = await encryptData(text);
    
    const note = {
        folderId: State.currentFolderId,
        content: encrypted.data,
        iv: encrypted.iv,
        timestamp: Date.now(),
        file: State.tempFile
    };

    const tx = State.db.transaction('notes', 'readwrite');
    tx.objectStore('notes').add(note);
    tx.oncomplete = () => {
        UI.noteInput.value = '';
        UI.noteInput.style.height = 'auto';
        clearFile();
        loadNotes();
    };
}

function loadNotes(searchTerm = '') {
    const tx = State.db.transaction('notes', 'readonly');
    const store = tx.objectStore('notes');
    const index = store.index('folderId');
    const req = index.getAll(State.currentFolderId);

    req.onsuccess = async (e) => {
        const notes = e.target.result;
        UI.notesContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        for (const note of notes) {
            const decryptedText = await decryptData(note.content, note.iv);
            
            if (searchTerm) {
                const dateStr = new Date(note.timestamp).toLocaleString();
                if (!decryptedText.toLowerCase().includes(searchTerm) && 
                    !dateStr.includes(searchTerm)) continue;
            }

            const el = createNoteElement(note, decryptedText);
            fragment.appendChild(el);
        }
        
        UI.notesContainer.appendChild(fragment);
        UI.notesContainer.scrollTop = UI.notesContainer.scrollHeight;
    };
}

function createNoteElement(note, text) {
    const div = document.createElement('div');
    div.className = 'note-card';
    
    const date = new Date(note.timestamp).toLocaleString();
    let mediaHtml = '';

    if (note.file) {
        const url = URL.createObjectURL(note.file);
        if (note.file.type.startsWith('image')) {
            mediaHtml = `<div class="note-media"><img src="${url}" loading="lazy" onload="URL.revokeObjectURL(this.src)"></div>`;
        } else if (note.file.type.startsWith('video')) {
            mediaHtml = `<div class="note-media"><video src="${url}" controls></video></div>`;
        } else if (note.file.type.startsWith('audio')) {
            mediaHtml = `<div class="note-media"><audio src="${url}" controls></audio></div>`;
        }
    }

    div.innerHTML = `
        <div class="note-date">
            <span>${date}</span>
            <button class="note-delete">Trash</button>
        </div>
        ${mediaHtml}
        <div class="note-content">${escapeHtml(text)}</div>
    `;

    div.querySelector('.note-delete').addEventListener('click', () => deleteNote(note.id));
    return div;
}

function deleteNote(id) {
    if (confirm('Delete this note?')) {
        const tx = State.db.transaction('notes', 'readwrite');
        tx.objectStore('notes').delete(id);
        tx.oncomplete = () => loadNotes();
    }
}

function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    clearTimeout(State.searchDebounce);
    State.searchDebounce = setTimeout(() => {
        loadNotes(term);
    }, 200);
}

function autoGrow(e) {
    e.target.style.height = 'auto';
    e.target.style.height = (e.target.scrollHeight) + 'px';
}

function showToast(msg) {
    UI.toast.textContent = msg;
    UI.toast.style.opacity = '1';
    setTimeout(() => UI.toast.style.opacity = '0', 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

init();