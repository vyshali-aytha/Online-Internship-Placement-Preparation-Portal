function isValidRequest(body) {
  const { fullName, email, companyName, password } = body || {};
  return Boolean(
    fullName && companyName && password &&
    password.length >= 8 &&
    /^\S+@\S+\.\S+$/.test(email || '')
  );
}

module.exports = { isValidRequest };
