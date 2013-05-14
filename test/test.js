var test = require('tap').test;
var through = require('through');
var wc = require('../index');

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
    console.log('getting stream');
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
    t.equals(out,'hi','should have said hi though stream.');
  });

});

