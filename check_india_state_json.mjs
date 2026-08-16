// Validates data/india-states.json against public/bharatgen-voices.json.
// Checks that the topology decodes to true lat/lng and that every voice pin lands
// inside the state polygon its `stateId` points at.
// Run: node check_india_state_json.mjs   (exit 0 = pass, 1 = fail)
import { geoContains, geoBounds, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import fs from 'fs';

// India's true extent, including the full Kashmir claim. The topology's
// transform.scale[1] must be quantized against this, not against 35.495.
const TRUE_BOUNDS = { south: 6.75, north: 37.09, west: 68.14, east: 97.42 };
const BOUNDS_TOL = 0.15; // deg — simplification noise
const NORTH_EDGE_TOL = 0.15; // deg — per-state, against ~±0.1 reference values
const EXPECTED_INSIDE = 23; // of 24; Chennai's coastline is simplified inland of the city
const COASTAL_ALLOWANCE_KM = 25;

const topo = JSON.parse(fs.readFileSync('data/india-states.json', 'utf8'));
const feats = feature(topo, topo.objects.india).features.filter((f) => String(f.id) !== '-99');
const voices = JSON.parse(fs.readFileSync('public/bharatgen-voices.json', 'utf8'));
const fails = [];
const fail = (msg) => fails.push(msg);

// ---- 1. header ------------------------------------------------------------
console.log('=== 1. TOPOLOGY HEADER ===');
console.log('  arcs:', topo.arcs.length, '| geometries:', topo.objects.india.geometries.length,
  '| usable features:', feats.length);
console.log('  scale    ', JSON.stringify(topo.transform.scale));
console.log('  translate', JSON.stringify(topo.transform.translate));
const expectedScaleY = (TRUE_BOUNDS.north - topo.transform.translate[1]) / 9999;
console.log('  scale[1] expected ~', expectedScaleY.toFixed(10),
  '| actual', topo.transform.scale[1],
  Math.abs(topo.transform.scale[1] - expectedScaleY) < 1e-5 ? '  OK' : '  MISMATCH');

// ---- 2. decoded bounds ---------------------------------------------------
const b = geoBounds({ type: 'FeatureCollection', features: feats });
console.log('\n=== 2. DECODED BOUNDS ===');
const edge = (label, got, want) => {
  const err = got - want;
  const ok = Math.abs(err) <= BOUNDS_TOL;
  console.log('  ' + label.padEnd(6), got.toFixed(4).padStart(9), ' true', want.toFixed(2).padStart(6),
    ' err', err.toFixed(3).padStart(7), ok ? ' OK' : ' FAIL');
  if (!ok) fail(`${label} bound off by ${err.toFixed(3)} deg`);
};
edge('south', b[0][1], TRUE_BOUNDS.south);
edge('north', b[1][1], TRUE_BOUNDS.north);
edge('west', b[0][0], TRUE_BOUNDS.west);
edge('east', b[1][0], TRUE_BOUNDS.east);

// ---- 3. per-state north edges --------------------------------------------
// A same-signed error column that grows with latitude means the vertical
// squash is back (wrong transform.scale[1]).
const trueNorth = { TN: 13.6, KL: 12.8, GJ: 24.7, AS: 27.9, BR: 27.5, PB: 32.5, KA: 18.45, MH: 22.03, OD: 22.57 };
console.log('\n=== 3. STATE NORTH EDGE vs TRUTH (deg) ===');
console.log('  id     true    actual      err');
let sum = 0, n = 0;
for (const [id, tn] of Object.entries(trueNorth)) {
  const f = feats.find((f) => String(f.id) === id);
  if (!f) { fail(`state ${id} missing from topology`); console.log('  ' + id.padEnd(4), 'MISSING'); continue; }
  const got = geoBounds(f)[1][1];
  const err = got - tn;
  sum += Math.abs(err); n++;
  const ok = Math.abs(err) <= NORTH_EDGE_TOL;
  console.log('  ' + id.padEnd(6), tn.toFixed(2).padStart(6), got.toFixed(2).padStart(9),
    err.toFixed(2).padStart(9), ok ? '  OK' : '  FAIL');
  if (!ok) fail(`${id} north edge off by ${err.toFixed(2)} deg`);
}
const meanErr = sum / n;
console.log('  mean |err|:', meanErr.toFixed(3), 'deg', meanErr < 0.1 ? ' OK' : ' FAIL');
if (meanErr >= 0.1) fail(`mean north-edge error ${meanErr.toFixed(3)} deg`);

// ---- 4. pin containment --------------------------------------------------
// `null` = stateId matches no feature (voice-data bug, not a geometry bug).
console.log('\n=== 4. PIN CONTAINMENT ===');
console.log('  district / state                stateId  inside   note');
let inside = 0;
for (const v of voices) {
  const f = feats.find((f) => String(f.id) === String(v.stateId));
  if (!f) {
    fail(`${v.district}: stateId "${v.stateId}" matches no feature`);
    console.log('  ' + (v.district + ' / ' + v.state).padEnd(31), String(v.stateId).padEnd(8),
      'null     UNKNOWN stateId');
    continue;
  }
  const ok = geoContains(f, v.coordinates);
  if (ok) inside++;
  let note = '';
  if (!ok) {
    let km = Infinity;
    const walk = (c) => Array.isArray(c[0])
      ? c.forEach(walk)
      : (km = Math.min(km, geoDistance(v.coordinates, c) * 6371));
    walk(f.geometry.coordinates);
    note = km <= COASTAL_ALLOWANCE_KM
      ? `outside by ${km.toFixed(0)} km — coastline simplification, tolerated`
      : `OUTSIDE by ${km.toFixed(0)} km — check coordinates`;
    if (km > COASTAL_ALLOWANCE_KM) fail(`${v.district} is ${km.toFixed(0)} km outside ${v.state}`);
  }
  console.log('  ' + (v.district + ' / ' + v.state).padEnd(31), String(v.stateId).padEnd(8),
    String(ok).padEnd(8), note);
}
console.log('\n  inside own state:', inside + '/' + voices.length,
  '(expected >= ' + EXPECTED_INSIDE + ')', inside >= EXPECTED_INSIDE ? ' OK' : ' FAIL');
if (inside < EXPECTED_INSIDE) fail(`only ${inside}/${voices.length} pins inside their state`);

// ---- verdict -------------------------------------------------------------
console.log('\n=== VERDICT ===');
if (fails.length === 0) {
  console.log('  PASS — topology decodes to true coordinates and pins land in their states.');
} else {
  console.log('  FAIL (' + fails.length + ')');
  for (const f of fails) console.log('   - ' + f);
  process.exitCode = 1;
}
