'use strict';

module.exports = function(input, cb) {

  cb(null, {
    'msg': 'This message is being sent from Amazon Lambda',
    'providen-input': input
  });

};
