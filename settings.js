/**
 * Node-RED Settings für CompuLab IoT Gateways
 */
module.exports = {
    // Benutzerverzeichnis
    userDir: '/data',
    
    // Flow-Datei
    flowFile: 'flows.json',
    
    // Credential-Verschlüsselung
    credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET || false,
    
    // HTTP-Einstellungen
    uiPort: process.env.PORT || 1880,
    uiHost: "0.0.0.0",
    
    // Admin-Authentifizierung (optional)
    // adminAuth: {
    //     type: "credentials",
    //     users: [{
    //         username: "admin",
    //         password: "$2b$08$...", // bcrypt hash
    //         permissions: "*"
    //     }]
    // },
    
    // Logging
    logging: {
        console: {
            level: "info",
            metrics: false,
            audit: false
        }
    },
    
    // Editor-Einstellungen
    editorTheme: {
        projects: {
            enabled: true
        },
        palette: {
            catalogues: [
                'https://catalogue.nodered.org/catalogue.json'
            ]
        },
        tours: false
    },
    
    // Funktions-Globals
    functionGlobalContext: {
        os: require('os'),
        fs: require('fs'),
        path: require('path')
    },
    
    // Context Storage
    contextStorage: {
        default: {
            module: "localfilesystem"
        }
    },
    
    // Export-Einstellungen
    exportGlobalContextKeys: false,
    
    // Debug-Modus
    debugMaxLength: 1000
};
