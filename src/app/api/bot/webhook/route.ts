import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function sendTelegramMessage(botToken: string, chatId: number, text: string, replyMarkup: any = null) {
  const body: any = { chat_id: chatId, text: text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function sendTelegramPhoto(botToken: string, chatId: number, photoUrl: string, caption: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption })
  });
}

export async function POST(request: Request) {
  try {
    const update = await request.json();

    // Fetch token to use API directly for background tasks
    const { data: sysData } = await supabase.from('system_settings').select('telegram_config').eq('id', 1).maybeSingle();
    const botToken = sysData?.telegram_config?.token;

    // ==========================================
    // 1. Handle Text Messages (/start & Replies)
    // ==========================================
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const firstName = update.message.from.first_name || 'طالبنا العزيز';

      // --- Admin "Login as Student" Reply Handler ---
      if (update.message.reply_to_message && update.message.reply_to_message.text.includes('يرجى كتابة (كود الطالب)')) {
        const studentCode = text;
        
        // Fetch student from DB
        const { data: student } = await supabase.from('students').select('*').eq('student_code', studentCode).maybeSingle();
        
        if (!student) {
          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `عفواً أيها المدير، لم أتمكن من العثور على طالب بالكود: ${studentCode}` });
        }

        let telegramInfo = '❌ (غير مربوط بأي حساب تليجرام حتى الآن)';
        if (student.telegram_id) {
          telegramInfo = `✅ (مربوط)\n🆔 آيدي الحساب: ${student.telegram_id}\n👤 اسم الحساب: ${student.telegram_first_name || 'غير معروف'}\n🔗 المعرف: @${student.telegram_username || 'لا يوجد'}`;
        }

        const caption = `🕵️‍♂️ (وضع المحاكاة نشط)\n👨‍🎓 الطالب: ${student.full_name}\n📌 الكود: ${student.student_code}\n\n📱 حالة ارتباط تليجرام:\n${telegramInfo}\n\nأنت الآن تتصفح البوت بصفتك هذا الطالب (كما سيراه هو تماماً). ماذا تريد أن تفعل؟`;
        
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: caption,
          reply_markup: {
            inline_keyboard: [
              [{ text: '📸 رفع عمل جديد', callback_data: `sim_upload_${student.id}` }],
              [{ text: '📁 استعراض أعمال الطالب', callback_data: `sim_gallery_${student.id}` }],
              [{ text: '❌ إنهاء وضع المحاكاة', callback_data: `sim_exit` }]
            ]
          }
        });
      }

      // --- /start Handler ---
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const payload = parts.length > 1 ? parts[1] : '';
        let replyText = '';
        let replyMarkup = null;

        if (payload) {
          if (payload.startsWith('stu_')) {
            const rawPayload = payload.replace('stu_', '');
            // rawPayload might be: 0001 or 0001_br_XYZ123
            const codeParts = rawPayload.split('_');
            const studentCode = codeParts[0];
            const browserId = codeParts.slice(1).join('_'); // Get the rest as browser ID

            const { data: student } = await supabase.from('students').select('*').eq('student_code', studentCode).maybeSingle();
            
            if (!student) {
              replyText = `عفواً، لم يتم العثور على طالب بهذا الكود. يرجى مراجعة الإدارة.`;
            } else if (student.telegram_id && student.telegram_id !== chatId) {
              replyText = `⚠️ هذا الكود مربوط مسبقاً بحساب تليجرام آخر! إذا كنت تعتقد أن هناك خطأ، يرجى التوجه للإدارة.`;
            } else {
              // Check if THIS telegram account is already linked to ANOTHER student!
              const { data: otherStudent } = await supabase.from('students').select('id, full_name').eq('telegram_id', chatId).maybeSingle();
              if (otherStudent && (otherStudent as any).id !== student.id) {
                return NextResponse.json({
                  method: 'sendMessage',
                  chat_id: chatId,
                  text: `🚨 تنبيه أمني: حساب التليجرام الخاص بك مربوط بالفعل بالطالب (${(otherStudent as any).full_name})! لا يُسمح بربط أكثر من طالب بنفس الحساب.`
                });
              }

              // Show Confirmation Warning
              replyText = `⚠️ **تنبيه هام ومصيري!**\n\nأنت على وشك ربط هاتفك وحسابك بالطالب:\n👨‍🎓 **${student.full_name}**\n\nبمجرد الضغط على (تأكيد)، **لن تتمكن أبداً من تغيير هذا الاسم**، وسيتم تسجيل جميع أعمالك وحضورك تحت هذا الاسم حتى تخرجك!\n\nهل أنت متأكد أن هذا هو اسمك؟`;
              replyMarkup = {
                inline_keyboard: [
                  [{ text: '✅ نعم، أنا هذا الطالب (تأكيد)', callback_data: `confirm_link_${student.id}_${browserId}` }],
                  [{ text: '❌ لا، إلغاء', callback_data: `cancel_link` }]
                ]
              };
            }
          } else {
            const { data: profile } = await supabase.from('profiles').select('*').eq('telegram_link_token', payload).maybeSingle();
            if (profile) {
              await supabase.from('profiles').update({ telegram_id: chatId, telegram_link_token: null }).eq('id', profile.id);
              const roleName = profile.role === 'مدير' ? 'المدير 👑' : 'عضو هيئة التدريس 👨‍🏫';
              replyText = `مرحباً بك د. ${profile.full_name} 🎓\n\nلقد تم ربط حسابك بنجاح بصلاحية (${roleName}).`;
              
              const buttons = [[{ text: '📂 تصفح المقررات والأعمال', callback_data: 'staff_browse_courses' }]];
              if (profile.role === 'مدير') {
                buttons.push([{ text: '🕵️‍♂️ الدخول بحساب طالب (محاكاة)', callback_data: 'admin_login_student' }]);
              }
              replyMarkup = { inline_keyboard: buttons };

            } else {
              replyText = `عفواً، رابط التفعيل غير صحيح أو منتهي الصلاحية.`;
            }
          }
        } else {
          // No payload logic...
          const { data: existingProfile } = await supabase.from('profiles').select('*').eq('telegram_id', chatId).maybeSingle();
          if (existingProfile) {
            replyText = `أهلاً بعودتك د. ${existingProfile.full_name} 🎓\nكيف يمكنني مساعدتك؟`;
            
            const buttons = [[{ text: '📂 تصفح المقررات والأعمال', callback_data: 'staff_browse_courses' }]];
            if (existingProfile.role === 'مدير') {
              buttons.push([{ text: '🕵️‍♂️ الدخول بحساب طالب (محاكاة)', callback_data: 'admin_login_student' }]);
            }
            replyMarkup = { inline_keyboard: buttons };

          } else {
            replyText = `مرحباً بك! حسابك غير مربوط. يرجى التفعيل من موقع الكلية.`;
          }
        }
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: replyText, reply_markup: replyMarkup });
      }
      return NextResponse.json({ ok: true });
    }

    // ==========================================
    // 2. Handle Inline Button Clicks
    // ==========================================
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const tgUserId = callbackQuery.from.id;

      // =====================================================
      // STUDENT ACTIONS — no profile needed (students not in profiles table)
      // =====================================================

      if (data === 'cancel_link') {
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'تم إلغاء عملية الربط.' });
      }

      if (data.startsWith('confirm_link_')) {
        const withoutPrefix = data.slice('confirm_link_'.length);
        const studentId = withoutPrefix.slice(0, 36);
        const browserId = withoutPrefix.length > 37 ? withoutPrefix.slice(37) : '';
        const { data: student } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
        if (!student) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'خطأ: لم يتم العثور على الطالب.' });
        if (student.telegram_id && student.telegram_id !== chatId) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'خطأ: هذا الطالب مربوط بحساب آخر.' });
        await supabase.from('students').update({ telegram_id: chatId, telegram_username: callbackQuery.from.username || null, telegram_first_name: callbackQuery.from.first_name || null, telegram_browser_id: browserId || null }).eq('id', student.id);
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `تم التأكيد! أهلاً بك يا ${student.full_name} 👨‍🎓\n\nتم قفل هذا الحساب على اسمك بنجاح ✅\nيمكنك الآن استخدامه لرفع أعمالك.`, reply_markup: { inline_keyboard: [[{ text: '📸 رفع عمل جديد', callback_data: 'student_upload' }],[{ text: '📁 معرض أعمالي', callback_data: 'student_gallery' }]] } });
      }

      if (data === 'student_gallery') {
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'معرض أعمالك (قيد التطوير) 🚧' });
      }

      // student_upload OR sim_upload_ → show courses
      if (data === 'student_upload' || data.startsWith('sim_upload_')) {
        let studentIdForAction = null;
        let isSimulation = false;
        
        if (data === 'student_upload') {
          studentIdForAction = (await supabase.from('students').select('id').eq('telegram_id', chatId.toString()).maybeSingle()).data?.id;
          if (!studentIdForAction) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لم يتم العثور على حسابك. يرجى التسجيل أولاً.' });
        } else {
          // Simulation
          isSimulation = true;
          const simStudentCode = data.replace('sim_upload_', '');
          studentIdForAction = (await supabase.from('students').select('id').eq('student_code', simStudentCode).maybeSingle()).data?.id;
          if (!studentIdForAction) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لم يتم العثور على الطالب.' });
          
          // Save simulated student ID to admin's profile temporarily to use in next steps
          await supabase.from('profiles').update({ telegram_link_token: `SIM_${studentIdForAction}` }).eq('telegram_id', chatId.toString());
        }

        const { data: student } = await supabase.from('students').select('*').eq('id', studentIdForAction).maybeSingle();
        if (!student) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لم يتم العثور على الطالب.' });
        
        const { data: courses } = await supabase.from('courses').select('*').eq('academic_year', student.academic_year);
        if (!courses || courses.length === 0) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لا يوجد مقررات متاحة لفرقتك حالياً.' });
        
        const availableCourses = courses.filter(c => {
          if (c.course_type === 'sections' && c.sections && Array.isArray(c.sections)) return c.sections.includes(student.section);
          return true;
        });
        if (availableCourses.length === 0) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لا يوجد مقررات متاحة لشعبتك حالياً.' });
        
        const prefix = isSimulation ? 'sim_crs_' : 'stu_crs_';
        const keyboard = availableCourses.map(c => [{ text: `📚 ${c.name} - ${c.academic_year}`, callback_data: `${prefix}${c.id}` }]);
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `📚 مقررات فرقتك (${student.academic_year}):\n\nاختر المقرر لرفع تقييم جديد:`, reply_markup: { inline_keyboard: keyboard } });
      }

      if (data.startsWith('stu_crs_') || data.startsWith('sim_crs_')) {
        const isSimulation = data.startsWith('sim_crs_');
        const crsId = data.replace(isSimulation ? 'sim_crs_' : 'stu_crs_', '');
        
        let stuId = null;
        if (isSimulation) {
           const { data: profile } = await supabase.from('profiles').select('telegram_link_token').eq('telegram_id', chatId.toString()).maybeSingle();
           if (profile?.telegram_link_token?.startsWith('SIM_')) {
               stuId = profile.telegram_link_token.replace('SIM_', '');
           }
        } else {
           stuId = (await supabase.from('students').select('id').eq('telegram_id', chatId.toString()).maybeSingle()).data?.id;
        }
        if (!stuId) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'عفواً، انتهت الجلسة أو الحساب غير مسجل.' });

        const { data: course } = await supabase.from('courses').select('custom_week_names, name').eq('id', crsId).maybeSingle();
        const projects = ((course?.custom_week_names as any)?.__projects__ || []).filter((p: any) => !p.is_archived);
        if (projects.length === 0) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `لا يوجد مشاريع مطلوبة في مقرر (${(course as any)?.name || ''}) حالياً.` });
        
        const prefix = isSimulation ? 'sim_proj_' : 'stu_proj_';
        // callback_data size = 9 + 36 + 1 + 13 = 59 chars (Fits in Telegram's 64 byte limit!)
        const keyboard = projects.map((p: any) => [{ text: `📝 ${p.name} (الدرجة: ${p.max_score})`, callback_data: `${prefix}${crsId}_${p.id}` }]);
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'اختر المشروع أو التقييم المطلوب:', reply_markup: { inline_keyboard: keyboard } });
      }

      if (data.startsWith('stu_proj_') || data.startsWith('sim_proj_')) {
        const isSimulation = data.startsWith('sim_proj_');
        const withoutPrefix = data.replace(isSimulation ? 'sim_proj_' : 'stu_proj_', '');
        const underscoreIdx = withoutPrefix.indexOf('_');
        const crsId = withoutPrefix.slice(0, underscoreIdx);
        const projId = withoutPrefix.slice(underscoreIdx + 1);
        
        let stuId = null;
        if (isSimulation) {
           const { data: profile } = await supabase.from('profiles').select('telegram_link_token').eq('telegram_id', chatId.toString()).maybeSingle();
           if (profile?.telegram_link_token?.startsWith('SIM_')) {
               stuId = profile.telegram_link_token.replace('SIM_', '');
           }
        } else {
           stuId = (await supabase.from('students').select('id').eq('telegram_id', chatId.toString()).maybeSingle()).data?.id;
        }
        if (!stuId) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'عفواً، انتهت الجلسة أو الحساب غير مسجل.' });

        const host = request.headers.get('host') || 'art-faculty-app.vercel.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const cameraUrl = `${protocol}://${host}/camera?stu=${stuId}&crs=${crsId}&proj=${projId}`;
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'ممتاز! ✅\nاضغط على الزر بالأسفل لفتح الكاميرا.\n\n⚠️ تأكد من الإضاءة الجيدة وعدم اهتزاز الهاتف.', reply_markup: { inline_keyboard: [[{ text: '📸 تصوير المشروع', web_app: { url: cameraUrl } }]] } });
      }

      // =====================================================
      // STAFF & ADMIN ACTIONS — profile required
      // =====================================================
      const { data: profile } = await supabase.from('profiles').select('*').eq('telegram_id', tgUserId).maybeSingle();
      if (!profile) {
        // Check if they're a known student clicking something unexpected
        const { data: knownStudent } = await supabase.from('students').select('full_name').eq('telegram_id', tgUserId).maybeSingle();
        if (knownStudent) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `مرحباً ${(knownStudent as any).full_name}!\n\nاختر ما تريد:`, reply_markup: { inline_keyboard: [[{ text: '📸 رفع عمل جديد', callback_data: 'student_upload' }],[{ text: '📁 معرض أعمالي', callback_data: 'student_gallery' }]] } });
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'عفواً، حسابك غير مسجل في النظام.' });
      }

      if (data === 'admin_login_student' && profile.role === 'مدير') {
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'يرجى كتابة (كود الطالب) الذي تود محاكاة حسابه:', reply_markup: { force_reply: true, selective: true } });
      }

      if (data === 'sim_exit') {
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'تم إنهاء وضع المحاكاة. عودة لصلاحيات الإدارة 👑' });
      }
      if (data.startsWith('sim_gallery_')) {
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'جاري برمجة معرض أعمال الطالب (قيد التطوير) 🚧' });
      }

      // --- BROWSE COURSES ---
      if (data === 'staff_browse_courses') {
        // Fetch courses WITH academic_years
        const { data: allCourses } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
        let userCourses = allCourses || [];
        
        // If not admin, filter by owner or shared
        if (profile.role !== 'مدير') {
          userCourses = userCourses.filter(c => c.owner_id === profile.id || (c.shared_with && c.shared_with.includes(profile.id)));
        }

        if (userCourses.length === 0) {
          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لا يوجد لديك مقررات حالياً.' });
        }

        // Add Academic Year to button text!
        const keyboard = userCourses.map(c => {
          const yearName = c.academic_year || 'عام';
          return [{ text: `📚 ${c.name} - ${yearName}`, callback_data: `view_course_${c.id}` }];
        });
        
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: 'قم باختيار المقرر لعرض أعمال الطلاب:',
          reply_markup: { inline_keyboard: keyboard }
        });
      }

      // --- VIEW COURSE ARTWORKS ---
      if (data.startsWith('view_course_')) {
        const courseId = data.replace('view_course_', '');
        
        // Fetch course name
        const { data: course } = await supabase.from('courses').select('name').eq('id', courseId).single();
        
        // Answer immediately so the button doesn't hang
        if (botToken) {
          await sendTelegramMessage(botToken, chatId, `جاري تجميع وتهيئة أعمال مقرر (${course?.name || ''})... يرجى الانتظار ⏳`);
        }

        // Fetch students enrolled in this course (with their evaluations)
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select(`
            student_id,
            students ( full_name, code ),
            evaluations (
              id, created_at, photo_url, ai_status
            )
          `)
          .eq('course_id', courseId);

        if (!enrollments || enrollments.length === 0) {
          if (botToken) await sendTelegramMessage(botToken, chatId, 'لا يوجد طلاب مسجلين في هذا المقرر.');
          return NextResponse.json({ ok: true });
        }

        let sentCount = 0;

        // Sort students alphabetically
        const sortedStudents = enrollments
          .filter(e => e.students)
          .sort((a, b) => ((a.students as any).full_name).localeCompare(((b.students as any).full_name), 'ar'));

        for (const enrollment of sortedStudents) {
          if (!enrollment.evaluations || enrollment.evaluations.length === 0) continue;

          // Sort evaluations by date
          const sortedEvals = enrollment.evaluations.sort((a: any, b: any) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          for (const ev of sortedEvals) {
            if (!ev.photo_url) continue;
            
            // Fix URL format if needed
            let finalUrl = ev.photo_url;
            if (finalUrl.startsWith('/')) {
              // It's a supabase storage path
              finalUrl = `${supabaseUrl}/storage/v1/object/public/artworks${finalUrl}`;
            }

            const dateStr = new Date(ev.created_at).toLocaleDateString('ar-EG');
            const timeStr = new Date(ev.created_at).toLocaleTimeString('ar-EG');
            const caption = `👨‍🎓 الطالب: ${(enrollment.students as any).full_name}\n📅 التاريخ: ${dateStr} - ${timeStr}`;

            if (botToken) {
              await sendTelegramPhoto(botToken, chatId, finalUrl, caption);
              sentCount++;
            }
          }
        }

        if (botToken) {
          await sendTelegramMessage(botToken, chatId, sentCount > 0 ? `✅ اكتمل عرض الأعمال (${sentCount} صورة).` : 'لا يوجد أي أعمال مرفوعة للطلاب حتى الآن في هذا المقرر.');
        }

        return NextResponse.json({ ok: true });
      }

    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ ok: true });
  }
}
