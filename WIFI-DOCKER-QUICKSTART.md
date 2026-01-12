# WiFi Docker Quick Start

If you get the error message `wpa_supplicant: not found` or `nmcli: not found`, there are three solutions:

## ⚡ Quick Solution 1: Host Network Mode (Recommended)

Modify your `docker-compose.yml`:

```yaml
services:
  node-red:
    image: nodered/node-red:latest
    network_mode: host  # ← Add this line
    privileged: true
    user: "0:0"
    volumes:
      - ./data:/data
      - /dev:/dev
      - /sys:/sys
      - /proc:/proc
      - /run/dbus:/run/dbus
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

**Advantages:**
- ✅ Full access to NetworkManager (`nmcli`)
- ✅ All WiFi features work immediately
- ✅ No additional installation required

**Disadvantage:**
- ⚠️ Container shares network with host

---

## 🔧 Quick Solution 2: Install WiFi Tools

Install the required tools in the running container:

```bash
# Find container name
docker ps

# Install WiFi tools (Alpine Linux)
docker exec -u root <container-name> apk add --no-cache \
    wireless-tools \
    wpa_supplicant \
    iw \
    dhclient

# Or for Debian/Ubuntu-based containers
docker exec -u root <container-name> apt-get update && \
docker exec -u root <container-name> apt-get install -y \
    wireless-tools \
    wpasupplicant \
    iw \
    dhclient
```

**Example:**
```bash
docker exec -u root node-red apk add --no-cache \
    wireless-tools \
    wpa_supplicant \
    iw \
    dhclient
```

**Advantages:**
- ✅ Network isolation remains intact
- ✅ No docker-compose.yml modification needed

**Disadvantages:**
- ⚠️ Tools must be reinstalled after each container restart
- ⚠️ Limited functionality (no NetworkManager)

---

## 🐳 Permanent Solution: Custom Dockerfile

Create your own container with pre-installed WiFi tools:

**Dockerfile:**
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

**docker-compose.yml:**
```yaml
services:
  node-red:
    build: .
    privileged: true
    user: "0:0"
    cap_add:
      - NET_ADMIN
      - NET_RAW
    volumes:
      - ./data:/data
      - /dev:/dev
      - /sys:/sys
```

**Build and Start:**
```bash
docker-compose build
docker-compose up -d
```

---

## 🧪 Testing

Check if the tools are available:

```bash
# nmcli (only with host network mode)
docker exec node-red which nmcli

# wpa_supplicant
docker exec node-red which wpa_supplicant

# iw
docker exec node-red which iw
```

If a tool is found, it returns the path (e.g. `/usr/sbin/wpa_supplicant`).

---

## 📊 Solution Comparison

| Solution | Setup Time | Functionality | Permanence | Recommended for |
|--------|-----------|----------------|-----------|---------------|
| **Host Network** | ⚡ 1 Min | ⭐⭐⭐⭐⭐ | ✅ Permanent | Production |
| **Install Tools** | ⚡ 2 Min | ⭐⭐⭐ | ❌ Temporary | Quick Test |
| **Custom Dockerfile** | 🔧 5 Min | ⭐⭐⭐⭐ | ✅ Permanent | Development |

---

## ❓ Common Issues

### "Operation not permitted"

Ensure the container runs privileged:
```yaml
privileged: true
user: "0:0"
```

### WiFi Interface Not Found

Mount `/dev` and `/sys`:
```yaml
volumes:
  - /dev:/dev
  - /sys:/sys
```

### Connection Fails

1. Check SSID and password
2. Check if the WiFi interface is enabled:
   ```bash
   docker exec node-red ip link show wlan0
   ```
3. Check logs:
   ```bash
   docker logs node-red
   ```

---

## 📚 Further Information

- Detailed documentation: [DOCKER-WIFI.md](DOCKER-WIFI.md)
- Multi-Network Setup: [WIFI-MULTI-NETWORK.md](WIFI-MULTI-NETWORK.md)
- Network Modes: [DOCKER-NETWORK.md](DOCKER-NETWORK.md)
