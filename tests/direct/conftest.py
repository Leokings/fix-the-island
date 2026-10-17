"""Test-only Windows stdin shim; does not install/modify tooling or run GenVM."""
import os
import importlib.util
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def windows_direct_stdin(monkeypatch):
    if os.name != 'nt':
        return
    from gltest.direct import loader
    # gltest 0.29.2 unlinks its temporary file while fd 0 is still open.
    # Windows refuses that unlink. This scoped patch uses identical calldata.
    path = Path(__file__).resolve().parents[2] / 'tools/genlayer-windows-direct.py'
    spec = importlib.util.spec_from_file_location('island_windows_direct', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(loader, '_inject_message_to_fd0', module.inject_message)
