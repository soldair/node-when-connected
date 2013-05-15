
[![Build Status](https://secure.travis-ci.org/soldair/node-when-connected.png)](http://travis-ci.org/soldair/node-when-connected)

when-connected
=============

perform a callback when "connected" or fire callback with timeout error if its taken too long.

the most important thing this does is provides you with the errors required to manage callback and stream disconnection in necessary ways.

example
=======

this lib is generic and ensures that wrapped calls are only made when connected.
these examples use multilevel a package used to interact with leveldb over the network but it is not the only reason this is useful. 


```js
var mulitlevel = require('multilevel');
var reconnect = require('reconnect');
var whenConnected = require('when-connected')

var client;
var recon = reconnect(function(stream){
  client = multilevel.client();
  stream.pipe(client).pipe(stream); 
}).connect(PORT);

var get = whenConnected(function(key,cb){
  client.get(key,cb);
},{reconnect:recon});
 
var dumpDB = whenConnected(function(){
  return client.createReadStream();
},{reconnect:recon,stream:true});

// get a key.
get('a',function(err,data){
  console.log('get called back');
});

var dump = dumpDB();
// output a db dump.
dump.on('data',function(data){
  console.log('db: ',data);
});

```

api
===

this exports one function.

```js
whenConnected([the function to call when connected],[options])
```

options
-------

- reconnect
    - an EventEmitter that provides two events [connect],[disconnect] and has a [connected] property which will be used to understand the inital state of the connection.
    - if no reconnect is passed this will still work but about the only other useful thing it provides is timeout callbacks.
- stream
    - required if the wrapped method returns a stream.
    - TODO duplex. if anyone needs it.
- timeout
    - optional default -1 / no timeout
    - a maximum numbner of miliseconds to wait for... 
    - any callback method to call back
    - or any stream method to get called and return a stream
    - the error object will have a [code] property that equals 'E_TIMEDOUT'
- retries
    - optional default 0
    - the number of times the wrapped call should be retried if a 'disconnect' event is fired before the callback is complete.
    - this does not increase the timeout for the call.
    - if retires is exceded or not provided any disconnect while waiting for a call will callback with an E_DISCONNECT error


errors
------
error objects returned by this lib all have a code proerty that is one of these values. they are either emitted as errors onn streams or passed as the error to a callback.

- E_TIMEDOUT
    - the time for callback to be called excedes specified value.
    - the time to get a connection to a method that returns a stream took to long to get a connection.
- E_DISCONNECT
    - a disconnect event has been fired while a callback was pending.
    - a disconnect event was fired before the end event was triggered on a stream.
- E_NOTSTREAM
    - a method defined as returns streams did not return a stream. this is emitted on the proxy stream you have a handle too so bind error

