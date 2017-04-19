/*eslint-env mocha */
/* global testRequire */
'use strict';

const assert = require('assert');
const _ = require('lodash');
const cmd = testRequire('src/cli/inspect-endpoint');
const icli = require('comquirer');

describe('The inspect-endpoint sub-command', function() {

  it('is a function', () => {
    assert.equal(typeof cmd, 'function', 'the module "src/cli/inspect-endpoint" exposes a function');
  });

  it('creates a comquirer sub-command', () => {
    cmd(icli);
    assert.ok(
      _.find(icli.getProgram().commands, command => { return command._name === 'inspect-endpoint'; }),
      'a "inspect-endpoint sub command has been created"'
    );
  });

});
