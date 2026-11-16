"""`python -m sky_inference` — điểm vào của wrapper nix/systemd (`bin/sky-inference`)."""

from __future__ import annotations

import logging

import uvicorn

from .config import load_settings


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    settings = load_settings()  # chèn SKY_ML_SRC vào sys.path TRƯỚC khi nạp app
    uvicorn.run(
        "sky_inference.main:app",
        host=settings.host,
        port=settings.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
