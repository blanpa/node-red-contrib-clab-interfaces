/**
 * CompuLab Ethernet Helper
 * Ethernet/Netzwerk Funktionen für CompuLab IoT Gateways
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');

// Extended PATH for system commands
const SYSTEM_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
const execOptions = { 
    encoding: 'utf8',
    env: { ...process.env, PATH: SYSTEM_PATH }
};

class EthernetHelper {
    constructor(options = {}) {
        this.interface = options.interface || 'eth0';
        this.hasNmcli = null;  // Cache nmcli availability
    }
    
    /**
     * Check if nmcli is available
     */
    async checkNmcli() {
        if (this.hasNmcli !== null) return this.hasNmcli;
        
        try {
            await execAsync('which nmcli', execOptions);
            this.hasNmcli = true;
        } catch (e) {
            this.hasNmcli = false;
        }
        return this.hasNmcli;
    }

    /**
     * Gibt alle Netzwerk-Interfaces zurück
     */
    async getInterfaces() {
        try {
            const interfaces = [];
            
            // Try nmcli first
            if (await this.checkNmcli()) {
                const { stdout } = await execAsync('nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status', execOptions);
                
                const lines = stdout.split('\n').filter(l => l.trim());
                
                for (const line of lines) {
                    const parts = line.split(':');
                    if (parts[1] === 'ethernet' || parts[1] === 'wifi') {
                        interfaces.push({
                            device: parts[0],
                            type: parts[1],
                            state: parts[2],
                            connection: parts[3] || null,
                            connected: parts[2] === 'connected'
                        });
                    }
                }
            } else {
                // Fallback: Parse /sys/class/net
                const netDevices = fs.readdirSync('/sys/class/net');
                
                for (const device of netDevices) {
                    // Skip loopback and virtual interfaces
                    if (device === 'lo' || device.startsWith('veth')) continue;
                    
                    try {
                        const type = device.startsWith('wl') ? 'wifi' : 
                                   device.startsWith('eth') || device.startsWith('en') ? 'ethernet' : 'other';
                        
                        const operstate = fs.readFileSync(`/sys/class/net/${device}/operstate`, 'utf8').trim();
                        const state = operstate === 'up' ? 'connected' : 'disconnected';
                        
                        interfaces.push({
                            device: device,
                            type: type,
                            state: state,
                            connection: null,
                            connected: state === 'connected'
                        });
                    } catch (e) {
                        // Skip devices we can't read
                    }
                }
            }

            return {
                success: true,
                interfaces: interfaces,
                count: interfaces.length
            };
        } catch (e) {
            throw new Error(`Interface-Liste fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Gibt Status eines Interfaces zurück
     */
    async getStatus(iface = null) {
        const interfaceName = iface || this.interface;
        
        const status = {
            interface: interfaceName,
            type: 'ethernet',
            state: 'unknown',
            connection: null,
            connected: false
        };
        
        try {
            // Try nmcli first if available
            if (await this.checkNmcli()) {
                const { stdout: nmOutput } = await execAsync(
                    `nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status | grep "^${interfaceName}:"`,
                    execOptions
                );
                
                const parts = nmOutput.trim().split(':');
                status.interface = parts[0];
                status.type = parts[1];
                status.state = parts[2];
                status.connection = parts[3] || null;
                status.connected = parts[2] === 'connected';
            } else {
                // Fallback: Use ip command
                try {
                    const { stdout: ipOutput } = await execAsync(`ip link show ${interfaceName}`, execOptions);
                    status.state = ipOutput.includes('state UP') ? 'connected' : 'disconnected';
                    status.connected = status.state === 'connected';
                } catch (e) {
                    status.state = 'unavailable';
                }
            }

            // IP Adresse holen
            try {
                const { stdout: ipOutput } = await execAsync(`ip addr show ${interfaceName}`);
                
                const ipMatch = ipOutput.match(/inet\s+([\d.]+)\/(\d+)/);
                if (ipMatch) {
                    status.ipAddress = ipMatch[1];
                    status.netmask = this.cidrToNetmask(parseInt(ipMatch[2]));
                    status.cidr = parseInt(ipMatch[2]);
                    
                    // Check if this is a Docker bridge IP
                    if (status.ipAddress.startsWith('172.') && status.cidr === 16) {
                        status.isDockerBridge = true;
                        status.note = 'This is a Docker bridge IP. Use network_mode: host in docker-compose.yml to see host IPs.';
                    }
                }

                const macMatch = ipOutput.match(/link\/ether\s+([0-9a-f:]+)/i);
                if (macMatch) {
                    status.macAddress = macMatch[1];
                }

                status.up = ipOutput.includes('state UP');
            } catch (e) { /* ignorieren */ }

            // Gateway holen
            try {
                const { stdout: routeOutput } = await execAsync(`ip route | grep "default.*${interfaceName}"`);
                const gwMatch = routeOutput.match(/default via ([\d.]+)/);
                if (gwMatch) {
                    status.gateway = gwMatch[1];
                }
            } catch (e) { /* ignorieren */ }

            // DNS holen
            try {
                const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
                const dnsServers = [];
                const dnsMatches = resolv.matchAll(/nameserver\s+([\d.]+)/g);
                for (const match of dnsMatches) {
                    dnsServers.push(match[1]);
                }
                status.dns = dnsServers;
            } catch (e) { /* ignorieren */ }

            // Link Speed
            try {
                const { stdout: ethtoolOutput } = await execAsync(`ethtool ${interfaceName} 2>/dev/null | grep Speed`);
                const speedMatch = ethtoolOutput.match(/Speed:\s*(\d+)/);
                if (speedMatch) {
                    status.speed = parseInt(speedMatch[1]);
                    status.speedUnit = 'Mb/s';
                }
            } catch (e) { /* ignorieren */ }

            return status;
        } catch (e) {
            throw new Error(`Interface Status fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Aktiviert ein Interface
     */
    async enable(iface = null) {
        const interfaceName = iface || this.interface;
        try {
            // Try without sudo first (if running as root in container)
            try {
                await execAsync(`ip link set ${interfaceName} up`, execOptions);
            } catch (e) {
                // Fallback with sudo
                await execAsync(`sudo ip link set ${interfaceName} up`, execOptions);
            }
            return { success: true, interface: interfaceName, message: 'Interface aktiviert' };
        } catch (e) {
            throw new Error(`Interface aktivieren fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Deaktiviert ein Interface
     */
    async disable(iface = null) {
        const interfaceName = iface || this.interface;
        try {
            // Try without sudo first (if running as root in container)
            try {
                await execAsync(`ip link set ${interfaceName} down`, execOptions);
            } catch (e) {
                // Fallback with sudo
                await execAsync(`sudo ip link set ${interfaceName} down`, execOptions);
            }
            return { success: true, interface: interfaceName, message: 'Interface deaktiviert' };
        } catch (e) {
            throw new Error(`Interface deaktivieren fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Setzt statische IP Konfiguration
     */
    async setStaticIP(config) {
        const { 
            interface: iface = this.interface,
            ipAddress,
            netmask = '255.255.255.0',
            gateway,
            dns = ['8.8.8.8']
        } = config;

        try {
            if (await this.checkNmcli()) {
                // Use NetworkManager
                const connName = `static-${iface}`;
                
                // Lösche existierende Connection
                await execAsync(`nmcli connection delete "${connName}" 2>/dev/null`, execOptions).catch(() => {});

                // Erstelle neue Connection
                const cidr = this.netmaskToCidr(netmask);
                let cmd = `nmcli connection add type ethernet con-name "${connName}" ifname ${iface}`;
                cmd += ` ipv4.addresses ${ipAddress}/${cidr}`;
                cmd += ` ipv4.method manual`;
                
                if (gateway) {
                    cmd += ` ipv4.gateway ${gateway}`;
                }
                if (dns && dns.length > 0) {
                    cmd += ` ipv4.dns "${dns.join(',')}"`;
                }

                await execAsync(cmd, execOptions);
                await execAsync(`nmcli connection up "${connName}"`, execOptions);
            } else {
                // Fallback: Use ip command (temporary, not persistent)
                const cidr = this.netmaskToCidr(netmask);
                
                // Flush existing IPs
                await execAsync(`ip addr flush dev ${iface}`, execOptions).catch(() => {});
                
                // Set IP address
                await execAsync(`ip addr add ${ipAddress}/${cidr} dev ${iface}`, execOptions);
                
                // Bring interface up
                await execAsync(`ip link set ${iface} up`, execOptions);
                
                // Set gateway if provided
                if (gateway) {
                    await execAsync(`ip route add default via ${gateway} dev ${iface}`, execOptions).catch(() => {});
                }
                
                // Note: DNS configuration without NetworkManager requires editing /etc/resolv.conf
                // which is not recommended in containers
            }

            return {
                success: true,
                interface: iface,
                ipAddress: ipAddress,
                netmask: netmask,
                gateway: gateway,
                dns: dns,
                message: 'Statische IP konfiguriert'
            };
        } catch (e) {
            throw new Error(`Statische IP setzen fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Setzt DHCP Konfiguration
     */
    async setDHCP(iface = null) {
        const interfaceName = iface || this.interface;
        
        try {
            if (await this.checkNmcli()) {
                // Use NetworkManager
                const connName = `dhcp-${interfaceName}`;
                
                // Lösche existierende Connection
                await execAsync(`nmcli connection delete "${connName}" 2>/dev/null`, execOptions).catch(() => {});

                // Erstelle neue DHCP Connection
                await execAsync(
                    `nmcli connection add type ethernet con-name "${connName}" ifname ${interfaceName} ipv4.method auto`,
                    execOptions
                );

                // Aktiviere Connection
                await execAsync(`nmcli connection up "${connName}"`, execOptions);
            } else {
                // Fallback: Use dhclient or udhcpc
                // Flush existing IPs
                await execAsync(`ip addr flush dev ${interfaceName}`, execOptions).catch(() => {});
                
                // Try dhclient first
                try {
                    await execAsync(`dhclient ${interfaceName}`, execOptions);
                } catch (e) {
                    // Fallback to udhcpc (busybox)
                    await execAsync(`udhcpc -i ${interfaceName}`, execOptions);
                }
            }

            return {
                success: true,
                interface: interfaceName,
                method: 'dhcp',
                message: 'DHCP aktiviert'
            };
        } catch (e) {
            throw new Error(`DHCP setzen fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Gibt Netzwerk-Statistiken zurück
     */
    async getStatistics(iface = null) {
        const interfaceName = iface || this.interface;
        
        try {
            const stats = {};
            
            // RX/TX Bytes
            const rxBytes = fs.readFileSync(`/sys/class/net/${interfaceName}/statistics/rx_bytes`, 'utf8');
            const txBytes = fs.readFileSync(`/sys/class/net/${interfaceName}/statistics/tx_bytes`, 'utf8');
            const rxPackets = fs.readFileSync(`/sys/class/net/${interfaceName}/statistics/rx_packets`, 'utf8');
            const txPackets = fs.readFileSync(`/sys/class/net/${interfaceName}/statistics/tx_packets`, 'utf8');
            const rxErrors = fs.readFileSync(`/sys/class/net/${interfaceName}/statistics/rx_errors`, 'utf8');
            const txErrors = fs.readFileSync(`/sys/class/net/${interfaceName}/statistics/tx_errors`, 'utf8');

            stats.rxBytes = parseInt(rxBytes.trim());
            stats.txBytes = parseInt(txBytes.trim());
            stats.rxPackets = parseInt(rxPackets.trim());
            stats.txPackets = parseInt(txPackets.trim());
            stats.rxErrors = parseInt(rxErrors.trim());
            stats.txErrors = parseInt(txErrors.trim());

            // Formatierte Werte
            stats.rxMB = (stats.rxBytes / 1024 / 1024).toFixed(2);
            stats.txMB = (stats.txBytes / 1024 / 1024).toFixed(2);

            return {
                success: true,
                interface: interfaceName,
                statistics: stats
            };
        } catch (e) {
            throw new Error(`Statistiken fehlgeschlagen: ${e.message}`);
        }
    }

    // Hilfsfunktionen
    cidrToNetmask(cidr) {
        const mask = [];
        for (let i = 0; i < 4; i++) {
            const n = Math.min(cidr, 8);
            mask.push(256 - Math.pow(2, 8 - n));
            cidr -= n;
        }
        return mask.join('.');
    }

    netmaskToCidr(netmask) {
        return netmask.split('.').reduce((c, o) => 
            c + (o >>> 0).toString(2).split('1').length - 1, 0);
    }
}

module.exports = EthernetHelper;
