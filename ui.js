export const UI = {
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = `[ ${message} ]`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    setProgressState(stage, percent) {
        document.getElementById('progress-container').classList.remove('hidden');
        document.getElementById('progress-stage').innerText = stage;
        document.getElementById('progress-percent').innerText = Math.round(percent);
        document.getElementById('progress-bar-fill').style.width = `${percent}%`;
    },

    hideProgress() {
        document.getElementById('progress-container').classList.add('hidden');
    },

    showDashboard() {
        document.getElementById('upload-zone').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.getElementById('panel-layers').classList.remove('hidden');
        document.getElementById('panel-settings').classList.remove('hidden');
        document.getElementById('btn-clear').classList.remove('hidden');
        
        // Show mobile sticky bar if width < 1024
        if (window.innerWidth < 1024) {
            document.getElementById('mobile-sticky-bar').classList.remove('hidden');
        }
    },

    reset() {
        document.getElementById('upload-zone').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('panel-layers').classList.add('hidden');
        document.getElementById('panel-settings').classList.add('hidden');
        document.getElementById('btn-clear').classList.add('hidden');
        document.getElementById('mobile-sticky-bar').classList.add('hidden');
        document.getElementById('layer-tree-container').innerHTML = '';
        document.getElementById('metadata-list').innerHTML = '';
        document.getElementById('file-input').value = '';
        document.getElementById('check-all').checked = false;
    },

    populateMetadata(metadata) {
        const list = document.getElementById('metadata-list');
        list.innerHTML = `
            <div class="info-item"><span class="info-label">DIMENSIONS</span>${metadata.width} x ${metadata.height}px</div>
            <div class="info-item"><span class="info-label">RESOLUTION</span>${metadata.dpi} DPI</div>
            <div class="info-item"><span class="info-label">LAYERS</span>${metadata.layerCount}</div>
            <div class="info-item"><span class="info-label">COLOR MODE</span>${metadata.colorMode}</div>
        `;
    },

    setupDragAndDrop(onFileDrop) {
        const dropZone = document.getElementById('upload-zone');
        const prevent = e => { e.preventDefault(); e.stopPropagation(); };['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
            dropZone.addEventListener(e, prevent); document.body.addEventListener(e, prevent);
        });['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('dragover')));
        ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('dragover')));
        dropZone.addEventListener('drop', e => {
            if (e.dataTransfer.files.length > 0) onFileDrop(e.dataTransfer.files[0]);
        });
    }
};