browser.tabs.onCreated.addListener(async (tab) => {
    // On récupère tous les onglets ouverts dans la fenêtre
    const allTabs = await browser.tabs.query({ windowId: tab.windowId });
    
    // URL de notre extension
    const extensionUrl = browser.runtime.getURL("index.html");

    // Si l'onglet qui vient de s'ouvrir est votre index.html
    if (tab.url === extensionUrl || tab.pendingUrl === extensionUrl) {
        // On cherche s'il y a déjà un autre onglet avec la même URL (déjà chargé ou en cours)
        const duplicateTab = allTabs.find(t => 
            t.id !== tab.id && 
            (t.url === extensionUrl || t.url === "about:newtab" || t.pendingUrl === extensionUrl)
        );
        
        if (duplicateTab) {
            // Si un doublon existe déjà, on ferme le nouveau pour ne garder que l'ancien
            browser.tabs.remove(tab.id);
        }
    }
});