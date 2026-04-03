const COORDINATE_PRECISION = 2;

export const normalizeCoordinate = (value, precision = COORDINATE_PRECISION) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Number(numericValue.toFixed(precision));
};

export const normalizeCoordinates = (
  latitude,
  longitude,
  precision = COORDINATE_PRECISION
) => ({
  latitude: normalizeCoordinate(latitude, precision),
  longitude: normalizeCoordinate(longitude, precision),
});

export const buildCoordinateKey = (
  latitude,
  longitude,
  precision = COORDINATE_PRECISION
) => {
  const normalizedLatitude = normalizeCoordinate(latitude, precision);
  const normalizedLongitude = normalizeCoordinate(longitude, precision);

  if (normalizedLatitude === null || normalizedLongitude === null) {
    return '';
  }

  return `${normalizedLatitude.toFixed(precision)}:${normalizedLongitude.toFixed(precision)}`;
};
