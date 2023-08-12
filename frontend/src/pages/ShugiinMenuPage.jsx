import React from 'react';
import { MdGroups2 } from 'react-icons/md';
import { ImTree } from 'react-icons/im';
import BaseMenuLayout from '../layouts/BaseMenuLayout';

const ShugiinMenuIcons = [
  {
    link: '/shugiin_repr',
    icon: <MdGroups2 className="menu-icon" />,
    title: '議員一覧',
  },
  {
    link: '/shugiin_commitee',
    icon: <ImTree className="menu-icon" />,
    title: '委員会一覧',
  },
];
export default function ShugiinMenuPage() {
  return (
    <BaseMenuLayout backTo="/" MenuTitle="衆議院" Links={ShugiinMenuIcons} />
  );
}
