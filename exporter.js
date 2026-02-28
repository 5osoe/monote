import { UI } from './ui.js';
import { yieldThread } from './psdReader.js';

function renderLayerToFullCanvas(layer, psdMetadata) {
    const canvas = document.createElement('canvas');
    canvas.width = psdMetadata.width;
    canvas.height = psdMetadata.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (layer.canvas) {
        ctx.drawImage(layer.canvas, layer.left, layer.top);
    }
    return canvas;
}

export async function exportToZIP(layers, psdMetadata) {
    if (layers.length === 0) return UI.showToast('No exportable layers selected.', 'error');

    const zip = new JSZip();
    let processed = 0;

    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        UI.setProgressState(`COMPRESSING LAYER ${i+1}/${layers.length}`, (processed / layers.length) * 80);
        await yieldThread();

        const fullCanvas = renderLayerToFullCanvas(layer, psdMetadata);
        const blob = await new Promise(res => fullCanvas.toBlob(res, 'image/png', 1.0));
        
        const safeName = (layer.name || `layer_${i}`).replace(/[^a-z0-9_-]/gi, '_');
        zip.file(`${i}_${safeName}.png`, blob);
        
        // Memory Cleanup per iteration
        fullCanvas.width = 0; fullCanvas.height = 0; 
        
        processed++;
    }

    UI.setProgressState('GENERATING ZIP ARCHIVE...', 90);
    await yieldThread();
    
    const content = await zip.generateAsync({ type: 'blob', compression: "STORE" });
    const url = URL.createObjectURL(content);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'HACK_PSD_ASSETS.zip';
    a.click();
    
    URL.revokeObjectURL(url);
    UI.hideProgress();
    UI.showToast('EXPORT COMPLETE.');
}

export async function exportToPDF(layers, psdMetadata, preserveDpi) {
    if (layers.length === 0) return UI.showToast('No exportable layers selected.', 'error');

    const dpi = preserveDpi ? psdMetadata.dpi : 72;
    const widthMm = (psdMetadata.width / dpi) * 25.4;
    const heightMm = (psdMetadata.height / dpi) * 25.4;
    const orientation = widthMm > heightMm ? 'l' : 'p';

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation, unit: 'mm', format: [widthMm, heightMm] });

    let processed = 0;
    for (let i = 0; i < layers.length; i++) {
        UI.setProgressState(`WRITING PDF PAGE ${i+1}/${layers.length}`, (processed / layers.length) * 90);
        await yieldThread();

        const layer = layers[i];
        const fullCanvas = renderLayerToFullCanvas(layer, psdMetadata);
        const dataUrl = fullCanvas.toDataURL('image/png', 1.0);
        
        if (i > 0) {
            pdf.addPage([widthMm, heightMm], orientation);
            pdf.setPage(i + 1);
        }
        pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
        
        // Memory Cleanup
        fullCanvas.width = 0; fullCanvas.height = 0;
        processed++;
    }

    pdf.save('HACK_PSD_DOCUMENT.pdf');
    UI.hideProgress();
    UI.showToast('PDF EXPORT COMPLETE.');
}