import hashlib
import mimetypes
from pathlib import Path
from typing import Protocol

import aiofiles
import aiofiles.os

from app.core.config import settings


class StorageService(Protocol):
    async def save_file(
        self, content: bytes, original_filename: str
    ) -> tuple[str, str, int]:
        """Save file content. Returns (stored_path, sha256_hash, file_size)."""
        ...

    async def get_file(self, file_path: str) -> bytes:
        """Retrieve stored file bytes."""
        ...

    async def delete_file(self, file_path: str) -> bool:
        """Delete stored file."""
        ...


class LocalStorageService:
    def __init__(self, base_dir: Path | None = None) -> None:
        self.base_dir = (base_dir or settings.UPLOAD_DIR).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def calculate_hash(content: bytes) -> str:
        hasher = hashlib.sha256()
        hasher.update(content)
        return hasher.hexdigest()

    async def save_file(
        self, content: bytes, original_filename: str
    ) -> tuple[str, str, int]:
        file_hash = self.calculate_hash(content)
        extension = Path(original_filename).suffix.lower()
        if not extension:
            extension = ".pdf" if content.startswith(b"%PDF") else ".bin"

        disk_filename = f"{file_hash}{extension}"
        target_path = (self.base_dir / disk_filename).resolve()

        async with aiofiles.open(target_path, "wb") as f:
            await f.write(content)

        file_size = len(content)
        return str(target_path), file_hash, file_size

    async def get_file(self, file_path: str) -> bytes:
        p = Path(file_path)
        if not p.is_absolute():
            p = (self.base_dir / p).resolve()

        if not p.exists():
            # Try checking directly within base_dir by filename
            alt_path = (self.base_dir / Path(file_path).name).resolve()
            if alt_path.exists():
                p = alt_path
            else:
                msg = f"Stored file not found: {file_path}"
                raise FileNotFoundError(msg)

        async with aiofiles.open(p, "rb") as f:
            return await f.read()

    async def delete_file(self, file_path: str) -> bool:
        p = Path(file_path)
        if not p.is_absolute():
            p = (self.base_dir / p).resolve()

        if p.exists():
            await aiofiles.os.remove(p)
            return True
        return False

    @staticmethod
    def guess_mime_type(filename: str, content: bytes) -> str:
        if content.startswith(b"%PDF"):
            return "application/pdf"
        if content.startswith(b"\x89PNG"):
            return "image/png"
        if content.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"
        if content.startswith(b"GIF8"):
            return "image/gif"
        if content.startswith(b"RIFF") and b"WEBP" in content[:16]:
            return "image/webp"

        guessed, _ = mimetypes.guess_type(filename)
        return guessed or "application/octet-stream"


storage_service = LocalStorageService()
