/**
 * نظام البصمة الرقمية للأجهزة (Device Fingerprinting)
 * لكشف تعدد الهواتف ومشاركة الطلاب لنفس الهاتف
 */

export interface DeviceInfo {
  deviceId: string;
  userAgent: string;
  platform: string;
  screenResolution: string;
  language: string;
  fingerprintHash: string;
}

export function getOrCreateDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      deviceId: 'server',
      userAgent: 'server',
      platform: 'server',
      screenResolution: '0x0',
      language: 'ar',
      fingerprintHash: 'server',
    };
  }

  // استخراج أو توليد معرف الجهاز الدائم
  let deviceId = localStorage.getItem('fania_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    localStorage.setItem('fania_device_id', deviceId);
  }

  const userAgent = navigator.userAgent || '';
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || 'Unknown';
  const screenResolution = `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio || 1}`;
  const language = navigator.language || 'ar';

  // توليد بصمة هاردوير عبر Canvas لتمييز الموبايل بدقة
  const canvasHash = generateCanvasFingerprint();
  const rawFingerprint = `${userAgent}|${screenResolution}|${canvasHash}|${language}`;
  const fingerprintHash = simpleHash(rawFingerprint);

  return {
    deviceId,
    userAgent,
    platform,
    screenResolution,
    language,
    fingerprintHash,
  };
}

function generateCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'nocanvas';

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(10, 5, 60, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('FaniaArtEDU', 12, 8);

    return simpleHash(canvas.toDataURL());
  } catch (e) {
    return 'error';
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
