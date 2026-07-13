# Konzept: Zweiter Diagrammtyp „Flussdiagramm" (State of the Art)

> **Status: umgesetzt.** Dieses Dokument war die Planungsgrundlage; der zweite Modus ist
> inzwischen in `visio-ki-generator.html` implementiert (Typ‑Umschalter oben links), inklusive
> symboltreuem, geprüftem VSDX‑Export für beide Modi. Der Abschnitt §6 ist entsprechend aktualisiert.

**Ziel:** Der Prozess‑Generator soll neben dem heutigen **BPMN‑/Swimlane‑Modus** einen zweiten,
umschaltbaren Modus **„Flussdiagramm"** nach anerkannten Regeln (ISO 5807 / DIN 66001) anbieten –
mit **denselben Exporten** (SVG, VSDX, JSON) wie der bestehende Modus.

Dieses Dokument beschreibt zuerst die heutige Funktionsweise (Analyse), leitet daraus die
Erweiterung ab und endet mit einer konkreten Umsetzungs‑Checkliste inkl. Aufwandsschätzung und
einer Verifikation gegen den tatsächlichen Code.

---

## 1. Analyse: So arbeitet das Tool heute

Die App ist eine **einzige HTML‑Datei** (`visio-ki-generator.html`, ~1044 Zeilen, gesamte Logik
inline) plus einem winzigen Proxy (`start.py`, nur Python‑Standardbibliothek) gegen CORS und zum
Verwahren des Mistral‑Keys.

### 1.1 Verarbeitungskette

```
Text (Chat) → Mistral (JSON-Mode) → Prozessmodell (JSON) → validateModel()
   → computeLayout() → renderLayout() (SVG) → Export (SVG / VSDX / JSON)
```

Leitprinzip (aus `KONZEPT.md`): Das Sprachmodell liefert **nur Daten** (striktes JSON), die
Geometrie entsteht deterministisch im Code. Der unsichere Teil (Sprache→Struktur) ist damit vom
sicheren Teil (Struktur→Zeichnung) getrennt.

### 1.2 Die tragenden Funktionen (Fundstellen)

| Baustein | Funktion / Ort | Aufgabe |
|---|---|---|
| System‑Prompt | `SYSTEM_PROMPT` (Z. 229) | Zwingt Mistral auf das Swimlane‑JSON‑Schema |
| API‑Call | `callMistral()` (Z. 268) | Ruft `/proxy` → Mistral, hängt bestehendes Modell an |
| Parsing | `parseModel()` (Z. 308) | JSON robust extrahieren |
| Validierung | `validateModel()` (Z. 323) | Genau 1 Start, Lanes gültig, Kanten referenzieren echte Knoten … |
| Ranking | `computeColumns()` (Z. 364) | Längster‑Pfad, zyklensicher → **Spalte** je Knoten |
| Layout | `computeLayout()` (Z. 391) | Lanes → Zeilenbänder, Spalten → X; liefert Objekt `L` |
| Routing | `anchors()` / `routeEdge()` (Z. 449 / 506) | Orthogonale Verbinder mit Hindernis‑Umgehung |
| Rendering | `renderLayout()` (Z. 597) | Zeichnet SVG: Raster, Lane‑Bänder, Shapes, Verbinder |
| Shapes | `shapeNode()` (Z. 571) | Symbol‑Geometrie je `type` |
| Export SVG | `serializedSVG()` (Z. 746) | SVG‑Klon, CSS‑Variablen aufgelöst |
| Export VSDX | `buildVsdx()` (Z. 842) | Baut echtes Visio‑OPC‑Paket (ZIP) aus `L` |
| Export JSON | `exportJSON()` (Z. 766) | Reines Modell |

### 1.3 Das heutige Datenmodell

```json
{
  "title": "…",
  "lanes": ["Kunde","Lager","Versand"],
  "nodes": [{ "id":"n1","label":"…","type":"start|end|process|decision|io|subprocess","lane":"Kunde" }],
  "edges": [{ "from":"n1","to":"n2","label":"Ja" }]
}
```

Fließrichtung **links → rechts**, jede Rolle ist eine **Swimlane** (horizontales Band). Symbole:
Terminator (Start/Ende), Rechteck (Prozess), Raute (Entscheidung), Parallelogramm (Daten),
Rechteck mit Seitenbalken (Teilprozess).

### 1.4 Schlüssel‑Erkenntnis für die Erweiterung ⭐

**Vorschau (`renderLayout`) und *alle* Exporte (`serializedSVG`, `buildVsdx`) lesen dasselbe
berechnete Layout‑Objekt `L`** – eine Liste von Knoten mit `x/y/w/h`, Kanten und Lanes.

`buildVsdx()` (Z. 850–871) iteriert genau:
- `L.lanes` → Lane‑Rechtecke,
- `L.nodes` → Formen (Position/Größe aus `x/y/w/h`),
- `L.edges` → Verbinder (dieselbe Routing‑Funktion wie die Vorschau).

**Konsequenz:** Wenn der neue Flussdiagramm‑Modus ein `L` **derselben Struktur** erzeugt, dann
funktionieren SVG‑ und VSDX‑Export **automatisch** – „genauso exportierbar" ist damit fast
geschenkt. Es ist *keine* zweite Export‑Pipeline nötig, nur wenige gezielte Anpassungen (siehe
§6).

---

## 2. Zielbild: zwei Modi, eine App

Ein **Umschalter** in der Toolbar wählt den Diagrammtyp. Der Modus steuert vier Dinge:
System‑Prompt, Validierung, Layout und Rendering. Export bleibt geteilt.

```
                         ┌─────────────── Modus: [ BPMN ▼ | Flussdiagramm ] ───────────────┐
Text → Mistral → JSON →  │  Prompt A / B  →  Validierung A / B  →  Layout A / B  →  Render A / B │  → Export (geteilt)
                         └────────────────────────────────────────────────────────────────────┘
```

### 2.1 Abgrenzung der beiden Modi

| Merkmal | **BPMN‑Modus** (heute) | **Flussdiagramm‑Modus** (neu) |
|---|---|---|
| Norm‑Orientierung | BPMN‑nah, Swimlanes | **ISO 5807 / DIN 66001** (klassisches Programm-/Prozess‑Ablaufdiagramm) |
| Fließrichtung | links → rechts | **oben → unten** (Verzweigungen nach rechts/links) |
| Rollen/Abteilungen | **Swimlanes** (Pflicht) | keine Lanes (optional als Anmerkung); eine durchgehende Spur |
| Fokus | *Wer* macht *was* (Organisation) | *Was* passiert in *welcher Reihenfolge* (Ablauf/Logik) |
| Symbole | Terminator, Prozess, Raute, Daten, Teilprozess | + Dokument, Verbinder‑Kreis (On‑Page), Vorbereitung/Schleife, Datenspeicher |
| Start/Ende | je 1 Terminator | genau 1 Start, ≥ 1 klar markiertes Ende |
| Entscheidung | ≥ 2 Kanten mit Label | genau die benannten Zweige (Ja/Nein bzw. Fälle), sauber wieder zusammengeführt |

> **Hinweis zur Benennung:** Genau genommen ist der heutige Modus bereits ein *Swimlane‑Flussdiagramm*.
> Die Unterscheidung, die hier gewünscht ist, ist die zwischen **rollenorientiert (Swimlanes)** und
> **ablauforientiert (klassisches Flussdiagramm ohne Lanes)**. Die Beschriftung im UI kann gerne
> „Prozesslandkarte (Swimlanes)" vs. „Flussdiagramm (klassisch)" lauten, falls „BPMN" missverständlich ist.

---

## 3. Datenmodell (erweitert, abwärtskompatibel)

Ein einziges, um ein Feld erweitertes Schema – kein zweites, paralleles Modell:

```json
{
  "diagramType": "flow",          // NEU: "swimlane" (= heute, Default) | "flow"
  "title": "Rechnungsprüfung",
  "lanes": [],                     // im flow-Modus leer/ignoriert
  "nodes": [
    { "id":"n1","label":"Rechnung erhalten","type":"start" },
    { "id":"n2","label":"Betrag prüfen","type":"process" },
    { "id":"n3","label":"Betrag korrekt?","type":"decision" },
    { "id":"n4","label":"Rechnung freigeben","type":"process" },
    { "id":"n5","label":"Rückfrage stellen","type":"process" },
    { "id":"n6","label":"Archiviert","type":"end" }
  ],
  "edges": [
    { "from":"n1","to":"n2" },
    { "from":"n2","to":"n3" },
    { "from":"n3","to":"n4","label":"Ja" },
    { "from":"n3","to":"n5","label":"Nein" },
    { "from":"n5","to":"n2","label":"korrigiert" },
    { "from":"n4","to":"n6" }
  ]
}
```

- **`diagramType` fehlt** → als `"swimlane"` interpretieren ⇒ **alte gespeicherte Diagramme und JSON‑Dateien laufen unverändert weiter.**
- Im `flow`‑Modus ist `lane` je Knoten optional; `lanes` darf leer sein.
- **Neue Knotentypen** (nur `flow` nutzt sie aktiv, `swimlane` bleibt beim heutigen Satz):
  `document` (Dokument/Bericht), `connector` (On‑Page‑Verbinder‑Kreis für Sprünge/Schleifen),
  `preparation` (Vorbereitung/Schleifenkopf, Sechseck), `data` (Datenspeicher). Optional – der
  Kernsatz start/end/process/decision/io/subprocess genügt für einen ersten Wurf.

---

## 4. State‑of‑the‑Art‑Regeln für den Flussdiagramm‑Modus

Diese Regeln gehen in den **neuen System‑Prompt** und in die **Validierung** ein:

1. **Eindeutiger Ein‑/Ausstieg:** genau ein `start`, mindestens ein klar benanntes `end`.
2. **Eine Fließrichtung:** von oben nach unten; Rückführungen (Schleifen) klar erkennbar, nicht als
   Wirrwarr. Lange Rücksprünge werden über einen **Verbinder‑Kreis** (`connector`) statt einer
   quer laufenden Kante gelöst.
3. **Ein Kasten = eine Handlung:** `process`‑Labels beginnen mit einem Verb („Betrag prüfen"),
   kurz und aktiv.
4. **Entscheidungen sind Fragen:** `decision`‑Labels sind als Frage formuliert, jede ausgehende
   Kante trägt ein **eindeutiges Label** (Ja/Nein bzw. benannte Fälle). Jeder Zweig wird
   **wieder zusammengeführt** oder endet an einem `end`.
5. **Keine losen Enden:** jeder Knoten (außer `end`) hat ≥ 1 ausgehende Kante; jeder Knoten
   (außer `start`) ist erreichbar.
6. **Keine Kreuzungen, wo vermeidbar:** wird vom deterministischen Layout + Routing erledigt.
7. **Symboltreue nach ISO 5807/DIN 66001:** richtige Form je Bedeutung (Terminator oval,
   Prozess Rechteck, Entscheidung Raute, E/A Parallelogramm, Dokument Wellenkante,
   Teilprozess Doppelbalken, Verbinder Kreis).

---

## 5. Umsetzung in den vier modusabhängigen Bausteinen

### 5.1 System‑Prompt (neu: `SYSTEM_PROMPT_FLOW`)

Analog zu `SYSTEM_PROMPT` (Z. 229), aber:
- **ohne** die Swimlane‑Pflicht (`lanes` weglassen / leer),
- **mit** den Regeln aus §4 (Verb‑Labels, Fragen bei Entscheidungen, Schleifen über `connector`),
- Schema mit `diagramType:"flow"` und ohne `lane` je Knoten.

`callMistral()` (Z. 271) wählt je nach aktivem Modus den passenden System‑Prompt. Der Rest der
Funktion (Kontext des bestehenden Modells anhängen, JSON‑Mode, Temperatur 0.2) bleibt gleich.

### 5.2 Validierung (neu: `validateFlow()` neben `validateModel()`)

Wie `validateModel()` (Z. 323), aber:
- `lanes` **nicht** erzwingen,
- zusätzlich §4‑Regeln 5 (keine losen Enden) und 4 (jede `decision` ≥ 2 benannte Kanten) prüfen,
- gleiche **einmalige Korrekturschleife** wie heute (Z. 721–726) wiederverwenden.

Ein Dispatcher `validate(model)` ruft je nach `model.diagramType` die passende Prüfung auf.

### 5.3 Layout (neu: `computeLayoutFlow()` neben `computeLayout()`)

Der vorhandene, zyklensichere Rang‑Algorithmus `computeColumns()` (Z. 364) wird **wiederverwendet** –
nur die **Achsen‑Zuordnung dreht sich**:

- **Rang → Zeile (Y), oben→unten** statt Spalte→X.
- **Keine Lane‑Bänder**, kein Header‑Streifen links: `L.lanes = []`, `L.laneTop/laneHeight` leer.
- **Horizontale Platzierung:** Hauptpfad auf einer mittigen „Spine"; bei `decision` wandert der
  Nein‑Zweig nach rechts (bzw. Ja/Nein symmetrisch), Zusammenführung zurück auf die Spine.
- Das Ergebnis‑Objekt `L` behält **exakt dieselben Felder** (`nodes[{x,y,w,h,type,label}]`,
  `edges`, `pageW`, `pageH`, `title`) – nur `lanes` ist leer. Das ist die Bedingung dafür, dass
  Export und Routing unverändert greifen.

`shapeSize()` (Z. 354) kann geteilt bleiben; bei Bedarf leicht andere Default‑Größen für den
vertikalen Fluss.

### 5.4 Rendering (Verzweigung in `renderLayout()`)

`renderLayout()` (Z. 597) erhält eine Fallunterscheidung:
- **swimlane:** heutiger Pfad (Lane‑Bänder, Header, Lineal) – **unverändert**.
- **flow:** Lane‑Bänder/Header/Rotationslabels **überspringen** (weil `L.lanes` leer ist, ist das
  fast automatisch der Fall); Raster + Seite + Verbinder + Shapes wie gehabt.
- **`shapeNode()`** (Z. 571) um die neuen Symbole erweitern: `document` (Rechteck mit unterer
  Wellenkante als `path`), `connector` (Kreis), `preparation` (Sechseck), `data` (Zylinder).
  Der bestehende `type`‑Switch wird dazu um Zweige ergänzt; Farben über `shapeColors()` (Z. 565).

Die Stencil‑Leiste links (Z. 137) zeigt je nach Modus den passenden Symbolsatz.

---

## 6. Export – „genauso" wie heute, mit minimalem Zutun

Weil Export **layoutgetrieben** ist (§1.4), gilt:

| Export | Änderungsbedarf für den flow‑Modus |
|---|---|
| **JSON** (`exportJSON`, Z. 766) | **Keiner.** Serialisiert das Modell inkl. neuem `diagramType`. |
| **SVG** (`serializedSVG`, Z. 746) | **Keiner** für Geometrie (generischer SVG‑Klon). Nur falls neue Symbole neue CSS‑Variablen einführen, diese in die `map` (Z. 749) aufnehmen. |
| **VSDX** (`buildVsdx`, Z. 842) | **Gering.** Läuft schon über `L.lanes`/`L.nodes`/`L.edges`; bei leeren Lanes entstehen einfach keine Lane‑Rechtecke. |

**Umgesetzt (war vorher die offene Einschränkung):** Der VSDX‑Export ist inzwischen
**symboltreu**. Ein neuer Baustein `nodeShapeVsdx()` erzeugt je Knotentyp die passende, in Visio
direkt editierbare Geometrie:
- **Terminator (Start/Ende):** Rechteck mit `Rounding = Höhe/2` → Stadion/Pille.
- **Entscheidung:** Raute. **Ein-/Ausgabe:** Parallelogramm. **Prozess/Teilprozess:** Rechteck,
  Teilprozess zusätzlich mit zwei Seitenbalken (eigene Geometrie‑Sektionen).
- **Verbinder:** echter Kreis (`Ellipse`‑Geometrie). **Dokument:** Rechteck mit gewellter
  Unterkante.

Diese Verbesserung wirkt in **beiden** Modi. Geprüft: der erzeugte VSDX ist ein gültiges
OPC/ZIP‑Paket, die `page1.xml` ist wohlgeformt (ausbalancierte Tags), enthält die erwartete Zahl
Shapes und die korrekten Geometrie‑Konstrukte (`Ellipse`, `Rounding`, Raute, Wellenkante,
Teilprozess‑Balken).

---

## 7. UI‑Änderungen

1. **Modus‑Umschalter** in der Toolbar (Z. 124), z. B. ein Segmented‑Control links neben „Beispiel":
   ```
   [ Prozesslandkarte (Swimlanes) | Flussdiagramm (klassisch) ]
   ```
2. **Stencil** (Z. 137) tauscht den gezeigten Symbolsatz je Modus.
3. **Beispiel‑Button** (`insertExample`, Z. 1007) liefert je Modus einen passenden Beispieltext
   (rollenorientiert vs. ablauforientiert).
4. **Persistenz:** aktiver Modus in `localStorage` (analog `settings`, Z. 182) und im gespeicherten
   Modell (`diagramType`). `restoreState()` (Z. 203) stellt den Modus mit wieder her; fehlt das Feld,
   greift der Default `swimlane`.
5. **Modus‑Wechsel bei bestehendem Diagramm:** klaren Weg definieren – Empfehlung: Wechsel wirkt
   auf die **nächste** Generierung; das aktuelle Diagramm bleibt bis dahin stehen (kein stiller
   Verlust, konsistent mit dem heutigen „nichts wird grundlos verworfen").

---

## 8. Konkrete Umsetzungs‑Checkliste

1. `settings.diagramType` + LocalStorage‑Key einführen (Default `'swimlane'`).
2. Toolbar‑Umschalter + Event‑Handler; Stencil‑Umschaltung.
3. `SYSTEM_PROMPT_FLOW` schreiben; `callMistral()` wählt Prompt nach Modus.
4. `validateFlow()` + Dispatcher `validate(model)`; in `handleSend()` (Z. 720) einsetzen.
5. `computeLayoutFlow()` (Rang→Y, keine Lanes, Spine + Verzweigung); Dispatcher `layout(model)`.
6. `renderLayout()` um flow‑Zweig ergänzen; `shapeNode()` um neue Symbole erweitern.
7. `diagramType` in `parseModel`/Persistenz durchreichen; `restoreState()` Default setzen.
8. (Optional) VSDX‑ und SVG‑Symbolgeometrie für die neuen Formen ergänzen.
9. Beispieltexte, README/KONZEPT aktualisieren.

**Risikoarm**, weil der bestehende Swimlane‑Pfad **nicht angefasst**, sondern nur **verzweigt**
wird (neue Funktionen neben den alten, Dispatcher nach `diagramType`).

### Aufwandsschätzung (grob)

| Paket | Aufwand |
|---|---|
| UI‑Umschalter, Persistenz, Prompt, Validierung | 0,5–1 Tag |
| `computeLayoutFlow` + Render‑Zweig + neue Symbole (SVG) | 1–2 Tage |
| Symboltreue in VSDX/SVG‑Export (optional) | 0,5–1 Tag |
| Tests (mehrere Beispielprozesse, Export‑Gegenprüfung in Visio/draw.io) | 0,5 Tag |

---

## 9. Verifikation dieses Konzepts gegen den Code

Geprüft an `visio-ki-generator.html`:

- ✅ **Export ist layoutgetrieben.** `buildVsdx()` iteriert `L.lanes`/`L.nodes`/`L.edges`
  (Z. 850–871); `serializedSVG()` klont das gerenderte SVG generisch (Z. 746). Ein flow‑`L`
  mit gleicher Struktur exportiert ohne neue Export‑Pipeline. → Kernannahme bestätigt.
- ✅ **Rang‑Algorithmus ist achsenneutral und wiederverwendbar.** `computeColumns()` liefert nur
  einen Rang je Knoten (Z. 382–389); ob dieser auf X (heute) oder Y (flow) abgebildet wird, ist
  reine Zuordnung in `computeLayout*`. → `computeLayoutFlow` kann darauf aufsetzen.
- ✅ **Modus lässt sich abwärtskompatibel einführen.** Kein Feld im heutigen Modell heißt
  `diagramType`; ein fehlendes Feld als `swimlane` zu interpretieren bricht nichts. `restoreState()`
  lädt Modelle über `md.nodes` (Z. 212) – unabhängig vom neuen Feld.
- ✅ **Rendering trennt Lanes vom Rest.** Lane‑Bänder/Header werden in einer eigenen Schleife
  gezeichnet (Z. 621–627); bei leerem `L.lanes` entfällt das automatisch. → flow‑Render ist eine
  kleine Verzweigung, kein Umbau.
- ✅ **VSDX‑Geometrie symboltreu umgesetzt** (`nodeShapeVsdx`): Terminator (Rounding), Raute,
  Parallelogramm, Verbinder‑Kreis (Ellipse), Dokument‑Welle, Teilprozess‑Balken. Headless getestet:
  gültiges ZIP, wohlgeformte `page1.xml`, korrekte Shape‑Zahl und Geometrie‑Konstrukte.
- ✅ **Moduswechsel mit bestehendem Diagramm gelöst:** Der Wechsel wirkt auf die nächste
  Generierung; ein vorhandenes Modell wird nur dann als Kontext an das LLM gehängt, wenn es zum
  aktiven Modus passt (kein Vermischen von Swimlane‑ und Flow‑Modellen).

**Fazit:** Die Erweiterung ist mit der bestehenden Architektur sauber machbar. Der teuerste Teil
ist nicht der Export (der fällt fast von selbst ab), sondern das **vertikale Auto‑Layout** des
klassischen Flussdiagramms und die **neuen Symbole**. Der heutige Swimlane‑Modus bleibt dabei
unangetastet.
