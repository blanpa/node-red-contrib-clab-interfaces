# Docker Network Configuration

## Problem: Container sieht Docker Bridge IP statt Host IP

Wenn Sie den Ethernet-Node verwenden und eine IP wie `172.20.0.2` sehen, ist das die **Docker Bridge IP**, nicht die echte Host-IP.

### Beispiel:

```json
{
  "interface": "eth0",
  "ipAddress": "172.20.0.2",      // ❌ Docker Bridge IP
  "isDockerBridge": true,
  "note": "This is a Docker bridge IP..."
}
```

**Echte Host-IP:** `192.168.100.147` (wird nicht angezeigt)

## Lösung: Host Network Mode

### Option 1: Host Network Mode verwenden (Empfohlen)

Verwenden Sie `docker-compose.host-network.yml` statt `docker-compose.yml`:

```bash
# Stoppen Sie den aktuellen Container
docker-compose down

# Starten Sie mit Host-Netzwerk
docker-compose -f docker-compose.host-network.yml up -d
```

**Vorteile:**
- ✅ Sieht echte Host-IPs
- ✅ Zugriff auf alle Netzwerk-Interfaces
- ✅ WiFi, Bluetooth, Ethernet funktionieren wie auf dem Host
- ✅ Keine Port-Mappings nötig

**Nachteile:**
- ⚠️ Container teilt Netzwerk-Stack mit Host
- ⚠️ Weniger Isolation

### Option 2: Bridge Network behalten (Standard)

Wenn Sie Bridge-Netzwerk behalten möchten:

```yaml
# docker-compose.yml (aktuell)
services:
  node-red:
    ports:
      - "1880:1880"
    networks:
      - clab-network
```

**Vorteile:**
- ✅ Bessere Isolation
- ✅ Port-Mapping möglich

**Nachteile:**
- ❌ Sieht nur Docker-IPs
- ❌ Kein direkter Zugriff auf Host-Interfaces
- ❌ WiFi/Bluetooth-Konfiguration nicht möglich

## Vergleich

| Feature | Bridge Mode | Host Mode |
|---------|-------------|-----------|
| **Node-RED Zugriff** | http://localhost:1880 | http://localhost:1880 |
| **Ethernet IP** | 172.20.0.2 (Docker) | 192.168.100.147 (Host) |
| **WiFi Konfiguration** | ❌ Nicht möglich | ✅ Möglich |
| **Bluetooth** | ❌ Eingeschränkt | ✅ Voll funktionsfähig |
| **GPIO/LED** | ✅ Funktioniert | ✅ Funktioniert |
| **Serial** | ✅ Funktioniert | ✅ Funktioniert |
| **Netzwerk-Isolation** | ✅ Isoliert | ❌ Geteilt mit Host |

## Empfehlung für IoT Gateway

Für ein **CompuLab IoT Gateway** empfehlen wir **Host Network Mode**, weil:

1. ✅ Vollständiger Zugriff auf alle Hardware-Interfaces
2. ✅ Echte IP-Adressen für Monitoring
3. ✅ WiFi und Bluetooth Konfiguration
4. ✅ Netzwerk-Diagnose (Ping, Traceroute, etc.)
5. ✅ Einfachere Konfiguration

## Migration

### Von Bridge zu Host Network:

```bash
# 1. Stoppen und entfernen
docker-compose down

# 2. Mit Host-Netzwerk starten
docker-compose -f docker-compose.host-network.yml up -d

# 3. Prüfen
docker logs node-red-clab
```

### Von Host zu Bridge Network:

```bash
# 1. Stoppen
docker-compose -f docker-compose.host-network.yml down

# 2. Mit Bridge-Netzwerk starten
docker-compose up -d
```

## Testen

### Bridge Mode Test:
```bash
docker exec node-red-clab ip addr show eth0
# Zeigt: 172.20.0.2/16 (Docker Bridge)
```

### Host Mode Test:
```bash
docker exec node-red-clab ip addr show eth0
# Zeigt: 192.168.100.147/24 (Host IP)
```

## Sicherheitshinweise

### Host Network Mode:
- Container hat vollen Zugriff auf Host-Netzwerk
- Keine Firewall zwischen Container und Host-Netzwerk
- Empfohlen für dedizierte IoT Gateways
- **Nicht empfohlen** für Multi-Tenant-Umgebungen

### Bridge Mode:
- Container ist vom Host-Netzwerk isoliert
- Firewall-Regeln können angewendet werden
- Empfohlen für Entwicklung und Tests
- Eingeschränkte Hardware-Funktionalität

## Weitere Informationen

- [Docker Networking](https://docs.docker.com/network/)
- [Host Network Driver](https://docs.docker.com/network/host/)
- [CompuLab IoT Gateway Dokumentation](https://www.compulab.com/)
