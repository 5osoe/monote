import { yieldThread } from './psdReader.js';
import { UI } from './ui.js';

export const LayerTree = {
    async render(psd, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; 
        
        if (!psd.children || psd.children.length === 0) {
            container.innerHTML = '<div class="sub-text">NO LAYERS FOUND</div>';
            return;
        }

        UI.setProgressState('BUILDING DOM TREE...', 90);
        await yieldThread();

        const reversedChildren = [...psd.children].reverse();
        
        // Use an array to collect DOM nodes flatly, then append in chunks
        const nodesToAppend = [];
        this.flattenTree(reversedChildren, 0,[], nodesToAppend);

        // Render in chunks of 50 to prevent DOM freeze
        const CHUNK_SIZE = 50;
        for (let i = 0; i < nodesToAppend.length; i += CHUNK_SIZE) {
            const chunk = nodesToAppend.slice(i, i + CHUNK_SIZE);
            const fragment = document.createDocumentFragment();
            chunk.forEach(node => fragment.appendChild(node));
            container.appendChild(fragment);
            
            // Yield UI
            await new Promise(r => requestAnimationFrame(r));
        }

        UI.hideProgress();
        UI.showToast('File loaded and mapped.');
    },

    flattenTree(layers, depth, path, resultArr) {
        layers.forEach((layer, index) => {
            const currentPath = [...path, index];
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'layer-item';
            itemDiv.style.setProperty('--indent', `${depth * 15}px`);
            
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'layer-checkbox';
            checkbox.dataset.path = JSON.stringify(currentPath);
            checkbox.layerRef = layer; 
            
            const span = document.createElement('span');
            span.className = 'layer-name';
            span.textContent = layer.name || 'UNNAMED';

            const badges =[];
            if (layer.children) badges.push('GRP');
            else if (layer.text) badges.push('TXT');
            else if (layer.canvas) badges.push('IMG');
            
            label.appendChild(checkbox);
            label.appendChild(span);
            
            badges.forEach(b => {
                const bSpan = document.createElement('span');
                bSpan.className = 'badge';
                bSpan.textContent = b;
                label.appendChild(bSpan);
            });

            if (layer.placedLayer) {
                const soDot = document.createElement('span');
                soDot.className = 'smart-dot';
                label.appendChild(soDot);
            }

            itemDiv.appendChild(label);
            resultArr.push(itemDiv);

            if (layer.children) {
                const reversedGroup = [...layer.children].reverse();
                this.flattenTree(reversedGroup, depth + 1, currentPath, resultArr);
            }
        });
    },

    getSelectedLayers() {
        const checkboxes = document.querySelectorAll('.layer-checkbox:checked');
        const selected =[];
        checkboxes.forEach(cb => {
            if (cb.layerRef && cb.layerRef.canvas) {
                selected.push(cb.layerRef);
            }
        });
        return selected;
    },

    toggleAll(checked) {
        const checkboxes = document.querySelectorAll('.layer-checkbox');
        checkboxes.forEach(cb => cb.checked = checked);
    }
};