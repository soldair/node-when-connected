var through = require('through');
var binarysearch = require('binarysearch');

module.exports = function(fn,opts){
  var q = [],connected = true,i = 0;
  opts = opts||{};
  if(opts.reconnect){
    connected = opts.reconnect.connected;
    opts.reconnect.on('connect',function(){
      connected = true;
      while(q.length) {
        run(fn,q.shift())
      } 
    }).on('disconnect',function(){
      connected = false;
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
    var data = {a:args,t:timeout,s:s,v:i++};
    if(connected) run(fn,data);
    else q.push(data)
    return s;
  }

  // expose queue for external inspection.
  ret.q = q;

  return ret;
}


module.exports.timeout = -1;

function run(fn,args) {
  var stream = args.s
  , timer = args.t
  , args = args.a
  ;

  if(typeof args[args.length-1] === 'function') {
    var cb = args[args.length-1];
    args[args.length-1] = function(){
      // already timed out.
      if(!args[args.length-1]) return false;

      // close timer.
      clearTimeout(timer);
      cb.apply(this,arguments);
    }
  }

  var res = fn.apply(null,args);
  if(stream) {
    clearTimeout(timer);
    if(res) {

      res.on('error',function(e){
        stream.emit('error',e);
      });

      res.pipe(stream);

    } else {
      var e = new Error('E_NOTSTREAM function did not return a stream but stream was expected. '+fn.toString());
      e.code = 'E_NOTSTREAM';
      stream.emit('error',e);
    }
  }
}

function noop(){}
