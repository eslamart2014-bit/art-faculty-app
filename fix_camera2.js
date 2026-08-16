const fs = require('fs');

function applyFix(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace import
  content = content.replace('import { Scanner } from "@yudiel/react-qr-scanner";', 'import QRScanner from "@/components/QRScanner";');
  
  // Replace component
  content = content.replace(/<Scanner[\s\S]*?constraints=\{\{ facingMode: \{ exact: "environment" \} \}\}[\s\S]*?\/>/g, 
    '<QRScanner onScan={(result) => { if (result) handleCameraScan(result); }} />');
    
  // If the constraints was already modified by fix_camera.js, use a broader regex:
  content = content.replace(/<Scanner[\s\S]*?\/>/g, '<QRScanner onScan={(result) => { if (result) handleCameraScan(result); }} />');

  fs.writeFileSync(filePath, content);
}

applyFix('src/app/course/[id]/attendance/page.tsx');
applyFix('src/app/course/[id]/evaluations/page.tsx');

console.log("Fix applied!");
