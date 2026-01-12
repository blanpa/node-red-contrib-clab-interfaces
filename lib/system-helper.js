/**
 * System Helper for CompuLab IoT Gateways
 * RTC, Watchdog, TPM, System Info
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Extended PATH for system commands
const SYSTEM_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
const execOptions = { 
    encoding: 'utf8',
    env: { ...process.env, PATH: SYSTEM_PATH }
};

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
     * Reads RTC time
     */
    getRtcTime() {
        try {
            // Try hwclock first
            try {
                const result = execSync('hwclock -r', execOptions);
                return {
                    success: true,
                    time: result.trim(),
                    timestamp: new Date(result.trim()).toISOString()
                };
            } catch (e) {
                // Fallback: Read directly from sysfs
                const rtcDate = fs.readFileSync('/sys/class/rtc/rtc0/date', 'utf8').trim();
                const rtcTime = fs.readFileSync('/sys/class/rtc/rtc0/time', 'utf8').trim();
                const dateTime = `${rtcDate} ${rtcTime}`;
                return {
                    success: true,
                    time: dateTime,
                    timestamp: new Date(dateTime).toISOString(),
                    source: 'sysfs'
                };
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Sets RTC time
     */
    setRtcTime(dateString) {
        try {
            if (dateString && dateString !== 'now') {
                execSync(`date -s "${dateString}"`, { ...execOptions, stdio: 'pipe' });
            }
            
            // Try hwclock first
            try {
                execSync('hwclock -w', { ...execOptions, stdio: 'pipe' });
            } catch (e) {
                // Fallback: Write directly to sysfs
                const now = new Date();
                const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
                const time = now.toTimeString().split(' ')[0]; // HH:MM:SS
                
                fs.writeFileSync('/sys/class/rtc/rtc0/wakealarm', '0');
                // Note: Direct time setting via sysfs requires special permissions
                // Using timedatectl as alternative
                try {
                    execSync('timedatectl set-ntp false', { ...execOptions, stdio: 'pipe' });
                    execSync(`timedatectl set-time "${date} ${time}"`, { ...execOptions, stdio: 'pipe' });
                } catch (e2) {
                    throw new Error('Cannot set RTC time. Needs root permissions or hwclock.');
                }
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Synchronizes system time from RTC
     */
    syncRtcToSystem() {
        try {
            // Try hwclock first
            try {
                execSync('hwclock -s', { ...execOptions, stdio: 'pipe' });
            } catch (e) {
                // Fallback: Use timedatectl
                execSync('timedatectl set-ntp false', { ...execOptions, stdio: 'pipe' });
                
                // Read RTC time
                const rtcDate = fs.readFileSync('/sys/class/rtc/rtc0/date', 'utf8').trim();
                const rtcTime = fs.readFileSync('/sys/class/rtc/rtc0/time', 'utf8').trim();
                
                execSync(`timedatectl set-time "${rtcDate} ${rtcTime}"`, { ...execOptions, stdio: 'pipe' });
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // Legacy aliases for backward compatibility
    getRTC() { return this.getRtcTime(); }
    setRTC(dateString) { return this.setRtcTime(dateString); }
    syncFromRTC() { return this.syncRtcToSystem(); }

    /**
     * Reads Watchdog status
     */
    getWatchdogStatus() {
        try {
            // Try systemctl first
            try {
                const result = execSync('systemctl show | grep RuntimeWatchdog', execOptions);
                const match = result.match(/RuntimeWatchdogUSec=(\d+)/);
                const usec = match ? parseInt(match[1], 10) : 0;
                return {
                    enabled: usec > 0,
                    timeoutUsec: usec,
                    timeoutSec: usec / 1000000
                };
            } catch (e) {
                // Fallback: Check if watchdog device exists and is accessible
                const watchdogDevices = ['/dev/watchdog', '/dev/watchdog0', '/dev/watchdog1'];
                for (const dev of watchdogDevices) {
                    if (fs.existsSync(dev)) {
                        try {
                            const timeout = fs.readFileSync(`/sys/class/watchdog/${dev.split('/').pop()}/timeout`, 'utf8').trim();
                            return {
                                enabled: true,
                                device: dev,
                                timeoutSec: parseInt(timeout, 10),
                                source: 'sysfs'
                            };
                        } catch (e2) {
                            // Device exists but can't read timeout
                            return {
                                enabled: true,
                                device: dev,
                                timeoutSec: null,
                                source: 'device'
                            };
                        }
                    }
                }
                return { enabled: false, error: 'No watchdog device found' };
            }
        } catch (e) {
            return { enabled: false, error: e.message };
        }
    }

    /**
     * Enables Watchdog with timeout
     */
    enableWatchdog(timeoutSec = 60) {
        try {
            // Try systemctl first
            try {
                execSync(`systemctl set-property --runtime -- -.slice RuntimeWatchdogSec=${timeoutSec}s`, 
                    { ...execOptions, stdio: 'pipe' });
                return { success: true, timeout: timeoutSec, method: 'systemctl' };
            } catch (e) {
                // Fallback: Use wdctl or direct device access
                try {
                    execSync(`wdctl /dev/watchdog -s ${timeoutSec}`, { ...execOptions, stdio: 'pipe' });
                    return { success: true, timeout: timeoutSec, method: 'wdctl' };
                } catch (e2) {
                    // Try writing to sysfs
                    fs.writeFileSync('/sys/class/watchdog/watchdog0/timeout', timeoutSec.toString());
                    return { success: true, timeout: timeoutSec, method: 'sysfs' };
                }
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Disables Watchdog
     */
    disableWatchdog() {
        try {
            // Try systemctl first
            try {
                execSync('systemctl set-property --runtime -- -.slice RuntimeWatchdogSec=0', 
                    { ...execOptions, stdio: 'pipe' });
                return { success: true, method: 'systemctl' };
            } catch (e) {
                // Fallback: Write 'V' to watchdog device to disable (magic close)
                try {
                    const fd = fs.openSync('/dev/watchdog', 'w');
                    fs.writeSync(fd, 'V');
                    fs.closeSync(fd);
                    return { success: true, method: 'device' };
                } catch (e2) {
                    return { success: false, error: 'Cannot disable watchdog. May require root permissions.' };
                }
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Kicks/resets Watchdog timer
     */
    kickWatchdog() {
        try {
            // Try systemctl first
            try {
                execSync('systemctl daemon-reload', { ...execOptions, stdio: 'pipe' });
                return { success: true, method: 'systemctl' };
            } catch (e) {
                // Fallback: Write to watchdog device
                try {
                    const fd = fs.openSync('/dev/watchdog', 'w');
                    fs.writeSync(fd, '\n');
                    fs.closeSync(fd);
                    return { success: true, method: 'device' };
                } catch (e2) {
                    return { success: false, error: 'Cannot kick watchdog. May require root permissions.' };
                }
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Checks TPM availability
     */
    getTpmStatus() {
        try {
            // Load TPM module
            try {
                execSync('modprobe tpm_tis_spi', { ...execOptions, stdio: 'pipe' });
            } catch (e) { /* ignore */ }

            const exists = fs.existsSync('/dev/tpm0') || fs.existsSync('/dev/tpmrm0');
            
            if (exists) {
                try {
                    const random = execSync('tpm2_getrandom 8 --hex', execOptions);
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
     * Gets random bytes from TPM
     */
    getTpmRandom(bytes = 32) {
        try {
            const random = execSync(`tpm2_getrandom ${bytes} --hex`, execOptions);
            return { 
                success: true, 
                bytes: bytes,
                random: random.trim() 
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // Legacy aliases
    checkTPM() { return this.getTpmStatus(); }

    /**
     * Gets system information
     */
    getSystemInfo() {
        const info = {
            device: this.deviceInfo,
            hostname: null,
            uptime: null,
            loadAvg: null,
            memory: null,
            temperature: null
        };

        try {
            info.hostname = execSync('hostname', execOptions).trim();
        } catch (e) { /* ignore */ }

        try {
            info.uptime = parseFloat(fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]);
        } catch (e) { /* ignore */ }

        try {
            const loadavg = fs.readFileSync('/proc/loadavg', 'utf8').split(' ');
            info.loadAvg = {
                '1min': parseFloat(loadavg[0]),
                '5min': parseFloat(loadavg[1]),
                '15min': parseFloat(loadavg[2])
            };
        } catch (e) { /* ignore */ }

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
        } catch (e) { /* ignore */ }

        // CPU Temperature
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
        } catch (e) { /* ignore */ }

        return info;
    }

    /**
     * Gets system uptime
     */
    getUptime() {
        try {
            const uptime = parseFloat(fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]);
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            return {
                seconds: uptime,
                uptime: `${days}d ${hours}h ${minutes}m`
            };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Gets CPU temperature
     */
    getTemperature() {
        try {
            const tempPaths = [
                '/sys/class/thermal/thermal_zone0/temp',
                '/sys/devices/virtual/thermal/thermal_zone0/temp'
            ];
            for (const p of tempPaths) {
                if (fs.existsSync(p)) {
                    const temp = parseInt(fs.readFileSync(p, 'utf8'), 10);
                    const celsius = temp / 1000;
                    return {
                        celsius: celsius,
                        fahrenheit: (celsius * 9/5) + 32
                    };
                }
            }
            return { error: 'Temperature sensor not found' };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Reboots the system
     */
    reboot(delay = 0) {
        try {
            if (delay > 0) {
                execSync(`shutdown -r +${delay}`, { ...execOptions, stdio: 'pipe' });
            } else {
                execSync('reboot', { ...execOptions, stdio: 'pipe' });
            }
            return { success: true, delay: delay };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Shuts down the system
     */
    shutdown(delay = 0) {
        try {
            if (delay > 0) {
                execSync(`shutdown -h +${delay}`, { ...execOptions, stdio: 'pipe' });
            } else {
                execSync('shutdown -h now', { ...execOptions, stdio: 'pipe' });
            }
            return { success: true, delay: delay };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

module.exports = SystemHelper;
