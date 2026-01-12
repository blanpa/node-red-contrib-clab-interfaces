# WiFi in Docker Containers

This document explains how to use WiFi functionality from within a Docker container on CompuLab IoT Gateways.

## Problem

WiFi management typically requires NetworkManager (`nmcli`), which is not available in minimal Docker containers. Additionally, WiFi requires special privileges and access to host network interfaces.

## Solutions

The WiFi helper automatically detects available tools and uses fallback methods:

1. **NetworkManager (nmcli)** - Preferred method (requires host network mode)
2. **wpa_supplicant** - Fallback for connecting to networks
3. **iw + ip** - Fallback for status and scanning
4. **hostapd + dnsmasq** - Fallback for Access Point mode

## Docker Configuration

### Option 1: Host Network Mode (Recommended)

Use `network_mode: host` to give the container full access to host network interfaces:

```yaml
services:
  node-red:
    image: nodered/node-red:latest
    network_mode: host
    privileged: true
    user: "0:0"
    volumes:
      - ./data:/data
      - /dev:/dev
      - /sys:/sys
      - /proc:/proc
      - /run/dbus:/run/dbus
```

**Advantages:**
- Full access to NetworkManager (`nmcli`)
- All WiFi features work as expected
- Can see and control all host network interfaces

**Disadvantages:**
- Container shares host network namespace
- Port conflicts possible with host services

### Option 2: Bridge Network with Fallbacks

Use the default bridge network with fallback tools:

```yaml
services:
  node-red:
    image: nodered/node-red:latest
    privileged: true
    user: "0:0"
    cap_add:
      - NET_ADMIN
      - NET_RAW
    devices:
      - /dev/net/tun
    volumes:
      - ./data:/data
      - /dev:/dev
      - /sys:/sys
      - /proc:/proc
```

**Required packages in container:**
```dockerfile
RUN apk add --no-cache \
    wireless-tools \
    wpa_supplicant \
    iw \
    hostapd \
    dnsmasq \
    dhclient
```

**Note:** `wpa_passphrase` is optional - if not available, passwords will be stored in plaintext in the config file.

**Advantages:**
- Network isolation from host
- No port conflicts

**Disadvantages:**
- Limited WiFi functionality
- NetworkManager not available
- More complex configuration

## Required Packages

### On Host System

Ensure these packages are installed on the host:

```bash
# Debian/Ubuntu
sudo apt-get install network-manager wireless-tools wpasupplicant

# Alpine (for IOT-GATE devices)
apk add networkmanager wireless-tools wpa_supplicant iw
```

### In Docker Container (Bridge Mode)

Add to your Dockerfile:

```dockerfile
FROM nodered/node-red:latest

USER root

# Install WiFi tools
RUN apk add --no-cache \
    wireless-tools \
    wpa_supplicant \
    iw \
    hostapd \
    dnsmasq \
    dhclient

USER node-red
```

Or install at runtime:

```bash
docker exec -u root node-red apk add --no-cache \
    wireless-tools \
    wpa_supplicant \
    iw \
    dhclient
```

**Minimum required for basic WiFi:**
- `wpa_supplicant` - For connecting to networks
- `iw` - For scanning and status
- `dhclient` or `udhcpc` - For getting IP address

**Optional for enhanced features:**
- `hostapd` + `dnsmasq` - For Access Point mode
- `wpa_passphrase` - For PSK generation (otherwise plaintext passwords are used)

## Feature Availability

| Feature | nmcli (Host Mode) | wpa_supplicant (Bridge) | Notes |
|---------|-------------------|-------------------------|-------|
| Status | ✅ | ✅ | Full details vs. basic info |
| Enable/Disable | ✅ | ✅ | Radio on/off vs. interface up/down |
| Scan | ✅ | ✅ | Requires `iw` in bridge mode |
| Connect | ✅ | ✅ | Requires `wpa_supplicant` in bridge mode |
| Disconnect | ✅ | ✅ | |
| Saved Connections | ✅ | ⚠️ | Limited in bridge mode |
| Delete Connection | ✅ | ⚠️ | Limited in bridge mode |
| Access Point | ✅ | ⚠️ | Requires `hostapd` + `dnsmasq` in bridge mode |

✅ = Fully supported  
⚠️ = Limited support or requires additional setup

## Troubleshooting

### "nmcli: not found"

**Solution 1 (Recommended):** Use host network mode:
```yaml
network_mode: host
```

**Solution 2:** Install WiFi tools in container (see above)

### "wpa_supplicant: not found"

Install in container:
```bash
docker exec -u root node-red apk add --no-cache wpa_supplicant
```

### "Operation not permitted"

Ensure container has required privileges:
```yaml
privileged: true
user: "0:0"
cap_add:
  - NET_ADMIN
  - NET_RAW
```

### WiFi Interface Not Found

Mount `/sys` and `/dev`:
```yaml
volumes:
  - /dev:/dev
  - /sys:/sys
```

### Connection Works but No IP Address

DHCP client might be missing:
```bash
docker exec -u root node-red apk add --no-cache dhclient
```

Or use `udhcpc` (usually pre-installed):
```bash
udhcpc -i wlan0
```

### Access Point Not Working

**Requirements:**
- `hostapd` installed
- `dnsmasq` installed
- WiFi adapter supports AP mode
- No other process using the WiFi interface

Check AP mode support:
```bash
iw list | grep "Supported interface modes" -A 8
```

Should show `AP` in the list.

### "Device or resource busy"

Another process (NetworkManager, wpa_supplicant) is using the interface:

```bash
# Stop NetworkManager (on host)
sudo systemctl stop NetworkManager

# Or kill wpa_supplicant
sudo killall wpa_supplicant
```

## Security Considerations

### Host Network Mode

- Container has full access to host network
- Can modify host network configuration
- Can intercept host network traffic
- Use only for trusted containers

### Bridge Mode

- More isolated from host
- Requires elevated privileges (`NET_ADMIN`)
- Still can affect host WiFi if misconfigured

### WiFi Credentials

- Stored in Node-RED credential store (encrypted)
- `wpa_supplicant` config files in `/tmp` (plaintext)
- Consider using environment variables:
  ```javascript
  msg.password = env.get("WIFI_PASSWORD");
  ```

## Example Flows

### Connect to WiFi (Auto-detect Method)

```json
[
    {
        "id": "wifi-connect",
        "type": "clab-wifi",
        "action": "connect",
        "wifiConfig": "home-wifi-config"
    }
]
```

The node automatically detects available tools and uses the best method.

### Check Connection Status

```json
[
    {
        "id": "wifi-status",
        "type": "clab-wifi",
        "action": "status"
    }
]
```

Output includes:
- `method`: "nmcli", "wpa_supplicant", or "iw"
- Connection details
- Signal strength (if available)

## Recommendations

1. **For Production:** Use host network mode for full WiFi functionality
2. **For Development:** Bridge mode with fallbacks is acceptable
3. **For Security:** Use bridge mode and limit WiFi operations
4. **For Simplicity:** Use host network mode and NetworkManager

## Testing WiFi Tools

Test which tools are available in your container:

```bash
# Check nmcli
docker exec node-red which nmcli

# Check wpa_supplicant
docker exec node-red which wpa_supplicant

# Check iw
docker exec node-red which iw

# Check hostapd
docker exec node-red which hostapd
```

## Further Reading

- [NetworkManager Documentation](https://networkmanager.dev/)
- [wpa_supplicant Documentation](https://w1.fi/wpa_supplicant/)
- [iw Documentation](https://wireless.wiki.kernel.org/en/users/documentation/iw)
- [Docker Network Modes](https://docs.docker.com/network/)
