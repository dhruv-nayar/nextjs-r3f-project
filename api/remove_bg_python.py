"""
Serverless function for background removal using rembg
"""
from http.server import BaseHTTPRequestHandler
import json
import base64
from io import BytesIO
from PIL import Image
from rembg import remove


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            if 'imageData' not in data:
                self.send_error(400, 'Missing imageData in request')
                return

            image_data = data['imageData']

            # Remove data:image/...;base64, prefix if present
            if ',' in image_data:
                image_data = image_data.split(',')[1]

            # Decode base64 image
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
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            response = {
                'success': True,
                'processedImageData': f'data:image/png;base64,{output_base64}',
                'message': 'Background removed successfully'
            }

            self.wfile.write(json.dumps(response).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            error_response = {
                'success': False,
                'error': f'Processing failed: {str(e)}'
            }

            self.wfile.write(json.dumps(error_response).encode('utf-8'))
