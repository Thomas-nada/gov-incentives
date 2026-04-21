#!/usr/bin/env python3
import http.server
import socketserver
import os

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, fmt, *args):
        print('  %s - %s' % (self.address_string(), fmt % args))

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print('Governance Rewards Engine — dev server')
print('http://localhost:%d' % PORT)
with socketserver.TCPServer(('', PORT), Handler) as httpd:
    httpd.serve_forever()
