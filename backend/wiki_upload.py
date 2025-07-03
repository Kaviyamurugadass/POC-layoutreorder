import os
import json
import requests
from config import Settings
import re

def sanitize_wikijs_path(name):
    # Replace spaces and dots with dashes, remove illegal characters
    name = name.replace(' ', '-').replace('.', '-')
    # Remove any character that is not alphanumeric, dash, or underscore
    name = re.sub(r'[^a-zA-Z0-9-_]', '', name)
    return name.lower()

def upload_markdown_to_wikijs(file_path):
    print(f"Uploading markdown to Wiki.js: {file_path}")
    """
    Uploads the given markdown file to Wiki.js using the GraphQL API.
    Returns the created Wiki.js page URL if successful, else None.
    """
    wiki_js_url = Settings.WIKI_JS_URL.rstrip('/')
    wiki_js_api_token = Settings.WIKI_JS_API_TOKEN
    wiki_js_default_path = Settings.WIKI_JS_DEFAULT_PATH.lstrip('/')

    # Extract filename for title and slug
    file_name = os.path.splitext(os.path.basename(file_path))[0]
    safe_file_name = sanitize_wikijs_path(file_name)
    page_title = f"{safe_file_name}"
    page_path = f"{wiki_js_default_path}/{safe_file_name}"

    headers = {
        "Authorization": f"Bearer {wiki_js_api_token}",
        "Content-Type": "application/json",
    }

    # Read markdown content
    with open(file_path, 'r', encoding='utf-8') as f:
        markdown_content = f.read()

    # First, try to get the existing page ID
    get_page_query = """
    query($path: String!) {
        pages {
            single(path: $path) {
                id
                path
                title
            }
        }
    }
    """

    # Try to create the page first
    create_query = """
    mutation(
        $title: String!,
        $content: String!,
        $path: String!,
        $description: String!,
        $editor: String!,
        $locale: String!,
        $isPublished: Boolean!,
        $isPrivate: Boolean!,
        $tags: [String]!
    ) {
        pages {
            create(
                title: $title
                content: $content
                path: $path
                description: $description
                editor: $editor
                locale: $locale
                isPublished: $isPublished
                isPrivate: $isPrivate
                tags: $tags
            ) {
                responseResult {
                    succeeded
                    slug
                    message
                }
                page {
                    id
                    path
                }
            }
        }
    }
    """

    # Update query for existing pages
    update_query = """
    mutation(
        $id: Int!,
        $title: String!,
        $content: String!,
        $description: String!,
        $editor: String!,
        $locale: String!,
        $isPublished: Boolean!,
        $isPrivate: Boolean!,
        $tags: [String]!
    ) {
        pages {
            update(
                id: $id
                title: $title
                content: $content
                description: $description
                editor: $editor
                locale: $locale
                isPublished: $isPublished
                isPrivate: $isPrivate
                tags: $tags
            ) {
                responseResult {
                    succeeded
                    slug
                    message
                }
                page {
                    id
                    path
                }
            }
        }
    }
    """

    variables = {
        "title": page_title,
        "content": markdown_content,
        "path": page_path,
        "description": f"Auto-generated content from {safe_file_name}",
        "editor": "markdown",
        "locale": "en",
        "isPublished": True,
        "isPrivate": False,
        "tags": ["auto-generated", "gemini-ai"]
    }

    wiki_js_api_endpoint = f"{wiki_js_url}/graphql"

    try:
        # First try to create the page
        wiki_response = requests.post(wiki_js_api_endpoint, json={
            "query": create_query,
            "variables": variables
        }, headers=headers)
        wiki_response.raise_for_status()

        result = wiki_response.json()
        print("Wiki.js API response:", json.dumps(result, indent=2))
        
        if "errors" in result:
            print("Error uploading to Wiki.js:", json.dumps(result["errors"], indent=2))
            return None
        
        page_data = result.get('data', {}).get('pages', {}).get('create', {})
        response_result = page_data.get('responseResult', {})
        
        if response_result.get('succeeded'):
            # Page created successfully
            page_path = page_data.get('page', {}).get('path', '')
            full_url = f"{wiki_js_url}/{page_path.lstrip('/')}"
            print(f"\nSuccessfully created Wiki.js page!")
            print(f"Page URL: {full_url}")
            return full_url
        elif response_result.get('slug') == 'PageDuplicateCreate':
            # Page already exists, try to update it
            print("Page already exists, attempting to update...")
            
            # Get the existing page ID
            get_response = requests.post(wiki_js_api_endpoint, json={
                "query": get_page_query,
                "variables": {"path": page_path}
            }, headers=headers)
            get_response.raise_for_status()
            
            get_result = get_response.json()
            if "errors" in get_result:
                print("Error getting existing page:", json.dumps(get_result["errors"], indent=2))
                return None
            
            existing_page = get_result.get('data', {}).get('pages', {}).get('single')
            if not existing_page:
                print("Could not find existing page to update")
                return None
            
            page_id = existing_page.get('id')
            print(f"Fetched page_id: {page_id} (type: {type(page_id)})")
            if not page_id:
                print("Could not get page ID for update")
                return None
            # Ensure page_id is an integer
            try:
                page_id = int(page_id)
            except Exception as e:
                print(f"Error converting page_id to int: {e}")
                return None
            
            # Update the existing page
            update_variables = {
                "id": page_id,
                "title": page_title,
                "content": markdown_content,
                "description": f"Auto-generated content from {safe_file_name}",
                "editor": "markdown",
                "locale": "en",
                "isPublished": True,
                "isPrivate": False,
                "tags": ["auto-generated", "gemini-ai"]
            }
            
            update_response = requests.post(wiki_js_api_endpoint, json={
                "query": update_query,
                "variables": update_variables
            }, headers=headers)
            update_response.raise_for_status()
            
            update_result = update_response.json()
            print("Update response:", json.dumps(update_result, indent=2))
            
            if "errors" in update_result:
                print("Error updating page:", json.dumps(update_result["errors"], indent=2))
                return None
            
            update_page_data = update_result.get('data', {}).get('pages', {}).get('update', {})
            if update_page_data.get('responseResult', {}).get('succeeded'):
                page_path = update_page_data.get('page', {}).get('path', '')
                full_url = f"{wiki_js_url}/{page_path.lstrip('/')}"
                print(f"\nSuccessfully updated Wiki.js page!")
                print(f"Page URL: {full_url}")
                return full_url
            else:
                print("Failed to update page:", json.dumps(update_page_data.get('responseResult', {}), indent=2))
                return None
        else:
            print("Failed to create page:", json.dumps(response_result, indent=2))
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while connecting to Wiki.js: {e}")
        return None 