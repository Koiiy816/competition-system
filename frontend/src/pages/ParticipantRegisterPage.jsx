import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import participantService from '../services/participantService';
import { useAuth } from '../contexts/AuthContext';

const ParticipantRegisterPage = () => {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [form, setForm] = useState({
    type: 'individual',
    teamName: '',
    members: [],
    // 比赛项目
    event: '',
    // 学校与年级
    schoolName: user?.profile?.organization || '',
    grade: '',
    additionalInfo: {}
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const districts = [
    '福田区',
    '罗湖区',
    '盐田区',
    '南山区',
    '宝安区',
    '龙岗区',
    '龙华区',
    '坪山区',
    '光明区',
    '大鹏新区',
    '深汕特别合作区'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    setFile(f || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { ...form };
      if (file) payload.registrationFormFile = file;
      await participantService.createParticipant(competitionId, payload);
      navigate(`/competitions/${competitionId}`);
    } catch (err) {
      setError(err?.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>参赛者报名</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>参赛类型</label>
          <select name="type" value={form.type} onChange={handleChange}>
            <option value="individual">个人</option>
            <option value="team">团队</option>
          </select>
        </div>
        <div>
          <label>团队名称（若为团队）</label>
          <input name="teamName" value={form.teamName} onChange={handleChange} />
        </div>
        <div>
          <label>所属单位</label>
          <select name="schoolName" value={form.schoolName} onChange={handleChange} required>
            <option value="">请选择单位</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label>年级</label>
          <input name="grade" value={form.grade} onChange={handleChange} required />
        </div>
        <div>
          <label>比赛项目</label>
          <input name="event" value={form.event} onChange={handleChange} required />
        </div>
        <div>
          <label>报名表文件（PDF/图片）</label>
          <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>{loading ? '提交中...' : '提交报名'}</button>
      </form>
    </div>
  );
};

export default ParticipantRegisterPage;