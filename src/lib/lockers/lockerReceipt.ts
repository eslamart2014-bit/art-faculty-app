/**
 * مولد استمارة تسجيل الدولاب الرسمية وتنزيلها كملف PDF
 * جامعة قنا - كلية التربية النوعية - قسم التربية الفنية
 * م/ إسلام عبداللطيف
 */

import { isAndroidAppClient } from "@/lib/auth/deviceFingerprint";

export interface LockerReceiptData {
  bookingId?: string;
  lockerCode: string;
  cohort: string;
  phone: string;
  studentNames: string[];
  studentCodes?: string[];
  studentCode?: string;
  date?: string;
  supervisorName?: string;
  status?: string;
}

/**
 * توليد كود الـ HTML الداخلي للورقة A4 (بدون Doctype أو tags خارجية)
 * ليتم استخدامه مباشرة في التحويل إلى PDF بدون أي تشوه أو صفحات فارغة
 */
export function getLockerReceiptPaperHtml(data: LockerReceiptData): string {
  const dateStr = data.date || new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const supervisor = data.supervisorName || 'م/ إسلام عبداللطيف';
  const names = data.studentNames || [];
  const capacity = Math.max(names.length, 4);

  // توليد صفوف جدول الأسماء - التنسيق الأصلي
  const rowsHtml = names
    .map((name, idx) => `
    <tr>
      <td style="border: 1px solid #000; padding: 8px; text-align: center; color: #000; font-weight: bold;">${idx + 1}</td>
      <td style="border: 1px solid #000; padding: 8px 15px 8px 8px; text-align: right; color: #000; font-weight: bold;">${name}</td>
      <td style="border: 1px solid #000; padding: 8px; text-align: center; color: #666;">................................</td>
    </tr>
  `)
    .join('');

  // توليد محتوى مستطيل الأسماء للقص واللصق - التنسيق الأصلي
  const rowHeight = Math.floor(151 / capacity);
  const namesBoxHtml = names
    .map((name, idx) => `
      <div style="border-bottom: ${idx === names.length - 1 ? 'none' : '2px solid #000'}; height: ${rowHeight}px; line-height: ${rowHeight}px; display: flex; align-items: center; justify-content: center; padding: 0 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; box-sizing: border-box; color: #000; font-size: 16px; font-weight: bold;">
        ${name}
      </div>
    `)
    .join('');

  return `
    <div style="width: 794px; min-height: 1120px; background: #ffffff; color: #000000; padding: 40px; box-sizing: border-box; font-family: 'Cairo', 'Amiri', 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: center; margin: 0 auto; position: relative;">
      
      <!-- الترويسة العليا الأصلية -->
      <div style="position: relative; min-height: 24px; margin-bottom: 8px;">
        <div style="position: absolute; left: 0; top: 0; font-size: 13px; font-weight: bold; color: #000;">مشرف النظام: ${supervisor}</div>
        <div style="position: absolute; right: 0; top: 0; font-size: 13px; font-weight: bold; color: #000;">تاريخ التسجيل: ${dateStr}</div>
      </div>

      <h3 style="margin: 0; font-weight: bold; font-size: 20px; color: #000;">جامعة قنا</h3>
      <h4 style="margin: 2px 0; font-weight: 600; font-size: 16px; color: #000;">كلية التربية النوعية</h4>
      <h4 style="margin: 2px 0; font-weight: 600; font-size: 16px; color: #000;">قسم التربية الفنية</h4>
      <h3 style="margin: 6px 0 16px 0; font-weight: bold; font-size: 20px; text-decoration: underline; color: #000;">استمارة تسجيل دولاب</h3>

      <!-- جدول بيانات الدولاب الأساسية الأصلي -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 15px; font-weight: bold; border: 1px solid #000;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 8px; width: 33%; text-align: center; color: #000;">الفرقة</th>
            <th style="border: 1px solid #000; padding: 8px; width: 33%; text-align: center; color: #000;">كود الدولاب</th>
            <th style="border: 1px solid #000; padding: 8px; width: 34%; text-align: center; color: #000;">رقم الموبايل</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; color: #000;">${data.cohort || 'عام'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; font-size: 22px; font-weight: 900; color: #000;">${data.lockerCode}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; color: #000; direction: ltr;">${data.phone}</td>
          </tr>
        </tbody>
      </table>

      <!-- جدول أسماء الطلاب المشتركين والتوقيعات الأصلي -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 15px; font-weight: bold; border: 1px solid #000;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 8px; width: 10%; text-align: center; color: #000;">#</th>
            <th style="border: 1px solid #000; padding: 8px; width: 60%; text-align: center; color: #000;">الاسم</th>
            <th style="border: 1px solid #000; padding: 8px; width: 30%; text-align: center; color: #000;">التوقيع</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- الإقرار والتعهد الأصلي -->
      <p style="font-size: 14px; margin-top: 14px; margin-bottom: 20px; font-weight: bold; color: #000; text-align: center;">
        نقر نحن المذكور أسماؤنا باستلام الدولاب والمحافظة عليه، وفي حالة التلف نتكفل بإصلاحه.
      </p>

      <!-- خط القص الأصلي -->
      <div style="border-top: 1px dashed #000; margin: 25px 0;"></div>

      <p style="margin: 10px 0 15px 0; font-size: 13px; font-weight: bold; color: #000; text-align: center;">
        ✂️ قص هذا الجزء والصقه على الدولاب
      </p>

      <!-- المربع والمستطيل للقص الأصلي -->
      <div style="display: flex; justify-content: center; align-items: flex-start; gap: 10px; margin-top: 10px;">
        <div style="border: 3px double #000; width: 151px; height: 151px; font-size: 42px; font-weight: 900; line-height: 151px; text-align: center; background: #fff; color: #000; flex-shrink: 0; box-sizing: border-box;">
          ${data.lockerCode}
        </div>
        <div style="border: 3px double #000; width: 340px; height: 151px; text-align: center; font-size: 16px; font-weight: bold; background: #fff; color: #000; display: flex; flex-direction: column; box-sizing: border-box;">
          ${namesBoxHtml}
        </div>
      </div>

      <!-- التاريخ وتوقيع المشرف في الأسفل الأصلي -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 25px; font-size: 13px; font-weight: bold; color: #000;">
        <div>تاريخ التسجيل: <span style="direction: ltr; display: inline-block;">${dateStr}</span></div>
        <div>توقيع مشرف النظام: .......................................................</div>
      </div>
    </div>
  `;
}

/**
 * توليد كود HTML الكامل عند المعاينة في المتصفح
 */
export function generateLockerReceiptHtml(data: LockerReceiptData, isForPdfExport = false): string {
  if (isForPdfExport) {
    return getLockerReceiptPaperHtml(data);
  }

  const paperContent = getLockerReceiptPaperHtml(data);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>استمارة تسجيل دولاب - ${data.lockerCode}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Cairo", system-ui, -apple-system, sans-serif;
      direction: rtl;
      text-align: center;
      background: #0f172a;
      color: #000;
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .preview-card {
      width: 100%;
      max-width: 820px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      overflow: hidden;
      margin-top: 10px;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .no-print { display: none !important; }
      .preview-card { box-shadow: none; border-radius: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="width: 100%; max-width: 820px; background: #1e293b; border: 1px solid #334155; padding: 12px 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
    <div style="font-size: 14px; font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
      <span>📄</span>
      <span>استمارة تسجيل الدولاب (${data.lockerCode})</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px;">
        🖨️ طباعة
      </button>
    </div>
  </div>

  <div class="preview-card" id="paper-target">
    ${paperContent}
  </div>
</body>
</html>`;
}

/**
 * رسم استمارة الدولاب الرسمية مباشرة على Canvas فائق الدقة (2x A4)
 * مطابق تماماً للتصميم الأصلي بنسبة 100% وبدون أي اعتماد على html2canvas أو تشوه في WebView
 */
function renderLockerReceiptCanvas(data: LockerReceiptData): HTMLCanvasElement {
  const dateStr = data.date || new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const supervisor = data.supervisorName || 'م/ إسلام عبداللطيف';
  const rawNames = (data.studentNames || []).filter((n) => typeof n === 'string');
  const names = rawNames.length > 0 ? rawNames : ['', '', '', ''];
  const capacity = Math.max(names.length, 4);

  const logicalWidth = 794;
  const logicalHeight = 1123;
  const scale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = logicalWidth * scale;
  canvas.height = logicalHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.scale(scale, scale);
  ctx.direction = 'rtl';

  // خلفية الورقة البيضاء A4
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  const fontStack = '"Cairo", "Amiri", "Segoe UI", Tahoma, sans-serif';
  const leftX = 40;
  const rightX = 754;
  const tableWidth = rightX - leftX; // 714
  const centerX = logicalWidth / 2;  // 397

  // 1. الترويسة العليا الأصلية
  ctx.fillStyle = '#000000';
  ctx.font = `bold 13px ${fontStack}`;
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'right';
  ctx.fillText(`تاريخ التسجيل: ${dateStr}`, rightX, 48);

  ctx.textAlign = 'left';
  ctx.fillText(`مشرف النظام: ${supervisor}`, leftX, 48);

  // 2. العناوين الأكاديمية في المنتصف
  ctx.textAlign = 'center';
  ctx.font = `bold 20px ${fontStack}`;
  ctx.fillText('جامعة قنا', centerX, 76);

  ctx.font = `600 16px ${fontStack}`;
  ctx.fillText('كلية التربية النوعية', centerX, 102);
  ctx.fillText('قسم التربية الفنية', centerX, 126);

  ctx.font = `bold 20px ${fontStack}`;
  const titleText = 'استمارة تسجيل دولاب';
  ctx.fillText(titleText, centerX, 156);
  const titleMetrics = ctx.measureText(titleText);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX - titleMetrics.width / 2, 168);
  ctx.lineTo(centerX + titleMetrics.width / 2, 168);
  ctx.stroke();

  // 3. جدول بيانات الدولاب الأساسية الأصلي
  const t1Top = 186;
  const t1HeaderH = 38;
  const t1RowH = 44;
  const col1W = Math.round(tableWidth * 0.33); // 236 (الفرقة - يمين)
  const col2W = Math.round(tableWidth * 0.33); // 236 (كود الدولاب - وسط)
  const col3W = tableWidth - col1W - col2W;    // 242 (رقم الموبايل - يسار)

  const col1Right = rightX;
  const col1Left = col1Right - col1W;
  const col2Left = col1Left - col2W;
  const col3Left = leftX;

  // خلفية ترويسة الجدول الأول
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(leftX, t1Top, tableWidth, t1HeaderH);

  // حدود الجدول الأول
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(leftX, t1Top, tableWidth, t1HeaderH + t1RowH);

  // خط فاصل بين الترويسة والصف
  ctx.beginPath();
  ctx.moveTo(leftX, t1Top + t1HeaderH);
  ctx.lineTo(rightX, t1Top + t1HeaderH);
  // خطوط الأعمدة
  ctx.moveTo(col1Left, t1Top);
  ctx.lineTo(col1Left, t1Top + t1HeaderH + t1RowH);
  ctx.moveTo(col2Left, t1Top);
  ctx.lineTo(col2Left, t1Top + t1HeaderH + t1RowH);
  ctx.stroke();

  // نصوص ترويسة الجدول الأول
  ctx.fillStyle = '#000000';
  ctx.font = `bold 15px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.fillText('الفرقة', col1Left + col1W / 2, t1Top + t1HeaderH / 2);
  ctx.fillText('كود الدولاب', col2Left + col2W / 2, t1Top + t1HeaderH / 2);
  ctx.fillText('رقم الموبايل', col3Left + col3W / 2, t1Top + t1HeaderH / 2);

  // نصوص بيانات الجدول الأول
  const t1DataY = t1Top + t1HeaderH + t1RowH / 2;
  ctx.font = `bold 15px ${fontStack}`;
  ctx.fillText(data.cohort || 'عام', col1Left + col1W / 2, t1DataY);

  ctx.font = `900 22px ${fontStack}`;
  ctx.fillText(data.lockerCode || '', col2Left + col2W / 2, t1DataY);

  ctx.font = `bold 15px ${fontStack}`;
  ctx.direction = 'ltr';
  ctx.fillText(data.phone || '', col3Left + col3W / 2, t1DataY);
  ctx.direction = 'rtl';

  // 4. جدول أسماء الطلاب المشتركين والتوقيعات الأصلي
  const t2Top = t1Top + t1HeaderH + t1RowH + 18;
  const t2HeaderH = 38;
  const t2RowH = 38;
  const sCol1W = Math.round(tableWidth * 0.10); // 71 (# - يمين)
  const sCol2W = Math.round(tableWidth * 0.60); // 428 (الاسم - وسط)
  const sCol3W = tableWidth - sCol1W - sCol2W;  // 215 (التوقيع - يسار)

  const sCol1Left = rightX - sCol1W;
  const sCol2Left = sCol1Left - sCol2W;
  const sCol3Left = leftX;
  const t2TotalH = t2HeaderH + names.length * t2RowH;

  // خلفية ترويسة الجدول الثاني
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(leftX, t2Top, tableWidth, t2HeaderH);

  // الإطار الخارجي للجدول الثاني
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(leftX, t2Top, tableWidth, t2TotalH);

  // خطوط الأعمدة للجدول الثاني
  ctx.beginPath();
  ctx.moveTo(sCol1Left, t2Top);
  ctx.lineTo(sCol1Left, t2Top + t2TotalH);
  ctx.moveTo(sCol2Left, t2Top);
  ctx.lineTo(sCol2Left, t2Top + t2TotalH);
  ctx.stroke();

  // نصوص ترويسة الجدول الثاني
  ctx.fillStyle = '#000000';
  ctx.font = `bold 15px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.fillText('#', sCol1Left + sCol1W / 2, t2Top + t2HeaderH / 2);
  ctx.fillText('الاسم', sCol2Left + sCol2W / 2, t2Top + t2HeaderH / 2);
  ctx.fillText('التوقيع', sCol3Left + sCol3W / 2, t2Top + t2HeaderH / 2);

  // صفوف الطلاب
  names.forEach((name, idx) => {
    const rowTop = t2Top + t2HeaderH + idx * t2RowH;
    const rowMidY = rowTop + t2RowH / 2;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftX, rowTop);
    ctx.lineTo(rightX, rowTop);
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = `bold 15px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(idx + 1), sCol1Left + sCol1W / 2, rowMidY);

    ctx.textAlign = 'right';
    ctx.fillText(name || '', sCol1Left - 14, rowMidY);

    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.fillText('................................', sCol3Left + sCol3W / 2, rowMidY);
  });

  // 5. الإقرار والتعهد الأصلي
  const pledgeY = t2Top + t2TotalH + 28;
  ctx.fillStyle = '#000000';
  ctx.font = `bold 14px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.fillText(
    'نقر نحن المذكور أسماؤنا باستلام الدولاب والمحافظة عليه، وفي حالة التلف نتكفل بإصلاحه.',
    centerX,
    pledgeY
  );

  // 6. خط القص المتقطع الأصلي
  const cutLineY = pledgeY + 32;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(leftX, cutLineY);
  ctx.lineTo(rightX, cutLineY);
  ctx.stroke();
  ctx.setLineDash([]);

  const cutTextY = cutLineY + 24;
  ctx.fillStyle = '#000000';
  ctx.font = `bold 13px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.fillText('✂️ قص هذا الجزء والصقه على الدولاب', centerX, cutTextY);

  // 7. المربع والمستطيل للقص الأصلي (border: 3px double #000)
  const boxesTop = cutTextY + 20;
  const boxH = 151;
  const codeBoxW = 151;
  const namesBoxW = 340;
  const gap = 10;
  const totalBoxesW = codeBoxW + gap + namesBoxW; // 501
  const boxesStartLeft = (logicalWidth - totalBoxesW) / 2; // 146.5

  // في اتجاه RTL: مربع كود الدولاب على اليمين، ومستطيل الأسماء على اليسار
  const namesBoxX = boxesStartLeft;
  const codeBoxX = boxesStartLeft + namesBoxW + gap;

  const drawDoubleBorder = (x: number, y: number, w: number, h: number) => {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  };

  // مربع كود الدولاب
  drawDoubleBorder(codeBoxX, boxesTop, codeBoxW, boxH);
  ctx.fillStyle = '#000000';
  ctx.font = `900 42px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.fillText(data.lockerCode || '', codeBoxX + codeBoxW / 2, boxesTop + boxH / 2 + 2);

  // مستطيل أسماء الطلاب
  drawDoubleBorder(namesBoxX, boxesTop, namesBoxW, boxH);
  const innerRowH = boxH / capacity;
  names.forEach((name, idx) => {
    const rTop = boxesTop + idx * innerRowH;
    const rMid = rTop + innerRowH / 2;

    if (idx < names.length - 1) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(namesBoxX + 3.5, rTop + innerRowH);
      ctx.lineTo(namesBoxX + namesBoxW - 3.5, rTop + innerRowH);
      ctx.stroke();
    }

    ctx.fillStyle = '#000000';
    ctx.font = `bold 16px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.fillText(name || '', namesBoxX + namesBoxW / 2, rMid, namesBoxW - 16);
  });

  // 8. التاريخ وتوقيع المشرف في الأسفل الأصلي
  const footerY = boxesTop + boxH + 40;
  ctx.fillStyle = '#000000';
  ctx.font = `bold 13px ${fontStack}`;
  ctx.textAlign = 'right';
  ctx.fillText(`تاريخ التسجيل: ${dateStr}`, rightX, footerY);

  ctx.textAlign = 'left';
  ctx.fillText('توقيع مشرف النظام: .......................................................', leftX, footerY);

  return canvas;
}

/**
 * تنزيل استمارة الدولاب كملف PDF بدون صفحات فارغة، مع دعم كامل لبوت تليجرام وتطبيق الأندرويد والمتصفح
 */
export async function downloadLockerReceiptPdf(
  data: LockerReceiptData,
  onStatusChange?: (status: string) => void
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const notify = (msg: string) => {
    if (onStatusChange) onStatusChange(msg);
  };

  notify('جاري إعداد استمارة الـ PDF...');

  // 1. إنشاء الحاوية المرئية لمعاينة الاستمارة وإشعار المستخدم
  const existingOverlay = document.getElementById('locker-pdf-render-overlay');
  if (existingOverlay && existingOverlay.parentNode) {
    existingOverlay.parentNode.removeChild(existingOverlay);
  }

  const overlay = document.createElement('div');
  overlay.id = 'locker-pdf-render-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.94)';
  overlay.style.zIndex = '9999999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'flex-start';
  overlay.style.overflowY = 'auto';
  overlay.style.padding = '16px 8px';
  overlay.style.direction = 'rtl';

  const banner = document.createElement('div');
  banner.style.background = '#1e293b';
  banner.style.color = '#38bdf8';
  banner.style.border = '1.5px solid #0284c7';
  banner.style.padding = '12px 18px';
  banner.style.borderRadius = '12px';
  banner.style.marginBottom = '12px';
  banner.style.fontWeight = 'bold';
  banner.style.fontSize = '13px';
  banner.style.display = 'flex';
  banner.style.alignItems = 'center';
  banner.style.justifyContent = 'space-between';
  banner.style.flexWrap = 'wrap';
  banner.style.gap = '10px';
  banner.style.width = '100%';
  banner.style.maxWidth = '794px';
  banner.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
  banner.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><span>⏳</span><span>جاري إنشاء استمارة الدولاب وتحميلها كملف PDF عالي الدقة...</span></div>`;
  overlay.appendChild(banner);

  const paperTarget = document.createElement('div');
  paperTarget.id = 'locker-paper-pdf-target';
  paperTarget.style.width = '100%';
  paperTarget.style.maxWidth = '794px';
  paperTarget.style.background = '#ffffff';
  paperTarget.style.color = '#000000';
  paperTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
  paperTarget.style.borderRadius = '8px';
  paperTarget.style.overflowX = 'auto';
  paperTarget.innerHTML = getLockerReceiptPaperHtml(data);
  overlay.appendChild(paperTarget);

  document.body.appendChild(overlay);

  try {
    // انتظار جاهزية خطوط الصفحة (إن وجدت)
    if ((document as any).fonts?.ready) {
      await Promise.race([
        (document as any).fonts.ready,
        new Promise((r) => setTimeout(r, 300))
      ]);
    } else {
      await new Promise((r) => setTimeout(r, 150));
    }

    notify('جاري توليد ملف الـ PDF عالي الدقة...');
    const safeFilename = `استمارة_دولاب_${data.lockerCode}.pdf`;

    // توليد اللوحة الرسومية عالية الدقة (2x A4) وتحويلها إلى PDF عبر jsPDF مباشرة
    const canvas = renderLockerReceiptCanvas(data);
    const imgDataUrl = canvas.toDataURL('image/jpeg', 0.98);

    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    pdf.addImage(imgDataUrl, 'JPEG', 0, 0, 210, 297);
    const pdfBase64 = pdf.output('datauristring');

    // 1. إذا كان تطبيق الأندرويد الأصلي متوفراً عبر ArtEduNativeBridge
    const nativeBridge = (window as any).ArtEduNativeBridge;
    if (nativeBridge && typeof nativeBridge.saveBase64File === 'function') {
      try {
        nativeBridge.saveBase64File(pdfBase64, safeFilename, 'application/pdf');
        notify('تم تنزيل الاستمارة بنجاح!');
        banner.style.background = '#065f46';
        banner.style.color = '#34d399';
        banner.style.borderColor = '#10b981';
        banner.innerHTML = `<span>✅</span><span>تم تنزيل استمارة الدولاب لهاتفك بنجاح!</span>`;
        setTimeout(() => {
          if (document.body.contains(overlay)) document.body.removeChild(overlay);
        }, 1200);
        return true;
      } catch (e) {}
    }

    // 2. استخراج معرف تليجرام وكود الطالب لإرسال الـ PDF مباشرة في محادثة البوت + رابط تحميل رسمي
    let telegramId: string | null = null;
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.id) {
        telegramId = String(tg.initDataUnsafe.user.id);
      } else {
        const rawHash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash;
        if (rawHash) {
          const hashParams = new URLSearchParams(rawHash);
          const tgWebAppData = hashParams.get('tgWebAppData');
          if (tgWebAppData) {
            const userStr = new URLSearchParams(tgWebAppData).get('user');
            if (userStr) {
              const userObj = JSON.parse(userStr);
              if (userObj?.id) telegramId = String(userObj.id);
            }
          }
        }
        if (!telegramId) {
          telegramId = localStorage.getItem('fania_tg_id');
        }
      }
    } catch {}

    let studentCode = data.studentCode || null;
    if (!studentCode) {
      try {
        studentCode = localStorage.getItem('fania_student_code');
      } catch {}
    }

    notify('جاري حفظ وتنزيل الاستمارة...');

    let resJson: any = null;
    try {
      const res = await fetch('/api/students/lockers/receipt-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: safeFilename,
          pdfBase64,
          lockerCode: data.lockerCode,
          cohort: data.cohort,
          studentCode,
          studentCodes: data.studentCodes,
          telegramId
        })
      });
      resJson = await res.json();
    } catch (e) {
      console.warn('[downloadLockerReceiptPdf] Server upload fallback:', e);
    }

    const tg = (window as any).Telegram?.WebApp;
    const isInsideTelegramWebApp = Boolean(
      (tg?.initData && tg.initData.length > 0) ||
      /Telegram/i.test(navigator.userAgent || '')
    );

    const downloadUrl: string | null =
      resJson?.downloadUrl && !resJson?.isFallback ? resJson.downloadUrl : null;
    const fullDownloadUrl: string | null = downloadUrl
      ? new URL(downloadUrl, window.location.origin).toString()
      : resJson?.publicUrl || null;

    // 3. تشغيل التنزيل الفعلي حسب البيئة (تليجرام بوت / أندرويد / متصفح)
    const sentToTelegram = Boolean(resJson?.sentToTelegram);

    if (isInsideTelegramWebApp) {
      // داخل تطبيق تليجرام (Mini App):
      // أ) إذا كان تليجرام يدعم downloadFile الأصلية (الإصدارات الحديثة)
      if (fullDownloadUrl && typeof tg?.downloadFile === 'function') {
        try {
          tg.downloadFile({ url: fullDownloadUrl, file_name: safeFilename });
        } catch {}
      } else if (fullDownloadUrl && !sentToTelegram && typeof tg?.openLink === 'function') {
        // إذا لم يتم إرسالها للشات وكان الإصدار لا يدعم downloadFile، افتح الرابط الخارجي لتحميل الـ PDF مباشرة
        try {
          tg.openLink(fullDownloadUrl);
        } catch {}
      }

      // ب) تحميل عبر iframe مخفي في حال كان الـ WebView يسمح بـ Content-Disposition: attachment
      if (downloadUrl) {
        try {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = downloadUrl;
          document.body.appendChild(iframe);
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
          }, 15000);
        } catch {}
      }
    } else if (downloadUrl) {
      // متصفح الويب أو تطبيق الأندرويد: تنزيل مباشر عبر رابط السيرفر الرسمي + حفظ احتياطي
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = downloadUrl;
        document.body.appendChild(iframe);
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 15000);
      } catch {
        pdf.save(safeFilename);
      }
    } else {
      pdf.save(safeFilename);
    }

    notify(
      sentToTelegram
        ? 'تم التنزيل وإرسال نسخة PDF لمحادثة البوت!'
        : 'تم تنزيل الاستمارة بنجاح!'
    );

    banner.style.background = '#065f46';
    banner.style.color = '#ecfdf5';
    banner.style.borderColor = '#10b981';

    if (isInsideTelegramWebApp) {
      // داخل البوت: إبقاء المعاينة مفتوحة مع أزرار واضحة للتحميل الخارجي أو الإغلاق
      banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
          <span>✅</span>
          <span>${
            sentToTelegram
              ? 'تم إرسال ملف الاستمارة (PDF) مباشرة إلى محادثة البوت في تليجرام!'
              : 'تم تجهيز استمارة الدولاب بنجاح!'
          }</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${
            fullDownloadUrl
              ? `<button id="locker-pdf-open-ext-btn" type="button" style="background:#2563eb;color:#fff;border:none;padding:7px 14px;border-radius:8px;font-weight:bold;font-size:12px;cursor:pointer;width:auto;margin:0;">📥 فتح / تنزيل الملف</button>`
              : ''
          }
          <button id="locker-pdf-close-btn" type="button" style="background:#047857;color:#fff;border:1px solid #34d399;padding:7px 14px;border-radius:8px;font-weight:bold;font-size:12px;cursor:pointer;width:auto;margin:0;">إغلاق ✕</button>
        </div>
      `;

      const openExtBtn = document.getElementById('locker-pdf-open-ext-btn');
      if (openExtBtn && fullDownloadUrl) {
        openExtBtn.onclick = () => {
          if (typeof tg?.openLink === 'function') {
            tg.openLink(fullDownloadUrl);
          } else {
            window.open(fullDownloadUrl, '_blank');
          }
        };
      }

      const closeBtn = document.getElementById('locker-pdf-close-btn');
      if (closeBtn) {
        closeBtn.onclick = () => {
          if (document.body.contains(overlay)) document.body.removeChild(overlay);
        };
      }

      // إذا تم الإرسال لمحادثة البوت بنجاح، يمكن إغلاق النافذة تلقائياً بعد 3.5 ثانية أو يغلقها الطالب
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      }, 3500);
    } else {
      banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          <span>✅</span>
          <span>${
            sentToTelegram
              ? 'تم تنزيل الاستمارة + إرسال نسخة PDF لمحادثة البوت في تليجرام!'
              : 'تم تنزيل استمارة الدولاب (PDF) بنجاح!'
          }</span>
        </div>
      `;

      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      }, 1400);
    }

    return true;
  } catch (err: any) {
    console.error('[downloadLockerReceiptPdf] Failed:', err);
    notify('حدث خطأ أثناء تنزيل الاستمارة');
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
    previewLockerReceipt(data);
    return false;
  }
}

export function previewLockerReceipt(data: LockerReceiptData) {
  if (typeof window === 'undefined') return;
  const html = generateLockerReceiptHtml(data, false);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

export function printLockerReceipt(data: LockerReceiptData) {
  return downloadLockerReceiptPdf(data);
}
