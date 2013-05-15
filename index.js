var through = require('through');
var binarysearch = require('binarysearch');

module.exports = function(fn,opts){

  var q = [],pending = {},connected = true,i = 0;
  opts = opts||{};

  if(opts.reconnect) {
    connected = opts.reconnect.connected;
    opts.reconnect.on('connect',function(){
      connected = true;
      while(q.length) {
        run(fn,q.shift());
      } 
    }).on('disconnect',function(){

      connected = false;
      // methods that get callbacks are included in pending.
      // streams handle disconects themselves by either getting an error or checking if end was from a disconnect
      Object.keys(pending).forEach(function(k){
        // if i have retries and retries available retry.
        if(opts.retries && opts.retries > pending[k].r) {
          // assign new id and requeue.
          pending[k].v = ++i;
          pending[k].r++;
          q.push(pending[k]);
        } else {
          var e = new Error('E_DISCONNECT connection terminated before callback was called back.');
          e.code = 'E_DISCONNECT';
          var args = pending[k].a;
          if(typeof args[args.length-1] === 'function') {
            args[args.length-1](e);
          }
        }
        // make sure its deleted
        delete pending[k];
      });
    });
  }

  var ret = function(){
    var s;
    if(opts.stream) s = through();
    var args = arguments,timeout,id = i++;
    if(module.exports.timeout && !opts.timeout) {
      // a global tiumeout has been provided.
      opts.timeout = module.exports.timeout;
    }

    if(opts.timeout > -1) {
      timeout = setTimeout(function(){

        var e = new Error("E_TIMEDOUT callback took too long to fire or it took too long to connect. "+id);
        e.code = "E_TIMEDOUT";

        if(typeof args[args.length-1] === 'function'){
          args[args.length-1](e);
          args[args.length-1] = false;
        }

        if(s){
          s.emit('error',e);
        }//else no way to let you know.

        if(!connected) {
          var index = binarysearch(q,id);
          if(index > -1) q.splice(index,1);
        }
 
      },opts.timeout);
    }
    // binary search defaults to looking for a v key in objects as the sorted value.
    var data = {a:args,t:timeout,s:s,v:i++,r:0};
    if(connected) run(fn,data,pending);
    else q.push(data)
    return s;
  }

  // expose queue for external inspection.
  ret.q = q;

  function run(fn,data) {
    var stream = data.s
    , timer = data.t
    , args = data.a
    , id = data.v
    ;

    if(typeof args[args.length-1] === 'function') {
      var cb = args[args.length-1];
      args[args.length-1] = function(){
        delete pending[data.v];
        // already timed out.
        if(!args[args.length-1]) return false;

        // close timer.r
        clearTimeout(timer);
        cb.apply(this,arguments);
      }

      pending[id] = data;

    }

    var res = fn.apply(null,args);

    if(stream) {
      clearTimeout(timer);
      if(res) {

        var errored = false;
        res.on('end',function(){
          if(!connected && !errored) {
            // i was disconnected before end event
            var e = new Error('E_DISCONNECT connection terminated before stream end. you probably did not get all of the data');
            e.code = 'E_DISCONNECT';
            res.emit('error',e);
          }
          stream.end();
        }).on('error',function(e){
          errored = true;
          stream.emit('error',e);
        });

        res.pipe(stream,{end:false});
        
      } else {
        var e = new Error('E_NOTSTREAM function did not return a stream but stream was expected. '+fn.toString());
        e.code = 'E_NOTSTREAM';
        stream.emit('error',e);
      }
    }

  }

  return ret;
}

module.exports.timeout = -1;

