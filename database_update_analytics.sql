-- تحديث جدول إحصائيات بوابة الطلاب
ALTER TABLE portal_analytics ADD COLUMN browser_id text;
ALTER TABLE portal_analytics ADD COLUMN student_name text;

-- سياسة الحذف للمدير (نسمح للجميع بالحذف مؤقتاً لتسهيل التنفيذ عبر API أو نستخدم Delete Policy)
CREATE POLICY "Allow public delete to portal_analytics" 
ON portal_analytics 
FOR DELETE 
TO public 
USING (true);
