// ui.js
export const UI = {
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showProgress() {
        document.getElementById('progress-container').classList.remove('hidden');
        this.updateProgress(0);
    },

    hideProgress() {
        document.getElementById('progress-container').classList.add('hidden');
    },

    updateProgress(percent) {
        document.getElementById('progress-percent').innerText = Math.round(percent);
        document.getElementById('progress-bar-fill').style.width = `${percent}%`;
    },

    toggleTheme() {
        document.body.classList.toggle('light-mode');
        document.body.classList.toggle('dark-mode');
    },

    showDashboard() {
        document.getElementById('upload-zone').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.getElementById('check-all').disabled = false;
    },

    reset() {
        document.getElementById('upload-zone').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('layer-tree-container').innerHTML = '<div class="empty-state">NO FILE LOADED</div>';
        document.getElementById('metadata-list').innerHTML = '';
        document.getElementById('file-input').value = '';
        document.getElementById('check-all').disabled = true;
        document.getElementById('check-all').checked = false;
    },

    populateMetadata(metadata) {
        const list = document.getElementById('metadata-list');
        list.innerHTML = `
            <li><strong>Width:</strong> ${metadata.width} px</li>
            <li><strong>Height:</strong> ${metadata.height} px</li>
            <li><strong>DPI:</strong> ${metadata.dpi}</li>
            <li><strong>Total Layers:</strong> ${metadata.layerCount}</li>
            <li><strong>Color Mode:</strong> ${metadata.colorMode}</li>
        `;
    },

    setupDragAndDrop(onFileDrop) {
        const dropZone = document.getElementById('upload-zone');['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('dragover');
            }, false);
        });['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) onFileDrop(files[0]);
        }, false);
    }
};