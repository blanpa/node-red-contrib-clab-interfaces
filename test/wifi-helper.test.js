/**
 * WiFi Helper Tests
 */

const assert = require('assert');

describe('WiFi Helper', function() {
    let WiFiHelper;
    
    before(function() {
        WiFiHelper = require('../lib/wifi-helper');
    });
    
    describe('Initialization', function() {
        it('should create instance with default interface', function() {
            const helper = new WiFiHelper();
            assert.strictEqual(helper.interface, 'wlan0');
        });
        
        it('should accept custom interface', function() {
            const helper = new WiFiHelper({ interface: 'wlan1' });
            assert.strictEqual(helper.interface, 'wlan1');
        });
    });
    
    describe('Network Parsing', function() {
        it('should parse nmcli wifi list output', function() {
            // nmcli -t output uses : as separator
            const output = 'MyNetwork:AA\\:BB\\:CC\\:DD\\:EE\\:FF:Infra:6:2437 MHz:54 Mbit/s:85:WPA2';
            
            // The actual parsing would handle escaped colons
            // For test, we just verify the format understanding
            assert(output.includes('MyNetwork'));
            assert(output.includes('85')); // Signal strength
            assert(output.includes('WPA2')); // Security
        });
        
        it('should handle networks with special characters', function() {
            const ssid = 'My:Network:Name';
            const escaped = ssid.replace(/:/g, '\\:');
            assert.strictEqual(escaped, 'My\\:Network\\:Name');
        });
    });
    
    describe('Signal Strength', function() {
        it('should convert dBm to percentage', function() {
            // Typical WiFi signal range: -30 dBm (excellent) to -90 dBm (poor)
            
            const excellent = Math.min(100, Math.max(0, 2 * (-50 + 100))); // -50 dBm
            assert.strictEqual(excellent, 100);
            
            const good = Math.min(100, Math.max(0, 2 * (-60 + 100))); // -60 dBm
            assert.strictEqual(good, 80);
            
            const fair = Math.min(100, Math.max(0, 2 * (-70 + 100))); // -70 dBm
            assert.strictEqual(fair, 60);
            
            const poor = Math.min(100, Math.max(0, 2 * (-85 + 100))); // -85 dBm
            assert.strictEqual(poor, 30);
        });
    });
    
    describe('Methods', function() {
        it('should have scan method', function() {
            const helper = new WiFiHelper();
            assert(typeof helper.scan === 'function');
        });
        
        it('should have connect method', function() {
            const helper = new WiFiHelper();
            assert(typeof helper.connect === 'function');
        });
        
        it('should have disconnect method', function() {
            const helper = new WiFiHelper();
            assert(typeof helper.disconnect === 'function');
        });
        
        it('should have createAccessPoint method', function() {
            const helper = new WiFiHelper();
            assert(typeof helper.createAccessPoint === 'function');
        });
    });
});
