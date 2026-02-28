// exporter.js
import { UI } from './ui.js';

function renderLayerToFullCanvas(layer, psdMetadata) {
    // 1:1 Original Size Canvas
    const canvas = document.createElement('canvas');
    canvas.width = psdMetadata.width;
    canvas.height = psdMetadata.height;
    const ctx = canvas.getContext('2d');

    // Draw layer exactly at its absolute position
    // ag-psd gives layer.left and layer.top
    if (layer.canvas) {
        ctx.drawImage(layer.canvas, layer.left, layer.top);
    }
    
    return canvas;
}

// Yield execution to prevent UI freeze
const yieldThread = () => new Promise(resolve => setTimeout(resolve, 0));

export async function exportToZIP(layers, psdMetadata) {
    if (layers.length === 0) {
        UI.showToast('No exportable layers selected.', 'error');
        return;
    }

    UI.showProgress();
    const zip = new JSZip();
    
    let processed = 0;
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const fullCanvas = renderLayerToFullCanvas(layer, psdMetadata);
        
        // Convert to blob
        const blob = await new Promise(res => fullCanvas.toBlob(res, 'image/png', 1.0));
        
        // Clean filename
        const safeName = (layer.name || `layer_${i}`).replace(/[^a-z0-9_-]/gi, '_');
        zip.file(`${i}_${safeName}.png`, blob);
        
        processed++;
        UI.updateProgress((processed / layers.length) * 80); // 80% for generation
        await yieldThread();
    }

    UI.updateProgress(90);
    const content = await zip.generateAsync({ type: 'blob' });
    
    // Download
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'HACK_PSD_Export.zip';
    a.click();
    URL.revokeObjectURL(url);
    
    UI.hideProgress();
    UI.showToast('ZIP exported successfully!');
}

export async function exportToPDF(layers, psdMetadata, preserveDpi) {
    if (layers.length === 0) {
        UI.showToast('No exportable layers selected.', 'error');
        return;
    }

    UI.showProgress();
    
    // Critical PDF Math: mm = (px / dpi) * 25.4
    const dpi = preserveDpi ? psdMetadata.dpi : 72;
    const widthMm = (psdMetadata.width / dpi) * 25.4;
    const heightMm = (psdMetadata.height / dpi) * 25.4;
    const orientation = widthMm > heightMm ? 'l' : 'p';

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: [widthMm, heightMm]
    });

    let processed = 0;
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const fullCanvas = renderLayerToFullCanvas(layer, psdMetadata);
        const dataUrl = fullCanvas.toDataURL('image/png', 1.0);
        
        if (i > 0) {
            pdf.addPage([widthMm, heightMm], orientation);
            pdf.setPage(i + 1);
        }
        
        pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
        
        processed++;
        UI.updateProgress((processed / layers.length) * 90);
        await yieldThread();
    }

    pdf.save('HACK_PSD_Export.pdf');
    UI.hideProgress();
    UI.showToast('PDF exported successfully!');
}