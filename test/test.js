var test = require('tap').test;
var through = require('through');
var wc = require('../index');
var EventEmitter = require('events').EventEmitter;

test("can callback",function(t){
  var a = wc(function(cb){
    cb(false,1);
  })

  a(function(err,data){
    t.ok(!err,'should not have error');
    t.equals(data,1,'datra should be 1');
    t.end();
  });

});


test("can get timeout error",function(t){

  t.plan(2);
  var calls = 0;
  var a = wc(function(cb){
    setTimeout(function(){
      cb(false,1);
      t.equals(calls,1,'on timeout should have only called once');
    },10);
  },{timeout:1})

  a(function(err,data){
    calls++
    t.ok(err,'should have timeout error');
  });

});

test("can stream",function(t){
  t.plan(1);

  var a = wc(function(){
    var s = through();
    process.nextTick(function(){
      s.write('hi');
      s.end(); 
    });
    return s;
  },{timeout:1,stream:true});

  var stream = a();
  var out = '';
  stream.on('data',function(data){
    out += data;
  });

  stream.on('end',function(){
    t.equals(out,'hi','should have said hi through stream.');
  });

});


test("callback gets disconnected",function(t){

  t.plan(1);

  var recon = new EventEmitter();
  var a = wc(function(cb){
    recon.emit('disconnect');
  },{reconnect:recon});

  a(function(err,data){
    t.ok(err,' should have called back with error if disconnected while waiting for callback.');
  });
  recon.emit('connect');

});

test("callback gets re-tried",function(t){
   t.plan(2);

  var count = 0;
  var recon = new EventEmitter();
  var a = wc(function(cb){
    count++;
    if(count === 1) {
      recon.emit('disconnect');
      process.nextTick(function(){
        recon.emit('connect');
      });
    } else cb(false,'yay!');
  },{reconnect:recon,retries:1});

  a(function(err,data){
    
    t.ok(!err,' should not have error because retry.');
    t.equals(count,2,' should have hit method twice');
  });

  recon.emit('connect');

 
});


