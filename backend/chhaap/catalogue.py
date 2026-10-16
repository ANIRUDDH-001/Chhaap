from copy import deepcopy

_RATES = {
    "version": "1.2", "setup": 15000, "tax_percent": 0, "deposit_percent": 50,
    "cards": {"title": "Visiting cards", "tiers": [[1,300],[250,270],[500,240],[1000,210]], "papers": {"350":0,"400":60}, "minimum": 0},
    "flyers": {"title":"Flyers", "tiers":[[1,400],[250,350],[500,300],[1000,250]],"papers":{"130":0,"170":60},"sizes":{"A4":"2","A5":"1","A6":"0.5"}, "minimum": 10000},
    "banners": {"title":"Banners", "per_sqft":5000,"minimum":15000},
    "finishing": {"matte":30,"gloss":40,"none":0},
    "print_multipliers": {"single":"0.7","double":"1","colour":"1","mono":"0.65"}
}


def starter_rates() -> dict:
    return deepcopy(_RATES)


def catalogue() -> list[dict]:
    return [
        {"id":"cards","name":"Visiting cards","description":"Standard 89 × 51 mm","papers":["350","400"],"sizes":["standard"],"unit":"piece"},
        {"id":"flyers","name":"Flyers","description":"A4, A5 or A6","papers":["130","170"],"sizes":["A4","A5","A6"],"unit":"piece"},
        {"id":"banners","name":"Banners","description":"Flex · price by area","papers":[],"sizes":[],"unit":"sq ft"},
        {"id":"manual","name":"Custom print job","description":"Owner-entered price and reason","papers":[],"sizes":[],"unit":"job"}
    ]

