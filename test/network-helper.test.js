/**
 * Network Helper Tests
 */

const assert = require('assert');

describe('Network Helper', function() {
    let NetworkHelper;
    
    before(function() {
        NetworkHelper = require('../lib/network-helper');
    });
    
    describe('Initialization', function() {
        it('should create instance without errors', function() {
            const helper = new NetworkHelper();
            assert(helper);
        });
    });
    
    describe('Ping Output Parsing', function() {
        it('should parse ping statistics', function() {
            const output = `
PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.
64 bytes from 8.8.8.8: icmp_seq=1 ttl=117 time=12.3 ms
64 bytes from 8.8.8.8: icmp_seq=2 ttl=117 time=11.8 ms

--- 8.8.8.8 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3004ms
rtt min/avg/max/mdev = 11.234/12.456/13.678/0.891 ms
            `;
            
            const statsMatch = output.match(/(\d+) packets transmitted, (\d+) received/);
            assert(statsMatch);
            assert.strictEqual(parseInt(statsMatch[1]), 4);
            assert.strictEqual(parseInt(statsMatch[2]), 4);
            
            const rttMatch = output.match(/rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)/);
            assert(rttMatch);
            assert.strictEqual(parseFloat(rttMatch[1]), 11.234);
            assert.strictEqual(parseFloat(rttMatch[2]), 12.456);
            assert.strictEqual(parseFloat(rttMatch[3]), 13.678);
        });
    });
    
    describe('Traceroute Output Parsing', function() {
        it('should parse traceroute hops', function() {
            const output = `
traceroute to google.com (142.250.185.206), 30 hops max, 60 byte packets
 1  router.local (192.168.1.1)  1.234 ms  1.456 ms  1.678 ms
 2  10.0.0.1 (10.0.0.1)  5.123 ms  5.456 ms  5.789 ms
 3  * * *
            `;
            
            const lines = output.split('\n').slice(1);
            let hops = 0;
            
            lines.forEach(line => {
                if (line.match(/^\s*\d+\s+/)) {
                    hops++;
                }
            });
            
            assert.strictEqual(hops, 3);
        });
    });
    
    describe('Port Check', function() {
        it('should have checkPort method', function() {
            const helper = new NetworkHelper();
            assert(typeof helper.checkPort === 'function');
        });
    });
    
    describe('HTTP Check', function() {
        it('should have checkHttp method', function() {
            const helper = new NetworkHelper();
            assert(typeof helper.checkHttp === 'function');
        });
    });
    
    describe('ARP Parsing', function() {
        it('should parse arp -n output', function() {
            const output = `Address                  HWtype  HWaddress           Flags Mask            Iface
192.168.1.1              ether   aa:bb:cc:dd:ee:ff   C                     eth0
192.168.1.100            ether   11:22:33:44:55:66   C                     eth0`;
            
            const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('Address'));
            const entries = [];
            
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3 && parts[0].match(/^\d+\.\d+\.\d+\.\d+$/)) {
                    entries.push({
                        ip: parts[0],
                        hwType: parts[1],
                        macAddress: parts[2]
                    });
                }
            });
            
            assert.strictEqual(entries.length, 2);
            assert.strictEqual(entries[0].ip, '192.168.1.1');
            assert.strictEqual(entries[0].macAddress, 'aa:bb:cc:dd:ee:ff');
        });
    });
    
    describe('DNS Lookup', function() {
        it('should have dnsLookup method', function() {
            const helper = new NetworkHelper();
            assert(typeof helper.dnsLookup === 'function');
        });
    });
    
    describe('Speed Test', function() {
        it('should have speedTest method', function() {
            const helper = new NetworkHelper();
            assert(typeof helper.speedTest === 'function');
        });
    });
});
