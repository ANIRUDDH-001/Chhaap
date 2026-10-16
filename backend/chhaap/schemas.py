from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class LineSpec(BaseModel):
    product: Literal["cards", "flyers", "banners", "manual"] = "cards"
    description: str = Field(default="", max_length=500)
    quantity: int = Field(default=500, ge=1, le=100000)
    size: str = "standard"
    paper: str | None = None
    sides: Literal["single", "double"] = "double"
    colour: Literal["colour", "mono"] = "colour"
    finish: Literal["matte", "gloss", "none"] = "matte"
    width: Decimal | None = Field(default=None, gt=0, le=100000)
    height: Decimal | None = Field(default=None, gt=0, le=100000)
    unit: Literal["ft", "in", "mm", "cm"] = "ft"
    confirmed: bool = False
    manual_price: int | None = Field(default=None, ge=0, le=100000000)
    manual_reason: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def manual_needs_reason(self):
        if self.manual_price is not None and not self.manual_reason.strip():
            raise ValueError("A manual price requires an owner reason")
        return self


class Adjustments(BaseModel):
    rush: int = Field(default=0, ge=0, le=10000000)
    delivery: int = Field(default=0, ge=0, le=10000000)
    design: int = Field(default=0, ge=0, le=10000000)
    discount: int = Field(default=0, ge=0, le=10000000)
    tax_percent: Decimal = Field(default=Decimal(0), ge=0, le=100)
    deposit_percent: Decimal = Field(default=Decimal(50), ge=0, le=100)
    reason: str = Field(default="", max_length=500)


class PriceComponent(BaseModel):
    label: str
    amount: int
    detail: str = ""


class PricedLine(BaseModel):
    spec: LineSpec
    title: str
    components: list[PriceComponent]
    total: int


class PriceSnapshot(BaseModel):
    currency: str = "INR"
    rate_version: str
    lines: list[PricedLine]
    components: list[PriceComponent]
    subtotal: int
    total: int
    deposit: int
    ready: bool
    warnings: list[str]

