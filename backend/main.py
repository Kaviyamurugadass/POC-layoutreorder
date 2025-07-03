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
import logging
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption, FormatOption
from docling_core.types.doc import ImageRefMode
from docling.backend.json.docling_json_backend import DoclingJSONBackend
from docling.pipeline.simple_pipeline import SimplePipeline
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from wiki_upload import upload_markdown_to_wikijs

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Your React app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

PDF_PATH = None  # Will be set dynamically after upload
PAGE_IMAGES_DIR = OUTPUT_DIR / "page_images"
ANNOTATED_IMAGES_DIR = OUTPUT_DIR / "annotated_images"
BOXES_DIR = OUTPUT_DIR / "boxes"
PAGE_IMAGES_DIR.mkdir(exist_ok=True)
ANNOTATED_IMAGES_DIR.mkdir(exist_ok=True)
BOXES_DIR.mkdir(exist_ok=True)

_log = logging.getLogger(__name__)
IMAGE_RESOLUTION_SCALE = 2.0

# Global variables to store document processing results
document = None
group_dic = {}
pic_tex = {}
table_tex = {}
diction = {}
state = []
refs = []
positions = []
height_dic = {}
processed_refs = set()
text_state = {}
text_dic = {}
LAST_UPLOADED_PDF_NAME = None

def load_docling_output(pdf_path: Path): #ok
    pipeline_options = PdfPipelineOptions(
        layout_analysis=True,
        images_scale=IMAGE_RESOLUTION_SCALE,
        generate_page_images=True,
        generate_picture_images=True,
        do_ocr=False,
        #ocr_options=RapidOcrOptions()
    )

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )
    
    result = converter.convert(pdf_path)
    return result.document

def process_document_structure(doc):
    global group_dic, pic_tex, table_tex, diction, state, refs, positions, height_dic, processed_refs, text_state, text_dic
    
    # Build group, picture, and table dictionaries
    for i in doc.groups:
        group_dic[i.self_ref] = [j.cref for j in i.children]
    for i in doc.pictures:
        pic_tex[i.self_ref] = [j.cref for j in i.captions]
    for i in doc.tables:
        table_tex[i.self_ref] = [j.cref for j in i.captions]

    # Build the main dictionary following the same logic as the working sample
    diction = {}
    i = 0
    body_children = doc.body.children
    
    for j in body_children:
        refss = j.cref
        
        if "groups" in refss and refss in group_dic:
            gl = group_dic[refss]
            for l in gl:
                if l not in diction:
                    diction[l] = i
                    i += 1
        elif "pictures" in refss and refss in pic_tex:
            if refss not in diction:
                diction[refss] = i
                i += 1
            pl = pic_tex[refss]
            for l in pl:
                if l not in diction:
                    diction[l] = i
                    i += 1
        elif "tables" in refss and refss in table_tex:
            if refss not in diction:
                diction[refss] = i
                i += 1
            tl = table_tex[refss]
            for l in tl:
                if l not in diction:
                    diction[l] = i
                    i += 1
        else:
            if refss not in diction:
                diction[refss] = i
                i += 1

    state = list(diction.keys())
    refs = state.copy()  # Initialize refs with the same order as state
    positions = list(range(len(refs)))

    # Build height dictionary and text state
    height_dic = {}
    processed_refs = set()
    text_state = {}

    for tex in doc.texts:
        if "pictures" in tex.self_ref or "tables" in tex.self_ref:
            continue
        ref = tex.self_ref
        if ref in processed_refs:
            continue
        processed_refs.add(ref)
        if ref not in height_dic:
            height_dic[ref] = round(abs(tex.prov[0].bbox.t - tex.prov[0].bbox.b), 2)
        text_state[ref] = tex.text

    # Initialize text_dic with current text content
    text_dic = {ref: text_state.get(ref, "") for ref in refs}

def draw_page_boxes(pdf_path, page_refs, page_no, dpi=150): #ok
    doc = fitz.open(pdf_path)
    page = doc[page_no]
    pix = page.get_pixmap(dpi=dpi)
    width, height = pix.width, pix.height
    img_bytes = pix.tobytes("ppm")
    image = Image.open(io.BytesIO(img_bytes))
    zoom = dpi / 72
    fig, ax = plt.subplots(figsize=(12, 10))
    ax.imshow(image, extent=[0, width, height, 0])

    def draw_items_with_position(items, item_type="text"):
        for ref in page_refs:
            item = next((t for t in items if t.self_ref == ref), None)
            if item:
                for prov in item.prov:
                    if prov.page_no == page_no + 1:
                        box = prov.bbox
                        x = box.l * zoom
                        y = (page.rect.height - box.t) * zoom
                        w = (box.r - box.l) * zoom
                        h = (box.t - box.b) * zoom
                        rect = patches.Rectangle((x, y), w, h, linewidth=1,
                                                 edgecolor="#000000", facecolor='#A2CFFE', alpha=0.3)
                        ax.add_patch(rect)
                        try:
                            pos = refs.index(ref)  # Use global refs for position
                            # ax.text(x, y - 5, str(pos), fontsize=8, color='red', ha='left', va='bottom')
                        except ValueError:
                            pass
    
    if document:
        draw_items_with_position(document.texts, "text")
        draw_items_with_position(document.pictures, "picture")
        draw_items_with_position(document.tables, "table")

    ax.set_xlim(0, width)
    ax.set_ylim(height, 0)
    ax.axis('off')
    plt.tight_layout()
    
    annotated_path = ANNOTATED_IMAGES_DIR / f"annotated_page_{page_no}.png"
    plt.savefig(annotated_path, dpi=dpi, bbox_inches='tight', pad_inches=0)
    plt.clf()
    plt.close('all')

def pdf_to_json(pdf_path: Path, document): #ok
    json_dic = document.export_to_dict()
    json_out_path = OUTPUT_DIR / f"{pdf_path.stem}.json"
    with open(json_out_path, "w", encoding="utf-8") as f:
        json.dump(json_dic, f, indent=2, ensure_ascii=False)
    return json_out_path

def json_loader(output_path):
    json_format_option = FormatOption(
        pipeline_cls=SimplePipeline,
        backend=DoclingJSONBackend
    )
    converter = DocumentConverter(
        allowed_formats=[InputFormat.JSON_DOCLING],
        format_options={
            InputFormat.JSON_DOCLING: json_format_option
        }
    )
    converter.initialize_pipeline(InputFormat.JSON_DOCLING)
    result1 = converter.convert(output_path)
    doc = result1.document
    doc_filename = f"jso2_{output_path.stem}"
    out_path = OUTPUT_DIR / f"{doc_filename}-with-image-dummy-refs.md"
    doc.save_as_markdown(out_path, image_mode=ImageRefMode.EMBEDDED)
    return out_path

def read_markdown_file(file_path):
    with open(file_path, "r", encoding="utf-8") as file:
        return file.read()

def generate_and_modify_json(source_pdf_path: Path, doc):
    global refs, text_dic, group_dic, pic_tex, table_tex
    
    # Create a copy of refs to work with
    final_refs = refs.copy()
    
    # Remove group children, picture captions, and table captions from refs
    # following the same logic as the working sample
    group_lis = []
    for i in group_dic.values():
        for j in i:
            group_lis.append(j)
    
    for i in group_lis:
        if i in final_refs:
            final_refs.remove(i)
    
    pic_text_lis = []
    for i in pic_tex.values():
        for j in i:
            pic_text_lis.append(j)
    
    for i in pic_text_lis:
        if i in final_refs:
            final_refs.remove(i)
    
    table_text_lis = []
    for i in table_tex.values():
        for j in i:
            table_text_lis.append(j)
    
    for i in table_text_lis:
        if i in final_refs:
            final_refs.remove(i)
    
    # Create children array with the cleaned refs
    children = [{"$ref": r} for r in final_refs]
    
    # Generate JSON from document
    output_path_json = pdf_to_json(source_pdf_path, doc)

    # Load and modify the JSON
    with open(output_path_json, "r", encoding="utf-8") as f:
        x = json.load(f)

    # Update body children with new order
    x["body"]["children"] = children
    
    # Update text content with edited texts
    for i in x.get("texts", []):
        if i.get("self_ref") in text_dic:
            i["text"] = text_dic[i["self_ref"]]

    # Save the modified JSON
    with open(output_path_json, "w", encoding="utf-8") as f:
        json.dump(x, f, indent=4)
        
    return output_path_json

def process_pdf(pdf_path: Path):
    global document
    
    document = load_docling_output(pdf_path)
    process_document_structure(document)
    
    pdf = fitz.open(str(pdf_path))
    for page_no in range(len(pdf)):
        page = pdf[page_no]
        pix = page.get_pixmap(dpi=150)
        img_path = PAGE_IMAGES_DIR / f"page_{page_no}.png"
        pix.save(str(img_path))

        page_refs = [
            item.self_ref
            for item in document.texts + document.pictures + document.tables
            if item.prov and item.prov[0].page_no == page_no + 1
        ]
        
        draw_page_boxes(pdf_path, page_refs, page_no, 150)

        page_blocks = []
        
        for item_type in [document.texts, document.pictures, document.tables]:
            for item in item_type:
                for prov in item.prov:
                    if prov.page_no == page_no + 1 and prov.bbox:
                        if hasattr(item, 'text') and (not item.text or not item.text.strip()):
                            continue
                        
                        block = {
                            "self_ref": item.self_ref,
                            "page": prov.page_no,
                            "bbox": {
                                "left": prov.bbox.l, "top": prov.bbox.t,
                                "right": prov.bbox.r, "bottom": prov.bbox.b
                            }
                        }

                        if hasattr(item, 'text'):
                            block["type"] = "text"
                            block["content"] = item.text.strip()
                        elif hasattr(item, 'image'):
                            block["type"] = "picture"
                            image_data = None
                            if hasattr(item.image, 'uri') and str(item.image.uri).startswith('data:image'):
                                image_data = str(item.image.uri)
                            block["content"] = image_data or ""
                        elif hasattr(item, 'to_markdown'):
                            block["type"] = "table"
                            block["content"] = item.to_markdown()
                        
                        page_blocks.append(block)
        
        with open(BOXES_DIR / f"boxes_{page_no}.json", "w", encoding="utf-8") as f:
            json.dump(page_blocks, f, indent=2)

    with open(OUTPUT_DIR / "pages_count.txt", "w") as f:
        f.write(str(len(pdf)))

def save_complete_edited_json_and_markdown():
    """Save complete edited JSON including all groups, text, tables and generate markdown"""
    global document, refs, text_dic, group_dic, pic_tex, table_tex
    
    if not document:
        raise HTTPException(status_code=400, detail="No document processed. Please upload a PDF first.")
    
    try:
        # Step 1: Generate initial JSON from document
        output_path_json = pdf_to_json(PDF_PATH, document)
        
        # Step 2: Load the JSON
        with open(output_path_json, "r", encoding="utf-8") as f:
            x = json.load(f)
        
        # Step 3: Process reading order (same logic as Streamlit)
        final_refs = refs.copy()
        
        # Remove group children, picture captions, and table captions
        group_lis = []
        for i in group_dic.values():
            for j in i:
                group_lis.append(j)
        
        for i in group_lis:
            if i in final_refs:
                final_refs.remove(i)
        
        pic_text_lis = []
        for i in pic_tex.values():
            for j in i:
                pic_text_lis.append(j)
        
        for i in pic_text_lis:
            if i in final_refs:
                final_refs.remove(i)
        
        table_text_lis = []
        for i in table_tex.values():
            for j in i:
                table_text_lis.append(j)
        
        for i in table_text_lis:
            if i in final_refs:
                final_refs.remove(i)
        
        # Step 4: Create children array with cleaned refs
        children = [{"$ref": r} for r in final_refs]
        
        # Step 5: Update body children with new order
        x["body"]["children"] = children
        
        # Step 6: Update text content with edited texts
        for i in x.get("texts", []):
            if i.get("self_ref") in text_dic:
                i["text"] = text_dic[i["self_ref"]]
        
        # Step 7: Save the complete modified JSON
        complete_json_path = OUTPUT_DIR / f"{PDF_PATH.stem}_complete_edited.json"
        with open(complete_json_path, "w", encoding="utf-8") as f:
            json.dump(x, f, indent=4)
        
        # Step 8: Generate markdown from the complete edited JSON
        markdown_path = json_loader(complete_json_path)
        markdown_content = read_markdown_file(markdown_path)
        
        # Step 9: Save markdown to file
        markdown_file_path = OUTPUT_DIR / f"{PDF_PATH.stem}_complete_edited.md"
        with open(markdown_file_path, "w", encoding="utf-8") as f:
            f.write(markdown_content)
        
        return {
            "json_path": str(complete_json_path),
            "markdown_path": str(markdown_file_path),
            "message": "Complete edited JSON and markdown saved successfully"
        }
        
    except Exception as e:
        _log.exception("Error saving complete edited JSON and markdown")
        raise HTTPException(status_code=500, detail=f"Error saving complete edited JSON and markdown: {e}")

def clear_output_dir():
    for item in OUTPUT_DIR.iterdir():
        # Always clear these subfolders and all files
        if item.is_dir() and item.name in ["page_images", "annotated_images", "boxes"]:
            shutil.rmtree(item)
            item.mkdir(exist_ok=True)
        elif item.is_file():
            item.unlink()
        elif item.is_dir():
            shutil.rmtree(item)

@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    global LAST_UPLOADED_PDF_NAME, PDF_PATH
    clear_output_dir()  # Clear output and subfolders before saving new file
    pdf_filename = Path(file.filename).name
    PDF_PATH = OUTPUT_DIR / pdf_filename
    with open(PDF_PATH, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    LAST_UPLOADED_PDF_NAME = Path(file.filename).stem
    try:
        process_pdf(PDF_PATH)
    except Exception as e:
        _log.exception("Docling extraction failed")
        raise HTTPException(status_code=500, detail=f"Docling extraction failed: {e}")
    return {"message": "PDF processed successfully."}

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

@app.post("/save_all_orders")
async def save_all_orders(order_data: dict = Body(...)):
    global refs, text_dic
    
    # Update the reading order
    if "order" in order_data and isinstance(order_data["order"], list):
        refs = order_data["order"]
    
    # Update text content
    if "texts" in order_data and isinstance(order_data["texts"], dict):
        for self_ref, text_content in order_data["texts"].items():
            text_dic[self_ref] = text_content

    # Save to file for persistence
    order_path = OUTPUT_DIR / "all_reading_orders.json"
    with open(order_path, "w", encoding="utf-8") as f:
        json.dump({"refs": refs, "texts": text_dic}, f, indent=2)
        
    return {"message": "All orders and text changes saved."}

@app.post("/export_markdown")
def export_markdown():
    global document
    if not document:
        raise HTTPException(status_code=400, detail="No document processed. Please upload a PDF first.")
    try:
        modified_json_path = generate_and_modify_json(PDF_PATH, document)
        markdown_path = json_loader(modified_json_path)
        markdown_content = read_markdown_file(markdown_path)
        return PlainTextResponse(
            markdown_content, 
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=export.md"}
        )
    except Exception as e:
        _log.exception("Error exporting markdown")
        raise HTTPException(status_code=500, detail=f"Error exporting to markdown: {e}")

@app.get("/export_json")
def export_json():
    global document
    if not document:
        raise HTTPException(status_code=400, detail="No document processed. Please upload a PDF first.")
    try:
        modified_json_path = generate_and_modify_json(PDF_PATH, document)
        return FileResponse(
            modified_json_path,
            media_type="application/json",
            filename=f"{PDF_PATH.stem}_modified.json"
        )
    except Exception as e:
        _log.exception("Error exporting json")
        raise HTTPException(status_code=500, detail=f"Error exporting to JSON: {e}")

@app.post("/save_complete_json_and_markdown")
async def save_complete_json_and_markdown_endpoint():
    """Save complete edited JSON including all groups, text, tables and generate markdown"""
    return save_complete_edited_json_and_markdown()

@app.get("/download_complete_edited_json")
def download_complete_edited_json():
    """Download the complete edited JSON file"""
    global document
    if not document:
        raise HTTPException(status_code=400, detail="No document processed. Please upload a PDF first.")
    
    try:
        # Check if the complete edited JSON already exists
        complete_json_path = OUTPUT_DIR / f"{PDF_PATH.stem}_complete_edited.json"
        
        if not complete_json_path.exists():
            # Generate the complete edited JSON if it doesn't exist
            result = save_complete_edited_json_and_markdown()
            json_path = Path(result["json_path"])
        else:
            json_path = complete_json_path
        
        return FileResponse(
            json_path,
            media_type="application/json",
            filename=f"{PDF_PATH.stem}_complete_edited.json"
        )
    except Exception as e:
        _log.exception("Error downloading complete edited JSON")
        raise HTTPException(status_code=500, detail=f"Error downloading complete edited JSON: {e}")

@app.get("/download_complete_edited_markdown")
def download_complete_edited_markdown():
    """Download the complete edited markdown file"""
    global document
    if not document:
        raise HTTPException(status_code=400, detail="No document processed. Please upload a PDF first.")
    
    try:
        # Generate the complete edited JSON and markdown
        result = save_complete_edited_json_and_markdown()
        markdown_path = Path(result["markdown_path"])
        
        return FileResponse(
            markdown_path,
            media_type="text/markdown",
            filename=f"{PDF_PATH.stem}_complete_edited.md"
        )
    except Exception as e:
        _log.exception("Error downloading complete edited markdown")
        raise HTTPException(status_code=500, detail=f"Error downloading complete edited markdown: {e}")


def process_local_pdf(pdf_path: str):
    """Process a local PDF file (similar to Streamlit approach)"""
    global document
    
    pdf_path_obj = Path(pdf_path)
    if not pdf_path_obj.exists():
        raise HTTPException(status_code=404, detail=f"PDF file not found: {pdf_path}")
    
    try:
        # Process the PDF
        process_pdf(pdf_path_obj)
        return {"message": f"Local PDF processed successfully: {pdf_path}"}
    except Exception as e:
        _log.exception("Local PDF processing failed")
        raise HTTPException(status_code=500, detail=f"Local PDF processing failed: {e}")

@app.post("/process_local_pdf")
async def process_local_pdf_endpoint(pdf_data: dict = Body(...)):
    """Process a local PDF file"""
    if "pdf_path" not in pdf_data:
        raise HTTPException(status_code=400, detail="pdf_path is required")
    
    pdf_path = pdf_data["pdf_path"]
    return process_local_pdf(pdf_path)

@app.post("/upload_to_wiki")
def upload_to_wiki():
    """
    Upload the latest generated markdown to Wiki.js and return the page URL.
    """
    global LAST_UPLOADED_PDF_NAME
    if not LAST_UPLOADED_PDF_NAME:
        return JSONResponse({"error": "No PDF uploaded yet."}, status_code=404)
    markdown_path = OUTPUT_DIR / f"{LAST_UPLOADED_PDF_NAME}_complete_edited.md"
    if not markdown_path.exists():
        return JSONResponse({"error": "Markdown file not found. Please export markdown first."}, status_code=404)
    # Call the upload function and capture the URL
    try:
        # Patch: capture the URL from the upload function
        # We'll modify upload_markdown_to_wikijs to return the URL
        wiki_url = upload_markdown_to_wikijs(str(markdown_path))
        if wiki_url:
            return {"wiki_url": wiki_url}
        else:
            return JSONResponse({"error": "Wiki.js upload failed."}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)