const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
//const { patientSchema } = require('./schemasvalidation');
const methodOverride = require('method-override');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookie = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const upload = require('express-fileupload');
const docxConverter = require('docx-pdf');
const patient = require('./models/patient');
const doctor = require('./models/doctor');

mongoose.connect('mongodb://localhost:27017/DTProject', {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const app = express();

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '/public')));
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(cookie());
app.use(session({
    cookie: { maxAge: 60000 },
    secret: 'woot',
    resave: false,
    saveUninitialized: false
}));
app.use(flash());
app.use(upload());

// ==================================================== VERIFY Function =========================================================================
async function verify(req, res, next) {
    console.log(req.cookies);
    const token = await req.cookies.token;
    if (!token) {
        req.auth = "Not allowed";
        next();
    }
    else {
        try {
            const decode = await jwt.verify(token, "mysecretKEY", { algorithm: 'HS256' })
            req.dataa = decode;
            req.auth = "allowed"
            next();
        }
        catch (e) {
            console.log(e.message);
            req.auth = "Not allowed";
            next();
        }

    }
}

app.get('/', (req, res) => {
    console.log("GET: /HomePage");
    res.render('homePage');
});

app.get('/patientDashboard', verify, (req, res) => {
    console.log("GET: /patientDashboard");
    res.render('patientDashboard');
});

app.get('/doctorDashboard', verify, (req, res) => {
    console.log("GET: /doctorDashboard");
    res.render('doctorDashboard');
});

// =============================================================================================================================================
// ====================================================== AUTHENTICATION =======================================================================
// =============================================================================================================================================

// ===================================================== PATIENT REGISTER =====================================================================

app.get('/patientSignUpPage', (req, res) => {
    console.log("GET: /patientSignUpPage");
    res.render("patientSignUpPage");
});

app.post("/patientSignUpPage", async (req, res) => {
    console.log("POST: /patientSignUpPage");

    var newPatient = new patient({
        name: req.body.name,
        phoneNumber: req.body.phoneNumber,
        region: req.body.region,
        language: req.body.language,
        password: ''
    });
    if (req.body.password != req.body.confirmPassword) {
        req.flash("error", "Password mismatch");
        res.redirect("/patientSignUpPage");
    } else if (req.body.password.length < 8) {
        req.flash("error", "Password should have minimum 8 characters");
        res.redirect("/patientSignUpPage");
    } else {
        try {
            const salt = await bcrypt.genSalt(10);
            let password = await bcrypt.hash(req.body.password, salt);
            newPatient.password = password;
            await newPatient.save();
            console.log("Patient Details:");
            console.log(newPatient);
            res.redirect("/patientDashboard");
        }
        catch (e) {
            console.log("Error in patientSignUpPage");
            console.log(e);
        }
    }
});

// ===================================================== PATIENT LOGIN =====================================================================

app.get('/patientLogin', (req, res) => {
    console.log('GET: /patientLogin');
    res.render('patientLogin');
});

app.post('/patientLogin', async (req, res) => {
    console.log("POST: /patientLogin");
    try {
        const { phoneNumber, password } = req.body;
        const pat = await patient.findOne({ phoneNumber });
        if (!pat) {
            res.json({ message: "Invalid Creds" });
        }
        const value = await bcrypt.compare(password, pat.password);
        const payload = {
            id: pat._id
        }
        if (value) {
            const token = await jwt.sign(payload, "mysecretKEY", { algorithm: 'HS256' });
            res.cookie("token", token, { httpOnly: true });
            res.redirect("/patientDashboard");
        } else {
            res.json({ message: "Invalid Creds" });
        }
    } catch (e) {
        console.log("Error in patientLogin");
        console.log(e);
    }
})

// ===================================================== DOCTOR REGISTER =====================================================================

app.get('/doctorSignUp', (req, res) => {
    console.log("GET: /doctorSignUp");
    res.render("doctorSignUp");
})

app.post('/doctorSignUp', async (req, res) => {
    console.log("POST: /doctorSignUp");

    var newDoctor = new doctor({
        name: req.body.name,
        phoneNumber: req.body.phoneNumber,
        region: req.body.region,
        language: req.body.language,
        specialization: req.body.specialization,
        password: ''

    });
    if (req.body.password != req.body.confirmPassword) {
        req.flash("error", "Password mismatch");
        res.redirect("/doctorSignUp");
    } else if (req.body.password.length < 8) {
        req.flash("error", "Password should have minimum 8 characters");
        res.redirect("/doctorSignUp");
    } else {
        try {
            const salt = await bcrypt.genSalt(10);
            let password = await bcrypt.hash(req.body.password, salt);
            newDoctor.password = password;
            await newDoctor.save();
            console.log("Doctor Details:");
            console.log(newDoctor);
            res.redirect("/doctorCertificateUploadPage/" + newDoctor._id);
        }
        catch (e) {
            console.log("Error in doctorSignUp");
            console.log(e);
        }
    }
});

app.get("/doctorCertificateUploadPage/:id", verify, (req, res) => {
    console.log("GET: /doctorCertificateUploadPage/:id");

    var doctorID = req.params.id;

    console.log("Doctor ID:", doctorID);

    doctor.findById(doctorID, (err, foundDoctor) => {
        if (err) {
            console.log("Error in doctorertificateUploadPage");
            console.log(err);
        } else {
            res.render("doctorCertificateUploadPage", { foundDoctor: foundDoctor });
        }
    });
});

app.post("/doctorCertificateUploadPage/:id", verify, (req, res) => {
    console.log("POST: /doctorCertificateUploadPage/:id");

    var doctorID = req.params.id;

    doctor.findByIdAndUpdate(doctorID,
        { safe: true, upsert: true },
        (err, foundDoctor) => {
            if (err) {
                console.log("Error in POST of doctorCertificateUploadPage");
                console.log(err);
            } else {
                try {
                    if (req.files) {
                        var file = req.files.uploadFile;
                        console.log(file);
                        uploadFile = file.name;
                        uploadExtension = file.name.split(".")[1];
                        if (uploadExtension == "pdf") {
                            file.mv("./pdfCertificateUpload/" + foundDoctor.phoneNumber + "." + uploadExtension, (err) => {
                                if (err) {
                                    console.log("Error in uploadExtension PDF");
                                    console.log(err);
                                } else {
                                    console.log("Successfully uploaded");
                                    res.redirect("/doctorDashboard");
                                }
                            })
                        } else {
                            file.mv("./otherFormatCertificateUpload/" + foundDoctor.phoneNumber + "." + uploadExtension, (err) => {
                                if (err) {
                                    console.log("Error in uploadExtension Other format");
                                    console.log(err);
                                } else {
                                    docxConverter("./otherFormatCertificateUpload/" + phoneNumber + "." + uploadExtension, "./pdfCertificateUpload/" + phoneNumber + ".pdf", (err, result) => {
                                        if (err) {
                                            console.log("Error in docx to pdf converter");
                                            console.log(err);
                                        } else {
                                            console.log(result);
                                        }
                                    });
                                    console.log("Successfully uploaded");
                                    res.redirect('/doctorDashboard');
                                }
                            })
                        }
                    }
                } catch (e) {
                    console.log("Error in certificate uploads");
                    console.log(e);
                }
            }
        });
});

// ===================================================== DOCTOR LOGIN =====================================================================
app.get('/doctorLogin', (req, res) => {
    console.log("GET: /doctorLogin");
    res.render("doctorLogin");
})

app.post("/doctorLogin", async (req, res) => {
    console.log("POST: /doctorLogin");
    try {
        const { phoneNumber, password } = req.body;
        const doc = await doctor.findOne({ phoneNumber });
        if (!doc) {
            res.json({ message: "Invalid Creds" });
        }
        const value = await bcrypt.compare(password, doc.password);
        const payload = {
            id: doc._id
        }
        if (value) {
            const token = await jwt.sign(payload, "mysecretKEY", { algorithm: 'HS256' });
            res.cookie("token", token, { httpOnly: true });
            res.redirect("/doctorDashboard");
        } else {
            res.json({ message: "Invalid Creds" });
        }
    } catch (e) {
        console.log("Error in doctorLogin");
        console.log(e);
    }
});

app.listen(3000, () => {
    console.log("Server working on PORT 3000!!!");
})