#!/usr/bin/env node

/**
 * 🔄 Auto-Sync Script para Firebase Studio
 * 
 * Este script permite sincronización automática desde GitHub
 * Cada vez que hagas push, Firebase Studio se actualiza automáticamente
 */

const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

class FirebaseStudioSync {
  constructor() {
    this.server = null;
    this.isRunning = false;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const emojis = {
      info: '🔄',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      webhook: '📨'
    };
    
    console.log(`${emojis[type]} [${timestamp}] ${message}`);
  }

  startWebhookServer() {
    this.server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';
        
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            this.log(`Webhook recibido desde: ${payload.repository}:${payload.branch}`, 'webhook');
            
            // Ejecutar sincronización
            this.syncFromGitHub(payload);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'success', 
              message: 'Sync triggered successfully',
              timestamp: new Date().toISOString()
            }));
            
          } catch (error) {
            this.log(`Error procesando webhook: ${error.message}`, 'error');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      } else if (req.method === 'GET' && req.url === '/status') {
        // Status endpoint
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'running',
          uptime: process.uptime(),
          lastSync: this.lastSyncTime || null
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    this.server.listen(3001, () => {
      this.log('🚀 Webhook server iniciado en puerto 3001');
      this.log('📍 Endpoint: http://localhost:3001/webhook');
      this.log('📊 Status: http://localhost:3001/status');
    });
  }

  async syncFromGitHub(payload = null) {
    try {
      this.log('Iniciando sincronización desde GitHub...', 'info');
      
      // 1. Fetch latest changes
      this.log('📥 Obteniendo cambios desde GitHub...');
      execSync('git fetch origin', { stdio: 'pipe' });
      
      // 2. Check current branch
      const currentBranch = execSync('git branch --show-current', { 
        encoding: 'utf8' 
      }).trim();
      
      this.log(`📍 Rama actual: ${currentBranch}`);
      
      // 3. Pull changes
      this.log('⬇️ Descargando cambios...');
      execSync(`git pull origin ${currentBranch}`, { stdio: 'inherit' });
      
      // 4. Check for package.json changes
      if (this.hasFileChanged('package.json') || this.hasFileChanged('package-lock.json')) {
        this.log('📦 Detectados cambios en dependencias, instalando...', 'info');
        execSync('npm install', { stdio: 'inherit' });
      }
      
      // 5. Check for environment file changes
      if (this.hasFileChanged('.env.local') || this.hasFileChanged('.env')) {
        this.log('🔧 Detectados cambios en variables de entorno', 'warning');
      }
      
      this.lastSyncTime = new Date().toISOString();
      this.log('Sincronización completada exitosamente!', 'success');
      
      // 6. Restart dev server if needed
      await this.restartDevServer();
      
    } catch (error) {
      this.log(`Error en sincronización: ${error.message}`, 'error');
      throw error;
    }
  }

  hasFileChanged(filename) {
    try {
      const result = execSync(
        `git diff HEAD~1 HEAD --name-only | grep -E "^${filename}$"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }

  async restartDevServer() {
    try {
      this.log('🔄 Reiniciando servidor de desarrollo...', 'info');
      
      // Kill existing Next.js dev server
      try {
        execSync('pkill -f "next dev"', { stdio: 'pipe' });
        this.log('🛑 Servidor anterior detenido');
      } catch {
        // No existing server running
      }
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start new dev server in background
      const logFile = 'firebase-studio-dev.log';
      execSync(`nohup npm run dev > ${logFile} 2>&1 &`, { 
        stdio: 'pipe',
        detached: true
      });
      
      this.log('🚀 Servidor de desarrollo reiniciado', 'success');
      this.log(`📄 Logs disponibles en: ${logFile}`);
      
    } catch (error) {
      this.log(`Advertencia al reiniciar servidor: ${error.message}`, 'warning');
    }
  }

  startPeriodicCheck() {
    // Check for updates every 5 minutes as backup
    setInterval(async () => {
      try {
        this.log('🔍 Verificación periódica de actualizaciones...');
        
        execSync('git fetch origin', { stdio: 'pipe' });
        
        const localCommit = execSync('git rev-parse HEAD', { 
          encoding: 'utf8' 
        }).trim();
        
        const remoteCommit = execSync('git rev-parse origin/main', { 
          encoding: 'utf8' 
        }).trim();
        
        if (localCommit !== remoteCommit) {
          this.log('🔄 Cambios detectados, sincronizando...', 'info');
          await this.syncFromGitHub();
        }
        
      } catch (error) {
        this.log(`Error en verificación periódica: ${error.message}`, 'error');
      }
    }, 5 * 60 * 1000); // 5 minutos
  }

  start() {
    if (this.isRunning) {
      this.log('El servicio ya está ejecutándose', 'warning');
      return;
    }

    this.isRunning = true;
    
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                🔄 FIREBASE STUDIO AUTO-SYNC                 ║
║                                                              ║
║  ✅ Sincronización automática GitHub → Firebase Studio      ║
║  🚀 Webhook server en puerto 3001                           ║
║  🔄 Verificación periódica cada 5 minutos                   ║
║                                                              ║
║  Para detener: Ctrl+C                                       ║
╚══════════════════════════════════════════════════════════════╝
    `);

    // Start webhook server
    this.startWebhookServer();
    
    // Start periodic check as backup
    this.startPeriodicCheck();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
    
    this.log('🎉 Firebase Studio Auto-Sync iniciado correctamente!', 'success');
  }

  stop() {
    if (!this.isRunning) return;

    this.log('🛑 Deteniendo Firebase Studio Auto-Sync...', 'warning');
    
    if (this.server) {
      this.server.close();
      this.log('🔌 Webhook server detenido');
    }
    
    this.isRunning = false;
    this.log('✅ Auto-Sync detenido correctamente', 'success');
    process.exit(0);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  const sync = new FirebaseStudioSync();
  sync.start();
}

module.exports = FirebaseStudioSync;