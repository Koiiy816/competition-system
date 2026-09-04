const Participant = require('../models/Participant');

const normalize = (value) => String(typeof value === 'object' ? value?.name : value || '').trim();
const isDoubleDiving = (value) => /双人|雙人/.test(String(value || ''));

// Sets both entries together so there is never a one-sided diving pair.
exports.setDivingPair = async (req, res, next) => {
  try {
    const competitionId = req.params.competitionId;
    const participant = await Participant.findOne({ _id: req.params.id, competition: competitionId, isVirtualTeam: { $ne: true } });
    if (!participant) return res.status(404).json({ success: false, message: '未找到当前报名记录' });
    const isPrivileged = req.user.roles?.includes('admin') || req.user.roles?.includes('chief_referee');
    const isOrganization = req.user.roles?.includes('organization');
    if (isOrganization && !isPrivileged && (participant.user?.toString() !== req.user.id || participant.status !== 'pending')) {
      return res.status(403).json({ success: false, message: '只能修改自己提交的待审核双人报名' });
    }

    const currentPairId = participant.additionalInfo?.divingPair?.pairId;
    const partnerId = String(req.body.partnerId || '').trim();
    if (!partnerId) {
      const pairMembers = currentPairId
        ? await Participant.find({ competition: competitionId, 'additionalInfo.divingPair.pairId': currentPairId, isVirtualTeam: { $ne: true } }).select('_id')
        : [participant];
      await Participant.updateMany(
        { _id: { $in: pairMembers.map((item) => item._id) } },
        { $unset: { 'additionalInfo.divingPair': '' }, $set: { updatedAt: new Date() } }
      );
      return res.status(200).json({ success: true, data: { paired: false } });
    }

    if (!isDoubleDiving(participant.event)) return res.status(400).json({ success: false, message: '只有双人跳水项目可以设置搭档' });
    const partner = await Participant.findOne({ _id: partnerId, competition: competitionId, isVirtualTeam: { $ne: true } });
    if (!partner || partner._id.toString() === participant._id.toString()) return res.status(400).json({ success: false, message: '请选择另一位有效搭档' });
    if (isOrganization && !isPrivileged && (partner.user?.toString() !== req.user.id || partner.status !== 'pending')) {
      return res.status(403).json({ success: false, message: '只能选择本单位自己提交且待审核的报名作为搭档' });
    }
    if (!isDoubleDiving(partner.event)) return res.status(400).json({ success: false, message: '搭档也必须报名同一个双人跳水项目' });

    const sameUnit = normalize(participant.schoolName) === normalize(partner.schoolName);
    const sameGroup = normalize(participant.ageGroup || participant.grade) === normalize(partner.ageGroup || partner.grade);
    const sameEvent = normalize(participant.event) === normalize(partner.event);
    const mixed = /混合|混雙/.test(String(participant.event || ''));
    const gendersMatch = mixed ? participant.gender !== partner.gender : participant.gender === partner.gender;
    if (!sameUnit || !sameGroup || !sameEvent || !gendersMatch) {
      return res.status(400).json({ success: false, message: '搭档须为同单位、同组别、同项目；同性双人须同性别，混合双人须一男一女' });
    }

    const currentPlan = participant.additionalInfo?.divingPlan;
    const partnerPlan = partner.additionalInfo?.divingPlan;
    if (currentPlan && partnerPlan && JSON.stringify(currentPlan) !== JSON.stringify(partnerPlan)) {
      return res.status(400).json({ success: false, message: '两位选手已有不同动作表，不能直接配对；请先统一动作表后再设置搭档' });
    }

    const oldPairIds = [currentPairId, partner.additionalInfo?.divingPair?.pairId].filter(Boolean);
    if (oldPairIds.length) {
      await Participant.updateMany(
        { competition: competitionId, 'additionalInfo.divingPair.pairId': { $in: oldPairIds }, isVirtualTeam: { $ne: true } },
        { $unset: { 'additionalInfo.divingPair': '' }, $set: { updatedAt: new Date() } }
      );
    }

    const orderedIds = [participant._id.toString(), partner._id.toString()].sort();
    const pairId = `diving:${competitionId}:${orderedIds.join(':')}`;
    const common = {
      pairId,
      pairKey: `${normalize(participant.event)}|${normalize(participant.ageGroup || participant.grade)}|${normalize(participant.schoolName)}`,
      event: participant.event,
      ageGroup: participant.ageGroup || participant.grade || '',
      type: mixed ? 'mixed' : 'same-gender'
    };
    const sharedPlan = currentPlan || partnerPlan;
    const now = new Date();
    const currentUpdate = { $set: { 'additionalInfo.divingPair': { ...common, partnerId: partner._id.toString(), partnerName: partner.name }, updatedAt: now } };
    const partnerUpdate = { $set: { 'additionalInfo.divingPair': { ...common, partnerId: participant._id.toString(), partnerName: participant.name }, updatedAt: now } };
    if (sharedPlan) {
      currentUpdate.$set['additionalInfo.divingPlan'] = sharedPlan;
      partnerUpdate.$set['additionalInfo.divingPlan'] = sharedPlan;
    }
    await Promise.all([Participant.updateOne({ _id: participant._id }, currentUpdate), Participant.updateOne({ _id: partner._id }, partnerUpdate)]);
    return res.status(200).json({ success: true, data: { paired: true, pairId, partnerName: partner.name } });
  } catch (error) {
    next(error);
  }
};
