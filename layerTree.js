// layerTree.js
export const LayerTree = {
    render(psd, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; 
        
        if (!psd.children || psd.children.length === 0) {
            container.innerHTML = '<div class="empty-state">NO LAYERS FOUND</div>';
            return;
        }

        // Render backwards to match Photoshop layer order (top to bottom)
        const reversedChildren = [...psd.children].reverse();
        this.buildTree(reversedChildren, container, 0,[]);
    },

    buildTree(layers, parentElement, depth, path) {
        layers.forEach((layer, index) => {
            const currentPath = [...path, index];
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'layer-item';
            itemDiv.style.setProperty('--indent', `${depth * 20}px`);
            
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'layer-checkbox';
            // Store layer reference and path for export
            checkbox.dataset.path = JSON.stringify(currentPath);
            checkbox.layerRef = layer; 
            
            // Text layer name
            const span = document.createElement('span');
            span.className = 'layer-name';
            span.textContent = layer.name || 'Unnamed Layer';

            // Badges
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

            // Smart Object Indicator
            if (layer.placedLayer) {
                const soDot = document.createElement('span');
                soDot.className = 'smart-dot';
                soDot.title = 'Smart Object';
                label.appendChild(soDot);
            }

            itemDiv.appendChild(label);
            parentElement.appendChild(itemDiv);

            // Recursive call for groups
            if (layer.children) {
                const reversedGroup =[...layer.children].reverse();
                this.buildTree(reversedGroup, parentElement, depth + 1, currentPath);
            }
        });
    },

    getSelectedLayers() {
        const checkboxes = document.querySelectorAll('.layer-checkbox:checked');
        const selected =[];
        checkboxes.forEach(cb => {
            // Only export layers that actually have image data (canvas)
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