"""
Vercel Serverless Function: Convert images to 3D GLB
Endpoint: /api/images_to_glb

PLACEHOLDER: This will call external TRELLIS API when ready
"""

from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Convert images to 3D GLB using TRELLIS (placeholder)"""
        try:
            # Parse request
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body)

            # Placeholder response
            self._send_response(501, {
                'success': False,
                'error': 'Not implemented',
                'message': 'TRELLIS integration coming soon. Use direct GLB upload for now.'
            })

            # Future implementation:
            # 1. Get image URLs from request
            # 2. Call TRELLIS API (external service or HuggingFace)
            # 3. Return job ID for polling
            # 4. Client polls /api/job_status until complete
            # 5. Return GLB download URL

        except Exception as e:
            self._send_error(500, str(e))

    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self._send_cors_headers()
        self.end_headers()

    def _send_response(self, status_code, data):
        """Send JSON response with CORS headers"""
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def _send_error(self, status_code, message):
        """Send error response"""
        self._send_response(status_code, {
            'success': False,
            'error': message
        })

    def _send_cors_headers(self):
        """Send CORS headers"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
