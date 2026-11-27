// Sort numbered courts in their natural order, e.g. 第一场地、第二场地、第三场地。
const chineseCourtNumbers = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10
};

export const courtSortOrder = (court) => {
  const match = String(court || '').match(/第\s*([一二三四五六七八九十\d]+)\s*[场場]地/);
  if (!match) return Number.MAX_SAFE_INTEGER;

  return /^\d+$/.test(match[1])
    ? Number(match[1])
    : (chineseCourtNumbers[match[1]] || Number.MAX_SAFE_INTEGER);
};

export const compareCourts = (first, second) => (
  courtSortOrder(first) - courtSortOrder(second)
  || String(first || '').localeCompare(String(second || ''), 'zh-CN')
);
