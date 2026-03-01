// 1. VARIABLES GLOBALES
let tilesData = {};
let config = { 
    cols: 4, rows: 4, gap: 15, fontSize: 12, 
    fontFamily: "'Segoe UI', sans-serif",
    bgColor: '#000000', tileBgColor: '#000000', folderTileBgColor: '#ffd43b' 
};

try {
    tilesData = JSON.parse(localStorage.getItem('sd_v2_data')) || {};
    const savedConfig = JSON.parse(localStorage.getItem('sd_v2_config'));
    if (savedConfig) config = { ...config, ...savedConfig };
} catch (e) {
    console.error("Erreur de lecture du localStorage :", e);
}

let currentEditingCoords = null;
let gridParamsDebounceTimer = null;
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
    clearTimeout(gridParamsDebounceTimer);
    gridParamsDebounceTimer = setTimeout(_applyGridParams, 600);
}

function _applyGridParams() {
    const oldCols = config.cols;
    const oldRows = config.rows;
    
    config.cols = parseInt(document.getElementById('colsInput').value) || 1;
    config.rows = parseInt(document.getElementById('rowsInput').value) || 1;
    config.gap = parseInt(document.getElementById('gapInput').value) || 0;
    config.fontSize = parseInt(document.getElementById('fontInput').value) || 12;
    config.fontFamily = document.getElementById('fontFamilyInput').value;
    config.tileBgColor = document.getElementById('tileColorInput').value;
    config.folderTileBgColor = document.getElementById('folderTileColorInput').value;

    if (config.cols < oldCols || config.rows < oldRows) {
        saveSnapshot();
        const itemsToRelocate = [];

        // Identifier les tuiles qui sortent des nouvelles limites
        Object.keys(tilesData).forEach(coords => {
            const [c, r] = coords.split('-').map(Number);
            if (c >= config.cols || r >= config.rows) {
                itemsToRelocate.push({ data: tilesData[coords], oldC: c, oldR: r });
                delete tilesData[coords];
            }
        });

        // Replacer les tuiles selon la distance la plus courte
        itemsToRelocate.forEach(item => {
            let bestCoords = null;
            let minDistance = Infinity;

            for (let r = 0; r < config.rows; r++) {
                for (let c = 0; c < config.cols; c++) {
                    let newCoords = `${c}-${r}`;
                    if (!tilesData[newCoords]) {
                        // Calcul de distance euclidienne : √((x2-x1)² + (y2-y1)²)
                        let dist = Math.sqrt(Math.pow(c - item.oldC, 2) + Math.pow(r - item.oldR, 2));
                        if (dist < minDistance) {
                            minDistance = dist;
                            bestCoords = newCoords;
                        }
                    }
                }
            }

            if (bestCoords) {
                tilesData[bestCoords] = item.data;
            }
        });
    }

    renderGrid();
    saveToLocal();
}

function changeGridSetting(field, delta) {
    const input = document.getElementById(field);
    if (!input) return;
    const newVal = Math.max(1, (parseInt(input.value) || 1) + delta);
    input.value = newVal;
    // Mettre à jour le stepper affiché
    if (field === 'colsInput') { const el = document.getElementById('stepperColsVal'); if (el) el.textContent = newVal; }
    if (field === 'rowsInput') { const el = document.getElementById('stepperRowsVal'); if (el) el.textContent = newVal; }
    inputGridParams();
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
    
    if(document.getElementById('bgInput')) {
        document.getElementById('bgInput').value = config.bgColor;
        document.getElementById('colsInput').value = config.cols;
        document.getElementById('rowsInput').value = config.rows;
        document.getElementById('gapInput').value = config.gap;
        document.getElementById('fontInput').value = config.fontSize;
        document.getElementById('fontFamilyInput').value = config.fontFamily || "'Segoe UI', sans-serif";
        document.getElementById('tileColorInput').value = config.tileBgColor;
        const sc = document.getElementById('stepperColsVal');
        const sr = document.getElementById('stepperRowsVal');
        if (sc) sc.textContent = config.cols;
        if (sr) sr.textContent = config.rows;
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

    // Sur mobile : calcule une hauteur fixe par ligne pour que toutes les lignes soient visibles
    if (window.innerWidth <= 600) {
        const availH = window.innerHeight - 80 - 20 - (config.gap * (config.rows - 1));
        const rowH = Math.max(60, Math.floor(availH / config.rows));
        document.documentElement.style.setProperty('--row-height', rowH + 'px');
    }
    document.documentElement.style.setProperty('--font-size', config.fontSize + 'px');
    document.body.style.fontFamily = config.fontFamily;
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
    div.className = 'tile' + (data ? (data.type === 'folder' ? ' folder' : '') : ' empty');
    div.id = isMain ? `tile-${coords}` : `folder-tile-${coords}`;
    
    if (data) {
        div.draggable = true;
        if (data.type === 'folder') {
            div.innerHTML = winFolderSVG;
            if(data.img) div.innerHTML += `<img src="${data.img}" class="folder-thumb">`;
            div.innerHTML += `<div class="tile-label">${data.name}</div>`;
            div.addEventListener('click', (e) => { e.stopPropagation(); openFolder(coords); });
        } else {
            const icon = data.img || `https://www.google.com/s2/favicons?domain=${data.url}&sz=128`;
            div.innerHTML = `<img src="${icon}"><div class="tile-label">${data.name}</div>`;
            div.addEventListener('click', (e) => { e.stopPropagation(); window.open(data.url, '_blank'); });
        }
    } else {
        div.innerHTML = ''; 
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            if (div.innerHTML === '') {
                document.querySelectorAll('.choice-menu').forEach(m => m.remove());
                document.querySelectorAll('.tile.empty').forEach(t => { t.innerHTML = ''; t.style.opacity = ""; });
                div.innerHTML = '<span style="font-size:40px; color:var(--accent); font-weight:bold; pointer-events:none;">+</span>';
                div.style.opacity = "1";
            } 
            else if (!div.querySelector('.choice-menu')) {
                div.innerHTML = `
                    <div class="choice-menu" style="display:flex; flex-direction:column; gap:8px; width:100%; height:100%; align-items:center; justify-content:center; background:rgba(0,0,0,0.85); border-radius:12px; position:absolute; top:0; left:0; z-index:100;">
                        <button class="menu-btn" data-action="link" style="background:var(--accent); border:none; color:black; border-radius:4px; padding:4px 8px; font-weight:bold; cursor:pointer; font-size:10px; width:80%;">🔗 LIEN</button>
                        <button class="menu-btn" data-action="folder" style="background:#ffca28; border:none; color:black; border-radius:4px; padding:4px 8px; font-weight:bold; cursor:pointer; font-size:10px; width:80%;">📂 DOSSIER</button>
                    </div>
                `;
                
                div.querySelectorAll('.menu-btn').forEach(btn => {
                    btn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        if(btn.dataset.action === 'link') openModal(coords);
                        else createEmptyFolder(coords);
                        renderGrid();
                    });
                });
            }
        });
    }

    div.addEventListener('contextmenu', (e) => {
        if (data) {
            e.preventDefault();
            e.stopPropagation();
            openTileActionsModal(coords);
        }
    });

    // --- TOUCH : long press (édition) + drag tactile avec clone flottant ---
    if (data) {
        let longPressTimer = null;
        let touchStartX = 0;
        let touchStartY = 0;
        let longPressFired = false;
        let touchDragStarted = false;
        let touchClone = null;

        div.addEventListener('touchstart', (e) => {
            longPressFired = false;
            touchDragStarted = false;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;

            longPressTimer = setTimeout(() => {
                longPressFired = true;
                if (navigator.vibrate) navigator.vibrate(40);
                openTileActionsModal(coords);
            }, 500);
        }, { passive: false });

        div.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;

            if (!touchDragStarted && !longPressFired && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                touchDragStarted = true;
                draggedCoords = coords;
                draggedFromFolder = !isMain;

                const rect = div.getBoundingClientRect();
                touchClone = div.cloneNode(true);
                touchClone.style.cssText = `
                    position: fixed;
                    width: ${rect.width}px;
                    height: ${rect.height}px;
                    left: ${rect.left}px;
                    top: ${rect.top}px;
                    opacity: 0.8;
                    pointer-events: none;
                    z-index: 9999;
                    border-radius: 12px;
                    transform: scale(1.1);
                    box-shadow: 0 8px 30px rgba(0,0,0,0.6);
                    transition: none;
                `;
                document.body.appendChild(touchClone);
                div.style.opacity = '0.3';
            }

            if (touchDragStarted && touchClone) {
                e.preventDefault();
                const t = e.touches[0];
                const cRect = touchClone.getBoundingClientRect();
                touchClone.style.left = (t.clientX - cRect.width / 2) + 'px';
                touchClone.style.top  = (t.clientY - cRect.height / 2) + 'px';

                document.querySelectorAll('.tile').forEach(tl => tl.classList.remove('drag-over'));
                const hovered = getTileElementAtPoint(t.clientX, t.clientY, div);
                if (hovered) hovered.classList.add('drag-over');
            }
        }, { passive: false });

        div.addEventListener('touchend', (e) => {
            clearTimeout(longPressTimer);
            longPressTimer = null;

            if (longPressFired) {
                longPressFired = false;
                return;
            }

            if (touchDragStarted) {
                if (touchClone) { touchClone.remove(); touchClone = null; }
                div.style.opacity = '';
                document.querySelectorAll('.tile').forEach(tl => tl.classList.remove('drag-over'));

                const touch = e.changedTouches[0];
                const tx = touch.clientX;
                const ty = touch.clientY;

                if (!isMain) {
                    // === Drag depuis l'intérieur d'un dossier ===
                    const popup = document.getElementById('folderPopup');
                    const popupRect = popup ? popup.getBoundingClientRect() : null;
                    const isOutside = popupRect && (
                        tx < popupRect.left || tx > popupRect.right ||
                        ty < popupRect.top  || ty > popupRect.bottom
                    );

                    if (isOutside) {
                        const toCoords = getTileCoordsAtPoint(tx, ty, 'main');
                        if (toCoords !== null) {
                            handleDropMain(toCoords);
                            closeFolder();
                        }
                    } else {
                        const toCoords = getTileCoordsAtPoint(tx, ty, 'folder');
                        if (toCoords !== null && toCoords !== coords) {
                            handleDropFolder(toCoords);
                        }
                    }
                } else {
                    // === Drag depuis la grille principale ===
                    const toCoords = getTileCoordsAtPoint(tx, ty, 'main');
                    if (toCoords !== null && toCoords !== coords) {
                        handleDropMain(toCoords);
                    }
                }

                touchDragStarted = false;
                draggedCoords = null;
            }
        }, { passive: false });
    }

    // Logique de Drag & Drop souris desktop (inchangée)
    div.addEventListener('dragstart', (e) => { draggedCoords = coords; draggedFromFolder = !isMain; div.classList.add('dragging'); e.dataTransfer.setData('text/plain', coords); });
    div.addEventListener('dragend', () => { div.classList.remove('dragging'); document.querySelectorAll('.tile').forEach(t => t.classList.remove('drag-over')); });
    div.addEventListener('dragover', (e) => { e.preventDefault(); if(coords !== draggedCoords) div.classList.add('drag-over'); });
    div.addEventListener('dragleave', () => { div.classList.remove('drag-over'); });
    div.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); div.classList.remove('drag-over'); isMain ? handleDropMain(coords) : handleDropFolder(coords); });

    return div;
}

function duplicateItem(coords) {
    saveSnapshot(); //
    
    const isInsideFolder = (activeFolderCoords !== null); //
    const targetStore = isInsideFolder ? tilesData[activeFolderCoords].items : tilesData; //
    const sourceData = targetStore[coords]; //

    if (!sourceData) return; //

    const [srcC, srcR] = coords.split('-').map(Number); //

    // Copie profonde pour éviter de lier les références (surtout pour les dossiers)
    const newData = JSON.parse(JSON.stringify(sourceData)); //
    if (newData.name) newData.name += " (copie)"; //

    const maxCols = isInsideFolder ? (tilesData[activeFolderCoords].fConfig.cols) : config.cols; //
    const maxRows = isInsideFolder ? 50 : config.rows + 10; //

    let bestCoords = null;
    let minDistance = Infinity;

    // Correction des variables r et c dans les boucles
    for (let r = 0; r < maxRows; r++) { //
        for (let c = 0; c < maxCols; c++) { //
            let targetCoords = `${c}-${r}`; //
            if (!targetStore[targetCoords]) { //
                // Calcul de la distance euclidienne
                let dist = Math.sqrt(Math.pow(c - srcC, 2) + Math.pow(r - srcR, 2)); //
                if (dist < minDistance) { //
                    minDistance = dist; //
                    bestCoords = targetCoords; //
                }
            }
        }
    }

    if (bestCoords) { //
        targetStore[bestCoords] = newData; //
        saveToLocal(); //
        if (isInsideFolder) openFolder(activeFolderCoords); else renderGrid(); //
    } else {
        alert("Plus de place disponible pour dupliquer !"); //
    }
}

// 5. LOGIQUE DOSSIER
function openFolder(coords) {
    activeFolderCoords = coords;
    const folder = tilesData[coords];
    const overlay = document.getElementById('folderOverlay');
    const fGrid = document.getElementById('folderGrid');
    const fPopup = document.getElementById('folderPopup');
    const mainGrid = document.getElementById('grid');
    
    if (!folder) return;

    fPopup.style.display = "none"; 
    fPopup.style.opacity = "1";
    fPopup.style.transform = "scale(1)";

    if (window.innerWidth < 600) {
        document.body.style.overflow = 'hidden';
    }

    fPopup.style.display = "flex";
    fPopup.style.flexDirection = "column";

    document.getElementById('fCols').value = folder.fConfig.cols;
    document.getElementById('fRows').value = folder.fConfig.rows;
    document.getElementById('fGap').value = folder.fConfig.gap;
    document.getElementById('fPopBg').value = folder.fConfig.fBgColor;
    const ftmCols = document.getElementById('ftmColsVal');
    const ftmRows = document.getElementById('ftmRowsVal');
    if (ftmCols) ftmCols.textContent = folder.fConfig.cols;
    if (ftmRows) ftmRows.textContent = folder.fConfig.rows;
    
    const itemsKeys = Object.keys(folder.items || {});
    let maxR = folder.fConfig.rows - 1;
    itemsKeys.forEach(key => { const [c, r] = key.split('-').map(Number); if (r > maxR) maxR = r; });
    const displayRows = Math.max(folder.fConfig.rows, maxR + 1);

    const isMobile = window.innerWidth < 600;
    const colWidth = isMobile ? 80 : 100;

    fGrid.style.display = 'grid';
fGrid.style.gridTemplateColumns = isMobile ? `repeat(${folder.fConfig.cols}, 1fr)` : `repeat(${folder.fConfig.cols}, ${colWidth}px)`;
document.documentElement.style.setProperty('--fcols', folder.fConfig.cols);
fGrid.style.gap = `${folder.fConfig.gap}px`;
fPopup.style.backgroundColor = folder.fConfig.fBgColor;

// AJOUT DE CES LIGNES POUR FORCER LE SCROLL DANS LE SCRIPT
fGrid.style.overflowY = 'auto'; 
fGrid.style.maxHeight = 'calc(80vh - 100px)'; // Réserve de la place pour la toolbar et le bouton fermer
fGrid.innerHTML = '';
    
    if (isMobile) {
        fPopup.style.position = "fixed";
        fPopup.style.left = "5vw";
        fPopup.style.top = "10vh";
        fPopup.style.width = "90vw";
        fPopup.style.margin = "0";
    } else {
        const originTile = document.getElementById(`tile-${coords}`);
        if (originTile) {
            const rect = originTile.getBoundingClientRect();
            fPopup.style.position = 'absolute';
            fPopup.style.width = "max-content";
            
            // Placement initial sur la tuile
            let posX = rect.left + window.scrollX;
            let posY = rect.top + window.scrollY;
            
            fPopup.style.left = `${posX}px`;
            fPopup.style.top = `${posY}px`;

            // On utilise un double délai pour être certain que le rendu CSS est terminé
            requestAnimationFrame(() => {
                const popupWidth = fPopup.offsetWidth;
                const popupHeight = fPopup.offsetHeight;
                const viewportWidth = document.documentElement.clientWidth; // Largeur sans scrollbar
                const viewportHeight = window.innerHeight;

                // Marge de sécurité de 20px
                const margin = 20;

                // 1. Correction horizontale (Collision Droite)
                if (posX + popupWidth > viewportWidth - margin) {
                    posX = viewportWidth - popupWidth - margin;
                }

                // 2. Correction horizontale (Collision Gauche)
                if (posX < margin) {
                    posX = margin;
                }

                // 3. Correction verticale (Collision Bas)
                if (posY + popupHeight > viewportHeight - margin) {
                    posY = viewportHeight - popupHeight - margin;
                }

                // 4. Correction verticale (Collision Haut)
                if (posY < margin) {
                    posY = margin;
                }

                fPopup.style.left = `${posX}px`;
                fPopup.style.top = `${posY}px`;
            });
        }
    }

    if (!folder.items) folder.items = {};
    for(let r=0; r < displayRows; r++) {
        for(let c=0; c < folder.fConfig.cols; c++) {
            let fCoords = `${c}-${r}`;
            fGrid.appendChild(createTile(fCoords, folder.items[fCoords], false));
        }
    }

    overlay.style.display = 'flex'; 
    if(mainGrid) mainGrid.style.filter = 'blur(3px)';
    
    fPopup.animate([
        { transform: 'scale(0.9)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 }
    ], { duration: 200, easing: 'ease-out' });
}

function closeFolder() { 
    const fPopup = document.getElementById('folderPopup');
    const overlay = document.getElementById('folderOverlay');
    const mainGrid = document.getElementById('grid');
    
    if (!overlay || overlay.style.display === 'none') return;

    document.body.style.overflow = '';

    const anim = fPopup.animate([
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.9)', opacity: 0 }
    ], { duration: 150, easing: 'ease-in' });

    anim.onfinish = () => {
        overlay.style.display = 'none';
        if(mainGrid) mainGrid.style.filter = 'none';
        activeFolderCoords = null;
        fPopup.style.opacity = "0"; 
        fPopup.style.display = "none";
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
// Trouve l'élément tuile sous un point (excluant la tuile draggée)
function getTileElementAtPoint(x, y, exclude) {
    const tiles = document.querySelectorAll('.tile');
    for (const tile of tiles) {
        if (tile === exclude) continue;
        const r = tile.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            return tile;
        }
    }
    return null;
}

// Trouve les coords d'une tuile à partir de coordonnées écran
// mode 'main' → cherche dans #grid, mode 'folder' → cherche dans #folderGrid
function getTileCoordsAtPoint(x, y, mode) {
    const selector = mode === 'main' ? '#grid .tile' : '#folderGrid .tile';
    const prefix   = mode === 'main' ? 'tile-'        : 'folder-tile-';
    const tiles = document.querySelectorAll(selector);
    for (const tile of tiles) {
        const r = tile.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            if (tile.id.startsWith(prefix)) return tile.id.replace(prefix, '');
        }
    }
    return null;
}

function changeFolderSetting(field, delta) {
    const folder = tilesData[activeFolderCoords];
    if (!folder) return;
    const input = document.getElementById(field);
    if (!input) return;
    const newVal = Math.max(1, (parseInt(input.value) || 1) + delta);
    input.value = newVal;
    updateFolderSettings();
    // Mettre à jour les compteurs de la barre mobile
    if (field === 'fCols') { const el = document.getElementById('ftmColsVal'); if (el) el.textContent = newVal; }
    if (field === 'fRows') { const el = document.getElementById('ftmRowsVal'); if (el) el.textContent = newVal; }
}

function handleDropMain(to) {
    saveSnapshot();
    const source = draggedFromFolder ? tilesData[activeFolderCoords].items[draggedCoords] : tilesData[draggedCoords];
    if (!source) return;
    const target = tilesData[to];
    if (!target) {
        tilesData[to] = source;
    } else if (target.type === 'folder') {
        if (!target.items) target.items = {};
        let found = false, r = 0;
        while (!found) {
            for(let c=0; c < target.fConfig.cols; c++) {
                if(!target.items[`${c}-${r}`]) { target.items[`${c}-${r}`] = source; found = true; break; }
            }
            r++; if (r > 100) break;
        }
    } else if (target !== source) {
        tilesData[to] = {
            type: 'folder', name: "Nouveau Dossier",
            items: {"0-0": target, "1-0": source},
            fConfig: { cols: 4, rows: 4, gap: 10, fBgColor: '#1e293b' }
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

function createEmptyFolder(coords) {
    saveSnapshot();
    const targetStore = (activeFolderCoords !== null) ? tilesData[activeFolderCoords].items : tilesData;
    
    targetStore[coords] = {
        type: 'folder',
        name: "Nouveau Dossier",
        img: "",
        items: {},
        fConfig: { cols: 4, rows: 4, gap: 10, fBgColor: '#1e293b' }
    };
    
    saveToLocal();
    if (activeFolderCoords !== null) {
        openFolder(activeFolderCoords);
    } else {
        renderGrid();
    }
    openModal(coords); // Ouvre la modale pour renommer le dossier immédiatement
}

function openModal(coords) {
    currentEditingCoords = coords;
    tempBase64 = "";
    const data = (activeFolderCoords !== null) ? tilesData[activeFolderCoords].items[coords] : tilesData[coords];
    if (data?.type === 'folder') openFolderModal(data);
    else openLinkModal(data);
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
    if (activeFolderCoords !== null) openFolder(activeFolderCoords); else renderGrid();
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
    if (activeFolderCoords !== null) openFolder(activeFolderCoords); else renderGrid();
}

function openTileActionsModal(coords) {
    currentEditingCoords = coords;

    const anchorEl = document.getElementById(`tile-${coords}`) || document.getElementById(`folder-tile-${coords}`);
    if (!anchorEl) return;

    const modal = document.getElementById('modalTileActions');
    const box = modal.querySelector('.modal-actions');

    // On affiche d'abord pour pouvoir mesurer les dimensions
    modal.style.display = 'block';
    modal.classList.add('active');

    // Positionnement absolu indispensable pour le calcul
    box.style.position = 'fixed'; 

    const rect = anchorEl.getBoundingClientRect();
    
    // On attend le prochain frame pour mesurer la largeur/hauteur réelle de la modale
    requestAnimationFrame(() => {
        const bw = box.offsetWidth;
        const bh = box.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 10;

        // Tentative de placement à droite de la tuile
        let x = rect.right + 10;
        let y = rect.top;

        // Si ça dépasse à droite, on place à gauche de la tuile
        if (x + bw > vw - margin) {
            x = rect.left - bw - 10;
        }

        // Si ça dépasse en bas, on aligne le bas de la modale avec le bas de la tuile
        if (y + bh > vh - margin) {
            y = vh - bh - margin;
        }

        // Sécurités minimales
        if (x < margin) x = margin;
        if (y < margin) y = margin;

        box.style.left = `${x}px`;
        box.style.top = `${y}px`;
        box.style.margin = "0"; // Évite les décalages dus aux CSS existants
    });
}


function closeTileActionsModal() {
    const modal = document.getElementById('modalTileActions');
    modal.classList.remove('active');
    modal.style.display = 'none';
}



// 8. RECHERCHE & MÉDIAS
function searchIcons() {
    let url = document.getElementById('linkUrl').value;
    if (!url) return;
    const container = document.getElementById('linkSuggestions');
    container.innerHTML = ''; container.style.display = 'grid';
    try {
        const domain = new URL(url.startsWith('http') ? url : 'https://'+url).hostname;
        const src = `https://icon.horse/icon/${domain}`;
        const img = document.createElement('img');
        img.src = src; img.className = 'suggestion-item';
        img.addEventListener('click', () => {
            document.getElementById('linkImg').value = src; 
            const prev = document.getElementById('linkPreview');
            prev.src = src; prev.style.display = "block";
        });
        container.appendChild(img);
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

// 9. IMPORT/EXPORT & HORLOGE
function exportData() {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `export_SpeedDialPerso_${dateStr}.json`;
    const blob = new Blob([JSON.stringify({config, data: tilesData})], {type: 'application/json'});
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
}

function importData(e) {
    const r = new FileReader();
    r.onload = (ev) => { 
        const res = JSON.parse(ev.target.result); 
        tilesData = res.data; config = res.config; saveToLocal(); location.reload(); 
    };
    r.readAsText(e.target.files[0]);
}

function updateFooterClock() {
    const timeEl = document.getElementById('footerTime');
    const dateEl = document.getElementById('footerDate');
    if (!timeEl || !dateEl) return;
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

async function importBookmarks(htmlContent) {
    saveSnapshot();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const folders = doc.querySelectorAll('dl > dt > h3');

    function getNextFreeCoords() {
        let r = 0;
        while (true) {
            for (let c = 0; c < config.cols; c++) {
                let coords = `${c}-${r}`;
                if (!tilesData[coords]) {
                    if (r >= config.rows) config.rows = r + 1;
                    return coords;
                }
            }
            r++; if (r > 500) break;
        }
    }

    const processLinks = (links, name) => {
        const folderCoords = getNextFreeCoords();
        tilesData[folderCoords] = {
            type: 'folder', name: name, img: "", items: {},
            fConfig: { cols: 4, rows: 4, gap: 10, fBgColor: '#1e293b' }
        };
        links.forEach((link, lIdx) => {
            const lx = lIdx % 4; const ly = Math.floor(lIdx / 4);
            tilesData[folderCoords].items[`${lx}-${ly}`] = {
                type: 'link', name: link.textContent.trim(), url: link.href, img: ""
            };
        });
    };

    if (folders.length === 0) {
        processLinks(doc.querySelectorAll('body > dl > dt > a'), "Favoris Importés");
    } else {
        folders.forEach(h3 => {
            const dl = h3.nextElementSibling;
            if (dl && dl.tagName === 'DL') {
                const links = dl.querySelectorAll(':scope > dt > a');
                if (links.length > 0) processLinks(links, h3.textContent);
            }
        });
    }
    saveToLocal(); alert("Importation réussie !"); location.reload();
}

// 10. LISTENERS (DÉMARRAGE)
document.addEventListener('DOMContentLoaded', () => {
    init();
    updateFooterClock();
    setInterval(updateFooterClock, 1000);

    const listen = (id, evt, fn) => { 
        const el = document.getElementById(id); 
        if(el) el.addEventListener(evt, fn); 
    };
    
	// Fermer les modales d'édition au clic sur l'overlay (fond semi-transparent)
    listen('modalLink', 'click', (e) => {
        if (e.target.id === 'modalLink') closeAllModals();
    });

    listen('modalFolder', 'click', (e) => {
        if (e.target.id === 'modalFolder') closeAllModals();
    });
	
    // Fermer les menus de choix (création ou duplication) si on clique ailleurs
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.choice-menu')) {
            document.querySelectorAll('.choice-menu').forEach(m => m.remove());
            // Réinitialise l'apparence des tuiles vides qui affichaient le "+"
            document.querySelectorAll('.tile.empty').forEach(t => {
                if (t.innerHTML !== '') {
                    t.innerHTML = '';
                    t.style.opacity = "";
                }
            });
        }
    });

    // Import bookmarks
    listen('btn-import-bookmarks', 'click', () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.html';
        input.onchange = e => {
            const reader = new FileReader();
            reader.onload = ev => importBookmarks(ev.target.result);
            reader.readAsText(e.target.files[0]);
        };
        input.click();
    });

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
    listen('fontFamilyInput', 'change', inputGridParams);
    listen('btn-undo', 'click', undo);
    listen('btn-export', 'click', exportData);
    listen('btn-trigger-import', 'click', () => document.getElementById('importFile').click());
    listen('importFile', 'change', importData);
    listen('fCols', 'input', updateFolderSettings);
    listen('fRows', 'input', updateFolderSettings);
    listen('fGap', 'input', updateFolderSettings);
    listen('fPopBg', 'input', updateFolderSettings);
    listen('closeFolderBtn', 'click', closeFolder);
    listen('folderOverlay', 'click', (e) => { if(e.target.id === 'folderOverlay') closeFolder(); });
    listen('folderOverlay', 'drop', handleDropOut);
    listen('folderOverlay', 'dragover', (e) => e.preventDefault());
    listen('linkImgFile', 'change', (e) => previewLocalImage(e.target, 'linkPreview'));
    listen('folderImgFile', 'change', (e) => previewLocalImage(e.target, 'folderPreview'));
    listen('btn-auto-icon', 'click', searchIcons);
    listen('btn-confirm-link', 'click', confirmEditLink);
    listen('btn-confirm-folder', 'click', confirmEditFolder);

    document.querySelectorAll('.btn-close-modals').forEach(btn => btn.addEventListener('click', closeAllModals));
    document.querySelectorAll('.btn-delete-item').forEach(btn => btn.addEventListener('click', deleteItem));
    document.querySelectorAll('.btn-google-search').forEach(btn => btn.addEventListener('click', () => searchGoogleImages(btn.dataset.type)));
    document.querySelectorAll('.modal-stop-prop').forEach(modal => modal.addEventListener('click', (e) => e.stopPropagation()));

    document.querySelectorAll('.search-input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') window.open(input.dataset.url + encodeURIComponent(input.value), '_blank');
        });
    });

document.querySelectorAll('#modalTileActions .action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        closeTileActionsModal();

        if (action === 'edit') openModal(currentEditingCoords);
        if (action === 'duplicate') duplicateItem(currentEditingCoords);
        if (action === 'delete') {
            if (confirm("Voulez-vous vraiment supprimer cet élément ?")) {
                deleteItem();
            }
        }
    });
});

document.getElementById('modalTileActions')
    .addEventListener('click', closeTileActionsModal);


    window.addEventListener('keydown', (e) => { 
        if(e.key === "Escape") { 
            closeAllModals(); 
            closeFolder(); 
            // Ferme aussi les menus contextuels ouverts
            document.querySelectorAll('.choice-menu').forEach(m => m.remove());
            document.querySelectorAll('.tile.empty').forEach(t => {
                t.innerHTML = '';
                t.style.opacity = "";
            });
        } 
        if(e.key === "Enter") {
            if (document.getElementById('modalLink').style.display === 'flex') confirmEditLink();
            else if (document.getElementById('modalFolder').style.display === 'flex') confirmEditFolder();
        }
    });

    // Panneau d'aide
    function openHelpPanel() {
        console.log('[SpeedDial] openHelpPanel appelé');
        document.getElementById('helpPanel').classList.add('open');
        document.getElementById('helpOverlay').classList.add('active');
    }
    function closeHelpPanel() {
        document.getElementById('helpPanel').classList.remove('open');
        document.getElementById('helpOverlay').classList.remove('active');
    }
    const btnHelp = document.getElementById('btn-help');
    console.log('[SpeedDial] btn-help trouvé :', btnHelp);
    if (btnHelp) btnHelp.addEventListener('click', openHelpPanel);

    const helpOverlay = document.getElementById('helpOverlay');
    if (helpOverlay) helpOverlay.addEventListener('click', closeHelpPanel);

    const btnCloseX = document.getElementById('btn-close-help-x');
    if (btnCloseX) btnCloseX.addEventListener('click', closeHelpPanel);

    const btnCloseBottom = document.getElementById('btn-close-help-bottom');
    if (btnCloseBottom) btnCloseBottom.addEventListener('click', closeHelpPanel);

    const btnCancelTile = document.getElementById('btn-cancel-tile-actions');
    if (btnCancelTile) btnCancelTile.addEventListener('click', closeTileActionsModal);

    console.log('[SpeedDial] Tous les listeners enregistrés.');
});