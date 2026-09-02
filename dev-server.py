#!/usr/bin/env python3
"""Static dev server for the Governance Rewards portal.

Threaded on purpose: the app loads seven JSON files plus a dozen ES modules in
parallel, and a single-threaded handler deadlocks under keep-alive.
"""
import argparse
import http.server
import os
import sys

DEFAULT_PORT = 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write('  %s - %s\n' % (self.address_string(), fmt % args))
        sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(description='Serve the portal locally.')
    parser.add_argument('-p', '--port', type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.ThreadingHTTPServer(('', args.port), Handler)
    server.daemon_threads = True
    print('Governance Rewards Portal - dev server')
    print('http://localhost:%d' % args.port)
    print('Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
        server.server_close()


if __name__ == '__main__':
    main()
