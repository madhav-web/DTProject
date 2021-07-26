const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PatientSchema = new Schema({
    name: String,
    phoneNumber: String,
    diseaseType: String,
    severity: String,
    region: String,
    remarks: String,
    language: String,
    password: String,
    confirmPassword: String,
})

module.exports = mongoose.model('Patient', PatientSchema);