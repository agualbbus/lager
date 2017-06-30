'use strict';

const os = require('os');
const path = require('path');
const Promise = require('bluebird');
const exec = Promise.promisify(require('child_process').exec);
const fs = require('fs-extra');
const archiver = require('archiver');
const AWS = require('aws-sdk');
const plugin = require('../index');
const s3 = new AWS.S3();

module.exports = function buildLambdaPackageHook(lambda, context, codeParams) {
  const packagerIdentifier = plugin.myrmex.getConfig('packager.lambdaIdentifier');

  // Shortcut: the Lambda of the packager must be deployed with the default packager of the plugin @myrmex/lambda
  if (lambda.getIdentifier() === packagerIdentifier) {
    return Promise.resolve();
  }

  let packageName = context.environment ? context.environment + '_' : '';
  packageName += lambda.getIdentifier();
  packageName += context.alias ? '_' + context.alias : '';

  const sourcesPath = path.join(os.tmpdir(), 'lambda-packages', packageName);
  const zipPath = sourcesPath + '.zip';

  // Remove previous content
  return fs.remove(sourcesPath)
  .then(() => {
    // Create a folder to put the Lambda sources
    fs.mkdirp(sourcesPath);
  })
  .then(() => {
    // Copy sources
    return fs.copy(lambda.getFsPath(), sourcesPath, { filter: copyFilter });
  })
  .then(() => {
    // Install dependencies
    return install(sourcesPath, lambda.getRuntime());
  })
  .then(output => {
    if (plugin.myrmex.getConfig('packager.docker.showStdout')) {
      plugin.myrmex.call('cli:print', output);
    }
    // Create zip of the Lambda (without installing dependencies)
    return archive(sourcesPath, zipPath);
  })
  .then(zipData => {
    if (plugin.myrmex.getConfig('packager.bucket')) {
      // Upload zip to S3
      var params = {
        Body: zipData,
        Bucket: plugin.myrmex.getConfig('packager.bucket'),
        Key: packageName + '.zip'
      };
      return putObject(params)
      .then(response => {
        // Retrieve the location of the final zip on S3
        codeParams.S3Bucket = plugin.myrmex.getConfig('packager.bucket');
        codeParams.S3Key = packageName + '.zip';
        return codeParams;
      });
    }
    return { ZipFile: zipData };
  });
};

const exclusions = ['node_modules'];
function copyFilter(src) {
  let includePath = true;
  exclusions.forEach(excludedPath => {
    if (src.substr(-excludedPath.length) === excludedPath) {
      includePath = false;
    }
  });
  return includePath;
}

function install(sourcesPath, runtime) {
  const uid = process.getuid();
  const gid = process.getgid();
  let cmd = plugin.myrmex.getConfig('packager.docker.useSudo') ? 'sudo ' : '';
  cmd += 'docker run --rm -v ' + sourcesPath + ':/data';
  if (runtime === 'nodejs4.3') { cmd += ' -e RUNTIME=node4'; }
  if (uid) { cmd += ' -e HOST_UID=' + uid; }
  if (gid) { cmd += ' -e HOST_GID=' + gid; }
  cmd += ' myrmex/lambda-packager';
  if (plugin.myrmex.getConfig('packager.docker.showStdout')) {
    const printCmd = plugin.myrmex.call('cli:format', 'cmd', cmd);
    plugin.myrmex.call('cli:print', '\nPackage installation:\n    ' + printCmd + '\n');
  }
  return exec(cmd);
}

function archive(origPath, archivePath) {
  return new Promise((resolve, reject) => {
    const outputStream = fs.createWriteStream(archivePath);
    const archive = archiver.create('zip', {});
    outputStream.on('close', () => {
      fs.readFile(archivePath, (e, data) => {
        if (e) { return reject(e); }
        resolve(data);
      });
    });

    archive.on('error', e => {
      reject(e);
    });

    archive.pipe(outputStream);

    // Add the Lamba code to the archive
    archive.directory(origPath, '');

    archive.finalize();
  });
}


function putObject(params) {
  return s3.putObject(params).promise()
  .catch(e => {
    // If the bucket does not exists, we create it
    if (e.code === 'NoSuchBucket') {
      return s3.createBucket({ Bucket: params.Bucket }).promise()
      .then(() => {
        return putObject(params);
      });
    }
    return Promise.reject(e);
  });
}