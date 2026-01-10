// 1. VARIABLES GLOBALES
let tilesData = {};
let config = { 
    cols: 4, rows: 4, gap: 15, fontSize: 12, 
    bgColor: '#000000', tileBgColor: '#000000', folderTileBgColor: '#ffd43b' 
};

// Lecture sécurisée du localStorage
try {
    tilesData = JSON.parse(localStorage.getItem('sd_v2_data')) || {};
    const savedConfig = JSON.parse(localStorage.getItem('sd_v2_config'));
    if (savedConfig) config = { ...config, ...savedConfig };
} catch (e) {
    console.error("Erreur de lecture du localStorage :", e);
}

let currentEditingCoords = null;
let draggedCoords = null;
let activeFolderCoords = null;
let draggedFromFolder = false;
let tempBase64 = ""; 
let lastTilesData = null;

const winFolderSVG = `<svg class="folder-icon-bg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V8C22 6.89543 21.1046 6 20 6H12L10 4H4Z" fill="#ffca28"/><path d="M2 10V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V10H2Z" fill="#ffd54f"/></svg>`;

// 2. FONCTIONS UI & UTILITAIRES
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('active');
}

function updateGridParams() {
    config.bgColor = document.getElementById('bgInput').value;
    document.body.style.backgroundColor = config.bgColor;
    saveToLocal();
}

function inputGridParams() {
    config.cols = parseInt(document.getElementById('colsInput').value) || 1;
    config.rows = parseInt(document.getElementById('rowsInput').value) || 1;
    config.gap = parseInt(document.getElementById('gapInput').value) || 0;
    config.fontSize = parseInt(document.getElementById('fontInput').value) || 12;
    config.tileBgColor = document.getElementById('tileColorInput').value;
    config.folderTileBgColor = document.getElementById('folderTileColorInput').value;
    renderGrid();
    saveToLocal();
}

function saveToLocal() {
    localStorage.setItem('sd_v2_data', JSON.stringify(tilesData));
    localStorage.setItem('sd_v2_config', JSON.stringify(config));
}

function saveSnapshot() { lastTilesData = JSON.parse(JSON.stringify(tilesData)); }

function undo() {
    if (lastTilesData) {
        tilesData = JSON.parse(JSON.stringify(lastTilesData));
        lastTilesData = null;
        saveToLocal(); renderGrid();
    }
}

// 3. LOGIQUE DE MIGRATION
function migrateToCoords(data, cols = 4) {
    if (Array.isArray(data)) {
        let newData = {};
        data.forEach((item, index) => {
            if (item) {
                let x = index % cols;
                let y = Math.floor(index / cols);
                if (item.type === 'folder' && item.items) {
                    item.items = migrateToCoords(item.items, item.fConfig?.cols || 3);
                }
                newData[`${x}-${y}`] = item;
            }
        });
        return newData;
    } 
    return data;
}

// 4. RENDU
function init() {
    tilesData = migrateToCoords(tilesData, config.cols);
    saveToLocal();
    const bgInput = document.getElementById('bgInput');
    if(bgInput) {
        bgInput.value = config.bgColor;
        document.getElementById('colsInput').value = config.cols;
        document.getElementById('rowsInput').value = config.rows;
        document.getElementById('gapInput').value = config.gap;
        document.getElementById('fontInput').value = config.fontSize;
        document.getElementById('tileColorInput').value = config.tileBgColor;
        document.getElementById('folderTileColorInput').value = config.folderTileBgColor;
        document.body.style.backgroundColor = config.bgColor;
    }
    renderGrid();
}

function renderGrid() {
    const grid = document.getElementById('grid');
    if(!grid) return;
    grid.innerHTML = '';
    document.documentElement.style.setProperty('--cols', config.cols);
    document.documentElement.style.setProperty('--rows', config.rows);
    document.documentElement.style.setProperty('--gap', config.gap + 'px');
    document.documentElement.style.setProperty('--font-size', config.fontSize + 'px');
    document.documentElement.style.setProperty('--tile-bg', config.tileBgColor);
    document.documentElement.style.setProperty('--folder-tile-bg', config.folderTileBgColor);

    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            let coords = `${c}-${r}`;
            grid.appendChild(createTile(coords, tilesData[coords], true));
        }
    }
}

function createTile(coords, data, isMain) {
    const div = document.createElement('div');
    // On applique les classes de base
    div.className = 'tile' + (data ? (data.type === 'folder' ? ' folder' : '') : ' empty');
    div.id = isMain ? `tile-${coords}` : `folder-tile-${coords}`;
    
    if (data) {
        div.draggable = true;
        if (data.type === 'folder') {
            // Structure du dossier : Fond SVG + Miniature optionnelle + Label
            div.innerHTML = winFolderSVG;
            if(data.img) div.innerHTML += `<img src="${data.img}" class="folder-thumb">`;
            div.innerHTML += `<div class="tile-label">${data.name}</div>`;
            
            // Clic pour ouvrir le dossier avec animation et flou
            div.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                openFolder(coords); 
            });
        } else {
            // Structure d'un lien : Image (ou favicon par défaut) + Label
            const icon = data.img || `https://www.google.com/s2/favicons?domain=${data.url}&sz=128`;
            div.innerHTML = `<img src="${icon}"><div class="tile-label">${data.name}</div>`;
            
            // Clic pour ouvrir le lien
            div.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                window.open(data.url, '_blank'); 
            });
        }
    } else {
        // Logique de la tuile vide (Système de "+" au premier clic)
        div.innerHTML = ''; 
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            if (div.innerHTML === '') {
                // On nettoie les autres tuiles qui auraient un "+" actif
                document.querySelectorAll('.tile.empty').forEach(t => t.innerHTML = '');
                // On affiche le "+"
                div.innerHTML = '<span style="font-size:40px; color:var(--accent); font-weight:bold; pointer-events:none;">+</span>';
                div.style.opacity = "1";
            } else {
                // Deuxième clic : on ouvre la modale d'ajout
                openModal(coords);
                div.innerHTML = ''; 
                div.style.opacity = "";
            }
        });
    }

    // Menu contextuel (clic droit) pour éditer
    div.addEventListener('contextmenu', (e) => { 
        if (data) { 
            e.preventDefault(); 
            openModal(coords); 
        }
    });

    // --- GESTION DU DRAG & DROP AVEC FEEDBACK VISUEL ---
    div.addEventListener('dragstart', (e) => { 
        draggedCoords = coords; 
        draggedFromFolder = !isMain; 
        div.classList.add('dragging'); 
        // Effet de transparence pendant le transport
        e.dataTransfer.setData('text/plain', coords);
    });
    
    div.addEventListener('dragend', () => { 
        div.classList.remove('dragging'); 
        document.querySelectorAll('.tile').forEach(t => t.classList.remove('drag-over')); 
    });
    
    div.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        // On illumine la tuile seulement si ce n'est pas celle qu'on déplace
        if(coords !== draggedCoords) {
            div.classList.add('drag-over'); 
        }
    });

    div.addEventListener('dragleave', () => {
        div.classList.remove('drag-over');
    });
    
    div.addEventListener('drop', (e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        div.classList.remove('drag-over'); 
        // On redirige vers la bonne logique selon si on est dans la grille ou un dossier
        isMain ? handleDropMain(coords) : handleDropFolder(coords); 
    });

    return div;
}
// 5. LOGIQUE DOSSIER (OUVERTURE SUR L'ICÔNE)
// --- FONCTION D'OUVERTURE DU DOSSIER ---
function openFolder(coords) {
    activeFolderCoords = coords;
    const folder = tilesData[coords];
    const overlay = document.getElementById('folderOverlay');
    const fGrid = document.getElementById('folderGrid');
    const fPopup = document.getElementById('folderPopup');
    const mainGrid = document.getElementById('grid'); // Pour l'effet de flou
    
    // 1. Mise à jour des réglages
    document.getElementById('fCols').value = folder.fConfig.cols;
    document.getElementById('fRows').value = folder.fConfig.rows;
    document.getElementById('fGap').value = folder.fConfig.gap;
    document.getElementById('fPopBg').value = folder.fConfig.fBgColor;
    
    // 2. Configuration de la grille
    fGrid.style.gridTemplateColumns = `repeat(${folder.fConfig.cols}, 120px)`;
    fGrid.style.gap = `${folder.fConfig.gap}px`;
    fPopup.style.backgroundColor = folder.fConfig.fBgColor;
    fGrid.innerHTML = '';
    
    // 3. Positionnement dynamique
    const originTile = document.getElementById(`tile-${coords}`);
    if (originTile) {
        const rect = originTile.getBoundingClientRect();
        overlay.style.display = 'block'; 
        fPopup.style.position = 'absolute';
        
        let posX = rect.left + window.scrollX;
        let posY = rect.top + window.scrollY;

        const estimatedWidth = (folder.fConfig.cols * 120) + (folder.fConfig.cols * folder.fConfig.gap) + 40;
        if (posX + estimatedWidth > window.innerWidth) {
            posX = window.innerWidth - estimatedWidth - 20;
        }

        fPopup.style.left = `${Math.max(10, posX)}px`;
        fPopup.style.top = `${Math.max(10, posY)}px`;
        fPopup.style.transformOrigin = '0 0'; 
    } else {
        overlay.style.display = 'flex';
        fPopup.style.position = 'relative';
        fPopup.style.transformOrigin = 'center';
    }

    // 4. Remplissage
    if (!folder.items) folder.items = {};
    for(let r=0; r < folder.fConfig.rows; r++) {
        for(let c=0; c < folder.fConfig.cols; c++) {
            let fCoords = `${c}-${r}`;
            fGrid.appendChild(createTile(fCoords, folder.items[fCoords], false));
        }
    }

    // 5. Effet de flou sur l'arrière-plan
    if(mainGrid) mainGrid.style.filter = 'blur(3px)';
    if(mainGrid) mainGrid.style.transition = 'filter 0.5s';

    // 6. Animation Zoom
    fPopup.animate([
        { transform: 'scale(0.2)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 }
    ], {
        duration: 300,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'forwards'
    });
}

// --- FONCTION DE FERMETURE DU DOSSIER ---
function closeFolder() { 
    const fPopup = document.getElementById('folderPopup');
    const overlay = document.getElementById('folderOverlay');
    const mainGrid = document.getElementById('grid');

    if (overlay.style.display === 'none' || !activeFolderCoords) return;

    // Retrait du flou
    if(mainGrid) mainGrid.style.filter = 'none';

    // Animation de sortie
    const animation = fPopup.animate([
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.2)', opacity: 0 }
    ], {
        duration: 200,
        easing: 'ease-in',
        fill: 'forwards'
    });

    animation.onfinish = () => {
        overlay.style.display = 'none'; 
        activeFolderCoords = null;
        fPopup.style.transform = 'scale(1)'; 
    };
}

function updateFolderSettings() {
    const folder = tilesData[activeFolderCoords];
    folder.fConfig = {
        cols: parseInt(document.getElementById('fCols').value) || 1,
        rows: parseInt(document.getElementById('fRows').value) || 1,
        gap: parseInt(document.getElementById('fGap').value) || 0,
        fBgColor: document.getElementById('fPopBg').value
    };
    openFolder(activeFolderCoords);
    saveToLocal();
}

// 6. DRAG & DROP
function handleDropMain(to) {
    saveSnapshot();
    const source = draggedFromFolder ? tilesData[activeFolderCoords].items[draggedCoords] : tilesData[draggedCoords];
    if (!source) return;
    const target = tilesData[to];
    
    if (!target) {
        tilesData[to] = source;
    } else if (target.type === 'folder') {
        if (!target.items) target.items = {};
        let found = false;
        for(let r=0; r<target.fConfig.rows && !found; r++){
            for(let c=0; c<target.fConfig.cols && !found; c++){
                if(!target.items[`${c}-${r}`]) { target.items[`${c}-${r}`] = source; found = true; }
            }
        }
    } else if (target !== source) {
        tilesData[to] = {
            type: 'folder', name: "Nouveau Dossier",
            items: {"0-0": target, "1-0": source},
            fConfig: { cols: 3, rows: 2, gap: 10, fBgColor: '#1e293b' }
        };
    }
    
    if (draggedFromFolder) delete tilesData[activeFolderCoords].items[draggedCoords];
    else if (to !== draggedCoords) delete tilesData[draggedCoords];
    
    saveToLocal(); renderGrid();
    if(draggedFromFolder) openFolder(activeFolderCoords);
}

function handleDropFolder(to) {
    saveSnapshot();
    const folder = tilesData[activeFolderCoords];
    if (!draggedFromFolder) {
        folder.items[to] = tilesData[draggedCoords];
        delete tilesData[draggedCoords];
        renderGrid();
    } else {
        let temp = folder.items[draggedCoords];
        folder.items[draggedCoords] = folder.items[to];
        folder.items[to] = temp;
    }
    saveToLocal(); openFolder(activeFolderCoords);
}

function handleDropOut(e) {
    if (!draggedFromFolder) return;
    const overlay = document.getElementById('folderOverlay');
    overlay.style.pointerEvents = 'none'; 
    const targetElement = document.elementFromPoint(e.clientX, e.clientY)?.closest('.tile');
    overlay.style.pointerEvents = 'auto';
    if (targetElement && targetElement.id.startsWith('tile-')) {
        handleDropMain(targetElement.id.replace('tile-', ''));
        closeFolder();
    }
}

// 7. ÉDITION
function openModal(coords) {
    currentEditingCoords = coords;
    tempBase64 = "";
    const data = (activeFolderCoords !== null) ? tilesData[activeFolderCoords].items[coords] : tilesData[coords];
    
    if (data?.type === 'folder') {
        openFolderModal(data);
    } else {
        openLinkModal(data);
    }
}

function openLinkModal(data) {
    document.getElementById('linkName').value = data?.name || '';
    document.getElementById('linkUrl').value = data?.url || '';
    document.getElementById('linkImg').value = data?.img || '';
    const preview = document.getElementById('linkPreview');
    preview.style.display = data?.img ? "block" : "none";
    if(data?.img) preview.src = data.img;
    document.getElementById('modalLink').style.display = 'flex';
}

function openFolderModal(data) {
    document.getElementById('folderName').value = data?.name || 'Nouveau Dossier';
    document.getElementById('folderImg').value = data?.img || '';
    const preview = document.getElementById('folderPreview');
    preview.style.display = data?.img ? "block" : "none";
    if(data?.img) preview.src = data.img;
    document.getElementById('modalFolder').style.display = 'flex';
}

function closeAllModals() {
    document.getElementById('modalLink').style.display = 'none';
    document.getElementById('modalFolder').style.display = 'none';
}

function confirmEditLink() {
    saveSnapshot();
    const name = document.getElementById('linkName').value;
    let url = document.getElementById('linkUrl').value;
    const img = tempBase64 || document.getElementById('linkImg').value;
    if (url && !url.startsWith('http')) url = 'https://' + url;

    const targetStore = (activeFolderCoords !== null) ? tilesData[activeFolderCoords].items : tilesData;
    targetStore[currentEditingCoords] = { name, url, img, type: 'link' };

    saveToLocal(); closeAllModals();
    if (activeFolderCoords !== null) openFolder(activeFolderCoords);
    else renderGrid();
}

function confirmEditFolder() {
    saveSnapshot();
    const name = document.getElementById('folderName').value;
    const img = tempBase64 || document.getElementById('folderImg').value;
    const existing = tilesData[currentEditingCoords] || {};
    tilesData[currentEditingCoords] = {
        ...existing, name, img, type: 'folder',
        items: existing.items || {},
        fConfig: existing.fConfig || {cols:3, rows:2, gap:10, fBgColor:'#1e293b'}
    };
    saveToLocal(); closeAllModals(); renderGrid();
}

function deleteItem() {
    saveSnapshot();
    if (activeFolderCoords !== null) delete tilesData[activeFolderCoords].items[currentEditingCoords];
    else delete tilesData[currentEditingCoords];
    saveToLocal(); closeAllModals();
    if (activeFolderCoords !== null) openFolder(activeFolderCoords);
    else renderGrid();
}

// 8. RECHERCHE & MÉDIAS
function searchIcons() {
    let url = document.getElementById('linkUrl').value;
    if (!url) return;
    const container = document.getElementById('linkSuggestions');
    container.innerHTML = ''; container.style.display = 'grid';
    try {
        const domain = new URL(url.startsWith('http') ? url : 'https://'+url).hostname;
        const apis = [`https://logo.clearbit.com/${domain}`, `https://icon.horse/icon/${domain}`];
        apis.forEach(src => {
            const img = document.createElement('img');
            img.src = src; img.className = 'suggestion-item';
            img.onclick = () => { 
                document.getElementById('linkImg').value = src; 
                const prev = document.getElementById('linkPreview');
                prev.src = src; prev.style.display = "block";
            };
            container.appendChild(img);
        });
    } catch(e) {}
}

function previewLocalImage(input, previewId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { 
            tempBase64 = e.target.result; 
            const prev = document.getElementById(previewId);
            prev.src = tempBase64; prev.style.display = "block"; 
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function searchGoogleImages(type) {
    let query = type === 'link' ? document.getElementById('linkName').value : document.getElementById('folderName').value;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}+icon&tbm=isch`, '_blank');
}

// 9. IMPORT/EXPORT
// 8. IMPORT/EXPORT
function exportData() {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const fileName = `export_speed_dial_perso_${dateStr}_${timeStr}.json`;
    const blob = new Blob([JSON.stringify({config, data: tilesData})], {type: 'application/json'});
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob); 
    a.download = fileName; 
    a.click();
}

function importData(e) {
    const r = new FileReader();
    r.onload = (ev) => { 
        const res = JSON.parse(ev.target.result); 
        tilesData = res.data; config = res.config; 
        saveToLocal(); location.reload(); 
    };
    r.readAsText(e.target.files[0]);
}

function updateFooterClock() {
    const timeEl = document.getElementById('footerTime');
    const dateEl = document.getElementById('footerDate');
    if (!timeEl || !dateEl) return;

    const now = new Date();

    // Heure format : 23:10
    timeEl.textContent = now.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    // Date format : Samedi 10 janvier
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    dateEl.textContent = now.toLocaleDateString('fr-FR', options);
}

// Lancement immédiat et actualisation toutes les secondes
updateFooterClock();
setInterval(updateFooterClock, 1000);

// 10. LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    init();
    const listen = (id, evt, fn) => { const el = document.getElementById(id); if(el) el.addEventListener(evt, fn); };
    
    listen('btn-menu', 'click', toggleMenu);
	listen('btn-close-sidebar', 'click', toggleMenu);
    listen('overlay', 'click', toggleMenu);
    listen('bgInput', 'input', updateGridParams);
    listen('tileColorInput', 'input', inputGridParams);
    listen('folderTileColorInput', 'input', inputGridParams);
    listen('colsInput', 'input', inputGridParams);
    listen('rowsInput', 'input', inputGridParams);
    listen('gapInput', 'input', inputGridParams);
    listen('fontInput', 'input', inputGridParams);
    listen('btn-undo', 'click', undo);
    listen('btn-export', 'click', exportData);
    listen('btn-trigger-import', 'click', () => document.getElementById('importFile').click());
    listen('importFile', 'change', importData);
    listen('fCols', 'input', updateFolderSettings);
    listen('fRows', 'input', updateFolderSettings);
    listen('fGap', 'input', updateFolderSettings);
    listen('fPopBg', 'input', updateFolderSettings);
    listen('folderOverlay', 'click', (e) => { if(e.target.id === 'folderOverlay') closeFolder(); });
    listen('folderOverlay', 'drop', handleDropOut);
    listen('folderOverlay', 'dragover', (e) => e.preventDefault());
    listen('linkImgFile', 'change', (e) => previewLocalImage(e.target, 'linkPreview'));
    listen('folderImgFile', 'change', (e) => previewLocalImage(e.target, 'folderPreview'));
    
    window.addEventListener('keydown', (e) => { 
        if(e.key === "Escape") { closeAllModals(); closeFolder(); } 
    });
});