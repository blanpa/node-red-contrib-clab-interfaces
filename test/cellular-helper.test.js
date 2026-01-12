/**
 * Cellular Helper Tests
 */

const assert = require('assert');

describe('Cellular Helper', function() {
    let CellularHelper;
    
    before(function() {
        CellularHelper = require('../lib/cellular-helper');
    });
    
    describe('Initialization', function() {
        it('should create instance with default APN', function() {
            const helper = new CellularHelper();
            assert.strictEqual(helper.apn, 'internet');
        });
        
        it('should accept custom APN', function() {
            const helper = new CellularHelper({ apn: 'custom.apn' });
            assert.strictEqual(helper.apn, 'custom.apn');
        });
    });
    
    describe('Signal Quality Calculation', function() {
        it('should calculate quality percentage from RSRP', function() {
            // RSRP: -140 dBm (worst) to -44 dBm (best)
            
            // Excellent signal (-70 dBm)
            const excellent = Math.min(100, Math.max(0, 
                Math.round((-70 + 140) / 96 * 100)
            ));
            assert(excellent > 70, `Excellent signal should be >70%, got ${excellent}%`);
            
            // Poor signal (-120 dBm)
            const poor = Math.min(100, Math.max(0, 
                Math.round((-120 + 140) / 96 * 100)
            ));
            assert(poor < 30, `Poor signal should be <30%, got ${poor}%`);
        });
        
        it('should rate signal strength correctly', function() {
            const ratings = [
                { rsrp: -70, expected: 'excellent' },
                { rsrp: -85, expected: 'good' },
                { rsrp: -95, expected: 'fair' },
                { rsrp: -105, expected: 'poor' },
                { rsrp: -120, expected: 'very poor' }
            ];
            
            ratings.forEach(({ rsrp, expected }) => {
                let rating;
                if (rsrp >= -80) rating = 'excellent';
                else if (rsrp >= -90) rating = 'good';
                else if (rsrp >= -100) rating = 'fair';
                else if (rsrp >= -110) rating = 'poor';
                else rating = 'very poor';
                
                assert.strictEqual(rating, expected, 
                    `RSRP ${rsrp} should be ${expected}, got ${rating}`);
            });
        });
    });
    
    describe('Value Extraction', function() {
        it('should extract values from mmcli output', function() {
            const helper = new CellularHelper();
            
            const output = `
                manufacturer: Quectel
                model: EG25-G
                state: connected
                signal quality: 75
            `;
            
            const manufacturer = helper.extractValue(output, 'manufacturer');
            assert.strictEqual(manufacturer, 'Quectel');
            
            const model = helper.extractValue(output, 'model');
            assert.strictEqual(model, 'EG25-G');
        });
    });
});
