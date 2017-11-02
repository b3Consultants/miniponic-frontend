// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function shell_read() { throw 'no read() available' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    }
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function shell_print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function shell_printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}
if (!Module['quit']) {
  Module['quit'] = function(status, toThrow) {
    throw toThrow;
  }
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
    return value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      assert(args.length == sig.length-1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      assert(sig.length == 1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16);(assert((((STACKTOP|0) < (STACK_MAX|0))|0))|0); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + (assert(!staticSealed),size))|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { assert(DYNAMICTOP_PTR);var ret = HEAP32[DYNAMICTOP_PTR>>2];var end = (((ret + size + 15)|0) & -16);HEAP32[DYNAMICTOP_PTR>>2] = end;if (end >= TOTAL_MEMORY) {var success = enlargeMemory();if (!success) {HEAP32[DYNAMICTOP_PTR>>2] = ret;return 0;}}return ret;},
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = Runtime.stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface.
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    assert(returnType !== 'array', 'Return type should not be "array".');
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if ((!opts || !opts.async) && typeof EmterpreterAsync === 'object') {
      assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling ccall');
    }
    if (opts && opts.async) assert(!returnType, 'async ccalls cannot return values');
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }

  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    funcstr += "if (typeof EmterpreterAsync === 'object') { assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling cwrap') }";
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var __cxa_demangle_func = Module['___cxa_demangle'] || Module['__cxa_demangle'];
  if (__cxa_demangle_func) {
    try {
      var s =
        func.substr(1);
      var len = lengthBytesUTF8(s)+1;
      var buf = _malloc(len);
      stringToUTF8(s, buf, len);
      var status = _malloc(4);
      var ret = __cxa_demangle_func(buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - Module['asm'].stackSave() + allocSize) + ' bytes available!');
}

function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  Runtime.warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = Runtime.GLOBAL_BASE;

STATICTOP = STATIC_BASE + 38144;
/* global initializers */  __ATINIT__.push();


/* memory initializer */ allocate([0,0,0,0,0,0,212,63,72,123,0,0,204,123,0,0,112,123,0,0,212,123,0,0,16,0,0,0,0,0,0,0,0,0,0,0,0,0,24,64,0,0,0,0,0,0,8,64,0,0,0,0,0,0,176,191,0,0,0,0,0,0,176,63,0,0,0,0,0,0,224,63,0,0,0,0,0,0,224,63,0,0,0,0,0,0,176,63,0,0,0,0,0,0,176,191,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,64,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,224,191,0,0,0,0,0,0,224,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,224,63,0,0,0,0,0,0,224,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,24,64,0,0,0,0,0,0,0,64,0,0,0,0,0,0,176,191,0,0,0,0,0,0,176,191,0,0,0,0,0,0,224,63,0,0,0,0,0,0,224,191,0,0,0,0,0,0,176,63,0,0,0,0,0,0,176,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,34,64,0,0,0,0,0,0,20,64,49,8,172,28,90,100,155,63,164,54,113,114,191,67,145,191,131,163,228,213,57,6,180,191,106,19,39,247,59,20,209,63,65,241,99,204,93,75,227,63,106,19,39,247,59,20,209,63,131,163,228,213,57,6,180,191,164,54,113,114,191,67,145,191,49,8,172,28,90,100,155,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,34,64,0,0,0,0,0,0,20,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,147,29,27,129,120,93,167,63,75,118,108,4,226,117,157,191,178,99,35,16,175,235,210,191,101,199,70,32,94,215,225,63,178,99,35,16,175,235,210,191,75,118,108,4,226,117,157,191,147,29,27,129,120,93,167,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,28,64,0,0,0,0,0,0,16,64,147,29,27,129,120,93,167,191,75,118,108,4,226,117,157,191,178,99,35,16,175,235,210,63,101,199,70,32,94,215,225,63,178,99,35,16,175,235,210,63,75,118,108,4,226,117,157,191,147,29,27,129,120,93,167,191,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,34,64,0,0,0,0,0,0,16,64,49,8,172,28,90,100,155,63,164,54,113,114,191,67,145,63,131,163,228,213,57,6,180,191,106,19,39,247,59,20,209,191,65,241,99,204,93,75,227,63,106,19,39,247,59,20,209,191,131,163,228,213,57,6,180,191,164,54,113,114,191,67,145,63,49,8,172,28,90,100,155,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,64,0,0,0,0,0,0,240,63,34,46,44,116,61,219,213,63,160,10,22,186,158,237,226,63,187,163,167,23,133,73,196,63,6,85,176,208,245,108,183,191,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,64,0,0,0,0,0,0,240,63,6,85,176,208,245,108,183,191,187,163,167,23,133,73,196,191,160,10,22,186,158,237,226,63,34,46,44,116,61,219,213,191,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,64,0,0,0,0,0,0,240,63,34,46,44,116,61,219,213,63,160,10,22,186,158,237,226,63,187,163,167,23,133,73,196,63,6,85,176,208,245,108,183,191,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,64,0,0,0,0,0,0,240,63,6,85,176,208,245,108,183,191,187,163,167,23,133,73,196,191,160,10,22,186,158,237,226,63,34,46,44,116,61,219,213,191,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,240,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,240,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,20,64,0,0,0,0,0,0,8,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,208,63,0,0,0,0,0,0,224,191,0,0,0,0,0,0,208,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,64,0,0,0,0,0,0,240,63,0,0,0,0,0,0,208,63,0,0,0,0,0,0,224,63,0,0,0,0,0,0,208,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,240,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,240,63], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
/* memory initializer */ allocate([112,123,0,0,217,123,0,0,24,0,0,0,0,0,0,0,112,123,0,0,230,123,0,0,16,0,0,0,0,0,0,0,112,123,0,0,235,123,0,0,16,0,0,0,0,0,0,0,72,123,0,0,81,134,0,0,112,123,0,0,177,134,0,0,112,120,0,0,0,0,0,0,112,123,0,0,94,134,0,0,128,120,0,0,0,0,0,0,72,123,0,0,127,134,0,0,112,123,0,0,140,134,0,0,96,120,0,0,0,0,0,0,112,123,0,0,212,135,0,0,88,120,0,0,0,0,0,0,112,123,0,0,225,135,0,0,88,120,0,0,0,0,0,0,112,123,0,0,241,135,0,0,168,120,0,0,0,0,0,0,112,123,0,0,38,136,0,0,112,120,0,0,0,0,0,0,112,123,0,0,2,136,0,0,200,120,0,0,0,0,0,0,100,0,0,0,1,0,0,0,200,0,0,0,0,0,0,0,16,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,24,0,0,0,3,0,0,0,4,0,0,0,0,0,0,0,40,120,0,0,5,0,0,0,6,0,0,0,0,0,0,0,56,120,0,0,7,0,0,0,8,0,0,0,0,0,0,0,72,120,0,0,9,0,0,0,10,0,0,0,72,121,0,0,5,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,13,0,0,0,248,144,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,192,144,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,13,0,0,0,0,145,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,184,122,0,0,15,0,0,0,72,134,0,0,0,0,0,0,96,120,0,0,16,0,0,0,17,0,0,0,18,0,0,0,19,0,0,0,20,0,0,0,21,0,0,0,22,0,0,0,23,0,0,0,0,0,0,0,136,120,0,0,16,0,0,0,24,0,0,0,18,0,0,0,19,0,0,0,20,0,0,0,25,0,0,0,26,0,0,0,27,0,0,0,0,0,0,0,152,120,0,0,28,0,0,0,29,0,0,0,30,0,0,0,0,0,0,0,168,120,0,0,31,0,0,0,32,0,0,0,33,0,0,0,0,0,0,0,184,120,0,0,31,0,0,0,34,0,0,0,33,0,0,0,54,83,105,103,110,97,108,0,51,70,87,84,0,49,48,69,99,103,68,101,110,111,105,115,101,0,51,67,87,84,0,49,51,69,99,103,65,110,110,111,116,97,116,105,111,110,0,97,108,108,111,99,97,116,111,114,60,84,62,58,58,97,108,108,111,99,97,116,101,40,115,105,122,101,95,116,32,110,41,32,39,110,39,32,101,120,99,101,101,100,115,32,109,97,120,105,109,117,109,32,115,117,112,112,111,114,116,101,100,32,115,105,122,101,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,45,43,32,32,32,48,88,48,120,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,46,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0,118,101,99,116,111,114,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,58,32,37,115,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,102,111,114,101,105,103,110,32,101,120,99,101,112,116,105,111,110,0,116,101,114,109,105,110,97,116,105,110,103,0,117,110,99,97,117,103,104,116,0,83,116,57,101,120,99,101,112,116,105,111,110,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,54,95,95,115,104,105,109,95,116,121,112,101,95,105,110,102,111,69,0,83,116,57,116,121,112,101,95,105,110,102,111,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,48,95,95,115,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,112,116,104,114,101,97,100,95,111,110,99,101,32,102,97,105,108,117,114,101,32,105,110,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,95,102,97,115,116,40,41,0,99,97,110,110,111,116,32,99,114,101,97,116,101,32,112,116,104,114,101,97,100,32,107,101,121,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,99,97,110,110,111,116,32,122,101,114,111,32,111,117,116,32,116,104,114,101,97,100,32,118,97,108,117,101,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,116,101,114,109,105,110,97,116,101,95,104,97,110,100,108,101,114,32,117,110,101,120,112,101,99,116,101,100,108,121,32,114,101,116,117,114,110,101,100,0,116,101,114,109,105,110,97,116,101,95,104,97,110,100,108,101,114,32,117,110,101,120,112,101,99,116,101,100,108,121,32,116,104,114,101,119,32,97,110,32,101,120,99,101,112,116,105,111,110,0,115,116,100,58,58,98,97,100,95,97,108,108,111,99,0,83,116,57,98,97,100,95,97,108,108,111,99,0,83,116,49,49,108,111,103,105,99,95,101,114,114,111,114,0,83,116,49,50,108,101,110,103,116,104,95,101,114,114,111,114,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,57,95,95,112,111,105,110,116,101,114,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,112,98,97,115,101,95,116,121,112,101,95,105,110,102,111,69,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+30752);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


   
  Module["_i64Subtract"] = _i64Subtract;

   
  Module["_i64Add"] = _i64Add;

  
  function __ZSt18uncaught_exceptionv() { // std::uncaught_exception()
      return !!__ZSt18uncaught_exceptionv.uncaught_exception;
    }
  
  
  
  var EXCEPTIONS={last:0,caught:[],infos:{},deAdjust:function (adjusted) {
        if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
        for (var ptr in EXCEPTIONS.infos) {
          var info = EXCEPTIONS.infos[ptr];
          if (info.adjusted === adjusted) {
            return ptr;
          }
        }
        return adjusted;
      },addRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount++;
      },decRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        assert(info.refcount > 0);
        info.refcount--;
        // A rethrown exception can reach refcount 0; it must not be discarded
        // Its next handler will clear the rethrown flag and addRef it, prior to
        // final decRef and destruction here
        if (info.refcount === 0 && !info.rethrown) {
          if (info.destructor) {
            Module['dynCall_vi'](info.destructor, ptr);
          }
          delete EXCEPTIONS.infos[ptr];
          ___cxa_free_exception(ptr);
        }
      },clearRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount = 0;
      }};
  function ___resumeException(ptr) {
      if (!EXCEPTIONS.last) { EXCEPTIONS.last = ptr; }
      throw ptr;
    }function ___cxa_find_matching_catch() {
      var thrown = EXCEPTIONS.last;
      if (!thrown) {
        // just pass through the null ptr
        return ((Runtime.setTempRet0(0),0)|0);
      }
      var info = EXCEPTIONS.infos[thrown];
      var throwntype = info.type;
      if (!throwntype) {
        // just pass through the thrown ptr
        return ((Runtime.setTempRet0(0),thrown)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      var pointer = Module['___cxa_is_pointer_type'](throwntype);
      // can_catch receives a **, add indirection
      if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
      HEAP32[((___cxa_find_matching_catch.buffer)>>2)]=thrown;
      thrown = ___cxa_find_matching_catch.buffer;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        if (typeArray[i] && Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)) {
          thrown = HEAP32[((thrown)>>2)]; // undo indirection
          info.adjusted = thrown;
          return ((Runtime.setTempRet0(typeArray[i]),thrown)|0);
        }
      }
      // Shouldn't happen unless we have bogus data in typeArray
      // or encounter a type for which emscripten doesn't have suitable
      // typeinfo defined. Best-efforts match just in case.
      thrown = HEAP32[((thrown)>>2)]; // undo indirection
      return ((Runtime.setTempRet0(throwntype),thrown)|0);
    }function ___cxa_throw(ptr, type, destructor) {
      EXCEPTIONS.infos[ptr] = {
        ptr: ptr,
        adjusted: ptr,
        type: type,
        destructor: destructor,
        refcount: 0,
        caught: false,
        rethrown: false
      };
      EXCEPTIONS.last = ptr;
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exception = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exception++;
      }
      throw ptr;
    }

   
  Module["_memset"] = _memset;

   
  Module["_bitshift64Shl"] = _bitshift64Shl;

  function _abort() {
      Module['abort']();
    }

  
  function ___cxa_free_exception(ptr) {
      try {
        return _free(ptr);
      } catch(e) { // XXX FIXME
        Module.printErr('exception during cxa_free_exception: ' + e);
      }
    }function ___cxa_end_catch() {
      // Clear state flag.
      Module['setThrew'](0);
      // Call destructor if one is registered then clear it.
      var ptr = EXCEPTIONS.caught.pop();
      if (ptr) {
        EXCEPTIONS.decRef(EXCEPTIONS.deAdjust(ptr));
        EXCEPTIONS.last = 0; // XXX in decRef?
      }
    }


  function _pthread_once(ptr, func) {
      if (!_pthread_once.seen) _pthread_once.seen = {};
      if (ptr in _pthread_once.seen) return;
      Module['dynCall_v'](func);
      _pthread_once.seen[ptr] = 1;
    }

  function ___lock() {}

  function ___unlock() {}

  
  var PTHREAD_SPECIFIC={};function _pthread_getspecific(key) {
      return PTHREAD_SPECIFIC[key] || 0;
    }

  function _llvm_stackrestore(p) {
      var self = _llvm_stacksave;
      var ret = self.LLVM_SAVEDSTACKS[p];
      self.LLVM_SAVEDSTACKS.splice(p, 1);
      Runtime.stackRestore(ret);
    }

  
  var PTHREAD_SPECIFIC_NEXT_KEY=1;
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _pthread_key_create(key, destructor) {
      if (key == 0) {
        return ERRNO_CODES.EINVAL;
      }
      HEAP32[((key)>>2)]=PTHREAD_SPECIFIC_NEXT_KEY;
      // values start at 0
      PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
      PTHREAD_SPECIFIC_NEXT_KEY++;
      return 0;
    }

  function _pthread_setspecific(key, value) {
      if (!(key in PTHREAD_SPECIFIC)) {
        return ERRNO_CODES.EINVAL;
      }
      PTHREAD_SPECIFIC[key] = value;
      return 0;
    }

  function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

  function ___cxa_find_matching_catch_2() {
          return ___cxa_find_matching_catch.apply(null, arguments);
        }

  function ___cxa_find_matching_catch_3() {
          return ___cxa_find_matching_catch.apply(null, arguments);
        }

  function ___cxa_begin_catch(ptr) {
      var info = EXCEPTIONS.infos[ptr];
      if (info && !info.caught) {
        info.caught = true;
        __ZSt18uncaught_exceptionv.uncaught_exception--;
      }
      if (info) info.rethrown = false;
      EXCEPTIONS.caught.push(ptr);
      EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
      return ptr;
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  
  var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_STATIC); 
  Module["_llvm_cttz_i32"] = _llvm_cttz_i32; 
  Module["___udivmoddi4"] = ___udivmoddi4; 
  Module["___udivdi3"] = ___udivdi3;

  var _llvm_pow_f64=Math_pow;

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else Module.printErr('failed to set errno from JS');
      return value;
    } 
  Module["_sbrk"] = _sbrk;

  function _llvm_stacksave() {
      var self = _llvm_stacksave;
      if (!self.LLVM_SAVEDSTACKS) {
        self.LLVM_SAVEDSTACKS = [];
      }
      self.LLVM_SAVEDSTACKS.push(Runtime.stackSave());
      return self.LLVM_SAVEDSTACKS.length-1;
    }

   
  Module["_memmove"] = _memmove;

  function ___gxx_personality_v0() {
    }

   
  Module["___uremdi3"] = ___uremdi3;

   
  Module["_llvm_bswap_i32"] = _llvm_bswap_i32;


  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
/* flush anything remaining in the buffer during shutdown */ __ATEXIT__.push(function() { var fflush = Module["_fflush"]; if (fflush) fflush(0); var printChar = ___syscall146.printChar; if (!printChar) return; var buffers = ___syscall146.buffers; if (buffers[1].length) printChar(1, 10); if (buffers[2].length) printChar(2, 10); });;
DYNAMICTOP_PTR = allocate(1, "i32", ALLOC_STATIC);

STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");


function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiididd(x) { Module["printErr"]("Invalid function pointer called with signature 'iiididd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiidd(x) { Module["printErr"]("Invalid function pointer called with signature 'viiidd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_did(x) { Module["printErr"]("Invalid function pointer called with signature 'did'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vi(x) { Module["printErr"]("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiidi(x) { Module["printErr"]("Invalid function pointer called with signature 'viiidi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vii(x) { Module["printErr"]("Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiidii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiidii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_i(x) { Module["printErr"]("Invalid function pointer called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiid(x) { Module["printErr"]("Invalid function pointer called with signature 'viiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiid(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_v(x) { Module["printErr"]("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiid(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiididd(index,a1,a2,a3,a4,a5,a6) {
  try {
    return Module["dynCall_iiididd"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiidd(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiidd"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_did(index,a1,a2) {
  try {
    return Module["dynCall_did"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiidi(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiidi"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiidii(index,a1,a2,a3,a4,a5,a6) {
  try {
    return Module["dynCall_iiiidii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_i(index) {
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiid(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viiid"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiiid(index,a1,a2,a3,a4,a5,a6) {
  try {
    Module["dynCall_viiiiid"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iiiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiid(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iiiid"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_iiii": nullFunc_iiii, "nullFunc_iiididd": nullFunc_iiididd, "nullFunc_viiidd": nullFunc_viiidd, "nullFunc_did": nullFunc_did, "nullFunc_vi": nullFunc_vi, "nullFunc_viiidi": nullFunc_viiidi, "nullFunc_vii": nullFunc_vii, "nullFunc_iiiidii": nullFunc_iiiidii, "nullFunc_ii": nullFunc_ii, "nullFunc_i": nullFunc_i, "nullFunc_viiid": nullFunc_viiid, "nullFunc_viiiiid": nullFunc_viiiiid, "nullFunc_v": nullFunc_v, "nullFunc_iiiii": nullFunc_iiiii, "nullFunc_viiiiii": nullFunc_viiiiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_iiiid": nullFunc_iiiid, "nullFunc_viiii": nullFunc_viiii, "invoke_iiii": invoke_iiii, "invoke_iiididd": invoke_iiididd, "invoke_viiidd": invoke_viiidd, "invoke_did": invoke_did, "invoke_vi": invoke_vi, "invoke_viiidi": invoke_viiidi, "invoke_vii": invoke_vii, "invoke_iiiidii": invoke_iiiidii, "invoke_ii": invoke_ii, "invoke_i": invoke_i, "invoke_viiid": invoke_viiid, "invoke_viiiiid": invoke_viiiiid, "invoke_v": invoke_v, "invoke_iiiii": invoke_iiiii, "invoke_viiiiii": invoke_viiiiii, "invoke_viiiii": invoke_viiiii, "invoke_iiiid": invoke_iiiid, "invoke_viiii": invoke_viiii, "_llvm_pow_f64": _llvm_pow_f64, "___syscall54": ___syscall54, "_abort": _abort, "___gxx_personality_v0": ___gxx_personality_v0, "_llvm_stackrestore": _llvm_stackrestore, "___cxa_free_exception": ___cxa_free_exception, "___cxa_find_matching_catch_2": ___cxa_find_matching_catch_2, "___cxa_find_matching_catch_3": ___cxa_find_matching_catch_3, "___setErrNo": ___setErrNo, "___cxa_begin_catch": ___cxa_begin_catch, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___cxa_end_catch": ___cxa_end_catch, "___resumeException": ___resumeException, "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv, "_pthread_getspecific": _pthread_getspecific, "_llvm_stacksave": _llvm_stacksave, "_pthread_once": _pthread_once, "_pthread_key_create": _pthread_key_create, "___unlock": ___unlock, "_pthread_setspecific": _pthread_setspecific, "___cxa_throw": ___cxa_throw, "___lock": ___lock, "___syscall6": ___syscall6, "___cxa_allocate_exception": ___cxa_allocate_exception, "___syscall140": ___syscall140, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "___syscall146": ___syscall146, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "cttz_i8": cttz_i8 };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
'almost asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var abortStackOverflow=env.abortStackOverflow;
  var nullFunc_iiii=env.nullFunc_iiii;
  var nullFunc_iiididd=env.nullFunc_iiididd;
  var nullFunc_viiidd=env.nullFunc_viiidd;
  var nullFunc_did=env.nullFunc_did;
  var nullFunc_vi=env.nullFunc_vi;
  var nullFunc_viiidi=env.nullFunc_viiidi;
  var nullFunc_vii=env.nullFunc_vii;
  var nullFunc_iiiidii=env.nullFunc_iiiidii;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_i=env.nullFunc_i;
  var nullFunc_viiid=env.nullFunc_viiid;
  var nullFunc_viiiiid=env.nullFunc_viiiiid;
  var nullFunc_v=env.nullFunc_v;
  var nullFunc_iiiii=env.nullFunc_iiiii;
  var nullFunc_viiiiii=env.nullFunc_viiiiii;
  var nullFunc_viiiii=env.nullFunc_viiiii;
  var nullFunc_iiiid=env.nullFunc_iiiid;
  var nullFunc_viiii=env.nullFunc_viiii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_iiididd=env.invoke_iiididd;
  var invoke_viiidd=env.invoke_viiidd;
  var invoke_did=env.invoke_did;
  var invoke_vi=env.invoke_vi;
  var invoke_viiidi=env.invoke_viiidi;
  var invoke_vii=env.invoke_vii;
  var invoke_iiiidii=env.invoke_iiiidii;
  var invoke_ii=env.invoke_ii;
  var invoke_i=env.invoke_i;
  var invoke_viiid=env.invoke_viiid;
  var invoke_viiiiid=env.invoke_viiiiid;
  var invoke_v=env.invoke_v;
  var invoke_iiiii=env.invoke_iiiii;
  var invoke_viiiiii=env.invoke_viiiiii;
  var invoke_viiiii=env.invoke_viiiii;
  var invoke_iiiid=env.invoke_iiiid;
  var invoke_viiii=env.invoke_viiii;
  var _llvm_pow_f64=env._llvm_pow_f64;
  var ___syscall54=env.___syscall54;
  var _abort=env._abort;
  var ___gxx_personality_v0=env.___gxx_personality_v0;
  var _llvm_stackrestore=env._llvm_stackrestore;
  var ___cxa_free_exception=env.___cxa_free_exception;
  var ___cxa_find_matching_catch_2=env.___cxa_find_matching_catch_2;
  var ___cxa_find_matching_catch_3=env.___cxa_find_matching_catch_3;
  var ___setErrNo=env.___setErrNo;
  var ___cxa_begin_catch=env.___cxa_begin_catch;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___cxa_end_catch=env.___cxa_end_catch;
  var ___resumeException=env.___resumeException;
  var __ZSt18uncaught_exceptionv=env.__ZSt18uncaught_exceptionv;
  var _pthread_getspecific=env._pthread_getspecific;
  var _llvm_stacksave=env._llvm_stacksave;
  var _pthread_once=env._pthread_once;
  var _pthread_key_create=env._pthread_key_create;
  var ___unlock=env.___unlock;
  var _pthread_setspecific=env._pthread_setspecific;
  var ___cxa_throw=env.___cxa_throw;
  var ___lock=env.___lock;
  var ___syscall6=env.___syscall6;
  var ___cxa_allocate_exception=env.___cxa_allocate_exception;
  var ___syscall140=env.___syscall140;
  var ___cxa_find_matching_catch=env.___cxa_find_matching_catch;
  var ___syscall146=env.___syscall146;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
  if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _ResetBDAC($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$arith = 0, $$arith2 = 0, $$arith6 = 0, $$overflow = 0, $$overflow3 = 0, $$overflow7 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0.0, $105 = 0.0, $106 = 0, $107 = 0.0, $108 = 0.0, $109 = 0.0, $11 = 0, $110 = 0.0, $111 = 0;
 var $112 = 0.0, $113 = 0.0, $114 = 0.0, $115 = 0.0, $116 = 0, $117 = 0.0, $118 = 0.0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0;
 var $130 = 0, $131 = 0, $132 = 0, $133 = 0.0, $134 = 0.0, $135 = 0.0, $136 = 0.0, $137 = 0.0, $138 = 0, $139 = 0.0, $14 = 0, $140 = 0.0, $141 = 0.0, $142 = 0, $143 = 0.0, $144 = 0.0, $145 = 0.0, $146 = 0, $147 = 0.0, $148 = 0.0;
 var $149 = 0.0, $15 = 0, $150 = 0, $151 = 0.0, $152 = 0.0, $153 = 0.0, $154 = 0, $155 = 0.0, $156 = 0.0, $157 = 0.0, $158 = 0, $159 = 0.0, $16 = 0, $160 = 0.0, $161 = 0.0, $162 = 0, $163 = 0.0, $164 = 0.0, $165 = 0.0, $166 = 0;
 var $167 = 0.0, $168 = 0.0, $169 = 0.0, $17 = 0.0, $170 = 0, $171 = 0.0, $172 = 0.0, $173 = 0.0, $174 = 0, $175 = 0.0, $176 = 0.0, $177 = 0.0, $178 = 0, $179 = 0.0, $18 = 0.0, $180 = 0.0, $181 = 0.0, $182 = 0, $183 = 0.0, $184 = 0.0;
 var $185 = 0.0, $186 = 0, $187 = 0.0, $188 = 0.0, $189 = 0.0, $19 = 0, $190 = 0, $191 = 0.0, $192 = 0.0, $193 = 0.0, $194 = 0, $195 = 0.0, $196 = 0.0, $197 = 0.0, $198 = 0, $199 = 0.0, $20 = 0, $200 = 0.0, $201 = 0.0, $202 = 0;
 var $203 = 0.0, $204 = 0.0, $205 = 0.0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0;
 var $221 = 0, $23 = 0.0, $24 = 0.0, $25 = 0.0, $26 = 0.0, $27 = 0.0, $28 = 0, $29 = 0.0, $3 = 0, $30 = 0.0, $31 = 0.0, $32 = 0, $33 = 0.0, $34 = 0.0, $35 = 0.0, $36 = 0, $37 = 0.0, $38 = 0.0, $39 = 0.0, $4 = 0;
 var $40 = 0, $41 = 0.0, $42 = 0.0, $43 = 0.0, $44 = 0, $45 = 0.0, $46 = 0.0, $47 = 0.0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0.0, $51 = 0.0, $52 = 0, $53 = 0.0, $54 = 0.0, $55 = 0.0, $56 = 0, $57 = 0.0, $58 = 0.0;
 var $59 = 0.0, $6 = 0, $60 = 0, $61 = 0.0, $62 = 0.0, $63 = 0.0, $64 = 0, $65 = 0.0, $66 = 0.0, $67 = 0.0, $68 = 0, $69 = 0.0, $7 = 0, $70 = 0.0, $71 = 0.0, $72 = 0, $73 = 0.0, $74 = 0.0, $75 = 0.0, $76 = 0;
 var $77 = 0.0, $78 = 0.0, $79 = 0.0, $8 = 0, $80 = 0, $81 = 0.0, $82 = 0.0, $83 = 0.0, $84 = 0, $85 = 0.0, $86 = 0.0, $87 = 0.0, $88 = 0, $89 = 0.0, $9 = 0, $90 = 0.0, $91 = 0.0, $92 = 0, $93 = 0, $94 = 0.0;
 var $95 = 0.0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $5;
 $7 = ($6|0)>(0);
 if ($7) {
  $8 = HEAP32[8792]|0;
  $9 = ($8|0)==(0|0);
  if (!($9)) {
   __ZdaPv($8);
  }
  HEAP32[8792] = 0;
  $10 = HEAP32[8750]|0;
  $11 = ($10|0)==(0|0);
  if (!($11)) {
   __ZdaPv($10);
  }
  HEAP32[8750] = 0;
  $12 = HEAP32[8751]|0;
  $13 = ($12|0)==(0|0);
  if (!($13)) {
   __ZdaPv($12);
  }
  HEAP32[8751] = 0;
  STACKTOP = sp;return;
 }
 $14 = $4;
 $15 = ($14|0)>(6);
 if ($15) {
  $16 = $4;
  $17 = (+($16|0));
  $18 = 0.14999999999999999 * $17;
  $19 = (~~(($18)));
  $20 = $19;
 } else {
  $20 = 7;
 }
 HEAP32[8788] = $20;
 $21 = $3;
 HEAP32[7740] = $21;
 $22 = HEAP32[7740]|0;
 $23 = (+($22|0));
 $24 = 1000.0 / $23;
 HEAPF64[4362] = $24;
 $25 = +HEAPF64[4362];
 $26 = 10.0 / $25;
 $27 = $26 + 0.5;
 $28 = (~~(($27)));
 HEAP32[8765] = $28;
 $29 = +HEAPF64[4362];
 $30 = 25.0 / $29;
 $31 = $30 + 0.5;
 $32 = (~~(($31)));
 HEAP32[8766] = $32;
 $33 = +HEAPF64[4362];
 $34 = 30.0 / $33;
 $35 = $34 + 0.5;
 $36 = (~~(($35)));
 HEAP32[8767] = $36;
 $37 = +HEAPF64[4362];
 $38 = 80.0 / $37;
 $39 = $38 + 0.5;
 $40 = (~~(($39)));
 HEAP32[8768] = $40;
 $41 = +HEAPF64[4362];
 $42 = 95.0 / $41;
 $43 = $42 + 0.5;
 $44 = (~~(($43)));
 HEAP32[8769] = $44;
 $45 = +HEAPF64[4362];
 $46 = 100.0 / $45;
 $47 = $46 + 0.5;
 $48 = (~~(($47)));
 HEAP32[8770] = $48;
 $49 = +HEAPF64[4362];
 $50 = 125.0 / $49;
 $51 = $50 + 0.5;
 $52 = (~~(($51)));
 HEAP32[8771] = $52;
 $53 = +HEAPF64[4362];
 $54 = 150.0 / $53;
 $55 = $54 + 0.5;
 $56 = (~~(($55)));
 HEAP32[8772] = $56;
 $57 = +HEAPF64[4362];
 $58 = 160.0 / $57;
 $59 = $58 + 0.5;
 $60 = (~~(($59)));
 HEAP32[8773] = $60;
 $61 = +HEAPF64[4362];
 $62 = 175.0 / $61;
 $63 = $62 + 0.5;
 $64 = (~~(($63)));
 HEAP32[8774] = $64;
 $65 = +HEAPF64[4362];
 $66 = 195.0 / $65;
 $67 = $66 + 0.5;
 $68 = (~~(($67)));
 HEAP32[8775] = $68;
 $69 = +HEAPF64[4362];
 $70 = 200.0 / $69;
 $71 = $70 + 0.5;
 $72 = (~~(($71)));
 HEAP32[8776] = $72;
 $73 = +HEAPF64[4362];
 $74 = 220.0 / $73;
 $75 = $74 + 0.5;
 $76 = (~~(($75)));
 HEAP32[8777] = $76;
 $77 = +HEAPF64[4362];
 $78 = 250.0 / $77;
 $79 = $78 + 0.5;
 $80 = (~~(($79)));
 HEAP32[8778] = $80;
 $81 = +HEAPF64[4362];
 $82 = 300.0 / $81;
 $83 = $82 + 0.5;
 $84 = (~~(($83)));
 HEAP32[8779] = $84;
 $85 = +HEAPF64[4362];
 $86 = 360.0 / $85;
 $87 = $86 + 0.5;
 $88 = (~~(($87)));
 HEAP32[8780] = $88;
 $89 = +HEAPF64[4362];
 $90 = 450.0 / $89;
 $91 = $90 + 0.5;
 $92 = (~~(($91)));
 HEAP32[8781] = $92;
 $93 = HEAP32[7740]|0;
 HEAP32[8782] = $93;
 $94 = +HEAPF64[4362];
 $95 = 1500.0 / $94;
 $96 = (~~(($95)));
 HEAP32[8783] = $96;
 $97 = HEAP32[8765]|0;
 HEAP32[8784] = $97;
 $98 = HEAP32[8766]|0;
 $99 = $98<<1;
 HEAP32[8785] = $99;
 $100 = HEAP32[8771]|0;
 HEAP32[8786] = $100;
 $101 = HEAP32[8775]|0;
 HEAP32[8787] = $101;
 $102 = HEAP32[8768]|0;
 HEAP32[8789] = $102;
 $103 = HEAP32[8784]|0;
 $104 = (+($103|0));
 $105 = $104 / 2.0;
 $106 = HEAP32[8785]|0;
 $107 = (+($106|0));
 $108 = $107 / 2.0;
 $109 = $108 - 1.0;
 $110 = $105 + $109;
 $111 = HEAP32[8786]|0;
 $112 = (+($111|0));
 $113 = $112 - 1.0;
 $114 = $113 / 2.0;
 $115 = $110 + $114;
 $116 = HEAP32[8787]|0;
 $117 = (+($116|0));
 $118 = $115 + $117;
 $119 = (~~(($118)));
 HEAP32[8790] = $119;
 $120 = HEAP32[8789]|0;
 $121 = HEAP32[8790]|0;
 $122 = (($120) + ($121))|0;
 $123 = HEAP32[8770]|0;
 $124 = (($122) + ($123))|0;
 HEAP32[8791] = $124;
 $125 = HEAP32[8792]|0;
 $126 = ($125|0)==(0|0);
 if (!($126)) {
  __ZdaPv($125);
 }
 $127 = HEAP32[8791]|0;
 $$arith6 = $127<<2;
 $$overflow7 = ($127>>>0)>(1073741823);
 $128 = $$overflow7 ? -1 : $$arith6;
 $129 = (__Znaj($128)|0);
 HEAP32[8792] = $129;
 $130 = HEAP32[7740]|0;
 $131 = (($130|0) / 2)&-1;
 HEAP32[7738] = $131;
 $132 = HEAP32[7738]|0;
 $133 = (+($132|0));
 $134 = 1000.0 / $133;
 HEAPF64[4361] = $134;
 $135 = +HEAPF64[4361];
 $136 = 10.0 / $135;
 $137 = $136 + 0.5;
 $138 = (~~(($137)));
 HEAP32[8728] = $138;
 $139 = +HEAPF64[4361];
 $140 = 20.0 / $139;
 $141 = $140 + 0.5;
 $142 = (~~(($141)));
 HEAP32[8729] = $142;
 $143 = +HEAPF64[4361];
 $144 = 40.0 / $143;
 $145 = $144 + 0.5;
 $146 = (~~(($145)));
 HEAP32[8730] = $146;
 $147 = +HEAPF64[4361];
 $148 = 50.0 / $147;
 $149 = $148 + 0.5;
 $150 = (~~(($149)));
 HEAP32[8731] = $150;
 $151 = +HEAPF64[4361];
 $152 = 60.0 / $151;
 $153 = $152 + 0.5;
 $154 = (~~(($153)));
 HEAP32[8732] = $154;
 $155 = +HEAPF64[4361];
 $156 = 70.0 / $155;
 $157 = $156 + 0.5;
 $158 = (~~(($157)));
 HEAP32[8733] = $158;
 $159 = +HEAPF64[4361];
 $160 = 80.0 / $159;
 $161 = $160 + 0.5;
 $162 = (~~(($161)));
 HEAP32[8734] = $162;
 $163 = +HEAPF64[4361];
 $164 = 90.0 / $163;
 $165 = $164 + 0.5;
 $166 = (~~(($165)));
 HEAP32[8735] = $166;
 $167 = +HEAPF64[4361];
 $168 = 100.0 / $167;
 $169 = $168 + 0.5;
 $170 = (~~(($169)));
 HEAP32[8736] = $170;
 $171 = +HEAPF64[4361];
 $172 = 110.0 / $171;
 $173 = $172 + 0.5;
 $174 = (~~(($173)));
 HEAP32[8737] = $174;
 $175 = +HEAPF64[4361];
 $176 = 130.0 / $175;
 $177 = $176 + 0.5;
 $178 = (~~(($177)));
 HEAP32[8738] = $178;
 $179 = +HEAPF64[4361];
 $180 = 140.0 / $179;
 $181 = $180 + 0.5;
 $182 = (~~(($181)));
 HEAP32[8739] = $182;
 $183 = +HEAPF64[4361];
 $184 = 150.0 / $183;
 $185 = $184 + 0.5;
 $186 = (~~(($185)));
 HEAP32[8740] = $186;
 $187 = +HEAPF64[4361];
 $188 = 250.0 / $187;
 $189 = $188 + 0.5;
 $190 = (~~(($189)));
 HEAP32[8741] = $190;
 $191 = +HEAPF64[4361];
 $192 = 280.0 / $191;
 $193 = $192 + 0.5;
 $194 = (~~(($193)));
 HEAP32[8742] = $194;
 $195 = +HEAPF64[4361];
 $196 = 300.0 / $195;
 $197 = $196 + 0.5;
 $198 = (~~(($197)));
 HEAP32[8743] = $198;
 $199 = +HEAPF64[4361];
 $200 = 350.0 / $199;
 $201 = $200 + 0.5;
 $202 = (~~(($201)));
 HEAP32[8744] = $202;
 $203 = +HEAPF64[4361];
 $204 = 400.0 / $203;
 $205 = $204 + 0.5;
 $206 = (~~(($205)));
 HEAP32[8745] = $206;
 $207 = HEAP32[7738]|0;
 HEAP32[8746] = $207;
 $208 = HEAP32[8746]|0;
 HEAP32[8747] = $208;
 $209 = HEAP32[8745]|0;
 HEAP32[8748] = $209;
 $210 = HEAP32[7738]|0;
 $211 = ($210*10)|0;
 HEAP32[8749] = $211;
 $212 = HEAP32[8750]|0;
 $213 = ($212|0)==(0|0);
 if (!($213)) {
  __ZdaPv($212);
 }
 $214 = HEAP32[8751]|0;
 $215 = ($214|0)==(0|0);
 if (!($215)) {
  __ZdaPv($214);
 }
 $216 = HEAP32[8749]|0;
 $$arith2 = $216<<2;
 $$overflow3 = ($216>>>0)>(1073741823);
 $217 = $$overflow3 ? -1 : $$arith2;
 $218 = (__Znaj($217)|0);
 HEAP32[8750] = $218;
 $219 = HEAP32[8747]|0;
 $$arith = $219<<2;
 $$overflow = ($219>>>0)>(1073741823);
 $220 = $$overflow ? -1 : $$arith;
 $221 = (__Znaj($220)|0);
 HEAP32[8751] = $221;
 (__Z6QRSDetii(0,1)|0);
 HEAP32[8764] = 0;
 HEAP32[7739] = 1;
 HEAP32[8763] = 0;
 STACKTOP = sp;return;
}
function _BeatDetectAndClassify($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $8 = 0;
 $10 = (_llvm_stacksave()|0);
 $9 = $10;
 $11 = $3;
 $12 = HEAP32[8750]|0;
 $13 = HEAP32[8752]|0;
 $14 = (($12) + ($13<<2)|0);
 HEAP32[$14>>2] = $11;
 $15 = HEAP32[8752]|0;
 $16 = (($15) + 1)|0;
 HEAP32[8752] = $16;
 $17 = HEAP32[8749]|0;
 $18 = ($16|0)==($17|0);
 $$ = $18 ? 0 : $16;
 HEAP32[8752] = $$;
 $19 = HEAP32[8764]|0;
 $20 = (($19) + 1)|0;
 HEAP32[8764] = $20;
 $7 = 0;
 while(1) {
  $21 = $7;
  $22 = HEAP32[8763]|0;
  $23 = ($21|0)<($22|0);
  if (!($23)) {
   break;
  }
  $24 = $7;
  $25 = (35012 + ($24<<2)|0);
  $26 = HEAP32[$25>>2]|0;
  $27 = (($26) + 1)|0;
  HEAP32[$25>>2] = $27;
  $28 = $7;
  $29 = (($28) + 1)|0;
  $7 = $29;
 }
 $30 = $3;
 $31 = (__Z6QRSDetii($30,0)|0);
 $6 = $31;
 $32 = $6;
 $33 = $9;
 _llvm_stackrestore(($33|0));
 STACKTOP = sp;return ($32|0);
}
function __Z6QRSDetii($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$4 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0;
 var $96 = 0, $97 = 0, $98 = 0, $99 = 0, $or$cond = 0, $or$cond3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $2 = $0;
 $3 = $1;
 $9 = HEAP8[34904]|0;
 $10 = ($9<<24>>24)==(0);
 if ($10) {
  $11 = (___cxa_guard_acquire(34904)|0);
  $12 = ($11|0)!=(0);
  if ($12) {
   $13 = HEAP32[8783]|0;
   HEAP32[8795] = $13;
  }
 }
 $5 = 0;
 $14 = $3;
 $15 = ($14|0)!=(0);
 if ($15) {
  $6 = 0;
  while(1) {
   $16 = $6;
   $17 = ($16|0)<(8);
   if (!($17)) {
    break;
   }
   $18 = $6;
   $19 = (35184 + ($18<<2)|0);
   HEAP32[$19>>2] = 0;
   $20 = HEAP32[8782]|0;
   $21 = $6;
   $22 = (35216 + ($21<<2)|0);
   HEAP32[$22>>2] = $20;
   $23 = $6;
   $24 = (($23) + 1)|0;
   $6 = $24;
  }
  HEAP32[8812] = 0;
  HEAP32[8813] = 0;
  HEAP32[8814] = 0;
  HEAP32[8815] = 0;
  HEAP32[8816] = 0;
  HEAP32[8793] = 0;
  HEAP32[8817] = 0;
  HEAP32[8818] = 0;
  HEAP32[8819] = 0;
  $25 = HEAP32[8783]|0;
  HEAP32[8795] = $25;
  (__Z9QRSFilterii(0,1)|0);
  (__Z4Peakii(0,1)|0);
 }
 $26 = $2;
 $27 = (__Z9QRSFilterii($26,0)|0);
 $4 = $27;
 $28 = $4;
 $29 = (__Z4Peakii($28,0)|0);
 $8 = $29;
 $30 = $8;
 $31 = HEAP32[8788]|0;
 $32 = ($30|0)<($31|0);
 $$ = $32 ? 0 : $29;
 $8 = $$;
 $7 = 0;
 $33 = $8;
 $34 = ($33|0)==(0);
 $35 = HEAP32[8817]|0;
 $36 = ($35|0)!=(0);
 $or$cond = $34 | $36;
 $37 = $8;
 do {
  if ($or$cond) {
   $39 = ($37|0)==(0);
   $40 = HEAP32[8817]|0;
   $41 = ($40|0)!=(0);
   $or$cond3 = $39 & $41;
   if ($or$cond3) {
    $42 = HEAP32[8817]|0;
    $43 = (($42) + -1)|0;
    HEAP32[8817] = $43;
    $44 = ($43|0)==(0);
    if (!($44)) {
     break;
    }
    $45 = HEAP32[8820]|0;
    $7 = $45;
    break;
   }
   $46 = $8;
   $47 = ($46|0)!=(0);
   if ($47) {
    $48 = $8;
    $49 = HEAP32[8820]|0;
    $50 = ($48|0)>($49|0);
    if ($50) {
     $51 = $8;
     HEAP32[8820] = $51;
     $52 = HEAP32[8787]|0;
     HEAP32[8817] = $52;
     break;
    }
    $53 = HEAP32[8817]|0;
    $54 = (($53) + -1)|0;
    HEAP32[8817] = $54;
    $55 = ($54|0)==(0);
    if ($55) {
     $56 = HEAP32[8820]|0;
     $7 = $56;
    }
   }
  } else {
   HEAP32[8820] = $37;
   $38 = HEAP32[8787]|0;
   HEAP32[8817] = $38;
  }
 } while(0);
 $57 = $2;
 $58 = (__Z6deriv1ii($57,0)|0);
 $59 = HEAP32[8792]|0;
 $60 = HEAP32[8793]|0;
 $61 = (($59) + ($60<<2)|0);
 HEAP32[$61>>2] = $58;
 $62 = HEAP32[8793]|0;
 $63 = (($62) + 1)|0;
 HEAP32[8793] = $63;
 $64 = HEAP32[8791]|0;
 $65 = ($63|0)==($64|0);
 $$4 = $65 ? 0 : $63;
 HEAP32[8793] = $$4;
 $66 = HEAP32[8816]|0;
 $67 = ($66|0)<(8);
 $68 = HEAP32[8813]|0;
 $69 = (($68) + 1)|0;
 HEAP32[8813] = $69;
 $70 = $7;
 $71 = ($70|0)>(0);
 if ($67) {
  if ($71) {
   $72 = HEAP32[8789]|0;
   HEAP32[8813] = $72;
  }
  $73 = HEAP32[8819]|0;
  $74 = (($73) + 1)|0;
  HEAP32[8819] = $74;
  $75 = HEAP32[8782]|0;
  $76 = ($74|0)==($75|0);
  if ($76) {
   HEAP32[8819] = 0;
   $77 = HEAP32[8818]|0;
   $78 = HEAP32[8816]|0;
   $79 = (35284 + ($78<<2)|0);
   HEAP32[$79>>2] = $77;
   HEAP32[8818] = 0;
   $80 = HEAP32[8816]|0;
   $81 = (($80) + 1)|0;
   HEAP32[8816] = $81;
   $82 = HEAP32[8816]|0;
   $83 = ($82|0)==(8);
   if ($83) {
    $84 = (__Z4meanPii(35284,8)|0);
    HEAP32[8829] = $84;
    HEAP32[8830] = 0;
    $85 = HEAP32[8782]|0;
    HEAP32[8831] = $85;
    $86 = HEAP32[8783]|0;
    $87 = HEAP32[8772]|0;
    $88 = (($86) + ($87))|0;
    HEAP32[8795] = $88;
    $89 = HEAP32[8829]|0;
    $90 = HEAP32[8830]|0;
    $91 = (__Z6threshii($89,$90)|0);
    HEAP32[8832] = $91;
   }
  }
  $92 = $7;
  $93 = HEAP32[8818]|0;
  $94 = ($92|0)>($93|0);
  if ($94) {
   $95 = $7;
   HEAP32[8818] = $95;
  }
 } else {
  do {
   if ($71) {
    $96 = HEAP32[8792]|0;
    $97 = HEAP32[8793]|0;
    $98 = (__Z8BLSCheckPiiS_($96,$97,35260)|0);
    $99 = ($98|0)!=(0);
    if (!($99)) {
     $100 = $7;
     $101 = HEAP32[8832]|0;
     $102 = ($100|0)>($101|0);
     if ($102) {
      _memmove(((35288)|0),(35284|0),28)|0;
      $103 = $7;
      HEAP32[8821] = $103;
      $104 = (__Z4meanPii(35284,8)|0);
      HEAP32[8829] = $104;
      $105 = HEAP32[8829]|0;
      $106 = HEAP32[8830]|0;
      $107 = (__Z6threshii($105,$106)|0);
      HEAP32[8832] = $107;
      _memmove(((35220)|0),(35216|0),28)|0;
      $108 = HEAP32[8813]|0;
      $109 = HEAP32[8789]|0;
      $110 = (($108) - ($109))|0;
      HEAP32[8804] = $110;
      $111 = (__Z4meanPii(35216,8)|0);
      HEAP32[8831] = $111;
      $112 = HEAP32[8831]|0;
      $113 = HEAP32[8831]|0;
      $114 = $113 >> 1;
      $115 = (($112) + ($114))|0;
      $116 = HEAP32[8789]|0;
      $117 = (($115) + ($116))|0;
      HEAP32[8795] = $117;
      $118 = HEAP32[8789]|0;
      HEAP32[8813] = $118;
      HEAP32[8812] = 0;
      $119 = HEAP32[8815]|0;
      HEAP32[8814] = $119;
      HEAP32[8815] = 0;
      $120 = HEAP32[8789]|0;
      $121 = HEAP32[8790]|0;
      $122 = (($120) + ($121))|0;
      $5 = $122;
      HEAP32[8833] = 0;
      HEAP32[8818] = 0;
      HEAP32[8819] = 0;
      break;
     }
     _memmove(((35188)|0),(35184|0),28)|0;
     $123 = $7;
     HEAP32[8796] = $123;
     $124 = (__Z4meanPii(35184,8)|0);
     HEAP32[8830] = $124;
     $125 = HEAP32[8829]|0;
     $126 = HEAP32[8830]|0;
     $127 = (__Z6threshii($125,$126)|0);
     HEAP32[8832] = $127;
     $128 = $7;
     $129 = HEAP32[8812]|0;
     $130 = ($128|0)>($129|0);
     if ($130) {
      $131 = HEAP32[8813]|0;
      $132 = HEAP32[8789]|0;
      $133 = (($131) - ($132))|0;
      $134 = HEAP32[8780]|0;
      $135 = ($133|0)>=($134|0);
      if ($135) {
       $136 = $7;
       HEAP32[8812] = $136;
       $137 = HEAP32[8813]|0;
       $138 = HEAP32[8789]|0;
       $139 = (($137) - ($138))|0;
       HEAP32[8834] = $139;
      }
     }
    }
   }
  } while(0);
  $140 = HEAP32[8813]|0;
  $141 = HEAP32[8795]|0;
  $142 = ($140|0)>($141|0);
  if ($142) {
   $143 = HEAP32[8812]|0;
   $144 = HEAP32[8832]|0;
   $145 = $144 >> 1;
   $146 = ($143|0)>($145|0);
   if ($146) {
    _memmove(((35288)|0),(35284|0),28)|0;
    $147 = HEAP32[8812]|0;
    HEAP32[8821] = $147;
    $148 = (__Z4meanPii(35284,8)|0);
    HEAP32[8829] = $148;
    $149 = HEAP32[8829]|0;
    $150 = HEAP32[8830]|0;
    $151 = (__Z6threshii($149,$150)|0);
    HEAP32[8832] = $151;
    _memmove(((35220)|0),(35216|0),28)|0;
    $152 = HEAP32[8834]|0;
    HEAP32[8804] = $152;
    $153 = (__Z4meanPii(35216,8)|0);
    HEAP32[8831] = $153;
    $154 = HEAP32[8831]|0;
    $155 = HEAP32[8831]|0;
    $156 = $155 >> 1;
    $157 = (($154) + ($156))|0;
    $158 = HEAP32[8789]|0;
    $159 = (($157) + ($158))|0;
    HEAP32[8795] = $159;
    $160 = HEAP32[8813]|0;
    $161 = HEAP32[8834]|0;
    $162 = (($160) - ($161))|0;
    HEAP32[8813] = $162;
    $5 = $162;
    $163 = HEAP32[8790]|0;
    $164 = $5;
    $165 = (($164) + ($163))|0;
    $5 = $165;
    HEAP32[8812] = 0;
    $166 = HEAP32[8815]|0;
    HEAP32[8814] = $166;
    HEAP32[8815] = 0;
    HEAP32[8833] = 0;
    HEAP32[8818] = 0;
    HEAP32[8819] = 0;
   }
  }
 }
 $167 = HEAP32[8816]|0;
 $168 = ($167|0)==(8);
 if (!($168)) {
  $203 = $5;
  STACKTOP = sp;return ($203|0);
 }
 $169 = HEAP32[8819]|0;
 $170 = (($169) + 1)|0;
 HEAP32[8819] = $170;
 $171 = HEAP32[8782]|0;
 $172 = ($170|0)==($171|0);
 if ($172) {
  HEAP32[8819] = 0;
  $173 = HEAP32[8818]|0;
  $174 = HEAP32[8833]|0;
  $175 = (35340 + ($174<<2)|0);
  HEAP32[$175>>2] = $173;
  HEAP32[8818] = 0;
  $176 = HEAP32[8833]|0;
  $177 = (($176) + 1)|0;
  HEAP32[8833] = $177;
  $178 = HEAP32[8833]|0;
  $179 = ($178|0)==(8);
  if ($179) {
   $6 = 0;
   while(1) {
    $180 = $6;
    $181 = ($180|0)<(8);
    if (!($181)) {
     break;
    }
    $182 = $6;
    $183 = (35340 + ($182<<2)|0);
    $184 = HEAP32[$183>>2]|0;
    $185 = $6;
    $186 = (35284 + ($185<<2)|0);
    HEAP32[$186>>2] = $184;
    $187 = $6;
    $188 = (35184 + ($187<<2)|0);
    HEAP32[$188>>2] = 0;
    $189 = $6;
    $190 = (($189) + 1)|0;
    $6 = $190;
   }
   $191 = (__Z4meanPii(35340,8)|0);
   HEAP32[8829] = $191;
   HEAP32[8830] = 0;
   $192 = HEAP32[8782]|0;
   HEAP32[8831] = $192;
   $193 = HEAP32[8783]|0;
   $194 = HEAP32[8772]|0;
   $195 = (($193) + ($194))|0;
   HEAP32[8795] = $195;
   $196 = HEAP32[8829]|0;
   $197 = HEAP32[8830]|0;
   $198 = (__Z6threshii($196,$197)|0);
   HEAP32[8832] = $198;
   HEAP32[8833] = 0;
   HEAP32[8818] = 0;
   HEAP32[8819] = 0;
  }
 }
 $199 = $7;
 $200 = HEAP32[8818]|0;
 $201 = ($199|0)>($200|0);
 if (!($201)) {
  $203 = $5;
  STACKTOP = sp;return ($203|0);
 }
 $202 = $7;
 HEAP32[8818] = $202;
 $203 = $5;
 STACKTOP = sp;return ($203|0);
}
function __Z4Peakii($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = 0;
 $5 = $3;
 $6 = ($5|0)!=(0);
 if ($6) {
  HEAP32[8843] = 0;
  HEAP32[8844] = 0;
 }
 $7 = HEAP32[8843]|0;
 $8 = ($7|0)>(0);
 if ($8) {
  $9 = HEAP32[8843]|0;
  $10 = (($9) + 1)|0;
  HEAP32[8843] = $10;
 }
 $11 = $2;
 $12 = HEAP32[8845]|0;
 $13 = ($11|0)>($12|0);
 if ($13) {
  $14 = $2;
  $15 = HEAP32[8844]|0;
  $16 = ($14|0)>($15|0);
  if ($16) {
   $17 = $2;
   HEAP32[8844] = $17;
   $18 = HEAP32[8844]|0;
   $19 = ($18|0)>(2);
   if ($19) {
    HEAP32[8843] = 1;
   }
  } else {
   label = 9;
  }
 } else {
  label = 9;
 }
 do {
  if ((label|0) == 9) {
   $20 = $2;
   $21 = HEAP32[8844]|0;
   $22 = $21 >> 1;
   $23 = ($20|0)<($22|0);
   if ($23) {
    $24 = HEAP32[8844]|0;
    $4 = $24;
    HEAP32[8844] = 0;
    HEAP32[8843] = 0;
    HEAP32[8794] = 0;
    break;
   }
   $25 = HEAP32[8843]|0;
   $26 = HEAP32[8769]|0;
   $27 = ($25|0)>($26|0);
   if ($27) {
    $28 = HEAP32[8844]|0;
    $4 = $28;
    HEAP32[8844] = 0;
    HEAP32[8843] = 0;
    HEAP32[8794] = 3;
   }
  }
 } while(0);
 $29 = $2;
 HEAP32[8845] = $29;
 $30 = $4;
 STACKTOP = sp;return ($30|0);
}
function __Z4meanPii($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $5 = 0;
 $4 = 0;
 while(1) {
  $6 = $5;
  $7 = $3;
  $8 = ($6|0)<($7|0);
  if (!($8)) {
   break;
  }
  $9 = $2;
  $10 = $5;
  $11 = (($9) + ($10<<2)|0);
  $12 = HEAP32[$11>>2]|0;
  $13 = $4;
  $14 = (($13) + ($12))|0;
  $4 = $14;
  $15 = $5;
  $16 = (($15) + 1)|0;
  $5 = $16;
 }
 $17 = $3;
 $18 = $4;
 $19 = (($18|0) / ($17|0))&-1;
 $4 = $19;
 $20 = $4;
 STACKTOP = sp;return ($20|0);
}
function __Z6threshii($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0.0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $2 = $0;
 $3 = $1;
 $7 = $2;
 $8 = $3;
 $9 = (($7) - ($8))|0;
 $5 = $9;
 $10 = $5;
 $11 = (+($10|0));
 $6 = $11;
 $12 = +HEAPF64[1];
 $13 = $6;
 $14 = $13 * $12;
 $6 = $14;
 $15 = $6;
 $16 = (~~(($15)));
 $5 = $16;
 $17 = $3;
 $18 = $5;
 $19 = (($17) + ($18))|0;
 $4 = $19;
 $20 = $4;
 STACKTOP = sp;return ($20|0);
}
function __Z8BLSCheckPiiS_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $8 = 0;
 $7 = 0;
 $11 = 0;
 while(1) {
  $13 = $11;
  $14 = HEAP32[8777]|0;
  $15 = ($13|0)<($14|0);
  if (!($15)) {
   break;
  }
  $16 = $4;
  $17 = $5;
  $18 = (($16) + ($17<<2)|0);
  $19 = HEAP32[$18>>2]|0;
  $12 = $19;
  $20 = $12;
  $21 = $7;
  $22 = ($20|0)>($21|0);
  if ($22) {
   $23 = $11;
   $9 = $23;
   $24 = $12;
   $7 = $24;
  } else {
   $25 = $12;
   $26 = $8;
   $27 = ($25|0)<($26|0);
   if ($27) {
    $28 = $11;
    $10 = $28;
    $29 = $12;
    $8 = $29;
   }
  }
  $30 = $5;
  $31 = (($30) + 1)|0;
  $5 = $31;
  $32 = HEAP32[8791]|0;
  $33 = ($31|0)==($32|0);
  $$ = $33 ? 0 : $31;
  $5 = $$;
  $34 = $11;
  $35 = (($34) + 1)|0;
  $11 = $35;
 }
 $36 = $7;
 $37 = $6;
 HEAP32[$37>>2] = $36;
 $38 = $8;
 $39 = (0 - ($38))|0;
 $8 = $39;
 $40 = $7;
 $41 = $8;
 $42 = $41 >> 3;
 $43 = ($40|0)>($42|0);
 if ($43) {
  $44 = $8;
  $45 = $7;
  $46 = $45 >> 3;
  $47 = ($44|0)>($46|0);
  if ($47) {
   $48 = $9;
   $49 = $10;
   $50 = (($48) - ($49))|0;
   $51 = (Math_abs(($50|0))|0);
   $52 = HEAP32[8772]|0;
   $53 = ($51|0)<($52|0);
   if ($53) {
    $3 = 0;
    $54 = $3;
    STACKTOP = sp;return ($54|0);
   }
  }
 }
 $3 = 1;
 $54 = $3;
 STACKTOP = sp;return ($54|0);
}
function __Z9QRSFilterii($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $5 = $3;
 $6 = ($5|0)!=(0);
 if ($6) {
  (__Z6hpfiltii(0,1)|0);
  (__Z6lpfiltii(0,1)|0);
  (__Z6mvwintii(0,1)|0);
  (__Z6deriv1ii(0,1)|0);
  (__Z6deriv2ii(0,1)|0);
 }
 $7 = $2;
 $8 = (__Z6lpfiltii($7,0)|0);
 $4 = $8;
 $9 = $4;
 $10 = (__Z6hpfiltii($9,0)|0);
 $4 = $10;
 $11 = $4;
 $12 = (__Z6deriv2ii($11,0)|0);
 $4 = $12;
 $13 = $4;
 $14 = (Math_abs(($13|0))|0);
 $4 = $14;
 $15 = $4;
 $16 = (__Z6mvwintii($15,0)|0);
 $4 = $16;
 $17 = $4;
 STACKTOP = sp;return ($17|0);
}
function __Z6hpfiltii($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$sink = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $6 = $3;
 $7 = ($6|0)!=(0);
 if ($7) {
  $$sink = 0;
  while(1) {
   HEAP32[9003] = $$sink;
   $8 = HEAP32[9003]|0;
   $9 = ($8|0)<(125);
   if (!($9)) {
    break;
   }
   $10 = HEAP32[9003]|0;
   $11 = (36016 + ($10<<2)|0);
   HEAP32[$11>>2] = 0;
   $12 = HEAP32[9003]|0;
   $13 = (($12) + 1)|0;
   $$sink = $13;
  }
  HEAP32[9003] = 0;
  HEAP32[9129] = 0;
 }
 $14 = $2;
 $15 = HEAP32[9003]|0;
 $16 = (36016 + ($15<<2)|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = (($14) - ($17))|0;
 $19 = HEAP32[9129]|0;
 $20 = (($19) + ($18))|0;
 HEAP32[9129] = $20;
 $21 = HEAP32[9003]|0;
 $22 = HEAP32[8786]|0;
 $23 = (($22|0) / 2)&-1;
 $24 = (($21) - ($23))|0;
 $5 = $24;
 $25 = $5;
 $26 = ($25|0)<(0);
 if ($26) {
  $27 = HEAP32[8786]|0;
  $28 = $5;
  $29 = (($28) + ($27))|0;
  $5 = $29;
 }
 $30 = $5;
 $31 = (36016 + ($30<<2)|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = HEAP32[9129]|0;
 $34 = HEAP32[8786]|0;
 $35 = (($33|0) / ($34|0))&-1;
 $36 = (($32) - ($35))|0;
 $4 = $36;
 $37 = $2;
 $38 = HEAP32[9003]|0;
 $39 = (36016 + ($38<<2)|0);
 HEAP32[$39>>2] = $37;
 $40 = HEAP32[9003]|0;
 $41 = (($40) + 1)|0;
 HEAP32[9003] = $41;
 $42 = HEAP32[8786]|0;
 $43 = ($41|0)==($42|0);
 $$ = $43 ? 0 : $41;
 HEAP32[9003] = $$;
 $44 = $4;
 STACKTOP = sp;return ($44|0);
}
function __Z6lpfiltii($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$sink = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $2 = $0;
 $3 = $1;
 $7 = $3;
 $8 = ($7|0)!=(0);
 if ($8) {
  $$sink = 0;
  while(1) {
   HEAP32[8950] = $$sink;
   $9 = HEAP32[8950]|0;
   $10 = ($9|0)<(50);
   if (!($10)) {
    break;
   }
   $11 = HEAP32[8950]|0;
   $12 = (35804 + ($11<<2)|0);
   HEAP32[$12>>2] = 0;
   $13 = HEAP32[8950]|0;
   $14 = (($13) + 1)|0;
   $$sink = $14;
  }
  HEAP32[9001] = 0;
  HEAP32[9002] = 0;
  HEAP32[8950] = 0;
 }
 $15 = HEAP32[8950]|0;
 $16 = HEAP32[8785]|0;
 $17 = (($16|0) / 2)&-1;
 $18 = (($15) - ($17))|0;
 $6 = $18;
 $19 = $6;
 $20 = ($19|0)<(0);
 if ($20) {
  $21 = HEAP32[8785]|0;
  $22 = $6;
  $23 = (($22) + ($21))|0;
  $6 = $23;
 }
 $24 = HEAP32[9002]|0;
 $25 = $24 << 1;
 $26 = HEAP32[9001]|0;
 $27 = (($25) - ($26))|0;
 $28 = $2;
 $29 = (($27) + ($28))|0;
 $30 = $6;
 $31 = (35804 + ($30<<2)|0);
 $32 = HEAP32[$31>>2]|0;
 $33 = $32 << 1;
 $34 = (($29) - ($33))|0;
 $35 = HEAP32[8950]|0;
 $36 = (35804 + ($35<<2)|0);
 $37 = HEAP32[$36>>2]|0;
 $38 = (($34) + ($37))|0;
 $4 = $38;
 $39 = HEAP32[9002]|0;
 HEAP32[9001] = $39;
 $40 = $4;
 HEAP32[9002] = $40;
 $41 = $4;
 $42 = HEAP32[8785]|0;
 $43 = HEAP32[8785]|0;
 $44 = Math_imul($42, $43)|0;
 $45 = (($44|0) / 4)&-1;
 $46 = (($41|0) / ($45|0))&-1;
 $5 = $46;
 $47 = $2;
 $48 = HEAP32[8950]|0;
 $49 = (35804 + ($48<<2)|0);
 HEAP32[$49>>2] = $47;
 $50 = HEAP32[8950]|0;
 $51 = (($50) + 1)|0;
 HEAP32[8950] = $51;
 $52 = HEAP32[8785]|0;
 $53 = ($51|0)==($52|0);
 $$ = $53 ? 0 : $51;
 HEAP32[8950] = $$;
 $54 = $5;
 STACKTOP = sp;return ($54|0);
}
function __Z6mvwintii($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$sink = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $5 = $3;
 $6 = ($5|0)!=(0);
 if ($6) {
  $$sink = 0;
  while(1) {
   HEAP32[8868] = $$sink;
   $7 = HEAP32[8868]|0;
   $8 = ($7|0)<(80);
   if (!($8)) {
    break;
   }
   $9 = HEAP32[8868]|0;
   $10 = (35476 + ($9<<2)|0);
   HEAP32[$10>>2] = 0;
   $11 = HEAP32[8868]|0;
   $12 = (($11) + 1)|0;
   $$sink = $12;
  }
  HEAP32[8949] = 0;
  HEAP32[8868] = 0;
 }
 $13 = $2;
 $14 = HEAP32[8949]|0;
 $15 = (($14) + ($13))|0;
 HEAP32[8949] = $15;
 $16 = HEAP32[8868]|0;
 $17 = (35476 + ($16<<2)|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = HEAP32[8949]|0;
 $20 = (($19) - ($18))|0;
 HEAP32[8949] = $20;
 $21 = $2;
 $22 = HEAP32[8868]|0;
 $23 = (35476 + ($22<<2)|0);
 HEAP32[$23>>2] = $21;
 $24 = HEAP32[8868]|0;
 $25 = (($24) + 1)|0;
 HEAP32[8868] = $25;
 $26 = HEAP32[8789]|0;
 $27 = ($25|0)==($26|0);
 $$ = $27 ? 0 : $25;
 HEAP32[8868] = $$;
 $28 = HEAP32[8949]|0;
 $29 = HEAP32[8789]|0;
 $30 = (($28|0) / ($29|0))&-1;
 $31 = ($30|0)>(32000);
 if ($31) {
  $4 = 32000;
  $35 = $4;
  STACKTOP = sp;return ($35|0);
 } else {
  $32 = HEAP32[8949]|0;
  $33 = HEAP32[8789]|0;
  $34 = (($32|0) / ($33|0))&-1;
  $4 = $34;
  $35 = $4;
  STACKTOP = sp;return ($35|0);
 }
 return (0)|0;
}
function __Z6deriv1ii($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$sink = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $6 = $4;
 $7 = ($6|0)!=(0);
 if ($7) {
  $$sink = 0;
 } else {
  $14 = $3;
  $15 = HEAP32[8857]|0;
  $16 = (35432 + ($15<<2)|0);
  $17 = HEAP32[$16>>2]|0;
  $18 = (($14) - ($17))|0;
  $5 = $18;
  $19 = $3;
  $20 = HEAP32[8857]|0;
  $21 = (35432 + ($20<<2)|0);
  HEAP32[$21>>2] = $19;
  $22 = HEAP32[8857]|0;
  $23 = (($22) + 1)|0;
  HEAP32[8857] = $23;
  $24 = HEAP32[8784]|0;
  $25 = ($23|0)==($24|0);
  $$ = $25 ? 0 : $23;
  HEAP32[8857] = $$;
  $26 = $5;
  $2 = $26;
  $27 = $2;
  STACKTOP = sp;return ($27|0);
 }
 while(1) {
  HEAP32[8857] = $$sink;
  $8 = HEAP32[8857]|0;
  $9 = ($8|0)<(10);
  if (!($9)) {
   break;
  }
  $10 = HEAP32[8857]|0;
  $11 = (35432 + ($10<<2)|0);
  HEAP32[$11>>2] = 0;
  $12 = HEAP32[8857]|0;
  $13 = (($12) + 1)|0;
  $$sink = $13;
 }
 HEAP32[8857] = 0;
 $2 = 0;
 $27 = $2;
 STACKTOP = sp;return ($27|0);
}
function __Z6deriv2ii($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$sink = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $6 = $4;
 $7 = ($6|0)!=(0);
 if ($7) {
  $$sink = 0;
 } else {
  $14 = $3;
  $15 = HEAP32[8846]|0;
  $16 = (35388 + ($15<<2)|0);
  $17 = HEAP32[$16>>2]|0;
  $18 = (($14) - ($17))|0;
  $5 = $18;
  $19 = $3;
  $20 = HEAP32[8846]|0;
  $21 = (35388 + ($20<<2)|0);
  HEAP32[$21>>2] = $19;
  $22 = HEAP32[8846]|0;
  $23 = (($22) + 1)|0;
  HEAP32[8846] = $23;
  $24 = HEAP32[8784]|0;
  $25 = ($23|0)==($24|0);
  $$ = $25 ? 0 : $23;
  HEAP32[8846] = $$;
  $26 = $5;
  $2 = $26;
  $27 = $2;
  STACKTOP = sp;return ($27|0);
 }
 while(1) {
  HEAP32[8846] = $$sink;
  $8 = HEAP32[8846]|0;
  $9 = ($8|0)<(10);
  if (!($9)) {
   break;
  }
  $10 = HEAP32[8846]|0;
  $11 = (35388 + ($10<<2)|0);
  HEAP32[$11>>2] = 0;
  $12 = HEAP32[8846]|0;
  $13 = (($12) + 1)|0;
  $$sink = $13;
 }
 HEAP32[8846] = 0;
 $2 = 0;
 $27 = $2;
 STACKTOP = sp;return ($27|0);
}
function __ZN6SignalD0Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $4 = $1;
 __THREW__ = 0;
 invoke_vi(1,($4|0));
 $5 = __THREW__; __THREW__ = 0;
 $6 = $5&1;
 if ($6) {
  $7 = ___cxa_find_matching_catch_2()|0;
  $8 = tempRet0;
  $2 = $7;
  $3 = $8;
  __ZdlPv($4);
  $9 = $2;
  $10 = $3;
  ___resumeException($9|0);
  // unreachable;
 } else {
  __ZdlPv($4);
  STACKTOP = sp;return;
 }
}
function __ZN6SignalD2Ev($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 STACKTOP = sp;return;
}
function __ZN6SignalC2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 HEAP32[$2>>2] = (30972);
 $3 = ((($2)) + 4|0);
 HEAP32[$3>>2] = 0;
 $4 = ((($2)) + 8|0);
 HEAPF64[$4>>3] = 0.0;
 $5 = ((($2)) + 16|0);
 HEAP32[$5>>2] = 0;
 $6 = ((($2)) + 20|0);
 HEAP32[$6>>2] = 0;
 $7 = ((($2)) + 24|0);
 HEAP32[$7>>2] = 0;
 $8 = ((($2)) + 28|0);
 HEAP32[$8>>2] = 0;
 $9 = ((($2)) + 32|0);
 HEAP32[$9>>2] = 0;
 $10 = ((($2)) + 36|0);
 HEAP32[$10>>2] = 0;
 $11 = ((($2)) + 40|0);
 HEAP32[$11>>2] = 0;
 STACKTOP = sp;return;
}
function __ZNK6Signal6MinMaxEPKdiRdS2_($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0.0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0.0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0.0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0.0, $43 = 0, $44 = 0, $45 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 $11 = $6;
 $12 = +HEAPF64[$11>>3];
 $13 = $9;
 HEAPF64[$13>>3] = $12;
 $14 = $6;
 $15 = +HEAPF64[$14>>3];
 $16 = $8;
 HEAPF64[$16>>3] = $15;
 $10 = 1;
 while(1) {
  $17 = $10;
  $18 = $7;
  $19 = ($17|0)<($18|0);
  if (!($19)) {
   break;
  }
  $20 = $6;
  $21 = $10;
  $22 = (($20) + ($21<<3)|0);
  $23 = +HEAPF64[$22>>3];
  $24 = $9;
  $25 = +HEAPF64[$24>>3];
  $26 = $23 > $25;
  if ($26) {
   $27 = $6;
   $28 = $10;
   $29 = (($27) + ($28<<3)|0);
   $30 = +HEAPF64[$29>>3];
   $31 = $9;
   HEAPF64[$31>>3] = $30;
  }
  $32 = $6;
  $33 = $10;
  $34 = (($32) + ($33<<3)|0);
  $35 = +HEAPF64[$34>>3];
  $36 = $8;
  $37 = +HEAPF64[$36>>3];
  $38 = $35 < $37;
  if ($38) {
   $39 = $6;
   $40 = $10;
   $41 = (($39) + ($40<<3)|0);
   $42 = +HEAPF64[$41>>3];
   $43 = $8;
   HEAPF64[$43>>3] = $42;
  }
  $44 = $10;
  $45 = (($44) + 1)|0;
  $10 = $45;
 }
 STACKTOP = sp;return;
}
function __ZNK6Signal4MeanEPKdi($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0, $18 = 0, $19 = 0.0, $20 = 0, $21 = 0.0, $22 = 0.0, $3 = 0, $4 = 0, $5 = 0, $6 = 0.0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = 0.0;
 $7 = 0;
 while(1) {
  $8 = $7;
  $9 = $5;
  $10 = ($8|0)<($9|0);
  if (!($10)) {
   break;
  }
  $11 = $4;
  $12 = $7;
  $13 = (($11) + ($12<<3)|0);
  $14 = +HEAPF64[$13>>3];
  $15 = $6;
  $16 = $15 + $14;
  $6 = $16;
  $17 = $7;
  $18 = (($17) + 1)|0;
  $7 = $18;
 }
 $19 = $6;
 $20 = $5;
 $21 = (+($20|0));
 $22 = $19 / $21;
 STACKTOP = sp;return (+$22);
}
function __ZNK6Signal3StdEPKdi($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0, $23 = 0, $24 = 0, $25 = 0.0, $26 = 0.0, $27 = 0.0, $28 = 0.0, $29 = 0.0;
 var $3 = 0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0.0, $34 = 0, $35 = 0, $36 = 0.0, $37 = 0.0, $38 = 0.0, $4 = 0, $5 = 0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $9 = $3;
 $7 = 0.0;
 $10 = $4;
 $11 = $5;
 $12 = (+__ZNK6Signal4MeanEPKdi($9,$10,$11));
 $6 = $12;
 $8 = 0;
 while(1) {
  $13 = $8;
  $14 = $5;
  $15 = ($13|0)<($14|0);
  if (!($15)) {
   break;
  }
  $16 = $4;
  $17 = $8;
  $18 = (($16) + ($17<<3)|0);
  $19 = +HEAPF64[$18>>3];
  $20 = $6;
  $21 = $19 - $20;
  $22 = $4;
  $23 = $8;
  $24 = (($22) + ($23<<3)|0);
  $25 = +HEAPF64[$24>>3];
  $26 = $6;
  $27 = $25 - $26;
  $28 = $21 * $27;
  $29 = $7;
  $30 = $29 + $28;
  $7 = $30;
  $31 = $8;
  $32 = (($31) + 1)|0;
  $8 = $32;
 }
 $33 = $7;
 $34 = $5;
 $35 = (($34) - 1)|0;
 $36 = (+($35|0));
 $37 = $33 / $36;
 $38 = (+Math_sqrt((+$37)));
 STACKTOP = sp;return (+$38);
}
function __ZNK6Signal7MINIMAXEPKdi($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $3;
 $7 = $4;
 $8 = $5;
 $9 = (+__ZNK6Signal3StdEPKdi($6,$7,$8));
 $10 = $5;
 $11 = (+($10|0));
 $12 = (+Math_log((+$11)));
 $13 = 0.18290000000000001 * $12;
 $14 = 0.39360000000000001 + $13;
 $15 = $9 * $14;
 STACKTOP = sp;return (+$15);
}
function __ZNK6Signal8FIXTHRESEPKdi($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $3;
 $7 = $4;
 $8 = $5;
 $9 = (+__ZNK6Signal3StdEPKdi($6,$7,$8));
 $10 = $5;
 $11 = (+($10|0));
 $12 = (+Math_log((+$11)));
 $13 = 2.0 * $12;
 $14 = (+Math_sqrt((+$13)));
 $15 = $9 * $14;
 STACKTOP = sp;return (+$15);
}
function __ZNK6Signal4SUREEPKdi($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0.0, $12 = 0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $3;
 $7 = $4;
 $8 = $5;
 $9 = (+__ZNK6Signal3StdEPKdi($6,$7,$8));
 $10 = $5;
 $11 = (+($10|0));
 $12 = $5;
 $13 = (+($12|0));
 $14 = (+Math_log((+$13)));
 $15 = $11 * $14;
 $16 = (+Math_log((+$15)));
 $17 = 2.0 * $16;
 $18 = (+Math_sqrt((+$17)));
 $19 = $9 * $18;
 STACKTOP = sp;return (+$19);
}
function __ZNK6Signal7DenoiseEPdiiib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $10 = 0, $11 = 0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0.0, $25 = 0, $26 = 0, $27 = 0.0, $28 = 0, $29 = 0;
 var $30 = 0.0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0.0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $50 = 0.0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0.0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0.0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $6 = $0;
 $7 = $1;
 $8 = $2;
 $9 = $3;
 $10 = $4;
 $14 = $5&1;
 $11 = $14;
 $15 = $6;
 $13 = 0;
 while(1) {
  $16 = $13;
  $17 = $8;
  $18 = $9;
  $19 = (($17|0) / ($18|0))&-1;
  $20 = ($16|0)<($19|0);
  if (!($20)) {
   break;
  }
  $21 = $10;
  switch ($21|0) {
  case 0:  {
   $22 = $7;
   $23 = $9;
   $24 = (+__ZNK6Signal7MINIMAXEPKdi($15,$22,$23));
   $12 = $24;
   break;
  }
  case 1:  {
   $25 = $7;
   $26 = $9;
   $27 = (+__ZNK6Signal8FIXTHRESEPKdi($15,$25,$26));
   $12 = $27;
   break;
  }
  case 2:  {
   $28 = $7;
   $29 = $9;
   $30 = (+__ZNK6Signal4SUREEPKdi($15,$28,$29));
   $12 = $30;
   break;
  }
  default: {
  }
  }
  $31 = $11;
  $32 = $31&1;
  $33 = $7;
  $34 = $9;
  $35 = $12;
  if ($32) {
   __ZNK6Signal6SoftTHEPdidd($15,$33,$34,$35,0.0);
  } else {
   __ZNK6Signal6HardTHEPdidd($15,$33,$34,$35,0.0);
  }
  $36 = $9;
  $37 = $7;
  $38 = (($37) + ($36<<3)|0);
  $7 = $38;
  $39 = $13;
  $40 = (($39) + 1)|0;
  $13 = $40;
 }
 $41 = $8;
 $42 = $9;
 $43 = (($41|0) % ($42|0))&-1;
 $44 = ($43|0)>(5);
 if (!($44)) {
  STACKTOP = sp;return;
 }
 $45 = $10;
 switch ($45|0) {
 case 0:  {
  $46 = $7;
  $47 = $8;
  $48 = $9;
  $49 = (($47|0) % ($48|0))&-1;
  $50 = (+__ZNK6Signal7MINIMAXEPKdi($15,$46,$49));
  $12 = $50;
  break;
 }
 case 1:  {
  $51 = $7;
  $52 = $8;
  $53 = $9;
  $54 = (($52|0) % ($53|0))&-1;
  $55 = (+__ZNK6Signal8FIXTHRESEPKdi($15,$51,$54));
  $12 = $55;
  break;
 }
 case 2:  {
  $56 = $7;
  $57 = $8;
  $58 = $9;
  $59 = (($57|0) % ($58|0))&-1;
  $60 = (+__ZNK6Signal4SUREEPKdi($15,$56,$59));
  $12 = $60;
  break;
 }
 default: {
 }
 }
 $61 = $11;
 $62 = $61&1;
 $63 = $7;
 $64 = $8;
 $65 = $9;
 $66 = (($64|0) % ($65|0))&-1;
 $67 = $12;
 if ($62) {
  __ZNK6Signal6SoftTHEPdidd($15,$63,$66,$67,0.0);
  STACKTOP = sp;return;
 } else {
  __ZNK6Signal6HardTHEPdidd($15,$63,$66,$67,0.0);
  STACKTOP = sp;return;
 }
}
function __ZNK6Signal6SoftTHEPdidd($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 $4 = +$4;
 var $$sink = 0.0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0, $24 = 0, $25 = 0.0, $26 = 0.0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0.0, $31 = 0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0.0, $36 = 0, $37 = 0, $38 = 0, $39 = 0.0, $40 = 0.0, $41 = 0.0, $42 = 0, $43 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 $10 = 0;
 while(1) {
  $11 = $10;
  $12 = $7;
  $13 = ($11|0)<($12|0);
  if (!($13)) {
   break;
  }
  $14 = $6;
  $15 = $10;
  $16 = (($14) + ($15<<3)|0);
  $17 = +HEAPF64[$16>>3];
  $18 = (+Math_abs((+$17)));
  $19 = $8;
  $20 = $18 <= $19;
  if ($20) {
   $21 = $9;
   $22 = $6;
   $23 = $10;
   $24 = (($22) + ($23<<3)|0);
   $25 = +HEAPF64[$24>>3];
   $26 = $25 * $21;
   HEAPF64[$24>>3] = $26;
  } else {
   $27 = $6;
   $28 = $10;
   $29 = (($27) + ($28<<3)|0);
   $30 = +HEAPF64[$29>>3];
   $31 = $30 > 0.0;
   $32 = $8;
   $33 = $9;
   $34 = 1.0 - $33;
   $35 = $32 * $34;
   $36 = $6;
   $37 = $10;
   $38 = (($36) + ($37<<3)|0);
   $39 = +HEAPF64[$38>>3];
   $40 = $39 + $35;
   $41 = $39 - $35;
   $$sink = $31 ? $41 : $40;
   HEAPF64[$38>>3] = $$sink;
  }
  $42 = $10;
  $43 = (($42) + 1)|0;
  $10 = $43;
 }
 STACKTOP = sp;return;
}
function __ZNK6Signal6HardTHEPdidd($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 $4 = +$4;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0, $24 = 0, $25 = 0.0, $26 = 0.0, $27 = 0, $28 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 $10 = 0;
 while(1) {
  $11 = $10;
  $12 = $7;
  $13 = ($11|0)<($12|0);
  if (!($13)) {
   break;
  }
  $14 = $6;
  $15 = $10;
  $16 = (($14) + ($15<<3)|0);
  $17 = +HEAPF64[$16>>3];
  $18 = (+Math_abs((+$17)));
  $19 = $8;
  $20 = $18 <= $19;
  if ($20) {
   $21 = $9;
   $22 = $6;
   $23 = $10;
   $24 = (($22) + ($23<<3)|0);
   $25 = +HEAPF64[$24>>3];
   $26 = $25 * $21;
   HEAPF64[$24>>3] = $26;
  }
  $27 = $10;
  $28 = (($27) + 1)|0;
  $10 = $28;
 }
 STACKTOP = sp;return;
}
function __ZN3FWTD0Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $4 = $1;
 __THREW__ = 0;
 invoke_vi(3,($4|0));
 $5 = __THREW__; __THREW__ = 0;
 $6 = $5&1;
 if ($6) {
  $7 = ___cxa_find_matching_catch_2()|0;
  $8 = tempRet0;
  $2 = $7;
  $3 = $8;
  __ZdlPv($4);
  $9 = $2;
  $10 = $3;
  ___resumeException($9|0);
  // unreachable;
 } else {
  __ZdlPv($4);
  STACKTOP = sp;return;
 }
}
function __ZN3FWTD2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $4 = $1;
 HEAP32[$4>>2] = (30988);
 $5 = ((($4)) + 112|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($6|0)!=(0|0);
 if ($7) {
  $8 = ((($4)) + 112|0);
  $9 = HEAP32[$8>>2]|0;
  __THREW__ = 0;
  invoke_vi(35,($9|0));
  $10 = __THREW__; __THREW__ = 0;
  $11 = $10&1;
  if (!($11)) {
   label = 4;
  }
 } else {
  label = 4;
 }
 do {
  if ((label|0) == 4) {
   $16 = ((($4)) + 116|0);
   $17 = HEAP32[$16>>2]|0;
   $18 = ($17|0)!=(0|0);
   if ($18) {
    $19 = ((($4)) + 116|0);
    $20 = HEAP32[$19>>2]|0;
    __THREW__ = 0;
    invoke_vi(35,($20|0));
    $21 = __THREW__; __THREW__ = 0;
    $22 = $21&1;
    if ($22) {
     break;
    }
   }
   $23 = ((($4)) + 100|0);
   $24 = HEAP32[$23>>2]|0;
   $25 = ($24|0)!=(0|0);
   if (!($25)) {
    __ZN6SignalD2Ev($4);
    STACKTOP = sp;return;
   }
   $26 = ((($4)) + 100|0);
   $27 = HEAP32[$26>>2]|0;
   $28 = ($27|0)==(0|0);
   if ($28) {
    __ZN6SignalD2Ev($4);
    STACKTOP = sp;return;
   }
   __ZdaPv($27);
   __ZN6SignalD2Ev($4);
   STACKTOP = sp;return;
  }
 } while(0);
 $12 = ___cxa_find_matching_catch_2()|0;
 $13 = tempRet0;
 $2 = $12;
 $3 = $13;
 __THREW__ = 0;
 invoke_vi(1,($4|0));
 $14 = __THREW__; __THREW__ = 0;
 $15 = $14&1;
 if ($15) {
  $31 = ___cxa_find_matching_catch_3(0|0)|0;
  $32 = tempRet0;
  ___clang_call_terminate($31);
  // unreachable;
 } else {
  $29 = $2;
  $30 = $3;
  ___resumeException($29|0);
  // unreachable;
 }
}
function ___clang_call_terminate($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 (___cxa_begin_catch(($0|0))|0);
 __ZSt9terminatev();
 // unreachable;
}
function __ZN3FWTC2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 __ZN6SignalC2Ev($2);
 HEAP32[$2>>2] = (30988);
 $3 = ((($2)) + 48|0);
 HEAP32[$3>>2] = 0;
 $4 = ((($2)) + 52|0);
 HEAP32[$4>>2] = 0;
 $5 = ((($2)) + 56|0);
 HEAP32[$5>>2] = 0;
 $6 = ((($2)) + 60|0);
 HEAP32[$6>>2] = 0;
 $7 = ((($2)) + 64|0);
 HEAP32[$7>>2] = 0;
 $8 = ((($2)) + 68|0);
 HEAP32[$8>>2] = 0;
 $9 = ((($2)) + 72|0);
 HEAP32[$9>>2] = 0;
 $10 = ((($2)) + 76|0);
 HEAP32[$10>>2] = 0;
 $11 = ((($2)) + 80|0);
 HEAP32[$11>>2] = 0;
 $12 = ((($2)) + 84|0);
 HEAP32[$12>>2] = 0;
 $13 = ((($2)) + 88|0);
 HEAP32[$13>>2] = 0;
 $14 = ((($2)) + 92|0);
 HEAP32[$14>>2] = 0;
 $15 = ((($2)) + 96|0);
 HEAP32[$15>>2] = 0;
 $16 = ((($2)) + 100|0);
 HEAP32[$16>>2] = 0;
 $17 = ((($2)) + 112|0);
 HEAP32[$17>>2] = 0;
 $18 = ((($2)) + 116|0);
 HEAP32[$18>>2] = 0;
 STACKTOP = sp;return;
}
function __ZN3FWT7InitFWTE10FilterEnumPKdi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$expand_i1_val = 0, $$expand_i1_val2 = 0, $$pre_trunc = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0.0, $111 = 0, $112 = 0, $113 = 0, $114 = 0;
 var $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0.0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0.0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0.0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0.0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0.0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0.0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0.0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $4 = sp + 24|0;
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $11 = $5;
 $12 = $6;
 $9 = $12;
 $13 = $9;
 $14 = ($13|0)>=(0);
 if (!($14)) {
  $$expand_i1_val2 = 0;
  HEAP8[$4>>0] = $$expand_i1_val2;
  $$pre_trunc = HEAP8[$4>>0]|0;
  $122 = $$pre_trunc&1;
  STACKTOP = sp;return ($122|0);
 }
 $15 = $9;
 $16 = (40 + (($15*960)|0)|0);
 $17 = +HEAPF64[$16>>3];
 $18 = (~~(($17)));
 $19 = ((($11)) + 64|0);
 HEAP32[$19>>2] = $18;
 $20 = $9;
 $21 = (40 + (($20*960)|0)|0);
 $22 = ((($21)) + 8|0);
 $23 = +HEAPF64[$22>>3];
 $24 = (~~(($23)));
 $25 = ((($11)) + 80|0);
 HEAP32[$25>>2] = $24;
 $26 = $9;
 $27 = (40 + (($26*960)|0)|0);
 $28 = ((($27)) + 16|0);
 $29 = ((($11)) + 48|0);
 HEAP32[$29>>2] = $28;
 $30 = $9;
 $31 = (40 + (($30*960)|0)|0);
 $32 = ((($31)) + 240|0);
 $33 = +HEAPF64[$32>>3];
 $34 = (~~(($33)));
 $35 = ((($11)) + 68|0);
 HEAP32[$35>>2] = $34;
 $36 = $9;
 $37 = (40 + (($36*960)|0)|0);
 $38 = ((($37)) + 240|0);
 $39 = ((($38)) + 8|0);
 $40 = +HEAPF64[$39>>3];
 $41 = (~~(($40)));
 $42 = ((($11)) + 84|0);
 HEAP32[$42>>2] = $41;
 $43 = $9;
 $44 = (40 + (($43*960)|0)|0);
 $45 = ((($44)) + 240|0);
 $46 = ((($45)) + 16|0);
 $47 = ((($11)) + 52|0);
 HEAP32[$47>>2] = $46;
 $48 = $9;
 $49 = (40 + (($48*960)|0)|0);
 $50 = ((($49)) + 480|0);
 $51 = +HEAPF64[$50>>3];
 $52 = (~~(($51)));
 $53 = ((($11)) + 72|0);
 HEAP32[$53>>2] = $52;
 $54 = $9;
 $55 = (40 + (($54*960)|0)|0);
 $56 = ((($55)) + 480|0);
 $57 = ((($56)) + 8|0);
 $58 = +HEAPF64[$57>>3];
 $59 = (~~(($58)));
 $60 = ((($11)) + 88|0);
 HEAP32[$60>>2] = $59;
 $61 = $9;
 $62 = (40 + (($61*960)|0)|0);
 $63 = ((($62)) + 480|0);
 $64 = ((($63)) + 16|0);
 $65 = ((($11)) + 56|0);
 HEAP32[$65>>2] = $64;
 $66 = $9;
 $67 = (40 + (($66*960)|0)|0);
 $68 = ((($67)) + 720|0);
 $69 = +HEAPF64[$68>>3];
 $70 = (~~(($69)));
 $71 = ((($11)) + 76|0);
 HEAP32[$71>>2] = $70;
 $72 = $9;
 $73 = (40 + (($72*960)|0)|0);
 $74 = ((($73)) + 720|0);
 $75 = ((($74)) + 8|0);
 $76 = +HEAPF64[$75>>3];
 $77 = (~~(($76)));
 $78 = ((($11)) + 92|0);
 HEAP32[$78>>2] = $77;
 $79 = $9;
 $80 = (40 + (($79*960)|0)|0);
 $81 = ((($80)) + 720|0);
 $82 = ((($81)) + 16|0);
 $83 = ((($11)) + 60|0);
 HEAP32[$83>>2] = $82;
 $84 = $8;
 $85 = ((($11)) + 108|0);
 HEAP32[$85>>2] = $84;
 $86 = $8;
 $87 = ((($11)) + 104|0);
 HEAP32[$87>>2] = $86;
 $88 = $8;
 $89 = $88<<3;
 $90 = (_malloc($89)|0);
 $91 = ((($11)) + 112|0);
 HEAP32[$91>>2] = $90;
 $92 = $8;
 $93 = $92<<3;
 $94 = (_malloc($93)|0);
 $95 = ((($11)) + 116|0);
 HEAP32[$95>>2] = $94;
 $96 = ((($11)) + 116|0);
 $97 = HEAP32[$96>>2]|0;
 $98 = ((($11)) + 124|0);
 HEAP32[$98>>2] = $97;
 $99 = ((($11)) + 116|0);
 $100 = HEAP32[$99>>2]|0;
 $101 = $8;
 $102 = (($100) + ($101<<3)|0);
 $103 = ((($11)) + 120|0);
 HEAP32[$103>>2] = $102;
 $10 = 0;
 while(1) {
  $104 = $10;
  $105 = $8;
  $106 = ($104|0)<($105|0);
  if (!($106)) {
   break;
  }
  $107 = $7;
  $108 = $10;
  $109 = (($107) + ($108<<3)|0);
  $110 = +HEAPF64[$109>>3];
  $111 = ((($11)) + 112|0);
  $112 = HEAP32[$111>>2]|0;
  $113 = $10;
  $114 = (($112) + ($113<<3)|0);
  HEAPF64[$114>>3] = $110;
  $115 = $10;
  $116 = (($115) + 1)|0;
  $10 = $116;
 }
 $117 = ((($11)) + 116|0);
 $118 = HEAP32[$117>>2]|0;
 $119 = $8;
 $120 = $119<<3;
 _memset(($118|0),0,($120|0))|0;
 $121 = ((($11)) + 96|0);
 HEAP32[$121>>2] = 0;
 $$expand_i1_val = 1;
 HEAP8[$4>>0] = $$expand_i1_val;
 $$pre_trunc = HEAP8[$4>>0]|0;
 $122 = $$pre_trunc&1;
 STACKTOP = sp;return ($122|0);
}
function __ZN3FWT8CloseFWTEv($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 $3 = ((($2)) + 112|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)!=(0|0);
 if ($5) {
  $6 = ((($2)) + 112|0);
  $7 = HEAP32[$6>>2]|0;
  _free($7);
  $8 = ((($2)) + 112|0);
  HEAP32[$8>>2] = 0;
 }
 $9 = ((($2)) + 116|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ($10|0)!=(0|0);
 if ($11) {
  $12 = ((($2)) + 116|0);
  $13 = HEAP32[$12>>2]|0;
  _free($13);
  $14 = ((($2)) + 116|0);
  HEAP32[$14>>2] = 0;
 }
 $15 = ((($2)) + 100|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ($16|0)!=(0|0);
 if (!($17)) {
  STACKTOP = sp;return;
 }
 $18 = ((($2)) + 100|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ($19|0)==(0|0);
 if (!($20)) {
  __ZdaPv($19);
 }
 $21 = ((($2)) + 100|0);
 HEAP32[$21>>2] = 0;
 STACKTOP = sp;return;
}
function __ZN3FWT9HiLoTransEv($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0.0, $104 = 0.0, $105 = 0.0, $106 = 0.0, $107 = 0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0.0, $115 = 0, $116 = 0;
 var $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0.0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0;
 var $135 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0.0, $30 = 0;
 var $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0.0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $5 = 0, $50 = 0, $51 = 0.0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0.0, $57 = 0.0, $58 = 0.0, $59 = 0.0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0;
 var $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0;
 var $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0.0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $1 = $0;
 $9 = $1;
 $5 = 0;
 while(1) {
  $10 = $5;
  $11 = ((($9)) + 108|0);
  $12 = HEAP32[$11>>2]|0;
  $13 = (($12|0) / 2)&-1;
  $14 = ($10|0)<($13|0);
  if (!($14)) {
   break;
  }
  $3 = 0.0;
  $4 = 0.0;
  $15 = ((($9)) + 80|0);
  $16 = HEAP32[$15>>2]|0;
  $17 = (0 - ($16))|0;
  $6 = $17;
  while(1) {
   $18 = $6;
   $19 = ((($9)) + 64|0);
   $20 = HEAP32[$19>>2]|0;
   $21 = ((($9)) + 80|0);
   $22 = HEAP32[$21>>2]|0;
   $23 = (($20) - ($22))|0;
   $24 = ($18|0)<($23|0);
   if (!($24)) {
    break;
   }
   $25 = $5;
   $26 = $25<<1;
   $27 = $6;
   $28 = (($26) + ($27))|0;
   $2 = $28;
   $29 = $2;
   $30 = ($29|0)<(0);
   if ($30) {
    $31 = $2;
    $32 = (0 - ($31))|0;
    $2 = $32;
   }
   $33 = $2;
   $34 = ((($9)) + 108|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = ($33|0)>=($35|0);
   if ($36) {
    $37 = $2;
    $38 = (2 + ($37))|0;
    $39 = ((($9)) + 108|0);
    $40 = HEAP32[$39>>2]|0;
    $41 = (($38) - ($40))|0;
    $42 = $2;
    $43 = (($42) - ($41))|0;
    $2 = $43;
   }
   $44 = ((($9)) + 48|0);
   $45 = HEAP32[$44>>2]|0;
   $46 = $6;
   $47 = ((($9)) + 80|0);
   $48 = HEAP32[$47>>2]|0;
   $49 = (($46) + ($48))|0;
   $50 = (($45) + ($49<<3)|0);
   $51 = +HEAPF64[$50>>3];
   $52 = ((($9)) + 112|0);
   $53 = HEAP32[$52>>2]|0;
   $54 = $2;
   $55 = (($53) + ($54<<3)|0);
   $56 = +HEAPF64[$55>>3];
   $57 = $51 * $56;
   $58 = $3;
   $59 = $58 + $57;
   $3 = $59;
   $60 = $6;
   $61 = (($60) + 1)|0;
   $6 = $61;
  }
  $62 = ((($9)) + 84|0);
  $63 = HEAP32[$62>>2]|0;
  $64 = (0 - ($63))|0;
  $7 = $64;
  while(1) {
   $65 = $7;
   $66 = ((($9)) + 68|0);
   $67 = HEAP32[$66>>2]|0;
   $68 = ((($9)) + 84|0);
   $69 = HEAP32[$68>>2]|0;
   $70 = (($67) - ($69))|0;
   $71 = ($65|0)<($70|0);
   if (!($71)) {
    break;
   }
   $72 = $5;
   $73 = $72<<1;
   $74 = $7;
   $75 = (($73) + ($74))|0;
   $2 = $75;
   $76 = $2;
   $77 = ($76|0)<(0);
   if ($77) {
    $78 = $2;
    $79 = (0 - ($78))|0;
    $2 = $79;
   }
   $80 = $2;
   $81 = ((($9)) + 108|0);
   $82 = HEAP32[$81>>2]|0;
   $83 = ($80|0)>=($82|0);
   if ($83) {
    $84 = $2;
    $85 = (2 + ($84))|0;
    $86 = ((($9)) + 108|0);
    $87 = HEAP32[$86>>2]|0;
    $88 = (($85) - ($87))|0;
    $89 = $2;
    $90 = (($89) - ($88))|0;
    $2 = $90;
   }
   $91 = ((($9)) + 52|0);
   $92 = HEAP32[$91>>2]|0;
   $93 = $7;
   $94 = ((($9)) + 84|0);
   $95 = HEAP32[$94>>2]|0;
   $96 = (($93) + ($95))|0;
   $97 = (($92) + ($96<<3)|0);
   $98 = +HEAPF64[$97>>3];
   $99 = ((($9)) + 112|0);
   $100 = HEAP32[$99>>2]|0;
   $101 = $2;
   $102 = (($100) + ($101<<3)|0);
   $103 = +HEAPF64[$102>>3];
   $104 = $98 * $103;
   $105 = $4;
   $106 = $105 + $104;
   $4 = $106;
   $107 = $7;
   $108 = (($107) + 1)|0;
   $7 = $108;
  }
  $109 = $3;
  $110 = ((($9)) + 124|0);
  $111 = HEAP32[$110>>2]|0;
  $112 = $5;
  $113 = (($111) + ($112<<3)|0);
  HEAPF64[$113>>3] = $109;
  $114 = $4;
  $115 = ((($9)) + 120|0);
  $116 = HEAP32[$115>>2]|0;
  $117 = $5;
  $118 = (($116) + ($117<<3)|0);
  HEAPF64[$118>>3] = $114;
  $119 = $5;
  $120 = (($119) + 1)|0;
  $5 = $120;
 }
 $8 = 0;
 while(1) {
  $121 = $8;
  $122 = ((($9)) + 104|0);
  $123 = HEAP32[$122>>2]|0;
  $124 = ($121|0)<($123|0);
  if (!($124)) {
   break;
  }
  $125 = ((($9)) + 116|0);
  $126 = HEAP32[$125>>2]|0;
  $127 = $8;
  $128 = (($126) + ($127<<3)|0);
  $129 = +HEAPF64[$128>>3];
  $130 = ((($9)) + 112|0);
  $131 = HEAP32[$130>>2]|0;
  $132 = $8;
  $133 = (($131) + ($132<<3)|0);
  HEAPF64[$133>>3] = $129;
  $134 = $8;
  $135 = (($134) + 1)|0;
  $8 = $135;
 }
 STACKTOP = sp;return;
}
function __ZN3FWT8FwtTransEi($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $5 = $2;
 $4 = 0;
 while(1) {
  $6 = $4;
  $7 = $3;
  $8 = ($6|0)<($7|0);
  if (!($8)) {
   break;
  }
  $9 = ((($5)) + 108|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = (($10|0) / 2)&-1;
  $12 = ((($5)) + 120|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = (0 - ($11))|0;
  $15 = (($13) + ($14<<3)|0);
  HEAP32[$12>>2] = $15;
  __ZN3FWT9HiLoTransEv($5);
  $16 = ((($5)) + 108|0);
  $17 = HEAP32[$16>>2]|0;
  $18 = (($17|0) / 2)&-1;
  HEAP32[$16>>2] = $18;
  $19 = ((($5)) + 96|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = (($20) + 1)|0;
  HEAP32[$19>>2] = $21;
  $22 = $4;
  $23 = (($22) + 1)|0;
  $4 = $23;
 }
 STACKTOP = sp;return;
}
function __ZN3FWT9HiLoSynthEv($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0.0, $114 = 0, $115 = 0, $116 = 0;
 var $117 = 0, $118 = 0.0, $119 = 0.0, $12 = 0, $120 = 0.0, $121 = 0.0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0;
 var $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0;
 var $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0;
 var $171 = 0, $172 = 0, $173 = 0, $174 = 0.0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0.0, $18 = 0.0, $180 = 0.0, $181 = 0.0, $182 = 0.0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0;
 var $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0;
 var $207 = 0, $208 = 0.0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0.0, $214 = 0.0, $215 = 0.0, $216 = 0.0, $217 = 0, $218 = 0, $219 = 0.0, $22 = 0, $220 = 0.0, $221 = 0, $222 = 0, $223 = 0, $224 = 0;
 var $225 = 0, $226 = 0.0, $227 = 0.0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0.0, $30 = 0;
 var $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0.0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0;
 var $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0.0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0.0, $85 = 0.0;
 var $86 = 0.0, $87 = 0.0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $1 = $0;
 $9 = $1;
 $5 = 0;
 while(1) {
  $10 = $5;
  $11 = ((($9)) + 104|0);
  $12 = HEAP32[$11>>2]|0;
  $13 = ($10|0)<($12|0);
  if (!($13)) {
   break;
  }
  $14 = ((($9)) + 112|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = $5;
  $17 = (($15) + ($16<<3)|0);
  $18 = +HEAPF64[$17>>3];
  $19 = ((($9)) + 116|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = $5;
  $22 = (($20) + ($21<<3)|0);
  HEAPF64[$22>>3] = $18;
  $23 = $5;
  $24 = (($23) + 1)|0;
  $5 = $24;
 }
 $6 = 0;
 while(1) {
  $25 = $6;
  $26 = ((($9)) + 108|0);
  $27 = HEAP32[$26>>2]|0;
  $28 = ($25|0)<($27|0);
  if (!($28)) {
   break;
  }
  $3 = 0.0;
  $4 = 0.0;
  $29 = ((($9)) + 88|0);
  $30 = HEAP32[$29>>2]|0;
  $31 = (0 - ($30))|0;
  $7 = $31;
  while(1) {
   $32 = $7;
   $33 = ((($9)) + 72|0);
   $34 = HEAP32[$33>>2]|0;
   $35 = ((($9)) + 88|0);
   $36 = HEAP32[$35>>2]|0;
   $37 = (($34) - ($36))|0;
   $38 = ($32|0)<($37|0);
   if (!($38)) {
    break;
   }
   $39 = $6;
   $40 = $7;
   $41 = (($39) - ($40))|0;
   $2 = $41;
   $42 = $2;
   $43 = ($42|0)<(0);
   if ($43) {
    $44 = $2;
    $45 = (0 - ($44))|0;
    $2 = $45;
   }
   $46 = $2;
   $47 = ((($9)) + 108|0);
   $48 = HEAP32[$47>>2]|0;
   $49 = ($46|0)>=($48|0);
   if ($49) {
    $50 = $2;
    $51 = (2 + ($50))|0;
    $52 = ((($9)) + 108|0);
    $53 = HEAP32[$52>>2]|0;
    $54 = (($51) - ($53))|0;
    $55 = $2;
    $56 = (($55) - ($54))|0;
    $2 = $56;
   }
   $57 = $7;
   $58 = $57<<1;
   $59 = ((($9)) + 88|0);
   $60 = HEAP32[$59>>2]|0;
   $61 = (0 - ($60))|0;
   $62 = ($58|0)>=($61|0);
   if ($62) {
    $63 = $7;
    $64 = $63<<1;
    $65 = ((($9)) + 72|0);
    $66 = HEAP32[$65>>2]|0;
    $67 = ((($9)) + 88|0);
    $68 = HEAP32[$67>>2]|0;
    $69 = (($66) - ($68))|0;
    $70 = ($64|0)<($69|0);
    if ($70) {
     $71 = ((($9)) + 56|0);
     $72 = HEAP32[$71>>2]|0;
     $73 = $7;
     $74 = $73<<1;
     $75 = ((($9)) + 88|0);
     $76 = HEAP32[$75>>2]|0;
     $77 = (($74) + ($76))|0;
     $78 = (($72) + ($77<<3)|0);
     $79 = +HEAPF64[$78>>3];
     $80 = ((($9)) + 124|0);
     $81 = HEAP32[$80>>2]|0;
     $82 = $2;
     $83 = (($81) + ($82<<3)|0);
     $84 = +HEAPF64[$83>>3];
     $85 = $79 * $84;
     $86 = $3;
     $87 = $86 + $85;
     $3 = $87;
    }
   }
   $88 = $7;
   $89 = $88<<1;
   $90 = (($89) + 1)|0;
   $91 = ((($9)) + 88|0);
   $92 = HEAP32[$91>>2]|0;
   $93 = (0 - ($92))|0;
   $94 = ($90|0)>=($93|0);
   if ($94) {
    $95 = $7;
    $96 = $95<<1;
    $97 = (($96) + 1)|0;
    $98 = ((($9)) + 72|0);
    $99 = HEAP32[$98>>2]|0;
    $100 = ((($9)) + 88|0);
    $101 = HEAP32[$100>>2]|0;
    $102 = (($99) - ($101))|0;
    $103 = ($97|0)<($102|0);
    if ($103) {
     $104 = ((($9)) + 56|0);
     $105 = HEAP32[$104>>2]|0;
     $106 = $7;
     $107 = $106<<1;
     $108 = (($107) + 1)|0;
     $109 = ((($9)) + 88|0);
     $110 = HEAP32[$109>>2]|0;
     $111 = (($108) + ($110))|0;
     $112 = (($105) + ($111<<3)|0);
     $113 = +HEAPF64[$112>>3];
     $114 = ((($9)) + 124|0);
     $115 = HEAP32[$114>>2]|0;
     $116 = $2;
     $117 = (($115) + ($116<<3)|0);
     $118 = +HEAPF64[$117>>3];
     $119 = $113 * $118;
     $120 = $4;
     $121 = $120 + $119;
     $4 = $121;
    }
   }
   $122 = $7;
   $123 = (($122) + 1)|0;
   $7 = $123;
  }
  $124 = ((($9)) + 92|0);
  $125 = HEAP32[$124>>2]|0;
  $126 = (0 - ($125))|0;
  $8 = $126;
  while(1) {
   $127 = $8;
   $128 = ((($9)) + 76|0);
   $129 = HEAP32[$128>>2]|0;
   $130 = ((($9)) + 92|0);
   $131 = HEAP32[$130>>2]|0;
   $132 = (($129) - ($131))|0;
   $133 = ($127|0)<($132|0);
   if (!($133)) {
    break;
   }
   $134 = $6;
   $135 = $8;
   $136 = (($134) - ($135))|0;
   $2 = $136;
   $137 = $2;
   $138 = ($137|0)<(0);
   if ($138) {
    $139 = $2;
    $140 = (0 - ($139))|0;
    $2 = $140;
   }
   $141 = $2;
   $142 = ((($9)) + 108|0);
   $143 = HEAP32[$142>>2]|0;
   $144 = ($141|0)>=($143|0);
   if ($144) {
    $145 = $2;
    $146 = (2 + ($145))|0;
    $147 = ((($9)) + 108|0);
    $148 = HEAP32[$147>>2]|0;
    $149 = (($146) - ($148))|0;
    $150 = $2;
    $151 = (($150) - ($149))|0;
    $2 = $151;
   }
   $152 = $8;
   $153 = $152<<1;
   $154 = ((($9)) + 92|0);
   $155 = HEAP32[$154>>2]|0;
   $156 = (0 - ($155))|0;
   $157 = ($153|0)>=($156|0);
   if ($157) {
    $158 = $8;
    $159 = $158<<1;
    $160 = ((($9)) + 76|0);
    $161 = HEAP32[$160>>2]|0;
    $162 = ((($9)) + 92|0);
    $163 = HEAP32[$162>>2]|0;
    $164 = (($161) - ($163))|0;
    $165 = ($159|0)<($164|0);
    if ($165) {
     $166 = ((($9)) + 60|0);
     $167 = HEAP32[$166>>2]|0;
     $168 = $8;
     $169 = $168<<1;
     $170 = ((($9)) + 92|0);
     $171 = HEAP32[$170>>2]|0;
     $172 = (($169) + ($171))|0;
     $173 = (($167) + ($172<<3)|0);
     $174 = +HEAPF64[$173>>3];
     $175 = ((($9)) + 120|0);
     $176 = HEAP32[$175>>2]|0;
     $177 = $2;
     $178 = (($176) + ($177<<3)|0);
     $179 = +HEAPF64[$178>>3];
     $180 = $174 * $179;
     $181 = $3;
     $182 = $181 + $180;
     $3 = $182;
    }
   }
   $183 = $8;
   $184 = $183<<1;
   $185 = (($184) + 1)|0;
   $186 = ((($9)) + 92|0);
   $187 = HEAP32[$186>>2]|0;
   $188 = (0 - ($187))|0;
   $189 = ($185|0)>=($188|0);
   if ($189) {
    $190 = $8;
    $191 = $190<<1;
    $192 = (($191) + 1)|0;
    $193 = ((($9)) + 76|0);
    $194 = HEAP32[$193>>2]|0;
    $195 = ((($9)) + 92|0);
    $196 = HEAP32[$195>>2]|0;
    $197 = (($194) - ($196))|0;
    $198 = ($192|0)<($197|0);
    if ($198) {
     $199 = ((($9)) + 60|0);
     $200 = HEAP32[$199>>2]|0;
     $201 = $8;
     $202 = $201<<1;
     $203 = (($202) + 1)|0;
     $204 = ((($9)) + 92|0);
     $205 = HEAP32[$204>>2]|0;
     $206 = (($203) + ($205))|0;
     $207 = (($200) + ($206<<3)|0);
     $208 = +HEAPF64[$207>>3];
     $209 = ((($9)) + 120|0);
     $210 = HEAP32[$209>>2]|0;
     $211 = $2;
     $212 = (($210) + ($211<<3)|0);
     $213 = +HEAPF64[$212>>3];
     $214 = $208 * $213;
     $215 = $4;
     $216 = $215 + $214;
     $4 = $216;
    }
   }
   $217 = $8;
   $218 = (($217) + 1)|0;
   $8 = $218;
  }
  $219 = $3;
  $220 = 2.0 * $219;
  $221 = ((($9)) + 112|0);
  $222 = HEAP32[$221>>2]|0;
  $223 = $6;
  $224 = $223<<1;
  $225 = (($222) + ($224<<3)|0);
  HEAPF64[$225>>3] = $220;
  $226 = $4;
  $227 = 2.0 * $226;
  $228 = ((($9)) + 112|0);
  $229 = HEAP32[$228>>2]|0;
  $230 = $6;
  $231 = $230<<1;
  $232 = (($231) + 1)|0;
  $233 = (($229) + ($232<<3)|0);
  HEAPF64[$233>>3] = $227;
  $234 = $6;
  $235 = (($234) + 1)|0;
  $6 = $235;
 }
 STACKTOP = sp;return;
}
function __ZN3FWT8FwtSynthEi($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $5 = $2;
 $4 = 0;
 while(1) {
  $6 = $4;
  $7 = $3;
  $8 = ($6|0)<($7|0);
  if (!($8)) {
   break;
  }
  __ZN3FWT9HiLoSynthEv($5);
  $9 = ((($5)) + 100|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = $4;
  $12 = (($10) + ($11<<2)|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ((($5)) + 120|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = (($15) + ($13<<3)|0);
  HEAP32[$14>>2] = $16;
  $17 = ((($5)) + 108|0);
  $18 = HEAP32[$17>>2]|0;
  $19 = $18<<1;
  HEAP32[$17>>2] = $19;
  $20 = ((($5)) + 96|0);
  $21 = HEAP32[$20>>2]|0;
  $22 = (($21) + -1)|0;
  HEAP32[$20>>2] = $22;
  $23 = $4;
  $24 = (($23) + 1)|0;
  $4 = $24;
 }
 STACKTOP = sp;return;
}
function __ZN3FWT9GetJnumbsEii($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$arith = 0, $$overflow = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0.0;
 var $28 = 0, $29 = 0.0, $3 = 0, $30 = 0.0, $31 = 0.0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0.0, $40 = 0, $41 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $9 = $5;
 $10 = ((($9)) + 100|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ($11|0)!=(0|0);
 if ($12) {
  $13 = ((($9)) + 100|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = ($14|0)==(0|0);
  if (!($15)) {
   __ZdaPv($14);
  }
 }
 $16 = $6;
 $$arith = $16<<2;
 $$overflow = ($16>>>0)>(1073741823);
 $17 = $$overflow ? -1 : $$arith;
 $18 = (__Znaj($17)|0);
 $19 = ((($9)) + 100|0);
 HEAP32[$19>>2] = $18;
 $8 = 0;
 while(1) {
  $20 = $8;
  $21 = $6;
  $22 = ($20|0)<($21|0);
  if (!($22)) {
   break;
  }
  $23 = $7;
  $24 = $6;
  $25 = $8;
  $26 = (($24) - ($25))|0;
  $27 = (+($26|0));
  $3 = 2;
  $4 = $27;
  $28 = $3;
  $29 = (+($28|0));
  $30 = $4;
  $31 = (+Math_pow((+$29),(+$30)));
  $32 = (~~(($31)));
  $33 = (($23|0) / ($32|0))&-1;
  $34 = ((($9)) + 100|0);
  $35 = HEAP32[$34>>2]|0;
  $36 = $8;
  $37 = (($35) + ($36<<2)|0);
  HEAP32[$37>>2] = $33;
  $38 = $8;
  $39 = (($38) + 1)|0;
  $8 = $39;
 }
 $40 = ((($9)) + 100|0);
 $41 = HEAP32[$40>>2]|0;
 STACKTOP = sp;return ($41|0);
}
function __ZNK3FWT9HiLoNumbsEiiRiS0_($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 $11 = $9;
 HEAP32[$11>>2] = 0;
 $12 = $8;
 HEAP32[$12>>2] = 0;
 $10 = 0;
 while(1) {
  $13 = $10;
  $14 = $6;
  $15 = ($13|0)<($14|0);
  $16 = $7;
  if (!($15)) {
   break;
  }
  $17 = (($16|0) / 2)&-1;
  $7 = $17;
  $18 = $7;
  $19 = $8;
  $20 = HEAP32[$19>>2]|0;
  $21 = (($20) + ($18))|0;
  HEAP32[$19>>2] = $21;
  $22 = $10;
  $23 = (($22) + 1)|0;
  $10 = $23;
 }
 $24 = $9;
 HEAP32[$24>>2] = $16;
 STACKTOP = sp;return;
}
function __ZN10EcgDenoiseD0Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $4 = $1;
 __THREW__ = 0;
 invoke_vi(5,($4|0));
 $5 = __THREW__; __THREW__ = 0;
 $6 = $5&1;
 if ($6) {
  $7 = ___cxa_find_matching_catch_2()|0;
  $8 = tempRet0;
  $2 = $7;
  $3 = $8;
  __ZdlPv($4);
  $9 = $2;
  $10 = $3;
  ___resumeException($9|0);
  // unreachable;
 } else {
  __ZdlPv($4);
  STACKTOP = sp;return;
 }
}
function __ZN10EcgDenoiseD2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $4 = $1;
 HEAP32[$4>>2] = (31004);
 $5 = ((($4)) + 140|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($6|0)!=(0|0);
 if (!($7)) {
  __ZN3FWTD2Ev($4);
  STACKTOP = sp;return;
 }
 $8 = ((($4)) + 140|0);
 $9 = HEAP32[$8>>2]|0;
 __THREW__ = 0;
 invoke_vi(35,($9|0));
 $10 = __THREW__; __THREW__ = 0;
 $11 = $10&1;
 if (!($11)) {
  __ZN3FWTD2Ev($4);
  STACKTOP = sp;return;
 }
 $12 = ___cxa_find_matching_catch_2()|0;
 $13 = tempRet0;
 $2 = $12;
 $3 = $13;
 __THREW__ = 0;
 invoke_vi(3,($4|0));
 $14 = __THREW__; __THREW__ = 0;
 $15 = $14&1;
 if ($15) {
  $18 = ___cxa_find_matching_catch_3(0|0)|0;
  $19 = tempRet0;
  ___clang_call_terminate($18);
  // unreachable;
 } else {
  $16 = $2;
  $17 = $3;
  ___resumeException($16|0);
  // unreachable;
 }
}
function __ZN10EcgDenoiseC2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 __ZN3FWTC2Ev($2);
 HEAP32[$2>>2] = (31004);
 $3 = ((($2)) + 140|0);
 HEAP32[$3>>2] = 0;
 STACKTOP = sp;return;
}
function __ZN10EcgDenoise11InitDenoiseEPdidb($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 $4 = $4|0;
 var $10 = 0, $100 = 0.0, $101 = 0.0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0.0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0.0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0.0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0.0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0.0, $142 = 0, $143 = 0.0, $144 = 0.0, $145 = 0, $146 = 0, $147 = 0.0, $148 = 0, $149 = 0, $15 = 0, $150 = 0.0, $151 = 0, $152 = 0.0, $153 = 0.0;
 var $154 = 0.0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0.0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $17 = 0, $18 = 0, $19 = 0.0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0.0, $31 = 0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0.0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0.0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0.0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0.0, $61 = 0, $62 = 0.0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0.0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0.0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0.0, $8 = 0.0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0.0, $89 = 0, $9 = 0, $90 = 0.0, $91 = 0.0, $92 = 0, $93 = 0, $94 = 0.0, $95 = 0;
 var $96 = 0, $97 = 0.0, $98 = 0, $99 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $15 = $4&1;
 $9 = $15;
 $16 = $5;
 $17 = $6;
 $18 = ((($16)) + 136|0);
 HEAP32[$18>>2] = $17;
 $19 = $8;
 $20 = ((($16)) + 8|0);
 HEAPF64[$20>>3] = $19;
 $21 = $7;
 $22 = ((($16)) + 28|0);
 HEAP32[$22>>2] = $21;
 $23 = ((($16)) + 140|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ($24|0)!=(0|0);
 if ($25) {
  $26 = ((($16)) + 140|0);
  $27 = HEAP32[$26>>2]|0;
  _free($27);
 }
 $28 = ((($16)) + 28|0);
 $29 = HEAP32[$28>>2]|0;
 $30 = (+($29|0));
 $31 = ((($16)) + 8|0);
 $32 = +HEAPF64[$31>>3];
 $33 = 2.0 * $32;
 $34 = $30 + $33;
 $35 = 8.0 * $34;
 $36 = (~~(($35))>>>0);
 $37 = (_malloc($36)|0);
 $38 = ((($16)) + 140|0);
 HEAP32[$38>>2] = $37;
 $10 = 0;
 while(1) {
  $39 = $10;
  $40 = ((($16)) + 28|0);
  $41 = HEAP32[$40>>2]|0;
  $42 = ($39|0)<($41|0);
  if (!($42)) {
   break;
  }
  $43 = ((($16)) + 136|0);
  $44 = HEAP32[$43>>2]|0;
  $45 = $10;
  $46 = (($44) + ($45<<3)|0);
  $47 = +HEAPF64[$46>>3];
  $48 = ((($16)) + 140|0);
  $49 = HEAP32[$48>>2]|0;
  $50 = $10;
  $51 = ((($16)) + 8|0);
  $52 = +HEAPF64[$51>>3];
  $53 = (~~(($52)));
  $54 = (($50) + ($53))|0;
  $55 = (($49) + ($54<<3)|0);
  HEAPF64[$55>>3] = $47;
  $56 = $10;
  $57 = (($56) + 1)|0;
  $10 = $57;
 }
 $58 = ((($16)) + 28|0);
 $59 = HEAP32[$58>>2]|0;
 $60 = (+($59|0));
 $61 = ((($16)) + 8|0);
 $62 = +HEAPF64[$61>>3];
 $63 = $60 < $62;
 if ($63) {
  $9 = 0;
 }
 $64 = $9;
 $65 = $64&1;
 if ($65) {
  $11 = 0;
  while(1) {
   $66 = $11;
   $67 = ((($16)) + 8|0);
   $68 = +HEAPF64[$67>>3];
   $69 = (~~(($68)));
   $70 = ($66|0)<($69|0);
   if (!($70)) {
    break;
   }
   $71 = ((($16)) + 136|0);
   $72 = HEAP32[$71>>2]|0;
   $73 = ((($16)) + 8|0);
   $74 = +HEAPF64[$73>>3];
   $75 = (~~(($74)));
   $76 = $11;
   $77 = (($75) - ($76))|0;
   $78 = (($72) + ($77<<3)|0);
   $79 = +HEAPF64[$78>>3];
   $80 = ((($16)) + 140|0);
   $81 = HEAP32[$80>>2]|0;
   $82 = $11;
   $83 = (($81) + ($82<<3)|0);
   HEAPF64[$83>>3] = $79;
   $84 = $11;
   $85 = (($84) + 1)|0;
   $11 = $85;
  }
  $86 = ((($16)) + 28|0);
  $87 = HEAP32[$86>>2]|0;
  $88 = (+($87|0));
  $89 = ((($16)) + 8|0);
  $90 = +HEAPF64[$89>>3];
  $91 = $88 + $90;
  $92 = (~~(($91)));
  $12 = $92;
  while(1) {
   $93 = $12;
   $94 = (+($93|0));
   $95 = ((($16)) + 28|0);
   $96 = HEAP32[$95>>2]|0;
   $97 = (+($96|0));
   $98 = ((($16)) + 8|0);
   $99 = +HEAPF64[$98>>3];
   $100 = 2.0 * $99;
   $101 = $97 + $100;
   $102 = $94 < $101;
   if (!($102)) {
    break;
   }
   $103 = ((($16)) + 136|0);
   $104 = HEAP32[$103>>2]|0;
   $105 = ((($16)) + 28|0);
   $106 = HEAP32[$105>>2]|0;
   $107 = (($106) - 2)|0;
   $108 = $12;
   $109 = ((($16)) + 28|0);
   $110 = HEAP32[$109>>2]|0;
   $111 = ((($16)) + 8|0);
   $112 = +HEAPF64[$111>>3];
   $113 = (~~(($112)));
   $114 = (($110) + ($113))|0;
   $115 = (($108) - ($114))|0;
   $116 = (($107) - ($115))|0;
   $117 = (($104) + ($116<<3)|0);
   $118 = +HEAPF64[$117>>3];
   $119 = ((($16)) + 140|0);
   $120 = HEAP32[$119>>2]|0;
   $121 = $12;
   $122 = (($120) + ($121<<3)|0);
   HEAPF64[$122>>3] = $118;
   $123 = $12;
   $124 = (($123) + 1)|0;
   $12 = $124;
  }
  STACKTOP = sp;return;
 } else {
  $13 = 0;
  while(1) {
   $125 = $13;
   $126 = ((($16)) + 8|0);
   $127 = +HEAPF64[$126>>3];
   $128 = (~~(($127)));
   $129 = ($125|0)<($128|0);
   if (!($129)) {
    break;
   }
   $130 = ((($16)) + 136|0);
   $131 = HEAP32[$130>>2]|0;
   $132 = +HEAPF64[$131>>3];
   $133 = ((($16)) + 140|0);
   $134 = HEAP32[$133>>2]|0;
   $135 = $13;
   $136 = (($134) + ($135<<3)|0);
   HEAPF64[$136>>3] = $132;
   $137 = $13;
   $138 = (($137) + 1)|0;
   $13 = $138;
  }
  $139 = ((($16)) + 28|0);
  $140 = HEAP32[$139>>2]|0;
  $141 = (+($140|0));
  $142 = ((($16)) + 8|0);
  $143 = +HEAPF64[$142>>3];
  $144 = $141 + $143;
  $145 = (~~(($144)));
  $14 = $145;
  while(1) {
   $146 = $14;
   $147 = (+($146|0));
   $148 = ((($16)) + 28|0);
   $149 = HEAP32[$148>>2]|0;
   $150 = (+($149|0));
   $151 = ((($16)) + 8|0);
   $152 = +HEAPF64[$151>>3];
   $153 = 2.0 * $152;
   $154 = $150 + $153;
   $155 = $147 < $154;
   if (!($155)) {
    break;
   }
   $156 = ((($16)) + 136|0);
   $157 = HEAP32[$156>>2]|0;
   $158 = ((($16)) + 28|0);
   $159 = HEAP32[$158>>2]|0;
   $160 = (($159) - 1)|0;
   $161 = (($157) + ($160<<3)|0);
   $162 = +HEAPF64[$161>>3];
   $163 = ((($16)) + 140|0);
   $164 = HEAP32[$163>>2]|0;
   $165 = $14;
   $166 = (($164) + ($165<<3)|0);
   HEAPF64[$166>>3] = $162;
   $167 = $14;
   $168 = (($167) + 1)|0;
   $14 = $168;
  }
  STACKTOP = sp;return;
 }
}
function __ZN10EcgDenoise9LFDenoiseEv($0) {
 $0 = $0|0;
 var $$expand_i1_val = 0, $$expand_i1_val2 = 0, $$pre_trunc = 0, $1 = 0, $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0.0, $23 = 0, $24 = 0.0;
 var $25 = 0.0, $26 = 0.0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0.0, $36 = 0, $37 = 0.0, $38 = 0.0, $39 = 0.0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0.0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0.0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $1 = sp + 28|0;
 $2 = $0;
 $9 = $2;
 $10 = ((($9)) + 8|0);
 $11 = +HEAPF64[$10>>3];
 $12 = $11 / 0.80000000000000004;
 $13 = (+__ZNK6Signal4log2Ed($9,$12));
 $14 = (+Math_ceil((+$13)));
 $15 = $14 - 1.0;
 $16 = (~~(($15)));
 $3 = $16;
 $4 = 2;
 $17 = $4;
 $18 = ((($9)) + 140|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($9)) + 28|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = (+($21|0));
 $23 = ((($9)) + 8|0);
 $24 = +HEAPF64[$23>>3];
 $25 = 2.0 * $24;
 $26 = $22 + $25;
 $27 = (~~(($26)));
 $28 = (__ZN3FWT7InitFWTE10FilterEnumPKdi($9,$17,$19,$27)|0);
 $29 = $28&1;
 $30 = ($29|0)==(0);
 if ($30) {
  $$expand_i1_val = 0;
  HEAP8[$1>>0] = $$expand_i1_val;
  $$pre_trunc = HEAP8[$1>>0]|0;
  $71 = $$pre_trunc&1;
  STACKTOP = sp;return ($71|0);
 }
 $31 = $3;
 __ZN3FWT8FwtTransEi($9,$31);
 $32 = $3;
 $33 = ((($9)) + 28|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = (+($34|0));
 $36 = ((($9)) + 8|0);
 $37 = +HEAPF64[$36>>3];
 $38 = 2.0 * $37;
 $39 = $35 + $38;
 $40 = (~~(($39)));
 $41 = (__ZN3FWT9GetJnumbsEii($9,$32,$40)|0);
 $5 = $41;
 $42 = (__ZNK3FWT14GetFwtSpectrumEv($9)|0);
 $6 = $42;
 $7 = 0;
 while(1) {
  $43 = $7;
  $44 = $5;
  $45 = HEAP32[$44>>2]|0;
  $46 = ($43|0)<($45|0);
  if (!($46)) {
   break;
  }
  $47 = $6;
  $48 = $7;
  $49 = (($47) + ($48<<3)|0);
  HEAPF64[$49>>3] = 0.0;
  $50 = $7;
  $51 = (($50) + 1)|0;
  $7 = $51;
 }
 $52 = $3;
 __ZN3FWT8FwtSynthEi($9,$52);
 $8 = 0;
 while(1) {
  $53 = $8;
  $54 = ((($9)) + 28|0);
  $55 = HEAP32[$54>>2]|0;
  $56 = ($53|0)<($55|0);
  if (!($56)) {
   break;
  }
  $57 = $6;
  $58 = $8;
  $59 = ((($9)) + 8|0);
  $60 = +HEAPF64[$59>>3];
  $61 = (~~(($60)));
  $62 = (($58) + ($61))|0;
  $63 = (($57) + ($62<<3)|0);
  $64 = +HEAPF64[$63>>3];
  $65 = ((($9)) + 136|0);
  $66 = HEAP32[$65>>2]|0;
  $67 = $8;
  $68 = (($66) + ($67<<3)|0);
  HEAPF64[$68>>3] = $64;
  $69 = $8;
  $70 = (($69) + 1)|0;
  $8 = $70;
 }
 __ZN3FWT8CloseFWTEv($9);
 $$expand_i1_val2 = 1;
 HEAP8[$1>>0] = $$expand_i1_val2;
 $$pre_trunc = HEAP8[$1>>0]|0;
 $71 = $$pre_trunc&1;
 STACKTOP = sp;return ($71|0);
}
function __ZNK6Signal4log2Ed($0,$1) {
 $0 = $0|0;
 $1 = +$1;
 var $2 = 0, $3 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = $3;
 $5 = (+Math_log((+$4)));
 $6 = (+Math_log(2.0));
 $7 = $5 / $6;
 STACKTOP = sp;return (+$7);
}
function __ZNK3FWT14GetFwtSpectrumEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 $3 = ((($2)) + 112|0);
 $4 = HEAP32[$3>>2]|0;
 STACKTOP = sp;return ($4|0);
}
function __ZN3CWTD0Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $4 = $1;
 __THREW__ = 0;
 invoke_vi(7,($4|0));
 $5 = __THREW__; __THREW__ = 0;
 $6 = $5&1;
 if ($6) {
  $7 = ___cxa_find_matching_catch_2()|0;
  $8 = tempRet0;
  $2 = $7;
  $3 = $8;
  __ZdlPv($4);
  $9 = $2;
  $10 = $3;
  ___resumeException($9|0);
  // unreachable;
 } else {
  __ZdlPv($4);
  STACKTOP = sp;return;
 }
}
function __ZN3CWTD2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $4 = $1;
 HEAP32[$4>>2] = (31020);
 $5 = ((($4)) + 100|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($6|0)!=(0|0);
 if ($7) {
  $8 = ((($4)) + 100|0);
  $9 = HEAP32[$8>>2]|0;
  __THREW__ = 0;
  invoke_vi(35,($9|0));
  $10 = __THREW__; __THREW__ = 0;
  $11 = $10&1;
  if (!($11)) {
   label = 4;
  }
 } else {
  label = 4;
 }
 do {
  if ((label|0) == 4) {
   $16 = ((($4)) + 104|0);
   $17 = HEAP32[$16>>2]|0;
   $18 = ($17|0)!=(0|0);
   if ($18) {
    $19 = ((($4)) + 104|0);
    $20 = HEAP32[$19>>2]|0;
    __THREW__ = 0;
    invoke_vi(35,($20|0));
    $21 = __THREW__; __THREW__ = 0;
    $22 = $21&1;
    if ($22) {
     break;
    }
   }
   $23 = ((($4)) + 96|0);
   $24 = HEAP32[$23>>2]|0;
   $25 = ($24|0)!=(0|0);
   if (!($25)) {
    __ZN6SignalD2Ev($4);
    STACKTOP = sp;return;
   }
   $26 = ((($4)) + 96|0);
   $27 = HEAP32[$26>>2]|0;
   __THREW__ = 0;
   invoke_vi(35,($27|0));
   $28 = __THREW__; __THREW__ = 0;
   $29 = $28&1;
   if (!($29)) {
    __ZN6SignalD2Ev($4);
    STACKTOP = sp;return;
   }
  }
 } while(0);
 $12 = ___cxa_find_matching_catch_2()|0;
 $13 = tempRet0;
 $2 = $12;
 $3 = $13;
 __THREW__ = 0;
 invoke_vi(1,($4|0));
 $14 = __THREW__; __THREW__ = 0;
 $15 = $14&1;
 if ($15) {
  $32 = ___cxa_find_matching_catch_3(0|0)|0;
  $33 = tempRet0;
  ___clang_call_terminate($32);
  // unreachable;
 } else {
  $30 = $2;
  $31 = $3;
  ___resumeException($30|0);
  // unreachable;
 }
}
function __ZN3CWTC2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 __ZN6SignalC2Ev($2);
 HEAP32[$2>>2] = (31020);
 $3 = ((($2)) + 80|0);
 HEAP32[$3>>2] = 0;
 $4 = ((($2)) + 96|0);
 HEAP32[$4>>2] = 0;
 $5 = ((($2)) + 100|0);
 HEAP32[$5>>2] = 0;
 $6 = ((($2)) + 104|0);
 HEAP32[$6>>2] = 0;
 STACKTOP = sp;return;
}
function __ZN3CWT7InitCWTEiNS_7WAVELETEdd($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 $4 = +$4;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0.0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 $11 = $5;
 $12 = $6;
 $13 = ((($11)) + 88|0);
 HEAP32[$13>>2] = $12;
 $14 = $9;
 $15 = $14 != 0.0;
 if ($15) {
  $16 = $9;
  $17 = ((($11)) + 8|0);
  HEAPF64[$17>>3] = $16;
 }
 $18 = $8;
 $19 = ((($11)) + 72|0);
 HEAPF64[$19>>3] = $18;
 $20 = ((($11)) + 88|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = $21<<1;
 $23 = (($22) - 1)|0;
 $24 = $23<<3;
 $25 = (_malloc($24)|0);
 $26 = ((($11)) + 100|0);
 HEAP32[$26>>2] = $25;
 $27 = ((($11)) + 88|0);
 $28 = HEAP32[$27>>2]|0;
 $29 = $28<<1;
 $30 = (($29) - 1)|0;
 $31 = $30<<3;
 $32 = (_malloc($31)|0);
 $33 = ((($11)) + 104|0);
 HEAP32[$33>>2] = $32;
 $34 = ((($11)) + 88|0);
 $35 = HEAP32[$34>>2]|0;
 $36 = $35<<3;
 $37 = (_malloc($36)|0);
 $38 = ((($11)) + 96|0);
 HEAP32[$38>>2] = $37;
 $39 = $7;
 $40 = ((($11)) + 84|0);
 HEAP32[$40>>2] = $39;
 $10 = 0;
 while(1) {
  $41 = $10;
  $42 = ((($11)) + 88|0);
  $43 = HEAP32[$42>>2]|0;
  $44 = $43<<1;
  $45 = (($44) - 1)|0;
  $46 = ($41|0)<($45|0);
  if (!($46)) {
   break;
  }
  $47 = ((($11)) + 100|0);
  $48 = HEAP32[$47>>2]|0;
  $49 = $10;
  $50 = (($48) + ($49<<3)|0);
  HEAPF64[$50>>3] = 0.0;
  $51 = ((($11)) + 104|0);
  $52 = HEAP32[$51>>2]|0;
  $53 = $10;
  $54 = (($52) + ($53<<3)|0);
  HEAPF64[$54>>3] = 0.0;
  $55 = $10;
  $56 = (($55) + 1)|0;
  $10 = $56;
 }
 STACKTOP = sp;return;
}
function __ZN3CWT8CloseCWTEv($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 $3 = ((($2)) + 100|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)!=(0|0);
 if ($5) {
  $6 = ((($2)) + 100|0);
  $7 = HEAP32[$6>>2]|0;
  _free($7);
  $8 = ((($2)) + 100|0);
  HEAP32[$8>>2] = 0;
 }
 $9 = ((($2)) + 104|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ($10|0)!=(0|0);
 if ($11) {
  $12 = ((($2)) + 104|0);
  $13 = HEAP32[$12>>2]|0;
  _free($13);
  $14 = ((($2)) + 104|0);
  HEAP32[$14>>2] = 0;
 }
 $15 = ((($2)) + 96|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ($16|0)!=(0|0);
 if (!($17)) {
  STACKTOP = sp;return;
 }
 $18 = ((($2)) + 96|0);
 $19 = HEAP32[$18>>2]|0;
 _free($19);
 $20 = ((($2)) + 96|0);
 HEAP32[$20>>2] = 0;
 STACKTOP = sp;return;
}
function __ZNK3CWT9HzToScaleEddNS_7WAVELETEd($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = +$1;
 $2 = +$2;
 $3 = $3|0;
 $4 = +$4;
 var $10 = 0.0, $11 = 0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0.0, $25 = 0.0, $26 = 0.0, $27 = 0.0, $28 = 0.0, $29 = 0.0;
 var $30 = 0.0, $31 = 0.0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0.0, $36 = 0.0, $37 = 0.0, $38 = 0.0, $39 = 0.0, $5 = 0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 $11 = $8;
 do {
  switch ($11|0) {
  case 0:  {
   $12 = $7;
   $13 = 0.22222 * $12;
   $10 = $13;
   break;
  }
  case 1:  {
   $14 = $7;
   $15 = 0.15833 * $14;
   $10 = $15;
   break;
  }
  case 3: case 2:  {
   $16 = $7;
   $10 = $16;
   break;
  }
  case 4:  {
   $17 = $7;
   $18 = $9;
   $19 = $17 * $18;
   $20 = $19 * 0.15890000000000001;
   $10 = $20;
   break;
  }
  case 5:  {
   $21 = $7;
   $22 = 0.20000000000000001 * $21;
   $10 = $22;
   break;
  }
  case 6:  {
   $23 = $7;
   $24 = 0.16 * $23;
   $10 = $24;
   break;
  }
  case 7:  {
   $25 = $7;
   $26 = 0.224 * $25;
   $10 = $26;
   break;
  }
  case 8:  {
   $27 = $7;
   $28 = 0.27200000000000002 * $27;
   $10 = $28;
   break;
  }
  case 9:  {
   $29 = $7;
   $30 = 0.316 * $29;
   $10 = $30;
   break;
  }
  case 10:  {
   $31 = $7;
   $32 = 0.35399999999999998 * $31;
   $10 = $32;
   break;
  }
  case 11:  {
   $33 = $7;
   $34 = 0.38800000000000001 * $33;
   $10 = $34;
   break;
  }
  case 12:  {
   $35 = $7;
   $36 = 0.41999999999999998 * $35;
   $10 = $36;
   break;
  }
  default: {
   $10 = 0.0;
  }
  }
 } while(0);
 $37 = $10;
 $38 = $6;
 $39 = $37 / $38;
 STACKTOP = sp;return (+$39);
}
function __ZN3CWT8CwtTransEPKddbdd($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 $3 = $3|0;
 $4 = +$4;
 $5 = +$5;
 var $$sink = 0.0, $$sink2 = 0, $$sink3 = 0, $$sink5 = 0.0, $$sink7 = 0, $$sink8 = 0, $10 = 0.0, $100 = 0.0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0.0, $109 = 0.0, $11 = 0.0, $110 = 0.0, $111 = 0.0;
 var $112 = 0.0, $113 = 0.0, $114 = 0.0, $115 = 0.0, $116 = 0.0, $117 = 0.0, $118 = 0, $119 = 0, $12 = 0.0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0.0, $126 = 0.0, $127 = 0.0, $128 = 0.0, $129 = 0.0, $13 = 0.0;
 var $130 = 0.0, $131 = 0.0, $132 = 0.0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0.0, $140 = 0, $141 = 0.0, $142 = 0.0, $143 = 0.0, $144 = 0.0, $145 = 0.0, $146 = 0.0, $147 = 0.0, $148 = 0.0;
 var $149 = 0, $15 = 0.0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0.0, $157 = 0.0, $158 = 0.0, $159 = 0.0, $16 = 0, $160 = 0.0, $161 = 0.0, $162 = 0.0, $163 = 0, $164 = 0.0, $165 = 0.0, $166 = 0;
 var $167 = 0.0, $168 = 0.0, $169 = 0.0, $17 = 0, $170 = 0.0, $171 = 0.0, $172 = 0.0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0.0, $182 = 0.0, $183 = 0.0, $184 = 0.0;
 var $185 = 0.0, $186 = 0.0, $187 = 0.0, $188 = 0, $189 = 0.0, $19 = 0, $190 = 0.0, $191 = 0, $192 = 0.0, $193 = 0.0, $194 = 0.0, $195 = 0.0, $196 = 0.0, $197 = 0.0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0;
 var $203 = 0, $204 = 0, $205 = 0.0, $206 = 0.0, $207 = 0.0, $208 = 0.0, $209 = 0.0, $21 = 0, $210 = 0.0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0.0, $219 = 0.0, $22 = 0, $220 = 0.0;
 var $221 = 0.0, $222 = 0.0, $223 = 0.0, $224 = 0.0, $225 = 0.0, $226 = 0.0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0.0, $235 = 0.0, $236 = 0.0, $237 = 0.0, $238 = 0.0, $239 = 0.0;
 var $24 = 0, $240 = 0.0, $241 = 0.0, $242 = 0.0, $243 = 0.0, $244 = 0.0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0.0, $250 = 0, $251 = 0, $252 = 0.0, $253 = 0.0, $254 = 0.0, $255 = 0.0, $256 = 0.0, $257 = 0.0;
 var $258 = 0.0, $259 = 0.0, $26 = 0, $260 = 0.0, $261 = 0.0, $262 = 0.0, $263 = 0.0, $264 = 0.0, $265 = 0.0, $266 = 0.0, $267 = 0.0, $268 = 0.0, $269 = 0, $27 = 0.0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
 var $276 = 0.0, $277 = 0.0, $278 = 0.0, $279 = 0.0, $28 = 0, $280 = 0.0, $281 = 0.0, $282 = 0.0, $283 = 0.0, $284 = 0.0, $285 = 0.0, $286 = 0.0, $287 = 0.0, $288 = 0.0, $289 = 0.0, $29 = 0, $290 = 0.0, $291 = 0.0, $292 = 0.0, $293 = 0.0;
 var $294 = 0.0, $295 = 0.0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0.0, $304 = 0.0, $305 = 0.0, $306 = 0.0, $307 = 0.0, $308 = 0.0, $309 = 0.0, $31 = 0.0, $310 = 0.0, $311 = 0.0;
 var $312 = 0.0, $313 = 0.0, $314 = 0.0, $315 = 0.0, $316 = 0.0, $317 = 0.0, $318 = 0.0, $319 = 0.0, $32 = 0, $320 = 0.0, $321 = 0.0, $322 = 0.0, $323 = 0.0, $324 = 0.0, $325 = 0.0, $326 = 0.0, $327 = 0.0, $328 = 0.0, $329 = 0, $33 = 0.0;
 var $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0.0, $337 = 0.0, $338 = 0.0, $339 = 0.0, $34 = 0, $340 = 0.0, $341 = 0.0, $342 = 0.0, $343 = 0.0, $344 = 0.0, $345 = 0.0, $346 = 0.0, $347 = 0.0, $348 = 0.0;
 var $349 = 0.0, $35 = 0, $350 = 0.0, $351 = 0.0, $352 = 0.0, $353 = 0.0, $354 = 0.0, $355 = 0.0, $356 = 0.0, $357 = 0.0, $358 = 0.0, $359 = 0.0, $36 = 0, $360 = 0.0, $361 = 0.0, $362 = 0.0, $363 = 0.0, $364 = 0.0, $365 = 0.0, $366 = 0.0;
 var $367 = 0.0, $368 = 0.0, $369 = 0, $37 = 0.0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0.0, $377 = 0.0, $378 = 0.0, $379 = 0.0, $38 = 0.0, $380 = 0.0, $381 = 0.0, $382 = 0.0, $383 = 0.0, $384 = 0.0;
 var $385 = 0.0, $386 = 0.0, $387 = 0.0, $388 = 0.0, $389 = 0.0, $39 = 0, $390 = 0.0, $391 = 0.0, $392 = 0.0, $393 = 0.0, $394 = 0.0, $395 = 0.0, $396 = 0.0, $397 = 0.0, $398 = 0.0, $399 = 0.0, $40 = 0, $400 = 0.0, $401 = 0.0, $402 = 0.0;
 var $403 = 0.0, $404 = 0.0, $405 = 0.0, $406 = 0.0, $407 = 0.0, $408 = 0.0, $409 = 0.0, $41 = 0, $410 = 0.0, $411 = 0.0, $412 = 0.0, $413 = 0.0, $414 = 0.0, $415 = 0.0, $416 = 0.0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0;
 var $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0.0, $434 = 0.0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0;
 var $44 = 0.0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0.0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0;
 var $458 = 0, $459 = 0, $46 = 0.0, $460 = 0, $461 = 0.0, $462 = 0.0, $463 = 0.0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0.0, $471 = 0.0, $472 = 0.0, $473 = 0.0, $474 = 0.0, $475 = 0.0;
 var $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0.0, $481 = 0.0, $482 = 0.0, $483 = 0.0, $484 = 0, $485 = 0.0, $486 = 0.0, $487 = 0.0, $488 = 0.0, $489 = 0, $49 = 0, $490 = 0, $491 = 0.0, $492 = 0.0, $493 = 0.0;
 var $494 = 0.0, $495 = 0.0, $496 = 0.0, $497 = 0.0, $498 = 0.0, $499 = 0.0, $50 = 0, $500 = 0.0, $501 = 0.0, $502 = 0.0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0.0, $511 = 0.0;
 var $512 = 0.0, $513 = 0.0, $514 = 0.0, $515 = 0.0, $516 = 0.0, $517 = 0.0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0.0, $526 = 0.0, $527 = 0.0, $528 = 0.0, $529 = 0.0, $53 = 0.0;
 var $530 = 0.0, $531 = 0.0, $532 = 0.0, $533 = 0.0, $534 = 0.0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0.0, $540 = 0, $541 = 0, $542 = 0.0, $543 = 0.0, $544 = 0.0, $545 = 0.0, $546 = 0.0, $547 = 0.0, $548 = 0.0;
 var $549 = 0.0, $55 = 0.0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0.0, $559 = 0.0, $56 = 0.0, $560 = 0.0, $561 = 0.0, $562 = 0.0, $563 = 0.0, $564 = 0.0, $565 = 0.0, $566 = 0;
 var $567 = 0, $568 = 0, $569 = 0, $57 = 0.0, $570 = 0, $571 = 0, $572 = 0, $573 = 0.0, $574 = 0.0, $575 = 0.0, $576 = 0.0, $577 = 0.0, $578 = 0.0, $579 = 0.0, $58 = 0.0, $580 = 0, $581 = 0.0, $582 = 0.0, $583 = 0, $584 = 0.0;
 var $585 = 0.0, $586 = 0.0, $587 = 0.0, $588 = 0.0, $589 = 0.0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0.0, $599 = 0.0, $6 = 0, $60 = 0, $600 = 0.0, $601 = 0.0;
 var $602 = 0.0, $603 = 0.0, $604 = 0.0, $605 = 0, $606 = 0.0, $607 = 0.0, $608 = 0, $609 = 0.0, $61 = 0, $610 = 0.0, $611 = 0.0, $612 = 0.0, $613 = 0.0, $614 = 0.0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0;
 var $620 = 0, $621 = 0, $622 = 0.0, $623 = 0.0, $624 = 0.0, $625 = 0.0, $626 = 0.0, $627 = 0.0, $628 = 0, $629 = 0, $63 = 0.0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0.0, $636 = 0.0, $637 = 0.0, $638 = 0.0;
 var $639 = 0.0, $64 = 0.0, $640 = 0.0, $641 = 0.0, $642 = 0.0, $643 = 0.0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0.0, $650 = 0, $651 = 0.0, $652 = 0.0, $653 = 0.0, $654 = 0.0, $655 = 0.0, $656 = 0.0;
 var $657 = 0.0, $658 = 0.0, $659 = 0.0, $66 = 0.0, $660 = 0.0, $661 = 0.0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0.0, $67 = 0, $670 = 0.0, $671 = 0.0, $672 = 0.0, $673 = 0.0, $674 = 0.0;
 var $675 = 0.0, $676 = 0.0, $677 = 0.0, $678 = 0.0, $679 = 0.0, $68 = 0.0, $680 = 0.0, $681 = 0.0, $682 = 0.0, $683 = 0.0, $684 = 0.0, $685 = 0.0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0.0, $690 = 0, $691 = 0, $692 = 0;
 var $693 = 0.0, $694 = 0.0, $695 = 0.0, $696 = 0.0, $697 = 0.0, $698 = 0.0, $699 = 0.0, $7 = 0, $70 = 0.0, $700 = 0.0, $701 = 0.0, $702 = 0.0, $703 = 0.0, $704 = 0.0, $705 = 0.0, $706 = 0.0, $707 = 0.0, $708 = 0.0, $709 = 0.0, $71 = 0.0;
 var $710 = 0.0, $711 = 0.0, $712 = 0.0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0.0, $721 = 0.0, $722 = 0.0, $723 = 0.0, $724 = 0.0, $725 = 0.0, $726 = 0.0, $727 = 0.0, $728 = 0.0;
 var $729 = 0.0, $73 = 0, $730 = 0.0, $731 = 0.0, $732 = 0.0, $733 = 0.0, $734 = 0.0, $735 = 0.0, $736 = 0.0, $737 = 0.0, $738 = 0.0, $739 = 0.0, $74 = 0.0, $740 = 0.0, $741 = 0.0, $742 = 0.0, $743 = 0.0, $744 = 0.0, $745 = 0.0, $746 = 0;
 var $747 = 0, $748 = 0, $749 = 0, $75 = 0.0, $750 = 0, $751 = 0, $752 = 0, $753 = 0.0, $754 = 0.0, $755 = 0.0, $756 = 0.0, $757 = 0.0, $758 = 0.0, $759 = 0.0, $76 = 0.0, $760 = 0.0, $761 = 0.0, $762 = 0.0, $763 = 0.0, $764 = 0.0;
 var $765 = 0.0, $766 = 0.0, $767 = 0.0, $768 = 0.0, $769 = 0.0, $77 = 0.0, $770 = 0.0, $771 = 0.0, $772 = 0.0, $773 = 0.0, $774 = 0.0, $775 = 0.0, $776 = 0.0, $777 = 0.0, $778 = 0.0, $779 = 0.0, $78 = 0.0, $780 = 0.0, $781 = 0.0, $782 = 0.0;
 var $783 = 0.0, $784 = 0.0, $785 = 0.0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0.0, $790 = 0, $791 = 0, $792 = 0, $793 = 0.0, $794 = 0.0, $795 = 0.0, $796 = 0.0, $797 = 0.0, $798 = 0.0, $799 = 0.0, $8 = 0.0, $80 = 0.0;
 var $800 = 0.0, $801 = 0.0, $802 = 0.0, $803 = 0.0, $804 = 0.0, $805 = 0.0, $806 = 0.0, $807 = 0.0, $808 = 0.0, $809 = 0.0, $81 = 0.0, $810 = 0.0, $811 = 0.0, $812 = 0.0, $813 = 0.0, $814 = 0.0, $815 = 0.0, $816 = 0.0, $817 = 0.0, $818 = 0.0;
 var $819 = 0.0, $82 = 0.0, $820 = 0.0, $821 = 0.0, $822 = 0.0, $823 = 0.0, $824 = 0.0, $825 = 0.0, $826 = 0.0, $827 = 0.0, $828 = 0.0, $829 = 0.0, $83 = 0.0, $830 = 0.0, $831 = 0.0, $832 = 0.0, $833 = 0.0, $834 = 0, $835 = 0, $836 = 0;
 var $837 = 0, $838 = 0, $839 = 0, $84 = 0.0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0.0, $850 = 0, $851 = 0.0, $852 = 0.0, $853 = 0, $854 = 0;
 var $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0.0, $94 = 0.0, $95 = 0.0, $96 = 0.0, $97 = 0.0, $98 = 0.0;
 var $99 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $6 = $0;
 $7 = $1;
 $8 = $2;
 $19 = $3&1;
 $9 = $19;
 $10 = $4;
 $11 = $5;
 $20 = $6;
 $21 = $9;
 $22 = $21&1;
 $23 = ((($20)) + 116|0);
 $24 = $22&1;
 HEAP8[$23>>0] = $24;
 $25 = $10;
 $26 = ((($20)) + 120|0);
 HEAPF64[$26>>3] = $25;
 $27 = $11;
 $28 = ((($20)) + 128|0);
 HEAPF64[$28>>3] = $27;
 $29 = ((($20)) + 108|0);
 HEAP8[$29>>0] = 0;
 $30 = ((($20)) + 112|0);
 HEAP32[$30>>2] = 0;
 $31 = $8;
 $32 = ((($20)) + 8|0);
 $33 = +HEAPF64[$32>>3];
 $34 = ((($20)) + 84|0);
 $35 = HEAP32[$34>>2]|0;
 $36 = ((($20)) + 72|0);
 $37 = +HEAPF64[$36>>3];
 $38 = (+__ZNK3CWT9HzToScaleEddNS_7WAVELETEd($20,$31,$33,$35,$37));
 $15 = $38;
 $16 = 0;
 while(1) {
  $39 = $16;
  $40 = ((($20)) + 88|0);
  $41 = HEAP32[$40>>2]|0;
  $42 = ($39|0)<($41|0);
  if (!($42)) {
   break;
  }
  $43 = $16;
  $44 = (+($43|0));
  $45 = $15;
  $46 = $44 / $45;
  $12 = $46;
  $47 = ((($20)) + 84|0);
  $48 = HEAP32[$47>>2]|0;
  $49 = ($48|0)>(1);
  if ($49) {
   $50 = ((($20)) + 84|0);
   $51 = HEAP32[$50>>2]|0;
   $52 = ($51|0)<(4);
   if ($52) {
    $53 = $12;
    $54 = 6.2800000000000002 * $53;
    $55 = (+Math_sin((+$54)));
    $13 = $55;
    $56 = $12;
    $57 = 6.2800000000000002 * $56;
    $58 = (+Math_cos((+$57)));
    $14 = $58;
   }
  }
  $59 = ((($20)) + 84|0);
  $60 = HEAP32[$59>>2]|0;
  $61 = ($60|0)==(4);
  if ($61) {
   $62 = ((($20)) + 72|0);
   $63 = +HEAPF64[$62>>3];
   $64 = $12;
   $65 = $63 * $64;
   $66 = (+Math_sin((+$65)));
   $13 = $66;
   $67 = ((($20)) + 72|0);
   $68 = +HEAPF64[$67>>3];
   $69 = $12;
   $70 = $68 * $69;
   $71 = (+Math_cos((+$70)));
   $14 = $71;
  }
  $72 = ((($20)) + 84|0);
  $73 = HEAP32[$72>>2]|0;
  do {
   switch ($73|0) {
   case 0:  {
    $74 = $12;
    $75 = -$74;
    $76 = $12;
    $77 = $75 * $76;
    $78 = $77 / 2.0;
    $79 = (+Math_exp((+$78)));
    $80 = $12;
    $81 = -$80;
    $82 = $12;
    $83 = $81 * $82;
    $84 = $83 + 1.0;
    $85 = $79 * $84;
    $86 = ((($20)) + 100|0);
    $87 = HEAP32[$86>>2]|0;
    $88 = ((($20)) + 88|0);
    $89 = HEAP32[$88>>2]|0;
    $90 = (($89) - 1)|0;
    $91 = $16;
    $92 = (($90) + ($91))|0;
    $$sink = $85;$$sink2 = $87;$$sink3 = $92;
    label = 22;
    break;
   }
   case 1:  {
    $93 = $12;
    $94 = $12;
    $95 = -$94;
    $96 = $12;
    $97 = $95 * $96;
    $98 = $97 / 2.0;
    $99 = (+Math_exp((+$98)));
    $100 = $93 * $99;
    $101 = ((($20)) + 100|0);
    $102 = HEAP32[$101>>2]|0;
    $103 = ((($20)) + 88|0);
    $104 = HEAP32[$103>>2]|0;
    $105 = (($104) - 1)|0;
    $106 = $16;
    $107 = (($105) + ($106))|0;
    $$sink = $100;$$sink2 = $102;$$sink3 = $107;
    label = 22;
    break;
   }
   case 2:  {
    $108 = $12;
    $109 = -$108;
    $110 = $12;
    $111 = $109 * $110;
    $112 = $111 / 2.0;
    $113 = (+Math_exp((+$112)));
    $114 = $14;
    $115 = $13;
    $116 = $114 - $115;
    $117 = $113 * $116;
    $118 = ((($20)) + 100|0);
    $119 = HEAP32[$118>>2]|0;
    $120 = ((($20)) + 88|0);
    $121 = HEAP32[$120>>2]|0;
    $122 = (($121) - 1)|0;
    $123 = $16;
    $124 = (($122) + ($123))|0;
    $$sink = $117;$$sink2 = $119;$$sink3 = $124;
    label = 22;
    break;
   }
   case 3:  {
    $125 = $12;
    $126 = -$125;
    $127 = $12;
    $128 = $126 * $127;
    $129 = $128 / 2.0;
    $130 = (+Math_exp((+$129)));
    $131 = $14;
    $132 = $130 * $131;
    $133 = ((($20)) + 100|0);
    $134 = HEAP32[$133>>2]|0;
    $135 = ((($20)) + 88|0);
    $136 = HEAP32[$135>>2]|0;
    $137 = (($136) - 1)|0;
    $138 = $16;
    $139 = (($137) + ($138))|0;
    $140 = (($134) + ($139<<3)|0);
    HEAPF64[$140>>3] = $132;
    $141 = $12;
    $142 = -$141;
    $143 = $12;
    $144 = $142 * $143;
    $145 = $144 / 2.0;
    $146 = (+Math_exp((+$145)));
    $147 = $13;
    $148 = $146 * $147;
    $149 = ((($20)) + 104|0);
    $150 = HEAP32[$149>>2]|0;
    $151 = ((($20)) + 88|0);
    $152 = HEAP32[$151>>2]|0;
    $153 = (($152) - 1)|0;
    $154 = $16;
    $155 = (($153) + ($154))|0;
    $$sink = $148;$$sink2 = $150;$$sink3 = $155;
    label = 22;
    break;
   }
   case 4:  {
    $156 = $12;
    $157 = -$156;
    $158 = $12;
    $159 = $157 * $158;
    $160 = $159 / 2.0;
    $161 = (+Math_exp((+$160)));
    $162 = $14;
    $163 = ((($20)) + 72|0);
    $164 = +HEAPF64[$163>>3];
    $165 = -$164;
    $166 = ((($20)) + 72|0);
    $167 = +HEAPF64[$166>>3];
    $168 = $165 * $167;
    $169 = $168 / 2.0;
    $170 = (+Math_exp((+$169)));
    $171 = $162 - $170;
    $172 = $161 * $171;
    $173 = ((($20)) + 100|0);
    $174 = HEAP32[$173>>2]|0;
    $175 = ((($20)) + 88|0);
    $176 = HEAP32[$175>>2]|0;
    $177 = (($176) - 1)|0;
    $178 = $16;
    $179 = (($177) + ($178))|0;
    $180 = (($174) + ($179<<3)|0);
    HEAPF64[$180>>3] = $172;
    $181 = $12;
    $182 = -$181;
    $183 = $12;
    $184 = $182 * $183;
    $185 = $184 / 2.0;
    $186 = (+Math_exp((+$185)));
    $187 = $13;
    $188 = ((($20)) + 72|0);
    $189 = +HEAPF64[$188>>3];
    $190 = -$189;
    $191 = ((($20)) + 72|0);
    $192 = +HEAPF64[$191>>3];
    $193 = $190 * $192;
    $194 = $193 / 2.0;
    $195 = (+Math_exp((+$194)));
    $196 = $187 - $195;
    $197 = $186 * $196;
    $198 = ((($20)) + 104|0);
    $199 = HEAP32[$198>>2]|0;
    $200 = ((($20)) + 88|0);
    $201 = HEAP32[$200>>2]|0;
    $202 = (($201) - 1)|0;
    $203 = $16;
    $204 = (($202) + ($203))|0;
    $$sink = $197;$$sink2 = $199;$$sink3 = $204;
    label = 22;
    break;
   }
   case 5:  {
    $205 = $12;
    $206 = -$205;
    $207 = $12;
    $208 = $206 * $207;
    $209 = $208 / 2.0;
    $210 = (+Math_exp((+$209)));
    $211 = ((($20)) + 100|0);
    $212 = HEAP32[$211>>2]|0;
    $213 = ((($20)) + 88|0);
    $214 = HEAP32[$213>>2]|0;
    $215 = (($214) - 1)|0;
    $216 = $16;
    $217 = (($215) + ($216))|0;
    $$sink = $210;$$sink2 = $212;$$sink3 = $217;
    label = 22;
    break;
   }
   case 6:  {
    $218 = $12;
    $219 = -$218;
    $220 = $12;
    $221 = -$220;
    $222 = $12;
    $223 = $221 * $222;
    $224 = $223 / 2.0;
    $225 = (+Math_exp((+$224)));
    $226 = $219 * $225;
    $227 = ((($20)) + 100|0);
    $228 = HEAP32[$227>>2]|0;
    $229 = ((($20)) + 88|0);
    $230 = HEAP32[$229>>2]|0;
    $231 = (($230) - 1)|0;
    $232 = $16;
    $233 = (($231) + ($232))|0;
    $$sink = $226;$$sink2 = $228;$$sink3 = $233;
    label = 22;
    break;
   }
   case 7:  {
    $234 = $12;
    $235 = $12;
    $236 = $234 * $235;
    $237 = $236 - 1.0;
    $238 = $12;
    $239 = -$238;
    $240 = $12;
    $241 = $239 * $240;
    $242 = $241 / 2.0;
    $243 = (+Math_exp((+$242)));
    $244 = $237 * $243;
    $245 = ((($20)) + 100|0);
    $246 = HEAP32[$245>>2]|0;
    $247 = ((($20)) + 88|0);
    $248 = HEAP32[$247>>2]|0;
    $249 = (($248) - 1)|0;
    $250 = $16;
    $251 = (($249) + ($250))|0;
    $$sink = $244;$$sink2 = $246;$$sink3 = $251;
    label = 22;
    break;
   }
   case 8:  {
    $252 = $12;
    $253 = 2.0 * $252;
    $254 = $12;
    $255 = $253 + $254;
    $256 = $12;
    $257 = $12;
    $258 = $256 * $257;
    $259 = $12;
    $260 = $258 * $259;
    $261 = $255 - $260;
    $262 = $12;
    $263 = -$262;
    $264 = $12;
    $265 = $263 * $264;
    $266 = $265 / 2.0;
    $267 = (+Math_exp((+$266)));
    $268 = $261 * $267;
    $269 = ((($20)) + 100|0);
    $270 = HEAP32[$269>>2]|0;
    $271 = ((($20)) + 88|0);
    $272 = HEAP32[$271>>2]|0;
    $273 = (($272) - 1)|0;
    $274 = $16;
    $275 = (($273) + ($274))|0;
    $$sink = $268;$$sink2 = $270;$$sink3 = $275;
    label = 22;
    break;
   }
   case 9:  {
    $276 = $12;
    $277 = 6.0 * $276;
    $278 = $12;
    $279 = $277 * $278;
    $280 = 3.0 - $279;
    $281 = $12;
    $282 = $12;
    $283 = $281 * $282;
    $284 = $12;
    $285 = $283 * $284;
    $286 = $12;
    $287 = $285 * $286;
    $288 = $280 + $287;
    $289 = $12;
    $290 = -$289;
    $291 = $12;
    $292 = $290 * $291;
    $293 = $292 / 2.0;
    $294 = (+Math_exp((+$293)));
    $295 = $288 * $294;
    $296 = ((($20)) + 100|0);
    $297 = HEAP32[$296>>2]|0;
    $298 = ((($20)) + 88|0);
    $299 = HEAP32[$298>>2]|0;
    $300 = (($299) - 1)|0;
    $301 = $16;
    $302 = (($300) + ($301))|0;
    $$sink = $295;$$sink2 = $297;$$sink3 = $302;
    label = 22;
    break;
   }
   case 10:  {
    $303 = $12;
    $304 = -15.0 * $303;
    $305 = $12;
    $306 = 10.0 * $305;
    $307 = $12;
    $308 = $306 * $307;
    $309 = $12;
    $310 = $308 * $309;
    $311 = $304 + $310;
    $312 = $12;
    $313 = $12;
    $314 = $312 * $313;
    $315 = $12;
    $316 = $314 * $315;
    $317 = $12;
    $318 = $316 * $317;
    $319 = $12;
    $320 = $318 * $319;
    $321 = $311 - $320;
    $322 = $12;
    $323 = -$322;
    $324 = $12;
    $325 = $323 * $324;
    $326 = $325 / 2.0;
    $327 = (+Math_exp((+$326)));
    $328 = $321 * $327;
    $329 = ((($20)) + 100|0);
    $330 = HEAP32[$329>>2]|0;
    $331 = ((($20)) + 88|0);
    $332 = HEAP32[$331>>2]|0;
    $333 = (($332) - 1)|0;
    $334 = $16;
    $335 = (($333) + ($334))|0;
    $$sink = $328;$$sink2 = $330;$$sink3 = $335;
    label = 22;
    break;
   }
   case 11:  {
    $336 = $12;
    $337 = 45.0 * $336;
    $338 = $12;
    $339 = $337 * $338;
    $340 = -15.0 + $339;
    $341 = $12;
    $342 = 15.0 * $341;
    $343 = $12;
    $344 = $342 * $343;
    $345 = $12;
    $346 = $344 * $345;
    $347 = $12;
    $348 = $346 * $347;
    $349 = $340 - $348;
    $350 = $12;
    $351 = $12;
    $352 = $350 * $351;
    $353 = $12;
    $354 = $352 * $353;
    $355 = $12;
    $356 = $354 * $355;
    $357 = $12;
    $358 = $356 * $357;
    $359 = $12;
    $360 = $358 * $359;
    $361 = $349 + $360;
    $362 = $12;
    $363 = -$362;
    $364 = $12;
    $365 = $363 * $364;
    $366 = $365 / 2.0;
    $367 = (+Math_exp((+$366)));
    $368 = $361 * $367;
    $369 = ((($20)) + 100|0);
    $370 = HEAP32[$369>>2]|0;
    $371 = ((($20)) + 88|0);
    $372 = HEAP32[$371>>2]|0;
    $373 = (($372) - 1)|0;
    $374 = $16;
    $375 = (($373) + ($374))|0;
    $$sink = $368;$$sink2 = $370;$$sink3 = $375;
    label = 22;
    break;
   }
   case 12:  {
    $376 = $12;
    $377 = 105.0 * $376;
    $378 = $12;
    $379 = 105.0 * $378;
    $380 = $12;
    $381 = $379 * $380;
    $382 = $12;
    $383 = $381 * $382;
    $384 = $377 - $383;
    $385 = $12;
    $386 = 21.0 * $385;
    $387 = $12;
    $388 = $386 * $387;
    $389 = $12;
    $390 = $388 * $389;
    $391 = $12;
    $392 = $390 * $391;
    $393 = $12;
    $394 = $392 * $393;
    $395 = $384 + $394;
    $396 = $12;
    $397 = $12;
    $398 = $396 * $397;
    $399 = $12;
    $400 = $398 * $399;
    $401 = $12;
    $402 = $400 * $401;
    $403 = $12;
    $404 = $402 * $403;
    $405 = $12;
    $406 = $404 * $405;
    $407 = $12;
    $408 = $406 * $407;
    $409 = $395 - $408;
    $410 = $12;
    $411 = -$410;
    $412 = $12;
    $413 = $411 * $412;
    $414 = $413 / 2.0;
    $415 = (+Math_exp((+$414)));
    $416 = $409 * $415;
    $417 = ((($20)) + 100|0);
    $418 = HEAP32[$417>>2]|0;
    $419 = ((($20)) + 88|0);
    $420 = HEAP32[$419>>2]|0;
    $421 = (($420) - 1)|0;
    $422 = $16;
    $423 = (($421) + ($422))|0;
    $$sink = $416;$$sink2 = $418;$$sink3 = $423;
    label = 22;
    break;
   }
   default: {
   }
   }
  } while(0);
  if ((label|0) == 22) {
   label = 0;
   $424 = (($$sink2) + ($$sink3<<3)|0);
   HEAPF64[$424>>3] = $$sink;
  }
  $425 = ((($20)) + 100|0);
  $426 = HEAP32[$425>>2]|0;
  $427 = ((($20)) + 88|0);
  $428 = HEAP32[$427>>2]|0;
  $429 = (($428) - 1)|0;
  $430 = $16;
  $431 = (($429) + ($430))|0;
  $432 = (($426) + ($431<<3)|0);
  $433 = +HEAPF64[$432>>3];
  $434 = (+Math_abs((+$433)));
  $435 = $434 < 9.9999999999999995E-8;
  if ($435) {
   $436 = ((($20)) + 112|0);
   $437 = HEAP32[$436>>2]|0;
   $438 = (($437) + 1)|0;
   HEAP32[$436>>2] = $438;
  }
  $439 = ((($20)) + 112|0);
  $440 = HEAP32[$439>>2]|0;
  $441 = ($440|0)>(15);
  $442 = $16;
  if ($441) {
   label = 26;
   break;
  }
  $445 = (($442) + 1)|0;
  $16 = $445;
 }
 if ((label|0) == 26) {
  $443 = ((($20)) + 112|0);
  HEAP32[$443>>2] = $442;
  $444 = ((($20)) + 108|0);
  HEAP8[$444>>0] = 1;
 }
 $446 = ((($20)) + 108|0);
 $447 = HEAP8[$446>>0]|0;
 $448 = $447&1;
 $449 = $448&1;
 $450 = ($449|0)==(0);
 if ($450) {
  $451 = ((($20)) + 88|0);
  $452 = HEAP32[$451>>2]|0;
  $453 = ((($20)) + 112|0);
  HEAP32[$453>>2] = $452;
 }
 $454 = ((($20)) + 112|0);
 $455 = HEAP32[$454>>2]|0;
 $456 = (($455) - 1)|0;
 $457 = (0 - ($456))|0;
 $17 = $457;
 while(1) {
  $458 = $17;
  $459 = ($458|0)<(0);
  if (!($459)) {
   break;
  }
  $460 = $17;
  $461 = (+($460|0));
  $462 = $15;
  $463 = $461 / $462;
  $12 = $463;
  $464 = ((($20)) + 84|0);
  $465 = HEAP32[$464>>2]|0;
  $466 = ($465|0)>(1);
  if ($466) {
   $467 = ((($20)) + 84|0);
   $468 = HEAP32[$467>>2]|0;
   $469 = ($468|0)<(4);
   if ($469) {
    $470 = $12;
    $471 = 6.2800000000000002 * $470;
    $472 = (+Math_sin((+$471)));
    $13 = $472;
    $473 = $12;
    $474 = 6.2800000000000002 * $473;
    $475 = (+Math_cos((+$474)));
    $14 = $475;
   }
  }
  $476 = ((($20)) + 84|0);
  $477 = HEAP32[$476>>2]|0;
  $478 = ($477|0)==(4);
  if ($478) {
   $479 = ((($20)) + 72|0);
   $480 = +HEAPF64[$479>>3];
   $481 = $12;
   $482 = $480 * $481;
   $483 = (+Math_sin((+$482)));
   $13 = $483;
   $484 = ((($20)) + 72|0);
   $485 = +HEAPF64[$484>>3];
   $486 = $12;
   $487 = $485 * $486;
   $488 = (+Math_cos((+$487)));
   $14 = $488;
  }
  $489 = ((($20)) + 84|0);
  $490 = HEAP32[$489>>2]|0;
  do {
   switch ($490|0) {
   case 0:  {
    $491 = $12;
    $492 = -$491;
    $493 = $12;
    $494 = $492 * $493;
    $495 = $494 / 2.0;
    $496 = (+Math_exp((+$495)));
    $497 = $12;
    $498 = -$497;
    $499 = $12;
    $500 = $498 * $499;
    $501 = $500 + 1.0;
    $502 = $496 * $501;
    $503 = ((($20)) + 100|0);
    $504 = HEAP32[$503>>2]|0;
    $505 = ((($20)) + 88|0);
    $506 = HEAP32[$505>>2]|0;
    $507 = (($506) - 1)|0;
    $508 = $17;
    $509 = (($507) + ($508))|0;
    $$sink5 = $502;$$sink7 = $504;$$sink8 = $509;
    label = 51;
    break;
   }
   case 1:  {
    $510 = $12;
    $511 = $12;
    $512 = -$511;
    $513 = $12;
    $514 = $512 * $513;
    $515 = $514 / 2.0;
    $516 = (+Math_exp((+$515)));
    $517 = $510 * $516;
    $518 = ((($20)) + 100|0);
    $519 = HEAP32[$518>>2]|0;
    $520 = ((($20)) + 88|0);
    $521 = HEAP32[$520>>2]|0;
    $522 = (($521) - 1)|0;
    $523 = $17;
    $524 = (($522) + ($523))|0;
    $$sink5 = $517;$$sink7 = $519;$$sink8 = $524;
    label = 51;
    break;
   }
   case 2:  {
    $525 = $12;
    $526 = -$525;
    $527 = $12;
    $528 = $526 * $527;
    $529 = $528 / 2.0;
    $530 = (+Math_exp((+$529)));
    $531 = $14;
    $532 = $13;
    $533 = $531 - $532;
    $534 = $530 * $533;
    $535 = ((($20)) + 100|0);
    $536 = HEAP32[$535>>2]|0;
    $537 = ((($20)) + 88|0);
    $538 = HEAP32[$537>>2]|0;
    $539 = (($538) - 1)|0;
    $540 = $17;
    $541 = (($539) + ($540))|0;
    $$sink5 = $534;$$sink7 = $536;$$sink8 = $541;
    label = 51;
    break;
   }
   case 3:  {
    $542 = $12;
    $543 = -$542;
    $544 = $12;
    $545 = $543 * $544;
    $546 = $545 / 2.0;
    $547 = (+Math_exp((+$546)));
    $548 = $14;
    $549 = $547 * $548;
    $550 = ((($20)) + 100|0);
    $551 = HEAP32[$550>>2]|0;
    $552 = ((($20)) + 88|0);
    $553 = HEAP32[$552>>2]|0;
    $554 = (($553) - 1)|0;
    $555 = $17;
    $556 = (($554) + ($555))|0;
    $557 = (($551) + ($556<<3)|0);
    HEAPF64[$557>>3] = $549;
    $558 = $12;
    $559 = -$558;
    $560 = $12;
    $561 = $559 * $560;
    $562 = $561 / 2.0;
    $563 = (+Math_exp((+$562)));
    $564 = $13;
    $565 = $563 * $564;
    $566 = ((($20)) + 104|0);
    $567 = HEAP32[$566>>2]|0;
    $568 = ((($20)) + 88|0);
    $569 = HEAP32[$568>>2]|0;
    $570 = (($569) - 1)|0;
    $571 = $17;
    $572 = (($570) + ($571))|0;
    $$sink5 = $565;$$sink7 = $567;$$sink8 = $572;
    label = 51;
    break;
   }
   case 4:  {
    $573 = $12;
    $574 = -$573;
    $575 = $12;
    $576 = $574 * $575;
    $577 = $576 / 2.0;
    $578 = (+Math_exp((+$577)));
    $579 = $14;
    $580 = ((($20)) + 72|0);
    $581 = +HEAPF64[$580>>3];
    $582 = -$581;
    $583 = ((($20)) + 72|0);
    $584 = +HEAPF64[$583>>3];
    $585 = $582 * $584;
    $586 = $585 / 2.0;
    $587 = (+Math_exp((+$586)));
    $588 = $579 - $587;
    $589 = $578 * $588;
    $590 = ((($20)) + 100|0);
    $591 = HEAP32[$590>>2]|0;
    $592 = ((($20)) + 88|0);
    $593 = HEAP32[$592>>2]|0;
    $594 = (($593) - 1)|0;
    $595 = $17;
    $596 = (($594) + ($595))|0;
    $597 = (($591) + ($596<<3)|0);
    HEAPF64[$597>>3] = $589;
    $598 = $12;
    $599 = -$598;
    $600 = $12;
    $601 = $599 * $600;
    $602 = $601 / 2.0;
    $603 = (+Math_exp((+$602)));
    $604 = $13;
    $605 = ((($20)) + 72|0);
    $606 = +HEAPF64[$605>>3];
    $607 = -$606;
    $608 = ((($20)) + 72|0);
    $609 = +HEAPF64[$608>>3];
    $610 = $607 * $609;
    $611 = $610 / 2.0;
    $612 = (+Math_exp((+$611)));
    $613 = $604 - $612;
    $614 = $603 * $613;
    $615 = ((($20)) + 104|0);
    $616 = HEAP32[$615>>2]|0;
    $617 = ((($20)) + 88|0);
    $618 = HEAP32[$617>>2]|0;
    $619 = (($618) - 1)|0;
    $620 = $17;
    $621 = (($619) + ($620))|0;
    $$sink5 = $614;$$sink7 = $616;$$sink8 = $621;
    label = 51;
    break;
   }
   case 5:  {
    $622 = $12;
    $623 = -$622;
    $624 = $12;
    $625 = $623 * $624;
    $626 = $625 / 2.0;
    $627 = (+Math_exp((+$626)));
    $628 = ((($20)) + 100|0);
    $629 = HEAP32[$628>>2]|0;
    $630 = ((($20)) + 88|0);
    $631 = HEAP32[$630>>2]|0;
    $632 = (($631) - 1)|0;
    $633 = $17;
    $634 = (($632) + ($633))|0;
    $$sink5 = $627;$$sink7 = $629;$$sink8 = $634;
    label = 51;
    break;
   }
   case 6:  {
    $635 = $12;
    $636 = -$635;
    $637 = $12;
    $638 = -$637;
    $639 = $12;
    $640 = $638 * $639;
    $641 = $640 / 2.0;
    $642 = (+Math_exp((+$641)));
    $643 = $636 * $642;
    $644 = ((($20)) + 100|0);
    $645 = HEAP32[$644>>2]|0;
    $646 = ((($20)) + 88|0);
    $647 = HEAP32[$646>>2]|0;
    $648 = (($647) - 1)|0;
    $649 = $17;
    $650 = (($648) + ($649))|0;
    $$sink5 = $643;$$sink7 = $645;$$sink8 = $650;
    label = 51;
    break;
   }
   case 7:  {
    $651 = $12;
    $652 = $12;
    $653 = $651 * $652;
    $654 = $653 - 1.0;
    $655 = $12;
    $656 = -$655;
    $657 = $12;
    $658 = $656 * $657;
    $659 = $658 / 2.0;
    $660 = (+Math_exp((+$659)));
    $661 = $654 * $660;
    $662 = ((($20)) + 100|0);
    $663 = HEAP32[$662>>2]|0;
    $664 = ((($20)) + 88|0);
    $665 = HEAP32[$664>>2]|0;
    $666 = (($665) - 1)|0;
    $667 = $17;
    $668 = (($666) + ($667))|0;
    $$sink5 = $661;$$sink7 = $663;$$sink8 = $668;
    label = 51;
    break;
   }
   case 8:  {
    $669 = $12;
    $670 = 2.0 * $669;
    $671 = $12;
    $672 = $670 + $671;
    $673 = $12;
    $674 = $12;
    $675 = $673 * $674;
    $676 = $12;
    $677 = $675 * $676;
    $678 = $672 - $677;
    $679 = $12;
    $680 = -$679;
    $681 = $12;
    $682 = $680 * $681;
    $683 = $682 / 2.0;
    $684 = (+Math_exp((+$683)));
    $685 = $678 * $684;
    $686 = ((($20)) + 100|0);
    $687 = HEAP32[$686>>2]|0;
    $688 = ((($20)) + 88|0);
    $689 = HEAP32[$688>>2]|0;
    $690 = (($689) - 1)|0;
    $691 = $17;
    $692 = (($690) + ($691))|0;
    $$sink5 = $685;$$sink7 = $687;$$sink8 = $692;
    label = 51;
    break;
   }
   case 9:  {
    $693 = $12;
    $694 = 6.0 * $693;
    $695 = $12;
    $696 = $694 * $695;
    $697 = 3.0 - $696;
    $698 = $12;
    $699 = $12;
    $700 = $698 * $699;
    $701 = $12;
    $702 = $700 * $701;
    $703 = $12;
    $704 = $702 * $703;
    $705 = $697 + $704;
    $706 = $12;
    $707 = -$706;
    $708 = $12;
    $709 = $707 * $708;
    $710 = $709 / 2.0;
    $711 = (+Math_exp((+$710)));
    $712 = $705 * $711;
    $713 = ((($20)) + 100|0);
    $714 = HEAP32[$713>>2]|0;
    $715 = ((($20)) + 88|0);
    $716 = HEAP32[$715>>2]|0;
    $717 = (($716) - 1)|0;
    $718 = $17;
    $719 = (($717) + ($718))|0;
    $$sink5 = $712;$$sink7 = $714;$$sink8 = $719;
    label = 51;
    break;
   }
   case 10:  {
    $720 = $12;
    $721 = -15.0 * $720;
    $722 = $12;
    $723 = 10.0 * $722;
    $724 = $12;
    $725 = $723 * $724;
    $726 = $12;
    $727 = $725 * $726;
    $728 = $721 + $727;
    $729 = $12;
    $730 = $12;
    $731 = $729 * $730;
    $732 = $12;
    $733 = $731 * $732;
    $734 = $12;
    $735 = $733 * $734;
    $736 = $12;
    $737 = $735 * $736;
    $738 = $728 - $737;
    $739 = $12;
    $740 = -$739;
    $741 = $12;
    $742 = $740 * $741;
    $743 = $742 / 2.0;
    $744 = (+Math_exp((+$743)));
    $745 = $738 * $744;
    $746 = ((($20)) + 100|0);
    $747 = HEAP32[$746>>2]|0;
    $748 = ((($20)) + 88|0);
    $749 = HEAP32[$748>>2]|0;
    $750 = (($749) - 1)|0;
    $751 = $17;
    $752 = (($750) + ($751))|0;
    $$sink5 = $745;$$sink7 = $747;$$sink8 = $752;
    label = 51;
    break;
   }
   case 11:  {
    $753 = $12;
    $754 = 45.0 * $753;
    $755 = $12;
    $756 = $754 * $755;
    $757 = -15.0 + $756;
    $758 = $12;
    $759 = 15.0 * $758;
    $760 = $12;
    $761 = $759 * $760;
    $762 = $12;
    $763 = $761 * $762;
    $764 = $12;
    $765 = $763 * $764;
    $766 = $757 - $765;
    $767 = $12;
    $768 = $12;
    $769 = $767 * $768;
    $770 = $12;
    $771 = $769 * $770;
    $772 = $12;
    $773 = $771 * $772;
    $774 = $12;
    $775 = $773 * $774;
    $776 = $12;
    $777 = $775 * $776;
    $778 = $766 + $777;
    $779 = $12;
    $780 = -$779;
    $781 = $12;
    $782 = $780 * $781;
    $783 = $782 / 2.0;
    $784 = (+Math_exp((+$783)));
    $785 = $778 * $784;
    $786 = ((($20)) + 100|0);
    $787 = HEAP32[$786>>2]|0;
    $788 = ((($20)) + 88|0);
    $789 = HEAP32[$788>>2]|0;
    $790 = (($789) - 1)|0;
    $791 = $17;
    $792 = (($790) + ($791))|0;
    $$sink5 = $785;$$sink7 = $787;$$sink8 = $792;
    label = 51;
    break;
   }
   case 12:  {
    $793 = $12;
    $794 = 105.0 * $793;
    $795 = $12;
    $796 = 105.0 * $795;
    $797 = $12;
    $798 = $796 * $797;
    $799 = $12;
    $800 = $798 * $799;
    $801 = $794 - $800;
    $802 = $12;
    $803 = 21.0 * $802;
    $804 = $12;
    $805 = $803 * $804;
    $806 = $12;
    $807 = $805 * $806;
    $808 = $12;
    $809 = $807 * $808;
    $810 = $12;
    $811 = $809 * $810;
    $812 = $801 + $811;
    $813 = $12;
    $814 = $12;
    $815 = $813 * $814;
    $816 = $12;
    $817 = $815 * $816;
    $818 = $12;
    $819 = $817 * $818;
    $820 = $12;
    $821 = $819 * $820;
    $822 = $12;
    $823 = $821 * $822;
    $824 = $12;
    $825 = $823 * $824;
    $826 = $812 - $825;
    $827 = $12;
    $828 = -$827;
    $829 = $12;
    $830 = $828 * $829;
    $831 = $830 / 2.0;
    $832 = (+Math_exp((+$831)));
    $833 = $826 * $832;
    $834 = ((($20)) + 100|0);
    $835 = HEAP32[$834>>2]|0;
    $836 = ((($20)) + 88|0);
    $837 = HEAP32[$836>>2]|0;
    $838 = (($837) - 1)|0;
    $839 = $17;
    $840 = (($838) + ($839))|0;
    $$sink5 = $833;$$sink7 = $835;$$sink8 = $840;
    label = 51;
    break;
   }
   default: {
   }
   }
  } while(0);
  if ((label|0) == 51) {
   label = 0;
   $841 = (($$sink7) + ($$sink8<<3)|0);
   HEAPF64[$841>>3] = $$sink5;
  }
  $842 = $17;
  $843 = (($842) + 1)|0;
  $17 = $843;
 }
 $844 = $7;
 $845 = ((($20)) + 92|0);
 HEAP32[$845>>2] = $844;
 $18 = 0;
 while(1) {
  $846 = $18;
  $847 = ((($20)) + 88|0);
  $848 = HEAP32[$847>>2]|0;
  $849 = ($846|0)<($848|0);
  if (!($849)) {
   break;
  }
  $850 = $18;
  $851 = $15;
  $852 = (+__ZN3CWT8CwtTransEid($20,$850,$851));
  $853 = ((($20)) + 96|0);
  $854 = HEAP32[$853>>2]|0;
  $855 = $18;
  $856 = (($854) + ($855<<3)|0);
  HEAPF64[$856>>3] = $852;
  $857 = $18;
  $858 = (($857) + 1)|0;
  $18 = $858;
 }
 $859 = ((($20)) + 96|0);
 $860 = HEAP32[$859>>2]|0;
 STACKTOP = sp;return ($860|0);
}
function __ZN3CWT8CwtTransEid($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0.0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0.0;
 var $118 = 0.0, $119 = 0.0, $12 = 0, $120 = 0.0, $121 = 0, $122 = 0.0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0.0, $129 = 0, $13 = 0, $130 = 0.0, $131 = 0.0, $132 = 0.0, $133 = 0.0, $134 = 0, $135 = 0;
 var $136 = 0.0, $137 = 0.0, $138 = 0.0, $139 = 0.0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0.0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0.0, $165 = 0.0, $166 = 0.0, $167 = 0.0, $168 = 0, $169 = 0.0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0.0, $176 = 0, $177 = 0.0, $178 = 0.0, $179 = 0.0, $18 = 0, $180 = 0.0, $181 = 0, $182 = 0, $183 = 0.0, $184 = 0.0, $185 = 0.0, $186 = 0.0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0;
 var $209 = 0, $21 = 0, $210 = 0.0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0.0, $22 = 0, $220 = 0.0, $221 = 0.0, $222 = 0.0, $223 = 0, $224 = 0.0, $225 = 0, $226 = 0;
 var $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0.0, $231 = 0, $232 = 0.0, $233 = 0.0, $234 = 0.0, $235 = 0.0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0.0, $243 = 0.0, $244 = 0.0;
 var $245 = 0.0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0.0, $26 = 0, $260 = 0, $261 = 0, $262 = 0;
 var $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0.0, $269 = 0.0, $27 = 0, $270 = 0.0, $271 = 0.0, $272 = 0, $273 = 0.0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0.0, $28 = 0, $280 = 0;
 var $281 = 0.0, $282 = 0.0, $283 = 0.0, $284 = 0.0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0.0, $292 = 0.0, $293 = 0.0, $294 = 0.0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0;
 var $3 = 0, $30 = 0, $300 = 0, $301 = 0.0, $302 = 0.0, $303 = 0.0, $304 = 0.0, $305 = 0.0, $306 = 0.0, $307 = 0.0, $308 = 0.0, $309 = 0.0, $31 = 0, $310 = 0.0, $311 = 0.0, $312 = 0.0, $313 = 0.0, $314 = 0.0, $315 = 0.0, $316 = 0.0;
 var $317 = 0.0, $318 = 0.0, $319 = 0.0, $32 = 0, $320 = 0.0, $321 = 0.0, $322 = 0.0, $323 = 0.0, $324 = 0.0, $325 = 0.0, $326 = 0.0, $327 = 0.0, $328 = 0.0, $329 = 0.0, $33 = 0, $330 = 0.0, $331 = 0.0, $332 = 0.0, $333 = 0.0, $334 = 0.0;
 var $335 = 0.0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0.0, $50 = 0;
 var $51 = 0.0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0.0, $57 = 0.0, $58 = 0.0, $59 = 0.0, $6 = 0.0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0;
 var $7 = 0.0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0.0, $77 = 0, $78 = 0, $79 = 0, $8 = 0.0, $80 = 0, $81 = 0.0, $82 = 0.0, $83 = 0.0, $84 = 0.0, $85 = 0, $86 = 0, $87 = 0;
 var $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $14 = $3;
 $6 = 0.0;
 $7 = 0.0;
 $8 = 0.0;
 $9 = 0;
 while(1) {
  $15 = $9;
  $16 = ((($14)) + 88|0);
  $17 = HEAP32[$16>>2]|0;
  $18 = ($15|0)<($17|0);
  if (!($18)) {
   break;
  }
  $19 = ((($14)) + 108|0);
  $20 = HEAP8[$19>>0]|0;
  $21 = $20&1;
  $22 = $21&1;
  $23 = ($22|0)==(1);
  if ($23) {
   $24 = $9;
   $25 = $4;
   $26 = ((($14)) + 112|0);
   $27 = HEAP32[$26>>2]|0;
   $28 = (($25) - ($27))|0;
   $29 = ($24|0)<($28|0);
   if ($29) {
    $30 = $4;
    $31 = ((($14)) + 112|0);
    $32 = HEAP32[$31>>2]|0;
    $33 = (($32) - 1)|0;
    $34 = (($30) - ($33))|0;
    $9 = $34;
   }
   $35 = $9;
   $36 = ((($14)) + 112|0);
   $37 = HEAP32[$36>>2]|0;
   $38 = $4;
   $39 = (($37) + ($38))|0;
   $40 = ($35|0)>=($39|0);
   if ($40) {
    break;
   }
  }
  $41 = ((($14)) + 100|0);
  $42 = HEAP32[$41>>2]|0;
  $43 = ((($14)) + 88|0);
  $44 = HEAP32[$43>>2]|0;
  $45 = (($44) - 1)|0;
  $46 = $4;
  $47 = (($45) - ($46))|0;
  $48 = $9;
  $49 = (($47) + ($48))|0;
  $50 = (($42) + ($49<<3)|0);
  $51 = +HEAPF64[$50>>3];
  $52 = ((($14)) + 92|0);
  $53 = HEAP32[$52>>2]|0;
  $54 = $9;
  $55 = (($53) + ($54<<3)|0);
  $56 = +HEAPF64[$55>>3];
  $57 = $51 * $56;
  $58 = $7;
  $59 = $58 + $57;
  $7 = $59;
  $60 = ((($14)) + 84|0);
  $61 = HEAP32[$60>>2]|0;
  $62 = ($61|0)==(3);
  if ($62) {
   label = 9;
  } else {
   $63 = ((($14)) + 84|0);
   $64 = HEAP32[$63>>2]|0;
   $65 = ($64|0)==(4);
   if ($65) {
    label = 9;
   }
  }
  if ((label|0) == 9) {
   label = 0;
   $66 = ((($14)) + 104|0);
   $67 = HEAP32[$66>>2]|0;
   $68 = ((($14)) + 88|0);
   $69 = HEAP32[$68>>2]|0;
   $70 = (($69) - 1)|0;
   $71 = $4;
   $72 = (($70) - ($71))|0;
   $73 = $9;
   $74 = (($72) + ($73))|0;
   $75 = (($67) + ($74<<3)|0);
   $76 = +HEAPF64[$75>>3];
   $77 = ((($14)) + 92|0);
   $78 = HEAP32[$77>>2]|0;
   $79 = $9;
   $80 = (($78) + ($79<<3)|0);
   $81 = +HEAPF64[$80>>3];
   $82 = $76 * $81;
   $83 = $8;
   $84 = $83 + $82;
   $8 = $84;
  }
  $85 = $9;
  $86 = (($85) + 1)|0;
  $9 = $86;
 }
 $10 = 0;
 $87 = ((($14)) + 88|0);
 $88 = HEAP32[$87>>2]|0;
 $89 = ((($14)) + 112|0);
 $90 = HEAP32[$89>>2]|0;
 $91 = (($88) - ($90))|0;
 $11 = $91;
 while(1) {
  $92 = $11;
  $93 = ((($14)) + 88|0);
  $94 = HEAP32[$93>>2]|0;
  $95 = (($94) - 1)|0;
  $96 = $4;
  $97 = (($95) - ($96))|0;
  $98 = ($92|0)<($97|0);
  if (!($98)) {
   break;
  }
  $99 = ((($14)) + 116|0);
  $100 = HEAP8[$99>>0]|0;
  $101 = $100&1;
  do {
   if ($101) {
    $102 = ((($14)) + 100|0);
    $103 = HEAP32[$102>>2]|0;
    $104 = $11;
    $105 = (($103) + ($104<<3)|0);
    $106 = +HEAPF64[$105>>3];
    $107 = ((($14)) + 92|0);
    $108 = HEAP32[$107>>2]|0;
    $109 = ((($14)) + 88|0);
    $110 = HEAP32[$109>>2]|0;
    $111 = (($110) - 1)|0;
    $112 = $11;
    $113 = (($111) - ($112))|0;
    $114 = $4;
    $115 = (($113) - ($114))|0;
    $116 = (($108) + ($115<<3)|0);
    $117 = +HEAPF64[$116>>3];
    $118 = $106 * $117;
    $119 = $7;
    $120 = $119 + $118;
    $7 = $120;
   } else {
    $121 = ((($14)) + 120|0);
    $122 = +HEAPF64[$121>>3];
    $123 = $122 != 0.0;
    $124 = ((($14)) + 100|0);
    $125 = HEAP32[$124>>2]|0;
    $126 = $11;
    $127 = (($125) + ($126<<3)|0);
    $128 = +HEAPF64[$127>>3];
    if ($123) {
     $129 = ((($14)) + 120|0);
     $130 = +HEAPF64[$129>>3];
     $131 = $128 * $130;
     $132 = $7;
     $133 = $132 + $131;
     $7 = $133;
     break;
    } else {
     $134 = ((($14)) + 92|0);
     $135 = HEAP32[$134>>2]|0;
     $136 = +HEAPF64[$135>>3];
     $137 = $128 * $136;
     $138 = $7;
     $139 = $138 + $137;
     $7 = $139;
     break;
    }
   }
  } while(0);
  $140 = ((($14)) + 84|0);
  $141 = HEAP32[$140>>2]|0;
  $142 = ($141|0)==(3);
  if ($142) {
   label = 20;
  } else {
   $143 = ((($14)) + 84|0);
   $144 = HEAP32[$143>>2]|0;
   $145 = ($144|0)==(4);
   if ($145) {
    label = 20;
   }
  }
  do {
   if ((label|0) == 20) {
    label = 0;
    $146 = ((($14)) + 116|0);
    $147 = HEAP8[$146>>0]|0;
    $148 = $147&1;
    if ($148) {
     $149 = ((($14)) + 104|0);
     $150 = HEAP32[$149>>2]|0;
     $151 = $11;
     $152 = (($150) + ($151<<3)|0);
     $153 = +HEAPF64[$152>>3];
     $154 = ((($14)) + 92|0);
     $155 = HEAP32[$154>>2]|0;
     $156 = ((($14)) + 88|0);
     $157 = HEAP32[$156>>2]|0;
     $158 = (($157) - 1)|0;
     $159 = $11;
     $160 = (($158) - ($159))|0;
     $161 = $4;
     $162 = (($160) - ($161))|0;
     $163 = (($155) + ($162<<3)|0);
     $164 = +HEAPF64[$163>>3];
     $165 = $153 * $164;
     $166 = $8;
     $167 = $166 + $165;
     $8 = $167;
     break;
    }
    $168 = ((($14)) + 120|0);
    $169 = +HEAPF64[$168>>3];
    $170 = $169 != 0.0;
    $171 = ((($14)) + 104|0);
    $172 = HEAP32[$171>>2]|0;
    $173 = $11;
    $174 = (($172) + ($173<<3)|0);
    $175 = +HEAPF64[$174>>3];
    if ($170) {
     $176 = ((($14)) + 120|0);
     $177 = +HEAPF64[$176>>3];
     $178 = $175 * $177;
     $179 = $8;
     $180 = $179 + $178;
     $8 = $180;
     break;
    } else {
     $181 = ((($14)) + 92|0);
     $182 = HEAP32[$181>>2]|0;
     $183 = +HEAPF64[$182>>3];
     $184 = $175 * $183;
     $185 = $8;
     $186 = $185 + $184;
     $8 = $186;
     break;
    }
   }
  } while(0);
  $187 = $11;
  $188 = (($187) + 1)|0;
  $11 = $188;
 }
 $12 = 0;
 $189 = ((($14)) + 88|0);
 $190 = HEAP32[$189>>2]|0;
 $191 = $190<<1;
 $192 = $4;
 $193 = (($192) + 1)|0;
 $194 = (($191) - ($193))|0;
 $13 = $194;
 while(1) {
  $195 = $13;
  $196 = ((($14)) + 88|0);
  $197 = HEAP32[$196>>2]|0;
  $198 = ((($14)) + 112|0);
  $199 = HEAP32[$198>>2]|0;
  $200 = (($197) + ($199))|0;
  $201 = (($200) - 1)|0;
  $202 = ($195|0)<($201|0);
  if (!($202)) {
   break;
  }
  $203 = ((($14)) + 116|0);
  $204 = HEAP8[$203>>0]|0;
  $205 = $204&1;
  do {
   if ($205) {
    $206 = ((($14)) + 100|0);
    $207 = HEAP32[$206>>2]|0;
    $208 = $13;
    $209 = (($207) + ($208<<3)|0);
    $210 = +HEAPF64[$209>>3];
    $211 = ((($14)) + 92|0);
    $212 = HEAP32[$211>>2]|0;
    $213 = ((($14)) + 88|0);
    $214 = HEAP32[$213>>2]|0;
    $215 = (($214) - 2)|0;
    $216 = $12;
    $217 = (($215) - ($216))|0;
    $218 = (($212) + ($217<<3)|0);
    $219 = +HEAPF64[$218>>3];
    $220 = $210 * $219;
    $221 = $7;
    $222 = $221 + $220;
    $7 = $222;
   } else {
    $223 = ((($14)) + 128|0);
    $224 = +HEAPF64[$223>>3];
    $225 = $224 != 0.0;
    $226 = ((($14)) + 100|0);
    $227 = HEAP32[$226>>2]|0;
    $228 = $13;
    $229 = (($227) + ($228<<3)|0);
    $230 = +HEAPF64[$229>>3];
    if ($225) {
     $231 = ((($14)) + 128|0);
     $232 = +HEAPF64[$231>>3];
     $233 = $230 * $232;
     $234 = $7;
     $235 = $234 + $233;
     $7 = $235;
     break;
    } else {
     $236 = ((($14)) + 92|0);
     $237 = HEAP32[$236>>2]|0;
     $238 = ((($14)) + 88|0);
     $239 = HEAP32[$238>>2]|0;
     $240 = (($239) - 1)|0;
     $241 = (($237) + ($240<<3)|0);
     $242 = +HEAPF64[$241>>3];
     $243 = $230 * $242;
     $244 = $7;
     $245 = $244 + $243;
     $7 = $245;
     break;
    }
   }
  } while(0);
  $246 = ((($14)) + 84|0);
  $247 = HEAP32[$246>>2]|0;
  $248 = ($247|0)==(3);
  if ($248) {
   label = 35;
  } else {
   $249 = ((($14)) + 84|0);
   $250 = HEAP32[$249>>2]|0;
   $251 = ($250|0)==(4);
   if ($251) {
    label = 35;
   }
  }
  do {
   if ((label|0) == 35) {
    label = 0;
    $252 = ((($14)) + 116|0);
    $253 = HEAP8[$252>>0]|0;
    $254 = $253&1;
    if ($254) {
     $255 = ((($14)) + 104|0);
     $256 = HEAP32[$255>>2]|0;
     $257 = $13;
     $258 = (($256) + ($257<<3)|0);
     $259 = +HEAPF64[$258>>3];
     $260 = ((($14)) + 92|0);
     $261 = HEAP32[$260>>2]|0;
     $262 = ((($14)) + 88|0);
     $263 = HEAP32[$262>>2]|0;
     $264 = (($263) - 2)|0;
     $265 = $12;
     $266 = (($264) - ($265))|0;
     $267 = (($261) + ($266<<3)|0);
     $268 = +HEAPF64[$267>>3];
     $269 = $259 * $268;
     $270 = $8;
     $271 = $270 + $269;
     $8 = $271;
     break;
    }
    $272 = ((($14)) + 128|0);
    $273 = +HEAPF64[$272>>3];
    $274 = $273 != 0.0;
    $275 = ((($14)) + 104|0);
    $276 = HEAP32[$275>>2]|0;
    $277 = $13;
    $278 = (($276) + ($277<<3)|0);
    $279 = +HEAPF64[$278>>3];
    if ($274) {
     $280 = ((($14)) + 128|0);
     $281 = +HEAPF64[$280>>3];
     $282 = $279 * $281;
     $283 = $8;
     $284 = $283 + $282;
     $8 = $284;
     break;
    } else {
     $285 = ((($14)) + 92|0);
     $286 = HEAP32[$285>>2]|0;
     $287 = ((($14)) + 88|0);
     $288 = HEAP32[$287>>2]|0;
     $289 = (($288) - 1)|0;
     $290 = (($286) + ($289<<3)|0);
     $291 = +HEAPF64[$290>>3];
     $292 = $279 * $291;
     $293 = $8;
     $294 = $293 + $292;
     $8 = $294;
     break;
    }
   }
  } while(0);
  $295 = $12;
  $296 = (($295) + 1)|0;
  $12 = $296;
  $297 = $13;
  $298 = (($297) + 1)|0;
  $13 = $298;
 }
 $299 = ((($14)) + 84|0);
 $300 = HEAP32[$299>>2]|0;
 switch ($300|0) {
 case 2:  {
  $301 = (+Math_sqrt(6.2800000000000002));
  $302 = 1.0 / $301;
  $303 = $7;
  $304 = $302 * $303;
  $6 = $304;
  $330 = $5;
  $331 = (+Math_sqrt((+$330)));
  $332 = 1.0 / $331;
  $333 = $6;
  $334 = $332 * $333;
  $6 = $334;
  $335 = $6;
  STACKTOP = sp;return (+$335);
  break;
 }
 case 3:  {
  $305 = $7;
  $306 = $7;
  $307 = $305 * $306;
  $308 = $8;
  $309 = $8;
  $310 = $308 * $309;
  $311 = $307 + $310;
  $312 = (+Math_sqrt((+$311)));
  $6 = $312;
  $313 = (+Math_sqrt(6.2800000000000002));
  $314 = 1.0 / $313;
  $315 = $6;
  $316 = $315 * $314;
  $6 = $316;
  $330 = $5;
  $331 = (+Math_sqrt((+$330)));
  $332 = 1.0 / $331;
  $333 = $6;
  $334 = $332 * $333;
  $6 = $334;
  $335 = $6;
  STACKTOP = sp;return (+$335);
  break;
 }
 case 4:  {
  $317 = $7;
  $318 = $7;
  $319 = $317 * $318;
  $320 = $8;
  $321 = $8;
  $322 = $320 * $321;
  $323 = $319 + $322;
  $324 = (+Math_sqrt((+$323)));
  $6 = $324;
  $325 = (+Math_pow(3.1400000000000001,0.25));
  $326 = 1.0 / $325;
  $327 = $6;
  $328 = $327 * $326;
  $6 = $328;
  $330 = $5;
  $331 = (+Math_sqrt((+$330)));
  $332 = 1.0 / $331;
  $333 = $6;
  $334 = $332 * $333;
  $6 = $334;
  $335 = $6;
  STACKTOP = sp;return (+$335);
  break;
 }
 default: {
  $329 = $7;
  $6 = $329;
  $330 = $5;
  $331 = (+Math_sqrt((+$330)));
  $332 = 1.0 / $331;
  $333 = $6;
  $334 = $332 * $333;
  $6 = $334;
  $335 = $6;
  STACKTOP = sp;return (+$335);
 }
 }
 return +(0.0);
}
function __ZN13EcgAnnotationD0Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $4 = $1;
 __THREW__ = 0;
 invoke_vi(9,($4|0));
 $5 = __THREW__; __THREW__ = 0;
 $6 = $5&1;
 if ($6) {
  $7 = ___cxa_find_matching_catch_2()|0;
  $8 = tempRet0;
  $2 = $7;
  $3 = $8;
  __ZdlPv($4);
  $9 = $2;
  $10 = $3;
  ___resumeException($9|0);
  // unreachable;
 } else {
  __ZdlPv($4);
  STACKTOP = sp;return;
 }
}
function __ZN13EcgAnnotationD2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $1 = $0;
 $7 = $1;
 HEAP32[$7>>2] = (31036);
 $8 = ((($7)) + 152|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ($9|0)!=(0|0);
 if ($10) {
  $2 = 0;
  while(1) {
   $11 = $2;
   $12 = ((($7)) + 156|0);
   $13 = HEAP32[$12>>2]|0;
   $14 = ($11|0)<($13|0);
   $15 = ((($7)) + 152|0);
   $16 = HEAP32[$15>>2]|0;
   if (!($14)) {
    break;
   }
   $17 = $2;
   $18 = (($16) + ($17<<2)|0);
   $19 = HEAP32[$18>>2]|0;
   $20 = ($19|0)==(0|0);
   if (!($20)) {
    __ZdaPv($19);
   }
   $21 = $2;
   $22 = (($21) + 1)|0;
   $2 = $22;
  }
  $23 = ($16|0)==(0|0);
  if (!($23)) {
   __ZdaPv($16);
  }
 }
 $24 = ((($7)) + 160|0);
 $25 = HEAP32[$24>>2]|0;
 $26 = ($25|0)!=(0|0);
 if ($26) {
  $3 = 0;
  while(1) {
   $27 = $3;
   $28 = ((($7)) + 164|0);
   $29 = HEAP32[$28>>2]|0;
   $30 = ($27|0)<($29|0);
   $31 = ((($7)) + 160|0);
   $32 = HEAP32[$31>>2]|0;
   if (!($30)) {
    break;
   }
   $33 = $3;
   $34 = (($32) + ($33<<2)|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = ($35|0)==(0|0);
   if (!($36)) {
    __ZdaPv($35);
   }
   $37 = $3;
   $38 = (($37) + 1)|0;
   $3 = $38;
  }
  $39 = ($32|0)==(0|0);
  if (!($39)) {
   __ZdaPv($32);
  }
 }
 $40 = ((($7)) + 184|0);
 $41 = HEAP32[$40>>2]|0;
 $42 = ($41|0)!=(0|0);
 if ($42) {
  $4 = 0;
  while(1) {
   $43 = $4;
   $44 = ((($7)) + 180|0);
   $45 = HEAP32[$44>>2]|0;
   $46 = ($43|0)<($45|0);
   $47 = ((($7)) + 184|0);
   $48 = HEAP32[$47>>2]|0;
   if (!($46)) {
    break;
   }
   $49 = $4;
   $50 = (($48) + ($49<<2)|0);
   $51 = HEAP32[$50>>2]|0;
   $52 = ($51|0)==(0|0);
   if (!($52)) {
    __ZdaPv($51);
   }
   $53 = $4;
   $54 = (($53) + 1)|0;
   $4 = $54;
  }
  $55 = ($48|0)==(0|0);
  if (!($55)) {
   __ZdaPv($48);
  }
 }
 $56 = ((($7)) + 168|0);
 __THREW__ = 0;
 invoke_vi(36,($56|0));
 $57 = __THREW__; __THREW__ = 0;
 $58 = $57&1;
 if (!($58)) {
  __ZN6SignalD2Ev($7);
  STACKTOP = sp;return;
 }
 $59 = ___cxa_find_matching_catch_2()|0;
 $60 = tempRet0;
 $5 = $59;
 $6 = $60;
 __THREW__ = 0;
 invoke_vi(1,($7|0));
 $61 = __THREW__; __THREW__ = 0;
 $62 = $61&1;
 if ($62) {
  $65 = ___cxa_find_matching_catch_3(0|0)|0;
  $66 = tempRet0;
  ___clang_call_terminate($65);
  // unreachable;
 } else {
  $63 = $5;
  $64 = $6;
  ___resumeException($63|0);
  // unreachable;
 }
}
function __ZNSt3__26vectorIiNS_9allocatorIiEEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 __ZNSt3__213__vector_baseIiNS_9allocatorIiEEED2Ev($2);
 STACKTOP = sp;return;
}
function __ZNSt3__213__vector_baseIiNS_9allocatorIiEEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 144|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(144|0);
 $4 = sp;
 $7 = sp + 128|0;
 $31 = sp + 12|0;
 $33 = sp + 4|0;
 $32 = $0;
 $34 = $32;
 $35 = HEAP32[$34>>2]|0;
 $29 = $31;
 $30 = -1;
 $36 = $29;
 HEAP32[$36>>2] = 0;
 $37 = HEAP32[$31>>2]|0;
 HEAP32[$33>>2] = $37;
 $21 = $33;
 $38 = ($35|0)!=(0|0);
 if (!($38)) {
  STACKTOP = sp;return;
 }
 $13 = $34;
 $39 = $13;
 $40 = HEAP32[$39>>2]|0;
 $11 = $39;
 $12 = $40;
 $41 = $11;
 while(1) {
  $42 = $12;
  $43 = ((($41)) + 4|0);
  $44 = HEAP32[$43>>2]|0;
  $45 = ($42|0)!=($44|0);
  if (!($45)) {
   break;
  }
  $10 = $41;
  $46 = $10;
  $47 = ((($46)) + 8|0);
  $9 = $47;
  $48 = $9;
  $8 = $48;
  $49 = $8;
  $50 = ((($41)) + 4|0);
  $51 = HEAP32[$50>>2]|0;
  $52 = ((($51)) + -4|0);
  HEAP32[$50>>2] = $52;
  $1 = $52;
  $53 = $1;
  $5 = $49;
  $6 = $53;
  $54 = $5;
  $55 = $6;
  ;HEAP8[$4>>0]=HEAP8[$7>>0]|0;
  $2 = $54;
  $3 = $55;
 }
 $16 = $34;
 $56 = $16;
 $57 = ((($56)) + 8|0);
 $15 = $57;
 $58 = $15;
 $14 = $58;
 $59 = $14;
 $60 = HEAP32[$34>>2]|0;
 $20 = $34;
 $61 = $20;
 $19 = $61;
 $62 = $19;
 $63 = ((($62)) + 8|0);
 $18 = $63;
 $64 = $18;
 $17 = $64;
 $65 = $17;
 $66 = HEAP32[$65>>2]|0;
 $67 = HEAP32[$61>>2]|0;
 $68 = $66;
 $69 = $67;
 $70 = (($68) - ($69))|0;
 $71 = (($70|0) / 4)&-1;
 $26 = $59;
 $27 = $60;
 $28 = $71;
 $72 = $26;
 $73 = $27;
 $74 = $28;
 $23 = $72;
 $24 = $73;
 $25 = $74;
 $75 = $24;
 $22 = $75;
 $76 = $22;
 __ZdlPv($76);
 STACKTOP = sp;return;
}
function __ZN13EcgAnnotationC2EP7_annhdr($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(112|0);
 $4 = sp + 96|0;
 $8 = sp + 80|0;
 $12 = sp + 64|0;
 $17 = sp + 44|0;
 $20 = sp + 32|0;
 $23 = sp + 20|0;
 $24 = sp + 16|0;
 $25 = sp + 12|0;
 $27 = $0;
 $28 = $1;
 $29 = $27;
 __ZN6SignalC2Ev($29);
 HEAP32[$29>>2] = (31036);
 $30 = ((($29)) + 152|0);
 HEAP32[$30>>2] = 0;
 $31 = ((($29)) + 156|0);
 HEAP32[$31>>2] = 0;
 $32 = ((($29)) + 160|0);
 HEAP32[$32>>2] = 0;
 $33 = ((($29)) + 164|0);
 HEAP32[$33>>2] = 0;
 $34 = ((($29)) + 168|0);
 $26 = $34;
 $35 = $26;
 $22 = $35;
 $36 = $22;
 $21 = $36;
 $2 = $4;
 $3 = -1;
 $37 = $2;
 HEAP32[$37>>2] = 0;
 $38 = HEAP32[$4>>2]|0;
 HEAP32[$23>>2] = $38;
 $5 = $23;
 HEAP32[$36>>2] = 0;
 $39 = ((($36)) + 4|0);
 $6 = $8;
 $7 = -1;
 $40 = $6;
 HEAP32[$40>>2] = 0;
 $41 = HEAP32[$8>>2]|0;
 HEAP32[$24>>2] = $41;
 $9 = $24;
 HEAP32[$39>>2] = 0;
 $42 = ((($36)) + 8|0);
 $10 = $12;
 $11 = -1;
 $43 = $10;
 HEAP32[$43>>2] = 0;
 $44 = HEAP32[$12>>2]|0;
 HEAP32[$25>>2] = $44;
 $13 = $25;
 $19 = $42;
 HEAP32[$20>>2] = 0;
 $45 = $19;
 $18 = $20;
 $46 = $18;
 $47 = HEAP32[$46>>2]|0;
 $16 = $45;
 HEAP32[$17>>2] = $47;
 $48 = $16;
 $15 = $48;
 $14 = $17;
 $49 = $14;
 $50 = HEAP32[$49>>2]|0;
 HEAP32[$48>>2] = $50;
 $51 = ((($29)) + 180|0);
 HEAP32[$51>>2] = 0;
 $52 = ((($29)) + 184|0);
 HEAP32[$52>>2] = 0;
 $53 = $28;
 $54 = ($53|0)!=(0|0);
 $55 = ((($29)) + 48|0);
 if ($54) {
  $56 = $28;
  dest=$55; src=$56; stop=dest+104|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
  STACKTOP = sp;return;
 } else {
  HEAP32[$55>>2] = 40;
  $57 = ((($29)) + 48|0);
  $58 = ((($57)) + 4|0);
  HEAP32[$58>>2] = 200;
  $59 = ((($29)) + 48|0);
  $60 = ((($59)) + 8|0);
  HEAPF64[$60>>3] = 0.040000000000000001;
  $61 = ((($29)) + 48|0);
  $62 = ((($61)) + 16|0);
  HEAPF64[$62>>3] = 0.20000000000000001;
  $63 = ((($29)) + 48|0);
  $64 = ((($63)) + 24|0);
  HEAPF64[$64>>3] = 13.0;
  $65 = ((($29)) + 48|0);
  $66 = ((($65)) + 32|0);
  HEAP32[$66>>2] = 0;
  $67 = ((($29)) + 48|0);
  $68 = ((($67)) + 40|0);
  HEAPF64[$68>>3] = 0.20000000000000001;
  $69 = ((($29)) + 48|0);
  $70 = ((($69)) + 48|0);
  HEAPF64[$70>>3] = 0.070000000000000007;
  $71 = ((($29)) + 48|0);
  $72 = ((($71)) + 56|0);
  HEAPF64[$72>>3] = 0.20000000000000001;
  $73 = ((($29)) + 48|0);
  $74 = ((($73)) + 64|0);
  HEAPF64[$74>>3] = 0.20999999999999999;
  $75 = ((($29)) + 48|0);
  $76 = ((($75)) + 72|0);
  HEAPF64[$76>>3] = 0.47999999999999998;
  $77 = ((($29)) + 48|0);
  $78 = ((($77)) + 80|0);
  HEAPF64[$78>>3] = 9.0;
  $79 = ((($29)) + 48|0);
  $80 = ((($79)) + 88|0);
  HEAPF64[$80>>3] = 3.0;
  $81 = ((($29)) + 48|0);
  $82 = ((($81)) + 96|0);
  HEAP32[$82>>2] = 0;
  STACKTOP = sp;return;
 }
}
function _ExpGetAllAnnotations($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 $3 = $3|0;
 var $10 = 0.0, $11 = 0, $12 = 0, $4 = 0, $5 = 0, $6 = 0.0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $8 = $4;
 $9 = $5;
 $10 = $6;
 $11 = $7;
 $12 = (__ZN13EcgAnnotation17GetAllAnnotationsEPKdidRi($8,$9,$10,$11)|0);
 STACKTOP = sp;return ($12|0);
}
function __ZN13EcgAnnotation17GetAllAnnotationsEPKdidRi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 $3 = $3|0;
 var $$arith = 0, $$overflow = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0.0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0.0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0.0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 240|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(240|0);
 $9 = sp;
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $8 = 0;
 $16 = $7;
 HEAP32[$16>>2] = 0;
 __ZN13EcgAnnotationC2EP7_annhdr($9,0);
 $17 = $4;
 $18 = $5;
 $19 = $6;
 __THREW__ = 0;
 $20 = (invoke_iiiid(37,($9|0),($17|0),($18|0),(+$19))|0);
 $21 = __THREW__; __THREW__ = 0;
 $22 = $21&1;
 do {
  if (!($22)) {
   $10 = $20;
   $23 = $10;
   $24 = ($23|0)!=(0|0);
   if (!($24)) {
    $90 = $8;
    __ZN13EcgAnnotationD2Ev($9);
    STACKTOP = sp;return ($90|0);
   }
   $25 = $10;
   __THREW__ = 0;
   $26 = (invoke_ii(38,($9|0))|0);
   $27 = __THREW__; __THREW__ = 0;
   $28 = $27&1;
   if (!($28)) {
    $29 = $6;
    __THREW__ = 0;
    invoke_viiid(39,($9|0),($25|0),($26|0),(+$29));
    $30 = __THREW__; __THREW__ = 0;
    $31 = $30&1;
    if (!($31)) {
     $13 = 0;
     $32 = $4;
     $33 = $5;
     $34 = $6;
     $35 = $10;
     __THREW__ = 0;
     $36 = (invoke_ii(38,($9|0))|0);
     $37 = __THREW__; __THREW__ = 0;
     $38 = $37&1;
     if (!($38)) {
      __THREW__ = 0;
      $39 = (invoke_iiiidii(40,($9|0),($32|0),($33|0),(+$34),($35|0),($36|0))|0);
      $40 = __THREW__; __THREW__ = 0;
      $41 = $40&1;
      if (!($41)) {
       $14 = $39;
       $42 = $14;
       $43 = ($42|0)!=(0|0);
       if ($43) {
        __THREW__ = 0;
        $44 = (invoke_ii(41,($9|0))|0);
        $45 = __THREW__; __THREW__ = 0;
        $46 = $45&1;
        if ($46) {
         break;
        }
        $13 = $44;
       } else {
        $51 = $10;
        $14 = $51;
        __THREW__ = 0;
        $52 = (invoke_ii(38,($9|0))|0);
        $53 = __THREW__; __THREW__ = 0;
        $54 = $53&1;
        if ($54) {
         break;
        }
        $55 = $52<<1;
        $13 = $55;
       }
       $56 = $13;
       $57 = $56<<1;
       $58 = $7;
       HEAP32[$58>>2] = $57;
       $59 = $7;
       $60 = HEAP32[$59>>2]|0;
       $$arith = $60<<2;
       $$overflow = ($60>>>0)>(1073741823);
       $61 = $$overflow ? -1 : $$arith;
       __THREW__ = 0;
       $62 = (invoke_ii(42,($61|0))|0);
       $63 = __THREW__; __THREW__ = 0;
       $64 = $63&1;
       if (!($64)) {
        $8 = $62;
        $15 = 0;
        while(1) {
         $65 = $15;
         $66 = $13;
         $67 = ($65|0)<($66|0);
         if (!($67)) {
          break;
         }
         $68 = $14;
         $69 = $15;
         $70 = (($68) + ($69<<2)|0);
         $71 = HEAP32[$70>>2]|0;
         $72 = HEAP32[$71>>2]|0;
         $73 = $8;
         $74 = $15;
         $75 = $74<<1;
         $76 = (($73) + ($75<<2)|0);
         HEAP32[$76>>2] = $72;
         $77 = $14;
         $78 = $15;
         $79 = (($77) + ($78<<2)|0);
         $80 = HEAP32[$79>>2]|0;
         $81 = ((($80)) + 4|0);
         $82 = HEAP32[$81>>2]|0;
         $83 = $8;
         $84 = $15;
         $85 = $84<<1;
         $86 = (($85) + 1)|0;
         $87 = (($83) + ($86<<2)|0);
         HEAP32[$87>>2] = $82;
         $88 = $15;
         $89 = (($88) + 1)|0;
         $15 = $89;
        }
        $90 = $8;
        __ZN13EcgAnnotationD2Ev($9);
        STACKTOP = sp;return ($90|0);
       }
      }
     }
    }
   }
  }
 } while(0);
 $47 = ___cxa_find_matching_catch_2()|0;
 $48 = tempRet0;
 $11 = $47;
 $12 = $48;
 __THREW__ = 0;
 invoke_vi(9,($9|0));
 $49 = __THREW__; __THREW__ = 0;
 $50 = $49&1;
 if ($50) {
  $93 = ___cxa_find_matching_catch_3(0|0)|0;
  $94 = tempRet0;
  ___clang_call_terminate($93);
  // unreachable;
 } else {
  $91 = $11;
  $92 = $12;
  ___resumeException($91|0);
  // unreachable;
 }
 return (0)|0;
}
function __ZN13EcgAnnotation6GetQRSEPKdid($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 var $$ = 0, $$arith = 0, $$overflow = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0;
 var $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0;
 var $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0;
 var $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0;
 var $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0;
 var $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0.0, $25 = 0, $250 = 0, $251 = 0, $252 = 0.0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0.0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0.0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0.0, $294 = 0.0, $295 = 0, $296 = 0;
 var $297 = 0.0, $298 = 0.0, $299 = 0.0, $30 = 0, $300 = 0.0, $301 = 0.0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0.0, $307 = 0.0, $308 = 0.0, $309 = 0.0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0;
 var $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0.0;
 var $333 = 0, $334 = 0.0, $335 = 0.0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0.0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0;
 var $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0;
 var $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0.0, $38 = 0, $380 = 0.0, $381 = 0.0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0;
 var $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0.0, $396 = 0.0, $397 = 0.0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0;
 var $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0;
 var $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0;
 var $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0;
 var $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0.0, $474 = 0.0, $475 = 0.0, $476 = 0, $477 = 0;
 var $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0;
 var $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0;
 var $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0;
 var $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0;
 var $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0;
 var $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0;
 var $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0;
 var $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0.0, $611 = 0.0, $612 = 0.0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0.0, $618 = 0.0, $619 = 0.0, $62 = 0, $620 = 0;
 var $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0.0, $626 = 0.0, $627 = 0.0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0.0, $634 = 0.0, $635 = 0.0, $636 = 0, $637 = 0, $638 = 0, $639 = 0;
 var $64 = 0, $640 = 0, $641 = 0, $642 = 0.0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0;
 var $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0;
 var $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0.0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0;
 var $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0.0, $709 = 0, $71 = 0, $710 = 0;
 var $711 = 0.0, $712 = 0.0, $713 = 0.0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0;
 var $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0;
 var $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0;
 var $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0;
 var $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0;
 var $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0.0, $814 = 0.0, $815 = 0.0, $816 = 0, $817 = 0, $818 = 0, $819 = 0;
 var $82 = 0, $820 = 0, $821 = 0, $822 = 0.0, $823 = 0.0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0.0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0.0, $835 = 0.0, $836 = 0, $837 = 0;
 var $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0.0, $844 = 0.0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0;
 var $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0;
 var $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0;
 var $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0;
 var $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0;
 var $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0;
 var $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 1056|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(1056|0);
 $9 = sp + 32|0;
 $12 = sp + 1047|0;
 $61 = sp + 1046|0;
 $78 = sp + 1045|0;
 $100 = sp + 1044|0;
 $105 = sp + 24|0;
 $108 = sp + 1043|0;
 $158 = sp + 1042|0;
 $167 = sp + 16|0;
 $170 = sp + 1041|0;
 $219 = sp + 1040|0;
 $222 = sp + 208|0;
 $226 = sp + 192|0;
 $230 = sp + 176|0;
 $235 = sp + 156|0;
 $238 = sp + 144|0;
 $241 = sp + 132|0;
 $242 = sp + 128|0;
 $243 = sp + 124|0;
 $254 = sp + 80|0;
 $256 = sp + 72|0;
 $260 = sp + 56|0;
 $261 = sp + 52|0;
 $262 = sp + 48|0;
 $246 = $0;
 $247 = $1;
 $248 = $2;
 $249 = $3;
 $266 = $246;
 $267 = $248;
 $268 = $267<<3;
 $269 = (_malloc($268)|0);
 $250 = $269;
 $251 = 0;
 while(1) {
  $270 = $251;
  $271 = $248;
  $272 = ($270|0)<($271|0);
  if (!($272)) {
   break;
  }
  $273 = $247;
  $274 = $251;
  $275 = (($273) + ($274<<3)|0);
  $276 = +HEAPF64[$275>>3];
  $277 = $250;
  $278 = $251;
  $279 = (($277) + ($278<<3)|0);
  HEAPF64[$279>>3] = $276;
  $280 = $251;
  $281 = (($280) + 1)|0;
  $251 = $281;
 }
 $282 = $250;
 $283 = $248;
 $284 = $249;
 $285 = (__ZNK13EcgAnnotation10Filter30hzEPdid($266,$282,$283,$284)|0);
 $286 = $285&1;
 $287 = ($286|0)==(0);
 if ($287) {
  $288 = $250;
  $289 = ($288|0)==(0|0);
  if (!($289)) {
   __ZdaPv($288);
  }
  $245 = 0;
  $949 = $245;
  STACKTOP = sp;return ($949|0);
 }
 $290 = ((($266)) + 48|0);
 $291 = ((($290)) + 4|0);
 $292 = HEAP32[$291>>2]|0;
 $293 = (+($292|0));
 $294 = 60.0 / $293;
 $295 = ((($266)) + 48|0);
 $296 = ((($295)) + 16|0);
 $297 = +HEAPF64[$296>>3];
 $298 = $294 - $297;
 $252 = $298;
 $299 = $252;
 $300 = $249;
 $301 = $299 * $300;
 $302 = (~~(($301)));
 $303 = ($302|0)<=(0);
 if ($303) {
  $252 = 0.10000000000000001;
  $304 = ((($266)) + 48|0);
  $305 = ((($304)) + 16|0);
  $306 = +HEAPF64[$305>>3];
  $307 = $252;
  $308 = $306 + $307;
  $309 = 60.0 / $308;
  $310 = (~~(($309)));
  $311 = ((($266)) + 48|0);
  $312 = ((($311)) + 4|0);
  HEAP32[$312>>2] = $310;
 }
 $253 = 0;
 $244 = $254;
 $313 = $244;
 $240 = $313;
 $314 = $240;
 $239 = $314;
 $220 = $222;
 $221 = -1;
 $315 = $220;
 HEAP32[$315>>2] = 0;
 $316 = HEAP32[$222>>2]|0;
 HEAP32[$241>>2] = $316;
 $223 = $241;
 HEAP32[$314>>2] = 0;
 $317 = ((($314)) + 4|0);
 $224 = $226;
 $225 = -1;
 $318 = $224;
 HEAP32[$318>>2] = 0;
 $319 = HEAP32[$226>>2]|0;
 HEAP32[$242>>2] = $319;
 $227 = $242;
 HEAP32[$317>>2] = 0;
 $320 = ((($314)) + 8|0);
 $228 = $230;
 $229 = -1;
 $321 = $228;
 HEAP32[$321>>2] = 0;
 $322 = HEAP32[$230>>2]|0;
 HEAP32[$243>>2] = $322;
 $231 = $243;
 $237 = $320;
 HEAP32[$238>>2] = 0;
 $323 = $237;
 $236 = $238;
 $324 = $236;
 $325 = HEAP32[$324>>2]|0;
 $234 = $323;
 HEAP32[$235>>2] = $325;
 $326 = $234;
 $233 = $326;
 $232 = $235;
 $327 = $232;
 $328 = HEAP32[$327>>2]|0;
 HEAP32[$326>>2] = $328;
 $255 = 0;
 while(1) {
  $329 = $250;
  $330 = $255;
  $331 = (($329) + ($330<<3)|0);
  $332 = +HEAPF64[$331>>3];
  $333 = $332 != 0.0;
  if (!($333)) {
   break;
  }
  $334 = $249;
  $335 = 0.10000000000000001 * $334;
  $336 = (~~(($335)));
  $337 = $255;
  $338 = (($337) + ($336))|0;
  $255 = $338;
 }
 while(1) {
  $339 = $250;
  $340 = $255;
  $341 = (($339) + ($340<<3)|0);
  $342 = +HEAPF64[$341>>3];
  $343 = $342 == 0.0;
  $344 = $255;
  if (!($343)) {
   break;
  }
  $345 = (($344) + 1)|0;
  $255 = $345;
 }
 $346 = (($344) - 1)|0;
 HEAP32[$256>>2] = $346;
 $217 = $254;
 $218 = $256;
 $347 = $217;
 $348 = ((($347)) + 4|0);
 $349 = HEAP32[$348>>2]|0;
 $216 = $347;
 $350 = $216;
 $351 = ((($350)) + 8|0);
 $215 = $351;
 $352 = $215;
 $214 = $352;
 $353 = $214;
 $354 = HEAP32[$353>>2]|0;
 $355 = ($349|0)!=($354|0);
 if ($355) {
  $211 = $219;
  $212 = $347;
  $213 = 1;
  $205 = $347;
  $356 = $205;
  $357 = ((($356)) + 8|0);
  $204 = $357;
  $358 = $204;
  $203 = $358;
  $359 = $203;
  $360 = ((($347)) + 4|0);
  $361 = HEAP32[$360>>2]|0;
  $206 = $361;
  $362 = $206;
  $363 = $218;
  $207 = $359;
  $208 = $362;
  $209 = $363;
  $364 = $208;
  $365 = $209;
  $366 = HEAP32[$365>>2]|0;
  HEAP32[$364>>2] = $366;
  $210 = $219;
  $367 = ((($347)) + 4|0);
  $368 = HEAP32[$367>>2]|0;
  $369 = ((($368)) + 4|0);
  HEAP32[$367>>2] = $369;
  label = 18;
 } else {
  $370 = $218;
  __THREW__ = 0;
  invoke_vii(43,($347|0),($370|0));
  $371 = __THREW__; __THREW__ = 0;
  $372 = $371&1;
  if (!($372)) {
   label = 18;
  }
 }
 L25: do {
  if ((label|0) == 18) {
   $373 = $255;
   $259 = $373;
   L27: while(1) {
    $374 = $259;
    $375 = $248;
    $376 = ($374|0)<($375|0);
    if (!($376)) {
     break;
    }
    $377 = ((($266)) + 48|0);
    $378 = ((($377)) + 16|0);
    $379 = +HEAPF64[$378>>3];
    $380 = $249;
    $381 = $379 * $380;
    $382 = (~~(($381)));
    $383 = $259;
    $384 = (($383) + ($382))|0;
    $259 = $384;
    $385 = $259;
    $386 = $248;
    $387 = ($385|0)>=($386|0);
    if ($387) {
     $388 = $248;
     $389 = (($388) - 1)|0;
     $259 = $389;
    }
    $255 = 0;
    $394 = $259;
    $395 = $252;
    $396 = $249;
    $397 = $395 * $396;
    $398 = (~~(($397)));
    $399 = (($394) + ($398))|0;
    $400 = $248;
    $401 = ($399|0)>=($400|0);
    if ($401) {
     label = 24;
     break;
    }
    $470 = $250;
    $471 = $259;
    $472 = (($470) + ($471<<3)|0);
    $473 = $252;
    $474 = $249;
    $475 = $473 * $474;
    $476 = (~~(($475)));
    __THREW__ = 0;
    $477 = (invoke_iiii(44,($266|0),($472|0),($476|0))|0);
    $478 = __THREW__; __THREW__ = 0;
    $479 = $478&1;
    if ($479) {
     break L25;
    }
    do {
     if ($477) {
      $480 = $253;
      $162 = $254;
      $481 = $162;
      $482 = ((($481)) + 4|0);
      $483 = HEAP32[$482>>2]|0;
      $484 = HEAP32[$481>>2]|0;
      $485 = $483;
      $486 = $484;
      $487 = (($485) - ($486))|0;
      $488 = (($487|0) / 4)&-1;
      $489 = (($488) - 1)|0;
      $490 = ($480|0)!=($489|0);
      do {
       if ($490) {
        $491 = ((($266)) + 168|0);
        $141 = $254;
        $492 = $141;
        $493 = ((($492)) + 4|0);
        $494 = HEAP32[$493>>2]|0;
        $495 = HEAP32[$492>>2]|0;
        $496 = $494;
        $497 = $495;
        $498 = (($496) - ($497))|0;
        $499 = (($498|0) / 4)&-1;
        $500 = (($499) - 1)|0;
        $82 = $254;
        $83 = $500;
        $501 = $82;
        $502 = HEAP32[$501>>2]|0;
        $503 = $83;
        $504 = (($502) + ($503<<2)|0);
        $59 = $491;
        $60 = $504;
        $505 = $59;
        $506 = ((($505)) + 4|0);
        $507 = HEAP32[$506>>2]|0;
        $58 = $505;
        $508 = $58;
        $509 = ((($508)) + 8|0);
        $57 = $509;
        $510 = $57;
        $56 = $510;
        $511 = $56;
        $512 = HEAP32[$511>>2]|0;
        $513 = ($507|0)!=($512|0);
        if ($513) {
         $53 = $61;
         $54 = $505;
         $55 = 1;
         $47 = $505;
         $514 = $47;
         $515 = ((($514)) + 8|0);
         $46 = $515;
         $516 = $46;
         $45 = $516;
         $517 = $45;
         $518 = ((($505)) + 4|0);
         $519 = HEAP32[$518>>2]|0;
         $48 = $519;
         $520 = $48;
         $521 = $60;
         $49 = $517;
         $50 = $520;
         $51 = $521;
         $522 = $50;
         $523 = $51;
         $524 = HEAP32[$523>>2]|0;
         HEAP32[$522>>2] = $524;
         $52 = $61;
         $525 = ((($505)) + 4|0);
         $526 = HEAP32[$525>>2]|0;
         $527 = ((($526)) + 4|0);
         HEAP32[$525>>2] = $527;
         break;
        } else {
         $528 = $60;
         __THREW__ = 0;
         invoke_vii(43,($505|0),($528|0));
         $529 = __THREW__; __THREW__ = 0;
         $530 = $529&1;
         if ($530) {
          break L25;
         } else {
          break;
         }
        }
       }
      } while(0);
      $44 = $254;
      $531 = $44;
      $532 = ((($531)) + 4|0);
      $533 = HEAP32[$532>>2]|0;
      $534 = ((($533)) + -4|0);
      $41 = $531;
      $42 = $534;
      $535 = $41;
      $536 = $42;
      $39 = $535;
      $40 = $536;
      $5 = $535;
      $537 = $5;
      $538 = ((($537)) + 4|0);
      $539 = HEAP32[$538>>2]|0;
      $540 = HEAP32[$537>>2]|0;
      $541 = $539;
      $542 = $540;
      $543 = (($541) - ($542))|0;
      $544 = (($543|0) / 4)&-1;
      $43 = $544;
      $545 = $42;
      $16 = $535;
      $17 = $545;
      $546 = $16;
      while(1) {
       $547 = $17;
       $548 = ((($546)) + 4|0);
       $549 = HEAP32[$548>>2]|0;
       $550 = ($547|0)!=($549|0);
       if (!($550)) {
        break;
       }
       $15 = $546;
       $551 = $15;
       $552 = ((($551)) + 8|0);
       $14 = $552;
       $553 = $14;
       $13 = $553;
       $554 = $13;
       $555 = ((($546)) + 4|0);
       $556 = HEAP32[$555>>2]|0;
       $557 = ((($556)) + -4|0);
       HEAP32[$555>>2] = $557;
       $6 = $557;
       $558 = $6;
       $10 = $554;
       $11 = $558;
       $559 = $10;
       $560 = $11;
       ;HEAP8[$9>>0]=HEAP8[$12>>0]|0;
       $7 = $559;
       $8 = $560;
      }
      $561 = $43;
      $37 = $535;
      $38 = $561;
      $562 = $37;
      $36 = $562;
      $563 = $36;
      $564 = HEAP32[$563>>2]|0;
      $35 = $564;
      $565 = $35;
      $19 = $562;
      $566 = $19;
      $567 = HEAP32[$566>>2]|0;
      $18 = $567;
      $568 = $18;
      $24 = $562;
      $569 = $24;
      $23 = $569;
      $570 = $23;
      $22 = $570;
      $571 = $22;
      $572 = ((($571)) + 8|0);
      $21 = $572;
      $573 = $21;
      $20 = $573;
      $574 = $20;
      $575 = HEAP32[$574>>2]|0;
      $576 = HEAP32[$570>>2]|0;
      $577 = $575;
      $578 = $576;
      $579 = (($577) - ($578))|0;
      $580 = (($579|0) / 4)&-1;
      $581 = (($568) + ($580<<2)|0);
      $26 = $562;
      $582 = $26;
      $583 = HEAP32[$582>>2]|0;
      $25 = $583;
      $584 = $25;
      $585 = $38;
      $586 = (($584) + ($585<<2)|0);
      $28 = $562;
      $587 = $28;
      $588 = HEAP32[$587>>2]|0;
      $27 = $588;
      $589 = $27;
      $29 = $562;
      $590 = $29;
      $591 = ((($590)) + 4|0);
      $592 = HEAP32[$591>>2]|0;
      $593 = HEAP32[$590>>2]|0;
      $594 = $592;
      $595 = $593;
      $596 = (($594) - ($595))|0;
      $597 = (($596|0) / 4)&-1;
      $598 = (($589) + ($597<<2)|0);
      $30 = $562;
      $31 = $565;
      $32 = $581;
      $33 = $586;
      $34 = $598;
      $4 = $254;
      $599 = $4;
      $600 = ((($599)) + 4|0);
      $601 = HEAP32[$600>>2]|0;
      $602 = HEAP32[$599>>2]|0;
      $603 = $601;
      $604 = $602;
      $605 = (($603) - ($604))|0;
      $606 = (($605|0) / 4)&-1;
      $253 = $606;
      while(1) {
       $607 = $250;
       $608 = $259;
       $609 = (($607) + ($608<<3)|0);
       $610 = $252;
       $611 = $249;
       $612 = $610 * $611;
       $613 = (~~(($612)));
       __THREW__ = 0;
       $614 = (invoke_iiii(44,($266|0),($609|0),($613|0))|0);
       $615 = __THREW__; __THREW__ = 0;
       $616 = $615&1;
       if ($616) {
        break L25;
       }
       if (!($614)) {
        break;
       }
       $617 = $252;
       $618 = $249;
       $619 = $617 * $618;
       $620 = (~~(($619)));
       $621 = $259;
       $622 = (($621) + ($620))|0;
       $259 = $622;
       $623 = $259;
       $624 = $248;
       $625 = $252;
       $626 = $249;
       $627 = $625 * $626;
       $628 = (~~(($627)));
       $629 = (($624) - ($628))|0;
       $630 = ($623|0)>=($629|0);
       if ($630) {
        break;
       }
      }
      $631 = $259;
      $632 = $248;
      $633 = $252;
      $634 = $249;
      $635 = $633 * $634;
      $636 = (~~(($635)));
      $637 = (($632) - ($636))|0;
      $638 = ($631|0)>=($637|0);
      if ($638) {
       break L27;
      }
      while(1) {
       $639 = $250;
       $640 = $259;
       $641 = (($639) + ($640<<3)|0);
       $642 = +HEAPF64[$641>>3];
       $643 = $642 == 0.0;
       if (!($643)) {
        break;
       }
       $644 = $259;
       $645 = (($644) + 1)|0;
       $259 = $645;
       $646 = $259;
       $647 = $248;
       $648 = ($646|0)>=($647|0);
       if ($648) {
        break;
       }
      }
      $649 = $259;
      $650 = $248;
      $651 = ($649|0)>=($650|0);
      if ($651) {
       break L27;
      }
      $652 = $259;
      $653 = (($652) - 1)|0;
      HEAP32[$260>>2] = $653;
      $76 = $254;
      $77 = $260;
      $654 = $76;
      $655 = ((($654)) + 4|0);
      $656 = HEAP32[$655>>2]|0;
      $75 = $654;
      $657 = $75;
      $658 = ((($657)) + 8|0);
      $74 = $658;
      $659 = $74;
      $73 = $659;
      $660 = $73;
      $661 = HEAP32[$660>>2]|0;
      $662 = ($656|0)!=($661|0);
      if ($662) {
       $70 = $78;
       $71 = $654;
       $72 = 1;
       $64 = $654;
       $663 = $64;
       $664 = ((($663)) + 8|0);
       $63 = $664;
       $665 = $63;
       $62 = $665;
       $666 = $62;
       $667 = ((($654)) + 4|0);
       $668 = HEAP32[$667>>2]|0;
       $65 = $668;
       $669 = $65;
       $670 = $77;
       $66 = $666;
       $67 = $669;
       $68 = $670;
       $671 = $67;
       $672 = $68;
       $673 = HEAP32[$672>>2]|0;
       HEAP32[$671>>2] = $673;
       $69 = $78;
       $674 = ((($654)) + 4|0);
       $675 = HEAP32[$674>>2]|0;
       $676 = ((($675)) + 4|0);
       HEAP32[$674>>2] = $676;
       break;
      } else {
       $677 = $77;
       __THREW__ = 0;
       invoke_vii(43,($654|0),($677|0));
       $678 = __THREW__; __THREW__ = 0;
       $679 = $678&1;
       if ($679) {
        break L25;
       } else {
        break;
       }
      }
     } else {
      while(1) {
       $680 = $250;
       $681 = $259;
       $682 = $255;
       $683 = (($681) - ($682))|0;
       $684 = (($680) + ($683<<3)|0);
       $685 = +HEAPF64[$684>>3];
       $686 = $685 == 0.0;
       if (!($686)) {
        break;
       }
       $687 = $255;
       $688 = (($687) + 1)|0;
       $255 = $688;
      }
      $689 = $259;
      $690 = $255;
      $691 = (($689) - ($690))|0;
      $692 = (($691) + 1)|0;
      $79 = $254;
      $693 = $79;
      $694 = ((($693)) + 4|0);
      $695 = HEAP32[$694>>2]|0;
      $696 = HEAP32[$693>>2]|0;
      $697 = $695;
      $698 = $696;
      $699 = (($697) - ($698))|0;
      $700 = (($699|0) / 4)&-1;
      $701 = (($700) - 1)|0;
      $80 = $254;
      $81 = $701;
      $702 = $80;
      $703 = HEAP32[$702>>2]|0;
      $704 = $81;
      $705 = (($703) + ($704<<2)|0);
      $706 = HEAP32[$705>>2]|0;
      $707 = (($692) - ($706))|0;
      $708 = (+($707|0));
      $709 = ((($266)) + 48|0);
      $710 = ((($709)) + 8|0);
      $711 = +HEAPF64[$710>>3];
      $712 = $249;
      $713 = $711 * $712;
      $714 = $708 > $713;
      do {
       if ($714) {
        $715 = $259;
        $716 = $255;
        $717 = (($715) - ($716))|0;
        $718 = (($717) + 2)|0;
        HEAP32[$261>>2] = $718;
        $98 = $254;
        $99 = $261;
        $719 = $98;
        $720 = ((($719)) + 4|0);
        $721 = HEAP32[$720>>2]|0;
        $97 = $719;
        $722 = $97;
        $723 = ((($722)) + 8|0);
        $96 = $723;
        $724 = $96;
        $95 = $724;
        $725 = $95;
        $726 = HEAP32[$725>>2]|0;
        $727 = ($721|0)!=($726|0);
        if ($727) {
         $92 = $100;
         $93 = $719;
         $94 = 1;
         $86 = $719;
         $728 = $86;
         $729 = ((($728)) + 8|0);
         $85 = $729;
         $730 = $85;
         $84 = $730;
         $731 = $84;
         $732 = ((($719)) + 4|0);
         $733 = HEAP32[$732>>2]|0;
         $87 = $733;
         $734 = $87;
         $735 = $99;
         $88 = $731;
         $89 = $734;
         $90 = $735;
         $736 = $89;
         $737 = $90;
         $738 = HEAP32[$737>>2]|0;
         HEAP32[$736>>2] = $738;
         $91 = $100;
         $739 = ((($719)) + 4|0);
         $740 = HEAP32[$739>>2]|0;
         $741 = ((($740)) + 4|0);
         HEAP32[$739>>2] = $741;
         break;
        } else {
         $742 = $99;
         __THREW__ = 0;
         invoke_vii(43,($719|0),($742|0));
         $743 = __THREW__; __THREW__ = 0;
         $744 = $743&1;
         if ($744) {
          break L25;
         } else {
          break;
         }
        }
       } else {
        $140 = $254;
        $745 = $140;
        $746 = ((($745)) + 4|0);
        $747 = HEAP32[$746>>2]|0;
        $748 = ((($747)) + -4|0);
        $137 = $745;
        $138 = $748;
        $749 = $137;
        $750 = $138;
        $135 = $749;
        $136 = $750;
        $101 = $749;
        $751 = $101;
        $752 = ((($751)) + 4|0);
        $753 = HEAP32[$752>>2]|0;
        $754 = HEAP32[$751>>2]|0;
        $755 = $753;
        $756 = $754;
        $757 = (($755) - ($756))|0;
        $758 = (($757|0) / 4)&-1;
        $139 = $758;
        $759 = $138;
        $112 = $749;
        $113 = $759;
        $760 = $112;
        while(1) {
         $761 = $113;
         $762 = ((($760)) + 4|0);
         $763 = HEAP32[$762>>2]|0;
         $764 = ($761|0)!=($763|0);
         if (!($764)) {
          break;
         }
         $111 = $760;
         $765 = $111;
         $766 = ((($765)) + 8|0);
         $110 = $766;
         $767 = $110;
         $109 = $767;
         $768 = $109;
         $769 = ((($760)) + 4|0);
         $770 = HEAP32[$769>>2]|0;
         $771 = ((($770)) + -4|0);
         HEAP32[$769>>2] = $771;
         $102 = $771;
         $772 = $102;
         $106 = $768;
         $107 = $772;
         $773 = $106;
         $774 = $107;
         ;HEAP8[$105>>0]=HEAP8[$108>>0]|0;
         $103 = $773;
         $104 = $774;
        }
        $775 = $139;
        $133 = $749;
        $134 = $775;
        $776 = $133;
        $132 = $776;
        $777 = $132;
        $778 = HEAP32[$777>>2]|0;
        $131 = $778;
        $779 = $131;
        $115 = $776;
        $780 = $115;
        $781 = HEAP32[$780>>2]|0;
        $114 = $781;
        $782 = $114;
        $120 = $776;
        $783 = $120;
        $119 = $783;
        $784 = $119;
        $118 = $784;
        $785 = $118;
        $786 = ((($785)) + 8|0);
        $117 = $786;
        $787 = $117;
        $116 = $787;
        $788 = $116;
        $789 = HEAP32[$788>>2]|0;
        $790 = HEAP32[$784>>2]|0;
        $791 = $789;
        $792 = $790;
        $793 = (($791) - ($792))|0;
        $794 = (($793|0) / 4)&-1;
        $795 = (($782) + ($794<<2)|0);
        $122 = $776;
        $796 = $122;
        $797 = HEAP32[$796>>2]|0;
        $121 = $797;
        $798 = $121;
        $799 = $134;
        $800 = (($798) + ($799<<2)|0);
        $124 = $776;
        $801 = $124;
        $802 = HEAP32[$801>>2]|0;
        $123 = $802;
        $803 = $123;
        $125 = $776;
        $804 = $125;
        $805 = ((($804)) + 4|0);
        $806 = HEAP32[$805>>2]|0;
        $807 = HEAP32[$804>>2]|0;
        $808 = $806;
        $809 = $807;
        $810 = (($808) - ($809))|0;
        $811 = (($810|0) / 4)&-1;
        $812 = (($803) + ($811<<2)|0);
        $126 = $776;
        $127 = $779;
        $128 = $795;
        $129 = $800;
        $130 = $812;
       }
      } while(0);
      $813 = $252;
      $814 = $249;
      $815 = $813 * $814;
      $816 = (~~(($815)));
      $817 = $259;
      $818 = (($817) + ($816))|0;
      $259 = $818;
      $819 = $248;
      $820 = $259;
      $821 = (($819) - ($820))|0;
      $822 = $249;
      $823 = $822 / 2.0;
      $824 = (~~(($823)));
      $825 = ($821|0)<($824|0);
      if ($825) {
       break L27;
      }
      while(1) {
       $826 = $250;
       $827 = $259;
       $828 = (($826) + ($827<<3)|0);
       $829 = +HEAPF64[$828>>3];
       $830 = $829 == 0.0;
       if (!($830)) {
        break;
       }
       $831 = $248;
       $832 = $259;
       $833 = (($831) - ($832))|0;
       $834 = $249;
       $835 = $834 / 2.0;
       $836 = (~~(($835)));
       $837 = ($833|0)>=($836|0);
       if (!($837)) {
        break;
       }
       $838 = $259;
       $839 = (($838) + 1)|0;
       $259 = $839;
      }
      $840 = $248;
      $841 = $259;
      $842 = (($840) - ($841))|0;
      $843 = $249;
      $844 = $843 / 2.0;
      $845 = (~~(($844)));
      $846 = ($842|0)<($845|0);
      if ($846) {
       break L27;
      }
      $847 = $259;
      $848 = (($847) - 1)|0;
      HEAP32[$262>>2] = $848;
      $156 = $254;
      $157 = $262;
      $849 = $156;
      $850 = ((($849)) + 4|0);
      $851 = HEAP32[$850>>2]|0;
      $155 = $849;
      $852 = $155;
      $853 = ((($852)) + 8|0);
      $154 = $853;
      $854 = $154;
      $153 = $854;
      $855 = $153;
      $856 = HEAP32[$855>>2]|0;
      $857 = ($851|0)!=($856|0);
      if ($857) {
       $150 = $158;
       $151 = $849;
       $152 = 1;
       $144 = $849;
       $858 = $144;
       $859 = ((($858)) + 8|0);
       $143 = $859;
       $860 = $143;
       $142 = $860;
       $861 = $142;
       $862 = ((($849)) + 4|0);
       $863 = HEAP32[$862>>2]|0;
       $145 = $863;
       $864 = $145;
       $865 = $157;
       $146 = $861;
       $147 = $864;
       $148 = $865;
       $866 = $147;
       $867 = $148;
       $868 = HEAP32[$867>>2]|0;
       HEAP32[$866>>2] = $868;
       $149 = $158;
       $869 = ((($849)) + 4|0);
       $870 = HEAP32[$869>>2]|0;
       $871 = ((($870)) + 4|0);
       HEAP32[$869>>2] = $871;
       break;
      } else {
       $872 = $157;
       __THREW__ = 0;
       invoke_vii(43,($849|0),($872|0));
       $873 = __THREW__; __THREW__ = 0;
       $874 = $873&1;
       if ($874) {
        break L25;
       } else {
        break;
       }
      }
     }
    } while(0);
    $875 = $259;
    $876 = (($875) + 1)|0;
    $259 = $876;
   }
   if ((label|0) == 24) {
    $202 = $254;
    $402 = $202;
    $403 = ((($402)) + 4|0);
    $404 = HEAP32[$403>>2]|0;
    $405 = ((($404)) + -4|0);
    $199 = $402;
    $200 = $405;
    $406 = $199;
    $407 = $200;
    $197 = $406;
    $198 = $407;
    $163 = $406;
    $408 = $163;
    $409 = ((($408)) + 4|0);
    $410 = HEAP32[$409>>2]|0;
    $411 = HEAP32[$408>>2]|0;
    $412 = $410;
    $413 = $411;
    $414 = (($412) - ($413))|0;
    $415 = (($414|0) / 4)&-1;
    $201 = $415;
    $416 = $200;
    $174 = $406;
    $175 = $416;
    $417 = $174;
    while(1) {
     $418 = $175;
     $419 = ((($417)) + 4|0);
     $420 = HEAP32[$419>>2]|0;
     $421 = ($418|0)!=($420|0);
     if (!($421)) {
      break;
     }
     $173 = $417;
     $422 = $173;
     $423 = ((($422)) + 8|0);
     $172 = $423;
     $424 = $172;
     $171 = $424;
     $425 = $171;
     $426 = ((($417)) + 4|0);
     $427 = HEAP32[$426>>2]|0;
     $428 = ((($427)) + -4|0);
     HEAP32[$426>>2] = $428;
     $164 = $428;
     $429 = $164;
     $168 = $425;
     $169 = $429;
     $430 = $168;
     $431 = $169;
     ;HEAP8[$167>>0]=HEAP8[$170>>0]|0;
     $165 = $430;
     $166 = $431;
    }
    $432 = $201;
    $195 = $406;
    $196 = $432;
    $433 = $195;
    $194 = $433;
    $434 = $194;
    $435 = HEAP32[$434>>2]|0;
    $193 = $435;
    $436 = $193;
    $177 = $433;
    $437 = $177;
    $438 = HEAP32[$437>>2]|0;
    $176 = $438;
    $439 = $176;
    $182 = $433;
    $440 = $182;
    $181 = $440;
    $441 = $181;
    $180 = $441;
    $442 = $180;
    $443 = ((($442)) + 8|0);
    $179 = $443;
    $444 = $179;
    $178 = $444;
    $445 = $178;
    $446 = HEAP32[$445>>2]|0;
    $447 = HEAP32[$441>>2]|0;
    $448 = $446;
    $449 = $447;
    $450 = (($448) - ($449))|0;
    $451 = (($450|0) / 4)&-1;
    $452 = (($439) + ($451<<2)|0);
    $184 = $433;
    $453 = $184;
    $454 = HEAP32[$453>>2]|0;
    $183 = $454;
    $455 = $183;
    $456 = $196;
    $457 = (($455) + ($456<<2)|0);
    $186 = $433;
    $458 = $186;
    $459 = HEAP32[$458>>2]|0;
    $185 = $459;
    $460 = $185;
    $187 = $433;
    $461 = $187;
    $462 = ((($461)) + 4|0);
    $463 = HEAP32[$462>>2]|0;
    $464 = HEAP32[$461>>2]|0;
    $465 = $463;
    $466 = $464;
    $467 = (($465) - ($466))|0;
    $468 = (($467|0) / 4)&-1;
    $469 = (($460) + ($468<<2)|0);
    $188 = $433;
    $189 = $436;
    $190 = $452;
    $191 = $457;
    $192 = $469;
   }
   $877 = $250;
   $878 = ($877|0)==(0|0);
   if (!($878)) {
    __ZdaPv($877);
   }
   $159 = $254;
   $879 = $159;
   $880 = ((($879)) + 4|0);
   $881 = HEAP32[$880>>2]|0;
   $882 = HEAP32[$879>>2]|0;
   $883 = $881;
   $884 = $882;
   $885 = (($883) - ($884))|0;
   $886 = (($885|0) / 4)&-1;
   $887 = (($886>>>0) / 2)&-1;
   $888 = ((($266)) + 164|0);
   HEAP32[$888>>2] = $887;
   $889 = ((($266)) + 164|0);
   $890 = HEAP32[$889>>2]|0;
   $891 = ($890|0)>(0);
   if ($891) {
    $892 = ((($266)) + 164|0);
    $893 = HEAP32[$892>>2]|0;
    $894 = $893<<1;
    $$arith = $894<<2;
    $$overflow = ($894>>>0)>(1073741823);
    $895 = $$overflow ? -1 : $$arith;
    __THREW__ = 0;
    $896 = (invoke_ii(42,($895|0))|0);
    $897 = __THREW__; __THREW__ = 0;
    $898 = $897&1;
    if ($898) {
     break;
    }
    $899 = ((($266)) + 160|0);
    HEAP32[$899>>2] = $896;
    $263 = 0;
    while(1) {
     $900 = $263;
     $901 = ((($266)) + 164|0);
     $902 = HEAP32[$901>>2]|0;
     $903 = $902<<1;
     $904 = ($900|0)<($903|0);
     if (!($904)) {
      break;
     }
     __THREW__ = 0;
     $905 = (invoke_ii(42,12)|0);
     $906 = __THREW__; __THREW__ = 0;
     $907 = $906&1;
     if ($907) {
      break L25;
     }
     $908 = ((($266)) + 160|0);
     $909 = HEAP32[$908>>2]|0;
     $910 = $263;
     $911 = (($909) + ($910<<2)|0);
     HEAP32[$911>>2] = $905;
     $912 = $263;
     $913 = (($912) + 1)|0;
     $263 = $913;
    }
    $264 = 0;
    while(1) {
     $914 = $264;
     $915 = ((($266)) + 164|0);
     $916 = HEAP32[$915>>2]|0;
     $917 = $916<<1;
     $918 = ($914|0)<($917|0);
     if (!($918)) {
      break;
     }
     $919 = $264;
     $160 = $254;
     $161 = $919;
     $920 = $160;
     $921 = HEAP32[$920>>2]|0;
     $922 = $161;
     $923 = (($921) + ($922<<2)|0);
     $924 = HEAP32[$923>>2]|0;
     $925 = ((($266)) + 160|0);
     $926 = HEAP32[$925>>2]|0;
     $927 = $264;
     $928 = (($926) + ($927<<2)|0);
     $929 = HEAP32[$928>>2]|0;
     HEAP32[$929>>2] = $924;
     $930 = $264;
     $931 = (($930|0) % 2)&-1;
     $932 = ($931|0)==(0);
     $933 = ((($266)) + 160|0);
     $934 = HEAP32[$933>>2]|0;
     $935 = $264;
     $936 = (($934) + ($935<<2)|0);
     $$ = $932 ? 1 : 40;
     $937 = HEAP32[$936>>2]|0;
     $938 = ((($937)) + 4|0);
     HEAP32[$938>>2] = $$;
     $939 = ((($266)) + 160|0);
     $940 = HEAP32[$939>>2]|0;
     $941 = $264;
     $942 = (($940) + ($941<<2)|0);
     $943 = HEAP32[$942>>2]|0;
     $944 = ((($943)) + 8|0);
     HEAP32[$944>>2] = -1;
     $945 = $264;
     $946 = (($945) + 1)|0;
     $264 = $946;
    }
    $947 = ((($266)) + 160|0);
    $948 = HEAP32[$947>>2]|0;
    $245 = $948;
    $265 = 1;
   } else {
    $245 = 0;
    $265 = 1;
   }
   __ZNSt3__26vectorIiNS_9allocatorIiEEED2Ev($254);
   $949 = $245;
   STACKTOP = sp;return ($949|0);
  }
 } while(0);
 $390 = ___cxa_find_matching_catch_2()|0;
 $391 = tempRet0;
 $257 = $390;
 $258 = $391;
 __THREW__ = 0;
 invoke_vi(36,($254|0));
 $392 = __THREW__; __THREW__ = 0;
 $393 = $392&1;
 if ($393) {
  $952 = ___cxa_find_matching_catch_3(0|0)|0;
  $953 = tempRet0;
  ___clang_call_terminate($952);
  // unreachable;
 } else {
  $950 = $257;
  $951 = $258;
  ___resumeException($950|0);
  // unreachable;
 }
 return (0)|0;
}
function __ZNK13EcgAnnotation12GetQrsNumberEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 $3 = ((($2)) + 164|0);
 $4 = HEAP32[$3>>2]|0;
 STACKTOP = sp;return ($4|0);
}
function __ZNK13EcgAnnotation11GetEctopicsEPPiid($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0.0;
 var $136 = 0.0, $137 = 0.0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0.0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0.0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0;
 var $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0.0;
 var $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0.0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0.0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0.0, $244 = 0;
 var $245 = 0, $246 = 0, $247 = 0, $248 = 0.0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0.0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0.0, $26 = 0, $260 = 0, $261 = 0, $262 = 0;
 var $263 = 0, $264 = 0, $265 = 0, $266 = 0.0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0.0, $274 = 0.0, $275 = 0.0, $276 = 0, $277 = 0, $278 = 0.0, $279 = 0, $28 = 0, $280 = 0.0;
 var $281 = 0.0, $282 = 0, $283 = 0, $284 = 0, $285 = 0.0, $286 = 0, $287 = 0.0, $288 = 0.0, $289 = 0, $29 = 0, $290 = 0, $291 = 0.0, $292 = 0, $293 = 0.0, $294 = 0.0, $295 = 0, $296 = 0, $297 = 0, $298 = 0.0, $299 = 0;
 var $30 = 0, $300 = 0.0, $301 = 0.0, $302 = 0, $303 = 0, $304 = 0.0, $305 = 0, $306 = 0.0, $307 = 0.0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0.0, $312 = 0, $313 = 0.0, $314 = 0.0, $315 = 0.0, $316 = 0, $317 = 0.0;
 var $318 = 0.0, $319 = 0.0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0.0, $329 = 0.0, $33 = 0, $330 = 0.0, $331 = 0.0, $332 = 0, $333 = 0.0, $334 = 0, $335 = 0.0;
 var $336 = 0, $337 = 0.0, $338 = 0.0, $339 = 0.0, $34 = 0, $340 = 0.0, $341 = 0.0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0.0, $351 = 0.0, $352 = 0.0, $353 = 0.0;
 var $354 = 0, $355 = 0.0, $356 = 0, $357 = 0.0, $358 = 0, $359 = 0.0, $36 = 0, $360 = 0.0, $361 = 0.0, $362 = 0.0, $363 = 0.0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0;
 var $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0.0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0.0, $95 = 0.0, $96 = 0.0, $97 = 0, $98 = 0, $99 = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, $or$cond7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 400|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(400|0);
 $20 = sp + 397|0;
 $59 = sp + 396|0;
 $62 = sp + 168|0;
 $66 = sp + 152|0;
 $70 = sp + 136|0;
 $75 = sp + 116|0;
 $78 = sp + 104|0;
 $81 = sp + 92|0;
 $82 = sp + 88|0;
 $83 = sp + 84|0;
 $89 = sp + 56|0;
 $91 = sp + 24|0;
 $85 = $0;
 $86 = $1;
 $87 = $2;
 $88 = $3;
 $98 = $85;
 $99 = $87;
 $100 = ($99|0)<(3);
 if ($100) {
  STACKTOP = sp;return;
 }
 $84 = $89;
 $101 = $84;
 $80 = $101;
 $102 = $80;
 $79 = $102;
 $60 = $62;
 $61 = -1;
 $103 = $60;
 HEAP32[$103>>2] = 0;
 $104 = HEAP32[$62>>2]|0;
 HEAP32[$81>>2] = $104;
 $63 = $81;
 HEAP32[$102>>2] = 0;
 $105 = ((($102)) + 4|0);
 $64 = $66;
 $65 = -1;
 $106 = $64;
 HEAP32[$106>>2] = 0;
 $107 = HEAP32[$66>>2]|0;
 HEAP32[$82>>2] = $107;
 $67 = $82;
 HEAP32[$105>>2] = 0;
 $108 = ((($102)) + 8|0);
 $68 = $70;
 $69 = -1;
 $109 = $68;
 HEAP32[$109>>2] = 0;
 $110 = HEAP32[$70>>2]|0;
 HEAP32[$83>>2] = $110;
 $71 = $83;
 $77 = $108;
 HEAP32[$78>>2] = 0;
 $111 = $77;
 $76 = $78;
 $112 = $76;
 $113 = HEAP32[$112>>2]|0;
 $74 = $111;
 HEAP32[$75>>2] = $113;
 $114 = $74;
 $73 = $114;
 $72 = $75;
 $115 = $72;
 $116 = HEAP32[$115>>2]|0;
 HEAP32[$114>>2] = $116;
 $90 = 0;
 while(1) {
  $117 = $90;
  $118 = $87;
  $119 = (($118) - 1)|0;
  $120 = ($117|0)<($119|0);
  if (!($120)) {
   label = 9;
   break;
  }
  $121 = $86;
  $122 = $90;
  $123 = $122<<1;
  $124 = (($123) + 2)|0;
  $125 = (($121) + ($124<<2)|0);
  $126 = HEAP32[$125>>2]|0;
  $127 = HEAP32[$126>>2]|0;
  $128 = $86;
  $129 = $90;
  $130 = $129<<1;
  $131 = (($128) + ($130<<2)|0);
  $132 = HEAP32[$131>>2]|0;
  $133 = HEAP32[$132>>2]|0;
  $134 = (($127) - ($133))|0;
  $135 = (+($134|0));
  $136 = $88;
  $137 = $135 / $136;
  HEAPF64[$91>>3] = $137;
  $57 = $89;
  $58 = $91;
  $138 = $57;
  $139 = ((($138)) + 4|0);
  $140 = HEAP32[$139>>2]|0;
  $56 = $138;
  $141 = $56;
  $142 = ((($141)) + 8|0);
  $55 = $142;
  $143 = $55;
  $54 = $143;
  $144 = $54;
  $145 = HEAP32[$144>>2]|0;
  $146 = ($140|0)!=($145|0);
  if ($146) {
   $51 = $59;
   $52 = $138;
   $53 = 1;
   $45 = $138;
   $147 = $45;
   $148 = ((($147)) + 8|0);
   $44 = $148;
   $149 = $44;
   $43 = $149;
   $150 = $43;
   $151 = ((($138)) + 4|0);
   $152 = HEAP32[$151>>2]|0;
   $46 = $152;
   $153 = $46;
   $154 = $58;
   $47 = $150;
   $48 = $153;
   $49 = $154;
   $155 = $48;
   $156 = $49;
   $157 = +HEAPF64[$156>>3];
   HEAPF64[$155>>3] = $157;
   $50 = $59;
   $158 = ((($138)) + 4|0);
   $159 = HEAP32[$158>>2]|0;
   $160 = ((($159)) + 8|0);
   HEAP32[$158>>2] = $160;
  } else {
   $161 = $58;
   __THREW__ = 0;
   invoke_vii(45,($138|0),($161|0));
   $162 = __THREW__; __THREW__ = 0;
   $163 = $162&1;
   if ($163) {
    break;
   }
  }
  $164 = $90;
  $165 = (($164) + 1)|0;
  $90 = $165;
 }
 do {
  if ((label|0) == 9) {
   $42 = $89;
   $170 = $42;
   $171 = ((($170)) + 4|0);
   $172 = HEAP32[$171>>2]|0;
   $173 = HEAP32[$170>>2]|0;
   $174 = $172;
   $175 = $173;
   $176 = (($174) - ($175))|0;
   $177 = (($176|0) / 8)&-1;
   $178 = (($177) - 1)|0;
   $40 = $89;
   $41 = $178;
   $179 = $40;
   $180 = HEAP32[$179>>2]|0;
   $181 = $41;
   $182 = (($180) + ($181<<3)|0);
   $18 = $89;
   $19 = $182;
   $183 = $18;
   $184 = ((($183)) + 4|0);
   $185 = HEAP32[$184>>2]|0;
   $17 = $183;
   $186 = $17;
   $187 = ((($186)) + 8|0);
   $16 = $187;
   $188 = $16;
   $15 = $188;
   $189 = $15;
   $190 = HEAP32[$189>>2]|0;
   $191 = ($185|0)!=($190|0);
   if ($191) {
    $12 = $20;
    $13 = $183;
    $14 = 1;
    $6 = $183;
    $192 = $6;
    $193 = ((($192)) + 8|0);
    $5 = $193;
    $194 = $5;
    $4 = $194;
    $195 = $4;
    $196 = ((($183)) + 4|0);
    $197 = HEAP32[$196>>2]|0;
    $7 = $197;
    $198 = $7;
    $199 = $19;
    $8 = $195;
    $9 = $198;
    $10 = $199;
    $200 = $9;
    $201 = $10;
    $202 = +HEAPF64[$201>>3];
    HEAPF64[$200>>3] = $202;
    $11 = $20;
    $203 = ((($183)) + 4|0);
    $204 = HEAP32[$203>>2]|0;
    $205 = ((($204)) + 8|0);
    HEAP32[$203>>2] = $205;
   } else {
    $206 = $19;
    __THREW__ = 0;
    invoke_vii(45,($183|0),($206|0));
    $207 = __THREW__; __THREW__ = 0;
    $208 = $207&1;
    if ($208) {
     break;
    }
   }
   $97 = -2;
   while(1) {
    $209 = $97;
    $21 = $89;
    $210 = $21;
    $211 = ((($210)) + 4|0);
    $212 = HEAP32[$211>>2]|0;
    $213 = HEAP32[$210>>2]|0;
    $214 = $212;
    $215 = $213;
    $216 = (($214) - ($215))|0;
    $217 = (($216|0) / 8)&-1;
    $218 = (($217) - 2)|0;
    $219 = ($209|0)<($218|0);
    if (!($219)) {
     break;
    }
    $220 = $97;
    $221 = ($220|0)==(-2);
    do {
     if ($221) {
      $22 = $89;
      $23 = 1;
      $222 = $22;
      $223 = HEAP32[$222>>2]|0;
      $224 = $23;
      $225 = (($223) + ($224<<3)|0);
      $226 = +HEAPF64[$225>>3];
      $94 = $226;
      $24 = $89;
      $25 = 0;
      $227 = $24;
      $228 = HEAP32[$227>>2]|0;
      $229 = $25;
      $230 = (($228) + ($229<<3)|0);
      $231 = +HEAPF64[$230>>3];
      $95 = $231;
      $26 = $89;
      $27 = 0;
      $232 = $26;
      $233 = HEAP32[$232>>2]|0;
      $234 = $27;
      $235 = (($233) + ($234<<3)|0);
      $236 = +HEAPF64[$235>>3];
      $96 = $236;
     } else {
      $237 = $97;
      $238 = ($237|0)==(-1);
      if ($238) {
       $28 = $89;
       $29 = 1;
       $239 = $28;
       $240 = HEAP32[$239>>2]|0;
       $241 = $29;
       $242 = (($240) + ($241<<3)|0);
       $243 = +HEAPF64[$242>>3];
       $94 = $243;
       $30 = $89;
       $31 = 0;
       $244 = $30;
       $245 = HEAP32[$244>>2]|0;
       $246 = $31;
       $247 = (($245) + ($246<<3)|0);
       $248 = +HEAPF64[$247>>3];
       $95 = $248;
       $32 = $89;
       $33 = 1;
       $249 = $32;
       $250 = HEAP32[$249>>2]|0;
       $251 = $33;
       $252 = (($250) + ($251<<3)|0);
       $253 = +HEAPF64[$252>>3];
       $96 = $253;
       break;
      } else {
       $254 = $97;
       $34 = $89;
       $35 = $254;
       $255 = $34;
       $256 = HEAP32[$255>>2]|0;
       $257 = $35;
       $258 = (($256) + ($257<<3)|0);
       $259 = +HEAPF64[$258>>3];
       $94 = $259;
       $260 = $97;
       $261 = (($260) + 1)|0;
       $36 = $89;
       $37 = $261;
       $262 = $36;
       $263 = HEAP32[$262>>2]|0;
       $264 = $37;
       $265 = (($263) + ($264<<3)|0);
       $266 = +HEAPF64[$265>>3];
       $95 = $266;
       $267 = $97;
       $268 = (($267) + 2)|0;
       $38 = $89;
       $39 = $268;
       $269 = $38;
       $270 = HEAP32[$269>>2]|0;
       $271 = $39;
       $272 = (($270) + ($271<<3)|0);
       $273 = +HEAPF64[$272>>3];
       $96 = $273;
       break;
      }
     }
    } while(0);
    $274 = $94;
    $275 = 60.0 / $274;
    $276 = ((($98)) + 48|0);
    $277 = HEAP32[$276>>2]|0;
    $278 = (+($277|0));
    $279 = $275 < $278;
    do {
     if (!($279)) {
      $280 = $94;
      $281 = 60.0 / $280;
      $282 = ((($98)) + 48|0);
      $283 = ((($282)) + 4|0);
      $284 = HEAP32[$283>>2]|0;
      $285 = (+($284|0));
      $286 = $281 > $285;
      if (!($286)) {
       $287 = $95;
       $288 = 60.0 / $287;
       $289 = ((($98)) + 48|0);
       $290 = HEAP32[$289>>2]|0;
       $291 = (+($290|0));
       $292 = $288 < $291;
       if (!($292)) {
        $293 = $95;
        $294 = 60.0 / $293;
        $295 = ((($98)) + 48|0);
        $296 = ((($295)) + 4|0);
        $297 = HEAP32[$296>>2]|0;
        $298 = (+($297|0));
        $299 = $294 > $298;
        if (!($299)) {
         $300 = $96;
         $301 = 60.0 / $300;
         $302 = ((($98)) + 48|0);
         $303 = HEAP32[$302>>2]|0;
         $304 = (+($303|0));
         $305 = $301 < $304;
         if (!($305)) {
          $306 = $96;
          $307 = 60.0 / $306;
          $308 = ((($98)) + 48|0);
          $309 = ((($308)) + 4|0);
          $310 = HEAP32[$309>>2]|0;
          $311 = (+($310|0));
          $312 = $307 > $311;
          if (!($312)) {
           $313 = $95;
           $314 = 1.1499999999999999 * $313;
           $315 = $94;
           $316 = $314 < $315;
           if ($316) {
            $317 = $95;
            $318 = 1.1499999999999999 * $317;
            $319 = $96;
            $320 = $318 < $319;
            if ($320) {
             $321 = $86;
             $322 = $97;
             $323 = $322<<1;
             $324 = (($323) + 4)|0;
             $325 = (($321) + ($324<<2)|0);
             $326 = HEAP32[$325>>2]|0;
             $327 = ((($326)) + 4|0);
             HEAP32[$327>>2] = 46;
             break;
            }
           }
           $328 = $94;
           $329 = $95;
           $330 = $328 - $329;
           $331 = (+Math_abs((+$330)));
           $332 = $331 < 0.29999999999999999;
           $333 = $94;
           $334 = $333 < 0.80000000000000004;
           $or$cond = $332 & $334;
           $335 = $95;
           $336 = $335 < 0.80000000000000004;
           $or$cond3 = $or$cond & $336;
           if ($or$cond3) {
            $337 = $96;
            $338 = $94;
            $339 = $95;
            $340 = $338 + $339;
            $341 = 2.3999999999999999 * $340;
            $342 = $337 > $341;
            if ($342) {
             $343 = $86;
             $344 = $97;
             $345 = $344<<1;
             $346 = (($345) + 4)|0;
             $347 = (($343) + ($346<<2)|0);
             $348 = HEAP32[$347>>2]|0;
             $349 = ((($348)) + 4|0);
             HEAP32[$349>>2] = 46;
             break;
            }
           }
           $350 = $94;
           $351 = $95;
           $352 = $350 - $351;
           $353 = (+Math_abs((+$352)));
           $354 = $353 < 0.29999999999999999;
           $355 = $94;
           $356 = $355 < 0.80000000000000004;
           $or$cond5 = $354 & $356;
           $357 = $95;
           $358 = $357 < 0.80000000000000004;
           $or$cond7 = $or$cond5 & $358;
           if ($or$cond7) {
            $359 = $96;
            $360 = $95;
            $361 = $96;
            $362 = $360 + $361;
            $363 = 2.3999999999999999 * $362;
            $364 = $359 > $363;
            if ($364) {
             $365 = $86;
             $366 = $97;
             $367 = $366<<1;
             $368 = (($367) + 4)|0;
             $369 = (($365) + ($368<<2)|0);
             $370 = HEAP32[$369>>2]|0;
             $371 = ((($370)) + 4|0);
             HEAP32[$371>>2] = 46;
            }
           }
          }
         }
        }
       }
      }
     }
    } while(0);
    $372 = $97;
    $373 = (($372) + 1)|0;
    $97 = $373;
   }
   __ZNSt3__26vectorIdNS_9allocatorIdEEED2Ev($89);
   STACKTOP = sp;return;
  }
 } while(0);
 $166 = ___cxa_find_matching_catch_2()|0;
 $167 = tempRet0;
 $92 = $166;
 $93 = $167;
 __THREW__ = 0;
 invoke_vi(46,($89|0));
 $168 = __THREW__; __THREW__ = 0;
 $169 = $168&1;
 if ($169) {
  $376 = ___cxa_find_matching_catch_3(0|0)|0;
  $377 = tempRet0;
  ___clang_call_terminate($376);
  // unreachable;
 } else {
  $374 = $92;
  $375 = $93;
  ___resumeException($374|0);
  // unreachable;
 }
}
function __ZN13EcgAnnotation6GetPTUEPKdidPPii($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 $4 = $4|0;
 $5 = $5|0;
 var $$arith = 0, $$overflow = 0, $$sink = 0, $$sink10 = 0, $$sink4 = 0, $$sink6 = 0, $$sink7 = 0, $$sink9 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0;
 var $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0;
 var $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0;
 var $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0;
 var $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0, $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0;
 var $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0, $1088 = 0, $1089 = 0, $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $1098 = 0, $1099 = 0, $11 = 0;
 var $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0, $1105 = 0, $1106 = 0, $1107 = 0, $1108 = 0, $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0, $1115 = 0, $1116 = 0, $1117 = 0;
 var $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $1121 = 0, $1122 = 0, $1123 = 0, $1124 = 0, $1125 = 0, $1126 = 0, $1127 = 0, $1128 = 0, $1129 = 0, $113 = 0, $1130 = 0, $1131 = 0, $1132 = 0, $1133 = 0, $1134 = 0, $1135 = 0;
 var $1136 = 0, $1137 = 0, $1138 = 0, $1139 = 0, $114 = 0, $1140 = 0, $1141 = 0, $1142 = 0, $1143 = 0, $1144 = 0, $1145 = 0, $1146 = 0, $1147 = 0, $1148 = 0, $1149 = 0, $115 = 0, $1150 = 0, $1151 = 0, $1152 = 0, $1153 = 0;
 var $1154 = 0, $1155 = 0, $1156 = 0, $1157 = 0, $1158 = 0, $1159 = 0, $116 = 0, $1160 = 0, $1161 = 0, $1162 = 0, $1163 = 0, $1164 = 0, $1165 = 0, $1166 = 0, $1167 = 0, $1168 = 0, $1169 = 0, $117 = 0, $1170 = 0, $1171 = 0;
 var $1172 = 0, $1173 = 0, $1174 = 0, $1175 = 0, $1176 = 0, $1177 = 0, $1178 = 0, $1179 = 0, $118 = 0, $1180 = 0, $1181 = 0, $1182 = 0, $1183 = 0, $1184 = 0, $1185 = 0, $1186 = 0, $1187 = 0, $1188 = 0, $1189 = 0, $119 = 0;
 var $1190 = 0, $1191 = 0, $1192 = 0, $1193 = 0, $1194 = 0, $1195 = 0, $1196 = 0.0, $1197 = 0.0, $1198 = 0.0, $1199 = 0.0, $12 = 0, $120 = 0, $1200 = 0.0, $1201 = 0, $1202 = 0, $1203 = 0.0, $1204 = 0, $1205 = 0.0, $1206 = 0.0, $1207 = 0;
 var $1208 = 0, $1209 = 0, $121 = 0, $1210 = 0, $1211 = 0.0, $1212 = 0, $1213 = 0, $1214 = 0, $1215 = 0, $1216 = 0, $1217 = 0, $1218 = 0, $1219 = 0, $122 = 0, $1220 = 0, $1221 = 0, $1222 = 0, $1223 = 0, $1224 = 0, $1225 = 0;
 var $1226 = 0, $1227 = 0, $1228 = 0, $1229 = 0, $123 = 0, $1230 = 0, $1231 = 0, $1232 = 0, $1233 = 0, $1234 = 0, $1235 = 0, $1236 = 0, $1237 = 0, $1238 = 0, $1239 = 0, $124 = 0, $1240 = 0, $1241 = 0, $1242 = 0, $1243 = 0;
 var $1244 = 0, $1245 = 0, $1246 = 0, $1247 = 0, $1248 = 0, $1249 = 0, $125 = 0, $1250 = 0, $1251 = 0, $1252 = 0, $1253 = 0, $1254 = 0, $1255 = 0, $1256 = 0, $1257 = 0, $1258 = 0, $1259 = 0, $126 = 0, $1260 = 0, $1261 = 0;
 var $1262 = 0, $1263 = 0, $1264 = 0, $1265 = 0, $1266 = 0, $1267 = 0, $1268 = 0, $1269 = 0, $127 = 0, $1270 = 0, $1271 = 0, $1272 = 0, $1273 = 0, $1274 = 0, $1275 = 0, $1276 = 0, $1277 = 0, $1278 = 0, $1279 = 0, $128 = 0;
 var $1280 = 0, $1281 = 0, $1282 = 0, $1283 = 0, $1284 = 0, $1285 = 0, $1286 = 0, $1287 = 0, $1288 = 0, $1289 = 0, $129 = 0, $1290 = 0, $1291 = 0, $1292 = 0, $1293 = 0, $1294 = 0, $1295 = 0, $1296 = 0, $1297 = 0, $1298 = 0;
 var $1299 = 0, $13 = 0, $130 = 0, $1300 = 0, $1301 = 0, $1302 = 0, $1303 = 0, $1304 = 0, $1305 = 0, $1306 = 0, $1307 = 0, $1308 = 0, $1309 = 0, $131 = 0, $1310 = 0, $1311 = 0, $1312 = 0, $1313 = 0, $1314 = 0, $1315 = 0;
 var $1316 = 0, $1317 = 0, $1318 = 0, $1319 = 0, $132 = 0, $1320 = 0, $1321 = 0, $1322 = 0, $1323 = 0, $1324 = 0, $1325 = 0, $1326 = 0, $1327 = 0, $1328 = 0, $1329 = 0, $133 = 0, $1330 = 0, $1331 = 0, $1332 = 0, $1333 = 0;
 var $1334 = 0, $1335 = 0, $1336 = 0, $1337 = 0, $1338 = 0, $1339 = 0, $134 = 0, $1340 = 0, $1341 = 0, $1342 = 0, $1343 = 0, $1344 = 0, $1345 = 0, $1346 = 0, $1347 = 0, $1348 = 0, $1349 = 0, $135 = 0, $1350 = 0, $1351 = 0;
 var $1352 = 0, $1353 = 0, $1354 = 0, $1355 = 0, $1356 = 0, $1357 = 0, $1358 = 0, $1359 = 0, $136 = 0, $1360 = 0, $1361 = 0, $1362 = 0, $1363 = 0, $1364 = 0, $1365 = 0, $1366 = 0, $1367 = 0, $1368 = 0, $1369 = 0.0, $137 = 0;
 var $1370 = 0, $1371 = 0, $1372 = 0.0, $1373 = 0.0, $1374 = 0, $1375 = 0, $1376 = 0, $1377 = 0, $1378 = 0, $1379 = 0, $138 = 0, $1380 = 0, $1381 = 0, $1382 = 0, $1383 = 0, $1384 = 0, $1385 = 0, $1386 = 0, $1387 = 0, $1388 = 0;
 var $1389 = 0.0, $139 = 0, $1390 = 0.0, $1391 = 0, $1392 = 0, $1393 = 0, $1394 = 0.0, $1395 = 0, $1396 = 0, $1397 = 0, $1398 = 0, $1399 = 0.0, $14 = 0, $140 = 0, $1400 = 0, $1401 = 0, $1402 = 0.0, $1403 = 0.0, $1404 = 0, $1405 = 0;
 var $1406 = 0, $1407 = 0, $1408 = 0, $1409 = 0, $141 = 0, $1410 = 0, $1411 = 0, $1412 = 0, $1413 = 0, $1414 = 0, $1415 = 0, $1416 = 0, $1417 = 0, $1418 = 0, $1419 = 0.0, $142 = 0, $1420 = 0.0, $1421 = 0, $1422 = 0.0, $1423 = 0.0;
 var $1424 = 0, $1425 = 0, $1426 = 0, $1427 = 0, $1428 = 0, $1429 = 0, $143 = 0, $1430 = 0.0, $1431 = 0, $1432 = 0, $1433 = 0, $1434 = 0, $1435 = 0, $1436 = 0, $1437 = 0, $1438 = 0, $1439 = 0, $144 = 0, $1440 = 0, $1441 = 0;
 var $1442 = 0.0, $1443 = 0, $1444 = 0, $1445 = 0, $1446 = 0, $1447 = 0, $1448 = 0, $1449 = 0, $145 = 0, $1450 = 0, $1451 = 0, $1452 = 0, $1453 = 0, $1454 = 0, $1455 = 0, $1456 = 0.0, $1457 = 0.0, $1458 = 0, $1459 = 0, $146 = 0;
 var $1460 = 0, $1461 = 0, $1462 = 0, $1463 = 0, $1464 = 0, $1465 = 0, $1466 = 0, $1467 = 0.0, $1468 = 0.0, $1469 = 0, $147 = 0, $1470 = 0, $1471 = 0, $1472 = 0, $1473 = 0, $1474 = 0, $1475 = 0, $1476 = 0, $1477 = 0, $1478 = 0;
 var $1479 = 0, $148 = 0, $1480 = 0, $1481 = 0, $1482 = 0, $1483 = 0, $1484 = 0, $1485 = 0, $1486 = 0, $1487 = 0, $1488 = 0, $1489 = 0, $149 = 0, $1490 = 0, $1491 = 0, $1492 = 0, $1493 = 0, $1494 = 0, $1495 = 0, $1496 = 0;
 var $1497 = 0.0, $1498 = 0, $1499 = 0, $15 = 0, $150 = 0, $1500 = 0, $1501 = 0, $1502 = 0, $1503 = 0, $1504 = 0, $1505 = 0, $1506 = 0.0, $1507 = 0, $1508 = 0, $1509 = 0, $151 = 0, $1510 = 0, $1511 = 0, $1512 = 0, $1513 = 0;
 var $1514 = 0, $1515 = 0.0, $1516 = 0, $1517 = 0, $1518 = 0, $1519 = 0, $152 = 0, $1520 = 0, $1521 = 0, $1522 = 0, $1523 = 0, $1524 = 0.0, $1525 = 0, $1526 = 0, $1527 = 0, $1528 = 0, $1529 = 0, $153 = 0, $1530 = 0, $1531 = 0.0;
 var $1532 = 0.0, $1533 = 0.0, $1534 = 0, $1535 = 0, $1536 = 0, $1537 = 0, $1538 = 0, $1539 = 0, $154 = 0, $1540 = 0, $1541 = 0, $1542 = 0, $1543 = 0, $1544 = 0.0, $1545 = 0, $1546 = 0, $1547 = 0.0, $1548 = 0.0, $1549 = 0.0, $155 = 0;
 var $1550 = 0, $1551 = 0, $1552 = 0, $1553 = 0, $1554 = 0, $1555 = 0, $1556 = 0, $1557 = 0, $1558 = 0, $1559 = 0, $156 = 0, $1560 = 0.0, $1561 = 0, $1562 = 0, $1563 = 0.0, $1564 = 0.0, $1565 = 0.0, $1566 = 0, $1567 = 0, $1568 = 0;
 var $1569 = 0, $157 = 0, $1570 = 0, $1571 = 0, $1572 = 0, $1573 = 0, $1574 = 0, $1575 = 0, $1576 = 0.0, $1577 = 0, $1578 = 0, $1579 = 0, $158 = 0, $1580 = 0, $1581 = 0, $1582 = 0, $1583 = 0, $1584 = 0, $1585 = 0, $1586 = 0;
 var $1587 = 0, $1588 = 0, $1589 = 0, $159 = 0, $1590 = 0, $1591 = 0, $1592 = 0, $1593 = 0, $1594 = 0, $1595 = 0.0, $1596 = 0, $1597 = 0, $1598 = 0, $1599 = 0, $16 = 0, $160 = 0, $1600 = 0, $1601 = 0, $1602 = 0, $1603 = 0;
 var $1604 = 0, $1605 = 0, $1606 = 0, $1607 = 0, $1608 = 0, $1609 = 0, $161 = 0, $1610 = 0, $1611 = 0, $1612 = 0, $1613 = 0, $1614 = 0, $1615 = 0.0, $1616 = 0, $1617 = 0, $1618 = 0, $1619 = 0.0, $162 = 0, $1620 = 0.0, $1621 = 0;
 var $1622 = 0, $1623 = 0, $1624 = 0.0, $1625 = 0, $1626 = 0, $1627 = 0, $1628 = 0.0, $1629 = 0.0, $163 = 0, $1630 = 0.0, $1631 = 0, $1632 = 0, $1633 = 0, $1634 = 0, $1635 = 0, $1636 = 0, $1637 = 0, $1638 = 0, $1639 = 0, $164 = 0;
 var $1640 = 0, $1641 = 0, $1642 = 0, $1643 = 0, $1644 = 0, $1645 = 0, $1646 = 0, $1647 = 0, $1648 = 0, $1649 = 0, $165 = 0, $1650 = 0, $1651 = 0, $1652 = 0, $1653 = 0, $1654 = 0, $1655 = 0, $1656 = 0, $1657 = 0, $1658 = 0;
 var $1659 = 0, $166 = 0, $1660 = 0, $1661 = 0, $1662 = 0, $1663 = 0, $1664 = 0, $1665 = 0, $1666 = 0, $1667 = 0, $1668 = 0, $1669 = 0, $167 = 0, $1670 = 0, $1671 = 0, $1672 = 0, $1673 = 0, $1674 = 0, $1675 = 0, $1676 = 0;
 var $1677 = 0, $1678 = 0, $1679 = 0, $168 = 0, $1680 = 0, $1681 = 0, $1682 = 0, $1683 = 0, $1684 = 0, $1685 = 0, $1686 = 0, $1687 = 0, $1688 = 0, $1689 = 0, $169 = 0, $1690 = 0, $1691 = 0, $1692 = 0, $1693 = 0, $1694 = 0;
 var $1695 = 0, $1696 = 0, $1697 = 0, $1698 = 0, $1699 = 0, $17 = 0, $170 = 0, $1700 = 0, $1701 = 0, $1702 = 0, $1703 = 0, $1704 = 0, $1705 = 0, $1706 = 0, $1707 = 0, $1708 = 0, $1709 = 0, $171 = 0, $1710 = 0, $1711 = 0;
 var $1712 = 0, $1713 = 0, $1714 = 0, $1715 = 0, $1716 = 0, $1717 = 0, $1718 = 0, $1719 = 0, $172 = 0, $1720 = 0, $1721 = 0, $1722 = 0, $1723 = 0, $1724 = 0, $1725 = 0, $1726 = 0, $1727 = 0, $1728 = 0, $1729 = 0, $173 = 0;
 var $1730 = 0, $1731 = 0, $1732 = 0, $1733 = 0, $1734 = 0, $1735 = 0, $1736 = 0, $1737 = 0, $1738 = 0, $1739 = 0, $174 = 0, $1740 = 0, $1741 = 0, $1742 = 0, $1743 = 0, $1744 = 0, $1745 = 0, $1746 = 0, $1747 = 0, $1748 = 0;
 var $1749 = 0, $175 = 0, $1750 = 0, $1751 = 0, $1752 = 0, $1753 = 0, $1754 = 0, $1755 = 0, $1756 = 0, $1757 = 0, $1758 = 0, $1759 = 0, $176 = 0, $1760 = 0, $1761 = 0, $1762 = 0, $1763 = 0, $1764 = 0, $1765 = 0, $1766 = 0;
 var $1767 = 0, $1768 = 0, $1769 = 0, $177 = 0, $1770 = 0, $1771 = 0, $1772 = 0, $1773 = 0, $1774 = 0, $1775 = 0, $1776 = 0, $1777 = 0, $1778 = 0, $1779 = 0, $178 = 0, $1780 = 0, $1781 = 0, $1782 = 0, $1783 = 0, $1784 = 0;
 var $1785 = 0, $1786 = 0, $1787 = 0, $1788 = 0, $1789 = 0, $179 = 0, $1790 = 0, $1791 = 0, $1792 = 0, $1793 = 0, $1794 = 0, $1795 = 0, $1796 = 0, $1797 = 0, $1798 = 0, $1799 = 0, $18 = 0, $180 = 0, $1800 = 0, $1801 = 0;
 var $1802 = 0, $1803 = 0, $1804 = 0, $1805 = 0, $1806 = 0, $1807 = 0, $1808 = 0, $1809 = 0, $181 = 0, $1810 = 0, $1811 = 0, $1812 = 0, $1813 = 0, $1814 = 0, $1815 = 0, $1816 = 0, $1817 = 0, $1818 = 0, $1819 = 0, $182 = 0;
 var $1820 = 0, $1821 = 0, $1822 = 0, $1823 = 0, $1824 = 0, $1825 = 0, $1826 = 0, $1827 = 0, $1828 = 0, $1829 = 0, $183 = 0, $1830 = 0, $1831 = 0, $1832 = 0, $1833 = 0, $1834 = 0, $1835 = 0, $1836 = 0, $1837 = 0, $1838 = 0;
 var $1839 = 0, $184 = 0, $1840 = 0, $1841 = 0, $1842 = 0, $1843 = 0, $1844 = 0, $1845 = 0, $1846 = 0, $1847 = 0, $1848 = 0, $1849 = 0, $185 = 0, $1850 = 0, $1851 = 0, $1852 = 0, $1853 = 0, $1854 = 0, $1855 = 0, $1856 = 0;
 var $1857 = 0, $1858 = 0, $1859 = 0, $186 = 0, $1860 = 0, $1861 = 0, $1862 = 0, $1863 = 0, $1864 = 0, $1865 = 0, $1866 = 0, $1867 = 0, $1868 = 0, $1869 = 0, $187 = 0, $1870 = 0, $1871 = 0, $1872 = 0, $1873 = 0, $1874 = 0;
 var $1875 = 0, $1876 = 0, $1877 = 0, $1878 = 0, $1879 = 0, $188 = 0, $1880 = 0, $1881 = 0, $1882 = 0, $1883 = 0, $1884 = 0, $1885 = 0, $1886 = 0, $1887 = 0, $1888 = 0, $1889 = 0, $189 = 0, $1890 = 0, $1891 = 0, $1892 = 0;
 var $1893 = 0, $1894 = 0, $1895 = 0, $1896 = 0, $1897 = 0, $1898 = 0, $1899 = 0, $19 = 0, $190 = 0, $1900 = 0, $1901 = 0, $1902 = 0, $1903 = 0, $1904 = 0, $1905 = 0, $1906 = 0, $1907 = 0, $1908 = 0, $1909 = 0, $191 = 0;
 var $1910 = 0, $1911 = 0, $1912 = 0, $1913 = 0, $1914 = 0, $1915 = 0, $1916 = 0, $1917 = 0, $1918 = 0, $1919 = 0.0, $192 = 0, $1920 = 0, $1921 = 0, $1922 = 0.0, $1923 = 0.0, $1924 = 0, $1925 = 0.0, $1926 = 0, $1927 = 0.0, $1928 = 0;
 var $1929 = 0, $193 = 0, $1930 = 0.0, $1931 = 0.0, $1932 = 0, $1933 = 0, $1934 = 0, $1935 = 0, $1936 = 0, $1937 = 0, $1938 = 0, $1939 = 0, $194 = 0, $1940 = 0, $1941 = 0, $1942 = 0, $1943 = 0, $1944 = 0, $1945 = 0.0, $1946 = 0.0;
 var $1947 = 0, $1948 = 0, $1949 = 0, $195 = 0, $1950 = 0, $1951 = 0, $1952 = 0, $1953 = 0, $1954 = 0, $1955 = 0, $1956 = 0, $1957 = 0, $1958 = 0, $1959 = 0, $196 = 0, $1960 = 0.0, $1961 = 0.0, $1962 = 0, $1963 = 0, $1964 = 0;
 var $1965 = 0, $1966 = 0, $1967 = 0, $1968 = 0, $1969 = 0, $197 = 0, $1970 = 0, $1971 = 0, $1972 = 0, $1973 = 0, $1974 = 0, $1975 = 0, $1976 = 0, $1977 = 0, $1978 = 0, $1979 = 0, $198 = 0, $1980 = 0, $1981 = 0, $1982 = 0;
 var $1983 = 0, $1984 = 0, $1985 = 0.0, $1986 = 0.0, $1987 = 0.0, $1988 = 0, $1989 = 0, $199 = 0, $1990 = 0, $1991 = 0, $1992 = 0, $1993 = 0, $1994 = 0, $1995 = 0, $1996 = 0, $1997 = 0, $1998 = 0, $1999 = 0, $20 = 0, $200 = 0;
 var $2000 = 0, $2001 = 0, $2002 = 0, $2003 = 0, $2004 = 0, $2005 = 0, $2006 = 0, $2007 = 0, $2008 = 0, $2009 = 0, $201 = 0, $2010 = 0, $2011 = 0, $2012 = 0, $2013 = 0, $2014 = 0, $2015 = 0, $2016 = 0, $2017 = 0, $2018 = 0;
 var $2019 = 0, $202 = 0, $2020 = 0, $2021 = 0, $2022 = 0, $2023 = 0, $2024 = 0, $2025 = 0, $2026 = 0, $2027 = 0, $2028 = 0, $2029 = 0, $203 = 0, $2030 = 0, $2031 = 0, $2032 = 0, $2033 = 0, $2034 = 0, $2035 = 0, $2036 = 0;
 var $2037 = 0, $2038 = 0, $2039 = 0, $204 = 0, $2040 = 0, $2041 = 0, $2042 = 0, $2043 = 0, $2044 = 0, $2045 = 0, $2046 = 0, $2047 = 0, $2048 = 0, $2049 = 0, $205 = 0, $2050 = 0, $2051 = 0, $2052 = 0, $2053 = 0, $2054 = 0;
 var $2055 = 0, $2056 = 0, $2057 = 0, $2058 = 0, $2059 = 0, $206 = 0, $2060 = 0, $2061 = 0, $2062 = 0, $2063 = 0, $2064 = 0, $2065 = 0, $2066 = 0, $2067 = 0, $2068 = 0.0, $2069 = 0, $207 = 0, $2070 = 0, $2071 = 0, $2072 = 0;
 var $2073 = 0, $2074 = 0, $2075 = 0, $2076 = 0, $2077 = 0, $2078 = 0.0, $2079 = 0, $208 = 0, $2080 = 0, $2081 = 0, $2082 = 0, $2083 = 0, $2084 = 0, $2085 = 0, $2086 = 0, $2087 = 0, $2088 = 0, $2089 = 0, $209 = 0, $2090 = 0;
 var $2091 = 0, $2092 = 0.0, $2093 = 0.0, $2094 = 0, $2095 = 0, $2096 = 0, $2097 = 0, $2098 = 0, $2099 = 0, $21 = 0, $210 = 0, $2100 = 0, $2101 = 0, $2102 = 0, $2103 = 0.0, $2104 = 0.0, $2105 = 0, $2106 = 0, $2107 = 0, $2108 = 0;
 var $2109 = 0, $211 = 0, $2110 = 0, $2111 = 0, $2112 = 0, $2113 = 0, $2114 = 0, $2115 = 0, $2116 = 0, $2117 = 0, $2118 = 0, $2119 = 0, $212 = 0, $2120 = 0, $2121 = 0, $2122 = 0, $2123 = 0, $2124 = 0, $2125 = 0, $2126 = 0;
 var $2127 = 0, $2128 = 0, $2129 = 0, $213 = 0, $2130 = 0, $2131 = 0, $2132 = 0, $2133 = 0.0, $2134 = 0, $2135 = 0, $2136 = 0, $2137 = 0, $2138 = 0, $2139 = 0, $214 = 0, $2140 = 0, $2141 = 0, $2142 = 0.0, $2143 = 0, $2144 = 0;
 var $2145 = 0, $2146 = 0, $2147 = 0, $2148 = 0, $2149 = 0, $215 = 0, $2150 = 0, $2151 = 0.0, $2152 = 0, $2153 = 0, $2154 = 0, $2155 = 0, $2156 = 0, $2157 = 0, $2158 = 0, $2159 = 0, $216 = 0, $2160 = 0.0, $2161 = 0, $2162 = 0;
 var $2163 = 0, $2164 = 0, $2165 = 0, $2166 = 0, $2167 = 0.0, $2168 = 0.0, $2169 = 0.0, $217 = 0, $2170 = 0, $2171 = 0, $2172 = 0, $2173 = 0, $2174 = 0.0, $2175 = 0.0, $2176 = 0.0, $2177 = 0, $2178 = 0, $2179 = 0, $218 = 0, $2180 = 0;
 var $2181 = 0, $2182 = 0, $2183 = 0, $2184 = 0, $2185 = 0, $2186 = 0, $2187 = 0.0, $2188 = 0, $2189 = 0, $219 = 0, $2190 = 0.0, $2191 = 0.0, $2192 = 0.0, $2193 = 0, $2194 = 0, $2195 = 0, $2196 = 0, $2197 = 0, $2198 = 0, $2199 = 0;
 var $22 = 0, $220 = 0, $2200 = 0, $2201 = 0, $2202 = 0, $2203 = 0.0, $2204 = 0, $2205 = 0, $2206 = 0.0, $2207 = 0.0, $2208 = 0.0, $2209 = 0, $221 = 0, $2210 = 0, $2211 = 0, $2212 = 0, $2213 = 0, $2214 = 0, $2215 = 0, $2216 = 0;
 var $2217 = 0, $2218 = 0, $2219 = 0.0, $222 = 0, $2220 = 0, $2221 = 0, $2222 = 0, $2223 = 0, $2224 = 0, $2225 = 0, $2226 = 0, $2227 = 0, $2228 = 0, $2229 = 0, $223 = 0, $2230 = 0, $2231 = 0, $2232 = 0, $2233 = 0, $2234 = 0;
 var $2235 = 0, $2236 = 0, $2237 = 0, $2238 = 0.0, $2239 = 0, $224 = 0, $2240 = 0, $2241 = 0, $2242 = 0, $2243 = 0, $2244 = 0, $2245 = 0, $2246 = 0, $2247 = 0, $2248 = 0, $2249 = 0, $225 = 0, $2250 = 0, $2251 = 0, $2252 = 0;
 var $2253 = 0, $2254 = 0, $2255 = 0, $2256 = 0, $2257 = 0, $2258 = 0.0, $2259 = 0, $226 = 0, $2260 = 0, $2261 = 0, $2262 = 0.0, $2263 = 0.0, $2264 = 0, $2265 = 0, $2266 = 0, $2267 = 0.0, $2268 = 0, $2269 = 0, $227 = 0, $2270 = 0;
 var $2271 = 0.0, $2272 = 0.0, $2273 = 0.0, $2274 = 0, $2275 = 0, $2276 = 0, $2277 = 0, $2278 = 0, $2279 = 0, $228 = 0, $2280 = 0, $2281 = 0, $2282 = 0, $2283 = 0, $2284 = 0, $2285 = 0, $2286 = 0, $2287 = 0, $2288 = 0, $2289 = 0;
 var $229 = 0, $2290 = 0, $2291 = 0, $2292 = 0, $2293 = 0, $2294 = 0, $2295 = 0, $2296 = 0, $2297 = 0, $2298 = 0, $2299 = 0, $23 = 0, $230 = 0, $2300 = 0, $2301 = 0, $2302 = 0, $2303 = 0, $2304 = 0, $2305 = 0, $2306 = 0;
 var $2307 = 0, $2308 = 0, $2309 = 0, $231 = 0, $2310 = 0, $2311 = 0, $2312 = 0, $2313 = 0, $2314 = 0, $2315 = 0, $2316 = 0, $2317 = 0, $2318 = 0, $2319 = 0, $232 = 0, $2320 = 0, $2321 = 0, $2322 = 0, $2323 = 0, $2324 = 0;
 var $2325 = 0, $2326 = 0, $2327 = 0, $2328 = 0, $2329 = 0, $233 = 0, $2330 = 0, $2331 = 0, $2332 = 0, $2333 = 0, $2334 = 0, $2335 = 0, $2336 = 0, $2337 = 0, $2338 = 0, $2339 = 0, $234 = 0, $2340 = 0, $2341 = 0, $2342 = 0;
 var $2343 = 0, $2344 = 0, $2345 = 0, $2346 = 0, $2347 = 0, $2348 = 0, $2349 = 0, $235 = 0, $2350 = 0, $2351 = 0, $2352 = 0, $2353 = 0, $2354 = 0, $2355 = 0, $2356 = 0, $2357 = 0, $2358 = 0, $2359 = 0, $236 = 0, $2360 = 0;
 var $2361 = 0, $2362 = 0, $2363 = 0, $2364 = 0, $2365 = 0, $2366 = 0, $2367 = 0, $2368 = 0, $2369 = 0, $237 = 0, $2370 = 0, $2371 = 0, $2372 = 0, $2373 = 0, $2374 = 0, $2375 = 0, $2376 = 0, $2377 = 0, $2378 = 0, $2379 = 0;
 var $238 = 0, $2380 = 0, $2381 = 0, $2382 = 0, $2383 = 0, $2384 = 0, $2385 = 0, $2386 = 0, $2387 = 0, $2388 = 0, $2389 = 0, $239 = 0, $2390 = 0, $2391 = 0, $2392 = 0, $2393 = 0, $2394 = 0, $2395 = 0, $2396 = 0, $2397 = 0;
 var $2398 = 0, $2399 = 0, $24 = 0, $240 = 0, $2400 = 0, $2401 = 0, $2402 = 0, $2403 = 0, $2404 = 0, $2405 = 0, $2406 = 0, $2407 = 0, $2408 = 0, $2409 = 0, $241 = 0, $2410 = 0, $2411 = 0, $2412 = 0, $2413 = 0, $2414 = 0;
 var $2415 = 0, $2416 = 0, $2417 = 0, $2418 = 0, $2419 = 0, $242 = 0, $2420 = 0, $2421 = 0, $2422 = 0, $2423 = 0, $2424 = 0, $2425 = 0, $2426 = 0, $2427 = 0, $2428 = 0, $2429 = 0, $243 = 0, $2430 = 0, $2431 = 0, $2432 = 0;
 var $2433 = 0, $2434 = 0, $2435 = 0, $2436 = 0, $2437 = 0, $2438 = 0, $2439 = 0, $244 = 0, $2440 = 0, $2441 = 0, $2442 = 0, $2443 = 0, $2444 = 0, $2445 = 0, $2446 = 0, $2447 = 0, $2448 = 0, $2449 = 0, $245 = 0, $2450 = 0;
 var $2451 = 0, $2452 = 0, $2453 = 0, $2454 = 0, $2455 = 0, $2456 = 0, $2457 = 0, $2458 = 0, $2459 = 0, $246 = 0, $2460 = 0, $2461 = 0, $2462 = 0, $2463 = 0, $2464 = 0, $2465 = 0, $2466 = 0, $2467 = 0, $2468 = 0, $2469 = 0;
 var $247 = 0, $2470 = 0, $2471 = 0, $2472 = 0, $2473 = 0, $2474 = 0, $2475 = 0, $2476 = 0, $2477 = 0, $2478 = 0, $2479 = 0, $248 = 0, $2480 = 0, $2481 = 0, $2482 = 0, $2483 = 0, $2484 = 0, $2485 = 0, $2486 = 0, $2487 = 0;
 var $2488 = 0, $2489 = 0, $249 = 0, $2490 = 0, $2491 = 0, $2492 = 0, $2493 = 0, $2494 = 0, $2495 = 0, $2496 = 0, $2497 = 0, $2498 = 0, $2499 = 0, $25 = 0, $250 = 0, $2500 = 0, $2501 = 0, $2502 = 0, $2503 = 0, $2504 = 0;
 var $2505 = 0, $2506 = 0, $2507 = 0, $2508 = 0, $2509 = 0, $251 = 0, $2510 = 0, $2511 = 0, $2512 = 0, $2513 = 0, $2514 = 0, $2515 = 0, $2516 = 0, $2517 = 0, $2518 = 0, $2519 = 0, $252 = 0, $2520 = 0, $2521 = 0, $2522 = 0;
 var $2523 = 0, $2524 = 0, $2525 = 0, $2526 = 0, $2527 = 0, $2528 = 0, $2529 = 0, $253 = 0, $2530 = 0, $2531 = 0, $2532 = 0, $2533 = 0, $2534 = 0, $2535 = 0, $2536 = 0, $2537 = 0, $2538 = 0, $2539 = 0, $254 = 0, $2540 = 0;
 var $2541 = 0, $2542 = 0, $2543 = 0, $2544 = 0, $2545 = 0, $2546 = 0, $2547 = 0, $2548 = 0, $2549 = 0, $255 = 0, $2550 = 0, $2551 = 0, $2552 = 0, $2553 = 0, $2554 = 0, $2555 = 0, $2556 = 0, $2557 = 0, $2558 = 0, $2559 = 0;
 var $256 = 0, $2560 = 0, $2561 = 0, $2562 = 0, $2563 = 0, $2564 = 0, $2565 = 0, $2566 = 0, $2567 = 0, $2568 = 0, $2569 = 0, $257 = 0, $2570 = 0, $2571 = 0, $2572 = 0, $2573 = 0, $2574 = 0, $2575 = 0, $2576 = 0, $2577 = 0;
 var $2578 = 0, $2579 = 0, $258 = 0, $2580 = 0, $2581 = 0, $2582 = 0, $2583 = 0, $2584 = 0, $2585 = 0, $2586 = 0, $2587 = 0, $2588 = 0, $2589 = 0, $259 = 0, $2590 = 0, $2591 = 0, $2592 = 0, $2593 = 0, $2594 = 0, $2595 = 0;
 var $2596 = 0, $2597 = 0, $2598 = 0, $2599 = 0, $26 = 0, $260 = 0, $2600 = 0, $2601 = 0, $2602 = 0, $2603 = 0, $2604 = 0, $2605 = 0, $2606 = 0, $2607 = 0, $2608 = 0, $2609 = 0, $261 = 0, $2610 = 0, $2611 = 0, $2612 = 0;
 var $2613 = 0, $2614 = 0, $2615 = 0, $2616 = 0, $2617 = 0, $2618 = 0, $2619 = 0, $262 = 0, $2620 = 0, $2621 = 0, $2622 = 0, $2623 = 0.0, $2624 = 0, $2625 = 0, $2626 = 0, $2627 = 0, $2628 = 0, $2629 = 0, $263 = 0, $2630 = 0;
 var $2631 = 0, $2632 = 0, $2633 = 0.0, $2634 = 0, $2635 = 0, $2636 = 0, $2637 = 0, $2638 = 0, $2639 = 0, $264 = 0, $2640 = 0, $2641 = 0, $2642 = 0, $2643 = 0, $2644 = 0, $2645 = 0, $2646 = 0, $2647 = 0, $2648 = 0, $2649 = 0;
 var $265 = 0, $2650 = 0, $2651 = 0, $2652 = 0, $2653 = 0, $2654 = 0, $2655 = 0, $2656 = 0, $2657 = 0, $2658 = 0, $2659 = 0, $266 = 0, $2660 = 0, $2661 = 0, $2662 = 0, $2663 = 0, $2664 = 0, $2665 = 0, $2666 = 0, $2667 = 0;
 var $2668 = 0, $2669 = 0, $267 = 0, $2670 = 0.0, $2671 = 0, $2672 = 0, $2673 = 0, $2674 = 0, $2675 = 0, $2676 = 0, $2677 = 0, $2678 = 0, $2679 = 0, $268 = 0, $2680 = 0, $2681 = 0, $2682 = 0, $2683 = 0, $2684 = 0, $2685 = 0;
 var $2686 = 0, $2687 = 0, $2688 = 0, $2689 = 0, $269 = 0, $2690 = 0, $2691 = 0, $2692 = 0, $2693 = 0, $2694 = 0, $2695 = 0, $2696 = 0, $2697 = 0.0, $2698 = 0, $2699 = 0, $27 = 0, $270 = 0, $2700 = 0, $2701 = 0.0, $2702 = 0.0;
 var $2703 = 0, $2704 = 0, $2705 = 0, $2706 = 0, $2707 = 0, $2708 = 0, $2709 = 0, $271 = 0, $2710 = 0, $2711 = 0, $2712 = 0, $2713 = 0, $2714 = 0, $2715 = 0, $2716 = 0, $2717 = 0, $2718 = 0, $2719 = 0, $272 = 0, $2720 = 0;
 var $2721 = 0, $2722 = 0, $2723 = 0, $2724 = 0, $2725 = 0, $2726 = 0, $2727 = 0, $2728 = 0, $2729 = 0, $273 = 0, $2730 = 0, $2731 = 0, $2732 = 0, $2733 = 0, $2734 = 0, $2735 = 0, $2736 = 0, $2737 = 0, $2738 = 0, $2739 = 0;
 var $274 = 0, $2740 = 0, $2741 = 0, $2742 = 0, $2743 = 0, $2744 = 0, $2745 = 0, $2746 = 0, $2747 = 0, $2748 = 0, $2749 = 0, $275 = 0, $2750 = 0, $2751 = 0, $2752 = 0, $2753 = 0, $2754 = 0, $2755 = 0, $2756 = 0, $2757 = 0;
 var $2758 = 0, $2759 = 0, $276 = 0, $2760 = 0, $2761 = 0, $2762 = 0, $2763 = 0, $2764 = 0, $2765 = 0, $2766 = 0, $2767 = 0, $2768 = 0, $2769 = 0, $277 = 0, $2770 = 0, $2771 = 0, $2772 = 0, $2773 = 0, $2774 = 0, $2775 = 0;
 var $2776 = 0, $2777 = 0, $2778 = 0, $2779 = 0, $278 = 0, $2780 = 0, $2781 = 0, $2782 = 0, $2783 = 0, $2784 = 0, $2785 = 0, $2786 = 0, $2787 = 0, $2788 = 0, $2789 = 0, $279 = 0, $2790 = 0, $2791 = 0, $2792 = 0, $2793 = 0;
 var $2794 = 0, $2795 = 0, $2796 = 0, $2797 = 0, $2798 = 0, $2799 = 0, $28 = 0, $280 = 0, $2800 = 0, $2801 = 0, $2802 = 0, $2803 = 0, $2804 = 0, $2805 = 0, $2806 = 0, $2807 = 0, $2808 = 0, $2809 = 0, $281 = 0, $2810 = 0;
 var $2811 = 0, $2812 = 0, $2813 = 0, $2814 = 0, $2815 = 0, $2816 = 0, $2817 = 0, $2818 = 0, $2819 = 0, $282 = 0, $2820 = 0, $2821 = 0, $2822 = 0, $2823 = 0, $2824 = 0, $2825 = 0, $2826 = 0, $2827 = 0, $2828 = 0, $2829 = 0;
 var $283 = 0, $2830 = 0, $2831 = 0, $2832 = 0, $2833 = 0, $2834 = 0, $2835 = 0, $2836 = 0, $2837 = 0, $2838 = 0, $2839 = 0, $284 = 0, $2840 = 0, $2841 = 0, $2842 = 0, $2843 = 0, $2844 = 0, $2845 = 0, $2846 = 0, $2847 = 0;
 var $2848 = 0, $2849 = 0, $285 = 0, $2850 = 0, $2851 = 0, $2852 = 0, $2853 = 0, $2854 = 0, $2855 = 0, $2856 = 0, $2857 = 0, $2858 = 0, $2859 = 0, $286 = 0, $2860 = 0, $2861 = 0, $2862 = 0, $2863 = 0, $2864 = 0, $2865 = 0;
 var $2866 = 0, $2867 = 0, $2868 = 0, $2869 = 0, $287 = 0, $2870 = 0, $2871 = 0, $2872 = 0, $2873 = 0, $2874 = 0, $2875 = 0, $2876 = 0, $2877 = 0, $2878 = 0, $2879 = 0, $288 = 0, $2880 = 0, $2881 = 0, $2882 = 0, $2883 = 0;
 var $2884 = 0, $2885 = 0, $2886 = 0, $2887 = 0, $2888 = 0, $2889 = 0, $289 = 0, $2890 = 0, $2891 = 0, $2892 = 0, $2893 = 0.0, $2894 = 0.0, $2895 = 0, $2896 = 0, $2897 = 0, $2898 = 0, $2899 = 0, $29 = 0, $290 = 0, $2900 = 0;
 var $2901 = 0, $2902 = 0, $2903 = 0, $2904 = 0, $2905 = 0, $2906 = 0, $2907 = 0, $2908 = 0, $2909 = 0, $291 = 0, $2910 = 0, $2911 = 0, $2912 = 0, $2913 = 0, $2914 = 0, $2915 = 0, $2916 = 0, $2917 = 0, $2918 = 0, $2919 = 0;
 var $292 = 0, $2920 = 0, $2921 = 0.0, $2922 = 0.0, $2923 = 0, $2924 = 0, $2925 = 0, $2926 = 0, $2927 = 0, $2928 = 0, $2929 = 0, $293 = 0, $2930 = 0, $2931 = 0, $2932 = 0, $2933 = 0, $2934 = 0, $2935 = 0, $2936 = 0, $2937 = 0;
 var $2938 = 0, $2939 = 0, $294 = 0, $2940 = 0, $2941 = 0, $2942 = 0, $2943 = 0, $2944 = 0, $2945 = 0, $2946 = 0, $2947 = 0, $2948 = 0, $2949 = 0, $295 = 0, $2950 = 0.0, $2951 = 0.0, $2952 = 0, $2953 = 0, $2954 = 0, $2955 = 0;
 var $2956 = 0, $2957 = 0, $2958 = 0, $2959 = 0, $296 = 0, $2960 = 0, $2961 = 0, $2962 = 0, $2963 = 0, $2964 = 0, $2965 = 0, $2966 = 0, $2967 = 0, $2968 = 0, $2969 = 0, $297 = 0, $2970 = 0, $2971 = 0, $2972 = 0, $2973 = 0;
 var $2974 = 0, $2975 = 0, $2976 = 0, $2977 = 0, $2978 = 0, $2979 = 0, $298 = 0, $2980 = 0, $2981 = 0, $2982 = 0, $2983 = 0, $2984 = 0, $2985 = 0, $2986 = 0, $2987 = 0, $2988 = 0, $2989 = 0, $299 = 0, $2990 = 0, $2991 = 0;
 var $2992 = 0, $2993 = 0, $2994 = 0, $2995 = 0, $2996 = 0, $2997 = 0, $2998 = 0, $2999 = 0, $30 = 0, $300 = 0, $3000 = 0, $3001 = 0, $3002 = 0, $3003 = 0, $3004 = 0, $3005 = 0, $3006 = 0, $3007 = 0, $3008 = 0, $3009 = 0;
 var $301 = 0, $3010 = 0, $3011 = 0, $3012 = 0, $3013 = 0, $3014 = 0, $3015 = 0, $3016 = 0, $3017 = 0, $3018 = 0, $3019 = 0, $302 = 0, $3020 = 0, $3021 = 0, $3022 = 0, $3023 = 0, $3024 = 0, $3025 = 0, $3026 = 0, $3027 = 0;
 var $3028 = 0, $3029 = 0, $303 = 0, $3030 = 0, $3031 = 0, $3032 = 0, $3033 = 0, $3034 = 0, $3035 = 0, $3036 = 0, $3037 = 0, $3038 = 0, $3039 = 0, $304 = 0, $3040 = 0, $3041 = 0, $3042 = 0, $3043 = 0, $3044 = 0, $3045 = 0;
 var $3046 = 0, $3047 = 0, $3048 = 0, $3049 = 0, $305 = 0, $3050 = 0, $3051 = 0, $3052 = 0, $3053 = 0, $3054 = 0, $3055 = 0, $3056 = 0, $3057 = 0, $3058 = 0, $3059 = 0, $306 = 0, $3060 = 0, $3061 = 0, $3062 = 0, $3063 = 0;
 var $3064 = 0, $3065 = 0, $3066 = 0, $3067 = 0, $3068 = 0, $3069 = 0, $307 = 0, $3070 = 0, $3071 = 0, $3072 = 0, $3073 = 0, $3074 = 0, $3075 = 0, $3076 = 0, $3077 = 0, $3078 = 0, $3079 = 0, $308 = 0, $3080 = 0, $3081 = 0;
 var $3082 = 0, $3083 = 0, $3084 = 0, $3085 = 0, $3086 = 0, $3087 = 0, $3088 = 0, $3089 = 0, $309 = 0, $3090 = 0, $3091 = 0, $3092 = 0, $3093 = 0, $3094 = 0, $3095 = 0, $3096 = 0, $3097 = 0, $3098 = 0, $3099 = 0, $31 = 0;
 var $310 = 0, $3100 = 0, $3101 = 0, $3102 = 0, $3103 = 0, $3104 = 0, $3105 = 0, $3106 = 0, $3107 = 0, $3108 = 0, $3109 = 0, $311 = 0, $3110 = 0, $3111 = 0, $3112 = 0, $3113 = 0, $3114 = 0, $3115 = 0, $3116 = 0, $3117 = 0;
 var $3118 = 0, $3119 = 0, $312 = 0, $3120 = 0, $3121 = 0, $3122 = 0, $3123 = 0, $3124 = 0, $3125 = 0, $3126 = 0, $3127 = 0, $3128 = 0, $3129 = 0, $313 = 0, $3130 = 0, $3131 = 0, $3132 = 0, $3133 = 0, $3134 = 0, $3135 = 0;
 var $3136 = 0, $3137 = 0, $3138 = 0, $3139 = 0, $314 = 0, $3140 = 0, $3141 = 0, $3142 = 0, $3143 = 0, $3144 = 0, $3145 = 0, $3146 = 0, $3147 = 0, $3148 = 0, $3149 = 0, $315 = 0, $3150 = 0, $3151 = 0, $3152 = 0, $3153 = 0;
 var $3154 = 0, $3155 = 0, $3156 = 0, $3157 = 0, $3158 = 0, $3159 = 0, $316 = 0, $3160 = 0, $3161 = 0, $3162 = 0, $3163 = 0, $3164 = 0, $3165 = 0, $3166 = 0, $3167 = 0, $3168 = 0, $3169 = 0, $317 = 0, $3170 = 0, $3171 = 0;
 var $3172 = 0, $3173 = 0, $3174 = 0, $3175 = 0, $3176 = 0, $3177 = 0, $3178 = 0, $3179 = 0, $318 = 0, $3180 = 0, $3181 = 0, $3182 = 0, $3183 = 0, $3184 = 0, $3185 = 0, $3186 = 0, $3187 = 0, $3188 = 0, $3189 = 0, $319 = 0;
 var $3190 = 0, $3191 = 0, $3192 = 0, $3193 = 0, $3194 = 0, $3195 = 0, $3196 = 0, $3197 = 0, $3198 = 0, $3199 = 0, $32 = 0, $320 = 0, $3200 = 0, $3201 = 0, $3202 = 0, $3203 = 0, $3204 = 0, $3205 = 0, $3206 = 0, $3207 = 0;
 var $3208 = 0, $3209 = 0, $321 = 0, $3210 = 0, $3211 = 0, $3212 = 0, $3213 = 0, $3214 = 0, $3215 = 0, $3216 = 0, $3217 = 0, $3218 = 0, $3219 = 0, $322 = 0, $3220 = 0, $3221 = 0, $3222 = 0, $3223 = 0, $3224 = 0, $3225 = 0;
 var $3226 = 0, $3227 = 0, $3228 = 0, $3229 = 0, $323 = 0, $3230 = 0, $3231 = 0, $3232 = 0, $3233 = 0, $3234 = 0, $3235 = 0, $3236 = 0, $3237 = 0, $3238 = 0, $3239 = 0, $324 = 0, $3240 = 0, $3241 = 0, $3242 = 0, $3243 = 0;
 var $3244 = 0, $3245 = 0, $3246 = 0, $3247 = 0, $3248 = 0, $3249 = 0, $325 = 0, $3250 = 0, $3251 = 0, $3252 = 0, $3253 = 0, $3254 = 0, $3255 = 0, $3256 = 0, $3257 = 0, $3258 = 0, $3259 = 0, $326 = 0, $3260 = 0, $3261 = 0;
 var $3262 = 0, $3263 = 0, $3264 = 0, $3265 = 0, $3266 = 0, $3267 = 0, $3268 = 0, $3269 = 0, $327 = 0, $3270 = 0, $3271 = 0, $3272 = 0, $3273 = 0, $3274 = 0, $3275 = 0, $3276 = 0, $3277 = 0, $3278 = 0, $3279 = 0, $328 = 0;
 var $3280 = 0, $3281 = 0, $3282 = 0, $3283 = 0, $3284 = 0, $3285 = 0, $3286 = 0, $3287 = 0, $3288 = 0, $3289 = 0, $329 = 0, $3290 = 0, $3291 = 0, $3292 = 0, $3293 = 0, $3294 = 0, $3295 = 0, $3296 = 0, $3297 = 0, $3298 = 0;
 var $3299 = 0, $33 = 0, $330 = 0, $3300 = 0, $3301 = 0, $3302 = 0, $3303 = 0, $3304 = 0, $3305 = 0, $3306 = 0, $3307 = 0, $3308 = 0, $3309 = 0, $331 = 0, $3310 = 0, $3311 = 0, $3312 = 0, $3313 = 0, $3314 = 0, $3315 = 0;
 var $3316 = 0, $3317 = 0, $3318 = 0, $3319 = 0, $332 = 0, $3320 = 0, $3321 = 0, $3322 = 0, $3323 = 0, $3324 = 0, $3325 = 0, $3326 = 0, $3327 = 0, $3328 = 0, $3329 = 0, $333 = 0, $3330 = 0, $3331 = 0, $3332 = 0, $3333 = 0;
 var $3334 = 0, $3335 = 0, $3336 = 0, $3337 = 0, $3338 = 0, $3339 = 0, $334 = 0, $3340 = 0, $3341 = 0, $3342 = 0, $3343 = 0, $3344 = 0, $3345 = 0, $3346 = 0, $3347 = 0, $3348 = 0, $3349 = 0, $335 = 0, $3350 = 0, $3351 = 0;
 var $3352 = 0, $3353 = 0, $3354 = 0, $3355 = 0, $3356 = 0, $3357 = 0, $3358 = 0, $3359 = 0, $336 = 0, $3360 = 0, $3361 = 0, $3362 = 0, $3363 = 0, $3364 = 0, $3365 = 0, $3366 = 0, $3367 = 0, $3368 = 0, $3369 = 0, $337 = 0;
 var $3370 = 0, $3371 = 0, $3372 = 0, $3373 = 0, $3374 = 0, $3375 = 0, $3376 = 0, $3377 = 0, $3378 = 0, $3379 = 0, $338 = 0, $3380 = 0, $3381 = 0, $3382 = 0, $3383 = 0, $3384 = 0, $3385 = 0, $3386 = 0, $3387 = 0, $3388 = 0;
 var $3389 = 0, $339 = 0, $3390 = 0, $3391 = 0, $3392 = 0, $3393 = 0, $3394 = 0, $3395 = 0, $3396 = 0, $3397 = 0, $3398 = 0, $3399 = 0, $34 = 0, $340 = 0, $3400 = 0, $3401 = 0, $3402 = 0, $3403 = 0, $3404 = 0, $3405 = 0;
 var $3406 = 0, $3407 = 0, $3408 = 0, $3409 = 0, $341 = 0, $3410 = 0, $3411 = 0, $3412 = 0, $3413 = 0, $3414 = 0, $3415 = 0, $3416 = 0, $3417 = 0, $3418 = 0, $3419 = 0, $342 = 0, $3420 = 0, $3421 = 0, $3422 = 0, $3423 = 0;
 var $3424 = 0, $3425 = 0, $3426 = 0, $3427 = 0, $3428 = 0, $3429 = 0, $343 = 0, $3430 = 0, $3431 = 0, $3432 = 0, $3433 = 0, $3434 = 0, $3435 = 0, $3436 = 0, $3437 = 0, $3438 = 0, $3439 = 0, $344 = 0, $3440 = 0, $3441 = 0;
 var $3442 = 0, $3443 = 0, $3444 = 0, $3445 = 0, $3446 = 0, $3447 = 0, $3448 = 0, $3449 = 0, $345 = 0, $3450 = 0, $3451 = 0, $3452 = 0, $3453 = 0, $3454 = 0, $3455 = 0, $3456 = 0, $3457 = 0, $3458 = 0, $3459 = 0, $346 = 0;
 var $3460 = 0, $3461 = 0, $3462 = 0, $3463 = 0, $3464 = 0, $3465 = 0, $3466 = 0, $3467 = 0, $3468 = 0, $3469 = 0, $347 = 0, $3470 = 0, $3471 = 0, $3472 = 0, $3473 = 0, $3474 = 0, $3475 = 0, $3476 = 0, $3477 = 0, $3478 = 0;
 var $3479 = 0, $348 = 0, $3480 = 0, $3481 = 0, $3482 = 0, $3483 = 0, $3484 = 0, $3485 = 0, $3486 = 0, $3487 = 0, $3488 = 0, $3489 = 0, $349 = 0, $3490 = 0, $3491 = 0, $3492 = 0, $3493 = 0, $3494 = 0, $3495 = 0, $3496 = 0;
 var $3497 = 0, $3498 = 0, $3499 = 0, $35 = 0, $350 = 0, $3500 = 0, $3501 = 0, $3502 = 0, $3503 = 0, $3504 = 0, $3505 = 0, $3506 = 0, $3507 = 0, $3508 = 0, $3509 = 0, $351 = 0, $3510 = 0, $3511 = 0, $3512 = 0, $3513 = 0;
 var $3514 = 0, $3515 = 0, $3516 = 0, $3517 = 0, $3518 = 0, $3519 = 0, $352 = 0, $3520 = 0, $3521 = 0, $3522 = 0, $3523 = 0, $3524 = 0, $3525 = 0, $3526 = 0, $3527 = 0, $3528 = 0, $3529 = 0, $353 = 0, $3530 = 0, $3531 = 0;
 var $3532 = 0, $3533 = 0, $3534 = 0, $3535 = 0, $3536 = 0, $3537 = 0, $3538 = 0, $3539 = 0, $354 = 0, $3540 = 0, $3541 = 0, $3542 = 0, $3543 = 0, $3544 = 0, $3545 = 0, $3546 = 0, $3547 = 0, $3548 = 0, $3549 = 0, $355 = 0;
 var $3550 = 0, $3551 = 0, $3552 = 0, $3553 = 0, $3554 = 0, $3555 = 0, $3556 = 0, $3557 = 0, $3558 = 0, $3559 = 0, $356 = 0, $3560 = 0, $3561 = 0, $3562 = 0, $3563 = 0, $3564 = 0, $3565 = 0, $3566 = 0, $3567 = 0, $3568 = 0;
 var $3569 = 0, $357 = 0, $3570 = 0, $3571 = 0, $3572 = 0, $3573 = 0, $3574 = 0, $3575 = 0, $3576 = 0, $3577 = 0, $3578 = 0, $3579 = 0, $358 = 0, $3580 = 0, $3581 = 0, $3582 = 0, $3583 = 0, $3584 = 0, $3585 = 0, $3586 = 0;
 var $3587 = 0, $3588 = 0, $3589 = 0, $359 = 0, $3590 = 0, $3591 = 0, $3592 = 0, $3593 = 0, $3594 = 0, $3595 = 0, $3596 = 0, $3597 = 0, $3598 = 0, $3599 = 0, $36 = 0, $360 = 0, $3600 = 0, $3601 = 0, $3602 = 0, $3603 = 0;
 var $3604 = 0, $3605 = 0, $3606 = 0, $3607 = 0, $3608 = 0, $3609 = 0, $361 = 0, $3610 = 0, $3611 = 0, $3612 = 0, $3613 = 0, $3614 = 0, $3615 = 0, $3616 = 0, $3617 = 0, $3618 = 0, $3619 = 0, $362 = 0, $3620 = 0, $3621 = 0;
 var $3622 = 0, $3623 = 0, $3624 = 0, $3625 = 0, $3626 = 0, $3627 = 0, $3628 = 0, $3629 = 0, $363 = 0, $3630 = 0, $3631 = 0, $3632 = 0, $3633 = 0, $3634 = 0, $3635 = 0, $3636 = 0, $3637 = 0, $3638 = 0, $3639 = 0, $364 = 0;
 var $3640 = 0, $3641 = 0, $3642 = 0, $3643 = 0, $3644 = 0, $3645 = 0, $3646 = 0, $3647 = 0, $3648 = 0, $3649 = 0, $365 = 0, $3650 = 0, $3651 = 0, $3652 = 0, $3653 = 0, $3654 = 0, $3655 = 0, $3656 = 0, $3657 = 0, $3658 = 0;
 var $3659 = 0, $366 = 0, $3660 = 0, $3661 = 0, $3662 = 0, $3663 = 0, $3664 = 0, $3665 = 0, $3666 = 0, $3667 = 0, $3668 = 0, $3669 = 0, $367 = 0, $3670 = 0, $3671 = 0, $3672 = 0, $3673 = 0, $3674 = 0, $3675 = 0, $3676 = 0;
 var $3677 = 0, $3678 = 0, $3679 = 0, $368 = 0, $3680 = 0, $3681 = 0, $3682 = 0, $3683 = 0, $3684 = 0, $3685 = 0, $3686 = 0, $3687 = 0, $3688 = 0, $3689 = 0, $369 = 0, $3690 = 0, $3691 = 0, $3692 = 0, $3693 = 0, $3694 = 0;
 var $3695 = 0, $3696 = 0, $3697 = 0, $3698 = 0, $3699 = 0, $37 = 0, $370 = 0, $3700 = 0, $3701 = 0, $3702 = 0, $3703 = 0, $3704 = 0, $3705 = 0, $3706 = 0, $3707 = 0, $3708 = 0, $3709 = 0, $371 = 0, $3710 = 0, $3711 = 0;
 var $3712 = 0, $3713 = 0, $3714 = 0, $3715 = 0, $3716 = 0, $3717 = 0, $3718 = 0, $3719 = 0, $372 = 0, $3720 = 0, $3721 = 0, $3722 = 0, $3723 = 0, $3724 = 0, $3725 = 0, $3726 = 0, $3727 = 0, $3728 = 0, $3729 = 0, $373 = 0;
 var $3730 = 0, $3731 = 0, $3732 = 0, $3733 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0;
 var $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0;
 var $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0;
 var $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0;
 var $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0;
 var $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0;
 var $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0;
 var $498 = 0, $499 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0;
 var $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0;
 var $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0;
 var $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0;
 var $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0;
 var $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0;
 var $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0;
 var $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0;
 var $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0;
 var $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0;
 var $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0;
 var $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0;
 var $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0;
 var $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0;
 var $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0;
 var $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0;
 var $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0;
 var $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0;
 var $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0.0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0;
 var $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0.0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0;
 var $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0.0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0;
 var $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0.0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0;
 var $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0;
 var $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0;
 var $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0;
 var $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0;
 var $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0;
 var $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $or$cond = 0, $or$cond3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 3840|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(3840|0);
 $126 = sp + 3835|0;
 $143 = sp + 3834|0;
 $146 = sp + 3240|0;
 $150 = sp + 3224|0;
 $154 = sp + 3208|0;
 $159 = sp + 3188|0;
 $162 = sp + 3176|0;
 $165 = sp + 3164|0;
 $166 = sp + 3160|0;
 $167 = sp + 3156|0;
 $171 = sp + 3140|0;
 $175 = sp + 3124|0;
 $179 = sp + 3108|0;
 $184 = sp + 3088|0;
 $187 = sp + 3076|0;
 $190 = sp + 3064|0;
 $191 = sp + 3060|0;
 $192 = sp + 3056|0;
 $210 = sp + 3833|0;
 $227 = sp + 3832|0;
 $244 = sp + 3831|0;
 $261 = sp + 3830|0;
 $278 = sp + 3829|0;
 $295 = sp + 3828|0;
 $312 = sp + 3827|0;
 $329 = sp + 3826|0;
 $346 = sp + 3825|0;
 $352 = sp + 2452|0;
 $369 = sp + 3824|0;
 $386 = sp + 3823|0;
 $403 = sp + 3822|0;
 $420 = sp + 3821|0;
 $437 = sp + 3820|0;
 $454 = sp + 3819|0;
 $471 = sp + 3818|0;
 $488 = sp + 3817|0;
 $505 = sp + 3816|0;
 $522 = sp + 3815|0;
 $539 = sp + 3814|0;
 $556 = sp + 3813|0;
 $562 = sp + 1660|0;
 $579 = sp + 3812|0;
 $596 = sp + 3811|0;
 $613 = sp + 3810|0;
 $630 = sp + 3809|0;
 $647 = sp + 3808|0;
 $664 = sp + 3807|0;
 $681 = sp + 3806|0;
 $698 = sp + 3805|0;
 $715 = sp + 3804|0;
 $732 = sp + 3803|0;
 $749 = sp + 3802|0;
 $766 = sp + 3801|0;
 $774 = sp + 860|0;
 $778 = sp + 844|0;
 $782 = sp + 828|0;
 $787 = sp + 808|0;
 $790 = sp + 796|0;
 $793 = sp + 784|0;
 $794 = sp + 780|0;
 $795 = sp + 776|0;
 $799 = sp + 760|0;
 $803 = sp + 744|0;
 $807 = sp + 728|0;
 $812 = sp + 708|0;
 $815 = sp + 696|0;
 $818 = sp + 684|0;
 $819 = sp + 680|0;
 $820 = sp + 676|0;
 $831 = sp + 636|0;
 $832 = sp + 632|0;
 $833 = sp + 628|0;
 $835 = sp + 620|0;
 $836 = sp + 616|0;
 $837 = sp + 612|0;
 $839 = sp + 184|0;
 $840 = sp + 596|0;
 $843 = sp + 576|0;
 $845 = sp + 176|0;
 $846 = sp + 168|0;
 $856 = sp + 552|0;
 $857 = sp + 548|0;
 $858 = sp + 544|0;
 $859 = sp + 540|0;
 $860 = sp + 536|0;
 $861 = sp + 532|0;
 $862 = sp + 528|0;
 $863 = sp + 524|0;
 $864 = sp + 520|0;
 $865 = sp + 516|0;
 $866 = sp + 512|0;
 $867 = sp + 508|0;
 $871 = sp + 496|0;
 $872 = sp + 492|0;
 $873 = sp + 488|0;
 $875 = sp + 480|0;
 $876 = sp + 476|0;
 $877 = sp + 472|0;
 $879 = sp + 464|0;
 $880 = sp + 460|0;
 $881 = sp + 456|0;
 $885 = sp + 444|0;
 $886 = sp + 440|0;
 $887 = sp + 436|0;
 $888 = sp + 432|0;
 $889 = sp + 428|0;
 $890 = sp + 424|0;
 $893 = sp + 412|0;
 $894 = sp + 408|0;
 $895 = sp + 396|0;
 $896 = sp + 384|0;
 $899 = sp + 372|0;
 $900 = sp + 3796|0;
 $903 = sp;
 $823 = $0;
 $824 = $1;
 $825 = $2;
 $826 = $3;
 $827 = $4;
 $828 = $5;
 $913 = $823;
 HEAP32[$831>>2] = -1;
 HEAP32[$832>>2] = -1;
 HEAP32[$833>>2] = -1;
 $834 = 0;
 HEAP32[$835>>2] = -1;
 HEAP32[$836>>2] = -1;
 HEAP32[$837>>2] = -1;
 $838 = 0;
 __ZN3CWTC2Ev($839);
 $821 = $840;
 $914 = $821;
 $817 = $914;
 $915 = $817;
 $816 = $915;
 $797 = $799;
 $798 = -1;
 $916 = $797;
 HEAP32[$916>>2] = 0;
 $917 = HEAP32[$799>>2]|0;
 HEAP32[$818>>2] = $917;
 $800 = $818;
 HEAP32[$915>>2] = 0;
 $918 = ((($915)) + 4|0);
 $801 = $803;
 $802 = -1;
 $919 = $801;
 HEAP32[$919>>2] = 0;
 $920 = HEAP32[$803>>2]|0;
 HEAP32[$819>>2] = $920;
 $804 = $819;
 HEAP32[$918>>2] = 0;
 $921 = ((($915)) + 8|0);
 $805 = $807;
 $806 = -1;
 $922 = $805;
 HEAP32[$922>>2] = 0;
 $923 = HEAP32[$807>>2]|0;
 HEAP32[$820>>2] = $923;
 $808 = $820;
 $814 = $921;
 HEAP32[$815>>2] = 0;
 $924 = $814;
 $813 = $815;
 $925 = $813;
 $926 = HEAP32[$925>>2]|0;
 $811 = $924;
 HEAP32[$812>>2] = $926;
 $927 = $811;
 $810 = $927;
 $809 = $812;
 $928 = $809;
 $929 = HEAP32[$928>>2]|0;
 HEAP32[$927>>2] = $929;
 $796 = $843;
 $930 = $796;
 $792 = $930;
 $931 = $792;
 $791 = $931;
 $772 = $774;
 $773 = -1;
 $932 = $772;
 HEAP32[$932>>2] = 0;
 $933 = HEAP32[$774>>2]|0;
 HEAP32[$793>>2] = $933;
 $775 = $793;
 HEAP32[$931>>2] = 0;
 $934 = ((($931)) + 4|0);
 $776 = $778;
 $777 = -1;
 $935 = $776;
 HEAP32[$935>>2] = 0;
 $936 = HEAP32[$778>>2]|0;
 HEAP32[$794>>2] = $936;
 $779 = $794;
 HEAP32[$934>>2] = 0;
 $937 = ((($931)) + 8|0);
 $780 = $782;
 $781 = -1;
 $938 = $780;
 HEAP32[$938>>2] = 0;
 $939 = HEAP32[$782>>2]|0;
 HEAP32[$795>>2] = $939;
 $783 = $795;
 $789 = $937;
 HEAP32[$790>>2] = 0;
 $940 = $789;
 $788 = $790;
 $941 = $788;
 $942 = HEAP32[$941>>2]|0;
 $786 = $940;
 HEAP32[$787>>2] = $942;
 $943 = $786;
 $785 = $943;
 $784 = $787;
 $944 = $784;
 $945 = HEAP32[$944>>2]|0;
 HEAP32[$943>>2] = $945;
 $851 = 0;
 $852 = 0;
 $853 = 0;
 L1: while(1) {
  $946 = $853;
  $947 = $828;
  $948 = (($947) - 1)|0;
  $949 = ($946|0)<($948|0);
  if (!($949)) {
   label = 212;
   break;
  }
  $950 = $827;
  $951 = $853;
  $952 = $951<<1;
  $953 = (($952) + 1)|0;
  $954 = (($950) + ($953<<2)|0);
  $955 = HEAP32[$954>>2]|0;
  $956 = HEAP32[$955>>2]|0;
  $830 = $956;
  $957 = $827;
  $958 = $853;
  $959 = $958<<1;
  $960 = (($959) + 2)|0;
  $961 = (($957) + ($960<<2)|0);
  $962 = HEAP32[$961>>2]|0;
  $963 = HEAP32[$962>>2]|0;
  $964 = $827;
  $965 = $853;
  $966 = $965<<1;
  $967 = (($966) + 1)|0;
  $968 = (($964) + ($967<<2)|0);
  $969 = HEAP32[$968>>2]|0;
  $970 = HEAP32[$969>>2]|0;
  $971 = (($963) - ($970))|0;
  $829 = $971;
  $854 = 0;
  $972 = $852;
  $855 = $972;
  while(1) {
   $973 = $855;
   $974 = ((($913)) + 168|0);
   $771 = $974;
   $975 = $771;
   $976 = ((($975)) + 4|0);
   $977 = HEAP32[$976>>2]|0;
   $978 = HEAP32[$975>>2]|0;
   $979 = $977;
   $980 = $978;
   $981 = (($979) - ($980))|0;
   $982 = (($981|0) / 4)&-1;
   $983 = ($973|0)<($982|0);
   if (!($983)) {
    break;
   }
   $984 = ((($913)) + 168|0);
   $985 = $855;
   $769 = $984;
   $770 = $985;
   $986 = $769;
   $987 = HEAP32[$986>>2]|0;
   $988 = $770;
   $989 = (($987) + ($988<<2)|0);
   $990 = HEAP32[$989>>2]|0;
   $991 = $827;
   $992 = $853;
   $993 = $992<<1;
   $994 = (($993) + 1)|0;
   $995 = (($991) + ($994<<2)|0);
   $996 = HEAP32[$995>>2]|0;
   $997 = HEAP32[$996>>2]|0;
   $998 = ($990|0)>($997|0);
   if ($998) {
    $999 = ((($913)) + 168|0);
    $1000 = $855;
    $767 = $999;
    $768 = $1000;
    $1001 = $767;
    $1002 = HEAP32[$1001>>2]|0;
    $1003 = $768;
    $1004 = (($1002) + ($1003<<2)|0);
    $1005 = HEAP32[$1004>>2]|0;
    $1006 = $827;
    $1007 = $853;
    $1008 = $1007<<1;
    $1009 = (($1008) + 2)|0;
    $1010 = (($1006) + ($1009<<2)|0);
    $1011 = HEAP32[$1010>>2]|0;
    $1012 = HEAP32[$1011>>2]|0;
    $1013 = ($1005|0)<($1012|0);
    if ($1013) {
     label = 7;
     break;
    }
   }
   $1178 = $855;
   $1179 = (($1178) + 1)|0;
   $855 = $1179;
  }
  if ((label|0) == 7) {
   label = 0;
   HEAP32[$856>>2] = 0;
   $764 = $840;
   $765 = $856;
   $1014 = $764;
   $1015 = ((($1014)) + 4|0);
   $1016 = HEAP32[$1015>>2]|0;
   $763 = $1014;
   $1017 = $763;
   $1018 = ((($1017)) + 8|0);
   $762 = $1018;
   $1019 = $762;
   $761 = $1019;
   $1020 = $761;
   $1021 = HEAP32[$1020>>2]|0;
   $1022 = ($1016|0)!=($1021|0);
   if ($1022) {
    $758 = $766;
    $759 = $1014;
    $760 = 1;
    $752 = $1014;
    $1023 = $752;
    $1024 = ((($1023)) + 8|0);
    $751 = $1024;
    $1025 = $751;
    $750 = $1025;
    $1026 = $750;
    $1027 = ((($1014)) + 4|0);
    $1028 = HEAP32[$1027>>2]|0;
    $753 = $1028;
    $1029 = $753;
    $1030 = $765;
    $754 = $1026;
    $755 = $1029;
    $756 = $1030;
    $1031 = $755;
    $1032 = $756;
    $1033 = HEAP32[$1032>>2]|0;
    HEAP32[$1031>>2] = $1033;
    $757 = $766;
    $1034 = ((($1014)) + 4|0);
    $1035 = HEAP32[$1034>>2]|0;
    $1036 = ((($1035)) + 4|0);
    HEAP32[$1034>>2] = $1036;
   } else {
    $1037 = $765;
    __THREW__ = 0;
    invoke_vii(43,($1014|0),($1037|0));
    $1038 = __THREW__; __THREW__ = 0;
    $1039 = $1038&1;
    if ($1039) {
     label = 28;
     break;
    }
   }
   HEAP32[$857>>2] = 0;
   $747 = $840;
   $748 = $857;
   $1040 = $747;
   $1041 = ((($1040)) + 4|0);
   $1042 = HEAP32[$1041>>2]|0;
   $746 = $1040;
   $1043 = $746;
   $1044 = ((($1043)) + 8|0);
   $745 = $1044;
   $1045 = $745;
   $744 = $1045;
   $1046 = $744;
   $1047 = HEAP32[$1046>>2]|0;
   $1048 = ($1042|0)!=($1047|0);
   if ($1048) {
    $741 = $749;
    $742 = $1040;
    $743 = 1;
    $735 = $1040;
    $1049 = $735;
    $1050 = ((($1049)) + 8|0);
    $734 = $1050;
    $1051 = $734;
    $733 = $1051;
    $1052 = $733;
    $1053 = ((($1040)) + 4|0);
    $1054 = HEAP32[$1053>>2]|0;
    $736 = $1054;
    $1055 = $736;
    $1056 = $748;
    $737 = $1052;
    $738 = $1055;
    $739 = $1056;
    $1057 = $738;
    $1058 = $739;
    $1059 = HEAP32[$1058>>2]|0;
    HEAP32[$1057>>2] = $1059;
    $740 = $749;
    $1060 = ((($1040)) + 4|0);
    $1061 = HEAP32[$1060>>2]|0;
    $1062 = ((($1061)) + 4|0);
    HEAP32[$1060>>2] = $1062;
   } else {
    $1063 = $748;
    __THREW__ = 0;
    invoke_vii(43,($1040|0),($1063|0));
    $1064 = __THREW__; __THREW__ = 0;
    $1065 = $1064&1;
    if ($1065) {
     label = 28;
     break;
    }
   }
   HEAP32[$858>>2] = 0;
   $730 = $840;
   $731 = $858;
   $1066 = $730;
   $1067 = ((($1066)) + 4|0);
   $1068 = HEAP32[$1067>>2]|0;
   $729 = $1066;
   $1069 = $729;
   $1070 = ((($1069)) + 8|0);
   $728 = $1070;
   $1071 = $728;
   $727 = $1071;
   $1072 = $727;
   $1073 = HEAP32[$1072>>2]|0;
   $1074 = ($1068|0)!=($1073|0);
   if ($1074) {
    $724 = $732;
    $725 = $1066;
    $726 = 1;
    $718 = $1066;
    $1075 = $718;
    $1076 = ((($1075)) + 8|0);
    $717 = $1076;
    $1077 = $717;
    $716 = $1077;
    $1078 = $716;
    $1079 = ((($1066)) + 4|0);
    $1080 = HEAP32[$1079>>2]|0;
    $719 = $1080;
    $1081 = $719;
    $1082 = $731;
    $720 = $1078;
    $721 = $1081;
    $722 = $1082;
    $1083 = $721;
    $1084 = $722;
    $1085 = HEAP32[$1084>>2]|0;
    HEAP32[$1083>>2] = $1085;
    $723 = $732;
    $1086 = ((($1066)) + 4|0);
    $1087 = HEAP32[$1086>>2]|0;
    $1088 = ((($1087)) + 4|0);
    HEAP32[$1086>>2] = $1088;
   } else {
    $1089 = $731;
    __THREW__ = 0;
    invoke_vii(43,($1066|0),($1089|0));
    $1090 = __THREW__; __THREW__ = 0;
    $1091 = $1090&1;
    if ($1091) {
     label = 28;
     break;
    }
   }
   HEAP32[$859>>2] = 0;
   $713 = $843;
   $714 = $859;
   $1092 = $713;
   $1093 = ((($1092)) + 4|0);
   $1094 = HEAP32[$1093>>2]|0;
   $712 = $1092;
   $1095 = $712;
   $1096 = ((($1095)) + 8|0);
   $711 = $1096;
   $1097 = $711;
   $710 = $1097;
   $1098 = $710;
   $1099 = HEAP32[$1098>>2]|0;
   $1100 = ($1094|0)!=($1099|0);
   if ($1100) {
    $707 = $715;
    $708 = $1092;
    $709 = 1;
    $701 = $1092;
    $1101 = $701;
    $1102 = ((($1101)) + 8|0);
    $700 = $1102;
    $1103 = $700;
    $699 = $1103;
    $1104 = $699;
    $1105 = ((($1092)) + 4|0);
    $1106 = HEAP32[$1105>>2]|0;
    $702 = $1106;
    $1107 = $702;
    $1108 = $714;
    $703 = $1104;
    $704 = $1107;
    $705 = $1108;
    $1109 = $704;
    $1110 = $705;
    $1111 = HEAP32[$1110>>2]|0;
    HEAP32[$1109>>2] = $1111;
    $706 = $715;
    $1112 = ((($1092)) + 4|0);
    $1113 = HEAP32[$1112>>2]|0;
    $1114 = ((($1113)) + 4|0);
    HEAP32[$1112>>2] = $1114;
   } else {
    $1115 = $714;
    __THREW__ = 0;
    invoke_vii(43,($1092|0),($1115|0));
    $1116 = __THREW__; __THREW__ = 0;
    $1117 = $1116&1;
    if ($1117) {
     label = 28;
     break;
    }
   }
   HEAP32[$860>>2] = 0;
   $696 = $843;
   $697 = $860;
   $1118 = $696;
   $1119 = ((($1118)) + 4|0);
   $1120 = HEAP32[$1119>>2]|0;
   $695 = $1118;
   $1121 = $695;
   $1122 = ((($1121)) + 8|0);
   $694 = $1122;
   $1123 = $694;
   $693 = $1123;
   $1124 = $693;
   $1125 = HEAP32[$1124>>2]|0;
   $1126 = ($1120|0)!=($1125|0);
   if ($1126) {
    $690 = $698;
    $691 = $1118;
    $692 = 1;
    $684 = $1118;
    $1127 = $684;
    $1128 = ((($1127)) + 8|0);
    $683 = $1128;
    $1129 = $683;
    $682 = $1129;
    $1130 = $682;
    $1131 = ((($1118)) + 4|0);
    $1132 = HEAP32[$1131>>2]|0;
    $685 = $1132;
    $1133 = $685;
    $1134 = $697;
    $686 = $1130;
    $687 = $1133;
    $688 = $1134;
    $1135 = $687;
    $1136 = $688;
    $1137 = HEAP32[$1136>>2]|0;
    HEAP32[$1135>>2] = $1137;
    $689 = $698;
    $1138 = ((($1118)) + 4|0);
    $1139 = HEAP32[$1138>>2]|0;
    $1140 = ((($1139)) + 4|0);
    HEAP32[$1138>>2] = $1140;
   } else {
    $1141 = $697;
    __THREW__ = 0;
    invoke_vii(43,($1118|0),($1141|0));
    $1142 = __THREW__; __THREW__ = 0;
    $1143 = $1142&1;
    if ($1143) {
     label = 28;
     break;
    }
   }
   HEAP32[$861>>2] = 0;
   $679 = $843;
   $680 = $861;
   $1144 = $679;
   $1145 = ((($1144)) + 4|0);
   $1146 = HEAP32[$1145>>2]|0;
   $678 = $1144;
   $1147 = $678;
   $1148 = ((($1147)) + 8|0);
   $677 = $1148;
   $1149 = $677;
   $676 = $1149;
   $1150 = $676;
   $1151 = HEAP32[$1150>>2]|0;
   $1152 = ($1146|0)!=($1151|0);
   if ($1152) {
    $673 = $681;
    $674 = $1144;
    $675 = 1;
    $667 = $1144;
    $1153 = $667;
    $1154 = ((($1153)) + 8|0);
    $666 = $1154;
    $1155 = $666;
    $665 = $1155;
    $1156 = $665;
    $1157 = ((($1144)) + 4|0);
    $1158 = HEAP32[$1157>>2]|0;
    $668 = $1158;
    $1159 = $668;
    $1160 = $680;
    $669 = $1156;
    $670 = $1159;
    $671 = $1160;
    $1161 = $670;
    $1162 = $671;
    $1163 = HEAP32[$1162>>2]|0;
    HEAP32[$1161>>2] = $1163;
    $672 = $681;
    $1164 = ((($1144)) + 4|0);
    $1165 = HEAP32[$1164>>2]|0;
    $1166 = ((($1165)) + 4|0);
    HEAP32[$1164>>2] = $1166;
   } else {
    $1167 = $680;
    __THREW__ = 0;
    invoke_vii(43,($1144|0),($1167|0));
    $1168 = __THREW__; __THREW__ = 0;
    $1169 = $1168&1;
    if ($1169) {
     label = 28;
     break;
    }
   }
   $1170 = $852;
   $1171 = (($1170) + 1)|0;
   $852 = $1171;
   $854 = 1;
  }
  $1180 = $854;
  $1181 = $1180&1;
  do {
   if (!($1181)) {
    $1182 = $827;
    $1183 = $853;
    $1184 = $1183<<1;
    $1185 = (($1184) + 2)|0;
    $1186 = (($1182) + ($1185<<2)|0);
    $1187 = HEAP32[$1186>>2]|0;
    $1188 = HEAP32[$1187>>2]|0;
    $1189 = $827;
    $1190 = $853;
    $1191 = $1190<<1;
    $1192 = (($1189) + ($1191<<2)|0);
    $1193 = HEAP32[$1192>>2]|0;
    $1194 = HEAP32[$1193>>2]|0;
    $1195 = (($1188) - ($1194))|0;
    $1196 = (+($1195|0));
    $1197 = $826;
    $1198 = $1196 / $1197;
    $847 = $1198;
    $1199 = $847;
    $1200 = 60.0 / $1199;
    $1201 = ((($913)) + 48|0);
    $1202 = HEAP32[$1201>>2]|0;
    $1203 = (+($1202|0));
    $1204 = $1200 < $1203;
    if (!($1204)) {
     $1205 = $847;
     $1206 = 60.0 / $1205;
     $1207 = ((($913)) + 48|0);
     $1208 = ((($1207)) + 4|0);
     $1209 = HEAP32[$1208>>2]|0;
     $1210 = (($1209) - 20)|0;
     $1211 = (+($1210|0));
     $1212 = $1206 > $1211;
     if (!($1212)) {
      $1369 = $826;
      $1370 = ((($913)) + 48|0);
      $1371 = ((($1370)) + 72|0);
      $1372 = +HEAPF64[$1371>>3];
      $1373 = $1369 * $1372;
      $1374 = $827;
      $1375 = $853;
      $1376 = $1375<<1;
      $1377 = (($1376) + 1)|0;
      $1378 = (($1374) + ($1377<<2)|0);
      $1379 = HEAP32[$1378>>2]|0;
      $1380 = HEAP32[$1379>>2]|0;
      $1381 = $827;
      $1382 = $853;
      $1383 = $1382<<1;
      $1384 = (($1383) + 0)|0;
      $1385 = (($1381) + ($1384<<2)|0);
      $1386 = HEAP32[$1385>>2]|0;
      $1387 = HEAP32[$1386>>2]|0;
      $1388 = (($1380) - ($1387))|0;
      $1389 = (+($1388|0));
      $1390 = $1373 - $1389;
      $1391 = $829;
      $1392 = $851;
      $1393 = (($1391) - ($1392))|0;
      $1394 = (+($1393|0));
      $1395 = $1390 > $1394;
      if ($1395) {
       $1396 = $829;
       $1397 = $851;
       $1398 = (($1396) - ($1397))|0;
       $829 = $1398;
      } else {
       $1399 = $826;
       $1400 = ((($913)) + 48|0);
       $1401 = ((($1400)) + 72|0);
       $1402 = +HEAPF64[$1401>>3];
       $1403 = $1399 * $1402;
       $1404 = $827;
       $1405 = $853;
       $1406 = $1405<<1;
       $1407 = (($1406) + 1)|0;
       $1408 = (($1404) + ($1407<<2)|0);
       $1409 = HEAP32[$1408>>2]|0;
       $1410 = HEAP32[$1409>>2]|0;
       $1411 = $827;
       $1412 = $853;
       $1413 = $1412<<1;
       $1414 = (($1413) + 0)|0;
       $1415 = (($1411) + ($1414<<2)|0);
       $1416 = HEAP32[$1415>>2]|0;
       $1417 = HEAP32[$1416>>2]|0;
       $1418 = (($1410) - ($1417))|0;
       $1419 = (+($1418|0));
       $1420 = $1403 - $1419;
       $1421 = $851;
       $1422 = (+($1421|0));
       $1423 = $1420 - $1422;
       $1424 = (~~(($1423)));
       $829 = $1424;
      }
      $1425 = ((($913)) + 48|0);
      $1426 = ((($1425)) + 96|0);
      $1427 = HEAP32[$1426>>2]|0;
      $1428 = ($1427|0)==(1);
      $1429 = $829;
      $1430 = $826;
      if ($1428) {
       __THREW__ = 0;
       invoke_viiidd(47,($839|0),($1429|0),5,0.0,(+$1430));
       $1431 = __THREW__; __THREW__ = 0;
       $1432 = $1431&1;
       if ($1432) {
        label = 28;
        break L1;
       }
      } else {
       __THREW__ = 0;
       invoke_viiidd(47,($839|0),($1429|0),6,0.0,(+$1430));
       $1433 = __THREW__; __THREW__ = 0;
       $1434 = $1433&1;
       if ($1434) {
        label = 28;
        break L1;
       }
      }
      $1435 = $824;
      $1436 = $830;
      $1437 = (($1435) + ($1436<<3)|0);
      $1438 = $851;
      $1439 = (($1437) + ($1438<<3)|0);
      $1440 = ((($913)) + 48|0);
      $1441 = ((($1440)) + 88|0);
      $1442 = +HEAPF64[$1441>>3];
      __THREW__ = 0;
      $1443 = (invoke_iiididd(48,($839|0),($1439|0),(+$1442),1,0.0,0.0)|0);
      $1444 = __THREW__; __THREW__ = 0;
      $1445 = $1444&1;
      if ($1445) {
       label = 28;
       break L1;
      }
      $844 = $1443;
      $1446 = $844;
      $1447 = $829;
      __THREW__ = 0;
      invoke_viiiii(49,($913|0),($1446|0),($1447|0),($845|0),($846|0));
      $1448 = __THREW__; __THREW__ = 0;
      $1449 = $1448&1;
      if ($1449) {
       label = 28;
       break L1;
      }
      $868 = 0;
      while(1) {
       $1450 = $868;
       $1451 = $829;
       $1452 = ($1450|0)<($1451|0);
       if (!($1452)) {
        break;
       }
       $1453 = $844;
       $1454 = $868;
       $1455 = (($1453) + ($1454<<3)|0);
       $1456 = +HEAPF64[$1455>>3];
       $1457 = +HEAPF64[$845>>3];
       $1458 = $1456 == $1457;
       if ($1458) {
        $1459 = $868;
        $1460 = $830;
        $1461 = (($1459) + ($1460))|0;
        $1462 = $851;
        $1463 = (($1461) + ($1462))|0;
        HEAP32[$831>>2] = $1463;
       }
       $1464 = $844;
       $1465 = $868;
       $1466 = (($1464) + ($1465<<3)|0);
       $1467 = +HEAPF64[$1466>>3];
       $1468 = +HEAPF64[$846>>3];
       $1469 = $1467 == $1468;
       if ($1469) {
        $1470 = $868;
        $1471 = $830;
        $1472 = (($1470) + ($1471))|0;
        $1473 = $851;
        $1474 = (($1472) + ($1473))|0;
        HEAP32[$833>>2] = $1474;
       }
       $1475 = $868;
       $1476 = (($1475) + 1)|0;
       $868 = $1476;
      }
      $1477 = HEAP32[$831>>2]|0;
      $1478 = HEAP32[$833>>2]|0;
      $1479 = ($1477|0)>($1478|0);
      if ($1479) {
       $560 = $831;
       $561 = $833;
       $1480 = $560;
       $559 = $1480;
       $1481 = $559;
       $1482 = HEAP32[$1481>>2]|0;
       HEAP32[$562>>2] = $1482;
       $1483 = $561;
       $557 = $1483;
       $1484 = $557;
       $1485 = HEAP32[$1484>>2]|0;
       $1486 = $560;
       HEAP32[$1486>>2] = $1485;
       $558 = $562;
       $1487 = $558;
       $1488 = HEAP32[$1487>>2]|0;
       $1489 = $561;
       HEAP32[$1489>>2] = $1488;
      }
      $849 = 0;
      $1490 = $844;
      $1491 = HEAP32[$831>>2]|0;
      $1492 = $830;
      $1493 = (($1491) - ($1492))|0;
      $1494 = $851;
      $1495 = (($1493) - ($1494))|0;
      $1496 = (($1490) + ($1495<<3)|0);
      $1497 = +HEAPF64[$1496>>3];
      $1498 = $1497 < 0.0;
      if ($1498) {
       $1499 = $844;
       $1500 = HEAP32[$833>>2]|0;
       $1501 = $830;
       $1502 = (($1500) - ($1501))|0;
       $1503 = $851;
       $1504 = (($1502) - ($1503))|0;
       $1505 = (($1499) + ($1504<<3)|0);
       $1506 = +HEAPF64[$1505>>3];
       $1507 = $1506 > 0.0;
       if ($1507) {
        label = 72;
       } else {
        label = 70;
       }
      } else {
       label = 70;
      }
      if ((label|0) == 70) {
       label = 0;
       $1508 = $844;
       $1509 = HEAP32[$831>>2]|0;
       $1510 = $830;
       $1511 = (($1509) - ($1510))|0;
       $1512 = $851;
       $1513 = (($1511) - ($1512))|0;
       $1514 = (($1508) + ($1513<<3)|0);
       $1515 = +HEAPF64[$1514>>3];
       $1516 = $1515 > 0.0;
       if ($1516) {
        $1517 = $844;
        $1518 = HEAP32[$833>>2]|0;
        $1519 = $830;
        $1520 = (($1518) - ($1519))|0;
        $1521 = $851;
        $1522 = (($1520) - ($1521))|0;
        $1523 = (($1517) + ($1522<<3)|0);
        $1524 = +HEAPF64[$1523>>3];
        $1525 = $1524 < 0.0;
        if ($1525) {
         label = 72;
        }
       }
      }
      if ((label|0) == 72) {
       label = 0;
       $849 = 1;
      }
      $1526 = $849;
      $1527 = $1526&1;
      do {
       if ($1527) {
        $1528 = HEAP32[$833>>2]|0;
        $1529 = HEAP32[$831>>2]|0;
        $1530 = (($1528) - ($1529))|0;
        $1531 = (+($1530|0));
        $1532 = $826;
        $1533 = 0.089999999999999996 * $1532;
        $1534 = $1531 >= $1533;
        if (!($1534)) {
         $849 = 0;
         break;
        }
        $849 = 1;
        $1535 = HEAP32[$833>>2]|0;
        $1536 = $827;
        $1537 = $853;
        $1538 = $1537<<1;
        $1539 = (($1538) + 0)|0;
        $1540 = (($1536) + ($1539<<2)|0);
        $1541 = HEAP32[$1540>>2]|0;
        $1542 = HEAP32[$1541>>2]|0;
        $1543 = (($1535) - ($1542))|0;
        $1544 = (+($1543|0));
        $1545 = ((($913)) + 48|0);
        $1546 = ((($1545)) + 64|0);
        $1547 = +HEAPF64[$1546>>3];
        $1548 = $826;
        $1549 = $1547 * $1548;
        $1550 = $1544 >= $1549;
        if ($1550) {
         $1551 = HEAP32[$833>>2]|0;
         $1552 = $827;
         $1553 = $853;
         $1554 = $1553<<1;
         $1555 = (($1554) + 0)|0;
         $1556 = (($1552) + ($1555<<2)|0);
         $1557 = HEAP32[$1556>>2]|0;
         $1558 = HEAP32[$1557>>2]|0;
         $1559 = (($1551) - ($1558))|0;
         $1560 = (+($1559|0));
         $1561 = ((($913)) + 48|0);
         $1562 = ((($1561)) + 72|0);
         $1563 = +HEAPF64[$1562>>3];
         $1564 = $826;
         $1565 = $1563 * $1564;
         $1566 = $1560 <= $1565;
         if ($1566) {
          $849 = 1;
          break;
         }
        }
        $849 = 0;
       }
      } while(0);
      $1567 = $849;
      $1568 = $1567&1;
      do {
       if ($1568) {
        $1569 = $844;
        $1570 = HEAP32[$831>>2]|0;
        $1571 = $830;
        $1572 = (($1570) - ($1571))|0;
        $1573 = $851;
        $1574 = (($1572) - ($1573))|0;
        $1575 = (($1569) + ($1574<<3)|0);
        $1576 = +HEAPF64[$1575>>3];
        $1577 = $1576 > 0.0;
        if ($1577) {
         $848 = 1;
        } else {
         $848 = 0;
        }
        $1578 = HEAP32[$831>>2]|0;
        $1579 = $830;
        $1580 = (($1578) - ($1579))|0;
        $1581 = $851;
        $1582 = (($1580) - ($1581))|0;
        $869 = $1582;
        while(1) {
         $1583 = $869;
         $1584 = HEAP32[$833>>2]|0;
         $1585 = $830;
         $1586 = (($1584) - ($1585))|0;
         $1587 = $851;
         $1588 = (($1586) - ($1587))|0;
         $1589 = ($1583|0)<($1588|0);
         if (!($1589)) {
          break;
         }
         $1590 = $848;
         $1591 = $1590&1;
         $1592 = $844;
         $1593 = $869;
         $1594 = (($1592) + ($1593<<3)|0);
         $1595 = +HEAPF64[$1594>>3];
         if ($1591) {
          $1596 = $1595 > 0.0;
          if (!($1596)) {
           label = 89;
           break;
          }
         } else {
          $1597 = $1595 < 0.0;
          if (!($1597)) {
           label = 89;
           break;
          }
         }
         $1603 = $869;
         $1604 = (($1603) + 1)|0;
         $869 = $1604;
        }
        if ((label|0) == 89) {
         label = 0;
         $1598 = $869;
         $1599 = $830;
         $1600 = (($1598) + ($1599))|0;
         $1601 = $851;
         $1602 = (($1600) + ($1601))|0;
         HEAP32[$832>>2] = $1602;
        }
        $1605 = HEAP32[$833>>2]|0;
        $1606 = HEAP32[$832>>2]|0;
        $1607 = (($1605) - ($1606))|0;
        $1608 = HEAP32[$832>>2]|0;
        $1609 = HEAP32[$831>>2]|0;
        $1610 = (($1608) - ($1609))|0;
        $1611 = ($1607|0)<($1610|0);
        if ($1611) {
         $1612 = HEAP32[$833>>2]|0;
         $1613 = HEAP32[$832>>2]|0;
         $1614 = (($1612) - ($1613))|0;
         $1615 = (+($1614|0));
         $1616 = HEAP32[$832>>2]|0;
         $1617 = HEAP32[$831>>2]|0;
         $1618 = (($1616) - ($1617))|0;
         $1619 = (+($1618|0));
         $1620 = $1615 / $1619;
         $870 = $1620;
        } else {
         $1621 = HEAP32[$832>>2]|0;
         $1622 = HEAP32[$831>>2]|0;
         $1623 = (($1621) - ($1622))|0;
         $1624 = (+($1623|0));
         $1625 = HEAP32[$833>>2]|0;
         $1626 = HEAP32[$832>>2]|0;
         $1627 = (($1625) - ($1626))|0;
         $1628 = (+($1627|0));
         $1629 = $1624 / $1628;
         $870 = $1629;
        }
        $1630 = $870;
        $1631 = $1630 < 0.40000000000000002;
        if ($1631) {
         HEAP32[$871>>2] = 0;
         $554 = $843;
         $555 = $871;
         $1632 = $554;
         $1633 = ((($1632)) + 4|0);
         $1634 = HEAP32[$1633>>2]|0;
         $553 = $1632;
         $1635 = $553;
         $1636 = ((($1635)) + 8|0);
         $552 = $1636;
         $1637 = $552;
         $551 = $1637;
         $1638 = $551;
         $1639 = HEAP32[$1638>>2]|0;
         $1640 = ($1634|0)!=($1639|0);
         if ($1640) {
          $548 = $556;
          $549 = $1632;
          $550 = 1;
          $542 = $1632;
          $1641 = $542;
          $1642 = ((($1641)) + 8|0);
          $541 = $1642;
          $1643 = $541;
          $540 = $1643;
          $1644 = $540;
          $1645 = ((($1632)) + 4|0);
          $1646 = HEAP32[$1645>>2]|0;
          $543 = $1646;
          $1647 = $543;
          $1648 = $555;
          $544 = $1644;
          $545 = $1647;
          $546 = $1648;
          $1649 = $545;
          $1650 = $546;
          $1651 = HEAP32[$1650>>2]|0;
          HEAP32[$1649>>2] = $1651;
          $547 = $556;
          $1652 = ((($1632)) + 4|0);
          $1653 = HEAP32[$1652>>2]|0;
          $1654 = ((($1653)) + 4|0);
          HEAP32[$1652>>2] = $1654;
         } else {
          $1655 = $555;
          __THREW__ = 0;
          invoke_vii(43,($1632|0),($1655|0));
          $1656 = __THREW__; __THREW__ = 0;
          $1657 = $1656&1;
          if ($1657) {
           label = 28;
           break L1;
          }
         }
         HEAP32[$872>>2] = 0;
         $537 = $843;
         $538 = $872;
         $1658 = $537;
         $1659 = ((($1658)) + 4|0);
         $1660 = HEAP32[$1659>>2]|0;
         $536 = $1658;
         $1661 = $536;
         $1662 = ((($1661)) + 8|0);
         $535 = $1662;
         $1663 = $535;
         $534 = $1663;
         $1664 = $534;
         $1665 = HEAP32[$1664>>2]|0;
         $1666 = ($1660|0)!=($1665|0);
         if ($1666) {
          $531 = $539;
          $532 = $1658;
          $533 = 1;
          $525 = $1658;
          $1667 = $525;
          $1668 = ((($1667)) + 8|0);
          $524 = $1668;
          $1669 = $524;
          $523 = $1669;
          $1670 = $523;
          $1671 = ((($1658)) + 4|0);
          $1672 = HEAP32[$1671>>2]|0;
          $526 = $1672;
          $1673 = $526;
          $1674 = $538;
          $527 = $1670;
          $528 = $1673;
          $529 = $1674;
          $1675 = $528;
          $1676 = $529;
          $1677 = HEAP32[$1676>>2]|0;
          HEAP32[$1675>>2] = $1677;
          $530 = $539;
          $1678 = ((($1658)) + 4|0);
          $1679 = HEAP32[$1678>>2]|0;
          $1680 = ((($1679)) + 4|0);
          HEAP32[$1678>>2] = $1680;
         } else {
          $1681 = $538;
          __THREW__ = 0;
          invoke_vii(43,($1658|0),($1681|0));
          $1682 = __THREW__; __THREW__ = 0;
          $1683 = $1682&1;
          if ($1683) {
           label = 28;
           break L1;
          }
         }
         HEAP32[$873>>2] = 0;
         $520 = $843;
         $521 = $873;
         $1684 = $520;
         $1685 = ((($1684)) + 4|0);
         $1686 = HEAP32[$1685>>2]|0;
         $519 = $1684;
         $1687 = $519;
         $1688 = ((($1687)) + 8|0);
         $518 = $1688;
         $1689 = $518;
         $517 = $1689;
         $1690 = $517;
         $1691 = HEAP32[$1690>>2]|0;
         $1692 = ($1686|0)!=($1691|0);
         if ($1692) {
          $514 = $522;
          $515 = $1684;
          $516 = 1;
          $508 = $1684;
          $1693 = $508;
          $1694 = ((($1693)) + 8|0);
          $507 = $1694;
          $1695 = $507;
          $506 = $1695;
          $1696 = $506;
          $1697 = ((($1684)) + 4|0);
          $1698 = HEAP32[$1697>>2]|0;
          $509 = $1698;
          $1699 = $509;
          $1700 = $521;
          $510 = $1696;
          $511 = $1699;
          $512 = $1700;
          $1701 = $511;
          $1702 = $512;
          $1703 = HEAP32[$1702>>2]|0;
          HEAP32[$1701>>2] = $1703;
          $513 = $522;
          $1704 = ((($1684)) + 4|0);
          $1705 = HEAP32[$1704>>2]|0;
          $1706 = ((($1705)) + 4|0);
          HEAP32[$1704>>2] = $1706;
         } else {
          $1707 = $521;
          __THREW__ = 0;
          invoke_vii(43,($1684|0),($1707|0));
          $1708 = __THREW__; __THREW__ = 0;
          $1709 = $1708&1;
          if ($1709) {
           label = 28;
           break L1;
          }
         }
         $849 = 0;
         break;
        }
        $1710 = $824;
        $1711 = HEAP32[$831>>2]|0;
        $1712 = (($1710) + ($1711<<3)|0);
        $1713 = HEAP32[$833>>2]|0;
        $1714 = HEAP32[$831>>2]|0;
        $1715 = (($1713) - ($1714))|0;
        __THREW__ = 0;
        $1716 = (invoke_iiii(50,($913|0),($1712|0),($1715|0))|0);
        $1717 = __THREW__; __THREW__ = 0;
        $1718 = $1717&1;
        if ($1718) {
         label = 28;
         break L1;
        }
        $874 = $1716;
        $1719 = $874;
        $1720 = ($1719|0)!=(-1);
        do {
         if ($1720) {
          $1721 = HEAP32[$831>>2]|0;
          $1722 = $874;
          $1723 = (($1722) + ($1721))|0;
          $874 = $1723;
          $1724 = $874;
          $1725 = HEAP32[$831>>2]|0;
          $1726 = (($1724) - ($1725))|0;
          $1727 = HEAP32[$833>>2]|0;
          $1728 = HEAP32[$831>>2]|0;
          $1729 = (($1727) - ($1728))|0;
          $1730 = (($1729|0) / 2)&-1;
          $1731 = (($1726) - ($1730))|0;
          $1732 = (Math_abs(($1731|0))|0);
          $1733 = HEAP32[$832>>2]|0;
          $1734 = HEAP32[$831>>2]|0;
          $1735 = (($1733) - ($1734))|0;
          $1736 = HEAP32[$833>>2]|0;
          $1737 = HEAP32[$831>>2]|0;
          $1738 = (($1736) - ($1737))|0;
          $1739 = (($1738|0) / 2)&-1;
          $1740 = (($1735) - ($1739))|0;
          $1741 = (Math_abs(($1740|0))|0);
          $1742 = ($1732|0)<($1741|0);
          if (!($1742)) {
           break;
          }
          $1743 = $874;
          HEAP32[$832>>2] = $1743;
         }
        } while(0);
        $1744 = $834;
        $1745 = (($1744) + 1)|0;
        $834 = $1745;
        $503 = $843;
        $504 = $831;
        $1746 = $503;
        $1747 = ((($1746)) + 4|0);
        $1748 = HEAP32[$1747>>2]|0;
        $502 = $1746;
        $1749 = $502;
        $1750 = ((($1749)) + 8|0);
        $501 = $1750;
        $1751 = $501;
        $500 = $1751;
        $1752 = $500;
        $1753 = HEAP32[$1752>>2]|0;
        $1754 = ($1748|0)!=($1753|0);
        if ($1754) {
         $497 = $505;
         $498 = $1746;
         $499 = 1;
         $491 = $1746;
         $1755 = $491;
         $1756 = ((($1755)) + 8|0);
         $490 = $1756;
         $1757 = $490;
         $489 = $1757;
         $1758 = $489;
         $1759 = ((($1746)) + 4|0);
         $1760 = HEAP32[$1759>>2]|0;
         $492 = $1760;
         $1761 = $492;
         $1762 = $504;
         $493 = $1758;
         $494 = $1761;
         $495 = $1762;
         $1763 = $494;
         $1764 = $495;
         $1765 = HEAP32[$1764>>2]|0;
         HEAP32[$1763>>2] = $1765;
         $496 = $505;
         $1766 = ((($1746)) + 4|0);
         $1767 = HEAP32[$1766>>2]|0;
         $1768 = ((($1767)) + 4|0);
         HEAP32[$1766>>2] = $1768;
        } else {
         $1769 = $504;
         __THREW__ = 0;
         invoke_vii(43,($1746|0),($1769|0));
         $1770 = __THREW__; __THREW__ = 0;
         $1771 = $1770&1;
         if ($1771) {
          label = 28;
          break L1;
         }
        }
        $486 = $843;
        $487 = $832;
        $1772 = $486;
        $1773 = ((($1772)) + 4|0);
        $1774 = HEAP32[$1773>>2]|0;
        $485 = $1772;
        $1775 = $485;
        $1776 = ((($1775)) + 8|0);
        $484 = $1776;
        $1777 = $484;
        $483 = $1777;
        $1778 = $483;
        $1779 = HEAP32[$1778>>2]|0;
        $1780 = ($1774|0)!=($1779|0);
        if ($1780) {
         $480 = $488;
         $481 = $1772;
         $482 = 1;
         $474 = $1772;
         $1781 = $474;
         $1782 = ((($1781)) + 8|0);
         $473 = $1782;
         $1783 = $473;
         $472 = $1783;
         $1784 = $472;
         $1785 = ((($1772)) + 4|0);
         $1786 = HEAP32[$1785>>2]|0;
         $475 = $1786;
         $1787 = $475;
         $1788 = $487;
         $476 = $1784;
         $477 = $1787;
         $478 = $1788;
         $1789 = $477;
         $1790 = $478;
         $1791 = HEAP32[$1790>>2]|0;
         HEAP32[$1789>>2] = $1791;
         $479 = $488;
         $1792 = ((($1772)) + 4|0);
         $1793 = HEAP32[$1792>>2]|0;
         $1794 = ((($1793)) + 4|0);
         HEAP32[$1792>>2] = $1794;
        } else {
         $1795 = $487;
         __THREW__ = 0;
         invoke_vii(43,($1772|0),($1795|0));
         $1796 = __THREW__; __THREW__ = 0;
         $1797 = $1796&1;
         if ($1797) {
          label = 28;
          break L1;
         }
        }
        $469 = $843;
        $470 = $833;
        $1798 = $469;
        $1799 = ((($1798)) + 4|0);
        $1800 = HEAP32[$1799>>2]|0;
        $468 = $1798;
        $1801 = $468;
        $1802 = ((($1801)) + 8|0);
        $467 = $1802;
        $1803 = $467;
        $466 = $1803;
        $1804 = $466;
        $1805 = HEAP32[$1804>>2]|0;
        $1806 = ($1800|0)!=($1805|0);
        if ($1806) {
         $463 = $471;
         $464 = $1798;
         $465 = 1;
         $457 = $1798;
         $1807 = $457;
         $1808 = ((($1807)) + 8|0);
         $456 = $1808;
         $1809 = $456;
         $455 = $1809;
         $1810 = $455;
         $1811 = ((($1798)) + 4|0);
         $1812 = HEAP32[$1811>>2]|0;
         $458 = $1812;
         $1813 = $458;
         $1814 = $470;
         $459 = $1810;
         $460 = $1813;
         $461 = $1814;
         $1815 = $460;
         $1816 = $461;
         $1817 = HEAP32[$1816>>2]|0;
         HEAP32[$1815>>2] = $1817;
         $462 = $471;
         $1818 = ((($1798)) + 4|0);
         $1819 = HEAP32[$1818>>2]|0;
         $1820 = ((($1819)) + 4|0);
         HEAP32[$1818>>2] = $1820;
         break;
        } else {
         $1821 = $470;
         __THREW__ = 0;
         invoke_vii(43,($1798|0),($1821|0));
         $1822 = __THREW__; __THREW__ = 0;
         $1823 = $1822&1;
         if ($1823) {
          label = 28;
          break L1;
         } else {
          break;
         }
        }
       } else {
        HEAP32[$875>>2] = 0;
        $452 = $843;
        $453 = $875;
        $1824 = $452;
        $1825 = ((($1824)) + 4|0);
        $1826 = HEAP32[$1825>>2]|0;
        $451 = $1824;
        $1827 = $451;
        $1828 = ((($1827)) + 8|0);
        $450 = $1828;
        $1829 = $450;
        $449 = $1829;
        $1830 = $449;
        $1831 = HEAP32[$1830>>2]|0;
        $1832 = ($1826|0)!=($1831|0);
        if ($1832) {
         $446 = $454;
         $447 = $1824;
         $448 = 1;
         $440 = $1824;
         $1833 = $440;
         $1834 = ((($1833)) + 8|0);
         $439 = $1834;
         $1835 = $439;
         $438 = $1835;
         $1836 = $438;
         $1837 = ((($1824)) + 4|0);
         $1838 = HEAP32[$1837>>2]|0;
         $441 = $1838;
         $1839 = $441;
         $1840 = $453;
         $442 = $1836;
         $443 = $1839;
         $444 = $1840;
         $1841 = $443;
         $1842 = $444;
         $1843 = HEAP32[$1842>>2]|0;
         HEAP32[$1841>>2] = $1843;
         $445 = $454;
         $1844 = ((($1824)) + 4|0);
         $1845 = HEAP32[$1844>>2]|0;
         $1846 = ((($1845)) + 4|0);
         HEAP32[$1844>>2] = $1846;
        } else {
         $1847 = $453;
         __THREW__ = 0;
         invoke_vii(43,($1824|0),($1847|0));
         $1848 = __THREW__; __THREW__ = 0;
         $1849 = $1848&1;
         if ($1849) {
          label = 28;
          break L1;
         }
        }
        HEAP32[$876>>2] = 0;
        $435 = $843;
        $436 = $876;
        $1850 = $435;
        $1851 = ((($1850)) + 4|0);
        $1852 = HEAP32[$1851>>2]|0;
        $434 = $1850;
        $1853 = $434;
        $1854 = ((($1853)) + 8|0);
        $433 = $1854;
        $1855 = $433;
        $432 = $1855;
        $1856 = $432;
        $1857 = HEAP32[$1856>>2]|0;
        $1858 = ($1852|0)!=($1857|0);
        if ($1858) {
         $429 = $437;
         $430 = $1850;
         $431 = 1;
         $423 = $1850;
         $1859 = $423;
         $1860 = ((($1859)) + 8|0);
         $422 = $1860;
         $1861 = $422;
         $421 = $1861;
         $1862 = $421;
         $1863 = ((($1850)) + 4|0);
         $1864 = HEAP32[$1863>>2]|0;
         $424 = $1864;
         $1865 = $424;
         $1866 = $436;
         $425 = $1862;
         $426 = $1865;
         $427 = $1866;
         $1867 = $426;
         $1868 = $427;
         $1869 = HEAP32[$1868>>2]|0;
         HEAP32[$1867>>2] = $1869;
         $428 = $437;
         $1870 = ((($1850)) + 4|0);
         $1871 = HEAP32[$1870>>2]|0;
         $1872 = ((($1871)) + 4|0);
         HEAP32[$1870>>2] = $1872;
        } else {
         $1873 = $436;
         __THREW__ = 0;
         invoke_vii(43,($1850|0),($1873|0));
         $1874 = __THREW__; __THREW__ = 0;
         $1875 = $1874&1;
         if ($1875) {
          label = 28;
          break L1;
         }
        }
        HEAP32[$877>>2] = 0;
        $418 = $843;
        $419 = $877;
        $1876 = $418;
        $1877 = ((($1876)) + 4|0);
        $1878 = HEAP32[$1877>>2]|0;
        $417 = $1876;
        $1879 = $417;
        $1880 = ((($1879)) + 8|0);
        $416 = $1880;
        $1881 = $416;
        $415 = $1881;
        $1882 = $415;
        $1883 = HEAP32[$1882>>2]|0;
        $1884 = ($1878|0)!=($1883|0);
        if ($1884) {
         $412 = $420;
         $413 = $1876;
         $414 = 1;
         $406 = $1876;
         $1885 = $406;
         $1886 = ((($1885)) + 8|0);
         $405 = $1886;
         $1887 = $405;
         $404 = $1887;
         $1888 = $404;
         $1889 = ((($1876)) + 4|0);
         $1890 = HEAP32[$1889>>2]|0;
         $407 = $1890;
         $1891 = $407;
         $1892 = $419;
         $408 = $1888;
         $409 = $1891;
         $410 = $1892;
         $1893 = $409;
         $1894 = $410;
         $1895 = HEAP32[$1894>>2]|0;
         HEAP32[$1893>>2] = $1895;
         $411 = $420;
         $1896 = ((($1876)) + 4|0);
         $1897 = HEAP32[$1896>>2]|0;
         $1898 = ((($1897)) + 4|0);
         HEAP32[$1896>>2] = $1898;
         break;
        } else {
         $1899 = $419;
         __THREW__ = 0;
         invoke_vii(43,($1876|0),($1899|0));
         $1900 = __THREW__; __THREW__ = 0;
         $1901 = $1900&1;
         if ($1901) {
          label = 28;
          break L1;
         } else {
          break;
         }
        }
       }
      } while(0);
      HEAP32[$832>>2] = -1;
      __THREW__ = 0;
      invoke_vi(51,($839|0));
      $1902 = __THREW__; __THREW__ = 0;
      $1903 = $1902&1;
      if ($1903) {
       label = 28;
       break L1;
      }
      $1904 = $827;
      $1905 = $853;
      $1906 = $1905<<1;
      $1907 = (($1906) + 2)|0;
      $1908 = (($1904) + ($1907<<2)|0);
      $1909 = HEAP32[$1908>>2]|0;
      $1910 = HEAP32[$1909>>2]|0;
      $1911 = $827;
      $1912 = $853;
      $1913 = $1912<<1;
      $1914 = (($1913) + 1)|0;
      $1915 = (($1911) + ($1914<<2)|0);
      $1916 = HEAP32[$1915>>2]|0;
      $1917 = HEAP32[$1916>>2]|0;
      $1918 = (($1910) - ($1917))|0;
      $829 = $1918;
      $1919 = $826;
      $1920 = ((($913)) + 48|0);
      $1921 = ((($1920)) + 56|0);
      $1922 = +HEAPF64[$1921>>3];
      $1923 = $1919 * $1922;
      $1924 = $829;
      $1925 = (+($1924|0));
      $1926 = $1923 < $1925;
      if ($1926) {
       $1927 = $826;
       $1928 = ((($913)) + 48|0);
       $1929 = ((($1928)) + 56|0);
       $1930 = +HEAPF64[$1929>>3];
       $1931 = $1927 * $1930;
       $1932 = (~~(($1931)));
       $829 = $1932;
      }
      $1933 = $849;
      $1934 = $1933&1;
      if ($1934) {
       $1935 = HEAP32[$833>>2]|0;
       $1936 = $827;
       $1937 = $853;
       $1938 = $1937<<1;
       $1939 = (($1938) + 2)|0;
       $1940 = (($1936) + ($1939<<2)|0);
       $1941 = HEAP32[$1940>>2]|0;
       $1942 = HEAP32[$1941>>2]|0;
       $1943 = $829;
       $1944 = (($1942) - ($1943))|0;
       $1945 = $826;
       $1946 = 0.040000000000000001 * $1945;
       $1947 = (~~(($1946)));
       $1948 = (($1944) - ($1947))|0;
       $1949 = ($1935|0)>($1948|0);
       if ($1949) {
        $1950 = HEAP32[$833>>2]|0;
        $1951 = $827;
        $1952 = $853;
        $1953 = $1952<<1;
        $1954 = (($1953) + 2)|0;
        $1955 = (($1951) + ($1954<<2)|0);
        $1956 = HEAP32[$1955>>2]|0;
        $1957 = HEAP32[$1956>>2]|0;
        $1958 = $829;
        $1959 = (($1957) - ($1958))|0;
        $1960 = $826;
        $1961 = 0.040000000000000001 * $1960;
        $1962 = (~~(($1961)));
        $1963 = (($1959) - ($1962))|0;
        $1964 = (($1950) - ($1963))|0;
        $1965 = $829;
        $1966 = (($1965) - ($1964))|0;
        $829 = $1966;
       }
      }
      $1967 = $827;
      $1968 = $853;
      $1969 = $1968<<1;
      $1970 = (($1969) + 2)|0;
      $1971 = (($1967) + ($1970<<2)|0);
      $1972 = HEAP32[$1971>>2]|0;
      $1973 = HEAP32[$1972>>2]|0;
      $1974 = $827;
      $1975 = $853;
      $1976 = $1975<<1;
      $1977 = (($1976) + 1)|0;
      $1978 = (($1974) + ($1977<<2)|0);
      $1979 = HEAP32[$1978>>2]|0;
      $1980 = HEAP32[$1979>>2]|0;
      $1981 = (($1973) - ($1980))|0;
      $1982 = $829;
      $1983 = (($1981) - ($1982))|0;
      $878 = $1983;
      $1984 = $829;
      $1985 = (+($1984|0));
      $1986 = $826;
      $1987 = 0.029999999999999999 * $1986;
      $1988 = $1985 <= $1987;
      if ($1988) {
       HEAP32[$879>>2] = 0;
       $401 = $840;
       $402 = $879;
       $1989 = $401;
       $1990 = ((($1989)) + 4|0);
       $1991 = HEAP32[$1990>>2]|0;
       $400 = $1989;
       $1992 = $400;
       $1993 = ((($1992)) + 8|0);
       $399 = $1993;
       $1994 = $399;
       $398 = $1994;
       $1995 = $398;
       $1996 = HEAP32[$1995>>2]|0;
       $1997 = ($1991|0)!=($1996|0);
       if ($1997) {
        $395 = $403;
        $396 = $1989;
        $397 = 1;
        $389 = $1989;
        $1998 = $389;
        $1999 = ((($1998)) + 8|0);
        $388 = $1999;
        $2000 = $388;
        $387 = $2000;
        $2001 = $387;
        $2002 = ((($1989)) + 4|0);
        $2003 = HEAP32[$2002>>2]|0;
        $390 = $2003;
        $2004 = $390;
        $2005 = $402;
        $391 = $2001;
        $392 = $2004;
        $393 = $2005;
        $2006 = $392;
        $2007 = $393;
        $2008 = HEAP32[$2007>>2]|0;
        HEAP32[$2006>>2] = $2008;
        $394 = $403;
        $2009 = ((($1989)) + 4|0);
        $2010 = HEAP32[$2009>>2]|0;
        $2011 = ((($2010)) + 4|0);
        HEAP32[$2009>>2] = $2011;
       } else {
        $2012 = $402;
        __THREW__ = 0;
        invoke_vii(43,($1989|0),($2012|0));
        $2013 = __THREW__; __THREW__ = 0;
        $2014 = $2013&1;
        if ($2014) {
         label = 28;
         break L1;
        }
       }
       HEAP32[$880>>2] = 0;
       $384 = $840;
       $385 = $880;
       $2015 = $384;
       $2016 = ((($2015)) + 4|0);
       $2017 = HEAP32[$2016>>2]|0;
       $383 = $2015;
       $2018 = $383;
       $2019 = ((($2018)) + 8|0);
       $382 = $2019;
       $2020 = $382;
       $381 = $2020;
       $2021 = $381;
       $2022 = HEAP32[$2021>>2]|0;
       $2023 = ($2017|0)!=($2022|0);
       if ($2023) {
        $378 = $386;
        $379 = $2015;
        $380 = 1;
        $372 = $2015;
        $2024 = $372;
        $2025 = ((($2024)) + 8|0);
        $371 = $2025;
        $2026 = $371;
        $370 = $2026;
        $2027 = $370;
        $2028 = ((($2015)) + 4|0);
        $2029 = HEAP32[$2028>>2]|0;
        $373 = $2029;
        $2030 = $373;
        $2031 = $385;
        $374 = $2027;
        $375 = $2030;
        $376 = $2031;
        $2032 = $375;
        $2033 = $376;
        $2034 = HEAP32[$2033>>2]|0;
        HEAP32[$2032>>2] = $2034;
        $377 = $386;
        $2035 = ((($2015)) + 4|0);
        $2036 = HEAP32[$2035>>2]|0;
        $2037 = ((($2036)) + 4|0);
        HEAP32[$2035>>2] = $2037;
       } else {
        $2038 = $385;
        __THREW__ = 0;
        invoke_vii(43,($2015|0),($2038|0));
        $2039 = __THREW__; __THREW__ = 0;
        $2040 = $2039&1;
        if ($2040) {
         label = 28;
         break L1;
        }
       }
       HEAP32[$881>>2] = 0;
       $367 = $840;
       $368 = $881;
       $2041 = $367;
       $2042 = ((($2041)) + 4|0);
       $2043 = HEAP32[$2042>>2]|0;
       $366 = $2041;
       $2044 = $366;
       $2045 = ((($2044)) + 8|0);
       $365 = $2045;
       $2046 = $365;
       $364 = $2046;
       $2047 = $364;
       $2048 = HEAP32[$2047>>2]|0;
       $2049 = ($2043|0)!=($2048|0);
       if ($2049) {
        $361 = $369;
        $362 = $2041;
        $363 = 1;
        $355 = $2041;
        $2050 = $355;
        $2051 = ((($2050)) + 8|0);
        $354 = $2051;
        $2052 = $354;
        $353 = $2052;
        $2053 = $353;
        $2054 = ((($2041)) + 4|0);
        $2055 = HEAP32[$2054>>2]|0;
        $356 = $2055;
        $2056 = $356;
        $2057 = $368;
        $357 = $2053;
        $358 = $2056;
        $359 = $2057;
        $2058 = $358;
        $2059 = $359;
        $2060 = HEAP32[$2059>>2]|0;
        HEAP32[$2058>>2] = $2060;
        $360 = $369;
        $2061 = ((($2041)) + 4|0);
        $2062 = HEAP32[$2061>>2]|0;
        $2063 = ((($2062)) + 4|0);
        HEAP32[$2061>>2] = $2063;
        break;
       } else {
        $2064 = $368;
        __THREW__ = 0;
        invoke_vii(43,($2041|0),($2064|0));
        $2065 = __THREW__; __THREW__ = 0;
        $2066 = $2065&1;
        if ($2066) {
         label = 28;
         break L1;
        } else {
         break;
        }
       }
      }
      $2067 = $829;
      $2068 = $826;
      __THREW__ = 0;
      invoke_viiidd(47,($839|0),($2067|0),6,0.0,(+$2068));
      $2069 = __THREW__; __THREW__ = 0;
      $2070 = $2069&1;
      if ($2070) {
       label = 28;
       break L1;
      }
      $2071 = $824;
      $2072 = $830;
      $2073 = (($2071) + ($2072<<3)|0);
      $2074 = $878;
      $2075 = (($2073) + ($2074<<3)|0);
      $2076 = ((($913)) + 48|0);
      $2077 = ((($2076)) + 80|0);
      $2078 = +HEAPF64[$2077>>3];
      __THREW__ = 0;
      $2079 = (invoke_iiididd(48,($839|0),($2075|0),(+$2078),1,0.0,0.0)|0);
      $2080 = __THREW__; __THREW__ = 0;
      $2081 = $2080&1;
      if ($2081) {
       label = 28;
       break L1;
      }
      $844 = $2079;
      $2082 = $844;
      $2083 = $829;
      __THREW__ = 0;
      invoke_viiiii(49,($913|0),($2082|0),($2083|0),($845|0),($846|0));
      $2084 = __THREW__; __THREW__ = 0;
      $2085 = $2084&1;
      if ($2085) {
       label = 28;
       break L1;
      }
      $882 = 0;
      while(1) {
       $2086 = $882;
       $2087 = $829;
       $2088 = ($2086|0)<($2087|0);
       if (!($2088)) {
        break;
       }
       $2089 = $844;
       $2090 = $882;
       $2091 = (($2089) + ($2090<<3)|0);
       $2092 = +HEAPF64[$2091>>3];
       $2093 = +HEAPF64[$845>>3];
       $2094 = $2092 == $2093;
       if ($2094) {
        $2095 = $882;
        $2096 = $830;
        $2097 = (($2095) + ($2096))|0;
        $2098 = $878;
        $2099 = (($2097) + ($2098))|0;
        HEAP32[$835>>2] = $2099;
       }
       $2100 = $844;
       $2101 = $882;
       $2102 = (($2100) + ($2101<<3)|0);
       $2103 = +HEAPF64[$2102>>3];
       $2104 = +HEAPF64[$846>>3];
       $2105 = $2103 == $2104;
       if ($2105) {
        $2106 = $882;
        $2107 = $830;
        $2108 = (($2106) + ($2107))|0;
        $2109 = $878;
        $2110 = (($2108) + ($2109))|0;
        HEAP32[$837>>2] = $2110;
       }
       $2111 = $882;
       $2112 = (($2111) + 1)|0;
       $882 = $2112;
      }
      $2113 = HEAP32[$835>>2]|0;
      $2114 = HEAP32[$837>>2]|0;
      $2115 = ($2113|0)>($2114|0);
      if ($2115) {
       $350 = $835;
       $351 = $837;
       $2116 = $350;
       $349 = $2116;
       $2117 = $349;
       $2118 = HEAP32[$2117>>2]|0;
       HEAP32[$352>>2] = $2118;
       $2119 = $351;
       $347 = $2119;
       $2120 = $347;
       $2121 = HEAP32[$2120>>2]|0;
       $2122 = $350;
       HEAP32[$2122>>2] = $2121;
       $348 = $352;
       $2123 = $348;
       $2124 = HEAP32[$2123>>2]|0;
       $2125 = $351;
       HEAP32[$2125>>2] = $2124;
      }
      $850 = 0;
      $2126 = $844;
      $2127 = HEAP32[$835>>2]|0;
      $2128 = $830;
      $2129 = (($2127) - ($2128))|0;
      $2130 = $878;
      $2131 = (($2129) - ($2130))|0;
      $2132 = (($2126) + ($2131<<3)|0);
      $2133 = +HEAPF64[$2132>>3];
      $2134 = $2133 < 0.0;
      if ($2134) {
       $2135 = $844;
       $2136 = HEAP32[$837>>2]|0;
       $2137 = $830;
       $2138 = (($2136) - ($2137))|0;
       $2139 = $878;
       $2140 = (($2138) - ($2139))|0;
       $2141 = (($2135) + ($2140<<3)|0);
       $2142 = +HEAPF64[$2141>>3];
       $2143 = $2142 > 0.0;
       if ($2143) {
        label = 159;
       } else {
        label = 157;
       }
      } else {
       label = 157;
      }
      do {
       if ((label|0) == 157) {
        label = 0;
        $2144 = $844;
        $2145 = HEAP32[$835>>2]|0;
        $2146 = $830;
        $2147 = (($2145) - ($2146))|0;
        $2148 = $878;
        $2149 = (($2147) - ($2148))|0;
        $2150 = (($2144) + ($2149<<3)|0);
        $2151 = +HEAPF64[$2150>>3];
        $2152 = $2151 > 0.0;
        if (!($2152)) {
         break;
        }
        $2153 = $844;
        $2154 = HEAP32[$837>>2]|0;
        $2155 = $830;
        $2156 = (($2154) - ($2155))|0;
        $2157 = $878;
        $2158 = (($2156) - ($2157))|0;
        $2159 = (($2153) + ($2158<<3)|0);
        $2160 = +HEAPF64[$2159>>3];
        $2161 = $2160 < 0.0;
        if ($2161) {
         label = 159;
        }
       }
      } while(0);
      if ((label|0) == 159) {
       label = 0;
       $850 = 1;
      }
      $2162 = $850;
      $2163 = $2162&1;
      L193: do {
       if ($2163) {
        $2164 = HEAP32[$837>>2]|0;
        $2165 = HEAP32[$835>>2]|0;
        $2166 = (($2164) - ($2165))|0;
        $2167 = (+($2166|0));
        $2168 = $826;
        $2169 = 0.029999999999999999 * $2168;
        $2170 = $2167 >= $2169;
        do {
         if ($2170) {
          $2171 = HEAP32[$837>>2]|0;
          $2172 = HEAP32[$835>>2]|0;
          $2173 = (($2171) - ($2172))|0;
          $2174 = (+($2173|0));
          $2175 = $826;
          $2176 = 0.14999999999999999 * $2175;
          $2177 = $2174 <= $2176;
          if (!($2177)) {
           break;
          }
          $850 = 1;
          $2178 = $827;
          $2179 = $853;
          $2180 = $2179<<1;
          $2181 = (($2180) + 2)|0;
          $2182 = (($2178) + ($2181<<2)|0);
          $2183 = HEAP32[$2182>>2]|0;
          $2184 = HEAP32[$2183>>2]|0;
          $2185 = HEAP32[$835>>2]|0;
          $2186 = (($2184) - ($2185))|0;
          $2187 = (+($2186|0));
          $2188 = ((($913)) + 48|0);
          $2189 = ((($2188)) + 48|0);
          $2190 = +HEAPF64[$2189>>3];
          $2191 = $826;
          $2192 = $2190 * $2191;
          $2193 = $2187 >= $2192;
          do {
           if ($2193) {
            $2194 = $827;
            $2195 = $853;
            $2196 = $2195<<1;
            $2197 = (($2196) + 2)|0;
            $2198 = (($2194) + ($2197<<2)|0);
            $2199 = HEAP32[$2198>>2]|0;
            $2200 = HEAP32[$2199>>2]|0;
            $2201 = HEAP32[$835>>2]|0;
            $2202 = (($2200) - ($2201))|0;
            $2203 = (+($2202|0));
            $2204 = ((($913)) + 48|0);
            $2205 = ((($2204)) + 56|0);
            $2206 = +HEAPF64[$2205>>3];
            $2207 = $826;
            $2208 = $2206 * $2207;
            $2209 = $2203 <= $2208;
            if (!($2209)) {
             break;
            }
            $850 = 1;
            break L193;
           }
          } while(0);
          $850 = 0;
          break L193;
         }
        } while(0);
        $850 = 0;
       }
      } while(0);
      $2210 = $850;
      $2211 = $2210&1;
      do {
       if ($2211) {
        $2212 = $844;
        $2213 = HEAP32[$835>>2]|0;
        $2214 = $830;
        $2215 = (($2213) - ($2214))|0;
        $2216 = $878;
        $2217 = (($2215) - ($2216))|0;
        $2218 = (($2212) + ($2217<<3)|0);
        $2219 = +HEAPF64[$2218>>3];
        $2220 = $2219 > 0.0;
        if ($2220) {
         $848 = 1;
        } else {
         $848 = 0;
        }
        $2221 = HEAP32[$835>>2]|0;
        $2222 = $830;
        $2223 = (($2221) - ($2222))|0;
        $2224 = $878;
        $2225 = (($2223) - ($2224))|0;
        $883 = $2225;
        while(1) {
         $2226 = $883;
         $2227 = HEAP32[$837>>2]|0;
         $2228 = $830;
         $2229 = (($2227) - ($2228))|0;
         $2230 = $878;
         $2231 = (($2229) - ($2230))|0;
         $2232 = ($2226|0)<($2231|0);
         if (!($2232)) {
          break;
         }
         $2233 = $848;
         $2234 = $2233&1;
         $2235 = $844;
         $2236 = $883;
         $2237 = (($2235) + ($2236<<3)|0);
         $2238 = +HEAPF64[$2237>>3];
         if ($2234) {
          $2239 = $2238 > 0.0;
          if (!($2239)) {
           label = 177;
           break;
          }
         } else {
          $2240 = $2238 < 0.0;
          if (!($2240)) {
           label = 177;
           break;
          }
         }
         $2246 = $883;
         $2247 = (($2246) + 1)|0;
         $883 = $2247;
        }
        if ((label|0) == 177) {
         label = 0;
         $2241 = $883;
         $2242 = $830;
         $2243 = (($2241) + ($2242))|0;
         $2244 = $878;
         $2245 = (($2243) + ($2244))|0;
         HEAP32[$836>>2] = $2245;
        }
        $2248 = HEAP32[$837>>2]|0;
        $2249 = HEAP32[$836>>2]|0;
        $2250 = (($2248) - ($2249))|0;
        $2251 = HEAP32[$836>>2]|0;
        $2252 = HEAP32[$835>>2]|0;
        $2253 = (($2251) - ($2252))|0;
        $2254 = ($2250|0)<($2253|0);
        if ($2254) {
         $2255 = HEAP32[$837>>2]|0;
         $2256 = HEAP32[$836>>2]|0;
         $2257 = (($2255) - ($2256))|0;
         $2258 = (+($2257|0));
         $2259 = HEAP32[$836>>2]|0;
         $2260 = HEAP32[$835>>2]|0;
         $2261 = (($2259) - ($2260))|0;
         $2262 = (+($2261|0));
         $2263 = $2258 / $2262;
         $884 = $2263;
        } else {
         $2264 = HEAP32[$836>>2]|0;
         $2265 = HEAP32[$835>>2]|0;
         $2266 = (($2264) - ($2265))|0;
         $2267 = (+($2266|0));
         $2268 = HEAP32[$837>>2]|0;
         $2269 = HEAP32[$836>>2]|0;
         $2270 = (($2268) - ($2269))|0;
         $2271 = (+($2270|0));
         $2272 = $2267 / $2271;
         $884 = $2272;
        }
        $2273 = $884;
        $2274 = $2273 < 0.40000000596046448;
        if ($2274) {
         HEAP32[$885>>2] = 0;
         $344 = $840;
         $345 = $885;
         $2275 = $344;
         $2276 = ((($2275)) + 4|0);
         $2277 = HEAP32[$2276>>2]|0;
         $343 = $2275;
         $2278 = $343;
         $2279 = ((($2278)) + 8|0);
         $342 = $2279;
         $2280 = $342;
         $341 = $2280;
         $2281 = $341;
         $2282 = HEAP32[$2281>>2]|0;
         $2283 = ($2277|0)!=($2282|0);
         if ($2283) {
          $338 = $346;
          $339 = $2275;
          $340 = 1;
          $332 = $2275;
          $2284 = $332;
          $2285 = ((($2284)) + 8|0);
          $331 = $2285;
          $2286 = $331;
          $330 = $2286;
          $2287 = $330;
          $2288 = ((($2275)) + 4|0);
          $2289 = HEAP32[$2288>>2]|0;
          $333 = $2289;
          $2290 = $333;
          $2291 = $345;
          $334 = $2287;
          $335 = $2290;
          $336 = $2291;
          $2292 = $335;
          $2293 = $336;
          $2294 = HEAP32[$2293>>2]|0;
          HEAP32[$2292>>2] = $2294;
          $337 = $346;
          $2295 = ((($2275)) + 4|0);
          $2296 = HEAP32[$2295>>2]|0;
          $2297 = ((($2296)) + 4|0);
          HEAP32[$2295>>2] = $2297;
         } else {
          $2298 = $345;
          __THREW__ = 0;
          invoke_vii(43,($2275|0),($2298|0));
          $2299 = __THREW__; __THREW__ = 0;
          $2300 = $2299&1;
          if ($2300) {
           label = 28;
           break L1;
          }
         }
         HEAP32[$886>>2] = 0;
         $327 = $840;
         $328 = $886;
         $2301 = $327;
         $2302 = ((($2301)) + 4|0);
         $2303 = HEAP32[$2302>>2]|0;
         $326 = $2301;
         $2304 = $326;
         $2305 = ((($2304)) + 8|0);
         $325 = $2305;
         $2306 = $325;
         $324 = $2306;
         $2307 = $324;
         $2308 = HEAP32[$2307>>2]|0;
         $2309 = ($2303|0)!=($2308|0);
         if ($2309) {
          $321 = $329;
          $322 = $2301;
          $323 = 1;
          $315 = $2301;
          $2310 = $315;
          $2311 = ((($2310)) + 8|0);
          $314 = $2311;
          $2312 = $314;
          $313 = $2312;
          $2313 = $313;
          $2314 = ((($2301)) + 4|0);
          $2315 = HEAP32[$2314>>2]|0;
          $316 = $2315;
          $2316 = $316;
          $2317 = $328;
          $317 = $2313;
          $318 = $2316;
          $319 = $2317;
          $2318 = $318;
          $2319 = $319;
          $2320 = HEAP32[$2319>>2]|0;
          HEAP32[$2318>>2] = $2320;
          $320 = $329;
          $2321 = ((($2301)) + 4|0);
          $2322 = HEAP32[$2321>>2]|0;
          $2323 = ((($2322)) + 4|0);
          HEAP32[$2321>>2] = $2323;
         } else {
          $2324 = $328;
          __THREW__ = 0;
          invoke_vii(43,($2301|0),($2324|0));
          $2325 = __THREW__; __THREW__ = 0;
          $2326 = $2325&1;
          if ($2326) {
           label = 28;
           break L1;
          }
         }
         HEAP32[$887>>2] = 0;
         $310 = $840;
         $311 = $887;
         $2327 = $310;
         $2328 = ((($2327)) + 4|0);
         $2329 = HEAP32[$2328>>2]|0;
         $309 = $2327;
         $2330 = $309;
         $2331 = ((($2330)) + 8|0);
         $308 = $2331;
         $2332 = $308;
         $307 = $2332;
         $2333 = $307;
         $2334 = HEAP32[$2333>>2]|0;
         $2335 = ($2329|0)!=($2334|0);
         if ($2335) {
          $304 = $312;
          $305 = $2327;
          $306 = 1;
          $298 = $2327;
          $2336 = $298;
          $2337 = ((($2336)) + 8|0);
          $297 = $2337;
          $2338 = $297;
          $296 = $2338;
          $2339 = $296;
          $2340 = ((($2327)) + 4|0);
          $2341 = HEAP32[$2340>>2]|0;
          $299 = $2341;
          $2342 = $299;
          $2343 = $311;
          $300 = $2339;
          $301 = $2342;
          $302 = $2343;
          $2344 = $301;
          $2345 = $302;
          $2346 = HEAP32[$2345>>2]|0;
          HEAP32[$2344>>2] = $2346;
          $303 = $312;
          $2347 = ((($2327)) + 4|0);
          $2348 = HEAP32[$2347>>2]|0;
          $2349 = ((($2348)) + 4|0);
          HEAP32[$2347>>2] = $2349;
          break;
         } else {
          $2350 = $311;
          __THREW__ = 0;
          invoke_vii(43,($2327|0),($2350|0));
          $2351 = __THREW__; __THREW__ = 0;
          $2352 = $2351&1;
          if ($2352) {
           label = 28;
           break L1;
          } else {
           break;
          }
         }
        } else {
         $2353 = $838;
         $2354 = (($2353) + 1)|0;
         $838 = $2354;
         $293 = $840;
         $294 = $835;
         $2355 = $293;
         $2356 = ((($2355)) + 4|0);
         $2357 = HEAP32[$2356>>2]|0;
         $292 = $2355;
         $2358 = $292;
         $2359 = ((($2358)) + 8|0);
         $291 = $2359;
         $2360 = $291;
         $290 = $2360;
         $2361 = $290;
         $2362 = HEAP32[$2361>>2]|0;
         $2363 = ($2357|0)!=($2362|0);
         if ($2363) {
          $287 = $295;
          $288 = $2355;
          $289 = 1;
          $281 = $2355;
          $2364 = $281;
          $2365 = ((($2364)) + 8|0);
          $280 = $2365;
          $2366 = $280;
          $279 = $2366;
          $2367 = $279;
          $2368 = ((($2355)) + 4|0);
          $2369 = HEAP32[$2368>>2]|0;
          $282 = $2369;
          $2370 = $282;
          $2371 = $294;
          $283 = $2367;
          $284 = $2370;
          $285 = $2371;
          $2372 = $284;
          $2373 = $285;
          $2374 = HEAP32[$2373>>2]|0;
          HEAP32[$2372>>2] = $2374;
          $286 = $295;
          $2375 = ((($2355)) + 4|0);
          $2376 = HEAP32[$2375>>2]|0;
          $2377 = ((($2376)) + 4|0);
          HEAP32[$2375>>2] = $2377;
         } else {
          $2378 = $294;
          __THREW__ = 0;
          invoke_vii(43,($2355|0),($2378|0));
          $2379 = __THREW__; __THREW__ = 0;
          $2380 = $2379&1;
          if ($2380) {
           label = 28;
           break L1;
          }
         }
         $276 = $840;
         $277 = $836;
         $2381 = $276;
         $2382 = ((($2381)) + 4|0);
         $2383 = HEAP32[$2382>>2]|0;
         $275 = $2381;
         $2384 = $275;
         $2385 = ((($2384)) + 8|0);
         $274 = $2385;
         $2386 = $274;
         $273 = $2386;
         $2387 = $273;
         $2388 = HEAP32[$2387>>2]|0;
         $2389 = ($2383|0)!=($2388|0);
         if ($2389) {
          $270 = $278;
          $271 = $2381;
          $272 = 1;
          $264 = $2381;
          $2390 = $264;
          $2391 = ((($2390)) + 8|0);
          $263 = $2391;
          $2392 = $263;
          $262 = $2392;
          $2393 = $262;
          $2394 = ((($2381)) + 4|0);
          $2395 = HEAP32[$2394>>2]|0;
          $265 = $2395;
          $2396 = $265;
          $2397 = $277;
          $266 = $2393;
          $267 = $2396;
          $268 = $2397;
          $2398 = $267;
          $2399 = $268;
          $2400 = HEAP32[$2399>>2]|0;
          HEAP32[$2398>>2] = $2400;
          $269 = $278;
          $2401 = ((($2381)) + 4|0);
          $2402 = HEAP32[$2401>>2]|0;
          $2403 = ((($2402)) + 4|0);
          HEAP32[$2401>>2] = $2403;
         } else {
          $2404 = $277;
          __THREW__ = 0;
          invoke_vii(43,($2381|0),($2404|0));
          $2405 = __THREW__; __THREW__ = 0;
          $2406 = $2405&1;
          if ($2406) {
           label = 28;
           break L1;
          }
         }
         $259 = $840;
         $260 = $837;
         $2407 = $259;
         $2408 = ((($2407)) + 4|0);
         $2409 = HEAP32[$2408>>2]|0;
         $258 = $2407;
         $2410 = $258;
         $2411 = ((($2410)) + 8|0);
         $257 = $2411;
         $2412 = $257;
         $256 = $2412;
         $2413 = $256;
         $2414 = HEAP32[$2413>>2]|0;
         $2415 = ($2409|0)!=($2414|0);
         if ($2415) {
          $253 = $261;
          $254 = $2407;
          $255 = 1;
          $247 = $2407;
          $2416 = $247;
          $2417 = ((($2416)) + 8|0);
          $246 = $2417;
          $2418 = $246;
          $245 = $2418;
          $2419 = $245;
          $2420 = ((($2407)) + 4|0);
          $2421 = HEAP32[$2420>>2]|0;
          $248 = $2421;
          $2422 = $248;
          $2423 = $260;
          $249 = $2419;
          $250 = $2422;
          $251 = $2423;
          $2424 = $250;
          $2425 = $251;
          $2426 = HEAP32[$2425>>2]|0;
          HEAP32[$2424>>2] = $2426;
          $252 = $261;
          $2427 = ((($2407)) + 4|0);
          $2428 = HEAP32[$2427>>2]|0;
          $2429 = ((($2428)) + 4|0);
          HEAP32[$2427>>2] = $2429;
          break;
         } else {
          $2430 = $260;
          __THREW__ = 0;
          invoke_vii(43,($2407|0),($2430|0));
          $2431 = __THREW__; __THREW__ = 0;
          $2432 = $2431&1;
          if ($2432) {
           label = 28;
           break L1;
          } else {
           break;
          }
         }
        }
       } else {
        HEAP32[$888>>2] = 0;
        $242 = $840;
        $243 = $888;
        $2433 = $242;
        $2434 = ((($2433)) + 4|0);
        $2435 = HEAP32[$2434>>2]|0;
        $241 = $2433;
        $2436 = $241;
        $2437 = ((($2436)) + 8|0);
        $240 = $2437;
        $2438 = $240;
        $239 = $2438;
        $2439 = $239;
        $2440 = HEAP32[$2439>>2]|0;
        $2441 = ($2435|0)!=($2440|0);
        if ($2441) {
         $236 = $244;
         $237 = $2433;
         $238 = 1;
         $230 = $2433;
         $2442 = $230;
         $2443 = ((($2442)) + 8|0);
         $229 = $2443;
         $2444 = $229;
         $228 = $2444;
         $2445 = $228;
         $2446 = ((($2433)) + 4|0);
         $2447 = HEAP32[$2446>>2]|0;
         $231 = $2447;
         $2448 = $231;
         $2449 = $243;
         $232 = $2445;
         $233 = $2448;
         $234 = $2449;
         $2450 = $233;
         $2451 = $234;
         $2452 = HEAP32[$2451>>2]|0;
         HEAP32[$2450>>2] = $2452;
         $235 = $244;
         $2453 = ((($2433)) + 4|0);
         $2454 = HEAP32[$2453>>2]|0;
         $2455 = ((($2454)) + 4|0);
         HEAP32[$2453>>2] = $2455;
        } else {
         $2456 = $243;
         __THREW__ = 0;
         invoke_vii(43,($2433|0),($2456|0));
         $2457 = __THREW__; __THREW__ = 0;
         $2458 = $2457&1;
         if ($2458) {
          label = 28;
          break L1;
         }
        }
        HEAP32[$889>>2] = 0;
        $225 = $840;
        $226 = $889;
        $2459 = $225;
        $2460 = ((($2459)) + 4|0);
        $2461 = HEAP32[$2460>>2]|0;
        $224 = $2459;
        $2462 = $224;
        $2463 = ((($2462)) + 8|0);
        $223 = $2463;
        $2464 = $223;
        $222 = $2464;
        $2465 = $222;
        $2466 = HEAP32[$2465>>2]|0;
        $2467 = ($2461|0)!=($2466|0);
        if ($2467) {
         $219 = $227;
         $220 = $2459;
         $221 = 1;
         $213 = $2459;
         $2468 = $213;
         $2469 = ((($2468)) + 8|0);
         $212 = $2469;
         $2470 = $212;
         $211 = $2470;
         $2471 = $211;
         $2472 = ((($2459)) + 4|0);
         $2473 = HEAP32[$2472>>2]|0;
         $214 = $2473;
         $2474 = $214;
         $2475 = $226;
         $215 = $2471;
         $216 = $2474;
         $217 = $2475;
         $2476 = $216;
         $2477 = $217;
         $2478 = HEAP32[$2477>>2]|0;
         HEAP32[$2476>>2] = $2478;
         $218 = $227;
         $2479 = ((($2459)) + 4|0);
         $2480 = HEAP32[$2479>>2]|0;
         $2481 = ((($2480)) + 4|0);
         HEAP32[$2479>>2] = $2481;
        } else {
         $2482 = $226;
         __THREW__ = 0;
         invoke_vii(43,($2459|0),($2482|0));
         $2483 = __THREW__; __THREW__ = 0;
         $2484 = $2483&1;
         if ($2484) {
          label = 28;
          break L1;
         }
        }
        HEAP32[$890>>2] = 0;
        $208 = $840;
        $209 = $890;
        $2485 = $208;
        $2486 = ((($2485)) + 4|0);
        $2487 = HEAP32[$2486>>2]|0;
        $207 = $2485;
        $2488 = $207;
        $2489 = ((($2488)) + 8|0);
        $206 = $2489;
        $2490 = $206;
        $205 = $2490;
        $2491 = $205;
        $2492 = HEAP32[$2491>>2]|0;
        $2493 = ($2487|0)!=($2492|0);
        if ($2493) {
         $202 = $210;
         $203 = $2485;
         $204 = 1;
         $196 = $2485;
         $2494 = $196;
         $2495 = ((($2494)) + 8|0);
         $195 = $2495;
         $2496 = $195;
         $194 = $2496;
         $2497 = $194;
         $2498 = ((($2485)) + 4|0);
         $2499 = HEAP32[$2498>>2]|0;
         $197 = $2499;
         $2500 = $197;
         $2501 = $209;
         $198 = $2497;
         $199 = $2500;
         $200 = $2501;
         $2502 = $199;
         $2503 = $200;
         $2504 = HEAP32[$2503>>2]|0;
         HEAP32[$2502>>2] = $2504;
         $201 = $210;
         $2505 = ((($2485)) + 4|0);
         $2506 = HEAP32[$2505>>2]|0;
         $2507 = ((($2506)) + 4|0);
         HEAP32[$2505>>2] = $2507;
         break;
        } else {
         $2508 = $209;
         __THREW__ = 0;
         invoke_vii(43,($2485|0),($2508|0));
         $2509 = __THREW__; __THREW__ = 0;
         $2510 = $2509&1;
         if ($2510) {
          label = 28;
          break L1;
         } else {
          break;
         }
        }
       }
      } while(0);
      HEAP32[$835>>2] = -1;
      HEAP32[$836>>2] = -1;
      HEAP32[$837>>2] = -1;
      __THREW__ = 0;
      invoke_vi(51,($839|0));
      $2511 = __THREW__; __THREW__ = 0;
      $2512 = $2511&1;
      if ($2512) {
       label = 28;
       break L1;
      } else {
       break;
      }
     }
    }
    HEAP32[$862>>2] = 0;
    $662 = $840;
    $663 = $862;
    $1213 = $662;
    $1214 = ((($1213)) + 4|0);
    $1215 = HEAP32[$1214>>2]|0;
    $661 = $1213;
    $1216 = $661;
    $1217 = ((($1216)) + 8|0);
    $660 = $1217;
    $1218 = $660;
    $659 = $1218;
    $1219 = $659;
    $1220 = HEAP32[$1219>>2]|0;
    $1221 = ($1215|0)!=($1220|0);
    if ($1221) {
     $656 = $664;
     $657 = $1213;
     $658 = 1;
     $650 = $1213;
     $1222 = $650;
     $1223 = ((($1222)) + 8|0);
     $649 = $1223;
     $1224 = $649;
     $648 = $1224;
     $1225 = $648;
     $1226 = ((($1213)) + 4|0);
     $1227 = HEAP32[$1226>>2]|0;
     $651 = $1227;
     $1228 = $651;
     $1229 = $663;
     $652 = $1225;
     $653 = $1228;
     $654 = $1229;
     $1230 = $653;
     $1231 = $654;
     $1232 = HEAP32[$1231>>2]|0;
     HEAP32[$1230>>2] = $1232;
     $655 = $664;
     $1233 = ((($1213)) + 4|0);
     $1234 = HEAP32[$1233>>2]|0;
     $1235 = ((($1234)) + 4|0);
     HEAP32[$1233>>2] = $1235;
    } else {
     $1236 = $663;
     __THREW__ = 0;
     invoke_vii(43,($1213|0),($1236|0));
     $1237 = __THREW__; __THREW__ = 0;
     $1238 = $1237&1;
     if ($1238) {
      label = 28;
      break L1;
     }
    }
    HEAP32[$863>>2] = 0;
    $645 = $840;
    $646 = $863;
    $1239 = $645;
    $1240 = ((($1239)) + 4|0);
    $1241 = HEAP32[$1240>>2]|0;
    $644 = $1239;
    $1242 = $644;
    $1243 = ((($1242)) + 8|0);
    $643 = $1243;
    $1244 = $643;
    $642 = $1244;
    $1245 = $642;
    $1246 = HEAP32[$1245>>2]|0;
    $1247 = ($1241|0)!=($1246|0);
    if ($1247) {
     $639 = $647;
     $640 = $1239;
     $641 = 1;
     $633 = $1239;
     $1248 = $633;
     $1249 = ((($1248)) + 8|0);
     $632 = $1249;
     $1250 = $632;
     $631 = $1250;
     $1251 = $631;
     $1252 = ((($1239)) + 4|0);
     $1253 = HEAP32[$1252>>2]|0;
     $634 = $1253;
     $1254 = $634;
     $1255 = $646;
     $635 = $1251;
     $636 = $1254;
     $637 = $1255;
     $1256 = $636;
     $1257 = $637;
     $1258 = HEAP32[$1257>>2]|0;
     HEAP32[$1256>>2] = $1258;
     $638 = $647;
     $1259 = ((($1239)) + 4|0);
     $1260 = HEAP32[$1259>>2]|0;
     $1261 = ((($1260)) + 4|0);
     HEAP32[$1259>>2] = $1261;
    } else {
     $1262 = $646;
     __THREW__ = 0;
     invoke_vii(43,($1239|0),($1262|0));
     $1263 = __THREW__; __THREW__ = 0;
     $1264 = $1263&1;
     if ($1264) {
      label = 28;
      break L1;
     }
    }
    HEAP32[$864>>2] = 0;
    $628 = $840;
    $629 = $864;
    $1265 = $628;
    $1266 = ((($1265)) + 4|0);
    $1267 = HEAP32[$1266>>2]|0;
    $627 = $1265;
    $1268 = $627;
    $1269 = ((($1268)) + 8|0);
    $626 = $1269;
    $1270 = $626;
    $625 = $1270;
    $1271 = $625;
    $1272 = HEAP32[$1271>>2]|0;
    $1273 = ($1267|0)!=($1272|0);
    if ($1273) {
     $622 = $630;
     $623 = $1265;
     $624 = 1;
     $616 = $1265;
     $1274 = $616;
     $1275 = ((($1274)) + 8|0);
     $615 = $1275;
     $1276 = $615;
     $614 = $1276;
     $1277 = $614;
     $1278 = ((($1265)) + 4|0);
     $1279 = HEAP32[$1278>>2]|0;
     $617 = $1279;
     $1280 = $617;
     $1281 = $629;
     $618 = $1277;
     $619 = $1280;
     $620 = $1281;
     $1282 = $619;
     $1283 = $620;
     $1284 = HEAP32[$1283>>2]|0;
     HEAP32[$1282>>2] = $1284;
     $621 = $630;
     $1285 = ((($1265)) + 4|0);
     $1286 = HEAP32[$1285>>2]|0;
     $1287 = ((($1286)) + 4|0);
     HEAP32[$1285>>2] = $1287;
    } else {
     $1288 = $629;
     __THREW__ = 0;
     invoke_vii(43,($1265|0),($1288|0));
     $1289 = __THREW__; __THREW__ = 0;
     $1290 = $1289&1;
     if ($1290) {
      label = 28;
      break L1;
     }
    }
    HEAP32[$865>>2] = 0;
    $611 = $843;
    $612 = $865;
    $1291 = $611;
    $1292 = ((($1291)) + 4|0);
    $1293 = HEAP32[$1292>>2]|0;
    $610 = $1291;
    $1294 = $610;
    $1295 = ((($1294)) + 8|0);
    $609 = $1295;
    $1296 = $609;
    $608 = $1296;
    $1297 = $608;
    $1298 = HEAP32[$1297>>2]|0;
    $1299 = ($1293|0)!=($1298|0);
    if ($1299) {
     $605 = $613;
     $606 = $1291;
     $607 = 1;
     $599 = $1291;
     $1300 = $599;
     $1301 = ((($1300)) + 8|0);
     $598 = $1301;
     $1302 = $598;
     $597 = $1302;
     $1303 = $597;
     $1304 = ((($1291)) + 4|0);
     $1305 = HEAP32[$1304>>2]|0;
     $600 = $1305;
     $1306 = $600;
     $1307 = $612;
     $601 = $1303;
     $602 = $1306;
     $603 = $1307;
     $1308 = $602;
     $1309 = $603;
     $1310 = HEAP32[$1309>>2]|0;
     HEAP32[$1308>>2] = $1310;
     $604 = $613;
     $1311 = ((($1291)) + 4|0);
     $1312 = HEAP32[$1311>>2]|0;
     $1313 = ((($1312)) + 4|0);
     HEAP32[$1311>>2] = $1313;
    } else {
     $1314 = $612;
     __THREW__ = 0;
     invoke_vii(43,($1291|0),($1314|0));
     $1315 = __THREW__; __THREW__ = 0;
     $1316 = $1315&1;
     if ($1316) {
      label = 28;
      break L1;
     }
    }
    HEAP32[$866>>2] = 0;
    $594 = $843;
    $595 = $866;
    $1317 = $594;
    $1318 = ((($1317)) + 4|0);
    $1319 = HEAP32[$1318>>2]|0;
    $593 = $1317;
    $1320 = $593;
    $1321 = ((($1320)) + 8|0);
    $592 = $1321;
    $1322 = $592;
    $591 = $1322;
    $1323 = $591;
    $1324 = HEAP32[$1323>>2]|0;
    $1325 = ($1319|0)!=($1324|0);
    if ($1325) {
     $588 = $596;
     $589 = $1317;
     $590 = 1;
     $582 = $1317;
     $1326 = $582;
     $1327 = ((($1326)) + 8|0);
     $581 = $1327;
     $1328 = $581;
     $580 = $1328;
     $1329 = $580;
     $1330 = ((($1317)) + 4|0);
     $1331 = HEAP32[$1330>>2]|0;
     $583 = $1331;
     $1332 = $583;
     $1333 = $595;
     $584 = $1329;
     $585 = $1332;
     $586 = $1333;
     $1334 = $585;
     $1335 = $586;
     $1336 = HEAP32[$1335>>2]|0;
     HEAP32[$1334>>2] = $1336;
     $587 = $596;
     $1337 = ((($1317)) + 4|0);
     $1338 = HEAP32[$1337>>2]|0;
     $1339 = ((($1338)) + 4|0);
     HEAP32[$1337>>2] = $1339;
    } else {
     $1340 = $595;
     __THREW__ = 0;
     invoke_vii(43,($1317|0),($1340|0));
     $1341 = __THREW__; __THREW__ = 0;
     $1342 = $1341&1;
     if ($1342) {
      label = 28;
      break L1;
     }
    }
    HEAP32[$867>>2] = 0;
    $577 = $843;
    $578 = $867;
    $1343 = $577;
    $1344 = ((($1343)) + 4|0);
    $1345 = HEAP32[$1344>>2]|0;
    $576 = $1343;
    $1346 = $576;
    $1347 = ((($1346)) + 8|0);
    $575 = $1347;
    $1348 = $575;
    $574 = $1348;
    $1349 = $574;
    $1350 = HEAP32[$1349>>2]|0;
    $1351 = ($1345|0)!=($1350|0);
    if ($1351) {
     $571 = $579;
     $572 = $1343;
     $573 = 1;
     $565 = $1343;
     $1352 = $565;
     $1353 = ((($1352)) + 8|0);
     $564 = $1353;
     $1354 = $564;
     $563 = $1354;
     $1355 = $563;
     $1356 = ((($1343)) + 4|0);
     $1357 = HEAP32[$1356>>2]|0;
     $566 = $1357;
     $1358 = $566;
     $1359 = $578;
     $567 = $1355;
     $568 = $1358;
     $569 = $1359;
     $1360 = $568;
     $1361 = $569;
     $1362 = HEAP32[$1361>>2]|0;
     HEAP32[$1360>>2] = $1362;
     $570 = $579;
     $1363 = ((($1343)) + 4|0);
     $1364 = HEAP32[$1363>>2]|0;
     $1365 = ((($1364)) + 4|0);
     HEAP32[$1363>>2] = $1365;
     break;
    } else {
     $1366 = $578;
     __THREW__ = 0;
     invoke_vii(43,($1343|0),($1366|0));
     $1367 = __THREW__; __THREW__ = 0;
     $1368 = $1367&1;
     if ($1368) {
      label = 28;
      break L1;
     } else {
      break;
     }
    }
   }
  } while(0);
  $2513 = $853;
  $2514 = (($2513) + 1)|0;
  $853 = $2514;
 }
 L287: do {
  if ((label|0) == 212) {
   $891 = 0;
   $193 = $895;
   $2515 = $193;
   $189 = $2515;
   $2516 = $189;
   $188 = $2516;
   $169 = $171;
   $170 = -1;
   $2517 = $169;
   HEAP32[$2517>>2] = 0;
   $2518 = HEAP32[$171>>2]|0;
   HEAP32[$190>>2] = $2518;
   $172 = $190;
   HEAP32[$2516>>2] = 0;
   $2519 = ((($2516)) + 4|0);
   $173 = $175;
   $174 = -1;
   $2520 = $173;
   HEAP32[$2520>>2] = 0;
   $2521 = HEAP32[$175>>2]|0;
   HEAP32[$191>>2] = $2521;
   $176 = $191;
   HEAP32[$2519>>2] = 0;
   $2522 = ((($2516)) + 8|0);
   $177 = $179;
   $178 = -1;
   $2523 = $177;
   HEAP32[$2523>>2] = 0;
   $2524 = HEAP32[$179>>2]|0;
   HEAP32[$192>>2] = $2524;
   $180 = $192;
   $186 = $2522;
   HEAP32[$187>>2] = 0;
   $2525 = $186;
   $185 = $187;
   $2526 = $185;
   $2527 = HEAP32[$2526>>2]|0;
   $183 = $2525;
   HEAP32[$184>>2] = $2527;
   $2528 = $183;
   $182 = $2528;
   $181 = $184;
   $2529 = $181;
   $2530 = HEAP32[$2529>>2]|0;
   HEAP32[$2528>>2] = $2530;
   $168 = $896;
   $2531 = $168;
   $164 = $2531;
   $2532 = $164;
   $163 = $2532;
   $144 = $146;
   $145 = -1;
   $2533 = $144;
   HEAP32[$2533>>2] = 0;
   $2534 = HEAP32[$146>>2]|0;
   HEAP32[$165>>2] = $2534;
   $147 = $165;
   HEAP32[$2532>>2] = 0;
   $2535 = ((($2532)) + 4|0);
   $148 = $150;
   $149 = -1;
   $2536 = $148;
   HEAP32[$2536>>2] = 0;
   $2537 = HEAP32[$150>>2]|0;
   HEAP32[$166>>2] = $2537;
   $151 = $166;
   HEAP32[$2535>>2] = 0;
   $2538 = ((($2532)) + 8|0);
   $152 = $154;
   $153 = -1;
   $2539 = $152;
   HEAP32[$2539>>2] = 0;
   $2540 = HEAP32[$154>>2]|0;
   HEAP32[$167>>2] = $2540;
   $155 = $167;
   $161 = $2538;
   HEAP32[$162>>2] = 0;
   $2541 = $161;
   $160 = $162;
   $2542 = $160;
   $2543 = HEAP32[$2542>>2]|0;
   $158 = $2541;
   HEAP32[$159>>2] = $2543;
   $2544 = $158;
   $157 = $2544;
   $156 = $159;
   $2545 = $156;
   $2546 = HEAP32[$2545>>2]|0;
   HEAP32[$2544>>2] = $2546;
   $897 = 0;
   L289: while(1) {
    $2547 = $897;
    $2548 = $828;
    $2549 = ($2547|0)<($2548|0);
    if (!($2549)) {
     label = 226;
     break;
    }
    $898 = 0;
    while(1) {
     $2550 = $898;
     $2551 = ($2550|0)<(3);
     if (!($2551)) {
      break;
     }
     HEAP32[$899>>2] = 0;
     $141 = $895;
     $142 = $899;
     $2552 = $141;
     $2553 = ((($2552)) + 4|0);
     $2554 = HEAP32[$2553>>2]|0;
     $140 = $2552;
     $2555 = $140;
     $2556 = ((($2555)) + 8|0);
     $139 = $2556;
     $2557 = $139;
     $138 = $2557;
     $2558 = $138;
     $2559 = HEAP32[$2558>>2]|0;
     $2560 = ($2554|0)!=($2559|0);
     if ($2560) {
      $135 = $143;
      $136 = $2552;
      $137 = 1;
      $129 = $2552;
      $2561 = $129;
      $2562 = ((($2561)) + 8|0);
      $128 = $2562;
      $2563 = $128;
      $127 = $2563;
      $2564 = $127;
      $2565 = ((($2552)) + 4|0);
      $2566 = HEAP32[$2565>>2]|0;
      $130 = $2566;
      $2567 = $130;
      $2568 = $142;
      $131 = $2564;
      $132 = $2567;
      $133 = $2568;
      $2569 = $132;
      $2570 = $133;
      $2571 = HEAP32[$2570>>2]|0;
      HEAP32[$2569>>2] = $2571;
      $134 = $143;
      $2572 = ((($2552)) + 4|0);
      $2573 = HEAP32[$2572>>2]|0;
      $2574 = ((($2573)) + 4|0);
      HEAP32[$2572>>2] = $2574;
     } else {
      $2575 = $142;
      __THREW__ = 0;
      invoke_vii(43,($2552|0),($2575|0));
      $2576 = __THREW__; __THREW__ = 0;
      $2577 = $2576&1;
      if ($2577) {
       label = 224;
       break L289;
      }
     }
     HEAP8[$900>>0] = 32;
     $124 = $896;
     $125 = $900;
     $2578 = $124;
     $2579 = ((($2578)) + 4|0);
     $2580 = HEAP32[$2579>>2]|0;
     $123 = $2578;
     $2581 = $123;
     $2582 = ((($2581)) + 8|0);
     $122 = $2582;
     $2583 = $122;
     $121 = $2583;
     $2584 = $121;
     $2585 = HEAP32[$2584>>2]|0;
     $2586 = ($2580|0)!=($2585|0);
     if ($2586) {
      $118 = $126;
      $119 = $2578;
      $120 = 1;
      $112 = $2578;
      $2587 = $112;
      $2588 = ((($2587)) + 8|0);
      $111 = $2588;
      $2589 = $111;
      $110 = $2589;
      $2590 = $110;
      $2591 = ((($2578)) + 4|0);
      $2592 = HEAP32[$2591>>2]|0;
      $113 = $2592;
      $2593 = $113;
      $2594 = $125;
      $114 = $2590;
      $115 = $2593;
      $116 = $2594;
      $2595 = $115;
      $2596 = $116;
      $2597 = HEAP8[$2596>>0]|0;
      HEAP8[$2595>>0] = $2597;
      $117 = $126;
      $2598 = ((($2578)) + 4|0);
      $2599 = HEAP32[$2598>>2]|0;
      $2600 = ((($2599)) + 1|0);
      HEAP32[$2598>>2] = $2600;
     } else {
      $2601 = $125;
      __THREW__ = 0;
      invoke_vii(52,($2578|0),($2601|0));
      $2602 = __THREW__; __THREW__ = 0;
      $2603 = $2602&1;
      if ($2603) {
       label = 224;
       break L289;
      }
     }
     $2604 = $898;
     $2605 = (($2604) + 1)|0;
     $898 = $2605;
    }
    $2610 = $897;
    $2611 = (($2610) + 1)|0;
    $897 = $2611;
   }
   L304: do {
    if ((label|0) == 226) {
     $2612 = $825;
     $2613 = $2612<<3;
     __THREW__ = 0;
     $2614 = (invoke_ii(53,($2613|0))|0);
     $2615 = __THREW__; __THREW__ = 0;
     $2616 = $2615&1;
     if ($2616) {
      label = 224;
     } else {
      $901 = $2614;
      $902 = 0;
      while(1) {
       $2617 = $902;
       $2618 = $825;
       $2619 = ($2617|0)<($2618|0);
       if (!($2619)) {
        break;
       }
       $2620 = $824;
       $2621 = $902;
       $2622 = (($2620) + ($2621<<3)|0);
       $2623 = +HEAPF64[$2622>>3];
       $2624 = $901;
       $2625 = $902;
       $2626 = (($2624) + ($2625<<3)|0);
       HEAPF64[$2626>>3] = $2623;
       $2627 = $902;
       $2628 = (($2627) + 1)|0;
       $902 = $2628;
      }
      __THREW__ = 0;
      invoke_vi(54,($903|0));
      $2629 = __THREW__; __THREW__ = 0;
      $2630 = $2629&1;
      if ($2630) {
       label = 224;
      } else {
       $2631 = $901;
       $2632 = $825;
       $2633 = $826;
       __THREW__ = 0;
       invoke_viiidi(55,($903|0),($2631|0),($2632|0),(+$2633),1);
       $2634 = __THREW__; __THREW__ = 0;
       $2635 = $2634&1;
       L312: do {
        if (!($2635)) {
         __THREW__ = 0;
         $2636 = (invoke_ii(56,($903|0))|0);
         $2637 = __THREW__; __THREW__ = 0;
         $2638 = $2637&1;
         if (!($2638)) {
          L315: do {
           if ($2636) {
            $905 = 0;
            while(1) {
             $2639 = $905;
             $2640 = $828;
             $2641 = ($2639|0)<($2640|0);
             if (!($2641)) {
              break L315;
             }
             $2642 = $827;
             $2643 = $905;
             $2644 = $2643<<1;
             $2645 = (($2642) + ($2644<<2)|0);
             $2646 = HEAP32[$2645>>2]|0;
             $2647 = HEAP32[$2646>>2]|0;
             $830 = $2647;
             $2648 = $827;
             $2649 = $905;
             $2650 = $2649<<1;
             $2651 = (($2650) + 1)|0;
             $2652 = (($2648) + ($2651<<2)|0);
             $2653 = HEAP32[$2652>>2]|0;
             $2654 = HEAP32[$2653>>2]|0;
             $2655 = $827;
             $2656 = $905;
             $2657 = $2656<<1;
             $2658 = (($2655) + ($2657<<2)|0);
             $2659 = HEAP32[$2658>>2]|0;
             $2660 = HEAP32[$2659>>2]|0;
             $2661 = (($2654) - ($2660))|0;
             $2662 = (($2661) + 1)|0;
             $829 = $2662;
             $2663 = $901;
             $2664 = $830;
             $2665 = (($2663) + ($2664<<3)|0);
             $904 = $2665;
             $892 = -1;
             $2666 = $904;
             $2667 = $829;
             $2668 = ((($913)) + 48|0);
             $2669 = ((($2668)) + 40|0);
             $2670 = +HEAPF64[$2669>>3];
             __THREW__ = 0;
             invoke_viiiiid(57,($913|0),($2666|0),($2667|0),($893|0),($894|0),(+$2670));
             $2671 = __THREW__; __THREW__ = 0;
             $2672 = $2671&1;
             if ($2672) {
              break L312;
             }
             $2673 = HEAP32[$893>>2]|0;
             $2674 = ($2673|0)!=(-1);
             if ($2674) {
              $2675 = $830;
              $2676 = HEAP32[$893>>2]|0;
              $2677 = (($2676) + ($2675))|0;
              HEAP32[$893>>2] = $2677;
             }
             $2682 = HEAP32[$894>>2]|0;
             $2683 = ($2682|0)!=(-1);
             if ($2683) {
              $2684 = $830;
              $2685 = HEAP32[$894>>2]|0;
              $2686 = (($2685) + ($2684))|0;
              HEAP32[$894>>2] = $2686;
             }
             $2687 = HEAP32[$893>>2]|0;
             $2688 = ($2687|0)!=(-1);
             $2689 = HEAP32[$894>>2]|0;
             $2690 = ($2689|0)!=(-1);
             $or$cond = $2688 & $2690;
             $2691 = HEAP32[$894>>2]|0;
             do {
              if ($or$cond) {
               $2692 = HEAP32[$893>>2]|0;
               $2693 = ($2691|0)<($2692|0);
               if (!($2693)) {
                $2728 = HEAP32[$893>>2]|0;
                $2729 = $830;
                $2730 = (($2728) - ($2729))|0;
                $2731 = (($2730) + 1)|0;
                $829 = $2731;
                $2732 = $904;
                $2733 = $829;
                __THREW__ = 0;
                $2734 = (invoke_iiiid(59,($913|0),($2732|0),($2733|0),0.050000000000000003)|0);
                $2735 = __THREW__; __THREW__ = 0;
                $2736 = $2735&1;
                if ($2736) {
                 break L312;
                }
                $892 = $2734;
                $2737 = $892;
                $2738 = ($2737|0)!=(-1);
                if (!($2738)) {
                 break;
                }
                $2739 = $830;
                $2740 = $892;
                $2741 = (($2740) + ($2739))|0;
                $892 = $2741;
                break;
               }
               $2694 = $901;
               $2695 = HEAP32[$893>>2]|0;
               $2696 = (($2694) + ($2695<<3)|0);
               $2697 = +HEAPF64[$2696>>3];
               $2698 = $901;
               $2699 = HEAP32[$894>>2]|0;
               $2700 = (($2698) + ($2699<<3)|0);
               $2701 = +HEAPF64[$2700>>3];
               $2702 = -$2701;
               $2703 = $2697 > $2702;
               if ($2703) {
                $2704 = HEAP32[$894>>2]|0;
                $892 = $2704;
                HEAP32[$894>>2] = -1;
                $2705 = $827;
                $2706 = $905;
                $2707 = $2706<<1;
                $2708 = (($2707) + 1)|0;
                $2709 = (($2705) + ($2708<<2)|0);
                $2710 = HEAP32[$2709>>2]|0;
                $2711 = HEAP32[$2710>>2]|0;
                $2712 = HEAP32[$893>>2]|0;
                $2713 = (($2711) - ($2712))|0;
                $2714 = (($2713) + 1)|0;
                $829 = $2714;
                $2715 = $901;
                $2716 = HEAP32[$893>>2]|0;
                $2717 = (($2715) + ($2716<<3)|0);
                $904 = $2717;
                $2718 = $904;
                $2719 = $829;
                __THREW__ = 0;
                $2720 = (invoke_iiiid(58,($913|0),($2718|0),($2719|0),0.050000000000000003)|0);
                $2721 = __THREW__; __THREW__ = 0;
                $2722 = $2721&1;
                if ($2722) {
                 break L312;
                }
                HEAP32[$894>>2] = $2720;
                $2723 = HEAP32[$894>>2]|0;
                $2724 = ($2723|0)!=(-1);
                if ($2724) {
                 $2725 = HEAP32[$893>>2]|0;
                 $2726 = HEAP32[$894>>2]|0;
                 $2727 = (($2726) + ($2725))|0;
                 HEAP32[$894>>2] = $2727;
                }
               }
              } else {
               $2742 = ($2691|0)!=(-1);
               if ($2742) {
                $2743 = HEAP32[$894>>2]|0;
                $2744 = $830;
                $2745 = (($2743) - ($2744))|0;
                $2746 = (($2745) + 1)|0;
                $829 = $2746;
                $2747 = $901;
                $2748 = $830;
                $2749 = (($2747) + ($2748<<3)|0);
                $904 = $2749;
                $2750 = $904;
                $2751 = $829;
                __THREW__ = 0;
                $2752 = (invoke_iiiid(60,($913|0),($2750|0),($2751|0),0.050000000000000003)|0);
                $2753 = __THREW__; __THREW__ = 0;
                $2754 = $2753&1;
                if ($2754) {
                 break L312;
                }
                HEAP32[$893>>2] = $2752;
                $2755 = HEAP32[$893>>2]|0;
                $2756 = ($2755|0)!=(-1);
                if (!($2756)) {
                 break;
                }
                $2757 = $830;
                $2758 = HEAP32[$893>>2]|0;
                $2759 = (($2758) + ($2757))|0;
                HEAP32[$893>>2] = $2759;
                break;
               }
               $2760 = HEAP32[$893>>2]|0;
               $2761 = ($2760|0)!=(-1);
               if ($2761) {
                $2762 = HEAP32[$893>>2]|0;
                $2763 = $830;
                $2764 = (($2762) - ($2763))|0;
                $2765 = (($2764) + 1)|0;
                $829 = $2765;
                $2766 = $904;
                $2767 = $829;
                __THREW__ = 0;
                $2768 = (invoke_iiiid(59,($913|0),($2766|0),($2767|0),0.050000000000000003)|0);
                $2769 = __THREW__; __THREW__ = 0;
                $2770 = $2769&1;
                if ($2770) {
                 break L312;
                }
                $892 = $2768;
                $2771 = $892;
                $2772 = ($2771|0)!=(-1);
                if ($2772) {
                 $2773 = $830;
                 $2774 = $892;
                 $2775 = (($2774) + ($2773))|0;
                 $892 = $2775;
                }
                $2776 = $827;
                $2777 = $905;
                $2778 = $2777<<1;
                $2779 = (($2778) + 1)|0;
                $2780 = (($2776) + ($2779<<2)|0);
                $2781 = HEAP32[$2780>>2]|0;
                $2782 = HEAP32[$2781>>2]|0;
                $2783 = HEAP32[$893>>2]|0;
                $2784 = (($2782) - ($2783))|0;
                $2785 = (($2784) + 1)|0;
                $829 = $2785;
                $2786 = $901;
                $2787 = HEAP32[$893>>2]|0;
                $2788 = (($2786) + ($2787<<3)|0);
                $904 = $2788;
                $2789 = $904;
                $2790 = $829;
                __THREW__ = 0;
                $2791 = (invoke_iiiid(58,($913|0),($2789|0),($2790|0),0.050000000000000003)|0);
                $2792 = __THREW__; __THREW__ = 0;
                $2793 = $2792&1;
                if ($2793) {
                 break L312;
                }
                HEAP32[$894>>2] = $2791;
                $2794 = HEAP32[$894>>2]|0;
                $2795 = ($2794|0)!=(-1);
                if (!($2795)) {
                 break;
                }
                $2796 = HEAP32[$893>>2]|0;
                $2797 = HEAP32[$894>>2]|0;
                $2798 = (($2797) + ($2796))|0;
                HEAP32[$894>>2] = $2798;
               }
              }
             } while(0);
             $2799 = HEAP32[$893>>2]|0;
             $2800 = ($2799|0)==(-1);
             $2801 = HEAP32[$894>>2]|0;
             $2802 = ($2801|0)==(-1);
             $or$cond3 = $2800 & $2802;
             if ($or$cond3) {
              $2803 = $827;
              $2804 = $905;
              $2805 = $2804<<1;
              $2806 = (($2803) + ($2805<<2)|0);
              $2807 = HEAP32[$2806>>2]|0;
              $2808 = ((($2807)) + 4|0);
              HEAP32[$2808>>2] = 16;
              $2809 = $905;
              $2810 = ($2809|0)!=(0);
              if ($2810) {
               $2811 = $905;
               $2812 = (($2811) - 1)|0;
               $2813 = ($2812*3)|0;
               $108 = $840;
               $109 = $2813;
               $2814 = $108;
               $2815 = HEAP32[$2814>>2]|0;
               $2816 = $109;
               $2817 = (($2815) + ($2816<<2)|0);
               $2818 = HEAP32[$2817>>2]|0;
               $2819 = ($2818|0)!=(0);
               if ($2819) {
                $2820 = $838;
                $2821 = (($2820) + -1)|0;
                $838 = $2821;
                $2822 = $905;
                $2823 = (($2822) - 1)|0;
                $2824 = ($2823*3)|0;
                $6 = $840;
                $7 = $2824;
                $2825 = $6;
                $2826 = HEAP32[$2825>>2]|0;
                $2827 = $7;
                $2828 = (($2826) + ($2827<<2)|0);
                HEAP32[$2828>>2] = 0;
                $2829 = $905;
                $2830 = (($2829) - 1)|0;
                $2831 = ($2830*3)|0;
                $2832 = (($2831) + 1)|0;
                $8 = $840;
                $9 = $2832;
                $2833 = $8;
                $2834 = HEAP32[$2833>>2]|0;
                $2835 = $9;
                $2836 = (($2834) + ($2835<<2)|0);
                HEAP32[$2836>>2] = 0;
                $2837 = $905;
                $2838 = (($2837) - 1)|0;
                $2839 = ($2838*3)|0;
                $2840 = (($2839) + 2)|0;
                $10 = $840;
                $11 = $2840;
                $2841 = $10;
                $2842 = HEAP32[$2841>>2]|0;
                $2843 = $11;
                $2844 = (($2842) + ($2843<<2)|0);
                HEAP32[$2844>>2] = 0;
               }
              }
              $2845 = $905;
              $2846 = $828;
              $2847 = (($2846) - 1)|0;
              $2848 = ($2845|0)!=($2847|0);
              if ($2848) {
               $2849 = $905;
               $2850 = ($2849*3)|0;
               $12 = $843;
               $13 = $2850;
               $2851 = $12;
               $2852 = HEAP32[$2851>>2]|0;
               $2853 = $13;
               $2854 = (($2852) + ($2853<<2)|0);
               $2855 = HEAP32[$2854>>2]|0;
               $2856 = ($2855|0)!=(0);
               if ($2856) {
                $2857 = $834;
                $2858 = (($2857) + -1)|0;
                $834 = $2858;
                $2859 = $905;
                $2860 = ($2859*3)|0;
                $14 = $843;
                $15 = $2860;
                $2861 = $14;
                $2862 = HEAP32[$2861>>2]|0;
                $2863 = $15;
                $2864 = (($2862) + ($2863<<2)|0);
                HEAP32[$2864>>2] = 0;
                $2865 = $905;
                $2866 = ($2865*3)|0;
                $2867 = (($2866) + 1)|0;
                $16 = $843;
                $17 = $2867;
                $2868 = $16;
                $2869 = HEAP32[$2868>>2]|0;
                $2870 = $17;
                $2871 = (($2869) + ($2870<<2)|0);
                HEAP32[$2871>>2] = 0;
                $2872 = $905;
                $2873 = ($2872*3)|0;
                $2874 = (($2873) + 2)|0;
                $18 = $843;
                $19 = $2874;
                $2875 = $18;
                $2876 = HEAP32[$2875>>2]|0;
                $2877 = $19;
                $2878 = (($2876) + ($2877<<2)|0);
                HEAP32[$2878>>2] = 0;
               }
              }
             }
             $2879 = $892;
             $2880 = ($2879|0)!=(-1);
             if ($2880) {
              $2881 = $891;
              $2882 = (($2881) + 1)|0;
              $891 = $2882;
              $2883 = $892;
              $2884 = $905;
              $2885 = ($2884*3)|0;
              $20 = $895;
              $21 = $2885;
              $2886 = $20;
              $2887 = HEAP32[$2886>>2]|0;
              $2888 = $21;
              $2889 = (($2887) + ($2888<<2)|0);
              HEAP32[$2889>>2] = $2883;
              $2890 = $901;
              $2891 = $892;
              $2892 = (($2890) + ($2891<<3)|0);
              $2893 = +HEAPF64[$2892>>3];
              $2894 = (+Math_abs((+$2893)));
              $2895 = $2894 > 0.5;
              $2896 = $905;
              $2897 = ($2896*3)|0;
              if ($2895) {
               $22 = $896;
               $23 = $2897;
               $2898 = $22;
               $2899 = HEAP32[$2898>>2]|0;
               $2900 = $23;
               $2901 = (($2899) + ($2900)|0);
               $$sink = 17;$$sink4 = $2901;
              } else {
               $24 = $896;
               $25 = $2897;
               $2902 = $24;
               $2903 = HEAP32[$2902>>2]|0;
               $2904 = $25;
               $2905 = (($2903) + ($2904)|0);
               $$sink = 15;$$sink4 = $2905;
              }
              HEAP8[$$sink4>>0] = $$sink;
             }
             $2906 = HEAP32[$893>>2]|0;
             $2907 = ($2906|0)!=(-1);
             if ($2907) {
              $2908 = $891;
              $2909 = (($2908) + 1)|0;
              $891 = $2909;
              $2910 = HEAP32[$893>>2]|0;
              $2911 = $905;
              $2912 = ($2911*3)|0;
              $2913 = (($2912) + 1)|0;
              $26 = $895;
              $27 = $2913;
              $2914 = $26;
              $2915 = HEAP32[$2914>>2]|0;
              $2916 = $27;
              $2917 = (($2915) + ($2916<<2)|0);
              HEAP32[$2917>>2] = $2910;
              $2918 = $901;
              $2919 = HEAP32[$893>>2]|0;
              $2920 = (($2918) + ($2919<<3)|0);
              $2921 = +HEAPF64[$2920>>3];
              $2922 = (+Math_abs((+$2921)));
              $2923 = $2922 > 0.5;
              $2924 = $905;
              $2925 = ($2924*3)|0;
              $2926 = (($2925) + 1)|0;
              if ($2923) {
               $28 = $896;
               $29 = $2926;
               $2927 = $28;
               $2928 = HEAP32[$2927>>2]|0;
               $2929 = $29;
               $2930 = (($2928) + ($2929)|0);
               $$sink6 = 48;$$sink7 = $2930;
              } else {
               $30 = $896;
               $31 = $2926;
               $2931 = $30;
               $2932 = HEAP32[$2931>>2]|0;
               $2933 = $31;
               $2934 = (($2932) + ($2933)|0);
               $$sink6 = 47;$$sink7 = $2934;
              }
              HEAP8[$$sink7>>0] = $$sink6;
             }
             $2935 = HEAP32[$894>>2]|0;
             $2936 = ($2935|0)!=(-1);
             if ($2936) {
              $2937 = $891;
              $2938 = (($2937) + 1)|0;
              $891 = $2938;
              $2939 = HEAP32[$894>>2]|0;
              $2940 = $905;
              $2941 = ($2940*3)|0;
              $2942 = (($2941) + 2)|0;
              $32 = $895;
              $33 = $2942;
              $2943 = $32;
              $2944 = HEAP32[$2943>>2]|0;
              $2945 = $33;
              $2946 = (($2944) + ($2945<<2)|0);
              HEAP32[$2946>>2] = $2939;
              $2947 = $901;
              $2948 = HEAP32[$894>>2]|0;
              $2949 = (($2947) + ($2948<<3)|0);
              $2950 = +HEAPF64[$2949>>3];
              $2951 = (+Math_abs((+$2950)));
              $2952 = $2951 > 0.5;
              $2953 = $905;
              $2954 = ($2953*3)|0;
              $2955 = (($2954) + 2)|0;
              if ($2952) {
               $34 = $896;
               $35 = $2955;
               $2956 = $34;
               $2957 = HEAP32[$2956>>2]|0;
               $2958 = $35;
               $2959 = (($2957) + ($2958)|0);
               $$sink10 = $2959;$$sink9 = 50;
              } else {
               $36 = $896;
               $37 = $2955;
               $2960 = $36;
               $2961 = HEAP32[$2960>>2]|0;
               $2962 = $37;
               $2963 = (($2961) + ($2962)|0);
               $$sink10 = $2963;$$sink9 = 49;
              }
              HEAP8[$$sink10>>0] = $$sink9;
             }
             $2964 = $905;
             $2965 = (($2964) + 1)|0;
             $905 = $2965;
            }
           }
          } while(0);
          $2966 = $901;
          __THREW__ = 0;
          invoke_vi(35,($2966|0));
          $2967 = __THREW__; __THREW__ = 0;
          $2968 = $2967&1;
          if (!($2968)) {
           $852 = 0;
           $2969 = $838;
           $2970 = ($2969*3)|0;
           $2971 = $828;
           $2972 = $2971<<1;
           $2973 = (($2970) + ($2972))|0;
           $2974 = $891;
           $2975 = (($2973) + ($2974))|0;
           $2976 = $834;
           $2977 = ($2976*3)|0;
           $2978 = (($2975) + ($2977))|0;
           $2979 = ((($913)) + 168|0);
           $38 = $2979;
           $2980 = $38;
           $2981 = ((($2980)) + 4|0);
           $2982 = HEAP32[$2981>>2]|0;
           $2983 = HEAP32[$2980>>2]|0;
           $2984 = $2982;
           $2985 = $2983;
           $2986 = (($2984) - ($2985))|0;
           $2987 = (($2986|0) / 4)&-1;
           $2988 = (($2978) + ($2987))|0;
           $2989 = ((($913)) + 156|0);
           HEAP32[$2989>>2] = $2988;
           $2990 = ((($913)) + 156|0);
           $2991 = HEAP32[$2990>>2]|0;
           $2992 = $828;
           $2993 = ($2991|0)>($2992|0);
           if ($2993) {
            $2994 = ((($913)) + 156|0);
            $2995 = HEAP32[$2994>>2]|0;
            $$arith = $2995<<2;
            $$overflow = ($2995>>>0)>(1073741823);
            $2996 = $$overflow ? -1 : $$arith;
            __THREW__ = 0;
            $2997 = (invoke_ii(42,($2996|0))|0);
            $2998 = __THREW__; __THREW__ = 0;
            $2999 = $2998&1;
            if ($2999) {
             break;
            }
            $3000 = ((($913)) + 152|0);
            HEAP32[$3000>>2] = $2997;
            $906 = 0;
            while(1) {
             $3001 = $906;
             $3002 = ((($913)) + 156|0);
             $3003 = HEAP32[$3002>>2]|0;
             $3004 = ($3001|0)<($3003|0);
             if (!($3004)) {
              break;
             }
             __THREW__ = 0;
             $3005 = (invoke_ii(42,12)|0);
             $3006 = __THREW__; __THREW__ = 0;
             $3007 = $3006&1;
             if ($3007) {
              break L312;
             }
             $3008 = ((($913)) + 152|0);
             $3009 = HEAP32[$3008>>2]|0;
             $3010 = $906;
             $3011 = (($3009) + ($3010<<2)|0);
             HEAP32[$3011>>2] = $3005;
             $3012 = $906;
             $3013 = (($3012) + 1)|0;
             $906 = $3013;
            }
            $907 = 0;
            $908 = 0;
            $909 = 0;
            while(1) {
             $3014 = $909;
             $39 = $843;
             $3015 = $39;
             $3016 = ((($3015)) + 4|0);
             $3017 = HEAP32[$3016>>2]|0;
             $3018 = HEAP32[$3015>>2]|0;
             $3019 = $3017;
             $3020 = $3018;
             $3021 = (($3019) - ($3020))|0;
             $3022 = (($3021|0) / 4)&-1;
             $3023 = ($3014|0)<($3022|0);
             if (!($3023)) {
              break;
             }
             $3024 = $827;
             $3025 = $908;
             $3026 = (($3024) + ($3025<<2)|0);
             $3027 = HEAP32[$3026>>2]|0;
             $3028 = HEAP32[$3027>>2]|0;
             $3029 = ((($913)) + 152|0);
             $3030 = HEAP32[$3029>>2]|0;
             $3031 = $907;
             $3032 = (($3030) + ($3031<<2)|0);
             $3033 = HEAP32[$3032>>2]|0;
             HEAP32[$3033>>2] = $3028;
             $3034 = $827;
             $3035 = $908;
             $3036 = (($3034) + ($3035<<2)|0);
             $3037 = HEAP32[$3036>>2]|0;
             $3038 = ((($3037)) + 4|0);
             $3039 = HEAP32[$3038>>2]|0;
             $3040 = ((($913)) + 152|0);
             $3041 = HEAP32[$3040>>2]|0;
             $3042 = $907;
             $3043 = (($3041) + ($3042<<2)|0);
             $3044 = HEAP32[$3043>>2]|0;
             $3045 = ((($3044)) + 4|0);
             HEAP32[$3045>>2] = $3039;
             $3046 = $827;
             $3047 = $908;
             $3048 = (($3047) + 1)|0;
             $908 = $3048;
             $3049 = (($3046) + ($3047<<2)|0);
             $3050 = HEAP32[$3049>>2]|0;
             $3051 = ((($3050)) + 8|0);
             $3052 = HEAP32[$3051>>2]|0;
             $3053 = ((($913)) + 152|0);
             $3054 = HEAP32[$3053>>2]|0;
             $3055 = $907;
             $3056 = (($3055) + 1)|0;
             $907 = $3056;
             $3057 = (($3054) + ($3055<<2)|0);
             $3058 = HEAP32[$3057>>2]|0;
             $3059 = ((($3058)) + 8|0);
             HEAP32[$3059>>2] = $3052;
             $3060 = $909;
             $40 = $895;
             $41 = $3060;
             $3061 = $40;
             $3062 = HEAP32[$3061>>2]|0;
             $3063 = $41;
             $3064 = (($3062) + ($3063<<2)|0);
             $3065 = HEAP32[$3064>>2]|0;
             $3066 = ($3065|0)!=(0);
             if ($3066) {
              $3067 = $909;
              $42 = $895;
              $43 = $3067;
              $3068 = $42;
              $3069 = HEAP32[$3068>>2]|0;
              $3070 = $43;
              $3071 = (($3069) + ($3070<<2)|0);
              $3072 = HEAP32[$3071>>2]|0;
              $3073 = ((($913)) + 152|0);
              $3074 = HEAP32[$3073>>2]|0;
              $3075 = $907;
              $3076 = (($3074) + ($3075<<2)|0);
              $3077 = HEAP32[$3076>>2]|0;
              HEAP32[$3077>>2] = $3072;
              $3078 = $909;
              $44 = $896;
              $45 = $3078;
              $3079 = $44;
              $3080 = HEAP32[$3079>>2]|0;
              $3081 = $45;
              $3082 = (($3080) + ($3081)|0);
              $3083 = HEAP8[$3082>>0]|0;
              $3084 = $3083 << 24 >> 24;
              $3085 = ((($913)) + 152|0);
              $3086 = HEAP32[$3085>>2]|0;
              $3087 = $907;
              $3088 = (($3086) + ($3087<<2)|0);
              $3089 = HEAP32[$3088>>2]|0;
              $3090 = ((($3089)) + 4|0);
              HEAP32[$3090>>2] = $3084;
              $3091 = ((($913)) + 152|0);
              $3092 = HEAP32[$3091>>2]|0;
              $3093 = $907;
              $3094 = (($3093) + 1)|0;
              $907 = $3094;
              $3095 = (($3092) + ($3093<<2)|0);
              $3096 = HEAP32[$3095>>2]|0;
              $3097 = ((($3096)) + 8|0);
              HEAP32[$3097>>2] = -1;
             }
             $3098 = $909;
             $3099 = (($3098) + 1)|0;
             $46 = $895;
             $47 = $3099;
             $3100 = $46;
             $3101 = HEAP32[$3100>>2]|0;
             $3102 = $47;
             $3103 = (($3101) + ($3102<<2)|0);
             $3104 = HEAP32[$3103>>2]|0;
             $3105 = ($3104|0)!=(0);
             if ($3105) {
              $3106 = $909;
              $3107 = (($3106) + 1)|0;
              $48 = $895;
              $49 = $3107;
              $3108 = $48;
              $3109 = HEAP32[$3108>>2]|0;
              $3110 = $49;
              $3111 = (($3109) + ($3110<<2)|0);
              $3112 = HEAP32[$3111>>2]|0;
              $3113 = ((($913)) + 152|0);
              $3114 = HEAP32[$3113>>2]|0;
              $3115 = $907;
              $3116 = (($3114) + ($3115<<2)|0);
              $3117 = HEAP32[$3116>>2]|0;
              HEAP32[$3117>>2] = $3112;
              $3118 = $909;
              $3119 = (($3118) + 1)|0;
              $50 = $896;
              $51 = $3119;
              $3120 = $50;
              $3121 = HEAP32[$3120>>2]|0;
              $3122 = $51;
              $3123 = (($3121) + ($3122)|0);
              $3124 = HEAP8[$3123>>0]|0;
              $3125 = $3124 << 24 >> 24;
              $3126 = ((($913)) + 152|0);
              $3127 = HEAP32[$3126>>2]|0;
              $3128 = $907;
              $3129 = (($3127) + ($3128<<2)|0);
              $3130 = HEAP32[$3129>>2]|0;
              $3131 = ((($3130)) + 4|0);
              HEAP32[$3131>>2] = $3125;
              $3132 = ((($913)) + 152|0);
              $3133 = HEAP32[$3132>>2]|0;
              $3134 = $907;
              $3135 = (($3134) + 1)|0;
              $907 = $3135;
              $3136 = (($3133) + ($3134<<2)|0);
              $3137 = HEAP32[$3136>>2]|0;
              $3138 = ((($3137)) + 8|0);
              HEAP32[$3138>>2] = -1;
             }
             $3139 = $909;
             $3140 = (($3139) + 2)|0;
             $52 = $895;
             $53 = $3140;
             $3141 = $52;
             $3142 = HEAP32[$3141>>2]|0;
             $3143 = $53;
             $3144 = (($3142) + ($3143<<2)|0);
             $3145 = HEAP32[$3144>>2]|0;
             $3146 = ($3145|0)!=(0);
             if ($3146) {
              $3147 = $909;
              $3148 = (($3147) + 2)|0;
              $54 = $895;
              $55 = $3148;
              $3149 = $54;
              $3150 = HEAP32[$3149>>2]|0;
              $3151 = $55;
              $3152 = (($3150) + ($3151<<2)|0);
              $3153 = HEAP32[$3152>>2]|0;
              $3154 = ((($913)) + 152|0);
              $3155 = HEAP32[$3154>>2]|0;
              $3156 = $907;
              $3157 = (($3155) + ($3156<<2)|0);
              $3158 = HEAP32[$3157>>2]|0;
              HEAP32[$3158>>2] = $3153;
              $3159 = $909;
              $3160 = (($3159) + 2)|0;
              $56 = $896;
              $57 = $3160;
              $3161 = $56;
              $3162 = HEAP32[$3161>>2]|0;
              $3163 = $57;
              $3164 = (($3162) + ($3163)|0);
              $3165 = HEAP8[$3164>>0]|0;
              $3166 = $3165 << 24 >> 24;
              $3167 = ((($913)) + 152|0);
              $3168 = HEAP32[$3167>>2]|0;
              $3169 = $907;
              $3170 = (($3168) + ($3169<<2)|0);
              $3171 = HEAP32[$3170>>2]|0;
              $3172 = ((($3171)) + 4|0);
              HEAP32[$3172>>2] = $3166;
              $3173 = ((($913)) + 152|0);
              $3174 = HEAP32[$3173>>2]|0;
              $3175 = $907;
              $3176 = (($3175) + 1)|0;
              $907 = $3176;
              $3177 = (($3174) + ($3175<<2)|0);
              $3178 = HEAP32[$3177>>2]|0;
              $3179 = ((($3178)) + 8|0);
              HEAP32[$3179>>2] = -1;
             }
             $3180 = $827;
             $3181 = $908;
             $3182 = (($3180) + ($3181<<2)|0);
             $3183 = HEAP32[$3182>>2]|0;
             $3184 = HEAP32[$3183>>2]|0;
             $3185 = ((($913)) + 152|0);
             $3186 = HEAP32[$3185>>2]|0;
             $3187 = $907;
             $3188 = (($3186) + ($3187<<2)|0);
             $3189 = HEAP32[$3188>>2]|0;
             HEAP32[$3189>>2] = $3184;
             $3190 = $827;
             $3191 = $908;
             $3192 = (($3190) + ($3191<<2)|0);
             $3193 = HEAP32[$3192>>2]|0;
             $3194 = ((($3193)) + 4|0);
             $3195 = HEAP32[$3194>>2]|0;
             $3196 = ((($913)) + 152|0);
             $3197 = HEAP32[$3196>>2]|0;
             $3198 = $907;
             $3199 = (($3197) + ($3198<<2)|0);
             $3200 = HEAP32[$3199>>2]|0;
             $3201 = ((($3200)) + 4|0);
             HEAP32[$3201>>2] = $3195;
             $3202 = $827;
             $3203 = $908;
             $3204 = (($3203) + 1)|0;
             $908 = $3204;
             $3205 = (($3202) + ($3203<<2)|0);
             $3206 = HEAP32[$3205>>2]|0;
             $3207 = ((($3206)) + 8|0);
             $3208 = HEAP32[$3207>>2]|0;
             $3209 = ((($913)) + 152|0);
             $3210 = HEAP32[$3209>>2]|0;
             $3211 = $907;
             $3212 = (($3211) + 1)|0;
             $907 = $3212;
             $3213 = (($3210) + ($3211<<2)|0);
             $3214 = HEAP32[$3213>>2]|0;
             $3215 = ((($3214)) + 8|0);
             HEAP32[$3215>>2] = $3208;
             $3216 = $909;
             $58 = $843;
             $59 = $3216;
             $3217 = $58;
             $3218 = HEAP32[$3217>>2]|0;
             $3219 = $59;
             $3220 = (($3218) + ($3219<<2)|0);
             $3221 = HEAP32[$3220>>2]|0;
             $3222 = ($3221|0)!=(0);
             if ($3222) {
              $3223 = $909;
              $60 = $843;
              $61 = $3223;
              $3224 = $60;
              $3225 = HEAP32[$3224>>2]|0;
              $3226 = $61;
              $3227 = (($3225) + ($3226<<2)|0);
              $3228 = HEAP32[$3227>>2]|0;
              $3229 = ((($913)) + 152|0);
              $3230 = HEAP32[$3229>>2]|0;
              $3231 = $907;
              $3232 = (($3230) + ($3231<<2)|0);
              $3233 = HEAP32[$3232>>2]|0;
              HEAP32[$3233>>2] = $3228;
              $3234 = ((($913)) + 152|0);
              $3235 = HEAP32[$3234>>2]|0;
              $3236 = $907;
              $3237 = (($3235) + ($3236<<2)|0);
              $3238 = HEAP32[$3237>>2]|0;
              $3239 = ((($3238)) + 4|0);
              HEAP32[$3239>>2] = 44;
              $3240 = ((($913)) + 152|0);
              $3241 = HEAP32[$3240>>2]|0;
              $3242 = $907;
              $3243 = (($3242) + 1)|0;
              $907 = $3243;
              $3244 = (($3241) + ($3242<<2)|0);
              $3245 = HEAP32[$3244>>2]|0;
              $3246 = ((($3245)) + 8|0);
              HEAP32[$3246>>2] = -1;
              $3247 = $909;
              $3248 = (($3247) + 1)|0;
              $62 = $843;
              $63 = $3248;
              $3249 = $62;
              $3250 = HEAP32[$3249>>2]|0;
              $3251 = $63;
              $3252 = (($3250) + ($3251<<2)|0);
              $3253 = HEAP32[$3252>>2]|0;
              $3254 = ((($913)) + 152|0);
              $3255 = HEAP32[$3254>>2]|0;
              $3256 = $907;
              $3257 = (($3255) + ($3256<<2)|0);
              $3258 = HEAP32[$3257>>2]|0;
              HEAP32[$3258>>2] = $3253;
              $3259 = ((($913)) + 152|0);
              $3260 = HEAP32[$3259>>2]|0;
              $3261 = $907;
              $3262 = (($3260) + ($3261<<2)|0);
              $3263 = HEAP32[$3262>>2]|0;
              $3264 = ((($3263)) + 4|0);
              HEAP32[$3264>>2] = 27;
              $3265 = ((($913)) + 152|0);
              $3266 = HEAP32[$3265>>2]|0;
              $3267 = $907;
              $3268 = (($3267) + 1)|0;
              $907 = $3268;
              $3269 = (($3266) + ($3267<<2)|0);
              $3270 = HEAP32[$3269>>2]|0;
              $3271 = ((($3270)) + 8|0);
              HEAP32[$3271>>2] = -1;
              $3272 = $909;
              $3273 = (($3272) + 2)|0;
              $64 = $843;
              $65 = $3273;
              $3274 = $64;
              $3275 = HEAP32[$3274>>2]|0;
              $3276 = $65;
              $3277 = (($3275) + ($3276<<2)|0);
              $3278 = HEAP32[$3277>>2]|0;
              $3279 = ((($913)) + 152|0);
              $3280 = HEAP32[$3279>>2]|0;
              $3281 = $907;
              $3282 = (($3280) + ($3281<<2)|0);
              $3283 = HEAP32[$3282>>2]|0;
              HEAP32[$3283>>2] = $3278;
              $3284 = ((($913)) + 152|0);
              $3285 = HEAP32[$3284>>2]|0;
              $3286 = $907;
              $3287 = (($3285) + ($3286<<2)|0);
              $3288 = HEAP32[$3287>>2]|0;
              $3289 = ((($3288)) + 4|0);
              HEAP32[$3289>>2] = 45;
              $3290 = ((($913)) + 152|0);
              $3291 = HEAP32[$3290>>2]|0;
              $3292 = $907;
              $3293 = (($3292) + 1)|0;
              $907 = $3293;
              $3294 = (($3291) + ($3292<<2)|0);
              $3295 = HEAP32[$3294>>2]|0;
              $3296 = ((($3295)) + 8|0);
              HEAP32[$3296>>2] = -1;
             }
             $3297 = $909;
             $66 = $840;
             $67 = $3297;
             $3298 = $66;
             $3299 = HEAP32[$3298>>2]|0;
             $3300 = $67;
             $3301 = (($3299) + ($3300<<2)|0);
             $3302 = HEAP32[$3301>>2]|0;
             $3303 = ($3302|0)!=(0);
             if ($3303) {
              $3304 = $909;
              $68 = $840;
              $69 = $3304;
              $3305 = $68;
              $3306 = HEAP32[$3305>>2]|0;
              $3307 = $69;
              $3308 = (($3306) + ($3307<<2)|0);
              $3309 = HEAP32[$3308>>2]|0;
              $3310 = ((($913)) + 152|0);
              $3311 = HEAP32[$3310>>2]|0;
              $3312 = $907;
              $3313 = (($3311) + ($3312<<2)|0);
              $3314 = HEAP32[$3313>>2]|0;
              HEAP32[$3314>>2] = $3309;
              $3315 = ((($913)) + 152|0);
              $3316 = HEAP32[$3315>>2]|0;
              $3317 = $907;
              $3318 = (($3316) + ($3317<<2)|0);
              $3319 = HEAP32[$3318>>2]|0;
              $3320 = ((($3319)) + 4|0);
              HEAP32[$3320>>2] = 42;
              $3321 = ((($913)) + 152|0);
              $3322 = HEAP32[$3321>>2]|0;
              $3323 = $907;
              $3324 = (($3323) + 1)|0;
              $907 = $3324;
              $3325 = (($3322) + ($3323<<2)|0);
              $3326 = HEAP32[$3325>>2]|0;
              $3327 = ((($3326)) + 8|0);
              HEAP32[$3327>>2] = -1;
              $3328 = $909;
              $3329 = (($3328) + 1)|0;
              $70 = $840;
              $71 = $3329;
              $3330 = $70;
              $3331 = HEAP32[$3330>>2]|0;
              $3332 = $71;
              $3333 = (($3331) + ($3332<<2)|0);
              $3334 = HEAP32[$3333>>2]|0;
              $3335 = ((($913)) + 152|0);
              $3336 = HEAP32[$3335>>2]|0;
              $3337 = $907;
              $3338 = (($3336) + ($3337<<2)|0);
              $3339 = HEAP32[$3338>>2]|0;
              HEAP32[$3339>>2] = $3334;
              $3340 = ((($913)) + 152|0);
              $3341 = HEAP32[$3340>>2]|0;
              $3342 = $907;
              $3343 = (($3341) + ($3342<<2)|0);
              $3344 = HEAP32[$3343>>2]|0;
              $3345 = ((($3344)) + 4|0);
              HEAP32[$3345>>2] = 24;
              $3346 = ((($913)) + 152|0);
              $3347 = HEAP32[$3346>>2]|0;
              $3348 = $907;
              $3349 = (($3348) + 1)|0;
              $907 = $3349;
              $3350 = (($3347) + ($3348<<2)|0);
              $3351 = HEAP32[$3350>>2]|0;
              $3352 = ((($3351)) + 8|0);
              HEAP32[$3352>>2] = -1;
              $3353 = $909;
              $3354 = (($3353) + 2)|0;
              $72 = $840;
              $73 = $3354;
              $3355 = $72;
              $3356 = HEAP32[$3355>>2]|0;
              $3357 = $73;
              $3358 = (($3356) + ($3357<<2)|0);
              $3359 = HEAP32[$3358>>2]|0;
              $3360 = ((($913)) + 152|0);
              $3361 = HEAP32[$3360>>2]|0;
              $3362 = $907;
              $3363 = (($3361) + ($3362<<2)|0);
              $3364 = HEAP32[$3363>>2]|0;
              HEAP32[$3364>>2] = $3359;
              $3365 = ((($913)) + 152|0);
              $3366 = HEAP32[$3365>>2]|0;
              $3367 = $907;
              $3368 = (($3366) + ($3367<<2)|0);
              $3369 = HEAP32[$3368>>2]|0;
              $3370 = ((($3369)) + 4|0);
              HEAP32[$3370>>2] = 43;
              $3371 = ((($913)) + 152|0);
              $3372 = HEAP32[$3371>>2]|0;
              $3373 = $907;
              $3374 = (($3373) + 1)|0;
              $907 = $3374;
              $3375 = (($3372) + ($3373<<2)|0);
              $3376 = HEAP32[$3375>>2]|0;
              $3377 = ((($3376)) + 8|0);
              HEAP32[$3377>>2] = -1;
             }
             $3378 = $909;
             $74 = $843;
             $75 = $3378;
             $3379 = $74;
             $3380 = HEAP32[$3379>>2]|0;
             $3381 = $75;
             $3382 = (($3380) + ($3381<<2)|0);
             $3383 = HEAP32[$3382>>2]|0;
             $3384 = ($3383|0)!=(0);
             L409: do {
              if (!($3384)) {
               $3385 = $909;
               $76 = $840;
               $77 = $3385;
               $3386 = $76;
               $3387 = HEAP32[$3386>>2]|0;
               $3388 = $77;
               $3389 = (($3387) + ($3388<<2)|0);
               $3390 = HEAP32[$3389>>2]|0;
               $3391 = ($3390|0)!=(0);
               if ($3391) {
                break;
               }
               $3392 = $852;
               $910 = $3392;
               while(1) {
                $3393 = $910;
                $3394 = ((($913)) + 168|0);
                $78 = $3394;
                $3395 = $78;
                $3396 = ((($3395)) + 4|0);
                $3397 = HEAP32[$3396>>2]|0;
                $3398 = HEAP32[$3395>>2]|0;
                $3399 = $3397;
                $3400 = $3398;
                $3401 = (($3399) - ($3400))|0;
                $3402 = (($3401|0) / 4)&-1;
                $3403 = ($3393|0)<($3402|0);
                if (!($3403)) {
                 break L409;
                }
                $3404 = ((($913)) + 168|0);
                $3405 = $910;
                $79 = $3404;
                $80 = $3405;
                $3406 = $79;
                $3407 = HEAP32[$3406>>2]|0;
                $3408 = $80;
                $3409 = (($3407) + ($3408<<2)|0);
                $3410 = HEAP32[$3409>>2]|0;
                $3411 = $827;
                $3412 = $908;
                $3413 = (($3412) - 1)|0;
                $3414 = (($3411) + ($3413<<2)|0);
                $3415 = HEAP32[$3414>>2]|0;
                $3416 = HEAP32[$3415>>2]|0;
                $3417 = ($3410|0)>($3416|0);
                if ($3417) {
                 $3418 = ((($913)) + 168|0);
                 $3419 = $910;
                 $81 = $3418;
                 $82 = $3419;
                 $3420 = $81;
                 $3421 = HEAP32[$3420>>2]|0;
                 $3422 = $82;
                 $3423 = (($3421) + ($3422<<2)|0);
                 $3424 = HEAP32[$3423>>2]|0;
                 $3425 = $827;
                 $3426 = $908;
                 $3427 = (($3425) + ($3426<<2)|0);
                 $3428 = HEAP32[$3427>>2]|0;
                 $3429 = HEAP32[$3428>>2]|0;
                 $3430 = ($3424|0)<($3429|0);
                 if ($3430) {
                  break;
                 }
                }
                $3458 = $910;
                $3459 = (($3458) + 1)|0;
                $910 = $3459;
               }
               $3431 = ((($913)) + 168|0);
               $3432 = $910;
               $83 = $3431;
               $84 = $3432;
               $3433 = $83;
               $3434 = HEAP32[$3433>>2]|0;
               $3435 = $84;
               $3436 = (($3434) + ($3435<<2)|0);
               $3437 = HEAP32[$3436>>2]|0;
               $3438 = ((($913)) + 152|0);
               $3439 = HEAP32[$3438>>2]|0;
               $3440 = $907;
               $3441 = (($3439) + ($3440<<2)|0);
               $3442 = HEAP32[$3441>>2]|0;
               HEAP32[$3442>>2] = $3437;
               $3443 = ((($913)) + 152|0);
               $3444 = HEAP32[$3443>>2]|0;
               $3445 = $907;
               $3446 = (($3444) + ($3445<<2)|0);
               $3447 = HEAP32[$3446>>2]|0;
               $3448 = ((($3447)) + 4|0);
               HEAP32[$3448>>2] = 14;
               $3449 = ((($913)) + 152|0);
               $3450 = HEAP32[$3449>>2]|0;
               $3451 = $907;
               $3452 = (($3451) + 1)|0;
               $907 = $3452;
               $3453 = (($3450) + ($3451<<2)|0);
               $3454 = HEAP32[$3453>>2]|0;
               $3455 = ((($3454)) + 8|0);
               HEAP32[$3455>>2] = -1;
               $3456 = $852;
               $3457 = (($3456) + 1)|0;
               $852 = $3457;
              }
             } while(0);
             $3460 = $909;
             $3461 = (($3460) + 3)|0;
             $909 = $3461;
            }
            $3462 = $828;
            $3463 = (($3462) - 1)|0;
            $3464 = ($3463*3)|0;
            $911 = $3464;
            $3465 = $827;
            $3466 = $908;
            $3467 = (($3465) + ($3466<<2)|0);
            $3468 = HEAP32[$3467>>2]|0;
            $3469 = HEAP32[$3468>>2]|0;
            $3470 = ((($913)) + 152|0);
            $3471 = HEAP32[$3470>>2]|0;
            $3472 = $907;
            $3473 = (($3471) + ($3472<<2)|0);
            $3474 = HEAP32[$3473>>2]|0;
            HEAP32[$3474>>2] = $3469;
            $3475 = $827;
            $3476 = $908;
            $3477 = (($3475) + ($3476<<2)|0);
            $3478 = HEAP32[$3477>>2]|0;
            $3479 = ((($3478)) + 4|0);
            $3480 = HEAP32[$3479>>2]|0;
            $3481 = ((($913)) + 152|0);
            $3482 = HEAP32[$3481>>2]|0;
            $3483 = $907;
            $3484 = (($3482) + ($3483<<2)|0);
            $3485 = HEAP32[$3484>>2]|0;
            $3486 = ((($3485)) + 4|0);
            HEAP32[$3486>>2] = $3480;
            $3487 = $827;
            $3488 = $908;
            $3489 = (($3488) + 1)|0;
            $908 = $3489;
            $3490 = (($3487) + ($3488<<2)|0);
            $3491 = HEAP32[$3490>>2]|0;
            $3492 = ((($3491)) + 8|0);
            $3493 = HEAP32[$3492>>2]|0;
            $3494 = ((($913)) + 152|0);
            $3495 = HEAP32[$3494>>2]|0;
            $3496 = $907;
            $3497 = (($3496) + 1)|0;
            $907 = $3497;
            $3498 = (($3495) + ($3496<<2)|0);
            $3499 = HEAP32[$3498>>2]|0;
            $3500 = ((($3499)) + 8|0);
            HEAP32[$3500>>2] = $3493;
            $3501 = $911;
            $85 = $895;
            $86 = $3501;
            $3502 = $85;
            $3503 = HEAP32[$3502>>2]|0;
            $3504 = $86;
            $3505 = (($3503) + ($3504<<2)|0);
            $3506 = HEAP32[$3505>>2]|0;
            $3507 = ($3506|0)!=(0);
            if ($3507) {
             $3508 = $911;
             $87 = $895;
             $88 = $3508;
             $3509 = $87;
             $3510 = HEAP32[$3509>>2]|0;
             $3511 = $88;
             $3512 = (($3510) + ($3511<<2)|0);
             $3513 = HEAP32[$3512>>2]|0;
             $3514 = ((($913)) + 152|0);
             $3515 = HEAP32[$3514>>2]|0;
             $3516 = $907;
             $3517 = (($3515) + ($3516<<2)|0);
             $3518 = HEAP32[$3517>>2]|0;
             HEAP32[$3518>>2] = $3513;
             $3519 = $911;
             $89 = $896;
             $90 = $3519;
             $3520 = $89;
             $3521 = HEAP32[$3520>>2]|0;
             $3522 = $90;
             $3523 = (($3521) + ($3522)|0);
             $3524 = HEAP8[$3523>>0]|0;
             $3525 = $3524 << 24 >> 24;
             $3526 = ((($913)) + 152|0);
             $3527 = HEAP32[$3526>>2]|0;
             $3528 = $907;
             $3529 = (($3527) + ($3528<<2)|0);
             $3530 = HEAP32[$3529>>2]|0;
             $3531 = ((($3530)) + 4|0);
             HEAP32[$3531>>2] = $3525;
             $3532 = ((($913)) + 152|0);
             $3533 = HEAP32[$3532>>2]|0;
             $3534 = $907;
             $3535 = (($3534) + 1)|0;
             $907 = $3535;
             $3536 = (($3533) + ($3534<<2)|0);
             $3537 = HEAP32[$3536>>2]|0;
             $3538 = ((($3537)) + 8|0);
             HEAP32[$3538>>2] = -1;
            }
            $3539 = $911;
            $3540 = (($3539) + 1)|0;
            $91 = $895;
            $92 = $3540;
            $3541 = $91;
            $3542 = HEAP32[$3541>>2]|0;
            $3543 = $92;
            $3544 = (($3542) + ($3543<<2)|0);
            $3545 = HEAP32[$3544>>2]|0;
            $3546 = ($3545|0)!=(0);
            if ($3546) {
             $3547 = $911;
             $3548 = (($3547) + 1)|0;
             $93 = $895;
             $94 = $3548;
             $3549 = $93;
             $3550 = HEAP32[$3549>>2]|0;
             $3551 = $94;
             $3552 = (($3550) + ($3551<<2)|0);
             $3553 = HEAP32[$3552>>2]|0;
             $3554 = ((($913)) + 152|0);
             $3555 = HEAP32[$3554>>2]|0;
             $3556 = $907;
             $3557 = (($3555) + ($3556<<2)|0);
             $3558 = HEAP32[$3557>>2]|0;
             HEAP32[$3558>>2] = $3553;
             $3559 = $911;
             $3560 = (($3559) + 1)|0;
             $95 = $896;
             $96 = $3560;
             $3561 = $95;
             $3562 = HEAP32[$3561>>2]|0;
             $3563 = $96;
             $3564 = (($3562) + ($3563)|0);
             $3565 = HEAP8[$3564>>0]|0;
             $3566 = $3565 << 24 >> 24;
             $3567 = ((($913)) + 152|0);
             $3568 = HEAP32[$3567>>2]|0;
             $3569 = $907;
             $3570 = (($3568) + ($3569<<2)|0);
             $3571 = HEAP32[$3570>>2]|0;
             $3572 = ((($3571)) + 4|0);
             HEAP32[$3572>>2] = $3566;
             $3573 = ((($913)) + 152|0);
             $3574 = HEAP32[$3573>>2]|0;
             $3575 = $907;
             $3576 = (($3575) + 1)|0;
             $907 = $3576;
             $3577 = (($3574) + ($3575<<2)|0);
             $3578 = HEAP32[$3577>>2]|0;
             $3579 = ((($3578)) + 8|0);
             HEAP32[$3579>>2] = -1;
            }
            $3580 = $911;
            $3581 = (($3580) + 2)|0;
            $97 = $895;
            $98 = $3581;
            $3582 = $97;
            $3583 = HEAP32[$3582>>2]|0;
            $3584 = $98;
            $3585 = (($3583) + ($3584<<2)|0);
            $3586 = HEAP32[$3585>>2]|0;
            $3587 = ($3586|0)!=(0);
            if ($3587) {
             $3588 = $911;
             $3589 = (($3588) + 2)|0;
             $99 = $895;
             $100 = $3589;
             $3590 = $99;
             $3591 = HEAP32[$3590>>2]|0;
             $3592 = $100;
             $3593 = (($3591) + ($3592<<2)|0);
             $3594 = HEAP32[$3593>>2]|0;
             $3595 = ((($913)) + 152|0);
             $3596 = HEAP32[$3595>>2]|0;
             $3597 = $907;
             $3598 = (($3596) + ($3597<<2)|0);
             $3599 = HEAP32[$3598>>2]|0;
             HEAP32[$3599>>2] = $3594;
             $3600 = $911;
             $3601 = (($3600) + 2)|0;
             $101 = $896;
             $102 = $3601;
             $3602 = $101;
             $3603 = HEAP32[$3602>>2]|0;
             $3604 = $102;
             $3605 = (($3603) + ($3604)|0);
             $3606 = HEAP8[$3605>>0]|0;
             $3607 = $3606 << 24 >> 24;
             $3608 = ((($913)) + 152|0);
             $3609 = HEAP32[$3608>>2]|0;
             $3610 = $907;
             $3611 = (($3609) + ($3610<<2)|0);
             $3612 = HEAP32[$3611>>2]|0;
             $3613 = ((($3612)) + 4|0);
             HEAP32[$3613>>2] = $3607;
             $3614 = ((($913)) + 152|0);
             $3615 = HEAP32[$3614>>2]|0;
             $3616 = $907;
             $3617 = (($3616) + 1)|0;
             $907 = $3617;
             $3618 = (($3615) + ($3616<<2)|0);
             $3619 = HEAP32[$3618>>2]|0;
             $3620 = ((($3619)) + 8|0);
             HEAP32[$3620>>2] = -1;
            }
            $3621 = $827;
            $3622 = $908;
            $3623 = (($3621) + ($3622<<2)|0);
            $3624 = HEAP32[$3623>>2]|0;
            $3625 = HEAP32[$3624>>2]|0;
            $3626 = ((($913)) + 152|0);
            $3627 = HEAP32[$3626>>2]|0;
            $3628 = $907;
            $3629 = (($3627) + ($3628<<2)|0);
            $3630 = HEAP32[$3629>>2]|0;
            HEAP32[$3630>>2] = $3625;
            $3631 = $827;
            $3632 = $908;
            $3633 = (($3631) + ($3632<<2)|0);
            $3634 = HEAP32[$3633>>2]|0;
            $3635 = ((($3634)) + 4|0);
            $3636 = HEAP32[$3635>>2]|0;
            $3637 = ((($913)) + 152|0);
            $3638 = HEAP32[$3637>>2]|0;
            $3639 = $907;
            $3640 = (($3638) + ($3639<<2)|0);
            $3641 = HEAP32[$3640>>2]|0;
            $3642 = ((($3641)) + 4|0);
            HEAP32[$3642>>2] = $3636;
            $3643 = $827;
            $3644 = $908;
            $3645 = (($3644) + 1)|0;
            $908 = $3645;
            $3646 = (($3643) + ($3644<<2)|0);
            $3647 = HEAP32[$3646>>2]|0;
            $3648 = ((($3647)) + 8|0);
            $3649 = HEAP32[$3648>>2]|0;
            $3650 = ((($913)) + 152|0);
            $3651 = HEAP32[$3650>>2]|0;
            $3652 = $907;
            $3653 = (($3652) + 1)|0;
            $907 = $3653;
            $3654 = (($3651) + ($3652<<2)|0);
            $3655 = HEAP32[$3654>>2]|0;
            $3656 = ((($3655)) + 8|0);
            HEAP32[$3656>>2] = $3649;
            $3657 = $852;
            $3658 = ((($913)) + 168|0);
            $103 = $3658;
            $3659 = $103;
            $3660 = ((($3659)) + 4|0);
            $3661 = HEAP32[$3660>>2]|0;
            $3662 = HEAP32[$3659>>2]|0;
            $3663 = $3661;
            $3664 = $3662;
            $3665 = (($3663) - ($3664))|0;
            $3666 = (($3665|0) / 4)&-1;
            $3667 = ($3657|0)<($3666|0);
            if ($3667) {
             $3668 = ((($913)) + 168|0);
             $3669 = $852;
             $104 = $3668;
             $105 = $3669;
             $3670 = $104;
             $3671 = HEAP32[$3670>>2]|0;
             $3672 = $105;
             $3673 = (($3671) + ($3672<<2)|0);
             $3674 = HEAP32[$3673>>2]|0;
             $3675 = $827;
             $3676 = $908;
             $3677 = (($3676) - 1)|0;
             $3678 = (($3675) + ($3677<<2)|0);
             $3679 = HEAP32[$3678>>2]|0;
             $3680 = HEAP32[$3679>>2]|0;
             $3681 = ($3674|0)>($3680|0);
             if ($3681) {
              $3682 = ((($913)) + 168|0);
              $3683 = $852;
              $106 = $3682;
              $107 = $3683;
              $3684 = $106;
              $3685 = HEAP32[$3684>>2]|0;
              $3686 = $107;
              $3687 = (($3685) + ($3686<<2)|0);
              $3688 = HEAP32[$3687>>2]|0;
              $3689 = ((($913)) + 152|0);
              $3690 = HEAP32[$3689>>2]|0;
              $3691 = $907;
              $3692 = (($3690) + ($3691<<2)|0);
              $3693 = HEAP32[$3692>>2]|0;
              HEAP32[$3693>>2] = $3688;
              $3694 = ((($913)) + 152|0);
              $3695 = HEAP32[$3694>>2]|0;
              $3696 = $907;
              $3697 = (($3695) + ($3696<<2)|0);
              $3698 = HEAP32[$3697>>2]|0;
              $3699 = ((($3698)) + 4|0);
              HEAP32[$3699>>2] = 14;
              $3700 = ((($913)) + 152|0);
              $3701 = HEAP32[$3700>>2]|0;
              $3702 = $907;
              $3703 = (($3702) + 1)|0;
              $907 = $3703;
              $3704 = (($3701) + ($3702<<2)|0);
              $3705 = HEAP32[$3704>>2]|0;
              $3706 = ((($3705)) + 8|0);
              HEAP32[$3706>>2] = -1;
             }
            }
            $3707 = ((($913)) + 152|0);
            $3708 = HEAP32[$3707>>2]|0;
            $822 = $3708;
            $912 = 1;
           } else {
            $822 = 0;
            $912 = 1;
           }
           __THREW__ = 0;
           invoke_vi(5,($903|0));
           $3709 = __THREW__; __THREW__ = 0;
           $3710 = $3709&1;
           if ($3710) {
            label = 224;
            break L304;
           }
           __THREW__ = 0;
           invoke_vi(61,($896|0));
           $3711 = __THREW__; __THREW__ = 0;
           $3712 = $3711&1;
           if ($3712) {
            $2606 = ___cxa_find_matching_catch_2()|0;
            $2607 = tempRet0;
            $841 = $2606;
            $842 = $2607;
            break L304;
           }
           __THREW__ = 0;
           invoke_vi(36,($895|0));
           $3713 = __THREW__; __THREW__ = 0;
           $3714 = $3713&1;
           if ($3714) {
            label = 28;
            break L287;
           }
           __THREW__ = 0;
           invoke_vi(36,($843|0));
           $3717 = __THREW__; __THREW__ = 0;
           $3718 = $3717&1;
           if ($3718) {
            $1174 = ___cxa_find_matching_catch_2()|0;
            $1175 = tempRet0;
            $841 = $1174;
            $842 = $1175;
            label = 333;
            break L287;
           }
           __THREW__ = 0;
           invoke_vi(36,($840|0));
           $3721 = __THREW__; __THREW__ = 0;
           $3722 = $3721&1;
           if ($3722) {
            $1172 = ___cxa_find_matching_catch_2()|0;
            $1173 = tempRet0;
            $841 = $1172;
            $842 = $1173;
            break L287;
           } else {
            __ZN3CWTD2Ev($839);
            $3725 = $822;
            STACKTOP = sp;return ($3725|0);
           }
          }
         }
        }
       } while(0);
       $2678 = ___cxa_find_matching_catch_2()|0;
       $2679 = tempRet0;
       $841 = $2678;
       $842 = $2679;
       __THREW__ = 0;
       invoke_vi(5,($903|0));
       $2680 = __THREW__; __THREW__ = 0;
       $2681 = $2680&1;
       if ($2681) {
        $3732 = ___cxa_find_matching_catch_3(0|0)|0;
        $3733 = tempRet0;
        ___clang_call_terminate($3732);
        // unreachable;
       } else {
        label = 327;
       }
      }
     }
    }
   } while(0);
   if ((label|0) == 224) {
    $2608 = ___cxa_find_matching_catch_2()|0;
    $2609 = tempRet0;
    $841 = $2608;
    $842 = $2609;
    label = 327;
   }
   if ((label|0) == 327) {
    __THREW__ = 0;
    invoke_vi(61,($896|0));
    $3715 = __THREW__; __THREW__ = 0;
    $3716 = $3715&1;
    if ($3716) {
     $3732 = ___cxa_find_matching_catch_3(0|0)|0;
     $3733 = tempRet0;
     ___clang_call_terminate($3732);
     // unreachable;
    }
   }
   __THREW__ = 0;
   invoke_vi(36,($895|0));
   $3719 = __THREW__; __THREW__ = 0;
   $3720 = $3719&1;
   if ($3720) {
    $3732 = ___cxa_find_matching_catch_3(0|0)|0;
    $3733 = tempRet0;
    ___clang_call_terminate($3732);
    // unreachable;
   } else {
    label = 331;
   }
  }
 } while(0);
 if ((label|0) == 28) {
  $1176 = ___cxa_find_matching_catch_2()|0;
  $1177 = tempRet0;
  $841 = $1176;
  $842 = $1177;
  label = 331;
 }
 if ((label|0) == 331) {
  __THREW__ = 0;
  invoke_vi(36,($843|0));
  $3723 = __THREW__; __THREW__ = 0;
  $3724 = $3723&1;
  if ($3724) {
   $3732 = ___cxa_find_matching_catch_3(0|0)|0;
   $3733 = tempRet0;
   ___clang_call_terminate($3732);
   // unreachable;
  } else {
   label = 333;
  }
 }
 if ((label|0) == 333) {
  __THREW__ = 0;
  invoke_vi(36,($840|0));
  $3726 = __THREW__; __THREW__ = 0;
  $3727 = $3726&1;
  if ($3727) {
   $3732 = ___cxa_find_matching_catch_3(0|0)|0;
   $3733 = tempRet0;
   ___clang_call_terminate($3732);
   // unreachable;
  }
 }
 __THREW__ = 0;
 invoke_vi(7,($839|0));
 $3728 = __THREW__; __THREW__ = 0;
 $3729 = $3728&1;
 if ($3729) {
  $3732 = ___cxa_find_matching_catch_3(0|0)|0;
  $3733 = tempRet0;
  ___clang_call_terminate($3732);
  // unreachable;
 } else {
  $3730 = $841;
  $3731 = $842;
  ___resumeException($3730|0);
  // unreachable;
 }
 return (0)|0;
}
function __ZNK13EcgAnnotation20GetEcgAnnotationSizeEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 $3 = ((($2)) + 156|0);
 $4 = HEAP32[$3>>2]|0;
 STACKTOP = sp;return ($4|0);
}
function __ZNSt3__26vectorIiNS_9allocatorIiEEE21__push_back_slow_pathIKiEEvRT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(160|0);
 $13 = sp;
 $16 = sp + 156|0;
 $24 = sp + 72|0;
 $27 = sp + 60|0;
 $35 = sp + 12|0;
 $32 = $0;
 $33 = $1;
 $38 = $32;
 $31 = $38;
 $39 = $31;
 $40 = ((($39)) + 8|0);
 $30 = $40;
 $41 = $30;
 $29 = $41;
 $42 = $29;
 $34 = $42;
 $28 = $38;
 $43 = $28;
 $44 = ((($43)) + 4|0);
 $45 = HEAP32[$44>>2]|0;
 $46 = HEAP32[$43>>2]|0;
 $47 = $45;
 $48 = $46;
 $49 = (($47) - ($48))|0;
 $50 = (($49|0) / 4)&-1;
 $51 = (($50) + 1)|0;
 $23 = $38;
 HEAP32[$24>>2] = $51;
 $52 = $23;
 $53 = (__ZNKSt3__26vectorIiNS_9allocatorIiEEE8max_sizeEv($52)|0);
 $25 = $53;
 $54 = HEAP32[$24>>2]|0;
 $55 = $25;
 $56 = ($54>>>0)>($55>>>0);
 if ($56) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($52);
  // unreachable;
 }
 $21 = $52;
 $57 = $21;
 $20 = $57;
 $58 = $20;
 $19 = $58;
 $59 = $19;
 $60 = ((($59)) + 8|0);
 $18 = $60;
 $61 = $18;
 $17 = $61;
 $62 = $17;
 $63 = HEAP32[$62>>2]|0;
 $64 = HEAP32[$58>>2]|0;
 $65 = $63;
 $66 = $64;
 $67 = (($65) - ($66))|0;
 $68 = (($67|0) / 4)&-1;
 $26 = $68;
 $69 = $26;
 $70 = $25;
 $71 = (($70>>>0) / 2)&-1;
 $72 = ($69>>>0)>=($71>>>0);
 if ($72) {
  $73 = $25;
  $22 = $73;
 } else {
  $74 = $26;
  $75 = $74<<1;
  HEAP32[$27>>2] = $75;
  $14 = $27;
  $15 = $24;
  $76 = $14;
  $77 = $15;
  ;HEAP8[$13>>0]=HEAP8[$16>>0]|0;
  $11 = $76;
  $12 = $77;
  $78 = $11;
  $79 = $12;
  $8 = $13;
  $9 = $78;
  $10 = $79;
  $80 = $9;
  $81 = HEAP32[$80>>2]|0;
  $82 = $10;
  $83 = HEAP32[$82>>2]|0;
  $84 = ($81>>>0)<($83>>>0);
  $85 = $12;
  $86 = $11;
  $87 = $84 ? $85 : $86;
  $88 = HEAP32[$87>>2]|0;
  $22 = $88;
 }
 $89 = $22;
 $7 = $38;
 $90 = $7;
 $91 = ((($90)) + 4|0);
 $92 = HEAP32[$91>>2]|0;
 $93 = HEAP32[$90>>2]|0;
 $94 = $92;
 $95 = $93;
 $96 = (($94) - ($95))|0;
 $97 = (($96|0) / 4)&-1;
 $98 = $34;
 __ZNSt3__214__split_bufferIiRNS_9allocatorIiEEEC2EjjS3_($35,$89,$97,$98);
 $99 = $34;
 $100 = ((($35)) + 8|0);
 $101 = HEAP32[$100>>2]|0;
 $6 = $101;
 $102 = $6;
 $103 = $33;
 $5 = $103;
 $104 = $5;
 $2 = $99;
 $3 = $102;
 $4 = $104;
 $105 = $3;
 $106 = $4;
 $107 = HEAP32[$106>>2]|0;
 HEAP32[$105>>2] = $107;
 $108 = ((($35)) + 8|0);
 $109 = HEAP32[$108>>2]|0;
 $110 = ((($109)) + 4|0);
 HEAP32[$108>>2] = $110;
 __THREW__ = 0;
 invoke_vii(62,($38|0),($35|0));
 $111 = __THREW__; __THREW__ = 0;
 $112 = $111&1;
 if (!($112)) {
  __ZNSt3__214__split_bufferIiRNS_9allocatorIiEEED2Ev($35);
  STACKTOP = sp;return;
 }
 $113 = ___cxa_find_matching_catch_2()|0;
 $114 = tempRet0;
 $36 = $113;
 $37 = $114;
 __THREW__ = 0;
 invoke_vi(63,($35|0));
 $115 = __THREW__; __THREW__ = 0;
 $116 = $115&1;
 if ($116) {
  $119 = ___cxa_find_matching_catch_3(0|0)|0;
  $120 = tempRet0;
  ___clang_call_terminate($119);
  // unreachable;
 } else {
  $117 = $36;
  $118 = $37;
  ___resumeException($117|0);
  // unreachable;
 }
}
function __ZNK13EcgAnnotation8FindTmaxEPKdi($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0.0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0.0, $34 = 0.0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $7 = sp + 8|0;
 $8 = sp;
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $13 = $4;
 $14 = $5;
 $15 = $6;
 __ZNK6Signal6MinMaxEPKdiRdS2_($13,$14,$15,$7,$8);
 $9 = -1;
 $10 = -1;
 $11 = 0;
 while(1) {
  $16 = $11;
  $17 = $6;
  $18 = ($16|0)<($17|0);
  if (!($18)) {
   break;
  }
  $19 = $5;
  $20 = $11;
  $21 = (($19) + ($20<<3)|0);
  $22 = +HEAPF64[$21>>3];
  $23 = +HEAPF64[$8>>3];
  $24 = $22 == $23;
  $25 = $11;
  if ($24) {
   label = 4;
   break;
  }
  $26 = (($25) + 1)|0;
  $11 = $26;
 }
 if ((label|0) == 4) {
  $10 = $25;
 }
 $12 = 0;
 while(1) {
  $27 = $12;
  $28 = $6;
  $29 = ($27|0)<($28|0);
  if (!($29)) {
   break;
  }
  $30 = $5;
  $31 = $12;
  $32 = (($30) + ($31<<3)|0);
  $33 = +HEAPF64[$32>>3];
  $34 = +HEAPF64[$7>>3];
  $35 = $33 == $34;
  $36 = $12;
  if ($35) {
   label = 9;
   break;
  }
  $37 = (($36) + 1)|0;
  $12 = $37;
 }
 if ((label|0) == 9) {
  $9 = $36;
 }
 $38 = $9;
 $39 = ($38|0)==(-1);
 $40 = $10;
 $41 = ($40|0)==(-1);
 $or$cond = $39 | $41;
 if ($or$cond) {
  $3 = -1;
  $55 = $3;
  STACKTOP = sp;return ($55|0);
 }
 $42 = $10;
 $43 = $6;
 $44 = (($43|0) / 2)&-1;
 $45 = (($42) - ($44))|0;
 $46 = (Math_abs(($45|0))|0);
 $47 = $9;
 $48 = $6;
 $49 = (($48|0) / 2)&-1;
 $50 = (($47) - ($49))|0;
 $51 = (Math_abs(($50|0))|0);
 $52 = ($46|0)<($51|0);
 if ($52) {
  $53 = $10;
  $3 = $53;
  $55 = $3;
  STACKTOP = sp;return ($55|0);
 } else {
  $54 = $9;
  $3 = $54;
  $55 = $3;
  STACKTOP = sp;return ($55|0);
 }
 return (0)|0;
}
function __ZNSt3__26vectorIcNS_9allocatorIcEEE21__push_back_slow_pathIKcEEvRT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(160|0);
 $13 = sp;
 $16 = sp + 156|0;
 $24 = sp + 72|0;
 $27 = sp + 60|0;
 $35 = sp + 12|0;
 $32 = $0;
 $33 = $1;
 $38 = $32;
 $31 = $38;
 $39 = $31;
 $40 = ((($39)) + 8|0);
 $30 = $40;
 $41 = $30;
 $29 = $41;
 $42 = $29;
 $34 = $42;
 $28 = $38;
 $43 = $28;
 $44 = ((($43)) + 4|0);
 $45 = HEAP32[$44>>2]|0;
 $46 = HEAP32[$43>>2]|0;
 $47 = $45;
 $48 = $46;
 $49 = (($47) - ($48))|0;
 $50 = (($49) + 1)|0;
 $23 = $38;
 HEAP32[$24>>2] = $50;
 $51 = $23;
 $52 = (__ZNKSt3__26vectorIcNS_9allocatorIcEEE8max_sizeEv($51)|0);
 $25 = $52;
 $53 = HEAP32[$24>>2]|0;
 $54 = $25;
 $55 = ($53>>>0)>($54>>>0);
 if ($55) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($51);
  // unreachable;
 }
 $21 = $51;
 $56 = $21;
 $20 = $56;
 $57 = $20;
 $19 = $57;
 $58 = $19;
 $59 = ((($58)) + 8|0);
 $18 = $59;
 $60 = $18;
 $17 = $60;
 $61 = $17;
 $62 = HEAP32[$61>>2]|0;
 $63 = HEAP32[$57>>2]|0;
 $64 = $62;
 $65 = $63;
 $66 = (($64) - ($65))|0;
 $26 = $66;
 $67 = $26;
 $68 = $25;
 $69 = (($68>>>0) / 2)&-1;
 $70 = ($67>>>0)>=($69>>>0);
 if ($70) {
  $71 = $25;
  $22 = $71;
 } else {
  $72 = $26;
  $73 = $72<<1;
  HEAP32[$27>>2] = $73;
  $14 = $27;
  $15 = $24;
  $74 = $14;
  $75 = $15;
  ;HEAP8[$13>>0]=HEAP8[$16>>0]|0;
  $11 = $74;
  $12 = $75;
  $76 = $11;
  $77 = $12;
  $8 = $13;
  $9 = $76;
  $10 = $77;
  $78 = $9;
  $79 = HEAP32[$78>>2]|0;
  $80 = $10;
  $81 = HEAP32[$80>>2]|0;
  $82 = ($79>>>0)<($81>>>0);
  $83 = $12;
  $84 = $11;
  $85 = $82 ? $83 : $84;
  $86 = HEAP32[$85>>2]|0;
  $22 = $86;
 }
 $87 = $22;
 $7 = $38;
 $88 = $7;
 $89 = ((($88)) + 4|0);
 $90 = HEAP32[$89>>2]|0;
 $91 = HEAP32[$88>>2]|0;
 $92 = $90;
 $93 = $91;
 $94 = (($92) - ($93))|0;
 $95 = $34;
 __ZNSt3__214__split_bufferIcRNS_9allocatorIcEEEC2EjjS3_($35,$87,$94,$95);
 $96 = $34;
 $97 = ((($35)) + 8|0);
 $98 = HEAP32[$97>>2]|0;
 $6 = $98;
 $99 = $6;
 $100 = $33;
 $5 = $100;
 $101 = $5;
 $2 = $96;
 $3 = $99;
 $4 = $101;
 $102 = $3;
 $103 = $4;
 $104 = HEAP8[$103>>0]|0;
 HEAP8[$102>>0] = $104;
 $105 = ((($35)) + 8|0);
 $106 = HEAP32[$105>>2]|0;
 $107 = ((($106)) + 1|0);
 HEAP32[$105>>2] = $107;
 __THREW__ = 0;
 invoke_vii(64,($38|0),($35|0));
 $108 = __THREW__; __THREW__ = 0;
 $109 = $108&1;
 if (!($109)) {
  __ZNSt3__214__split_bufferIcRNS_9allocatorIcEEED2Ev($35);
  STACKTOP = sp;return;
 }
 $110 = ___cxa_find_matching_catch_2()|0;
 $111 = tempRet0;
 $36 = $110;
 $37 = $111;
 __THREW__ = 0;
 invoke_vi(65,($35|0));
 $112 = __THREW__; __THREW__ = 0;
 $113 = $112&1;
 if ($113) {
  $116 = ___cxa_find_matching_catch_3(0|0)|0;
  $117 = tempRet0;
  ___clang_call_terminate($116);
  // unreachable;
 } else {
  $114 = $36;
  $115 = $37;
  ___resumeException($114|0);
  // unreachable;
 }
}
function __ZNK13EcgAnnotation6FindRSEPKdiRiS2_d($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = +$5;
 var $10 = 0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0.0, $26 = 0, $27 = 0.0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0.0, $33 = 0, $34 = 0.0, $35 = 0.0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0.0, $45 = 0.0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $50 = 0.0, $51 = 0, $52 = 0.0, $53 = 0, $54 = 0.0, $55 = 0, $56 = 0.0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0.0, $62 = 0, $63 = 0.0, $64 = 0.0, $65 = 0.0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0.0, $75 = 0.0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $12 = sp + 8|0;
 $13 = sp;
 $6 = $0;
 $7 = $1;
 $8 = $2;
 $9 = $3;
 $10 = $4;
 $11 = $5;
 $16 = $6;
 $17 = $7;
 $18 = $8;
 __ZNK6Signal6MinMaxEPKdiRdS2_($16,$17,$18,$12,$13);
 $19 = $9;
 HEAP32[$19>>2] = -1;
 $20 = $10;
 HEAP32[$20>>2] = -1;
 $21 = +HEAPF64[$13>>3];
 $22 = $21 < 0.0;
 L1: do {
  if (!($22)) {
   $23 = +HEAPF64[$13>>3];
   $24 = $7;
   $25 = +HEAPF64[$24>>3];
   $26 = $23 == $25;
   if (!($26)) {
    $27 = +HEAPF64[$13>>3];
    $28 = $7;
    $29 = $8;
    $30 = (($29) - 1)|0;
    $31 = (($28) + ($30<<3)|0);
    $32 = +HEAPF64[$31>>3];
    $33 = $27 == $32;
    if (!($33)) {
     $34 = +HEAPF64[$13>>3];
     $35 = $11;
     $36 = $34 < $35;
     if (!($36)) {
      $14 = 1;
      while(1) {
       $37 = $14;
       $38 = $8;
       $39 = (($38) - 1)|0;
       $40 = ($37|0)<($39|0);
       if (!($40)) {
        break L1;
       }
       $41 = $7;
       $42 = $14;
       $43 = (($41) + ($42<<3)|0);
       $44 = +HEAPF64[$43>>3];
       $45 = +HEAPF64[$13>>3];
       $46 = $44 == $45;
       $47 = $14;
       if ($46) {
        break;
       }
       $49 = (($47) + 1)|0;
       $14 = $49;
      }
      $48 = $9;
      HEAP32[$48>>2] = $47;
     }
    }
   }
  }
 } while(0);
 $50 = +HEAPF64[$12>>3];
 $51 = $50 > 0.0;
 if ($51) {
  STACKTOP = sp;return;
 }
 $52 = +HEAPF64[$12>>3];
 $53 = $7;
 $54 = +HEAPF64[$53>>3];
 $55 = $52 == $54;
 if ($55) {
  STACKTOP = sp;return;
 }
 $56 = +HEAPF64[$12>>3];
 $57 = $7;
 $58 = $8;
 $59 = (($58) - 1)|0;
 $60 = (($57) + ($59<<3)|0);
 $61 = +HEAPF64[$60>>3];
 $62 = $56 == $61;
 if ($62) {
  STACKTOP = sp;return;
 }
 $63 = +HEAPF64[$12>>3];
 $64 = -$63;
 $65 = $11;
 $66 = $64 < $65;
 if ($66) {
  STACKTOP = sp;return;
 }
 $15 = 1;
 while(1) {
  $67 = $15;
  $68 = $8;
  $69 = (($68) - 1)|0;
  $70 = ($67|0)<($69|0);
  if (!($70)) {
   label = 19;
   break;
  }
  $71 = $7;
  $72 = $15;
  $73 = (($71) + ($72<<3)|0);
  $74 = +HEAPF64[$73>>3];
  $75 = +HEAPF64[$12>>3];
  $76 = $74 == $75;
  $77 = $15;
  if ($76) {
   break;
  }
  $79 = (($77) + 1)|0;
  $15 = $79;
 }
 if ((label|0) == 19) {
  STACKTOP = sp;return;
 }
 $78 = $10;
 HEAP32[$78>>2] = $77;
 STACKTOP = sp;return;
}
function __ZNK13EcgAnnotation5FindsEPKdid($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0.0, $19 = 0, $20 = 0.0, $21 = 0, $22 = 0.0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0.0, $28 = 0, $29 = 0.0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0.0, $36 = 0.0, $37 = 0.0, $38 = 0, $39 = 0.0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0.0, $48 = 0.0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $10 = sp + 8|0;
 $11 = sp;
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $13 = $5;
 $14 = $6;
 $15 = $7;
 __ZNK6Signal6MinMaxEPKdiRdS2_($13,$14,$15,$10,$11);
 $16 = +HEAPF64[$10>>3];
 $17 = $16 > 0.0;
 if (!($17)) {
  $18 = +HEAPF64[$10>>3];
  $19 = $6;
  $20 = +HEAPF64[$19>>3];
  $21 = $18 == $20;
  if (!($21)) {
   $22 = +HEAPF64[$10>>3];
   $23 = $6;
   $24 = $7;
   $25 = (($24) - 1)|0;
   $26 = (($23) + ($25<<3)|0);
   $27 = +HEAPF64[$26>>3];
   $28 = $22 == $27;
   if (!($28)) {
    $29 = +HEAPF64[$10>>3];
    $30 = $6;
    $31 = $7;
    $32 = (($31) - 1)|0;
    $33 = (($30) + ($32<<3)|0);
    $34 = +HEAPF64[$33>>3];
    $35 = $29 - $34;
    $36 = (+Math_abs((+$35)));
    $37 = $8;
    $38 = $36 < $37;
    if (!($38)) {
     $39 = +HEAPF64[$10>>3];
     $9 = $39;
     $12 = 1;
     while(1) {
      $40 = $12;
      $41 = $7;
      $42 = (($41) - 1)|0;
      $43 = ($40|0)<($42|0);
      if (!($43)) {
       label = 11;
       break;
      }
      $44 = $6;
      $45 = $12;
      $46 = (($44) + ($45<<3)|0);
      $47 = +HEAPF64[$46>>3];
      $48 = $9;
      $49 = $47 == $48;
      $50 = $12;
      if ($49) {
       label = 9;
       break;
      }
      $51 = (($50) + 1)|0;
      $12 = $51;
     }
     if ((label|0) == 9) {
      $4 = $50;
      $52 = $4;
      STACKTOP = sp;return ($52|0);
     }
     else if ((label|0) == 11) {
      $4 = -1;
      $52 = $4;
      STACKTOP = sp;return ($52|0);
     }
    }
   }
  }
 }
 $4 = -1;
 $52 = $4;
 STACKTOP = sp;return ($52|0);
}
function __ZNK13EcgAnnotation5FindqEPKdid($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0.0, $19 = 0, $20 = 0.0, $21 = 0, $22 = 0.0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0.0, $28 = 0, $29 = 0.0;
 var $30 = 0, $31 = 0.0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0, $36 = 0.0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0.0, $45 = 0.0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $10 = sp + 8|0;
 $11 = sp;
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $13 = $5;
 $14 = $6;
 $15 = $7;
 __ZNK6Signal6MinMaxEPKdiRdS2_($13,$14,$15,$10,$11);
 $16 = +HEAPF64[$10>>3];
 $17 = $16 > 0.0;
 if (!($17)) {
  $18 = +HEAPF64[$10>>3];
  $19 = $6;
  $20 = +HEAPF64[$19>>3];
  $21 = $18 == $20;
  if (!($21)) {
   $22 = +HEAPF64[$10>>3];
   $23 = $6;
   $24 = $7;
   $25 = (($24) - 1)|0;
   $26 = (($23) + ($25<<3)|0);
   $27 = +HEAPF64[$26>>3];
   $28 = $22 == $27;
   if (!($28)) {
    $29 = +HEAPF64[$10>>3];
    $30 = $6;
    $31 = +HEAPF64[$30>>3];
    $32 = $29 - $31;
    $33 = (+Math_abs((+$32)));
    $34 = $8;
    $35 = $33 < $34;
    if (!($35)) {
     $36 = +HEAPF64[$10>>3];
     $9 = $36;
     $12 = 1;
     while(1) {
      $37 = $12;
      $38 = $7;
      $39 = (($38) - 1)|0;
      $40 = ($37|0)<($39|0);
      if (!($40)) {
       label = 11;
       break;
      }
      $41 = $6;
      $42 = $12;
      $43 = (($41) + ($42<<3)|0);
      $44 = +HEAPF64[$43>>3];
      $45 = $9;
      $46 = $44 == $45;
      $47 = $12;
      if ($46) {
       label = 9;
       break;
      }
      $48 = (($47) + 1)|0;
      $12 = $48;
     }
     if ((label|0) == 9) {
      $4 = $47;
      $49 = $4;
      STACKTOP = sp;return ($49|0);
     }
     else if ((label|0) == 11) {
      $4 = -1;
      $49 = $4;
      STACKTOP = sp;return ($49|0);
     }
    }
   }
  }
 }
 $4 = -1;
 $49 = $4;
 STACKTOP = sp;return ($49|0);
}
function __ZNK13EcgAnnotation5FindrEPKdid($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0.0, $19 = 0, $20 = 0.0, $21 = 0, $22 = 0.0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0.0, $28 = 0, $29 = 0.0;
 var $30 = 0, $31 = 0.0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0, $36 = 0.0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0.0, $45 = 0.0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $10 = sp + 8|0;
 $11 = sp;
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $13 = $5;
 $14 = $6;
 $15 = $7;
 __ZNK6Signal6MinMaxEPKdiRdS2_($13,$14,$15,$10,$11);
 $16 = +HEAPF64[$11>>3];
 $17 = $16 < 0.0;
 if (!($17)) {
  $18 = +HEAPF64[$11>>3];
  $19 = $6;
  $20 = +HEAPF64[$19>>3];
  $21 = $18 == $20;
  if (!($21)) {
   $22 = +HEAPF64[$11>>3];
   $23 = $6;
   $24 = $7;
   $25 = (($24) - 1)|0;
   $26 = (($23) + ($25<<3)|0);
   $27 = +HEAPF64[$26>>3];
   $28 = $22 == $27;
   if (!($28)) {
    $29 = +HEAPF64[$11>>3];
    $30 = $6;
    $31 = +HEAPF64[$30>>3];
    $32 = $29 - $31;
    $33 = (+Math_abs((+$32)));
    $34 = $8;
    $35 = $33 < $34;
    if (!($35)) {
     $36 = +HEAPF64[$11>>3];
     $9 = $36;
     $12 = 1;
     while(1) {
      $37 = $12;
      $38 = $7;
      $39 = (($38) - 1)|0;
      $40 = ($37|0)<($39|0);
      if (!($40)) {
       label = 11;
       break;
      }
      $41 = $6;
      $42 = $12;
      $43 = (($41) + ($42<<3)|0);
      $44 = +HEAPF64[$43>>3];
      $45 = $9;
      $46 = $44 == $45;
      $47 = $12;
      if ($46) {
       label = 9;
       break;
      }
      $48 = (($47) + 1)|0;
      $12 = $48;
     }
     if ((label|0) == 9) {
      $4 = $47;
      $49 = $4;
      STACKTOP = sp;return ($49|0);
     }
     else if ((label|0) == 11) {
      $4 = -1;
      $49 = $4;
      STACKTOP = sp;return ($49|0);
     }
    }
   }
  }
 }
 $4 = -1;
 $49 = $4;
 STACKTOP = sp;return ($49|0);
}
function __ZNSt3__26vectorIcNS_9allocatorIcEEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 __ZNSt3__213__vector_baseIcNS_9allocatorIcEEED2Ev($2);
 STACKTOP = sp;return;
}
function __ZNSt3__213__vector_baseIcNS_9allocatorIcEEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 144|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(144|0);
 $4 = sp;
 $7 = sp + 128|0;
 $31 = sp + 12|0;
 $33 = sp + 4|0;
 $32 = $0;
 $34 = $32;
 $35 = HEAP32[$34>>2]|0;
 $29 = $31;
 $30 = -1;
 $36 = $29;
 HEAP32[$36>>2] = 0;
 $37 = HEAP32[$31>>2]|0;
 HEAP32[$33>>2] = $37;
 $21 = $33;
 $38 = ($35|0)!=(0|0);
 if (!($38)) {
  STACKTOP = sp;return;
 }
 $13 = $34;
 $39 = $13;
 $40 = HEAP32[$39>>2]|0;
 $11 = $39;
 $12 = $40;
 $41 = $11;
 while(1) {
  $42 = $12;
  $43 = ((($41)) + 4|0);
  $44 = HEAP32[$43>>2]|0;
  $45 = ($42|0)!=($44|0);
  if (!($45)) {
   break;
  }
  $10 = $41;
  $46 = $10;
  $47 = ((($46)) + 8|0);
  $9 = $47;
  $48 = $9;
  $8 = $48;
  $49 = $8;
  $50 = ((($41)) + 4|0);
  $51 = HEAP32[$50>>2]|0;
  $52 = ((($51)) + -1|0);
  HEAP32[$50>>2] = $52;
  $1 = $52;
  $53 = $1;
  $5 = $49;
  $6 = $53;
  $54 = $5;
  $55 = $6;
  ;HEAP8[$4>>0]=HEAP8[$7>>0]|0;
  $2 = $54;
  $3 = $55;
 }
 $16 = $34;
 $56 = $16;
 $57 = ((($56)) + 8|0);
 $15 = $57;
 $58 = $15;
 $14 = $58;
 $59 = $14;
 $60 = HEAP32[$34>>2]|0;
 $20 = $34;
 $61 = $20;
 $19 = $61;
 $62 = $19;
 $63 = ((($62)) + 8|0);
 $18 = $63;
 $64 = $18;
 $17 = $64;
 $65 = $17;
 $66 = HEAP32[$65>>2]|0;
 $67 = HEAP32[$61>>2]|0;
 $68 = $66;
 $69 = $67;
 $70 = (($68) - ($69))|0;
 $26 = $59;
 $27 = $60;
 $28 = $70;
 $71 = $26;
 $72 = $27;
 $73 = $28;
 $23 = $71;
 $24 = $72;
 $25 = $73;
 $74 = $24;
 $22 = $74;
 $75 = $22;
 __ZdlPv($75);
 STACKTOP = sp;return;
}
function __ZNKSt3__26vectorIcNS_9allocatorIcEEE8max_sizeEv($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $3 = sp + 8|0;
 $5 = sp + 77|0;
 $11 = sp;
 $14 = sp + 76|0;
 $19 = sp + 16|0;
 $20 = sp + 12|0;
 $18 = $0;
 $21 = $18;
 $17 = $21;
 $22 = $17;
 $23 = ((($22)) + 8|0);
 $16 = $23;
 $24 = $16;
 $15 = $24;
 $25 = $15;
 $4 = $25;
 $26 = $4;
 ;HEAP8[$3>>0]=HEAP8[$5>>0]|0;
 $2 = $26;
 $27 = $2;
 $1 = $27;
 HEAP32[$19>>2] = -1;
 HEAP32[$20>>2] = 2147483647;
 $12 = $19;
 $13 = $20;
 $28 = $12;
 $29 = $13;
 ;HEAP8[$11>>0]=HEAP8[$14>>0]|0;
 $9 = $28;
 $10 = $29;
 $30 = $10;
 $31 = $9;
 $6 = $11;
 $7 = $30;
 $8 = $31;
 $32 = $7;
 $33 = HEAP32[$32>>2]|0;
 $34 = $8;
 $35 = HEAP32[$34>>2]|0;
 $36 = ($33>>>0)<($35>>>0);
 $37 = $10;
 $38 = $9;
 $39 = $36 ? $37 : $38;
 $40 = HEAP32[$39>>2]|0;
 STACKTOP = sp;return ($40|0);
}
function __ZNSt3__214__split_bufferIcRNS_9allocatorIcEEEC2EjjS3_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(160|0);
 $8 = sp + 128|0;
 $12 = sp + 112|0;
 $27 = sp + 52|0;
 $34 = sp + 24|0;
 $39 = sp + 4|0;
 $40 = sp;
 $35 = $0;
 $36 = $1;
 $37 = $2;
 $38 = $3;
 $41 = $35;
 $42 = ((($41)) + 12|0);
 $32 = $34;
 $33 = -1;
 $43 = $32;
 HEAP32[$43>>2] = 0;
 $44 = HEAP32[$34>>2]|0;
 HEAP32[$39>>2] = $44;
 $17 = $39;
 $45 = $38;
 $11 = $42;
 HEAP32[$12>>2] = 0;
 $13 = $45;
 $46 = $11;
 $10 = $12;
 $47 = $10;
 $48 = HEAP32[$47>>2]|0;
 $49 = $13;
 $4 = $49;
 $50 = $4;
 $7 = $46;
 HEAP32[$8>>2] = $48;
 $9 = $50;
 $51 = $7;
 $6 = $8;
 $52 = $6;
 $53 = HEAP32[$52>>2]|0;
 HEAP32[$51>>2] = $53;
 $54 = ((($51)) + 4|0);
 $55 = $9;
 $5 = $55;
 $56 = $5;
 HEAP32[$54>>2] = $56;
 $57 = $36;
 $58 = ($57|0)!=(0);
 if ($58) {
  $16 = $41;
  $59 = $16;
  $60 = ((($59)) + 12|0);
  $15 = $60;
  $61 = $15;
  $14 = $61;
  $62 = $14;
  $63 = ((($62)) + 4|0);
  $64 = HEAP32[$63>>2]|0;
  $65 = $36;
  $23 = $64;
  $24 = $65;
  $66 = $23;
  $67 = $24;
  $20 = $66;
  $21 = $67;
  $22 = 0;
  $68 = $20;
  $19 = $68;
  $69 = $21;
  $18 = $69;
  $70 = $18;
  $71 = (__Znwj($70)|0);
  $74 = $71;
 } else {
  $25 = $27;
  $26 = -1;
  $72 = $25;
  HEAP32[$72>>2] = 0;
  $73 = HEAP32[$27>>2]|0;
  HEAP32[$40>>2] = $73;
  $28 = $40;
  $74 = 0;
 }
 HEAP32[$41>>2] = $74;
 $75 = HEAP32[$41>>2]|0;
 $76 = $37;
 $77 = (($75) + ($76)|0);
 $78 = ((($41)) + 8|0);
 HEAP32[$78>>2] = $77;
 $79 = ((($41)) + 4|0);
 HEAP32[$79>>2] = $77;
 $80 = HEAP32[$41>>2]|0;
 $81 = $36;
 $82 = (($80) + ($81)|0);
 $31 = $41;
 $83 = $31;
 $84 = ((($83)) + 12|0);
 $30 = $84;
 $85 = $30;
 $29 = $85;
 $86 = $29;
 HEAP32[$86>>2] = $82;
 STACKTOP = sp;return;
}
function __ZNSt3__26vectorIcNS_9allocatorIcEEE26__swap_out_circular_bufferERNS_14__split_bufferIcRS2_EE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0;
 var $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0;
 var $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0;
 var $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0;
 var $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 352|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(352|0);
 $15 = sp + 288|0;
 $21 = sp + 264|0;
 $33 = sp + 216|0;
 $86 = $0;
 $87 = $1;
 $88 = $86;
 $85 = $88;
 $89 = $85;
 $84 = $89;
 $90 = $84;
 $91 = HEAP32[$90>>2]|0;
 $83 = $91;
 $92 = $83;
 $62 = $89;
 $93 = $62;
 $94 = HEAP32[$93>>2]|0;
 $61 = $94;
 $95 = $61;
 $67 = $89;
 $96 = $67;
 $66 = $96;
 $97 = $66;
 $65 = $97;
 $98 = $65;
 $99 = ((($98)) + 8|0);
 $64 = $99;
 $100 = $64;
 $63 = $100;
 $101 = $63;
 $102 = HEAP32[$101>>2]|0;
 $103 = HEAP32[$97>>2]|0;
 $104 = $102;
 $105 = $103;
 $106 = (($104) - ($105))|0;
 $107 = (($95) + ($106)|0);
 $69 = $89;
 $108 = $69;
 $109 = HEAP32[$108>>2]|0;
 $68 = $109;
 $110 = $68;
 $70 = $89;
 $111 = $70;
 $112 = ((($111)) + 4|0);
 $113 = HEAP32[$112>>2]|0;
 $114 = HEAP32[$111>>2]|0;
 $115 = $113;
 $116 = $114;
 $117 = (($115) - ($116))|0;
 $118 = (($110) + ($117)|0);
 $72 = $89;
 $119 = $72;
 $120 = HEAP32[$119>>2]|0;
 $71 = $120;
 $121 = $71;
 $77 = $89;
 $122 = $77;
 $76 = $122;
 $123 = $76;
 $75 = $123;
 $124 = $75;
 $125 = ((($124)) + 8|0);
 $74 = $125;
 $126 = $74;
 $73 = $126;
 $127 = $73;
 $128 = HEAP32[$127>>2]|0;
 $129 = HEAP32[$123>>2]|0;
 $130 = $128;
 $131 = $129;
 $132 = (($130) - ($131))|0;
 $133 = (($121) + ($132)|0);
 $78 = $89;
 $79 = $92;
 $80 = $107;
 $81 = $118;
 $82 = $133;
 $4 = $88;
 $134 = $4;
 $135 = ((($134)) + 8|0);
 $3 = $135;
 $136 = $3;
 $2 = $136;
 $137 = $2;
 $138 = HEAP32[$88>>2]|0;
 $139 = ((($88)) + 4|0);
 $140 = HEAP32[$139>>2]|0;
 $141 = $87;
 $142 = ((($141)) + 4|0);
 $5 = $137;
 $6 = $138;
 $7 = $140;
 $8 = $142;
 $143 = $7;
 $144 = $6;
 $145 = $143;
 $146 = $144;
 $147 = (($145) - ($146))|0;
 $9 = $147;
 $148 = $9;
 $149 = $8;
 $150 = HEAP32[$149>>2]|0;
 $151 = (0 - ($148))|0;
 $152 = (($150) + ($151)|0);
 HEAP32[$149>>2] = $152;
 $153 = $9;
 $154 = ($153|0)>(0);
 if ($154) {
  $155 = $8;
  $156 = HEAP32[$155>>2]|0;
  $157 = $6;
  $158 = $9;
  _memcpy(($156|0),($157|0),($158|0))|0;
 }
 $159 = $87;
 $160 = ((($159)) + 4|0);
 $13 = $88;
 $14 = $160;
 $161 = $13;
 $12 = $161;
 $162 = $12;
 $163 = HEAP32[$162>>2]|0;
 HEAP32[$15>>2] = $163;
 $164 = $14;
 $10 = $164;
 $165 = $10;
 $166 = HEAP32[$165>>2]|0;
 $167 = $13;
 HEAP32[$167>>2] = $166;
 $11 = $15;
 $168 = $11;
 $169 = HEAP32[$168>>2]|0;
 $170 = $14;
 HEAP32[$170>>2] = $169;
 $171 = ((($88)) + 4|0);
 $172 = $87;
 $173 = ((($172)) + 8|0);
 $19 = $171;
 $20 = $173;
 $174 = $19;
 $18 = $174;
 $175 = $18;
 $176 = HEAP32[$175>>2]|0;
 HEAP32[$21>>2] = $176;
 $177 = $20;
 $16 = $177;
 $178 = $16;
 $179 = HEAP32[$178>>2]|0;
 $180 = $19;
 HEAP32[$180>>2] = $179;
 $17 = $21;
 $181 = $17;
 $182 = HEAP32[$181>>2]|0;
 $183 = $20;
 HEAP32[$183>>2] = $182;
 $24 = $88;
 $184 = $24;
 $185 = ((($184)) + 8|0);
 $23 = $185;
 $186 = $23;
 $22 = $186;
 $187 = $22;
 $188 = $87;
 $27 = $188;
 $189 = $27;
 $190 = ((($189)) + 12|0);
 $26 = $190;
 $191 = $26;
 $25 = $191;
 $192 = $25;
 $31 = $187;
 $32 = $192;
 $193 = $31;
 $30 = $193;
 $194 = $30;
 $195 = HEAP32[$194>>2]|0;
 HEAP32[$33>>2] = $195;
 $196 = $32;
 $28 = $196;
 $197 = $28;
 $198 = HEAP32[$197>>2]|0;
 $199 = $31;
 HEAP32[$199>>2] = $198;
 $29 = $33;
 $200 = $29;
 $201 = HEAP32[$200>>2]|0;
 $202 = $32;
 HEAP32[$202>>2] = $201;
 $203 = $87;
 $204 = ((($203)) + 4|0);
 $205 = HEAP32[$204>>2]|0;
 $206 = $87;
 HEAP32[$206>>2] = $205;
 $34 = $88;
 $207 = $34;
 $208 = ((($207)) + 4|0);
 $209 = HEAP32[$208>>2]|0;
 $210 = HEAP32[$207>>2]|0;
 $211 = $209;
 $212 = $210;
 $213 = (($211) - ($212))|0;
 $58 = $88;
 $59 = $213;
 $214 = $58;
 $57 = $214;
 $215 = $57;
 $216 = HEAP32[$215>>2]|0;
 $56 = $216;
 $217 = $56;
 $36 = $214;
 $218 = $36;
 $219 = HEAP32[$218>>2]|0;
 $35 = $219;
 $220 = $35;
 $41 = $214;
 $221 = $41;
 $40 = $221;
 $222 = $40;
 $39 = $222;
 $223 = $39;
 $224 = ((($223)) + 8|0);
 $38 = $224;
 $225 = $38;
 $37 = $225;
 $226 = $37;
 $227 = HEAP32[$226>>2]|0;
 $228 = HEAP32[$222>>2]|0;
 $229 = $227;
 $230 = $228;
 $231 = (($229) - ($230))|0;
 $232 = (($220) + ($231)|0);
 $43 = $214;
 $233 = $43;
 $234 = HEAP32[$233>>2]|0;
 $42 = $234;
 $235 = $42;
 $48 = $214;
 $236 = $48;
 $47 = $236;
 $237 = $47;
 $46 = $237;
 $238 = $46;
 $239 = ((($238)) + 8|0);
 $45 = $239;
 $240 = $45;
 $44 = $240;
 $241 = $44;
 $242 = HEAP32[$241>>2]|0;
 $243 = HEAP32[$237>>2]|0;
 $244 = $242;
 $245 = $243;
 $246 = (($244) - ($245))|0;
 $247 = (($235) + ($246)|0);
 $50 = $214;
 $248 = $50;
 $249 = HEAP32[$248>>2]|0;
 $49 = $249;
 $250 = $49;
 $251 = $59;
 $252 = (($250) + ($251)|0);
 $51 = $214;
 $52 = $217;
 $53 = $232;
 $54 = $247;
 $55 = $252;
 $60 = $88;
 STACKTOP = sp;return;
}
function __ZNSt3__214__split_bufferIcRNS_9allocatorIcEEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $18 = sp + 8|0;
 $21 = sp + 125|0;
 $27 = sp;
 $30 = sp + 124|0;
 $32 = $0;
 $33 = $32;
 $31 = $33;
 $34 = $31;
 $35 = ((($34)) + 4|0);
 $36 = HEAP32[$35>>2]|0;
 $28 = $34;
 $29 = $36;
 $37 = $28;
 $38 = $29;
 ;HEAP8[$27>>0]=HEAP8[$30>>0]|0;
 $25 = $37;
 $26 = $38;
 $39 = $25;
 while(1) {
  $40 = $26;
  $41 = ((($39)) + 8|0);
  $42 = HEAP32[$41>>2]|0;
  $43 = ($40|0)!=($42|0);
  if (!($43)) {
   break;
  }
  $24 = $39;
  $44 = $24;
  $45 = ((($44)) + 12|0);
  $23 = $45;
  $46 = $23;
  $22 = $46;
  $47 = $22;
  $48 = ((($47)) + 4|0);
  $49 = HEAP32[$48>>2]|0;
  $50 = ((($39)) + 8|0);
  $51 = HEAP32[$50>>2]|0;
  $52 = ((($51)) + -1|0);
  HEAP32[$50>>2] = $52;
  $15 = $52;
  $53 = $15;
  $19 = $49;
  $20 = $53;
  $54 = $19;
  $55 = $20;
  ;HEAP8[$18>>0]=HEAP8[$21>>0]|0;
  $16 = $54;
  $17 = $55;
 }
 $56 = HEAP32[$33>>2]|0;
 $57 = ($56|0)!=(0|0);
 if (!($57)) {
  STACKTOP = sp;return;
 }
 $7 = $33;
 $58 = $7;
 $59 = ((($58)) + 12|0);
 $6 = $59;
 $60 = $6;
 $5 = $60;
 $61 = $5;
 $62 = ((($61)) + 4|0);
 $63 = HEAP32[$62>>2]|0;
 $64 = HEAP32[$33>>2]|0;
 $4 = $33;
 $65 = $4;
 $3 = $65;
 $66 = $3;
 $67 = ((($66)) + 12|0);
 $2 = $67;
 $68 = $2;
 $1 = $68;
 $69 = $1;
 $70 = HEAP32[$69>>2]|0;
 $71 = HEAP32[$65>>2]|0;
 $72 = $70;
 $73 = $71;
 $74 = (($72) - ($73))|0;
 $12 = $63;
 $13 = $64;
 $14 = $74;
 $75 = $12;
 $76 = $13;
 $77 = $14;
 $9 = $75;
 $10 = $76;
 $11 = $77;
 $78 = $10;
 $8 = $78;
 $79 = $8;
 __ZdlPv($79);
 STACKTOP = sp;return;
}
function __ZNKSt3__26vectorIiNS_9allocatorIiEEE8max_sizeEv($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $3 = sp + 8|0;
 $5 = sp + 77|0;
 $11 = sp;
 $14 = sp + 76|0;
 $19 = sp + 16|0;
 $20 = sp + 12|0;
 $18 = $0;
 $21 = $18;
 $17 = $21;
 $22 = $17;
 $23 = ((($22)) + 8|0);
 $16 = $23;
 $24 = $16;
 $15 = $24;
 $25 = $15;
 $4 = $25;
 $26 = $4;
 ;HEAP8[$3>>0]=HEAP8[$5>>0]|0;
 $2 = $26;
 $27 = $2;
 $1 = $27;
 HEAP32[$19>>2] = 1073741823;
 HEAP32[$20>>2] = 2147483647;
 $12 = $19;
 $13 = $20;
 $28 = $12;
 $29 = $13;
 ;HEAP8[$11>>0]=HEAP8[$14>>0]|0;
 $9 = $28;
 $10 = $29;
 $30 = $10;
 $31 = $9;
 $6 = $11;
 $7 = $30;
 $8 = $31;
 $32 = $7;
 $33 = HEAP32[$32>>2]|0;
 $34 = $8;
 $35 = HEAP32[$34>>2]|0;
 $36 = ($33>>>0)<($35>>>0);
 $37 = $10;
 $38 = $9;
 $39 = $36 ? $37 : $38;
 $40 = HEAP32[$39>>2]|0;
 STACKTOP = sp;return ($40|0);
}
function __ZNSt3__214__split_bufferIiRNS_9allocatorIiEEEC2EjjS3_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 176|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(176|0);
 $11 = sp + 136|0;
 $15 = sp + 120|0;
 $32 = sp + 52|0;
 $39 = sp + 24|0;
 $44 = sp + 4|0;
 $45 = sp;
 $40 = $0;
 $41 = $1;
 $42 = $2;
 $43 = $3;
 $46 = $40;
 $47 = ((($46)) + 12|0);
 $37 = $39;
 $38 = -1;
 $48 = $37;
 HEAP32[$48>>2] = 0;
 $49 = HEAP32[$39>>2]|0;
 HEAP32[$44>>2] = $49;
 $17 = $44;
 $50 = $43;
 $14 = $47;
 HEAP32[$15>>2] = 0;
 $16 = $50;
 $51 = $14;
 $13 = $15;
 $52 = $13;
 $53 = HEAP32[$52>>2]|0;
 $54 = $16;
 $7 = $54;
 $55 = $7;
 $10 = $51;
 HEAP32[$11>>2] = $53;
 $12 = $55;
 $56 = $10;
 $9 = $11;
 $57 = $9;
 $58 = HEAP32[$57>>2]|0;
 HEAP32[$56>>2] = $58;
 $59 = ((($56)) + 4|0);
 $60 = $12;
 $8 = $60;
 $61 = $8;
 HEAP32[$59>>2] = $61;
 $62 = $41;
 $63 = ($62|0)!=(0);
 if (!($63)) {
  $30 = $32;
  $31 = -1;
  $90 = $30;
  HEAP32[$90>>2] = 0;
  $91 = HEAP32[$32>>2]|0;
  HEAP32[$45>>2] = $91;
  $33 = $45;
  $92 = 0;
  HEAP32[$46>>2] = $92;
  $93 = HEAP32[$46>>2]|0;
  $94 = $42;
  $95 = (($93) + ($94<<2)|0);
  $96 = ((($46)) + 8|0);
  HEAP32[$96>>2] = $95;
  $97 = ((($46)) + 4|0);
  HEAP32[$97>>2] = $95;
  $98 = HEAP32[$46>>2]|0;
  $99 = $41;
  $100 = (($98) + ($99<<2)|0);
  $36 = $46;
  $101 = $36;
  $102 = ((($101)) + 12|0);
  $35 = $102;
  $103 = $35;
  $34 = $103;
  $104 = $34;
  HEAP32[$104>>2] = $100;
  STACKTOP = sp;return;
 }
 $6 = $46;
 $64 = $6;
 $65 = ((($64)) + 12|0);
 $5 = $65;
 $66 = $5;
 $4 = $66;
 $67 = $4;
 $68 = ((($67)) + 4|0);
 $69 = HEAP32[$68>>2]|0;
 $70 = $41;
 $28 = $69;
 $29 = $70;
 $71 = $28;
 $72 = $29;
 $25 = $71;
 $26 = $72;
 $27 = 0;
 $73 = $25;
 $74 = $26;
 $24 = $73;
 $75 = ($74>>>0)>(1073741823);
 if (!($75)) {
  $86 = $26;
  $87 = $86<<2;
  $23 = $87;
  $88 = $23;
  $89 = (__Znwj($88)|0);
  $92 = $89;
  HEAP32[$46>>2] = $92;
  $93 = HEAP32[$46>>2]|0;
  $94 = $42;
  $95 = (($93) + ($94<<2)|0);
  $96 = ((($46)) + 8|0);
  HEAP32[$96>>2] = $95;
  $97 = ((($46)) + 4|0);
  HEAP32[$97>>2] = $95;
  $98 = HEAP32[$46>>2]|0;
  $99 = $41;
  $100 = (($98) + ($99<<2)|0);
  $36 = $46;
  $101 = $36;
  $102 = ((($101)) + 12|0);
  $35 = $102;
  $103 = $35;
  $34 = $103;
  $104 = $34;
  HEAP32[$104>>2] = $100;
  STACKTOP = sp;return;
 }
 $20 = 31739;
 $76 = (___cxa_allocate_exception(8)|0);
 $77 = $20;
 $18 = $76;
 $19 = $77;
 $78 = $18;
 $79 = $19;
 __THREW__ = 0;
 invoke_vii(66,($78|0),($79|0));
 $80 = __THREW__; __THREW__ = 0;
 $81 = $80&1;
 if ($81) {
  $82 = ___cxa_find_matching_catch_2()|0;
  $83 = tempRet0;
  $21 = $82;
  $22 = $83;
  ___cxa_free_exception(($76|0));
  $84 = $21;
  $85 = $22;
  ___resumeException($84|0);
  // unreachable;
 } else {
  HEAP32[$78>>2] = (31680);
  ___cxa_throw(($76|0),(30904|0),(31|0));
  // unreachable;
 }
}
function __ZNSt3__26vectorIiNS_9allocatorIiEEE26__swap_out_circular_bufferERNS_14__split_bufferIiRS2_EE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 352|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(352|0);
 $15 = sp + 288|0;
 $21 = sp + 264|0;
 $33 = sp + 216|0;
 $86 = $0;
 $87 = $1;
 $88 = $86;
 $85 = $88;
 $89 = $85;
 $84 = $89;
 $90 = $84;
 $91 = HEAP32[$90>>2]|0;
 $83 = $91;
 $92 = $83;
 $62 = $89;
 $93 = $62;
 $94 = HEAP32[$93>>2]|0;
 $61 = $94;
 $95 = $61;
 $67 = $89;
 $96 = $67;
 $66 = $96;
 $97 = $66;
 $65 = $97;
 $98 = $65;
 $99 = ((($98)) + 8|0);
 $64 = $99;
 $100 = $64;
 $63 = $100;
 $101 = $63;
 $102 = HEAP32[$101>>2]|0;
 $103 = HEAP32[$97>>2]|0;
 $104 = $102;
 $105 = $103;
 $106 = (($104) - ($105))|0;
 $107 = (($106|0) / 4)&-1;
 $108 = (($95) + ($107<<2)|0);
 $69 = $89;
 $109 = $69;
 $110 = HEAP32[$109>>2]|0;
 $68 = $110;
 $111 = $68;
 $70 = $89;
 $112 = $70;
 $113 = ((($112)) + 4|0);
 $114 = HEAP32[$113>>2]|0;
 $115 = HEAP32[$112>>2]|0;
 $116 = $114;
 $117 = $115;
 $118 = (($116) - ($117))|0;
 $119 = (($118|0) / 4)&-1;
 $120 = (($111) + ($119<<2)|0);
 $72 = $89;
 $121 = $72;
 $122 = HEAP32[$121>>2]|0;
 $71 = $122;
 $123 = $71;
 $77 = $89;
 $124 = $77;
 $76 = $124;
 $125 = $76;
 $75 = $125;
 $126 = $75;
 $127 = ((($126)) + 8|0);
 $74 = $127;
 $128 = $74;
 $73 = $128;
 $129 = $73;
 $130 = HEAP32[$129>>2]|0;
 $131 = HEAP32[$125>>2]|0;
 $132 = $130;
 $133 = $131;
 $134 = (($132) - ($133))|0;
 $135 = (($134|0) / 4)&-1;
 $136 = (($123) + ($135<<2)|0);
 $78 = $89;
 $79 = $92;
 $80 = $108;
 $81 = $120;
 $82 = $136;
 $4 = $88;
 $137 = $4;
 $138 = ((($137)) + 8|0);
 $3 = $138;
 $139 = $3;
 $2 = $139;
 $140 = $2;
 $141 = HEAP32[$88>>2]|0;
 $142 = ((($88)) + 4|0);
 $143 = HEAP32[$142>>2]|0;
 $144 = $87;
 $145 = ((($144)) + 4|0);
 $5 = $140;
 $6 = $141;
 $7 = $143;
 $8 = $145;
 $146 = $7;
 $147 = $6;
 $148 = $146;
 $149 = $147;
 $150 = (($148) - ($149))|0;
 $151 = (($150|0) / 4)&-1;
 $9 = $151;
 $152 = $9;
 $153 = $8;
 $154 = HEAP32[$153>>2]|0;
 $155 = (0 - ($152))|0;
 $156 = (($154) + ($155<<2)|0);
 HEAP32[$153>>2] = $156;
 $157 = $9;
 $158 = ($157|0)>(0);
 if ($158) {
  $159 = $8;
  $160 = HEAP32[$159>>2]|0;
  $161 = $6;
  $162 = $9;
  $163 = $162<<2;
  _memcpy(($160|0),($161|0),($163|0))|0;
 }
 $164 = $87;
 $165 = ((($164)) + 4|0);
 $13 = $88;
 $14 = $165;
 $166 = $13;
 $12 = $166;
 $167 = $12;
 $168 = HEAP32[$167>>2]|0;
 HEAP32[$15>>2] = $168;
 $169 = $14;
 $10 = $169;
 $170 = $10;
 $171 = HEAP32[$170>>2]|0;
 $172 = $13;
 HEAP32[$172>>2] = $171;
 $11 = $15;
 $173 = $11;
 $174 = HEAP32[$173>>2]|0;
 $175 = $14;
 HEAP32[$175>>2] = $174;
 $176 = ((($88)) + 4|0);
 $177 = $87;
 $178 = ((($177)) + 8|0);
 $19 = $176;
 $20 = $178;
 $179 = $19;
 $18 = $179;
 $180 = $18;
 $181 = HEAP32[$180>>2]|0;
 HEAP32[$21>>2] = $181;
 $182 = $20;
 $16 = $182;
 $183 = $16;
 $184 = HEAP32[$183>>2]|0;
 $185 = $19;
 HEAP32[$185>>2] = $184;
 $17 = $21;
 $186 = $17;
 $187 = HEAP32[$186>>2]|0;
 $188 = $20;
 HEAP32[$188>>2] = $187;
 $24 = $88;
 $189 = $24;
 $190 = ((($189)) + 8|0);
 $23 = $190;
 $191 = $23;
 $22 = $191;
 $192 = $22;
 $193 = $87;
 $27 = $193;
 $194 = $27;
 $195 = ((($194)) + 12|0);
 $26 = $195;
 $196 = $26;
 $25 = $196;
 $197 = $25;
 $31 = $192;
 $32 = $197;
 $198 = $31;
 $30 = $198;
 $199 = $30;
 $200 = HEAP32[$199>>2]|0;
 HEAP32[$33>>2] = $200;
 $201 = $32;
 $28 = $201;
 $202 = $28;
 $203 = HEAP32[$202>>2]|0;
 $204 = $31;
 HEAP32[$204>>2] = $203;
 $29 = $33;
 $205 = $29;
 $206 = HEAP32[$205>>2]|0;
 $207 = $32;
 HEAP32[$207>>2] = $206;
 $208 = $87;
 $209 = ((($208)) + 4|0);
 $210 = HEAP32[$209>>2]|0;
 $211 = $87;
 HEAP32[$211>>2] = $210;
 $34 = $88;
 $212 = $34;
 $213 = ((($212)) + 4|0);
 $214 = HEAP32[$213>>2]|0;
 $215 = HEAP32[$212>>2]|0;
 $216 = $214;
 $217 = $215;
 $218 = (($216) - ($217))|0;
 $219 = (($218|0) / 4)&-1;
 $58 = $88;
 $59 = $219;
 $220 = $58;
 $57 = $220;
 $221 = $57;
 $222 = HEAP32[$221>>2]|0;
 $56 = $222;
 $223 = $56;
 $36 = $220;
 $224 = $36;
 $225 = HEAP32[$224>>2]|0;
 $35 = $225;
 $226 = $35;
 $41 = $220;
 $227 = $41;
 $40 = $227;
 $228 = $40;
 $39 = $228;
 $229 = $39;
 $230 = ((($229)) + 8|0);
 $38 = $230;
 $231 = $38;
 $37 = $231;
 $232 = $37;
 $233 = HEAP32[$232>>2]|0;
 $234 = HEAP32[$228>>2]|0;
 $235 = $233;
 $236 = $234;
 $237 = (($235) - ($236))|0;
 $238 = (($237|0) / 4)&-1;
 $239 = (($226) + ($238<<2)|0);
 $43 = $220;
 $240 = $43;
 $241 = HEAP32[$240>>2]|0;
 $42 = $241;
 $242 = $42;
 $48 = $220;
 $243 = $48;
 $47 = $243;
 $244 = $47;
 $46 = $244;
 $245 = $46;
 $246 = ((($245)) + 8|0);
 $45 = $246;
 $247 = $45;
 $44 = $247;
 $248 = $44;
 $249 = HEAP32[$248>>2]|0;
 $250 = HEAP32[$244>>2]|0;
 $251 = $249;
 $252 = $250;
 $253 = (($251) - ($252))|0;
 $254 = (($253|0) / 4)&-1;
 $255 = (($242) + ($254<<2)|0);
 $50 = $220;
 $256 = $50;
 $257 = HEAP32[$256>>2]|0;
 $49 = $257;
 $258 = $49;
 $259 = $59;
 $260 = (($258) + ($259<<2)|0);
 $51 = $220;
 $52 = $223;
 $53 = $239;
 $54 = $255;
 $55 = $260;
 $60 = $88;
 STACKTOP = sp;return;
}
function __ZNSt3__214__split_bufferIiRNS_9allocatorIiEEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $18 = sp + 8|0;
 $21 = sp + 125|0;
 $27 = sp;
 $30 = sp + 124|0;
 $32 = $0;
 $33 = $32;
 $31 = $33;
 $34 = $31;
 $35 = ((($34)) + 4|0);
 $36 = HEAP32[$35>>2]|0;
 $28 = $34;
 $29 = $36;
 $37 = $28;
 $38 = $29;
 ;HEAP8[$27>>0]=HEAP8[$30>>0]|0;
 $25 = $37;
 $26 = $38;
 $39 = $25;
 while(1) {
  $40 = $26;
  $41 = ((($39)) + 8|0);
  $42 = HEAP32[$41>>2]|0;
  $43 = ($40|0)!=($42|0);
  if (!($43)) {
   break;
  }
  $24 = $39;
  $44 = $24;
  $45 = ((($44)) + 12|0);
  $23 = $45;
  $46 = $23;
  $22 = $46;
  $47 = $22;
  $48 = ((($47)) + 4|0);
  $49 = HEAP32[$48>>2]|0;
  $50 = ((($39)) + 8|0);
  $51 = HEAP32[$50>>2]|0;
  $52 = ((($51)) + -4|0);
  HEAP32[$50>>2] = $52;
  $15 = $52;
  $53 = $15;
  $19 = $49;
  $20 = $53;
  $54 = $19;
  $55 = $20;
  ;HEAP8[$18>>0]=HEAP8[$21>>0]|0;
  $16 = $54;
  $17 = $55;
 }
 $56 = HEAP32[$33>>2]|0;
 $57 = ($56|0)!=(0|0);
 if (!($57)) {
  STACKTOP = sp;return;
 }
 $7 = $33;
 $58 = $7;
 $59 = ((($58)) + 12|0);
 $6 = $59;
 $60 = $6;
 $5 = $60;
 $61 = $5;
 $62 = ((($61)) + 4|0);
 $63 = HEAP32[$62>>2]|0;
 $64 = HEAP32[$33>>2]|0;
 $4 = $33;
 $65 = $4;
 $3 = $65;
 $66 = $3;
 $67 = ((($66)) + 12|0);
 $2 = $67;
 $68 = $2;
 $1 = $68;
 $69 = $1;
 $70 = HEAP32[$69>>2]|0;
 $71 = HEAP32[$65>>2]|0;
 $72 = $70;
 $73 = $71;
 $74 = (($72) - ($73))|0;
 $75 = (($74|0) / 4)&-1;
 $12 = $63;
 $13 = $64;
 $14 = $75;
 $76 = $12;
 $77 = $13;
 $78 = $14;
 $9 = $76;
 $10 = $77;
 $11 = $78;
 $79 = $10;
 $8 = $79;
 $80 = $8;
 __ZdlPv($80);
 STACKTOP = sp;return;
}
function __ZNSt3__26vectorIdNS_9allocatorIdEEE21__push_back_slow_pathIKdEEvRT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0.0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(160|0);
 $13 = sp;
 $16 = sp + 156|0;
 $24 = sp + 72|0;
 $27 = sp + 60|0;
 $35 = sp + 12|0;
 $32 = $0;
 $33 = $1;
 $38 = $32;
 $31 = $38;
 $39 = $31;
 $40 = ((($39)) + 8|0);
 $30 = $40;
 $41 = $30;
 $29 = $41;
 $42 = $29;
 $34 = $42;
 $28 = $38;
 $43 = $28;
 $44 = ((($43)) + 4|0);
 $45 = HEAP32[$44>>2]|0;
 $46 = HEAP32[$43>>2]|0;
 $47 = $45;
 $48 = $46;
 $49 = (($47) - ($48))|0;
 $50 = (($49|0) / 8)&-1;
 $51 = (($50) + 1)|0;
 $23 = $38;
 HEAP32[$24>>2] = $51;
 $52 = $23;
 $53 = (__ZNKSt3__26vectorIdNS_9allocatorIdEEE8max_sizeEv($52)|0);
 $25 = $53;
 $54 = HEAP32[$24>>2]|0;
 $55 = $25;
 $56 = ($54>>>0)>($55>>>0);
 if ($56) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($52);
  // unreachable;
 }
 $21 = $52;
 $57 = $21;
 $20 = $57;
 $58 = $20;
 $19 = $58;
 $59 = $19;
 $60 = ((($59)) + 8|0);
 $18 = $60;
 $61 = $18;
 $17 = $61;
 $62 = $17;
 $63 = HEAP32[$62>>2]|0;
 $64 = HEAP32[$58>>2]|0;
 $65 = $63;
 $66 = $64;
 $67 = (($65) - ($66))|0;
 $68 = (($67|0) / 8)&-1;
 $26 = $68;
 $69 = $26;
 $70 = $25;
 $71 = (($70>>>0) / 2)&-1;
 $72 = ($69>>>0)>=($71>>>0);
 if ($72) {
  $73 = $25;
  $22 = $73;
 } else {
  $74 = $26;
  $75 = $74<<1;
  HEAP32[$27>>2] = $75;
  $14 = $27;
  $15 = $24;
  $76 = $14;
  $77 = $15;
  ;HEAP8[$13>>0]=HEAP8[$16>>0]|0;
  $11 = $76;
  $12 = $77;
  $78 = $11;
  $79 = $12;
  $8 = $13;
  $9 = $78;
  $10 = $79;
  $80 = $9;
  $81 = HEAP32[$80>>2]|0;
  $82 = $10;
  $83 = HEAP32[$82>>2]|0;
  $84 = ($81>>>0)<($83>>>0);
  $85 = $12;
  $86 = $11;
  $87 = $84 ? $85 : $86;
  $88 = HEAP32[$87>>2]|0;
  $22 = $88;
 }
 $89 = $22;
 $7 = $38;
 $90 = $7;
 $91 = ((($90)) + 4|0);
 $92 = HEAP32[$91>>2]|0;
 $93 = HEAP32[$90>>2]|0;
 $94 = $92;
 $95 = $93;
 $96 = (($94) - ($95))|0;
 $97 = (($96|0) / 8)&-1;
 $98 = $34;
 __ZNSt3__214__split_bufferIdRNS_9allocatorIdEEEC2EjjS3_($35,$89,$97,$98);
 $99 = $34;
 $100 = ((($35)) + 8|0);
 $101 = HEAP32[$100>>2]|0;
 $6 = $101;
 $102 = $6;
 $103 = $33;
 $5 = $103;
 $104 = $5;
 $2 = $99;
 $3 = $102;
 $4 = $104;
 $105 = $3;
 $106 = $4;
 $107 = +HEAPF64[$106>>3];
 HEAPF64[$105>>3] = $107;
 $108 = ((($35)) + 8|0);
 $109 = HEAP32[$108>>2]|0;
 $110 = ((($109)) + 8|0);
 HEAP32[$108>>2] = $110;
 __THREW__ = 0;
 invoke_vii(67,($38|0),($35|0));
 $111 = __THREW__; __THREW__ = 0;
 $112 = $111&1;
 if (!($112)) {
  __ZNSt3__214__split_bufferIdRNS_9allocatorIdEEED2Ev($35);
  STACKTOP = sp;return;
 }
 $113 = ___cxa_find_matching_catch_2()|0;
 $114 = tempRet0;
 $36 = $113;
 $37 = $114;
 __THREW__ = 0;
 invoke_vi(68,($35|0));
 $115 = __THREW__; __THREW__ = 0;
 $116 = $115&1;
 if ($116) {
  $119 = ___cxa_find_matching_catch_3(0|0)|0;
  $120 = tempRet0;
  ___clang_call_terminate($119);
  // unreachable;
 } else {
  $117 = $36;
  $118 = $37;
  ___resumeException($117|0);
  // unreachable;
 }
}
function __ZNSt3__26vectorIdNS_9allocatorIdEEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 __ZNSt3__213__vector_baseIdNS_9allocatorIdEEED2Ev($2);
 STACKTOP = sp;return;
}
function __ZNSt3__213__vector_baseIdNS_9allocatorIdEEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 144|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(144|0);
 $4 = sp;
 $7 = sp + 128|0;
 $31 = sp + 12|0;
 $33 = sp + 4|0;
 $32 = $0;
 $34 = $32;
 $35 = HEAP32[$34>>2]|0;
 $29 = $31;
 $30 = -1;
 $36 = $29;
 HEAP32[$36>>2] = 0;
 $37 = HEAP32[$31>>2]|0;
 HEAP32[$33>>2] = $37;
 $21 = $33;
 $38 = ($35|0)!=(0|0);
 if (!($38)) {
  STACKTOP = sp;return;
 }
 $13 = $34;
 $39 = $13;
 $40 = HEAP32[$39>>2]|0;
 $11 = $39;
 $12 = $40;
 $41 = $11;
 while(1) {
  $42 = $12;
  $43 = ((($41)) + 4|0);
  $44 = HEAP32[$43>>2]|0;
  $45 = ($42|0)!=($44|0);
  if (!($45)) {
   break;
  }
  $10 = $41;
  $46 = $10;
  $47 = ((($46)) + 8|0);
  $9 = $47;
  $48 = $9;
  $8 = $48;
  $49 = $8;
  $50 = ((($41)) + 4|0);
  $51 = HEAP32[$50>>2]|0;
  $52 = ((($51)) + -8|0);
  HEAP32[$50>>2] = $52;
  $1 = $52;
  $53 = $1;
  $5 = $49;
  $6 = $53;
  $54 = $5;
  $55 = $6;
  ;HEAP8[$4>>0]=HEAP8[$7>>0]|0;
  $2 = $54;
  $3 = $55;
 }
 $16 = $34;
 $56 = $16;
 $57 = ((($56)) + 8|0);
 $15 = $57;
 $58 = $15;
 $14 = $58;
 $59 = $14;
 $60 = HEAP32[$34>>2]|0;
 $20 = $34;
 $61 = $20;
 $19 = $61;
 $62 = $19;
 $63 = ((($62)) + 8|0);
 $18 = $63;
 $64 = $18;
 $17 = $64;
 $65 = $17;
 $66 = HEAP32[$65>>2]|0;
 $67 = HEAP32[$61>>2]|0;
 $68 = $66;
 $69 = $67;
 $70 = (($68) - ($69))|0;
 $71 = (($70|0) / 8)&-1;
 $26 = $59;
 $27 = $60;
 $28 = $71;
 $72 = $26;
 $73 = $27;
 $74 = $28;
 $23 = $72;
 $24 = $73;
 $25 = $74;
 $75 = $24;
 $22 = $75;
 $76 = $22;
 __ZdlPv($76);
 STACKTOP = sp;return;
}
function __ZNKSt3__26vectorIdNS_9allocatorIdEEE8max_sizeEv($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $3 = sp + 8|0;
 $5 = sp + 77|0;
 $11 = sp;
 $14 = sp + 76|0;
 $19 = sp + 16|0;
 $20 = sp + 12|0;
 $18 = $0;
 $21 = $18;
 $17 = $21;
 $22 = $17;
 $23 = ((($22)) + 8|0);
 $16 = $23;
 $24 = $16;
 $15 = $24;
 $25 = $15;
 $4 = $25;
 $26 = $4;
 ;HEAP8[$3>>0]=HEAP8[$5>>0]|0;
 $2 = $26;
 $27 = $2;
 $1 = $27;
 HEAP32[$19>>2] = 536870911;
 HEAP32[$20>>2] = 2147483647;
 $12 = $19;
 $13 = $20;
 $28 = $12;
 $29 = $13;
 ;HEAP8[$11>>0]=HEAP8[$14>>0]|0;
 $9 = $28;
 $10 = $29;
 $30 = $10;
 $31 = $9;
 $6 = $11;
 $7 = $30;
 $8 = $31;
 $32 = $7;
 $33 = HEAP32[$32>>2]|0;
 $34 = $8;
 $35 = HEAP32[$34>>2]|0;
 $36 = ($33>>>0)<($35>>>0);
 $37 = $10;
 $38 = $9;
 $39 = $36 ? $37 : $38;
 $40 = HEAP32[$39>>2]|0;
 STACKTOP = sp;return ($40|0);
}
function __ZNSt3__214__split_bufferIdRNS_9allocatorIdEEEC2EjjS3_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 176|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(176|0);
 $11 = sp + 136|0;
 $15 = sp + 120|0;
 $32 = sp + 52|0;
 $39 = sp + 24|0;
 $44 = sp + 4|0;
 $45 = sp;
 $40 = $0;
 $41 = $1;
 $42 = $2;
 $43 = $3;
 $46 = $40;
 $47 = ((($46)) + 12|0);
 $37 = $39;
 $38 = -1;
 $48 = $37;
 HEAP32[$48>>2] = 0;
 $49 = HEAP32[$39>>2]|0;
 HEAP32[$44>>2] = $49;
 $17 = $44;
 $50 = $43;
 $14 = $47;
 HEAP32[$15>>2] = 0;
 $16 = $50;
 $51 = $14;
 $13 = $15;
 $52 = $13;
 $53 = HEAP32[$52>>2]|0;
 $54 = $16;
 $7 = $54;
 $55 = $7;
 $10 = $51;
 HEAP32[$11>>2] = $53;
 $12 = $55;
 $56 = $10;
 $9 = $11;
 $57 = $9;
 $58 = HEAP32[$57>>2]|0;
 HEAP32[$56>>2] = $58;
 $59 = ((($56)) + 4|0);
 $60 = $12;
 $8 = $60;
 $61 = $8;
 HEAP32[$59>>2] = $61;
 $62 = $41;
 $63 = ($62|0)!=(0);
 if (!($63)) {
  $30 = $32;
  $31 = -1;
  $90 = $30;
  HEAP32[$90>>2] = 0;
  $91 = HEAP32[$32>>2]|0;
  HEAP32[$45>>2] = $91;
  $33 = $45;
  $92 = 0;
  HEAP32[$46>>2] = $92;
  $93 = HEAP32[$46>>2]|0;
  $94 = $42;
  $95 = (($93) + ($94<<3)|0);
  $96 = ((($46)) + 8|0);
  HEAP32[$96>>2] = $95;
  $97 = ((($46)) + 4|0);
  HEAP32[$97>>2] = $95;
  $98 = HEAP32[$46>>2]|0;
  $99 = $41;
  $100 = (($98) + ($99<<3)|0);
  $36 = $46;
  $101 = $36;
  $102 = ((($101)) + 12|0);
  $35 = $102;
  $103 = $35;
  $34 = $103;
  $104 = $34;
  HEAP32[$104>>2] = $100;
  STACKTOP = sp;return;
 }
 $6 = $46;
 $64 = $6;
 $65 = ((($64)) + 12|0);
 $5 = $65;
 $66 = $5;
 $4 = $66;
 $67 = $4;
 $68 = ((($67)) + 4|0);
 $69 = HEAP32[$68>>2]|0;
 $70 = $41;
 $28 = $69;
 $29 = $70;
 $71 = $28;
 $72 = $29;
 $25 = $71;
 $26 = $72;
 $27 = 0;
 $73 = $25;
 $74 = $26;
 $24 = $73;
 $75 = ($74>>>0)>(536870911);
 if (!($75)) {
  $86 = $26;
  $87 = $86<<3;
  $23 = $87;
  $88 = $23;
  $89 = (__Znwj($88)|0);
  $92 = $89;
  HEAP32[$46>>2] = $92;
  $93 = HEAP32[$46>>2]|0;
  $94 = $42;
  $95 = (($93) + ($94<<3)|0);
  $96 = ((($46)) + 8|0);
  HEAP32[$96>>2] = $95;
  $97 = ((($46)) + 4|0);
  HEAP32[$97>>2] = $95;
  $98 = HEAP32[$46>>2]|0;
  $99 = $41;
  $100 = (($98) + ($99<<3)|0);
  $36 = $46;
  $101 = $36;
  $102 = ((($101)) + 12|0);
  $35 = $102;
  $103 = $35;
  $34 = $103;
  $104 = $34;
  HEAP32[$104>>2] = $100;
  STACKTOP = sp;return;
 }
 $20 = 31739;
 $76 = (___cxa_allocate_exception(8)|0);
 $77 = $20;
 $18 = $76;
 $19 = $77;
 $78 = $18;
 $79 = $19;
 __THREW__ = 0;
 invoke_vii(66,($78|0),($79|0));
 $80 = __THREW__; __THREW__ = 0;
 $81 = $80&1;
 if ($81) {
  $82 = ___cxa_find_matching_catch_2()|0;
  $83 = tempRet0;
  $21 = $82;
  $22 = $83;
  ___cxa_free_exception(($76|0));
  $84 = $21;
  $85 = $22;
  ___resumeException($84|0);
  // unreachable;
 } else {
  HEAP32[$78>>2] = (31680);
  ___cxa_throw(($76|0),(30904|0),(31|0));
  // unreachable;
 }
}
function __ZNSt3__26vectorIdNS_9allocatorIdEEE26__swap_out_circular_bufferERNS_14__split_bufferIdRS2_EE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 352|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(352|0);
 $15 = sp + 288|0;
 $21 = sp + 264|0;
 $33 = sp + 216|0;
 $86 = $0;
 $87 = $1;
 $88 = $86;
 $85 = $88;
 $89 = $85;
 $84 = $89;
 $90 = $84;
 $91 = HEAP32[$90>>2]|0;
 $83 = $91;
 $92 = $83;
 $62 = $89;
 $93 = $62;
 $94 = HEAP32[$93>>2]|0;
 $61 = $94;
 $95 = $61;
 $67 = $89;
 $96 = $67;
 $66 = $96;
 $97 = $66;
 $65 = $97;
 $98 = $65;
 $99 = ((($98)) + 8|0);
 $64 = $99;
 $100 = $64;
 $63 = $100;
 $101 = $63;
 $102 = HEAP32[$101>>2]|0;
 $103 = HEAP32[$97>>2]|0;
 $104 = $102;
 $105 = $103;
 $106 = (($104) - ($105))|0;
 $107 = (($106|0) / 8)&-1;
 $108 = (($95) + ($107<<3)|0);
 $69 = $89;
 $109 = $69;
 $110 = HEAP32[$109>>2]|0;
 $68 = $110;
 $111 = $68;
 $70 = $89;
 $112 = $70;
 $113 = ((($112)) + 4|0);
 $114 = HEAP32[$113>>2]|0;
 $115 = HEAP32[$112>>2]|0;
 $116 = $114;
 $117 = $115;
 $118 = (($116) - ($117))|0;
 $119 = (($118|0) / 8)&-1;
 $120 = (($111) + ($119<<3)|0);
 $72 = $89;
 $121 = $72;
 $122 = HEAP32[$121>>2]|0;
 $71 = $122;
 $123 = $71;
 $77 = $89;
 $124 = $77;
 $76 = $124;
 $125 = $76;
 $75 = $125;
 $126 = $75;
 $127 = ((($126)) + 8|0);
 $74 = $127;
 $128 = $74;
 $73 = $128;
 $129 = $73;
 $130 = HEAP32[$129>>2]|0;
 $131 = HEAP32[$125>>2]|0;
 $132 = $130;
 $133 = $131;
 $134 = (($132) - ($133))|0;
 $135 = (($134|0) / 8)&-1;
 $136 = (($123) + ($135<<3)|0);
 $78 = $89;
 $79 = $92;
 $80 = $108;
 $81 = $120;
 $82 = $136;
 $4 = $88;
 $137 = $4;
 $138 = ((($137)) + 8|0);
 $3 = $138;
 $139 = $3;
 $2 = $139;
 $140 = $2;
 $141 = HEAP32[$88>>2]|0;
 $142 = ((($88)) + 4|0);
 $143 = HEAP32[$142>>2]|0;
 $144 = $87;
 $145 = ((($144)) + 4|0);
 $5 = $140;
 $6 = $141;
 $7 = $143;
 $8 = $145;
 $146 = $7;
 $147 = $6;
 $148 = $146;
 $149 = $147;
 $150 = (($148) - ($149))|0;
 $151 = (($150|0) / 8)&-1;
 $9 = $151;
 $152 = $9;
 $153 = $8;
 $154 = HEAP32[$153>>2]|0;
 $155 = (0 - ($152))|0;
 $156 = (($154) + ($155<<3)|0);
 HEAP32[$153>>2] = $156;
 $157 = $9;
 $158 = ($157|0)>(0);
 if ($158) {
  $159 = $8;
  $160 = HEAP32[$159>>2]|0;
  $161 = $6;
  $162 = $9;
  $163 = $162<<3;
  _memcpy(($160|0),($161|0),($163|0))|0;
 }
 $164 = $87;
 $165 = ((($164)) + 4|0);
 $13 = $88;
 $14 = $165;
 $166 = $13;
 $12 = $166;
 $167 = $12;
 $168 = HEAP32[$167>>2]|0;
 HEAP32[$15>>2] = $168;
 $169 = $14;
 $10 = $169;
 $170 = $10;
 $171 = HEAP32[$170>>2]|0;
 $172 = $13;
 HEAP32[$172>>2] = $171;
 $11 = $15;
 $173 = $11;
 $174 = HEAP32[$173>>2]|0;
 $175 = $14;
 HEAP32[$175>>2] = $174;
 $176 = ((($88)) + 4|0);
 $177 = $87;
 $178 = ((($177)) + 8|0);
 $19 = $176;
 $20 = $178;
 $179 = $19;
 $18 = $179;
 $180 = $18;
 $181 = HEAP32[$180>>2]|0;
 HEAP32[$21>>2] = $181;
 $182 = $20;
 $16 = $182;
 $183 = $16;
 $184 = HEAP32[$183>>2]|0;
 $185 = $19;
 HEAP32[$185>>2] = $184;
 $17 = $21;
 $186 = $17;
 $187 = HEAP32[$186>>2]|0;
 $188 = $20;
 HEAP32[$188>>2] = $187;
 $24 = $88;
 $189 = $24;
 $190 = ((($189)) + 8|0);
 $23 = $190;
 $191 = $23;
 $22 = $191;
 $192 = $22;
 $193 = $87;
 $27 = $193;
 $194 = $27;
 $195 = ((($194)) + 12|0);
 $26 = $195;
 $196 = $26;
 $25 = $196;
 $197 = $25;
 $31 = $192;
 $32 = $197;
 $198 = $31;
 $30 = $198;
 $199 = $30;
 $200 = HEAP32[$199>>2]|0;
 HEAP32[$33>>2] = $200;
 $201 = $32;
 $28 = $201;
 $202 = $28;
 $203 = HEAP32[$202>>2]|0;
 $204 = $31;
 HEAP32[$204>>2] = $203;
 $29 = $33;
 $205 = $29;
 $206 = HEAP32[$205>>2]|0;
 $207 = $32;
 HEAP32[$207>>2] = $206;
 $208 = $87;
 $209 = ((($208)) + 4|0);
 $210 = HEAP32[$209>>2]|0;
 $211 = $87;
 HEAP32[$211>>2] = $210;
 $34 = $88;
 $212 = $34;
 $213 = ((($212)) + 4|0);
 $214 = HEAP32[$213>>2]|0;
 $215 = HEAP32[$212>>2]|0;
 $216 = $214;
 $217 = $215;
 $218 = (($216) - ($217))|0;
 $219 = (($218|0) / 8)&-1;
 $58 = $88;
 $59 = $219;
 $220 = $58;
 $57 = $220;
 $221 = $57;
 $222 = HEAP32[$221>>2]|0;
 $56 = $222;
 $223 = $56;
 $36 = $220;
 $224 = $36;
 $225 = HEAP32[$224>>2]|0;
 $35 = $225;
 $226 = $35;
 $41 = $220;
 $227 = $41;
 $40 = $227;
 $228 = $40;
 $39 = $228;
 $229 = $39;
 $230 = ((($229)) + 8|0);
 $38 = $230;
 $231 = $38;
 $37 = $231;
 $232 = $37;
 $233 = HEAP32[$232>>2]|0;
 $234 = HEAP32[$228>>2]|0;
 $235 = $233;
 $236 = $234;
 $237 = (($235) - ($236))|0;
 $238 = (($237|0) / 8)&-1;
 $239 = (($226) + ($238<<3)|0);
 $43 = $220;
 $240 = $43;
 $241 = HEAP32[$240>>2]|0;
 $42 = $241;
 $242 = $42;
 $48 = $220;
 $243 = $48;
 $47 = $243;
 $244 = $47;
 $46 = $244;
 $245 = $46;
 $246 = ((($245)) + 8|0);
 $45 = $246;
 $247 = $45;
 $44 = $247;
 $248 = $44;
 $249 = HEAP32[$248>>2]|0;
 $250 = HEAP32[$244>>2]|0;
 $251 = $249;
 $252 = $250;
 $253 = (($251) - ($252))|0;
 $254 = (($253|0) / 8)&-1;
 $255 = (($242) + ($254<<3)|0);
 $50 = $220;
 $256 = $50;
 $257 = HEAP32[$256>>2]|0;
 $49 = $257;
 $258 = $49;
 $259 = $59;
 $260 = (($258) + ($259<<3)|0);
 $51 = $220;
 $52 = $223;
 $53 = $239;
 $54 = $255;
 $55 = $260;
 $60 = $88;
 STACKTOP = sp;return;
}
function __ZNSt3__214__split_bufferIdRNS_9allocatorIdEEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(128|0);
 $18 = sp + 8|0;
 $21 = sp + 125|0;
 $27 = sp;
 $30 = sp + 124|0;
 $32 = $0;
 $33 = $32;
 $31 = $33;
 $34 = $31;
 $35 = ((($34)) + 4|0);
 $36 = HEAP32[$35>>2]|0;
 $28 = $34;
 $29 = $36;
 $37 = $28;
 $38 = $29;
 ;HEAP8[$27>>0]=HEAP8[$30>>0]|0;
 $25 = $37;
 $26 = $38;
 $39 = $25;
 while(1) {
  $40 = $26;
  $41 = ((($39)) + 8|0);
  $42 = HEAP32[$41>>2]|0;
  $43 = ($40|0)!=($42|0);
  if (!($43)) {
   break;
  }
  $24 = $39;
  $44 = $24;
  $45 = ((($44)) + 12|0);
  $23 = $45;
  $46 = $23;
  $22 = $46;
  $47 = $22;
  $48 = ((($47)) + 4|0);
  $49 = HEAP32[$48>>2]|0;
  $50 = ((($39)) + 8|0);
  $51 = HEAP32[$50>>2]|0;
  $52 = ((($51)) + -8|0);
  HEAP32[$50>>2] = $52;
  $15 = $52;
  $53 = $15;
  $19 = $49;
  $20 = $53;
  $54 = $19;
  $55 = $20;
  ;HEAP8[$18>>0]=HEAP8[$21>>0]|0;
  $16 = $54;
  $17 = $55;
 }
 $56 = HEAP32[$33>>2]|0;
 $57 = ($56|0)!=(0|0);
 if (!($57)) {
  STACKTOP = sp;return;
 }
 $7 = $33;
 $58 = $7;
 $59 = ((($58)) + 12|0);
 $6 = $59;
 $60 = $6;
 $5 = $60;
 $61 = $5;
 $62 = ((($61)) + 4|0);
 $63 = HEAP32[$62>>2]|0;
 $64 = HEAP32[$33>>2]|0;
 $4 = $33;
 $65 = $4;
 $3 = $65;
 $66 = $3;
 $67 = ((($66)) + 12|0);
 $2 = $67;
 $68 = $2;
 $1 = $68;
 $69 = $1;
 $70 = HEAP32[$69>>2]|0;
 $71 = HEAP32[$65>>2]|0;
 $72 = $70;
 $73 = $71;
 $74 = (($72) - ($73))|0;
 $75 = (($74|0) / 8)&-1;
 $12 = $63;
 $13 = $64;
 $14 = $75;
 $76 = $12;
 $77 = $13;
 $78 = $14;
 $9 = $76;
 $10 = $77;
 $11 = $78;
 $79 = $10;
 $8 = $79;
 $80 = $8;
 __ZdlPv($80);
 STACKTOP = sp;return;
}
function __ZNK13EcgAnnotation10Filter30hzEPdid($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 var $$ = 0, $$expand_i1_val = 0, $$expand_i1_val2 = 0, $$pre_trunc = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0;
 var $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0.0, $126 = 0.0, $127 = 0, $128 = 0.0, $129 = 0.0, $13 = 0, $130 = 0.0, $131 = 0;
 var $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0;
 var $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0;
 var $169 = 0, $17 = 0, $170 = 0, $171 = 0.0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0;
 var $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0.0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0.0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0.0, $67 = 0.0, $68 = 0.0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0.0, $73 = 0.0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0;
 var $79 = 0, $8 = 0.0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0.0, $91 = 0.0, $92 = 0.0, $93 = 0, $94 = 0, $95 = 0.0, $96 = 0.0;
 var $97 = 0, $98 = 0, $99 = 0, $cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 368|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(368|0);
 $4 = sp + 364|0;
 $9 = sp + 136|0;
 $16 = sp;
 $20 = sp + 312|0;
 $21 = sp + 308|0;
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $29 = $5;
 __ZN3CWTC2Ev($9);
 $30 = $7;
 $31 = $8;
 __THREW__ = 0;
 invoke_viiidd(47,($9|0),($30|0),6,0.0,(+$31));
 $32 = __THREW__; __THREW__ = 0;
 $33 = $32&1;
 L1: do {
  if ($33) {
   label = 6;
  } else {
   $34 = $6;
   $35 = ((($29)) + 48|0);
   $36 = ((($35)) + 24|0);
   $37 = +HEAPF64[$36>>3];
   __THREW__ = 0;
   $38 = (invoke_iiididd(48,($9|0),($34|0),(+$37),1,0.0,0.0)|0);
   $39 = __THREW__; __THREW__ = 0;
   $40 = $39&1;
   if ($40) {
    label = 6;
   } else {
    $12 = $38;
    $13 = 0;
    while(1) {
     $41 = $13;
     $42 = $7;
     $43 = ($41|0)<($42|0);
     if (!($43)) {
      break;
     }
     $44 = $12;
     $45 = $13;
     $46 = (($44) + ($45<<3)|0);
     $47 = +HEAPF64[$46>>3];
     $48 = $6;
     $49 = $13;
     $50 = (($48) + ($49<<3)|0);
     HEAPF64[$50>>3] = $47;
     $51 = $13;
     $52 = (($51) + 1)|0;
     $13 = $52;
    }
    __THREW__ = 0;
    invoke_vi(51,($9|0));
    $55 = __THREW__; __THREW__ = 0;
    $56 = $55&1;
    if ($56) {
     label = 6;
    } else {
     $14 = 4;
     $57 = ((($29)) + 48|0);
     $58 = ((($57)) + 32|0);
     $59 = HEAP32[$58>>2]|0;
     $cond = ($59|0)==(1);
     if ($cond) {
      $15 = 0;
      while(1) {
       $60 = $15;
       $61 = $7;
       $62 = ($60|0)<($61|0);
       if (!($62)) {
        break;
       }
       $63 = $6;
       $64 = $15;
       $65 = (($63) + ($64<<3)|0);
       $66 = +HEAPF64[$65>>3];
       $67 = (+Math_abs((+$66)));
       $68 = $67 / 2.0;
       $69 = $6;
       $70 = $15;
       $71 = (($69) + ($70<<3)|0);
       $72 = +HEAPF64[$71>>3];
       $73 = $72 * $68;
       HEAPF64[$71>>3] = $73;
       $74 = $15;
       $75 = (($74) + 1)|0;
       $15 = $75;
      }
      $14 = 0;
     } else {
      $14 = 3;
     }
     __THREW__ = 0;
     invoke_vi(69,($16|0));
     $76 = __THREW__; __THREW__ = 0;
     $77 = $76&1;
     if ($77) {
      label = 6;
     } else {
      $78 = $14;
      $79 = $6;
      $80 = $7;
      __THREW__ = 0;
      $81 = (invoke_iiiii(70,($16|0),($78|0),($79|0),($80|0))|0);
      $82 = __THREW__; __THREW__ = 0;
      $83 = $82&1;
      L18: do {
       if (!($83)) {
        $84 = $81&1;
        $85 = ($84|0)==(0);
        if ($85) {
         $$expand_i1_val = 0;
         HEAP8[$4>>0] = $$expand_i1_val;
         $17 = 1;
        } else {
         $90 = $8;
         $91 = $90 / 23.0;
         __THREW__ = 0;
         $92 = (+invoke_did(71,($29|0),(+$91)));
         $93 = __THREW__; __THREW__ = 0;
         $94 = $93&1;
         if ($94) {
          break;
         }
         $95 = (+Math_ceil((+$92)));
         $96 = $95 - 2.0;
         $97 = (~~(($96)));
         $18 = $97;
         $98 = $18;
         $99 = ($98|0)<(1);
         $$ = $99 ? 1 : $97;
         $18 = $$;
         $100 = $18;
         __THREW__ = 0;
         invoke_vii(72,($16|0),($100|0));
         $101 = __THREW__; __THREW__ = 0;
         $102 = $101&1;
         if ($102) {
          break;
         }
         $103 = $18;
         $104 = $7;
         __THREW__ = 0;
         $105 = (invoke_iiii(73,($16|0),($103|0),($104|0))|0);
         $106 = __THREW__; __THREW__ = 0;
         $107 = $106&1;
         if ($107) {
          break;
         }
         $19 = $105;
         $108 = $18;
         $109 = $7;
         __THREW__ = 0;
         invoke_viiiii(74,($16|0),($108|0),($109|0),($20|0),($21|0));
         $110 = __THREW__; __THREW__ = 0;
         $111 = $110&1;
         if ($111) {
          break;
         }
         __THREW__ = 0;
         $112 = (invoke_ii(75,($16|0))|0);
         $113 = __THREW__; __THREW__ = 0;
         $114 = $113&1;
         if ($114) {
          break;
         }
         $22 = $112;
         __THREW__ = 0;
         $115 = (invoke_ii(75,($16|0))|0);
         $116 = __THREW__; __THREW__ = 0;
         $117 = $116&1;
         if ($117) {
          break;
         }
         $118 = $7;
         $119 = HEAP32[$20>>2]|0;
         $120 = (($118) - ($119))|0;
         $121 = (($115) + ($120<<3)|0);
         $23 = $121;
         $122 = $18;
         $25 = $122;
         while(1) {
          $123 = $25;
          $124 = ($123|0)>(0);
          if (!($124)) {
           break;
          }
          $125 = $8;
          $126 = 2.0 * $125;
          $127 = $25;
          $128 = (+($127|0));
          $129 = (+Math_pow(2.0,(+$128)));
          $130 = $126 / $129;
          $131 = (~~(($130)));
          $24 = $131;
          $132 = $23;
          $133 = $19;
          $134 = $18;
          $135 = $25;
          $136 = (($134) - ($135))|0;
          $137 = (($133) + ($136<<2)|0);
          $138 = HEAP32[$137>>2]|0;
          $139 = $24;
          __THREW__ = 0;
          invoke_viiiiii(76,($29|0),($132|0),($138|0),($139|0),0,0);
          $140 = __THREW__; __THREW__ = 0;
          $141 = $140&1;
          if ($141) {
           break L18;
          }
          $142 = $19;
          $143 = $18;
          $144 = $25;
          $145 = (($143) - ($144))|0;
          $146 = (($142) + ($145<<2)|0);
          $147 = HEAP32[$146>>2]|0;
          $148 = $23;
          $149 = (($148) + ($147<<3)|0);
          $23 = $149;
          $150 = $25;
          $151 = (($150) + -1)|0;
          $25 = $151;
         }
         $26 = 0;
         while(1) {
          $152 = $26;
          $153 = HEAP32[$21>>2]|0;
          $154 = ($152|0)<($153|0);
          if (!($154)) {
           break;
          }
          $155 = $22;
          $156 = $26;
          $157 = (($155) + ($156<<3)|0);
          HEAPF64[$157>>3] = 0.0;
          $158 = $26;
          $159 = (($158) + 1)|0;
          $26 = $159;
         }
         $160 = $18;
         __THREW__ = 0;
         invoke_vii(77,($16|0),($160|0));
         $161 = __THREW__; __THREW__ = 0;
         $162 = $161&1;
         if ($162) {
          break;
         }
         $27 = 0;
         while(1) {
          $163 = $27;
          __THREW__ = 0;
          $164 = (invoke_ii(78,($16|0))|0);
          $165 = __THREW__; __THREW__ = 0;
          $166 = $165&1;
          if ($166) {
           break L18;
          }
          $167 = ($163|0)<($164|0);
          if (!($167)) {
           break;
          }
          $168 = $22;
          $169 = $27;
          $170 = (($168) + ($169<<3)|0);
          $171 = +HEAPF64[$170>>3];
          $172 = $6;
          $173 = $27;
          $174 = (($172) + ($173<<3)|0);
          HEAPF64[$174>>3] = $171;
          $175 = $27;
          $176 = (($175) + 1)|0;
          $27 = $176;
         }
         $177 = $7;
         $178 = $7;
         __THREW__ = 0;
         $179 = (invoke_ii(78,($16|0))|0);
         $180 = __THREW__; __THREW__ = 0;
         $181 = $180&1;
         if ($181) {
          break;
         }
         $182 = (($178) - ($179))|0;
         $183 = (($177) - ($182))|0;
         $28 = $183;
         while(1) {
          $184 = $28;
          $185 = $7;
          $186 = ($184|0)<($185|0);
          if (!($186)) {
           break;
          }
          $187 = $6;
          $188 = $28;
          $189 = (($187) + ($188<<3)|0);
          HEAPF64[$189>>3] = 0.0;
          $190 = $28;
          $191 = (($190) + 1)|0;
          $28 = $191;
         }
         __THREW__ = 0;
         invoke_vi(79,($16|0));
         $192 = __THREW__; __THREW__ = 0;
         $193 = $192&1;
         if ($193) {
          break;
         }
         $$expand_i1_val2 = 1;
         HEAP8[$4>>0] = $$expand_i1_val2;
         $17 = 1;
        }
        __THREW__ = 0;
        invoke_vi(3,($16|0));
        $194 = __THREW__; __THREW__ = 0;
        $195 = $194&1;
        if ($195) {
         label = 6;
         break L1;
        }
        __ZN3CWTD2Ev($9);
        $$pre_trunc = HEAP8[$4>>0]|0;
        $196 = $$pre_trunc&1;
        STACKTOP = sp;return ($196|0);
       }
      } while(0);
      $86 = ___cxa_find_matching_catch_2()|0;
      $87 = tempRet0;
      $10 = $86;
      $11 = $87;
      __THREW__ = 0;
      invoke_vi(3,($16|0));
      $88 = __THREW__; __THREW__ = 0;
      $89 = $88&1;
      if ($89) {
       $201 = ___cxa_find_matching_catch_3(0|0)|0;
       $202 = tempRet0;
       ___clang_call_terminate($201);
       // unreachable;
      }
     }
    }
   }
  }
 } while(0);
 if ((label|0) == 6) {
  $53 = ___cxa_find_matching_catch_2()|0;
  $54 = tempRet0;
  $10 = $53;
  $11 = $54;
 }
 __THREW__ = 0;
 invoke_vi(7,($9|0));
 $197 = __THREW__; __THREW__ = 0;
 $198 = $197&1;
 if ($198) {
  $201 = ___cxa_find_matching_catch_3(0|0)|0;
  $202 = tempRet0;
  ___clang_call_terminate($201);
  // unreachable;
 } else {
  $199 = $10;
  $200 = $11;
  ___resumeException($199|0);
  // unreachable;
 }
 return (0)|0;
}
function __ZNK13EcgAnnotation7IsNoiseEPKdi($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$expand_i1_val = 0, $$expand_i1_val2 = 0, $$pre_trunc = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $3 = sp + 16|0;
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = 0;
 while(1) {
  $8 = $7;
  $9 = $6;
  $10 = ($8|0)<($9|0);
  if (!($10)) {
   label = 6;
   break;
  }
  $11 = $5;
  $12 = $7;
  $13 = (($11) + ($12<<3)|0);
  $14 = +HEAPF64[$13>>3];
  $15 = $14 != 0.0;
  if ($15) {
   label = 4;
   break;
  }
  $16 = $7;
  $17 = (($16) + 1)|0;
  $7 = $17;
 }
 if ((label|0) == 4) {
  $$expand_i1_val = 1;
  HEAP8[$3>>0] = $$expand_i1_val;
  $$pre_trunc = HEAP8[$3>>0]|0;
  $18 = $$pre_trunc&1;
  STACKTOP = sp;return ($18|0);
 }
 else if ((label|0) == 6) {
  $$expand_i1_val2 = 0;
  HEAP8[$3>>0] = $$expand_i1_val2;
  $$pre_trunc = HEAP8[$3>>0]|0;
  $18 = $$pre_trunc&1;
  STACKTOP = sp;return ($18|0);
 }
 return (0)|0;
}
function __ZNK3FWT13GetLoBandSizeEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1;
 $3 = ((($2)) + 108|0);
 $4 = HEAP32[$3>>2]|0;
 STACKTOP = sp;return ($4|0);
}
function _malloc($0) {
 $0 = $0|0;
 var $$$0172$i = 0, $$$0173$i = 0, $$$4236$i = 0, $$$4329$i = 0, $$$i = 0, $$0 = 0, $$0$i = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i20$i = 0, $$01$i$i = 0, $$0172$lcssa$i = 0, $$01726$i = 0, $$0173$lcssa$i = 0, $$01735$i = 0, $$0192 = 0, $$0194 = 0, $$0201$i$i = 0, $$0202$i$i = 0, $$0206$i$i = 0;
 var $$0207$i$i = 0, $$024370$i = 0, $$0260$i$i = 0, $$0261$i$i = 0, $$0262$i$i = 0, $$0268$i$i = 0, $$0269$i$i = 0, $$0320$i = 0, $$0322$i = 0, $$0323$i = 0, $$0325$i = 0, $$0331$i = 0, $$0336$i = 0, $$0337$$i = 0, $$0337$i = 0, $$0339$i = 0, $$0340$i = 0, $$0345$i = 0, $$1176$i = 0, $$1178$i = 0;
 var $$124469$i = 0, $$1264$i$i = 0, $$1266$i$i = 0, $$1321$i = 0, $$1326$i = 0, $$1341$i = 0, $$1347$i = 0, $$1351$i = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2333$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i200 = 0, $$3328$i = 0, $$3349$i = 0, $$4$lcssa$i = 0, $$4$ph$i = 0, $$411$i = 0;
 var $$4236$i = 0, $$4329$lcssa$i = 0, $$432910$i = 0, $$4335$$4$i = 0, $$4335$ph$i = 0, $$43359$i = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i17$i = 0, $$pre$i195 = 0, $$pre$i210 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i18$iZ2D = 0, $$pre$phi$i211Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phiZ2D = 0, $$sink1$i = 0;
 var $$sink1$i$i = 0, $$sink14$i = 0, $$sink2$i = 0, $$sink2$i204 = 0, $$sink3$i = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0;
 var $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0;
 var $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0;
 var $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0;
 var $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0;
 var $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0;
 var $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0;
 var $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0;
 var $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0;
 var $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0;
 var $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0;
 var $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0;
 var $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0;
 var $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0;
 var $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0;
 var $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0;
 var $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0;
 var $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0;
 var $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0;
 var $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0;
 var $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0;
 var $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0;
 var $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0;
 var $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0;
 var $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0;
 var $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0;
 var $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0;
 var $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0;
 var $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0;
 var $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0;
 var $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0;
 var $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0;
 var $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0;
 var $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0;
 var $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0;
 var $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0;
 var $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0;
 var $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0;
 var $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0;
 var $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0;
 var $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0;
 var $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0;
 var $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0;
 var $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0;
 var $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0;
 var $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0;
 var $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0;
 var $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0;
 var $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $98 = 0, $99 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i208 = 0, $exitcond$i$i = 0, $not$$i = 0;
 var $not$$i$i = 0, $not$$i197 = 0, $not$$i209 = 0, $not$1$i = 0, $not$1$i203 = 0, $not$3$i = 0, $not$5$i = 0, $or$cond$i = 0, $or$cond$i201 = 0, $or$cond1$i = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond11$not$i = 0, $or$cond12$i = 0, $or$cond2$i = 0, $or$cond2$i199 = 0, $or$cond49$i = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond7$i = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[9130]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (36560 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($16|0)==($20|0);
    if ($21) {
     $22 = 1 << $14;
     $23 = $22 ^ -1;
     $24 = $8 & $23;
     HEAP32[9130] = $24;
    } else {
     $25 = ((($20)) + 12|0);
     HEAP32[$25>>2] = $16;
     HEAP32[$17>>2] = $20;
    }
    $26 = $14 << 3;
    $27 = $26 | 3;
    $28 = ((($18)) + 4|0);
    HEAP32[$28>>2] = $27;
    $29 = (($18) + ($26)|0);
    $30 = ((($29)) + 4|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = $31 | 1;
    HEAP32[$30>>2] = $32;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $33 = HEAP32[(36528)>>2]|0;
   $34 = ($6>>>0)>($33>>>0);
   if ($34) {
    $35 = ($9|0)==(0);
    if (!($35)) {
     $36 = $9 << $7;
     $37 = 2 << $7;
     $38 = (0 - ($37))|0;
     $39 = $37 | $38;
     $40 = $36 & $39;
     $41 = (0 - ($40))|0;
     $42 = $40 & $41;
     $43 = (($42) + -1)|0;
     $44 = $43 >>> 12;
     $45 = $44 & 16;
     $46 = $43 >>> $45;
     $47 = $46 >>> 5;
     $48 = $47 & 8;
     $49 = $48 | $45;
     $50 = $46 >>> $48;
     $51 = $50 >>> 2;
     $52 = $51 & 4;
     $53 = $49 | $52;
     $54 = $50 >>> $52;
     $55 = $54 >>> 1;
     $56 = $55 & 2;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 1;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = (($61) + ($62))|0;
     $64 = $63 << 1;
     $65 = (36560 + ($64<<2)|0);
     $66 = ((($65)) + 8|0);
     $67 = HEAP32[$66>>2]|0;
     $68 = ((($67)) + 8|0);
     $69 = HEAP32[$68>>2]|0;
     $70 = ($65|0)==($69|0);
     if ($70) {
      $71 = 1 << $63;
      $72 = $71 ^ -1;
      $73 = $8 & $72;
      HEAP32[9130] = $73;
      $90 = $73;
     } else {
      $74 = ((($69)) + 12|0);
      HEAP32[$74>>2] = $65;
      HEAP32[$66>>2] = $69;
      $90 = $8;
     }
     $75 = $63 << 3;
     $76 = (($75) - ($6))|0;
     $77 = $6 | 3;
     $78 = ((($67)) + 4|0);
     HEAP32[$78>>2] = $77;
     $79 = (($67) + ($6)|0);
     $80 = $76 | 1;
     $81 = ((($79)) + 4|0);
     HEAP32[$81>>2] = $80;
     $82 = (($79) + ($76)|0);
     HEAP32[$82>>2] = $76;
     $83 = ($33|0)==(0);
     if (!($83)) {
      $84 = HEAP32[(36540)>>2]|0;
      $85 = $33 >>> 3;
      $86 = $85 << 1;
      $87 = (36560 + ($86<<2)|0);
      $88 = 1 << $85;
      $89 = $90 & $88;
      $91 = ($89|0)==(0);
      if ($91) {
       $92 = $90 | $88;
       HEAP32[9130] = $92;
       $$pre = ((($87)) + 8|0);
       $$0194 = $87;$$pre$phiZ2D = $$pre;
      } else {
       $93 = ((($87)) + 8|0);
       $94 = HEAP32[$93>>2]|0;
       $$0194 = $94;$$pre$phiZ2D = $93;
      }
      HEAP32[$$pre$phiZ2D>>2] = $84;
      $95 = ((($$0194)) + 12|0);
      HEAP32[$95>>2] = $84;
      $96 = ((($84)) + 8|0);
      HEAP32[$96>>2] = $$0194;
      $97 = ((($84)) + 12|0);
      HEAP32[$97>>2] = $87;
     }
     HEAP32[(36528)>>2] = $76;
     HEAP32[(36540)>>2] = $79;
     $$0 = $68;
     STACKTOP = sp;return ($$0|0);
    }
    $98 = HEAP32[(36524)>>2]|0;
    $99 = ($98|0)==(0);
    if ($99) {
     $$0192 = $6;
    } else {
     $100 = (0 - ($98))|0;
     $101 = $98 & $100;
     $102 = (($101) + -1)|0;
     $103 = $102 >>> 12;
     $104 = $103 & 16;
     $105 = $102 >>> $104;
     $106 = $105 >>> 5;
     $107 = $106 & 8;
     $108 = $107 | $104;
     $109 = $105 >>> $107;
     $110 = $109 >>> 2;
     $111 = $110 & 4;
     $112 = $108 | $111;
     $113 = $109 >>> $111;
     $114 = $113 >>> 1;
     $115 = $114 & 2;
     $116 = $112 | $115;
     $117 = $113 >>> $115;
     $118 = $117 >>> 1;
     $119 = $118 & 1;
     $120 = $116 | $119;
     $121 = $117 >>> $119;
     $122 = (($120) + ($121))|0;
     $123 = (36824 + ($122<<2)|0);
     $124 = HEAP32[$123>>2]|0;
     $125 = ((($124)) + 4|0);
     $126 = HEAP32[$125>>2]|0;
     $127 = $126 & -8;
     $128 = (($127) - ($6))|0;
     $129 = ((($124)) + 16|0);
     $130 = HEAP32[$129>>2]|0;
     $not$3$i = ($130|0)==(0|0);
     $$sink14$i = $not$3$i&1;
     $131 = (((($124)) + 16|0) + ($$sink14$i<<2)|0);
     $132 = HEAP32[$131>>2]|0;
     $133 = ($132|0)==(0|0);
     if ($133) {
      $$0172$lcssa$i = $124;$$0173$lcssa$i = $128;
     } else {
      $$01726$i = $124;$$01735$i = $128;$135 = $132;
      while(1) {
       $134 = ((($135)) + 4|0);
       $136 = HEAP32[$134>>2]|0;
       $137 = $136 & -8;
       $138 = (($137) - ($6))|0;
       $139 = ($138>>>0)<($$01735$i>>>0);
       $$$0173$i = $139 ? $138 : $$01735$i;
       $$$0172$i = $139 ? $135 : $$01726$i;
       $140 = ((($135)) + 16|0);
       $141 = HEAP32[$140>>2]|0;
       $not$$i = ($141|0)==(0|0);
       $$sink1$i = $not$$i&1;
       $142 = (((($135)) + 16|0) + ($$sink1$i<<2)|0);
       $143 = HEAP32[$142>>2]|0;
       $144 = ($143|0)==(0|0);
       if ($144) {
        $$0172$lcssa$i = $$$0172$i;$$0173$lcssa$i = $$$0173$i;
        break;
       } else {
        $$01726$i = $$$0172$i;$$01735$i = $$$0173$i;$135 = $143;
       }
      }
     }
     $145 = (($$0172$lcssa$i) + ($6)|0);
     $146 = ($$0172$lcssa$i>>>0)<($145>>>0);
     if ($146) {
      $147 = ((($$0172$lcssa$i)) + 24|0);
      $148 = HEAP32[$147>>2]|0;
      $149 = ((($$0172$lcssa$i)) + 12|0);
      $150 = HEAP32[$149>>2]|0;
      $151 = ($150|0)==($$0172$lcssa$i|0);
      do {
       if ($151) {
        $156 = ((($$0172$lcssa$i)) + 20|0);
        $157 = HEAP32[$156>>2]|0;
        $158 = ($157|0)==(0|0);
        if ($158) {
         $159 = ((($$0172$lcssa$i)) + 16|0);
         $160 = HEAP32[$159>>2]|0;
         $161 = ($160|0)==(0|0);
         if ($161) {
          $$3$i = 0;
          break;
         } else {
          $$1176$i = $160;$$1178$i = $159;
         }
        } else {
         $$1176$i = $157;$$1178$i = $156;
        }
        while(1) {
         $162 = ((($$1176$i)) + 20|0);
         $163 = HEAP32[$162>>2]|0;
         $164 = ($163|0)==(0|0);
         if (!($164)) {
          $$1176$i = $163;$$1178$i = $162;
          continue;
         }
         $165 = ((($$1176$i)) + 16|0);
         $166 = HEAP32[$165>>2]|0;
         $167 = ($166|0)==(0|0);
         if ($167) {
          break;
         } else {
          $$1176$i = $166;$$1178$i = $165;
         }
        }
        HEAP32[$$1178$i>>2] = 0;
        $$3$i = $$1176$i;
       } else {
        $152 = ((($$0172$lcssa$i)) + 8|0);
        $153 = HEAP32[$152>>2]|0;
        $154 = ((($153)) + 12|0);
        HEAP32[$154>>2] = $150;
        $155 = ((($150)) + 8|0);
        HEAP32[$155>>2] = $153;
        $$3$i = $150;
       }
      } while(0);
      $168 = ($148|0)==(0|0);
      do {
       if (!($168)) {
        $169 = ((($$0172$lcssa$i)) + 28|0);
        $170 = HEAP32[$169>>2]|0;
        $171 = (36824 + ($170<<2)|0);
        $172 = HEAP32[$171>>2]|0;
        $173 = ($$0172$lcssa$i|0)==($172|0);
        if ($173) {
         HEAP32[$171>>2] = $$3$i;
         $cond$i = ($$3$i|0)==(0|0);
         if ($cond$i) {
          $174 = 1 << $170;
          $175 = $174 ^ -1;
          $176 = $98 & $175;
          HEAP32[(36524)>>2] = $176;
          break;
         }
        } else {
         $177 = ((($148)) + 16|0);
         $178 = HEAP32[$177>>2]|0;
         $not$1$i = ($178|0)!=($$0172$lcssa$i|0);
         $$sink2$i = $not$1$i&1;
         $179 = (((($148)) + 16|0) + ($$sink2$i<<2)|0);
         HEAP32[$179>>2] = $$3$i;
         $180 = ($$3$i|0)==(0|0);
         if ($180) {
          break;
         }
        }
        $181 = ((($$3$i)) + 24|0);
        HEAP32[$181>>2] = $148;
        $182 = ((($$0172$lcssa$i)) + 16|0);
        $183 = HEAP32[$182>>2]|0;
        $184 = ($183|0)==(0|0);
        if (!($184)) {
         $185 = ((($$3$i)) + 16|0);
         HEAP32[$185>>2] = $183;
         $186 = ((($183)) + 24|0);
         HEAP32[$186>>2] = $$3$i;
        }
        $187 = ((($$0172$lcssa$i)) + 20|0);
        $188 = HEAP32[$187>>2]|0;
        $189 = ($188|0)==(0|0);
        if (!($189)) {
         $190 = ((($$3$i)) + 20|0);
         HEAP32[$190>>2] = $188;
         $191 = ((($188)) + 24|0);
         HEAP32[$191>>2] = $$3$i;
        }
       }
      } while(0);
      $192 = ($$0173$lcssa$i>>>0)<(16);
      if ($192) {
       $193 = (($$0173$lcssa$i) + ($6))|0;
       $194 = $193 | 3;
       $195 = ((($$0172$lcssa$i)) + 4|0);
       HEAP32[$195>>2] = $194;
       $196 = (($$0172$lcssa$i) + ($193)|0);
       $197 = ((($196)) + 4|0);
       $198 = HEAP32[$197>>2]|0;
       $199 = $198 | 1;
       HEAP32[$197>>2] = $199;
      } else {
       $200 = $6 | 3;
       $201 = ((($$0172$lcssa$i)) + 4|0);
       HEAP32[$201>>2] = $200;
       $202 = $$0173$lcssa$i | 1;
       $203 = ((($145)) + 4|0);
       HEAP32[$203>>2] = $202;
       $204 = (($145) + ($$0173$lcssa$i)|0);
       HEAP32[$204>>2] = $$0173$lcssa$i;
       $205 = ($33|0)==(0);
       if (!($205)) {
        $206 = HEAP32[(36540)>>2]|0;
        $207 = $33 >>> 3;
        $208 = $207 << 1;
        $209 = (36560 + ($208<<2)|0);
        $210 = 1 << $207;
        $211 = $8 & $210;
        $212 = ($211|0)==(0);
        if ($212) {
         $213 = $8 | $210;
         HEAP32[9130] = $213;
         $$pre$i = ((($209)) + 8|0);
         $$0$i = $209;$$pre$phi$iZ2D = $$pre$i;
        } else {
         $214 = ((($209)) + 8|0);
         $215 = HEAP32[$214>>2]|0;
         $$0$i = $215;$$pre$phi$iZ2D = $214;
        }
        HEAP32[$$pre$phi$iZ2D>>2] = $206;
        $216 = ((($$0$i)) + 12|0);
        HEAP32[$216>>2] = $206;
        $217 = ((($206)) + 8|0);
        HEAP32[$217>>2] = $$0$i;
        $218 = ((($206)) + 12|0);
        HEAP32[$218>>2] = $209;
       }
       HEAP32[(36528)>>2] = $$0173$lcssa$i;
       HEAP32[(36540)>>2] = $145;
      }
      $219 = ((($$0172$lcssa$i)) + 8|0);
      $$0 = $219;
      STACKTOP = sp;return ($$0|0);
     } else {
      $$0192 = $6;
     }
    }
   } else {
    $$0192 = $6;
   }
  } else {
   $220 = ($0>>>0)>(4294967231);
   if ($220) {
    $$0192 = -1;
   } else {
    $221 = (($0) + 11)|0;
    $222 = $221 & -8;
    $223 = HEAP32[(36524)>>2]|0;
    $224 = ($223|0)==(0);
    if ($224) {
     $$0192 = $222;
    } else {
     $225 = (0 - ($222))|0;
     $226 = $221 >>> 8;
     $227 = ($226|0)==(0);
     if ($227) {
      $$0336$i = 0;
     } else {
      $228 = ($222>>>0)>(16777215);
      if ($228) {
       $$0336$i = 31;
      } else {
       $229 = (($226) + 1048320)|0;
       $230 = $229 >>> 16;
       $231 = $230 & 8;
       $232 = $226 << $231;
       $233 = (($232) + 520192)|0;
       $234 = $233 >>> 16;
       $235 = $234 & 4;
       $236 = $235 | $231;
       $237 = $232 << $235;
       $238 = (($237) + 245760)|0;
       $239 = $238 >>> 16;
       $240 = $239 & 2;
       $241 = $236 | $240;
       $242 = (14 - ($241))|0;
       $243 = $237 << $240;
       $244 = $243 >>> 15;
       $245 = (($242) + ($244))|0;
       $246 = $245 << 1;
       $247 = (($245) + 7)|0;
       $248 = $222 >>> $247;
       $249 = $248 & 1;
       $250 = $249 | $246;
       $$0336$i = $250;
      }
     }
     $251 = (36824 + ($$0336$i<<2)|0);
     $252 = HEAP32[$251>>2]|0;
     $253 = ($252|0)==(0|0);
     L74: do {
      if ($253) {
       $$2333$i = 0;$$3$i200 = 0;$$3328$i = $225;
       label = 57;
      } else {
       $254 = ($$0336$i|0)==(31);
       $255 = $$0336$i >>> 1;
       $256 = (25 - ($255))|0;
       $257 = $254 ? 0 : $256;
       $258 = $222 << $257;
       $$0320$i = 0;$$0325$i = $225;$$0331$i = $252;$$0337$i = $258;$$0340$i = 0;
       while(1) {
        $259 = ((($$0331$i)) + 4|0);
        $260 = HEAP32[$259>>2]|0;
        $261 = $260 & -8;
        $262 = (($261) - ($222))|0;
        $263 = ($262>>>0)<($$0325$i>>>0);
        if ($263) {
         $264 = ($262|0)==(0);
         if ($264) {
          $$411$i = $$0331$i;$$432910$i = 0;$$43359$i = $$0331$i;
          label = 61;
          break L74;
         } else {
          $$1321$i = $$0331$i;$$1326$i = $262;
         }
        } else {
         $$1321$i = $$0320$i;$$1326$i = $$0325$i;
        }
        $265 = ((($$0331$i)) + 20|0);
        $266 = HEAP32[$265>>2]|0;
        $267 = $$0337$i >>> 31;
        $268 = (((($$0331$i)) + 16|0) + ($267<<2)|0);
        $269 = HEAP32[$268>>2]|0;
        $270 = ($266|0)==(0|0);
        $271 = ($266|0)==($269|0);
        $or$cond2$i199 = $270 | $271;
        $$1341$i = $or$cond2$i199 ? $$0340$i : $266;
        $272 = ($269|0)==(0|0);
        $not$5$i = $272 ^ 1;
        $273 = $not$5$i&1;
        $$0337$$i = $$0337$i << $273;
        if ($272) {
         $$2333$i = $$1341$i;$$3$i200 = $$1321$i;$$3328$i = $$1326$i;
         label = 57;
         break;
        } else {
         $$0320$i = $$1321$i;$$0325$i = $$1326$i;$$0331$i = $269;$$0337$i = $$0337$$i;$$0340$i = $$1341$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 57) {
      $274 = ($$2333$i|0)==(0|0);
      $275 = ($$3$i200|0)==(0|0);
      $or$cond$i201 = $274 & $275;
      if ($or$cond$i201) {
       $276 = 2 << $$0336$i;
       $277 = (0 - ($276))|0;
       $278 = $276 | $277;
       $279 = $223 & $278;
       $280 = ($279|0)==(0);
       if ($280) {
        $$0192 = $222;
        break;
       }
       $281 = (0 - ($279))|0;
       $282 = $279 & $281;
       $283 = (($282) + -1)|0;
       $284 = $283 >>> 12;
       $285 = $284 & 16;
       $286 = $283 >>> $285;
       $287 = $286 >>> 5;
       $288 = $287 & 8;
       $289 = $288 | $285;
       $290 = $286 >>> $288;
       $291 = $290 >>> 2;
       $292 = $291 & 4;
       $293 = $289 | $292;
       $294 = $290 >>> $292;
       $295 = $294 >>> 1;
       $296 = $295 & 2;
       $297 = $293 | $296;
       $298 = $294 >>> $296;
       $299 = $298 >>> 1;
       $300 = $299 & 1;
       $301 = $297 | $300;
       $302 = $298 >>> $300;
       $303 = (($301) + ($302))|0;
       $304 = (36824 + ($303<<2)|0);
       $305 = HEAP32[$304>>2]|0;
       $$4$ph$i = 0;$$4335$ph$i = $305;
      } else {
       $$4$ph$i = $$3$i200;$$4335$ph$i = $$2333$i;
      }
      $306 = ($$4335$ph$i|0)==(0|0);
      if ($306) {
       $$4$lcssa$i = $$4$ph$i;$$4329$lcssa$i = $$3328$i;
      } else {
       $$411$i = $$4$ph$i;$$432910$i = $$3328$i;$$43359$i = $$4335$ph$i;
       label = 61;
      }
     }
     if ((label|0) == 61) {
      while(1) {
       label = 0;
       $307 = ((($$43359$i)) + 4|0);
       $308 = HEAP32[$307>>2]|0;
       $309 = $308 & -8;
       $310 = (($309) - ($222))|0;
       $311 = ($310>>>0)<($$432910$i>>>0);
       $$$4329$i = $311 ? $310 : $$432910$i;
       $$4335$$4$i = $311 ? $$43359$i : $$411$i;
       $312 = ((($$43359$i)) + 16|0);
       $313 = HEAP32[$312>>2]|0;
       $not$1$i203 = ($313|0)==(0|0);
       $$sink2$i204 = $not$1$i203&1;
       $314 = (((($$43359$i)) + 16|0) + ($$sink2$i204<<2)|0);
       $315 = HEAP32[$314>>2]|0;
       $316 = ($315|0)==(0|0);
       if ($316) {
        $$4$lcssa$i = $$4335$$4$i;$$4329$lcssa$i = $$$4329$i;
        break;
       } else {
        $$411$i = $$4335$$4$i;$$432910$i = $$$4329$i;$$43359$i = $315;
        label = 61;
       }
      }
     }
     $317 = ($$4$lcssa$i|0)==(0|0);
     if ($317) {
      $$0192 = $222;
     } else {
      $318 = HEAP32[(36528)>>2]|0;
      $319 = (($318) - ($222))|0;
      $320 = ($$4329$lcssa$i>>>0)<($319>>>0);
      if ($320) {
       $321 = (($$4$lcssa$i) + ($222)|0);
       $322 = ($$4$lcssa$i>>>0)<($321>>>0);
       if (!($322)) {
        $$0 = 0;
        STACKTOP = sp;return ($$0|0);
       }
       $323 = ((($$4$lcssa$i)) + 24|0);
       $324 = HEAP32[$323>>2]|0;
       $325 = ((($$4$lcssa$i)) + 12|0);
       $326 = HEAP32[$325>>2]|0;
       $327 = ($326|0)==($$4$lcssa$i|0);
       do {
        if ($327) {
         $332 = ((($$4$lcssa$i)) + 20|0);
         $333 = HEAP32[$332>>2]|0;
         $334 = ($333|0)==(0|0);
         if ($334) {
          $335 = ((($$4$lcssa$i)) + 16|0);
          $336 = HEAP32[$335>>2]|0;
          $337 = ($336|0)==(0|0);
          if ($337) {
           $$3349$i = 0;
           break;
          } else {
           $$1347$i = $336;$$1351$i = $335;
          }
         } else {
          $$1347$i = $333;$$1351$i = $332;
         }
         while(1) {
          $338 = ((($$1347$i)) + 20|0);
          $339 = HEAP32[$338>>2]|0;
          $340 = ($339|0)==(0|0);
          if (!($340)) {
           $$1347$i = $339;$$1351$i = $338;
           continue;
          }
          $341 = ((($$1347$i)) + 16|0);
          $342 = HEAP32[$341>>2]|0;
          $343 = ($342|0)==(0|0);
          if ($343) {
           break;
          } else {
           $$1347$i = $342;$$1351$i = $341;
          }
         }
         HEAP32[$$1351$i>>2] = 0;
         $$3349$i = $$1347$i;
        } else {
         $328 = ((($$4$lcssa$i)) + 8|0);
         $329 = HEAP32[$328>>2]|0;
         $330 = ((($329)) + 12|0);
         HEAP32[$330>>2] = $326;
         $331 = ((($326)) + 8|0);
         HEAP32[$331>>2] = $329;
         $$3349$i = $326;
        }
       } while(0);
       $344 = ($324|0)==(0|0);
       do {
        if ($344) {
         $426 = $223;
        } else {
         $345 = ((($$4$lcssa$i)) + 28|0);
         $346 = HEAP32[$345>>2]|0;
         $347 = (36824 + ($346<<2)|0);
         $348 = HEAP32[$347>>2]|0;
         $349 = ($$4$lcssa$i|0)==($348|0);
         if ($349) {
          HEAP32[$347>>2] = $$3349$i;
          $cond$i208 = ($$3349$i|0)==(0|0);
          if ($cond$i208) {
           $350 = 1 << $346;
           $351 = $350 ^ -1;
           $352 = $223 & $351;
           HEAP32[(36524)>>2] = $352;
           $426 = $352;
           break;
          }
         } else {
          $353 = ((($324)) + 16|0);
          $354 = HEAP32[$353>>2]|0;
          $not$$i209 = ($354|0)!=($$4$lcssa$i|0);
          $$sink3$i = $not$$i209&1;
          $355 = (((($324)) + 16|0) + ($$sink3$i<<2)|0);
          HEAP32[$355>>2] = $$3349$i;
          $356 = ($$3349$i|0)==(0|0);
          if ($356) {
           $426 = $223;
           break;
          }
         }
         $357 = ((($$3349$i)) + 24|0);
         HEAP32[$357>>2] = $324;
         $358 = ((($$4$lcssa$i)) + 16|0);
         $359 = HEAP32[$358>>2]|0;
         $360 = ($359|0)==(0|0);
         if (!($360)) {
          $361 = ((($$3349$i)) + 16|0);
          HEAP32[$361>>2] = $359;
          $362 = ((($359)) + 24|0);
          HEAP32[$362>>2] = $$3349$i;
         }
         $363 = ((($$4$lcssa$i)) + 20|0);
         $364 = HEAP32[$363>>2]|0;
         $365 = ($364|0)==(0|0);
         if ($365) {
          $426 = $223;
         } else {
          $366 = ((($$3349$i)) + 20|0);
          HEAP32[$366>>2] = $364;
          $367 = ((($364)) + 24|0);
          HEAP32[$367>>2] = $$3349$i;
          $426 = $223;
         }
        }
       } while(0);
       $368 = ($$4329$lcssa$i>>>0)<(16);
       do {
        if ($368) {
         $369 = (($$4329$lcssa$i) + ($222))|0;
         $370 = $369 | 3;
         $371 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$371>>2] = $370;
         $372 = (($$4$lcssa$i) + ($369)|0);
         $373 = ((($372)) + 4|0);
         $374 = HEAP32[$373>>2]|0;
         $375 = $374 | 1;
         HEAP32[$373>>2] = $375;
        } else {
         $376 = $222 | 3;
         $377 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$377>>2] = $376;
         $378 = $$4329$lcssa$i | 1;
         $379 = ((($321)) + 4|0);
         HEAP32[$379>>2] = $378;
         $380 = (($321) + ($$4329$lcssa$i)|0);
         HEAP32[$380>>2] = $$4329$lcssa$i;
         $381 = $$4329$lcssa$i >>> 3;
         $382 = ($$4329$lcssa$i>>>0)<(256);
         if ($382) {
          $383 = $381 << 1;
          $384 = (36560 + ($383<<2)|0);
          $385 = HEAP32[9130]|0;
          $386 = 1 << $381;
          $387 = $385 & $386;
          $388 = ($387|0)==(0);
          if ($388) {
           $389 = $385 | $386;
           HEAP32[9130] = $389;
           $$pre$i210 = ((($384)) + 8|0);
           $$0345$i = $384;$$pre$phi$i211Z2D = $$pre$i210;
          } else {
           $390 = ((($384)) + 8|0);
           $391 = HEAP32[$390>>2]|0;
           $$0345$i = $391;$$pre$phi$i211Z2D = $390;
          }
          HEAP32[$$pre$phi$i211Z2D>>2] = $321;
          $392 = ((($$0345$i)) + 12|0);
          HEAP32[$392>>2] = $321;
          $393 = ((($321)) + 8|0);
          HEAP32[$393>>2] = $$0345$i;
          $394 = ((($321)) + 12|0);
          HEAP32[$394>>2] = $384;
          break;
         }
         $395 = $$4329$lcssa$i >>> 8;
         $396 = ($395|0)==(0);
         if ($396) {
          $$0339$i = 0;
         } else {
          $397 = ($$4329$lcssa$i>>>0)>(16777215);
          if ($397) {
           $$0339$i = 31;
          } else {
           $398 = (($395) + 1048320)|0;
           $399 = $398 >>> 16;
           $400 = $399 & 8;
           $401 = $395 << $400;
           $402 = (($401) + 520192)|0;
           $403 = $402 >>> 16;
           $404 = $403 & 4;
           $405 = $404 | $400;
           $406 = $401 << $404;
           $407 = (($406) + 245760)|0;
           $408 = $407 >>> 16;
           $409 = $408 & 2;
           $410 = $405 | $409;
           $411 = (14 - ($410))|0;
           $412 = $406 << $409;
           $413 = $412 >>> 15;
           $414 = (($411) + ($413))|0;
           $415 = $414 << 1;
           $416 = (($414) + 7)|0;
           $417 = $$4329$lcssa$i >>> $416;
           $418 = $417 & 1;
           $419 = $418 | $415;
           $$0339$i = $419;
          }
         }
         $420 = (36824 + ($$0339$i<<2)|0);
         $421 = ((($321)) + 28|0);
         HEAP32[$421>>2] = $$0339$i;
         $422 = ((($321)) + 16|0);
         $423 = ((($422)) + 4|0);
         HEAP32[$423>>2] = 0;
         HEAP32[$422>>2] = 0;
         $424 = 1 << $$0339$i;
         $425 = $426 & $424;
         $427 = ($425|0)==(0);
         if ($427) {
          $428 = $426 | $424;
          HEAP32[(36524)>>2] = $428;
          HEAP32[$420>>2] = $321;
          $429 = ((($321)) + 24|0);
          HEAP32[$429>>2] = $420;
          $430 = ((($321)) + 12|0);
          HEAP32[$430>>2] = $321;
          $431 = ((($321)) + 8|0);
          HEAP32[$431>>2] = $321;
          break;
         }
         $432 = HEAP32[$420>>2]|0;
         $433 = ($$0339$i|0)==(31);
         $434 = $$0339$i >>> 1;
         $435 = (25 - ($434))|0;
         $436 = $433 ? 0 : $435;
         $437 = $$4329$lcssa$i << $436;
         $$0322$i = $437;$$0323$i = $432;
         while(1) {
          $438 = ((($$0323$i)) + 4|0);
          $439 = HEAP32[$438>>2]|0;
          $440 = $439 & -8;
          $441 = ($440|0)==($$4329$lcssa$i|0);
          if ($441) {
           label = 97;
           break;
          }
          $442 = $$0322$i >>> 31;
          $443 = (((($$0323$i)) + 16|0) + ($442<<2)|0);
          $444 = $$0322$i << 1;
          $445 = HEAP32[$443>>2]|0;
          $446 = ($445|0)==(0|0);
          if ($446) {
           label = 96;
           break;
          } else {
           $$0322$i = $444;$$0323$i = $445;
          }
         }
         if ((label|0) == 96) {
          HEAP32[$443>>2] = $321;
          $447 = ((($321)) + 24|0);
          HEAP32[$447>>2] = $$0323$i;
          $448 = ((($321)) + 12|0);
          HEAP32[$448>>2] = $321;
          $449 = ((($321)) + 8|0);
          HEAP32[$449>>2] = $321;
          break;
         }
         else if ((label|0) == 97) {
          $450 = ((($$0323$i)) + 8|0);
          $451 = HEAP32[$450>>2]|0;
          $452 = ((($451)) + 12|0);
          HEAP32[$452>>2] = $321;
          HEAP32[$450>>2] = $321;
          $453 = ((($321)) + 8|0);
          HEAP32[$453>>2] = $451;
          $454 = ((($321)) + 12|0);
          HEAP32[$454>>2] = $$0323$i;
          $455 = ((($321)) + 24|0);
          HEAP32[$455>>2] = 0;
          break;
         }
        }
       } while(0);
       $456 = ((($$4$lcssa$i)) + 8|0);
       $$0 = $456;
       STACKTOP = sp;return ($$0|0);
      } else {
       $$0192 = $222;
      }
     }
    }
   }
  }
 } while(0);
 $457 = HEAP32[(36528)>>2]|0;
 $458 = ($457>>>0)<($$0192>>>0);
 if (!($458)) {
  $459 = (($457) - ($$0192))|0;
  $460 = HEAP32[(36540)>>2]|0;
  $461 = ($459>>>0)>(15);
  if ($461) {
   $462 = (($460) + ($$0192)|0);
   HEAP32[(36540)>>2] = $462;
   HEAP32[(36528)>>2] = $459;
   $463 = $459 | 1;
   $464 = ((($462)) + 4|0);
   HEAP32[$464>>2] = $463;
   $465 = (($462) + ($459)|0);
   HEAP32[$465>>2] = $459;
   $466 = $$0192 | 3;
   $467 = ((($460)) + 4|0);
   HEAP32[$467>>2] = $466;
  } else {
   HEAP32[(36528)>>2] = 0;
   HEAP32[(36540)>>2] = 0;
   $468 = $457 | 3;
   $469 = ((($460)) + 4|0);
   HEAP32[$469>>2] = $468;
   $470 = (($460) + ($457)|0);
   $471 = ((($470)) + 4|0);
   $472 = HEAP32[$471>>2]|0;
   $473 = $472 | 1;
   HEAP32[$471>>2] = $473;
  }
  $474 = ((($460)) + 8|0);
  $$0 = $474;
  STACKTOP = sp;return ($$0|0);
 }
 $475 = HEAP32[(36532)>>2]|0;
 $476 = ($475>>>0)>($$0192>>>0);
 if ($476) {
  $477 = (($475) - ($$0192))|0;
  HEAP32[(36532)>>2] = $477;
  $478 = HEAP32[(36544)>>2]|0;
  $479 = (($478) + ($$0192)|0);
  HEAP32[(36544)>>2] = $479;
  $480 = $477 | 1;
  $481 = ((($479)) + 4|0);
  HEAP32[$481>>2] = $480;
  $482 = $$0192 | 3;
  $483 = ((($478)) + 4|0);
  HEAP32[$483>>2] = $482;
  $484 = ((($478)) + 8|0);
  $$0 = $484;
  STACKTOP = sp;return ($$0|0);
 }
 $485 = HEAP32[9248]|0;
 $486 = ($485|0)==(0);
 if ($486) {
  HEAP32[(37000)>>2] = 4096;
  HEAP32[(36996)>>2] = 4096;
  HEAP32[(37004)>>2] = -1;
  HEAP32[(37008)>>2] = -1;
  HEAP32[(37012)>>2] = 0;
  HEAP32[(36964)>>2] = 0;
  $487 = $1;
  $488 = $487 & -16;
  $489 = $488 ^ 1431655768;
  HEAP32[$1>>2] = $489;
  HEAP32[9248] = $489;
  $493 = 4096;
 } else {
  $$pre$i195 = HEAP32[(37000)>>2]|0;
  $493 = $$pre$i195;
 }
 $490 = (($$0192) + 48)|0;
 $491 = (($$0192) + 47)|0;
 $492 = (($493) + ($491))|0;
 $494 = (0 - ($493))|0;
 $495 = $492 & $494;
 $496 = ($495>>>0)>($$0192>>>0);
 if (!($496)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $497 = HEAP32[(36960)>>2]|0;
 $498 = ($497|0)==(0);
 if (!($498)) {
  $499 = HEAP32[(36952)>>2]|0;
  $500 = (($499) + ($495))|0;
  $501 = ($500>>>0)<=($499>>>0);
  $502 = ($500>>>0)>($497>>>0);
  $or$cond1$i = $501 | $502;
  if ($or$cond1$i) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $503 = HEAP32[(36964)>>2]|0;
 $504 = $503 & 4;
 $505 = ($504|0)==(0);
 L167: do {
  if ($505) {
   $506 = HEAP32[(36544)>>2]|0;
   $507 = ($506|0)==(0|0);
   L169: do {
    if ($507) {
     label = 118;
    } else {
     $$0$i20$i = (36968);
     while(1) {
      $508 = HEAP32[$$0$i20$i>>2]|0;
      $509 = ($508>>>0)>($506>>>0);
      if (!($509)) {
       $510 = ((($$0$i20$i)) + 4|0);
       $511 = HEAP32[$510>>2]|0;
       $512 = (($508) + ($511)|0);
       $513 = ($512>>>0)>($506>>>0);
       if ($513) {
        break;
       }
      }
      $514 = ((($$0$i20$i)) + 8|0);
      $515 = HEAP32[$514>>2]|0;
      $516 = ($515|0)==(0|0);
      if ($516) {
       label = 118;
       break L169;
      } else {
       $$0$i20$i = $515;
      }
     }
     $539 = (($492) - ($475))|0;
     $540 = $539 & $494;
     $541 = ($540>>>0)<(2147483647);
     if ($541) {
      $542 = (_sbrk(($540|0))|0);
      $543 = HEAP32[$$0$i20$i>>2]|0;
      $544 = HEAP32[$510>>2]|0;
      $545 = (($543) + ($544)|0);
      $546 = ($542|0)==($545|0);
      if ($546) {
       $547 = ($542|0)==((-1)|0);
       if ($547) {
        $$2234243136$i = $540;
       } else {
        $$723947$i = $540;$$748$i = $542;
        label = 135;
        break L167;
       }
      } else {
       $$2247$ph$i = $542;$$2253$ph$i = $540;
       label = 126;
      }
     } else {
      $$2234243136$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 118) {
     $517 = (_sbrk(0)|0);
     $518 = ($517|0)==((-1)|0);
     if ($518) {
      $$2234243136$i = 0;
     } else {
      $519 = $517;
      $520 = HEAP32[(36996)>>2]|0;
      $521 = (($520) + -1)|0;
      $522 = $521 & $519;
      $523 = ($522|0)==(0);
      $524 = (($521) + ($519))|0;
      $525 = (0 - ($520))|0;
      $526 = $524 & $525;
      $527 = (($526) - ($519))|0;
      $528 = $523 ? 0 : $527;
      $$$i = (($528) + ($495))|0;
      $529 = HEAP32[(36952)>>2]|0;
      $530 = (($$$i) + ($529))|0;
      $531 = ($$$i>>>0)>($$0192>>>0);
      $532 = ($$$i>>>0)<(2147483647);
      $or$cond$i = $531 & $532;
      if ($or$cond$i) {
       $533 = HEAP32[(36960)>>2]|0;
       $534 = ($533|0)==(0);
       if (!($534)) {
        $535 = ($530>>>0)<=($529>>>0);
        $536 = ($530>>>0)>($533>>>0);
        $or$cond2$i = $535 | $536;
        if ($or$cond2$i) {
         $$2234243136$i = 0;
         break;
        }
       }
       $537 = (_sbrk(($$$i|0))|0);
       $538 = ($537|0)==($517|0);
       if ($538) {
        $$723947$i = $$$i;$$748$i = $517;
        label = 135;
        break L167;
       } else {
        $$2247$ph$i = $537;$$2253$ph$i = $$$i;
        label = 126;
       }
      } else {
       $$2234243136$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 126) {
     $548 = (0 - ($$2253$ph$i))|0;
     $549 = ($$2247$ph$i|0)!=((-1)|0);
     $550 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $550 & $549;
     $551 = ($490>>>0)>($$2253$ph$i>>>0);
     $or$cond10$i = $551 & $or$cond7$i;
     if (!($or$cond10$i)) {
      $561 = ($$2247$ph$i|0)==((-1)|0);
      if ($561) {
       $$2234243136$i = 0;
       break;
      } else {
       $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
       label = 135;
       break L167;
      }
     }
     $552 = HEAP32[(37000)>>2]|0;
     $553 = (($491) - ($$2253$ph$i))|0;
     $554 = (($553) + ($552))|0;
     $555 = (0 - ($552))|0;
     $556 = $554 & $555;
     $557 = ($556>>>0)<(2147483647);
     if (!($557)) {
      $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
      label = 135;
      break L167;
     }
     $558 = (_sbrk(($556|0))|0);
     $559 = ($558|0)==((-1)|0);
     if ($559) {
      (_sbrk(($548|0))|0);
      $$2234243136$i = 0;
      break;
     } else {
      $560 = (($556) + ($$2253$ph$i))|0;
      $$723947$i = $560;$$748$i = $$2247$ph$i;
      label = 135;
      break L167;
     }
    }
   } while(0);
   $562 = HEAP32[(36964)>>2]|0;
   $563 = $562 | 4;
   HEAP32[(36964)>>2] = $563;
   $$4236$i = $$2234243136$i;
   label = 133;
  } else {
   $$4236$i = 0;
   label = 133;
  }
 } while(0);
 if ((label|0) == 133) {
  $564 = ($495>>>0)<(2147483647);
  if ($564) {
   $565 = (_sbrk(($495|0))|0);
   $566 = (_sbrk(0)|0);
   $567 = ($565|0)!=((-1)|0);
   $568 = ($566|0)!=((-1)|0);
   $or$cond5$i = $567 & $568;
   $569 = ($565>>>0)<($566>>>0);
   $or$cond11$i = $569 & $or$cond5$i;
   $570 = $566;
   $571 = $565;
   $572 = (($570) - ($571))|0;
   $573 = (($$0192) + 40)|0;
   $574 = ($572>>>0)>($573>>>0);
   $$$4236$i = $574 ? $572 : $$4236$i;
   $or$cond11$not$i = $or$cond11$i ^ 1;
   $575 = ($565|0)==((-1)|0);
   $not$$i197 = $574 ^ 1;
   $576 = $575 | $not$$i197;
   $or$cond49$i = $576 | $or$cond11$not$i;
   if (!($or$cond49$i)) {
    $$723947$i = $$$4236$i;$$748$i = $565;
    label = 135;
   }
  }
 }
 if ((label|0) == 135) {
  $577 = HEAP32[(36952)>>2]|0;
  $578 = (($577) + ($$723947$i))|0;
  HEAP32[(36952)>>2] = $578;
  $579 = HEAP32[(36956)>>2]|0;
  $580 = ($578>>>0)>($579>>>0);
  if ($580) {
   HEAP32[(36956)>>2] = $578;
  }
  $581 = HEAP32[(36544)>>2]|0;
  $582 = ($581|0)==(0|0);
  do {
   if ($582) {
    $583 = HEAP32[(36536)>>2]|0;
    $584 = ($583|0)==(0|0);
    $585 = ($$748$i>>>0)<($583>>>0);
    $or$cond12$i = $584 | $585;
    if ($or$cond12$i) {
     HEAP32[(36536)>>2] = $$748$i;
    }
    HEAP32[(36968)>>2] = $$748$i;
    HEAP32[(36972)>>2] = $$723947$i;
    HEAP32[(36980)>>2] = 0;
    $586 = HEAP32[9248]|0;
    HEAP32[(36556)>>2] = $586;
    HEAP32[(36552)>>2] = -1;
    $$01$i$i = 0;
    while(1) {
     $587 = $$01$i$i << 1;
     $588 = (36560 + ($587<<2)|0);
     $589 = ((($588)) + 12|0);
     HEAP32[$589>>2] = $588;
     $590 = ((($588)) + 8|0);
     HEAP32[$590>>2] = $588;
     $591 = (($$01$i$i) + 1)|0;
     $exitcond$i$i = ($591|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $$01$i$i = $591;
     }
    }
    $592 = (($$723947$i) + -40)|0;
    $593 = ((($$748$i)) + 8|0);
    $594 = $593;
    $595 = $594 & 7;
    $596 = ($595|0)==(0);
    $597 = (0 - ($594))|0;
    $598 = $597 & 7;
    $599 = $596 ? 0 : $598;
    $600 = (($$748$i) + ($599)|0);
    $601 = (($592) - ($599))|0;
    HEAP32[(36544)>>2] = $600;
    HEAP32[(36532)>>2] = $601;
    $602 = $601 | 1;
    $603 = ((($600)) + 4|0);
    HEAP32[$603>>2] = $602;
    $604 = (($600) + ($601)|0);
    $605 = ((($604)) + 4|0);
    HEAP32[$605>>2] = 40;
    $606 = HEAP32[(37008)>>2]|0;
    HEAP32[(36548)>>2] = $606;
   } else {
    $$024370$i = (36968);
    while(1) {
     $607 = HEAP32[$$024370$i>>2]|0;
     $608 = ((($$024370$i)) + 4|0);
     $609 = HEAP32[$608>>2]|0;
     $610 = (($607) + ($609)|0);
     $611 = ($$748$i|0)==($610|0);
     if ($611) {
      label = 145;
      break;
     }
     $612 = ((($$024370$i)) + 8|0);
     $613 = HEAP32[$612>>2]|0;
     $614 = ($613|0)==(0|0);
     if ($614) {
      break;
     } else {
      $$024370$i = $613;
     }
    }
    if ((label|0) == 145) {
     $615 = ((($$024370$i)) + 12|0);
     $616 = HEAP32[$615>>2]|0;
     $617 = $616 & 8;
     $618 = ($617|0)==(0);
     if ($618) {
      $619 = ($581>>>0)>=($607>>>0);
      $620 = ($581>>>0)<($$748$i>>>0);
      $or$cond50$i = $620 & $619;
      if ($or$cond50$i) {
       $621 = (($609) + ($$723947$i))|0;
       HEAP32[$608>>2] = $621;
       $622 = HEAP32[(36532)>>2]|0;
       $623 = ((($581)) + 8|0);
       $624 = $623;
       $625 = $624 & 7;
       $626 = ($625|0)==(0);
       $627 = (0 - ($624))|0;
       $628 = $627 & 7;
       $629 = $626 ? 0 : $628;
       $630 = (($581) + ($629)|0);
       $631 = (($$723947$i) - ($629))|0;
       $632 = (($622) + ($631))|0;
       HEAP32[(36544)>>2] = $630;
       HEAP32[(36532)>>2] = $632;
       $633 = $632 | 1;
       $634 = ((($630)) + 4|0);
       HEAP32[$634>>2] = $633;
       $635 = (($630) + ($632)|0);
       $636 = ((($635)) + 4|0);
       HEAP32[$636>>2] = 40;
       $637 = HEAP32[(37008)>>2]|0;
       HEAP32[(36548)>>2] = $637;
       break;
      }
     }
    }
    $638 = HEAP32[(36536)>>2]|0;
    $639 = ($$748$i>>>0)<($638>>>0);
    if ($639) {
     HEAP32[(36536)>>2] = $$748$i;
    }
    $640 = (($$748$i) + ($$723947$i)|0);
    $$124469$i = (36968);
    while(1) {
     $641 = HEAP32[$$124469$i>>2]|0;
     $642 = ($641|0)==($640|0);
     if ($642) {
      label = 153;
      break;
     }
     $643 = ((($$124469$i)) + 8|0);
     $644 = HEAP32[$643>>2]|0;
     $645 = ($644|0)==(0|0);
     if ($645) {
      break;
     } else {
      $$124469$i = $644;
     }
    }
    if ((label|0) == 153) {
     $646 = ((($$124469$i)) + 12|0);
     $647 = HEAP32[$646>>2]|0;
     $648 = $647 & 8;
     $649 = ($648|0)==(0);
     if ($649) {
      HEAP32[$$124469$i>>2] = $$748$i;
      $650 = ((($$124469$i)) + 4|0);
      $651 = HEAP32[$650>>2]|0;
      $652 = (($651) + ($$723947$i))|0;
      HEAP32[$650>>2] = $652;
      $653 = ((($$748$i)) + 8|0);
      $654 = $653;
      $655 = $654 & 7;
      $656 = ($655|0)==(0);
      $657 = (0 - ($654))|0;
      $658 = $657 & 7;
      $659 = $656 ? 0 : $658;
      $660 = (($$748$i) + ($659)|0);
      $661 = ((($640)) + 8|0);
      $662 = $661;
      $663 = $662 & 7;
      $664 = ($663|0)==(0);
      $665 = (0 - ($662))|0;
      $666 = $665 & 7;
      $667 = $664 ? 0 : $666;
      $668 = (($640) + ($667)|0);
      $669 = $668;
      $670 = $660;
      $671 = (($669) - ($670))|0;
      $672 = (($660) + ($$0192)|0);
      $673 = (($671) - ($$0192))|0;
      $674 = $$0192 | 3;
      $675 = ((($660)) + 4|0);
      HEAP32[$675>>2] = $674;
      $676 = ($668|0)==($581|0);
      do {
       if ($676) {
        $677 = HEAP32[(36532)>>2]|0;
        $678 = (($677) + ($673))|0;
        HEAP32[(36532)>>2] = $678;
        HEAP32[(36544)>>2] = $672;
        $679 = $678 | 1;
        $680 = ((($672)) + 4|0);
        HEAP32[$680>>2] = $679;
       } else {
        $681 = HEAP32[(36540)>>2]|0;
        $682 = ($668|0)==($681|0);
        if ($682) {
         $683 = HEAP32[(36528)>>2]|0;
         $684 = (($683) + ($673))|0;
         HEAP32[(36528)>>2] = $684;
         HEAP32[(36540)>>2] = $672;
         $685 = $684 | 1;
         $686 = ((($672)) + 4|0);
         HEAP32[$686>>2] = $685;
         $687 = (($672) + ($684)|0);
         HEAP32[$687>>2] = $684;
         break;
        }
        $688 = ((($668)) + 4|0);
        $689 = HEAP32[$688>>2]|0;
        $690 = $689 & 3;
        $691 = ($690|0)==(1);
        if ($691) {
         $692 = $689 & -8;
         $693 = $689 >>> 3;
         $694 = ($689>>>0)<(256);
         L237: do {
          if ($694) {
           $695 = ((($668)) + 8|0);
           $696 = HEAP32[$695>>2]|0;
           $697 = ((($668)) + 12|0);
           $698 = HEAP32[$697>>2]|0;
           $699 = ($698|0)==($696|0);
           if ($699) {
            $700 = 1 << $693;
            $701 = $700 ^ -1;
            $702 = HEAP32[9130]|0;
            $703 = $702 & $701;
            HEAP32[9130] = $703;
            break;
           } else {
            $704 = ((($696)) + 12|0);
            HEAP32[$704>>2] = $698;
            $705 = ((($698)) + 8|0);
            HEAP32[$705>>2] = $696;
            break;
           }
          } else {
           $706 = ((($668)) + 24|0);
           $707 = HEAP32[$706>>2]|0;
           $708 = ((($668)) + 12|0);
           $709 = HEAP32[$708>>2]|0;
           $710 = ($709|0)==($668|0);
           do {
            if ($710) {
             $715 = ((($668)) + 16|0);
             $716 = ((($715)) + 4|0);
             $717 = HEAP32[$716>>2]|0;
             $718 = ($717|0)==(0|0);
             if ($718) {
              $719 = HEAP32[$715>>2]|0;
              $720 = ($719|0)==(0|0);
              if ($720) {
               $$3$i$i = 0;
               break;
              } else {
               $$1264$i$i = $719;$$1266$i$i = $715;
              }
             } else {
              $$1264$i$i = $717;$$1266$i$i = $716;
             }
             while(1) {
              $721 = ((($$1264$i$i)) + 20|0);
              $722 = HEAP32[$721>>2]|0;
              $723 = ($722|0)==(0|0);
              if (!($723)) {
               $$1264$i$i = $722;$$1266$i$i = $721;
               continue;
              }
              $724 = ((($$1264$i$i)) + 16|0);
              $725 = HEAP32[$724>>2]|0;
              $726 = ($725|0)==(0|0);
              if ($726) {
               break;
              } else {
               $$1264$i$i = $725;$$1266$i$i = $724;
              }
             }
             HEAP32[$$1266$i$i>>2] = 0;
             $$3$i$i = $$1264$i$i;
            } else {
             $711 = ((($668)) + 8|0);
             $712 = HEAP32[$711>>2]|0;
             $713 = ((($712)) + 12|0);
             HEAP32[$713>>2] = $709;
             $714 = ((($709)) + 8|0);
             HEAP32[$714>>2] = $712;
             $$3$i$i = $709;
            }
           } while(0);
           $727 = ($707|0)==(0|0);
           if ($727) {
            break;
           }
           $728 = ((($668)) + 28|0);
           $729 = HEAP32[$728>>2]|0;
           $730 = (36824 + ($729<<2)|0);
           $731 = HEAP32[$730>>2]|0;
           $732 = ($668|0)==($731|0);
           do {
            if ($732) {
             HEAP32[$730>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $733 = 1 << $729;
             $734 = $733 ^ -1;
             $735 = HEAP32[(36524)>>2]|0;
             $736 = $735 & $734;
             HEAP32[(36524)>>2] = $736;
             break L237;
            } else {
             $737 = ((($707)) + 16|0);
             $738 = HEAP32[$737>>2]|0;
             $not$$i$i = ($738|0)!=($668|0);
             $$sink1$i$i = $not$$i$i&1;
             $739 = (((($707)) + 16|0) + ($$sink1$i$i<<2)|0);
             HEAP32[$739>>2] = $$3$i$i;
             $740 = ($$3$i$i|0)==(0|0);
             if ($740) {
              break L237;
             }
            }
           } while(0);
           $741 = ((($$3$i$i)) + 24|0);
           HEAP32[$741>>2] = $707;
           $742 = ((($668)) + 16|0);
           $743 = HEAP32[$742>>2]|0;
           $744 = ($743|0)==(0|0);
           if (!($744)) {
            $745 = ((($$3$i$i)) + 16|0);
            HEAP32[$745>>2] = $743;
            $746 = ((($743)) + 24|0);
            HEAP32[$746>>2] = $$3$i$i;
           }
           $747 = ((($742)) + 4|0);
           $748 = HEAP32[$747>>2]|0;
           $749 = ($748|0)==(0|0);
           if ($749) {
            break;
           }
           $750 = ((($$3$i$i)) + 20|0);
           HEAP32[$750>>2] = $748;
           $751 = ((($748)) + 24|0);
           HEAP32[$751>>2] = $$3$i$i;
          }
         } while(0);
         $752 = (($668) + ($692)|0);
         $753 = (($692) + ($673))|0;
         $$0$i$i = $752;$$0260$i$i = $753;
        } else {
         $$0$i$i = $668;$$0260$i$i = $673;
        }
        $754 = ((($$0$i$i)) + 4|0);
        $755 = HEAP32[$754>>2]|0;
        $756 = $755 & -2;
        HEAP32[$754>>2] = $756;
        $757 = $$0260$i$i | 1;
        $758 = ((($672)) + 4|0);
        HEAP32[$758>>2] = $757;
        $759 = (($672) + ($$0260$i$i)|0);
        HEAP32[$759>>2] = $$0260$i$i;
        $760 = $$0260$i$i >>> 3;
        $761 = ($$0260$i$i>>>0)<(256);
        if ($761) {
         $762 = $760 << 1;
         $763 = (36560 + ($762<<2)|0);
         $764 = HEAP32[9130]|0;
         $765 = 1 << $760;
         $766 = $764 & $765;
         $767 = ($766|0)==(0);
         if ($767) {
          $768 = $764 | $765;
          HEAP32[9130] = $768;
          $$pre$i17$i = ((($763)) + 8|0);
          $$0268$i$i = $763;$$pre$phi$i18$iZ2D = $$pre$i17$i;
         } else {
          $769 = ((($763)) + 8|0);
          $770 = HEAP32[$769>>2]|0;
          $$0268$i$i = $770;$$pre$phi$i18$iZ2D = $769;
         }
         HEAP32[$$pre$phi$i18$iZ2D>>2] = $672;
         $771 = ((($$0268$i$i)) + 12|0);
         HEAP32[$771>>2] = $672;
         $772 = ((($672)) + 8|0);
         HEAP32[$772>>2] = $$0268$i$i;
         $773 = ((($672)) + 12|0);
         HEAP32[$773>>2] = $763;
         break;
        }
        $774 = $$0260$i$i >>> 8;
        $775 = ($774|0)==(0);
        do {
         if ($775) {
          $$0269$i$i = 0;
         } else {
          $776 = ($$0260$i$i>>>0)>(16777215);
          if ($776) {
           $$0269$i$i = 31;
           break;
          }
          $777 = (($774) + 1048320)|0;
          $778 = $777 >>> 16;
          $779 = $778 & 8;
          $780 = $774 << $779;
          $781 = (($780) + 520192)|0;
          $782 = $781 >>> 16;
          $783 = $782 & 4;
          $784 = $783 | $779;
          $785 = $780 << $783;
          $786 = (($785) + 245760)|0;
          $787 = $786 >>> 16;
          $788 = $787 & 2;
          $789 = $784 | $788;
          $790 = (14 - ($789))|0;
          $791 = $785 << $788;
          $792 = $791 >>> 15;
          $793 = (($790) + ($792))|0;
          $794 = $793 << 1;
          $795 = (($793) + 7)|0;
          $796 = $$0260$i$i >>> $795;
          $797 = $796 & 1;
          $798 = $797 | $794;
          $$0269$i$i = $798;
         }
        } while(0);
        $799 = (36824 + ($$0269$i$i<<2)|0);
        $800 = ((($672)) + 28|0);
        HEAP32[$800>>2] = $$0269$i$i;
        $801 = ((($672)) + 16|0);
        $802 = ((($801)) + 4|0);
        HEAP32[$802>>2] = 0;
        HEAP32[$801>>2] = 0;
        $803 = HEAP32[(36524)>>2]|0;
        $804 = 1 << $$0269$i$i;
        $805 = $803 & $804;
        $806 = ($805|0)==(0);
        if ($806) {
         $807 = $803 | $804;
         HEAP32[(36524)>>2] = $807;
         HEAP32[$799>>2] = $672;
         $808 = ((($672)) + 24|0);
         HEAP32[$808>>2] = $799;
         $809 = ((($672)) + 12|0);
         HEAP32[$809>>2] = $672;
         $810 = ((($672)) + 8|0);
         HEAP32[$810>>2] = $672;
         break;
        }
        $811 = HEAP32[$799>>2]|0;
        $812 = ($$0269$i$i|0)==(31);
        $813 = $$0269$i$i >>> 1;
        $814 = (25 - ($813))|0;
        $815 = $812 ? 0 : $814;
        $816 = $$0260$i$i << $815;
        $$0261$i$i = $816;$$0262$i$i = $811;
        while(1) {
         $817 = ((($$0262$i$i)) + 4|0);
         $818 = HEAP32[$817>>2]|0;
         $819 = $818 & -8;
         $820 = ($819|0)==($$0260$i$i|0);
         if ($820) {
          label = 194;
          break;
         }
         $821 = $$0261$i$i >>> 31;
         $822 = (((($$0262$i$i)) + 16|0) + ($821<<2)|0);
         $823 = $$0261$i$i << 1;
         $824 = HEAP32[$822>>2]|0;
         $825 = ($824|0)==(0|0);
         if ($825) {
          label = 193;
          break;
         } else {
          $$0261$i$i = $823;$$0262$i$i = $824;
         }
        }
        if ((label|0) == 193) {
         HEAP32[$822>>2] = $672;
         $826 = ((($672)) + 24|0);
         HEAP32[$826>>2] = $$0262$i$i;
         $827 = ((($672)) + 12|0);
         HEAP32[$827>>2] = $672;
         $828 = ((($672)) + 8|0);
         HEAP32[$828>>2] = $672;
         break;
        }
        else if ((label|0) == 194) {
         $829 = ((($$0262$i$i)) + 8|0);
         $830 = HEAP32[$829>>2]|0;
         $831 = ((($830)) + 12|0);
         HEAP32[$831>>2] = $672;
         HEAP32[$829>>2] = $672;
         $832 = ((($672)) + 8|0);
         HEAP32[$832>>2] = $830;
         $833 = ((($672)) + 12|0);
         HEAP32[$833>>2] = $$0262$i$i;
         $834 = ((($672)) + 24|0);
         HEAP32[$834>>2] = 0;
         break;
        }
       }
      } while(0);
      $959 = ((($660)) + 8|0);
      $$0 = $959;
      STACKTOP = sp;return ($$0|0);
     }
    }
    $$0$i$i$i = (36968);
    while(1) {
     $835 = HEAP32[$$0$i$i$i>>2]|0;
     $836 = ($835>>>0)>($581>>>0);
     if (!($836)) {
      $837 = ((($$0$i$i$i)) + 4|0);
      $838 = HEAP32[$837>>2]|0;
      $839 = (($835) + ($838)|0);
      $840 = ($839>>>0)>($581>>>0);
      if ($840) {
       break;
      }
     }
     $841 = ((($$0$i$i$i)) + 8|0);
     $842 = HEAP32[$841>>2]|0;
     $$0$i$i$i = $842;
    }
    $843 = ((($839)) + -47|0);
    $844 = ((($843)) + 8|0);
    $845 = $844;
    $846 = $845 & 7;
    $847 = ($846|0)==(0);
    $848 = (0 - ($845))|0;
    $849 = $848 & 7;
    $850 = $847 ? 0 : $849;
    $851 = (($843) + ($850)|0);
    $852 = ((($581)) + 16|0);
    $853 = ($851>>>0)<($852>>>0);
    $854 = $853 ? $581 : $851;
    $855 = ((($854)) + 8|0);
    $856 = ((($854)) + 24|0);
    $857 = (($$723947$i) + -40)|0;
    $858 = ((($$748$i)) + 8|0);
    $859 = $858;
    $860 = $859 & 7;
    $861 = ($860|0)==(0);
    $862 = (0 - ($859))|0;
    $863 = $862 & 7;
    $864 = $861 ? 0 : $863;
    $865 = (($$748$i) + ($864)|0);
    $866 = (($857) - ($864))|0;
    HEAP32[(36544)>>2] = $865;
    HEAP32[(36532)>>2] = $866;
    $867 = $866 | 1;
    $868 = ((($865)) + 4|0);
    HEAP32[$868>>2] = $867;
    $869 = (($865) + ($866)|0);
    $870 = ((($869)) + 4|0);
    HEAP32[$870>>2] = 40;
    $871 = HEAP32[(37008)>>2]|0;
    HEAP32[(36548)>>2] = $871;
    $872 = ((($854)) + 4|0);
    HEAP32[$872>>2] = 27;
    ;HEAP32[$855>>2]=HEAP32[(36968)>>2]|0;HEAP32[$855+4>>2]=HEAP32[(36968)+4>>2]|0;HEAP32[$855+8>>2]=HEAP32[(36968)+8>>2]|0;HEAP32[$855+12>>2]=HEAP32[(36968)+12>>2]|0;
    HEAP32[(36968)>>2] = $$748$i;
    HEAP32[(36972)>>2] = $$723947$i;
    HEAP32[(36980)>>2] = 0;
    HEAP32[(36976)>>2] = $855;
    $874 = $856;
    while(1) {
     $873 = ((($874)) + 4|0);
     HEAP32[$873>>2] = 7;
     $875 = ((($874)) + 8|0);
     $876 = ($875>>>0)<($839>>>0);
     if ($876) {
      $874 = $873;
     } else {
      break;
     }
    }
    $877 = ($854|0)==($581|0);
    if (!($877)) {
     $878 = $854;
     $879 = $581;
     $880 = (($878) - ($879))|0;
     $881 = HEAP32[$872>>2]|0;
     $882 = $881 & -2;
     HEAP32[$872>>2] = $882;
     $883 = $880 | 1;
     $884 = ((($581)) + 4|0);
     HEAP32[$884>>2] = $883;
     HEAP32[$854>>2] = $880;
     $885 = $880 >>> 3;
     $886 = ($880>>>0)<(256);
     if ($886) {
      $887 = $885 << 1;
      $888 = (36560 + ($887<<2)|0);
      $889 = HEAP32[9130]|0;
      $890 = 1 << $885;
      $891 = $889 & $890;
      $892 = ($891|0)==(0);
      if ($892) {
       $893 = $889 | $890;
       HEAP32[9130] = $893;
       $$pre$i$i = ((($888)) + 8|0);
       $$0206$i$i = $888;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $894 = ((($888)) + 8|0);
       $895 = HEAP32[$894>>2]|0;
       $$0206$i$i = $895;$$pre$phi$i$iZ2D = $894;
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $581;
      $896 = ((($$0206$i$i)) + 12|0);
      HEAP32[$896>>2] = $581;
      $897 = ((($581)) + 8|0);
      HEAP32[$897>>2] = $$0206$i$i;
      $898 = ((($581)) + 12|0);
      HEAP32[$898>>2] = $888;
      break;
     }
     $899 = $880 >>> 8;
     $900 = ($899|0)==(0);
     if ($900) {
      $$0207$i$i = 0;
     } else {
      $901 = ($880>>>0)>(16777215);
      if ($901) {
       $$0207$i$i = 31;
      } else {
       $902 = (($899) + 1048320)|0;
       $903 = $902 >>> 16;
       $904 = $903 & 8;
       $905 = $899 << $904;
       $906 = (($905) + 520192)|0;
       $907 = $906 >>> 16;
       $908 = $907 & 4;
       $909 = $908 | $904;
       $910 = $905 << $908;
       $911 = (($910) + 245760)|0;
       $912 = $911 >>> 16;
       $913 = $912 & 2;
       $914 = $909 | $913;
       $915 = (14 - ($914))|0;
       $916 = $910 << $913;
       $917 = $916 >>> 15;
       $918 = (($915) + ($917))|0;
       $919 = $918 << 1;
       $920 = (($918) + 7)|0;
       $921 = $880 >>> $920;
       $922 = $921 & 1;
       $923 = $922 | $919;
       $$0207$i$i = $923;
      }
     }
     $924 = (36824 + ($$0207$i$i<<2)|0);
     $925 = ((($581)) + 28|0);
     HEAP32[$925>>2] = $$0207$i$i;
     $926 = ((($581)) + 20|0);
     HEAP32[$926>>2] = 0;
     HEAP32[$852>>2] = 0;
     $927 = HEAP32[(36524)>>2]|0;
     $928 = 1 << $$0207$i$i;
     $929 = $927 & $928;
     $930 = ($929|0)==(0);
     if ($930) {
      $931 = $927 | $928;
      HEAP32[(36524)>>2] = $931;
      HEAP32[$924>>2] = $581;
      $932 = ((($581)) + 24|0);
      HEAP32[$932>>2] = $924;
      $933 = ((($581)) + 12|0);
      HEAP32[$933>>2] = $581;
      $934 = ((($581)) + 8|0);
      HEAP32[$934>>2] = $581;
      break;
     }
     $935 = HEAP32[$924>>2]|0;
     $936 = ($$0207$i$i|0)==(31);
     $937 = $$0207$i$i >>> 1;
     $938 = (25 - ($937))|0;
     $939 = $936 ? 0 : $938;
     $940 = $880 << $939;
     $$0201$i$i = $940;$$0202$i$i = $935;
     while(1) {
      $941 = ((($$0202$i$i)) + 4|0);
      $942 = HEAP32[$941>>2]|0;
      $943 = $942 & -8;
      $944 = ($943|0)==($880|0);
      if ($944) {
       label = 216;
       break;
      }
      $945 = $$0201$i$i >>> 31;
      $946 = (((($$0202$i$i)) + 16|0) + ($945<<2)|0);
      $947 = $$0201$i$i << 1;
      $948 = HEAP32[$946>>2]|0;
      $949 = ($948|0)==(0|0);
      if ($949) {
       label = 215;
       break;
      } else {
       $$0201$i$i = $947;$$0202$i$i = $948;
      }
     }
     if ((label|0) == 215) {
      HEAP32[$946>>2] = $581;
      $950 = ((($581)) + 24|0);
      HEAP32[$950>>2] = $$0202$i$i;
      $951 = ((($581)) + 12|0);
      HEAP32[$951>>2] = $581;
      $952 = ((($581)) + 8|0);
      HEAP32[$952>>2] = $581;
      break;
     }
     else if ((label|0) == 216) {
      $953 = ((($$0202$i$i)) + 8|0);
      $954 = HEAP32[$953>>2]|0;
      $955 = ((($954)) + 12|0);
      HEAP32[$955>>2] = $581;
      HEAP32[$953>>2] = $581;
      $956 = ((($581)) + 8|0);
      HEAP32[$956>>2] = $954;
      $957 = ((($581)) + 12|0);
      HEAP32[$957>>2] = $$0202$i$i;
      $958 = ((($581)) + 24|0);
      HEAP32[$958>>2] = 0;
      break;
     }
    }
   }
  } while(0);
  $960 = HEAP32[(36532)>>2]|0;
  $961 = ($960>>>0)>($$0192>>>0);
  if ($961) {
   $962 = (($960) - ($$0192))|0;
   HEAP32[(36532)>>2] = $962;
   $963 = HEAP32[(36544)>>2]|0;
   $964 = (($963) + ($$0192)|0);
   HEAP32[(36544)>>2] = $964;
   $965 = $962 | 1;
   $966 = ((($964)) + 4|0);
   HEAP32[$966>>2] = $965;
   $967 = $$0192 | 3;
   $968 = ((($963)) + 4|0);
   HEAP32[$968>>2] = $967;
   $969 = ((($963)) + 8|0);
   $$0 = $969;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $970 = (___errno_location()|0);
 HEAP32[$970>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0195$i = 0, $$0195$in$i = 0, $$0348 = 0, $$0349 = 0, $$0361 = 0, $$0368 = 0, $$1 = 0, $$1347 = 0, $$1352 = 0, $$1355 = 0, $$1363 = 0, $$1367 = 0, $$2 = 0, $$3 = 0, $$3365 = 0, $$pre = 0, $$pre$phiZ2D = 0, $$sink3 = 0, $$sink5 = 0, $1 = 0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond374 = 0, $cond375 = 0, $not$ = 0, $not$370 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(36536)>>2]|0;
 $4 = ((($0)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & -8;
 $7 = (($2) + ($6)|0);
 $8 = $5 & 1;
 $9 = ($8|0)==(0);
 do {
  if ($9) {
   $10 = HEAP32[$2>>2]|0;
   $11 = $5 & 3;
   $12 = ($11|0)==(0);
   if ($12) {
    return;
   }
   $13 = (0 - ($10))|0;
   $14 = (($2) + ($13)|0);
   $15 = (($10) + ($6))|0;
   $16 = ($14>>>0)<($3>>>0);
   if ($16) {
    return;
   }
   $17 = HEAP32[(36540)>>2]|0;
   $18 = ($14|0)==($17|0);
   if ($18) {
    $78 = ((($7)) + 4|0);
    $79 = HEAP32[$78>>2]|0;
    $80 = $79 & 3;
    $81 = ($80|0)==(3);
    if (!($81)) {
     $$1 = $14;$$1347 = $15;$87 = $14;
     break;
    }
    $82 = (($14) + ($15)|0);
    $83 = ((($14)) + 4|0);
    $84 = $15 | 1;
    $85 = $79 & -2;
    HEAP32[(36528)>>2] = $15;
    HEAP32[$78>>2] = $85;
    HEAP32[$83>>2] = $84;
    HEAP32[$82>>2] = $15;
    return;
   }
   $19 = $10 >>> 3;
   $20 = ($10>>>0)<(256);
   if ($20) {
    $21 = ((($14)) + 8|0);
    $22 = HEAP32[$21>>2]|0;
    $23 = ((($14)) + 12|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ($24|0)==($22|0);
    if ($25) {
     $26 = 1 << $19;
     $27 = $26 ^ -1;
     $28 = HEAP32[9130]|0;
     $29 = $28 & $27;
     HEAP32[9130] = $29;
     $$1 = $14;$$1347 = $15;$87 = $14;
     break;
    } else {
     $30 = ((($22)) + 12|0);
     HEAP32[$30>>2] = $24;
     $31 = ((($24)) + 8|0);
     HEAP32[$31>>2] = $22;
     $$1 = $14;$$1347 = $15;$87 = $14;
     break;
    }
   }
   $32 = ((($14)) + 24|0);
   $33 = HEAP32[$32>>2]|0;
   $34 = ((($14)) + 12|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = ($35|0)==($14|0);
   do {
    if ($36) {
     $41 = ((($14)) + 16|0);
     $42 = ((($41)) + 4|0);
     $43 = HEAP32[$42>>2]|0;
     $44 = ($43|0)==(0|0);
     if ($44) {
      $45 = HEAP32[$41>>2]|0;
      $46 = ($45|0)==(0|0);
      if ($46) {
       $$3 = 0;
       break;
      } else {
       $$1352 = $45;$$1355 = $41;
      }
     } else {
      $$1352 = $43;$$1355 = $42;
     }
     while(1) {
      $47 = ((($$1352)) + 20|0);
      $48 = HEAP32[$47>>2]|0;
      $49 = ($48|0)==(0|0);
      if (!($49)) {
       $$1352 = $48;$$1355 = $47;
       continue;
      }
      $50 = ((($$1352)) + 16|0);
      $51 = HEAP32[$50>>2]|0;
      $52 = ($51|0)==(0|0);
      if ($52) {
       break;
      } else {
       $$1352 = $51;$$1355 = $50;
      }
     }
     HEAP32[$$1355>>2] = 0;
     $$3 = $$1352;
    } else {
     $37 = ((($14)) + 8|0);
     $38 = HEAP32[$37>>2]|0;
     $39 = ((($38)) + 12|0);
     HEAP32[$39>>2] = $35;
     $40 = ((($35)) + 8|0);
     HEAP32[$40>>2] = $38;
     $$3 = $35;
    }
   } while(0);
   $53 = ($33|0)==(0|0);
   if ($53) {
    $$1 = $14;$$1347 = $15;$87 = $14;
   } else {
    $54 = ((($14)) + 28|0);
    $55 = HEAP32[$54>>2]|0;
    $56 = (36824 + ($55<<2)|0);
    $57 = HEAP32[$56>>2]|0;
    $58 = ($14|0)==($57|0);
    if ($58) {
     HEAP32[$56>>2] = $$3;
     $cond374 = ($$3|0)==(0|0);
     if ($cond374) {
      $59 = 1 << $55;
      $60 = $59 ^ -1;
      $61 = HEAP32[(36524)>>2]|0;
      $62 = $61 & $60;
      HEAP32[(36524)>>2] = $62;
      $$1 = $14;$$1347 = $15;$87 = $14;
      break;
     }
    } else {
     $63 = ((($33)) + 16|0);
     $64 = HEAP32[$63>>2]|0;
     $not$370 = ($64|0)!=($14|0);
     $$sink3 = $not$370&1;
     $65 = (((($33)) + 16|0) + ($$sink3<<2)|0);
     HEAP32[$65>>2] = $$3;
     $66 = ($$3|0)==(0|0);
     if ($66) {
      $$1 = $14;$$1347 = $15;$87 = $14;
      break;
     }
    }
    $67 = ((($$3)) + 24|0);
    HEAP32[$67>>2] = $33;
    $68 = ((($14)) + 16|0);
    $69 = HEAP32[$68>>2]|0;
    $70 = ($69|0)==(0|0);
    if (!($70)) {
     $71 = ((($$3)) + 16|0);
     HEAP32[$71>>2] = $69;
     $72 = ((($69)) + 24|0);
     HEAP32[$72>>2] = $$3;
    }
    $73 = ((($68)) + 4|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = ($74|0)==(0|0);
    if ($75) {
     $$1 = $14;$$1347 = $15;$87 = $14;
    } else {
     $76 = ((($$3)) + 20|0);
     HEAP32[$76>>2] = $74;
     $77 = ((($74)) + 24|0);
     HEAP32[$77>>2] = $$3;
     $$1 = $14;$$1347 = $15;$87 = $14;
    }
   }
  } else {
   $$1 = $2;$$1347 = $6;$87 = $2;
  }
 } while(0);
 $86 = ($87>>>0)<($7>>>0);
 if (!($86)) {
  return;
 }
 $88 = ((($7)) + 4|0);
 $89 = HEAP32[$88>>2]|0;
 $90 = $89 & 1;
 $91 = ($90|0)==(0);
 if ($91) {
  return;
 }
 $92 = $89 & 2;
 $93 = ($92|0)==(0);
 if ($93) {
  $94 = HEAP32[(36544)>>2]|0;
  $95 = ($7|0)==($94|0);
  $96 = HEAP32[(36540)>>2]|0;
  if ($95) {
   $97 = HEAP32[(36532)>>2]|0;
   $98 = (($97) + ($$1347))|0;
   HEAP32[(36532)>>2] = $98;
   HEAP32[(36544)>>2] = $$1;
   $99 = $98 | 1;
   $100 = ((($$1)) + 4|0);
   HEAP32[$100>>2] = $99;
   $101 = ($$1|0)==($96|0);
   if (!($101)) {
    return;
   }
   HEAP32[(36540)>>2] = 0;
   HEAP32[(36528)>>2] = 0;
   return;
  }
  $102 = ($7|0)==($96|0);
  if ($102) {
   $103 = HEAP32[(36528)>>2]|0;
   $104 = (($103) + ($$1347))|0;
   HEAP32[(36528)>>2] = $104;
   HEAP32[(36540)>>2] = $87;
   $105 = $104 | 1;
   $106 = ((($$1)) + 4|0);
   HEAP32[$106>>2] = $105;
   $107 = (($87) + ($104)|0);
   HEAP32[$107>>2] = $104;
   return;
  }
  $108 = $89 & -8;
  $109 = (($108) + ($$1347))|0;
  $110 = $89 >>> 3;
  $111 = ($89>>>0)<(256);
  do {
   if ($111) {
    $112 = ((($7)) + 8|0);
    $113 = HEAP32[$112>>2]|0;
    $114 = ((($7)) + 12|0);
    $115 = HEAP32[$114>>2]|0;
    $116 = ($115|0)==($113|0);
    if ($116) {
     $117 = 1 << $110;
     $118 = $117 ^ -1;
     $119 = HEAP32[9130]|0;
     $120 = $119 & $118;
     HEAP32[9130] = $120;
     break;
    } else {
     $121 = ((($113)) + 12|0);
     HEAP32[$121>>2] = $115;
     $122 = ((($115)) + 8|0);
     HEAP32[$122>>2] = $113;
     break;
    }
   } else {
    $123 = ((($7)) + 24|0);
    $124 = HEAP32[$123>>2]|0;
    $125 = ((($7)) + 12|0);
    $126 = HEAP32[$125>>2]|0;
    $127 = ($126|0)==($7|0);
    do {
     if ($127) {
      $132 = ((($7)) + 16|0);
      $133 = ((($132)) + 4|0);
      $134 = HEAP32[$133>>2]|0;
      $135 = ($134|0)==(0|0);
      if ($135) {
       $136 = HEAP32[$132>>2]|0;
       $137 = ($136|0)==(0|0);
       if ($137) {
        $$3365 = 0;
        break;
       } else {
        $$1363 = $136;$$1367 = $132;
       }
      } else {
       $$1363 = $134;$$1367 = $133;
      }
      while(1) {
       $138 = ((($$1363)) + 20|0);
       $139 = HEAP32[$138>>2]|0;
       $140 = ($139|0)==(0|0);
       if (!($140)) {
        $$1363 = $139;$$1367 = $138;
        continue;
       }
       $141 = ((($$1363)) + 16|0);
       $142 = HEAP32[$141>>2]|0;
       $143 = ($142|0)==(0|0);
       if ($143) {
        break;
       } else {
        $$1363 = $142;$$1367 = $141;
       }
      }
      HEAP32[$$1367>>2] = 0;
      $$3365 = $$1363;
     } else {
      $128 = ((($7)) + 8|0);
      $129 = HEAP32[$128>>2]|0;
      $130 = ((($129)) + 12|0);
      HEAP32[$130>>2] = $126;
      $131 = ((($126)) + 8|0);
      HEAP32[$131>>2] = $129;
      $$3365 = $126;
     }
    } while(0);
    $144 = ($124|0)==(0|0);
    if (!($144)) {
     $145 = ((($7)) + 28|0);
     $146 = HEAP32[$145>>2]|0;
     $147 = (36824 + ($146<<2)|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = ($7|0)==($148|0);
     if ($149) {
      HEAP32[$147>>2] = $$3365;
      $cond375 = ($$3365|0)==(0|0);
      if ($cond375) {
       $150 = 1 << $146;
       $151 = $150 ^ -1;
       $152 = HEAP32[(36524)>>2]|0;
       $153 = $152 & $151;
       HEAP32[(36524)>>2] = $153;
       break;
      }
     } else {
      $154 = ((($124)) + 16|0);
      $155 = HEAP32[$154>>2]|0;
      $not$ = ($155|0)!=($7|0);
      $$sink5 = $not$&1;
      $156 = (((($124)) + 16|0) + ($$sink5<<2)|0);
      HEAP32[$156>>2] = $$3365;
      $157 = ($$3365|0)==(0|0);
      if ($157) {
       break;
      }
     }
     $158 = ((($$3365)) + 24|0);
     HEAP32[$158>>2] = $124;
     $159 = ((($7)) + 16|0);
     $160 = HEAP32[$159>>2]|0;
     $161 = ($160|0)==(0|0);
     if (!($161)) {
      $162 = ((($$3365)) + 16|0);
      HEAP32[$162>>2] = $160;
      $163 = ((($160)) + 24|0);
      HEAP32[$163>>2] = $$3365;
     }
     $164 = ((($159)) + 4|0);
     $165 = HEAP32[$164>>2]|0;
     $166 = ($165|0)==(0|0);
     if (!($166)) {
      $167 = ((($$3365)) + 20|0);
      HEAP32[$167>>2] = $165;
      $168 = ((($165)) + 24|0);
      HEAP32[$168>>2] = $$3365;
     }
    }
   }
  } while(0);
  $169 = $109 | 1;
  $170 = ((($$1)) + 4|0);
  HEAP32[$170>>2] = $169;
  $171 = (($87) + ($109)|0);
  HEAP32[$171>>2] = $109;
  $172 = HEAP32[(36540)>>2]|0;
  $173 = ($$1|0)==($172|0);
  if ($173) {
   HEAP32[(36528)>>2] = $109;
   return;
  } else {
   $$2 = $109;
  }
 } else {
  $174 = $89 & -2;
  HEAP32[$88>>2] = $174;
  $175 = $$1347 | 1;
  $176 = ((($$1)) + 4|0);
  HEAP32[$176>>2] = $175;
  $177 = (($87) + ($$1347)|0);
  HEAP32[$177>>2] = $$1347;
  $$2 = $$1347;
 }
 $178 = $$2 >>> 3;
 $179 = ($$2>>>0)<(256);
 if ($179) {
  $180 = $178 << 1;
  $181 = (36560 + ($180<<2)|0);
  $182 = HEAP32[9130]|0;
  $183 = 1 << $178;
  $184 = $182 & $183;
  $185 = ($184|0)==(0);
  if ($185) {
   $186 = $182 | $183;
   HEAP32[9130] = $186;
   $$pre = ((($181)) + 8|0);
   $$0368 = $181;$$pre$phiZ2D = $$pre;
  } else {
   $187 = ((($181)) + 8|0);
   $188 = HEAP32[$187>>2]|0;
   $$0368 = $188;$$pre$phiZ2D = $187;
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $189 = ((($$0368)) + 12|0);
  HEAP32[$189>>2] = $$1;
  $190 = ((($$1)) + 8|0);
  HEAP32[$190>>2] = $$0368;
  $191 = ((($$1)) + 12|0);
  HEAP32[$191>>2] = $181;
  return;
 }
 $192 = $$2 >>> 8;
 $193 = ($192|0)==(0);
 if ($193) {
  $$0361 = 0;
 } else {
  $194 = ($$2>>>0)>(16777215);
  if ($194) {
   $$0361 = 31;
  } else {
   $195 = (($192) + 1048320)|0;
   $196 = $195 >>> 16;
   $197 = $196 & 8;
   $198 = $192 << $197;
   $199 = (($198) + 520192)|0;
   $200 = $199 >>> 16;
   $201 = $200 & 4;
   $202 = $201 | $197;
   $203 = $198 << $201;
   $204 = (($203) + 245760)|0;
   $205 = $204 >>> 16;
   $206 = $205 & 2;
   $207 = $202 | $206;
   $208 = (14 - ($207))|0;
   $209 = $203 << $206;
   $210 = $209 >>> 15;
   $211 = (($208) + ($210))|0;
   $212 = $211 << 1;
   $213 = (($211) + 7)|0;
   $214 = $$2 >>> $213;
   $215 = $214 & 1;
   $216 = $215 | $212;
   $$0361 = $216;
  }
 }
 $217 = (36824 + ($$0361<<2)|0);
 $218 = ((($$1)) + 28|0);
 HEAP32[$218>>2] = $$0361;
 $219 = ((($$1)) + 16|0);
 $220 = ((($$1)) + 20|0);
 HEAP32[$220>>2] = 0;
 HEAP32[$219>>2] = 0;
 $221 = HEAP32[(36524)>>2]|0;
 $222 = 1 << $$0361;
 $223 = $221 & $222;
 $224 = ($223|0)==(0);
 do {
  if ($224) {
   $225 = $221 | $222;
   HEAP32[(36524)>>2] = $225;
   HEAP32[$217>>2] = $$1;
   $226 = ((($$1)) + 24|0);
   HEAP32[$226>>2] = $217;
   $227 = ((($$1)) + 12|0);
   HEAP32[$227>>2] = $$1;
   $228 = ((($$1)) + 8|0);
   HEAP32[$228>>2] = $$1;
  } else {
   $229 = HEAP32[$217>>2]|0;
   $230 = ($$0361|0)==(31);
   $231 = $$0361 >>> 1;
   $232 = (25 - ($231))|0;
   $233 = $230 ? 0 : $232;
   $234 = $$2 << $233;
   $$0348 = $234;$$0349 = $229;
   while(1) {
    $235 = ((($$0349)) + 4|0);
    $236 = HEAP32[$235>>2]|0;
    $237 = $236 & -8;
    $238 = ($237|0)==($$2|0);
    if ($238) {
     label = 73;
     break;
    }
    $239 = $$0348 >>> 31;
    $240 = (((($$0349)) + 16|0) + ($239<<2)|0);
    $241 = $$0348 << 1;
    $242 = HEAP32[$240>>2]|0;
    $243 = ($242|0)==(0|0);
    if ($243) {
     label = 72;
     break;
    } else {
     $$0348 = $241;$$0349 = $242;
    }
   }
   if ((label|0) == 72) {
    HEAP32[$240>>2] = $$1;
    $244 = ((($$1)) + 24|0);
    HEAP32[$244>>2] = $$0349;
    $245 = ((($$1)) + 12|0);
    HEAP32[$245>>2] = $$1;
    $246 = ((($$1)) + 8|0);
    HEAP32[$246>>2] = $$1;
    break;
   }
   else if ((label|0) == 73) {
    $247 = ((($$0349)) + 8|0);
    $248 = HEAP32[$247>>2]|0;
    $249 = ((($248)) + 12|0);
    HEAP32[$249>>2] = $$1;
    HEAP32[$247>>2] = $$1;
    $250 = ((($$1)) + 8|0);
    HEAP32[$250>>2] = $248;
    $251 = ((($$1)) + 12|0);
    HEAP32[$251>>2] = $$0349;
    $252 = ((($$1)) + 24|0);
    HEAP32[$252>>2] = 0;
    break;
   }
  }
 } while(0);
 $253 = HEAP32[(36552)>>2]|0;
 $254 = (($253) + -1)|0;
 HEAP32[(36552)>>2] = $254;
 $255 = ($254|0)==(0);
 if ($255) {
  $$0195$in$i = (36976);
 } else {
  return;
 }
 while(1) {
  $$0195$i = HEAP32[$$0195$in$i>>2]|0;
  $256 = ($$0195$i|0)==(0|0);
  $257 = ((($$0195$i)) + 8|0);
  if ($256) {
   break;
  } else {
   $$0195$in$i = $257;
  }
 }
 HEAP32[(36552)>>2] = -1;
 return;
}
function _emscripten_get_global_libc() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (37016|0);
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_dummy_570($2)|0);
 HEAP32[$vararg_buffer>>2] = $3;
 $4 = (___syscall6(6,($vararg_buffer|0))|0);
 $5 = (___syscall_ret($4)|0);
 STACKTOP = sp;return ($5|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0;
 var $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 32|0;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = $3;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = 2;
 $16 = (___syscall146(146,($vararg_buffer|0))|0);
 $17 = (___syscall_ret($16)|0);
 $18 = ($12|0)==($17|0);
 L1: do {
  if ($18) {
   label = 3;
  } else {
   $$04756 = 2;$$04855 = $12;$$04954 = $3;$26 = $17;
   while(1) {
    $25 = ($26|0)<(0);
    if ($25) {
     break;
    }
    $34 = (($$04855) - ($26))|0;
    $35 = ((($$04954)) + 4|0);
    $36 = HEAP32[$35>>2]|0;
    $37 = ($26>>>0)>($36>>>0);
    $38 = ((($$04954)) + 8|0);
    $$150 = $37 ? $38 : $$04954;
    $39 = $37 << 31 >> 31;
    $$1 = (($39) + ($$04756))|0;
    $40 = $37 ? $36 : 0;
    $$0 = (($26) - ($40))|0;
    $41 = HEAP32[$$150>>2]|0;
    $42 = (($41) + ($$0)|0);
    HEAP32[$$150>>2] = $42;
    $43 = ((($$150)) + 4|0);
    $44 = HEAP32[$43>>2]|0;
    $45 = (($44) - ($$0))|0;
    HEAP32[$43>>2] = $45;
    $46 = HEAP32[$13>>2]|0;
    $47 = $$150;
    HEAP32[$vararg_buffer3>>2] = $46;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $47;
    $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
    HEAP32[$vararg_ptr7>>2] = $$1;
    $48 = (___syscall146(146,($vararg_buffer3|0))|0);
    $49 = (___syscall_ret($48)|0);
    $50 = ($34|0)==($49|0);
    if ($50) {
     label = 3;
     break L1;
    } else {
     $$04756 = $$1;$$04855 = $34;$$04954 = $$150;$26 = $49;
    }
   }
   $27 = ((($0)) + 16|0);
   HEAP32[$27>>2] = 0;
   HEAP32[$4>>2] = 0;
   HEAP32[$7>>2] = 0;
   $28 = HEAP32[$0>>2]|0;
   $29 = $28 | 32;
   HEAP32[$0>>2] = $29;
   $30 = ($$04756|0)==(2);
   if ($30) {
    $$051 = 0;
   } else {
    $31 = ((($$04954)) + 4|0);
    $32 = HEAP32[$31>>2]|0;
    $33 = (($2) - ($32))|0;
    $$051 = $33;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $19 = ((($0)) + 44|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ((($0)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($0)) + 16|0);
  HEAP32[$24>>2] = $23;
  HEAP32[$4>>2] = $20;
  HEAP32[$7>>2] = $20;
  $$051 = $2;
 }
 STACKTOP = sp;return ($$051|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $3;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $6;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $7 = (___syscall140(140,($vararg_buffer|0))|0);
 $8 = (___syscall_ret($7)|0);
 $9 = ($8|0)<(0);
 if ($9) {
  HEAP32[$3>>2] = -1;
  $10 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $10 = $$pre;
 }
 STACKTOP = sp;return ($10|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (___pthread_self_103()|0);
 $1 = ((($0)) + 64|0);
 return ($1|0);
}
function ___pthread_self_103() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function _pthread_self() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (31172|0);
}
function _dummy_570($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 16|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 12;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $3;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21523;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $10;
  $11 = (___syscall54(54,($vararg_buffer|0))|0);
  $12 = ($11|0)==(0);
  if (!($12)) {
   $13 = ((($0)) + 75|0);
   HEAP8[$13>>0] = -1;
  }
 }
 $14 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($14|0);
}
function _strcmp($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$011 = 0, $$0710 = 0, $$lcssa = 0, $$lcssa8 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[$0>>0]|0;
 $3 = HEAP8[$1>>0]|0;
 $4 = ($2<<24>>24)!=($3<<24>>24);
 $5 = ($2<<24>>24)==(0);
 $or$cond9 = $5 | $4;
 if ($or$cond9) {
  $$lcssa = $3;$$lcssa8 = $2;
 } else {
  $$011 = $1;$$0710 = $0;
  while(1) {
   $6 = ((($$0710)) + 1|0);
   $7 = ((($$011)) + 1|0);
   $8 = HEAP8[$6>>0]|0;
   $9 = HEAP8[$7>>0]|0;
   $10 = ($8<<24>>24)!=($9<<24>>24);
   $11 = ($8<<24>>24)==(0);
   $or$cond = $11 | $10;
   if ($or$cond) {
    $$lcssa = $9;$$lcssa8 = $8;
    break;
   } else {
    $$011 = $7;$$0710 = $6;
   }
  }
 }
 $12 = $$lcssa8&255;
 $13 = $$lcssa&255;
 $14 = (($12) - ($13))|0;
 return ($14|0);
}
function _vfprintf($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$0 = 0, $$1 = 0, $$1$ = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $vacopy_currentptr = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(224|0);
 $3 = sp + 120|0;
 $4 = sp + 80|0;
 $5 = sp;
 $6 = sp + 136|0;
 dest=$4; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 $vacopy_currentptr = HEAP32[$2>>2]|0;
 HEAP32[$3>>2] = $vacopy_currentptr;
 $7 = (_printf_core(0,$1,$3,$5,$4)|0);
 $8 = ($7|0)<(0);
 if ($8) {
  $$0 = -1;
 } else {
  $9 = ((($0)) + 76|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = ($10|0)>(-1);
  if ($11) {
   $12 = (___lockfile($0)|0);
   $40 = $12;
  } else {
   $40 = 0;
  }
  $13 = HEAP32[$0>>2]|0;
  $14 = $13 & 32;
  $15 = ((($0)) + 74|0);
  $16 = HEAP8[$15>>0]|0;
  $17 = ($16<<24>>24)<(1);
  if ($17) {
   $18 = $13 & -33;
   HEAP32[$0>>2] = $18;
  }
  $19 = ((($0)) + 48|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ($20|0)==(0);
  if ($21) {
   $23 = ((($0)) + 44|0);
   $24 = HEAP32[$23>>2]|0;
   HEAP32[$23>>2] = $6;
   $25 = ((($0)) + 28|0);
   HEAP32[$25>>2] = $6;
   $26 = ((($0)) + 20|0);
   HEAP32[$26>>2] = $6;
   HEAP32[$19>>2] = 80;
   $27 = ((($6)) + 80|0);
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = $27;
   $29 = (_printf_core($0,$1,$3,$5,$4)|0);
   $30 = ($24|0)==(0|0);
   if ($30) {
    $$1 = $29;
   } else {
    $31 = ((($0)) + 36|0);
    $32 = HEAP32[$31>>2]|0;
    (FUNCTION_TABLE_iiii[$32 & 127]($0,0,0)|0);
    $33 = HEAP32[$26>>2]|0;
    $34 = ($33|0)==(0|0);
    $$ = $34 ? -1 : $29;
    HEAP32[$23>>2] = $24;
    HEAP32[$19>>2] = 0;
    HEAP32[$28>>2] = 0;
    HEAP32[$25>>2] = 0;
    HEAP32[$26>>2] = 0;
    $$1 = $$;
   }
  } else {
   $22 = (_printf_core($0,$1,$3,$5,$4)|0);
   $$1 = $22;
  }
  $35 = HEAP32[$0>>2]|0;
  $36 = $35 & 32;
  $37 = ($36|0)==(0);
  $$1$ = $37 ? $$1 : -1;
  $38 = $35 | $14;
  HEAP32[$0>>2] = $38;
  $39 = ($40|0)==(0);
  if (!($39)) {
   ___unlockfile($0);
  }
  $$0 = $$1$;
 }
 STACKTOP = sp;return ($$0|0);
}
function _printf_core($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$ = 0, $$$ = 0, $$$0259 = 0, $$$0262 = 0, $$$0269 = 0, $$$4266 = 0, $$$5 = 0, $$0 = 0, $$0228 = 0, $$0228$ = 0, $$0229322 = 0, $$0232 = 0, $$0235 = 0, $$0237 = 0, $$0240$lcssa = 0, $$0240$lcssa357 = 0, $$0240321 = 0, $$0243 = 0, $$0247 = 0, $$0249$lcssa = 0;
 var $$0249306 = 0, $$0252 = 0, $$0253 = 0, $$0254 = 0, $$0254$$0254$ = 0, $$0259 = 0, $$0262$lcssa = 0, $$0262311 = 0, $$0269 = 0, $$0269$phi = 0, $$1 = 0, $$1230333 = 0, $$1233 = 0, $$1236 = 0, $$1238 = 0, $$1241332 = 0, $$1244320 = 0, $$1248 = 0, $$1250 = 0, $$1255 = 0;
 var $$1260 = 0, $$1263 = 0, $$1263$ = 0, $$1270 = 0, $$2 = 0, $$2234 = 0, $$2239 = 0, $$2242305 = 0, $$2245 = 0, $$2251 = 0, $$2256 = 0, $$2256$ = 0, $$2256$$$2256 = 0, $$2261 = 0, $$2271 = 0, $$284$ = 0, $$289 = 0, $$290 = 0, $$3257 = 0, $$3265 = 0;
 var $$3272 = 0, $$3303 = 0, $$377 = 0, $$4258355 = 0, $$4266 = 0, $$5 = 0, $$6268 = 0, $$lcssa295 = 0, $$pre = 0, $$pre346 = 0, $$pre347 = 0, $$pre347$pre = 0, $$pre349 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0;
 var $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0;
 var $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0;
 var $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0;
 var $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0;
 var $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0;
 var $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0;
 var $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0;
 var $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0;
 var $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0;
 var $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0;
 var $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0;
 var $306 = 0.0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0;
 var $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0;
 var $arglist_current = 0, $arglist_current2 = 0, $arglist_next = 0, $arglist_next3 = 0, $expanded = 0, $expanded10 = 0, $expanded11 = 0, $expanded13 = 0, $expanded14 = 0, $expanded15 = 0, $expanded4 = 0, $expanded6 = 0, $expanded7 = 0, $expanded8 = 0, $isdigit = 0, $isdigit275 = 0, $isdigit277 = 0, $isdigittmp = 0, $isdigittmp$ = 0, $isdigittmp274 = 0;
 var $isdigittmp276 = 0, $narrow = 0, $or$cond = 0, $or$cond281 = 0, $or$cond283 = 0, $or$cond286 = 0, $storemerge = 0, $storemerge273310 = 0, $storemerge278 = 0, $trunc = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $5 = sp + 16|0;
 $6 = sp;
 $7 = sp + 24|0;
 $8 = sp + 8|0;
 $9 = sp + 20|0;
 HEAP32[$5>>2] = $1;
 $10 = ($0|0)!=(0|0);
 $11 = ((($7)) + 40|0);
 $12 = $11;
 $13 = ((($7)) + 39|0);
 $14 = ((($8)) + 4|0);
 $$0243 = 0;$$0247 = 0;$$0269 = 0;$21 = $1;
 L1: while(1) {
  $15 = ($$0247|0)>(-1);
  do {
   if ($15) {
    $16 = (2147483647 - ($$0247))|0;
    $17 = ($$0243|0)>($16|0);
    if ($17) {
     $18 = (___errno_location()|0);
     HEAP32[$18>>2] = 75;
     $$1248 = -1;
     break;
    } else {
     $19 = (($$0243) + ($$0247))|0;
     $$1248 = $19;
     break;
    }
   } else {
    $$1248 = $$0247;
   }
  } while(0);
  $20 = HEAP8[$21>>0]|0;
  $22 = ($20<<24>>24)==(0);
  if ($22) {
   label = 87;
   break;
  } else {
   $23 = $20;$25 = $21;
  }
  L9: while(1) {
   switch ($23<<24>>24) {
   case 37:  {
    $$0249306 = $25;$27 = $25;
    label = 9;
    break L9;
    break;
   }
   case 0:  {
    $$0249$lcssa = $25;$39 = $25;
    break L9;
    break;
   }
   default: {
   }
   }
   $24 = ((($25)) + 1|0);
   HEAP32[$5>>2] = $24;
   $$pre = HEAP8[$24>>0]|0;
   $23 = $$pre;$25 = $24;
  }
  L12: do {
   if ((label|0) == 9) {
    while(1) {
     label = 0;
     $26 = ((($27)) + 1|0);
     $28 = HEAP8[$26>>0]|0;
     $29 = ($28<<24>>24)==(37);
     if (!($29)) {
      $$0249$lcssa = $$0249306;$39 = $27;
      break L12;
     }
     $30 = ((($$0249306)) + 1|0);
     $31 = ((($27)) + 2|0);
     HEAP32[$5>>2] = $31;
     $32 = HEAP8[$31>>0]|0;
     $33 = ($32<<24>>24)==(37);
     if ($33) {
      $$0249306 = $30;$27 = $31;
      label = 9;
     } else {
      $$0249$lcssa = $30;$39 = $31;
      break;
     }
    }
   }
  } while(0);
  $34 = $$0249$lcssa;
  $35 = $21;
  $36 = (($34) - ($35))|0;
  if ($10) {
   _out($0,$21,$36);
  }
  $37 = ($36|0)==(0);
  if (!($37)) {
   $$0269$phi = $$0269;$$0243 = $36;$$0247 = $$1248;$21 = $39;$$0269 = $$0269$phi;
   continue;
  }
  $38 = ((($39)) + 1|0);
  $40 = HEAP8[$38>>0]|0;
  $41 = $40 << 24 >> 24;
  $isdigittmp = (($41) + -48)|0;
  $isdigit = ($isdigittmp>>>0)<(10);
  if ($isdigit) {
   $42 = ((($39)) + 2|0);
   $43 = HEAP8[$42>>0]|0;
   $44 = ($43<<24>>24)==(36);
   $45 = ((($39)) + 3|0);
   $$377 = $44 ? $45 : $38;
   $$$0269 = $44 ? 1 : $$0269;
   $isdigittmp$ = $44 ? $isdigittmp : -1;
   $$0253 = $isdigittmp$;$$1270 = $$$0269;$storemerge = $$377;
  } else {
   $$0253 = -1;$$1270 = $$0269;$storemerge = $38;
  }
  HEAP32[$5>>2] = $storemerge;
  $46 = HEAP8[$storemerge>>0]|0;
  $47 = $46 << 24 >> 24;
  $48 = (($47) + -32)|0;
  $49 = ($48>>>0)<(32);
  L24: do {
   if ($49) {
    $$0262311 = 0;$329 = $46;$51 = $48;$storemerge273310 = $storemerge;
    while(1) {
     $50 = 1 << $51;
     $52 = $50 & 75913;
     $53 = ($52|0)==(0);
     if ($53) {
      $$0262$lcssa = $$0262311;$$lcssa295 = $329;$62 = $storemerge273310;
      break L24;
     }
     $54 = $50 | $$0262311;
     $55 = ((($storemerge273310)) + 1|0);
     HEAP32[$5>>2] = $55;
     $56 = HEAP8[$55>>0]|0;
     $57 = $56 << 24 >> 24;
     $58 = (($57) + -32)|0;
     $59 = ($58>>>0)<(32);
     if ($59) {
      $$0262311 = $54;$329 = $56;$51 = $58;$storemerge273310 = $55;
     } else {
      $$0262$lcssa = $54;$$lcssa295 = $56;$62 = $55;
      break;
     }
    }
   } else {
    $$0262$lcssa = 0;$$lcssa295 = $46;$62 = $storemerge;
   }
  } while(0);
  $60 = ($$lcssa295<<24>>24)==(42);
  if ($60) {
   $61 = ((($62)) + 1|0);
   $63 = HEAP8[$61>>0]|0;
   $64 = $63 << 24 >> 24;
   $isdigittmp276 = (($64) + -48)|0;
   $isdigit277 = ($isdigittmp276>>>0)<(10);
   if ($isdigit277) {
    $65 = ((($62)) + 2|0);
    $66 = HEAP8[$65>>0]|0;
    $67 = ($66<<24>>24)==(36);
    if ($67) {
     $68 = (($4) + ($isdigittmp276<<2)|0);
     HEAP32[$68>>2] = 10;
     $69 = HEAP8[$61>>0]|0;
     $70 = $69 << 24 >> 24;
     $71 = (($70) + -48)|0;
     $72 = (($3) + ($71<<3)|0);
     $73 = $72;
     $74 = $73;
     $75 = HEAP32[$74>>2]|0;
     $76 = (($73) + 4)|0;
     $77 = $76;
     $78 = HEAP32[$77>>2]|0;
     $79 = ((($62)) + 3|0);
     $$0259 = $75;$$2271 = 1;$storemerge278 = $79;
    } else {
     label = 23;
    }
   } else {
    label = 23;
   }
   if ((label|0) == 23) {
    label = 0;
    $80 = ($$1270|0)==(0);
    if (!($80)) {
     $$0 = -1;
     break;
    }
    if ($10) {
     $arglist_current = HEAP32[$2>>2]|0;
     $81 = $arglist_current;
     $82 = ((0) + 4|0);
     $expanded4 = $82;
     $expanded = (($expanded4) - 1)|0;
     $83 = (($81) + ($expanded))|0;
     $84 = ((0) + 4|0);
     $expanded8 = $84;
     $expanded7 = (($expanded8) - 1)|0;
     $expanded6 = $expanded7 ^ -1;
     $85 = $83 & $expanded6;
     $86 = $85;
     $87 = HEAP32[$86>>2]|0;
     $arglist_next = ((($86)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     $$0259 = $87;$$2271 = 0;$storemerge278 = $61;
    } else {
     $$0259 = 0;$$2271 = 0;$storemerge278 = $61;
    }
   }
   HEAP32[$5>>2] = $storemerge278;
   $88 = ($$0259|0)<(0);
   $89 = $$0262$lcssa | 8192;
   $90 = (0 - ($$0259))|0;
   $$$0262 = $88 ? $89 : $$0262$lcssa;
   $$$0259 = $88 ? $90 : $$0259;
   $$1260 = $$$0259;$$1263 = $$$0262;$$3272 = $$2271;$94 = $storemerge278;
  } else {
   $91 = (_getint($5)|0);
   $92 = ($91|0)<(0);
   if ($92) {
    $$0 = -1;
    break;
   }
   $$pre346 = HEAP32[$5>>2]|0;
   $$1260 = $91;$$1263 = $$0262$lcssa;$$3272 = $$1270;$94 = $$pre346;
  }
  $93 = HEAP8[$94>>0]|0;
  $95 = ($93<<24>>24)==(46);
  do {
   if ($95) {
    $96 = ((($94)) + 1|0);
    $97 = HEAP8[$96>>0]|0;
    $98 = ($97<<24>>24)==(42);
    if (!($98)) {
     $125 = ((($94)) + 1|0);
     HEAP32[$5>>2] = $125;
     $126 = (_getint($5)|0);
     $$pre347$pre = HEAP32[$5>>2]|0;
     $$0254 = $126;$$pre347 = $$pre347$pre;
     break;
    }
    $99 = ((($94)) + 2|0);
    $100 = HEAP8[$99>>0]|0;
    $101 = $100 << 24 >> 24;
    $isdigittmp274 = (($101) + -48)|0;
    $isdigit275 = ($isdigittmp274>>>0)<(10);
    if ($isdigit275) {
     $102 = ((($94)) + 3|0);
     $103 = HEAP8[$102>>0]|0;
     $104 = ($103<<24>>24)==(36);
     if ($104) {
      $105 = (($4) + ($isdigittmp274<<2)|0);
      HEAP32[$105>>2] = 10;
      $106 = HEAP8[$99>>0]|0;
      $107 = $106 << 24 >> 24;
      $108 = (($107) + -48)|0;
      $109 = (($3) + ($108<<3)|0);
      $110 = $109;
      $111 = $110;
      $112 = HEAP32[$111>>2]|0;
      $113 = (($110) + 4)|0;
      $114 = $113;
      $115 = HEAP32[$114>>2]|0;
      $116 = ((($94)) + 4|0);
      HEAP32[$5>>2] = $116;
      $$0254 = $112;$$pre347 = $116;
      break;
     }
    }
    $117 = ($$3272|0)==(0);
    if (!($117)) {
     $$0 = -1;
     break L1;
    }
    if ($10) {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $118 = $arglist_current2;
     $119 = ((0) + 4|0);
     $expanded11 = $119;
     $expanded10 = (($expanded11) - 1)|0;
     $120 = (($118) + ($expanded10))|0;
     $121 = ((0) + 4|0);
     $expanded15 = $121;
     $expanded14 = (($expanded15) - 1)|0;
     $expanded13 = $expanded14 ^ -1;
     $122 = $120 & $expanded13;
     $123 = $122;
     $124 = HEAP32[$123>>2]|0;
     $arglist_next3 = ((($123)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $330 = $124;
    } else {
     $330 = 0;
    }
    HEAP32[$5>>2] = $99;
    $$0254 = $330;$$pre347 = $99;
   } else {
    $$0254 = -1;$$pre347 = $94;
   }
  } while(0);
  $$0252 = 0;$128 = $$pre347;
  while(1) {
   $127 = HEAP8[$128>>0]|0;
   $129 = $127 << 24 >> 24;
   $130 = (($129) + -65)|0;
   $131 = ($130>>>0)>(57);
   if ($131) {
    $$0 = -1;
    break L1;
   }
   $132 = ((($128)) + 1|0);
   HEAP32[$5>>2] = $132;
   $133 = HEAP8[$128>>0]|0;
   $134 = $133 << 24 >> 24;
   $135 = (($134) + -65)|0;
   $136 = ((31807 + (($$0252*58)|0)|0) + ($135)|0);
   $137 = HEAP8[$136>>0]|0;
   $138 = $137&255;
   $139 = (($138) + -1)|0;
   $140 = ($139>>>0)<(8);
   if ($140) {
    $$0252 = $138;$128 = $132;
   } else {
    break;
   }
  }
  $141 = ($137<<24>>24)==(0);
  if ($141) {
   $$0 = -1;
   break;
  }
  $142 = ($137<<24>>24)==(19);
  $143 = ($$0253|0)>(-1);
  do {
   if ($142) {
    if ($143) {
     $$0 = -1;
     break L1;
    } else {
     label = 49;
    }
   } else {
    if ($143) {
     $144 = (($4) + ($$0253<<2)|0);
     HEAP32[$144>>2] = $138;
     $145 = (($3) + ($$0253<<3)|0);
     $146 = $145;
     $147 = $146;
     $148 = HEAP32[$147>>2]|0;
     $149 = (($146) + 4)|0;
     $150 = $149;
     $151 = HEAP32[$150>>2]|0;
     $152 = $6;
     $153 = $152;
     HEAP32[$153>>2] = $148;
     $154 = (($152) + 4)|0;
     $155 = $154;
     HEAP32[$155>>2] = $151;
     label = 49;
     break;
    }
    if (!($10)) {
     $$0 = 0;
     break L1;
    }
    _pop_arg($6,$138,$2);
   }
  } while(0);
  if ((label|0) == 49) {
   label = 0;
   if (!($10)) {
    $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
    continue;
   }
  }
  $156 = HEAP8[$128>>0]|0;
  $157 = $156 << 24 >> 24;
  $158 = ($$0252|0)!=(0);
  $159 = $157 & 15;
  $160 = ($159|0)==(3);
  $or$cond281 = $158 & $160;
  $161 = $157 & -33;
  $$0235 = $or$cond281 ? $161 : $157;
  $162 = $$1263 & 8192;
  $163 = ($162|0)==(0);
  $164 = $$1263 & -65537;
  $$1263$ = $163 ? $$1263 : $164;
  L71: do {
   switch ($$0235|0) {
   case 110:  {
    $trunc = $$0252&255;
    switch ($trunc<<24>>24) {
    case 0:  {
     $171 = HEAP32[$6>>2]|0;
     HEAP32[$171>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 1:  {
     $172 = HEAP32[$6>>2]|0;
     HEAP32[$172>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 2:  {
     $173 = ($$1248|0)<(0);
     $174 = $173 << 31 >> 31;
     $175 = HEAP32[$6>>2]|0;
     $176 = $175;
     $177 = $176;
     HEAP32[$177>>2] = $$1248;
     $178 = (($176) + 4)|0;
     $179 = $178;
     HEAP32[$179>>2] = $174;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 3:  {
     $180 = $$1248&65535;
     $181 = HEAP32[$6>>2]|0;
     HEAP16[$181>>1] = $180;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 4:  {
     $182 = $$1248&255;
     $183 = HEAP32[$6>>2]|0;
     HEAP8[$183>>0] = $182;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 6:  {
     $184 = HEAP32[$6>>2]|0;
     HEAP32[$184>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 7:  {
     $185 = ($$1248|0)<(0);
     $186 = $185 << 31 >> 31;
     $187 = HEAP32[$6>>2]|0;
     $188 = $187;
     $189 = $188;
     HEAP32[$189>>2] = $$1248;
     $190 = (($188) + 4)|0;
     $191 = $190;
     HEAP32[$191>>2] = $186;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    default: {
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
    }
    }
    break;
   }
   case 112:  {
    $192 = ($$0254>>>0)>(8);
    $193 = $192 ? $$0254 : 8;
    $194 = $$1263$ | 8;
    $$1236 = 120;$$1255 = $193;$$3265 = $194;
    label = 61;
    break;
   }
   case 88: case 120:  {
    $$1236 = $$0235;$$1255 = $$0254;$$3265 = $$1263$;
    label = 61;
    break;
   }
   case 111:  {
    $210 = $6;
    $211 = $210;
    $212 = HEAP32[$211>>2]|0;
    $213 = (($210) + 4)|0;
    $214 = $213;
    $215 = HEAP32[$214>>2]|0;
    $216 = (_fmt_o($212,$215,$11)|0);
    $217 = $$1263$ & 8;
    $218 = ($217|0)==(0);
    $219 = $216;
    $220 = (($12) - ($219))|0;
    $221 = ($$0254|0)>($220|0);
    $222 = (($220) + 1)|0;
    $223 = $218 | $221;
    $$0254$$0254$ = $223 ? $$0254 : $222;
    $$0228 = $216;$$1233 = 0;$$1238 = 32271;$$2256 = $$0254$$0254$;$$4266 = $$1263$;$248 = $212;$250 = $215;
    label = 67;
    break;
   }
   case 105: case 100:  {
    $224 = $6;
    $225 = $224;
    $226 = HEAP32[$225>>2]|0;
    $227 = (($224) + 4)|0;
    $228 = $227;
    $229 = HEAP32[$228>>2]|0;
    $230 = ($229|0)<(0);
    if ($230) {
     $231 = (_i64Subtract(0,0,($226|0),($229|0))|0);
     $232 = tempRet0;
     $233 = $6;
     $234 = $233;
     HEAP32[$234>>2] = $231;
     $235 = (($233) + 4)|0;
     $236 = $235;
     HEAP32[$236>>2] = $232;
     $$0232 = 1;$$0237 = 32271;$242 = $231;$243 = $232;
     label = 66;
     break L71;
    } else {
     $237 = $$1263$ & 2048;
     $238 = ($237|0)==(0);
     $239 = $$1263$ & 1;
     $240 = ($239|0)==(0);
     $$ = $240 ? 32271 : (32273);
     $$$ = $238 ? $$ : (32272);
     $241 = $$1263$ & 2049;
     $narrow = ($241|0)!=(0);
     $$284$ = $narrow&1;
     $$0232 = $$284$;$$0237 = $$$;$242 = $226;$243 = $229;
     label = 66;
     break L71;
    }
    break;
   }
   case 117:  {
    $165 = $6;
    $166 = $165;
    $167 = HEAP32[$166>>2]|0;
    $168 = (($165) + 4)|0;
    $169 = $168;
    $170 = HEAP32[$169>>2]|0;
    $$0232 = 0;$$0237 = 32271;$242 = $167;$243 = $170;
    label = 66;
    break;
   }
   case 99:  {
    $259 = $6;
    $260 = $259;
    $261 = HEAP32[$260>>2]|0;
    $262 = (($259) + 4)|0;
    $263 = $262;
    $264 = HEAP32[$263>>2]|0;
    $265 = $261&255;
    HEAP8[$13>>0] = $265;
    $$2 = $13;$$2234 = 0;$$2239 = 32271;$$2251 = $11;$$5 = 1;$$6268 = $164;
    break;
   }
   case 109:  {
    $266 = (___errno_location()|0);
    $267 = HEAP32[$266>>2]|0;
    $268 = (_strerror($267)|0);
    $$1 = $268;
    label = 71;
    break;
   }
   case 115:  {
    $269 = HEAP32[$6>>2]|0;
    $270 = ($269|0)!=(0|0);
    $271 = $270 ? $269 : 32281;
    $$1 = $271;
    label = 71;
    break;
   }
   case 67:  {
    $278 = $6;
    $279 = $278;
    $280 = HEAP32[$279>>2]|0;
    $281 = (($278) + 4)|0;
    $282 = $281;
    $283 = HEAP32[$282>>2]|0;
    HEAP32[$8>>2] = $280;
    HEAP32[$14>>2] = 0;
    HEAP32[$6>>2] = $8;
    $$4258355 = -1;$331 = $8;
    label = 75;
    break;
   }
   case 83:  {
    $$pre349 = HEAP32[$6>>2]|0;
    $284 = ($$0254|0)==(0);
    if ($284) {
     _pad_684($0,32,$$1260,0,$$1263$);
     $$0240$lcssa357 = 0;
     label = 84;
    } else {
     $$4258355 = $$0254;$331 = $$pre349;
     label = 75;
    }
    break;
   }
   case 65: case 71: case 70: case 69: case 97: case 103: case 102: case 101:  {
    $306 = +HEAPF64[$6>>3];
    $307 = (_fmt_fp($0,$306,$$1260,$$0254,$$1263$,$$0235)|0);
    $$0243 = $307;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
    continue L1;
    break;
   }
   default: {
    $$2 = $21;$$2234 = 0;$$2239 = 32271;$$2251 = $11;$$5 = $$0254;$$6268 = $$1263$;
   }
   }
  } while(0);
  L95: do {
   if ((label|0) == 61) {
    label = 0;
    $195 = $6;
    $196 = $195;
    $197 = HEAP32[$196>>2]|0;
    $198 = (($195) + 4)|0;
    $199 = $198;
    $200 = HEAP32[$199>>2]|0;
    $201 = $$1236 & 32;
    $202 = (_fmt_x($197,$200,$11,$201)|0);
    $203 = ($197|0)==(0);
    $204 = ($200|0)==(0);
    $205 = $203 & $204;
    $206 = $$3265 & 8;
    $207 = ($206|0)==(0);
    $or$cond283 = $207 | $205;
    $208 = $$1236 >> 4;
    $209 = (32271 + ($208)|0);
    $$289 = $or$cond283 ? 32271 : $209;
    $$290 = $or$cond283 ? 0 : 2;
    $$0228 = $202;$$1233 = $$290;$$1238 = $$289;$$2256 = $$1255;$$4266 = $$3265;$248 = $197;$250 = $200;
    label = 67;
   }
   else if ((label|0) == 66) {
    label = 0;
    $244 = (_fmt_u($242,$243,$11)|0);
    $$0228 = $244;$$1233 = $$0232;$$1238 = $$0237;$$2256 = $$0254;$$4266 = $$1263$;$248 = $242;$250 = $243;
    label = 67;
   }
   else if ((label|0) == 71) {
    label = 0;
    $272 = (_memchr($$1,0,$$0254)|0);
    $273 = ($272|0)==(0|0);
    $274 = $272;
    $275 = $$1;
    $276 = (($274) - ($275))|0;
    $277 = (($$1) + ($$0254)|0);
    $$3257 = $273 ? $$0254 : $276;
    $$1250 = $273 ? $277 : $272;
    $$2 = $$1;$$2234 = 0;$$2239 = 32271;$$2251 = $$1250;$$5 = $$3257;$$6268 = $164;
   }
   else if ((label|0) == 75) {
    label = 0;
    $$0229322 = $331;$$0240321 = 0;$$1244320 = 0;
    while(1) {
     $285 = HEAP32[$$0229322>>2]|0;
     $286 = ($285|0)==(0);
     if ($286) {
      $$0240$lcssa = $$0240321;$$2245 = $$1244320;
      break;
     }
     $287 = (_wctomb($9,$285)|0);
     $288 = ($287|0)<(0);
     $289 = (($$4258355) - ($$0240321))|0;
     $290 = ($287>>>0)>($289>>>0);
     $or$cond286 = $288 | $290;
     if ($or$cond286) {
      $$0240$lcssa = $$0240321;$$2245 = $287;
      break;
     }
     $291 = ((($$0229322)) + 4|0);
     $292 = (($287) + ($$0240321))|0;
     $293 = ($$4258355>>>0)>($292>>>0);
     if ($293) {
      $$0229322 = $291;$$0240321 = $292;$$1244320 = $287;
     } else {
      $$0240$lcssa = $292;$$2245 = $287;
      break;
     }
    }
    $294 = ($$2245|0)<(0);
    if ($294) {
     $$0 = -1;
     break L1;
    }
    _pad_684($0,32,$$1260,$$0240$lcssa,$$1263$);
    $295 = ($$0240$lcssa|0)==(0);
    if ($295) {
     $$0240$lcssa357 = 0;
     label = 84;
    } else {
     $$1230333 = $331;$$1241332 = 0;
     while(1) {
      $296 = HEAP32[$$1230333>>2]|0;
      $297 = ($296|0)==(0);
      if ($297) {
       $$0240$lcssa357 = $$0240$lcssa;
       label = 84;
       break L95;
      }
      $298 = (_wctomb($9,$296)|0);
      $299 = (($298) + ($$1241332))|0;
      $300 = ($299|0)>($$0240$lcssa|0);
      if ($300) {
       $$0240$lcssa357 = $$0240$lcssa;
       label = 84;
       break L95;
      }
      $301 = ((($$1230333)) + 4|0);
      _out($0,$9,$298);
      $302 = ($299>>>0)<($$0240$lcssa>>>0);
      if ($302) {
       $$1230333 = $301;$$1241332 = $299;
      } else {
       $$0240$lcssa357 = $$0240$lcssa;
       label = 84;
       break;
      }
     }
    }
   }
  } while(0);
  if ((label|0) == 67) {
   label = 0;
   $245 = ($$2256|0)>(-1);
   $246 = $$4266 & -65537;
   $$$4266 = $245 ? $246 : $$4266;
   $247 = ($248|0)!=(0);
   $249 = ($250|0)!=(0);
   $251 = $247 | $249;
   $252 = ($$2256|0)!=(0);
   $or$cond = $252 | $251;
   $253 = $$0228;
   $254 = (($12) - ($253))|0;
   $255 = $251 ^ 1;
   $256 = $255&1;
   $257 = (($256) + ($254))|0;
   $258 = ($$2256|0)>($257|0);
   $$2256$ = $258 ? $$2256 : $257;
   $$2256$$$2256 = $or$cond ? $$2256$ : $$2256;
   $$0228$ = $or$cond ? $$0228 : $11;
   $$2 = $$0228$;$$2234 = $$1233;$$2239 = $$1238;$$2251 = $11;$$5 = $$2256$$$2256;$$6268 = $$$4266;
  }
  else if ((label|0) == 84) {
   label = 0;
   $303 = $$1263$ ^ 8192;
   _pad_684($0,32,$$1260,$$0240$lcssa357,$303);
   $304 = ($$1260|0)>($$0240$lcssa357|0);
   $305 = $304 ? $$1260 : $$0240$lcssa357;
   $$0243 = $305;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
   continue;
  }
  $308 = $$2251;
  $309 = $$2;
  $310 = (($308) - ($309))|0;
  $311 = ($$5|0)<($310|0);
  $$$5 = $311 ? $310 : $$5;
  $312 = (($$$5) + ($$2234))|0;
  $313 = ($$1260|0)<($312|0);
  $$2261 = $313 ? $312 : $$1260;
  _pad_684($0,32,$$2261,$312,$$6268);
  _out($0,$$2239,$$2234);
  $314 = $$6268 ^ 65536;
  _pad_684($0,48,$$2261,$312,$314);
  _pad_684($0,48,$$$5,$310,0);
  _out($0,$$2,$310);
  $315 = $$6268 ^ 8192;
  _pad_684($0,32,$$2261,$312,$315);
  $$0243 = $$2261;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
 }
 L114: do {
  if ((label|0) == 87) {
   $316 = ($0|0)==(0|0);
   if ($316) {
    $317 = ($$0269|0)==(0);
    if ($317) {
     $$0 = 0;
    } else {
     $$2242305 = 1;
     while(1) {
      $318 = (($4) + ($$2242305<<2)|0);
      $319 = HEAP32[$318>>2]|0;
      $320 = ($319|0)==(0);
      if ($320) {
       $$3303 = $$2242305;
       break;
      }
      $321 = (($3) + ($$2242305<<3)|0);
      _pop_arg($321,$319,$2);
      $322 = (($$2242305) + 1)|0;
      $323 = ($322|0)<(10);
      if ($323) {
       $$2242305 = $322;
      } else {
       $$0 = 1;
       break L114;
      }
     }
     while(1) {
      $326 = (($4) + ($$3303<<2)|0);
      $327 = HEAP32[$326>>2]|0;
      $328 = ($327|0)==(0);
      $325 = (($$3303) + 1)|0;
      if (!($328)) {
       $$0 = -1;
       break L114;
      }
      $324 = ($325|0)<(10);
      if ($324) {
       $$3303 = $325;
      } else {
       $$0 = 1;
       break;
      }
     }
    }
   } else {
    $$0 = $$1248;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function _out($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = $3 & 32;
 $5 = ($4|0)==(0);
 if ($5) {
  (___fwritex($1,$2,$0)|0);
 }
 return;
}
function _getint($0) {
 $0 = $0|0;
 var $$0$lcssa = 0, $$06 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $isdigit = 0, $isdigit5 = 0, $isdigittmp = 0, $isdigittmp4 = 0, $isdigittmp7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $isdigittmp4 = (($3) + -48)|0;
 $isdigit5 = ($isdigittmp4>>>0)<(10);
 if ($isdigit5) {
  $$06 = 0;$7 = $1;$isdigittmp7 = $isdigittmp4;
  while(1) {
   $4 = ($$06*10)|0;
   $5 = (($isdigittmp7) + ($4))|0;
   $6 = ((($7)) + 1|0);
   HEAP32[$0>>2] = $6;
   $8 = HEAP8[$6>>0]|0;
   $9 = $8 << 24 >> 24;
   $isdigittmp = (($9) + -48)|0;
   $isdigit = ($isdigittmp>>>0)<(10);
   if ($isdigit) {
    $$06 = $5;$7 = $6;$isdigittmp7 = $isdigittmp;
   } else {
    $$0$lcssa = $5;
    break;
   }
  }
 } else {
  $$0$lcssa = 0;
 }
 return ($$0$lcssa|0);
}
function _pop_arg($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$mask = 0, $$mask31 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current11 = 0, $arglist_current14 = 0, $arglist_current17 = 0;
 var $arglist_current2 = 0, $arglist_current20 = 0, $arglist_current23 = 0, $arglist_current26 = 0, $arglist_current5 = 0, $arglist_current8 = 0, $arglist_next = 0, $arglist_next12 = 0, $arglist_next15 = 0, $arglist_next18 = 0, $arglist_next21 = 0, $arglist_next24 = 0, $arglist_next27 = 0, $arglist_next3 = 0, $arglist_next6 = 0, $arglist_next9 = 0, $expanded = 0, $expanded28 = 0, $expanded30 = 0, $expanded31 = 0;
 var $expanded32 = 0, $expanded34 = 0, $expanded35 = 0, $expanded37 = 0, $expanded38 = 0, $expanded39 = 0, $expanded41 = 0, $expanded42 = 0, $expanded44 = 0, $expanded45 = 0, $expanded46 = 0, $expanded48 = 0, $expanded49 = 0, $expanded51 = 0, $expanded52 = 0, $expanded53 = 0, $expanded55 = 0, $expanded56 = 0, $expanded58 = 0, $expanded59 = 0;
 var $expanded60 = 0, $expanded62 = 0, $expanded63 = 0, $expanded65 = 0, $expanded66 = 0, $expanded67 = 0, $expanded69 = 0, $expanded70 = 0, $expanded72 = 0, $expanded73 = 0, $expanded74 = 0, $expanded76 = 0, $expanded77 = 0, $expanded79 = 0, $expanded80 = 0, $expanded81 = 0, $expanded83 = 0, $expanded84 = 0, $expanded86 = 0, $expanded87 = 0;
 var $expanded88 = 0, $expanded90 = 0, $expanded91 = 0, $expanded93 = 0, $expanded94 = 0, $expanded95 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(20);
 L1: do {
  if (!($3)) {
   do {
    switch ($1|0) {
    case 9:  {
     $arglist_current = HEAP32[$2>>2]|0;
     $4 = $arglist_current;
     $5 = ((0) + 4|0);
     $expanded28 = $5;
     $expanded = (($expanded28) - 1)|0;
     $6 = (($4) + ($expanded))|0;
     $7 = ((0) + 4|0);
     $expanded32 = $7;
     $expanded31 = (($expanded32) - 1)|0;
     $expanded30 = $expanded31 ^ -1;
     $8 = $6 & $expanded30;
     $9 = $8;
     $10 = HEAP32[$9>>2]|0;
     $arglist_next = ((($9)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     HEAP32[$0>>2] = $10;
     break L1;
     break;
    }
    case 10:  {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $11 = $arglist_current2;
     $12 = ((0) + 4|0);
     $expanded35 = $12;
     $expanded34 = (($expanded35) - 1)|0;
     $13 = (($11) + ($expanded34))|0;
     $14 = ((0) + 4|0);
     $expanded39 = $14;
     $expanded38 = (($expanded39) - 1)|0;
     $expanded37 = $expanded38 ^ -1;
     $15 = $13 & $expanded37;
     $16 = $15;
     $17 = HEAP32[$16>>2]|0;
     $arglist_next3 = ((($16)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $18 = ($17|0)<(0);
     $19 = $18 << 31 >> 31;
     $20 = $0;
     $21 = $20;
     HEAP32[$21>>2] = $17;
     $22 = (($20) + 4)|0;
     $23 = $22;
     HEAP32[$23>>2] = $19;
     break L1;
     break;
    }
    case 11:  {
     $arglist_current5 = HEAP32[$2>>2]|0;
     $24 = $arglist_current5;
     $25 = ((0) + 4|0);
     $expanded42 = $25;
     $expanded41 = (($expanded42) - 1)|0;
     $26 = (($24) + ($expanded41))|0;
     $27 = ((0) + 4|0);
     $expanded46 = $27;
     $expanded45 = (($expanded46) - 1)|0;
     $expanded44 = $expanded45 ^ -1;
     $28 = $26 & $expanded44;
     $29 = $28;
     $30 = HEAP32[$29>>2]|0;
     $arglist_next6 = ((($29)) + 4|0);
     HEAP32[$2>>2] = $arglist_next6;
     $31 = $0;
     $32 = $31;
     HEAP32[$32>>2] = $30;
     $33 = (($31) + 4)|0;
     $34 = $33;
     HEAP32[$34>>2] = 0;
     break L1;
     break;
    }
    case 12:  {
     $arglist_current8 = HEAP32[$2>>2]|0;
     $35 = $arglist_current8;
     $36 = ((0) + 8|0);
     $expanded49 = $36;
     $expanded48 = (($expanded49) - 1)|0;
     $37 = (($35) + ($expanded48))|0;
     $38 = ((0) + 8|0);
     $expanded53 = $38;
     $expanded52 = (($expanded53) - 1)|0;
     $expanded51 = $expanded52 ^ -1;
     $39 = $37 & $expanded51;
     $40 = $39;
     $41 = $40;
     $42 = $41;
     $43 = HEAP32[$42>>2]|0;
     $44 = (($41) + 4)|0;
     $45 = $44;
     $46 = HEAP32[$45>>2]|0;
     $arglist_next9 = ((($40)) + 8|0);
     HEAP32[$2>>2] = $arglist_next9;
     $47 = $0;
     $48 = $47;
     HEAP32[$48>>2] = $43;
     $49 = (($47) + 4)|0;
     $50 = $49;
     HEAP32[$50>>2] = $46;
     break L1;
     break;
    }
    case 13:  {
     $arglist_current11 = HEAP32[$2>>2]|0;
     $51 = $arglist_current11;
     $52 = ((0) + 4|0);
     $expanded56 = $52;
     $expanded55 = (($expanded56) - 1)|0;
     $53 = (($51) + ($expanded55))|0;
     $54 = ((0) + 4|0);
     $expanded60 = $54;
     $expanded59 = (($expanded60) - 1)|0;
     $expanded58 = $expanded59 ^ -1;
     $55 = $53 & $expanded58;
     $56 = $55;
     $57 = HEAP32[$56>>2]|0;
     $arglist_next12 = ((($56)) + 4|0);
     HEAP32[$2>>2] = $arglist_next12;
     $58 = $57&65535;
     $59 = $58 << 16 >> 16;
     $60 = ($59|0)<(0);
     $61 = $60 << 31 >> 31;
     $62 = $0;
     $63 = $62;
     HEAP32[$63>>2] = $59;
     $64 = (($62) + 4)|0;
     $65 = $64;
     HEAP32[$65>>2] = $61;
     break L1;
     break;
    }
    case 14:  {
     $arglist_current14 = HEAP32[$2>>2]|0;
     $66 = $arglist_current14;
     $67 = ((0) + 4|0);
     $expanded63 = $67;
     $expanded62 = (($expanded63) - 1)|0;
     $68 = (($66) + ($expanded62))|0;
     $69 = ((0) + 4|0);
     $expanded67 = $69;
     $expanded66 = (($expanded67) - 1)|0;
     $expanded65 = $expanded66 ^ -1;
     $70 = $68 & $expanded65;
     $71 = $70;
     $72 = HEAP32[$71>>2]|0;
     $arglist_next15 = ((($71)) + 4|0);
     HEAP32[$2>>2] = $arglist_next15;
     $$mask31 = $72 & 65535;
     $73 = $0;
     $74 = $73;
     HEAP32[$74>>2] = $$mask31;
     $75 = (($73) + 4)|0;
     $76 = $75;
     HEAP32[$76>>2] = 0;
     break L1;
     break;
    }
    case 15:  {
     $arglist_current17 = HEAP32[$2>>2]|0;
     $77 = $arglist_current17;
     $78 = ((0) + 4|0);
     $expanded70 = $78;
     $expanded69 = (($expanded70) - 1)|0;
     $79 = (($77) + ($expanded69))|0;
     $80 = ((0) + 4|0);
     $expanded74 = $80;
     $expanded73 = (($expanded74) - 1)|0;
     $expanded72 = $expanded73 ^ -1;
     $81 = $79 & $expanded72;
     $82 = $81;
     $83 = HEAP32[$82>>2]|0;
     $arglist_next18 = ((($82)) + 4|0);
     HEAP32[$2>>2] = $arglist_next18;
     $84 = $83&255;
     $85 = $84 << 24 >> 24;
     $86 = ($85|0)<(0);
     $87 = $86 << 31 >> 31;
     $88 = $0;
     $89 = $88;
     HEAP32[$89>>2] = $85;
     $90 = (($88) + 4)|0;
     $91 = $90;
     HEAP32[$91>>2] = $87;
     break L1;
     break;
    }
    case 16:  {
     $arglist_current20 = HEAP32[$2>>2]|0;
     $92 = $arglist_current20;
     $93 = ((0) + 4|0);
     $expanded77 = $93;
     $expanded76 = (($expanded77) - 1)|0;
     $94 = (($92) + ($expanded76))|0;
     $95 = ((0) + 4|0);
     $expanded81 = $95;
     $expanded80 = (($expanded81) - 1)|0;
     $expanded79 = $expanded80 ^ -1;
     $96 = $94 & $expanded79;
     $97 = $96;
     $98 = HEAP32[$97>>2]|0;
     $arglist_next21 = ((($97)) + 4|0);
     HEAP32[$2>>2] = $arglist_next21;
     $$mask = $98 & 255;
     $99 = $0;
     $100 = $99;
     HEAP32[$100>>2] = $$mask;
     $101 = (($99) + 4)|0;
     $102 = $101;
     HEAP32[$102>>2] = 0;
     break L1;
     break;
    }
    case 17:  {
     $arglist_current23 = HEAP32[$2>>2]|0;
     $103 = $arglist_current23;
     $104 = ((0) + 8|0);
     $expanded84 = $104;
     $expanded83 = (($expanded84) - 1)|0;
     $105 = (($103) + ($expanded83))|0;
     $106 = ((0) + 8|0);
     $expanded88 = $106;
     $expanded87 = (($expanded88) - 1)|0;
     $expanded86 = $expanded87 ^ -1;
     $107 = $105 & $expanded86;
     $108 = $107;
     $109 = +HEAPF64[$108>>3];
     $arglist_next24 = ((($108)) + 8|0);
     HEAP32[$2>>2] = $arglist_next24;
     HEAPF64[$0>>3] = $109;
     break L1;
     break;
    }
    case 18:  {
     $arglist_current26 = HEAP32[$2>>2]|0;
     $110 = $arglist_current26;
     $111 = ((0) + 8|0);
     $expanded91 = $111;
     $expanded90 = (($expanded91) - 1)|0;
     $112 = (($110) + ($expanded90))|0;
     $113 = ((0) + 8|0);
     $expanded95 = $113;
     $expanded94 = (($expanded95) - 1)|0;
     $expanded93 = $expanded94 ^ -1;
     $114 = $112 & $expanded93;
     $115 = $114;
     $116 = +HEAPF64[$115>>3];
     $arglist_next27 = ((($115)) + 8|0);
     HEAP32[$2>>2] = $arglist_next27;
     HEAPF64[$0>>3] = $116;
     break L1;
     break;
    }
    default: {
     break L1;
    }
    }
   } while(0);
  }
 } while(0);
 return;
}
function _fmt_x($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$05$lcssa = 0, $$056 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $4 = ($0|0)==(0);
 $5 = ($1|0)==(0);
 $6 = $4 & $5;
 if ($6) {
  $$05$lcssa = $2;
 } else {
  $$056 = $2;$15 = $1;$8 = $0;
  while(1) {
   $7 = $8 & 15;
   $9 = (32323 + ($7)|0);
   $10 = HEAP8[$9>>0]|0;
   $11 = $10&255;
   $12 = $11 | $3;
   $13 = $12&255;
   $14 = ((($$056)) + -1|0);
   HEAP8[$14>>0] = $13;
   $16 = (_bitshift64Lshr(($8|0),($15|0),4)|0);
   $17 = tempRet0;
   $18 = ($16|0)==(0);
   $19 = ($17|0)==(0);
   $20 = $18 & $19;
   if ($20) {
    $$05$lcssa = $14;
    break;
   } else {
    $$056 = $14;$15 = $17;$8 = $16;
   }
  }
 }
 return ($$05$lcssa|0);
}
function _fmt_o($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$lcssa = 0, $$06 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==(0);
 $4 = ($1|0)==(0);
 $5 = $3 & $4;
 if ($5) {
  $$0$lcssa = $2;
 } else {
  $$06 = $2;$11 = $1;$7 = $0;
  while(1) {
   $6 = $7&255;
   $8 = $6 & 7;
   $9 = $8 | 48;
   $10 = ((($$06)) + -1|0);
   HEAP8[$10>>0] = $9;
   $12 = (_bitshift64Lshr(($7|0),($11|0),3)|0);
   $13 = tempRet0;
   $14 = ($12|0)==(0);
   $15 = ($13|0)==(0);
   $16 = $14 & $15;
   if ($16) {
    $$0$lcssa = $10;
    break;
   } else {
    $$06 = $10;$11 = $13;$7 = $12;
   }
  }
 }
 return ($$0$lcssa|0);
}
function _fmt_u($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$010$lcssa$off0 = 0, $$012 = 0, $$09$lcssa = 0, $$0914 = 0, $$1$lcssa = 0, $$111 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(0);
 $4 = ($0>>>0)>(4294967295);
 $5 = ($1|0)==(0);
 $6 = $5 & $4;
 $7 = $3 | $6;
 if ($7) {
  $$0914 = $2;$8 = $0;$9 = $1;
  while(1) {
   $10 = (___uremdi3(($8|0),($9|0),10,0)|0);
   $11 = tempRet0;
   $12 = $10&255;
   $13 = $12 | 48;
   $14 = ((($$0914)) + -1|0);
   HEAP8[$14>>0] = $13;
   $15 = (___udivdi3(($8|0),($9|0),10,0)|0);
   $16 = tempRet0;
   $17 = ($9>>>0)>(9);
   $18 = ($8>>>0)>(4294967295);
   $19 = ($9|0)==(9);
   $20 = $19 & $18;
   $21 = $17 | $20;
   if ($21) {
    $$0914 = $14;$8 = $15;$9 = $16;
   } else {
    break;
   }
  }
  $$010$lcssa$off0 = $15;$$09$lcssa = $14;
 } else {
  $$010$lcssa$off0 = $0;$$09$lcssa = $2;
 }
 $22 = ($$010$lcssa$off0|0)==(0);
 if ($22) {
  $$1$lcssa = $$09$lcssa;
 } else {
  $$012 = $$010$lcssa$off0;$$111 = $$09$lcssa;
  while(1) {
   $23 = (($$012>>>0) % 10)&-1;
   $24 = $23 | 48;
   $25 = $24&255;
   $26 = ((($$111)) + -1|0);
   HEAP8[$26>>0] = $25;
   $27 = (($$012>>>0) / 10)&-1;
   $28 = ($$012>>>0)<(10);
   if ($28) {
    $$1$lcssa = $26;
    break;
   } else {
    $$012 = $27;$$111 = $26;
   }
  }
 }
 return ($$1$lcssa|0);
}
function _strerror($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (___pthread_self_104()|0);
 $2 = ((($1)) + 188|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = (___strerror_l($0,$3)|0);
 return ($4|0);
}
function _memchr($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$lcssa = 0, $$035$lcssa = 0, $$035$lcssa65 = 0, $$03555 = 0, $$036$lcssa = 0, $$036$lcssa64 = 0, $$03654 = 0, $$046 = 0, $$137$lcssa = 0, $$13745 = 0, $$140 = 0, $$2 = 0, $$23839 = 0, $$3 = 0, $$lcssa = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0;
 var $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond53 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $1 & 255;
 $4 = $0;
 $5 = $4 & 3;
 $6 = ($5|0)!=(0);
 $7 = ($2|0)!=(0);
 $or$cond53 = $7 & $6;
 L1: do {
  if ($or$cond53) {
   $8 = $1&255;
   $$03555 = $0;$$03654 = $2;
   while(1) {
    $9 = HEAP8[$$03555>>0]|0;
    $10 = ($9<<24>>24)==($8<<24>>24);
    if ($10) {
     $$035$lcssa65 = $$03555;$$036$lcssa64 = $$03654;
     label = 6;
     break L1;
    }
    $11 = ((($$03555)) + 1|0);
    $12 = (($$03654) + -1)|0;
    $13 = $11;
    $14 = $13 & 3;
    $15 = ($14|0)!=(0);
    $16 = ($12|0)!=(0);
    $or$cond = $16 & $15;
    if ($or$cond) {
     $$03555 = $11;$$03654 = $12;
    } else {
     $$035$lcssa = $11;$$036$lcssa = $12;$$lcssa = $16;
     label = 5;
     break;
    }
   }
  } else {
   $$035$lcssa = $0;$$036$lcssa = $2;$$lcssa = $7;
   label = 5;
  }
 } while(0);
 if ((label|0) == 5) {
  if ($$lcssa) {
   $$035$lcssa65 = $$035$lcssa;$$036$lcssa64 = $$036$lcssa;
   label = 6;
  } else {
   $$2 = $$035$lcssa;$$3 = 0;
  }
 }
 L8: do {
  if ((label|0) == 6) {
   $17 = HEAP8[$$035$lcssa65>>0]|0;
   $18 = $1&255;
   $19 = ($17<<24>>24)==($18<<24>>24);
   if ($19) {
    $$2 = $$035$lcssa65;$$3 = $$036$lcssa64;
   } else {
    $20 = Math_imul($3, 16843009)|0;
    $21 = ($$036$lcssa64>>>0)>(3);
    L11: do {
     if ($21) {
      $$046 = $$035$lcssa65;$$13745 = $$036$lcssa64;
      while(1) {
       $22 = HEAP32[$$046>>2]|0;
       $23 = $22 ^ $20;
       $24 = (($23) + -16843009)|0;
       $25 = $23 & -2139062144;
       $26 = $25 ^ -2139062144;
       $27 = $26 & $24;
       $28 = ($27|0)==(0);
       if (!($28)) {
        break;
       }
       $29 = ((($$046)) + 4|0);
       $30 = (($$13745) + -4)|0;
       $31 = ($30>>>0)>(3);
       if ($31) {
        $$046 = $29;$$13745 = $30;
       } else {
        $$0$lcssa = $29;$$137$lcssa = $30;
        label = 11;
        break L11;
       }
      }
      $$140 = $$046;$$23839 = $$13745;
     } else {
      $$0$lcssa = $$035$lcssa65;$$137$lcssa = $$036$lcssa64;
      label = 11;
     }
    } while(0);
    if ((label|0) == 11) {
     $32 = ($$137$lcssa|0)==(0);
     if ($32) {
      $$2 = $$0$lcssa;$$3 = 0;
      break;
     } else {
      $$140 = $$0$lcssa;$$23839 = $$137$lcssa;
     }
    }
    while(1) {
     $33 = HEAP8[$$140>>0]|0;
     $34 = ($33<<24>>24)==($18<<24>>24);
     if ($34) {
      $$2 = $$140;$$3 = $$23839;
      break L8;
     }
     $35 = ((($$140)) + 1|0);
     $36 = (($$23839) + -1)|0;
     $37 = ($36|0)==(0);
     if ($37) {
      $$2 = $35;$$3 = 0;
      break;
     } else {
      $$140 = $35;$$23839 = $36;
     }
    }
   }
  }
 } while(0);
 $38 = ($$3|0)!=(0);
 $39 = $38 ? $$2 : 0;
 return ($39|0);
}
function _pad_684($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0$lcssa = 0, $$011 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(256|0);
 $5 = sp;
 $6 = $4 & 73728;
 $7 = ($6|0)==(0);
 $8 = ($2|0)>($3|0);
 $or$cond = $8 & $7;
 if ($or$cond) {
  $9 = (($2) - ($3))|0;
  $10 = ($9>>>0)<(256);
  $11 = $10 ? $9 : 256;
  _memset(($5|0),($1|0),($11|0))|0;
  $12 = ($9>>>0)>(255);
  if ($12) {
   $13 = (($2) - ($3))|0;
   $$011 = $9;
   while(1) {
    _out($0,$5,256);
    $14 = (($$011) + -256)|0;
    $15 = ($14>>>0)>(255);
    if ($15) {
     $$011 = $14;
    } else {
     break;
    }
   }
   $16 = $13 & 255;
   $$0$lcssa = $16;
  } else {
   $$0$lcssa = $9;
  }
  _out($0,$5,$$0$lcssa);
 }
 STACKTOP = sp;return;
}
function _wctomb($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0|0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = (_wcrtomb($0,$1,0)|0);
  $$0 = $3;
 }
 return ($$0|0);
}
function _fmt_fp($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = +$1;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$ = 0, $$$ = 0, $$$$559 = 0.0, $$$3484 = 0, $$$3484691 = 0, $$$3484692 = 0, $$$3501 = 0, $$$4502 = 0, $$$542 = 0.0, $$$559 = 0.0, $$0 = 0, $$0463$lcssa = 0, $$0463584 = 0, $$0464594 = 0, $$0471 = 0.0, $$0479 = 0, $$0487642 = 0, $$0488 = 0, $$0488653 = 0, $$0488655 = 0;
 var $$0496$$9 = 0, $$0497654 = 0, $$0498 = 0, $$0509582 = 0.0, $$0510 = 0, $$0511 = 0, $$0514637 = 0, $$0520 = 0, $$0521 = 0, $$0521$ = 0, $$0523 = 0, $$0525 = 0, $$0527 = 0, $$0527629 = 0, $$0527631 = 0, $$0530636 = 0, $$1465 = 0, $$1467 = 0.0, $$1469 = 0.0, $$1472 = 0.0;
 var $$1480 = 0, $$1482$lcssa = 0, $$1482661 = 0, $$1489641 = 0, $$1499$lcssa = 0, $$1499660 = 0, $$1508583 = 0, $$1512$lcssa = 0, $$1512607 = 0, $$1515 = 0, $$1524 = 0, $$1526 = 0, $$1528614 = 0, $$1531$lcssa = 0, $$1531630 = 0, $$1598 = 0, $$2 = 0, $$2473 = 0.0, $$2476 = 0, $$2476$$547 = 0;
 var $$2476$$549 = 0, $$2483$ph = 0, $$2500 = 0, $$2513 = 0, $$2516618 = 0, $$2529 = 0, $$2532617 = 0, $$3 = 0.0, $$3477 = 0, $$3484$lcssa = 0, $$3484648 = 0, $$3501$lcssa = 0, $$3501647 = 0, $$3533613 = 0, $$4 = 0.0, $$4478$lcssa = 0, $$4478590 = 0, $$4492 = 0, $$4502 = 0, $$4518 = 0;
 var $$5$lcssa = 0, $$534$ = 0, $$539 = 0, $$539$ = 0, $$542 = 0.0, $$546 = 0, $$548 = 0, $$5486$lcssa = 0, $$5486623 = 0, $$5493597 = 0, $$5519$ph = 0, $$555 = 0, $$556 = 0, $$559 = 0.0, $$5602 = 0, $$6 = 0, $$6494589 = 0, $$7495601 = 0, $$7505 = 0, $$7505$ = 0;
 var $$7505$ph = 0, $$8 = 0, $$9$ph = 0, $$lcssa673 = 0, $$neg = 0, $$neg567 = 0, $$pn = 0, $$pn566 = 0, $$pr = 0, $$pr564 = 0, $$pre = 0, $$pre$phi690Z2D = 0, $$pre689 = 0, $$sink545$lcssa = 0, $$sink545622 = 0, $$sink562 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0;
 var $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0.0, $117 = 0.0, $118 = 0.0, $119 = 0, $12 = 0, $120 = 0;
 var $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0;
 var $14 = 0.0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0;
 var $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0;
 var $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0;
 var $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0;
 var $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0.0, $229 = 0.0, $23 = 0;
 var $230 = 0, $231 = 0.0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0;
 var $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0;
 var $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0;
 var $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0;
 var $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0;
 var $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0;
 var $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0.0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0;
 var $358 = 0, $359 = 0, $36 = 0.0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0;
 var $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $50 = 0, $51 = 0.0, $52 = 0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0.0, $57 = 0.0, $58 = 0.0, $59 = 0.0, $6 = 0, $60 = 0.0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0.0, $88 = 0.0, $89 = 0.0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $exitcond = 0;
 var $narrow = 0, $not$ = 0, $notlhs = 0, $notrhs = 0, $or$cond = 0, $or$cond3$not = 0, $or$cond537 = 0, $or$cond541 = 0, $or$cond544 = 0, $or$cond554 = 0, $or$cond6 = 0, $scevgep684 = 0, $scevgep684685 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 560|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(560|0);
 $6 = sp + 8|0;
 $7 = sp;
 $8 = sp + 524|0;
 $9 = $8;
 $10 = sp + 512|0;
 HEAP32[$7>>2] = 0;
 $11 = ((($10)) + 12|0);
 (___DOUBLE_BITS_685($1)|0);
 $12 = tempRet0;
 $13 = ($12|0)<(0);
 if ($13) {
  $14 = -$1;
  $$0471 = $14;$$0520 = 1;$$0521 = 32288;
 } else {
  $15 = $4 & 2048;
  $16 = ($15|0)==(0);
  $17 = $4 & 1;
  $18 = ($17|0)==(0);
  $$ = $18 ? (32289) : (32294);
  $$$ = $16 ? $$ : (32291);
  $19 = $4 & 2049;
  $narrow = ($19|0)!=(0);
  $$534$ = $narrow&1;
  $$0471 = $1;$$0520 = $$534$;$$0521 = $$$;
 }
 (___DOUBLE_BITS_685($$0471)|0);
 $20 = tempRet0;
 $21 = $20 & 2146435072;
 $22 = ($21>>>0)<(2146435072);
 $23 = (0)<(0);
 $24 = ($21|0)==(2146435072);
 $25 = $24 & $23;
 $26 = $22 | $25;
 do {
  if ($26) {
   $35 = (+_frexpl($$0471,$7));
   $36 = $35 * 2.0;
   $37 = $36 != 0.0;
   if ($37) {
    $38 = HEAP32[$7>>2]|0;
    $39 = (($38) + -1)|0;
    HEAP32[$7>>2] = $39;
   }
   $40 = $5 | 32;
   $41 = ($40|0)==(97);
   if ($41) {
    $42 = $5 & 32;
    $43 = ($42|0)==(0);
    $44 = ((($$0521)) + 9|0);
    $$0521$ = $43 ? $$0521 : $44;
    $45 = $$0520 | 2;
    $46 = ($3>>>0)>(11);
    $47 = (12 - ($3))|0;
    $48 = ($47|0)==(0);
    $49 = $46 | $48;
    do {
     if ($49) {
      $$1472 = $36;
     } else {
      $$0509582 = 8.0;$$1508583 = $47;
      while(1) {
       $50 = (($$1508583) + -1)|0;
       $51 = $$0509582 * 16.0;
       $52 = ($50|0)==(0);
       if ($52) {
        break;
       } else {
        $$0509582 = $51;$$1508583 = $50;
       }
      }
      $53 = HEAP8[$$0521$>>0]|0;
      $54 = ($53<<24>>24)==(45);
      if ($54) {
       $55 = -$36;
       $56 = $55 - $51;
       $57 = $51 + $56;
       $58 = -$57;
       $$1472 = $58;
       break;
      } else {
       $59 = $36 + $51;
       $60 = $59 - $51;
       $$1472 = $60;
       break;
      }
     }
    } while(0);
    $61 = HEAP32[$7>>2]|0;
    $62 = ($61|0)<(0);
    $63 = (0 - ($61))|0;
    $64 = $62 ? $63 : $61;
    $65 = ($64|0)<(0);
    $66 = $65 << 31 >> 31;
    $67 = (_fmt_u($64,$66,$11)|0);
    $68 = ($67|0)==($11|0);
    if ($68) {
     $69 = ((($10)) + 11|0);
     HEAP8[$69>>0] = 48;
     $$0511 = $69;
    } else {
     $$0511 = $67;
    }
    $70 = $61 >> 31;
    $71 = $70 & 2;
    $72 = (($71) + 43)|0;
    $73 = $72&255;
    $74 = ((($$0511)) + -1|0);
    HEAP8[$74>>0] = $73;
    $75 = (($5) + 15)|0;
    $76 = $75&255;
    $77 = ((($$0511)) + -2|0);
    HEAP8[$77>>0] = $76;
    $notrhs = ($3|0)<(1);
    $78 = $4 & 8;
    $79 = ($78|0)==(0);
    $$0523 = $8;$$2473 = $$1472;
    while(1) {
     $80 = (~~(($$2473)));
     $81 = (32323 + ($80)|0);
     $82 = HEAP8[$81>>0]|0;
     $83 = $82&255;
     $84 = $83 | $42;
     $85 = $84&255;
     $86 = ((($$0523)) + 1|0);
     HEAP8[$$0523>>0] = $85;
     $87 = (+($80|0));
     $88 = $$2473 - $87;
     $89 = $88 * 16.0;
     $90 = $86;
     $91 = (($90) - ($9))|0;
     $92 = ($91|0)==(1);
     if ($92) {
      $notlhs = $89 == 0.0;
      $or$cond3$not = $notrhs & $notlhs;
      $or$cond = $79 & $or$cond3$not;
      if ($or$cond) {
       $$1524 = $86;
      } else {
       $93 = ((($$0523)) + 2|0);
       HEAP8[$86>>0] = 46;
       $$1524 = $93;
      }
     } else {
      $$1524 = $86;
     }
     $94 = $89 != 0.0;
     if ($94) {
      $$0523 = $$1524;$$2473 = $89;
     } else {
      break;
     }
    }
    $95 = ($3|0)!=(0);
    $96 = $77;
    $97 = $11;
    $98 = $$1524;
    $99 = (($98) - ($9))|0;
    $100 = (($97) - ($96))|0;
    $101 = (($99) + -2)|0;
    $102 = ($101|0)<($3|0);
    $or$cond537 = $95 & $102;
    $103 = (($3) + 2)|0;
    $$pn = $or$cond537 ? $103 : $99;
    $$0525 = (($100) + ($45))|0;
    $104 = (($$0525) + ($$pn))|0;
    _pad_684($0,32,$2,$104,$4);
    _out($0,$$0521$,$45);
    $105 = $4 ^ 65536;
    _pad_684($0,48,$2,$104,$105);
    _out($0,$8,$99);
    $106 = (($$pn) - ($99))|0;
    _pad_684($0,48,$106,0,0);
    _out($0,$77,$100);
    $107 = $4 ^ 8192;
    _pad_684($0,32,$2,$104,$107);
    $$sink562 = $104;
    break;
   }
   $108 = ($3|0)<(0);
   $$539 = $108 ? 6 : $3;
   if ($37) {
    $109 = $36 * 268435456.0;
    $110 = HEAP32[$7>>2]|0;
    $111 = (($110) + -28)|0;
    HEAP32[$7>>2] = $111;
    $$3 = $109;$$pr = $111;
   } else {
    $$pre = HEAP32[$7>>2]|0;
    $$3 = $36;$$pr = $$pre;
   }
   $112 = ($$pr|0)<(0);
   $113 = ((($6)) + 288|0);
   $$556 = $112 ? $6 : $113;
   $$0498 = $$556;$$4 = $$3;
   while(1) {
    $114 = (~~(($$4))>>>0);
    HEAP32[$$0498>>2] = $114;
    $115 = ((($$0498)) + 4|0);
    $116 = (+($114>>>0));
    $117 = $$4 - $116;
    $118 = $117 * 1.0E+9;
    $119 = $118 != 0.0;
    if ($119) {
     $$0498 = $115;$$4 = $118;
    } else {
     break;
    }
   }
   $120 = ($$pr|0)>(0);
   if ($120) {
    $$1482661 = $$556;$$1499660 = $115;$122 = $$pr;
    while(1) {
     $121 = ($122|0)<(29);
     $123 = $121 ? $122 : 29;
     $$0488653 = ((($$1499660)) + -4|0);
     $124 = ($$0488653>>>0)<($$1482661>>>0);
     if ($124) {
      $$2483$ph = $$1482661;
     } else {
      $$0488655 = $$0488653;$$0497654 = 0;
      while(1) {
       $125 = HEAP32[$$0488655>>2]|0;
       $126 = (_bitshift64Shl(($125|0),0,($123|0))|0);
       $127 = tempRet0;
       $128 = (_i64Add(($126|0),($127|0),($$0497654|0),0)|0);
       $129 = tempRet0;
       $130 = (___uremdi3(($128|0),($129|0),1000000000,0)|0);
       $131 = tempRet0;
       HEAP32[$$0488655>>2] = $130;
       $132 = (___udivdi3(($128|0),($129|0),1000000000,0)|0);
       $133 = tempRet0;
       $$0488 = ((($$0488655)) + -4|0);
       $134 = ($$0488>>>0)<($$1482661>>>0);
       if ($134) {
        break;
       } else {
        $$0488655 = $$0488;$$0497654 = $132;
       }
      }
      $135 = ($132|0)==(0);
      if ($135) {
       $$2483$ph = $$1482661;
      } else {
       $136 = ((($$1482661)) + -4|0);
       HEAP32[$136>>2] = $132;
       $$2483$ph = $136;
      }
     }
     $$2500 = $$1499660;
     while(1) {
      $137 = ($$2500>>>0)>($$2483$ph>>>0);
      if (!($137)) {
       break;
      }
      $138 = ((($$2500)) + -4|0);
      $139 = HEAP32[$138>>2]|0;
      $140 = ($139|0)==(0);
      if ($140) {
       $$2500 = $138;
      } else {
       break;
      }
     }
     $141 = HEAP32[$7>>2]|0;
     $142 = (($141) - ($123))|0;
     HEAP32[$7>>2] = $142;
     $143 = ($142|0)>(0);
     if ($143) {
      $$1482661 = $$2483$ph;$$1499660 = $$2500;$122 = $142;
     } else {
      $$1482$lcssa = $$2483$ph;$$1499$lcssa = $$2500;$$pr564 = $142;
      break;
     }
    }
   } else {
    $$1482$lcssa = $$556;$$1499$lcssa = $115;$$pr564 = $$pr;
   }
   $144 = ($$pr564|0)<(0);
   if ($144) {
    $145 = (($$539) + 25)|0;
    $146 = (($145|0) / 9)&-1;
    $147 = (($146) + 1)|0;
    $148 = ($40|0)==(102);
    $$3484648 = $$1482$lcssa;$$3501647 = $$1499$lcssa;$150 = $$pr564;
    while(1) {
     $149 = (0 - ($150))|0;
     $151 = ($149|0)<(9);
     $152 = $151 ? $149 : 9;
     $153 = ($$3484648>>>0)<($$3501647>>>0);
     if ($153) {
      $157 = 1 << $152;
      $158 = (($157) + -1)|0;
      $159 = 1000000000 >>> $152;
      $$0487642 = 0;$$1489641 = $$3484648;
      while(1) {
       $160 = HEAP32[$$1489641>>2]|0;
       $161 = $160 & $158;
       $162 = $160 >>> $152;
       $163 = (($162) + ($$0487642))|0;
       HEAP32[$$1489641>>2] = $163;
       $164 = Math_imul($161, $159)|0;
       $165 = ((($$1489641)) + 4|0);
       $166 = ($165>>>0)<($$3501647>>>0);
       if ($166) {
        $$0487642 = $164;$$1489641 = $165;
       } else {
        break;
       }
      }
      $167 = HEAP32[$$3484648>>2]|0;
      $168 = ($167|0)==(0);
      $169 = ((($$3484648)) + 4|0);
      $$$3484 = $168 ? $169 : $$3484648;
      $170 = ($164|0)==(0);
      if ($170) {
       $$$3484692 = $$$3484;$$4502 = $$3501647;
      } else {
       $171 = ((($$3501647)) + 4|0);
       HEAP32[$$3501647>>2] = $164;
       $$$3484692 = $$$3484;$$4502 = $171;
      }
     } else {
      $154 = HEAP32[$$3484648>>2]|0;
      $155 = ($154|0)==(0);
      $156 = ((($$3484648)) + 4|0);
      $$$3484691 = $155 ? $156 : $$3484648;
      $$$3484692 = $$$3484691;$$4502 = $$3501647;
     }
     $172 = $148 ? $$556 : $$$3484692;
     $173 = $$4502;
     $174 = $172;
     $175 = (($173) - ($174))|0;
     $176 = $175 >> 2;
     $177 = ($176|0)>($147|0);
     $178 = (($172) + ($147<<2)|0);
     $$$4502 = $177 ? $178 : $$4502;
     $179 = HEAP32[$7>>2]|0;
     $180 = (($179) + ($152))|0;
     HEAP32[$7>>2] = $180;
     $181 = ($180|0)<(0);
     if ($181) {
      $$3484648 = $$$3484692;$$3501647 = $$$4502;$150 = $180;
     } else {
      $$3484$lcssa = $$$3484692;$$3501$lcssa = $$$4502;
      break;
     }
    }
   } else {
    $$3484$lcssa = $$1482$lcssa;$$3501$lcssa = $$1499$lcssa;
   }
   $182 = ($$3484$lcssa>>>0)<($$3501$lcssa>>>0);
   $183 = $$556;
   if ($182) {
    $184 = $$3484$lcssa;
    $185 = (($183) - ($184))|0;
    $186 = $185 >> 2;
    $187 = ($186*9)|0;
    $188 = HEAP32[$$3484$lcssa>>2]|0;
    $189 = ($188>>>0)<(10);
    if ($189) {
     $$1515 = $187;
    } else {
     $$0514637 = $187;$$0530636 = 10;
     while(1) {
      $190 = ($$0530636*10)|0;
      $191 = (($$0514637) + 1)|0;
      $192 = ($188>>>0)<($190>>>0);
      if ($192) {
       $$1515 = $191;
       break;
      } else {
       $$0514637 = $191;$$0530636 = $190;
      }
     }
    }
   } else {
    $$1515 = 0;
   }
   $193 = ($40|0)!=(102);
   $194 = $193 ? $$1515 : 0;
   $195 = (($$539) - ($194))|0;
   $196 = ($40|0)==(103);
   $197 = ($$539|0)!=(0);
   $198 = $197 & $196;
   $$neg = $198 << 31 >> 31;
   $199 = (($195) + ($$neg))|0;
   $200 = $$3501$lcssa;
   $201 = (($200) - ($183))|0;
   $202 = $201 >> 2;
   $203 = ($202*9)|0;
   $204 = (($203) + -9)|0;
   $205 = ($199|0)<($204|0);
   if ($205) {
    $206 = ((($$556)) + 4|0);
    $207 = (($199) + 9216)|0;
    $208 = (($207|0) / 9)&-1;
    $209 = (($208) + -1024)|0;
    $210 = (($206) + ($209<<2)|0);
    $211 = (($207|0) % 9)&-1;
    $$0527629 = (($211) + 1)|0;
    $212 = ($$0527629|0)<(9);
    if ($212) {
     $$0527631 = $$0527629;$$1531630 = 10;
     while(1) {
      $213 = ($$1531630*10)|0;
      $$0527 = (($$0527631) + 1)|0;
      $exitcond = ($$0527|0)==(9);
      if ($exitcond) {
       $$1531$lcssa = $213;
       break;
      } else {
       $$0527631 = $$0527;$$1531630 = $213;
      }
     }
    } else {
     $$1531$lcssa = 10;
    }
    $214 = HEAP32[$210>>2]|0;
    $215 = (($214>>>0) % ($$1531$lcssa>>>0))&-1;
    $216 = ($215|0)==(0);
    $217 = ((($210)) + 4|0);
    $218 = ($217|0)==($$3501$lcssa|0);
    $or$cond541 = $218 & $216;
    if ($or$cond541) {
     $$4492 = $210;$$4518 = $$1515;$$8 = $$3484$lcssa;
    } else {
     $219 = (($214>>>0) / ($$1531$lcssa>>>0))&-1;
     $220 = $219 & 1;
     $221 = ($220|0)==(0);
     $$542 = $221 ? 9007199254740992.0 : 9007199254740994.0;
     $222 = (($$1531$lcssa|0) / 2)&-1;
     $223 = ($215>>>0)<($222>>>0);
     $224 = ($215|0)==($222|0);
     $or$cond544 = $218 & $224;
     $$559 = $or$cond544 ? 1.0 : 1.5;
     $$$559 = $223 ? 0.5 : $$559;
     $225 = ($$0520|0)==(0);
     if ($225) {
      $$1467 = $$$559;$$1469 = $$542;
     } else {
      $226 = HEAP8[$$0521>>0]|0;
      $227 = ($226<<24>>24)==(45);
      $228 = -$$542;
      $229 = -$$$559;
      $$$542 = $227 ? $228 : $$542;
      $$$$559 = $227 ? $229 : $$$559;
      $$1467 = $$$$559;$$1469 = $$$542;
     }
     $230 = (($214) - ($215))|0;
     HEAP32[$210>>2] = $230;
     $231 = $$1469 + $$1467;
     $232 = $231 != $$1469;
     if ($232) {
      $233 = (($230) + ($$1531$lcssa))|0;
      HEAP32[$210>>2] = $233;
      $234 = ($233>>>0)>(999999999);
      if ($234) {
       $$5486623 = $$3484$lcssa;$$sink545622 = $210;
       while(1) {
        $235 = ((($$sink545622)) + -4|0);
        HEAP32[$$sink545622>>2] = 0;
        $236 = ($235>>>0)<($$5486623>>>0);
        if ($236) {
         $237 = ((($$5486623)) + -4|0);
         HEAP32[$237>>2] = 0;
         $$6 = $237;
        } else {
         $$6 = $$5486623;
        }
        $238 = HEAP32[$235>>2]|0;
        $239 = (($238) + 1)|0;
        HEAP32[$235>>2] = $239;
        $240 = ($239>>>0)>(999999999);
        if ($240) {
         $$5486623 = $$6;$$sink545622 = $235;
        } else {
         $$5486$lcssa = $$6;$$sink545$lcssa = $235;
         break;
        }
       }
      } else {
       $$5486$lcssa = $$3484$lcssa;$$sink545$lcssa = $210;
      }
      $241 = $$5486$lcssa;
      $242 = (($183) - ($241))|0;
      $243 = $242 >> 2;
      $244 = ($243*9)|0;
      $245 = HEAP32[$$5486$lcssa>>2]|0;
      $246 = ($245>>>0)<(10);
      if ($246) {
       $$4492 = $$sink545$lcssa;$$4518 = $244;$$8 = $$5486$lcssa;
      } else {
       $$2516618 = $244;$$2532617 = 10;
       while(1) {
        $247 = ($$2532617*10)|0;
        $248 = (($$2516618) + 1)|0;
        $249 = ($245>>>0)<($247>>>0);
        if ($249) {
         $$4492 = $$sink545$lcssa;$$4518 = $248;$$8 = $$5486$lcssa;
         break;
        } else {
         $$2516618 = $248;$$2532617 = $247;
        }
       }
      }
     } else {
      $$4492 = $210;$$4518 = $$1515;$$8 = $$3484$lcssa;
     }
    }
    $250 = ((($$4492)) + 4|0);
    $251 = ($$3501$lcssa>>>0)>($250>>>0);
    $$$3501 = $251 ? $250 : $$3501$lcssa;
    $$5519$ph = $$4518;$$7505$ph = $$$3501;$$9$ph = $$8;
   } else {
    $$5519$ph = $$1515;$$7505$ph = $$3501$lcssa;$$9$ph = $$3484$lcssa;
   }
   $$7505 = $$7505$ph;
   while(1) {
    $252 = ($$7505>>>0)>($$9$ph>>>0);
    if (!($252)) {
     $$lcssa673 = 0;
     break;
    }
    $253 = ((($$7505)) + -4|0);
    $254 = HEAP32[$253>>2]|0;
    $255 = ($254|0)==(0);
    if ($255) {
     $$7505 = $253;
    } else {
     $$lcssa673 = 1;
     break;
    }
   }
   $256 = (0 - ($$5519$ph))|0;
   do {
    if ($196) {
     $not$ = $197 ^ 1;
     $257 = $not$&1;
     $$539$ = (($257) + ($$539))|0;
     $258 = ($$539$|0)>($$5519$ph|0);
     $259 = ($$5519$ph|0)>(-5);
     $or$cond6 = $258 & $259;
     if ($or$cond6) {
      $260 = (($5) + -1)|0;
      $$neg567 = (($$539$) + -1)|0;
      $261 = (($$neg567) - ($$5519$ph))|0;
      $$0479 = $260;$$2476 = $261;
     } else {
      $262 = (($5) + -2)|0;
      $263 = (($$539$) + -1)|0;
      $$0479 = $262;$$2476 = $263;
     }
     $264 = $4 & 8;
     $265 = ($264|0)==(0);
     if ($265) {
      if ($$lcssa673) {
       $266 = ((($$7505)) + -4|0);
       $267 = HEAP32[$266>>2]|0;
       $268 = ($267|0)==(0);
       if ($268) {
        $$2529 = 9;
       } else {
        $269 = (($267>>>0) % 10)&-1;
        $270 = ($269|0)==(0);
        if ($270) {
         $$1528614 = 0;$$3533613 = 10;
         while(1) {
          $271 = ($$3533613*10)|0;
          $272 = (($$1528614) + 1)|0;
          $273 = (($267>>>0) % ($271>>>0))&-1;
          $274 = ($273|0)==(0);
          if ($274) {
           $$1528614 = $272;$$3533613 = $271;
          } else {
           $$2529 = $272;
           break;
          }
         }
        } else {
         $$2529 = 0;
        }
       }
      } else {
       $$2529 = 9;
      }
      $275 = $$0479 | 32;
      $276 = ($275|0)==(102);
      $277 = $$7505;
      $278 = (($277) - ($183))|0;
      $279 = $278 >> 2;
      $280 = ($279*9)|0;
      $281 = (($280) + -9)|0;
      if ($276) {
       $282 = (($281) - ($$2529))|0;
       $283 = ($282|0)>(0);
       $$546 = $283 ? $282 : 0;
       $284 = ($$2476|0)<($$546|0);
       $$2476$$547 = $284 ? $$2476 : $$546;
       $$1480 = $$0479;$$3477 = $$2476$$547;$$pre$phi690Z2D = 0;
       break;
      } else {
       $285 = (($281) + ($$5519$ph))|0;
       $286 = (($285) - ($$2529))|0;
       $287 = ($286|0)>(0);
       $$548 = $287 ? $286 : 0;
       $288 = ($$2476|0)<($$548|0);
       $$2476$$549 = $288 ? $$2476 : $$548;
       $$1480 = $$0479;$$3477 = $$2476$$549;$$pre$phi690Z2D = 0;
       break;
      }
     } else {
      $$1480 = $$0479;$$3477 = $$2476;$$pre$phi690Z2D = $264;
     }
    } else {
     $$pre689 = $4 & 8;
     $$1480 = $5;$$3477 = $$539;$$pre$phi690Z2D = $$pre689;
    }
   } while(0);
   $289 = $$3477 | $$pre$phi690Z2D;
   $290 = ($289|0)!=(0);
   $291 = $290&1;
   $292 = $$1480 | 32;
   $293 = ($292|0)==(102);
   if ($293) {
    $294 = ($$5519$ph|0)>(0);
    $295 = $294 ? $$5519$ph : 0;
    $$2513 = 0;$$pn566 = $295;
   } else {
    $296 = ($$5519$ph|0)<(0);
    $297 = $296 ? $256 : $$5519$ph;
    $298 = ($297|0)<(0);
    $299 = $298 << 31 >> 31;
    $300 = (_fmt_u($297,$299,$11)|0);
    $301 = $11;
    $302 = $300;
    $303 = (($301) - ($302))|0;
    $304 = ($303|0)<(2);
    if ($304) {
     $$1512607 = $300;
     while(1) {
      $305 = ((($$1512607)) + -1|0);
      HEAP8[$305>>0] = 48;
      $306 = $305;
      $307 = (($301) - ($306))|0;
      $308 = ($307|0)<(2);
      if ($308) {
       $$1512607 = $305;
      } else {
       $$1512$lcssa = $305;
       break;
      }
     }
    } else {
     $$1512$lcssa = $300;
    }
    $309 = $$5519$ph >> 31;
    $310 = $309 & 2;
    $311 = (($310) + 43)|0;
    $312 = $311&255;
    $313 = ((($$1512$lcssa)) + -1|0);
    HEAP8[$313>>0] = $312;
    $314 = $$1480&255;
    $315 = ((($$1512$lcssa)) + -2|0);
    HEAP8[$315>>0] = $314;
    $316 = $315;
    $317 = (($301) - ($316))|0;
    $$2513 = $315;$$pn566 = $317;
   }
   $318 = (($$0520) + 1)|0;
   $319 = (($318) + ($$3477))|0;
   $$1526 = (($319) + ($291))|0;
   $320 = (($$1526) + ($$pn566))|0;
   _pad_684($0,32,$2,$320,$4);
   _out($0,$$0521,$$0520);
   $321 = $4 ^ 65536;
   _pad_684($0,48,$2,$320,$321);
   if ($293) {
    $322 = ($$9$ph>>>0)>($$556>>>0);
    $$0496$$9 = $322 ? $$556 : $$9$ph;
    $323 = ((($8)) + 9|0);
    $324 = $323;
    $325 = ((($8)) + 8|0);
    $$5493597 = $$0496$$9;
    while(1) {
     $326 = HEAP32[$$5493597>>2]|0;
     $327 = (_fmt_u($326,0,$323)|0);
     $328 = ($$5493597|0)==($$0496$$9|0);
     if ($328) {
      $334 = ($327|0)==($323|0);
      if ($334) {
       HEAP8[$325>>0] = 48;
       $$1465 = $325;
      } else {
       $$1465 = $327;
      }
     } else {
      $329 = ($327>>>0)>($8>>>0);
      if ($329) {
       $330 = $327;
       $331 = (($330) - ($9))|0;
       _memset(($8|0),48,($331|0))|0;
       $$0464594 = $327;
       while(1) {
        $332 = ((($$0464594)) + -1|0);
        $333 = ($332>>>0)>($8>>>0);
        if ($333) {
         $$0464594 = $332;
        } else {
         $$1465 = $332;
         break;
        }
       }
      } else {
       $$1465 = $327;
      }
     }
     $335 = $$1465;
     $336 = (($324) - ($335))|0;
     _out($0,$$1465,$336);
     $337 = ((($$5493597)) + 4|0);
     $338 = ($337>>>0)>($$556>>>0);
     if ($338) {
      break;
     } else {
      $$5493597 = $337;
     }
    }
    $339 = ($289|0)==(0);
    if (!($339)) {
     _out($0,32339,1);
    }
    $340 = ($337>>>0)<($$7505>>>0);
    $341 = ($$3477|0)>(0);
    $342 = $340 & $341;
    if ($342) {
     $$4478590 = $$3477;$$6494589 = $337;
     while(1) {
      $343 = HEAP32[$$6494589>>2]|0;
      $344 = (_fmt_u($343,0,$323)|0);
      $345 = ($344>>>0)>($8>>>0);
      if ($345) {
       $346 = $344;
       $347 = (($346) - ($9))|0;
       _memset(($8|0),48,($347|0))|0;
       $$0463584 = $344;
       while(1) {
        $348 = ((($$0463584)) + -1|0);
        $349 = ($348>>>0)>($8>>>0);
        if ($349) {
         $$0463584 = $348;
        } else {
         $$0463$lcssa = $348;
         break;
        }
       }
      } else {
       $$0463$lcssa = $344;
      }
      $350 = ($$4478590|0)<(9);
      $351 = $350 ? $$4478590 : 9;
      _out($0,$$0463$lcssa,$351);
      $352 = ((($$6494589)) + 4|0);
      $353 = (($$4478590) + -9)|0;
      $354 = ($352>>>0)<($$7505>>>0);
      $355 = ($$4478590|0)>(9);
      $356 = $354 & $355;
      if ($356) {
       $$4478590 = $353;$$6494589 = $352;
      } else {
       $$4478$lcssa = $353;
       break;
      }
     }
    } else {
     $$4478$lcssa = $$3477;
    }
    $357 = (($$4478$lcssa) + 9)|0;
    _pad_684($0,48,$357,9,0);
   } else {
    $358 = ((($$9$ph)) + 4|0);
    $$7505$ = $$lcssa673 ? $$7505 : $358;
    $359 = ($$3477|0)>(-1);
    if ($359) {
     $360 = ((($8)) + 9|0);
     $361 = ($$pre$phi690Z2D|0)==(0);
     $362 = $360;
     $363 = (0 - ($9))|0;
     $364 = ((($8)) + 8|0);
     $$5602 = $$3477;$$7495601 = $$9$ph;
     while(1) {
      $365 = HEAP32[$$7495601>>2]|0;
      $366 = (_fmt_u($365,0,$360)|0);
      $367 = ($366|0)==($360|0);
      if ($367) {
       HEAP8[$364>>0] = 48;
       $$0 = $364;
      } else {
       $$0 = $366;
      }
      $368 = ($$7495601|0)==($$9$ph|0);
      do {
       if ($368) {
        $372 = ((($$0)) + 1|0);
        _out($0,$$0,1);
        $373 = ($$5602|0)<(1);
        $or$cond554 = $361 & $373;
        if ($or$cond554) {
         $$2 = $372;
         break;
        }
        _out($0,32339,1);
        $$2 = $372;
       } else {
        $369 = ($$0>>>0)>($8>>>0);
        if (!($369)) {
         $$2 = $$0;
         break;
        }
        $scevgep684 = (($$0) + ($363)|0);
        $scevgep684685 = $scevgep684;
        _memset(($8|0),48,($scevgep684685|0))|0;
        $$1598 = $$0;
        while(1) {
         $370 = ((($$1598)) + -1|0);
         $371 = ($370>>>0)>($8>>>0);
         if ($371) {
          $$1598 = $370;
         } else {
          $$2 = $370;
          break;
         }
        }
       }
      } while(0);
      $374 = $$2;
      $375 = (($362) - ($374))|0;
      $376 = ($$5602|0)>($375|0);
      $377 = $376 ? $375 : $$5602;
      _out($0,$$2,$377);
      $378 = (($$5602) - ($375))|0;
      $379 = ((($$7495601)) + 4|0);
      $380 = ($379>>>0)<($$7505$>>>0);
      $381 = ($378|0)>(-1);
      $382 = $380 & $381;
      if ($382) {
       $$5602 = $378;$$7495601 = $379;
      } else {
       $$5$lcssa = $378;
       break;
      }
     }
    } else {
     $$5$lcssa = $$3477;
    }
    $383 = (($$5$lcssa) + 18)|0;
    _pad_684($0,48,$383,18,0);
    $384 = $11;
    $385 = $$2513;
    $386 = (($384) - ($385))|0;
    _out($0,$$2513,$386);
   }
   $387 = $4 ^ 8192;
   _pad_684($0,32,$2,$320,$387);
   $$sink562 = $320;
  } else {
   $27 = $5 & 32;
   $28 = ($27|0)!=(0);
   $29 = $28 ? 32307 : 32311;
   $30 = ($$0471 != $$0471) | (0.0 != 0.0);
   $31 = $28 ? 32315 : 32319;
   $$0510 = $30 ? $31 : $29;
   $32 = (($$0520) + 3)|0;
   $33 = $4 & -65537;
   _pad_684($0,32,$2,$32,$33);
   _out($0,$$0521,$$0520);
   _out($0,$$0510,3);
   $34 = $4 ^ 8192;
   _pad_684($0,32,$2,$32,$34);
   $$sink562 = $32;
  }
 } while(0);
 $388 = ($$sink562|0)<($2|0);
 $$555 = $388 ? $2 : $$sink562;
 STACKTOP = sp;return ($$555|0);
}
function ___DOUBLE_BITS_685($0) {
 $0 = +$0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $0;$1 = HEAP32[tempDoublePtr>>2]|0;
 $2 = HEAP32[tempDoublePtr+4>>2]|0;
 tempRet0 = ($2);
 return ($1|0);
}
function _frexpl($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (+_frexp($0,$1));
 return (+$2);
}
function _frexp($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $$0 = 0.0, $$016 = 0.0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, $storemerge = 0, $trunc$clear = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $0;$2 = HEAP32[tempDoublePtr>>2]|0;
 $3 = HEAP32[tempDoublePtr+4>>2]|0;
 $4 = (_bitshift64Lshr(($2|0),($3|0),52)|0);
 $5 = tempRet0;
 $6 = $4&65535;
 $trunc$clear = $6 & 2047;
 switch ($trunc$clear<<16>>16) {
 case 0:  {
  $7 = $0 != 0.0;
  if ($7) {
   $8 = $0 * 1.8446744073709552E+19;
   $9 = (+_frexp($8,$1));
   $10 = HEAP32[$1>>2]|0;
   $11 = (($10) + -64)|0;
   $$016 = $9;$storemerge = $11;
  } else {
   $$016 = $0;$storemerge = 0;
  }
  HEAP32[$1>>2] = $storemerge;
  $$0 = $$016;
  break;
 }
 case 2047:  {
  $$0 = $0;
  break;
 }
 default: {
  $12 = $4 & 2047;
  $13 = (($12) + -1022)|0;
  HEAP32[$1>>2] = $13;
  $14 = $3 & -2146435073;
  $15 = $14 | 1071644672;
  HEAP32[tempDoublePtr>>2] = $2;HEAP32[tempDoublePtr+4>>2] = $15;$16 = +HEAPF64[tempDoublePtr>>3];
  $$0 = $16;
 }
 }
 return (+$$0);
}
function _wcrtomb($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $not$ = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==(0|0);
 do {
  if ($3) {
   $$0 = 1;
  } else {
   $4 = ($1>>>0)<(128);
   if ($4) {
    $5 = $1&255;
    HEAP8[$0>>0] = $5;
    $$0 = 1;
    break;
   }
   $6 = (___pthread_self_431()|0);
   $7 = ((($6)) + 188|0);
   $8 = HEAP32[$7>>2]|0;
   $9 = HEAP32[$8>>2]|0;
   $not$ = ($9|0)==(0|0);
   if ($not$) {
    $10 = $1 & -128;
    $11 = ($10|0)==(57216);
    if ($11) {
     $13 = $1&255;
     HEAP8[$0>>0] = $13;
     $$0 = 1;
     break;
    } else {
     $12 = (___errno_location()|0);
     HEAP32[$12>>2] = 84;
     $$0 = -1;
     break;
    }
   }
   $14 = ($1>>>0)<(2048);
   if ($14) {
    $15 = $1 >>> 6;
    $16 = $15 | 192;
    $17 = $16&255;
    $18 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $17;
    $19 = $1 & 63;
    $20 = $19 | 128;
    $21 = $20&255;
    HEAP8[$18>>0] = $21;
    $$0 = 2;
    break;
   }
   $22 = ($1>>>0)<(55296);
   $23 = $1 & -8192;
   $24 = ($23|0)==(57344);
   $or$cond = $22 | $24;
   if ($or$cond) {
    $25 = $1 >>> 12;
    $26 = $25 | 224;
    $27 = $26&255;
    $28 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $27;
    $29 = $1 >>> 6;
    $30 = $29 & 63;
    $31 = $30 | 128;
    $32 = $31&255;
    $33 = ((($0)) + 2|0);
    HEAP8[$28>>0] = $32;
    $34 = $1 & 63;
    $35 = $34 | 128;
    $36 = $35&255;
    HEAP8[$33>>0] = $36;
    $$0 = 3;
    break;
   }
   $37 = (($1) + -65536)|0;
   $38 = ($37>>>0)<(1048576);
   if ($38) {
    $39 = $1 >>> 18;
    $40 = $39 | 240;
    $41 = $40&255;
    $42 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $41;
    $43 = $1 >>> 12;
    $44 = $43 & 63;
    $45 = $44 | 128;
    $46 = $45&255;
    $47 = ((($0)) + 2|0);
    HEAP8[$42>>0] = $46;
    $48 = $1 >>> 6;
    $49 = $48 & 63;
    $50 = $49 | 128;
    $51 = $50&255;
    $52 = ((($0)) + 3|0);
    HEAP8[$47>>0] = $51;
    $53 = $1 & 63;
    $54 = $53 | 128;
    $55 = $54&255;
    HEAP8[$52>>0] = $55;
    $$0 = 4;
    break;
   } else {
    $56 = (___errno_location()|0);
    HEAP32[$56>>2] = 84;
    $$0 = -1;
    break;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___pthread_self_431() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function ___pthread_self_104() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function ___strerror_l($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$012$lcssa = 0, $$01214 = 0, $$016 = 0, $$113 = 0, $$115 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $$016 = 0;
 while(1) {
  $3 = (32341 + ($$016)|0);
  $4 = HEAP8[$3>>0]|0;
  $5 = $4&255;
  $6 = ($5|0)==($0|0);
  if ($6) {
   label = 2;
   break;
  }
  $7 = (($$016) + 1)|0;
  $8 = ($7|0)==(87);
  if ($8) {
   $$01214 = 32429;$$115 = 87;
   label = 5;
   break;
  } else {
   $$016 = $7;
  }
 }
 if ((label|0) == 2) {
  $2 = ($$016|0)==(0);
  if ($2) {
   $$012$lcssa = 32429;
  } else {
   $$01214 = 32429;$$115 = $$016;
   label = 5;
  }
 }
 if ((label|0) == 5) {
  while(1) {
   label = 0;
   $$113 = $$01214;
   while(1) {
    $9 = HEAP8[$$113>>0]|0;
    $10 = ($9<<24>>24)==(0);
    $11 = ((($$113)) + 1|0);
    if ($10) {
     break;
    } else {
     $$113 = $11;
    }
   }
   $12 = (($$115) + -1)|0;
   $13 = ($12|0)==(0);
   if ($13) {
    $$012$lcssa = $11;
    break;
   } else {
    $$01214 = $11;$$115 = $12;
    label = 5;
   }
  }
 }
 $14 = ((($1)) + 20|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (___lctrans($$012$lcssa,$15)|0);
 return ($16|0);
}
function ___lctrans($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (___lctrans_impl($0,$1)|0);
 return ($2|0);
}
function ___lctrans_impl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)==(0|0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = HEAP32[$1>>2]|0;
  $4 = ((($1)) + 4|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = (___mo_lookup($3,$5,$0)|0);
  $$0 = $6;
 }
 $7 = ($$0|0)!=(0|0);
 $8 = $7 ? $$0 : $0;
 return ($8|0);
}
function ___mo_lookup($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$090 = 0, $$094 = 0, $$191 = 0, $$195 = 0, $$4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond102 = 0, $or$cond104 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = (($3) + 1794895138)|0;
 $5 = ((($0)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (_swapc($6,$4)|0);
 $8 = ((($0)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = (_swapc($9,$4)|0);
 $11 = ((($0)) + 16|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = (_swapc($12,$4)|0);
 $14 = $1 >>> 2;
 $15 = ($7>>>0)<($14>>>0);
 L1: do {
  if ($15) {
   $16 = $7 << 2;
   $17 = (($1) - ($16))|0;
   $18 = ($10>>>0)<($17>>>0);
   $19 = ($13>>>0)<($17>>>0);
   $or$cond = $18 & $19;
   if ($or$cond) {
    $20 = $13 | $10;
    $21 = $20 & 3;
    $22 = ($21|0)==(0);
    if ($22) {
     $23 = $10 >>> 2;
     $24 = $13 >>> 2;
     $$090 = 0;$$094 = $7;
     while(1) {
      $25 = $$094 >>> 1;
      $26 = (($$090) + ($25))|0;
      $27 = $26 << 1;
      $28 = (($27) + ($23))|0;
      $29 = (($0) + ($28<<2)|0);
      $30 = HEAP32[$29>>2]|0;
      $31 = (_swapc($30,$4)|0);
      $32 = (($28) + 1)|0;
      $33 = (($0) + ($32<<2)|0);
      $34 = HEAP32[$33>>2]|0;
      $35 = (_swapc($34,$4)|0);
      $36 = ($35>>>0)<($1>>>0);
      $37 = (($1) - ($35))|0;
      $38 = ($31>>>0)<($37>>>0);
      $or$cond102 = $36 & $38;
      if (!($or$cond102)) {
       $$4 = 0;
       break L1;
      }
      $39 = (($35) + ($31))|0;
      $40 = (($0) + ($39)|0);
      $41 = HEAP8[$40>>0]|0;
      $42 = ($41<<24>>24)==(0);
      if (!($42)) {
       $$4 = 0;
       break L1;
      }
      $43 = (($0) + ($35)|0);
      $44 = (_strcmp($2,$43)|0);
      $45 = ($44|0)==(0);
      if ($45) {
       break;
      }
      $62 = ($$094|0)==(1);
      $63 = ($44|0)<(0);
      $64 = (($$094) - ($25))|0;
      $$195 = $63 ? $25 : $64;
      $$191 = $63 ? $$090 : $26;
      if ($62) {
       $$4 = 0;
       break L1;
      } else {
       $$090 = $$191;$$094 = $$195;
      }
     }
     $46 = (($27) + ($24))|0;
     $47 = (($0) + ($46<<2)|0);
     $48 = HEAP32[$47>>2]|0;
     $49 = (_swapc($48,$4)|0);
     $50 = (($46) + 1)|0;
     $51 = (($0) + ($50<<2)|0);
     $52 = HEAP32[$51>>2]|0;
     $53 = (_swapc($52,$4)|0);
     $54 = ($53>>>0)<($1>>>0);
     $55 = (($1) - ($53))|0;
     $56 = ($49>>>0)<($55>>>0);
     $or$cond104 = $54 & $56;
     if ($or$cond104) {
      $57 = (($0) + ($53)|0);
      $58 = (($53) + ($49))|0;
      $59 = (($0) + ($58)|0);
      $60 = HEAP8[$59>>0]|0;
      $61 = ($60<<24>>24)==(0);
      $$ = $61 ? $57 : 0;
      $$4 = $$;
     } else {
      $$4 = 0;
     }
    } else {
     $$4 = 0;
    }
   } else {
    $$4 = 0;
   }
  } else {
   $$4 = 0;
  }
 } while(0);
 return ($$4|0);
}
function _swapc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)==(0);
 $3 = (_llvm_bswap_i32(($0|0))|0);
 $$ = $2 ? $0 : $3;
 return ($$|0);
}
function ___fwritex($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$038 = 0, $$042 = 0, $$1 = 0, $$139 = 0, $$141 = 0, $$143 = 0, $$pre = 0, $$pre47 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($2)) + 16|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $7 = (___towrite($2)|0);
  $8 = ($7|0)==(0);
  if ($8) {
   $$pre = HEAP32[$3>>2]|0;
   $12 = $$pre;
   label = 5;
  } else {
   $$1 = 0;
  }
 } else {
  $6 = $4;
  $12 = $6;
  label = 5;
 }
 L5: do {
  if ((label|0) == 5) {
   $9 = ((($2)) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = (($12) - ($10))|0;
   $13 = ($11>>>0)<($1>>>0);
   $14 = $10;
   if ($13) {
    $15 = ((($2)) + 36|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = (FUNCTION_TABLE_iiii[$16 & 127]($2,$0,$1)|0);
    $$1 = $17;
    break;
   }
   $18 = ((($2)) + 75|0);
   $19 = HEAP8[$18>>0]|0;
   $20 = ($19<<24>>24)>(-1);
   L10: do {
    if ($20) {
     $$038 = $1;
     while(1) {
      $21 = ($$038|0)==(0);
      if ($21) {
       $$139 = 0;$$141 = $0;$$143 = $1;$31 = $14;
       break L10;
      }
      $22 = (($$038) + -1)|0;
      $23 = (($0) + ($22)|0);
      $24 = HEAP8[$23>>0]|0;
      $25 = ($24<<24>>24)==(10);
      if ($25) {
       break;
      } else {
       $$038 = $22;
      }
     }
     $26 = ((($2)) + 36|0);
     $27 = HEAP32[$26>>2]|0;
     $28 = (FUNCTION_TABLE_iiii[$27 & 127]($2,$0,$$038)|0);
     $29 = ($28>>>0)<($$038>>>0);
     if ($29) {
      $$1 = $28;
      break L5;
     }
     $30 = (($0) + ($$038)|0);
     $$042 = (($1) - ($$038))|0;
     $$pre47 = HEAP32[$9>>2]|0;
     $$139 = $$038;$$141 = $30;$$143 = $$042;$31 = $$pre47;
    } else {
     $$139 = 0;$$141 = $0;$$143 = $1;$31 = $14;
    }
   } while(0);
   _memcpy(($31|0),($$141|0),($$143|0))|0;
   $32 = HEAP32[$9>>2]|0;
   $33 = (($32) + ($$143)|0);
   HEAP32[$9>>2] = $33;
   $34 = (($$139) + ($$143))|0;
   $$1 = $34;
  }
 } while(0);
 return ($$1|0);
}
function ___towrite($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 74|0);
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $4 = (($3) + 255)|0;
 $5 = $4 | $3;
 $6 = $5&255;
 HEAP8[$1>>0] = $6;
 $7 = HEAP32[$0>>2]|0;
 $8 = $7 & 8;
 $9 = ($8|0)==(0);
 if ($9) {
  $11 = ((($0)) + 8|0);
  HEAP32[$11>>2] = 0;
  $12 = ((($0)) + 4|0);
  HEAP32[$12>>2] = 0;
  $13 = ((($0)) + 44|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = ((($0)) + 28|0);
  HEAP32[$15>>2] = $14;
  $16 = ((($0)) + 20|0);
  HEAP32[$16>>2] = $14;
  $17 = ((($0)) + 48|0);
  $18 = HEAP32[$17>>2]|0;
  $19 = (($14) + ($18)|0);
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = $19;
  $$0 = 0;
 } else {
  $10 = $7 | 32;
  HEAP32[$0>>2] = $10;
  $$0 = -1;
 }
 return ($$0|0);
}
function _strlen($0) {
 $0 = $0|0;
 var $$0 = 0, $$015$lcssa = 0, $$01519 = 0, $$1$lcssa = 0, $$pn = 0, $$pre = 0, $$sink = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0;
 $2 = $1 & 3;
 $3 = ($2|0)==(0);
 L1: do {
  if ($3) {
   $$015$lcssa = $0;
   label = 4;
  } else {
   $$01519 = $0;$23 = $1;
   while(1) {
    $4 = HEAP8[$$01519>>0]|0;
    $5 = ($4<<24>>24)==(0);
    if ($5) {
     $$sink = $23;
     break L1;
    }
    $6 = ((($$01519)) + 1|0);
    $7 = $6;
    $8 = $7 & 3;
    $9 = ($8|0)==(0);
    if ($9) {
     $$015$lcssa = $6;
     label = 4;
     break;
    } else {
     $$01519 = $6;$23 = $7;
    }
   }
  }
 } while(0);
 if ((label|0) == 4) {
  $$0 = $$015$lcssa;
  while(1) {
   $10 = HEAP32[$$0>>2]|0;
   $11 = (($10) + -16843009)|0;
   $12 = $10 & -2139062144;
   $13 = $12 ^ -2139062144;
   $14 = $13 & $11;
   $15 = ($14|0)==(0);
   $16 = ((($$0)) + 4|0);
   if ($15) {
    $$0 = $16;
   } else {
    break;
   }
  }
  $17 = $10&255;
  $18 = ($17<<24>>24)==(0);
  if ($18) {
   $$1$lcssa = $$0;
  } else {
   $$pn = $$0;
   while(1) {
    $19 = ((($$pn)) + 1|0);
    $$pre = HEAP8[$19>>0]|0;
    $20 = ($$pre<<24>>24)==(0);
    if ($20) {
     $$1$lcssa = $19;
     break;
    } else {
     $$pn = $19;
    }
   }
  }
  $21 = $$1$lcssa;
  $$sink = $21;
 }
 $22 = (($$sink) - ($1))|0;
 return ($22|0);
}
function ___overflow($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = sp;
 $3 = $1&255;
 HEAP8[$2>>0] = $3;
 $4 = ((($0)) + 16|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==(0|0);
 if ($6) {
  $7 = (___towrite($0)|0);
  $8 = ($7|0)==(0);
  if ($8) {
   $$pre = HEAP32[$4>>2]|0;
   $12 = $$pre;
   label = 4;
  } else {
   $$0 = -1;
  }
 } else {
  $12 = $5;
  label = 4;
 }
 do {
  if ((label|0) == 4) {
   $9 = ((($0)) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = ($10>>>0)<($12>>>0);
   if ($11) {
    $13 = $1 & 255;
    $14 = ((($0)) + 75|0);
    $15 = HEAP8[$14>>0]|0;
    $16 = $15 << 24 >> 24;
    $17 = ($13|0)==($16|0);
    if (!($17)) {
     $18 = ((($10)) + 1|0);
     HEAP32[$9>>2] = $18;
     HEAP8[$10>>0] = $3;
     $$0 = $13;
     break;
    }
   }
   $19 = ((($0)) + 36|0);
   $20 = HEAP32[$19>>2]|0;
   $21 = (FUNCTION_TABLE_iiii[$20 & 127]($0,$2,1)|0);
   $22 = ($21|0)==(1);
   if ($22) {
    $23 = HEAP8[$2>>0]|0;
    $24 = $23&255;
    $$0 = $24;
   } else {
    $$0 = -1;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function ___ofl_lock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___lock((37080|0));
 return (37088|0);
}
function ___ofl_unlock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___unlock((37080|0));
 return;
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[7885]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $29 = 0;
   } else {
    $10 = HEAP32[7885]|0;
    $11 = (_fflush($10)|0);
    $29 = $11;
   }
   $12 = (___ofl_lock()|0);
   $$02325 = HEAP32[$12>>2]|0;
   $13 = ($$02325|0)==(0|0);
   if ($13) {
    $$024$lcssa = $29;
   } else {
    $$02327 = $$02325;$$02426 = $29;
    while(1) {
     $14 = ((($$02327)) + 76|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)>(-1);
     if ($16) {
      $17 = (___lockfile($$02327)|0);
      $26 = $17;
     } else {
      $26 = 0;
     }
     $18 = ((($$02327)) + 20|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ((($$02327)) + 28|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($19>>>0)>($21>>>0);
     if ($22) {
      $23 = (___fflush_unlocked($$02327)|0);
      $24 = $23 | $$02426;
      $$1 = $24;
     } else {
      $$1 = $$02426;
     }
     $25 = ($26|0)==(0);
     if (!($25)) {
      ___unlockfile($$02327);
     }
     $27 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$27>>2]|0;
     $28 = ($$023|0)==(0|0);
     if ($28) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___ofl_unlock();
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 127]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = $11;
   $16 = $13;
   $17 = (($15) - ($16))|0;
   $18 = ((($0)) + 40|0);
   $19 = HEAP32[$18>>2]|0;
   (FUNCTION_TABLE_iiii[$19 & 127]($0,$17,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function _fputc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 76|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($3|0)<(0);
 $5 = $0&255;
 $6 = $0 & 255;
 if ($4) {
  label = 3;
 } else {
  $7 = (___lockfile($1)|0);
  $8 = ($7|0)==(0);
  if ($8) {
   label = 3;
  } else {
   $20 = ((($1)) + 75|0);
   $21 = HEAP8[$20>>0]|0;
   $22 = $21 << 24 >> 24;
   $23 = ($6|0)==($22|0);
   if ($23) {
    label = 10;
   } else {
    $24 = ((($1)) + 20|0);
    $25 = HEAP32[$24>>2]|0;
    $26 = ((($1)) + 16|0);
    $27 = HEAP32[$26>>2]|0;
    $28 = ($25>>>0)<($27>>>0);
    if ($28) {
     $29 = ((($25)) + 1|0);
     HEAP32[$24>>2] = $29;
     HEAP8[$25>>0] = $5;
     $31 = $6;
    } else {
     label = 10;
    }
   }
   if ((label|0) == 10) {
    $30 = (___overflow($1,$0)|0);
    $31 = $30;
   }
   ___unlockfile($1);
   $$0 = $31;
  }
 }
 do {
  if ((label|0) == 3) {
   $9 = ((($1)) + 75|0);
   $10 = HEAP8[$9>>0]|0;
   $11 = $10 << 24 >> 24;
   $12 = ($6|0)==($11|0);
   if (!($12)) {
    $13 = ((($1)) + 20|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = ((($1)) + 16|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = ($14>>>0)<($16>>>0);
    if ($17) {
     $18 = ((($14)) + 1|0);
     HEAP32[$13>>2] = $18;
     HEAP8[$14>>0] = $5;
     $$0 = $6;
     break;
    }
   }
   $19 = (___overflow($1,$0)|0);
   $$0 = $19;
  }
 } while(0);
 return ($$0|0);
}
function __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (___cxa_allocate_exception(8)|0);
 __THREW__ = 0;
 invoke_vii(66,($1|0),(34233|0));
 $2 = __THREW__; __THREW__ = 0;
 $3 = $2&1;
 if ($3) {
  $4 = ___cxa_find_matching_catch_2()|0;
  $5 = tempRet0;
  ___cxa_free_exception(($1|0));
  ___resumeException($4|0);
  // unreachable;
 } else {
  HEAP32[$1>>2] = (31680);
  ___cxa_throw(($1|0),(30904|0),(31|0));
  // unreachable;
 }
}
function __Znwj($0) {
 $0 = $0|0;
 var $$ = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0);
 $$ = $1 ? 1 : $0;
 while(1) {
  $2 = (_malloc($$)|0);
  $3 = ($2|0)==(0|0);
  if (!($3)) {
   label = 6;
   break;
  }
  $4 = (__ZSt15get_new_handlerv()|0);
  $5 = ($4|0)==(0|0);
  if ($5) {
   label = 5;
   break;
  }
  FUNCTION_TABLE_v[$4 & 127]();
 }
 if ((label|0) == 5) {
  $6 = (___cxa_allocate_exception(4)|0);
  __ZNSt9bad_allocC2Ev($6);
  ___cxa_throw(($6|0),(30872|0),(28|0));
  // unreachable;
 }
 else if ((label|0) == 6) {
  return ($2|0);
 }
 return (0)|0;
}
function __Znaj($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj($0)|0);
 return ($1|0);
}
function __ZdlPv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _free($0);
 return;
}
function __ZdaPv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($0);
 return;
}
function __ZNSt3__218__libcpp_refstringC2EPKc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (_strlen($1)|0);
 $3 = (($2) + 13)|0;
 $4 = (__Znwj($3)|0);
 HEAP32[$4>>2] = $2;
 $5 = ((($4)) + 4|0);
 HEAP32[$5>>2] = $2;
 $6 = ((($4)) + 8|0);
 HEAP32[$6>>2] = 0;
 $7 = (__ZNSt3__215__refstring_imp12_GLOBAL__N_113data_from_repEPNS1_9_Rep_baseE($4)|0);
 $8 = (($2) + 1)|0;
 _memcpy(($7|0),($1|0),($8|0))|0;
 HEAP32[$0>>2] = $7;
 return;
}
function __ZNSt3__215__refstring_imp12_GLOBAL__N_113data_from_repEPNS1_9_Rep_baseE($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 12|0);
 return ($1|0);
}
function __ZNSt11logic_errorC2EPKc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = (31660);
 $2 = ((($0)) + 4|0);
 __THREW__ = 0;
 invoke_vii(80,($2|0),($1|0));
 $3 = __THREW__; __THREW__ = 0;
 $4 = $3&1;
 if ($4) {
  $5 = ___cxa_find_matching_catch_2()|0;
  $6 = tempRet0;
  ___resumeException($5|0);
  // unreachable;
 } else {
  return;
 }
}
function __ZNKSt3__218__libcpp_refstring15__uses_refcountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 1;
}
function __ZL25default_terminate_handlerv() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer10 = 0, $vararg_buffer3 = 0;
 var $vararg_buffer7 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer10 = sp + 32|0;
 $vararg_buffer7 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $0 = sp + 36|0;
 $1 = (___cxa_get_globals_fast()|0);
 $2 = ($1|0)==(0|0);
 if (!($2)) {
  $3 = HEAP32[$1>>2]|0;
  $4 = ($3|0)==(0|0);
  if (!($4)) {
   $5 = ((($3)) + 80|0);
   $6 = ((($3)) + 48|0);
   $7 = $6;
   $8 = $7;
   $9 = HEAP32[$8>>2]|0;
   $10 = (($7) + 4)|0;
   $11 = $10;
   $12 = HEAP32[$11>>2]|0;
   $13 = $9 & -256;
   $14 = ($13|0)==(1126902528);
   $15 = ($12|0)==(1129074247);
   $16 = $14 & $15;
   if (!($16)) {
    $36 = HEAP32[7887]|0;
    HEAP32[$vararg_buffer7>>2] = $36;
    _abort_message(34326,$vararg_buffer7);
    // unreachable;
   }
   $17 = ($9|0)==(1126902529);
   $18 = ($12|0)==(1129074247);
   $19 = $17 & $18;
   if ($19) {
    $20 = ((($3)) + 44|0);
    $21 = HEAP32[$20>>2]|0;
    $22 = $21;
   } else {
    $22 = $5;
   }
   HEAP32[$0>>2] = $22;
   $23 = HEAP32[$3>>2]|0;
   $24 = ((($23)) + 4|0);
   $25 = HEAP32[$24>>2]|0;
   $26 = HEAP32[7702]|0;
   $27 = ((($26)) + 16|0);
   $28 = HEAP32[$27>>2]|0;
   $29 = (FUNCTION_TABLE_iiii[$28 & 127](30808,$23,$0)|0);
   $30 = HEAP32[7887]|0;
   if ($29) {
    $31 = HEAP32[$0>>2]|0;
    $32 = HEAP32[$31>>2]|0;
    $33 = ((($32)) + 8|0);
    $34 = HEAP32[$33>>2]|0;
    $35 = (FUNCTION_TABLE_ii[$34 & 127]($31)|0);
    HEAP32[$vararg_buffer>>2] = $30;
    $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
    HEAP32[$vararg_ptr1>>2] = $25;
    $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
    HEAP32[$vararg_ptr2>>2] = $35;
    _abort_message(34240,$vararg_buffer);
    // unreachable;
   } else {
    HEAP32[$vararg_buffer3>>2] = $30;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $25;
    _abort_message(34285,$vararg_buffer3);
    // unreachable;
   }
  }
 }
 _abort_message(34364,$vararg_buffer10);
 // unreachable;
}
function ___cxa_get_globals_fast() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $0 = (_pthread_once((37092|0),(81|0))|0);
 $1 = ($0|0)==(0);
 if ($1) {
  $2 = HEAP32[9274]|0;
  $3 = (_pthread_getspecific(($2|0))|0);
  STACKTOP = sp;return ($3|0);
 } else {
  _abort_message(34515,$vararg_buffer);
  // unreachable;
 }
 return (0)|0;
}
function _abort_message($0,$varargs) {
 $0 = $0|0;
 $varargs = $varargs|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 HEAP32[$1>>2] = $varargs;
 $2 = HEAP32[7761]|0;
 (_vfprintf($2,$0,$1)|0);
 (_fputc(10,$2)|0);
 _abort();
 // unreachable;
}
function __ZN10__cxxabiv116__shim_type_infoD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10__cxxabiv117__class_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv116__shim_type_info5noop1Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNK10__cxxabiv116__shim_type_info5noop2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$2 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $3 = sp;
 $4 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,0)|0);
 if ($4) {
  $$2 = 1;
 } else {
  $5 = ($1|0)==(0|0);
  if ($5) {
   $$2 = 0;
  } else {
   $6 = (___dynamic_cast($1,30832,30816,0)|0);
   $7 = ($6|0)==(0|0);
   if ($7) {
    $$2 = 0;
   } else {
    $8 = ((($3)) + 4|0);
    dest=$8; stop=dest+52|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
    HEAP32[$3>>2] = $6;
    $9 = ((($3)) + 8|0);
    HEAP32[$9>>2] = $0;
    $10 = ((($3)) + 12|0);
    HEAP32[$10>>2] = -1;
    $11 = ((($3)) + 48|0);
    HEAP32[$11>>2] = 1;
    $12 = HEAP32[$6>>2]|0;
    $13 = ((($12)) + 28|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = HEAP32[$2>>2]|0;
    FUNCTION_TABLE_viiii[$14 & 31]($6,$3,$15,1);
    $16 = ((($3)) + 24|0);
    $17 = HEAP32[$16>>2]|0;
    $18 = ($17|0)==(1);
    if ($18) {
     $19 = ((($3)) + 16|0);
     $20 = HEAP32[$19>>2]|0;
     HEAP32[$2>>2] = $20;
     $$0 = 1;
    } else {
     $$0 = 0;
    }
    $$2 = $$0;
   }
  }
 }
 STACKTOP = sp;return ($$2|0);
}
function __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$7,$5)|0);
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
 }
 return;
}
function __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$6,$4)|0);
 do {
  if ($7) {
   __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0,$1,$2,$3);
  } else {
   $8 = HEAP32[$1>>2]|0;
   $9 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$8,$4)|0);
   if ($9) {
    $10 = ((($1)) + 16|0);
    $11 = HEAP32[$10>>2]|0;
    $12 = ($11|0)==($2|0);
    $13 = ((($1)) + 32|0);
    if (!($12)) {
     $14 = ((($1)) + 20|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)==($2|0);
     if (!($16)) {
      HEAP32[$13>>2] = $3;
      HEAP32[$14>>2] = $2;
      $18 = ((($1)) + 40|0);
      $19 = HEAP32[$18>>2]|0;
      $20 = (($19) + 1)|0;
      HEAP32[$18>>2] = $20;
      $21 = ((($1)) + 36|0);
      $22 = HEAP32[$21>>2]|0;
      $23 = ($22|0)==(1);
      if ($23) {
       $24 = ((($1)) + 24|0);
       $25 = HEAP32[$24>>2]|0;
       $26 = ($25|0)==(2);
       if ($26) {
        $27 = ((($1)) + 54|0);
        HEAP8[$27>>0] = 1;
       }
      }
      $28 = ((($1)) + 44|0);
      HEAP32[$28>>2] = 4;
      break;
     }
    }
    $17 = ($3|0)==(1);
    if ($17) {
     HEAP32[$13>>2] = 1;
    }
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$5,0)|0);
 if ($6) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
 }
 return;
}
function __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==($1|0);
 return ($3|0);
}
function __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 16|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==(0|0);
 $7 = ((($1)) + 36|0);
 $8 = ((($1)) + 24|0);
 do {
  if ($6) {
   HEAP32[$4>>2] = $2;
   HEAP32[$8>>2] = $3;
   HEAP32[$7>>2] = 1;
  } else {
   $9 = ($5|0)==($2|0);
   if (!($9)) {
    $12 = HEAP32[$7>>2]|0;
    $13 = (($12) + 1)|0;
    HEAP32[$7>>2] = $13;
    HEAP32[$8>>2] = 2;
    $14 = ((($1)) + 54|0);
    HEAP8[$14>>0] = 1;
    break;
   }
   $10 = HEAP32[$8>>2]|0;
   $11 = ($10|0)==(2);
   if ($11) {
    HEAP32[$8>>2] = $3;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==($2|0);
 if ($6) {
  $7 = ((($1)) + 28|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = ($8|0)==(1);
  if (!($9)) {
   HEAP32[$7>>2] = $3;
  }
 }
 return;
}
function __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond22 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 53|0);
 HEAP8[$5>>0] = 1;
 $6 = ((($1)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ($7|0)==($3|0);
 do {
  if ($8) {
   $9 = ((($1)) + 52|0);
   HEAP8[$9>>0] = 1;
   $10 = ((($1)) + 16|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)==(0|0);
   $13 = ((($1)) + 54|0);
   $14 = ((($1)) + 48|0);
   $15 = ((($1)) + 24|0);
   $16 = ((($1)) + 36|0);
   if ($12) {
    HEAP32[$10>>2] = $2;
    HEAP32[$15>>2] = $4;
    HEAP32[$16>>2] = 1;
    $17 = HEAP32[$14>>2]|0;
    $18 = ($17|0)==(1);
    $19 = ($4|0)==(1);
    $or$cond = $18 & $19;
    if (!($or$cond)) {
     break;
    }
    HEAP8[$13>>0] = 1;
    break;
   }
   $20 = ($11|0)==($2|0);
   if (!($20)) {
    $27 = HEAP32[$16>>2]|0;
    $28 = (($27) + 1)|0;
    HEAP32[$16>>2] = $28;
    HEAP8[$13>>0] = 1;
    break;
   }
   $21 = HEAP32[$15>>2]|0;
   $22 = ($21|0)==(2);
   if ($22) {
    HEAP32[$15>>2] = $4;
    $26 = $4;
   } else {
    $26 = $21;
   }
   $23 = HEAP32[$14>>2]|0;
   $24 = ($23|0)==(1);
   $25 = ($26|0)==(1);
   $or$cond22 = $24 & $25;
   if ($or$cond22) {
    HEAP8[$13>>0] = 1;
   }
  }
 } while(0);
 return;
}
function ___dynamic_cast($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$ = 0, $$0 = 0, $$33 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond28 = 0, $or$cond30 = 0, $or$cond32 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $4 = sp;
 $5 = HEAP32[$0>>2]|0;
 $6 = ((($5)) + -8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (($0) + ($7)|0);
 $9 = ((($5)) + -4|0);
 $10 = HEAP32[$9>>2]|0;
 HEAP32[$4>>2] = $2;
 $11 = ((($4)) + 4|0);
 HEAP32[$11>>2] = $0;
 $12 = ((($4)) + 8|0);
 HEAP32[$12>>2] = $1;
 $13 = ((($4)) + 12|0);
 HEAP32[$13>>2] = $3;
 $14 = ((($4)) + 16|0);
 $15 = ((($4)) + 20|0);
 $16 = ((($4)) + 24|0);
 $17 = ((($4)) + 28|0);
 $18 = ((($4)) + 32|0);
 $19 = ((($4)) + 40|0);
 dest=$14; stop=dest+36|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));HEAP16[$14+36>>1]=0|0;HEAP8[$14+38>>0]=0|0;
 $20 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($10,$2,0)|0);
 L1: do {
  if ($20) {
   $21 = ((($4)) + 48|0);
   HEAP32[$21>>2] = 1;
   $22 = HEAP32[$10>>2]|0;
   $23 = ((($22)) + 20|0);
   $24 = HEAP32[$23>>2]|0;
   FUNCTION_TABLE_viiiiii[$24 & 127]($10,$4,$8,$8,1,0);
   $25 = HEAP32[$16>>2]|0;
   $26 = ($25|0)==(1);
   $$ = $26 ? $8 : 0;
   $$0 = $$;
  } else {
   $27 = ((($4)) + 36|0);
   $28 = HEAP32[$10>>2]|0;
   $29 = ((($28)) + 24|0);
   $30 = HEAP32[$29>>2]|0;
   FUNCTION_TABLE_viiiii[$30 & 127]($10,$4,$8,1,0);
   $31 = HEAP32[$27>>2]|0;
   switch ($31|0) {
   case 0:  {
    $32 = HEAP32[$19>>2]|0;
    $33 = ($32|0)==(1);
    $34 = HEAP32[$17>>2]|0;
    $35 = ($34|0)==(1);
    $or$cond = $33 & $35;
    $36 = HEAP32[$18>>2]|0;
    $37 = ($36|0)==(1);
    $or$cond28 = $or$cond & $37;
    $38 = HEAP32[$15>>2]|0;
    $$33 = $or$cond28 ? $38 : 0;
    $$0 = $$33;
    break L1;
    break;
   }
   case 1:  {
    break;
   }
   default: {
    $$0 = 0;
    break L1;
   }
   }
   $39 = HEAP32[$16>>2]|0;
   $40 = ($39|0)==(1);
   if (!($40)) {
    $41 = HEAP32[$19>>2]|0;
    $42 = ($41|0)==(0);
    $43 = HEAP32[$17>>2]|0;
    $44 = ($43|0)==(1);
    $or$cond30 = $42 & $44;
    $45 = HEAP32[$18>>2]|0;
    $46 = ($45|0)==(1);
    $or$cond32 = $or$cond30 & $46;
    if (!($or$cond32)) {
     $$0 = 0;
     break;
    }
   }
   $47 = HEAP32[$14>>2]|0;
   $$0 = $47;
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function __ZN10__cxxabiv120__si_class_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$7,$5)|0);
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
 } else {
  $9 = ((($0)) + 8|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($11)) + 20|0);
  $13 = HEAP32[$12>>2]|0;
  FUNCTION_TABLE_viiiiii[$13 & 127]($10,$1,$2,$3,$4,$5);
 }
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$037$off038 = 0, $$037$off039 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$6,$4)|0);
 do {
  if ($7) {
   __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0,$1,$2,$3);
  } else {
   $8 = HEAP32[$1>>2]|0;
   $9 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$8,$4)|0);
   $10 = ((($0)) + 8|0);
   if (!($9)) {
    $41 = HEAP32[$10>>2]|0;
    $42 = HEAP32[$41>>2]|0;
    $43 = ((($42)) + 24|0);
    $44 = HEAP32[$43>>2]|0;
    FUNCTION_TABLE_viiiii[$44 & 127]($41,$1,$2,$3,$4);
    break;
   }
   $11 = ((($1)) + 16|0);
   $12 = HEAP32[$11>>2]|0;
   $13 = ($12|0)==($2|0);
   $14 = ((($1)) + 32|0);
   if (!($13)) {
    $15 = ((($1)) + 20|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = ($16|0)==($2|0);
    if (!($17)) {
     HEAP32[$14>>2] = $3;
     $19 = ((($1)) + 44|0);
     $20 = HEAP32[$19>>2]|0;
     $21 = ($20|0)==(4);
     if ($21) {
      break;
     }
     $22 = ((($1)) + 52|0);
     HEAP8[$22>>0] = 0;
     $23 = ((($1)) + 53|0);
     HEAP8[$23>>0] = 0;
     $24 = HEAP32[$10>>2]|0;
     $25 = HEAP32[$24>>2]|0;
     $26 = ((($25)) + 20|0);
     $27 = HEAP32[$26>>2]|0;
     FUNCTION_TABLE_viiiiii[$27 & 127]($24,$1,$2,$2,1,$4);
     $28 = HEAP8[$23>>0]|0;
     $29 = ($28<<24>>24)==(0);
     if ($29) {
      $$037$off038 = 4;
      label = 11;
     } else {
      $30 = HEAP8[$22>>0]|0;
      $not$ = ($30<<24>>24)==(0);
      if ($not$) {
       $$037$off038 = 3;
       label = 11;
      } else {
       $$037$off039 = 3;
      }
     }
     if ((label|0) == 11) {
      HEAP32[$15>>2] = $2;
      $31 = ((($1)) + 40|0);
      $32 = HEAP32[$31>>2]|0;
      $33 = (($32) + 1)|0;
      HEAP32[$31>>2] = $33;
      $34 = ((($1)) + 36|0);
      $35 = HEAP32[$34>>2]|0;
      $36 = ($35|0)==(1);
      if ($36) {
       $37 = ((($1)) + 24|0);
       $38 = HEAP32[$37>>2]|0;
       $39 = ($38|0)==(2);
       if ($39) {
        $40 = ((($1)) + 54|0);
        HEAP8[$40>>0] = 1;
        $$037$off039 = $$037$off038;
       } else {
        $$037$off039 = $$037$off038;
       }
      } else {
       $$037$off039 = $$037$off038;
      }
     }
     HEAP32[$19>>2] = $$037$off039;
     break;
    }
   }
   $18 = ($3|0)==(1);
   if ($18) {
    HEAP32[$14>>2] = 1;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$5,0)|0);
 if ($6) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
 } else {
  $7 = ((($0)) + 8|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = HEAP32[$8>>2]|0;
  $10 = ((($9)) + 28|0);
  $11 = HEAP32[$10>>2]|0;
  FUNCTION_TABLE_viiii[$11 & 31]($8,$1,$2,$3);
 }
 return;
}
function __ZNSt9type_infoD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10__cxxabiv112_GLOBAL__N_110construct_Ev() {
 var $0 = 0, $1 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $0 = (_pthread_key_create((37096|0),(82|0))|0);
 $1 = ($0|0)==(0);
 if ($1) {
  STACKTOP = sp;return;
 } else {
  _abort_message(34564,$vararg_buffer);
  // unreachable;
 }
}
function __ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 _free($0);
 $1 = HEAP32[9274]|0;
 $2 = (_pthread_setspecific(($1|0),(0|0))|0);
 $3 = ($2|0)==(0);
 if ($3) {
  STACKTOP = sp;return;
 } else {
  _abort_message(34614,$vararg_buffer);
  // unreachable;
 }
}
function __ZSt9terminatev() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 __THREW__ = 0;
 $0 = (invoke_i(83)|0);
 $1 = __THREW__; __THREW__ = 0;
 $2 = $1&1;
 if ($2) {
  $20 = ___cxa_find_matching_catch_3(0|0)|0;
  $21 = tempRet0;
  ___clang_call_terminate($20);
  // unreachable;
 }
 $3 = ($0|0)==(0|0);
 if (!($3)) {
  $4 = HEAP32[$0>>2]|0;
  $5 = ($4|0)==(0|0);
  if (!($5)) {
   $6 = ((($4)) + 48|0);
   $7 = $6;
   $8 = $7;
   $9 = HEAP32[$8>>2]|0;
   $10 = (($7) + 4)|0;
   $11 = $10;
   $12 = HEAP32[$11>>2]|0;
   $13 = $9 & -256;
   $14 = ($13|0)==(1126902528);
   $15 = ($12|0)==(1129074247);
   $16 = $14 & $15;
   if ($16) {
    $17 = ((($4)) + 12|0);
    $18 = HEAP32[$17>>2]|0;
    __ZSt11__terminatePFvvE($18);
    // unreachable;
   }
  }
 }
 $19 = (__ZSt13get_terminatev()|0);
 __ZSt11__terminatePFvvE($19);
 // unreachable;
}
function __ZSt11__terminatePFvvE($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 __THREW__ = 0;
 invoke_v($0|0);
 $1 = __THREW__; __THREW__ = 0;
 $2 = $1&1;
 if (!($2)) {
  __THREW__ = 0;
  invoke_vii(84,(34667|0),($vararg_buffer|0));
  $3 = __THREW__; __THREW__ = 0;
 }
 $4 = ___cxa_find_matching_catch_3(0|0)|0;
 $5 = tempRet0;
 (___cxa_begin_catch(($4|0))|0);
 __THREW__ = 0;
 invoke_vii(84,(34707|0),($vararg_buffer1|0));
 $6 = __THREW__; __THREW__ = 0;
 $7 = ___cxa_find_matching_catch_3(0|0)|0;
 $8 = tempRet0;
 __THREW__ = 0;
 invoke_v(85);
 $9 = __THREW__; __THREW__ = 0;
 $10 = $9&1;
 if ($10) {
  $11 = ___cxa_find_matching_catch_3(0|0)|0;
  $12 = tempRet0;
  ___clang_call_terminate($11);
  // unreachable;
 } else {
  ___clang_call_terminate($7);
  // unreachable;
 }
}
function __ZSt13get_terminatev() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[7886]|0;HEAP32[7886] = (($0+0)|0);
 $1 = $0;
 return ($1|0);
}
function __ZNSt9bad_allocD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNSt9bad_allocD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZNSt9bad_allocD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNKSt9bad_alloc4whatEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (34757|0);
}
function __ZNSt9exceptionD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNSt11logic_errorD2Ev($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = (31660);
 $1 = ((($0)) + 4|0);
 __ZNSt3__218__libcpp_refstringD2Ev($1);
 return;
}
function __ZNSt11logic_errorD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZNSt11logic_errorD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNKSt11logic_error4whatEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 4|0);
 $2 = (__ZNKSt3__218__libcpp_refstring5c_strEv($1)|0);
 return ($2|0);
}
function __ZNKSt3__218__libcpp_refstring5c_strEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 return ($1|0);
}
function __ZNSt3__218__libcpp_refstringD2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZNKSt3__218__libcpp_refstring15__uses_refcountEv($0)|0);
 if ($1) {
  $2 = HEAP32[$0>>2]|0;
  $3 = (__ZNSt3__215__refstring_imp12_GLOBAL__N_113rep_from_dataEPKc_306($2)|0);
  $4 = ((($3)) + 8|0);
  $5 = HEAP32[$4>>2]|0;HEAP32[$4>>2] = (($5+-1)|0);
  $6 = (($5) + -1)|0;
  $7 = ($6|0)<(0);
  if ($7) {
   __ZdlPv($3);
  }
 }
 return;
}
function __ZNSt3__215__refstring_imp12_GLOBAL__N_113rep_from_dataEPKc_306($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + -12|0);
 return ($1|0);
}
function __ZNSt12length_errorD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZNSt11logic_errorD2Ev($0);
 __ZdlPv($0);
 return;
}
function ___cxa_guard_acquire($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $2 = ($1<<24>>24)==(1);
 if ($2) {
  $$0 = 0;
 } else {
  HEAP8[$0>>0] = 1;
  $$0 = 1;
 }
 return ($$0|0);
}
function ___cxa_guard_release($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNSt9bad_allocC2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = (31640);
 return;
}
function __ZSt15get_new_handlerv() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[9275]|0;HEAP32[9275] = (($0+0)|0);
 $1 = $0;
 return ($1|0);
}
function ___cxa_can_catch($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = sp;
 $4 = HEAP32[$2>>2]|0;
 HEAP32[$3>>2] = $4;
 $5 = HEAP32[$0>>2]|0;
 $6 = ((($5)) + 16|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (FUNCTION_TABLE_iiii[$7 & 127]($0,$1,$3)|0);
 $9 = $8&1;
 if ($8) {
  $10 = HEAP32[$3>>2]|0;
  HEAP32[$2>>2] = $10;
 }
 STACKTOP = sp;return ($9|0);
}
function ___cxa_is_pointer_type($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $4 = 0;
 } else {
  $2 = (___dynamic_cast($0,30832,30936,0)|0);
  $phitmp = ($2|0)!=(0|0);
  $4 = $phitmp;
 }
 $3 = $4&1;
 return ($3|0);
}
function runPostSets() {
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}
function _llvm_cttz_i32(x) {
    x = x|0;
    var ret = 0;
    ret = ((HEAP8[(((cttz_i8)+(x & 0xff))>>0)])|0);
    if ((ret|0) < 8) return ret|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 8)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 8)|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 16)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 16)|0;
    return (((HEAP8[(((cttz_i8)+(x >>> 24))>>0)])|0) + 24)|0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    $rem = $rem | 0;
    var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
    $n_sroa_0_0_extract_trunc = $a$0;
    $n_sroa_1_4_extract_shift$0 = $a$1;
    $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
    $d_sroa_0_0_extract_trunc = $b$0;
    $d_sroa_1_4_extract_shift$0 = $b$1;
    $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
    if (($n_sroa_1_4_extract_trunc | 0) == 0) {
      $4 = ($rem | 0) != 0;
      if (($d_sroa_1_4_extract_trunc | 0) == 0) {
        if ($4) {
          HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$4) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
    $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
    do {
      if (($d_sroa_0_0_extract_trunc | 0) == 0) {
        if ($17) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
            HEAP32[$rem + 4 >> 2] = 0;
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        if (($n_sroa_0_0_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0;
            HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
        if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0 | $a$0 & -1;
            HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
          }
          $_0$1 = 0;
          $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($51 >>> 0 <= 30) {
          $57 = $51 + 1 | 0;
          $58 = 31 - $51 | 0;
          $sr_1_ph = $57;
          $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$17) {
          $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
          $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          if ($119 >>> 0 <= 31) {
            $125 = $119 + 1 | 0;
            $126 = 31 - $119 | 0;
            $130 = $119 - 31 >> 31;
            $sr_1_ph = $125;
            $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
            $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
            $q_sroa_0_1_ph = 0;
            $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
            break;
          }
          if (($rem | 0) == 0) {
            $_0$1 = 0;
            $_0$0 = 0;
            return (tempRet0 = $_0$1, $_0$0) | 0;
          }
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
        if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
          $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
          $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          $89 = 64 - $88 | 0;
          $91 = 32 - $88 | 0;
          $92 = $91 >> 31;
          $95 = $88 - 32 | 0;
          $105 = $95 >> 31;
          $sr_1_ph = $88;
          $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
          $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
          $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
          $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
          break;
        }
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
          HEAP32[$rem + 4 >> 2] = 0;
        }
        if (($d_sroa_0_0_extract_trunc | 0) == 1) {
          $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$0 = 0 | $a$0 & -1;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        } else {
          $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
          $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
          $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
      }
    } while (0);
    if (($sr_1_ph | 0) == 0) {
      $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
      $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
      $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
      $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = 0;
    } else {
      $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
      $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
      $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
      $137$1 = tempRet0;
      $q_sroa_1_1198 = $q_sroa_1_1_ph;
      $q_sroa_0_1199 = $q_sroa_0_1_ph;
      $r_sroa_1_1200 = $r_sroa_1_1_ph;
      $r_sroa_0_1201 = $r_sroa_0_1_ph;
      $sr_1202 = $sr_1_ph;
      $carry_0203 = 0;
      while (1) {
        $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
        $149 = $carry_0203 | $q_sroa_0_1199 << 1;
        $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
        $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
        _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
        $150$1 = tempRet0;
        $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
        $152 = $151$0 & 1;
        $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
        $r_sroa_0_0_extract_trunc = $154$0;
        $r_sroa_1_4_extract_trunc = tempRet0;
        $155 = $sr_1202 - 1 | 0;
        if (($155 | 0) == 0) {
          break;
        } else {
          $q_sroa_1_1198 = $147;
          $q_sroa_0_1199 = $149;
          $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
          $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
          $sr_1202 = $155;
          $carry_0203 = $152;
        }
      }
      $q_sroa_1_1_lcssa = $147;
      $q_sroa_0_1_lcssa = $149;
      $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
      $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = $152;
    }
    $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
    $q_sroa_0_0_insert_ext75$1 = 0;
    $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
    if (($rem | 0) != 0) {
      HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
      HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
    }
    $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
    $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $1$0 = 0;
    $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
    return $1$0 | 0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    increment = ((increment + 15) & -16)|0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        ___setErrNo(12);
        return -1;
      }
    }
    return oldDynamicTop|0;
}
function _memmove(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    if (((src|0) < (dest|0)) & ((dest|0) < ((src + num)|0))) {
      // Unlikely case: Copy backwards in a safe manner
      ret = dest;
      src = (src + num)|0;
      dest = (dest + num)|0;
      while ((num|0) > 0) {
        dest = (dest - 1)|0;
        src = (src - 1)|0;
        num = (num - 1)|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      }
      dest = ret;
    } else {
      _memcpy(dest, src, num) | 0;
    }
    return dest | 0;
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $rem = 0, __stackBase__ = 0;
    __stackBase__ = STACKTOP;
    STACKTOP = STACKTOP + 16 | 0;
    $rem = __stackBase__ | 0;
    ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
    STACKTOP = __stackBase__;
    return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}
function _llvm_bswap_i32(x) {
    x = x|0;
    return (((x&0xff)<<24) | (((x>>8)&0xff)<<16) | (((x>>16)&0xff)<<8) | (x>>>24))|0;
}

  
function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&127](a1|0,a2|0,a3|0)|0;
}


function dynCall_iiididd(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=+a3; a4=a4|0; a5=+a5; a6=+a6;
  return FUNCTION_TABLE_iiididd[index&63](a1|0,a2|0,+a3,a4|0,+a5,+a6)|0;
}


function dynCall_viiidd(index,a1,a2,a3,a4,a5) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=+a4; a5=+a5;
  FUNCTION_TABLE_viiidd[index&63](a1|0,a2|0,a3|0,+a4,+a5);
}


function dynCall_did(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=+a2;
  return +FUNCTION_TABLE_did[index&127](a1|0,+a2);
}


function dynCall_vi(index,a1) {
  index = index|0;
  a1=a1|0;
  FUNCTION_TABLE_vi[index&127](a1|0);
}


function dynCall_viiidi(index,a1,a2,a3,a4,a5) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=+a4; a5=a5|0;
  FUNCTION_TABLE_viiidi[index&63](a1|0,a2|0,a3|0,+a4,a5|0);
}


function dynCall_vii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  FUNCTION_TABLE_vii[index&127](a1|0,a2|0);
}


function dynCall_iiiidii(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=+a4; a5=a5|0; a6=a6|0;
  return FUNCTION_TABLE_iiiidii[index&63](a1|0,a2|0,a3|0,+a4,a5|0,a6|0)|0;
}


function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&127](a1|0)|0;
}


function dynCall_i(index) {
  index = index|0;
  
  return FUNCTION_TABLE_i[index&127]()|0;
}


function dynCall_viiid(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=+a4;
  FUNCTION_TABLE_viiid[index&63](a1|0,a2|0,a3|0,+a4);
}


function dynCall_viiiiid(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=+a6;
  FUNCTION_TABLE_viiiiid[index&63](a1|0,a2|0,a3|0,a4|0,a5|0,+a6);
}


function dynCall_v(index) {
  index = index|0;
  
  FUNCTION_TABLE_v[index&127]();
}


function dynCall_iiiii(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return FUNCTION_TABLE_iiiii[index&127](a1|0,a2|0,a3|0,a4|0)|0;
}


function dynCall_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  FUNCTION_TABLE_viiiiii[index&127](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0);
}


function dynCall_viiiii(index,a1,a2,a3,a4,a5) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  FUNCTION_TABLE_viiiii[index&127](a1|0,a2|0,a3|0,a4|0,a5|0);
}


function dynCall_iiiid(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=+a4;
  return FUNCTION_TABLE_iiiid[index&63](a1|0,a2|0,a3|0,+a4)|0;
}


function dynCall_viiii(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  FUNCTION_TABLE_viiii[index&31](a1|0,a2|0,a3|0,a4|0);
}

function b0(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(0);return 0;
}
function b1(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = +p2;p3 = p3|0;p4 = +p4;p5 = +p5; nullFunc_iiididd(1);return 0;
}
function b2(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = +p3;p4 = +p4; nullFunc_viiidd(2);
}
function b3(p0,p1) {
 p0 = p0|0;p1 = +p1; nullFunc_did(3);return +0;
}
function b4(p0) {
 p0 = p0|0; nullFunc_vi(4);
}
function b5(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = +p3;p4 = p4|0; nullFunc_viiidi(5);
}
function b6(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_vii(6);
}
function b7(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = +p3;p4 = p4|0;p5 = p5|0; nullFunc_iiiidii(7);return 0;
}
function b8(p0) {
 p0 = p0|0; nullFunc_ii(8);return 0;
}
function b9() {
 ; nullFunc_i(9);return 0;
}
function b10(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = +p3; nullFunc_viiid(10);
}
function b11(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = +p5; nullFunc_viiiiid(11);
}
function b12() {
 ; nullFunc_v(12);
}
function ___cxa_end_catch__wrapper() {
 ; ___cxa_end_catch();
}
function b13(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(13);return 0;
}
function b14(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_viiiiii(14);
}
function b15(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_viiiii(15);
}
function b16(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = +p3; nullFunc_iiiid(16);return 0;
}
function b17(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_viiii(17);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_iiii = [b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,___stdio_write,___stdio_seek,___stdout_write,b0,b0,b0,b0,b0,__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv,b0,b0,b0,b0,b0,b0,b0,b0
,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,__ZNK13EcgAnnotation7IsNoiseEPKdi,b0,b0,b0,b0,b0,__ZNK13EcgAnnotation8FindTmaxEPKdi,b0,b0,b0,b0,b0,b0,b0,b0
,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,__ZN3FWT9GetJnumbsEii,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0
,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0
,b0,b0,b0,b0,b0,b0,b0,b0,b0];
var FUNCTION_TABLE_iiididd = [b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1
,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,__ZN3CWT8CwtTransEPKddbdd,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1
,b1,b1,b1,b1,b1];
var FUNCTION_TABLE_viiidd = [b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2
,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,__ZN3CWT7InitCWTEiNS_7WAVELETEdd,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2
,b2,b2,b2,b2,b2];
var FUNCTION_TABLE_did = [b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3
,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3
,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,__ZNK6Signal4log2Ed,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3
,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3
,b3,b3,b3,b3,b3,b3,b3,b3,b3];
var FUNCTION_TABLE_vi = [b4,__ZN6SignalD2Ev,__ZN6SignalD0Ev,__ZN3FWTD2Ev,__ZN3FWTD0Ev,__ZN10EcgDenoiseD2Ev,__ZN10EcgDenoiseD0Ev,__ZN3CWTD2Ev,__ZN3CWTD0Ev,__ZN13EcgAnnotationD2Ev,__ZN13EcgAnnotationD0Ev,b4,b4,b4,b4,b4,__ZN10__cxxabiv116__shim_type_infoD2Ev,__ZN10__cxxabiv117__class_type_infoD0Ev,__ZNK10__cxxabiv116__shim_type_info5noop1Ev,__ZNK10__cxxabiv116__shim_type_info5noop2Ev,b4,b4,b4,b4,__ZN10__cxxabiv120__si_class_type_infoD0Ev,b4,b4,b4,__ZNSt9bad_allocD2Ev
,__ZNSt9bad_allocD0Ev,b4,__ZNSt11logic_errorD2Ev,__ZNSt11logic_errorD0Ev,b4,__ZNSt12length_errorD0Ev,_free,__ZNSt3__26vectorIiNS_9allocatorIiEEED2Ev,b4,b4,b4,b4,b4,b4,b4,b4,b4,__ZNSt3__26vectorIdNS_9allocatorIdEEED2Ev,b4,b4,b4,b4,__ZN3CWT8CloseCWTEv,b4,b4,__ZN10EcgDenoiseC2Ev,b4,b4,b4,b4
,b4,b4,__ZNSt3__26vectorIcNS_9allocatorIcEEED2Ev,b4,__ZNSt3__214__split_bufferIiRNS_9allocatorIiEEED2Ev,b4,__ZNSt3__214__split_bufferIcRNS_9allocatorIcEEED2Ev,b4,b4,__ZNSt3__214__split_bufferIdRNS_9allocatorIdEEED2Ev,__ZN3FWTC2Ev,b4,b4,b4,b4,b4,b4,b4,b4,b4,__ZN3FWT8CloseFWTEv,b4,b4,__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4,b4,b4,b4,b4];
var FUNCTION_TABLE_viiidi = [b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5
,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,__ZN10EcgDenoise11InitDenoiseEPdidb,b5,b5,b5
,b5,b5,b5,b5,b5];
var FUNCTION_TABLE_vii = [b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6
,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,__ZNSt3__26vectorIiNS_9allocatorIiEEE21__push_back_slow_pathIKiEEvRT_,b6,__ZNSt3__26vectorIdNS_9allocatorIdEEE21__push_back_slow_pathIKdEEvRT_,b6,b6,b6,b6,b6,b6,__ZNSt3__26vectorIcNS_9allocatorIcEEE21__push_back_slow_pathIKcEEvRT_,b6,b6,b6,b6,b6,b6
,b6,b6,b6,__ZNSt3__26vectorIiNS_9allocatorIiEEE26__swap_out_circular_bufferERNS_14__split_bufferIiRS2_EE,b6,__ZNSt3__26vectorIcNS_9allocatorIcEEE26__swap_out_circular_bufferERNS_14__split_bufferIcRS2_EE,b6,__ZNSt11logic_errorC2EPKc,__ZNSt3__26vectorIdNS_9allocatorIdEEE26__swap_out_circular_bufferERNS_14__split_bufferIdRS2_EE,b6,b6,b6,b6,__ZN3FWT8FwtTransEi,b6,b6,b6,b6,__ZN3FWT8FwtSynthEi,b6,b6,__ZNSt3__218__libcpp_refstringC2EPKc,b6,b6,b6,_abort_message,b6,b6,b6,b6
,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6
,b6,b6,b6,b6,b6,b6,b6,b6,b6];
var FUNCTION_TABLE_iiiidii = [b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7
,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,__ZN13EcgAnnotation6GetPTUEPKdidPPii,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7
,b7,b7,b7,b7,b7];
var FUNCTION_TABLE_ii = [b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,___stdio_close,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8
,b8,__ZNKSt9bad_alloc4whatEv,b8,b8,__ZNKSt11logic_error4whatEv,b8,b8,b8,b8,__ZNK13EcgAnnotation12GetQrsNumberEv,b8,b8,__ZNK13EcgAnnotation20GetEcgAnnotationSizeEv,__Znaj,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,_malloc,b8,b8,__ZN10EcgDenoise9LFDenoiseEv,b8,b8
,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,__ZNK3FWT14GetFwtSpectrumEv,b8,b8,__ZNK3FWT13GetLoBandSizeEv,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8
,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8
,b8,b8,b8,b8,b8,b8,b8,b8,b8];
var FUNCTION_TABLE_i = [b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,___cxa_get_globals_fast,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9];
var FUNCTION_TABLE_viiid = [b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10
,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,__ZNK13EcgAnnotation11GetEctopicsEPPiid,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10
,b10,b10,b10,b10,b10];
var FUNCTION_TABLE_viiiiid = [b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11
,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,__ZNK13EcgAnnotation6FindRSEPKdiRiS2_d,b11
,b11,b11,b11,b11,b11];
var FUNCTION_TABLE_v = [b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,__ZL25default_terminate_handlerv,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12
,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12
,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev,b12,b12,b12,___cxa_end_catch__wrapper,b12,b12,b12
,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12
,b12,b12,b12,b12,b12,b12,b12,b12,b12];
var FUNCTION_TABLE_iiiii = [b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13
,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13
,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,__ZN3FWT7InitFWTE10FilterEnumPKdi,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13
,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13
,b13,b13,b13,b13,b13,b13,b13,b13,b13];
var FUNCTION_TABLE_viiiiii = [b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b14,b14,b14,__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b14,b14,b14
,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14
,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,__ZNK6Signal7DenoiseEPdiiib,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14
,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14
,b14,b14,b14,b14,b14,b14,b14,b14,b14];
var FUNCTION_TABLE_viiiii = [b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b15,b15,b15,__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b15,b15
,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,__ZNK6Signal6MinMaxEPKdiRdS2_,b15,b15,b15,b15,b15,b15,b15,b15,b15
,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,__ZNK3FWT9HiLoNumbsEiiRiS0_,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15
,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15
,b15,b15,b15,b15,b15,b15,b15,b15,b15];
var FUNCTION_TABLE_iiiid = [b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16
,b16,b16,b16,b16,b16,b16,b16,b16,__ZN13EcgAnnotation6GetQRSEPKdid,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,b16,__ZNK13EcgAnnotation5FindsEPKdid
,__ZNK13EcgAnnotation5FindqEPKdid,__ZNK13EcgAnnotation5FindrEPKdid,b16,b16,b16];
var FUNCTION_TABLE_viiii = [b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,b17,__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b17,b17,b17,__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b17
,b17,b17,b17];

  return { stackSave: stackSave, getTempRet0: getTempRet0, _memset: _memset, _ExpGetAllAnnotations: _ExpGetAllAnnotations, setThrew: setThrew, _bitshift64Lshr: _bitshift64Lshr, _bitshift64Shl: _bitshift64Shl, _ResetBDAC: _ResetBDAC, ___cxa_is_pointer_type: ___cxa_is_pointer_type, _llvm_cttz_i32: _llvm_cttz_i32, _sbrk: _sbrk, _memcpy: _memcpy, ___errno_location: ___errno_location, ___uremdi3: ___uremdi3, stackAlloc: stackAlloc, _i64Subtract: _i64Subtract, ___udivmoddi4: ___udivmoddi4, setTempRet0: setTempRet0, _i64Add: _i64Add, _emscripten_get_global_libc: _emscripten_get_global_libc, _fflush: _fflush, ___udivdi3: ___udivdi3, _llvm_bswap_i32: _llvm_bswap_i32, _BeatDetectAndClassify: _BeatDetectAndClassify, ___cxa_can_catch: ___cxa_can_catch, _free: _free, runPostSets: runPostSets, establishStackSpace: establishStackSpace, _memmove: _memmove, stackRestore: stackRestore, _malloc: _malloc, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_iiii: dynCall_iiii, dynCall_iiididd: dynCall_iiididd, dynCall_viiidd: dynCall_viiidd, dynCall_did: dynCall_did, dynCall_vi: dynCall_vi, dynCall_viiidi: dynCall_viiidi, dynCall_vii: dynCall_vii, dynCall_iiiidii: dynCall_iiiidii, dynCall_ii: dynCall_ii, dynCall_i: dynCall_i, dynCall_viiid: dynCall_viiid, dynCall_viiiiid: dynCall_viiiiid, dynCall_v: dynCall_v, dynCall_iiiii: dynCall_iiiii, dynCall_viiiiii: dynCall_viiiiii, dynCall_viiiii: dynCall_viiiii, dynCall_iiiid: dynCall_iiiid, dynCall_viiii: dynCall_viiii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_stackSave.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_getTempRet0.apply(null, arguments);
};

var real__ExpGetAllAnnotations = asm["_ExpGetAllAnnotations"]; asm["_ExpGetAllAnnotations"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__ExpGetAllAnnotations.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_setThrew.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"]; asm["_bitshift64Lshr"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__bitshift64Lshr.apply(null, arguments);
};

var real__bitshift64Shl = asm["_bitshift64Shl"]; asm["_bitshift64Shl"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__bitshift64Shl.apply(null, arguments);
};

var real__ResetBDAC = asm["_ResetBDAC"]; asm["_ResetBDAC"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__ResetBDAC.apply(null, arguments);
};

var real____cxa_is_pointer_type = asm["___cxa_is_pointer_type"]; asm["___cxa_is_pointer_type"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____cxa_is_pointer_type.apply(null, arguments);
};

var real__llvm_cttz_i32 = asm["_llvm_cttz_i32"]; asm["_llvm_cttz_i32"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__llvm_cttz_i32.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__sbrk.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____errno_location.apply(null, arguments);
};

var real____uremdi3 = asm["___uremdi3"]; asm["___uremdi3"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____uremdi3.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_stackAlloc.apply(null, arguments);
};

var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Subtract.apply(null, arguments);
};

var real____udivmoddi4 = asm["___udivmoddi4"]; asm["___udivmoddi4"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____udivmoddi4.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_setTempRet0.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Add.apply(null, arguments);
};

var real__emscripten_get_global_libc = asm["_emscripten_get_global_libc"]; asm["_emscripten_get_global_libc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__emscripten_get_global_libc.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__fflush.apply(null, arguments);
};

var real____udivdi3 = asm["___udivdi3"]; asm["___udivdi3"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____udivdi3.apply(null, arguments);
};

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"]; asm["_llvm_bswap_i32"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__llvm_bswap_i32.apply(null, arguments);
};

var real__BeatDetectAndClassify = asm["_BeatDetectAndClassify"]; asm["_BeatDetectAndClassify"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__BeatDetectAndClassify.apply(null, arguments);
};

var real____cxa_can_catch = asm["___cxa_can_catch"]; asm["___cxa_can_catch"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____cxa_can_catch.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__free.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_establishStackSpace.apply(null, arguments);
};

var real__memmove = asm["_memmove"]; asm["_memmove"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__memmove.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real_stackRestore.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__malloc.apply(null, arguments);
};
var stackSave = Module["stackSave"] = asm["stackSave"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var _memset = Module["_memset"] = asm["_memset"];
var _ExpGetAllAnnotations = Module["_ExpGetAllAnnotations"] = asm["_ExpGetAllAnnotations"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var _ResetBDAC = Module["_ResetBDAC"] = asm["_ResetBDAC"];
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = asm["___cxa_is_pointer_type"];
var _llvm_cttz_i32 = Module["_llvm_cttz_i32"] = asm["_llvm_cttz_i32"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var ___udivmoddi4 = Module["___udivmoddi4"] = asm["___udivmoddi4"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _emscripten_get_global_libc = Module["_emscripten_get_global_libc"] = asm["_emscripten_get_global_libc"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];
var _BeatDetectAndClassify = Module["_BeatDetectAndClassify"] = asm["_BeatDetectAndClassify"];
var ___cxa_can_catch = Module["___cxa_can_catch"] = asm["___cxa_can_catch"];
var _free = Module["_free"] = asm["_free"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var _memmove = Module["_memmove"] = asm["_memmove"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_iiididd = Module["dynCall_iiididd"] = asm["dynCall_iiididd"];
var dynCall_viiidd = Module["dynCall_viiidd"] = asm["dynCall_viiidd"];
var dynCall_did = Module["dynCall_did"] = asm["dynCall_did"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_viiidi = Module["dynCall_viiidi"] = asm["dynCall_viiidi"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_iiiidii = Module["dynCall_iiiidii"] = asm["dynCall_iiiidii"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_viiid = Module["dynCall_viiid"] = asm["dynCall_viiid"];
var dynCall_viiiiid = Module["dynCall_viiiiid"] = asm["dynCall_viiiiid"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_iiiid = Module["dynCall_iiiid"] = asm["dynCall_iiiid"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
;
Runtime.stackAlloc = Module['stackAlloc'];
Runtime.stackSave = Module['stackSave'];
Runtime.stackRestore = Module['stackRestore'];
Runtime.establishStackSpace = Module['establishStackSpace'];
Runtime.setTempRet0 = Module['setTempRet0'];
Runtime.getTempRet0 = Module['getTempRet0'];


// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;






/**
 * @constructor
 * @extends {Error}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      Module.printErr('exception thrown: ' + toLog);
      Module['quit'](1, e);
    }
  } finally {
    calledMain = true;
  }
}




/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
      Module.printErr('pre-main prep time: ' + (Date.now() - preloadStartTime) + ' ms');
    }

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') implicitly called by end of main(), but noExitRuntime, so not exiting the runtime (you can use emscripten_force_exit, if you want to force a true shutdown)');
    return;
  }

  if (Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') called, but noExitRuntime, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)');
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}
