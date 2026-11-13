import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readWestLayout} from '../src/rom/west-layout.js';
import {readWestMap} from '../src/rom/west-map.js';
import {inspectWorldMap} from '../src/rom/world-map.js';

const trial = new URL('../../taikou-rebuild/build/trials/v142/【小咪优化】MD太阁立志传_PRO_v1.42_新势力地图名册试玩.bin', import.meta.url);
const available = fs.existsSync(trial);

test('v1.42 weighted-A* ROM remains openable in the map editor', {skip: !available}, () => {
  const bytes = new Uint8Array(fs.readFileSync(trial));
  const capability = inspectWorldMap(bytes);
  assert.equal(capability.supported, true, capability.error?.message);
  const layout = readWestLayout(bytes);
  assert.equal(layout.version, '1.42');
  assert.equal(layout.nav.version, 3);
  const map = readWestMap(bytes);
  assert.deepEqual(
    [map.width, map.height, map.blocks, map.places.castles.length, map.places.towns.length],
    [616, 368, 1331, 159, 29],
  );
});

const visitTrial = new URL('../../taikou-rebuild/build/faction-expansion/NOT-RELEASE-岡豊入城.bin', import.meta.url);
test('first-clan native visit trial opens its map and rejects unsafe edits/export', {skip: !fs.existsSync(visitTrial)}, async () => {
  const {RomDocument} = await import('../src/rom/document.js');
  const bytes = new Uint8Array(fs.readFileSync(visitTrial));
  const doc = await RomDocument.load(bytes, 'visit-trial.bin');
  assert.equal(doc.editPolicy, 'readonly-trial');
  assert.equal(inspectWorldMap(bytes).supported, true);
  assert.equal(doc.snapshot().people.length, 713);
  const map = readWestMap(bytes);
  assert.deepEqual([map.width, map.height, map.places.castles.length], [616,368,159]);
  assert.throws(() => doc.applyRecord('people', 0, {affinity: 1}), e => e.code === 'READ_ONLY_ROM');
  assert.throws(() => doc.exportBytes(), e => e.code === 'READ_ONLY_ROM');
});
