#!/usr/bin/env node

/**
 * 🔄 Force Sync Script for Firebase Studio
 * This script forces a file system sync and notifies Firebase Studio
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Forcing Firebase Studio sync...');

// Create a timestamp file to trigger change detection
const timestampFile = path.join(__dirname, '.firebase-studio-sync');
const timestamp = new Date().toISOString();

fs.writeFileSync(timestampFile, `Last sync: ${timestamp}\nForced sync to update Firebase Studio with latest changes.`);

console.log(`✅ Timestamp file created: ${timestamp}`);

// Also update a file that Firebase Studio monitors
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.lastSync = timestamp;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Package.json updated with sync timestamp');
}

console.log('🎯 Force sync completed. Firebase Studio should update within 30 seconds.');
console.log('If the issue persists, try refreshing your Firebase Studio browser tab.');