const IDENTITY_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const IDENTITY_CHECK_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

const documentTypeForRegion = (regionCode) => ({
  '810000': '香港居民居住证',
  '820000': '澳门居民居住证',
  '830000': '台湾居民居住证'
}[regionCode] || '居民身份证');

// 18 位公民身份号码适用于大陆居民身份证和港澳台居民居住证；
// 香港/澳门本地身份证与护照号码不含相同编码，不能据此猜测个人资料。
export const parseChineseResidentIdentityNumber = (input) => {
  const value = String(input || '').trim().toUpperCase();
  if (!/^\d{17}[0-9X]$/.test(value)) return null;

  const checksum = IDENTITY_WEIGHTS.reduce((sum, weight, index) => sum + Number(value[index]) * weight, 0);
  if (IDENTITY_CHECK_CODES[checksum % 11] !== value[17]) return null;

  const year = Number(value.slice(6, 10));
  const month = Number(value.slice(10, 12));
  const day = Number(value.slice(12, 14));
  const birthDate = new Date(year, month - 1, day);
  if (year < 1800 || year > 2099 || birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) return null;

  return {
    documentType: documentTypeForRegion(value.slice(0, 6)),
    birthDate: `${value.slice(6, 10)}-${value.slice(10, 12)}-${value.slice(12, 14)}`,
    gender: Number(value[16]) % 2 ? 'male' : 'female'
  };
};
