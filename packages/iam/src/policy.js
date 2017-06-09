'use strict';

const Promise = require('bluebird');
const _ = require('lodash');
const AWS = require('aws-sdk');

const iamHelper = require('./helper');
const plugin = require('./index');

/**
 * Constructor function
 * @param {Object} document - policy document
 * @param {string} name - policy name
 * @constructor
 */
const Policy = function Policy(document, name, pathPrefix) {
  this.document = document;
  this.name = name;
  this.pathPrefix = pathPrefix || '/';
};

/**
 * Returns the policy name
 * @returns {string}
 */
Policy.prototype.getName = function getName() {
  return this.name;
};

/**
 * Deploy a policy
 * @param {Object} context
 * @returns {Promise<Object>}
 */
Policy.prototype.deploy = function deploy(context) {
  const awsIAM = new AWS.IAM();
  let name = this.name;
  if (context.environment) { name = context.environment + '_' + name; }
  if (context.stage) { name = name + '_' + context.stage; }
  const report = { name: name };
  const initTime = process.hrtime();

  return plugin.myrmex.fire('beforeDeployPolicy', this)
  .spread(() => {
    var params = {
      PathPrefix: this.pathPrefix,
      OnlyAttached: false,
      Scope: 'Local'
    };
    return iamHelper.getPolicyByName(name, params);
  })
  .then(currentPolicy => {
    if (currentPolicy) {
      // If the function already exists
      report.arn = currentPolicy.Arn;
      return this.updateIfNeeded(awsIAM, currentPolicy, report);
    } else {
      // If error occured because the function does not exists, we create it
      return this.create(awsIAM, name, report);
    }
  })
  .then(data => {
    if (data.Policy && data.Policy.Arn) {
      report.arn = data.Policy.Arn;
    }
    report.deployTime = process.hrtime(initTime);
    return plugin.myrmex.fire('afterDeployPolicy', this);
  })
  .spread(() => {
    return Promise.resolve(report);
  });
};

/**
 * Create a new policy in AWS
 * @param {AWS.IAM} awsIAM
 * @param {string} name
 * @param {Object} report
 * @returns {Promise<Object>}
 */
Policy.prototype.create = function create(awsIAM, name, report) {
  report = report || {};
  report.operation = 'Creation';
  const initTime = process.hrtime();
  const params = {
    PolicyDocument: JSON.stringify(this.document),
    PolicyName: name,
    Description: 'Policy generated by Myrmex',
    Path: this.pathPrefix
  };
  return awsIAM.createPolicy(params).promise()
  .then(r => {
    report.deployTime = process.hrtime(initTime);
    report.policyVersions = 1;
    return Promise.resolve(r);
  });
};

/**
 * Delete a policy version if there are more than 5 and create a new one in AWS
 * @param {AWS.IAM} awsIAM
 * @param {Object} currentPolicy
 * @param {Object} report
 * @returns {Promise<Object>}
 */
Policy.prototype.updateIfNeeded = function updateIfNeeded(awsIAM, currentPolicy, report) {
  report = report || {};
  const params = {
    PolicyArn: currentPolicy.Arn,
    VersionId: currentPolicy.DefaultVersionId
  };
  return awsIAM.getPolicyVersion(params).promise()
  .then(data => {
    if (unescape(data.PolicyVersion.Document) === JSON.stringify(this.document)) {
      report.operation = 'Already up-to-date';
      return Promise.resolve(currentPolicy);
    } else {
      report.operation = 'Update';
      return this.update(awsIAM, currentPolicy.Arn, report);
    }
  });
};

/**
 * Delete a policy version if there are more than 5 and create a new one in AWS
 * @param {AWS.IAM} awsIAM
 * @param {string} policyArn
 * @param {Object} report
 * @returns {Promise<Object>}
 */
Policy.prototype.update = function update(awsIAM, policyArn, report) {
  report = report || {};
  const initTime = process.hrtime();

  return awsIAM.listPolicyVersions({ PolicyArn: policyArn }).promise()
  .then(data => {
    report.policyVersions = data.Versions.length;
    if (data.Versions.length < 5) {
      // If the policy has less than 5 versions, we can create a new version
      report.deployTime = process.hrtime(initTime);
      return this.createPolicyVersion(awsIAM, policyArn);
    } else {
      // If the policy already has 5 versions, we have to delete the oldest one
      // Look for the smallest version number
      const minVersion = _.reduce(data.Versions, function(result, value, key) {
        if (value.IsDefaultVersion || value.VersionId > result) {
          return result;
        }
        return value.VersionId;
      }, Infinity);
      report.deletedVersion = minVersion;
      const params = {
        PolicyArn: policyArn,
        VersionId: minVersion
      };
      return awsIAM.deletePolicyVersion(params).promise()
      .then(data => {
        return this.createPolicyVersion(awsIAM, policyArn);
      })
      .then(r => {
        report.deployTime = process.hrtime(initTime);
        return Promise.resolve(r);
      });
    }
  });
};

/**
 * Create a new policy version in AWS
 * @param {AWS.IAM} awsIAM
 * @param {string} policyArn
 * @returns {Promise<Object>}
 */
Policy.prototype.createPolicyVersion = function(awsIAM, policyArn) {
  var params = {
    PolicyArn: policyArn,
    PolicyDocument: JSON.stringify(this.document),
    SetAsDefault: true
  };
  return awsIAM.createPolicyVersion(params).promise();
};

module.exports = Policy;
