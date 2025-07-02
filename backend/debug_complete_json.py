#!/usr/bin/env python3
"""
Debug script to test complete JSON generation
"""

import requests
import json
from pathlib import Path

# Configuration
API_BASE = "http://localhost:8000"

def debug_complete_json():
    """Debug the complete JSON generation process"""
    
    print("=== Debugging Complete JSON Generation ===")
    
    # Step 1: Check if document is processed
    print("\n1. Checking if document is processed...")
    response = requests.get(f"{API_BASE}/get_reading_order")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Document processed: {len(data['refs'])} refs, {len(data['texts'])} texts")
        print(f"Sample refs: {data['refs'][:5]}")
        print(f"Sample texts: {list(data['texts'].keys())[:5]}")
    else:
        print(f"❌ No document processed: {response.text}")
        return
    
    # Step 2: Save complete JSON and markdown
    print("\n2. Saving complete JSON and markdown...")
    response = requests.post(f"{API_BASE}/save_complete_json_and_markdown")
    
    if response.status_code == 200:
        result = response.json()
        print("✅ Complete JSON and markdown saved!")
        print(f"JSON path: {result['json_path']}")
        print(f"Markdown path: {result['markdown_path']}")
        
        # Check if files exist
        json_path = Path(result['json_path'])
        markdown_path = Path(result['markdown_path'])
        
        print(f"JSON file exists: {json_path.exists()}")
        print(f"Markdown file exists: {markdown_path.exists()}")
        
        if json_path.exists():
            # Read and check the JSON structure
            with open(json_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            
            print(f"\nJSON Structure:")
            print(f"- Keys: {list(json_data.keys())}")
            print(f"- Schema: {json_data.get('schema_name', 'N/A')}")
            print(f"- Version: {json_data.get('version', 'N/A')}")
            print(f"- Body children count: {len(json_data.get('body', {}).get('children', []))}")
            print(f"- Texts count: {len(json_data.get('texts', []))}")
            print(f"- Pictures count: {len(json_data.get('pictures', []))}")
            print(f"- Tables count: {len(json_data.get('tables', []))}")
            print(f"- Groups count: {len(json_data.get('groups', []))}")
            
            # Show first few body children
            body_children = json_data.get('body', {}).get('children', [])
            print(f"\nFirst 5 body children:")
            for i, child in enumerate(body_children[:5]):
                print(f"  {i}: {child}")
        
    else:
        print(f"❌ Failed to save complete JSON: {response.text}")
        return
    
    # Step 3: Test download endpoint
    print("\n3. Testing download endpoint...")
    response = requests.get(f"{API_BASE}/download_complete_edited_json")
    
    if response.status_code == 200:
        print("✅ Download endpoint working!")
        print(f"Content-Type: {response.headers.get('content-type')}")
        print(f"Content-Length: {len(response.content)} bytes")
        
        # Save the downloaded content to check
        with open("downloaded_complete_json.json", "wb") as f:
            f.write(response.content)
        
        # Try to parse the downloaded JSON
        try:
            downloaded_data = json.loads(response.content)
            print(f"✅ Downloaded JSON is valid!")
            print(f"- Keys: {list(downloaded_data.keys())}")
            print(f"- Schema: {downloaded_data.get('schema_name', 'N/A')}")
        except json.JSONDecodeError as e:
            print(f"❌ Downloaded JSON is invalid: {e}")
            print(f"First 200 chars: {response.content[:200]}")
    else:
        print(f"❌ Download endpoint failed: {response.text}")

if __name__ == "__main__":
    debug_complete_json()