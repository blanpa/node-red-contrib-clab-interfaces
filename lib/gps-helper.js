/**
 * CompuLab GPS Helper
 * GPS Funktionen für CompuLab IoT Gateways
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');

class GPSHelper {
    constructor(options = {}) {
        // GPS Device - kann je nach Gerät variieren
        this.device = options.device || '/dev/ttyUSB1';
        this.gpsdHost = options.gpsdHost || 'localhost';
        this.gpsdPort = options.gpsdPort || 2947;
    }

    /**
     * Prüft ob GPS verfügbar ist
     */
    async isAvailable() {
        try {
            // Prüfe ob gpsd läuft
            const { stdout } = await execAsync('pgrep gpsd');
            return stdout.trim().length > 0;
        } catch (e) {
            // Prüfe ob GPS Device existiert
            return fs.existsSync(this.device);
        }
    }

    /**
     * Startet gpsd Service
     */
    async startGpsd() {
        try {
            await execAsync(`sudo gpsd ${this.device} -F /var/run/gpsd.sock`);
            return { success: true, message: 'gpsd gestartet' };
        } catch (e) {
            throw new Error(`gpsd Start fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Stoppt gpsd Service
     */
    async stopGpsd() {
        try {
            await execAsync('sudo killall gpsd');
            return { success: true, message: 'gpsd gestoppt' };
        } catch (e) {
            throw new Error(`gpsd Stop fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Liest GPS Position via gpspipe
     */
    async getPosition() {
        try {
            // Verwende gpspipe um JSON Daten zu bekommen
            const { stdout } = await execAsync('gpspipe -w -n 5 2>/dev/null | grep -m 1 TPV', {
                timeout: 10000
            });

            const data = JSON.parse(stdout.trim());
            
            return {
                success: true,
                timestamp: new Date().toISOString(),
                latitude: data.lat || null,
                longitude: data.lon || null,
                altitude: data.alt || null,
                speed: data.speed || null,  // m/s
                heading: data.track || null, // Grad
                climb: data.climb || null,   // m/s
                mode: data.mode || 0,        // 0=no fix, 1=no fix, 2=2D, 3=3D
                satellites: data.satellites || null,
                fix: data.mode >= 2 ? 'yes' : 'no',
                raw: data
            };
        } catch (e) {
            // Fallback: Versuche cgps
            return await this.getPositionViaCgps();
        }
    }

    /**
     * Alternative: Liest GPS via cgps
     */
    async getPositionViaCgps() {
        try {
            const { stdout } = await execAsync('timeout 5 cgps -s 2>/dev/null | head -20', {
                timeout: 10000
            });

            const result = {
                success: false,
                timestamp: new Date().toISOString(),
                latitude: null,
                longitude: null,
                altitude: null,
                speed: null,
                heading: null,
                fix: 'no',
                raw: stdout
            };

            // Parse cgps Output
            const latMatch = stdout.match(/Latitude:\s*([\d.-]+)/);
            const lonMatch = stdout.match(/Longitude:\s*([\d.-]+)/);
            const altMatch = stdout.match(/Altitude:\s*([\d.-]+)/);
            const speedMatch = stdout.match(/Speed:\s*([\d.-]+)/);

            if (latMatch) result.latitude = parseFloat(latMatch[1]);
            if (lonMatch) result.longitude = parseFloat(lonMatch[1]);
            if (altMatch) result.altitude = parseFloat(altMatch[1]);
            if (speedMatch) result.speed = parseFloat(speedMatch[1]);

            if (result.latitude && result.longitude) {
                result.success = true;
                result.fix = 'yes';
            }

            return result;
        } catch (e) {
            return {
                success: false,
                timestamp: new Date().toISOString(),
                error: 'GPS nicht verfügbar oder kein Fix',
                latitude: null,
                longitude: null,
                fix: 'no'
            };
        }
    }

    /**
     * Liest GPS Satelliten Info
     */
    async getSatellites() {
        try {
            const { stdout } = await execAsync('gpspipe -w -n 10 2>/dev/null | grep -m 1 SKY', {
                timeout: 15000
            });

            const data = JSON.parse(stdout.trim());
            
            const satellites = (data.satellites || []).map(sat => ({
                prn: sat.PRN,
                elevation: sat.el,
                azimuth: sat.az,
                snr: sat.ss,
                used: sat.used
            }));

            return {
                success: true,
                timestamp: new Date().toISOString(),
                visible: satellites.length,
                used: satellites.filter(s => s.used).length,
                satellites: satellites
            };
        } catch (e) {
            return {
                success: false,
                error: e.message,
                visible: 0,
                used: 0,
                satellites: []
            };
        }
    }

    /**
     * Berechnet Distanz zwischen zwei GPS Koordinaten (Haversine)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Erdradius in Metern
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distanz in Metern
    }

    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    /**
     * Formatiert Koordinaten als String
     */
    formatCoordinates(lat, lon, format = 'decimal') {
        if (format === 'dms') {
            // Grad, Minuten, Sekunden
            const latDMS = this.toDMS(lat, 'lat');
            const lonDMS = this.toDMS(lon, 'lon');
            return `${latDMS}, ${lonDMS}`;
        }
        return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }

    toDMS(decimal, type) {
        const absolute = Math.abs(decimal);
        const degrees = Math.floor(absolute);
        const minutesNotTruncated = (absolute - degrees) * 60;
        const minutes = Math.floor(minutesNotTruncated);
        const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);
        
        let direction;
        if (type === 'lat') {
            direction = decimal >= 0 ? 'N' : 'S';
        } else {
            direction = decimal >= 0 ? 'E' : 'W';
        }
        
        return `${degrees}°${minutes}'${seconds}"${direction}`;
    }
}

module.exports = GPSHelper;
