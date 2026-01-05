const nodemailer = require('nodemailer');

const emailSender = async (email, msg, subject = "Insured Nomads Quote Attachement") => {
    try {
        let mailTransporter = nodemailer.createTransport({
            host: "smtp.hostinger.com",
            port: 465,
            secure: true, // true for 465, false for other ports
            auth: {
                user: "insurednomads@instlytechnologies.com",
                pass: "InsuredNomads@1122"
            }
        });
        let mailDetails = {
            from: "insurednomads@instlytechnologies.com",
            to: email,
            subject: subject,
            html: msg,
        }
        return await mailTransporter.sendMail(mailDetails);
    } catch (error) {
        console.log(error);
        return false;
    }
}

// Export the function
module.exports = emailSender;
