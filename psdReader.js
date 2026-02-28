import { UI } from './ui.js';

// Helper to yield to main thread to prevent UI freeze
export const yieldThread = () => new Promise(resolve => setTimeout(resolve, 0));

export async function readPsdFile(file) {
    const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024; // 500MB
    if (file.size > LARGE_FILE_THRESHOLD) {
        UI.showToast('Large file detected. Processing sequentially...', 'warning');
    }

    UI.setProgressState('READING FILE TO MEMORY...', 10);
    await yieldThread();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                let buffer = e.target.result;
                UI.setProgressState('PARSING PSD STRUCTURE...', 40);
                
                // Yield heavily to allow UI update before massive synchronous execution
                await new Promise(res => setTimeout(res, 100)); 
                
                // Read PSD (Note: ag-psd main extraction is synchronous, yielding before it helps UX)
                const psd = window.agPsd.readPsd(buffer);
                
                UI.setProgressState('CALCULATING METADATA...', 80);
                await yieldThread();

                let dpi = psd.resolutionInfo ? Math.round(psd.resolutionInfo.hRes) : 72;
                if (!dpi || dpi <= 0) dpi = 72;

                const layerCount = countLayers(psd.children);

                const metadata = {
                    width: psd.width,
                    height: psd.height,
                    dpi: dpi,
                    layerCount: layerCount,
                    colorMode: 'RGB'
                };

                // Memory Management: Clear buffer immediately
                buffer = null; 

                resolve({ psd, metadata });

            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsArrayBuffer(file);
    });
}

function countLayers(children) {
    if (!children) return 0;
    let count = 0;
    for (const child of children) {
        count++;
        if (child.children) count += countLayers(child.children);
    }
    return count;
}