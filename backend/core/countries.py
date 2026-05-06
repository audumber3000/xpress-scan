"""
Static country configuration for internationalization.

Each clinic picks a country at signup; this determines currency, timezone, and tax label defaults.
Existing Indian clinics default to 'IN' — no migration needed.
"""

COUNTRIES = {
    "IN": {
        "name": "India",
        "currency_code": "INR",
        "currency_symbol": "₹",
        "timezone": "Asia/Kolkata",
        "tax_label": "GST No.",
        "phone_code": "+91",
    },
    "US": {
        "name": "United States",
        "currency_code": "USD",
        "currency_symbol": "$",
        "timezone": "America/New_York",
        "tax_label": "Tax ID",
        "phone_code": "+1",
    },
    "GB": {
        "name": "United Kingdom",
        "currency_code": "GBP",
        "currency_symbol": "£",
        "timezone": "Europe/London",
        "tax_label": "VAT No.",
        "phone_code": "+44",
    },
    "CA": {
        "name": "Canada",
        "currency_code": "CAD",
        "currency_symbol": "C$",
        "timezone": "America/Toronto",
        "tax_label": "BN",
        "phone_code": "+1",
    },
    "AU": {
        "name": "Australia",
        "currency_code": "AUD",
        "currency_symbol": "A$",
        "timezone": "Australia/Sydney",
        "tax_label": "ABN",
        "phone_code": "+61",
    },
    "AE": {
        "name": "UAE",
        "currency_code": "AED",
        "currency_symbol": "د.إ",
        "timezone": "Asia/Dubai",
        "tax_label": "TRN",
        "phone_code": "+971",
    },
    "SA": {
        "name": "Saudi Arabia",
        "currency_code": "SAR",
        "currency_symbol": "﷼",
        "timezone": "Asia/Riyadh",
        "tax_label": "VAT No.",
        "phone_code": "+966",
    },
    "NG": {
        "name": "Nigeria",
        "currency_code": "NGN",
        "currency_symbol": "₦",
        "timezone": "Africa/Lagos",
        "tax_label": "TIN",
        "phone_code": "+234",
    },
    "KE": {
        "name": "Kenya",
        "currency_code": "KES",
        "currency_symbol": "KSh",
        "timezone": "Africa/Nairobi",
        "tax_label": "PIN",
        "phone_code": "+254",
    },
    "ZA": {
        "name": "South Africa",
        "currency_code": "ZAR",
        "currency_symbol": "R",
        "timezone": "Africa/Johannesburg",
        "tax_label": "VAT No.",
        "phone_code": "+27",
    },
    "DE": {
        "name": "Germany",
        "currency_code": "EUR",
        "currency_symbol": "€",
        "timezone": "Europe/Berlin",
        "tax_label": "USt-IdNr.",
        "phone_code": "+49",
    },
    "FR": {
        "name": "France",
        "currency_code": "EUR",
        "currency_symbol": "€",
        "timezone": "Europe/Paris",
        "tax_label": "N° TVA",
        "phone_code": "+33",
    },
    "BR": {
        "name": "Brazil",
        "currency_code": "BRL",
        "currency_symbol": "R$",
        "timezone": "America/Sao_Paulo",
        "tax_label": "CNPJ",
        "phone_code": "+55",
    },
    "MX": {
        "name": "Mexico",
        "currency_code": "MXN",
        "currency_symbol": "MX$",
        "timezone": "America/Mexico_City",
        "tax_label": "RFC",
        "phone_code": "+52",
    },
    "SG": {
        "name": "Singapore",
        "currency_code": "SGD",
        "currency_symbol": "S$",
        "timezone": "Asia/Singapore",
        "tax_label": "GST Reg. No.",
        "phone_code": "+65",
    },
    "MY": {
        "name": "Malaysia",
        "currency_code": "MYR",
        "currency_symbol": "RM",
        "timezone": "Asia/Kuala_Lumpur",
        "tax_label": "SST No.",
        "phone_code": "+60",
    },
    "PH": {
        "name": "Philippines",
        "currency_code": "PHP",
        "currency_symbol": "₱",
        "timezone": "Asia/Manila",
        "tax_label": "TIN",
        "phone_code": "+63",
    },
    "ID": {
        "name": "Indonesia",
        "currency_code": "IDR",
        "currency_symbol": "Rp",
        "timezone": "Asia/Jakarta",
        "tax_label": "NPWP",
        "phone_code": "+62",
    },
    "TH": {
        "name": "Thailand",
        "currency_code": "THB",
        "currency_symbol": "฿",
        "timezone": "Asia/Bangkok",
        "tax_label": "Tax ID",
        "phone_code": "+66",
    },
    "PK": {
        "name": "Pakistan",
        "currency_code": "PKR",
        "currency_symbol": "₨",
        "timezone": "Asia/Karachi",
        "tax_label": "NTN",
        "phone_code": "+92",
    },
    "BD": {
        "name": "Bangladesh",
        "currency_code": "BDT",
        "currency_symbol": "৳",
        "timezone": "Asia/Dhaka",
        "tax_label": "TIN",
        "phone_code": "+880",
    },
    "LK": {
        "name": "Sri Lanka",
        "currency_code": "LKR",
        "currency_symbol": "Rs",
        "timezone": "Asia/Colombo",
        "tax_label": "TIN",
        "phone_code": "+94",
    },
    "NP": {
        "name": "Nepal",
        "currency_code": "NPR",
        "currency_symbol": "रू",
        "timezone": "Asia/Kathmandu",
        "tax_label": "PAN",
        "phone_code": "+977",
    },
    "EG": {
        "name": "Egypt",
        "currency_code": "EGP",
        "currency_symbol": "E£",
        "timezone": "Africa/Cairo",
        "tax_label": "Tax Reg. No.",
        "phone_code": "+20",
    },
    "GH": {
        "name": "Ghana",
        "currency_code": "GHS",
        "currency_symbol": "GH₵",
        "timezone": "Africa/Accra",
        "tax_label": "TIN",
        "phone_code": "+233",
    },
    "NZ": {
        "name": "New Zealand",
        "currency_code": "NZD",
        "currency_symbol": "NZ$",
        "timezone": "Pacific/Auckland",
        "tax_label": "GST No.",
        "phone_code": "+64",
    },
}


def get_country_config(country_code: str) -> dict:
    """Get config for a country code. Falls back to India if unknown."""
    return COUNTRIES.get(country_code.upper(), COUNTRIES["IN"])


def get_all_countries() -> list:
    """Return list of countries for frontend dropdown."""
    return [
        {"code": code, "name": cfg["name"], "phone_code": cfg["phone_code"],
         "currency_symbol": cfg["currency_symbol"], "currency_code": cfg["currency_code"]}
        for code, cfg in sorted(COUNTRIES.items(), key=lambda x: x[1]["name"])
    ]
