# Visio Prozess-Generator — Kurzanleitung

Eine lokale App, die aus einer Textbeschreibung per KI (Mistral) ein **Flussdiagramm mit Swimlanes** im **Visio-Look** baut. Links die Zeichenfläche, rechts der Chat.

## Schnellstart (empfohlen)

Voraussetzung: Python 3 ist installiert.

1. Diesen Ordner entpacken.
2. Im Ordner ein Terminal öffnen und starten:
   ```
   python start.py
   ```
   (unter Windows ggf. `py start.py`)
3. Im Browser öffnen: **http://localhost:8000/visio-ki-generator.html**
4. Rechts im Chat einen Prozess beschreiben, z. B.
   *„Bestellprozess mit Kunde, Lager und Versand"* — oder den Button **＋ Beispiel** nutzen.

Der `start.py`-Server löst das CORS-Problem und nutzt den **im Backend hinterlegten API-Key** (in `config.py`, Variable `MISTRAL_API_KEY`). Die HTML-Datei selbst enthält keinen Key.

**Ohne Python?** Alternativ liegt `server.js` bei (gleiche Funktion wie `start.py`, nur mit Node):
```
node server.js
```
Dann ebenfalls **http://localhost:8000/** öffnen. Der Key wird identisch gelesen (Umgebungsvariable `MISTRAL_API_KEY` vor `config.py`).

## Diagrammtyp wählen

Oben links in der Symbolleiste unter **„Typ"** lassen sich zwei Modi umschalten:

- **Swimlane / BPMN** — rollenorientiert, mit Swimlanes (Fließrichtung links → rechts).
- **Flussdiagramm** — klassisches Ablaufdiagramm nach **ISO 5807 / DIN 66001**, von oben nach unten, ohne Swimlanes (mit Start/Ende, Prozess, Entscheidung, Ein-/Ausgabe, Dokument, Teilprozess und Verbindungskreis).

Die Auswahl wirkt auf die **nächste** Beschreibung; das Sprachmodell wendet je Modus eigene Regeln an. Beide Modi exportieren identisch nach VSDX/SVG/JSON.

## Hinweis zum Betrieb

Dies ist ein Prototyp. Der API-Key liegt im Backend in einer eigenen Datei **`config.py`** (`MISTRAL_API_KEY = "…"`); `start.py` liest ihn dort ein (eine gesetzte Umgebungsvariable `MISTRAL_API_KEY` hat Vorrang). Die App hat keinen Einstellungsdialog — der Key wird nie im Browser eingegeben. Daher die App immer über `python start.py` starten; ein reiner Doppelklick auf die HTML kann keine KI-Anfrage stellen (kein Backend/CORS).

## Speicherung & Verlauf

- **Chatverlauf, Diagramm und Gesprächskontext** werden im Browser (localStorage) gespeichert und beim erneuten Öffnen automatisch wiederhergestellt.
- **Folgeanweisungen bauen auf dem bestehenden Diagramm auf** — es wird nichts grundlos verworfen.
- **„Leeren"** fragt vorher nach und löscht erst nach Bestätigung; ein versehentliches Verwerfen des Diagramms ist damit ausgeschlossen.

## Export

- **VSDX** — in Visio öffnen (experimentell). Falls die Visio-Version zickt: in **draw.io** (kostenlos) öffnen und dort als VSDX speichern.
- **SVG** — universell, öffnet überall (auch in draw.io).
- **JSON** — das reine Prozessmodell.

## Diagramm verfeinern

Nach der ersten Generierung im Chat einfach Änderungen anweisen, z. B.
*„Füge nach der Prüfung einen Genehmigungsschritt durch den Teamleiter hinzu"* —
das Diagramm wird neu aufgebaut.

## Sicherheit

Der aktuell hinterlegte API-Key wurde im Chat geteilt und sollte in der Mistral-Console **neu erzeugt** werden. Wird dieser Ordner inklusive `start.py` weitergegeben, reist der Key mit — zum Teilen den Key in `start.py` vorher entfernen oder auf eine Umgebungsvariable umstellen (siehe Kommentar in `start.py`).

## Dateien

- `visio-ki-generator.html` — die App (key-frei, ohne externe Abhängigkeiten)
- `start.py` — lokaler Proxy (Python), liest den Key aus `config.py`
- `server.js` — lokaler Proxy (Node), gleiche Funktion für Rechner ohne Python
- `config.py` — enthält den API-Key (später sauber ersetzen)
- `KONZEPT.md` — ausführliches Konzept (Swimlane-Modus)
- `KONZEPT-FLUSSDIAGRAMM.md` — Konzept des zweiten Modus (klassisches Flussdiagramm)
- `README.md` — diese Anleitung
