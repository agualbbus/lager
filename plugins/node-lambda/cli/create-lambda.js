'use strict';

const path = require('path');
const lager = require('@lager/lager/lib/lager');
const Promise = lager.getPromise();
const fs = Promise.promisifyAll(require('fs'));
const ncpAsync = Promise.promisify(require('ncp'));
const cliTools = require('@lager/lager/lib/cli-tools');
const mkdirpAsync = Promise.promisify(require('mkdirp'));
const _ = lager.getLodash();
const routers = ['api-endpoints', 'none'];

module.exports = (program, inquirer) => {

  // Build the list of available APIs for input verification and interactive selection
  const memoryValues = [];
  for (let i = 128; i <= 1536; i = i + 64) {
    memoryValues.push({ value: i, label: i + 'MB' });
  }
  const valueLists = {
    memory: memoryValues,
    execType: [{
      value: 'api-endpoints',
      label: 'With this type of execution, the Lambda will execute endpoints defined by the api-gateway plugin'
    }, {
      value: 'none',
      label: 'Do not add an execution type to the Lambda, you will write a custom one'
    }]
  };
  const validators = {
    memory: cliTools.generateListValidator(valueLists.memory, 'memory value'),
    execType: cliTools.generateListValidator(valueLists.execType, 'Lambda execution type')
  };

  program
  .command('create-lambda')
  .description('create a new lambda')
  .arguments('[lambda-identifier]')
  .option('-t, --timeout <timeout>', 'Select the timeout (seconds)', parseInt)
  .option('-m, --memory <memory>', 'Select the memory (MB)', parseInt)
  .option('-r, --role <role>', 'Select the execution role')
  .option('-e, --exec-type <execution-type>', 'Select the type of execution to associate to the lambda')
  .action(function (lambdaIdentifier, options) {
    //console.log(options);
    options['exec-type'] = options.execType;

    // Transform cli arguments and options into a parameter map
    let parameters = cliTools.processCliArgs(arguments, validators);

    // If the cli arguments are correct, we can launch the interactive prompt
    return inquirer.prompt(prepareQuestions(parameters, valueLists))
    .then(answers => {
      // Merge the parameters from the command and from the prompt and create the new API
      return performTask(_.merge(parameters, answers));
    });
  });

  return Promise.resolve();
};


function prepareQuestions(parameters, valueLists) {
  return [{
    type: 'input',
    name: 'lambdaIdentifier',
    message: 'Choose a unique identifier for the new Lambda (alphanumeric caracters, "_" and "-" accepted)',
    when: answers => { return !parameters.lambdaIdentifier; },
    validate: input => { return /^[a-z0-9_-]+$/i.test(input); }
  }, {
    type: 'input',
    name: 'timeout',
    message: 'Choose the timeout',
    when: answers => { return !parameters.timeout; },
    validate: input => { return !isNaN(parseInt(input, 10)); }
  }, {
    type: 'list',
    name: 'memory',
    message: 'Choose the memory allocated to the Lambda',
    choices: valueLists.memory,
    when: answers => { return !parameters.memory; },
    default: '128MB'
  }, {
    type: 'input',
    name: 'role',
    message: 'Choose the execution role',
    when: answers => { return !parameters.role; }
  }, {
    type: 'list',
    name: 'execType',
    message: 'Select an execution type for the Lambda',
    choices: valueLists.execType,
    when: answers => { return !parameters.execType; },
    default: 'api-endpoints'
  }];
}

/**
 * Create the new endpoint
 * @param  {Object} parameters [description]
 * @return void
 */
function performTask(parameters) {
  const configFilePath = path.join(process.cwd(), 'lambdas', parameters.lambdaIdentifier);
  return mkdirpAsync(configFilePath)
  .then(() => {
    // We create the configuration file of the Lambda
    let config = {
      "params": {
        "Timeout": parameters.timeout,
        "MemorySize": parameters.memory,
        "Role": parameters.role
      },
      "includeEndpoints": parameters.execType === 'api-endpoints',
      "includeLibs": []
    };

    // We save the specification in a json file
    return fs.writeFileAsync(configFilePath + path.sep + 'config.json', JSON.stringify(config, null, 2));
  })
  .then(() => {
    // We create the lambda handler
    const src = path.join(__dirname, 'templates','lambda.js');
    const dest = path.join(configFilePath, 'lambdas.js');
    console.log(src, dest);
    return ncpAsync(src, dest);
  })
  .then(() => {
    // We create the execution type
    const src = path.join(__dirname, 'templates', 'exec-types', parameters.execType + '.js');
    const dest = path.join(configFilePath, 'exec.js');
    return ncpAsync(src, dest);
  })
  .then(() => {
    console.log('Lambda created');
  })
  .catch(e => {
    console.log(e);
    console.log(e.stack);
  });
}
