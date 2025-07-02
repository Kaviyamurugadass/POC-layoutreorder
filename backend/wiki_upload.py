import os
import json
import requests
from config import Settings

def upload_markdown_to_wikijs(file_path):
    """
    Uploads the given markdown file to Wiki.js using the GraphQL API.
    Returns the created Wiki.js page URL if successful, else None.
    """
    wiki_js_url = Settings.WIKI_JS_URL.rstrip('/')
    wiki_js_api_token = Settings.WIKI_JS_API_TOKEN
    wiki_js_default_path = Settings.WIKI_JS_DEFAULT_PATH.lstrip('/')

    # Extract filename for title and slug
    file_name = os.path.splitext(os.path.basename(file_path))[0]
    page_title = f"{file_name}"
    page_path = f"{wiki_js_default_path}/{file_name.replace(' ', '-').lower()}"

    headers = {
        "Authorization": f"Bearer {wiki_js_api_token}",
        "Content-Type": "application/json",
    }

    # Read markdown content
    with open(file_path, 'r', encoding='utf-8') as f:
        markdown_content = f.read()

    # GraphQL mutation
    query = """
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

    variables = {
        "title": page_title,
        "content": markdown_content,
        "path": page_path,
        "description": f"Auto-generated content from {file_name}",
        "editor": "markdown",
        "locale": "en",
        "isPublished": True,
        "isPrivate": False,
        "tags": ["auto-generated", "gemini-ai"]
    }

    wiki_js_api_endpoint = f"{wiki_js_url}/graphql"

    try:
        wiki_response = requests.post(wiki_js_api_endpoint, json={
            "query": query,
            "variables": variables
        }, headers=headers)
        wiki_response.raise_for_status()

        result = wiki_response.json()
        print("Wiki.js API response:", json.dumps(result, indent=2))
        if "errors" in result:
            print("Error uploading to Wiki.js:", json.dumps(result["errors"], indent=2))
            return None
        else:
            page_data = result.get('data', {}).get('pages', {}).get('create', {})
            if page_data.get('responseResult', {}).get('succeeded'):
                page_path = page_data.get('page', {}).get('path', '')
                full_url = f"{wiki_js_url}/{page_path.lstrip('/')}"
                print(f"\nSuccessfully created Wiki.js page!")
                print(f"Page URL: {full_url}")
                return full_url
            else:
                print("Failed to create page:", json.dumps(page_data.get('responseResult', {}), indent=2))
                return None
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while connecting to Wiki.js: {e}")
        return None 