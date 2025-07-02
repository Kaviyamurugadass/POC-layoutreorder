#!/usr/bin/env python3
"""
Test script to demonstrate local PDF processing functionality
Similar to the Streamlit approach but using the FastAPI backend
"""

import requests
import json
from pathlib import Path

# Configuration
API_BASE = "http://localhost:8000"
PDF_PATH = r"C:\Users\Kaviya\Downloads\docling_articlehtml-1-2.pdf"  # Update this path

def test_local_pdf_processing():
    """Test the local PDF processing functionality"""
    
    print("Testing local PDF processing...")
    
    # Step 1: Process local PDF
    print(f"Processing PDF: {PDF_PATH}")
    response = requests.post(f"{API_BASE}/process_local_pdf", 
                           json={"pdf_path": PDF_PATH})
    
    if response.status_code == 200:
        print("✅ PDF processed successfully!")
        print(response.json())
    else:
        print(f"❌ Failed to process PDF: {response.text}")
        return
    
    # Step 2: Get reading order
    print("\nGetting reading order...")
    response = requests.get(f"{API_BASE}/get_reading_order")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Reading order retrieved: {len(data['refs'])} items")
        print(f"Text items: {len(data['texts'])}")
    else:
        print(f"❌ Failed to get reading order: {response.text}")
        return
    
    # Step 3: Save complete edited JSON and markdown
    print("\nSaving complete edited JSON and markdown...")
    response = requests.post(f"{API_BASE}/save_complete_json_and_markdown")
    
    if response.status_code == 200:
        result = response.json()
        print("✅ Complete edited JSON and markdown saved!")
        print(f"JSON path: {result['json_path']}")
        print(f"Markdown path: {result['markdown_path']}")
    else:
        print(f"❌ Failed to save complete JSON: {response.text}")
        return
    
    # Step 4: Download complete edited JSON
    print("\nDownloading complete edited JSON...")
    response = requests.get(f"{API_BASE}/download_complete_edited_json")
    
    if response.status_code == 200:
        # Save the JSON file
        output_path = Path("complete_edited_document.json")
        with open(output_path, "wb") as f:
            f.write(response.content)
        print(f"✅ Complete edited JSON downloaded: {output_path}")
    else:
        print(f"❌ Failed to download JSON: {response.text}")
    
    # Step 5: Download complete edited markdown
    print("\nDownloading complete edited markdown...")
    response = requests.get(f"{API_BASE}/download_complete_edited_markdown")
    
    if response.status_code == 200:
        # Save the markdown file
        output_path = Path("complete_edited_document.md")
        with open(output_path, "wb") as f:
            f.write(response.content)
        print(f"✅ Complete edited markdown downloaded: {output_path}")
    else:
        print(f"❌ Failed to download markdown: {response.text}")

if __name__ == "__main__":
    # Check if PDF file exists
    if not Path(PDF_PATH).exists():
        print(f"❌ PDF file not found: {PDF_PATH}")
        print("Please update the PDF_PATH variable with a valid path to your PDF file.")
    else:
        test_local_pdf_processing()