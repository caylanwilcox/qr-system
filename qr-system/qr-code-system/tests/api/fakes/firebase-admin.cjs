// In-memory stand-in for firebase-admin, used by tests/api only.
// Each test sets globalThis.__fake = { tokens, authUsers, db, calls, mails }.
// Optional switches: failUpdate (the next db update throws), failClaims,
// failReadPrefix (reads under that path throw), onRead(path) (runs before each read).
const state = () => globalThis.__fake;
const segments = (path) => (path || '').split('/').filter(Boolean);
const read = (obj, path) =>
  segments(path).reduce((node, key) => (node == null ? undefined : node[key]), obj) ?? null;
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

function write(path, value) {
  const keys = segments(path);
  if (keys.length === 0) {
    state().db = value === null ? {} : clone(value);
    return;
  }
  let node = state().db;
  keys.slice(0, -1).forEach((key) => {
    if (node[key] == null || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  });
  const last = keys[keys.length - 1];
  if (value === null) delete node[last];
  else node[last] = clone(value);
}

const snapshot = (value) => ({ val: () => clone(value), exists: () => value !== null && value !== undefined });

function makeRef(path = '', query = {}) {
  return {
    async once() {
      if (state().db === null) throw new Error('database unavailable');
      if (state().onRead) state().onRead(path);
      if (state().failReadPrefix && path.startsWith(state().failReadPrefix)) throw new Error('read failed');
      let value = read(state().db, path);
      if (query.prefix !== undefined && value && typeof value === 'object') {
        const keys = Object.keys(value).filter((key) => key >= query.prefix && key <= query.end).sort();
        const limited = query.limit ? keys.slice(0, query.limit) : keys;
        value = limited.length ? Object.fromEntries(limited.map((key) => [key, value[key]])) : null;
      }
      return snapshot(value);
    },
    orderByKey: () => makeRef(path, { ...query }),
    startAt: (prefix) => makeRef(path, { ...query, prefix }),
    endAt: (end) => makeRef(path, { ...query, end }),
    limitToFirst: (limit) => makeRef(path, { ...query, limit }),
    async set(value) {
      state().calls.push(['dbSet', path, value]);
      write(path, value);
    },
    async update(values) {
      state().calls.push(['dbUpdate', path, values]);
      if (state().failUpdate) {
        state().failUpdate = false;
        throw new Error('update failed');
      }
      const base = segments(path).join('/');
      Object.entries(values).forEach(([key, value]) => write(base ? `${base}/${key}` : key, value));
    },
    async remove() {
      state().calls.push(['dbRemove', path]);
      write(path, null);
    },
    async transaction(fn) {
      state().calls.push(['dbTransaction', path]);
      const result = fn(clone(read(state().db, path)));
      if (result === undefined) return { committed: false, snapshot: snapshot(read(state().db, path)) };
      write(path, result);
      return { committed: true, snapshot: snapshot(result) };
    },
  };
}

let nextUid = 1;

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
      const taken = Object.values(state().authUsers).some(
        (user) => user.email && data.email && user.email.toLowerCase() === data.email.toLowerCase()
      );
      if (taken) {
        const error = new Error('email exists');
        error.code = 'auth/email-already-exists';
        throw error;
      }
      const uid = data.uid || `new${nextUid++}`;
      state().authUsers[uid] = { uid, email: data.email, customClaims: {} };
      return { ...data, uid };
    },
    async revokeRefreshTokens(uid) {
      state().calls.push(['revokeTokens', uid]);
    },
    async deleteUser(uid) {
      state().calls.push(['deleteUser', uid]);
      delete state().authUsers[uid];
    },
    async setCustomUserClaims(uid, claims) {
      state().calls.push(['setClaims', uid, claims]);
      if (state().failClaims) throw new Error('claims failed');
    },
  }),
  database: () => ({
    ref: (path) => makeRef(path),
  }),
};
