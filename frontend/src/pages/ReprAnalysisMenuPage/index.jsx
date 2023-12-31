import React from 'react';
import { PiGraphFill } from 'react-icons/pi';
import { SlSpeech } from 'react-icons/sl';
import BaseMenuLayout from '../../layouts/BaseMenuLayout';

const ReprAnalysisMenuIcons = [
  {
    link: '/repr_analysis/speech',
    icon: <SlSpeech className="menu-icon" />,
    title: '発言閲覧',
  },
  {
    link: '/repr_analysis/graph',
    icon: <PiGraphFill className="menu-icon" />,
    title: 'スタンスの可視化',
  },
];

export default function ReprAnalysisMenuPage() {
  return (
    <BaseMenuLayout
      backTo="/"
      MenuTitle="議員分析"
      Links={ReprAnalysisMenuIcons}
    />
  );
}
