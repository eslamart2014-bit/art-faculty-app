const fs = require('fs');

function applyFix(filePath, scanHandlerName) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Inject state variables
  const stateInjection = `
  // Camera state
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [cameraIndex, setCameraIndex] = useState(0);

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0) {
          setCameraIndex(videoDevices.length - 1);
          setSelectedCameraId(videoDevices[videoDevices.length - 1].deviceId);
        }
      });
    }
  }, []);

  const switchCamera = () => {
    if (cameraDevices.length > 1) {
      const nextIndex = (cameraIndex + 1) % cameraDevices.length;
      setCameraIndex(nextIndex);
      setSelectedCameraId(cameraDevices[nextIndex].deviceId);
    }
  };
`;
  
  if (!content.includes('setCameraDevices')) {
    // find a good place to inject. After `const [loading, setLoading] = useState(true);`
    content = content.replace(/const \[loading, setLoading\] = useState\(true\);/g, `const [loading, setLoading] = useState(true);\n${stateInjection}`);
  }

  // 2. Inject switch button in modal header
  if (!content.includes('🔄 تبديل الكاميرا')) {
    content = content.replace(
      /(<h3 style={{ margin: 0, color: "#2196F3", fontSize: "16px" }}>📸 ماسح [^<]+<\/h3>)/g,
      `$1\n            {cameraDevices.length > 1 && <button onClick={switchCamera} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: "8px", color: "#fff", fontSize: "14px", padding: "5px 10px", cursor: "pointer", marginRight: "auto", marginLeft: "15px" }}>🔄 تبديل الكاميرا</button>}`
    );
  }

  // 3. Modify scanner constraint
  content = content.replace(
    /constraints=\{\{ facingMode: \{ exact: "environment" \} \}\}/g,
    `constraints={selectedCameraId ? { deviceId: selectedCameraId } : { facingMode: { exact: "environment" } }}`
  );

  fs.writeFileSync(filePath, content);
}

applyFix('src/app/course/[id]/attendance/page.tsx', 'handleCameraScan');
applyFix('src/app/course/[id]/evaluations/page.tsx', 'handleCameraScan');

console.log("Fix applied!");
