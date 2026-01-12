# Bluetooth in Docker

## Problem: bluetoothctl not found

Wenn Sie Bluetooth-Funktionen verwenden und den Fehler `bluetoothctl: not found` sehen, fehlen die Bluetooth-Tools im Container.

## Lösung: BlueZ installieren

### Option 1: BlueZ im laufenden Container installieren (Temporär)

```bash
# Für Alpine-basierte Images (nodered/node-red)
docker exec -it node-red-clab sh
apk add bluez bluez-deprecated

# Für Debian/Ubuntu-basierte Images
docker exec -it node-red-clab bash
apt-get update && apt-get install -y bluez
```

**Hinweis:** Diese Installation geht bei Container-Neustart verloren!

### Option 2: Custom Dockerfile (Permanent)

Erstellen Sie ein `Dockerfile.bluetooth`:

```dockerfile
FROM nodered/node-red:latest

USER root

# Install BlueZ (Bluetooth tools)
RUN apk add --no-cache \
    bluez \
    bluez-deprecated \
    dbus

USER node-red
```

Bauen und starten:

```bash
# Build custom image
docker build -f Dockerfile.bluetooth -t node-red-clab:bluetooth .

# Update docker-compose.yml
# Change: image: nodered/node-red:latest
# To:     image: node-red-clab:bluetooth

# Start
docker-compose -f docker-compose.host-network.yml up -d
```

### Option 3: docker-compose mit build (Empfohlen)

Erstellen Sie `Dockerfile.bluetooth` (siehe Option 2), dann:

```yaml
# docker-compose.bluetooth.yml
version: '3.8'

services:
  node-red:
    build:
      context: .
      dockerfile: Dockerfile.bluetooth
    container_name: node-red-clab
    restart: unless-stopped
    network_mode: host
    volumes:
      - node-red-data:/data
      - ./:/data/node_modules/node-red-contrib-clab-interfaces:ro
      - /dev:/dev
      - /sys:/sys
      - /proc:/proc:ro
      - /run/dbus:/run/dbus:ro
    environment:
      - TZ=Europe/Berlin
    privileged: true
    user: "0:0"
    group_add:
      - dialout

volumes:
  node-red-data:
```

Starten:

```bash
docker-compose -f docker-compose.bluetooth.yml up -d --build
```

## Bluetooth-Tools Übersicht

| Tool | Funktion | Verfügbarkeit |
|------|----------|---------------|
| **bluetoothctl** | Modernes Bluetooth-Management | ✅ Empfohlen (BlueZ 5.x) |
| **hciconfig** | Legacy Adapter-Konfiguration | ⚠️ Deprecated (BlueZ 4.x) |
| **hcitool** | Legacy Scan/Pairing | ⚠️ Deprecated |
| **rfkill** | RF Kill Switch | Optional |

## Fallback-Hierarchie

Der Bluetooth-Helper verwendet automatische Fallbacks:

| Funktion | Primär | Fallback | Ohne Tools |
|----------|--------|----------|------------|
| **isAvailable** | `/sys/class/bluetooth` | `bluetoothctl list` | `hciconfig` |
| **getAdapterInfo** | `bluetoothctl show` | `hciconfig -a` | `/sys/class/bluetooth` |
| **enable/disable** | `bluetoothctl power` | `hciconfig up/down` | ❌ |
| **scan** | `bluetoothctl scan` | `hcitool scan` | ❌ |
| **connect** | `bluetoothctl connect` | ❌ | ❌ |

## Docker-Konfiguration für Bluetooth

### Erforderliche Berechtigungen:

```yaml
services:
  node-red:
    privileged: true          # ✅ Erforderlich
    network_mode: host        # ✅ Empfohlen
    volumes:
      - /var/run/dbus:/var/run/dbus:ro  # ✅ D-Bus für bluetoothd
      - /sys:/sys               # ✅ Bluetooth-Hardware
```

### D-Bus Zugriff:

Bluetooth verwendet D-Bus für die Kommunikation mit `bluetoothd`:

```bash
# Prüfen ob D-Bus verfügbar ist
docker exec node-red-clab ls -la /var/run/dbus/system_bus_socket

# Prüfen ob bluetoothd läuft (auf Host)
systemctl status bluetooth
```

## Testen

### 1. Prüfen ob BlueZ installiert ist:

```bash
docker exec node-red-clab which bluetoothctl
# Sollte zeigen: /usr/bin/bluetoothctl
```

### 2. Adapter Info:

```bash
docker exec node-red-clab bluetoothctl show
# Zeigt: Controller Info, MAC, Status
```

### 3. Scan testen:

```bash
docker exec node-red-clab bluetoothctl scan on
# Wartet 5 Sekunden
docker exec node-red-clab bluetoothctl scan off
docker exec node-red-clab bluetoothctl devices
# Zeigt: Gefundene Geräte
```

## Troubleshooting

### Problem: "No default controller available"

```bash
# Prüfen ob Bluetooth-Hardware erkannt wird
docker exec node-red-clab hciconfig -a
# oder
docker exec node-red-clab ls /sys/class/bluetooth/
```

**Lösung:**
- Prüfen Sie ob Bluetooth auf dem Host aktiviert ist
- Verwenden Sie `network_mode: host`
- Prüfen Sie `privileged: true`

### Problem: "Failed to start discovery: org.bluez.Error.NotReady"

```bash
# Bluetooth aktivieren
docker exec node-red-clab bluetoothctl power on
```

### Problem: "D-Bus connection failed"

```bash
# Prüfen ob D-Bus Socket gemountet ist
docker exec node-red-clab ls -la /var/run/dbus/

# Prüfen ob bluetoothd auf Host läuft
systemctl status bluetooth
```

**Lösung:**
```yaml
volumes:
  - /var/run/dbus:/var/run/dbus:ro  # ✅ Hinzufügen
```

### Problem: "Permission denied"

```bash
# Container muss als root laufen für Bluetooth
docker exec node-red-clab whoami
# Sollte zeigen: root
```

**Lösung:**
```yaml
user: "0:0"  # ✅ Root-User
privileged: true  # ✅ Privileged Mode
```

## Empfohlene Konfiguration

Für vollständige Bluetooth-Unterstützung:

```yaml
version: '3.8'

services:
  node-red:
    build:
      context: .
      dockerfile: Dockerfile.bluetooth
    container_name: node-red-clab
    restart: unless-stopped
    network_mode: host          # ✅ Erforderlich
    privileged: true            # ✅ Erforderlich
    user: "0:0"                 # ✅ Root
    volumes:
      - node-red-data:/data
      - ./:/data/node_modules/node-red-contrib-clab-interfaces:ro
      - /dev:/dev               # ✅ Hardware-Zugriff
      - /sys:/sys               # ✅ Bluetooth-Hardware
      - /var/run/dbus:/var/run/dbus:ro  # ✅ D-Bus
    environment:
      - TZ=Europe/Berlin

volumes:
  node-red-data:
```

## Zusammenfassung

| Anforderung | Status | Lösung |
|-------------|--------|--------|
| BlueZ installiert | ❌ Fehlt | `apk add bluez` oder Dockerfile |
| D-Bus Zugriff | ⚠️ Mount | `/var/run/dbus` Volume |
| Host Networking | ⚠️ Optional | `network_mode: host` |
| Privileged Mode | ✅ Vorhanden | `privileged: true` |
| Root User | ✅ Vorhanden | `user: "0:0"` |

**Wichtigste Schritte:**
1. ✅ BlueZ installieren (`apk add bluez bluez-deprecated`)
2. ✅ D-Bus mounten (`/var/run/dbus:/var/run/dbus:ro`)
3. ✅ Host Networking verwenden (`network_mode: host`)
4. ✅ Container neu starten
