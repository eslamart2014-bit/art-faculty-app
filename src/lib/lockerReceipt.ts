/**
 * مولد استمارة تسجيل الدولاب الرسمية وتنزيلها كملف PDF
 * جامعة قنا - كلية التربية النوعية - قسم التربية الفنية
 * م/ إسلام عبداللطيف
 */

import { isAndroidAppClient } from "@/lib/deviceFingerprint";

export interface LockerReceiptData {
  bookingId?: string;
  lockerCode: string;
  cohort: string;
  phone: string;
  studentNames: string[];
  studentCodes?: string[];
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
 * تنزيل استمارة الدولاب كملف PDF بدون صفحات فارغة
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

  // 1. إنشاء الحاوية في أعلى طبقة DOM مرئية وبخلفية معتمة خفيفة
  // هذا يضمن أن يلتقط html2canvas المحتوى الحقيقي الفعلي كاملاً بدون أي صفحات بيضاء فارغة
  const overlay = document.createElement('div');
  overlay.id = 'locker-pdf-render-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.92)';
  overlay.style.zIndex = '9999999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'flex-start';
  overlay.style.overflowY = 'auto';
  overlay.style.padding = '16px 8px';
  overlay.style.direction = 'rtl';

  // شريط الإشعار للمستخدم
  const banner = document.createElement('div');
  banner.style.background = '#1e293b';
  banner.style.color = '#38bdf8';
  banner.style.border = '1.5px solid #0284c7';
  banner.style.padding = '10px 18px';
  banner.style.borderRadius = '10px';
  banner.style.marginBottom = '12px';
  banner.style.fontWeight = 'bold';
  banner.style.fontSize = '13px';
  banner.style.display = 'flex';
  banner.style.alignItems = 'center';
  banner.style.gap = '8px';
  banner.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
  banner.innerHTML = `<span>⏳</span><span>جاري إنشاء استمارة الدولاب وتحميلها كملف PDF عالي الدقة...</span>`;
  overlay.appendChild(banner);

  // وعاء الورقة الفعلي المرئي بالكامل
  const paperTarget = document.createElement('div');
  paperTarget.id = 'locker-paper-pdf-target';
  paperTarget.style.width = '794px';
  paperTarget.style.minWidth = '794px';
  paperTarget.style.background = '#ffffff';
  paperTarget.style.color = '#000000';
  paperTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
  paperTarget.style.borderRadius = '4px';
  paperTarget.style.overflow = 'hidden';
  paperTarget.innerHTML = getLockerReceiptPaperHtml(data);
  overlay.appendChild(paperTarget);

  document.body.appendChild(overlay);

  try {
    // انتظار 300ms لضمان اكتمال بناء وتصيير الـ DOM والخطوط
    await new Promise((resolve) => setTimeout(resolve, 300));

    notify('جاري توليد ملف الـ PDF عالي الدقة...');
    const html2pdf = (await import('html2pdf.js')).default;
    const safeFilename = `استمارة_دولاب_${data.lockerCode}.pdf`;

    const opt = {
      margin: 6,
      filename: safeFilename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollY: 0,
        scrollX: 0
      },
      jsPDF: {
        unit: 'mm' as const,
        format: 'a4' as const,
        orientation: 'portrait' as const
      }
    };

    const worker = html2pdf().set(opt).from(paperTarget);

    const isApp = isAndroidAppClient();

    if (isApp) {
      notify('جاري تنزيل الملف لهاتفك...');
      // 1. توليد Base64
      const pdfBase64 = await worker.outputPdf('datauristring');

      // 2. إذا كان NativeBridge متوفراً، حفظ مباشر
      const nativeBridge = (window as any).ArtEduNativeBridge;
      if (nativeBridge && typeof nativeBridge.saveBase64File === 'function') {
        try {
          nativeBridge.saveBase64File(pdfBase64, safeFilename, 'application/pdf');
          notify('تم بدء تنزيل الملف بنجاح!');
          banner.style.background = '#065f46';
          banner.style.color = '#34d399';
          banner.style.borderColor = '#10b981';
          banner.innerHTML = `<span>✅</span><span>تم تنزيل استمارة الدولاب بنجاح!</span>`;
          setTimeout(() => {
            if (document.body.contains(overlay)) document.body.removeChild(overlay);
          }, 800);
          return true;
        } catch (e) {}
      }

      // 3. مسار السيرفر لتحميل الملف عبر Android DownloadManager
      const res = await fetch('/api/students/lockers/receipt-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: safeFilename,
          pdfBase64: pdfBase64,
          lockerCode: data.lockerCode
        })
      });

      const resJson = await res.json();
      if (resJson?.downloadUrl) {
        const a = document.createElement('a');
        a.href = resJson.downloadUrl;
        a.download = safeFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => {
          window.location.href = resJson.downloadUrl;
        }, 150);
        notify('تم بدء تنزيل الاستمارة بنجاح!');
      } else {
        await worker.save();
      }
    } else {
      // متصفح عادي
      notify('جاري التنزيل...');
      await worker.save();
      notify('تم تنزيل الاستمارة بنجاح!');
    }

    // إشعار اكتمال الإجراء
    banner.style.background = '#065f46';
    banner.style.color = '#34d399';
    banner.style.borderColor = '#10b981';
    banner.innerHTML = `<span>✅</span><span>تم تنزيل استمارة الدولاب بنجاح!</span>`;

    setTimeout(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }, 900);

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
