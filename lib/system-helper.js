/**
 * System Helper für CompuLab IoT Gateways
 * RTC, Watchdog, TPM, System Info
 */

const { execSync } = require('child_process');
const fs = require('fs');

class SystemHelper {
    constructor() {
        this.deviceInfo = this._detectDevice();
    }

    /**
     * Erkennt das CompuLab Gerät
     */
    _detectDevice() {
        const info = {
            type: 'unknown',
            serialNumber: null,
            options: null
        };

        try {
            if (fs.existsSync('/proc/device-tree/baseboard-sn')) {
                info.serialNumber = fs.readFileSync('/proc/device-tree/baseboard-sn', 'utf8').replace(/\0/g, '').trim();
            }
            if (fs.existsSync('/proc/device-tree/baseboard-options')) {
                info.options = fs.readFileSync('/proc/device-tree/baseboard-options', 'utf8').replace(/\0/g, '').trim();
                if (info.options.includes('IOT-GATE-iMX8')) {
                    info.type = 'IOT-GATE-iMX8';
                } else if (info.options.includes('SBC-IOT-iMX8')) {
                    info.type = 'SBC-IOT-iMX8';
                }
            }
            if (fs.existsSync('/proc/device-tree/model')) {
                const model = fs.readFileSync('/proc/device-tree/model', 'utf8').replace(/\0/g, '').trim();
                if (model.includes('Raspberry Pi')) {
                    info.type = 'IOT-GATE-RPi';
                }
                info.model = model;
            }
        } catch (e) {
            // Ignorieren
        }

        return info;
    }

    /**
     * Liest die RTC Zeit
     */
    getRTC() {
        try {
            const result = execSync('hwclock -r', { encoding: 'utf8' });
            return {
                success: true,
                time: result.trim(),
                timestamp: new Date(result.trim()).toISOString()
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Setzt die RTC Zeit
     */
    setRTC(dateString) {
        try {
            if (dateString) {
                execSync(`date -s "${dateString}"`, { stdio: 'pipe' });
            }
            execSync('hwclock -w', { stdio: 'pipe' });
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Synchronisiert Systemzeit mit RTC
     */
    syncFromRTC() {
        try {
            execSync('hwclock -s', { stdio: 'pipe' });
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Liest Watchdog Status
     */
    getWatchdogStatus() {
        try {
            const result = execSync('systemctl show | grep RuntimeWatchdog', { encoding: 'utf8' });
            const match = result.match(/RuntimeWatchdogUSec=(\d+)/);
            const usec = match ? parseInt(match[1], 10) : 0;
            return {
                enabled: usec > 0,
                timeoutUsec: usec,
                timeoutSec: usec / 1000000
            };
        } catch (e) {
            return { enabled: false, error: e.message };
        }
    }

    /**
     * Prüft TPM Verfügbarkeit
     */
    checkTPM() {
        try {
            // TPM Modul laden
            try {
                execSync('modprobe tpm_tis_spi', { stdio: 'pipe' });
            } catch (e) { /* ignorieren */ }

            const exists = fs.existsSync('/dev/tpm0') || fs.existsSync('/dev/tpmrm0');
            
            if (exists) {
                try {
                    const random = execSync('tpm2_getrandom 8 --hex', { encoding: 'utf8' });
                    return { available: true, functional: true, random: random.trim() };
                } catch (e) {
                    return { available: true, functional: false, error: e.message };
                }
            }
            
            return { available: false };
        } catch (e) {
            return { available: false, error: e.message };
        }
    }

    /**
     * Liest System Informationen
     */
    getSystemInfo() {
        const info = {
            device: this.deviceInfo,
            uptime: null,
            loadAvg: null,
            memory: null,
            temperature: null
        };

        try {
            info.uptime = parseFloat(fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]);
        } catch (e) { /* ignorieren */ }

        try {
            const loadavg = fs.readFileSync('/proc/loadavg', 'utf8').split(' ');
            info.loadAvg = {
                '1min': parseFloat(loadavg[0]),
                '5min': parseFloat(loadavg[1]),
                '15min': parseFloat(loadavg[2])
            };
        } catch (e) { /* ignorieren */ }

        try {
            const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
            const total = meminfo.match(/MemTotal:\s+(\d+)/);
            const free = meminfo.match(/MemAvailable:\s+(\d+)/);
            if (total && free) {
                info.memory = {
                    totalKB: parseInt(total[1], 10),
                    availableKB: parseInt(free[1], 10),
                    usedPercent: Math.round((1 - parseInt(free[1], 10) / parseInt(total[1], 10)) * 100)
                };
            }
        } catch (e) { /* ignorieren */ }

        // CPU Temperatur
        try {
            const tempPaths = [
                '/sys/class/thermal/thermal_zone0/temp',
                '/sys/devices/virtual/thermal/thermal_zone0/temp'
            ];
            for (const p of tempPaths) {
                if (fs.existsSync(p)) {
                    const temp = parseInt(fs.readFileSync(p, 'utf8'), 10);
                    info.temperature = temp / 1000;
                    break;
                }
            }
        } catch (e) { /* ignorieren */ }

        return info;
    }

    /**
     * Führt einen Neustart durch
     */
    reboot() {
        try {
            execSync('reboot', { stdio: 'pipe' });
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Fährt das System herunter
     */
    shutdown() {
        try {
            execSync('shutdown -h now', { stdio: 'pipe' });
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

module.exports = SystemHelper;
