import json
import os
import sys
from uuid import UUID

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server")))

from app.core.db import SessionLocal
from app.models.knowledge import CodeChunk, File

VERSION_ID = UUID("c2f91ec9-f037-4fab-83aa-36157ef073ee")

def extract_snippet(db, file_path, start_line, end_line):
    f = db.query(File).filter(File.repository_version_id == VERSION_ID, File.file_path == file_path).first()
    if not f:
        print(f"File not found: {file_path}")
        return ""
    
    chunks = db.query(CodeChunk).filter(CodeChunk.file_id == f.id).order_by(CodeChunk.start_line.asc()).all()
    # Find overlapping chunks
    matching_chunks = [c for c in chunks if not (c.end_line < start_line or c.start_line > end_line)]
    if not matching_chunks:
        print(f"No chunk matching lines {start_line}-{end_line} in {file_path}")
        return ""
    
    # Return chunk content of primary chunk
    return matching_chunks[0].content

def main():
    db = SessionLocal()
    snippets = {
        "openapi_utils_258_378": {
            "filePath": "fastapi/openapi/utils.py",
            "startLine": 258,
            "endLine": 378,
            "code": extract_snippet(db, "fastapi/openapi/utils.py", 258, 378)
        },
        "params_142_232": {
            "filePath": "fastapi/params.py",
            "startLine": 142,
            "endLine": 232,
            "code": extract_snippet(db, "fastapi/params.py", 142, 232)
        },
        "params_232_320": {
            "filePath": "fastapi/params.py",
            "startLine": 232,
            "endLine": 320,
            "code": extract_snippet(db, "fastapi/params.py", 232, 320)
        },
        "applications_1688_2019": {
            "filePath": "fastapi/applications.py",
            "startLine": 1688,
            "endLine": 1780,
            "code": extract_snippet(db, "fastapi/applications.py", 1688, 1780)
        }
    }
    
    out_path = os.path.join(os.path.dirname(__file__), "raw_snippets.json")
    with open(out_path, "w", encoding="utf-8") as out_f:
        json.dump(snippets, out_f, indent=2)
    
    print(f"Wrote snippets to {out_path}")
    db.close()

if __name__ == "__main__":
    main()

