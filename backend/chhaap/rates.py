"""Validate the entire published card, including components absent from a preview."""

import json
from decimal import Decimal, InvalidOperation

from .catalogue import starter_rates


def validate_rates(config: dict) -> None:
    if len(json.dumps(config)) > 20000:
        raise ValueError("Rate card is too large")

    def number(value, name, maximum=10000000, integer=False, positive=False):
        try:
            n = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError("Invalid " + name) from None
        if not n.is_finite() or n < 0 or n > maximum or (positive and n == 0):
            raise ValueError("Invalid " + name)
        if integer and (type(value) is not int):
            raise ValueError(name + " must be an integer amount in paise")

    number(config["setup"], "setup", integer=True)
    for key in ["tax_percent", "deposit_percent"]:
        number(config[key], key, 100)
    baseline = starter_rates()
    for family in ["cards", "flyers"]:
        card = config[family]
        if not isinstance(card["title"], str) or not 1 <= len(card["title"]) <= 100:
            raise ValueError("Invalid product title")
        tiers = card["tiers"]
        if not isinstance(tiers, list) or not 1 <= len(tiers) <= 20:
            raise ValueError("Use 1–20 quantity tiers")
        last = 0
        for tier in tiers:
            if not isinstance(tier, list) or len(tier) != 2:
                raise ValueError("Each tier needs quantity and price")
            number(tier[0], "tier quantity", 100000, integer=True, positive=True)
            number(tier[1], "tier price", integer=True)
            if tier[0] <= last:
                raise ValueError("Quantity tiers must increase without duplicates")
            last = tier[0]
        if tiers[0][0] != 1:
            raise ValueError("The first quantity tier must start at one")
        number(card["minimum"], "minimum charge", integer=True)
        if set(card["papers"]) != set(baseline[family]["papers"]):
            raise ValueError("Keep the supported paper stocks")
        for amount in card["papers"].values():
            number(amount, "paper uplift", integer=True)
    for family, keys in [("finishing", ["matte", "gloss", "none"]), ("banners", ["per_sqft", "minimum"])]:
        for key in keys:
            number(config[family][key], family + " " + key, integer=True)
    for family, values in [
        ("print_multipliers", baseline["print_multipliers"]),
        ("sizes", baseline["flyers"]["sizes"]),
    ]:
        target = config["flyers"]["sizes"] if family == "sizes" else config[family]
        if set(target) != set(values):
            raise ValueError("Keep the supported " + family)
        for key in values:
            number(target[key], family + " " + key, 100, positive=True)
