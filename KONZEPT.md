# Prozess‑Generator im Visio‑Look — Konzept

Eine lokale Web‑Anwendung (eine einzige HTML‑Datei), die aus einer **Textbeschreibung** per KI ein **Flussdiagramm mit Swimlanes** erzeugt und es live in einer an **Microsoft Visio** angelehnten Oberfläche aufbaut. Links/zentral die Zeichenfläche, rechts das Chatfenster. Als Sprachmodell dient **Mistral**.

---

## 1. Ziel und Leitgedanke

Der Nutzer beschreibt einen Geschäftsprozess in natürlicher Sprache. Die App lässt das KI‑Modell daraus ein **striktes, validierbares Prozessmodell (JSON)** erzeugen und rendert dieses deterministisch als Diagramm. Der unzuverlässige Teil (Sprache → Struktur) bleibt damit klar getrennt vom zuverlässigen Teil (Struktur → Zeichnung).

```
Texteingabe (Chat)  →  Mistral  →  Prozessmodell (JSON)  →  Validierung
        →  Auto‑Layout (Swimlanes)  →  SVG‑Canvas im Visio‑Look  →  Export
```

Wichtig: Das Sprachmodell zeichnet **nicht** direkt. Es liefert nur Daten. Das vermeidet kaputtes XML, unsaubere Geometrie und nicht reproduzierbare Ergebnisse.

---

## 2. Oberfläche (Visio‑Look)

Die UI orientiert sich am Erscheinungsbild von Visio, ohne dessen Funktionsumfang nachzubauen:

- **Titel-/Menüleiste** mit App‑Namen und schlanker, thematischer Ribbon‑Zeile (Gruppen wie „Datei", „Start", „Einfügen" — rein optisch).
- **Shapes‑Stencil** (schmale Leiste links): zeigt die Flussdiagramm‑Symbole (Start/Ende, Prozess, Entscheidung, Daten …) als Wiedererkennungswert.
- **Zeichenfläche (Mitte):** weiße „Seite" mit feinem Raster, Linealen und Swimlane‑Bändern. Hier wird das Diagramm **schrittweise sichtbar aufgebaut** (Shapes erscheinen nacheinander mit kurzer Einblend‑Animation), damit man „sieht, was gerade gebaut wird".
- **Zoom‑Steuerung** unten rechts (Plus/Minus/Einpassen) wie in Visio.
- **Chatfenster (rechts):** Eingabe der Prozessbeschreibung, Verlauf der Konversation, Statusmeldungen während der Generierung sowie Folgeanweisungen zum Verfeinern.

### Layout‑Skizze

```
┌───────────────────────────────────────────────────────────────┐
│  Visio Prozess‑Generator        Datei  Start  Einfügen  …       │  Ribbon
├──────┬──────────────────────────────────────────┬──────────────┤
│ S    │  ▏Lineal                                  │  Chat         │
│ h    │ ┌──────────────────────────────────────┐  │  ───────────  │
│ a    │ │ Lane: Kunde     [Start]→[Bestellen]  │  │  Verlauf …    │
│ p    │ ├──────────────────────────────────────┤  │               │
│ e    │ │ Lane: Lager        [Prüfen]◇         │  │               │
│ s    │ ├──────────────────────────────────────┤  │  ───────────  │
│      │ │ Lane: Versand        [Versenden]→[●] │  │  [Eingabe]    │
│      │ └──────────────────────────────────────┘  │  [Senden]     │
│      │                              ⊖ ▭ ⊕ Zoom   │               │
└──────┴──────────────────────────────────────────┴──────────────┘
```

---

## 3. Datenmodell (Prozessmodell)

Das KI‑Modell muss exakt dieses JSON‑Schema liefern (per JSON‑Mode erzwungen):

```json
{
  "title": "Bestellprozess",
  "lanes": ["Kunde", "Lager", "Versand"],
  "nodes": [
    { "id": "n1", "label": "Bestellung aufgeben", "type": "start",     "lane": "Kunde"   },
    { "id": "n2", "label": "Verfügbarkeit prüfen", "type": "process",   "lane": "Lager"   },
    { "id": "n3", "label": "Auf Lager?",            "type": "decision",  "lane": "Lager"   },
    { "id": "n4", "label": "Ware versenden",        "type": "process",   "lane": "Versand" },
    { "id": "n5", "label": "Nachbestellen",         "type": "process",   "lane": "Lager"   },
    { "id": "n6", "label": "Abgeschlossen",         "type": "end",       "lane": "Versand" }
  ],
  "edges": [
    { "from": "n1", "to": "n2", "label": "" },
    { "from": "n2", "to": "n3", "label": "" },
    { "from": "n3", "to": "n4", "label": "Ja"   },
    { "from": "n3", "to": "n5", "label": "Nein" },
    { "from": "n4", "to": "n6", "label": "" }
  ]
}
```

**Knotentypen** und ihre Visio‑Symbole:

| `type`       | Symbol                       | Bedeutung               |
|--------------|------------------------------|-------------------------|
| `start`/`end`| Terminator (abgerundet)      | Anfang / Ende           |
| `process`    | Rechteck                     | Aktivität / Schritt     |
| `decision`   | Raute                        | Verzweigung (Ja/Nein)   |
| `io`         | Parallelogramm               | Ein‑/Ausgabe, Daten     |
| `subprocess` | Rechteck mit Seitenbalken    | Teilprozess             |

**Validierung** (im Code, ohne KI): genau ein Start vorhanden, jede `lane` aus der `lanes`‑Liste, alle `edge`‑Referenzen existieren, jede Entscheidung hat ≥ 2 ausgehende Kanten. Bei Fehlern wird das Modell mit der Fehlermeldung erneut zur KI geschickt (Korrekturschleife).

---

## 4. KI‑Anbindung (Mistral)

- **Endpoint:** `https://api.mistral.ai/v1/chat/completions` (OpenAI‑kompatibel, Bearer‑Token).
- **Modell:** standardmäßig `mistral-large-latest` (zuverlässigste strukturierte Ausgabe), umstellbar auf `mistral-small-latest` (günstiger) in den Einstellungen.
- **JSON‑Mode:** `response_format: { "type": "json_object" }`; das System‑Prompt verlangt ausdrücklich reines JSON nach obigem Schema.
- **Verfeinern:** Das aktuelle Prozessmodell wird bei Folgeanweisungen mitgeschickt, damit Änderungen inkrementell erfolgen („Füge einen Genehmigungsschritt hinzu").

---

## 5. Auto‑Layout mit Swimlanes

Reines, deterministisches JavaScript (keine externe Bibliothek):

1. **Spalten (Rang):** Längster‑Pfad‑Verfahren entlang der Kanten ab den Start‑Knoten ergibt für jeden Knoten eine Spalte (Fließrichtung links → rechts). Rückkanten (Zyklen) werden beim Ranking ignoriert.
2. **Zeilen (Lanes):** Jede Swimlane ist ein horizontales Band fester Höhe. Ein Knoten sitzt im Band seiner `lane`, an der X‑Position seiner Spalte. Teilen sich mehrere Knoten Lane + Spalte, werden sie im Band gestapelt.
3. **Verbinder:** orthogonale Pfeile zwischen den Shapes; Kanten‑Beschriftungen (z. B. „Ja"/„Nein") sitzen am Pfeil.

So nutzt man KI für die Semantik und einen einfachen, robusten Algorithmus für die Geometrie.

---

## 6. Export

Die App rendert intern SVG, daraus ergeben sich mehrere Ausgaben:

- **`.vsdx` (experimentell):** wird im Browser als gültiges OPC‑Paket (ZIP) zusammengesetzt — Shapes als Rechteck‑Geometrien, Verbinder als Linien, Lanes als Bänder, jeweils mit Text. In Visio öffnen und weiterbearbeiten. *Hinweis:* Ohne Test in einer echten Visio‑Installation als „best effort" zu verstehen.
- **`.svg`:** universell, öffnet überall (auch in **draw.io / diagrams.net**, kostenlos, das `.vsdx` lesen/schreiben kann — der lizenzfreie Weg „bearbeitbar in Visio").
- **`.json`:** das Prozessmodell selbst, für Weiterverarbeitung in einer serverseitigen Pipeline.

---

## 7. Sicherheit: API‑Key

- Der Key wird **zur Laufzeit** in den Einstellungen eingegeben und nur im `localStorage` des lokalen Browsers gehalten — er ist **nicht** in der HTML‑Datei fest verdrahtet.
- Dadurch kann die HTML/ZIP gefahrlos weitergegeben werden, ohne den Schlüssel preiszugeben (Empfänger tragen ihren eigenen Key ein).
- Ein einmal anderswo geteilter Key gilt als kompromittiert und sollte in der Mistral‑Console neu erzeugt werden.

---

## 8. CORS / lokaler Betrieb

Provider‑APIs erlauben oft keine direkten Browser‑Aufrufe (CORS). Damit die App rein lokal funktioniert, liegt der ZIP ein **winziger optionaler Proxy** (`start.py`, nur Python‑Standardbibliothek) bei:

- `python start.py` startet einen lokalen Server unter `http://localhost:8000`, liefert die HTML aus und leitet API‑Aufrufe an Mistral weiter (löst CORS, der Key bleibt lokal).
- Alternativ lässt sich die HTML direkt per Doppelklick öffnen; klappt der Direktaufruf wegen CORS nicht, weist die App auf den Proxy hin.

---

## 9. Lieferumfang (ZIP)

```
visio-ki-generator/
├─ visio-ki-generator.html   ← die App (eine Datei, ohne externe Abhängigkeiten)
├─ start.py                  ← optionaler lokaler Proxy (gegen CORS)
├─ KONZEPT.md                ← dieses Dokument
└─ README.md                 ← Kurzanleitung
```

Die ZIP lässt sich weiterverschicken; Empfänger benötigen nur einen Browser (und für die KI‑Funktion einen eigenen Mistral‑API‑Key sowie Internet).
