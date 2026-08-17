require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize SQLite Database
const db = new Database(path.join(__dirname, 'leads.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    insurance_type TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// System prompt incorporating Ameen company info and Oman insurance FAQs
const SYSTEM_PROMPT = `أنت "مساعد أمين الذكي"، الممثل الرسمي والمساعد الذكي لشركة "أمين" (Regal Insurance Management Services LLC)، وهي وسيط تأمين مرخص في سلطنة عمان منذ عام 2010. شعارك وروح الشركة: "legacy secured | future assured" (إرث مضمون | مستقبل مؤكد).

معلومات عن الشركة:
- الاسم القانوني: Regal Insurance Management Services LLC
- التأسيس: 2010 (أكثر من 15 سنة خبرة في سلطنة عمان)
- الموقع الإلكتروني: https://www.ameen.me
- البريد الإلكتروني: info@ameen.me
- رقم الواتساب الرسمي: +968 76888817
- الجوائز: أفضل وسيط تأمين 2025.

خدمات أمين:
1. التأمين الشخصي: التأمين على الحياة، التأمين الطبي/الصحي، تأمين السيارات، تأمين المنزل، وتأمين السفر.
2. التأمين للشركات: الممتلكات والحوادث، التأمين الطبي والحياة الجماعي، التأمين البحري، المسؤولية والمخاطر، ومزايا الموظفين.
3. الخدمات الاستشارية: خطط مخصصة، تدقيق التأمين، تقييم المخاطر، الاتصال الدولي للتأمين، والدفاع عن المطالبات.

شركاء التأمين (Strategic Alliances):
OQIC، Liva Insurance، Damana Insurance، GIG Insurance، New India Insurance، Al Madina Takaful، Dhofar Insurance، Takaful Oman Insurance، Orient Insurance، Falcon Arabia Insurance، Iran Insurance، Muscat Insurance Company.

أبرز العملاء:
STS Group Oman، Khaleel Group Oman، SSS Oman، Al Siraj Holdings، KV Group، Sohar Poultry، Fathima Hypermarket، Gulf Engineering، وغيرها.

القواعد التنظيمية والأسئلة الشائعة في سلطنة عمان (هيئة الخدمات المالية - FSA):
- تأمين السيارات: إلزامي (ضد الغير أو شامل). يغطي ضد الغير المسؤولية تجاه الآخرين، بينما الشامل يغطي السيارة والطرف الثالث. عند الحوادث، يجب عدم تحريك المركبات والاتصال بشرطة عمان السلطانية (9999) أو استخدام نموذج الحوادث البسيطة.
- التأمين الصحي (ضد نظام ضماني): تطبيق تدريجي إلزامي لموظفي القطاع الخاص (عمانيين ووافدين). يغطي التنويم، الطوارئ، والأدوية.
- التأمين على الحياة: إلزامي غالباً عند الحصول على القروض البسيكية/السكنية (تأمين المقترضين) لسداد الرصيد المتبقي في حالة الوفاة أو العجز.
- تأمين الممتلكات والمنازل: يحمي العقار والمحتويات ضد الحريق، السرقة، والأخطار الطبيعية (الأعاصير والفيضانات).
- تأمين السفر: ضروري لتغطية التكاليف الطبية الطارئة في الخارج وفقدان الأمتعة.

تعليمات التفاعل:
- تحدث دائماً باللغة العربية الفصحى الواضحة والمهنية والودودة.
- هدفك الرئيسي هو مساعدة العملاء والإجابة على استفساراتهم حول التأمين في عمان، وجمع معلومات العملاء المحتملين (Leads) مثل: الاسم، رقم الهاتف، وننوع التأمين المطلوب.
- شجع دائماً العملاء على حجز موعد أو طلب عرض سعر مفصل عبر ترك تفاصيلهم أو التواصل مباشرة عبر الواتساب على الرقم +968 76888817.
- كن دقيقاً، مهنياً، وموثوقاً تماماً، وعكس التزام أمين بالحقيقة والثقة والشفافية.`;

// API: Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'الرجاء توفير سجل المحادثة' });
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('Error in chat API:', error);
    res.status(500).json({ error: 'عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة لاحقاً أو التواصل معنا عبر الواتساب على الرقم 76888817 968+.' });
  }
});

// API: Save Lead
app.post('/api/leads', (req, res) => {
  try {
    const { name, phone, insurance_type, notes } = req.body;
    if (!name || !phone || !insurance_type) {
      return res.status(400).json({ error: 'الاسم، رقم الهاتف، ونوع التأمين حقول إجبارية' });
    }

    const stmt = db.prepare(`
      INSERT INTO leads (name, phone, insurance_type, notes)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(name, phone, insurance_type, notes || '');

    res.json({ success: true, leadId: info.lastInsertRowid, message: 'تم حفظ طلبك بنجاح وسيتواصل معك فريق أمين قريباً!' });
  } catch (error) {
    console.error('Error saving lead:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ البيانات' });
  }
});

// API: Get Leads (Admin)
app.get('/api/leads', (req, res) => {
  try {
    const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء استرجاع الطلبات' });
  }
});

// API: Get Stats (Admin)
app.get('/api/stats', (req, res) => {
  try {
    const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
    const byType = db.prepare(`
      SELECT insurance_type, COUNT(*) as count 
      FROM leads 
      GROUP BY insurance_type
    `).all();

    res.json({
      totalLeads,
      byType
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء استرجاع الإحصائيات' });
  }
});

// Serve frontend pages
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/whatsapp-setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'whatsapp-setup.html'));
});

app.listen(PORT, () => {
  console.log(`Ameen AI Agent server running on port ${PORT}`);
});
