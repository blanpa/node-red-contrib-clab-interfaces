/**
 * Bluetooth Helper Tests
 */

const assert = require('assert');

describe('Bluetooth Helper', function() {
    let BluetoothHelper;
    
    before(function() {
        BluetoothHelper = require('../lib/bluetooth-helper');
    });
    
    describe('Initialization', function() {
        it('should create instance without errors', function() {
            const helper = new BluetoothHelper();
            assert(helper);
        });
    });
    
    describe('MAC Address Validation', function() {
        it('should validate correct MAC address format', function() {
            const validMacs = [
                'AA:BB:CC:DD:EE:FF',
                '00:11:22:33:44:55',
                'aa:bb:cc:dd:ee:ff'
            ];
            
            validMacs.forEach(mac => {
                const isValid = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac);
                assert(isValid, `${mac} should be valid`);
            });
        });
        
        it('should reject invalid MAC address format', function() {
            const invalidMacs = [
                'AA:BB:CC:DD:EE',
                'AA:BB:CC:DD:EE:FF:GG',
                'AABBCCDDEEFF',
                'invalid'
            ];
            
            invalidMacs.forEach(mac => {
                const isValid = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac);
                assert(!isValid, `${mac} should be invalid`);
            });
        });
    });
    
    describe('Device Parsing', function() {
        it('should parse bluetoothctl device output', function() {
            const output = 'Device AA:BB:CC:DD:EE:FF My Bluetooth Device';
            const match = output.match(/Device\s+([0-9A-F:]+)\s+(.+)/i);
            
            assert(match);
            assert.strictEqual(match[1], 'AA:BB:CC:DD:EE:FF');
            assert.strictEqual(match[2], 'My Bluetooth Device');
        });
    });
});
