const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // إجبار بوبيتير على تحميل الكروم داخل مجلد المشروع الحالي لمنع مشاكل الصلاحيات في ريندر
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
