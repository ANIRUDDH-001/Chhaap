from io import BytesIO
from pathlib import Path
from uuid import uuid4
import warnings

from fastapi import HTTPException
from PIL import Image,ImageOps,UnidentifiedImageError

from .settings import settings

MAX_BYTES=10*1024*1024
Image.MAX_IMAGE_PIXELS=25_000_000


def store_image(shop_id,data:bytes):
    if len(data)>MAX_BYTES:raise HTTPException(413,"Each screenshot must be 10 MB or smaller")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error",Image.DecompressionBombWarning)
            image=Image.open(BytesIO(data))
            if image.format not in {"JPEG","PNG","WEBP"}:raise ValueError("Unsupported image")
            image.load();image=ImageOps.exif_transpose(image).convert('RGB')
            image.thumbnail((2400,3600))
    except (UnidentifiedImageError,OSError,ValueError,Image.DecompressionBombError,Image.DecompressionBombWarning):
        raise HTTPException(422,"This screenshot could not be read. Use a JPEG, PNG, or WebP image.")
    key=f"{shop_id}/{uuid4()}.webp";path=settings.data_dir/key
    path.parent.mkdir(parents=True,exist_ok=True);image.save(path,'WEBP',quality=90)
    return key


def media_path(key:str)->Path:
    root=settings.data_dir.resolve();path=(root/key).resolve()
    if not path.is_relative_to(root) or not path.is_file():raise HTTPException(404,"Screenshot is no longer available")
    return path
