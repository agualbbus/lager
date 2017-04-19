/*eslint-env mocha */
/* global testRequire */
'use strict';

const assert = require('assert');
const _ = require('lodash');
const cmd = testRequire('src/cli/create-role');
const icli = require('comquirer');

describe('The create-role sub-command', function() {

  it('is a function', () => {
    assert.equal(typeof cmd, 'function', 'the module "src/cli/create-role" exposes a function');
  });

  it('creates a comquirer sub-command', () => {
    cmd(icli);
    assert.ok(
      _.find(icli.getProgram().commands, command => { return command._name === 'create-role'; }),
      'a "create-role sub command has been created"'
    );
  });

});
