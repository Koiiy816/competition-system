export const PARTICIPANT_TAGS = {
  '*': '外地户籍',
  '☆': '优秀队',
  '#': '示范基地',
  '◎': '港澳籍',
  '⊙': '双计分',
  '★': '不占名额',
  '▽': '获名次不占名额',
  '※': '白名单名额',
  '△': '特别名额',
  '◇': '候补',
  '(R)': '替补队员',
  '(T)': '参加团体'
};

export const PARTICIPANT_TAGS_HELPER_TEXT = Object.entries(PARTICIPANT_TAGS)
  .map(([symbol, label]) => `${symbol}${label}`)
  .join('，');
