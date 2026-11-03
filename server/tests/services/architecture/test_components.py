"""Tests for component grouping, determinism, and shuffle-invariance."""

import random
from app.services.architecture.components import group_files_into_components


def test_components_determinism_and_shuffle_invariance():
    """Verify shuffling file input order yields byte-for-byte identical components."""
    base_files = [
        ("server/app/main.py", "python", 100),
        ("server/app/api/v1/endpoints/repos.py", "python", 200),
        ("server/app/api/v1/endpoints/auth.py", "python", 250),
        ("server/app/services/repo.py", "python", 300),
        ("server/app/services/indexing.py", "python", 400),
        ("server/app/models/repo.py", "python", 150),
        ("server/app/models/user.py", "python", 120),
        ("server/app/core/config.py", "python", 80),
        ("client/src/App.tsx", "tsx", 500),
        ("client/src/components/Header.tsx", "tsx", 220),
        ("client/src/components/Sidebar.tsx", "tsx", 180),
        ("client/src/lib/api.ts", "typescript", 350),
        ("client/src/pages/Home.tsx", "tsx", 450),
        ("package.json", "json", 60),
        ("README.md", "markdown", 90),
    ]

    comps1, map1 = group_files_into_components(base_files)

    # Shuffle multiple times and check equality
    for seed in (42, 1337, 9999):
        shuffled = list(base_files)
        random.seed(seed)
        random.shuffle(shuffled)
        comps2, map2 = group_files_into_components(shuffled)

        assert len(comps1) == len(comps2)
        assert map1 == map2
        for c1, c2 in zip(comps1, comps2):
            assert c1.id == c2.id
            assert c1.name == c2.name
            assert c1.path_prefix == c2.path_prefix
            assert c1.file_count == c2.file_count
            assert c1.language_mix == c2.language_mix


def test_components_hard_cap_enforced():
    """Verify component count never exceeds hard cap of 40."""
    # Generate 100 distinct deep directory paths
    deep_files = [
        (f"apps/pkg_{i}/src/module_{j}.py", "python", 100)
        for i in range(50)
        for j in range(2)
    ]
    comps, _ = group_files_into_components(deep_files, hard_cap=40)
    assert len(comps) <= 40


def test_components_empty_files():
    comps, f_map = group_files_into_components([])
    assert comps == []
    assert f_map == {}

