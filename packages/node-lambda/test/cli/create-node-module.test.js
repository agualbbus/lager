/*eslint-env mocha */
/* global testRequire */
'use strict';

const _ = require('lodash');
const assert = require('assert');
const cmd = testRequire('src/cli/create-node-module');
const icli = require('comquirer');

describe('The create-node-module sub-command', function() {

  it('is a function', () => {
    assert.equal(typeof cmd, 'function', 'the module "src/cli/create-node-module" exposes a function');
  });

  it('creates a comquirer sub-command', () => {
    cmd(icli);
    assert.ok(
      _.find(icli.getProgram().commands, command => { return command._name === 'create-node-module'; }),
      'a "create-node-module sub command has been created"'
    );
  });

  // To make this test work, icli.getProgram().parse() should return a Promise that resolve when the command finished its execution
  // it('execute the command "cmd"', (done) => {
  //   captureConsoleLog.begin();
  //   icli.getProgram().parse(['/node/path', '/program/path', 'cmd']);
  //   captureConsoleLog.end();
  // });

});
