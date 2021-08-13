'use strict';

const initEVM = require('./init/evm');
const initTezos = require('./init/tezos');

function importTest(name, path) {
  describe(name, function() {
    require(path);
  });
};

describe('tokenbridge test suite', function() {
  this.timeout(60000);
  before(function(done) {
    global.config = {evm: {}, tezos: {}};
    initEVM(() => {
      initTezos(() => {
        done();
      });
    });
  });

  beforeEach(function() {
    // console.log('running something before each test');
  });

  importTest('TokenBridge', './TokenBridge/test');

  after(function(done) {
    console.log('All tests executed');
    done();
  });
});
