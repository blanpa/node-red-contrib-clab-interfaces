/**
 * Serial Helper Tests
 */

const assert = require('assert');

describe('Serial Helper', function() {
    let SerialHelper;
    
    before(function() {
        SerialHelper = require('../lib/serial-helper');
    });
    
    describe('Initialization', function() {
        it('should create instance without errors', function() {
            const helper = new SerialHelper();
            assert(helper);
        });
        
        it('should accept device type option', function() {
            const helper = new SerialHelper('IOT-GATE-iMX8');
            assert(helper);
            assert(helper.mapping);
        });
    });
    
    describe('Serial Mappings', function() {
        it('should have mappings for IOT-GATE-iMX8', function() {
            const helper = new SerialHelper('IOT-GATE-iMX8');
            assert(helper.mapping);
            assert(helper.mapping.backpanel || helper.mapping.console);
        });
        
        it('should have mappings for IOT-LINK', function() {
            const helper = new SerialHelper('IOT-LINK');
            assert(helper.mapping);
        });
        
        it('should have mappings for IOT-DIN-IMX8PLUS', function() {
            const helper = new SerialHelper('IOT-DIN-IMX8PLUS');
            assert(helper.mapping);
        });
    });
    
    describe('Port Paths', function() {
        it('should have valid port paths for IOT-GATE-iMX8', function() {
            const helper = new SerialHelper('IOT-GATE-iMX8');
            const mapping = helper.mapping;
            
            // Check that port paths start with /dev/
            if (mapping.backpanel) {
                assert(mapping.backpanel.startsWith('/dev/'));
            }
            if (mapping.console) {
                assert(mapping.console.startsWith('/dev/'));
            }
        });
        
        it('should have ttyLP ports for IOT-LINK', function() {
            const helper = new SerialHelper('IOT-LINK');
            const mapping = helper.mapping;
            
            // IOT-LINK uses ttyLP* ports
            const hasLpPort = Object.values(mapping).some(
                v => typeof v === 'string' && v.includes('ttyLP')
            );
            assert(hasLpPort, 'IOT-LINK should have ttyLP ports');
        });
    });
});
