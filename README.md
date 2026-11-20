# MemoBam PWA — Sola Lettura (Mobile & ChromeOS)

Applicazione **PWA in sola lettura** parallela a **MemoBam Desktop**, pensata per consultare da **Smartphone** e **ChromeOS** l'Archivio Documenti e il Diario Giornaliero.

## Caratteristiche

- **Sola Lettura**: nessuna modifica, eliminazione o upload da telefono/ChromeOS.
- **Allegati solo indicati**: i nomi dei file e i percorsi relativi su PC vengono mostrati a scopo informativo, senza tentare aperture/download locali (poiché i file fisici risiedono sul PC).
- **Consultazione completa**:
  - Ricerca istantanea per titolo, nome file, note, testo diario, data e ora.
  - Filtro per giorno tramite calendario e filtro **"Solo in sospeso"** (`Da terminare`).
  - Toggle **"Escludi allegati diario"** nell'archivio.
  - Banner **"Da terminare"** con salto rapido alla scheda.
  - Tema **Chiaro / Scuro**.
- **Origine Dati**:
  - **Importa JSON**: carica `archivio_memobam.json` e `diario_index.json` nella cache offline locale (`IndexedDB`).
  - **Collega Cartella (ChromeOS / Desktop Chrome)**: collega in **sola lettura** la cartella sincronizzata `MemoBam`.

## Avvio in locale (porta dedicata `5187`)

```powershell
cd d:\Repository\MemoBam-PWA
.\start-pwa.ps1
```

Oppure direttamente:

```powershell
python -m http.server 5187
```

Apri `http://localhost:5187` nel browser.

## Pubblicazione & Installazione

Pubblica su **GitHub Pages** dal repository `https://github.com/ambruno1968/MemoBamPWA` (branch `main`, root `/`) per ottenere l'URL HTTPS e installare la PWA su **Android**, **iOS** e **ChromeOS**.
