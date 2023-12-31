import React from 'react';
import { RiGovernmentFill, RiGovernmentLine } from 'react-icons/ri';
import BaseMenuLayout from '../../layouts/BaseMenuLayout';

const ReprMenuPageIcons = [
  {
    link: '/repr_analysis/speech/upper',
    icon: <RiGovernmentLine className="menu-icon" />,
    title: '参議院',
  },
  {
    link: '/repr_analysis/speech/lower',
    icon: <RiGovernmentFill className="menu-icon" />,
    title: '衆議院',
  },
];

export default function ReprOpinionMenuPage() {
  return (
    <BaseMenuLayout
      backTo="/repr_analysis"
      MenuTitle="発言閲覧"
      Links={ReprMenuPageIcons}
    />
  );
}
