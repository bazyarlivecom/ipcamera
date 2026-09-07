const crypto = require('crypto');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function buildDigestHeader(method, uri, realm, nonce, qop, opaque, user, pass, nc=1, cnonce='0a4f113b') {
  const ncStr = ('00000000' + nc).slice(-8);
  const ha1 = md5(user + ':' + realm + ':' + pass);
  const ha2 = md5(method + ':' + uri);
  let response;
  if (qop && qop.includes('auth')) {
    response = md5(ha1 + ':' + nonce + ':' + ncStr + ':' + cnonce + ':auth:' + ha2);
  } else {
    response = md5(ha1 + ':' + nonce + ':' + ha2);
  }
  let auth = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  if (qop && qop.includes('auth')) auth += `, qop=auth, nc=${ncStr}, cnonce="${cnonce}"`;
  if (opaque) auth += `, opaque="${opaque}"`;
  return auth;
}

console.log('Sample Digest Header:', buildDigestHeader('GET', '/cgi-bin/snapshot.cgi?channel=1', 'Login to DAHUA', '12345678', 'auth', 'test', 'admin', 'admin123'));
