-- جدول إحصائيات بوابة الطلاب
CREATE TABLE IF NOT EXISTS portal_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'search' or 'qr_view'
  academic_year text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- سياسات الأمان: السماح بإدراج البيانات للجميع (Public)، والقراءة للمديرين فقط
ALTER TABLE portal_analytics ENABLE ROW LEVEL SECURITY;

-- السماح لأي شخص بإرسال إحصائية جديدة (البوابة عامة)
CREATE POLICY "Allow public insert to portal_analytics" 
ON portal_analytics 
FOR INSERT 
TO public 
WITH CHECK (true);

-- السماح بقراءة الإحصائيات فقط (مؤقتاً للجميع إذا لزم الأمر في API أو نعالجها بـ Service Key)
CREATE POLICY "Allow public read to portal_analytics" 
ON portal_analytics 
FOR SELECT 
TO public 
USING (true);
