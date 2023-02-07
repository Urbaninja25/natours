const nodemailer = require('nodemailer');

const pug = require('pug');
const { htmlToText } = require('html-to-text');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Nugzar beksrishvili <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    //!!!!!!!!!!!!
    if (process.env.NODE_ENV === 'production') {
      // Sendgrid
      return nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD,
        },
      });
    }

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(template, subject) {
    //send actual email here
    // 1) create  HTML based on a pug template
    //აქამდე ჩვენ ვიყენებდით res.render(' pug template name') რომელიც pug temlate ს გადააქცევდა html file ად და დაარენდერებდა ზემოხსენებულს.but in these case we dont really want to render.all we want to do is to basically create the html out of the template so that we can then send that html as the email
    //remember what does __dirname means? it means currently running script location for these case its utilis folder
    const html = pug.renderFile(
      `${__dirname}/../views/email/${template}.pug`,
      //აქ განვუმარტე ის variable ები რომლებიც ხელმისაწვდომი იქნება ამ html ისთვის რო უფრო personalized and dynamic გავხად`ტ pug ი .ნუ როგორც ვაკეთებდით ხოლმე რა აქამდე
      {
        firstName: this.firstName,
        url: this.url,
        subject,
      }
    );

    // 2) Define email options
    const mailOptions = {
      //this.from is variable that these app class defined above(in these case "(pug in these case,-"`Jonas Schmedtmann <${process.env.EMAIL_FROM}>`")")
      from: this.from,
      to: this.to,
      subject,
      html,
      //now we also want to include a text version of our email into the email.and thats actually really important becouse its better for email delivery rates and also for spam folders
      //so thats how we convert html to simle text
      text: htmlToText(html),
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    //welcome is a template name
    await this.send('welcome', 'Welcome to the Natours Family!');
  }

  //!!!!!!!!!!!!!!!!!!!!!!!!
  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 minutes)'
    );
  }
};
