
[![Build Status](https://secure.travis-ci.org/soldair/node-when-connected.png)](http://travis-ci.org/soldair/node-when-connected)

when-connected
=============

perform a callback when "connected" or fire callback with timeout error if its taken too long.

example
=======

```js
var reconnect = require('reconnect');
var whenConnected = require('when-connected');

var stream;
var recon = reconnect(function(s){
  stream = s;
}).connect(PORT);

var obj = {}

obj.write = whenConnected(function(message,cb){
  cb(false,s.write(message));
},{reconnect:recon,timeout:1000});

obj.write('data',function(err,data){
  if(err) {
    if( err.code === 'E_TIMEDOUT'){
      // it took longer than the specified timeout to connect and fire the callback.
    } else {
      // i got connected but there was a normal error performing action.
    }
  } else {
    console.log('i wrote data!');
  }
});

```

streams example

```js



```


