// models/Material.js
const mongoose = require('mongoose');

// تعريف شكل البيان
const materialSchema = new mongoose.Schema({
    name: String,           // اسم المادة
    code: String,          // كود المادة
    unit: String,          // الوحدة (كغ، لتر، إلخ)
    category: String,      // الفئة
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// تصدير النموذج
module.exports = mongoose.model('Material', materialSchema);