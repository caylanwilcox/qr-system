// In-memory stand-in for nodemailer, used by tests/api only. Sent mail goes to globalThis.__fake.mails.
module.exports = {
  createTransport: () => ({
    async sendMail(message) {
      globalThis.__fake.mails.push(message);
    },
  }),
};
