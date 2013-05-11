
var multilevel = require('multilevel');
var reconnect  = require('reconnect');
var through = require('through');

var dbs = require('./dbs.json');


module.exports = function MultilevelReconnectingClient(db,opts){
  var o = {
    // options.
    _opts:opts,
    // handle to multilevel
    _db:false,
    //
    // call queue for put/del/get/batch
    _queue:{},
    //
    // if ended do not reconnect
    _ended:false,
    //
    // if a connection is closed or errors in any way that the callback is never fired then we might leak closures.
    // the question must be presented to the application layer. what to do in the case where the callback is never fired?
    // E_TIMEDOUT
    _timeout:opts.timeout||10000,
    // 
    // if the connection goes down whilst an opperation is pending how many times should it be retried.
    // in the case of get/put/batch the opperations can be buffered and sent after configure retries.
    // E_DISCONNECT
    _retries:opts.retries||1,
    //
    // in the case of a stream as suggested in https://github.com/juliangruber/multilevel/issues/9 by dominic tarr you could just continue the stream where you left off.
    // i dont think you can to worry about the case where the source data of the range query is updated at the end or updated in the middle
    // level db uses read consistant views for all streams so even if you insert a value that would be sorted after the current seek position in the stream it will not be returned.
    _streamRetries:opts.streamRetries||1,
    //
    // the handle to the reconnect object.
    _reconnect:false,
    //
    // this queues proxied method calls for reconnection etc.
    _queue:function(method,args){
      // set timer
    },
    //
    // this pipes multilevel streams to output streams is a way where i can handle a disconnect error
    // on disconnect depending on streamRetries i will either emit error or after a reconnect wait bounded by timeout i will continue the range.
    // on the real end of the stream i will end
    _pipe:function(multilevelStream,outStream){
      multiLevelStream.on('error',function(err)({
        // disconnected? or to have have to wait for 
        //process.nextTick
        // to find out for sure.
        outStream.emit('error',err);
      });
      return multilevelStream.pipe(outStream,{end:false})
    },
    //
    // starts level db methods.
    isOpen:function(){
      if(!this._db) return false;
      return this._db.isOpen();
    },
    close:function(){
      this._ended = true;
      // levelup style.
      if(this._db) this._db.end();
    },
    open:function(netOptions){
      netOptions = netOptions||{};
      netOptions.port = netOptions.port||this._opts.port;
      netOptions.host = netOptions.host||this._opts.host;
      netOptions.auth = netOptions.auth||this._opts.auth;// user+password key or nested object of auth?
      // compare net options.
      // if net options match and 
      if(!this._ended && this._opts.port !== netOptions.port || this._opts.host !== netOptions.host){
        this.close();
      }

      if(this._ended) {
        this._ended = false;
        this._reconnect();
      }
    },
    sublevel:function(){
      //
      throw "not implemented";
      // sub level should get all of the same ququeing but share the connection.
      // i dont use them right now so i cant take the time right now to implement this.
      //return MultilevelReconnectingClient(this._db.sublevel.apply(this._db,arguments),opts);
    }
  };

  [
    'get',
    'put',
    'del',
    'batch',
    'aproximateSize' 
  ].forEach(function(m){
    o[m] = methods(m);
  });

  [
    'createKeyStream',
    'createValueStream',
    'createReadStream'
  ].forEach(function(m){
    o[m] = methods(m,true);
  });

  function methods(m,stream){
    return function(){

      if(o._ended) // hmm?....

      var s;
      if(stream) {
        s = through();
      } else if(typeof arguments[arguments.length-1] === 'function') {
        var cb = arguments[arguments.length-1];
        var timer = setTimeout(function(){
          var e = new Error('E_TIMEDOUT '+m+' for timed out');
          e,code = 'E_TIMEDOUT'
          cb(e);
          cb = function(){};
        },this._timeout);
        
        // wrap callback to implement timeout.
        arguments[arguments.length-1] = function(err,data){
          clearTimeout(timer);
          return cb(err,data);
        };
      }

      if(!o.isOpen()) {
        o._queue(m,arguments,s);
      } else {
        var retStream = o._db.apply(o._db,arguments);
        //TODO reconnect streams.
        o._pipe(retStreams,s);
      }

      return s;
    }
  }

  return o;
};


module.exports.connect = getConnection;

var clients = {};
var queue = {};

function getConnection(netOptions,cb){

  if(queue[name]){
      return queue[name].push(cb);
  }

  if(clients[name]) {
    return cb(false,clients[name]);
  }

  queue[name] = [cb];
  var connect = true;

  var recon = reconnect(function(stream){
    if(clients[name]){
      clients[name].destroy();
    }
    clients[name] = multilevel.client();

    if(!connect){
      console.log('reconnect multilevel: ',name);
    } else {
      console.log('connected multilevel: ',name);
    }

    clients[name].on('error',function(){

      console.log(name,'CLIENT Errored!! ',this);

    }).on('end',function(){

      console.log(name,'CLIENT ENDED!! ',this);
      delete clients[name];
      stream.end();

    });

    stream.pipe(clients[name]).pipe(stream);

    if(connect) {
      connect = false;
      while(queue[name].length) queue[name].shift()(false,clients[name]); 
    }

  }).connect(netOptions.port,netOptions.host);
  
  recon.on('disconnect',function(){ 
    console.log('disconnected multilevel: ',name);
    clients.end();
    delete clients[name];
  });

  return recon;
}


