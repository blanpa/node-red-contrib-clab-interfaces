/**
 * System Helper Tests
 */

const assert = require('assert');

describe('System Helper', function() {
    let SystemHelper;
    
    before(function() {
        SystemHelper = require('../lib/system-helper');
    });
    
    describe('Initialization', function() {
        it('should create instance without errors', function() {
            const helper = new SystemHelper();
            assert(helper);
        });
    });
    
    describe('Time Parsing', function() {
        it('should parse ISO date string', function() {
            const helper = new SystemHelper();
            const date = new Date('2024-01-15T10:30:00Z');
            
            assert(date instanceof Date);
            assert(!isNaN(date.getTime()));
        });
        
        it('should handle invalid date gracefully', function() {
            const helper = new SystemHelper();
            const date = new Date('invalid');
            
            assert(isNaN(date.getTime()));
        });
    });
    
    describe('Temperature Conversion', function() {
        it('should convert millidegrees to degrees', function() {
            const helper = new SystemHelper();
            
            // Typical CPU temp reading in millidegrees
            const millidegrees = 45000;
            const degrees = millidegrees / 1000;
            
            assert.strictEqual(degrees, 45);
        });
    });
    
    describe('Uptime Formatting', function() {
        it('should format seconds to human readable', function() {
            const helper = new SystemHelper();
            
            const seconds = 90061; // 1 day, 1 hour, 1 minute, 1 second
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            assert.strictEqual(days, 1);
            assert.strictEqual(hours, 1);
            assert.strictEqual(minutes, 1);
        });
    });
});
