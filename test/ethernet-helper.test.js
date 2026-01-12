/**
 * Ethernet Helper Tests
 */

const assert = require('assert');

describe('Ethernet Helper', function() {
    let EthernetHelper;
    
    before(function() {
        EthernetHelper = require('../lib/ethernet-helper');
    });
    
    describe('Initialization', function() {
        it('should create instance with default interface', function() {
            const helper = new EthernetHelper();
            assert.strictEqual(helper.interface, 'eth0');
        });
        
        it('should accept custom interface', function() {
            const helper = new EthernetHelper({ interface: 'eth1' });
            assert.strictEqual(helper.interface, 'eth1');
        });
    });
    
    describe('CIDR Conversion', function() {
        it('should convert CIDR to netmask', function() {
            const helper = new EthernetHelper();
            
            assert.strictEqual(helper.cidrToNetmask(24), '255.255.255.0');
            assert.strictEqual(helper.cidrToNetmask(16), '255.255.0.0');
            assert.strictEqual(helper.cidrToNetmask(8), '255.0.0.0');
            assert.strictEqual(helper.cidrToNetmask(32), '255.255.255.255');
            assert.strictEqual(helper.cidrToNetmask(0), '0.0.0.0');
        });
        
        it('should convert netmask to CIDR', function() {
            const helper = new EthernetHelper();
            
            assert.strictEqual(helper.netmaskToCidr('255.255.255.0'), 24);
            assert.strictEqual(helper.netmaskToCidr('255.255.0.0'), 16);
            assert.strictEqual(helper.netmaskToCidr('255.0.0.0'), 8);
            assert.strictEqual(helper.netmaskToCidr('255.255.255.255'), 32);
        });
    });
    
    describe('IP Address Parsing', function() {
        it('should parse IP from ip addr output', function() {
            const output = '    inet 192.168.1.100/24 brd 192.168.1.255 scope global eth0';
            const match = output.match(/inet\s+([\d.]+)\/(\d+)/);
            
            assert(match);
            assert.strictEqual(match[1], '192.168.1.100');
            assert.strictEqual(match[2], '24');
        });
        
        it('should parse MAC address', function() {
            const output = '    link/ether aa:bb:cc:dd:ee:ff brd ff:ff:ff:ff:ff:ff';
            const match = output.match(/link\/ether\s+([0-9a-f:]+)/i);
            
            assert(match);
            assert.strictEqual(match[1], 'aa:bb:cc:dd:ee:ff');
        });
    });
});
