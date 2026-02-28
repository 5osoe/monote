// psdReader.js
import { UI } from './ui.js';

export async function readPsdFile(file) {
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_SIZE) {
        UI.showToast('File exceeds 100MB limit!', 'error');
        throw new Error('File too large');
    }

    UI.showProgress();
    UI.updateProgress(10); // Start reading

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                UI.updateProgress(50); // File loaded to memory, parsing...
                const buffer = e.target.result;
                
                // Allow UI to update before heavy synchronous parsing
                await new Promise(res => setTimeout(res, 50)); 
                
                // Use ag-psd from global window object
                const psd = window.agPsd.readPsd(buffer);
                UI.updateProgress(90);

                // Extract DPI
                let dpi = 72; // default fallback
                if (psd.resolutionInfo) {
                    dpi = Math.round(psd.resolutionInfo.hRes) || 72;
                }

                // Count layers recursively
                const layerCount = countLayers(psd.children);

                const metadata = {
                    width: psd.width,
                    height: psd.height,
                    dpi: dpi,
                    layerCount: layerCount,
                    colorMode: 'RGB' // ag-psd currently primarily supports returning RGB canvas
                };

                UI.hideProgress();
                UI.showToast('File parsed successfully!');
                resolve({ psd, metadata });

            } catch (err) {
                UI.hideProgress();
                UI.showToast('Failed to parse PSD/PSB file.', 'error');
                reject(err);
            }
        };

        reader.onerror = () => {
            UI.hideProgress();
            UI.showToast('Error reading file.', 'error');
            reject(new Error('FileReader error'));
        };

        reader.readAsArrayBuffer(file);
    });
}

function countLayers(children) {
    if (!children) return 0;
    let count = 0;
    for (const child of children) {
        count++;
        if (child.children) {
            count += countLayers(child.children);
        }
    }
    return count;
}