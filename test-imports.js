// Test ES6 imports
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

console.log('Lighthouse:', typeof lighthouse);
console.log('Chrome Launcher:', typeof chromeLauncher);
console.log('Chrome Launcher launch:', typeof chromeLauncher.launch);
