#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lokaler Start-Server fuer den Visio Prozess-Generator.

- Liefert die HTML-App aus.
- Leitet API-Aufrufe (/proxy) an die Mistral-API weiter und loest damit CORS.
- Der API-Key liegt im Backend (siehe MISTRAL_API_KEY unten) und wird
  serverseitig eingesetzt; die HTML-Datei selbst enthaelt keinen Key.

Start:   python start.py
Browser: http://localhost:8000/visio-ki-generator.html
"""

import http.server
import socketserver
import urllib.request
import urllib.error
import os

# ----------------------------------------------------------------------
# API-Key (im Backend, in einer eigenen Datei config.py hinterlegt).
# Vorrang: Umgebungsvariable MISTRAL_API_KEY > config.py > leer.
# Spaeter sauber ersetzbar, ohne start.py anzufassen.
# ----------------------------------------------------------------------
try:
    from config import MISTRAL_API_KEY as _CFG_KEY
except Exception:
    _CFG_KEY = ""
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", _CFG_KEY)

MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"
PORT = int(os.environ.get("PORT", "8000"))  # Railway setzt PORT automatisch
APP_FILE = "/visio-ki-generator.html"


class Handler(http.server.SimpleHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def end_headers(self):
        self._cors()
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        # Root-URL soll direkt die App liefern (schoen fuer Railway-Domain)
        if self.path in ("/", ""):
            self.path = APP_FILE
        return super().do_GET()

    def do_POST(self):
        if self.path.rstrip("/") != "/proxy":
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            req = urllib.request.Request(
                MISTRAL_URL,
                data=body,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + MISTRAL_API_KEY,
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = r.read()
                    code = r.status
            except urllib.error.HTTPError as e:
                data = e.read()
                code = e.code
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data)
        except Exception as exc:  # noqa
            msg = ('{"message":"Proxy-Fehler: ' + str(exc).replace('"', "'") + '"}').encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(msg)

    def log_message(self, *args):
        pass  # leiser Server


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or ".")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print("Visio Prozess-Generator laeuft auf Port %d." % PORT)
        print("Lokal:  http://localhost:%d/" % PORT)
        print("Auf Railway ueber die zugewiesene Domain erreichbar.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer beendet.")


if __name__ == "__main__":
    main()
