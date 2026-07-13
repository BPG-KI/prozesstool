#!/usr/bin/env node
/*
 * Lokaler Start-Server (Node-Variante von start.py) fuer den Prozess-Generator.
 *
 * - Liefert die HTML-App aus.
 * - Leitet API-Aufrufe (/proxy) an die Mistral-API weiter und loest damit CORS.
 * - Der API-Key liegt im Backend: Umgebungsvariable MISTRAL_API_KEY hat Vorrang,
 *   sonst wird MISTRAL_API_KEY aus config.py gelesen. Die HTML enthaelt keinen Key.
 *
 * Diese Datei existiert nur, damit die App auf Rechnern ohne Python laeuft
 * (identisches Verhalten wie start.py). Fuer Railway bleibt start.py massgeblich.
 *
 * Start:   node server.js
 * Browser: http://localhost:8000/
 */
"use strict";
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const APP_FILE = "visio-ki-generator.html";
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const PORT = parseInt(process.env.PORT || "8000", 10);

function readKey() {
  if (process.env.MISTRAL_API_KEY) return process.env.MISTRAL_API_KEY.trim();
  try {
    const cfg = fs.readFileSync(path.join(__dirname, "config.py"), "utf8");
    const m = cfg.match(/MISTRAL_API_KEY\s*=\s*["']([^"']*)["']/);
    if (m && m[1]) return m[1].trim();
  } catch (_) {}
  return "";
}
const MISTRAL_API_KEY = readKey();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

const server = http.createServer((req, res) => {
  cors(res);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "POST" && req.url.replace(/\/+$/, "") === "/proxy") {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const u = new URL(MISTRAL_URL);
      const opts = {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + MISTRAL_API_KEY,
          "Content-Length": body.length,
        },
      };
      const preq = https.request(opts, pres => {
        const out = [];
        pres.on("data", d => out.push(d));
        pres.on("end", () => {
          res.writeHead(pres.statusCode || 502, { "Content-Type": "application/json" });
          res.end(Buffer.concat(out));
        });
      });
      preq.on("error", err => {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Proxy-Fehler: " + String(err.message) }));
      });
      preq.write(body);
      preq.end();
    });
    return;
  }

  if (req.method === "GET") {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel === "/" || rel === "") rel = "/" + APP_FILE;
    // Nur Dateien aus dem App-Ordner ausliefern (kein Directory-Traversal).
    const safe = path.normalize(rel).replace(/^([\\/])+/, "");
    const file = path.join(__dirname, safe);
    if (!file.startsWith(__dirname)) { res.writeHead(403); res.end("Forbidden"); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end("Not found"); return; }
      const ext = path.extname(file).toLowerCase();
      const mime = ext === ".html" ? "text/html; charset=utf-8"
        : ext === ".js" ? "text/javascript"
        : ext === ".json" ? "application/json"
        : ext === ".css" ? "text/css" : "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      res.end(data);
    });
    return;
  }

  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Prozess-Generator (Node) laeuft auf Port " + PORT + ".");
  console.log("Lokal:  http://localhost:" + PORT + "/");
  console.log("API-Key: " + (MISTRAL_API_KEY ? "gefunden" : "FEHLT - in config.py setzen oder MISTRAL_API_KEY exportieren"));
});
