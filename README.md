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

Der `start.py`-Server löst das CORS-Problem und nutzt den **im Backend hinterlegten API-Key** (in `start.py`, Variable `MISTRAL_API_KEY`). Die HTML-Datei selbst enthält keinen Key.

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
- `start.py` — lokaler Proxy, liest den Key aus `config.py`
- `config.py` — enthält den API-Key (später sauber ersetzen)
- `KONZEPT.md` — ausführliches Konzept
- `README.md` — diese Anleitung
