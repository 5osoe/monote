// app.js
import { UI } from './ui.js';
import { readPsdFile } from './psdReader.js';
import { LayerTree } from './layerTree.js';
import { exportToZIP, exportToPDF } from './exporter.js';

let currentPsdMetadata = null;

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Setup Drag & Drop
    UI.setupDragAndDrop(handleFile);

    // 2. Setup File Input
    document.getElementById('file-input').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // 3. Setup Theme Toggle
    document.getElementById('btn-theme').addEventListener('click', () => {
        UI.toggleTheme();
    });

    // 4. Clear Session
    document.getElementById('btn-clear').addEventListener('click', () => {
        currentPsdMetadata = null;
        UI.reset();
        UI.showToast('Session cleared.');
    });

    // 5. Select All Checkbox
    document.getElementById('check-all').addEventListener('change', (e) => {
        LayerTree.toggleAll(e.target.checked);
    });

    // 6. Export Buttons
    document.getElementById('btn-export-zip').addEventListener('click', () => {
        if (!currentPsdMetadata) return;
        const selected = LayerTree.getSelectedLayers();
        exportToZIP(selected, currentPsdMetadata);
    });

    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        if (!currentPsdMetadata) return;
        const selected = LayerTree.getSelectedLayers();
        const preserveDpi = document.getElementById('preserve-dpi').checked;
        exportToPDF(selected, currentPsdMetadata, preserveDpi);
    });
});

async function handleFile(file) {
    const validExts = ['.psd', '.psb', '.tiff'];
    const isValid = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValid) {
        UI.showToast('Unsupported file type.', 'error');
        return;
    }

    try {
        const { psd, metadata } = await readPsdFile(file);
        currentPsdMetadata = metadata;
        
        UI.populateMetadata(metadata);
        LayerTree.render(psd, 'layer-tree-container');
        UI.showDashboard();
        
    } catch (err) {
        console.error("HACK PSD Error:", err);
    }
}