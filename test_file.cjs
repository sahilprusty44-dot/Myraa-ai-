const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
console.log(code.includes('isCameraActive'));
