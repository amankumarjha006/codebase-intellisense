import os
import sys
import subprocess
from uuid import UUID

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server")))

from app.core.db import SessionLocal
from app.core.config import settings
from app.models.knowledge import CodeChunk, File
from app.services.embedding.factory import get_embedding_provider

def measure_rss():
    out = subprocess.check_output(['powershell', '-Command', f'(Get-Process -Id {os.getpid()}).PeakWorkingSet64'])
    return int(out.strip()) / (1024 * 1024)

def main():
    print(f"Starting FastEmbed RSS Benchmark (PID: {os.getpid()})...")
    rss_start = measure_rss()
    print(f"Initial RSS: {rss_start:.2f} MB")
    
    db = SessionLocal()
    version_id = UUID("c2f91ec9-f037-4fab-83aa-36157ef073ee")
    chunks = db.query(CodeChunk.content).join(File).filter(File.repository_version_id == version_id).limit(100).all()
    texts = [c[0] for c in chunks if c[0]]
    db.close()
    
    print(f"Loaded {len(texts)} sample chunks from fastapi/fastapi.")
    rss_after_load = measure_rss()
    print(f"RSS after loading texts: {rss_after_load:.2f} MB")
    
    provider = get_embedding_provider(settings)
    rss_after_init = measure_rss()
    print(f"RSS after FastEmbed initialization: {rss_after_init:.2f} MB")
    
    print("Generating embeddings for batch...")
    vectors = provider.embed(texts[:32])
    rss_peak = measure_rss()
    print(f"Generated {len(vectors)} vectors (dim: {len(vectors[0])}).")
    print(f"PEAK RSS: {rss_peak:.2f} MB")
    print(f"Provider details: is_gpu={getattr(provider, 'is_gpu', False)}, providers={getattr(provider, 'providers', None)}")

if __name__ == "__main__":
    main()
