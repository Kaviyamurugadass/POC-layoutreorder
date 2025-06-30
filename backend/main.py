from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse
from pathlib import Path
import shutil
import json
import os
import fitz  # PyMuPDF
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from PIL import Image
import io
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Your React app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("output")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

PDF_PATH = OUTPUT_DIR / "uploaded.pdf"
PAGE_IMAGES_DIR = OUTPUT_DIR / "page_images"
ANNOTATED_IMAGES_DIR = OUTPUT_DIR / "annotated_images"
BOXES_DIR = OUTPUT_DIR / "boxes"
PAGE_IMAGES_DIR.mkdir(exist_ok=True)
ANNOTATED_IMAGES_DIR.mkdir(exist_ok=True)
BOXES_DIR.mkdir(exist_ok=True)

IMAGE_DPI = 150

# Helper to draw bounding boxes on PDF page image
def draw_page_boxes(pdf_path: Path, docling_doc, page_no: int, dpi: int = 150):
    doc = fitz.open(str(pdf_path))
    page = doc[page_no]
    pix = page.get_pixmap(dpi=dpi)
    width, height = pix.width, pix.height

    # Convert to PIL Image
    img_data = pix.tobytes("ppm")
    image = Image.open(io.BytesIO(img_data))
    
    zoom = dpi / 72  # Default PDF resolution is 72 dpi

    # Create matplotlib figure
    fig, ax = plt.subplots(figsize=(12, 10))
    ax.imshow(image, extent=[0, width, height, 0])

    # Draw bounding boxes
    for idx, item in enumerate(docling_doc.texts):
        for prov in item.prov:
            if prov.page_no == page_no + 1 and prov.bbox:
                box = prov.bbox
                x = box.l * zoom
                y = (page.rect.height - box.t) * zoom
                w = (box.r - box.l) * zoom
                h = (box.t - box.b) * zoom

                rect = patches.Rectangle((x, y), w, h, linewidth=2, edgecolor='red', facecolor='none')
                ax.add_patch(rect)
                # ax.text(x, y - 5, str(idx + 1), fontsize=12, color='red', weight='bold')
    for item in docling_doc.pictures:
        if item.prov and item.prov[0].page_no == page_no + 1:
            box = item.prov[0].bbox
 
            # Scale PDF points to pixels
            x = box.l * zoom
            y = (page.rect.height - box.t) * zoom  # Invert Y-axis
            w = (box.r - box.l) * zoom
            h = (box.t - box.b) * zoom
 
            rect = patches.Rectangle(
                (x, y), w, h,
                linewidth=2, edgecolor='red', facecolor='none'
            )
            ax.add_patch(rect)
            # ax.text(x, y - 5, item.self_ref.split("/")[-1], color='red', weight='bold')

    ax.set_xlim(0, width)
    ax.set_ylim(height, 0)
    ax.axis('off')  # Hide axes
    plt.tight_layout()
    
    # Save the annotated image
    annotated_path = ANNOTATED_IMAGES_DIR / f"annotated_page_{page_no}.png"
    plt.savefig(annotated_path, dpi=dpi, bbox_inches='tight', pad_inches=0)
    plt.clf()
    plt.close('all')

# Helper to extract and save per-page images and bounding boxes
def process_pdf(pdf_path: Path):
    # Docling extraction
    # pipeline_options = PdfPipelineOptions(
    #     layout_analysis=True,
    #     images_scale=2.0,
    #     generate_picture_images=True,
    #     layout_analysis_params={
    #         "reading_order_strategy": "column",
    #         "whitespace_threshold": 20,
    #     }
    # )
    # converter = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)})
    converter = DocumentConverter()
    result = converter.convert(pdf_path)
    doc = result.document

    # Save per-page images and bounding boxes
    pdf = fitz.open(str(pdf_path))
    for page_no in range(len(pdf)):
        # Save original page image
        page = pdf[page_no]
        pix = page.get_pixmap(dpi=IMAGE_DPI)
        img_path = PAGE_IMAGES_DIR / f"page_{page_no}.png"
        pix.save(str(img_path))

        # Generate annotated image with bounding boxes
        draw_page_boxes(pdf_path, doc, page_no, IMAGE_DPI)

        # Save bounding boxes for this page
        page_blocks = []
        
        # Extract text blocks
        for item in doc.texts:
            for prov in item.prov:
                if prov.page_no == page_no + 1 and prov.bbox:
                    # More robust check for empty or whitespace-only text
                    if not item.text or not item.text.strip():
                        continue  # Skip empty text blocks
                    
                    bbox = prov.bbox
                    page_blocks.append({
                        "self_ref": item.self_ref,
                        "type": "text",
                        "content": item.text.strip(),
                        "page": prov.page_no,
                        "bbox": {
                            "left": bbox.l,
                            "top": bbox.t,
                            "right": bbox.r,
                            "bottom": bbox.b
                        }
                    })
        
        # Extract picture blocks with actual image data
        for item in doc.pictures:
            # Print the full JSON structure of the picture item to a debug file
            try:
                with open('debug_picture_items.json', 'a', encoding='utf-8') as debug_file:
                    debug_file.write(json.dumps(item.__dict__, default=str, indent=2) + '\n\n')
            except Exception as e:
                print(f'Could not serialize picture item: {e}')
            
            for prov in item.prov:
                if prov.page_no == page_no + 1 and prov.bbox:
                    bbox = prov.bbox
                    
                    # Extract base64 image data from the image field
                    image_data = None
                    try:
                        if hasattr(item, 'image') and hasattr(item.image, 'uri'):
                            uri_str = str(item.image.uri)
                            if uri_str.startswith('data:image'):
                                image_data = uri_str
                                print(f"Found base64 image data: {uri_str[:100]}...")
                    except Exception as e:
                        print(f"Error extracting image data: {e}")
                    
                    picture_block = {
                        "self_ref": item.self_ref,
                        "type": "picture",
                        "bbox": {
                            "left": bbox.l,
                            "top": bbox.t,
                            "right": bbox.r,
                            "bottom": bbox.b
                        },
                        "content": image_data if image_data else "",
                        "metadata": {
                            "mimetype": getattr(item.image, 'mimetype', 'unknown') if hasattr(item, 'image') else 'unknown',
                            "size": {
                                "width": getattr(item.image, 'size', {}).width if hasattr(item, 'image') and hasattr(item.image, 'size') else 0,
                                "height": getattr(item.image, 'size', {}).height if hasattr(item, 'image') and hasattr(item.image, 'size') else 0
                            } if hasattr(item, 'image') else {"width": 0, "height": 0}
                        }
                    }
                    
                    # Add captions if available
                    if hasattr(item, 'captions') and item.captions:
                        picture_block["captions"] = [str(caption) for caption in item.captions]
                    
                    page_blocks.append(picture_block)
        
        # Extract table blocks with markdown conversion
        for item in doc.tables:
            # Debug: print the full table item structure
            print(f"Table item structure: {item}")
            print(f"Table item dir: {dir(item)}")
            if hasattr(item, 'to_markdown'):
                print(f"Table has to_markdown method")
            if hasattr(item, 'df'):
                print(f"Table has df attribute: {item.df}")
            
            for prov in item.prov:
                if prov.page_no == page_no + 1 and prov.bbox:
                    bbox = prov.bbox
                    
                    # Convert table to markdown format
                    table_markdown = ""
                    try:
                        if hasattr(item, 'to_markdown'):
                            table_markdown = item.to_markdown()
                        elif hasattr(item, 'df') and item.df is not None:
                            # If it's a pandas DataFrame, convert to markdown
                            table_markdown = item.df.to_markdown(index=False)
                        else:
                            # Fallback: convert table to simple markdown
                            table_markdown = str(item)
                    except Exception as e:
                        print(f"Error converting table to markdown: {e}")
                        table_markdown = str(item)
                    
                    page_blocks.append({
                        "self_ref": getattr(item, 'self_ref', f'table_{prov.page_no}_{bbox.l}_{bbox.t}'),
                        "type": "table",
                        "content": table_markdown,
                        "page": prov.page_no,
                        "bbox": {
                            "left": bbox.l,
                            "top": bbox.t,
                            "right": bbox.r,
                            "bottom": bbox.b
                        }
                    })
        
        with open(BOXES_DIR / f"boxes_{page_no}.json", "w", encoding="utf-8") as f:
            json.dump(page_blocks, f, indent=2)

    # Save page count
    with open(OUTPUT_DIR / "pages_count.txt", "w") as f:
        f.write(str(len(pdf)))

@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    with open(PDF_PATH, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            buffer.write(chunk)
    try:
        process_pdf(PDF_PATH)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Docling extraction failed: {e}")
    return {"message": "PDF processed and page images/bounding boxes extracted."}

@app.get("/pages_count")
def get_pages_count():
    count_file = OUTPUT_DIR / "pages_count.txt"
    if not count_file.exists():
        raise HTTPException(status_code=404, detail="No PDF processed yet.")
    with open(count_file) as f:
        count = int(f.read().strip())
    return {"pages": count}

@app.get("/page_image/{page_no}")
def get_page_image(page_no: int):
    img_path = PAGE_IMAGES_DIR / f"page_{page_no}.png"
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Page image not found.")
    return FileResponse(str(img_path), media_type="image/png")

@app.get("/annotated_page_image/{page_no}")
def get_annotated_page_image(page_no: int):
    img_path = ANNOTATED_IMAGES_DIR / f"annotated_page_{page_no}.png"
    print(f"Requested annotated image: {img_path}")
    print(f"File exists: {img_path.exists()}")
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Annotated page image not found.")
    return FileResponse(str(img_path), media_type="image/png")

@app.get("/bounding_boxes/{page_no}")
def get_bounding_boxes(page_no: int):
    box_path = BOXES_DIR / f"boxes_{page_no}.json"
    if not box_path.exists():
        raise HTTPException(status_code=404, detail="Bounding boxes not found.")
    with open(box_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return JSONResponse(content=data)

@app.post("/save_order/{page_no}")
async def save_order(page_no: int, order: dict):
    # Save the new order for the page
    order_path = OUTPUT_DIR / f"reading_order_{page_no}.json"
    with open(order_path, "w", encoding="utf-8") as f:
        json.dump(order, f, indent=2)
    return {"message": "Order saved."}

@app.post("/save_all_orders")
async def save_all_orders(order: dict = Body(...)):
    # Save all page orders to a single file
    order_path = OUTPUT_DIR / "all_reading_orders.json"
    with open(order_path, "w", encoding="utf-8") as f:
        json.dump(order, f, indent=2)
    return {"message": "All orders saved."}

@app.post("/export_markdown")
def export_markdown(order: dict = Body(...)):
    # Use Docling to convert the JSON order to markdown
    try:
        from docling.document import Document
        # Convert the JSON order to a Docling Document
        doc = Document.from_json(order)
        markdown = doc.to_markdown()
        return PlainTextResponse(markdown, media_type="text/markdown")
    except Exception as e:
        return PlainTextResponse(f"Error converting to markdown: {e}", status_code=500)

# Path to built React app
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")

# Serve static files from the React build directory
app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "static")), name="static")

# Serve the main index.html for any other route
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    index_path = os.path.join(frontend_path, "index.html")
    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(index_path) 