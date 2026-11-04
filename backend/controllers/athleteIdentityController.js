const AthleteIdentity = require('../models/AthleteIdentity');
const Competition = require('../models/Competition');
const { canUserAccessCompetitionType } = require('../utils/competitionType');

exports.list = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.competitionId);
    if (!competition) return res.status(404).json({ success: false, message: '比赛不存在' });
    if (!canUserAccessCompetitionType(req.user, competition)) return res.status(403).json({ success: false, message: '无权访问此赛事' });
    const query = { competition: competition._id };
    if (!req.user.roles.some(role => ['admin', 'chief_referee'].includes(role))) query.user = req.user.id;
    if (typeof req.query.schoolName === 'string') query.schoolName = req.query.schoolName.trim();
    const identities = await AthleteIdentity.find(query).select('number name schoolName gender birthDate createdAt +idCard').sort({ createdAt: -1 }).lean();
    const data = identities.map(({ idCard, ...identity }) => ({ ...identity,
      maskedIdCard: idCard ? (idCard.length > 4 ? `****${idCard.slice(-4)}` : '****') : '未填写' }));
    res.json({ success: true, data });
  } catch (error) { next(error); }
};
