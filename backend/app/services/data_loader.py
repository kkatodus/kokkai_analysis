from pathlib import Path
from typing import Any, Dict, Iterable, List

from fastapi import HTTPException, status
import orjson


class DataLoader:
    """Utility helpers for reading JSON assets from disk.

    The loader is intentionally minimal to keep business logic in routers while
    providing consistent error handling.
    """

    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir

    def _ensure_within_base(self, path: Path) -> Path:
        path = path.resolve()
        if not str(path).startswith(str(self.base_dir.resolve())):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Requested path is outside configured data directory",
            )
        return path

    def load_json(self, path: Path) -> Any:
        path = self._ensure_within_base(path)
        if not path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data not found")
        try:
            return orjson.loads(path.read_bytes())
        except orjson.JSONDecodeError as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    def load_first_json(self, directory: Path) -> Any:
        directory = self._ensure_within_base(directory)
        if not directory.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data directory not found")
        files: List[Path] = sorted(directory.glob("*.json"))
        if not files:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No JSON files found")
        return self.load_json(files[0])

    def list_json_files(self, directory: Path) -> Iterable[Path]:
        directory = self._ensure_within_base(directory)
        if not directory.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data directory not found")
        files = sorted(directory.glob("*.json"))
        if not files:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No JSON files found")
        return files

    def load_json_from_subpath(self, directory: Path, name: str) -> Dict[str, Any]:
        path = directory / f"{name}.json"
        return self.load_json(path)
