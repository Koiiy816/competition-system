const TrampolineIdentity = require('../models/TrampolineIdentity');
const Participant = require('../models/Participant');
const Competition = require('../models/Competition');
const { getCompetitionSportType, SPORT_TYPES } = require('./competitionType');
const { getTrampolineDocumentKey, getTrampolineIdentityDetails, findTrampolineIdentityConflict } = require('./trampolineIdentity');

// 首次校验通过后固定证件身份；并发请求只能通过同一_id读取同一份绑定。
const bindTrampolineIdentities = async rows => {
  const requested = new Map(rows.filter(row => String(row.idCard || '').trim())
    .map(row => [getTrampolineDocumentKey(row.idCard), row]));
  if (!requested.size) return '';
  const localError = findTrampolineIdentityConflict(rows);
  if (localError) return localError;
  const bindings = await TrampolineIdentity.find({ _id: { $in: [...requested.keys()] } }).lean();
  const stored = bindings.map(binding => ({ ...binding, idCard: requested.get(binding._id).idCard }));
  const known = new Set(bindings.map(binding => binding._id));
  const missing = [...requested].filter(([key]) => !known.has(key));
  if (missing.length) {
    const competitions = await Competition.find({ $or: [{ sportType: /^trampoline$/i }, { type: /蹦床|trampoline/i }] }).select('_id sportType type').lean();
    const competitionIds = competitions.filter(item => getCompetitionSportType(item) === SPORT_TYPES.TRAMPOLINE).map(item => item._id);
    const documents = missing.map(([, row]) => {
      const normalized = String(row.idCard).replace(/\s+/g, '');
      const pattern = [...normalized].map(character => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
      return { idCard: new RegExp(`^\\s*${pattern}\\s*$`, 'i') };
    });
    const legacy = await Participant.find({ competition: { $in: competitionIds }, isVirtualTeam: { $ne: true }, $or: documents })
      .select('name gender idCard birthDate').lean();
    stored.push(...legacy);
  }
  const conflict = findTrampolineIdentityConflict(rows, stored);
  if (conflict) return conflict;
  const documents = missing.map(([key, row]) => new TrampolineIdentity({ _id: key, ...getTrampolineIdentityDetails(row) }));
  try { await Promise.all(documents.map(document => document.validate())); }
  catch (error) { return `证件身份资料不完整或格式不正确：${error.message}`; }
  for (const document of documents) {
    let binding;
    try {
      binding = await TrampolineIdentity.findOneAndUpdate({ _id: document._id }, { $setOnInsert: document.toObject() },
        { upsert: true, new: true, runValidators: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      binding = await TrampolineIdentity.findById(document._id);
      if (!binding) throw error;
    }
    const row = requested.get(document._id);
    const raced = findTrampolineIdentityConflict([row], [{ ...binding.toObject(), idCard: row.idCard }]);
    if (raced) return raced;
  }
  return '';
};

module.exports = { bindTrampolineIdentities };
