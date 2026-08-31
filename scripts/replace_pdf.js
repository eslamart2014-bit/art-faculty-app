const fs = require('fs');
const path = require('path');

const files = [
  'src/app/course/[id]/reports/page.tsx',
  'src/app/course/[id]/evaluations/page.tsx',
  'src/components/admin/AdminDashboard.tsx'
];

for (const file of files) {
  const fullPath = path.resolve(file);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${file}`);
    continue;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');

  // Add import if not exists
  if (content.includes('generatePrintableHtml') && !content.includes('downloadPdf')) {
    content = content.replace(
      /import \{ generatePrintableHtml \} from "@\/lib\/pdfHelper";/,
      `import { generatePrintableHtml } from "@/lib/pdfHelper";\nimport { downloadPdf } from "@/lib/downloadPdf";`
    );
  }

  // Replace standard window.open pattern
  const pattern = /const html = generatePrintableHtml\((.*?)\);\s*const win = window\.open\('', '_blank'\);\s*if \(win\) \{ win\.document\.write\(html\); win\.document\.close\(\); \}/g;
  
  let matchCount = 0;
  content = content.replace(pattern, (match, args) => {
    matchCount++;
    return `await downloadPdf("report.pdf", ${args});`;
  });

  // Specifically for evaluations missing students pdf
  if (file.includes('evaluations')) {
    content = content.replace(
      /const html = generatePrintableHtml\(course\?.name \|\| "", `كشف الطلاب المتأخرين عن تسليم \(\$\{proj\.name\}\)`, "", tableHtml\);\s*const win = window\.open\('', '_blank'\);\s*if \(win\) \{ win\.document\.write\(html\); win\.document\.close\(\); \}/g,
      `await downloadPdf("missing.pdf", course?.name || "", \`كشف الطلاب المتأخرين عن تسليم (\${proj.name})\`, "", tableHtml);`
    );
  }
  
  // Specifically for AdminDashboard
  if (file.includes('AdminDashboard')) {
    content = content.replace(
      /const html = generatePrintableHtml\("إدارة النظام", "تقرير نشاط المستخدمين الشامل", "", tableHtml, "مدير النظام"\);\s*const win = window\.open\('', '_blank'\);\s*if \(win\) \{ win\.document\.write\(html\); win\.document\.close\(\); \}/g,
      `await downloadPdf("admin_report.pdf", "إدارة النظام", "تقرير نشاط المستخدمين الشامل", "", tableHtml, "مدير النظام");`
    );
  }

  fs.writeFileSync(fullPath, content);
  console.log(`Updated ${file} (${matchCount} standard replacements)`);
}
