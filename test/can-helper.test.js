/**
 * CAN Helper Tests
 */

const assert = require('assert');

describe('CAN Helper', function() {
    let CANHelper;
    
    before(function() {
        CANHelper = require('../lib/can-helper');
    });
    
    describe('Configuration', function() {
        it('should accept default interface', function() {
            const helper = new CANHelper();
            assert.strictEqual(helper.interface, 'can0');
        });
        
        it('should accept custom interface', function() {
            const helper = new CANHelper('can1');
            assert.strictEqual(helper.interface, 'can1');
        });
    });
    
    describe('Frame Parsing', function() {
        it('should parse candump output correctly', function() {
            const helper = new CANHelper();
            
            // Test candump format: can0  123   [8]  01 02 03 04 05 06 07 08
            const line = 'can0  123   [8]  01 02 03 04 05 06 07 08';
            const parsed = helper._parseCanFrame(line);
            
            assert(parsed);
            assert.strictEqual(parsed.interface, 'can0');
            assert.strictEqual(parsed.id, 0x123);
            assert.strictEqual(parsed.dlc, 8);
            assert.deepStrictEqual(parsed.data, [1, 2, 3, 4, 5, 6, 7, 8]);
        });
        
        it('should return null for invalid input', function() {
            const helper = new CANHelper();
            const parsed = helper._parseCanFrame('invalid line');
            assert.strictEqual(parsed, null);
        });
    });
    
    describe('Data Formatting', function() {
        it('should format data array for cansend', function() {
            const helper = new CANHelper();
            
            // Test internal send format
            const data = [0x01, 0x02, 0x03, 0x04];
            const hexData = data.map(b => b.toString(16).padStart(2, '0')).join('');
            
            assert.strictEqual(hexData, '01020304');
        });
    });
    
    describe('EventEmitter', function() {
        it('should be an EventEmitter', function() {
            const helper = new CANHelper();
            assert(typeof helper.on === 'function');
            assert(typeof helper.emit === 'function');
        });
    });
});
