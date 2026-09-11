"""
Static country configuration for internationalisation.

Copied from MolarPlus core/countries.py — the full 160+ country registry.
Each lab picks a country at signup; this determines currency, timezone, and
tax-label defaults.
"""

# Countries whose tax registration is labelled differently from the "Tax ID" default.
_VAT = {
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
    "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES",
    "SE", "GB", "NO", "CH", "UA", "RU", "AL", "RS", "IS",
}
_GST = {"IN", "AU", "NZ", "SG", "MY"}
_GCC = {"AE", "SA", "BH", "KW", "OM", "QA"}


def _tax_label(code: str) -> str:
    if code in _GST:
        return "GST No."
    if code in _GCC:
        return "TRN"
    if code in _VAT:
        return "VAT No."
    return "Tax ID"


# (code, name, currency_code, currency_symbol, phone_code, timezone)
_DATA = [
    # ── South Asia ──
    ("IN", "India", "INR", "₹", "+91", "Asia/Kolkata"),
    ("PK", "Pakistan", "PKR", "₨", "+92", "Asia/Karachi"),
    ("BD", "Bangladesh", "BDT", "৳", "+880", "Asia/Dhaka"),
    ("LK", "Sri Lanka", "LKR", "Rs", "+94", "Asia/Colombo"),
    ("NP", "Nepal", "NPR", "रू", "+977", "Asia/Kathmandu"),
    ("BT", "Bhutan", "BTN", "Nu.", "+975", "Asia/Thimphu"),
    ("MV", "Maldives", "MVR", "Rf", "+960", "Indian/Maldives"),
    ("AF", "Afghanistan", "AFN", "؋", "+93", "Asia/Kabul"),

    # ── North America ──
    ("US", "United States", "USD", "$", "+1", "America/New_York"),
    ("CA", "Canada", "CAD", "C$", "+1", "America/Toronto"),
    ("MX", "Mexico", "MXN", "$", "+52", "America/Mexico_City"),

    # ── Central America & Caribbean ──
    ("BS", "Bahamas", "BSD", "$", "+1242", "America/Nassau"),
    ("BB", "Barbados", "BBD", "$", "+1246", "America/Barbados"),
    ("BZ", "Belize", "BZD", "$", "+501", "America/Belize"),
    ("CR", "Costa Rica", "CRC", "₡", "+506", "America/Costa_Rica"),
    ("CU", "Cuba", "CUP", "$", "+53", "America/Havana"),
    ("DO", "Dominican Republic", "DOP", "RD$", "+1809", "America/Santo_Domingo"),
    ("SV", "El Salvador", "USD", "$", "+503", "America/El_Salvador"),
    ("GT", "Guatemala", "GTQ", "Q", "+502", "America/Guatemala"),
    ("HT", "Haiti", "HTG", "G", "+509", "America/Port-au-Prince"),
    ("HN", "Honduras", "HNL", "L", "+504", "America/Tegucigalpa"),
    ("JM", "Jamaica", "JMD", "J$", "+1876", "America/Jamaica"),
    ("NI", "Nicaragua", "NIO", "C$", "+505", "America/Managua"),
    ("PA", "Panama", "PAB", "B/.", "+507", "America/Panama"),
    ("TT", "Trinidad and Tobago", "TTD", "TT$", "+1868", "America/Port_of_Spain"),

    # ── South America ──
    ("AR", "Argentina", "ARS", "$", "+54", "America/Argentina/Buenos_Aires"),
    ("BO", "Bolivia", "BOB", "Bs.", "+591", "America/La_Paz"),
    ("BR", "Brazil", "BRL", "R$", "+55", "America/Sao_Paulo"),
    ("CL", "Chile", "CLP", "$", "+56", "America/Santiago"),
    ("CO", "Colombia", "COP", "$", "+57", "America/Bogota"),
    ("EC", "Ecuador", "USD", "$", "+593", "America/Guayaquil"),
    ("GY", "Guyana", "GYD", "$", "+592", "America/Guyana"),
    ("PY", "Paraguay", "PYG", "₲", "+595", "America/Asuncion"),
    ("PE", "Peru", "PEN", "S/", "+51", "America/Lima"),
    ("UY", "Uruguay", "UYU", "$U", "+598", "America/Montevideo"),
    ("VE", "Venezuela", "VES", "Bs", "+58", "America/Caracas"),

    # ── Western & Northern Europe ──
    ("GB", "United Kingdom", "GBP", "£", "+44", "Europe/London"),
    ("IE", "Ireland", "EUR", "€", "+353", "Europe/Dublin"),
    ("FR", "France", "EUR", "€", "+33", "Europe/Paris"),
    ("DE", "Germany", "EUR", "€", "+49", "Europe/Berlin"),
    ("NL", "Netherlands", "EUR", "€", "+31", "Europe/Amsterdam"),
    ("BE", "Belgium", "EUR", "€", "+32", "Europe/Brussels"),
    ("LU", "Luxembourg", "EUR", "€", "+352", "Europe/Luxembourg"),
    ("CH", "Switzerland", "CHF", "Fr", "+41", "Europe/Zurich"),
    ("AT", "Austria", "EUR", "€", "+43", "Europe/Vienna"),
    ("DK", "Denmark", "DKK", "kr", "+45", "Europe/Copenhagen"),
    ("SE", "Sweden", "SEK", "kr", "+46", "Europe/Stockholm"),
    ("NO", "Norway", "NOK", "kr", "+47", "Europe/Oslo"),
    ("FI", "Finland", "EUR", "€", "+358", "Europe/Helsinki"),
    ("IS", "Iceland", "ISK", "kr", "+354", "Atlantic/Reykjavik"),

    # ── Southern Europe ──
    ("ES", "Spain", "EUR", "€", "+34", "Europe/Madrid"),
    ("PT", "Portugal", "EUR", "€", "+351", "Europe/Lisbon"),
    ("IT", "Italy", "EUR", "€", "+39", "Europe/Rome"),
    ("GR", "Greece", "EUR", "€", "+30", "Europe/Athens"),
    ("MT", "Malta", "EUR", "€", "+356", "Europe/Malta"),
    ("CY", "Cyprus", "EUR", "€", "+357", "Asia/Nicosia"),
    ("AD", "Andorra", "EUR", "€", "+376", "Europe/Andorra"),
    ("MC", "Monaco", "EUR", "€", "+377", "Europe/Monaco"),
    ("SM", "San Marino", "EUR", "€", "+378", "Europe/San_Marino"),

    # ── Central & Eastern Europe ──
    ("PL", "Poland", "PLN", "zł", "+48", "Europe/Warsaw"),
    ("CZ", "Czechia", "CZK", "Kč", "+420", "Europe/Prague"),
    ("SK", "Slovakia", "EUR", "€", "+421", "Europe/Bratislava"),
    ("HU", "Hungary", "HUF", "Ft", "+36", "Europe/Budapest"),
    ("RO", "Romania", "RON", "lei", "+40", "Europe/Bucharest"),
    ("BG", "Bulgaria", "BGN", "лв", "+359", "Europe/Sofia"),
    ("HR", "Croatia", "EUR", "€", "+385", "Europe/Zagreb"),
    ("SI", "Slovenia", "EUR", "€", "+386", "Europe/Ljubljana"),
    ("EE", "Estonia", "EUR", "€", "+372", "Europe/Tallinn"),
    ("LV", "Latvia", "EUR", "€", "+371", "Europe/Riga"),
    ("LT", "Lithuania", "EUR", "€", "+370", "Europe/Vilnius"),
    ("RS", "Serbia", "RSD", "дин", "+381", "Europe/Belgrade"),
    ("BA", "Bosnia and Herzegovina", "BAM", "KM", "+387", "Europe/Sarajevo"),
    ("ME", "Montenegro", "EUR", "€", "+382", "Europe/Podgorica"),
    ("MK", "North Macedonia", "MKD", "ден", "+389", "Europe/Skopje"),
    ("AL", "Albania", "ALL", "L", "+355", "Europe/Tirane"),
    ("XK", "Kosovo", "EUR", "€", "+383", "Europe/Belgrade"),
    ("MD", "Moldova", "MDL", "L", "+373", "Europe/Chisinau"),
    ("UA", "Ukraine", "UAH", "₴", "+380", "Europe/Kyiv"),
    ("BY", "Belarus", "BYN", "Br", "+375", "Europe/Minsk"),
    ("RU", "Russia", "RUB", "₽", "+7", "Europe/Moscow"),

    # ── Middle East ──
    ("AE", "United Arab Emirates", "AED", "د.إ", "+971", "Asia/Dubai"),
    ("SA", "Saudi Arabia", "SAR", "﷼", "+966", "Asia/Riyadh"),
    ("QA", "Qatar", "QAR", "ر.ق", "+974", "Asia/Qatar"),
    ("KW", "Kuwait", "KWD", "د.ك", "+965", "Asia/Kuwait"),
    ("BH", "Bahrain", "BHD", ".د.ب", "+973", "Asia/Bahrain"),
    ("OM", "Oman", "OMR", "ر.ع.", "+968", "Asia/Muscat"),
    ("JO", "Jordan", "JOD", "د.ا", "+962", "Asia/Amman"),
    ("LB", "Lebanon", "LBP", "ل.ل", "+961", "Asia/Beirut"),
    ("IL", "Israel", "ILS", "₪", "+972", "Asia/Jerusalem"),
    ("PS", "Palestine", "ILS", "₪", "+970", "Asia/Gaza"),
    ("IQ", "Iraq", "IQD", "ع.د", "+964", "Asia/Baghdad"),
    ("IR", "Iran", "IRR", "﷼", "+98", "Asia/Tehran"),
    ("SY", "Syria", "SYP", "£", "+963", "Asia/Damascus"),
    ("YE", "Yemen", "YER", "﷼", "+967", "Asia/Aden"),
    ("TR", "Turkey", "TRY", "₺", "+90", "Europe/Istanbul"),

    # ── Central Asia & Caucasus ──
    ("KZ", "Kazakhstan", "KZT", "₸", "+7", "Asia/Almaty"),
    ("UZ", "Uzbekistan", "UZS", "soʻm", "+998", "Asia/Tashkent"),
    ("TM", "Turkmenistan", "TMT", "m", "+993", "Asia/Ashgabat"),
    ("KG", "Kyrgyzstan", "KGS", "som", "+996", "Asia/Bishkek"),
    ("TJ", "Tajikistan", "TJS", "SM", "+992", "Asia/Dushanbe"),
    ("GE", "Georgia", "GEL", "₾", "+995", "Asia/Tbilisi"),
    ("AM", "Armenia", "AMD", "֏", "+374", "Asia/Yerevan"),
    ("AZ", "Azerbaijan", "AZN", "₼", "+994", "Asia/Baku"),

    # ── East & Southeast Asia ──
    ("CN", "China", "CNY", "¥", "+86", "Asia/Shanghai"),
    ("HK", "Hong Kong", "HKD", "HK$", "+852", "Asia/Hong_Kong"),
    ("MO", "Macau", "MOP", "MOP$", "+853", "Asia/Macau"),
    ("TW", "Taiwan", "TWD", "NT$", "+886", "Asia/Taipei"),
    ("JP", "Japan", "JPY", "¥", "+81", "Asia/Tokyo"),
    ("KR", "South Korea", "KRW", "₩", "+82", "Asia/Seoul"),
    ("SG", "Singapore", "SGD", "S$", "+65", "Asia/Singapore"),
    ("MY", "Malaysia", "MYR", "RM", "+60", "Asia/Kuala_Lumpur"),
    ("ID", "Indonesia", "IDR", "Rp", "+62", "Asia/Jakarta"),
    ("TH", "Thailand", "THB", "฿", "+66", "Asia/Bangkok"),
    ("PH", "Philippines", "PHP", "₱", "+63", "Asia/Manila"),
    ("VN", "Vietnam", "VND", "₫", "+84", "Asia/Ho_Chi_Minh"),

    # ── Oceania ──
    ("AU", "Australia", "AUD", "A$", "+61", "Australia/Sydney"),
    ("NZ", "New Zealand", "NZD", "$", "+64", "Pacific/Auckland"),

    # ── Africa (major) ──
    ("EG", "Egypt", "EGP", "£", "+20", "Africa/Cairo"),
    ("NG", "Nigeria", "NGN", "₦", "+234", "Africa/Lagos"),
    ("ZA", "South Africa", "ZAR", "R", "+27", "Africa/Johannesburg"),
    ("KE", "Kenya", "KES", "KSh", "+254", "Africa/Nairobi"),
    ("GH", "Ghana", "GHS", "₵", "+233", "Africa/Accra"),
    ("ET", "Ethiopia", "ETB", "Br", "+251", "Africa/Addis_Ababa"),
    ("TZ", "Tanzania", "TZS", "TSh", "+255", "Africa/Dar_es_Salaam"),
    ("MA", "Morocco", "MAD", "DH", "+212", "Africa/Casablanca"),
]


COUNTRIES = {
    code: {
        "name": name,
        "currency_code": currency_code,
        "currency_symbol": currency_symbol,
        "timezone": timezone,
        "tax_label": _tax_label(code),
        "phone_code": phone_code,
    }
    for (code, name, currency_code, currency_symbol, phone_code, timezone) in _DATA
}


def get_country_config(country_code: str) -> dict:
    """Get config for a country code. Falls back to India if unknown."""
    return COUNTRIES.get((country_code or "").upper(), COUNTRIES["IN"])


def get_all_countries() -> list:
    """Return list of countries for frontend dropdown, sorted by name."""
    return [
        {
            "code": code,
            "name": cfg["name"],
            "phone_code": cfg["phone_code"],
            "currency_symbol": cfg["currency_symbol"],
            "currency_code": cfg["currency_code"],
        }
        for code, cfg in sorted(COUNTRIES.items(), key=lambda x: x[1]["name"])
    ]
