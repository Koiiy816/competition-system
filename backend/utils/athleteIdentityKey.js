const { createHash } = require('crypto');

const text = value => String(value || '').trim();
const dateOnly = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const identityKey = data => {
  const fields = [text(data.name), dateOnly(data.birthDate), text(data.idCard).toUpperCase()];
  return fields.every(Boolean) ? createHash('sha256').update(JSON.stringify(fields)).digest('hex') : null;
};

module.exports = { identityKey, dateOnly };
