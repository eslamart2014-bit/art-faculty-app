/**
 * مولد استمارة تسجيل الدولاب الرسمية
 * جامعة قنا - كلية التربية النوعية - قسم التربية الفنية
 * م/ إسلام عبداللطيف
 */

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

export function generateLockerReceiptHtml(data: LockerReceiptData): string {
  const dateStr = data.date || new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const supervisor = data.supervisorName || 'م/ إسلام عبداللطيف';
  const names = data.studentNames || [];
  const capacity = Math.max(names.length, 4);

  // توليد صفوف جدول الأسماء
  const rowsHtml = names
    .map((name, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td style="text-align: right; padding-right: 15px;">${name}</td>
      <td style="color: #666;">................................</td>
    </tr>
  `)
    .join('');

  // توليد محتوى مستطيل الأسماء للقص واللصق
  const namesBoxHtml = names
    .map((name) => `<div>${name}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <title>استمارة تسجيل دولاب - ${data.lockerCode}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Amiri:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: "Cairo", "Amiri", sans-serif;
      direction: rtl;
      text-align: center;
      margin: 40px;
      color: #000;
      background: #fff;
    }

    h2, h3, h4 { margin: 0; }
    h3 { font-weight: bold; font-size: 20px; }
    h4 { font-weight: 600; font-size: 16px; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 15px;
      font-weight: bold;
    }

    th, td {
      border: 1px solid #000;
      padding: 8px;
      text-align: center;
    }

    th {
      background-color: #f2f2f2;
    }

    .divider {
      border-top: 1px dashed #000;
      margin: 25px 0;
    }

    .small {
      font-size: 14px;
      margin-top: 12px;
      font-weight: bold;
    }

    .cutline {
      margin: 10px 0;
      font-size: 13px;
      font-weight: bold;
    }

    /* مربع الكود */
    .codeBox {
      display: inline-block;
      border: 3px double #000;
      width: 4cm;
      height: 4cm;
      font-size: 42px;
      font-weight: 900;
      vertical-align: top;
      line-height: 4cm;
      text-align: center;
    }

    /* مستطيل الأسماء */
    .namesBox {
      display: inline-block;
      border: 3px double #000;
      width: 9cm;
      height: 4cm;
      vertical-align: top;
      margin-right: 10px;
      text-align: center;
      font-size: 16px;
      font-weight: bold;
    }

    .namesBox div {
      border-bottom: 2px solid #000;
      height: calc(100% / ${capacity});
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .namesBox div:last-child {
      border-bottom: none;
    }

    /* التوقيع والمشرف */
    .footer {
      font-size: 12px;
      text-align: left;
      margin-top: 15px;
      font-weight: bold;
    }

    /* الطباعة */
    @page { size: A4 portrait; margin: 1cm; }
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- شريط أدوات الطباعة للشاشة -->
  <div class="no-print" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 12px 20px; border-radius: 8px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
    <div style="font-size: 14px; font-weight: bold; color: #1e293b;">
      📄 استمارة تسجيل الدولاب الرسمية - جامعة قنا
    </div>
    <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 14px;">
      🖨️ طباعة الاستمارة الآن
    </button>
  </div>

  <!-- الترويسة -->
  <div style="position: relative;">
    <div style="position:absolute; left:0; top:0; font-size:12px; font-weight:bold;">مشرف النظام: ${supervisor}</div>
    <div style="position:absolute; right:0; top:0; font-size:12px; font-weight:bold;">تاريخ التسجيل: ${dateStr}</div>
  </div>

  <h3>جامعة قنا</h3>
  <h4>كلية التربية النوعية</h4>
  <h4>قسم التربية الفنية</h4>
  <h3 style="margin-top: 6px; text-decoration: underline;">استمارة تسجيل دولاب</h3>

  <!-- الجدول العلوي -->
  <table>
    <tr>
      <th style="width: 33%;">الفرقة</th>
      <th style="width: 33%;">كود الدولاب</th>
      <th style="width: 34%;">رقم الموبايل</th>
    </tr>
    <tr>
      <td>${data.cohort || 'عام'}</td>
      <td style="font-size: 20px; font-weight: 900; color: #000;">${data.lockerCode}</td>
      <td dir="ltr">${data.phone}</td>
    </tr>
  </table>

  <!-- جدول الأسماء -->
  <table>
    <tr>
      <th style="width: 10%;">#</th>
      <th style="width: 60%;">الاسم</th>
      <th style="width: 30%;">التوقيع</th>
    </tr>
    ${rowsHtml}
  </table>

  <p class="small">
    نقر نحن المذكور أسماؤنا باستلام الدولاب والمحافظة عليه، وفي حالة التلف نتكفل بإصلاحه.
  </p>

  <div class="divider"></div>

  <p class="cutline">✂️ قص هذا الجزء والصقه على الدولاب</p>

  <!-- المربع والمستطيل -->
  <div style="display:flex; justify-content:center; align-items:flex-start; gap:10px; margin-top:10px;">
    <div class="codeBox">${data.lockerCode}</div>
    <div class="namesBox">${namesBoxHtml}</div>
  </div>

  <!-- التاريخ في الأسفل + توقيع المشرف -->
  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; font-size:13px; font-weight:bold;">
    <div>تاريخ التسجيل: ${dateStr}</div>
    <div>توقيع مشرف النظام: .......................................................</div>
  </div>

</body>
</html>`;
}

export function printLockerReceipt(data: LockerReceiptData) {
  if (typeof window === 'undefined') return;
  const html = generateLockerReceiptHtml(data);
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
