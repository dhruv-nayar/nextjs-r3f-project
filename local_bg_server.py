"""
Local development server for background removal
Run this alongside npm run dev to test background removal locally

Usage: python local_bg_server.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
from PIL import Image
from rembg import remove

app = Flask(__name__)
CORS(app)  # Allow CORS for local development

@app.route('/api/remove_bg', methods=['POST', 'OPTIONS'])
def remove_background():
    """Remove background from uploaded image"""

    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json()

        if 'imageData' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing imageData in request'
            }), 400

        image_data = data['imageData']

        # Remove data:image/...;base64, prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        # Decode base64 image
        image_bytes = base64.b64decode(image_data)

        # Open image with PIL
        input_image = Image.open(BytesIO(image_bytes))

        print(f"Processing image: {input_image.size}, mode: {input_image.mode}")

        # Remove background
        output_image = remove(input_image)

        print("Background removed successfully")

        # Convert to bytes
        output_buffer = BytesIO()
        output_image.save(output_buffer, format='PNG')
        output_bytes = output_buffer.getvalue()

        # Encode to base64
        output_base64 = base64.b64encode(output_bytes).decode('utf-8')

        return jsonify({
            'success': True,
            'processedImageData': f'data:image/png;base64,{output_base64}',
            'message': 'Background removed successfully'
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Processing failed: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Background removal server is running'})

if __name__ == '__main__':
    print("=" * 60)
    print("Background Removal Server Starting...")
    print("=" * 60)
    print("Server will run on: http://localhost:5001")
    print("Background removal endpoint: http://localhost:5001/api/remove_bg")
    print("Health check: http://localhost:5001/health")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5001, debug=True)
