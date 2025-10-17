# 🚕 Lehrlingsfahrten MurtalTaxi

Ein leichtgewichtiges Web-Interface zur Erfassung von täglichen **Lehrlings-Fahrten**.  
Die Anwendung kommuniziert direkt mit einem **Google Apps Script-Backend**, das die Daten zentral speichert und verarbeitet.

---

## 🔧 Funktionsweise

- **Automatische Routenanzeige**  
  Beim Laden wird Route 1 angezeigt. Per Klick kann auf Route 2 gewechselt werden.  
  Die Daten (Haltepunkte, Distanzen, Fahrer) werden per JSON vom GAS-Endpoint geladen.

- **Strecken- und Reihenfolgeverwaltung**  
  Punkte können durch Ziehen verschoben oder per Checkbox aktiviert/deaktiviert werden.  
  Die Gesamtdistanz wird automatisch neu berechnet.

- **Fahrer-, Datum- und Schichtauswahl**  
  Oben links können Fahrer, Datum und Schicht gewählt werden.  
  Das Datumsfeld füllt sich automatisch mit dem heutigen Tag.

- **Speichern**  
  Nach Eingabe aller Daten „**Speichern**“ klicken.  
  Die Route wird an den Google-Script-Server gesendet und dort protokolliert.  
  Eine Bestätigung erscheint im linken Infofeld.

- **Design & Bedienung**  
  Hell/Dunkel-Modus über 🌙 / ☀️.  
  Vollständig responsive und offline-tolerant (kurzes Caching im Speicher).

---

## 🧩 Technische Hinweise

- **Frontend:** reines HTML / CSS / Vanilla JS
- **Backend:** Google Apps Script (Web-App Endpoint)
- **Dateien:**
  - `api.js` – Schnittstelle zum GAS-Backend
  - `function.js` – UI- und Render-Logik
  - `main.js` – Initialisierung und Event-Handling
- **Abhängigkeiten:** keine externen Libraries

---

## 🧑‍💻 Entwickler

**Projekt:** Lehrlingsfahrten MurtalTaxi  
**Entwickler:** [Aleksandr Mineev](mailto:mineev1981@gmail.com)  
**Version:** 1.0 · Oktober 2025
