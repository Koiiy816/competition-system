const AthleteIdentity = require('../models/AthleteIdentity');
const Competition = require('../models/Competition');
const Participant = require('../models/Participant');
const { canUserAccessCompetitionType } = require('../utils/competitionType');

exports.list = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.competitionId);
    if (!competition) return res.status(404).json({ success: false, message: '比赛不存在' });
    if (!canUserAccessCompetitionType(req.user, competition)) return res.status(403).json({ success: false, message: '无权访问此赛事' });
    const query = { competition: competition._id, mergedInto: { $exists: false } };
    if (!req.user.roles.some(role => ['admin', 'chief_referee'].includes(role))) {
      const usedNumbers = await Participant.distinct('athleteNumber', { competition: competition._id, user: req.user.id });
      query.$or = [{ user: req.user.id }, { number: { $in: usedNumbers } }];
    } else if (typeof req.query.schoolName === 'string') {
      const schoolName = req.query.schoolName.trim();
      const usedNumbers = await Participant.distinct('athleteNumber', { competition: competition._id, schoolName });
      query.$or = [{ schoolName }, { number: { $in: usedNumbers } }];
    }
    const identities = await AthleteIdentity.find(query).select('number name schoolName gender birthDate createdAt +idCard').sort({ createdAt: -1 }).lean();
    const data = identities.map(({ idCard, ...identity }) => ({ ...identity,
      maskedIdCard: idCard ? (idCard.length > 4 ? `****${idCard.slice(-4)}` : '****') : '未填写' }));
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

exports.previewMerge = async (req, res, next) => {
  try {
    const { sourceNumber, targetNumber } = req.body;
    const plan = await require('../utils/mergeAthleteIdentities').planMerge(req.params.competitionId, sourceNumber, targetNumber);
    res.json({ success: true, data: plan.preview });
  } catch (error) { if (error.statusCode) res.status(error.statusCode); next(error); }
};

exports.merge = async (req, res, next) => {
  try {
    const { sourceNumber, targetNumber, version, confirmDocumentDifference, documentPolicy } = req.body;
    const result = await require('../utils/mergeAthleteIdentities').mergeIdentities({
      competitionId: req.params.competitionId, sourceNumber, targetNumber, version, confirmDocumentDifference, documentPolicy, operator: req.user.id
    });
    res.json({ success: true, data: result });
  } catch (error) { if (error.statusCode) res.status(error.statusCode); next(error); }
};
