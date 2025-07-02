# Complete JSON Saving and Markdown Generation

This document explains the new functionality added to `main.py` that allows saving complete edited JSON (including all groups, text, tables) and generating markdown from it, similar to the Streamlit approach.

## New Endpoints

### 1. Process Local PDF
```http
POST /process_local_pdf
Content-Type: application/json

{
  "pdf_path": "C:/path/to/your/document.pdf"
}
```

### 2. Save Complete JSON and Markdown
```http
POST /save_complete_json_and_markdown
```

This endpoint:
- Saves the complete edited JSON with all groups, text, and tables
- Generates markdown from the complete JSON
- Returns paths to both files

### 3. Download Complete Edited JSON
```http
GET /download_complete_edited_json
```

Downloads the complete edited JSON file.

### 4. Download Complete Edited Markdown
```http
GET /download_complete_edited_markdown
```

Downloads the complete edited markdown file.

## How It Works

### Step 1: Text Editing and Extraction
- Text areas are created for each text block
- User edits are stored in session state
- When "Save All" is clicked, all edited text is extracted

### Step 2: Reading Order Processing
```python
# Remove nested elements (same logic as Streamlit)
group_lis = []
for i in group_dic.values():
    for j in i:
        group_lis.append(j)

for i in group_lis:
    if i in final_refs:
        final_refs.remove(i)

# Similar removal for picture and table captions
```

### Step 3: JSON Generation and Modification
```python
# Generate initial JSON
output_path_json = pdf_to_json(PDF_PATH, document)

# Load and modify JSON
with open(output_path_json, "r") as f:
    x = json.load(f)

# Update body children with new order
x["body"]["children"] = children

# Update text content with edited texts
for i in x.get("texts", []):
    if i.get("self_ref") in text_dic:
        i["text"] = text_dic[i["self_ref"]]
```

### Step 4: Markdown Generation
```python
# Generate markdown from complete edited JSON
markdown_path = json_loader(complete_json_path)
markdown_content = read_markdown_file(markdown_path)
```

## Frontend Integration

The frontend has been updated to use these new endpoints:

### Save All (JSON) Button
```javascript
const handleSaveAll = async () => {
  // 1. Save all orders and text changes
  await axios.post(`${API_BASE}/save_all_orders`, orderData);
  
  // 2. Save complete edited JSON and generate markdown
  await axios.post(`${API_BASE}/save_complete_json_and_markdown`);
  
  // 3. Download the complete edited JSON
  const jsonResponse = await axios.get(`${API_BASE}/download_complete_edited_json`);
  // ... download logic
};
```

### Export to Markdown Button
```javascript
const handleExportMarkdown = async () => {
  // 1. Save all orders and text changes
  await axios.post(`${API_BASE}/save_all_orders`, orderData);
  
  // 2. Save complete edited JSON and generate markdown
  await axios.post(`${API_BASE}/save_complete_json_and_markdown`);
  
  // 3. Download the complete edited markdown
  const res = await axios.get(`${API_BASE}/download_complete_edited_markdown`);
  // ... download logic
};
```

## Testing with Local Files

Use the provided test script:

```bash
cd backend
python test_local_pdf.py
```

Make sure to update the `PDF_PATH` variable in the test script with your actual PDF path.

## File Structure

After processing, the following files are created in the `output` directory:

```
output/
├── uploaded.pdf                    # Original uploaded PDF
├── uploaded_complete_edited.json   # Complete edited JSON
├── uploaded_complete_edited.md     # Generated markdown
├── page_images/                    # Page images
├── annotated_images/               # Annotated page images
└── boxes/                          # Bounding boxes per page
```

## Key Differences from Previous Implementation

1. **Complete JSON**: Now saves the entire document structure, not just bounding boxes
2. **Local File Support**: Can process local PDF files like the Streamlit version
3. **Group Handling**: Properly handles groups, pictures, and tables with their relationships
4. **Text Editing**: Preserves all edited text content in the final JSON
5. **Markdown Generation**: Generates markdown from the complete edited JSON structure

## Usage Flow

1. **Upload PDF** or **Process Local PDF**
2. **Edit text content** in the frontend
3. **Reorder blocks** using drag and drop
4. **Mark pages as corrected**
5. **Click "Save All (JSON)"** to save complete edited JSON
6. **Click "Export to Markdown"** to download the generated markdown

This implementation now matches the Streamlit logic for complete document processing and editing.