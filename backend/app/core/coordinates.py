from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

COORDINATE_PRECISION = 2


def normalize_coordinate(value: float | None, *, precision: int = COORDINATE_PRECISION) -> float | None:
    if value is None:
        return None

    try:
        decimal_value = Decimal(str(float(value)))
    except (TypeError, ValueError, InvalidOperation):
        return None

    quantizer = Decimal("1").scaleb(-precision)
    return float(decimal_value.quantize(quantizer, rounding=ROUND_HALF_UP))


def normalize_coordinates(
    latitude: float | None,
    longitude: float | None,
    *,
    precision: int = COORDINATE_PRECISION,
) -> tuple[float | None, float | None]:
    return (
        normalize_coordinate(latitude, precision=precision),
        normalize_coordinate(longitude, precision=precision),
    )


def format_coordinate(
    value: float | None,
    *,
    precision: int = COORDINATE_PRECISION,
    missing: str = "na",
) -> str:
    normalized = normalize_coordinate(value, precision=precision)
    if normalized is None:
        return missing

    return f"{normalized:.{precision}f}"


def format_coordinate_pair(
    latitude: float | None,
    longitude: float | None,
    *,
    precision: int = COORDINATE_PRECISION,
) -> str | None:
    normalized_lat, normalized_lon = normalize_coordinates(
        latitude,
        longitude,
        precision=precision,
    )
    if normalized_lat is None or normalized_lon is None:
        return None

    return (
        f"{format_coordinate(normalized_lat, precision=precision)},"
        f"{format_coordinate(normalized_lon, precision=precision)}"
    )
