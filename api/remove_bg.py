"""
Vercel Serverless Function: Remove background from images
Endpoint: /api/remove_bg
"""

from http.server import BaseHTTPRequestHandler
import json
import base64
from io import BytesIO
from PIL import Image
import traceback

# Import rembg for background removal
try:
    from rembg import remove
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Remove background from uploaded image"""
        try:
            # Check if rembg is available
            if not REMBG_AVAILABLE:
                self._send_error(500, "rembg package not available")
                return

            # Get content length
            content_length = int(self.headers['Content-Length'])

            # Read and parse JSON body
            body = self.rfile.read(content_length)
            data = json.loads(body)

            # Get base64 image data
            if 'imageData' not in data:
                self._send_error(400, "Missing imageData in request")
                return

            image_data = data['imageData']

            # Decode base64 image
            if ',' in image_data:
                # Remove data:image/...;base64, prefix
                image_data = image_data.split(',')[1]

            image_bytes = base64.b64decode(image_data)

            # Open image with PIL
            input_image = Image.open(BytesIO(image_bytes))

            # Remove background
            output_image = remove(input_image)

            # Convert to bytes
            output_buffer = BytesIO()
            output_image.save(output_buffer, format='PNG')
            output_bytes = output_buffer.getvalue()

            # Encode to base64
            output_base64 = base64.b64encode(output_bytes).decode('utf-8')

            # Send response
            self._send_response(200, {
                'success': True,
                'processedImageData': f'data:image/png;base64,{output_base64}',
                'message': 'Background removed successfully'
            })

        except Exception as e:
            error_msg = str(e)
            traceback_str = traceback.format_exc()
            print(f"Error: {error_msg}\n{traceback_str}")
            self._send_error(500, f"Processing failed: {error_msg}")

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
