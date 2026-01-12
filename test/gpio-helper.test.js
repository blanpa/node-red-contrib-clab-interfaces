/**
 * GPIO Helper Tests
 */

const assert = require('assert');

describe('GPIO Helper', function() {
    let GpioHelper;
    
    before(function() {
        GpioHelper = require('../lib/gpio-helper');
    });
    
    describe('Initialization', function() {
        it('should create instance without errors', function() {
            const helper = new GpioHelper();
            assert(helper);
        });
        
        it('should accept device option', function() {
            const helper = new GpioHelper('IOT-GATE-iMX8');
            assert(helper);
        });
    });
    
    describe('GPIO Mappings', function() {
        it('should have mappings for IOT-GATE-iMX8', function() {
            const helper = new GpioHelper('IOT-GATE-iMX8');
            assert(helper.mapping);
            assert(helper.mapping.inputs);
            assert(helper.mapping.outputs);
        });
        
        it('should have mappings for IOT-GATE-RPi', function() {
            const helper = new GpioHelper('IOT-GATE-RPi');
            assert(helper.mapping);
        });
        
        it('should default to IOT-GATE-iMX8', function() {
            const helper = new GpioHelper();
            assert(helper.mapping);
            assert(helper.mapping.inputs);
        });
    });
    
    describe('Input/Output Names', function() {
        it('should have input names for IOT-GATE-iMX8', function() {
            const helper = new GpioHelper('IOT-GATE-iMX8');
            const inputs = Object.keys(helper.mapping.inputs);
            
            assert(inputs.length > 0);
            assert(inputs.includes('IN0') || inputs.includes('DI0'));
        });
        
        it('should have output names for IOT-GATE-iMX8', function() {
            const helper = new GpioHelper('IOT-GATE-iMX8');
            const outputs = Object.keys(helper.mapping.outputs);
            
            assert(outputs.length > 0);
            assert(outputs.includes('OUT0') || outputs.includes('DO0'));
        });
    });
});
