# MemoBam PWA

Applicazione **PWA completa** allineata a **MemoBam Desktop (v1.5.0)** per gestire **Archivio Documenti** e **Diario Giornaliero** su **PC**, **ChromeOS** e **Smartphone**.

## Caratteristiche principali

- **Archivio Documenti Drag & Drop**: trascinamento o selezione di file con titolo personalizzato e note opzionali, data (`dd/MM/yyyy`) e ora (`HH:mm:ss`) automatiche, apertura file, modifica titolo/note ed eliminazione con conferma.
- **Diario Giornaliero**: selezione automatica del giorno odierno, pulsanti `Oggi` / `Tutti i giorni`, ricerca multi-giorno, toolbar di formattazione (`B`, `I`, `• Elenco`, `☑ Spunta` secondaria non ripetibile sulla stessa riga), finestra di dettaglio (`Apri`), allegati in bozza e su righe esistenti (con drag & drop diretto sulla riga), colori pastello alternati.
- **Spunta "Fatto" e Banner "Da terminare"**: casella `Fatto` su ogni scheda e riga del diario, evidenziazione in ambra per gli elementi in sospeso e barra di avviso in alto con elenco espandibile e pulsanti rapidi **Apri** e **✓ Fatto**.
- **Filtro allegati Diario in Archivio**: spunta **`Escludi allegati provenienti dal Diario`** attiva di default.
- **Tema Chiaro / Scuro** (`🌙 Scuro` / `☀️ Chiaro`) e filigrana **MemoBam** sullo sfondo.
- **Origine Dati**:
  - **Collega Cartella (ChromeOS / Desktop Chrome / Edge)**: lettura e scrittura diretta nella cartella `MemoBam` (`archivio_memobam.json`, sottocartelle `YYYY-MM`, `Diario/diario_index.json`, `Diario/Allegati/YYYY-MM-DD`, `Diario/Diario_YYYY-MM-DD.md`).
  - **Archiviazione Offline Locale (IndexedDB)**: salvataggio completo di schede, diario e file su smartphone e browser senza File System Access API, con Importa/Esporta JSON.

## Avvio in locale (porta dedicata `5187`)

```powershell
cd d:\Repository\MemoBam-PWA
.\start-pwa.ps1
```

Apri `http://localhost:5187` nel browser.

## Pubblicazione

Pubblicata su **GitHub Pages** dal repository `https://github.com/ambruno1968/MemoBamPWA` (branch `main`, root `/`).
