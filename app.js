import { UI } from './ui.js';
import { readPsdFile } from './psdReader.js';
import { LayerTree } from './layerTree.js';
import { exportToZIP, exportToPDF } from './exporter.js';

let currentPsdData = null; // Object holding PSD & Metadata

document.addEventListener('DOMContentLoaded', () => {
    UI.setupDragAndDrop(handleFile);

    document.getElementById('file-input').addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    // Clear Session -> Release RAM
    document.getElementById('btn-clear').addEventListener('click', () => {
        currentPsdData = null; // Garbage Collection trigger
        UI.reset();
        UI.showToast('SESSION CLEARED. MEMORY RELEASED.');
    });

    document.getElementById('check-all').addEventListener('change', (e) => {
        LayerTree.toggleAll(e.target.checked);
    });

    const runExport = (type) => {
        if (!currentPsdData) return;
        const selected = LayerTree.getSelectedLayers();
        if(type === 'zip') {
            exportToZIP(selected, currentPsdData.metadata);
        } else {
            const preserve = document.getElementById('preserve-dpi').checked;
            exportToPDF(selected, currentPsdData.metadata, preserve);
        }
    };

    // Bind both Mobile and Desktop export buttons
    document.getElementById('btn-export-zip-desktop').addEventListener('click', () => runExport('zip'));
    document.getElementById('btn-export-zip-mobile').addEventListener('click', () => runExport('zip'));
    
    document.getElementById('btn-export-pdf-desktop').addEventListener('click', () => runExport('pdf'));
    document.getElementById('btn-export-pdf-mobile').addEventListener('click', () => runExport('pdf'));
});

async function handleFile(file) {
    const validExts = ['.psd', '.psb', '.tiff'];
    const isValid = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValid) return UI.showToast('UNSUPPORTED FORMAT.', 'error');

    try {
        currentPsdData = null; // Free up previous file memory if any
        UI.reset(); 

        const { psd, metadata } = await readPsdFile(file);
        currentPsdData = { psd, metadata };
        
        UI.populateMetadata(metadata);
        await LayerTree.render(psd, 'layer-tree-container');
        UI.showDashboard();
        
    } catch (err) {
        UI.hideProgress();
        UI.showToast('PROCESSING FAILED.', 'error');
        console.error("HACK_PSD Core Error:", err);
    }
}