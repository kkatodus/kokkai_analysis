import React from 'react';
import { BsFillPeopleFill } from 'react-icons/bs';
import BaseMenuLayout from '../../layouts/BaseMenuLayout';

const StatsMenuIcons = [
  {
    link: '/stats/population',
    icon: <BsFillPeopleFill className="menu-icon" />,
    title: '人口推移',
  },
];

export default function StatsMenuPage() {
  return <BaseMenuLayout backTo="/" MenuTitle="統計" Links={StatsMenuIcons} />;
}
