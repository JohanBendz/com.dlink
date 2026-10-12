'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'));
}

test('DCH-S220 Flow formatted titles use only supported placeholders', () => {
  const compose = readJson('drivers/DCH-S220/driver.flow.compose.json');
  const app = readJson('app.json');

  const byId = id => ({
    compose: compose.actions.find(action => action.id === id),
    generated: app.flow.actions.find(action => action.id === id),
  });

  const play = byId('DCH-S220-play-sound');
  const stop = byId('DCH-S220-stop');

  assert.ok(play.compose && play.generated);
  assert.ok(stop.compose && stop.generated);

  assert.equal(play.compose.titleFormatted.en, 'Play [[sound]]');
  assert.equal(play.generated.titleFormatted.en, 'Play [[sound]]');
  assert.equal(stop.compose.titleFormatted, undefined);
  assert.equal(stop.generated.titleFormatted, undefined);

  // Homey implicitly handles the selected device; [[device]] is invalid in
  // titleFormatted even though the generated card has a device argument.
  for (const card of [play.compose, play.generated, stop.compose, stop.generated]) {
    assert.doesNotMatch(card.titleFormatted?.en || '', /\[\[device\]\]/);
  }

  assert.deepEqual(
    play.generated.args.map(argument => argument.name),
    ['device', 'sound'],
  );
  assert.deepEqual(
    stop.generated.args.map(argument => argument.name),
    ['device'],
  );
});
