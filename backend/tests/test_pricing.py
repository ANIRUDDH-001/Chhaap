from decimal import Decimal

import pytest


def quote(quantity=500, **overrides):
    from chhaap.pricing import price_quote
    from chhaap.schemas import LineSpec
    from chhaap.catalogue import starter_rates

    data = dict(product="cards", quantity=quantity, paper="350", finish="matte", confirmed=True)
    data.update(overrides)
    return price_quote([LineSpec(**data)], starter_rates())


@pytest.mark.parametrize("quantity,total", [(1,15330),(249,97170),(250,90000),(499,164700),(500,150000),(999,284730),(1000,255000)])
def test_all_units_tiers_and_finishing(quantity, total):
    result = quote(quantity)
    assert result.total == total
    assert result.ready is True


def test_standard_deposit_and_premium_stock():
    assert quote().deposit == 75000
    assert quote(paper="400").total == 180000


def test_unconfirmed_and_missing_paper_cannot_be_issued():
    result = quote(paper=None, confirmed=False)
    assert result.ready is False
    assert any("paper" in w.lower() for w in result.warnings)


def test_area_units_have_the_same_price():
    from chhaap.pricing import price_quote
    from chhaap.schemas import LineSpec
    from chhaap.catalogue import starter_rates
    for width, height, unit in [(2,3,"ft"),(24,36,"in"),(609.6,914.4,"mm")]:
        result=price_quote([LineSpec(product="banners",quantity=2,width=width,height=height,unit=unit,finish="none",confirmed=True)],starter_rates())
        assert result.total == 75000


def test_tax_discount_and_deposit_round_half_up():
    from chhaap.pricing import price_quote
    from chhaap.schemas import LineSpec, Adjustments
    from chhaap.catalogue import starter_rates
    rates=starter_rates();rates["setup"]=0
    result=price_quote([LineSpec(product="manual",quantity=1,manual_price=101,manual_reason="Owner price",confirmed=True)],rates,Adjustments(discount=1,tax_percent=Decimal("18"),deposit_percent=Decimal("50")))
    assert result.total == 118
    assert result.deposit == 59
    result=price_quote([LineSpec(product="manual",quantity=1,manual_price=101,manual_reason="Owner price",confirmed=True)],rates)
    assert result.deposit == 51


@pytest.mark.parametrize("quantity", [0,-1,1.5])
def test_invalid_quantity_rejected(quantity):
    with pytest.raises(ValueError): quote(quantity)


def test_discount_cannot_make_negative_total():
    from chhaap.pricing import price_quote
    from chhaap.schemas import LineSpec, Adjustments
    from chhaap.catalogue import starter_rates
    with pytest.raises(ValueError,match="Discount"):
        price_quote([LineSpec(product="cards",quantity=500,paper="350",confirmed=True)],starter_rates(),Adjustments(discount=999999))


def test_manual_price_requires_reason():
    with pytest.raises(ValueError,match="reason"):
        quote(product="manual", manual_price=1000)


def test_flyer_size_and_minimum_charge():
    from chhaap.pricing import price_quote
    from chhaap.schemas import LineSpec
    from chhaap.catalogue import starter_rates
    result=price_quote([LineSpec(product="flyers",quantity=100,paper="130",size="A5",finish="none",confirmed=True)],starter_rates())
    assert result.total == 55000

