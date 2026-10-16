"""Pure pricing. All persisted amounts are paise; models have no role here."""
from decimal import Decimal, ROUND_HALF_UP

from .schemas import Adjustments, LineSpec, PriceComponent, PricedLine, PriceSnapshot


def rounded(value: Decimal | int) -> int:
    return int(Decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def price_quote(lines: list[LineSpec], rates: dict, adjustments: Adjustments | None = None) -> PriceSnapshot:
    if not 1 <= len(lines) <= 30:
        raise ValueError("A quote needs 1–30 line items")
    adj=adjustments or Adjustments(tax_percent=rates.get("tax_percent",0),deposit_percent=rates.get("deposit_percent",50))
    priced=[]; warnings=[]
    for index, spec in enumerate(lines,1):
        components=[]
        def add(label, amount, detail=""):
            components.append(PriceComponent(label=label,amount=rounded(amount),detail=detail))
        if not spec.confirmed:
            warnings.append(f"Item {index}: review and confirm the specifications")
        if spec.product == "manual":
            if spec.manual_price is None:
                warnings.append(f"Item {index}: enter an owner price and reason")
            add("Owner price",spec.manual_price or 0,spec.manual_reason)
            title=spec.description or "Custom print job"
        elif spec.product == "banners":
            title="Banners"
            if spec.width is None or spec.height is None:
                warnings.append(f"Item {index}: banner dimensions are missing")
                area=Decimal(0)
            else:
                factor={"ft":Decimal(1),"in":Decimal(12),"mm":Decimal("304.8"),"cm":Decimal("30.48")}[spec.unit]
                area=spec.width*spec.height/(factor*factor)*spec.quantity
            add("Flex printing",area*Decimal(rates["banners"]["per_sqft"]),f"{area.quantize(Decimal('0.01'))} sq ft total")
            if components[0].amount<rates["banners"]["minimum"]:
                add("Minimum charge",rates["banners"]["minimum"]-components[0].amount)
        else:
            product=rates[spec.product];title=product["title"]
            tier=max((t for t in product["tiers"] if t[0]<=spec.quantity),key=lambda t:t[0])
            multiplier=Decimal(rates["print_multipliers"][spec.sides])*Decimal(rates["print_multipliers"][spec.colour])
            if spec.product=="cards" and spec.size!="standard":
                warnings.append(f"Item {index}: unsupported card size; use a custom job with an owner price")
            if spec.product=="flyers":
                if spec.size not in product["sizes"]:
                    warnings.append(f"Item {index}: select a supported flyer size")
                multiplier*=Decimal(product["sizes"].get(spec.size,"1"))
            add("Printing",Decimal(tier[1])*spec.quantity*multiplier,f"{spec.quantity:,} pieces × ₹{Decimal(tier[1])/100:.2f} base rate")
            if spec.paper not in product["papers"]:
                warnings.append(f"Item {index}: confirm a supported paper stock")
            else:
                uplift=product["papers"][spec.paper]
                if uplift:add("Paper upgrade",uplift*spec.quantity,f"{spec.paper} GSM")
            finishing=rates["finishing"].get(spec.finish)
            if finishing is None:raise ValueError("Unsupported finishing")
            if finishing:add(spec.finish.title()+" finishing",finishing*spec.quantity)
            line_amount=sum(c.amount for c in components)
            if line_amount<product["minimum"]:add("Minimum charge",product["minimum"]-line_amount)
        priced.append(PricedLine(spec=spec,title=title,components=components,total=sum(c.amount for c in components)))
    subtotal=sum(l.total for l in priced)
    charges=[PriceComponent(label="Setup",amount=int(rates["setup"]))]
    for label,value in [("Rush charge",adj.rush),("Delivery",adj.delivery),("Design",adj.design)]:
        if value:charges.append(PriceComponent(label=label,amount=value))
    before_discount=subtotal+sum(c.amount for c in charges)
    if adj.discount>before_discount:raise ValueError("Discount exceeds the subtotal")
    if adj.discount:charges.append(PriceComponent(label="Discount",amount=-adj.discount))
    taxable=before_discount-adj.discount
    if adj.tax_percent:charges.append(PriceComponent(label=f"Tax ({adj.tax_percent}%)",amount=rounded(Decimal(taxable)*adj.tax_percent/100)))
    total=subtotal+sum(c.amount for c in charges)
    return PriceSnapshot(rate_version=str(rates["version"]),lines=priced,components=charges,subtotal=subtotal,total=total,deposit=rounded(Decimal(total)*adj.deposit_percent/100),ready=not warnings,warnings=warnings)
