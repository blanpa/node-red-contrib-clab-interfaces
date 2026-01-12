# Example Flow Setup Guide

This guide shows you how to use the included demo flow with your CompuLab IoT Gateway.

## Quick Start

### Option 1: Auto-load on Docker Startup (Recommended for Testing)

1. **Edit `docker-compose.yml`** and uncomment the example flow line:

```yaml
volumes:
  - node-red-data:/data
  - ./:/data/node_modules/node-red-contrib-clab-interfaces:ro
  - ./examples/compulab-demo-flow.json:/data/flows.json:ro  # ← Uncomment this line
  - /dev:/dev
  - /sys:/sys
```

2. **Start Node-RED:**

```bash
docker-compose down
docker-compose up -d
```

3. **Access Node-RED:** http://localhost:1880

The demo flow will be automatically loaded!

**⚠️ Warning:** This will replace any existing flows. Use Option 2 or 3 to preserve your flows.

---

### Option 2: Import in Node-RED UI (Recommended for Production)

1. **Start Node-RED:**

```bash
docker-compose up -d
```

2. **Open Node-RED:** http://localhost:1880

3. **Import the flow:**
   - Click the menu (☰) in the top-right
   - Select "Import"
   - Click "select a file to import"
   - Navigate to `examples/compulab-demo-flow.json`
   - Click "Import"

4. **Deploy:** Click the "Deploy" button

---

### Option 3: Copy to Existing Installation

```bash
# For local Node-RED installation
cp examples/compulab-demo-flow.json ~/.node-red/my-flow.json

# For Docker
docker cp examples/compulab-demo-flow.json node-red:/data/my-flow.json
```

Then import via the Node-RED UI (Option 2).

---

## What's Included

The demo flow includes examples for:

- ✅ **GPIO** - Digital input/output
- ✅ **LED** - LED control (on/off/blink)
- ✅ **Network** - Ping, DNS, traceroute
- ✅ **System** - System info, RTC
- ✅ **WiFi** - Status, scan, connect
- ✅ **Ethernet** - Interface status
- ✅ **Analog** - Sensor reading (4-20mA, 0-10V)
- ✅ **Serial** - RS485/RS232 communication

---

## Testing the Flow

### 1. Basic Network Test

Click the **"Ping Google"** inject node → Check the Debug panel

Expected output:
```json
{
  "success": true,
  "host": "8.8.8.8",
  "alive": true,
  "rtt": {
    "min": 10.5,
    "avg": 12.3,
    "max": 15.1
  }
}
```

### 2. System Info Test

Click the **"System Info"** inject node → Check the Debug panel

Expected output:
```json
{
  "hostname": "compulab-gateway",
  "platform": "linux",
  "arch": "arm64",
  "uptime": 123456,
  "memory": {...}
}
```

### 3. WiFi Status Test

Click the **"WiFi Status"** inject node → Check the Debug panel

Expected output:
```json
{
  "interface": "wlan0",
  "connected": true,
  "ssid": "MyNetwork",
  "ipAddress": "192.168.1.100"
}
```

### 4. LED Test

Click **"LED ON"** → Green LED should turn on

Click **"LED Blink"** → Green LED should blink

Click **"LED OFF"** → Green LED should turn off

### 5. GPIO Test

Click **"Read GPIO"** → Check the Debug panel for GPIO state

Click **"GPIO ON"** / **"GPIO OFF"** → Control GPIO output

---

## Customizing for Your Hardware

### Change Device Type

Edit the GPIO/LED nodes to match your device:

1. Double-click a GPIO or LED node
2. Change "Device Type" dropdown:
   - `IOT-GATE-IMX8PLUS`
   - `IOT-GATE-iMX8`
   - `IOT-DIN-IMX8PLUS`
   - `IOT-LINK`
   - `IOT-GATE-RPi`
3. Click "Done"
4. Click "Deploy"

### Change Serial Port

Edit the serial configuration:

1. Double-click the "Serial Out" node
2. Click the pencil icon next to "Serial Config"
3. Change the device path (e.g., `/dev/ttyLP1`, `/dev/ttyUSB0`)
4. Change baudrate if needed
5. Click "Update" → "Done" → "Deploy"

### Add WiFi Credentials

To test WiFi connection:

1. Double-click the "WiFi Status" node
2. Change action to "Connect"
3. Click the pencil icon next to "WiFi Network"
4. Add a new WiFi Config:
   - **Name**: "My Home WiFi"
   - **SSID**: Your network name
   - **Password**: Your WiFi password
5. Click "Add" → "Done" → "Deploy"
6. Click the inject node to connect

---

## Troubleshooting

### "Node type not found" error

**Solution:** Install the package:

```bash
# In Docker
docker exec -it node-red-clab npm install node-red-contrib-clab-interfaces
docker restart node-red-clab

# Or locally
cd ~/.node-red
npm install node-red-contrib-clab-interfaces
```

### "Permission denied" on GPIO/LED

**Solution:** Ensure Docker runs with proper privileges:

```yaml
privileged: true
user: "0:0"
volumes:
  - /dev:/dev
  - /sys:/sys
```

### WiFi commands fail with "not found"

**Solution:** Use host network mode:

```yaml
network_mode: host
```

Or install WiFi tools:

```bash
docker exec -u root node-red-clab apk add wireless-tools wpa_supplicant iw dhclient
```

See [WIFI-DOCKER-QUICKSTART.md](WIFI-DOCKER-QUICKSTART.md) for details.

### Serial port not accessible

**Solution:** Check device path:

```bash
ls -la /dev/ttyLP*
ls -la /dev/ttyUSB*
```

Ensure the device is mounted in Docker:

```yaml
volumes:
  - /dev:/dev
```

And user has permissions:

```yaml
group_add:
  - dialout
```

---

## Next Steps

### Build Your Own Flow

Use the demo flow as a template:

1. **Copy a section** you want to use
2. **Modify** the configuration for your needs
3. **Add logic** between nodes (function nodes, switches, etc.)
4. **Deploy and test**

### Common Patterns

**Industrial Monitoring:**
```
[Analog Input] → [Function: Convert] → [MQTT Out] → Cloud
```

**Remote Control:**
```
[MQTT In] → [Switch] → [GPIO Out] → Relay
```

**Data Logging:**
```
[Serial In] → [Function: Add Timestamp] → [File Out]
```

**Network Monitoring:**
```
[Inject: Every 5min] → [Ping] → [LED: Status Indicator]
```

### Example Repositories

Check out these example projects:

- Industrial sensor monitoring
- Remote device control
- Multi-module data acquisition
- Network diagnostics dashboard

(Coming soon - contributions welcome!)

---

## Support

- **Documentation**: [README.md](README.md)
- **Examples**: [examples/README.md](examples/README.md)
- **Docker Setup**: [DOCKER-WIFI.md](DOCKER-WIFI.md)
- **Issues**: GitHub Issues

---

## Contributing Examples

Have a useful flow? Share it!

1. Export your flow (Menu → Export)
2. Add documentation
3. Test on actual hardware
4. Submit a pull request

We especially welcome examples for:
- Multi-module configurations
- Industrial protocols (Modbus, etc.)
- Cloud integration (AWS, Azure, etc.)
- Dashboard UIs
- Complex automation scenarios
