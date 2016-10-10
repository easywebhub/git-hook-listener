 const bl = require('bl')
 crypto = require('crypto'),
     bufferEq = require('buffer-equal-constant-time'),
     options = require("../config")

 function signBlob(key, blob) {
     return 'sha1=' + crypto.createHmac('sha1', key).update(blob).digest('hex')
 }

 exports.verifyHmac = function (req, res, next) {
     // then calculate HMAC-SHA1 on the content.
     var sig = req.headers['x-hub-signature'];
     if (!sig) {
         next();
     }
     req.pipe(bl(function (err, data) {

         if (err) {
             //return hasError(err.message)
             console.log(err.message)
         }

         var obj
         if (sig) {
             var computedSig = new Buffer(signBlob(options.secret, data))
             var sigb = new Buffer(sig);
             if (!bufferEq(new Buffer(sig), computedSig))
             //return hasError('X-Hub-Signature does not match blob signature')
                 console.log("'X-Hub-Signature does not match blob signature'");
         }
     }))
     next();
 }