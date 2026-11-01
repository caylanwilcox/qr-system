// Points the api/ code at in-memory fakes so tests never touch Firebase or send email.
import { registerHooks } from 'node:module';

if (typeof registerHooks !== 'function') {
  throw new Error('tests/api needs Node.js 22.15+ (module.registerHooks).');
}

const FAKES = {
  'firebase-admin': new URL('./fakes/firebase-admin.cjs', import.meta.url).href,
  nodemailer: new URL('./fakes/nodemailer.cjs', import.meta.url).href,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (FAKES[specifier]) return { url: FAKES[specifier], shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
