// In-memory stand-in for firebase-admin, used by tests/api only.
// Each test sets globalThis.__fake = { tokens, authUsers, db, calls, mails }.
const state = () => globalThis.__fake;
const read = (obj, path) =>
  path.split('/').reduce((node, key) => (node == null ? undefined : node[key]), obj) ?? null;

module.exports = {
  apps: [],
  initializeApp() {
    this.apps.push({});
  },
  credential: { cert: (serviceAccount) => serviceAccount },
  auth: () => ({
    async verifyIdToken(token) {
      const decoded = state().tokens[token];
      if (!decoded) throw new Error('invalid token');
      return decoded;
    },
    async getUser(uid) {
      const user = state().authUsers[uid];
      if (!user) {
        const error = new Error('user not found');
        error.code = 'auth/user-not-found';
        throw error;
      }
      return user;
    },
    async updateUser(uid, updates) {
      state().calls.push(['updateUser', uid, updates]);
      Object.assign(state().authUsers[uid], updates);
    },
    async createUser(data) {
      state().calls.push(['createUser', data]);
      state().authUsers[data.uid] = { uid: data.uid, email: data.email, customClaims: {} };
      return data;
    },
    async setCustomUserClaims(uid, claims) {
      state().calls.push(['setClaims', uid, claims]);
    },
  }),
  database: () => ({
    ref: (path) => ({
      async once() {
        if (state().db === null) throw new Error('database unavailable');
        return { val: () => read(state().db, path) };
      },
      async set(value) {
        state().calls.push(['dbSet', path, value]);
      },
    }),
  }),
};
