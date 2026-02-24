const DB_NAME = 'NoteSafeDB';
const DB_VERSION = 1;
let db;
let currentFolderId = 1;
let currentEditId = null;
let tempAttachment = null;

const elements = {
    pinScreen: document.getElementById('security-screen'),
    pinInput: document.getElementById('pin-input'),
    unlockBtn: document.getElementById('unlock-btn'),
    setupMsg: document.getElementById('setup-msg'),
    sidebar: document.getElementById('sidebar'),
    foldersList: document.getElementById('folders-list'),
    msgContainer: document.getElementById('messages-container'),
    msgInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    attachBtn: document.getElementById('attach-btn'),
    fileInput: document.getElementById('file-input'),
    previewArea: document.getElementById('attachments-preview'),
    searchInput: document.getElementById('search-input'),
    folderTitle: document.getElementById('current-folder-name'),
    modal: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalInput: document.getElementById('modal-input'),
    modalConfirm: document.getElementById('modal-confirm'),
    modalCancel: document.getElementById('modal-cancel'),
    themeToggle: document.getElementById('theme-toggle'),
    menuToggle: document.getElementById('menu-toggle'),
    addFolderBtn: document.getElementById('add-folder-btn'),
    resetPinBtn: document.getElementById('reset-pin')
};

function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains('folders')) {
            const folderStore = db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
            folderStore.put({ id: 1, name: 'عام' });
        }
        if (!db.objectStoreNames.contains('messages')) {
            const msgStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
            msgStore.createIndex('folderId', 'folderId', { unique: false });
        }
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        loadFolders();
        loadMessages();
    };
    request.onerror = () => console.error("Database Error");
}

function checkSecurity() {
    const storedPin = localStorage.getItem('appPin');
    if (!storedPin) {
        elements.setupMsg.style.display = 'block';
        elements.setupMsg.textContent = 'قم بتعيين رمز جديد';
        elements.unlockBtn.textContent = 'تعيين';
        elements.unlockBtn.onclick = () => {
            if (elements.pinInput.value.length >= 4) {
                localStorage.setItem('appPin', elements.pinInput.value);
                elements.pinScreen.style.opacity = '0';
                setTimeout(() => elements.pinScreen.style.display = 'none', 300);
            }
        };
    } else {
        elements.unlockBtn.onclick = () => {
            if (elements.pinInput.value === storedPin) {
                elements.pinScreen.style.opacity = '0';
                setTimeout(() => elements.pinScreen.style.display = 'none', 300);
            } else {
                elements.pinInput.style.borderColor = 'red';
                setTimeout(() => elements.pinInput.style.borderColor = '', 1000);
            }
        };
    }
}

elements.resetPinBtn.onclick = () => {
    localStorage.removeItem('appPin');
    location.reload();
};

elements.themeToggle.onclick = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
};

if (localStorage.getItem('theme') === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
}

function loadFolders() {
    const tx = db.transaction('folders', 'readonly');
    const store = tx.objectStore('folders');
    const request = store.getAll();
    request.onsuccess = () => {
        elements.foldersList.innerHTML = '';
        request.result.forEach(folder => {
            const div = document.createElement('div');
            div.className = `folder-item ${folder.id === currentFolderId ? 'active' : ''}`;
            div.innerHTML = `
                <span>${folder.name}</span>
                ${folder.id !== 1 ? '<i class="fas fa-trash delete-folder"></i>' : ''}
            `;
            div.onclick = (e) => {
                if(e.target.classList.contains('delete-folder')) {
                    deleteFolder(folder.id);
                } else {
                    currentFolderId = folder.id;
                    elements.folderTitle.textContent = folder.name;
                    loadFolders();
                    loadMessages();
                    if(window.innerWidth <= 768) elements.sidebar.classList.remove('open');
                }
            };
            elements.foldersList.appendChild(div);
        });
    };
}

function deleteFolder(id) {
    if(!confirm('هل أنت متأكد؟ سيتم حذف جميع الملاحظات في هذا المجلد.')) return;
    const tx = db.transaction(['folders', 'messages'], 'readwrite');
    tx.objectStore('folders').delete(id);
    const msgStore = tx.objectStore('messages');
    const index = msgStore.index('folderId');
    const req = index.getAllKeys(id);
    req.onsuccess = () => {
        req.result.forEach(key => msgStore.delete(key));
    };
    tx.oncomplete = () => {
        currentFolderId = 1;
        loadFolders();
        loadMessages();
    };
}

elements.addFolderBtn.onclick = () => {
    showModal('اسم المجموعة الجديد', (name) => {
        if(name) {
            const tx = db.transaction('folders', 'readwrite');
            tx.objectStore('folders').add({ name: name });
            tx.oncomplete = loadFolders;
        }
    });
};

function loadMessages() {
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('folderId');
    const request = index.getAll(currentFolderId);

    request.onsuccess = () => {
        elements.msgContainer.innerHTML = '';
        const msgs = request.result;
        const query = elements.searchInput.value.toLowerCase();
        
        msgs.forEach(msg => {
            if (query && !msg.text.toLowerCase().includes(query)) return;
            renderMessage(msg);
        });
        scrollToBottom();
    };
}

function renderMessage(msg) {
    const div = document.createElement('div');
    div.className = 'message my-message';
    
    let mediaHtml = '';
    if (msg.file) {
        const url = URL.createObjectURL(msg.file);
        if (msg.file.type.startsWith('image')) {
            mediaHtml = `<div class="media-content"><img src="${url}" loading="lazy"></div>`;
        } else if (msg.file.type.startsWith('video')) {
            mediaHtml = `<div class="media-content"><video src="${url}" controls></video></div>`;
        } else if (msg.file.type.startsWith('audio')) {
            mediaHtml = `<div class="media-content"><audio src="${url}" controls></audio></div>`;
        }
    }

    div.innerHTML = `
        ${mediaHtml}
        <div class="message-content">${msg.text}</div>
        <div class="message-time">
            <span>${new Date(msg.timestamp).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}</span>
            <div class="message-actions">
                <i class="fas fa-edit" onclick="editMessage(${msg.id})"></i>
                <i class="fas fa-trash" onclick="deleteMessage(${msg.id})"></i>
            </div>
        </div>
    `;
    elements.msgContainer.appendChild(div);
}

function scrollToBottom() {
    elements.msgContainer.scrollTop = elements.msgContainer.scrollHeight;
}

elements.sendBtn.onclick = async () => {
    const text = elements.msgInput.value.trim();
    if (!text && !tempAttachment) return;

    const msgData = {
        folderId: currentFolderId,
        text: text,
        file: tempAttachment,
        timestamp: Date.now()
    };

    const tx = db.transaction('messages', 'readwrite');
    if (currentEditId) {
        const store = tx.objectStore('messages');
        const getReq = store.get(currentEditId);
        getReq.onsuccess = () => {
            const data = getReq.result;
            data.text = text;
            if (tempAttachment) data.file = tempAttachment; 
            store.put(data);
        };
        currentEditId = null;
        elements.sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    } else {
        tx.objectStore('messages').add(msgData);
    }

    tx.oncomplete = () => {
        elements.msgInput.value = '';
        clearAttachment();
        loadMessages();
    };
};

window.deleteMessage = (id) => {
    if(!confirm('حذف الملاحظة؟')) return;
    const tx = db.transaction('messages', 'readwrite');
    tx.objectStore('messages').delete(id);
    tx.oncomplete = loadMessages;
};

window.editMessage = (id) => {
    const tx = db.transaction('messages', 'readonly');
    const req = tx.objectStore('messages').get(id);
    req.onsuccess = () => {
        const msg = req.result;
        elements.msgInput.value = msg.text;
        currentEditId = id;
        elements.sendBtn.innerHTML = '<i class="fas fa-check"></i>';
        elements.msgInput.focus();
    };
};

elements.attachBtn.onclick = () => elements.fileInput.click();
elements.fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    tempAttachment = file;
    renderPreview(file);
};

function renderPreview(file) {
    elements.previewArea.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'preview-item';
    const url = URL.createObjectURL(file);
    
    if (file.type.startsWith('image')) {
        div.innerHTML = `<img src="${url}"><button class="remove-attachment">×</button>`;
    } else if (file.type.startsWith('video')) {
        div.innerHTML = `<video src="${url}"></video><button class="remove-attachment">×</button>`;
    } else {
        div.innerHTML = `<i class="fas fa-music"></i><button class="remove-attachment">×</button>`;
    }
    
    div.querySelector('.remove-attachment').onclick = clearAttachment;
    elements.previewArea.appendChild(div);
}

function clearAttachment() {
    tempAttachment = null;
    elements.fileInput.value = '';
    elements.previewArea.innerHTML = '';
}

elements.searchInput.oninput = loadMessages;
elements.menuToggle.onclick = () => elements.sidebar.classList.toggle('open');

function showModal(title, callback) {
    elements.modal.style.display = 'flex';
    elements.modalTitle.textContent = title;
    elements.modalInput.value = '';
    elements.modalInput.focus();
    
    const confirmHandler = () => {
        callback(elements.modalInput.value);
        closeModal();
    };
    
    elements.modalConfirm.onclick = confirmHandler;
    elements.modalCancel.onclick = closeModal;
}

function closeModal() {
    elements.modal.style.display = 'none';
    elements.modalConfirm.onclick = null;
}

initDB();
checkSecurity();