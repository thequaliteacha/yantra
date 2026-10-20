/* Sunrise and sunset on the device.
   Jean Meeus, as used by SunCalc: the sun's center at -0.833°,
   which includes refraction and the sun's radius. No network. */

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;
const SUNRISE_ANGLE = -0.833 * RAD;

function toJulian(ms) {
  return ms / DAY_MS - 0.5 + J1970;
}
function fromJulian(j) {
  return (j + 0.5 - J1970) * DAY_MS;
}
function solarMeanAnomaly(d) {
  return RAD * (357.5291 + 0.98560028 * d);
}
function eclipticLongitude(m) {
  const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  return m + c + RAD * 102.9372 + Math.PI;
}
function declination(l) {
  return Math.asin(Math.sin(l) * Math.sin(OBLIQUITY));
}
function julianCycle(d, lw) {
  return Math.round(d - 0.0009 - lw / (2 * Math.PI));
}
function approxTransit(ht, lw, n) {
  return 0.0009 + (ht + lw) / (2 * Math.PI) + n;
}
function solarTransit(ds, m, l) {
  return J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
}
function hourAngle(h, phi, dec) {
  const cos = (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cos <= -1 || cos >= 1) return null;
  return Math.acos(cos);
}

/* Absolute instants for the sunrise and sunset nearest the given moment.
   lat and lon are degrees. Returns null where the sun does not cross the horizon. */
export function sunTimes(at, lat, lon) {
  const ms = at instanceof Date ? at.getTime() : Number(at);
  if (!Number.isFinite(ms) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const lw = RAD * -lon;
  const phi = RAD * lat;
  const d = toJulian(ms) - J2000;
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const m = solarMeanAnomaly(ds);
  const l = eclipticLongitude(m);
  const dec = declination(l);
  const noon = solarTransit(ds, m, l);
  const w = hourAngle(SUNRISE_ANGLE, phi, dec);
  if (w == null) return null;
  const set = solarTransit(approxTransit(w, lw, n), m, l);
  return { sunrise: fromJulian(noon - (set - noon)), sunset: fromJulian(set) };
}
