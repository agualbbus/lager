'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const plugin = require('../index');

/**
 * This module exports a function that enrich the interactive command line and return a promise
 * @returns {Promise} - a promise that resolve when the operation is done
 */
module.exports = (icli) => {

  // Build the lists of choices
  const choicesLists = getChoices();

  const config = {
    section: 'Node Lambda plugin',
    cmd: 'test-node-lambda-locally',
    description: 'execute a lambda locally',
    parameters: [{
      cmdSpec: '[lambda-identifier]',
      type: 'list',
      choices: choicesLists.lambdaIdentifiers,
      question: {
        message: 'Which Lambda do you want to execute locally?'
      }
    }, {
      cmdSpec: '-e, --event <event-name>',
      description: 'Event example to use',
      type: 'list',
      choices: choicesLists.events,
      question: {
        message: 'Which event example do you want to use?',
        when: (answers, cmdParameterValues) => {
          if (cmdParameterValues.event) { return false; }
          return choicesLists.events(answers, cmdParameterValues)
          .then(choices => {
            if (choices.length === 1) {
              cmdParameterValues.event = choices[0];
              return false;
            }
            return choices.length > 0;
          });
        }
      }
    }]
  };

  /**
   * Create the command and the prompt
   */
  return icli.createSubCommand(config, executeCommand);

  /**
   * Build the choices for "list" and "checkbox" parameters
   * @returns {Object} - collection of lists of choices for "list" and "checkbox" parameters
   */
  function getChoices() {
    return {
      lambdaIdentifiers: () => {
        return plugin.loadLambdas()
        .then(lambdas => {
          return _.map(lambdas, lambda => {
            return {
              value: lambda.getIdentifier(),
              name: icli.format.info(lambda.getIdentifier())
            };
          });
        });
      },
      events: (answers, cmdParameterValues) => {
        // @FIXME comquirer is not able to validate a list for a question, using the command parameter values
        if (answers) {
          const lambdaIdentifier = answers.lambdaIdentifier || cmdParameterValues.lambdaIdentifier;
          return plugin.findLambda(lambdaIdentifier)
          .then(lambda => {
            return lambda.getEventExamples();
          });
        }
        // @FIXME so we list all the events of all the lambdas as a workarround
        return plugin.loadLambdas()
        .then(lambdas => {
          return Promise.map(lambdas, lambda => {
            return lambda.getEventExamples();
          });
        })
        .then(eventsLists => {
          return _.uniq(_.concat.apply(null, eventsLists));
        });
      }
    };
  }

  /* istanbul ignore next */
  /**
   * Execute the deployment
   * @param {Object} parameters - the parameters provided in the command and in the prompt
   * @returns {Promise<null>} - The execution stops here
   */
  function executeCommand(parameters) {
    console.log();
    console.log('Executing ' + icli.format.info(parameters.lambdaIdentifier));
    console.log('This will install the Lambda locally');

    return plugin.findLambda(parameters.lambdaIdentifier)
    .then(lambda => {
      return lambda.executeLocally(parameters.event ? lambda.loadEventExample(parameters.event) : {});
    })
    .then(result => {
      console.log('Success result:');
      console.log(JSON.stringify(result, null, 2));
      console.log();
    })
    .catch(e => {
      console.log('Error result:');
      console.log(e);
      console.log(e.stack);
      console.log();
    });
  }

};
