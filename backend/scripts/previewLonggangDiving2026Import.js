const registrations = require('./longgang-diving-2026-preview.json');

const groups = new Map();
const pairs = new Map();
for (const athlete of registrations) {
  for (const project of athlete.projects) {
    const eventKey = `${athlete.ageGroup}｜${project.event}`;
    groups.set(eventKey, (groups.get(eventKey) || 0) + 1);
    if (project.pairCode) {
      const key = `${eventKey}｜${project.pairCode}`;
      const list = pairs.get(key) || [];
      list.push(athlete.name);
      pairs.set(key, list);
    }
  }
}

console.log('龙岗区跳水报名预览（不会写入数据库）');
console.log(`运动员：${registrations.length} 人；个人/双人报名记录：${[...groups.values()].reduce((sum, count) => sum + count, 0)} 项`);
console.log('\n各项目报名人数：');
for (const [key, count] of [...groups.entries()].sort()) console.log(`- ${key}: ${count}`);
console.log('\n双人配对：');
let invalid = 0;
for (const [key, names] of [...pairs.entries()].sort()) {
  const valid = names.length === 2;
  if (!valid) invalid += 1;
  console.log(`- ${valid ? '✓' : '!' } ${key}: ${names.join('、')}`);
}
console.log(`\n配对校验：${invalid ? `${invalid} 组需要人工确认` : '全部双人配对均为两人'}`);
process.exitCode = invalid ? 2 : 0;