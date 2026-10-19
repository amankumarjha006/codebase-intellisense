import os
from pathlib import Path
import pytest
from eval.run_benchmark import load_dataset, DEFAULT_DATASET_PATH


def test_default_dataset_path_resolves_to_existing_file():
    """Verify that DEFAULT_DATASET_PATH points to an existing dataset file regardless of CWD."""
    assert Path(DEFAULT_DATASET_PATH).exists()
    assert Path(DEFAULT_DATASET_PATH).is_file()
    assert Path(DEFAULT_DATASET_PATH).name == "dataset.jsonl"


def test_load_dataset_with_default_path():
    """Verify that load_dataset loads items successfully from the default path."""
    items = load_dataset(DEFAULT_DATASET_PATH)
    assert isinstance(items, list)
    assert len(items) > 0
    assert "query" in items[0]


def test_load_dataset_relative_fallback(tmp_path, monkeypatch):
    """Verify fallback when running with 'server/eval/dataset.jsonl' from inside the server/ directory."""
    # Simulate CWD being inside server/ directory
    server_dir = Path(__file__).resolve().parent.parent.parent
    monkeypatch.chdir(server_dir)

    # Calling with "server/eval/dataset.jsonl" from inside server/ would normally fail
    # but our resolver falls back to the actual eval/dataset.jsonl
    items = load_dataset("server/eval/dataset.jsonl")
    assert isinstance(items, list)
    assert len(items) > 0


def test_load_dataset_missing_file_exits():
    """Verify that an invalid non-existent path cleanly exits with error."""
    with pytest.raises(SystemExit):
        load_dataset("non_existent_file_12345.jsonl")
