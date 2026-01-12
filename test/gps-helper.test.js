/**
 * GPS Helper Tests
 */

const assert = require('assert');

describe('GPS Helper', function() {
    let GPSHelper;
    
    before(function() {
        GPSHelper = require('../lib/gps-helper');
    });
    
    describe('Initialization', function() {
        it('should create instance with default device', function() {
            const helper = new GPSHelper();
            assert.strictEqual(helper.device, '/dev/ttyUSB1');
        });
        
        it('should accept custom device', function() {
            const helper = new GPSHelper({ device: '/dev/ttyACM0' });
            assert.strictEqual(helper.device, '/dev/ttyACM0');
        });
    });
    
    describe('Distance Calculation (Haversine)', function() {
        it('should calculate distance between two points', function() {
            const helper = new GPSHelper();
            
            // Berlin to Munich (approx 504 km)
            const berlin = { lat: 52.520008, lon: 13.404954 };
            const munich = { lat: 48.137154, lon: 11.576124 };
            
            const distance = helper.calculateDistance(
                berlin.lat, berlin.lon,
                munich.lat, munich.lon
            );
            
            // Should be approximately 504 km (allow 10% tolerance)
            const distanceKm = distance / 1000;
            assert(distanceKm > 450 && distanceKm < 550, 
                `Distance should be ~504km, got ${distanceKm.toFixed(2)}km`);
        });
        
        it('should return 0 for same point', function() {
            const helper = new GPSHelper();
            
            const distance = helper.calculateDistance(52.52, 13.40, 52.52, 13.40);
            assert.strictEqual(distance, 0);
        });
        
        it('should handle negative coordinates', function() {
            const helper = new GPSHelper();
            
            // New York to São Paulo
            const ny = { lat: 40.7128, lon: -74.0060 };
            const sp = { lat: -23.5505, lon: -46.6333 };
            
            const distance = helper.calculateDistance(
                ny.lat, ny.lon,
                sp.lat, sp.lon
            );
            
            // Should be approximately 7700 km
            const distanceKm = distance / 1000;
            assert(distanceKm > 7000 && distanceKm < 8500,
                `Distance should be ~7700km, got ${distanceKm.toFixed(2)}km`);
        });
    });
    
    describe('Coordinate Formatting', function() {
        it('should format decimal coordinates', function() {
            const helper = new GPSHelper();
            
            const formatted = helper.formatCoordinates(52.520008, 13.404954, 'decimal');
            assert(formatted.includes('52.520008'));
            assert(formatted.includes('13.404954'));
        });
        
        it('should convert to DMS format', function() {
            const helper = new GPSHelper();
            
            const dms = helper.toDMS(52.520008, 'lat');
            assert(dms.includes('N') || dms.includes('S'));
            assert(dms.includes('°'));
        });
    });
});
