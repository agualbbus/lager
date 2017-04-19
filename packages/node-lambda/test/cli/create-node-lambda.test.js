/*eslint-env mocha */
/* global testRequire */
'use strict';

const _ = require('lodash');
const assert = require('assert');
const cmd = testRequire('src/cli/create-node-lambda');
const icli = require('comquirer');

describe('The create-node-lambda sub-command', function() {

  it('is a function', () => {
    assert.equal(typeof cmd, 'function', 'the module "src/cli/create-node-lambda" exposes a function');
  });

  it('creates a comquirer sub-command', () => {
    cmd(icli);
    assert.ok(
      _.find(icli.getProgram().commands, command => { return command._name === 'create-node-lambda'; }),
      'a "create-node-lambda sub command has been created"'
    );
  });

});
